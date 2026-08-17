/**
 * 萤火 —— 按世界观生成内容的视频软件（id: youtube）
 *
 * ── 核心边界 ──────────────────────────────────────────────────────
 *   - 必须有默认用户且明确绑定世界观（worldAvailability.requiresBoundWorld），
 *     不用 active world 偷偷兜底
 *   - 数据按 `${userId}::${worldId}` 分档；切档要重配，切回来原样恢复
 *   - 首配后只生成视频列表；点视频才生成详情 + 首批评论；点头像才生成主页；
 *     点「开始看直播」才生成一场（弹幕池一次 API，JS 分发）；
 *     点「更多评论」每次 +5；点「让 TA 发视频」「收一批私信」才各调一次
 *   - 视频没有真实画面：封面 = 色块 + 大字，内容 = 分段文字梗概
 *   - 头像可绑 nook 图库图组，externalId → 头像映射持久化（刷新不换脸）
 *   - 站内闲聊不可编辑 / 删除 / 重 roll；聊得投缘可注册进 nook 角色库
 *     （registerEncounteredCharacter，幂等，简介带相识缘由）
 *   - 分享到 murmur 走 createContentCardAction 确认协议；取消不调 AI
 *   - 私信是 socialInfluences 的消费点：演员 / 爱豆 / 电竞上线后风向自动变
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js  枚举 / 默认值（不含颜色）
 *   theme.js      颜色 token 元信息（色值在 css/apps/youtube/index.css）
 *   icons.js      图标（全带 width/height，禁 emoji）
 *   store.js      Vue.reactive 单例 + 全部 mutator
 *   services/     db / 世界观上下文 / AI / prompt-builder（composeContext）/
 *                 头像池 / 数据计算 / 直播间纯逻辑 / murmur 桥 / murmur 提示词
 *   components/   根 / 引导 / 五个 tab / 视频 / 主页 / 直播 / 闲聊 /
 *                 提示词 / 配色 / 弹窗
 */

import { createYoutubeRoot } from './components/root.js';
import { YOUTUBE_STORES, getUpload as dbGetUpload, getVideo as dbGetVideo, listUploads as dbListUploads } from './services/db.js';
import { registerYoutubePrompts } from './services/app-prompts.js';
import { getProfileKey } from './services/world-context.js';
import { APP_ICON } from './icons.js';
import { CARD_ENTITY } from './constants.js';
import { asArray } from './utils.js';
import * as store from './store.js';

export default function createYoutubeApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'youtube',
        name: '萤火',
        icon: APP_ICON,
        // 桌面图标底色：画在 app-shell 外，CSS 变量够不着（纯色，禁渐变）
        iconBg: '#F7E3E1',

        /** 通用 App：首次启动就显示；未绑定世界观时由 App 内引导处理 */
        worldAvailability: {
            requiresBoundWorld: false,
        },

        /** 注册成社交 App：nook 人设卡出现「萤火」的社媒形象区（网名 / 头像 / 背景） */
        socialProfile: {
            label: '萤火',
            desc: '视频与直播',
            // 不覆盖 icon：用 APP_ICON（暖粉底 + 深红播放键）跟桌面保持一致。
            // 这里以前写的是 icon('spark')，而 icon() 一律 stroke="currentColor"，
            // 放到 nook 的人设卡里就变成一个跟着正文颜色走的灰线框。
            order: 25,
        },

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '这个世界的视频软件',
                category: '社交',
                isGame: false,
                rating: 4.7,
                ratingsCount: '48',
                size: '2.8 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '第一版：视频列表、详情与评论、频道主页、直播弹幕、站内闲聊与加好友、我的频道、私信收件箱、图库头像、配色，全部按世界观生成。',
                accent: '#C4485B',
                description: `一个世界如果真的生活着，会有人把什么拍下来？也许是大事，也许只是一顿晚饭。镜头存在以前，人们就已经想把看见的东西讲给别人听。

萤火读取你绑定的世界观，长出那个世界的视频列表、频道、评论与直播。这里没有真实画面：色块与大字是封面，分段的文字梗概就是视频，主播的话和弹幕也以文字经过。

你有自己的频道，可以发布作品、收到随粉丝规模而来的观众评论与私信。评论区里遇见的人也有主页，可以聊几句；若彼此愿意继续认识，TA 会被存进 nook。`,
                tutorial: [
                    {
                        title: '第一次打开萤火该做什么',
                        content: '萤火会读取默认用户明确绑定的世界观。首次配置里选好世界观材料、起个频道昵称、定粉丝规模，还可以绑一个图库图组当头像池。完成后只会生成一批视频列表，不会一口气生成所有详情。',
                    },
                    {
                        title: '怎么省 token',
                        content: '一切生成都是点出来的：点视频才生成详情和首批评论，点「更多评论」每次加 5 条，点头像才生成主页，点「开始看直播」才生成一场直播 —— 弹幕池一次拿完，飘出来的节奏由本地控制，不会一条弹幕调一次 AI。',
                    },
                    {
                        title: '和站内网友闲聊',
                        content: '看过某个人的主页后就能发起闲聊。站内闲聊没有重 roll、编辑和删除 —— 网友说出去的话就是说出去了。聊得投缘可以点「加为好友」，TA 会进入 nook 角色库并自动绑定当前世界，简介里写清你们怎么认识的。',
                    },
                    {
                        title: '自己的频道',
                        content: '「我的」里可以发视频。播放量、点赞和评论总数由本地按你的粉丝数算出来（评论特别多时显示 99+）；点「看看观众怎么说」才生成评论正文，每次 5 条。视频可以编辑和删除，删除后分享出去的卡片会显示内容已删除。',
                    },
                ],
                faqs: [
                    {
                        question: '视频是真的能播放吗？',
                        answer: '不能，也不需要。萤火用「色块封面 + 大字 + 分段文字梗概」模拟视频，读完梗概等于看完了这条视频。直播同理：主播的话和弹幕都是文字。',
                    },
                    {
                        question: '换了默认用户数据会丢吗？',
                        answer: '不会。数据按「默认用户 + 绑定世界」分档：换档要重新配置，换回来时原来的列表、收藏、频道、聊天和私信原样恢复。',
                    },
                    {
                        question: '头像图库是怎么用的？',
                        answer: '绑定 nook 图库的一个图组后，站内用户的头像从里面取，而且认脸：同一个人永远用同一张，刷新也不换。想全员换脸要显式点「重新分配头像」。不绑就用颜色占位头像。',
                    },
                    {
                        question: '加好友会发生什么？',
                        answer: '那位网友会变成 nook 里的一张 AI 人设卡，自动绑定当前世界观，简介里记着你们在萤火怎么认识的。之后在 murmur 也能找 TA 聊天，重复添加不会造出第二个 TA。',
                    },
                ],
            },
        },

        // ── 外观（首帧兜底值，挂载后从 CSS 读真值覆盖；真相在 index.css）──
        background: '#FBF7F4',
        statusBarColor: '#3B2B2E',
        homeIndicatorColor: 'rgba(59, 43, 46, 0.4)',

        topbar: { visible: false },
        nav: { type: 'none' },
        fullscreen: true,

        pages: [{ id: 'home', label: '萤火', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册
        stores: YOUTUBE_STORES,

        renderMode: 'vue',

        // ★ 框架把它当独立函数调，里面不能用 this
        renderPage() {
            return createYoutubeRoot();
        },

        /**
         * setup 在 App 注册时跑（页面一加载就跑）。
         * murmur 的静态提示词必须在这时注册 —— 放 hydrate 的话，
         * 用户没点过萤火，murmur 折叠区里就看不到它。
         */
        setup({ toolkit } = {}) {
            registerYoutubePrompts(toolkit);
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
                    return { ok: false, error: '萤火不认识这类内容卡' };
                }
                await store.hydrate(this.app);
                const state = store.getState();
                if (!state.identity.ready) {
                    return { ok: false, error: '萤火还没就绪：默认用户需要先绑定世界观' };
                }
                if (state.needsConfig) {
                    return { ok: false, error: '请先完成萤火的首次配置' };
                }

                const card = request.payload?.card || {};
                const videoId = String(request.entityId || card.videoId || '').trim();
                const result = await store.openVideoById(videoId, card);
                if (!result.ok) {
                    return { ok: false, error: result.error || '内容准备失败' };
                }
                return {
                    ok: true,
                    pageId: 'home',
                    pageType: 'root',
                    payload: { videoId },
                };
            },

            /** 当前档案的作品摘要（只读 plain object；博客 / 生涯 App 以后要用） */
            async listUploads() {
                const key = getProfileKey();
                if (!key) return [];
                const rows = await dbListUploads(this.app, key);
                return asArray(rows).map((u) => ({
                    id: u.id,
                    ownerType: u.ownerType,
                    ownerName: u.ownerName,
                    title: u.title,
                    kind: u.kind,
                    blurb: u.blurb,
                    views: u.stats?.views || 0,
                    publishedAt: u.publishedAt || 0,
                }));
            },

            /** 按 id 取一条视频 / 作品（不过滤档案键 —— 调用方不该知道分档规则） */
            async getVideo(payload = {}) {
                const id = payload.id || payload.videoId;
                if (!id) return null;
                return (await dbGetUpload(this.app, id)) || (await dbGetVideo(this.app, id));
            },
        },
    };
}
