/**
 * settings-sdk · 时间系统常量（Chronology Constants）v0.17
 *
 * 从 defaults.js 提取的时间、锚点、时间线相关常量。
 * 保持 Object.freeze() 确保运行时不可变。
 *
 * 注意：
 *   - 阶段系统已从世界观移除（v0.16 → 后续挪到人设）。
 *   - 周期层级（v0.17）：
 *       大周期（年） → 中周期（月）→ 小周期（日）。
 *     「基周期」/「周」概念已彻底移除。
 */

// ============================================
// 时间线常量
// ============================================

export const TIMELINE_CATEGORIES = Object.freeze({
    ROUTINE: 'routine',     // 例行（课表/训练表）
    CUSTOM: 'custom',       // 用户自定义
});

export const TIMELINE_TYPES = Object.freeze({
    PERSONAL: 'personal',
    WORLD: 'world',
});

// ============================================
// 锚点类型常量（v0.16）
// ============================================

export const ANCHOR_TYPES = Object.freeze({
    RANGE: 'range',     // 段锚点（按中周期级定义一段范围）
    POINT: 'point',     // 点锚点（按小周期即日级定义一个具体日期）
});

// ============================================
// 时间线事件默认值
// ============================================

export const DEFAULT_TIMELINE_EVENT = Object.freeze({
    id: '',
    type: TIMELINE_TYPES.PERSONAL,
    ownerKey: 'user',
    title: '',
    date: '',
    category: TIMELINE_CATEGORIES.ROUTINE,
    description: '',
    createdAt: 0,
    updatedAt: 0,
});

// ============================================
// 锚点默认值（v0.16）
// ============================================

export const DEFAULT_ANCHOR = Object.freeze({
    id: '',
    worldRef: '',
    type: ANCHOR_TYPES.RANGE,
    label: '',
    description: '',
    start: { year: 0, month: 0, day: 0 },
    end:   { year: 0, month: 0, day: 0 }, // point 类型此字段为 null
    boundAiIds: [],
    createdAt: 0,
    updatedAt: 0,
});

// ============================================
// 纪时系统默认值（v0.17：移除基周期、移除周，小周期 = 日）
// ============================================
//
// 时间单位层级（由大到小）：
//   - 大周期（年）：最大循环单位，用户自定义名称（如"纪"、"元"、"年"）
//   - 中周期（月）：中间循环单位，用户自定义名称
//   - 小周期（日）：较小循环单位（注：v0.17「日」是默认的「小周期」名，已彻底删除"周"概念）
//   - 微周期（时）：小周期内部的细分循环（如 1 日 = 24 时辰）
//   - 瞬周期（分秒）：最小时间颗粒
//
// dateFieldVisibility 字段顺序：大 / 中 / 小（已去掉"基"、"周"）
//
// ============================================

export const DEFAULT_CHRONOLOGY_FALLBACK = Object.freeze({
    enabled: false,
    baseYear: 2000,
    largeCycleName: '',
    yearLabel: '年',
    mediumCycleName: '',
    monthLabel: '月',
    smallCycleName: '日',
    dayLabel: '日',
    hourLabel: '时',
    customHours: [],
    // 日期录入时哪些周期字段可见（默认全部可见）。
    // 仅剩 year / month / day 三段
    dateFieldVisibility: { year: true, month: true, day: true },

    // 时差系统（与纪时映射并行，见 defaults.js DEFAULT_WORLD_INSTANCE 的注释）
    timeOffsetEnabled: false,
    userRegionName: '',
    userOffsetHours: 0,
    aiRegionName: '',
    aiOffsetHours: 0,
});

// 顶部状态栏时间的显示模式（存 localStorage，见 world/chronology-clock.js）
export const CLOCK_MODES = Object.freeze({
    REAL: 'real',              // 现实时间 12:33
    CHRONOLOGY: 'chronology',  // 世界观纪时 辰时
    OFFSET: 'offset',          // 同世界不同地区 —— 用户所在地的钟点
});

export const CLOCK_MODE_LABELS = Object.freeze({
    real: '真实时间',
    chronology: '纪时',
    offset: '时差',
});

// 状态栏时间显示模式的 localStorage key。
// 为什么用 localStorage 而不是 IndexedDB：状态栏每秒重算一次，
// 格式化函数必须**同步**拿到配置，异步读盘来不及（同 §9.10 灵动岛偏好）。
export const CLOCK_MODE_STORAGE_KEY = 'xiaoting::phone-clock-mode-v1';

// 默认细分规则（v0.17：周期层级 = 大 / 中 / 日）
export const DEFAULT_DIVISIONS = Object.freeze({
    year: 12,     // 1 年 = 12 月
    month: 30,    // 1 月 = 30 日（小周期）
    day: 24,      // 1 日 = 24 时
    hour: 60,     // 1 时 = 60 分
    minute: 60,   // 1 分 = 60 秒
});

// 默认周名称（中文：周一到周日）
export const DEFAULT_WEEK_DAY_NAMES = Object.freeze(['周一', '周二', '周三', '周四', '周五', '周六', '周日']);

// 默认货币名称
export const DEFAULT_CURRENCY_NAME = '金币';

// 默认时辰表
export const DEFAULT_12_HOURS = Object.freeze([
    '子时', '丑时', '寅时', '卯时', '辰时', '巳时',
    '午时', '未时', '申时', '酉时', '戌时', '亥时'
]);

export const DEFAULT_24_HOURS = Object.freeze(
    Array.from({ length: 24 }, (_, i) => `${i}时`)
);