/**
 * 「灵动岛与小组件」总览中心（框架层，全 App 通用）
 *
 * 用户从任意 App 里点一个按钮进来，看到的是**这个 App 在系统里的全部露出**：
 *   - 它会在什么时候弹灵动岛、弹成什么样（真实渲染的预览，不是截图）
 *   - 它提供了哪些桌面小组件，S/M/L 各长什么样
 *   - 每一条都能单独关掉、能改样式
 *
 * App 接入成本 = 一个按钮：
 *   <button data-presence-center="music">灵动岛与小组件</button>
 * 剩下的全在这里。详见 docs/framework-灵动岛与小组件总览.md
 *
 * 实现说明：
 *   - 覆盖层挂在 `.phone-screen` 上，跟 App 页面同层，看起来像原生页面
 *   - 预览用**真实渲染路径**：灵动岛走 `window.islandTemplates[tpl].render()`，
 *     小组件走 `widget.render(size, payload)`。假截图会和真实效果脱节，
 *     用户改了样式也看不出来。
 *   - 全 SVG 图标，不用 emoji
 */

import {
    getAppPresence,
    isIslandKindEnabled,
    setIslandKindEnabled,
    isNotifyKindEnabled,
    setNotifyKindEnabled,
    isWidgetEnabled,
    setWidgetEnabled,
    getStyleOverride,
    setStyleOverride,
    clearStyleOverride,
    applyStyleOverrides,
} from '@/src/core/app-presence.js';
import { escapeHtml } from '@/src/core/escape.js';
import { sanitizeSvg } from '@/src/core/bubble-style.js';
import { getIslandState, sanitizeIslandIcon, isSafeSvgIcon } from '@/src/core/island-icon.js';

const OVERLAY_ID = 'app-presence-center';

const ICONS = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    island: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
    widget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
    notify: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M9 15h6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
};

/** 岛尺寸的中文名 + 预览容器高度（必须跟真机 .dynamic-island.has-template 一致，见 css/music-island.css 顶部）。
 *  之前预览里给的是中型 92px / 大型 220px，比真机小一圈，模板内容（按钮组、歌词区）被 overflow:hidden 裁掉一截；
 *  现在跟 css/music-island.css 对齐 —— medium 240×135 / large 280×320（来自 .dynamic-island.has-template.medium/large）。 */
const SIZE_META = {
    mini: { label: '迷你', w: 180, h: 36 },
    compact: { label: '紧凑', w: 220, h: 56 },
    medium: { label: '中等', w: 240, h: 135 },
    large: { label: '大型', w: 280, h: 320 },
};

/**
 * 小组件预览的画布尺寸 —— 必须跟桌面上 `.widgetMini` 的真实尺寸一致
 * （见 css/core/30-widgets.css 顶部那张表），否则预览是「另一个比例的东西」：
 * 之前 M 给的是 164×76、L 给的是 164×164，而真机上 M 是 132×150、L 是 284×154，
 * 高度差了一倍，M 和 L 的内容在预览里全被裁掉一半。
 */
const WIDGET_SIZE_META = {
    'S-h': { w: 132, h: 56, label: '小号（横）' },
    'S-v': { w: 56, h: 150, label: '小号（竖）' },
    M: { w: 132, h: 150, label: '中号' },
    L: { w: 284, h: 154, label: '大号' },
};

function widgetSizeMeta(size, orientation) {
    if (size === 'S') return WIDGET_SIZE_META[orientation === 'v' ? 'S-v' : 'S-h'];
    return WIDGET_SIZE_META[size] || WIDGET_SIZE_META.M;
}

let _state = null;

// ---------------------------------------------------------------------------
// 预览渲染
// ---------------------------------------------------------------------------

/**
 * fallback 里 dot 该放什么?
 *
 * 优先级:
 *   1. previewPayload.appIcon —— 该 kind 单独声明的图标(必须是 SVG 字符串)
 *   2. presence.appIcon       —— 这个 App 的图标(传给整个总览页)
 *   3. 默认绿色圆点
 *
 * ★ 严格只吃 SVG:从 appConfig.icon 透到这里的多数是 `<svg ...>...</svg>`,
 *   但有些 App 会传 `iconHtml` / `<span class="app-icon">` / 变量名字符串
 *   之类的「半成品」。直接拼接会变成画面里出现 `ctx` 这种裸文本 —— 这是
 *   v0.87 用户报的 bug。所以这里用「必须以 `<svg` 开头」做白名单,
 *   不是 SVG 一律退回默认绿点,而不是悄悄画一坨乱七八糟的 HTML。
 *
 * ★ 返回前过 sanitizeSvg —— previewPayload 来自用户编辑过的数据,
 *   不消毒就 innerHTML 等于开 XSS 口子。sanitize 不通过就当没图标。
 */
function pickIslandIconHtml(kind, presence) {
    const typeIcon = getIslandState(kind?.type || kind?.previewPayload?.type || 'info').icon;
    const cand = kind?.previewPayload?.appIcon || kind?.previewPayload?.icon || presence?.appIcon || '';
    const safe = sanitizeIslandIcon(cand, '');
    if (safe && isSafeSvgIcon(safe)) {
        try {
            return sanitizeSvg(safe) || typeIcon;
        } catch (_) {
            return typeIcon;
        }
    }
    return typeIcon;
}

function renderIslandPreview(kind, size, presence) {
    const meta = SIZE_META[size] || SIZE_META.medium;
    let inner = '';
    try {
        const tpl = kind.template ? window.islandTemplates?.[kind.template] : null;
        if (tpl?.render) {
            inner = tpl.render(size, kind.previewPayload || {}) || '';
        }
    } catch (err) {
        console.warn('[presence-center] 岛模板预览渲染失败', kind.id, err);
    }
    if (!inner) {
        // 没有专属模板的(通知类)→ 画一个跟系统通知同款的胶囊。
        // ★ v0.87 之前这里的 fallback 在所有 size 下都用同一个布局,
        //   配合 chat-app 把 incoming-call / new-message 声明成 ['medium'],
        //   就出现「一条短信通知被画成 240×135 的方块」这种半残效果。
        //   通知类应该走 compact 高度(38px),标题和消息排在一行,
        //   才像真机的灵动岛通知。这里按 size 切换布局。
        const p = kind.previewPayload || {};
        const iconHtml = pickIslandIconHtml(kind, presence);
        const state = getIslandState(kind?.type || p.type || 'info');
        const orbHtml = `<span class="pc-island-generic__orb" style="background:${escapeHtml(state.bg)};color:${escapeHtml(state.color)}" aria-hidden="true">${iconHtml}</span>`;
        inner = `
            <div class="pc-island-generic" data-density="${escapeHtml(size)}">
                ${orbHtml}
                <div class="pc-island-generic__text">
                    <div class="pc-island-generic__title">${escapeHtml(p.title || kind.label)}</div>
                    ${p.message ? `<div class="pc-island-generic__msg">${escapeHtml(p.message)}</div>` : ''}
                </div>
            </div>`;
    }
    return `
        <div class="pc-island-stage">
            <div class="pc-island-shell" data-size="${escapeHtml(size)}"
                 style="width:${meta.w}px;height:${meta.h}px;">
                ${inner}
            </div>
            <div class="pc-island-stage__caption">${escapeHtml(meta.label)} · ${meta.w}×${meta.h}</div>
        </div>`;
}

function renderWidgetPreview(widget, size) {
    let html = '';
    try {
        const render = widget.render || widget.renderDesktop || widget.renderItem;
        if (typeof render === 'function') {
            html = render(size, widget.previewPayload || {}) || '';
        }
    } catch (err) {
        console.warn('[presence-center] 小组件预览渲染失败', widget.qualifiedId, err);
    }
    if (!html) html = `<div class="pc-widget-fallback">${escapeHtml(widget.label || widget.id)}</div>`;
    const meta = widgetSizeMeta(size, widget.orientation);
    // 桌面上小组件外面套的是 .widgetSize-* .widgetMini，App 的模板依赖那些 class
    // 拿尺寸和内边距。预览里把同一套 class 原样加上，画出来才是桌面上的样子。
    const orientClass = size === 'S' ? ` widgetOrient-${widget.orientation === 'v' ? 'v' : 'h'}` : '';
    return `
        <div class="pc-widget-stage" data-size="${escapeHtml(size)}">
            <div class="pc-widget-shell widgetSize-${escapeHtml(size)}${orientClass}"
                 data-size="${escapeHtml(size)}"
                 style="width:${meta.w}px;height:${meta.h}px;">${html}</div>
            <div class="pc-widget-stage__caption">${escapeHtml(meta.label)} · ${meta.w}×${meta.h}</div>
        </div>`;
}

/**
 * 一次性通知的预览：照着 framework 通知岛的真实结构画（.dynamic-island.compact）。
 */
function renderNotifyPreview(kind) {
    const typeClass = `pc-notify-preview--${escapeHtml(kind.type || 'info')}`;
    const state = getIslandState(kind.type);
    const iconHtml = sanitizeIslandIcon(kind.icon, state.icon) || state.icon;
    return `
        <div class="pc-island-stage">
            <div class="pc-island-shell pc-notify-preview ${typeClass}" data-size="compact">
                <span class="pc-notify-preview__orb" style="background:${escapeHtml(state.bg)};color:${escapeHtml(state.color)}" aria-hidden="true">${iconHtml}</span>
                <span class="pc-notify-preview__title">${escapeHtml(kind.title)}</span>
                ${kind.message ? `<span class="pc-notify-preview__msg">${escapeHtml(kind.message)}</span>` : ''}
            </div>
            <div class="pc-island-stage__caption">通知 · ${escapeHtml(kind.type || 'info')}</div>
        </div>`;
}

function renderNotifyCard(appId, kind) {
    const enabled = isNotifyKindEnabled(appId, kind.id);
    return `
        <section class="pc-card${enabled ? '' : ' is-off'}" data-pc-notify="${escapeHtml(kind.id)}">
            <header class="pc-card__head">
                <div class="pc-card__icon">${ICONS.notify}</div>
                <div class="pc-card__meta">
                    <h3 class="pc-card__title">${escapeHtml(kind.label)}</h3>
                    ${kind.desc ? `<p class="pc-card__desc">${escapeHtml(kind.desc)}</p>` : ''}
                </div>
                ${renderToggle(enabled, false,
                    `data-pc-action="toggle-notify" data-pc-target="${escapeHtml(kind.id)}"`)}
            </header>
            <div class="pc-when">
                ${ICONS.clock}
                <div><span class="pc-when__label">出现时机</span><span class="pc-when__text">${escapeHtml(kind.when)}</span></div>
            </div>
            ${renderNotifyPreview(kind)}
            <div class="pc-card__foot">
                <button type="button" class="pc-btn pc-btn--ghost" data-pc-action="try-notify"
                        data-pc-target="${escapeHtml(kind.id)}">
                    ${ICONS.play}<span>试一下</span>
                </button>
            </div>
        </section>`;
}

// ---------------------------------------------------------------------------
// 卡片
// ---------------------------------------------------------------------------

function renderToggle(checked, disabled, attrs) {
    return `
        <button type="button" class="pc-toggle${checked ? ' is-on' : ''}${disabled ? ' is-locked' : ''}"
                ${disabled ? 'aria-disabled="true"' : ''} ${attrs}
                role="switch" aria-checked="${checked}">
            <span class="pc-toggle__track"><span class="pc-toggle__knob"></span></span>
            <span class="pc-toggle__label">${disabled ? '常驻' : (checked ? '开启' : '已关闭')}</span>
        </button>`;
}

function renderStyleEditor(appId, scope, targetId, css) {
    const key = `${scope}:${targetId}`;
    return `
        <details class="pc-style">
            <summary class="pc-style__summary">
                ${ICONS.brush}<span>自定义样式</span>
                ${css ? '<span class="pc-style__dirty">已修改</span>' : ''}
            </summary>
            <div class="pc-style__body">
                <p class="pc-style__hint">写 CSS 覆盖这一条的外观，保存后预览和真实显示同步生效。留空即恢复默认。</p>
                <textarea class="pc-style__input" spellcheck="false" rows="6"
                          data-pc-css="${escapeHtml(key)}"
                          placeholder=".music-island-title { color: #ff6b9d; }">${escapeHtml(css)}</textarea>
                <div class="pc-style__actions">
                    <button type="button" class="pc-btn pc-btn--ghost" data-pc-action="reset-css"
                            data-pc-scope="${escapeHtml(scope)}" data-pc-target="${escapeHtml(targetId)}">
                        ${ICONS.reset}<span>恢复默认</span>
                    </button>
                    <button type="button" class="pc-btn pc-btn--primary" data-pc-action="save-css"
                            data-pc-scope="${escapeHtml(scope)}" data-pc-target="${escapeHtml(targetId)}">
                        ${ICONS.save}<span>保存</span>
                    </button>
                </div>
            </div>
        </details>`;
}

function renderIslandCard(appId, kind, activeSize, presence) {
    const enabled = isIslandKindEnabled(appId, kind.id);
    const size = kind.sizes.includes(activeSize) ? activeSize : kind.sizes[0];
    const sizeTabs = kind.sizes.map((s) => `
        <button type="button" class="pc-size-tab${s === size ? ' is-active' : ''}"
                data-pc-action="switch-island-size" data-pc-target="${escapeHtml(kind.id)}" data-pc-size="${escapeHtml(s)}">
            ${escapeHtml(SIZE_META[s]?.label || s)}
        </button>`).join('');

    return `
        <section class="pc-card${enabled ? '' : ' is-off'}" data-pc-kind="${escapeHtml(kind.id)}">
            <header class="pc-card__head">
                <div class="pc-card__icon">${ICONS.island}</div>
                <div class="pc-card__meta">
                    <h3 class="pc-card__title">${escapeHtml(kind.label)}</h3>
                    ${kind.desc ? `<p class="pc-card__desc">${escapeHtml(kind.desc)}</p>` : ''}
                </div>
                ${renderToggle(enabled, kind.essential,
                    `data-pc-action="toggle-island" data-pc-target="${escapeHtml(kind.id)}"`)}
            </header>

            <div class="pc-when">
                ${ICONS.clock}
                <div><span class="pc-when__label">出现时机</span><span class="pc-when__text">${escapeHtml(kind.when)}</span></div>
            </div>

            ${kind.sizes.length > 1 ? `<div class="pc-size-tabs">${sizeTabs}</div>` : ''}
            ${renderIslandPreview(kind, size, presence)}
            <div class="pc-card__foot">
                <button type="button" class="pc-btn pc-btn--ghost" data-pc-action="try-island"
                        data-pc-target="${escapeHtml(kind.id)}">
                    ${ICONS.play}<span>试一下</span>
                </button>
            </div>
            ${renderStyleEditor(appId, 'island', kind.id, getStyleOverride(appId, 'island', kind.id))}
        </section>`;
}

function renderWidgetCard(appId, widget) {
    const enabled = isWidgetEnabled(appId, widget.widgetId);
    const sizes = widget.sizes || [widget.size || widget.defaultSize || 'M'];
    return `
        <section class="pc-card${enabled ? '' : ' is-off'}" data-pc-widget="${escapeHtml(widget.widgetId)}">
            <header class="pc-card__head">
                <div class="pc-card__icon">${ICONS.widget}</div>
                <div class="pc-card__meta">
                    <h3 class="pc-card__title">${escapeHtml(widget.label || widget.widgetId)}</h3>
                    <p class="pc-card__desc">${escapeHtml(widget.desc || `尺寸 ${sizes.join(' / ')} · 长按桌面空白处即可添加`)}</p>
                </div>
                ${renderToggle(enabled, false,
                    `data-pc-action="toggle-widget" data-pc-target="${escapeHtml(widget.widgetId)}"`)}
            </header>
            <div class="pc-widget-row">
                ${sizes.map((s) => renderWidgetPreview(widget, s)).join('')}
            </div>
            ${renderStyleEditor(appId, 'widget', widget.widgetId, getStyleOverride(appId, 'widget', widget.widgetId))}
        </section>`;
}

// ---------------------------------------------------------------------------
// 主渲染
// ---------------------------------------------------------------------------

function renderBody() {
    const { appId, islandSizes } = _state;
    const presence = getAppPresence(appId);
    const kinds = presence.islandKinds || [];
    const notifyKinds = presence.notifyKinds || [];
    const widgets = presence.widgets || [];

    const emptyBlock = (text, hint) => `
        <div class="pc-empty">
            <div class="pc-empty__icon">${ICONS.empty}</div>
            <div class="pc-empty__text">${escapeHtml(text)}</div>
            <div class="pc-empty__hint">${escapeHtml(hint)}</div>
        </div>`;

    return `
        <div class="pc-scroll">
            <div class="pc-intro">
                <h2 class="pc-intro__title">${escapeHtml(presence.appName)} 在系统里的露出</h2>
                <p class="pc-intro__desc">下面是这个 App 会占用灵动岛的全部时机、以及它提供的桌面小组件。每一条都可以单独关闭或改样式。</p>
            </div>

            <div class="pc-section-title">${ICONS.island}<span>灵动岛</span><em>${kinds.length}</em></div>
            ${kinds.length
                ? kinds.map((k) => renderIslandCard(appId, k, islandSizes[k.id], presence)).join('')
                : emptyBlock('这个 App 没有声明灵动岛', '开发者可以在 appConfig.islandKinds 里补充')}

            <div class="pc-section-title">${ICONS.notify}<span>通知提示</span><em>${notifyKinds.length}</em></div>
            ${notifyKinds.length
                ? notifyKinds.map((k) => renderNotifyCard(appId, k)).join('')
                : emptyBlock('这个 App 没有声明通知提示', '开发者可以在 appConfig.notifyKinds 里补充')}

            <div class="pc-section-title">${ICONS.widget}<span>桌面小组件</span><em>${widgets.length}</em></div>
            ${widgets.length
                ? widgets.map((w) => renderWidgetCard(appId, w)).join('')
                : emptyBlock('这个 App 没有提供小组件', '开发者可以在 appConfig.widgets 里补充')}

            <div class="pc-footnote">关掉某一条之后，这个 App 在对应时机不会再占用灵动岛，其他功能不受影响。</div>
        </div>`;
}

function paint() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || !_state) return;
    const body = overlay.querySelector('.pc-body');
    if (body) body.innerHTML = renderBody();
}

// ---------------------------------------------------------------------------
// 交互
// ---------------------------------------------------------------------------

function onClick(event) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || !_state) return;
    const target = event.target;
    if (!target?.closest) return;

    if (target.closest('[data-pc-action="close"]') || target === overlay) {
        closeAppPresenceCenter();
        return;
    }

    const btn = target.closest('[data-pc-action]');
    if (!btn || !overlay.contains(btn)) return;
    const action = btn.getAttribute('data-pc-action');
    const targetId = btn.getAttribute('data-pc-target') || '';
    event.stopPropagation();

    if (action === 'toggle-island') {
        if (btn.classList.contains('is-locked')) return;
        setIslandKindEnabled(_state.appId, targetId, !isIslandKindEnabled(_state.appId, targetId));
        paint();
        return;
    }
    if (action === 'toggle-notify') {
        setNotifyKindEnabled(_state.appId, targetId, !isNotifyKindEnabled(_state.appId, targetId));
        paint();
        return;
    }
    if (action === 'try-notify') {
        const kind = (getAppPresence(_state.appId).notifyKinds || []).find((k) => k.id === targetId);
        if (kind) {
            try {
                const state = getIslandState(kind.type);
                window.myDynamicIsland?.showNotification?.(kind.type || 'info', kind.title, kind.message, {
                    ownerId: _state.appId,
                    duration: 2600,
                    icon: sanitizeIslandIcon(kind.icon, state.icon),
                });
            } catch (_) { /* noop */ }
        }
        return;
    }
    if (action === 'try-island') {
        const presence = getAppPresence(_state.appId);
        const kind = (presence.islandKinds || []).find((k) => k.id === targetId);
        if (kind) {
            try {
                const size = _state.islandSizes[kind.id] || kind.sizes?.[0] || 'compact';
                const p = kind.previewPayload || {};
                const icon = pickIslandIconHtml(kind, presence);
                if (size === 'compact' && !kind.template) {
                    window.myDynamicIsland?.showNotification?.(p.type || kind.type || 'info', p.title || kind.label, p.message || '', {
                        ownerId: _state.appId,
                        duration: 2600,
                        icon,
                    });
                } else {
                    window.myDynamicIsland?.showInfo?.(size, {
                        kind: kind.id,
                        type: p.type || kind.type || 'info',
                        title: p.title || kind.label,
                        message: p.message || '',
                        icon,
                        islandTemplate: kind.template || '',
                        payload: p,
                        ownerId: _state.appId,
                        lifecycle: 'time',
                        duration: 3200,
                    });
                }
            } catch (_) { /* noop */ }
        }
        return;
    }
    if (action === 'toggle-widget') {
        setWidgetEnabled(_state.appId, targetId, !isWidgetEnabled(_state.appId, targetId));
        paint();
        return;
    }
    if (action === 'switch-island-size') {
        _state.islandSizes[targetId] = btn.getAttribute('data-pc-size') || 'medium';
        paint();
        return;
    }
    if (action === 'save-css' || action === 'reset-css') {
        const scope = btn.getAttribute('data-pc-scope') || 'island';
        if (action === 'reset-css') {
            clearStyleOverride(_state.appId, scope, targetId);
        } else {
            const ta = overlay.querySelector(`[data-pc-css="${CSS.escape(`${scope}:${targetId}`)}"]`);
            setStyleOverride(_state.appId, scope, targetId, ta ? ta.value : '');
        }
        paint();
        try {
            window.__phoneIsland?.notify?.('success', action === 'reset-css' ? '已恢复默认样式' : '样式已保存');
        } catch (_) { /* noop */ }
    }
}

// ---------------------------------------------------------------------------
// 开关
// ---------------------------------------------------------------------------

export function openAppPresenceCenter(appId) {
    if (!appId) return;
    closeAppPresenceCenter();
    const host = document.querySelector('.phone-screen') || document.body;
    const presence = getAppPresence(appId);

    _state = { appId, islandSizes: {} };
    (presence.islandKinds || []).forEach((k) => { _state.islandSizes[k.id] = k.sizes[0]; });

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'pc-overlay';
    overlay.innerHTML = `
        <div class="pc-panel" role="dialog" aria-label="灵动岛与小组件">
            <header class="pc-topbar">
                <button type="button" class="pc-topbar__back" data-pc-action="close" aria-label="返回">${ICONS.back}</button>
                <h1 class="pc-topbar__title">灵动岛与小组件</h1>
                <span class="pc-topbar__spacer"></span>
            </header>
            <div class="pc-body"></div>
        </div>`;
    host.appendChild(overlay);
    paint();
    applyStyleOverrides();

    overlay.addEventListener('click', onClick);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
}

export function closeAppPresenceCenter() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.removeEventListener('click', onClick);
    overlay.remove();
    _state = null;
}

/**
 * 全局委托：任何 App 只要放一个 `data-presence-center="<appId>"` 的按钮就能进来。
 * 用捕获阶段，抢在 framework 的 data-app-action 委托之前。
 */
export function installPresenceCenterDelegate() {
    if (typeof document === 'undefined' || document.__presenceCenterHooked) return;
    document.__presenceCenterHooked = true;
    document.addEventListener('click', (e) => {
        const trigger = e.target?.closest?.('[data-presence-center]');
        if (!trigger) return;
        e.preventDefault();
        e.stopPropagation();
        openAppPresenceCenter(trigger.getAttribute('data-presence-center'));
    }, true);
    applyStyleOverrides();
    if (typeof window !== 'undefined') {
        window.openAppPresenceCenter = openAppPresenceCenter;
        window.closeAppPresenceCenter = closeAppPresenceCenter;
    }
}

export default openAppPresenceCenter;
