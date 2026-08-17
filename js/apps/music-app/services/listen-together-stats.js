/**
 * music-app · services/listen-together-stats.js
 *
 * 「一起听」的**跨会话累计**账本：和某个 AI 一共听了多久、一起听过哪些歌、每首几次。
 *
 * 为什么单独一份而不是复用 listenTogetherSessions（IndexedDB）：
 *   - session 表是「一次会话一条记录」，要算累计得把所有记录读出来再聚合，
 *     而 prompt 上下文是**每次发消息都要现算**的，不能等 async IndexedDB。
 *   - session 表里没有「哪首歌听了几次」这一维度，只有 songCount 总数。
 *   - 播放次数（state.js 的 play-count）是**全局**的，不区分是不是跟 AI 一起听的，
 *     "我们一起听过这首 3 次" 和 "你自己听过这首 30 次" 是两个意思。
 *
 * 存储：localStorage['xiaoting::music-lt-stats-v1']
 *   {
 *     [aiId]: {
 *       totalMs,    // 已结算的累计时长
 *       sessions,   // 结束过的会话数
 *       firstAt, lastAt,
 *       songs: { [songId]: { title, artist, count, lastAt } }
 *     }
 *   }
 *
 * 时长结算策略（踩过的坑：只在 endSession 里加，用户直接关页面就全丢了）：
 *   - 会话进行中，ticker 每 15 秒调一次 `checkpoint(aiId)`，把「距上次结算的增量」写进 totalMs
 *   - 会话结束时再 checkpoint 一次收尾
 *   - 于是最多只丢最后 15 秒
 */

const STORAGE_KEY = 'xiaoting::music-lt-stats-v1';
const CHECKPOINT_INTERVAL_MS = 15000;

let _cache = null;
// 运行中会话的结算游标：{ aiId, at }
let _cursor = null;

function _load() {
    if (_cache) return _cache;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        _cache = (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        _cache = {};
    }
    return _cache;
}

function _save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache || {}));
    } catch (_) { /* 配额满了就算了，统计不是关键数据 */ }
}

function _entry(aiId) {
    const all = _load();
    const key = String(aiId || '');
    if (!key) return null;
    if (!all[key]) {
        all[key] = { totalMs: 0, sessions: 0, firstAt: 0, lastAt: 0, songs: {} };
    }
    if (!all[key].songs || typeof all[key].songs !== 'object') all[key].songs = {};
    return all[key];
}

/** 会话开始：埋下结算游标 */
export function beginSession(aiId, startTime = Date.now()) {
    const e = _entry(aiId);
    if (!e) return;
    if (!e.firstAt) e.firstAt = startTime;
    e.lastAt = startTime;
    _cursor = { aiId: String(aiId), at: startTime };
    _save();
}

/**
 * 把「距上次结算」的时长记进累计。ticker 每秒调，内部自己限流到 15 秒一次。
 * @param {boolean} force 会话结束时传 true，立刻结算不等间隔
 */
export function checkpoint(aiId, force = false) {
    const key = String(aiId || '');
    if (!key) return;
    const now = Date.now();
    if (!_cursor || _cursor.aiId !== key) {
        _cursor = { aiId: key, at: now };
        return;
    }
    const delta = now - _cursor.at;
    if (delta <= 0) return;
    if (!force && delta < CHECKPOINT_INTERVAL_MS) return;
    const e = _entry(key);
    if (!e) return;
    e.totalMs = (Number(e.totalMs) || 0) + delta;
    e.lastAt = now;
    _cursor.at = now;
    _save();
}

/** 会话结束：收尾结算 + 会话数 +1 */
export function endSession(aiId) {
    checkpoint(aiId, true);
    const e = _entry(aiId);
    if (e) {
        e.sessions = (Number(e.sessions) || 0) + 1;
        _save();
    }
    _cursor = null;
}

/** 一起听期间开始放某首歌 → 这首歌的「一起听次数」+1 */
export function noteSong(aiId, song) {
    if (!song?.id) return;
    const e = _entry(aiId);
    if (!e) return;
    const key = String(song.id);
    const prev = e.songs[key] || { title: '', artist: '', count: 0, lastAt: 0 };
    e.songs[key] = {
        title: song.title || prev.title || '',
        artist: song.artist || prev.artist || '',
        count: (Number(prev.count) || 0) + 1,
        lastAt: Date.now(),
    };
    e.lastAt = Date.now();
    _save();
}

/**
 * 读某个 AI 的累计统计。
 * @param {string} aiId
 * @param {object} [live] 当前 listenTogether 状态；传了且正在进行中，会把「本次还没结算的部分」加上
 * @returns {{totalMs:number, sessions:number, songs:Array, firstAt:number, lastAt:number}}
 */
export function getStats(aiId, live = null) {
    const key = String(aiId || '');
    const all = _load();
    const e = all[key] || { totalMs: 0, sessions: 0, firstAt: 0, lastAt: 0, songs: {} };
    let totalMs = Number(e.totalMs) || 0;
    // 本次会话中、还没被 checkpoint 收走的那一段
    if (live?.active && String(live.aiId) === key && _cursor?.aiId === key) {
        totalMs += Math.max(0, Date.now() - _cursor.at);
    }
    const songs = Object.entries(e.songs || {})
        .map(([songId, v]) => ({ songId, ...v }))
        .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
    return {
        totalMs,
        sessions: Number(e.sessions) || 0,
        firstAt: Number(e.firstAt) || 0,
        lastAt: Number(e.lastAt) || 0,
        songs,
    };
}

/** 清掉某个 AI 的账本（用户在设置里重置时用） */
export function resetStats(aiId) {
    const all = _load();
    delete all[String(aiId || '')];
    _save();
}

export default { beginSession, checkpoint, endSession, noteSong, getStats, resetStats };
