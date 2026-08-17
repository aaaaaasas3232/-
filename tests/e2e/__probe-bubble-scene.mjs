/**
 * 气泡机 + 情景剧场 端到端冒烟
 *
 * 这两个 App 的大部分风险都是「build 和 lint 全绿,只在浏览器里才炸」那一类:
 *   - vue 模式框架不会自动 hydrate,忘了在 mounted 里踢 → 永远转圈
 *   - 弹窗在 MODAL_COMPONENTS 里登记了但 root 的分发处漏了一行 → 点了没反应
 *   - `Vue.reactive` 的 Proxy 直接写 IndexedDB → DataCloneError
 *   - 主题探针 div 匹配不上 → 四张配色卡全显示成当前主题
 *   - 跨 App service 拿不到东西 → 静默返回 null
 *
 * 所以断言集中在这几处,外加 SVG 消毒(那是安全线)和正则引擎(那是核心)。
 *
 * 用法:先 `npm run dev`,再
 *   node --experimental-loader ./__loader-alias.mjs tests/e2e/__probe-bubble-scene.mjs
 * (bubble-style.js 里有 `@/` 别名,Node 不认识,得挂 resolve 钩子)
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
const PROFILE = path.join(os.tmpdir(), `bs-probe-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok, detail });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ============================================================
// CDP
// ============================================================

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
    async waitFor(expression, { timeout = 20000, label = expression } = {}) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            try {
                if (await this.evaluate(`(() => { try { return !!(${expression}); } catch (_) { return false; } })()`)) return true;
            } catch (_) { /* 可能正在导航 */ }
            await sleep(250);
        }
        const noise = this.console.filter((l) => /^\[(error|exception)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时,控制台里有这些:`);
            noise.slice(-8).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }
    async screenshot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `bs-probe-${name}.png`);
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

// ============================================================
// 主流程
// ============================================================

const BM = '.app-shell[data-app-id="bubble-maker"]';
const SP = '.app-shell[data-app-id="scene-play"]';

async function run() {
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
    await sleep(1500);

    const registered = await page.evaluate(`
        (() => {
            const ids = (window.__phoneAppsRef?.value || []).map(a => a.id);
            return { bubble: ids.includes('bubble-maker'), scene: ids.includes('scene-play') };
        })()
    `);
    check('气泡机注册进桌面了', registered.bubble);
    check('情景剧场注册进桌面了', registered.scene);

    // ============================================================
    // 气泡机
    // ============================================================
    console.log('\n── 气泡机:打开与初始化 ──────────────────');
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'bubble-maker' } }))`);
    await page.waitFor(`document.querySelector('${BM} .bb-root')`, { label: '气泡机根节点' });
    // ★ hydrate 没被踢的话这里会永远转圈 —— vue 模式框架不会自动调
    await page.waitFor(`document.querySelector('${BM} .bb-tabs')`, { label: '气泡机 hydrate 完成' });
    await sleep(900);

    const seeded = await page.evaluate(`
        (async () => {
            const rows = await window.myDb.getAllRecords('bbBubbles');
            return { count: rows.length, first: rows[0]?.name || '', hasTail: (rows[0]?.tails || []).length >= 0 };
        })()
    `);
    check('首次进来灌了内置气泡', seeded.count >= 6, `${seeded.count} 个`);
    // ★ Proxy 写 IndexedDB 会抛 DataCloneError,读得回来就说明 toPlain 起作用了
    check('气泡真的落盘了(没被 DataCloneError 挡掉)', Boolean(seeded.first), seeded.first);

    const preview = await page.evaluate(`
        (() => {
            const box = document.querySelector('${BM} .bb-preview-stage .bubble-view-box');
            if (!box) return { ok: false };
            const cs = getComputedStyle(box);
            return {
                ok: true,
                radius: cs.borderRadius,
                bg: cs.backgroundColor,
                tails: document.querySelectorAll('${BM} .bb-preview-stage .bubble-view-tail').length,
            };
        })()
    `);
    check('预览台画出了气泡', preview.ok);
    // 四角不同 = 走的是 bubbleBoxStyle 的 inline style,不是 CSS 默认值
    check('气泡的四角圆角来自配置', /\d+px \d+px/.test(preview.radius || ''), preview.radius);

    // ★ 尾巴的颜色默认跟随气泡底色,所以「压在气泡里面」和「没有尾巴」
    //   看起来一模一样 —— 只能靠几何位置断言。内置预设第一版就是全压在里面的。
    const tail = await page.evaluate(`
        (() => {
            const row = document.querySelector('${BM} .bb-preview-row:not(.is-dim)');
            const box = row?.querySelector('.bubble-view-box');
            const t = row?.querySelector('.bubble-view-tail');
            if (!box || !t) return { has: false };
            const b = box.getBoundingClientRect();
            const r = t.getBoundingClientRect();
            return {
                has: true,
                w: Math.round(r.width),
                // 往任意一边探出气泡多少像素
                out: Math.round(Math.max(r.right - b.right, b.left - r.left, r.bottom - b.bottom, b.top - r.top)),
            };
        })()
    `);
    check('气泡带着尾巴', tail.has);
    check('★ 尾巴真的探出气泡外(不是压在里面看不见)', tail.out >= 4, `探出 ${tail.out}px,尾巴宽 ${tail.w}px`);

    await page.screenshot('01-bubble-design');

    console.log('\n── 气泡机:改一个值会不会真落盘 ──────────');
    const edited = await page.evaluate(`
        (async () => {
            // 展开「形状与间距」,拖圆角滑块
            const heads = [...document.querySelectorAll('${BM} .bb-section-head')];
            const box = heads.find(h => /形状与间距/.test(h.textContent));
            box?.click();
            await new Promise(r => setTimeout(r, 300));

            const num = [...document.querySelectorAll('${BM} .bb-slider-num')]
                .find(i => i.closest('.bb-slider')?.textContent.includes('圆角大小'));
            if (!num) return { found: false };
            num.value = '34';
            num.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 700));

            // ★ 预览台会同时画「正在编辑的」和「对面那一条」,
            //   要断言的是没被压暗的那一条
            const box2 = document.querySelector('${BM} .bb-preview-row:not(.is-dim) .bubble-view-box');
            const rows = await window.myDb.getAllRecords('bbBubbles');
            const active = rows.find(r => (r.radiusTL === 34));
            return {
                found: true,
                rendered: getComputedStyle(box2).borderTopLeftRadius,
                persisted: Boolean(active),
            };
        })()
    `);
    check('圆角滑块找得到', edited.found);
    check('改完立刻反映到预览', edited.rendered === '34px', edited.rendered);
    // ★ 防抖 350ms,700ms 之后必须已经写进去了
    check('★ 改动落到了 IndexedDB', edited.persisted === true);

    console.log('\n── 气泡机:SVG 消毒 ─────────────────────');
    const svg = await page.evaluate(`
        (async () => {
            [...document.querySelectorAll('${BM} .bb-tab')].find(b => /形状/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 400));
            const ta = document.querySelector('${BM} .bb-textarea');
            if (!ta) return { found: false };
            // 一段带脚本和事件属性的 SVG —— 直接 innerHTML 的话 onload 会执行
            ta.value = '<svg viewBox="0 0 24 24" onload="window.__PWNED=1"><script>window.__PWNED=1<\\/script><circle cx="12" cy="12" r="10"/></svg>';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 600));
            const art = document.querySelector('${BM} .bb-svg-art');
            return {
                found: true,
                pwned: window.__PWNED === 1,
                html: art?.innerHTML || '',
                hasCircle: /circle/.test(art?.innerHTML || ''),
            };
        })()
    `);
    check('SVG 输入框找得到', svg.found);
    check('★ onload / script 被消掉了(没被执行)', svg.pwned !== true);
    check('★ 消毒后的 HTML 里没有 script', !/script/i.test(svg.html));
    check('★ 消毒后的 HTML 里没有 on… 事件属性', !/\son\w+=/i.test(svg.html));
    check('图形本体保留了下来', svg.hasCircle);

    await page.screenshot('02-bubble-shape');

    console.log('\n── 气泡机:配色卡不能全长一样 ───────────');
    const palette = await page.evaluate(`
        (async () => {
            document.querySelector('${BM} .bb-topbar-btn')?.click();
            await new Promise(r => setTimeout(r, 700));
            const cards = [...document.querySelectorAll('${BM} .bb-theme-card .bb-theme-preview')];
            const bgs = cards.map(c => c.style.getPropertyValue('--bb-bg').trim());
            return { count: cards.length, bgs, unique: new Set(bgs.filter(Boolean)).size };
        })()
    `);
    check('四张配色卡都在', palette.count === 4, String(palette.count));
    // ★ `_theme.css` 少写「shell 内后代」那个选择器的话,探针读不到,
    //    四张卡会全部显示成当前主题 —— 而且不报错
    check('★ 四张卡颜色互不相同(探针读到了各套主题)', palette.unique === 4, palette.bgs.join(' / '));

    await page.screenshot('03-bubble-palette');

    // ============================================================
    // 情景剧场
    // ============================================================
    console.log('\n── 情景剧场:打开与初始化 ────────────────');
    await page.evaluate(`window.dispatchEvent(new CustomEvent('app:page-action', { detail: { action: 'openApp', appId: 'scene-play' } }))`);
    await page.waitFor(`document.querySelector('${SP} .sp-root')`, { label: '情景剧场根节点' });
    await page.waitFor(`document.querySelector('${SP} .sp-stage')`, { label: '情景剧场 hydrate 完成' });
    await sleep(900);

    const spSeed = await page.evaluate(`
        (async () => {
            const lib = await window.myDb.get('spLibrary', 'root');
            return {
                categories: (lib?.categories || []).length,
                themes: (lib?.themes || []).length,
                rules: (lib?.rules || []).length,
                clips: (lib?.clips || []).length,
            };
        })()
    `);
    check('灌了默认分类', spSeed.categories >= 2, String(spSeed.categories));
    check('灌了内置外观', spSeed.themes >= 3, String(spSeed.themes));
    check('灌了内置正则', spSeed.rules >= 5, String(spSeed.rules));
    check('灌了情景文案库', spSeed.clips >= 6, String(spSeed.clips));

    console.log('\n── 情景剧场:抽屉是大圆角不是竖线 ───────');
    await page.evaluate(`document.querySelector('${SP} .sp-stage-btn')?.click()`);
    await page.waitFor(`document.querySelector('${SP} .sp-drawer-layer.is-open')`, { label: '抽屉打开' });
    await sleep(600);
    const drawer = await page.evaluate(`
        (() => {
            const d = document.querySelector('${SP} .sp-drawer');
            const cs = getComputedStyle(d);
            return {
                topRight: cs.borderTopRightRadius,
                bottomRight: cs.borderBottomRightRadius,
                shadow: cs.boxShadow,
                tabs: document.querySelectorAll('${SP} .sp-drawer-tab').length,
            };
        })()
    `);
    check('★ 抽屉右侧是大圆角', parseFloat(drawer.topRight) >= 20 && parseFloat(drawer.bottomRight) >= 20,
        `${drawer.topRight} / ${drawer.bottomRight}`);
    check('抽屉有落影(不靠竖线分隔)', drawer.shadow !== 'none');
    check('六个分页都在', drawer.tabs === 6, String(drawer.tabs));

    await page.screenshot('04-scene-drawer');

    console.log('\n── 情景剧场:建一个情景 ─────────────────');
    const created = await page.evaluate(`
        (async () => {
            [...document.querySelectorAll('${SP} .sp-panel-actions .sp-btn')]
                .find(b => /新建情景/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 700));
            const modal = document.querySelector('${SP} .sp-modal');
            if (!modal) return { modalOpen: false };

            const inputs = modal.querySelectorAll('.sp-input');
            inputs[0].value = '雨天便利店';
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            const ta = modal.querySelector('.sp-textarea');
            ta.value = '傍晚下起雨,我躲进街角那家便利店。';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));

            [...modal.querySelectorAll('.ac-btn')].find(b => /建好/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 1200));

            const rows = await window.myDb.getAllRecords('spScenes');
            const hit = rows.find(r => r.title === '雨天便利店');
            return {
                modalOpen: true,
                persisted: Boolean(hit),
                regexOn: (hit?.regexIds || []).length,
                stageTitle: document.querySelector('${SP} .sp-stage-name')?.textContent.trim() || '',
            };
        })()
    `);
    // ★ 弹窗在 MODAL_COMPONENTS 里登记了但 root 分发处漏一行的话,这里是 false
    check('★ 新建情景弹窗真的弹出来了', created.modalOpen);
    check('情景落盘了', created.persisted);
    // ★ 一条正则都不启用的话,AI 写 [博客:…] 只会显示成一串方括号
    check('★ 新情景默认启用了全部正则', created.regexOn >= 5, `${created.regexOn} 条`);
    check('舞台顶栏跟着切过去了', created.stageTitle === '雨天便利店', created.stageTitle);

    console.log('\n── 情景剧场:正则 → 卡片 ────────────────');
    const cards = await page.evaluate(`
        (async () => {
            // 自己写一条带三种写法的消息,看渲染成什么
            document.querySelector('${SP} .sp-composer-btn')?.click();
            await new Promise(r => setTimeout(r, 600));
            const modal = document.querySelector('${SP} .sp-modal');
            if (!modal) return { modalOpen: false };
            const ta = modal.querySelector('.sp-textarea');
            ta.value = '先说一句普通的。\\n[博客：今天的海|风大得站不住。]\\n[日记：把窗台的花搬进屋里了。]\\n[便签：记得带伞]';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
            [...modal.querySelectorAll('.ac-btn')].find(b => /加进去/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 1000));

            const flow = document.querySelector('${SP} .sp-flow');
            return {
                modalOpen: true,
                blog: flow.querySelectorAll('.spc-blog').length,
                diary: flow.querySelectorAll('.spc-diary').length,
                note: flow.querySelectorAll('.spc-note').length,
                blogTitle: flow.querySelector('.spc-blog-title')?.textContent.trim() || '',
                blogBody: flow.querySelector('.spc-blog-body')?.textContent.trim() || '',
                // 原始的方括号不该还留在页面上
                rawLeft: /\\[博客/.test(flow.textContent),
            };
        })()
    `);
    check('★ 「自己写一条」弹窗弹出来了', cards.modalOpen);
    check('★ 全角冒号也能匹配(博客卡出来了)', cards.blog === 1, String(cards.blog));
    check('日记卡出来了', cards.diary >= 1, String(cards.diary));
    check('便签出来了', cards.note === 1, String(cards.note));
    check('捕获组填对了槽位', cards.blogTitle === '今天的海' && /风大得站不住/.test(cards.blogBody),
        `${cards.blogTitle} / ${cards.blogBody.slice(0, 10)}`);
    check('原始标记没有残留在页面上', cards.rawLeft === false);

    await page.screenshot('05-scene-cards');

    console.log('\n── 情景剧场:XSS 防线 ───────────────────');
    const xss = await page.evaluate(`
        (async () => {
            window.__SP_PWNED = 0;
            document.querySelector('${SP} .sp-composer-btn')?.click();
            await new Promise(r => setTimeout(r, 600));
            const modal = document.querySelector('${SP} .sp-modal');
            const ta = modal.querySelector('.sp-textarea');
            ta.value = '[日记：<img src=x onerror="window.__SP_PWNED=1">]';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
            [...modal.querySelectorAll('.ac-btn')].find(b => /加进去/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 900));
            const flow = document.querySelector('${SP} .sp-flow');
            return {
                pwned: window.__SP_PWNED === 1,
                imgCount: flow.querySelectorAll('img').length,
                // 转义之后应该是可见的纯文本
                shownAsText: /onerror/.test(flow.textContent),
            };
        })()
    `);
    check('★ 注进来的 img onerror 没有执行', xss.pwned === false);
    check('★ 没有真的插出一个 img 元素', xss.imgCount === 0, String(xss.imgCount));
    check('危险内容被当成纯文本显示', xss.shownAsText);

    console.log('\n── 情景剧场:存档 ───────────────────────');
    const saves = await page.evaluate(`
        (async () => {
            document.querySelector('${SP} .sp-stage-btn:last-of-type')?.click();
            await new Promise(r => setTimeout(r, 700));
            const before = (await window.myDb.getAllRecords('spSaves')).length;
            const msgBefore = (await window.myDb.getAllRecords('spMessages')).length;

            [...document.querySelectorAll('${SP} .sp-panel-actions .sp-btn')]
                .find(b => /另存为/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 700));
            const modal = document.querySelector('${SP} .sp-modal');
            if (!modal) return { modalOpen: false };
            [...modal.querySelectorAll('.ac-btn')].find(b => /另存/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 1400));

            const after = (await window.myDb.getAllRecords('spSaves')).length;
            const msgAfter = (await window.myDb.getAllRecords('spMessages')).length;
            return { modalOpen: true, before, after, msgBefore, msgAfter };
        })()
    `);
    check('★ 「另存为」弹窗弹出来了', saves.modalOpen);
    check('存档数 +1', saves.after === saves.before + 1, `${saves.before} → ${saves.after}`);
    // ★ 只复制存档元信息不复制消息的话,新档打开是空的
    check('★ 消息跟着复制了一份', saves.msgAfter === saves.msgBefore * 2 && saves.msgBefore > 0,
        `${saves.msgBefore} → ${saves.msgAfter}`);

    await page.screenshot('06-scene-saves');

    console.log('\n── 情景剧场:上下文预览 == 发送 ─────────');
    const ctx = await page.evaluate(`
        (async () => {
            [...document.querySelectorAll('${SP} .sp-drawer-tab')].find(t => /上下文/.test(t.textContent))?.click();
            await new Promise(r => setTimeout(r, 900));
            const rows = [...document.querySelectorAll('${SP} .sp-ctx')];
            const before = rows.length;
            const titles = rows.map(r => r.querySelector('.sp-ctx-title')?.textContent.trim().replace(/锁定$/, ''));

            // 关掉「世界观」那一段
            const world = rows.find(r => /世界观/.test(r.querySelector('.sp-ctx-title')?.textContent || ''));
            const toggle = [...(world?.querySelectorAll('.sp-mini') || [])].find(b => /启用|停用/.test(b.textContent));
            toggle?.click();
            await new Promise(r => setTimeout(r, 800));

            const scenes = await window.myDb.getAllRecords('spScenes');
            const scene = scenes.find(s => s.title === '雨天便利店');
            return {
                count: before,
                titles,
                worldOff: scene?.contextConfig?.world === false,
                lockedCount: rows.filter(r => r.classList.contains('is-locked')).length,
            };
        })()
    `);
    check('十个上下文段都列出来了', ctx.count === 10, String(ctx.count));
    check('第一段是演出须知', /演出须知/.test(ctx.titles?.[0] || ''), ctx.titles?.[0]);
    check('★ 段落开关真的落盘', ctx.worldOff === true);
    check('锁定段标出来了', ctx.lockedCount >= 2, String(ctx.lockedCount));

    await page.screenshot('07-scene-context');

    console.log('\n── 情景剧场:换外观 ─────────────────────');
    const theme = await page.evaluate(`
        (async () => {
            [...document.querySelectorAll('${SP} .sp-drawer-tab')].find(t => /外观/.test(t.textContent))?.click();
            await new Promise(r => setTimeout(r, 900));

            // 切到「界面配色」那一档,看四张配色卡
            [...document.querySelectorAll('${SP} .sp-seg-item')].find(b => /界面配色/.test(b.textContent))?.click();
            await new Promise(r => setTimeout(r, 500));
            const cards = [...document.querySelectorAll('${SP} .sp-palette-card')];
            const bgs = cards.map(c => c.style.getPropertyValue('--sp-bg').trim());

            // 换一套并应用
            cards[3]?.click();
            await new Promise(r => setTimeout(r, 300));
            [...document.querySelectorAll('${SP} .sp-btn')].find(b => b.textContent.trim() === '应用')?.click();
            await new Promise(r => setTimeout(r, 900));

            const shell = document.querySelector('${SP}');
            const lib = await window.myDb.get('spLibrary', 'root');
            return {
                cardCount: cards.length,
                unique: new Set(bgs.filter(Boolean)).size,
                attr: shell.getAttribute('data-sp-theme'),
                stored: lib?.settings?.theme,
                statusBar: (window.__phoneAppsRef?.value || []).find(a => a.id === 'scene-play')?.statusBarColor || '',
            };
        })()
    `);
    check('四张配色卡都在', theme.cardCount === 4, String(theme.cardCount));
    check('★ 四张卡颜色互不相同', theme.unique === 4, String(theme.unique));
    check('★ 换配色写到了 shell 属性上', theme.attr === 'plum', theme.attr);
    check('配色落盘了', theme.stored === 'plum', theme.stored);
    // ★ 不转发的话切到深色时状态栏还是深灰字,在深底上完全看不见
    check('★ 状态栏颜色跟着换了', Boolean(theme.statusBar), theme.statusBar);

    await page.screenshot('08-scene-theme-dark');

    console.log('\n── 跨 App:情景剧场读得到气泡机 ─────────');
    const bridge = await page.evaluate(`
        (async () => {
            const reg = window.__externalAppRegistry;
            const listed = await (reg
                ? reg.invokeService('bubble-maker', 'listBubbles')
                : Promise.resolve(null));
            return {
                hasRegistry: Boolean(reg),
                count: Array.isArray(listed) ? listed.length : -1,
                first: Array.isArray(listed) ? listed[0]?.name : '',
            };
        })()
    `);
    if (bridge.hasRegistry) {
        check('★ 通过 services 拿到了气泡列表', bridge.count > 0, `${bridge.count} 个`);
    } else {
        // registry 没挂全局时改从 UI 侧验证:气泡选择器里能不能列出东西
        const viaUi = await page.evaluate(`
            (async () => {
                [...document.querySelectorAll('${SP} .sp-seg-item')].find(b => /这个情景/.test(b.textContent))?.click();
                await new Promise(r => setTimeout(r, 500));
                [...document.querySelectorAll('${SP} .sp-btn')].find(b => /右侧/.test(b.textContent))?.click();
                await new Promise(r => setTimeout(r, 1600));
                const picks = document.querySelectorAll('${SP} .sp-bubble-pick');
                const empty = document.querySelector('${SP} .sp-modal .sp-empty');
                return { picks: picks.length, empty: Boolean(empty) };
            })()
        `);
        check('★ 气泡选择器列出了气泡机里的气泡', viaUi.picks > 0, `${viaUi.picks} 个${viaUi.empty ? '(显示空态)' : ''}`);
        await page.screenshot('09-scene-pick-bubble');
    }

    console.log('\n── 控制台 ───────────────────────────────');
    // 冒烟环境没配 API Key,「没有可用的 API」是**对的行为**,要从噪音里排掉
    const bad = page.console.filter((l) => (
        /^\[(error|exception)\]/.test(l)
        && !/favicon|Failed to load resource/i.test(l)
        && !/API|api key|apiKey/i.test(l)
    ));
    check('没有 error / 未捕获异常', bad.length === 0, bad.slice(0, 3).join(' | '));
    if (bad.length) bad.forEach((l) => console.log('    ' + l));

    try { proc.kill(); } catch (_) { /* 已经退了 */ }
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) { /* 可能被占用 */ }
}

run().then(() => {
    const passed = results.filter((r) => r.ok).length;
    console.log(`\n═════ ${passed}/${results.length} 通过 ═════\n`);
    process.exit(passed === results.length ? 0 : 1);
}).catch((err) => {
    console.error('\n探针失败:', err.message);
    console.log(`（已跑到 ${results.filter((r) => r.ok).length}/${results.length}）`);
    process.exit(1);
});
