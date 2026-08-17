/**
 * 追光 —— 演员成长之路（世界观预设 App 的地基）
 *
 * ── 核心边界 ──────────────────────────────────────────────────────
 *   - 只在 experienceMode === 'actor' 的世界出现（worldAvailability），
 *     requiresInstall = false：演员世界桌面自动出现，离开自动隐藏
 *   - 未完成严肃首配不能进主界面；配置按 userId::worldId 分档
 *   - 每档案键 30 位 NPC（JS 确定性拼装，不烧 token），跨档共享名册
 *   - 每档独立时间轴（世界纪时映射 / 早中晚 / 快进 / 跨日询问）
 *   - 突发事件按「分线曲线 × 属性护盾 × 公关护盾 × 状态」加权掷签，
 *     seed 存档可回放；演出与阶段结算没有重 roll
 *   - 片酬 / 通告 / 奖金 / 公关费全部走 assetFlow（与全系统同一本账）
 *   - 大事自动进档内大事记，major 的同步世界观时间轴（删档回收）
 *   - 生涯通过 social-influence providers 影响氧气 / 萤火（热搜 / 私信 /
 *     评论风向三通道），绝不触碰氧气值 / batteryBridge / 小听 / 黑匣子
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js  分线表 / 九维属性 / 事件库 / 奖项节日 / NPC 素材池 / 活动目录
 *   theme.js      颜色 token 元信息（色值在 css/apps/actor/index.css）
 *   store.js      Vue.reactive 单例 + 存档系统 + 全部 mutator
 *   services/     db / 世界观上下文 / 时钟 / NPC 引擎 / 事件引擎 / 生涯引擎 /
 *                 AI / prompt-builder（composeContext）/ 资产 / 梦境桥 /
 *                 murmur 提示词 / providers
 *   components/   根 / 首配向导 / 今日 / 日程 / 剧组 / 圈子 / 我的 /
 *                 覆盖页 / 弹窗 / 配色
 */

import { createActorRoot } from './components/root.js';
import { ACTOR_STORES } from './services/db.js';
import { registerActorPrompts } from './services/app-prompts.js';
import { registerActorProviders } from './services/providers.js';
import { APP_ICON } from './icons.js';
import { tierSpec } from './constants.js';
import * as store from './store.js';

export default function createActorCareerApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'actor-career',
        name: '追光',
        icon: APP_ICON,
        iconBg: '#1C1917',

        /** 只在演员世界出现；没绑世界不出现 */
        worldAvailability: {
            includeModes: ['actor'],
            requiresBoundWorld: true,
        },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '从十八线到聚光灯正中央',
                category: '生活',
                isGame: true,
                rating: 4.9,
                ratingsCount: '18',
                size: '3.6 MB',
                age: '12+',
                version: '1.0.0',
                whatsNew: '第一版：18 线起步、九维数值自由加点、每档独立时间轴、加权突发事件、剧本改编与试镜、30 位确定性 NPC、奖项与节日锚点、多块阶段结算、结局生成。',
                accent: '#C9971F',
                description:
                    '聚光灯照见的不只是一张脸。起点、天分、关系与运气，都会在时间里留下结果。\n\n'
                    + '追光让每一档从 18 线到 1 线之间自行起步，九项能力由你分配。世界的早中晚会随生涯前进；快进过的日子不能回头，除非放下这一档重来。\n\n'
                    + '剧本可以来自梦境书架，也可能由行业递来。试镜、演出成色与突发事件都只掷定一次，30 位圈内人会在同一张名册上继续各自的往来。\n\n'
                    + '片酬、通告费、奖金与公关费进入全系统共用的账。走到哪一线，不由一句预设替你回答。',
                tutorial: [
                    {
                        title: '第一次打开该做什么',
                        content: '追光只在「演员」模式的世界出现。先在 nook 里给默认用户绑一个演员世界观（可以用预设「演员世界」），回来完成六步首配：身份、起点线、加点、锚点、圈子、开档。',
                    },
                    {
                        title: '时间是怎么走的',
                        content: '每一档有独立时间轴，从开档那刻起步。可以跟现实同步，也可以手动调早中晚；到 24:00 会问你「进入下一天，还是现实明天再玩」。快进 N 天会让整档的纪时一起前进，事件照掷、锚点照开。',
                    },
                    {
                        title: '突发事件的概率是真的吗',
                        content: '是。每个事件的概率 = 分线曲线 × 属性护盾 × 公关护盾 × 状态修正，主页的风险面板能看到每一项此刻的真实概率。掷签带 seed 存档，回放一致，不存在刷出好结果。',
                    },
                    {
                        title: '剧本从哪来',
                        content: '两个来源：从梦境编织的书架改编（保存版本快照，原作更新不偷改），或者让行业按你的数值递本子。试镜一次掷定；每场戏的成色也一次掷定，演砸了就是演砸了。',
                    },
                    {
                        title: '30 位 NPC 是谁',
                        content: '开档案时按你的人设与世界确定性拼装出 30 位圈内人（MBTI + 细节素材池，不烧 token），换档不换人。每档默认启用 15 位，可以增减，也可以把世界里绑定的 AI 拉进来当角色。',
                    },
                ],
                faqs: [
                    {
                        question: '换个档，之前的人设改动怎么办？',
                        answer: '所有写进 nook 人设经历的行都留了台账。开新档时勾选「回收改写」，那些行会被摘掉，人设回到干净状态；阶段卡永远保留。',
                    },
                    {
                        question: '阶段结算能重 roll 吗？',
                        answer: '不能。结算按五块串行生成（回顾 / 数值 / 人脉 / 舆论 / 展望），生成过的块不会重来；中途失败已完成的块保留，稍后可续跑。演出成色同理。',
                    },
                    {
                        question: '钱是真的吗？',
                        answer: '真的。片酬、通告费、奖金、公关费都走全系统同一本账（assetFlow），和聊天红包、四叶草、候鸟互通。同一部剧的片酬只会入账一次。',
                    },
                    {
                        question: '我的生涯会影响别的 App 吗？',
                        answer: '会。氧气的热搜会出现你的词条（标注「与你有关」），私信和评论风向也会跟着你的知名度变。通道只有 social-influence provider 一条，可以在氧气的提示词页关掉。',
                    },
                ],
            },
        },

        // ── 外观（首帧兜底值，挂载后从 CSS 读真值覆盖）──
        background: '#F7F5F0',
        statusBarColor: '#292524',
        homeIndicatorColor: 'rgba(41, 37, 36, 0.4)',

        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '追光', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册
        stores: ACTOR_STORES,

        renderMode: 'vue',

        // ★ 框架把它当独立函数调，里面不能用 this
        renderPage() {
            return createActorRoot();
        },

        /**
         * setup 在 App 注册时跑：
         *   - murmur 静态卡此时注册（等 hydrate 的话用户没开过追光就看不到）
         *   - social-influence providers 此时注册（氧气 / 萤火收集时才读内容）
         *   - 表建好后后台预热一次，让生涯概要卡重放不依赖用户先打开追光
         */
        setup({ toolkit, app } = {}) {
            registerActorPrompts(toolkit);
            registerActorProviders(() => store.readProviderState());

            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    store.hydrate(app).catch((err) => {
                        console.warn('[actor] 后台预热失败，等用户打开 App 时再试', err);
                    });
                }, { once: true });
            }
            return {};
        },

        methods: {
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /** 只读：当前档概要（给别的 App / 探针用，plain object） */
            async careerSnapshot() {
                const s = store.getState();
                if (!s.save) return null;
                const spec = tierSpec(s.save.tier);
                return {
                    saveId: s.save.id,
                    saveName: s.save.name,
                    tier: s.save.tier,
                    tierLabel: spec.label,
                    group: spec.group,
                    day: s.save.clock?.day || 1,
                    attrs: { ...s.save.attrs },
                    energy: s.save.energy,
                    finishedWorks: s.save.finishedWorks || 0,
                    honors: (s.save.honors || []).map((h) => ({ title: h.title, day: h.day })),
                    status: s.save.status,
                };
            },

            /** 只读：档内大事记（最近 N 条） */
            async listCareerTimeline(payload = {}) {
                const s = store.getState();
                const limit = Math.max(1, Math.min(50, Number(payload.limit) || 20));
                return (s.timeline || []).slice(0, limit).map((t) => ({
                    day: t.day, title: t.title, detail: t.detail, kind: t.kind, major: t.major === true,
                }));
            },
        },
    };
}
