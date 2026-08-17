/**
 * 湛蓝回忆 · 通用工具
 *
 * 原型里同名函数出现过两次(`updateProgress` 剧情进度条和音乐播放器进度条同名,
 * 都在同一个 IIFE 作用域里,函数声明提升后**后者吃掉前者** —— 结果是生成剧情时
 * 进度条永远不动,反倒去刷音乐播放器的进度)。全部工具收在这里,一个名字一份实现。
 */

// ============================================================
// id
// ============================================================

let _seq = 0;

/**
 * 生成 id。
 *
 * ★ 一律返回字符串。本 App 全局禁止 `Number(id)` 比较 —— 一旦 id 生成器出现过
 *   `xx-${Date.now()}` 这种写法,`Number(id)` 就是 NaN,表现为「新建的东西永远打不开」。
 */
export function makeId(prefix = 'gg') {
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

/** 任何「可能是数组也可能是 undefined」的字段都先过一遍 */
export function asArray(value) {
    return Array.isArray(value) ? value : [];
}

// ============================================================
// 文本
// ============================================================

export function truncate(text, max = 40) {
    const str = String(text ?? '').replace(/\s+/g, ' ').trim();
    return str.length > max ? `${str.slice(0, max)}…` : str;
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
 * 立绘 / 场景图 / CG 都是用户粘进来的,直接塞进 `background-image` 或 `<img src>`
 * 会给 `javascript:` 这类协议留口子。只放行 http(s) 和 data:image。
 */
export function safeImageUrl(raw) {
    const url = String(raw ?? '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(url)) return url;
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
 *   纯运行时错误,build / lint 都发现不了,表现是「保存成功但刷新就没了」。
 */
export function toPlain(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (err) {
        console.warn('[galgame] 序列化失败,已跳过', err);
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

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/**
 * 从一段可能带围栏 / 前后废话的模型输出里抠出 JSON。
 *
 * 顺序:剥 ```json 围栏 → 从第一个 `{` 截到最后一个 `}` → parse。
 * 失败返回 null,由调用方决定怎么兜底 —— **绝不把解析失败的内容当数据用**。
 */
export function parseLooseJson(raw) {
    let text = String(raw ?? '').trim();
    if (!text) return null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
        return null;
    }
}
