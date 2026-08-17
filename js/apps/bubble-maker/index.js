/**
 * 气泡机 —— 聊天气泡与形状的工作台
 *
 * 由参考软件 `QAQ/代制作软件/bubble-editor.js`(4000 行 IIFE)
 * 与 `QAQ/代制作软件/svg预览.html` 合并重写而来,实现全部换成本项目的 vue 模式。
 *
 * ── 架构 ──────────────────────────────────────────────────────────
 *
 *   index.js          appConfig(框架对接都在这)
 *   store.js          Vue.reactive 单例 + mutator + 分对象防抖落盘
 *   constants.js      枚举 / 默认值(★ 不含任何界面颜色)
 *   theme.js          界面色板元信息(逻辑走 src/core/theme-tokens.js)
 *   icons.js / utils.js
 *   services/
 *     db.js             两张表 + 归一化(SVG 在写入这一层消毒)
 *     presets.js        内置气泡(★ 这里的色值是用户内容,不是界面配色)
 *   components/       根 / 预览台 / 设计 / 形状 / 气泡库 / 外观 / 弹窗
 *
 *   气泡「配置 → 样式」的实现在 `src/core/bubble-style.js`,
 *   渲染组件在 `src/core/components/bubble-view.js` —— 和情景聊天共用同一份,
 *   这是「编辑器里看到什么,聊天里就是什么」的物理保证。
 *
 * ── 相对参考软件的关键改动 ────────────────────────────────────────
 *
 *   1. **时间戳和头像整个挪走**。它们是「一条消息」的排版,不是气泡样式;
 *      留在这里的后果是同一套气泡换个 App 就用不了。现在归情景聊天的主题管。
 *   2. **不再分「用户气泡 / AI 气泡」两套面板**。参考软件为此有 8 个折叠区
 *      和一个「同步到 AI」按钮;这里一次只编辑一个气泡,成对使用在情景聊天里选。
 *   3. **尾巴定位换成「贴哪条边 + 沿边走多远 + 外移多少」**。参考软件用
 *      x / y 绝对偏移,改圆角或内边距之后尾巴会跑掉,得回头重调。
 *   4. **SVG 一律消毒**。参考软件和 svg 预览页都是直接 innerHTML,
 *      `<svg><script>` 会执行。现在白名单重建,而且拦在**写库**那一层。
 *   5. **SVG 编辑器合并进来**,并修掉它的旋转中心算错、镜像/旋转顺序不定、
 *      收藏没有名字、删完停在空页四个问题(详见 `panel-shape.js` 文件头)。
 *   6. **拆表存储**。参考软件把所有主题塞在一个 localStorage key 里,
 *      每存一次重新序列化整个库;超配额时 `setItem` 抛同步异常而它只有
 *      console.warn,表现是「点保存没反应,下次打开少了几套」。
 *   7. **界面配色 70+ 项全可调**,JS 里一个 hex 都没有(气泡自身的色值除外,
 *      那是用户内容 —— 理由写在 `services/presets.js` 文件头)。
 *
 * ── 给「情景聊天」留的口子 ────────────────────────────────────────
 *
 * `services.listBubbles()` / `services.getBubble({ id })` / `services.getShapes()`。
 * 那个 App 不需要知道本 App 的表名,也不该 import 这里的任何内部模块。
 */

import { createBubbleMakerRoot } from './components/root.js';
import { BB_STORES } from './constants.js';
import { getBubble as dbGetBubble, briefOf } from './services/db.js';
import { APP_ICON } from './icons.js';
import * as store from './store.js';

export default function createBubbleMakerApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'bubble-maker',
        name: '气泡机',
        icon: APP_ICON,
        // ★ 纯色不用渐变 —— 全 App 的设计规矩(用户要求「禁用渐变」)
        iconBg: '#FFD9E4',

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '把聊天气泡调成你要的样子',
                category: '效率',
                rating: 4.8,
                ratingsCount: '96',
                size: '1.2 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '第一版:气泡设计、SVG 形状工作台、气泡库,配色 40 项全可调。',
                description: `一句话为什么要有形状？也许同样的字落在不同的边框里，停顿和语气也会悄悄改变。

气泡机只做气泡。底色、毛玻璃、四角圆角、描边、阴影与多条尾巴，都留在同一张画布上慢慢调整；也可以粘入 SVG，重新上色、旋转或镜像，收进形状库。

保存后的气泡会留给情景剧场使用。头像和时间戳仍由消息排版决定，这里只安静地保管一句话的外壳。`,
                accent: '#FFD9E4',
                tutorial: [
                    {
                        title: '设计你的第一个气泡',
                        content: '打开气泡机,默认会有一个新建的气泡在画布上。左侧面板可以调整颜色、圆角、描边、阴影等属性,实时预览效果。',
                    },
                    {
                        title: '怎么调整气泡形状',
                        content: '「圆角」滑块控制四角圆弧大小,「描边」控制边框粗细和颜色,「阴影」可以选预设或自定义参数。调整后气泡会实时更新。',
                    },
                    {
                        title: '怎么添加气泡尾巴',
                        content: '点「+ 尾巴」按钮可以添加多条尾巴。每条尾巴可以单独调整位置和方向。点「形状库」可以从预设形状中选择,也可以粘入 SVG 代码自己画。',
                    },
                    {
                        title: '怎么保存到形状库',
                        content: '设计好的气泡右上角有「保存」按钮,点完会存入形状库。之后在任意气泡上都可以从形状库选择已保存的样式快速复用。',
                    },
                    {
                        title: '怎么在情景聊天里用',
                        content: '保存气泡后,打开情景聊天 app,切换到气泡模式,你设计的气泡会自动出现在气泡列表中。选择后即可使用。',
                    },
                ],
                faqs: [
                    {
                        question: '设计的气泡会自动保存吗？',
                        answer: '会自动保存到形状库。下次进来可以继续编辑,也可以新建气泡重新设计。',
                    },
                    {
                        question: 'SVG 形状库支持哪些功能？',
                        answer: '可以粘入任意 SVG 代码片段。粘进来后可以调整颜色、缩放大小、旋转角度、镜像翻转,然后保存到形状库。',
                    },
                    {
                        question: '同一个气泡可以给多个情景用吗？',
                        answer: '可以。气泡是共享的,一旦保存到形状库,所有情景都可以选择使用。',
                    },
                    {
                        question: '毛玻璃效果是什么原理？',
                        answer: '毛玻璃会让气泡背景变成半透明磨砂质感,类似 iOS 的毛玻璃设计语言。适合用在深色背景上,文字会更突出。',
                    },
                ],
            },
        },

        // ── 外观 ────────────────────────────
        // ★ 首帧兜底值,和默认配色(白瓷)对齐,防止打开时闪一下。
        //   挂载之后根组件会从 `_theme.css` 读出实际值覆盖它们 —— 颜色的真相始终在 CSS。
        background: '#FBFAF9',
        statusBarColor: '#4A4247',
        homeIndicatorColor: 'rgba(74, 66, 71, 0.28)',

        // 顶栏和分档都自己画
        topbar: { visible: false },
        nav: { type: 'none' },

        pages: [{ id: 'home', label: '工作台', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册,
        //   否则首次写盘时表还没建出来,表现是「保存成功但刷新就没了」
        stores: BB_STORES,

        renderMode: 'vue',

        /** ★ 没有 this —— 框架把它当独立函数调 */
        renderPage() {
            return createBubbleMakerRoot();
        },

        methods: {
            /** 供外部预热 / 深链调用;正常路径由根组件 mounted 自己拉 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /**
             * ★ 给「情景聊天」的入口:列出可选的气泡(摘要,不含尾巴细节)。
             *
             * 返回摘要而不是完整配置,是因为选择器只需要名字和两个颜色;
             * 完整配置里每条尾巴可能带一整段 SVG,列表一次拉几十个会很沉。
             */
            async listBubbles() {
                await store.hydrate(this.app);
                return store.listBubbleBriefs();
            },

            /** 按 id 取一套完整气泡配置(含尾巴),渲染时用 */
            async getBubble(payload = {}) {
                const id = payload.id || payload.bubbleId;
                if (!id) return null;
                return dbGetBubble(this.app, id);
            },

            /**
             * SVG 形状库。
             *
             * 尾巴里存的是 `shapeId`,渲染时要拿这张表去查。
             * 情景聊天渲染每条消息都要用,所以给整份 —— 形状封顶 60 个,不大。
             */
            async getShapes() {
                await store.hydrate(this.app);
                return store.getShapes().map((s) => ({ id: s.id, name: s.name, svg: s.svg }));
            },

            /** 给别的 App 判断「有没有可用的气泡」,不用先拉整份列表 */
            async count() {
                await store.hydrate(this.app);
                return store.getState().bubbles.length;
            },

            /** 单条摘要 —— 主题设置页显示「当前用的是哪套」时用 */
            async briefOf(payload = {}) {
                const bubble = await dbGetBubble(this.app, payload.id);
                return bubble ? briefOf(bubble) : null;
            },
        },
    };
}
