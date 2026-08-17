/**
 * 预设库 · 灵动岛
 *
 * 灵动岛在本项目里是两件独立的事，很容易被当成一件：
 *
 *   1. **声明**（`appConfig.islandKinds`）—— 告诉系统「我会在什么时候弹什么」，
 *      用户才能在「灵动岛与小组件」里预览它、单独关掉它。不声明不报错，只是少一块。
 *   2. **运行时调用**（`toolkit.island.show / notify`）—— 真的把它弹出来。
 *
 * 这两件事的字段名不一样、层级不一样，App 作者十有八九只写第二件。
 * 这里把它们成对打包：一个 preset 同时给出「声明长什么样」和「怎么弹」，
 * 用 `kind` 字段把两边串起来，用户的开关才真正生效。
 *
 * ── 常驻岛必须设 minSize ──────────────────────────────────────────
 * 框架的全局「点岛外收起」是 large → medium → mini → 关岛。
 * 代表「进行中的活动」（播放 / 计时 / 上传 / 通话）的岛如果不设 `minSize: 'mini'`，
 * 用户在别的 App 里随手点三下就把它点没了，而活动还在跑。
 * 所以下面凡是 `sustained: true` 的预设，弹出时自动带上 `minSize: 'mini'`。
 */

import { esc } from './tokens.js';

/**
 * 预设清单。
 *
 * sustained  这个岛代表「还在进行中的活动」→ 自动 minSize:'mini' + lifecycle:'manual'
 * template   需要自定义渲染的，指向 window.islandTemplates 里的名字
 */
export const ISLAND_PRESETS = {
    toast: {
        label: '操作反馈',
        desc: '一句话的短提示，几秒后自动消失。',
        when: '保存成功 / 操作失败 / 复制完成这类需要确认但不需要用户处理的时刻',
        sizes: ['medium'],
        sustained: false,
        defaultSize: 'medium',
        previewPayload: { title: '已保存', message: '这条记录已经写进本地了' },
    },
    message: {
        label: '新消息',
        desc: '头像 + 发件人 + 一行摘要。',
        when: '收到一条新消息、评论或系统通知时',
        sizes: ['medium'],
        sustained: false,
        defaultSize: 'medium',
        previewPayload: { title: '小听', message: '在吗？看到帮我回一下' },
    },
    progress: {
        label: '进行中的任务',
        desc: '标题 + 进度条 + 百分比，任务跑完前一直挂在顶部。',
        when: '导出、上传、批量处理这类需要等一会儿的操作',
        sizes: ['mini', 'medium'],
        sustained: true,
        template: 'lpProgress',
        defaultSize: 'medium',
        previewPayload: { title: '正在导出', value: 62, hint: '第 31 / 50 条' },
    },
    timer: {
        label: '计时中',
        desc: '一个不断走动的时间，配一句状态。',
        when: '专注计时、录音、倒计时进行中',
        sizes: ['mini', 'medium'],
        sustained: true,
        template: 'lpTimer',
        defaultSize: 'medium',
        previewPayload: { title: '专注中', time: '24:31', hint: '还剩 1 段' },
    },
    status: {
        label: '实时状态',
        desc: '一个圆点 + 一个当前值，长期挂在顶部。',
        when: '连接状态、同步状态、后台任务在跑的时候',
        sizes: ['mini', 'medium'],
        sustained: true,
        template: 'lpStatus',
        defaultSize: 'mini',
        previewPayload: { title: '已连接', value: '同步中', tone: 'ok' },
    },
    nowPlaying: {
        label: '正在播放',
        desc: '封面 + 曲名 + 播放控制。',
        when: '音频 / 视频正在播放时',
        sizes: ['mini', 'medium', 'large'],
        sustained: true,
        template: 'music',
        defaultSize: 'medium',
        previewPayload: { title: '正在播放', message: '未知曲目' },
    },
};

/**
 * 生成一条 `appConfig.islandKinds` 声明。
 *
 * @param {string} presetId  ISLAND_PRESETS 的 key
 * @param {object} overrides 至少要覆盖 id；label/desc/when 建议按业务改写
 * @returns {object} islandKinds 里的一项
 */
export function islandKind(presetId, overrides = {}) {
    const preset = ISLAND_PRESETS[presetId];
    if (!preset) {
        console.warn(`[presets/islands] 未知的灵动岛预设: ${presetId}`);
        return { id: overrides.id || presetId, label: overrides.label || presetId, ...overrides };
    }
    return {
        id: overrides.id || presetId,
        label: overrides.label || preset.label,
        desc: overrides.desc || preset.desc,
        when: overrides.when || preset.when,
        sizes: overrides.sizes || preset.sizes,
        template: overrides.template !== undefined ? overrides.template : (preset.template || ''),
        previewPayload: overrides.previewPayload || preset.previewPayload,
        defaultEnabled: overrides.defaultEnabled !== false,
        essential: !!overrides.essential,
    };
}

/**
 * 按预设弹一个岛。
 *
 * @param {object} island  `this.toolkit.island`
 * @param {string} presetId
 * @param {object} data    标题 / 文案 / 进度等，字段见各 preset 的 previewPayload
 * @param {object} [opts]  { kind, size, duration, onClosed, ... } 直接透传
 */
export function showIsland(island, presetId, data = {}, opts = {}) {
    const preset = ISLAND_PRESETS[presetId];
    if (!island || !preset) return;

    const size = opts.size || preset.defaultSize || 'medium';
    const payload = {
        // kind 必须带 —— 不带的话用户在「灵动岛与小组件」里关掉它也没用
        kind: opts.kind || presetId,
        type: opts.type || 'info',
        title: data.title || preset.label,
        message: data.message || data.hint || '',
        icon: data.icon || opts.icon || '',
        islandTemplate: opts.template !== undefined ? opts.template : (preset.template || ''),
        payload: { ...data },
        ...opts,
    };

    if (preset.sustained) {
        // 进行中的活动：不给 minSize 会被用户点三下点没，活动却还在跑
        payload.minSize = opts.minSize || 'mini';
        payload.lifecycle = opts.lifecycle || 'manual';
    }

    island.show(size, payload);
}

// ---------------------------------------------------------------------------
// 自定义渲染模板
// ---------------------------------------------------------------------------

function toneColor(tone) {
    if (tone === 'warn') return '#f59e0b';
    if (tone === 'error') return '#ef4444';
    if (tone === 'ok') return '#22c55e';
    return '#60a5fa';
}

const TEMPLATES = {
    lpProgress: {
        render(size, payload = {}) {
            const p = payload.payload || payload;
            const pct = Math.max(0, Math.min(100, Number(p.value) || 0));
            if (size === 'mini') {
                return `<div class="lp-isl lp-isl--mini">
                    <span class="lp-isl__ring" style="--lp-isl-pct:${pct}"></span>
                    <span class="lp-isl__mini-text">${Math.round(pct)}%</span>
                </div>`;
            }
            return `<div class="lp-isl lp-isl--row">
                <div class="lp-isl__main">
                    <div class="lp-isl__title">${esc(p.title || payload.title)}</div>
                    <div class="lp-isl__track"><div class="lp-isl__fill" style="width:${pct}%"></div></div>
                </div>
                <div class="lp-isl__value">${Math.round(pct)}%</div>
            </div>`;
        },
    },
    lpTimer: {
        render(size, payload = {}) {
            const p = payload.payload || payload;
            if (size === 'mini') {
                return `<div class="lp-isl lp-isl--mini"><span class="lp-isl__mini-text">${esc(p.time || '00:00')}</span></div>`;
            }
            return `<div class="lp-isl lp-isl--row">
                <div class="lp-isl__main">
                    <div class="lp-isl__title">${esc(p.title || payload.title)}</div>
                    ${p.hint ? `<div class="lp-isl__hint">${esc(p.hint)}</div>` : ''}
                </div>
                <div class="lp-isl__time">${esc(p.time || '00:00')}</div>
            </div>`;
        },
    },
    lpStatus: {
        render(size, payload = {}) {
            const p = payload.payload || payload;
            const dot = `<span class="lp-isl__dot" style="background:${toneColor(p.tone)}"></span>`;
            if (size === 'mini') {
                return `<div class="lp-isl lp-isl--mini">${dot}</div>`;
            }
            return `<div class="lp-isl lp-isl--row">
                ${dot}
                <div class="lp-isl__main">
                    <div class="lp-isl__title">${esc(p.title || payload.title)}</div>
                </div>
                ${p.value ? `<div class="lp-isl__value">${esc(p.value)}</div>` : ''}
            </div>`;
        },
    },
};

/**
 * 把预设模板并进 `window.islandTemplates`。
 *
 * 只补不覆盖：同名模板以 App 自己注册的为准，
 * 否则一个 App 定义了 `lpProgress` 会被框架启动顺序悄悄改掉。
 */
export function installIslandTemplates() {
    if (typeof window === 'undefined') return;
    if (!window.islandTemplates) window.islandTemplates = {};
    for (const [name, tpl] of Object.entries(TEMPLATES)) {
        if (!window.islandTemplates[name]) window.islandTemplates[name] = tpl;
    }
}

export const islands = { ISLAND_PRESETS, islandKind, show: showIsland, installIslandTemplates };

/** 问卷 / 文档用的清单 */
export const ISLAND_CATALOG = Object.entries(ISLAND_PRESETS).map(([id, p]) => ({
    id,
    name: p.label,
    desc: p.desc,
    when: p.when,
    sizes: p.sizes,
    sustained: p.sustained,
}));

export default islands;
