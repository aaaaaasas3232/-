/**
 * 群聊小游戏 / 对局仓库
 *
 * 模块级单例，持有「每个群当前那一局」的完整状态。
 *
 * ★ 这一层存在的唯一理由：让引擎彻底不碰 DOM。
 *
 *   原型的引擎和界面是长在一起的 —— `showUserWolfAction()` 先
 *   `this.gamePageElement.querySelector('#game-actions')` 再往里塞 HTML。
 *   于是用户一旦切出游戏界面（murmur 里去找 AI 聊天、或者干脆回桌面），
 *   `gamePageElement` 变成 null，夜晚流程走到女巫那一步直接
 *   `TypeError: Cannot read properties of null` —— 整局卡死，而且是静默的：
 *   异常被 setTimeout 吞掉，用户只看到「AI 不动了」。
 *
 *   现在的分工是硬的：
 *     引擎 → 只读写 store，永远不 querySelector
 *     界面 → 只订阅 store，把当前状态画出来
 *   「切出去游戏继续跑」于是不需要任何特殊代码，它是这个分工的自然结果
 *   （同 AGENTS2 §11.4 ④ 里梦境编织的「后台生成」）。
 *
 * ★ 为什么不用 Vue.reactive
 *   chat-app 是 hybrid 模式，界面是 HTML 字符串拼出来的，没人消费响应式；
 *   而 reactive 会把 session 变成 Proxy，写 localStorage / IndexedDB 前
 *   还得 `JSON.parse(JSON.stringify())` 剥一层。这里用朴素对象 + 显式
 *   `notify()`，少一层坑。
 */

import { STORAGE_KEY, SCHEMA_VERSION, SESSION_TTL_MS, SESSION_STATUS } from './constants.js';

// ---------------------------------------------------------------------------
// 内部状态
// ---------------------------------------------------------------------------

/** groupId → session。一个群同时只有一局，开新局会覆盖旧局。 */
const sessions = new Map();

/** 订阅者。key 是 groupId，'*' 表示关心所有群。 */
const listeners = new Map();

let saveTimer = 0;
let loaded = false;

// ---------------------------------------------------------------------------
// 持久化
// ---------------------------------------------------------------------------

/**
 * 从 localStorage 恢复。
 *
 * 幂等，任何入口都可以先调一次。三种情况会丢弃存档：
 * 版本对不上、JSON 坏了、超过 TTL 没动过。
 */
export function loadSessions() {
    if (loaded) return;
    loaded = true;
    let raw = '';
    try {
        raw = localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {
        return;
    }
    if (!raw) return;

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (_) {
        // 存档坏了就当没有。这里不该抛 —— 一个坏存档不能让整个 murmur 起不来。
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        return;
    }
    if (!parsed || parsed.v !== SCHEMA_VERSION || !Array.isArray(parsed.sessions)) return;

    const now = Date.now();
    for (const s of parsed.sessions) {
        if (!s || !s.groupId) continue;
        if (now - (Number(s.updatedAt) || 0) > SESSION_TTL_MS) continue;

        // ★ 刷新时如果正好卡在某一步中间，要把那一步接回去。
        //
        //   调度器执行一步之前会先清掉 `next`（防重入），并把「正在跑什么」
        //   记进 `running`。页面这时候被刷掉的话：`next` 是空的、
        //   promise 也随页面一起没了 —— 不处理的话这一局会永远停在那儿，
        //   而且看不出停在哪。把 `running` 转回 `next` 就等于「那一步重跑一次」。
        //   AI 请求本来就是可重试的，重跑一次远好过卡死。
        if (s.running && s.running.step) {
            s.next = { step: s.running.step, at: now + 400, payload: s.running.payload || null };
        }
        s.running = null;
        // 「正在等 AI」也一样：那个 promise 不在了，留着只会让调度器以为
        // 还有人在跑（假状态比丢状态更糟，AGENTS2 §15.7）
        s.busy = null;
        sessions.set(s.groupId, s);
    }
}

/** 防抖落盘。任何 mutator 都会调它，不用调用方操心。 */
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSessions, 400);
}

/**
 * 立刻落盘。
 *
 * 除了防抖到期，还挂在 pagehide / visibilitychange 上 ——
 * 否则用户切后台那一下的最后几次状态变化会丢。
 */
export function flushSessions() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = 0;
    }
    try {
        const list = [];
        for (const s of sessions.values()) {
            // 结束/中止的对局不占存档：战绩已经写进群聊消息了，这份只是运行态。
            if (s.status !== SESSION_STATUS.RUNNING) continue;
            list.push(s);
        }
        if (!list.length) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, sessions: list }));
    } catch (err) {
        // 配额满 / 隐私模式。丢存档不影响这一次玩下去，只是刷新后回不来。
        console.warn('[chat-games] 存档失败', err);
    }
}

if (typeof window !== 'undefined' && !window.__chatGamesStoreFlushBound) {
    window.__chatGamesStoreFlushBound = true;
    window.addEventListener('pagehide', flushSessions);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushSessions();
    });
}

// ---------------------------------------------------------------------------
// 读
// ---------------------------------------------------------------------------

/** 拿某个群当前那一局（可能是已结束的，调用方自己看 status）。 */
export function getSession(groupId) {
    loadSessions();
    return sessions.get(String(groupId)) || null;
}

/** 拿某个群**还在进行中**的那一局。大厅判断「要不要显示继续」用这个。 */
export function getLiveSession(groupId) {
    const s = getSession(groupId);
    return s && s.status === SESSION_STATUS.RUNNING ? s : null;
}

/** 所有进行中的对局。调度器每 tick 遍历它。 */
export function listLiveSessions() {
    loadSessions();
    const out = [];
    for (const s of sessions.values()) {
        if (s.status === SESSION_STATUS.RUNNING) out.push(s);
    }
    return out;
}

// ---------------------------------------------------------------------------
// 写
// ---------------------------------------------------------------------------

/** 放入一局（开新局 / 恢复）。会顶掉这个群原来那一局。 */
export function putSession(session) {
    loadSessions();
    if (!session || !session.groupId) return null;
    session.updatedAt = Date.now();
    sessions.set(String(session.groupId), session);
    scheduleSave();
    notify(session.groupId);
    return session;
}

/** 丢弃一局（用户点「退出并放弃」）。 */
export function dropSession(groupId) {
    loadSessions();
    const key = String(groupId);
    if (!sessions.has(key)) return false;
    sessions.delete(key);
    scheduleSave();
    notify(key);
    return true;
}

/**
 * 修改**指定的那一局**（引擎专用）。
 *
 * ★ 为什么不能直接用 `updateSession(groupId, …)`
 *   引擎里到处是 `await askAi(...)`，一次请求最长 45 秒。这期间用户完全可能
 *   放弃这一局、然后在同一个群里开另一个游戏。等那个 await 回来时，
 *   `updateSession(groupId)` 拿到的已经是**新的那一局**了 ——
 *   于是狼人杀的「刀人」会写进一局刚开的谁是卧底里，报
 *   `Cannot set properties of undefined (setting 'killTarget')`。
 *
 *   （浏览器探针抓到的就是这个：三局连着开，第一局的 AI 请求还没回来。
 *   纯状态机测试抓不到 —— 它没有真实的异步延迟。）
 *
 *   加一道 id 校验：不是我这一局了就整个作废。
 */
export function writeSession(session, mutator) {
    if (!session) return null;
    return updateSession(session.groupId, (s) => {
        if (s.id !== session.id) return false;
        return mutator(s);
    });
}

/**
 * 修改一局。
 *
 * 唯一的写入口 —— 所有 mutator 都从这里走，好处是
 * 「落盘」和「通知界面」不可能漏掉某一条路径。
 *
 * ⚠️ 引擎里请用 `writeSession(session, …)`，别用这个 —— 原因见上面。
 *    这个只给「界面当前正在操作的那一局」用（method / live-view）。
 *
 * @param {string} groupId
 * @param {(session:object)=>void|boolean} mutator 返回 false 表示「其实没改」，跳过落盘和通知
 */
export function updateSession(groupId, mutator) {
    const s = getSession(groupId);
    if (!s) return null;
    let changed = true;
    try {
        changed = mutator(s) !== false;
    } catch (err) {
        console.error('[chat-games] 状态更新失败', err);
        return s;
    }
    if (!changed) return s;
    s.updatedAt = Date.now();
    scheduleSave();
    notify(groupId);
    return s;
}

// ---------------------------------------------------------------------------
// 订阅
// ---------------------------------------------------------------------------

/**
 * 订阅某个群的状态变化（传 '*' 订阅全部）。
 * @returns {() => void} 取消订阅
 */
export function subscribe(groupId, cb) {
    if (typeof cb !== 'function') return () => {};
    const key = String(groupId || '*');
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(cb);
    return () => {
        const set = listeners.get(key);
        if (!set) return;
        set.delete(cb);
        if (!set.size) listeners.delete(key);
    };
}

function notify(groupId) {
    const key = String(groupId);
    const session = sessions.get(key) || null;
    for (const listenerKey of [key, '*']) {
        const set = listeners.get(listenerKey);
        if (!set) continue;
        for (const cb of Array.from(set)) {
            try {
                cb(session, key);
            } catch (err) {
                // 一个订阅者炸了不能连累引擎 —— 它们大多是界面代码，
                // 而界面在 DOM 已经被框架换掉时抛错是很正常的。
                console.warn('[chat-games] 订阅回调异常', err);
            }
        }
    }
}
