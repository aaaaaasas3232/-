/**
 * 群聊小游戏 / AI 调用
 *
 * 三个游戏共用这一份。原型里狼人杀有 `callGameAI` 一个统一入口，
 * 但旁边还散着七八个「自己 new 一个请求」的函数（狼队友讨论、上帝旁白、
 * 女巫心理、遗言、复盘…），每一份的重试策略和失败兜底都不一样 ——
 * 有的重试两次，有的直接放弃，有的失败了往界面上塞「(网络异常)」当成
 * AI 真的说了这句话。
 *
 * 这里只有一个出口 `askAi()`，失败语义是明确的：
 *   `{ ok: false }` —— 调用方**必须**自己给出兜底决策，
 *   不允许把错误字符串当成 AI 的发言塞进对局记录。
 */

import { TIMING } from './constants.js';
import { getSession } from './store.js';

/**
 * 这一局还在不在。
 *
 * 用户放弃对局之后，正在重试的 AI 请求应该立刻停手 —— 否则一次失败的调用
 * 能拖两分钟（超时 45s × 3 次），期间还在白烧配额，
 * 拿回来的结果也会被 `writeSession` 的 id 校验丢掉。
 */
function stillAlive(session) {
    if (!session?.groupId) return true;   // 没带 session 的调用（出题）不做判断
    const cur = getSession(session.groupId);
    return !!cur && cur.id === session.id;
}

/**
 * 解析这一局该用哪个 API。
 *
 * 顺序：对局开局时选定的 → 该 AI 人设绑的 → 用户人设绑的 → 第一个可用的。
 *
 * ★ 「对局开局时选定的」要放第一位：一局狼人杀会打十几个 AI 请求，
 *   中途用户去改了某个 AI 的绑定，不该让同一局里前后用不同的模型。
 */
export function resolveGameApiRef(session, aiPersonId) {
    const apiSdk = typeof window !== 'undefined' ? window.__apiSdk : null;
    if (!apiSdk) return null;

    const tryRef = (type, id) => {
        if (!id) return null;
        if (type === 'key') {
            const k = apiSdk.apiKeySdk?.get?.(id);
            if (k && k.enabled !== false) return { type: 'key', refId: k.id || id };
            return null;
        }
        const g = apiSdk.apiGroupSdk?.get?.(id);
        if (g) return { type: 'group', refId: g.id || id };
        return null;
    };

    if (session?.apiRef) {
        const hit = tryRef(session.apiRef.type, session.apiRef.refId);
        if (hit) return hit;
    }

    const sdk = typeof window !== 'undefined' ? window.settingsSdk : null;
    const collect = (entity) => {
        const refs = Array.isArray(entity?.boundResources?.apiRefs) ? entity.boundResources.apiRefs : [];
        for (const r of refs) {
            if (!r || typeof r !== 'object') continue;
            // 历史上这个字段有四种形态，全都要认（AGENTS2 §3.4 同款）
            const type = r.refType || r.type || (r.apiKeyId ? 'key' : (r.groupId ? 'group' : ''));
            const id = r.refId || r.id || r.apiKeyId || r.groupId || '';
            const hit = tryRef(type === 'group' ? 'group' : 'key', id);
            if (hit) return hit;
        }
        return null;
    };

    if (aiPersonId) {
        const hit = collect(sdk?.aiPersons?.get?.(aiPersonId));
        if (hit) return hit;
    }
    const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
    const userHit = collect(user);
    if (userHit) return userHit;

    const firstKey = apiSdk.apiKeySdk?.list?.()?.find?.((k) => k && k.enabled !== false);
    if (firstKey) return { type: 'key', refId: firstKey.id };
    const firstGroup = apiSdk.apiGroupSdk?.list?.()?.[0];
    if (firstGroup) return { type: 'group', refId: firstGroup.id };
    return null;
}

/** 大厅/设置页用：现在到底能不能开局。 */
export function listAvailableApis() {
    const apiSdk = typeof window !== 'undefined' ? window.__apiSdk : null;
    if (!apiSdk) return [];
    const out = [];
    try {
        for (const k of apiSdk.apiKeySdk?.list?.() || []) {
            if (!k || k.enabled === false) continue;
            out.push({ type: 'key', refId: k.id, label: k.name || k.model || k.id });
        }
        for (const g of apiSdk.apiGroupSdk?.list?.() || []) {
            if (!g) continue;
            out.push({ type: 'group', refId: g.id, label: `${g.name || g.id}（轮询组）` });
        }
    } catch (_) { /* SDK 没就绪就当没有 */ }
    return out;
}

/**
 * 问一次 AI。
 *
 * @param {object}   opts
 * @param {object}   opts.session
 * @param {string}   [opts.aiPersonId]   哪个 AI 在说话（决定用谁绑的 key）
 * @param {string}   opts.system         system prompt
 * @param {string}   opts.user           user prompt
 * @param {number}   [opts.maxTokens=600]
 * @param {number}   [opts.temperature=0.85]
 * @returns {Promise<{ok:boolean, text:string, error?:string}>}
 */
export async function askAi(opts = {}) {
    const { session, aiPersonId, system, user, maxTokens = 600, temperature = 0.85 } = opts;

    const ref = resolveGameApiRef(session, aiPersonId);
    if (!ref) {
        return { ok: false, text: '', error: 'NO_API' };
    }

    let executeApiRequest = null;
    try {
        ({ executeApiRequest } = await import('../../../setting/api-manager/api-key-sdk.js'));
    } catch (err) {
        return { ok: false, text: '', error: 'SDK_LOAD_FAILED' };
    }

    let lastError = '';
    for (let attempt = 0; attempt <= TIMING.AI_RETRY; attempt++) {
        if (attempt > 0) {
            await sleep(TIMING.AI_RETRY_DELAY * attempt);
        }
        if (!stillAlive(session)) return { ok: false, text: '', error: 'SESSION_GONE' };
        try {
            const resp = await executeApiRequest({
                apiKeyId: ref.type === 'key' ? ref.refId : undefined,
                groupId: ref.type === 'group' ? ref.refId : undefined,
                endpoint: 'chat/completions',
                method: 'POST',
                body: {
                    messages: [
                        { role: 'system', content: system || '' },
                        { role: 'user', content: user || '' },
                    ],
                    temperature,
                    max_tokens: maxTokens,
                },
                timeout: TIMING.AI_TIMEOUT,
            });
            if (!resp || resp.success === false) {
                lastError = resp?.error || 'REQUEST_FAILED';
                continue;
            }
            const text = String(resp?.data?.choices?.[0]?.message?.content || '').trim();
            if (!text) {
                // HTTP 200 但内容为空也算失败 —— 否则会往对局里塞一条空发言，
                // 用户看到的是「这个人张了张嘴什么都没说」（AGENTS2 §15.11 同款）
                lastError = 'EMPTY';
                continue;
            }
            return { ok: true, text };
        } catch (err) {
            lastError = err?.message || String(err);
        }
    }
    return { ok: false, text: '', error: lastError || 'UNKNOWN' };
}

// ---------------------------------------------------------------------------
// 输出清洗
// ---------------------------------------------------------------------------

/**
 * 把 AI 的一段话洗成「能直接当发言用」的纯文本。
 *
 * AI 很爱加前缀（`我：`、`发言：`）和引号，原型每个调用点各写了一遍
 * 正则，写法还都不一样。
 */
export function cleanSpeech(raw, maxLen = 200) {
    let text = String(raw || '').trim();
    text = text.replace(/^```[\w]*\s*|\s*```$/g, '');
    text = text.replace(/^(我|发言|回答|描述|遗言|台词)\s*[:：]\s*/, '');
    text = text.replace(/^["'“”「」『』]+|["'“”「」『』]+$/g, '');
    text = text.replace(/\s*\n\s*/g, ' ').trim();
    if (text.length > maxLen) text = text.slice(0, maxLen);
    return text;
}

/**
 * 从 AI 的回答里认出它选了谁。
 *
 * 三级匹配：名字包含 → 座位号 → 都没认出来返回 null。
 *
 * ★ 返回 null 而不是「默认第一个」是有意的。原型认不出来时默认投第一个存活玩家，
 *   于是接口一抽风，全场就会诡异地集火 1 号 —— 而这看起来像是「AI 在配合」，
 *   非常难发现。现在认不出来交给调用方走随机兜底，至少是无偏的。
 */
export function parseTarget(raw, candidates) {
    const text = String(raw || '');
    if (!text || !Array.isArray(candidates) || !candidates.length) return null;

    // 名字（长的先比，避免「小明」把「小明明」吃掉）
    const byLength = [...candidates].sort((a, b) => (b.name || '').length - (a.name || '').length);
    for (const p of byLength) {
        if (p.name && text.includes(p.name)) return p;
    }
    // 座位号：「3号」「3 号位」「玩家3」
    const seatMatch = text.match(/(\d{1,2})\s*号|玩家\s*(\d{1,2})/);
    if (seatMatch) {
        const seat = Number(seatMatch[1] || seatMatch[2]);
        const hit = candidates.find((p) => p.seat === seat);
        if (hit) return hit;
    }
    return null;
}

/**
 * 从 AI 的回答里抠出 JSON。
 *
 * 嵌套结构一律让 AI 输出 JSON，不用自定义分隔符 —— 分隔符少一个符号
 * 会解析歪而且看不出来（AGENTS2 §13.6.2）。解析失败返回 null，
 * 调用方必须走兜底，不允许把乱码填进界面。
 */
export function parseJson(raw) {
    const text = String(raw || '').replace(/```json\s*|```/g, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
        return null;
    }
}

/** 把 AI 用 `|` 或换行分成的多句拆开，当成多条气泡发。 */
export function splitLines(raw, maxLines = 4) {
    return String(raw || '')
        .split(/[|｜\n]+/)
        .map((s) => cleanSpeech(s))
        .filter(Boolean)
        .slice(0, maxLines);
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
