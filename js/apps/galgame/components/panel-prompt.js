/**
 * 湛蓝回忆 · 提示词面板
 *
 * 对齐 murmur 的「回复提示词」页和梦境编织的「上下文管理」面板:
 * **把发给 AI 的东西逐段列出来,能开关、能排序、能看到正文。**
 *
 * ── 为什么排序这一块不能省 ────────────────────────────────────────
 *
 * 第一版只做了开关,`game.contextOrder` 这个字段**建了但没有任何 UI 会写它** ——
 * 而 `buildPrompt` 那边一直在读。这正是本项目最高频的一类 bug:
 * 「写了没人读」或者「读了没人写」的字段,运行时完全静默,
 * 表现是「这个功能好像做了一半」。要么把字段删掉,要么把 UI 补上,不能这么放着。
 *
 * ── 顺序为什么重要 ────────────────────────────────────────────────
 *
 * 模型对 system prompt 里靠前的内容更敏感。想让 AI 更听「自定义提示词」的,
 * 就把它拖到「世界观」前面;想让它更贴近最近发生的事,就把「近期剧情」往上提。
 * 这不是玄学,是这一类模型的实际行为。
 *
 * ── 预览 == 发送 ──────────────────────────────────────────────────
 *
 * 这一屏渲染的 `parts` 和真正发出去的文本是**同一次 `buildPrompt()` 的两个返回字段**,
 * 所以这里点掉一段、拖动一下,下一幕真的会变。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { buildPrompt, collectSources } from '../services/prompt-builder.js';
import { CONTEXT_SECTIONS } from '../constants.js';
import { asArray, truncate } from '../utils.js';

export const GgPanelPrompt = {
    name: 'GgPanelPrompt',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { showPrompt: false, dragId: '', expanded: '' };
    },
    computed: {
        state() { return store.getState(); },
        game() { return store.getGame(); },
        node() { return store.getCurrentNode(); },

        /** ★ 和发送同一次计算;`save:false` 是因为 computed 每次重渲染都写快照会把真快照冲掉 */
        preview() {
            const game = this.game;
            if (!game) return { text: '', parts: [], stats: { tokens: 0, included: 0, total: 0 } };
            const sources = collectSources({
                game,
                library: this.state.library,
                currentNode: this.node,
                nodeMap: store.getNodeMap(),
            });
            return buildPrompt(
                { game, library: this.state.library, sources, currentNode: this.node },
                { save: false },
            );
        },

        /** `preview.parts` 已经按当前顺序排好了,直接补上元信息 */
        rows() {
            const meta = new Map(CONTEXT_SECTIONS.map((s) => [s.id, s]));
            return this.preview.parts.map((part, index) => {
                const m = meta.get(part.id) || {};
                return {
                    id: part.id,
                    index: index + 1,
                    label: part.title,
                    source: m.desc || '',
                    locked: part.locked,
                    active: part.active,
                    included: part.included,
                    tokens: part.tokens,
                    body: part.content,
                    excerpt: part.content.trim() ? truncate(part.content.replace(/\s+/g, ' '), 46) : '(这一段现在是空的)',
                    isFirst: index === 0,
                    isLast: index === this.preview.parts.length - 1,
                };
            });
        },

        customPrompts() { return asArray(this.game?.customPrompts); },
        notes() { return asArray(this.game?.notes); },
        ordered() { return store.getContextOrder(); },
        isDefaultOrder() {
            return asArray(this.game?.contextOrder).length === 0;
        },
    },
    methods: {
        onToggle(row) {
            if (row.locked) {
                this.$emit('notify', '这一段关掉之后 AI 会写成散文,解析器一条都认不出来');
                return;
            }
            store.setContextSection(row.id, !row.active);
        },
        onMove(row, dir) {
            if (!store.moveContextSection(row.id, dir)) return;
            this.$emit('notify', dir < 0 ? '往前挪了一位' : '往后挪了一位');
        },
        onReset() {
            store.resetContextOrder();
            this.$emit('notify', '已恢复默认顺序');
        },
        onExpand(row) {
            this.expanded = this.expanded === row.id ? '' : row.id;
        },

        // ── 拖拽排序 ──────────────────────
        // 用 elementFromPoint 找「手指底下是哪一行」,不用自己量行高 ——
        // 行高会随内容(展开/收起、来源标签换行)变,量出来的值很快就不准了。
        onDragStart(event, row) {
            this.dragId = row.id;
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        onDragMove(event) {
            if (!this.dragId) return;
            event.preventDefault();
            const hit = document.elementFromPoint(event.clientX, event.clientY);
            const overId = hit?.closest?.('.gg-ord-row')?.dataset?.sectionId;
            if (!overId || overId === this.dragId) return;
            store.moveContextSectionTo(this.dragId, overId);
        },
        onDragEnd(event) {
            if (!this.dragId) return;
            this.dragId = '';
            event.currentTarget.releasePointerCapture?.(event.pointerId);
        },

        // ── 自定义提示词 / 手记 ────────────
        onAddPrompt() { store.openModal('prompt-edit', {}); },
        onEditPrompt(p) { store.openModal('prompt-edit', { promptId: p.id }); },
        onTogglePrompt(p) {
            const game = this.game;
            if (!game) return;
            store.updateGame({
                customPrompts: game.customPrompts.map((x) => (x.id === p.id ? { ...x, enabled: !x.enabled } : x)),
            });
        },
        onRemovePrompt(p) {
            const game = this.game;
            if (!game) return;
            store.updateGame({ customPrompts: game.customPrompts.filter((x) => x.id !== p.id) });
        },

        onAddNote() { store.openModal('note-edit', {}); },
        onEditNote(n) { store.openModal('note-edit', { noteId: n.id }); },
        onToggleNote(n) { store.updateNote(n.id, { active: !n.active }); },
        onRemoveNote(n) { store.removeNote(n.id); },

        async onCopyPrompt() {
            try {
                await navigator.clipboard.writeText(this.preview.text);
                this.$emit('notify', '完整 prompt 已复制');
            } catch (_) {
                this.$emit('notify', '浏览器不让复制,展开原文手动选吧');
            }
        },

        short(text, n = 34) { return truncate(text, n); },
    },
    template: `
        <div class="gg-panel-body">
            <GgEmpty v-if="!game" text="还没有故事" hint="先在「设定」里建一局" />

            <template v-else>
                <!-- 拼接顺序 -->
                <GgSection
                    title="拼接顺序"
                    icon-name="layers"
                    :hint="preview.stats.included + ' / ' + preview.stats.total + ' 段 · ' + preview.stats.tokens + ' tokens'"
                >
                    <p class="gg-hint">
                        这就是下一幕真正会发出去的东西。越靠前的段落模型越当回事 ——
                        想让它更听你的自定义提示词,就把那一段拖到世界观前面。
                    </p>

                    <div class="gg-ord-list">
                        <div
                            v-for="row in rows"
                            :key="row.id"
                            class="gg-ord-row"
                            :class="{ 'is-off': !row.active, 'is-empty': !row.included, 'is-dragging': dragId === row.id }"
                            :data-section-id="row.id"
                        >
                            <span
                                class="gg-ord-handle"
                                role="button"
                                aria-label="拖动排序"
                                @pointerdown="onDragStart($event, row)"
                                @pointermove="onDragMove"
                                @pointerup="onDragEnd"
                                @pointercancel="onDragEnd"
                            ><GgIcon name="menu" /></span>

                            <span class="gg-ord-index">{{ row.index }}</span>

                            <button type="button" class="gg-ord-main" @click="onExpand(row)">
                                <span class="gg-ord-title">
                                    {{ row.label }}
                                    <em v-if="row.locked" class="gg-ord-lock">必留</em>
                                    <em v-if="row.source" class="gg-ord-src">{{ row.source }}</em>
                                </span>
                                <span class="gg-ord-excerpt">{{ row.excerpt }}</span>
                            </button>

                            <span class="gg-ord-tokens">{{ row.included ? row.tokens : '—' }}</span>

                            <span class="gg-ord-actions">
                                <button type="button" class="gg-ord-mini" aria-label="上移" :disabled="row.isFirst" @click="onMove(row, -1)">
                                    <GgIcon name="chevronUp" />
                                </button>
                                <button type="button" class="gg-ord-mini" aria-label="下移" :disabled="row.isLast" @click="onMove(row, 1)">
                                    <GgIcon name="chevronDown" />
                                </button>
                                <button
                                    type="button"
                                    class="gg-ord-mini gg-ord-toggle"
                                    :class="{ 'is-on': row.active }"
                                    :aria-label="row.active ? '关掉这一段' : '启用这一段'"
                                    @click="onToggle(row)"
                                >
                                    <GgIcon :name="row.active ? 'check' : 'close'" />
                                </button>
                            </span>

                            <pre v-if="expanded === row.id" class="gg-ord-body">{{ row.body || '(空)' }}</pre>
                        </div>
                    </div>

                    <div class="gg-row-actions">
                        <GgButton size="sm" variant="quiet" icon-name="refresh" :disabled="isDefaultOrder" @click="onReset">恢复默认顺序</GgButton>
                        <GgButton size="sm" variant="quiet" icon-name="copy" @click="onCopyPrompt">复制完整 prompt</GgButton>
                        <GgButton size="sm" variant="quiet" :icon-name="showPrompt ? 'chevronUp' : 'chevronDown'" @click="showPrompt = !showPrompt">
                            {{ showPrompt ? '收起原文' : '看完整原文' }}
                        </GgButton>
                    </div>
                    <pre v-if="showPrompt" class="gg-ctx-pre">{{ preview.text }}</pre>
                </GgSection>

                <!-- 自定义提示词 -->
                <GgSection title="自定义提示词" icon-name="sparkle" :hint="customPrompts.length + ' 条'">
                    <p class="gg-hint">想控制文风、想禁止某类情节,写在这儿。它在上面的顺序表里是「自定义」那一段。</p>
                    <div class="gg-row-actions">
                        <GgButton size="sm" variant="ghost" icon-name="plus" @click="onAddPrompt">加一条</GgButton>
                    </div>
                    <GgEmpty v-if="!customPrompts.length" text="还没有自定义提示词" />
                    <div v-for="p in customPrompts" :key="p.id" class="gg-list-row" :class="{ 'is-off': !p.enabled }">
                        <button type="button" class="gg-list-main" @click="onEditPrompt(p)">
                            <span class="gg-list-title">{{ p.title || '(无标题)' }}</span>
                            <span class="gg-list-sub">{{ short(p.content) }}</span>
                        </button>
                        <GgButton size="sm" :icon-name="p.enabled ? 'eye' : 'close'" icon-only :label="p.enabled ? '停用' : '启用'" @click="onTogglePrompt(p)" />
                        <GgButton size="sm" icon-name="trash" icon-only label="删除" @click="onRemovePrompt(p)" />
                    </div>
                </GgSection>

                <!-- 手记 -->
                <GgSection title="故事手记" icon-name="pen" :hint="notes.length + ' 条'">
                    <p class="gg-hint">设定级的东西写这儿:身世、约定、习惯、地名。手记会一直待在上下文里,不会被 K 链压缩掉。</p>
                    <div class="gg-row-actions">
                        <GgButton size="sm" variant="ghost" icon-name="plus" @click="onAddNote">写一条</GgButton>
                    </div>
                    <GgEmpty v-if="!notes.length" text="还没有手记" />
                    <div v-for="n in notes" :key="n.id" class="gg-list-row" :class="{ 'is-off': !n.active }">
                        <button type="button" class="gg-list-main" @click="onEditNote(n)">
                            <span class="gg-list-title">{{ n.title }}</span>
                            <span class="gg-list-sub">{{ short(n.content) }}</span>
                        </button>
                        <GgButton size="sm" :icon-name="n.active ? 'eye' : 'close'" icon-only :label="n.active ? '停用' : '启用'" @click="onToggleNote(n)" />
                        <GgButton size="sm" icon-name="trash" icon-only label="删除" @click="onRemoveNote(n)" />
                    </div>
                </GgSection>
            </template>
        </div>
    `,
};

export default GgPanelPrompt;
