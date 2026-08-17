/**
 * 湛蓝回忆 —— AI 视觉小说游戏机
 *
 * 由 `湛蓝回忆.html`(8027 行单文件原型,作者 Luanmma)重写而来。
 * 功能对齐原型并补全,实现全部换成本项目的 vue 模式范式。
 *
 * ── 架构 ──────────────────────────────────────────────────────────
 *
 *   index.js          appConfig(框架对接都在这)
 *   store.js          Vue.reactive 单例 + mutator + 分对象防抖落盘
 *   constants.js      枚举 / 默认值(★ 不含任何颜色)
 *   theme.js          色板元信息 + 从 CSS 读预设 + 批量配色解析
 *   icons.js / utils.js
 *   services/
 *     db.js             三张表(局 / 节点 / 库)+ 归一化 + 旧版 localStorage 迁移
 *     nook-bridge.js    ★ 人设 / 世界观 / 场所 / API 的唯一读取口
 *     kchain.js         ★ K 链:滑动窗口 + 迭代式增量压缩(状态挂在每个节点上)
 *     prompt-builder.js ★ 上下文组装的唯一真相(预览 == 发送)
 *     ai-service.js     选 API / 流式与普通生成 / 分用途中断
 *     story-engine.js   剧情解析(名册校验,不靠正则猜角色名)
 *     app-prompts.js    往 murmur 注册提示词
 *   components/       根 / 舞台 / 分支树 / 六个面板 / 弹窗 / 通用控件
 *
 * ── 相对原型的关键修复 ────────────────────────────────────────────
 *
 *   1. **回到过去不再毁掉未来**。原型的「跳转到此节点」是
 *      `gameHistory.slice(0, idx)` —— 直接把后面的剧情截断扔掉,
 *      所谓「节点分析」里根本没有分支。现在剧情是一棵真的树,
 *      任意节点随时可切,已经走过的线一条都不会丢。
 *   2. **记忆从「关键词捞」换成 K 链**。而且窗口状态挂在**每个节点**上,
 *      所以回到旧节点开新分支时,拿到的是那条线当时的窗口。
 *   3. **一次调用拿剧情 + 选项**。原型第二次调用是用正则改写第一次的
 *      system prompt 来的,世界观一变正则就失配,失配时会同时要求
 *      「不要生成选项」和「生成选项」。
 *   4. **好感度不再被「保存配置」清零**(原型每次保存都重建整张表)。
 *   5. **API 不在本 App 里配**,走 nook 的 API 管理。
 *   6. 换主题真的换得动:70 个 `--gg-*` 全在 `_theme.css`,JS 里一个 hex 都没有。
 */

import { createGalgameRoot } from './components/root.js';
import { registerGalgamePrompts } from './services/app-prompts.js';
import { GG_STORES } from './constants.js';
import { icon } from './icons.js';
import * as store from './store.js';

export default function createGalgameApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'galgame',
        name: '湛蓝回忆',
        icon: icon('appIcon'),
        iconBg: 'linear-gradient(135deg, #5DADE2 0%, #85C1E9 55%, #F5B7B1 100%)',

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '和 AI 一起走一遍故事',
                category: '游戏',
                isGame: true,
                rating: 4.7,
                ratingsCount: '132',
                size: '2.1 MB',
                age: '12+',
                version: '1.0.0',
                whatsNew: '剧情变成一棵可以随时回头的树;记忆换成 K 链滑动窗口;配色 70 项全可调。',
                description: `如果当时选了另一句话，故事会走到哪里？人总会在已经发生的事后面，看见一条没有走过的路。

湛蓝回忆从 nook 取来世界观、人设与场所，让 AI 把它们铺成一部可以选择的视觉小说。立绘与场景图可以由你配好；没有图片时，文字也会照常向前。

每一次选择都会留在剧情树上。你可以回到任意一幕，从那里走向别处，原来的分支并不会因此消失。`,
                accent: 'linear-gradient(145deg, #5DADE2 0%, #F5B7B1 100%)',
                tutorial: [
                    {
                        title: '开始第一场故事',
                        content: '打开湛蓝回忆,点「新建剧情」。如果是第一次使用,需要先在 nook 里设定世界观和人设。湛蓝回忆会自动从 nook 读取这些信息来生成故事开场。',
                    },
                    {
                        title: '剧情树是什么',
                        content: '每次你做选择,都会在剧情树上生成一个新节点。你可以随时点开剧情树,跳回任何一个节点,选择另一条分支继续。原来的那条线会保留,不会消失。',
                    },
                    {
                        title: '怎么给角色配图',
                        content: '点右上角的「角色」按钮,可以上传角色立绘。点「场景」按钮可以上传场景背景图。这些图片会出现在故事播放页的对应位置。',
                    },
                    {
                        title: '记忆系统怎么用',
                        content: '湛蓝回忆使用 K 链滑动窗口来管理记忆。当对话变长时,最早的回合会被压缩成梗概保留。点开记忆面板可以看到当前记住的核心信息。',
                    },
                    {
                        title: '配色可以改吗',
                        content: '可以。在设置里有一项「配色方案」,内置了多套配色,可以一键切换。也可以手动调整具体颜色。',
                    },
                ],
                faqs: [
                    {
                        question: '剧情会丢失吗？',
                        answer: '不会。每次选择都会保存在剧情树里。只要不主动删除,所有走过的线都还在剧情树里,随时可以回去重来。',
                    },
                    {
                        question: '需要先在 nook 里设定世界观吗？',
                        answer: '不需要。湛蓝回忆可以在没有世界观的情况下运行,但有世界观的话故事背景会更丰富。没有设定时会用默认背景生成故事。',
                    },
                    {
                        question: '立绘和场景图是必须的吗？',
                        answer: '不是必须的。没有配图时,故事页面只显示文字内容。配图会增加沉浸感,但纯文字也能完整游玩。',
                    },
                    {
                        question: '记忆梗概会自动生成吗？',
                        answer: '会的。当对话超过一定长度时,系统会自动把最早的回合压缩成梗概存入 K 链。也可以手动编辑梗概内容。',
                    },
                ],
            },
        },

        // ── 外观 ────────────────────────────
        // ★ 首帧兜底值,和默认主题(azure)对齐,防止打开时闪一下。
        //   挂载之后根组件会从 `_theme.css` 读出当前主题的实际值覆盖它们
        //   —— 颜色的真相始终在 CSS。
        background: '#0E1C24',
        statusBarColor: '#2C3E50',
        homeIndicatorColor: 'rgba(44, 62, 80, 0.3)',

        // 舞台要占满整屏:顶栏和 tab 栏都自己画，fullscreen 让内容铺满整屏、指示条浮在最顶层
        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '故事', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册,
        //   否则首次写盘时表还没建出来,表现是「保存成功但刷新就没了」
        stores: GG_STORES,

        renderMode: 'vue',

        /** ★ 没有 this —— 框架把它当独立函数调 */
        renderPage() {
            return createGalgameRoot();
        },

        /**
         * setup 在 **App 注册时**跑(页面一加载就跑,不管用户开不开这个 App)。
         * 跨 App prompt 必须在这里注册 —— 放 hydrate 里的话,
         * 用户没点过这个 App,murmur 的折叠区里就看不到它。
         */
        setup({ toolkit } = {}) {
            registerGalgamePrompts(toolkit);
            return {};
        },

        methods: {
            /** 供外部预热 / 深链调用;正常路径由根组件 mounted 自己拉 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /** murmur 的 `[写进故事:…]` 落到这里 */
            async captureNote(payload = {}) {
                const text = String(payload.text || payload.content || '').trim();
                if (!text) return { ok: false, error: '内容为空' };
                await store.hydrate(this.app);
                return store.captureNote(text);
            },

            /** 给别的 App 读:当前故事走到哪了(只读摘要,不含正文) */
            async readProgress() {
                await store.hydrate(this.app);
                return store.readProgressBrief();
            },
        },
    };
}
