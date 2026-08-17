/**
 * relax-app / 赛博解压
 *
 * 一个「舞台系统」:用户自己搭背景 + 盘子 + 装饰 + 音声,
 * 然后把「解压主体」(气泡纸捏捏 / 巧克力脆皮 …)放到盘子上捏。
 *
 * ============================================================
 * 目录导航
 * ============================================================
 *   registry.js              ★ 解压主体的插件契约(要加新主体先读这个)
 *   toys/index.js            ★ 主体清单(加主体只改这里一行)
 *   store.js                 状态中心(Vue.reactive 单例 + 防抖落盘)
 *   palette.js               糖果色板 + 颜色工具
 *   assets/backgrounds.js    内置背景(程序化生成,可染色)
 *   assets/plates.js         内置盘子(不规则形状,可染色)
 *   assets/decorations.js    内置装饰(inline SVG,currentColor 染色)
 *   services/scene-store.js  IndexedDB 读写
 *   services/sound-service.js 音声(Web Audio 合成 + 自定义上传)
 *   components/              UI
 *   css/apps/relax/          样式
 *
 * ============================================================
 * framework 对接要点
 * ============================================================
 *   renderMode: 'vue'   → renderPage 返回 Vue 组件配置
 *   nav: { type:'none' }→ 关掉框架自带 tab 栏,自己用液态 tab 栏
 *   topbar.visible:false→ 关掉框架顶栏,舞台要全屏沉浸
 *   stores: [...]       → 必须用 registerPhoneAppAsync 注册(见 js/apps/index.js),
 *                         同步注册的话 IndexedDB 还没建表,首次写入会静默失败
 *
 * ★ vue 模式没有自动 hydrate(AGENTS.md §47):
 *   store.hydrate() 由根组件 mounted() 里的 microtask 启动,不是框架调的。
 *   methods.hydrate 只是留给外部(比如以后想在桌面小组件里预热)的入口。
 */

import { createRelaxRoot } from './components/relax-root.js';
import * as store from './store.js';
import { STORE_IMAGES, STORE_SCENES, STORE_SOUNDS, STORE_PLATES, STORE_DECORATIONS } from './services/scene-store.js';

// 副作用 import:让内置主体去 registry 报到
import './toys/index.js';

const RELAX_ICON = `<svg viewBox="0 0 60 60" style="width:130%;height:130%;"><defs><linearGradient id="widget-bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A8E6CF"/><stop offset="100%" stop-color="#56CCF2"/></linearGradient></defs><rect width="60" height="60" rx="15" fill="url(#widget-bg)"/><rect x="10" y="10" width="18" height="18" rx="5" fill="#FFF" opacity="0.95"/><circle cx="19" cy="19" r="5" fill="#56CCF2" opacity="0.5"/><rect x="32" y="10" width="18" height="18" rx="5" fill="#FFF" opacity="0.95"/><path d="M37 15 L43 21 M43 15 L37 21" stroke="#A8E6CF" stroke-width="2" stroke-linecap="round" opacity="0.8"/><rect x="10" y="32" width="18" height="18" rx="5" fill="#FFF" opacity="0.95"/><rect x="15" y="37" width="8" height="2" rx="1" fill="#56CCF2" opacity="0.7"/><rect x="15" y="41" width="6" height="2" rx="1" fill="#A8E6CF" opacity="0.7"/><rect x="15" y="45" width="7" height="2" rx="1" fill="#56CCF2" opacity="0.7"/><rect x="32" y="32" width="18" height="18" rx="5" fill="#FFF" opacity="0.95"/><path d="M36 43 L40 47 L48 39" stroke="#A8E6CF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/></svg>`;

export default function createRelaxApp() {
    return {
        id: 'relax',
        name: '解压角',
        icon: RELAX_ICON,
        iconBg: 'linear-gradient(135deg, #ffc8dd, #cdb4db)',

        distribution: {
            // ★ false = 系统级 app,注册完直接在桌面上(见 src/core/app-installation.js)。
            //   写 true 的话必须先去 App Store 装一次才会出现,调试期很容易以为「app 没注册上」。
            //   appStore 元数据照样保留 —— 商店页仍然能看到这个 app。
            requiresInstall: false,
            appStore: {
                subtitle: '捏一捏,松一松',
                category: '生活',
                isGame: false,
                rating: 4.9,
                ratingsCount: '312',
                size: '5.2 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '首次发布:自定义背景 / 盘子 / 装饰 / 音声的解压舞台。',
                description:
                    '手上想有点动作的时候，不一定需要一个理由。\n\n'
                    + '解压角留着一方可以慢慢摆弄的小舞台。背景、盘子和装饰由你安排，再放上果冻、史莱姆或水球，想捏多久都行。\n\n'
                    + '舞台会记住上次的布置。触感音效也可以换成一段最长 15 秒的现场录音；录音只陪这一回，不会被保存。',
                accent: 'linear-gradient(145deg, #ffc8dd 0%, #cdb4db 100%)',
                tutorial: [
                    {
                        title: '布置你的解压舞台',
                        content: '打开解压角,底部有三个按钮:背景、盘子、装饰。点进去可以分别选择背景图、盘子样式和小装饰品。选好后它们会自动出现在舞台中央。',
                    },
                    {
                        title: '解压主体是什么',
                        content: '解压主体就是舞台中央那块可以捏的东西。有果冻、史莱姆、水球几种。点「换主体」可以切换,不同的主体捏起来的触感不一样。',
                    },
                    {
                        title: '怎么录自己的声音',
                        content: '点底部的话筒按钮,可以录一段最长达 15 秒的声音。录好后,捏解压主体时会播放这段声音作为触感音效。没有录音时会播放默认音效。',
                    },
                    {
                        title: '舞台会保存吗',
                        content: '会的。你布置的舞台(背景、盘子、装饰、解压主体)会自动保存,下次进来还是上次的样子。声音录音不会保存,每次进来需要重新录。',
                    },
                ],
                faqs: [
                    {
                        question: '解压角可以设置定时吗？',
                        answer: '目前没有内置定时功能。需要的时候点开桌面图标即可使用。',
                    },
                    {
                        question: '录音最长可以多长？',
                        answer: '单次录音最长 15 秒。',
                    },
                    {
                        question: '不同解压主体的手感有什么不同？',
                        answer: '果冻偏软弹,史莱姆偏黏稠,水球偏脆。实际效果和你捏的力度有关,自己体验一下最准。',
                    },
                    {
                        question: '装饰品可以自定义吗？',
                        answer: '目前装饰品列表是预设的,不支持自定义添加。',
                    },
                ],
            },
        },

        background: 'linear-gradient(180deg, #fff5f8 0%, #fffaf6 100%)',
        statusBarColor: '#6b5560',
        homeIndicatorColor: 'rgba(107, 85, 96, 0.3)',

        // 舞台要全屏沉浸:框架顶栏和框架 tab 栏都关掉,UI 全由 app 自己画
        topbar: { visible: false },
        nav: { type: 'none' },

        // ★ 关掉顶栏和 tab 栏还不够:框架的 `.app-bottom`(home 指示条那一条)
        //   仍然是 flex 布局里的一员,会占掉底部 40px。它自己 transparent,
        //   透出来的是 `.app-background-layer` —— 也就是下面那行静态 background。
        //   结果就是「舞台背景换了,底部那 40px 不跟着换」。
        //   fullscreen: true 让框架把 `.app-bottom` 改成绝对定位浮层,
        //   舞台从此真的铺满整屏;底部 UI 用 var(--app-safe-bottom) 让位。
        //   详见 css/core/50-app-shell.css 的 .app-shell.app-fullscreen 段。
        fullscreen: true,

        // ★ v0.87 声明会占用灵动岛的时机。
        //   舞台浮动条上那颗胶囊图标进「灵动岛与小组件」总览页,用户能在那里关掉。
        //   见 docs/framework-灵动岛与小组件总览.md
        islandKinds: [
            {
                id: 'relax-toast',
                label: '操作反馈',
                desc: '存档、上传音频、重置舞台之类的短提示,3.5 秒后自动消失。',
                when: '保存/读取存档、上传自定义音或图片、操作失败时',
                sizes: ['compact'],
                previewPayload: { title: '已存好这一套', message: '深夜气泡 · 3 个装饰' },
            },
        ],

        pages: [{ id: 'stage', label: '舞台', nav: true }],
        defaultRootPageId: 'stage',

        stores: [
            { name: STORE_SCENES, keyPath: 'id' },
            { name: STORE_SOUNDS, keyPath: 'id' },
            { name: STORE_IMAGES, keyPath: 'id' },
            { name: STORE_PLATES, keyPath: 'id' },
            { name: STORE_DECORATIONS, keyPath: 'id' },
        ],

        renderMode: 'vue',

        // ★ renderPage 是被当独立函数调的,里面没有 this(AGENTS.md §2.3)
        renderPage() {
            return createRelaxRoot();
        },

        methods: {
            /**
             * 正常路径下由根组件 mounted() 自己调,不需要外部触发。
             * 留这个入口是为了以后做桌面小组件 / 预热时能主动拉一次数据。
             */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },
    };
}
