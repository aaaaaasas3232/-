/**
 * App 制作
 *
 * 用问卷把「我想要个什么样的 App」问清楚，然后同时产出两样东西：
 *
 *   1. **一个能装到桌面上的白膜 App** —— 结构完整、内容占位，
 *      页面、顶栏、底栏、弹窗、灵动岛、小组件都是真的，可以点。
 *      相当于 3D 建模里的人模：比例和关节先对上，再谈材质。
 *   2. **一份按配置现算的提示词** —— 拿去给 AI，把白膜填成真 App。
 *
 * 这两样出自同一份 blueprint，所以不会出现「提示词里写了、白膜里没有」。
 *
 * ── 为什么是 vue 模式 ─────────────────────────────────────────────
 * 这个 App 满屏都是输入框和实时预览。template 模式下 state 一变整块 DOM
 * 就重建，输入框每敲一个字光标就跳走 —— 上一版正是这个问题，为此写了
 * 一整套「输入时不碰 state、blur 才回写」的绕行代码。vue 模式下这些全不需要。
 *
 * ── 目录 ──────────────────────────────────────────────────────────
 *   constants.js        所有选项表（问卷 / 代码生成 / 提示词三处共用）
 *   store.js            Vue.reactive 单例 + 防抖落盘
 *   glossary.js         科普词典（12 类）
 *   survey/blueprint.js 答案 → 蓝图（补全 + 体检）
 *   survey/codegen.js   蓝图 → 白膜源码
 *   survey/prompt.js    蓝图 → 提示词
 *   services/ai.js      需求翻译（调用户人设绑定的 API）
 *   components/         UI
 */

import { createAppMakerRoot } from './components/root.js';
import * as store from './store.js';
import { buildBlueprint, reviewBlueprint } from './survey/blueprint.js';
import { generateAppCode } from './survey/codegen.js';
import { buildPrompt } from './survey/prompt.js';

/**
 * 探针入口。
 *
 * `tests/e2e/__probe-app-maker.mjs` 要在真实浏览器里跑完整条链路
 * （填问卷 → 生成 → 装到桌面 → 打开 → 刷新后还在）。
 * 那条链路的中间产物（blueprint、生成的代码）在 DOM 上是看不见的，
 * 只能从这里取。
 *
 * 顺便也是给「想自己拿蓝图做点别的」留的口子 —— 比如在控制台里
 * `__amGenerateCode(__amBuildBlueprint(__amStore.getState().answers))`。
 */
if (typeof window !== 'undefined') {
    window.__amStore = store;
    window.__amBuildBlueprint = buildBlueprint;
    window.__amReviewBlueprint = reviewBlueprint;
    window.__amGenerateCode = generateAppCode;
    window.__amBuildPrompt = buildPrompt;
}

const APP_ICON = `
<svg viewBox="0 0 60 60" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="7" width="42" height="46" rx="12" fill="rgba(255,255,255,0.2)" />
    <rect x="16" y="15" width="28" height="4" rx="2" fill="#ffffff" fill-opacity="0.95" />
    <rect x="16" y="24" width="20" height="3.4" rx="1.7" fill="#ffffff" fill-opacity="0.72" />
    <rect x="16" y="31.5" width="24" height="3.4" rx="1.7" fill="#ffffff" fill-opacity="0.6" />
    <rect x="16" y="39" width="14" height="3.4" rx="1.7" fill="#ffffff" fill-opacity="0.48" />
    <circle cx="42" cy="41" r="9" fill="#ffffff" fill-opacity="0.95" />
    <path d="M38.4 41.2 L41 43.8 L46 37.8" stroke="#6d28d9" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

export default function createAppMakerApp() {
    return {
        id: 'app-maker',
        name: 'App 制作',
        icon: APP_ICON,
        iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #38bdf8 100%)',

        background: 'linear-gradient(180deg, #f5f3ff 0%, #f8fafc 55%, #ffffff 100%)',
        statusBarColor: '#312e81',
        homeIndicatorColor: 'rgba(99, 102, 241, 0.3)',

        distribution: {
            requiresInstall: false,
            installed: true,
            appStore: {
                subtitle: '先把想法问清楚',
                category: '工具',
                description:
                    '想做一个 App 的时候，模糊的往往不是代码，而是那个念头究竟要长成什么样。\n\n'
                    + 'App 制作用一份问卷把页面、导航、数据、弹窗、灵动岛、小组件与跨 App 能力逐项问清。答案会汇成同一份蓝图，再经过配置体检。\n\n'
                    + '蓝图同时产出一份可以装到桌面的白膜 App，和一份按当前配置生成的提示词。白膜里的页面与交互可以先点起来，提示词则留给 AI 继续填入真正的内容。\n\n'
                    + '两份结果来自同一处。想法停在哪一步，仍然可以回来接着写。',
                accent: 'linear-gradient(145deg, #8B5CF6 0%, #38BDF8 100%)',
            },
        },

        dock: { visible: true, order: 3 },

        // 顶栏和底栏都自己画：
        //   - 底部 tab 要显示「问卷填到第几步」，框架的 tab 只支持数字角标
        //   - 顶栏在问卷页要放进度条，在结果页要放两个切换，形态差太多
        topbar: { visible: false },
        nav: { type: 'none' },

        // ★ 自绘 tab 栏 + 长内容滚动，需要内容铺到 shell 底边。
        //   不开 fullscreen 的话底部 40px 永远是那张静态 background，
        //   自绘的 tab 栏会浮在它上面，看着像贴了一条边。
        fullscreen: true,

        islandKinds: [
            {
                id: 'app-maker-generated',
                label: '生成完成',
                desc: '问卷做完、白膜和提示词都算好了的时候弹一下。',
                when: '点「生成」之后',
                sizes: ['compact'],
                previewPayload: { title: '生成好了', message: '心情日记 · 3 页' },
            },
            {
                id: 'app-maker-installed',
                label: '装好了',
                desc: '白膜装到桌面之后的确认提示。',
                when: '点「装到桌面」并成功之后',
                sizes: ['compact'],
                previewPayload: { title: '已装到桌面', message: '退出就能看到它' },
            },
        ],

        pages: [{ id: 'home', label: '制作', nav: true }],
        defaultRootPageId: 'home',

        renderMode: 'vue',

        // ★ 没有 this —— 框架把它当独立函数调
        renderPage() {
            return createAppMakerRoot();
        },

        setup() {
            return {};
        },

        methods: {
            /**
             * vue 模式框架不会自动调这个，根组件 mounted 里会调 store.hydrate()。
             * 留一个入口是为了将来别处（比如桌面小组件预热）能主动触发。
             * hydrate 内部自带幂等，重复调没有副作用。
             */
            hydrate() {
                store.hydrate();
            },
        },
    };
}
