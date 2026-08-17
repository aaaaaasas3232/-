/**
 * 预设库 · 统一出口
 *
 * ── 这一层为什么存在 ──────────────────────────────────────────────
 * 框架此前提供的是「机制」（怎么注册一个 App、怎么弹岛、怎么建表），
 * 但没提供「材料」（一张卡片长什么样、一个确认框怎么弹）。
 * 于是每个 App 都自己拼一套，同一个视觉在项目里有五份实现，
 * 而新 App 作者面对的是一张白纸 —— 这也是「App 制作」问卷最难出题的地方：
 * 没有可选项，只能让用户用自然语言描述，最后全看 AI 发挥。
 *
 * 有了这一层，问卷的每道题都能变成「从这几个里挑」，
 * 而挑出来的结果可以**直接变成调用参数**，不经过 AI 的自由发挥。
 *
 * ── 两种消费方式 ──────────────────────────────────────────────────
 *   1. 项目内置 App：`import { presets } from '@/src/core/presets/index.js'`
 *   2. 用户上传的插件：`const LP = window.__listenPresets`
 *
 * 第二种是硬需求 —— 插件走 blob URL 动态 import，没有构建、没有 `@` 别名，
 * 任何 import 语句都会解析失败。所以这里必须把整个库挂到 window 上。
 */

import { cards, CARD_CATALOG } from './cards.js';
import { layouts, LAYOUT_CATALOG } from './layouts.js';
import { modals, MODAL_CATALOG } from './modals.js';
import { islands, ISLAND_CATALOG, installIslandTemplates } from './islands.js';
import { widgets, WIDGET_CATALOG } from './widgets.js';
import * as tokens from './tokens.js';

export const presets = {
    cards,
    layouts,
    modals,
    islands,
    widgets,
    tokens,
    esc: tokens.esc,
    act: tokens.act,
};

/** 所有清单合到一起，给「App 制作」问卷和文档页遍历用 */
export const PRESET_CATALOG = {
    cards: CARD_CATALOG,
    layouts: LAYOUT_CATALOG,
    modals: MODAL_CATALOG,
    islands: ISLAND_CATALOG,
    widgets: WIDGET_CATALOG,
};

/** 挂 window + 注册岛模板。幂等，可以重复调。 */
export function installPresets() {
    installIslandTemplates();
    if (typeof window !== 'undefined') {
        window.__listenPresets = presets;
        window.__listenPresetCatalog = PRESET_CATALOG;
    }
    return presets;
}

/**
 * ★ 模块加载即安装，不等 src/index.js 调。
 *
 * 原因：`js/apps/index.js` 里 `registerAll()` 是**同步开跑**的，
 * 第一个 App 的 `setup()` 会在 src/index.js 的模块体执行之前就跑完。
 * 如果等 src/index.js 里那句显式调用，早注册的 App 在 setup 里
 * 拿到的 `window.__listenPresets` 是 undefined —— 而且不报错，只是少一块。
 */
installPresets();

export { cards, layouts, modals, islands, widgets, tokens };
export default presets;
