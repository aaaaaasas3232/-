/**
 * 小奇怪 · 主题
 *
 * ── 一条硬规矩 ────────────────────────────────────────────────────
 *
 * **颜色的唯一真相在 CSS。** 本文件只做三件事:
 *
 *   1. 列出有哪几套主题(id + 中文名 + 一句话)
 *   2. 往 `.app-shell[data-app-id="oddity"]` 上写 `data-oq-theme="xxx"`
 *   3. 把生效后的 CSS 变量**读回来**转发给框架
 *
 * 第 3 步不能省:框架画状态栏、Home 指示条时只认 `appConfig` 上的字段,
 * 不认识 CSS 变量。不同步的话切到浅色主题时状态栏还是浅灰字,
 * 在白底上完全看不见(梦境编织那轮靠截图才发现,AGENTS2 §11.9)。
 */

/**
 * 主题清单。
 *
 * 默认 `morandi` —— 用户对双人扫雷的原话是「格子的颜色、格子上的数字颜色
 * 都请参考莫兰迪配色」,那就让整个 App 都站在这个调子上,而不是只有扫雷一页。
 */
export const THEMES = Object.freeze([
    { id: 'morandi', label: '莫兰迪', desc: '灰调的粉、青、蓝,饱和度全压下去' },
    { id: 'ink', label: '素墨', desc: '接近黑白,只留一点暖灰' },
    { id: 'dusk', label: '黄昏', desc: '暗底 + 落日色,晚上看不刺眼' },
]);

export const DEFAULT_THEME = 'morandi';

export function isKnownTheme(id) {
    return THEMES.some((theme) => theme.id === String(id || ''));
}

export function normalizeTheme(id) {
    return isKnownTheme(id) ? String(id) : DEFAULT_THEME;
}

/**
 * 找到本 App 的 shell 节点。
 *
 * 优先从组件自己往上找 —— 直接 `querySelector` 在「同时开着两个 App 窗」
 * 的极端情况下会抓错人。
 */
export function findShell(el) {
    const fromEl = el?.closest?.('.app-shell');
    if (fromEl) return fromEl;
    if (typeof document === 'undefined') return null;
    return document.querySelector('.app-shell[data-app-id="oddity"]');
}

/**
 * 应用主题并把颜色转发给框架。
 *
 * @param {HTMLElement|null} shell
 * @param {string} themeId
 * @param {object|null} app  框架给的 app 对象(要往它身上写状态栏颜色)
 */
export function applyTheme(shell, themeId, app = null) {
    if (!shell) return;
    shell.setAttribute('data-oq-theme', normalizeTheme(themeId));
    if (!app || typeof getComputedStyle !== 'function') return;

    const cs = getComputedStyle(shell);
    const read = (name) => cs.getPropertyValue(name).trim();
    const ink = read('--oq-status-ink');
    const bg = read('--oq-app-bg');
    const indicator = read('--oq-home-indicator');
    if (ink) app.statusBarColor = ink;
    if (bg) app.background = bg;
    if (indicator) app.homeIndicatorColor = indicator;

    /*
     * ★ 重赋 apps.value 强制框架 computed 重算(core-shim 约定的通知路径)。
     *   不做这一步,底部指示条那 40px 的背景会停在旧主题色(AGENTS2 §18.2)。
     */
    if (typeof window !== 'undefined' && window.__phoneAppsRef?.value) {
        window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
    }
}
