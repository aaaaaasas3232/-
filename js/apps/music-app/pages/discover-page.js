/**
 * music-app · pages/discover-page.js
 * 发现 Tab
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';

export function renderDiscoverPage(content, page, app) {
    const appId = app?.id || 'music';

    return `
        <div class="music-app-container">
            <div class="music-header">
                <div class="music-header-title">发现</div>
            </div>

            <div class="music-search-bar">
                ${SVGIcons.search}
                <input type="text" placeholder="搜索新音乐" data-search-input="1" />
            </div>

            <div class="music-section">
                <div class="music-section-header">
                    <span class="music-section-title">探索</span>
                </div>
                <div class="music-discover-grid">
                    ${_renderDiscoverCard(appId, 'rankings', '排行榜', '热门歌曲实时更新', SVGIcons.chart, 'music-discover-icon--red', 'openRankings')}
                    ${_renderDiscoverCard(appId, 'radio', '私人电台', '为你量身定制', SVGIcons.radio, 'music-discover-icon--teal', 'openRadio')}
                    ${_renderDiscoverCard(appId, 'playlists', '精选歌单', '编辑精心推荐', SVGIcons.playlist, 'music-discover-icon--purple', 'openPlaylists')}
                    ${_renderDiscoverCard(appId, 'recent', '最近播放', '回顾你的歌单', SVGIcons.clock, 'music-discover-icon--pink', 'openRecentPlayed')}
                </div>
            </div>
        </div>
    `;
}

function _renderDiscoverCard(appId, id, title, desc, iconSvg, iconColorClass, method) {
    const action = createActionAttr({
        action: 'appMethod',
        appId,
        method,
    }, appId);

    // createActionAttr 返回的已经是完整的 data-app-action="..." 属性串，
    // 再包一层会生成嵌套属性，JSON 解析不出来 → 四张卡全变死卡。
    return `
        <div class="music-discover-card" data-discover="${escapeHtml(id)}" ${action}>
            <div class="music-discover-icon ${iconColorClass}">
                ${iconSvg}
            </div>
            <div class="music-discover-title">${escapeHtml(title)}</div>
            <div class="music-discover-desc">${escapeHtml(desc)}</div>
        </div>
    `;
}