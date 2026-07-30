/**
 * 小听框架 - 通用工具函数
 * 包含时间格式化、状态创建、UI 常量
 */

export const UI_CONSTANTS = {
    LONG_PRESS_MS: 460,
    ICON_DRAG_THRESHOLD: 10,
    CARD_DRAG_THRESHOLD: 8,
    CARD_DISMISS_THRESHOLD: 100,
    EDGE_FADE_DISTANCE: 90,
    CARD_WIDTH: 280,
    CARD_HEIGHT: 400,
    CARD_RADIUS: 28,
    FULL_RADIUS: 40,
    CARD_TOP_OFFSET: -30,
    CARD_CENTER_X: 54,
    CARD_CENTER_Y: 52,
    APP_TOP_OFFSET: 50,
    // 上滑 home indicator 触发“进入卡片”的距离阈值。
    // 低于该距离时 shell 只会持续缩小下沉并跟随手指，超过后才切换为卡片模式。
    // 调高到 100：让手指必须明确上滑一段距离才进入卡片，
    // 之前的 18px 在快速手势下会感觉“点一下就变卡片”。
    CONVERT_TO_CARD_THRESHOLD: 100,
    // 上滑距离达到多少才认为 progress 走满（progress 在 0~1 之间线性映射）。
    // 该值越大，进入卡片前可以拖的距离越长、手势“拖拽感”越明显。
    // 调高到 260：让手指有明显“拖一段”才到阈值，跟手 + 触觉反馈都更细腻。
    INDICATOR_FULL_TRAVEL: 260,
};

const TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

export function getTime() {
    return TIME_FORMATTER.format(new Date());
}

// 灵动岛关闭原因：所有 dismiss 路径必须经过 closeIsland(reason)，
// 任何想"主动关岛"的代码都应传入 reason，禁止直接调 setIdle。
export const ISLAND_CLOSE_REASONS = Object.freeze({
    MANUAL: 'manual',                // 自己调 dismiss
    USER_OUTSIDE: 'userOutside',     // 用户点了岛外部
    USER_LONG_PRESS: 'userLongPress', // 用户长按了岛（仅 mini 形态生效）
    LIFECYCLE_EXPIRED: 'lifecycleExpired', // lifecycle=time 到期
    REPLACED: 'replaced',            // 被另一个岛顶替
    EDIT_MODE: 'editMode',           // 编辑模式接管
    WIDGET_PICKER: 'widgetPicker',   // widget picker 接管
    FORCED: 'forced',                // 框架强制重置（异常恢复）
});

// 关闭后恢复栈顶的延迟：避免动画冲突
export const ISLAND_RESTORE_DELAY_MS = 300;

export function createEmptyIslandContent() {
    return {
        type: 'info',
        title: '',
        message: '',
        detail: '',
        icon: '',
        actions: [],
        islandTemplate: '',
        payload: null,
        miniVariant: 'split',
        senderName: '',
        senderId: '',
        senderAvatar: '',
        avatarBg: '',
        // 新增：widget 模式。widgetSlots = [{qualifiedId, icon, iconBg, label}]
        // 当 widgetSlots 非空时，灵动岛 mini 态会渲染多个图标 + label，
        // 整体保持"几个 app 图标位置挤一起" 的视觉感。
        widgetSlots: null,
        // === 新增：持有者与生命周期字段（v2 关闭逻辑收口） ===
        ownerId: '',                   // 挂岛的是谁（helper 自动注入 appId，app 不用填）
        lifecycle: 'manual',           // 'time' = 到期自动消失；'manual' = 永不自动退
        duration: 0,                   // ms（lifecycle=time 时生效）
        maxSize: null,                 // 'mini'|'compact'|'medium'|'large'|null = 点击不允许超过此 size
        closeReason: '',               // 当前岛是因为什么原因显示的（便于 app 区分处理）
        onKicked: null,                // 被另一个岛顶替时调（app 可选注册）
        onLongPress: null,             // mini 长按时调（app 可选注册）
        onClosed: null,                // 任何原因关岛时调（app 可选注册，用于"我被动关了"）
    };
}

export function createModalState(overrides = {}) {
    return {
        visible: false,
        type: 'center',
        title: '',
        text: '',
        ...overrides,
    };
}

export function createPressState() {
    return {
        appId: '',
        startX: 0,
        startY: 0,
        currentIndex: -1,
        sourceIndex: -1,
        timer: null,
        isDragging: false,
        longPressed: false,
        gridRect: null,
        pointerId: null,
        itemKind: 'app', // 'app' | 'widget'（来源标记，不影响拖拽逻辑但供 picker 使用）
    };
}

export function resetPressState(state) {
    state.appId = '';
    state.startX = 0;
    state.startY = 0;
    state.currentIndex = -1;
    state.sourceIndex = -1;
    state.isDragging = false;
    state.longPressed = false;
    state.gridRect = null;
    state.pointerId = null;
    state.itemKind = 'app';
}

export function createIndicatorGestureState() {
    return {
        startY: 0,
        startX: 0,
        moveY: 0,
        active: false,
        holdTimer: null,
        pointerId: null,
        mouseMoveHandler: null,
        mouseUpHandler: null,
        sourceEl: null,
    };
}

export function createCardDragState() {
    return {
        active: false,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
        moved: false,
    };
}