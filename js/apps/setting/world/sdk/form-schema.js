/**
 * 世界观模块 · 表单 schema 定义
 *
 * 一个 schema 描述一个编辑表单的结构，由 form-renderer / form-reader 双向消费。
 *
 * 支持的字段类型：text / textarea / number / color / date / checkbox /
 *                select / radio / checkboxGroup / group
 *
 * 字段 schema 形态：
 * {
 *   key: 'name',                 // 唯一，DOM attribute = data-{ns}-field="{nsKey}"
 *   nsKey: 'name',               // 命名空间内的子 key（默认 = key；动态 ns 时可改写）
 *   label: '名称',                 // 显示文案；checkbox 单值 / group 内字段可省略
 *   type: 'text',                // 8 种类型之一
 *   placeholder: '地点名称',
 *   defaultValue: '',             // 渲染缺省值；reader 不使用
 *   rows: 2,                      // textarea 专用
 *   options: [{value, label}],    // select / radio 专用
 *   optionsFromConstants: 'REAL_CITIES',   // 从本文件常量取
 *   optionsFromContext: 'phases',           // 从 ctx 动态取
 *   optionsFn: (model, ctx) => [{value, label}],  // 自定义函数（跨 app 数据源）
 *   optionValueKey: 'id',
 *   optionLabelKey: 'label',
 *   optionLabelFn: (item) => string,         // 自定义 label
 *   allowEmpty: false,
 *   emptyLabel: '',
 *   items: [{value, label}],      // checkboxGroup 专用
 *   itemsFromContext: 'phases',
 *   inline: false,                // group 内字段 inline 排
 *   sep: '~',                     // group 内 inline 字段间的分隔文本
 *   wrap: false,                  // checkboxGroup 是否换行
 *   className: '',                // input 额外 class
 *   split: null,                  // 'comma' | 'line' | 'hyphen' read 时切数组
 *   parse: null,                  // 'number' read 时 Number()
 *   bind: null,                   // 嵌套数据写入路径：'calendarSettings.hasWorkday'
 *   transformRead: (raw, model) => value,   // read 后加工
 *   transformWrite: (model, ctx) => value,  // 渲染前从 model 取值
 *   defaultOnRead: null,          // read 后为空时塞的默认值
 *   fields: [],                   // group 专用：子字段
 * }
 *
 * 表单 schema 形态：
 * {
 *   fieldNamespace: 'faction',    // 必填：DOM data-*-field 前缀
 *   wrapperClass: '',             // 可选：外层 .wv-editor 额外 class
 *   namespaceParam: null,         // 可选：动态命名空间参数名（transition 用）
 *   sections: [{title, fields}],  // 可选：分组布局
 *   fields: [...],                // sections 不写时用这个（扁平）
 *   actionsBuilder: (ctx, model) => string,  // 可选：自定义 actions 区 HTML（覆盖默认保存/取消）
 * }
 */

import {
    REAL_CITIES,
    TIMELINE_CATEGORIES,
} from './defaults.js';
// ============================================
// 共享工具（被 reader / renderer 复用）
// ============================================

export const safeJSONOr = (text, fallback) => {
    try {
        const parsed = JSON.parse(text);
        return parsed == null ? fallback : parsed;
    } catch (_e) {
        return fallback;
    }
};

export const splitLines = (text) =>
    (text || '').split('\n').map(s => s.trim()).filter(Boolean);

export const splitCommas = (text) =>
    (text || '').split(',').map(s => s.trim()).filter(Boolean);

export const splitHyphen = (text) =>
    (text || '').split('-').map(s => s.trim()).filter(Boolean);

export const splitText = (text, mode) => {
    if (mode === 'line') return splitLines(text);
    if (mode === 'comma') return splitCommas(text);
    if (mode === 'hyphen') return splitHyphen(text);
    return text;
};

export const CONSTANT_LOOKUP = {
    REAL_CITIES,
    TIMELINE_CATEGORIES,
};

// path 操作（嵌套数据写入用）
export const getByPath = (obj, path) => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
};

export const setByPath = (obj, path, value) => {
    if (!path) return value;
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
    return obj;
};

// namespace 解析：data-{ns}-field 的真正 attribute 值
// 普通 form：return nsKey
// 动态 ns：return `${ctx[namespaceParam]}-${nsKey}`（如 transition 用 transitionId）
export const resolveAttrKey = (field, schema, ctx) => {
    const nsKey = field.nsKey != null ? field.nsKey : field.key;
    if (schema.namespaceParam && ctx && ctx[schema.namespaceParam] != null) {
        return `${ctx[schema.namespaceParam]}-${nsKey}`;
    }
    return nsKey;
};

export const selectorFor = (field, schema, ctx) =>
    `[data-${schema.fieldNamespace}-field="${resolveAttrKey(field, schema, ctx)}"]`;

// ============================================
// 各表单 schema
// ============================================

export const WORLD_GROUP_FORM_SCHEMA = {
    fieldNamespace: 'worldgroup',
    wrapperClass: 'wv-group-editor',
    fields: [
        { key: 'name', label: '名称 *', type: 'text',
            placeholder: '比如：现代世界观、古代世界观', topSpacing: true },
        { key: 'description', label: '', type: 'textarea', rows: 2,
            placeholder: '这个库用来装什么样的世界观？', noLabel: true },
    ],
};

export const TAG_GROUP_FORM_SCHEMA = {
    fieldNamespace: 'taggroup',
    wrapperClass: 'wv-group-editor',
    fields: [
        { key: 'name', label: '名称', type: 'text', placeholder: '标签组名称', topSpacing: true },
        { key: 'description', label: '描述', type: 'text', placeholder: '标签组的用途说明', stackLabel: true },
        { key: 'scope', label: '作用域', type: 'select',
            options: (model, ctx) => {
                const wid = ctx?.activeWorld?.id || '';
                return [
                    { value: 'global', label: '全局（所有世界观）' },
                    { value: 'world:' + wid, label: '当前世界观' },
                ];
            } },
    ],
};

export const TIMELINE_FORM_SCHEMA = {
    fieldNamespace: 'timeline',
    wrapperClass: 'wv-timeline-add',
    fields: [
        { key: 'title', label: '标题 *', type: 'text', placeholder: '事件标题' },
        { key: 'date', label: '日期', type: 'chronology-date' },
        { key: 'description', label: '描述', type: 'textarea', rows: 2 },
    ],
};

export const CHRONICLE_EVENT_FORM_SCHEMA = {
    fieldNamespace: 'chronicle-event',
    fields: [
        { key: 'title', label: '标题 *', type: 'text', placeholder: '事件标题' },
        { key: 'date', label: '日期', type: 'chronology-date',
            placeholder: '选择或输入日期' },
        { key: 'category', label: '类型', type: 'select',
            optionsFromConstants: 'TIMELINE_CATEGORIES' },
        { key: 'description', label: '描述', type: 'textarea', rows: 2 },
    ],
};

export const ANCHOR_FORM_SCHEMA = {
    fieldNamespace: 'anchor',
    wrapperClass: 'wv-anchor-editor',
    fields: [
        { key: 'label', label: '标签 *', type: 'text', placeholder: '如：春季赛' },
        { key: 'description', label: '描述', noLabel: true, type: 'textarea', rows: 2,
            placeholder: '点锚点就是「往后每年这天都作为某纪念日」' },
        { type: 'group', inline: true, fields: [
            { key: 'startYear', type: 'number', placeholder: '年', defaultValue: 0, inline: true, sep: '年', className: 'wv-editor__input--year' },
            { key: 'startMonth', type: 'number', placeholder: '月', defaultValue: 0, inline: true, sep: '月' },
            { key: 'startDay', type: 'number', placeholder: '日', defaultValue: 0, inline: true, sep: '日' },
        ]},
    ],
};

// ============================================
// Place（地点）表单 schema
// ============================================

export const PLACE_FORM_SCHEMA = {
    fieldNamespace: 'place',
    wrapperClass: 'wv-place-editor',
    noSection: true,
    sections: [
        {
            title: '基本信息',
            fields: [
                { key: 'name', label: '名称', type: 'text', placeholder: '地点名称（如：A城）', labelPosition: 'top' },
                { key: 'icon', label: '地标', type: 'landmark-icon', labelPosition: 'top' },
                { type: 'group', label: '地标配色', inline: true, fields: [
                    { key: 'pinBg', label: '底色', type: 'color', defaultValue: '#E8F1FF', inline: true, inlineLayout: true },
                    // 描边色与图标色是同一个值（规范：SVG 色 = 描边色 ≠ 底色）
                    { key: 'pinStroke', label: '图标与描边', type: 'color', defaultValue: '#0A84FF', inline: true, inlineLayout: true },
                ]},
                { key: 'summary', label: '描述', type: 'textarea', rows: 3, placeholder: '简要描述这个地点...', labelPosition: 'top' },
            ]
        },
        {
            title: '位置信息',
            fields: [
                { type: 'group', label: '坐标', inline: true, fields: [
                    { key: 'offsetX', type: 'number', placeholder: 'X', defaultValue: 0, inline: true,
                        className: 'wv-editor__input--coord',
                        transformWrite: (model) => {
                            const v = model?.mapOffsetX;
                            return typeof v === 'number' ? v : 0;
                        } },
                    { key: 'offsetY', type: 'number', placeholder: 'Y', defaultValue: 0, inline: true, sep: ',',
                        className: 'wv-editor__input--coord',
                        transformWrite: (model) => {
                            const v = model?.mapOffsetY;
                            return typeof v === 'number' ? v : 0;
                        } },
                ]},
                { key: 'realCityRef', label: '映射城市（天气）', type: 'select',
                    // v0.27：选项动态取自 weather app 已添加的城市列表，
                    // 不再走预设的 REAL_CITIES（16 城硬编码）。
                    optionsFn: () => {
                        const w = window.weatherAppState;
                        const list = Array.isArray(w?.cities) ? w.cities : [];
                        // 如果 weather app 还没 hydrate（window.weatherAppState 不存在或 cities 为空），
                        // 注册一次 weather-hydrated 监听，事件触发后让当前 detail view 重渲。
                        // 注意：用 window 级一次性 flag 防止重复注册（多次 form render 也只挂一个监听）。
                        if ((!w || list.length === 0) && !window.__weatherHydratedHookArmed) {
                            window.__weatherHydratedHookArmed = true;
                            window.addEventListener('weather-hydrated', () => {
                                window.__weatherHydratedHookArmed = false;
                                try {
                                    if (window.__detailRenderTick) window.__detailRenderTick.value++;
                                } catch (_) { /* ignore */ }
                            }, { once: true });
                        }
                        return list
                            .filter(c => c && c.name)
                            .map(c => ({
                                id: c.name,        // 用 id 字段做 value（兼容 form-renderer 的 optionValueKey 默认 'id'）
                                name: c.mappedName
                                    ? `${c.name}（${c.mappedName}）`
                                    : c.name,
                            }));
                    },
                    defaultValue: '', allowEmpty: true, emptyLabel: '不映射', labelPosition: 'top' },
            ]
        },
    ],
};

// ============================================
// Location（场所）表单 schema
// ============================================

export const LOCATION_FORM_SCHEMA = {
    fieldNamespace: 'location',
    wrapperClass: 'wv-location-editor',
    noSection: true,
    sections: [
        {
            title: '基本信息',
            fields: [
                { key: 'name', label: '名称', type: 'text', placeholder: '场所名称', labelPosition: 'top' },
                { key: 'icon', label: '地标', type: 'landmark-icon', labelPosition: 'top' },
                { type: 'group', label: '地标配色', inline: true, fields: [
                    { key: 'pinBg', label: '底色', type: 'color', defaultValue: '#E8F1FF', inline: true, inlineLayout: true },
                    { key: 'pinStroke', label: '图标与描边', type: 'color', defaultValue: '#0A84FF', inline: true, inlineLayout: true },
                ]},
                { key: 'summary', label: '描述', type: 'textarea', rows: 3, placeholder: '简要描述这个场所...', labelPosition: 'top' },
            ]
        },
        {
            title: '归属与位置',
            fields: [
                { key: 'placeRef', label: '所属地点', type: 'select',
                    optionsFromContext: 'places',
                    optionValueKey: 'id', optionLabelKey: 'name',
                    defaultValue: '', allowEmpty: true, emptyLabel: '无地点（全局）', labelPosition: 'top' },
                { type: 'group', label: '坐标（相对主地点）', inline: true, fields: [
                    { key: 'posX', type: 'number', placeholder: 'X', defaultValue: 0, inline: true,
                        className: 'wv-editor__input--coord',
                        bind: 'position.x',
                        transformWrite: (model) => {
                            const v = model?.position?.x;
                            return typeof v === 'number' ? v : 0;
                        } },
                    { key: 'posY', type: 'number', placeholder: 'Y', defaultValue: 0, inline: true, sep: ',',
                        className: 'wv-editor__input--coord',
                        bind: 'position.y',
                        transformWrite: (model) => {
                            const v = model?.position?.y;
                            return typeof v === 'number' ? v : 0;
                        } },
                ]},
            ]
        },
        {
            title: '访问权限',
            fields: [
                // v0.24: 访问备注升级为 per-persona 配置
                { key: 'accessNotes', label: '访问备注', type: 'location-access',
                    transformWrite: (model) => {
                        const notes = model?.accessNotes;
                        if (notes && typeof notes === 'object' && notes.visitors !== undefined) {
                            return notes;
                        }
                        return { visitors: {} };
                    } },
            ]
        },
    ],
};

// ====== WORLD_MARKER ======

export const WORLD_FORM_SCHEMA = {
    fieldNamespace: 'world',
    wrapperClass: 'wv-world-editor',
    sections: [
        {
            title: '基础设定',
            fields: [
                { key: 'name', label: '名称 *', type: 'text', placeholder: '给这个世界观起个名字', inline: true },
                {
                    key: 'experienceMode',
                    label: '专属体验',
                    type: 'select',
                    defaultValue: 'general',
                    options: [
                        { value: 'general', label: '通用世界' },
                        { value: 'cultivation', label: '修仙' },
                        { value: 'apocalypse', label: '末日' },
                        { value: 'esports', label: '电竞' },
                        { value: 'actor', label: '演员' },
                        { value: 'idol', label: '爱豆' },
                    ],
                },
                { key: 'summary', label: '一句话主旨 *', type: 'textarea', rows: 2,
                    placeholder: '用一句话概括世界观的核心氛围' },
                { key: 'notes', label: '详细说明', type: 'textarea', rows: 4,
                    placeholder: '补充说明、背景故事等' },
            ],
        },
        {
            title: '纪时系统',
            fields: [
                { key: 'chronologyEnabled', label: '启用纪时映射', type: 'checkbox', inlineLabel: true,
                    bind: 'chronologySettings.enabled',
                    transformWrite: (model) => !!model.chronologySettings?.enabled },
                { key: 'chronologyBaseYear', label: '基准年（现实）', type: 'number', inline: true,
                    placeholder: '2000', defaultValue: 2000,
                    bind: 'chronologySettings.baseYear',
                    transformWrite: (model) => model.chronologySettings?.baseYear ?? 2000,
                    transformRead: (raw) => Number(raw) || 2000 },
                { key: 'chronologyLargeCycleName', label: '大周期名称', type: 'text', inline: true,
                    placeholder: '如：洪武 / 第一纪 / 元亨 …', defaultValue: '',
                    bind: 'chronologySettings.largeCycleName',
                    transformWrite: (model) => model.chronologySettings?.largeCycleName ?? '' },
                { key: 'chronologyYearLabel', label: '大周期单位', type: 'text', inline: true,
                    placeholder: '如：年 / 纪 …', defaultValue: '年',
                    bind: 'chronologySettings.yearLabel',
                    transformWrite: (model) => model.chronologySettings?.yearLabel ?? '年' },
                { key: 'chronologyMediumCycleName', label: '中周期名称', type: 'text', inline: true,
                    placeholder: '如：新 / 泰 …', defaultValue: '',
                    bind: 'chronologySettings.mediumCycleName',
                    transformWrite: (model) => model.chronologySettings?.mediumCycleName ?? '' },
                { key: 'chronologyMonthLabel', label: '中周期单位', type: 'text', inline: true,
                    placeholder: '如：月 / 章 …', defaultValue: '月',
                    bind: 'chronologySettings.monthLabel',
                    transformWrite: (model) => model.chronologySettings?.monthLabel ?? '月' },
                { key: 'chronologySmallCycleName', label: '小周期名称', type: 'text', inline: true,
                    placeholder: '如：日 …', defaultValue: '',
                    bind: 'chronologySettings.smallCycleName',
                    transformWrite: (model) => model.chronologySettings?.smallCycleName ?? '' },
                { key: 'chronologyDayLabel', label: '日 单位', type: 'text', inline: true,
                    placeholder: '如：日 / 天 …', defaultValue: '日',
                    bind: 'chronologySettings.dayLabel',
                    transformWrite: (model) => model.chronologySettings?.dayLabel ?? '日' },
                { key: 'chronologyWeekDayNames', label: '周名称（7天）', type: 'chronology-weekdays',
                    bind: 'chronologySettings.weekDayNames',
                    transformWrite: (model) => {
                        const raw = model.chronologySettings?.weekDayNames;
                        if (Array.isArray(raw)) return raw;
                        return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
                    },
                    transformRead: (raw) => {
                        if (Array.isArray(raw)) return raw;
                        return raw || ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
                    } },
                { key: 'chronologyHoursBlock', label: '时段设置', type: 'chronology-hours',
                    bind: ['chronologySettings.hourLabel', 'chronologySettings.customHours', 'chronologySettings.hoursRatio'],
                    transformWrite: (model) => ({
                        hourLabel: model.chronologySettings?.hourLabel ?? '时',
                        customHours: model.chronologySettings?.customHours ?? [],
                        ratio: model.chronologySettings?.hoursRatio ?? { base: 1, real: 1 }
                    }),
                    transformRead: (raw) => raw?.hourLabel ?? '时',
                    transformReadHours: (raw) => raw?.customHours ?? [],
                    transformReadRatio: (raw) => raw?.ratio ?? { base: 1, real: 1 } },
            ],
        },
        {
            // ── 时差系统 ────────────────────────────────────────────
            // 和上面的「纪时系统」是**两套并行**的，不是一个东西的两半：
            //   · 纪时映射：用户和 AI 在两个世界，时间单位都不一样（12:33 → 辰时）
            //   · 时差    ：用户和 AI 在同一个世界的不同地区，单位一样只差钟点
            // 两个都开时先算时差、再套纪时（时差决定「几点」，纪时决定「叫什么」）。
            title: '时差（同世界不同地区）',
            fields: [
                { key: 'chronologyTimeOffsetEnabled', label: '启用时差', type: 'checkbox', inlineLabel: true,
                    bind: 'chronologySettings.timeOffsetEnabled',
                    transformWrite: (model) => !!model.chronologySettings?.timeOffsetEnabled },
                { key: 'chronologyUserRegionName', label: '用户所在地', type: 'text', inline: true,
                    placeholder: '如：东都 / 北境 …', defaultValue: '',
                    bind: 'chronologySettings.userRegionName',
                    transformWrite: (model) => model.chronologySettings?.userRegionName ?? '' },
                { key: 'chronologyUserOffsetHours', label: '用户时差（小时）', type: 'number', inline: true,
                    placeholder: '0', defaultValue: 0,
                    bind: 'chronologySettings.userOffsetHours',
                    transformWrite: (model) => model.chronologySettings?.userOffsetHours ?? 0,
                    transformRead: (raw) => Number(raw) || 0 },
                { key: 'chronologyAiRegionName', label: 'AI 所在地', type: 'text', inline: true,
                    placeholder: '如：西陆 / 南港 …', defaultValue: '',
                    bind: 'chronologySettings.aiRegionName',
                    transformWrite: (model) => model.chronologySettings?.aiRegionName ?? '' },
                { key: 'chronologyAiOffsetHours', label: 'AI 时差（小时）', type: 'number', inline: true,
                    placeholder: '0', defaultValue: 0,
                    bind: 'chronologySettings.aiOffsetHours',
                    transformWrite: (model) => model.chronologySettings?.aiOffsetHours ?? 0,
                    transformRead: (raw) => Number(raw) || 0 },
            ],
        },
    ],
};
