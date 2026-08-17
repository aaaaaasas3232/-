/**
 * 预设库 · 桌面小组件
 *
 * `appConfig.widgets[]` 的每一项要求给出 `render(size, payload)`。
 * 这个函数在**桌面**上被调用，尺寸只有三档，可用面积很小 ——
 * 大多数 App 第一次写 widget 都会塞太多东西，结果在 S 尺寸下文字被裁掉。
 *
 * 这里按「一个 widget 只讲一件事」把常见形态固化下来，
 * 每个预设自己处理三档尺寸的降级：S 只留主值，M 加标题和副值，L 才铺列表。
 *
 * 尺寸约定（沿用 css/core/30-widgets.css）：
 *   S = 2×1（一个数字）  M = 2×2（数字 + 上下文）  L = 4×2（列表 / 图表）
 */

import { esc, cssVars, cx } from './tokens.js';

function shell(inner, opts = {}) {
    return `<div class="${cx('lp-w', opts.className)}"${cssVars({
        '--lp-w-accent': opts.accent,
        '--lp-w-fg': opts.color,
    })}>${inner}</div>`;
}

export const WIDGET_PRESETS = {
    /** 一个大数字。最省地方，S 尺寸也不会裁。 */
    stat: {
        label: '数据',
        desc: '一个大数字 + 名称',
        sizes: ['S', 'M', 'L'],
        previewPayload: { label: '今日', value: '12', unit: '条', hint: '比昨天多 3 条' },
        render(size, payload = {}) {
            const { label = '', value = '—', unit = '', hint = '' } = payload;
            if (size === 'S') {
                return shell(`<div class="lp-w__s">
                    <div class="lp-w__value">${esc(value)}<span class="lp-w__unit">${esc(unit)}</span></div>
                    <div class="lp-w__label">${esc(label)}</div>
                </div>`, payload);
            }
            return shell(`<div class="lp-w__m">
                <div class="lp-w__label">${esc(label)}</div>
                <div class="lp-w__value lp-w__value--lg">${esc(value)}<span class="lp-w__unit">${esc(unit)}</span></div>
                ${hint ? `<div class="lp-w__hint">${esc(hint)}</div>` : ''}
            </div>`, payload);
        },
    },

    /** 环形进度。适合目标 / 打卡 / 完成度。 */
    ring: {
        label: '环形进度',
        desc: '一个进度环 + 中心百分比',
        sizes: ['S', 'M'],
        previewPayload: { label: '今日目标', value: 68, hint: '还差 2 项' },
        render(size, payload = {}) {
            const { label = '', value = 0, hint = '' } = payload;
            const pct = Math.max(0, Math.min(100, Number(value) || 0));
            const ring = `<div class="lp-w__ring" style="--lp-w-pct:${pct}"><span>${Math.round(pct)}<i>%</i></span></div>`;
            if (size === 'S') return shell(`<div class="lp-w__s lp-w__s--ring">${ring}</div>`, payload);
            return shell(`<div class="lp-w__m lp-w__m--ring">
                ${ring}
                <div class="lp-w__ringtext">
                    <div class="lp-w__label">${esc(label)}</div>
                    ${hint ? `<div class="lp-w__hint">${esc(hint)}</div>` : ''}
                </div>
            </div>`, payload);
        },
    },

    /** 最近几条。L 尺寸才铺得开，S 退化成「还有 N 条」。 */
    list: {
        label: '列表',
        desc: '最近 2–4 条内容',
        sizes: ['M', 'L'],
        previewPayload: { label: '最近', items: [{ title: '写周报', sub: '今天 18:00' }, { title: '买咖啡豆', sub: '明天' }] },
        render(size, payload = {}) {
            const { label = '', items = [] } = payload;
            const max = size === 'L' ? 4 : 2;
            const rows = items.slice(0, max).map((it) => `
                <div class="lp-w__row">
                    <span class="lp-w__dot"></span>
                    <span class="lp-w__rowtitle">${esc(it?.title)}</span>
                    ${it?.sub ? `<span class="lp-w__rowsub">${esc(it.sub)}</span>` : ''}
                </div>
            `).join('');
            const more = items.length > max ? `<div class="lp-w__hint">还有 ${items.length - max} 条</div>` : '';
            return shell(`<div class="lp-w__l">
                ${label ? `<div class="lp-w__label">${esc(label)}</div>` : ''}
                <div class="lp-w__rows">${rows || '<div class="lp-w__hint">暂无内容</div>'}</div>
                ${more}
            </div>`, payload);
        },
    },

    /** 快捷按钮组。点一下直达 App 的某个动作。 */
    actions: {
        label: '快捷入口',
        desc: '2–4 个按钮',
        sizes: ['M', 'L'],
        previewPayload: { items: [{ icon: '＋', label: '新建' }, { icon: '⌕', label: '搜索' }] },
        render(size, payload = {}) {
            const items = (payload.items || []).slice(0, size === 'L' ? 4 : 2);
            const cells = items.map((it) => `
                <div class="lp-w__act">
                    <span class="lp-w__acticon">${it?.icon || '•'}</span>
                    <span class="lp-w__actlabel">${esc(it?.label)}</span>
                </div>
            `).join('');
            return shell(`<div class="lp-w__acts">${cells}</div>`, payload);
        },
    },

    /** 迷你柱状图。一周趋势那种。 */
    chart: {
        label: '趋势图',
        desc: '一排小柱子',
        sizes: ['M', 'L'],
        previewPayload: { label: '本周', values: [3, 5, 2, 8, 6, 4, 7] },
        render(size, payload = {}) {
            const { label = '', values = [] } = payload;
            const max = Math.max(1, ...values.map((v) => Number(v) || 0));
            const bars = values.slice(0, size === 'L' ? 14 : 7).map((v) => {
                const h = Math.max(6, ((Number(v) || 0) / max) * 100);
                return `<i style="height:${h.toFixed(1)}%"></i>`;
            }).join('');
            return shell(`<div class="lp-w__l">
                ${label ? `<div class="lp-w__label">${esc(label)}</div>` : ''}
                <div class="lp-w__chart">${bars}</div>
            </div>`, payload);
        },
    },

    /** 一句话。语录 / 今日提醒 / 状态文案。 */
    text: {
        label: '一句话',
        desc: '一段短文字',
        sizes: ['M', 'L'],
        previewPayload: { label: '今天', text: '把最难的那件事放在最前面。' },
        render(size, payload = {}) {
            const { label = '', text = '' } = payload;
            return shell(`<div class="lp-w__m lp-w__m--text">
                ${label ? `<div class="lp-w__label">${esc(label)}</div>` : ''}
                <div class="lp-w__text">${esc(text)}</div>
            </div>`, payload);
        },
    },
};

/**
 * 生成一项 `appConfig.widgets[]`。
 *
 * @param {string} presetId
 * @param {object} conf  { id, label, icon, iconBg, size, orientation, getPayload, onTap }
 *
 * `getPayload()` 是给 App 用来喂真实数据的：widget 在桌面上被渲染时会调它。
 * 不传就用 preset 自带的 previewPayload —— 也就是「白膜」状态，
 * 桌面上能看到长什么样，但数字是假的。
 */
export function widget(presetId, conf = {}) {
    const preset = WIDGET_PRESETS[presetId];
    if (!preset) {
        console.warn(`[presets/widgets] 未知的小组件预设: ${presetId}`);
        return null;
    }
    const getPayload = typeof conf.getPayload === 'function' ? conf.getPayload : null;
    return {
        id: conf.id || presetId,
        label: conf.label || preset.label,
        icon: conf.icon || '',
        iconBg: conf.iconBg || '',
        size: conf.size || preset.sizes[0],
        orientation: conf.orientation || 'h',
        previewPayload: conf.previewPayload || preset.previewPayload,
        render(size, payload = {}) {
            let data = payload;
            if (getPayload) {
                try {
                    const live = getPayload(size, payload);
                    if (live) data = { ...preset.previewPayload, ...live };
                } catch (err) {
                    console.warn(`[presets/widgets] ${presetId} getPayload 出错，退回预览数据`, err);
                    data = preset.previewPayload;
                }
            } else if (!payload || Object.keys(payload).length === 0) {
                data = preset.previewPayload;
            }
            return preset.render(size, data);
        },
        onTap: conf.onTap,
    };
}

export const widgets = { WIDGET_PRESETS, widget };

/** 问卷 / 文档用的清单 */
export const WIDGET_CATALOG = Object.entries(WIDGET_PRESETS).map(([id, p]) => ({
    id, name: p.label, desc: p.desc, sizes: p.sizes,
}));

export default widgets;
