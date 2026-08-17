/**
 * music-app · widgets/now-playing-widget.js
 * 桌面小组件:当前播放。
 *
 * 渲染当前歌曲封面 + 标题 + 艺人 + 播放/暂停控制。
 * 用户点击 → 打开播放器 detail 页。
 *
 * size: 'S' (2x1 horizontal,默认)
 * 注册:在 createMusicApp() 的 widgets 数组里挂
 */

import { escapeHtml } from '@/src/core/escape.js';
import { SVGIcons } from '../icons.js';

/**
 * 渲染 widget HTML
 * @param {string} size - 'S' | 'M' | 'L'
 * @param {Object} payload - 桌面 widget 内部状态(frame work 注入)
 * @returns {string}
 */
export function renderNowPlayingWidget(size, payload) {
    const song = payload?.currentSong;
    if (!song) {
        return renderEmpty(size);
    }
    const title = escapeHtml(song.title || '');
    const artist = escapeHtml(song.artist || '');
    const color = escapeHtml(song.color || '#fb7299');
    const isPlaying = !!payload?.isPlaying;

    if (size === 'S') {
        return `
            <div class="music-widget music-widget--now-playing" data-color="${color}">
                <div class="music-widget__cover" style="background:${color};">
                    ${escapeHtml((song.title || '?').charAt(0))}
                </div>
                <div class="music-widget__info">
                    <div class="music-widget__title">${title}</div>
                    <div class="music-widget__artist">${artist}</div>
                </div>
            </div>
        `;
    }

    if (size === 'M') {
        return `
            <div class="music-widget music-widget--now-playing music-widget--m" data-color="${color}">
                <div class="music-widget__cover music-widget__cover--big" style="background:${color};">
                    ${escapeHtml((song.title || '?').charAt(0))}
                </div>
                <div class="music-widget__info">
                    <div class="music-widget__title">${title}</div>
                    <div class="music-widget__artist">${artist}</div>
                    <div class="music-widget__hint">${isPlaying ? '点击暂停' : '点击播放'}</div>
                </div>
            </div>
        `;
    }

    // L
    return `
        <div class="music-widget music-widget--now-playing music-widget--l" data-color="${color}">
            <div class="music-widget__hero" style="background:linear-gradient(135deg, ${color} 0%, ${escapeHtml(song.color2 || color)} 100%);">
                ${escapeHtml((song.title || '?').charAt(0))}
            </div>
            <div class="music-widget__info">
                <div class="music-widget__title">${title}</div>
                <div class="music-widget__artist">${artist}</div>
                <div class="music-widget__hint">${isPlaying ? '正在播放' : '已暂停'}</div>
            </div>
        </div>
    `;
}

function renderEmpty(size) {
    if (size === 'L') {
        return `
            <div class="music-widget music-widget--now-playing music-widget--l music-widget--empty">
                <div class="music-widget__hero">${SVGIcons.music}</div>
                <div class="music-widget__info">
                    <div class="music-widget__title">暂无播放</div>
                    <div class="music-widget__hint">去 App 选首歌</div>
                </div>
            </div>
        `;
    }
    return `
        <div class="music-widget music-widget--now-playing music-widget--empty">
            <div class="music-widget__cover music-widget__cover--empty">${SVGIcons.music}</div>
            <div class="music-widget__info">
                <div class="music-widget__title">暂无播放</div>
            </div>
        </div>
    `;
}

/**
 * widget 配置
 */
export const nowPlayingWidget = {
    id: 'now-playing',
    label: '正在播放',
    icon: SVGIcons.music,
    iconBg: 'linear-gradient(145deg, #fb7299, #ff9a9e)',
    size: 'S',
    orientation: 'h',
    // render 三档都实现了，声明出来「灵动岛与小组件」才会三档都画预览
    sizes: ['S', 'M', 'L'],
    previewPayload: {
        currentSong: { title: '示例曲', artist: '本地曲库', color: '#fb7299' },
        isPlaying: true,
    },
    render: renderNowPlayingWidget,
    onTap(instanceId, qualifiedId, ctx) {
        // 点击 widget → 打开 music-app 播放器页
        try {
            const state = ctx?.app?.state?.music;
            const song = state?.currentSong;
            if (!song) {
                ctx?.toolkit?.island?.notify?.('info', '暂无播放', '先去选首歌');
                return true;
            }
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: {
                    action: 'detail',
                    appId: 'music',
                    pageId: 'player',
                    payload: { songId: song.id },
                },
            }));
            return true;
        } catch (_) {
            return false;
        }
    },
};