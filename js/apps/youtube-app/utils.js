/**
 * 萤火 · 小工具
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
 * 图片 URL 白名单：http(s) 与 data:image。
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

/**
 * 确定性字符串哈希（FNV-1a 32 位）。
 * 头像槽位、封面色相、直播判定都用它 —— 同一个 externalId 永远得到同一个数。
 */
export function hashString(str) {
    let h = 0x811c9dc5;
    const s = String(str ?? '');
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * 可复现随机源：mulberry32。
 * 传同一个 seed 得到同一串数 —— 「同一个窗口内主播开不开播」必须可复现，
 * 否则用户退出再进，直播间就消失了。
 */
export function seededRandom(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return function next() {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 「键: 值」块，跳过空值 */
export function kvBlock(pairs) {
    return asArray(pairs)
        .filter((p) => p && String(p[1] ?? '').trim())
        .map(([k, v]) => `${k}: ${String(v).trim()}`)
        .join('\n');
}

/** 秒数 → 「12:34」时长文本；给不出合法数则回退一个稳定假时长 */
export function fmtDuration(seconds, fallbackSeed = '') {
    let n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) {
        n = 90 + (hashString(fallbackSeed) % 900);
    }
    n = Math.floor(n);
    const m = Math.floor(n / 60);
    const s = String(n % 60).padStart(2, '0');
    if (m >= 60) {
        const h = Math.floor(m / 60);
        return `${h}:${String(m % 60).padStart(2, '0')}:${s}`;
    }
    return `${m}:${s}`;
}
