/**
 * 情景剧场 —— 和 AI 一起演一段小剧场
 *
 * ── 它不是一个聊天软件 ────────────────────────────────────────────
 *
 * 本质是**小剧场**。同一个情景可以是:
 *   对话体(一来一回的气泡)/ 日记体(一段一段的手记)/ 博客体(带作者的贴文卡),
 * 甚至混着来 —— 正则规则决定每一段渲染成什么。
 * 所以气泡只是「对话体」这一种形态用得上的东西,不是这个 App 的核心。
 *
 * ── 架构 ──────────────────────────────────────────────────────────
 *
 *   index.js          appConfig(框架对接都在这)
 *   store.js          Vue.reactive 单例 + mutator + 分对象防抖落盘
 *   constants.js      枚举 / 默认值(★ 不含任何界面颜色)
 *   theme.js          界面色板 + 卡片色板(逻辑走 src/core/theme-tokens.js)
 *   icons.js / utils.js
 *   services/
 *     db.js             四张表(库 / 情景 / 存档 / 消息)+ 归一化
 *     nook-bridge.js    ★ 人设 / 世界观 / 场所 / API 的唯一读取口
 *     app-bridges.js    ★ 读气泡机的气泡、读四叶草的小剧场
 *     regex-engine.js   ★ 正则 → 卡片(唯一一处产 HTML 的地方,全程 escape)
 *     prompt-builder.js ★ 上下文组装(用 src/core/context-composer,预览 == 发送)
 *     ai-service.js     选 API / 流式与普通生成 / 分用途中断
 *     app-prompts.js    往 murmur 注册提示词
 *   components/       根 / 舞台 / 消息 / 抽屉 / 六个面板 / 弹窗 / 通用控件
 *
 * ── 和别的 App 的关系 ─────────────────────────────────────────────
 *
 *   气泡机   `services.getBubble` / `listBubbles` / `getShapes`
 *            对话体的气泡在那边做,这边只是挑一套用。
 *   四叶草   `services.getTheater` / `listTheaters`
 *            那边演过的小剧场可以接过来接着演 —— 这是它当初特意留的口子
 *            (AGENTS2 §16.8:结构化台词 + 带真实 aiPersonId 的参演者)。
 *   nook     人设 / 世界观 / 场所 / API Key,全部现读,本 App 不存。
 *   murmur   注册了两条提示词(知道演到哪了 / 把聊出来的场面开成情景)。
 *
 * ── 三条自己定的硬约束 ────────────────────────────────────────────
 *
 *   1. **预览 == 发送**。上下文面板和真正发出去的是同一次 `buildPrompt()`
 *      的两个返回字段,物理上不可能不一致。
 *   2. **气泡的样子只有一份实现**(`src/core/bubble-style.js`),
 *      气泡机里预览的和这里渲染的是同一个函数。
 *   3. **只有一处 `v-html`**(`regex-engine.renderCard`),那里每一处插值
 *      都过 escapeHtml。再开第二处就等于把这条防线拆了。
 */

import { createScenePlayRoot } from './components/root.js';
import { registerScenePlayPrompts } from './services/app-prompts.js';
import { SP_STORES } from './constants.js';
import { APP_ICON } from './icons.js';
import * as store from './store.js';

export default function createScenePlayApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'scene-play',
        name: '情景剧场',
        icon: APP_ICON,
        // ★ 纯色不用渐变 —— 全 App 的设计规矩(用户要求「禁用渐变」)
        iconBg: '#C7E6DC',

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '和 AI 一起演一段',
                category: '娱乐',
                rating: 4.8,
                ratingsCount: '74',
                size: '1.8 MB',
                age: '12+',
                version: '1.0.0',
                whatsNew: '第一版:情景库与分类、多存档、外观主题、正则卡片、接住四叶草的小剧场。',
                description: `有些情节为什么迟迟不肯结束？也许因为一句开场之后，人还想看看另一个人会怎样接住它。

情景剧场收下一段开头，与你和 AI 一起把它演下去。它可以是一来一回的对话，也可以写成日记或贴文；每个情景都有自己的背景、气泡与排版。

同一场戏可以留着几条不同的线。走到不想去的地方，就回到先前的存档再试一次；已经发生过的那一版，仍旧在那里。`,
                accent: '#C7E6DC',
                tutorial: [
                    {
                        title: '建第一个情景',
                        content: '点底部的「+」按钮,给情景起个名字,选一个类型(对话/日记/贴文),再设置背景和气泡。完成后,点进去写下第一句话,AI 就会接着演下去。',
                    },
                    {
                        title: '情景的类型有什么区别',
                        content: '对话类型:一来一回的对话形式;日记类型:每天生成一篇,适合记录;贴文类型:模拟社交媒体发帖,AI 会以评论或转发回应。',
                    },
                    {
                        title: '怎么开多条线',
                        content: '同一个情景里,每次对话都会生成一个存档。如果想试试不同的选择,点「新建线」可以从当前状态开一条新分支,原来的存档不受影响。',
                    },
                    {
                        title: '怎么关联四叶草',
                        content: '在情景设置里打开「四叶草联动」,情景里的 AI 就可以主动发起购物场景,和四叶草 app 里的商品、店铺产生互动。',
                    },
                    {
                        title: '外观可以自定义吗',
                        content: '可以。进入情景的设置页面,可以单独调整背景图、气泡样式、字体颜色等。每个情景的外观是独立的。',
                    },
                ],
                faqs: [
                    {
                        question: '情景和湛蓝回忆(galgame)有什么区别?',
                        answer: '情景聊天更轻量,侧重日常对话和社交模拟;湛蓝回忆更偏游戏化,支持剧情树、多分支存档和立绘场景。两者可以互补使用。',
                    },
                    {
                        question: '存档会丢失吗?',
                        answer: '不会。所有的存档都保存在本地,除非手动删除否则不会丢失。每次对话结束会自动保存。',
                    },
                    {
                        question: '可以和别人一起演一个情景吗?',
                        answer: '目前不支持多人同时参与。情景聊天是用户和 AI 一对一进行的。',
                    },
                    {
                        question: '为什么有时候 AI 的回复很奇怪?',
                        answer: '这通常是因为上下文变长了,AI 开始混淆角色设定或之前的情节。可以在情景设置里重置上下文,或者检查提示词设置是否正确。',
                    },
                ],
            },
        },

        // ── 外观 ────────────────────────────
        // ★ 首帧兜底值,和默认配色(果冻)对齐,防止打开时闪一下。
        //   挂载之后根组件会从 `_theme.css` 读出实际值覆盖它们 —— 颜色的真相始终在 CSS。
        background: '#FDF7F4',
        statusBarColor: '#5A4A52',
        homeIndicatorColor: 'rgba(90, 74, 82, 0.28)',

        // 舞台要占满整屏:顶栏和 tab 栏都自己画
        topbar: { visible: false },
        nav: { type: 'none' },
        // ★ 不声明的话,底部指示条那 40px 会一直露出静态背景 ——
        //   用户在情景里换了背景图,那一条不跟着变,看上去像贴了一条白边
        fullscreen: true,

        pages: [{ id: 'home', label: '剧场', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册,
        //   否则首次写盘时表还没建出来,表现是「保存成功但刷新就没了」
        stores: SP_STORES,

        renderMode: 'vue',

        /** ★ 没有 this —— 框架把它当独立函数调 */
        renderPage() {
            return createScenePlayRoot();
        },

        /**
         * setup 在 **App 注册时**跑(页面一加载就跑,不管用户开不开这个 App)。
         * 跨 App prompt 必须在这里注册 —— 放 hydrate 里的话,
         * 用户没点过这个 App,murmur 的折叠区里就看不到它。
         */
        setup({ toolkit } = {}) {
            registerScenePlayPrompts(toolkit);
            return {};
        },

        methods: {
            /** 供外部预热 / 深链调用;正常路径由根组件 mounted 自己拉 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /** murmur 的 `[开一场:…]` 落到这里 */
            async captureScene(payload = {}) {
                const text = String(payload.text || payload.content || '').trim();
                if (!text) return { ok: false, error: '内容为空' };
                return store.captureScene(text);
            },

            /** 给别的 App 读:现在演到哪了(只读摘要,不含正文) */
            async readProgress() {
                await store.hydrate(this.app);
                return store.readProgressBrief();
            },
        },
    };
}
