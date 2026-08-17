/**
 * 人设机 · 通用工具
 *
 * 原型(`ai角色智能编辑器.html`)把这些散在 8000 行里,而且
 * `updateLineNumbers` 一个名字定义了**三遍**(3519 / 3911 / 3981),
 * JS 只保留最后一个,前两个配套的分行编辑器整块成了死代码。
 * 这里一个名字一份实现。
 */

let _seq = 0;

/** 生成 id。一律字符串 —— 本 App 全局禁止 `Number(id)` 比较。 */
export function makeId(prefix = 'pl') {
    _seq = (_seq + 1) % 100000;
    return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

export function isSameId(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

export function findById(list, id) {
    if (!Array.isArray(list) || id == null) return null;
    return list.find((item) => isSameId(item?.id, id)) || null;
}

export function indexById(list, id) {
    if (!Array.isArray(list) || id == null) return -1;
    return list.findIndex((item) => isSameId(item?.id, id));
}

// ============================================================
// 文本
// ============================================================

/** 统一换行符并去掉行尾空白 —— 行号定位的前提是两边对同一份文本切行 */
export function normalizeText(raw) {
    return String(raw ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\s+$/, ''))
        .join('\n');
}

/**
 * 切行。
 *
 * ★ 这是行号语义的**唯一定义**:不 trim、不过滤空行。
 *   原型在「给 AI 看」时用 `addLineNumbersToText`(过滤了空行),
 *   在「应用修改」时用 `text.split('\n')`(没过滤),两边行号对不上 ——
 *   人设里只要有一个空行,AI 说的「第 7 行」落到实际第 8 行,改错地方。
 */
export function toLines(raw) {
    return normalizeText(raw).split('\n');
}

/** 给每行加上行号,给 AI 看的那份。和 `toLines` 用同一套切分。 */
export function withLineNumbers(raw) {
    return toLines(raw)
        .map((line, i) => `${String(i + 1).padStart(3, ' ')} | ${line}`)
        .join('\n');
}

export function truncate(text, max = 60) {
    const str = String(text ?? '').replace(/\s+/g, ' ').trim();
    return str.length > max ? `${str.slice(0, max)}…` : str;
}

/** 中文语境下的字数:CJK 一字一个,连续拉丁串算一个词,不计空白 */
export function countWords(text) {
    const str = String(text ?? '');
    if (!str) return 0;
    const cjk = (str.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    const latin = (str.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
    return cjk + latin;
}

/** 全角冒号统一成半角,方便按 key 解析 */
export function splitKeyValue(line) {
    const str = String(line ?? '');
    const idx = str.search(/[：:]/);
    if (idx < 0) return null;
    return {
        key: str.slice(0, idx).trim(),
        value: str.slice(idx + 1).trim(),
    };
}

/** 去掉 markdown 代码围栏和「好的,以下是…」这类开场白 */
export function cleanModelOutput(raw) {
    let text = String(raw ?? '').trim();
    if (!text) return '';
    const fence = text.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
    if (fence) text = fence[1].trim();
    text = text.replace(/^(?:好的|好[,，]|明白|收到)[^\n]{0,30}[：:]\s*\n+/, '');
    text = text.replace(/^(?:以下是|这是)[^\n]{0,30}[：:]\s*\n+/, '');
    return text.trim();
}

// ============================================================
// 时间
// ============================================================

const DAY = 86400000;

function pad(n) {
    return String(n).padStart(2, '0');
}

export function formatClock(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
    return `${then.getFullYear()}-${pad(then.getMonth() + 1)}-${pad(then.getDate())}`;
}

// ============================================================
// 其他
// ============================================================

/**
 * 深拷贝成纯对象。
 *
 * ★ 写 IndexedDB 前**必须**过一遍:结构化克隆拒绝 Proxy,而 state 是
 *   `Vue.reactive` 的,直接写会抛 `DataCloneError` —— 纯运行时错误,
 *   build / lint 都发现不了,表现是「改了没保存」。
 */
export function toPlain(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (err) {
        console.warn('[persona-lab] 序列化失败,已跳过', err);
        return null;
    }
}

export function debounce(fn, wait = 400) {
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

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/**
 * 从固定色调表里挑一个(按字符串哈希,同一个名字永远同色)。
 *
 * ★ 返回的是 **token 名**不是 hex —— CSS 里 `[data-tone="rose"]` 决定它长什么样,
 *   这样换主题时头像底色也跟着变。
 */
export function pickTone(seed, tones) {
    const list = Array.isArray(tones) && tones.length ? tones : ['rose'];
    const str = String(seed ?? '');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return list[hash % list.length];
}

/** 取名字的首字做头像文字 */
export function initialOf(name) {
    const str = String(name ?? '').trim();
    return str ? Array.from(str)[0] : '·';
}
