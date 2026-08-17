/**
 * 手书 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 防抖落盘,照 relax-app / 湛蓝回忆
 * 那套(项目里最成熟的 vue 模式范式)。
 *
 * ── 规矩 ────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`,改状态一律走本文件导出的 mutator。
 *    这样「什么时候该落盘」「什么时候该记撤销」只有一个地方要考虑。
 * 2. hydrate 只用 `_hydrating` 防并发,**不用** `_hydrated` 硬阻断 ——
 *    硬阻断会让首次失败后永远没有第二次机会。
 * 3. 播放循环只改 `STATE.time` 一个字段,画面由组件按 time 现算 ——
 *    「拖进度条」和「播放」于是走的是同一条路径。
 * 4. 撤销栈存的是**整份企划的快照**。剪辑改动往往是连锁的
 *    (拖一个剪辑会推动同轨后面的),存 diff 反而更容易错。
 */

import {
    loadLibrary, saveLibrary, loadProjects, saveProject, deleteProject as dbDeleteProject,
    loadAssets, saveAsset, deleteAsset as dbDeleteAsset,
    normalizeProject, normalizeLibrary, normalizeClip,
} from './services/db.js';
import * as nook from './services/nook-bridge.js';
import * as ai from './services/ai-service.js';
import { buildPrompt, buildUserTurn, collectSources } from './services/prompt-builder.js';
import { parseScript, stringifyClips } from './services/script-parser.js';
import {
    buildTimeline, renderAt, totalDuration, constrainStart, shiftAfter, compactTrack,
} from './services/timeline-engine.js';
import { createDemoProject, createStarterProject } from './services/demo-project.js';
import { allEffects, createUserEffect, normalizeEffect, findEffect } from './presets/effects.js';
import {
    DEFAULT_TRACK_IDS, ZOOM_LEVELS, SNAP_MS, FINE_MS, MIN_CLIP_MS, FRAME_MS,
    UNDO_LIMIT, MAX_PROJECT_MS, MAX_CLIPS, CLIP_DEFAULT_MS, TITLE_MAX,
} from './constants.js';
import {
    makeId, findById, asArray, clamp, debounce, toPlain, truncate, snapMs, formatDuration,
} from './utils.js';

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
    sdkReady: false,

    // ── 数据 ────────────────────────────────
    projects: [],
    library: normalizeLibrary({}),
    assets: [],
    activeProjectId: '',

    // ── 导航 ────────────────────────────────
    /** 'home' | 'watch' | 'editor' */
    view: 'home',
    /** 首页底部 tab */
    tab: 'works',

    // ── 播放 ────────────────────────────────
    playing: false,
    /** 播放头位置(ms)。整个 App 只有这一个「现在是第几毫秒」 */
    time: 0,

    // ── 编辑 ────────────────────────────────
    selectedClipId: '',
    /** 编辑器底部抽屉 id,空 = 收起 */
    panel: '',
    /** 剪辑变更计数 —— 时间轴缓存靠它判失效 */
    clipsVersion: 0,
    undoDepth: 0,
    redoDepth: 0,

    // ── 生成 ────────────────────────────────
    generating: false,
    streamChars: 0,
    genError: '',
    /** 最近一次解析的告警,脚本面板里显示 */
    warnings: [],

    // ── UI ──────────────────────────────────
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

export function getProject() {
    return findById(STATE.projects, STATE.activeProjectId);
}

export function getSettings() {
    return STATE.library.settings;
}

export function getEffects() {
    return allEffects(STATE.library.effects);
}

export function getEffect(id) {
    return findEffect(STATE.library.effects, id);
}

export function getSelectedClip() {
    const project = getProject();
    if (!project) return null;
    return findById(project.clips, STATE.selectedClipId);
}

/**
 * 时间轴(排好序的三条轨)。
 *
 * ★ 带缓存。`renderAt` 每帧都调,如果每次都重新 `buildTimeline`
 *   就等于每帧对全部剪辑排一次序 —— 几百个剪辑时手机上能看出掉帧。
 */
let _tlCache = { key: '', value: null };
export function getTimeline() {
    const project = getProject();
    const key = `${project?.id || ''}::${STATE.clipsVersion}`;
    if (_tlCache.key === key && _tlCache.value) return _tlCache.value;
    const value = buildTimeline(project || {});
    _tlCache = { key, value };
    return value;
}

export function getDuration() {
    return getTimeline().duration;
}

/** 当前这一刻屏幕上是什么 —— 舞台组件唯一的数据来源 */
export function getFrame() {
    return renderAt(getTimeline(), STATE.time);
}

export function getZoom() {
    const idx = clamp(getSettings().zoomIndex, 0, ZOOM_LEVELS.length - 1);
    return ZOOM_LEVELS[Math.round(idx)];
}

export function getGrid() {
    return getSettings().snap ? SNAP_MS : FINE_MS;
}

/** 作者名:企划里存了就用存的,没存就从 nook 现读(nook 改了这边跟着变) */
export function getAuthorName(project) {
    const p = project || getProject();
    if (p?.author) return p.author;
    return nook.getUserCard()?.name || '我';
}

// ============================================================
// 落盘
// ============================================================

const _dirtyProjects = new Set();
let _libraryDirty = false;

const _persist = debounce(async () => {
    if (!_app) return;
    if (_libraryDirty) {
        _libraryDirty = false;
        await saveLibrary(_app, toPlain(STATE.library));
    }
    const ids = [..._dirtyProjects];
    _dirtyProjects.clear();
    for (const id of ids) {
        const project = findById(STATE.projects, id);
        if (project) await saveProject(_app, toPlain(project));
    }
}, 320);

function markProject(id) {
    if (id) _dirtyProjects.add(String(id));
    if (getSettings().autosave !== false) _persist();
}

function markLibrary() {
    _libraryDirty = true;
    _persist();
}

/** 退到后台 / 卸载时把没落完的写掉 */
export async function flushPersist() {
    _persist.flush();
}

// ============================================================
// 撤销
// ============================================================

/**
 * 撤销栈。
 *
 * 存整份企划的 JSON 快照,深度 40(需求要求至少 30)。
 * 一份企划几百个剪辑,一条快照几十 KB,四十条也就一两兆 —— 都在内存里,不落盘。
 */
let _undo = [];
let _redo = [];

function snapshot(label = '') {
    const project = getProject();
    if (!project) return;
    _undo.push({ label, id: project.id, data: JSON.stringify(toPlain(project)) });
    if (_undo.length > UNDO_LIMIT) _undo.shift();
    _redo = [];
    syncUndoDepth();
}

function syncUndoDepth() {
    STATE.undoDepth = _undo.length;
    STATE.redoDepth = _redo.length;
}

function restore(entry) {
    if (!entry) return false;
    const idx = STATE.projects.findIndex((p) => String(p.id) === String(entry.id));
    if (idx === -1) return false;
    try {
        STATE.projects[idx] = normalizeProject(JSON.parse(entry.data));
    } catch (_) {
        return false;
    }
    STATE.clipsVersion += 1;
    markProject(entry.id);
    return true;
}

export function undo() {
    const project = getProject();
    if (!project || !_undo.length) return notify('没有可以撤销的操作');
    const entry = _undo.pop();
    _redo.push({ label: entry.label, id: project.id, data: JSON.stringify(toPlain(project)) });
    if (_redo.length > UNDO_LIMIT) _redo.shift();
    restore(entry);
    syncUndoDepth();
    notify(entry.label ? `已撤销:${entry.label}` : '已撤销');
    return true;
}

export function redo() {
    const project = getProject();
    if (!project || !_redo.length) return notify('没有可以重做的操作');
    const entry = _redo.pop();
    _undo.push({ label: entry.label, id: project.id, data: JSON.stringify(toPlain(project)) });
    restore(entry);
    syncUndoDepth();
    notify('已重做');
    return true;
}

function clearHistory() {
    _undo = [];
    _redo = [];
    syncUndoDepth();
}

// ============================================================
// 提示 / 弹窗
// ============================================================

export function notify(message) {
    STATE.toast = String(message || '');
    return false;
}

export function clearToast() {
    STATE.toast = '';
}

export function openModal(type, payload = {}) {
    STATE.modal = { type: String(type), payload };
}

export function closeModal() {
    STATE.modal = null;
}

// ============================================================
// hydrate
// ============================================================

export async function hydrate(app) {
    if (app) _app = app;
    if (_hydrating) return;
    _hydrating = true;
    try {
        const [library, projects, assets] = await Promise.all([
            loadLibrary(_app),
            loadProjects(_app),
            loadAssets(_app),
        ]);
        STATE.library = library;
        STATE.projects = projects;
        STATE.assets = assets;

        const wanted = library.activeProjectId;
        STATE.activeProjectId = findById(projects, wanted) ? wanted : (projects[0]?.id || '');

        STATE.ready = true;
        STATE.error = '';
    } catch (err) {
        console.warn('[handwrite/store] hydrate 失败', err);
        STATE.error = '读取本地数据失败,试试重新打开';
        STATE.ready = true;
    } finally {
        _hydrating = false;
    }

    // nook 就绪只影响「作者名 / 世界观 / API」,拿不到也不该卡住首屏
    nook.whenReady(6000).then((ok) => { STATE.sdkReady = ok === true; });
}

export function teardown() {
    stop();
    ai.abortAll();
}

// ============================================================
// 导航
// ============================================================

export function setTab(tab) {
    STATE.tab = String(tab || 'works');
}

export function goHome() {
    stop();
    STATE.view = 'home';
    STATE.panel = '';
}

export function openWatch(projectId) {
    const project = findById(STATE.projects, projectId);
    if (!project) return notify('这份企划找不到了');
    setActiveProject(project.id);
    STATE.time = 0;
    STATE.view = 'watch';
    project.plays = (project.plays || 0) + 1;
    markProject(project.id);
    return true;
}

export function openEditor(projectId) {
    const project = findById(STATE.projects, projectId || STATE.activeProjectId);
    if (!project) return notify('这份企划找不到了');
    setActiveProject(project.id);
    stop();
    STATE.view = 'editor';
    STATE.selectedClipId = asArray(project.clips)[0]?.id || '';
    clearHistory();
    return true;
}

export function setActiveProject(id) {
    if (String(STATE.activeProjectId) === String(id)) return;
    stop();
    STATE.activeProjectId = String(id || '');
    STATE.library.activeProjectId = STATE.activeProjectId;
    STATE.time = 0;
    STATE.selectedClipId = '';
    clearHistory();
    markLibrary();
}

export function setPanel(panel) {
    STATE.panel = STATE.panel === panel ? '' : String(panel || '');
}

// ============================================================
// 播放
// ============================================================

let _raf = 0;
let _lastTs = 0;

function loopTick(ts) {
    if (!STATE.playing) return;
    const prev = _lastTs || ts;
    _lastTs = ts;
    const rate = clamp(getSettings().rate, 0.25, 3);
    const next = STATE.time + (ts - prev) * rate;
    const duration = getDuration();

    if (duration <= 0) {
        stop();
        return;
    }
    if (next >= duration) {
        if (getSettings().loop) {
            STATE.time = 0;
        } else {
            STATE.time = duration;
            stop();
            return;
        }
    } else {
        STATE.time = next;
    }
    _raf = requestAnimationFrame(loopTick);
}

export function play() {
    const duration = getDuration();
    if (duration <= 0) return notify('这份企划还是空的,先加几个剪辑');
    if (STATE.playing) return true;
    if (STATE.time >= duration) STATE.time = 0;
    STATE.playing = true;
    _lastTs = 0;
    _raf = requestAnimationFrame(loopTick);
    showPlayingIsland();
    return true;
}

export function pause() {
    if (!STATE.playing) return;
    STATE.playing = false;
    if (_raf) cancelAnimationFrame(_raf);
    _raf = 0;
    dismissIsland();
}

export function stop() {
    STATE.playing = false;
    if (_raf) cancelAnimationFrame(_raf);
    _raf = 0;
    dismissIsland();
}

export function togglePlay() {
    if (STATE.playing) pause();
    else play();
}

export function stopAndRewind() {
    stop();
    STATE.time = 0;
}

export function seek(ms) {
    STATE.time = clamp(Math.round(ms), 0, Math.max(0, getDuration()));
}

export function stepFrame(dir) {
    seek(STATE.time + FRAME_MS * (dir < 0 ? -1 : 1));
}

/** 跳到上/下一个剪辑的起点 —— 比一帧一帧点有用得多 */
export function stepClip(dir) {
    const starts = [...new Set(getTimeline().text.map((c) => c.start))].sort((a, b) => a - b);
    if (!starts.length) return;
    if (dir < 0) {
        const prev = starts.filter((s) => s < STATE.time - 30).pop();
        seek(prev == null ? 0 : prev);
    } else {
        const next = starts.find((s) => s > STATE.time + 30);
        seek(next == null ? getDuration() : next);
    }
}

// ── 灵动岛 ──────────────────────────────────

function showPlayingIsland() {
    const project = getProject();
    if (!project || !_app?.toolkit?.island?.show) return;
    try {
        _app.toolkit.island.show('mini', {
            // ★ 每次 show 都必须带 kind,否则用户在「灵动岛与小组件」里的开关是摆设
            kind: 'hs-playing',
            title: truncate(project.title, 14),
            message: `手书 · ${formatDuration(getDuration())}`,
            // ★ 进行中的活动必须给 minSize,否则点三下岛外会把它点没
            minSize: 'mini',
        });
    } catch (_) { /* 岛不可用不影响播放 */ }
}

function dismissIsland() {
    try { _app?.toolkit?.island?.dismiss?.(); } catch (_) { /* ignore */ }
}

/** 短提示穿透到岛(用户可能已经切走了) */
function islandToast(title, message) {
    try {
        _app?.toolkit?.island?.notify?.('info', title, message, { kind: 'hs-toast' });
    } catch (_) { /* ignore */ }
}

// ============================================================
// 企划:增删改
// ============================================================

export function createProject(patch = {}) {
    const project = createStarterProject({ ...patch, author: '' });
    STATE.projects.unshift(project);
    setActiveProject(project.id);
    markProject(project.id);
    notify('已新建一份手书企划');
    return project;
}

/** 一键示例 —— 空状态里最重要的那个按钮 */
export function createDemo() {
    const project = createDemoProject({ author: '' });
    STATE.projects.unshift(project);
    setActiveProject(project.id);
    markProject(project.id);
    STATE.time = 0;
    STATE.view = 'watch';
    notify('示例企划已生成,正在播放');
    return project;
}

export function duplicateProject(id) {
    const src = findById(STATE.projects, id);
    if (!src) return notify('这份企划找不到了');
    const copy = normalizeProject({
        ...toPlain(src),
        id: makeId('proj'),
        title: truncate(`${src.title} 副本`, TITLE_MAX),
        plays: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    // 剪辑 id 必须换一批,否则两份企划共用 id,选中一个会高亮另一个的
    copy.clips = copy.clips.map((c) => normalizeClip({ ...c, id: makeId('clip') }));
    STATE.projects.unshift(copy);
    markProject(copy.id);
    notify('已复制一份');
    return copy;
}

export async function removeProject(id) {
    const project = findById(STATE.projects, id);
    if (!project) return false;
    STATE.projects = STATE.projects.filter((p) => String(p.id) !== String(id));
    if (String(STATE.activeProjectId) === String(id)) {
        STATE.activeProjectId = STATE.projects[0]?.id || '';
        STATE.library.activeProjectId = STATE.activeProjectId;
        markLibrary();
        STATE.view = 'home';
    }
    _dirtyProjects.delete(String(id));
    await dbDeleteProject(_app, id);
    notify(`已删除「${truncate(project.title, 12)}」`);
    return true;
}

export function updateProject(patch = {}) {
    const project = getProject();
    if (!project) return false;
    Object.assign(project, patch);
    project.updatedAt = Date.now();
    markProject(project.id);
    return true;
}

export function updateStage(patch = {}) {
    const project = getProject();
    if (!project) return false;
    snapshot('改舞台');
    project.stage = { ...project.stage, ...patch };
    markProject(project.id);
    return true;
}

/** murmur 的 `[手书:标题]` 落到这里 */
export function captureTitle(text) {
    const title = truncate(String(text || '').trim(), TITLE_MAX);
    if (!title) return { ok: false, error: '标题是空的' };
    const project = createStarterProject({ title, brief: title });
    STATE.projects.unshift(project);
    markProject(project.id);
    islandToast('手书', `新选题:${title}`);
    return { ok: true, id: project.id, title };
}

/** 给别的 App 读的只读摘要 */
export function readBrief() {
    const project = getProject();
    return {
        count: STATE.projects.length,
        current: project ? { title: project.title, duration: getDuration(), clips: project.clips.length } : null,
    };
}

// ============================================================
// 剪辑
// ============================================================

function bumpClips(project) {
    STATE.clipsVersion += 1;
    project.updatedAt = Date.now();
    markProject(project.id);
}

export function selectClip(id) {
    STATE.selectedClipId = String(id || '');
    const clip = getSelectedClip();
    if (clip) seek(clip.start);
}

export function addClip(patch = {}) {
    const project = getProject();
    if (!project) return null;
    if (project.clips.length >= MAX_CLIPS) return notify(`一份企划最多 ${MAX_CLIPS} 个剪辑`);
    snapshot('新增剪辑');

    const type = String(patch.type || 'type');
    const trackId = patch.trackId
        || (type === 'effect' ? DEFAULT_TRACK_IDS.effect : type === 'bg' ? DEFAULT_TRACK_IDS.bg : DEFAULT_TRACK_IDS.text);
    const start = Number.isFinite(patch.start) ? Math.max(0, Math.round(patch.start)) : STATE.time;

    const clip = normalizeClip({
        id: makeId('clip'),
        trackId,
        type,
        start,
        duration: patch.duration || CLIP_DEFAULT_MS[type] || 1000,
        text: patch.text || (type === 'type' ? '新的一句' : ''),
        count: patch.count || (type === 'delete' ? 1 : 0),
        from: patch.from || '',
        to: patch.to || '',
        effectId: patch.effectId || '',
        backdrop: patch.backdrop || '',
    });
    // 文字轨不许重叠(见 timeline-engine 的注释)
    clip.start = constrainStart(project.clips, clip, clip.start, { max: MAX_PROJECT_MS });

    project.clips.push(clip);
    STATE.selectedClipId = clip.id;
    bumpClips(project);
    return clip;
}

export function updateClip(id, patch = {}, opts = {}) {
    const project = getProject();
    if (!project) return false;
    const clip = findById(project.clips, id);
    if (!clip) return false;
    if (opts.snapshot !== false) snapshot(opts.label || '改剪辑');

    if (patch.text != null) clip.text = String(patch.text);
    if (patch.from != null) clip.from = String(patch.from);
    if (patch.to != null) clip.to = String(patch.to);
    if (patch.effectId != null) clip.effectId = String(patch.effectId);
    if (patch.backdrop != null) clip.backdrop = String(patch.backdrop);
    if (patch.count != null) clip.count = Math.max(0, Math.round(patch.count));
    if (patch.duration != null) {
        clip.duration = clamp(Math.round(patch.duration), MIN_CLIP_MS, MAX_PROJECT_MS);
    }
    if (patch.start != null) {
        clip.start = constrainStart(project.clips, clip, patch.start, { max: MAX_PROJECT_MS });
    }
    if (patch.style !== undefined) {
        clip.style = patch.style ? { ...(clip.style || {}), ...patch.style } : null;
    }

    // 打字类剪辑改了文字之后,如果用户没手动定过时长,顺手按字数重算
    if (patch.text != null && patch.duration == null && clip.type === 'type' && opts.autoDuration !== false) {
        clip.duration = clamp(Math.max(MIN_CLIP_MS, clip.text.length * 130), MIN_CLIP_MS, MAX_PROJECT_MS);
    }

    bumpClips(project);
    return true;
}

/**
 * 拖动 / 缩放中每帧调用。
 *
 * ★ **不吸附、不记撤销**。吸附由调用方(时间轴组件)在算几何时做完 ——
 *   这里再吸附一次会出现「左边缘吸了、右边缘跟着动」的橡皮筋现象。
 *   撤销由 `beginGesture` 在手势开始时记一次,不是每帧一条。
 *
 * 传入的是**绝对值**而不是增量:增量式累加会把每一帧的夹取误差攒起来,
 * 手指来回蹭几下剪辑就漂了。
 */
export function setClipGeometry(id, { start, duration } = {}) {
    const project = getProject();
    if (!project) return;
    const clip = findById(project.clips, id);
    if (!clip) return;
    if (duration != null) clip.duration = clamp(Math.round(duration), MIN_CLIP_MS, MAX_PROJECT_MS);
    if (start != null) clip.start = constrainStart(project.clips, clip, Math.round(start), { max: MAX_PROJECT_MS });
    STATE.clipsVersion += 1;
}

/** 拖动 / 缩放开始前调一次,把当前状态压进撤销栈 */
export function beginGesture(label) {
    snapshot(label || '调整剪辑');
}

export function endGesture() {
    const project = getProject();
    if (project) bumpClips(project);
}

export function removeClip(id) {
    const project = getProject();
    if (!project) return false;
    const clip = findById(project.clips, id);
    if (!clip) return false;
    snapshot('删除剪辑');
    project.clips = project.clips.filter((c) => String(c.id) !== String(id));
    if (String(STATE.selectedClipId) === String(id)) STATE.selectedClipId = '';
    bumpClips(project);
    notify('已删除这个剪辑');
    return true;
}

export function duplicateClip(id) {
    const project = getProject();
    if (!project) return false;
    const clip = findById(project.clips, id);
    if (!clip) return false;
    snapshot('复制剪辑');
    const copy = normalizeClip({ ...toPlain(clip), id: makeId('clip'), start: clip.start + clip.duration });
    copy.start = constrainStart(project.clips, copy, copy.start, { max: MAX_PROJECT_MS });
    project.clips.push(copy);
    STATE.selectedClipId = copy.id;
    bumpClips(project);
    notify('已复制这个剪辑');
    return true;
}

/**
 * 在播放头处分割选中的剪辑。
 *
 * 打字剪辑按**字数比例**切,不是按时间对半 —— 时间对半会把
 * 「打三个字」切成「打一个半字」,而半个字是不存在的。
 */
export function splitClip(id, at) {
    const project = getProject();
    if (!project) return false;
    const clip = findById(project.clips, id || STATE.selectedClipId);
    if (!clip) return notify('先选中一个剪辑');
    const t = Math.round(at == null ? STATE.time : at);
    if (t <= clip.start + MIN_CLIP_MS || t >= clip.start + clip.duration - MIN_CLIP_MS) {
        return notify('播放头要落在这个剪辑中间才能分割');
    }
    snapshot('分割剪辑');

    const ratio = (t - clip.start) / clip.duration;
    const rightStart = t;
    const rightDuration = clip.start + clip.duration - t;

    const right = normalizeClip({
        ...toPlain(clip),
        id: makeId('clip'),
        start: rightStart,
        duration: rightDuration,
    });

    if (clip.type === 'type' && clip.text.length > 1) {
        const cut = clamp(Math.round(clip.text.length * ratio), 1, clip.text.length - 1);
        right.text = clip.text.slice(cut);
        clip.text = clip.text.slice(0, cut);
    } else if ((clip.type === 'delete' || clip.type === 'clear') && clip.count > 1) {
        const cut = clamp(Math.round(clip.count * ratio), 1, clip.count - 1);
        right.count = clip.count - cut;
        clip.count = cut;
    }

    clip.duration = t - clip.start;
    project.clips.push(right);
    STATE.selectedClipId = right.id;
    bumpClips(project);
    notify('已分割');
    return true;
}

/** 把文字轨首尾相接排好(消掉空隙和重叠) */
export function compactTimeline() {
    const project = getProject();
    if (!project) return false;
    snapshot('整理时间轴');
    project.clips = compactTrack(project.clips, DEFAULT_TRACK_IDS.text).map(normalizeClip);
    bumpClips(project);
    notify('文字轨已首尾相接');
    return true;
}

/** 在某一刻之后整体挪动文字轨(插入空白 / 合拢) */
export function shiftTimeline(fromTime, deltaMs) {
    const project = getProject();
    if (!project) return false;
    snapshot(deltaMs > 0 ? '插入空白' : '合拢');
    project.clips = shiftAfter(project.clips, fromTime, deltaMs, DEFAULT_TRACK_IDS.text).map(normalizeClip);
    bumpClips(project);
    return true;
}

// ============================================================
// 脚本 ⇄ 剪辑
// ============================================================

export function setScript(text) {
    const project = getProject();
    if (!project) return false;
    project.script = String(text || '');
    markProject(project.id);
    return true;
}

/**
 * 把脚本映射成剪辑,**整轨替换**。
 *
 * ★ 不做增量合并。脚本改一行,后面所有剪辑的时间都会变 ——
 *   「智能合并」听起来好,实际结果是用户手动调过的位置被悄悄改掉,
 *   而他不知道是哪一步弄的。整轨替换至少是可预期的,
 *   撤销栈也让它可以一键回去。
 */
export function applyScript(text, opts = {}) {
    const project = getProject();
    if (!project) return { ok: false, error: '没有打开的企划' };
    const script = String(text == null ? project.script : text);
    const parsed = parseScript(script, { effects: STATE.library.effects });

    if (!parsed.clips.length) {
        STATE.warnings = parsed.warnings;
        return { ok: false, error: '这份脚本没有解析出任何内容,看看是不是全被注释掉了' };
    }
    if (parsed.clips.length > MAX_CLIPS) {
        return { ok: false, error: `解析出 ${parsed.clips.length} 个剪辑,超过上限 ${MAX_CLIPS},把脚本拆短一点` };
    }

    snapshot('应用脚本');
    project.script = script;
    project.clips = parsed.clips.map(normalizeClip);
    STATE.warnings = parsed.warnings;
    STATE.selectedClipId = project.clips[0]?.id || '';
    STATE.time = 0;
    bumpClips(project);

    if (opts.silent !== true) {
        notify(parsed.warnings.length
            ? `已映射 ${parsed.clips.length} 个剪辑,有 ${parsed.warnings.length} 条提醒`
            : `已映射 ${parsed.clips.length} 个剪辑`);
    }
    return { ok: true, clips: parsed.clips.length, warnings: parsed.warnings };
}

/** 反向:把时间轴倒回成脚本(用户只拖不写时用) */
export function syncScriptFromClips() {
    const project = getProject();
    if (!project) return false;
    project.script = stringifyClips(project.clips, { effects: getEffects() });
    markProject(project.id);
    notify('已按时间轴重新生成脚本');
    return true;
}

// ============================================================
// 效果预设
// ============================================================

export function addEffect(patch = {}) {
    const fx = createUserEffect({ ...patch, id: makeId('ufx'), name: patch.name || '我的预设' });
    STATE.library.effects.push(fx);
    markLibrary();
    notify(`已新建预设「${fx.name}」`);
    return fx;
}

export function updateEffect(id, patch = {}) {
    const idx = STATE.library.effects.findIndex((e) => String(e.id) === String(id));
    if (idx === -1) return notify('内置预设不能改,复制一份再调');
    STATE.library.effects[idx] = normalizeEffect({ ...STATE.library.effects[idx], ...patch, id }, { builtin: false });
    markLibrary();
    return true;
}

export function duplicateEffect(id) {
    const src = findEffect(STATE.library.effects, id);
    if (!src) return notify('找不到这个预设');
    const fx = createUserEffect({
        ...toPlain(src),
        id: makeId('ufx'),
        name: truncate(`${src.name} 副本`, 20),
        createdAt: Date.now(),
    });
    STATE.library.effects.push(fx);
    markLibrary();
    notify(`已复制成「${fx.name}」,可以随便改`);
    return fx;
}

export function removeEffect(id) {
    const fx = STATE.library.effects.find((e) => String(e.id) === String(id));
    if (!fx) return notify('内置预设不能删');
    STATE.library.effects = STATE.library.effects.filter((e) => String(e.id) !== String(id));
    // 用到它的剪辑要清掉引用,否则舞台会去找一个不存在的预设(不报错,只是没效果)
    let touched = 0;
    for (const project of STATE.projects) {
        for (const clip of project.clips) {
            if (String(clip.effectId) === String(id)) {
                clip.effectId = '';
                touched += 1;
                markProject(project.id);
            }
        }
    }
    STATE.clipsVersion += 1;
    markLibrary();
    notify(touched ? `已删除,顺带清掉 ${touched} 处引用` : '已删除这个预设');
    return true;
}

// ============================================================
// 设置 / 上下文
// ============================================================

export function setSetting(key, value) {
    if (!key) return false;
    STATE.library.settings[key] = value;
    markLibrary();
    return true;
}

export function zoomBy(delta) {
    const next = clamp(getSettings().zoomIndex + delta, 0, ZOOM_LEVELS.length - 1);
    setSetting('zoomIndex', next);
}

export function toggleContextSection(id) {
    const project = getProject();
    if (!project) return false;
    const config = { ...project.contextConfig };
    config[id] = config[id] === false;
    project.contextConfig = config;
    markProject(project.id);
    return true;
}

export function addCustomPrompt() {
    const project = getProject();
    if (!project) return null;
    const item = { id: makeId('cp'), title: '', content: '', enabled: true };
    project.customPrompts.push(item);
    markProject(project.id);
    return item;
}

export function updateCustomPrompt(id, patch = {}) {
    const project = getProject();
    if (!project) return false;
    const item = findById(project.customPrompts, id);
    if (!item) return false;
    Object.assign(item, patch);
    markProject(project.id);
    return true;
}

export function removeCustomPrompt(id) {
    const project = getProject();
    if (!project) return false;
    project.customPrompts = project.customPrompts.filter((p) => String(p.id) !== String(id));
    markProject(project.id);
    return true;
}

// ============================================================
// 素材
// ============================================================

export async function addAsset(asset) {
    const record = { id: makeId('asset'), createdAt: Date.now(), ...asset };
    const ok = await saveAsset(_app, record);
    if (!ok) return notify('这个文件存不进去,换一张试试');
    STATE.assets.push(record);
    notify('已存进素材库');
    return record;
}

export async function removeAsset(id) {
    STATE.assets = STATE.assets.filter((a) => String(a.id) !== String(id));
    await dbDeleteAsset(_app, id);
    notify('已删除素材');
    return true;
}

// ============================================================
// AI 生成
// ============================================================

/** 提示词面板预览用:**不写快照**,免得把真正发出去的那份冲掉 */
export function previewPrompt() {
    const project = getProject();
    if (!project) return { text: '', parts: [], stats: {} };
    const sources = collectSources({ project, library: STATE.library });
    return buildPrompt({ project, library: STATE.library, sources }, { save: false });
}

export function describeApi() {
    const card = nook.getUserCard();
    const ref = nook.resolveApiRef(card);
    return { ref, info: nook.describeApiRef(ref), missing: ref ? '' : nook.describeMissingApi() };
}

/**
 * 让 AI 写脚本。
 *
 * @param {object} opts
 * @param {'create'|'continue'|'rewrite'|'polish'} [opts.kind]
 * @param {string} [opts.brief]
 * @param {number} [opts.seconds]
 * @param {boolean} [opts.apply] 拿到结果直接映射成剪辑(默认 true)
 */
export async function generateScript(opts = {}) {
    const project = getProject();
    if (!project) return { ok: false, error: '没有打开的企划' };
    if (STATE.generating) return { ok: false, error: '正在生成,先等这次跑完' };

    const { ref, missing } = describeApi();
    if (!ref) {
        STATE.genError = missing;
        return { ok: false, error: missing };
    }

    const brief = String(opts.brief ?? project.brief ?? '').trim();
    if (brief && brief !== project.brief) {
        project.brief = brief.slice(0, 500);
        markProject(project.id);
    }

    const sources = collectSources({ project, library: STATE.library });
    const { text: systemPrompt } = buildPrompt({ project, library: STATE.library, sources });
    const userTurn = buildUserTurn({
        kind: opts.kind || 'create',
        brief,
        seconds: opts.seconds,
        selection: opts.selection,
    });

    STATE.generating = true;
    STATE.streamChars = 0;
    STATE.genError = '';

    const signal = ai.createAbort('script');
    const useStream = getSettings().stream !== false;

    const result = await ai.generate({
        apiRef: ref,
        systemPrompt,
        userTurn,
        temperature: getSettings().temperature,
        stream: useStream,
        signal,
        onChunk: useStream ? (_delta, full) => { STATE.streamChars = String(full || '').length; } : undefined,
    });

    ai.releaseAbort('script');
    STATE.generating = false;

    if (result.aborted) {
        notify('已停止生成');
        if (!result.text) return { ok: false, aborted: true, error: '' };
    } else if (!result.ok) {
        STATE.genError = result.error;
        return { ok: false, error: result.error };
    }

    const script = stripLeadingChatter(result.text);
    if (!script) {
        STATE.genError = 'AI 只回了一段说明,没给脚本。再试一次,或者换个说法';
        return { ok: false, error: STATE.genError };
    }

    if (opts.apply === false) {
        setScript(script);
        return { ok: true, script };
    }
    const applied = applyScript(script, { silent: true });
    if (!applied.ok) {
        setScript(script);
        STATE.genError = applied.error;
        return { ok: false, error: applied.error, script };
    }
    islandToast('手书', `脚本已生成 · ${applied.clips} 个剪辑`);
    notify(`生成好了,映射出 ${applied.clips} 个剪辑`);
    return { ok: true, script, clips: applied.clips };
}

export function abortGenerate() {
    ai.abort('script');
    STATE.generating = false;
}

/**
 * 剥掉模型爱加的围栏和开场白。
 *
 * 不剥的话「好的,这是为你写的手书脚本:」会变成屏幕上第一行字,
 * 而用户看到的现象是「开头多了一句奇怪的话」,根本想不到是这里。
 */
function stripLeadingChatter(raw) {
    let text = String(raw || '').trim();
    const fence = text.match(/```(?:[a-z]*)\s*\n([\s\S]*?)```/i);
    if (fence) text = fence[1];
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    while (lines.length) {
        const first = lines[0].trim();
        if (!first) { lines.shift(); continue; }
        // 第一行既不是指令、也不是注释、还以冒号结尾 → 多半是「好的,这是…:」
        const isDirective = /^[【\[@#]/.test(first) || first.startsWith('//');
        if (!isDirective && /[:：]\s*$/.test(first)) { lines.shift(); continue; }
        break;
    }
    return lines.join('\n').trim();
}

// ============================================================
// 只读工具(组件里要用,收在这里免得各自 import 引擎)
// ============================================================

export { renderAt, totalDuration };
