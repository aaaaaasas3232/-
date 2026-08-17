/**
 * 手书 · 主题
 *
 * ★ 这里**没有任何颜色值**。四套主题的全部 `--hs-*` 都在
 *   `css/apps/handwrite/index.css` 里,靠 shell 上的 `data-hs-theme` 切换。
 *   JS 只做两件事:挂属性、把生效后的颜色**读出来**转发给框架。
 *
 * 为什么要转发:框架画状态栏和 Home 指示条时只认 `appConfig` 上的字段,
 * 不认识 CSS 变量。不同步的话切到浅色主题时状态栏还是浅色字,
 * 在白底上完全看不见 —— 这类问题不报错,只能靠眼睛发现。
 */

export const THEMES = Object.freeze([
    { id: 'ink', label: '墨', desc: '深灰底 + 暖白字,最像手书本身' },
    { id: 'dusk', label: '暮', desc: '偏紫的夜色' },
    { id: 'paper', label: '纸', desc: '浅色,适合白天看' },
    { id: 'neon', label: '霓', desc: '高对比,故障风效果最出片' },
]);

export const THEME_IDS = Object.freeze(THEMES.map((t) => t.id));

export function isTheme(id) {
    return THEME_IDS.includes(String(id || ''));
}

/**
 * 把主题落到 shell 上,并把颜色回传给框架。
 *
 * @param {HTMLElement} shell `.app-shell[data-app-id="handwrite"]`
 * @param {object} app        appConfig 引用(框架给的 this.app)
 * @param {string} themeId
 */
export function applyTheme(shell, app, themeId) {
    if (!shell) return;
    const id = isTheme(themeId) ? themeId : 'ink';
    shell.setAttribute('data-hs-theme', id);

    if (!app || typeof getComputedStyle !== 'function') return;
    const cs = getComputedStyle(shell);
    const read = (name) => cs.getPropertyValue(name).trim();

    const ink = read('--hs-status-ink');
    const bg = read('--hs-app-bg');
    const indicator = read('--hs-home-indicator');
    if (ink) app.statusBarColor = ink;
    if (bg) app.background = bg;
    if (indicator) app.homeIndicatorColor = indicator;

    // ★ 重赋 apps.value 强制框架 computed 重算(core-shim 约定的通知路径),
    //   否则底部指示条那 40px 的背景会停在旧主题色
    try {
        if (typeof window !== 'undefined' && window.__phoneAppsRef?.value) {
            window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
        }
    } catch (_) { /* 框架没暴露就算了,只是底栏色慢一拍 */ }
}

export default { THEMES, THEME_IDS, isTheme, applyTheme };
