/**
 * 萤火 · 提示词与生成（透明面板）
 *
 * 复用 murmur / 梦境编织那套 context-composer：这里展示的分段
 * 和实际发送的文本来自**同一次 compose**，不存在第二份预览实现。
 *
 * 还管两件事：
 *   - 私信 provider（演员 / 爱豆 / 电竞……）的启停，按档案保存；
 *   - 告诉用户萤火在 murmur 注册了哪两张提示词卡。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import * as world from '../services/world-context.js';
import {
    buildAiVideoPrompt, buildDmPrompt, buildFeedPrompt, buildLivePrompt,
    buildMoreCommentsPrompt, buildPersonPrompt, buildUserCommentsPrompt,
    buildVideoDetailPrompt,
} from '../services/prompt-builder.js';
import { YOUTUBE_PROMPTS } from '../services/app-prompts.js';
import { FEED_SIZE } from '../constants.js';

const GENERATORS = [
    { id: 'feed', label: '视频列表', note: '首配完成 / 点「换一批」时调用' },
    { id: 'detail', label: '视频详情', note: '点开一条视频时调用（含首批评论）' },
    { id: 'comments', label: '更多评论', note: '点「更多评论」时调用，每次 5 条' },
    { id: 'person', label: '站内主页', note: '点头像 / 名字时调用' },
    { id: 'live', label: '直播一场', note: '点「开始看直播」时调用，弹幕池一次拿完' },
    { id: 'ai-video', label: 'AI 发视频', note: '点「让 TA 发视频」/ 重 roll 时调用' },
    { id: 'user-comments', label: '我的视频评论', note: '点「看看观众怎么说」时调用' },
    { id: 'dm', label: '私信收件箱', note: '点「收一批私信」时调用' },
];

export const YtPromptsPage = {
    name: 'YtPromptsPage',
    components: { ...UI },
    data() {
        return { pick: 'feed' };
    },
    computed: {
        s() { return store.getState(); },
        generators() { return GENERATORS; },
        providers() { return store.listProviders(); },
        murmurPrompts() { return YOUTUBE_PROMPTS; },
        pickedNote() { return GENERATORS.find((g) => g.id === this.pick)?.note || ''; },
        /**
         * 用当前档案的真实上下文 compose 一次。
         * 需要具体对象的生成器（详情 / 主页…）用「示例目标」占位 ——
         * 分段结构、世界观内容和真实调用完全一致，只有目标字段是演示值。
         */
        preview() {
            const ctx = this.baseCtx();
            try {
                switch (this.pick) {
                    case 'feed':
                        return buildFeedPrompt({
                            ...ctx,
                            knownCreators: this.s.creators.slice(0, 5).map((c) => ({ name: c.name })),
                            exclude: this.s.feed.slice(0, 5).map((v) => v.title),
                            size: FEED_SIZE,
                        });
                    case 'detail':
                        return buildVideoDetailPrompt({
                            ...ctx,
                            video: this.s.feed[0] || { title: '（示例）某条视频', coverText: '示例', creatorName: '某频道主', kind: '日常', blurb: '示例预告', views: 1200 },
                        });
                    case 'comments':
                        return buildMoreCommentsPrompt({
                            ...ctx,
                            video: this.s.feed[0] || { title: '（示例）某条视频', creatorName: '某频道主', blurb: '示例预告' },
                            existing: [{ authorName: '示例观众', text: '前排' }],
                        });
                    case 'person':
                        return buildPersonPrompt({
                            ...ctx,
                            person: { name: this.s.creators[0]?.name || '（示例）某用户', kind: 'creator' },
                            knownWorks: [],
                        });
                    case 'live':
                        return buildLivePrompt({
                            ...ctx,
                            creator: this.s.creators[0] || { name: '（示例）某主播', bio: '', works: [] },
                            viewers: 128,
                            danmakuCount: 28,
                        });
                    case 'ai-video':
                        return buildAiVideoPrompt({
                            ...ctx,
                            ai: { name: store.listAiCreators()[0]?.name || '（示例）本世界 AI', desc: '' },
                            previousTitles: [],
                            opinion: '',
                        });
                    case 'user-comments':
                        return buildUserCommentsPrompt({
                            ...ctx,
                            upload: this.s.uploads.find((u) => u.ownerType === 'user') || { title: '（示例）我发的视频', intro: '' },
                            channel: store.userChannel(),
                            stats: { views: 800, likes: 40, comments: 12 },
                            existing: [],
                        });
                    case 'dm':
                    default:
                        return buildDmPrompt({
                            ...ctx,
                            channel: store.userChannel(),
                            uploadsBrief: this.s.uploads.filter((u) => u.ownerType === 'user').slice(0, 3).map((u) => `《${u.title}》`),
                            count: 4,
                        });
                }
            } catch (err) {
                console.warn('[youtube] 预览 compose 失败', err);
                return { parts: [], stats: {} };
            }
        },
    },
    mounted() {
        // 刷新后直接进这页时，prompt 库条目可能还没拉过 —— 补一次，
        // 否则预览里看不到用户选过的库条目（世界夹子是同步读的，不受影响）
        if (!this.s.onboarding.prompts.length) void store.prepareOnboarding();
    },
    methods: {
        back() { store.setView(''); },
        baseCtx() {
            const p = this.s.profile;
            const clips = world.listClips(this.s.identity.world)
                .filter((c) => (p?.clipIds || []).includes(c.id));
            const prompts = (this.s.onboarding.prompts || []).filter((x) => (p?.promptIds || []).includes(x.id));
            return {
                identity: this.s.identity,
                summary: world.readSummary(this.s.identity.world),
                clips,
                prompts,
                taste: p?.taste || '',
                influenceParts: [],
            };
        },
        toggleProvider(p) { store.setProviderEnabled(p.key, !p.enabled); },
    },
    template: `
        <div class="yt-page yt-prompts">
            <div class="yt-subtop">
                <button type="button" class="yt-subtop__back" aria-label="返回" @click="back"><YtIcon name="back" :size="18" /></button>
                <span class="yt-subtop__title">提示词与生成</span>
            </div>

            <YtSection title="什么时候会调用 AI" sub="不点不生成">
                <div class="yt-prompts__picker">
                    <button
                        v-for="g in generators" :key="g.id"
                        type="button" class="yt-prompts__pick" :class="{ 'is-on': pick === g.id }"
                        @click="pick = g.id"
                    >{{ g.label }}</button>
                </div>
                <p class="yt-prompts__note">{{ pickedNote }}。下面的分段就是实际发送的内容 —— 预览和发送来自同一次拼装。</p>
                <YtPromptParts :parts="preview.parts" :stats="preview.stats" />
            </YtSection>

            <YtSection title="跨 App 经历来源" sub="私信与内容的风向">
                <p class="yt-prompts__note">
                    以后演员、爱豆、电竞这类生涯 App 会把你的近况注册到这里；
                    生成私信 / 列表时才读取，平时不调用它们。现在
                    {{ providers.length ? '已接入 ' + providers.length + ' 个来源：' : '还没有来源接入。' }}
                </p>
                <div v-for="p in providers" :key="p.key" class="yt-row is-static">
                    <YtIcon name="tower" :size="16" />
                    <span class="yt-row__label">{{ p.label }}</span>
                    <span class="yt-row__value">{{ p.sourceAppId }}</span>
                    <button
                        type="button" class="yt-switch" :class="{ 'is-on': p.enabled }"
                        :aria-label="(p.enabled ? '关闭' : '开启') + p.label"
                        @click="toggleProvider(p)"
                    ><i></i></button>
                </div>
            </YtSection>

            <YtSection title="注册进 murmur 的卡" sub="回复提示词页可启停">
                <div v-for="mp in murmurPrompts" :key="mp.promptId" class="yt-prompts__murmur">
                    <b>{{ mp.label }}</b>
                    <pre class="yt-prompts__pre">{{ mp.content }}</pre>
                </div>
            </YtSection>
        </div>
    `,
};
