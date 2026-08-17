/**
 * 梦境编织 · 通用工具
 *
 * 原版这些工具散在 30000 行里,同名函数还定义了两遍(`getRandomColor` / `rgbaToHex`
 * 各有两份且行为不同,JS 只保留后写的那个)。全部收在这里,一个名字一份实现。
 */

// ============================================================
// id
// ============================================================

let _seq = 0;

/**
 * 生成 id。
 *
 * ★ 一律返回**字符串**。原版书籍/章节 id 有的是数字有的是字符串,
 *   于是出现 `Number(id)` 比较 → 新建的对象永远匹配不上(AGENTS2 §3.5 同款坑)。
 *   本 App 全项目禁止 `Number(id)`,比较统一用 `isSameId`。
 */
export function makeId(prefix = 'dw') {
    _seq = (_seq + 1) % 100000;
    return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

/** id 比较:两边都转字符串。任何地方要比 id 都用这个。 */
export function isSameId(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

/** 在数组里按 id 找一项 */
export function findById(list, id) {
    if (!Array.isArray(list) || id == null) return null;
    return list.find((item) => isSameId(item?.id, id)) || null;
}

/** 在数组里按 id 找下标,找不到返回 -1 */
export function indexById(list, id) {
    if (!Array.isArray(list) || id == null) return -1;
    return list.findIndex((item) => isSameId(item?.id, id));
}

// ============================================================
// 文本
// ============================================================

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** HTML 转义。本 App 是 vue 模式,插值天然安全;只有 v-html 的地方需要它。 */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** 正则元字符转义 —— 用户填的关键词拼进 RegExp 之前必须过一遍 */
export function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 把 HTML 正文压成纯文本(统计字数 / 拼 prompt 用) */
export function htmlToText(html) {
    return String(html ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * 中文语境下的「字数」。
 *
 * 原版直接 `text.length`,把空白和标点也算进去了,跟用户心里的「写了多少字」对不上。
 * 这里按「CJK 一个算一个 + 连续拉丁串算一个词」统计,并且不计空白。
 */
export function countWords(text) {
    const str = htmlToText(text);
    if (!str) return 0;
    const cjk = (str.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    const latin = (str.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
    return cjk + latin;
}

/** 截断并加省略号 */
export function truncate(text, max = 60) {
    const str = String(text ?? '').replace(/\s+/g, ' ').trim();
    return str.length > max ? `${str.slice(0, max)}…` : str;
}

/** 数字千分位 */
export function formatNumber(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('zh-CN');
}

// ============================================================
// 时间
// ============================================================

const DAY = 86400000;

export function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatClock(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 相对时间:刚刚 / N 分钟前 / 今天 HH:mm / 昨天 / 日期 */
export function formatRelative(ts) {
    if (!ts) return '';
    const then = new Date(ts);
    if (Number.isNaN(then.getTime())) return '';
    const diff = Date.now() - then.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const t = startOfToday.getTime();
    if (then.getTime() >= t) return `今天 ${formatClock(ts)}`;
    if (then.getTime() >= t - DAY) return `昨天 ${formatClock(ts)}`;
    if (then.getFullYear() === new Date().getFullYear()) {
        return `${then.getMonth() + 1}月${then.getDate()}日`;
    }
    return formatDate(ts);
}

function pad(n) {
    return String(n).padStart(2, '0');
}

// ============================================================
// 故事内时间(世界时间)
// ============================================================

/**
 * 解析故事内时间字符串。
 *
 * 支持 `第三年春 第7天` 这种自由写法,也支持 `2024-03-15` / `2024年3月15日`。
 * 解析不出结构就退回「原样字符串」—— 时间线仍然能显示,只是不能排序/算差值。
 */
export function parseStoryTime(raw) {
    const str = String(raw ?? '').trim();
    if (!str) return { raw: '', sortable: false, value: 0 };

    const iso = str.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
    if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        return { raw: str, sortable: true, value: d.getTime(), date: d };
    }

    // 「第 N 天」这类相对写法:用天序做排序键
    const dayMatch = str.match(/第\s*(\d+)\s*天/);
    if (dayMatch) {
        return { raw: str, sortable: true, value: Number(dayMatch[1]) * DAY, relative: true };
    }

    return { raw: str, sortable: false, value: 0 };
}

/** 故事内时间比较,用于时间线排序。不可比的排在后面并保持原顺序。 */
export function compareStoryTime(a, b) {
    const pa = parseStoryTime(a);
    const pb = parseStoryTime(b);
    if (pa.sortable && pb.sortable) return pa.value - pb.value;
    if (pa.sortable) return -1;
    if (pb.sortable) return 1;
    return 0;
}

/** 两个故事内时间相差几天;不可比返回 null(而不是 0 —— 0 是「同一天」的合法答案) */
export function daysBetweenStoryTime(a, b) {
    const pa = parseStoryTime(a);
    const pb = parseStoryTime(b);
    if (!pa.sortable || !pb.sortable) return null;
    return Math.round((pb.value - pa.value) / DAY);
}

// ============================================================
// 其他
// ============================================================

/**
 * 深拷贝成纯对象。
 *
 * ★ 写 IndexedDB 前**必须**过一遍:结构化克隆拒绝 Proxy,
 *   而本 App 的 state 是 `Vue.reactive` 的,直接写会抛
 *   `DataCloneError: Proxy object could not be cloned` —— 纯运行时错误,
 *   build / lint 都发现不了,表现是「改了没保存」。
 */
export function toPlain(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (err) {
        console.warn('[dream-weaver] 序列化失败,已跳过', err);
        return null;
    }
}

/** 防抖 */
export function debounce(fn, wait = 300) {
    let timer = null;
    const wrapped = (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn(...args);
        }, wait);
    };
    wrapped.cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
    };
    wrapped.flush = (...args) => {
        if (timer) clearTimeout(timer);
        timer = null;
        fn(...args);
    };
    return wrapped;
}

/** 夹逼 */
export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/** 从固定色调表里挑一个(按字符串哈希,同名永远同色) */
export function pickTone(seed, tones) {
    const list = Array.isArray(tones) && tones.length ? tones : ['ember'];
    const str = String(seed ?? '');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return list[hash % list.length];
}

/** 数组内移动一项 */
export function moveItem(list, from, to) {
    if (!Array.isArray(list)) return list;
    if (from < 0 || from >= list.length) return list;
    const target = clamp(to, 0, list.length - 1);
    if (target === from) return list;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    return next;
}
