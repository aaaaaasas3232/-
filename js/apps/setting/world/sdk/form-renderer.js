/**
 * 世界观模块 · 表单 schema 渲染器
 *
 * renderEditForm(schema, model, ctx) 返回 HTML 字符串。
 * ctx 必须含 { e, wvAction, checkedAttr, ...ctx }；其他（phases / saveAction / cancelAction）按需传。
 */

import { escapeHtml } from '@/src/core/escape.js';
import {
    CONSTANT_LOOKUP,
    getByPath,
    resolveAttrKey,
} from './form-schema.js';
import { ACCESS_FREQUENCIES } from './geo/geo-constants.js';

const defaultCheckedAttr = (v) => (v ? 'checked' : '');

/**
 * 解析字段的 option 列表：可能是 options / optionsFromConstants / optionsFromContext。
 */
const resolveOptions = (field, ctx) => {
    if (typeof field.options === 'function') return field.options(ctx?.model, ctx) || [];
    if (Array.isArray(field.options)) return field.options;
    if (field.optionsFromConstants) {
        const arr = CONSTANT_LOOKUP[field.optionsFromConstants];
        if (!arr) return [];
        // 对象（PHASE_TYPES / TRANSITION_ACTIONS 等枚举对象）
        if (!Array.isArray(arr) && typeof arr === 'object') {
            return Object.values(arr).map(v => ({ value: v, label: v }));
        }
        // 数组里的每个元素可能是 string（PHASE_TYPES / TRANSITION_ACTIONS）也可能是 object
        if (typeof arr[0] === 'string') {
            return arr.map(v => ({ value: v, label: v }));
        }
        // 对象数组：用 optionValueKey / optionLabelKey 取
        const valueKey = field.optionValueKey || 'id';
        const labelKey = field.optionLabelKey || 'label';
        return arr.map(item => ({
            value: item[valueKey],
            label: field.optionLabelFn
                ? field.optionLabelFn(item)
                : (item[labelKey] ?? String(item[valueKey])),
        }));
    }
    if (field.optionsFromContext && ctx) {
        const arr = ctx[field.optionsFromContext];
        if (!Array.isArray(arr)) return [];
        const valueKey = field.optionValueKey || 'id';
        const labelKey = field.optionLabelKey || 'name';
        return arr.map(item => ({
            value: item[valueKey],
            label: field.optionLabelFn
                ? field.optionLabelFn(item)
                : (item[labelKey] ?? String(item[valueKey])),
        }));
    }
    return [];
};

/**
 * 解析字段的 items 列表（checkboxGroup 用）。
 */
const resolveItems = (field, ctx) => {
    if (Array.isArray(field.items)) return field.items;
    if (field.itemsFromContext && ctx) {
        const arr = ctx[field.itemsFromContext];
        if (!Array.isArray(arr)) return [];
        const valueKey = field.optionValueKey || 'id';
        const labelKey = field.optionLabelKey || 'name';
        return arr.map(item => ({
            value: item[valueKey],
            label: item[labelKey] ?? String(item[valueKey]),
        }));
    }
    return [];
};

/**
 * 从 model 里取值：考虑 bind 嵌套路径 / transformWrite。
 */
const readModelValue = (field, model, ctx) => {
    if (typeof field.transformWrite === 'function') {
        return field.transformWrite(model || {}, ctx);
    }
    if (field.bind) return getByPath(model || {}, field.bind);
    const v = model ? model[field.key] : undefined;
    return v == null ? field.defaultValue : v;
};

/**
 * 把数组拼回 string（如果 schema 有 split + 当前值是数组）。
 * 注：split 是 read 端的指令，write 端需要 transformWrite 显式 join；
 * 这里我们只在用户没写 transformWrite 且 value 是数组 + 有 split 时，尝试智能 join。
 */
const coerceWriteValue = (field, raw) => {
    if (raw == null) return '';
    if (Array.isArray(raw)) {
        if (typeof field.transformWrite === 'function') return raw; // 已经处理过
        if (field.split === 'comma') return raw.join(', ');
        if (field.split === 'line') return raw.join('\n');
        return raw.join(',');
    }
    return raw;
};

// ============================================
// 主入口
// ============================================

export function renderEditForm(schema, model, ctx) {
    const e = ctx.e || escapeHtml;
    const wrapperClass = schema.wrapperClass ? `wv-editor ${schema.wrapperClass}` : 'wv-editor';
    const groups = schema.sections
        ? schema.sections.map(s => renderSection(s, model, schema, ctx))
        : [renderFieldList(schema.fields, model, schema, ctx)];
    const actions = schema.actionsBuilder
        ? schema.actionsBuilder(ctx, model)
        : ((schema.hideActions || ctx.hideActions) ? '' : `<div class="wv-editor__actions">
                ${ctx.saveAction ? `<button class="wv-btn wv-btn--primary" ${ctx.saveAction}>${e(ctx.saveLabel || '保存')}</button>` : ''}
                ${ctx.cancelAction ? `<button class="wv-btn wv-btn--ghost" ${ctx.cancelAction}>${e(ctx.cancelLabel || '取消')}</button>` : ''}
            </div>`);
    return `
        <div class="${wrapperClass}">
            ${groups.join('\n')}
            ${ctx.extraBeforeActions || ''}
            ${actions}
        </div>
    `;
}

const renderSection = (section, model, schema, ctx) => {
    const e = ctx.e || escapeHtml;
    return `
        <div class="wv-editor__section">
            <div class="wv-editor__section-title">${e(section.title)}</div>
            ${renderFieldList(section.fields, model, schema, ctx)}
        </div>
    `;
};

const renderFieldList = (fields, model, schema, ctx) => {
    if (!fields) return '';
    return fields.map(f => renderField(f, model, schema, ctx)).join('\n');
};

// ============================================
// 字段分发
// ============================================

const renderField = (field, model, schema, ctx) => {
    const e = ctx.e || escapeHtml;
    const checkedAttr = ctx.checkedAttr || defaultCheckedAttr;
    switch (field.type) {
        case 'group':           return renderGroup(field, model, schema, ctx);
        case 'text':            return renderRow(field, model, schema, ctx, renderTextInput(field, model, schema, ctx, e));
        case 'textarea':        return renderRow(field, model, schema, ctx, renderTextarea(field, model, schema, ctx, e));
        case 'number':          return renderRow(field, model, schema, ctx, renderNumberInput(field, model, schema, ctx, e));
        case 'color':           return renderRow(field, model, schema, ctx, renderColorInput(field, model, schema, ctx, e));
        case 'date':            return renderRow(field, model, schema, ctx, renderDateInput(field, model, schema, ctx, e));
        case 'checkbox':        return renderCheckboxRow(field, model, schema, ctx, e, checkedAttr);
        case 'select':          return renderRow(field, model, schema, ctx, renderSelect(field, model, schema, ctx, e));
        case 'radio':           return renderRadioRow(field, model, schema, ctx, e, checkedAttr);
        case 'checkboxGroup':   return renderCheckboxGroupRow(field, model, schema, ctx, e, checkedAttr);
        case 'chronology-hours': return renderChronologyHoursBlock(field, model, schema, ctx, e);
        case 'chronology-date': return renderChronologyDateBlock(field, model, schema, ctx, e);
        case 'chronology-weekdays': return renderChronologyWeekdaysBlock(field, model, schema, ctx, e);
        // v0.24: 场所访问备注 per-persona 配置
        case 'location-access': return renderLocationAccessBlock(field, model, schema, ctx, e);
        default:
            console.warn('[form-renderer] 未知 type:', field.type, field);
            return '';
    }
};

// ============================================
// group（复合行）
// ============================================

const renderGroup = (field, model, schema, ctx) => {
    const e = ctx.e || escapeHtml;
    const children = (field.fields || []).map(child => renderGroupChild(child, model, schema, ctx)).join('\n');
    const rowClass = field.inline ? 'wv-editor__row wv-editor__row--inline' : 'wv-editor__row';
    return `
        <div class="${rowClass}">
            ${field.label ? `<label class="wv-editor__label">${e(field.label)}</label>` : ''}
            ${children}
        </div>
    `;
};

const renderGroupChild = (field, model, schema, ctx) => {
    const e = ctx.e || escapeHtml;
    const checkedAttr = ctx.checkedAttr || defaultCheckedAttr;
    let html = '';
    let inputHtml = '';
    switch (field.type) {
        case 'checkbox': {
            const value = readModelValue(field, model, ctx);
            inputHtml = `<input class="wv-editor__input wv-editor__input--check" type="checkbox"
                data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
                ${checkedAttr(!!value)}>`;
            break;
        }
        case 'text': {
            const value = coerceWriteValue(field, readModelValue(field, model, ctx));
            inputHtml = `<input class="wv-editor__input ${e(field.className || '')}" type="text"
                data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
                placeholder="${e(field.placeholder || '')}" value="${e(value)}">`;
            break;
        }
        case 'number': {
            const value = coerceWriteValue(field, readModelValue(field, model, ctx));
            const numClass = field.className || 'wv-editor__input--num';
            inputHtml = `<input class="wv-editor__input ${e(numClass)}" type="number"
                data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
                placeholder="${e(field.placeholder || '')}" value="${e(value)}">`;
            break;
        }
        case 'date': {
            const value = coerceWriteValue(field, readModelValue(field, model, ctx));
            inputHtml = `<input class="wv-editor__input" type="date"
                data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
                value="${e(value)}">`;
            break;
        }
        case 'select': {
            inputHtml = renderSelect(field, model, schema, ctx, e);
            break;
        }
        default:
            inputHtml = '';
    }
    html += inputHtml;
    if (field.sep) html += `<span class="wv-editor__sep">${e(field.sep)}</span>`;
    return html;
};

// ============================================
// 各种输入控件
// ============================================

const renderTextInput = (field, model, schema, ctx, e) => {
    const value = coerceWriteValue(field, readModelValue(field, model, ctx));
    return `<input class="wv-editor__input ${e(field.className || '')}" type="text"
        data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
        placeholder="${e(field.placeholder || '')}" value="${e(value)}">`;
};

const renderTextarea = (field, model, schema, ctx, e) => {
    const value = coerceWriteValue(field, readModelValue(field, model, ctx));
    return `<textarea class="wv-editor__textarea" data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
        rows="${field.rows || 2}" placeholder="${e(field.placeholder || '')}">${e(value)}</textarea>`;
};

const renderNumberInput = (field, model, schema, ctx, e) => {
    const value = coerceWriteValue(field, readModelValue(field, model, ctx));
    const numClass = field.className || 'wv-editor__input--num';
    return `<input class="wv-editor__input ${e(numClass)}" type="number"
        data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
        placeholder="${e(field.placeholder || '')}" value="${e(value)}">`;
};

const renderColorInput = (field, model, schema, ctx, e) => {
    const value = coerceWriteValue(field, readModelValue(field, model, ctx));
    if (field.inlineLayout) {
        return `<div class="wv-color-row">
            <span class="wv-color-row__label">${e(field.label || '颜色')}</span>
            <input class="wv-editor__color wv-editor__color--row" type="color"
                data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
                value="${e(value)}">
        </div>`;
    }
    return `<input class="wv-editor__input wv-editor__color" type="color"
        data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
        value="${e(value)}">`;
};

const renderDateInput = (field, model, schema, ctx, e) => {
    const value = coerceWriteValue(field, readModelValue(field, model, ctx));
    return `<input class="wv-editor__input" type="date"
        data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
        value="${e(value)}">`;
};

const renderSelect = (field, model, schema, ctx, e) => {
    const value = coerceWriteValue(field, readModelValue(field, model, ctx));
    const opts = resolveOptions(field, ctx);
    const allowEmpty = field.allowEmpty;
    const emptyOpt = allowEmpty
        ? `<option value="">${e(field.emptyLabel || '')}</option>`
        : '';
    const optHtml = opts.map(o => `<option value="${e(o.value)}" ${String(value) === String(o.value) ? 'selected' : ''}>${e(o.label)}</option>`).join('');
    return `<select class="wv-editor__select" data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}">
        ${emptyOpt}${optHtml}
    </select>`;
};

const renderCheckboxRow = (field, model, schema, ctx, e, checkedAttr) => {
    const value = readModelValue(field, model, ctx);
    const isChecked = !!value;
    const rowClass = field.inlineLabel ? 'wv-editor__row wv-editor__row--checkbox' : 'wv-editor__row wv-editor__row--inline';
    return `<div class="${rowClass}">
        <label class="wv-editor__label ${field.inlineLabel ? 'wv-editor__label--checkbox' : 'wv-editor__label--inline'}">${e(field.label || '')}</label>
        <div class="wv-editor__toggle-tabs" data-field="${e(resolveAttrKey(field, schema, ctx))}">
            <button class="wv-editor__toggle-tab ${!isChecked ? 'is-active' : ''}" data-value="false">否</button>
            <button class="wv-editor__toggle-tab ${isChecked ? 'is-active' : ''}" data-value="true">是</button>
        </div>
        <input type="hidden"
            data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
            value="${isChecked}">
    </div>`;
};

const renderRadioRow = (field, model, schema, ctx, e, checkedAttr) => {
    const value = coerceWriteValue(field, readModelValue(field, model, ctx));
    const items = field.items || [];
    const name = field.radioName || `wv-radio-${e(field.key)}`;
    return `<div class="wv-editor__row">
        <label class="wv-editor__label">${e(field.label || '')}</label>
        <div class="wv-editor__checkgroup">
            ${items.map(it => `<label><input type="radio" name="${name}"
                data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
                value="${e(it.value)}" ${String(value) === String(it.value) ? 'checked' : ''}> ${e(it.label)}</label>`).join('')}
        </div>
    </div>`;
};

const renderCheckboxGroupRow = (field, model, schema, ctx, e, checkedAttr) => {
    const value = readModelValue(field, model, ctx);
    const arr = Array.isArray(value) ? value : [];
    const items = resolveItems(field, ctx);
    const groupClass = field.wrap ? 'wv-editor__checkgroup wv-editor__checkgroup--wrap' : 'wv-editor__checkgroup';
    return `<div class="wv-editor__row">
        <label class="wv-editor__label">${e(field.label || '')}</label>
        <div class="${groupClass}">
            ${items.length === 0 ? '<span class="wv-list__empty-text">尚未建阶段</span>' :
                items.map(it => `<label><input type="checkbox"
                    data-${schema.fieldNamespace}-field="${e(resolveAttrKey(field, schema, ctx))}"
                    value="${e(it.value)}" ${arr.includes(it.value) ? 'checked' : ''}> ${e(it.label)}</label>`).join('')}
        </div>
    </div>`;
};

// ============================================
// row 包裹器（label + input）
// ============================================

const renderRow = (field, model, schema, ctx, controlHtml) => {
    const e = ctx.e || escapeHtml;
    const isInline = field.inline;
    const classes = ['wv-editor__row'];
    if (isInline) classes.push('wv-editor__row--inline');
    if (field.topSpacing) classes.push('wv-editor__row--top-spaced');
    if (field.noLabel) classes.push('wv-editor__row--no-label');
    const labelHtml = field.noLabel ? '' : `<label class="wv-editor__label">${e(field.label || '')}</label>`;
    return `<div class="${classes.join(' ')}">
        ${labelHtml}
        ${controlHtml}
    </div>`;
};

// ============================================
// 纪时系统 · 小时维度编辑器
// ============================================

const PRESET_24_HOURS = Object.freeze(
    Array.from({ length: 24 }, (_, i) => `${i}时`)
);

const PRESET_12_HOURS = Object.freeze([
    '子时', '丑时', '寅时', '卯时', '辰时', '巳时',
    '午时', '未时', '申时', '酉时', '戌时', '亥时'
]);

/**
 * 渲染小时维度编辑器
 * 支持：
 * 1. 预设选择（24时制 / 12时辰制 / 自定义）
 * 2. 自定义时间段数量和名称
 */
const renderChronologyHoursBlock = (field, model, schema, ctx, e) => {
    // 读取当前值
    const chronoData = typeof field.transformWrite === 'function'
        ? field.transformWrite(model || {})
        : { hourLabel: '时', customHours: [] };

    const hourLabel = chronoData.hourLabel || '时';
    const customHours = Array.isArray(chronoData.customHours) ? chronoData.customHours : [];

    // 计算当前时段数量和比例
    // 空 customHours = 默认 24h（1 时 = 1.0 小时）
    const periodCount = customHours.length || 24;
    const periodHours = (24 / periodCount).toFixed(1);

    // 如果是默认状态（空 customHours），回退使用 24h 预设名字
    const effectiveHours = customHours.length > 0
        ? customHours
        : PRESET_24_HOURS.slice();

    // 计算当前模式
    let currentMode = 'custom';
    if (customHours.length === 0) {
        currentMode = '24h'; // 默认
    } else if (customHours.length === 12 && customHours.join(',') === PRESET_12_HOURS.join(',')) {
        currentMode = '12h';
    } else if (customHours.length === 24 && customHours.join(',') === PRESET_24_HOURS.join(',')) {
        currentMode = '24h';
    }

    // 生成时段数据
    const periods = [];
    const segmentHours = 24 / periodCount;

    for (let i = 0; i < periodCount; i++) {
        const startHour = Math.floor(i * segmentHours);
        const endHour = Math.floor((i + 1) * segmentHours);
        periods.push({
            name: effectiveHours[i] || `${hourLabel}${i}`,
            startHour,
            endHour,
        });
    }

    // 比例说明
    const ratioHint = `1 ${hourLabel} = ${periodHours} 小时`;

    // 预设按钮 HTML - 精致胶囊样式
    const presetsHtml = `
        <div class="wv-hours-presets">
            <button class="wv-preset-btn ${currentMode === '24h' ? 'is-active' : ''}" data-hours-preset="24h" data-hours-count="24">24时</button>
            <button class="wv-preset-btn ${currentMode === '12h' ? 'is-active' : ''}" data-hours-preset="12h" data-hours-count="12">时辰</button>
            <button class="wv-preset-btn ${currentMode === 'custom' ? 'is-active' : ''}" data-hours-preset="custom" data-hours-count="6">自定义</button>
        </div>
    `;

    // 时段编辑器 HTML - 紧凑网格布局
    const periodsHtml = periods.map((p, idx) => `
        <div class="wv-hours-period" data-period-idx="${idx}">
            <span class="wv-hours-period__range">${p.startHour}-${p.endHour}</span>
            <input class="wv-hours-period__name" type="text"
                data-hours-period="${idx}"
                placeholder="${e(hourLabel)}" value="${e(p.name)}">
        </div>
    `).join('');

    // 构建完整的隐藏数据
    const hoursData = {
        hourLabel,
        customHours: periods.map(p => p.name),
    };

    return `<div class="wv-hours-block-wrapper">
        ${presetsHtml}
        <div class="wv-hours-body">
            <div class="wv-hours-hint">${e(ratioHint)}</div>
            <div class="wv-hours-periods">${periodsHtml}</div>
        </div>
        <input type="hidden" data-${schema.fieldNamespace}-field="${e(field.key)}" value="${e(JSON.stringify(hoursData))}">
    </div>`;
};

// ============================================
// 纪时系统 · 日期编辑器
// ============================================

/**
 * 渲染纪时日期输入组件
 * v0.17：周期层级 = 大周期（年） / 中周期（月） / 小周期（日）。
 *       「基周期」/「周」概念已彻底移除。
 * 显示为「大周期名称 数值 大周期单位 中周期名称 数值 中周期单位 小周期名称 数值 小周期单位」格式
 * 例如：洪武 5 年 新 3 月 初 12 日
 * 存储为字符串 dateStr，统一 3 段格式 "year/month/day"（v0.17 后无任何兼容）
 */
const renderChronologyDateBlock = (field, model, schema, ctx, e) => {
    // 从当前激活的世界观获取纪时配置（事件 model 里没有 chronologySettings 字段）
    const sdk = window.settingsSdk;
    const route = window.__wvRoute || null;
    const worldId = route?.currentWorldId;
    const activeWorld = worldId
        ? sdk?.worlds?.get?.(worldId)
        : (sdk?.worlds?.getActive?.() || null);
    const chrono = activeWorld?.chronologySettings || model?.chronologySettings || {};
    // 大周期（如"洪武"）+ 大周期单位（如"年"）
    const largeCycleName = chrono.largeCycleName || '';
    const yearLabel = chrono.yearLabel || '年';
    // 中周期（如"新"）+ 中周期单位（如"月"）
    const mediumCycleName = chrono.mediumCycleName || '';
    const monthLabel = chrono.monthLabel || '月';
    // 小周期 = 日
    const smallCycleName = chrono.smallCycleName || '日';
    const dayLabel = chrono.dayLabel || '日';

    // 字段可见性（默认全部显示，缺字段的旧世界也兜底为全显示）
    const visibilityRaw = chrono.dateFieldVisibility || {};
    const visibility = {
        year: visibilityRaw.year !== false,
        month: visibilityRaw.month !== false,
        day: visibilityRaw.day !== false,
    };

    // 从 model.date 解析已有值（v0.17：统一 3 段 "year/month/day"）
    const currentDate = model?.date || '';
    const parts = String(currentDate).split('/');
    let yearVal, monthVal, dayVal;
    if (parts.length >= 3) {
        yearVal = parts[0] || '';
        monthVal = parts[1] || '';
        dayVal = parts[2] || '';
    } else {
        yearVal = parts[0] || '';
        monthVal = parts[1] || '';
        dayVal = parts[2] || '';
    }

    // 渲染：大周期名称 [数值] 大周期单位 中周期名称 [数值] 中周期单位 小周期名称 [数值] 小周期单位
    // 例如：洪武 [5] 年 新 [3] 月 初 [12] 日

    const buildDatePart = (cycleName, cycleLabel, inputVal, fieldSuffix, fallbackName, fallbackLabel) => {
        const input = `<input class="wv-editor__input wv-date-input--num" type="number" min="0"
            data-${schema.fieldNamespace}-field="${e(field.key)}_${fieldSuffix}"
            placeholder="0" value="${e(inputVal)}">`;
        // 永远渲染占位：让用户看清楚结构
        const nameHtml = cycleName
            ? `<span class="wv-date-cycle-name">${e(cycleName)}</span>`
            : `<span class="wv-date-cycle-name wv-date-cycle-name--empty">${e(fallbackName || '·')}</span>`;
        const labelHtml = cycleLabel
            ? `<span class="wv-date-cycle-unit">${e(cycleLabel)}</span>`
            : `<span class="wv-date-cycle-unit wv-date-cycle-unit--empty">${e(fallbackLabel || '·')}</span>`;
        return `<span class="wv-date-part">
            ${nameHtml}
            ${input}
            ${labelHtml}
        </span>`;
    };

    // 仅渲染可见字段；隐藏字段不渲染 input、不计入 date 字符串
    const partsOut = [];
    if (visibility.year) partsOut.push(buildDatePart(largeCycleName, yearLabel, yearVal, 'years', '[大周期]', '[年]'));
    if (visibility.month) partsOut.push(buildDatePart(mediumCycleName, monthLabel, monthVal, 'months', '[中周期]', '[月]'));
    if (visibility.day) partsOut.push(buildDatePart(smallCycleName, dayLabel, dayVal, 'days', '[小周期]', '[日]'));

    // 字段可见性切换条：三个开关，决定下方 date-block 显隐哪些字段
    const toggleAction = ctx?.wvAction
        || ((method, payload) => `data-app-action='${escapeHtml(JSON.stringify({action:'appMethod', appId:'settings', method, payload}))}'`);
    const renderToggle = (key, defaultLabel) => {
        const isOn = !!visibility[key];
        const labelText = isOn
            ? `显示：${defaultLabel}`
            : `隐藏：${defaultLabel}`;
        return `<button type="button" class="wv-date-field-toggle ${isOn ? 'is-on' : 'is-off'}"
            ${toggleAction('worldToggleChronologyDateField', { field: key })}
            title="点击切换「${defaultLabel}」字段是否录入">${labelText}</button>`;
    };
    const togglesHtml = `
        <div class="wv-date-field-toggles" data-wv-date-field-toggles>
            ${renderToggle('year', '大周期')}
            ${renderToggle('month', '中周期')}
            ${renderToggle('day', '小周期（日）')}
        </div>
    `;

    const dateHtml = `
        ${partsOut.join('')}
        <button class="wv-btn wv-btn--ghost wv-btn--xs wv-date-clear-btn" type="button"
            data-date-clear="${e(field.key)}" title="清除日期（留空=自定义时间）">×</button>
    `;

    // 隐藏的完整日期字符串（兼容旧数据格式 year/month/day）
    // 隐藏字段在保存时按当前空值写入对应段位；保留已录入字段。
    const fullDateInput = `<input type="hidden" data-${schema.fieldNamespace}-field="${e(field.key)}"
        value="${e(currentDate)}"
        data-wv-date-hidden="1"
        data-wv-date-visibility="${e(JSON.stringify(visibility))}">`;

    return `<div class="wv-editor__row wv-date-row">
        <label class="wv-editor__label">${e(field.label || '日期')}</label>
        <div class="wv-date-block-wrapper">
            ${togglesHtml}
            <div class="wv-date-block" data-wv-date-block>
                ${dateHtml}
                ${fullDateInput}
            </div>
        </div>
    </div>`;
};

// ============================================
// 纪时系统 · 周名称编辑器（7天格子）
// ============================================

/**
 * 渲染周名称编辑器（7个格子）
 * 支持设置周一到周日的自定义名称
 */
const renderChronologyWeekdaysBlock = (field, model, schema, ctx, e) => {
    // 从 model 中读取 weekDayNames
    const weekDayNames = field.transformRead
        ? field.transformRead(model?.chronologySettings?.weekDayNames)
        : (model?.chronologySettings?.weekDayNames || ['周一', '周二', '周三', '周四', '周五', '周六', '周日']);

    const days = Array.isArray(weekDayNames) && weekDayNames.length >= 7
        ? weekDayNames.slice(0, 7)
        : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    const fieldKey = field.key;

    const daysHtml = days.map((name, i) => `
        <div class="wv-weekday-cell" data-weekday-idx="${i}">
            <input class="wv-weekday-input" type="text"
                data-weekday="${i}"
                data-${schema.fieldNamespace}-field="${e(fieldKey)}"
                placeholder="${['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i]}"
                value="${e(name)}"
                maxlength="4">
        </div>
    `).join('');

    return `<div class="wv-editor__row wv-weekdays-row">
        <label class="wv-editor__label">${e(field.label || '周名称（7天）')}</label>
        <div class="wv-weekdays-grid">
            ${daysHtml}
        </div>
        <input type="hidden" data-${schema.fieldNamespace}-field="${e(fieldKey)}"
            data-wv-weekdays-field="${e(fieldKey)}"
            value="${e(JSON.stringify(days))}">
    </div>`;
};

// ============================================
// 场所访问备注编辑器（per-persona 配置）
// v0.24: 替代简单的 textarea，支持为每个人设配置访问频率和备注
// ============================================

/**
 * 渲染场所访问备注编辑器
 * @param {object} field - schema 字段
 * @param {object} model - location 数据
 * @param {object} schema - 表单 schema
 * @param {object} ctx - 渲染上下文
 * @param {function} e - escapeHtml 函数
 */
const renderLocationAccessBlock = (field, model, schema, ctx, e) => {
    // 从 ctx 获取人设列表（users 和 aiPersons）
    const sdk = window.settingsSdk;
    const route = ctx?.route || {};
    const worldId = route.currentWorldId || sdk?.worlds?.getActive()?.id;

    // 读取当前 accessNotes 数据
    const accessNotes = field.transformWrite
        ? field.transformWrite(model || {})
        : (model?.accessNotes || { visitors: {} });

    const visitors = accessNotes.visitors || {};

    // 获取人设列表：只显示绑定到当前世界观的人设
    const personas = [];
    if (sdk) {
        // 用户人设：检查 boundWorldId
        const users = sdk.users?.list?.() || [];
        for (const u of users) {
            if (!worldId || u.boundWorldId === worldId) {
                personas.push({
                    id: u.id,
                    name: u.name || '用户',
                    type: 'user',
                    typeLabel: '用户',
                });
            }
        }
        // AI 人设：检查 boundWorldId
        const aiPersons = sdk.aiPersons?.list?.() || [];
        for (const ai of aiPersons) {
            if (!worldId || ai.boundWorldId === worldId) {
                personas.push({
                    id: ai.id,
                    name: ai.name || 'AI',
                    type: 'ai',
                    typeLabel: 'AI',
                });
            }
        }
    }

    // 如果没有人设，显示提示
    if (personas.length === 0) {
        return `<div class="wv-editor__row">
            <label class="wv-editor__label">${e(field.label || '访问备注')}</label>
            <div class="wv-location-access wv-location-access--empty">
                <span class="wv-location-access__empty-text">还没有人设绑定此世界观</span>
            </div>
        </div>`;
    }

    // 计算已启用数量
    const enabledCount = personas.filter(p => !!visitors[p.id]?.enabled).length;
    const allEnabled = enabledCount === personas.length;
    const noneEnabled = enabledCount === 0;

    // 渲染每个人设的配置项（折叠状态）
    const personaItems = personas.map(persona => {
        const config = visitors[persona.id] || { enabled: false, frequency: 'sometimes', note: '' };
        const isEnabled = !!config.enabled;
        const frequency = config.frequency || 'sometimes';
        const note = config.note || '';

        // 频率选项 HTML
        const frequencyOptions = ACCESS_FREQUENCIES.map(f => {
            return `<option value="${e(f.value)}" ${frequency === f.value ? 'selected' : ''}>${e(f.label)}</option>`;
        }).join('');

        return `
            <div class="wv-location-access__persona ${isEnabled ? 'is-enabled' : ''}" data-persona-id="${e(persona.id)}">
                <div class="wv-location-access__persona-header">
                    <label class="wv-location-access__toggle">
                        <input type="checkbox"
                            class="wv-location-access__checkbox"
                            data-location-access-toggle="${e(persona.id)}"
                            ${isEnabled ? 'checked' : ''}>
                        <span class="wv-location-access__persona-name">${e(persona.name)}</span>
                    </label>
                    <span class="wv-location-access__persona-type ${e(persona.type)}">${e(persona.typeLabel)}</span>
                </div>
                <div class="wv-location-access__persona-body ${isEnabled ? '' : 'is-collapsed'}">
                    <div class="wv-location-access__frequency-row">
                        <span class="wv-location-access__field-label">频率</span>
                        <select class="wv-location-access__frequency"
                            data-location-access-frequency="${e(persona.id)}"
                            ${!isEnabled ? 'disabled' : ''}>
                            ${frequencyOptions}
                        </select>
                    </div>
                    <div class="wv-location-access__note-row">
                        <span class="wv-location-access__field-label">备注</span>
                        <textarea class="wv-location-access__note"
                            rows="1"
                            data-location-access-note="${e(persona.id)}"
                            placeholder="关于此场所..."
                            ${!isEnabled ? 'disabled' : ''}>${e(note)}</textarea>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // 构建完整 HTML（带折叠功能）
    const hiddenData = {
        visitors: visitors,
    };

    return `
        <div class="wv-editor__row">
            <label class="wv-editor__label">${e(field.label || '访问备注')}</label>
            <div class="wv-location-access">
                <div class="wv-location-access__toolbar">
                    <button class="wv-location-access__select-all" data-location-access-select="all">
                        全选
                    </button>
                    <button class="wv-location-access__select-none" data-location-access-select="none">
                        清空
                    </button>
                    <span class="wv-location-access__count">${enabledCount}/${personas.length}</span>
                </div>
                <div class="wv-location-access__list">
                    ${personaItems}
                </div>
                <input type="hidden"
                    data-${schema.fieldNamespace}-field="${e(field.key)}"
                    value="${e(JSON.stringify(hiddenData))}"
                    data-location-access-store="${e(field.key)}">
            </div>
        </div>
    `;
};

// ============================================
// 资产系统编辑器
// ============================================

/**
 * 渲染资产编辑器（货币管理）
 */
const renderAssetsEditorBlock = (field, model, schema, ctx, e) => {
    // 从 model 读取货币列表
    const currencies = model?.currencies || [];
    const baseCurrency = currencies.find(c => c.isBase) || currencies[0];
    const editingId = ctx.route?.editingCurrencyId;
    const isCreating = editingId === '__new__';
    const wvAction = ctx.wvAction || ((method, payload) => `data-app-action='${escapeHtml(JSON.stringify({action:'appMethod', appId:'settings', method, payload}))}'`);

    const emptyHint = (glyph, text) => `
        <div class="wv-empty-hint">
            <span class="wv-empty-hint__glyph">${glyph}</span>
            <span class="wv-empty-hint__text">${e(text)}</span>
        </div>
    `;

    // 渲染单个货币卡片
    const renderCurrencyCard = (curr) => {
        const isEditing = curr.id === editingId;
        if (isEditing) {
            return renderCurrencyEditFormInline(curr, currencies, wvAction, e);
        }
        const exchangeRate = curr.isBase ? '基准' : (curr.exchangeToBase != null ? `1 ${curr.name} = ${curr.exchangeToBase} ${baseCurrency?.name || '基准'}` : '—');
        return `
            <div class="wv-list__item wv-assets__currency-card">
                <div class="wv-assets__currency-info">
                    <span class="wv-assets__currency-symbol">${e(curr.symbol || curr.name?.charAt(0) || '')}</span>
                    <span class="wv-assets__currency-name">${e(curr.name)}</span>
                    ${curr.isBase ? '<span class="wv-tag wv-tag--primary">基准</span>' : ''}
                </div>
                <div class="wv-assets__currency-meta">
                    <span class="wv-assets__currency-rate">${e(exchangeRate)}</span>
                    ${curr.note ? `<span class="wv-assets__currency-note">${e(curr.note)}</span>` : ''}
                </div>
                <div class="wv-assets__currency-actions">
                    ${!curr.isBase ? `<button class="wv-btn wv-btn--ghost wv-btn--xs" ${wvAction('worldSetBaseCurrency', { id: curr.id })}>设基准</button>` : ''}
                    <button class="wv-btn wv-btn--ghost wv-btn--xs" ${wvAction('worldEditCurrency', { id: curr.id })}>编辑</button>
                    ${!curr.isBase ? `<button class="wv-btn wv-btn--danger wv-btn--xs" ${wvAction('worldDeleteCurrency', { id: curr.id })}>删除</button>` : ''}
                </div>
            </div>
        `;
    };

    // 渲染内联编辑表单
    const renderCurrencyEditFormInline = (curr, allCurrencies, wvAction, e) => {
        const isNew = !curr.id;
        const baseOptions = allCurrencies.filter(c => c.isBase && (!curr.id || c.id !== curr.id));
        const selectedBaseId = curr.baseCurrencyId || baseOptions[0]?.id || '';

        return `
            <div class="wv-assets__currency-form">
                <div class="wv-assets__form-row">
                    <input class="wv-editor__input" type="text"
                        data-currency-field="name"
                        placeholder="货币名称 *" value="${e(curr.name || '')}">
                </div>
                <div class="wv-assets__form-row wv-assets__form-row--stacked">
                    <textarea class="wv-editor__textarea" rows="2"
                        data-currency-field="note"
                        placeholder="说明（如：1金币=100铜币）">${e(curr.note || '')}</textarea>
                </div>
                <div class="wv-assets__form-row wv-assets__form-row--inline wv-assets__form-row--exchange">
                    <input class="wv-editor__input wv-editor__input--num" type="number" step="0.01" min="0"
                        data-currency-field="exchangeToBase"
                        placeholder="1" value="${curr.exchangeToBase != null ? e(String(curr.exchangeToBase)) : ''}">
                    <span class="wv-exchange__name" data-exchange-currency-name="${e(curr.name || '')}">${e(curr.name || '货币')}</span>
                    <span class="wv-exchange__equals">=</span>
                    <input class="wv-editor__input wv-editor__input--num" type="number" step="0.01" min="0"
                        data-currency-field="baseAmount"
                        placeholder="1" value="${curr.baseAmount != null ? e(String(curr.baseAmount)) : '1'}">
                    <select class="wv-editor__select" data-currency-field="baseCurrencyId">
                        <option value="">选择基准</option>
                        ${baseOptions.map(b => `<option value="${e(b.id)}" ${b.id === selectedBaseId ? 'selected' : ''}>${e(b.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="wv-assets__form-actions">
                    <button class="wv-btn wv-btn--primary wv-btn--xs" ${wvAction('worldSaveCurrency', { id: curr.id || '__new__' })}>保存</button>
                    <button class="wv-btn wv-btn--ghost wv-btn--xs" ${wvAction('worldCancelCurrencyEdit')}>取消</button>
                </div>
            </div>
        `;
    };

    // 货币列表
    const currencyListHtml = currencies.length === 0
        ? emptyHint('', '还没有货币，点击上方添加')
        : currencies.map(renderCurrencyCard).join('');

    // 新建表单
    const createFormHtml = isCreating
        ? renderCurrencyEditFormInline({ name: '', symbol: '', note: '' }, currencies, wvAction, e)
        : '';

    return `
        <div class="wv-editor__row wv-assets-editor-row">
            <div class="wv-assets-editor">
                <div class="wv-assets-editor__header">
                    <div class="wv-assets-editor__stats">
                        <span class="wv-assets-editor__stat">
                            <span class="wv-assets-editor__stat-num">${currencies.length}</span> 种货币
                        </span>
                        ${baseCurrency ? `<span class="wv-assets-editor__stat">基准：<b>${e(baseCurrency.name)}</b></span>` : ''}
                    </div>
                    ${!isCreating ? `<button class="wv-btn wv-btn--primary wv-btn--xs" ${wvAction('worldCreateCurrency')}>+ 添加货币</button>` : ''}
                </div>
                <div class="wv-assets-editor__list">
                    ${currencyListHtml}
                    ${createFormHtml}
                </div>
            </div>
        </div>
    `;
};