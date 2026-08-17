/**
 * 点灯 · AI 服务
 *
 * 三件事：选 API → 发请求 → 抠结果。不碰 store、不碰 DOM。
 * 选 API 优先级：显式指定 → 默认用户卡绑定的 → 第一个可用的。
 *
 * 这个 App 的请求分两类：
 *   - 结构化（问卷 / 规划 / 总结 / 侧写）→ generateJson
 *   - 对话（上课 / 反转课堂）→ generateChat，要带多轮上下文
 */

import { TIMEOUT } from '../constants.js';
import { asArray, extractJson } from '../utils.js';

// ============================================================
// 选 API
// ============================================================

export function listApiRefs() {
    const apiSdk = typeof window !== 'undefined' ? window.__apiSdk : null;
    if (!apiSdk) return [];
    const out = [];

    try {
        for (const group of apiSdk.apiGroupSdk?.list?.() || []) {
            if (!group?.id) continue;
            const count = Array.isArray(group.apiKeyIds) ? group.apiKeyIds.length : 0;
            out.push({
                type: 'group',
                refId: String(group.id),
                label: group.name || '未命名分组',
                sub: `分组 · ${count} 个 Key`,
            });
        }
    } catch (_) { /* 分组不可用不影响单 key */ }

    try {
        for (const key of apiSdk.apiKeySdk?.list?.() || []) {
            if (!key?.id || key.enabled === false) continue;
            out.push({
                type: 'key',
                refId: String(key.id),
                label: key.label || key.model || '未命名 Key',
                sub: key.model || key.provider || '',
            });
        }
    } catch (_) { /* ignore */ }

    return out;
}

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
        return '还没有可用的 API Key。去「设置 → API 管理」加一个，回来就能开课了';
    }
    return '选中的 API 已经被删掉或停用了，去「设置 → API 管理」检查一下';
}

/** HTTP 状态码翻成用户能执行的下一步 */
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
// 调用
// ============================================================

/**
 * 底层：给什么 messages 就发什么。
 * @returns {Promise<{ok:boolean, raw?:string, error?:string}>}
 */
export async function generateChat(opts = {}) {
    const {
        messages = [],
        temperature = 0.85,
        timeout = TIMEOUT.normal,
        apiRef: override,
    } = opts;

    const list = asArray(messages).filter((m) => m && m.role && String(m.content ?? '').trim());
    if (list.length === 0) return { ok: false, error: '没有要发的内容' };

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
                messages: list.map((m) => ({ role: m.role, content: String(m.content) })),
                temperature,
            },
            timeout,
        });
    } catch (err) {
        // 整条链路都有 try/catch 兜底，这里必须 console.error，
        // 否则「必崩」被降级成「有时候不好使」
        console.error('[starlit] AI 调用抛异常', err);
        return { ok: false, error: err?.message || String(err) };
    }

    if (!result || result.success === false) {
        return { ok: false, error: friendlyError(result) };
    }

    const raw = extractContent(result.data);
    if (!raw) return { ok: false, error: 'AI 返回了空内容，换个说法再试一次' };
    return { ok: true, raw };
}

/** 单轮：system + user */
export function generateText(opts = {}) {
    const { system = '', user = '按上面的要求生成。', ...rest } = opts;
    if (!system) return Promise.resolve({ ok: false, error: '提示词是空的' });
    return generateChat({
        ...rest,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
    });
}

/**
 * 要 JSON 的场合。解析失败必须明确报错 ——
 * 把乱码填进 UI 假装成功，用户会以为是自己哪里点错了。
 */
export async function generateJson(opts = {}) {
    const result = opts.messages ? await generateChat(opts) : await generateText(opts);
    if (!result.ok) return result;

    const data = extractJson(result.raw);
    if (!data) {
        return {
            ok: false,
            raw: result.raw,
            error: 'AI 没按格式返回，再点一次就好（多数时候是它多说了几句解释）',
        };
    }
    return { ok: true, data, raw: result.raw };
}

/** 有没有可用的 API —— UI 用它决定要不要把按钮画灰 */
export function hasUsableApi() {
    return Boolean(resolveApiRef(null));
}
