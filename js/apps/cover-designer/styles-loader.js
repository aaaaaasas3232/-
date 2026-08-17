/**
 * cover-designer / styles-loader.js
 *
 * 运行时确保字体加载
 */

let _cdFontInjected = false;

function ensureFont() {
    if (_cdFontInjected) return;
    if (typeof document === 'undefined') return;
    _cdFontInjected = true;
    try {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fontsapi.zeoseven.com/256/main/result.css';
        document.head.appendChild(link);
    } catch (_) {}
}

export function injectCoverDesignerStyles() {
    ensureFont();
}
