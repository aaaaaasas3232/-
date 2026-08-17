/**
 * 气泡机 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 分对象防抖落盘,
 * 照 relax-app / 湛蓝回忆那套(项目里最成熟的 vue 模式范式)。
 *
 * ── 规矩 ────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`,改状态一律走本文件导出的 mutator。
 *    这样「什么时候该落盘」只有一个地方要考虑。
 * 2. 落盘按对象粒度:改设置只写 `bbLibrary`,改气泡只写**那一个气泡**。
 * 3. hydrate 只用 `_hydrating` 防并发,**不用** `_hydrated` 硬阻断 ——
 *    硬阻断会让首次失败后永远没有第二次机会(AGENTS2 §9.12 天气 App 的坑)。
 */

import {
    loadLibrary, saveLibrary, loadBubbles, saveBubble, deleteBubble as dbDeleteBubble,
    normalizeBubble, normalizeShape,
} from './services/db.js';
import { BUBBLE_PRESETS, buildPreset, CONTENT_DEFAULTS } from './services/presets.js';
import { createDefaultSettings } from './constants.js';
import { makeId, findById, isSameId, asArray, debounce, toPlain, clamp } from './utils.js';
import { createBubbleConfig, createTail, sanitizeSvg, repaintSvg } from '@/src/core/bubble-style.js';

// ============================================================
// 状态
// ============================================================

function makeReactive(raw) {
    const Vue = typeof window !== 'undefined' ? window.Vue : null;
    return typeof Vue?.reactive === 'function' ? Vue.reactive(raw) : raw;
}

const STATE = makeReactive({
    ready: false,
    error: '',

    /** 气泡库 */
    bubbles: [],
    /** 单例:设置 + 界面配色 + SVG 形状库 */
    library: {
        id: 'root', settings: createDefaultSettings(), shapes: [], activeBubbleId: '', seeded: false, updatedAt: 0,
    },

    /** 正在编辑的气泡 id */
    activeId: '',
    /** 展开的折叠区(设计页) */
    openSection: 'fill',
    /** 正在编辑的尾巴 id;空 = 没选中 */
    activeTailId: '',

    /** 顶部三档:design / shape / library */
    tab: 'design',

    // ── SVG 工作台 ─────────────────────────
    svg: {
        source: '',
        fill: CONTENT_DEFAULTS.svgFill,
        stroke: '',
        strokeWidth: 1,
        opacity: 100,
        rotation: 0,
        flipX: false,
        flipY: false,
        error: '',
    },

    modal: null,
    toast: '',
});

export function getState() {
    return STATE;
}

let _app = null;
let _hydrating = false;

// ============================================================
// 派生
// ============================================================

export function getSettings() {
    return STATE.library.settings;
}

export function getActive() {
    return findById(STATE.bubbles, STATE.activeId);
}

export function getShapes() {
    return asArray(STATE.library.shapes);
}

export function getActiveTail() {
    const bubble = getActive();
    if (!bubble) return null;
    return asArray(bubble.tails).find((t) => isSameId(t.id, STATE.activeTailId)) || null;
}

/**
 * 预览用的「对面那一侧」。
 *
 * 找库里最近改过的、和当前气泡不同侧的一个。找不到就镜像当前这个 ——
 * 空着不画的话,用户看不出自己调的圆角在一屏对话里是什么效果。
 */
export function getCounterpart() {
    const cur = getActive();
    if (!cur) return null;
    const other = STATE.bubbles.find((b) => !isSameId(b.id, cur.id) && b.side !== cur.side);
    if (other) return other;
    return {
        ...cur,
        id: `${cur.id}-mirror`,
        side: cur.side === 'left' ? 'right' : 'left',
        radiusTL: cur.radiusTR,
        radiusTR: cur.radiusTL,
        radiusBR: cur.radiusBL,
        radiusBL: cur.radiusBR,
        tails: asArray(cur.tails).map((t) => ({
            ...t,
            anchor: t.anchor === 'left' ? 'right' : (t.anchor === 'right' ? 'left' : t.anchor),
            along: 100 - t.along,
            flipX: !t.flipX,
        })),
    };
}

/** SVG 工作台当前产出的成品 */
export function getSvgResult() {
    const s = STATE.svg;
    if (!s.source.trim()) return '';
    return repaintSvg(s.source, {
        fill: s.fill || 'none',
        stroke: s.stroke || 'none',
        strokeWidth: s.strokeWidth,
        opacity: s.opacity,
        rotation: s.rotation,
        flipX: s.flipX,
        flipY: s.flipY,
    });
}

// ============================================================
// 落盘
// ============================================================

const persistLibrary = debounce(() => {
    if (!_app) return;
    void saveLibrary(_app, STATE.library);
}, 450);

const _bubbleTimers = new Map();

function persistBubble(bubbleId = STATE.activeId) {
    if (!_app || !bubbleId) return;
    const key = String(bubbleId);
    if (_bubbleTimers.has(key)) clearTimeout(_bubbleTimers.get(key));
    _bubbleTimers.set(key, setTimeout(() => {
        _bubbleTimers.delete(key);
        const bubble = findById(STATE.bubbles, key);
        if (bubble) void saveBubble(_app, bubble);
    }, 350));
}

export async function flushPersist() {
    persistLibrary.flush();
    for (const [key, timer] of _bubbleTimers.entries()) {
        clearTimeout(timer);
        _bubbleTimers.delete(key);
        const bubble = findById(STATE.bubbles, key);
        if (bubble && _app) await saveBubble(_app, bubble);
    }
}

// ============================================================
// 初始化
// ============================================================

export async function hydrate(app) {
    if (app) _app = app;
    if (_hydrating) return;
    _hydrating = true;
    try {
        const [library, bubbles] = await Promise.all([loadLibrary(_app), loadBubbles(_app)]);
        STATE.library = makeReactive(library);
        STATE.bubbles = makeReactive(bubbles);

        await seedOnce();

        const wanted = library.activeBubbleId && findById(STATE.bubbles, library.activeBubbleId)
            ? library.activeBubbleId
            : (STATE.bubbles[0]?.id || '');
        STATE.activeId = wanted;
        STATE.activeTailId = asArray(getActive()?.tails)[0]?.id || '';

        STATE.ready = true;
        STATE.error = '';
    } catch (err) {
        console.error('[bubble-maker/store] 初始化失败', err);
        STATE.error = err?.message || '初始化失败';
        STATE.ready = true;   // 让 UI 能显示错误,而不是永远转圈
    } finally {
        _hydrating = false;
    }
}

/**
 * 首次进来灌一套内置气泡。
 *
 * ★ 只灌一次,靠 `library.seeded` 记住。不这么做的话用户把内置的删光,
 *   下次打开又全回来了 —— 「删不掉」比「一开始就是空的」更让人恼火。
 */
async function seedOnce() {
    if (STATE.library.seeded) return;
    STATE.library.seeded = true;
    for (const preset of BUBBLE_PRESETS.slice(0, 3)) {
        for (const side of ['right', 'left']) {
            const bubble = normalizeBubble({ ...buildPreset(preset.id, side), id: makeId('bub') });
            STATE.bubbles.push(bubble);
            await saveBubble(_app, bubble);
        }
    }
    persistLibrary();
}

// ============================================================
// 气泡
// ============================================================

export async function createBubble(patch = {}) {
    const bubble = normalizeBubble({
        ...createBubbleConfig(patch),
        id: makeId('bub'),
        name: patch.name || '新气泡',
        createdAt: Date.now(),
    });
    STATE.bubbles.unshift(bubble);
    await saveBubble(_app, bubble);
    selectBubble(bubble.id);
    return bubble;
}

export async function createFromPreset(presetId, side) {
    const preset = BUBBLE_PRESETS.find((p) => p.id === presetId);
    const cfg = buildPreset(presetId, side);
    return createBubble({ ...cfg, name: `${preset?.name || '预设'}·${side === 'left' ? '左' : '右'}` });
}

export async function duplicateBubble(bubbleId) {
    const src = findById(STATE.bubbles, bubbleId);
    if (!src) return null;
    const copy = normalizeBubble({
        ...toPlain(src),
        id: makeId('bub'),
        name: `${src.name} 副本`.slice(0, 24),
        createdAt: Date.now(),
        starred: false,
    });
    // 尾巴 id 也要换新的 —— 沿用同一批 id 的话,在副本里选中一条尾巴
    // 会把原件那条也高亮(两边 id 相同),而且删一条会删两条
    copy.tails = asArray(copy.tails).map((t) => ({ ...t, id: makeId('tail') }));
    STATE.bubbles.unshift(copy);
    await saveBubble(_app, copy);
    selectBubble(copy.id);
    return copy;
}

export function selectBubble(bubbleId) {
    if (!findById(STATE.bubbles, bubbleId)) return false;
    STATE.activeId = String(bubbleId);
    STATE.library.activeBubbleId = String(bubbleId);
    STATE.activeTailId = asArray(getActive()?.tails)[0]?.id || '';
    persistLibrary();
    return true;
}

/**
 * 改当前气泡的字段。
 *
 * ★ 走 `createBubbleConfig` 归一化一遍再合并:滑块传上来的是字符串,
 *   直接塞进去会让 `bubbleBoxStyle` 拼出 `padding: "12"px` 这种东西 ——
 *   浏览器丢掉整条声明,表现是「拖滑块没反应」,而且不报错。
 */
export function updateBubble(patch = {}, bubbleId = STATE.activeId) {
    const bubble = findById(STATE.bubbles, bubbleId);
    if (!bubble) return null;
    const merged = createBubbleConfig({ ...toPlain(bubble), ...patch });
    for (const [key, value] of Object.entries(merged)) {
        if (key === 'id' || key === 'tails') continue;
        bubble[key] = value;
    }
    bubble.updatedAt = Date.now();
    persistBubble(bubble.id);
    return bubble;
}

export function renameBubble(bubbleId, name) {
    const bubble = findById(STATE.bubbles, bubbleId);
    if (!bubble) return false;
    bubble.name = String(name || '未命名气泡').slice(0, 24) || '未命名气泡';
    bubble.updatedAt = Date.now();
    persistBubble(bubble.id);
    return true;
}

export function toggleStar(bubbleId) {
    const bubble = findById(STATE.bubbles, bubbleId);
    if (!bubble) return;
    bubble.starred = !bubble.starred;
    persistBubble(bubble.id);
}

export async function removeBubble(bubbleId) {
    const index = STATE.bubbles.findIndex((b) => isSameId(b.id, bubbleId));
    if (index === -1) return false;
    STATE.bubbles.splice(index, 1);
    await dbDeleteBubble(_app, bubbleId);
    if (isSameId(STATE.activeId, bubbleId)) {
        const next = STATE.bubbles[0];
        if (next) selectBubble(next.id);
        else { STATE.activeId = ''; STATE.activeTailId = ''; }
    }
    return true;
}

/** 换一侧:圆角和尾巴一起镜像,否则「改成左侧」之后还是右侧的样子 */
export function flipSide(bubbleId = STATE.activeId) {
    const bubble = findById(STATE.bubbles, bubbleId);
    if (!bubble) return;
    const { radiusTL, radiusTR, radiusBR, radiusBL } = bubble;
    bubble.side = bubble.side === 'left' ? 'right' : 'left';
    bubble.radiusTL = radiusTR;
    bubble.radiusTR = radiusTL;
    bubble.radiusBR = radiusBL;
    bubble.radiusBL = radiusBR;
    for (const tail of asArray(bubble.tails)) {
        if (tail.anchor === 'left') tail.anchor = 'right';
        else if (tail.anchor === 'right') tail.anchor = 'left';
        tail.along = 100 - tail.along;
        tail.flipX = !tail.flipX;
    }
    bubble.updatedAt = Date.now();
    persistBubble(bubble.id);
}

// ============================================================
// 圆角
// ============================================================

/**
 * 按联动模式设圆角。
 *
 * - `all`  四角同值
 * - `chat` 「聊天角」:靠说话人那一侧的下角收小,其余三角同值 ——
 *          这是聊天气泡最常见的形状,单独拎出来免得用户每次调四次
 * - `free` 逐角
 */
export function setRadius(corner, value, mode) {
    const bubble = getActive();
    if (!bubble) return;
    const v = clamp(value, 0, 60);
    const m = mode || getSettings().radiusMode;
    if (m === 'all') {
        updateBubble({ radiusTL: v, radiusTR: v, radiusBR: v, radiusBL: v });
        return;
    }
    if (m === 'chat') {
        const small = Math.round(v * 0.3);
        if (bubble.side === 'left') updateBubble({ radiusTL: v, radiusTR: v, radiusBR: v, radiusBL: small });
        else updateBubble({ radiusTL: v, radiusTR: v, radiusBR: small, radiusBL: v });
        return;
    }
    updateBubble({ [corner]: v });
}

/** 联动模式下,滑块该显示哪个值 */
export function radiusOf(bubble, mode) {
    if (!bubble) return 0;
    const m = mode || getSettings().radiusMode;
    if (m === 'chat') return bubble.side === 'left' ? bubble.radiusTL : bubble.radiusTL;
    if (m === 'all') return bubble.radiusTL;
    return bubble.radiusTL;
}

// ============================================================
// 渐变色标
// ============================================================

export function addGradientStop() {
    const bubble = getActive();
    if (!bubble) return;
    const stops = asArray(bubble.gradientStops);
    if (stops.length >= 6) { notify('最多 6 个色标,再多就调不动了'); return; }
    const last = stops[stops.length - 1];
    const prev = stops[stops.length - 2];
    const position = prev ? Math.round((prev.position + last.position) / 2) : 50;
    updateBubble({
        gradientStops: [...stops, {
            id: makeId('stop'),
            color: last?.color || CONTENT_DEFAULTS.gradientStop,
            position,
            opacity: 100,
        }],
    });
}

export function updateGradientStop(stopId, patch = {}) {
    const bubble = getActive();
    if (!bubble) return;
    const stops = asArray(bubble.gradientStops).map((s) => (isSameId(s.id, stopId) ? { ...s, ...patch } : s));
    updateBubble({ gradientStops: stops });
}

export function removeGradientStop(stopId) {
    const bubble = getActive();
    if (!bubble) return;
    const stops = asArray(bubble.gradientStops).filter((s) => !isSameId(s.id, stopId));
    if (stops.length < 2) { notify('至少要留两个色标'); return; }
    updateBubble({ gradientStops: stops });
}

// ============================================================
// 尾巴
// ============================================================

export function addTail(patch = {}) {
    const bubble = getActive();
    if (!bubble) return null;
    if (asArray(bubble.tails).length >= 6) { notify('一个气泡最多 6 条尾巴'); return null; }
    const tail = createTail({
        id: makeId('tail'),
        anchor: bubble.side === 'left' ? 'left' : 'right',
        along: 80,
        ...patch,
    });
    bubble.tails = [...asArray(bubble.tails), tail];
    bubble.updatedAt = Date.now();
    STATE.activeTailId = tail.id;
    persistBubble(bubble.id);
    return tail;
}

export function updateTail(tailId, patch = {}) {
    const bubble = getActive();
    if (!bubble) return;
    bubble.tails = asArray(bubble.tails).map((t) => (isSameId(t.id, tailId) ? createTail({ ...t, ...patch }) : t));
    bubble.updatedAt = Date.now();
    persistBubble(bubble.id);
}

export function removeTail(tailId) {
    const bubble = getActive();
    if (!bubble) return;
    bubble.tails = asArray(bubble.tails).filter((t) => !isSameId(t.id, tailId));
    if (isSameId(STATE.activeTailId, tailId)) {
        STATE.activeTailId = asArray(bubble.tails)[0]?.id || '';
    }
    bubble.updatedAt = Date.now();
    persistBubble(bubble.id);
}

export function selectTail(tailId) {
    STATE.activeTailId = String(tailId || '');
}

// ============================================================
// SVG 工作台
// ============================================================

export function updateSvg(patch = {}) {
    Object.assign(STATE.svg, patch);
    if (patch.source !== undefined) {
        const src = String(patch.source || '').trim();
        // 空输入不算错 —— 一进页面就红着一片会让人以为坏了
        STATE.svg.error = !src || sanitizeSvg(src) ? '' : '这段 SVG 解析不出来,检查一下是不是缺了 <svg> 外层';
    }
}

export function resetSvgTransform() {
    Object.assign(STATE.svg, { rotation: 0, flipX: false, flipY: false });
}

/** 把工作台的成品存进形状库 */
export function saveShape(name) {
    const svg = getSvgResult();
    if (!svg) { notify('还没有可以保存的图形'); return null; }
    if (getShapes().length >= 60) { notify('形状库满了(60 个),先删几个'); return null; }
    const shape = normalizeShape({ id: makeId('svg'), name: name || `形状 ${getShapes().length + 1}`, svg });
    if (!shape.svg) { notify('这段 SVG 消毒之后是空的,换一个试试'); return null; }
    STATE.library.shapes = [shape, ...getShapes()];
    persistLibrary();
    return shape;
}

export function removeShape(shapeId) {
    STATE.library.shapes = getShapes().filter((s) => !isSameId(s.id, shapeId));
    persistLibrary();
    // 引用了这个形状的尾巴会自动回落到内置形状(`tailSvg` 找不到 shapeId 时的行为),
    // 所以这里不需要遍历所有气泡去清引用
}

export function renameShape(shapeId, name) {
    const shape = findById(getShapes(), shapeId);
    if (!shape) return;
    shape.name = String(name || '未命名形状').slice(0, 20);
    persistLibrary();
}

/** 把库里的形状装到当前选中的尾巴上 */
export function applyShapeToTail(shapeId) {
    const tail = getActiveTail();
    if (!tail) { notify('先选一条尾巴,或者先加一条'); return false; }
    updateTail(tail.id, { shapeId: String(shapeId), svg: '' });
    return true;
}

/** 载入形状库里的一条回工作台继续改 */
export function loadShapeToStudio(shapeId) {
    const shape = findById(getShapes(), shapeId);
    if (!shape) return false;
    updateSvg({ source: shape.svg, rotation: 0, flipX: false, flipY: false });
    STATE.tab = 'shape';
    return true;
}

// ============================================================
// 设置 / 主题
// ============================================================

export function updateSettings(patch = {}) {
    Object.assign(STATE.library.settings, patch);
    persistLibrary();
}

export function applyTheme({ baseThemeId, customColors, customThemeId }) {
    const settings = STATE.library.settings;
    if (baseThemeId) settings.theme = baseThemeId;
    settings.customThemeColors = { ...(customColors || {}) };
    settings.activeCustomThemeId = String(customThemeId || '');
    persistLibrary();
}

export function saveCustomTheme({ name, baseThemeId, colors }) {
    const theme = {
        id: makeId('theme'),
        name: String(name || '自定义配色').slice(0, 16),
        baseThemeId: String(baseThemeId || 'porcelain'),
        colors: { ...(colors || {}) },
        createdAt: Date.now(),
    };
    STATE.library.settings.customThemes = [...asArray(STATE.library.settings.customThemes), theme];
    persistLibrary();
    return theme;
}

/**
 * 改一套已保存配色：改名、或者用当前颜色覆盖它。
 *
 * 以前只有「存为新配色」，改一版就多存一条，几次之后列表里躺着五六个
 * 「自定义配色」，谁也认不出哪个是哪个。
 */
export function updateCustomTheme(themeId, patch = {}) {
    const settings = STATE.library.settings;
    const theme = asArray(settings.customThemes).find((t) => isSameId(t.id, themeId));
    if (!theme) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) theme.name = patch.name.trim();
    if (patch.colors && typeof patch.colors === 'object') theme.colors = { ...patch.colors };
    if (patch.baseThemeId) theme.baseThemeId = String(patch.baseThemeId);
    theme.updatedAt = Date.now();
    // 改的正是当前生效的那套 → 顺手让它立刻生效
    if (isSameId(settings.activeCustomThemeId, themeId)) {
        settings.customThemeColors = { ...theme.colors };
        settings.theme = theme.baseThemeId;
    }
    persistLibrary();
    return theme;
}

export function removeCustomTheme(themeId) {
    const settings = STATE.library.settings;
    settings.customThemes = asArray(settings.customThemes).filter((t) => !isSameId(t.id, themeId));
    if (isSameId(settings.activeCustomThemeId, themeId)) settings.activeCustomThemeId = '';
    persistLibrary();
}

// ============================================================
// UI
// ============================================================

export function setTab(tabId) {
    STATE.tab = String(tabId || 'design');
}

export function setSection(sectionId) {
    STATE.openSection = STATE.openSection === sectionId ? '' : String(sectionId || '');
}

export function openModal(type, payload = {}) {
    STATE.modal = { type: String(type), payload };
}

export function closeModal() {
    STATE.modal = null;
}

export function notify(message) {
    STATE.toast = String(message || '');
}

export function clearToast() {
    STATE.toast = '';
}

// ============================================================
// 跨 App 服务
// ============================================================

/** 给情景聊天读:当前库里有哪些气泡(摘要) */
export function listBubbleBriefs() {
    return STATE.bubbles.map((b) => ({
        id: b.id,
        name: b.name,
        side: b.side,
        bgColor: b.bgColor,
        textColor: b.textColor,
        starred: b.starred === true,
        updatedAt: b.updatedAt,
    }));
}
