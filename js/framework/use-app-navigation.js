/**
 * 小听框架 - App 导航（Vue 组合）
 * 管理当前打开的 app、页面栈、详情页栈、模态框。
 */
import { createModalState } from './utils.js';
import { createDeepLinkAction } from '../../src/core/actions.js';
import {
    APP_PAGE_CONTENT,
    DETAIL_PAGE_CONTENT,
    externalAppRegistry,
} from '../../src/core/app-registry.js';
import {
    createDefaultDetailRenderer,
    createDefaultPageRenderer,
} from '../../src/core/page-renderers.js';

export function useAppNavigation({ apps, island, createModalState: createModalStateArg, resetCardState }) {
    const activeAppId = Vue.ref('');
    const activeRootPageId = Vue.ref('');
    const detailPageStack = Vue.ref([]);
    const appViewMode = Vue.ref('full');
    // 兼容旧调用：createModalState() 可以来自参数也可以来自 utils
    const makeModal = typeof createModalStateArg === 'function' ? createModalStateArg : createModalState;
    const appModal = Vue.ref(makeModal());

    // 给「app 直接 mutate plain-object 的 state」用的滴答计数器：
    // 任何 app 业务方法需要强制重渲当前 detail view，递增这个 ref 即可（通过 window.__detailRenderTick）。
    // currentDetailView 会因为读取它的 .value 而被自动追踪。
    const detailRenderTick = Vue.ref(0);
    if (typeof window !== 'undefined') {
        window.__detailRenderTick = detailRenderTick;
    }

    const activeApp = Vue.computed(() => apps.value.find(app => app.id === activeAppId.value) || null);
    const appPages = Vue.computed(() => Array.isArray(activeApp.value?.pages) ? activeApp.value.pages : []);
    const navigationPages = Vue.computed(() => appPages.value.filter(page => page && page.type !== 'detail' && page.nav !== false));
    const activeAppNavType = Vue.computed(() => {
        if (navigationPages.value.length <= 1) {
            return 'none';
        }
        return activeApp.value?.nav?.type || 'tab';
    });
    const showAppNav = Vue.computed(() => activeAppNavType.value !== 'none');
    const isInDetailPage = Vue.computed(() => detailPageStack.value.length > 0);
    const showAppTopbar = Vue.computed(() => !isInDetailPage.value && activeApp.value?.topbar?.visible !== false);
    const activeAppTitle = Vue.computed(() => activeApp.value?.topbar?.title || activeApp.value?.name || '');
    const activeAppSubtitle = Vue.computed(() => activeApp.value?.topbar?.subtitle || '');
    const activeAppBackgroundStyle = Vue.computed(() => ({
        background: activeApp.value?.background || activeApp.value?.color || 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
    }));
    const currentRootPage = Vue.computed(() => {
        if (!activeApp.value) return null;
        return navigationPages.value.find(page => page.id === activeRootPageId.value) || navigationPages.value[0] || null;
    });
    const currentPageContent = Vue.computed(() => {
        if (!activeApp.value || !currentRootPage.value) {
            return null;
        }
        return APP_PAGE_CONTENT[activeApp.value.id]?.[currentRootPage.value.id] || null;
    });
    const currentPageView = Vue.computed(() => {
        void detailRenderTick.value;
        if (!activeApp.value || !currentRootPage.value) {
            return '';
        }
        const renderer = activeApp.value.renderPage || createDefaultPageRenderer;
        return renderer(currentPageContent.value, currentRootPage.value, activeApp.value) || '';
    });
    const currentDetailPage = Vue.computed(() => {
        if (!detailPageStack.value.length) return null;
        return detailPageStack.value[detailPageStack.value.length - 1];
    });
    const currentDetailContent = Vue.computed(() => currentDetailPage.value ? DETAIL_PAGE_CONTENT[currentDetailPage.value.id] || null : null);
    const currentDetailTitle = Vue.computed(() => currentDetailContent.value?.title || currentDetailPage.value?.title || '详情');
    const currentDetailSubtitle = Vue.computed(() => currentDetailContent.value?.subtitle || currentDetailPage.value?.subtitle || '');
    const currentDetailView = Vue.computed(() => {
        // 读取 detailRenderTick.value 让 Vue 跟踪它 —— 业务代码 ++ 这个 ref 即可强制本视图重渲。
        void detailRenderTick.value;
        if (!activeApp.value || !currentDetailPage.value) {
            return '';
        }
        const renderer = activeApp.value.renderDetailPage || createDefaultDetailRenderer;
        return renderer(currentDetailContent.value, currentDetailPage.value, activeApp.value) || '';
    });
    const currentStatusBarColor = Vue.computed(() => activeApp.value?.statusBarColor || '#111827');
    const statusBarStyle = Vue.computed(() => ({
        color: currentStatusBarColor.value
    }));

    // ---- 状态栏细分字段（从 settings app 的 reactive 桥读取）----
    // 注意：window.__phoneStatusBarConfig 在 theme-bridge 模块加载时才会创建
    // （晚于 framework bootstrap）。如果 computed 第一次求值时 cfg 还没创建，
    // 它会因为 `!cfg` 短路而**丢失响应式依赖** —— 后续 cfg 内容变了 computed
    // 也永远不会重算。
    // 解决方案：
    //   1. 加一个 `statusBarConfigVersion` ref，每次 theme-bridge 调用
    //      syncStatusBarConfig() 都会 dispatch `settings:statusbar-updated` 事件，
    //      这里递增 version，强制依赖它的 computed 重算。
    //   2. computed 内部读 `version.value` 把这个 ref 当作必追踪的依赖建立连接。
    const statusBarConfigVersion = Vue.ref(0);
    function bumpStatusBarConfigVersion() {
        statusBarConfigVersion.value = statusBarConfigVersion.value + 1;
    }
    function getStatusBarConfig() {
        return typeof window !== 'undefined' ? window.__phoneStatusBarConfig : null;
    }
    if (typeof window !== 'undefined') {
        window.addEventListener('settings:statusbar-updated', bumpStatusBarConfigVersion);
    }

    const statusBarVisible = Vue.computed(() => {
        // 主动追踪 statusBarConfigVersion，让"late-bind"和"同步刷新"都能驱动重算
        const version = statusBarConfigVersion.value;
        void version;
        const cfg = getStatusBarConfig();
        return !cfg || cfg.showStatusBar !== false;
    });
    // 时间 / 信号 / 5G 的显隐已统一到 showStatusBar 一个开关，不再单独控制。
    const currentTimeColor = Vue.computed(() => {
        void statusBarConfigVersion.value;
        const cfg = getStatusBarConfig();
        const v = cfg?.statusBarTimeColor;
        return (typeof v === 'string' && v) ? v : currentStatusBarColor.value;
    });
    const currentSignalColor = Vue.computed(() => {
        void statusBarConfigVersion.value;
        const cfg = getStatusBarConfig();
        const v = cfg?.statusBarSignalColor;
        return (typeof v === 'string' && v) ? v : currentStatusBarColor.value;
    });
    const currentFiveGColor = Vue.computed(() => {
        void statusBarConfigVersion.value;
        const cfg = getStatusBarConfig();
        const v = cfg?.statusBarFiveGColor;
        return (typeof v === 'string' && v) ? v : currentStatusBarColor.value;
    });
    const currentFiveGLabel = Vue.computed(() => {
        void statusBarConfigVersion.value;
        const cfg = getStatusBarConfig();
        const v = cfg?.statusBarFiveGLabel;
        return (typeof v === 'string' && v) ? v : '5G';
    });

    function getDefaultRootPageId(app) {
        if (!app) {
            return '';
        }
        const pages = Array.isArray(app.pages) ? app.pages.filter(page => page && page.type !== 'detail' && page.nav !== false) : [];
        return app.defaultRootPageId || (pages[0] && pages[0].id) || '';
    }

    function normalizeAction(action) {
        if (!action) {
            return null;
        }
        // 处理 URI 编码的 action（wvAction 使用 encodeURIComponent）
        if (typeof action === 'string' && action.includes('%')) {
            try {
                action = decodeURIComponent(action);
            } catch (_) {}
        }
        if (typeof action === 'string') {
            try {
                return JSON.parse(action);
            } catch {
                return null;
            }
        }
        return action;
    }

    function handlePageAction(action) {
        const normalizedAction = normalizeAction(action);
        if (!normalizedAction) {
            return;
        }

        if (normalizedAction.action === 'detail') {
            openDetailPage(normalizedAction.appId || activeAppId.value, normalizedAction.pageId);
            return;
        }

        if (normalizedAction.action === 'modal') {
            console.log('[handlePageAction] modal action detected, calling openModal with:', normalizedAction.modalType, normalizedAction.payload);
            openModal(normalizedAction.modalType, normalizedAction.payload || {});
            return;
        }

        if (normalizedAction.action === 'switchPage') {
            switchRootPage(normalizedAction.pageId);
            return;
        }

        if (normalizedAction.action === 'openApp') {
            openApp(normalizedAction.appId || normalizedAction.targetAppId);
            if (normalizedAction.pageId) {
                if (normalizedAction.pageType === 'detail') {
                    openDetailPage(normalizedAction.appId || normalizedAction.targetAppId, normalizedAction.pageId);
                } else {
                    switchRootPage(normalizedAction.pageId);
                }
            }
            return;
        }

        if (normalizedAction.action === 'deepLink') {
            const targetAppId = normalizedAction.targetAppId || normalizedAction.appId;
            openApp(targetAppId);
            if (normalizedAction.pageId) {
                if (normalizedAction.pageType === 'detail') {
                    openDetailPage(targetAppId, normalizedAction.pageId);
                } else {
                    switchRootPage(normalizedAction.pageId);
                }
            }
            if (normalizedAction.payload) {
                externalAppRegistry.invokeService(targetAppId, 'handleDeepLink', normalizedAction.payload);
            }
            return;
        }

        if (normalizedAction.action === 'shareRecord') {
            const sourceAppId = normalizedAction.appId || activeAppId.value;
            externalAppRegistry.shareRecord(sourceAppId, {
                targetApp: normalizedAction.targetAppId || '',
                entityType: normalizedAction.entityType,
                entityId: normalizedAction.entityId,
                title: normalizedAction.payload?.title || '',
                summary: normalizedAction.payload?.summary || '',
                cover: normalizedAction.payload?.cover || '',
                payload: normalizedAction.payload || {},
                pageId: normalizedAction.pageId || '',
                action: normalizedAction.payload?.action || createDeepLinkAction(
                    normalizedAction.targetAppId || sourceAppId,
                    normalizedAction.pageId || '',
                    normalizedAction.payload || {}
                ),
                tags: normalizedAction.payload?.tags || [],
            });
            return;
        }

        if (normalizedAction.action === 'appMethod') {
            const appId = normalizedAction.appId || activeAppId.value;
            const methodName = normalizedAction.method;
            const payload = normalizedAction.payload;
            if (methodName) {
                externalAppRegistry.invokeMethod(appId, methodName, payload);
            }
        }
    }

    function handleAppContentClick(event) {
        const actionElement = event.target.closest('[data-app-action]');
        if (!actionElement) {
            return;
        }
        handlePageAction(actionElement.dataset.appAction);
    }

    function handleExternalPageAction(event) {
        handlePageAction(event?.detail);
    }

    window.addEventListener('app:page-action', handleExternalPageAction);
    window.addEventListener('music:page-action', handleExternalPageAction);

    Vue.onBeforeUnmount(() => {
        window.removeEventListener('app:page-action', handleExternalPageAction);
        window.removeEventListener('music:page-action', handleExternalPageAction);
    });

    function openApp(appId) {
        const app = apps.value.find(item => item.id === appId);
        if (!app) {
            return;
        }
        activeAppId.value = app.id;
        activeRootPageId.value = getDefaultRootPageId(app);
        detailPageStack.value = [];
        appModal.value = makeModal();
        appViewMode.value = 'full';
        resetCardState();
    }

    function closeApp() {
        activeAppId.value = '';
        activeRootPageId.value = '';
        detailPageStack.value = [];
        appModal.value = makeModal();
        appViewMode.value = 'full';
        resetCardState();
    }

    function switchRootPage(pageId) {
        if (!activeApp.value) {
            return;
        }
        const targetPage = navigationPages.value.find(page => page.id === pageId);
        if (!targetPage) {
            return;
        }
        activeRootPageId.value = pageId;
        detailPageStack.value = [];
    }

    function openDetailPage(appId, pageId) {
        if (activeAppId.value !== appId || !pageId) {
            return;
        }
        detailPageStack.value.push({ id: pageId });
    }

    function closeDetailPage() {
        detailPageStack.value.pop();
    }

    function openModal(type, payload) {
        console.log('[openModal] called with type:', type, 'payload:', payload);
        appModal.value = {
            visible: true,
            type: type || 'center',
            title: payload.title || '弹窗',
            text: payload.text || '',
            content: payload.content || '', // HTML 内容（用于 prompt 类型）
            placeholder: payload.placeholder || '',
            danger: payload.danger === true,
            confirmLabel: payload.confirmLabel || '确定',
            cancelLabel: payload.cancelLabel || '取消',
            onConfirm: typeof payload.onConfirm === 'function' ? payload.onConfirm : null,
        };
        console.log('[openModal] appModal.value set:', JSON.stringify(appModal.value));
    }

    function confirmAppModal() {
        const callback = appModal.value.onConfirm;
        // 如果是 prompt 类型，获取输入框的值
        let inputValue = '';
        if (appModal.value.type === 'prompt') {
            const textarea = document.querySelector('.app-modal-prompt-input');
            inputValue = textarea?.value?.trim() || '';
        }
        appModal.value = makeModal();
        if (typeof callback === 'function') {
            try { callback(inputValue); } catch (err) { console.error('[app-modal] onConfirm 执行失败', err); }
        }
    }

    function closeModal() {
        appModal.value = makeModal();
    }

    return {
        activeAppId,
        activeRootPageId,
        detailPageStack,
        appViewMode,
        appModal,
        activeApp,
        navigationPages,
        activeAppNavType,
        showAppNav,
        showAppTopbar,
        activeAppTitle,
        activeAppSubtitle,
        activeAppBackgroundStyle,
        currentPageContent,
        currentPageView,
        currentDetailContent,
        currentDetailTitle,
        currentDetailSubtitle,
        currentDetailView,
        currentStatusBarColor,
        statusBarStyle,
        // 状态栏细分（由 settings app 同步到 window.__phoneStatusBarConfig）
        statusBarVisible,
        currentTimeColor,
        currentSignalColor,
        currentFiveGColor,
        currentFiveGLabel,
        handlePageAction,
        handleAppContentClick,
        openApp,
        closeApp,
        switchRootPage,
        openDetailPage,
        closeDetailPage,
        openModal,
        closeModal,
        confirmAppModal,
    };
}