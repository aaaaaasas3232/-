/**
 * 人设机 · 浏览器冒烟（真实 Edge，走 CDP）
 *
 * 只查**静态检查抓不到**的那几类：
 *
 *   1. 控制台没有 error / exception —— 新 App 任何一处 import 挂掉都是整个页面白屏。
 *   2. **CSS 真的加载了** —— `index.html` 忘加 link 或 `?v=` 没 bump，
 *      表现都是「代码改了页面纹丝不动」，只有断言 computed style 能抓到。
 *   3. **主题 token 真的生效** —— JS 里定义了变量 ≠ 页面上换得动。
 *   4. **★ 覆盖保存真的覆盖** —— 这是用户点名要的行为。拉一张 nook 的卡、改一行、
 *      存回去，断言 **nook 里还是那一条记录**（id 没变、总数没变）且字段真的更新了。
 *      这条完全无法静态验证，错了的后果是人设库里堆出一串同名卡。
 *   5. **★ 正文 ⇄ 人设卡 的投影是可逆的** —— `cardToText` → `textToCardPatch`
 *      来回一趟不能丢字段。丢了不会报错，只会让用户存完发现少了点东西。
 *   6. **★ 建议解析不伪造** —— 喂一段不符合格式的回复，必须返回 unparsed 且
 *      suggestion 为 null。原型在这里会凭空造一条 diff。
 *   7. **★ 行号对不上时不硬写** —— 这是「静默改错行」的唯一防线。
 *   8. 没有被撑爆的 SVG（不带 width/height 的内联图标会被画成 300×150）。
 *
 * ★ 不测 AI 生成 —— 那要真的烧 token，而且结果不可复现。
 *   生成链路的正确性靠 prompt-builder / card-schema / suggestion 都是纯函数来保证，
 *   而这三个纯函数在下面是真的跑了的。
 *
 * ★ 5/6/7 通过 `import()` 拉纯函数模块来测。
 *   平时禁止从外面 import App 内部模块（dev server 的 `?t=` 会给另一个实例），
 *   但这三个模块**无状态**，第二个实例和页面上那一份行为完全一致。
 *   涉及状态的（store / nook 写入）一律走真实 UI。
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-persona-lab.mjs`
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const BASE = 'http://localhost:5173';
const PORT = 9381;
const PROFILE = path.join(os.tmpdir(), `pl-probe-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
                const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
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
            }, 45000);
        });
    }

    async evaluate(expression) {
        const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
            throw new Error('页面内报错: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
        }
        return res.result.value;
    }

    async waitFor(expr, { timeout = 25000, label = expr } = {}) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            try {
                if (await this.evaluate(`(() => { try { return !!(${expr}); } catch (_) { return false; } })()`)) return true;
            } catch (_) { /* 可能正在导航 */ }
            await sleep(250);
        }
        const noise = this.console.filter((l) => /^\[(error|exception)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时，控制台里有：`);
            noise.slice(-10).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }

    async shot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `pl-probe-${name}.png`);
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

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** 在 nook 里造一张字段齐全的 AI 人设卡 */
const SEED = `
(async () => {
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };

    const card = await sdk.aiPersons.create({
        name: '林栖',
        gender: '女',
        age: '23',
        appearance: '偏瘦，总穿深色，头发随便扎着',
        personality: '安静',
        currentOccupation: '旧书店店员',
        bio: '一个把话咽回去的人',
        experience: '在江南一个开旧书店的家庭长大。\\n十六岁那年书店被拆。',
        preferences: { enabled: true, injectMode: 'none', hobbies: ['抄书', '夜里骑车'], likes: ['雨天'], dislikes: [], allergies: [] },
        memory: { enabled: true, injectMode: 'none', text: '书店拆掉那天下了很大的雨' },
        mbti: { enabled: true, injectMode: 'none', type: 'INFP', description: '' },
    });

    let user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
    if (!user) user = await sdk.users.create({ name: '阿听' });
    if (sdk.defaultUserCard?.setDefault) await sdk.defaultUserCard.setDefault(user.id);

    return { ok: true, cardId: card.id, aiCount: sdk.aiPersons.list().length };
})()
`;

/** 纯函数三连：正文投影可逆 / 建议解析不伪造 / 行号对不上不硬写 */
const PURE_TESTS = `
(async () => {
    const schema = await import('/js/apps/persona-lab/services/card-schema.js');
    const sug = await import('/js/apps/persona-lab/services/suggestion.js');
    const out = {};

    // 1) 人设卡 → 正文 → patch，字段不能丢
    const card = window.settingsSdk.aiPersons.get(window.__plSeedId);
    const text = schema.cardToText(card);
    const patch = schema.textToCardPatch(text);
    out.roundTrip = {
        name: patch.name,
        gender: patch.gender,
        age: patch.age,
        personality: patch.personality,
        occupation: patch.currentOccupation,
        experienceLines: String(patch.experience || '').split('\\n').length,
        hobbies: patch.preferences?.hobbies || [],
        memory: patch.memory?.text || '',
        mbti: patch.mbti?.type || '',
        // 有内容的模块要顺手打开开关，否则人设编辑器里那一组是折叠的、prompt 也不注入
        memoryEnabled: patch.memory?.enabled === true,
        prefEnabled: patch.preferences?.enabled === true,
    };

    // 2) 不按格式回复 → 必须 unparsed 且不产出任何 suggestion
    const junk = sug.parseAdvisorReply('我觉得这个人设的性格写得太笼统了，可以再具体一点。');
    out.junk = { verdict: junk.verdict, hasSuggestion: !!junk.suggestion, note: junk.note.slice(0, 12) };

    // 3) 按格式回复 → 解析 + 应用
    const good = sug.parseAdvisorReply([
        '性格那一行太笼统了。',
        '<<<改',
        '行=5',
        '原=性格：安静',
        '新=性格：安静，但被问到在意的事会突然话多',
        '因=她在第 2 轮主动追问了对方的近况',
        '>>>',
    ].join('\\n'));
    out.good = { verdict: good.verdict, kind: good.suggestion?.kind, line: good.suggestion?.lineNumber };

    const lines = text.split('\\n');
    const applied = sug.applySuggestion(text, good.suggestion);
    out.apply = {
        ok: applied.ok,
        // 第 5 行(1-based)确实是「性格：安静」时才该命中
        changed: applied.ok && applied.text.split('\\n')[applied.hitLine - 1].includes('突然话多'),
        lineCountSame: applied.ok && applied.text.split('\\n').length === lines.length,
    };

    // 4) 行号对不上 + 原文也找不到 → 必须报错，不能硬写
    const bogus = sug.parseAdvisorReply([
        '<<<改', '行=99', '原=这一行根本不存在', '新=乱写', '因=测试', '>>>',
    ].join('\\n'));
    const bad = sug.applySuggestion(text, bogus.suggestion);
    out.bogus = { ok: bad.ok, sameText: bad.text === text, hasError: !!bad.error };

    // 5) 行号错了但原文对得上 → 顺着找回来，并标 shifted
    const shifted = sug.parseAdvisorReply([
        '<<<改', '行=1', '原=性格：安静', '新=性格：安静得过分', '因=测试', '>>>',
    ].join('\\n'));
    const sh = sug.applySuggestion(text, shifted.suggestion);
    out.shifted = { ok: sh.ok, shifted: sh.shifted === true, hit: sh.hitLine };

    // 6) 插入
    const ins = sug.parseAdvisorReply(['<<<加', '行后=0', '新=口头禅：那就这样吧', '因=测试', '>>>'].join('\\n'));
    const insRes = sug.applySuggestion(text, ins.suggestion);
    out.insert = {
        ok: insRes.ok,
        first: insRes.ok ? insRes.text.split('\\n')[0] : '',
        grew: insRes.ok && insRes.text.split('\\n').length === lines.length + 1,
    };

    // 7) 表里没有的键不能被丢掉（原型会丢）
    const custom = schema.textToCardPatch('姓名：测试\\n角色介绍：底子\\n口头禅：随便吧');
    out.keepUnknown = String(custom.experience || '').includes('口头禅：随便吧');

    return out;
})()
`;

async function main() {
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    if (!exe) throw new Error('找不到 Edge / Chrome');

    const proc = spawn(exe, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${PROFILE}`,
        '--no-first-run', '--disable-gpu', '--window-size=430,932',
        'about:blank',
    ], { stdio: 'ignore' });

    let wsUrl = '';
    for (let i = 0; i < 60; i++) {
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

    const click = async (selector, label = selector) => {
        const ok = await page.evaluate(`
            (() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()
        `);
        if (!ok) throw new Error(`点不到：${label}`);
        await sleep(500);
    };

    /** 按文字找元素点 —— 列表是按 updatedAt 排的，位置不稳定 */
    const clickByText = async (selector, text, label = text) => {
        const ok = await page.evaluate(`
            (() => {
                const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
                    .find(e => e.textContent.includes(${JSON.stringify(text)}));
                if (!el) return false;
                el.click();
                return true;
            })()
        `);
        if (!ok) throw new Error(`点不到：${label}`);
        await sleep(500);
    };

    try {
        console.log('\n── 启动 ─────────────────────────────────');
        await page.send('Page.navigate', { url: BASE });
        await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: 'app 注册' });
        await sleep(2200);

        check('人设机已注册', await page.evaluate(`(window.__phoneAppsRef.value || []).some(a => a.id === 'persona-lab')`));

        // ★ 桌面图标在 .app-shell 外面,拿不到 --pl-*,`currentColor` 会继承桌面的浅色文字。
        //   浅色描边画在近白的 iconBg 上等于隐形 —— 这条只有实测能抓到。
        const deskIcon = await page.evaluate(`
            (() => {
                const tile = document.querySelector('[data-app-id="persona-lab"] .appIcon');
                if (!tile) return null;
                const svg = tile.querySelector('svg');
                const r = tile.getBoundingClientRect();
                return { stroke: svg?.getAttribute('stroke') || '', w: Math.round(r.width), bg: getComputedStyle(tile).backgroundImage.slice(0, 20) };
            })()
        `);
        check('桌面上有图标且描边不是 currentColor（近白底上不会隐形）',
            !!deskIcon && deskIcon.stroke !== '' && deskIcon.stroke !== 'currentColor' && deskIcon.w > 40,
            deskIcon ? `stroke=${deskIcon.stroke} ${deskIcon.w}px` : '(找不到图标)');
        await page.shot('00-desktop');
        check('声明了 plDrafts 表',
            await page.evaluate(`(window.__phoneAppsRef.value.find(a => a.id === 'persona-lab')?.stores || []).some(s => s.name === 'plDrafts')`));

        console.log('\n── 造 nook 人设卡 ───────────────────────');
        const seed = await page.evaluate(SEED);
        if (!seed?.ok) throw new Error('种子数据失败：' + (seed?.error || '未知'));
        await page.evaluate(`window.__plSeedId = ${JSON.stringify(seed.cardId)}`);
        console.log(`  cardId=${seed.cardId}，nook 里现在有 ${seed.aiCount} 张 AI 卡`);

        console.log('\n── 纯函数：投影 / 建议解析 ──────────────');
        const pure = await page.evaluate(PURE_TESTS);
        const rt = pure.roundTrip;
        check('正文投影回人设卡不丢字段',
            rt.name === '林栖' && rt.gender === '女' && rt.age === '23'
            && rt.personality === '安静' && rt.occupation === '旧书店店员'
            && rt.experienceLines === 2 && rt.mbti === 'INFP',
            JSON.stringify({ name: rt.name, exp: rt.experienceLines, mbti: rt.mbti }));
        check('列表字段一行一条地还原', rt.hobbies.join('/') === '抄书/夜里骑车', rt.hobbies.join('/'));
        check('有内容的模块开关被打开', rt.memoryEnabled && rt.prefEnabled);
        check('字段表里没有的键不会被丢掉', pure.keepUnknown === true);

        check('不按格式的回复 → 不产出建议（不伪造）',
            pure.junk.verdict === 'unparsed' && pure.junk.hasSuggestion === false,
            `verdict=${pure.junk.verdict}`);
        check('按格式的回复 → 解析出「改第 N 行」',
            pure.good.verdict === 'ok' && pure.good.kind === 'modify' && pure.good.line === 5,
            `line=${pure.good.line}`);
        check('采用后正文真的改了、行数不变',
            pure.apply.ok && pure.apply.changed && pure.apply.lineCountSame);
        check('行号 + 原文都对不上 → 拒绝写入',
            pure.bogus.ok === false && pure.bogus.sameText && pure.bogus.hasError);
        check('行号错但原文对 → 顺着找回来并标记',
            pure.shifted.ok && pure.shifted.shifted, `hit=${pure.shifted.hit}`);
        check('插入建议加在最前面、行数 +1',
            pure.insert.ok && pure.insert.grew && pure.insert.first.includes('口头禅'),
            pure.insert.first);

        console.log('\n── 打开人设机 ───────────────────────────');
        await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'persona-lab' } }))`);
        await page.waitFor(`document.querySelector('.app-shell[data-app-id="persona-lab"] .pl-root')`, { label: '根组件挂载' });
        await sleep(1500);

        const css = await page.evaluate(`
            (() => {
                const shell = document.querySelector('.app-shell[data-app-id="persona-lab"]');
                const cs = getComputedStyle(shell);
                const h1 = shell.querySelector('.pl-lib-hero h1');
                const hero = shell.querySelector('.pl-lib-hero');
                const svgs = [...shell.querySelectorAll('svg')].map(s => s.getBoundingClientRect().width);
                return {
                    primary: cs.getPropertyValue('--pl-primary').trim(),
                    bg: cs.getPropertyValue('--pl-bg').trim(),
                    h1Size: h1 ? getComputedStyle(h1).fontSize : '',
                    heroPadTop: hero ? getComputedStyle(hero).paddingTop : '',
                    maxSvg: svgs.length ? Math.max(...svgs) : 0,
                    svgCount: svgs.length,
                };
            })()
        `);
        check('主题 token 生效（--pl-primary）', /^#E17C99$/i.test(css.primary), css.primary || '(空)');
        check('样式表真的加载了（不是吃的缓存）', css.h1Size === '24px', `h1 font-size=${css.h1Size}`);
        check('自绘头部让开了状态栏那 54px', parseFloat(css.heroPadTop) >= 60, css.heroPadTop);
        check(`SVG 没被撑爆（${css.svgCount} 个，最宽 ${Math.round(css.maxSvg)}px）`, css.maxSvg > 0 && css.maxSvg <= 40);

        const libText = await page.evaluate(`document.querySelector('.app-shell[data-app-id="persona-lab"] .pl-library')?.textContent || ''`);
        check('人设库列出了 nook 的卡', libText.includes('林栖'));
        check('默认用户卡标出来了', libText.includes('默认「我」'));

        await page.shot('01-library');

        console.log('\n── 拉卡进来 ─────────────────────────────');
        // ★ 按名字点,不按位置 —— nook 列表按 updatedAt 倒序,
        //   `setDefault` 会把默认用户卡顶到最前面,位置选择器会点错卡
        await clickByText(
            '.app-shell[data-app-id="persona-lab"] .pl-card-main',
            '林栖',
            'nook 里的「林栖」',
        );
        await page.waitFor(`document.querySelector('.app-shell[data-app-id="persona-lab"] .pl-wb')`, { label: '工作台' });
        await sleep(600);

        const wbTitle = await page.evaluate(`document.querySelector('.pl-wb-title h1')?.textContent || ''`);
        check('拉进来后进了工作台，标题是卡名', wbTitle.trim() === '林栖', wbTitle.trim());
        check('默认停在「提问」页', await page.evaluate(`!!document.querySelector('.pl-ask')`));

        await page.shot('02-workbench-ask');

        console.log('\n── 上下文抽屉：预览 == 发送 ─────────────');
        await click('.app-shell[data-app-id="persona-lab"] .pl-wb-ctx', '上下文按钮');
        await page.waitFor(`document.querySelector('.pl-ctx-list')`, { label: '上下文抽屉' });
        const ctx = await page.evaluate(`
            (() => {
                const items = [...document.querySelectorAll('.pl-ctx-item')];
                const persona = items.find(i => (i.querySelector('.pl-ctx-name')?.textContent || '').includes('人设正文'));
                const locked = [...document.querySelectorAll('.pl-ctx-item .pl-tag')].length;
                const sub = document.querySelector('.pl-sheet-titles p')?.textContent || '';
                return { count: items.length, personaBody: persona?.querySelector('.pl-ctx-body')?.textContent || '', locked, sub };
            })()
        `);
        check('上下文按段列出来了', ctx.count >= 5, `${ctx.count} 段`);
        check('「人设正文」那一段带的是真实人设', ctx.personaBody.includes('旧书店店员'));
        check('必带段不给关（没有开关，只有「必带」标）', ctx.locked >= 3, `${ctx.locked} 个必带`);
        check('抽屉标题给出了 token 估算', /token/.test(ctx.sub), ctx.sub);
        await page.shot('03-context');
        await click('.app-shell[data-app-id="persona-lab"] .pl-sheet-close', '关闭抽屉');

        console.log('\n── 档案页 + 覆盖保存 ────────────────────');
        await click(
            '.app-shell[data-app-id="persona-lab"] .pl-wb-tabs .pl-segmented-item:nth-child(3)',
            '档案 tab',
        );
        await page.waitFor(`document.querySelector('.pl-card-panel')`, { label: '档案页' });
        await sleep(400);

        const patchView = await page.evaluate(`document.querySelector('.pl-card-panel')?.textContent || ''`);
        check('档案页显示了落库预览', patchView.includes('会存成什么') && patchView.includes('旧书店店员'));
        check('归属显示为「覆盖原卡」', patchView.includes('覆盖 nook 里的这张卡'));

        // 改一行：把「性格：安静」换掉，并加一条新爱好
        const edited = await page.evaluate(`
            (() => {
                const ta = document.querySelector('.pl-card-panel .pl-code-input');
                if (!ta) return false;
                const next = ta.value
                    .replace('性格：安静', '性格：安静，被问到在意的事会突然话多')
                    + '\\n爱好：给旧书补页';
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                setter.call(ta, next);
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            })()
        `);
        check('正文可编辑', edited === true);
        await sleep(500);

        const dirty = await page.evaluate(`document.querySelector('.pl-save-state')?.textContent?.includes('有改动还没存') === true`);
        check('改完后提示「有改动还没存进 nook」', dirty);

        const before = await page.evaluate(`
            (() => {
                const list = window.settingsSdk.aiPersons.list();
                const card = window.settingsSdk.aiPersons.get(window.__plSeedId);
                return { total: list.length, personality: card.personality, hobbies: (card.preferences?.hobbies || []).slice() };
            })()
        `);

        await click('.app-shell[data-app-id="persona-lab"] .pl-save-block .pl-btn', '保存按钮');
        await page.waitFor(`document.querySelector('.pl-modal .ac-modal-footer')`, { label: '确认弹窗' });
        const modalText = await page.evaluate(`document.querySelector('.pl-modal .ac-modal-title')?.textContent || ''`);
        check('保存前弹确认，措辞是「覆盖」', modalText.includes('覆盖'), modalText);
        await page.shot('04-save-confirm');

        await click('.app-shell[data-app-id="persona-lab"] .pl-modal .ac-modal-footer .pl-btn[data-variant="primary"]', '确认覆盖');
        await sleep(1400);

        const after = await page.evaluate(`
            (() => {
                const list = window.settingsSdk.aiPersons.list();
                const card = window.settingsSdk.aiPersons.get(window.__plSeedId);
                return {
                    total: list.length,
                    personality: card.personality,
                    hobbies: (card.preferences?.hobbies || []).slice(),
                    // 正文里没写的字段不能被清掉
                    bio: card.bio,
                    memory: card.memory?.text || '',
                };
            })()
        `);

        check('★ 覆盖而不是新建（nook 里卡的总数没变）',
            after.total === before.total, `${before.total} → ${after.total}`);
        check('★ 原卡字段真的更新了',
            after.personality.includes('突然话多'), after.personality);
        check('★ 新增的列表项写进去了',
            after.hobbies.includes('给旧书补页'), after.hobbies.join('/'));
        check('正文里没动的字段保持原样', after.bio === '一个把话咽回去的人' && after.memory.includes('很大的雨'));

        const synced = await page.evaluate(`document.querySelector('.pl-save-state')?.textContent?.includes('已同步') === true`);
        check('保存后状态变成「已同步」', synced);
        await page.shot('05-after-save');

        console.log('\n── 回到库页 ─────────────────────────────');
        await click('.app-shell[data-app-id="persona-lab"] .pl-wb-back', '返回');
        await sleep(700);
        const libAfter = await page.evaluate(`document.querySelector('.pl-library')?.textContent || ''`);
        check('「在改的」里出现了这份草稿', libAfter.includes('已同步'));
        check('nook 段里那张卡标成「已在草稿里」', libAfter.includes('已在草稿里'));

        console.log('\n── 题库 ─────────────────────────────────');
        await clickByText('.app-shell[data-app-id="persona-lab"] .pl-card-main', '林栖', '草稿卡片');
        await page.waitFor(`document.querySelector('.pl-ask')`, { label: '提问页' });
        await click('.app-shell[data-app-id="persona-lab"] .pl-composer-quiz', '题库按钮');
        await page.waitFor(`document.querySelector('.pl-quiz-sets')`, { label: '题库抽屉' });
        const sets = await page.evaluate(`[...document.querySelectorAll('.pl-quiz-set-name')].map(e => e.textContent.trim())`);
        check('题库有 6 套', sets.length === 6, sets.join(' / '));
        await click('.app-shell[data-app-id="persona-lab"] .pl-quiz-set', '第一套题');
        await sleep(600);
        const strip = await page.evaluate(`
            (() => {
                const el = document.querySelector('.pl-quiz-strip');
                if (!el) return null;
                return {
                    q: el.querySelector('.pl-quiz-q')?.textContent || '',
                    opts: [...el.querySelectorAll('.pl-quiz-opt')].length,
                    count: el.querySelector('.pl-quiz-count')?.textContent || '',
                };
            })()
        `);
        check('输入框上方出现当前测题', !!strip && strip.q.length > 4, strip?.q || '(无)');
        check('选项渲染出来了', (strip?.opts || 0) >= 2, `${strip?.opts} 个`);
        check('进度是 1 / 16', (strip?.count || '').replace(/\s/g, '') === '1/16', strip?.count);

        // 点一个选项应该填进输入框（而不是直接发出去）
        await click('.app-shell[data-app-id="persona-lab"] .pl-quiz-opt', '第一个选项');
        const composerVal = await page.evaluate(`document.querySelector('.pl-composer .pl-textarea')?.value || ''`);
        check('点选项 = 填进输入框，不直接发送', composerVal.length > 0, composerVal.slice(0, 14));
        await page.shot('06-quiz');

        console.log('\n── 擂台题 ───────────────────────────────');
        await click('.app-shell[data-app-id="persona-lab"] .pl-composer-quiz', '题库按钮');
        await page.waitFor(`document.querySelector('.pl-quiz-sets')`, { label: '题库抽屉' });
        await click('.app-shell[data-app-id="persona-lab"] .pl-quiz-sets li:nth-child(6) .pl-quiz-set', '动物直觉');
        await sleep(600);
        const ladder = await page.evaluate(`
            (() => {
                const el = document.querySelector('.pl-quiz-strip');
                return el ? [...el.querySelectorAll('.pl-quiz-opt')].map(o => o.textContent.trim()) : [];
            })()
        `);
        check('擂台题第一轮是池子前两个', ladder.join('/') === '狗/猫', ladder.join('/'));

        console.log('\n── 导入转换 ─────────────────────────────');
        await click('.app-shell[data-app-id="persona-lab"] .pl-wb-back', '返回库页');
        await sleep(600);
        await click('.app-shell[data-app-id="persona-lab"] .pl-tabbar-item:nth-child(2)', '导入 tab');
        await page.waitFor(`document.querySelector('.pl-import')`, { label: '导入页' });
        await click('.app-shell[data-app-id="persona-lab"] .pl-import .pl-btn[data-size="sm"]', '示例');
        await sleep(400);
        const importText = await page.evaluate(`document.querySelector('.pl-import .pl-code-input')?.value || ''`);
        check('示例填进去了', importText.includes('Lin Qi'));
        const apiLine = await page.evaluate(`document.querySelector('.pl-import .pl-api-line')?.textContent || ''`);
        check('导入页显示了会用哪个 API（不让用户填 Key）',
            apiLine.includes('未绑定 API') || apiLine.includes('人设'), apiLine.replace(/\s+/g, ' ').trim());
        await page.shot('07-import');

        console.log('\n── 控制台 ───────────────────────────────');
        const errors = page.console.filter((l) => /^\[(error|exception)\]/.test(l))
            // 没配 API 时的网络失败是预期内的，不算 App 的错
            .filter((l) => !/Failed to load resource|net::ERR|favicon/i.test(l));
        check('控制台没有 error / exception', errors.length === 0, errors.slice(0, 3).join(' | '));

        console.log('\n── 结果 ─────────────────────────────────');
        const bad = results.filter((r) => !r.ok);
        console.log(`  ${results.length - bad.length} / ${results.length} 通过`);
        if (bad.length) {
            bad.forEach((r) => console.log(`  ✗ ${r.label}`));
            process.exitCode = 1;
        }
        console.log('  截图：pl-probe-*.png');
    } catch (err) {
        console.error('\n  探针失败：', err.message);
        page.console.filter((l) => /^\[(error|exception)\]/.test(l)).slice(-10).forEach((l) => console.log('    ' + l));
        try { await page.shot('fail'); } catch (_) { /* 页面可能已经没了 */ }
        process.exitCode = 1;
    } finally {
        try { proc.kill(); } catch (_) { /* 已经退了 */ }
        await sleep(300);
        try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) { /* 占用中,下次开机自己清 */ }
    }
}

main();
