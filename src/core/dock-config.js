/**
 * 小听启动 - Dock 配置中心
 *
 * 与 `app-installation.js` 不同：
 *   - `installed` 字段控制 App **是否可启动 / 是否在桌面**
 *   - `dock` 字段控制 App **是否在 Dock 栏显示**
 *
 * 用户在编辑模式下从 Dock 删图标 ≠ 卸载 App；只是该 App 不在 Dock 显示。
 * 反之，"加到 Dock" 只是把 `app.dock.visible = true`，App 仍保持原安装状态。
 *
 * 持久化：读写 desktop-config，统一存储。
 */

const DOCK_LAYOUT_CHANGED_EVENT = 'phone:dock-changed';

/**
 * 从 desktop-config 读取 dock 布局
 */
function getDockConfig() {
    if (typeof window === 'undefined') return null;
    return window.__desktopConfig?.get?.() || null;
}

/**
 * 保存 dock 布局到 desktop-config
 */
function saveDockConfig(config) {
    if (typeof window === 'undefined') return false;
    // 正确方法名是 updateDock（见 desktop-config.js:406）
    if (!window.__desktopConfig?.updateDock) return false;
    return window.__desktopConfig.updateDock(config);
}

/**
 * appId -> { visible: boolean, order: number, name: string }
 */
const layoutState = new Map();

/**
 * 获取当前所有 dock app 的 order 列表（按 order 排序）
 */
function getStoredOrder() {
    const cfg = getDockConfig();
    if (!cfg) return [];
    return cfg.dock?.order || [];
}

/**
 * 是否已经由用户改过 Dock。
 * 老配置没有 customized 字段时，非空 order 只可能来自旧版的 Dock 编辑或迁移。
 */
function hasCustomizedDock() {
    const dock = getDockConfig()?.dock;
    if (!dock) return false;
    if (typeof dock.customized === 'boolean') return dock.customized;
    return Array.isArray(dock.order) && dock.order.length > 0;
}

/**
 * 从配置中读取某个 app 的 dock 状态
 */
function readFromConfig(appId) {
    const order = getStoredOrder();
    const idx = order.indexOf(appId);
    return {
        visible: idx !== -1,
        order: idx !== -1 ? idx : Number.MAX_SAFE_INTEGER,
    };
}

/**
 * 把当前 layoutState 写入 desktop-config
 */
function persistLayout() {
    const entries = [];
    for (const [appId, meta] of layoutState.entries()) {
        if (meta.visible) {
            entries.push({ appId, order: meta.order });
        }
    }
    // 按 order 排序
    entries.sort((a, b) => a.order - b.order);
    const order = entries.map(e => e.appId);

    saveDockConfig({ visible: true, order, customized: true });
}

/**
 * 确保 app 的 dock 元数据已初始化
 */
function ensureDockMeta(app) {
    if (!app || !app.id) return null;
    let meta = layoutState.get(app.id);
    if (meta) return meta;

    // 优先级：用户自定义布局 > appConfig 默认布局。
    // customized=true 时，order 中缺少某个 App 表示用户明确把它移出了 Dock，
    // 不能再用 App 默认值把它加回来。
    const fromApp = app.dock || {};
    const fromConfig = readFromConfig(app.id);
    const customized = hasCustomizedDock();

    meta = {
        visible: customized
            ? fromConfig.visible
            : (typeof fromApp.visible === 'boolean' ? fromApp.visible : false),
        order: customized && fromConfig.visible
            ? fromConfig.order
            : (typeof fromApp.order === 'number' ? fromApp.order : Number.MAX_SAFE_INTEGER),
        name: app.name || app.id,
    };
    layoutState.set(app.id, meta);
    // 同步回 appConfig
    app.dock = { ...(app.dock || {}), visible: meta.visible, order: meta.order };
    return meta;
}

function dispatchDockChanged(appId, visible, order) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(DOCK_LAYOUT_CHANGED_EVENT, {
        detail: { appId, visible, order },
    }));
}

/**
 * 把 appRegistry 里的全部 app 都过一遍，初始化 layoutState。
 * 在 core-shim 启动时调一次。
 */
export function hydrateDockLayout(apps) {
    if (!Array.isArray(apps)) return;
    for (const app of apps) ensureDockMeta(app);
}

/**
 * 返回某个 app 的 dock 元数据
 */
export function getDockMeta(app) {
    return ensureDockMeta(app) || { visible: false, order: Number.MAX_SAFE_INTEGER, name: app?.id || '' };
}

/**
 * 把 App 加入 Dock
 */
export function addToDock(appId, apps, { order } = {}) {
    const app = Array.isArray(apps) ? apps.find(a => a.id === appId) : null;
    if (!app) return false;
    const meta = ensureDockMeta(app);
    meta.visible = true;
    if (typeof order === 'number') {
        meta.order = order;
    } else if (typeof meta.order !== 'number' || meta.order === Number.MAX_SAFE_INTEGER) {
        meta.order = pickNextDockOrder(apps);
    }
    if (!app.dock) app.dock = {};
    app.dock.visible = true;
    app.dock.order = meta.order;
    persistLayout();
    dispatchDockChanged(appId, true, meta.order);
    return true;
}

/**
 * 从 Dock 删除
 */
export function removeFromDock(appId, apps) {
    const app = Array.isArray(apps) ? apps.find(a => a.id === appId) : null;
    if (!app) return false;
    const meta = ensureDockMeta(app);
    meta.visible = false;
    if (!app.dock) app.dock = {};
    app.dock.visible = false;
    persistLayout();
    dispatchDockChanged(appId, false, meta.order);
    return true;
}

/**
 * 在 Dock 内重排
 */
export function reorderDock(appId, targetIndex, apps) {
    if (!Array.isArray(apps)) return false;
    const visible = apps.filter(a => getDockMeta(a).visible);
    const sorted = [...visible].sort((a, b) => {
        const ao = getDockMeta(a).order;
        const bo = getDockMeta(b).order;
        if (ao !== bo) return ao - bo;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
    });
    const fromIdx = sorted.findIndex(a => a.id === appId);
    if (fromIdx === -1) return false;
    const clamped = Math.max(0, Math.min(targetIndex, sorted.length - 1));
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(clamped, 0, moved);
    sorted.forEach((app, i) => {
        const meta = ensureDockMeta(app);
        meta.order = i;
        if (!app.dock) app.dock = {};
        app.dock.order = i;
    });
    persistLayout();
    dispatchDockChanged(appId, true, clamped);
    return true;
}

/**
 * 交换两个 dock app 的位置
 */
export function swapDockOrder(appIdA, appIdB, apps) {
    const visible = apps.filter(a => getDockMeta(a).visible);
    const sorted = [...visible].sort((a, b) => getDockMeta(a).order - getDockMeta(b).order);
    const a = sorted.find(x => x.id === appIdA);
    const b = sorted.find(x => x.id === appIdB);
    if (!a || !b) return false;
    const orderA = getDockMeta(a).order;
    const orderB = getDockMeta(b).order;
    const metaA = ensureDockMeta(a);
    const metaB = ensureDockMeta(b);
    metaA.order = orderB;
    metaB.order = orderA;
    a.dock.order = orderB;
    b.dock.order = orderA;
    persistLayout();
    dispatchDockChanged(appIdA, true, orderB);
    dispatchDockChanged(appIdB, true, orderA);
    return true;
}

function pickNextDockOrder(apps) {
    if (!Array.isArray(apps) || !apps.length) return 0;
    const orders = apps
        .map(a => getDockMeta(a).order)
        .filter(o => typeof o === 'number' && o !== Number.MAX_SAFE_INTEGER);
    if (!orders.length) return 0;
    return Math.max(...orders) + 1;
}

/**
 * 列出"曾经被加入过 Dock 现在被移除"的所有 App
 */
export function listRemovedFromDock(apps) {
    if (!Array.isArray(apps)) return [];
    return apps
        .filter(app => {
            const meta = ensureDockMeta(app);
            return typeof meta.order === 'number'
                && meta.order !== Number.MAX_SAFE_INTEGER
                && meta.visible === false;
        })
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'));
}

/**
 * 列出"已安装但当前不在 dock"的 App
 */
export function listAddableToDock(apps) {
    if (!Array.isArray(apps)) return [];
    return apps
        .filter(app => getDockMeta(app).visible === false)
        .sort((a, b) => {
            const orderA = getDockMeta(a).order;
            const orderB = getDockMeta(b).order;
            if (orderA !== orderB) return orderA - orderB;
            return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
        });
}

export { DOCK_LAYOUT_CHANGED_EVENT };
