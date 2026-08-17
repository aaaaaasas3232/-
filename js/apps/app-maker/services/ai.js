/**
 * App 制作 · AI 需求翻译
 *
 * 用户的原话通常是「我想要那种一格一格的，点进去能看大图」。
 * 这句话没错，但拿去给 AI 写代码，它得猜；猜错了用户还说不清哪里不对 ——
 * 因为用户本来就不知道那叫「网格布局 + 详情页」。
 *
 * 这个服务干的就是这件事：把大白话翻译成这个项目里的**准确术语**，
 * 并且顺便给出「问卷里该怎么选」的具体建议。
 *
 * ── 用哪个 API ────────────────────────────────────────────────────
 * 优先用「当前用户人设卡上绑定的 API」——这是用户在 nook 里配过一次、
 * 全系统共用的那个。没绑就退到第一个可用的 Key。
 * 两条都没有时给出的错误提示必须写清楚该去哪儿配，
 * 只说「未找到 API 配置」等于没说。
 */

import { PAGE_LAYOUTS, CARD_TYPES, MODAL_CHOICES, ISLAND_CHOICES, WIDGET_CHOICES, TOPBAR_TYPES, TOPBAR_BUTTON_ACTIONS, TABBAR_TYPES } from '../constants.js';

/** 列出所有可用的 API 引用 */
export function listApiRefs() {
    const apiSdk = window.__apiSdk;
    if (!apiSdk) return [];
    const out = [];
    try {
        const groups = apiSdk.apiGroupSdk?.list?.() || [];
        for (const g of groups) {
            if (!g?.id) continue;
            out.push({ type: 'group', refId: String(g.id), label: g.name || '未命名分组' });
        }
    } catch (_) { /* 分组不可用不影响单 key */ }
    try {
        const keys = apiSdk.apiKeySdk?.list?.() || [];
        for (const k of keys) {
            if (!k?.id || k.enabled === false) continue;
            out.push({ type: 'key', refId: String(k.id), label: k.label || k.model || '未命名 Key' });
        }
    } catch (_) { /* ignore */ }
    return out;
}

/**
 * 解析该用哪个 API。
 * @returns {{type:'key'|'group', refId:string, from:string} | null}
 */
export function resolveApiRef() {
    try {
        const sdk = window.settingsSdk;
        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        const refs = Array.isArray(user?.boundResources?.apiRefs) ? user.boundResources.apiRefs : [];
        for (const ref of refs) {
            const type = ref.refType || ref.type;
            const refId = ref.refId || ref.id;
            if (type && refId) {
                return { type: type === 'group' ? 'group' : 'key', refId: String(refId), from: '用户人设绑定' };
            }
        }
    } catch (_) { /* 人设读不到就往下兜底 */ }

    const all = listApiRefs();
    if (all.length) return { type: all[0].type, refId: all[0].refId, from: '第一个可用的' };
    return null;
}

export function describeApiState() {
    if (!window.__apiSdk) {
        return { ok: false, text: 'API 模块还没加载。先去 nook 的「API 管理」看一眼，再回来。' };
    }
    const ref = resolveApiRef();
    if (!ref) {
        return { ok: false, text: '还没有可用的 API Key。去 nook →「API 管理」加一个，回来就能用了。' };
    }
    const hit = listApiRefs().find((r) => r.type === ref.type && r.refId === ref.refId);
    return { ok: true, text: `${hit?.label || ref.refId}（${ref.from}）`, ref };
}

// ---------------------------------------------------------------------------
// 提示词
// ---------------------------------------------------------------------------

function vocab() {
    return [
        `布局：${PAGE_LAYOUTS.map((l) => `${l.title}(${l.value})`).join('、')}`,
        `卡片：${CARD_TYPES.map((c) => `${c.title}(${c.value})`).join('、')}`,
        `顶栏：${TOPBAR_TYPES.map((t) => `${t.title}(${t.value})`).join('、')}`,
        `底栏：${TABBAR_TYPES.map((t) => `${t.title}(${t.value})`).join('、')}`,
        `弹窗：${MODAL_CHOICES.map((m) => `${m.title}(${m.value})`).join('、')}`,
        `灵动岛：${ISLAND_CHOICES.map((i) => `${i.title}(${i.value})`).join('、')}`,
        `小组件：${WIDGET_CHOICES.map((w) => `${w.title}(${w.value})`).join('、')}`,
    ].join('\n');
}

function buildSystemPrompt(bp) {
    return `你是「App 制作」里的需求翻译助手。

用户正在配置一个手机 App，但他不懂技术。他会用大白话描述想要什么，
你的工作是把它翻译成这个项目里的**准确术语**，并给出具体的配置建议。

## 你只能使用下面这套词汇

${vocab()}

用户描述的东西如果不在这套词汇里，说清楚「这个做不了 / 需要额外开发」，
不要编一个不存在的选项名 —— 用户会照着去问卷里找，找不到就会以为是自己看漏了。

## 用户当前的配置

- App 名称：${bp.appName}
- 定位：${bp.tagline || '（还没写）'}
- 说明：${bp.appDesc || '（还没写）'}
- 渲染模式：${bp.renderModeInfo?.title || bp.renderMode}
- 主页面：${bp.pages.map((p) => `${p.name}（${p.layoutTitle}，卡片：${p.cards.map((c) => c.title).join('/') || '未选'}）`).join('；') || '还没有'}
- 顶栏：${bp.topbar.visible ? bp.topbar.title : '不要'}｜底栏：${bp.tabbar.visible ? bp.tabbar.title : '不要'}

## 回答方式

1. **先用一两句话复述你的理解**，让用户确认你没理解偏。
2. **给出专业说法**：把他说的每一块对应到上面的术语，格式是「你说的 X → 术语 Y」。
3. **给出具体建议**：问卷第几步该选什么。要具体到选项名。
4. 如果他描述里有相互矛盾或者移动端上会出问题的地方（比如遮挡、点不准、一屏塞太多），直接指出来。

回答控制在 300 字以内，用短句，不要用 Markdown 标题，不要客套。
用户不懂技术，所有术语第一次出现时用一个短括号解释。

## 可选：结构化建议

如果你的建议能直接落到问卷字段上，在回答最后附一段 JSON，用 \`\`\`json 包起来。
只填你有把握的字段，没把握的不要写。可用字段：

\`\`\`json
{
  "tagline": "一句话定位",
  "appDesc": "详细描述",
  "renderMode": "template|hybrid|vue",
  "accentColor": "#rrggbb（主色，不确定就别填）",
  "topbarType": "standard|title-only|large-title|search|segmented|buttons-only|none",
  "topbarButtons": ["add", "search", "filter"],
  "tabbarType": "default|minimal|indicator|liquid|wave|none",
  "fabPosition": "none|bottom-right|bottom-center|bottom-left",
  "pages": [{ "name": "页面名", "desc": "干嘛的", "layout": "column", "cards": ["info"], "subpages": ["detail"] }],
  "modals": ["confirm"],
  "islands": ["toast"],
  "widgets": ["stat"],
  "capabilities": ["db"]
}
\`\`\``;
}

// ---------------------------------------------------------------------------
// 调用
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {object} opts.blueprint 当前配置
 * @param {{role:string,content:string}[]} opts.history 之前的对话
 * @param {string} opts.input 用户这一轮说的话
 * @returns {Promise<{ok:boolean, text?:string, suggestion?:object, error?:string}>}
 */
export async function askAssistant({ blueprint, history = [], input }) {
    const question = String(input || '').trim();
    if (!question) return { ok: false, error: '还没输入内容' };

    const apiSdk = window.__apiSdk;
    if (!apiSdk?.executeApiRequest) {
        return { ok: false, error: 'API 模块还没加载好。去 nook →「API 管理」打开一次，再回来试。' };
    }

    const apiRef = resolveApiRef();
    if (!apiRef) {
        return { ok: false, error: '还没有可用的 API Key。去 nook →「API 管理」加一个。' };
    }

    // 只带最近 8 轮：这是个一次性的润色工具，更早的对话对当前问题几乎没帮助，
    // 全量带上只会让每次请求越来越贵、越来越慢
    const recent = history.slice(-8).map((m) => ({ role: m.role, content: m.content }));

    try {
        const result = await apiSdk.executeApiRequest({
            apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
            groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
            endpoint: 'chat/completions',
            method: 'POST',
            body: {
                messages: [
                    { role: 'system', content: buildSystemPrompt(blueprint) },
                    ...recent,
                    { role: 'user', content: question },
                ],
                temperature: 0.6,
            },
            timeout: 90000,
        });

        if (!result || result.success === false) {
            return { ok: false, error: friendlyError(result) };
        }

        const raw = extractContent(result.data);
        if (!raw) return { ok: false, error: 'AI 返回了空内容，换个说法再试一次' };

        const { text, suggestion } = splitSuggestion(raw);
        return { ok: true, text, suggestion };
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
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

function friendlyError(result) {
    const raw = String(result?.error || '请求失败');
    if (/401|403|unauthor/i.test(raw)) return 'API Key 被拒了，去 nook 的 API 管理确认一下 Key 和地址。';
    if (/429/.test(raw)) return '请求太频繁，等一会儿再试。';
    if (/timeout|abort/i.test(raw)) return '等太久了，可能是网络或者模型太慢。';
    return raw;
}

/**
 * 把回答正文和结尾的 JSON 建议拆开。
 *
 * 模型不一定听话：可能不给 JSON、可能给了但不合法、可能包在别的围栏里。
 * 所有这些情况都退化成「只有正文」——建议是锦上添花，不能因为它挂掉整个回答。
 */
function splitSuggestion(raw) {
    const match = raw.match(/```json\s*([\s\S]*?)```/i);
    if (!match) return { text: raw.trim(), suggestion: null };

    let suggestion = null;
    try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) suggestion = parsed;
    } catch (_) {
        // 拆不出来就当没有，正文照常显示
    }

    const text = raw.replace(match[0], '').trim();
    return { text: text || raw.trim(), suggestion };
}

/**
 * 把 AI 的结构化建议合并进 answers。
 *
 * **只接受白名单里的字段和白名单里的值** —— 模型完全可能编一个
 * `"layout": "fancy-grid"` 出来，直接写进 answers 的话，问卷里选不中任何一项，
 * 而生成器会退回默认值，用户看到的是「应用了但没变化」。
 *
 * @returns {{applied:string[], skipped:string[]}}
 */
export function applySuggestion(suggestion, store) {
    const applied = [];
    const skipped = [];
    if (!suggestion || typeof suggestion !== 'object') return { applied, skipped };

    const enums = {
        renderMode: ['template', 'hybrid', 'vue'],
        topbarType: TOPBAR_TYPES.map((t) => t.value),
        tabbarType: TABBAR_TYPES.map((t) => t.value),
        fabPosition: ['none', 'bottom-right', 'bottom-center', 'bottom-left'],
    };
    const arrays = {
        modals: MODAL_CHOICES.map((m) => m.value),
        islands: ISLAND_CHOICES.map((i) => i.value),
        widgets: WIDGET_CHOICES.map((w) => w.value),
        topbarButtons: TOPBAR_BUTTON_ACTIONS.map((b) => b.value),
        capabilities: ['db', 'ai', 'search', 'filter', 'image', 'share', 'favorite', 'darkMode', 'gesture', 'pullRefresh', 'onboarding', 'export'],
    };

    for (const field of ['tagline', 'appDesc']) {
        if (typeof suggestion[field] === 'string' && suggestion[field].trim()) {
            store.setAnswer(field, suggestion[field].trim());
            applied.push(field);
        }
    }

    // 主色单独校验：只收标准 CSS 颜色，AI 有时会回「蓝色」这种自然语言
    if (typeof suggestion.accentColor === 'string') {
        const c = suggestion.accentColor.trim();
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) || /^(rgb|hsl)a?\([^()]*\)$/i.test(c)) {
            store.setAnswer('accentColor', c);
            applied.push('accentColor');
        } else if (c) {
            skipped.push(`accentColor=${c}`);
        }
    }

    for (const [field, allowed] of Object.entries(enums)) {
        const v = suggestion[field];
        if (typeof v === 'string' && allowed.includes(v)) {
            store.setAnswer(field, v);
            applied.push(field);
        } else if (v !== undefined) {
            skipped.push(`${field}=${v}`);
        }
    }

    for (const [field, allowed] of Object.entries(arrays)) {
        const v = suggestion[field];
        if (!Array.isArray(v)) { if (v !== undefined) skipped.push(field); continue; }
        const clean = v.filter((x) => allowed.includes(x));
        if (clean.length) {
            store.setAnswer(field, clean);
            applied.push(field);
        }
        if (clean.length !== v.length) skipped.push(`${field} 里有 ${v.length - clean.length} 项不认识`);
    }

    if (Array.isArray(suggestion.pages) && suggestion.pages.length) {
        const layoutValues = PAGE_LAYOUTS.map((l) => l.value);
        const cardValues = CARD_TYPES.map((c) => c.value);
        const subValues = ['detail', 'edit', 'search', 'filter', 'settings', 'empty-guide', 'preview', 'history'];
        const pages = suggestion.pages.slice(0, 5).map((p) => store.makePage({
            name: String(p?.name || '').slice(0, 8) || '页面',
            desc: String(p?.desc || '').slice(0, 40),
            layout: layoutValues.includes(p?.layout) ? p.layout : 'column',
            cards: (Array.isArray(p?.cards) ? p.cards : []).filter((c) => cardValues.includes(c)),
            subpages: (Array.isArray(p?.subpages) ? p.subpages : []).filter((s) => subValues.includes(s)),
        }));
        pages.forEach((p) => { if (!p.cards.length) p.cards = ['info']; });
        store.setAnswer('pages', pages);
        store.setAnswer('pagePreset', 'custom');
        applied.push(`pages(${pages.length} 个)`);
    }

    return { applied, skipped };
}
