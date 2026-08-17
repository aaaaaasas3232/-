/**
 * 小奇怪 · 通用工具
 *
 * 全部纯函数,不碰 DOM、不碰 store。四个原型 HTML 里同样的东西各写了一遍
 * (三份 clamp、两份随机取样、两份 escapeHtml),这里收成一份。
 */

// ============================================================
// id
// ============================================================

let _seq = 0;

/**
 * 生成 id。
 *
 * ★ 一律返回字符串。本 App 全局禁止 `Number(id)` 比较 —— 一旦生成器里出现
 *   `xx-${Date.now()}`,`Number(id)` 就是 NaN,表现为「新建的东西永远打不开」。
 */
export function makeId(prefix = 'oq') {
    _seq = (_seq + 1) % 100000;
    return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

export function isSameId(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

/** 任何「可能是数组也可能是 undefined」的字段都先过一遍 */
export function asArray(value) {
    return Array.isArray(value) ? value : [];
}

// ============================================================
// 数值
// ============================================================

export function clamp(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
}

export function clampInt(value, min, max, fallback = min) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

// ============================================================
// 随机
// ============================================================

/**
 * 建一个可注入的随机源。
 *
 * ★ 为什么不直接用 `Math.random`:扫雷的布雷要能被测试脚本按固定种子复现,
 *   否则「200 局都恰好 10 颗雷」这种回归只能靠碰运气。
 *   传 seed 得到确定序列,不传就是真随机。
 *   算法是 mulberry32 —— 三行、无依赖、分布够用。
 */
export function createRng(seed) {
    if (seed == null) return Math.random;
    let state = (Number(seed) >>> 0) || 1;
    return function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 从数组里随机取一个;空数组返回 '' 而不是 undefined */
export function pickOne(list, rng = Math.random) {
    const arr = asArray(list);
    if (!arr.length) return '';
    return arr[Math.floor(rng() * arr.length)];
}

/** 洗牌(Fisher–Yates,原地不改入参) */
export function shuffle(list, rng = Math.random) {
    const arr = asArray(list).slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================================
// 文本
// ============================================================

/**
 * 转义要塞进 HTML 的用户文本。
 *
 * 本 App 绝大多数地方走 Vue 插值(自动转义),这个函数是给**少数** v-html
 * 的场合兜底的 —— 比如把游戏日志里的玩家名加粗。
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function truncate(text, max = 40) {
    const str = String(text ?? '').replace(/\s+/g, ' ').trim();
    return str.length > max ? `${str.slice(0, max)}…` : str;
}

/** 拼「键: 值」块,自动跳过空值 —— 空字段留在 prompt 里就是纯噪音 */
export function kvBlock(pairs) {
    return asArray(pairs)
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value]) => `${key}: ${String(value).trim()}`)
        .join('\n');
}

/**
 * 声明判重用的归一化键。
 *
 * 「我有一只猫」和「我有 一只猫。」应该算同一条 —— 否则玩家只要多打个空格
 * 就能无限复读同一句,判重形同虚设。去空白 + 去标点 + 转小写。
 */
export function normalizeClaim(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[。,，.!！?？~～、;；:：'"'"()（）\[\]【】]/g, '');
}

/**
 * 等宽字体下的显示宽度。
 *
 * 中文 / 全角标点占两格,其余占一格。字幕生成器排版**必须**用它而不是
 * `.length` —— 中心词填「她」时按 length=1 算,右边会多空一格,整块就歪了。
 */
export function displayWidth(text) {
    let width = 0;
    for (const ch of String(text ?? '')) {
        const code = ch.codePointAt(0);
        width += isWideChar(code) ? 2 : 1;
    }
    return width;
}

function isWideChar(code) {
    return (
        (code >= 0x1100 && code <= 0x115f) ||    // 谚文字母
        (code >= 0x2e80 && code <= 0x303e) ||    // CJK 部首 / 标点
        (code >= 0x3041 && code <= 0x33ff) ||    // 假名 / 兼容
        (code >= 0x3400 && code <= 0x4dbf) ||    // 扩展 A
        (code >= 0x4e00 && code <= 0x9fff) ||    // CJK 统一表意
        (code >= 0xa000 && code <= 0xa4cf) ||    // 彝文
        (code >= 0xac00 && code <= 0xd7a3) ||    // 谚文音节
        (code >= 0xf900 && code <= 0xfaff) ||    // 兼容表意
        (code >= 0xfe30 && code <= 0xfe6f) ||    // 竖排 / 小写变体
        (code >= 0xff00 && code <= 0xff60) ||    // 全角
        (code >= 0xffe0 && code <= 0xffe6)
    );
}

// ============================================================
// 时间
// ============================================================

function pad(n) {
    return String(n).padStart(2, '0');
}

export function formatClock(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 中文序数:第一步 / 第二步 …… 十以上直接用数字 */
export function ordinalCn(n) {
    const table = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const num = Math.floor(Number(n));
    if (!Number.isFinite(num) || num < 1) return '第 0 步';
    if (num <= 10) return `第${table[num]}步`;
    return `第 ${num} 步`;
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
        console.warn('[oddity] 序列化失败,已跳过', err);
        return null;
    }
}

export function debounce(fn, wait = 320) {
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

/**
 * 复制到剪贴板。
 *
 * `navigator.clipboard` 在 file:// 和非安全上下文里直接不存在(单文件产物就是
 * file:// 打开的),所以必须留 `execCommand` 那条老路 —— 它丑,但它在。
 */
export async function copyText(text) {
    const value = String(text ?? '');
    if (!value) return false;
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (_) { /* 落到下面的兜底 */ }

    if (typeof document === 'undefined') return false;
    try {
        const area = document.createElement('textarea');
        area.value = value;
        // 放在视口外而不是 display:none —— 隐藏元素选不中,execCommand 会静默失败
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok === true;
    } catch (_) {
        return false;
    }
}
