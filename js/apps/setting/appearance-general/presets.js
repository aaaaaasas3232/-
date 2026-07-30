/**
 * 设置 App · 外观与通用 · UI 预设
 *
 * 把所有「写死在代码里的可选值」集中到这里。
 *
 * 手机壳：单色 + 渐变两套预设（用户可切换模式）
 *   - SOLID_CASE_PRESETS    单色
 *   - GRADIENT_CASE_PRESETS 渐变
 *
 * 电池：只支持单色
 *   - SOLID_BATTERY_PRESETS
 *
 * 注意：手机壳圆角（caseRadius）已经从 UI 上移除（用户改不动），这里不再导出 CASE_RADIUS_PRESETS。
 */

/**
 * 手机壳 · 单色预设（ins 风低饱和）
 */
export const SOLID_CASE_PRESETS = Object.freeze([
    { label: '奶', value: '#F6EBDC' },
    { label: '杏', value: '#E8C9B0' },
    { label: '粉', value: '#F5C6D6' },
    { label: '紫', value: '#C9B6E4' },
    { label: '蓝', value: '#A9C8E8' },
    { label: '薄', value: '#B8E0D2' },
    { label: '灰', value: '#C8CCD3' },
    { label: '墨', value: '#2E2E33' },
]);

/**
 * 手机壳 · 渐变预设（ins 风柔粉/雾蓝/晚霞）
 */
export const GRADIENT_CASE_PRESETS = Object.freeze([
    { label: '原', value: 'linear-gradient(135deg, #f6d3e0 0%, #b4d7f2 100%)' },
    { label: '奶', value: 'linear-gradient(135deg, #fbe5d2 0%, #f6d3e0 100%)' },
    { label: '樱', value: 'linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%)' },
    { label: '雾', value: 'linear-gradient(135deg, #cdd9f2 0%, #b6c9e8 100%)' },
    { label: '薄', value: 'linear-gradient(135deg, #d4f1e9 0%, #a8dacd 100%)' },
    { label: '霞', value: 'linear-gradient(135deg, #f9c8b4 0%, #e58fa5 100%)' },
    { label: '紫', value: 'linear-gradient(135deg, #d9c2f0 0%, #a48bd9 100%)' },
    { label: '夜', value: 'linear-gradient(145deg, #2b2f3a 0%, #0e1117 100%)' },
]);

/**
 * 电池 · 单色预设（保留原 7 色）
 */
export const SOLID_BATTERY_PRESETS = Object.freeze([
    { label: '绿', value: '#73AE52' },
    { label: '白', value: '#FFFFFF' },
    { label: '黄', value: '#F5C443' },
    { label: '橙', value: '#FF8A3D' },
    { label: '红', value: '#E54B4B' },
    { label: '蓝', value: '#3B82F6' },
    { label: '紫', value: '#8B5CF6' },
]);

// 兼容旧名（其他地方可能还在 import）
export const SOLID_PRESETS = SOLID_BATTERY_PRESETS;
export const GRADIENT_PRESETS = GRADIENT_CASE_PRESETS;
export const CASE_PRESETS = GRADIENT_CASE_PRESETS;
export const BATTERY_PRESETS = SOLID_BATTERY_PRESETS;