/**
 * 狼人杀 / 角色与板子
 *
 * ★ 相对原型修掉的规则问题，每条都写清原来是怎么坏的
 *   —— 否则后来人会以为是写复杂了然后「简化」回去。
 *
 *   1. **守卫不能连守**：原型的 prompt 里明明白白写着「你不能连续两晚守同一个人」，
 *      但代码里 `lastGuarded` 这个字段**从头到尾没有被赋值过** ——
 *      规则只存在于给 AI 看的那段文字里，实际完全不生效。
 *      现在真的记了，并且在选人界面上把昨晚守过的那个人置灰。
 *
 *   2. **猎人被毒死不能开枪**：这是狼人杀通行规则，原型没有 ——
 *      女巫毒猎人反而给对面送一枪。现在按通行规则来。
 *
 *   3. **同守同救**：也是通行规则（守卫守的人正好被女巫救，则死）。
 *      原型没有。这条容易让人以为是 bug，所以做成板子上的开关，默认关，
 *      想玩标准局的人自己打开。
 *
 *   4. **女巫首夜可以自救、之后不能**：原型没有限制。同样做成开关，默认关。
 */

export const TEAMS = Object.freeze({ VILLAGE: 'village', WOLF: 'wolf', LOVERS: 'lovers' });

/**
 * 角色表。
 *
 * `nightOrder` 是夜里行动的先后（数字小的先）。没有这个字段的角色不在夜里行动。
 * 原型把这个顺序硬编码在 `runNightPhase` 的一串 if 里，加一个角色要改三个地方。
 */
export const ROLES = Object.freeze({
    wolf: {
        id: 'wolf', name: '狼人', team: TEAMS.WOLF, nightOrder: 30,
        desc: '每晚和队友商量刀一个人。白天要伪装成好人。',
        skill: '夜晚击杀',
    },
    villager: {
        id: 'villager', name: '村民', team: TEAMS.VILLAGE,
        desc: '没有技能，只能靠发言和投票找出狼人。',
        skill: '无',
    },
    seer: {
        id: 'seer', name: '预言家', team: TEAMS.VILLAGE, nightOrder: 50,
        desc: '每晚查验一个人，得知他是不是狼人。',
        skill: '夜晚查验',
    },
    witch: {
        id: 'witch', name: '女巫', team: TEAMS.VILLAGE, nightOrder: 40,
        desc: '有一瓶解药一瓶毒药，各只能用一次。',
        skill: '解药 / 毒药',
    },
    hunter: {
        id: 'hunter', name: '猎人', team: TEAMS.VILLAGE,
        desc: '死亡时可以开枪带走一个人（被毒死时不能开枪）。',
        skill: '死亡开枪',
    },
    guard: {
        id: 'guard', name: '守卫', team: TEAMS.VILLAGE, nightOrder: 20,
        desc: '每晚守护一个人，挡下狼人的刀。不能连续两晚守同一个人。',
        skill: '夜晚守护',
    },
    cupid: {
        id: 'cupid', name: '丘比特', team: TEAMS.VILLAGE, nightOrder: 10,
        desc: '首夜连一对情侣。情侣一死俱死；若最后只剩情侣两人，情侣获胜。',
        skill: '首夜连情侣',
    },
});

export function roleOf(id) {
    return ROLES[id] || ROLES.villager;
}

export function roleName(id) {
    return roleOf(id).name;
}

/**
 * 板子。4–12 人。
 *
 * 原型的 4 人局是「1 狼 3 民」—— 那局根本没法玩（好人只要投错一次就输，
 * 而且没有任何信息来源）。改成带预言家。
 */
export const CONFIGS = Object.freeze({
    4: { name: '四人练习局', roles: ['wolf', 'seer', 'villager', 'villager'], desc: '1 狼 1 预言家 2 民，熟悉流程用' },
    5: { name: '五人局', roles: ['wolf', 'seer', 'witch', 'villager', 'villager'], desc: '1 狼 + 预言家女巫' },
    6: { name: '六人局', roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'], desc: '2 狼 + 预言家女巫' },
    7: { name: '七人局', roles: ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'], desc: '2 狼 + 预女猎' },
    8: { name: '八人局', roles: ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'], desc: '2 狼 + 预女猎 3 民' },
    9: { name: '九人局', roles: ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'], desc: '经典 3 狼预女猎' },
    10: { name: '十人守卫局', roles: ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'], desc: '3 狼 + 预女猎守' },
    11: { name: '十一人丘比特局', roles: ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'guard', 'cupid', 'villager', 'villager', 'villager'], desc: '多一个丘比特，会出情侣' },
    12: { name: '十二人局', roles: ['wolf', 'wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager', 'villager'], desc: '4 狼标准大局' },
});

export function configFor(count) {
    return CONFIGS[count] || CONFIGS[9];
}

/** 板子可选的规则开关（默认全关，跟原型行为一致）。 */
export const RULE_OPTIONS = Object.freeze([
    { key: 'sameNightGuardSave', label: '同守同救算死', desc: '守卫守的人正好被女巫救 → 仍然死亡（标准局规则）' },
    { key: 'witchNoSelfSaveAfterFirst', label: '女巫首夜后不能自救', desc: '标准局规则' },
]);

/** 夜里要行动的角色，按顺序。 */
export function nightOrderRoles(session) {
    const alive = new Set((session.players || []).filter((p) => p.alive).map((p) => p.role));
    return Object.values(ROLES)
        .filter((r) => r.nightOrder && alive.has(r.id))
        // 丘比特只在首夜行动
        .filter((r) => r.id !== 'cupid' || session.round === 1)
        .sort((a, b) => a.nightOrder - b.nightOrder)
        .map((r) => r.id);
}

/**
 * 胜负判定。
 *
 * 顺序很重要：情侣胜利要先判，否则「只剩情侣两人且一狼一民」会被
 * 判成狼人胜（好人数 ≤ 狼人数）。
 */
export function checkWin(session) {
    const alive = (session.players || []).filter((p) => p.alive);
    const lovers = session.lovers || [];

    if (lovers.length === 2 && alive.length === 2) {
        const ids = alive.map((p) => p.id);
        if (lovers.every((id) => ids.includes(id))) {
            return { winner: TEAMS.LOVERS, label: '情侣获胜' };
        }
    }

    const wolves = alive.filter((p) => roleOf(p.role).team === TEAMS.WOLF).length;
    const good = alive.length - wolves;
    if (wolves === 0) return { winner: TEAMS.VILLAGE, label: '好人阵营获胜' };
    if (good <= wolves) return { winner: TEAMS.WOLF, label: '狼人阵营获胜' };
    return null;
}

/** 这个玩家算不算赢。 */
export function isWinner(player, winner, session) {
    if (winner === TEAMS.LOVERS) return (session.lovers || []).includes(player.id);
    return roleOf(player.role).team === winner;
}

/** 发牌。 */
export function dealRoles(players, config) {
    const pool = [...config.roles];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    players.forEach((p, i) => {
        p.role = pool[i] || 'villager';
        p.roleLabel = roleName(p.role);
        p.team = roleOf(p.role).team;
    });
    return players;
}

/** 同阵营的队友（狼人互相认识）。 */
export function teammatesOf(session, player) {
    if (roleOf(player.role).team !== TEAMS.WOLF) return [];
    return (session.players || []).filter((p) => p.id !== player.id && roleOf(p.role).team === TEAMS.WOLF);
}
