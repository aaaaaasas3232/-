/**
 * 群聊小游戏 / 玩家名册
 *
 * 把「群成员 + 用户本人」变成一份对局用的玩家列表。
 *
 * ★ 名册在开局那一刻**冻结成快照**。
 *   原型是每次渲染现查 `PhoneCore.getAI(id)`，于是用户在对局中途去改了
 *   某个 AI 的名字/头像，历史发言的署名会跟着变 —— 一局里同一个人
 *   前半场叫 A 后半场叫 B，看起来像两个玩家。
 *   （群昵称是另一回事：那个是「这个人在这个群里现在叫什么」，
 *   群聊气泡确实该现查，chat-group-page.js 就是这么做的。但对局是一场
 *   有始有终的事件，快照更合适。）
 */

import { GAME_IDS } from './constants.js';

/** 用户本人在对局里的固定 id。AI 的 id 是 aiPersonId，不会撞。 */
export const USER_PLAYER_ID = '__user__';

/**
 * 读当前用户卡。
 * chat-app 各处都是这两个的 fallback 组合，这里收一份。
 */
export function getCurrentUser() {
    const sdk = typeof window !== 'undefined' ? window.settingsSdk : null;
    return sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.() || null;
}

/**
 * 找群（两个 mode 都找一遍）。
 *
 * 群同时存在于 calendar / story 两套命名空间里，pageId 里又不带 mode，
 * chat-group-page.js 就是这么找的，这里保持一致。
 */
export function findGroup(groupId) {
    const sdk = typeof window !== 'undefined' ? window.settingsSdk : null;
    const user = getCurrentUser();
    if (!sdk?.chatGroups || !user) return null;
    for (const mode of ['calendar', 'story']) {
        const g = sdk.chatGroups.get(user, groupId, mode);
        if (g) return { group: g, mode, user, sdk };
    }
    return null;
}

/**
 * 列出这个群里可以参战的 AI。
 *
 * @returns {Array<{id, name, avatar, avatarBg, personality}>}
 */
export function listCandidates(groupId) {
    const found = findGroup(groupId);
    if (!found) return [];
    const { group, sdk, user } = found;
    let members = [];
    try {
        members = sdk.chatGroups.resolveMembers(sdk, user, group) || [];
    } catch (_) {
        members = [];
    }
    return members
        .map((m) => {
            const id = m?.id || m?.aiPersonId || '';
            if (!id) return null;
            const person = sdk.aiPersons?.get?.(id) || m;
            const nickname = sdk.chatGroups?.getNickname?.(group, id) || '';
            return {
                id,
                name: nickname || person?.nickname || person?.name || m?.name || id,
                avatar: person?.avatar || m?.avatar || '',
                avatarBg: person?.avatarBg || m?.avatarBg || '',
                personality: extractPersonality(person),
            };
        })
        .filter(Boolean);
}

/** 用户在这个群里的显示名。 */
export function getUserDisplay(groupId) {
    const found = findGroup(groupId);
    const user = found?.user || getCurrentUser();
    const nickname = found?.group && found.sdk?.chatGroups?.getNickname
        ? found.sdk.chatGroups.getNickname(found.group, user?.id)
        : '';
    return {
        id: USER_PLAYER_ID,
        name: nickname || user?.nickname || user?.name || '我',
        avatar: user?.avatar || '',
        avatarBg: user?.avatarBg || '',
    };
}

/**
 * 从 AI 人设里抠一段「性格」喂给游戏 prompt。
 *
 * 只取前 200 字：完整人设动辄几千字，一局狼人杀要问几十次 AI，
 * 全塞进去纯粹是烧 token，而且会把游戏规则挤到上下文后面去。
 */
function extractPersonality(person) {
    if (!person) return '';
    const raw = person.personality || person.persona || person.description || person.setting || '';
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * 组名册。
 *
 * @param {object} opts
 * @param {string}   opts.groupId
 * @param {string[]} opts.aiIds       参战的 AI（顺序无所谓，座位号会重排）
 * @param {boolean}  opts.userPlays   用户是玩家（false = 上帝视角旁观）
 * @param {boolean}  [opts.shuffleSeats=true]
 */
export function buildRoster({ groupId, aiIds = [], userPlays = true, shuffleSeats = true }) {
    const candidates = listCandidates(groupId);
    const byId = new Map(candidates.map((c) => [c.id, c]));

    const players = [];
    if (userPlays) {
        const u = getUserDisplay(groupId);
        players.push({
            id: u.id,
            name: u.name,
            avatar: u.avatar,
            avatarBg: u.avatarBg,
            isUser: true,
            personality: '',
        });
    }
    for (const id of aiIds) {
        const c = byId.get(id);
        if (!c) continue;
        players.push({
            id: c.id,
            name: c.name,
            avatar: c.avatar,
            avatarBg: c.avatarBg,
            isUser: false,
            personality: c.personality,
        });
    }

    const seats = players.map((_, i) => i + 1);
    if (shuffleSeats) shuffle(seats);
    players.forEach((p, i) => {
        p.seat = seats[i];
        p.alive = true;
    });
    // 名册一律按座位号排。发言序、座位条、投票列表全都直接用这个顺序，
    // 不用各自再排一遍 —— 原型里注释说「随机发言序」而实现是座位序，
    // 就是因为排序散在三处。
    players.sort((a, b) => a.seat - b.seat);
    return players;
}

/** Fisher–Yates。 */
export function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function pickRandom(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

/** 人数够不够开这个游戏。 */
export function checkPlayerCount(gameId, count, customMeta = null) {
    const builtin = {
        [GAME_IDS.WEREWOLF]: { min: 4, max: 12 },
        [GAME_IDS.UNDERCOVER]: { min: 3, max: 10 },
        [GAME_IDS.MONOPOLY]: { min: 2, max: 4 },
    }[gameId];
    // 上传的玩法把人数写在自己的 meta 里，调用方传进来
    const meta = builtin || (customMeta
        ? { min: Number(customMeta.minPlayers) || 2, max: Number(customMeta.maxPlayers) || 8 }
        : null);
    if (!meta) return { ok: false, reason: '未知游戏' };
    if (count < meta.min) return { ok: false, reason: `至少 ${meta.min} 人才能开局，现在只有 ${count} 人` };
    if (count > meta.max) return { ok: false, reason: `最多 ${meta.max} 人，现在选了 ${count} 人` };
    return { ok: true };
}

// ---------------------------------------------------------------------------
// session 上的玩家查询（三个游戏共用）
// ---------------------------------------------------------------------------

export function getPlayer(session, id) {
    return (session?.players || []).find((p) => p.id === id) || null;
}

export function alivePlayers(session) {
    return (session?.players || []).filter((p) => p.alive);
}

export function aliveExcept(session, id) {
    return alivePlayers(session).filter((p) => p.id !== id);
}

export function userPlayer(session) {
    return (session?.players || []).find((p) => p.isUser) || null;
}

/** 用户是不是还活着并且在场（上帝模式下永远返回 false）。 */
export function isUserPlaying(session) {
    const u = userPlayer(session);
    return !!(u && u.alive);
}
