/**
 * 手书 · 通用工具
 *
 * 全部工具收在这里,一个名字一份实现。
 * ★ 时间单位全项目统一用**毫秒整数**。曾经在原型里混过「秒(浮点)」和
 *   「毫秒」两套,结果剪辑拖到 1.7s 时因为浮点误差和吸附打架,
 *   松手会自己弹回 1.6999999 —— 只在整数域里算就没有这个问题。
 */

// ============================================================
// id
// ============================================================

let _seq = 0;

/**
 * 生成 id。
 *
 * ★ 一律返回字符串。本 App 全局禁止 `Number(id)` 比较 —— id 里带 `-`,
 *   `Number(id)` 是 NaN,表现为「新建的东西永远打不开」。
 */
export function makeId(prefix = 'hs') {
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
// 数值
// ============================================================

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/** 毫秒一律取整 —— 见文件头注释 */
export function toMs(value, fallback = 0) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? n : fallback;
}

/** 吸附到栅格 */
export function snapMs(value, grid) {
    const g = Math.max(1, Math.round(Number(grid) || 1));
    return Math.round(Number(value) / g) * g;
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
 * HTML 转义。
 *
 * 舞台是唯一会用到 `v-html` 的地方(逐字动画需要给每个字包一层 span)。
 * 那条路径上的**每一个字符**都必须先过这个函数,
 * 再由我们自己拼 span —— 用户脚本里的 `<script>` 只会变成三个可见的字。
 */
export function escapeHtml(raw) {
    return String(raw ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 校验颜色值。
 *
 * 用户能在属性面板里填颜色,这个值会进 inline style。
 * 只放行 hex / rgb(a) / hsl(a) / 纯字母关键字,别的一律当没填 ——
 * `url(javascript:…)` 这类东西不该有机会进 style 属性。
 */
export function safeColor(raw) {
    const v = String(raw ?? '').trim();
    if (!v) return '';
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
    if (/^rgba?\(\s*[\d.\s,%/]+\)$/i.test(v)) return v;
    if (/^hsla?\(\s*[\d.\s,%/deg]+\)$/i.test(v)) return v;
    if (/^[a-z]{3,20}$/i.test(v)) return v;
    return '';
}

// ============================================================
// 时间显示
// ============================================================

function pad(n, width = 2) {
    return String(n).padStart(width, '0');
}

/** 00:03.5 —— 时间轴刻度和播放器都用这个 */
export function formatClock(ms) {
    const total = Math.max(0, Math.round(Number(ms) || 0));
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const d = Math.floor((total % 1000) / 100);
    return `${pad(m)}:${pad(s)}.${d}`;
}

/** 0:03 —— 作品卡右下角那个时长角标 */
export function formatDuration(ms) {
    const total = Math.max(0, Math.round(Number(ms) || 0));
    const m = Math.floor(total / 60000);
    const s = Math.round((total % 60000) / 1000);
    return `${m}:${pad(s)}`;
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

/** 播放量之类的数字:1.2万 */
export function formatCount(n) {
    const v = Math.max(0, Math.round(Number(n) || 0));
    if (v < 10000) return String(v);
    return `${(v / 10000).toFixed(1).replace(/\.0$/, '')}万`;
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
        console.warn('[handwrite] 序列化失败,已跳过', err);
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
 * 从一段可能带围栏 / 前后废话的模型输出里抠出 JSON。
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

/**
 * 剥掉模型输出外面的 ``` 围栏,留下纯脚本正文。
 *
 * 手书脚本本身就是纯文本,模型很爱给它套一层 ```text 围栏。
 * 不剥的话第一行会变成一条解析不了的指令,而报错信息毫无指向性。
 */
export function stripFence(raw) {
    const text = String(raw ?? '').trim();
    const fence = text.match(/```(?:[a-z]*)\s*\n([\s\S]*?)```/i);
    return (fence ? fence[1] : text).trim();
}

/**
 * 复制到剪贴板。
 *
 * ★ `navigator.clipboard` 在 file:// 下(单文件产物的主要用法)不可用,
 *   必须留 `execCommand` 兜底,否则用户点「复制提示词」永远没反应。
 */
export async function copyText(text) {
    const str = String(text ?? '');
    if (!str) return false;
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(str);
            return true;
        }
    } catch (_) { /* 降级到 execCommand */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = str;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (_) {
        return false;
    }
}
