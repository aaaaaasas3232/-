// ============================================
// 灵动岛助手（每个 App 拿到一个）
// 负责：把 app 调用的语义化方法映射到 window.myDynamicIsland，
//       并注入 ownerId + 暴露 onKicked/onLongPress/onClosed 注册口。
// ============================================

import { isIslandKindEnabled, isNotifyKindEnabled } from './app-presence.js';
import { sanitizeIslandIcon, getIslandState } from './island-icon.js';

const DEFAULT_NOTIFY_DURATION_MS = 3500;

function normalizeInfoPayload(payload = {}, ownerId = '') {
    const safeOwnerId = payload.ownerId || ownerId || '';
    return {
        // 声明式的岛形态 id（对应 appConfig.islandKinds[].id）。
        // 带上它，用户才能在「灵动岛与小组件」里单独关掉这一种。
        kind: payload.kind || '',
        type: payload.type || 'info',
        title: payload.title || '',
        message: payload.message || '',
        detail: payload.detail || '',
        icon: sanitizeIslandIcon(payload.icon, getIslandState(payload.type || 'info').icon),
        islandTemplate: payload.islandTemplate || '',
        payload: payload.payload || null,
        // widget 模式下：是否合并显示多个 widget（同 app 多 widget 显示在同一个岛）。
        // 同时 payload.widgets = [{qualifiedId, icon, iconBg, label}]
        widgetSlots: Array.isArray(payload.widgetSlots) ? payload.widgetSlots : null,
        // === 新增：持有者与生命周期 ===
        ownerId: safeOwnerId,
        lifecycle: payload.lifecycle || 'manual',
        duration: typeof payload.duration === 'number' ? payload.duration : 0,
        maxSize: payload.maxSize || null,
        minSize: payload.minSize || null,
        closeReason: payload.closeReason || '',
        onKicked: typeof payload.onKicked === 'function' ? payload.onKicked : null,
        onLongPress: typeof payload.onLongPress === 'function' ? payload.onLongPress : null,
        onClosed: typeof payload.onClosed === 'function' ? payload.onClosed : null,
    };
}

export function createIslandHelper(appId, appName) {
    const safeAppName = appName || appId || '应用';
    const safeOwnerId = appId || '';

    function normalize(payload = {}) {
        return normalizeInfoPayload(payload, safeOwnerId);
    }

    // 注册当前 app 的 widget 到全局注册表（在 app 自己注册时由 toolkit 调用，本助手只是入口）
    function registerWidget(widgetConfig) {
        if (!widgetConfig || !widgetConfig.id) {
            return null;
        }
        const qualifiedId = `${appId}::${widgetConfig.id}`;
        if (!window.APP_WIDGETS) {
            window.APP_WIDGETS = {};
        }
        const entry = {
            ...widgetConfig,
            appId,
            widgetId: widgetConfig.id,
            qualifiedId,
            appName: safeAppName,
            appIcon: '',
            appIconBg: '',
        };
        window.APP_WIDGETS[qualifiedId] = entry;
        if (typeof window.refreshPhoneWidgets === 'function') {
            window.refreshPhoneWidgets();
        }
        return entry;
    }

    // 把一组回调挂到当前 islandContent（替换语义：每次 show/toggle 会重置）
    // app 可在 show 之后、close 之前调它来更新回调（比如 onLongPress 只想在播放时生效）。
    function setCallbacks(callbacks = {}) {
        const state = window.myDynamicIsland?.getState?.();
        if (!state || !state.content || state.content.ownerId !== safeOwnerId) {
            return false;
        }
        const island = window.myDynamicIsland;
        if (typeof island._replaceCallbacks === 'function') {
            return island._replaceCallbacks(callbacks);
        }
        return false;
    }

    // 比较"是否同 view"——用于 toggle 智能开关。
    // 包含新字段，确保 lifecycle/duration/maxSize 变化时不会被判成同 view。
    function isSameView(currentContent, nextContent) {
        return (currentContent.islandTemplate || '') === (nextContent.islandTemplate || '')
            && (currentContent.title || '') === (nextContent.title || '')
            && (currentContent.message || '') === (nextContent.message || '')
            && currentContent.lifecycle === nextContent.lifecycle
            && currentContent.duration === nextContent.duration
            && currentContent.maxSize === nextContent.maxSize
            && currentContent.minSize === nextContent.minSize;
    }

    /**
     * 用户在「灵动岛与小组件」里把这种形态关掉了 → 直接不弹。
     * 只对**声明过 kind** 的调用生效；没写 kind 的老代码行为完全不变。
     */
    function blockedByUser(kind) {
        if (!kind) return false;
        try {
            return !isIslandKindEnabled(safeOwnerId, kind);
        } catch (_) {
            return false;
        }
    }

    /** 同上，但查的是 notifyKinds（一次性提示那张表） */
    function notifyBlockedByUser(kind) {
        if (!kind) return false;
        try {
            return !isNotifyKindEnabled(safeOwnerId, kind);
        } catch (_) {
            return false;
        }
    }

    return {
        // === 基础 5 个方法 ===
        show(size = 'mini', payload = {}) {
            if (blockedByUser(payload?.kind)) return;
            window.myDynamicIsland?.showInfo?.(size, normalize(payload));
        },
        info(size = 'mini', payload = {}) {
            if (blockedByUser(payload?.kind)) return;
            window.myDynamicIsland?.showInfo?.(size, normalize(payload));
        },
        notify(type = 'info', title = safeAppName, message = '', options = {}) {
            if (notifyBlockedByUser(options?.kind)) return;
            // ★ 修复：过滤无效的 type，防止第三方 app 传入无效值（如 'ctx'）导致图标不显示
            const VALID_TYPES = ['success', 'warning', 'error', 'info', 'message', 'call', 'system'];
            const safeType = VALID_TYPES.includes(type) ? type : 'info';

            // 通知默认就是 time 模式 + 3500ms 自动消失
            // 把扩展字段塞到 options.lifecycle / options.duration，
            // framework 的 showNotification 会把这些字段直接合并到 islandContent。
            const merged = {
                ...options,
                lifecycle: options.lifecycle || 'time',
                duration: typeof options.duration === 'number'
                    ? options.duration
                    : DEFAULT_NOTIFY_DURATION_MS,
                // 让 framework 知道是哪个 app 发的
                ownerId: safeOwnerId,
            };
            window.myDynamicIsland?.showNotification?.(safeType, title, message, merged);
        },
        setSize(size = 'mini') {
            window.myDynamicIsland?.setSize?.(size);
        },
        isActive() {
            return window.myDynamicIsland?.isActive?.() || false;
        },
        getState() {
            return window.myDynamicIsland?.getState?.() || {
                mode: 'idle',
                size: '',
                active: false,
                content: null,
            };
        },
        toggle(size = 'mini', payload = {}) {
            if (blockedByUser(payload?.kind)) return false;
            const nextContent = normalize(payload);
            const currentState = window.myDynamicIsland?.getState?.();
            const currentContent = currentState?.content || {};
            const isSame = currentState?.mode === 'info'
                && currentState?.size === size
                && isSameView(currentContent, nextContent);

            if (isSame) {
                window.myDynamicIsland?.dismiss?.();
                return false;
            }

            window.myDynamicIsland?.showInfo?.(size, nextContent);
            return true;
        },
        dismiss() {
            window.myDynamicIsland?.dismiss?.();
        },

        // === 新增：回调注册 ===
        setCallbacks,

        // === 新增：暂停计时器（app 自己控制）===
        // 给 app 提供一个标准接口，避免每个 app 自己维护 timer。
        // 适用场景：音乐暂停 1 分钟后自动关岛。
        startIdleTimer(ms = 60000) {
            if (typeof ms !== 'number' || ms <= 0) return false;
            const island = window.myDynamicIsland;
            if (typeof island?._startIdleTimer === 'function') {
                return island._startIdleTimer(ms);
            }
            return false;
        },
        clearIdleTimer() {
            const island = window.myDynamicIsland;
            if (typeof island?._clearIdleTimer === 'function') {
                island._clearIdleTimer();
            }
        },

        // === Widget API ===
        registerWidget,
        previewWidget(qualifiedId, options = {}) {
            const widget = window.APP_WIDGETS?.[qualifiedId];
            if (!widget) {
                return false;
            }
            const renderer = widget.render || (() => '');
            const html = renderer('mini', widget.previewPayload || {});
            window.myDynamicIsland?.showInfo?.('mini', normalize({
                type: 'info',
                title: options.title || widget.label || '小组件',
                message: options.message || `${widget.label} · ${qualifiedId}`,
                icon: widget.icon || '',
                payload: {
                    html,
                    widgetId: qualifiedId,
                },
            }));
            return true;
        },
        showWidgetSlots(payload = {}) {
            window.myDynamicIsland?.showInfo?.('mini', normalize({
                type: 'info',
                title: payload.title || '小组件',
                icon: payload.icon || '',
                widgetSlots: payload.widgets || [],
            }));
        }
    };
}
