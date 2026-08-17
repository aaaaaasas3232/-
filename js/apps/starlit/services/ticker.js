/**
 * 点灯 · 悬浮播放引擎（弹幕 / 灵动岛 / 手机壳外的小电视）
 *
 * ── 为什么不用 Vue ────────────────────────────────────────────────
 * 这三样东西都要**画在 App 外面**：
 *   - 弹幕飘在 .phone-screen 上，用户切去别的 App 也照飘
 *   - 小电视挂在 .phone-case 外面（屏幕之外，手机壳上方）
 *   - 灵动岛本来就是系统级的
 * 它们都不属于点灯的组件树，所以这里是一个纯 DOM 单例。
 * 点灯被卸载（用户退出 App）时它们照常运行 —— 这正是「悬浮」的意思。
 *
 * ── 性能 ──────────────────────────────────────────────────────────
 *   - 弹幕节点用对象池复用，同屏上限写死
 *   - 只用 transform 做动画（合成层，不触发重排）
 *   - 页面切到后台（visibilitychange）整个停掉，回来再续
 *   - 一条都没有 / 用户关掉时，容器直接从 DOM 里摘掉，零开销
 */

import { SAFE_INSET, TICKER_DENSITY, TV_SIZE } from '../constants.js';
import { asArray, clamp, dictLine, escapeHtml } from '../utils.js';
import { pickBatch, pickNext } from './srs.js';

const OVERLAY_ID = 'sl-ticker-layer';
const TV_ID = 'sl-tv-box';
const MAX_ON_SCREEN = 16;

const state = {
    entries: [],
    config: null,          // profile.ticker
    islandConfig: null,    // profile.island
    tvConfig: null,        // profile.tv
    running: false,
    timer: null,
    islandTimer: null,
    tvTimer: null,
    recent: [],
    queue: [],
    pool: [],
    live: 0,
    /** 小电视当前显示的条目 + 单词机是否已揭晓 */
    tvCurrent: null,
    tvRevealed: false,
    tvResizing: false,
    /** 外部回调：评分 / 改分区 */
    onGrade: null,
    onBucket: null,
    islandHelper: null,
};

// ============================================================
// 宿主节点
// ============================================================

function screenEl() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('.phone-screen');
}

function phoneEl() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('phone');
}

/** 手机壳被关掉时不允许挂小电视 —— 壳都没有，"贴着壳顶"无从谈起 */
function caseHidden() {
    const phone = phoneEl();
    const box = document.querySelector('.phone-case');
    return Boolean(phone?.classList.contains('phone--fullscreen')
        || box?.classList.contains('phone-case--hidden'));
}

function ensureOverlay() {
    const host = screenEl();
    if (!host) return null;
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.className = 'sl-ticker-layer';
        // 指针事件全关：弹幕绝不能吃掉任何一次点击
        el.setAttribute('aria-hidden', 'true');
        host.appendChild(el);
    } else if (el.parentElement !== host) {
        host.appendChild(el);
    }
    return el;
}

function dropOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    state.pool = [];
    state.live = 0;
}

// ============================================================
// 弹幕
// ============================================================

function densityGap(id) {
    return (TICKER_DENSITY.find((d) => d.id === id) || TICKER_DENSITY[2]).gap;
}

/**
 * 计算这条弹幕出现在哪个高度。
 * 上部要躲开状态栏（50px 的状态栏容器 + 灵动岛），
 * 下部要躲开 Home 指示条 —— 这两条是产品明确要求的。
 */
function laneTop(zone, host) {
    const h = host.clientHeight || 590;
    const top = SAFE_INSET.top;
    const bottom = h - SAFE_INSET.bottom;
    const usable = Math.max(60, bottom - top);

    let lo = top;
    let hi = bottom - 26;
    if (zone === 'top') { lo = top; hi = top + usable * 0.3; } else if (zone === 'middle') { lo = top + usable * 0.34; hi = top + usable * 0.66; } else if (zone === 'bottom') { lo = top + usable * 0.7; hi = bottom - 26; }

    return Math.round(lo + Math.random() * Math.max(1, hi - lo));
}

function takeNode() {
    const node = state.pool.pop();
    if (node) return node;
    const el = document.createElement('div');
    el.className = 'sl-ticker-item';
    return el;
}

function releaseNode(el) {
    el.style.animation = '';
    el.classList.remove('is-run');
    if (state.pool.length < MAX_ON_SCREEN * 2) state.pool.push(el);
    else el.remove();
    state.live = Math.max(0, state.live - 1);
}

function fireOne() {
    const cfg = state.config;
    if (!cfg?.on) return;
    const host = ensureOverlay();
    if (!host) return;
    if (state.live >= MAX_ON_SCREEN) return;

    if (state.queue.length === 0) {
        state.queue = pickBatch(state.entries, 10, {
            recent: state.recent,
            includeMastered: Boolean(cfg.includeMastered),
        });
        if (state.queue.length === 0) return;
    }
    const entry = state.queue.shift();
    if (!entry) return;

    state.recent.push(String(entry.id));
    if (state.recent.length > 20) state.recent.shift();

    const el = takeNode();
    const front = escapeHtml(entry.front || '');
    const pos = entry.pos ? `<i class="sl-ticker-pos">${escapeHtml(entry.pos)}</i>` : '';
    const back = cfg.showBack && entry.back ? `<b class="sl-ticker-back">${escapeHtml(entry.back)}</b>` : '';
    el.innerHTML = `<span class="sl-ticker-front">${front}</span>${pos}${back}`;

    const width = host.clientWidth || 374;
    el.style.top = `${laneTop(cfg.zone, host)}px`;
    el.style.setProperty('--sl-run', `${width + 260}px`);
    const speed = clamp(Number(cfg.speed) || 1, 0.4, 2.4);
    const duration = clamp((width + 260) / (52 * speed), 4, 26);
    el.style.animationDuration = `${duration.toFixed(2)}s`;

    if (!el.isConnected) host.appendChild(el);
    state.live += 1;

    // 强制回流一次再加类，保证从头播（复用节点时必须这么做）
    void el.offsetWidth;
    el.classList.add('is-run');

    const done = () => {
        el.removeEventListener('animationend', done);
        releaseNode(el);
    };
    el.addEventListener('animationend', done);
}

function tick() {
    if (!state.running) return;
    fireOne();
    const gap = densityGap(state.config?.zone === 'all' ? state.config?.density : state.config?.density);
    state.timer = setTimeout(tick, clamp(gap + (Math.random() * gap * 0.4 - gap * 0.2), 260, 30000));
}

// ============================================================
// 灵动岛（逐条播放，像歌词岛）
// ============================================================

/**
 * 自己的岛模板注册到 window.islandTemplates。
 *
 * 每次 show 之前都调一遍，不假设注册顺序 ——
 * framework 在 src/index.js 里是**整体赋值** window.islandTemplates = {...}，
 * 如果只在 setup() 里挂一次，赋值时机不对就会被冲掉，
 * 表现是「岛弹出来是一条空黑条」。
 */
export function ensureIslandTemplate() {
    if (typeof window === 'undefined') return;
    if (!window.islandTemplates) window.islandTemplates = {};
    if (window.islandTemplates['starlit-dict']) return;

    window.islandTemplates['starlit-dict'] = {
        render(size, payload = {}) {
            const front = escapeHtml(payload.front || '');
            const pos = escapeHtml(payload.pos || '');
            const back = escapeHtml(payload.back || '');
            const hint = escapeHtml(payload.hint || '');
            const masked = Boolean(payload.masked);

            if (size === 'mini') {
                return `<div class="sl-isl sl-isl--mini">
                    <span class="sl-isl-dot"></span>
                    <span class="sl-isl-front">${front}</span>
                    ${pos ? `<span class="sl-isl-pos">${pos}</span>` : ''}
                    <span class="sl-isl-back">${masked ? '· · ·' : back}</span>
                </div>`;
            }

            return `<div class="sl-isl sl-isl--medium">
                <div class="sl-isl-main">
                    <div class="sl-isl-term">${front}${pos ? `<i>${pos}</i>` : ''}</div>
                    <div class="sl-isl-mean">${masked ? '想一下…' : back}</div>
                    ${hint && !masked ? `<div class="sl-isl-hint">${hint}</div>` : ''}
                </div>
                <div class="sl-isl-row">
                    ${masked
        ? '<button class="sl-isl-btn sl-isl-btn--wide" data-island-action="reveal">看答案</button>'
        : `<button class="sl-isl-btn" data-island-action="grade-forgot">不记得</button>
                           <button class="sl-isl-btn" data-island-action="grade-fuzzy">模糊</button>
                           <button class="sl-isl-btn" data-island-action="grade-wrong">记错了</button>
                           <button class="sl-isl-btn sl-isl-btn--on" data-island-action="grade-known">记得</button>`}
                </div>
                <div class="sl-isl-row sl-isl-row--sub">
                    <button class="sl-isl-tag" data-island-action="bucket-weak">加到不深刻</button>
                    <button class="sl-isl-tag" data-island-action="bucket-mastered">已经记住了</button>
                    <button class="sl-isl-tag" data-island-action="next">下一条</button>
                </div>
            </div>`;
        },
        bind(container, payload = {}) {
            if (!container) return;
            const actions = payload?.actions || {};
            container.querySelectorAll('[data-island-action]').forEach((btn) => {
                const name = btn.getAttribute('data-island-action');
                btn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    const handler = actions[name];
                    if (typeof handler === 'function') handler({ action: name, payload, event });
                });
            });
        },
    };
}

function islandActions(entry) {
    const send = (gradeId) => () => {
        state.onGrade?.(entry, gradeId);
        showIslandNext();
    };
    return {
        reveal: () => showIsland(entry, false),
        next: () => showIslandNext(),
        'grade-forgot': send('forgot'),
        'grade-fuzzy': send('fuzzy'),
        'grade-wrong': send('wrong'),
        'grade-known': send('known'),
        'bucket-weak': () => { state.onBucket?.(entry, 'weak'); showIslandNext(); },
        'bucket-mastered': () => { state.onBucket?.(entry, 'mastered'); showIslandNext(); },
    };
}

function showIsland(entry, masked) {
    if (!entry || !state.islandHelper) return;
    ensureIslandTemplate();
    state.islandHelper.show('mini', {
        kind: 'dict-ticker',
        title: dictLine(entry),
        message: entry.hint || '',
        islandTemplate: 'starlit-dict',
        // 进行中的活动必须能缩回 mini，否则点三下岛外就把它点没了
        minSize: 'mini',
        lifecycle: 'manual',
        payload: {
            front: entry.front,
            pos: entry.pos,
            back: entry.back,
            hint: entry.hint,
            masked: Boolean(masked),
            actions: islandActions(entry),
        },
    });
}

function showIslandNext() {
    const cfg = state.islandConfig;
    if (!cfg?.on) return;
    const entry = pickNext(state.entries, {
        recent: state.recent,
        includeMastered: Boolean(state.config?.includeMastered),
    });
    if (!entry) return;
    state.recent.push(String(entry.id));
    if (state.recent.length > 20) state.recent.shift();
    showIsland(entry, false);
}

function islandTick() {
    if (!state.running || !state.islandConfig?.on) return;
    showIslandNext();
    state.islandTimer = setTimeout(islandTick, clamp(Number(state.islandConfig.intervalMs) || 6000, 2000, 60000));
}

// ============================================================
// 手机壳外的小电视
// ============================================================

function ensureTv() {
    const host = phoneEl();
    if (!host || caseHidden()) return null;
    let el = document.getElementById(TV_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = TV_ID;
        el.className = 'sl-tv';
        el.innerHTML = `
            <div class="sl-tv-shell">
                <div class="sl-tv-screen" data-sl-tv="screen"></div>
                <div class="sl-tv-foot"><span class="sl-tv-knob"></span><span class="sl-tv-knob"></span></div>
            </div>
            <div class="sl-tv-legs"><i></i><i></i></div>
            <div class="sl-tv-size" data-sl-tv="size"></div>
        `;
        host.appendChild(el);
        bindTvGestures(el);
    } else if (el.parentElement !== host) {
        host.appendChild(el);
    }
    return el;
}

function dropTv() {
    const el = document.getElementById(TV_ID);
    if (el) el.remove();
    state.tvCurrent = null;
}

function renderTv() {
    const el = document.getElementById(TV_ID);
    if (!el) return;
    const screen = el.querySelector('[data-sl-tv="screen"]');
    if (!screen) return;

    const entry = state.tvCurrent;
    if (!entry) {
        screen.innerHTML = '<div class="sl-tv-empty">词典是空的</div>';
        return;
    }

    const drill = state.tvConfig?.mode === 'drill';
    const hide = drill && state.tvConfig?.maskBack && !state.tvRevealed;

    screen.innerHTML = `
        <div class="sl-tv-term">${escapeHtml(entry.front || '')}${entry.pos ? `<i>${escapeHtml(entry.pos)}</i>` : ''}</div>
        <div class="sl-tv-mean ${hide ? 'is-hidden' : ''}">${hide ? '' : escapeHtml(entry.back || '')}</div>
        ${!hide && entry.hint ? `<div class="sl-tv-hint">${escapeHtml(entry.hint)}</div>` : ''}
        ${drill ? `<div class="sl-tv-acts">${hide
        ? '<button data-sl-act="reveal">想好了</button>'
        : `<button data-sl-act="forgot">不记得</button>
                   <button data-sl-act="fuzzy">模糊</button>
                   <button data-sl-act="wrong">记错了</button>
                   <button data-sl-act="known" class="is-on">完全记得</button>`}</div>` : ''}
    `;

    screen.querySelectorAll('[data-sl-act]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const act = btn.getAttribute('data-sl-act');
            if (act === 'reveal') { state.tvRevealed = true; renderTv(); return; }
            state.onGrade?.(entry, act);
            nextTv();
        });
    });
}

function nextTv() {
    const entry = pickNext(state.entries, {
        recent: state.recent,
        includeMastered: Boolean(state.config?.includeMastered),
    });
    state.tvCurrent = entry;
    state.tvRevealed = false;
    if (entry) {
        state.recent.push(String(entry.id));
        if (state.recent.length > 20) state.recent.shift();
    }
    renderTv();
}

/**
 * 设置小电视宽度。
 *
 * 除了 min/max，还有一条硬约束：**不能顶出视口**。
 * 它挂在壳顶上方，壳上面剩多少空间是随窗口高度变的 ——
 * 用户在小窗口里把它拉大，不夹一下就会长到屏幕外面看不见。
 * 两边都用 getBoundingClientRect 量（手机整体可能被 scale 过，
 * offsetHeight 不含缩放，混着用会算错）。
 */
function applyTvSize(width) {
    const el = document.getElementById(TV_ID);
    if (!el) return TV_SIZE.def;
    let w = clamp(width, TV_SIZE.min, TV_SIZE.max);
    el.style.setProperty('--sl-tv-w', `${Math.round(w)}px`);

    const box = document.querySelector('.phone-case');
    if (!box) return w;
    const room = box.getBoundingClientRect().top - 10;
    const h = el.getBoundingClientRect().height;
    if (h > room && h > 1 && room > 0) {
        w = Math.max(TV_SIZE.min, Math.floor(w * (room / h)));
        el.style.setProperty('--sl-tv-w', `${w}px`);
    }
    return w;
}

/** 窗口变小 → 壳上面的空间也变小，要重夹一次 */
function refitTv() {
    if (!state.tvConfig?.on) return;
    applyTvSize(Number(state.tvConfig.width) || TV_SIZE.def);
}

/**
 * 长按调大小。
 * 底边永远贴着壳顶中央，所以只能「对称地」变大变小 ——
 * 往上拖 / 往右拖都是变大，两边同时长出去，中线不动。
 */
function bindTvGestures(el) {
    let pressTimer = null;
    let startW = 0;
    let startX = 0;
    let startY = 0;
    let active = false;

    const label = el.querySelector('[data-sl-tv="size"]');

    const onMove = (e) => {
        if (!active) return;
        e.preventDefault();
        const p = e.touches ? e.touches[0] : e;
        const dx = p.clientX - startX;
        const dy = p.clientY - startY;
        // 向右、向上都算「拉大」，两个方向的贡献相同
        const next = startW + (dx - dy);
        applyTvSize(next);
        if (label) label.textContent = `${Math.round(clamp(next, TV_SIZE.min, TV_SIZE.max))}`;
    };

    const onUp = () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        if (!active) return;
        active = false;
        state.tvResizing = false;
        el.classList.remove('is-sizing');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        // 存被夹过之后的真实宽度，不是手指拖到的那个值
        const w = parseFloat(el.style.getPropertyValue('--sl-tv-w')) || TV_SIZE.def;
        state.tvConfig = { ...(state.tvConfig || {}), width: Math.round(w) };
        state.onResize?.(Math.round(w));
    };

    el.addEventListener('pointerdown', (e) => {
        // 单击（非长按）= 单词机里的「揭晓 / 下一条」
        startX = e.clientX;
        startY = e.clientY;
        startW = parseFloat(getComputedStyle(el).getPropertyValue('--sl-tv-w')) || TV_SIZE.def;
        pressTimer = setTimeout(() => {
            pressTimer = null;
            active = true;
            state.tvResizing = true;
            el.classList.add('is-sizing');
            if (label) label.textContent = `${Math.round(startW)}`;
            document.addEventListener('pointermove', onMove, { passive: false });
            document.addEventListener('pointerup', onUp);
        }, 420);
    });

    el.addEventListener('pointerup', () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            if (state.tvConfig?.mode === 'drill' && !state.tvRevealed) {
                state.tvRevealed = true;
                renderTv();
            }
        }
    });

    el.addEventListener('pointercancel', onUp);
}

function tvTick() {
    if (!state.running || !state.tvConfig?.on) return;
    // 单词机模式下不自动翻页：用户没自评就换掉，等于没练
    if (state.tvConfig.mode !== 'drill') nextTv();
    state.tvTimer = setTimeout(tvTick, clamp(Number(state.tvConfig.intervalMs) || 4200, 1200, 60000));
}

// ============================================================
// 对外
// ============================================================

/**
 * 配置 + 启停。每次用户改设置、或者词典变了，都调这个。
 *
 * @param {object} opts
 * @param {Array}  opts.entries      词典条目
 * @param {object} opts.ticker       弹幕设置
 * @param {object} opts.island       灵动岛设置
 * @param {object} opts.tv           小电视设置
 * @param {object} opts.islandHelper toolkit.island
 * @param {Function} opts.onGrade    (entry, gradeId) => void
 * @param {Function} opts.onBucket   (entry, bucketId) => void
 * @param {Function} opts.onResize   (width) => void
 */
export function configure(opts = {}) {
    if (opts.entries) state.entries = asArray(opts.entries);
    if (opts.ticker) state.config = { ...opts.ticker };
    if (opts.island) state.islandConfig = { ...opts.island };
    if (opts.tv) state.tvConfig = { ...opts.tv };
    if (opts.islandHelper) state.islandHelper = opts.islandHelper;
    if (opts.onGrade) state.onGrade = opts.onGrade;
    if (opts.onBucket) state.onBucket = opts.onBucket;
    if (opts.onResize) state.onResize = opts.onResize;
    // 词典变了，队列里的可能已经被删了
    state.queue = [];
    restart();
}

function stopTimers() {
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    if (state.islandTimer) { clearTimeout(state.islandTimer); state.islandTimer = null; }
    if (state.tvTimer) { clearTimeout(state.tvTimer); state.tvTimer = null; }
}

export function stop() {
    state.running = false;
    stopTimers();
    dropOverlay();
    dropTv();
}

/** 只停动画，不拆 DOM（切后台用） */
function pause() {
    stopTimers();
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.classList.add('is-paused');
}

function resume() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.classList.remove('is-paused');
    if (state.running) {
        if (state.config?.on) tick();
        if (state.islandConfig?.on) islandTick();
        if (state.tvConfig?.on) tvTick();
    }
}

export function restart() {
    stopTimers();
    const anyOn = Boolean(state.config?.on || state.islandConfig?.on || state.tvConfig?.on);
    state.running = anyOn && state.entries.length > 0;

    if (!state.config?.on) dropOverlay(); else ensureOverlay();

    if (!state.tvConfig?.on || caseHidden()) {
        dropTv();
    } else {
        const el = ensureTv();
        if (el) {
            applyTvSize(Number(state.tvConfig.width) || TV_SIZE.def);
            if (!state.tvCurrent) nextTv(); else renderTv();
        }
    }

    if (!state.islandConfig?.on && state.islandHelper) {
        const st = state.islandHelper.getState?.();
        if (st?.content?.islandTemplate === 'starlit-dict') state.islandHelper.dismiss?.();
    }

    if (!state.running) return;
    if (state.config?.on) state.timer = setTimeout(tick, 700);
    if (state.islandConfig?.on) state.islandTimer = setTimeout(islandTick, 900);
    if (state.tvConfig?.on) state.tvTimer = setTimeout(tvTick, Number(state.tvConfig.intervalMs) || 4200);
}

/** 词典内容变了但设置没变 —— 只换数据，不重启动画 */
export function setEntries(entries) {
    state.entries = asArray(entries);
    state.queue = [];
    if (state.tvConfig?.on && !state.entries.some((e) => String(e.id) === String(state.tvCurrent?.id))) {
        nextTv();
    }
}

export function isRunning() {
    return state.running;
}

export function snapshot() {
    return {
        running: state.running,
        live: state.live,
        entries: state.entries.length,
        tvOn: Boolean(state.tvConfig?.on) && !caseHidden(),
        caseHidden: caseHidden(),
    };
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pause();
        else resume();
    });
}

if (typeof window !== 'undefined') {
    let refitTimer = null;
    window.addEventListener('resize', () => {
        if (refitTimer) clearTimeout(refitTimer);
        refitTimer = setTimeout(refitTv, 160);
    });
}
