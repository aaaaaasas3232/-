/**
 * 萤火 · 首次配置
 *
 * 一屏一件事：
 *   0  确认身份（默认用户 / 绑定世界 / 世界简介）—— 只确认不可改
 *   1  挑世界观材料（夹子 + prompt 库条目）
 *   2  我的频道（昵称 / 粉丝规模）+ 绑定图库图组
 *   3  爱看什么 + 完成
 *
 * 完成后只生成视频列表。生成失败**不退回引导页** ——
 * 配置本身已经成功了，失败的只是第一批内容。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { FOLLOWER_PRESETS } from '../constants.js';

export const YtOnboarding = {
    name: 'YtOnboarding',
    components: { ...UI },
    data() {
        return { generating: false, failed: '', presetId: 'tiny', customFollowers: false };
    },
    computed: {
        s() { return store.getState(); },
        ob() { return this.s.onboarding; },
        step() { return this.ob.step; },
        identity() { return this.s.identity; },
        presets() { return FOLLOWER_PRESETS; },
    },
    methods: {
        prev() { store.setOnboardingStep(this.step - 1); },
        next() { store.setOnboardingStep(this.step + 1); },
        toggleClip(id) { store.toggleClip(id); },
        togglePrompt(id) { store.toggleLibraryPrompt(id); },
        onTaste(e) { store.setTaste(e.target.value); },
        onNickname(e) { store.setObNickname(e.target.value); },
        pickPreset(p) {
            this.presetId = p.id;
            this.customFollowers = false;
            store.setObFollowers(p.followers);
        },
        onFollowers(e) {
            this.customFollowers = true;
            this.presetId = '';
            store.setObFollowers(Number(e.target.value));
        },
        pickGroup(id) {
            store.setObGalleryGroup(this.ob.galleryGroupId === id ? '' : id);
        },
        async finish() {
            if (this.generating) return;
            this.generating = true;
            this.failed = '';
            const ok = await store.finishOnboarding();
            this.generating = false;
            // ★ 失败留在主界面（needsConfig 已经是 false），只把错误带过去
            if (!ok && this.s.error) this.failed = this.s.error;
        },
    },
    template: `
        <div class="yt-ob" :class="{ 'yt-ob--busy': generating }">
            <div v-if="generating" class="yt-ob__stage yt-ob__center">
                <YtLoading :lines="['正在打捞这个世界的视频', '在认识频道主们', '快好了']" />
            </div>

            <div v-else class="yt-ob__stage">
                <!-- 第 0 屏：身份确认 -->
                <template v-if="step === 0">
                    <div class="yt-ob__hero"><YtIcon name="spark" :size="44" /></div>
                    <h1 class="yt-ob__title">萤火</h1>
                    <p class="yt-ob__desc">这个世界的视频软件。视频、频道主、弹幕，全都长在你绑定的世界观上。先确认按哪个世界来。</p>
                    <div class="yt-ob__panel">
                        <div class="yt-ob__pill"><span class="yt-ob__pill-k">观看者</span><span class="yt-ob__pill-v">{{ identity.userName }}</span></div>
                        <div class="yt-ob__pill"><span class="yt-ob__pill-k">世界</span><span class="yt-ob__pill-v">{{ identity.worldName }}</span></div>
                        <div class="yt-ob__summary">
                            <p v-if="ob.loading" class="yt-ob__summary-empty">正在读世界观…</p>
                            <p v-else-if="identity.world && identity.world.summary" class="yt-ob__summary-text">{{ identity.world.summary }}</p>
                            <p v-else class="yt-ob__summary-empty">这个世界观还没写简介。也能生成，但内容会更靠 AI 自由发挥 —— 建议先去 nook 补一段。</p>
                        </div>
                    </div>
                </template>

                <!-- 第 1 屏：材料 -->
                <template v-else-if="step === 1">
                    <h1 class="yt-ob__title">带哪些设定进来</h1>
                    <p class="yt-ob__desc">勾中的会进入每次生成的提示词。不勾也行，世界简介永远会带上。</p>
                    <div class="yt-ob__panel">
                        <p class="yt-ob__group">世界观夹子</p>
                        <p v-if="!ob.clips.length" class="yt-ob__none">这个世界还没有夹子。</p>
                        <button
                            v-for="c in ob.clips" :key="c.id"
                            type="button" class="yt-ob__card" :class="{ 'is-on': ob.clipIds.includes(c.id) }"
                            @click="toggleClip(c.id)"
                        >
                            <span class="yt-ob__tick"></span>
                            <span class="yt-ob__card-main">
                                <span class="yt-ob__card-title">{{ c.title }}</span>
                                <span class="yt-ob__card-sub">{{ c.content.slice(0, 44) }}</span>
                            </span>
                        </button>

                        <p class="yt-ob__group">Prompt 库</p>
                        <p v-if="!ob.prompts.length" class="yt-ob__none">Prompt 库是空的，跳过就好。</p>
                        <button
                            v-for="p in ob.prompts" :key="p.id"
                            type="button" class="yt-ob__card" :class="{ 'is-on': ob.promptIds.includes(p.id) }"
                            @click="togglePrompt(p.id)"
                        >
                            <span class="yt-ob__tick"></span>
                            <span class="yt-ob__card-main">
                                <span class="yt-ob__card-title">{{ p.title }}</span>
                                <span v-if="p.path" class="yt-ob__card-path">{{ p.path }}</span>
                            </span>
                        </button>
                    </div>
                </template>

                <!-- 第 2 屏：我的频道 + 图库 -->
                <template v-else-if="step === 2">
                    <h1 class="yt-ob__title">你的频道</h1>
                    <p class="yt-ob__desc">粉丝规模决定你发视频后有多少观众来评论（由本地计算，不烧 token）。</p>
                    <div class="yt-ob__panel">
                        <YtField label="频道昵称">
                            <input class="yt-input" :value="ob.nickname" maxlength="20" placeholder="想个网名" @input="onNickname" />
                        </YtField>
                        <YtField label="粉丝规模">
                            <div class="yt-ob__presets">
                                <button
                                    v-for="p in presets" :key="p.id"
                                    type="button" class="yt-ob__preset" :class="{ 'is-on': presetId === p.id }"
                                    @click="pickPreset(p)"
                                >
                                    <b>{{ p.label }}</b><span>{{ p.desc }}</span>
                                </button>
                            </div>
                            <input
                                class="yt-input yt-ob__followers" type="number" min="0"
                                :value="ob.followers" @input="onFollowers"
                            />
                            <p class="yt-field__hint">也可以直接填一个准确的数。以后在「我的」里随时能改。</p>
                        </YtField>
                        <YtField label="头像图库（可选）" hint="绑定 nook 图库的一个图组后，频道主和评论区观众的头像会从里面取，而且认脸：同一个人永远同一张。不绑就用色块占位。">
                            <p v-if="!ob.galleryGroups.length" class="yt-ob__none">图库里还没有图组。去「设置 → 图库」建一个再回来，或者先跳过。</p>
                            <button
                                v-for="g in ob.galleryGroups" :key="g.id"
                                type="button" class="yt-ob__card" :class="{ 'is-on': ob.galleryGroupId === g.id }"
                                @click="pickGroup(g.id)"
                            >
                                <span class="yt-ob__tick"></span>
                                <span class="yt-ob__card-main">
                                    <span class="yt-ob__card-title">{{ g.name }}</span>
                                    <span class="yt-ob__card-sub">{{ g.path }} · {{ g.imageCount }} 张</span>
                                </span>
                            </button>
                        </YtField>
                    </div>
                </template>

                <!-- 第 3 屏：口味 -->
                <template v-else>
                    <h1 class="yt-ob__title">你爱看什么</h1>
                    <p class="yt-ob__desc">写不写都行。写了的话，首页刷出来的视频会更合你口味。</p>
                    <div class="yt-ob__panel">
                        <textarea
                            class="yt-textarea" rows="5"
                            :value="ob.taste"
                            placeholder="比如：想看这个世界的日常生活 / 喜欢手艺人 / 少推恐怖的"
                            @input="onTaste"
                        ></textarea>
                        <p v-if="failed" class="yt-ob__failed">{{ failed }}</p>
                    </div>
                </template>
            </div>

            <div v-if="!generating" class="yt-ob__foot">
                <div class="yt-ob__dots">
                    <span v-for="i in 4" :key="i" class="yt-ob__dot" :class="{ 'is-on': step === i - 1 }"></span>
                </div>
                <div class="yt-ob__actions">
                    <YtButton v-if="step > 0" variant="ghost" @click="prev">上一步</YtButton>
                    <YtButton v-if="step < 3" variant="primary" block @click="next">继续</YtButton>
                    <YtButton v-else variant="primary" block @click="finish">完成，开始刷视频</YtButton>
                </div>
            </div>
        </div>
    `,
};
