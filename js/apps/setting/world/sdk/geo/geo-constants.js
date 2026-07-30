/**
 * settings-sdk · 地理系统常量（Geo Constants）
 *
 * 从 defaults.js 提取的地点、场所相关常量。
 */

// ============================================
// 地点默认值（箱庭地图容器）
// ============================================

export const DEFAULT_PLACE = Object.freeze({
    id: '',
    worldRef: '',
    name: '新地点',
    icon: '',
    summary: '',
    mapImageUrl: '',
    mapImageWidth: 800,
    mapImageHeight: 600,
    defaultZoom: 1,
    mapOffsetX: 0,
    mapOffsetY: 0,
    // 映射真实城市（用于天气系统）
    realCityRef: null,
    createdAt: 0,
    updatedAt: 0,
});

// ============================================
// 访问备注默认值（per-persona 配置）
// ============================================

export const DEFAULT_ACCESS_NOTES = Object.freeze({
    visitors: {}, // { [personaId]: { enabled: true, frequency: 'often', note: '' } }
});

// 访问频率选项
export const ACCESS_FREQUENCIES = Object.freeze([
    { value: 'always', label: '总是' },
    { value: 'often', label: '经常' },
    { value: 'sometimes', label: '偶尔' },
    { value: 'rarely', label: '很少' },
    { value: 'never', label: '从不' },
]);

// ============================================
// 场所默认值（地点下的 pin）
// ============================================

export const DEFAULT_LOCATION = Object.freeze({
    id: '',
    worldRef: '',
    name: '新地点',
    isCenter: false,
    position: { x: 0, y: 0 },
    _v2: true,
    placeRef: null,
    realCityRef: null,
    occupants: [],
    tagRefs: [],
    summary: '',
    icon: '',
    allowedPhases: null,
    allowedRoles: ['user', 'ai'],
    accessType: 'open',
    // v0.24: accessNotes 升级为 per-persona 配置结构
    accessNotes: DEFAULT_ACCESS_NOTES,
    createdAt: 0,
    updatedAt: 0,
});

// ============================================
// 城市预设
// ============================================

export const REAL_CITIES = Object.freeze([
    { id: 'beijing', label: '北京' },
    { id: 'shanghai', label: '上海' },
    { id: 'guangzhou', label: '广州' },
    { id: 'shenzhen', label: '深圳' },
    { id: 'hangzhou', label: '杭州' },
    { id: 'chengdu', label: '成都' },
    { id: 'nanjing', label: '南京' },
    { id: 'suzhou', label: '苏州' },
    { id: 'xian', label: '西安' },
    { id: 'chongqing', label: '重庆' },
    { id: 'wuhan', label: '武汉' },
    { id: 'tokyo', label: '东京' },
    { id: 'singapore', label: '新加坡' },
    { id: 'london', label: '伦敦' },
    { id: 'paris', label: '巴黎' },
    { id: 'newyork', label: '纽约' },
]);
