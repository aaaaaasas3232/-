/**
 * 预设库 · 设计 token 与通用工具
 *
 * 这一层解决的问题：预设组件必须**同时**满足两种消费方式，
 * 而这两种方式对「样式从哪来」的答案完全相反。
 *
 *   1. 项目内置 App —— 走 ESM import，样式来自 css/core/9x-presets*.css
 *   2. 用户上传的插件 App —— 走 blob URL 动态 import，**没有构建、没有别名解析**，
 *      也不能假设它自带 CSS 文件
 *
 * 所以预设组件的样式分成两半：
 *   - 结构性的（flex 方向、圆角、阴影）走 class，由 css/core 提供基线
 *   - 可调的（padding / gap / 主色 / 列数）走内联 CSS 变量
 *
 * 这样插件 App 即使一行 CSS 都没带，也能画出正确的东西；
 * 而内置 App 想换皮，覆盖 `.app-shell[data-app-id="xxx"] .lp-*` 就行。
 */

const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/**
 * 预设库自带的 escape。
 *
 * 不 import `../escape.js` 是故意的：本目录整体会被 codegen 拷成
 * 「零依赖单文件」塞进用户下载的插件里，多一个 import 就多一个解析失败点。
 */
export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => escapeMap[char]);
}

/** 数值型 CSS 长度：纯数字补 px，字符串原样透传（允许 `1rem` / `var(--x)`） */
export function len(value, fallback = '') {
    if (value === 0) return '0';
    if (value == null || value === '') return fallback;
    if (typeof value === 'number') return `${value}px`;
    return String(value);
}

/**
 * 把可调项拼成内联 style 的 CSS 变量串。
 * 值为空的键直接不输出 —— 让 CSS 里的默认值生效，而不是被 `--x: ;` 覆盖成空。
 */
export function cssVars(map = {}) {
    const parts = [];
    for (const [key, raw] of Object.entries(map)) {
        if (raw == null || raw === '') continue;
        parts.push(`${key}:${String(raw).replace(/[;"<>]/g, '')}`);
    }
    return parts.length ? ` style="${parts.join(';')}"` : '';
}

/** class 列表拼接，过滤掉假值 */
export function cx(...names) {
    return names.filter(Boolean).join(' ');
}

/**
 * 把 action 描述拼成 `data-app-action='...'` 属性串。
 *
 * 与 `src/core/actions.js` 的 createActionAttr 行为一致，但不依赖它 ——
 * 同样是为了让这份代码能被原样搬进插件。
 *
 * ⚠️ 返回的是**完整属性串**，模板里直接 `${act}` 展开，
 * 不要再套一层 `data-app-action='${act}'`（本项目踩过两次）。
 */
export function act(action, appId = '') {
    if (!action) return '';
    const payload = typeof action === 'string'
        ? { action: 'appMethod', method: action, appId }
        : { appId, ...action };
    if (!payload.appId) delete payload.appId;
    return ` data-app-action='${esc(JSON.stringify(payload))}'`;
}

/** 常用间距档位。问卷里「padding 选紧凑/标准/宽松」直接映射到这里。 */
export const SPACING = {
    none: 0,
    tight: 8,
    snug: 12,
    normal: 16,
    relaxed: 20,
    loose: 24,
};

/** 圆角档位 */
export const RADIUS = {
    none: 0,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    pill: 999,
};

/** 阴影档位（值直接可用于 box-shadow） */
export const ELEVATION = {
    none: 'none',
    sm: '0 1px 2px rgba(15,23,42,0.06)',
    md: '0 4px 16px rgba(15,23,42,0.08)',
    lg: '0 12px 32px rgba(15,23,42,0.12)',
};

/**
 * 把「档位名或原始值」解析成 CSS 长度。
 * 传 'snug' 得到 12px，传 18 得到 18px，传 '1.5rem' 原样返回。
 */
export function spacing(value, fallback = SPACING.normal) {
    if (value == null || value === '') return len(fallback);
    if (typeof value === 'string' && value in SPACING) return len(SPACING[value]);
    return len(value, len(fallback));
}

export function radius(value, fallback = RADIUS.md) {
    if (value == null || value === '') return len(fallback);
    if (typeof value === 'string' && value in RADIUS) return len(RADIUS[value]);
    return len(value, len(fallback));
}

export function elevation(value, fallback = 'sm') {
    if (!value) return ELEVATION[fallback] || ELEVATION.sm;
    return ELEVATION[value] || String(value);
}
