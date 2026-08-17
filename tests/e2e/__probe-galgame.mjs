/**
 * 湛蓝回忆 端到端冒烟
 *
 * 分两段:
 *
 *   ① 纯逻辑(不开浏览器)—— K 链推演 和 剧情解析。
 *      这两块是本 App 最容易出错、又最难靠肉眼验证的部分:
 *      K 链错了要玩十几幕才看得出来,解析器错了表现是「偶尔少一句话」。
 *      它们都是纯函数,直接在 Node 里跑最划算。
 *
 *   ② 真实浏览器(走 CDP)—— 本项目历史上的恶性 bug 有个共同特征:
 *      build 和 lint 全绿,只在浏览器里才炸(vue 模式 hydrate 没人调、
 *      Proxy 写不进 IndexedDB、CSS 变量没生效…),静态检查一个都抓不到。
 *
 * 用法:先 `npm run dev`,再 `node tests/e2e/__probe-galgame.mjs`
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { advanceWindow, makeKUnit, readContext } from '../../js/apps/galgame/services/kchain.js';
import { parseStoryResponse } from '../../js/apps/galgame/services/story-engine.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EDGE_CANDIDATES = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const BASE = 'http://localhost:5173';
const PORT = 9351;
const PROFILE = path.join(os.tmpdir(), `gg-probe-${Date.now()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok, detail });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ============================================================
// ① 纯逻辑
// ============================================================

function probeKChain() {
    console.log('\n── K 链推演 ─────────────────────────────');

    const nodeMap = new Map();
    const trail = [];

    /** 走一幕:算窗口 → 满了就压(用假摘要代替 AI) */
    const step = (id, parentKState, choice) => {
        const adv = advanceWindow(parentKState, id, 4);
        const node = {
            id,
            parentId: trail.length && parentKState ? trail[trail.length - 1].id : '',
            depth: trail.length,
            choice: { kind: choice ? 'option' : 'start', text: choice || '' },
            segments: [{ speaker: '夏海遥', text: `第 ${trail.length + 1} 幕的台词`, mood: 'default' }],
            options: [],
            kState: { units: adv.units, kCount: adv.kCount, pending: false },
        };
        if (adv.needsCompress) {
            const unit = makeKUnit({
                units: adv.units,
                index: adv.kCount,
                content: `K${adv.kCount} 的摘要`,
                nodeMap: new Map([...nodeMap, [id, node]]),
            });
            node.kState = { units: [unit], kCount: adv.kCount + 1, pending: false };
        }
        nodeMap.set(id, node);
        return node;
    };

    // 主线:R1..R10
    let prev = null;
    const main = [];
    for (let i = 1; i <= 10; i += 1) {
        const node = step(`n${i}`, prev?.kState || null, i === 1 ? '' : `选项${i}`);
        node.parentId = prev?.id || '';
        node.depth = i - 1;
        if (prev) prev.childIds = [...(prev.childIds || []), node.id];
        main.push(node);
        trail.push(node);
        prev = node;
    }

    // 主线节点叫 n1..n10 → 显示成 R1..R10;分支节点(b2 / b4)原样带前缀,一眼能看出不是主线
    const describe = (n) => n.kState.units
        .map((u) => (u.type === 'k' ? `K${u.index}` : `R${u.nodeId.replace(/^n/, '')}`))
        .join('+');

    check('R1~R3 只积攒不压缩', describe(main[2]) === 'R1+R2+R3', describe(main[2]));
    check('第 4 幕触发压缩 → 窗口只剩 K0', describe(main[3]) === 'K0', describe(main[3]));
    check('K0 覆盖前 4 幕', main[3].kState.units[0].coversNodeIds.length === 4);
    check('K0+R5+R6 继续积攒', describe(main[5]) === 'K0+R5+R6', describe(main[5]));
    check('K0+R5+R6+R7 满 4 格 → K1', describe(main[6]) === 'K1', describe(main[6]));
    check('K1 把 K0 覆盖过的幕继承下来(共 7 幕)', main[6].kState.units[0].coversNodeIds.length === 7, String(main[6].kState.units[0].coversNodeIds.length));
    check('K1+R8 —— 用户描述的「最终状态」', describe(main[7]) === 'K1+R8', describe(main[7]));
    check('R9 也躺在窗口里(K1+R8+R9)', describe(main[8]) === 'K1+R8+R9', describe(main[8]));
    check('R10 凑满 → K2', describe(main[9]) === 'K2', describe(main[9]));

    // ★ 分支:回到第 1 幕另开一条线,那条线**不该**出现 K0
    const branch = step('b2', main[0].kState, '另一个选择');
    branch.parentId = main[0].id;
    branch.depth = 1;
    main[0].childIds = [...(main[0].childIds || []), branch.id];
    nodeMap.set(branch.id, branch);
    check('回到第 1 幕开新分支 → 窗口是 R1+Rb2,没有 K0', describe(branch) === 'R1+Rb2', describe(branch));
    check('新分支的 kCount 仍是 0', branch.kState.kCount === 0, String(branch.kState.kCount));

    // 主线走到第 3 幕时开分支:那条线再走一幕就该压了(和主线各算各的)
    const late = step('b4', main[2].kState, '岔路');
    late.parentId = main[2].id;
    check('从第 3 幕开的分支再走一幕 → 正常触发 K0', describe(late) === 'K0', describe(late));

    // 上下文读取
    const ctx = readContext(main[8], nodeMap, { enabled: true, windowSize: 4, rawTail: 2, autoCompress: true });
    check('上下文里带上了 K1 摘要', ctx.memory.includes('K1'), ctx.memory.slice(0, 20));
    check('上下文里带了原文', ctx.recent.includes('的台词'));
    check('窗口统计:用了 3 格,还差 1 幕', ctx.stats.windowUsed === 3 && ctx.stats.untilCompress === 1, `${ctx.stats.windowUsed}/${ctx.stats.windowSize}`);

    // rawTail 去重:压缩刚发生那一幕,窗口只有 K,但 rawTail 要补原文回来
    const afterCompress = readContext(main[3], nodeMap, { enabled: true, windowSize: 4, rawTail: 2, autoCompress: true });
    check('压缩刚发生时 rawTail 补回了原文', afterCompress.recent.length > 0 && afterCompress.stats.rawScenes === 2, `${afterCompress.stats.rawScenes} 幕原文`);
    const noTail = readContext(main[3], nodeMap, { enabled: true, windowSize: 4, rawTail: 0, autoCompress: true });
    check('rawTail=0 时严格按窗口走(没有原文)', noTail.recent === '', `"${noTail.recent.slice(0, 12)}"`);
}

function probeParser() {
    console.log('\n── 剧情解析 ─────────────────────────────');

    const ctx = { castNames: ['夏海遥', '我妻由乃'], playerName: '林澈', optionCount: 3 };

    const good = `[TEXT]
[NAME]夏海遥[/NAME]"你也是来看海的吗?"
她把画板往身侧挪了挪,给我让出半个台阶。
时间:下午三点,海风开始变凉。
[NAME]我妻由乃[/NAME]"这个位置我盯很久了。"
[/TEXT]
[SCENE]海边台阶[/SCENE]
[MOOD]夏海遥:开心[/MOOD]
[OPTIONS]
1. 在她旁边坐下
2. 问她画的是什么
3. 说自己只是路过
[/OPTIONS]`;

    const r = parseStoryResponse(good, ctx);
    check('解析出 4 句', r.segments.length === 4, String(r.segments.length));
    check('第 1 句认出说话人', r.segments[0].speaker === '夏海遥', r.segments[0].speaker);
    check('第 1 句带上了 [MOOD] 标的情绪', r.segments[0].mood === 'happy', r.segments[0].mood);
    check('第 2 句是旁白', r.segments[1].speaker === '', `"${r.segments[1].speaker}"`);
    // ★ 原型这里会把「时间」当成一个角色(正则 /^([^：:]+)[：:]/ 无条件匹配)
    check('「时间:下午三点」没被当成角色台词', r.segments[2].speaker === '' && r.segments[2].text.startsWith('时间'), `speaker="${r.segments[2].speaker}"`);
    // ★ 原型 nameInTag.includes('我') 会把整句丢掉
    check('名字带「我」的角色没被丢掉', r.segments[3]?.speaker === '我妻由乃', r.segments[3]?.speaker || '(丢了)');
    check('场景解析出来了', r.scene === '海边台阶', r.scene);
    check('选项去掉了编号', r.options.length === 3 && r.options[0] === '在她旁边坐下', r.options.join(' / '));
    check('没有警告', r.warnings.length === 0, r.warnings.join(';'));

    // 模型不听话:没有 [TEXT]、没有 [OPTIONS]
    const messy = `夏海遥:"要下雨了。"
我们一起往回走。`;
    const m = parseStoryResponse(messy, ctx);
    check('没有标签时也能兜住', m.segments.length === 2, String(m.segments.length));
    check('冒号写法在名册里就认', m.segments[0].speaker === '夏海遥', m.segments[0].speaker);
    check('缺标签会给出警告', m.warnings.length === 2, m.warnings.join(';'));

    // 玩家台词:不丢,标出来
    const playerLine = `[TEXT]
[NAME]林澈[/NAME]"我先走了。"
[/TEXT]
[OPTIONS]
走开
留下
[/OPTIONS]`;
    const p = parseStoryResponse(playerLine, ctx);
    check('AI 替玩家说话时不丢内容,只标记', p.segments.length === 1 && p.segments[0].isPlayer === true);
}

// ============================================================
// ② 浏览器
// ============================================================

class Cdp {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.pending = new Map();
        this.console = [];
        ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
                return;
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
                const text = (msg.params.args || [])
                    .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
                    .join(' ');
                this.console.push(`[${msg.params.type}] ${text}`);
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                const d = msg.params.exceptionDetails;
                this.console.push(`[exception] ${d.text} ${d.exception?.description || ''}`);
            }
        });
    }

    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`CDP 超时: ${method}`));
                }
            }, 60000);
        });
    }

    async evaluate(expression) {
        const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
            throw new Error('页面内报错: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
        }
        return res.result.value;
    }

    async waitFor(expression, { timeout = 20000, label = expression } = {}) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            try {
                if (await this.evaluate(`(() => { try { return !!(${expression}); } catch (_) { return false; } })()`)) return true;
            } catch (_) { /* 页面可能正在导航 */ }
            await sleep(250);
        }
        // 光说「超时了」没用,真正的原因基本都在控制台里
        const noise = this.console.filter((l) => /^\[(error|exception|warning)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时,控制台里有这些:`);
            noise.slice(-12).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }

    async screenshot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `gg-probe-${name}.png`);
        fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
        return file;
    }
}

function openWs(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener('open', () => resolve(ws));
        ws.addEventListener('error', reject);
    });
}

const openApp = `window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'galgame' } }))`;

async function probeBrowser() {
    const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
    if (!edge) throw new Error('找不到 Edge / Chrome');

    const proc = spawn(edge, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${PROFILE}`,
        '--no-first-run',
        '--disable-gpu',
        '--window-size=430,932',
        'about:blank',
    ], { stdio: 'ignore' });

    let wsUrl = '';
    for (let i = 0; i < 60; i += 1) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
            wsUrl = (await res.json()).webSocketDebuggerUrl;
            if (wsUrl) break;
        } catch (_) { /* 还没起来 */ }
        await sleep(250);
    }
    if (!wsUrl) throw new Error('浏览器没起来');

    const browser = new Cdp(await openWs(wsUrl));
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { targetInfos } = await browser.send('Target.getTargets');
    const info = targetInfos.find((t) => t.targetId === targetId);
    const page = new Cdp(await openWs(info.webSocketDebuggerUrl || `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`));

    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Log.enable');

    console.log('\n── 启动 ─────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: 'app 注册' });
    await sleep(1500);

    check('App 已注册', await page.evaluate(`(window.__phoneAppsRef.value || []).some(a => a.id === 'galgame')`));

    const stores = await page.evaluate(`
        (() => {
            const names = window.myDb?.getStoreNames?.() || [];
            return ['ggGames','ggNodes','ggLibrary'].filter(n => names.includes(n));
        })()
    `);
    check('IndexedDB 三张表都建好了', stores.length === 3, stores.join(', '));

    // 确保 nook 里有能用的世界观 / 用户 / AI —— 没有的话新建一局那一步就走不下去
    const seeded = await page.evaluate(`
        (async () => {
            const s = window.settingsSdk;
            if (!s) return { ok: false, why: 'settingsSdk 未就绪' };
            let world = s.worlds.getActive?.() || s.worlds.list()[0];
            if (!world) world = await s.worlds.create({ name: '苍海市' });
            let ai = s.aiPersons.list().find(a => String(a.boundWorldId||'') === String(world.id)) || s.aiPersons.list()[0];
            if (!ai) ai = await s.aiPersons.create({ name: '夏海遥', personality: '安静、爱画画', boundWorldId: world.id });
            const user = s.defaultUserCard?.getDefault?.() || s.users.getActive?.() || s.users.list()[0];
            return { ok: true, worldId: String(world.id), aiId: String(ai.id), aiName: ai.name, userId: String(user?.id || '') };
        })()
    `);
    check('nook 里有可用的世界观 / 人设', seeded.ok === true, seeded.why || `${seeded.aiName}@${seeded.worldId}`);

    console.log('\n── 打开 App ─────────────────────────────');
    await page.evaluate(openApp);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-root')`, { label: '根组件挂载' });
    await sleep(1000);

    const theme = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="galgame"]');
            const cs = getComputedStyle(shell);
            return {
                attr: shell.getAttribute('data-gg-theme') || '',
                primary: cs.getPropertyValue('--gg-primary').trim(),
                statusBar: (window.__phoneAppsRef.value.find(a => a.id === 'galgame') || {}).statusBarColor || '',
            };
        })()
    `);
    check('主题属性写到了 app-shell', theme.attr === 'azure', theme.attr);
    check('主题 token 真的生效', theme.primary === '#5DADE2', theme.primary);
    check('状态栏颜色从 CSS 变量转发给了框架', theme.statusBar === '#2C3E50', theme.statusBar);

    const svgOk = await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] svg')]
            .every(s => s.getBoundingClientRect().width < 60)
    `);
    check('没有被撑爆的 SVG(300×150 兜底生效)', svgOk);

    const indicatorHit = await page.evaluate(`
        (() => {
            const ind = document.querySelector('.app-shell[data-app-id="galgame"] .home-indicator');
            if (!ind) return { ok: false, why: 'indicator 不存在' };
            const r = ind.getBoundingClientRect();
            const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            const ok = el === ind || ind.contains(el) || (el && el.closest && !!el.closest('.app-bottom'));
            return { ok, why: ok ? '' : (el ? (el.className || el.tagName) : 'null') };
        })()
    `);
    check('home 指示条浮在最上层（能拖出卡片）', indicatorHit.ok, indicatorHit.why);

    await page.screenshot('01-launcher');

    console.log('\n── 新建一局 ─────────────────────────────');
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-launcher .gg-btn')]
            .find(b => /新建一局/.test(b.textContent))?.click()
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-pick-item')`, { label: '新建弹窗' });
    await sleep(400);
    await page.evaluate(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-pick-item')?.click()`);
    await sleep(200);
    await page.screenshot('02-new-game');
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .ac-modal-footer .ac-btn')]
            .find(b => b.textContent.trim() === '开始')?.click()
    `);
    await sleep(1200);

    const gameRow = await page.evaluate(`
        (async () => {
            const rows = await window.myDb.getAllRecords('ggGames');
            const g = rows[rows.length - 1];
            return g ? { id: g.id, title: g.title, cast: (g.castIds||[]).length, world: g.worldId } : null;
        })()
    `);
    check('一局已经写进 ggGames', Boolean(gameRow?.id), gameRow ? `${gameRow.title} / ${gameRow.cast} 位角色` : '没写进去');
    check('世界观绑上了', Boolean(gameRow?.world), gameRow?.world || '');

    // 没配 API 时点「开始」:要给一句**说清该去哪儿**的话,而不是崩掉或者干等
    // (原型这里弹的是 `API请求失败: 401 Unauthorized {...}`)
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-launcher .gg-btn')]
            .find(b => /开始这个故事/.test(b.textContent))?.click()
    `);
    await sleep(1200);
    const noApi = await page.evaluate(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-gen-error')?.textContent.replace(/\\s+/g,' ').trim() || ''`);
    check('没配 API 时给出可操作的提示', /nook/.test(noApi), noApi.slice(0, 40));

    console.log('\n── 灌一条 10 幕的剧情线 ─────────────────');
    // 不调真 AI:直接往共享持久层写节点,再刷新让 App 自己读回来。
    // (AGENTS2 §13.7.2:测试要驱动运行中的应用,只有「真实 UI 交互」和
    //  「共享的持久层」两条可靠路径 —— 从外面 import 应用内部模块拿到的是另一个实例。)
    const seedNodes = await page.evaluate(`
        (async () => {
            const rows = await window.myDb.getAllRecords('ggGames');
            const game = rows[rows.length - 1];
            const nodes = [];
            let prevK = null;
            let parentId = '';
            let kCount = 0;
            const mk = (i, id, choice, branchOf) => {
                const units = [...(prevK ? prevK.units : []), { type: 'r', nodeId: id }];
                let kState = { units, kCount, pending: false };
                if (units.length >= 4) {
                    kState = {
                        units: [{
                            type: 'k', id: 'k-' + i, index: kCount, createdAt: Date.now(),
                            content: '前 ' + units.length + ' 幕的摘要:两人在海边遇见,聊到了画。',
                            coversNodeIds: units.flatMap(u => u.type === 'k' ? u.coversNodeIds : [u.nodeId]),
                        }],
                        kCount: kCount + 1, pending: false,
                    };
                }
                return {
                    id, gameId: game.id, parentId: branchOf != null ? branchOf : parentId,
                    depth: i, choice: { kind: choice ? 'option' : 'start', text: choice || '' },
                    segments: [
                        { speaker: '夏海遥', text: '第 ' + (i + 1) + ' 幕:海风把画纸吹起来了。', mood: 'default' },
                        { speaker: '', text: '远处的灯塔开始亮了。', mood: 'default' },
                    ],
                    options: ['往前走一步', '先站着不动', '开口叫住她'],
                    sceneKey: '', childIds: [], kState, ending: null, createdAt: Date.now() + i,
                };
            };
            for (let i = 0; i < 10; i += 1) {
                const id = 'pn' + i;
                const node = mk(i, id, i === 0 ? '' : '往前走一步');
                nodes.push(node);
                if (parentId) {
                    const parent = nodes.find(n => n.id === parentId);
                    parent.childIds.push(id);
                }
                parentId = id;
                prevK = node.kState;
                kCount = node.kState.kCount;
            }
            // 从第 2 幕(pn1)另开一条分支 —— 这条线的窗口应该还很浅
            const branchParent = nodes.find(n => n.id === 'pn1');
            const bUnits = [...branchParent.kState.units, { type: 'r', nodeId: 'pb0' }];
            const branch = {
                id: 'pb0', gameId: game.id, parentId: 'pn1', depth: 2,
                choice: { kind: 'custom', text: '转身往回走' },
                segments: [{ speaker: '', text: '我没有回头,径直走进了巷子。', mood: 'default' }],
                options: ['继续走', '停下来'],
                sceneKey: '', childIds: [],
                kState: { units: bUnits, kCount: branchParent.kState.kCount, pending: false },
                ending: null, createdAt: Date.now() + 100,
            };
            branchParent.childIds.push('pb0');
            nodes.push(branch);

            for (const n of nodes) await window.myDb.put('ggNodes', n);
            game.rootNodeId = 'pn0';
            game.currentNodeId = 'pn9';
            await window.myDb.put('ggGames', game);
            return { count: nodes.length, gameId: game.id, branchWindow: bUnits.length };
        })()
    `);
    check('11 个节点写进了 ggNodes', seedNodes.count === 11, String(seedNodes.count));

    await page.send('Page.navigate', { url: BASE });
    await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: '重新注册' });
    await sleep(1500);
    await page.evaluate(openApp);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-dialogue')`, { label: '舞台恢复剧情' });
    await sleep(900);

    const stage = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="galgame"]');
            return {
                name: root.querySelector('.gg-name')?.textContent || '',
                text: root.querySelector('.gg-dialogue-text')?.textContent || '',
                scene: root.querySelector('.gg-capsule-scene')?.textContent || '',
                kbadge: root.querySelector('.gg-kbadge-main')?.textContent || '',
                menu: root.querySelectorAll('.gg-menu-btn').length,
            };
        })()
    `);
    check('刷新后剧情还在', stage.text.includes('海风'), stage.text.slice(0, 18));
    check('名牌显示说话人', stage.name === '夏海遥', stage.name);
    check('幕数正确(第 10 幕)', stage.scene === '第 10 幕', stage.scene);
    // 10 幕 → 第 4/7/10 幕各压一次 → K0 / K1 / K2,角标显示最后压出来的那个
    check('K 链角标显示到 K2', stage.kbadge === 'K2', stage.kbadge);
    check('七个菜单键都在', stage.menu === 7, String(stage.menu));

    await sleep(900);
    await page.screenshot('03-stage');

    console.log('\n── 剧情树 ───────────────────────────────');
    await page.evaluate(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-menu-btn')?.click()`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-tree-node')`, { label: '剧情树' });
    await sleep(700);

    const tree = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="galgame"]');
            const nodes = [...root.querySelectorAll('.gg-tree-node')];
            return {
                total: nodes.length,
                onPath: nodes.filter(n => n.classList.contains('is-path')).length,
                current: nodes.filter(n => n.classList.contains('is-current')).length,
                custom: nodes.filter(n => n.classList.contains('is-custom')).length,
                kBadges: root.querySelectorAll('.gg-tree-k').length,
                edges: root.querySelectorAll('.gg-tree-edge').length,
                pathEdges: root.querySelectorAll('.gg-tree-edge.is-path').length,
            };
        })()
    `);
    check('11 个节点都画出来了', tree.total === 11, String(tree.total));
    check('连线数 = 节点数 - 1', tree.edges === 10, String(tree.edges));
    check('当前线路高亮(10 个节点 / 9 条线)', tree.onPath === 10 && tree.pathEdges === 9, `${tree.onPath} 点 / ${tree.pathEdges} 线`);
    check('所在节点有独立标记', tree.current === 1, String(tree.current));
    check('自定义分支画成虚线', tree.custom === 1, String(tree.custom));
    // 角标只打在压缩发生的那一幕(第 4/7/10 幕),不是「窗口里有 K」的每一幕
    check('K 角标只出现在压缩点上(3 个)', tree.kBadges === 3, `${tree.kBadges} 个`);

    await page.screenshot('04-tree');

    // 点分支节点 → 底部详情 → 跳过去
    await page.evaluate(`
        (() => {
            const node = [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-tree-node')]
                .find(n => n.classList.contains('is-custom'));
            node?.click();
        })()
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-tree-detail')`, { label: '节点详情' });
    await sleep(400);
    const detailText = await page.evaluate(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-tree-detail-title')?.textContent.replace(/\\s+/g,' ').trim() || ''`);
    check('点节点弹出详情卡', detailText.includes('转身往回走'), detailText);
    await page.screenshot('05-tree-detail');

    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-tree-detail-actions .gg-btn')]
            .find(b => /跳到这里/.test(b.textContent))?.click()
    `);
    await sleep(1000);

    const jumped = await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="galgame"]');
            const rows = await window.myDb.getAllRecords('ggGames');
            const game = rows[rows.length - 1];
            return {
                scene: root.querySelector('.gg-capsule-scene')?.textContent || '',
                text: root.querySelector('.gg-dialogue-text')?.textContent || '',
                current: game.currentNodeId,
                nodeCount: (await window.myDb.getAllRecords('ggNodes')).length,
            };
        })()
    `);
    check('跳到分支后舞台换了内容', jumped.text.includes('巷子'), jumped.text.slice(0, 16));
    check('幕数跟着变(第 3 幕)', jumped.scene === '第 3 幕', jumped.scene);
    check('当前节点落盘了', jumped.current === 'pb0', jumped.current);
    // ★ 原型「跳转到此节点」= gameHistory.slice(0, idx),后面的剧情直接被截断扔掉
    check('★ 回到过去没有毁掉未来(11 个节点一个没少)', jumped.nodeCount === 11, String(jumped.nodeCount));

    await page.screenshot('06-jumped');

    console.log('\n── 七个面板逐个开一遍 ───────────────────');
    // ★ 这一轮很便宜但很值:vue 模板里引用一个没暴露给实例的东西
    //   (比如模块顶层 import 的常量)会**在渲染时**炸整个组件,
    //   build / lint / 静态自查一个都抓不到,只有真打开那一屏才看得见。
    const panelIds = ['tree', 'log', 'memory', 'cg', 'save', 'world', 'theme'];
    const panelLabels = ['剧情树', '回顾', '记忆', 'CG', '存档', '设定', '外观'];
    const errBefore = page.console.filter((l) => /^\[(error|exception)\]/.test(l)).length;
    for (let i = 0; i < panelIds.length; i += 1) {
        await page.evaluate(`document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-menu-btn')[${i}]?.click()`);
        await sleep(650);
        const ok = await page.evaluate(`
            (() => {
                const panel = document.querySelector('.app-shell[data-app-id="galgame"] .gg-panel');
                if (!panel) return { open: false };
                const title = panel.querySelector('.gg-panel-title')?.textContent || '';
                const body = panel.querySelector('.gg-panel-body, .gg-tree');
                return { open: true, title, filled: Boolean(body && body.children.length > 0) };
            })()
        `);
        check(`「${panelLabels[i]}」打得开且有内容`, ok.open && ok.title === panelLabels[i] && ok.filled, `${ok.title}${ok.filled ? '' : ' / 空的'}`);
        if (panelIds[i] === 'world') await page.screenshot('11-world');
        // 关掉再开下一个(菜单键是 toggle)
        await page.evaluate(`document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-menu-btn')[${i}]?.click()`);
        await sleep(250);
    }
    const errAfter = page.console.filter((l) => /^\[(error|exception)\]/.test(l)).length;
    check('★ 七个面板全渲染完没有报错', errAfter === errBefore, `新增 ${errAfter - errBefore} 条`);

    console.log('\n── K 链记忆面板 ─────────────────────────');
    await page.evaluate(`
        (() => {
            const btns = document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-menu-btn');
            btns[2]?.click();
        })()
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-kslots')`, { label: '记忆面板' });
    await sleep(800);

    const memory = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="galgame"]');
            const slots = [...root.querySelectorAll('.gg-kslot')].map(s => s.dataset.kind);
            const ctxRows = [...root.querySelectorAll('.gg-ctx-row')];
            return {
                slots,
                hint: root.querySelector('.gg-kslot-hint')?.textContent.replace(/\\s+/g,' ').trim() || '',
                ctxCount: ctxRows.length,
                ctxOff: ctxRows.filter(r => r.classList.contains('is-off')).length,
                lockedCount: ctxRows.filter(r => r.classList.contains('is-locked')).length,
            };
        })()
    `);
    check('窗口画出 4 格', memory.slots.length === 4, memory.slots.join(','));
    check('分支线上窗口是 3 个真实回合 + 1 空位', memory.slots.join(',') === 'r,r,r,empty', memory.slots.join(','));
    check('提示写清了还差几幕', /还差|再走/.test(memory.hint), memory.hint.slice(0, 30));
    check('上下文列出 12 段', memory.ctxCount === 12, String(memory.ctxCount));
    check('两段锁定段不可关', memory.lockedCount === 2, String(memory.lockedCount));

    await page.screenshot('07-memory');

    // ★ 关一段 → 立刻落盘 → 真的从 prompt 里消失(原型那个面板是纯装饰)
    const before = await page.evaluate(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-ctx-pre') ? 1 : 0`);
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-btn')]
            .find(b => /完整原文/.test(b.textContent))?.click()
    `);
    await sleep(500);
    const promptHasWorld = await page.evaluate(`(document.querySelector('.app-shell[data-app-id="galgame"] .gg-ctx-pre')?.textContent || '').includes('<世界观开始>')`);
    check('完整原文里带了世界观段', promptHasWorld, String(before));

    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-ctx-row')]
            .find(r => r.textContent.includes('世界观'))?.click()
    `);
    await sleep(700);
    const afterToggle = await page.evaluate(`
        (async () => {
            const pre = document.querySelector('.app-shell[data-app-id="galgame"] .gg-ctx-pre')?.textContent || '';
            const rows = await window.myDb.getAllRecords('ggGames');
            const game = rows[rows.length - 1];
            return { inPrompt: pre.includes('<世界观开始>'), stored: game.contextConfig?.world };
        })()
    `);
    check('★ 关掉「世界观」后它真的从 prompt 里消失了', afterToggle.inPrompt === false);
    check('★ 开关状态直接落到了 IndexedDB', afterToggle.stored === false, String(afterToggle.stored));

    console.log('\n── 换肤 ─────────────────────────────────');
    await page.evaluate(`document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-menu-btn')[6]?.click()`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-theme-card')`, { label: '外观面板' });
    await sleep(700);

    // ★ 预览卡的色值是 `readPresetColors()` 靠隐藏探针 div 从 CSS 里读出来的。
    //   `_theme.css` 只写 shell 自身的选择器时,探针匹配不上,四张卡会全部显示成
    //   当前主题 —— 不报错、只是「预览坏了」,只能靠这条断言抓。
    const previewDiff = await page.evaluate(`
        (() => {
            const cards = [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-theme-card .gg-theme-preview')];
            const bgs = cards.map(c => c.style.getPropertyValue('--gg-stage-bg').trim());
            return { count: cards.length, unique: new Set(bgs).size, bgs };
        })()
    `);
    check('★ 四张主题预览卡各显示各的配色', previewDiff.count === 4 && previewDiff.unique === 4, previewDiff.bgs.join(' / '));

    await page.screenshot('08-theme');

    await page.evaluate(`
        (() => {
            const cards = [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-theme-card')];
            cards.find(c => /夜航/.test(c.textContent))?.click();
        })()
    `);
    await sleep(300);
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-btn')]
            .find(b => b.textContent.trim() === '应用')?.click()
    `);
    await sleep(800);

    const dark = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="galgame"]');
            const cs = getComputedStyle(shell);
            return {
                attr: shell.getAttribute('data-gg-theme'),
                primary: cs.getPropertyValue('--gg-primary').trim(),
                statusBar: (window.__phoneAppsRef.value.find(a => a.id === 'galgame') || {}).statusBarColor || '',
            };
        })()
    `);
    check('切到夜航主题', dark.attr === 'night', dark.attr);
    check('主色跟着变了', dark.primary === '#5E8CD6', dark.primary);
    check('状态栏颜色也跟着变(浅色字)', dark.statusBar === '#DCE6F5', dark.statusBar);

    // 批量配色:粘一段进去,认识的套用、不认识的忽略
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-section-head')]
            .find(h => /自定义颜色/.test(h.textContent))?.click()
    `);
    await sleep(400);
    await page.evaluate(`
        (() => {
            const ta = document.querySelector('.app-shell[data-app-id="galgame"] .gg-batch .gg-textarea');
            if (!ta) return;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            setter.call(ta, '--gg-primary: #FF8800;\\n--dw-primary: #123456;\\n--gg-highlight: #00FFCC;');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        })()
    `);
    await sleep(300);
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-btn')]
            .find(b => /解析并套用/.test(b.textContent))?.click()
    `);
    await sleep(500);
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-btn')]
            .find(b => b.textContent.trim() === '应用')?.click()
    `);
    await sleep(800);

    const batch = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="galgame"]');
            const cs = getComputedStyle(shell);
            return {
                primary: cs.getPropertyValue('--gg-primary').trim(),
                highlight: cs.getPropertyValue('--gg-highlight').trim(),
                toast: shell.querySelector('.gg-toast')?.textContent || '',
            };
        })()
    `);
    check('批量配色:主色被覆盖', batch.primary === '#FF8800', batch.primary);
    check('批量配色:第二项也覆盖了', batch.highlight === '#00FFCC', batch.highlight);

    await page.screenshot('09-theme-custom');

    console.log('\n── 刷新后一切还在 ───────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: '重新注册' });
    await sleep(1500);
    await page.evaluate(openApp);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-dialogue')`, { label: '舞台恢复' });
    await sleep(900);

    const persisted = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="galgame"]');
            const cs = getComputedStyle(shell);
            return {
                theme: shell.getAttribute('data-gg-theme'),
                primary: cs.getPropertyValue('--gg-primary').trim(),
                scene: shell.querySelector('.gg-capsule-scene')?.textContent || '',
            };
        })()
    `);
    check('主题持久化了', persisted.theme === 'night', persisted.theme);
    check('自定义色也持久化了', persisted.primary === '#FF8800', persisted.primary);
    check('停在分支那一幕(第 3 幕)', persisted.scene === '第 3 幕', persisted.scene);

    await page.screenshot('10-after-reload');

    console.log('\n── 控制台 ───────────────────────────────');
    const bad = page.console.filter((line) =>
        /^\[(error|exception)\]/.test(line)
        && !/favicon|Failed to load resource/i.test(line));
    check('没有 error / 未捕获异常', bad.length === 0, bad.slice(0, 3).join(' | '));
    if (bad.length) bad.forEach((l) => console.log('    ' + l));

    const ownWarn = page.console.filter((l) => /galgame/i.test(l) && /warn/i.test(l));
    if (ownWarn.length) {
        console.log('\n  本 App 的 warning:');
        ownWarn.forEach((l) => console.log('    ' + l));
    }

    try { proc.kill(); } catch (_) { /* 已经退了 */ }
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) { /* 目录可能被占用 */ }
}

// ============================================================

async function main() {
    probeKChain();
    probeParser();

    const skipBrowser = process.argv.includes('--logic-only');
    if (!skipBrowser) await probeBrowser();

    const passed = results.filter((r) => r.ok).length;
    console.log(`\n═════ ${passed}/${results.length} 通过 ═════\n`);
    process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
    console.error('\n探针失败:', err.message);
    const passed = results.filter((r) => r.ok).length;
    console.log(`（已跑到 ${passed}/${results.length}）`);
    process.exit(1);
});
