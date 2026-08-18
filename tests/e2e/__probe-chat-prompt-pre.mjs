/**
 * murmur 回复提示词 —— 真机 pre 拼装冒烟
 *
 * 纯逻辑那部分在 `tests/regression/__probe-chat-prompt.mjs`。这一支专门验
 * **在真页面里跑一遍 prompt-manager 的无头拼装**,盯三件事:
 *
 *   ① pre 真的按新顺序拼:总纲第一段、当前聊天回合最后一段
 *   ② 整组开关真的把那一组从 pre 里拿掉了(不只是界面变灰)
 *   ③ 折叠头上的整组开关真的渲染出来了,而且页面渲染没抛异常
 *
 * 用法:先 `npm run dev`,再
 *   node --experimental-loader ./__loader-alias.mjs tests/e2e/__probe-chat-prompt-pre.mjs
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
const PORT = 9371;
const PROFILE = path.join(os.tmpdir(), `pmpre-probe-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

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
    async waitFor(expression, { timeout = 25000, label = expression } = {}) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            try {
                if (await this.evaluate(`(() => { try { return !!(${expression}); } catch (_) { return false; } })()`)) return true;
            } catch (_) { /* 可能正在导航 */ }
            await sleep(250);
        }
        try {
            const diag = await this.evaluate(`JSON.stringify({ href: location.href, ready: document.readyState, body: document.body ? document.body.innerHTML.length : -1 })`);
            console.log(`\n  等待「${label}」超时。页面状态: ${diag}`);
        } catch (e) {
            console.log(`\n  等待「${label}」超时,连页面状态都读不到: ${e?.message || e}`);
        }
        const tail = this.console.slice(-12);
        if (tail.length) {
            console.log('  控制台最后几行:');
            tail.forEach((l) => console.log('    ' + l.slice(0, 200)));
        } else {
            console.log('  控制台一行输出都没有(页面大概根本没跑起来)');
        }
        throw new Error(`等待超时: ${label}`);
    }
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
    await page.waitFor(`typeof window.__chatRefreshContextPreview === 'function'`, { label: 'chat 无头刷新入口' });
    await sleep(1200);

    // 准备一个 AI 人设,并把开关表清干净(探针不该被上一次运行的残留影响)
    const aiId = await page.evaluate(`
        (async () => {
            localStorage.removeItem('xiaoting::chat-prompt-group-inject-v1');
            localStorage.removeItem('xiaoting::chat-prompt-card-inject-v1');
            const s = window.settingsSdk;
            let ai = s.aiPersons.list()[0];
            if (!ai) ai = await s.aiPersons.create({ name: '探针AI', personality: '安静、话不多' });
            return String(ai.id);
        })()
    `);
    check('拿到 AI 人设', !!aiId, aiId);

    const preKey = (id) => `xiaoting::chat-context-preview-v1::${encodeURIComponent(id)}::calendar`;

    console.log('\n── pre 拼装 ─────────────────────────────');
    const pre = await page.evaluate(`
        (async () => {
            await window.__chatRefreshContextPreview({ aiPersonId: ${JSON.stringify(aiId)}, mode: 'calendar' });
            const raw = localStorage.getItem(${JSON.stringify(preKey(aiId))});
            return raw ? (JSON.parse(raw).text || '') : '';
        })()
    `);
    check('pre 生成了', pre.length > 0, `${pre.length} 字`);
    check('第一段是对话总则', pre.startsWith('<对话总则开始>'), pre.slice(0, 24).replace(/\n/g, '⏎'));
    check('AI 人设在里面', pre.includes('<AI人设开始>'));
    check('回复格式在里面', pre.includes('<回复格式开始>'));
    check('表情包库这一段不再自称「已注入到 systemPrompt」',
        !pre.includes('详细名称列表已注入到 systemPrompt'));
    check('人设卡里没有光秃秃的 age:', !/^age:\s*$/m.test(pre));

    const hasRounds = pre.includes('<当前聊天回合开始>');
    check('如果有聊天回合,它必须是最后一段',
        !hasRounds || pre.trimEnd().endsWith('<当前聊天回合结束>'),
        hasRounds ? pre.slice(-32).replace(/\n/g, '⏎') : '(这个 AI 还没有聊天记录)');

    console.log('\n── 整组开关真的作用到 pre ───────────────');
    const afterOff = await page.evaluate(`
        (async () => {
            const app = (window.__phoneAppsRef?.value || []).find((a) => a.id === 'chat');
            app.methods.togglePromptGroupInject({ aiPersonId: ${JSON.stringify(aiId)}, source: 'murmur' });
            await window.__chatRefreshContextPreview({ aiPersonId: ${JSON.stringify(aiId)}, mode: 'calendar' });
            const raw = localStorage.getItem(${JSON.stringify(preKey(aiId))});
            return raw ? (JSON.parse(raw).text || '') : '';
        })()
    `);
    check('关掉 murmur 组后总纲没了', !afterOff.includes('<对话总则开始>'));
    check('关掉 murmur 组后回复格式没了', !afterOff.includes('<回复格式开始>'));
    check('nook 组(人设)一点没动', afterOff.includes('<AI人设开始>'));
    check('pre 确实变短了', afterOff.length < pre.length, `${pre.length} → ${afterOff.length}`);

    const afterOn = await page.evaluate(`
        (async () => {
            const app = (window.__phoneAppsRef?.value || []).find((a) => a.id === 'chat');
            app.methods.togglePromptGroupInject({ aiPersonId: ${JSON.stringify(aiId)}, source: 'murmur' });
            await window.__chatRefreshContextPreview({ aiPersonId: ${JSON.stringify(aiId)}, mode: 'calendar' });
            const raw = localStorage.getItem(${JSON.stringify(preKey(aiId))});
            return raw ? (JSON.parse(raw).text || '') : '';
        })()
    `);
    check('再打开总闸,内容一字不差地回来了', afterOn === pre, `${afterOn.length} vs ${pre.length}`);

    console.log('\n── 页面本身 ─────────────────────────────');
    const html = await page.evaluate(`
        (async () => {
            const m = await import('/js/apps/chat-app/pages/prompt-manager-page.js');
            const app = (window.__phoneAppsRef?.value || []).find((a) => a.id === 'chat');
            return await m.renderPromptManagerPage(app, 'private-' + ${JSON.stringify(aiId)} + '-calendar');
        })()
    `);
    check('页面渲染没抛异常', typeof html === 'string' && html.length > 0, `${html.length} 字符`);
    check('折叠头上有整组开关', html.includes('pm-app-group__switch'));
    check('整组开关走的是 togglePromptGroupInject', html.includes('togglePromptGroupInject'));
    check('对话总则卡在可用区', html.includes('对话总则'));
    check('头部统计换成了「发给 AI N 段」', /发给 AI \d+ 段/.test(html));

    const errors = page.console.filter((l) => /^\[(error|exception)\]/.test(l) && !/favicon|404/.test(l));
    check('控制台没有新的报错', errors.length === 0, errors.slice(0, 3).join(' | '));

    try { proc.kill(); } catch (_) {}
}

main().then(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${'─'.repeat(44)}`);
    console.log(`共 ${results.length} 项,通过 ${results.length - failed.length},失败 ${failed.length}`);
    if (failed.length > 0) {
        failed.forEach((r) => console.log(`  ✗ ${r.label}`));
        process.exit(1);
    }
    process.exit(0);
}).catch((err) => {
    console.error('\n探针崩了:', err?.message || err);
    process.exit(1);
});
