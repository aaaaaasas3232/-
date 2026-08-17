/**
 * 问卷答案 → App 蓝图
 *
 * 蓝图是问卷和两个生成器之间的**唯一接口**。
 *
 *   answers（用户勾了什么）→ blueprint（这个 App 是什么样）→ 代码 / 提示词
 *
 * 为什么中间要隔一层：代码生成器和提示词生成器都需要「补全后的、
 * 自洽的」配置 —— 比如用户没填 appId 要从 appName 推、页面 id 要去重、
 * 选了 nowPlaying 岛就必须带 minSize。这些补全规则只应该有一份。
 * 直接让两个生成器各读 answers，就会出现「代码里有、提示词里没写」的漂移。
 */

import {
    getStyle, DENSITY_OPTIONS, TOPBAR_TYPES, TABBAR_TYPES, PAGE_LAYOUTS,
    CARD_TYPES, SUBPAGE_TEMPLATES, MODAL_CHOICES, ISLAND_CHOICES, WIDGET_CHOICES,
    CAPABILITIES, SYSTEM_READS, CROSS_APP, STORE_PRESETS, RENDER_MODES,
} from '../constants.js';

const RESERVED_IDS = new Set([
    'settings', 'chat', 'music', 'weather-app', 'appstore', 'focus-app',
    'cover-designer', 'relax', 'dream-weaver', 'app-maker', 'prompt-survey',
]);

/**
 * 常见中文页面名 → 英文 id。
 *
 * 不做完整的拼音转换（要拖一个几十 KB 的字典进来），只覆盖高频的那几十个。
 * 命不中就退回哈希 —— 哈希 id 能跑，只是可读性差。
 * 有这张表的意义是：生成出来的代码里是 `home` / `profile`，而不是 `page1-dw2n`。
 */
const NAME_HINTS = {
    首页: 'home', 主页: 'home', 我的: 'profile', 个人: 'profile', 个人中心: 'profile',
    发现: 'discover', 探索: 'explore', 推荐: 'featured', 消息: 'messages', 通知: 'notifications',
    设置: 'settings', 偏好: 'preferences', 关于: 'about', 帮助: 'help',
    列表: 'list', 清单: 'list', 记录: 'records', 历史: 'history', 归档: 'archive',
    统计: 'stats', 数据: 'data', 概览: 'overview', 报表: 'reports', 分析: 'analytics',
    收藏: 'favorites', 喜欢: 'liked', 标签: 'tags', 分类: 'categories',
    搜索: 'search', 筛选: 'filter', 详情: 'detail', 编辑: 'edit', 新建: 'create',
    今天: 'today', 日历: 'calendar', 日程: 'schedule', 日记: 'diary', 笔记: 'notes',
    相册: 'gallery', 图片: 'photos', 音乐: 'music', 视频: 'videos', 文件: 'files',
    聊天: 'chat', 好友: 'friends', 联系人: 'contacts', 动态: 'feed', 广场: 'square',
    账单: 'bills', 钱包: 'wallet', 订单: 'orders', 购物车: 'cart',
    任务: 'tasks', 待办: 'todo', 目标: 'goals', 习惯: 'habits', 计划: 'plans',
    工具: 'tools', 商店: 'store', 会员: 'member', 帐号: 'account', 账号: 'account',
};

/**
 * 中文 / 空格 / 符号 → kebab-case 的英文 id。
 *
 * 结果一定满足 `^[a-z][a-z0-9-]*$` —— 这些 id 会进 DOM 属性和 CSS 选择器，
 * 以 `-` 或数字开头会让 `[data-app-id="-xx"]` 之类的选择器直接失效，
 * 而且失效得很安静（样式不生效，不报错）。
 */
export function slugify(input, fallback = 'my-app') {
    const raw = String(input || '').trim();
    if (!raw) return fallback;

    if (NAME_HINTS[raw]) return NAME_HINTS[raw];

    const ascii = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (ascii && /^[a-z]/.test(ascii)) return ascii;
    // 数字开头（「2048」这种名字）补个前缀，别丢掉用户写的内容
    if (ascii) return `a-${ascii}`;

    // 全中文的名字转不出 ascii。用字符码拼一个**稳定**的短后缀 ——
    // 必须稳定，否则每次重新生成都会变成另一个 id，也就是另一个 App。
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    const suffix = hash.toString(36).slice(0, 5);
    const base = String(fallback || '').replace(/^-+|-+$/g, '');
    return base ? `${base}-${suffix}` : `p${suffix}`;
}

/** create + 驼峰 + App，用作 default export 的函数名 */
export function factoryName(appId) {
    const camel = String(appId || 'my-app')
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
    return `create${camel || 'My'}App`;
}

function pick(list, value) {
    return list.find((o) => o.value === value) || null;
}

function pickAll(list, values) {
    const set = new Set(Array.isArray(values) ? values : []);
    return list.filter((o) => set.has(o.value));
}

/** 页面名 → 页面 id，同名时加序号，保证 pages[].id 全局唯一 */
function buildPageIds(pages) {
    const used = new Set();
    return pages.map((page, i) => {
        let base = slugify(page.name, `page${i + 1}`);
        if (used.has(base)) {
            let n = 2;
            while (used.has(`${base}-${n}`)) n += 1;
            base = `${base}-${n}`;
        }
        used.add(base);
        return base;
    });
}

const TAB_GLYPHS = ['一', '二', '三', '四', '五'];

/**
 * 主色输入清洗。
 * 认 #rgb / #rrggbb / rgb() / rgba() / hsl() / hsla() 和 CSS 颜色关键字，
 * 别的一律当没填 —— 直接把用户随手敲的半截字符串塞进 style 里，
 * 生成出来的 App 会是一整片透明。
 */
function normalizeColor(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
    if (/^(rgb|rgba|hsl|hsla)\([^()]*\)$/i.test(v)) return v;
    if (/^[a-z]{3,20}$/i.test(v)) return v.toLowerCase();
    return '';
}

/**
 * @param {object} answers  store 里的 answers
 * @returns {object} blueprint
 */
export function buildBlueprint(answers = {}) {
    const appName = String(answers.appName || '').trim() || '我的应用';
    const appId = slugify(answers.appId || answers.appName, 'my-app');
    const style = getStyle(answers.style);
    // 主色覆盖：只接受能直接写进 CSS 的值，乱填的字符串会把整套配色搞成透明
    const accentColor = normalizeColor(answers.accentColor);
    const density = pick(DENSITY_OPTIONS, answers.density) || DENSITY_OPTIONS[2];
    const renderMode = pick(RENDER_MODES, answers.renderMode)?.value || 'template';

    const rawPages = Array.isArray(answers.pages) && answers.pages.length
        ? answers.pages
        : [{ name: '首页', desc: '', layout: 'column', cards: ['info'], cardFields: ['title'], subpages: [] }];
    const pageIds = buildPageIds(rawPages);

    const pages = rawPages.map((page, i) => {
        const layout = pick(PAGE_LAYOUTS, page.layout) || PAGE_LAYOUTS[0];
        const pageDensity = pick(DENSITY_OPTIONS, page.density) || density;
        return {
            id: pageIds[i],
            key: page.key || pageIds[i],
            name: String(page.name || `页面 ${i + 1}`).trim() || `页面 ${i + 1}`,
            desc: String(page.desc || '').trim(),
            glyph: TAB_GLYPHS[i] || String(i + 1),
            layout: layout.value,
            layoutTitle: layout.title,
            layoutHint: layout.hint,
            density: pageDensity.value,
            padding: pageDensity.pad,
            gap: pageDensity.gap,
            cards: pickAll(CARD_TYPES, page.cards.length ? page.cards : ['info']),
            cardFields: Array.isArray(page.cardFields) ? page.cardFields : ['title'],
            hasSearch: !!page.hasSearch,
            emptyText: String(page.emptyText || '').trim() || `还没有内容`,
            subpages: pickAll(SUBPAGE_TEMPLATES, page.subpages).map((sp) => ({
                ...sp,
                id: `${pageIds[i]}-${sp.value}`,
            })),
        };
    });

    const topbarType = pick(TOPBAR_TYPES, answers.topbarType) || TOPBAR_TYPES[1];
    const tabbarType = pick(TABBAR_TYPES, answers.tabbarType) || TABBAR_TYPES[1];

    // 单页 App 强制没有底栏：一个 tab 的 tab 栏纯粹占地方
    const effectiveTabbar = pages.length <= 1 ? 'none' : tabbarType.value;

    const capabilities = pickAll(CAPABILITIES, answers.capabilities);
    const capSet = new Set(capabilities.map((c) => c.value));
    const systemReads = pickAll(SYSTEM_READS, answers.systemReads);
    const crossApp = pickAll(CROSS_APP, answers.crossApp);
    const crossSet = new Set(crossApp.map((c) => c.value));

    const islands = pickAll(ISLAND_CHOICES, answers.islands);
    const widgets = pickAll(WIDGET_CHOICES, answers.widgets);
    const modals = pickAll(MODAL_CHOICES, answers.modals);

    // AI 能力必然要读用户卡（要拿到它绑的 API），这个依赖用户不会主动想到
    const needsUserCard = capSet.has('ai') || systemReads.some((r) => r.value === 'user');

    const stores = capSet.has('db')
        ? pickAll(STORE_PRESETS, answers.stores.length ? answers.stores : ['items']).map((s) => ({
            ...s,
            name: `${camelPrefix(appId)}${s.value.charAt(0).toUpperCase()}${s.value.slice(1)}`,
        }))
        : [];

    return {
        appId,
        appName,
        appDesc: String(answers.appDesc || '').trim(),
        tagline: String(answers.tagline || '').trim(),
        factoryName: factoryName(appId),
        idConflict: RESERVED_IDS.has(appId),

        renderMode,
        renderModeInfo: pick(RENDER_MODES, renderMode),

        style: {
            value: style.value,
            title: style.title,
            desc: style.desc,
            bg: style.bg,
            card: style.card,
            // 用户单独挑过主色就用他的，没挑才用配色自带的。
            // 这一处是「选了新颜色不生效」的根子：以前 primary 恒等于 style.prim，
            // 界面上给了取色器也没用。
            primary: accentColor || style.prim,
            presetPrimary: style.prim,
            accentOverridden: !!accentColor,
            text: style.text,
            iconBg: accentColor
                ? `linear-gradient(145deg, ${accentColor}, ${style.prim})`
                : style.iconBg,
            statusBar: style.statusBar,
            dark: !!style.dark,
        },
        radius: answers.radius || 'md',
        elevation: answers.elevation || 'sm',
        density: density.value,
        padding: density.pad,
        gap: density.gap,

        topbar: {
            type: topbarType.value,
            title: topbarType.title,
            visible: topbarType.value !== 'none',
            left: answers.topbarLeft || 'none',
            // 纯按钮组走 topbarButtons（多、带文字），其余类型走 topbarRight（少、纯图标）。
            // 统一收敛到 right 让下游只认一个字段，免得 codegen / prompt 各判一次。
            right: topbarType.value === 'buttons-only'
                ? (Array.isArray(answers.topbarButtons) ? answers.topbarButtons.slice(0, 5) : [])
                : (Array.isArray(answers.topbarRight) ? answers.topbarRight : []),
            buttonLabels: topbarType.value === 'buttons-only'
                ? answers.topbarButtonLabels !== false
                : false,
            searchInPage: !!answers.topbarSearchInPage,
        },
        tabbar: {
            type: effectiveTabbar,
            title: pick(TABBAR_TYPES, effectiveTabbar)?.title || '无',
            visible: effectiveTabbar !== 'none',
            showLabels: answers.tabbarShowLabels !== false,
        },
        fab: {
            position: answers.fabPosition || 'none',
            visible: (answers.fabPosition || 'none') !== 'none',
            label: String(answers.fabLabel || '新建').trim(),
        },

        pages,
        defaultRootPageId: pages[0]?.id || 'home',

        modals,
        islands: islands.map((i) => ({
            ...i,
            kindId: `${appId}-${i.value}`,
        })),
        widgets: widgets.map((w) => ({
            ...w,
            widgetId: `${appId}-${w.value}`,
            size: (Array.isArray(answers.widgetSizes) ? answers.widgetSizes : []).find((s) => w.sizes.includes(s)) || w.sizes[0],
        })),

        capabilities,
        capSet,
        systemReads,
        needsUserCard,
        crossApp,
        crossSet,
        stores,

        needsAi: capSet.has('ai') || capSet.has('worldContent'),
        needsWorldContent: capSet.has('worldContent'),
        needsDb: capSet.has('db'),
        needsSearch: capSet.has('search') || pages.some((p) => p.hasSearch) || topbarType.value === 'search',

        // ★ v0.90 世界观模拟系统（资产 / 时间 / 地点 / 数值 / 事件 / 存档 / NPC）
        worldSim: {
            asset: capSet.has('worldAsset'),
            time: capSet.has('worldTime'),
            geo: capSet.has('worldGeo'),
            stats: capSet.has('statSystem'),
            events: capSet.has('eventSystem'),
            saves: capSet.has('saveSystem'),
            npcs: capSet.has('npcSystem'),
            any: ['worldAsset', 'worldTime', 'worldGeo', 'statSystem', 'eventSystem', 'saveSystem', 'npcSystem']
                .some((v) => capSet.has(v)),
        },

        games: {
            gomoku: capSet.has('gameGomoku'),
            snake: capSet.has('gameSnake'),
            arena: capSet.has('gameArena'),
            any: capSet.has('gameGomoku') || capSet.has('gameSnake') || capSet.has('gameArena'),
        },

        engineerStyle: String(answers.engineerStyle || '').trim(),
        extraNotes: String(answers.extraNotes || '').trim(),
    };
}

function camelPrefix(appId) {
    const parts = String(appId).split('-').filter(Boolean);
    if (!parts.length) return 'app';
    return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/**
 * 蓝图体检 —— 在生成之前把「一定会出问题」的配置挑出来。
 *
 * 分成 blocker 和 warning：blocker 生成出来一定跑不起来（重名 id 会被
 * 注册表静默跳过、没名字的 App 在桌面上就是个空图标），warning 是
 * 「能跑但体验有问题」。
 */
export function reviewBlueprint(bp) {
    const blockers = [];
    const warnings = [];

    if (!bp.appName || bp.appName === '我的应用') warnings.push('还没给 App 起名字，会用「我的应用」这个默认名。');
    if (bp.idConflict) blockers.push(`App ID「${bp.appId}」和系统内置 App 撞了。注册表遇到重名会直接跳过，你的 App 不会出现在桌面上。换一个 ID。`);
    if (!/^[a-z][a-z0-9-]*$/.test(bp.appId)) blockers.push(`App ID「${bp.appId}」格式不对，只能是小写字母、数字和连字符，且以字母开头。`);

    if (bp.pages.length > 5) warnings.push('主页面超过 5 个，底部 tab 栏会挤到图标和文字叠在一起。建议合并或者把次要页面改成子页面。');
    bp.pages.forEach((p) => {
        if (!p.name) warnings.push('有页面没填名字。');
        if (!p.cards.length) warnings.push(`「${p.name}」没选任何卡片类型，页面会是空的。`);
    });

    if (bp.needsDb && !bp.stores.length) blockers.push('勾了「本地存储」但没选要存什么，生成出来的代码会用到 toolkit.db 却没有表，写入会静默失败。');
    if (!bp.needsDb && bp.stores.length) warnings.push('选了数据表但没勾「本地存储」能力，表会被声明出来但没人用。');

    if (bp.needsAi && !bp.needsUserCard) warnings.push('勾了 AI 对话，会自动读用户卡来拿绑定的 API。');

    // 内容全靠现生成的 App，不存盘就等于每次打开都重烧一遍 token
    if (bp.needsWorldContent && !bp.needsDb) {
        blockers.push('勾了「按世界观生成内容」但没勾「本地存储」。内容是现问 AI 造出来的，不存盘的话每次打开都要重新生成一遍，用户会为同样的东西反复付费。');
    }
    if (bp.needsWorldContent && !bp.systemReads.some((r) => r.value === 'world')) {
        warnings.push('勾了「按世界观生成内容」，会自动读世界观（简介、货币、夹子），不用另外勾。');
    }

    const sustained = bp.islands.filter((i) => i.sustained);
    if (sustained.length && bp.renderMode === 'template') {
        warnings.push('选了「进行中的活动」类灵动岛（进度 / 计时 / 播放），这类岛需要持续更新内容。模板模式下每次更新都会重拼整页 HTML，建议改用 Vue 模式。');
    }

    if (bp.renderMode === 'template') {
        const hasInput = bp.capSet.has('ai') || bp.pages.some((p) => p.subpages.some((s) => s.value === 'edit'));
        if (hasInput) {
            warnings.push('模板模式下输入框每敲一个字整块 DOM 就会重建，光标会跳走。你的 App 有编辑页 / AI 输入，建议改用 Vue 模式。');
        }
    }

    if (bp.tabbar.visible && bp.fab.position === 'bottom-center') {
        warnings.push('底部居中的浮动按钮会压在 tab 栏正中间的那个 tab 上，两个都不好点。建议改成右下角。');
    }

    if (bp.crossSet.has('appStore')) {
        warnings.push('勾了「进 App Store」，生成的 App 需要先去商店安装才会出现在桌面。调试阶段容易误以为没注册上。');
    }

    // ★ v0.90 世界观模拟系统的依赖体检
    if (bp.worldSim?.any && !bp.needsDb) {
        blockers.push('勾了世界观模拟能力（资产/时间/事件/存档等）但没勾「本地存储」。这些系统全部依赖持久化，没有表就是一次性玩具。');
    }
    if (bp.worldSim?.events && !bp.worldSim?.stats) {
        warnings.push('勾了「加权突发事件」但没勾「数值成长系统」：事件概率的属性护盾没有属性可读，会退化成纯阶段曲线。建议两个一起勾。');
    }
    if (bp.worldSim?.saves && !bp.worldSim?.time) {
        warnings.push('勾了「多档存档」但没勾「世界时间系统」：没有每档独立时钟，「新开档时间回到原点」就无从谈起。建议两个一起勾。');
    }
    if (bp.worldSim?.asset && !bp.needsWorldContent && !bp.worldSim?.stats) {
        warnings.push('勾了「真实资产联动」：记得每一笔收支都要有稳定的 sourceType + sourceId，否则重复点击会重复扣款。');
    }
    if (bp.crossSet.has('worldMode') && bp.crossSet.has('appStore')) {
        warnings.push('「绑定专属世界模式」通常配 requiresInstall=false（对应世界桌面自动出现）；和「进 App Store」同时勾会让用户还要手动安装一次。');
    }

    return { blockers, warnings, ok: blockers.length === 0 };
}
