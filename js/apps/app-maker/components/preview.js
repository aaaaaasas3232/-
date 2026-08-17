/**
 * 实时预览
 *
 * ── 一条原则：预览必须走和生成代码**同一套**渲染函数 ────────────────
 * 如果预览自己写一份「差不多长这样」的 HTML，那它就是一张漂亮的谎言 ——
 * 用户按预览调好了，生成出来是另一个样子，这比没有预览更糟。
 *
 * 所以这里直接调 `src/core/presets` 的卡片和布局函数，
 * 和 codegen 生成的代码调的是同一批。参数也来自同一个 blueprint。
 *
 * 顶栏、底栏、状态栏是例外：那三条由框架画，预览里只能仿。
 *
 * ── 为什么是「整台缩放」而不是「画进一个小框」 ────────────────────
 * 上一版是把内容塞进一个 340px 高的框里，字还是 14px，可留白只剩一半 ——
 * 用户按那个调出来的间距，装到桌面上全不对。
 *
 * 这一版里面这层永远按真机的 374×574 排版，再用 transform 整体缩放。
 * 缩过之后字和留白同比例变小，「挤不挤」这件事才是真的。
 * 代价是缩小时字会偏小，所以给了两档：整台看构图，放大看细节。
 */

import { presets as LP } from '@/src/core/presets/index.js';
import { buildBlueprint } from '../survey/blueprint.js';
import { ICONS } from '../icons.js';

/** 真机屏幕尺寸。改这两个数就能跟着框架走。 */
const DEVICE_W = 374;
const DEVICE_H = 574;

/** 两档缩放：0.60 一眼看全整台，0.88 是内容区能容下的最大值（374×0.88+12 ≈ 342） */
const SCALES = [
    { value: 0.6, label: '整台' },
    { value: 0.88, label: '放大' },
];

const SAMPLE_TITLES = ['第一条内容', '第二条内容', '第三条内容', '第四条内容', '第五条内容', '第六条内容'];
const SAMPLE_SUBS = ['刚刚更新', '来自占位数据', '点开看详情', '这是副标题'];

function sampleItems(page) {
    const n = ['grid', 'twoColumn', 'masonry'].includes(page.layout) ? 6 : 4;
    return Array.from({ length: n }, (_, i) => ({
        id: `${page.id}-${i}`,
        title: SAMPLE_TITLES[i % SAMPLE_TITLES.length],
        subtitle: SAMPLE_SUBS[i % SAMPLE_SUBS.length],
        value: (i + 1) * 7,
        time: `0${(i % 9) + 1}:${String((i * 13) % 60).padStart(2, '0')}`,
    }));
}

const GROUP_CARDS = ['timeline', 'keyValue', 'bars', 'tags'];

/** 顶栏动作 id → 图标 / 文案。预览和 codegen 用同一份口径，免得两边对不上。 */
const ACTION_ICONS = {
    search: ICONS.search,
    add: ICONS.plus,
    more: ICONS.more,
    filter: ICONS.filter,
    settings: ICONS.settings,
    sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4L7 9M12 4l5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
};

const ACTION_LABELS = {
    search: '搜索', add: '新建', more: '更多', filter: '筛选', settings: '设置',
    done: '完成', sort: '排序', star: '收藏', refresh: '刷新', export: '导出',
};
const DOT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';

function renderCard(kind, item, items, page, bp) {
    const show = (f) => page.cardFields.includes(f);
    const box = { padding: page.padding, radius: bp.radius, elevation: bp.elevation };

    switch (kind) {
        case 'info':
            return LP.cards.info({
                title: item.title,
                subtitle: show('subtitle') ? item.subtitle : '',
                body: show('body') ? '这里是一段正文摘要，用来看两三行文字在这个间距下挤不挤。' : '',
                icon: show('icon') ? DOT : '',
                badge: show('badge') ? 'NEW' : '',
                ...box,
            });
        case 'row':
            return LP.cards.row({
                title: item.title,
                subtitle: show('subtitle') ? item.subtitle : '',
                leading: show('icon') ? DOT : '',
                trailing: show('time') ? item.time : (show('number') ? String(item.value) : ''),
                chevron: show('chevron'),
                ...box,
            });
        case 'stat':
            return LP.cards.stat({ label: item.title, value: item.value, unit: '项', hint: show('subtitle') ? item.subtitle : '', ...box });
        case 'media':
            return LP.cards.media({ title: item.title, subtitle: show('subtitle') ? item.subtitle : '', badge: show('badge') ? '占位' : '', radius: bp.radius, elevation: bp.elevation });
        case 'progress':
            return LP.cards.progress({ title: item.title, value: item.value, max: 100, hint: show('subtitle') ? item.subtitle : '', ...box });
        case 'profile':
            return LP.cards.profile({ name: item.title, desc: item.subtitle, actionLabel: show('actions') ? '查看' : '', ...box });
        case 'timeline':
            return LP.cards.timeline(items.map((it) => ({ title: it.title, time: it.time, desc: it.subtitle })), box);
        case 'keyValue':
            return LP.cards.keyValue(items.map((it) => ({ key: it.title, value: it.subtitle })), box);
        case 'bars':
            return LP.cards.bars({ title: `${page.name} 趋势`, items: items.map((it) => ({ label: it.time, value: it.value })), ...box });
        case 'banner':
            return LP.cards.banner({ title: page.name, desc: page.desc || '这里放一句引导文案', ctaLabel: '开始', ...box });
        case 'tags':
            return LP.cards.tags(items.slice(0, 5).map((it, i) => ({ label: it.title, active: i === 0 })), {});
        default:
            return '';
    }
}

function layoutFor(page, blocks) {
    const opts = { gap: page.gap };
    switch (page.layout) {
        case 'twoColumn': return LP.layouts.twoColumn(blocks, opts);
        case 'grid': return LP.layouts.grid(blocks, { gap: page.gap, minItemWidth: '96px' });
        case 'masonry': return LP.layouts.masonry(blocks, { cols: 2, gap: page.gap });
        case 'carousel': return LP.layouts.carousel(blocks, { gap: page.gap, itemWidth: '68%', paddingX: page.padding });
        case 'groupedList': return LP.layouts.groupedList([{ title: page.name, items: blocks }], opts);
        case 'split': return LP.layouts.split(LP.cards.tags(['全部', '最近', '收藏'], {}), LP.layouts.column(blocks, opts), opts);
        default: return LP.layouts.column(blocks, opts);
    }
}

/** 一整页的内容区 HTML */
function renderPageHtml(page, bp) {
    const items = sampleItems(page);
    const blocks = [];

    if (page.hasSearch) blocks.push(LP.cards.searchBar({ placeholder: `搜索${page.name}` }));
    if (page.desc) blocks.push(LP.cards.sectionHeader({ title: page.name, subtitle: page.desc }));

    if (!page.cards.length) {
        blocks.push(LP.cards.empty({ title: '这一页还没选卡片类型', desc: '选一种，这里就会画出来' }));
    } else {
        page.cards.forEach((card) => {
            if (GROUP_CARDS.includes(card.value)) {
                blocks.push(renderCard(card.value, items[0], items, page, bp));
                return;
            }
            items.forEach((item) => blocks.push(renderCard(card.value, item, items, page, bp)));
        });
    }

    if (page.subpages.length) {
        blocks.push(LP.cards.sectionHeader({ title: '子页面', subtitle: '这一页能进到哪儿' }));
        page.subpages.forEach((sp) => {
            blocks.push(LP.cards.row({ title: sp.title, subtitle: sp.desc, chevron: true, padding: 'snug', radius: bp.radius, elevation: bp.elevation }));
        });
    }

    return LP.layouts.page(layoutFor(page, blocks), {
        padding: page.padding,
        gap: page.gap,
        // 里面这层是按真机尺寸画的，底部留白也照真机来
        safeBottom: bp.tabbar.visible ? '72px' : '32px',
    });
}

export const AmPreview = {
    name: 'AmPreview',
    props: {
        answers: { type: Object, required: true },
        /** 预览当前聚焦在哪一页（页面 key） */
        pageKey: { type: String, default: '' },
        /** 高亮哪一块：topbar / tabbar / content / fab，用于答到对应题目时提示 */
        focus: { type: String, default: '' },
    },
    emits: ['pick-page'],
    data() {
        return { localPageId: '', scale: SCALES[0].value };
    },
    computed: {
        icons() { return ICONS; },
        scales() { return SCALES; },
        bp() { return buildBlueprint(this.answers); },
        activePage() {
            const byKey = this.pageKey && this.bp.pages.find((p) => p.key === this.pageKey);
            if (byKey) return byKey;
            const byLocal = this.localPageId && this.bp.pages.find((p) => p.id === this.localPageId);
            return byLocal || this.bp.pages[0];
        },
        bodyHtml() {
            try {
                return renderPageHtml(this.activePage, this.bp);
            } catch (err) {
                // 预览挂了不能连累问卷 —— 用户还在填，这时候白屏会让人以为答案丢了
                console.warn('[app-maker] 预览渲染失败', err);
                return '<div style="padding:24px;text-align:center;font-size:12px;opacity:.6;">这一组配置暂时画不出来，继续填不影响生成</div>';
            }
        },
        deviceStyle() {
            return {
                '--am-dev-w': `${DEVICE_W}px`,
                '--am-dev-h': `${DEVICE_H}px`,
                '--am-dev-scale': String(this.scale),
            };
        },
        screenStyle() {
            const s = this.bp.style;
            return {
                background: s.bg,
                '--lp-accent': s.primary,
                '--lp-surface': s.card,
                '--lp-text': s.text,
                color: s.text,
            };
        },
        deviceSize() { return `${DEVICE_W}×${DEVICE_H}`; },
        /** 认得的动作给图标，认不得的退回文字 —— 空图标位比一个字更难看 */
        topbarRightIcons() {
            return this.bp.topbar.right.map((r) => {
                const html = ACTION_ICONS[r] || '';
                return { key: r, html, text: html ? '' : (ACTION_LABELS[r] || r) };
            });
        },
        /** 纯按钮组：整条顶栏平分的那一排 */
        topbarButtons() {
            if (this.bp.topbar.type !== 'buttons-only') return [];
            return this.bp.topbar.right.map((r) => ({
                key: r,
                html: ACTION_ICONS[r] || '',
                label: this.bp.topbar.buttonLabels ? (ACTION_LABELS[r] || r) : '',
            }));
        },
        topbarLeftIcon() {
            return {
                back: ICONS.chevronLeft,
                menu: ICONS.menu,
                avatar: ICONS.user,
                close: ICONS.close,
            }[this.bp.topbar.left] || '';
        },
    },
    methods: {
        pick(page) {
            this.localPageId = page.id;
            this.$emit('pick-page', page.key);
        },
        isFocus(part) { return this.focus === part; },
    },
    template: `
        <div class="am-preview">
            <div class="am-device" :style="deviceStyle">
                <div class="am-device__screen" :style="screenStyle">
                    <span class="am-device__island" aria-hidden="true"></span>

                    <div class="am-device__viewport">
                        <!-- 状态栏：真机上由框架画，这里只是仿一条让设备成立 -->
                        <div class="am-pv-status">
                            <span>9:41</span>
                            <span class="am-pv-status__right">
                                <span v-html="icons.signal"></span>
                                <span v-html="icons.wifi"></span>
                                <span v-html="icons.battery"></span>
                            </span>
                        </div>

                        <!-- 顶栏 -->
                        <div
                            v-if="bp.topbar.visible"
                            class="am-pv-topbar"
                            :class="[ 'is-' + bp.topbar.type, { 'is-focus': isFocus('topbar') } ]"
                        >
                            <!-- 纯按钮组：整条就是一排按钮，没有标题也没有左右分区 -->
                            <div v-if="bp.topbar.type === 'buttons-only'" class="am-pv-btnbar">
                                <span
                                    v-for="b in topbarButtons" :key="b.key"
                                    class="am-pv-btnbar__btn"
                                    :class="{ 'is-icon-only': !b.label }"
                                >
                                    <span class="am-pv-btnbar__icon" v-html="b.html"></span>
                                    <span v-if="b.label" class="am-pv-btnbar__label">{{ b.label }}</span>
                                </span>
                                <span v-if="!topbarButtons.length" class="am-pv-btnbar__empty">还没选按钮</span>
                            </div>

                            <template v-else>
                            <span v-if="topbarLeftIcon" class="am-pv-topbar__left" v-html="topbarLeftIcon"></span>
                            <div class="am-pv-topbar__mid">
                                <div v-if="bp.topbar.type === 'search'" class="am-pv-searchbox">
                                    <span v-html="icons.search"></span>搜索
                                </div>
                                <div v-else-if="bp.topbar.type === 'segmented'" class="am-pv-seg">
                                    <span v-for="(p, i) in bp.pages.slice(0, 3)" :key="p.id" :class="{ 'is-on': i === 0 }">{{ p.name }}</span>
                                </div>
                                <template v-else>
                                    <div class="am-pv-topbar__title" :class="{ 'is-large': bp.topbar.type === 'large-title' }">{{ bp.appName }}</div>
                                    <div v-if="bp.tagline && bp.topbar.type === 'standard'" class="am-pv-topbar__sub">{{ bp.tagline }}</div>
                                </template>
                            </div>
                            <span v-if="topbarRightIcons.length" class="am-pv-topbar__right">
                                <template v-for="ic in topbarRightIcons" :key="ic.key">
                                    <span v-if="ic.html" v-html="ic.html"></span>
                                    <span v-else class="am-pv-topbar__word">{{ ic.text }}</span>
                                </template>
                            </span>
                            </template>
                        </div>

                        <!-- 内容 -->
                        <div class="am-pv-body" :class="{ 'is-focus': isFocus('content') }">
                            <div class="am-pv-scroll" v-html="bodyHtml"></div>
                            <button
                                v-if="bp.fab.visible"
                                type="button"
                                class="am-pv-fab"
                                :class="['is-' + bp.fab.position, { 'is-focus': isFocus('fab') }]"
                            ><span v-html="icons.plus"></span>{{ bp.fab.label }}</button>
                        </div>

                        <!-- 底栏 -->
                        <div
                            v-if="bp.tabbar.visible"
                            class="am-pv-tabbar"
                            :class="['is-' + bp.tabbar.type, { 'is-focus': isFocus('tabbar') }]"
                        >
                            <button
                                v-for="p in bp.pages" :key="p.id"
                                type="button"
                                class="am-pv-tab"
                                :class="{ 'is-on': p.id === activePage.id }"
                                @click="pick(p)"
                            >
                                <span class="am-pv-tab__glyph">{{ p.glyph }}</span>
                                <span v-if="bp.tabbar.showLabels" class="am-pv-tab__label">{{ p.name }}</span>
                            </button>
                        </div>

                        <div class="am-pv-homebar"><i></i></div>
                    </div>
                </div>
            </div>

            <!-- 没有底栏时也得能切页看预览 -->
            <div v-if="!bp.tabbar.visible && bp.pages.length > 1" class="am-preview__switch">
                <button
                    v-for="p in bp.pages" :key="p.id"
                    type="button" :class="{ 'is-on': p.id === activePage.id }"
                    @click="pick(p)"
                >{{ p.name }}</button>
            </div>

            <div class="am-preview__scaler">
                <button
                    v-for="s in scales" :key="s.value"
                    type="button" :class="{ 'is-on': scale === s.value }"
                    @click="scale = s.value"
                >{{ s.label }}</button>
            </div>

            <p class="am-preview__note">
                按真机 {{ deviceSize }} 排版后整体缩放，所以字号和留白的比例是真的。
                卡片走的是和生成代码同一套渲染函数；状态栏、顶栏、底栏由框架绘制，这里只是示意。
            </p>
        </div>
    `,
};
