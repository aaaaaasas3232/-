/**
 * 日记 端到端冒烟（真实浏览器，走 CDP）
 *
 * 为什么必须真跑浏览器：本项目历史上的恶性 bug 有个共同特征 ——
 * build 和 lint 全绿，只在浏览器里才炸（vue 模式 hydrate 没人调、
 * Proxy 写不进 IndexedDB、SVG 撑爆布局、按钮点了没反应）。静态检查一个都抓不到。
 *
 * 覆盖：
 *   注册 / 建表 → 配置向导五步 → 写日记 → 时段外变便利贴 → 经期三态打卡
 *   → 纪念日倒计时 → 主题切换 → 日记本列表 → 上下文预览 → prompt 注入 → 刷新后数据还在
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-diary.mjs`
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EDGE_CANDIDATES = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const BASE = 'http://localhost:5173';
const PORT = 9351;
const PROFILE = path.join(os.tmpdir(), `diary-probe-${Date.now()}`);
const SHELL = '.app-shell[data-app-id="diary"]';

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
        // 超时时光说「超时了」没用 —— 真正的原因基本都在控制台里
        const noise = this.console.filter((l) => /^\[(error|exception|warning)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时，控制台里有这些：`);
            noise.slice(-12).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }

    async screenshot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `dy-probe-${name}.png`);
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
    results.push({ label, ok, detail });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** 按文本点一个按钮 —— 探针里最常用的动作，选择器要匹配语义元素而不是整行文本 */
function clickByText(scope, text) {
    return `(() => {
        const els = Array.from(document.querySelectorAll('${scope}'));
        const hit = els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}));
        if (hit) { hit.click(); return true; }
        return false;
    })()`;
}

function setInput(selector, value) {
    return `(() => {
        const el = document.querySelector('${selector}');
        if (!el) return false;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    })()`;
}

async function main() {
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

    try {
        // ══════════════════════════════════════════
        console.log('\n── 注册 / 建表 ──────────────────────────');
        await page.send('Page.navigate', { url: BASE });
        await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: 'app 注册' });
        await sleep(1500);

        check('App 已注册', await page.evaluate(
            `(window.__phoneAppsRef.value || []).some(a => a.id === 'diary')`,
        ));

        const stores = await page.evaluate(`(() => {
            const names = window.myDb?.getStoreNames?.() || [];
            return ['diarySpaces','diaryEntries','diaryNotes','diaryMarkers','diaryCycleDays'].filter(n => names.includes(n));
        })()`);
        check('IndexedDB 五张表都建好了', stores.length === 5, stores.join(', '));

        check('window.__diaryContext 已挂载', await page.evaluate(
            `typeof window.__diaryContext?.getContext === 'function' && typeof window.__diaryContext?.strip === 'function'`,
        ));

        const widgetIds = await page.evaluate(
            `Object.keys(window.APP_WIDGETS || {}).filter(k => k.startsWith('diary::'))`,
        );
        check('小组件已注册', widgetIds.length === 3, widgetIds.join(', '));

        // ══════════════════════════════════════════
        console.log('\n── 打开 App ─────────────────────────────');
        await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: 'diary' }
        }))`);
        await page.waitFor(`document.querySelector('${SHELL} .dy-root')`, { label: '根组件挂载' });
        await sleep(1600);

        // ★ 这一条是本项目最容易翻车的地方：vue 模式框架不会自动调 hydrate
        check('hydrate 真的跑了（ready=true）', await page.evaluate(
            `!document.querySelector('${SHELL} .dy-root .dy-empty')?.textContent.includes('正在打开')`,
        ));

        const themeToken = await page.evaluate(`(() => {
            const el = document.querySelector('${SHELL} .dy-root');
            return el ? getComputedStyle(el).getPropertyValue('--dy-primary').trim() : '';
        })()`);
        check('莫兰迪主题 token 生效', themeToken.toLowerCase() === '#8c7b6b', themeToken);

        const oversized = await page.evaluate(`
            Array.from(document.querySelectorAll('${SHELL} svg'))
                 .filter(s => s.getBoundingClientRect().width > 60).length
        `);
        check('没有被撑爆的 SVG', oversized === 0, `超大图标 ${oversized} 个`);

        const setupShown = await page.evaluate(`!!document.querySelector('${SHELL} .dy-setup')`);
        check('首次进入走配置向导', setupShown);
        await page.screenshot('01-setup');

        // ══════════════════════════════════════════
        console.log('\n── 配置向导 ─────────────────────────────');
        // 第 1 步：起名 + 换主题（挑「雾蓝」验证主题真的换得动）
        await page.evaluate(setInput(`${SHELL} .dy-setup input.dy-field`, '探针日记'));
        await sleep(150);
        await page.evaluate(`(() => {
            const el = document.querySelector('${SHELL} .dy-theme[data-diary-theme="mist"]');
            if (el) { el.click(); return true; }
            return false;
        })()`);
        await sleep(300);
        const mistOk = await page.evaluate(`(() => {
            const el = document.querySelector('${SHELL} .dy-root');
            return getComputedStyle(el).getPropertyValue('--dy-primary').trim().toLowerCase();
        })()`);
        check('换主题即时生效（雾蓝）', mistOk === '#6f7e8c', mistOk);
        await page.screenshot('02-setup-theme');

        // 逐步走完，中间设一个「一定在时段内」的写作时段
        await page.evaluate(clickByText(`${SHELL} .dy-setup__foot .dy-btn`, '下一步'));
        await sleep(400);

        // 第 2 步：把时段起点拖到「现在这个小时」，保证接下来写的是日记
        const hourNow = await page.evaluate(`new Date().getHours()`);
        const startHour = Math.min(19, Math.max(0, hourNow));
        await page.evaluate(`(() => {
            const el = document.querySelector('${SHELL} .dy-windowpick__range');
            if (!el) return false;
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '${startHour}');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        })()`);
        await sleep(300);
        check('写作时段可调', await page.evaluate(
            `(document.querySelector('${SHELL} .dy-windowpick__text')?.textContent || '').includes('${String(startHour).padStart(2, '0')}:00')`,
        ), `起点 ${startHour} 点`);

        await page.evaluate(clickByText(`${SHELL} .dy-setup__foot .dy-btn`, '下一步'));
        await sleep(400);
        // 第 3 步：生日 + 相识日
        await page.evaluate(`(() => {
            const inputs = document.querySelectorAll('${SHELL} input[type="date"]');
            const set = (el, v) => {
                Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            };
            if (inputs[0]) set(inputs[0], '1998-03-12');
            if (inputs[1]) set(inputs[1], '2024-05-20');
            return inputs.length;
        })()`);
        await sleep(300);
        await page.evaluate(clickByText(`${SHELL} .dy-setup__foot .dy-btn`, '下一步'));
        await sleep(400);

        // 第 4 步：开生理期 —— 这是本 App 的重点
        console.log('\n── 生理期配置 ───────────────────────────');
        await page.evaluate(`document.querySelector('${SHELL} .dy-setup .dy-switch')?.click()`);
        await sleep(500);
        const cycleFieldsShown = await page.evaluate(
            `document.querySelectorAll('${SHELL} .dy-setup .dy-formrow').length`,
        );
        check('开启后生理期字段展开', cycleFieldsShown >= 8, `${cycleFieldsShown} 个字段`);

        // 上次开始日填成「今天往前 2 天」→ 应该判定为经期中
        await page.evaluate(`(() => {
            const d = new Date(); d.setDate(d.getDate() - 2);
            const v = d.toLocaleDateString('en-CA');
            const inputs = document.querySelectorAll('${SHELL} .dy-setup input[type="date"]');
            const el = inputs[inputs.length - 1];
            if (!el) return false;
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return v;
        })()`);
        await sleep(300);
        await page.screenshot('03-setup-cycle');

        await page.evaluate(clickByText(`${SHELL} .dy-setup__foot .dy-btn`, '下一步'));
        await sleep(400);

        // 第 5 步：加一条倒计时
        await page.evaluate(setInput(`${SHELL} .dy-setup input.dy-field`, '期末考试'));
        await sleep(150);
        await page.evaluate(`(() => {
            const d = new Date(); d.setDate(d.getDate() + 12);
            const el = document.querySelector('${SHELL} .dy-setup input[type="date"]');
            if (!el) return false;
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, d.toLocaleDateString('en-CA'));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        })()`);
        await sleep(250);
        await page.evaluate(clickByText(`${SHELL} .dy-setup__body .dy-btn`, '加进去'));
        await sleep(300);
        await page.evaluate(clickByText(`${SHELL} .dy-setup__foot .dy-btn`, '开始写吧'));
        await sleep(1200);

        check('向导走完进入主界面', await page.evaluate(
            `!document.querySelector('${SHELL} .dy-setup') && !!document.querySelector('${SHELL} .dy-tabbar')`,
        ));
        await page.screenshot('04-today');

        // ══════════════════════════════════════════
        console.log('\n── 写日记 ───────────────────────────────');
        const windowOpen = await page.evaluate(
            `!!document.querySelector('${SHELL} .dy-window.is-open')`,
        );
        check('时段条显示「日记时段」', windowOpen);

        await page.evaluate(clickByText(`${SHELL} .dy-entry__foot .dy-btn`, '自己写'));
        await page.waitFor(`document.querySelector('${SHELL} .dy-composer__input')`, { label: '编辑器' });
        await page.evaluate(setInput(`${SHELL} .dy-composer__input`, '探针写的第一篇。今天风很大，走路都要低着头。'));
        await sleep(200);
        await page.evaluate(clickByText(`${SHELL} .dy-moods .dy-mood-pick`, '平静'));
        await sleep(150);
        await page.evaluate(clickByText(`${SHELL} .dy-composer__bar .dy-btn`, '存下'));
        await sleep(800);

        const entryText = await page.evaluate(
            `document.querySelector('${SHELL} .dy-entry__body')?.textContent.trim() || ''`,
        );
        check('日记写进去了', entryText.includes('风很大'), entryText.slice(0, 20));

        const dbEntries = await page.evaluate(`(async () => {
            const rows = await window.myDb.getAll('diaryEntries');
            return (rows || []).length;
        })()`);
        check('日记落到 IndexedDB（没被 Proxy 卡住）', dbEntries === 1, `${dbEntries} 条`);

        // 「一天一篇」：再存一次应该是覆盖，不是新增
        await page.evaluate(clickByText(`${SHELL} .dy-entry__foot .dy-btn`, '改'));
        await sleep(300);
        await page.evaluate(setInput(`${SHELL} .dy-composer__input`, '改过一次的正文。'));
        await sleep(150);
        await page.evaluate(clickByText(`${SHELL} .dy-composer__bar .dy-btn`, '存下'));
        await sleep(800);
        const afterEdit = await page.evaluate(`(async () => {
            const rows = await window.myDb.getAll('diaryEntries');
            return { n: (rows || []).length, text: rows?.[0]?.content || '' };
        })()`);
        check('一天只有一篇（覆盖而不是新增）', afterEdit.n === 1 && afterEdit.text.includes('改过一次'), `${afterEdit.n} 条`);

        // 便利贴
        await page.evaluate(setInput(`${SHELL} .dy-quicknote__input`, '顺手记一句：牛奶没了'));
        await sleep(200);
        await page.evaluate(`document.querySelector('${SHELL} .dy-quicknote .dy-btn')?.click()`);
        await sleep(700);
        const noteCount = await page.evaluate(`document.querySelectorAll('${SHELL} .dy-note').length`);
        check('便利贴能加', noteCount === 1, `${noteCount} 张`);
        await page.screenshot('05-entry');

        // ══════════════════════════════════════════
        console.log('\n── 时段外 = 便利贴 ──────────────────────');
        // 把时段起点改成一个「现在肯定不在里面」的值，验证 kind 判定真的切换
        const offHour = (hourNow + 8) % 20;
        await page.evaluate(`(() => {
            const shell = document.querySelector('${SHELL}');
            const app = (window.__phoneAppsRef.value || []).find(a => a.id === 'diary');
            return !!app;
        })()`);
        await page.evaluate(`document.querySelector('${SHELL} .dy-topbar .dy-iconbtn')?.click()`);
        await page.waitFor(`document.querySelector('${SHELL} .dy-sheet')`, { label: '设置抽屉' });
        await sleep(500);
        await page.evaluate(`(() => {
            const el = document.querySelector('${SHELL} .dy-sheet .dy-windowpick__range');
            if (!el) return false;
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '${offHour}');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        })()`);
        await sleep(400);
        await page.screenshot('06-settings');
        await page.evaluate(clickByText(`${SHELL} .dy-sheet__foot .dy-btn`, '好了'));
        await sleep(600);

        const nowClosed = await page.evaluate(
            `!document.querySelector('${SHELL} .dy-window.is-open')
             && (document.querySelector('${SHELL} .dy-window__main')?.textContent || '').includes('便利贴')`,
        );
        check('时段外提示改成「记的是便利贴」', nowClosed);

        // 把时段调回来，后面的检查还要用
        await page.evaluate(`document.querySelector('${SHELL} .dy-topbar .dy-iconbtn')?.click()`);
        await sleep(500);
        await page.evaluate(`(() => {
            const el = document.querySelector('${SHELL} .dy-sheet .dy-windowpick__range');
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '${startHour}');
            el.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await sleep(300);

        // ══════════════════════════════════════════
        console.log('\n── 上下文预览（预览 == 发送）────────────');
        await page.evaluate(clickByText(`${SHELL} .dy-sheet .dy-chip`, '会告诉 TA 什么'));
        await sleep(600);
        const ctxParts = await page.evaluate(
            `document.querySelectorAll('${SHELL} .dy-ctx__part').length`,
        );
        check('上下文分段列出来了', ctxParts >= 10, `${ctxParts} 段`);

        await page.evaluate(clickByText(`${SHELL} .dy-sheet .dy-btn`, '看原文'));
        await sleep(500);
        const rawPrompt = await page.evaluate(
            `document.querySelector('${SHELL} .dy-ctx__pre')?.textContent || ''`,
        );
        check('prompt 带成对标签', rawPrompt.includes('<写日记须知开始>') && rawPrompt.includes('<写日记须知结束>'));
        check('prompt 里有生理期段', rawPrompt.includes('<生理期开始>'), '');
        // 向导里把「上一次开始」填成了今天往前 2 天 → 应该判成经期第 3 天。
        // 只填了设置、一次卡都没打过也必须算数，否则会出现
        // 「下一次预计 9月8日，目前处于经期」这种自相矛盾的文案。
        check('生理期按 lastStart 推算出「第 3 天」',
            /第\s*3\s*天/.test(rawPrompt),
            rawPrompt.match(/[^\n]*经期[^\n]*/)?.[0]?.slice(0, 44) || '');
        check('生理期文案不自相矛盾',
            !(/下一次预计/.test(rawPrompt) && /目前处于经期/.test(rawPrompt)),
            '');
        check('prompt 里有倒计时', rawPrompt.includes('期末考试'), '');
        await page.screenshot('07-context');

        // 关掉一段，验证它真的从原文里消失（预览 == 发送 的核心）
        const beforeLen = rawPrompt.length;
        await page.evaluate(`(() => {
            const parts = Array.from(document.querySelectorAll('${SHELL} .dy-ctx__part'));
            const hit = parts.find(p => p.querySelector('.dy-ctx__title')?.textContent.trim() === '纪念日与计划');
            hit?.querySelector('.dy-switch')?.click();
            return !!hit;
        })()`);
        await sleep(600);
        const afterStrip = await page.evaluate(
            `document.querySelector('${SHELL} .dy-ctx__pre')?.textContent || ''`,
        );
        check('关掉一段后原文真的少了那一段', !afterStrip.includes('期末考试') && afterStrip.length < beforeLen,
            `${beforeLen} → ${afterStrip.length}`);
        // 打开还原
        await page.evaluate(`(() => {
            const parts = Array.from(document.querySelectorAll('${SHELL} .dy-ctx__part'));
            parts.find(p => p.querySelector('.dy-ctx__title')?.textContent.trim() === '纪念日与计划')
                 ?.querySelector('.dy-switch')?.click();
        })()`);
        await sleep(400);
        await page.evaluate(clickByText(`${SHELL} .dy-sheet__foot .dy-btn`, '好了'));
        await sleep(600);

        // ══════════════════════════════════════════
        console.log('\n── 生理期三态打卡 ───────────────────────');
        await page.evaluate(clickByText(`${SHELL} .dy-tabbar .dy-tab`, '身体'));
        await sleep(900);

        const heroText = await page.evaluate(
            `document.querySelector('${SHELL} .dy-cyclehero__state')?.textContent.trim() || ''`,
        );
        check('状态大卡显示推算结果', heroText.length > 0, heroText);

        const calCells = await page.evaluate(
            `document.querySelectorAll('${SHELL} .dy-cal__cell:not(.dy-cal__cell--pad)').length`,
        );
        check('日历画出来了', calCells >= 28, `${calCells} 天`);
        await page.screenshot('08-cycle');

        // 打「今天来了」
        await page.evaluate(clickByText(`${SHELL} .dy-cyclehero__quick .dy-btn`, '今天来了'));
        await sleep(800);
        const periodOk = await page.evaluate(`(async () => {
            const rows = await window.myDb.getAll('diaryCycleDays');
            const today = new Date().toLocaleDateString('en-CA');
            const hit = (rows || []).find(r => r.date === today);
            return hit ? hit.state : 'missing';
        })()`);
        check('「来了」落库', periodOk === 'period', periodOk);

        // 切成「还没来」—— 这是产品明确要求的那一条
        await page.evaluate(clickByText(`${SHELL} .dy-cyclehero__quick .dy-btn`, '还没来'));
        await sleep(800);
        const noneOk = await page.evaluate(`(async () => {
            const rows = await window.myDb.getAll('diaryCycleDays');
            const today = new Date().toLocaleDateString('en-CA');
            return (rows || []).find(r => r.date === today)?.state || 'missing';
        })()`);
        check('「还没来」落库（三态可区分）', noneOk === 'none', noneOk);

        // ★ 最关键的一条：prompt 必须显式说「她说了还没来」
        const liveCtx = await page.evaluate(`window.__diaryContext.getContext('probe-ai') || ''`);
        check('实时 prompt 显式声明「还没有来」',
            liveCtx.includes('还没有来') && liveCtx.includes('不要认为'),
            liveCtx.match(/[^\n]*还没有来[^\n]*/)?.[0]?.slice(0, 48) || '(空)');

        // 打卡表：痛经 / 用药 / 备注
        await page.evaluate(`(() => {
            const groups = Array.from(document.querySelectorAll('${SHELL} .dy-track__group'));
            const g = groups.find(x => x.querySelector('.dy-track__label')?.textContent.includes('痛经'));
            const btns = Array.from(g?.querySelectorAll('.dy-scale__item') || []);
            btns.find(b => b.textContent.trim() === '明显')?.click();
        })()`);
        await sleep(500);
        const painSpots = await page.evaluate(`(() => {
            const groups = Array.from(document.querySelectorAll('${SHELL} .dy-track__group'));
            const g = groups.find(x => x.querySelector('.dy-track__label')?.textContent.includes('痛经'));
            const chips = Array.from(g?.querySelectorAll('.dy-chip') || []);
            chips.find(b => b.textContent.trim() === '小腹')?.click();
            return chips.length;
        })()`);
        check('痛经分档 + 部位联动出现', painSpots > 0, `${painSpots} 个部位可选`);
        await sleep(600);

        const painSaved = await page.evaluate(`(async () => {
            const rows = await window.myDb.getAll('diaryCycleDays');
            const today = new Date().toLocaleDateString('en-CA');
            const hit = (rows || []).find(r => r.date === today);
            return hit ? { pain: hit.pain, spots: (hit.painSpots || []).join(',') } : null;
        })()`);
        check('打卡明细落库', painSaved?.pain === 'moderate' && painSaved?.spots === 'lower',
            JSON.stringify(painSaved));
        await page.screenshot('09-cycle-track');

        // ══════════════════════════════════════════
        console.log('\n── 纪念日 / 倒计时 ──────────────────────');
        await page.evaluate(clickByText(`${SHELL} .dy-tabbar .dy-tab`, '日子'));
        await sleep(800);
        const markerCount = await page.evaluate(
            `document.querySelectorAll('${SHELL} .dy-marker').length`,
        );
        check('向导里填的日子都在', markerCount >= 3, `${markerCount} 条（生日 / 相识 / 考试）`);

        const countdownValue = await page.evaluate(`(() => {
            const m = Array.from(document.querySelectorAll('${SHELL} .dy-marker'))
                .find(x => x.textContent.includes('期末考试'));
            return m?.querySelector('.dy-marker__value')?.textContent.trim() || '';
        })()`);
        check('倒计时天数算对了', countdownValue === '12', `${countdownValue} 天`);
        await page.screenshot('10-plans');

        // ══════════════════════════════════════════
        console.log('\n── 归档 ─────────────────────────────────');
        await page.evaluate(clickByText(`${SHELL} .dy-tabbar .dy-tab`, '过去'));
        await sleep(800);
        const archRows = await page.evaluate(`document.querySelectorAll('${SHELL} .dy-arch').length`);
        check('归档列出今天那一条', archRows === 1, `${archRows} 条`);
        await page.evaluate(`document.querySelector('${SHELL} .dy-arch')?.click()`);
        await sleep(600);
        check('点开能看到正文和便利贴', await page.evaluate(
            `(document.querySelector('${SHELL} .dy-archive__list')?.textContent || '').includes('牛奶没了')`,
        ));
        await page.screenshot('11-archive');

        // ══════════════════════════════════════════
        console.log('\n── 日记本列表 ───────────────────────────');
        await page.evaluate(clickByText(`${SHELL} .dy-tabbar .dy-tab`, '本子'));
        await sleep(900);
        const books = await page.evaluate(`(() => {
            const els = Array.from(document.querySelectorAll('${SHELL} .dy-book'));
            return { total: els.length, locked: els.filter(e => e.classList.contains('is-locked')).length };
        })()`);
        check('我的本子在列表里', books.total >= 1, `共 ${books.total} 本，锁着 ${books.locked} 本`);
        check('AI 的本子默认是锁着的', books.locked === Math.max(0, books.total - 1),
            `未布置 ${books.locked} 本`);

        // 「标题和副标题挤在同一行」这类 bug 截图上很明显，但没有任何报错。
        // 这些包装元素是 <span>（button 里不能放 div），不显式块化就会连成一句话。
        const stacked = await page.evaluate(`(() => {
            const bad = [];
            const pairs = [
                ['.dy-book', '.dy-book__name', '.dy-book__sub'],
                ['.dy-cyclemini', '.dy-cyclemini__state', '.dy-cyclemini__sub'],
            ];
            for (const [host, a, b] of pairs) {
                for (const el of document.querySelectorAll('${SHELL} ' + host)) {
                    const ea = el.querySelector(a), eb = el.querySelector(b);
                    if (!ea || !eb || !ea.textContent.trim() || !eb.textContent.trim()) continue;
                    if (Math.abs(ea.getBoundingClientRect().top - eb.getBoundingClientRect().top) < 2) {
                        bad.push(host + ' → ' + ea.textContent.trim().slice(0, 12));
                    }
                }
            }
            return bad;
        })()`);
        check('标题和副标题各占一行（没连成一句）', stacked.length === 0, stacked.join(' | '));
        await page.screenshot('12-books');

        // 「让 TA 布置」在没有 API Key 时必须给出**说清楚去哪儿修**的提示，
        // 而不是抛异常或者只说「失败了」。这条路径是核心需求，不能崩。
        await page.evaluate(clickByText(`${SHELL} .dy-btnbar .dy-btn`, '让 TA 布置'));
        await page.waitFor(`document.querySelector('${SHELL} .lp-modal')`, { label: '布置确认弹窗' });
        await page.evaluate(clickByText(`${SHELL} .lp-modal .ac-btn`, '开始'));
        await sleep(1500);
        const failMsg = await page.evaluate(
            `document.querySelector('${SHELL} .lp-modal .lp-modal-text')?.textContent.trim() || ''`,
        );
        check('没有 API 时给出可操作的提示（而不是崩）',
            failMsg.includes('API') && /nook|设置/.test(failMsg), failMsg.slice(0, 46));
        await page.evaluate(clickByText(`${SHELL} .lp-modal .ac-btn`, '知道了'));
        await sleep(400);
        check('失败后本子仍然是锁着的（没被误标成已布置）', await page.evaluate(
            `document.querySelectorAll('${SHELL} .dy-book.is-locked').length === 1`,
        ));

        // ══════════════════════════════════════════
        console.log('\n── 刷新后数据还在 ───────────────────────');
        await page.send('Page.navigate', { url: BASE });
        await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: '重新注册' });
        await sleep(1800);
        await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: 'diary' }
        }))`);
        await page.waitFor(`document.querySelector('${SHELL} .dy-root')`, { label: '重新挂载' });
        await sleep(1800);

        check('不再走配置向导', !(await page.evaluate(`!!document.querySelector('${SHELL} .dy-setup')`)));
        check('主题记住了（雾蓝）', (await page.evaluate(`(() => {
            const el = document.querySelector('${SHELL} .dy-root');
            return getComputedStyle(el).getPropertyValue('--dy-primary').trim().toLowerCase();
        })()`)) === '#6f7e8c');
        check('日记还在', (await page.evaluate(
            `(document.querySelector('${SHELL} .dy-entry__body')?.textContent || '').includes('改过一次')`,
        )));
        check('便利贴还在', (await page.evaluate(
            `document.querySelectorAll('${SHELL} .dy-note').length`,
        )) === 1);

        // ★ 刷新后实时 prompt 仍然说「还没来」—— 产品原话的那一条
        const ctxAfterReload = await page.evaluate(`window.__diaryContext.getContext('probe-ai') || ''`);
        check('刷新后 AI 仍然知道「她说了还没来」',
            ctxAfterReload.includes('还没有来') && ctxAfterReload.includes('不要认为'),
            ctxAfterReload.match(/[^\n]*还没有来[^\n]*/)?.[0]?.slice(0, 48) || '(空)');

        // 走真实注入路径：ai-service 会把 block 包成 <日记本开始>…<日记本结束> 再拼，
        // 下一轮发送前先 strip 再重拼。剪不干净 = 同一段内容注入两遍（一份还是过期的）。
        check('strip 能把自己那段剪干净（不误伤前后文）', await page.evaluate(`(() => {
            const block = window.__diaryContext.getContext('probe-ai');
            if (!block) return false;
            const wrapped = '<日记本开始>\\n' + block + '\\n<日记本结束>';
            const merged = '前面的段落\\n\\n' + wrapped + '\\n\\n后面的段落';
            const out = window.__diaryContext.strip(merged);
            return out.includes('前面的段落')
                && out.includes('后面的段落')
                && !out.includes('日记本（实时）')
                && !out.includes('<日记本开始>');
        })()`));

        // 剪两遍要幂等，而且对「已经没有那一段」的输入不能改坏原文
        check('strip 幂等 + 不动无关内容', await page.evaluate(`(() => {
            const plain = '甲\\n\\n乙';
            return window.__diaryContext.strip(plain) === plain;
        })()`));

        await page.screenshot('13-after-reload');

        // ══════════════════════════════════════════
        console.log('\n── 控制台 ───────────────────────────────');
        const errors = page.console.filter((l) => /^\[(error|exception)\]/.test(l))
            .filter((l) => !/favicon|Failed to load resource/i.test(l));
        check('没有 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '));
    } finally {
        try { proc.kill(); } catch (_) { /* 已经退了 */ }
    }

    // ══════════════════════════════════════════
    const failed = results.filter((r) => !r.ok);
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  ${results.length - failed.length} / ${results.length} 通过`);
    if (failed.length) {
        console.log('\n  没通过的：');
        failed.forEach((r) => console.log(`    ✗ ${r.label}${r.detail ? ` — ${r.detail}` : ''}`));
        process.exitCode = 1;
    }
    console.log('');
}

main().catch((err) => {
    console.error('\n探针挂了：', err.message);
    process.exitCode = 1;
});
