/**
 * 设置 App · UI 组件库（iOS Settings 风格）
 *
 * 这些组件的输出都是字符串（要被 v-html 吃），所以渲染时已经 escapeHtml。
 * 所有颜色 / 圆角 / 间距都引用 tokens.js；CSS 类名都带 `settings-` 前缀以免污染。
 *
 * 约定：
 *   - 每个 renderer 都接 (options, appId?) → string
 *   - options 里的 value 字段如果是用户数据，renderer 不负责 escape，由 caller 决定
 *     （大部分情况下 options.title / .label / .description 都需要 escape，所以 renderer 自己 escape）
 *   - 类名用 BEM-ish：settings-{block}__{elem}--{modifier}
 */

import { escapeHtml, SETTINGS_APP_ID, dispatchMethodAction } from './ui-helpers.js';
import { T } from './tokens.js';

const APP_ID = SETTINGS_APP_ID;

// ============================================
// Section 区块容器（iOS Settings 风格的「分组卡片」）
// ============================================

/**
 * 一个分组卡片
 * @param {object} opts
 * @param {string} [opts.title]           组标题（UPPERCASE FOOTNOTE 风格，iOS 标准）
 * @param {string} [opts.footer]          组底部 footnote（iOS 标准）。纯文本会自动 escape。
 * @param {string} [opts.footerHtml]      组底部 HTML（不会 escape）。与 footer 互斥；优先使用此项。
 * @param {string} opts.content           内容
 * @param {string} [opts.className]       容器额外类名
 * @param {string} [opts.dataUi]          data-ui 属性
 * @param {string} [opts.id]              id
 */
export function renderGroup({ title = '', footer = '', footerHtml = '', content = '', className = '', dataUi = 'settings-group', id = '' } = {}) {
    const header = title ? `<div class="settings-group__header">${escapeHtml(title)}</div>` : '';
    let footerInner = '';
    if (footerHtml) {
        footerInner = footerHtml;
    } else if (footer) {
        footerInner = escapeHtml(footer);
    }
    const footerHtmlOut = footerInner ? `<div class="settings-group__footer">${footerInner}</div>` : '';
    return `
        <div class="settings-group__wrap ${className}" data-ui="${escapeHtml(dataUi)}" ${id ? `id="${escapeHtml(id)}"` : ''}>
            ${header}
            <div class="settings-group" role="list">
                ${content}
            </div>
            ${footerHtmlOut}
        </div>
    `;
}

// ============================================
// Row · 单条列表行（chevron / 开关 / 输入框 / 自定义 trailing）
// ============================================

/**
 * 一个 iOS 风格的 row
 * @param {object} opts
 * @param {string} opts.label              主标题
 * @param {string} [opts.description]      副标题（iOS 副标题在主标题下面，灰色）
 * @param {string} [opts.icon]             左侧图标（可以是 emoji 或 svg 字符串；调用者负责 escape）
 * @param {string} [opts.iconBg]           左侧图标圆角色块背景（已软编码到 tokens）
 * @param {string} [opts.iconFg]           左侧图标前景色（默认白）
 * @param {object} [opts.action]           整行可点击的 action
 * @param {string} [opts.trailing]         自定义 trailing HTML（开关 / 文字 / chevron）
 * @param {string} [opts.trailingText]     trailing 文本（与 trailing 二选一）
 * @param {boolean} [opts.showChevron]     是否显示 chevron（默认按是否有 action 判断）
 * @param {boolean} [opts.disabled]        是否禁用
 * @param {boolean} [opts.danger]          是否危险样式（红色）
 * @param {string} [opts.fieldPath]        data-settings-field（用于 input / textarea 字段行）
 * @param {boolean} [opts.compact]         是否紧凑模式（用于独立卡片内的入口）
 */
export function renderRow({
    label = '',
    description = '',
    icon = '',
    iconBg = '',
    iconFg = '',
    action = null,
    trailing = '',
    trailingText = '',
    showChevron,
    disabled = false,
    danger = false,
    fieldPath = '',
    compact = false,
} = {}) {
    const hasAction = action != null;
    const chevron = (showChevron ?? hasAction) ? `<span class="settings-row__chevron" aria-hidden="true">›</span>` : '';
    const trailingHtml = trailing || (trailingText ? `<span class="settings-row__trailing-text">${escapeHtml(trailingText)}</span>` : '');
    const iconHtml = icon
        ? `<span class="settings-row__icon${compact ? ' settings-row__icon--compact' : ''}" style="background:${escapeHtml(iconBg || T.color.gray4)};color:${escapeHtml(iconFg || '#fff')}">${icon}</span>`
        : '';
    const descHtml = description
        ? `<div class="settings-row__desc">${escapeHtml(description)}</div>`
        : '';
    const className = [
        'settings-row',
        hasAction ? 'settings-row--action' : '',
        disabled ? 'settings-row--disabled' : '',
        danger ? 'settings-row--danger' : '',
        compact ? 'settings-row--compact' : '',
    ].filter(Boolean).join(' ');
    const actionAttr = hasAction
        ? ` data-app-action='${escapeHtml(JSON.stringify({ ...action, appId: action.appId || APP_ID }))}'`
        : '';
    const fieldAttr = fieldPath ? ` data-settings-field="${escapeHtml(fieldPath)}"` : '';
    const Tag = hasAction ? 'button' : 'div';

    return `
        <${Tag} class="${className}"${actionAttr}${fieldAttr} role="listitem">
            ${iconHtml}
            <div class="settings-row__body">
                <div class="settings-row__label">${escapeHtml(label)}</div>
                ${descHtml}
            </div>
            ${trailingHtml}
            ${chevron}
        </${Tag}>
    `;
}

/** row + 分隔线：放在 settings-group 里。 */
export function renderRowWithDivider(rowHtml) {
    return `${rowHtml}<div class="settings-row__divider" role="separator"></div>`;
}

// ============================================
// Switch · iOS 开关
// ============================================

export function renderSwitch({ on = false, action = null } = {}) {
    const actionAttr = action
        ? ` data-app-action='${escapeHtml(JSON.stringify({ ...action, appId: action.appId || APP_ID }))}'`
        : '';
    return `
        <button class="settings-switch ${on ? 'is-on' : ''}"${actionAttr}
            role="switch" aria-checked="${on ? 'true' : 'false'}">
            <span class="settings-switch__knob"></span>
        </button>
    `;
}

// ============================================
// ChipGroup · 圆角色块选择（电池色 / 壳色 / 圆角预设）
// ============================================

/**
 * @param {object} opts
 * @param {Array<{label:string,value:string|number,swatch?:string}>} opts.presets
 * @param {string|number} opts.currentValue
 * @param {(preset)=>object} opts.toAction  生成 {action, method, payload}
 * @param {boolean} [opts.showSwatch]     是否显示色块（默认 false）
 * @param {(preset, currentValue)=>boolean} [opts.isActive]  自定义判断"是否选中"的回调；
 *           默认按 String(currentValue) === String(preset.value) 判断。
 * @param {string} [opts.mod]             容器修饰类（如 'square'），用于切换样式变体。
 *           'square' —— 小方块正方形（用于行数/列数等数字按钮选择器）。
 */
export function renderChipGroup({ presets = [], currentValue, toAction, showSwatch = false, isActive, mod }) {
    const checkActive = typeof isActive === 'function'
        ? isActive
        : preset => String(currentValue) === String(preset.value);
    const chips = presets.map(preset => {
        const isActiveNow = checkActive(preset, currentValue);
        const action = toAction(preset);
        const swatch = showSwatch
            ? `<span class="settings-chip__swatch" style="background:${escapeHtml(preset.swatch || preset.value)}"></span>`
            : '';
        return `
            <button class="settings-chip ${isActiveNow ? 'is-active' : ''}" data-app-action='${escapeHtml(JSON.stringify({ ...action, appId: APP_ID }))}'>
                ${swatch}<span>${escapeHtml(preset.label)}</span>
            </button>
        `;
    }).join('');
    const modClass = mod ? ` settings-chip-row--${mod}` : '';
    return `<div class="settings-chip-row${modClass}">${chips}</div>`;
}

// ============================================
// Slider · iOS 滑块（容量 / temperature）
// ============================================

export function renderSlider({
    min = 0,
    max = 100,
    step = 1,
    value = 0,
    field = '',
    method = 'updateAppearanceField',
    formatter = null,
} = {}) {
    const fieldLit = JSON.stringify(field);
    const methodLit = JSON.stringify(method);
    const appIdLit = JSON.stringify(APP_ID);
    const numValue = Number(value);
    const safeValue = Number.isFinite(numValue) ? numValue : 0;
    // 注意：不要用 escapeHtml 处理代码字符串，否则括号会被转义导致代码无法执行
    // 只对 HTML 属性中的双引号用 &quot; 转义
    // 重要：原生 <input type="range"> 在拖动过程中会持续派发 input 事件。
    // 若每次都 dispatch settings:slider-change → updateAppearanceField → applyDeviceTheme + refreshPhoneApps()，
    // 会让整个 App 重新 mount，导致滑块被销毁重建 → 拖动过程中滑块"瞬移回起点"。
    // 因此 input 事件只更新本地数值标签（轻量），change 事件（用户松手）才真正派发 slider-change。
    const onInput = `this.dataset.dragging='1'`;
    const onChange = `delete this.dataset.dragging;window.dispatchEvent(new CustomEvent('settings:slider-change', { detail: { field: ${fieldLit}, value: Number(this.value), appId: ${appIdLit}, method: ${methodLit} } }))`;
    const escapedOnInput = onInput.replace(/"/g, '&quot;');
    const escapedOnChange = onChange.replace(/"/g, '&quot;');
    return `
        <div class="settings-slider">
            <input
                type="range"
                class="settings-range"
                min="${escapeHtml(String(min))}"
                max="${escapeHtml(String(max))}"
                step="${escapeHtml(String(step))}"
                value="${escapeHtml(String(safeValue))}"
                oninput="${escapedOnInput}"
                onchange="${escapedOnChange}"
            />
        </div>
    `;
}

// ============================================
// ColorPicker · 颜色选择（自定义，纯色）
// ============================================

export function renderColorPicker({
    label = '自定义',
    value = '#000000',
    field = '',
    method = 'updateAppearanceField',
} = {}) {
    const safe = (typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) ? value : '#000000';
    const fieldLit = JSON.stringify(field);
    const methodLit = JSON.stringify(method);
    const appIdLit = JSON.stringify(APP_ID);
    // 注意：不要用 escapeHtml 处理代码字符串，否则括号会被转义导致代码无法执行
    // 只对 HTML 属性中的双引号用 &quot; 转义
    // 重要：原生 <input type="color"> 在拖动调色板过程中会持续派发 input 事件，
    // 若每次都 dispatch settings:slider-change → updateAppearanceField → applyDeviceTheme + refreshPhoneApps()，
    // 会 (1) 让色板失焦/关闭，(2) 整个 App 重新 mount，体验极差。
    // 因此 input 事件只更新本地预览（轻量），change 事件才真正派发 slider-change。
    // 本组件的 input 本身已经会渲染色块（::-webkit-color-swatch），不需要单独 swatch。
    const onInput = `if(this.style){this.dataset.dragging='1'}`;
    const onChange = `delete this.dataset.dragging;window.dispatchEvent(new CustomEvent('settings:slider-change', { detail: { field: ${fieldLit}, value: this.value, appId: ${appIdLit}, method: ${methodLit} } }))`;
    const escapedOnInput = onInput.replace(/"/g, '&quot;');
    const escapedOnChange = onChange.replace(/"/g, '&quot;');
    return `
        <div class="settings-colorpicker">
            <span class="settings-colorpicker__label">${escapeHtml(label)}</span>
            <input class="settings-colorpicker__input" type="color"
                value="${escapeHtml(safe)}"
                oninput="${escapedOnInput}"
                onchange="${escapedOnChange}"
            />
        </div>
    `;
}

// ============================================
// GradientInput · 支持 hex/rgb/linear-gradient 的自定义颜色输入
// ============================================

/**
 * 支持任意 CSS 颜色值（hex / rgb / linear-gradient / radial-gradient / conic-gradient）
 * 的文本输入框 + 实时预览色块。
 *
 * 与 renderColorPicker 的区别：本组件不强制用 <input type="color">，可以接受渐变字符串，
 * 适合"手机壳"这种天然就用渐变绘制的字段。
 *
 * @param {object} opts
 * @param {string} [opts.label]        行内左侧 label
 * @param {string} opts.value          当前值
 * @param {string} opts.field          state.ui.appearance 下的字段名
 * @param {string} [opts.method]       调用的方法名（默认 updateAppearanceField）
 * @param {string} [opts.placeholder]  输入框 placeholder
 * @param {string} [opts.fallback]     无效值时显示的兜底字符串（仅用于预览）
 * @param {string} [opts.hint]         行内右侧提示文本（如「支持渐变」）
 */
export function renderGradientInput({
    label = '自定义',
    value = '',
    field = '',
    method = 'updateAppearanceField',
    placeholder = '#hex 或 linear-gradient(...)',
    fallback = '#f6d3e0',
    hint = '',
} = {}) {
    const safe = (typeof value === 'string') ? value : '';
    const previewValue = safe || fallback;
    const fieldLit = JSON.stringify(field);
    const methodLit = JSON.stringify(method);
    // 把 value 写到 detail.value；框架层会调 method({field, value})
    // 注意：不要用 escapeHtml 处理代码字符串，否则括号会被转义导致代码无法执行
    // 只对 HTML 属性中的双引号用 &quot; 转义
    const onInput = `window.dispatchEvent(new CustomEvent('settings:slider-change', { detail: { field: ${fieldLit}, value: this.value, appId: ${JSON.stringify(APP_ID)}, method: ${methodLit} } }))`;
    const escapedOnInput = onInput.replace(/"/g, '&quot;');
    const hintHtml = hint ? `<span class="settings-gradient__hint">${escapeHtml(hint)}</span>` : '';
    return `
        <div class="settings-gradient">
            <span class="settings-gradient__label">${escapeHtml(label)}</span>
            <div class="settings-gradient__field">
                <span class="settings-gradient__swatch" style="background:${escapeHtml(previewValue)}" aria-hidden="true"></span>
                <input class="settings-gradient__input" type="text"
                    value="${escapeHtml(safe)}"
                    placeholder="${escapeHtml(placeholder)}"
                    spellcheck="false"
                    autocomplete="off"
                    autocapitalize="off"
                    oninput="${escapedOnInput}"
                />
                ${hintHtml}
            </div>
        </div>
    `;
}

// ============================================
// Field · 文本输入 / 文本域
// ============================================

/**
 * @param {object} opts
 * @param {'input'|'textarea'} opts.kind
 * @param {string} opts.label       标签
 * @param {string} opts.value      当前值
 * @param {string} [opts.placeholder]
 * @param {string} [opts.fieldPath] data-settings-field
 * @param {number} [opts.rows]
 */
export function renderField({
    kind = 'input',
    label = '',
    value = '',
    placeholder = '',
    fieldPath = '',
    rows = 3,
    helper = '',
}) {
    const labelHtml = label ? `<label class="settings-field__label">${escapeHtml(label)}</label>` : '';
    const helperHtml = helper ? `<div class="settings-field__helper">${escapeHtml(helper)}</div>` : '';
    let inputHtml;
    if (kind === 'textarea') {
        inputHtml = `<textarea class="settings-field__textarea" rows="${escapeHtml(String(rows))}" data-settings-field="${escapeHtml(fieldPath)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`;
    } else {
        inputHtml = `<input class="settings-field__input" type="text" data-settings-field="${escapeHtml(fieldPath)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />`;
    }
    return `<div class="settings-field">${labelHtml}${inputHtml}${helperHtml}</div>`;
}

// ============================================
// SaveBar · 底部固定保存栏（保存 / 重置）
// ============================================

export function renderSaveBar({
    saveMethod = '',
    resetMethod = '',
    saveLabel = '保存',
    resetLabel = '恢复默认',
    savedAt = 0,
} = {}) {
    const savedHint = savedAt
        ? `<div class="settings-savebar__saved">已保存 ${escapeHtml(formatSavedAt(savedAt))}</div>`
        : `<div class="settings-savebar__saved settings-savebar__saved--none">尚未保存</div>`;
    return `
        <div class="settings-savebar">
            <button class="settings-btn settings-btn--ghost" data-app-action='${escapeHtml(JSON.stringify({ action: 'appMethod', appId: APP_ID, method: resetMethod }))}'>${escapeHtml(resetLabel)}</button>
            <button class="settings-btn settings-btn--primary" data-app-action='${escapeHtml(JSON.stringify({ action: 'appMethod', appId: APP_ID, method: saveMethod }))}'>${escapeHtml(saveLabel)}</button>
            ${savedHint}
        </div>
    `;
}

// ============================================
// ProfileCard · 主页面顶部「Apple ID」卡片
// ============================================

export function renderProfileCard({
    initial = '听',
    avatar = '',
    background = '',
    backgroundBlur = 0,
    name = '',
    subtitle = '',
    hint = '',
    action = null,
} = {}) {
    const actionAttr = action
        ? ` data-app-action='${escapeHtml(JSON.stringify({ ...action, appId: action.appId || APP_ID }))}'`
        : '';
    const avatarHtml = avatar
        ? `<img class="persona-avatar-image" src="${escapeHtml(avatar)}" alt="" />`
        : escapeHtml(initial);
    const safeBlur = Math.max(0, Math.min(24, Number(backgroundBlur) || 0));
    const backgroundHtml = background
        ? `<span class="settings-profile__background" style="background-image:url('${escapeHtml(background)}');filter:blur(${safeBlur}px);transform:scale(${1 + safeBlur / 100})"></span>`
        : '';
    return `
        <button class="settings-profile ${background ? 'has-background' : ''}"${actionAttr} role="button">
            ${backgroundHtml}
            <span class="settings-profile__veil"></span>
            <div class="settings-profile__avatar">${avatarHtml}</div>
            <div class="settings-profile__name">${escapeHtml(name || '未命名')}</div>
            <div class="settings-profile__sub">${escapeHtml(subtitle || '')}</div>
            <div class="settings-profile__hint">${escapeHtml(hint || 'Apple ID、iCloud、媒体与购买项目')}</div>
        </button>
    `;
}

// ============================================
// ListEntry · 主页 5 个入口行（icon + 标题 + 副标题 + chevron）
// ============================================

export function renderListEntry({
    label = '',
    description = '',
    icon = '',
    iconBg = T.color.gray,
    iconFg = '#fff',
    action = null,
} = {}) {
    return renderRow({
        label,
        description,
        icon,
        iconBg,
        iconFg,
        action,
        showChevron: true,
    });
}

// ============================================
// FooterNote · 页脚说明
// ============================================

export function renderFooterNote(text = '小听启动 v0.1 · 数据保存在本机 IndexedDB') {
    return `<div class="settings-footer">${escapeHtml(text)}</div>`;
}

// ============================================
// WarningHint · 黄底警示
// ============================================

export function renderWarningHint(text = '') {
    return `<div class="settings-warning">${escapeHtml(text)}</div>`;
}

// ============================================
// Slider / ColorPicker 事件 → 派发方法
// ============================================

/**
 * 把 settings:slider-change（slider / colorpicker 发的统一事件）转给对应 method。
 * 在 main.js 里 bind 到 window。
 */
export function bindSliderChangeListener() {
    window.addEventListener('settings:slider-change', event => {
        const detail = event.detail || {};
        if (!detail.appId || !detail.field) return;
        dispatchMethodAction(detail.method || 'updateAppearanceField', {
            field: detail.field,
            value: detail.value,
        });
    });
}

// ============================================
// input/textarea → 派发方法
// ============================================

/**
 * 监听整个 document 的 input 事件，把带 data-settings-field 的输入值派发出去。
 * 见 main.js 的 setupHints。
 */
export function bindInputFieldListener() {
    document.addEventListener('input', event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const fieldPath = target.getAttribute('data-settings-field');
        if (!fieldPath) return;
        const shell = target.closest('.app-shell');
        if (!shell) return;

        const dot = fieldPath.indexOf('.');
        if (dot <= 0 || dot === fieldPath.length - 1) return;
        const scope = fieldPath.slice(0, dot);
        const field = fieldPath.slice(dot + 1);
        const cap = scope[0].toUpperCase() + scope.slice(1);

        let method;
        if (field === 'preferences' || field === 'keyPoints' || field === 'rules') {
            method = `update${cap}Text`;
        } else {
            method = `update${cap}Field`;
        }
        dispatchMethodAction(method, { field, value: target.value });
    });
}

// ============================================
// helpers
// ============================================

function formatSavedAt(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}