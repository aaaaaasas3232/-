/**
 * 小奇怪 · AI 服务
 *
 * 职责三件:拿着座位给的 apiRef 发请求 → 解出文本 → 吐回去。
 * **不碰 store,不碰 DOM,不决定游戏规则。**
 *
 * ── 相对原型的改动 ────────────────────────────────────────────────
 *
 * 原型自己 `fetch('https://api.siliconflow.cn/v1/chat/completions')`,
 * 模型名写死 `deepseek-ai/DeepSeek-V3`,Key 由用户在欢迎页粘贴、
 * 通过 MQTT 明文广播给同房间的其他人。这些全部删掉,改走系统的 API 管理
 * (`executeApiRequest` / `executeApiStream`):
 *
 *   - Key 不再由本 App 保管,更不会被广播出去
 *   - 自动支持分组轮询、用量统计、多家 provider 的请求体差异
 *   - **流式用空闲超时而不是总时长超时**:该判定为挂掉的是
 *     「连续 N 秒没有任何新数据」,不是「总共跑了多久」
 *
 * 原型的流式解析还有个 bug:`if (data === '[DONE]') break;` 只跳出了
 * 内层 for,外层 `while(true)` 继续 `reader.read()`。走 SDK 之后不用管这些。
 *
 * ── 失败怎么办(AGENTS.md §7)────────────────────────────────────
 *
 * 「跨时空回合制:每座位一把 Key;失败跳过该座位」。
 * 所以本文件**永远不抛异常**,一律返回 `{ ok, text, aborted, error }`,
 * 由调用方决定是跳过这个座位还是提示用户。
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
        return { ok: false, text: '', aborted: false, error: '这个座位没有可用的 API' };
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

    if (opts.stream === true && typeof onChunk === 'function') {
        const result = await sdk.executeApiStream({
            ...target,
            body,
            idleTimeout: TIMEOUT.streamIdle,
            signal,
            onChunk,
        });
        return {
            ok: result?.success === true && Boolean(result.text),
            text: String(result?.text || ''),
            aborted: result?.aborted === true,
            // 中断时已经生成的那部分**是用户的**,不能因为他喊停就当失败丢掉
            error: result?.aborted ? '' : friendlyError(result),
        };
    }

    const result = await sdk.executeApiRequest({
        ...target,
        method: 'POST',
        body,
        timeout: TIMEOUT.normal,
        signal,
    });

    if (!result || result.success === false) {
        return {
            ok: false,
            text: '',
            aborted: result?.aborted === true,
            error: result?.aborted ? '' : friendlyError(result),
        };
    }
    const text = extractContent(result.data);
    if (!text) {
        return { ok: false, text: '', aborted: false, error: 'AI 返回了空内容' };
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
 *
 * 原型统一弹 `API请求失败: 401 ...` —— 技术上没错,
 * 但用户不知道该去哪儿改什么。
 */
function friendlyError(result) {
    const raw = result?.error || 'AI 调用失败';
    const status = result?.statusCode;
    if (status === 401) return 'Key 鉴权失败(401),去 nook →「API 管理」检查一下';
    if (status === 403) return 'Key 被拒绝(403),可能账号被禁用或权限不足';
    if (status === 404) return '接口地址不对(404),检查 baseUrl 和模型名';
    if (status === 429) return '请求太频繁或额度用完了(429)';
    if (status >= 500) return `服务端出错(${status}),多半是对面的问题`;
    if (/timeout|idle/i.test(raw)) return '等太久没有新内容,可能是网络问题';
    if (/abort/i.test(raw)) return '';
    return raw;
}

// ============================================================
// 中断
// ============================================================

/**
 * 每个「用途」一个 AbortController。
 *
 * 按用途而不是全局:一个座位在表态、另一个座位在出声明时,
 * 掐掉前者不该把后者也掐了。scope 一般传 `seat.id`。
 */
const _controllers = new Map();

export function createAbort(scope = 'turn') {
    abort(scope);
    const controller = new AbortController();
    _controllers.set(String(scope), controller);
    return controller.signal;
}

export function abort(scope = 'turn') {
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

export function releaseAbort(scope = 'turn') {
    _controllers.delete(String(scope));
}
