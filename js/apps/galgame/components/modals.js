/**
 * 湛蓝回忆 · 弹窗
 *
 * 全部套 `GgModal`(遮罩关闭、无叉)。每个弹窗只做一件事,
 * 关闭一律 `$emit('close')` 交给根组件收口 —— 弹窗自己不去动 `store.closeModal`,
 * 免得出现「有的地方关得掉、有的地方关不掉」。
 */

import * as store from '../store.js';
import * as nook from '../services/nook-bridge.js';
import { GgModal } from './gg-modal.js';
import { SHARED_COMPONENTS } from './shared.js';
import { CUSTOM_PLOT_MAX, GENRES } from '../constants.js';
import { findById, asArray } from '../utils.js';

const BASE = { GgModal, ...SHARED_COMPONENTS };

// ============================================================
// 自定义剧情
// ============================================================

/**
 * 玩家自己写这一步怎么走。
 *
 * ★ 原型这个弹窗有个静默 bug:`handleCustomPlotConfirm` 里判断
 *   `if (plotText.length > 500) return;` —— 超字数直接 return,
 *   **既不提示也不关弹窗**,用户点确认发现毫无反应。
 *   这里改成输入框硬限长 + 实时字数,根本到不了那个分支。
 */
export const GgCustomPlotModal = {
    name: 'GgCustomPlotModal',
    components: BASE,
    emits: ['close', 'notify'],
    data() {
        return { text: '', MAX: CUSTOM_PLOT_MAX };
    },
    computed: {
        left() { return this.MAX - this.text.length; },
        canSend() { return this.text.trim().length > 0; },
    },
    methods: {
        async onSend() {
            if (!this.canSend) return;
            const value = this.text.trim();
            this.$emit('close');
            const result = await store.generateNext({ kind: 'custom', choice: value });
            if (result && result.ok === false) this.$emit('notify', result.error);
        },
    },
    template: `
        <GgModal title="自己写一个走向" subtitle="不在选项里的做法,直接告诉编剧" @close="$emit('close')">
            <GgTextarea v-model="text" :rows="4" :maxlength="MAX" placeholder="例:我假装没认出她,先走开一段距离看看她会不会追上来" />
            <p class="gg-modal-count">还能写 {{ left }} 字</p>
            <p class="gg-hint">写的是**你要做什么**,不是要 AI 写什么。它会顺着这个走向往下编,不会照抄成台词。</p>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canSend" @click="onSend">就这么走</button>
            </template>
        </GgModal>
    `,
};

// ============================================================
// 手记
// ============================================================

export const GgNoteModal = {
    name: 'GgNoteModal',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        const note = this.payload?.noteId
            ? findById(store.getGame()?.notes, this.payload.noteId)
            : null;
        return {
            isNew: !note,
            title: note?.title || '',
            content: note?.content || '',
        };
    },
    methods: {
        onSave() {
            const title = this.title.trim() || '未命名';
            const content = this.content.trim();
            if (!content) { this.$emit('notify', '写点内容再存'); return; }
            if (this.isNew) store.addNote({ title, content });
            else store.updateNote(this.payload.noteId, { title, content });
            this.$emit('close');
        },
    },
    template: `
        <GgModal :title="isNew ? '写一条手记' : '改这条手记'" subtitle="会一直待在上下文里" @close="$emit('close')">
            <GgField label="标题"><GgInput v-model="title" placeholder="例:她的忌讳" /></GgField>
            <GgField label="内容"><GgTextarea v-model="content" :rows="5" placeholder="设定级的东西写这儿:身世、约定、习惯、地名…" /></GgField>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </GgModal>
    `,
};

// ============================================================
// 自定义提示词
// ============================================================

export const GgPromptModal = {
    name: 'GgPromptModal',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        const item = this.payload?.promptId
            ? findById(store.getGame()?.customPrompts, this.payload.promptId)
            : null;
        return {
            isNew: !item,
            title: item?.title || '',
            content: item?.content || '',
        };
    },
    methods: {
        onSave() {
            const game = store.getGame();
            if (!game) return;
            const content = this.content.trim();
            if (!content) { this.$emit('notify', '写点内容再存'); return; }
            const list = asArray(game.customPrompts);
            if (this.isNew) {
                store.updateGame({
                    customPrompts: [...list, { id: `cp-${Date.now().toString(36)}`, title: this.title.trim(), content, enabled: true }],
                });
            } else {
                store.updateGame({
                    customPrompts: list.map((p) => (p.id === this.payload.promptId ? { ...p, title: this.title.trim(), content } : p)),
                });
            }
            this.$emit('close');
        },
    },
    template: `
        <GgModal :title="isNew ? '加一条提示词' : '改提示词'" subtitle="直接拼进 system prompt" @close="$emit('close')">
            <GgField label="标题"><GgInput v-model="title" placeholder="例:文风要求" /></GgField>
            <GgField label="正文" hint="写给 AI 看的指令,不是功能说明">
                <GgTextarea v-model="content" :rows="6" placeholder="例:每一幕都要有一处具体的感官细节(声音/气味/触感),不要只写表情和对话。" />
            </GgField>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </GgModal>
    `,
};

// ============================================================
// 新建一局
// ============================================================

export const GgNewGameModal = {
    name: 'GgNewGameModal',
    components: BASE,
    emits: ['close', 'notify'],
    data() {
        const worlds = nook.listWorlds();
        const users = nook.listUserCards();
        return {
            title: '',
            worldId: worlds[0]?.id || '',
            userPersonaId: users.find((u) => u.isDefault)?.id || users[0]?.id || '',
            genre: 'romance',
            castIds: [],
            worlds,
            users,
        };
    },
    computed: {
        world() { return nook.getWorld(this.worldId, nook.getPlayerCard(this.userPersonaId)); },
        roster() { return nook.listWorldAis(this.world); },
        worldOptions() { return this.worlds.map((w) => ({ value: w.id, label: w.name })); },
        userOptions() { return this.users.map((u) => ({ value: u.id, label: u.isDefault ? `${u.name}(默认)` : u.name })); },
        genreOptions() { return GENRES.filter((g) => g.id).map((g) => ({ value: g.id, label: g.label })); },
        canCreate() { return this.castIds.length > 0; },
    },
    methods: {
        toggleCast(id) {
            this.castIds = this.castIds.includes(id)
                ? this.castIds.filter((x) => x !== id)
                : [...this.castIds, id];
        },
        async onCreate() {
            if (!this.canCreate) { this.$emit('notify', '至少挑一位出场角色'); return; }
            await store.createGame({
                title: this.title.trim(),
                worldId: this.worldId,
                userPersonaId: this.userPersonaId,
                genre: this.genre,
                castIds: this.castIds,
            });
            this.$emit('close');
            this.$emit('notify', '开局了,按「开始这个故事」写第一幕');
        },
    },
    template: `
        <GgModal title="新建一局" subtitle="人设和世界观都从 nook 里挑" @close="$emit('close')">
            <GgEmpty v-if="!worlds.length" text="nook 里还没有世界观" hint="先去 nook 建一个世界观和几张人设卡" />
            <template v-else>
                <GgField label="标题" hint="留空就用世界观的名字"><GgInput v-model="title" placeholder="湛蓝回忆" /></GgField>
                <GgField label="世界观"><GgSelect v-model="worldId" :options="worldOptions" /></GgField>
                <GgField label="我扮演"><GgSelect v-model="userPersonaId" :options="userOptions" /></GgField>
                <GgField label="题材"><GgSelect v-model="genre" :options="genreOptions" /></GgField>
                <GgField label="出场角色" hint="之后还能改;立绘在「设定 → 出场角色」里配">
                    <div class="gg-pick-list">
                        <GgEmpty v-if="!roster.length" text="这个世界观下还没有 AI 人设" />
                        <button
                            v-for="ai in roster"
                            :key="ai.id"
                            type="button"
                            class="gg-pick-item"
                            :class="{ 'is-on': castIds.includes(ai.id) }"
                            @click="toggleCast(ai.id)"
                        >
                            <GgIcon :name="castIds.includes(ai.id) ? 'check' : 'plus'" />
                            <span>{{ ai.name }}</span>
                        </button>
                    </div>
                </GgField>
            </template>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canCreate" @click="onCreate">开始</button>
            </template>
        </GgModal>
    `,
};

// ============================================================
// 存配色
// ============================================================

export const GgThemeSaveModal = {
    name: 'GgThemeSaveModal',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { name: '' };
    },
    methods: {
        onSave() {
            const saved = store.saveCustomTheme({
                name: this.name.trim() || '我的配色',
                baseThemeId: this.payload.baseThemeId,
                colors: this.payload.colors,
            });
            this.$emit('close');
            this.$emit('notify', `已存「${saved.name}」`);
        },
    },
    template: `
        <GgModal title="存成一套配色" @close="$emit('close')">
            <GgField label="名字"><GgInput v-model="name" placeholder="给这套配色起个名" @enter="onSave" /></GgField>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </GgModal>
    `,
};

export const MODAL_COMPONENTS = {
    GgCustomPlotModal,
    GgNoteModal,
    GgPromptModal,
    GgNewGameModal,
    GgThemeSaveModal,
};
