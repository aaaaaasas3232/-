/**
 * 情景聊天 · 通用工具
 *
 * 一个名字一份实现。
 */

let _seq = 0;

/**
 * 生成 id。
 *
 * ★ 一律返回字符串,全 App 禁止 `Number(id)` 比较 ——
 *   id 里带 `-` 的话 `Number(id)` 是 NaN,表现为「新建的东西永远打不开」。
 */
export function makeId(prefix = 'sp') {
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

export function asArray(value) {
    return Array.isArray(value) ? value : [];
}

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

export function truncate(text, max = 40) {
    const str = String(text ?? '').replace(/\s+/g, ' ').trim();
    return str.length > max ? `${str.slice(0, max)}…` : str;
}

/**
 * XSS 防线。
 *
 * ★ 消息正文最终会经过 `v-html`(正则卡片需要结构),所以**每一段用户 / AI /
 *   数据库来的文本都必须先过这里**。正则引擎的所有输出都走它,
 *   没有例外 —— 留一个例外就等于没有这条防线。
 */
export function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 拼「键: 值」块,自动跳过空值 —— 空字段留在 prompt 里就是纯噪音 */
export function kvBlock(pairs) {
    return pairs
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value]) => `${key}: ${String(value).trim()}`)
        .join('\n');
}

/**
 * 校验图片 URL。
 *
 * 聊天背景和头像都是用户粘进来的,直接塞进 `background-image` 或 `<img src>`
 * 会给 `javascript:` 这类协议留口子。只放行 http(s) 和 data:image。
 */
export function safeImageUrl(raw) {
    const url = String(raw ?? '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url)) return url;
    return '';
}

/** 拿去拼 `background-image: url("...")` —— 引号和反斜杠必须转义 */
export function cssUrl(raw) {
    const url = safeImageUrl(raw);
    if (!url) return '';
    return `url("${url.replace(/["\\]/g, encodeURIComponent)}")`;
}

// ============================================================
// 时间
// ============================================================

function pad(n) {
    return String(n).padStart(2, '0');
}

export function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRelative(ts) {
    if (!ts) return '';
    const then = new Date(ts);
    if (Number.isNaN(then.getTime())) return '';
    const diff = Date.now() - then.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return formatDateTime(ts).slice(0, 10);
}

// ============================================================
// 其他
// ============================================================

/**
 * 深拷贝成纯对象。
 *
 * ★ 写 IndexedDB 前**必须**过一遍:结构化克隆拒绝 Proxy,而 state 是
 *   `Vue.reactive` 出来的 Proxy,直接写会抛 `DataCloneError` ——
 *   纯运行时错误,build / lint 都发现不了。
 */
export function toPlain(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (err) {
        console.warn('[scene-play] 序列化失败,已跳过', err);
        return null;
    }
}

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

/**
 * 复制到剪贴板。
 *
 * `navigator.clipboard` 在非安全上下文里不存在,必须留 `execCommand` 兜底。
 */
export async function copyText(text) {
    const value = String(text ?? '');
    if (!value) return false;
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch (_) { /* 继续走兜底 */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (_) {
        return false;
    }
}
