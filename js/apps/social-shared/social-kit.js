/**
 * 社交 App 共享纯函数（social-shared）
 *
 * 萤火（youtube）和氧气（blog）这类「按世界观生成内容的社交 App」共用的
 * 纯逻辑：数字缩写 / 99+ 截断 / 分页余量 / 确定性哈希与随机 / JSON 抠取 /
 * reactive 剥壳 / 短 id。全部不碰 window / DOM，node 测试直接 import。
 *
 * ★ 目前的消费方是氧气；萤火仍用自己 utils/stats 里的同名实现
 *   （不动它是为了不破坏已通过的 probe），后续迁移时让它改 import 这里即可。
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

export function truncate(value, max = 120) {
    const s = String(value ?? '');
    return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** 收拾 AI 返回的文本：去围栏残渣、压掉三连以上空行 */
export function tidyText(value) {
    return String(value ?? '')
        .replace(/^```[\w-]*\n?/, '')
        .replace(/\n?```$/, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
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
 * 确定性字符串哈希（FNV-1a 32 位）。
 * 头像槽位、互动数、热度波动都用它 —— 同一个 id 永远得到同一个数。
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

/** 可复现随机源：mulberry32。传同一个 seed 得到同一串数。 */
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

/** 数字截断展示：超过 cap 显示 `${cap}+`（内部保存真实数值） */
export function fmtCap(value, cap = 99) {
    const n = Math.max(0, Number(value) || 0);
    return n > cap ? `${cap}+` : String(n);
}

/** 大数缩写：999 / 1.2万 / 2.3亿 */
export function fmtCount(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')}亿`;
    if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`;
    return String(n);
}

/** 分页余量：总数 - 已生成，不出负数 */
export function remainingCount(total, generated) {
    return Math.max(0, (Number(total) || 0) - (Number(generated) || 0));
}

/** 时间戳 → 「8月15日 13:00」 */
export function fmtTime(ts) {
    const d = new Date(Number(ts) || Date.now());
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 时间戳 → 相对时间标签（刚刚 / N 分钟前 / N 小时前 / N 天前 / 具体日期） */
export function fmtRelative(ts, now = Date.now()) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const diff = Math.max(0, now - t);
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min} 分钟前`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 本地日期键 'YYYY-MM-DD'（按用户时区，不用 UTC —— 「一天」以用户的一天为准） */
export function dayKey(ts = Date.now()) {
    const d = new Date(Number(ts) || Date.now());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** 两个 'YYYY-MM-DD' 之间隔了几个自然日（同日 = 0，昨天到今天 = 1） */
export function daysBetween(fromDay, toDay) {
    const parse = (s) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
        if (!m) return null;
        return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    };
    const a = parse(fromDay);
    const b = parse(toDay);
    if (a == null || b == null) return 0;
    return Math.max(0, Math.round((b - a) / 86400000));
}
