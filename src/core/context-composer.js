/**
 * 框架层 · 上下文拼装器(context composer)
 *
 * ── 这个文件解决什么问题 ────────────────────────────────────────────
 *
 * 项目里已经有两个 App 在做同一件事:把十几段正文拼成最终发给 AI 的 system prompt,
 * 并且要让用户**看得见**这坨东西到底长什么样。
 *
 *   - murmur(chat-app):`prompt-manager-page.js` 拼 `previewParts` → `writeContextPreview` → pre
 *   - 梦境编织(dream-weaver):`buildPrompt` 发送 / `buildFullContextPreview` 预览
 *
 * 两边各写了一份,于是各自都踩了坑:
 *
 *   - murmur:拼装是 `renderPromptManagerPage()` 的**副作用**,用户不点进那一页 pre 就是旧的
 *     (AGENTS2 §9.3)
 *   - 梦境编织:预览走 `buildFullContextPreview`、发送走 `buildPrompt`,**两条路径内容不一样**,
 *     用户在预览里关掉的段落照样会被发出去(见迁移蓝图 §7.1)
 *
 * 结论就是 AGENTS2 §9.2 那句话:**同一个业务口径出现第二份实现的那一刻,就该抽文件。**
 * 这个模块把「拼装」变成一个**纯函数**,把「预览」变成它的一个消费者,
 * 从根上消灭「预览 ≠ 实际发送」和「没人渲染就不刷新」这两类 bug。
 *
 * ── 核心约定 ──────────────────────────────────────────────────────
 *
 * 1. 输入是一组 **part**(段),不是一坨字符串:
 *      { id, title, content, tag?, active?, locked?, source?, order? }
 * 2. 输出既有最终文本,也有每段的**统计与命中情况**,预览 UI 直接用同一份结果渲染
 *    —— 这是「预览 == 发送」的物理保证:它们是同一次 `composeContext()` 的两个返回字段。
 * 3. 每段用成对标签 `<XX开始>` / `<XX结束>` 包裹(沿用 chat 的 prompt-tags 约定),
 *    这样按段替换 / 剪切不需要「找下一个一级标题」那种脆弱启发式。
 *
 * ── 迁移提示 ──────────────────────────────────────────────────────
 *
 * `js/apps/chat-app/services/prompt-tags.js` 的 wrap/strip/replace/has 已经和这里语义一致,
 * 后续可以退化成 re-export shim(参考 AcModal 的做法),chat 内部 import 路径一个字都不用改。
 */

// ============================================================
// 1) 标签
// ============================================================

/** 标签名里不能出现尖括号 / 换行,长度也别太离谱 */
export function sanitizeTag(raw) {
    return String(raw || '')
        .replace(/[<>\r\n]/g, '')
        .replace(/\s+/g, '')
        .slice(0, 24) || '提示词';
}

export function openTag(tag) {
    return `<${sanitizeTag(tag)}开始>`;
}

export function closeTag(tag) {
    return `<${sanitizeTag(tag)}结束>`;
}

/** 用成对标签包一段内容。已经被同名标签包过的原样返回(幂等)。 */
export function wrapBlock(tag, content) {
    const body = String(content || '').trim();
    if (!body) return '';
    const o = openTag(tag);
    const c = closeTag(tag);
    if (body.startsWith(o) && body.endsWith(c)) return body;
    return `${o}\n${body}\n${c}`;
}

function blockRange(text, tag) {
    const o = openTag(tag);
    const c = closeTag(tag);
    const start = text.indexOf(o);
    if (start === -1) return null;
    const closeAt = text.indexOf(c, start + o.length);
    const end = closeAt === -1 ? text.length : closeAt + c.length;
    return { start, end };
}

/** 某个标签段是否存在 */
export function hasBlock(text, tag) {
    return blockRange(String(text || ''), tag) !== null;
}

/** 把某个标签段整段删掉(含标签本身)。找不到标签时返回原文。 */
export function stripBlock(text, tag) {
    const src = String(text || '');
    const range = blockRange(src, tag);
    if (!range) return src;
    const before = src.slice(0, range.start).replace(/[\r\n]+$/, '');
    const after = src.slice(range.end).replace(/^[\r\n]+/, '');
    return [before, after].filter(Boolean).join('\n\n');
}

/**
 * 把某个标签段整段换成新内容(新内容会被自动包上同名标签)。
 * 找不到旧段时追加到末尾;next 为空等价于 stripBlock。
 */
export function replaceBlock(text, tag, next) {
    const src = String(text || '');
    const body = String(next || '').trim();
    const range = blockRange(src, tag);
    if (!range) {
        if (!body) return src;
        return src ? `${src.replace(/[\r\n]+$/, '')}\n\n${wrapBlock(tag, body)}` : wrapBlock(tag, body);
    }
    if (!body) return stripBlock(src, tag);
    const before = src.slice(0, range.start).replace(/[\r\n]+$/, '');
    const after = src.slice(range.end).replace(/^[\r\n]+/, '');
    return [before, wrapBlock(tag, body), after].filter(Boolean).join('\n\n');
}

/** 读出某段的正文(不含标签)。找不到返回 ''。 */
export function readBlock(text, tag) {
    const src = String(text || '');
    const range = blockRange(src, tag);
    if (!range) return '';
    const o = openTag(tag);
    const c = closeTag(tag);
    return src
        .slice(range.start + o.length, range.end)
        .replace(new RegExp(`${c}$`), '')
        .trim();
}

// ============================================================
// 2) Token 估算
// ============================================================

/**
 * 估算 token 数。
 *
 * 旧代码里到处是 `Math.ceil(len * 0.5)`,对纯中文勉强能用,一旦混了英文/代码就偏得离谱
 * (英文实际约 4 字符 1 token,按 0.5 算会高估一倍)。这里按字符类别分别计:
 *
 *   - CJK 汉字 / 假名 / 谚文:约 1 token 1 字
 *   - 其余(拉丁字母、数字、标点、空白):约 4 字符 1 token
 *
 * 仍然是估算 —— 真实分词取决于具体模型的 tokenizer,这里只求量级正确、跨语言不失真。
 */
export function estimateTokens(text) {
    const str = String(text || '');
    if (!str) return 0;
    let cjk = 0;
    for (const ch of str) {
        const code = ch.codePointAt(0);
        if (
            (code >= 0x4e00 && code <= 0x9fff) ||   // CJK 统一表意
            (code >= 0x3400 && code <= 0x4dbf) ||   // 扩展 A
            (code >= 0x3040 && code <= 0x30ff) ||   // 平/片假名
            (code >= 0xac00 && code <= 0xd7af) ||   // 谚文
            (code >= 0xf900 && code <= 0xfaff)      // 兼容表意
        ) {
            cjk += 1;
        }
    }
    const rest = Math.max(0, [...str].length - cjk);
    return Math.ceil(cjk + rest / 4);
}

// ============================================================
// 3) 拼装
// ============================================================

/**
 * @typedef {object} ContextPart
 * @property {string}  id        段唯一 id(排序、开关都按它存盘,**发布后别改**)
 * @property {string}  title     给用户看的标题
 * @property {string}  content   真正拼进 prompt 的正文
 * @property {string}  [tag]     包裹标签名;缺省用 title
 * @property {boolean} [active]  是否进入最终文本,默认 true
 * @property {boolean} [locked]  是否禁止用户关闭(如「回复格式」这类硬约束)
 * @property {string}  [source]  来源标记,预览里显示成来源标签
 * @property {string}  [group]   分组名,预览里折叠用
 * @property {boolean} [raw]     true 时不加标签,正文原样拼(给「已经自带标签」的内容用)
 */

function normalizePart(part, index) {
    const id = String(part?.id ?? `part-${index}`);
    const title = String(part?.title ?? '').trim() || id;
    const content = String(part?.content ?? '');
    return {
        id,
        title,
        content,
        tag: sanitizeTag(part?.tag || title),
        active: part?.active !== false,
        locked: part?.locked === true,
        source: part?.source ? String(part.source) : '',
        group: part?.group ? String(part.group) : '',
        raw: part?.raw === true,
        order: Number.isFinite(part?.order) ? Number(part.order) : index,
    };
}

/**
 * 按用户保存的顺序重排。
 *
 * `order` 数组里没有出现的段落**追加到末尾并保持原相对顺序** —— 这一条很关键:
 * 新增一段 prompt 时用户的旧排序里不会有它,如果直接丢掉或塞到最前面,
 * 用户会以为「新功能没生效」或者「排序被打乱了」。
 */
function applyOrder(parts, order) {
    if (!Array.isArray(order) || order.length === 0) return parts;
    const rank = new Map(order.map((id, i) => [String(id), i]));
    return parts
        .map((p, i) => ({ p, i }))
        .sort((a, b) => {
            const ra = rank.has(a.p.id) ? rank.get(a.p.id) : Number.MAX_SAFE_INTEGER;
            const rb = rank.has(b.p.id) ? rank.get(b.p.id) : Number.MAX_SAFE_INTEGER;
            if (ra !== rb) return ra - rb;
            return a.i - b.i;
        })
        .map((x) => x.p);
}

/**
 * 把一组 part 拼成最终文本。**纯函数,不碰 DOM、不读写存储。**
 *
 * @param {ContextPart[]} parts
 * @param {object}   [opts]
 * @param {string[]} [opts.order]      用户保存的段落顺序(id 数组)
 * @param {string}   [opts.separator]  段间分隔,默认 '\n\n'
 * @param {number}   [opts.tokenBudget] token 预算;超出时在 stats 里标 overBudget
 * @returns {{ text:string, parts:Array, stats:object }}
 *   - `text`   最终 prompt(要发出去的就是它)
 *   - `parts`  每段的规范化结果 + `tokens` / `included`,预览 UI 直接渲染这一份
 *   - `stats`  `{ total, included, skipped, tokens, chars, overBudget }`
 */
export function composeContext(parts, opts = {}) {
    const { order, separator = '\n\n', tokenBudget = 0 } = opts;

    const normalized = applyOrder(
        (Array.isArray(parts) ? parts : []).map(normalizePart),
        order,
    );

    const chunks = [];
    const detailed = normalized.map((part) => {
        const body = part.content.trim();
        const included = part.active && body.length > 0;
        const rendered = !included ? '' : (part.raw ? body : wrapBlock(part.tag, body));
        if (rendered) chunks.push(rendered);
        return {
            ...part,
            included,
            tokens: included ? estimateTokens(rendered) : estimateTokens(body),
            chars: body.length,
        };
    });

    const text = chunks.join(separator).trim();
    const tokens = estimateTokens(text);

    return {
        text,
        parts: detailed,
        stats: {
            total: detailed.length,
            included: detailed.filter((p) => p.included).length,
            skipped: detailed.filter((p) => !p.included).length,
            tokens,
            chars: text.length,
            budget: tokenBudget || 0,
            overBudget: tokenBudget > 0 && tokens > tokenBudget,
        },
    };
}

// ============================================================
// 4) 快照存储
// ============================================================

/**
 * 建一个带命名空间的上下文拼装器。
 *
 * 快照存 localStorage 而不是 IndexedDB:发送前读快照必须是**同步**的,
 * 异步读盘来不及(和灵动岛偏好用 localStorage 是同一个理由,见 AGENTS2 §9.10)。
 *
 * @param {object} options
 * @param {string} options.namespace 建议用 appId,例如 'chat' / 'dream-weaver'
 * @param {number} [options.tokenBudget] 默认 token 预算
 */
export function createContextComposer({ namespace, tokenBudget = 0 } = {}) {
    const ns = String(namespace || 'app');
    const prefix = `xiaoting::context-preview-v1::${ns}::`;
    const memory = new Map();

    const storageKey = (scope) => `${prefix}${encodeURIComponent(String(scope || 'default'))}`;

    return {
        namespace: ns,

        /** 拼装(纯函数,默认带上本 composer 的 token 预算) */
        compose(parts, opts = {}) {
            return composeContext(parts, { tokenBudget, ...opts });
        },

        /**
         * 拼装并写快照。**这是推荐入口** —— 一次调用同时产出
         * 「要发给 AI 的文本」和「要给用户看的分段结果」,两者不可能不一致。
         */
        composeAndSave(scope, parts, opts = {}) {
            const result = this.compose(parts, opts);
            this.save(scope, result.text);
            return result;
        },

        /** 写快照 */
        save(scope, text) {
            const entry = { text: String(text || ''), savedAt: Date.now() };
            memory.set(String(scope || 'default'), entry);
            try {
                localStorage.setItem(storageKey(scope), JSON.stringify(entry));
            } catch (_) { /* 隐私模式 / 配额满,内存那份仍然可用 */ }
        },

        /** 读快照(内存优先,回落 localStorage) */
        load(scope) {
            const key = String(scope || 'default');
            const cached = memory.get(key);
            if (cached) return cached.text;
            try {
                const raw = localStorage.getItem(storageKey(scope));
                if (!raw) return '';
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.text === 'string') {
                    memory.set(key, parsed);
                    return parsed.text;
                }
            } catch (_) { /* 坏数据当没有 */ }
            return '';
        },

        /** 快照写入时间,判断新鲜度用 */
        savedAt(scope) {
            const key = String(scope || 'default');
            const cached = memory.get(key);
            if (cached) return cached.savedAt || 0;
            try {
                const parsed = JSON.parse(localStorage.getItem(storageKey(scope)) || 'null');
                return parsed?.savedAt || 0;
            } catch (_) {
                return 0;
            }
        },

        clear(scope) {
            memory.delete(String(scope || 'default'));
            try { localStorage.removeItem(storageKey(scope)); } catch (_) {}
        },

        // 段级操作直接透出,免得调用方再 import 一遍
        wrapBlock,
        stripBlock,
        replaceBlock,
        readBlock,
        hasBlock,
        estimateTokens,
    };
}

export default { createContextComposer, composeContext, estimateTokens };
