/**
 * 日记 —— 我和 TA 各写各的，也互相看得到
 *
 * ── 架构 ──────────────────────────────────────────────────────────
 *
 *   index.js          appConfig（框架对接都在这）
 *   constants.js      枚举 / 默认值（★ 不含任何颜色、不含 emoji）
 *   icons.js          线性图标
 *   utils.js          id / 日期 / 文本
 *   store.js          Vue.reactive 单例 + mutator + 分对象防抖落盘
 *   services/
 *     db.js             五张表 + 归一化
 *     nook-bridge.js    人设 / 世界观 / API 的唯一入口
 *     cycle-service.js  ★ 经期引擎（预测 / 阶段 / 紊乱 / 三态打卡）
 *     prompt-builder.js ★ 上下文组装（预览 == 发送）
 *     live-context.js   ★ 发送时现算的实时段落，暴露给 murmur
 *     app-prompts.js    往 murmur 注册静态行为 prompt
 *     ai-service.js     写日记 / AI 自己布置日记本
 *     extract-service.js 解析 [记纪念日:] / [记计划:]
 *   components/       根 / 向导 / 今日 / 归档 / 身体 / 日子 / 本子 / 设置抽屉
 *
 * ── 三条核心产品规则，各自实现在哪 ────────────────────────────────
 *
 *   1. **一天一篇日记，时段外都是便利贴**
 *      判定只有一处：`store.resolveWriteKind()`。存储层用
 *      `<spaceId>::<date>` 做主键，重复写入天然是覆盖。
 *
 *   2. **AI 的日记本必须由 AI 自己布置**
 *      `store.configureAiSpace()` 真的发一次 API 请求，返回 JSON
 *      （名字 / 主题 / 纸张 / 写作时段 / 口吻）。没布置过的本子在
 *      「本子」页是锁着的。
 *
 *   3. **生理期状态必须实时，且用户说没来就是没来**
 *      静态行为 prompt 注册到 murmur（`app-prompts.js`），
 *      具体日期由 `live-context.js` 在每次发消息前现算 ——
 *      快照会过期，AGENTS2 §4.1 一起听踩过同样的坑。
 */

import { createDiaryRoot } from './components/root.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { DIARY_STORES } from './services/db.js';
import { registerDiaryPrompts } from './services/app-prompts.js';
import { APP_ICON, icon } from './icons.js';
import * as store from './store.js';
import { MARKER_KIND, OWNER_KIND, makeSpaceId } from './constants.js';
import { todayKey, daysFromToday, compareDateKey, formatDateLabel, truncate } from './utils.js';

// 副作用 import：把 window.__diaryContext 挂上去。
// 必须在模块加载时就挂 —— murmur 发消息时会读它，而那时用户可能从没打开过日记 App。
import './services/live-context.js';

// ============================================================
// 小组件（产品要求：「小组件就是纪念日跟倒计时」）
// ============================================================

/**
 * 桌面小组件的数据源。
 *
 * ★ 优先读 store 里已 hydrate 的数据，读不到就回落 live-context 写的
 *   localStorage 快照 —— 桌面小组件在用户**从没打开过 App** 时也得能显示，
 *   而那时 store 还是空的、IndexedDB 也没读过。
 */
function readMarkers() {
    const state = store.getState();
    if (state.markers?.length) return state.markers;
    try {
        const raw = localStorage.getItem('xiaoting::diary-live-snapshot-v1');
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed?.markers) ? parsed.markers : [];
    } catch (_) {
        return [];
    }
}

/** 只看「我的」本子 —— 桌面上不该出现 AI 私人日记本里的日子 */
function myMarkers() {
    const uid = window.settingsSdk?.defaultUserCard?.getDefaultId?.()
        || window.settingsSdk?.users?.getActive?.()?.id;
    const sid = uid ? makeSpaceId(OWNER_KIND.USER, uid) : '';
    const all = readMarkers();
    return sid ? all.filter((m) => String(m.spaceId) === sid) : all;
}

function pickCountdowns() {
    const today = todayKey();
    return myMarkers()
        .filter((m) => m.kind === MARKER_KIND.COUNTDOWN && m.date && compareDateKey(m.date, today) >= 0)
        .map((m) => ({ m, d: daysFromToday(m.date) }))
        .filter((x) => x.d != null)
        .sort((a, b) => a.d - b.d);
}

function pickAnniversaries() {
    const today = todayKey();
    return myMarkers()
        .filter((m) => m.kind === MARKER_KIND.ANNIVERSARY && m.date && compareDateKey(m.date, today) <= 0)
        .map((m) => ({ m, d: -(daysFromToday(m.date) || 0) }))
        .sort((a, b) => (b.m.pinned ? 1 : 0) - (a.m.pinned ? 1 : 0) || a.d - b.d);
}

const OPEN_DIARY = () => ({ action: 'openApp', targetAppId: 'diary' });

/**
 * ★ 用 `LP.widgets.widget()` 而不是自己写 render。
 *   预设那一层已经处理好了三档尺寸降级和 escape ——
 *   自己写的话 S 尺寸下文字会被裁掉，而且 marker 标题是用户输入的，
 *   漏一次 escape 就是一个 XSS（AGENTS.md §5「widget 的安全约束」）。
 */
function buildWidgets() {
    const iconBg = '#E8E2D9';
    return [
        LP.widgets.widget('stat', {
            id: 'diary-countdown',
            label: '倒计时',
            icon: icon('clock'),
            iconBg,
            size: 'S',
            onTap: OPEN_DIARY,
            getPayload() {
                const rows = pickCountdowns();
                if (rows.length === 0) return { label: '要做的事', value: '—', unit: '', hint: '还没有在等的事' };
                const { m, d } = rows[0];
                return {
                    label: truncate(m.title, 8),
                    value: d === 0 ? '今天' : String(d),
                    unit: d === 0 ? '' : '天后',
                    hint: formatDateLabel(m.date),
                };
            },
        }),

        LP.widgets.widget('stat', {
            id: 'diary-anniversary',
            label: '纪念日',
            icon: icon('heart'),
            iconBg,
            size: 'S',
            onTap: OPEN_DIARY,
            getPayload() {
                const rows = pickAnniversaries();
                if (rows.length === 0) return { label: '纪念日', value: '—', unit: '', hint: '还没有记下什么日子' };
                const { m, d } = rows[0];
                return {
                    label: truncate(m.title, 8),
                    value: d === 0 ? '今天' : String(d),
                    unit: d === 0 ? '' : '天了',
                    hint: formatDateLabel(m.date, { withYear: true }),
                };
            },
        }),

        LP.widgets.widget('list', {
            id: 'diary-days',
            label: '日子',
            icon: icon('flag'),
            iconBg,
            size: 'M',
            onTap: OPEN_DIARY,
            getPayload() {
                // 先排将来的（更紧要），不够再拿纪念日补位
                const items = pickCountdowns().slice(0, 4).map(({ m, d }) => ({
                    title: truncate(m.title, 10),
                    sub: d === 0 ? '就是今天' : `还有 ${d} 天`,
                }));
                for (const { m, d } of pickAnniversaries()) {
                    if (items.length >= 4) break;
                    items.push({ title: truncate(m.title, 10), sub: d === 0 ? '就是今天' : `已经 ${d} 天` });
                }
                return { label: '日子', items };
            },
        }),
    ].filter(Boolean);
}

// ============================================================
// appConfig
// ============================================================

export default function createDiaryApp() {
    return {
        // ── 身份 ────────────────────────────
        id: 'diary',
        name: '日记',
        icon: APP_ICON,
        iconBg: '#E8E2D9',

        distribution: {
            // false = 系统级 app，注册完直接在桌面上。
            // 写 true 的话必须先去 App Store 装一次，调试期很容易误判成「没注册上」。
            requiresInstall: false,
            appStore: {
                subtitle: '一天一页，TA 也在写',
                category: '生活',
                isGame: false,
                rating: 4.9,
                ratingsCount: '124',
                size: '2.1 MB',
                age: '12+',
                version: '1.0.0',
                whatsNew: '首次发布：日记与便利贴、生理期推算、纪念日与倒计时、TA 自己布置的日记本。',
                description: `人为什么要把一天写下来？我也不知道。许多事发生时没有答案，过后却需要一个地方，证明它们确实来过。

这里一天留一篇日记。你定下写作的时段，其余时间落下的零碎话语便成为便利贴，不必为了郑重才被保存。

TA 也有自己的日记本，并会挑选它的样子；在权限允许时，你们可以翻到彼此写过的页。生理期、纪念日与倒计时也留在日期之间，和那些普通日子放在一起。`,
                accent: '#B9A99A',
                tutorial: [
                    {
                        title: '开始写第一篇日记',
                        content: '打开手记,默认进入今天的日记页。点击中间的编辑区域开始写。如果当前不在日记时段(你设定的可写时间段),写下的内容会自动归为便利贴。',
                    },
                    {
                        title: '怎么设定日记时段',
                        content: '点右上角的设置按钮,可以设定「日记时段」。比如设为晚上 9 点到 10 点,在这个时间段写的内容会被标记为正式的日记,其他时间写的就是便利贴。',
                    },
                    {
                        title: '便利贴和日记有什么区别',
                        content: '日记是正式的长文记录,一天只能写一篇;便利贴是碎片化的短记录,随时可以写,不限数量。两者都会出现在日期轴里,但视觉上会有区分。',
                    },
                    {
                        title: '怎么添加纪念日和倒计时',
                        content: '点右下角的「+」按钮,可以添加纪念日或倒计时。填入日期和名称后,桌面小组件里就能看到距离那天还有多少天。',
                    },
                    {
                        title: '怎么查看 TA 写的日记',
                        content: '手记会自动显示 TA 在你们聊天里写的日记内容(如果 TA 开了这个权限)。在日期轴里,TA 的日记会以另一种颜色显示。',
                    },
                ],
                faqs: [
                    {
                        question: '日记时段是必须设定的吗？',
                        answer: '不是必须的。设了之后,非日记时段写的内容会自动归为便利贴;不设的话,所有内容都是日记。',
                    },
                    {
                        question: '一天只能写一篇日记是什么意思？',
                        answer: '在日记时段内,每天只有第一篇会被标记为正式日记。之后再写的内容会自动转为便利贴,不会覆盖原来的日记。',
                    },
                    {
                        question: 'TA 能看到我写的日记吗？',
                        answer: '取决于 TA 的人设设置。如果 TA 开启了「允许翻看日记」的权限,TA 可以在自己的手记里看到你写的日记内容。',
                    },
                    {
                        question: '纪念日可以设置提醒吗？',
                        answer: '可以。在添加纪念日时可以打开提醒开关,纪念日当天会有通知。提醒方式和系统设置相关。',
                    },
                ],
            },
        },

        // ── 外观 ────────────────────────────
        // ★ 这三个是**首帧兜底值**，和默认主题（燕麦）对齐，防止打开时闪一下。
        //   挂载后根组件会从 `_theme.css` 读出当前日记本主题的实际值覆盖它们
        //   （见 `components/root.js` 的 `syncChrome`）—— 颜色的真相始终在 CSS。
        background: '#F4F1EB',
        statusBarColor: '#3D372F',
        homeIndicatorColor: 'rgba(61, 55, 47, 0.3)',

        // 顶栏和 tab 栏都自己画：顶栏要显示日记本名字和写作时段，
        // tab 栏有五项且要跟着主题换色，框架那套都做不到
        topbar: { visible: false },
        nav: { type: 'none' },

        pages: [{ id: 'home', label: '日记', nav: true }],
        defaultRootPageId: 'home',

        // ★ 声明了 stores 就必须在 js/apps/index.js 里 async 注册，
        //   否则首次写盘时表还没建出来，表现是「保存成功但刷新就没了」
        stores: DIARY_STORES,

        renderMode: 'vue',

        /** ★ 没有 this —— framework 把它当独立函数调 */
        renderPage() {
            return createDiaryRoot();
        },

        /**
         * setup 在 **App 注册时**跑（页面一加载就跑，不管用户开不开这个 App）。
         * 跨 App prompt 必须在这里注册 —— 放 hydrate 里的话，
         * 用户没点过这个 App，murmur 的折叠区里就看不到它。
         */
        setup({ toolkit } = {}) {
            registerDiaryPrompts(toolkit);
            return {};
        },

        // ── 小组件 ──────────────────────────
        widgets: buildWidgets(),

        methods: {
            /** 供外部预热 / 深链调用；正常路径由根组件 mounted 自己拉 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },

        services: {
            /**
             * 给别的 App 用：往当前用户的日记本里记一件事。
             * murmur 的 `[记纪念日:...]` / `[记计划:...]` 可以落到这里。
             */
            async addMarker(payload = {}) {
                await store.hydrate(this.app);
                const space = store.ensureUserSpace();
                if (!space) return { ok: false, error: '还没有默认用户人设' };
                const marker = store.addMarker({ ...payload, spaceId: space.id, source: 'ai' });
                await store.flushPersist();
                return { ok: Boolean(marker), id: marker?.id };
            },

            /** 给别的 App 用：今天的生理期状态（只读摘要，不含日记正文） */
            async cycleToday() {
                await store.hydrate(this.app);
                const space = store.getUserSpace();
                if (!space?.cycle?.enabled) return { enabled: false };
                return store.getCycleInfo(space.id);
            },
        },
    };
}
