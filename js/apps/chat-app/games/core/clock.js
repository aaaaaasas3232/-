/**
 * 群聊小游戏 / 可恢复调度器
 *
 * ★ 本次重写的核心。用户提的「切出游戏界面生成不会断掉」就靠这一个文件。
 *
 * ── 原型是怎么坏的 ────────────────────────────────────────
 *   三个游戏的流程全是 `setTimeout` 回调链：
 *     夜晚 → setTimeout(800) → 下一个角色 → setTimeout(800) → … → 结算
 *   这条链有三个致命属性：
 *     1. **回调里直接摸 DOM**。用户切出去 → 元素没了 → 抛错 → 链断在半路，
 *        而且异常被 setTimeout 吞掉，控制台一行红字，界面上什么都不会发生。
 *     2. **不可持久化**。setTimeout 的 id 存不进 localStorage，
 *        刷新一下整条链凭空消失，session 里也看不出「本来该干什么」。
 *     3. **不可观测**。卡住的时候没人知道卡在哪一步 —— 状态里根本没有「下一步是什么」这个字段。
 *
 * ── 现在的做法 ────────────────────────────────────────────
 *   把「等一会儿再做某事」从**闭包**变成**数据**：
 *
 *     session.next = { step: 'resolveNight', at: 1723600000000, payload: {} }
 *
 *   一个模块级 ticker（250ms）扫所有进行中的对局，到点就调对应游戏的
 *   `runStep(session, step, payload)`。于是：
 *     · 切出界面     —— ticker 在模块级，跟 DOM 无关，照跑
 *     · 刷新页面     —— `next` 跟着存档回来，`at` 已过期就立刻补跑
 *     · 卡住能看见   —— `next.step` 就写在状态里，排查时一眼能看到停在哪
 *     · AI 挂起能自愈 —— `busy` 带时间戳，超时自动重跑那一步
 *
 *   代价是每一步都要有名字（不能再写匿名闭包）。这个代价是值得的：
 *   步骤有名字之后，「现在在等什么」变成了可以打印、可以断言的东西。
 */

import { TIMING, SESSION_STATUS } from './constants.js';
import { listLiveSessions, writeSession, getSession } from './store.js';

/** gameId → { runStep(session, step, payload) }，由 registry 在启动时灌进来。 */
const runners = new Map();

let ticker = 0;
/**
 * 正在执行中的 step：`groupId → sessionId`。
 *
 * 这是**进程内**的重入锁，跟 `session.busy` 不是一回事：
 *   - 这个防的是「同一个 tick 里同一局被推进两次」
 *   - `session.busy` 防的是「AI 还没回来就又发一次请求」，而且它能跨刷新
 *
 * ★ 值必须是 sessionId 而不是单纯的「有没有」。
 *   第一版用 Set 存 groupId，于是出现这个现象：用户放弃一局、马上在同一个群
 *   开另一局，新局**一步都不走**。因为上一局有个 AI 请求还在重试
 *   （最长能拖两分钟），锁一直被它占着。
 *   现在只有「同一局」才会被挡住；换了一局就直接放行，
 *   老那一局的写入由 `writeSession` 的 id 校验挡掉。
 */
const inFlight = new Map();

/** 注册一个游戏的步骤执行器。 */
export function registerRunner(gameId, runner) {
    if (!gameId || typeof runner?.runStep !== 'function') return;
    runners.set(gameId, runner);
}

/**
 * 排一步。
 *
 * @param {object} session
 * @param {string} step    步骤名，必须是对应游戏 runStep 里认识的
 * @param {number} delay   毫秒
 * @param {object} payload 透传给 runStep
 */
export function scheduleStep(session, step, delay = 0, payload = null) {
    if (!session) return;
    session.next = {
        step,
        at: Date.now() + Math.max(0, Number(delay) || 0),
        payload: payload || null,
    };
}

/** 取消已排的步骤（用户手动接管流程时用，例如提前点了「进入投票」）。 */
export function cancelStep(session) {
    if (session) session.next = null;
}

/**
 * 停在这里等用户。
 *
 * ★ 故意**不设超时**。狼人杀的用户可能正在别的 App 里跟 AI 聊天，
 *   等他二十分钟回来是完全正常的；给「等用户」加倒计时等于逼着他别离开，
 *   跟这次要解决的问题正好相反。
 */
export function awaitUser(session, action, data = null) {
    if (!session) return;
    session.next = null;
    session.pending = { action, data: data || null, since: Date.now() };
}

/** 用户操作完了，清掉等待态。 */
export function clearPending(session) {
    if (session) session.pending = null;
}

// ---------------------------------------------------------------------------
// ticker
// ---------------------------------------------------------------------------

/**
 * 启动全局 ticker（幂等）。
 *
 * chat-app 的 games/index.js 在模块加载时调一次。之后不管用户在哪个 App、
 * 有没有打开对局页，它都在跑 —— 这正是我们要的。
 */
export function startClock() {
    if (ticker) return;
    ticker = setInterval(tick, TIMING.TICK);
}

export function stopClock() {
    if (!ticker) return;
    clearInterval(ticker);
    ticker = 0;
}

function tick() {
    const live = listLiveSessions();
    if (!live.length) return;
    const now = Date.now();
    for (const session of live) {
        if (inFlight.get(session.groupId) === session.id) continue;

        // ① AI 请求挂了：清掉 busy，把那一步重排一次。
        //    原型没有这条，接口超时的时候整局就永远停在「AI 思考中」。
        if (session.busy) {
            const stalledFor = now - (Number(session.busy.startedAt) || 0);
            if (stalledFor < TIMING.AI_TIMEOUT + 5000) continue;
            const stalledStep = session.busy.step;
            const stalledPayload = session.busy.payload || null;
            writeSession(session, (s) => {
                s.busy = null;
                if (stalledStep) scheduleStep(s, stalledStep, 0, stalledPayload);
            });
            continue;
        }

        // ② 到点的步骤
        const next = session.next;
        if (!next || !next.step) continue;
        if (now < (Number(next.at) || 0)) continue;
        runNow(session.groupId, next.step, next.payload);
    }
}

/**
 * 立刻执行一步（也供用户操作后手动推进）。
 *
 * 所有异常都在这里兜住并写进 session —— 原型把整条链包在 try/catch 里
 * 却只 `console.warn`，结果「必崩的 bug」被降级成「AI 有时候不回复」
 * （AGENTS2 §15.6）。这里出错要让用户看得见。
 */
export async function runNow(groupId, step, payload = null) {
    const session = getSession(groupId);
    if (!session || session.status !== SESSION_STATUS.RUNNING) return;
    if (inFlight.get(groupId) === session.id) return;

    const runner = runners.get(session.gameId);
    if (!runner) {
        console.error('[chat-games] 没有注册这个游戏的执行器:', session.gameId);
        return;
    }

    inFlight.set(groupId, session.id);
    writeSession(session, (s) => {
        s.next = null;
        // ★ 记下「正在跑什么」并落盘。页面在这一步中间被刷掉时，
        //   store.loadSessions 会把它转回 next 重跑一次 —— 否则这一局
        //   会停在一个 next 和 busy 都是空的死状态里（见 store.js 的说明）。
        s.running = { step, payload: payload || null, at: Date.now() };
    });

    try {
        await runner.runStep(session, step, payload);
    } catch (err) {
        console.error(`[chat-games] ${session.gameId} 执行 ${step} 失败`, err);
        writeSession(session, (s) => {
            s.busy = null;
            s.error = {
                step,
                message: err?.message || String(err),
                at: Date.now(),
            };
        });
    } finally {
        // 只有锁还是自己的才释放 —— 中途换过局的话，锁已经属于新的那一局了
        if (inFlight.get(groupId) === session.id) inFlight.delete(groupId);
        // 用 writeSession 而不是 updateSession：这一步跑了几十秒的话，
        // 用户可能已经放弃这局又开了新的一局，清 running 会清错人
        writeSession(session, (s) => {
            s.running = null;
        });
    }
}

/**
 * 包一次 AI 调用：进出都记 `busy`。
 *
 * `busy` 有两个作用：界面上显示「XX 正在思考」，以及让 ticker 知道
 * 「这一步已经有人在跑了，别重复排」。刷新页面时 store 会把它清掉，
 * 于是那一步会被重跑一次 —— AI 请求本来就是可重试的，重跑比卡死好。
 */
export async function withBusy(session, step, label, fn, payload = null) {
    writeSession(session, (s) => {
        s.busy = { step, label: label || '', startedAt: Date.now(), payload };
    });
    try {
        return await fn();
    } finally {
        writeSession(session, (s) => {
            s.busy = null;
        });
    }
}
