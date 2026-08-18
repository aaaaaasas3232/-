/**
 * 梦境编织 · AI 服务
 *
 * 职责就三件:选 API → 拼 prompt(委托 prompt-builder)→ 发请求并把增量吐回去。
 * **不碰 store,不碰 DOM** —— 调用方拿到结果自己决定怎么落盘、怎么渲染。
 *
 * ── 流式 ──────────────────────────────────────────────────────────
 *
 * 走框架层新加的 `executeApiStream`(`js/apps/setting/api-manager/api-key-sdk.js`)。
 * 两个和一次性请求不同的关键点:
 *
 *   1. **空闲超时**而不是总时长超时。生成三千字跑两分钟是正常的,
 *      该判定为挂掉的是「连续 90 秒没有任何新数据」。
 *   2. **中断保留已生成内容**。用户点「停止」时 `aborted: true` 但 `text` 里
 *      有已经写出来的部分 —— 那些字是用户的,不能因为他喊停就丢掉。
 *
 * ── 后台生成 ──────────────────────────────────────────────────────
 *
 * 原版有个 `enableBackgroundGeneration` 开关,但实现是「把回调塞进一个队列」,
 * 一旦编辑器组件卸载,回调里的 DOM 操作就全炸了(被 try/catch 吞掉,表现为「切出去再回来内容没了」)。
 *
 * 现在生成任务只往 **store** 写,不碰 DOM。组件卸载了照样在写,
 * 用户切回来时 Vue 按当前 state 重画,自然就看到完整内容。
 * 「后台生成」于是不需要任何特殊代码 —— 它是「状态和视图分离」的自然结果。
 */

import { buildPrompt, buildUserTurn, buildToolTurn } from './prompt-builder.js';
import { TIMEOUT, resolveWordRange } from '../constants.js';

// ============================================================
// API 选择
// ============================================================

/**
 * 列出所有可用的 API 引用,给「选择 API」UI 用。
 * @returns {{type:'key'|'group', refId:string, label:string, sub:string}[]}
 */
export function listApiRefs() {
    const apiSdk = window.__apiSdk;
    if (!apiSdk) return [];
    const out = [];

    try {
        const groups = apiSdk.apiGroupSdk?.list?.() || [];
        for (const group of groups) {
            if (!group?.id) continue;
            const count = Array.isArray(group.apiKeyIds) ? group.apiKeyIds.length : 0;
            out.push({ type: 'group', refId: String(group.id), label: group.name || '未命名分组', sub: `分组 · ${count} 个 Key` });
        }
    } catch (_) { /* 分组功能不可用不影响单 key */ }

    try {
        const keys = apiSdk.apiKeySdk?.list?.() || [];
        for (const key of keys) {
            if (!key?.id || key.enabled === false) continue;
            out.push({ type: 'key', refId: String(key.id), label: key.label || key.model || '未命名 Key', sub: key.model || key.provider || '' });
        }
    } catch (_) { /* ignore */ }

    return out;
}

/**
 * 解析这本书该用哪个 API。
 *
 * 优先级:书自己绑的 → 当前用户人设绑的 → 第一个可用的。
 *
 * 最后那条兜底很重要:原版没有,用户新建一本书不去「切换 API」里点一下就完全发不出去,
 * 而错误提示只说「未找到 API 配置」,根本不提示该去哪儿配。
 */
export function resolveApiRef(book) {
    if (book?.apiRef?.refId) {
        const all = listApiRefs();
        const hit = all.find((r) => r.type === book.apiRef.type && r.refId === String(book.apiRef.refId));
        if (hit) return { type: hit.type, refId: hit.refId };
    }

    try {
        const user = window.settingsSdk?.defaultUserCard?.getDefault?.() || window.settingsSdk?.users?.getActive?.();
        const refs = Array.isArray(user?.boundResources?.apiRefs) ? user.boundResources.apiRefs : [];
        for (const ref of refs) {
            const type = ref.refType || ref.type;
            const refId = ref.refId || ref.id;
            if (!type || !refId) continue;
            return { type: type === 'group' ? 'group' : 'key', refId: String(refId) };
        }
    } catch (_) { /* ignore */ }

    const all = listApiRefs();
    return all.length ? { type: all[0].type, refId: all[0].refId } : null;
}

function describeMissingApi() {
    const apiSdk = window.__apiSdk;
    if (!apiSdk) return 'API 模块还没加载好,稍等一下再试';
    const all = listApiRefs();
    if (all.length === 0) return '还没有可用的 API Key。去「设置 → API 管理」添加一个,再回到书籍设置里选上';
    return '这本书绑定的 API 已被删除或停用,请在书籍设置里重新选择';
}

// ============================================================
// 生成
// ============================================================

/**
 * 跑一次生成。
 *
 * @param {object} opts
 * @param {object} opts.book
 * @param {object[]} opts.orderedChapters
 * @param {object} opts.chapter
 * @param {object} opts.library
 * @param {object} [opts.mode]                当前输入模式(正文生成时必须)
 * @param {string} [opts.input]               用户这一轮输入
 * @param {string} [opts.kind]                'write' | 'reroll' | 'expand' | 'summary' | 'innerView' | 'selection'
 * @param {object} [opts.payload]             工具类生成的载荷
 * @param {string} [opts.overrideUserTurn]    直接指定本轮指令,跳过模板拼装
 *                                            (衍生生成器自己拼好了完整指令,不需要再套模板)
 * @param {{min,max}} [opts.wordRange]
 * @param {number}   [opts.temperature]
 * @param {boolean}  [opts.stream]            不传时跟随设置
 * @param {AbortSignal} [opts.signal]
 * @param {(delta:string, full:string)=>void} [opts.onChunk]
 * @returns {Promise<{ok:boolean, text:string, aborted:boolean, error?:string, prompt?:string, userTurn?:string}>}
 */
export async function generate(opts = {}) {
    const {
        book, orderedChapters = [], chapter, library,
        mode, input = '', kind = 'write', payload = {},
        signal, onChunk,
    } = opts;

    if (!book || !library) {
        return { ok: false, text: '', aborted: false, error: '数据还没加载完' };
    }

    const wordRange = opts.wordRange || resolveWordRange(library.settings);

    // 1) 上下文 —— 和预览面板看到的是同一份
    const { text: systemPrompt } = buildPrompt({ book, orderedChapters, chapter, library, mode, wordRange });

    // 2) 本轮指令
    const userTurn = opts.overrideUserTurn
        ? String(opts.overrideUserTurn)
        : (kind === 'write'
            ? buildUserTurn({ mode, input, wordRange })
            : buildToolTurn({ kind, library, payload, wordRange }));

    if (!userTurn) {
        return { ok: false, text: '', aborted: false, error: '没有可发送的内容' };
    }

    // 3) 选 API
    const apiRef = resolveApiRef(book);
    if (!apiRef) {
        return { ok: false, text: '', aborted: false, error: describeMissingApi(), prompt: systemPrompt };
    }

    const useStream = opts.stream != null ? opts.stream : library.settings.useStreamMode !== false;
    const body = {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userTurn },
        ],
        temperature: Number.isFinite(opts.temperature) ? opts.temperature : 0.85,
    };

    let sdk;
    try {
        sdk = await import('../../setting/api-manager/api-key-sdk.js');
    } catch (err) {
        return { ok: false, text: '', aborted: false, error: `API 模块加载失败:${err?.message || err}`, prompt: systemPrompt };
    }

    // 4) 发请求
    if (useStream) {
        const result = await sdk.executeApiStream({
            apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
            groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
            endpoint: 'chat/completions',
            body,
            idleTimeout: TIMEOUT.streamIdle,
            signal,
            onChunk,
        });
        return {
            ok: result.success,
            text: cleanOutput(result.text),
            aborted: result.aborted === true,
            error: result.error || '',
            prompt: systemPrompt,
            userTurn,
        };
    }

    const result = await sdk.executeApiRequest({
        apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
        groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
        endpoint: 'chat/completions',
        method: 'POST',
        body,
        timeout: TIMEOUT.normal,
    });

    if (!result || result.success === false) {
        return {
            ok: false, text: '', aborted: false,
            error: friendlyError(result), prompt: systemPrompt, userTurn,
        };
    }

    const text = cleanOutput(extractContent(result.data));
    if (!text) {
        return { ok: false, text: '', aborted: false, error: 'AI 返回了空内容,换个说法再试一次', prompt: systemPrompt, userTurn };
    }
    return { ok: true, text, aborted: false, prompt: systemPrompt, userTurn };
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
 * 清理模型输出。
 *
 * 即使 prompt 里写了「只输出正文」,模型还是会时不时加上
 * ```markdown 围栏、「好的,以下是...」开场白、以及一整段结尾解释。
 * 这些进了正文就是脏数据,用户每次都得手动删。
 */
function cleanOutput(raw) {
    let text = String(raw || '').trim();
    if (!text) return '';

    // 去 markdown 代码围栏
    const fence = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
    if (fence) text = fence[1].trim();

    // 去开场白(只去开头一行,且必须以冒号结尾 —— 避免误删正文第一句)
    text = text.replace(/^(?:好的|好[,，]|明白|收到)[^\n]{0,30}[:：]\s*\n+/, '');
    text = text.replace(/^(?:以下是|这是)[^\n]{0,30}[:：]\s*\n+/, '');

    return text.trim();
}

function friendlyError(result) {
    const raw = result?.error || 'AI 调用失败';
    const status = result?.statusCode;
    if (status === 401) return 'API Key 鉴权失败(401),去「设置 → API 管理」检查 Key 是否正确、是否过期、余额是否充足';
    if (status === 403) return 'API Key 被拒绝(403),可能账号被禁用或权限不足';
    if (status === 404) return '接口地址不对(404),检查 baseUrl 和 model 填得对不对';
    if (status === 429) return '请求太频繁或额度用完了(429),等一会儿再试';
    if (/timeout|aborted/i.test(raw)) return '请求超时了,可能是网络问题或这次要生成的内容太长';
    return raw;
}

// ============================================================
// 停止
// ============================================================

/**
 * 每章一个 AbortController。
 *
 * 按章而不是全局:后台同时给两章生成时,停掉一章不该把另一章也掐了。
 */
const _controllers = new Map();

export function createAbort(chapterId) {
    abort(chapterId);
    const controller = new AbortController();
    _controllers.set(String(chapterId), controller);
    return controller.signal;
}

export function abort(chapterId) {
    const key = String(chapterId);
    const controller = _controllers.get(key);
    if (controller) {
        try { controller.abort(); } catch (_) {}
        _controllers.delete(key);
    }
}

export function abortAll() {
    for (const key of [..._controllers.keys()]) abort(key);
}

export function releaseAbort(chapterId) {
    _controllers.delete(String(chapterId));
}

export function isAborting(chapterId) {
    return _controllers.has(String(chapterId));
}
