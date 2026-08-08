/**
 * chat-app / 回复提示词管理 — 拖拽重排控制器 (v0.61.2)
 *
 *   在「当前上下文」section 启用长按+拖拽重排。
 *
 *   数据流:
 *     1. 用户长按某张 .pm-card 卡片 ≥500ms → 进入 drag mode
 *     2. pointermove → 计算当前 hover 在哪张卡片的中间线上
 *     3. 在目标位置插入 .pm-card-placeholder(虚线占位)
 *     4. pointerup → 读取 .pm-active-list 当前顺序 → 调 chat-app methods.reorderContextPrompts
 *     5. methods.reorderContextPrompts 走 sdk.replyPrompts.setOrder + bridge.syncNow({ force: true }) 重画
 *
 *   ★ 严格遵守 AGENTS.md §16.21 / §16.25:
 *     - ❌ 不在 renderPage 内 appendChild
 *     - ❌ 不在 renderPage 内 querySelector 后 addEventListener
 *     - ✅ 用 MutationObserver 监听 .prompt-manager 出现 → 自动在 .prompt-manager 上挂 pointerdown 委托
 *     - ✅ drag 过程的 pointermove/pointerup 挂在 window(只在 drag 期间挂,drag 结束立刻解绑)
 *     - ✅ 重排结果走 framework data-app-action 风格的 method 调用,而不是 addEventListener('click', ...)
 *
 *   借鉴 chat-app v0.48 __chatPrivateObserver 范式:
 *     - 全局单例 observer(window.__promptDragObserverInstalled 守卫),防止重复挂载
 *     - 每次 .prompt-manager 进入 DOM 都自动 wire 好 pointerdown 委托
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';

// ============================================================
// 配置
// ============================================================

const LONG_PRESS_MS = 500;           // 长按触发阈值
const DRAG_MOVE_THRESHOLD = 4;       // 长按期间移动 > 4px 视为滚动意图,取消
const PLACEHOLDER_CLASS = 'pm-card-placeholder';
const DRAGGING_CLASS = 'pm-card-dragging';
const CARD_SELECTOR = '.pm-card';
const CONTAINER_SELECTOR = '.pm-active-list';
const ROOT_SELECTOR = '.prompt-manager';

// ============================================================
// 模块级 drag state(单例)
// ============================================================

const dragState = {
    active: false,             // 是否在 drag 模式
    longPressTimer: 0,         // 长按计时器
    startX: 0,
    startY: 0,
    draggingCard: null,        // 当前被拖拽的 .pm-card
    placeholder: null,         // 占位符节点
    root: null,                // .prompt-manager 根(用于 relative 上下文)
    container: null,           // .pm-active-list(放占位符的容器)
    onPointerMove: null,       // drag 期间的 window-level listener 引用(用于解绑)
    onPointerUp: null,
};

// ============================================================
// helpers
// ============================================================

function _getPromptId(cardEl) {
    if (!cardEl) return null;
    // 兼容 .pm-card 与 .pm-item(.pm-item 也带 data-prompt-id,用于 system prompt)
    return cardEl.getAttribute('data-prompt-id') || cardEl.dataset?.promptId || null;
}

function _isDraggable(cardEl) {
    if (!cardEl) return false;
    // 只有显式标记 data-pm-draggable="true" 的卡片才参与拖拽
    return cardEl.getAttribute('data-pm-draggable') === 'true';
}

function _findCardFromPoint(x, y) {
    // 用 elementsFromPoint 找指针下面第一个 .pm-card 且是真正的可拖拽卡片(.pm-item)
    //   - .pm-card-section 是容器,不能作为拖拽目标
    if (typeof document.elementsFromPoint !== 'function') return null;
    const stack = document.elementsFromPoint(x, y) || [];
    for (const el of stack) {
        if (!el.classList) continue;
        if (!el.classList.contains('pm-card')) continue;
        // 过滤掉容器(.pm-card-section 不是 .pm-item)
        if (!el.classList.contains('pm-item')) continue;
        return el;
    }
    return null;
}

function _cardsInContainer(container) {
    if (!container) return [];
    // 取容器内所有 .pm-card.pm-item(真实可拖拽卡片),过滤掉 .pm-card-section 容器 + 占位符
    return Array.from(container.querySelectorAll(CARD_SELECTOR))
        .filter((el) => !el.classList.contains(PLACEHOLDER_CLASS))
        .filter((el) => el.classList.contains('pm-item'));
}

function _createPlaceholder() {
    const div = document.createElement('div');
    div.className = PLACEHOLDER_CLASS;
    div.setAttribute('aria-hidden', 'true');
    return div;
}

function _clearDragVisuals() {
    // 清掉占位符 + 拖拽样式
    if (dragState.placeholder && dragState.placeholder.parentNode) {
        dragState.placeholder.parentNode.removeChild(dragState.placeholder);
    }
    if (dragState.draggingCard) {
        dragState.draggingCard.classList.remove(DRAGGING_CLASS);
    }
}

function _endDrag() {
    // 1) 解绑 window-level pointermove/pointerup
    if (dragState.onPointerMove) {
        window.removeEventListener('pointermove', dragState.onPointerMove, { capture: true });
        dragState.onPointerMove = null;
    }
    if (dragState.onPointerUp) {
        window.removeEventListener('pointerup', dragState.onPointerUp, { capture: true });
        window.removeEventListener('pointercancel', dragState.onPointerUp, { capture: true });
        dragState.onPointerUp = null;
    }
    // 2) 清视觉
    _clearDragVisuals();
    // 3) 清状态
    // ★ v0.61.7 注意:调用方必须在 _endDrag() 之前把 dragState.container / dragState.root
    //   缓存到 local 变量,否则 _commitReorder() 读 dragState.container 永远是 null,
    //   reorderContextPrompts 永远不会被调,拖完顺序不更新(详见 chat迁移/README.md §v0.61.7)
    dragState.active = false;
    dragState.draggingCard = null;
    dragState.placeholder = null;
    dragState.root = null;
    dragState.container = null;
}

function _commitReorder(containerArg, rootArg) {
    const container = containerArg || dragState.container;
    const root = rootArg || dragState.root;
    if (!container) return;
    const cards = _cardsInContainer(container);
    const ids = cards.map((c) => _getPromptId(c)).filter(Boolean);
    // 找到 aiPersonId:从 root 上读 data-ai-person-id
    const aiPersonId = root?.getAttribute('data-ai-person-id')
        || root?.dataset?.aiPersonId
        || '';
    if (!aiPersonId || ids.length === 0) return;
    const chatApp = externalAppRegistry.getApp('chat');
    const method = chatApp?.methods?.reorderContextPrompts;
    if (typeof method === 'function') {
        // async fire-and-forget;SDK 落盘后 invalidate + syncNow({force:true}) 触发整页重画
        try {
            const result = method({ aiPersonId, promptIdsInOrder: ids });
            if (result && typeof result.then === 'function') {
                result.catch((err) => console.warn('[prompt-drag-controller] reorder failed', err));
            }
        } catch (err) {
            console.warn('[prompt-drag-controller] reorder threw', err);
        }
    } else {
        console.warn('[prompt-drag-controller] chat.methods.reorderContextPrompts not available');
    }
}

function _placePlaceholderAt(hoverCard, clientY) {
    // 根据 hoverCard + clientY 决定 placeholder 插入位置
    if (!dragState.placeholder || !dragState.container) return;
    const container = dragState.container;
    const rect = hoverCard.getBoundingClientRect();
    const insertBefore = (clientY - rect.top) < (rect.height / 2);
    // ★ v0.61.7 防御性:refNode 必须真的是 container 的子节点
    //   - hoverCard.nextSibling 可能是 text node / 注释 / 不在 container 里的节点
    //   - insertBefore 失败会报 NotFoundError
    let refNode = insertBefore ? hoverCard : hoverCard.nextSibling;
    if (refNode && refNode.parentNode !== container) {
        refNode = null; // 走 appendChild 兜底
    }
    if (dragState.placeholder.parentNode !== container) {
        container.appendChild(dragState.placeholder);
    }
    if (refNode && dragState.placeholder !== refNode) {
        container.insertBefore(dragState.placeholder, refNode);
    } else if (!refNode) {
        // 兜底:追加到末尾
        container.appendChild(dragState.placeholder);
    }
}

function _onPointerMove(ev) {
    if (!dragState.active) return;
    const card = _findCardFromPoint(ev.clientX, ev.clientY);
    if (!card) return;
    if (card === dragState.draggingCard) {
        // 鼠标在拖拽卡片自己身上:占位符保持在原位(不重排)
        return;
    }
    _placePlaceholderAt(card, ev.clientY);
}

function _onPointerUp() {
    if (!dragState.active) return;
    const dragging = dragState.draggingCard;
    const placeholder = dragState.placeholder;
    // 把拖拽卡片移到占位符位置(visual settle)
    if (dragging && placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(dragging, placeholder);
        // 占位符移除(dragging 已插入到它的位置)
    }
    // ★ v0.61.7 关键:必须在 _endDrag() 之前缓存 container / root — _endDrag() 会把 dragState 清空
    //   - 否则 _commitReorder 读 dragState.container 永远 null,reorderContextPrompts 不被调
    //   - 拖完顺序不更新,「数字/preview 不变」就是这个反模式引起的
    //   - 详见 chat迁移/README.md §v0.61.7 完整踩坑记录
    let preCommitContainer = dragState.container;
    let preCommitRoot = dragState.root;
    if (!preCommitContainer && dragging) {
        // 兜底:从 dragging 的 DOM 反查
        preCommitContainer = dragging.parentNode;
    }
    // 先 end drag(清 listeners 和 visual)
    _endDrag();
    // 再 commit(走 method → SDK → syncNow)
    _commitReorder(preCommitContainer, preCommitRoot);
}

function _onPointerDown(ev) {
    // 只响应左键 / 单指触屏 / pen
    if (ev.button != null && ev.button !== 0) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;

    // 找最近的 .pm-card 祖先
    let card = ev.target;
    while (card && card !== document.body) {
        if (card.classList && card.classList.contains('pm-card')) break;
        card = card.parentNode;
    }
    if (!card || card === document.body) return;
    if (!_isDraggable(card)) return;

    const root = card.closest(ROOT_SELECTOR);
    if (!root) return;
    const container = card.closest(CONTAINER_SELECTOR);
    if (!container) return;

    // 阻止默认(避免触发 summary 折叠 / 长按弹出系统菜单)
    ev.preventDefault();

    // 记初始坐标
    dragState.startX = ev.clientX;
    dragState.startY = ev.clientY;

    // 起 long-press 计时器
    if (dragState.longPressTimer) {
        clearTimeout(dragState.longPressTimer);
    }
    dragState.longPressTimer = window.setTimeout(() => {
        // ★ 进入 drag 模式
        dragState.active = true;
        dragState.draggingCard = card;
        dragState.root = root;
        dragState.container = container;
        dragState.placeholder = _createPlaceholder();

        // 视觉:卡片加 dragging class
        card.classList.add(DRAGGING_CLASS);

        // 占位符先放在拖拽卡片原本位置(等 pointermove 再调整)
        const next = card.nextSibling;
        if (next) {
            container.insertBefore(dragState.placeholder, next);
        } else {
            container.appendChild(dragState.placeholder);
        }

        // 挂 window-level pointermove / pointerup(只在 drag 期间有效)
        dragState.onPointerMove = _onPointerMove;
        dragState.onPointerUp = _onPointerUp;
        window.addEventListener('pointermove', dragState.onPointerMove, { capture: true, passive: true });
        window.addEventListener('pointerup', dragState.onPointerUp, { capture: true });
        window.addEventListener('pointercancel', dragState.onPointerUp, { capture: true });

        dragState.longPressTimer = 0;
    }, LONG_PRESS_MS);

    // 用一次性 pointermove 检测「长按期间移动 > 阈值则取消」(scroll intent)
    const cancelOnMove = (moveEv) => {
        const dx = moveEv.clientX - dragState.startX;
        const dy = moveEv.clientY - dragState.startY;
        if (Math.abs(dx) > DRAG_MOVE_THRESHOLD || Math.abs(dy) > DRAG_MOVE_THRESHOLD) {
            if (dragState.longPressTimer) {
                clearTimeout(dragState.longPressTimer);
                dragState.longPressTimer = 0;
            }
            window.removeEventListener('pointermove', cancelOnMove, { capture: true });
        }
    };
    window.addEventListener('pointermove', cancelOnMove, { capture: true, passive: true });
    // pointerup 时也要清掉 cancelOnMove + timer
    const clearAll = () => {
        if (dragState.longPressTimer) {
            clearTimeout(dragState.longPressTimer);
            dragState.longPressTimer = 0;
        }
        window.removeEventListener('pointermove', cancelOnMove, { capture: true });
        window.removeEventListener('pointerup', clearAll, { capture: true });
    };
    window.addEventListener('pointerup', clearAll, { capture: true });
}

// ============================================================
// ★ v0.61.2 MutationObserver 入口(对齐 v0.48 __chatPrivateObserver 范式)
//   监听 document.body 子树,只要 .prompt-manager 出现,就自动在它身上挂 pointerdown 委托。
//   - 不在 renderPage 内 querySelector
//   - 不在 v-html 后手动 addEventListener(observer 触发时 v-html 已完成,节点是真实存在的)
//   - 防重复挂:每张 .prompt-manager 节点用 __promptDragBound 标记
// ============================================================

function _wirePromptManager(rootEl) {
    if (!rootEl) return;
    if (rootEl.__promptDragBound) return;
    rootEl.__promptDragBound = true;
    // 用 capture: true,确保在 framework 的 click 委托之前先抓到 pointerdown
    rootEl.addEventListener('pointerdown', _onPointerDown, { capture: true });
}

if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__promptDragObserverInstalled) {
    window.__promptDragObserverInstalled = true;
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                // 节点本身
                if (node.classList && node.classList.contains('prompt-manager')) {
                    _wirePromptManager(node);
                }
                // 子树里
                if (node.querySelectorAll) {
                    const subs = node.querySelectorAll(ROOT_SELECTOR);
                    subs.forEach(_wirePromptManager);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // 启动日志(对齐 __chatPrivateObserver 风格)
    // eslint-disable-next-line no-console
    console.log('[chat-app] MutationObserver installed for .prompt-manager drag');
}

// 暴露给 chat-app 内部调试用(不依赖)
if (typeof window !== 'undefined') {
    window.__promptDragController = {
        isDragging: () => dragState.active,
        endDrag: _endDrag,
    };
}

export default {
    isDragging: () => dragState.active,
    endDrag: _endDrag,
};
