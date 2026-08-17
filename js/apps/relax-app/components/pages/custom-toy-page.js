/**
 * relax-app / 「我的捏捏」编辑页
 *
 * ============================================================
 * 为什么是页面不是弹窗
 * ============================================================
 * 这里要同时装下:问卷、提示词、粘贴回填、两个代码编辑器、一块实时预览。
 * 塞进 380px 宽的弹窗里,每一块都只剩两三行,写代码的地方比手机键盘还小。
 * 改成整屏页面之后,编辑器能给到 10 行以上,预览能按真实行列画。
 *
 * ============================================================
 * 三种做法(layout)
 * ============================================================
 *   grid —— 只写一格,板子复制 rows×cols 份。气泡纸那种。
 *   free —— 整块画一个东西,交互靠 data-hb 零件。摇杆、鼠标那种。
 *   code —— HTML + CSS + JS 全放开,跑在沙箱 iframe 里。想做什么做什么。
 *
 * ★ 三种做法各留一份草稿(drafts)
 *   来回切的时候把当前代码存进 drafts、再把另一份读出来。
 *   不这么做的话,用户从格子切到自由、发现不合适再切回来,
 *   刚写的一格代码已经被自由模式的默认模板覆盖没了。
 *   store 那边只存**最后应用的那一套**,所以草稿只活在这一页里。
 *
 * ★ 预览是**真能玩的**,三种做法都是
 *   摇杆拖不拖得动、弹球甩不甩得出去,光看静态图完全判断不了。
 *   free 挂的是和主体同一个零件引擎(services/toy-parts.js),
 *   code 挂的是和主体同一个沙箱(services/toy-sandbox.js) ——
 *   同一份运行时,不会出现「预览里好好的、放上舞台不动」。
 *   只是没有声音:音色是舞台那边的状态,页面里读不到,
 *   硬接一份反而会出现「预览的声音和舞台上不一样」。
 *
 * ★ code 模式的报错要显示出来
 *   写 JS 一定会写错。沙箱里的异常靠 postMessage 送回来,
 *   直接摆在预览下面 —— 不然用户只能看着一块空白猜。
 *
 * ★ 它不是 framework 的 page
 *   解压角只有一个框架页(stage),导航全靠自己的状态。所以这一页由
 *   relax-root 的 `view` 切换,舞台在底下**继续挂着** ——
 *   回去的时候主体不重挂,已经捏爆的格子(popped)不会被重置。
 *
 * ★ 层级
 *   页面根节点 z-index 5,低于框架的 `.app-bottom`(z-index 6)。
 *   底部动作条再用 var(--app-safe-bottom) 让开 home 指示条,
 *   两条一起保证「编辑页开着也能划出去退出 App」。
 *
 * ★ 数据只出不进
 *   页面里的 html / css / blueprint 都是本地副本,点「应用到主体」才 emit 出去。
 *   中途返回会先问一句,不静默丢改动。
 */

import {
    DEFAULT_HTML_TEMPLATES,
    FREE_HTML_TEMPLATES,
    CODE_HTML_TEMPLATES,
    getDefaultTemplateById,
} from '../../toys/custom-html-board.js';
import {
    TOY_SHAPES,
    TOY_FEELS,
    TOY_PALETTES,
    TOY_MOTIONS,
    TOY_MOVES,
    TOY_LAYOUTS,
    TOY_BLUEPRINT_PRESETS,
    TOY_PART_GUIDE,
    TOY_PART_ATTRS,
    buildCustomToyPrompt,
    createToyBlueprint,
    normalizeToyBlueprint,
    normalizeToyLayout,
    splitAiReply,
    sanitizeToyTemplate,
} from '../../services/toy-prompt.js';
import { createToyParts } from '../../services/toy-parts.js';
import { createToySandbox } from '../../services/toy-sandbox.js';
import { haptic } from '../../services/sound-service.js';
import { ICON_CHEVRON_LEFT, ICON_CHECK } from '../icons.js';

/** 预览重画的防抖。边打字边重排 144 格会明显卡手。 */
const PREVIEW_DEBOUNCE_MS = 260;
/** 「已复制」状态自己退回去的时间,抄 app-maker 的 2s。 */
const COPIED_RESET_MS = 2000;

/** 每格的随机倾斜 / 圆角要**稳定**,不然每次重渲染整块板都在抖 */
function pseudoRandom(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function clampGrid(value, fallback) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(12, Math.max(2, num));
}

/**
 * 沙箱里 hb 的速查表。
 * ★ 和 services/toy-sandbox.js 里真实提供的 API 一一对应,
 *   也和 toy-prompt 的 partBridgeCode 说的是同一套。改一处记得三处一起改。
 */
const BRIDGE_GUIDE = Object.freeze([
    { api: 'hb.el', desc: '你的容器(#stage)。DOM 挂它上面,已经铺满画布了。' },
    { api: 'hb.width / hb.height / hb.unit', desc: '画布当前尺寸。unit 是短边,按比例算大小时用它。' },
    { api: 'hb.tint', desc: '用户选的主题色。CSS 里也能用 var(--tint)。' },
    { api: 'hb.sound({ rate })', desc: '播一次用户在「音声」里选的音。rate 是音调,1 是原声。一秒最多 24 声。' },
    { api: "hb.haptic('light' | 'medium' | 'heavy')", desc: '震动。' },
    { api: 'hb.notify(标题, 内容)', desc: '走手机顶上的灵动岛。别频繁调。' },
    { api: 'hb.state', desc: '存档对象,一进来就有值。第一次玩是空的,记得给默认值。' },
    { api: 'hb.save({ 键: 值 })', desc: '写存档,浅合并 + 自动防抖。只能存 JSON 存得下的东西。' },
    { api: "hb.on('resize', fn)", desc: '画布尺寸变了。用 canvas 的话在这里重设宽高。' },
    { api: "hb.on('tint', fn)", desc: '用户换了主题色,参数是新的 hex。' },
]);

/** 某种做法的出厂草稿(第一套内置模板) */
function defaultDraft(layout) {
    const template = getDefaultTemplateById(null, layout);
    return {
        html: template.html,
        css: template.css,
        js: template.js || '',
        templateId: template.id,
    };
}

export const RxCustomToyPage = {
    name: 'RxCustomToyPage',
    props: {
        initialHtml: { type: String, default: '' },
        initialCss: { type: String, default: '' },
        /** 只有「写代码」那一档有 */
        initialJs: { type: String, default: '' },
        initialTemplateId: { type: String, default: '' },
        /** 老存档里没有这个字段 → 空 → 按格子模式走 */
        initialLayout: { type: String, default: 'grid' },
        /** 老存档里没有这个字段 → null → 走空白蓝图 */
        initialBlueprint: { type: Object, default: null },
        rows: { type: Number, default: 4 },
        cols: { type: Number, default: 4 },
        tint: { type: String, default: '#ffd6e0' },
    },
    emits: ['request-close', 'apply'],
    data() {
        const layout = normalizeToyLayout(this.initialLayout);
        const fallback = getDefaultTemplateById(this.initialTemplateId, layout);
        const templateId = this.initialTemplateId || fallback.id;
        const html = this.initialHtml || fallback.html;
        const css = this.initialCss || fallback.css;
        const js = this.initialJs || fallback.js || '';
        const current = { html, css, js, templateId };

        return {
            pane: 'code',                 // code | ai
            layout,
            layouts: TOY_LAYOUTS,
            // 其他两种做法先放出厂草稿;真正被编辑过的那份在 switchLayout 里换进来
            drafts: {
                grid: layout === 'grid' ? current : defaultDraft('grid'),
                free: layout === 'free' ? current : defaultDraft('free'),
                code: layout === 'code' ? current : defaultDraft('code'),
            },
            activeTemplateId: templateId,
            html,
            css,
            js,
            blueprint: normalizeToyBlueprint(this.initialBlueprint),
            blueprintPresets: TOY_BLUEPRINT_PRESETS,
            shapes: TOY_SHAPES,
            feels: TOY_FEELS,
            palettes: TOY_PALETTES,
            motions: TOY_MOTIONS,
            moves: TOY_MOVES,
            partGuide: TOY_PART_GUIDE,
            partAttrs: TOY_PART_ATTRS,
            bridgeGuide: BRIDGE_GUIDE,

            // 预览是防抖后的副本,不直接绑 html / css
            previewHtml: html,
            previewCss: css,
            previewPressed: false,
            /** 自由模式:这段 HTML 里扫到几个零件。0 就是「能看不能玩」 */
            previewPartCount: 0,
            /** 写代码模式:沙箱里抛出来的错,直接摆给用户看 */
            codeError: '',

            // 粘贴回填
            pastedText: '',
            pasteMessage: '',
            pasteOk: false,

            // 应用体检结果(行内提示,不弹窗)
            applyErrors: [],
            applyNotes: [],

            promptCopied: false,

            // 进来时的快照,用来判断「有没有没应用的改动」
            baselineHtml: html,
            baselineCss: css,
            baselineJs: js,
            baselineTemplateId: templateId,
            baselineLayout: layout,
            baselineBlueprint: JSON.stringify(normalizeToyBlueprint(this.initialBlueprint)),
        };
    },
    computed: {
        isFree() {
            return this.layout === 'free';
        },
        isCode() {
            return this.layout === 'code';
        },
        templates() {
            let list = DEFAULT_HTML_TEMPLATES;
            if (this.isFree) list = FREE_HTML_TEMPLATES;
            else if (this.isCode) list = CODE_HTML_TEMPLATES;
            return list.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                html: item.html,
                css: item.css,
                js: item.js || '',
            }));
        },
        layoutTip() {
            if (this.isCode) {
                return 'HTML、CSS、JS 三样全放开,跑在一个隔离的沙箱里 —— 想做什么做什么。'
                    + '沙箱碰不到你的聊天记录和存档,也上不了网;要出声、震动、存档用 hb。';
            }
            if (this.isFree) {
                return '整块只画一个东西,不复制。想让哪儿能按、能拖、能转,就在那个元素上打一个 data-hb。';
            }
            return '只写一格的样子,板子会自动复制铺满。适合气泡纸、巧克力这类一版重复的。';
        },
        subtitle() {
            if (this.isCode) return '沙箱里跑 · HTML + CSS + JS';
            if (this.isFree) return '整块自己画 · HTML + CSS + data-hb 零件';
            return `板子 ${this.gridLabel} 格 · 自己写 HTML 和 CSS`;
        },
        htmlHint() {
            if (this.isCode) return '沙箱里的 #stage';
            return this.isFree ? '整块只写一份' : '只写一格';
        },
        previewTip() {
            if (this.isCode) {
                return '这块预览就是舞台上那套沙箱,改完点「重新运行」。声音要回舞台才听得到。';
            }
            if (this.isFree) {
                return this.previewPartCount
                    ? `扫到 ${this.previewPartCount} 个零件,这块预览是真的能按、能拖的 —— 直接在这儿试。声音要回舞台才听得到。`
                    : '这段 HTML 里一个 data-hb 零件都没有,做出来的东西能看不能玩。';
            }
            return `按真实的 ${this.gridLabel} 画的。舞台上的盘子更大,比例会更舒展。`;
        },
        previewRows() {
            return clampGrid(this.rows, 4);
        },
        previewCols() {
            return clampGrid(this.cols, 4);
        },
        gridLabel() {
            return `${this.previewRows} × ${this.previewCols}`;
        },
        previewCells() {
            const rows = this.previewRows;
            const cols = this.previewCols;
            const total = rows * cols;
            const cells = [];
            for (let i = 0; i < total; i += 1) {
                const row = Math.floor(i / cols);
                const col = i % cols;
                cells.push({
                    index: i,
                    row,
                    col,
                    html: this.expandTemplate(this.previewHtml, { row, col, index: i, total }),
                    skew: `${(pseudoRandom(i + 1) * 2 - 1) * 5}deg`,
                    round: this.blobRadius(i),
                });
            }
            return cells;
        },
        previewTintStyle() {
            return {
                '--htmlbubble-tint': this.tint,
                '--rx-toy-tint': this.tint,
            };
        },
        previewBoardStyle() {
            return {
                gridTemplateColumns: `repeat(${this.previewCols}, 1fr)`,
                gridTemplateRows: `repeat(${this.previewRows}, 1fr)`,
                ...this.previewTintStyle,
            };
        },
        prompt() {
            return buildCustomToyPrompt(this.blueprint, {
                rows: this.previewRows,
                cols: this.previewCols,
                layout: this.layout,
            });
        },
        promptStats() {
            const text = this.prompt;
            return {
                lines: text.split('\n').length,
                kb: (text.length / 1024).toFixed(1),
            };
        },
        /** 有没有「改了但还没应用」的东西 —— 返回键要靠它决定问不问 */
        isDirty() {
            return this.html !== this.baselineHtml
                || this.css !== this.baselineCss
                || this.js !== this.baselineJs
                || this.activeTemplateId !== this.baselineTemplateId
                || this.layout !== this.baselineLayout
                || JSON.stringify(this.blueprint) !== this.baselineBlueprint;
        },
    },
    watch: {
        html() {
            this.schedulePreview();
        },
        css() {
            this.schedulePreview();
        },
        /*
         * ★ 改 JS **不**自动重跑。
         *   写到一半的代码几乎必然是语法错的,每敲一个字符就重建一次沙箱,
         *   报错区会疯狂闪红,而且用户玩到一半的状态每次都被清掉。
         *   所以 code 模式靠「重新运行」按钮手动触发。
         */
        previewCss() {
            this.renderPreviewCss();
        },
        // 这三个都会让预览那个节点被创建 / 销毁 / 换内容,统一在 DOM 更新后重挂运行时
        previewHtml() {
            this.$nextTick(() => this.syncPreviewRuntime());
        },
        layout() {
            this.$nextTick(() => this.syncPreviewRuntime());
        },
        pane() {
            this.$nextTick(() => this.syncPreviewRuntime());
        },
    },
    mounted() {
        // 预览的用户 CSS 用一个真 <style> 注入,包一层预览容器的类名,
        // 语义跟主体那边一致(都是嵌套),但只作用在这块预览上。
        // ★ code 模式不走这条 —— 那一档的 CSS 在 iframe 里面。
        this._previewStyleEl = document.createElement('style');
        this._previewStyleEl.className = 'rx-toypage-preview-style';
        this.$el?.appendChild?.(this._previewStyleEl);
        this.renderPreviewCss();
        this.syncPreviewRuntime();
    },
    beforeUnmount() {
        if (this._previewTimer) {
            clearTimeout(this._previewTimer);
            this._previewTimer = null;
        }
        if (this._copyTimer) {
            clearTimeout(this._copyTimer);
            this._copyTimer = null;
        }
        this.teardownFreePreview();
        this.teardownCodePreview();
        this._previewStyleEl?.remove?.();
        this._previewStyleEl = null;
    },
    methods: {
        // ---------- 预览 ----------
        schedulePreview() {
            if (this._previewTimer) clearTimeout(this._previewTimer);
            this._previewTimer = setTimeout(() => {
                this._previewTimer = null;
                this.refreshPreviewNow();
            }, PREVIEW_DEBOUNCE_MS);
        },
        /** 不等防抖,立刻重画一次(换模板 / 换做法这种整段替换的场景) */
        refreshPreviewNow() {
            if (this._previewTimer) {
                clearTimeout(this._previewTimer);
                this._previewTimer = null;
            }
            // 预览也过一遍消毒:所见即所得,免得「预览好好的、应用完变样」
            // (code 模式下 sanitizeToyTemplate 是原样放行,只体检)
            const clean = sanitizeToyTemplate(this.html, this.css, { layout: this.layout, js: this.js });
            this.previewHtml = clean.html;
            this.previewCss = clean.css;
        },
        renderPreviewCss() {
            if (!this._previewStyleEl) return;
            // grid / free 的预览容器共用 .rx-toypage-preview-stage,注入一处就够。
            // code 模式的 CSS 在 iframe 里,这里必须清空 —— 不清的话
            // 用户写的 `canvas{...}` 会漏到编辑页自己的元素上。
            this._previewStyleEl.textContent = this.isCode
                ? ''
                : `.rx-toypage-preview-stage{${this.previewCss}}`;
        },
        expandTemplate(template, ctx) {
            if (!template) return '';
            return String(template)
                .replace(/\{row\}/g, String(ctx.row))
                .replace(/\{col\}/g, String(ctx.col))
                .replace(/\{index\}/g, String(ctx.index))
                .replace(/\{total\}/g, String(ctx.total));
        },
        blobRadius(seed) {
            const pick = (offset) => 36 + Math.round(pseudoRandom(seed * 8 + offset) * 26);
            return `${pick(1)}% ${pick(2)}% ${pick(3)}% ${pick(4)}% / ${pick(5)}% ${pick(6)}% ${pick(7)}% ${pick(8)}%`;
        },
        togglePressPreview() {
            this.previewPressed = !this.previewPressed;
        },

        // ---------- 活预览 ----------
        /** 按当前做法挂对应的运行时,顺手把另一套拆掉 */
        syncPreviewRuntime() {
            if (!this.isFree) this.teardownFreePreview();
            if (!this.isCode) this.teardownCodePreview();
            if (this.isFree) this.syncFreePreview();
            if (this.isCode) this.syncCodePreview();
        },

        /**
         * 把消毒后的 HTML 塞进自由舞台,并让零件引擎重新扫一遍。
         *
         * ★ 这里故意不用 v-html:引擎握着的是具体节点的引用,
         *   Vue 一重渲染就全成了野指针,表现是「改完 CSS 之后摇杆就拖不动了」。
         *   自己 set innerHTML + rescan(),两件事的先后顺序才受控。
         */
        syncFreePreview() {
            const el = this.$refs.freeStage;
            if (!el) {
                this.teardownFreePreview();
                return;
            }

            el.innerHTML = this.previewHtml;

            if (this._freeParts && this._freeStageEl === el) {
                this._freeParts.rescan();
            } else {
                this.teardownFreePreview();
                this._freeStageEl = el;
                this._freeParts = createToyParts(el, {
                    // 页面里读不到舞台选的音色,索性不出声,只留震动
                    playSound: () => {},
                    haptic,
                });
                this.observeFreeStage(el);
            }

            this.previewPartCount = this._freeParts.count();
        },
        /** 预览也要给 --hb-unit,否则按 var(--hb-unit) 算尺寸的代码全落到兜底值上 */
        observeFreeStage(el) {
            const apply = () => {
                const unit = Math.min(el.offsetWidth, el.offsetHeight);
                if (unit > 0) el.style.setProperty('--hb-unit', `${unit}px`);
            };
            apply();
            if (typeof ResizeObserver === 'undefined') return;
            this._freeObserver = new ResizeObserver(apply);
            this._freeObserver.observe(el);
        },
        teardownFreePreview() {
            this._freeParts?.destroy?.();
            this._freeParts = null;
            this._freeStageEl = null;
            this._freeObserver?.disconnect?.();
            this._freeObserver = null;
        },
        resetFreePreview() {
            this._freeParts?.reset?.();
        },

        // ---------- 写代码模式的沙箱预览 ----------
        /**
         * ★ 用的是和舞台完全同一个 createToySandbox。
         *   另写一份「简化版预览」是这类编辑器最经典的坑:
         *   两套运行时早晚跑偏,用户就会遇到「预览里好好的、应用完不动」。
         */
        syncCodePreview() {
            const el = this.$refs.codeStage;
            if (!el) {
                this.teardownCodePreview();
                return;
            }
            // ★ 已经挂着就什么都不做。code 模式**只**在用户点「重新运行」时重跑 ——
            //   跟着打字自动重跑的话,改一个 CSS 字符就把玩到一半的状态清了,
            //   而且会不停地拿写到一半的 JS 去跑,报错区一直在闪。
            if (this._codeSandbox && this._codeStageEl === el) return;

            this.teardownCodePreview();
            this._codeStageEl = el;
            this.codeError = '';
            this._codeSandbox = createToySandbox(el, {
                html: this.html,
                css: this.css,
                js: this.js,
                tint: this.tint,
                // 页面里读不到舞台选的音色,索性不出声,只留震动
                playSound: () => {},
                haptic,
                notify: (title, message) => {
                    this.codeError = `hb.notify(${title}${message ? ' / ' + message : ''}) —— 舞台上这句会走灵动岛`;
                },
                onError: (message) => { this.codeError = message; },
            });
        },
        teardownCodePreview() {
            this._codeSandbox?.destroy?.();
            this._codeSandbox = null;
            this._codeStageEl = null;
        },
        /** 「重新运行」:JS 不跟着打字自动重跑,得用户说了算 */
        runCodePreview() {
            this.codeError = '';
            if (this._codeSandbox) {
                this._codeSandbox.reload({ html: this.html, css: this.css, js: this.js });
            } else {
                this.$nextTick(() => this.syncCodePreview());
            }
        },

        // ---------- 做法 ----------
        /**
         * 换做法。当前代码先存进 drafts,再把另一种的草稿读出来 ——
         * 来回切不会把刚写的东西冲掉。
         */
        switchLayout(id) {
            const next = normalizeToyLayout(id);
            if (next === this.layout) return;

            this.drafts[this.layout] = {
                html: this.html,
                css: this.css,
                js: this.js,
                templateId: this.activeTemplateId,
            };
            const draft = this.drafts[next] || defaultDraft(next);

            this.layout = next;
            this.html = draft.html;
            this.css = draft.css;
            this.js = draft.js || '';
            this.activeTemplateId = draft.templateId;
            this.previewPressed = false;
            this.codeError = '';
            this.clearMessages();
            this.refreshPreviewNow();
        },

        // ---------- 模板 ----------
        pickTemplate(template) {
            this.activeTemplateId = template.id;
            this.html = template.html;
            this.css = template.css;
            this.js = template.js || '';
            this.codeError = '';
            this.clearMessages();
            this.refreshPreviewNow();
            if (this.isCode) this.$nextTick(() => this.runCodePreview());
        },
        /**
         * ★ 「恢复默认」必须在任何情况下都能用 —— 它是用户把自己写崩之后的唯一退路。
         *   activeTemplateId 可能是粘贴之后的 'custom',getDefaultTemplateById
         *   查不到会回落到当前做法的第一套预设,这里把 id 一起对齐,
         *   免得 chip 高亮和内容对不上。
         */
        resetTemplate() {
            const def = getDefaultTemplateById(this.activeTemplateId, this.layout);
            this.activeTemplateId = def.id;
            this.html = def.html;
            this.css = def.css;
            this.js = def.js || '';
            this.codeError = '';
            this.clearMessages();
            this.refreshPreviewNow();
            if (this.isCode) this.$nextTick(() => this.runCodePreview());
            this.applyNotes = [`已经换回「${def.name}」的原始代码,还没应用到主体。`];
        },

        // ---------- 问卷 ----------
        patchBlueprint(patch) {
            this.blueprint = normalizeToyBlueprint({ ...this.blueprint, ...patch });
        },
        /** 「要能动的地方」是多选,至少留一个 —— 一个都不选提示词就没法写了 */
        toggleMove(id) {
            const current = this.blueprint.moves || [];
            const next = current.includes(id)
                ? current.filter(item => item !== id)
                : [...current, id];
            if (!next.length) return;
            this.patchBlueprint({ moves: next });
        },
        /**
         * 预设会**连做法一起换**。在格子模式下选「摇杆」却还按「只写一格」
         * 出提示词,拿回来的代码一定是废的。
         */
        usePreset(preset) {
            if (preset.layout) this.switchLayout(preset.layout);
            this.blueprint = normalizeToyBlueprint({ ...createToyBlueprint(), ...preset.blueprint });
            this.promptCopied = false;
        },

        // ---------- 复制提示词 ----------
        /**
         * ★ 和 app-maker 结果页(js/apps/app-maker/components/result.js)同一套:
         *   先试 navigator.clipboard,不可用(http / 老浏览器)退回 execCommand。
         */
        async copyPrompt() {
            const text = this.prompt;
            let ok = false;
            try {
                await navigator.clipboard.writeText(text);
                ok = true;
            } catch (_) {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch (_) {
                    ok = false;
                }
            }
            this.promptCopied = ok;
            if (this._copyTimer) clearTimeout(this._copyTimer);
            if (ok) {
                this._copyTimer = setTimeout(() => {
                    this.promptCopied = false;
                    this._copyTimer = null;
                }, COPIED_RESET_MS);
            }
        },

        // ---------- 粘贴回填 ----------
        applyPastedReply() {
            const result = splitAiReply(this.pastedText, { layout: this.layout });
            if (!result.ok) {
                this.pasteOk = false;
                this.pasteMessage = result.reason || '没能从这段文字里拆出代码。';
                return;
            }

            if (result.html) this.html = result.html;
            if (result.css) this.css = result.css;
            if (this.isCode && result.js) this.js = result.js;
            this.activeTemplateId = 'custom';
            this.pasteOk = true;

            const filled = ['HTML', result.css ? 'CSS' : '', (this.isCode && result.js) ? 'JS' : '']
                .filter(Boolean).join(' / ');
            this.pasteMessage = `认出来了:${result.detected.join('、')}。${filled} 已经填进编辑器,检查一下再点「应用到主体」。`;

            // 填完直接切到代码那一栏,让人马上看到预览
            this.pane = 'code';
            this.clearApplyMessages();
            this.refreshPreviewNow();
            if (this.isCode) this.$nextTick(() => this.runCodePreview());
        },
        clearPaste() {
            this.pastedText = '';
            this.pasteMessage = '';
            this.pasteOk = false;
        },

        // ---------- 应用 ----------
        applyToToy() {
            const clean = sanitizeToyTemplate(this.html, this.css, { layout: this.layout, js: this.js });

            if (!clean.ok) {
                this.applyErrors = clean.errors;
                this.applyNotes = [];
                return;
            }

            // 消毒改了内容就写回编辑器,让用户看到「真正被应用的是这份」
            // (code 模式原样放行,这两行不会动)
            if (clean.html !== this.html) this.html = clean.html;
            if (clean.css !== this.css) this.css = clean.css;

            this.applyErrors = [];
            this.applyNotes = clean.removed.length
                ? [`为了安全,这些东西被删掉了:${clean.removed.join('、')}。`, ...clean.warnings]
                : clean.warnings;

            this.baselineHtml = clean.html;
            this.baselineCss = clean.css;
            this.baselineJs = this.js;
            this.baselineTemplateId = this.activeTemplateId;
            this.baselineLayout = this.layout;
            this.baselineBlueprint = JSON.stringify(this.blueprint);

            this.$emit('apply', {
                html: clean.html,
                css: clean.css,
                js: this.js,
                layout: this.layout,
                activeTemplateId: this.activeTemplateId,
                blueprint: JSON.parse(JSON.stringify(this.blueprint)),
            });
        },

        clearApplyMessages() {
            this.applyErrors = [];
            this.applyNotes = [];
        },
        clearMessages() {
            this.clearApplyMessages();
            this.pasteMessage = '';
            this.pasteOk = false;
        },

        // ---------- 返回 ----------
        requestClose() {
            this.$emit('request-close', { dirty: this.isDirty });
        },
    },
    template: `
        <div class="rx-toypage">
            <header class="rx-toypage-head">
                <button
                    type="button"
                    class="rx-toypage-back"
                    aria-label="返回舞台"
                    @click="requestClose"
                >
                    ${ICON_CHEVRON_LEFT}
                    <span>返回</span>
                </button>
                <div class="rx-toypage-titles">
                    <h2 class="rx-toypage-title">我的捏捏</h2>
                    <p class="rx-toypage-subtitle">{{ subtitle }}</p>
                </div>
            </header>

            <div class="rx-toypage-seg" role="tablist">
                <button
                    type="button"
                    role="tab"
                    class="rx-toypage-seg-item"
                    :class="{ 'is-on': pane === 'code' }"
                    :aria-selected="String(pane === 'code')"
                    @click="pane = 'code'"
                >改代码</button>
                <button
                    type="button"
                    role="tab"
                    class="rx-toypage-seg-item"
                    :class="{ 'is-on': pane === 'ai' }"
                    :aria-selected="String(pane === 'ai')"
                    @click="pane = 'ai'"
                >让 AI 帮忙</button>
            </div>

            <div class="rx-toypage-body">
                <!-- 做法开关:两栏共用,所以放在 pane 分支外面 -->
                <section class="rx-toypage-block">
                    <div class="rx-toypage-block-head">
                        <h3 class="rx-toypage-block-title">做法</h3>
                        <span class="rx-toypage-block-hint">两边的代码各留一份</span>
                    </div>
                    <div class="rx-toypage-opts">
                        <button
                            v-for="item in layouts"
                            :key="item.id"
                            type="button"
                            class="rx-toypage-opt"
                            :class="{ 'is-on': layout === item.id }"
                            @click="switchLayout(item.id)"
                        >{{ item.label }}</button>
                    </div>
                    <p class="rx-toypage-tip">{{ layoutTip }}</p>
                </section>

                <!-- ============ 改代码 ============ -->
                <template v-if="pane === 'code'">
                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">从哪儿开始</h3>
                            <span class="rx-toypage-block-hint">点一下换成这套</span>
                        </div>
                        <div class="rx-toypage-chips">
                            <button
                                v-for="t in templates"
                                :key="t.id"
                                type="button"
                                class="rx-toypage-chip"
                                :class="{ 'is-active': t.id === activeTemplateId }"
                                @click="pickTemplate(t)"
                            >
                                <span class="rx-toypage-chip-name">{{ t.name }}</span>
                                <span class="rx-toypage-chip-desc">{{ t.description }}</span>
                            </button>
                        </div>
                    </section>

                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">预览</h3>
                            <button
                                v-if="isCode"
                                type="button"
                                class="rx-toypage-mini-btn is-on"
                                @click="runCodePreview"
                            >重新运行</button>
                            <button
                                v-else-if="isFree"
                                type="button"
                                class="rx-toypage-mini-btn"
                                @click="resetFreePreview"
                            >复位</button>
                            <button
                                v-else
                                type="button"
                                class="rx-toypage-mini-btn"
                                :class="{ 'is-on': previewPressed }"
                                @click="togglePressPreview"
                            >{{ previewPressed ? '看没按过的样子' : '看按过之后' }}</button>
                        </div>
                        <div
                            class="rx-toypage-preview"
                            :class="{ 'is-pressed': previewPressed && !isFree && !isCode }"
                        >
                            <!-- 写代码:整块交给沙箱 iframe,由 syncCodePreview 挂进去 -->
                            <div
                                v-if="isCode"
                                ref="codeStage"
                                class="rx-toypage-preview-code"
                            ></div>
                            <!-- 自由模式:内容由 syncFreePreview 直接写 innerHTML,这里必须留空 -->
                            <div
                                v-else-if="isFree"
                                ref="freeStage"
                                class="rx-toypage-preview-stage rx-toypage-preview-free"
                                :style="previewTintStyle"
                            ></div>
                            <div
                                v-else
                                class="rx-toypage-preview-stage rx-toypage-preview-board"
                                :style="previewBoardStyle"
                            >
                                <div
                                    v-for="cell in previewCells"
                                    :key="cell.index"
                                    class="htmlbubble-host rx-toypage-preview-cell"
                                    :class="{ 'is-popped': previewPressed }"
                                    :style="{ '--bubble-skew': cell.skew, '--bubble-round': cell.round }"
                                    v-html="cell.html"
                                ></div>
                            </div>
                        </div>
                        <p v-if="isCode && codeError" class="rx-toypage-runerr">{{ codeError }}</p>
                        <p
                            class="rx-toypage-tip"
                            :class="{ 'is-warn': isFree && !previewPartCount }"
                        >{{ previewTip }}</p>
                    </section>

                    <section v-if="isFree" class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">零件速查</h3>
                            <span class="rx-toypage-block-hint">打在自己的元素上</span>
                        </div>
                        <p class="rx-toypage-tip">
                            交互由小程序负责,你只管画。变量都是纯数字,用的时候自己乘单位,
                            并且记得带兜底值,比如 <code>calc(var(--hb-deg, 0) * 1deg)</code>。
                        </p>
                        <div class="rx-toypage-parts">
                            <div v-for="p in partGuide" :key="p.type" class="rx-toypage-part">
                                <div class="rx-toypage-part-head">
                                    <code class="rx-toypage-part-tag">data-hb="{{ p.type }}"</code>
                                    <span class="rx-toypage-part-name">{{ p.label }}</span>
                                    <span class="rx-toypage-part-gesture">{{ p.gesture }}</span>
                                </div>
                                <p class="rx-toypage-part-desc">{{ p.desc }}</p>
                                <p class="rx-toypage-part-meta">变量 {{ p.vars }}</p>
                                <p class="rx-toypage-part-meta">状态类 {{ p.classes }}</p>
                            </div>
                        </div>
                        <details class="rx-toypage-more">
                            <summary>还能加这些属性</summary>
                            <div v-for="a in partAttrs" :key="a.attr" class="rx-toypage-attr">
                                <code>{{ a.attr }}</code>
                                <span>{{ a.desc }}</span>
                            </div>
                        </details>
                    </section>

                    <section v-if="isCode" class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">hb 速查</h3>
                            <span class="rx-toypage-block-hint">和外面说话的唯一通道</span>
                        </div>
                        <p class="rx-toypage-tip">
                            代码跑在一个隔离的沙箱页面里:你的 HTML 会被放进
                            <code>#stage</code>(也就是 <code>hb.el</code>),它已经铺满画布、清好边距了。
                            沙箱<strong>上不了网</strong>,也读不到外面 —— 所有对外的事都走 <code>hb</code>。
                        </p>
                        <div class="rx-toypage-parts">
                            <div v-for="item in bridgeGuide" :key="item.api" class="rx-toypage-part">
                                <div class="rx-toypage-part-head">
                                    <code class="rx-toypage-part-tag">{{ item.api }}</code>
                                </div>
                                <p class="rx-toypage-part-desc">{{ item.desc }}</p>
                            </div>
                        </div>
                        <p class="rx-toypage-tip is-warn">
                            千万别写 <code>while(true)</code>:沙箱和界面共用一个线程,死循环会把整个 App 卡住。
                            要持续动画请用 <code>requestAnimationFrame</code>。
                        </p>
                    </section>

                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">HTML</h3>
                            <span class="rx-toypage-block-hint">{{ htmlHint }}</span>
                        </div>
                        <textarea
                            v-model="html"
                            class="rx-toypage-editor"
                            rows="12"
                            spellcheck="false"
                            autocapitalize="off"
                            autocorrect="off"
                            autocomplete="off"
                            data-ui-mute
                            aria-label="HTML 模板"
                        ></textarea>
                    </section>

                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">CSS</h3>
                            <span class="rx-toypage-block-hint">{{ isCode ? '沙箱里的样式' : '只对这块生效' }}</span>
                        </div>
                        <textarea
                            v-model="css"
                            class="rx-toypage-editor"
                            rows="16"
                            spellcheck="false"
                            autocapitalize="off"
                            autocorrect="off"
                            autocomplete="off"
                            data-ui-mute
                            aria-label="CSS 样式"
                        ></textarea>
                    </section>

                    <section v-if="isCode" class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">JavaScript</h3>
                            <button
                                type="button"
                                class="rx-toypage-mini-btn is-on"
                                @click="runCodePreview"
                            >重新运行</button>
                        </div>
                        <textarea
                            v-model="js"
                            class="rx-toypage-editor rx-toypage-editor--js"
                            rows="20"
                            spellcheck="false"
                            autocapitalize="off"
                            autocorrect="off"
                            autocomplete="off"
                            data-ui-mute
                            aria-label="JavaScript 代码"
                        ></textarea>
                        <p class="rx-toypage-tip">
                            改 JS 不会自动重跑 —— 写到一半的代码几乎都是错的,每敲一个字就重建一次沙箱
                            只会让报错疯狂闪。改完自己点「重新运行」。
                        </p>
                        <p v-if="codeError" class="rx-toypage-runerr">{{ codeError }}</p>
                    </section>
                </template>

                <!-- ============ 让 AI 帮忙 ============ -->
                <template v-else>
                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">照着填,一句都不用自己想</h3>
                            <span class="rx-toypage-block-hint">选一个会连做法一起换</span>
                        </div>
                        <div class="rx-toypage-chips">
                            <button
                                v-for="preset in blueprintPresets"
                                :key="preset.id"
                                type="button"
                                class="rx-toypage-chip"
                                @click="usePreset(preset)"
                            >
                                <span class="rx-toypage-chip-name">{{ preset.name }}</span>
                                <span class="rx-toypage-chip-desc">{{ preset.desc }}</span>
                            </button>
                        </div>
                    </section>

                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">想做什么</h3>
                        </div>
                        <input
                            :value="blueprint.idea"
                            class="rx-toypage-input"
                            type="text"
                            maxlength="120"
                            :placeholder="isFree ? '比如:一根街机摇杆,拖到哪就歪到哪' : '比如:一整版气泡纸,按下去啵一声就瘪了'"
                            data-ui-mute
                            @input="patchBlueprint({ idea: $event.target.value })"
                        />

                        <div v-if="isFree" class="rx-toypage-field">
                            <span class="rx-toypage-field-label">要能动的地方(可多选)</span>
                            <div class="rx-toypage-opts">
                                <button
                                    v-for="item in moves"
                                    :key="item.id"
                                    type="button"
                                    class="rx-toypage-opt"
                                    :class="{ 'is-on': blueprint.moves.includes(item.id) }"
                                    @click="toggleMove(item.id)"
                                >{{ item.label }}</button>
                            </div>
                        </div>

                        <div class="rx-toypage-field">
                            <span class="rx-toypage-field-label">形态</span>
                            <div class="rx-toypage-opts">
                                <button
                                    v-for="item in shapes"
                                    :key="item.id"
                                    type="button"
                                    class="rx-toypage-opt"
                                    :class="{ 'is-on': blueprint.shape === item.id }"
                                    @click="patchBlueprint({ shape: item.id })"
                                >{{ item.label }}</button>
                            </div>
                        </div>
                        <input
                            v-if="blueprint.shape === 'custom'"
                            :value="blueprint.shapeCustom"
                            class="rx-toypage-input"
                            type="text"
                            maxlength="120"
                            placeholder="它长什么样?"
                            data-ui-mute
                            @input="patchBlueprint({ shapeCustom: $event.target.value })"
                        />

                        <div class="rx-toypage-field">
                            <span class="rx-toypage-field-label">触感</span>
                            <div class="rx-toypage-opts">
                                <button
                                    v-for="item in feels"
                                    :key="item.id"
                                    type="button"
                                    class="rx-toypage-opt"
                                    :class="{ 'is-on': blueprint.feel === item.id }"
                                    @click="patchBlueprint({ feel: item.id })"
                                >{{ item.label }}</button>
                            </div>
                        </div>

                        <div class="rx-toypage-field">
                            <span class="rx-toypage-field-label">配色</span>
                            <div class="rx-toypage-opts">
                                <button
                                    v-for="item in palettes"
                                    :key="item.id"
                                    type="button"
                                    class="rx-toypage-opt"
                                    :class="{ 'is-on': blueprint.palette === item.id }"
                                    @click="patchBlueprint({ palette: item.id })"
                                >{{ item.label }}</button>
                            </div>
                        </div>
                        <input
                            v-if="blueprint.palette === 'custom'"
                            :value="blueprint.paletteCustom"
                            class="rx-toypage-input"
                            type="text"
                            maxlength="120"
                            placeholder="想要什么颜色?"
                            data-ui-mute
                            @input="patchBlueprint({ paletteCustom: $event.target.value })"
                        />

                        <div class="rx-toypage-field">
                            <span class="rx-toypage-field-label">动画</span>
                            <div class="rx-toypage-opts">
                                <button
                                    v-for="item in motions"
                                    :key="item.id"
                                    type="button"
                                    class="rx-toypage-opt"
                                    :class="{ 'is-on': blueprint.motion === item.id }"
                                    @click="patchBlueprint({ motion: item.id })"
                                >{{ item.label }}</button>
                            </div>
                        </div>

                        <div class="rx-toypage-switches">
                            <button
                                type="button"
                                class="rx-toypage-switch"
                                :class="{ 'is-on': blueprint.pressChange }"
                                :aria-pressed="String(blueprint.pressChange)"
                                @click="patchBlueprint({ pressChange: !blueprint.pressChange })"
                            >按下要变样</button>
                            <button
                                type="button"
                                class="rx-toypage-switch"
                                :class="{ 'is-on': blueprint.oneShot }"
                                :aria-pressed="String(blueprint.oneShot)"
                                @click="patchBlueprint({ oneShot: !blueprint.oneShot })"
                            >戳破就用掉</button>
                            <button
                                type="button"
                                class="rx-toypage-switch"
                                :class="{ 'is-on': blueprint.withText }"
                                :aria-pressed="String(blueprint.withText)"
                                @click="patchBlueprint({ withText: !blueprint.withText })"
                            >{{ layout === 'grid' ? '格子里有字' : '上面有字' }}</button>
                            <button
                                type="button"
                                class="rx-toypage-switch"
                                :class="{ 'is-on': blueprint.decorated }"
                                :aria-pressed="String(blueprint.decorated)"
                                @click="patchBlueprint({ decorated: !blueprint.decorated })"
                            >渐变阴影描边</button>
                            <button
                                type="button"
                                class="rx-toypage-switch"
                                :class="{ 'is-on': blueprint.darkAware }"
                                :aria-pressed="String(blueprint.darkAware)"
                                @click="patchBlueprint({ darkAware: !blueprint.darkAware })"
                            >适配深色</button>
                        </div>

                        <input
                            v-if="blueprint.withText"
                            :value="blueprint.textSample"
                            class="rx-toypage-input"
                            type="text"
                            maxlength="24"
                            placeholder="想显示什么字?"
                            data-ui-mute
                            @input="patchBlueprint({ textSample: $event.target.value })"
                        />
                    </section>

                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">拿去问 AI</h3>
                            <span class="rx-toypage-block-hint">{{ promptStats.lines }} 行 · {{ promptStats.kb }}KB</span>
                        </div>
                        <p class="rx-toypage-tip">
                            这份是按上面的答案现算的 —— 没勾的部分不会出现在里面。
                            复制走,发给任意一个会写代码的 AI,把它回的整段话贴回下面那个框。
                        </p>
                        <button
                            type="button"
                            class="rx-btn rx-btn-primary rx-btn-block"
                            :class="{ 'is-copied': promptCopied }"
                            @click="copyPrompt"
                        >
                            <span v-if="promptCopied" class="rx-toypage-btn-icon">${ICON_CHECK}</span>
                            <span>{{ promptCopied ? '已复制' : '复制提示词' }}</span>
                        </button>
                        <pre class="rx-toypage-prompt">{{ prompt }}</pre>
                    </section>

                    <section class="rx-toypage-block">
                        <div class="rx-toypage-block-head">
                            <h3 class="rx-toypage-block-title">把 AI 的回复贴回来</h3>
                            <span class="rx-toypage-block-hint">整段贴,不用自己拆</span>
                        </div>
                        <textarea
                            v-model="pastedText"
                            class="rx-toypage-editor rx-toypage-editor--paste"
                            rows="8"
                            spellcheck="false"
                            autocapitalize="off"
                            autocorrect="off"
                            autocomplete="off"
                            data-ui-mute
                            placeholder="把 AI 回的话整段粘在这里,连代码围栏一起带上也行"
                            aria-label="AI 回复"
                        ></textarea>
                        <div class="rx-btn-row">
                            <button type="button" class="rx-btn rx-btn-ghost" @click="clearPaste">清空</button>
                            <button type="button" class="rx-btn rx-btn-primary" @click="applyPastedReply">拆开填进编辑器</button>
                        </div>
                        <p
                            v-if="pasteMessage"
                            class="rx-toypage-msg"
                            :class="pasteOk ? 'is-ok' : 'is-bad'"
                        >{{ pasteMessage }}</p>
                    </section>
                </template>
            </div>

            <div class="rx-toypage-actions">
                <p v-if="applyErrors.length" class="rx-toypage-msg is-bad">
                    <span v-for="(err, i) in applyErrors" :key="i" class="rx-toypage-msg-line">{{ err }}</span>
                </p>
                <p v-else-if="applyNotes.length" class="rx-toypage-msg is-ok">
                    <span v-for="(note, i) in applyNotes" :key="i" class="rx-toypage-msg-line">{{ note }}</span>
                </p>
                <div class="rx-btn-row">
                    <button type="button" class="rx-btn rx-btn-ghost" @click="resetTemplate">恢复默认</button>
                    <button type="button" class="rx-btn rx-btn-primary" @click="applyToToy">应用到主体</button>
                </div>
            </div>
        </div>
    `,
};
