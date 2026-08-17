/**
 * 候鸟 —— 按世界观生成内容的旅行软件
 *
 * ── 核心边界 ──────────────────────────────────────────────────────
 *   - 必须有默认用户且明确绑定世界观（worldAvailability.requiresBoundWorld），
 *     不用 active world 偷偷兜底
 *   - 数据按 `${userId}::${worldId}` 分档；切档要重配，切回来原样恢复
 *   - 首配后只生成候选列表；点候选才生成详情；确认买票才有行程；
 *     点「生成小剧场」才调小剧场；对话页每一段都是用户点出来的
 *   - 机票走 src/core/asset-ledger.js（sourceType 'travel-ticket'，sourceId 行程 id），
 *     重复点击不会二次扣款；删除未出发行程按同一凭据退款
 *   - 去过的地方可以注册进 nook（registerGeoCandidate，两层幂等）
 *   - 旅行概要注册进 murmur 的「候鸟」折叠组（概要，不是全过程）
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js  枚举 / 默认值（不含颜色）
 *   theme.js      颜色 token 元信息（色值在 css/apps/travel/index.css）
 *   icons.js      图标（全带 width/height，禁 emoji）
 *   store.js      Vue.reactive 单例 + 全部 mutator
 *   services/     db / 世界观上下文 / AI / prompt-builder（composeContext）/
 *                 机票钱包 / 行程推进 / murmur 提示词 / 四叶草桥
 *   components/   根 / 引导 / 探索 / 详情 / 行程 / 准备板 / 对话页 /
 *                 足迹 / 经历 / 我的 / 配色 / 弹窗
 */

import { createTravelRoot } from './components/root.js';
import { TRAVEL_STORES, getTrip as dbGetTrip, listTrips as dbListTrips } from './services/db.js';
import { registerTravelPrompts } from './services/app-prompts.js';
import { getProfileKey } from './services/world-context.js';
import { APP_ICON } from './icons.js';
import { asArray } from './utils.js';
import * as store from './store.js';

export default function createTravelApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'travel',
        name: '候鸟',
        icon: APP_ICON,
        // 桌面图标底色：画在 app-shell 外，CSS 变量够不着（纯色，禁渐变）
        iconBg: '#DCEBF7',

        /** 通用 App：首次启动就显示；未绑定世界观时由 App 内引导处理 */
        worldAvailability: {
            requiresBoundWorld: false,
        },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '按你的世界观去旅行',
                category: '生活',
                isGame: false,
                rating: 4.8,
                ratingsCount: '61',
                size: '2.4 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '第一版：候选地点、机票、出行准备、旅行对话、足迹、共同经历、配色，全部按世界观生成。',
                accent: '#5E97C4',
                description:
                    '有时想离开熟悉的地方，不是为了抵达哪里，只是想看看这个世界还有什么。\n\n'
                    + '候鸟从默认用户绑定的世界观里生出一批候选地点。看过详情，才决定是否买票；出票之后，还可以安排天数、同行的 AI 与随身物品。\n\n'
                    + '旅程按天与早午晚一段段往前走，旁白和插话都由你决定何时继续。走完以后，它会收进足迹，也可以整理成概要，登记回世界的空间与共同经历。\n\n'
                    + '票款来自与聊天红包、四叶草共用的钱包。尚未出发的行程删去时，票款原路退回。',
                tutorial: [
                    {
                        title: '第一次打开候鸟该做什么',
                        content: '候鸟会读取默认用户明确绑定的世界观。请先去设置里创建世界观并把默认用户绑上，再回来完成首次配置。配置完只会生成一批候选地点，不会一口气生成所有详情。',
                    },
                    {
                        title: '怎么开始一趟旅行',
                        content: '在探索页点进感兴趣的地点看详情，页面底部有一张机票。点机票会弹确认窗（显示票价和余额），确认后扣款出票，然后在准备板里定几天几夜、拉同行 AI、挑要带的东西。',
                    },
                    {
                        title: '旅行对话页怎么玩',
                        content: '旅行按「天 × 早午晚」推进。点「继续旁白」生成下一段；你可以随时插话；长按任何一条消息可以让某位同行 AI 回复、编辑、带意见重 roll 或删除。走到最后一段旅行自动结束。',
                    },
                    {
                        title: '结束之后呢',
                        content: '走完的旅行自动进足迹页：可以写备注、生成概要（概要会进 AI 的记忆和 murmur）、把去过的地方登记进世界的空间系统。',
                    },
                ],
                faqs: [
                    {
                        question: '机票的钱是真的吗？',
                        answer: '是。票款从你的钱包余额里扣（和聊天红包、四叶草同一本账）。出发前退票全额原路退回；已经出发或走完的不退。',
                    },
                    {
                        question: '换了默认用户数据会丢吗？',
                        answer: '不会。数据按「默认用户 + 绑定世界」分档：换档要重新配置，换回来时原来的候选、收藏、行程和主题原样恢复。',
                    },
                    {
                        question: '生成的地点是世界里真实存在的吗？',
                        answer: '候选可能复用世界里已登记的地点（会标出来），也可能是新造的。只有你去过并主动点「登记到世界」，它才会写进世界的空间系统，重复登记不会造出第二份。',
                    },
                    {
                        question: 'AI 会知道我们一起旅行过吗？',
                        answer: '生成概要之后会。概要会写进同行 AI 的经历，并注册到 murmur 的「候鸟」折叠组 —— 注入的是概要，完整旅程只留在候鸟里。',
                    },
                ],
            },
        },

        // ── 外观（首帧兜底值，挂载后从 CSS 读真值覆盖；真相在 index.css）──
        background: '#F2F7FB',
        statusBarColor: '#283A4A',
        homeIndicatorColor: 'rgba(40, 58, 74, 0.4)',

        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '候鸟', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册
        stores: TRAVEL_STORES,

        renderMode: 'vue',

        // ★ 框架把它当独立函数调，里面不能用 this
        renderPage() {
            return createTravelRoot();
        },

        /**
         * setup 在 App 注册时跑（页面一加载就跑）。
         * murmur 的静态提示词必须在这时注册 —— 放 hydrate 的话，
         * 用户没点过候鸟，murmur 折叠区里就看不到它。
         * 概要卡靠 hydrate 后的 sync 重放（要先知道档案键）。
         */
        setup({ toolkit, app } = {}) {
            registerTravelPrompts(toolkit);

            // 后台预热：等所有表建好后 hydrate 一次，
            // 让「概要卡重放进 murmur」不依赖用户先打开候鸟
            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    store.hydrate(app).catch((err) => {
                        console.warn('[travel] 后台预热失败，等用户打开 App 时再试', err);
                    });
                }, { once: true });
            }
            return {};
        },

        methods: {
            /** 供外部预热 / 深链调用；正常路径由根组件 mounted 自己拉 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /** 当前档案的行程摘要（只读 plain object，不含消息全文） */
            async listTrips() {
                const key = getProfileKey();
                if (!key) return [];
                const rows = await dbListTrips(this.app, key);
                return rows.map((t) => ({
                    id: t.id,
                    status: t.status,
                    placeName: t.destination?.placeName || '',
                    locationName: t.destination?.locationName || '',
                    days: t.days,
                    companions: asArray(t.companions).map((c) => ({ id: c.id, name: c.name })),
                    summary: t.summary || '',
                    startedAt: t.startedAt || 0,
                    completedAt: t.completedAt || 0,
                }));
            },

            /** 按 id 取一趟（不过滤档案键 —— 调用方不该知道分档规则） */
            async getTrip(payload = {}) {
                const id = payload.id || payload.tripId;
                if (!id) return null;
                return dbGetTrip(this.app, id);
            },

            /** 已生成的旅行概要（murmur 之外的 App 也可能要用） */
            async listTravelSummaries() {
                const key = getProfileKey();
                if (!key) return [];
                const rows = await dbListTrips(this.app, key);
                return rows
                    .filter((t) => String(t.summary || '').trim())
                    .map((t) => ({
                        tripId: t.id,
                        placeName: t.destination?.placeName || '',
                        locationName: t.destination?.locationName || '',
                        days: t.days,
                        companions: asArray(t.companions).map((c) => ({ id: c.id, name: c.name })),
                        summary: t.summary,
                        completedAt: t.completedAt || 0,
                    }));
            },
        },
    };
}
