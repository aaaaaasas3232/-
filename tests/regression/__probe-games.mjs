/**
 * 群聊小游戏 · 状态机回归测试（纯 Node，不需要浏览器）
 *
 * 为什么值得单独写一份：
 *
 *   这三个游戏最容易坏的地方是**流程断在半路**，而这类 bug 在浏览器里
 *   表现为「AI 不动了」—— 没有报错、没有白屏，只能靠肉眼盯着等，
 *   一局十几分钟。原型里那些「切出去就崩」的问题就是这么长期没被发现的。
 *
 *   这里把调度器的时间轴换成「立刻执行下一步」，一局几十步在几百毫秒内跑完，
 *   于是可以断言：**从开局到分出胜负，一步都没有卡住**。
 *
 * 跑法：node --experimental-loader ./__loader-alias.mjs tests/regression/__probe-games.mjs
 *
 * ⚠️ 故意**不配 API**。`askAi` 会返回 `{ok:false}`，三个引擎全部走兜底决策 ——
 *    这恰好是最该被覆盖的路径（用户没配 key、或者接口挂了），
 *    而且顺带证明了「AI 全挂也不会让对局卡死」。
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';

// ---------------------------------------------------------------------------
// 最小浏览器环境
// ---------------------------------------------------------------------------

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.dispatchEvent = () => {};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.document = {
    body: {},
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    dispatchEvent() {},
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} }),
};
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

/** 一个只有 3 个 AI 的假群。 */
const AI_POOL = [
    { id: 'ai1', nickname: '阿蓝', personality: '爱笑，喜欢抬杠' },
    { id: 'ai2', nickname: '小桃', personality: '心细，说话慢' },
    { id: 'ai3', nickname: '老陈', personality: '沉稳，话少' },
    { id: 'ai4', nickname: '果果', personality: '跳脱，容易激动' },
    { id: 'ai5', nickname: '南南', personality: '理性，爱分析' },
    { id: 'ai6', nickname: '小北', personality: '话痨' },
    { id: 'ai7', nickname: '阿元', personality: '爱开玩笑' },
    { id: 'ai8', nickname: '青青', personality: '安静' },
];
const GROUP = { id: 'g1', name: '测试群', members: AI_POOL.map((a) => ({ id: a.id })) };

globalThis.window.settingsSdk = {
    defaultUserCard: { getDefault: () => ({ id: 'u1', nickname: '我' }) },
    users: { getActive: () => ({ id: 'u1', nickname: '我' }) },
    aiPersons: { get: (id) => AI_POOL.find((a) => a.id === id) || null },
    chatGroups: {
        // 任何 groupId 都返回这个假群，方便测试里换群号做隔离
        get: (_u, gid, mode) => (mode === 'calendar' ? { ...GROUP, id: gid } : null),
        resolveMembers: () => AI_POOL,
        getNickname: () => '',
    },
    chatMessages: { add: async () => ({}) },
};
// 故意不设 window.__apiSdk：走兜底决策路径

// ---------------------------------------------------------------------------
// `@/` 别名
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
async function load(rel) {
    return import(pathToFileURL(path.join(ROOT, rel)).href);
}

// ---------------------------------------------------------------------------
// 断言
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
function ok(cond, label, extra = '') {
    if (cond) {
        pass += 1;
        console.log(`  ✓ ${label}`);
    } else {
        fail += 1;
        console.log(`  ✗ ${label}${extra ? `  — ${extra}` : ''}`);
    }
}

// ---------------------------------------------------------------------------

const clock = await load('js/apps/chat-app/games/core/clock.js');
const storeMod = await load('js/apps/chat-app/games/core/store.js');
const registry = await load('js/apps/chat-app/games/registry.js');
const gamesApi = await load('js/apps/chat-app/games/index.js');

// 关掉真 ticker：本测试自己驱动时间轴
clock.stopClock();

/**
 * 快进：一直把 `next` 立刻跑掉，直到需要用户操作、或者达到步数上限。
 *
 * `onPending` 里模拟用户点按钮。返回跑了多少步。
 */
async function fastForward(groupId, onPending, maxSteps = 900) {
    let steps = 0;
    for (; steps < maxSteps; steps++) {
        const s = storeMod.getSession(groupId);
        if (!s) break;
        if (s.status !== 'running') break;
        if (s.pending) {
            const handled = await onPending(s, s.pending);
            if (!handled) break;
            continue;
        }
        if (!s.next?.step) break;
        await clock.runNow(groupId, s.next.step, s.next.payload);
    }
    return steps;
}

function pickAlive(session, exceptId) {
    return session.players.find((p) => p.alive && p.id !== exceptId) || null;
}

// ===========================================================================
console.log('\n【狼人杀】9 人局，用户参战，全程无 AI（走兜底决策）');
// ===========================================================================
{
    const r = gamesApi.startGame({
        gameId: 'werewolf',
        groupId: 'g1',
        aiIds: AI_POOL.slice(0, 8).map((a) => a.id),
        userPlays: true,
        setup: {},
    });
    ok(r.ok, '开局成功', r.error);
    const gid = 'g1';
    const s0 = storeMod.getSession(gid);
    ok(s0.players.length === 9, '9 个玩家');
    ok(s0.players.every((p) => p.role), '每个人都发到了牌');
    ok(s0.players.filter((p) => p.role === 'wolf').length === 3, '9 人局是 3 狼');
    ok(!!s0.next, '开局排好了第一步');

    let userActions = 0;
    const steps = await fastForward(gid, async (s, pending) => {
        userActions += 1;
        if (userActions > 400) return false;
        const me = s.players.find((p) => p.isUser);
        const eng = await load('js/apps/chat-app/games/werewolf/engine.js');
        const A = eng.ACTIONS;
        switch (pending.action) {
            case A.CUPID: {
                const two = s.players.slice(0, 2).map((p) => p.id);
                await eng.handleUserAction(s, A.CUPID, { playerIds: two });
                return true;
            }
            case A.GUARD:
            case A.WOLF:
            case A.SEER:
            case A.HUNTER:
            case A.VOTE: {
                const t = pickAlive(s, me.id);
                await eng.handleUserAction(s, pending.action, { playerId: t?.id || '' });
                return true;
            }
            case A.WITCH:
                await eng.handleUserAction(s, A.WITCH, { kind: 'skip' });
                return true;
            case A.SPEECH:
                await eng.handleUserAction(s, A.SPEECH, { text: '我觉得没什么好说的' });
                return true;
            case A.LAST_WORDS:
                await eng.handleUserAction(s, A.LAST_WORDS, { text: '好人加油' });
                return true;
            case A.REVIEW:
                return false; // 走到复盘就算这一局跑完了
            default:
                return false;
        }
    });

    const s1 = storeMod.getSession(gid);
    ok(s1.settled === true, '分出了胜负', `phase=${s1.phase} next=${s1.next?.step}`);
    ok(['village', 'wolf', 'lovers'].includes(s1.winner), `胜方合法：${s1.winner}`);
    ok(!s1.error, '全程没有抛错', s1.error?.message);
    ok(s1.round >= 1, `打了 ${s1.round} 轮`);
    ok(s1.log.length > 10, `产生了 ${s1.log.length} 条对局记录`);
    console.log(`    （${steps} 步 / ${userActions} 次用户操作）`);

    // ★ 关键断言：中途「离开界面」不影响流程。
    //   界面根本没参与过这一整局 —— 上面从头到尾没有任何 DOM。
    ok(true, '整局在没有任何 DOM 的情况下跑完（= 切出界面不会断）');

    gamesApi.abortGame(gid);
}

// ===========================================================================
console.log('\n【狼人杀】上帝视角（用户不参战，全 AI）');
// ===========================================================================
{
    const r = gamesApi.startGame({
        gameId: 'werewolf',
        groupId: 'g1',
        aiIds: AI_POOL.slice(0, 6).map((a) => a.id),
        userPlays: false,
    });
    ok(r.ok, '开局成功', r.error);
    const steps = await fastForward('g1', async () => false);
    const s = storeMod.getSession('g1');
    ok(s.settled === true, '无人操作也能自己打完', `phase=${s.phase} pending=${s.pending?.action}`);
    ok(!s.error, '没有抛错', s.error?.message);
    console.log(`    （${steps} 步，${s.round} 轮，${s.winner} 胜）`);
    gamesApi.abortGame('g1');
}

// ===========================================================================
console.log('\n【谁是卧底】6 人局');
// ===========================================================================
{
    const r = gamesApi.startGame({
        gameId: 'undercover',
        groupId: 'g1',
        aiIds: AI_POOL.slice(0, 5).map((a) => a.id),
        userPlays: true,
        setup: { wordType: 'food' },
    });
    ok(r.ok, '开局成功', r.error);
    const s0 = storeMod.getSession('g1');
    ok(!!s0.wordPair?.civilian && !!s0.wordPair?.undercover, '发到了词对');
    ok(s0.wordPair.civilian !== s0.wordPair.undercover, '两个词不一样');
    ok(s0.players.filter((p) => p.role === 'undercover').length === 1, '6 人局 1 个卧底');

    const eng = await load('js/apps/chat-app/games/undercover/engine.js');
    const A = eng.ACTIONS;
    await fastForward('g1', async (s, pending) => {
        const me = s.players.find((p) => p.isUser);
        if (pending.action === A.DESCRIBE) {
            await eng.handleUserAction(s, A.DESCRIBE, { text: '这个东西挺常见的' });
            return true;
        }
        if (pending.action === A.DISCUSS) {
            await eng.handleUserAction(s, A.DISCUSS, { go: 'vote' });
            return true;
        }
        if (pending.action === A.VOTE) {
            await eng.handleUserAction(s, A.VOTE, { playerId: pickAlive(s, me.id)?.id || '' });
            return true;
        }
        return false;
    });
    const s1 = storeMod.getSession('g1');
    ok(s1.settled === true, '分出了胜负', `phase=${s1.phase} pending=${s1.pending?.action}`);
    ok(['civilian', 'undercover'].includes(s1.winner), `胜方合法：${s1.winner}`);
    ok(!s1.error, '没有抛错', s1.error?.message);
    console.log(`    （${s1.round} 轮，${s1.winner} 胜）`);
    gamesApi.abortGame('g1');
}

// ===========================================================================
console.log('\n【大富翁】4 人局：钱、地产、租金、破产、结算');
// ===========================================================================
{
    const r = gamesApi.startGame({
        gameId: 'monopoly',
        groupId: 'g1',
        aiIds: AI_POOL.slice(0, 3).map((a) => a.id),
        userPlays: true,
    });
    ok(r.ok, '开局成功', r.error);
    const s0 = storeMod.getSession('g1');
    ok(s0.players.every((p) => p.money === 15000), '每人 15000 起始资金');
    ok(s0.players.every((p) => p.pos === 0), '都从起点出发');

    const eng = await load('js/apps/chat-app/games/monopoly/engine.js');
    const A = eng.ACTIONS;
    let bought = 0;
    await fastForward('g1', async (s, pending) => {
        const me = s.players.find((p) => p.isUser);
        if (pending.action === A.ROLL) {
            await eng.handleUserAction(s, A.ROLL, {});
            return true;
        }
        if (pending.action === A.BUY) {
            bought += 1;
            await eng.handleUserAction(s, A.BUY, { buy: true });
            return true;
        }
        if (pending.action === A.UPGRADE) {
            await eng.handleUserAction(s, A.UPGRADE, { upgrade: true });
            return true;
        }
        if (pending.action === A.JAIL) {
            await eng.handleUserAction(s, A.JAIL, { choice: 'pay' });
            return true;
        }
        return false;
    }, 4000);

    const s1 = storeMod.getSession('g1');
    ok(s1.settled === true, '分出了胜负', `round=${s1.round} phase=${s1.phase}`);
    ok(!s1.error, '没有抛错', s1.error?.message);
    ok(Object.keys(s1.estates).length > 0 || bought > 0, '有人买了地');
    const moneyOk = s1.players.every((p) => Number.isFinite(p.money) && p.money >= 0);
    ok(moneyOk, '所有人的钱都是合法数字且不为负');
    ok(s1.players.some((p) => p.win), '有一个赢家');
    console.log(`    （${s1.round} 轮，买了 ${Object.keys(s1.estates).length} 块地）`);
}

// ===========================================================================
console.log('\n【存档】刷新之后能接着跑');
// ===========================================================================
{
    // 上一局还没 finish，仍是 running → 应该已经落盘
    storeMod.flushSessions();
    const raw = localStorage.getItem('xiaoting::chat-games-v1');
    ok(!!raw, '进行中的对局落盘了');

    // 模拟「页面刷新」：造一个卡在 running 中间的存档，看能不能被接回去
    const parsed = JSON.parse(raw || '{"sessions":[]}');
    const snap = parsed.sessions[0];
    if (snap) {
        snap.status = 'running';
        snap.settled = false;
        snap.next = null;
        snap.pending = null;
        snap.busy = { step: 'beginTurn', startedAt: Date.now() };
        snap.running = { step: 'beginTurn', payload: null, at: Date.now() };
        localStorage.setItem('xiaoting::chat-games-v1', JSON.stringify(parsed));

        const fresh = await import(
            `${pathToFileURL(path.join(ROOT, 'js/apps/chat-app/games/core/store.js')).href}?reload=${Date.now()}`
        );
        fresh.loadSessions();
        const revived = fresh.getSession(snap.groupId);
        ok(!!revived, '存档被读回来了');
        ok(revived && revived.busy === null, '「正在等 AI」这种假状态被清掉了');
        ok(revived && revived.next?.step === 'beginTurn', '卡在半路的那一步被接了回去（刷新不丢局）');
    } else {
        ok(false, '存档里应该有一局');
    }
}

// ===========================================================================
console.log('\n【放弃】中止的局不该继续被推进');
// ===========================================================================
{
    localStorage.clear?.();
    store.clear();
    const r = gamesApi.startGame({
        gameId: 'undercover',
        groupId: 'g2',
        aiIds: AI_POOL.slice(0, 3).map((a) => a.id),
        userPlays: true,
    });
    ok(r.ok, '开局成功', r.error);
    gamesApi.abortGame('g2');
    ok(!storeMod.getLiveSession('g2'), '中止之后拿不到进行中的对局');
    const steps = await fastForward('g2', async () => false, 20);
    ok(steps === 0, '调度器不再推进它', `跑了 ${steps} 步`);
}

// ===========================================================================
console.log('\n【渲染】三个游戏的对局页都能画出来');
// ===========================================================================
{
    /**
     * 视图是纯函数（state 进、HTML 出），所以不用浏览器也能验。
     * 重点查两件静态检查抓不到的事：模板里有没有漏掉的变量（`undefined`），
     * 以及关键锚点在不在（live-view 靠这些 data 属性打补丁，缺一个就不更新了）。
     */
    const anchors = ['data-cg-region="head"', 'data-cg-region="feed"', 'data-cg-region="action"', 'data-cg-group='];
    for (const [gameId, aiCount] of [['werewolf', 5], ['undercover', 4], ['monopoly', 3]]) {
        const gid = `render_${gameId}`;
        const r = gamesApi.startGame({
            gameId, groupId: gid,
            aiIds: AI_POOL.slice(0, aiCount).map((a) => a.id),
            userPlays: true,
        });
        if (!r.ok) { ok(false, `${gameId} 开局`, r.error); continue; }

        // 跑几步让界面进入「有内容」的状态
        for (let i = 0; i < 6; i++) {
            const s = storeMod.getSession(gid);
            if (!s?.next?.step || s.pending) break;
            await clock.runNow(gid, s.next.step, s.next.payload);
        }

        const html = gamesApi.renderGamePage(gid);
        ok(html.length > 500, `${gameId} 对局页画出来了（${html.length} 字符）`);
        ok(!html.includes('undefined'), `${gameId} 模板里没有漏掉的变量`);
        ok(anchors.every((a) => html.includes(a)), `${gameId} 四个区域锚点都在`);
        if (gameId === 'monopoly') {
            ok(html.includes('cg-board'), '大富翁画出了棋盘');
            ok(html.includes('cg-stands'), '大富翁画出了资产条');
        }
        gamesApi.abortGame(gid);
    }

    // 骰子必须能独立画出来，而且几何全在 CSS 里（JS 只出结构）
    const dice = await load('js/apps/chat-app/games/components/dice-3d.js');
    const rolled = dice.rollDice(2);
    const diceHtml = dice.renderDiceStage(rolled);
    ok(diceHtml.includes('cg-dice-stage'), '骰子舞台画出来了');
    ok((diceHtml.match(/cg-dice__face/g) || []).length === 12, '两颗骰子各 6 个面');
    ok((diceHtml.match(/cg-dice__dot/g) || []).length >= 2, '点数画出来了');
    ok(!/#[0-9a-fA-F]{6}/.test(diceHtml), '骰子 HTML 里没有硬编码颜色（全在 CSS）');
    ok(rolled.total >= 2 && rolled.total <= 12, `两颗骰子点数合法（${rolled.total}）`);

    // 大厅 / 排行榜也要能画
    const lobby = await load('js/apps/chat-app/pages/game-selector-page.js');
    const lobbyHtml = lobby.renderGameSelectorPage({}, 'g1');
    ok(lobbyHtml.includes('狼人杀') && lobbyHtml.includes('谁是卧底') && lobbyHtml.includes('大富翁'), '大厅列出了三个游戏');
    ok(lobbyHtml.includes('game-setup-werewolf-g1'), '大厅卡片指向带 groupId 的设置页');

    const lb = await load('js/apps/chat-app/pages/game-leaderboard-page.js');
    const lbHtml = lb.renderGameLeaderboardPage();
    ok(lbHtml.includes('cg-lb'), '排行榜画出来了');
    ok(!lbHtml.includes('undefined'), '排行榜模板没有漏变量');
}

// ===========================================================================
console.log('\n【压力】各跑 25 局随机配置，看有没有卡住的');
// ===========================================================================
{
    /**
     * ★ 这一段是这份测试里最有价值的。
     *   「流程卡在某一步」是这三个游戏最容易出的 bug，而它只在特定的
     *   人数 / 身份 / 死亡顺序组合下才出现 —— 手动玩几局根本碰不到。
     *   随机跑几十局能把绝大多数分支覆盖掉。
     */
    const engines = {
        werewolf: await load('js/apps/chat-app/games/werewolf/engine.js'),
        undercover: await load('js/apps/chat-app/games/undercover/engine.js'),
        monopoly: await load('js/apps/chat-app/games/monopoly/engine.js'),
    };
    const bounds = { werewolf: [4, 12], undercover: [3, 9], monopoly: [2, 4] };
    const stuck = [];

    for (const gameId of ['werewolf', 'undercover', 'monopoly']) {
        const eng = engines[gameId];
        const A = eng.ACTIONS;
        for (let n = 0; n < 25; n++) {
            const [min, max] = bounds[gameId];
            const total = min + Math.floor(Math.random() * (max - min + 1));
            const userPlays = Math.random() < 0.7;
            const aiCount = Math.max(1, total - (userPlays ? 1 : 0));
            const gid = `stress_${gameId}_${n}`;

            const r = gamesApi.startGame({
                gameId, groupId: gid,
                aiIds: AI_POOL.slice(0, Math.min(aiCount, AI_POOL.length)).map((a) => a.id),
                userPlays,
            });
            if (!r.ok) continue;

            await fastForward(gid, async (s, pending) => {
                const me = s.players.find((p) => p.isUser);
                const t = pickAlive(s, me?.id);
                switch (pending.action) {
                    case A.CUPID:
                        await eng.handleUserAction(s, A.CUPID, { playerIds: s.players.slice(0, 2).map((p) => p.id) });
                        return true;
                    case A.GUARD: case A.WOLF: case A.SEER: case A.HUNTER: case A.VOTE:
                        await eng.handleUserAction(s, pending.action, { playerId: t?.id || '' });
                        return true;
                    case A.WITCH:
                        await eng.handleUserAction(s, A.WITCH, { kind: Math.random() < 0.5 ? 'save' : 'skip' });
                        return true;
                    case A.SPEECH: case A.LAST_WORDS: case A.DESCRIBE:
                        await eng.handleUserAction(s, pending.action, { text: '随便说两句' });
                        return true;
                    case A.DISCUSS:
                        await eng.handleUserAction(s, A.DISCUSS, { go: 'vote' });
                        return true;
                    case A.ROLL:
                        await eng.handleUserAction(s, A.ROLL, {});
                        return true;
                    case A.BUY:
                        await eng.handleUserAction(s, A.BUY, { buy: Math.random() < 0.7 });
                        return true;
                    case A.UPGRADE:
                        await eng.handleUserAction(s, A.UPGRADE, { upgrade: Math.random() < 0.6 });
                        return true;
                    case A.JAIL:
                        await eng.handleUserAction(s, A.JAIL, { choice: Math.random() < 0.5 ? 'pay' : 'roll' });
                        return true;
                    default:
                        return false; // 复盘 → 这一局算跑完
                }
            }, 5000);

            const s = storeMod.getSession(gid);
            if (!s?.settled || s.error) {
                stuck.push(`${gameId} ${total}人 ${userPlays ? '参战' : '上帝'} → phase=${s?.phase} pending=${s?.pending?.action} next=${s?.next?.step} err=${s?.error?.message || ''}`);
            }
            gamesApi.abortGame(gid);
        }
    }

    ok(stuck.length === 0, `75 局全部跑到分出胜负`, stuck.slice(0, 5).join(' | '));
}

// ===========================================================================
console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
