// ============================================
// 模板 App（基础示范，所有 app 都参考这个结构）
// 从 apps.js 第 969-1213 行提取
// ============================================

import { APP_ICONS } from '../core/icons.js';

// widget render 函数接收 (size, payload)，返回 html。
// size 由框架传入: 'S' | 'M' | 'L'(对应桌面上的 small / medium / large 三种 size)
// 各 widget 自行决定在每种 size 下显示什么内容。
function renderGreetingWidget(size = 'S', payload = {}) {
    const hour = new Date().getHours();
    let greeting = '你好';
    if (hour < 6) greeting = '夜深了';
    else if (hour < 12) greeting = '早上好';
    else if (hour < 18) greeting = '下午好';
    else greeting = '晚上好';

    if (size === 'S') {
        return `
            <span class="widget-mini-greeting-text">${greeting}</span>
            <span class="widget-mini-greeting-dot"></span>
        `;
    }
    if (size === 'M') {
        return `
            <div style="font-size:18px;font-weight:800;line-height:1.2">${greeting}</div>
            <div style="font-size:11px;opacity:0.7;line-height:1.4">M · 2×2 小组件</div>
        `;
    }
    if (size === 'L') {
        return `
            <div style="font-size:24px;font-weight:800;line-height:1.1">${greeting}</div>
            <div style="font-size:13px;opacity:0.8;line-height:1.4;margin-top:6px">L · 2×4 小组件</div>
            <div style="margin-top:auto;font-size:11px;opacity:0.55">按时段自动更新</div>
        `;
    }
    return `<span class="widget-mini-greeting-text">${greeting}</span>`;
}

function renderClockWidget(size = 'S', payload = {}) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    if (size === 'S') {
        return `<span class="widget-mini-clock-text">${hh}:${mm}</span>`;
    }
    if (size === 'M') {
        return `<div style="font-size:28px;font-weight:800;letter-spacing:0.02em">${hh}:${mm}</div>`;
    }
    if (size === 'L') {
        return `<div style="font-size:46px;font-weight:800;letter-spacing:0.02em">${hh}:${mm}</div>`;
    }
    return `<span>${hh}:${mm}</span>`;
}

function renderTipWidget(size = 'S', payload = {}) {
    if (size === 'S') {
        return `<span class="widget-mini-tip-text">提示</span>`;
    }
    if (size === 'M') {
        return `<div style="font-size:14px;font-weight:700">小提示</div><div style="font-size:11px;opacity:0.7;margin-top:4px">M 尺寸示例</div>`;
    }
    if (size === 'L') {
        return `<div style="font-size:18px;font-weight:800">小组件大提示</div><div style="font-size:12px;opacity:0.7;margin-top:6px;line-height:1.5">L 尺寸示例，可放多行文字说明。</div>`;
    }
    return `<span>提示</span>`;
}

function renderNoteWidget(size = 'S', payload = {}) {
    // S 竖 (1x2): 图标在上、label 在下；纵向紧凑布局
    if (size === 'S') {
        return `<div style="font-size:14px;font-weight:800;text-align:center">笔记</div><div style="font-size:10px;opacity:0.65;margin-top:auto;text-align:center">速记</div>`;
    }
    if (size === 'M') {
        return `<div style="font-size:18px;font-weight:800">笔记</div><div style="font-size:11px;opacity:0.7;margin-top:6px">M 尺寸 · 纵 1×2</div>`;
    }
    if (size === 'L') {
        return `<div style="font-size:24px;font-weight:800">笔记</div><div style="font-size:13px;opacity:0.8;margin-top:8px">L 尺寸 · 大屏纵排示例</div>`;
    }
    return `<span>笔记</span>`;
}

function renderAgendaWidget(size = 'S', payload = {}) {
    // M (2x2)
    if (size === 'S') {
        return `<span style="font-weight:700">日程</span>`;
    }
    if (size === 'M') {
        return `
            <div style="font-size:14px;font-weight:800">今日日程</div>
            <div style="font-size:11px;opacity:0.75;margin-top:6px;line-height:1.5">
                <div>· 09:30 早会</div>
                <div>· 14:00 设计评审</div>
                <div>· 18:30 晚餐</div>
            </div>
            <div style="margin-top:auto;font-size:10px;opacity:0.55">3 项待办</div>
        `;
    }
    if (size === 'L') {
        return `
            <div style="font-size:18px;font-weight:800">本周日程</div>
            <div style="font-size:11px;opacity:0.75;margin-top:8px;line-height:1.6">
                <div>· 周一 产品评审</div>
                <div>· 周三 客户拜访</div>
                <div>· 周五 月度复盘</div>
                <div>· 周末 团建</div>
            </div>
            <div style="margin-top:auto;font-size:10px;opacity:0.55">L 尺寸示例</div>
        `;
    }
    return `<span>日程</span>`;
}

export const APP_PAGE_CONTENT = {
    template: {
        home: {
            blocks: [
                {
                    template: 'hero',
                    payload: {
                        badge: 'BASE TEMPLATE',
                        title: '最基础 App 模板',
                        description: '后续你只需要单独写一个 app js 文件，调用 registerPhoneApp(...)，系统就会自动注册图标、页面、数据库声明、Dock 配置和灵动岛能力。',
                        meta: ['自动导航', '自动数据库声明', '灵动岛助手', '可拆分外部 app 文件'],
                        actions: [
                            { label: '查看模板结构', action: 'detail', appId: 'template', pageId: 'template-detail' },
                            { label: '演示灵动岛提示', action: 'modal', modalType: 'toast', payload: { title: '灵动岛调用', text: '请点击下面的快捷动作卡片来体验。' } }
                        ]
                    }
                },
                {
                    template: 'quick-actions',
                    payload: {
                        title: '灵动岛 v2 · 关闭逻辑收口',
                        actions: [
                            {
                                icon: '⏱',
                                title: 'Mini（time 自动消失）',
                                description: '3 秒后自动关闭；点外部立刻关闭',
                                action: { action: 'appMethod', method: 'demoMiniTime' }
                            },
                            {
                                icon: '✋',
                                title: 'Mini（manual + 长按取消）',
                                description: '永不自动退；长按岛关闭，且调 onLongPress',
                                action: { action: 'appMethod', method: 'demoMiniManual' }
                            },
                            {
                                icon: '⛔',
                                title: 'Medium（maxSize=medium）',
                                description: '点岛不会升级到 large（防呆）',
                                action: { action: 'appMethod', method: 'demoMediumCapped' }
                            },
                            {
                                icon: '🔔',
                                title: '通知（自动消失）',
                                description: '聊天通知：默认 3500ms 自动消失',
                                action: { action: 'appMethod', method: 'showIslandNotification' }
                            },
                            {
                                icon: '🔒',
                                title: '受限岛（maxSize=mini）',
                                description: '演示点岛完全无反应（最直观的"防呆"）',
                                action: { action: 'appMethod', method: 'demoIslandLocked' }
                            },
                            {
                                icon: '🧪',
                                title: '顶替恢复（栈演示）',
                                description: '音乐岛挂好后，被通知顶替；通知消失后音乐岛回来',
                                action: { action: 'appMethod', method: 'demoStackRestore' }
                            }
                        ]
                    }
                },
                {
                    template: 'quick-actions',
                    payload: {
                        title: '模板内置能力',
                        actions: [
                            {
                                icon: '◉',
                                title: '切换 Mini 灵动岛',
                                description: '再次点击可关闭；适合播放/暂停之类的入口',
                                action: { action: 'appMethod', method: 'toggleMiniIsland' }
                            },
                            {
                                icon: '◎',
                                title: '切换 Medium 灵动岛',
                                description: '直接由 app 决定显示中号信息态',
                                action: { action: 'appMethod', method: 'toggleMediumIsland' }
                            },
                            {
                                icon: '⬤',
                                title: '切换 Large 灵动岛',
                                description: '适合音乐播放器展示更多控制信息',
                                action: { action: 'appMethod', method: 'toggleLargeIsland' }
                            },
                            {
                                icon: '◌',
                                title: '通知提醒',
                                description: '触发一次 notification 态',
                                action: { action: 'appMethod', method: 'showIslandNotification' }
                            },
                            {
                                icon: '◈',
                                title: '查看结构说明',
                                description: '打开详情页了解模板字段',
                                action: { action: 'detail', appId: 'template', pageId: 'template-detail' }
                            }
                        ]
                    }
                }
            ]
        },
        structure: {
            blocks: [
                {
                    template: 'info-list',
                    payload: {
                        title: '你以后写一个 app 最少要配这些',
                        items: [
                            { title: '基础信息', text: 'id、name、icon、iconBg。' },
                            { title: '界面外观', text: 'background、statusBarColor、homeIndicatorColor、topbar。' },
                            { title: '页面系统', text: 'pages + pageContent；有两个及以上主页面时自动出现导航。' },
                            { title: '数据声明', text: 'stores 数组声明数据表；系统自动挂上 db API。' },
                            { title: '交互增强', text: 'methods 里可以写自己的业务方法，并通过 data-app-action 调用。' },
                            { title: '灵动岛', text: '每个 app 都会自动拿到 island.show / toggle / setSize / notify / dismiss。' }
                        ]
                    }
                },
                {
                    template: 'hero',
                    payload: {
                        badge: 'AUTO NAV',
                        title: '导航数量由页面配置自动决定',
                        description: '0 个或 1 个主页面时不显示导航；2 个及以上时自动渲染导航栏。详情页 page.type = detail，不参与导航。',
                        meta: ['tab', 'orb', '后续可拓展 custom'],
                        actions: [
                            { label: '查看 app js 写法', action: 'detail', appId: 'template', pageId: 'template-code-demo' }
                        ]
                    }
                }
            ]
        },
        widgets: {
            blocks: [
                {
                    template: 'hero',
                    payload: {
                        badge: 'WIDGET DEMO',
                        title: '小组件预览与模板',
                        description: '进入桌面编辑态，点击灵动岛即可看到全部已注册的小组件。模板 App 注册了 3 个 demo widget，点击下面的按钮在灵动岛里预览。',
                        meta: ['app 自定义', '持久化位置', '复用灵动岛渲染'],
                        actions: [
                            { label: '预览问候小组件', action: 'appMethod', method: 'previewGreetingWidget' },
                            { label: '预览时钟小组件', action: 'appMethod', method: 'previewClockWidget' },
                            { label: '预览提示小组件', action: 'appMethod', method: 'previewTipWidget' }
                        ]
                    }
                },
                {
                    template: 'info-list',
                    payload: {
                        title: '小组件使用流程',
                        items: [
                            { title: '1. 进入桌面编辑态', text: '在桌面长按任意 app 图标（或 widget）。' },
                            { title: '2. 点击灵动岛', text: '灵动岛会临时切换成"小组件 picker"；同时一张 picker 浮层会弹出。' },
                            { title: '3. 选择小组件', text: '选择 app 注册的 widget，点击卡片把它加到桌面。' },
                            { title: '4. 退出编辑态', text: '长按灵动岛（不是点击）会触发"退出编辑态"；或者点击桌面空白处。' },
                            { title: '5. 与 app 换位', text: '小组件被加入后，可以被长按进入编辑态、拖到任意位置、和 app 互换。' }
                        ]
                    }
                }
            ]
        },
        // ============================================
        // 配置面板：12 张预设卡片（size × lifecycle × maxSize 矩阵）
        // 每张卡片点了直接挂岛，用户能实时观察岛的行为。
        // 也包含"通知矩阵"和"恢复栈演示"。
        // ============================================
        configurator: {
            blocks: (() => {
                // size 矩阵
                const sizeMatrix = [];
                const sizes = ['mini', 'medium', 'large'];
                const lifecycles = [
                    { key: 'manual', label: 'manual', desc: '永不自动退' },
                    { key: 'time', label: 'time', desc: '4 秒后自动消失' },
                ];
                const maxSizes = [null, 'mini', 'medium', 'large'];
                const presets = [];
                let idx = 0;
                for (const size of sizes) {
                    for (const lc of lifecycles) {
                        for (const cap of maxSizes) {
                            if (cap === size) continue;
                            idx += 1;
                            const capLabel = cap || '不限';
                            presets.push({
                                icon: `${idx}`,
                                title: `${size} · ${lc.label} · max=${capLabel}`,
                                description: cap ? `点岛不会超过 ${cap}` : '点岛可升到 large',
                                action: {
                                    action: 'appMethod',
                                    method: 'launchIslandPreset',
                                    payload: { size, lifecycle: lc.key, maxSize: cap }
                                }
                            });
                        }
                    }
                }
                return [
                    {
                        template: 'hero',
                        payload: {
                            badge: 'CONFIGURATOR',
                            title: '配置面板 · 灵动岛参数矩阵',
                            description: '点任意一张卡片直接挂岛，实时观察：size 是初始大小、lifecycle 是退出方式、maxSize 是点岛不能超过的封顶。',
                            meta: ['12 组预设', '点岛看效果', '长按 mini 关闭'],
                            actions: [
                                { label: '清空岛（dismiss）', action: 'appMethod', method: 'dismissIslandNow' }
                            ]
                        }
                    },
                    {
                        template: 'quick-actions',
                        payload: {
                            title: 'Size × Lifecycle × MaxSize',
                            actions: presets
                        }
                    },
                    {
                        template: 'quick-actions',
                        payload: {
                            title: '通知矩阵',
                            actions: [
                                {
                                    icon: '💬',
                                    title: '消息通知（time 4s）',
                                    description: '聊天通知，点外部立即消失',
                                    action: { action: 'appMethod', method: 'launchNotifyMessage' }
                                },
                                {
                                    icon: '✅',
                                    title: '成功通知（time 4s）',
                                    description: 'success 样式，4 秒后消失',
                                    action: { action: 'appMethod', method: 'launchNotifySuccess' }
                                },
                                {
                                    icon: '⚠',
                                    title: '警告通知（time 4s）',
                                    description: 'warning 样式，4 秒后消失',
                                    action: { action: 'appMethod', method: 'launchNotifyWarning' }
                                },
                                {
                                    icon: '✕',
                                    title: '错误通知（time 4s）',
                                    description: 'error 样式，4 秒后消失',
                                    action: { action: 'appMethod', method: 'launchNotifyError' }
                                }
                            ]
                        }
                    },
                    {
                        template: 'info-list',
                        payload: {
                            title: '玩家怎么玩',
                            items: [
                                { title: '1. 选一张预设', text: '每张卡片就是一个完整的 size+lifecycle+maxSize 组合。' },
                                { title: '2. 看岛反应', text: '点了之后岛按你选的参数显示；点岛看升降级，长按 mini 看关闭回调。' },
                                { title: '3. 通知不会顶替预设', text: '通知走 replaceReason，正常会自动消失；预设岛被通知顶替的话，通知消失后预设岛会自动恢复。' },
                                { title: '4. 想换配置？', text: '直接点其他卡片即可，新的会顶替旧的；旧的会被自动关掉。' }
                            ]
                        }
                    }
                ];
            })()
        }
    }
};

export const DETAIL_PAGE_CONTENT = {
    'template-detail': {
        title: '基础模板字段说明',
        paragraphs: [
            '每个 App 至少建议写：id、name、icon、iconBg、background、topbar、pages、pageContent。',
            '如果 App 需要自己的数据库表，就在 stores 里声明，系统会统一把声明注册到 ListenDb，并且给这个 App 自动挂上 db 调用方法。',
            '如果 App 需要灵动岛交互，不用自己找全局对象，直接在 methods 或 setup 里调用 toolkit.island.show / toggle / setSize / notify / dismiss 即可。',
            '如果页面内容足够简单，直接用 blocks + 内置模板；如果页面复杂，就自定义 renderPage / renderDetailPage。'
        ]
    },
    'template-code-demo': {
        blocks: [
            {
                template: 'info-list',
                payload: {
                    title: '推荐写法',
                    items: [
                        {
                            title: '文件位置',
                            text: '把新的 app 写到 js/apps/xxx.js，里面只做一件事：调用 registerPhoneApp({...})。'
                        },
                        {
                            title: '数据库',
                            text: 'stores: [{ name: "noteRecords", keyPath: "noteId" }]，之后在 methods 里用 this.toolkit.db.put("noteRecords", data)。'
                        },
                        {
                            title: '灵动岛',
                            text: 'this.toolkit.island.toggle("large", { title: "正在播放", message: "周杰伦 · 七里香", detail: "再次点击同一按钮即可关闭" })。'
                        },
                        {
                            title: '页面模板',
                            text: 'pageContent.home.blocks = [{ template: "hero", payload: {...} }]。'
                        },
                        {
                            title: '小组件 widgets',
                            text: 'apps 里加 widgets: [] 即可声明一组小组件；进入编辑态后点灵动岛把它们加入桌面。'
                        }
                    ]
                }
            }
        ]
    }
};

export function createTemplateApp() {
    return {
        id: 'template',
        name: '模板',
        badge: 0,
        iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #38bdf8 100%)',
        icon: APP_ICONS.layers,
        dock: {
            visible: true,
            order: 1
        },
        background: 'linear-gradient(180deg, #eef2ff 0%, #f5fbff 48%, #fff 100%)',
        statusBarColor: '#111827',
        homeIndicatorColor: 'rgba(17,24,39,0.28)',
        topbar: {
            visible: true,
            title: 'App Base Template',
            subtitle: '插件式注册 · 数据与界面分离'
        },
        nav: {
            type: 'tab'
        },
        pages: [
            { id: 'home', label: '首页', icon: '◦', nav: true },
            { id: 'structure', label: '结构', icon: '✦', nav: true },
            { id: 'widgets', label: '小组件', icon: '◈', nav: true },
            { id: 'configurator', label: '配置', icon: '⚙', nav: true },
            { id: 'template-detail', type: 'detail' },
            { id: 'template-code-demo', type: 'detail' }
        ],
        defaultRootPageId: 'home',
        stores: [
            { name: 'templateRecords', keyPath: 'recordId' }
        ],
        pageContent: APP_PAGE_CONTENT.template,
        detailContent: {
            'template-detail': DETAIL_PAGE_CONTENT['template-detail'],
            'template-code-demo': DETAIL_PAGE_CONTENT['template-code-demo'],
        },
        // === 小组件注册示例 ===
        // 每个 app 可以注册一组 widgets。每个 widget 形如：
        //   { id, label, icon, iconBg, size, orientation,
        //     onTap(instanceId, qualifiedId) -> bool, render(size, payload) -> html }
        // 进入桌面编辑态 → 点击灵动岛 → 拉出 picker → 选这个 widget 加到桌面。
        // widget 渲染调用 render(size, payload)；点击 widget → 调 onTap；
        // onTap 返回 false / 不返回则 fallback 到打开宿主 app。
        //
        // size 可选:
        //   'S' — 小型 (2x1 横, 或 1x2 竖)
        //   'M' — 中型 (2x2)
        //   'L' — 大型 (2x4)
        // orientation 仅 S 生效: 'h' (默认) | 'v'
        //
        // 模板 app 注册 6 个 demo widget，覆盖全部 4 种 footprint:
        //   3 个 S 横 (问候/时钟/提示)
        //   1 个 S 竖 (笔记速记)
        //   1 个 M    (日程)
        //   1 个 L    (大屏问候)
        widgets: [
            {
                id: 'greeting-widget',
                label: '问候',
                icon: '◐',
                iconBg: 'linear-gradient(135deg, #fb7299 0%, #f59e0b 100%)',
                size: 'S',
                orientation: 'h',
                render: renderGreetingWidget,
                // onTap(instanceId, qualifiedId, ctx)
                //   ctx.toolkit 是宿主 app 的 toolkit（包含 island helper）
                //   返回 true = 已处理；返回 false / 不返回 = fallback 到打开宿主 app
                onTap(instanceId, qualifiedId, ctx) {
                    if (ctx?.toolkit?.island) {
                        ctx.toolkit.island.toggle('mini', {
                            type: 'info',
                            title: '问候小组件',
                            message: '你点击了 greeting-widget',
                        });
                        return true;
                    }
                    return false;
                }
            },
            {
                id: 'clock-widget',
                label: '时钟',
                icon: '◷',
                iconBg: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                size: 'S',
                orientation: 'h',
                render: renderClockWidget,
                // 没声明 onTap：自动 fallback 到打开 host app
            },
            {
                id: 'tip-widget',
                label: '提示',
                icon: '◈',
                iconBg: 'linear-gradient(135deg, #4ade80 0%, #14b8a6 100%)',
                size: 'S',
                orientation: 'h',
                render: renderTipWidget,
            },
            {
                id: 'note-widget',
                label: '笔记',
                icon: '✎',
                iconBg: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
                size: 'S',
                orientation: 'v',
                render: renderNoteWidget,
            },
            {
                id: 'agenda-widget',
                label: '日程',
                icon: '☰',
                iconBg: 'linear-gradient(135deg, #fcd34d 0%, #f97316 100%)',
                size: 'M',
                render: renderAgendaWidget,
            },
            {
                id: 'big-greeting-widget',
                label: '大问候',
                icon: '☀',
                iconBg: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                size: 'L',
                render: renderGreetingWidget,
            }
        ],
        methods: {
            async toggleMiniIsland() {
                this.toolkit.island.toggle('mini', {
                    type: 'message',
                    title: '模板 App',
                    message: '这是 mini 信息态，再点一次同按钮会关闭。'
                });
            },
            async toggleMediumIsland() {
                this.toolkit.island.toggle('medium', {
                    type: 'info',
                    title: '模板 App',
                    message: '这是 medium 信息态，内容由当前 app 自己决定。'
                });
            },
            async toggleLargeIsland() {
                const song = {
                    id: 'template-demo-song',
                    title: '模板示例歌曲',
                    artist: '示例歌手',
                    cover: '',
                    color: '#fb7299'
                };
                const lyrics = [
                    { time: 0, text: '前奏响起，灵动岛开始进入音乐态。' },
                    { time: 8, text: '这里是歌词模板，每一行都带 time 字段。' },
                    { time: 16, text: 'active 会跟随 currentTime 自动高亮。' },
                    { time: 24, text: 'large 模式下歌词区域会自动滚动追踪。' },
                    { time: 32, text: '以后新的音乐 App 只需要传 song + lyrics。' },
                    { time: 40, text: '不用再重复写一套老式字符串拼接 UI。' }
                ];
                const duration = 48;
                const currentTime = 24;
                const progress = (currentTime / duration) * 100;

                this.toolkit.island.toggle('large', {
                    type: 'info',
                    title: song.title,
                    message: song.artist,
                    islandTemplate: 'music',
                    payload: {
                        song,
                        lyrics,
                        currentTime,
                        duration,
                        progress,
                        isPlaying: true,
                        liked: true,
                        actions: {
                            prev: () => this.toolkit.island.notify('info', '模板动作', '这里接上一首逻辑即可。'),
                            next: () => this.toolkit.island.notify('info', '模板动作', '这里接下一首逻辑即可。'),
                            'toggle-play': () => this.toolkit.island.notify('info', '模板动作', '这里接播放/暂停逻辑即可。'),
                            'toggle-like': () => this.toolkit.island.notify('success', '模板动作', '这里接收藏逻辑即可。')
                        }
                    }
                });
            },
            async showIslandNotification() {
                this.toolkit.island.notify('message', '李明', '消息已送达，请查收～', {
                    senderName: '李明',
                    senderId: '1024',
                    senderAvatar: 'L',
                    avatarBg: 'linear-gradient(135deg, #fb7299 0%, #f59e0b 100%)'
                });
            },

            // ============================================
            // v2 demo：关闭逻辑收口（6 个）
            // ============================================

            // Demo 1：mini + time，3 秒后自动消失
            async demoMiniTime() {
                this.toolkit.island.show('mini', {
                    type: 'info',
                    title: 'Mini · Time',
                    message: '3 秒后自动关闭。点外部也会立刻关闭。',
                    lifecycle: 'time',
                    duration: 3000,
                });
            },

            // Demo 2：mini + manual + 长按关闭
            async demoMiniManual() {
                this.toolkit.island.show('mini', {
                    type: 'info',
                    title: 'Mini · Manual',
                    message: '永不自动退。请长按岛关闭（会调 onLongPress）。',
                    lifecycle: 'manual',
                    onLongPress: () => {
                        // 这里就是"我被长按关闭了"时该做的事
                        // 比如音乐 app 会调 musicPlayer.pause()
                        this.toolkit.island.notify('info', 'onLongPress 已触发', 'app 收到长按回调，可以在这里停音乐。');
                    },
                });
            },

            // Demo 3：medium + maxSize=medium，点岛不会升 large
            async demoMediumCapped() {
                this.toolkit.island.show('medium', {
                    type: 'info',
                    title: 'Medium · Capped',
                    message: '点岛不会升级到 large；点外部才会降为 mini。',
                    maxSize: 'medium',
                });
            },

            // Demo 4：受限岛（maxSize=mini），点岛完全不响应
            async demoIslandLocked() {
                this.toolkit.island.show('medium', {
                    type: 'info',
                    title: '受限岛',
                    message: '点岛或点外部都没反应；只能长按或主动 dismiss。',
                    maxSize: 'mini',
                });
            },

            // Demo 5：栈演示 —— 模拟"音乐岛被聊天通知顶替，通知消失后音乐岛回来"
            async demoStackRestore() {
                // 1. 先挂一个"模拟音乐岛"（manual，不会自动退）
                this.toolkit.island.show('mini', {
                    type: 'info',
                    title: '🎵 正在播放',
                    message: '示例歌曲 · 七里香',
                    lifecycle: 'manual',
                    onKicked: () => {
                        // 被顶替时收到通知（app 可选写）
                        // 这里仅用 console 演示，不弹通知避免循环
                        console.log('[demoStackRestore] 音乐岛被顶替了');
                    },
                    onClosed: ({ reason }) => {
                        console.log('[demoStackRestore] 音乐岛关闭了，reason =', reason);
                    },
                });

                // 2. 等岛出现，500ms 后顶替它（发一条聊天通知）
                setTimeout(() => {
                    this.toolkit.island.notify('message', 'AI 助手', '这条通知消失后，"音乐岛"会自动回来。', {
                        senderName: 'AI 助手',
                        senderId: 'ai',
                        senderAvatar: 'A',
                        avatarBg: 'linear-gradient(135deg, #8b5cf6 0%, #38bdf8 100%)',
                        // 默认 3500ms 自动消失
                    });
                }, 500);
            },
            async previewGreetingWidget() {
                // 演示：用一个 widgetSlots 让灵动岛 mini 形态展示"几个 widget 占一起"
                this.toolkit.island.toggle('mini', {
                    type: 'info',
                    title: '小组件预览',
                    widgetSlots: [
                        { qualifiedId: 'template::greeting-widget', icon: '◐', iconBg: 'linear-gradient(135deg, #fb7299 0%, #f59e0b 100%)', label: '问候' },
                        { qualifiedId: 'template::clock-widget', icon: '◷', iconBg: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)', label: '时钟' },
                        { qualifiedId: 'template::tip-widget', icon: '◈', iconBg: 'linear-gradient(135deg, #4ade80 0%, #14b8a6 100%)', label: '提示' }
                    ]
                });
            },
            async previewClockWidget() {
                this.toolkit.island.toggle('mini', {
                    type: 'info',
                    title: '时钟小组件预览',
                    widgetSlots: [
                        { qualifiedId: 'template::clock-widget', icon: '◷', iconBg: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)', label: '时钟' }
                    ]
                });
            },
            async previewTipWidget() {
                this.toolkit.island.toggle('mini', {
                    type: 'info',
                    title: '提示小组件预览',
                    widgetSlots: [
                        { qualifiedId: 'template::tip-widget', icon: '◈', iconBg: 'linear-gradient(135deg, #4ade80 0%, #14b8a6 100%)', label: '提示' }
                    ]
                });
            },
            async seedTemplateData() {
                const record = {
                    recordId: `template-${Date.now()}`,
                    createdAt: Date.now(),
                    title: '模板示例记录',
                    description: '这是通过 App 自己的 db API 自动写入的数据。'
                };
                await this.toolkit.db.put('templateRecords', record);
                this.toolkit.island.notify('success', '数据已写入', '模板示例记录已保存到 templateRecords。');
            },

            // ============================================
            // 配置面板方法（v2 新增）
            // ============================================

            // 通用：按用户选的参数直接挂岛
            async launchIslandPreset(args = {}) {
                const { size = 'mini', lifecycle = 'manual', maxSize = null } = args;
                const payload = {
                    type: 'info',
                    title: `${size} · ${lifecycle}${maxSize ? ` · max=${maxSize}` : ''}`,
                    message: lifecycle === 'time'
                        ? '4 秒后自动消失（lifecycle=time）'
                        : '永不自动退（lifecycle=manual）',
                    icon: '',
                    lifecycle,
                    duration: lifecycle === 'time' ? 4000 : 0,
                    maxSize,
                    // 演示用：把本次选择打印到 console，
                    // 用户在桌面 chrome devtools 里能看到，方便观察
                    _meta: { size, lifecycle, maxSize, at: Date.now() },
                };
                this.toolkit.island.show(size, payload);
                // 同步写一行 log，便于桌面观察
                // eslint-disable-next-line no-console
                console.log('[configurator] launch', { size, lifecycle, maxSize });
            },

            // 4 种通知 demo
            async launchNotifyMessage() {
                this.toolkit.island.notify('message', '李明', '这条通知 4 秒后消失，点外部直接关岛。', {
                    senderName: '李明',
                    senderId: '1024',
                    senderAvatar: 'L',
                    avatarBg: 'linear-gradient(135deg, #fb7299 0%, #f59e0b 100%)',
                    duration: 4000,
                });
            },
            async launchNotifySuccess() {
                this.toolkit.island.notify('success', '保存成功', '你的改动已经落到本地数据库。', { duration: 4000 });
            },
            async launchNotifyWarning() {
                this.toolkit.island.notify('warning', '电量低', '剩余电量 15%，建议连接电源。', { duration: 4000 });
            },
            async launchNotifyError() {
                this.toolkit.island.notify('error', '网络异常', '网络连接已断开，请检查设置。', { duration: 4000 });
            },

            // 立即关岛（测试用）
            async dismissIslandNow() {
                this.toolkit.island.dismiss();
            },
        }
    };
}

export function createApps() {
    return [
        createTemplateApp(),
    ];
}
