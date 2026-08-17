/**
 * 灯塔 · 小工具
 *
 * 只放「和业务无关、任何地方都可能用」的东西。有业务含义的一律进 services/。
 * 日期这一块比四叶草多 —— 这个 App 有工作日历，「今天是哪天」是核心概念。
 */

/** 唯一 id。前缀是给人看的，比较时一律 String()。 */
export function uid(prefix = 'x') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * id 比较一律走这个。
 *
 * 本项目历史上栽过一次：内置数据 id 是数字、新建的是 `pl_167...` 字符串，
 * 详情页写了 `Number(id)` → NaN → 新建的永远打不开。
 * 只要 id 生成器出现过模板字符串，全 App 就不能再出现 `Number(id)` 比较。
 */
export function sameId(a, b) {
    return String(a ?? '') === String(b ?? '');
}

/** 结构化克隆的 Proxy 问题：reactive 对象直接写 IndexedDB 会抛 DataCloneError。 */
export function toPlain(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return value;
    }
}

export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

/** 金额一律走这个：负数归零、保留两位但去掉多余的 0 */
export function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.round(v * 100) / 100;
}

/** 展示用金额文本（不带货币名，货币名由调用方拼） */
export function fmtMoney(n) {
    const v = money(n);
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function asArray(v) {
    return Array.isArray(v) ? v : [];
}

/** 去掉首尾空白 + 折叠连续空行，AI 返回的长文本常见 */
export function tidyText(raw) {
    return String(raw || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** 截断到 n 个字，超出加省略号 */
export function truncate(text, n = 40) {
    const s = String(text || '');
    return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * 从模型输出里抠出 JSON。
 *
 * 三步加固：剥 ``` 围栏 → 从第一个 { 或 [ 截到最后一个 } 或 ] → parse。
 * **失败明确返回 null，不往 UI 里填乱码假装成功。**
 */
export function extractJson(raw) {
    let text = String(raw || '').trim();
    if (!text) return null;

    const fence = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/);
    if (fence) text = fence[1].trim();

    const firstObj = text.indexOf('{');
    const firstArr = text.indexOf('[');
    let start = -1;
    let endChar = '}';
    if (firstArr >= 0 && (firstObj < 0 || firstArr < firstObj)) {
        start = firstArr;
        endChar = ']';
    } else if (firstObj >= 0) {
        start = firstObj;
        endChar = '}';
    }
    if (start < 0) return null;
    const end = text.lastIndexOf(endChar);
    if (end <= start) return null;

    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
        return null;
    }
}

// ============================================================
// 日期
// ============================================================

/**
 * 日期键：`YYYY-MM-DD`。
 *
 * ★ 全 App 只认这一种日期表示，**不存时间戳**。
 *   时间戳带时区，跨零点算「今天」时会差一天；而这个 App 里
 *   「今天算不算工作日」「今天演过没有」全靠这个键去比。
 *   用本地时间的年月日拼串，是唯一不会在时区上出岔子的做法
 *   —— `toISOString()` 是 UTC，东八区凌晨 8 点前会退回昨天。
 */
export function dayKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 日期键 → Date（本地零点） */
export function dayDate(key) {
    const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function todayKey() {
    return dayKey(new Date());
}

/** 日期键 → 周几（0=周日） */
export function weekdayOf(key) {
    const d = dayDate(key);
    return d ? d.getDay() : -1;
}

/** 日期键 → 「8月13日 周三」 */
export function fmtDay(key) {
    const d = dayDate(key);
    if (!d) return '';
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${names[d.getDay()]}`;
}

/** 日期键 → 「8/13」 */
export function fmtDayShort(key) {
    const d = dayDate(key);
    if (!d) return '';
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 两个日期键相差几天（b - a） */
export function daysBetween(a, b) {
    const da = dayDate(a);
    const db = dayDate(b);
    if (!da || !db) return 0;
    return Math.round((db - da) / 86400000);
}

/** 日期键往后推 n 天 */
export function addDays(key, n) {
    const d = dayDate(key);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return dayKey(d);
}

/** 某个月有多少天。month 是 1~12。 */
export function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

/** 时间戳 → 「今天 14:30」/「8月13日 14:30」 */
export function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return `${hh}:${mm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 中文按字、拉丁按词计数，不计空白 */
export function countWords(text) {
    const s = String(text || '');
    const cjk = (s.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
    const latin = (s.match(/[a-zA-Z]+(?:'[a-zA-Z]+)?/g) || []).length;
    const digits = (s.match(/\d+/g) || []).length;
    return cjk + latin + digits;
}
