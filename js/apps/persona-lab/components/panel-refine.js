/**
 * 人设机 · 打磨面板
 *
 * 顾问给的那一条建议在这儿落地:看 diff → 采用 / 改一改再采用 / 忽略。
 * 下面是修改日志,每条都能撤回。
 *
 * ── 相对原型的四处修正 ────────────────────────────────────────────
 *
 * 1. **不伪造建议**。原型解析不出行号格式时会凭空造一条(见
 *    `services/suggestion.js` 顶部)。这里解析失败就只显示顾问原话,
 *    并明说「没法一键套用」。
 * 2. **采用前先核对原文**。行号对不上时报错并让用户重新问一次,
 *    不硬写 —— 改错行比不改坏得多,而且用户多半发现不了。
 * 3. **撤销存整份快照**,不是反向套用那一条修改。用户在两次建议之间
 *    手动改过正文时,反向套用会把手动改的部分一起冲掉。
 * 4. **建议可以改完再采用**。原型只有「接受 / 拒绝 / 重新建议」三个按钮,
 *    AI 的措辞差一点就只能整条拒绝,再问一次。
 */

import { SHARED_COMPONENTS } from './shared.js';
import * as store from '../store.js';
import { applySuggestion, describeSuggestion } from '../services/suggestion.js';
import { formatRelative } from '../utils.js';

export const PlPanelRefine = {
    name: 'PlPanelRefine',
    components: { ...SHARED_COMPONENTS },
    props: {
        app: { type: Object, required: true },
        draft: { type: Object, required: true },
    },
    emits: ['notify', 'go-ask'],
    data() {
        return { edited: null };
    },
    computed: {
        suggestion() { return this.draft.suggestion; },
        note() { return this.draft.advisorNote; },
        log() { return this.draft.log; },

        diff() {
            if (!this.suggestion) return null;
            return describeSuggestion(this.draft.text, this.suggestion);
        },

        /** 用户可能会把 AI 的措辞改一改再采用 */
        draftNext: {
            get() { return this.edited != null ? this.edited : (this.suggestion?.next || ''); },
            set(v) { this.edited = v; },
        },
        touched() {
            return this.edited != null && this.edited !== (this.suggestion?.next || '');
        },
    },
    watch: {
        'draft.suggestion.id'() { this.edited = null; },
    },
    methods: {
        formatRelative,

        onAdopt() {
            if (!this.suggestion) return;
            const applied = { ...this.suggestion, next: this.draftNext };
            const before = this.draft.text;
            const result = applySuggestion(before, applied);

            if (!result.ok) {
                this.$emit('notify', result.error || '这条建议套用不上去了');
                return;
            }

            store.setDraftText(this.draft.id, result.text);
            store.pushLog(this.draft.id, {
                action: applied.kind === 'insert' ? 'insert' : 'modify',
                title: this.diff?.title || '修改',
                before: this.diff?.before || '',
                after: applied.next,
                reason: applied.reason,
                snapshot: before,
            });
            store.clearSuggestion(this.draft.id);
            this.edited = null;

            this.$emit(
                'notify',
                result.shifted
                    ? `已采用（行号对不上，按原文找到了第 ${result.hitLine} 行）`
                    : '已采用，去「档案」看看要不要存回 nook',
            );
        },

        onIgnore() {
            store.clearSuggestion(this.draft.id);
            this.edited = null;
            this.$emit('notify', '已忽略这条');
        },

        onUndo(entry) {
            store.openModal('confirm', {
                title: '撤回到这一步之前?',
                text: '这一条之后的所有修改都会一起撤掉。',
                confirmLabel: '撤回',
                onConfirm: () => {
                    if (store.undoLog(this.draft.id, entry.id)) this.$emit('notify', '已撤回');
                    else this.$emit('notify', '这条记录没有快照，撤不回去');
                },
            });
        },

        onClearLog() {
            store.openModal('confirm', {
                title: '清空修改日志?',
                text: '清空后就不能再撤回了，正文本身不会变。',
                danger: true,
                confirmLabel: '清空',
                onConfirm: () => {
                    store.clearLog(this.draft.id);
                    this.$emit('notify', '日志已清空');
                },
            });
        },
    },
    template: `
        <div class="pl-refine">
            <!-- 顾问结论 -->
            <section v-if="note" class="pl-refine-note">
                <PlIcon name="wand" />
                <p>{{ note }}</p>
            </section>

            <!-- 待处理建议 -->
            <section v-if="diff" class="pl-diff">
                <header class="pl-diff-head">
                    <span class="pl-diff-title">{{ diff.title }}</span>
                    <span v-if="diff.stale" class="pl-tag" data-kind="warn">正文已变</span>
                </header>

                <div v-if="diff.anchor" class="pl-diff-anchor">接在「{{ diff.anchor }}」后面</div>

                <div v-if="diff.before" class="pl-diff-line" data-kind="before">
                    <span class="pl-diff-sign">−</span><span>{{ diff.before }}</span>
                </div>
                <div class="pl-diff-line" data-kind="after">
                    <span class="pl-diff-sign">+</span><span>{{ draftNext }}</span>
                </div>

                <p v-if="diff.reason" class="pl-diff-reason">{{ diff.reason }}</p>

                <details class="pl-diff-edit">
                    <summary>不太对？改一改再采用</summary>
                    <textarea v-model="draftNext" class="pl-code-input" rows="3"></textarea>
                    <p v-if="touched" class="pl-diff-touched">已经改过顾问的原话</p>
                </details>

                <div class="pl-row-actions">
                    <PlButton label="忽略" variant="quiet" @click="onIgnore" />
                    <PlButton label="再问一次" icon-name="refresh" variant="ghost" @click="$emit('go-ask')" />
                    <PlButton label="采用" icon-name="check" variant="primary" @click="onAdopt" />
                </div>
            </section>

            <PlEmpty
                v-else-if="!note"
                icon-name="refine"
                title="还没有待处理的建议"
                hint="去「提问」页切到顾问，让它读一遍刚才的对话。"
                action-label="去问顾问"
                @action="$emit('go-ask')"
            />

            <!-- 修改日志 -->
            <section class="pl-lib-section">
                <PlSectionTitle title="修改日志" :hint="log.length ? log.length + ' 条' : '还没有修改'">
                    <template #action>
                        <PlButton v-if="log.length" label="清空" size="sm" variant="quiet" @click="onClearLog" />
                    </template>
                </PlSectionTitle>

                <ul v-if="log.length" class="pl-log">
                    <li v-for="entry in log" :key="entry.id" class="pl-log-item">
                        <div class="pl-log-main">
                            <span class="pl-log-title">{{ entry.title }}</span>
                            <span class="pl-log-time">{{ formatRelative(entry.createdAt) }}</span>
                        </div>
                        <p v-if="entry.before" class="pl-log-line" data-kind="before">{{ entry.before }}</p>
                        <p class="pl-log-line" data-kind="after">{{ entry.after }}</p>
                        <p v-if="entry.reason" class="pl-log-reason">{{ entry.reason }}</p>
                        <PlButton label="撤回到这之前" icon-name="undo" size="sm" variant="quiet" @click="onUndo(entry)" />
                    </li>
                </ul>
            </section>
        </div>
    `,
};

export default PlPanelRefine;
