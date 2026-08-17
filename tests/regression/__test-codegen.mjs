/**
 * codegen 冒烟测试
 *
 * 生成器最容易出的错是「拼出来的字符串不是合法 JS」—— 而这个错在浏览器里
 * 只会表现为一句 "Unexpected token"，看不出是哪一段拼错的。
 * 这里对每种渲染模式各生成一份，用 new Function 逼浏览器同款解析器
 * 真的编译一遍，语法错会立刻带行号抛出来。
 */

import { buildBlueprint, reviewBlueprint } from '../../js/apps/app-maker/survey/blueprint.js';
import { generateAppCode } from '../../js/apps/app-maker/survey/codegen.js';
import { buildPrompt } from '../../js/apps/app-maker/survey/prompt.js';
import { PAGE_PRESETS } from '../../js/apps/app-maker/constants.js';

function makeAnswers(overrides = {}) {
    return {
        appName: '心情日记',
        appId: 'mood-diary',
        appDesc: '每天记一句话，看看这个月过得怎么样',
        tagline: '记一句就好',
        renderMode: 'template',
        style: 'sakura',
        radius: 'lg',
        elevation: 'sm',
        density: 'normal',
        topbarType: 'standard',
        topbarLeft: 'none',
        topbarRight: ['add', 'more'],
        topbarSearchInPage: false,
        tabbarType: 'default',
        tabbarShowLabels: true,
        fabPosition: 'bottom-right',
        fabLabel: '记一笔',
        pagePreset: 'dashboard',
        pages: PAGE_PRESETS[2].pages.map((p, i) => ({ ...p, key: `k${i}`, density: 'normal', cardFields: ['title', 'subtitle', 'chevron', 'time'], hasSearch: i === 1, emptyText: '' })),
        modals: ['confirm', 'form', 'actionSheet', 'picker', 'prompt', 'sheet', 'toast'],
        islands: ['toast', 'progress', 'timer', 'status', 'message', 'nowPlaying'],
        widgets: ['stat', 'ring', 'list', 'actions', 'chart', 'text'],
        widgetSizes: ['M'],
        capabilities: ['db', 'ai', 'search', 'favorite'],
        systemReads: ['persona', 'user', 'world', 'promptLib', 'diary'],
        crossApp: ['islandKinds', 'promptToMurmur', 'socialProfile'],
        stores: ['items', 'settings', 'history'],
        engineerStyle: '严谨、注重细节',
        extraNotes: '希望配色柔和一点',
        ...overrides,
    };
}

let failures = 0;

function check(label, answers) {
    const bp = buildBlueprint(answers);
    const review = reviewBlueprint(bp);
    const code = generateAppCode(bp);
    const prompt = buildPrompt(bp);

    // 1) 语法
    try {
        // 去掉 export default，new Function 不接受模块语法
        const body = code.replace(/^export default /m, 'return ');
        // eslint-disable-next-line no-new-func
        new Function(body);
    } catch (err) {
        failures += 1;
        console.error(`\n❌ [${label}] 生成的代码语法错误：${err.message}`);
        const m = /(\d+):(\d+)/.exec(err.stack || '');
        console.error(code.split('\n').slice(0, 40).join('\n'));
        return;
    }

    // 2) 硬约束：不能有 import
    const importLines = code.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /^\s*import[\s({'"]/.test(l));
    if (importLines.length) {
        failures += 1;
        console.error(`\n❌ [${label}] 生成的代码里有 import：`, importLines);
        return;
    }

    // 3) 必须 default export 工厂
    if (!/export default function create\w+App\(\)/.test(code)) {
        failures += 1;
        console.error(`\n❌ [${label}] 缺少 default export 工厂函数`);
        return;
    }

    // 4) 真的能跑出 appConfig
    let cfg;
    try {
        // eslint-disable-next-line no-new-func
        const factory = new Function('window', 'document', `${code.replace(/^export default /m, 'return ')}`)(
            { __listenPresets: null },
            { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} } },
        );
        cfg = factory();
    } catch (err) {
        failures += 1;
        console.error(`\n❌ [${label}] 工厂函数跑不起来：${err.message}`);
        return;
    }

    const problems = [];
    if (!cfg.id) problems.push('缺 id');
    if (!cfg.name) problems.push('缺 name');
    if (!Array.isArray(cfg.pages) || !cfg.pages.length) problems.push('pages 为空');
    if (cfg.defaultRootPageId && !cfg.pages.some((p) => p.id === cfg.defaultRootPageId)) problems.push('defaultRootPageId 不在 pages 里');
    if (typeof cfg.renderPage !== 'function') problems.push('缺 renderPage');
    if (problems.length) {
        failures += 1;
        console.error(`\n❌ [${label}] appConfig 有问题：${problems.join('、')}`);
        return;
    }

    // 5) renderPage 真的能出 HTML（template / hybrid），vue 模式出组件配置
    try {
        const out = cfg.renderPage({}, cfg.pages[0], { state: {}, id: cfg.id });
        if (answers.renderMode === 'vue') {
            if (!out || typeof out !== 'object' || !out.template) problems.push('vue 模式没返回组件配置');
        } else if (typeof out !== 'string' || !out.length) {
            problems.push('renderPage 没返回 HTML 字符串');
        }
    } catch (err) {
        failures += 1;
        console.error(`\n❌ [${label}] renderPage 跑挂了：${err.message}`);
        return;
    }
    if (problems.length) {
        failures += 1;
        console.error(`\n❌ [${label}] ${problems.join('、')}`);
        return;
    }

    console.log(`✅ [${label}] ${code.split('\n').length} 行代码 / ${(code.length / 1024).toFixed(1)}KB · 提示词 ${(prompt.length / 1024).toFixed(1)}KB · ${cfg.pages.length} 页`
        + (review.blockers.length ? ` · ⚠ ${review.blockers.length} 个阻断项` : '')
        + (review.warnings.length ? ` · ${review.warnings.length} 条提醒` : ''));
}

console.log('—— codegen 冒烟测试 ——\n');

check('template · 全功能', makeAnswers({ renderMode: 'template' }));
check('hybrid · 全功能', makeAnswers({ renderMode: 'hybrid' }));
check('vue · 全功能', makeAnswers({ renderMode: 'vue' }));
check('最小配置', makeAnswers({
    renderMode: 'template',
    topbarType: 'none',
    tabbarType: 'none',
    fabPosition: 'none',
    pages: [{ key: 'a', name: '主页', desc: '', layout: 'column', density: 'tight', cards: ['info'], cardFields: ['title'], hasSearch: false, subpages: [], emptyText: '' }],
    modals: [],
    islands: [],
    widgets: [],
    capabilities: [],
    systemReads: [],
    crossApp: [],
    stores: [],
}));
check('中文名没填 ID', makeAnswers({ appId: '', appName: '记账小本' }));
check('全部布局', makeAnswers({
    renderMode: 'vue',
    pages: ['column', 'twoColumn', 'grid', 'masonry', 'carousel'].map((layout, i) => ({
        key: `L${i}`, name: `布局${i}`, desc: '', layout, density: 'relaxed',
        cards: ['info', 'stat', 'media', 'progress', 'profile', 'timeline', 'keyValue', 'bars', 'banner', 'tags', 'row'],
        cardFields: ['title', 'subtitle', 'body', 'icon', 'badge', 'time', 'number', 'actions', 'chevron'],
        hasSearch: true, subpages: ['detail', 'edit', 'settings', 'search'], emptyText: '',
    })),
}));

console.log(failures ? `\n${failures} 个用例失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
