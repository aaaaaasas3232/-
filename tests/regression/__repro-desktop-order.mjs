/**
 * 桌面布局持久化回归测试
 *
 * 用真实 Vue 响应式 + 真实 use-desktop-edit.js，覆盖启动时 apps / widgetBoard
 * 两批异步数据以不同先后顺序到达的各种情况，验证：
 *   刷新后的桌面混排顺序 === 上次保存的顺序，且存储不被中间态覆盖。
 *
 * 用法：node tests/regression/__repro-desktop-order.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ---------- 1. 最小 DOM / window mock ----------
class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
    clear() { this.map.clear(); }
}

const listeners = new Map();
const localStorage = new MemoryStorage();

class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

const noopEl = {
    style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; },
    appendChild() {}, removeChild() {}, cloneNode() { return noopEl; },
    addEventListener() {}, removeEventListener() {}, remove() {}, isConnected: false,
    dataset: {}, offsetWidth: 0, offsetHeight: 0, parentElement: null, parentNode: null,
};

const document = {
    readyState: 'complete',
    documentElement: { ...noopEl, style: { setProperty() {} } },
    body: { ...noopEl },
    querySelector() { return null },
    querySelectorAll() { return [] },
    createElement() { return { ...noopEl } },
    addEventListener() {}, removeEventListener() {},
    createTextNode() { return { ...noopEl } },
};

const window = {
    localStorage,
    document,
    CustomEvent,
    navigator: { userAgent: 'node' },
    location: { href: 'http://localhost/', origin: 'http://localhost' },
    addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
        const arr = listeners.get(type) || [];
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(evt) {
        for (const fn of [...(listeners.get(evt.type) || [])]) fn(evt);
        return true;
    },
    requestAnimationFrame(fn) { return setTimeout(() => fn(Date.now()), 16); },
    cancelAnimationFrame(id) { clearTimeout(id); },
    getComputedStyle() { return { getPropertyValue: () => '' }; },
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
    innerWidth: 390, innerHeight: 590,
};
window.window = window;
window.self = window;

globalThis.window = window;
globalThis.document = document;
globalThis.localStorage = localStorage;
globalThis.CustomEvent = CustomEvent;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.Element = class Element {};
globalThis.SVGElement = class SVGElement {};
globalThis.Node = class Node {};
globalThis.HTMLElement = class HTMLElement {};

// ---------- 2. 加载 Vue global build ----------
const vueSrc = fs.readFileSync(path.join(ROOT, 'public/js/vendor/vue.global.prod.js'), 'utf8');
vm.runInThisContext(vueSrc, { filename: 'vue.global.prod.js' });
const Vue = globalThis.Vue;
window.Vue = Vue;
if (!Vue) throw new Error('Vue 未加载');

// ---------- 3. 被测模块 ----------
await import('../../js/framework/desktop-config.js');
const { useDesktopEdit, desktopHydration } = await import('../../js/framework/use-desktop-edit.js');

const CONFIG_KEY = 'xiaoting::desktop-config-v1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const WIDGET_REGISTRY = {
    'weather-app::forecast': { qualifiedId: 'weather-app::forecast', label: '天气', size: 'M', render: () => '', onTap: () => {} },
    'focus-app::timer': { qualifiedId: 'focus-app::timer', label: '专注', size: 'S', orientation: 'h', render: () => '', onTap: () => {} },
    'music::now-playing': { qualifiedId: 'music::now-playing', label: '正在播放', size: 'S', orientation: 'v', render: () => '', onTap: () => {} },
};
window.APP_WIDGETS = WIDGET_REGISTRY;

// ---------- 4. 复刻 core-shim 的 widget load / save ----------
function loadWidgetBoard() {
    const cfg = window.__desktopConfig?.get?.();
    const stored = cfg?.widgets || [];
    return stored
        .filter(e => e && e.qualifiedId && e.instanceId)
        .map(entry => {
            const live = WIDGET_REGISTRY[entry.qualifiedId];
            if (!live) return entry;
            return { ...live, ...entry, render: live.render, renderItem: live.render, onTap: live.onTap };
        });
}

// ---------- 5. 测试骨架 ----------
function resetHydration() {
    desktopHydration.appsReady = false;
    desktopHydration.widgetsReady = false;
    desktopHydration.readyCallbacks.length = 0;
}

function seedStorage({ appOrder, widgets }) {
    localStorage.clear();
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
        version: 1,
        grid: { rows: 4, columns: 4 },
        pages: [{ id: 'home', label: '主屏', apps: appOrder }],
        widgets,
        dock: { visible: true, order: [] },
        installedApps: [],
    }));
}

/**
 * 模拟一次「打开页面」。
 * @param {object} opts
 * @param {string[]} opts.appIds        本次注册出来的 app（顺序 = 注册顺序，非用户顺序）
 * @param {number}  opts.appsAtMs       phone:apps-registered 的时刻
 * @param {number}  opts.configAtMs     boot:desktop-config-ready 的时刻
 * @param {string[]} [opts.presentApps] useDesktopEdit 构造时 apps.value 已有的内容
 * @param {Array<{atMs:number, ids:string[]}>} [opts.appBatches]
 *        app 分批注册（真实环境就是这样：声明了 stores 的 app 要 await IndexedDB 升级）。
 *        给了这个就忽略 appsAtMs/appIds 的单批行为，最后一批到达时派发 phone:apps-registered。
 */
async function bootDesktop({ appIds, appsAtMs, configAtMs, presentApps = [], appBatches = null }) {
    resetHydration();

    const saveLog = [];
    const apps = Vue.ref(presentApps.map(id => ({ id, name: id })));
    const widgetBoard = Vue.ref([]);

    // core-shim 里 saveWidgetBoard 的 watch 注册在 useDesktopEdit 之前
    Vue.watch(widgetBoard, items => {
        if (!desktopHydration.ready) {
            saveLog.push(`saveWidgetBoard SKIPPED (未水合, ${items.length} 个)`);
            return;
        }
        const plain = items.map(item => {
            const { render, renderItem, renderDesktop, onTap, ...rest } = item;
            return rest;
        });
        saveLog.push(`saveWidgetBoard(${plain.length}) -> [${plain.map(w => `${w.instanceId}@${w.boardIndex}`).join(', ')}]`);
        window.__desktopConfig.update({ widgets: plain });
    }, { deep: false });

    const desktop = useDesktopEdit({
        apps,
        widgetBoard,
        appRegistry: { apps: [] },
        island: { showInfo() {}, close() {}, hide() {} },
        activeAppId: Vue.ref(''),
        openApp() {}, openModal() {}, closeModal() {},
        desktopGridConfig: { columns: 4, rows: 4 },
    });

    // core-shim 的 widget 加载门闸
    let configReady = false;
    let appsRegistered = false;
    let widgetsLoaded = false;
    const loadWidgetsIfReady = (force = false) => {
        if (widgetsLoaded) return;
        if (!force && !(configReady && appsRegistered)) return;
        widgetsLoaded = true;
        widgetBoard.value = loadWidgetBoard();
        desktopHydration.markWidgetsReady();
    };

    const timers = [];
    timers.push(setTimeout(() => { configReady = true; loadWidgetsIfReady(); }, configAtMs));

    let lastAppAtMs = appsAtMs;
    if (appBatches && appBatches.length) {
        // 分批注册：每批都往 apps.value 追加（复刻 core-shim 的 syncRegisteredApps —— 
        // 保持已有顺序，新的加到末尾），最后一批才算 phone:apps-registered。
        lastAppAtMs = Math.max(...appBatches.map(b => b.atMs));
        appBatches.forEach(batch => {
            timers.push(setTimeout(() => {
                const existing = new Set(apps.value.map(a => a.id));
                const added = batch.ids.filter(id => !existing.has(id)).map(id => ({ id, name: id }));
                if (added.length) apps.value = [...apps.value, ...added];
                if (batch.atMs === lastAppAtMs) {
                    appsRegistered = true;
                    loadWidgetsIfReady();
                }
            }, batch.atMs));
        });
    } else {
        timers.push(setTimeout(() => {
            appsRegistered = true;
            apps.value = appIds.map(id => ({ id, name: id }));
            loadWidgetsIfReady();
        }, appsAtMs));
    }

    await sleep(Math.max(lastAppAtMs, configAtMs) + 150);
    timers.forEach(clearTimeout);

    return { desktop, apps, widgetBoard, saveLog };
}

function boardIdsOf(desktop) {
    return (desktop.boardItems?.value ?? []).map(i => i.id);
}

function storedConfig() {
    return JSON.parse(localStorage.getItem(CONFIG_KEY));
}

const results = [];
function check(name, actual, expected, extra) {
    const ok = actual.length === expected.length && actual.every((v, i) => v === expected[i]);
    results.push({ name, ok });
    console.log(`\n${ok ? '✅' : '❌'} ${name}`);
    if (!ok) {
        console.log('   期望: ' + JSON.stringify(expected, null, 0));
        console.log('   实际: ' + JSON.stringify(actual, null, 0));
        if (extra) console.log('   ' + extra);
    }
    return ok;
}

// ---------- 6. 场景 ----------
// 上次保存的桌面混排：
//   0:appstore 1:W天气(M) 2:chat 3:music 4:W专注(S) 5:settings 6:weather-app 7:prompt-survey
const SAVED_APP_ORDER = ['appstore', 'chat', 'music', 'settings', 'weather-app', 'prompt-survey'];
const SAVED_WIDGETS = [
    { instanceId: 'w-1', qualifiedId: 'weather-app::forecast', size: 'M', boardIndex: 1 },
    { instanceId: 'w-2', qualifiedId: 'focus-app::timer', size: 'S', orientation: 'h', boardIndex: 4 },
];
const EXPECTED_BOARD = [
    'app::appstore',
    'widget::weather-app::forecast::w-1',
    'app::chat',
    'app::music',
    'widget::focus-app::timer::w-2',
    'app::settings',
    'app::weather-app',
    'app::prompt-survey',
];
// 注册顺序故意打乱，和用户保存的顺序不同
const REGISTER_ORDER = ['weather-app', 'prompt-survey', 'settings', 'appstore', 'chat', 'music'];

console.log('='.repeat(64));
console.log('  桌面布局持久化回归测试');
console.log('='.repeat(64));

// --- 场景 I：首次使用（存储为空）---
// 放最前面跑：desktopHydration 是模块级单例，跑在后面会被前面场景的
// pending 回调 / 兜底定时器污染，测出来的是测试隔离问题而不是产品行为。
{
    localStorage.clear();
    const { desktop } = await bootDesktop({
        appIds: REGISTER_ORDER, configAtMs: 60, appsAtMs: 300,
    });
    check('场景I  空存储 —— 按注册顺序铺开',
        boardIdsOf(desktop), REGISTER_ORDER.map(id => `app::${id}`));
    check('场景I  首次布局已落盘', storedConfig().pages[0].apps, REGISTER_ORDER);
}

// --- 场景 A：widget 先到，app 后到（真实环境最常见，也是原 bug 触发路径）---
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const { desktop, saveLog } = await bootDesktop({
        appIds: REGISTER_ORDER, configAtMs: 60, appsAtMs: 320,
    });
    check('场景A  config(60ms) 早于 apps(320ms) —— 混排顺序还原',
        boardIdsOf(desktop), EXPECTED_BOARD, JSON.stringify(saveLog));
    check('场景A  存储里的 widget 位置未被覆盖',
        storedConfig().widgets.map(w => `${w.instanceId}@${w.boardIndex}`), ['w-1@1', 'w-2@4']);
}

// --- 场景 B：app 先到，widget 后到 ---
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const { desktop } = await bootDesktop({
        appIds: REGISTER_ORDER, configAtMs: 320, appsAtMs: 60,
    });
    check('场景B  apps(60ms) 早于 config(320ms) —— 混排顺序还原',
        boardIdsOf(desktop), EXPECTED_BOARD);
    check('场景B  存储里的 widget 位置未被覆盖',
        storedConfig().widgets.map(w => `${w.instanceId}@${w.boardIndex}`), ['w-1@1', 'w-2@4']);
}

// --- 场景 C：两者几乎同时 ---
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const { desktop } = await bootDesktop({
        appIds: REGISTER_ORDER, configAtMs: 100, appsAtMs: 100,
    });
    check('场景C  config 与 apps 同时到达 —— 混排顺序还原',
        boardIdsOf(desktop), EXPECTED_BOARD);
}

// --- 场景 D：useDesktopEdit 构造时 apps 已非空（app 注册比 framework 更早的情况）---
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const { desktop } = await bootDesktop({
        appIds: REGISTER_ORDER, configAtMs: 80, appsAtMs: 200,
        presentApps: REGISTER_ORDER,
    });
    check('场景D  构造时 apps 已就绪 —— 混排顺序还原',
        boardIdsOf(desktop), EXPECTED_BOARD);
}

// --- 场景 E：widget 挤在一起（连续 boardIndex，检验升序插入）---
{
    const widgets = [
        { instanceId: 'w-1', qualifiedId: 'weather-app::forecast', size: 'M', boardIndex: 0 },
        { instanceId: 'w-2', qualifiedId: 'focus-app::timer', size: 'S', orientation: 'h', boardIndex: 1 },
        { instanceId: 'w-3', qualifiedId: 'music::now-playing', size: 'S', orientation: 'v', boardIndex: 2 },
    ];
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets });
    const { desktop } = await bootDesktop({
        appIds: REGISTER_ORDER, configAtMs: 60, appsAtMs: 300,
    });
    check('场景E  三个 widget 连续排在最前 —— 顺序还原', boardIdsOf(desktop), [
        'widget::weather-app::forecast::w-1',
        'widget::focus-app::timer::w-2',
        'widget::music::now-playing::w-3',
        'app::appstore', 'app::chat', 'app::music',
        'app::settings', 'app::weather-app', 'app::prompt-survey',
    ]);
}

// --- 场景 F：存储里的 widget 数组顺序不是 boardIndex 升序 ---
{
    const widgets = [
        { instanceId: 'w-2', qualifiedId: 'focus-app::timer', size: 'S', orientation: 'h', boardIndex: 4 },
        { instanceId: 'w-1', qualifiedId: 'weather-app::forecast', size: 'M', boardIndex: 1 },
    ];
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets });
    const { desktop } = await bootDesktop({
        appIds: REGISTER_ORDER, configAtMs: 60, appsAtMs: 300,
    });
    check('场景F  存储中 widget 乱序 —— 仍按 boardIndex 还原',
        boardIdsOf(desktop), EXPECTED_BOARD);
}

// --- 场景 G：新装了一个 app（存储里没有它）---
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const { desktop } = await bootDesktop({
        appIds: [...REGISTER_ORDER, 'relax'], configAtMs: 60, appsAtMs: 300,
    });
    check('场景G  新 app 追加到末尾，老布局不变',
        boardIdsOf(desktop), [...EXPECTED_BOARD, 'app::relax']);
    check('场景G  新 app 已写入存储',
        storedConfig().pages[0].apps, [...SAVED_APP_ORDER, 'relax']);
}

// --- 场景 H：拖拽后再刷新（端到端）---
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const first = await bootDesktop({ appIds: REGISTER_ORDER, configAtMs: 60, appsAtMs: 300 });

    // 用户把 w-2（index 4）拖到最前面 —— 等价于 reorderApps 落地后的 boardItems
    const dragged = [...first.desktop.boardItems.value];
    dragged.unshift(dragged.splice(4, 1)[0]);
    first.desktop.boardItems.value = dragged;
    await sleep(60);

    const afterDrag = boardIdsOf(first.desktop);
    check('场景H  拖拽后内存顺序正确', afterDrag, [
        'widget::focus-app::timer::w-2',
        'app::appstore',
        'widget::weather-app::forecast::w-1',
        'app::chat', 'app::music', 'app::settings',
        'app::weather-app', 'app::prompt-survey',
    ]);

    const persisted = storedConfig();
    check('场景H  拖拽结果已落盘（widget boardIndex）',
        persisted.widgets.map(w => `${w.instanceId}@${w.boardIndex}`).sort(), ['w-1@2', 'w-2@0']);

    // 刷新：拿落盘结果重新启动一遍
    const second = await bootDesktop({ appIds: REGISTER_ORDER, configAtMs: 60, appsAtMs: 300 });
    check('场景H  刷新后与拖拽结果一致', boardIdsOf(second.desktop), afterDrag);
}

// --- 场景 J：app 分批注册（真实环境的实际行为）---
// weather-app / appstore / music 等声明了 stores，要 await IndexedDB 升级才注册完，
// 于是 app 是一批批到达的，首批到达时顺序恢复就跑了。
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const { desktop } = await bootDesktop({
        configAtMs: 60,
        appBatches: [
            { atMs: 40, ids: ['weather-app'] },
            { atMs: 120, ids: ['prompt-survey', 'settings'] },
            { atMs: 260, ids: ['appstore', 'chat', 'music'] },
        ],
    });
    check('场景J  app 分 3 批注册 —— 仍按上次保存的顺序还原',
        boardIdsOf(desktop), EXPECTED_BOARD);
    check('场景J  落盘顺序未被注册顺序污染',
        storedConfig().pages[0].apps, SAVED_APP_ORDER);
}

// --- 场景 K：分批注册 + 中途混入一个存储里没有的新 app ---
{
    seedStorage({ appOrder: SAVED_APP_ORDER, widgets: SAVED_WIDGETS });
    const { desktop } = await bootDesktop({
        configAtMs: 60,
        appBatches: [
            { atMs: 40, ids: ['weather-app'] },
            { atMs: 120, ids: ['relax', 'settings'] },
            { atMs: 260, ids: ['appstore', 'chat', 'music', 'prompt-survey'] },
        ],
    });
    check('场景K  分批注册 + 新 app —— 老顺序保持，新 app 落在末尾',
        boardIdsOf(desktop), [...EXPECTED_BOARD, 'app::relax']);
}

// ---------- 7. 汇总 ----------
const failed = results.filter(r => !r.ok);
console.log('\n' + '='.repeat(64));
console.log(`  ${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
    console.log('  失败: ' + failed.map(f => f.name).join(' / '));
}
console.log('='.repeat(64));
process.exit(failed.length ? 1 : 0);
