/**
 * 心情模块 - 统一常量与工具函数
 * 
 * 所有心情相关的常量、预设、判断函数都集中在这里。
 * 避免 MOOD_PRESETS 和 getMoodIsPositive 在多处重复定义。
 */

// ============================================
// 心情预设（唯一定义点）
// ============================================

/**
 * @typedef {Object} MoodPreset
 * @property {string} label - 心情标签（如"开心"、"焦虑"）
 * @property {boolean} isPositive - 是否是好心情
 * @property {number} defaultIntensity - 默认浓度 0.0~1.0
 */

/** @type {MoodPreset[]} */
export const MOOD_PRESETS = [
    { label: '开心',    isPositive: true,  defaultIntensity: 0.8 },
    { label: '平静',    isPositive: true,  defaultIntensity: 0.5 },
    { label: '期待',    isPositive: true,  defaultIntensity: 0.7 },
    { label: '专注',    isPositive: true,  defaultIntensity: 0.6 },
    { label: '小确幸',  isPositive: true,  defaultIntensity: 0.6 },
    { label: '低落',    isPositive: false, defaultIntensity: 0.5 },
    { label: '焦虑',    isPositive: false, defaultIntensity: 0.6 },
    { label: '疲惫',    isPositive: false, defaultIntensity: 0.5 },
];

/** 心情标签数组（用于下拉选择等） */
export const MOOD_LABELS = MOOD_PRESETS.map(m => m.label);

// ============================================
// 心情判断函数
// ============================================

/**
 * 根据心情标签判断是否是好心情
 * @param {string} moodLabel
 * @returns {boolean} true=好心情, false=坏心情
 */
export function getMoodIsPositive(moodLabel) {
    const preset = MOOD_PRESETS.find(m => m.label === moodLabel);
    return preset ? preset.isPositive : true;
}

/**
 * 根据心情标签获取默认浓度
 * @param {string} moodLabel
 * @returns {number} 0.0~1.0
 */
export function getMoodDefaultIntensity(moodLabel) {
    const preset = MOOD_PRESETS.find(m => m.label === moodLabel);
    return preset ? preset.defaultIntensity : 0.5;
}

/**
 * 根据心情标签获取预设信息
 * @param {string} moodLabel
 * @returns {MoodPreset | null}
 */
export function getMoodPreset(moodLabel) {
    return MOOD_PRESETS.find(m => m.label === moodLabel) || null;
}

// ============================================
// 心情颜色计算
// ============================================

/**
 * 根据心情浓度和正负性计算颜色（背景色）
 * @param {boolean} isPositive - 是否是好心情
 * @param {number} intensity - 浓度 0.0~1.0
 * @returns {string} rgb(r, g, b) 格式
 */
export function getMoodColor(isPositive, intensity) {
    // 防御：确保 intensity 是有效数字
    const safeIntensity = (typeof intensity !== 'number' || isNaN(intensity)) ? 0.5 : Math.max(0, Math.min(1, intensity));
    
    if (isPositive) {
        // 珊瑚粉系：极淡 → 淡 → 中 → 深
        const colors = [
            { r: 255, g: 241, b: 240 },
            { r: 255, g: 204, b: 199 },
            { r: 255, g: 120, b: 117 },
            { r: 217, g: 54,  b: 54  },
        ];
        const idx = Math.min(3, Math.floor(safeIntensity * 4));
        const nextIdx = Math.min(3, idx + 1);
        const t = (safeIntensity * 4) % 1;
        const r = Math.round(colors[idx].r + (colors[nextIdx].r - colors[idx].r) * t);
        const g = Math.round(colors[idx].g + (colors[nextIdx].g - colors[idx].g) * t);
        const b = Math.round(colors[idx].b + (colors[nextIdx].b - colors[idx].b) * t);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // 天蓝系：极淡 → 淡 → 中 → 深
        const colors = [
            { r: 230, g: 244, b: 255 },
            { r: 186, g: 224, b: 255 },
            { r: 105, g: 177, b: 255 },
            { r: 22,  g: 119, b: 255 },
        ];
        const idx = Math.min(3, Math.floor(safeIntensity * 4));
        const nextIdx = Math.min(3, idx + 1);
        const t = (safeIntensity * 4) % 1;
        const r = Math.round(colors[idx].r + (colors[nextIdx].r - colors[idx].r) * t);
        const g = Math.round(colors[idx].g + (colors[nextIdx].g - colors[idx].g) * t);
        const b = Math.round(colors[idx].b + (colors[nextIdx].b - colors[idx].b) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }
}

/**
 * 根据心情浓度和正负性计算边框颜色（比背景深一点）
 * @param {boolean} isPositive
 * @param {number} intensity
 * @returns {string}
 */
export function getMoodBorderColor(isPositive, intensity) {
    const safeIntensity = (typeof intensity !== 'number' || isNaN(intensity)) ? 0.5 : Math.max(0, Math.min(1, intensity));
    
    if (isPositive) {
        const colors = [
            { r: 255, g: 230, b: 228 },
            { r: 255, g: 190, b: 185 },
            { r: 255, g: 100, b: 95  },
            { r: 200, g: 40,  b: 40  },
        ];
        const idx = Math.min(3, Math.floor(safeIntensity * 4));
        const nextIdx = Math.min(3, idx + 1);
        const t = (safeIntensity * 4) % 1;
        const r = Math.round(colors[idx].r + (colors[nextIdx].r - colors[idx].r) * t);
        const g = Math.round(colors[idx].g + (colors[nextIdx].g - colors[idx].g) * t);
        const b = Math.round(colors[idx].b + (colors[nextIdx].b - colors[idx].b) * t);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        const colors = [
            { r: 210, g: 230, b: 255 },
            { r: 160, g: 200, b: 255 },
            { r: 80,  g: 150, b: 255 },
            { r: 15,  g: 100, b: 255 },
        ];
        const idx = Math.min(3, Math.floor(safeIntensity * 4));
        const nextIdx = Math.min(3, idx + 1);
        const t = (safeIntensity * 4) % 1;
        const r = Math.round(colors[idx].r + (colors[nextIdx].r - colors[idx].r) * t);
        const g = Math.round(colors[idx].g + (colors[nextIdx].g - colors[idx].g) * t);
        const b = Math.round(colors[idx].b + (colors[nextIdx].b - colors[idx].b) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }
}

/**
 * 获取浓度条的内联样式
 * @param {boolean} isPositive
 * @param {number} intensity
 * @returns {string} CSS style 字符串
 */
export function getMoodIntensityStyle(isPositive, intensity) {
    const safeIntensity = (typeof intensity !== 'number' || isNaN(intensity)) ? 0.5 : Math.max(0, Math.min(1, intensity));
    return `width: ${Math.round(safeIntensity * 100)}%`;
}

// ============================================
// 日期工具
// ============================================

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date = new Date()) {
    const d = date.toLocaleDateString('en-CA');
    return d;
}
