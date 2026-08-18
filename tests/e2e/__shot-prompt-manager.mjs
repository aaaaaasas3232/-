/**
 * 「回复提示词」页视觉抓图（一次性人工核对用，不做断言）
 *
 * 把 renderPromptManagerPage 的 HTML 塞进一个和真机同尺寸的壳里再截图 ——
 * 比一路点「聊天 → 设置 → 回复提示词」稳，页面样式选择器只依赖
 * `.app-shell[data-app-id="chat"] .prompt-manager`，壳里补齐就够了。
 *
 *   node --experimental-loader ./__loader-alias.mjs tests/e2e/__shot-prompt-manager.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => fs.existsSync(p));
const BASE = 'http://localhost:5173';
const PORT = 9372;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(os.tmpdir(), `pmshot-${Date.now()}`)}`,
    '--no-first-run', '--disable-gpu', '--window-size=430,1600', 'about:blank',
], { stdio: 'ignore' });

let wsUrl = '';
for (let i = 0; i < 60; i += 1) {
    try {
        wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl;
        if (wsUrl) break;
    } catch (_) {}
    await sleep(250);
}

let id = 0;
const pending = new Map();
const ws = await new Promise((res, rej) => {
    const s = new WebSocket(wsUrl);
    s.addEventListener('open', () => res(s));
    s.addEventListener('error', rej);
});
ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { targetInfos } = await send('Target.getTargets');
const info = targetInfos.find((t) => t.targetId === targetId);

let pid = 0;
const ppending = new Map();
const pageWsUrl = info?.webSocketDebuggerUrl || `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`;
const pws = await new Promise((res, rej) => {
    const s = new WebSocket(pageWsUrl);
    s.addEventListener('open', () => res(s));
    s.addEventListener('error', rej);
});
pws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && ppending.has(m.id)) { ppending.get(m.id)(m.result); ppending.delete(m.id); }
});
const psend = (method, params = {}) => new Promise((res) => { ppending.set(++pid, res); pws.send(JSON.stringify({ id: pid, method, params })); });
const evaluate = async (expr) => (await psend('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;

await psend('Runtime.enable');
await psend('Page.enable');
await psend('Page.navigate', { url: BASE });

for (let i = 0; i < 120; i += 1) {
    if (await evaluate(`Boolean(window.settingsSdk?.aiPersons && typeof window.__chatRefreshContextPreview === 'function')`)) break;
    await sleep(300);
}
await sleep(1500);

const mounted = await evaluate(`
    (async () => {
        const s = window.settingsSdk;
        let ai = s.aiPersons.list()[0];
        if (!ai) ai = await s.aiPersons.create({ name: '探针AI', personality: '安静、话不多' });
        const m = await import('/js/apps/chat-app/pages/prompt-manager-page.js');
        const app = (window.__phoneAppsRef?.value || []).find((a) => a.id === 'chat');
        const html = await m.renderPromptManagerPage(app, 'private-' + ai.id + '-calendar');
        document.querySelectorAll('#pm-shot-host').forEach((n) => n.remove());
        const host = document.createElement('div');
        host.id = 'pm-shot-host';
        host.style.cssText = 'position:fixed;left:0;top:0;width:430px;height:1560px;z-index:99999;background:#fff;overflow:hidden;';
        host.innerHTML = '<div class="app-shell" data-app-id="chat" style="position:absolute;inset:0;">' + html + '</div>';
        document.body.appendChild(host);
        const page = host.querySelector('.pm-page');
        if (page) page.style.overflow = 'visible';
        return { len: html.length, groups: host.querySelectorAll('.pm-app-group').length, switches: host.querySelectorAll('.pm-app-group__switch').length };
    })()
`);
console.log('挂载结果:', JSON.stringify(mounted));

await psend('Emulation.setDeviceMetricsOverride', { width: 430, height: 1560, deviceScaleFactor: 2, mobile: true });
await sleep(600);
const shot = await psend('Page.captureScreenshot', { format: 'png' });
const file = path.join(ROOT, 'pm-shot-top.png');
fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
console.log('截图:', file);

// 再滚到「可用 Prompt」那一段
await evaluate(`document.querySelector('#pm-shot-host .pm-app-group-list')?.scrollIntoView({ block: 'start' })`);
await sleep(400);
const shot2 = await psend('Page.captureScreenshot', { format: 'png' });
const file2 = path.join(ROOT, 'pm-shot-groups.png');
fs.writeFileSync(file2, Buffer.from(shot2.data, 'base64'));
console.log('截图:', file2);

// 第三张：把一组关掉，看灰化后还读不读得懂
await evaluate(`
    (async () => {
        const s = window.settingsSdk;
        const ai = s.aiPersons.list()[0];
        const app = (window.__phoneAppsRef?.value || []).find((a) => a.id === 'chat');
        app.methods.togglePromptGroupInject({ aiPersonId: String(ai.id), source: 'murmur' });
        const m = await import('/js/apps/chat-app/pages/prompt-manager-page.js');
        const html = await m.renderPromptManagerPage(app, 'private-' + ai.id + '-calendar');
        const host = document.querySelector('#pm-shot-host');
        host.innerHTML = '<div class="app-shell" data-app-id="chat" style="position:absolute;inset:0;">' + html + '</div>';
        const page = host.querySelector('.pm-page');
        if (page) page.style.overflow = 'visible';
        host.querySelector('.pm-app-group-list')?.scrollIntoView({ block: 'start' });
        // 恢复原状，别把开发机的开关留在关闭态
        app.methods.togglePromptGroupInject({ aiPersonId: String(ai.id), source: 'murmur' });
    })()
`);
await sleep(600);
const shot3 = await psend('Page.captureScreenshot', { format: 'png' });
const file3 = path.join(ROOT, 'pm-shot-group-off.png');
fs.writeFileSync(file3, Buffer.from(shot3.data, 'base64'));
console.log('截图:', file3);

try { proc.kill(); } catch (_) {}
process.exit(0);
