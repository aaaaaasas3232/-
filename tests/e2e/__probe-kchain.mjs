/**
 * murmur K 链记忆 + 湛蓝回忆提示词排序 端到端冒烟
 *
 * 覆盖三件事:
 *   ① murmur 的 K 链:SDK 存取 / 数回合 / 「不够轮数不拼指令」/ 解析 [记忆:…] / 设置行显示
 *   ② 湛蓝回忆的提示词面板:段落开关 + 顺序调整真的落盘、真的改变发出去的文本
 *   ③ 梦境编织主题预览卡(在 __probe-dw.mjs 里,这里不重复)
 *
 * K 链最关键的两条是「该拼的时候拼、不该拼的时候一个字都不发」和
 * 「[记忆:…] 不能变成气泡」—— 这两条错了都不报错,只能靠断言抓。
 *
 * 用法:先 `npm run dev`,再
 *   node --experimental-loader ./__loader-alias.mjs tests/e2e/__probe-kchain.mjs
 * (ai-service 里有 `@/` 别名,Node 不认识,得挂 resolve 钩子)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { parseAiResponse } from '../../js/apps/chat-app/services/ai-service.js';
import { groupIntoRounds } from '../../js/apps/chat-app/services/context-rounds.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EDGE_CANDIDATES = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const BASE = 'http://localhost:5173';
const PORT = 9362;
const PROFILE = path.join(os.tmpdir(), `kc-probe-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok, detail });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ============================================================
// ① 纯逻辑
// ============================================================

function probeParser() {
    console.log('\n── [记忆:…] 解析 ────────────────────────');

    const raw = '嗯嗯 | 我记着呢~\n[发红包:66:生日快乐]\n[记忆:阿澈答应周六陪她去看海;她怕生,不喜欢人多的地方;上次那本书还没还。]';
    const segs = parseAiResponse(raw);
    const memory = segs.filter((s) => s.type === 'kchain_memory');
    const visible = segs.filter((s) => s.type !== 'kchain_memory');

    check('抠出了一段记忆', memory.length === 1, memory[0]?.text?.slice(0, 16) || '(没抠到)');
    check('记忆正文里的分号没被当成分隔符切断', (memory[0]?.text || '').includes('还没还'), (memory[0]?.text || '').slice(-8));
    // ★ 漏滤的话用户会看到一个装着三百字摘要的气泡,而且会被存进聊天记录
    check('记忆不在可见段里', visible.every((s) => s.type !== 'kchain_memory'));
    check('正常内容一条没少', visible.filter((s) => s.type === 'text').length === 2 && visible.some((s) => s.type === 'redpacket'),
        visible.map((s) => s.type).join(','));

    const empty = parseAiResponse('[记忆:]');
    check('空记忆当普通文本,不落一条空摘要', empty.every((s) => s.type !== 'kchain_memory'));

    console.log('\n── 回合口径 ─────────────────────────────');
    const mk = (sender, t) => ({ sender, content: 'x', timestamp: t });
    const rounds = groupIntoRounds([
        mk('user', 1), mk('ai', 2), mk('ai', 3),
        mk('user', 4), mk('ai', 5),
        mk('user', 6), mk('user', 7), mk('ai', 8),
    ]);
    check('用户→AI→AI 算 1 个回合,总共 3 个', rounds.length === 3, String(rounds.length));
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
                if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP 超时: ${method}`)); }
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
            } catch (_) { /* 可能正在导航 */ }
            await sleep(250);
        }
        const noise = this.console.filter((l) => /^\[(error|exception)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时,控制台里有这些:`);
            noise.slice(-8).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }
    async screenshot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `kc-probe-${name}.png`);
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

async function probeBrowser() {
    const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
    if (!edge) throw new Error('找不到 Edge / Chrome');

    const proc = spawn(edge, [
        '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
        '--no-first-run', '--disable-gpu', '--window-size=430,932', 'about:blank',
    ], { stdio: 'ignore' });

    let wsUrl = '';
    for (let i = 0; i < 60; i += 1) {
        try {
            wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl;
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

    console.log('\n── 启动 ─────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: 'app 注册' });
    await page.waitFor(`window.settingsSdk && window.settingsSdk.aiPersons`, { label: 'settingsSdk 就绪' });
    await sleep(1500);

    check('sdk.kChain 挂上了', await page.evaluate(`Boolean(window.settingsSdk.kChain?.getConfig)`));
    // 模块顶层就装,不等 App 被打开
    check('window.__chatKChain 已安装', await page.evaluate(`Boolean(window.__chatKChain?.getRequest)`));

    console.log('\n── K 链 SDK ─────────────────────────────');
    const sdkFlow = await page.evaluate(`
        (async () => {
            const s = window.settingsSdk;
            let ai = s.aiPersons.list()[0];
            if (!ai) ai = await s.aiPersons.create({ name: '探针AI' });
            const id = String(ai.id);

            const d0 = s.kChain.getConfig(id);
            await s.kChain.setConfig(id, { enabled: true, windowSize: 5 });
            const d1 = s.kChain.getConfig(id);

            await s.kChain.applySummary(id, 'calendar', '第一版:两人约好周六看海。', 5);
            const v1 = s.kChain.getSlot(id, 'calendar');
            await s.kChain.applySummary(id, 'calendar', '第二版:看完海之后聊到了她的画。', 5);
            const v2 = s.kChain.getSlot(id, 'calendar');
            const storySlot = s.kChain.getSlot(id, 'story');

            await s.kChain.editCurrent(id, 'calendar', '手改过的内容');
            const edited = s.kChain.getSlot(id, 'calendar');

            return {
                id,
                defaultEnabled: d0.enabled, defaultWindow: d0.windowSize,
                enabled: d1.enabled, window: d1.windowSize,
                v1Index: v1.current.index, v1Content: v1.current.content,
                v2Index: v2.current.index, historyLen: v2.history.length,
                historyTop: v2.history[0]?.content || '',
                storyEmpty: storySlot.current.content === '',
                editedIndex: edited.current.index, editedContent: edited.current.content,
            };
        })()
    `);
    check('默认是关的(不替用户做主)', sdkFlow.defaultEnabled === false && sdkFlow.defaultWindow === 5, `${sdkFlow.defaultEnabled} / ${sdkFlow.defaultWindow}`);
    check('开关和窗口能存下来', sdkFlow.enabled === true && sdkFlow.window === 5);
    check('第一版记忆 index=1', sdkFlow.v1Index === 1, String(sdkFlow.v1Index));
    check('第二版顶替第一版,旧的进 history', sdkFlow.v2Index === 2 && sdkFlow.historyLen === 1, `index=${sdkFlow.v2Index} history=${sdkFlow.historyLen}`);
    check('history 里躺的是第一版原文', sdkFlow.historyTop === '第一版:两人约好周六看海。', sdkFlow.historyTop.slice(0, 12));
    // ★ 上一版 K 链就是因为不分 mode,日历和故事的剧情互相污染
    check('★ story 槽不受 calendar 影响', sdkFlow.storyEmpty === true);
    check('手改不新增版本号', sdkFlow.editedIndex === 2 && sdkFlow.editedContent === '手改过的内容', `index=${sdkFlow.editedIndex}`);

    console.log('\n── 「不够轮数不拼指令」 ─────────────────');
    const gating = await page.evaluate(`
        (async () => {
            const s = window.settingsSdk;
            const kc = window.__chatKChain;
            const id = ${JSON.stringify(sdkFlow.id)};
            const out = {};

            // 关掉时:两段都不该有
            await s.kChain.setConfig(id, { enabled: false, windowSize: 5 });
            out.offCtx = kc.getContext(id, 'calendar');
            out.offReq = kc.getRequest(id, 'calendar', 99);

            // 开着 + 轮数不够
            await s.kChain.setConfig(id, { enabled: true, windowSize: 5 });
            out.ctx = kc.getContext(id, 'calendar');
            out.reqShort = kc.getRequest(id, 'calendar', 4);
            // 开着 + 轮数够了
            out.reqReady = kc.getRequest(id, 'calendar', 5);
            return out;
        })()
    `);
    check('关掉时当前记忆段为空', gating.offCtx === '', `"${gating.offCtx.slice(0, 12)}"`);
    check('关掉时生成指令为空(哪怕轮数够)', gating.offReq === '', `"${gating.offReq.slice(0, 12)}"`);
    check('开着时当前记忆段有内容', gating.ctx.includes('手改过的内容'), gating.ctx.slice(0, 20));
    // ★ 用户明确要求的省 token 点
    check('★ 差 1 轮时生成指令一个字都不发', gating.reqShort === '', `${gating.reqShort.length} 字`);
    check('★ 攒够时才拼生成指令', gating.reqReady.includes('[记忆:'), `${gating.reqReady.length} 字`);
    check('生成指令里带上了旧记忆(合并重写,不是追加)', gating.reqReady.includes('手改过的内容'));

    console.log('\n── 按 lastAt 现算回合 ───────────────────');
    const counting = await page.evaluate(`
        (async () => {
            const s = window.settingsSdk;
            const kc = window.__chatKChain;
            const id = ${JSON.stringify(sdkFlow.id)};
            const user = s.defaultUserCard?.getDefault?.() || s.users.getActive() || s.users.list()[0];
            const lastAt = s.kChain.getSlot(id, 'calendar').lastAt;

            // 造 3 个回合(用户→AI ×3),全部落在 lastAt 之后
            const base = lastAt + 1000;
            for (let i = 0; i < 3; i += 1) {
                await s.chatMessages.add(user, id, 'calendar', {
                    id: 'probe_u_' + i, sender: 'user', type: 'text', content: '探针 ' + i, timestamp: base + i * 100,
                });
                await s.chatMessages.add(user, id, 'calendar', {
                    id: 'probe_a_' + i, sender: 'ai', type: 'text', content: '收到 ' + i, timestamp: base + i * 100 + 10,
                });
            }
            const after3 = kc.countPending(id, 'calendar');
            const should3 = kc.shouldRequest(id, 'calendar');

            // ★ 真实链路传的是「这一轮最后一条消息的时间戳 + 1」,不是 Date.now()。
            //   传 Date.now() 的话(旧写法)这三个回合会落在 lastAt 之后,
            //   刚压进去的内容下一轮又被数一遍。
            const newest = base + 2 * 100 + 10;
            await s.kChain.applySummary(id, 'calendar', '压过之后的记忆', after3, newest + 1);
            const afterReset = kc.countPending(id, 'calendar');

            // 用旧写法(不传 lastAt)复现那个 off-by-one,证明这条断言真的在守着东西
            await s.chatMessages.add(user, id, 'calendar', {
                id: 'probe_tail', sender: 'ai', type: 'text', content: '尾巴', timestamp: newest + 5000,
            });
            const naive = kc.countPending(id, 'calendar');

            return { after3, should3, afterReset, naive };
        })()
    `);
    check('数出 3 个回合', counting.after3 === 3, String(counting.after3));
    check('3 < 5,还不该要摘要', counting.should3 === false);
    // ★ 不维护计数器,按 lastAt 现算 —— 删消息/重 roll 之后不会永远错下去
    check('★ 压缩之后计数归零(lastAt 盖过了本轮消息)', counting.afterReset === 0, String(counting.afterReset));
    check('压缩之后新来的消息正常计数', counting.naive === 1, String(counting.naive));

    console.log('\n── 聊天设置页的 K 链行 ──────────────────');
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'chat' } }))`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"]')`, { label: 'chat 打开' });
    await sleep(1200);
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'detail', appId: 'chat', pageId: 'chat-settings-' + ${JSON.stringify(sdkFlow.id)} }
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"] #set-kchain')`, { label: 'K 链设置行' });
    await sleep(600);

    const row = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="chat"]');
            const k = root.querySelector('#set-kchain');
            const ctx = root.querySelector('#set-context-length');
            return {
                text: k?.querySelector('.chat-setting-value')?.textContent.replace(/\\s+/g,' ').trim() || '',
                // 用户要求:就在「上下文长度」那一行的下面
                rightBelow: ctx?.nextElementSibling === k,
            };
        })()
    `);
    check('★ K 链行就在「上下文长度」下面', row.rightBelow, row.rightBelow ? '' : '位置不对');
    check('行上显示版本 + 还差几轮', /第 \d+ 版/.test(row.text), row.text);

    await page.screenshot('01-settings-row');

    await page.evaluate(`document.querySelector('.app-shell[data-app-id="chat"] #set-kchain')?.click()`);
    await page.waitFor(`document.querySelector('.kchain-modal')`, { label: 'K 链弹窗' });
    await sleep(700);
    const modal = await page.evaluate(`
        (() => {
            const m = document.querySelector('.kchain-modal');
            return {
                title: m?.querySelector('.ac-modal-title')?.textContent.trim() || '',
                unit: m?.querySelector('.ctx-length-unit')?.textContent.trim() || '',
                value: m?.querySelector('.ctx-length-input')?.value || '',
                content: m?.querySelector('.kchain-textarea')?.value || '',
                hint: m?.querySelector('.ctx-length-hint')?.textContent.replace(/\\s+/g,' ').trim() || '',
            };
        })()
    `);
    check('弹窗打开', modal.title === 'K 链记忆', modal.title);
    check('窗口长度按回合设置', modal.unit === '回合' && modal.value === '5', `${modal.value} ${modal.unit}`);
    check('当前记忆正文可见可改', modal.content === '压过之后的记忆', modal.content);
    check('进度提示写清了还差几轮', /还差|攒够/.test(modal.hint), modal.hint.slice(0, 34));

    await page.screenshot('02-kchain-modal');

    console.log('\n── 湛蓝回忆:提示词顺序 ─────────────────');
    // 新建一局要从 nook 挑世界观 —— 干净 profile 里可能一个都没有
    await page.evaluate(`
        (async () => {
            const s = window.settingsSdk;
            let world = s.worlds.getActive?.() || s.worlds.list()[0];
            if (!world) world = await s.worlds.create({ name: '探针世界' });
            return String(world.id);
        })()
    `);
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'galgame' } }))`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-root')`, { label: 'galgame 打开' });
    await sleep(1000);

    // 建一局(提示词面板要有 game 才有内容)
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-launcher .gg-btn')]
            .find(b => /新建一局/.test(b.textContent))?.click()
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-pick-item')`, { label: '新建弹窗' });
    await sleep(400);
    await page.evaluate(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-pick-item')?.click()`);
    await sleep(200);
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .ac-modal-footer .ac-btn')]
            .find(b => b.textContent.trim() === '开始')?.click()
    `);
    await sleep(1200);

    // 提示词是第 3 个菜单键
    await page.evaluate(`document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-menu-btn')[2]?.click()`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="galgame"] .gg-ord-row')`, { label: '提示词面板' });
    await sleep(700);

    const ord = await page.evaluate(`
        (() => {
            const rows = [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-ord-row')];
            return {
                count: rows.length,
                first: rows[0]?.dataset.sectionId,
                second: rows[1]?.dataset.sectionId,
                hasHandle: rows.every(r => r.querySelector('.gg-ord-handle')),
                hasUpDown: rows.every(r => r.querySelectorAll('.gg-ord-mini').length === 3),
            };
        })()
    `);
    check('12 段全列出来了', ord.count === 12, String(ord.count));
    check('每行都有拖拽把手', ord.hasHandle);
    check('每行都有上移/下移/开关', ord.hasUpDown);
    check('默认第一段是编剧须知', ord.first === 'system', ord.first);

    await page.screenshot('03-prompt-order');

    // 把第 2 段往上挪 → 落盘 → 发出去的文本顺序真的变
    const before = await page.evaluate(`
        (() => {
            const pre = document.querySelector('.app-shell[data-app-id="galgame"] .gg-ctx-pre');
            return { hasPre: Boolean(pre) };
        })()
    `);
    await page.evaluate(`
        (() => {
            const rows = [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-ord-row')];
            rows[1]?.querySelectorAll('.gg-ord-mini')[0]?.click();   // 上移
        })()
    `);
    await sleep(800);

    const moved = await page.evaluate(`
        (async () => {
            const rows = [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-ord-row')];
            const games = await window.myDb.getAllRecords('ggGames');
            const game = games[games.length - 1];
            return {
                first: rows[0]?.dataset.sectionId,
                second: rows[1]?.dataset.sectionId,
                stored: (game.contextOrder || []).slice(0, 2),
            };
        })()
    `);
    check('★ 上移真的换了位置', moved.first === 'world' && moved.second === 'system', `${moved.first} / ${moved.second}`);
    // ★ 第一版做了 contextOrder 字段但没有任何 UI 会写它 —— 读了没人写的字段
    check('★ 顺序直接落到了 IndexedDB', moved.stored[0] === 'world' && moved.stored[1] === 'system', moved.stored.join(','));

    // 顺序要真的改变发出去的文本
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-btn')]
            .find(b => /看完整原文/.test(b.textContent))?.click()
    `);
    await sleep(600);
    const promptOrder = await page.evaluate(`
        (() => {
            const text = document.querySelector('.app-shell[data-app-id="galgame"] .gg-ctx-pre')?.textContent || '';
            return {
                worldAt: text.indexOf('<世界观开始>'),
                systemAt: text.indexOf('<编剧须知开始>'),
                len: text.length,
            };
        })()
    `);
    check('★ 发出去的文本顺序跟着变了',
        promptOrder.worldAt >= 0 && promptOrder.systemAt > promptOrder.worldAt,
        `世界观@${promptOrder.worldAt} 编剧须知@${promptOrder.systemAt}`);

    // 恢复默认
    await page.evaluate(`
        [...document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-btn')]
            .find(b => /恢复默认顺序/.test(b.textContent))?.click()
    `);
    await sleep(700);
    const restored = await page.evaluate(`
        document.querySelectorAll('.app-shell[data-app-id="galgame"] .gg-ord-row')[0]?.dataset.sectionId || ''
    `);
    check('恢复默认顺序生效', restored === 'system', restored);

    await page.screenshot('04-prompt-after');

    console.log('\n── 控制台 ───────────────────────────────');
    const bad = page.console.filter((l) => /^\[(error|exception)\]/.test(l) && !/favicon|Failed to load resource/i.test(l));
    check('没有 error / 未捕获异常', bad.length === 0, bad.slice(0, 3).join(' | '));
    if (bad.length) bad.forEach((l) => console.log('    ' + l));

    try { proc.kill(); } catch (_) { /* 已经退了 */ }
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) { /* 可能被占用 */ }
}

async function main() {
    probeParser();
    if (!process.argv.includes('--logic-only')) await probeBrowser();
    const passed = results.filter((r) => r.ok).length;
    console.log(`\n═════ ${passed}/${results.length} 通过 ═════\n`);
    process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
    console.error('\n探针失败:', err.message);
    console.log(`（已跑到 ${results.filter((r) => r.ok).length}/${results.length}）`);
    process.exit(1);
});
