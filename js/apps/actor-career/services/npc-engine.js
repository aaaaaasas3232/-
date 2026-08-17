/**
 * 追光 · NPC 引擎
 *
 * 「类 MBTI 拼人」：一个 NPC = 姓名 + 职业(社会地位) + MBTI + 两条性格细节
 * + 一个怪癖 + 一条隐秘目标 + 初始态度。全部从素材池按 seed 确定性抽取，
 * 一滴 token 都不烧。
 *
 * 关键约定（用户明确要求）：
 *   - 同一个档案键（人设+世界）永远生成同样的 30 个 NPC —— seed 来自 profileKey
 *   - 不同档案键的 NPC 完全不同
 *   - 同一档案键下的每个存档共享这 30 人，只是「谁启用」不同
 *   - 其中 2 个是隐藏 NPC，条件触发才会揭示
 */

import {
    NPC_POOLS, NPC_ROSTER_SIZE, NPC_HIDDEN_COUNT, NPC_DEFAULT_ACTIVE,
} from '../constants.js';
import { hashString, seededRandom } from '../utils.js';

function weightedPick(rand, list) {
    const total = list.reduce((acc, item) => acc + (item.weight || 1), 0);
    let roll = rand() * total;
    for (const item of list) {
        roll -= (item.weight || 1);
        if (roll <= 0) return item;
    }
    return list[list.length - 1];
}

function pick(rand, list) {
    return list[Math.floor(rand() * list.length)];
}

function pickTwo(rand, list) {
    const first = Math.floor(rand() * list.length);
    let second = Math.floor(rand() * (list.length - 1));
    if (second >= first) second += 1;
    return [list[first], list[second]];
}

/**
 * 生成 30 人名册（确定性）。
 * @returns {Array<object>} npc: { id, name, gender, age, occupation, status, mbti,
 *   traits, quirk, agenda, attitude, attitudeScore, hidden, hue, revealed }
 */
export function generateRoster(profileKey) {
    const rand = seededRandom(hashString(`actor-roster::${profileKey}`));
    const roster = [];
    const usedNames = new Set();

    for (let i = 0; i < NPC_ROSTER_SIZE; i += 1) {
        const hidden = i >= NPC_ROSTER_SIZE - NPC_HIDDEN_COUNT;

        let name = '';
        for (let guard = 0; guard < 40; guard += 1) {
            name = pick(rand, NPC_POOLS.surnames) + pick(rand, NPC_POOLS.givens);
            if (!usedNames.has(name)) break;
        }
        usedNames.add(name);

        const occ = hidden
            ? NPC_POOLS.hiddenOccupations[i - (NPC_ROSTER_SIZE - NPC_HIDDEN_COUNT)]
            : weightedPick(rand, NPC_POOLS.occupations);
        const attitude = pick(rand, NPC_POOLS.attitudes);
        const [traitA, traitB] = pickTwo(rand, NPC_POOLS.traits);

        roster.push({
            id: `npc-${i + 1}`,
            name,
            gender: rand() < 0.5 ? '男' : '女',
            age: 22 + Math.floor(rand() * 40),
            occupationId: occ.id,
            occupation: occ.label,
            status: occ.status,
            mbti: pick(rand, NPC_POOLS.mbti),
            traits: [traitA, traitB],
            quirk: pick(rand, NPC_POOLS.quirks),
            agenda: pick(rand, NPC_POOLS.agendas),
            attitude: attitude.label,
            attitudeScore: attitude.bias + Math.round((rand() - 0.5) * 4),
            hidden,
            revealed: !hidden,
            hue: Math.floor(rand() * 360),
        });
    }
    return roster;
}

/** 每档默认启用的 NPC id（前 15 个非隐藏） */
export function defaultActiveIds(roster) {
    return (roster || [])
        .filter((n) => !n.hidden)
        .slice(0, NPC_DEFAULT_ACTIVE)
        .map((n) => n.id);
}

/** 把 NPC 拼成一段人设文本（进 prompt / 注册到角色库） */
export function npcPersonaText(npc, { withAgenda = true } = {}) {
    if (!npc) return '';
    const lines = [
        `${npc.name}，${npc.gender}，${npc.age} 岁，${npc.occupation}（${npc.status}）`,
        `MBTI：${npc.mbti}`,
        `性格细节：${(npc.traits || []).join('；')}`,
        `小习惯：${npc.quirk}`,
        `对用户的初始态度：${npc.attitude}`,
    ];
    if (withAgenda) lines.push(`藏在心里的事：${npc.agenda}`);
    return lines.join('\n');
}

/** 交际事件里抽一个「今天遇到的人」：优先没聊过的启用 NPC */
export function pickEncounterNpc(roster, activeIds, chattedIds, seedText) {
    const active = (roster || []).filter((n) => activeIds.includes(n.id) && n.revealed !== false);
    if (!active.length) return null;
    const fresh = active.filter((n) => !chattedIds.includes(n.id));
    const pool = fresh.length ? fresh : active;
    return pool[hashString(seedText) % pool.length];
}

/**
 * 隐藏 NPC 揭示判定：演技功底或人脉到阈值、或档内天数够长时，按小概率揭示。
 * 返回需要揭示的 npc（一次最多一个）。
 */
export function checkHiddenReveal(roster, save, rand01) {
    const candidates = (roster || []).filter((n) => n.hidden && !(save.revealedNpcIds || []).includes(n.id));
    if (!candidates.length) return null;
    const craft = save?.craft ?? 0;
    const network = save?.attrs?.network ?? 0;
    const day = save?.clock?.day ?? 1;
    let p = 0.01;
    if (craft >= 70) p += 0.05;
    if (network >= 70) p += 0.05;
    if (day >= 30) p += 0.03;
    if (rand01 < p) return candidates[0];
    return null;
}

/** 把绑定世界的 AI 包装成 NPC 条目（人设做快照，变了才提示用户三选一） */
export function wrapAiAsNpc(ai, personaText) {
    return {
        id: `ai::${ai.id}`,
        aiPersonId: ai.id,
        name: ai.name,
        gender: '',
        age: 0,
        occupation: ai.role || 'AI 伙伴',
        status: '世界角色',
        mbti: '',
        traits: [ai.personality].filter(Boolean),
        quirk: '',
        agenda: '',
        attitude: '与你羁绊已定',
        attitudeScore: 10,
        hidden: false,
        revealed: true,
        fromAi: true,
        hue: hashString(ai.id) % 360,
        personaSnapshot: String(personaText || ''),
        personaHash: hashString(String(personaText || '')),
    };
}
