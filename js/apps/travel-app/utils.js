/**
 * 候鸟 · 小工具
 *
 * 全部是纯函数，不碰 window / DOM —— node 测试直接 import。
 */

let _seq = 0;

/** 短 id。同一毫秒可能生成多个，所以带自增段。 */
export function uid(prefix = 'id') {
    _seq = (_seq + 1) % 1000;
    return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}`;
}

export function asArray(value) {
    return Array.isArray(value) ? value : [];
}

export function sameId(a, b) {
    return String(a) === String(b);
}

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/** 金额：非负、两位小数 */
export function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 100) / 100);
}

export function fmtMoney(value) {
    const n = money(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** 收拾 AI 返回的文本：去围栏残渣、压掉三连以上空行 */
export function tidyText(value) {
    return String(value ?? '')
        .replace(/^```[\w-]*\n?/, '')
        .replace(/\n?```$/, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function truncate(value, max = 120) {
    const s = String(value ?? '');
    return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * 从 AI 回复里抠 JSON。
 * 模型经常在 JSON 前后加解释或围栏，所以先找第一个 { 和最后一个 }。
 */
export function extractJson(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return null;
    const tryParse = (s) => {
        try { return JSON.parse(s); } catch (_) { return null; }
    };
    const direct = tryParse(text);
    if (direct && typeof direct === 'object') return direct;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    return tryParse(text.slice(start, end + 1));
}

/**
 * reactive 对象 → 纯对象。
 * Vue 的 Proxy 直接写 IndexedDB 会抛 DataCloneError，落盘前必须剥一层。
 */
export function toPlain(value) {
    if (value == null || typeof value !== 'object') return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return value;
    }
}

/**
 * 背景图 URL 白名单：http(s) 与 data:image。
 * 其他协议（javascript: 之类）一律拒绝，返回空串。
 */
export function safeImageUrl(raw) {
    const url = String(raw ?? '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url)) return url;
    return '';
}

/** 时间戳 → 「8月15日 13:00」 */
export function fmtTime(ts) {
    const d = new Date(Number(ts) || Date.now());
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 时间戳 → 「2026.8.15」 */
export function fmtDate(ts) {
    const d = new Date(Number(ts) || Date.now());
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 「键: 值」块，跳过空值 */
export function kvBlock(pairs) {
    return asArray(pairs)
        .filter((p) => p && String(p[1] ?? '').trim())
        .map(([k, v]) => `${k}: ${String(v).trim()}`)
        .join('\n');
}
