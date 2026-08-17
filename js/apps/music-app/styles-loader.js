/**
 * music-app · styles-loader.js
 * 注入 music CSS(由 Vite 打包的 <link> 已经处理,此处保留以备运行时动态注入)。
 */
function injectMusicStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('music-app-styles')) return;
    // 真实样式由 css/apps/music/index.css 提供,这里只是个兜底 marker。
    const style = document.createElement('style');
    style.id = 'music-app-styles';
    style.textContent = '/* music-app 样式由 css/apps/music/index.css 提供 */';
    document.head.appendChild(style);
}

export { injectMusicStyles };
