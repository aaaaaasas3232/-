/**
 * 日记 · 日记本设置抽屉
 *
 * 改外观、看「会告诉 TA 什么」、逐段开关上下文。
 *
 * ── 上下文那一块为什么重要 ────────────────────────────────────────
 *
 * 这里列出的段落和**真正发给 AI 的**是同一次 `buildPreview()` 调用的两个
 * 返回字段（`parts` 给这里渲染，`text` 是发出去的），物理上不可能不一致。
 *
 * 梦境编织原型栽在这上面：预览走一个函数、发送走另一个，用户在预览里
 * 关掉世界观，世界观照发不误 —— 而用户完全无从发现，因为他看不到真实 prompt。
 * 所以这一页的开关是真开关，关掉的段落**真的不会发出去**。
 */

import * as store from '../store.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { SHARED_COMPONENTS } from './shared.js';
import {
    THEMES, LAYOUT_STYLES, TEXT_SCALES, CONTEXT_SECTIONS,
    OWNER_KIND, WINDOW_START_MIN, WINDOW_START_MAX,
} from '../constants.js';
import { describeWindow } from '../utils.js';
import { buildPreview } from '../services/prompt-builder.js';
import * as nook from '../services/nook-bridge.js';

export const DySettingsSheet = {
    name: 'DySettingsSheet',
    components: { ...SHARED_COMPONENTS },
    data() {
        return {
            THEMES, LAYOUT_STYLES, TEXT_SCALES,
            WINDOW_START_MIN, WINDOW_START_MAX,
            view: 'look',       // 'look' | 'context'
            showRaw: false,
        };
    },
    computed: {
        state() { return store.getState(); },
        space() { return store.getActiveSpace(); },
        isMine() { return this.space?.ownerKind === OWNER_KIND.USER; },
        windowText() { return this.space ? describeWindow(this.space.windowStart) : ''; },

        /** ★ 预览和发送是同一次调用的两个字段 */
        preview() {
            if (!this.space) return { text: '', parts: [], stats: {} };
            const ctx = store.buildContext({ spaceId: this.space.id });
            return ctx ? buildPreview(ctx) : { text: '', parts: [], stats: {} };
        },
        parts() { return this.preview.parts || []; },
        stats() { return this.preview.stats || {}; },

        apiHint() {
            if (!this.space) return { label: '', sub: '' };
            const ownerCard = this.isMine
                ? nook.getDefaultUser()
                : nook.sdk()?.aiPersons?.get?.(this.space.ownerId);
            return nook.describeApiRef(nook.resolveApiRef({ space: this.space, ownerCard }));
        },
    },
    methods: {
        close() { store.closeSheet(); },
        set(key, value) { store.patchSpace(this.space.id, { [key]: value }); },

        toggleSection(id) {
            const meta = CONTEXT_SECTIONS.find((s) => s.id === id);
            if (meta?.locked) {
                store.toast('这一段是必需的，关掉之后写出来的东西会跑偏');
                return;
            }
            const cfg = { ...(this.space.contextConfig || {}) };
            cfg[id] = cfg[id] === false;
            store.patchSpace(this.space.id, { contextConfig: cfg });
        },

        async rename() {
            const name = await LP.modals.prompt({
                title: '日记本叫什么',
                value: this.space.title || '',
                maxLength: 12,
            });
            if (name === null) return;
            this.set('title', name.trim() || '我的日记');
        },
        async editStyle() {
            const text = await LP.modals.prompt({
                title: this.isMine ? '你写日记的习惯' : 'TA 写日记的习惯',
                message: '会影响起草时的口吻。',
                value: this.space.styleNote || '',
                multiline: true,
                maxLength: 60,
            });
            if (text === null) return;
            this.set('styleNote', text.trim());
        },
        copyPrompt() {
            const text = this.preview.text || '';
            if (!text) return;
            navigator.clipboard?.writeText?.(text)
                .then(() => store.toast('复制好了'))
                .catch(() => store.toast('复制失败，长按选中吧'));
        },
    },
    template: `
    <div class="dy-sheet">
        <div class="dy-sheet__mask" @click="close"></div>
        <div class="dy-sheet__panel">
            <header class="dy-sheet__head">
                <span class="dy-sheet__title">日记本设置</span>
                <DyIconBtn name="close" label="关闭" @click="close" />
            </header>

            <div class="dy-sheet__body">
                <DyChips
                    :model-value="view" :allow-empty="false" wide
                    :options="[{ id: 'look', name: '外观' }, { id: 'context', name: '会告诉 TA 什么' }]"
                    @update:model-value="view = $event"
                />

                <!-- 外观 -->
                <template v-if="view === 'look'">
                    <div class="dy-hr"></div>

                    <DyRow label="名字" :value="space.title" chevron @click="rename" />
                    <DyRow
                        :label="isMine ? '写日记的习惯' : 'TA 的习惯'"
                        :value="space.styleNote || '没写'" :muted="!space.styleNote"
                        chevron @click="editStyle"
                    />

                    <DyFormRow label="颜色" style="margin-top:16px;">
                        <div class="dy-themes">
                            <button
                                v-for="t in THEMES" :key="t.id"
                                type="button" class="dy-theme"
                                :class="{ 'is-on': space.theme === t.id }"
                                :data-diary-theme="t.id"
                                @click="set('theme', t.id)"
                            >
                                <span class="dy-theme__swatch"><i></i><i></i><i></i></span>
                                <span class="dy-theme__name">{{ t.name }}</span>
                            </button>
                        </div>
                    </DyFormRow>

                    <DyFormRow label="纸张">
                        <DyChips
                            :model-value="space.layout" :options="LAYOUT_STYLES" :allow-empty="false" wide
                            @update:model-value="set('layout', $event)"
                        />
                    </DyFormRow>

                    <DyFormRow label="字号">
                        <DyChips
                            :model-value="space.textScale" :options="TEXT_SCALES" :allow-empty="false" wide
                            @update:model-value="set('textScale', $event)"
                        />
                    </DyFormRow>

                    <DyFormRow
                        label="日记时段"
                        hint="固定五个小时。这段时间之外写下的都是便利贴。"
                    >
                        <div class="dy-windowpick">
                            <input
                                class="dy-windowpick__range" type="range"
                                :min="WINDOW_START_MIN" :max="WINDOW_START_MAX" step="1"
                                :value="space.windowStart"
                                @input="set('windowStart', Number($event.target.value))"
                            />
                            <span class="dy-windowpick__text">{{ windowText }}</span>
                        </div>
                    </DyFormRow>

                    <div class="dy-hr"></div>
                    <p class="dy-small dy-muted" style="line-height:1.9;margin:0;">
                        代笔用的 API：{{ apiHint.label }}<br />
                        <span v-if="apiHint.sub">{{ apiHint.sub }}</span>
                    </p>
                </template>

                <!-- 上下文 -->
                <template v-else>
                    <div class="dy-hr"></div>
                    <p class="dy-small dy-muted" style="margin:0 0 12px;line-height:1.9;">
                        下面每一段都会拼进发给 TA 的内容里。关掉的就<b>真的不会发出去</b>。
                        灰掉的两段是必需的，关不了。
                    </p>

                    <div
                        v-for="p in parts" :key="p.id"
                        class="dy-ctx__part" :class="{ 'is-off': !p.included }"
                    >
                        <span class="dy-ctx__main">
                            <span class="dy-ctx__title">{{ p.title }}</span>
                            <span class="dy-ctx__meta">
                                <template v-if="p.locked">必需 · </template>
                                <template v-if="p.chars">{{ p.chars }} 字 · 约 {{ p.tokens }} token</template>
                                <template v-else>这次没有内容</template>
                            </span>
                        </span>
                        <DySwitch
                            :model-value="p.active"
                            @update:model-value="toggleSection(p.id)"
                        />
                    </div>

                    <div class="dy-hr"></div>
                    <div class="dy-row dy-row--static" style="padding-top:0;">
                        <span class="dy-row__label">合计</span>
                        <span class="dy-row__value dy-nums">
                            {{ stats.included }} / {{ stats.total }} 段 · 约 {{ stats.tokens }} token
                        </span>
                    </div>
                    <p v-if="stats.overBudget" class="dy-small" style="color:var(--dy-warn);margin:0 0 12px;">
                        内容有点长了，可能会把日记正文挤掉。考虑关掉几段。
                    </p>

                    <div class="dy-btnbar">
                        <DyBtn size="sm" :icon-name="showRaw ? 'up' : 'eye'" @click="showRaw = !showRaw">
                            {{ showRaw ? '收起原文' : '看原文' }}
                        </DyBtn>
                        <DyBtn size="sm" variant="ghost" @click="copyPrompt">复制</DyBtn>
                    </div>
                    <pre v-if="showRaw" class="dy-ctx__pre" style="margin-top:10px;">{{ preview.text }}</pre>
                </template>
            </div>

            <footer class="dy-sheet__foot">
                <DyBtn variant="primary" @click="close">好了</DyBtn>
            </footer>
        </div>
    </div>
    `,
};

export default DySettingsSheet;
