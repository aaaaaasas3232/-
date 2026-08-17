/**
 * 世界观地图地标图标
 *
 * 地图上的地点 / 场所不再用 emoji。
 * 每个地标 = 描边圆球（用户选底色）+ 内部 SVG（颜色跟描边相同）+ 旁边描边文字。
 * 圆球和文字没有包裹关系。
 */

export const LANDMARK_ICONS = Object.freeze([
    { id: 'pin', label: '定位', path: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z' },
    { id: 'home', label: '住宅', path: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z' },
    { id: 'building', label: '楼宇', path: 'M4 21V5a1 1 0 0 1 1-1h6v17H4zm10 0V9h6a1 1 0 0 1 1 1v11h-7zM7 8h2M7 12h2M7 16h2M16 13h2M16 17h2' },
    { id: 'studio', label: '片场', path: 'M4 7h10l6-3v16l-6-3H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z' },
    { id: 'stage', label: '舞台', path: 'M3 18h18M5 18V10l7-4 7 4v8M9 18v-4h6v4' },
    { id: 'camera', label: '摄影', path: 'M4 8h4l2-2h4l2 2h4v10H4V8zm8 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z' },
    { id: 'trophy', label: '奖杯', path: 'M8 4h8v3a4 4 0 0 1-3 3.9V13h3v2H8v-2h3V10.9A4 4 0 0 1 8 7V4zM6 5H4v2a2 2 0 0 0 2 2V5zm12 0h2v2a2 2 0 0 1-2 2V5zM8 19h8v2H8z' },
    { id: 'game', label: '电竞', path: 'M6 10h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8zm2 2v4m-2-2h4m8-1h.01M16 15h.01' },
    { id: 'headset', label: '耳机', path: 'M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h4M4 13v5a2 2 0 0 0 2 2h2v-7H4' },
    { id: 'cafe', label: '咖啡', path: 'M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zm11 1h2a3 3 0 0 1 0 6h-2M8 20h8' },
    { id: 'shop', label: '商店', path: 'M4 8h16l-1 4H5L4 8zm1 4v8h14v-8M9 20v-4h6v4M8 8V5h8v3' },
    { id: 'school', label: '学校', path: 'M3 10l9-5 9 5-9 5-9-5zm4 3.2V18l5 2.5L17 18v-4.8' },
    { id: 'hospital', label: '医院', path: 'M5 21V4h14v17H5zm5-13h4v2h-4V8zm0 4h4v2h-4v-2zM11 4V2h2v2' },
    { id: 'park', label: '公园', path: 'M12 3c3 4 6 7 6 10a6 6 0 1 1-12 0c0-3 3-6 6-10zm0 18V13' },
    { id: 'station', label: '车站', path: 'M6 4h12v10H6V4zm2 12h8l2 4H6l2-4zM8 8h2m4 0h2M9 20h6' },
    { id: 'airport', label: '机场', path: 'M3 13l7-2 2-7 2 7 7 2-7 2-1 6-2-6-8-2z' },
    { id: 'harbor', label: '港口', path: 'M4 16c2 3 5 4 8 4s6-1 8-4M5 12h14M7 8h10l1 4H6l1-4z' },
    { id: 'bridge', label: '桥梁', path: 'M3 16h18M5 16V9m14 7V9M5 12h14M8 16v-3m4 3v-3m4 3v-3' },
    { id: 'tower', label: '塔', path: 'M12 2l3 6h-6l3-6zm-4 6h8l2 13H6L8 8zm0 6h8' },
    { id: 'museum', label: '展馆', path: 'M3 10l9-5 9 5v2H3v-2zm2 4h2v7H5v-7zm6 0h2v7h-2v-7zm6 0h2v7h-2v-7zM3 21h18' },
    { id: 'office', label: '公司', path: 'M5 21V4h9v17H5zm9-10h5v10h-5M8 8h3M8 12h3M8 16h3' },
    { id: 'hotel', label: '酒店', path: 'M4 21V8l8-4 8 4v13H4zm4-6h8v6H8v-6z' },
    { id: 'star', label: '星标', path: 'M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18l.9-5.4L4.2 8.7l5.4-.8L12 3z' },
    { id: 'heart', label: '心', path: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z' },
    { id: 'dot', label: '圆点', path: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z' },
]);

export const DEFAULT_LANDMARK_BG = '#E8F1FF';
export const DEFAULT_LANDMARK_STROKE = '#0A84FF';

export function getLandmarkIcon(id) {
    return LANDMARK_ICONS.find((x) => x.id === id) || LANDMARK_ICONS[0];
}

export function renderLandmarkSvg(id, size = 12) {
    const icon = getLandmarkIcon(id);
    const paths = icon.path.split('M').filter(Boolean).map((p) => `M${p}`);
    // 单 path 即可；多段也拼进同一个 path
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${icon.path}"></path></svg>`;
}

export function contrastStroke(bg) {
    const hex = String(bg || DEFAULT_LANDMARK_BG).replace('#', '');
    if (hex.length < 6) return DEFAULT_LANDMARK_STROKE;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    return luma > 160 ? '#0A84FF' : '#FFFFFF';
}

/**
 * 地图上的一个地标。
 *
 * ★ style 必须只出现一次：以前这里除了自己的 `--mark-bg / --mark-stroke`，
 *   还把调用方 attrs 里的 `style="left/top/--pin-scale"` 一起拼进标签，
 *   同一个元素上出现两个 style 属性 —— HTML 只认第一个，颜色变量被整段丢掉，
 *   表现就是「圆球底色怎么选都不生效」。所以位置样式改为单独用 style 参数传入。
 *
 * @param {object} o
 * @param {string} o.style 位置类样式（left / top / --pin-scale），不要带 style= 包装
 * @param {string} o.attrs 非 style 的属性（title / data-* / data-app-action）
 */
export function renderMapMark({
    name = '',
    iconId = 'pin',
    bg = DEFAULT_LANDMARK_BG,
    stroke = '',
    extraClass = '',
    attrs = '',
    style = '',
}) {
    const strokeColor = stroke || contrastStroke(bg);
    const styleAttr = `--mark-bg:${bg};--mark-stroke:${strokeColor};${style}`;
    return `
        <div class="wv-map__mark ${extraClass}" ${attrs} style="${styleAttr}">
            <span class="wv-map__orb" aria-hidden="true">${renderLandmarkSvg(iconId, 12)}</span>
            <span class="wv-map__word">${name}</span>
        </div>
    `;
}

export function renderIconPicker(fieldKey, currentId, ns = 'place') {
    const current = currentId || 'pin';
    return `
        <div class="wv-iconpick" data-${ns}-field="${fieldKey}" data-icon-value="${current}">
            ${LANDMARK_ICONS.map((icon) => `
                <button type="button" class="wv-iconpick__item ${icon.id === current ? 'is-on' : ''}"
                    data-icon-id="${icon.id}" data-icon-field="${fieldKey}" data-icon-ns="${ns}"
                    title="${icon.label}" aria-label="${icon.label}">
                    ${renderLandmarkSvg(icon.id, 14)}
                </button>
            `).join('')}
        </div>
    `;
}
