/**
 * 氧气 · 首次配置
 *
 * 单页滚动：世界材料（夹子 / prompt 库）→ 关注的话题 → 身份（昵称 / 关注规模）。
 * 完成后只生成一批标签级列表，不会一口气生成所有正文。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { FOLLOWER_PRESETS } from '../constants.js';

export const OxOnboarding = {
    name: 'OxOnboarding',
    components: { ...UI },
    data() {
        return { FOLLOWER_PRESETS, submitting: false };
    },
    computed: {
        s() { return store.getState(); },
        ob() { return this.s.onboarding; },
        canSubmit() { return Boolean(this.ob.nickname.trim()) && !this.submitting; },
    },
    methods: {
        toggleClip(id) { store.toggleClip(id); },
        togglePrompt(id) { store.toggleLibraryPrompt(id); },
        pickPreset(p) { store.setObFollowers(p.followers, p.id); },
        onInterests(e) { store.setInterestsText(e?.target?.value || ''); },
        onNickname(e) { store.setObNickname(e?.target?.value || ''); },
        async submit() {
            if (!this.canSubmit) return;
            this.submitting = true;
            try {
                await store.finishOnboarding();
            } finally {
                this.submitting = false;
            }
        },
    },
    template: `
        <div class="ox-page ox-onboarding">
            <header class="ox-ob__hero">
                <span class="ox-ob__mark"><OxIcon name="logo" :size="34" /></span>
                <h2 class="ox-ob__title">氧气</h2>
                <p class="ox-ob__line">人类需要呼吸，表达即是呼吸。</p>
                <p class="ox-ob__sub">世界：{{ s.identity.worldName }} · 用户：{{ s.identity.userName }}</p>
            </header>

            <OxLoading v-if="ob.loading" :lines="['正在读世界观']" />

            <template v-else>
                <OxSection title="世界材料" sub="选中的会进入生成提示词">
                    <p v-if="!ob.clips.length && !ob.prompts.length" class="ox-muted">这个世界观还没有夹子和 prompt 库条目，跳过就行。</p>
                    <div v-if="ob.clips.length" class="ox-ob__chips">
                        <button
                            v-for="c in ob.clips" :key="c.id" type="button"
                            class="ox-chip" :class="{ 'is-on': ob.clipIds.includes(c.id) }"
                            @click="toggleClip(c.id)"
                        >{{ c.title }}</button>
                    </div>
                    <div v-if="ob.prompts.length" class="ox-ob__chips">
                        <button
                            v-for="p in ob.prompts" :key="p.id" type="button"
                            class="ox-chip ox-chip--lib" :class="{ 'is-on': ob.promptIds.includes(p.id) }"
                            :title="p.path"
                            @click="togglePrompt(p.id)"
                        >{{ p.title }}</button>
                    </div>
                </OxSection>

                <OxSection title="你关注什么" sub="影响广场上长出来的标签">
                    <textarea
                        class="ox-textarea" rows="2"
                        :value="ob.interestsText"
                        placeholder="用顿号或空格隔开，比如：夜航、旧书店、修船的人"
                        @change="onInterests"
                    ></textarea>
                </OxSection>

                <OxSection title="你的身份">
                    <OxField label="氧气昵称">
                        <input
                            class="ox-input" type="text" maxlength="20"
                            :value="ob.nickname"
                            @input="onNickname"
                        />
                    </OxField>
                    <OxField label="关注规模" hint="决定你的帖子会有多少人路过和评论，之后随时可改">
                        <div class="ox-ob__chips">
                            <button
                                v-for="p in FOLLOWER_PRESETS" :key="p.id" type="button"
                                class="ox-chip" :class="{ 'is-on': ob.followerPresetId === p.id }"
                                @click="pickPreset(p)"
                            >{{ p.label }}<i class="ox-chip__desc">{{ p.desc }}</i></button>
                        </div>
                    </OxField>
                </OxSection>

                <div class="ox-ob__foot">
                    <OxButton variant="ink" size="lg" block :loading="submitting" @click="submit">开始呼吸</OxButton>
                    <p class="ox-muted">完成后只生成一批标签级列表；正文、作者、评论都等你点了再生成。</p>
                </div>
            </template>
        </div>
    `,
};
