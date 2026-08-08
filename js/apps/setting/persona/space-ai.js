/**
 * Settings App · 人设主页 · 「空间」模块 · AI 调用层
 *
 * 职责:
 *   - resolveApiKeyIdForPersona  统一解 persona.boundResources.apiRefs[0] → apiKeyId
 *   - callAiJson                 通用 OpenAI / Anthropic / Gemini 兼容 fetch + JSON 解析
 *   - gatherContextForAI         拼 5 维上下文(人设卡 / 世界空间 / 天气 / 时间 / 周日程)
 *   - buildTodayScheduleSystemPrompt / UserPrompt
 *   - parseAiJsonOrFallback
 *
 * 所有函数都是模块顶层,无 this。
 */

import { buildContextFromPersona } from './home-section.js';
import { getApiSdk } from '../api-manager/api-manager-section.js';
import { getAccessibleLocationsForPersona, getCurrentPhase, summarizeWeatherForAI } from './space-sdk.js';

// ============================================
// 1) 解析 persona 绑定的 API Key
// ============================================

/**
 * 统一处理 persona.boundResources.apiRefs[0] 各种形态:
 *   - string                              → 当作 key id 直接用
 *   - { refType: 'key',  refId }          → 用 refId
 *   - { refType: 'group', refId }          → 取组内第一个 key id
 *   - { id }                              → 直接用 id(兼容旧)
 *
 * @param {object} persona
 * @returns {string|null}  apiKeyId
 */
export function resolveApiKeyIdForPersona(persona) {
    const ref = persona?.boundResources?.apiRefs?.[0];
    if (!ref) return null;
    if (typeof ref === 'string') return ref;
    if (ref.refType === 'key' && ref.refId) return ref.refId;
    if (ref.refType === 'group' && ref.refId) {
        try {
            const apiSdk = getApiSdk();
            const group = apiSdk?.apiGroupSdk?.get?.(ref.refId);
            return group?.apiKeyIds?.[0] || null;
        } catch (_) { return null; }
    }
    if (ref.id) return ref.id;
    return null;
}

/**
 * 从 apiKeyId 取完整 apiKey 对象。
 */
export function resolveApiKey(apiKeyId) {
    if (!apiKeyId) return null;
    try {
        const apiSdk = getApiSdk();
        return apiSdk?.apiKeySdk?.get?.(apiKeyId) || null;
    } catch (_) { return null; }
}

// ============================================
// 2) 通用 AI 调用(支持 OpenAI / Anthropic / Gemini 兼容)
// ============================================

/**
 * @param {object} opts
 * @param {object} opts.apiKey         resolveApiKey() 的返回值
 * @param {string} opts.systemPrompt
 * @param {string} opts.userPrompt
 * @param {number} [opts.maxTokens=800]
 * @param {number} [opts.temperature=0.7]
 * @returns {Promise<string>}  原始 content 字符串
 *
 * 命中 finish_reason=length(被 max_tokens 截断)时会自动把 max_tokens 翻倍重试一次,
 * 解决 DeepSeek-R1 / 类 thinking 模型把预算全花在 reasoning_content 上、content 拿 0 token 的问题。
 */
export async function callAiRaw({ apiKey, systemPrompt, userPrompt, maxTokens = 800, temperature = 0.7 }) {
    const first = await _callAiRawOnce({ apiKey, systemPrompt, userPrompt, maxTokens, temperature });
    if (!first) return '';
    if (first.finishReason !== 'length' && first.finishReason !== 'max_tokens') {
        return first.content;
    }
    // 截断 → 自动重试一次,把 max_tokens 翻倍(上限 32768,避免撞 provider 硬顶)
    const doubled = Math.min(Math.max((first.maxTokensUsed || maxTokens) * 2, 2048), 32768);
    if (doubled === first.maxTokensUsed) {
        // 已经到顶,不重试
        return first.content;
    }
    console.warn('[space-ai] callAiRaw 截断,自动重试 max_tokens =', first.maxTokensUsed, '→', doubled);
    const second = await _callAiRawOnce({ apiKey, systemPrompt, userPrompt, maxTokens: doubled, temperature });
    return second?.content ?? first.content;
}

/**
 * 一次性的 AI 调用。不做重试,返回 { content, finishReason, maxTokensUsed }。
 * 业务方法应该走 callAiRaw(带自动重试)而不是直接调这个。
 */
async function _callAiRawOnce({ apiKey, systemPrompt, userPrompt, maxTokens = 800, temperature = 0.7 }) {
    if (!apiKey?.apiKey) {
        throw new Error('API Key 内容为空,请在 API 管理中检查密钥配置');
    }
    const model = apiKey.model || 'gpt-3.5-turbo';
    const body = {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        model,
        temperature,
        max_tokens: maxTokens,
    };
    const isAnthropic = apiKey.provider === 'anthropic';
    const endpoint = isAnthropic ? 'messages' : 'chat/completions';
    const baseUrl = (apiKey.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const url = `${baseUrl}/${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (isAnthropic) {
        headers['x-api-key'] = apiKey.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body.max_tokens = Math.max(maxTokens, 1024);
        body.messages = [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }];
    } else if (apiKey.provider === 'gemini') {
        headers['x-goog-api-key'] = apiKey.apiKey;
    } else {
        headers['Authorization'] = `Bearer ${apiKey.apiKey}`;
    }

    console.log('[space-ai] callAiRaw start', {
        provider: apiKey.provider || 'openai',
        model,
        baseUrl,
        maxTokens: body.max_tokens,
        promptChars: String(userPrompt || '').length + String(systemPrompt || '').length,
    });

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
    } catch (networkErr) {
        console.error('[space-ai] callAiRaw fetch 失败', networkErr);
        throw new Error(`网络错误: ${networkErr?.message || String(networkErr)}`);
    }

    if (!response.ok) {
        const txt = await response.text().catch(() => '');
        console.error('[space-ai] callAiRaw HTTP 非 2xx', {
            status: response.status,
            statusText: response.statusText,
            bodyPreview: txt.slice(0, 400),
        });
        throw new Error(`API 请求失败 (${response.status}): ${txt.slice(0, 200)}`);
    }

    let result;
    try {
        result = await response.json();
    } catch (jsonErr) {
        const rawText = await response.text().catch(() => '');
        console.error('[space-ai] callAiRaw JSON 解析失败', {
            err: jsonErr?.message,
            rawTextPreview: rawText.slice(0, 400),
        });
        throw new Error(`API 返回非 JSON: ${(rawText || '').slice(0, 120)}`);
    }

    let content = '';
    let finishReason = '';
    if (isAnthropic) {
        content = result?.content?.[0]?.text || '';
        finishReason = result?.stop_reason || '';
    } else {
        const choice = result?.choices?.[0] || {};
        content = choice?.message?.content
            || choice?.text
            || choice?.delta?.content
            || '';
        finishReason = choice?.finish_reason || '';
    }

    const usage = result?.usage || result?.usage_metadata || null;
    const topError = result?.error?.message || result?.error || null;
    console.log('[space-ai] callAiRaw done', {
        status: response.status,
        contentLength: String(content || '').length,
        finishReason,
        usage,
        topError,
        contentPreview: String(content || '').slice(0, 200),
    });

    if (topError) {
        throw new Error(`上游返回 error: ${typeof topError === 'string' ? topError : (topError?.message || JSON.stringify(topError).slice(0, 200))}`);
    }
    if (finishReason === 'safety' || finishReason === 'content_filter') {
        throw new Error('上游安全过滤拦截了响应,请调整 prompt 后重试');
    }

    return { content, finishReason, maxTokensUsed: body.max_tokens };
}

/**
 * 解析 LLM 返回的 JSON,失败回退到 fallback。
 * 鲁棒策略(LLM 经常在 JSON 末尾塞额外中文):
 *   1. 先剥 markdown 代码块
 *   2. 用括号配对定位最外层 [] 或 {},提取整段
 *   3. parse 失败时,逐字符从尾部裁剪再试(去中文逗号、句号、解释文字)
 */
export function parseAiJsonOrFallback(content, fallback = null) {
    if (!content) return fallback;
    try {
        const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        let jsonStr = fence ? fence[1] : content;

        // 找第一个 '[' 或 '{' 的位置,做括号配对
        const start = jsonStr.search(/[\[]|[\{]/);
        if (start === -1) return fallback;
        const openCh = jsonStr[start];
        const closeCh = openCh === '[' ? ']' : '}';
        const target = extractBalanced(jsonStr, start, openCh, closeCh);
        if (!target) return fallback;

        // 试 parse(必要时裁尾巴)
        const trimmed = tryParseWithTrim(target, openCh, closeCh);
        if (trimmed !== null) return trimmed;
        return fallback;
    } catch (err) {
        console.warn('[space-ai] JSON 解析失败:', err, '原文:', content.slice(0, 200));
        return fallback;
    }
}

function extractBalanced(str, start, openCh, closeCh) {
    let depth = 0;
    let inStr = false;
    let escape = false;
    let lastValidEnd = -1; // 记录最后一次成功闭合的位置
    for (let i = start; i < str.length; i++) {
        const c = str[i];
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === openCh) depth++;
        else if (c === closeCh) {
            depth--;
            if (depth === 0) {
                lastValidEnd = i;
                return str.slice(start, i + 1);
            }
        }
    }
    // 配对失败:可能是 LLM 输出被 max_tokens 截断
    // 如果当前在字符串字面值内,先尝试关闭字符串再补闭合括号
    let result = str.slice(start);
    if (inStr) {
        // 砍掉尾巴上未闭合的字符串 + 上一段不完整的字段
        // 简单策略:把字符串从最后一个未转义的 " 之前裁掉,再加 closeCh
        const lastQuote = findLastUnescapedQuote(result);
        if (lastQuote >= 0) {
            result = result.slice(0, lastQuote);
        }
    }
    // 补闭合括号
    if (openCh === '[') {
        // 数组:补一个空 {} 或者裁掉尾巴的不完整字段
        result = result.replace(/,\s*$/, '') + ']';
    } else {
        result = result.replace(/,\s*$/, '') + '}';
    }
    console.warn('[space-ai] JSON 似乎被截断,已尝试补全闭合');
    return result;
}

/**
 * 在字符串中找最后一个未转义的双引号。
 * @returns {number} 索引,找不到返回 -1。
 */
function findLastUnescapedQuote(str) {
    for (let i = str.length - 1; i >= 0; i--) {
        if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) return i;
    }
    return -1;
}

function tryParseWithTrim(str, openCh, closeCh) {
    const trimChars = new Set([
        closeCh, ' ', '\t', '\n', '\r', ',', '.', ';',
        '。', '，', '；', '!', '！', '?', '？', '\u2026',
        '~', '～', '"', "'", '`', '·', '—', '-', '…',
    ]);
    // 先直接试
    try { return JSON.parse(str); } catch (_) { /* fallthrough */ }
    // 逐字符从尾部裁,直到 parse 成功或裁到只剩 2 字符
    for (let end = str.length - 1; end > 1; end--) {
        const ch = str[end];
        if (trimChars.has(ch)) continue;
        const candidate = str.slice(0, end + 1);
        if (!candidate.endsWith(closeCh)) continue;
        try { return JSON.parse(candidate); } catch (_) { /* keep trimming */ }
    }
    // 兜底:用最外层括号配对的结果再裁掉尾巴的中文文本(LLM 写完 JSON 顺手加一段)
    let s = str;
    while (s.length > 2) {
        if (s.endsWith(closeCh)) {
            try { return JSON.parse(s); } catch (_) { /* trim last char */ }
        }
        s = s.slice(0, -1);
    }
    return null;
}

/**
 * 一站式: 调 LLM → 解析 JSON → 返回对象 / fallback。
 */
export async function callAiJson(opts) {
    const content = await callAiRaw(opts);
    return { content, parsed: parseAiJsonOrFallback(content, opts.fallback || null) };
}

// ============================================
// 3) 上下文聚合: gatherContextForAI
// ============================================

/**
 * 把所有上下文一次性拼好,各 prompt builder 都从这里取。
 *
 * @param {object} args
 * @param {object} args.app       settings app
 * @param {object} args.persona
 * @param {object} args.world
 * @param {object} [args.todayDiary]  sdk.diary.getToday() 今日记录
 * @param {object} [args.weather]    space-sdk.getPlaceWeather()
 * @param {Date}   [args.now]
 * @returns {object}  { personaCard, worldSpace, weather, worldTime, weeklySchedule, rhythmSummary, mood, todaySchedule, diary }
 */
export function gatherContextForAI({ app, persona, world, todayDiary, weather, now = new Date() }) {
    const sdk = (typeof window !== 'undefined' ? window.settingsSdk : null);
    const entityType = app?.state?.personaHome?.entityType || 'user';
    const entityId = persona?.id;

    // 1) 角色卡
    let personaCard = '';
    try {
        personaCard = buildContextFromPersona(persona, entityType) || '';
    } catch (_) { personaCard = ''; }

    // 2) 世界空间(基于 accessNotes.visitors)
    const accessible = getAccessibleLocationsForPersona(sdk, persona?.boundWorldId, persona?.id, { includeRare: false });
    const placeMap = new Map();
    for (const a of accessible) {
        if (!a.place) continue;
        if (!placeMap.has(a.place.id)) placeMap.set(a.place.id, { place: a.place, locations: [] });
        placeMap.get(a.place.id).locations.push(a);
    }
    const worldSpace = {
        worldName: world?.name || '',
        placeCount: placeMap.size,
        locationCount: accessible.length,
        groups: Array.from(placeMap.values()),
    };

    // 3) 天气(优先 place.realCityRef → weatherAppState)
    const weatherSummary = weather ? summarizeWeatherForAI(weather) : '今日该地点暂未映射城市天气。';

    // 4) 世界时间 / phase
    const worldTime = world ? getCurrentPhase(world, now) : { name: `${now.getHours()}时`, realHour: now.getHours(), realMinute: now.getMinutes() };

    // 5) 本周日程
    let weeklySchedule = [];
    try {
        const todayStr = now.toLocaleDateString('en-CA');
        const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');
        for (const ds of [yesterdayStr, todayStr, tomorrowStr]) {
            const day = sdk?.schedule?.getDay?.(entityType, entityId, ds);
            const events = Array.isArray(day?.events) ? day.events.slice() : [];
            events.forEach(e => { e.__date = ds; });
            weeklySchedule = weeklySchedule.concat(events);
        }
    } catch (_) {}

    // 6) 作息(只取描述)
    const rhythmEntries = Array.isArray(persona?.rhythm?.entries) ? persona.rhythm.entries : [];

    // 7) 今日心情 + diary
    const mood = todayDiary?.mood || persona?.dailyMood || '';
    const moodIntensity = todayDiary?.moodIntensity ?? null;
    const diaryText = todayDiary?.diary || '';

    // 8) 今日日程
    const todaySchedule = Array.isArray(todayDiary?.todaySchedule) ? todayDiary.todaySchedule : [];

    return {
        personaCard,
        worldSpace,
        weather,
        weatherSummary,
        worldTime,
        weeklySchedule,
        rhythmEntries,
        mood,
        moodIntensity,
        diaryText,
        todaySchedule,
    };
}

// ============================================
// 4) 各 Prompt Builder
// ============================================

function renderWorldSpaceBlock(ctx) {
    const lines = [];
    lines.push('# 世界观空间');
    lines.push(`world: ${ctx.worldSpace.worldName || '(未命名)'}`);
    if (ctx.worldSpace.groups.length === 0) {
        lines.push('地点: (暂无)');
        lines.push('⚠ 此人设没有被任何场所勾选为「可以去」。');
        return lines.join('\n');
    }
    lines.push('地点:');
    for (const g of ctx.worldSpace.groups) {
        const place = g.place;
        lines.push(`  - 名称: ${place.name}`);
        lines.push(`    id: ${place.id}`);
        if (place.realCityRef) {
            lines.push(`    映射天气: ${place.realCityRef}`);
            if (ctx.weather && ctx.weather.cityName === place.realCityRef) {
                lines.push(`    当前天气: ${ctx.weather.temperature}°C ${ctx.weather.description || ''}`);
            }
        }
        if (place.summary) lines.push(`    地点备注: ${place.summary}`);
        if (g.locations.length === 0) {
            lines.push(`    场所: (此地点下无此人设可去的场所)`);
            continue;
        }
        lines.push(`    场所:`);
        for (const a of g.locations) {
            const loc = a.location;
            lines.push(`      - 名称: ${loc.name}`);
            lines.push(`        id: ${loc.id}`);
            lines.push(`        频率: ${a.frequencyValue} (${a.frequencyLabel})`);
            if (loc.summary) lines.push(`        场所备注: ${loc.summary}`);
            if (a.accessConfig.note) lines.push(`        私人备注: ${a.accessConfig.note}`);
            if (Array.isArray(loc.allowedPhases) && loc.allowedPhases.length > 0) {
                lines.push(`        仅允许 phase: ${loc.allowedPhases.join(', ')}`);
            }
        }
    }
    lines.push('⚠ 以上场所 = 此人设今日行程的候选场地(已自动过滤 never/rarely)。');
    return lines.join('\n');
}

function renderWorldTimeBlock(ctx) {
    const lines = [];
    lines.push('# 当前纪时');
    const wt = ctx.worldTime;
    if (wt.rawWorldTime) {
        lines.push(`世界时间: ${wt.name}`);
    } else {
        lines.push(`现实时间: ${wt.realHour}:${String(wt.realMinute).padStart(2, '0')}`);
        lines.push(`纪时段名: ${wt.name}`);
        if (wt.phaseWidthHours && wt.phaseWidthHours !== 1) {
            lines.push(`段内偏移: ${wt.phaseHourOffset?.toFixed?.(2) || 0} 小时(1 段 ≈ ${wt.phaseWidthHours.toFixed(2)} 现实小时)`);
        }
        lines.push(`总段数: ${wt.totalPhases}`);
    }
    return lines.join('\n');
}

function renderWeeklyBlock(ctx) {
    if (!ctx.weeklySchedule.length) return '# 本周日程\n(暂无)';
    const lines = ['# 本周日程'];
    for (const e of ctx.weeklySchedule) {
        const time = e.startTime ? `${e.startTime}${e.endTime ? '-' + e.endTime : ''}` : '全天';
        const dateTag = e.__date ? `[${e.__date}]` : '';
        lines.push(`- ${dateTag} ${time} ${e.title}${e.note ? ' - ' + e.note : ''}`);
    }
    return lines.join('\n');
}

function renderRhythmBlock(ctx) {
    if (!ctx.rhythmEntries.length) return '# 作息\n(暂无)';
    const lines = ['# 作息'];
    for (const r of ctx.rhythmEntries) {
        const time = r.endTime ? `${r.startTime}-${r.endTime}` : r.startTime;
        const days = !r.daysOfWeek?.length ? '每天' : r.daysOfWeek.map(d => '一二三四五六日'[d]).join('/');
        const loc = r.locationName ? ` @ ${r.locationName}` : '';
        lines.push(`- [${time}] ${days}: ${r.description || ''}${loc}`);
    }
    return lines.join('\n');
}

// ============================================
// 4.1) 今日日程 prompt
// ============================================

export function buildTodayScheduleSystemPrompt() {
    return `你是一位擅长「用场所规划人格角色一天」的编剧。
你的任务:为给定的人设「在今天的现实小时里」规划 3~6 段时间表。
本系统会把这些时段拆成「已发生(过去)」和「即将(未来)」两类展示,
所以请你按时间顺序生成,前几段可能是过去已发生的行踪(人设今天已经做过的事),
后几段是未来打算去做的事。
每段时间必须落到「白名单里的场所 id」,activity 与 reason 必须与人设卡里的性格 / 作息 / 心情互相呼应。
输出必须是 严格 JSON,不要 markdown 包裹,不要任何解释文字。

每段格式:
{
  "fromHour": <0-23 整数>,
  "toHour": <0-23 整数, > fromHour>,
  "phase": "<past | future>",
  "locationId": "<必须是白名单 id 之一>",
  "locationName": "<人类可读,优先用白名单>",
  "placeName": "<所属地点名>",
  "activity": "<10~20 字中文,做这件事>",
  "reason": "<1~2 句中文,联系心情/作息/性格>",
  "confidence": <0~1 浮点>
}

约束:
- 整体时间覆盖 0:00 ~ 24:00 区间内一段连续的时间。
- 「past」段必须 toHour <= 当前现实小时;「future」段必须 fromHour >= 当前现实小时。
- 若现实已过 23:00,全部标为 future;若现实早于 6:00,全部标为 past(人设刚起床)。
- 段与段之间的时间不要重叠。
整体返回 JSON 数组,按 fromHour 升序。`;
}

export function buildTodayScheduleUserPrompt(ctx) {
    return [
        ctx.personaCard,
        renderWorldSpaceBlock(ctx),
        renderWorldTimeBlock(ctx),
        renderWeeklyBlock(ctx),
        renderRhythmBlock(ctx),
        `# 当前现实时间(关键!必须按此拆分 past / future)`,
        `当前现实小时: ${ctx.worldTime.realHour}:${String(ctx.worldTime.realMinute).padStart(2, '0')}`,
        `今日已发生小时: ${Array.from({ length: ctx.worldTime.realHour }, (_, i) => i).join(',') || '(尚未到今日)'}`,
        `# 天气`,
        ctx.weatherSummary,
        `# 今日心情`,
        ctx.mood ? `${ctx.mood} (浓度 ${ctx.moodIntensity ?? '?'})` : '(尚未记录)',
        `# 已有今日日程(若已存在,你可以重 roll 或微调)`,
        ctx.todaySchedule.length ? JSON.stringify(ctx.todaySchedule, null, 2) : '(暂无)',
        `请规划今日日程 3~6 段,phase 严格按上面现实小时拆分 past/future,返回 JSON 数组。`,
    ].filter(Boolean).join('\n\n');
}

// ============================================
// 5) 解析今日日程 AI 返回(白名单校验)
// ============================================

/**
 * @param {object} parsed  parseAiJsonOrFallback 的结果
 * @param {Set<string>}  allowedLocationIds
 * @param {object} [opts]
 * @param {number} [opts.nowHour=现在小时(0-23)]  决定 phase 是 past 还是 future 的现实小时;
 *                          若不传,使用 Date.now() 取当前小时。
 * @returns {Array} 过滤后的今日日程;丢弃 locationId 不在白名单的整段
 */
export function sanitizeTodaySchedule(parsed, allowedLocationIds, opts = {}) {
    if (!Array.isArray(parsed)) return [];
    const nowHour = Number.isFinite(opts.nowHour)
        ? opts.nowHour
        : new Date().getHours();
    const out = [];
    for (const seg of parsed) {
        if (!seg || typeof seg !== 'object') continue;
        if (!seg.locationId || !allowedLocationIds.has(seg.locationId)) continue;
        const fromHour = Number(seg.fromHour);
        const toHour = Number(seg.toHour);
        if (!Number.isFinite(fromHour) || !Number.isFinite(toHour)) continue;
        if (toHour <= fromHour) continue;
        const safeFrom = Math.max(0, Math.min(23, Math.floor(fromHour)));
        const safeTo = Math.max(0, Math.min(23, Math.floor(toHour)));

        // 推断 phase: AI 显式给优先,否则用现实小时自动判定
        let phase = (seg.phase === 'past' || seg.phase === 'future')
            ? seg.phase
            : (safeTo <= nowHour ? 'past' : 'future');

        out.push({
            id: `sched-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            fromHour: safeFrom,
            toHour: safeTo,
            phase,
            locationId: String(seg.locationId),
            locationName: String(seg.locationName || ''),
            placeName: String(seg.placeName || ''),
            activity: String(seg.activity || '').slice(0, 60),
            reason: String(seg.reason || '').slice(0, 200),
            confidence: Math.max(0, Math.min(1, Number(seg.confidence) || 0.5)),
            generatedAt: Date.now(),
        });
    }
    out.sort((a, b) => a.fromHour - b.fromHour);
    return out;
}