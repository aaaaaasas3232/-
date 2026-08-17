/**
 * 日记 · 通用工具
 *
 * 日期在这个 App 里是主键的一部分（`<spaceId>::<YYYY-MM-DD>`），所以日期函数
 * 的口径必须全项目统一。这里的约定：
 *
 *   - **日期一律用本地时区的 `YYYY-MM-DD` 字符串**，不用时间戳、不用 UTC。
 *     `toISOString()` 会转成 UTC，东八区凌晨 0~8 点写的日记会被算成前一天 ——
 *     而这个 App 的写作时段恰恰允许配到晚上，踩上去就是「昨天的日记覆盖今天的」。
 *     所以统一走 `toLocaleDateString('en-CA')`（它的输出格式正好是 YYYY-MM-DD）。
 *   - 日期加减一律先归到「当天 12:00」再算，避开夏令时导致的 ±1 小时漂移。
 */

// ============================================================
// id
// ============================================================

let _seq = 0;

/**
 * 生成 id。一律返回**字符串** —— 本 App 全域禁止 `Number(id)` 比较
 * （AGENTS2 §3.5：只要 id 生成器出现过 `xx_${Date.now()}` 这种写法，
 * 数字化比较就一定会在某个分支上返回 NaN）。
 */
export function makeId(prefix = 'dy') {
    _seq = (_seq + 1) % 100000;
    return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

/** id 比较：两边都转字符串。任何地方要比 id 都用这个。 */
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
// 日期
// ============================================================

const DAY_MS = 86400000;

/**
 * Date → 'YYYY-MM-DD'（本地时区）。
 *
 * `en-CA` 的短日期格式就是 ISO 的 YYYY-MM-DD，且走本地时区，
 * 是标准库里唯一不用手工拼接就能拿到本地 ISO 日期的写法。
 */
export function dateKey(input = new Date()) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA');
}

export function todayKey() {
    return dateKey(new Date());
}

/** 'YYYY-MM-DD' → Date（当天 12:00，避开夏令时边界） */
export function keyToDate(key) {
    const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function isValidDateKey(key) {
    return keyToDate(key) !== null;
}

/** 日期加减天数，返回新的 'YYYY-MM-DD' */
export function addDays(key, delta) {
    const d = keyToDate(key);
    if (!d) return '';
    d.setDate(d.getDate() + Number(delta || 0));
    return dateKey(d);
}

/**
 * b - a 的天数差（正数表示 b 在 a 之后）。任一无效返回 null，
 * **不返回 0** —— 0 是「同一天」的合法答案，用它兼作错误码会让调用方分不清。
 */
export function daysBetween(a, b) {
    const da = keyToDate(a);
    const db = keyToDate(b);
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / DAY_MS);
}

/** 今天距离某个日期还有几天（未来为正，过去为负） */
export function daysFromToday(key) {
    return daysBetween(todayKey(), key);
}

export function compareDateKey(a, b) {
    return String(a || '').localeCompare(String(b || ''));
}

/** 'YYYY-MM-DD' → '8月14日' / '2025年8月14日'（跨年才带年份） */
export function formatDateLabel(key, { withYear = 'auto' } = {}) {
    const d = keyToDate(key);
    if (!d) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    const needYear = withYear === true || (withYear === 'auto' && !sameYear);
    const body = `${d.getMonth() + 1}月${d.getDate()}日`;
    return needYear ? `${d.getFullYear()}年${body}` : body;
}

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayLabel(key) {
    const d = keyToDate(key);
    return d ? WEEK_LABELS[d.getDay()] : '';
}

/** 该月有多少天 */
export function daysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
}

/**
 * 把「每月 N 号」落到某个具体年月上。
 *
 * N 可能超出该月天数（比如设了 31 号，遇到 2 月），此时**夹到当月最后一天**，
 * 而不是溢出到下个月 —— 溢出会让「2月31日」变成「3月3日」，
 * 预测出来的经期日期整个错位。
 */
export function monthDayToKey(year, month, day) {
    const max = daysInMonth(year, month);
    const clamped = Math.min(Math.max(1, Number(day) || 1), max);
    return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

/** 月份键 'YYYY-MM' */
export function monthKey(key) {
    return String(key || '').slice(0, 7);
}

// ============================================================
// 时间窗（写日记的时段）
// ============================================================

/** 小时数 → '19:00' */
export function formatHour(hour) {
    const h = Math.max(0, Math.min(24, Number(hour) || 0));
    return `${String(h).padStart(2, '0')}:00`;
}

/**
 * 现在是不是在写日记的时段内。
 *
 * 时段固定 5 小时，且必须当天结束（起点最晚 19 点 → 19:00~24:00）。
 * 「必须当天结束」是产品要求：跨过 0 点之后就是新的一天，
 * 那时候写的东西应该算成新一天的日记，而不是继续往昨天里补。
 */
export function isInWriteWindow(startHour, now = new Date()) {
    const start = clamp(startHour, 0, 19);
    const h = now.getHours() + now.getMinutes() / 60;
    return h >= start && h < start + WRITE_WINDOW_HOURS;
}

export const WRITE_WINDOW_HOURS = 5;

/** 距离时段开始还有多久（分钟）；已经在时段内或已过返回 null */
export function minutesUntilWindow(startHour, now = new Date()) {
    const start = clamp(startHour, 0, 19);
    const cur = now.getHours() * 60 + now.getMinutes();
    const open = start * 60;
    if (cur >= open) return null;
    return open - cur;
}

/** 时段内还剩多久（分钟）；不在时段内返回 null */
export function minutesLeftInWindow(startHour, now = new Date()) {
    const start = clamp(startHour, 0, 19);
    const cur = now.getHours() * 60 + now.getMinutes();
    const close = (start + WRITE_WINDOW_HOURS) * 60;
    if (cur < start * 60 || cur >= close) return null;
    return close - cur;
}

export function describeWindow(startHour) {
    const start = clamp(startHour, 0, 19);
    return `${formatHour(start)} – ${formatHour(start + WRITE_WINDOW_HOURS)}`;
}

// ============================================================
// 文本
// ============================================================

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** 本 App 是 vue 模式，插值天然安全；只有小组件 render 那种 v-html 场景才需要。 */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function truncate(text, max = 60) {
    const str = String(text ?? '').replace(/\s+/g, ' ').trim();
    return str.length > max ? `${str.slice(0, max)}…` : str;
}

/** 中文语境下的字数：CJK 一个算一个，连续拉丁串算一个词，不计空白 */
export function countWords(text) {
    const str = String(text ?? '').trim();
    if (!str) return 0;
    const cjk = (str.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    const latin = (str.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
    return cjk + latin;
}

/**
 * 把「键: 值」列表拼成一段，自动跳过空值。
 *
 * prompt 里留下 "年龄: " 这种空字段是纯噪音，还会让模型以为「这个字段存在但是空的」
 * 从而主动去问用户 —— 跟 dream-weaver / galgame 用的是同一个实现口径。
 */
export function kvBlock(pairs) {
    return (Array.isArray(pairs) ? pairs : [])
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value]) => `${key}: ${String(value).trim()}`)
        .join('\n');
}

export function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
}

// ============================================================
// 其他
// ============================================================

/**
 * 深拷贝成纯对象。
 *
 * ★ 写 IndexedDB 前**必须**过一遍：结构化克隆拒绝 Proxy，而 store 是
 *   `Vue.reactive` 的，直接写会抛 `DataCloneError` —— 纯运行时错误，
 *   build / lint 都发现不了，表现是「改了没保存」。
 */
export function toPlain(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (err) {
        console.warn('[diary] 序列化失败，已跳过', err);
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

/** 中位数 —— 经期周期长度取中位数而不是平均，避免一次异常值把预测拉偏 */
export function median(list) {
    const nums = (Array.isArray(list) ? list : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (nums.length === 0) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

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
