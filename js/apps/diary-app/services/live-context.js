/**
 * 日记 · 发送时现算的上下文（暴露给 murmur）
 *
 * ── 为什么不能只靠 `toolkit.prompts.register` ─────────────────────
 *
 * 注册进 murmur 的 prompt 是**静态字符串**，在 `setup()` 时写一次。
 * 而这个 App 要注入的东西每天都在变：
 *
 *   「还有两天时间用户就要来月经」→ 明天就该变成「还有一天」
 *   「距离音乐会还有 12 天」        → 后天就是 10 天
 *
 * 更糟的是 murmur 发消息时读的是 prompt-manager 生成的 **pre 快照**，
 * 用户不打开那一页，快照根本不会刷新 —— 于是 AI 可能一个月都以为
 * 「还有两天」（AGENTS2 §4.1 一起听踩过一模一样的坑）。
 *
 * ── 解法：和一起听同款 ───────────────────────────────────────────
 *
 * 分成两半：
 *
 *   **静态行为**（`app-prompts.js`）→ 注册到 murmur，用户看得见、能开关、能改
 *       「你知道她在记日记 / 你会照顾她的生理期 / 你可以用 [记纪念日:] 存日子」
 *
 *   **实时数据**（本文件）→ 发送前由 `chat-app/services/ai-service.js` 现算
 *       「今天是经期第 3 天 / 距离考试还有 6 天」
 *
 * chat 侧**不 import 本模块**，只读 `window.__diaryContext`。
 * 日记 App 被卸载时那边全是 optional chaining，不会炸。
 *
 * ── 数据从哪来 ───────────────────────────────────────────────────
 *
 * 优先内存里的 live state；拿不到就回落 localStorage 快照 ——
 * 对应「这次会话里用户从来没打开过日记 App，但昨天记的经期还得算数」。
 * 快照走 localStorage 而不是 IndexedDB，因为发送前必须**同步**读得到。
 */

import { buildCyclePrompt, resolveCycle } from './cycle-service.js';
import { MARKER_KIND, OWNER_KIND, makeSpaceId } from '../constants.js';
import {
    todayKey, formatDateLabel, daysFromToday, compareDateKey, truncate,
} from '../utils.js';

/**
 * ai-service / prompt-manager 靠这个标题识别并替换旧段落。
 *
 * ⚠️ 这段内容里**不能出现 `#` 开头的子标题** —— 老版剪切逻辑按
 *    「一级标题到下一个一级标题」切，出现子标题会剪不干净，
 *    在 pre 里留下半截旧内容（AGENTS2 §4.3）。
 */
export const DIARY_CONTEXT_HEADING = '# 日记本（实时）';

const SNAPSHOT_KEY = 'xiaoting::diary-live-snapshot-v1';

let _live = null;

/**
 * 日记 App hydrate 完之后把状态挂进来。
 * 挂的是 store 的 STATE 引用，所以后续任何改动都能立刻读到。
 */
export function bindLiveState(state) {
    _live = state || null;
}

/**
 * 写一份精简快照到 localStorage。
 *
 * 只存拼 prompt 真正需要的东西：空间配置、经期打卡、纪念日、
 * 以及**最近两篇日记的摘要**（不是全文 —— 全文会把 localStorage 撑爆，
 * 而且 AI 也不需要逐字读）。
 */
export function writeSnapshot(state) {
    if (typeof localStorage === 'undefined' || !state) return;
    try {
        const payload = {
            savedAt: Date.now(),
            spaces: (state.spaces || []).map((s) => ({
                id: s.id, ownerKind: s.ownerKind, ownerId: s.ownerId,
                title: s.title, styleNote: s.styleNote, configured: s.configured,
                cycle: s.cycle,
            })),
            cycleDays: (state.cycleDays || []).slice(-120),
            markers: state.markers || [],
            recent: (state.entries || [])
                .slice()
                .sort((a, b) => compareDateKey(b.date, a.date))
                .slice(0, 12)
                .map((e) => ({
                    spaceId: e.spaceId, date: e.date, mood: e.mood,
                    excerpt: truncate(e.content, 90),
                })),
        };
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
    } catch (_) {
        // 隐私模式 / 配额满：内存那份仍然可用，不影响本次会话
    }
}

function readSource() {
    if (_live?.spaces?.length) return _live;
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && Array.isArray(parsed.spaces) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function findSpace(src, spaceId) {
    return (src?.spaces || []).find((s) => String(s.id) === String(spaceId)) || null;
}

function rowsOf(src, key, spaceId) {
    return (src?.[key] || []).filter((r) => String(r.spaceId) === String(spaceId));
}

/** 用户空间 id —— 跟着默认用户卡走，和 App 内部的口径完全一致 */
function userSpaceId() {
    const uid = window.settingsSdk?.defaultUserCard?.getDefaultId?.()
        || window.settingsSdk?.users?.getActive?.()?.id;
    return uid ? makeSpaceId(OWNER_KIND.USER, uid) : '';
}

// ============================================================
// 生成段落
// ============================================================

function markerLines(markers, limit = 6) {
    const today = todayKey();
    const out = [];

    const future = markers
        .filter((m) => m.kind === MARKER_KIND.COUNTDOWN && m.date && compareDateKey(m.date, today) >= 0)
        .map((m) => ({ m, d: daysFromToday(m.date) }))
        .filter((x) => x.d != null)
        .sort((a, b) => a.d - b.d)
        .slice(0, limit);

    for (const { m, d } of future) {
        const when = d === 0 ? '就是今天' : d === 1 ? '就是明天' : `还有 ${d} 天`;
        out.push(`· ${m.title}（${formatDateLabel(m.date)}）${when}${m.reason ? ` —— ${m.reason}` : ''}`);
    }

    // 纪念日只报「快到了」的，平时不占篇幅
    const soon = markers
        .filter((m) => m.kind === MARKER_KIND.ANNIVERSARY && m.date && m.repeat !== 'none')
        .map((m) => {
            const src = m.date.split('-');
            const y = new Date().getFullYear();
            let next = `${y}-${src[1]}-${src[2]}`;
            if (compareDateKey(next, today) < 0) next = `${y + 1}-${src[1]}-${src[2]}`;
            return { m, d: daysFromToday(next) };
        })
        .filter((x) => x.d != null && x.d <= 14)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);

    for (const { m, d } of soon) {
        const years = new Date().getFullYear() - Number(m.date.slice(0, 4));
        const when = d === 0 ? '就是今天' : `还有 ${d} 天`;
        out.push(`· ${m.title}${years > 0 ? ` ${years} 周年` : ''}${when === '就是今天' ? '就是今天' : `，${when}`}${m.reason ? ` —— ${m.reason}` : ''}`);
    }

    return out;
}

/**
 * 只读接口：用户记下的「日子」（倒计时 + 纪念日），给别的 App 用。
 *
 * 世界观的「时间表」要把它们和世界纪时摆在一起，但**不能 import 日记的 store**
 * （跨 App 直接引 store 是本项目的红线）。所以走这里，和 chat 读
 * `window.__diaryContext` 是同一条路：内存优先、回落 localStorage 快照，
 * 日记 App 没装 / 没打开过都不会炸。
 *
 * @returns {{countdowns: Array, anniversaries: Array}}
 *   countdowns    [{ title, date, dateLabel, days, reason }]  days = 还有几天
 *   anniversaries [{ title, date, dateLabel, days, years, reason, repeat }] days = 已经几天
 */
export function getUserDayMarkers({ countdownLimit = 8, anniversaryLimit = 8 } = {}) {
    const empty = { countdowns: [], anniversaries: [] };
    const src = readSource();
    if (!src) return empty;
    const spaceId = userSpaceId();
    if (!spaceId) return empty;

    const markers = rowsOf(src, 'markers', spaceId);
    if (!markers.length) return empty;
    const today = todayKey();

    const countdowns = markers
        .filter((m) => m.kind === MARKER_KIND.COUNTDOWN && m.date && compareDateKey(m.date, today) >= 0)
        .map((m) => ({ m, d: daysFromToday(m.date) }))
        .filter((x) => x.d != null)
        .sort((a, b) => a.d - b.d)
        .slice(0, countdownLimit)
        .map(({ m, d }) => ({
            title: m.title || '未命名',
            date: m.date,
            dateLabel: formatDateLabel(m.date),
            days: d,
            reason: m.reason || '',
        }));

    const anniversaries = markers
        .filter((m) => m.kind === MARKER_KIND.ANNIVERSARY && m.date && compareDateKey(m.date, today) <= 0)
        .map((m) => ({ m, d: -(daysFromToday(m.date) || 0) }))
        .sort((a, b) => (b.m.pinned ? 1 : 0) - (a.m.pinned ? 1 : 0) || a.d - b.d)
        .slice(0, anniversaryLimit)
        .map(({ m, d }) => ({
            title: m.title || '未命名',
            date: m.date,
            dateLabel: formatDateLabel(m.date, { withYear: true }),
            days: d,
            years: Math.max(0, new Date().getFullYear() - Number(String(m.date).slice(0, 4))),
            reason: m.reason || '',
            repeat: m.repeat || '',
        }));

    return { countdowns, anniversaries };
}

/**
 * 生成塞进 systemPrompt 的日记本段落。
 *
 * @param {string} aiPersonId 当前对话的 AI 人设 id
 * @returns {string} 没有可说的就返回空串，调用方什么都不做
 */
export function buildDiaryContext(aiPersonId) {
    const src = readSource();
    if (!src) return '';

    const lines = [DIARY_CONTEXT_HEADING];
    let hasContent = false;

    // ── 用户这一侧 ─────────────────────────────
    const uSpaceId = userSpaceId();
    const uSpace = uSpaceId ? findSpace(src, uSpaceId) : null;
    if (uSpace?.configured) {
        const days = rowsOf(src, 'cycleDays', uSpaceId);
        const info = resolveCycle(uSpace, days);
        const cycle = buildCyclePrompt(uSpace, info, 'user');
        if (cycle) {
            lines.push('', cycle);
            hasContent = true;
        }

        const mk = markerLines(rowsOf(src, 'markers', uSpaceId));
        if (mk.length) {
            lines.push('', '用户记在日记本里的日子：', ...mk);
            hasContent = true;
        }

        const recent = (src.recent || [])
            .filter((r) => String(r.spaceId) === uSpaceId)
            .slice(0, 2);
        if (recent.length) {
            lines.push('', '用户最近的日记（你翻得到，可以自然地提，但不要逐字复述）：');
            for (const r of recent) lines.push(`· ${formatDateLabel(r.date)}：${r.excerpt}`);
            hasContent = true;
        }
    }

    // ── AI 自己这一侧 ───────────────────────────
    if (aiPersonId) {
        const aiSpaceId = makeSpaceId(OWNER_KIND.AI, aiPersonId);
        const aiSpace = findSpace(src, aiSpaceId);
        if (aiSpace?.configured) {
            const own = (src.recent || [])
                .filter((r) => String(r.spaceId) === aiSpaceId)
                .slice(0, 2);
            if (own.length) {
                lines.push('', `你自己也在写日记（《${aiSpace.title || '无题'}》）。你最近写的：`);
                for (const r of own) lines.push(`· ${formatDateLabel(r.date)}：${r.excerpt}`);
                hasContent = true;
            }
            const mk = markerLines(rowsOf(src, 'markers', aiSpaceId), 3);
            if (mk.length) {
                lines.push('', '你自己记下的日子：', ...mk);
                hasContent = true;
            }
        }
    }

    if (!hasContent) return '';
    lines.push('', '这些是你本来就知道的事，不要一上来就全说一遍，等聊到了再自然带出来。');
    return lines.join('\n');
}

/** 现在有没有东西可注入（prompt-manager 用它决定要不要画那张虚拟卡） */
export function hasDiaryContext(aiPersonId) {
    return buildDiaryContext(aiPersonId).length > 0;
}

/**
 * 把 pre 里旧的日记段落删掉。ai-service 每次发送前都会重拼一份最新的。
 *
 * ── 只按成对标签剪，**不做「标题到下一个标题」那种兜底** ──────────
 *
 * 一起听那套老代码留了个按 `# 一级标题` 定位的分支，它的语义是
 * 「从标题一直吃到下一个 `#` 开头的行」。问题在于本段内容里没有子标题，
 * 于是一旦这个分支被走到，**它会把后面所有内容一起吃掉** ——
 * 表现为「发出去的 prompt 莫名其妙少了一半」，而且极难联想到原因。
 * （AGENTS2 §4.3 记的「那段内部不能出现 `#`」就是这个约束的反面。）
 *
 * 日记 App 是全新的，不存在任何「没有标签的历史快照」需要兼容，
 * 所以这里干脆只认标签。两个注入点都会包标签：
 *   - `chat-ai-service`   `wrapPromptBlock('日记本', …)`
 *   - `prompt-manager`    `resolveTagName({ id:'diary-live' })` → 同样是「日记本」
 *
 * 顺带也剪一下 `日记本（实时）` —— 那是 `resolveTagName` 没配映射时
 * 会按卡片标题生成的名字，配错了至少不会重复注入。
 */
const STRIP_TAGS = ['日记本', '日记本（实时）'];

export function stripDiaryBlock(text) {
    let src = String(text || '');
    if (!src) return '';

    for (const tag of STRIP_TAGS) {
        const openTag = `<${tag}开始>`;
        const closeTag = `<${tag}结束>`;
        for (;;) {
            const start = src.indexOf(openTag);
            if (start === -1) break;
            const closeAt = src.indexOf(closeTag, start + openTag.length);
            // 没有闭标签说明内容被截断过，只能剪到末尾 —— 留着半截更糟
            const end = closeAt === -1 ? src.length : closeAt + closeTag.length;
            const before = src.slice(0, start).replace(/[\r\n]+$/, '');
            const after = src.slice(end).replace(/^[\r\n]+/, '');
            src = [before, after].filter(Boolean).join('\n\n');
        }
    }
    return src;
}

// ---------------------------------------------------------------------------
// 暴露给 chat（不产生模块依赖）
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
    window.__diaryContext = {
        heading: DIARY_CONTEXT_HEADING,
        getContext: buildDiaryContext,
        isActive: hasDiaryContext,
        strip: stripDiaryBlock,
        // 世界观「时间表」读这个（纪念日 / 倒计时），不要去 import 日记 store
        getDayMarkers: getUserDayMarkers,
    };
}
