const STORAGE_KEY = 'xiaoting::installed-apps-v1';
export const APP_INSTALLATION_CHANGED_EVENT = 'phone:app-installation-changed';

// appId -> 安装状态（true / false）。系统级 App（无 requiresInstall）始终视为已安装。
const installationState = new Map();

function readStoredState() {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

const storedState = readStoredState();

function persistState() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
    } catch (error) {
        console.warn('[app-installation] 无法保存安装状态', error);
    }
}

function dispatchInstallationChanged(appId, installed) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(APP_INSTALLATION_CHANGED_EVENT, {
        detail: { appId, installed },
    }));
}

/**
 * 判断 appConfig 是否声明了「需要走下载/安装流程」。
 * 与之相对的"系统级 App"（如 settings、appstore、template）默认就在桌面。
 */
export function requiresAppInstallation(app) {
    return app?.distribution?.requiresInstall === true;
}

/**
 * 读取当前安装状态。优先级：
 *   1. appConfig.distribution.installed（业务代码最新写入）
 *   2. persisted state（重启后恢复）
 * 系统级 App（无需安装）始终返回 true。
 */
export function isAppInstalled(appOrId, appRegistry = null) {
    if (!appOrId) return false;
    const app = typeof appOrId === 'string'
        ? appRegistry?.getApp?.(appOrId)
        : appOrId;
    const appId = app?.id || (typeof appOrId === 'string' ? appOrId : null);
    if (!appId) return false;
    if (app && !requiresAppInstallation(app)) return true;

    if (app?.distribution && typeof app.distribution.installed === 'boolean') {
        return app.distribution.installed;
    }
    if (installationState.has(appId)) return installationState.get(appId);
    if (Object.prototype.hasOwnProperty.call(storedState, appId)) {
        return storedState[appId] === true;
    }
    return false;
}

/**
 * 安装 App。内部会：
 *   1. 写 appConfig.distribution.installed = true
 *   2. 写入本地存储
 *   3. 派发 phone:app-installation-changed 事件
 * app 可不传：传则会把状态写回 appConfig（推荐）。
 */
export function installApp(appId, app = null) {
    if (!appId) return false;
    if (app && app.distribution) {
        if (!requiresAppInstallation(app)) return false;
        app.distribution.installed = true;
    }
    installationState.set(appId, true);
    storedState[appId] = true;
    persistState();
    dispatchInstallationChanged(appId, true);
    return true;
}

/**
 * 卸载 App。等同于从桌面"删除"。
 */
export function uninstallApp(appId, app = null) {
    if (!appId) return false;
    if (app && app.distribution) {
        app.distribution.installed = false;
    }
    installationState.set(appId, false);
    storedState[appId] = false;
    persistState();
    dispatchInstallationChanged(appId, false);
    return true;
}

export function listInstalledAppIds() {
    return Object.entries(storedState)
        .filter(([, installed]) => installed)
        .map(([appId]) => appId);
}

/**
 * 给一个 app 数组，按"是否可启动"过滤。可启动 = 系统级 App 或已安装 App。
 * 这是 framework 桌面 icons 的唯一过滤口径。
 */
export function listLaunchableApps(apps) {
    return (Array.isArray(apps) ? apps : []).filter(app => isAppInstalled(app));
}