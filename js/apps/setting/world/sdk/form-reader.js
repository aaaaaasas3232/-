/**
 * 世界观模块 · 表单 schema 读取器
 *
 * readForm(schema, ctx, model?) 返回从 DOM 读出来的对象。
 * - schema: 表单 schema
 * - ctx: 渲染时的 ctx（同 renderer）；主要是为了 dynamic namespace 解析
 * - model（可选）: 当前 model，给 transformRead 喂（用于条件依赖，比如 isCenter ? 0 : distance）
 *
 * 字段值处理：
 *   text / textarea → .value.trim() 或 raw（textarea 不 trim，因为是多行）
 *   number → Number(value || defaultValue)
 *   color → .value
 *   date → .value
 *   checkbox → .checked
 *   select → .value
 *   radio → 取 [name=...]:checked 的 value
 *   checkboxGroup → Array.from(querySelectorAll).filter(:checked).map(value)
 *
 * 再应用：
 *   split → 把 string 切数组
 *   parse === 'number' → Number()
 *   transformRead(raw, model) → value
 *   defaultOnRead → 空时塞默认
 *
 * 写回方式（输出对象的 key）：
 *   - 有 bind：setByPath(result, bind, value)
 *   - 无 bind：result[field.key] = value
 */

import {
    splitText,
    resolveAttrKey,
    setByPath,
} from './form-schema.js';

// ============================================
// 主入口
// ============================================

export function readForm(schema, ctx = {}, model) {
    const result = {};
    const fields = collectFields(schema);
    for (const field of fields) {
        const raw = readRawField(field, schema, ctx);
        let value = postProcess(field, raw, model);

        // chronology-hours 需要特殊写入逻辑（bind 为数组时写入多个路径）
        if (field.type === 'chronology-hours') {
            setChronologyHoursResult(field, value, result);
        } else if (field.bind) {
            setByPath(result, field.bind, value);
        } else if (field.key) {
            result[field.key] = value;
        }
    }
    return result;
}

// ============================================
// 收集所有扁平字段（sections / fields / group 递归）
// ============================================

const collectFields = (schema) => {
    const out = [];
    const groups = schema.sections
        ? schema.sections.map(s => s.fields || [])
        : [schema.fields || []];
    for (const list of groups) {
        walk(list, out);
    }
    return out;
};

const walk = (fields, out) => {
    for (const f of fields || []) {
        if (f.type === 'group') {
            walk(f.fields, out);
        } else {
            out.push(f);
        }
    }
};

// ============================================
// 读 DOM 原始值
// ============================================

const readRawField = (field, schema, ctx) => {
    switch (field.type) {
        case 'text':
        case 'textarea':
        case 'landmark-icon':
            return readTextLike(field, schema, ctx);
        case 'number':
            return readNumber(field, schema, ctx);
        case 'color':
        case 'date':
            return readValueByAttr(field, schema, ctx);
        case 'checkbox':
            return readCheckbox(field, schema, ctx);
        case 'select':
            return readSelect(field, schema, ctx);
        case 'radio':
            return readRadio(field, schema, ctx);
        case 'checkboxGroup':
            return readCheckboxGroup(field, schema, ctx);
        case 'chronology-hours':
            return readChronologyHours(field, schema, ctx);
        case 'chronology-date':
            return readChronologyDate(field, schema, ctx);
        case 'chronology-weekdays':
            return readChronologyWeekdays(field, schema, ctx);
        // v0.24: 场所访问备注 per-persona 配置
        case 'location-access':
            return readLocationAccess(field, schema, ctx);
        default:
            return undefined;
    }
};

const attrSelector = (field, schema, ctx) =>
    `[data-${schema.fieldNamespace}-field="${cssEscape(resolveAttrKey(field, schema, ctx))}"]`;

const cssEscape = (s) => String(s).replace(/(["\\])/g, '\\$1');

const readTextLike = (field, schema, ctx) => {
    const el = document.querySelector(attrSelector(field, schema, ctx));
    if (!el) return '';
    // textarea 不 trim，多行输入会被切行后再 trim
    if (field.type === 'textarea') return el.value || '';
    return (el.value || '').trim();
};

const readNumber = (field, schema, ctx) => {
    const el = document.querySelector(attrSelector(field, schema, ctx));
    if (!el) return field.defaultValue != null ? field.defaultValue : null;
    const raw = el.value;
    if (raw === '' || raw == null) {
        return field.defaultValue != null ? field.defaultValue : null;
    }
    const n = Number(raw);
    return Number.isNaN(n) ? (field.defaultValue != null ? field.defaultValue : null) : n;
};

const readValueByAttr = (field, schema, ctx) => {
    const el = document.querySelector(attrSelector(field, schema, ctx));
    return el ? (el.value || '') : '';
};

const readCheckbox = (field, schema, ctx) => {
    const el = document.querySelector(attrSelector(field, schema, ctx));
    if (!el) return false;
    // 优先读 .checked（标准 <input type="checkbox">）。
    // 回退到 value === 'true'（renderCheckboxRow 渲染的是 hidden input，
    // 它的值由 toggle-tabs 切换时通过 input/change 事件同步写入）。
    if (el.type === 'checkbox') return !!el.checked;
    return el.value === 'true' || el.value === true;
};

const readSelect = (field, schema, ctx) => {
    const el = document.querySelector(attrSelector(field, schema, ctx));
    return el ? el.value : '';
};

const readRadio = (field, schema, ctx) => {
    const sel = `${attrSelector(field, schema, ctx)}:checked`;
    const el = document.querySelector(sel);
    return el ? el.value : '';
};

const readCheckboxGroup = (field, schema, ctx) => {
    const sel = `${attrSelector(field, schema, ctx)}:checked`;
    return Array.from(document.querySelectorAll(sel)).map(el => el.value);
};

/**
 * 读取纪时系统小时维度编辑器
 * renderChronologyHoursBlock 把 { hourLabel, customHours } JSON.stringify 到
 * 单个 hidden input（attr key = field.key）。
 */
const readChronologyHours = (field, schema, ctx) => {
    const attrKey = resolveAttrKey(field, schema, ctx);
    const cssKey = cssEscape(attrKey);

    // 主 hidden input：存的是 JSON.stringify({ hourLabel, customHours })
    const hiddenInput = document.querySelector(`[data-${schema.fieldNamespace}-field="${cssKey}"]`);
    let hourLabel = '时';
    let customHours = [];
    if (hiddenInput && hiddenInput.value) {
        try {
            const data = JSON.parse(hiddenInput.value);
            if (data && typeof data === 'object') {
                if (typeof data.hourLabel === 'string' && data.hourLabel) hourLabel = data.hourLabel;
                if (Array.isArray(data.customHours)) customHours = data.customHours;
            }
        } catch (e) {
            // 老格式 / 损坏：忽略，回退到空
        }
    }

    // 用户改 visible period 后，events.js 会把名字同步回 hidden，
    // 但若 visible 的 period 数和 customHours 不同（自定义切换数量），直接以 visible 为准
    const periods = document.querySelectorAll('.wv-hours-period__name');
    if (periods.length > 0) {
        customHours = Array.from(periods).map(el => el.value.trim()).filter(s => s.length > 0);
    }

    return { hourLabel, customHours };
};

/**
 * 根据 bind 类型写值到 result
 * bind 为数组时：[path1, path2]，value 应为 { hourLabel, customHours }
 */
const setChronologyHoursResult = (field, value, result) => {
    if (!field.bind) return;
    if (Array.isArray(field.bind) && field.bind.length >= 2) {
        setByPath(result, field.bind[0], value.hourLabel);
        setByPath(result, field.bind[1], value.customHours);
    } else if (typeof field.bind === 'string') {
        setByPath(result, field.bind, value.hourLabel);
    }
};

/**
 * 读取纪时日期编辑器（v0.16：3 段格式 "year/month/day"）
 * 大中小周期名称从当前激活的 world.chronologySettings 取（不能从表单读，因为表单只允许用户改 unit）
 */
const readChronologyDate = (field, schema, ctx) => {
    const attrKey = resolveAttrKey(field, schema, ctx);
    const cssKey = cssEscape(attrKey);

    // 优先查找 hidden input（值由 events.js 同步更新）
    const hiddenEl = document.querySelector(`[data-${schema.fieldNamespace}-field="${cssKey}"]:not([type="number"])`);
    const hiddenValue = hiddenEl ? hiddenEl.value : '';
    if (hiddenValue && hiddenValue.trim()) {
        return hiddenValue.trim();
    }

    // 回退：直接从 3 个输入框读取（v0.17：year / month / day，无 week / baseCycle）
    const yearEl = document.querySelector(`[data-${schema.fieldNamespace}-field="${cssKey}_years"]`);
    const monthEl = document.querySelector(`[data-${schema.fieldNamespace}-field="${cssKey}_months"]`);
    const dayEl = document.querySelector(`[data-${schema.fieldNamespace}-field="${cssKey}_days"]`);

    const year = yearEl ? yearEl.value.trim() : '';
    const month = monthEl ? monthEl.value.trim() : '';
    const day = dayEl ? dayEl.value.trim() : '';

    // 如果全为空，返回空字符串（自定义时间）
    if (!year && !month && !day) return '';

    // v0.17：3 段 "year/month/day"
    return `${year}/${month}/${day}`;
};

/**
 * 读取周名称编辑器（7天格子）
 */
const readChronologyWeekdays = (field, schema, ctx) => {
    // 优先从隐藏 input 读取（events.js 已同步）
    const hiddenEl = document.querySelector(`[data-wv-weekdays-field]`);
    if (hiddenEl && hiddenEl.value) {
        try {
            return JSON.parse(hiddenEl.value);
        } catch (e) {
            // ignore
        }
    }

    // 回退：从格子输入框读取
    const inputs = document.querySelectorAll('.wv-weekday-input');
    if (inputs.length > 0) {
        return Array.from(inputs).map(el => el.value.trim() || el.placeholder);
    }

    return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
};

/**
 * v0.24: 读取场所访问备注编辑器（per-persona 配置）
 * 从 DOM 中收集每个人设的勾选状态、频率和备注
 */
const readLocationAccess = (field, schema, ctx) => {
    const attrKey = resolveAttrKey(field, schema, ctx);
    const cssKey = cssEscape(attrKey);

    // 从隐藏 input 读取初始数据
    const hiddenInput = document.querySelector(`[data-${schema.fieldNamespace}-field="${cssKey}"]`);
    let baseData = { visitors: {} };

    if (hiddenInput && hiddenInput.value) {
        try {
            const parsed = JSON.parse(hiddenInput.value);
            if (parsed && typeof parsed === 'object' && parsed.visitors !== undefined) {
                baseData = parsed;
            }
        } catch (e) {
            // 解析失败，使用空对象
        }
    }

    // 获取 SDK 和世界信息
    const sdk = window.settingsSdk;
    const route = ctx?.route || {};
    const worldId = route?.currentWorldId || sdk?.worlds?.getActive()?.id;

    // 收集所有的人设
    const personas = [];
    if (sdk) {
        const users = sdk.users?.list?.() || [];
        for (const u of users) {
            personas.push({ id: u.id, type: 'user' });
        }
        const aiPersons = sdk.aiPersons?.list?.() || [];
        for (const ai of aiPersons) {
            personas.push({ id: ai.id, type: 'ai' });
        }
    }

    // 从 DOM 读取每个人设的配置
    const visitors = {};
    for (const persona of personas) {
        const pid = persona.id;

        // 读取勾选状态
        const toggleEl = document.querySelector(`[data-location-access-toggle="${cssEscape(pid)}"]`);
        const isEnabled = toggleEl ? toggleEl.checked : false;

        // 读取频率
        const frequencyEl = document.querySelector(`[data-location-access-frequency="${cssEscape(pid)}"]`);
        const frequency = frequencyEl ? (frequencyEl.value || 'sometimes') : 'sometimes';

        // 读取备注
        const noteEl = document.querySelector(`[data-location-access-note="${cssEscape(pid)}"]`);
        const note = noteEl ? (noteEl.value || '') : '';

        // 只有启用的人设才保存配置
        if (isEnabled) {
            visitors[pid] = {
                enabled: true,
                frequency: frequency,
                note: note,
            };
        }
    }

    return { visitors };
};

// ============================================
// 后处理：split / parse / transformRead / defaultOnRead
// ============================================

const postProcess = (field, raw, model) => {
    let value = raw;

    // chronology-hours 字段：跳过 transformRead，直接使用 readChronologyHours 返回的原始对象
    // 因为 setChronologyHoursResult 需要 { hourLabel, customHours } 对象
    if (field.type === 'chronology-hours') {
        return value; // raw 就是 { hourLabel, customHours }
    }

    // location-access 字段：直接使用 readLocationAccess 返回的对象
    if (field.type === 'location-access') {
        return value; // raw 就是 { visitors: {...} }
    }

    // transformRead 优先
    if (typeof field.transformRead === 'function') {
        value = field.transformRead(raw, model);
    } else if (field.parse === 'number') {
        value = raw === '' || raw == null ? null : Number(raw);
    } else if (field.split) {
        value = splitText(typeof raw === 'string' ? raw : '', field.split);
    }

    // 渲染时的 defaultValue 也作为 reader 的 fallback（仅当 raw 为空）。
    // 但若 defaultValue 本身是空字符串，说明这个字段允许空值（如周期名可清空），
    // 此时不要用 defaultValue 兜底——让用户能显式清空。
    const isEmpty = value == null
        || value === ''
        || (Array.isArray(value) && value.length === 0);
    if (isEmpty && field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
        value = field.defaultValue;
    }

    // 显式 defaultOnRead 优先级最低（在 defaultValue 之后，覆盖其行为）
    if (field.defaultOnRead !== null && field.defaultOnRead !== undefined && isEmpty) {
        value = field.defaultOnRead;
    }

    return value;
};