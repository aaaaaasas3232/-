/**
 * App 系统露出（Presence）注册表
 *
 * 「露出」指一个 App 在**手机系统层面**能被看到的地方，目前两类：
 *   1. 灵动岛（Dynamic Island）—— 什么情况下会顶到屏幕顶部那颗胶囊里
 *   2. 桌面小组件（Widget）—— 可以摆到桌面上的卡片
 *
 * 为什么需要这个文件：
 *   小组件本来就是声明式的（`appConfig.widgets` → `window.APP_WIDGETS`），
 *   但**灵动岛完全是运行时的** —— App 想弹就 `toolkit.island.show(...)`，
 *   系统事先并不知道「这个 App 会在什么时候弹岛、弹成什么样」。
 *   于是用户既没法预览，也没法说「我不想让它在这种时候弹」。
 *
 *   这里让 App 用 `appConfig.islandKinds` **声明**自己会用到哪几种岛形态，
 *   系统就能：
 *     - 在「灵动岛与小组件」总览页里画出真实预览
 *     - 让用户逐条开关（关掉之后 `island.show` 直接被拦下）
 *     - 让用户为每条覆盖一段 CSS 做样式自定义
 *
 * appConfig.islandKinds 每一项：
 *   id             string   App 内唯一，**发布后不要改**（用户开关按它存盘）
 *   label          string   显示名，如「正在播放」
 *   desc           string   这个岛长什么样、给用户什么信息
 *   when           string   **什么时候会弹**（用户关不关，主要看这句）
 *   template       string   对应的 islandTemplate 名；不填表示用通用 info/notification 样式
 *   sizes          string[] 支持哪些尺寸，如 ['mini','medium','large']
 *   previewPayload object   给预览用的假数据
 *   defaultEnabled boolean  默认是否允许弹，默认 true
 *   essential      boolean  true = 关系到进行中的活动（通话/导航），不允许用户关掉
 *
 * appConfig.notifyKinds 每一项（**一次性通知**，即 toolkit.island.notify）：
 *   id             string   App 内唯一，发布后不要改
 *   label          string   显示名，如「歌曲已分享」
 *   desc           string   这条通知说明什么
 *   when           string   什么时候会弹
 *   type           string   success | info | warning | error | message | call | system
 *   title/message  string   预览用的标题正文
 *   defaultEnabled boolean  默认 true
 *
 * islandKinds 管的是**常驻岛**（会一直挂在那里的活动），notifyKinds 管的是
 * **一闪而过的提示**。这两类以前只有前者能在总览页里看到、能关；notify 完全是
 * 黑盒，用户被弹了也不知道是谁弹的、更关不掉。现在两类都能查、都能关。
 *
 * 用户偏好持久化在 localStorage，key 见 PREFS_KEY。
 * 用 localStorage 而不是 IndexedDB：`island.show()` 是**同步**调用，
 * 拦截判断必须同步拿到结果，异步读盘来不及。
 */

const PREFS_KEY = 'xiaoting::app-presence-prefs-v1';

/** appId → { appId, appName, appIcon, appIconBg, islandKinds: [] } */
const presenceRegistry = new Map();

let _prefsCache = null;

function loadPrefs() {
    if (_prefsCache) return _prefsCache;
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        _prefsCache = (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        _prefsCache = {};
    }
    return _prefsCache;
}

function savePrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(_prefsCache || {}));
    } catch (err) {
        console.warn('[app-presence] 偏好写盘失败', err);
    }
}

function appPrefs(appId) {
    const all = loadPrefs();
    const key = String(appId || '');
    if (!all[key]) all[key] = { island: {}, widget: {}, notify: {}, css: {} };
    const p = all[key];
    if (!p.island) p.island = {};
    if (!p.widget) p.widget = {};
    if (!p.notify) p.notify = {};
    if (!p.css) p.css = {};
    return p;
}

function normalizeKind(raw, appId) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    if (!id) return null;
    return {
        appId,
        id,
        label: String(raw.label || id),
        desc: String(raw.desc || ''),
        when: String(raw.when || '未说明触发时机'),
        template: String(raw.template || ''),
        sizes: Array.isArray(raw.sizes) && raw.sizes.length ? raw.sizes.slice() : ['medium'],
        previewPayload: raw.previewPayload && typeof raw.previewPayload === 'object' ? raw.previewPayload : {},
        defaultEnabled: raw.defaultEnabled !== false,
        essential: !!raw.essential,
    };
}

const NOTIFY_TYPES = new Set(['success', 'info', 'warning', 'error', 'message', 'call', 'system']);

function normalizeNotifyKind(raw, appId) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    if (!id) return null;
    const type = NOTIFY_TYPES.has(raw.type) ? raw.type : 'info';
    return {
        appId,
        id,
        label: String(raw.label || id),
        desc: String(raw.desc || ''),
        when: String(raw.when || '未说明触发时机'),
        type,
        title: String(raw.title || raw.label || id),
        message: String(raw.message || ''),
        defaultEnabled: raw.defaultEnabled !== false,
    };
}

// ---------------------------------------------------------------------------
// 注册
// ---------------------------------------------------------------------------

/**
 * 由 app-registry.normalizeAppConfig 调用。App 侧只要在 appConfig 里写
 * islandKinds（常驻岛）和 notifyKinds（一次性提示）。
 */
export function registerAppPresence(appConfig) {
    if (!appConfig?.id) return null;
    const appId = String(appConfig.id);
    const kinds = (appConfig.islandKinds || [])
        .map((k) => normalizeKind(k, appId))
        .filter(Boolean);
    const notifyKinds = (appConfig.notifyKinds || [])
        .map((k) => normalizeNotifyKind(k, appId))
        .filter(Boolean);
    const entry = {
        appId,
        appName: appConfig.name || appId,
        appIcon: appConfig.icon || '',
        appIconBg: appConfig.iconBg || '',
        islandKinds: kinds,
        notifyKinds,
    };
    presenceRegistry.set(appId, entry);
    return entry;
}

/** 某个 App 的全部露出（岛形态 + 通知 + 小组件），小组件从 window.APP_WIDGETS 现读 */
export function getAppPresence(appId) {
    const key = String(appId || '');
    const entry = presenceRegistry.get(key) || {
        appId: key, appName: key, appIcon: '', appIconBg: '', islandKinds: [], notifyKinds: [],
    };
    const widgets = Object.values(window.APP_WIDGETS || {}).filter((w) => w && w.appId === key);
    return { ...entry, notifyKinds: entry.notifyKinds || [], widgets };
}

/** 所有已注册 App 的露出，给「系统设置 → 灵动岛与小组件」那种全局入口用 */
export function listAllPresence() {
    const ids = new Set([...presenceRegistry.keys()]);
    Object.values(window.APP_WIDGETS || {}).forEach((w) => { if (w?.appId) ids.add(w.appId); });
    return [...ids].map((id) => getAppPresence(id));
}

// ---------------------------------------------------------------------------
// 用户偏好：允不允许弹 / 小组件显不显示在选择器里 / 样式覆盖
// ---------------------------------------------------------------------------

/**
 * 这个岛形态现在允不允许弹？
 * essential 的（通话这类进行中的活动）永远返回 true，用户关不掉。
 */
export function isIslandKindEnabled(appId, kindId) {
    if (!appId || !kindId) return true;
    const entry = presenceRegistry.get(String(appId));
    const kind = entry?.islandKinds?.find((k) => k.id === kindId);
    if (kind?.essential) return true;
    const v = appPrefs(appId).island[kindId];
    if (typeof v === 'boolean') return v;
    return kind ? kind.defaultEnabled : true;
}

export function setIslandKindEnabled(appId, kindId, enabled) {
    if (!appId || !kindId) return false;
    appPrefs(appId).island[kindId] = !!enabled;
    savePrefs();
    return true;
}

/** 这条一次性通知现在允不允许弹？ */
export function isNotifyKindEnabled(appId, kindId) {
    if (!appId || !kindId) return true;
    const entry = presenceRegistry.get(String(appId));
    const kind = entry?.notifyKinds?.find((k) => k.id === kindId);
    const v = appPrefs(appId).notify[kindId];
    if (typeof v === 'boolean') return v;
    return kind ? kind.defaultEnabled : true;
}

export function setNotifyKindEnabled(appId, kindId, enabled) {
    if (!appId || !kindId) return false;
    appPrefs(appId).notify[kindId] = !!enabled;
    savePrefs();
    return true;
}

/** 小组件是否在 widget picker 里可见（关掉相当于「我不想在桌面上放它」） */
export function isWidgetEnabled(appId, widgetId) {
    const v = appPrefs(appId).widget[widgetId];
    return typeof v === 'boolean' ? v : true;
}

export function setWidgetEnabled(appId, widgetId, enabled) {
    if (!appId || !widgetId) return false;
    appPrefs(appId).widget[widgetId] = !!enabled;
    savePrefs();
    return true;
}

/**
 * 样式覆盖：一段 CSS 文本，注入到 <head> 覆盖预览和真实渲染。
 * @param {'island'|'widget'} scope
 */
export function getStyleOverride(appId, scope, targetId) {
    return appPrefs(appId).css[`${scope}:${targetId}`] || '';
}

export function setStyleOverride(appId, scope, targetId, css) {
    appPrefs(appId).css[`${scope}:${targetId}`] = String(css || '');
    savePrefs();
    applyStyleOverrides();
    return true;
}

export function clearStyleOverride(appId, scope, targetId) {
    delete appPrefs(appId).css[`${scope}:${targetId}`];
    savePrefs();
    applyStyleOverrides();
    return true;
}

const STYLE_EL_ID = 'app-presence-style-overrides';

/** 把所有用户自定义 CSS 合并注入到一个 <style> 里 */
export function applyStyleOverrides() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(STYLE_EL_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_EL_ID;
        document.head.appendChild(el);
    }
    const chunks = [];
    const all = loadPrefs();
    for (const [appId, p] of Object.entries(all)) {
        for (const [key, css] of Object.entries(p?.css || {})) {
            if (!css) continue;
            chunks.push(`/* ${appId} · ${key} */\n${css}`);
        }
    }
    el.textContent = chunks.join('\n\n');
}

/** 调试 / 重置用 */
export function resetAppPresencePrefs(appId) {
    const all = loadPrefs();
    if (appId) delete all[String(appId)];
    else _prefsCache = {};
    savePrefs();
    applyStyleOverrides();
}

if (typeof window !== 'undefined') {
    window.__appPresence = {
        getAppPresence,
        listAllPresence,
        isIslandKindEnabled,
        setIslandKindEnabled,
        isNotifyKindEnabled,
        setNotifyKindEnabled,
        isWidgetEnabled,
        setWidgetEnabled,
        getStyleOverride,
        setStyleOverride,
        clearStyleOverride,
        resetAppPresencePrefs,
    };
}
