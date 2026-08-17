/**
 * music-app · components/track-controls.js
 *
 * 「收藏」和「播放/暂停」这两个按钮在首页列表、歌单详情、搜索结果、播放器页、
 * 灵动岛上各画了一遍，class 名、图标、点了以后调什么方法全都不一样：
 * 列表里正在放的歌按钮还显示 ▶、心形有的用 .liked 有的用 .is-liked、
 * 岛上收藏了列表却不变色。统一从这里出，各页面只管往里塞数据。
 *
 * 约定（dom-sync 靠这些属性做增量刷新，别改）：
 *   收藏 → .music-like-btn[data-song-id][data-liked="1|0"]
 *   播放 → .music-play-toggle[data-song-id][data-playing="1|0"][data-current="1|0"]
 */

import { createActionAttr } from '@/src/core/actions.js';
import { SVGIcons } from '../icons.js';

/**
 * 收藏按钮。
 * @param {Object} opts
 * @param {string} opts.appId
 * @param {number|string} opts.songId
 * @param {boolean} opts.liked
 * @param {'icon'|'labeled'} [opts.variant] labeled 会带「喜欢 / 已喜欢」文字（播放器页用）
 * @param {string} [opts.extraClass]
 * @param {string} [opts.color] labeled 态下已收藏时的文字颜色（跟随歌曲主题色）
 */
export function renderLikeButton(opts = {}) {
    const { appId = 'music', songId, liked = false, variant = 'icon', extraClass = '', color = '' } = opts;
    const action = createActionAttr({
        action: 'appMethod',
        appId,
        method: 'toggleLike',
        payload: { songId },
    }, appId);
    const icon = liked ? SVGIcons.heart : SVGIcons.heartOutline;
    const classes = [
        'music-like-btn',
        variant === 'labeled' ? 'music-like-btn--labeled' : 'music-like-btn--icon',
        liked ? 'is-liked' : '',
        extraClass,
    ].filter(Boolean).join(' ');
    const style = (liked && color) ? ` style="color:${color};"` : '';
    const label = variant === 'labeled'
        ? `<span class="music-like-btn-text">${liked ? '已喜欢' : '喜欢'}</span>`
        : '';
    return `<button class="${classes}"${style} ${action}
                    data-song-id="${songId}" data-liked="${liked ? '1' : '0'}"
                    aria-label="${liked ? '取消喜欢' : '喜欢'}">${icon}${label}</button>`;
}

/**
 * 播放/暂停按钮。
 *
 * 关键在 isCurrent：这一行就是当前这首歌时，按钮要变成暂停图标、点了是暂停而不是
 * 「从头再放一遍」；不是当前这首才走 playSong。以前列表里全是 playSong + ▶，
 * 正在放的那首点一下会从头开始，看着像卡了一下。
 *
 * @param {Object} opts
 * @param {string} opts.appId
 * @param {number|string} opts.songId
 * @param {boolean} opts.isCurrent 这首歌是不是 state.currentSong
 * @param {boolean} opts.isPlaying 全局播放状态
 * @param {'list'|'hero'} [opts.variant]
 * @param {string} [opts.extraClass]
 */
export function renderPlayToggleButton(opts = {}) {
    const { appId = 'music', songId, isCurrent = false, isPlaying = false, variant = 'list', extraClass = '' } = opts;
    const showPause = isCurrent && isPlaying;
    const action = createActionAttr({
        action: 'appMethod',
        appId,
        // 当前这首 → 切换播放/暂停；其他 → 换歌
        method: isCurrent ? 'togglePlay' : 'playSong',
        payload: { songId },
    }, appId);
    const classes = [
        'music-play-toggle',
        variant === 'hero' ? 'music-play-toggle--hero' : 'music-play-toggle--list',
        isCurrent ? 'is-current' : '',
        showPause ? 'is-playing' : '',
        extraClass,
    ].filter(Boolean).join(' ');
    return `<button class="${classes}" ${action}
                    data-song-id="${songId}" data-current="${isCurrent ? '1' : '0'}"
                    data-playing="${showPause ? '1' : '0'}"
                    aria-label="${showPause ? '暂停' : '播放'}">${showPause ? SVGIcons.pause : SVGIcons.play}</button>`;
}
