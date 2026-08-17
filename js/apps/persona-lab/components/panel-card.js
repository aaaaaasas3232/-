/**
 * 人设机 · 档案面板
 *
 * 三件事:改正文、看它会落成哪些字段、存回 nook。
 *
 * ── 为什么编辑器不做「带行号的输入框」 ──────────────────────────────
 *
 * 原型花了很大力气做 textarea + 左侧行号栏(`preventEditorJumping` /
 * `ensureLineNumbersMatch` / `syncScrolling` / 三个同名的 `updateLineNumbers`)。
 * 这套东西**注定会错行**:textarea 里一行文字换行显示成两行时,
 * 行号栏那一格只有一行高,往下所有编号都错位。原型的 `ensureLineNumbersMatch`
 * 就是在打这个补丁,而它只在字体和宽度都不变时才成立 ——
 * 手机上转个屏就废了。
 *
 * 这里换个思路:**两个视图,各自做好一件事。**
 *   - 「整段」:普通 textarea,正常换行,手机上打字最顺
 *   - 「按行」:只读的编号列表,点某一行弹出小抽屉改那一行
 *
 * 行号只在只读视图里出现,一行一格,不可能错位。而顾问引用的行号,
 * 和这个视图、和 `utils.toLines` 是同一套编号。
 */

import { SHARED_COMPONENTS } from './shared.js';
import * as store from '../store.js';
import { describePatch } from '../services/card-schema.js';
import { saveDraftToNook } from '../services/nook-bridge.js';
import { SCOPES } from '../constants.js';
import { toLines, countWords, formatRelative } from '../utils.js';

const VIEWS = [
    { id: 'raw', label: '整段' },
    { id: 'lines', label: '按行' },
];

export const PlPanelCard = {
    name: 'PlPanelCard',
    components: { ...SHARED_COMPONENTS },
    props: {
        app: { type: Object, required: true },
        draft: { type: Object, required: true },
    },
    emits: ['notify'],
    data() {
        return { view: 'raw', VIEWS, SCOPES, editing: null, editText: '', saving: false };
    },
    computed: {
        text: {
            get() { return this.draft.text; },
            set(v) { store.setDraftText(this.draft.id, v); },
        },
        scope: {
            get() { return this.draft.scope; },
            set(v) { store.setDraftScope(this.draft.id, v); },
        },
        lines() { return toLines(this.draft.text); },
        words() { return countWords(this.draft.text); },
        patch() { return describePatch(this.draft.text); },
        dirty() { return store.isDirty(this.draft); },

        bindLabel() {
            if (!this.draft.personaId) return '还没绑定 nook 的卡，保存时会新建一张';
            return `保存时覆盖 nook 里的这张卡（${this.draft.personaId}）`;
        },
        saveLabel() {
            return this.draft.personaId ? '覆盖保存到 nook' : '保存到 nook';
        },
    },
    methods: {
        formatRelative,

        // ── 按行编辑 ──────────────────────────
        onEditLine(index) {
            this.editing = index;
            this.editText = this.lines[index] ?? '';
        },
        closeLineEditor() {
            this.editing = null;
            this.editText = '';
        },
        commitLine() {
            if (this.editing == null) return;
            const next = this.lines.slice();
            next[this.editing] = this.editText;
            store.setDraftText(this.draft.id, next.join('\n'));
            this.closeLineEditor();
        },
        insertAfter() {
            if (this.editing == null) return;
            const next = this.lines.slice();
            next.splice(this.editing + 1, 0, '');
            store.setDraftText(this.draft.id, next.join('\n'));
            const at = this.editing + 1;
            this.closeLineEditor();
            this.$nextTick(() => this.onEditLine(at));
        },
        deleteLine() {
            if (this.editing == null) return;
            const next = this.lines.slice();
            next.splice(this.editing, 1);
            store.setDraftText(this.draft.id, next.join('\n'));
            this.closeLineEditor();
        },

        // ── 保存 ──────────────────────────────
        onSave() {
            const target = this.draft.personaId ? '覆盖' : '新建';
            store.openModal('confirm', {
                title: this.draft.personaId ? '覆盖 nook 里的这张卡?' : '在 nook 里新建一张卡?',
                text: this.draft.personaId
                    ? `会把正文里识别到的 ${this.patch.filled} 个字段写回原卡，没写到的字段保持原样。`
                    : `会在「${this.scope === 'user' ? '用户人设' : 'AI 人设'}」里新建一张，含 ${this.patch.filled} 个字段。`,
                confirmLabel: target === '覆盖' ? '覆盖' : '新建',
                onConfirm: () => this.doSave(),
            });
        },

        async doSave() {
            if (this.saving) return;
            this.saving = true;
            try {
                const res = await saveDraftToNook(this.draft);
                if (!res.ok) {
                    this.$emit('notify', res.error || '保存失败');
                    return;
                }
                store.markSaved(this.draft.id, { personaId: res.id, scope: this.draft.scope });
                this.$emit('notify', res.created
                    ? `已在 nook 新建「${res.name}」，写入 ${res.fields} 个字段`
                    : `已覆盖 nook 里的「${res.name}」，更新 ${res.fields} 个字段`);
            } finally {
                this.saving = false;
            }
        },
    },
    template: `
        <div class="pl-card-panel">
            <!-- 归属 -->
            <section class="pl-lib-section">
                <PlSectionTitle title="归属" :hint="bindLabel" />
                <PlSegmented v-model="scope" :items="SCOPES" />
            </section>

            <!-- 正文 -->
            <section class="pl-lib-section">
                <PlSectionTitle title="人设正文" :hint="lines.length + ' 行 · ' + words + ' 字'">
                    <template #action>
                        <PlSegmented v-model="view" :items="VIEWS" />
                    </template>
                </PlSectionTitle>

                <textarea
                    v-if="view === 'raw'"
                    v-model="text"
                    class="pl-code-input"
                    rows="14"
                    placeholder="一行一条「键：值」，比如&#10;姓名：林栖&#10;性格：安静，被问到在意的事会突然话多"
                ></textarea>

                <ol v-else class="pl-lines">
                    <li v-for="(line, i) in lines" :key="i">
                        <button type="button" class="pl-line" @click="onEditLine(i)">
                            <span class="pl-line-no">{{ i + 1 }}</span>
                            <span class="pl-line-text" :data-empty="line.trim() ? null : '1'">{{ line || '（空行）' }}</span>
                        </button>
                    </li>
                </ol>
            </section>

            <!-- 落库预览 -->
            <section class="pl-lib-section">
                <PlSectionTitle
                    title="会存成什么"
                    :hint="patch.filled + ' / ' + patch.total + ' 个字段有内容'"
                />

                <PlEmpty
                    v-if="!patch.rows.length"
                    icon-name="card"
                    title="正文里还没有能识别的字段"
                    hint="每行写成「姓名：林栖」这样，就会自动落到对应字段。"
                />

                <ul v-else class="pl-patch-list">
                    <li v-for="row in patch.rows" :key="row.key">
                        <span class="pl-patch-key">
                            {{ row.label }}
                            <span v-if="row.lines.length" class="pl-patch-lineno">第 {{ row.lines.join('、') }} 行</span>
                        </span>
                        <span class="pl-patch-val">{{ row.display.join(' / ') }}</span>
                    </li>
                </ul>

                <p v-if="patch.unmatchedLines" class="pl-patch-note">
                    有 {{ patch.unmatchedLines }} 行开头没写字段名，已经并进「角色介绍」。
                </p>
            </section>

            <!-- 保存 -->
            <section class="pl-lib-section pl-save-block">
                <p class="pl-save-state" :data-dirty="dirty ? '1' : null">
                    <template v-if="dirty">有改动还没存进 nook</template>
                    <template v-else-if="draft.savedAt">已同步 · {{ formatRelative(draft.savedAt) }}</template>
                    <template v-else>还没存过</template>
                </p>
                <PlButton
                    :label="saveLabel"
                    icon-name="save"
                    variant="primary"
                    block
                    :loading="saving"
                    :disabled="!patch.rows.length"
                    @click="onSave"
                />
            </section>

            <!-- 单行编辑抽屉 -->
            <PlSheet
                v-if="editing !== null"
                :title="'第 ' + (editing + 1) + ' 行'"
                subtitle="改完点保存，或者在下面插一行"
                @close="closeLineEditor"
            >
                <textarea v-model="editText" class="pl-code-input" rows="4"></textarea>
                <template #footer>
                    <PlButton label="删掉这行" variant="quiet" @click="deleteLine" />
                    <PlButton label="下面插一行" icon-name="plus" variant="ghost" @click="insertAfter" />
                    <PlButton label="保存" icon-name="check" variant="primary" @click="commitLine" />
                </template>
            </PlSheet>
        </div>
    `,
};

export default PlPanelCard;
