/**
 * 桌面配置存储 v1.0
 *
 * 统一存储所有桌面相关配置：
 *   - 桌面网格（行数、列数）
 *   - 桌面页面列表（每页的App图标）
 *   - 桌面Widget列表和位置
 *   - Dock栏配置
 *   - 已安装App列表
 *   - 手机壳/状态栏配置
 *   - 当前激活实体
 *
 * 设计原则：
 *   - 所有桌面配置在同一个地方，便于管理
 *   - 使用 localStorage 存储（快速、同步访问）
 *   - 支持从旧存储迁移数据
 */

const CONFIG_KEY = 'xiaoting::desktop-config-v1';
const CONFIG_VERSION = 1;

// ============================================
// 默认配置
// ============================================
const DEFAULT_DESKTOP_CONFIG = {
    version: CONFIG_VERSION,

    // 桌面网格
    grid: {
        rows: 4,        // 桌面行数（可调整）
        columns: 4,     // 固定4列
    },

    // 桌面页面列表
    pages: [
        {
            id: 'home',
            label: '主屏',
            apps: [],    // App ID 列表，按顺序排列
        },
    ],

    // 桌面Widget列表
    widgets: [],   // { instanceId, qualifiedId, gridX, gridY, size, orientation }

    // Dock栏配置
    dock: {
        visible: true,
        order: [],    // App ID 列表
        customized: false, // 用户是否手动增删或调整过 Dock
    },

    // 已安装App列表（仅记录安装状态，不记录位置）
    installedApps: [],   // ['weather-app', 'focus-app', ...]

    // 手机壳/状态栏配置
    appearance: {
        hideCase: false,
        phoneHeight: 590,
        caseColor: '#1a1a2e',
        caseStyle: 'default',
        showStatusBar: true,
        statusBarTimeColor: '#ffffff',
        statusBarSignalColor: '#ffffff',
        statusBarFiveGColor: '#ffffff',
        statusBarFiveGLabel: '',
        statusBarBatteryColor: '#ffffff',
    },

    // 当前激活的实体
    active: {
        userId: null,
        aiPersonId: null,
        worldId: null,
    },

    // 扩展字段（未来可能添加）
    extensions: {},
};

// ============================================
// 存储 API
// ============================================

/**
 * 获取完整桌面配置
 */
export function getDesktopConfig() {
    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) {
            return { ...DEFAULT_DESKTOP_CONFIG };
        }
        const config = JSON.parse(raw);
        return {
            ...DEFAULT_DESKTOP_CONFIG,
            ...config,
            grid: { ...DEFAULT_DESKTOP_CONFIG.grid, ...config.grid },
            dock: { ...DEFAULT_DESKTOP_CONFIG.dock, ...config.dock },
            appearance: { ...DEFAULT_DESKTOP_CONFIG.appearance, ...config.appearance },
            active: { ...DEFAULT_DESKTOP_CONFIG.active, ...config.active },
        };
    } catch (e) {
        console.warn('[desktop-config] 读取配置失败，使用默认值:', e);
        return { ...DEFAULT_DESKTOP_CONFIG };
    }
}

/**
 * 保存完整桌面配置
 */
export function saveDesktopConfig(config) {
    try {
        const merged = {
            ...getDesktopConfig(),
            ...config,
            version: CONFIG_VERSION,
        };
        localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
        return true;
    } catch (e) {
        console.error('[desktop-config] 保存配置失败:', e);
        return false;
    }
}

/**
 * 更新部分配置（只更新指定字段）
 */
export function updateDesktopConfig(partial) {
    const current = getDesktopConfig();
    return saveDesktopConfig({
        ...current,
        ...partial,
    });
}

// ============================================
// 便捷方法
// ============================================

/**
 * 更新桌面网格
 */
export function updateGridConfig(gridConfig) {
    const current = getDesktopConfig();
    return saveDesktopConfig({
        ...current,
        grid: { ...current.grid, ...gridConfig },
    });
}

/**
 * 更新外观设置（手机壳/状态栏）
 */
export function updateAppearance(appearanceConfig) {
    const current = getDesktopConfig();
    return saveDesktopConfig({
        ...current,
        appearance: { ...current.appearance, ...appearanceConfig },
    });
}

/**
 * 更新Dock栏配置
 */
export function updateDockConfig(dockConfig) {
    const current = getDesktopConfig();
    return saveDesktopConfig({
        ...current,
        dock: { ...current.dock, ...dockConfig },
    });
}

/**
 * 添加/更新App到桌面页面
 */
export function addAppToDesktop(appId, pageId = 'home', position = -1) {
    const current = getDesktopConfig();

    // 找到或创建页面
    let page = current.pages.find(p => p.id === pageId);
    if (!page) {
        page = { id: pageId, label: pageId, apps: [] };
        current.pages.push(page);
    }

    // 添加App到页面
    if (!page.apps.includes(appId)) {
        if (position >= 0 && position < page.apps.length) {
            page.apps.splice(position, 0, appId);
        } else {
            page.apps.push(appId);
        }
    }

    return saveDesktopConfig(current);
}

/**
 * 从桌面页面移除App
 */
export function removeAppFromDesktop(appId) {
    const current = getDesktopConfig();
    for (const page of current.pages) {
        const idx = page.apps.indexOf(appId);
        if (idx !== -1) {
            page.apps.splice(idx, 1);
        }
    }
    return saveDesktopConfig(current);
}

/**
 * 添加Widget到桌面
 */
export function addWidgetToDesktop(widget) {
    const current = getDesktopConfig();
    const instanceId = widget.instanceId || `widget-${Date.now()}`;
    current.widgets.push({
        ...widget,
        instanceId,
    });
    return saveDesktopConfig(current);
}

/**
 * 从桌面移除Widget
 */
export function removeWidgetFromDesktop(instanceId) {
    const current = getDesktopConfig();
    current.widgets = current.widgets.filter(w => w.instanceId !== instanceId);
    return saveDesktopConfig(current);
}

/**
 * 更新Widget位置
 */
export function updateWidgetPosition(instanceId, gridX, gridY) {
    const current = getDesktopConfig();
    const widget = current.widgets.find(w => w.instanceId === instanceId);
    if (widget) {
        widget.gridX = gridX;
        widget.gridY = gridY;
    }
    return saveDesktopConfig(current);
}

/**
 * 设置激活实体
 */
export function setActiveEntity(type, id) {
    const current = getDesktopConfig();
    const key = type === 'user' ? 'userId' :
                type === 'aiPerson' ? 'aiPersonId' :
                type === 'world' ? 'worldId' : null;
    if (key) {
        current.active[key] = id;
    }
    return saveDesktopConfig(current);
}

/**
 * 添加已安装App
 */
export function addInstalledApp(appId) {
    const current = getDesktopConfig();
    if (!current.installedApps.includes(appId)) {
        current.installedApps.push(appId);
    }
    return saveDesktopConfig(current);
}

/**
 * 移除已安装App
 */
export function removeInstalledApp(appId) {
    const current = getDesktopConfig();
    current.installedApps = current.installedApps.filter(id => id !== appId);
    return saveDesktopConfig(current);
}

/**
 * 重置桌面配置到默认值
 */
export function resetDesktopConfig() {
    saveDesktopConfig(DEFAULT_DESKTOP_CONFIG);
    return DEFAULT_DESKTOP_CONFIG;
}

// ============================================
// 迁移旧数据（从分散的存储合并到统一配置）
// ============================================

/**
 * 异步迁移旧数据（包含 IndexedDB 数据）
 */
export async function migrateFromLegacyAsync(themeRaw) {
    const current = getDesktopConfig();
    let migrated = false;

    // 迁移外观设置（从 IndexedDB）
    if (themeRaw) {
        const oldAppearance = {
            hideCase: themeRaw.hideCase || false,
            phoneHeight: themeRaw.phoneHeight || 590,
            caseColor: themeRaw.caseColor || '#1a1a2e',
            caseStyle: themeRaw.caseStyle || 'default',
            showStatusBar: themeRaw.showStatusBar !== false,
            statusBarTimeColor: themeRaw.statusBarTimeColor || '#ffffff',
            statusBarSignalColor: themeRaw.statusBarSignalColor || '#ffffff',
            statusBarFiveGColor: themeRaw.statusBarFiveGColor || '#ffffff',
            statusBarFiveGLabel: themeRaw.statusBarFiveGLabel || '',
            statusBarBatteryColor: themeRaw.statusBarBatteryColor || '#ffffff',
        };
        // 只有当新配置是默认值时才迁移（避免覆盖用户已有的新配置）
        if (!current.appearance || current.appearance.phoneHeight === 590 && !current.appearance.caseColor) {
            current.appearance = oldAppearance;
            migrated = true;
        }
    }

    // 迁移 Dock 布局（从旧格式：{ appId: { visible, order, name } }）
    try {
        const dockRaw = localStorage.getItem('xiaoting::dock-layout-v1');
        if (dockRaw && (!current.dock.order || current.dock.order.length === 0)) {
            const dockData = JSON.parse(dockRaw);
            // 旧格式是 { appId: { visible, order } }，提取出 visible=true 的 appId 列表
            const dockOrder = Object.entries(dockData)
                .filter(([id, meta]) => meta && meta.visible)
                .sort(([, a], [, b]) => (a.order || 999) - (b.order || 999))
                .map(([appId]) => appId);
            current.dock = {
                visible: true,
                order: dockOrder,
                customized: true,
            };
            migrated = true;
        }
    } catch (e) {}

    // 迁移已安装App（从 localStorage）
    try {
        const installedRaw = localStorage.getItem('xiaoting::installed-apps-v1');
        if (installedRaw) {
            const installed = JSON.parse(installedRaw);
            if (!current.installedApps || current.installedApps.length === 0) {
                current.installedApps = installed;
                migrated = true;
            }
        }
    } catch (e) {}

    if (migrated) {
        saveDesktopConfig(current);
        console.log('[desktop-config] ✅ 已从旧存储迁移数据');
    }

    return migrated;
}

/**
 * 同步迁移（仅 localStorage 数据）
 */
export function migrateFromLegacy() {
    const current = getDesktopConfig();
    let migrated = false;

    // 迁移 Dock 布局（从旧格式：{ appId: { visible, order, name } }）
    try {
        const dockRaw = localStorage.getItem('xiaoting::dock-layout-v1');
        if (dockRaw && (!current.dock.order || current.dock.order.length === 0)) {
            const dockData = JSON.parse(dockRaw);
            const dockOrder = Object.entries(dockData)
                .filter(([id, meta]) => meta && meta.visible)
                .sort(([, a], [, b]) => (a.order || 999) - (b.order || 999))
                .map(([appId]) => appId);
            current.dock = { visible: true, order: dockOrder, customized: true };
            migrated = true;
        }
    } catch (e) {}

    // 迁移已安装App
    try {
        const installedRaw = localStorage.getItem('xiaoting::installed-apps-v1');
        if (installedRaw && (!current.installedApps || current.installedApps.length === 0)) {
            current.installedApps = JSON.parse(installedRaw);
            migrated = true;
        }
    } catch (e) {}

    if (migrated) {
        saveDesktopConfig(current);
    }

    return migrated;
}

// ============================================
// 挂载到 window（供非 ESM 代码使用）
// ============================================
if (typeof window !== 'undefined') {
    window.__desktopConfig = {
        get: getDesktopConfig,
        save: saveDesktopConfig,
        update: updateDesktopConfig,
        updateGrid: updateGridConfig,
        updateAppearance,
        updateDock: updateDockConfig,
        addApp: addAppToDesktop,
        removeApp: removeAppFromDesktop,
        addWidget: addWidgetToDesktop,
        removeWidget: removeWidgetFromDesktop,
        updateWidgetPosition,
        setActive: setActiveEntity,
        addInstalled: addInstalledApp,
        removeInstalled: removeInstalledApp,
        reset: resetDesktopConfig,
        migrate: migrateFromLegacy,
        migrateAsync: migrateFromLegacyAsync,
    };
}
