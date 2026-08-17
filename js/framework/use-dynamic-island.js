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
import {
    getIslandState,
    sanitizeIslandIcon,
    isSafeAvatarText,
    isSafeSvgIcon,
} from '@/src/core/island-icon.js';

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

    // ★ 调试：监控响应式变化
    Vue.watch([islandMode, islandSize], ([newMode, newSize], [oldMode, oldSize]) => {
        console.log('[Island] Vue.watch triggered: mode', oldMode, '→', newMode, '| size', oldSize, '→', newSize);
        Vue.nextTick(() => {
            const el = document.querySelector('.dynamic-island');
            console.log('[Island] After nextTick, DOM classes:', el?.className);
        });
    });

    const currentState = Vue.computed(() => getIslandState(islandContent.value?.type));
    const currentIcon = Vue.computed(() => {
        const fallback = currentState.value.icon || '';
        return sanitizeIslandIcon(islandContent.value?.icon, fallback) || fallback;
    });
    const islandAvatarText = Vue.computed(() => {
        const raw = islandContent.value?.senderAvatar;
        return isSafeAvatarText(raw) ? String(raw).trim() : '';
    });
    const islandAvatarHtml = Vue.computed(() => {
        const raw = islandContent.value?.senderAvatar;
        if (isSafeSvgIcon(raw)) return String(raw).trim();
        return currentIcon.value;
    });
    const safeSlotIcon = (slot) => sanitizeIslandIcon(slot?.icon, currentIcon.value) || currentIcon.value;
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

    // minSize：收起时的下限。设了就表示"这个岛能收小但不能被点没"。
    const getMinSizeIndex = () => {
        const floor = islandContent.value.minSize;
        const idx = floor ? INFO_SIZES.indexOf(floor) : -1;
        return idx === -1 ? 0 : idx;
    };


    // 顶替当前岛的通知 + 关闭（showInfo/showNotification 共用）
    //
    // 入栈规则（决定"被顶替的岛还能不能回来"）：
    //   - notification 形态是一次性的，过期就该消失，不入栈
    //   - 同一个 owner 自我刷新（音乐岛 medium ↔ large）不算被顶替，不入栈
    const kickIfActive = (nextContent = null) => {
        if (islandMode.value === 'idle') return;
        safeCall(islandContent.value?.onKicked, { reason: ISLAND_CLOSE_REASONS.REPLACED });
        const isTransient = islandMode.value === 'notification';
        const currentOwner = islandContent.value?.ownerId || '';
        const nextOwner = nextContent?.ownerId || '';
        const sameOwner = Boolean(currentOwner) && currentOwner === nextOwner;
        closeIsland(ISLAND_CLOSE_REASONS.REPLACED, { skipStack: isTransient || sameOwner });
    };

    const setIdle = () => {
        islandMode.value = 'idle';
        islandSize.value = '';
        islandActive.value = false;
        islandContent.value = createEmptyIslandContent();
    };

    // 会"让出"灵动岛（关完应该把上一个持有者放回来）的关闭原因。
    // lifecycleExpired 也在内：通知到期后，被它顶掉的音乐岛必须自己回来，
    // 否则播放中的音乐岛会被一条 3.5 秒的通知永久顶没。
    const YIELDING_CLOSE_REASONS = new Set([
        ISLAND_CLOSE_REASONS.REPLACED,
        ISLAND_CLOSE_REASONS.LIFECYCLE_EXPIRED,
        ISLAND_CLOSE_REASONS.EDIT_MODE,
        ISLAND_CLOSE_REASONS.WIDGET_PICKER,
    ]);

    const MAX_OWNER_STACK = 4;

    /**
     * 关闭灵动岛（所有关闭路径的唯一入口）
     * @param {string} reason - 关闭原因（ISLAND_CLOSE_REASONS 之一）
     * @param {{skipStack?: boolean}} [options] - skipStack：本次顶替不进恢复栈
     */
    const closeIsland = (reason = ISLAND_CLOSE_REASONS.MANUAL, options = {}) => {
        // 1. 防御：已经在 idle 就不做事（但恢复栈时仍要调度）
        const wasActive = islandMode.value !== 'idle';

        // 2. 调 owner.onClosed（如果定义了）
        if (wasActive) {
            const onClosed = islandContent.value?.onClosed;
            safeCall(onClosed, { reason, mode: islandMode.value, size: islandSize.value });
        }

        // 3. 清所有 timer（lifecycle + idle，restore 由 scheduleRestoreFromStack 自己管）
        clearIslandTimers();

        // 4. 如果是 replaced，把当前 owner 推入栈（同 owner 去重，避免同一个岛反复刷新时堆积）
        if (wasActive && reason === ISLAND_CLOSE_REASONS.REPLACED && !options.skipStack) {
            const ownerId = islandContent.value.ownerId;
            if (ownerId) {
                for (let i = previousOwnerStack.length - 1; i >= 0; i--) {
                    if (previousOwnerStack[i].ownerId === ownerId) previousOwnerStack.splice(i, 1);
                }
            }
            previousOwnerStack.push({
                mode: islandMode.value,
                size: islandSize.value,
                content: { ...islandContent.value },
                ownerId,
            });
            while (previousOwnerStack.length > MAX_OWNER_STACK) previousOwnerStack.shift();
        }

        // 5. 真正关岛
        setIdle();
        islandTemplateVersion.value += 1;

        // 6. 调度栈顶恢复（仅当栈非空，且关岛原因是会"让出"的）
        if (previousOwnerStack.length > 0 && YIELDING_CLOSE_REASONS.has(reason)) {
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
        if (islandMode.value !== 'idle') {
            // 期间又被占用了：如果占用者就是栈顶那位（它自己重新挂了岛），
            // 这份快照已经没用，丢掉，否则会一直躺在栈里。
            const top = previousOwnerStack[previousOwnerStack.length - 1];
            if (top && top.ownerId && top.ownerId === islandContent.value?.ownerId) {
                previousOwnerStack.pop();
            }
            return;
        }
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
        const nextContent = buildContent(content);
        nextContent.icon = sanitizeIslandIcon(nextContent.icon, getIslandState(nextContent.type).icon);
        kickIfActive(nextContent);
        islandMode.value = 'info';
        islandSize.value = size || 'mini';
        islandContent.value = nextContent;
        islandTemplateVersion.value += 1;
        console.log('[Island] showInfo called, mode=', islandMode.value, 'size=', islandSize.value, 'DOM classes=', document.querySelector('.dynamic-island')?.className);
        triggerActiveFeedback();
        startLifecycleTimer();
    }

    /**
     * 显示 notification 形态。
     * 关键改动：通知默认走 time 模式 + 默认 duration（来自 content.duration 或 3500ms）
     */
    function showNotification(type, title, message, options = {}) {
        // 不传 nextContent：通知即使来自同一个 app，也算"顶替"，
        // 被它盖掉的常驻岛必须入栈，等通知过期后回来。
        kickIfActive();
        islandMode.value = 'notification';
        islandSize.value = 'compact';
        const VALID_TYPES = ['success', 'warning', 'error', 'info', 'message', 'call', 'system'];
        const safeType = VALID_TYPES.includes(type) ? type : 'info';
        const typeIcon = getIslandState(safeType).icon;
        islandContent.value = buildContent({
            type: safeType,
            title,
            message,
            detail: options.detail,
            icon: sanitizeIslandIcon(options.icon, typeIcon),
            senderName: options.senderName ?? title ?? '',
            senderId: options.senderId ?? '',
            senderAvatar: isSafeSvgIcon(options.senderAvatar) || isSafeAvatarText(options.senderAvatar)
                ? options.senderAvatar
                : '',
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
     * collapseInfo：降一档
     *   - 已经到 minSize 下限 → 停在那，不关岛
     *     （音乐这类"活动还在继续"的岛设 minSize:'mini'，在别的 App 里随手点几下
     *       只会把它收成小豆子，不会把正在播放的状态点没）
     *   - 没设 minSize 且当前已是 mini → 关闭岛
     */
    function collapseInfo() {
        if (islandMode.value !== 'info') return;
        // compact 不在展开链里（那是通知/短提示尺寸），点外面直接关
        if (islandSize.value === 'compact') {
            closeIsland(ISLAND_CLOSE_REASONS.USER_OUTSIDE);
            return;
        }
        const idx = getCurrentSizeIndex();
        if (idx === -1) return;
        const minIdx = getMinSizeIndex();
        if (idx <= minIdx) {
            if (islandContent.value.minSize) return; // 收到底了，但这个岛不许被点没
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

    function handleIslandClick(e) {
        console.log('[Island] handleIslandClick, target=', e?.target, 'size=', islandSize.value);
        triggerActiveFeedback();
        if (isWidgetPicker()) return;
        if (runIslandTapInterceptor()) return;
        if (islandMode.value === 'notification') return;
        
        const idx = getCurrentSizeIndex();
        const maxIdx = getMaxSizeIndex();
        
        // 先检查是否点击了交互元素
        const target = e?.target;
        if (target) {
            const isInteractive = target.closest('button, a, [data-action], [onclick], input, textarea, select, .interactive, [role="button"]');
            if (isInteractive && (islandSize.value === 'medium' || islandSize.value === 'large')) {
                console.log('[Island] clicked interactive element, not expanding');
                return;
            }
        }
        
        // 点击的是空白区域或 mini 形态
        if (islandSize.value === 'mini' && idx < maxIdx) {
            console.log('[Island] mini -> expanding');
            expandInfo();
        } else if (islandSize.value === 'medium' && idx < maxIdx && maxIdx >= 2) {
            console.log('[Island] medium -> expanding to large');
            expandInfo();
        } else if (idx >= maxIdx && idx > 0) {
            // 已经是最大档:再点则收起一档(large → medium),形成 展开/收起 的来回切换
            console.log('[Island] at max size -> collapsing one step');
            collapseInfo();
        } else {
            console.log('[Island] not expanding, size=', islandSize.value, 'idx=', idx, 'maxIdx=', maxIdx);
        }
    }

    /**
     * 点击岛外部：
     *   - notification 形态：直接 dismiss（聊天通知点一下就没）
     *   - info 形态：collapseInfo（降一档，mini 再点才关）
     */
    function handleOutsideClick() {
        console.log('[Island] handleOutsideClick triggered, mode=', islandMode.value, 'size=', islandSize.value);
        if (islandMode.value !== 'info') {
            if (islandMode.value === 'notification') {
                closeIsland(ISLAND_CLOSE_REASONS.USER_OUTSIDE);
            }
            return;
        }
        console.log('[Island] calling collapseInfo...');
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
        islandAvatarText,
        islandAvatarHtml,
        safeSlotIcon,
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
