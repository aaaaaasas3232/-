/**
 * 小奇怪 · oddity
 *
 * ============================================================
 * 它是什么
 * ============================================================
 * 一只装旧玩意儿的箱子。作者早年写过一堆单文件 HTML 原型,
 * 同一个点子往往有好几版。这个 App 把其中**最成熟的那一版**挑出来,
 * 按项目规范重写,归到四个 tab 下:
 *
 *   玩   扫雷(真实玩法,可拉 AI) / 五子棋(QAQ 555,可拉 AI) /
 *        你有我没有(QAQ 小游戏你又我)
 *   捏   果冻心(QAQ 心,胜过更早的 信封) / 手风琴(QAQ 手风琴页)
 *   看   沙漏(QAQ 沙漏) / 开屏艺术字(QAQ 开屏)
 *   字   字幕生成器(新写)
 *
 * ★ 「玩」里的三样都能把战绩分享进 murmur(复用 game_record 卡,
 *   见 services/chat-bridge.js),都吃「提示词库」里的自定义提示词,
 *   战绩概要会以动态提示词卡的形式喂给 murmur(services/app-prompts.js)。
 *
 * ★ 没有搬进来的原型,以及为什么:
 *   解压4/5/7      → 解压角已经有 choco-board / bubble-board 了
 *   番茄圆 / 发票计时器 / 计时器加油 → 专注 App 的地盘
 *   游戏-无api      → 那份就是「湛蓝回忆」,已经是独立 App
 *   五子棋小游戏    → murmur 群聊小游戏已覆盖(独立 App 版就是本 App 的五子棋)
 *   红包2 / 语音    → murmur 本来就有红包和语音条
 *   镜头(OCR)      → 依赖 Tesseract CDN,单文件离线包会挂
 *
 * ============================================================
 * framework 对接要点
 * ============================================================
 *   renderMode: 'vue'    → renderPage 返回 Vue 组件配置
 *   topbar.visible:false → 关掉框架顶栏,自己画
 *   nav: { type:'none' } → 关掉框架 tab 栏,自己画(components/tab-bar.js)
 *   fullscreen: true     → `.app-bottom` 改成绝对定位浮层,内容能铺满整屏
 *   stores: [...]        → 声明了表,**必须** registerPhoneAppAsync 注册
 *                          (见 js/apps/index.js;同步注册会在首次写盘时静默失败)
 *
 * ★ vue 模式没有自动 hydrate:store.hydrate() 由根组件 mounted() 自己踢。
 *   下面 methods.hydrate 只是留给外部预热用的入口。
 */

import { createOddityRoot } from './components/root.js';
import * as store from './store.js';
import { OQ_STORES } from './constants.js';
import { ODDITY_APP_ICON, islandIcon } from './icons.js';
import { registerOddityPrompts } from './services/app-prompts.js';

export default function createOddityApp() {
    return {
        id: 'oddity',
        name: '小奇怪',
        icon: ODDITY_APP_ICON,
        iconBg: 'linear-gradient(135deg, #c9bcae, #9aa8b5)',

        distribution: {
            // false = 系统级 App,注册完直接在桌面上。写 true 要先去 App Store 装一次,
            // 调试期很容易误判成「App 没注册上」。
            requiresInstall: false,
            appStore: {
                subtitle: '一箱子不太正经的小玩意儿',
                category: '游戏',
                isGame: true,
                rating: 4.8,
                ratingsCount: '96',
                size: '3.6 MB',
                age: '4+',
                version: '1.1.0',
                whatsNew: '果冻心全面升级为粉红AI之心，新增小巧SVG工具组与心跳连线；沙漏全新升级为手机颠倒黑白反转与双面心语（表面话与潜意识深处真言）；新增打字机“欲言又止”草稿动效与踌躇记忆；全新统一前三页收藏夹系统。',
                description:
                    '不是每样东西都要派上用场。有些旧点子留到今天，只是还值得再按一下。\n\n'
                    + '小奇怪把它们收在「玩、捏、看、藏」四个抽屉里：扫雷、五子棋与「你有我没有」，粉红果冻心与AI心跳连线，颠倒沙漏的双面心语，还有一台把欲言又止与删除草稿如实演出的打字机，以及收纳所有动人瞬间的收藏夹。\n\n'
                    + '扫雷和五子棋可以从 nook 请一位 AI 人设同桌，对方会落子，也会说话；果冻心与沙漏能随时倾听心灵深处的心跳真言；打字机记录下那些在输入框里写下又删除的犹豫。结束的战绩与心语可以送进 murmur 或存入心事夹。\n\n'
                    + '当前棋局与草稿会自己存下。那只箱子不催人打开，也不解释为什么还在。',
                accent: 'linear-gradient(145deg, #c9bcae 0%, #9aa8b5 100%)',
                tutorial: [
                    {
                        title: '扫雷怎么玩',
                        content: '底栏第一个「玩」里。9×9 的盘藏着十颗心,点格子就是扫,长按格子插旗做记号。两个人轮流,没碰到心 +1 分,碰到心 -5 分,第一下永远安全。开局时可以选对手:拉 nook 里的 AI 人设,或者本地两个真人。',
                    },
                    {
                        title: '五子棋怎么玩',
                        content: '「玩」里第二个。15 路棋盘,你执黑先手,横竖斜先连成五子的赢。拉 AI 玩时它会边下边说话;没配 API 也能玩,本地棋手会替 AI 落子。',
                    },
                    {
                        title: '战绩怎么分享到 murmur',
                        content: '任何一局打完,结算卡上都有「分享到 murmur」。选一个人发过去,聊天里会出现一张战绩卡,点开能看完整名单。和 AI 打的那局,默认就发给那位 AI。',
                    },
                    {
                        title: '粉红果冻心怎么互动',
                        content: '在「捏」标签页。轻戳一下会疼、慢慢抚摸会暖；底部配备小巧精致的SVG工具组，可随时倾听AI心声、投喂心意、切换人设，支持一键收藏触动瞬间。',
                    },
                    {
                        title: '沙漏双面心语怎么玩',
                        content: '在「看」标签页。手机正向是白昼里克制平静的表面话；手机颠倒过来，黑色流体倾泻吞没屏幕，文字倒转露出潜意识深处的真实执念。',
                    },
                    {
                        title: '打字机是做什么的',
                        content: '在「看」标签页第二个。重现AI在输入框里写下又删除的真实心迹与犹豫踌躇；带下划线光标与退格擦除动效，支持反复播放、自建草稿与一键收藏。',
                    },
                    {
                        title: '心事收藏夹在哪里',
                        content: '底栏第四个「藏」标签页。聚合前三个页面的所有收藏，支持多分类筛选、一键复制与动效回放。',
                    },
                ],
                faqs: [
                    {
                        question: '扫雷的雷有几颗？',
                        answer: '固定 10 颗。每次重开地图都会重新生成,不会重复。第一下如果踩中雷,那颗雷会被悄悄挪走 —— 和经典扫雷一样。',
                    },
                    {
                        question: 'AI 对手是怎么下棋的？',
                        answer: '配了 API 时,它把盘面发给模型要一个坐标和一句台词;模型没回、回得不合法、或者根本没配 Key 时,由内置的本地棋手接手 —— 局永远不会卡死。',
                    },
                    {
                        question: '一局没打完切走了会丢吗？',
                        answer: '不会。当前这一局会自动存着,回来还是原样。',
                    },
                    {
                        question: '字幕里为什么有的字母没变成上标？',
                        answer: 'Unicode 没有小写 q 的上标形式。遇到这种字符它会保留原样,并在下面告诉你是哪几个。',
                    },
                ],
            },
        },

        background: 'linear-gradient(180deg, #f2efea 0%, #e9e5df 100%)',
        statusBarColor: '#5b5450',
        homeIndicatorColor: 'rgba(91, 84, 80, 0.3)',

        // UI 全部自己画
        topbar: { visible: false },
        nav: { type: 'none' },

        // ★ 关掉顶栏和 tab 栏还不够:`.app-bottom` 仍然占着底部 40px,
        //   透出来的是静态 background,换主题时那一条不跟着变。
        //   fullscreen 让框架把它改成绝对定位浮层,内容真正铺满。
        fullscreen: true,

        // ★ 声明会占用灵动岛的时机,用户能在「灵动岛与小组件」里关掉。
        //   compact 是短提示尺寸;运行时一律走 notify(),不要 show('compact')。
        islandKinds: [
            {
                id: 'oq-toast',
                label: '小奇怪提示',
                desc: '开新局、扫到心、存下一块字幕之类的短提示,几秒后自动消失。',
                when: '重开一局、踩到心、收藏字幕、本地模式接管时',
                sizes: ['compact'],
                icon: islandIcon('dot'),
                previewPayload: { title: '玩家二踩到了心', message: '-5 分 · 目前 3 分' },
            },
        ],
        notifyKinds: [
            {
                id: 'oq-match',
                label: '一起玩 · 开局与结果',
                type: 'success',
                title: '这一局结束了',
                message: '玩家一 6 分,玩家二 1 分',
                when: '和 AI 开一局(扫雷 / 五子棋)、任何一局分出结果时',
            },
            {
                id: 'oq-sweep',
                label: '扫雷踩心提示',
                type: 'warning',
                title: '有人踩到雷',
                message: '(4,7) −5 分 · 当前 3 : 1',
                when: '扫雷里有人踩中雷时',
            },
        ],

        pages: [{ id: 'home', label: '小奇怪', nav: true }],
        defaultRootPageId: 'home',

        stores: OQ_STORES,

        renderMode: 'vue',

        /**
         * ★ 必须放 setup 不能放 hydrate ——
         *   用户可能先开 murmur 再开这个 App,写在 hydrate 里的话
         *   murmur 的提示词列表里压根不会出现小奇怪,而且零报错。
         */
        setup({ toolkit } = {}) {
            registerOddityPrompts(toolkit);
            // 调试 / 探针入口。只读同一个 reactive 单例,不是第二份状态。
            if (typeof window !== 'undefined') window.__oqStore = store;
            return {};
        },

        // ★ renderPage 是被当独立函数调的,里面没有 this(AGENTS.md §2.2)
        renderPage() {
            return createOddityRoot();
        },

        methods: {
            /** 正常路径由根组件 mounted() 自己调;留这个口子是给外部预热用 */
            async hydrate() {
                await store.hydrate(this.app);
            },
        },
    };
}
