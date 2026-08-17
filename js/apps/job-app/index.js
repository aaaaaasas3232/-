/**
 * 灯塔 —— 按世界观生成内容的求职软件
 *
 * ── 它和普通 App 的根本区别 ───────────────────────────────────────
 *
 * 这个 App **没有内置任何职位**。招聘板上每一个岗位、每一个 HR、
 * 每一天的工作片段，都是打开时按用户当前世界观现问 AI 生成的。所以它有
 * 两个别的 App 没有的概念：
 *
 *   **首次配置**  第一次进来必须先说清「按哪个世界观、用什么钱、参考哪些材料」
 *   **档案键**    数据按「默认用户 + 他绑的世界观」分档。换个用户换了世界观
 *                 就得重配；换回来数据原样恢复。
 *
 * ── 它给系统带来的东西 ────────────────────────────────────────────
 *
 * **一条实时的资产增加逻辑**。这是做它的第一动机：
 *
 *   月结  进 App 时算「上次发到哪天 → 今天跨过了几个发薪日」，一次补齐
 *   日结  演完当天的小剧场，按表现折算，**当场进钱包**
 *   打赏  同上，但可能是 0
 *
 * 钱一分都不自己记，全走 `sdk.assetFlow` —— 和红包、转账、四叶草的消费
 * 是同一本账。在这儿挣的，去 nook 的钱包页看得到，也能立刻花掉。
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js  枚举 / 默认值（★ 不含任何颜色）
 *   theme.js      颜色 token 的元信息 + 批量解析（★ 色值在 _theme.css）
 *   icons.js      图标（★ 全部带 width/height，禁 emoji）
 *   store.js      Vue.reactive 单例 + mutator + 防抖落盘
 *   services/
 *     world-context.js   世界观 / 身份 / 人设职业写回 的唯一读取口
 *     prompt-cards.js    提示词卡目录（管理页和拼装读的是同一份）
 *     prompt-builder.js  ★ 提示词唯一真相（预览 == 发送）
 *     ai-service.js      选 API + 调用 + JSON 解析
 *     payroll-service.js ★ 唯一往钱包里加钱的地方
 *     schedule-service.js 工作日期表 / 发薪日推算
 *     job-context.js     给 murmur 的**按对话方区分**的实时上下文
 *     app-prompts.js     往 murmur 注册提示词
 *     db.js              六张表，全部按档案键分
 *   components/   根 / 引导 / 招聘板 / 详情 / 面试 / 在职 / 工作 / 小剧场 /
 *                 提示词 / 配色 / 我的 / 弹层
 *
 * ── 给其他 App 留的工作经历只读口 ────────────────────────────────
 *
 * 小剧场存的是结构化台词。别的 App 通过 `services.listPosts()` /
 * `services.getTheater()` 读取即可，不需要知道档案键，也不该 import
 * 这个 App 的内部模块。演员 / 爱豆 / 电竞经历由各自专属 App 管理。
 */

import { createJobRoot } from './components/root.js';
import {
    JOB_STORES,
    getPost as dbGetPost,
    getTheater as dbGetTheater,
    listPosts as dbListPosts,
    listTheaters as dbListTheaters,
} from './services/db.js';
import { registerJobPrompts } from './services/app-prompts.js';
import { installJobContext } from './services/job-context.js';
import { getProfileKey } from './services/world-context.js';
import { APP_ICON } from './icons.js';
import * as store from './store.js';

export default function createJobApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'job',
        name: '灯塔',
        icon: APP_ICON,
        iconBg: '#E8F4FC',

        distribution: {
            requiresInstall: false,
            appStore: {
                subtitle: '在你的世界里找一份活',
                category: '生活',
                isGame: false,
                rating: 4.6,
                ratingsCount: '48',
                size: '2.4 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '第一版：招聘板、面试、在职、工作日期表、每日小剧场，全部按世界观生成。',
                description:
                    '人在一个世界里待久了，或许会想找一份属于那里的日常。\n\n'
                    + '灯塔不预设职位。招聘板会依照当前世界观生成公司与岗位；投递之后，HR 才在面试里出现。对话会留下评价，也可能以拒绝结束。\n\n'
                    + '入职之后，日结工作在当天的小剧场结束后结算，月结工作按发薪日补齐。收入进入与聊天红包、转账共用的钱包。\n\n'
                    + '这里的雇佣关系是世界观里的经历，账上的变动则会如实留下。',
                accent: '#3E5C86',
                tutorial: [
                    {
                        title: '第一次打开该做什么',
                        content: '灯塔读取你在 nook 里设定的世界观,生成符合那个世界风格的职位。建议先去 nook 创建或选择一个世界观,再回来灯塔逛招聘板。',
                    },
                    {
                        title: '怎么投递简历',
                        content: '在招聘板上点进感兴趣的职位,看到岗位描述和待遇后,点「投递简历」按钮。AI 会在那一刻生成 HR 并开始和你对话面试。',
                    },
                    {
                        title: '面试怎么进行',
                        content: '投递后,HR 会通过聊天界面和你对话。TA 会问问题、挑剔你的条件,也可能拒绝你。整个面试过程都在聊天里进行,结束后会生成面试评价。',
                    },
                    {
                        title: '怎么查看工资和流水',
                        content: '成功入职后,工资会在约定日期自动到账,记录在聊天 app 里的钱包流水中。日结工作则是演完当天就结算。月结在每月的发薪日统一发放。',
                    },
                    {
                        title: '可以在灯塔里同时做多份工作吗',
                        content: '可以。你可以同时接多份日结工作,但月结工作同一时间只能做一份。日结和月结的流水都会进入同一个钱包。',
                    },
                ],
                faqs: [
                    {
                        question: '灯塔里的工作是真实的工作吗？',
                        answer: '不是。灯塔里的职位、面试、工资都是 AI 根据你的世界观生成的虚构内容,用于增加角色扮演的沉浸感。钱包余额变动是真实的,但不涉及任何实际雇佣关系。',
                    },
                    {
                        question: 'HR 会拒绝我吗？',
                        answer: '会的。HR 是 AI 生成的角色,会根据你「简历」上的条件来判断是否录用。有时候条件不够、有时候只是运气不好。',
                    },
                    {
                        question: '工资是怎么算的？',
                        answer: '每个职位都有自己设定的薪资水平,在职位详情页可以看到。日结按次结算,月结按月结算。金额会直接进入你的聊天钱包余额。',
                    },
                    {
                        question: '没有设定世界观能看到职位吗？',
                        answer: '能看到,但内容会偏泛。有世界观的话,职位描述、公司背景、HR 性格都会贴合那个世界来生成。',
                    },
                ],
            },
        },

        // 演员 / 爱豆 / 电竞有自己的成长应用，不再通过普通求职流程入行。
        worldAvailability: {
            excludeModes: ['actor', 'idol', 'esports'],
            allowWithoutWorld: true,
        },

        // ── 外观 ────────────────────────────
        // 这三个是**首帧兜底值**，和默认主题「晨班」对齐，防止打开时闪一下。
        // 挂载后根组件会从 `_theme.css` 读实际值覆盖它们 —— 颜色的真相始终在 CSS。
        background: '#E8F4FC',
        statusBarColor: '#1E242C',
        homeIndicatorColor: 'rgba(30, 36, 44, 0.45)',

        // 顶栏和底栏都自己画：顶栏要放世界观名和余额，底栏要放角标
        topbar: { visible: false },
        nav: { type: 'none' },

        // 自绘底栏 + 内容铺到底边。不开的话底部 40px 永远是那张静态 background，
        // 换了主题这一条不跟着变，看着像贴了一条边
        fullscreen: true,

        pages: [{ id: 'home', label: '灯塔', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册，
        //   否则首次写盘时表还没建出来，表现是「保存成功但刷新就没了」
        stores: JOB_STORES,

        renderMode: 'vue',

        // ★ 没有 this —— framework 把它当独立函数调
        renderPage() {
            return createJobRoot();
        },

        /**
         * setup 在 **App 注册时**跑（页面一加载就跑，不管用户开不开这个 App）。
         *
         * 这里做的三件事都必须在这个时机：
         *   - 跨 App prompt：放 hydrate 的话，用户没点过这个 App，
         *     murmur 的折叠区里就看不到它
         *   - 上下文占位：先挂一个「还没就绪」的读取器，
         *     免得 murmur 那边 `window.__jobContext` 是 undefined
         *   - 后台预热：**工资必须在用户没打开这个 App 时也能补发**。
         *     否则表现是「我一个月没进去，工资就一个月没发」——
         *     而这个因果关系用户不会觉得合理。
         */
        setup({ toolkit, app } = {}) {
            registerJobPrompts(toolkit);
            installJobContext(null);

            // 不能在 setup 里直接 hydrate：注册流程是
            // `normalizeAppConfig(跑 setup) → 声明 stores → ensureSchema(建表)`，
            // setup 这一刻表还没建出来，读了必然拿不到东西。
            // 等 `phone:apps-registered` —— 那时候所有表都在了。
            if (typeof window !== 'undefined') {
                window.addEventListener('phone:apps-registered', () => {
                    store.hydrate(app).catch((err) => {
                        console.warn('[job] 后台预热失败，等用户打开 App 时再试', err);
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
             * 从别处跳进某一份工作。
             *
             * 先派发 openApp 再改 store：App 还没挂载时 store 改了也没人画，
             * 而 openApp 之后根组件的 mounted 会跑 hydrate，
             * hydrate 完再打开就一定有数据。
             */
            async openPostFromOutside(payload = {}) {
                const postId = payload?.postId;
                try {
                    window.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'openApp', appId: 'job', pageId: 'home', payload: {} },
                    }));
                } catch (_) { /* noop */ }
                if (!postId) return;
                await store.hydrate(this.app);
                const hit = store.getState().posts.find((p) => String(p.id) === String(postId));
                if (hit) store.openPost(hit.id);
                else store.showToast('这份工作已经辞掉了');
            },
        },

        services: {
            /**
             * 返回当前这一档的全部工作，不暴露档案键这个内部约定。
             */
            async listPosts() {
                const key = getProfileKey();
                if (!key) return [];
                const rows = await dbListPosts(this.app, key);
                return rows.map((p) => ({
                    id: p.id,
                    track: p.track || '',
                    title: p.title,
                    company: p.company,
                    duty: p.duty,
                    pay: { ...p.pay },
                    shift: { ...p.shift },
                    colleagueIds: [...(p.colleagueIds || [])],
                    rivalIds: [...(p.rivalIds || [])],
                    startDay: p.startDay,
                }));
            },

            /** 按 id 直接取一份工作，**不过滤档案键** */
            async getPost(payload = {}) {
                const id = payload.id || payload.postId;
                if (!id) return null;
                return dbGetPost(this.app, id);
            },

            /**
             * 某份工作的全部小剧场（只读摘要，不含全部台词）。
             * 要完整台词走 `getTheater`。
             */
            async listTheaters(payload = {}) {
                const key = getProfileKey();
                if (!key) return [];
                const rows = await dbListTheaters(this.app, key);
                const postId = payload.postId ? String(payload.postId) : '';
                return rows
                    .filter((t) => !postId || String(t.postId) === postId)
                    .map((t) => ({
                        id: t.id,
                        postId: t.postId,
                        day: t.day,
                        title: t.title,
                        digest: t.digest,
                        performance: { ...t.performance },
                        sceneCount: (t.scenes || []).length,
                    }));
            },

            /**
             * 按 id 取一整场。台词是结构化的
             * （`scenes[].lines[] = { speaker, text }`），拿到就能接着往下演，
             * 不需要再解析一遍谁说的。
             */
            async getTheater(payload = {}) {
                const id = payload.id || payload.theaterId;
                if (!id) return null;
                return dbGetTheater(this.app, id);
            },
        },
    };
}
