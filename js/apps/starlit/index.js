/**
 * 点灯  
 *
 * ── 它到底是什么 ──────────────────────────────────────────────────
 *   一个学习软件，但理念不是「教知识」，是**教理解**。
 *   英语的诞生牵着一部历史，HTML 也是。这个 App 里每一张概念卡都必须
 *   回答「它为什么会诞生」—— 因为记住从来不是目的。
 *
 * ── 两种模式 ──────────────────────────────────────────────────────
 *   语言：全程用目标语言对话，中文以**描边字**贴在气泡旁（不是点击翻译）
 *   代码：每一行都能长按改，预览窗有两个播放器 ——
 *         一个看实时效果，一个看这个网页怎么从一片空白里长出来
 *
 * ── 一条完整的路 ──────────────────────────────────────────────────
 *   建主题 → 摸底问卷 → 水平侧写 → 说出终点 → 排课
 *   → 上课（老师边讲边吐卡片 / 词条 / 卡住点）
 *   → 下课（收成一张卡片网 + 覆盖式更新侧写）
 *   → 反转课堂（你变成老师，AI 变成那个水平的学生，**下课按钮在他手里**）
 *   → 推理墙（一个主题一面墙，拖、连红线、叠卡、整理、一块一块看）
 *   → 词典（弹幕 / 灵动岛 / 手机壳外的小电视，三种方式反复找上你）
 *
 * ── 边界 ──────────────────────────────────────────────────────────
 *   - 不需要绑世界观也能用（老师可以就是模型本身）
 *   - 没有任何定时器会调 AI，每次请求都由一次点击触发
 *   - 整理推理墙 / 播弹幕 / 改卡片一律**不调 API**
 *   - 卡片可跨课复用（第一节讲 padding、第二节讲 margin，
 *     「盒模型」那张卡直接从库里调，省 token 也省一张重复卡）
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js   枚举 / 默认值（不含颜色）
 *   theme.js       颜色 token 元信息（色值在 css/apps/starlit/index.css）
 *   icons.js       图标（全带 width/height，禁 emoji）
 *   utils.js       纯函数
 *   store.js       Vue.reactive 单例 + 全部 mutator
 *   services/      db / 身份 / AI / 提示词 / 技能解析 / 卡片库 /
 *                  代码引擎 / CSS 知识库 / 推理墙排版 / SRS / 悬浮播放
 *   components/    根 / 主题 / 问卷 / 课程 / 上课 / 反转课堂 /
 *                  推理墙 / 卡片 / 代码卡 / 词典 / 配色 / 弹窗
 */

import { createStarlitRoot } from './components/root.js';
import { STARLIT_STORES } from './services/db.js';
import { registerStarlitPrompts } from './services/app-prompts.js';
import { ensureIslandTemplate } from './services/ticker.js';
import { APP_ICON } from './icons.js';
import { escapeHtml } from './utils.js';
import * as store from './store.js';

export default function createStarlitApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'starlit',
        name: '点灯',
        icon: APP_ICON,
        // 桌面图标底色：画在 app-shell 外，CSS 变量够不着（纯色，禁渐变）
        iconBg: '#F3E7D0',

        /** 通用 App：绑不绑世界观都能用 */
        worldAvailability: {
            requiresBoundWorld: false,
        },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '把学过的东西连成一面墙',
                category: '教育',
                isGame: false,
                rating: 4.9,
                ratingsCount: '128',
                size: '3.1 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '第一版：语言 / 代码两种模式、摸底问卷、课程规划、卡片推理墙、反转课堂、知识点词典与三种悬浮播放。',
                accent: '#C2703C',
                description: '学习是什么？我也不知道。\n\n为什么要学习？我也不知道。\n\n人为什么总需要做一些事？总需要一些目的？也许它能帮助到你，也许不能。',
                tutorial: [
                    {
                        title: '第一次打开该做什么',
                        content: '先开一个学习主题：选语言还是代码，选谁来教（世界观里的 AI，或者就用模型本身）。建完老师会先出一份摸底问卷 —— 答完他才知道你在哪一层。',
                    },
                    {
                        title: '问卷之后',
                        content: '老师会给出一份「水平侧写」，然后问你想达到什么程度。起点和终点都有了，他才排课：一共几节、每节的目标是什么。详细内容不会提前写，等你点开那节课他才现场设计。',
                    },
                    {
                        title: '上课时能做什么',
                        content: '语言模式全程用目标语言，中文会以描边字贴在气泡旁边，不用点翻译。代码模式里每张代码卡都能预览，点一行看注释，长按一行就能改 —— 改完立刻在预览窗看见变化。',
                    },
                    {
                        title: '卡住了怎么办',
                        content: '直接说「我没懂」。老师会判断你是不是缺前置知识，缺就记进错题本，并且把补课安排到后面某一节，然后换条路继续走。知识不是线性的，卡住多半不是你笨。',
                    },
                    {
                        title: '推理墙怎么玩',
                        content: '每节课的卡片会自动落到这个主题的墙上。拖动卡片、从卡片上拉红线连接、把相关的拖到重合叠成一堆（点一下会摊开到中央）。卡片太多就用右上角的「分块」一小块一小块看，或者点「整理」让它自己排。',
                    },
                    {
                        title: '反转课堂',
                        content: '每节课上完都能开。你变成老师，AI 扮演一个和你上课前水平一样的学生 —— 他没有你们上课的任何记忆。下课按钮在他手里：他觉得自己听懂了才结束。讲得清楚，说明你是真懂了。',
                    },
                    {
                        title: '让词条自己找上你',
                        content: '词典里的条目可以以三种方式反复出现：屏幕上飘的弹幕、灵动岛里一条条播、以及挂在手机壳外顶部的小电视。小电视能长按调大小，也能当单词机用 —— 先遮住释义，你自评记不记得。',
                    },
                ],
                faqs: [
                    {
                        question: '一定要有世界观吗？',
                        answer: '不用。老师可以就是模型本身，不套任何人设。绑了世界观的话，「老师」那一栏里会多出这个世界里的 AI 可选，他们会带着自己的性格上课。',
                    },
                    {
                        question: '同一个概念会不会反复出现好几张卡？',
                        answer: '不会。每个主题有一个卡片库，新卡进来前会先判重。第一节讲 padding、第二节讲 margin，「盒模型」那张卡是同一张 —— 卡片详情里会写它在第几节被用到过。',
                    },
                    {
                        question: '整理推理墙会不会很慢 / 会不会花 token？',
                        answer: '不花 token，那是纯几何计算，一个字都不调 API。卡片特别多的时候它会自动退回网格排列 —— 与其算十秒钟不如立刻给你一个能用的结果。',
                    },
                    {
                        question: '反转课堂里 AI 会不会偷看答案？',
                        answer: '不会。它拿到的提示词里只有「你是一个 xxx 水平的学生」，没有这节课的任何内容，也不知道那个水平其实是你的。',
                    },
                    {
                        question: '悬浮播放会不会拖慢网页？',
                        answer: '弹幕节点是复用的、同屏有上限、只用 transform 做动画，页面切到后台会整个停掉。全关的时候它连一个 DOM 节点都不留。',
                    },
                ],
            },
        },

        // ── 外观（首帧兜底值，挂载后从 CSS 读真值覆盖；真相在 index.css）──
        background: '#F6F1E7',
        statusBarColor: '#33291F',
        homeIndicatorColor: 'rgba(51, 41, 31, 0.42)',

        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '点灯', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册
        stores: STARLIT_STORES,

        renderMode: 'vue',

        // ── 灵动岛 ──────────────────────────
        islandKinds: [
            {
                id: 'dict-ticker',
                label: '词条播放',
                desc: '最小岛显示一行知识点；点开变中岛，可以自评记不记得、把它丢进「不深刻」或「已记住」。',
                when: '在「悬浮播放」里打开灵动岛之后，按你设的间隔一条条播',
                template: 'starlit-dict',
                sizes: ['mini', 'medium'],
                previewPayload: {
                    front: 'eat', pos: 'v.', back: '吃', hint: '词根 ed- 咬', masked: false,
                },
            },
        ],
        notifyKinds: [
            {
                id: 'lesson-done',
                label: '结课提示',
                type: 'success',
                title: '这节课收好了',
                message: '收了 7 张卡，连了 9 条线',
                when: '一节课结束、卡片网生成之后',
            },
            {
                id: 'flip-done',
                label: '反转课堂结束',
                type: 'message',
                title: '他听懂了',
                message: '第 3 节 · 盒模型',
                when: '反转课堂里 AI 宣布听懂了',
            },
        ],

        // ── 桌面小组件 ──────────────────────
        widgets: [
            {
                id: 'today',
                label: '今天要复习的',
                sizes: ['S', 'M'],
                previewPayload: { due: 12, line: 'eat v. 吃', topic: '学英语' },
                render(size, payload = {}) {
                    // 词条正文来自 AI / 用户，进 innerHTML 之前必须转义
                    const due = Number(payload.due) || 0;
                    const line = escapeHtml(String(payload.line || '').slice(0, 22));
                    const topic = escapeHtml(String(payload.topic || '').slice(0, 10));
                    if (size === 'S') {
                        return `<div class="sl-wg sl-wg--s"><b>${due}</b><i>待复习</i></div>`;
                    }
                    return `<div class="sl-wg sl-wg--m">
                        <div class="sl-wg__head">${topic || '点灯'}</div>
                        <div class="sl-wg__num"><b>${due}</b><i>条待复习</i></div>
                        <div class="sl-wg__line">${line}</div>
                    </div>`;
                },
            },
        ],

        // ★ 框架把它当独立函数调，里面不能用 this
        renderPage() {
            return createStarlitRoot();
        },

        /**
         * setup 在 App 注册时跑（页面一加载就跑）。
         *
         * 两件事必须放这里，不能放 hydrate：
         *   1. murmur 的静态提示词 —— 用户没点过点灯，murmur 折叠区里也该看得到
         *   2. 灵动岛模板 —— 悬浮播放可能在用户没打开 App 的情况下就要弹岛
         */
        setup({ toolkit, app } = {}) {
            registerStarlitPrompts(toolkit);
            ensureIslandTemplate();

            // 调试 / 探针入口。只读同一个 reactive 单例，不是第二份状态。
            if (typeof window !== 'undefined') window.__slStore = store;

            // 后台预热：等所有表建好后 hydrate 一次，
            // 让「进度卡重放进 murmur」和「悬浮播放自动续上」不依赖用户先打开 App
            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    store.hydrate(app).catch((err) => {
                        console.warn('[starlit] 后台预热失败，等用户打开 App 时再试', err);
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
            /** 只读概要，给别的 App / 小组件用（不含课堂全文） */
            overview() {
                return store.overview();
            },

            /** 当前档案下的学习主题列表 */
            listTopics() {
                return store.getState().topics.map((t) => ({
                    id: t.id,
                    title: t.title,
                    mode: t.mode,
                    target: t.target,
                    goal: t.goal,
                    planned: Boolean(t.planned),
                }));
            },

            /** 待复习的词条（小组件 / 别的 App 想提醒用户时用） */
            listDueEntries() {
                const now = Date.now();
                return store.getState().dict
                    .filter((d) => !d.muted && (Number(d.dueAt) || 0) <= now)
                    .slice(0, 30)
                    .map((d) => ({ id: d.id, front: d.front, pos: d.pos, back: d.back }));
            },
        },
    };
}
