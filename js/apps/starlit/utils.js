/**
 * 点灯 · 纯函数工具
 *
 * 不碰 window / DOM，node 里能直接 import 跑测试。
 */

let _seq = 0;

/** 短 id。同毫秒可能连出多个，所以带自增段。 */
export function uid(prefix = 'id') {
    _seq = (_seq + 1) % 4096;
    return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}`;
}

export function asArray(value) {
    return Array.isArray(value) ? value : [];
}

export function sameId(a, b) {
    return String(a ?? '') === String(b ?? '');
}

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

export function round(value, digits = 2) {
    const p = 10 ** digits;
    return Math.round((Number(value) || 0) * p) / p;
}

/**
 * reactive → 纯对象。
 * Vue 的 Proxy 直接写 IndexedDB 抛 DataCloneError，落盘前必须剥一层。
 */
export function toPlain(value) {
    if (value == null || typeof value !== 'object') return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return value;
    }
}

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** 用户 / AI / DB 的任何文本进 innerHTML 之前必须过这里 */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

/** 收拾 AI 文本：去围栏残渣、压掉三连空行 */
export function tidyText(value) {
    return String(value ?? '')
        .replace(/^```[\w-]*\n?/, '')
        .replace(/\n?```$/, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function truncate(value, max = 120) {
    const s = String(value ?? '');
    return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * 从 AI 回复里抠一个 JSON 对象或数组。
 * 模型经常在 JSON 前后多说几句、加围栏、字符串里直接回车、尾巴多个逗号。
 */
export function extractJson(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return null;

    const direct = tryParseJson(text);
    if (direct) return direct;

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
        const hit = tryParseJson(fenced[1].trim()) || scanFirstJson(fenced[1]);
        if (hit) return hit;
    }

    return scanFirstJson(text);
}

function tryParseJson(src) {
    const text = String(src || '').trim();
    if (!text) return null;
    try {
        const v = JSON.parse(text);
        if (v && typeof v === 'object') return v;
    } catch (_) { /* 继续修 */ }

    try {
        const v = JSON.parse(softenJson(text));
        if (v && typeof v === 'object') return v;
    } catch (_) { /* 这次切片放弃 */ }
    return null;
}

function softenJson(text) {
    return escapeRawBreaksInStrings(String(text || ''))
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, '$1');
}

function escapeRawBreaksInStrings(text) {
    let out = '';
    let inStr = false;
    let esc = false;
    for (const ch of String(text || '')) {
        if (inStr) {
            if (esc) { out += ch; esc = false; continue; }
            if (ch === '\\') { out += ch; esc = true; continue; }
            if (ch === '"') { out += ch; inStr = false; continue; }
            if (ch === '\n') { out += '\\n'; continue; }
            if (ch === '\r') continue;
            out += ch;
            continue;
        }
        if (ch === '"') inStr = true;
        out += ch;
    }
    return out;
}

function scanFirstJson(text) {
    const src = String(text || '');
    for (let i = 0; i < src.length; i += 1) {
        const ch = src[i];
        if (ch !== '{' && ch !== '[') continue;
        const scanned = scanJsonValue(src, i);
        if (!scanned) continue;
        const hit = tryParseJson(scanned);
        if (hit) return hit;
    }
    return null;
}

function scanJsonValue(text, start) {
    const first = text[start];
    if (first !== '{' && first !== '[') return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (ch === '\\') { esc = true; continue; }
            if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{' || ch === '[') depth += 1;
        else if (ch === '}' || ch === ']') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * 只允许 http(s) 的外链。帖子卡的链接要真能点开，
 * 但 javascript: 之类必须挡死 —— 卡片内容是 AI 生成的。
 */
export function safeHttpUrl(raw) {
    const url = String(raw ?? '').trim();
    if (!/^https?:\/\/[^\s<>"']+$/i.test(url)) return '';
    return url;
}

/** 从链接里取域名，帖子卡上显示「来自 xxx」 */
export function hostOf(url) {
    const safe = safeHttpUrl(url);
    if (!safe) return '';
    const m = safe.match(/^https?:\/\/([^/:?#]+)/i);
    return m ? m[1].replace(/^www\./i, '') : '';
}

/** 时间戳 → 「8月16日 10:28」 */
export function fmtTime(ts) {
    const d = new Date(Number(ts) || Date.now());
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 时间戳 → 「2026.8.16」 */
export function fmtDate(ts) {
    const d = new Date(Number(ts) || Date.now());
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 相对时间：刚刚 / 12 分钟前 / 3 天前 */
export function fmtAgo(ts) {
    const delta = Date.now() - (Number(ts) || 0);
    if (!Number.isFinite(delta) || delta < 0) return '刚刚';
    const min = Math.floor(delta / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min} 分钟前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} 小时前`;
    const day = Math.floor(hour / 24);
    if (day < 30) return `${day} 天前`;
    return fmtDate(ts);
}

/** 「键: 值」块，跳过空值。拼 prompt 用。 */
export function kvBlock(pairs) {
    return asArray(pairs)
        .filter((p) => p && String(p[1] ?? '').trim())
        .map(([k, v]) => `${k}: ${String(v).trim()}`)
        .join('\n');
}

/** 有序列表块，跳过空行 */
export function listBlock(items, bullet = '·') {
    return asArray(items)
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .map((x) => `${bullet} ${x}`)
        .join('\n');
}

/** 洗牌（问卷选项、弹幕队列都用） */
export function shuffle(list) {
    const arr = asArray(list).slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function pick(list) {
    const arr = asArray(list);
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

/** 节流：推理墙拖拽 / 弹幕都靠它压帧 */
export function throttle(fn, wait = 16) {
    let last = 0;
    let timer = null;
    let lastArgs = null;
    return function throttled(...args) {
        const now = Date.now();
        lastArgs = args;
        if (now - last >= wait) {
            last = now;
            fn.apply(this, args);
            return;
        }
        if (timer) return;
        timer = setTimeout(() => {
            timer = null;
            last = Date.now();
            fn.apply(this, lastArgs);
        }, wait - (now - last));
    };
}

export function debounce(fn, wait = 240) {
    let timer = null;
    return function debounced(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, wait);
    };
}

/** 两点距离 */
export function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
}

/** 矩形相交（卡片堆判定、框选都用） */
export function rectsOverlap(a, b, pad = 0) {
    return a.x - pad < b.x + b.w
        && a.x + a.w > b.x - pad
        && a.y - pad < b.y + b.h
        && a.y + a.h > b.y - pad;
}

/** 两个矩形的重叠面积占较小面积的比例 —— 判「拖到重合了」 */
export function overlapRatio(a, b) {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox <= 0 || oy <= 0) return 0;
    const inter = ox * oy;
    const min = Math.min(a.w * a.h, b.w * b.h) || 1;
    return inter / min;
}

/**
 * 三次贝塞尔的「q 弹」连线路径。
 * 控制点沿两点连线的法线方向甩出去一点，bulge 越大越弹。
 * 返回 SVG path 的 d 字符串。
 */
export function springPath(x1, y1, x2, y2, bulge = 0) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // 法线
    const nx = -dy / len;
    const ny = dx / len;
    const amp = bulge * Math.min(len * 0.28, 62);
    const c1x = x1 + dx * 0.3 + nx * amp;
    const c1y = y1 + dy * 0.3 + ny * amp;
    const c2x = x1 + dx * 0.7 + nx * amp;
    const c2y = y1 + dy * 0.7 + ny * amp;
    return `M ${round(x1, 1)} ${round(y1, 1)} C ${round(c1x, 1)} ${round(c1y, 1)}, ${round(c2x, 1)} ${round(c2y, 1)}, ${round(x2, 1)} ${round(y2, 1)}`;
}

/**
 * 从矩形中心朝目标方向求交点 —— 连线要贴在卡片边上，不要插进卡片里。
 */
export function edgeAnchor(rect, tx, ty) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const hw = rect.w / 2;
    const hh = rect.h / 2;
    const scale = Math.min(
        hw / (Math.abs(dx) || 1e-6),
        hh / (Math.abs(dy) || 1e-6),
    );
    return { x: cx + dx * scale, y: cy + dy * scale };
}

/**
 * 简单分词：按空白和标点切。语言模式统计词数、词典去重都用。
 * 中日韩按单字切（那些语言没有空格）。
 */
export function tokenizeWords(text) {
    const s = String(text ?? '');
    const latin = s.match(/[A-Za-zÀ-ÿА-Яа-яЁё'-]+/g) || [];
    const cjk = s.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || [];
    return [...latin, ...cjk];
}

/**
 * 目标语言检测（很粗）：判断用户是不是真的在用目标语言打字。
 * 只做提示，不硬拦 —— 拦错了比不拦更烦人。
 */
export function looksLikeChinese(text) {
    const s = String(text ?? '');
    const han = (s.match(/[\u4e00-\u9fff]/g) || []).length;
    const total = tokenizeWords(s).length || 1;
    return han / total > 0.4;
}

/** 稳定排序 key：先按 order，再按创建时间 */
export function byOrder(a, b) {
    const oa = Number(a?.order ?? 0);
    const ob = Number(b?.order ?? 0);
    if (oa !== ob) return oa - ob;
    return (a?.createdAt || 0) - (b?.createdAt || 0);
}

/** 词卡 / 词典条目的显示行：eat v. 吃 */
export function dictLine(entry) {
    if (!entry) return '';
    const front = String(entry.front || entry.term || '').trim();
    const pos = String(entry.pos || '').trim();
    const back = String(entry.back || entry.meaning || '').trim();
    return [front, pos, back].filter(Boolean).join(' ');
}

/**
 * 稳定哈希 → 0..1。给卡片一个固定的「随机」轻微旋转角，
 * 让推理墙看起来像真的贴过的便利贴，而不是像表格。
 */
export function hash01(str) {
    let h = 2166136261;
    const s = String(str ?? '');
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
}
