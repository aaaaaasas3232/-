/**
 * 手书 · 时间轴引擎(时间 → 画面状态)
 *
 * ★ 本文件**零依赖、纯函数**。不 import 任何东西,不碰 DOM、不碰 store。
 *
 * ============================================================
 * 一、为什么是「重放」而不是「逐帧推进」
 * ============================================================
 *
 * 最容易想到的做法是:播放器每帧调一次 `step()`,内部维护一个可变的
 * 文字缓冲区往前推。这么写有三个必然会踩的坑:
 *
 *   1. **拖进度条就废了**。往回拖需要「反向执行」删除操作 —— 而删除是有损的,
 *      退掉的字没地方找回来。实际表现是往回拖之后文字全乱。
 *   2. **掉帧会累积误差**。手机上切个 App 回来,少跑了 20 帧,画面就永远对不上了。
 *   3. **时间轴上拖动剪辑之后画面不刷新**,除非从头再放一遍。
 *
 * 所以这里反过来:`renderAt(timeline, t)` 是一个**纯函数**,
 * 给任意时刻 t 都直接从 0 重放一遍算出画面。
 *
 *   - 拖进度条 = 换个 t 再算一次,天然正确
 *   - 掉帧无所谓,下一帧照样算得准
 *   - 时间轴改完直接重算,不需要任何「同步」逻辑
 *
 * 重放的代价:O(剪辑数)。一份手书企划撑死几百个剪辑,60fps 下完全无压力
 * (对比:每帧都要做的字符串拼接才是真开销,而那部分两种做法都躲不掉)。
 *
 * ============================================================
 * 二、两类轨道
 * ============================================================
 *
 *   文字轨(有状态)  剪辑是对同一个缓冲区的顺序操作,必须从头重放
 *   效果轨 / 背景轨(无状态)  只看 t 落在谁的区间里,不需要重放
 */

const TRACK_TEXT = 'trk-text';
const TRACK_EFFECT = 'trk-effect';
const TRACK_BG = 'trk-bg';

// ============================================================
// 1. 预处理
// ============================================================

function byStart(a, b) {
    if (a.start !== b.start) return a.start - b.start;
    return String(a.id).localeCompare(String(b.id));
}

/**
 * 把企划里的剪辑整理成引擎要的形状。
 *
 * 每次时间轴变动调一次就够了(store 里是个 computed);
 * `renderAt` 每帧调,所以排序这类活儿不能放在它里面。
 */
export function buildTimeline(project = {}) {
    const all = Array.isArray(project.clips) ? project.clips : [];
    const text = [];
    const effect = [];
    const bg = [];

    for (const raw of all) {
        if (!raw || !raw.id) continue;
        const clip = {
            id: String(raw.id),
            trackId: String(raw.trackId || TRACK_TEXT),
            type: String(raw.type || 'type'),
            start: Math.max(0, Math.round(Number(raw.start) || 0)),
            duration: Math.max(1, Math.round(Number(raw.duration) || 1)),
            text: String(raw.text || ''),
            count: Math.max(0, Math.round(Number(raw.count) || 0)),
            from: String(raw.from || ''),
            to: String(raw.to || ''),
            effectId: String(raw.effectId || ''),
            backdrop: String(raw.backdrop || ''),
            style: raw.style && typeof raw.style === 'object' ? raw.style : null,
        };
        if (clip.trackId === TRACK_EFFECT) effect.push(clip);
        else if (clip.trackId === TRACK_BG) bg.push(clip);
        else text.push(clip);
    }

    text.sort(byStart);
    effect.sort(byStart);
    bg.sort(byStart);

    const duration = all.reduce(
        (max, c) => Math.max(max, (Number(c?.start) || 0) + (Number(c?.duration) || 0)),
        0,
    );

    return { text, effect, bg, duration: Math.round(duration) };
}

/** 整条片子多长 */
export function totalDuration(clips) {
    return (Array.isArray(clips) ? clips : []).reduce(
        (max, c) => Math.max(max, (Number(c?.start) || 0) + (Number(c?.duration) || 0)),
        0,
    );
}

// ============================================================
// 2. 单个操作
// ============================================================

/** 0~1,且永远落在闭区间里 —— 浮点误差不该让最后一个字打不出来 */
function ratio(t, clip) {
    if (t >= clip.start + clip.duration) return 1;
    if (t <= clip.start) return 0;
    return (t - clip.start) / clip.duration;
}

/**
 * 把一个剪辑作用在缓冲区上。
 *
 * @param {string} buffer 当前文字
 * @param {object} clip
 * @param {number} p      这个剪辑的进度 0~1
 * @returns {{ text:string, typedFrom:number, typing:boolean }}
 *   `typedFrom` = 这一步之前已经有多少字。舞台靠它区分「老字」和「刚出来的字」,
 *   逐字弹入 / 打字光标都要用。
 */
function applyClip(buffer, clip, p) {
    switch (clip.type) {
        case 'type': {
            const n = Math.floor(p * clip.text.length + 1e-6);
            return { text: buffer + clip.text.slice(0, n), typedFrom: buffer.length, typing: p < 1 };
        }
        case 'delete':
        case 'clear': {
            const total = clip.count || clip.text.length;
            const n = Math.floor(p * total + 1e-6);
            const keep = Math.max(0, buffer.length - n);
            return { text: buffer.slice(0, keep), typedFrom: keep, typing: p < 1 };
        }
        case 'replace': {
            // 前半段删旧、后半段打新,分界按两边字数加权 ——
            // 「删 1 个字打 20 个字」时不该在正中间切,否则打字看起来快得离谱
            const delLen = Math.min(buffer.length, clip.count || clip.from.length);
            const addLen = clip.to.length;
            const totalLen = delLen + addLen;
            const split = totalLen > 0 ? delLen / totalLen : 0.5;
            const base = buffer.slice(0, Math.max(0, buffer.length - delLen));
            if (p <= split) {
                const q = split > 0 ? p / split : 1;
                const n = Math.floor(q * delLen + 1e-6);
                const keep = Math.max(0, buffer.length - n);
                return { text: buffer.slice(0, keep), typedFrom: keep, typing: true };
            }
            const q = split < 1 ? (p - split) / (1 - split) : 1;
            const n = Math.floor(q * addLen + 1e-6);
            return { text: base + clip.to.slice(0, n), typedFrom: base.length, typing: p < 1 };
        }
        case 'hold':
        default:
            return { text: buffer, typedFrom: buffer.length, typing: false };
    }
}

// ============================================================
// 3. 取某一刻的画面
// ============================================================

/**
 * 算出 t 时刻屏幕上是什么。
 *
 * @param {{text:Array, effect:Array, bg:Array, duration:number}} timeline
 * @param {number} t 毫秒
 * @returns {{
 *   time:number, duration:number, text:string, typedFrom:number,
 *   typing:boolean, activeClip:object|null, activeClipId:string,
 *   effects:Array, backdrop:string, ended:boolean
 * }}
 */
export function renderAt(timeline, t) {
    const tl = timeline || { text: [], effect: [], bg: [], duration: 0 };
    const time = Math.max(0, Math.round(Number(t) || 0));

    let buffer = '';
    let typedFrom = 0;
    let typing = false;
    let activeClip = null;

    for (const clip of tl.text) {
        // 文字轨按 start 排过序,遇到第一个还没开始的就可以收工
        const p = ratio(time, clip);
        if (p <= 0) break;
        const res = applyClip(buffer, clip, p);
        buffer = res.text;
        typedFrom = res.typedFrom;
        if (p < 1) {
            typing = res.typing;
            activeClip = clip;
            break;
        }
        typing = false;
    }
    // 所有剪辑都放完了:此刻没有「刚打出来的字」,否则逐字动画会一直停在最后一步
    if (!activeClip) typedFrom = buffer.length;

    // 无状态轨:落在区间里就算命中
    const effects = [];
    for (const clip of tl.effect) {
        if (clip.start > time) break;
        if (time >= clip.start + clip.duration) continue;
        effects.push({
            id: clip.effectId,
            clipId: clip.id,
            progress: ratio(time, clip),
        });
    }

    // 文字剪辑自带的效果也算数(脚本里【抖动】打字 会两边都写上)
    if (activeClip?.effectId && !effects.some((e) => e.id === activeClip.effectId)) {
        effects.push({ id: activeClip.effectId, clipId: activeClip.id, progress: ratio(time, activeClip) });
    }

    let backdrop = '';
    for (const clip of tl.bg) {
        if (clip.start > time) break;
        if (time >= clip.start + clip.duration) continue;
        backdrop = clip.backdrop;
    }

    return {
        time,
        duration: tl.duration,
        text: buffer,
        typedFrom,
        typing,
        activeClip,
        activeClipId: activeClip ? activeClip.id : '',
        effects,
        backdrop,
        ended: tl.duration > 0 && time >= tl.duration,
    };
}

// ============================================================
// 4. 时间轴 UI 要用的几何工具
// ============================================================

/** 找 t 时刻某条轨上的剪辑(点击轨道空白处新建时用来判重叠) */
export function clipAt(clips, trackId, t) {
    const time = Number(t) || 0;
    return (Array.isArray(clips) ? clips : []).find(
        (c) => c && String(c.trackId) === String(trackId) && time >= c.start && time < c.start + c.duration,
    ) || null;
}

/**
 * 把一段区间限制在「不和同轨其他剪辑重叠」的范围内。
 *
 * ★ 只对**文字轨**强制。文字轨是有状态的,两个剪辑重叠意味着
 *   同一时刻有两个操作在改同一个缓冲区,结果取决于数组顺序 ——
 *   用户拖出来的画面会变得无法预测。效果轨反过来,重叠是刚需
 *   (抖动 + 发光同时挂),所以那两条轨不做这个限制。
 */
export function constrainStart(clips, clip, nextStart, opts = {}) {
    const min = 0;
    const max = Number.isFinite(opts.max) ? opts.max : Number.MAX_SAFE_INTEGER;
    let start = Math.max(min, Math.min(max, Math.round(nextStart)));
    if (String(clip.trackId) !== TRACK_TEXT) return start;

    const siblings = (Array.isArray(clips) ? clips : [])
        .filter((c) => c && c.id !== clip.id && c.trackId === clip.trackId)
        .sort(byStart);

    const end = start + clip.duration;
    for (const other of siblings) {
        const oEnd = other.start + other.duration;
        if (end <= other.start || start >= oEnd) continue;
        // 撞上了:往近的一边推
        const pushLeft = other.start - clip.duration;
        const pushRight = oEnd;
        start = Math.abs(pushLeft - start) <= Math.abs(pushRight - start)
            ? Math.max(0, pushLeft)
            : pushRight;
        return start;
    }
    return start;
}

/**
 * 把文字轨上从某一刻起的所有剪辑整体平移。
 *
 * 插入 / 删除剪辑之后要用它「合拢」,否则文字轨上会留一段空白 ——
 * 空白本身不报错,但缓冲区在那一段是冻结的,看起来像卡住了。
 */
export function shiftAfter(clips, fromTime, deltaMs, trackId = TRACK_TEXT) {
    const delta = Math.round(deltaMs);
    if (!delta) return clips;
    return (Array.isArray(clips) ? clips : []).map((c) => {
        if (!c || c.trackId !== trackId) return c;
        if (c.start < fromTime) return c;
        return { ...c, start: Math.max(0, c.start + delta) };
    });
}

/**
 * 把文字轨首尾相接地重排(消掉所有空隙和重叠)。
 * 「整理时间轴」按钮调它;不自动跑 —— 用户故意留的停顿不该被吃掉。
 */
export function compactTrack(clips, trackId = TRACK_TEXT) {
    const list = (Array.isArray(clips) ? clips : []).slice();
    const target = list.filter((c) => c && c.trackId === trackId).sort(byStart);
    let cursor = 0;
    const moved = new Map();
    for (const c of target) {
        moved.set(c.id, cursor);
        cursor += c.duration;
    }
    return list.map((c) => (moved.has(c?.id) ? { ...c, start: moved.get(c.id) } : c));
}

export default { buildTimeline, renderAt, totalDuration, clipAt, constrainStart, shiftAfter, compactTrack };
