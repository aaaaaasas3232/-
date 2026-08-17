/**
 * 气泡机 · 通用工具
 *
 * 一个名字一份实现。参考软件里同一件事(生成 id、深拷贝、防抖)
 * 在四个 prototype 上各写了一遍,改一处漏三处。
 */

let _seq = 0;

/**
 * 生成 id。
 *
 * ★ 一律返回字符串,全 App 禁止 `Number(id)` 比较 ——
 *   id 里带 `-` 的话 `Number(id)` 是 NaN,表现为「新建的东西永远打不开」。
 */
export function makeId(prefix = 'bb') {
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
 * 深拷贝成纯对象。
 *
 * ★ 写 IndexedDB 前**必须**过一遍:结构化克隆拒绝 Proxy,而 state 是
 *   `Vue.reactive` 出来的 Proxy,直接写会抛 `DataCloneError` ——
 *   纯运行时错误,build / lint 都发现不了,表现是「保存成功但刷新就没了」。
 */
export function toPlain(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (err) {
        console.warn('[bubble-maker] 序列化失败,已跳过', err);
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

export function formatDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 复制到剪贴板。
 *
 * `navigator.clipboard` 在非安全上下文(http 打开的本地页)里不存在,
 * 所以必须留 `execCommand` 兜底 —— 少了它,用户在本地打开时
 * 「点复制没反应」而且控制台只有一句 undefined。
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
