/**
 * 预设库 · 卡片
 *
 * 每个函数吃一个 options 对象、吐一段 HTML 字符串，没有副作用、不碰 DOM。
 * 这样三种 renderMode 都能用：template 直接拼进 v-html，
 * hybrid 拼在字符串里，vue 模式用 `v-html="LP.cards.stat(...)"`。
 *
 * ── 为什么每个卡片都开放 padding / radius / accent ─────────────────
 * 「App 制作」问卷要让用户逐项调间距和主色。如果预设写死样式，
 * 问卷就只能生成一句「请把卡片做成 XX 风格」的自然语言描述，
 * 落到最终代码里全看 AI 心情。开放成参数之后，问卷的答案可以
 * **直接变成调用参数**，所见即所得。
 *
 * 所有文本参数都过 esc()。传 `html` 结尾的参数（bodyHtml / trailingHtml）
 * 视为调用方自己保证安全的富内容，不再 escape —— 命名上做区分是为了
 * review 时一眼能看出哪些是危险入口。
 */

import { esc, cssVars, cx, act, spacing, radius, elevation, len } from './tokens.js';

/** 卡片外壳：所有卡片共用的容器，也可以单独用来包自定义内容 */
export function surface(inner = '', opts = {}) {
    const style = cssVars({
        '--lp-pad': spacing(opts.padding),
        '--lp-radius': radius(opts.radius),
        '--lp-bg': opts.bg,
        '--lp-border': opts.border,
        '--lp-shadow': elevation(opts.elevation, opts.flat ? 'none' : 'sm'),
        '--lp-accent': opts.accent,
    });
    const action = act(opts.action, opts.appId);
    const tag = action ? 'button' : 'div';
    const typeAttr = action ? ' type="button"' : '';
    return `<${tag} class="${cx('lp-card', opts.interactive || action ? 'lp-card--tap' : '', opts.className)}"${typeAttr}${style}${action}>${inner}</${tag}>`;
}

/** 区块标题：左标题右动作，列表页每一段的开头 */
export function sectionHeader(opts = {}) {
    const { title = '', subtitle = '', actionLabel = '', action = null, appId = '' } = opts;
    const right = actionLabel
        ? `<button type="button" class="lp-section__action"${act(action, appId)}>${esc(actionLabel)}</button>`
        : '';
    return `<div class="lp-section"${cssVars({ '--lp-pad': spacing(opts.padding, 0) })}>
        <div class="lp-section__text">
            <div class="lp-section__title">${esc(title)}</div>
            ${subtitle ? `<div class="lp-section__subtitle">${esc(subtitle)}</div>` : ''}
        </div>
        ${right}
    </div>`;
}

/** 数据卡：一个大数字 + 单位 + 说明，用于统计首屏 */
export function stat(opts = {}) {
    const { label = '', value = '', unit = '', hint = '', trend = '' } = opts;
    const trendClass = trend === 'up' ? 'is-up' : trend === 'down' ? 'is-down' : '';
    const trendMark = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
    return surface(`
        <div class="lp-stat">
            <div class="lp-stat__label">${esc(label)}</div>
            <div class="lp-stat__value">
                <span class="lp-stat__num">${esc(value)}</span>
                ${unit ? `<span class="lp-stat__unit">${esc(unit)}</span>` : ''}
                ${trendMark ? `<span class="lp-stat__trend ${trendClass}">${trendMark}</span>` : ''}
            </div>
            ${hint ? `<div class="lp-stat__hint">${esc(hint)}</div>` : ''}
        </div>
    `, opts);
}

/** 信息卡：图标 + 标题 + 副标题 + 正文，最通用的一张 */
export function info(opts = {}) {
    const { title = '', subtitle = '', body = '', icon = '', iconBg = '', badge = '' } = opts;
    const iconHtml = icon
        ? `<div class="lp-info__icon"${cssVars({ '--lp-icon-bg': iconBg })}>${icon}</div>`
        : '';
    return surface(`
        <div class="lp-info">
            ${iconHtml}
            <div class="lp-info__main">
                <div class="lp-info__head">
                    <div class="lp-info__title">${esc(title)}</div>
                    ${badge ? `<span class="lp-badge">${esc(badge)}</span>` : ''}
                </div>
                ${subtitle ? `<div class="lp-info__subtitle">${esc(subtitle)}</div>` : ''}
                ${body ? `<div class="lp-info__body">${esc(body)}</div>` : ''}
                ${opts.bodyHtml || ''}
            </div>
        </div>
    `, opts);
}

/** 列表行：左图标 + 标题副标题 + 右侧值 / 箭头。设置页、清单页的主力 */
export function row(opts = {}) {
    const { title = '', subtitle = '', leading = '', trailing = '', chevron = true } = opts;
    const leadHtml = leading
        ? `<div class="lp-row__lead"${cssVars({ '--lp-icon-bg': opts.leadingBg })}>${leading}</div>`
        : '';
    const trailHtml = trailing ? `<span class="lp-row__value">${esc(trailing)}</span>` : '';
    return surface(`
        <div class="lp-row">
            ${leadHtml}
            <div class="lp-row__main">
                <div class="lp-row__title">${esc(title)}</div>
                ${subtitle ? `<div class="lp-row__subtitle">${esc(subtitle)}</div>` : ''}
            </div>
            ${opts.trailingHtml || trailHtml}
            ${chevron ? '<span class="lp-row__chevron" aria-hidden="true">›</span>' : ''}
        </div>
    `, { ...opts, padding: opts.padding ?? 'snug' });
}

/** 媒体卡：顶部一张图 + 下方文字，瀑布流/卡片流的主力 */
export function media(opts = {}) {
    const { image = '', title = '', subtitle = '', badge = '', ratio = '4 / 3' } = opts;
    const cover = image
        ? `<img class="lp-media__img" src="${esc(image)}" alt="${esc(title)}" loading="lazy" />`
        : '<div class="lp-media__placeholder" aria-hidden="true"></div>';
    return surface(`
        <div class="lp-media">
            <div class="lp-media__cover"${cssVars({ '--lp-ratio': ratio })}>
                ${cover}
                ${badge ? `<span class="lp-media__badge">${esc(badge)}</span>` : ''}
            </div>
            <div class="lp-media__text">
                <div class="lp-media__title">${esc(title)}</div>
                ${subtitle ? `<div class="lp-media__subtitle">${esc(subtitle)}</div>` : ''}
            </div>
        </div>
    `, { ...opts, padding: opts.padding ?? 0 });
}

/** 进度卡：标题 + 进度条 + 完成度文案 */
export function progress(opts = {}) {
    const { title = '', value = 0, max = 100, hint = '' } = opts;
    const safeMax = Number(max) || 100;
    const pct = Math.max(0, Math.min(100, (Number(value) / safeMax) * 100));
    return surface(`
        <div class="lp-progress">
            <div class="lp-progress__head">
                <span class="lp-progress__title">${esc(title)}</span>
                <span class="lp-progress__pct">${Math.round(pct)}%</span>
            </div>
            <div class="lp-progress__track"><div class="lp-progress__fill" style="width:${pct.toFixed(2)}%"></div></div>
            ${hint ? `<div class="lp-progress__hint">${esc(hint)}</div>` : ''}
        </div>
    `, opts);
}

/** 横幅：一句主张 + 一个按钮，用于引导 / 空首屏 */
export function banner(opts = {}) {
    const { title = '', desc = '', ctaLabel = '', action = null, appId = '' } = opts;
    return surface(`
        <div class="lp-banner">
            <div class="lp-banner__text">
                <div class="lp-banner__title">${esc(title)}</div>
                ${desc ? `<div class="lp-banner__desc">${esc(desc)}</div>` : ''}
            </div>
            ${ctaLabel ? `<button type="button" class="lp-btn lp-btn--primary"${act(action, appId)}>${esc(ctaLabel)}</button>` : ''}
        </div>
    `, { ...opts, accent: opts.accent });
}

/** 空状态：没有数据时占住页面，并给一个出口 */
export function empty(opts = {}) {
    const { icon = '', title = '还没有内容', desc = '', ctaLabel = '', action = null, appId = '' } = opts;
    return `<div class="lp-empty"${cssVars({ '--lp-pad': spacing(opts.padding, 'loose') })}>
        ${icon ? `<div class="lp-empty__icon">${icon}</div>` : ''}
        <div class="lp-empty__title">${esc(title)}</div>
        ${desc ? `<div class="lp-empty__desc">${esc(desc)}</div>` : ''}
        ${ctaLabel ? `<button type="button" class="lp-btn lp-btn--primary"${act(action, appId)}>${esc(ctaLabel)}</button>` : ''}
    </div>`;
}

/** 标签行：一排 pill，可点可只读 */
export function tags(items = [], opts = {}) {
    const list = (Array.isArray(items) ? items : []).map((item) => {
        const t = typeof item === 'string' ? { label: item } : (item || {});
        const action = act(t.action, opts.appId);
        const tag = action ? 'button' : 'span';
        const typeAttr = action ? ' type="button"' : '';
        return `<${tag} class="${cx('lp-tag', t.active ? 'is-active' : '')}"${typeAttr}${action}>${esc(t.label)}</${tag}>`;
    }).join('');
    return `<div class="lp-tags"${cssVars({ '--lp-gap': spacing(opts.gap, 'tight') })}>${list}</div>`;
}

/** 时间轴行：左侧竖线 + 节点，用于日志 / 历史 */
export function timeline(items = [], opts = {}) {
    const rows = (Array.isArray(items) ? items : []).map((item, i, arr) => `
        <li class="lp-timeline__item${i === arr.length - 1 ? ' is-last' : ''}">
            <span class="lp-timeline__dot" aria-hidden="true"></span>
            <div class="lp-timeline__body">
                <div class="lp-timeline__title">${esc(item?.title)}</div>
                ${item?.time ? `<div class="lp-timeline__time">${esc(item.time)}</div>` : ''}
                ${item?.desc ? `<div class="lp-timeline__desc">${esc(item.desc)}</div>` : ''}
            </div>
        </li>
    `).join('');
    return surface(`<ul class="lp-timeline">${rows}</ul>`, opts);
}

/** 键值表：两列对齐的摘要，用于「确认信息」这类页面 */
export function keyValue(pairs = [], opts = {}) {
    const rows = (Array.isArray(pairs) ? pairs : []).map((p) => `
        <div class="lp-kv__row">
            <span class="lp-kv__key">${esc(p?.key ?? p?.label)}</span>
            <span class="lp-kv__val">${esc(p?.value)}</span>
        </div>
    `).join('');
    return surface(`<div class="lp-kv">${rows}</div>`, opts);
}

/** 头像卡：头像 + 名字 + 一句话，社交类 App 的常客 */
export function profile(opts = {}) {
    const { name = '', desc = '', avatar = '', avatarBg = '', actionLabel = '', action = null, appId = '' } = opts;
    const avatarHtml = /^(https?:|data:|blob:)/.test(avatar)
        ? `<img class="lp-profile__img" src="${esc(avatar)}" alt="${esc(name)}" />`
        : (avatar || esc(String(name).slice(0, 1)));
    return surface(`
        <div class="lp-profile">
            <div class="lp-profile__avatar"${cssVars({ '--lp-icon-bg': avatarBg })}>${avatarHtml}</div>
            <div class="lp-profile__main">
                <div class="lp-profile__name">${esc(name)}</div>
                ${desc ? `<div class="lp-profile__desc">${esc(desc)}</div>` : ''}
            </div>
            ${actionLabel ? `<button type="button" class="lp-btn lp-btn--ghost"${act(action, appId)}>${esc(actionLabel)}</button>` : ''}
        </div>
    `, opts);
}

/** 条形图卡：纯 CSS 柱状图，不引图表库 */
export function bars(opts = {}) {
    const { title = '', items = [] } = opts;
    const max = Math.max(1, ...items.map((i) => Number(i?.value) || 0));
    const cols = items.map((item) => {
        const h = Math.max(2, ((Number(item?.value) || 0) / max) * 100);
        return `<div class="lp-bars__col">
            <div class="lp-bars__bar" style="height:${h.toFixed(1)}%" title="${esc(item?.value)}"></div>
            <div class="lp-bars__label">${esc(item?.label)}</div>
        </div>`;
    }).join('');
    return surface(`
        <div class="lp-bars">
            ${title ? `<div class="lp-bars__title">${esc(title)}</div>` : ''}
            <div class="lp-bars__plot"${cssVars({ '--lp-plot-h': len(opts.height, '96px') })}>${cols}</div>
        </div>
    `, opts);
}

/** 按钮：三种变体，给「按钮放哪儿」那道题直接用 */
export function button(opts = {}) {
    const { label = '', variant = 'primary', action = null, appId = '', icon = '', block = false, disabled = false } = opts;
    return `<button type="button" class="${cx('lp-btn', `lp-btn--${variant}`, block ? 'is-block' : '')}"${disabled ? ' disabled' : ''}${act(action, appId)}>
        ${icon ? `<span class="lp-btn__icon">${icon}</span>` : ''}${esc(label)}
    </button>`;
}

/** 浮动主按钮（FAB）：右下角那颗。位置可选四角。 */
export function fab(opts = {}) {
    const { icon = '+', label = '', position = 'bottom-right', action = null, appId = '' } = opts;
    return `<button type="button" class="${cx('lp-fab', `lp-fab--${position}`, label ? 'is-extended' : '')}"${act(action, appId)} aria-label="${esc(label || '新建')}">
        <span class="lp-fab__icon">${icon}</span>${label ? `<span class="lp-fab__label">${esc(label)}</span>` : ''}
    </button>`;
}

/** 搜索框：顶栏之外，页面内也常放一个 */
export function searchBar(opts = {}) {
    const { placeholder = '搜索', value = '', field = 'keyword' } = opts;
    return `<div class="lp-search"${cssVars({ '--lp-radius': radius(opts.radius, 'pill') })}>
        <span class="lp-search__icon" aria-hidden="true">⌕</span>
        <input class="lp-search__input" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" data-field="${esc(field)}" />
    </div>`;
}

/** 分段控件：页面内的横向切换 */
export function segmented(opts = {}) {
    const { items = [], value = '', appId = '', action = null } = opts;
    const cells = items.map((item) => {
        const it = typeof item === 'string' ? { value: item, label: item } : (item || {});
        const on = String(it.value) === String(value);
        const a = action ? act({ ...action, payload: { ...(action.payload || {}), value: it.value } }, appId) : '';
        return `<button type="button" class="${cx('lp-seg__item', on ? 'is-active' : '')}"${a} data-value="${esc(it.value)}">${esc(it.label)}</button>`;
    }).join('');
    return `<div class="lp-seg" role="tablist">${cells}</div>`;
}

export const cards = {
    surface, sectionHeader, stat, info, row, media, progress, banner,
    empty, tags, timeline, keyValue, profile, bars, button, fab, searchBar, segmented,
};

/**
 * 给问卷 / 文档用的元数据：每个卡片叫什么、适合什么场景、有哪些可调项。
 * UI 里的「卡片选择器」直接遍历这份清单，不用再维护第二份。
 */
export const CARD_CATALOG = [
    { id: 'stat', name: '数据卡', desc: '一个大数字 + 单位 + 说明', use: '统计首屏、今日概览', knobs: ['padding', 'radius', 'accent'] },
    { id: 'info', name: '信息卡', desc: '图标 + 标题 + 副标题 + 正文', use: '最通用的一张，什么都能塞', knobs: ['padding', 'radius', 'icon', 'badge'] },
    { id: 'row', name: '列表行', desc: '左图标 + 文字 + 右值 + 箭头', use: '设置页、清单页', knobs: ['padding', 'chevron', 'leading'] },
    { id: 'media', name: '媒体卡', desc: '顶部封面图 + 下方文字', use: '瀑布流、卡片流、图集', knobs: ['ratio', 'badge', 'radius'] },
    { id: 'progress', name: '进度卡', desc: '标题 + 进度条 + 百分比', use: '目标、任务、习惯打卡', knobs: ['padding', 'accent'] },
    { id: 'banner', name: '横幅', desc: '一句主张 + 一个按钮', use: '引导、空首屏、促销位', knobs: ['accent', 'ctaLabel'] },
    { id: 'empty', name: '空状态', desc: '插画 + 说明 + 出口按钮', use: '列表为空时', knobs: ['icon', 'ctaLabel'] },
    { id: 'tags', name: '标签行', desc: '一排可点 pill', use: '分类筛选、标签选择', knobs: ['gap'] },
    { id: 'timeline', name: '时间轴', desc: '竖线 + 节点', use: '日志、历史、流程', knobs: ['padding'] },
    { id: 'keyValue', name: '键值表', desc: '两列对齐的摘要', use: '确认页、详情页', knobs: ['padding'] },
    { id: 'profile', name: '头像卡', desc: '头像 + 名字 + 一句话', use: '社交、联系人、成员列表', knobs: ['avatarBg', 'actionLabel'] },
    { id: 'bars', name: '柱状图卡', desc: '纯 CSS 柱状图', use: '周/月数据对比', knobs: ['height', 'padding'] },
];

export default cards;
