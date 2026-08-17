/**
 * 四叶草购物 · 浏览器冒烟（真实 Edge，走 CDP）
 *
 * 这里只查**纯静态检查抓不到**的那几类：
 *
 *   1. 控制台没有 error / exception —— 这次动了 chat-app 的模块链接
 *      （share-cards / message-renderer / ai-service），任何一处 import 挂掉
 *      就是整个 murmur 起不来。这条断言的价值不比任何功能断言低。
 *   2. **CSS 真的加载了** —— 新增的 `css/apps/shop/*` 忘了在 `index.html`
 *      加 link、或者 `?v=` 没加一，表现都是「代码改了页面纹丝不动」，
 *      只有断言 computed style 能抓到。
 *   3. **主题 token 真的生效** —— 读 `--sp-primary`，再切到夜樱看它变没变。
 *      JS 里定义了变量 ≠ 换得动主题。
 *   4. **档案键真的在分档** —— 造两个世界观，切过去应该要求重新配置，
 *      切回来数据应该还在。这是这个 App 最核心的行为，而它完全无法静态验证。
 *   5. 没有被撑爆的 SVG（不带 width/height 的内联图标会被画成 300×150）。
 *   6. 跨 App 的三个挂载点在不在：`__shopContext` / `__shopGift` /
 *      murmur 折叠区里的三条 prompt。
 *
 * ★ 不测 AI 生成 —— 那要真的烧 token，而且结果不可复现。
 *   生成链路的正确性靠 prompt-builder 是纯函数这一点来保证。
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-shop.mjs`
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
const PORT = 9361;
const PROFILE = path.join(os.tmpdir(), `sp-probe-${Date.now()}`);
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
        const file = path.join(ROOT, `sp-probe-${name}.png`);
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

/** 造两个世界观 + 把默认用户绑到第一个，返回两个 world id */
const SEED = `
(async () => {
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };

    const mk = async (name, currency, clips) => {
        const w = await sdk.worlds.create({
            name, summary: name + '：一个用来跑冒烟的世界。',
            currencyName: currency,
            flows: clips.map((c, i) => ({ id: 'flow-probe-' + name + '-' + i, title: c, content: c + '的详细设定。' })),
        });
        return w.id;
    };

    const a = await mk('雾港', '星币', ['潮汐历', '船帮']);
    const b = await mk('麦田', '铜片', ['农时']);

    let user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
    if (!user) user = await sdk.users.create({ name: '阿听' });
    await sdk.users.update(user.id, { boundWorldId: a });
    if (sdk.defaultUserCard?.setDefault) await sdk.defaultUserCard.setDefault(user.id);

    return { ok: true, worldA: a, worldB: b, userId: user.id };
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

    console.log('\n── 启动 ─────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: 'app 注册' });
    await sleep(1800);

    check('四叶草已注册', await page.evaluate(`(window.__phoneAppsRef.value || []).some(a => a.id === 'shop')`));
    check('setup 挂了送礼桥 __shopGift', await page.evaluate(`typeof window.__shopGift?.aiGiftToUser === 'function'`));
    check('setup 挂了实时上下文 __shopContext', await page.evaluate(`typeof window.__shopContext?.getContext === 'function'`));

    // 没配置时 getContext 必须返回空串，不能返回半截东西
    check('没配置时上下文是空的', await page.evaluate(`window.__shopContext.getContext('ai0') === ''`));

    console.log('\n── 造世界观 ─────────────────────────────');
    const seed = await page.evaluate(SEED);
    if (!seed?.ok) throw new Error('种子数据失败：' + (seed?.error || '未知'));
    console.log(`  worldA=${seed.worldA} worldB=${seed.worldB} user=${seed.userId}`);

    console.log('\n── 打开四叶草 ───────────────────────────');
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'shop' } }))`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="shop"] .sp-root')`, { label: '根组件挂载' });
    await sleep(1200);

    // 首配门闸：从没配过 → 必须是引导页，不能直接进列表
    check('首次进入走引导页', await page.evaluate(`!!document.querySelector('.sp-ob')`));

    const ob = await page.evaluate(`
        (() => {
            const pills = Array.from(document.querySelectorAll('.sp-ob__pill-v')).map(e => e.textContent.trim());
            const title = document.querySelector('.sp-ob__title')?.textContent.trim() || '';
            return { pills, title };
        })()
    `);
    check('引导页把世界观和货币摆出来了', ob.pills.includes('雾港') && ob.pills.includes('星币'), ob.pills.join(' / '));

    // CSS 真的加载了：--sp-primary 有值，而且 .sp-ob__title 的字号是我们写的 25px
    const css = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="shop"]');
            const cs = getComputedStyle(shell);
            const t = document.querySelector('.sp-ob__title');
            return {
                primary: cs.getPropertyValue('--sp-primary').trim(),
                bg: cs.getPropertyValue('--sp-bg').trim(),
                titleSize: t ? getComputedStyle(t).fontSize : '',
            };
        })()
    `);
    check('主题 token 生效（--sp-primary）', /^#6E9C7C$/i.test(css.primary), css.primary || '(空)');
    check('样式表真的加载了（不是拿的缓存）', css.titleSize === '25px', `title font-size=${css.titleSize}`);

    await page.shot('01-onboarding');

    console.log('\n── 走完引导 ─────────────────────────────');
    // 第 1 屏：夹子。点第一个夹子再继续
    await page.evaluate(`document.querySelectorAll('.sp-ob__actions .sp-btn--primary')[0].click()`);
    await sleep(500);
    const clipCount = await page.evaluate(`document.querySelectorAll('.sp-ob__card').length`);
    check('第 2 屏列出了这个世界观的夹子', clipCount === 2, `${clipCount} 个`);
    await page.evaluate(`document.querySelector('.sp-ob__card')?.click()`);
    await sleep(200);
    check('夹子能选中', await page.evaluate(`!!document.querySelector('.sp-ob__card.is-on')`));

    // 第 2 屏 → 第 3 屏 → 开始生成。
    // ★ 这里会真的调 AI。冒烟环境多半没配 API，那就会失败 ——
    //   而我们要断言的恰恰是「失败之后不会把用户退回引导页」。
    await page.evaluate(`document.querySelectorAll('.sp-ob__actions .sp-btn--primary')[0].click()`);
    await sleep(400);
    await page.evaluate(`document.querySelectorAll('.sp-ob__actions .sp-btn--primary')[0].click()`);
    await page.waitFor(`!document.querySelector('.sp-ob')`, { label: '引导结束', timeout: 40000 });
    await sleep(800);

    check('配完之后进主界面（生成失败也不退回引导）', await page.evaluate(`!!document.querySelector('.sp-tabbar')`));
    check('底栏是 4 个 tab', await page.evaluate(`document.querySelectorAll('.sp-tabbar__item').length === 4`));

    // 配完了，实时上下文应该活了
    check('配完后 __shopContext 报 ready', await page.evaluate(`window.__shopContext.isActive() === true`));

    await page.shot('02-market');

    console.log('\n── 心愿单 → 实时上下文 ──────────────────');
    await page.evaluate(`
        (() => {
            const tabs = document.querySelectorAll('.sp-tabbar__item');
            tabs[3].click();
        })()
    `);
    await sleep(600);
    await page.evaluate(`
        (() => {
            const rows = Array.from(document.querySelectorAll('.sp-entry__label'));
            const hit = rows.find(e => e.textContent.trim().startsWith('心愿单'));
            hit.closest('.sp-entry').click();
        })()
    `);
    await page.waitFor(`document.querySelector('.sp-wish-add')`, { label: '心愿单页' });
    await sleep(400);

    await page.evaluate(`
        (() => {
            const set = (el, v) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, v);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            };
            const inputs = document.querySelectorAll('.sp-wish-add .sp-input');
            set(inputs[0], '羊毛围巾');
            set(inputs[1], '80');
            document.querySelector('.sp-wish-add .sp-btn--primary').click();
        })()
    `);
    await sleep(600);
    check('心愿单加进去了', await page.evaluate(`document.querySelectorAll('.sp-wish').length === 1`));

    const ctxA = await page.evaluate(`window.__shopContext.getContext('ai-probe-a')`);
    check('实时上下文里出现了这条心愿', ctxA.includes('羊毛围巾'), ctxA.split('\n').find((l) => l.includes('羊毛围巾'))?.trim() || '');
    check('对没买过的 AI 说「你还没买过」', ctxA.includes('还没有给'));
    check('上下文带了货币名（来自世界观）', ctxA.includes('星币'));

    console.log('\n── 匿名送礼：AI 之间不互通 ──────────────');
    // 直接走 gift bridge —— 这正是 murmur 里 [匿名送礼:] 会走的那条路
    const gift = await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            const ai = sdk.aiPersons.list()[0];
            if (!ai) return { ok: false, error: '没有 AI 人设' };
            // 先给它一笔钱，否则会因为余额不足而拒绝（那也是对的行为，但这里要测另一条）
            await sdk.persona.asset.adjust(500, '冒烟测试', 'ai', ai.id);
            const res = await window.__shopGift.aiGiftToUser({
                aiPersonId: ai.id, name: '羊毛围巾', price: 80,
                message: '天冷了', anonymous: true,
            });
            return { ...res, aiId: ai.id, balance: window.__shopGift.aiBalance(ai.id) };
        })()
    `);
    check('AI 匿名送礼成功', gift.ok === true, gift.error || '');
    check('AI 的余额真的被扣了', gift.balance === 420, `余额 ${gift.balance}`);

    await sleep(900);
    const ctxBuyer = await page.evaluate(`window.__shopContext.getContext(${JSON.stringify(gift.aiId)})`);
    const ctxOther = await page.evaluate(`window.__shopContext.getContext('ai-probe-other')`);
    check('买的那个 AI 自己记得（匿名也记得）', ctxBuyer.includes('匿名') && ctxBuyer.includes('羊毛围巾'));
    check('别的 AI 完全不知道有人买过', !ctxOther.includes('羊毛围巾') && ctxOther.includes('还没有给'));

    console.log('\n── 换主题 ───────────────────────────────');
    const themed = await page.evaluate(`
        (async () => {
            const root = document.querySelector('.app-shell[data-app-id="shop"] .sp-root');
            const before = getComputedStyle(root).getPropertyValue('--sp-bg').trim();
            // 走真实 UI 路径拿不到（要点进配色页再点卡片），这里直接调 store 的 mutator。
            // ⚠️ 不能 import store —— dev server 的 ?t= 会让 import() 拿到另一个模块实例。
            // 所以从已经挂在页面上的组件那条路走：点「我的 → 配色 → 夜樱」。
            return { before };
        })()
    `);
    await page.evaluate(`
        (() => {
            document.querySelectorAll('.sp-tabbar__item')[3].click();
        })()
    `);
    await sleep(500);
    await page.evaluate(`
        (() => {
            const rows = Array.from(document.querySelectorAll('.sp-entry__label'));
            rows.find(e => e.textContent.trim().startsWith('配色')).closest('.sp-entry').click();
        })()
    `);
    await page.waitFor(`document.querySelector('.sp-theme-picks')`, { label: '配色页' });
    await sleep(400);
    await page.evaluate(`document.querySelectorAll('.sp-theme-pick')[1].click()`);
    await sleep(700);

    const after = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="shop"] .sp-root');
            return {
                attr: root.getAttribute('data-sp-theme'),
                bg: getComputedStyle(root).getPropertyValue('--sp-bg').trim(),
            };
        })()
    `);
    check('切到夜樱主题', after.attr === 'dusk', `data-sp-theme=${after.attr}`);
    check('底色真的跟着变了', after.bg !== themed.before && /1A1D1B/i.test(after.bg), `${themed.before} → ${after.bg}`);
    await page.shot('03-dusk');

    console.log('\n── 单个改色 + 批量覆盖 ──────────────────');
    await page.evaluate(`
        (() => {
            const set = (el, v) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                setter.call(el, v);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            };
            const ta = document.querySelector('.sp-panel__body textarea.sp-textarea');
            set(ta, '--sp-primary: #ff00aa;\\n--dw-bg: #123456;\\n乱七八糟的一行');
            const btns = Array.from(document.querySelectorAll('.sp-batch__actions .sp-btn'));
            btns.find(b => b.textContent.includes('解析并应用')).click();
        })()
    `);
    await sleep(600);
    const batch = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="shop"] .sp-root');
            const notes = Array.from(document.querySelectorAll('.sp-panel__note')).map(e => e.textContent.trim());
            return {
                primary: getComputedStyle(root).getPropertyValue('--sp-primary').trim(),
                msg: notes.find(t => t.includes('应用了')) || '',
            };
        })()
    `);
    check('批量配色应用成功', /ff00aa/i.test(batch.primary), batch.primary);
    check('不认识的变量跳过而不是整段失败', batch.msg.includes('跳过'), batch.msg);

    console.log('\n── 档案键：换世界观要重配，换回来数据还在 ──');
    const swap = await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            const u = sdk.defaultUserCard.getDefault();
            await sdk.users.update(u.id, { boundWorldId: ${JSON.stringify(seed.worldB)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'shop' } }));
            return true;
        })()
    `);
    await sleep(1600);
    check('换到另一个世界观 → 回到引导页', await page.evaluate(`!!document.querySelector('.sp-ob')`));
    const obB = await page.evaluate(`Array.from(document.querySelectorAll('.sp-ob__pill-v')).map(e => e.textContent.trim())`);
    check('引导页读到的是新世界观的货币', obB.includes('麦田') && obB.includes('铜片'), obB.join(' / '));
    await page.shot('04-switched');

    await page.evaluate(`
        (async () => {
            const sdk = window.settingsSdk;
            const u = sdk.defaultUserCard.getDefault();
            await sdk.users.update(u.id, { boundWorldId: ${JSON.stringify(seed.worldA)} });
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: 'shop' } }));
        })()
    `);
    await sleep(1600);
    check('换回来 → 不再要求配置', await page.evaluate(`!document.querySelector('.sp-ob')`));
    // 心愿单那条已经被送礼标成完成了，所以「还在」的判据是：
    // 买的那个 AI 依然记得自己匿名送过它
    const backCtx = await page.evaluate(`window.__shopContext.getContext(${JSON.stringify(gift.aiId)})`);
    check('换回来 → 心愿单和送礼记录都还在', backCtx.includes('羊毛围巾') && backCtx.includes('匿名'));
    const restored = await page.evaluate(`
        (() => {
            const root = document.querySelector('.app-shell[data-app-id="shop"] .sp-root');
            return {
                theme: root.getAttribute('data-sp-theme'),
                primary: getComputedStyle(root).getPropertyValue('--sp-primary').trim(),
            };
        })()
    `);
    check('换回来 → 连自定义配色都恢复了', /ff00aa/i.test(restored.primary), `${restored.theme} / ${restored.primary}`);
    await page.shot('05-restored');

    console.log('\n── murmur 集成 ──────────────────────────');
    const prompts = await page.evaluate(`
        (() => {
            const list = window.settingsSdk?.appPrompts?.listByApp?.('shop') || [];
            return list.map(p => p.promptId || p.id);
        })()
    `);
    check('三条 prompt 注册到 murmur 折叠区', prompts.length === 3, prompts.join(' / '));

    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'chat' } }))`);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="chat"]')`, { label: 'murmur 打开' });
    await sleep(1200);

    // 礼物卡的样式在不在：把卡片结构塞进 chat shell 量一遍。
    // 作用域前缀是 .app-shell[data-app-id="chat"]，必须挂在 shell 里才吃得到样式
    const card = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="chat"]');
            const host = document.createElement('div');
            host.id = '__sp_card_probe';
            host.innerHTML = '<div class="shop-gift-card is-in"><div class="shop-gift-ribbon"></div>'
                + '<div class="shop-gift-who">有人送你</div><div class="shop-gift-name">羊毛围巾</div></div>'
                + '<div class="shop-item-card"><div class="shop-card-kind">商品</div></div>';
            shell.appendChild(host);
            const gift = host.querySelector('.shop-gift-card');
            const ribbon = host.querySelector('.shop-gift-ribbon');
            const out = {
                w: Math.round(gift.getBoundingClientRect().width),
                radius: getComputedStyle(gift).borderRadius,
                ribbonH: Math.round(ribbon.getBoundingClientRect().height),
                kindBg: getComputedStyle(host.querySelector('.shop-card-kind')).backgroundColor,
            };
            host.remove();
            return out;
        })()
    `);
    check('_chat-shop-card.css 已加载', out13(card.radius) && card.w === 232, `w=${card.w} radius=${card.radius}`);
    check('礼物卡的丝带画出来了', card.ribbonH === 4, `${card.ribbonH}px`);

    console.log('\n── 全局体检 ─────────────────────────────');
    const svg = await page.evaluate(`
        (() => {
            const bad = [];
            document.querySelectorAll('.app-shell svg').forEach((s) => {
                const w = s.getBoundingClientRect().width;
                if (w > 60) bad.push((s.getAttribute('class') || s.parentElement?.className || '?') + ':' + Math.round(w));
            });
            return bad.slice(0, 6);
        })()
    `);
    check('没有被撑爆的 SVG', svg.length === 0, svg.join(', '));

    const noise = page.console.filter((l) => /^\[(error|exception)\]/.test(l));
    // 冒烟环境没配 API，「还没有可用的 API Key」是**预期内**的失败，不算噪音
    const real = noise.filter((l) => !/API|api/.test(l));
    check('控制台没有 error / exception', real.length === 0, real.slice(0, 4).join(' | '));
    if (noise.length && real.length === 0) {
        console.log(`    （忽略了 ${noise.length} 条 API 相关的预期失败）`);
    }

    console.log('\n────────────────────────────────────────');
    const bad = results.filter((r) => !r.ok);
    console.log(`${results.length - bad.length}/${results.length} 通过`);
    if (bad.length) {
        console.log('\n没过的：');
        bad.forEach((b) => console.log('  ✗ ' + b.label));
    }

    proc.kill();
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) { /* 占用中，下次开机自己清 */ }
    process.exit(bad.length ? 1 : 0);
}

/** border-radius 是不是 13px（礼物卡那条规则）*/
function out13(radius) {
    return String(radius).startsWith('13');
}

main().catch((err) => {
    console.error('\n探针挂了：', err.message);
    process.exit(1);
});
