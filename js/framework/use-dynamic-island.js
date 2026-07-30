/**
 *提供灵动岛状态、动画、通知、展开/收起、关闭收口、持有者栈、生命周期计时、maxSize 约束。
 *
 *关闭逻辑收口：
 *   - 所有"关岛"动作必须走 closeIsland(reason)
 *   - reason 类型见 ISLAND_CLOSE_REASONS
 *   - 关岛时：清 lifecycle timer / 调 owner.onClosed / 顶替(replaced)时把 snapshot 推入栈
 *   - 栈顶恢复：当前岛 idle 后延迟 ISLAND_RESTORE_DELAY_MS 恢复
 *
 * size 升级约束：
 *   - expandInfo / collapseInfo 都受 islandContent.maxSize 限制
 *   - maxSize = null 表示不限
 *   - notification 形态点外部直接 dismiss，不降档（聊天通知就是点一下消失）
 */

import {
    ISLAND_CLOSE_REASONS,
    ISLAND_RESTORE_DELAY_MS,
    createEmptyIslandContent,
} from './utils.js';

const stateColors = Object.freeze({
    success: { bg: 'rgba(37,111,64,1)', color: '#4ade80', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' },
    warning: { bg: 'rgba(126,96,18,1)', color: '#fbbf24', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>' },
    error: { bg: 'rgba(124,57,57,1)', color: '#f87171', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' },
    info: { bg: 'rgba(48,83,125,1)', color: '#60a5fa', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path fill="#fff" d="M11 7h2v2h-2zm0 4h2v6h-2z"/></svg>' },
    message: { bg: 'rgba(48,83,125,1)', color: '#60a5fa', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
    call: { bg: 'rgba(37,111,64,1)', color: '#4ade80', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' },
    system: { bg: 'rgba(71,71,74,1)', color: '#8e8e93', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>' },
});

const safeCall = (fn, arg) => {
    if (typeof fn !== 'function') return;
    try { fn(arg); }
    catch (e) { console.warn('[island] callback threw:', e); }
};

export function useDynamicIsland() {
    let activeTimer = null; //灵动岛当前激活定时器
    let lifecycleTimer = null; //灵动岛当前生命周期定时器
    let idleTimer = null; //灵动岛当前空闲定时器
    let restoreTimer = null; //灵动岛当前恢复定时器
    const islandMode = Vue.ref('idle'); //灵动岛当前状态 默认为idle休息态
    const islandSize = Vue.ref(''); //灵动岛当前尺寸
    const islandActive = Vue.ref(false); //灵动岛当前是否激活
    const islandContent = Vue.ref(createEmptyIslandContent()); //灵动岛当前内容
    const islandTemplateVersion = Vue.ref(0); //渲染版本号 - 变量可改名为 islandRenderVersion

    // 历史快照栈，当灵动岛显示新内容时，将当前岛的快照推入栈中，当当前岛恢复时，将栈顶的快照恢复到当前岛中，栈里存的每个历史状态，都是包含{ mode, size, content, reason }字段的对象
    const previousOwnerStack = []; //用于存放被顶替的岛状态

    const currentState = Vue.computed(() => stateColors[islandContent.value.type] || stateColors.info);
    const currentIcon = Vue.computed(() => islandContent.value.icon ?? currentState.value.icon);
    const activeIslandTemplate = Vue.computed(() => {
        const templateName = islandContent.value?.islandTemplate;
        return templateName ? window.islandTemplates?.[templateName] || null : null;
    });
    const hasIslandTemplate = Vue.computed(() => Boolean(activeIslandTemplate.value));
    const renderedIslandTemplate = Vue.computed(() => {
        if (!activeIslandTemplate.value || islandMode.value !== 'info') {
            return '';
        }
        return activeIslandTemplate.value.render?.(islandSize.value, islandContent.value.payload ?? {}, islandContent.value) || '';
    });

    const triggerActiveFeedback = () => {
        clearTimeout(activeTimer);
        islandActive.value = false;
        requestAnimationFrame(() => {
            islandActive.value = true;
            activeTimer = setTimeout(() => {
                islandActive.value = false;
                activeTimer = null;
            }, 180);
        });
    };

    const buildContent = (content = {}) => ({
        ...createEmptyIslandContent(),
        ...content,
    });


    // 关岛时的"清场"：active 反馈 / lifecycle / idle 一并清。
    // restoreTimer 单独走 scheduleRestoreFromStack 的"防重入 + 延迟恢复"语义，关岛时不动。
    const clearIslandTimers = () => {
        clearTimeout(activeTimer);
        clearTimeout(lifecycleTimer);
        clearTimeout(idleTimer);
        activeTimer = lifecycleTimer = idleTimer = null;
    };

    // 生命周期计时器

    const startLifecycleTimer = () => {
        clearTimeout(lifecycleTimer);
        if (islandMode.value === 'idle') return;
        const { lifecycle, duration } = islandContent.value;
        if (lifecycle !== 'time' || !duration) return;
        lifecycleTimer = setTimeout(() => {
            lifecycleTimer = null;
            closeIsland(ISLAND_CLOSE_REASONS.LIFECYCLE_EXPIRED);
        }, duration);
    };


    // 暂停计时器（app 自调用，1 分钟后关岛）

    const startIdleTimer = (ms) => {
        clearIdleTimer();
        if (!(ms > 0)) return false;
        idleTimer = setTimeout(() => {
            idleTimer = null;
            closeIsland(ISLAND_CLOSE_REASONS.LIFECYCLE_EXPIRED);
        }, ms);
        return true;
    };

    // clearIdleTimer 只清 idle（语义保留：外部/console 调试期望"只清 idle"），
    // closeIsland 收尾处的 clearLifecycleTimer + clearIdleTimer 已合并为 clearIslandTimers()。
    const clearIdleTimer = () => { clearTimeout(idleTimer); idleTimer = null; };


    // size 升级链：受 maxSize 约束

    const INFO_SIZES = ['mini', 'medium', 'large'];

    const getMaxSizeIndex = () => {
        const cap = islandContent.value.maxSize;
        const idx = cap ? INFO_SIZES.indexOf(cap) : -1;
        return idx === -1 ? INFO_SIZES.length - 1 : idx;
    };

    const getCurrentSizeIndex = () => INFO_SIZES.indexOf(islandSize.value);


    // 顶替当前岛的通知 + 关闭（showInfo/showNotification 共用）

    const kickIfActive = () => {
        if (islandMode.value === 'idle') return;
        safeCall(islandContent.value?.onKicked, { reason: ISLAND_CLOSE_REASONS.REPLACED });
        closeIsland(ISLAND_CLOSE_REASONS.REPLACED);
    };

    const setIdle = () => {
        islandMode.value = 'idle';
        islandSize.value = '';
        islandActive.value = false;
        islandContent.value = createEmptyIslandContent();
    };

    /**
     * 关闭灵动岛（所有关闭路径的唯一入口）
     * @param {string} reason - 关闭原因（ISLAND_CLOSE_REASONS 之一）
     */
    const closeIsland = (reason = ISLAND_CLOSE_REASONS.MANUAL) => {
        // 1. 防御：已经在 idle 就不做事（但恢复栈时仍要调度）
        const wasActive = islandMode.value !== 'idle';

        // 2. 调 owner.onClosed（如果定义了）
        if (wasActive) {
            const onClosed = islandContent.value?.onClosed;
            safeCall(onClosed, { reason, mode: islandMode.value, size: islandSize.value });
        }

        // 3. 清所有 timer（lifecycle + idle，restore 由 scheduleRestoreFromStack 自己管）
        clearIslandTimers();

        // 4. 如果是 replaced，把当前 owner 推入栈
        if (wasActive && reason === ISLAND_CLOSE_REASONS.REPLACED) {
            previousOwnerStack.push({
                mode: islandMode.value,
                size: islandSize.value,
                content: { ...islandContent.value },
                ownerId: islandContent.value.ownerId,
            });
        }

        // 5. 真正关岛
        setIdle();
        islandTemplateVersion.value += 1;

        // 6. 调度栈顶恢复（仅当栈非空，且关岛原因是会"让出"的：replaced / editMode / widgetPicker）
        if (previousOwnerStack.length > 0
            && (reason === ISLAND_CLOSE_REASONS.REPLACED
                || reason === ISLAND_CLOSE_REASONS.EDIT_MODE
                || reason === ISLAND_CLOSE_REASONS.WIDGET_PICKER)) {
            scheduleRestoreFromStack();
        }
    };

    function scheduleRestoreFromStack() {
        if (restoreTimer) return;
        restoreTimer = setTimeout(() => {
            restoreTimer = null;
            restoreTopOfStack();
        }, ISLAND_RESTORE_DELAY_MS);
    }

    function restoreTopOfStack() {
        if (previousOwnerStack.length === 0) return;
        if (islandMode.value !== 'idle') return; // 期间又被别的占用了，不恢复
        const snapshot = previousOwnerStack.pop();
        if (!snapshot) return;
        islandMode.value = snapshot.mode;
        islandSize.value = snapshot.size;
        islandContent.value = { ...createEmptyIslandContent(), ...snapshot.content };
        islandTemplateVersion.value += 1;
        triggerActiveFeedback();
        startLifecycleTimer();
    }

    function setSize(size) {
        if (islandMode.value === 'idle') {
            return;
        }
        islandSize.value = size || 'mini';
    }

    function isWidgetPicker() {
        return islandMode.value === 'info'
            && Array.isArray(islandContent.value.widgetSlots)
            && islandContent.value.widgetSlots.length > 0;
    }

    function getState() {
        return {
            mode: islandMode.value,
            size: islandSize.value,
            active: islandActive.value,
            content: { ...islandContent.value },
            isWidgetPicker: isWidgetPicker(),
            widgetSlots: isWidgetPicker() ? [...islandContent.value.widgetSlots] : [],
        };
    }

    function isActive() {
        return islandMode.value !== 'idle';
    }

    // === 外部注册"点击 island"拦截器（由 framework/desktop-edit 等设置）===
    // 返回 true 表示该 handler 已经消费了这次点击，框架不应继续触发 expandInfo。
    let islandTapInterceptor = null;
    function setIslandTapInterceptor(handler) {
        islandTapInterceptor = typeof handler === 'function' ? handler : null;
    }
    function runIslandTapInterceptor() {
        if (typeof islandTapInterceptor !== 'function') {
            return false;
        }
        return Boolean(islandTapInterceptor({
            mode: islandMode.value,
            size: islandSize.value,
            content: islandContent.value,
        }));
    }

    /**
     * 显示 info 形态。
     * 关键改动：
     *   - 顶替前调 onKicked 通知当前 owner
     *   - 如果当前 owner 是被顶替的，reason = REPLACED（推入恢复栈）
     *   - 否则 reason = MANUAL（不推栈，直接覆盖）
     */
    function showInfo(size, content) {
        kickIfActive();
        islandMode.value = 'info';
        islandSize.value = size || 'mini';
        islandContent.value = buildContent(content);
        islandTemplateVersion.value += 1;
        triggerActiveFeedback();
        startLifecycleTimer();
    }

    /**
     * 显示 notification 形态。
     * 关键改动：通知默认走 time 模式 + 默认 duration（来自 content.duration 或 3500ms）
     */
    function showNotification(type, title, message, options = {}) {
        kickIfActive();
        islandMode.value = 'notification';
        islandSize.value = 'compact';
        islandContent.value = buildContent({
            type,
            title,
            message,
            detail: options.detail,
            icon: options.icon,
            senderName: options.senderName ?? title ?? '',
            senderId: options.senderId ?? '',
            senderAvatar: options.senderAvatar ?? '',
            avatarBg: options.avatarBg ?? '',
            ownerId: options.ownerId ?? '',
            lifecycle: options.lifecycle ?? 'time',
            duration: typeof options.duration === 'number' ? options.duration : 3500,
            onKicked: typeof options.onKicked === 'function' ? options.onKicked : null,
            onLongPress: typeof options.onLongPress === 'function' ? options.onLongPress : null,
            onClosed: typeof options.onClosed === 'function' ? options.onClosed : null,
        });
        islandTemplateVersion.value += 1;
        triggerActiveFeedback();
        startLifecycleTimer();
    }

    /**
     * 内部 hook：替换当前 islandContent 的回调（用于 helper.setCallbacks）
     */
    function replaceCallbacks(callbacks = {}) {
        if (islandMode.value === 'idle') return false;
        const next = { ...islandContent.value };
        if ('onKicked' in callbacks) next.onKicked = callbacks.onKicked ?? null;
        if ('onLongPress' in callbacks) next.onLongPress = callbacks.onLongPress ?? null;
        if ('onClosed' in callbacks) next.onClosed = callbacks.onClosed ?? null;
        islandContent.value = next;
        return true;
    }

    // === 公开 dismiss：映射到 closeIsland('manual') ===
    function dismiss() {
        closeIsland(ISLAND_CLOSE_REASONS.MANUAL);
    }

    const getRenderedTemplateHtml = () => String(renderedIslandTemplate.value ?? '');

    function bindTemplateContent(container) {
        if (!activeIslandTemplate.value || typeof activeIslandTemplate.value.bind !== 'function') {
            return;
        }
        activeIslandTemplate.value.bind(container, islandContent.value.payload || {}, islandContent.value);
    }

    /**
     * expandInfo：受 maxSize 约束
     *   - 当前 size 已是最大 → 不动
     *   - 否则升一档
     */
    function expandInfo() {
        if (islandMode.value !== 'info') return;
        const idx = getCurrentSizeIndex();
        if (idx === -1) return;
        const maxIdx = getMaxSizeIndex();
        if (idx >= maxIdx) return;
        islandSize.value = INFO_SIZES[idx + 1];
    }

    /**
     * collapseInfo：受 maxSize 无关（一直能降到 mini）
     *   - 当前 size 已是 mini → 关闭岛（按 closeReason 走）
     */
    function collapseInfo() {
        if (islandMode.value !== 'info') return;
        const idx = getCurrentSizeIndex();
        if (idx === -1) return;
        if (idx === 0) {
            // mini 再降一档：直接关闭
            closeIsland(ISLAND_CLOSE_REASONS.USER_OUTSIDE);
            return;
        }
        islandSize.value = INFO_SIZES[idx - 1];
    }

    /**
     * 长按处理：仅 mini 形态生效
     *   - notification 形态不响应
     *   - medium/large 不响应
     *   - 触发顺序：先调 onLongPress（app 自己决定要不要 stopPropagation / 暂停音乐），
     *               再 closeIsland('userLongPress')
     */
    function handleIslandLongPress() {
        if (islandMode.value !== 'info') return;
        if (islandSize.value !== 'mini') return;
        safeCall(islandContent.value?.onLongPress, { mode: islandMode.value, size: islandSize.value });
        closeIsland(ISLAND_CLOSE_REASONS.USER_LONG_PRESS);
    }

    function handleIslandClick() {
        triggerActiveFeedback();
        if (isWidgetPicker()) return; // widget picker 模式下不展开/收起
        if (runIslandTapInterceptor()) return;
        if (islandMode.value === 'notification') return;
        expandInfo();
    }

    /**
     * 点击岛外部：
     *   - notification 形态：直接 dismiss（聊天通知点一下就没）
     *   - info 形态：collapseInfo（降一档，mini 再点才关）
     */
    function handleOutsideClick() {
        if (islandMode.value !== 'info') {
            if (islandMode.value === 'notification') {
                closeIsland(ISLAND_CLOSE_REASONS.USER_OUTSIDE);
            }
            return;
        }
        collapseInfo();
    }

    return {
        // 状态
        islandMode,
        islandSize,
        islandActive,
        islandContent,
        islandTemplateVersion,
        currentState,
        currentIcon,
        activeIslandTemplate,
        hasIslandTemplate,
        renderedIslandTemplate,
        // 公开方法
        showInfo,
        showNotification,
        setSize,
        getState,
        isActive,
        dismiss,
        getRenderedTemplateHtml,
        bindTemplateContent,
        handleIslandClick,
        handleOutsideClick,
        handleIslandLongPress,
        setIslandTapInterceptor,
        buildContent,
        // 关闭收口（v2 新增）
        closeIsland,
        // 计时器（v2 新增）
        startIdleTimer,
        clearIdleTimer,
        // 内部 hook（仅暴露给同包 helper，不直接给 app 调）
        _replaceCallbacks: replaceCallbacks,
        _startIdleTimer: startIdleTimer,
        _clearIdleTimer: clearIdleTimer,
        // 内部状态（仅给 framework 内部用）
        _previousOwnerStack: previousOwnerStack,
    };
}

export function exposeDynamicIsland(island) {
    window.myDynamicIsland = {
        showInfo: island.showInfo,
        showNotification: island.showNotification,
        setSize: island.setSize,
        getState: island.getState,
        isActive: island.isActive,
        dismiss: island.dismiss,
        getRenderedTemplateHtml: island.getRenderedTemplateHtml,
        bindTemplateContent: island.bindTemplateContent,
        setIslandTapInterceptor: island.setIslandTapInterceptor,
        // v2 新增
        closeIsland: island.closeIsland,
        startIdleTimer: island.startIdleTimer,
        clearIdleTimer: island.clearIdleTimer,
        handleIslandLongPress: island.handleIslandLongPress,
        // 内部 hook（给 helper.js 调）
        _replaceCallbacks: island._replaceCallbacks,
        _startIdleTimer: island._startIdleTimer,
        _clearIdleTimer: island._clearIdleTimer,
    };

    Vue.onBeforeUnmount(() => {
        if (window.myDynamicIsland) {
            delete window.myDynamicIsland;
        }
    });
}