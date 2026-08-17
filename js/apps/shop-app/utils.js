/**
 * 四叶草 · 小工具
 *
 * 只放「和业务无关、任何地方都可能用」的东西。有业务含义的一律进 services/。
 */

/** 唯一 id。前缀是给人看的，比较时一律 String()。 */
export function uid(prefix = 'x') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * id 比较一律走这个。
 *
 * 本项目历史上栽过一次：内置数据 id 是数字、新建的是 `pl_167...` 字符串，
 * 详情页写了 `Number(id)` → NaN → 新建的永远打不开（AGENTS2 §3.5）。
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

export function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (sameDay) return `${hh}:${mm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 截断到 n 个字，超出加省略号 */
export function truncate(text, n = 40) {
    const s = String(text || '');
    return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * 从模型输出里抠出 JSON。
 *
 * 三步加固（沿用梦境编织的做法）：剥 ``` 围栏 → 从第一个 { 或 [ 截到最后一个 } 或 ]
 * → parse。**失败明确返回 null，不往 UI 里填乱码假装成功。**
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

/** 数组安全取值 */
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

/** 中文按字、拉丁按词计数，不计空白 */
export function countWords(text) {
    const s = String(text || '');
    const cjk = (s.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
    const latin = (s.match(/[a-zA-Z]+(?:'[a-zA-Z]+)?/g) || []).length;
    const digits = (s.match(/\d+/g) || []).length;
    return cjk + latin + digits;
}
