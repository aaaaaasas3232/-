/**
 * 情景剧场 · 上下文
 *
 * 显示「这次会发给 AI 什么」,并且能逐段开关、调顺序。
 *
 * ★ 这一页渲染的 parts 和发送时用的是**同一次 `buildPrompt()` 调用**的两个
 *   返回字段。所以不存在「预览里关掉的段照样发出去」——
 *   那是 murmur 和梦境编织都各自踩过一次的坑,`context-composer` 就是为它写的。
 *
 * ★ 预览时 `save: false`,不写快照:预览是个 computed,每次重渲染都写一遍
 *   localStorage 既浪费,又会把真正发出去的那份快照冲掉。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { collectSources, buildPrompt } from '../services/prompt-builder.js';
import { CONTEXT_SECTIONS, LENGTHS } from '../constants.js';
import { toPlain, copyText, truncate } from '../utils.js';
import * as nook from '../services/nook-bridge.js';

export const SpPanelContext = {
    name: 'SpPanelContext',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { LENGTHS, expanded: '' };
    },
    computed: {
        state() { return store.getState(); },
        scene() { return store.getScene(); },
        settings() { return store.getSettings(); },
        order() { return store.getContextOrder(); },

        /** ★ 和发送走同一个函数,只是不落快照 */
        result() {
            const scene = this.scene;
            if (!scene) return null;
            const sources = collectSources({
                scene,
                library: this.state.library,
                messages: toPlain(this.state.messages),
                theater: this.state.theater,
            });
            return buildPrompt(
                { scene, library: this.state.library, sources, saveId: this.state.activeSaveId },
                { save: false },
            );
        },
        parts() { return this.result?.parts || []; },
        stats() { return this.result?.stats || { tokens: 0, included: 0, total: 0 }; },

        api() {
            const card = store.getUserCard();
            return nook.describeApiRef(nook.resolveApiRef(card));
        },
    },
    methods: {
        metaOf(id) { return CONTEXT_SECTIONS.find((s) => s.id === id) || {}; },
        toggle(part) {
            if (part.locked) { this.$emit('notify', '这一段关掉之后 AI 会写成没法解析的东西,所以锁着'); return; }
            store.setContextSection(part.id, !part.active);
        },
        move(part, dir) { store.moveContextSection(part.id, dir); },
        resetOrder() {
            store.resetContextOrder();
            this.$emit('notify', '顺序已还原');
        },
        expand(id) { this.expanded = this.expanded === id ? '' : id; },
        preview(part) { return truncate(part.content.replace(/\n+/g, ' '), 48); },
        async onCopy() {
            const ok = await copyText(this.result?.text || '');
            this.$emit('notify', ok ? '已复制完整上下文' : '复制失败,浏览器不允许');
        },
        set(patch) { store.updateSettings(patch); },
    },
    template: `
        <div class="sp-panel">
            <SpEmpty v-if="!scene" icon-name="sparkle" text="先选一个情景" hint="上下文是按情景拼的" />

            <template v-else>
                <SpSection title="这次会发出去什么" icon-name="sparkle" :hint="stats.included + ' / ' + stats.total + ' 段 · 约 ' + stats.tokens + ' token'">
                    <p class="sp-note">
                        下面这些就是发送时真正拼出去的内容 —— 预览和发送是同一次计算,
                        在这儿关掉的段不会被发出去。
                    </p>
                    <SpButton size="sm" variant="quiet" icon-name="copy" @click="onCopy">复制完整上下文</SpButton>
                </SpSection>

                <div class="sp-ctx-list">
                    <div
                        v-for="(part, i) in parts"
                        :key="part.id"
                        class="sp-ctx"
                        :class="{ 'is-off': !part.included, 'is-locked': part.locked }"
                    >
                        <div class="sp-ctx-head">
                            <button type="button" class="sp-ctx-main" @click="expand(part.id)">
                                <span class="sp-ctx-title">
                                    {{ part.title }}
                                    <em v-if="part.locked" class="sp-ctx-lock">锁定</em>
                                </span>
                                <span class="sp-ctx-sub">
                                    {{ part.content ? preview(part) : '(这一段现在是空的)' }}
                                </span>
                            </button>
                            <span class="sp-ctx-tokens">{{ part.tokens }}</span>
                        </div>
                        <div class="sp-ctx-acts">
                            <button type="button" class="sp-mini" :disabled="i === 0" aria-label="上移" @click="move(part, -1)">↑</button>
                            <button type="button" class="sp-mini" :disabled="i === parts.length - 1" aria-label="下移" @click="move(part, 1)">↓</button>
                            <button
                                type="button"
                                class="sp-mini"
                                :class="{ 'is-on': part.active }"
                                :disabled="part.locked"
                                @click="toggle(part)"
                            >{{ part.active ? '已启用' : '已停用' }}</button>
                            <span class="sp-ctx-source">{{ part.source }}</span>
                        </div>
                        <pre v-if="expanded === part.id" class="sp-ctx-body">{{ part.content || '(空)' }}</pre>
                    </div>
                </div>

                <SpButton size="sm" variant="quiet" icon-name="refresh" block @click="resetOrder">顺序还原</SpButton>

                <SpSection title="生成设置" icon-name="settings">
                    <SpField label="一次写多长">
                        <SpSegmented
                            :model-value="settings.length"
                            :options="LENGTHS.map(l => ({ value: l.value, label: l.label }))"
                            @update:model-value="set({ length: $event })"
                        />
                    </SpField>
                    <SpSlider label="带多少条历史" suffix=" 条" :min="6" :max="60" :model-value="settings.historyLimit" @update:model-value="set({ historyLimit: $event })" />
                    <SpSlider label="发散程度" :min="0" :max="1.4" :step="0.05" :model-value="settings.temperature" @update:model-value="set({ temperature: $event })" />
                    <SpSwitch label="流式生成" hint="一边写一边显示;关掉就等全部写完再出现" :model-value="settings.stream" @update:model-value="set({ stream: $event })" />
                </SpSection>

                <SpSection title="用哪个 API" icon-name="info">
                    <p class="sp-note" :class="{ 'is-danger': !api.ok }">{{ api.label }}</p>
                    <p class="sp-note">{{ api.sub }}</p>
                    <p class="sp-note">Key 统一在 nook 的「API 管理」里配,这个 App 不自己存。</p>
                </SpSection>
            </template>
        </div>
    `,
};

export default SpPanelContext;
