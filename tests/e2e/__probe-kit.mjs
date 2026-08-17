/**
 * 共用探针工具：起一个无头 Edge/Chrome，连 CDP，打开小听，提供点击/取文本/截图。
 *
 * 以前每个 __probe-*.mjs 都把 Cdp 类、启动浏览器、等 app 注册这一百多行抄一遍，
 * 改一处要改十个文件。这里抽出来，probe 脚本只写断言。
 *
 * 用法：
 *   import { launch, check, report } from './__probe-kit.mjs';
 *   const { page, close } = await launch({ port: 9400, prefix: 'mu' });
 *   check('xxx', await page.evaluate('...'));
 *   await close(); report();
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const BASE = 'http://localhost:5173';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSER_CANDIDATES = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

const results = [];

export function check(label, ok, detail = '') {
    results.push({ label, ok: !!ok, detail });
    console.log(`${ok ? '  OK ' : '  XX '} ${label}${detail ? ` — ${detail}` : ''}`);
    return !!ok;
}

export function section(title) {
    console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 40 - title.length))}`);
}

export function report() {
    const bad = results.filter((r) => !r.ok);
    console.log(`\n=== ${results.length - bad.length}/${results.length} 通过 ===`);
    if (bad.length) {
        console.log('未通过：');
        bad.forEach((r) => console.log(`  - ${r.label}${r.detail ? ` (${r.detail})` : ''}`));
    }
    return bad.length === 0;
}

export class Cdp {
    constructor(ws, prefix = 'probe') {
        this.ws = ws;
        this.prefix = prefix;
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
        const res = await this.send('Runtime.evaluate', {
            expression, returnByValue: true, awaitPromise: true,
        });
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
            await sleep(200);
        }
        const noise = this.console.filter((l) => /^\[(error|exception)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时，控制台里有：`);
            noise.slice(-8).forEach((l) => console.log('    ' + l));
        }
        try {
            const state = await this.evaluate(`JSON.stringify({
                href: location.href,
                title: document.title,
                readyState: document.readyState,
                body: (document.body?.innerText || '').trim().slice(0, 180),
            })`);
            console.log(`\n  页面状态：${state}`);
        } catch (_) { /* 页面本身已经不可访问 */ }
        throw new Error(`等待超时: ${label}`);
    }

    /** 点一个选择器（在页面里 dispatch 真实 click，走事件委托） */
    async click(selector, { index = 0 } = {}) {
        return this.evaluate(`
            (() => {
                const els = document.querySelectorAll(${JSON.stringify(selector)});
                const el = els[${index}];
                if (!el) return false;
                el.scrollIntoView({ block: 'center' });
                el.click();
                return true;
            })()
        `);
    }

    /** 点包含指定文字的元素 */
    async clickText(selector, text) {
        return this.evaluate(`
            (() => {
                const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
                const el = els.find((e) => (e.textContent || '').includes(${JSON.stringify(text)}));
                if (!el) return false;
                el.scrollIntoView({ block: 'center' });
                el.click();
                return true;
            })()
        `);
    }

    async text(selector) {
        return this.evaluate(`(document.querySelector(${JSON.stringify(selector)})?.textContent || '').trim()`);
    }

    async count(selector) {
        return this.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    }

    async exists(selector) {
        return this.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
    }

    async screenshot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `${this.prefix}-${name}.png`);
        fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
        return file;
    }

    errors() {
        return this.console.filter((l) => /^\[(error|exception)\]/.test(l));
    }
}

function openWs(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener('open', () => resolve(ws));
        ws.addEventListener('error', reject);
    });
}

/**
 * 起浏览器 + 打开小听 + 等 app 注册完。
 * @param {{port?:number, prefix?:string, width?:number, height?:number, waitApps?:boolean}} opts
 */
export async function launch(opts = {}) {
    const port = opts.port || 9400;
    const prefix = opts.prefix || 'probe';
    const width = opts.width || 430;
    const height = opts.height || 932;
    const profile = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);

    const bin = BROWSER_CANDIDATES.find((p) => fs.existsSync(p));
    if (!bin) throw new Error('找不到 Edge / Chrome');

    const proc = spawn(bin, [
        '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
        '--no-first-run', '--disable-gpu', `--window-size=${width},${height}`,
        '--autoplay-policy=no-user-gesture-required',
        'about:blank',
    ], { stdio: 'ignore' });

    let wsUrl = '';
    for (let i = 0; i < 80; i += 1) {
        try {
            wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
            if (wsUrl) break;
        } catch (_) { /* 还没起来 */ }
        await sleep(200);
    }
    if (!wsUrl) throw new Error('浏览器没起来');

    const browser = new Cdp(await openWs(wsUrl), prefix);
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { targetInfos } = await browser.send('Target.getTargets');
    const info = targetInfos.find((t) => t.targetId === targetId);
    const page = new Cdp(await openWs(info.webSocketDebuggerUrl || `ws://127.0.0.1:${port}/devtools/page/${targetId}`), prefix);
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Page.navigate', { url: opts.url || BASE });

    if (opts.waitApps !== false) {
        try {
            // 机器负载高 / dev server 冷启动时，几百个模块的首轮 transform 可能远超 20s，
            // 默认给 60s；单个探针可用 appsTimeout 再放宽（2026-08-16 深夜的教训）
            await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', {
                label: 'app 注册', timeout: opts.appsTimeout ?? 60000,
            });
            await sleep(opts.settleMs ?? 1500);
        } catch (err) {
            try { proc.kill(); } catch (_) { /* noop */ }
            try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) { /* noop */ }
            throw err;
        }
    }

    const close = async () => {
        try { proc.kill(); } catch (_) { /* noop */ }
        await sleep(200);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) { /* noop */ }
    };

    return { page, browser, close, proc };
}

/** 打开某个 app（走 framework 的 app:page-action 事件） */
export async function openApp(page, appId, { settleMs = 800 } = {}) {
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: ${JSON.stringify(appId)} }
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="${appId}"]')`, { label: `${appId} shell` });
    await sleep(settleMs);
}

/**
 * 调 app 的一个 method —— 走 framework 的 app:page-action，和用户点按钮完全同一条路径。
 * （registerPhoneApp 已经把 methods 绑好 this，直接调也行，但走事件能顺带验证派发链路。）
 */
export async function callMethod(page, appId, method, payload = {}, { settleMs = 400 } = {}) {
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'appMethod', appId: ${JSON.stringify(appId)},
                      method: ${JSON.stringify(method)}, payload: ${JSON.stringify(payload)} }
        }))
    `);
    await sleep(settleMs);
}
