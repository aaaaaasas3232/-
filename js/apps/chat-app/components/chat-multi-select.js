/**
 * chat-multi-select.js
 *
 * ★ v0.70 抽取自 chat-app/index.js
 *   原来 initPrivateChatInteractions(5585) 和 initGroupChatInteractions(9561)
 *   各自内联了 setMultiSelectMode / updateSelection / selectedMessages 状态。
 *   私聊和群聊的差异只有:
 *     - 群聊多一步 .multi-select-bar 的内联 style.display 切换
 *     - 群聊 updateSelection 写法更紧凑(else 块合并)
 *   把这部分抽出来,两边共用。
 *
 * 用法:
 *   const ms = createMultiSelectController(rootEl);
 *   rootEl.addEventListener('click', (e) => {
 *     const sb = e.target.closest('[data-message-select]');
 *     if (sb && ms.isActive()) { ms.toggleMessage(sb); return; }
 *     const ma = e.target.closest('[data-multi-action]');
 *     if (ma) { ms.handleAction(ma.dataset.multiAction); return; }
 *     const mt = e.target.closest('[data-action="multiselect"]');
 *     if (mt) { ms.toggle(); return; }
 *   });
 */

/**
 * 创建多选模式控制器(每个聊天容器一个实例)
 * @param {HTMLElement} rootEl .chat-private 或 .chat-group 根节点
 * @returns {{
 *   isActive: () => boolean,
 *   toggle: () => boolean,
 *   enable: () => void,
 *   disable: () => void,
 *   toggleMessage: (button: HTMLElement) => void,
 *   handleAction: (action: string) => boolean,
 *   getSelectedIds: () => string[],
 *   getSelectedCount: () => number,
 * }}
 */
export function createMultiSelectController(rootEl) {
    if (!rootEl) {
        throw new Error('[chat-multi-select] rootEl is required');
    }
    const selectedMessages = new Set();
    const isGroup = rootEl.classList.contains('chat-group');

    function refreshCountUI() {
        rootEl.querySelectorAll('[data-selected-count]').forEach((el) => {
            el.textContent = String(selectedMessages.size);
        });
    }

    function setMultiSelectMode(enabled) {
        rootEl.classList.toggle('multi-select-mode', enabled);
        // ★ v0.69.1 群聊:直接改 .multi-select-bar 内联 style.display
        //   HTML 渲染时 multiSelectBarStyle='display:none',class 切换没法改内联 style
        if (isGroup) {
            const bar = rootEl.querySelector('.multi-select-bar');
            if (bar) bar.style.display = enabled ? 'flex' : 'none';
        }
        rootEl.querySelectorAll('.message-wrapper').forEach((wrapper) => {
            wrapper.classList.toggle('selectable', enabled);
        });
        if (!enabled) {
            selectedMessages.clear();
            rootEl.querySelectorAll('.message-wrapper.selected').forEach((wrapper) => {
                wrapper.classList.remove('selected');
            });
            rootEl.querySelectorAll('.message-select-button[aria-checked="true"]').forEach((button) => {
                button.setAttribute('aria-checked', 'false');
            });
        }
        refreshCountUI();
    }

    function toggleMessage(button) {
        const messageId = button.dataset.messageSelect;
        const wrapper = button.closest('.message-wrapper');
        if (!messageId || !wrapper) return;
        if (selectedMessages.has(messageId)) {
            selectedMessages.delete(messageId);
            wrapper.classList.remove('selected');
            button.setAttribute('aria-checked', 'false');
        } else {
            selectedMessages.add(messageId);
            wrapper.classList.add('selected');
            button.setAttribute('aria-checked', 'true');
        }
        refreshCountUI();
    }

    /**
     * 处理多选 bar 上的动作按钮(转发/收藏/删除/取消)
     * @returns {boolean} true 表示已经处理(应 stopPropagation)
     */
    function handleAction(action) {
        if (action === 'cancel') {
            setMultiSelectMode(false);
            return true;
        }
        // 转发/收藏/删除等具体业务由调用方在 click 委托里拦截。
        // 这里只 reset,具体动作调用方自己写。
        return false;
    }

    return {
        isActive: () => rootEl.classList.contains('multi-select-mode'),
        toggle: () => {
            setMultiSelectMode(!rootEl.classList.contains('multi-select-mode'));
            return rootEl.classList.contains('multi-select-mode');
        },
        enable: () => setMultiSelectMode(true),
        disable: () => setMultiSelectMode(false),
        toggleMessage,
        handleAction,
        getSelectedIds: () => Array.from(selectedMessages),
        getSelectedCount: () => selectedMessages.size,
    };
}
