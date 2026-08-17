/**
 * 声浪 · 论坛内容引擎（纯函数，零 token）
 *
 * 论坛的「日常氛围层」全部由素材池按 seed 确定性拼装：
 *   - 每个板块每天一批预置帖（立场分五种：粉丝 / 黑子 / 路人 / 分析 / 乐子人）
 *   - 战队官博按赛果自动发赛报，评论数跟热度走
 *   - 串子选手的小号会混进自家板块发帖（altOf 埋在数据里，UI 不点破）
 *   - 选手评分 = 实力 + 战绩动量 + 粉丝滤镜（seeded）
 *
 * 同一天同一板块永远同一批帖子 —— 「持久化」由确定性天然保证。
 * AI 只在用户显式点击时介入（帖子正文展开 / 生成评论 / 战绩锐评），不在这里。
 */

import { FAN_HANDLES, POST_POOLS, STANCES } from '../constants.js';
import { altStateFor } from './npc-engine.js';
import {
    asArray, clamp, fillTemplate, hashString, pickBySeed, seededRandom,
} from '../utils.js';

// ============================================================
// 板块
// ============================================================

export function boardsList(teams, teamNameOf) {
    return [
        { id: 'general', name: '赛事总版', desc: '联赛一切话题的主干道', kind: 'general' },
        { id: 'post-match', name: '赛后讨论', desc: '每场比赛的官方讨论楼', kind: 'post-match' },
        ...asArray(teams).map((t) => ({
            id: `team::${t.id}`,
            name: `${teamNameOf(t.id)} 专区`,
            desc: `${t.fanTone}的大本营`,
            kind: 'team',
            teamId: t.id,
        })),
    ];
}

// ============================================================
// 路人 / 小号作者
// ============================================================

function fanHandle(seedText) {
    const base = pickBySeed(FAN_HANDLES, seedText);
    const num = hashString(`${seedText}::n`) % 100;
    return num < 30 ? `${base}${num}` : base;
}

/** 今天要在这个板块冒泡的串子（数据里带 altOf，UI 永远不显示） */
function lurkerPostersOf(profileKey, day, boardTeamId, roster) {
    const out = [];
    for (const person of [...asArray(roster?.players), ...asArray(roster?.coaches)]) {
        if (!person.isLurker) continue;
        // 串子主要混自家板块，偶尔逛总版
        const home = boardTeamId && person.teamId === boardTeamId;
        const rate = home ? 0.4 : (boardTeamId ? 0.03 : 0.12);
        const rand = seededRandom(hashString(`lurk::${profileKey}::${person.id}::${day}::${boardTeamId || 'g'}`));
        if (rand() < rate) {
            out.push({
                handle: altStateFor(profileKey, person.id, day).handle,
                altOf: person.id,
            });
        }
    }
    return out;
}

// ============================================================
// 预置帖
// ============================================================

const STANCE_TITLES = {
    fan: POST_POOLS.fanTitles,
    anti: POST_POOLS.antiTitles,
    passerby: POST_POOLS.passerbyTitles,
    analyst: POST_POOLS.analystTitles,
    memer: POST_POOLS.memerTitles,
};

const STANCE_COMMENTS = {
    fan: POST_POOLS.fanComments,
    anti: POST_POOLS.antiComments,
    passerby: POST_POOLS.passerbyComments,
    analyst: POST_POOLS.analystComments,
    memer: POST_POOLS.memerComments,
};

/**
 * 串子小号的「内部人口吻」标题池 —— 破绽故意留在措辞里，
 * 这是给用户「扒小号」准备的线索，UI 永远不主动点破。
 */
const INSIDER_TITLES = Object.freeze([
    '说个内部消息：{team}最近训练赛状态回勇了（别问我怎么知道的）',
    '{team}基地的外卖今天加鸡腿了，懂的都懂',
    '有些黑子真的看比赛了吗？{player}那波是队友喊的开团',
    '不站队，但{team}更衣室氛围没传闻那么差，真的',
    '蹲个眼熟的人：今天训练室灯又亮到凌晨两点',
    '别刷了，{player}手感其实没问题，是版本的事（内部视角）',
]);

/** 立场分布：粉丝多的板块吹的多，热度高的板块黑子也多（有人气才有人黑） */
function stanceBySeed(seedText, heat) {
    const roll = hashString(seedText) % 100;
    const antiShare = clamp(8 + heat / 5, 8, 30);
    if (roll < 32) return 'fan';
    if (roll < 32 + antiShare) return 'anti';
    if (roll < 62 + antiShare / 2) return 'passerby';
    if (roll < 82) return 'analyst';
    return 'memer';
}

/**
 * 某板块某天的预置帖（确定性）。
 *
 * @param {object} opts {
 *   profileKey, day, board, heat(0~100), roster, vars, userHandleNames:Set
 * }
 * vars 至少含 { team, opp, player, user, score, hero, pos }
 */
export function dailyBoardPosts(opts) {
    const { profileKey, day, board, heat = 40, roster, vars = {} } = opts;
    const teamId = board.teamId || '';
    const seedBase = `board::${profileKey}::${board.id}::${day}`;
    const count = board.kind === 'team'
        ? clamp(3 + Math.round(heat / 18), 3, 9)
        : clamp(5 + Math.round(heat / 22), 5, 10);

    const posts = [];
    const lurkers = lurkerPostersOf(profileKey, day, teamId, roster);

    for (let i = 0; i < count; i += 1) {
        const seed = `${seedBase}::${i}`;
        const stance = stanceBySeed(seed, heat);
        const titles = STANCE_TITLES[stance] || STANCE_TITLES.passerby;
        const lurker = lurkers[i - (count - lurkers.length)] || null;   // 串子排在靠后楼层
        const handle = lurker ? lurker.handle : fanHandle(seed);
        const minutes = 9 * 60 + (hashString(`${seed}::t`) % (13 * 60));
        // 串子有一半概率露出「内部人口吻」—— 扒小号的线索
        const insider = lurker && hashString(`${seed}::in`) % 2 === 0;
        posts.push({
            id: `pre::${board.id}::${day}::${i}`,
            kind: 'preset',
            boardId: board.id,
            day,
            stance: lurker ? (hashString(seed) % 2 === 0 ? 'fan' : 'memer') : stance,
            authorHandle: handle,
            authorKind: lurker ? 'alt' : 'fan',
            altOf: lurker ? lurker.altOf : '',
            title: fillTemplate(insider ? pickBySeed(INSIDER_TITLES, seed) : pickBySeed(titles, seed), vars),
            likes: hashString(`${seed}::l`) % Math.max(6, Math.round(heat * 1.6)),
            commentTotal: clamp(Math.round(heat / 8) + hashString(`${seed}::c`) % 14, 2, 46),
            postedMinute: minutes,
        });
    }

    // 解说 / 大 V 楼（只在总版，低频）
    if (board.kind === 'general' && roster?.voices?.length) {
        const rand = seededRandom(hashString(`${seedBase}::voice`));
        if (rand() < 0.5) {
            const voice = roster.voices[Math.floor(rand() * roster.voices.length)];
            posts.unshift({
                id: `pre::${board.id}::${day}::voice`,
                kind: 'preset',
                boardId: board.id,
                day,
                stance: 'analyst',
                authorHandle: voice.handle,
                authorKind: 'voice',
                altOf: '',
                title: fillTemplate(pickBySeed(POST_POOLS.analystTitles, `${seedBase}::vt`), vars),
                likes: 40 + hashString(`${seedBase}::vl`) % 220,
                commentTotal: 12 + hashString(`${seedBase}::vc`) % 60,
                postedMinute: 10 * 60 + (hashString(`${seedBase}::vm`) % 300),
            });
        }
    }
    return posts;
}

/** 预置帖正文（点开才拼，仍是零 token） */
export function presetPostBody(post, vars = {}) {
    const seed = `${post.id}::body`;
    const extras = {
        fan: ['真的建议大家去看回放，细节全是宝藏。', '不吹不黑，这个状态保持住，季后赛有得打。', '啊啊啊啊语无伦次了，就是很强！'],
        anti: ['有一说一，粉丝滤镜可以摘一摘了。', '数据摆在这，吹之前先看看面板。', '不接受反驳，赛场上见真章。'],
        passerby: ['纯路人视角，说错了轻喷。', '有没有大佬带我入门，想补补课。', '看了眼积分榜，好像确实有点东西。'],
        analyst: ['以下拆解基于最近三场的公开数据。', '先说结论，再放论据，欢迎理性讨论。', '篇幅有点长，感谢看完。'],
        memer: ['本帖不含任何技术含量，进来乐呵的。', '严肃讨论区隔壁请，这里只产梗。', '楼下开始表演。'],
    };
    const tail = pickBySeed(extras[post.stance] || extras.passerby, seed);
    return `${fillTemplate(post.title, vars)}\n\n${tail}`;
}

/**
 * 预置帖的楼层评论（确定性，一次给一页 5 条）。
 * @returns {Array<{id, floor, handle, altOf, stance, text, likes}>}
 */
export function presetComments(opts) {
    const { profileKey, post, page = 0, vars = {}, roster, day } = opts;
    const out = [];
    const perPage = 5;
    const start = page * perPage;
    const lurkers = lurkerPostersOf(profileKey, (day || post.day) + 1, '', roster);
    for (let f = start; f < Math.min(start + perPage, post.commentTotal); f += 1) {
        const seed = `${post.id}::cm::${f}`;
        const stance = stanceBySeed(seed, 50);
        const pool = STANCE_COMMENTS[stance] || STANCE_COMMENTS.passerby;
        const asLurker = lurkers.length > 0 && hashString(`${seed}::lk`) % 23 === 0;
        const lurker = asLurker ? lurkers[hashString(seed) % lurkers.length] : null;
        out.push({
            id: `${post.id}::c${f}`,
            floor: f + 1,
            handle: lurker ? lurker.handle : fanHandle(seed),
            altOf: lurker ? lurker.altOf : '',
            stance,
            text: fillTemplate(pickBySeed(pool, seed), vars),
            likes: hashString(`${seed}::l`) % 40,
        });
    }
    return out;
}

// ============================================================
// 官博（战队官方账号）
// ============================================================

/** 战队官博今天的动态（赛报优先，没比赛偶尔发日常） */
export function officialPosts(opts) {
    const { profileKey, day, teamId, teamName, heat = 40, seriesToday = [], teamNameOf } = opts;
    const posts = [];
    for (const s of seriesToday) {
        if (!s.result) continue;
        const isHome = s.homeId === teamId;
        const oppId = isHome ? s.awayId : s.homeId;
        const won = s.result.winnerId === teamId;
        const score = isHome
            ? `${s.result.homeScore}:${s.result.awayScore}`
            : `${s.result.awayScore}:${s.result.homeScore}`;
        const pool = won ? POST_POOLS.officialWin : POST_POOLS.officialLose;
        posts.push({
            id: `off::${teamId}::${s.id}`,
            kind: 'official',
            boardId: `team::${teamId}`,
            day,
            authorHandle: `${teamName}官方`,
            authorKind: 'official',
            altOf: '',
            stance: won ? 'fan' : 'passerby',
            title: fillTemplate(pickBySeed(pool, `off::${s.id}`), {
                team: teamName, opp: teamNameOf(oppId), score,
            }),
            likes: Math.round(heat * (won ? 3.2 : 1.6)) + hashString(`off::${s.id}::l`) % 60,
            commentTotal: clamp(Math.round(heat / 4) + (won ? 10 : 4), 6, 99),
            postedMinute: 21 * 60 + (hashString(`off::${s.id}::m`) % 90),
        });
    }
    if (!posts.length) {
        const rand = seededRandom(hashString(`off-daily::${profileKey}::${teamId}::${day}`));
        if (rand() < 0.3) {
            posts.push({
                id: `off::${teamId}::daily::${day}`,
                kind: 'official',
                boardId: `team::${teamId}`,
                day,
                authorHandle: `${teamName}官方`,
                authorKind: 'official',
                altOf: '',
                stance: 'passerby',
                title: pickBySeed(POST_POOLS.officialAnnounce, `offd::${teamId}::${day}`),
                likes: Math.round(heat * 1.2),
                commentTotal: clamp(Math.round(heat / 6), 3, 40),
                postedMinute: 12 * 60,
            });
        }
    }
    return posts;
}

// ============================================================
// 选手评分
// ============================================================

/**
 * 粉丝均分（2.0 ~ 9.9，一位小数）：实力 + 战绩动量 + 粉丝滤镜。
 */
export function fanScoreFor(profileKey, player, day, momentum = 0) {
    const skill = clamp(
        ((player.attrs?.mechanics ?? 50) + (player.attrs?.awareness ?? 50)) / 2, 0, 100,
    );
    const bias = ((hashString(`score::${profileKey}::${player.id}`) % 21) - 10) / 10; // ±1.0 粉丝滤镜
    const wave = ((hashString(`scorewave::${player.id}::${Math.floor(day / 7)}`) % 11) - 5) / 10;
    const score = 3.2 + skill / 20 + momentum * 0.4 + bias + wave;
    return Math.round(clamp(score, 2, 9.9) * 10) / 10;
}

/** 评分页的热评（确定性两条） */
export function ratingComments(playerId, day) {
    return [0, 1].map((i) => ({
        id: `rt::${playerId}::${Math.floor(day / 7)}::${i}`,
        handle: fanHandle(`rt::${playerId}::${i}::${Math.floor(day / 7)}`),
        text: pickBySeed(POST_POOLS.ratingComments, `rt::${playerId}::${day}::${i}`),
    }));
}

// ============================================================
// 战绩围观（论坛看到 rank 记录并点评）
// ============================================================

export function rankWatchStub({ session, userGameId }) {
    const goodRun = session.wins >= session.losses;
    return {
        title: fillTemplate(
            pickBySeed(POST_POOLS.rankWatchTitles, `rw::${session.id}`),
            { user: userGameId },
        ),
        summary: `${session.modeLabel} ${session.wins}胜${session.losses}负 · 巅峰分 ${session.ratingAfter}（${session.ratingDelta >= 0 ? '+' : ''}${session.ratingDelta}）`,
        goodRun,
    };
}

/** 战绩围观楼的预置评论（生成锐评之前也有人气） */
export function rankWatchComments({ session, page = 0, vars = {} }) {
    const goodRun = session.wins >= session.losses;
    const pool = goodRun ? POST_POOLS.rankWatchGood : POST_POOLS.rankWatchBad;
    const out = [];
    const perPage = 5;
    for (let f = page * perPage; f < Math.min(page * perPage + perPage, 12); f += 1) {
        const seed = `rw::${session.id}::c${f}`;
        out.push({
            id: seed,
            floor: f + 1,
            handle: fanHandle(seed),
            altOf: '',
            stance: goodRun ? 'fan' : 'anti',
            text: fillTemplate(pickBySeed(pool, seed), vars),
            likes: hashString(`${seed}::l`) % 30,
        });
    }
    return out;
}

export function stanceLabel(stance) {
    return STANCES.find((s) => s.id === stance)?.label || '路人';
}
