/**
 * 人设机 · AI 服务
 *
 * 职责三件:选 API(委托 nook-bridge)→ 拼 prompt(委托 prompt-builder)→ 发请求。
 * **不碰 store,不碰 DOM。** 调用方拿到结果自己决定怎么落盘、怎么渲染。
 *
 * ── 相对原型的变化 ────────────────────────────────────────────────
 *
 * 原型为 11 个厂商各写了一个 `callXxx()`(5650-6000 行那一段),每个函数里
 * 重复一遍 fetch / 鉴权 / 错误处理,而且各家的错误提取写法都不一样。
 * 本项目已经有统一的执行器 `js/apps/setting/api-manager/api-key-sdk.js`:
 * 鉴权头按 provider 自动挑、失败自动记日志、分组还能轮询。
 * 所以这里一行 fetch 都没有。
 *
 * 另外原型把 API Key 明文写进 localStorage(`apiConfig`),
 * 现在 Key 只存在 nook 的 API 管理里,本 App 连读都不读,只传一个 refId。
 */

import { buildPersonaPrompt, buildAdvisorPrompt, buildConvertPrompt } from './prompt-builder.js';
import { resolveApiRef, describeMissingApi } from './nook-bridge.js';
import { cleanModelOutput } from '../utils.js';
import { TIMEOUT } from '../constants.js';

let _sdkPromise = null;

/** 懒加载 api-key-sdk —— 它属于 settings App,启动时不必跟着一起进包 */
function loadApiSdk() {
    if (!_sdkPromise) {
        _sdkPromise = import('../../setting/api-manager/api-key-sdk.js').catch((err) => {
            _sdkPromise = null;                       // 失败要能重试,不能一次失败永远失败
            throw err;
        });
    }
    return _sdkPromise;
}

function refToOptions(ref) {
    return {
        apiKeyId: ref.type === 'key' ? ref.refId : undefined,
        groupId: ref.type === 'group' ? ref.refId : undefined,
    };
}

function extractContent(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    const choice = Array.isArray(data.choices) ? data.choices[0] : null;
    if (typeof choice?.message?.content === 'string') return choice.message.content;
    if (typeof choice?.text === 'string') return choice.text;
    if (Array.isArray(data.content) && typeof data.content[0]?.text === 'string') return data.content[0].text;
    const gemini = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof gemini === 'string') return gemini;
    return '';
}

/**
 * 把底层错误翻译成「用户知道下一步该干嘛」的话。
 *
 * 原型这里统一抛 `API调用失败: xxx`,而 xxx 往往是厂商返回的英文 JSON。
 */
function friendlyError(result) {
    const raw = result?.error || 'AI 调用失败';
    if (/401|unauthorized|invalid[_ ]api[_ ]key/i.test(raw)) return 'API Key 鉴权失败,去 nook →「API 管理」检查 Key 是否正确、是否过期';
    if (/403|forbidden/i.test(raw)) return 'API Key 被拒绝,可能账号被禁用或权限不足';
    if (/404|not found/i.test(raw)) return '接口地址不对,检查 baseUrl 和模型名填得对不对';
    if (/429|rate.?limit|quota/i.test(raw)) return '请求太频繁或额度用完了,等一会儿再试';
    if (/timeout|aborted|failed to fetch|networkerror/i.test(raw)) return '网络不通或超时了,检查一下代理和网络';
    return raw;
}

/**
 * 统一的一次请求。
 *
 * @returns {{ok:boolean, text:string, aborted:boolean, error?:string, prompt:string, parts?:Array, stats?:object}}
 */
async function run({ prompt, userTurn, temperature, stream, signal, onChunk, timeout }) {
    const ref = resolveApiRef();
    if (!ref) {
        return { ok: false, text: '', aborted: false, error: describeMissingApi(), prompt: prompt.text };
    }

    let sdk;
    try {
        sdk = await loadApiSdk();
    } catch (err) {
        return { ok: false, text: '', aborted: false, error: `API 模块加载失败:${err?.message || err}`, prompt: prompt.text };
    }

    const body = {
        messages: [
            { role: 'system', content: prompt.text },
            { role: 'user', content: userTurn },
        ],
        temperature,
    };

    if (stream) {
        const result = await sdk.executeApiStream({
            ...refToOptions(ref),
            endpoint: 'chat/completions',
            body,
            idleTimeout: TIMEOUT.streamIdle,
            signal,
            onChunk,
        });
        return {
            ok: result.success && Boolean(result.text),
            text: cleanModelOutput(result.text),
            aborted: result.aborted === true,
            // 中断时已经生成的部分照样返回 —— 那些字是用户的,不能因为他喊停就丢掉
            error: result.aborted ? '' : (result.error ? friendlyError(result) : (result.text ? '' : 'AI 返回了空内容,换个说法再试一次')),
            prompt: prompt.text,
            parts: prompt.parts,
            stats: prompt.stats,
        };
    }

    const result = await sdk.executeApiRequest({
        ...refToOptions(ref),
        endpoint: 'chat/completions',
        method: 'POST',
        body,
        timeout: timeout || TIMEOUT.normal,
    });

    if (!result || result.success === false) {
        return { ok: false, text: '', aborted: false, error: friendlyError(result), prompt: prompt.text, parts: prompt.parts, stats: prompt.stats };
    }
    const text = cleanModelOutput(extractContent(result.data));
    if (!text) {
        return { ok: false, text: '', aborted: false, error: 'AI 返回了空内容,换个说法再试一次', prompt: prompt.text, parts: prompt.parts, stats: prompt.stats };
    }
    return { ok: true, text, aborted: false, prompt: prompt.text, parts: prompt.parts, stats: prompt.stats };
}

// ============================================================
// 三种调用
// ============================================================

/**
 * 让人设本人回答。流式 —— 一句一句冒出来才有「在跟人说话」的感觉。
 */
export function askPersona({ draft, quiz, input, signal, onChunk } = {}) {
    const prompt = buildPersonaPrompt({ draft, quiz });
    const question = String(input || '').trim() || String(quiz?.question || '').trim();
    if (!question) {
        return Promise.resolve({ ok: false, text: '', aborted: false, error: '没有要问的内容', prompt: prompt.text });
    }
    return run({ prompt, userTurn: question, temperature: 0.9, stream: true, signal, onChunk });
}

/**
 * 让顾问给一条修改建议。
 *
 * 不用流式:输出是要解析的结构块,半截的块解析不了,逐字冒出来反而让人以为它写错了。
 * 温度压低 —— 这一步要的是稳定命中格式,不是发挥。
 */
export function askAdvisor({ draft, quiz, request, signal } = {}) {
    const prompt = buildAdvisorPrompt({ draft, quiz, request });
    const turn = String(request || '').trim() || '看看这张卡现在最该改的是哪一处。';
    return run({ prompt, userTurn: turn, temperature: 0.4, stream: false, signal });
}

/**
 * 任意格式 → 本系统人设卡正文。
 *
 * 温度给到 0.2:这一步是**搬运**不是创作,任何"发挥"都是在给用户的人设里掺私货。
 */
export function convertToCardText({ raw, signal } = {}) {
    const source = String(raw || '').trim();
    const prompt = buildConvertPrompt();
    if (!source) {
        return Promise.resolve({ ok: false, text: '', aborted: false, error: '先把要转换的人设贴进来', prompt: prompt.text });
    }
    return run({
        prompt,
        userTurn: `下面是要转换的人设原文:\n\n${source}`,
        temperature: 0.2,
        stream: false,
        signal,
        timeout: TIMEOUT.convert,
    });
}

// ============================================================
// 中断
// ============================================================

/**
 * 每种任务一个 controller。
 *
 * 按任务而不是全局:用户一边等扮演回答一边点「让顾问看看」时,
 * 停掉一个不该把另一个也掐了。
 */
const _controllers = new Map();

export function createAbort(taskKey) {
    abort(taskKey);
    const controller = new AbortController();
    _controllers.set(String(taskKey), controller);
    return controller.signal;
}

export function abort(taskKey) {
    const key = String(taskKey);
    const controller = _controllers.get(key);
    if (controller) {
        try { controller.abort(); } catch (_) { /* 已经结束了 */ }
        _controllers.delete(key);
    }
}

export function releaseAbort(taskKey) {
    _controllers.delete(String(taskKey));
}

export function abortAll() {
    for (const key of [..._controllers.keys()]) abort(key);
}
