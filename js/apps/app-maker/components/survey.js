// @audit-ignore 主色快选数组是用户可选的业务数据，不是 App 界面硬编码配色
/**
 * 问卷
 *
 * 分成 9 段，每段一屏可滚。不做「一题一屏」的向导 ——
 * 那种形态在题目多的时候会让人失去方位感（不知道还剩多少、
 * 不能回头改一个字就得点七次返回）。
 *
 * 每一段都声明自己该让预览高亮哪一块（`focus`），
 * 用户答到「顶栏放什么按钮」时预览里的顶栏就会亮起来。
 *
 * ★ 所有写操作都走 store 的 mutator，组件不直接改 answers 的深层字段 ——
 *   直接改会绕过防抖落盘，用户切走那一下的修改会丢。
 */

import * as store from '../store.js';
import { UI_COMPONENTS } from './ui.js';
import { AmExplainTip } from './explainer.js';
import { AmPreview } from './preview.js';
import { ICONS } from '../icons.js';
import {
    DESIGN_STYLES, RENDER_MODES, TOPBAR_TYPES, TOPBAR_LEFT_ACTIONS, TOPBAR_RIGHT_ACTIONS,
    TOPBAR_BUTTON_ACTIONS,
    TABBAR_TYPES, FAB_POSITIONS, PAGE_LAYOUTS, DENSITY_OPTIONS, RADIUS_OPTIONS, ELEVATION_OPTIONS,
    CARD_TYPES, CARD_FIELDS, SUBPAGE_TEMPLATES, MODAL_CHOICES, ISLAND_CHOICES, WIDGET_CHOICES,
    WIDGET_SIZES, CAPABILITIES, SYSTEM_READS, CROSS_APP, PAGE_PRESETS, STORE_PRESETS,
} from '../constants.js';
import { slugify, buildBlueprint, reviewBlueprint } from '../survey/blueprint.js';

export const STEPS = [
    { id: 'basic', title: '这是个什么 App', desc: '名字、定位，以及用哪种方式渲染', focus: '' },
    // 配色改的是整台设备的每一处，圈出内容区等于什么都没说 —— 这一段不标注
    { id: 'visual', title: '长什么样', desc: '配色、圆角、间距', focus: '' },
    { id: 'topbar', title: '顶部那一条', desc: '标题怎么放、按钮放哪儿、要不要搜索框', focus: 'topbar' },
    { id: 'tabbar', title: '底部那一条', desc: 'tab 栏样式，以及要不要浮动主按钮', focus: 'tabbar' },
    { id: 'pages', title: '有几个主页面', desc: '每一页的布局、卡片、间距、子页面', focus: 'content' },
    { id: 'parts', title: '白膜组件', desc: '弹窗、灵动岛、桌面小组件', focus: '' },
    { id: 'data', title: '能力与数据', desc: '要存什么、要不要 AI、读不读系统数据', focus: '' },
    { id: 'cross', title: '和别的 App 打交道', desc: '往 murmur 注册提示词、在 nook 里有形象', focus: '' },
    { id: 'review', title: '检查一遍', desc: '确认没问题就可以生成了', focus: '' },
];

// ---------------------------------------------------------------------------
// 各段
// ---------------------------------------------------------------------------

const StepBasic = {
    name: 'StepBasic',
    components: { ...UI_COMPONENTS, AmExplainTip },
    props: { answers: { type: Object, required: true } },
    computed: {
        derivedId() { return slugify(this.answers.appId || this.answers.appName, 'my-app'); },
        modeOptions() {
            return RENDER_MODES.map((m) => ({ value: m.value, title: m.title, desc: m.sub }));
        },
        currentMode() { return RENDER_MODES.find((m) => m.value === this.answers.renderMode) || RENDER_MODES[0]; },
    },
    methods: {
        set(field, value) { store.setAnswer(field, value); },
    },
    template: `
        <div class="am-step">
            <am-field label="App 叫什么" hint="桌面图标下面显示的名字">
                <am-input :model-value="answers.appName" @update:model-value="set('appName', $event)" placeholder="比如：心情日记" :maxlength="16" />
            </am-field>

            <am-field label="一句话说清它是干嘛的" hint="这句话会进顶栏副标题，也会告诉 AI 你想做什么">
                <am-input :model-value="answers.tagline" @update:model-value="set('tagline', $event)" placeholder="比如：每天记一句，月底回头看" :maxlength="24" />
            </am-field>

            <am-field label="详细一点（可以不填）" hint="越具体，生成的提示词越准">
                <am-textarea :model-value="answers.appDesc" @update:model-value="set('appDesc', $event)" :rows="3" placeholder="它解决什么问题？给谁用？和已有的 App 有什么不一样？" />
            </am-field>

            <am-field label="App ID" hint="代码里的唯一标识，英文小写 + 连字符。留空会按名字自动生成。">
                <am-input mono :model-value="answers.appId" @update:model-value="set('appId', $event)" :placeholder="derivedId" />
                <p class="am-field__derived">实际会用：<code>{{ derivedId }}</code></p>
            </am-field>

            <am-field label="用哪种方式渲染">
                <template #label-extra><am-explain-tip term="渲染" /></template>
                <am-options :options="modeOptions" :model-value="answers.renderMode" :cols="3" compact @update:model-value="set('renderMode', $event)" />
                <div class="am-modecard">
                    <p class="am-modecard__desc">{{ currentMode.desc }}</p>
                    <p class="am-modecard__caveat"><b>要注意</b>：{{ currentMode.caveat }}</p>
                    <p class="am-modecard__good">适合：{{ currentMode.good.join('、') }}</p>
                </div>
            </am-field>

            <am-field label="希望对方是个什么样的工程师（可以不填）" hint="这句会放在提示词开头，影响 AI 的写码风格">
                <am-input :model-value="answers.engineerStyle" @update:model-value="set('engineerStyle', $event)" placeholder="比如：严谨、注重细节、不留半成品" />
            </am-field>
        </div>
    `,
};

/** 主色快选：覆盖常见色相，用户不想开取色器时点一下就行 */
const ACCENT_PRESETS = ['#007aff', '#ff69b4', '#00ff9d', '#ff6b35', '#6750a4', '#2ec27e', '#f5b301', '#e53935'];

const StepVisual = {
    name: 'StepVisual',
    components: { ...UI_COMPONENTS },
    props: { answers: { type: Object, required: true } },
    computed: {
        styles() { return DESIGN_STYLES; },
        radiusOptions() { return RADIUS_OPTIONS; },
        elevationOptions() { return ELEVATION_OPTIONS; },
        densityOptions() { return DENSITY_OPTIONS; },
        accentPresets() { return ACCENT_PRESETS; },
        /** 当前配色自带的主色，用作占位提示和取色器的初值 */
        presetAccent() {
            return (DESIGN_STYLES.find((s) => s.value === this.answers.style) || DESIGN_STYLES[0]).prim;
        },
        accentValue() {
            const v = String(this.answers.accentColor || '').trim();
            // <input type="color"> 只认 #rrggbb，别的格式给它会被重置成黑色
            return /^#[0-9a-f]{6}$/i.test(v) ? v : this.presetAccent;
        },
    },
    methods: {
        set(field, value) { store.setAnswer(field, value); },
    },
    template: `
        <div class="am-step">
            <am-field label="配色" hint="点一张卡看效果。它会决定背景、卡片、主色、状态栏和桌面图标底色。">
                <div class="am-styles">
                    <button
                        v-for="s in styles" :key="s.value"
                        type="button" class="am-style"
                        :class="{ 'is-on': answers.style === s.value }"
                        @click="set('style', s.value)"
                    >
                        <span class="am-style__box" :style="{ background: s.bg }">
                            <span class="am-style__card" :style="{ background: s.card }"></span>
                            <span class="am-style__btn" :style="{ background: s.prim }"></span>
                        </span>
                        <span class="am-style__name">{{ s.title }}</span>
                        <span class="am-style__desc">{{ s.desc }}</span>
                    </button>
                </div>
            </am-field>

            <am-field label="主色" hint="按钮、选中态、进度条都用它。留空就跟着上面那套配色走。">
                <div class="am-accent">
                    <input
                        type="color" class="am-accent__picker"
                        :value="accentValue"
                        @input="set('accentColor', $event.target.value)"
                    />
                    <am-input
                        class="am-accent__text"
                        :model-value="answers.accentColor || ''"
                        placeholder="跟随配色（当前 {{ presetAccent }}）"
                        :maxlength="24"
                        @update:model-value="set('accentColor', $event)"
                    />
                    <button
                        v-if="answers.accentColor" type="button" class="am-accent__reset"
                        @click="set('accentColor', '')"
                    >还原</button>
                </div>
                <div class="am-accent__swatches">
                    <button
                        v-for="c in accentPresets" :key="c"
                        type="button" class="am-accent__swatch"
                        :class="{ 'is-on': (answers.accentColor || '').toLowerCase() === c }"
                        :style="{ background: c }"
                        @click="set('accentColor', c)"
                    ></button>
                </div>
            </am-field>

            <am-field label="间距" hint="卡片内部的留白和卡片之间的距离。内容多选紧凑，内容少选宽松。">
                <am-options :options="densityOptions" :model-value="answers.density" :cols="3" compact @update:model-value="set('density', $event)" />
            </am-field>

            <am-field label="圆角">
                <am-options :options="radiusOptions" :model-value="answers.radius" :cols="3" compact @update:model-value="set('radius', $event)" />
            </am-field>

            <am-field label="阴影">
                <am-options :options="elevationOptions" :model-value="answers.elevation" :cols="2" compact @update:model-value="set('elevation', $event)" />
            </am-field>
        </div>
    `,
};

const StepTopbar = {
    name: 'StepTopbar',
    components: { ...UI_COMPONENTS, AmExplainTip },
    props: { answers: { type: Object, required: true } },
    computed: {
        types() { return TOPBAR_TYPES; },
        leftOptions() { return TOPBAR_LEFT_ACTIONS; },
        rightOptions() { return TOPBAR_RIGHT_ACTIONS; },
        buttonOptions() { return TOPBAR_BUTTON_ACTIONS; },
        hidden() { return this.answers.topbarType === 'none'; },
        buttonsOnly() { return this.answers.topbarType === 'buttons-only'; },
    },
    methods: {
        set(field, value) { store.setAnswer(field, value); },
        toggleRight(v) { store.toggleAnswer('topbarRight', v, 3); },
        toggleButton(v) { store.toggleAnswer('topbarButtons', v, 5); },
    },
    template: `
        <div class="am-step">
            <am-field label="顶栏样式">
                <template #label-extra><am-explain-tip term="导航栏" /></template>
                <am-options :options="types" :model-value="answers.topbarType" :cols="2" @update:model-value="set('topbarType', $event)" />
            </am-field>

            <template v-if="buttonsOnly">
                <am-field label="放哪几个按钮" hint="最多 5 个，会平分整条顶栏的宽度。">
                    <am-options :options="buttonOptions" :model-value="answers.topbarButtons" multiple :cols="3" compact @update:model-value="() => {}" @pick="toggleButton" />
                    <am-chips :items="answers.topbarButtons" empty="还没选按钮" />
                </am-field>

                <am-field label="按钮下面写字">
                    <am-switch
                        :model-value="answers.topbarButtonLabels"
                        label="图标下面显示按钮名"
                        desc="关掉就只剩一排圆形图标钮，更紧凑，但用户要猜图标含义"
                        @update:model-value="set('topbarButtonLabels', $event)"
                    />
                </am-field>

                <am-note v-if="!answers.topbarButtons.length" tone="warn">
                    一个按钮都没选的话，这条顶栏会是空的 —— 那还不如选「不要顶栏」。
                </am-note>
                <am-note v-else-if="answers.topbarButtons.length >= 5" tone="warn">
                    五个是上限。再多每个按钮就窄到点不准了。
                </am-note>
                <am-note tone="info">
                    纯按钮组不放标题：这类工具型 App 里标题是废像素，用户要的是一眼看到能做哪几件事。
                    按钮点击会调 <code>topbarAction({ id })</code>，在生成的代码里按 id 分支写逻辑。
                </am-note>
            </template>

            <template v-else-if="!hidden">
                <am-field label="左边放什么" hint="主页面一般不放返回；有侧边分类的话放菜单。">
                    <am-options :options="leftOptions" :model-value="answers.topbarLeft" :cols="3" compact @update:model-value="set('topbarLeft', $event)" />
                </am-field>

                <am-field label="右边放什么按钮" hint="最多 3 个。再多手指点不准，而且标题会被挤没。">
                    <am-options :options="rightOptions" :model-value="answers.topbarRight" multiple :cols="3" compact @update:model-value="() => {}" @pick="toggleRight" />
                    <am-chips :items="answers.topbarRight" empty="右边不放按钮" />
                </am-field>

                <am-note v-if="answers.topbarRight.length >= 3" tone="warn">
                    三个按钮已经是上限了。顶栏总宽就那么多，再加标题会被挤成省略号。
                </am-note>
            </template>

            <am-field v-if="answers.topbarType !== 'search' && !buttonsOnly" label="页面里要不要单独放搜索框">
                <am-switch
                    :model-value="answers.topbarSearchInPage"
                    label="内容区顶部放一个搜索框"
                    desc="和顶栏搜索的区别：这个会跟着页面一起滚走，顶栏那个固定不动"
                    @update:model-value="set('topbarSearchInPage', $event)"
                />
            </am-field>

            <am-note tone="info">
                顶栏背景会保持透明。这是绕开框架的一个已知问题：设成实色时状态栏会悬浮在顶栏上方，形成一道视觉断层。
            </am-note>
        </div>
    `,
};

const StepTabbar = {
    name: 'StepTabbar',
    components: { ...UI_COMPONENTS, AmExplainTip },
    props: { answers: { type: Object, required: true } },
    computed: {
        types() { return TABBAR_TYPES; },
        fabOptions() { return FAB_POSITIONS; },
        pageCount() { return this.answers.pages.length; },
        singlePage() { return this.pageCount <= 1; },
    },
    methods: {
        set(field, value) { store.setAnswer(field, value); },
    },
    template: `
        <div class="am-step">
            <am-note v-if="singlePage" tone="info">
                现在只有一个主页面，底栏会自动关掉 —— 一个 tab 的 tab 栏纯粹占地方。
                想要底栏的话，去上一步「有几个主页面」加一页。
            </am-note>

            <am-field label="底栏样式">
                <template #label-extra><am-explain-tip term="标签栏" /></template>
                <am-options :options="types" :model-value="answers.tabbarType" :cols="2" @update:model-value="set('tabbarType', $event)" />
            </am-field>

            <am-field v-if="answers.tabbarType !== 'none' && answers.tabbarType !== 'minimal'" label="显示文字">
                <am-switch
                    :model-value="answers.tabbarShowLabels"
                    label="图标下面显示页面名"
                    desc="关掉就只剩图标。tab 超过 4 个时关掉会好看一些，但用户要猜图标含义"
                    @update:model-value="set('tabbarShowLabels', $event)"
                />
            </am-field>

            <am-field label="要不要浮动主按钮" hint="就是右下角那颗圆形按钮，用来做「新建」这类最主要的操作。">
                <template #label-extra><am-explain-tip term="悬浮按钮" /></template>
                <am-options :options="fabOptions" :model-value="answers.fabPosition" :cols="2" compact @update:model-value="set('fabPosition', $event)" />
            </am-field>

            <am-field v-if="answers.fabPosition !== 'none'" label="按钮上写什么">
                <am-input :model-value="answers.fabLabel" @update:model-value="set('fabLabel', $event)" placeholder="新建" :maxlength="6" />
            </am-field>

            <am-note v-if="answers.fabPosition === 'bottom-center' && answers.tabbarType !== 'none'" tone="warn">
                底部居中的浮动按钮会正好压在中间那个 tab 上，两个都不好点。建议改成右下角。
            </am-note>

            <am-note tone="info">
                浮动按钮的底部距离会自动加上 <code>--app-safe-bottom</code>，不会压住 home 指示条。
            </am-note>
        </div>
    `,
};

/** 单页配置卡。页面这道题最复杂，单独成组件。 */
const PageCard = {
    name: 'PageCard',
    components: { ...UI_COMPONENTS, AmExplainTip },
    props: {
        page: { type: Object, required: true },
        index: { type: Number, default: 0 },
        total: { type: Number, default: 1 },
        expanded: { type: Boolean, default: false },
    },
    emits: ['toggle', 'remove', 'move', 'focus'],
    computed: {
        icons() { return ICONS; },
        layouts() { return PAGE_LAYOUTS; },
        cardTypes() { return CARD_TYPES; },
        cardFields() { return CARD_FIELDS; },
        subpageOptions() { return SUBPAGE_TEMPLATES; },
        densities() { return DENSITY_OPTIONS; },
        layoutInfo() { return PAGE_LAYOUTS.find((l) => l.value === this.page.layout) || PAGE_LAYOUTS[0]; },
        summary() {
            const cards = this.page.cards.map((c) => (CARD_TYPES.find((t) => t.value === c) || {}).title).filter(Boolean);
            return `${this.layoutInfo.title} · ${cards.join('/') || '未选卡片'} · ${this.page.subpages.length} 个子页面`;
        },
    },
    methods: {
        setField(field, value) { store.setPageField(this.page.key, field, value); },
        toggleArr(field, value) { store.togglePageArray(this.page.key, field, value); },
    },
    template: `
        <div class="am-pagecard" :class="{ 'is-open': expanded }">
            <button type="button" class="am-pagecard__head" @click="$emit('toggle')">
                <span class="am-pagecard__idx">{{ index + 1 }}</span>
                <span class="am-pagecard__main">
                    <span class="am-pagecard__name">{{ page.name || '未命名页面' }}</span>
                    <span class="am-pagecard__sum">{{ summary }}</span>
                </span>
                <span class="am-pagecard__chev" aria-hidden="true" v-html="icons.chevronDown"></span>
            </button>

            <div v-if="expanded" class="am-pagecard__body">
                <div class="am-pagecard__tools">
                    <button type="button" :disabled="index === 0" @click="$emit('move', -1)">上移</button>
                    <button type="button" :disabled="index === total - 1" @click="$emit('move', 1)">下移</button>
                    <button type="button" class="is-danger" :disabled="total <= 1" @click="$emit('remove')">删除这一页</button>
                </div>

                <am-field label="页面名" hint="会显示在底部 tab 上，两个字最好看">
                    <am-input :model-value="page.name" @update:model-value="setField('name', $event)" :maxlength="6" placeholder="首页" />
                </am-field>

                <am-field label="这一页是干嘛的">
                    <am-input :model-value="page.desc" @update:model-value="setField('desc', $event)" placeholder="比如：今天记录的内容" />
                </am-field>

                <am-field label="内容怎么排">
                    <template #label-extra><am-explain-tip term="瀑布流" label="瀑布流是什么" /></template>
                    <am-options :options="layouts" :model-value="page.layout" :cols="2" @update:model-value="setField('layout', $event)" />
                    <p v-if="layoutInfo.hint" class="am-field__derived">{{ layoutInfo.hint }}</p>
                </am-field>

                <am-field label="用什么卡片" hint="可以多选。选两种以上时会依次铺开，方便对比。">
                    <template #label-extra><am-explain-tip term="卡片流" /></template>
                    <am-options :options="cardTypes" :model-value="page.cards" multiple :cols="2" compact @pick="toggleArr('cards', $event)" @update:model-value="() => {}" />
                </am-field>

                <am-field label="卡片上显示哪些信息" hint="这一项直接决定卡片的信息密度。勾得越多，一屏能放的条数越少。">
                    <am-options :options="cardFields" :model-value="page.cardFields" multiple :cols="3" compact @pick="toggleArr('cardFields', $event)" @update:model-value="() => {}" />
                </am-field>

                <am-field label="这一页的间距" hint="不设就跟随全局。列表页通常要比首页紧一些。">
                    <am-options :options="densities" :model-value="page.density" :cols="3" compact @update:model-value="setField('density', $event)" />
                </am-field>

                <am-field label="页内搜索">
                    <am-switch :model-value="page.hasSearch" label="内容区顶部放搜索框" @update:model-value="setField('hasSearch', $event)" />
                </am-field>

                <am-field label="从这一页能进到哪些子页面" hint="子页面不占底部 tab，是从这一页点进去的二级页面。">
                    <am-options :options="subpageOptions" :model-value="page.subpages" multiple :cols="2" compact @pick="toggleArr('subpages', $event)" @update:model-value="() => {}" />
                </am-field>

                <am-field label="没有内容时显示什么">
                    <am-input :model-value="page.emptyText" @update:model-value="setField('emptyText', $event)" placeholder="还没有内容" />
                </am-field>
            </div>
        </div>
    `,
};

const StepPages = {
    name: 'StepPages',
    components: { ...UI_COMPONENTS, PageCard },
    props: { answers: { type: Object, required: true } },
    emits: ['focus-page'],
    data() {
        return { openKey: '' };
    },
    computed: {
        icons() { return ICONS; },
        presets() { return PAGE_PRESETS.map((p) => ({ value: p.value, title: p.title, desc: p.desc })); },
        canAdd() { return this.answers.pages.length < 5; },
    },
    mounted() {
        if (!this.openKey && this.answers.pages.length) this.openKey = this.answers.pages[0].key;
    },
    methods: {
        applyPreset(v) {
            store.applyPagePreset(v);
            this.openKey = this.answers.pages[0]?.key || '';
        },
        toggle(page) {
            this.openKey = this.openKey === page.key ? '' : page.key;
            if (this.openKey) this.$emit('focus-page', page.key);
        },
        add() {
            if (store.addPage()) {
                const last = this.answers.pages[this.answers.pages.length - 1];
                this.openKey = last.key;
                store.setAnswer('pagePreset', 'custom');
            }
        },
        remove(page) {
            if (store.removePage(page.key)) {
                this.openKey = this.answers.pages[0]?.key || '';
                store.setAnswer('pagePreset', 'custom');
            }
        },
        move(page, delta) {
            store.movePage(page.key, delta);
            store.setAnswer('pagePreset', 'custom');
        },
    },
    template: `
        <div class="am-step">
            <am-field label="先挑一个起点" hint="挑完还能逐页改。选「自己定」从一页开始加。">
                <am-options :options="presets" :model-value="answers.pagePreset" :cols="2" compact @update:model-value="applyPreset" />
            </am-field>

            <am-field :label="'主页面（' + answers.pages.length + ' 个）'" hint="点一页展开细调。底部 tab 的顺序就是这里的顺序。">
                <page-card
                    v-for="(p, i) in answers.pages" :key="p.key"
                    :page="p" :index="i" :total="answers.pages.length"
                    :expanded="openKey === p.key"
                    @toggle="toggle(p)"
                    @remove="remove(p)"
                    @move="move(p, $event)"
                />
                <button v-if="canAdd" type="button" class="am-addpage" @click="add">
                    <span v-html="icons.plus"></span>再加一页
                </button>
                <am-note v-else tone="warn">
                    最多 5 个主页面。再多的话底部 tab 会挤到图标和文字叠在一起 —— 次要的内容改成子页面更合适。
                </am-note>
            </am-field>
        </div>
    `,
};

const StepParts = {
    name: 'StepParts',
    components: { ...UI_COMPONENTS, AmExplainTip },
    props: { answers: { type: Object, required: true } },
    computed: {
        modalOptions() { return MODAL_CHOICES; },
        islandOptions() { return ISLAND_CHOICES; },
        widgetOptions() { return WIDGET_CHOICES; },
        sizeOptions() { return WIDGET_SIZES; },
        sustainedPicked() {
            return ISLAND_CHOICES.filter((i) => i.sustained && this.answers.islands.includes(i.value));
        },
    },
    methods: {
        toggle(field, v) { store.toggleAnswer(field, v); },
    },
    template: `
        <div class="am-step">
            <am-note tone="info">
                这一段选的都是<b>框架已经做好的</b>组件。选中之后，生成的白膜里它们是真能弹、真能点的，
                不用等 AI 再实现一遍。
            </am-note>

            <am-field label="要用到哪些弹窗">
                <template #label-extra><am-explain-tip term="弹窗" /></template>
                <am-options :options="modalOptions" :model-value="answers.modals" multiple :cols="2" @pick="toggle('modals', $event)" @update:model-value="() => {}" />
            </am-field>

            <am-field label="灵动岛会在什么时候弹" hint="就是屏幕顶部那颗黑色胶囊。">
                <template #label-extra><am-explain-tip term="灵动岛" /></template>
                <am-options :options="islandOptions" :model-value="answers.islands" multiple :cols="2" @pick="toggle('islands', $event)" @update:model-value="() => {}" />
            </am-field>

            <am-note v-if="sustainedPicked.length" tone="warn">
                {{ sustainedPicked.map(i => i.title).join('、') }} 属于「还在进行中的活动」。
                这类岛会自动带上 <code>minSize: 'mini'</code> —— 否则用户在别的 App 里随手点三下就把它点没了，
                而任务还在后台跑着。
            </am-note>

            <am-field label="桌面小组件" hint="长按桌面能添加的那种卡片。不确定就先不选，之后随时能加。">
                <template #label-extra><am-explain-tip term="小组件" /></template>
                <am-options :options="widgetOptions" :model-value="answers.widgets" multiple :cols="2" compact @pick="toggle('widgets', $event)" @update:model-value="() => {}" />
            </am-field>

            <am-field v-if="answers.widgets.length" label="小组件尺寸" hint="S 只够放一个数字，L 才铺得开列表。">
                <am-options :options="sizeOptions" :model-value="answers.widgetSizes" multiple :cols="3" compact @pick="toggle('widgetSizes', $event)" @update:model-value="() => {}" />
            </am-field>
        </div>
    `,
};

const StepData = {
    name: 'StepData',
    components: { ...UI_COMPONENTS, AmExplainTip },
    props: { answers: { type: Object, required: true } },
    computed: {
        capabilityOptions() { return CAPABILITIES; },
        readOptions() { return SYSTEM_READS; },
        storeOptions() { return STORE_PRESETS; },
        needsDb() { return this.answers.capabilities.includes('db'); },
        needsAi() { return this.answers.capabilities.includes('ai'); },
    },
    methods: {
        toggle(field, v) { store.toggleAnswer(field, v); },
    },
    template: `
        <div class="am-step">
            <am-field label="这个 App 要会做什么">
                <am-options :options="capabilityOptions" :model-value="answers.capabilities" multiple :cols="2" compact @pick="toggle('capabilities', $event)" @update:model-value="() => {}" />
            </am-field>

            <template v-if="needsDb">
                <am-field label="要存哪几类东西" hint="每一类是一张表。分开存比全塞一张表好维护。">
                    <template #label-extra><am-explain-tip term="数据表" /></template>
                    <am-options :options="storeOptions" :model-value="answers.stores" multiple :cols="2" compact @pick="toggle('stores', $event)" @update:model-value="() => {}" />
                </am-field>
                <am-note tone="info">
                    声明了数据表，注册时必须走异步路径 —— 生成的代码和提示词里都会写清楚这一点。
                    同步注册的话表根本没建出来，保存会静默失败（表现是「显示保存成功，刷新就没了」）。
                </am-note>
            </template>

            <am-note v-if="!needsDb && answers.stores.length" tone="warn">
                选了数据表但没勾「本地存储」，这些表会被声明出来却没人用。
            </am-note>

            <am-field label="要读系统里已有的数据吗" hint="人设、世界观、Prompt 库这些是全局共享的。">
                <am-options :options="readOptions" :model-value="answers.systemReads" multiple :cols="2" compact @pick="toggle('systemReads', $event)" @update:model-value="() => {}" />
            </am-field>

            <am-note v-if="needsAi" tone="info">
                勾了 AI 对话。生成的代码会按「用户卡绑定的 API → 第一个可用的 Key」这个顺序自动选，
                并且在一个都没有时给出「去设置 → API 管理加一个」的明确提示。
            </am-note>
        </div>
    `,
};

const StepCross = {
    name: 'StepCross',
    components: { ...UI_COMPONENTS },
    props: { answers: { type: Object, required: true } },
    computed: {
        options() { return CROSS_APP; },
        picked() { return CROSS_APP.filter((c) => this.answers.crossApp.includes(c.value)); },
    },
    methods: {
        toggle(v) { store.toggleAnswer('crossApp', v); },
        set(field, value) { store.setAnswer(field, value); },
    },
    template: `
        <div class="am-step">
            <am-note tone="info">
                这一段决定你的 App 要不要「接进系统的其他部分」。全都不选也能用，
                只是它会是个孤岛：AI 不知道它存在，人设里也没有它的位置。
            </am-note>

            <am-field label="要接哪些">
                <am-options :options="options" :model-value="answers.crossApp" multiple :cols="1" @pick="toggle" @update:model-value="() => {}" />
            </am-field>

            <div v-for="c in picked" :key="c.value" class="am-crossdetail">
                <div class="am-crossdetail__title">{{ c.title }}</div>
                <p class="am-crossdetail__text">{{ c.detail }}</p>
            </div>

            <am-field label="还有什么要交代的（可以不填）" hint="这段会原样附在提示词末尾">
                <am-textarea :model-value="answers.extraNotes" @update:model-value="set('extraNotes', $event)" :rows="4" placeholder="比如：动效要克制一点；文案用口语；先不做导出功能……" />
            </am-field>
        </div>
    `,
};

const StepReview = {
    name: 'StepReview',
    components: { ...UI_COMPONENTS },
    props: { answers: { type: Object, required: true } },
    emits: ['goto'],
    computed: {
        icons() { return ICONS; },
        bp() { return buildBlueprint(this.answers); },
        review() { return reviewBlueprint(this.bp); },
        rows() {
            const b = this.bp;
            return [
                { k: '名字', v: b.appName, step: 0 },
                { k: 'App ID', v: b.appId, step: 0 },
                { k: '渲染方式', v: b.renderModeInfo?.title || b.renderMode, step: 0 },
                { k: '配色', v: `${b.style.title} · 圆角${b.radius} · 间距${b.padding}px`, step: 1 },
                { k: '顶栏', v: b.topbar.visible ? `${b.topbar.title}${b.topbar.right.length ? ` · ${b.topbar.right.length} 个按钮` : ''}` : '不要', step: 2 },
                { k: '底栏', v: b.tabbar.visible ? b.tabbar.title : '不要', step: 3 },
                { k: '浮动按钮', v: b.fab.visible ? `${b.fab.position} · ${b.fab.label}` : '不要', step: 3 },
                { k: '主页面', v: `${b.pages.length} 个：${b.pages.map((p) => p.name).join('、')}`, step: 4 },
                { k: '子页面', v: `${b.pages.reduce((n, p) => n + p.subpages.length, 0)} 个`, step: 4 },
                { k: '弹窗', v: b.modals.map((m) => m.title).join('、') || '不用', step: 5 },
                { k: '灵动岛', v: b.islands.map((i) => i.title).join('、') || '不用', step: 5 },
                { k: '小组件', v: b.widgets.map((w) => w.title).join('、') || '不用', step: 5 },
                { k: '能力', v: b.capabilities.map((c) => c.title).join('、') || '无', step: 6 },
                { k: '数据表', v: b.stores.map((s) => s.name).join('、') || '不存', step: 6 },
                { k: '读系统数据', v: b.systemReads.map((r) => r.title).join('、') || '不读', step: 6 },
                { k: '跨 App', v: b.crossApp.map((c) => c.title).join('、') || '无', step: 7 },
            ];
        },
    },
    template: `
        <div class="am-step">
            <div v-if="review.blockers.length" class="am-review am-review--block">
                <div class="am-review__title"><span v-html="icons.warn"></span>这几项会让 App 装不上，得先改</div>
                <p v-for="(b, i) in review.blockers" :key="i" class="am-review__item">{{ b }}</p>
            </div>
            <div v-if="review.warnings.length" class="am-review am-review--warn">
                <div class="am-review__title"><span v-html="icons.info"></span>这几项能跑，但可能不是你想要的</div>
                <p v-for="(w, i) in review.warnings" :key="i" class="am-review__item">{{ w }}</p>
            </div>
            <div v-if="!review.blockers.length && !review.warnings.length" class="am-review am-review--ok">
                <div class="am-review__title"><span v-html="icons.check"></span>检查通过，没发现问题</div>
            </div>

            <div class="am-summary">
                <button
                    v-for="r in rows" :key="r.k"
                    type="button" class="am-summary__row"
                    @click="$emit('goto', r.step)"
                >
                    <span class="am-summary__k">{{ r.k }}</span>
                    <span class="am-summary__v">{{ r.v }}</span>
                    <span class="am-summary__edit" aria-hidden="true" v-html="icons.chevronRight"></span>
                </button>
            </div>
        </div>
    `,
};

// ---------------------------------------------------------------------------

export const AmSurvey = {
    name: 'AmSurvey',
    components: {
        ...UI_COMPONENTS,
        AmPreview,
        StepBasic, StepVisual, StepTopbar, StepTabbar, StepPages, StepParts, StepData, StepCross, StepReview,
    },
    props: {
        state: { type: Object, required: true },
    },
    emits: ['generate'],
    computed: {
        icons() { return ICONS; },
        steps() { return STEPS; },
        step() { return Math.min(this.state.step, STEPS.length - 1); },
        current() { return STEPS[this.step]; },
        isLast() { return this.step === STEPS.length - 1; },
        /** 这几段看不出预览的变化，展开预览只会占地方 */
        showPreview() {
            return this.state.previewOpen && ['visual', 'topbar', 'tabbar', 'pages'].includes(this.current.id);
        },
        canPreview() {
            return ['visual', 'topbar', 'tabbar', 'pages'].includes(this.current.id);
        },
        stepComponent() {
            return {
                basic: 'step-basic', visual: 'step-visual', topbar: 'step-topbar',
                tabbar: 'step-tabbar', pages: 'step-pages', parts: 'step-parts',
                data: 'step-data', cross: 'step-cross', review: 'step-review',
            }[this.current.id];
        },
    },
    methods: {
        go(n) {
            store.setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
            // 换段时滚回顶部，否则上一段滚到底的位置会被带过来
            this.$nextTick(() => {
                const el = this.$refs.scroll;
                if (el) el.scrollTop = 0;
            });
        },
        togglePreview() { this.state.previewOpen = !this.state.previewOpen; },
        onFocusPage(key) { this.state.previewPageKey = key; },
    },
    template: `
        <div class="am-survey">
            <div class="am-survey__bar">
                <div class="am-survey__steps">
                    <button
                        v-for="(s, i) in steps" :key="s.id"
                        type="button"
                        class="am-survey__dot"
                        :class="{ 'is-on': i === step, 'is-done': i < step }"
                        :title="s.title"
                        :aria-label="'第 ' + (i + 1) + ' 步：' + s.title"
                        @click="go(i)"
                    ></button>
                </div>
            </div>

            <div class="am-survey__scroll" ref="scroll">
                <am-section-head :index="step + 1" :total="steps.length" :title="current.title" :desc="current.desc" />

                <div v-if="canPreview" class="am-previewslot">
                    <div class="am-previewslot__bar">
                        <span class="am-previewslot__label">实时预览</span>
                        <button type="button" class="am-previewslot__act" @click="togglePreview">
                            <span v-html="state.previewOpen ? icons.chevronUp : icons.chevronDown"></span>
                            {{ state.previewOpen ? '收起' : '展开' }}
                        </button>
                    </div>
                    <am-preview
                        v-if="showPreview"
                        :answers="state.answers"
                        :page-key="state.previewPageKey"
                        :focus="current.focus"
                        @pick-page="onFocusPage"
                    />
                </div>

                <component
                    :is="stepComponent"
                    :answers="state.answers"
                    @focus-page="onFocusPage"
                    @goto="go"
                />
            </div>

            <div class="am-survey__foot">
                <button
                    type="button" class="am-btn am-btn--ghost am-btn--icon"
                    :disabled="step === 0" aria-label="上一步"
                    @click="go(step - 1)"
                    v-html="icons.chevronLeft"
                ></button>
                <button v-if="!isLast" type="button" class="am-btn am-btn--primary" @click="go(step + 1)">
                    下一步 · {{ steps[step + 1].title }}
                </button>
                <button v-else type="button" class="am-btn am-btn--primary" @click="$emit('generate')">生成白膜和提示词</button>
            </div>
        </div>
    `,
};
