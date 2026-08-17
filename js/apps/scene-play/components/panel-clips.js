/**
 * 情景剧场 · 情景文案库
 *
 * 两种用法,刻意分开:
 *
 *   **套用**  把这段文案写进当前情景的「情景」字段。用完就是情景自己的了,
 *             之后改文案库不影响它。
 *   **引用**  把这段文案作为一个**独立的上下文段**挂在情景上。
 *             改文案库会跟着变,适合「所有情景共用的一段设定」。
 *
 * 第一版只有「套用」,结果用户改一段共用设定要挨个情景改一遍。
 *
 * ★ 标签栏用**可换行的 chips**,不用 `SpSegmented`:
 *   分段控件把每一格拉成等宽,内置文案扩到三十多条、十来个标签之后,
 *   在 390px 宽的屏幕上每一格只剩两三个像素,等于没有筛选。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { asArray, truncate } from '../utils.js';

export const SpPanelClips = {
    name: 'SpPanelClips',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() { return { filter: '' }; },
    computed: {
        scene() { return store.getScene(); },
        clips() { return store.getClips(); },
        /** 标签栏按「库里真的出现过的 tag」现算 —— 用户自己起的标签也会进来 */
        tags() {
            const counts = new Map();
            for (const clip of this.clips) {
                const tag = String(clip.tag || '').trim();
                if (!tag) continue;
                counts.set(tag, (counts.get(tag) || 0) + 1);
            }
            return [
                { value: '', label: '全部', count: this.clips.length },
                ...[...counts.entries()].map(([tag, count]) => ({ value: tag, label: tag, count })),
            ];
        },
        list() {
            if (!this.filter) return this.clips;
            return this.clips.filter((c) => c.tag === this.filter);
        },
        referenced() { return new Set(asArray(this.scene?.clipIds).map(String)); },
    },
    methods: {
        isRef(clip) { return this.referenced.has(String(clip.id)); },
        /** 再点一次已选中的标签 = 取消筛选。少一个「回到全部」的往返 */
        pickTag(value) { this.filter = this.filter === value ? '' : String(value || ''); },
        onNew() { store.openModal('clip-edit', { isNew: true }); },
        onEdit(clip) { store.openModal('clip-edit', { id: clip.id }); },
        onDelete(clip) { store.openModal('confirm-delete-clip', { id: clip.id, name: clip.title }); },
        onUse(clip, mode) {
            if (!this.scene) { this.$emit('notify', '先选一个情景'); return; }
            store.useClip(clip.id, mode);
            this.$emit('notify', mode === 'append' ? '已接在情景后面' : '已写进情景');
        },
        onToggleRef(clip) {
            if (!this.scene) { this.$emit('notify', '先选一个情景'); return; }
            store.toggleSceneClip(clip.id);
        },
        onNewFromScene() {
            if (!this.scene?.setting) { this.$emit('notify', '当前情景还没写内容'); return; }
            store.openModal('clip-edit', { isNew: true, content: this.scene.setting, title: this.scene.title });
        },
        preview(clip) { return truncate(clip.content, 48); },
    },
    template: `
        <div class="sp-panel">
            <div class="sp-panel-actions">
                <SpButton variant="primary" size="sm" icon-name="plus" @click="onNew">新建文案</SpButton>
                <SpButton variant="line" size="sm" icon-name="download" :disabled="!scene" @click="onNewFromScene">从当前情景存一条</SpButton>
            </div>

            <div v-if="tags.length > 1" class="sp-chips sp-clip-tags">
                <button
                    v-for="t in tags"
                    :key="t.value || '_all'"
                    type="button"
                    class="sp-chip"
                    :class="{ 'is-active': filter === t.value }"
                    @click="pickTag(t.value)"
                >{{ t.label }}<em class="sp-chip-count">{{ t.count }}</em></button>
            </div>

            <SpEmpty v-if="!list.length" icon-name="clip" text="这一栏是空的" hint="文案库里放的是「开头」,写不出来的时候挑一条用" />

            <div v-else class="sp-clip-list">
                <article v-for="clip in list" :key="clip.id" class="sp-clip">
                    <header class="sp-clip-head">
                        <span class="sp-clip-title">{{ clip.title }}</span>
                        <SpTag v-if="clip.tag">{{ clip.tag }}</SpTag>
                        <SpTag v-if="isRef(clip)" tone="on">已引用</SpTag>
                    </header>
                    <p class="sp-clip-body">{{ preview(clip) }}</p>
                    <div class="sp-clip-acts">
                        <button type="button" class="sp-mini" :disabled="!scene" @click="onUse(clip, 'replace')">写进情景</button>
                        <button type="button" class="sp-mini" :disabled="!scene" @click="onUse(clip, 'append')">接在后面</button>
                        <button type="button" class="sp-mini" :class="{ 'is-on': isRef(clip) }" :disabled="!scene" @click="onToggleRef(clip)">
                            {{ isRef(clip) ? '取消引用' : '引用' }}
                        </button>
                        <button type="button" class="sp-mini" @click="onEdit(clip)">改</button>
                        <button type="button" class="sp-mini is-danger" @click="onDelete(clip)">删</button>
                    </div>
                </article>
            </div>

            <SpSection title="套用和引用有什么不同" icon-name="info">
                <p class="sp-note">
                    <b>写进情景</b>:内容复制一份进去,之后改文案库不影响这个情景。
                </p>
                <p class="sp-note">
                    <b>引用</b>:文案作为一段独立的上下文挂在情景上,改文案库会跟着变。
                    适合「好几个情景共用的一段设定」。
                </p>
            </SpSection>
        </div>
    `,
};

export default SpPanelClips;
