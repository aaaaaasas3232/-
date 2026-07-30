/**
 * 小听框架 - 桌面编辑（Vue 组合）
 * 管理桌面 app 图标的分页、长按进入编辑模式、拖拽重排、桌面 swipe 翻页。
 *
 * 翻页采用 CSS data-active-page 控制；swipe 期间直接操作 DOM inline style，
 * 不走 Vue ref，避免每帧 reactive 重算带来的卡顿。
 */
import { UI_CONSTANTS, ISLAND_CLOSE_REASONS, createPressState, resetPressState } from './utils.js';

// === widget footprint: 每种 size 在 4 列网格里占多大 ===
// 当前 .desktop-grid 是 4 列固定,每页 16 个线性 slot (= 4x4)。
//
// boardItems 仍然每个 widget 占 1 个 slot(保持现有拖拽算法不变),但 CSS 渲染时 widget 用
// grid-row: span N / grid-column: span M 跨多个物理格。grid 自身仍然是 grid-auto-flow: row,
// widget 后续的 item 会自动绕过 widget 占的物理格、跳到下一个空 slot。
// 唯一代价:跨格 widget 后续的 app 在视觉上会有"跳格"现象 —— 这是符合预期的。
//
// S 横 (2x1)   → footprint = { cols: 2, rows: 1 }   占 2 cells
// S 竖 (1x2)   → footprint = { cols: 1, rows: 2 }   占 2 cells
// M    (2x2)   → footprint = { cols: 2, rows: 2 }   占 4 cells
// L    (4x2)   → footprint = { cols: 4, rows: 2 }   占 8 cells  (横长,默认方向)
// 1x1 (兼容)   → footprint = { cols: 1, rows: 1 }   占 1 cell
const WIDGET_SIZE_FOOTPRINT = {
    S_h: { cols: 2, rows: 1, cssClass: 'widgetSize-S widgetOrient-h' },
    S_v: { cols: 1, rows: 2, cssClass: 'widgetSize-S widgetOrient-v' },
    M:   { cols: 2, rows: 2, cssClass: 'widgetSize-M' },
    L:   { cols: 4, rows: 2, cssClass: 'widgetSize-L' },
};
const WIDGET_FALLBACK_FOOTPRINT = { cols: 1, rows: 1, cssClass: '' };

// 把 widget 注册项 + size + orientation 规范化成"含 footprint 的 board item"
function resolveWidgetFootprint(widget) {
    const size = widget?.size || 'S';
    const orientation = widget?.orientation || (size === 'S' ? 'h' : null);
    const key = size === 'S' ? `S_${orientation}` : size;
    const fp = WIDGET_SIZE_FOOTPRINT[key] || WIDGET_FALLBACK_FOOTPRINT;
    return {
        cols: fp.cols,
        rows: fp.rows,
        cssClass: fp.cssClass,
        size,
        orientation: size === 'S' ? orientation : null,
    };
}

export function useDesktopEdit({ apps, widgetBoard, appRegistry, island, activeAppId, openApp, openModal, closeModal }) {
    const { LONG_PRESS_MS, ICON_DRAG_THRESHOLD } = UI_CONSTANTS;
    const DESKTOP_GRID_COLUMNS = 4;
    const DESKTOP_GRID_ROWS = 4;
    const DESKTOP_PAGE_SIZE = DESKTOP_GRID_COLUMNS * DESKTOP_GRID_ROWS;
    const PAGE_EDGE_SWITCH_THRESHOLD = 24;
    const SWIPE_HORIZONTAL_THRESHOLD = 10;
    const SWIPE_LOCK_RATIO = 1.2;
    const SWIPE_TURN_RATIO = 0.18;
    const SWIPE_TURN_DISTANCE_PX = 60;
    const SWIPE_ANIM_MS = 320;
    // 橡皮筋阻力系数（越大越不涩，越小越涩）
    // iOS 经典值约 0.55，这里 0.5 给一点点阻力感
    const RUBBER_BAND_C = 0.5;
    const isEditMode = Vue.ref(false);
    const draggingIconId = Vue.ref('');
    // 拖动视觉偏移：拖动时高频改写（每帧 1~2 次）。
    // 不走 Vue ref：ref 在 pointermove 频率下会触发 :style 响应式 patch + 整页 v-for 重排，
    // 是桌面编辑模式肉眼可见卡顿的最大来源。
    // 改为普通对象 + rAF 帧内直接写 inline transform。
    const dragVisualOffset = { x: 0, y: 0 };
    // "目标格"索引：手指下当前指向的格子（拖动期间由 rAF 计算并落地为其他 icon 的平移）。
    // 同样是普通变量，不走 ref —— 它的变化只驱动 transform 重写，不应该触发任何 patch。
    let currentTargetIndex = -1;
    const lastEditActionAt = Vue.ref(0);
    const activeDesktopPage = Vue.ref(0);
    const pressState = createPressState();
    // 拖动专用 RAF 状态：合并高频 pointermove 到每帧最多一次
    const dragRafState = {
        rafId: 0,
        pendingX: 0,
        pendingY: 0,
        pendingClientX: 0,
        pendingClientY: 0,
        draggingElement: null,
    };
    // 拖动中的落点虚影和固定在视口上的拖动副本。
    const dragState = {
        ghostOverlay: null,
        liftOverlay: null,
        draggingElement: null,
        sourceRect: null,
        visualSize: null,
        liftScale: 1,
        lastPageSwitchAt: 0,
        pageSwitchTimer: 0,
    };
    const swipeState = {
        active: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startPage: 0,
        moved: false,
        cancelled: false,
        settleTimer: 0,
        skipNextWatch: false,
    };

    // === Board item 抽象 ===
    // boardItems 是单一权威（混合 app 和 widget）。
    // - apps / widgetBoard 是反向同步的派生视图（仅供少数读取使用）。
    // - 启动时按 apps 顺序初始化；后续 apps / widgetBoard 变化 → 增量同步进 boardItems。
    // - 拖拽重排直接修改 boardItems；watch 反向刷 apps / widgetBoard。
    // - 加 suppress flags 是为了打破"反向刷 set apps 触发 apps watch 又改 boardItems"的循环。

    const boardItems = Vue.ref([]);
    function initBoardItemsFromApps() {
        for (const app of apps.value) {
            boardItems.value.push({ kind: 'app', id: `app::${app.id}`, app });
        }
    }
    initBoardItemsFromApps();

    let suppressAppSync = false;
    function syncFromApps() {
        if (suppressAppSync) return;
        const externalAppIds = new Set(apps.value.map(a => a.id));
        const externalAppsById = new Map();
        for (const a of apps.value) externalAppsById.set(a.id, a);
        let mutated = false;
        for (let i = boardItems.value.length - 1; i >= 0; i--) {
            const item = boardItems.value[i];
            if (item.kind === 'app' && !externalAppIds.has(item.app.id)) {
                boardItems.value.splice(i, 1);
                mutated = true;
            }
        }
        for (const item of boardItems.value) {
            if (item.kind === 'app') {
                const fresh = externalAppsById.get(item.app.id);
                if (fresh && fresh !== item.app) {
                    item.app = fresh;
                    item.id = `app::${fresh.id}`;
                    mutated = true;
                }
            }
        }
        const existingAppIds = new Set(
            boardItems.value.filter(b => b.kind === 'app').map(b => b.app.id)
        );
        for (const a of apps.value) {
            if (!existingAppIds.has(a.id)) {
                boardItems.value.push({ kind: 'app', id: `app::${a.id}`, app: a });
                mutated = true;
            }
        }
        if (mutated) {
            boardItems.value = [...boardItems.value];
        }
    }

    let suppressWidgetSync = false;
    function syncFromWidgets() {
        if (suppressWidgetSync) return;
        const externalInstIds = new Set(widgetBoard.value.map(w => w.instanceId));
        let mutated = false;
        for (let i = boardItems.value.length - 1; i >= 0; i--) {
            const item = boardItems.value[i];
            if (item.kind === 'widget' && !externalInstIds.has(item.widget.instanceId)) {
                boardItems.value.splice(i, 1);
                mutated = true;
            }
        }
        const existingInstIds = new Set(
            boardItems.value.filter(b => b.kind === 'widget').map(b => b.widget.instanceId)
        );
        for (const w of widgetBoard.value) {
            if (!existingInstIds.has(w.instanceId)) {
                const footprint = resolveWidgetFootprint(w);
                boardItems.value.push({
                    kind: 'widget',
                    id: `widget::${w.qualifiedId}::${w.instanceId}`,
                    widget: w,
                    footprint,
                });
                mutated = true;
            } else {
                // size / orientation 变更后更新 footprint
                const existing = boardItems.value.find(b => b.kind === 'widget' && b.widget.instanceId === w.instanceId);
                if (existing) {
                    const freshFootprint = resolveWidgetFootprint(w);
                    if (
                        existing.footprint?.cols !== freshFootprint.cols
                        || existing.footprint?.rows !== freshFootprint.rows
                        || existing.footprint?.cssClass !== freshFootprint.cssClass
                    ) {
                        existing.footprint = freshFootprint;
                        mutated = true;
                    }
                }
            }
        }
        if (mutated) {
            boardItems.value = [...boardItems.value];
        }
    }

    // 把 boardItems 拍回 apps / widgetBoard：拖拽重排后用得到。
    function syncAppsAndWidgetsFromBoard() {
        const newApps = [];
        const newWidgets = [];
        for (const item of boardItems.value) {
            if (item.kind === 'app') newApps.push(item.app);
            else newWidgets.push(item.widget);
        }
        // 仅在内容真正变化时赋值，让外部 watcher 不必要的触发被省掉；
        // suppress 阻断反向 sync。
        const sameApps = apps.value.length === newApps.length
            && apps.value.every((a, i) => a === newApps[i]);
        const sameWidgets = widgetBoard.value.length === newWidgets.length
            && widgetBoard.value.every((w, i) => w === newWidgets[i]);
        if (sameApps && sameWidgets) return;
        suppressAppSync = true;
        suppressWidgetSync = true;
        if (!sameApps) apps.value = newApps;
        if (!sameWidgets) widgetBoard.value = newWidgets;
        Vue.nextTick(() => {
            suppressAppSync = false;
            suppressWidgetSync = false;
        });
    }

    Vue.watch(apps, syncFromApps);
    Vue.watch(widgetBoard, syncFromWidgets);
    Vue.watch(boardItems, syncAppsAndWidgetsFromBoard);

    function footprintOfItem(item) {
        if (item.kind === 'app') {
            return { cols: 1, rows: 1 };
        }
        return {
            cols: Math.min(DESKTOP_GRID_COLUMNS, Math.max(1, item.footprint?.cols || 1)),
            rows: Math.min(DESKTOP_GRID_ROWS, Math.max(1, item.footprint?.rows || 1)),
        };
    }

    function findFreePlacement(occupied, footprint) {
        for (let cell = 0; cell < DESKTOP_PAGE_SIZE; cell += 1) {
            const row = Math.floor(cell / DESKTOP_GRID_COLUMNS);
            const column = cell % DESKTOP_GRID_COLUMNS;
            if (column + footprint.cols > DESKTOP_GRID_COLUMNS || row + footprint.rows > DESKTOP_GRID_ROWS) {
                continue;
            }
            let available = true;
            for (let y = row; y < row + footprint.rows && available; y += 1) {
                for (let x = column; x < column + footprint.cols; x += 1) {
                    if (occupied[y * DESKTOP_GRID_COLUMNS + x]) {
                        available = false;
                        break;
                    }
                }
            }
            if (available) {
                return { row, column, cell };
            }
        }
        return null;
    }

    function occupyPlacement(occupied, placement, footprint) {
        for (let y = placement.row; y < placement.row + footprint.rows; y += 1) {
            for (let x = placement.column; x < placement.column + footprint.cols; x += 1) {
                occupied[y * DESKTOP_GRID_COLUMNS + x] = true;
            }
        }
    }

    // 分页和 CSS 实际落格共用同一个 4×4 规划结果，避免 widget 面积和数据项索引混用。
    function planDesktopPages(items) {
        const pages = [];
        let pageItems = [];
        let occupied = Array(DESKTOP_PAGE_SIZE).fill(false);
        let pageIndex = 0;

        for (let boardIndex = 0; boardIndex < items.length; boardIndex += 1) {
            const item = items[boardIndex];
            const footprint = footprintOfItem(item);
            let placement = findFreePlacement(occupied, footprint);
            if (!placement && pageItems.length) {
                pages.push(pageItems);
                pageItems = [];
                occupied = Array(DESKTOP_PAGE_SIZE).fill(false);
                pageIndex += 1;
                placement = findFreePlacement(occupied, footprint);
            }
            if (!placement) {
                placement = { row: 0, column: 0, cell: 0 };
            }
            occupyPlacement(occupied, placement, footprint);
            pageItems.push({
                ...item,
                desktopLayout: {
                    pageIndex,
                    boardIndex,
                    cell: placement.cell,
                    row: placement.row,
                    column: placement.column,
                },
            });
        }
        if (pageItems.length || pages.length === 0) {
            pages.push(pageItems);
        }
        return pages;
    }

    const desktopPages = Vue.computed(() => planDesktopPages(boardItems.value));
    const desktopPageDots = Vue.computed(() => desktopPages.value.map((_, page) => ({ page })));

    function getDesktopGridItemStyle(item) {
        const layout = item.desktopLayout;
        const footprint = footprintOfItem(item);
        if (!layout) return {};
        return {
            gridColumn: `${layout.column + 1} / span ${footprint.cols}`,
            gridRow: `${layout.row + 1} / span ${footprint.rows}`,
        };
    }

    function getPageBoardRange(pageIndex) {
        const page = desktopPages.value[pageIndex] || [];
        if (!page.length) {
            return { start: boardItems.value.length, end: boardItems.value.length };
        }
        return {
            start: page[0].desktopLayout.boardIndex,
            end: page[page.length - 1].desktopLayout.boardIndex + 1,
        };
    }

    // 监听 activeDesktopPage 变化（非 swipe 触发时同步 transform）
    Vue.watch(activeDesktopPage, (newPage, oldPage) => {
        // swipe 内部触发时跳过（animateToTargetPage 已经做了）
        if (swipeState.skipNextWatch) {
            swipeState.skipNextWatch = false;
            return;
        }
        // mounted 时 fallback：直接同步 transform（无过渡）
        if (oldPage === undefined) {
            Vue.nextTick(() => {
                syncTransformsToActivePage(newPage);
            });
        }
    });

    // 监听 desktopPages 数量变化，保证当前页合法并同步 transform。
    Vue.watch(desktopPages, (pages) => {
        const maxPageIndex = Math.max(0, pages.length - 1);
        if (activeDesktopPage.value > maxPageIndex) {
            activeDesktopPage.value = maxPageIndex;
        }
        Vue.nextTick(() => {
            syncTransformsToActivePage(activeDesktopPage.value);
            if (draggingIconId.value) refreshGridMetrics();
        });
    });

    function resetPressStateLocal() {
        resetPressState(pressState);
    }

    function clearPressTimer() {
        if (pressState.timer) {
            clearTimeout(pressState.timer);
            pressState.timer = null;
        }
    }

    function goToDesktopPage(pageIndex) {
        const maxPageIndex = Math.max(0, desktopPages.value.length - 1);
        const targetPage = Math.min(Math.max(pageIndex, 0), maxPageIndex);
        if (targetPage === activeDesktopPage.value) {
            return;
        }
        // 用 WAAPI 跑平滑过渡动画
        if (typeof Element !== 'undefined' && Element.prototype.animate) {
            animateToTargetPage(targetPage);
        } else {
            // fallback：直接同步
            cancelRunningSettleAnimations();
            syncTransformsToActivePage(targetPage);
            activeDesktopPage.value = targetPage;
        }
    }

    // toIndex 是“原数组中的插入缝隙”，范围为 0..length。
    function reorderApps(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= boardItems.value.length || toIndex < 0
            || toIndex > boardItems.value.length) {
            return false;
        }
        const reordered = [...boardItems.value];
        const moved = reordered.splice(fromIndex, 1)[0];
        const destination = Math.min(reordered.length, toIndex > fromIndex ? toIndex - 1 : toIndex);
        if (destination === fromIndex) {
            return false;
        }
        reordered.splice(destination, 0, moved);
        boardItems.value = reordered;
        return true;
    }

    function refreshGridMetrics() {
        pressState.gridRect = getGridMetrics();
    }

    function getGridMetrics() {
        const pages = Array.from(document.querySelectorAll('.currentPage'));
        const activePageElement = pages[activeDesktopPage.value] || pages[0] || null;
        const grid = activePageElement?.querySelector('.desktop-grid');
        if (!grid) {
            return null;
        }
        const items = Array.from(grid.querySelectorAll('.appContainer'));
        const gridRect = grid.getBoundingClientRect();
        const pageItems = desktopPages.value[activeDesktopPage.value] || [];
        const points = items.map(item => {
            const touch = item.querySelector('.appTouch');
            const itemId = touch?.dataset?.itemId || '';
            const plannedItem = pageItems.find(entry => entry.id === itemId);
            const rect = item.getBoundingClientRect();
            return {
                itemId,
                boardIndex: plannedItem?.desktopLayout?.boardIndex ?? findBoardItemIndexById(itemId),
                cell: plannedItem?.desktopLayout?.cell ?? 0,
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
            };
        });
        const range = getPageBoardRange(activeDesktopPage.value);
        return {
            pageIndex: activeDesktopPage.value,
            pageStartIndex: range.start,
            pageEndIndex: range.end,
            gridRect,
            points,
        };
    }

    // 基于"物理布局"的最近格查找 —— 被拖图标自身不再占位，
    // 详见 processDragFrame 调用点的说明。旧版 getGridIndexFromPoint 在新版里被替换为
    // computeTargetIndex，因此这里移除旧实现。

    function maybeSwitchPageFromEdge(clientX) {
        const totalPages = desktopPages.value.length;
        if (totalPages <= 1 || Date.now() - dragState.lastPageSwitchAt < SWIPE_ANIM_MS + 80) {
            return false;
        }
        const desktopRect = document.querySelector('.desktopPages')?.getBoundingClientRect();
        if (!desktopRect) {
            return false;
        }
        let targetPage = activeDesktopPage.value;
        if (clientX < desktopRect.left + PAGE_EDGE_SWITCH_THRESHOLD && targetPage > 0) {
            targetPage -= 1;
        } else if (clientX > desktopRect.right - PAGE_EDGE_SWITCH_THRESHOLD && targetPage < totalPages - 1) {
            targetPage += 1;
        }
        if (targetPage === activeDesktopPage.value) {
            return false;
        }
        const previousPage = activeDesktopPage.value;
        dragState.lastPageSwitchAt = Date.now();
        clearAllShuffleTransforms();
        hideDragGhostOverlay();
        pressState.gridRect = null;
        const targetRange = getPageBoardRange(targetPage);
        currentTargetIndex = targetPage < previousPage ? targetRange.end : targetRange.start;
        goToDesktopPage(targetPage);
        if (dragState.pageSwitchTimer) clearTimeout(dragState.pageSwitchTimer);
        dragState.pageSwitchTimer = setTimeout(() => {
            dragState.pageSwitchTimer = 0;
            pressState.gridRect = getGridMetrics();
            if (!dragRafState.rafId && draggingIconId.value) {
                dragRafState.rafId = requestAnimationFrame(processDragFrame);
            }
        }, SWIPE_ANIM_MS + 30);
        return true;
    }

    function enterEditMode() {
        isEditMode.value = true;
        lastEditActionAt.value = Date.now();
    }

    function exitEditMode() {
        isEditMode.value = false;
        clearPressTimer();
        // 复位可能还在偏移的图标 inline transform
        const draggingEl = resolveDraggingElement();
        if (draggingEl) draggingEl.style.transform = '';
        clearAllShuffleTransforms();
        removeDragGhostOverlay();
        removeDragLiftOverlay();
        if (dragState.pageSwitchTimer) {
            clearTimeout(dragState.pageSwitchTimer);
            dragState.pageSwitchTimer = 0;
        }
        resetPressStateLocal();
        if (dragRafState.rafId) {
            cancelAnimationFrame(dragRafState.rafId);
            dragRafState.rafId = 0;
        }
        dragRafState.draggingElement = null;
        draggingIconId.value = '';
        dragVisualOffset.x = 0;
        dragVisualOffset.y = 0;
        currentTargetIndex = -1;
        lastEditActionAt.value = Date.now();
    }

    function getDesktopAppStyle() {
        // 拖动视觉由固定在 viewport 的 lift overlay 承担，原节点只保留占位。
        return {};
    }

    // 跨页时原节点会跟页面一起滑走，所以拖动视觉使用固定在 viewport 的克隆。
    function ensureDragLiftOverlay(element) {
        let lift = dragState.liftOverlay;
        if (lift && lift.isConnected) return lift;
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const sourceWidth = element.offsetWidth || rect.width;
        const sourceHeight = element.offsetHeight || rect.height;
        const viewportScale = sourceWidth > 0 ? rect.width / sourceWidth : 1;
        const clone = element.cloneNode(true);
        clone.classList.remove('editing', 'dragging');
        clone.classList.add('drag-lift-overlay');
        clone.querySelectorAll('.edit-remove-button').forEach(button => button.remove());
        clone.style.cssText += `;position:fixed;left:${rect.left}px;top:${rect.top}px;width:${sourceWidth}px;height:${sourceHeight}px;margin:0;pointer-events:none;z-index:10000;transform-origin:top left;transition:none;animation:none;will-change:transform;`;
        document.body.appendChild(clone);
        dragState.liftOverlay = clone;
        dragState.sourceRect = rect;
        dragState.visualSize = { width: rect.width, height: rect.height };
        dragState.liftScale = viewportScale * 1.06;
        element.style.opacity = '0.2';
        return clone;
    }

    function updateDragLiftOverlay(element, x, y) {
        const lift = ensureDragLiftOverlay(element);
        if (!lift) return;
        lift.style.transform = `translate(${x}px, ${y}px) scale(${dragState.liftScale})`;
    }

    function removeDragLiftOverlay() {
        const original = dragState.draggingElement || resolveDraggingElementLocal();
        if (original) {
            original.style.opacity = '';
            original.style.transform = '';
        }
        if (dragState.liftOverlay?.parentNode) {
            dragState.liftOverlay.parentNode.removeChild(dragState.liftOverlay);
        }
        dragState.liftOverlay = null;
        dragState.sourceRect = null;
        dragState.visualSize = null;
    }

    // 拿到当前被拖图标对应的 .appContainer 元素（每帧重查，因为 v-for 顺序变了）
    function resolveDraggingElement() {
        return resolveContainerByItemId(draggingIconId.value);
    }

    function findBoardItemIndexById(boardItemId) {
        return boardItems.value.findIndex(item => item.id === boardItemId);
    }

    function onAppPointerDown(item, event) {
        if (activeAppId.value) {
            return;
        }

        const boardItemId = item.id;
        const index = findBoardItemIndexById(boardItemId);
        if (index === -1) {
            return;
        }

        if (swipeState.active) {
            resetSwipeState();
        }

        pressState.gridRect = getGridMetrics();
        pressState.pointerId = event.pointerId;
        event.currentTarget?.setPointerCapture?.(event.pointerId);

        if (isEditMode.value) {
            clearPressTimer();
            pressState.appId = boardItemId;
            pressState.startX = event.clientX;
            pressState.startY = event.clientY;
            pressState.currentIndex = index;
            pressState.sourceIndex = index;
            pressState.isDragging = false;
            pressState.longPressed = true;
            pressState.itemKind = item.kind;
            draggingIconId.value = boardItemId;
            lastEditActionAt.value = Date.now();
            dragRafState.draggingElement = event.currentTarget?.parentElement || null;
            dragState.draggingElement = dragRafState.draggingElement;
            currentTargetIndex = index;
            return;
        }

        clearPressTimer();
        pressState.appId = boardItemId;
        pressState.startX = event.clientX;
        pressState.startY = event.clientY;
        pressState.currentIndex = index;
        pressState.sourceIndex = index;
        pressState.isDragging = false;
        pressState.longPressed = false;
        pressState.itemKind = item.kind;

        // 长按进入编辑模式：widgets 也可以长按触发（widgets 进入编辑态后可以被拖动）
        pressState.timer = setTimeout(() => {
            enterEditMode();
            draggingIconId.value = boardItemId;
            pressState.longPressed = true;
            dragRafState.draggingElement = event.currentTarget?.parentElement || null;
            dragState.draggingElement = dragRafState.draggingElement;
            currentTargetIndex = index;
            Vue.nextTick(() => {
                refreshGridMetrics();
            });
            // 灵动岛提示：进入编辑模式
            // 携带 lifecycle='manual' + closeReason='editMode'，让 framework 知道这是
            // "被编辑模式接管"，退出编辑模式时会从栈恢复上一个 owner（比如音乐岛）。
            island.showInfo('mini', {
                type: 'system',
                title: '编辑桌面',
                lifecycle: 'manual',
                maxSize: 'mini',
                closeReason: 'editMode',
            });
        }, LONG_PRESS_MS);
    }

    function onAppPointerMove(event) {
        if (!pressState.appId) {
            return;
        }

        const dx = event.clientX - pressState.startX;
        const dy = event.clientY - pressState.startY;

        if (!pressState.longPressed) {
            if (Math.abs(dx) > ICON_DRAG_THRESHOLD || Math.abs(dy) > ICON_DRAG_THRESHOLD) {
                clearPressTimer();
            }
            return;
        }

        pressState.isDragging = true;
        lastEditActionAt.value = Date.now();

        // 高频路径：仅缓存最新坐标 + 触发 rAF，不做任何 reactive 写入
        dragVisualOffset.x = dx;
        dragVisualOffset.y = dy;
        dragRafState.pendingX = dx;
        dragRafState.pendingY = dy;
        dragRafState.pendingClientX = event.clientX;
        dragRafState.pendingClientY = event.clientY;

        if (!dragRafState.rafId) {
            dragRafState.rafId = requestAnimationFrame(processDragFrame);
        }
    }

    function buildDragCandidate(insertionIndex) {
        const fromIndex = pressState.sourceIndex;
        if (fromIndex < 0 || fromIndex >= boardItems.value.length) return null;
        const candidate = [...boardItems.value];
        const moved = candidate.splice(fromIndex, 1)[0];
        const destination = Math.min(candidate.length, insertionIndex > fromIndex ? insertionIndex - 1 : insertionIndex);
        candidate.splice(Math.max(0, destination), 0, moved);
        const pages = planDesktopPages(candidate);
        let draggedLayout = null;
        for (const page of pages) {
            const entry = page.find(item => item.id === moved.id);
            if (entry) {
                draggedLayout = entry.desktopLayout;
                break;
            }
        }
        return { pages, draggedLayout };
    }

    function getGridGeometry(gridRect) {
        const scale = gridRect.width > 0 ? gridRect.width / 284 : 1;
        return {
            cellWidth: 56 * scale,
            cellHeight: 76 * scale,
            columnPitch: 76 * scale,
            rowPitch: 94 * scale,
        };
    }

    function pointForLayout(gridRect, layout) {
        const geometry = getGridGeometry(gridRect);
        return {
            left: gridRect.left + layout.column * geometry.columnPitch,
            top: gridRect.top + layout.row * geometry.rowPitch,
        };
    }

    function processDragFrame() {
        dragRafState.rafId = 0;
        const { pendingX, pendingY, pendingClientX, pendingClientY } = dragRafState;
        const id = draggingIconId.value;
        if (!id) return;

        let el = dragRafState.draggingElement;
        if (!el || !el.isConnected) {
            el = resolveDraggingElement();
            dragRafState.draggingElement = el;
        }
        dragState.draggingElement = el;
        updateDragLiftOverlay(el, pendingX, pendingY);

        if (maybeSwitchPageFromEdge(pendingClientX) || dragState.pageSwitchTimer) {
            hideDragGhostOverlay();
            return;
        }

        const metrics = pressState.gridRect || getGridMetrics();
        if (!metrics) return;
        pressState.gridRect = metrics;

        const targetIndex = computeTargetIndex(metrics, pendingClientX, pendingClientY);
        if (targetIndex !== currentTargetIndex) {
            currentTargetIndex = targetIndex;
            applyShuffleTransforms(metrics, targetIndex);
        }

        if (targetIndex !== -1) {
            updateDragGhostOverlay(metrics, targetIndex);
        } else {
            hideDragGhostOverlay();
        }
    }

    function computeTargetIndex(metrics, clientX, clientY) {
        const { gridRect, points, pageStartIndex, pageEndIndex } = metrics;
        const edgeInset = 6;
        if (
            clientX < gridRect.left - edgeInset ||
            clientX > gridRect.right + edgeInset ||
            clientY < gridRect.top - edgeInset ||
            clientY > gridRect.bottom + edgeInset
        ) {
            return -1;
        }
        if (!points.length) return pageStartIndex;

        const draggingId = draggingIconId.value;
        let nearest = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const point of points) {
            if (point.itemId === draggingId) continue;
            const dx = clientX - point.centerX;
            const dy = clientY - point.centerY;
            const distance = dx * dx + dy * dy;
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = point;
            }
        }
        if (!nearest) return pageStartIndex;

        const draggingFootprint = pressState.sourceIndex >= 0
            ? footprintOfItem(boardItems.value[pressState.sourceIndex])
            : null;
        const isFullRowWidget = draggingFootprint && draggingFootprint.cols >= DESKTOP_GRID_COLUMNS;
        // 大号组件自身 footprint 比邻居大很多，用邻居高度算的吸附阈值太紧，
        // 手指稍微上挪就会"出列"导致落到下一行。按自己一行视觉高度放宽阈值。
        const dragRowPixel = draggingFootprint
            ? Math.max(1, draggingFootprint.rows) * (getGridGeometry(metrics.gridRect).rowPitch * 0.45)
            : 0;
        const sameRowThreshold = Math.max(nearest.height * 0.45, dragRowPixel);
        const sameVisualRow = Math.abs(clientY - nearest.centerY) < sameRowThreshold;
        // 满跨 widget（cols == DESKTOP_GRID_COLUMNS）只能占整行 col=0，
        // X 方向的 before/after 没有任何意义（不管手指在左在右，落点都必须是整行）。
        // 这里无视 clientX，按 clientY 决定插在 nearest 之前还是之后，
        // 避免"手指在 row=0 图标右侧"时仍被判定为 after=true、把 L 挤到下一行。
        const fullRowAfterInset = isFullRowWidget
            ? getGridGeometry(metrics.gridRect).rowPitch * 0.4
            : 0;
        const after = isFullRowWidget
            ? clientY > nearest.centerY + fullRowAfterInset
            : (sameVisualRow ? clientX > nearest.centerX : clientY > nearest.centerY);
        const rawInsertion = Math.min(pageEndIndex, Math.max(pageStartIndex, nearest.boardIndex + (after ? 1 : 0)));

        // 大组件在页尾可能会被规划到下一页。优先选择离手指最近、且组件确实能落在当前页的插入缝隙。
        const candidates = [];
        for (let insertion = pageStartIndex; insertion <= pageEndIndex; insertion += 1) {
            candidates.push(insertion);
        }
        candidates.sort((a, b) => Math.abs(a - rawInsertion) - Math.abs(b - rawInsertion));
        let nearestVisible = -1;
        for (const insertion of candidates) {
            const preview = buildDragCandidate(insertion);
            if (preview?.draggedLayout?.pageIndex === metrics.pageIndex) {
                return insertion;
            }
            if (nearestVisible === -1) {
                nearestVisible = insertion;
            }
        }
        return nearestVisible;
    }

    function applyShuffleTransforms(metrics, targetIndex) {
        clearAllShuffleTransforms();
        if (targetIndex === -1) return;
        const preview = buildDragCandidate(targetIndex);
        const targetPage = preview?.pages?.[metrics.pageIndex] || [];
        const targetById = new Map(targetPage.map(item => [item.id, item.desktopLayout]));

        for (const point of metrics.points) {
            if (point.itemId === draggingIconId.value) continue;
            const el = resolveContainerByItemId(point.itemId);
            const targetLayout = targetById.get(point.itemId);
            if (!el || !targetLayout) continue;
            const targetPoint = pointForLayout(metrics.gridRect, targetLayout);
            const dx = targetPoint.left - point.left;
            const dy = targetPoint.top - point.top;
            if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
                el.style.transform = `translate(${dx}px, ${dy}px)`;
            }
        }
    }

    // === 落点 ghost overlay ===
    // 拖动时在 targetIndex 物理位置上画一个"虚线蓝色描边空白 ghost",
    // 让用户能直观看到"放下后会出现什么位置 / 什么大小"。
    // 这是 iOS 风格的目标格高亮(我们用虚线描边更好看,且不依赖图片)。
    //
    // 实现要点:
    //   - ghost overlay 用 position: fixed,不参与任何 layout,直接用 viewport 坐标定位
    //   - 不走 reactive,直接 rAF 帧内 set inline style
    //   - 尺寸 = dragging element 自身的 footprint 尺寸(app 1x1 / S 横 2x1 / M 2x2 / L 4x2)
    //   - 位置 = 根据 targetIndex 反查 grid 物理坐标(top/left + col/row 偏移)
    function ensureDragGhostOverlay() {
        let ghost = dragState.ghostOverlay;
        if (ghost && ghost.isConnected) return ghost;
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost-overlay';
        ghost.style.cssText = 'position:fixed;pointer-events:none;border:2px dashed rgba(99,102,241,0.85);border-radius:18px;background:rgba(99,102,241,0.08);box-shadow:0 0 0 1px rgba(255,255,255,0.6) inset;z-index:9999;display:none;transition:width 0.18s cubic-bezier(0.2,0.8,0.2,1),height 0.18s cubic-bezier(0.2,0.8,0.2,1);will-change:left,top,width,height;';
        document.body.appendChild(ghost);
        dragState.ghostOverlay = ghost;
        return ghost;
    }

    function hideDragGhostOverlay() {
        const ghost = dragState.ghostOverlay;
        if (!ghost) return;
        ghost.style.display = 'none';
    }

    function removeDragGhostOverlay() {
        const ghost = dragState.ghostOverlay;
        if (!ghost) return;
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
        dragState.ghostOverlay = null;
    }

    function ghostPixelSize(draggingElement) {
        if (dragState.visualSize) {
            return { w: dragState.visualSize.width, h: dragState.visualSize.height };
        }
        const rect = draggingElement?.getBoundingClientRect?.();
        return {
            w: rect?.width || 56,
            h: rect?.height || 56,
        };
    }

    function updateDragGhostOverlay(metrics, targetIndex) {
        const ghost = ensureDragGhostOverlay();
        if (!ghost || !metrics.gridRect) return;
        const preview = buildDragCandidate(targetIndex);
        const layout = preview?.draggedLayout;
        if (!layout || layout.pageIndex !== metrics.pageIndex) {
            hideDragGhostOverlay();
            return;
        }
        const position = pointForLayout(metrics.gridRect, layout);
        const size = ghostPixelSize(dragState.draggingElement);
        ghost.style.display = 'block';
        ghost.style.boxSizing = 'border-box';
        ghost.style.left = `${position.left}px`;
        ghost.style.top = `${position.top}px`;
        ghost.style.width = `${size.w}px`;
        ghost.style.height = `${size.h}px`;
    }

    // 在拖动开始 / 落定前，清掉所有 appContainer 的 inline transform
    function clearAllShuffleTransforms() {
        const containers = document.querySelectorAll('.appContainer');
        for (let i = 0; i < containers.length; i += 1) {
            const el = containers[i];
            // 保留被拖 ghost 的 transform（在 pointerup 落定后再单独清）
            if (el.classList.contains('dragging')) continue;
            el.style.transform = '';
        }
    }

    // 拿到指定 boardItemId 对应的 .appContainer 元素
    function resolveContainerByItemId(itemId) {
        if (!itemId) return null;
        const touch = document.querySelector(`.appTouch[data-item-id="${CSS.escape(itemId)}"]`);
        return touch ? touch.parentElement : null;
    }

    // 拿到当前被拖图标对应的 .appContainer 元素
    function resolveDraggingElementLocal() {
        const id = draggingIconId.value;
        if (!id) return null;
        return resolveContainerByItemId(id);
    }

    function onAppPointerUp(item, event) {
        clearPressTimer();
        event?.currentTarget?.releasePointerCapture?.(pressState.pointerId);
        pressState.pointerId = null;

        // 清掉未消费的 rAF
        if (dragRafState.rafId) {
            cancelAnimationFrame(dragRafState.rafId);
            dragRafState.rafId = 0;
        }
        dragRafState.draggingElement = null;

        const longPressed = pressState.longPressed;
        const moved = pressState.isDragging;

        // 抬起时立刻隐藏落点 ghost，避免虚影卡在屏幕上
        hideDragGhostOverlay();

        if (longPressed) {
            finalizeDrag();
            resetPressStateLocal();
            lastEditActionAt.value = Date.now();
            return;
        }

        resetPressStateLocal();

        if (isEditMode.value || moved) {
            lastEditActionAt.value = Date.now();
            return;
        }

        // 单击：app 打开 app；widget 触发 widget 的 tap 行为（缺省打开宿主 app）。
        if (item.kind === 'widget') {
            triggerWidgetTap(item.widget);
        } else {
            openApp(item.app.id);
        }
    }

    // 拖动结束：把数据落定、重置 transform、清状态
    function finalizeDrag() {
        const fromIndex = pressState.currentIndex;
        const toIndex = currentTargetIndex;
        // 1) 先把被拖 ghost 的 transform 清掉（让它瞬间回到自己"占位"位置）
        const draggingEl = resolveDraggingElementLocal();
        if (draggingEl) draggingEl.style.transform = '';
        // 2) 清掉所有 shuffle 平移 —— icon 已经在 CSS transition 里平滑落回原位
        clearAllShuffleTransforms();
        // 3) 落点 ghost overlay 在 pointerup 抬起时立即消失
        hideDragGhostOverlay();
        // 拖动过程中目标是数组插入缝隙；落定时统一换算并重排。
        if (toIndex !== -1) {
            reorderApps(fromIndex, toIndex);
        }
        removeDragLiftOverlay();
        dragState.draggingElement = null;
        if (dragState.pageSwitchTimer) {
            clearTimeout(dragState.pageSwitchTimer);
            dragState.pageSwitchTimer = 0;
        }
        currentTargetIndex = -1;
        dragVisualOffset.x = 0;
        dragVisualOffset.y = 0;
        draggingIconId.value = '';
    }

    function onScreenPointerUp(event, { indicatorGesture, onHomeIndicatorUp }) {
        if (indicatorGesture.active && event?.pointerType === 'mouse') {
            onHomeIndicatorUp(event);
        }

        // widget picker 打开中：底下的 pointerup 不要顺手把 picker 收掉
        // （点击 picker 卡片本身是合法操作，picker 的关闭只能由"完成"按钮 / 桌面空白
        // 通过显式 onClose 触发）
        const eventTarget = event?.target;
        if (eventTarget && typeof eventTarget.closest === 'function') {
            if (eventTarget.closest('.widget-picker-overlay')) {
                return;
            }
        }

        if (!isEditMode.value || draggingIconId.value || activeAppId.value) {
            return;
        }
        // 如果 widget picker 已拉起，单击空白 → 退出编辑模式（包括 picker）
        if (Date.now() - lastEditActionAt.value < 160) {
            return;
        }
        // 通知 widget picker 关闭（如开）
        if (typeof window.closeWidgetPicker === 'function') {
            try { window.closeWidgetPicker(); } catch (e) {}
        }
        exitEditMode();
        island.closeIsland(ISLAND_CLOSE_REASONS.EDIT_MODE);
    }

    function resetSwipeState() {
        swipeState.active = false;
        swipeState.pointerId = null;
        swipeState.startX = 0;
        swipeState.startY = 0;
        swipeState.startPage = 0;
        swipeState.moved = false;
        swipeState.cancelled = false;
        if (swipeState.settleTimer) {
            clearTimeout(swipeState.settleTimer);
            swipeState.settleTimer = 0;
        }
    }

    function getAllCurrentPages() {
        return Array.from(document.querySelectorAll('.currentPage'));
    }

    function addSwipingClass() {
        getAllCurrentPages().forEach((el) => {
            el.classList.add('swiping');
        });
    }

    function removeSwipingClass() {
        getAllCurrentPages().forEach((el) => {
            el.classList.remove('swiping');
        });
    }

    // 计算每个 page 在 (baseActivePage, swipeDxPercent) 下的最终位置（百分比）
    function computeOffset(idx, baseActivePage, swipeDxPercent, totalPages) {
        return (idx - baseActivePage) * 100 + swipeDxPercent;
    }

    // 直接操作 DOM transform；transition 由 .swiping class 控制
    function applySwipeTransforms(baseActivePage, swipeDxPercent) {
        const pages = getAllCurrentPages();
        const totalPages = pages.length;
        pages.forEach((el) => {
            const idx = Number(el.dataset.pageIndex) || 0;
            const offset = computeOffset(idx, baseActivePage, swipeDxPercent, totalPages);
            el.style.transform = `translateX(${offset}%)`;
        });
    }

    function clearSwipeTransforms() {
        getAllCurrentPages().forEach((el) => {
            el.style.transform = '';
        });
    }

    function onDesktopPointerDown(event) {
        if (activeAppId.value || isEditMode.value || draggingIconId.value) {
            return;
        }
        if (desktopPages.value.length <= 1) {
            return;
        }
        const target = event.target;
        if (target && target !== event.currentTarget) {
            const insideApp = target.closest?.('.appContainer, .pageDots');
            if (insideApp) {
                return;
            }
        }
        // 如果上一次 swipe 还在 settle 中（transition 还在跑），取消动画并接管
        cancelRunningSettleAnimations();
        swipeState.active = true;
        swipeState.pointerId = event.pointerId;
        swipeState.startX = event.clientX;
        swipeState.startY = event.clientY;
        swipeState.startPage = activeDesktopPage.value;
        swipeState.moved = false;
        swipeState.cancelled = false;
        // 加 .swiping class（CSS 会把 transition 设为 none），保证 swipe 期间 0 滞后
        addSwipingClass();
        // 同步把每个 page 拨到当前 activeDesktopPage 对应的 transform
        // （因为上一次 settle 可能已经改了 inline，这里用绝对值覆盖保证起点正确）
        syncTransformsToActivePage(activeDesktopPage.value);
        event.currentTarget?.setPointerCapture?.(event.pointerId);
    }

    function onDesktopPointerMove(event) {
        if (!swipeState.active || swipeState.cancelled) {
            return;
        }
        const dx = event.clientX - swipeState.startX;
        const dy = event.clientY - swipeState.startY;

        if (!swipeState.moved) {
            if (Math.abs(dx) < SWIPE_HORIZONTAL_THRESHOLD && Math.abs(dy) < SWIPE_HORIZONTAL_THRESHOLD) {
                return;
            }
            if (Math.abs(dy) > Math.abs(dx) * SWIPE_LOCK_RATIO) {
                cancelRunningSettleAnimations();
                removeSwipingClass();
                syncTransformsToActivePage(activeDesktopPage.value);
                swipeState.cancelled = true;
                return;
            }
            swipeState.moved = true;
        }

        const totalPages = desktopPages.value.length;
        const width = event.currentTarget?.clientWidth || 1;
        // 边缘橡皮筋：iOS 风格，dx 越大移动比例越小（越滑越滞涩）
        // 在第一页右滑（dx>0）/ 最后一页左滑（dx<0）→ 启用橡皮筋
        let swipeDxPercent = (dx / width) * 100;
        if (swipeState.startPage === 0 && dx > 0) {
            const ratio = dx / width; // 0~N
            const damped = (ratio * RUBBER_BAND_C) / (RUBBER_BAND_C + ratio);
            swipeDxPercent = damped * 100;
        } else if (swipeState.startPage === totalPages - 1 && dx < 0) {
            const ratio = -dx / width;
            const damped = (ratio * RUBBER_BAND_C) / (RUBBER_BAND_C + ratio);
            swipeDxPercent = -damped * 100;
        }
        applySwipeTransforms(swipeState.startPage, swipeDxPercent);
    }

    // 取消所有正在跑的 settle 动画（CSS transition + Web Animations API）
    function cancelRunningSettleAnimations() {
        getAllCurrentPages().forEach((el) => {
            // 取消 Web Animations API 动画
            if (el.getAnimations) {
                el.getAnimations().forEach((anim) => anim.cancel());
            }
        });
        if (swipeState.settleTimer) {
            clearTimeout(swipeState.settleTimer);
            swipeState.settleTimer = 0;
        }
    }

    // 用 Web Animations API 平滑过渡到目标页（不依赖 CSS transition）
    function animateToTargetPage(targetPage) {
        const pages = getAllCurrentPages();
        const totalPages = pages.length;
        pages.forEach((el) => {
            const idx = Number(el.dataset.pageIndex) || 0;
            const targetOffset = (idx - targetPage) * 100;
            // 取消现有动画
            if (el.getAnimations) {
                el.getAnimations().forEach((anim) => anim.cancel());
            }
            // 用 WAAPI 跑过渡
            const startTransform = el.style.transform || getCssComputedTransform(el);
            const animation = el.animate(
                [
                    { transform: startTransform },
                    { transform: `translateX(${targetOffset}%)` }
                ],
                {
                    duration: SWIPE_ANIM_MS,
                    easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
                    fill: 'forwards'
                }
            );
            animation.onfinish = () => {
                // 动画结束后把 inline transform 设为最终值（保持状态）
                el.style.transform = `translateX(${targetOffset}%)`;
                if (animation.commitStyles) {
                    animation.commitStyles();
                }
                animation.cancel();
            };
        });
        // 同步更新 activeDesktopPage（让 pageDots 更新）
        // 注意：activeDesktopPage 的 watch 会触发，但 swipe 内部已经设好 transform，跳过
        swipeState.skipNextWatch = true;
        activeDesktopPage.value = targetPage;
        // 320ms 后确保所有 inline transform 都设到目标值
        if (swipeState.settleTimer) {
            clearTimeout(swipeState.settleTimer);
        }
        swipeState.settleTimer = setTimeout(() => {
            swipeState.settleTimer = 0;
            pages.forEach((el) => {
                const idx = Number(el.dataset.pageIndex) || 0;
                const targetOffset = (idx - targetPage) * 100;
                el.style.transform = `translateX(${targetOffset}%)`;
            });
        }, SWIPE_ANIM_MS + 30);
    }

    function getCssComputedTransform(el) {
        const computed = window.getComputedStyle(el);
        return computed.transform || 'translateX(0%)';
    }

    function syncTransformsToActivePage(targetPage) {
        getAllCurrentPages().forEach((el) => {
            const idx = Number(el.dataset.pageIndex) || 0;
            const offset = (idx - targetPage) * 100;
            el.style.transform = `translateX(${offset}%)`;
        });
    }

    function settleToPage(targetPage, opts = {}) {
        const anim = opts.animation !== false;
        // 取消可能正在跑的 WAAPI 动画
        cancelRunningSettleAnimations();
        // 移除 .swiping class
        removeSwipingClass();
        if (anim) {
            animateToTargetPage(targetPage);
        } else {
            syncTransformsToActivePage(targetPage);
        }
    }

    function onDesktopPointerUp(event) {
        if (!swipeState.active) {
            return;
        }
        event?.currentTarget?.releasePointerCapture?.(swipeState.pointerId);
        const dx = event.clientX - swipeState.startX;
        const width = event.currentTarget?.clientWidth || 1;
        const startPage = swipeState.startPage;
        const cancelled = swipeState.cancelled;

        let nextPage = startPage;
        if (swipeState.moved && !cancelled) {
            const distanceRatio = Math.abs(dx) / width;
            if (distanceRatio > SWIPE_TURN_RATIO || Math.abs(dx) > SWIPE_TURN_DISTANCE_PX) {
                nextPage = startPage + (dx < 0 ? 1 : -1);
            }
        }
        const totalPages = desktopPages.value.length;
        nextPage = Math.min(Math.max(nextPage, 0), totalPages - 1);

        settleToPage(nextPage, { animation: true });
        resetSwipeState();
    }

    function onDesktopPointerCancel() {
        if (!swipeState.active) {
            return;
        }
        settleToPage(activeDesktopPage.value, { animation: true });
        resetSwipeState();
    }

    function cancelAllPresses() {
        clearPressTimer();
        if (swipeState.active) {
            settleToPage(activeDesktopPage.value, { animation: false });
            resetSwipeState();
        }
        if (draggingIconId.value) {
            const el = resolveDraggingElementLocal();
            if (el) el.style.transform = '';
            clearAllShuffleTransforms();
            removeDragGhostOverlay();
            removeDragLiftOverlay();
            draggingIconId.value = '';
            dragVisualOffset.x = 0;
            dragVisualOffset.y = 0;
        }
        if (dragRafState.rafId) {
            cancelAnimationFrame(dragRafState.rafId);
            dragRafState.rafId = 0;
        }
        dragRafState.draggingElement = null;
        dragState.draggingElement = null;
        if (dragState.pageSwitchTimer) {
            clearTimeout(dragState.pageSwitchTimer);
            dragState.pageSwitchTimer = 0;
        }
        currentTargetIndex = -1;
        resetPressStateLocal();
    }

    // === widget 支持 ===
    // 单击 widget 的行为：调用 widget.onTap(qualifiedId, instanceId)，没有就降级为打开宿主 app。
    // 为了让 widget 能跟宿主交互，传入第三个 toolkit。
    function triggerWidgetTap(widgetEntry) {
        const hostApp = appRegistry?.getApp?.(widgetEntry.appId);
        const toolkit = hostApp?.toolkit || null;
        try {
            if (typeof widgetEntry.onTap === 'function') {
                const result = widgetEntry.onTap(widgetEntry.instanceId, widgetEntry.qualifiedId, {
                    toolkit,
                    app: hostApp,
                    island,
                });
                if (result === false) return; // widget 主动拒绝
                if (result === true) return; // 已处理，不再 fallback
            }
        } catch (e) {
            console.error('[widget tap]', e);
        }
        // fallback：打开 widget 所属 app
        if (widgetEntry.appId) {
            openApp(widgetEntry.appId);
        }
    }

    // 添加到用户当前正在看的页面；若该页空间不足，优先从页尾向前寻找可容纳的插入点，
    // 让后续图标顺延，而不是把新组件直接追加到最后一页。
    function addWidgetToBoard(widgetEntry) {
        const targetPage = activeDesktopPage.value;
        const footprint = resolveWidgetFootprint(widgetEntry);
        const boardItem = {
            kind: 'widget',
            id: `widget::${widgetEntry.qualifiedId}::${widgetEntry.instanceId}`,
            widget: widgetEntry,
            footprint,
        };
        const range = getPageBoardRange(targetPage);
        let chosenItems = null;

        for (let insertion = range.end; insertion >= range.start; insertion -= 1) {
            const candidate = [...boardItems.value];
            candidate.splice(insertion, 0, boardItem);
            const pages = planDesktopPages(candidate);
            const placed = pages[targetPage]?.some(item => item.id === boardItem.id);
            if (placed) {
                chosenItems = candidate;
                break;
            }
        }
        if (!chosenItems) {
            chosenItems = [...boardItems.value];
            chosenItems.splice(range.start, 0, boardItem);
        }
        boardItems.value = chosenItems;
        syncAppsAndWidgetsFromBoard();

        Vue.nextTick(() => {
            syncTransformsToActivePage(targetPage);
            refreshGridMetrics();
        });
    }

    // 通用二次确认弹窗（iOS 风格）。
    // 通过 window.__phoneConfirm.request 拉起，绝对路径不依赖 navigation，
    // 避免被 activeApp 包裹的 modal-layer 限制。
    function requestConfirm(title, text, onConfirm) {
        const api = typeof window !== 'undefined' ? window.__phoneConfirm : null;
        if (api && typeof api.request === 'function') {
            api.request({
                title,
                text,
                danger: true,
                confirmLabel: '删除',
                onConfirm,
            });
            return;
        }
        // 极端回退：直接执行
        if (typeof onConfirm === 'function') onConfirm();
    }

    // 从桌面移除 widget（编辑模式下右上角小 × 触发）。
    // 注意：移除 widget 不影响已注册到 app-registry 的 widget 本身。
    function removeWidgetFromBoard(instanceId) {
        requestConfirm(
            '删除小组件',
            '确定从桌面移除这个小组件吗？此操作无法撤销。',
            () => {
                widgetBoard.value = widgetBoard.value.filter(w => w.instanceId !== instanceId);
            }
        );
    }

    // 从桌面移除 app（编辑模式下右上角小 × 触发）。
    // 注意：移除 app 不影响已注册到 app-registry 的 app 本身，
    // 只是从桌面 boardItems 里抹掉；registry 仍在，仍能通过 widget picker 拉回。
    function removeAppFromBoard(appId) {
        requestConfirm(
            '删除 App',
            '确定从桌面移除这个 App 吗？此操作无法撤销。',
            () => {
                apps.value = apps.value.filter(a => a.id !== appId);
            }
        );
    }

    // 把当前已注册到全局的 widgets 拍成 list（widget picker 用）。
    function listAvailableWidgets() {
        const registry = window.APP_WIDGETS || {};
        const onBoard = new Set(widgetBoard.value.map(w => w.qualifiedId));
        return Object.values(registry).map(widget => ({
            ...widget,
            alreadyAdded: onBoard.has(widget.qualifiedId),
        }));
    }

    // 把 widget picker 拉起的灵动岛态切换。
    // 拉起后，点灵动岛不会触发 expand；得用 widget picker UI 操作。
    function openWidgetPicker() {
        const widgets = listAvailableWidgets();
        if (!widgets.length) {
            island.showInfo('mini', {
                type: 'info',
                title: '暂无可用小组件',
                message: 'app 还没注册任何小组件',
            });
            return false;
        }
        const slots = widgets.map(w => ({
            qualifiedId: w.qualifiedId,
            icon: w.icon || '',
            iconBg: w.iconBg || '',
            label: w.label || '',
            alreadyAdded: w.alreadyAdded,
        }));
        island.showInfo('mini', {
            type: 'info',
            title: widgets.length > 1 ? `添加小组件 (${widgets.length})` : '添加小组件',
            widgetSlots: slots,
        });
        // 显示 widget 选择面板（独立 UI，由 core-shim 渲染）
        if (typeof window.openWidgetPicker === 'function') {
            window.openWidgetPicker(widgets);
        }
        return true;
    }

    function closeWidgetPicker() {
        if (typeof window.closeWidgetPickerUI === 'function') {
            window.closeWidgetPickerUI();
        }
        island.closeIsland(ISLAND_CLOSE_REASONS.WIDGET_PICKER);
    }

    // 把一个 widget 加到桌面后，picker 流程关闭。
    // size / orientation 来自 widget 注册项的 defaultSize / defaultOrientation(或 size / orientation)。
    function addWidgetAndClosePicker(qualifiedId, sizeOverride) {
        const registry = window.APP_WIDGETS || {};
        const widgetConfig = registry[qualifiedId];
        if (!widgetConfig) {
            return false;
        }
        const instanceId = `${qualifiedId}::inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const size = sizeOverride || widgetConfig.defaultSize || widgetConfig.size || 'S';
        const orientation = widgetConfig.defaultOrientation || widgetConfig.orientation || (size === 'S' ? 'h' : null);
        addWidgetToBoard({
            ...widgetConfig,
            instanceId,
            size,
            orientation: size === 'S' ? orientation : null,
            // 桌面 widget 用的是 mini 渲染；保存的 renderer 可后续被 widget 自己通过 renderItem 调起
            renderItem: widgetConfig.renderItem || widgetConfig.renderDesktop || widgetConfig.render || null,
        });
        // picker UI 刷新（让刚加的那个标 "已添加"）
        if (typeof window.refreshWidgetPickerUI === 'function') {
            window.refreshWidgetPickerUI();
        }
        return true;
    }

    return {
        isEditMode,
        draggingIconId,
        dragVisualOffset,
        lastEditActionAt,
        activeDesktopPage,
        desktopPages,
        desktopPageDots,
        boardItems,
        pressState,
        exitEditMode,
        enterEditMode,
        goToDesktopPage,
        getDesktopAppStyle,
        getDesktopGridItemStyle,
        onAppPointerDown,
        onAppPointerMove,
        onAppPointerUp,
        onScreenPointerUp,
        onDesktopPointerDown,
        onDesktopPointerMove,
        onDesktopPointerUp,
        onDesktopPointerCancel,
        cancelAllPresses,
        openWidgetPicker,
        closeWidgetPicker,
        addWidgetAndClosePicker,
        removeWidgetFromBoard,
        removeAppFromBoard,
        listAvailableWidgets,
    };
}