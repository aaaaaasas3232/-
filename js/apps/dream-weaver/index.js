/**
 * 梦境编织 —— AI 小说共创
 *
 * 由 `QAQ/代制作软件/dream-weaver.js`(30664 行单文件原型)重写而来。
 * 功能对齐原型,实现全部换成本项目的 vue 模式范式。
 *
 * ── 架构 ──────────────────────────────────────────────────────────
 *
 *   index.js          appConfig(框架对接都在这)
 *   store.js          Vue.reactive 单例 + mutator + 分对象防抖落盘
 *   constants.js      枚举 / 默认值(★ 不含任何颜色)
 *   icons.js          图标集
 *   utils.js          id / 文本 / 时间 / 深拷贝
 *   services/
 *     db.js             三张表 + 归一化 + 旧版单 blob 迁移
 *     prompt-builder.js ★ 上下文组装的唯一真相(预览 == 发送)
 *     ai-service.js     选 API / 普通与流式生成 / 中断
 *     format-service.js 正文切片(结构化片段,不拼 HTML)
 *     app-prompts.js    往 murmur 注册提示词
 *   components/       根 / 书架 / 编辑器 / 我的 / 弹窗 / 抽屉 / 通用控件
 *
 * ── 相对原型的关键修复 ────────────────────────────────────────────
 *
 *   见 `docs/AGENTS2.md`。最要紧的三条:
 *   1. 上下文预览的开关**现在真的生效了**(原本预览和发送是两条路径)
 *   2. 正文不再双轨存储(`content` HTML + `messages` 数组同步不上)
 *   3. 换主题真的换得动(原本 694 处硬编码 hex 不受主题影响)
 */

import { createDreamWeaverRoot } from './components/root.js';
import { DW_STORES, listChapters } from './services/db.js';
import { registerDreamWeaverPrompts } from './services/app-prompts.js';
import { icon } from './icons.js';
import * as store from './store.js';

export default function createDreamWeaverApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'dream-weaver',
        name: '梦境编织',
        icon: icon('bookshelf'),
        iconBg: 'linear-gradient(145deg, #1a1035 0%, #2d1b4e 50%, #1a1035 100%)',

        dock: { visible: true, order: 4 },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '和 AI 一起写小说',
                category: '创作',
                isGame: false,
                rating: 4.8,
                ratingsCount: '186',
                size: '3.4 MB',
                age: '12+',
                version: '2.0.0',
                whatsNew: '完全重写:上下文可视可控、流式生成可中断、换主题真的换得动。',
                description: `故事为什么总在第一句之后变得犹豫？也许不是没有下文，只是还没决定要把梦交给哪一种可能。

梦境编织留着一座书架。建一本书，写下开头，让 AI 续写；也可以亲手改掉某一段，或者给下一程一句方向。

发给 AI 的内容会在上下文面板里逐段摊开。想让它记得什么，暂时略过什么，都由你在这一轮决定。故事还在纸上，去处不必急着回答。`,
                accent: 'linear-gradient(145deg, #C62828 0%, #1565C0 100%)',
                tutorial: [
                    {
                        title: '建第一本书',
                        content: '打开梦境编织,点「+」建一本新书。给它起个名字,选一个开场模板,写下第一句话,然后把剩下的交给 AI。你随时可以停下来,改一改,再让它接着写。',
                    },
                    {
                        title: '上下文面板怎么用',
                        content: '点右上角的「上下文」按钮,会展开一个面板,列出即将发给 AI 的所有内容。每段左边有个开关,可以关掉不想让 AI 看到的内容。关掉的部分不会发送。',
                    },
                    {
                        title: '怎么控制故事的走向',
                        content: '在写不下去的时候,点「引导」按钮,给 AI 一个方向提示,比如「主角决定去调查那座塔」。AI 会把这个方向融入后续情节。也可以直接手动编辑已有的段落。',
                    },
                    {
                        title: '换主题是什么意思',
                        content: '右上角的配色盘按钮可以换主题,会改变编辑器和阅读页的整体配色。每个主题都有深色和浅色两个版本。',
                    },
                    {
                        title: '书架里的书不见了怎么办',
                        content: '书架只显示当前选中的世界观下的书。如果切换了世界观,需要切回去才能看到原来的书。',
                    },
                ],
                faqs: [
                    {
                        question: '写的内容会被 AI 记住吗？',
                        answer: '会的。同一本书里的历史段落会累积成上下文,AI 会记得之前写过的情节和人物。但不同书之间是独立的。',
                    },
                    {
                        question: '上下文面板关掉的部分下次还会出现吗？',
                        answer: '会的。每次发送给 AI 时,上下文面板里所有打开的内容都会发送。关掉的部分只在这轮生效,下次发送时仍会重新计算。',
                    },
                    {
                        question: '可以和别人分享我写的小说吗？',
                        answer: '目前没有专门的分享功能,但你可以打开一本书的阅读页,然后截图或复制文字分享。',
                    },
                    {
                        question: '一本书可以写多长？',
                        answer: '取决于 AI 的上下文窗口大小和你的 API 配置。建议在写长篇时定期开新书,把前面的章节作为「新书」的第一段粘进去。',
                    },
                ],
            },
        },

        // ── 外观 ────────────────────────────
        // ★ 这三个是**首帧兜底值**,和默认主题(retro-dark)对齐,防止 App 打开的第一帧闪一下。
        //   挂载之后根组件会从 `_theme.css` 里读出当前主题的实际值覆盖它们
        //   (见 `components/root.js` 的 `applyTheme`)—— 颜色的真相始终在 CSS。
        //   框架画状态栏 / Home 条时只认 appConfig 上的这几个字段,不认识 CSS 变量,
        //   所以必须有这么一次「从 CSS 读出来转发给框架」的搬运。
        background: '#121212',
        statusBarColor: '#E8E8E8',
        homeIndicatorColor: 'rgba(160, 160, 160, 0.6)',

        // 顶栏和 tab 栏都自己画:编辑器要全屏,书架/我的有自己的头部
        topbar: { visible: false },
        nav: { type: 'none' },

        /**
         * ★ 声明「我会在什么时候占用灵动岛」。
         *   岛是运行时 API(toolkit.island.show),系统事先不知道会弹什么 ——
         *   不在这儿声明,「灵动岛与小组件」里就既预览不了也关不掉,
         *   而且 show() 不带 kind 的话用户那个开关是摆设。
         */
        islandKinds: [
            {
                id: 'format-select',
                label: '选段中',
                desc: '进入选段模式后以迷你岛挂着,提醒正文现在可以拖选。点一下不会展开,长按退出选段。',
                when: '在正文气泡「更多 → 格式化选择」里进入选段模式时',
                sizes: ['mini'],
                previewPayload: { title: '选段中', message: '拖选正文里的一段,松手就出操作条 · 长按退出' },
            },
        ],

        notifyKinds: [
            {
                id: 'action',
                label: '操作提示',
                desc: '复制、收藏、保存、生成结果这类短提示,只走灵动岛,页内不再叠一条。',
                when: '点了复制、收藏、换主题,或一次生成结束之后',
                type: 'info',
                title: '梦境编织',
                message: '已复制',
            },
        ],

        pages: [{ id: 'home', label: '书架', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册,
        //   否则首次写盘时表还没建出来,表现是「保存成功但刷新就没了」
        stores: DW_STORES,

        renderMode: 'vue',

        /**
         * ★ 没有 this —— framework 把它当独立函数调。
         *   需要 app 时用第三个参数,或者像这里一样交给根组件的 `app` prop。
         */
        renderPage() {
            return createDreamWeaverRoot();
        },

        /**
         * setup 在 **App 注册时**跑(页面一加载就跑,不管用户开不开这个 App)。
         * 跨 App prompt 必须在这里注册 —— 放 hydrate 里的话,
         * 用户没点过这个 App,murmur 的折叠区里就看不到它。
         */
        setup({ toolkit } = {}) {
            registerDreamWeaverPrompts(toolkit);
            return {};
        },

        methods: {
            /** 供外部预热 / 深链调用;正常路径由根组件 mounted 自己拉 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /**
             * 给别的 App 用:把一段文字存进灵感库。
             * murmur 的 `[存灵感:...]` 就落到这里。
             */
            async captureInspiration(payload = {}) {
                const text = String(payload.text || payload.content || '').trim();
                if (!text) return { ok: false, error: '内容为空' };
                await store.hydrate(this.app);
                const note = store.addInspiration(text);
                await store.flushPersist();
                return { ok: Boolean(note), id: note?.id };
            },

            /** 给别的 App 用:当前在写哪些书(只读摘要,不含正文) */
            async listBooks() {
                await store.hydrate(this.app);
                return store.getState().books.map((b) => ({
                    id: b.id,
                    title: b.title,
                    author: b.author,
                    synopsis: b.synopsis,
                    updatedAt: b.updatedAt,
                }));
            },

            /**
             * 给演员成长等后续 App 的剧本改编口。
             * 返回稳定、只读、可序列化的创作资料，不暴露 Vue 代理或编辑器 UI 状态。
             */
            async getAdaptationSource(payload = {}) {
                await store.hydrate(this.app);
                const bookId = String(payload.bookId || '').trim();
                const book = store.getState().books.find((item) => String(item.id) === bookId);
                if (!book) return { ok: false, error: '没有找到这本作品' };

                const chapters = await listChapters(this.app, book.id);
                const source = {
                    id: book.id,
                    title: book.title || '',
                    author: book.author || '',
                    synopsis: book.synopsis || '',
                    genre: book.genre || '',
                    tags: Array.isArray(book.tags) ? [...book.tags] : [],
                    characters: JSON.parse(JSON.stringify(book.characters || [])),
                    locations: JSON.parse(JSON.stringify(book.locations || [])),
                    timelineEvents: JSON.parse(JSON.stringify(book.timelineEvents || [])),
                    chapters: chapters.map((chapter) => ({
                        id: chapter.id,
                        title: chapter.title || '',
                        summary: chapter.summary || chapter.chapterInfo?.summary || '',
                        messages: (chapter.messages || [])
                            .filter((message) => message?.role !== 'note' || payload.includeNotes === true)
                            .map((message) => ({
                                id: message.id,
                                role: message.role,
                                content: message.content || '',
                                speaker: message.speaker || '',
                            })),
                    })),
                    updatedAt: book.updatedAt || 0,
                };
                return { ok: true, source };
            },
        },
    };
}
