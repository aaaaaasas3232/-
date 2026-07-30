/**
 * 小听框架 - Vue 总装入口
 * 拼装 systemData Vue app，挂载到 #phone。
 * 加载顺序由 src/index.js 的 import 顺序决定：
 *   utils → use-system-clock → use-dynamic-island → use-app-navigation →
 *   use-desktop-edit → use-card-mode → use-widget-picker → core-shim
 */
import {
    ISLAND_CLOSE_REASONS,
    UI_CONSTANTS,
    createModalState,
} from './utils.js';
import { externalAppRegistry } from '../../src/core/app-registry.js';
import { useSystemClock } from './use-system-clock.js';
import { useDynamicIsland, exposeDynamicIsland } from './use-dynamic-island.js';
import { useAppNavigation } from './use-app-navigation.js';
import { useDesktopEdit } from './use-desktop-edit.js';
import { useCardMode } from './use-card-mode.js';
import { useWidgetPicker } from './use-widget-picker.js';

export function bootstrapSystemData() {
    if (!window.Vue) {
        console.error('[framework/core-shim] Vue 未加载');
        return;
    }
    if (!externalAppRegistry) {
        console.error('[framework/core-shim] externalAppRegistry 未加载（来自 src/core/app-registry.js）');
        return;
    }

    function escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getDockIconContentSize(html) {
        const firstSvgMatch = String(html || '').match(/<svg[^>]*>/i);
        const tag = firstSvgMatch ? firstSvgMatch[0] : String(html || '');
        let width = 60;
        let height = 60;
        const viewBoxMatch = tag.match(/viewBox\s*=\s*["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/i);
        if (viewBoxMatch) {
            width = parseFloat(viewBoxMatch[1]) || 60;
            height = parseFloat(viewBoxMatch[2]) || 60;
        }
        const widthMatch = tag.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/i);
        const heightMatch = tag.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/i);
        if (widthMatch) {
            width = parseFloat(widthMatch[1]) || width;
        }
        if (heightMatch) {
            height = parseFloat(heightMatch[1]) || height;
        }
        return Math.max(width, height, 1);
    }

    function makeSvgIdsUniqueInDock(html, suffix) {
        let result = String(html || '');
        const ids = [];
        result.replace(/\bid\s*=\s*["']([^"']+)["']/gi, (_, idValue) => {
            ids.push(idValue);
            return _;
        });
        ids.forEach((idValue) => {
            const nextId = `${idValue}-${suffix}`;
            result = result.replace(new RegExp(`(["'#(])${escapeRegex(idValue)}(["')\\s])`, 'g'), `$1${nextId}$2`);
            result = result.replace(new RegExp(`\bid=["']${escapeRegex(idValue)}["']`, 'g'), `id="${nextId}"`);
        });
        return result;
    }

    function buildDockIcon(app) {
        const inner = makeSvgIdsUniqueInDock(app?.icon || '', String(app?.id || 'dock'));
        const contentSize = getDockIconContentSize(inner);
        const scale = 40 / contentSize;
        const half = contentSize / 2;
        return {
            ...app,
            dockIconHtml: `<div class="dock-icon-scaler" style="width:${contentSize}px;height:${contentSize}px;margin:-${half}px 0 0 -${half}px;transform:scale(${scale});overflow:hidden;box-sizing:border-box;">${inner}</div>`,
            dockIconStyle: {
                background: app?.iconBg || '',
                position: 'relative',
                overflow: 'hidden',
            },
        };
    }

    // ============================================
    // 小组件持久化
    // 把"已添加到桌面的 widget 实例"持久化到 IndexedDB，让刷新后位置保留。
    // ============================================
    const WIDGET_BOARD_STORE = 'widgetBoardRecords';
    const WIDGET_BOARD_KEY = '__widgetBoard__';
    const WIDGET_BOARD_VERSION = 1;
    let widgetsBootstrapped = false;

    async function loadWidgetBoard() {
        if (!window.myDb) return [];
        try {
            await window.myDb.open();
            const stored = await window.myDb.get(WIDGET_BOARD_STORE, WIDGET_BOARD_KEY);
            if (!stored || !Array.isArray(stored.items) || stored.version !== WIDGET_BOARD_VERSION) {
                return [];
            }
            const registry = window.APP_WIDGETS || {};
            // 从持久化 items 恢复时，函数引用(render / onTap 等)会被 JSON.stringify 丢掉，
            // 这里按 qualifiedId 从 window.APP_WIDGETS 重新挂上。
            return stored.items
                .filter(entry => entry && entry.qualifiedId && entry.instanceId)
                .map(entry => {
                    const live = registry[entry.qualifiedId];
                    if (!live) return entry;
                    return {
                        ...live,
                        ...entry,
                        // 函数引用必须从 live 注册项拿
                        render: live.render,
                        renderItem: live.renderItem || live.renderDesktop || live.render,
                        onTap: typeof entry.onTap === 'function' ? entry.onTap : live.onTap,
                    };
                });
        } catch (err) {
            console.warn('[core-shim] 加载 widget 桌面记录失败：', err);
            return [];
        }
    }

    async function saveWidgetBoard(items) {
        if (!window.myDb) return;
        try {
            await window.myDb.open();
            // 净化：剥掉 Vue Proxy / Function / Symbol 等不可 structuredClone 的字段
            const plainItems = JSON.parse(JSON.stringify(items));
            await window.myDb.put(WIDGET_BOARD_STORE, {
                rowKey: WIDGET_BOARD_KEY,
                version: WIDGET_BOARD_VERSION,
                updatedAt: Date.now(),
                items: plainItems,
            });
        } catch (err) {
            console.warn('[core-shim] 保存 widget 桌面记录失败：', err);
        }
    }

    const systemData = Vue.createApp({
        setup() {
            const island = useDynamicIsland();
            const { systemTime } = useSystemClock();
            const apps = Vue.ref([...externalAppRegistry.apps]);
            // 暴露给 app（比如设置 app 的 toggle 方法）用来强制让 activeApp/currentDetailView 重新计算
            // —— 当 app 直接 mutate plain-object 的 app.state 时，Vue reactive 不会感知，
            // 需要把 apps.value 重新赋值才能触发依赖链重跑。
            window.__phoneAppsRef = apps;
            const widgetBoard = Vue.ref([]);
            const isWidgetPickerOpen = Vue.ref(false);
            const widgetPickerItems = Vue.ref([]);
            const islandTemplateRef = Vue.ref(null);

            // 顶层确认弹窗（独立于 activeApp，用于桌面红叉删除等不在 App 内触发的二次确认）
            const confirmRequest = Vue.reactive({
                visible: false,
                title: '',
                text: '',
                confirmLabel: '确定',
                danger: false,
                onConfirm: null,
                onCancel: null,
            });
            function requestConfirm({ title, text, confirmLabel, danger, onConfirm, onCancel }) {
                confirmRequest.visible = true;
                confirmRequest.title = title || '请确认';
                confirmRequest.text = text || '';
                confirmRequest.confirmLabel = confirmLabel || '确定';
                confirmRequest.danger = danger === true;
                confirmRequest.onConfirm = typeof onConfirm === 'function' ? onConfirm : null;
                confirmRequest.onCancel = typeof onCancel === 'function' ? onCancel : null;
            }
            function closeConfirm(result) {
                const cb = result === 'ok' ? confirmRequest.onConfirm : confirmRequest.onCancel;
                confirmRequest.visible = false;
                confirmRequest.title = '';
                confirmRequest.text = '';
                confirmRequest.confirmLabel = '确定';
                confirmRequest.danger = false;
                confirmRequest.onConfirm = null;
                confirmRequest.onCancel = null;
                if (typeof cb === 'function') {
                    try { cb(); } catch (err) { console.error('[confirmRequest] callback 失败', err); }
                }
            }
            // 全局通道：业务代码可不依赖 Vue 实例直接发起二次确认
            // 用法：window.__phoneConfirm.request({ title, text, confirmLabel, danger, onConfirm, onCancel })
            if (typeof window !== 'undefined') {
                window.__phoneConfirm = { request: requestConfirm, close: closeConfirm };
            }

            // 注册 widgetBoard 数据持久化用 store（必须在 open 之前）
            if (window.myDb) {
                try {
                    window.myDb.registerStore?.(WIDGET_BOARD_STORE, 'rowKey');
                } catch (e) {}
                void window.myDb.open();
            }
            // 加载持久化的 widget 桌面（一次性）
            if (!widgetsBootstrapped) {
                widgetsBootstrapped = true;
                loadWidgetBoard().then(stored => {
                    widgetBoard.value = stored || [];
                });
            }

            const dockApps = Vue.computed(() => [...apps.value]
                .filter(app => app?.dock?.visible)
                .sort((firstApp, secondApp) => {
                    const firstOrder = typeof firstApp?.dock?.order === 'number' ? firstApp.dock.order : Number.MAX_SAFE_INTEGER;
                    const secondOrder = typeof secondApp?.dock?.order === 'number' ? secondApp.dock.order : Number.MAX_SAFE_INTEGER;
                    if (firstOrder !== secondOrder) {
                        return firstOrder - secondOrder;
                    }
                    return String(firstApp?.name || '').localeCompare(String(secondApp?.name || ''), 'zh-CN');
                })
                .map(buildDockIcon));

            const syncRegisteredApps = () => {
                apps.value = [...externalAppRegistry.apps];
                // 同时自增 detailRenderTick，让当前打开的 detail 页也跟着重渲
                // （v-html 不响应底层数据变化，必须靠 tick 触发重算）
                const tick = typeof window !== 'undefined' ? window.__detailRenderTick : null;
                if (tick && typeof tick.value === 'number') {
                    tick.value = tick.value + 1;
                }
            };

            // 监听 widgetBoard 变化，写回持久化
            Vue.watch(widgetBoard, items => {
                saveWidgetBoard(items);
            }, { deep: false });

            window.refreshPhoneApps = syncRegisteredApps;
            // 注册 widget 注册表变化时刷新 picker
            window.refreshPhoneWidgets = () => {
                if (typeof picker?.updateSnapshotsFromRegistry === 'function') {
                    picker.updateSnapshotsFromRegistry();
                }
            };

            const cardState = {
                resetCardState: () => {},
            };

            const navigation = useAppNavigation({
                apps,
                island,
                createModalState,
                resetCardState: () => cardState.resetCardState(),
            });

            const card = useCardMode({
                activeApp: navigation.activeApp,
                appViewMode: navigation.appViewMode,
                closeApp: navigation.closeApp,
            });

            cardState.resetCardState = card.resetCardState;

            const desktop = useDesktopEdit({
                apps,
                widgetBoard,
                island,
                activeAppId: navigation.activeAppId,
                openApp: navigation.openApp,
                openModal: navigation.openModal,
                closeModal: navigation.closeModal,
                appRegistry: externalAppRegistry,
            });

            const picker = useWidgetPicker({
                listAvailableWidgets: desktop.listAvailableWidgets,
                addWidgetAndClosePicker: desktop.addWidgetAndClosePicker,
                closePicker: () => {
                    desktop.closeWidgetPicker();
                    isWidgetPickerOpen.value = false;
                },
            });

            function openWidgetPicker() {
                const widgets = desktop.listAvailableWidgets();
                picker.openPicker(widgets);
                isWidgetPickerOpen.value = true;
                widgetPickerItems.value = widgets;
            }

            function closeWidgetPickerUi() {
                picker.closePickerUi();
                isWidgetPickerOpen.value = false;
                island.closeIsland(ISLAND_CLOSE_REASONS.WIDGET_PICKER);
            }

            function refreshWidgetPickerUi() {
                const widgets = desktop.listAvailableWidgets();
                widgetPickerItems.value = widgets;
                picker.updateSnapshotsFromRegistry();
            }

            // 渲染桌面 widget 主体(S 横 / M / L 都走这个)
            // 框架按 footprint.size 把 size 传给 widget.render / renderItem,
            // widget 拿到 size 后自己决定内容布局(给 widget 自由发挥的空间)。
            // widget.render 返回 html 字符串。
            function renderWidgetBody(widget, footprint) {
                if (!widget) return '';
                const renderer = widget.renderItem || widget.renderDesktop || widget.render;
                if (typeof renderer !== 'function') return '';
                const payload = {
                    size: footprint?.size || 'S',
                    orientation: footprint?.orientation || null,
                    label: widget.label || '',
                    icon: widget.icon || widget.appIcon || '',
                    iconBg: widget.iconBg || widget.appIconBg || '',
                    qualifiedId: widget.qualifiedId || '',
                    instanceId: widget.instanceId || '',
                };
                try {
                    const html = renderer(payload.size, payload);
                    return typeof html === 'string' ? html : '';
                } catch (e) {
                    console.warn('[widget render]', e);
                    return '';
                }
            }

            // widget 在 picker 卡片上的尺寸标签
            // 例: '小型 2×1', '中型 2×2', '大型 2×4'
            function widgetSizeLabel(widget) {
                const size = widget?.size || widget?.defaultSize || 'S';
                const orientation = widget?.orientation || widget?.defaultOrientation || (size === 'S' ? 'h' : null);
                if (size === 'S') {
                    return orientation === 'v' ? '小型 1×2' : '小型 2×1';
                }
                if (size === 'M') return '中型 2×2';
                if (size === 'L') return '大型 4×2';
                return '小型 2×1';
            }

            window.openWidgetPicker = openWidgetPicker;
            window.closeWidgetPicker = closeWidgetPickerUi;
            window.closeWidgetPickerUI = closeWidgetPickerUi;
            window.refreshWidgetPickerUI = refreshWidgetPickerUi;

            function onScreenPointerUp(event) {
                desktop.onScreenPointerUp(event, {
                    indicatorGesture: card.indicatorGesture,
                    onHomeIndicatorUp: card.onHomeIndicatorUp,
                });
            }

            function handleDesktopPointerDown(event) {
                desktop.cancelAllPresses?.(event);
            }

            function openAppFromDock(appId) {
                navigation.openApp(appId);
            }

            function handleWindowOverlayClick() {
                const result = card.handleWindowOverlayClick(navigation.appModal);
                if (result === 'closeModal') {
                    navigation.closeModal();
                }
            }

            // === 灵动岛在编辑态下的拦截器 ===
            // 编辑态 + 点击岛 → 拉起 widget picker（如还没拉起，且已注册 widget > 0）
            // 编辑态 + 长按岛 → 关闭编辑态 + 关闭 picker + dismiss 岛
            function isWidgetPickerIslandState() {
                const state = island.getState?.();
                return !!(state?.content?.widgetSlots && Array.isArray(state.content.widgetSlots) && state.content.widgetSlots.length);
            }

            function onIslandTapInterceptor(state) {
                if (!desktop.isEditMode.value) return false;
                // 编辑态下，点灵动岛 = 拉 picker；如 picker 已开，点击不响应
                if (isWidgetPickerOpen.value) return false;
                if (!state || !state.content) return false;
                const widgetCount = (window.APP_WIDGETS && Object.keys(window.APP_WIDGETS).length) || 0;
                if (widgetCount === 0) {
                    // 没有 widget：继续走默认 expand（让用户至少能看到岛的扩展），不拦截
                    return false;
                }
                // 拉起 picker
                desktop.openWidgetPicker();
                return true;
            }

            // 注册拦截器
            island.setIslandTapInterceptor(onIslandTapInterceptor);

            // 长按灵动岛
            //   - 编辑模式下：退出编辑态
            //   - mini 形态（info）：调 island.handleIslandLongPress → closeIsland('userLongPress')
            //   - medium/large：不响应
            //   - notification：不响应
            let islandLongPressTimer = null;
            let islandLongPressFired = false;
            const ISLAND_LONG_PRESS_MS = UI_CONSTANTS?.LONG_PRESS_MS || 460;
            function onIslandPointerDown(event) {
                islandLongPressFired = false;
                clearTimeout(islandLongPressTimer);

                // 编辑模式：长按 = 退出编辑态
                if (desktop.isEditMode.value) {
                    islandLongPressTimer = setTimeout(() => {
                        islandLongPressFired = true;
                        if (isWidgetPickerOpen.value) {
                            closeWidgetPickerUi();
                        }
                        desktop.exitEditMode();
                        island.closeIsland(ISLAND_CLOSE_REASONS.EDIT_MODE);
                    }, ISLAND_LONG_PRESS_MS);
                    return;
                }

                // 非编辑模式：仅 mini 形态响应长按
                if (island.islandMode.value === 'info' && island.islandSize.value === 'mini') {
                    islandLongPressTimer = setTimeout(() => {
                        islandLongPressFired = true;
                        island.handleIslandLongPress();
                    }, ISLAND_LONG_PRESS_MS);
                }
            }
            function onIslandPointerUp(event) {
                if (islandLongPressTimer) {
                    clearTimeout(islandLongPressTimer);
                    islandLongPressTimer = null;
                }
                if (islandLongPressFired) {
                    // 阻止冒泡到 handleIslandClick
                    if (event) event.stopPropagation?.();
                    event?.preventDefault?.();
                    islandLongPressFired = false;
                    return;
                }
            }
            function onIslandPointerCancel(event) {
                if (islandLongPressTimer) {
                    clearTimeout(islandLongPressTimer);
                    islandLongPressTimer = null;
                }
                islandLongPressFired = false;
            }

            Vue.watch(
                () => [island.islandMode.value, island.islandSize.value, island.islandTemplateVersion.value, island.renderedIslandTemplate.value],
                async () => {
                    if (!island.hasIslandTemplate.value) {
                        return;
                    }
                    await Vue.nextTick();
                    if (islandTemplateRef.value) {
                        island.bindTemplateContent(islandTemplateRef.value);
                    }
                },
                { flush: 'post' }
            );

            exposeDynamicIsland(island);

            return {
                systemTime,
                apps,
                widgetBoard,
                dockApps,
                desktopPages: desktop.desktopPages,
                desktopPageDots: desktop.desktopPageDots,
                activeDesktopPage: desktop.activeDesktopPage,
                isEditMode: desktop.isEditMode,
                draggingIconId: desktop.draggingIconId,
                activeApp: navigation.activeApp,
                activeRootPageId: navigation.activeRootPageId,
                navigationPages: navigation.navigationPages,
                activeAppNavType: navigation.activeAppNavType,
                showAppNav: navigation.showAppNav,
                showAppTopbar: navigation.showAppTopbar,
                activeAppTitle: navigation.activeAppTitle,
                activeAppSubtitle: navigation.activeAppSubtitle,
                activeAppBackgroundStyle: navigation.activeAppBackgroundStyle,
                currentPageContent: navigation.currentPageContent,
                currentPageView: navigation.currentPageView,
                currentDetailContent: navigation.currentDetailContent,
                currentDetailTitle: navigation.currentDetailTitle,
                currentDetailSubtitle: navigation.currentDetailSubtitle,
                currentDetailView: navigation.currentDetailView,
                currentStatusBarColor: navigation.currentStatusBarColor,
                statusBarStyle: navigation.statusBarStyle,
                // 状态栏细分（由 settings app 的 phone-statusbar 模块同步到 window.__phoneStatusBarConfig）
                statusBarVisible: navigation.statusBarVisible,
                currentTimeColor: navigation.currentTimeColor,
                currentSignalColor: navigation.currentSignalColor,
                currentFiveGColor: navigation.currentFiveGColor,
                currentFiveGLabel: navigation.currentFiveGLabel,
                desktopLayerStyle: card.desktopLayerStyle,
                activeAppShellStyle: card.activeAppShellStyle,
                appViewMode: navigation.appViewMode,
                appModal: navigation.appModal,
                indicatorGesture: card.indicatorGesture,
                isDraggingCard: card.isDraggingCard,
                getDesktopAppStyle: desktop.getDesktopAppStyle,
                getDesktopGridItemStyle: desktop.getDesktopGridItemStyle,
                onAppPointerDown: desktop.onAppPointerDown,
                onAppPointerMove: desktop.onAppPointerMove,
                onAppPointerUp: desktop.onAppPointerUp,
                onDesktopPointerDown: desktop.onDesktopPointerDown,
                onDesktopPointerMove: desktop.onDesktopPointerMove,
                onDesktopPointerUp: desktop.onDesktopPointerUp,
                onDesktopPointerCancel: desktop.onDesktopPointerCancel,
                handleDesktopPointerDown,
                onScreenPointerUp,
                cancelAllPresses: desktop.cancelAllPresses,
                goToDesktopPage: desktop.goToDesktopPage,
                openAppFromDock,
                handlePageAction: navigation.handlePageAction,
                handleAppContentClick: navigation.handleAppContentClick,
                switchRootPage: navigation.switchRootPage,
                openDetailPage: navigation.openDetailPage,
                closeDetailPage: navigation.closeDetailPage,
                openModal: navigation.openModal,
                closeModal: navigation.closeModal,
                confirmAppModal: navigation.confirmAppModal,
                handleWindowOverlayClick,
                handleAppShellClick: card.handleAppShellClick,
                onHomeIndicatorMouseDown: card.onHomeIndicatorMouseDown,
                onHomeIndicatorDown: card.onHomeIndicatorDown,
                onHomeIndicatorMove: card.onHomeIndicatorMove,
                onHomeIndicatorUp: card.onHomeIndicatorUp,
                cancelIndicatorGesture: card.cancelIndicatorGesture,
                onCardMouseDown: card.onCardMouseDown,
                onCardPointerDown: card.onCardPointerDown,
                onCardPointerMove: card.onCardPointerMove,
                onCardPointerUp: card.onCardPointerUp,
                cancelCardDrag: card.cancelCardDrag,
                islandTemplateRef,
                cardShellElement: card.shellElement,
                cardDesktopElement: card.desktopElement,
                // widget 相关
                isWidgetPickerOpen,
                widgetPickerItems,
                pickerOnPickWidget: picker.onPickWidget,
                pickerOnClose: picker.onClose,
                onIslandPointerDown,
                onIslandPointerUp,
                onIslandPointerCancel,
                removeWidgetFromBoard: desktop.removeWidgetFromBoard,
                removeAppFromBoard: desktop.removeAppFromBoard,
                renderWidgetBody,
                widgetSizeLabel,
                ...island,
                // 顶层确认弹窗（独立于 activeApp）
                confirmRequest,
                onConfirmOk: () => closeConfirm('ok'),
                onConfirmCancel: () => closeConfirm('cancel'),
            };
        }
    });

    systemData.mount('#phone');
    console.log('[framework/core-shim] systemData mounted');
}

// 自动 bootstrap（仅在 DOM 已就绪时）。允许其他 ESM 模块导入但不立即挂载。
if (typeof window !== 'undefined' && document.readyState !== 'loading') {
    bootstrapSystemData();
} else if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', bootstrapSystemData);
}