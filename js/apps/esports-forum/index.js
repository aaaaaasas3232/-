/**
 * 声浪 —— 电竞世界的论坛与生涯事实源
 *
 * ── 核心边界 ──────────────────────────────────────────────────────
 *   - 只在 experienceMode === 'esports' 的世界出现（worldAvailability），
 *     requiresInstall = false：电竞世界桌面自动出现，离开自动隐藏
 *   - 未完成严肃首配不能进主界面；配置按 userId::worldId 分档
 *   - 联盟名册（18 战队 × 选手/教练）由档案键确定性拼装，零 token，跨档共享
 *   - 每档独立时间轴 + SAB 赛季引擎（三轮常规 + 卡位赛 + 双败季后赛），
 *     掷签全部带 seed，回放一致
 *   - 论坛日常层（预置帖 / 官博 / 评分 / 串子小号）零 token；
 *     AI 只在用户点击时介入（板块热闹 / 生成评论 / 锐评 / 赛报 / 快进 / 结局）
 *   - 薪资 / 奖金 / 冠军奖金全部走 assetFlow（与全系统同一本账，幂等）
 *   - 生涯通过 social-influence providers 影响氧气 / 萤火（互关队友与战队官博
 *     也从这里描述过去），绝不触碰氧气值 / batteryBridge / 小听 / 黑匣子
 *   - 赛点（esports-game）通过 externalAppRegistry 调下面的 services，
 *     不许直接 import 本 App 的 store
 */

import { createForumRoot } from './components/root.js';
import { FORUM_STORES } from './services/db.js';
import { registerEsportsPrompts } from './services/app-prompts.js';
import { registerEsportsProviders } from './services/providers.js';
import { APP_ICON } from './icons.js';
import * as store from './store.js';
import { asArray, toPlain } from './utils.js';

export default function createEsportsForumApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'esports-forum',
        name: '声浪',
        icon: APP_ICON,
        iconBg: '#101418',

        /** 只在电竞世界出现；没绑世界不出现 */
        worldAvailability: {
            includeModes: ['esports'],
            requiresBoundWorld: true,
        },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '赛场之外，声浪不熄',
                category: '社交',
                isGame: true,
                rating: 4.8,
                ratingsCount: '23',
                size: '4.1 MB',
                age: '12+',
                version: '1.0.0',
                whatsNew: '第一版：SAB 全赛程（三轮常规+卡位赛+双败季后赛）、18 战队确定性名册、五立场论坛与选手评分、匿名马甲与小号生态、赛事与节日锚点、薪资奖金真资产、社媒联动。',
                accent: '#43E6B0',
                description:
                    '比赛结束以后，比分停在那里，议论却不会一起散场。\n\n'
                    + '声浪既是电竞世界的论坛，也是生涯与赛季的事实源。默认的 SAB 赛程从三轮常规赛走到卡位赛与双败季后赛，每一场结果都带着可回放的 seed 留档。\n\n'
                    + '粉丝、黑子、路人、分析帖与乐子人各说各的。联盟选手可能披着会改名的小号混在其中，你也可以留下最多五个不署真名的马甲。\n\n'
                    + '战队、属性、赛程和荣誉在这里继续生长；月薪与赛事奖金则进入全系统共用的钱包。',
                tutorial: [
                    {
                        title: '第一次打开该做什么',
                        content: '声浪只在「电竞」模式的世界出现。先在 nook 里给默认用户绑一个电竞世界观（可以用预设「电竞世界」），回来完成七步首配：身份、项目、起点、加点、战队、锚点、开档。',
                    },
                    {
                        title: 'SAB 赛制是怎么跑的',
                        content: '18 支战队按上季排名蛇形分三组打第一轮；每组前二进 S、中间进 A、末二进 B。第二轮三组内战后打卡位赛（BO7 定去留，B 组多数队伍直接放假），第三轮 S 组全员直通季后赛、A 组只有前四能进，最后十队双败 BO7 争冠。',
                    },
                    {
                        title: '比赛谁来打',
                        content: 'NPC 的比赛每天自动打完（掷签带 seed，回放一致）。轮到你的比赛去「赛点」App 出战；要是快进跳过了，系统会按你当时的状态代打，结果照进积分榜。',
                    },
                    {
                        title: '论坛的评论是真的吗',
                        content: '日常帖子和评论由世界观素材池按天确定性拼装，零 token；点「热闹一下」「生成评论」「生成锐评」才会调 AI。你发的帖默认匿名 —— murmur 里的 AI 永远不知道那个马甲是你。',
                    },
                    {
                        title: '小号系统',
                        content: '你可以开最多 5 个马甲。联盟里三成选手也是「串子」：他们的小号会混进自家板块发帖，每隔一阵可能改名。数据一直都在，够细心就能扒出来。',
                    },
                ],
                faqs: [
                    {
                        question: '我的队友会出现在氧气和萤火里吗？',
                        answer: '会。队友与你互关、战队官博自动注册，官博评论量跟热度走。在「我的 → 社媒联动」里可以精确到「哪个战队的哪个人」开关。',
                    },
                    {
                        question: '回档以后人设改动怎么办？',
                        answer: '所有写进 nook 人设经历的行都留了台账。开新档时勾选「回收改写」，那些行会被摘掉；阶段卡永远保留。',
                    },
                    {
                        question: '赛果能重 roll 吗？',
                        answer: '不能。每场系列赛的每一局都带 seed 存档，回放一致；评论可以删除但没有重 roll。输了就是输了，去论坛挨喷吧。',
                    },
                    {
                        question: '钱是真的吗？',
                        answer: '真的。月薪、赢场奖金、MVP 追加、冠军奖金、公关费都走全系统同一本账（assetFlow），和聊天红包、四叶草互通，同一凭据只入账一次。',
                    },
                ],
            },
        },

        // ── 外观（首帧兜底值，挂载后从 CSS 读真值覆盖）──
        background: '#F4F6F5',
        statusBarColor: '#17211D',
        homeIndicatorColor: 'rgba(23, 33, 29, 0.4)',

        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '声浪', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册
        stores: FORUM_STORES,

        renderMode: 'vue',

        // ★ 框架把它当独立函数调，里面不能用 this
        renderPage() {
            return createForumRoot();
        },

        /**
         * setup 在 App 注册时跑：
         *   - murmur 静态卡此时注册
         *   - social-influence providers 此时注册（氧气/萤火收集时才读内容）
         *   - 表建好后后台预热一次，让生涯概要卡与赛点服务不依赖用户先打开声浪
         */
        setup({ toolkit, app } = {}) {
            registerEsportsPrompts(toolkit);
            registerEsportsProviders(() => store.readProviderState());

            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    store.hydrate(app).catch((err) => {
                        console.warn('[esports-forum] 后台预热失败，等用户打开 App 时再试', err);
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

        // ── 给赛点（esports-game）与探针的服务面 ──
        services: {
            /** 只读：当前档概要（plain object） */
            async careerSnapshot() {
                await store.ensureHydrated();
                const s = store.getState();
                if (!s.save) return null;
                return {
                    saveId: s.save.id,
                    saveName: s.save.name,
                    gameId: s.profile?.gameId || '',
                    teamName: store.teamNameOf(s.profile?.userTeamId),
                    day: s.save.clock?.day || 1,
                    attrs: { ...s.save.attrs },
                    energy: s.save.energy,
                    honors: asArray(s.save.honors).map((h) => ({ title: h.title, day: h.day })),
                    seasonName: s.save.season?.name || '',
                    seasonPhase: s.save.season?.phase || '',
                };
            },

            /** 赛点开档所需的完整快照 */
            async getCareerState() {
                await store.ensureHydrated();
                return store.careerStateSnapshot();
            },

            /** 路线协议：当前赛季 */
            async getActiveSeason() {
                await store.ensureHydrated();
                const s = store.getState();
                const season = s.save?.season;
                if (!season) return null;
                return toPlain({
                    instanceId: season.instanceId,
                    name: season.name,
                    formatId: season.formatId,
                    phase: season.phase,
                    startDay: season.startDay,
                    done: season.done,
                    championId: season.championId,
                });
            },

            /** 路线协议：赛季赛程/结果（最近 limit 场，含未打的） */
            async listSeasonEvents(payload = {}) {
                await store.ensureHydrated();
                const s = store.getState();
                const limit = Math.max(1, Math.min(60, Number(payload.limit) || 30));
                const day = s.save?.clock?.day || 1;
                return asArray(s.save?.season?.series)
                    .filter((sr) => Math.abs(sr.day - day) <= 14)
                    .slice(0, limit)
                    .map((sr) => toPlain({
                        id: sr.id, day: sr.day, phase: sr.phase, bo: sr.bo, label: sr.label,
                        homeId: sr.homeId, awayId: sr.awayId,
                        homeName: store.teamNameOf(sr.homeId), awayName: store.teamNameOf(sr.awayId),
                        result: sr.result ? {
                            homeScore: sr.result.homeScore, awayScore: sr.result.awayScore,
                            winnerId: sr.result.winnerId, mvpName: sr.result.mvpName || '',
                        } : null,
                    }));
            },

            /** 路线协议：赛果写入（幂等，matchId = seriesId） */
            async recordMatchResult(payload = {}) {
                await store.ensureHydrated();
                return store.recordMatchResult(payload);
            },

            /** 用户出战一场系列赛（JS 掷定，赛点 UI 逐局揭示） */
            async playUserSeries(payload = {}) {
                await store.ensureHydrated();
                return store.playUserSeries(String(payload.seriesId || ''), asArray(payload.modifiers));
            },

            /** 赛点写回排位概要（幂等 by sessionId）→ 论坛围观楼 + murmur 概要卡 */
            async recordRankSession(payload = {}) {
                await store.ensureHydrated();
                return store.recordRankSession(payload);
            },

            /** 赛点消耗档内时间（排位/训练/吃饭） */
            async spendTime(payload = {}) {
                await store.ensureHydrated();
                return store.spendTime(payload);
            },

            /** 赛点写回属性微调（钳制后结算，留明细） */
            async applyRankOutcome(payload = {}) {
                await store.ensureHydrated();
                return store.applyRankOutcome(payload);
            },
        },
    };
}
