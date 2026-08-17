/**
 * 梦境编织 端到端冒烟（真实浏览器，走 CDP）
 *
 * 为什么必须真跑浏览器:本项目历史上的恶性 bug 有个共同特征 ——
 * build 和 lint 全绿,只在浏览器里才炸(vue 模式 hydrate 没人调、
 * Proxy 写不进 IndexedDB、解构出默认值 true…)。静态检查一个都抓不到。
 *
 * 覆盖:打开 App → 建书 → 进编辑器 → 发一段(不调 AI)→ 切抽屉 → 换主题 → 刷新后数据还在。
 *
 * 用法:先 `npm run dev`,再 `node tests/e2e/__probe-dw.mjs`
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
const PORT = 9344;
const PROFILE = path.join(os.tmpdir(), `dw-probe-${Date.now()}`);

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
        // 超时的时候光说「超时了」没用 —— 真正的原因基本都在控制台里(某个模块 import 挂了之类)
        const noise = this.console.filter((l) => /^\[(error|exception|warning)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时,控制台里有这些:`);
            noise.slice(-12).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }

    async screenshot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `dw-probe-${name}.png`);
        fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
        return file;
    }
}

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok, detail });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
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

    console.log('\n── 打开页面 ─────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: 'app 注册' });
    await sleep(1200);

    const registered = await page.evaluate(
        `(window.__phoneAppsRef.value || []).some(a => a.id === 'dream-weaver')`,
    );
    check('App 已注册', registered);

    const stores = await page.evaluate(`
        (async () => {
            const names = window.myDb?.getStoreNames?.() || [];
            return ['dwBooks','dwChapters','dwLibrary'].filter(n => names.includes(n));
        })()
    `);
    check('IndexedDB 三张表都建好了', stores.length === 3, stores.join(', '));

    console.log('\n── 打开 App ─────────────────────────────');
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: 'dream-weaver' }
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-root')`, { label: '根组件挂载' });
    await sleep(900);

    const themeAttr = await page.evaluate(
        `document.querySelector('.app-shell[data-app-id="dream-weaver"]')?.getAttribute('data-dw-theme') || ''`,
    );
    check('主题属性已写到 app-shell', themeAttr === 'retro-dark', themeAttr);

    const tokenOk = await page.evaluate(`
        (() => {
            const el = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            return getComputedStyle(el).getPropertyValue('--dw-primary').trim();
        })()
    `);
    check('主题 token 生效', tokenOk.toLowerCase() === '#c62828', tokenOk);

    const shelfReady = await page.evaluate(
        `!!document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-shelf')`,
    );
    check('书架已渲染', shelfReady);

    // SVG 尺寸兜底:没有任何图标被画成 300×150
    const oversizedSvg = await page.evaluate(`
        Array.from(document.querySelectorAll('.app-shell[data-app-id="dream-weaver"] svg'))
             .filter(s => s.getBoundingClientRect().width > 60).length
    `);
    check('没有被撑爆的 SVG', oversizedSvg === 0, `超大图标 ${oversizedSvg} 个`);

    await page.screenshot('01-shelf');

    console.log('\n── 建书 → 进编辑器 ──────────────────────');
    // 走 UI:点「新建」→ 填书名 → 创建
    await page.evaluate(`
        (() => {
            const btns = Array.from(document.querySelectorAll('.app-shell[data-app-id="dream-weaver"] .dw-shelf-head button'));
            btns.find(b => b.textContent.includes('新建'))?.click();
        })()
    `);
    await page.waitFor(`document.querySelector('.dw-book-modal')`, { label: '建书弹窗' });

    await page.evaluate(`
        (() => {
            const input = document.querySelector('.dw-book-modal .dw-input');
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, '探针测试书');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        })()
    `);
    await sleep(200);
    await page.evaluate(`
        (() => {
            const btns = Array.from(document.querySelectorAll('.dw-book-modal .ac-btn'));
            btns.find(b => b.textContent.trim() === '创建')?.click();
        })()
    `);
    await sleep(900);

    const bookCount = await page.evaluate(
        `document.querySelectorAll('.app-shell[data-app-id="dream-weaver"] .dw-book-card').length`,
    );
    check('书建出来了', bookCount === 1, `${bookCount} 本`);

    await page.evaluate(
        `document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-book-card')?.click()`,
    );
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-editor')`, { label: '编辑器' });
    await sleep(700);

    const autoChapter = await page.evaluate(
        `document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-chapter-title')?.textContent || ''`,
    );
    check('自动建了第一章', autoChapter.length > 0, autoChapter);

    await page.screenshot('02-editor');

    console.log('\n── 顶部工具栏(1:1 复原)──────────────');
    const toolbar = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            const bar = root.querySelector('.dw-enhanced-toolbar');
            if (!bar) return { ok: false };
            const main = bar.querySelector('.dw-toolbar-main');
            return {
                ok: true,
                mainHeight: Math.round(main.getBoundingClientRect().height),
                leftBtns: bar.querySelectorAll('.dw-toolbar-left .dw-toolbar-btn-icon').length,
                rightBtns: bar.querySelectorAll('.dw-toolbar-right .dw-toolbar-btn-icon').length,
                hasChapterSel: !!bar.querySelector('.dw-chapter-selector.dw-selector-swipe'),
                hasTimelineSel: !!bar.querySelector('.dw-timeline-selector.dw-selector-swipe'),
                volumeText: bar.querySelector('.dw-chapter-volume')?.textContent || '',
                chapterText: bar.querySelector('.dw-chapter-number')?.textContent || '',
                timeLabel: bar.querySelector('.dw-timeline-label')?.textContent || '',
                quickItems: bar.querySelectorAll('.dw-quick-setting-item').length,
            };
        })()
    `);
    check('工具栏结构还原(左1 + 双选择器 + 右4)',
        toolbar.ok && toolbar.leftBtns === 1 && toolbar.rightBtns === 4
        && toolbar.hasChapterSel && toolbar.hasTimelineSel,
        `left=${toolbar.leftBtns} right=${toolbar.rightBtns} 高=${toolbar.mainHeight}px`);
    check('章节选择器显示卷名 + 章号', toolbar.volumeText === '第一卷' && toolbar.chapterText === '第1章',
        `${toolbar.volumeText} / ${toolbar.chapterText}`);
    check('时间线选择器就位', toolbar.timeLabel === '故事时间', toolbar.timeLabel);
    check('快捷设置三项(人称/方向/字数)', toolbar.quickItems === 3, `${toolbar.quickItems} 项`);

    // 齿轮:先加一章,再用滚轮切过去
    console.log('\n── 齿轮滑动切章 ─────────────────────────');
    const gear = await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            const sel = root.querySelector('.dw-chapter-selector');
            const before = root.querySelector('.dw-chapter-number').textContent;

            // 先建第二章:更多操作 → 目录 → 新增一章
            root.querySelectorAll('.dw-toolbar-right .dw-toolbar-btn-icon')[3].click();
            await new Promise(r => setTimeout(r, 400));
            Array.from(document.querySelectorAll('.dw-option-item'))
                 .find(b => b.textContent.includes('目录'))?.click();
            await new Promise(r => setTimeout(r, 500));
            document.querySelector('.dw-nav-add')?.click();
            await new Promise(r => setTimeout(r, 600));
            document.querySelector('.dw-drawer-scrim')?.click();
            await new Promise(r => setTimeout(r, 400));

            const mid = root.querySelector('.dw-chapter-number').textContent;

            // 滚轮向上 = 上一章(累积超过 30 触发一次)
            sel.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 500));
            const after = root.querySelector('.dw-chapter-number').textContent;
            const tickClass = sel.className;
            return { before, mid, after, tickClass };
        })()
    `);
    check('滚轮能切章', gear.mid === '第2章' && gear.after === '第1章',
        `${gear.before} → ${gear.mid} → 滚轮 → ${gear.after}`);

    // ★ 回归:普通点击必须能打开弹窗。
    //   之前 dragEnd 无条件立「吞掉 click」的标记,而 mouseup 早于 click,
    //   结果两个齿轮都点不开弹窗(用户报的第一个 bug)。
    console.log('\n── 齿轮「点击」打开弹窗 ─────────────────');
    const tapTime = await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            const sel = root.querySelector('.dw-timeline-selector');
            const r = sel.getBoundingClientRect();
            const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true };
            sel.dispatchEvent(new MouseEvent('mousedown', { ...at, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup', at));
            sel.dispatchEvent(new MouseEvent('click', at));
            await new Promise(r2 => setTimeout(r2, 600));
            const modal = document.querySelector('.dw-timeline-modal');
            return {
                open: !!modal,
                days: modal ? modal.querySelectorAll('.dw-wt-day:not(.is-empty)').length : 0,
                months: modal ? modal.querySelectorAll('.dw-wt-month').length : 0,
                hasClose: modal ? !!modal.querySelector('.ac-close') : true,
            };
        })()
    `);
    check('点「故事时间」弹出日历', tapTime.open && tapTime.months === 12 && tapTime.days >= 28,
        `${tapTime.months} 个月 / ${tapTime.days} 天`);
    check('弹窗没有右上角关闭按钮', tapTime.open && !tapTime.hasClose);

    // 点遮罩关闭
    const backdrop = await page.evaluate(`
        (async () => {
            const overlay = document.querySelector('.dw-timeline-modal');
            overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 500));
            return !document.querySelector('.dw-timeline-modal');
        })()
    `);
    check('点遮罩能关闭弹窗', backdrop);

    console.log('\n── 上下文面板(预览 == 发送)────────────');
    await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            root.querySelectorAll('.dw-toolbar-right .dw-toolbar-btn-icon')[3].click();
            await new Promise(r => setTimeout(r, 400));
            Array.from(document.querySelectorAll('.dw-option-item'))
                 .find(b => b.textContent.includes('上下文管理'))?.click();
        })()
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="dream-weaver"] .ctxp')`, { label: '上下文面板' });
    await sleep(500);

    const partCount = await page.evaluate(
        `document.querySelectorAll('.app-shell[data-app-id="dream-weaver"] .ctxp-item').length`,
    );
    check('上下文分段渲染出来了', partCount > 0, `${partCount} 段`);

    // 关掉「故事梗概」,确认 store 里的开关真的变了(这就是原版那个 bug 的回归点)
    const toggled = await page.evaluate(`
        (async () => {
            const items = Array.from(document.querySelectorAll('.app-shell[data-app-id="dream-weaver"] .ctxp-item'));
            const target = items.find(i => i.textContent.includes('故事梗概'));
            if (!target) return 'no-section';
            target.querySelector('.ctxp-switch')?.click();
            await new Promise(r => setTimeout(r, 400));
            const books = await window.myDb.getAllRecords('dwBooks');
            return String(books[0]?.contextConfig?.synopsis);
        })()
    `);
    check('段落开关落到了 book.contextConfig', toggled === 'false', `synopsis=${toggled}`);

    await page.screenshot('03-context');

    console.log('\n── 写一段(不调 AI)──────────────────────');
    await page.evaluate(
        `document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-drawer-scrim')?.click()`,
    );
    await sleep(400);

    const wrote = await page.evaluate(`
        (async () => {
            const ta = document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-input-textarea');
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            setter.call(ta, '探针写下的第一句话。');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
            document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-send-btn')?.click();
            await new Promise(r => setTimeout(r, 1500));
            const rows = await window.myDb.getAllRecords('dwChapters');
            return rows.reduce((n, r) => n + (r.messages || []).filter(m => m.role === 'user').length, 0);
        })()
    `);
    check('用户输入已落 IndexedDB', wrote >= 1, `${wrote} 条 user 消息`);

    // 输入框收起 40px / 展开 120px —— 原版的招牌行为
    const expand = await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            const ta = root.querySelector('.dw-input-textarea');
            const before = Math.round(ta.getBoundingClientRect().height);
            root.querySelector('.dw-expand-btn').click();
            await new Promise(r => setTimeout(r, 450));
            const after = Math.round(ta.getBoundingClientRect().height);
            root.querySelector('.dw-expand-btn').click();
            await new Promise(r => setTimeout(r, 450));
            return { before, after };
        })()
    `);
    check('输入框展开/收起', expand.before === 40 && expand.after === 120, `${expand.before}px → ${expand.after}px`);

    // 叙事折叠按钮显示「上帝·三·顺」
    const narrative = await page.evaluate(
        `document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-narrative-label')?.textContent || ''`,
    );
    check('叙事按钮显示缩写标签', narrative === '上帝·三·顺', narrative);

    // 气泡:88% 居中 + 点一下浮出工具条 + 点「更多」展开第二批
    const bubble = await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            const container = root.querySelector('.dw-bubble-container');
            if (!container) return { ok: false };
            const bub = container.querySelector('.dw-message-bubble');
            const widthPct = Math.round(bub.getBoundingClientRect().width / container.getBoundingClientRect().width * 100);
            const radius = getComputedStyle(bub).borderTopRightRadius;

            bub.click();
            await new Promise(r => setTimeout(r, 400));
            const bar = container.querySelector('.dw-bubble-actions');
            const before = bar.querySelectorAll('.dw-bubble-action-btn').length;
            const visible = bar.classList.contains('visible');

            Array.from(bar.querySelectorAll('.dw-bubble-action-btn'))
                 .find(b => b.getAttribute('title') === '更多')?.click();
            await new Promise(r => setTimeout(r, 400));
            const after = container.querySelectorAll('.dw-bubble-action-btn').length;
            return { ok: true, widthPct, radius, visible, before, after };
        })()
    `);
    check('气泡 88% 居中 + 尖角', bubble.ok && bubble.widthPct === 88 && bubble.radius === '4px',
        `${bubble.widthPct}% / 右上角 ${bubble.radius}`);
    check('点气泡浮出工具条,点「更多」展开第二批',
        bubble.visible && bubble.after > bubble.before,
        `${bubble.before} → ${bubble.after} 个按钮`);

    await page.screenshot('05-composer');

    console.log('\n── 主题弹窗 + 实时预览 ─────────────────');
    await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            root.querySelector('.dw-toolbar-left .dw-toolbar-btn-icon').click();   // 返回书架
            await new Promise(r => setTimeout(r, 600));
            Array.from(root.querySelectorAll('.dw-tabbar-item'))
                 .find(t => t.textContent.includes('我的'))?.click();
            await new Promise(r => setTimeout(r, 500));
            Array.from(root.querySelectorAll('.dw-row'))
                 .find(r => r.textContent.includes('主题与配色'))?.click();
            await new Promise(r => setTimeout(r, 600));
        })()
    `);
    const themeModal = await page.evaluate(`
        (() => {
            const cards = document.querySelectorAll('.dw-theme-card');
            const previews = document.querySelectorAll('.dw-theme-preview');
            const live = previews[previews.length - 1];
            return {
                cards: cards.length,
                previews: previews.length,
                bubbles: live ? live.querySelectorAll('.dw-theme-preview-bubble').length : 0,
                sentColor: live ? getComputedStyle(live.querySelector('.dw-theme-preview-bubble.is-sent')).backgroundColor : '',
            };
        })()
    `);
    check('两张内置主题卡 + 迷你预览', themeModal.cards === 2 && themeModal.previews >= 3,
        `${themeModal.cards} 卡 / ${themeModal.previews} 预览`);
    check('预览里的气泡用主题色渲染', themeModal.bubbles === 2 && themeModal.sentColor === 'rgb(198, 40, 40)',
        themeModal.sentColor);

    // ★ 两张卡片的迷你预览必须**各显示各的配色**。
    //   色值是 `readPresetColors()` 靠隐藏探针 div 从 CSS 里读出来的,
    //   而 `_theme.css` 原来只写了 shell 自身的选择器 —— 探针(一个后代 div)匹配不上,
    //   两张卡会全部显示成当前主题。不报错,只是「预览坏了」,只能靠这条断言抓。
    //   2026-08-14 修,详见 AGENTS2 §18。
    const cardPreviews = await page.evaluate(`
        (() => {
            const cards = [...document.querySelectorAll('.dw-theme-card .dw-theme-preview')];
            const bgs = cards.map(c => c.style.getPropertyValue('--dw-bg').trim());
            return { count: cards.length, unique: new Set(bgs).size, bgs };
        })()
    `);
    check('★ 两张主题卡各显示各的配色', cardPreviews.count === 2 && cardPreviews.unique === 2,
        cardPreviews.bgs.join(' / '));

    // 批量配置:粘一段进去 → 解析并应用 → 预览立刻变色
    const batch = await page.evaluate(`
        (async () => {
            const modal = document.querySelector('.dw-theme-modal');
            Array.from(modal.querySelectorAll('.dw-theme-editor-toggle')).forEach(b => b.click());
            await new Promise(r => setTimeout(r, 400));
            const ta = modal.querySelector('.dw-batch-input');
            if (!ta) return { ok: false, reason: '没有批量输入框' };
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            setter.call(ta, '--dw-primary: #00AAFF;\\n--dw-bubble-sent:#00AAFF;\\n--not-a-var: #fff;');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
            modal.querySelector('.dw-batch-apply').click();
            await new Promise(r => setTimeout(r, 500));
            const previews = modal.querySelectorAll('.dw-theme-preview');
            const live = previews[previews.length - 1];
            return {
                ok: true,
                sent: getComputedStyle(live.querySelector('.dw-theme-preview-bubble.is-sent')).backgroundColor,
                cleared: modal.querySelector('.dw-batch-input').value === '',
            };
        })()
    `);
    check('批量粘贴配色能解析并生效', batch.ok && batch.sent === 'rgb(0, 170, 255)' && batch.cleared,
        batch.ok ? batch.sent : batch.reason);

    await page.screenshot('06-theme');

    // 改回默认,别把后面的换主题断言带偏
    await page.evaluate(`
        (async () => {
            const modal = document.querySelector('.dw-theme-modal');
            modal.querySelector('.dw-theme-reset-all')?.click();
            await new Promise(r => setTimeout(r, 300));
        })()
    `);

    console.log('\n── 换主题 ───────────────────────────────');
    await page.evaluate(`
        (async () => {
            // 在主题弹窗里点「国风浅色」卡片 → 应用
            const cards = Array.from(document.querySelectorAll('.dw-theme-card'));
            cards.find(c => c.textContent.includes('国风'))?.click();
            await new Promise(r => setTimeout(r, 400));
            Array.from(document.querySelectorAll('.dw-theme-modal .ac-btn'))
                 .find(b => b.textContent.trim() === '应用')?.click();
            await new Promise(r => setTimeout(r, 600));
        })()
    `);
    const lightTheme = await page.evaluate(`
        (() => {
            const el = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            return {
                attr: el.getAttribute('data-dw-theme'),
                primary: getComputedStyle(el).getPropertyValue('--dw-primary').trim(),
            };
        })()
    `);
    check('换主题真的换得动', lightTheme.attr === 'oriental-light' && lightTheme.primary.toLowerCase() === '#2e7d32',
        `${lightTheme.attr} / ${lightTheme.primary}`);

    await page.screenshot('04-light-theme');

    // ════════════════════════════════════════════════════════
    // 杀青梗 / IF 线 / 章节信息 / 聊天背景
    // ════════════════════════════════════════════════════════

    console.log('\n── 杀青梗社交卡片 ───────────────────────');
    // ★ 别想着 `import('/js/apps/.../store.js')` 抓 store 来驱动:
    //   dev server 给模块 URL 加了 `?t=<时间戳>`,不带 query 去 import 会拿到**另一个模块实例**
    //   —— 一个全新的空 store,在上面调 openModal 对页面毫无影响(而且不报错,最难查)。
    //   所以这里全部走真实 UI 点击,断言走 window.myDb(IndexedDB 是共享的)。

    // 主题那一段把我们带回了书架的「我的」页,先回编辑器
    await page.evaluate(`
        (async () => {
            document.querySelector('.dw-theme-modal')?.click();
            await new Promise(r => setTimeout(r, 400));
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            Array.from(root.querySelectorAll('.dw-tabbar-item'))
                 .find(t => t.textContent.includes('书架'))?.click();
            await new Promise(r => setTimeout(r, 500));
            root.querySelector('.dw-book-card')?.click();
            await new Promise(r => setTimeout(r, 900));
        })()
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-editor')`, { label: '回到编辑器' });
    await sleep(500);

    // 从「更多操作」菜单进 —— 和用户的路径完全一样
    const openMore = `
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            root.querySelector('.dw-drawer-scrim')?.click();
            document.querySelector('.ac-overlay')?.click();
            await new Promise(r => setTimeout(r, 350));
            root.querySelectorAll('.dw-toolbar-right .dw-toolbar-btn-icon')[3].click();
            await new Promise(r => setTimeout(r, 450));
        })()
    `;
    // ★ 必须比对 `.dw-option-label` 的完整文本,不能用整行 textContent.includes ——
    //   「衍生创作」那一行的副标题是「IF线 / 小剧场 / 杀青梗」,
    //   用 includes 找「杀青梗」会先命中它,点开的是抽屉不是弹窗(而且不报错,查了半天)。
    const pickOption = (label) => `
        (async () => {
            const all = Array.from(document.querySelectorAll('.dw-option-item'));
            const item = all.find(b => b.querySelector('.dw-option-label')?.textContent.trim() === ${JSON.stringify(label)});
            if (!item) return 'not-found: ' + all.map(b => b.querySelector('.dw-option-label')?.textContent).join(',');
            item.click();
            await new Promise(r => setTimeout(r, 600));
            return 'ok';
        })()
    `;

    await page.evaluate(openMore);
    const finaleEntry = await page.evaluate(pickOption('杀青梗'));
    check('「更多操作」里有杀青梗入口', finaleEntry === 'ok', finaleEntry);

    const finaleConfig = await page.evaluate(`
        (() => {
            const m = document.querySelector('.dw-finale-modal');
            return {
                open: Boolean(m),
                modes: m ? m.querySelectorAll('.dw-finale-mode-btn').length : 0,
                hasClose: Boolean(m && m.querySelector('.ac-modal-close')),
            };
        })()
    `);
    check('杀青梗配置弹窗打开', finaleConfig.open);
    check('三种模式都在(电视剧/电影/小说)', finaleConfig.modes === 3, String(finaleConfig.modes));
    check('弹窗没有右上角关闭按钮', !finaleConfig.hasClose);

    await page.evaluate(`
        (async () => {
            const m = document.querySelector('.dw-finale-modal');
            Array.from(m.querySelectorAll('.ac-btn')).find(b => b.textContent.trim() === '开始')?.click();
            await new Promise(r => setTimeout(r, 400));
        })()
    `);
    const finalePanel = await page.evaluate(`
        (() => {
            const m = document.querySelector('.dw-finale-modal');
            return {
                tabs: Array.from(m.querySelectorAll('.dw-finale-type-btn')).map(b => b.textContent.trim()),
                empty: Boolean(m.querySelector('.dw-finale-empty-state')),
            };
        })()
    `);
    check('电视剧模式 = 热搜 + 群聊两个 tab',
        finalePanel.tabs.length === 2 && finalePanel.tabs[0].includes('热搜') && finalePanel.tabs[1].includes('群聊'),
        finalePanel.tabs.join(' / '));
    check('没卡片时是空状态', finalePanel.empty);

    // 加一张微博卡,填内容,再加评论
    await page.evaluate(`
        (async () => {
            const m = document.querySelector('.dw-finale-modal');
            m.querySelector('.dw-finale-add-btn').click();
            await new Promise(r => setTimeout(r, 300));
        })()
    `);
    const weiboCard = await page.evaluate(`
        (() => {
            const c = document.querySelector('.dw-weibo-topic-card');
            if (!c) return { ok: false };
            return {
                ok: true,
                rank: c.querySelector('.dw-weibo-topic-rank')?.textContent.trim(),
                title: c.querySelector('.dw-weibo-topic-text')?.textContent.trim(),
                posts: c.querySelectorAll('.dw-weibo-post-card').length,
                editable: c.querySelector('.dw-weibo-post-content')?.getAttribute('contenteditable'),
                headerBg: getComputedStyle(c.querySelector('.dw-weibo-topic-header')).backgroundImage,
            };
        })()
    `);
    check('微博卡片渲染出来了', weiboCard.ok);
    check('话题标题预填了书名', (weiboCard.title || '').includes('探针测试书'), weiboCard.title);
    check('自带一条空博文', weiboCard.posts === 1, String(weiboCard.posts));
    check('正文可就地编辑', weiboCard.editable === 'true');
    check('话题头是渐变色', /gradient/.test(weiboCard.headerBg || ''));

    // 手填内容 → blur 提交 → 检查存进 store
    await page.evaluate(`
        (async () => {
            const el = document.querySelector('.dw-weibo-post-content');
            el.focus();
            el.innerText = '今天终于杀青了,这一年谢谢大家';
            el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
            await new Promise(r => setTimeout(r, 400));
        })()
    `);
    const savedText = await page.evaluate(`
        (async () => {
            const books = await window.myDb.getAllRecords('dwBooks');
            return books[0]?.finaleCards?.weibo?.[0]?.posts?.[0]?.content || '';
        })()
    `);
    check('手填内容写进了 store', savedText.includes('杀青'), savedText);

    await page.evaluate(`
        (async () => {
            const btns = Array.from(document.querySelectorAll('.dw-weibo-post-action-btn'));
            btns.find(b => b.textContent.trim() === '评论')?.click();
            await new Promise(r => setTimeout(r, 300));
        })()
    `);
    const commentCount = await page.evaluate(`document.querySelectorAll('.dw-weibo-comment-item').length`);
    check('能加评论', commentCount === 1, String(commentCount));

    // 楼中楼回复 + 删除(原版这个删除按钮画了但没绑事件)
    await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.dw-weibo-comment-action'))
                 .find(s => s.textContent.trim() === '回复')?.click();
            await new Promise(r => setTimeout(r, 300));
        })()
    `);
    const replyCount = await page.evaluate(`document.querySelectorAll('.dw-weibo-reply-item').length`);
    check('能加楼中楼回复', replyCount === 1, String(replyCount));

    await page.evaluate(`
        (async () => {
            const meta = document.querySelector('.dw-weibo-reply-item .dw-weibo-comment-meta');
            Array.from(meta.querySelectorAll('.dw-weibo-comment-action'))
                 .find(s => s.textContent.trim() === '删除')?.click();
            await new Promise(r => setTimeout(r, 300));
        })()
    `);
    const replyAfter = await page.evaluate(`document.querySelectorAll('.dw-weibo-reply-item').length`);
    check('楼中楼删除能用(原版这个按钮是死的)', replyAfter === 0, String(replyAfter));

    // 切到群聊 tab
    await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.dw-finale-type-btn'))
                 .find(b => b.textContent.includes('群聊'))?.click();
            await new Promise(r => setTimeout(r, 300));
            document.querySelector('.dw-finale-add-btn').click();
            await new Promise(r => setTimeout(r, 300));
        })()
    `);
    const groupCard = await page.evaluate(`
        (() => {
            const c = document.querySelector('.dw-group-chat-card');
            if (!c) return { ok: false };
            const av = c.querySelector('.dw-group-bubble-avatar');
            return {
                ok: true,
                name: c.querySelector('.dw-group-name-input')?.value,
                members: c.querySelector('.dw-group-chat-count')?.value,
                bubbles: c.querySelectorAll('.dw-group-bubble').length,
                avatarToned: Boolean(av && /tone-\\d/.test(av.className)),
            };
        })()
    `);
    check('群聊卡片渲染出来了', groupCard.ok);
    check('群名预填「书名+粉丝群」', (groupCard.name || '').includes('粉丝群'), groupCard.name);
    check('默认 500 人', groupCard.members === '500', groupCard.members);
    check('头像按名字取色', groupCard.avatarToned);

    await page.screenshot('07-finale-cards');

    // 收藏 + 关闭
    const archived = await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.dw-finale-modal .ac-btn'))
                 .find(b => b.textContent.trim() === '收藏这组')?.click();
            await new Promise(r => setTimeout(r, 400));
            const books = await window.myDb.getAllRecords('dwBooks');
            return (books[0]?.savedFinaleCards?.groupchat || []).length;
        })()
    `);
    check('收藏能存进 savedFinaleCards', archived === 1, String(archived));

    await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.dw-finale-modal .ac-btn'))
                 .find(b => b.textContent.trim() === '完成')?.click();
            await new Promise(r => setTimeout(r, 400));
        })()
    `);

    console.log('\n── IF 线工作台 ──────────────────────────');
    await page.evaluate(`
        (async () => {
            window.dispatchEvent(new CustomEvent('dream-weaver:open-ifline'));
            await new Promise(r => setTimeout(r, 500));
        })()
    `);
    const ifPanel = await page.evaluate(`
        (() => {
            const p = document.querySelector('.dw-if-panel');
            if (!p) return { ok: false };
            const r = p.getBoundingClientRect();
            return {
                ok: true,
                tabs: Array.from(p.querySelectorAll('.if-mode-tab')).map(t => t.textContent.trim()),
                povs: p.querySelectorAll('.if-pov-btn').length,
                chars: p.querySelectorAll('.if-char-btn').length,
                genDisabled: p.querySelector('.if-generate-btn')?.disabled,
                overlays: r.height > 100,
            };
        })()
    `);
    check('IF 面板打开了', ifPanel.ok);
    check('是盖在编辑器上的面板不是弹窗', ifPanel.overlays);
    check('两个模式 tab', ifPanel.tabs.length === 2 && ifPanel.tabs[0] === '文本生成' && ifPanel.tabs[1] === '对话模拟',
        ifPanel.tabs.join('/'));
    check('三个人称', ifPanel.povs === 3, String(ifPanel.povs));
    check('至少有「旁白」一个视角选项', ifPanel.chars >= 1, String(ifPanel.chars));
    check('没填假设时生成按钮是灰的', ifPanel.genDisabled === true);

    await page.evaluate(`
        (async () => {
            const ta = document.querySelector('.dw-if-panel .dw-textarea');
            ta.value = '如果她那天没有回头';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 300));
        })()
    `);
    const genEnabled = await page.evaluate(`!document.querySelector('.if-generate-btn').disabled`);
    check('填了假设按钮就亮了', genEnabled);

    await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.if-mode-tab')).find(t => t.textContent.trim() === '对话模拟').click();
            await new Promise(r => setTimeout(r, 350));
        })()
    `);
    const chatMode = await page.evaluate(`
        (() => {
            const p = document.querySelector('.dw-if-panel');
            return {
                setupShown: Boolean(p.querySelector('.if-new-section')),
                title: p.querySelector('.if-section-title')?.textContent.trim(),
                archiveChip: Array.from(p.querySelectorAll('.if-chip')).map(c => c.textContent.trim()).join('|'),
            };
        })()
    `);
    check('切到对话模式', chatMode.title === '选择聊天对象', chatMode.title);
    check('对话存档 chip 在', /对话存档/.test(chatMode.archiveChip), chatMode.archiveChip);

    await page.screenshot('08-ifline');

    await page.evaluate(`
        (async () => {
            document.querySelector('.if-close-btn').click();
            await new Promise(r => setTimeout(r, 350));
        })()
    `);
    check('IF 面板能关掉', await page.evaluate(`!document.querySelector('.dw-if-panel')`));

    console.log('\n── 章节信息(四个 tab) ──────────────────');
    await page.evaluate(openMore);
    const cimEntry = await page.evaluate(pickOption('章节信息'));
    check('「更多操作」里有章节信息入口', cimEntry === 'ok', cimEntry);
    const cim = await page.evaluate(`
        (() => {
            const m = document.querySelector('.dw-cim-modal');
            if (!m) return { ok: false };
            return {
                ok: true,
                tabs: Array.from(m.querySelectorAll('.cim-tab')).map(t => t.textContent.trim()),
            };
        })()
    `);
    check('章节信息弹窗打开', cim.ok);
    check('四个 tab:梗概/角色视角/场景角色/上下文',
        cim.tabs.join('/') === '梗概/角色视角/场景/角色/上下文', cim.tabs.join('/'));

    // 写梗概 → 上下文 tab 的「只用梗概」应该从禁用变可选
    const beforeSummary = await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.cim-tab')).find(t => t.textContent.trim() === '上下文').click();
            await new Promise(r => setTimeout(r, 300));
            return document.querySelectorAll('.cim-mode-option')[1].disabled;
        })()
    `);
    check('没梗概时「只用梗概」不可选', beforeSummary === true);

    await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.cim-tab')).find(t => t.textContent.trim() === '梗概').click();
            await new Promise(r => setTimeout(r, 250));
            const ta = document.querySelector('.dw-cim-modal .dw-textarea');
            ta.value = '主角在雪夜里做了一个决定。';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 500));
        })()
    `);
    const afterSummary = await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.cim-tab')).find(t => t.textContent.trim() === '上下文').click();
            await new Promise(r => setTimeout(r, 300));
            const opt = document.querySelectorAll('.cim-mode-option')[1];
            opt.click();
            await new Promise(r => setTimeout(r, 400));
            const rows = await window.myDb.getAllRecords('dwChapters');
            const ch = rows.find(c => c.chapterInfo || c.summary) || rows[0];
            return {
                disabled: opt.disabled,
                mode: ch.chapterInfo?.contextMode,
                legacy: ch.useSummary,
                legacySummary: ch.summary,
            };
        })()
    `);
    check('写了梗概后「只用梗概」可选了', afterSummary.disabled === false);
    check('上下文模式存进 chapterInfo', afterSummary.mode === 'summary', afterSummary.mode);
    check('★ 同时写了兼容字段 chapter.useSummary', afterSummary.legacy === true, String(afterSummary.legacy));
    check('★ 同时写了兼容字段 chapter.summary', (afterSummary.legacySummary || '').includes('雪夜'), afterSummary.legacySummary);

    // 角色视角
    await page.evaluate(`
        (async () => {
            Array.from(document.querySelectorAll('.cim-tab')).find(t => t.textContent.trim() === '角色视角').click();
            await new Promise(r => setTimeout(r, 300));
        })()
    `);
    const viewTab = await page.evaluate(`
        (() => {
            const m = document.querySelector('.dw-cim-modal');
            return { empty: Boolean(m.querySelector('.dw-empty')) };
        })()
    `);
    check('角色视角初始是空状态', viewTab.empty);

    await page.screenshot('09-chapter-info');
    await page.evaluate(`
        Array.from(document.querySelectorAll('.dw-cim-modal .ac-btn'))
             .find(b => b.textContent.trim() === '完成')?.click()
    `);
    await sleep(300);

    console.log('\n── 聊天背景 ─────────────────────────────');
    await page.evaluate(openMore);
    const bgEntry = await page.evaluate(pickOption('聊天背景'));
    check('「更多操作」里有聊天背景入口', bgEntry === 'ok', bgEntry);
    const bgModal = await page.evaluate(`
        (() => {
            const m = document.querySelector('.dw-bg-modal');
            if (!m) return { ok: false };
            const segs = Array.from(m.querySelectorAll('.dw-segmented-btn, .dw-segmented button'));
            return {
                ok: true,
                labels: segs.map(s => s.textContent.trim()),
                colorInput: Boolean(m.querySelector('.dw-bg-color')),
                colorValue: m.querySelector('.dw-bg-color')?.value,
            };
        })()
    `);
    check('背景弹窗打开', bgModal.ok);
    check('有作用范围(本书/全部书)+ 三种类型',
        bgModal.labels.includes('仅这本书') && bgModal.labels.includes('全部书') &&
        bgModal.labels.includes('纯色') && bgModal.labels.includes('毛玻璃'), bgModal.labels.join('/'));
    check('色板初值取自当前主题而非写死', /^#[0-9a-f]{6}$/i.test(bgModal.colorValue || ''), bgModal.colorValue);

    const glassApplied = await page.evaluate(`
        (async () => {
            const m = document.querySelector('.dw-bg-modal');
            Array.from(m.querySelectorAll('.dw-segmented-btn, .dw-segmented button'))
                 .find(b => b.textContent.trim() === '毛玻璃').click();
            await new Promise(r => setTimeout(r, 300));
            Array.from(m.querySelectorAll('.ac-btn')).find(b => b.textContent.trim() === '保存').click();
            await new Promise(r => setTimeout(r, 1400));
            // 变量绑在根组件节点(.dw-root)上,不是 .app-shell —— 从 shell 上读会是空的
            const shell = document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-root');
            const chat = document.querySelector('.dw-chat-container');
            const books = await window.myDb.getAllRecords('dwBooks');
            return {
                blurVar: getComputedStyle(shell).getPropertyValue('--dw-chat-blur').trim(),
                filter: chat ? getComputedStyle(chat).backdropFilter : '',
                stored: books[0]?.customBackground?.type,
            };
        })()
    `);
    check('毛玻璃存进了 book.customBackground', glassApplied.stored === 'glass', glassApplied.stored);
    check('背景变量写到了根节点', glassApplied.blurVar === '10px', glassApplied.blurVar);
    check('阅读区真的糊了', /blur\(10px\)/.test(glassApplied.filter), glassApplied.filter);

    await page.screenshot('10-background');

    console.log('\n── 刷新后数据还在 ───────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor(`window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0`, { label: '重新注册' });
    await sleep(1500);
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: 'dream-weaver' }
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-book-card')`, { label: '书架恢复' });
    await sleep(600);

    const persisted = await page.evaluate(`
        (() => {
            const card = document.querySelector('.app-shell[data-app-id="dream-weaver"] .dw-book-title');
            const shell = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            return { title: card?.textContent || '', theme: shell?.getAttribute('data-dw-theme') };
        })()
    `);
    check('书刷新后还在', persisted.title === '探针测试书', persisted.title);
    check('主题偏好持久化了', persisted.theme === 'oriental-light', persisted.theme);

    console.log('\n── 控制台 ───────────────────────────────');
    const bad = page.console.filter((line) =>
        /^\[(error|exception)\]/.test(line) &&
        !/favicon|Failed to load resource/i.test(line));
    check('没有 error / 未捕获异常', bad.length === 0, bad.slice(0, 5).join(' | '));
    if (bad.length) bad.forEach((l) => console.log('    ' + l));

    const dwWarn = page.console.filter((l) => /dream-weaver/.test(l) && /warn/.test(l));
    if (dwWarn.length) {
        console.log('\n  本 App 的 warning:');
        dwWarn.forEach((l) => console.log('    ' + l));
    }

    const passed = results.filter((r) => r.ok).length;
    console.log(`\n═════ ${passed}/${results.length} 通过 ═════\n`);

    try { proc.kill(); } catch (_) {}
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) {}
    process.exit(passed === results.length ? 0 : 1);
}

function openWs(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener('open', () => resolve(ws));
        ws.addEventListener('error', reject);
    });
}

main().catch((err) => {
    console.error('\n探针失败:', err.message);
    process.exit(1);
});
