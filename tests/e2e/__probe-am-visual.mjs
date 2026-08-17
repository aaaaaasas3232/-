/**
 * App 制作 · 视觉与布局探针
 *
 * 只干两件事：量尺寸、拍照。
 *
 * 量的是那几个「肉眼看着不对、但说不清哪里不对」的量：
 *   · tab 栏到底在不在视口里（上一版它掉到了 1359px 的文档流最底下）
 *   · 内容区离手机壳左右各有多远（上一版每边空 44px）
 *   · 页面上同时存在几个滚动容器（两个就会抢手势）
 *   · 还有没有毛玻璃、有几处阴影、有没有露出来的滚动条
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-am-visual.mjs`
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
const PORT = 9372;
const PROFILE = path.join(os.tmpdir(), `am-vis-${Date.now()}`);
const APP_ID = 'app-maker';
const SHELL = `.app-shell[data-app-id="${APP_ID}"]`;

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
                    .map((a) => a.value ?? a.description ?? '')
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
        const noise = this.console.filter((l) => /^\[(error|exception)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时，控制台里有这些：`);
            noise.slice(-12).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }

    async click(selector, wait = 320) {
        const ok = await this.evaluate(`
            (() => {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return false;
                el.click();
                return true;
            })()
        `);
        if (!ok) throw new Error(`点不到: ${selector}`);
        await sleep(wait);
        return true;
    }

    /** 只拍手机那一块，省得整页白边淹没细节 */
    async shot(name) {
        const clip = await this.evaluate(`
            (() => {
                const el = document.querySelector('.phone-case') || document.getElementById('phone');
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: r.width + 12, height: r.height + 12 };
            })()
        `);
        const res = await this.send('Page.captureScreenshot', {
            format: 'png',
            ...(clip ? { clip: { ...clip, scale: 2 } } : {}),
        });
        const file = path.join(ROOT, `amv-${name}.png`);
        fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
        console.log(`    照片 → amv-${name}.png`);
        return file;
    }
}

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok });
    console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function openWs(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener('open', () => resolve(ws));
        ws.addEventListener('error', reject);
    });
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
        '--force-device-scale-factor=1',
        '--window-size=460,760',
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

    console.log('\n── 启动 ────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: 'app 注册' });
    await sleep(1000);

    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: '${APP_ID}' }
        }))
    `);
    await page.waitFor(`document.querySelector('${SHELL} .am-root')`, { label: '根组件挂载' });
    await sleep(800);

    // ================================================================
    console.log('\n── 布局体检 ────────────────────────────');

    const geo = await page.evaluate(`
        (() => {
            const shell = document.querySelector('${SHELL}');
            const screen = document.querySelector('.phone-screen');
            const root = shell.querySelector('.am-root');
            const bar = shell.querySelector('.am-tabbar');
            const survey = shell.querySelector('.am-survey__scroll');
            const sr = screen.getBoundingClientRect();
            const rr = root.getBoundingClientRect();
            const br = bar.getBoundingClientRect();
            const cr = survey ? survey.getBoundingClientRect() : null;

            // 内容真正的可写宽度：拿一个实际的问题块来量
            const field = shell.querySelector('.am-field, .am-sechead');
            const fr = field ? field.getBoundingClientRect() : null;

            return {
                screen: { w: Math.round(sr.width), h: Math.round(sr.height), top: Math.round(sr.top), bottom: Math.round(sr.bottom) },
                root: { w: Math.round(rr.width), h: Math.round(rr.height), top: Math.round(rr.top) },
                tabbar: { top: Math.round(br.top), bottom: Math.round(br.bottom), h: Math.round(br.height) },
                content: cr ? { w: Math.round(cr.width) } : null,
                gutterLeft: fr ? Math.round(fr.left - sr.left) : null,
                gutterRight: fr ? Math.round(sr.right - fr.right) : null,
                fieldW: fr ? Math.round(fr.width) : null,
            };
        })()
    `);

    console.log(`    手机屏 ${geo.screen.w}×${geo.screen.h}，根节点 ${geo.root.w}×${geo.root.h}`);

    check('根节点高度 = 屏幕高度（没有被内容撑长）',
        Math.abs(geo.root.h - geo.screen.h) <= 2,
        `根 ${geo.root.h}px / 屏 ${geo.screen.h}px`);

    check('tab 栏在视口内，且贴着屏幕底边',
        geo.tabbar.bottom <= geo.screen.bottom + 2 && geo.tabbar.top >= geo.screen.top,
        `tab 底边 ${geo.tabbar.bottom} / 屏底 ${geo.screen.bottom}`);

    check('内容左右留白收到 20px 以内',
        geo.gutterLeft !== null && geo.gutterLeft <= 20 && geo.gutterRight <= 20,
        `左 ${geo.gutterLeft}px / 右 ${geo.gutterRight}px（改之前是 44px），可写宽度 ${geo.fieldW}px`);

    // 同一时刻有几个真正能滚的容器？两个套在一起就会抢手势
    // 顶上那一圈：状态栏和灵动岛都是框架画在 App 之上的，自绘内容得躲开它们
    const topZone = await page.evaluate(`
        (() => {
            const scr = document.querySelector('.phone-screen').getBoundingClientRect();
            const box = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const b = el.getBoundingClientRect();
                if (!b.height) return null;
                return { top: Math.round(b.top - scr.top), bottom: Math.round(b.bottom - scr.top) };
            };
            return {
                island: box('.dynamic-island'),
                dots: box('${SHELL} .am-survey__steps'),
                learnTitle: box('${SHELL} .am-head__title'),
            };
        })()
    `);
    const islandBottom = topZone.island ? topZone.island.bottom : 0;
    const firstInk = topZone.dots ? topZone.dots.top : null;
    check('自绘内容躲开了灵动岛',
        firstInk === null || firstInk >= islandBottom,
        `灵动岛底 ${islandBottom}px / 第一个自绘元素顶 ${firstInk}px`);

    const scrollers = await page.evaluate(`
        (() => {
            const shell = document.querySelector('${SHELL}');
            const all = [shell, ...shell.querySelectorAll('*')];
            const hits = [];
            for (const el of all) {
                if (!el.getBoundingClientRect().width) continue;
                const cs = getComputedStyle(el);
                const scrollable = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
                if (scrollable) hits.push((el.className || el.tagName).toString().split(' ')[0]);
            }
            return hits;
        })()
    `);
    check('同时只有一个滚动容器在工作', scrollers.length <= 1, scrollers.length ? scrollers.join(' + ') : '无');

    const chrome = await page.evaluate(`
        (() => {
            const shell = document.querySelector('${SHELL}');
            const all = shell.querySelectorAll('*');
            let blur = 0, shadow = 0, visibleBar = 0;
            for (const el of all) {
                const cs = getComputedStyle(el);
                if (cs.backdropFilter && cs.backdropFilter !== 'none') blur++;
                if (cs.boxShadow && cs.boxShadow !== 'none') shadow++;
                if (el.scrollHeight > el.clientHeight + 2 && el.offsetWidth > el.clientWidth + 1) visibleBar++;
            }
            return { blur, shadow, visibleBar };
        })()
    `);
    check('没有毛玻璃', chrome.blur === 0, `backdrop-filter ${chrome.blur} 处`);
    check('阴影用得克制', chrome.shadow <= 4, `box-shadow ${chrome.shadow} 处`);
    check('没有占位的滚动条', chrome.visibleBar === 0, `露出滚动条 ${chrome.visibleBar} 处`);

    const oversized = await page.evaluate(`
        Array.from(document.querySelectorAll('${SHELL} svg'))
             .filter(s => s.getBoundingClientRect().width > 60).length
    `);
    check('没有被撑爆的 SVG', oversized === 0, `超大图标 ${oversized} 个`);

    // ================================================================
    console.log('\n── 逐页拍照 ────────────────────────────');

    await page.shot('01-survey-basic');

    // 配置第 2 步：配色 + 预览
    await page.evaluate(`window.__amStore.setStep(1)`);
    await sleep(500);
    await page.shot('02-survey-visual');

    // 收起预览之后，配色 / 圆角 / 间距那几组选项卡长什么样
    await page.evaluate(`
        (() => {
            const b = document.querySelector('${SHELL} .am-previewslot__act');
            if (b) b.click();
        })()
    `);
    await sleep(400);
    await page.shot('02b-survey-styles');
    await page.evaluate(`
        (() => {
            const b = document.querySelector('${SHELL} .am-previewslot__act');
            if (b) b.click();
        })()
    `);
    await sleep(400);

    // 预览放大档
    const scaler = await page.evaluate(`
        (() => {
            const bs = document.querySelectorAll('${SHELL} .am-preview__scaler button');
            if (bs.length < 2) return false;
            bs[1].click();
            return true;
        })()
    `);
    if (scaler) { await sleep(400); await page.shot('03-preview-zoom'); }
    check('预览有两档缩放', !!scaler);

    // 第 3 步：顶栏（单选卡 + 多选卡都在这一段）
    await page.evaluate(`window.__amStore.setStep(2)`);
    await sleep(500);
    await page.evaluate(`
        (() => {
            const s = document.querySelector('${SHELL} .am-survey__scroll');
            if (s) s.scrollTop = 260;
        })()
    `);
    await sleep(350);
    await page.shot('03b-survey-options');

    // 第 5 步：页面配置（卡片最多的一段）
    await page.evaluate(`window.__amStore.setStep(4)`);
    await sleep(500);
    await page.shot('04-survey-pages');

    // 第 6 步：白膜组件（整屏都是多选卡）
    await page.evaluate(`window.__amStore.setStep(5)`);
    await sleep(500);
    await page.shot('04b-survey-parts');

    // 第 9 步：检查
    await page.evaluate(`window.__amStore.setStep(8)`);
    await sleep(500);
    await page.shot('05-survey-review');

    // 词汇页
    await page.click(`${SHELL} .am-tab:nth-child(1)`, 500);
    await page.shot('06-glossary');

    await page.click(`${SHELL} .am-gcard`, 400);
    await page.shot('07-glossary-list');

    await page.click(`${SHELL} .am-termrow`, 500);
    const sheet = await page.evaluate(`!!document.querySelector('${SHELL} .am-sheet')`);
    check('词条详情能弹出来', sheet);
    await page.shot('08-glossary-sheet');
    await page.click(`${SHELL} .am-sheet__close`, 350);

    // 助手页
    await page.click(`${SHELL} .am-tab:nth-child(3)`, 500);
    await page.shot('09-chat');

    // 生成页
    await page.click(`${SHELL} .am-tab:nth-child(4)`, 900);
    await page.shot('10-result');

    // 滚到底看看 tab 栏还在不在
    await page.evaluate(`
        (() => {
            const s = document.querySelector('${SHELL} .am-pane:not([style*="none"]) .am-scroll');
            if (s) s.scrollTop = s.scrollHeight;
        })()
    `);
    await sleep(450);
    const stillThere = await page.evaluate(`
        (() => {
            const bar = document.querySelector('${SHELL} .am-tabbar').getBoundingClientRect();
            const scr = document.querySelector('.phone-screen').getBoundingClientRect();
            return bar.bottom <= scr.bottom + 2 && bar.top >= scr.top;
        })()
    `);
    check('滚到底之后 tab 栏还在原地', stillThere);
    await page.shot('11-result-scrolled');

    // ================================================================
    const errs = page.console.filter((l) => /^\[(error|exception)\]/.test(l));
    console.log('\n── 控制台 ──────────────────────────────');
    if (errs.length) errs.slice(0, 10).forEach((l) => console.log('    ' + l));
    check('控制台没有报错', errs.length === 0, `${errs.length} 条`);

    const bad = results.filter((r) => !r.ok);
    console.log(`\n${'═'.repeat(44)}`);
    console.log(bad.length ? `  ${bad.length} 项没过：${bad.map((b) => b.label).join('、')}` : `  全部 ${results.length} 项通过`);
    console.log(`${'═'.repeat(44)}\n`);

    proc.kill();
    process.exit(bad.length ? 1 : 0);
}

main().catch((err) => {
    console.error('\n探针失败:', err.message);
    process.exit(1);
});
