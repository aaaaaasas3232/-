/**
 * 日记 · Prompt 组装（唯一真相）
 *
 * ── 复用的是框架层那套，不自创 ────────────────────────────────────
 *
 * `createContextComposer`（`src/core/context-composer.js`）是 murmur 和
 * 梦境编织共用的上下文拼装器。它提供：
 *
 *   - 段落模型 `{ id, title, tag, content, active, locked, source }`
 *   - `<XX开始>` / `<XX结束>` 成对标签（按段替换/剪切不用脆弱的启发式）
 *   - 跨语言的 token 估算
 *   - 快照（发送前同步读得到，localStorage 不是 IndexedDB）
 *
 * 用它而不是自己拼字符串的理由写在那个文件顶部：**预览和发送必须是
 * 同一次调用的两个返回字段**，物理上不可能不一致。梦境编织原型正是
 * 栽在「预览走 A 函数、发送走 B 函数」上 —— 用户在预览里关掉世界观，
 * 世界观照发不误。
 *
 *   const { text, parts, stats } = buildPrompt({ ... });
 *   //      ↑ 发给 AI      ↑ 给用户看
 *
 * ── 写 prompt 的风格 ──────────────────────────────────────────────
 *
 * 对齐 `docs/跨App注册Prompt指导方案.md` §5.1：
 *
 *   XX须知:
 *     - Principle: 一句话说清这段干嘛的。
 *     - Behaviors:
 *       - 具体动作
 *       - 边界条件
 *
 * Principle 一条，Behaviors 三到六条。**不铺陈背景** —— 上下文长度有限，
 * 多写一百行解释就等于把用户的日记正文挤掉一百行（AGENTS2 §9.5）。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import {
    CONTEXT_SECTIONS, ENTRY_KIND, KIND_RULES, ACTION_FORMAT_HELP,
    MARKER_KIND, MOODS, RECENT_DIARY_LIMIT, RECENT_PEER_LIMIT,
    CONTEXT_TOKEN_BUDGET, OWNER_KIND, LAYOUT_STYLES, THEMES,
} from '../constants.js';
import {
    todayKey, formatDateLabel, weekdayLabel, daysFromToday,
    truncate, kvBlock, compareDateKey, describeWindow,
} from '../utils.js';
import { resolveCycle, buildCyclePrompt } from './cycle-service.js';
import * as nook from './nook-bridge.js';

const composer = createContextComposer({
    namespace: 'diary',
    tokenBudget: CONTEXT_TOKEN_BUDGET,
});

export { composer };

function sectionMeta(id) {
    return CONTEXT_SECTIONS.find((s) => s.id === id) || { id, tag: id, label: id };
}

// ============================================================
// 各段正文
// ============================================================

/**
 * 写作须知。日记和便利贴用的是两套规则 —— 时段外生成的是便利贴，
 * 那时候让 AI 写 300 字日记就完全跑偏了。
 */
function buildWriteRulesPart(ctx) {
    const rules = KIND_RULES[ctx.kind] || KIND_RULES[ENTRY_KIND.DIARY];
    const who = ctx.authorKind === OWNER_KIND.AI
        ? '你在写你自己的日记。'
        : `你在替「${ctx.selfName || '我'}」起草今天的日记，用第一人称，写成她自己会写的样子。`;
    const when = ctx.date
        ? `今天是 ${formatDateLabel(ctx.date, { withYear: true })}，${weekdayLabel(ctx.date)}。`
        : '';
    return `${rules}\n\n${who}${when}`;
}

function buildIdentityPart(ctx) {
    return ctx.authorKind === OWNER_KIND.AI
        ? nook.describeAi(ctx.selfCard)
        : nook.describeUser(ctx.selfCard);
}

function buildPeerPart(ctx) {
    if (!ctx.peerCard) return '';
    const body = ctx.authorKind === OWNER_KIND.AI
        ? nook.describeUser(ctx.peerCard)
        : nook.describeAi(ctx.peerCard);
    if (!body) return '';
    const rel = ctx.authorKind === OWNER_KIND.AI
        ? '这是你日记里经常写到的那个人。'
        : '这是我日记里经常写到的那个人。';
    return `${rel}\n${body}`;
}

function buildWorldPart(ctx) {
    return nook.describeWorld(ctx.world);
}

/**
 * 这本日记的调子。
 *
 * AI 自己配置日记本时写下的 `styleNote` 落在这里 —— 它决定了这本日记
 * 读起来像谁写的。没有这一段，两个性格完全不同的 AI 写出来的日记会一模一样。
 */
function buildSpaceStylePart(ctx) {
    const space = ctx.space;
    if (!space) return '';
    const themeName = THEMES.find((t) => t.id === space.theme)?.name || '';
    const layoutName = LAYOUT_STYLES.find((l) => l.id === space.layout)?.name || '';
    return kvBlock([
        ['日记本名字', space.title],
        ['写日记的习惯', space.styleNote],
        ['习惯的写作时段', describeWindow(space.windowStart)],
        ['本子的样子', [themeName, layoutName].filter(Boolean).join(' · ')],
    ]);
}

/** 生理期 —— 内容由 cycle-service 现算，这里只决定放不放 */
function buildCyclePart(ctx) {
    if (!ctx.cycleInfo?.enabled) return '';
    // 写自己的日记时用第一人称，AI 写自己的日记时提到的是「用户」
    const subject = ctx.authorKind === OWNER_KIND.AI ? 'user' : 'self';
    return buildCyclePrompt(ctx.cycleSpace || ctx.space, ctx.cycleInfo, subject);
}

/**
 * 纪念日与计划。
 *
 * 产品要求「ai 知道用户的月经、知道用户的考试时间、知道音乐会时间都是合理的」——
 * 靠的就是这一段：两边的 marker 都进来，不区分是谁记的。
 */
function buildMarkersPart(ctx) {
    const list = (Array.isArray(ctx.markers) ? ctx.markers : []).filter((m) => m.date);
    if (list.length === 0) return '';

    const past = [];
    const future = [];
    for (const m of list) {
        const delta = nextOccurrenceDelta(m);
        if (delta == null) continue;
        if (m.kind === MARKER_KIND.COUNTDOWN) {
            if (delta >= 0) future.push({ m, delta });
        } else {
            const since = daysFromToday(m.date);
            if (since != null && since <= 0) past.push({ m, since: -since, delta });
        }
    }

    past.sort((a, b) => a.since - b.since);
    future.sort((a, b) => a.delta - b.delta);

    const lines = [];
    for (const { m, since, delta } of past.slice(0, 8)) {
        // 每年重复的纪念日：同时给「已经多久」和「离下一次还有几天」
        const anniv = m.repeat !== 'none' && delta != null && delta <= 45
            ? `，再过 ${delta} 天就又到这个日子了`
            : '';
        lines.push(`· ${m.title}（${formatDateLabel(m.date, { withYear: true })}）已经过去 ${since} 天${anniv}${m.reason ? ` —— ${m.reason}` : ''}`);
    }
    for (const { m, delta } of future.slice(0, 8)) {
        const when = delta === 0 ? '就是今天' : delta === 1 ? '就是明天' : `还有 ${delta} 天`;
        lines.push(`· ${m.title}（${formatDateLabel(m.date, { withYear: true })}）${when}${m.reason ? ` —— ${m.reason}` : ''}`);
    }

    if (lines.length === 0) return '';
    return `这些日子对我们有意义：\n${lines.join('\n')}`;
}

/** 下一次发生距今几天。不重复的过去事件返回负数。 */
function nextOccurrenceDelta(marker) {
    const base = daysFromToday(marker.date);
    if (base == null) return null;
    if (marker.repeat === 'none' || base >= 0) return base;

    const d = new Date();
    const src = marker.date.split('-').map(Number);
    if (marker.repeat === 'yearly') {
        let year = d.getFullYear();
        let next = `${year}-${String(src[1]).padStart(2, '0')}-${String(src[2]).padStart(2, '0')}`;
        if (compareDateKey(next, todayKey()) < 0) {
            year += 1;
            next = `${year}-${String(src[1]).padStart(2, '0')}-${String(src[2]).padStart(2, '0')}`;
        }
        return daysFromToday(next);
    }
    if (marker.repeat === 'monthly') {
        let year = d.getFullYear();
        let month = d.getMonth() + 1;
        let next = `${year}-${String(month).padStart(2, '0')}-${String(src[2]).padStart(2, '0')}`;
        if (compareDateKey(next, todayKey()) < 0) {
            month += 1;
            if (month > 12) { month = 1; year += 1; }
            next = `${year}-${String(month).padStart(2, '0')}-${String(src[2]).padStart(2, '0')}`;
        }
        return daysFromToday(next);
    }
    return base;
}

function moodName(id) {
    return MOODS.find((m) => m.id === id)?.name || '';
}

function renderEntryLines(entries, limit) {
    return (Array.isArray(entries) ? entries : [])
        .filter((e) => String(e.content || '').trim())
        .sort((a, b) => compareDateKey(b.date, a.date))
        .slice(0, limit)
        .reverse()
        .map((e) => {
            const mood = moodName(e.mood);
            const head = `【${formatDateLabel(e.date, { withYear: true })}${mood ? ` · ${mood}` : ''}】`;
            return `${head}\n${truncate(e.content, 300)}`;
        })
        .join('\n\n');
}

function buildRecentSelfPart(ctx) {
    return renderEntryLines(ctx.selfEntries, RECENT_DIARY_LIMIT);
}

/**
 * 对方最近写的。
 *
 * 这是本 App 的核心设定：「用户能看 AI 的日记，AI 也能看用户的日记」。
 * 所以这一段是双向的 —— AI 写自己日记时能读到用户写的，反之亦然。
 */
function buildRecentPeerPart(ctx) {
    const body = renderEntryLines(ctx.peerEntries, RECENT_PEER_LIMIT);
    if (!body) return '';
    const who = ctx.peerName || '对方';
    return `${who}最近写的日记（你能翻到，可以在自己的日记里提到，但不要逐句复述）：\n\n${body}`;
}

function buildTodayNotesPart(ctx) {
    const list = (Array.isArray(ctx.todayNotes) ? ctx.todayNotes : [])
        .filter((n) => String(n.content || '').trim())
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (list.length === 0) return '';
    const lines = list.map((n) => `· ${truncate(n.content, 120)}`);
    return `今天零零碎碎记下来的（写日记时可以用上，不用全用）：\n${lines.join('\n')}`;
}

/**
 * 重 roll 时用户提的修改意见。
 *
 * 产品要求「重 roll 的时候给用户弹窗，用户可以提修改意见，不提也行」——
 * 不提时这一段是空的，composer 会自动跳过（空内容的段不进最终文本）。
 */
function buildUserWishPart(ctx) {
    const wish = String(ctx.wish || '').trim();
    if (!wish) return '';
    return `这一版要按下面的要求重写：\n${wish}\n\n上一版的内容仅供参考，不要照抄：\n${truncate(ctx.previousContent || '', 400)}`;
}

function buildActionFormatPart(ctx) {
    // 便利贴太短，塞回写格式只会让它变成一行 token
    return ctx.kind === ENTRY_KIND.NOTE ? '' : ACTION_FORMAT_HELP;
}

// ============================================================
// 组装
// ============================================================

const BUILDERS = {
    writeRules: buildWriteRulesPart,
    identity: buildIdentityPart,
    world: buildWorldPart,
    peer: buildPeerPart,
    spaceStyle: buildSpaceStylePart,
    cycle: buildCyclePart,
    markers: buildMarkersPart,
    recentSelf: buildRecentSelfPart,
    recentPeer: buildRecentPeerPart,
    todayNotes: buildTodayNotesPart,
    userWish: buildUserWishPart,
    actionFormat: buildActionFormatPart,
};

/**
 * 产出这次生成的全部上下文段落。
 *
 * **预览面板和发送共用这一个函数** —— 整个模块最重要的一条约束。
 *
 * @param {object} ctx
 * @param {object} ctx.space        当前日记空间
 * @param {object} ctx.selfCard     空间主人的人设卡
 * @param {object} [ctx.peerCard]   另一侧的人设卡
 * @param {object} [ctx.world]      世界观
 * @param {object[]} [ctx.selfEntries]
 * @param {object[]} [ctx.peerEntries]
 * @param {object[]} [ctx.todayNotes]
 * @param {object[]} [ctx.markers]
 * @param {object} [ctx.cycleInfo]  resolveCycle 的结果
 * @param {string} [ctx.kind]       'diary' | 'note'
 * @param {string} [ctx.wish]       重 roll 时的修改意见
 * @returns {import('@/src/core/context-composer.js').ContextPart[]}
 */
export function buildContextParts(ctx = {}) {
    const config = ctx.space?.contextConfig || {};
    return CONTEXT_SECTIONS.map((meta) => {
        let content = '';
        try {
            content = BUILDERS[meta.id]?.(ctx) || '';
        } catch (err) {
            // 单段拼装失败不该让整次生成挂掉 —— 少一段总比什么都发不出去强
            console.warn(`[diary/prompt] 段落 ${meta.id} 拼装失败`, err);
        }
        return {
            id: meta.id,
            title: meta.label,
            tag: meta.tag,
            content,
            // locked 的段不给关：关掉「写作须知」AI 会开始写小作文
            active: meta.locked ? true : config[meta.id] !== false,
            locked: meta.locked === true,
            source: meta.desc,
        };
    });
}

/**
 * 拼出最终 system prompt。
 *
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildPrompt(ctx = {}) {
    const parts = buildContextParts(ctx);
    const scope = `${ctx.space?.id || 'none'}::${ctx.date || todayKey()}`;
    return composer.composeAndSave(scope, parts, {
        order: Array.isArray(ctx.space?.contextOrder) ? ctx.space.contextOrder : undefined,
    });
}

/**
 * 本轮指令（user message）。
 *
 * 和 system prompt 分开：system 是设定（每轮基本不变，便于服务端缓存），
 * 这一段才是「现在要你干嘛」。梦境编织原型把两者拼成一个巨大字符串塞进
 * system，既浪费缓存也让模型分不清「设定」和「本轮任务」。
 */
export function buildWriteTurn(ctx = {}) {
    const isNote = ctx.kind === ENTRY_KIND.NOTE;
    const hint = String(ctx.hint || '').trim();

    if (ctx.wish) {
        return isNote
            ? '按上面的要求重写这张便利贴。只输出内容本身。'
            : '按上面「这次的要求」重写今天的日记。只输出日记正文。';
    }
    if (isNote) {
        return hint
            ? `写一张便利贴，关于：${hint}。只输出内容本身。`
            : '写一张此刻的便利贴。只输出内容本身。';
    }
    return hint
        ? `写今天的日记，我想写的是：${hint}。只输出日记正文。`
        : '写今天的日记。只输出日记正文。';
}

/** 读上一次拼好的快照（「上次发出去的是什么」这类回看） */
export function readLastPrompt(spaceId, date) {
    return composer.load(`${spaceId || 'none'}::${date || todayKey()}`);
}

/**
 * 快速预览：不需要完整 ctx，给设置页展示「大概会发什么」。
 *
 * 拿不到数据时返回空段而不是抛错 —— 设置页在 SDK 就绪前也会渲染。
 */
export function buildPreview(ctx = {}) {
    const parts = buildContextParts(ctx);
    return composer.compose(parts, {
        order: Array.isArray(ctx.space?.contextOrder) ? ctx.space.contextOrder : undefined,
    });
}

/**
 * 给外部（murmur / 小组件）看的极简摘要：这个人现在的生理期和最近的日子。
 * 不含日记正文 —— 日记是私密的，只有本 App 内部拼 prompt 时才展开。
 */
export function buildDigest({ space, cycleDays, markers, subject = 'user' } = {}) {
    if (!space) return '';
    const info = resolveCycle(space, cycleDays || []);
    const blocks = [];
    const cycle = buildCyclePrompt(space, info, subject);
    if (cycle) blocks.push(cycle);
    const mk = buildMarkersPart({ markers });
    if (mk) blocks.push(mk);
    return blocks.join('\n\n');
}
