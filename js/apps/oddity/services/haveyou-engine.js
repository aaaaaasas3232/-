/**
 * 小奇怪 · 你有我没有 引擎(纯逻辑)
 *
 * ★ 不碰 DOM、不碰 store、不调 AI。所有 API 调用都在
 *   `components/game-haveyou.js` 里,拿到结果再喂给本文件。
 *
 * ── 相对原型的改动 ────────────────────────────────────────────────
 *
 * 原型(`QAQ/小奇怪/小游戏你又我`)是靠 **公共 MQTT broker** 做真联机的:
 * 四个固定角色、两个真人两个 AI,状态靠互相广播 `update_state` 对齐。
 * 这套东西在本项目里全部删掉,原因不是「懒得接」:
 *
 *   1. 公共 broker 是外部依赖,单文件 file:// 产物打不进去,离线直接死
 *   2. 角色是写死的四个人名,和 nook 人设系统完全平行,改一个名字要动源码
 *   3. 状态用「谁先收到谁改」维护,两个人同时操作就会分叉,而且不报错
 *
 * 现在是**单机**:用户 + 最多 3 个 AI 座位,座位身份从 nook 人设来,
 * 状态只有一份(就是这个 state),不存在对齐问题。
 *
 * ── 规则(和 HY_RULES 一字一句对应,不要在别处再写一遍)──────────────
 *
 *   轮到你 → 说一件「我有、猜你们都没有」的事
 *   其余活着的人逐个表态:我也有 / 我没有
 *   没人跟着有 → 声明成立,其余每人各扣 1 点
 *   有人跟着有 → 声明失败,声明者自己扣 1 点
 *   重复声明   → 声明者直接扣 1 点,本轮作废
 *   每人 5 点,扣完出局,最后一个活着的人赢
 *
 * ★ 「声明成立时其余人扣血」这一条是刻意加的。
 *   只罚失败方的话,四个人各说一句谁都不亏,牌局永远不结束。
 */

import { HY } from '../constants.js';
import { asArray, normalizeClaim, createRng } from '../utils.js';

export const MAX_LIVES = HY.lives;

// ============================================================
// 建局
// ============================================================

/**
 * @param {object} opts
 * @param {Array}  opts.seats  [{ id, name, kind:'user'|'ai', aiId }]
 * @param {string} [opts.mode] 'ai' = 走模型;'local' = 本地词库(没有 Key 时)
 */
export function createMatch(opts = {}) {
    const seats = asArray(opts.seats)
        .slice(0, HY.maxAiSeats + 1)
        .map((seat, order) => ({
            id: String(seat?.id || `seat-${order}`),
            name: String(seat?.name || `座位 ${order + 1}`),
            kind: seat?.kind === 'ai' ? 'ai' : 'user',
            aiId: String(seat?.aiId || ''),
            lives: MAX_LIVES,
            alive: true,
            order,
        }));

    return {
        kind: 'haveyou',
        mode: opts.mode === 'local' ? 'local' : 'ai',
        seats,
        turnIndex: 0,
        /** 'claim' 等人出声明 / 'respond' 等其他人表态 / 'over' 结束 */
        phase: seats.length >= 2 ? 'claim' : 'over',
        round: null,
        /** 已经出过的声明(归一化后的键),判重用 */
        usedKeys: [],
        roundNo: 1,
        finished: seats.length < 2,
        winnerId: '',
        log: seats.length >= 2
            ? [logLine(1, 'system', `开局。${seats.map((s) => s.name).join(' / ')},每人 ${MAX_LIVES} 点。`)]
            : [logLine(1, 'system', '至少要两个座位才能玩。')],
        startedAt: Date.now(),
        finishedAt: 0,
    };
}

function logLine(seq, kind, text, seatId = '') {
    return { seq, kind, text: String(text || ''), seatId, at: Date.now() };
}

function pushLog(state, kind, text, seatId = '') {
    const entry = logLine(state.log.length + 1, kind, text, seatId);
    state.log.push(entry);
    // 日志无限长会把 IndexedDB 那条记录撑大,只留最近 200 条
    if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
    return entry;
}

// ============================================================
// 查询
// ============================================================

export function getSeat(state, seatId) {
    return asArray(state?.seats).find((seat) => seat.id === seatId) || null;
}

export function currentSeat(state) {
    if (!state || state.finished) return null;
    return state.seats[state.turnIndex] || null;
}

export function aliveSeats(state) {
    return asArray(state?.seats).filter((seat) => seat.alive);
}

/** 本轮还没表态的人(不含声明者、不含已出局的) */
export function pendingResponders(state) {
    if (!state?.round || state.phase !== 'respond') return [];
    const answered = new Set(asArray(state.round.responses).map((r) => r.seatId));
    return aliveSeats(state).filter(
        (seat) => seat.id !== state.round.claimSeatId && !answered.has(seat.id),
    );
}

export function isDuplicateClaim(state, text) {
    const key = normalizeClaim(text);
    if (!key) return false;
    return asArray(state?.usedKeys).includes(key);
}

// ============================================================
// 出声明
// ============================================================

/**
 * 当前座位说出一条「我有你没有」。
 *
 * @returns {{ ok:boolean, reason:string, duplicate:boolean }}
 *   `reason`:'not-your-turn' | 'empty' | 'too-long' | 'wrong-phase' | 'finished'
 */
export function submitClaim(state, { seatId, text, line = '' } = {}) {
    if (!state || state.finished) return { ok: false, reason: 'finished', duplicate: false };
    if (state.phase !== 'claim') return { ok: false, reason: 'wrong-phase', duplicate: false };

    const seat = currentSeat(state);
    if (!seat || seat.id !== seatId) return { ok: false, reason: 'not-your-turn', duplicate: false };

    const body = String(text ?? '').trim();
    if (!body) return { ok: false, reason: 'empty', duplicate: false };
    if (body.length > HY.claimMaxChars) return { ok: false, reason: 'too-long', duplicate: false };

    const key = normalizeClaim(body);

    // 重复声明:直接扣 1 点,本轮作废,轮转
    if (state.usedKeys.includes(key)) {
        pushLog(state, 'duplicate', `${seat.name}:「${body}」—— 这句之前说过了,扣 1 点。`, seat.id);
        damage(state, seat.id, 1);
        state.round = null;
        state.roundNo += 1;
        advanceTurn(state);
        checkOver(state);
        return { ok: true, reason: '', duplicate: true };
    }

    state.usedKeys.push(key);
    if (state.usedKeys.length > HY.claimMemory) {
        state.usedKeys.splice(0, state.usedKeys.length - HY.claimMemory);
    }

    state.round = {
        claimSeatId: seat.id,
        text: body,
        key,
        line: String(line || ''),
        responses: [],
    };
    state.phase = 'respond';
    pushLog(state, 'claim', `${seat.name}:我有${body},你们没有。`, seat.id);
    if (line) pushLog(state, 'flavor', `${seat.name}:${line}`, seat.id);

    // 只剩声明者一个人活着 —— 不用表态了,直接收
    if (!pendingResponders(state).length) resolveRound(state);
    return { ok: true, reason: '', duplicate: false };
}

// ============================================================
// 表态
// ============================================================

/**
 * 某个座位表态。所有人都表完自动结算。
 *
 * @param {boolean} has  true = 我也有
 */
export function submitResponse(state, { seatId, has, line = '' } = {}) {
    if (!state || state.finished) return { ok: false, reason: 'finished' };
    if (state.phase !== 'respond' || !state.round) return { ok: false, reason: 'wrong-phase' };

    const seat = getSeat(state, seatId);
    if (!seat || !seat.alive) return { ok: false, reason: 'bad-seat' };
    if (seat.id === state.round.claimSeatId) return { ok: false, reason: 'is-claimer' };
    if (state.round.responses.some((r) => r.seatId === seat.id)) {
        return { ok: false, reason: 'already-answered' };
    }

    state.round.responses.push({ seatId: seat.id, has: has === true, line: String(line || ''), skipped: false });
    pushLog(state, 'respond', `${seat.name}:${has ? '我也有。' : '我没有。'}${line ? ` ${line}` : ''}`, seat.id);

    if (!pendingResponders(state).length) resolveRound(state);
    return { ok: true, reason: '' };
}

/**
 * 跳过一个座位。
 *
 * ★ AGENTS.md §7:跨时空回合制里「某个座位调 API 失败就跳过该座位」,
 *   **不要**因为一把 Key 挂了就把整局掐掉。跳过的人本轮按「我没有」记,
 *   但标 `skipped`,结算文案里会写明是「没接上」而不是他真的没有。
 */
export function skipResponder(state, seatId, note = '') {
    if (!state?.round || state.phase !== 'respond') return { ok: false, reason: 'wrong-phase' };
    const seat = getSeat(state, seatId);
    if (!seat || state.round.responses.some((r) => r.seatId === seatId)) {
        return { ok: false, reason: 'bad-seat' };
    }
    state.round.responses.push({ seatId, has: false, line: '', skipped: true });
    pushLog(state, 'skip', `${seat.name}没接上(${note || '这一轮跳过'})。`, seatId);
    if (!pendingResponders(state).length) resolveRound(state);
    return { ok: true, reason: '' };
}

/**
 * 声明者那一步就失败了(AI 生成不出东西)。
 * 不扣血 —— 是系统没接上,不是他玩得差。直接轮到下一个人。
 */
export function skipClaimer(state, seatId, note = '') {
    if (!state || state.phase !== 'claim') return { ok: false, reason: 'wrong-phase' };
    const seat = getSeat(state, seatId);
    if (!seat || currentSeat(state)?.id !== seatId) return { ok: false, reason: 'not-your-turn' };
    pushLog(state, 'skip', `${seat.name}这一轮没说话(${note || '没接上'}),跳过。`, seatId);
    state.round = null;
    state.roundNo += 1;
    advanceTurn(state);
    checkOver(state);
    return { ok: true, reason: '' };
}

// ============================================================
// 结算
// ============================================================

export function resolveRound(state) {
    const round = state?.round;
    if (!round) return null;

    const claimer = getSeat(state, round.claimSeatId);
    const followers = round.responses.filter((r) => r.has && !r.skipped);

    if (followers.length) {
        const names = followers.map((r) => getSeat(state, r.seatId)?.name || '?').join('、');
        pushLog(state, 'result', `${names}也有 —— ${claimer?.name || '声明者'}猜错了,扣 1 点。`, round.claimSeatId);
        damage(state, round.claimSeatId, 1);
    } else {
        const others = aliveSeats(state).filter((seat) => seat.id !== round.claimSeatId);
        if (others.length) {
            pushLog(state, 'result', `没有人跟着有 —— ${claimer?.name || '声明者'}这一句成立,其余每人扣 1 点。`, round.claimSeatId);
            for (const seat of others) damage(state, seat.id, 1);
        } else {
            pushLog(state, 'result', '牌桌上没有别人了。', round.claimSeatId);
        }
    }

    state.round = null;
    state.phase = 'claim';
    state.roundNo += 1;
    advanceTurn(state);
    checkOver(state);
    return state;
}

function damage(state, seatId, amount) {
    const seat = getSeat(state, seatId);
    if (!seat || !seat.alive) return;
    seat.lives = Math.max(0, seat.lives - Math.max(1, Number(amount) || 1));
    if (seat.lives === 0) {
        seat.alive = false;
        pushLog(state, 'out', `${seat.name}的 5 点扣完了,出局。`, seat.id);
    }
}

/**
 * 轮到下一个还活着的人。
 *
 * 从当前位置往后找,绕一圈都找不到就说明没人了 —— 交给 checkOver 收尾,
 * 这里不要抛错也不要死循环(用 seats.length 做上界)。
 */
function advanceTurn(state) {
    const total = state.seats.length;
    if (!total) return;
    for (let step = 1; step <= total; step += 1) {
        const next = (state.turnIndex + step) % total;
        if (state.seats[next]?.alive) {
            state.turnIndex = next;
            return;
        }
    }
}

function checkOver(state) {
    const alive = aliveSeats(state);
    if (alive.length > 1) return;
    state.finished = true;
    state.phase = 'over';
    state.finishedAt = Date.now();
    state.winnerId = alive[0]?.id || '';
    pushLog(
        state,
        'end',
        alive.length === 1 ? `只剩 ${alive[0].name} 还站着,这局是他的。` : '所有人都出局了,算平。',
        state.winnerId,
    );
}

// ============================================================
// 本地模式(没有可用 API Key 时)
// ============================================================

/**
 * 本地词库。
 *
 * ★ 有它才谈得上「没配 Key 也能玩」。用户第一次打开这个 App 大概率
 *   还没在 nook 里绑过 API,如果这时候只弹一句「未找到 API 配置」,
 *   这个玩法对他来说就是坏的。
 *
 * 内容刻意选「日常、具体、有点怪但不冒犯」的方向 —— 这类句子在
 * 「我有你没有」里最好玩:听起来像真的,又说不准别人到底有没有。
 */
export const LOCAL_CLAIM_POOL = Object.freeze([
    '在便利店门口站着把关东煮吃完过',
    '把闹钟设在 6:03 这种奇怪的分钟',
    '给自己家的插排起过名字',
    '在电梯里假装没看见邻居',
    '连续三天中午吃同一家外卖',
    '把用不上的快递箱留到现在',
    '记得住小学同桌的全名',
    '手机里存着一段没人听过的语音',
    '在超市把商品放回过错的货架',
    '一个人去看过午夜场',
    '把耳机线绕成过死结再慢慢解开',
    '给不认识的猫取过名字',
    '在雨里故意多走了两个路口',
    '收藏夹里有从没打开过的教程',
    '把「明天开始」说了不止十次',
    '在自动贩卖机前站了两分钟才买',
    '有一支永远找不到的笔',
    '给植物说过话',
    '把同一首歌单曲循环过一整晚',
    '在无人的楼道里小声唱过歌',
    '存过一张自己都不知道为什么要存的截图',
    '把纸巾叠成过很小的方块',
    '记错过自己的生日',
    '在深夜给冰箱开过门却什么都没拿',
]);

/**
 * 本地模式出一条声明。
 *
 * 先在词库里挑没用过的;都用完了就在后面缀一个序号,
 * 保证永远出得来 —— 出不来的话本地模式会卡死在某个 AI 的回合。
 */
export function pickLocalClaim(state, rng = Math.random) {
    const used = new Set(asArray(state?.usedKeys));
    const fresh = LOCAL_CLAIM_POOL.filter((text) => !used.has(normalizeClaim(text)));
    if (fresh.length) return fresh[Math.floor(rng() * fresh.length)];
    const base = LOCAL_CLAIM_POOL[Math.floor(rng() * LOCAL_CLAIM_POOL.length)];
    return `${base}(第 ${Math.floor(rng() * 90) + 10} 次)`;
}

/**
 * 本地模式表态。
 *
 * **确定性**的:同一个座位对同一句声明永远给同一个答案。
 * 用随机数的话,同一轮里刷新一下页面答案就变了,玩家会觉得程序在耍赖。
 * 这里拿「座位 id + 声明键」做一个廉价散列,约 1/3 的概率答「我也有」——
 * 这个比例下牌局既不会瞬间结束,也不会拖到天荒地老。
 */
export function localResponse(seatId, claimKey) {
    const src = `${seatId}::${claimKey}`;
    let hash = 2166136261;
    for (let i = 0; i < src.length; i += 1) {
        hash ^= src.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 3 === 0;
}

/** 本地模式给一句短评,让日志不至于只有「我没有」三个字 */
export function localFlavor(has, rng = Math.random) {
    const yes = ['这个我还真有。', '巧了。', '我也干过。', '被说中了。'];
    const no = ['没有。', '这我真没有。', '没听说过。', '不至于吧。'];
    const pool = has ? yes : no;
    return pool[Math.floor(rng() * pool.length)];
}

/** 给测试和「重开一局」用的确定性随机源 */
export function localRng(seed) {
    return createRng(seed);
}

// ============================================================
// 反序列化
// ============================================================

export function reviveMatch(raw) {
    if (!raw || !Array.isArray(raw.seats) || raw.seats.length < 2) return null;
    const seats = raw.seats.map((seat, order) => ({
        id: String(seat?.id || `seat-${order}`),
        name: String(seat?.name || `座位 ${order + 1}`),
        kind: seat?.kind === 'ai' ? 'ai' : 'user',
        aiId: String(seat?.aiId || ''),
        lives: Math.max(0, Math.min(MAX_LIVES, Number(seat?.lives) ?? MAX_LIVES)),
        alive: seat?.alive !== false && Number(seat?.lives) > 0,
        order,
    }));
    const phase = ['claim', 'respond', 'over'].includes(raw.phase) ? raw.phase : 'claim';
    return {
        kind: 'haveyou',
        mode: raw.mode === 'local' ? 'local' : 'ai',
        seats,
        turnIndex: Math.max(0, Math.min(seats.length - 1, Number(raw.turnIndex) || 0)),
        phase,
        round: raw.round && raw.round.claimSeatId
            ? {
                claimSeatId: String(raw.round.claimSeatId),
                text: String(raw.round.text || ''),
                key: String(raw.round.key || normalizeClaim(raw.round.text)),
                line: String(raw.round.line || ''),
                responses: asArray(raw.round.responses).map((r) => ({
                    seatId: String(r?.seatId || ''),
                    has: r?.has === true,
                    line: String(r?.line || ''),
                    skipped: r?.skipped === true,
                })),
            }
            : null,
        usedKeys: asArray(raw.usedKeys).map(String).slice(-HY.claimMemory),
        roundNo: Number(raw.roundNo) || 1,
        finished: raw.finished === true,
        winnerId: String(raw.winnerId || ''),
        log: asArray(raw.log).slice(-200),
        startedAt: Number(raw.startedAt) || Date.now(),
        finishedAt: Number(raw.finishedAt) || 0,
    };
}
