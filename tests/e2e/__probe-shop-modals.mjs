/**
 * 四叶草 · 弹层回归（真实 Edge，走 CDP）
 *
 * 只为一件事：`SpModals` 的五个弹层**点得开**。
 *
 * 为什么单独一个脚本而不是并进 `__probe-shop.mjs`：那份跑的是完整业务流
 * （档案键、匿名送礼、AI 余额），一次两分钟；而这里要的是一条能在改完
 * `modals.js` 之后 30 秒内跑完的回归。坏掉的表现是「点了没反应」，
 * 没有任何报错，所以它必须有人专门盯着。
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-shop-modals.mjs`
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
const PORT = 9384;
const PROFILE = path.join(os.tmpdir(), `spm-probe-${Date.now()}`);
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
        throw new Error(`等待超时: ${label}`);
    }

    async shot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `spm-probe-${name}.png`);
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

const SEED = `
(async () => {
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };
    const w = await sdk.worlds.create({
        name: '雾港', summary: '一个用来跑冒烟的世界。', currencyName: '星币',
        flows: [{ id: 'flow-spm-0', title: '潮汐历', content: '潮汐历的详细设定。' }],
    });
    let user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
    if (!user) user = await sdk.users.create({ name: '阿听' });
    await sdk.users.update(user.id, { boundWorldId: w.id });
    if (sdk.defaultUserCard?.setDefault) await sdk.defaultUserCard.setDefault(user.id);
    const ai = await sdk.aiPersons.create({ name: '阿舟', boundWorldId: w.id });
    return { ok: true, worldId: w.id, userId: user.id, aiId: ai.id };
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
    const page = new Cdp(await openWs(info?.webSocketDebuggerUrl || `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`));

    await page.send('Runtime.enable');
    await page.send('Page.enable');

    try {
        console.log('\n── 启动 ─────────────────────────────────');
        await page.send('Page.navigate', { url: BASE });
        await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: 'app 注册' });
        await sleep(2000);

        const seed = await page.evaluate(SEED);
        if (!seed?.ok) throw new Error('种子数据失败：' + (seed?.error || '未知'));

        await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'shop' } }))`);
        await page.waitFor(`document.querySelector('.app-shell[data-app-id="shop"] .sp-root')`, { label: '根组件挂载' });
        await sleep(1200);

        // 走完引导（三屏，最后一步调 AI 会失败，但配置本身会存下来）
        for (let i = 0; i < 3; i++) {
            await page.evaluate(`document.querySelector('.sp-ob__actions .sp-btn--primary')?.click()`);
            await sleep(600);
        }
        await page.waitFor(`!document.querySelector('.sp-ob')`, { label: '引导结束', timeout: 40000 });
        await sleep(900);
        check('进到主界面', await page.evaluate(`!!document.querySelector('.sp-tabbar')`));

        console.log('\n── 弹层 ─────────────────────────────────');
        // 「自己加」一直挂在筛选条下面，不需要 AI 生成出东西来才点得到
        await page.evaluate(`
            (() => {
                const btns = Array.from(document.querySelectorAll('.sp-feed__bar-actions .sp-btn'));
                (btns.find(b => b.textContent.includes('自己加')) || btns[0]).click();
            })()
        `);
        await sleep(900);

        const sheet = await page.evaluate(`
            (() => {
                const el = document.querySelector('.sp-sheet');
                // 解析失败时 Vue 会把组件名当原生标签渲染出来。
                // ★ 判据用 HTMLUnknownElement，不要用「标签名以 sp 开头」——
                //   <span> 也以 sp 开头，第一版就是这么自己骗自己的
                const ghost = Array.from(document.querySelectorAll('.app-shell[data-app-id="shop"] *'))
                    .filter(e => e instanceof HTMLUnknownElement)
                    .map(e => e.tagName.toLowerCase());
                return {
                    open: !!el,
                    title: el?.querySelector('.sp-sheet__title')?.textContent.trim() || '',
                    fields: el ? el.querySelectorAll('.sp-field').length : 0,
                    ghost: [...new Set(ghost)],
                };
            })()
        `);
        check('★ 点「自己加」弹层真的升起来了', sheet.open, sheet.title || '(没出现)');
        check('★ 没有解析失败留下的空标签', sheet.ghost.length === 0, sheet.ghost.join(',') || '干净');
        check('弹层里有真实表单', sheet.fields >= 4, `${sheet.fields} 个字段`);
        await page.shot('01-add-item');

        // 填一件东西提交，确认弹层不只是「画出来了」而是真的能用
        await page.evaluate(`
            (() => {
                const setVal = (el, v) => {
                    const proto = el.tagName === 'TEXTAREA'
                        ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                };
                const s = document.querySelector('.sp-sheet');
                setVal(s.querySelectorAll('.sp-input')[0], '桧木手冲壶');
                // ★ 「详细一点」必须填：不填的话 item.detail 是 null，
                //   详情页会停在「这一份还没展开」，「改一改 / 分享」根本不渲染。
                //   那是对的行为，不是 bug —— 但探针得知道
                const areas = s.querySelectorAll('.sp-textarea');
                setVal(areas[areas.length - 1], '桧木做的，握着有点沉，倒水的时候很稳。');
            })()
        `);
        await sleep(500);
        await page.evaluate(`document.querySelector('.sp-sheet .sp-sheet__foot .sp-btn--primary')?.click()`);
        await page.waitFor(`!document.querySelector('.sp-sheet')`, { label: '弹层关闭', timeout: 15000 });
        await sleep(900);
        check('★ 提交之后东西真的加进列表了', await page.evaluate(`
            Array.from(document.querySelectorAll('.sp-feed__group')).some(g => g.textContent.includes('桧木手冲壶'))
        `));

        // 详情页的两个弹层：改一改 / 分享
        await page.evaluate(`
            (() => {
                // 卡片本体就是 <article class="sp-card" @click>，
                // 不要去点里面的 button —— 那是收藏/加购，都带 .stop
                const cards = Array.from(document.querySelectorAll('.sp-card'));
                const hit = cards.find(c => c.textContent.includes('桧木手冲壶'));
                hit?.click();
            })()
        `);
        await sleep(1200);
        const inDetail = await page.evaluate(`!!document.querySelector('.sp-detail')`);
        check('能进详情页', inDetail);

        if (inDetail) {
            for (const [label, keyword] of [['改一改', 'edit'], ['分享', 'share']]) {
                await page.evaluate(`
                    (() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const hit = btns.find(b => b.textContent.trim().includes(${JSON.stringify(label)}));
                        hit?.click();
                    })()
                `);
                await sleep(900);
                const got = await page.evaluate(`
                    (() => {
                        const el = document.querySelector('.sp-sheet');
                        const t = el?.querySelector('.sp-sheet__title')?.textContent.trim() || '';
                        if (el) document.querySelector('.sp-sheet-mask')?.click();
                        return t;
                    })()
                `);
                check(`★ 详情页「${label}」弹层能打开`, got.length > 0, got || '(没出现)');
                await sleep(600);
            }
        }

        console.log('\n── 聊天内容卡确认 ─────────────────────────');
        if (inDetail) {
            // 真正分享一次，再去 murmur 点击卡片。未确认时必须留在聊天，
            // 确认后才调用四叶草 contentCards 服务并回到详情。
            await page.evaluate(`
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    btns.find(b => b.textContent.trim().includes('分享'))?.click();
                })()
            `);
            await page.waitFor(`document.querySelector('.sp-sheet .sp-ai-pick')`, { label: '分享联系人' });
            await page.evaluate(`document.querySelector('.sp-sheet .sp-ai-pick')?.click()`);
            await page.evaluate(`document.querySelector('.sp-sheet .sp-sheet__foot .sp-btn--primary')?.click()`);
            await page.waitFor(`!document.querySelector('.sp-sheet')`, { label: '分享完成' });

            await page.evaluate(`
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'openApp', targetAppId: 'chat' },
                }));
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: 'chat', pageId: 'private-${seed.aiId}-calendar' },
                }));
            `);
            await page.waitFor(`document.querySelector('.shop-item-card')`, { label: '聊天商品卡' });

            await page.evaluate(`document.querySelector('.shop-item-card')?.click()`);
            await page.waitFor(`document.querySelector('.ac-overlay .ac-modal')`, { label: '内容卡确认窗' });
            check('★ 点购物卡先出现 AcModal 确认', await page.evaluate(`
                document.querySelector('.ac-overlay .ac-modal-title')?.textContent.includes('查看') || false
            `));
            await page.evaluate(`document.querySelector('.ac-overlay [data-lp-action="cancel"]')?.click()`);
            await sleep(500);
            check('★ 取消后仍留在 murmur，不会偷跑详情生成', await page.evaluate(`
                !!document.querySelector('.app-shell[data-app-id="chat"] .shop-item-card')
                && !document.querySelector('.ac-overlay')
            `));

            await page.evaluate(`document.querySelector('.shop-item-card')?.click()`);
            await page.waitFor(`document.querySelector('.ac-overlay [data-lp-action="ok"]')`, { label: '再次确认' });
            await page.evaluate(`document.querySelector('.ac-overlay [data-lp-action="ok"]')?.click()`);
            await page.waitFor(`
                document.querySelector('.app-shell[data-app-id="shop"] .sp-detail')
                && document.querySelector('.app-shell[data-app-id="shop"] .sp-detail').textContent.includes('桧木手冲壶')
            `, { label: '确认后回到商品详情', timeout: 20000 });
            check('★ 确认后才打开四叶草对应详情', true);
        }

        console.log('\n── 控制台 ───────────────────────────────');
        const noise = page.console.filter((l) => {
            if (!/^\[(error|exception)\]/.test(l)) return false;
            if (/API|api|apiKey|Key/.test(l)) return false;       // 没配 API 是预期内的
            if (/favicon/.test(l)) return false;
            return true;
        });
        const resolveWarn = page.console.filter((l) => /Failed to resolve component/i.test(l));
        check('没有「组件解析不出来」的警告', resolveWarn.length === 0, resolveWarn.slice(0, 2).join(' | '));
        check('控制台没有意料之外的报错', noise.length === 0, noise.slice(0, 3).join(' | '));
        if (noise.length) noise.slice(0, 8).forEach((l) => console.log('    ' + l));

    } catch (err) {
        console.log(`\n  ✗ 探针中断：${err.message}`);
        results.push({ label: `探针中断：${err.message}`, ok: false });
        const tail = page.console.filter((l) => /^\[(error|exception|warning)\]/.test(l)).slice(-10);
        if (tail.length) {
            console.log('  中断时控制台里的东西：');
            tail.forEach((l) => console.log('    ' + l));
        }
        try { await page.shot('99-crash'); } catch (_) { /* noop */ }
    } finally {
        const passed = results.filter((r) => r.ok).length;
        console.log(`\n════ ${passed} / ${results.length} 通过 ════\n`);
        if (passed < results.length) {
            console.log('没过的：');
            results.filter((r) => !r.ok).forEach((r) => console.log('  ✗ ' + r.label));
            console.log('');
        }
        try { proc.kill(); } catch (_) { /* noop */ }
        process.exit(results.some((r) => !r.ok) ? 1 : 0);
    }
}

main().catch((err) => {
    console.error('\n探针崩了：', err.message);
    process.exit(1);
});
