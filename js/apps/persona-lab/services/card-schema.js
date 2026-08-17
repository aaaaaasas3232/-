/**
 * 人设机 · 人设正文 ⇄ nook 人设卡 的唯一映射
 *
 * ── 这个文件解决什么问题 ────────────────────────────────────────────
 *
 * 本 App 有两个互相冲突的需求:
 *
 *   1. **打磨环节必须是「一段纯文本」**。原型最有价值的地方就是
 *      「AI 指着第 3 行说这句该改成什么」—— 这套交互只有在纯文本上成立。
 *   2. **保存环节必须是「一张结构化人设卡」**。nook 的 `sdkUsers` /
 *      `sdkAiPersons` 存的是 `name` / `gender` / `personality` / `memory.text`
 *      这些具名字段,人设编辑器、chat 的 prompt-builder、朋友圈全都按字段读。
 *
 * 如果让两者各存一份,立刻就会分叉:用户在正文里把「性格」改了,
 * 保存进去的还是旧的 personality —— 而且**不会有任何报错**。
 * 这正是本项目反复踩的那类坑(AGENTS2 §3.4「同一份数据两个字段名并存」)。
 *
 * 所以这里定死一条:**正文是唯一编辑对象,人设卡是它的一个确定性投影。**
 *
 *   nook 人设卡  --cardToText-->  正文(打磨、给 AI 看、行号定位)
 *   正文         --textToCard-->  nook 人设卡(保存)
 *
 * 两个方向共用下面这一张 `FIELDS` 表。加一个字段 = 加一行。
 *
 * ── 正文格式 ──────────────────────────────────────────────────────
 *
 *   姓名：林栖
 *   性格：安静,但不是不爱说话
 *   角色介绍：出生在江南一个开旧书店的家庭。
 *   十六岁那年书店被拆,她把最后一批书搬回了家。      ← 没有「键：」= 接上一行
 *   爱好：抄书
 *   爱好：夜里骑车                                    ← 列表字段,一行一项
 *
 * 判定规则**没有任何启发式**:一行只有在「冒号前面那段命中已知字段别名」时
 * 才开新字段,否则一律算上一个字段的续行。所以
 * `口头禅：让我想想` 这种表里没有的键不会被丢掉,它会留在当前字段里。
 * (原型在这里是丢的 —— 它只认自己那套 key,别的行解析完就没了。)
 */

import { splitKeyValue, toLines, normalizeText } from '../utils.js';

// ============================================================
// 字段表
// ============================================================

/**
 * @typedef {object} CardField
 * @property {string}   key      内部键
 * @property {string}   label    正文里用的键名(反向生成时写这个)
 * @property {string[]} aliases  正向解析时认的别名(含 label 本身,大小写不敏感)
 * @property {string}   path     在 nook 人设卡上的路径
 * @property {'text'|'para'|'list'|'lines'|'mbti'} kind
 * @property {string}   [module] 属于哪个模块(保存时要把该模块 enabled 打开)
 * @property {string}   [group]  UI 分组
 */

/** 归一化别名:小写 + 去空白 + 去掉常见修饰 */
function normKey(raw) {
    return String(raw ?? '')
        .toLowerCase()
        .replace(/[\s_\-*#·・]/g, '')
        .replace(/^[【\[(（]+|[】\])）]+$/g, '');
}

export const FIELDS = Object.freeze([
    /* ── 本体(直接挂在人设卡顶层)──────────────────────── */
    {
        key: 'name', label: '姓名', path: 'name', kind: 'text', group: 'base',
        aliases: ['姓名', '名字', '角色名', '人物名', '称呼', 'name', 'char_name', 'charactername'],
    },
    {
        key: 'gender', label: '性别', path: 'gender', kind: 'text', group: 'base',
        aliases: ['性别', 'gender', 'sex'],
    },
    {
        key: 'age', label: '年龄', path: 'age', kind: 'text', group: 'base',
        aliases: ['年龄', '岁数', 'age'],
    },
    {
        key: 'appearance', label: '外貌', path: 'appearance', kind: 'para', group: 'base',
        aliases: ['外貌', '外观', '长相', '外形', '相貌', '形象', 'appearance', 'looks', 'description_appearance'],
    },
    {
        key: 'personality', label: '性格', path: 'personality', kind: 'para', group: 'base',
        aliases: ['性格', '个性', '脾气', '性格特点', 'personality', 'traits', 'persona'],
    },
    {
        key: 'occupation', label: '职业', path: 'currentOccupation', kind: 'text', group: 'base',
        aliases: ['职业', '身份', '工作', '当前职业', 'occupation', 'job', 'role'],
    },
    {
        key: 'bio', label: '一句话简介', path: 'bio', kind: 'text', group: 'base',
        aliases: ['一句话简介', '简介', '概述', '总述', '标签语', 'bio', 'summary', 'tagline'],
    },
    {
        key: 'experience', label: '角色介绍', path: 'experience', kind: 'para', group: 'base',
        aliases: ['角色介绍', '人物介绍', '背景', '背景故事', '经历', '生平', '故事', '设定',
            'background', 'experience', 'story', 'profile', 'scenario', 'description'],
    },

    /* ── 偏好模块 ─────────────────────────────────────── */
    {
        key: 'hobbies', label: '爱好', path: 'preferences.hobbies', kind: 'list',
        module: 'preferences', group: 'preferences',
        aliases: ['爱好', '兴趣', '兴趣爱好', 'hobby', 'hobbies', 'interests'],
    },
    {
        key: 'likes', label: '喜欢', path: 'preferences.likes', kind: 'list',
        module: 'preferences', group: 'preferences',
        aliases: ['喜欢', '喜好', '偏好', 'likes', 'favorites'],
    },
    {
        key: 'dislikes', label: '讨厌', path: 'preferences.dislikes', kind: 'list',
        module: 'preferences', group: 'preferences',
        aliases: ['讨厌', '厌恶', '雷点', '不喜欢', 'dislikes', 'hates'],
    },
    {
        key: 'allergies', label: '过敏', path: 'preferences.allergies', kind: 'list',
        module: 'preferences', group: 'preferences',
        aliases: ['过敏', '过敏原', 'allergy', 'allergies'],
    },

    /* ── 深度模块 ─────────────────────────────────────── */
    {
        key: 'memory', label: '记忆', path: 'memory.text', kind: 'lines',
        module: 'memory', group: 'depth',
        aliases: ['记忆', '重要记忆', '人生记忆', 'memory', 'memories'],
    },
    {
        key: 'worldview', label: '三观', path: 'worldview.text', kind: 'lines',
        module: 'worldview', group: 'depth',
        aliases: ['三观', '价值观', '世界观倾向', 'worldview', 'values'],
    },
    {
        key: 'mbti', label: 'MBTI', path: 'mbti.type', kind: 'mbti',
        module: 'mbti', group: 'depth',
        aliases: ['mbti', 'mbti类型', '人格类型', 'personalitytype'],
    },
    {
        key: 'psychological', label: '心理内核', path: 'psychological.text', kind: 'lines',
        module: 'psychological', group: 'depth',
        aliases: ['心理内核', '内核', '心理', '心理特征', 'psychology', 'psychological'],
    },
    {
        key: 'moral', label: '道德底线', path: 'moral.text', kind: 'lines',
        module: 'moral', group: 'depth',
        aliases: ['道德底线', '底线', '原则', '道德观', 'moral', 'boundaries'],
    },
    {
        key: 'skills', label: '技能与兴趣', path: 'skills.text', kind: 'lines',
        module: 'skills', group: 'depth',
        aliases: ['技能与兴趣', '技能', '特长', '能力', '专长', 'skill', 'skills', 'abilities'],
    },
]);

/** 别名 → 字段。构造一次,解析时 O(1) 查表。 */
const ALIAS_MAP = (() => {
    const map = new Map();
    for (const field of FIELDS) {
        map.set(normKey(field.label), field);
        for (const alias of field.aliases) map.set(normKey(alias), field);
    }
    return map;
})();

export function fieldByKey(key) {
    return FIELDS.find((f) => f.key === key) || null;
}

/** 这一行的「键」是不是我们认识的字段?不认识返回 null(调用方按续行处理)。 */
export function matchField(rawKey) {
    if (!rawKey) return null;
    return ALIAS_MAP.get(normKey(rawKey)) || null;
}

/** 给 AI 用的字段清单说明,`prompt-builder` 和「导入转换」共用一份 */
export function describeFieldsForPrompt() {
    return FIELDS.map((f) => {
        const shape = f.kind === 'list' || f.kind === 'lines'
            ? '(可以有多行,一行一条)'
            : (f.kind === 'mbti' ? '(填四个字母,如 INFP)' : '');
        return `${f.label}${shape}`;
    }).join('\n');
}

// ============================================================
// 路径读写
// ============================================================

function readPath(obj, path) {
    return String(path).split('.').reduce((cur, seg) => (cur == null ? cur : cur[seg]), obj);
}

function writePath(obj, path, value) {
    const segs = String(path).split('.');
    let cur = obj;
    for (let i = 0; i < segs.length - 1; i += 1) {
        const seg = segs[i];
        if (cur[seg] == null || typeof cur[seg] !== 'object') cur[seg] = {};
        cur = cur[seg];
    }
    cur[segs[segs.length - 1]] = value;
}

// ============================================================
// 人设卡 → 正文
// ============================================================

/**
 * 把 nook 人设卡摊平成正文。
 *
 * 空字段**不输出** —— 正文里留一串 `年龄：` 会让 AI 以为「这个人没有年龄」,
 * 而且行号会被这些空壳撑长,打磨时定位更容易错。
 * (新建卡时的骨架由 `constants.STARTER_TEXT` 单独提供,那是给人填的,不是给 AI 看的。)
 */
export function cardToText(card) {
    if (!card) return '';
    const out = [];

    for (const field of FIELDS) {
        const raw = readPath(card, field.path);
        if (raw == null || raw === '') continue;

        if (field.kind === 'list') {
            const items = Array.isArray(raw)
                ? raw
                : String(raw).split(/[\n、,，;；]/);
            for (const item of items) {
                const text = String(item).trim();
                if (text) out.push(`${field.label}：${text}`);
            }
            continue;
        }

        if (field.kind === 'lines') {
            const items = Array.isArray(raw) ? raw : String(raw).split('\n');
            const cleaned = items.map((s) => String(s).trim()).filter(Boolean);
            for (const item of cleaned) out.push(`${field.label}：${item}`);
            continue;
        }

        // text / para / mbti —— 多行正文的第 2 行起写成续行
        const [first, ...rest] = String(raw).split('\n');
        out.push(`${field.label}：${String(first).trim()}`);
        for (const line of rest) {
            const text = String(line).trim();
            if (text) out.push(text);
        }
    }

    // MBTI 简介单独跟一行(它在卡上是 mbti.description,不在 FIELDS 里,
    // 因为它没有独立语义,永远跟着 type 走)
    const mbtiDesc = String(readPath(card, 'mbti.description') || '').trim();
    if (mbtiDesc) out.push(`MBTI 说明：${mbtiDesc}`);

    return out.join('\n');
}

// ============================================================
// 正文 → 人设卡
// ============================================================

/**
 * 解析正文。
 *
 * @returns {{ values: Record<string, any>, hits: Record<string, number[]>, unmatchedLines: number }}
 *   - `values`  字段 key → 值(text/para 是字符串,list/lines 是数组)
 *   - `hits`    字段 key → 命中的行号(1-based),档案页用它做「点标题跳到那一行」
 *   - `unmatchedLines` 开头就没命中任何字段的行数,UI 用它提示「这段没归到字段里」
 */
export function parseText(raw) {
    const lines = toLines(raw);
    const values = {};
    const hits = {};
    let current = null;
    let unmatchedLines = 0;

    const push = (field, text, lineNo) => {
        if (!text) return;
        if (!hits[field.key]) hits[field.key] = [];
        hits[field.key].push(lineNo);
        if (field.kind === 'list' || field.kind === 'lines') {
            if (!Array.isArray(values[field.key])) values[field.key] = [];
            values[field.key].push(text);
        } else if (values[field.key]) {
            values[field.key] = `${values[field.key]}\n${text}`;
        } else {
            values[field.key] = text;
        }
    };

    lines.forEach((line, i) => {
        const lineNo = i + 1;
        const trimmed = line.trim();
        if (!trimmed) return;

        const kv = splitKeyValue(trimmed);
        const field = kv ? matchField(kv.key) : null;

        if (field) {
            current = field;
            push(field, kv.value, lineNo);
            return;
        }

        // 续行:归到上一个开着的字段;开头就没有字段时归到「角色介绍」
        if (!current) {
            current = fieldByKey('experience');
            unmatchedLines += 1;
        }
        push(current, trimmed, lineNo);
    });

    // list 字段去重(同一项写两遍没意义,而且会在 prompt 里重复占位)
    for (const field of FIELDS) {
        if (field.kind !== 'list') continue;
        const list = values[field.key];
        if (Array.isArray(list)) values[field.key] = [...new Set(list)];
    }

    return { values, hits, unmatchedLines };
}

const MBTI_RE = /\b(I|E)(N|S)(F|T)(J|P)\b/i;

/**
 * 把正文投影成一个可以直接喂给 `sdk.users.update()` / `sdk.aiPersons.update()` 的 patch。
 *
 * ★ 只写「正文里出现过」的字段。没出现的**不清空** ——
 *   用户在这里只编辑了正文,不代表他想把卡上别的东西(资产、圈子、社媒形象、
 *   绑定的表情包)都删掉。`mergePatch` 是深合并,不传就保持原值。
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {boolean} [opts.enableModules=true] 有内容的模块是否顺手打开开关
 */
export function textToCardPatch(text, opts = {}) {
    const { enableModules = true } = opts;
    const { values } = parseText(text);
    const patch = {};

    for (const field of FIELDS) {
        const value = values[field.key];
        if (value == null) continue;

        if (field.kind === 'list') {
            if (!value.length) continue;
            writePath(patch, field.path, value);
        } else if (field.kind === 'lines') {
            if (!value.length) continue;
            writePath(patch, field.path, value.join('\n'));
        } else if (field.kind === 'mbti') {
            const hit = String(value).match(MBTI_RE);
            if (!hit) continue;
            writePath(patch, field.path, hit[0].toUpperCase());
        } else {
            const str = String(value).trim();
            if (!str) continue;
            writePath(patch, field.path, str);
        }

        /**
         * 模块开关。
         *
         * ★ 不打开的话:数据确实写进去了,人设编辑器里那一组却是折叠的、
         *   prompt-builder 也不会注入 —— 用户感知是「保存了但没生效」,
         *   而且没有任何报错。这一行就是为了避免那种静默失败。
         */
        if (enableModules && field.module) {
            if (!patch[field.module] || typeof patch[field.module] !== 'object') {
                patch[field.module] = {};
            }
            patch[field.module].enabled = true;
        }
    }

    // MBTI 说明(正文里的「MBTI 说明：」被 matchField 认成 mbti 的续行,
    // 所以要从 mbti 的原始值里再抠一次)
    const mbtiRaw = values.mbti;
    if (typeof mbtiRaw === 'string') {
        const desc = mbtiRaw
            .split('\n')
            .slice(1)
            .map((s) => s.replace(/^MBTI\s*说明[：:]\s*/i, '').trim())
            .filter(Boolean)
            .join('\n');
        if (desc) writePath(patch, 'mbti.description', desc);
    }

    return patch;
}

/**
 * 档案页要展示的「保存后会变成什么」。
 *
 * 这是「预览 == 实际写入」的物理保证:它和 `textToCardPatch` 读的是同一次
 * `parseText`,不可能不一致。
 */
export function describePatch(text) {
    const { values, hits, unmatchedLines } = parseText(text);
    const rows = FIELDS
        .map((field) => {
            const value = values[field.key];
            if (value == null || (Array.isArray(value) && !value.length)) return null;
            return {
                key: field.key,
                label: field.label,
                group: field.group,
                module: field.module || '',
                kind: field.kind,
                lines: hits[field.key] || [],
                display: Array.isArray(value) ? value : String(value).split('\n'),
            };
        })
        .filter(Boolean);

    return { rows, unmatchedLines, filled: rows.length, total: FIELDS.length };
}

/** 从正文里抠出显示用的名字(卡片标题、头像首字都用它) */
export function readName(text) {
    const { values } = parseText(text);
    const name = values.name;
    return String(Array.isArray(name) ? name[0] : (name || '')).split('\n')[0].trim();
}

/** 正文规范化:交给 store 落盘前统一走一遍,保证行号语义稳定 */
export function normalizeCardText(text) {
    return normalizeText(text);
}
