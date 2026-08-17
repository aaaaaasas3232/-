/**
 * 湛蓝回忆 · 回顾 / 存档 / CG 三个面板
 *
 * 放在一个文件里是因为它们共享同一种「时间轴列表 + 卡片」的形态,
 * 拆三个文件会导致同一套结构复制三遍(原型就是这样,`renderTimeline`
 * `renderCgGallery` `renderSaveManager` 三个函数里同样的展开/折叠逻辑写了三遍)。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { asArray, formatRelative, truncate } from '../utils.js';

// ============================================================
// 回顾
// ============================================================

/**
 * 只显示**当前线路**。
 *
 * 原型的时间轴是一条全局 `logHistory`,回溯之后新旧两条线的内容混在一起,
 * 读起来前言不搭后语。剧情树天然有「路径」这个概念,顺着走一遍就是这条线的全部。
 * 想看别的线,去剧情树点过去就好。
 */
export const GgPanelLog = {
    name: 'GgPanelLog',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    computed: {
        state() { return store.getState(); },
        path() { return store.getCurrentPath(); },
        currentId() { return store.getGame()?.currentNodeId || ''; },
    },
    methods: {
        onJump(id) {
            if (store.setCurrentNode(id)) this.$emit('notify', '已切到这一幕');
        },
        rel(ts) { return formatRelative(ts); },
    },
    template: `
        <div class="gg-panel-body">
            <GgEmpty v-if="!path.length" text="还没有剧情" hint="生成第一幕之后这里会有完整回顾" />
            <ol v-else class="gg-log">
                <li v-for="(node, i) in path" :key="node.id" class="gg-log-item" :class="{ 'is-current': node.id === currentId }">
                    <div class="gg-log-head">
                        <span class="gg-log-index">{{ i + 1 }}</span>
                        <span v-if="node.choice.text" class="gg-log-choice" :class="{ 'is-custom': node.choice.kind === 'custom' }">
                            {{ node.choice.kind === 'custom' ? '我写下:' : '我选了:' }}{{ node.choice.text }}
                        </span>
                        <span v-else class="gg-log-choice">开场</span>
                        <button type="button" class="gg-log-jump" @click="onJump(node.id)">跳到这里</button>
                    </div>
                    <div class="gg-log-body">
                        <p v-for="(seg, si) in node.segments" :key="si" class="gg-log-line" :class="{ 'is-narration': !seg.speaker }">
                            <b v-if="seg.speaker">{{ seg.speaker }}</b>{{ seg.text }}
                        </p>
                    </div>
                    <p class="gg-log-time">{{ rel(node.createdAt) }}</p>
                </li>
            </ol>
        </div>
    `,
};

// ============================================================
// 存档
// ============================================================

export const GgPanelSave = {
    name: 'GgPanelSave',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { name: '' };
    },
    computed: {
        state() { return store.getState(); },
        game() { return store.getGame(); },
        saves() {
            return asArray(this.state.library.saves).filter((s) => s.gameId === this.state.activeGameId);
        },
        canSave() { return Boolean(store.getCurrentNode()); },
    },
    methods: {
        onSave() {
            const save = store.createSave(this.name);
            if (!save) { this.$emit('notify', '当前没有可以存的进度'); return; }
            this.name = '';
            this.$emit('notify', `已存「${save.name}」`);
        },
        async onLoad(save) {
            await store.loadSave(save.id);
        },
        onRemove(save) { store.removeSave(save.id); },
        rel(ts) { return formatRelative(ts); },
    },
    template: `
        <div class="gg-panel-body">
            <p class="gg-hint">
                存档记的是「停在哪一幕 + 当时的好感度和主线状态」。剧情本体在分支树里,
                所以读档不会覆盖任何已经走过的线。
            </p>
            <div class="gg-save-new">
                <GgInput v-model="name" placeholder="给这个档起个名(可留空)" @enter="onSave" />
                <GgButton variant="primary" icon-name="save" :disabled="!canSave" @click="onSave">存档</GgButton>
            </div>

            <GgEmpty v-if="!saves.length" text="还没有存档" />
            <div v-for="s in saves" :key="s.id" class="gg-save-card">
                <div class="gg-save-main">
                    <span class="gg-save-name">{{ s.name }}</span>
                    <span class="gg-save-preview">{{ s.preview }}</span>
                    <span class="gg-save-time">{{ rel(s.createdAt) }}</span>
                </div>
                <div class="gg-save-actions">
                    <GgButton size="sm" variant="ghost" icon-name="play" @click="onLoad(s)">读取</GgButton>
                    <GgButton size="sm" icon-name="trash" icon-only label="删除" @click="onRemove(s)" />
                </div>
            </div>
        </div>
    `,
};

// ============================================================
// CG
// ============================================================

/**
 * CG 画廊。
 *
 * 原型这里其实**只生成文字描述**(`generateCgDescription`),然后拿一张固定的
 * 占位图当封面 —— 名字叫「生成新 CG」,实际生成的是一段话。
 * 这段话是「可以留下来的一瞬」,不是拿去文生图的立绘提示词。
 * 想配图的话,图链接由用户自己贴回来。
 */
export const GgPanelCg = {
    name: 'GgPanelCg',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { editing: '' };
    },
    computed: {
        state() { return store.getState(); },
        cgs() {
            return asArray(this.state.library.cgs).filter((c) => !c.gameId || c.gameId === this.state.activeGameId);
        },
        canGenerate() { return Boolean(store.getCurrentNode()) && !this.state.cgBusy; },
    },
    methods: {
        async onGenerate() {
            const result = await store.generateCg();
            if (!result.ok) { this.$emit('notify', result.error); return; }
            this.editing = result.cg.id;
            this.$emit('notify', '这一瞬记下了。想配图的话把链接贴上来');
        },
        onField(cg, patch) { store.updateCg(cg.id, patch); },
        onRemove(cg) { store.removeCg(cg.id); },
        onExpand(cg) { this.editing = this.editing === cg.id ? '' : cg.id; },
        async onCopy(cg) {
            try {
                await navigator.clipboard.writeText(cg.description);
                this.$emit('notify', '描述已复制');
            } catch (_) {
                this.$emit('notify', '浏览器不让复制,手动选中吧');
            }
        },
        rel(ts) { return formatRelative(ts); },
        short(t) { return truncate(t, 42); },
    },
    template: `
        <div class="gg-panel-body">
            <div class="gg-row-actions">
                <GgButton variant="primary" icon-name="sparkle" :loading="state.cgBusy" :disabled="!canGenerate" @click="onGenerate">
                    把这一幕写成画面
                </GgButton>
            </div>
            <p class="gg-hint">生成的是一段可以留下来的画面,像相册里还没配图的那一张。想配图就自己贴链接,不是拿去画角色卡的。</p>

            <GgEmpty v-if="!cgs.length" text="画廊还是空的" hint="走到喜欢的一幕就存一张" />
            <div class="gg-cg-grid">
                <div v-for="cg in cgs" :key="cg.id" class="gg-cg-card" :class="{ 'is-open': editing === cg.id }">
                    <button type="button" class="gg-cg-cover" @click="onExpand(cg)">
                        <img v-if="cg.imageUrl" :src="cg.imageUrl" :alt="cg.title" />
                        <GgIcon v-else name="image" />
                    </button>
                    <div class="gg-cg-meta">
                        <span class="gg-cg-title">{{ cg.title }}</span>
                        <span class="gg-cg-time">{{ rel(cg.createdAt) }}</span>
                    </div>

                    <div v-if="editing === cg.id" class="gg-cg-detail">
                        <GgField label="标题">
                            <GgInput :model-value="cg.title" @update:model-value="onField(cg, { title: $event })" />
                        </GgField>
                        <GgField label="画面描述">
                            <GgTextarea :model-value="cg.description" :rows="5" @update:model-value="onField(cg, { description: $event })" />
                        </GgField>
                        <GgField label="图片链接">
                            <GgInput :model-value="cg.imageUrl" placeholder="出好图之后贴回来" @update:model-value="onField(cg, { imageUrl: $event })" />
                        </GgField>
                        <div class="gg-row-actions">
                            <GgButton size="sm" variant="ghost" icon-name="copy" @click="onCopy(cg)">复制描述</GgButton>
                            <GgButton size="sm" variant="danger" icon-name="trash" @click="onRemove(cg)">删除</GgButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
};

export const ARCHIVE_PANELS = { GgPanelLog, GgPanelSave, GgPanelCg };
