/**
 * 四叶草 —— 按世界观生成内容的购物软件
 *
 * ── 它和普通 App 的根本区别 ───────────────────────────────────────
 *
 * 这个 App **没有内置任何商品**。货架上的每一件东西、每一家店、每一段小剧场，
 * 都是打开时按用户当前世界观现问 AI 生成的。所以它有两个别的 App 没有的概念：
 *
 *   **首次配置**  第一次进来必须先说清「按哪个世界观、用什么钱、参考哪些材料」
 *   **档案键**    数据按「默认用户 + 他绑的世界观」分档。换个用户换了世界观
 *                 就得重配；换回来数据原样恢复。
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js  枚举 / 默认值（★ 不含任何颜色）
 *   theme.js      颜色 token 的元信息 + 批量解析（★ 色值在 _theme.css）
 *   icons.js      图标（★ 全部带 width/height，禁 emoji）
 *   store.js      Vue.reactive 单例 + mutator + 防抖落盘
 *   services/
 *     world-context.js  世界观 / 夹子 / prompt 库 / AI 的唯一读取口
 *     prompt-builder.js ★ 提示词唯一真相（预览 == 发送）
 *     ai-service.js     选 API + 调用 + JSON 解析
 *     wallet-service.js 资金流动（走 settings 的 assetFlow，和红包同一本账）
 *     gift-service.js   送礼 / 分享到 murmur（不依赖 store，AI 送礼时 App 没开）
 *     shop-context.js   给 murmur 的**实时**上下文（心愿单按 AI 区分）
 *     db.js             五张表，全部按档案键分
 *     app-prompts.js    往 murmur 注册提示词
 *   components/   根 / 引导 / 列表 / 详情 / 购物车 / 我的 / 小剧场 / 弹层
 *
 * ── 给「情景聊天」App 留的口子 ────────────────────────────────────
 *
 * 小剧场存的是结构化台词（`scenes[].lines[] = {speaker, text}`）+ 带 id 的参演者。
 * 将来那个 App 只要通过 `services.getTheater(id)` / `services.listTheaters()`
 * 取走，就能知道「谁在场、说过什么」，接着往下演。
 * 它不需要知道档案键，也不该 import 这个 App 的任何内部模块。
 */

import { createShopRoot } from './components/root.js';
import { SHOP_STORES, getTheater as dbGetTheater, listTheaters as dbListTheaters } from './services/db.js';
import { registerShopPrompts } from './services/app-prompts.js';
import { installGiftBridge, aiGiftToUser } from './services/gift-service.js';
import { installShopContext } from './services/shop-context.js';
import { getProfileKey } from './services/world-context.js';
import { APP_ICON } from './icons.js';
import { FEED_KINDS } from './constants.js';
import * as store from './store.js';

export default function createShopApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'shop',
        name: '四叶草',
        icon: APP_ICON,
        iconBg: 'linear-gradient(145deg, #fee1ef 0%, #dffbea 100%)',

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '按你的世界观开一家店',
                category: '生活',
                isGame: false,
                rating: 4.7,
                ratingsCount: '92',
                size: '2.6 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '第一版：商品、探店、购物车、心愿单、小剧场，全部按世界观生成。',
                description:
                    '既然住在一个世界里，总会想知道那里的人逛什么店，又把什么东西带回家。\n\n'
                    + '四叶草没有预先摆好的商品。它读取默认用户绑定的世界观，依着那里的生活生成货架、店铺和探店内容。喜欢的可以收进心愿单，也可以留下一场与角色有关的小剧场。\n\n'
                    + '结账走的是聊天红包与转账共用的钱包，购买记录会留在同一本流水里。AI 也可以用自己的余额送来一件东西，实名或匿名都由那次选择决定。',
                accent: 'linear-gradient(150deg, #6E9C7C 0%, #D9A183 100%)',
                tutorial: [
                    {
                        title: '第一次打开四叶草该做什么',
                        content: '四叶草会读取默认用户明确绑定的世界观,生成符合那个世界风格的商品和店铺。请先去 nook 创建世界观,并把默认用户绑定到它,再回来逛四叶草。',
                    },
                    {
                        title: '怎么给自己买东西',
                        content: '浏览货架,点进感兴趣的商品,在详情页点「购买」即可。支付走你的钱包余额,购买记录在聊天 app 里的钱包流水里可以查到。',
                    },
                    {
                        title: 'AI 可以给我买东西吗',
                        content: '可以。在聊天的红包功能里,AI 可以主动给你发红包或转账。你可以把这些钱转到四叶草里购物,也可以让 AI 直接用自己的余额代购。',
                    },
                    {
                        title: '探店是什么意思',
                        content: '「探店」是四叶草生成的世界观特色店铺列表。点进去可以看到 AI 根据你的世界观虚构出来的商店介绍和氛围描述,逛一逛也是了解这个世界的一种方式。',
                    },
                    {
                        title: '心愿单有什么用',
                        content: '把喜欢的商品加入心愿单,方便以后快速找到。AI 在特殊日子(比如你们相识纪念日)可能会主动翻心愿单,给你一个惊喜。',
                    },
                ],
                faqs: [
                    {
                        question: '四叶草里的钱是真实的钱吗？',
                        answer: '是的。四叶草共用聊天里的钱包系统,余额就是你在聊天 app 里能看到的余额。购买支出和 AI 转账、红包都是同一个账户。',
                    },
                    {
                        question: '没有设定世界观能看到商品吗？',
                        answer: '不能生成。请先在 nook 把默认用户绑定到一个世界观；四叶草不会静默借用其他用户当前打开的世界,以免把商品写错档。',
                    },
                    {
                        question: '商品是真实存在的吗？',
                        answer: '不是。四叶草的商品和店铺是 AI 根据世界观生成的虚构内容,用于增加逛店和角色扮演的沉浸感。钱包支出是真实余额变动,商品本身不涉及真实交易。',
                    },
                    {
                        question: 'AI 能看到我的购买记录吗？',
                        answer: '可以。AI 可以读取你的钱包流水,包括四叶草的购买记录。所以如果你们聊到「最近买了什么」,AI 会知道。',
                    },
                ],
            },
        },

        // ── 外观 ────────────────────────────
        // 这三个是**首帧兜底值**，和默认主题「晨露」对齐，防止打开时闪一下。
        // 挂载后根组件会从 `_theme.css` 读实际值覆盖它们 —— 颜色的真相始终在 CSS。
        background: '#F7F8F5',
        statusBarColor: '#2E332F',
        homeIndicatorColor: 'rgba(46, 51, 47, 0.45)',

        // 顶栏和底栏都自己画：顶栏要放世界观名，底栏要放购物车角标和未读点
        topbar: { visible: false },
        nav: { type: 'none' },

        // 自绘底栏 + 内容铺到底边。不开的话底部 40px 永远是那张静态 background，
        // 换了主题这一条不跟着变，看着像贴了一条边
        fullscreen: true,

        pages: [{ id: 'home', label: '四叶草', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册，
        //   否则首次写盘时表还没建出来，表现是「保存成功但刷新就没了」
        stores: SHOP_STORES,

        renderMode: 'vue',

        // 这里曾经声明过 socialProfile（「你的购物偏好人设」），于是 nook 的
        // 「社媒形象」里多出一张四叶草卡。但本 App 从来没有读过
        // persona.socialProfiles.shop —— 用户在那张卡里配的网名 / 头像 / 背景
        // 会正常存进库，然后没有任何一处消费。声明先撤掉：想做购物人设的话，
        // 先把消费端接上（参考 blog-app/services/world-context.js 的
        // readUserSocialProfile），再把声明加回来。

        // ★ 没有 this —— framework 把它当独立函数调
        renderPage() {
            return createShopRoot();
        },

        /**
         * setup 在 **App 注册时**跑（页面一加载就跑，不管用户开不开这个 App）。
         *
         * 这里做的三件事都必须在这个时机：
         *   - 跨 App prompt：放 hydrate 的话，用户没点过这个 App，
         *     murmur 的折叠区里就看不到它
         *   - 送礼桥：AI 可能在用户从没打开过购物软件时就送东西
         *   - 上下文占位：先挂一个「还没就绪」的读取器，
         *     免得 murmur 那边 `window.__shopContext` 是 undefined
         */
        setup({ toolkit, app } = {}) {
            registerShopPrompts(toolkit);
            installGiftBridge();
            // 先挂一个「还没就绪」的读取器占位，免得 murmur 那边
            // `window.__shopContext` 是 undefined。根组件挂载后会用真的换掉它。
            installShopContext(null);

            // ★ 心愿单必须在**用户没打开过这个 App** 时也能进 AI 的上下文。
            //   否则表现是「聊天里 AI 从来不知道我想要什么，除非我先去逛一圈」——
            //   而这个因果关系用户根本猜不到。
            //
            //   不能在 setup 里直接 hydrate：注册流程是
            //   `normalizeAppConfig(跑 setup) → 声明 stores → ensureSchema(建表)`，
            //   setup 这一刻表还没建出来，读了必然拿不到东西。
            //   等 `phone:apps-registered` —— 那时候所有表都在了。
            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    store.hydrate(app).catch((err) => {
                        console.warn('[shop] 后台预热失败，等用户打开 App 时再试', err);
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

            /**
             * 聊天里点小剧场概要卡 → 跳回来看完整那一场。
             *
             * 先派发 openApp 再改 store：App 还没挂载时 store 改了也没人画，
             * 而 openApp 之后根组件的 mounted 会跑 hydrate，
             * hydrate 完再打开就一定有数据。
             */
            async openTheaterFromChat(payload = {}) {
                const theaterId = payload?.theaterId;
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'openApp', appId: 'shop', pageId: 'home', payload: {} },
                    }));
                } catch (_) { /* noop */ }
                if (!theaterId) return;
                await store.hydrate(this.app);
                const hit = store.getState().theaters.find((t) => String(t.id) === String(theaterId));
                if (hit) store.openTheater(hit);
                else store.showToast('这一场已经删掉了');
            },
        },

        services: {
            /**
             * 给旅游等 App 的只读跨 App 入口：列出当前「默认用户 + 绑定世界」
             * 档案里真正拥有的物品。调用方只能拿普通对象，不能改四叶草 store。
             */
            async listPurchasedItems(payload = {}) {
                await store.hydrate(this.app);
                const state = store.getState();
                if (!state.identity.ready || state.needsConfig) return [];
                const includeGifts = payload.includeGifts !== false;
                return state.orders
                    .filter((order) => (
                        order?.type === 'purchase'
                        || (includeGifts && order?.type === 'gift-in')
                    ))
                    .flatMap((order) => (order.items || []).map((item, index) => ({
                        id: String(item.itemId || item.id || `${order.id}-${index}`),
                        orderId: order.id,
                        label: String(item.label || item.name || '未命名物品'),
                        kind: item.kind || FEED_KINDS.product,
                        qty: Math.max(1, Number(item.qty) || 1),
                        price: Number(item.price) || 0,
                        note: String(order.note || ''),
                        acquiredAt: order.createdAt || 0,
                        sourceType: order.type,
                    })));
            },

            /**
             * 聊天内容卡确认后的统一入口。
             * 卡片对应的旧货架已经刷新掉时，用卡片快照重建最小条目，再按当前
             * 世界观现生成详情；用户没确认之前框架不会调用这里。
             */
            async contentCards(request = {}) {
                if (request.entityType !== 'shop-item') {
                    return { ok: false, error: '四叶草不认识这类内容卡' };
                }
                await store.hydrate(this.app);
                const state = store.getState();
                if (!state.identity.ready || state.needsConfig) {
                    return { ok: false, error: '请先完成四叶草的首次配置' };
                }

                const card = request.payload?.card || {};
                const itemId = String(request.entityId || card.itemId || '').trim();
                const pools = [
                    ...(state.feeds?.product || []),
                    ...(state.feeds?.store || []),
                    ...(state.favorites || []),
                ];
                let item = pools.find((row) => String(row?.id) === itemId) || null;
                const kind = card.kind === FEED_KINDS.store ? FEED_KINDS.store : FEED_KINDS.product;

                if (!item) {
                    item = {
                        id: itemId || `chat-card-${Date.now()}`,
                        kind,
                        name: String(card.name || request.payload?.title || '未命名内容'),
                        brand: kind === FEED_KINDS.product ? String(card.sub || '') : '',
                        area: kind === FEED_KINDS.store ? String(card.sub || '') : '',
                        category: '',
                        blurb: String(card.blurb || ''),
                        price: kind === FEED_KINDS.product ? Number(card.price) || 0 : 0,
                        priceLevel: kind === FEED_KINDS.store ? Number(card.price) || 0 : 0,
                        tags: Array.isArray(card.tags) ? card.tags.slice(0, 3) : [],
                        detail: null,
                        favorited: false,
                        source: 'chat-card',
                        createdAt: Date.now(),
                    };
                }

                await store.openDetail(kind, item);
                if (!item.detail) {
                    return { ok: false, error: state.error || '详情生成失败，请稍后再试' };
                }
                return {
                    ok: true,
                    pageId: 'home',
                    pageType: 'root',
                    payload: { itemId: item.id, kind },
                };
            },

            /**
             * ★ 给「情景聊天」App 的入口。
             *
             * 按 id 直接取一场戏，不需要知道档案键。返回的结构里
             * `participants[].id` 是真实的 aiPersonId，`scenes[].lines[].speaker`
             * 是名字 —— 两者一起就够对上人设了。
             */
            async getTheater(payload = {}) {
                const id = payload.id || payload.theaterId;
                if (!id) return null;
                return dbGetTheater(this.app, id);
            },

            /** 当前这一档有哪些小剧场（只读摘要，不含全部台词） */
            async listTheaters() {
                const key = getProfileKey();
                if (!key) return [];
                const rows = await dbListTheaters(this.app, key);
                return rows.map((t) => ({
                    id: t.id,
                    title: t.title,
                    summary: t.summary,
                    occasion: t.occasion,
                    participants: t.participants,
                    sceneCount: (t.scenes || []).length,
                    createdAt: t.createdAt,
                }));
            },

            /**
             * 给 murmur 用：AI 决定给用户买东西。
             *
             * 走 service 而不是让 chat 直接 import —— chat 不该知道
             * 购物软件的内部模块长什么样，而且购物软件可能根本没装。
             */
            async aiGift(payload = {}) {
                return aiGiftToUser(payload);
            },
        },
    };
}
