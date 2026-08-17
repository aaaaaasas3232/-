/**
 * 萤火 · 弹窗（store.modal 驱动，全部小巧居中卡）
 *
 * 类型：
 *   confirm         通用确认（危险操作红按钮）
 *   reroll          重 roll 意见框 —— **意见必填**，空的不给发
 *   share           分享到 murmur：挑一个当前世界的 AI + 可选附言
 *   upload-editor   发布 / 编辑视频（标题必填；分段内容一行一段）
 *   channel-editor  我的频道资料（昵称 / 粉丝数 / 简介）
 *   gallery-picker  绑定头像图库 + 重新分配
 *   theme-save      存新配色
 *   theme-rename    配色改名
 *
 * 统一规矩：Escape / 点遮罩 = 取消；取消不产生任何副作用。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import * as world from '../services/world-context.js';
import * as avatarPool from '../services/avatar-pool.js';
import { asArray } from '../utils.js';

/** 弹窗外壳 */
const YtSheet = {
    name: 'YtSheet',
    components: { ...UI },
    props: {
        title: { type: String, default: '' },
        desc: { type: String, default: '' },
    },
    emits: ['close'],
    mounted() {
        this._onKey = (e) => { if (e.key === 'Escape') this.$emit('close'); };
        window.addEventListener('keydown', this._onKey);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this._onKey);
    },
    template: `
        <div class="yt-modal" @click.self="$emit('close')">
            <div class="yt-modal__card" role="dialog" :aria-label="title">
                <div class="yt-modal__head">
                    <b>{{ title }}</b>
                    <button type="button" class="yt-modal__x" aria-label="关闭" @click="$emit('close')"><YtIcon name="close" :size="16" /></button>
                </div>
                <p v-if="desc" class="yt-modal__desc">{{ desc }}</p>
                <div class="yt-modal__body"><slot></slot></div>
            </div>
        </div>
    `,
};

// ============================================================
// confirm
// ============================================================

const ConfirmModal = {
    name: 'YtConfirmModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        return { busy: false };
    },
    methods: {
        async ok() {
            if (this.busy) return;
            this.busy = true;
            try {
                await this.payload.onOk?.();
            } finally {
                this.busy = false;
                this.$emit('close');
            }
        },
    },
    template: `
        <YtSheet :title="payload.title || '确认'" :desc="payload.message || ''" @close="$emit('close')">
            <div class="yt-modal__actions">
                <YtButton variant="ghost" @click="$emit('close')">{{ payload.cancelLabel || '取消' }}</YtButton>
                <YtButton :variant="payload.danger ? 'danger' : 'primary'" :loading="busy" @click="ok">{{ payload.okLabel || '确认' }}</YtButton>
            </div>
        </YtSheet>
    `,
};

// ============================================================
// reroll（意见必填）
// ============================================================

const RerollModal = {
    name: 'YtRerollModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        return { opinion: '', busy: false };
    },
    methods: {
        async ok() {
            const text = this.opinion.trim();
            if (!text || this.busy) return;
            this.busy = true;
            try {
                await this.payload.onOk?.(text);
            } finally {
                this.busy = false;
                this.$emit('close');
            }
        },
    },
    template: `
        <YtSheet :title="payload.title || '重 roll'" desc="说说上一版哪里不行 —— 意见会进入这次的提示词，空着不能发。" @close="$emit('close')">
            <textarea class="yt-textarea" rows="4" v-model="opinion" placeholder="比如：题材换成日常一点的 / 标题太浮夸了"></textarea>
            <div class="yt-modal__actions">
                <YtButton variant="ghost" @click="$emit('close')">算了</YtButton>
                <YtButton variant="primary" :disabled="!opinion.trim()" :loading="busy" @click="ok">带意见重 roll</YtButton>
            </div>
        </YtSheet>
    `,
};

// ============================================================
// share（挑当前世界的 AI）
// ============================================================

const ShareModal = {
    name: 'YtShareModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        return { aiId: '', note: '', busy: false, ais: [] };
    },
    created() {
        this.ais = world.listWorldAis();
        if (this.ais.length === 1) this.aiId = this.ais[0].id;
    },
    methods: {
        async ok() {
            if (!this.aiId || this.busy) return;
            this.busy = true;
            try {
                await store.shareVideo(this.payload.video, this.aiId, this.note.trim());
            } finally {
                this.busy = false;
                this.$emit('close');
            }
        },
    },
    template: `
        <YtSheet title="分享到聊天" desc="发一张视频卡给 TA。对方点开卡片时才会恢复 / 生成详情。" @close="$emit('close')">
            <p v-if="!ais.length" class="yt-muted">当前世界还没绑定 AI，没有可以分享的人。</p>
            <div v-else class="yt-share__list">
                <button
                    v-for="a in ais" :key="a.id"
                    type="button" class="yt-share__ai" :class="{ 'is-on': aiId === a.id }"
                    @click="aiId = a.id"
                >
                    <YtAvatar :name="a.name" :url="a.avatar" :size="34" />
                    <span>{{ a.name }}</span>
                </button>
            </div>
            <input v-if="ais.length" class="yt-input" v-model="note" maxlength="60" placeholder="附一句话（可选）" />
            <div class="yt-modal__actions">
                <YtButton variant="ghost" @click="$emit('close')">取消</YtButton>
                <YtButton variant="primary" :disabled="!aiId" :loading="busy" @click="ok">分享</YtButton>
            </div>
        </YtSheet>
    `,
};

// ============================================================
// upload-editor（发布 / 编辑）
// ============================================================

const UploadEditorModal = {
    name: 'YtUploadEditorModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        const editing = this.payload.mode === 'edit';
        const row = editing
            ? store.getState().uploads.find((u) => String(u.id) === String(this.payload.uploadId))
            : null;
        return {
            editing,
            title: row?.title || '',
            coverText: row?.coverText || '',
            kind: row?.kind || '',
            blurb: row?.blurb || '',
            intro: row?.intro || '',
            sectionsText: asArray(row?.sections).map((s) => `${s.at || '00:00'} ${s.text}`).join('\n'),
            busy: false,
        };
    },
    computed: {
        heading() { return this.editing ? '编辑视频' : '发布视频'; },
        hint() {
            return this.editing
                ? '视频数据（播放 / 评论总量）不会因为编辑而变。'
                : '发布不调 AI。播放量和评论总量按你的粉丝规模当场算出来。';
        },
    },
    methods: {
        parseSections() {
            return this.sectionsText.split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                    const m = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
                    return m ? { at: m[1], text: m[2] } : { at: '', text: line };
                });
        },
        async ok() {
            const title = this.title.trim();
            if (!title || this.busy) return;
            this.busy = true;
            try {
                const form = {
                    title,
                    coverText: this.coverText.trim(),
                    kind: this.kind.trim(),
                    blurb: this.blurb.trim(),
                    intro: this.intro,
                    sections: this.parseSections(),
                };
                if (this.editing) await store.updateUpload(this.payload.uploadId, form);
                else await store.publishUpload(form);
            } finally {
                this.busy = false;
                this.$emit('close');
            }
        },
    },
    template: `
        <YtSheet :title="heading" :desc="hint" @close="$emit('close')">
            <YtField label="标题">
                <input class="yt-input" v-model="title" maxlength="40" placeholder="视频标题（必填）" />
            </YtField>
            <div class="yt-modal__grid">
                <YtField label="封面大字">
                    <input class="yt-input" v-model="coverText" maxlength="10" placeholder="默认取标题" />
                </YtField>
                <YtField label="分区">
                    <input class="yt-input" v-model="kind" maxlength="6" placeholder="如 日常" />
                </YtField>
            </div>
            <YtField label="一句话预告">
                <input class="yt-input" v-model="blurb" maxlength="60" placeholder="列表里显示的那句" />
            </YtField>
            <YtField label="简介">
                <textarea class="yt-textarea" rows="3" v-model="intro" placeholder="详情页里的简介"></textarea>
            </YtField>
            <YtField label="视频内容（一行一段，可写时间点）" hint="例：00:00 开场白 / 01:20 进入正题">
                <textarea class="yt-textarea" rows="4" v-model="sectionsText" placeholder="00:00 开场&#10;01:20 正片"></textarea>
            </YtField>
            <div class="yt-modal__actions">
                <YtButton variant="ghost" @click="$emit('close')">取消</YtButton>
                <YtButton variant="primary" :disabled="!title.trim()" :loading="busy" @click="ok">{{ editing ? '保存' : '发布' }}</YtButton>
            </div>
        </YtSheet>
    `,
};

// ============================================================
// channel-editor
// ============================================================

const ChannelEditorModal = {
    name: 'YtChannelEditorModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        const c = store.userChannel();
        return { nickname: c.nickname, followers: c.followers, bio: c.bio };
    },
    methods: {
        async ok() {
            await store.updateChannel({
                nickname: this.nickname,
                followers: Number(this.followers) || 0,
                bio: this.bio,
            });
            this.$emit('close');
        },
    },
    template: `
        <YtSheet title="我的频道" desc="粉丝数决定你发视频后的播放和评论规模（本地计算）。" @close="$emit('close')">
            <YtField label="昵称">
                <input class="yt-input" v-model="nickname" maxlength="20" />
            </YtField>
            <YtField label="粉丝数">
                <input class="yt-input" type="number" min="0" v-model="followers" />
            </YtField>
            <YtField label="频道简介">
                <input class="yt-input" v-model="bio" maxlength="100" placeholder="一句话介绍（可选）" />
            </YtField>
            <div class="yt-modal__actions">
                <YtButton variant="ghost" @click="$emit('close')">取消</YtButton>
                <YtButton variant="primary" :disabled="!nickname.trim()" @click="ok">保存</YtButton>
            </div>
        </YtSheet>
    `,
};

// ============================================================
// gallery-picker
// ============================================================

const GalleryPickerModal = {
    name: 'YtGalleryPickerModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        return { groups: [], loading: true, busyReassign: false };
    },
    computed: {
        s() { return store.getState(); },
        currentId() { return this.s.profile?.galleryGroupId || ''; },
    },
    async created() {
        this.groups = await avatarPool.listGalleryGroups();
        this.loading = false;
    },
    methods: {
        async pick(group) {
            if (this.currentId === group.id) return;
            await store.setGalleryGroup(group.id, group.name);
        },
        async unbind() {
            await store.setGalleryGroup('', '');
        },
        async reassign() {
            if (this.busyReassign) return;
            this.busyReassign = true;
            try {
                await store.reassignAvatars();
            } finally {
                this.busyReassign = false;
            }
        },
    },
    template: `
        <YtSheet title="头像图库" desc="站内用户的头像从选中的图组里取。已认识的人默认保持原来的脸；想全部换一遍就点「重新分配」。" @close="$emit('close')">
            <p v-if="loading" class="yt-muted">正在读图库…</p>
            <template v-else>
                <p v-if="!groups.length" class="yt-muted">图库里还没有图组。去「设置 → 图库」建一个，传些头像图进去。</p>
                <button
                    v-for="g in groups" :key="g.id"
                    type="button" class="yt-ob__card" :class="{ 'is-on': currentId === g.id }"
                    @click="pick(g)"
                >
                    <span class="yt-ob__tick"></span>
                    <span class="yt-ob__card-main">
                        <span class="yt-ob__card-title">{{ g.name }}</span>
                        <span class="yt-ob__card-sub">{{ g.path }} · {{ g.imageCount }} 张</span>
                    </span>
                </button>
                <div class="yt-modal__actions">
                    <YtButton v-if="currentId" variant="ghost" @click="unbind">解绑</YtButton>
                    <YtButton v-if="currentId" variant="soft" icon-name="refresh" :loading="busyReassign" @click="reassign">重新分配头像</YtButton>
                    <YtButton variant="primary" @click="$emit('close')">完成</YtButton>
                </div>
            </template>
        </YtSheet>
    `,
};

// ============================================================
// theme-save / theme-rename
// ============================================================

const ThemeSaveModal = {
    name: 'YtThemeSaveModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        return { name: '' };
    },
    methods: {
        ok() {
            const name = this.name.trim();
            if (!name) return;
            const theme = store.saveCustomTheme({
                name,
                baseThemeId: this.payload.baseThemeId,
                colors: this.payload.colors,
            });
            if (theme) {
                store.applyThemeSelection({
                    baseThemeId: theme.baseThemeId,
                    customColors: theme.colors,
                    customThemeId: theme.id,
                });
                store.showToast(`已保存「${name}」`);
            }
            this.$emit('close');
        },
    },
    template: `
        <YtSheet title="存为新配色" @close="$emit('close')">
            <input class="yt-input" v-model="name" maxlength="12" placeholder="给这套配色起个名字" @keydown.enter="ok" />
            <div class="yt-modal__actions">
                <YtButton variant="ghost" @click="$emit('close')">取消</YtButton>
                <YtButton variant="primary" :disabled="!name.trim()" @click="ok">保存</YtButton>
            </div>
        </YtSheet>
    `,
};

const ThemeRenameModal = {
    name: 'YtThemeRenameModal',
    components: { ...UI, YtSheet },
    props: { payload: { type: Object, required: true } },
    emits: ['close'],
    data() {
        return { name: this.payload.theme?.name || '' };
    },
    methods: {
        ok() {
            const name = this.name.trim();
            if (!name) return;
            store.updateCustomTheme(this.payload.theme.id, { name });
            store.showToast('已改名');
            this.$emit('close');
        },
    },
    template: `
        <YtSheet title="配色改名" @close="$emit('close')">
            <input class="yt-input" v-model="name" maxlength="12" @keydown.enter="ok" />
            <div class="yt-modal__actions">
                <YtButton variant="ghost" @click="$emit('close')">取消</YtButton>
                <YtButton variant="primary" :disabled="!name.trim()" @click="ok">保存</YtButton>
            </div>
        </YtSheet>
    `,
};

// ============================================================
// 出口：按 type 分发
// ============================================================

const MODAL_MAP = {
    'confirm': ConfirmModal,
    'reroll': RerollModal,
    'share': ShareModal,
    'upload-editor': UploadEditorModal,
    'channel-editor': ChannelEditorModal,
    'gallery-picker': GalleryPickerModal,
    'theme-save': ThemeSaveModal,
    'theme-rename': ThemeRenameModal,
};

export const YtModals = {
    name: 'YtModals',
    // ★ key 必须是模板里 :is 能解析到的组件名（AGENTS2 §16.5 ①）——
    //   这里直接把组件对象传给 :is，绕开字符串解析
    computed: {
        s() { return store.getState(); },
        modal() { return this.s.modal; },
        comp() { return this.modal ? MODAL_MAP[this.modal.type] || null : null; },
    },
    methods: {
        close() { store.closeModal(); },
    },
    template: `
        <component v-if="comp" :is="comp" :payload="modal.payload || {}" @close="close" />
    `,
};
