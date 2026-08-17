/**
 * 氧气（blog）+ 容器修复 · 真实浏览器冒烟探针
 *
 * 验证这一轮的三类修复（AGENTS2 §19）在真实渲染里成立：
 *   1. 启动零未捕获异常；App 注册齐
 *   2. 氧气打开后：底栏钉在手机屏底部、根组件左右贴满手机壳
 *   3. .app-content 对 blog / youtube / diary 的 padding 覆写生效
 *   4. 弹窗遮罩盖满整个手机屏宽度（随笔编辑弹窗）
 *
 * 跑法（两个前置进程先起好）：
 *   npm run dev                                    → :5173
 *   msedge --headless=new --remote-debugging-port=9222 --user-data-dir=<tmp>
 *   node tests/e2e/__probe-blog-smoke.mjs
 *
 * 只用 Node 22 内置的 fetch + WebSocket，零依赖。
 */

const CDP_HTTP = 'http://127.0.0.1:9222';
const PAGE_URL = 'http://localhost:5173/';

const consoleErrors = [];
let ws = null;
let msgId = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
}

async function evalJs(expression, sessionId) {
    const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
    }, sessionId);
    if (res.exceptionDetails) {
        throw new Error(`页面内执行失败: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
    }
    return res.result?.value;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(fn, label, timeoutMs = 20000, stepMs = 300) {
    const startedAt = Date.now();
    /* eslint-disable no-await-in-loop */
    while (Date.now() - startedAt < timeoutMs) {
        const ok = await fn();
        if (ok) return ok;
        await sleep(stepMs);
    }
    /* eslint-enable no-await-in-loop */
    throw new Error(`等待超时: ${label}`);
}

const results = [];
function assert(name, cond, detail = '') {
    results.push({ name, ok: !!cond, detail });
    console.log(`${cond ? 'ok  ' : 'FAIL'} - ${name}${detail ? `  (${detail})` : ''}`);
}

async function main() {
    // 1) 建 tab + 连 CDP
    const created = await fetch(`${CDP_HTTP}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
    ws = new WebSocket(created.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = () => reject(new Error('CDP WebSocket 连接失败'));
    });
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && pending.has(data.id)) {
            const { resolve, reject } = pending.get(data.id);
            pending.delete(data.id);
            if (data.error) reject(new Error(data.error.message));
            else resolve(data.result);
            return;
        }
        // 事件：收未捕获异常 + console.error
        if (data.method === 'Runtime.exceptionThrown') {
            consoleErrors.push(`[exception] ${data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text}`);
        }
        if (data.method === 'Runtime.consoleAPICalled' && data.params?.type === 'error') {
            const text = (data.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
            consoleErrors.push(`[console.error] ${text}`);
        }
    };
    await send('Runtime.enable');
    await send('Page.enable');

    // 2) 打开页面，等 App 注册完
    await send('Page.navigate', { url: PAGE_URL });
    await waitFor(
        () => evalJs(`Array.isArray(window.__phoneAppsRef?.value) && window.__phoneAppsRef.value.length >= 15`),
        'App 全部注册',
    );
    const hasBlog = await evalJs(`window.__phoneAppsRef.value.some(a => a.id === 'blog')`);
    assert('氧气（blog）已注册进桌面', hasBlog);

    // 3) 打开氧气
    await evalJs(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'blog' } })); true`);
    await waitFor(() => evalJs(`!!document.querySelector('.app-shell[data-app-id="blog"] .ox-root')`), '氧气根组件挂载');
    // ready（骨架结束：底栏出现）
    await waitFor(() => evalJs(`!!document.querySelector('.app-shell[data-app-id="blog"] .ox-tabbar')`), '氧气底栏出现');

    // ★ App 打开有缩放入场动画：等根组件的 rect 连续两帧不变再量，
    //   否则量到的是动画中途的缩小值（左右各差 15px 的假 FAIL）。
    let lastLeft = -1;
    await waitFor(async () => {
        const left = await evalJs(`document.querySelector('.app-shell[data-app-id="blog"] .ox-root').getBoundingClientRect().left`);
        const stable = Math.abs(left - lastLeft) < 0.5;
        lastLeft = left;
        return stable;
    }, '入场动画结束', 10000, 350);

    // 4) 布局断言：底栏钉底 + 左右贴满
    const layout = await evalJs(`(() => {
        const screen = document.querySelector('.phone-screen').getBoundingClientRect();
        const shellEl = document.querySelector('.app-shell[data-app-id="blog"]');
        const root = shellEl.querySelector('.ox-root').getBoundingClientRect();
        const tabbar = shellEl.querySelector('.ox-tabbar').getBoundingClientRect();
        const content = shellEl.querySelector('.app-content');
        const contentPad = getComputedStyle(content).paddingLeft;
        const stackRadius = getComputedStyle(shellEl.querySelector('.app-page-stack')).borderTopLeftRadius;
        const panel = shellEl.querySelector('.app-screen-panel');
        const panelStyle = panel ? getComputedStyle(panel) : null;
        return {
            screen: { left: screen.left, right: screen.right, bottom: screen.bottom, width: screen.width },
            root: { left: root.left, right: root.right, bottom: root.bottom, width: root.width, height: root.height },
            tabbar: { top: tabbar.top, bottom: tabbar.bottom, height: tabbar.height },
            contentPad,
            stackRadius,
            panelHeight: panelStyle ? panelStyle.height : '',
            panelPad: panelStyle ? panelStyle.paddingLeft : '',
        };
    })()`);

    const near = (a, b, tol = 2.5) => Math.abs(a - b) <= tol;
    assert('blog: .app-content 左 padding = 0', layout.contentPad === '0px', `实际 ${layout.contentPad}`);
    assert('blog: .app-page-stack 顶部圆角 = 0', layout.stackRadius === '0px', `实际 ${layout.stackRadius}`);
    assert('blog: .app-screen-panel padding = 0', layout.panelPad === '0px', `实际 ${layout.panelPad}`);
    assert('blog: 根组件左边贴住手机屏', near(layout.root.left, layout.screen.left), `root.left=${layout.root.left} screen.left=${layout.screen.left}`);
    assert('blog: 根组件右边贴住手机屏', near(layout.root.right, layout.screen.right), `root.right=${layout.root.right} screen.right=${layout.screen.right}`);
    assert('blog: 底栏钉在手机屏底部', near(layout.tabbar.bottom, layout.screen.bottom, 3), `tabbar.bottom=${layout.tabbar.bottom} screen.bottom=${layout.screen.bottom}`);
    assert('blog: 底栏在可视区内（没被内容顶出去）', layout.tabbar.top < layout.screen.bottom - 20, `tabbar.top=${layout.tabbar.top}`);
    assert('blog: 根组件高度有界（height:100% 生效）', near(layout.root.bottom, layout.screen.bottom, 3), `root.bottom=${layout.root.bottom}`);

    // 5) 弹窗遮罩盖满宽度：随笔 tab（全局功能，无需世界观）→ 写随笔弹窗
    await evalJs(`(() => {
        const tabs = [...document.querySelectorAll('.app-shell[data-app-id="blog"] .ox-tabbar__item')];
        const essays = tabs.find(t => t.textContent.includes('随笔'));
        if (essays) essays.click();
        return true;
    })()`);
    await waitFor(() => evalJs(`!!document.querySelector('.app-shell[data-app-id="blog"] .ox-essayspage')`), '随笔页出现');
    await evalJs(`document.querySelector('.app-shell[data-app-id="blog"] .ox-fab').click(); true`);
    await waitFor(() => evalJs(`!!document.querySelector('.app-shell[data-app-id="blog"] .ox-modalmask')`), '随笔弹窗出现');
    await sleep(700);   // 弹窗有 Q 弹入场动画，等它停稳再量
    const mask = await evalJs(`(() => {
        const screen = document.querySelector('.phone-screen').getBoundingClientRect();
        const m = document.querySelector('.app-shell[data-app-id="blog"] .ox-modalmask').getBoundingClientRect();
        return { mLeft: m.left, mRight: m.right, sLeft: screen.left, sRight: screen.right };
    })()`);
    assert('blog: 弹窗遮罩左边贴住手机屏', near(mask.mLeft, mask.sLeft), `mask.left=${mask.mLeft} screen.left=${mask.sLeft}`);
    assert('blog: 弹窗遮罩右边贴住手机屏', near(mask.mRight, mask.sRight), `mask.right=${mask.mRight} screen.right=${mask.sRight}`);
    // 关掉弹窗（点遮罩自身）
    await evalJs(`(() => {
        const mask = document.querySelector('.app-shell[data-app-id="blog"] .ox-modalmask');
        mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
    })()`);

    // 6) 写一篇随笔（纯本地链路：打开弹窗 → 输入 → 记下 → 列表出现）
    await evalJs(`document.querySelector('.app-shell[data-app-id="blog"] .ox-fab').click(); true`);
    await waitFor(() => evalJs(`!!document.querySelector('.app-shell[data-app-id="blog"] .ox-modal--essay textarea')`), '随笔编辑器出现');
    await evalJs(`(() => {
        const ta = document.querySelector('.app-shell[data-app-id="blog"] .ox-modal--essay textarea');
        ta.value = '探针写的第一篇随笔';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    })()`);
    await sleep(120);
    await evalJs(`(() => {
        const btns = [...document.querySelectorAll('.app-shell[data-app-id="blog"] .ox-modal--essay .ox-btn')];
        const save = btns.find(b => b.textContent.includes('记下'));
        save.click();
        return true;
    })()`);
    const essaySaved = await waitFor(
        () => evalJs(`document.body.textContent.includes('探针写的第一篇随笔')`),
        '随笔出现在页面上',
    ).then(() => true).catch(() => false);
    assert('blog: 随笔本地保存并渲染（零 AI 依赖）', essaySaved);

    // 7) youtube / diary 的容器覆写规则已加载（查 CSSOM，不依赖世界观绑定 ——
    //    萤火 requiresBoundWorld，全新档案里根本打不开）
    const overrides = await evalJs(`(() => {
        const found = { youtube: false, diary: false };
        for (const sheet of document.styleSheets) {
            let rules;
            try { rules = sheet.cssRules; } catch (_) { continue; }
            for (const rule of rules || []) {
                const sel = rule.selectorText || '';
                for (const key of Object.keys(found)) {
                    if (sel.includes('[data-app-id="' + key + '"] .app-content')
                        && rule.style && rule.style.padding === '0px') {
                        found[key] = true;
                    }
                }
            }
        }
        return found;
    })()`);
    assert('youtube: .app-content padding 覆写规则已加载', overrides.youtube);
    assert('diary: .app-content padding 覆写规则已加载', overrides.diary);

    // 8) 控制台错误盘点（预期内的失败要从噪音里排掉：没配 API / SDK 未就绪不算）
    const realErrors = consoleErrors.filter((e) => (
        !e.includes('API') && !e.includes('api') && !e.includes('Key')
        && !e.includes('favicon') && !e.includes('net::')
    ));
    assert('启动与全程无未预期的控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

    const failed = results.filter((r) => !r.ok);
    console.log(`\n===== 探针结果: ${results.length - failed.length}/${results.length} 通过 =====`);
    if (consoleErrors.length) {
        console.log('（全部控制台错误，含预期内的）:');
        for (const e of consoleErrors.slice(0, 10)) console.log('  ' + e.slice(0, 200));
    }
    process.exitCode = failed.length ? 1 : 0;
}

main().catch((err) => {
    console.error('探针跑挂了（不是断言失败，是流程异常）:', err);
    process.exitCode = 1;
}).finally(() => {
    try { ws?.close(); } catch (_) { /* noop */ }
    setTimeout(() => process.exit(process.exitCode ?? 1), 300);
});
