/**
 * 四叶草 · 小工具
 *
 * 只放「和业务无关、任何地方都可能用」的东西。有业务含义的一律进 services/。
 */

/** 唯一 id。前缀是给人看的，比较时一律 String()。 */
export function uid(prefix = 'x') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * id 比较一律走这个。
 *
 * 本项目历史上栽过一次：内置数据 id 是数字、新建的是 `pl_167...` 字符串，
 * 详情页写了 `Number(id)` → NaN → 新建的永远打不开（AGENTS2 §3.5）。
 * 只要 id 生成器出现过模板字符串，全 App 就不能再出现 `Number(id)` 比较。
 */
export function sameId(a, b) {
    return String(a ?? '') === String(b ?? '');
}

/** 结构化克隆的 Proxy 问题：reactive 对象直接写 IndexedDB 会抛 DataCloneError。 */
export function toPlain(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return value;
    }
}

export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

/** 金额一律走这个：负数归零、保留两位但去掉多余的 0 */
export function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.round(v * 100) / 100;
}

/** 展示用金额文本（不带货币名，货币名由调用方拼） */
export function fmtMoney(n) {
    const v = money(n);
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (sameDay) return `${hh}:${mm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 截断到 n 个字，超出加省略号 */
export function truncate(text, n = 40) {
    const s = String(text || '');
    return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * 从模型输出里抠出 JSON。
 *
 * 模型经常在 JSON 前后多说几句、加围栏、字符串里直接回车、尾巴多个逗号。
 * 这里尽量修好再 parse；真抠不出来才返回 null，不往 UI 里填乱码。
 */
export function extractJson(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    const direct = tryParseJson(text);
    if (direct) return direct;

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
        const hit = tryParseJson(fenced[1].trim()) || scanFirstJson(fenced[1]);
        if (hit) return hit;
    }

    return scanFirstJson(text);
}

function tryParseJson(src) {
    const text = String(src || '').trim();
    if (!text) return null;
    try {
        const v = JSON.parse(text);
        if (v && typeof v === 'object') return v;
    } catch (_) { /* 继续修 */ }

    try {
        const v = JSON.parse(softenJson(text));
        if (v && typeof v === 'object') return v;
    } catch (_) { /* 这次切片放弃 */ }
    return null;
}

function softenJson(text) {
    return escapeRawBreaksInStrings(String(text || ''))
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, '$1');
}

function escapeRawBreaksInStrings(text) {
    let out = '';
    let inStr = false;
    let esc = false;
    for (const ch of String(text || '')) {
        if (inStr) {
            if (esc) { out += ch; esc = false; continue; }
            if (ch === '\\') { out += ch; esc = true; continue; }
            if (ch === '"') { out += ch; inStr = false; continue; }
            if (ch === '\n') { out += '\\n'; continue; }
            if (ch === '\r') continue;
            out += ch;
            continue;
        }
        if (ch === '"') inStr = true;
        out += ch;
    }
    return out;
}

function scanFirstJson(text) {
    const src = String(text || '');
    for (let i = 0; i < src.length; i += 1) {
        const ch = src[i];
        if (ch !== '{' && ch !== '[') continue;
        const scanned = scanJsonValue(src, i);
        if (!scanned) continue;
        const hit = tryParseJson(scanned);
        if (hit) return hit;
    }
    return null;
}

function scanJsonValue(text, start) {
    const first = text[start];
    if (first !== '{' && first !== '[') return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (ch === '\\') { esc = true; continue; }
            if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{' || ch === '[') depth += 1;
        else if (ch === '}' || ch === ']') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/** 数组安全取值 */
export function asArray(v) {
    return Array.isArray(v) ? v : [];
}

/** 去掉首尾空白 + 折叠连续空行，AI 返回的长文本常见 */
export function tidyText(raw) {
    return String(raw || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** 中文按字、拉丁按词计数，不计空白 */
export function countWords(text) {
    const s = String(text || '');
    const cjk = (s.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
    const latin = (s.match(/[a-zA-Z]+(?:'[a-zA-Z]+)?/g) || []).length;
    const digits = (s.match(/\d+/g) || []).length;
    return cjk + latin + digits;
}
