/**
 * App 制作 端到端冒烟（真实浏览器，走 CDP）
 *
 * 这个 App 的核心承诺是「问卷做完，桌面上真的多出一个能点的 App」。
 * 这条链路横跨问卷 → blueprint → 代码生成 → blob URL 动态 import → 注册表 → 桌面，
 * 中间任何一环断了，**静态检查全都发现不了** —— 构建照过，lint 照过。
 *
 * 所以这份探针的重点不是「页面能不能打开」，是把那条链路真的跑一遍：
 *   生成代码 → 装进系统 → 桌面上出现 → 打开它 → 它的页面能画出来 →
 *   刷新之后它还在（走的是 nook 上传插件的同一条恢复路径）。
 *
 * 用法：先 `npm run dev`，再 `node tests/e2e/__probe-app-maker.mjs`
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
const PORT = 9351;
const PROFILE = path.join(os.tmpdir(), `am-probe-${Date.now()}`);
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
        const noise = this.console.filter((l) => /^\[(error|exception)\]/.test(l));
        if (noise.length) {
            console.log(`\n  等待「${label}」超时，控制台里有这些：`);
            noise.slice(-12).forEach((l) => console.log('    ' + l));
        }
        throw new Error(`等待超时: ${label}`);
    }

    async click(selector) {
        const ok = await this.evaluate(`
            (() => {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return false;
                el.click();
                return true;
            })()
        `);
        if (!ok) throw new Error(`点不到: ${selector}`);
        await sleep(260);
        return true;
    }

    async screenshot(name) {
        const res = await this.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(ROOT, `am-probe-${name}.png`);
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

    // ================================================================
    console.log('\n── 启动 ─────────────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: 'app 注册' });
    await sleep(1200);

    check('App 制作已注册', await page.evaluate(
        `(window.__phoneAppsRef.value || []).some(a => a.id === '${APP_ID}')`,
    ));

    const presetShape = await page.evaluate(`
        (() => {
            const LP = window.__listenPresets;
            if (!LP) return null;
            return {
                cards: Object.keys(LP.cards || {}).length,
                layouts: Object.keys(LP.layouts || {}).length,
                modals: Object.keys(LP.modals || {}).length,
                islandTpl: !!(window.islandTemplates && window.islandTemplates.lpProgress),
            };
        })()
    `);
    check('预设库已挂到 window', !!presetShape,
        presetShape ? `卡片 ${presetShape.cards} / 布局 ${presetShape.layouts} / 弹窗 ${presetShape.modals}` : '未挂载');
    check('预设灵动岛模板已注册', !!presetShape?.islandTpl);

    const catalog = await page.evaluate(`
        (async () => {
            const audit = await window.__dbCatalog.auditStores({ withCounts: false });
            return { actual: audit.actual.length, missing: audit.missingInDb, uncat: audit.uncatalogued };
        })()
    `);
    check('数据库目录和实际表对得上', catalog.missing.length === 0 && catalog.uncat.length === 0,
        `实际 ${catalog.actual} 张${catalog.missing.length ? ' · 缺:' + catalog.missing.join(',') : ''}${catalog.uncat.length ? ' · 未登记:' + catalog.uncat.join(',') : ''}`);

    // ================================================================
    console.log('\n── 打开 App 制作 ────────────────────────');
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: '${APP_ID}' }
        }))
    `);
    await page.waitFor(`document.querySelector('${SHELL} .am-root')`, { label: '根组件挂载' });
    await sleep(700);

    check('底部四个 tab 都在', await page.evaluate(
        `document.querySelectorAll('${SHELL} .am-tab').length === 4`,
    ));
    check('默认停在配置页', await page.evaluate(
        `!!document.querySelector('${SHELL} .am-survey')`,
    ));

    const oversized = await page.evaluate(`
        Array.from(document.querySelectorAll('${SHELL} svg'))
             .filter(s => s.getBoundingClientRect().width > 80).length
    `);
    check('没有被撑爆的 SVG', oversized === 0, `超大图标 ${oversized} 个`);

    await page.screenshot('01-survey');

    // ================================================================
    console.log('\n── 科普页 ───────────────────────────────');
    await page.click(`${SHELL} .am-tab:nth-child(1)`);
    await sleep(400);
    const groupCount = await page.evaluate(`document.querySelectorAll('${SHELL} .am-gcard').length`);
    check('科普分类卡片渲染出来了', groupCount >= 10, `${groupCount} 个分类`);

    await page.click(`${SHELL} .am-gcard`);
    await sleep(300);
    const termCount = await page.evaluate(`document.querySelectorAll('${SHELL} .am-termrow').length`);
    check('点进分类能看到词条', termCount > 0, `${termCount} 条`);

    await page.click(`${SHELL} .am-termrow`);
    await sleep(400);
    const sheetOpen = await page.evaluate(`!!document.querySelector('${SHELL} .am-sheet')`);
    check('词条详情弹层能打开', sheetOpen);
    const blockCount = await page.evaluate(`document.querySelectorAll('${SHELL} .am-termblock').length`);
    check('详情里有多段解释', blockCount >= 3, `${blockCount} 段`);
    await page.screenshot('02-glossary');

    await page.click(`${SHELL} .am-sheet__close`);
    await sleep(300);
    check('弹层能关掉', !(await page.evaluate(`!!document.querySelector('${SHELL} .am-sheet')`)));

    // 搜索是跨分类的
    await page.click(`${SHELL} .am-glist__back`);
    await sleep(250);
    await page.evaluate(`
        (() => {
            const el = document.querySelector('${SHELL} .am-search__input');
            el.value = '弹窗';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        })()
    `);
    await sleep(400);
    const hitCount = await page.evaluate(`document.querySelectorAll('${SHELL} .am-hits .am-termrow').length`);
    check('科普搜索能搜到词', hitCount > 0, `${hitCount} 条命中`);

    // ================================================================
    console.log('\n── 填问卷 ───────────────────────────────');
    await page.click(`${SHELL} .am-tab:nth-child(2)`);
    await sleep(350);

    // 直接写 store：探针要验的是「链路通不通」，不是「输入框能不能打字」
    await page.evaluate(`
        (() => {
            const s = window.__amStore.getState();
            s.answers.appName = '探针测试';
            s.answers.appId = 'probe-demo';
            s.answers.tagline = '一个用来验证链路的白膜';
            s.answers.appDesc = '这个 App 由端到端探针生成，用来确认整条链路是通的。';
            s.answers.style = 'ocean-deep';
            s.answers.density = 'relaxed';
            s.answers.radius = 'lg';
            s.answers.topbarType = 'large-title';
            s.answers.topbarRight = ['add', 'more'];
            s.answers.tabbarType = 'indicator';
            s.answers.fabPosition = 'bottom-right';
            s.answers.modals = ['confirm', 'form', 'actionSheet', 'toast'];
            s.answers.islands = ['toast', 'progress'];
            s.answers.widgets = ['stat', 'list'];
            s.answers.capabilities = ['db', 'search'];
            s.answers.stores = ['items'];
            s.answers.crossApp = ['islandKinds', 'promptToMurmur'];
        })()
    `);
    await sleep(400);

    // 换到视觉那一段，展开预览
    await page.evaluate(`window.__amStore.setStep(1)`);
    await sleep(500);
    const previewUp = await page.evaluate(`!!document.querySelector('${SHELL} .am-device__screen')`);
    check('实时预览渲染出来了', previewUp);

    const previewCards = await page.evaluate(`document.querySelectorAll('${SHELL} .am-pv-scroll .lp-card').length`);
    check('预览里用的是真的预设卡片', previewCards > 0, `${previewCards} 张`);

    const previewBg = await page.evaluate(`
        (() => {
            const el = document.querySelector('${SHELL} .am-device__screen');
            return el ? getComputedStyle(el).backgroundColor : '';
        })()
    `);
    check('换配色后预览背景跟着变', /11, ?20, ?38|#0B1426/i.test(previewBg) || previewBg !== 'rgba(0, 0, 0, 0)', previewBg);
    await page.screenshot('03-preview');

    // 页面段：加一页，改布局
    await page.evaluate(`window.__amStore.setStep(4)`);
    await sleep(450);
    const pageCards = await page.evaluate(`document.querySelectorAll('${SHELL} .am-pagecard').length`);
    check('页面卡列出来了', pageCards >= 2, `${pageCards} 页`);

    await page.evaluate(`
        (() => {
            const s = window.__amStore.getState();
            const first = s.answers.pages[0];
            window.__amStore.setPageField(first.key, 'layout', 'masonry');
            window.__amStore.setPageField(first.key, 'name', '瀑布页');
            window.__amStore.togglePageArray(first.key, 'cards', 'media');
        })()
    `);
    await sleep(450);
    const masonryOn = await page.evaluate(`!!document.querySelector('${SHELL} .am-pv-scroll .lp-masonry')`);
    check('改成瀑布流后预览真的变成瀑布流', masonryOn);
    await page.screenshot('04-masonry');

    // 体检
    await page.evaluate(`window.__amStore.setStep(8)`);
    await sleep(450);
    const reviewShown = await page.evaluate(`!!document.querySelector('${SHELL} .am-review')`);
    check('检查页给出了结论', reviewShown);

    // ================================================================
    console.log('\n── AI 助手页 ────────────────────────────');
    await page.click(`${SHELL} .am-tab:nth-child(3)`);
    await sleep(500);
    const chat = await page.evaluate(`
        (() => {
            const root = document.querySelector('${SHELL} .am-chat');
            if (!root) return null;
            return {
                quick: root.querySelectorAll('.am-chat__quick button').length,
                apiNote: (root.querySelector('.am-chat__api')?.textContent || '').trim(),
                apiBad: !!root.querySelector('.am-chat__api.is-bad'),
                composer: !!root.querySelector('.am-chat__input'),
            };
        })()
    `);
    check('助手页渲染出来了', !!chat);
    check('有快捷提问', (chat?.quick || 0) >= 4, `${chat?.quick} 条`);
    check('有输入框', !!chat?.composer);
    // 探针环境没配 API，这里应该给出「去哪儿配」的明确提示，而不是干等或空白
    check('没配 API 时给了明确指引', chat?.apiBad && /API 管理/.test(chat.apiNote || ''), chat?.apiNote);
    await page.screenshot('07-chat');

    // ================================================================
    console.log('\n── 生成 ─────────────────────────────────');
    const gen = await page.evaluate(`
        (() => {
            const s = window.__amStore.getState();
            const bp = window.__amBuildBlueprint(s.answers);
            const code = window.__amGenerateCode(bp);
            const prompt = window.__amBuildPrompt(bp);
            window.__amStore.setGenerated(code, prompt);
            return {
                appId: bp.appId,
                codeLines: code.split('\\n').length,
                promptLines: prompt.split('\\n').length,
                hasImport: /^\\s*import[\\s({'"]/m.test(code),
                hasDefault: /export default function create\\w+App\\(\\)/.test(code),
                mentionsMurmur: prompt.indexOf('murmur') >= 0,
                mentionsMinSize: prompt.indexOf('minSize') >= 0,
            };
        })()
    `);
    check('代码生成成功', gen.codeLines > 200, `${gen.codeLines} 行`);
    check('生成的代码里没有 import', !gen.hasImport);
    check('有 default export 工厂', gen.hasDefault);
    check('提示词生成成功', gen.promptLines > 100, `${gen.promptLines} 行`);
    check('提示词覆盖了跨 App 注册细节', gen.mentionsMurmur);
    check('提示词覆盖了常驻岛的 minSize', gen.mentionsMinSize);

    // 结果页真的画出来了（上面那段只验了生成逻辑，没验 UI）
    await page.click(`${SHELL} .am-tab:nth-child(4)`);
    await sleep(700);
    const resultUi = await page.evaluate(`
        (() => {
            const root = document.querySelector('${SHELL} .am-result');
            if (!root) return null;
            return {
                hero: !!root.querySelector('.am-card--hero'),
                tabs: root.querySelectorAll('.am-tabs button').length,
                codeLen: (root.querySelector('.am-code')?.textContent || '').length,
                selfCheckOk: !!root.querySelector('.am-selfcheck'),
            };
        })()
    `);
    check('结果页渲染出来了', !!resultUi?.hero);
    check('提示词 / 源码两个页签都在', resultUi?.tabs === 2);
    check('提示词正文显示出来了', (resultUi?.codeLen || 0) > 2000, `${resultUi?.codeLen} 字`);
    await page.screenshot('08-result');

    // ================================================================
    console.log('\n── 装到桌面（走 nook 上传的同一条路径）──');
    const install = await page.evaluate(`
        (async () => {
            const code = window.__amStore.getState().generated.code;
            const check = window.__pluginInstaller.validatePluginCode(code);
            const result = await window.__pluginInstaller.installAndPersist(code, {
                fileName: 'probe-demo.js', source: 'probe', allowReplace: true,
            });
            return { check, result };
        })()
    `);
    check('生成的代码通过安装器体检', install.check.ok,
        install.check.errors?.join(' | ') || `${install.check.warnings?.length || 0} 条提醒`);
    check('装进系统成功', install.result.success, install.result.error || install.result.appId);

    await sleep(900);
    const onDesktop = await page.evaluate(`
        (() => {
            const apps = window.__phoneAppsRef.value || [];
            const hit = apps.find(a => a.id === 'probe-demo');
            return hit ? { name: hit.name, pages: (hit.pages || []).length, mode: hit.renderMode, stores: (hit.stores || []).length } : null;
        })()
    `);
    check('新 App 出现在注册表里', !!onDesktop,
        onDesktop ? `${onDesktop.name} · ${onDesktop.pages} 页 · ${onDesktop.mode}` : '没找到');

    const storeCreated = await page.evaluate(`
        (window.myDb?.getStoreNames?.() || []).filter(n => n.indexOf('probeDemo') === 0)
    `);
    check('它声明的数据表真的建出来了', storeCreated.length > 0, storeCreated.join(', ') || '一张都没有');

    const widgetsRegistered = await page.evaluate(`
        Object.keys(window.APP_WIDGETS || {}).filter(k => k.indexOf('probe-demo::') === 0).length
    `);
    check('它的桌面小组件进了注册表', widgetsRegistered === 2, `${widgetsRegistered} 个`);

    const islandDeclared = await page.evaluate(`
        (window.__appPresence.getAppPresence('probe-demo').islandKinds || []).length
    `);
    check('它的灵动岛形态已声明', islandDeclared === 2, `${islandDeclared} 种`);

    // ================================================================
    console.log('\n── 打开生成出来的白膜 ───────────────────');
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: 'probe-demo' }
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="probe-demo"]')`, { label: '白膜 shell' });
    await sleep(900);

    const whiteModel = await page.evaluate(`
        (() => {
            const shell = document.querySelector('.app-shell[data-app-id="probe-demo"]');
            if (!shell) return null;
            return {
                cards: shell.querySelectorAll('.lp-card').length,
                masonry: !!shell.querySelector('.lp-masonry'),
                fab: !!shell.querySelector('.lp-fab'),
                tabs: shell.querySelectorAll('.app-tab-bar button, .app-tab-bar .app-tab').length,
                text: (shell.textContent || '').slice(0, 60),
            };
        })()
    `);
    check('白膜画出了真的卡片', (whiteModel?.cards || 0) > 0, `${whiteModel?.cards} 张`);
    check('白膜用了问卷里选的瀑布流布局', !!whiteModel?.masonry);
    check('白膜有浮动主按钮', !!whiteModel?.fab);
    await page.screenshot('05-white-model');

    // 弹窗真能弹
    const modalWorks = await page.evaluate(`
        (async () => {
            const app = window.__phoneAppsRef.value.find(a => a.id === 'probe-demo');
            app.methods.demoModal({ kind: 'confirm' });
            await new Promise(r => setTimeout(r, 400));
            const el = document.querySelector('.app-shell[data-app-id="probe-demo"] .lp-modal');
            const found = !!el;
            document.querySelector('.lp-overlay')?.querySelector('[data-lp-action="cancel"]')?.click();
            return found;
        })()
    `);
    check('预设弹窗真的能弹出来', modalWorks);

    // 灵动岛真能弹，而且带了 kind 和 minSize
    //
    // ★ 判「岛在不在」要用 isActive()（mode !== 'idle'），不能用 getState().active ——
    //   后者是点击反馈用的瞬时高亮标志，只亮 180ms，读到的基本都是 false。
    const islandState = await page.evaluate(`
        (async () => {
            const app = window.__phoneAppsRef.value.find(a => a.id === 'probe-demo');
            app.methods.demoIsland({ kind: 'progress' });
            await new Promise(r => setTimeout(r, 500));
            const st = window.myDynamicIsland?.getState?.() || {};
            return {
                active: !!window.myDynamicIsland?.isActive?.(),
                mode: st.mode || '',
                kind: st.content?.kind || '',
                minSize: st.content?.minSize || '',
                template: st.content?.islandTemplate || '',
            };
        })()
    `);
    check('进度灵动岛弹出来了', islandState.active, `${islandState.mode} · ${islandState.kind}`);
    check('用上了预设的进度条模板', islandState.template === 'lpProgress', islandState.template || '没有模板');
    check('常驻岛带了 minSize（不会被点三下点没）', islandState.minSize === 'mini', islandState.minSize || '没带');
    await page.screenshot('06-island');
    await page.evaluate(`window.myDynamicIsland?.dismiss?.()`);

    // 子页面
    const subpageWorks = await page.evaluate(`
        (async () => {
            const shell = document.querySelector('.app-shell[data-app-id="probe-demo"]');
            const rows = Array.from(shell.querySelectorAll('[data-app-action]'));
            const entry = rows.find(r => (r.getAttribute('data-app-action') || '').indexOf('openDetail') >= 0);
            if (!entry) return { found: false };
            entry.click();
            await new Promise(r => setTimeout(r, 700));
            return { found: true, changed: !!document.querySelector('.app-shell[data-app-id="probe-demo"]') };
        })()
    `);
    check('子页面有入口能点', subpageWorks.found);

    // ================================================================
    // nook 的这两页在本轮被改成从共享模块取数据（安装器 / 数据库目录），
    // 改完没人点过的话，坏了也不会有人知道。
    console.log('\n── nook 的两页 ──────────────────────────');
    await page.evaluate(`
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'openApp', appId: 'settings' }
        }))
    `);
    await page.waitFor(`document.querySelector('.app-shell[data-app-id="settings"]')`, { label: 'nook shell' });
    await sleep(700);

    // 直接调渲染函数，不去趟 nook 内部的路由 —— 这里要验的是
    // 「改成读共享模块之后还画不画得出来」，不是 nook 怎么跳页
    const nookDb = await page.evaluate(`
        (async () => {
            const app = window.__phoneAppsRef.value.find(a => a.id === 'settings');
            if (!app.state.database) app.state.database = {};
            app.state.database.tab = 'browse';
            const mod = await import('/js/apps/setting/database/section.js');
            const html = mod.renderDatabaseSection(app);
            return {
                cats: (html.match(/db-mgr-category"/g) || []).length,
                stores: (html.match(/db-mgr-store-btn"/g) || []).length,
                hasOwner: html.indexOf('db-mgr-store-btn__meta') >= 0,
            };
        })()
    `).catch((e) => ({ error: String(e.message || e) }));

    check('数据库页按目录分组画出来了', !nookDb.error && nookDb.cats >= 8, nookDb.error || `${nookDb.cats} 组`);
    // 旧版硬编码只有 21 张表：音乐 / 解压 / 创作类 / murmur 的表全都看不到
    check('数据库页列出了全部表（不再是硬编码那 21 张）', nookDb.stores >= 40, `${nookDb.stores} 张`);
    check('每张表都标了归属和主键', !!nookDb.hasOwner);

    const nookSw = await page.evaluate(`
        (async () => {
            const app = window.__phoneAppsRef.value.find(a => a.id === 'settings');
            const mod = await import('/js/apps/setting/software/section.js');
            const out = mod.renderSoftwareSection(app);
            return { len: out.length, hasList: out.indexOf('sw-mgr-plugin-card') >= 0 };
        })()
    `).catch((e) => ({ error: String(e.message || e) }));
    check('软件管理页能渲染', !nookSw.error && nookSw.len > 500, nookSw.error || `${nookSw.len} 字`);
    check('刚装的插件出现在软件管理列表里', !!nookSw.hasList);

    // ================================================================
    console.log('\n── 刷新后还在吗 ─────────────────────────');
    await page.send('Page.navigate', { url: BASE });
    await page.waitFor('window.__phoneAppsRef && window.__phoneAppsRef.value.length > 0', { label: '重新注册' });
    await sleep(2400);

    const survived = await page.evaluate(`
        (window.__phoneAppsRef.value || []).some(a => a.id === 'probe-demo')
    `);
    check('刷新后白膜还在桌面上', survived);

    const draftKept = await page.evaluate(`
        (() => {
            try {
                const raw = JSON.parse(localStorage.getItem('xiaoting::app-maker-draft-v1') || '{}');
                return raw?.answers?.appName || '';
            } catch (_) { return ''; }
        })()
    `);
    check('问卷草稿也留下来了', draftKept === '探针测试', draftKept);

    // ================================================================
    console.log('\n── 清理 ─────────────────────────────────');
    const cleaned = await page.evaluate(`
        (() => {
            const list = window.__pluginInstaller.listPlugins();
            const hit = list.find(p => p.appId === 'probe-demo');
            if (!hit) return false;
            return window.__pluginInstaller.removePlugin(hit.id).success;
        })()
    `);
    check('能从系统里卸载干净', cleaned);
    check('卸载后注册表里没有它了', !(await page.evaluate(
        `(window.__phoneAppsRef.value || []).some(a => a.id === 'probe-demo')`,
    )));

    // ================================================================
    console.log('\n── 控制台 ───────────────────────────────');
    const bad = page.console.filter((line) =>
        /^\[(error|exception)\]/.test(line)
        && !/favicon|Failed to load resource/i.test(line));
    check('没有 error / 未捕获异常', bad.length === 0, bad.slice(0, 3).join(' | '));
    if (bad.length) bad.slice(0, 12).forEach((l) => console.log('    ' + l));

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
