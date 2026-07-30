/**
 * 状态栏模块 · 状态管理
 *
 * 核心状态对象：
 * {
 *   showStatusBar: boolean,            // 整体显示状态栏开关（不影响灵动岛）
 *   statusBarTimeColor: string,        // 时间颜色（空字符串 = 跟随 activeApp.statusBarColor）
 *   statusBarSignalColor: string,      // 信号颜色（空 = 跟随）
 *   statusBarFiveGColor: string,       // 5G 颜色（空 = 跟随）
 *   statusBarFiveGLabel: string,       // 5G 文本替换（默认 '5G'）
 * }
 *
 * 注意：之前还有 showStatusBarTime / Signal / FiveG 用于单独控制时间 / 信号 / 5G 显隐，
 *       现已删除 —— 状态栏元素整体显示/隐藏由 `showStatusBar` 一个开关决定。
 *
 * 提供：
 * - getState() / setState() - 读写状态
 * - serialize / deserialize - 持久化（直接用 plain object 字段，由 IndexedDB 持久化）
 * - isColorEmpty(color) - 判定"是否为空字符串 = 跟随默认色"
 */

// ============================================
// 默认状态
// ============================================

export const DEFAULT_STATUS_BAR_STATE = Object.freeze({
    showStatusBar: true,
    statusBarTimeColor: '',
    statusBarSignalColor: '',
    statusBarFiveGColor: '',
    statusBarFiveGLabel: '5G',
});

// ============================================
// 状态存储（模块级单例）
// ============================================

let _state = { ...DEFAULT_STATUS_BAR_STATE };

/** 获取当前状态栏状态（返回浅拷贝，防止外部直接修改内部对象） */
export function getState() {
    return { ..._state };
}

/** 设置状态栏状态（部分合并） */
export function setState(partial) {
    _state = { ..._state, ...partial };
}

/** 重置为默认状态 */
export function resetState() {
    _state = { ...DEFAULT_STATUS_BAR_STATE };
}

// ============================================
// 工具函数
// ============================================

/**
 * 判定颜色字段是否为空（即"跟随默认色"语义）。
 * 空字符串 / null / undefined 都视为"跟随"。
 */
export function isColorEmpty(value) {
    return !(typeof value === 'string' && value.length > 0);
}

/**
 * 规范化布尔字段：true / false。
 * 默认 true（即缺省 = 显示）。
 */
export function normalizeBool(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    return fallback;
}

// ============================================
// 持久化序列化 / 反序列化
// ============================================

/**
 * 把状态栏状态打包成 plain object。
 * 注：状态栏字段直接存在 IndexedDB 的 device-theme 这条记录的顶层，
 *     所以这里只是规范化一下字段类型 / 提供默认值。
 */
export function serialize(state) {
    const s = state || _state;
    return {
        showStatusBar: normalizeBool(s.showStatusBar, true),
        statusBarTimeColor: typeof s.statusBarTimeColor === 'string' ? s.statusBarTimeColor : '',
        statusBarSignalColor: typeof s.statusBarSignalColor === 'string' ? s.statusBarSignalColor : '',
        statusBarFiveGColor: typeof s.statusBarFiveGColor === 'string' ? s.statusBarFiveGColor : '',
        statusBarFiveGLabel: (typeof s.statusBarFiveGLabel === 'string' && s.statusBarFiveGLabel)
            ? s.statusBarFiveGLabel
            : '5G',
    };
}

/** 从 IndexedDB 读出的 raw 记录里提取状态栏字段（缺失字段用默认值补） */
export function deserialize(raw) {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATUS_BAR_STATE };
    return {
        showStatusBar: raw.showStatusBar !== false,
        statusBarTimeColor: typeof raw.statusBarTimeColor === 'string' ? raw.statusBarTimeColor : '',
        statusBarSignalColor: typeof raw.statusBarSignalColor === 'string' ? raw.statusBarSignalColor : '',
        statusBarFiveGColor: typeof raw.statusBarFiveGColor === 'string' ? raw.statusBarFiveGColor : '',
        statusBarFiveGLabel: (typeof raw.statusBarFiveGLabel === 'string' && raw.statusBarFiveGLabel)
            ? raw.statusBarFiveGLabel
            : '5G',
    };
}