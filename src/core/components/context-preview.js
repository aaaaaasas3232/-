/**
 * ContextPreview —— 框架级「上下文可视化」组件
 *
 * ★ 为什么放在框架层
 *   murmur 的「回复提示词 → 当前上下文」和梦境编织的「上下文管理 → 预览」是同一个需求:
 *   **让用户完整看到这次要发给 AI 的东西**,并且能逐段开关、看 token 占比、复制全文。
 *   两边各写了一遍,于是各自都长歪了(见 `src/core/context-composer.js` 顶部注释)。
 *
 * ★ 它和 composer 的关系
 *   本组件**不做任何拼装**。它只渲染 `composeContext()` 的返回值:
 *
 *     const result = composer.compose(parts, { order });
 *     <ContextPreview :result="result" @toggle="..." />
 *
 *   「预览 == 发送」是靠这一点保证的 —— 预览渲染的 `result.parts` 和
 *   发出去的 `result.text` 来自**同一次调用**,物理上不可能不一致。
 *
 * Props
 *   - result      object   composeContext() 的返回值 { text, parts, stats }(必填)
 *   - title       string   标题,默认「当前上下文」
 *   - editable    bool     是否显示每段的开关,默认 true
 *   - collapsible bool     段落正文是否可折叠,默认 true
 *   - showRaw     bool     是否提供「查看原文」切换,默认 true
 *   - emptyText   string   一段都没有时的提示
 *   - budgetHint  string   token 预算的说明文案(可选)
 *
 * Emits
 *   - toggle(partId, nextActive)   用户点了某段的开关
 *   - edit(partId)                 用户点了某段的编辑(只有 part.editable 为 true 才显示)
 *   - copy(text)                   用户复制了全文(组件已经写进剪贴板,这里只是通知)
 *
 * 样式
 *   基线在 `css/core/85-context-preview.css`,裸 class 低优先级;
 *   各 app 用 `.app-shell[data-app-id="xxx"] .ctxp-*` 覆盖皮肤,
 *   或者直接改组件暴露的 `--ctxp-*` 变量(推荐,不用写选择器)。
 */

export const ContextPreview = {
    name: 'ContextPreview',
    props: {
        result: { type: Object, required: true },
        title: { type: String, default: '当前上下文' },
        editable: { type: Boolean, default: true },
        collapsible: { type: Boolean, default: true },
        showRaw: { type: Boolean, default: true },
        emptyText: { type: String, default: '还没有任何内容会被发送给 AI。' },
        budgetHint: { type: String, default: '' },
    },
    emits: ['toggle', 'edit', 'copy'],
    data() {
        return {
            expanded: {},
            rawMode: false,
            copied: false,
        };
    },
    computed: {
        parts() {
            return Array.isArray(this.result?.parts) ? this.result.parts : [];
        },
        stats() {
            return this.result?.stats || { total: 0, included: 0, tokens: 0, chars: 0 };
        },
        text() {
            return String(this.result?.text || '');
        },
        /** 每段占总 token 的百分比 —— 用来画那条占比条 */
        shares() {
            const total = this.parts.reduce((sum, p) => sum + (p.included ? p.tokens : 0), 0);
            const map = {};
            for (const p of this.parts) {
                map[p.id] = total > 0 && p.included ? Math.max(1, Math.round((p.tokens / total) * 100)) : 0;
            }
            return map;
        },
        budgetPercent() {
            const { tokens = 0, budget = 0 } = this.stats;
            if (!budget) return 0;
            return Math.min(100, Math.round((tokens / budget) * 100));
        },
    },
    methods: {
        isExpanded(id) {
            return this.expanded[id] === true;
        },
        toggleExpand(id) {
            if (!this.collapsible) return;
            this.expanded = { ...this.expanded, [id]: !this.expanded[id] };
        },
        onToggle(part) {
            if (part.locked) return;
            this.$emit('toggle', part.id, !part.active);
        },
        async copyAll() {
            const text = this.text;
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
            } catch (_) {
                // 剪贴板 API 在非安全上下文里不可用,退回 textarea + execCommand
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch (_) { return; }
            }
            this.copied = true;
            if (this._copyTimer) clearTimeout(this._copyTimer);
            this._copyTimer = setTimeout(() => { this.copied = false; this._copyTimer = null; }, 1600);
            this.$emit('copy', text);
        },
        previewOf(part) {
            const body = String(part.content || '').replace(/\s+/g, ' ').trim();
            return body.length > 72 ? `${body.slice(0, 72)}…` : body;
        },
    },
    beforeUnmount() {
        if (this._copyTimer) clearTimeout(this._copyTimer);
    },
    template: `
        <section class="ctxp">
            <header class="ctxp-head">
                <div class="ctxp-head-main">
                    <h3 class="ctxp-title">{{ title }}</h3>
                    <p class="ctxp-summary">
                        <span class="ctxp-stat">{{ stats.included }}/{{ stats.total }} 段</span>
                        <span class="ctxp-stat-sep">·</span>
                        <span class="ctxp-stat">约 {{ stats.tokens }} tokens</span>
                        <span class="ctxp-stat-sep">·</span>
                        <span class="ctxp-stat">{{ stats.chars }} 字</span>
                    </p>
                </div>
                <div class="ctxp-head-actions">
                    <button
                        v-if="showRaw"
                        type="button"
                        class="ctxp-chip"
                        :class="{ 'is-on': rawMode }"
                        @click="rawMode = !rawMode"
                    >{{ rawMode ? '分段' : '原文' }}</button>
                    <button type="button" class="ctxp-chip" @click="copyAll">
                        {{ copied ? '已复制' : '复制' }}
                    </button>
                </div>
            </header>

            <div v-if="stats.budget" class="ctxp-budget" :class="{ 'is-over': stats.overBudget }">
                <div class="ctxp-budget-bar">
                    <span class="ctxp-budget-fill" :style="{ width: budgetPercent + '%' }"></span>
                </div>
                <p class="ctxp-budget-text">
                    {{ stats.tokens }} / {{ stats.budget }} tokens
                    <template v-if="stats.overBudget"> · 已超出预算,靠后的内容可能被模型截断</template>
                    <template v-else-if="budgetHint"> · {{ budgetHint }}</template>
                </p>
            </div>

            <pre v-if="rawMode" class="ctxp-raw">{{ text || emptyText }}</pre>

            <div v-else-if="parts.length === 0" class="ctxp-empty">{{ emptyText }}</div>

            <ol v-else class="ctxp-list">
                <li
                    v-for="(part, index) in parts"
                    :key="part.id"
                    class="ctxp-item"
                    :class="{ 'is-off': !part.included, 'is-open': isExpanded(part.id) }"
                >
                    <div class="ctxp-item-head" @click="toggleExpand(part.id)">
                        <span class="ctxp-index">{{ index + 1 }}</span>
                        <div class="ctxp-item-main">
                            <p class="ctxp-item-title">
                                {{ part.title }}
                                <span v-if="part.locked" class="ctxp-badge ctxp-badge--lock">必需</span>
                                <span v-else-if="!part.active" class="ctxp-badge ctxp-badge--off">已关闭</span>
                                <span v-else-if="!part.content" class="ctxp-badge ctxp-badge--empty">空</span>
                            </p>
                            <p class="ctxp-item-preview">{{ previewOf(part) || '(无内容)' }}</p>
                        </div>
                        <div class="ctxp-item-meta">
                            <span class="ctxp-tokens">{{ part.tokens }}</span>
                            <span class="ctxp-share">
                                <span class="ctxp-share-fill" :style="{ width: shares[part.id] + '%' }"></span>
                            </span>
                        </div>
                    </div>

                    <div class="ctxp-item-actions" v-if="editable || part.editable">
                        <!--
                          locked 的段不画开关。
                          画成「打开但禁用」的样子(半透明)看起来跟「关闭」一模一样,
                          用户会以为这段没生效 —— 而它恰恰是必定生效的那种。
                          旁边的「必需」角标已经说清楚了。
                        -->
                        <button
                            v-if="editable && !part.locked"
                            type="button"
                            class="ctxp-switch"
                            :class="{ 'is-on': part.active }"
                            :aria-label="part.active ? '关闭这一段' : '启用这一段'"
                            @click.stop="onToggle(part)"
                        ><span class="ctxp-switch-thumb"></span></button>
                        <span v-if="part.source" class="ctxp-source">{{ part.source }}</span>
                        <button
                            v-if="part.editable"
                            type="button"
                            class="ctxp-link"
                            @click.stop="$emit('edit', part.id)"
                        >编辑</button>
                    </div>

                    <pre v-if="isExpanded(part.id)" class="ctxp-item-body">{{ part.content || '(无内容)' }}</pre>
                </li>
            </ol>
        </section>
    `,
};

export default ContextPreview;
