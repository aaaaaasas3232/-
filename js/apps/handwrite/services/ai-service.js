/**
 * 手书 · AI 服务
 *
 * 职责三件:选 API → 发请求 → 把结果吐回去。**不碰 store,不碰 DOM。**
 *
 * ★ Key 不由本 App 保管。走系统的 API 管理(`executeApiRequest` /
 *   `executeApiStream`),自动带上分组轮询、用量统计、多家 provider 的
 *   请求体差异。本 App 的任何一张表里都不该出现 API Key。
 *
 * ★ 流式用**空闲**超时而不是总时长超时:生成一份两百行的手书脚本
 *   跑一分钟很正常,该判定为挂掉的是「连续 N 秒没有任何新数据」。
 */

import { TIMEOUT } from '../constants.js';

// ============================================================
// 请求
// ============================================================

/**
 * 跑一次生成。
 *
 * @param {object} opts
 * @param {{type:'key'|'group', refId:string}} opts.apiRef
 * @param {string} opts.systemPrompt
 * @param {string} opts.userTurn
 * @param {number} [opts.temperature]
 * @param {boolean} [opts.stream]
 * @param {AbortSignal} [opts.signal]
 * @param {(delta:string, full:string)=>void} [opts.onChunk]
 * @returns {Promise<{ok:boolean, text:string, aborted:boolean, error:string}>}
 */
export async function generate(opts = {}) {
    const { apiRef, systemPrompt, userTurn, signal, onChunk } = opts;
    if (!apiRef?.refId) {
        return { ok: false, text: '', aborted: false, error: '没有可用的 API' };
    }
    if (!userTurn) {
        return { ok: false, text: '', aborted: false, error: '没有可发送的内容' };
    }

    const body = {
        messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userTurn },
        ],
        temperature: Number.isFinite(opts.temperature) ? opts.temperature : 0.9,
    };

    let sdk;
    try {
        sdk = await import('../../setting/api-manager/api-key-sdk.js');
    } catch (err) {
        return { ok: false, text: '', aborted: false, error: `API 模块加载失败:${err?.message || err}` };
    }

    const target = {
        apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
        groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
        endpoint: 'chat/completions',
    };

    if (opts.stream !== false && typeof onChunk === 'function') {
        const result = await sdk.executeApiStream({
            ...target,
            body,
            idleTimeout: TIMEOUT.streamIdle,
            signal,
            onChunk,
        });
        return {
            ok: result.success === true && Boolean(result.text),
            text: String(result.text || ''),
            aborted: result.aborted === true,
            // 中断时已经生成的那部分**是用户的**,不能因为他喊停就当失败丢掉
            error: result.aborted ? '' : friendlyError(result),
        };
    }

    const result = await sdk.executeApiRequest({
        ...target,
        method: 'POST',
        body,
        timeout: TIMEOUT.normal,
    });

    if (!result || result.success === false) {
        return { ok: false, text: '', aborted: false, error: friendlyError(result) };
    }
    const text = extractContent(result.data);
    if (!text) {
        return { ok: false, text: '', aborted: false, error: 'AI 返回了空内容,再试一次' };
    }
    return { ok: true, text, aborted: false, error: '' };
}

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
 * 把状态码翻译成「用户看了知道该干嘛」的话。
 * `API请求失败: 401 Unauthorized {...}` 技术上没错,但用户不知道该去哪儿改什么。
 */
function friendlyError(result) {
    const raw = result?.error || 'AI 调用失败';
    const status = result?.statusCode;
    if (status === 401) return 'API Key 鉴权失败(401),去 nook →「API 管理」检查 Key 是否正确、是否过期';
    if (status === 403) return 'API Key 被拒绝(403),可能账号被禁用或权限不足';
    if (status === 404) return '接口地址不对(404),检查 baseUrl 和模型名';
    if (status === 429) return '请求太频繁或额度用完了(429),等一会儿再试';
    if (status >= 500) return `服务端出错(${status}),多半是对面的问题,稍后重试`;
    if (/timeout|idle/i.test(raw)) return '等太久没有新内容,可能是网络问题,再试一次';
    if (/abort/i.test(raw)) return '';
    return raw;
}

// ============================================================
// 中断
// ============================================================

/**
 * 每个「用途」一个 AbortController。
 *
 * 按用途而不是全局:以后如果有后台任务(比如自动配效果),
 * 用户点「停止生成脚本」不该把那次也掐了。
 */
const _controllers = new Map();

export function createAbort(scope = 'script') {
    abort(scope);
    const controller = new AbortController();
    _controllers.set(String(scope), controller);
    return controller.signal;
}

export function abort(scope = 'script') {
    const key = String(scope);
    const controller = _controllers.get(key);
    if (controller) {
        try { controller.abort(); } catch (_) { /* 已经断了 */ }
        _controllers.delete(key);
    }
}

export function abortAll() {
    for (const key of [..._controllers.keys()]) abort(key);
}

export function releaseAbort(scope = 'script') {
    _controllers.delete(String(scope));
}
