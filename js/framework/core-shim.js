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
import {
    APP_INSTALLATION_CHANGED_EVENT,
    listLaunchableApps,
} from '../../src/core/app-installation.js';
import {
    hydrateDockLayout,
    DOCK_LAYOUT_CHANGED_EVENT,
    removeFromDock as removeFromDockConfig,
} from '../../src/core/dock-config.js';
import { useSystemClock } from './use-system-clock.js';
import { useDynamicIsland, exposeDynamicIsland } from './use-dynamic-island.js';
import { useAppNavigation } from './use-app-navigation.js';
import { useDesktopEdit } from './use-desktop-edit.js';
import { useCardMode } from './use-card-mode.js';
import { useWidgetPicker } from './use-widget-picker.js';
import { bindAppRendererBridge } from './app-renderer-bridge.js';
import { registerBuiltInIslands } from '../../src/core/island-components.js';

export function bootstrapSystemData() {
    if (!window.Vue) {
        console.error('[framework/core-shim] Vue 未加载');
        return;
    }

    // 注册内置 island 组件（toggle / slider / input / textarea / select / list / counter）
    registerBuiltInIslands();

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
    // 使用 desktop-config 统一存储，刷新后位置保留。
    // ============================================
    let widgetsBootstrapped = false;

    function loadWidgetBoard() {
        // 从 desktop-config 读取 widget 列表
        const cfg = window.__desktopConfig?.get?.();
        const storedWidgets = cfg?.widgets || [];
        const registry = window.APP_WIDGETS || {};

        console.log('[core-shim] loadWidgetBoard: 加载', storedWidgets.length, '个 widget');

        // 恢复时需要从 window.APP_WIDGETS 重新挂上函数引用
        return storedWidgets
            .filter(entry => entry && entry.qualifiedId && entry.instanceId)
            .map(entry => {
                const live = registry[entry.qualifiedId];
                if (!live) return entry;
                return {
                    ...live,
                    ...entry,
                    render: live.render,
                    renderItem: live.renderItem || live.renderDesktop || live.render,
                    onTap: typeof entry.onTap === 'function' ? entry.onTap : live.onTap,
                };
            });
    }

    function saveWidgetBoard(items) {
        // 只保存纯数据，不保存函数引用
        // ★ 修复：保留 widget 已有的 boardIndex（use-desktop-edit 已经标记好了），
        // 不再用数组索引覆盖（那会让 boardIndex 变成 0,1,2... 而不是在混排桌面里的真实位置）
        const plainItems = items.map(item => {
            const { render, renderItem, renderDesktop, onTap, ...rest } = item;
            return rest; // 保留已有的 boardIndex
        });
        console.log('[core-shim] saveWidgetBoard: 保存', plainItems.length, '个 widget（含位置）');
        
        // 检查 desktop-config API 是否可用（正确方法名是 update，不是 updateDesktopConfig）
        if (typeof window.__desktopConfig?.update === 'function') {
            window.__desktopConfig.update({ widgets: plainItems });
        } else {
            console.warn('[core-shim] desktop-config API 未就绪，稍后重试');
            // 延后重试（desktop-config 模块可能还在加载）
            setTimeout(() => {
                if (typeof window.__desktopConfig?.update === 'function') {
                    window.__desktopConfig.update({ widgets: plainItems });
                    console.log('[core-shim] 延后保存 widget 成功');
                }
            }, 200);
        }
    }

    // ★ 新增：启动时立即尝试迁移旧数据（同步部分）
    // 异步迁移（从 IndexedDB 读取外观设置）会在 boot-loader 里完成
    if (typeof window !== 'undefined' && window.__desktopConfig) {
        window.__desktopConfig.migrate();
    }

    const systemData = Vue.createApp({
        setup() {
            const island = useDynamicIsland();
            const { systemTime } = useSystemClock();
            const apps = Vue.ref(listLaunchableApps(externalAppRegistry.apps));
            const appScreenPanel = Vue.ref(null);
            const appDetailPanel = Vue.ref(null);
            
            // ★ 定义 syncRegisteredApps（在监听器之前声明）
            const syncRegisteredApps = () => {
                const newLaunchableApps = listLaunchableApps(externalAppRegistry.apps);
                
                // ★ 关键修复：保持用户拖拽后的顺序，而不是用注册时的原始顺序覆盖
                // 1. 先创建 newLaunchableApps 的 id -> app 映射
                const appById = new Map(newLaunchableApps.map(a => [a.id, a]));
                
                // 2. 保留 apps.value 中仍然可启动的 app（保持顺序）
                const preserved = apps.value.filter(a => appById.has(a.id));
                
                // 3. 把新增的 app 加到末尾（而不是插入中间）
                const existingIds = new Set(preserved.map(a => a.id));
                const newApps = newLaunchableApps.filter(a => !existingIds.has(a.id));
                
                apps.value = [...preserved, ...newApps];
                console.log('[core-shim] syncRegisteredApps: preserved=' + preserved.length + ', new=' + newApps.length);
            };
            
            // ★ Dock 布局需要在 apps 注册完成后才能 hydrate
            // 监听 phone:apps-registered 事件（由 js/apps/index.js 派发）
            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    console.log('[core-shim] Apps 注册完成，同步 apps 顺序 + hydrate Dock 布局');
                    // ★ 修复：注册完成后立即触发 syncRegisteredApps，
                    // 让 apps.value 从 desktop-config 恢复用户拖拽后的顺序
                    syncRegisteredApps();
                    hydrateDockLayout(externalAppRegistry.apps);
                }, { once: true });
            }

            // ★ 启动时立即加载外观设置，确保桌面渲染前就有正确的手机状态
            // 不依赖 settings app 的 hydrate（在打开 settings 前就要生效）
            (async () => {
                console.log('[core-shim] 启动时加载外观设置...');
                try {
                    if (window.myDb) {
                        await window.myDb.open();
                    }
                    const APPEARANCE_STORE_NAME = 'deviceSettings';
                    const APPEARANCE_DB_KEY = 'device-theme';
                    const themeRaw = await window.myDb?.get(APPEARANCE_STORE_NAME, APPEARANCE_DB_KEY);
                    if (themeRaw) {
                        console.log('[core-shim] 加载到外观设置:', JSON.stringify({
                            hideCase: themeRaw.hideCase,
                            phoneHeight: themeRaw.phoneHeight,
                            showStatusBar: themeRaw.showStatusBar,
                            caseColor: themeRaw.caseColor,
                            batteryColor: themeRaw.batteryColor,
                        }));

                        // ★ 应用到 DOM：如果 theme-bridge 还未加载，延后重试
                        const applyFn = () => {
                            if (typeof window.__applyEarlyTheme === 'function') {
                                window.__applyEarlyTheme(themeRaw);
                                return true;
                            }
                            return false;
                        };
                        if (!applyFn()) {
                            // 延后重试：theme-bridge 可能在 core-shim 之后才被加载
                            let retries = 0;
                            const retryInterval = setInterval(() => {
                                retries++;
                                if (applyFn() || retries > 50) { // 最多重试 50 次（5秒）
                                    clearInterval(retryInterval);
                                    if (retries > 50) {
                                        console.warn('[core-shim] __applyEarlyTheme 未定义，已放弃');
                                    } else {
                                        console.log('[core-shim] __applyEarlyTheme 加载成功（第', retries, '次重试）');
                                    }
                                }
                            }, 100);
                        }

                        // 同步到 __phoneStatusBarConfig（如果已创建）
                        if (window.__phoneStatusBarConfig) {
                            window.__phoneStatusBarConfig.showStatusBar = themeRaw.showStatusBar !== false;
                            window.__phoneStatusBarConfig.statusBarTimeColor = themeRaw.statusBarTimeColor || '#000000';
                            window.__phoneStatusBarConfig.statusBarSignalColor = themeRaw.statusBarSignalColor || '#000000';
                            window.__phoneStatusBarConfig.statusBarFiveGColor = themeRaw.statusBarFiveGColor || '#000000';
                            window.__phoneStatusBarConfig.statusBarFiveGLabel = themeRaw.statusBarFiveGLabel || '';
                            window.dispatchEvent(new CustomEvent('settings:statusbar-updated'));
                        }
                    } else {
                        console.log('[core-shim] 没有保存的外观设置，使用默认值');
                    }
                } catch (err) {
                    console.warn('[core-shim] 加载外观设置失败:', err);
                }
            })();
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

            // ★ 加载持久化的 widget 桌面（延后到 desktop-config 就绪后）
            // 避免 loadWidgetBoard 时 desktop-config 还没迁移完旧数据
            if (!widgetsBootstrapped) {
                widgetsBootstrapped = true;
                // 监听 boot:desktop-config-ready 事件，确保迁移完成
                const loadWidgetsAfterConfigReady = () => {
                    console.log('[core-shim] desktop-config 就绪，加载 widget 桌面');
                    widgetBoard.value = loadWidgetBoard();
                };
                if (typeof window !== 'undefined') {
                    window.addEventListener('boot:desktop-config-ready', loadWidgetsAfterConfigReady, { once: true });
                }
                // 如果事件已触发（极端情况），立即加载
                setTimeout(() => {
                    if (widgetBoard.value.length === 0) {
                        loadWidgetsAfterConfigReady();
                    }
                }, 100);
            }

            const dockApps = Vue.computed(() => {
                // 依赖 dockTickValue：dock-config 改 visible/order 时让 computed 重算
                dockTickValue.value;
                return [...apps.value]
                    .filter(app => app?.dock?.visible)
                    .sort((firstApp, secondApp) => {
                        const firstOrder = typeof firstApp?.dock?.order === 'number' ? firstApp.dock.order : Number.MAX_SAFE_INTEGER;
                        const secondOrder = typeof secondApp?.dock?.order === 'number' ? secondApp.dock.order : Number.MAX_SAFE_INTEGER;
                        if (firstOrder !== secondOrder) {
                            return firstOrder - secondOrder;
                        }
                        return String(firstApp?.name || '').localeCompare(String(secondApp?.name || ''), 'zh-CN');
                    })
                    .map(buildDockIcon);
            });

            const cardState = {
                resetCardState: () => {},
            };

            let navigation = {};
            try {
                navigation = useAppNavigation({
                    apps,
                    island,
                    createModalState,
                    resetCardState: () => cardState.resetCardState(),
                });
                console.log('[core-shim] useAppNavigation returned:', typeof navigation, 'keys:', Object.keys(navigation).length, 'hasAppTopbarOverride:', !!navigation.appTopbarOverride);
                if (typeof window !== 'undefined') {
                    window.__navigationForDebug = navigation;
                    // ★ 关键：在 setup 内立即暴露 __appTopbarOverride，外部 setup 还在等异步资源
                    window.__appTopbarOverride = navigation.appTopbarOverride;
                    console.log('[framework/core-shim] __appTopbarOverride EXPOSED-INSIDE-SETUP:', !!window.__appTopbarOverride, 'value:', window.__appTopbarOverride && window.__appTopbarOverride.value);
                }
            } catch (e) {
                console.error('[core-shim] useAppNavigation THREW:', e && e.message, e && e.stack);
            }

            // ★ 把 navigation 里的 detailRenderTick 暴露给 app（settings 等）
            // 之前 core-shim 里有自己的同名 ref 但 currentDetailView 依赖的是 navigation 里的那个，
            // 导致 app 端的 ++ 完全没触发视图重渲。现在统一暴露 navigation 里的这一个。
            if (typeof window !== 'undefined' && navigation?.detailRenderTick) {
                window.__detailRenderTick = navigation.detailRenderTick;
            }

            // 监听 widgetBoard 变化，写回持久化
            Vue.watch(widgetBoard, items => {
                saveWidgetBoard(items);
            }, { deep: false });

            window.refreshPhoneApps = syncRegisteredApps;
            window.addEventListener(APP_INSTALLATION_CHANGED_EVENT, syncRegisteredApps);
            // Dock 字段变化（visible / order）也要触发 dockApps computed 重排。
            // apps.value 没变，但 dockApps 排序依赖 dock 字段的 mutation。
            // 用一个内部 tick 强制重算 dockApps。
            let dockTick = 0;
            const dockTickRef = Vue.ref(0);
            window.addEventListener(DOCK_LAYOUT_CHANGED_EVENT, () => {
                dockTick += 1;
                dockTickRef.value = dockTick;
            });
            // 把 dockTickRef 挂到返回数据上，让 dockApps computed 依赖它
            const dockTickValue = Vue.computed(() => dockTickRef.value);
            Vue.onBeforeUnmount(() => {
                window.removeEventListener(APP_INSTALLATION_CHANGED_EVENT, syncRegisteredApps);
            });
            // 注册 widget 注册表变化时刷新 picker
            window.refreshPhoneWidgets = () => {
                if (typeof picker?.updateSnapshotsFromRegistry === 'function') {
                    picker.updateSnapshotsFromRegistry();
                }
            };

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
                // 桌面网格（列数 / 行数）由 settings app 写到 window.__phoneDesktopGridConfig。
                // 注意：core-shim 先于 settings app 加载 —— 调用时 __phoneDesktopGridConfig
                // 通常还是 null，所以 useDesktopEdit 内部会监听 settings:desktop-grid-updated
                // 事件，等到 theme-bridge.js 加载后再取（见 use-desktop-edit.js）。
                desktopGridConfig: null,
            });

            // ============================================================
            // Dock 编辑（拖拽重排 + 桌面 App 拖到 Dock）
            // ============================================================
            const DOCK_MAX_COUNT = 5;                  // dock 最多放 5 个，超过后显示「+」入口
            const draggingDockId = Vue.ref('');
            const dockDropTargetIndex = Vue.ref(-1);    // -1 表示无目标
            let dragSource = null;                     // { type: 'dock' | 'desktop', appId, fromIndex }

            // dock-add 面板（编辑模式下点 + 弹出）
            const dockAdderOpen = Vue.ref(false);
            const dockAdderItems = Vue.ref([]);

            function onDesktopAppDragStart(event, appId) {
                if (!desktop.isEditMode.value) {
                    event.preventDefault();
                    return;
                }
                dragSource = { type: 'desktop', appId };
                try {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('text/plain', `desktop:${appId}`);
                } catch (_) {
                    // 某些浏览器 setData 会抛错
                }
            }

            function onDesktopAppDragEnd() {
                dragSource = null;
                dockDropTargetIndex.value = -1;
            }

            function onDockItemDragStart(event, appId, fromIndex) {
                if (!desktop.isEditMode.value) {
                    event.preventDefault();
                    return;
                }
                dragSource = { type: 'dock', appId, fromIndex };
                // 记录拖拽起点（用于 dragend 时判断是否拖出 dock 容器）
                try {
                    const rect = event.currentTarget.getBoundingClientRect();
                    dragSource.startX = rect.left + rect.width / 2;
                    dragSource.startY = rect.top + rect.height / 2;
                    dragSource.removed = false;
                } catch (_) {}
                try {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', `dock:${appId}`);
                } catch (_) {}
                draggingDockId.value = appId;
            }

            function onDockItemDragOver(event, targetIndex) {
                if (!desktop.isEditMode.value || !dragSource) return;
                event.dataTransfer.dropEffect = dragSource.type === 'dock' ? 'move' : 'copy';
                dockDropTargetIndex.value = targetIndex;
            }

            function onDockItemDragEnd(event) {
                // 编辑模式下拖出 dock 容器一定距离 = 移除
                if (dragSource && dragSource.type === 'dock' && !dragSource.removed) {
                    const DOCK_DOCK_REMOVE_THRESHOLD = 80;
                    const dx = Math.abs((event.clientX || 0) - (dragSource.startX || 0));
                    const dy = Math.abs((event.clientY || 0) - (dragSource.startY || 0));
                    if (dx > DOCK_DOCK_REMOVE_THRESHOLD || dy > DOCK_DOCK_REMOVE_THRESHOLD) {
                        dockDropTargetIndex.value = -1;
                        draggingDockId.value = '';
                        const appId = dragSource.appId;
                        dragSource = null;
                        // ★ 直接删除
                        removeFromDockConfig(appId, apps.value);
                        return;
                    }
                }
                draggingDockId.value = '';
                dockDropTargetIndex.value = -1;
                dragSource = null;
            }

            function onDockContainerDragOver(event) {
                if (!desktop.isEditMode.value || !dragSource) return;
            }

            // === Dock 移动端专用 pointer 拖拽（HTML5 DnD 在移动端不可用）===
            // 设计：
            //   - 编辑模式下 pointerdown 记录起点；移动 > 6px 进入拖拽
            //   - 拖拽期间 pointermove 实时计算 hover target（按 DOM 中心点 hit-test），
            //     写入 dockDropTargetIndex（共用视觉反馈）
            //   - pointerup 时：
            //       · 移动距离 > 80px → 删除
            //       · 否则 hover index != start index → reorderDockItem
            //       · 否则 → 啥也不做（让 click 继续走）
            //   - 不会触发 dragstart：移动端 pointer-down/capture 会屏蔽原生 HTML5 拖拽路径
            const DOCK_POINTER_DRAG_THRESHOLD = 6;
            const DOCK_POINTER_REMOVE_THRESHOLD = 80;
            let dockPointerState = null;

            // 触屏设备检测：移动端 + 桌面 dev mode 调试移动端的场景
            function isTouchDevice() {
                return (
                    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0) ||
                    (typeof window !== 'undefined' && 'ontouchstart' in window)
                );
            }

            function onDockItemPointerDown(event, appId, fromIndex) {
                if (!desktop.isEditMode.value) return;
                // 鼠标设备走原生的 dragstart/dragend（避免与 native HTML5 DnD 互踩）
                if (event.pointerType === 'mouse' || !isTouchDevice()) return;
                if (event.button != null && event.button !== 0) return;
                dockPointerState = {
                    pointerId: event.pointerId,
                    appId,
                    fromIndex,
                    startX: event.clientX,
                    startY: event.clientY,
                    isDragging: false,
                    removed: false,
                };
                try {
                    event.currentTarget?.setPointerCapture?.(event.pointerId);
                } catch (_) {}
            }

            function getClosestDockIndex(clientX, clientY) {
                const items = document.querySelectorAll('.app-dock .dock-item');
                let bestIdx = -1;
                let bestDist = Infinity;
                items.forEach((el, i) => {
                    const r = el.getBoundingClientRect();
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const d = Math.hypot(clientX - cx, clientY - cy);
                    if (d < bestDist) {
                        bestDist = d;
                        bestIdx = i;
                    }
                });
                return bestIdx;
            }

            function onDockItemPointerMove(event, fallbackIndex) {
                if (!dockPointerState) return;
                if (event.pointerId !== dockPointerState.pointerId) return;
                const dx = event.clientX - dockPointerState.startX;
                const dy = event.clientY - dockPointerState.startY;
                if (!dockPointerState.isDragging) {
                    if (Math.hypot(dx, dy) < DOCK_POINTER_DRAG_THRESHOLD) return;
                    dockPointerState.isDragging = true;
                    draggingDockId.value = dockPointerState.appId;
                }
                // 实时更新 hover target
                const hitIdx = getClosestDockIndex(event.clientX, event.clientY);
                if (hitIdx >= 0) {
                    dockDropTargetIndex.value = hitIdx;
                }
            }

            function onDockItemPointerUp(event, fallbackIndex) {
                if (!dockPointerState) return;
                if (event.pointerId !== dockPointerState.pointerId) return;
                const { appId, fromIndex, isDragging } = dockPointerState;
                let removed = false;
                let reordered = false;
                if (isDragging) {
                    const dx = Math.abs((event.clientX || 0) - dockPointerState.startX);
                    const dy = Math.abs((event.clientY || 0) - dockPointerState.startY);
                    // 只在竖向拖出 dock 才视为删除；横向拖动只用于调整顺序
                    if (dy > DOCK_POINTER_REMOVE_THRESHOLD) {
                        // 拖出 dock 一定距离 → 删除
                        removeFromDockConfig(appId, apps.value);
                        removed = true;
                    } else {
                        // 落到不同位置 → reorder
                        const hitIdx = getClosestDockIndex(event.clientX, event.clientY);
                        if (hitIdx >= 0 && hitIdx !== fromIndex) {
                            desktop.reorderDockItem(appId, hitIdx);
                            reordered = true;
                        }
                    }
                }
                // 清理
                dockPointerState = null;
                draggingDockId.value = '';
                dockDropTargetIndex.value = -1;
                // 阻止 click 误触发打开 App（除非要走的不是这里）
                if (isDragging && (removed || reordered)) {
                    event.stopPropagation?.();
                    event.preventDefault?.();
                }
            }

            function onDockItemPointerCancel(event) {
                if (dockPointerState && event.pointerId === dockPointerState.pointerId) {
                    dockPointerState = null;
                    draggingDockId.value = '';
                    dockDropTargetIndex.value = -1;
                }
            }

            function onDockContainerDragOver(event) {
                if (!desktop.isEditMode.value || !dragSource) return;
                event.dataTransfer.dropEffect = dragSource.type === 'dock' ? 'move' : 'copy';
                dockDropTargetIndex.value = dockApps.value.length;  // 末尾
            }

            function onDockContainerDrop(event) {
                if (!desktop.isEditMode.value || !dragSource) return;
                const targetIndex = dockDropTargetIndex.value;
                if (dragSource.type === 'dock') {
                    desktop.reorderDockItem(dragSource.appId, targetIndex);
                } else if (dragSource.type === 'desktop') {
                    // 桌面 App 拖到 Dock：在末尾插入
                    if (dockApps.value.length >= DOCK_MAX_COUNT) {
                        island.showInfo?.('mini', { type: 'warning', title: 'Dock 已满', message: `最多放 ${DOCK_MAX_COUNT} 个` });
                    } else {
                        desktop.addDockItem(dragSource.appId);
                    }
                }
                dragSource = null;
                dockDropTargetIndex.value = -1;
                draggingDockId.value = '';
            }

            function onOpenDockAdder() {
                const addable = desktop.listDockAddable();
                dockAdderItems.value = addable;
                dockAdderOpen.value = true;
            }

            function onCloseDockAdder() {
                dockAdderOpen.value = false;
            }

            function onPickDockAdderItem(appId) {
                desktop.addDockItem(appId);
                dockAdderOpen.value = false;
            }

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

            // ★ 三模式渲染桥接器（template / hybrid / vue）
            // 监控 currentPageView / currentDetailView 变化，按 app.renderMode 走不同渲染路径
            const rendererBridge = bindAppRendererBridge({
                apps,
                activeApp: navigation.activeApp,
                activeAppId: navigation.activeAppId,
                activeRootPageId: navigation.activeRootPageId,
                currentPageView: navigation.currentPageView,
                currentDetailView: navigation.currentDetailView,
                currentPageContent: navigation.currentPageContent,
                currentRootPage: navigation.currentRootPage,
                currentDetailPage: navigation.currentDetailPage,
                currentDetailContent: navigation.currentDetailContent,
                // ★ 改成 navigation.detailRenderTick（之前这里引用了 core-shim 自己的同名 ref）
                detailRenderTick: navigation.detailRenderTick,
                // ★ 关键：传 ref 本身，syncRenderer 内部每次都 .value 读取最新值
                // 如果传 () => appScreenPanel.value，setup 里创建时 ref.value 还是 null（Vue 未渲染）
                // 传 ref 对象让 bridge 自己 .value 读取，保证拿到最新的 DOM ref
                getScreenPanelEl: appScreenPanel,
                getDetailPanelEl: appDetailPanel,
            });

            return {
                systemTime,
                apps,
                widgetBoard,
                dockApps,
                desktopPages: desktop.desktopPages,
                desktopPageDots: desktop.desktopPageDots,
                activeDesktopPage: desktop.activeDesktopPage,
                desktopGridRows: desktop.desktopGridRows,
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
                activeAppTopbar: navigation.activeAppTopbar,
                topbarStyle: navigation.topbarStyle,
                activeAppBackgroundStyle: navigation.activeAppBackgroundStyle,
                currentPageContent: navigation.currentPageContent,
                currentPageView: navigation.currentPageView,
                currentDetailContent: navigation.currentDetailContent,
                currentDetailTitle: navigation.currentDetailTitle,
                currentDetailSubtitle: navigation.currentDetailSubtitle,
                currentDetailView: navigation.currentDetailView,
                currentDetailPage: navigation.currentDetailPage,
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
                emitChatComponentEvent: navigation.emitChatComponentEvent,
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
                appScreenPanel,
                appDetailPanel,
                // 新增：三模式渲染桥接器
                appRendererBridge: rendererBridge,
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
                // dock 编辑
                deleteDockItem: desktop.deleteDockItem,
                addDockItem: desktop.addDockItem,
                reorderDockItem: desktop.reorderDockItem,
                listDockRemoved: desktop.listDockRemoved,
                listDockAddable: desktop.listDockAddable,
                isDockApp: desktop.isDockApp,
                // dock drag/drop
                draggingDockId,
                dockDropTargetIndex,
                dockMaxCount: DOCK_MAX_COUNT,
                dockAdderOpen,
                dockAdderItems,
                onDesktopAppDragStart,
                onDesktopAppDragEnd,
                onDockItemDragStart,
                onDockItemDragOver,
                onDockItemDragEnd,
                onDockContainerDragOver,
                onDockContainerDrop,
                onDockItemPointerDown,
                onDockItemPointerMove,
                onDockItemPointerUp,
                onDockItemPointerCancel,
                onOpenDockAdder,
                onCloseDockAdder,
                onPickDockAdderItem,
                renderWidgetBody,
                widgetSizeLabel,
                ...island,
                // 顶层确认弹窗（独立于 activeApp）
                confirmRequest,
                onConfirmOk: () => closeConfirm('ok'),
                onConfirmCancel: () => closeConfirm('cancel'),
                // nav-tab icon escape(给 index.html v-html 调)
                // 用于把 tab.icon 字符串 escape 后用 v-html 渲染,避免 XSS
                escapeTabIcon(text) {
                    if (text == null || text === '') return '•';
                    return String(text)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                },
            };
        }
    });

    // ★ 暴露 topbar 覆盖 ref 已移到 setup 内 line 261，避免时序问题

    systemData.mount('#phone');
    console.log('[framework/core-shim] systemData mounted');
    if (typeof window !== 'undefined') {
        console.log('[framework/core-shim] POST-MOUNT __appTopbarOverride=', !!window.__appTopbarOverride, 'value:', window.__appTopbarOverride && window.__appTopbarOverride.value);
    }
}

// 自动 bootstrap（仅在 DOM 已就绪时）。允许其他 ESM 模块导入但不立即挂载。
if (typeof window !== 'undefined' && document.readyState !== 'loading') {
    bootstrapSystemData();
} else if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', bootstrapSystemData);
}