/**
 * 赛点 —— 电竞世界的游戏客户端
 *
 * ── 核心边界 ──────────────────────────────────────────────────────
 *   - 只在 experienceMode === 'esports' 的世界出现，requiresInstall = false
 *   - 声浪（esports-forum）是生涯事实源：属性 / 时间 / 赛季 / 薪资全在那边；
 *     赛点通过 externalAppRegistry 调它的 services，绝不 import 它的 store
 *   - 排位一次掷定一批局（seed 存档，没有重 roll），时间与精力真实消耗，
 *     跨过饭点没吃饭有战力惩罚 —— 一天 rank 不完 15 局，先见底的是时间
 *   - 对局「云端回放」/ 群聊回话 / 复盘才调 AI，全部用户主动触发
 *   - 与 AI 一起打的对局进 murmur 的「同游概要」卡（只有当事 AI 知道）；
 *     游戏邀请 / 战绩分享以文字消息写进 murmur 私聊
 *   - 声浪不可用时排位照打，概要进 pendingSync 稍后重试（路线协议）
 */

import { createGameRoot } from './components/root.js';
import { GAME_STORES } from './services/db.js';
import { registerGamePrompts } from './services/app-prompts.js';
import { APP_ICON } from './icons.js';
import * as store from './store.js';
import { asArray, toPlain } from './utils.js';

export default function createEsportsGameApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'esports-game',
        name: '赛点',
        icon: APP_ICON,
        iconBg: '#10141E',

        worldAvailability: {
            includeModes: ['esports'],
            requiresBoundWorld: true,
        },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '巅峰分不会说谎',
                category: '游戏',
                isGame: true,
                rating: 4.7,
                ratingsCount: '31',
                size: '3.8 MB',
                age: '12+',
                version: '1.0.0',
                whatsNew: '第一版：批量排位（时间与体力真实消耗）、云端文字回放、双排到五排的 AI 开黑、亲密值与情侣标、训练赛与教练群聊复盘、他人战绩围观、murmur 战绩分享。',
                accent: '#5EA2FF',
                description:
                    '有些分数不会因为关掉页面就变得好看一点。\n\n'
                    + '赛点接着声浪里的战队、位置、属性与赛程。排位会消耗档内的时间和精力，跨过饭点仍不吃饭，战力也会跟着下降。每一批结果只掷定一次，逐局翻开，却没有重 roll。\n\n'
                    + '世界里的 AI 可以和你双排到五排；亲密值累积到 60，双方主页可以挂上情侣标。想知道一局里发生了什么，再主动拉取文字回放。\n\n'
                    + '正式比赛、排位概要与复盘会回到声浪，战绩也能分享进 murmur。输赢留着，下一局仍会照常开始。',
                tutorial: [
                    {
                        title: '为什么进不去',
                        content: '赛点跟着声浪（电竞论坛）的档走。先在声浪完成七步首配并开档，赛点会自动读到你的战队、位置与属性。',
                    },
                    {
                        title: '排位怎么打',
                        content: '选模式（单排到五排）、连打局数、要不要带 AI 或队友，一键开打。结果一次掷定，逐局翻开；时间与精力真实消耗，跨过饭点会提醒你先吃饭。',
                    },
                    {
                        title: '对局详情在哪',
                        content: '点开任意一局，选「查看对局详情」——客户端会从云端拉取这一局的文字回放（这一步才调 AI，不点不生成）。',
                    },
                    {
                        title: '正式比赛怎么打',
                        content: '赛程 tab 里到点会出现「今日出战」：选一个赛前策略开打，结果逐局揭示，奖金自动入账，赛后楼自动开在声浪。快进跳过的比赛由系统按你的状态代打。',
                    },
                    {
                        title: '群聊和复盘',
                        content: '战队群里教练每天发训练安排，晚上没打训练赛会点名。打完训练赛或排位可以「发起复盘」，教练和队友会按人设逐条发言。',
                    },
                ],
                faqs: [
                    {
                        question: '排位输了能重来吗？',
                        answer: '不能。每局都带 seed 存档，翻开就是定局。想上分只有练——熟练度、属性、状态都真实参与胜率计算。',
                    },
                    {
                        question: '情侣标是什么？',
                        answer: '和 AI 角色的亲密值涨到 60 后可以绑的公开关系标识，显示在双方游戏主页上；murmur 里的 TA 也会知道。解绑会掉 20 点亲密。',
                    },
                    {
                        question: '队友的战绩能看吗？',
                        answer: '互关的人 rank 记录彼此可见。「生成今日战绩」能看到概要（胜负、英雄、有没有熬夜），但具体对局内容看不到——可以分享到 murmur 去八卦。',
                    },
                    {
                        question: '声浪没开着会怎样？',
                        answer: '排位照打。战绩概要会进待同步队列，声浪回来后在「我的」页一键重试，同一场只会写入一次。',
                    },
                ],
            },
        },

        // ── 外观（首帧兜底值，挂载后从 CSS 读真值覆盖）──
        background: '#10141E',
        statusBarColor: '#E5EAF3',
        homeIndicatorColor: 'rgba(229, 234, 243, 0.4)',

        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '赛点', nav: true }],
        defaultRootPageId: 'home',

        stores: GAME_STORES,

        renderMode: 'vue',

        renderPage() {
            return createGameRoot();
        },

        setup({ toolkit, app } = {}) {
            registerGamePrompts(toolkit);
            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    store.hydrate(app).catch((err) => {
                        console.warn('[esports-game] 后台预热失败，等用户打开 App 时再试', err);
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
            /** 只读：巅峰分与最近场次（给探针 / 其他 App） */
            async rankSnapshot() {
                const s = store.getState();
                if (!s.gState) return null;
                return toPlain({
                    saveId: s.gState.saveId,
                    rating: s.gState.rating,
                    best: s.gState.best,
                    focusHero: s.gState.focusHero,
                    pendingSync: asArray(s.gState.pendingSync).length,
                    sessions: s.sessions.slice(0, 5).map((x) => ({
                        id: x.id, day: x.day, modeLabel: x.modeLabel,
                        wins: x.wins, losses: x.losses, ratingAfter: x.ratingAfter,
                    })),
                });
            },

            /** 只读：亲密关系（给探针） */
            async listRelations() {
                const s = store.getState();
                return asArray(s.relations).map((r) => toPlain({
                    targetId: r.targetId, targetType: r.targetType, name: r.name,
                    intimacy: r.intimacy, coupleTag: r.coupleTag,
                }));
            },
        },
    };
}
