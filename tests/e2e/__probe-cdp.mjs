/**
 * 桌面布局端到端测试（真实浏览器，走 CDP）
 *
 * 为什么不用 --virtual-time-budget --dump-dom：
 *   虚拟时间会把 setTimeout 快进，但 IndexedDB 的回调是真实异步的，
 *   预算耗尽时浏览器直接退出，app 注册链（一串 await registerPhoneAppAsync）
 *   永远跑不完 —— 测出来的桌面永远是空的。
 *   CDP 可以真实等待，还能把页面 console 抓回来。
 *
 * 用法：node tests/e2e/__probe-cdp.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:5173';
const PORT = 9333;
const PROFILE = path.join(os.tmpdir(), `xt-probe-${Date.now()}`);

const CONFIG_KEY = 'xiaoting::desktop-config-v1';
const SAVED_APP_ORDER = ['appstore', 'chat', 'music', 'settings', 'weather-app', 'prompt-survey'];
const SAVED_WIDGETS = [
    { instanceId: 'probe-w1', qualifiedId: 'weather-app::forecast', size: 'M', boardIndex: 1 },
    { instanceId: 'probe-w2', qualifiedId: 'music::now-playing', size: 'S', orientation: 'h', boardIndex: 4 },
];

function expectedBoard() {
    const items = SAVED_APP_ORDER.map(id => `app::${id}`);
    for (const w of [...SAVED_WIDGETS].sort((a, b) => a.boardIndex - b.boardIndex)) {
        items.splice(Math.min(w.boardIndex, items.length), 0, `widget::${w.qualifiedId}::${w.instanceId}`);
    }
    return items;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- CDP 客户端 ----------
class Cdp {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.pending = new Map();
        this.console = [];
        ws.addEventListener('message', ev => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
                return;
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
                const text = (msg.params.args || [])
                    .map(a => a.value ?? a.description ?? a.unserializableValue ?? '')
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
        const res = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (res.exceptionDetails) {
            throw new Error('页面内报错: ' + JSON.stringify(res.exceptionDetails.exception?.description || res.exceptionDetails.text));
        }
        return res.result.value;
    }

    async navigate(url) {
        await this.send('Page.navigate', { url });
    }

    // 复刻桌面的长按拖拽（长按 460ms 进编辑模式，位移超 10px 才算拖动）。
    //
    // 用页面内合成 PointerEvent 而不是 Input.dispatchMouseEvent：桌面把
    // pointermove/pointerup 都绑在源 .appTouch 上，靠 setPointerCapture 把后续事件
    // 拉回源元素。合成事件没有 active pointer，capture 拿不到，所以这里手动把
    // 所有事件都派发回源元素，只改 clientX/clientY —— 等价于 capture 的效果。
    async dragIcon(sourceIndex, targetIndex) {
        return this.evaluate(`(async () => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const origSet = Element.prototype.setPointerCapture;
            const origRelease = Element.prototype.releasePointerCapture;
            // 合成事件调用原生 setPointerCapture 会抛 NotFoundError，直接打断 handler
            Element.prototype.setPointerCapture = function () {};
            Element.prototype.releasePointerCapture = function () {};
            try {
                const els = Array.from(document.querySelectorAll('.currentPage .desktop-grid .appTouch'));
                const src = els[${sourceIndex}];
                const dst = els[${targetIndex}];
                if (!src || !dst) return { error: 'source/target 不存在' };

                const sr = src.getBoundingClientRect();
                const dr = dst.getBoundingClientRect();
                const from = { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 };
                const to = { x: dr.left + dr.width / 2, y: dr.top + dr.height / 2 };

                const fire = (type, x, y) => src.dispatchEvent(new PointerEvent(type, {
                    bubbles: true, cancelable: true, composed: true,
                    pointerId: 1, pointerType: 'touch', isPrimary: true,
                    clientX: x, clientY: y, button: 0,
                    buttons: type === 'pointerup' ? 0 : 1,
                }));

                fire('pointerdown', from.x, from.y);
                await sleep(700);
                const editModeEntered = !!document.querySelector('.appContainer.editing');

                const steps = 16;
                for (let i = 1; i <= steps; i++) {
                    fire('pointermove',
                        from.x + (to.x - from.x) * i / steps,
                        from.y + (to.y - from.y) * i / steps);
                    await sleep(50);
                }
                await sleep(400);
                fire('pointerup', to.x, to.y);
                await sleep(1200);

                return { editModeEntered, from, to, sourceId: src.dataset.itemId, targetId: dst.dataset.itemId };
            } finally {
                Element.prototype.setPointerCapture = origSet;
                Element.prototype.releasePointerCapture = origRelease;
            }
        })()`);
    }
}

async function connect() {
    for (let i = 0; i < 60; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            const targets = await res.json();
            const page = targets.find(t => t.type === 'page');
            if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch {
            // 浏览器还没起来
        }
        await sleep(500);
    }
    throw new Error('连不上 CDP');
}

// ---------- 主流程 ----------
const edge = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
], { stdio: 'ignore' });

const failures = [];
let cdp;

try {
    const wsUrl = await connect();
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
    });
    cdp = new Cdp(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('='.repeat(64));
    console.log('  桌面布局端到端测试（真实浏览器 / CDP）');
    console.log('='.repeat(64));

    // --- 1. 预置「上次保存的布局」---
    // 用 addScriptToEvaluateOnNewDocument：它在页面自己的脚本之前跑，
    // 保证应用启动读配置时读到的就是我们预置的布局。
    // 种下之后立刻移除，后面拖拽 + reload 才不会被重新种一遍。
    console.log('\n[1/3] 预置上次保存的布局');
    const seedConfig = {
        version: 1,
        grid: { rows: 4, columns: 4 },
        pages: [{ id: 'home', label: '主屏', apps: SAVED_APP_ORDER }],
        widgets: SAVED_WIDGETS,
    };
    const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `(() => {
            const key = ${JSON.stringify(CONFIG_KEY)};
            const seed = ${JSON.stringify(seedConfig)};
            const prev = JSON.parse(localStorage.getItem(key) || '{}');
            localStorage.setItem(key, JSON.stringify({ ...prev, ...seed }));
        })()`,
    });
    console.log('   apps    : ' + JSON.stringify(SAVED_APP_ORDER));
    console.log('   widgets : ' + JSON.stringify(SAVED_WIDGETS.map(w => `${w.instanceId}@${w.boardIndex}`)));
    console.log('   期望桌面: ' + JSON.stringify(expectedBoard()));

    // --- 2. 真实加载主页面，等 app 注册 + 桌面水合跑完 ---
    console.log('\n[2/3] 加载主页面，等待启动完成');
    cdp.console.length = 0;
    await cdp.navigate(`${BASE}/?probe=1`);
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });

    let booted = false;
    for (let i = 0; i < 60; i++) {
        await sleep(1000);
        const status = await cdp.evaluate(`(() => {
            const apps = window.__phoneAppsRef?.value?.length || 0;
            const icons = document.querySelectorAll('.currentPage .desktop-grid .appTouch').length;
            return { apps, icons };
        })()`).catch(() => null);
        if (status?.apps > 0 && status.icons > 0) {
            console.log(`   启动完成（${i + 1}s）：${status.apps} 个 app，${status.icons} 个桌面项`);
            booted = true;
            break;
        }
    }
    if (!booted) {
        console.log('   ⚠ 等待 60s 后 app 仍未注册出来');
        failures.push('boot');
    }

    // 再多等一会，让水合门闸开闸 + flushBoardLayout 落盘
    await sleep(6000);

    const rendered = await cdp.evaluate(`
        Array.from(document.querySelectorAll('.currentPage .desktop-grid .appTouch'))
             .map(el => el.dataset.itemId)
    `);

    console.log('\n   桌面实际渲染顺序:');
    rendered.forEach((id, i) => console.log(`   ${String(i).padStart(2)}: ${id}`));

    const expected = expectedBoard();
    const subset = rendered.filter(id => expected.includes(id));
    const renderOk = JSON.stringify(subset) === JSON.stringify(expected);
    console.log('\n   ' + (renderOk ? '✅ 渲染顺序与上次保存一致' : '❌ 渲染顺序与上次保存不一致'));
    if (!renderOk) {
        console.log('      期望: ' + JSON.stringify(expected));
        console.log('      实际: ' + JSON.stringify(subset));
        failures.push('render-order');
    }

    // --- 3. 落盘结果 ---
    console.log('\n[3/3] 启动后落盘的结果');
    const stored = await cdp.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(CONFIG_KEY)}) || '{}')`);
    const storedApps = stored.pages?.[0]?.apps || [];
    const storedWidgets = (stored.widgets || []).map(w => `${w.instanceId}@${w.boardIndex}`).sort();
    const expectWidgets = SAVED_WIDGETS.map(w => `${w.instanceId}@${w.boardIndex}`).sort();
    const appsKept = JSON.stringify(storedApps.filter(id => SAVED_APP_ORDER.includes(id))) === JSON.stringify(SAVED_APP_ORDER);
    const widgetsKept = JSON.stringify(storedWidgets) === JSON.stringify(expectWidgets);

    console.log('   storedApps    : ' + JSON.stringify(storedApps));
    console.log('   storedWidgets : ' + JSON.stringify(storedWidgets));
    console.log('   ' + (appsKept ? '✅ app 顺序保持不变' : '❌ app 顺序被改写'));
    console.log('   ' + (widgetsKept ? '✅ widget 位置保持不变' : '❌ widget 位置被改写'));
    if (!appsKept) failures.push('stored-apps');
    if (!widgetsKept) failures.push('stored-widgets');

    // --- 4. 真实拖拽后刷新 ---
    console.log('\n[4/4] 长按拖拽 → 刷新，验证顺序是否保住');
    if (rendered.length < 4) {
        console.log('   ⚠ 桌面项不足，跳过拖拽验证');
        failures.push('drag-setup');
    } else {
        // 把第 4 项拖到第 1 项的位置
        const drag = await cdp.dragIcon(3, 0);
        console.log(`   拖动 ${drag.sourceId}  →  ${drag.targetId} 的位置` +
            `（进入编辑模式: ${drag.editModeEntered}）`);

        const afterDrag = await cdp.evaluate(`
            Array.from(document.querySelectorAll('.currentPage .desktop-grid .appTouch'))
                 .map(el => el.dataset.itemId)
        `);
        console.log('   拖拽后: ' + JSON.stringify(afterDrag));

        if (JSON.stringify(afterDrag) === JSON.stringify(rendered)) {
            console.log('   ⚠ 拖拽没有改变顺序（长按/拖动可能没被识别），跳过刷新对比');
            failures.push('drag-noop');
        } else {
            await sleep(1500);
            await cdp.navigate(`${BASE}/?probe=1`);

            let reloaded = [];
            for (let i = 0; i < 60; i++) {
                await sleep(1000);
                reloaded = await cdp.evaluate(`
                    Array.from(document.querySelectorAll('.currentPage .desktop-grid .appTouch'))
                         .map(el => el.dataset.itemId)
                `).catch(() => []);
                if (reloaded.length >= afterDrag.length) break;
            }
            await sleep(4000);
            reloaded = await cdp.evaluate(`
                Array.from(document.querySelectorAll('.currentPage .desktop-grid .appTouch'))
                     .map(el => el.dataset.itemId)
            `);
            console.log('   刷新后: ' + JSON.stringify(reloaded));

            const dragKept = JSON.stringify(reloaded) === JSON.stringify(afterDrag);
            console.log('   ' + (dragKept ? '✅ 刷新后与拖拽结果一致' : '❌ 刷新后与拖拽结果不一致'));
            if (!dragKept) failures.push('drag-persist');
        }
    }

    // 相关日志
    const interesting = cdp.console.filter(l =>
        /desktop|widget|hydration|boot|apps-registered|注册|水合|顺序/i.test(l));
    if (interesting.length) {
        console.log('\n-- 页面日志（桌面相关）--');
        interesting.slice(0, 40).forEach(l => console.log('   ' + l));
    }
    fs.writeFileSync(path.join(ROOT, '__probe-console.log'), cdp.console.join('\n'), 'utf8');
    console.log('\n   完整日志: __probe-console.log');
} catch (err) {
    console.error('\n测试出错: ' + err.message);
    if (cdp?.console?.length) {
        fs.writeFileSync(path.join(ROOT, '__probe-console.log'), cdp.console.join('\n'), 'utf8');
        console.error('页面日志已写入 __probe-console.log');
    }
    failures.push('error');
} finally {
    edge.kill();
    await sleep(500);
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}

console.log('\n' + '='.repeat(64));
console.log(failures.length ? `  ❌ FAIL: ${failures.join(', ')}` : '  ✅ PASS');
console.log('='.repeat(64));
process.exit(failures.length ? 1 : 0);
