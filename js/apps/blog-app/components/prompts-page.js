/**
 * 氧气 · 提示词与 provider（透明页）
 *
 * 1. provider 清单（演员 / 爱豆 / 电竞注册的热搜、私信、评论风向）+ 启停
 * 2. 广场列表 prompt 的分段预览（预览 == 发送，同一次 compose）
 * 3. 内置提示词：小听的隐藏人设 / 几何体规则（可覆盖）；murmur 卡说明
 *    —— 对用户透明，对「她」保密的只是身份，不是机制。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { GIFT_RULES, XIAOTING_PERSONA } from '../services/prompt-builder.js';
import { BLOG_PROMPTS } from '../services/app-prompts.js';

export const OxPromptsPage = {
    name: 'OxPromptsPage',
    components: { ...UI },
    data() {
        const x = store.getState().xiaoting || {};
        return {
            preview: null,
            openBlock: '',
            personaDraft: x.personaPromptOverride || '',
            giftDraft: x.giftPromptOverride || '',
            XIAOTING_PERSONA,
            GIFT_RULES,
            murmurCards: BLOG_PROMPTS.map((p) => ({ id: p.promptId, label: p.label, content: p.content })),
        };
    },
    computed: {
        s() { return store.getState(); },
        providers() { return store.listProviders(); },
    },
    mounted() {
        try {
            this.preview = store.buildFeedPreview();
        } catch (err) {
            console.warn('[blog] 预览生成失败', err);
        }
    },
    methods: {
        back() { store.popView(); },
        toggleProvider(p) { store.setProviderEnabled(p.key, !p.enabled); },
        toggleBlock(id) { this.openBlock = this.openBlock === id ? '' : id; },
        savePersona() { void store.setPersonaOverride(this.personaDraft); },
        resetPersona() {
            this.personaDraft = '';
            void store.setPersonaOverride('');
        },
        saveGift() { void store.setGiftOverride(this.giftDraft); },
        resetGift() {
            this.giftDraft = '';
            void store.setGiftOverride('');
        },
    },
    template: `
        <div class="ox-page ox-promptspage">
            <OxSubtop title="提示词与 provider" @back="back" />

            <OxSection title="跨 App 经历（provider）" sub="演员 / 爱豆 / 电竞上线后出现在这里">
                <p v-if="!providers.length" class="ox-muted">还没有任何 App 注册 provider。等你的生涯 App 上线，热搜和私信的风向会自动变。</p>
                <div v-for="p in providers" :key="p.key" class="ox-switchrow">
                    <div class="ox-switchrow__main">
                        <p class="ox-switchrow__title">{{ p.label }}</p>
                        <p class="ox-switchrow__desc">来自 {{ p.sourceAppId }}{{ p.channels && p.channels.length ? ' · 通道：' + p.channels.join(' / ') : '' }}</p>
                    </div>
                    <button type="button" class="ox-switch" :class="{ 'is-on': p.enabled }" @click="toggleProvider(p)"><i></i></button>
                </div>
            </OxSection>

            <OxSection title="广场列表的提示词" sub="预览与发送来自同一次拼装">
                <OxPromptParts v-if="preview" :parts="preview.parts" :stats="preview.stats" />
                <p v-else class="ox-muted">预览还没生成（首配完成后可见）。</p>
            </OxSection>

            <OxSection title="她的底稿" sub="对你透明；对她保密的只是身份">
                <button type="button" class="ox-foldhead" @click="toggleBlock('persona')">
                    <span>隐藏人设（整理第 2 步与对话都用它）</span><OxIcon name="fold" :size="14" />
                </button>
                <div v-if="openBlock === 'persona'" class="ox-foldbody">
                    <pre class="ox-pre">{{ XIAOTING_PERSONA }}</pre>
                    <p class="ox-muted">想改就写在下面（留空 = 用默认底稿）。不管怎么改，她都不该知道自己叫什么。</p>
                    <textarea v-model="personaDraft" class="ox-textarea" rows="4" placeholder="覆盖版人设（可留空）"></textarea>
                    <div class="ox-post__actions">
                        <OxButton size="sm" variant="ink" @click="savePersona">保存覆盖</OxButton>
                        <OxButton size="sm" variant="ghost" @click="resetPersona">恢复默认</OxButton>
                    </div>
                </div>

                <button type="button" class="ox-foldhead" @click="toggleBlock('gift')">
                    <span>几何体规则（内置几何体提示词）</span><OxIcon name="fold" :size="14" />
                </button>
                <div v-if="openBlock === 'gift'" class="ox-foldbody">
                    <pre class="ox-pre">{{ GIFT_RULES }}</pre>
                    <p class="ox-muted">形状白名单和「颜色不由 AI 决定」写死在代码里，改这里也绕不过去。</p>
                    <textarea v-model="giftDraft" class="ox-textarea" rows="4" placeholder="覆盖版规则（可留空）"></textarea>
                    <div class="ox-post__actions">
                        <OxButton size="sm" variant="ink" @click="saveGift">保存覆盖</OxButton>
                        <OxButton size="sm" variant="ghost" @click="resetGift">恢复默认</OxButton>
                    </div>
                </div>
            </OxSection>

            <OxSection title="注册进 murmur 的卡" sub="在 murmur 的「回复提示词 → 氧气」折叠组里可启停可编辑">
                <div v-for="c in murmurCards" :key="c.id" class="ox-foldwrap">
                    <button type="button" class="ox-foldhead" @click="toggleBlock('card-' + c.id)">
                        <span>{{ c.label }}</span><OxIcon name="fold" :size="14" />
                    </button>
                    <div v-if="openBlock === 'card-' + c.id" class="ox-foldbody">
                        <pre class="ox-pre">{{ c.content }}</pre>
                    </div>
                </div>
            </OxSection>
        </div>
    `,
};
