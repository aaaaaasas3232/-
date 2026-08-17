/**
 * 日记 · AI 服务
 *
 * 职责三件：选 API → 拼 prompt（委托 prompt-builder）→ 发请求。
 * **不碰 store，不碰 DOM** —— 调用方拿到结果自己决定怎么落盘、怎么渲染。
 *
 * ── 为什么日记不走流式 ────────────────────────────────────────────
 *
 * 梦境编织要流式，因为它一次生成三千字，用户盯着字一个个出来才不焦虑。
 * 日记一次两三百字，十秒内就回来了；上流式反而要处理「写到一半用户切页 /
 * 中断后残留半篇」这些边界，收益抵不过复杂度。
 *
 * 例外是 `generate` 仍然接受 `onChunk` —— 以后想给「AI 写长日记」加流式时，
 * 只要在调用侧传进来就行，不用改这一层。
 */

import { buildPrompt, buildWriteTurn } from './prompt-builder.js';
import { extractMarkers, tidy, parseSpaceSetup } from './extract-service.js';
import * as nook from './nook-bridge.js';
import {
    TIMEOUT, SPACE_SETUP_PROMPT, ENTRY_KIND,
    THEMES, LAYOUT_STYLES, DEFAULT_THEME, DEFAULT_LAYOUT,
    WINDOW_START_MIN, WINDOW_START_MAX, DEFAULT_WINDOW_START,
} from '../constants.js';
import { clamp, truncate } from '../utils.js';

// ============================================================
// 底层请求
// ============================================================

/**
 * 发一次请求。所有对外调用都从这儿走，超时 / 错误文案只有一份实现。
 *
 * @returns {{ok:boolean, text:string, error:string}}
 */
async function request({ apiRef, messages, temperature = 0.9, signal, onChunk }) {
    if (!apiRef) {
        return { ok: false, text: '', error: nook.describeMissingApi() };
    }

    let sdk;
    try {
        sdk = await import('../../setting/api-manager/api-key-sdk.js');
    } catch (err) {
        return { ok: false, text: '', error: `API 模块加载失败：${err?.message || err}` };
    }

    const target = {
        apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
        groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
        endpoint: 'chat/completions',
    };
    const body = { messages, temperature };

    if (typeof onChunk === 'function' && typeof sdk.executeApiStream === 'function') {
        const result = await sdk.executeApiStream({
            ...target, body, idleTimeout: TIMEOUT.streamIdle, signal, onChunk,
        });
        return {
            ok: result.success === true,
            text: String(result.text || ''),
            aborted: result.aborted === true,
            error: result.error || '',
        };
    }

    let result;
    try {
        result = await sdk.executeApiRequest({
            ...target, method: 'POST', body, timeout: TIMEOUT.normal,
        });
    } catch (err) {
        return { ok: false, text: '', error: friendlyError({ error: err?.message || String(err) }) };
    }

    if (!result || result.success === false) {
        return { ok: false, text: '', error: friendlyError(result) };
    }
    return { ok: true, text: extractContent(result.data), error: '' };
}

/** 各家返回体的形状不一样，逐个试 */
function extractContent(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    const choice = Array.isArray(data.choices) ? data.choices[0] : null;
    if (typeof choice?.message?.content === 'string') return choice.message.content;
    if (typeof choice?.text === 'string') return choice.text;
    // Anthropic
    if (Array.isArray(data.content) && typeof data.content[0]?.text === 'string') return data.content[0].text;
    // Gemini
    const gemini = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof gemini === 'string') return gemini;
    return '';
}

/**
 * 错误文案。
 *
 * 只说「AI 调用失败」等于没说 —— 用户不知道是 key 错了、余额没了还是网络问题，
 * 也就不知道该去哪儿修。每种状态码都要给出下一步动作。
 */
function friendlyError(result) {
    const raw = result?.error || 'AI 调用失败';
    const status = result?.statusCode;
    if (status === 401) return 'API Key 鉴权失败（401）。去 nook →「API 管理」检查 Key 是否正确、是否过期';
    if (status === 403) return 'API Key 被拒绝（403），可能账号被禁用或权限不足';
    if (status === 404) return '接口地址不对（404），检查 baseUrl 和 model 填得对不对';
    if (status === 429) return '请求太频繁或额度用完了（429），等一会儿再试';
    if (/timeout|aborted/i.test(raw)) return '请求超时了，可能是网络问题';
    return raw;
}

// ============================================================
// 写日记 / 便利贴
// ============================================================

/**
 * 生成一篇日记或一张便利贴。
 *
 * `kind` 由**调用方**根据当前时间是否落在写作时段内决定，不在这里判断 ——
 * 时段规则是产品级的，UI 上也要显示（「现在写的是便利贴」），
 * 判定放在一处（store）才不会出现「界面说日记、实际存成便利贴」。
 *
 * @param {object} opts
 * @param {object} opts.ctx      prompt-builder 需要的完整上下文
 * @param {object} opts.apiRef   nook.resolveApiRef 的结果
 * @param {string} [opts.hint]   用户给的方向（「写写今天的考试」）
 * @param {string} [opts.wish]   重 roll 时的修改意见
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ok:boolean, content:string, markers:object[], error:string, prompt:string}>}
 */
export async function generateEntry(opts = {}) {
    const { ctx = {}, apiRef, signal, onChunk } = opts;

    const { text: systemPrompt } = buildPrompt(ctx);
    const userTurn = buildWriteTurn(ctx);

    const result = await request({
        apiRef,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userTurn },
        ],
        temperature: ctx.kind === ENTRY_KIND.NOTE ? 1.0 : 0.9,
        signal,
        onChunk,
    });

    if (!result.ok) {
        return { ok: false, content: '', markers: [], error: result.error, prompt: systemPrompt };
    }

    const cleaned = tidy(result.text);
    if (!cleaned) {
        return {
            ok: false, content: '', markers: [],
            error: 'AI 返回了空内容，换个说法再试一次', prompt: systemPrompt,
        };
    }

    // 便利贴不解析 token（prompt 里也没给它回写格式），直接当纯文本
    if (ctx.kind === ENTRY_KIND.NOTE) {
        return { ok: true, content: cleaned, markers: [], error: '', prompt: systemPrompt };
    }

    const { content, markers } = extractMarkers(cleaned, ctx.space?.id);
    return { ok: true, content, markers, error: '', prompt: systemPrompt };
}

// ============================================================
// AI 自己配置日记本
// ============================================================

/**
 * 让 AI 挑自己日记本的样子。
 *
 * 产品要求：「ai 也是，但是 ai 是通过 api 调用来配置的……某个 AI 的主题颜色
 * 可能不同」。所以这里**不给默认值兜底就完事** —— 真的发一次请求，
 * 让模型按自己的人设挑。
 *
 * 但返回值必须**逐字段校验**：模型很可能返回 `"theme": "深蓝色"` 这种
 * 不在枚举里的值。不校验的话写进去就是一个 CSS 匹配不上的属性值，
 * 表现为「这个 AI 的日记本没有颜色」—— 而且不报错。
 *
 * @returns {Promise<{ok:boolean, patch:object, error:string, raw:string}>}
 */
export async function generateSpaceSetup({ aiCard, world, apiRef, signal } = {}) {
    const persona = nook.describeAi(aiCard);
    const worldText = nook.describeWorld(world);

    const system = [
        SPACE_SETUP_PROMPT,
        persona ? `你是：\n${persona}` : '',
        worldText ? `你所在的世界：\n${worldText}` : '',
    ].filter(Boolean).join('\n\n');

    const result = await request({
        apiRef,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: '给自己的日记本挑一套外观。只输出 JSON。' },
        ],
        temperature: 1.0,
        signal,
    });

    if (!result.ok) return { ok: false, patch: null, error: result.error, raw: '' };

    const parsed = parseSpaceSetup(result.text);
    if (!parsed) {
        return {
            ok: false, patch: null, raw: result.text,
            error: 'AI 没有按格式返回配置，再试一次（或者手动帮 TA 选一套）',
        };
    }

    return { ok: true, patch: sanitizeSetup(parsed), error: '', raw: result.text };
}

/**
 * 把模型返回的配置夹回合法范围。
 *
 * 每一个字段都要过一遍 —— 这里少校验一个字段，就多一处「保存成功但界面不对」。
 */
function sanitizeSetup(raw) {
    const themeIds = THEMES.map((t) => t.id);
    const layoutIds = LAYOUT_STYLES.map((l) => l.id);
    return {
        title: truncate(String(raw.title || '').replace(/[\r\n]/g, ' ').trim(), 12),
        theme: themeIds.includes(raw.theme) ? raw.theme : DEFAULT_THEME,
        layout: layoutIds.includes(raw.layout) ? raw.layout : DEFAULT_LAYOUT,
        styleNote: truncate(String(raw.styleNote || '').replace(/[\r\n]/g, ' ').trim(), 60),
        windowStart: clamp(
            Number.parseInt(raw.windowStart, 10),
            WINDOW_START_MIN,
            WINDOW_START_MAX,
        ) || DEFAULT_WINDOW_START,
    };
}

// ============================================================
// 中断
// ============================================================

/**
 * 每个空间一个 AbortController。
 *
 * 按空间而不是全局：同时给两个 AI 生成日记时，停掉一个不该把另一个也掐了。
 */
const _controllers = new Map();

export function createAbort(spaceId) {
    abort(spaceId);
    const controller = new AbortController();
    _controllers.set(String(spaceId), controller);
    return controller.signal;
}

export function abort(spaceId) {
    const key = String(spaceId);
    const controller = _controllers.get(key);
    if (controller) {
        try { controller.abort(); } catch (_) { /* 已经结束了 */ }
        _controllers.delete(key);
    }
}

export function releaseAbort(spaceId) {
    _controllers.delete(String(spaceId));
}

export function isRunning(spaceId) {
    return _controllers.has(String(spaceId));
}
