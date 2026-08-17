/**
 * 四叶草 · AI 服务
 *
 * 职责三件：选 API → 发请求 → 把 JSON 抠出来。**不碰 store，不碰 DOM。**
 *
 * ── 选哪个 API ────────────────────────────────────────────────────
 *
 * 「默认用户绑定的 api」= 默认用户卡的 `boundResources.apiRefs` 第一条。
 * 用户没绑就退到第一个可用的 —— 原型式的「没绑就报错」很难受，
 * 而且错误提示不说该去哪儿配。
 *
 * ── 为什么不用流式 ────────────────────────────────────────────────
 *
 * 这个 App 要的都是**结构化 JSON**，流式吐一半的 JSON 解析不了，
 * 展示价值为零。用户等待期间看到的是加载动画，不是逐字冒出来的文本。
 * 小剧场是唯一有理由流式的地方，但它同样要 JSON（要能逐句改），
 * 所以也走一次性 —— 换来的是「解析失败能明确报错」而不是填一堆乱码。
 */

import { TIMEOUT } from '../constants.js';
import { extractJson } from '../utils.js';

// ============================================================
// 选 API
// ============================================================

/** 列出所有可用的 API 引用，给「换一个 API」的 UI 用 */
export function listApiRefs() {
    const apiSdk = typeof window !== 'undefined' ? window.__apiSdk : null;
    if (!apiSdk) return [];
    const out = [];

    try {
        for (const group of apiSdk.apiGroupSdk?.list?.() || []) {
            if (!group?.id) continue;
            const count = Array.isArray(group.apiKeyIds) ? group.apiKeyIds.length : 0;
            out.push({
                type: 'group', refId: String(group.id),
                label: group.name || '未命名分组', sub: `分组 · ${count} 个 Key`,
            });
        }
    } catch (_) { /* 分组不可用不影响单 key */ }

    try {
        for (const key of apiSdk.apiKeySdk?.list?.() || []) {
            if (!key?.id || key.enabled === false) continue;
            out.push({
                type: 'key', refId: String(key.id),
                label: key.label || key.model || '未命名 Key', sub: key.model || key.provider || '',
            });
        }
    } catch (_) { /* ignore */ }

    return out;
}

/**
 * 解析这次该用哪个 API。
 * 优先级：显式指定 → 默认用户卡绑定的 → 第一个可用的。
 */
export function resolveApiRef(override) {
    const all = listApiRefs();
    if (override?.refId) {
        const hit = all.find((r) => r.type === override.type && r.refId === String(override.refId));
        if (hit) return { type: hit.type, refId: hit.refId };
    }

    try {
        const sdk = window.settingsSdk;
        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        for (const ref of user?.boundResources?.apiRefs || []) {
            const type = ref.refType || ref.type;
            const refId = ref.refId || ref.id;
            if (!type || !refId) continue;
            return { type: type === 'group' ? 'group' : 'key', refId: String(refId) };
        }
    } catch (_) { /* ignore */ }

    return all.length ? { type: all[0].type, refId: all[0].refId } : null;
}

function describeMissingApi() {
    if (typeof window === 'undefined' || !window.__apiSdk) return 'API 模块还没加载好，稍等一下再试';
    if (listApiRefs().length === 0) {
        return '还没有可用的 API Key。去「设置 → API 管理」加一个，回来就能生成了';
    }
    return '选中的 API 已经被删掉或停用了，去「我的 → 生成设置」重新选一个';
}

/**
 * HTTP 状态码翻译成人话。
 *
 * 面向用户的错误要同时满足：能搜索、能转发、能执行（AGENTS2 §15.11）。
 * 这里至少做到最后一条 —— 告诉他下一步该干什么。
 */
function friendlyError(result) {
    const raw = result?.error || 'AI 调用失败';
    const status = result?.statusCode;
    if (status === 401) return 'API Key 没被接受（401）。去「设置 → API 管理」点那张 Key 的诊断看看';
    if (status === 403) return 'API Key 被拒绝（403），可能账号被禁用或没有这个模型的权限';
    if (status === 404) return '接口地址不对（404），检查 Base URL 和模型名';
    if (status === 429) return '请求太密或额度用完了（429），等一会儿再试';
    if (/timeout|aborted/i.test(raw)) return '请求超时了。网络问题，或者这次要生成的内容太长';
    return raw;
}

// ============================================================
// 调用
// ============================================================

/**
 * 跑一次生成，要求返回 JSON。
 *
 * @param {object} opts
 * @param {string} opts.system      系统提示词（由 prompt-builder 产出）
 * @param {string} [opts.user]      本轮指令，不传时用一句兜底
 * @param {number} [opts.temperature]
 * @param {object} [opts.apiRef]    显式指定 API
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ok:boolean, data?:any, raw?:string, error?:string}>}
 */
export async function generateJson(opts = {}) {
    const result = await generateText(opts);
    if (!result.ok) return result;

    const data = extractJson(result.raw);
    if (!data) {
        // ★ 解析失败要明确报错，不能把乱码填进 UI 假装成功（AGENTS2 §13.6.2）
        return {
            ok: false,
            raw: result.raw,
            error: 'AI 没按格式返回，再试一次就好（多数时候是它多说了几句解释）',
        };
    }
    return { ok: true, data, raw: result.raw };
}

/** 要纯文本的场合（概要） */
export async function generateText(opts = {}) {
    const {
        system = '', user = '按上面的要求生成。', temperature = 0.9,
        apiRef: override, signal,
    } = opts;

    if (!system) return { ok: false, error: '提示词是空的' };

    const apiRef = resolveApiRef(override);
    if (!apiRef) return { ok: false, error: describeMissingApi() };

    let sdk;
    try {
        sdk = await import('../../setting/api-manager/api-key-sdk.js');
    } catch (err) {
        return { ok: false, error: `API 模块加载失败：${err?.message || err}` };
    }

    let result;
    try {
        result = await sdk.executeApiRequest({
            apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
            groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
            endpoint: 'chat/completions',
            method: 'POST',
            body: {
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                temperature,
            },
            timeout: TIMEOUT.normal,
        });
    } catch (err) {
        // ★ 整条链路包在 try/catch 里会把「必崩」降级成「有时候不好使」，
        //   所以这里一定要 console.error 出来（AGENTS2 §15.6）
        console.error('[shop] AI 调用抛异常', err);
        return { ok: false, error: err?.message || String(err) };
    }

    if (signal?.aborted) return { ok: false, error: '已取消', aborted: true };

    if (!result || result.success === false) {
        return { ok: false, error: friendlyError(result) };
    }

    const raw = extractContent(result.data);
    if (!raw) return { ok: false, error: 'AI 返回了空内容，换个说法再试一次' };
    return { ok: true, raw };
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

// ============================================================
// 中断
// ============================================================

const _controllers = new Map();

export function createAbort(key) {
    abort(key);
    const controller = new AbortController();
    _controllers.set(String(key), controller);
    return controller.signal;
}

export function abort(key) {
    const c = _controllers.get(String(key));
    if (c) {
        try { c.abort(); } catch (_) { /* 已经结束了 */ }
        _controllers.delete(String(key));
    }
}

export function releaseAbort(key) {
    _controllers.delete(String(key));
}
