/**
 * Prompt 变量系统（框架级唯一真相源）
 * ====================================================================
 * 用户在任何一个可编辑的 prompt 里写 `{{aiName}}`，发给 AI 之前会被替换成
 * 真实值。这个文件负责三件事：
 *
 *   1. **变量清单**（VARIABLES）—— 有哪些变量、叫什么、什么意思
 *   2. **取值**（resolve）—— 每个变量怎么从当前上下文算出来
 *   3. **替换**（renderPromptVariables）—— 唯一一份 `{{}}` 替换实现
 *
 * ── 为什么要收敛到框架层 ──────────────────────────────
 * 2026-08-13 扫了一遍全项目，变量这件事当时是这个状态：
 *
 *   · `defaultReplyNote()`（prompt-manager-page.js）自己写了一段
 *     `raw.replace(/\{\{aiName\}\}/g, …)`，只认 2 个变量
 *   · 日历概要那条路径在注释里声称支持 `{{aiName}}/{{userName}}/
 *     `{{dateRange}}`/`{{messages}}`，但 `_generateDaySummary` 里
 *     prompt 是用模板字符串**硬拼**的 —— 那 4 个变量从来没被替换过，
 *     是一份只存在于注释里的「文档」
 *   · `js/components/prompt-studio/core/persona-text.js` 里还躺着一份
 *     更老的 `defaultReplyNote`（没有变量），它没被任何入口 import，
 *     属于做了一半的迁移（同 AGENTS2 §11.5 的情况）
 *
 * 三处各写各的，用户在 prompt 里写 `{{userName}}` 时，能不能生效完全
 * 取决于他写在哪一张卡上 —— 而 UI 上这些卡长得一模一样。
 *
 * 现在：所有替换都走 `renderPromptVariables()`，所有「有哪些变量可用」
 * 都从 `listPromptVariables()` 读。加一个变量只改这个文件。
 *
 * ── 命名约定（新增变量前先读）─────────────────────────
 *   · 小驼峰，不带前缀：`aiName` 而不是 `ai_name` / `AI_NAME` / `{{ai.name}}`
 *   · 主语在前：`aiMood` / `userMood`，不要 `moodOfAi`
 *   · 「一整段文本」用名词单数：`aiPersona`（人设全文），不是 `aiPersonaText`
 *   · 拿不到值时**返回空串**，不要返回 `undefined` 或 `{{aiName}}` 本身 ——
 *     后者会把占位符原样发给 AI，比空着更糟
 */

/**
 * 变量定义。
 * `resolve(ctx)` 拿到的 ctx 由调用方组装，字段见 buildPromptVariableContext()。
 */
const VARIABLES = [
    // ── 角色 ────────────────────────────────────────────
    {
        name: 'aiName', group: '角色', label: 'AI 名字',
        desc: '当前对话的 AI 人设名字（群聊里是正在发言的那个成员）',
        example: '阿澈',
        resolve: (c) => c.ai?.name || c.ai?.socialProfiles?.chat?.nickname || '',
    },
    {
        name: 'userName', group: '角色', label: '用户名字',
        desc: '当前默认用户人设的名字',
        example: '我',
        resolve: (c) => c.user?.name || c.user?.chineseName || '',
    },
    {
        name: 'aiPersona', group: '角色', label: 'AI 人设全文',
        desc: 'AI 人设全文（与 nook「当前人设上下文」同一份）',
        example: '# 角色卡: 阿澈\n…',
        resolve: (c) => c.aiPersonaText || '',
    },
    {
        name: 'userPersona', group: '角色', label: '用户人设全文',
        desc: '用户人设全文（与 nook「当前人设上下文」同一份）',
        example: '# 角色卡: 我\n…',
        resolve: (c) => c.userPersonaText || '',
    },
    {
        name: 'aiMood', group: '角色', label: 'AI 当前心情',
        desc: '人设页里那条「今日心情」',
        example: '有点困',
        resolve: (c) => c.ai?.dailyMood || '',
    },
    {
        name: 'userMood', group: '角色', label: '用户当前心情',
        desc: '同上，用户那边的',
        example: '还行',
        resolve: (c) => c.user?.dailyMood || '',
    },

    // ── 世界观 ──────────────────────────────────────────
    {
        name: 'worldName', group: '世界观', label: '世界观名称',
        desc: '当前绑定的世界观名字',
        example: '雾港',
        resolve: (c) => c.world?.name || '',
    },
    {
        name: 'worldSummary', group: '世界观', label: '世界观一句话',
        desc: '世界观的「一句话主旨」',
        example: '一座常年不散雾的港口城市',
        resolve: (c) => c.world?.summary || '',
    },
    {
        name: 'currency', group: '世界观', label: '货币名称',
        desc: '这个世界观里钱叫什么',
        example: '金币',
        resolve: (c) => c.world?.currencyName || '金币',
    },

    // ── 时间 ────────────────────────────────────────────
    {
        name: 'date', group: '时间', label: '今天日期',
        desc: '现实日期 YYYY-MM-DD',
        example: '2026-08-13',
        resolve: (c) => {
            const d = c.now || new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
    },
    {
        name: 'time', group: '时间', label: '现在几点',
        desc: '现实时间 HH:mm',
        example: '15:42',
        resolve: (c) => {
            const d = c.now || new Date();
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        },
    },
    {
        name: 'worldTime', group: '时间', label: '世界观纪时',
        desc: '按世界观的纪时系统换算后的时间（没开纪时就是空的）',
        example: '洪武三年七月初九 辰时',
        resolve: (c) => {
            const chrono = c.sdk?.chronology;
            if (!chrono?.getChronologyConfig) return '';
            try {
                const cfg = chrono.getChronologyConfig();
                if (!cfg?.enabled) return '';
                return chrono.format(chrono.realToWorld(c.now || new Date()), 'default');
            } catch (_) { return ''; }
        },
    },
    {
        name: 'dateRange', group: '时间', label: '日期范围',
        desc: '概要类 prompt 用：这段内容覆盖的日期范围',
        example: '2026-08-01 ~ 2026-08-13',
        resolve: (c) => c.dateRange || '',
    },

    // ── 会话 ────────────────────────────────────────────
    {
        name: 'messages', group: '会话', label: '对话记录',
        desc: '格式化后的对话文本（概要类 prompt 用）',
        example: '- 我: 在吗\n- 阿澈: 在的',
        resolve: (c) => c.messagesText || '',
    },
    {
        name: 'groupName', group: '会话', label: '群名',
        desc: '群聊里才有值，私聊为空',
        example: '夜航船',
        resolve: (c) => c.group?.name || '',
    },
    {
        name: 'groupOwner', group: '会话', label: '群主',
        desc: '群主在群里的显示名（有群昵称就是群昵称）',
        example: '船长',
        resolve: (c) => {
            if (!c.group || !c.sdk?.chatGroups) return '';
            const ownerId = c.sdk.chatGroups.getOwnerId(c.group, c.user?.id);
            return c.sdk.chatGroups.resolveMemberName(
                c.sdk, c.group, ownerId, c.user?.id || '', c.user?.name || '我',
            );
        },
    },
];

const BY_NAME = new Map(VARIABLES.map((v) => [v.name, v]));

/** 全部变量定义（只读用，别直接改数组） */
export function listPromptVariables() {
    return VARIABLES.map((v) => ({
        name: v.name, group: v.group, label: v.label, desc: v.desc, example: v.example,
    }));
}

/** 按分组返回，给 UI 菜单用 */
export function listPromptVariablesByGroup() {
    const groups = new Map();
    for (const v of VARIABLES) {
        if (!groups.has(v.group)) groups.set(v.group, []);
        groups.get(v.group).push({
            name: v.name, label: v.label, desc: v.desc, example: v.example,
        });
    }
    return Array.from(groups, ([group, items]) => ({ group, items }));
}

export function isKnownPromptVariable(name) {
    return BY_NAME.has(String(name || ''));
}

/**
 * 从当前 SDK 状态组装一份变量上下文。
 *
 * @param {object} opts
 * @param {string} [opts.aiPersonId]
 * @param {string} [opts.groupId]
 * @param {string} [opts.mode]
 * @param {string} [opts.dateRange]     概要类 prompt 用
 * @param {string} [opts.messagesText]  概要类 prompt 用
 * @param {string} [opts.aiPersonaText] 人设全文（调用方已经算过就传进来，别重复算）
 * @param {string} [opts.userPersonaText]
 */
export function buildPromptVariableContext(opts = {}) {
    const sdk = (typeof window !== 'undefined') ? window.settingsSdk : null;
    const user = opts.user
        || sdk?.defaultUserCard?.getDefault?.()
        || sdk?.users?.getActive?.()
        || null;
    const ai = opts.ai || (opts.aiPersonId ? sdk?.aiPersons?.get?.(opts.aiPersonId) : null) || null;
    let world = null;
    try {
        const worldId = ai?.boundWorldId || user?.boundWorldId || '';
        world = worldId ? sdk?.worlds?.get?.(worldId) : sdk?.worlds?.getActive?.();
    } catch (_) { world = null; }
    let group = null;
    if (opts.group) {
        group = opts.group;
    } else if (opts.groupId && user) {
        try { group = sdk?.chatGroups?.get?.(user, opts.groupId, opts.mode || 'calendar') || null; } catch (_) {}
    }
    return {
        sdk, user, ai, world, group,
        now: opts.now || new Date(),
        dateRange: opts.dateRange || '',
        messagesText: opts.messagesText || '',
        aiPersonaText: opts.aiPersonaText || '',
        userPersonaText: opts.userPersonaText || '',
    };
}

/**
 * 把文本里的 `{{变量名}}` 换成真实值。
 *
 * 三条规则，都是有意的：
 *   1. **不认识的变量原样保留**。用户可能只是写了两个花括号当装饰，
 *      悄悄删掉会让他以为自己写错了；保留下来至少一眼能看出没生效。
 *   2. 认识但取不到值的变量替换成空串（不是 `undefined`，也不是占位符原文）。
 *   3. 变量名两边允许空格：`{{ aiName }}` 和 `{{aiName}}` 等价 ——
 *      用户手写时很自然会加空格，为这个报错不值得。
 *
 * @param {string} text
 * @param {object} ctx  buildPromptVariableContext() 的产物
 */
export function renderPromptVariables(text, ctx = {}) {
    const src = String(text ?? '');
    if (!src.includes('{{')) return src;
    return src.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (whole, name) => {
        const def = BY_NAME.get(name);
        if (!def) return whole;         // 规则 1
        try {
            const v = def.resolve(ctx);
            return (v === undefined || v === null) ? '' : String(v);   // 规则 2
        } catch (err) {
            console.warn('[prompt-variables] resolve failed:', name, err);
            return '';
        }
    });
}

/** 便捷版：自己组 ctx 再替换 */
export function renderPromptWithVariables(text, opts = {}) {
    return renderPromptVariables(text, buildPromptVariableContext(opts));
}

/**
 * 扫一段文本里用到的变量，分成「认识的」和「不认识的」。
 * 编辑器可以用它给用户即时反馈：写错的变量名会亮出来，
 * 而不是等发给 AI 之后才发现 prompt 里躺着一串 `{{usrName}}`。
 */
export function inspectPromptVariables(text) {
    const known = new Set();
    const unknown = new Set();
    const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    let m;
    while ((m = re.exec(String(text || ''))) !== null) {
        if (BY_NAME.has(m[1])) known.add(m[1]);
        else unknown.add(m[1]);
    }
    return { known: [...known], unknown: [...unknown] };
}
