/**
 * 声浪 · NPC 引擎（战队与选手名册）
 *
 * 一个档案键（人设+世界）确定性生成整个联盟：
 *   18 支战队 ×（首发 + 替补 + 教练）+ 解说 / 记者 / 圈内大 V。
 * 素材池 seeded 拼装，零 token；同档案键永远同一批人，跨档共享；
 * 换人设/换世界（档案键变）才换人。
 *
 * 小号系统（用户可能永远发现不了，但数据一直在）：
 *   - LURKER_RATE 比例的选手是「串子」：有论坛小号
 *   - 小号 handle 按 15 天窗口掷改名签 —— altStateFor(profileKey, playerId, day)
 *     是纯函数，同输入永远同输出：改名历史天然持久，等着被用户扒
 */

import {
    ALT_RENAME_DAYS, LURKER_RATE, NPC_POOLS,
} from '../constants.js';
import { gameModelById } from '../../esports-shared/esports-kit.js';
import { hashString, seededRandom } from '../utils.js';

/** 小号名池（挂在引擎侧：这是身份素材，不是概率数值） */
export const ALT_HANDLE_POOL = Object.freeze([
    '不想上班的鱼', '半根网线', '路灯下蹲着', '低保玩家', '躺分大师', '下饭观众',
    '内部人士(自称)', '豆腐脑咸党', '三楼住户', '收快递的', '巅峰两千的猫', '睡前冲浪十分钟',
    '基地保安大爷', '外卖备注多放辣', '训练服反着穿', '替补席暖气片', '凌晨四点的路灯',
    '削我干嘛', '版本受害者', '禁言三天选手', '路过的教练', '皮一下就跑',
]);

function pick(rand, list) {
    return list[Math.floor(rand() * list.length)];
}

function pickTwo(rand, list) {
    const first = Math.floor(rand() * list.length);
    let second = Math.floor(rand() * (list.length - 1));
    if (second >= first) second += 1;
    return [list[first], list[second]];
}

/** 战队 tag：从队名(地名)确定性造 2~3 个大写字母 */
function makeTag(rand) {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const len = rand() < 0.5 ? 2 : 3;
    let tag = '';
    for (let i = 0; i < len; i += 1) tag += letters[Math.floor(rand() * letters.length)];
    return tag;
}

/**
 * 生成 18 支战队（确定性）。
 * powerBase 是队伍强度基准（40~80），联盟强弱分层由它拉开。
 */
export function generateTeams(profileKey) {
    const rand = seededRandom(hashString(`esports-teams::${profileKey}`));
    const cities = [...NPC_POOLS.cities];
    const totems = [...NPC_POOLS.totems];
    const teams = [];
    const usedTags = new Set();

    for (let i = 0; i < 18; i += 1) {
        const city = cities.splice(Math.floor(rand() * cities.length), 1)[0] || `赛域${i + 1}`;
        const totem = totems.splice(Math.floor(rand() * totems.length), 1)[0] || '游隼';
        let tag = makeTag(rand);
        let guard = 0;
        while (usedTags.has(tag) && guard < 20) { tag = makeTag(rand); guard += 1; }
        usedTags.add(tag);

        // 强度分层：2 支豪门、4 支强队、6 支中游、6 支下游（洗牌前的固有底子）
        const bucket = i < 2 ? 76 : i < 6 ? 66 : i < 12 ? 56 : 46;
        teams.push({
            id: `team-${i + 1}`,
            defaultName: `${city}${totem}`,
            tag,
            hue: Math.floor(rand() * 360),
            powerBase: bucket + Math.round((rand() - 0.5) * 8),
            fanTone: pick(rand, ['狂热', '佛系', '毒唯浓度高', '妈妈粉居多', '乐子人大本营', '技术流讨论居多']),
        });
    }
    return teams;
}

function makeGameId(rand, used) {
    const pool = rand() < 0.55 ? NPC_POOLS.cnIds : NPC_POOLS.enIds;
    let id = pick(rand, pool);
    if (used.has(id)) {
        // 撞名加个位数：「野火7」在游戏 ID 里再正常不过
        let guard = 0;
        let candidate = id;
        while (used.has(candidate) && guard < 30) {
            candidate = `${id}${Math.floor(rand() * 90) + 10}`;
            guard += 1;
        }
        id = candidate;
    }
    used.add(id);
    return id;
}

function makeAttrs(rand, base) {
    const around = (spread = 12) => Math.max(20, Math.min(96, Math.round(base + (rand() - 0.5) * 2 * spread)));
    return {
        mechanics: around(14),
        awareness: around(12),
        comms: around(14),
        pool: around(14),
        mentality: around(14),
        stamina: around(10),
        synergy: around(10),
        fame: Math.max(2, Math.min(95, Math.round(base * 0.9 + (rand() - 0.5) * 30))),
    };
}

/**
 * 生成整个联盟名册（确定性）。
 *
 * @param {string} profileKey
 * @param {string} modelId   游戏模型（决定每队人数与位置表）
 * @param {string} userPositionId 用户的位置（team-1 的这个槽位留给用户）
 * @returns {{teams:Array, players:Array, coaches:Array, voices:Array}}
 */
export function generateRoster(profileKey, modelId, userPositionId) {
    const model = gameModelById(modelId);
    const teams = generateTeams(profileKey);
    const rand = seededRandom(hashString(`esports-roster::${profileKey}::${modelId}`));
    const usedIds = new Set();
    const usedNames = new Set();
    const players = [];
    const coaches = [];

    const makeRealName = () => {
        let name = '';
        for (let guard = 0; guard < 40; guard += 1) {
            name = pick(rand, NPC_POOLS.surnames) + pick(rand, NPC_POOLS.givens);
            if (!usedNames.has(name)) break;
        }
        usedNames.add(name);
        return name;
    };

    for (const team of teams) {
        const isUserTeam = team.id === 'team-1';
        const slots = [...model.positions.map((p) => p.id), 'sub'];
        for (let s = 0; s < slots.length; s += 1) {
            const positionId = slots[s];
            const isSub = positionId === 'sub';
            // 用户战队里用户位置的首发槽留空（用户本人）
            if (isUserTeam && !isSub && positionId === userPositionId) continue;

            const attitude = pick(rand, NPC_POOLS.attitudes);
            const [traitA, traitB] = pickTwo(rand, NPC_POOLS.traits);
            const isLurker = rand() < LURKER_RATE;
            players.push({
                id: `p-${team.id}-${positionId}`,
                teamId: team.id,
                role: isSub ? 'sub' : 'starter',
                positionId: isSub ? model.positions[Math.floor(rand() * model.positions.length)].id : positionId,
                isSub,
                gameId: makeGameId(rand, usedIds),
                realName: makeRealName(),
                gender: rand() < 0.78 ? '男' : '女',
                age: 17 + Math.floor(rand() * 9),
                mbti: pick(rand, NPC_POOLS.mbti),
                traits: [traitA, traitB],
                quirk: pick(rand, NPC_POOLS.quirks),
                agenda: pick(rand, NPC_POOLS.agendas),
                attitude: attitude.label,
                attitudeScore: attitude.bias + Math.round((rand() - 0.5) * 4),
                isLurker,
                attrs: makeAttrs(rand, team.powerBase + (isSub ? -8 : 0)),
                hue: Math.floor(rand() * 360),
            });
        }
        coaches.push({
            id: `c-${team.id}`,
            teamId: team.id,
            role: 'coach',
            realName: makeRealName(),
            gameId: '',
            gender: rand() < 0.85 ? '男' : '女',
            age: 26 + Math.floor(rand() * 16),
            mbti: pick(rand, NPC_POOLS.mbti),
            traits: pickTwo(rand, NPC_POOLS.traits),
            quirk: pick(rand, NPC_POOLS.quirks),
            agenda: pick(rand, NPC_POOLS.agendas),
            style: pick(rand, ['运营流', '莽夫流', '数据派', '心理按摩大师', '魔鬼训练师', '放养型']),
            attitude: '严格但护短',
            attitudeScore: 5,
            isLurker: rand() < 0.12,
            attrs: makeAttrs(rand, team.powerBase),
            hue: Math.floor(rand() * 360),
        });
    }

    const voices = [
        ...NPC_POOLS.casters.map((name, i) => ({ id: `v-caster-${i + 1}`, kind: 'caster', handle: name })),
        ...NPC_POOLS.reporters.map((name, i) => ({ id: `v-reporter-${i + 1}`, kind: 'reporter', handle: name })),
        ...NPC_POOLS.bigVs.map((name, i) => ({ id: `v-bigv-${i + 1}`, kind: 'bigv', handle: name })),
    ];

    return { teams, players, coaches, voices };
}

// ============================================================
// 小号（串子）系统 —— 全部纯函数，改名史天然可回放
// ============================================================

/**
 * 某个串子选手在第 day 天的小号状态。
 * 每 ALT_RENAME_DAYS 天一个窗口，窗口内 30% 概率换名。
 * @returns {{handle:string, history:Array<{fromDay:number, handle:string}>}}
 */
export function altStateFor(profileKey, playerId, day) {
    const windows = Math.max(0, Math.floor((Math.max(1, day) - 1) / ALT_RENAME_DAYS));
    const baseSeed = hashString(`esports-alt::${profileKey}::${playerId}`);
    const first = ALT_HANDLE_POOL[baseSeed % ALT_HANDLE_POOL.length];
    const history = [{ fromDay: 1, handle: first }];
    let current = first;
    for (let w = 1; w <= windows; w += 1) {
        const rand = seededRandom(hashString(`esports-alt::${profileKey}::${playerId}::w${w}`));
        if (rand() < 0.3) {
            const next = ALT_HANDLE_POOL[Math.floor(rand() * ALT_HANDLE_POOL.length)];
            if (next !== current) {
                current = next;
                history.push({ fromDay: w * ALT_RENAME_DAYS + 1, handle: next });
            }
        }
    }
    return { handle: current, history };
}

/** 名册里所有串子（含教练） */
export function lurkerPersons(roster) {
    if (!roster) return [];
    return [...(roster.players || []), ...(roster.coaches || [])].filter((p) => p.isLurker);
}

// ============================================================
// 人设文本 / AI 替换
// ============================================================

export function playerPersonaText(player, teamName, model) {
    if (!player) return '';
    const posLabel = model?.positions?.find((p) => p.id === player.positionId)?.label || player.positionId;
    const lines = [
        `${player.gameId}（本名 ${player.realName}），${player.gender}，${player.age} 岁`,
        `${teamName || player.teamId} ${player.isSub ? '替补' : '首发'} ${posLabel}`,
        `MBTI：${player.mbti}`,
        `性格细节：${(player.traits || []).join('；')}`,
        `小习惯：${player.quirk}`,
        `对用户的初始态度：${player.attitude}`,
    ];
    return lines.join('\n');
}

export function coachPersonaText(coach, teamName) {
    if (!coach) return '';
    return [
        `${coach.realName}指导，${coach.age} 岁，${teamName || coach.teamId} 主教练（${coach.style}）`,
        `MBTI：${coach.mbti}`,
        `性格细节：${(coach.traits || []).join('；')}`,
        `小习惯：${coach.quirk}`,
    ].join('\n');
}

/** 把绑定世界的 AI 包装成选手槽替换条目（人设做快照，变了才提示三选一） */
export function wrapAiAsPlayer(ai, personaText) {
    return {
        aiPersonId: String(ai.id),
        name: String(ai.name || 'AI'),
        personaSnapshot: String(personaText || ''),
        personaHash: hashString(String(personaText || '')),
        replacedAt: Date.now(),
    };
}
