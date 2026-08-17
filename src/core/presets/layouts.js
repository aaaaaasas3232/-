/**
 * 预设库 · 页面布局
 *
 * 「这一页是一列还是两列、是瀑布流还是卡片流、横着还是竖着」——
 * 问卷里这道题的答案，落到代码里就是这里的一个函数名。
 *
 * 每个布局函数吃 `items`（HTML 字符串数组）+ options，吐一段 HTML。
 * 它们只负责排布，不关心里面装的是哪种卡片，所以布局和卡片可以任意组合。
 *
 * ── 移动端约束（这一层统一兜住，App 不用each自己记）─────────────────
 *   - 底部留白：所有滚动容器都带 `--lp-safe-bottom`，默认把 tab 栏 + home
 *     指示条的高度让出来，避免最后一张卡被挡住
 *   - 横向滚动容器统一 `scroll-snap` + 首尾 padding，不然最后一张永远贴边
 *   - 两列/网格在窄屏（<340px）自动退化成一列，靠 CSS 的 auto-fit 完成
 */

import { cssVars, cx, spacing, len } from './tokens.js';

function normalizeItems(items) {
    if (Array.isArray(items)) return items.filter(Boolean);
    return items ? [items] : [];
}

/** 页面滚动外壳。所有布局都建议套一层，它负责安全区和整体内边距。 */
export function page(inner = '', opts = {}) {
    const style = cssVars({
        '--lp-pad-x': spacing(opts.paddingX ?? opts.padding, 'normal'),
        '--lp-pad-top': spacing(opts.paddingTop ?? opts.padding, 'snug'),
        '--lp-safe-bottom': len(opts.safeBottom, '96px'),
        '--lp-gap': spacing(opts.gap, 'snug'),
        '--lp-bg': opts.bg,
    });
    return `<div class="${cx('lp-page', opts.className)}"${style}>${inner}</div>`;
}

/** 一列流：最常见的排布 */
export function column(items, opts = {}) {
    const list = normalizeItems(items).join('');
    return `<div class="lp-col"${cssVars({ '--lp-gap': spacing(opts.gap, 'snug'), '--lp-pad': spacing(opts.padding, 0) })}>${list}</div>`;
}

/** 两列等宽网格。窄屏自动退化成一列。 */
export function twoColumn(items, opts = {}) {
    return grid(items, { ...opts, cols: 2 });
}

/** N 列网格。cols 传 0 表示按 minItemWidth 自适应列数。 */
export function grid(items, opts = {}) {
    const list = normalizeItems(items).map((html) => `<div class="lp-grid__cell">${html}</div>`).join('');
    const cols = Number(opts.cols) || 0;
    const template = cols > 0
        ? `repeat(${cols}, minmax(0, 1fr))`
        : `repeat(auto-fit, minmax(${len(opts.minItemWidth, '140px')}, 1fr))`;
    return `<div class="lp-grid"${cssVars({
        '--lp-grid-cols': template,
        '--lp-gap': spacing(opts.gap, 'snug'),
        '--lp-pad': spacing(opts.padding, 0),
    })}>${list}</div>`;
}

/**
 * 瀑布流。用 CSS multi-column 实现，不需要 JS 测高。
 * 代价是**顺序按列走**（1、2 在左列，3、4 在右列），
 * 对「按时间倒序」的内容会读起来别扭 —— 这种场景该选 grid 而不是 masonry。
 */
export function masonry(items, opts = {}) {
    const list = normalizeItems(items).map((html) => `<div class="lp-masonry__cell">${html}</div>`).join('');
    return `<div class="lp-masonry"${cssVars({
        '--lp-masonry-cols': String(Number(opts.cols) || 2),
        '--lp-gap': spacing(opts.gap, 'snug'),
        '--lp-pad': spacing(opts.padding, 0),
    })}>${list}</div>`;
}

/** 横向滚动条。带 scroll-snap，首尾自动留白。 */
export function carousel(items, opts = {}) {
    const list = normalizeItems(items)
        .map((html) => `<div class="lp-carousel__cell"${cssVars({ '--lp-item-w': len(opts.itemWidth, '72%') })}>${html}</div>`)
        .join('');
    return `<div class="lp-carousel"${cssVars({
        '--lp-gap': spacing(opts.gap, 'snug'),
        '--lp-pad-x': spacing(opts.paddingX ?? opts.padding, 'normal'),
    })}>${list}</div>`;
}

/** 分组列表：每组一个小标题 + 一块圆角容器（iOS 设置页那种） */
export function groupedList(sections = [], opts = {}) {
    const blocks = (Array.isArray(sections) ? sections : []).map((section) => {
        const rows = normalizeItems(section?.items).join('');
        return `<section class="lp-group">
            ${section?.title ? `<div class="lp-group__title">${String(section.title).replace(/[<>]/g, '')}</div>` : ''}
            <div class="lp-group__body">${rows}</div>
            ${section?.footer ? `<div class="lp-group__footer">${String(section.footer).replace(/[<>]/g, '')}</div>` : ''}
        </section>`;
    }).join('');
    return `<div class="lp-groups"${cssVars({ '--lp-gap': spacing(opts.gap, 'relaxed'), '--lp-pad': spacing(opts.padding, 0) })}>${blocks}</div>`;
}

/** 左右分栏：固定侧栏 + 主区。窄屏堆叠。 */
export function split(asideHtml = '', mainHtml = '', opts = {}) {
    return `<div class="lp-split"${cssVars({
        '--lp-aside-w': len(opts.asideWidth, '104px'),
        '--lp-gap': spacing(opts.gap, 'snug'),
    })}>
        <div class="lp-split__aside">${asideHtml}</div>
        <div class="lp-split__main">${mainHtml}</div>
    </div>`;
}

/** 吸底操作条：主按钮固定在底部，自动避开 tab 栏和 home 指示条 */
export function stickyFooter(inner = '', opts = {}) {
    return `<div class="lp-sticky-footer"${cssVars({
        '--lp-pad': spacing(opts.padding, 'snug'),
        '--lp-safe-bottom': len(opts.safeBottom, 'var(--app-safe-bottom, 0px)'),
    })}>${inner}</div>`;
}

export const layouts = { page, column, twoColumn, grid, masonry, carousel, groupedList, split, stickyFooter };

/** 问卷 / 文档用的布局清单 */
export const LAYOUT_CATALOG = [
    { id: 'column', name: '单列流', desc: '一张接一张竖着排', use: '信息流、清单、详情', knobs: ['gap', 'padding'] },
    { id: 'twoColumn', name: '双列网格', desc: '两列等宽，窄屏退化成一列', use: '图集、商品、卡片墙', knobs: ['gap'] },
    { id: 'grid', name: '自适应网格', desc: '按最小宽度自动决定列数', use: '图标格、功能入口', knobs: ['cols', 'minItemWidth', 'gap'] },
    { id: 'masonry', name: '瀑布流', desc: '等宽不等高，按列填充', use: '图片、笔记、灵感墙', knobs: ['cols', 'gap'] },
    { id: 'carousel', name: '横向滑动', desc: '一行横着滑，带吸附', use: '推荐位、封面轮播', knobs: ['itemWidth', 'gap'] },
    { id: 'groupedList', name: '分组列表', desc: 'iOS 设置页那种圆角分组', use: '设置、偏好、账户', knobs: ['gap'] },
    { id: 'split', name: '左右分栏', desc: '固定侧栏 + 主区', use: '分类导航 + 内容', knobs: ['asideWidth', 'gap'] },
];

export default layouts;
