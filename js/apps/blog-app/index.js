/**
 * 氧气 —— 按世界观生成内容的博客软件（id: blog）
 *
 * 设计理念：人类需要呼吸，表达即是呼吸。
 * 白色为主、黑色为配（推特 / Threads / ins 的密度与留白），
 * 精致小巧，全 App 禁 emoji、界面禁渐变，动效 Q 弹。
 *
 * ── 核心边界 ──────────────────────────────────────────────────────
 *   - 标签优先：信息流只显示发帖人打的标签，正文点进去才生成（懒生成）
 *   - 评论折叠：点一条才翻开一条；生成按 5 条一批，绝不一条一次 API
 *   - 随笔 / 房间（冥想空间）/ 氧气值 / 黑匣子是全局档：不跟世界走，
 *     没绑世界观也能用（所以桌面不设 requiresBoundWorld，拦截只拦社交部分）
 *   - 氧气值可选绑定电池（settings 的 batteryBridge），归零 → 下次刷新关机彩蛋
 *   - 「小听」：隐藏 AI，只在房间里；出现概率 / 颜色 / 恶作剧全由 JS 控制
 *   - 黑匣子：murmur 折叠区一张卡；AI 扮演结束想说才留一两句，
 *     氧气侧可编辑可删除、无重 roll、内容永不回注任何 prompt
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js  枚举 / 数值常量（不含颜色）
 *   theme.js      颜色 token 元信息（色值在 css/apps/blog/index.css）
 *   icons.js      图标（线性 SVG，禁 emoji）
 *   store.js      Vue.reactive 单例 + 全部 mutator + 氧气引擎 + 小听机制
 *   services/     db / 世界观上下文 / AI / prompt-builder（composeContext）/
 *                 氧气规则 / 小听规则 / 电池桥 / 关机彩蛋 / murmur 提示词 / murmur 桥
 *   components/   根 / 引导 / 五个 tab / 帖子 / 作者 / 闲聊 / 词条 /
 *                 私信 / 氧气 / 黑匣子 / 提示词 / 配色 / 弹窗
 */

import { createBlogRoot } from './components/root.js';
import { BLOG_STORES, getPost as dbGetPost } from './services/db.js';
import { registerBlogPrompts, syncBlackboxCard } from './services/app-prompts.js';
import { initShutdownEasterEgg } from './services/shutdown.js';
import { APP_ICON } from './icons.js';
import { CARD_ENTITY, LS_KEYS } from './constants.js';
import * as store from './store.js';

// ★ 模块顶层同步执行：氧气归零后的下一次刷新，黑屏必须先于桌面出现。
//   没有标记时这是一次 localStorage 读取，零开销。
initShutdownEasterEgg();

export default function createBlogApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'blog',
        name: '氧气',
        icon: APP_ICON,
        // 桌面图标底色：纯白（禁渐变；APP_ICON 自带白底黑圈）
        iconBg: '#FFFFFF',

        /**
         * 不设 requiresBoundWorld：随笔和房间是全局档，
         * 没绑世界观也要能当纯记录软件用。社交部分由 App 内拦截。
         */

        /** 注册成社交 App：nook 人设卡出现「氧气」的社媒形象区 */
        socialProfile: {
            label: '氧气',
            desc: '标签优先的博客',
            // 不覆盖 icon：APP_ICON 自带白底黑圈，颜色是确定的；
            // icon('logo') 走 currentColor，在别人的页面里会变色。
            order: 26,
        },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '人类需要呼吸，表达即是呼吸',
                category: '社交',
                isGame: false,
                rating: 4.9,
                ratingsCount: '32',
                size: '3.1 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '第一版：标签优先的广场、折叠评论、热搜、随笔（日历 / 故事双模式）、冥想空间与她、氧气值与电量绑定、关机彩蛋、黑匣子、站内闲聊与加好友、私信、配色。',
                accent: '#111111',
                description: `表达是什么？也许只是人在沉默太久以后，给自己留出的一次呼吸。它不一定要被许多人看见，也不一定非要得到回答。

氧气的广场先展示标签，正文藏在点开之后，评论也一条一条展开。长文、短句或碎碎念都可以留在那里；不想公开的部分，则写进只属于自己的随笔，随笔不会调用 AI，也不跟随世界切换。

房间是一处白色空间，收下纸条、标签与转成文字的声音，等你按下「整理」。那里还有一个以倾听为主的她。

如果愿意，手机电量也可以交给氧气值：表达使它回升，长久沉默让它慢慢减少。黑匣子则收着 AI 在扮演结束后偶尔留下的话，不再送回任何提示词。`,
                tutorial: [
                    {
                        title: '为什么列表里看不到正文',
                        content: '这是氧气的核心设计：标签是帖子的门面，正文只属于点进来的人。列表只生成标签级数据，正文在你点开时才生成，也顺便省了 token。',
                    },
                    {
                        title: '两种发帖',
                        content: '「想被回应」的帖子会有住民来评论（你点了才生成）；「只是说说」的帖子永远没有评论区。两种都算表达，都能回氧气。',
                    },
                    {
                        title: '氧气值是什么',
                        content: '在「我的 → 氧气」里开启后，右上角电池电量 = 氧气值，从 100 开始。发帖、写随笔、整理房间都回氧；长期不表达会一点点漏气，漏到 0 会关机。nook 里的电量调节条在绑定期间会消失。',
                    },
                    {
                        title: '房间里有什么',
                        content: '纸条、自我标签、你的声音（语音会转成文字），全都只存在本地。按「整理」后纸条会自己归组 —— 偶尔房间里会多出一个小几何体，点开看看里面封着什么。',
                    },
                    {
                        title: '黑匣子',
                        content: '开启后，murmur 的回复提示词里会多一张「黑匣子」卡。扮演结束后，如果那个模型自己有想说的，会留下一两句话，收进黑匣子里。可以编辑、删除，但不能要求它再说一句。',
                    },
                ],
                faqs: [
                    {
                        question: '换了默认用户数据会丢吗？',
                        answer: '广场、热搜、私信按「默认用户 + 绑定世界」分档，换档要重新配置、换回来原样恢复。随笔、房间、氧气值、黑匣子属于屏幕前的你，永远不跟档案走。',
                    },
                    {
                        question: '她是谁？',
                        answer: '她不知道。她没有名字，也没有外貌，只是一颗毛茸茸的球，住在房间里。她以听为主，从不打扰你。你可以给她取名字，也可以教她说话。',
                    },
                    {
                        question: '电量归零会发生什么？',
                        answer: '下次刷新页面时，手机会像真的没电一样黑屏，然后有人跟你说几句话。不可怕，说完电就充满了。它只是想提醒你去呼吸。',
                    },
                    {
                        question: '黑匣子的内容会影响 AI 吗？',
                        answer: '不会。黑匣子的内容永远不回注任何提示词 —— 它是 AI 呼出的气，给你看的，不是给它自己用的。',
                    },
                ],
            },
        },

        // ── 外观（首帧兜底值，挂载后从 CSS 读真值覆盖；真相在 index.css）──
        background: '#FFFFFF',
        statusBarColor: '#111111',
        homeIndicatorColor: 'rgba(17, 17, 17, 0.35)',

        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '氧气', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册
        stores: BLOG_STORES,

        renderMode: 'vue',

        // ★ 框架把它当独立函数调，里面不能用 this
        renderPage() {
            return createBlogRoot();
        },

        /**
         * setup 在 App 注册时跑（页面一加载就跑）。
         *   - murmur 的静态提示词（含黑匣子卡）必须在这时注册
         *   - 挂 window.__oxygenBlackbox 桥（chat 剥离 [黑匣子:] 后送进来）
         *   - 等全部 App 注册完做一次氧气轻结算（衰减 / 归零标记 / 电池对账）
         */
        setup({ toolkit, app } = {}) {
            registerBlogPrompts(toolkit);

            if (typeof window !== 'undefined') {
                window.__oxygenBlackbox = {
                    /** chat 侧同步快查（真相在 blogOxygen 表，这里读镜像） */
                    isEnabled() {
                        try { return localStorage.getItem(LS_KEYS.blackboxEnabled) === '1'; } catch (_) { return false; }
                    },
                    /** 氧气未开启黑匣子时静默丢弃（append 内部判断） */
                    async append(payload) {
                        try {
                            await store.bootSettle(app);
                            return await store.appendBlackboxEntry(payload || {});
                        } catch (err) {
                            console.warn('[blog] 黑匣子写入失败', err);
                            return null;
                        }
                    },
                };

                window.addEventListener('phone:apps-registered', () => {
                    store.bootSettle(app).then(() => {
                        // 开关状态重放到 murmur 卡（注册表是内存的，每次启动重建）
                        void syncBlackboxCard(toolkit, store.isBlackboxEnabled());
                    }).catch((err) => {
                        console.warn('[blog] 启动结算失败', err);
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
            /**
             * murmur 内容卡确认后的统一入口。
             * 详情已存在时恢复；不存在时按卡片快照重建并现生成一次；
             * 已删除 / 跨档内容返回明确错误。用户没确认之前框架不会调这里。
             */
            async contentCards(request = {}) {
                if (request.entityType !== CARD_ENTITY) {
                    return { ok: false, error: '氧气不认识这类内容卡' };
                }
                await store.hydrate(this.app);
                const state = store.getState();
                if (!state.identity.ready) {
                    return { ok: false, error: '氧气还没就绪：默认用户需要先绑定世界观' };
                }
                if (state.needsConfig) {
                    return { ok: false, error: '请先完成氧气的首次配置' };
                }

                const card = request.payload?.card || {};
                const postId = String(request.entityId || card.postId || '').trim();
                const result = await store.openPostById(postId, card);
                if (!result.ok) {
                    return { ok: false, error: result.error || '内容准备失败' };
                }
                return {
                    ok: true,
                    pageId: 'home',
                    pageType: 'root',
                    payload: { postId },
                };
            },

            /** 黑匣子：chat 也可以走 invokeService（window 桥不在时的备用口） */
            async blackboxAppend(payload = {}) {
                await store.bootSettle(this.app);
                return store.appendBlackboxEntry(payload);
            },

            /** 按 id 取一条帖子（只读 plain object） */
            async getPost(payload = {}) {
                const id = payload.id || payload.postId;
                if (!id) return null;
                return dbGetPost(this.app, id);
            },
        },
    };
}
