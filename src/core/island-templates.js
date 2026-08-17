// ============================================
// 灵动岛模板（音乐 Island 的渲染）
// 从 apps.js 第 84-265 行提取
// ============================================

import { escapeHtml } from './escape.js';
import { UI_ICONS } from './icons.js';

function formatIslandTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function clampIslandProgress(progress) {
    if (!Number.isFinite(progress)) {
        return 0;
    }
    return Math.min(100, Math.max(0, progress));
}

function renderIslandMusicCover(song = {}, coverClassName = '', placeholderClassName = '') {
    const color = song.color || '#fb7299';
    const noteIcon = UI_ICONS.musicNote;
    if (song.cover) {
        return `<div class="${coverClassName}"><img src="${escapeHtml(song.cover)}" alt=""></div>`;
    }
    return `
        <div class="${coverClassName}">
            <div class="${placeholderClassName}" style="background:linear-gradient(135deg, ${escapeHtml(color)}, ${escapeHtml(`${color}99`)});">
                ${noteIcon}
            </div>
        </div>
    `;
}

function getIslandMusicActiveLyricIndex(lyrics = [], currentTime = 0) {
    let activeIndex = 0;
    lyrics.forEach((line, index) => {
        if (Number(currentTime) >= Number(line?.time || 0)) {
            activeIndex = index;
        }
    });
    return activeIndex;
}

/**
 * 取当前时间点该唱的那句歌词（小型岛的标签用）。
 * 还没到第一句、或者压根没歌词时返回空串，让调用方回落到歌名。
 */
function pickIslandMusicLyricLine(payload = {}) {
    const lyrics = Array.isArray(payload.lyrics) && payload.lyrics.length
        ? payload.lyrics
        : (Array.isArray(payload.song?.lyrics) ? payload.song.lyrics : []);
    if (!lyrics.length) return '';
    const currentTime = Number(payload.currentTime || 0);
    let text = '';
    for (const line of lyrics) {
        if (Number(line?.time || 0) > currentTime) break;
        if (line?.text) text = line.text;
    }
    return text;
}

function renderMusicIslandTemplate(size, payload = {}) {
    const song = payload.song || {};
    const color = song.color || '#fb7299';
    const title = escapeHtml(song.title || payload.title || '未命名歌曲');
    const artist = escapeHtml(song.artist || payload.message || '未知歌手');
    const progress = clampIslandProgress(payload.progress);
    const liked = Boolean(payload.liked);
    const playing = Boolean(payload.isPlaying);
    const duration = Number(payload.duration || 0);
    const currentTime = Number(payload.currentTime || 0);
    const remaining = Math.max(duration - currentTime, 0);
    const likeIcon = liked ? UI_ICONS.heart : UI_ICONS.heartOutline;
    const activeLikeClass = liked ? ' is-liked' : '';

    if (size === 'mini') {
        // 小型岛上显示"正在唱的那一句",没有歌词才回落到歌名。
        // 后续每秒的更新由 dom-sync.updateLyrics 直接改这个节点的 textContent。
        const miniLabel = escapeHtml(pickIslandMusicLyricLine(payload) || song.title || payload.title || '未命名歌曲');
        return `
            <div class="island-template-music island-template-music-mini">
                ${renderIslandMusicCover(song, 'island-template-music-mini-cover', 'island-template-music-mini-cover-placeholder')}
                <div class="island-template-music-mini-wave${playing ? ' playing' : ''}">
                    <span style="background:${escapeHtml(color)};"></span>
                    <span style="background:${escapeHtml(color)};"></span>
                    <span style="background:${escapeHtml(color)};"></span>
                </div>
                <div class="island-template-music-mini-label">${miniLabel}</div>
            </div>
        `;
    }

    if (size === 'medium') {
        return `
            <div class="island-template-music island-template-music-medium">
                <div class="island-template-music-header">
                    ${renderIslandMusicCover(song, 'island-template-music-cover', 'island-template-music-cover-placeholder')}
                    <div class="island-template-music-info">
                        <div class="island-template-music-title">${title}</div>
                        <div class="island-template-music-artist">${artist}</div>
                    </div>
                </div>
                <div class="island-template-music-progress">
                    <div class="island-template-music-progress-bar">
                        <div class="island-template-music-progress-fill" style="width:${progress}%;background:${escapeHtml(color)};"></div>
                    </div>
                </div>
                <div class="island-template-music-time">
                    <span>${formatIslandTime(currentTime)}</span>
                    <span>${formatIslandTime(duration)}</span>
                </div>
                <div class="island-template-music-controls">
                    <div class="island-template-music-side-btns">
                        <button class="island-template-music-btn island-template-action-btn${activeLikeClass}" data-island-action="toggle-like" aria-label="收藏">${likeIcon}</button>
                    </div>
                    <div class="island-template-music-main-btns">
                        <button class="island-template-music-btn" data-island-action="prev" aria-label="后退10秒">${UI_ICONS.prev}</button>
                        <button class="island-template-music-btn" data-island-action="toggle-play" aria-label="播放暂停">${playing ? UI_ICONS.pause : UI_ICONS.play}</button>
                        <button class="island-template-music-btn" data-island-action="next" aria-label="快进10秒">${UI_ICONS.next}</button>
                    </div>
                </div>
            </div>
        `;
    }

    const lyrics = Array.isArray(payload.lyrics) && payload.lyrics.length
        ? payload.lyrics
        : [{ time: 0, text: '暂无歌词' }];
    const activeIndex = getIslandMusicActiveLyricIndex(lyrics, currentTime);
    const lyricsHtml = lyrics.map((line, index) => `
        <div class="island-template-music-lyric-line${index === activeIndex ? ' active' : ''}" data-lyric-index="${index}">
            <span>${escapeHtml(line?.text || '')}</span>
        </div>
    `).join('');

    return `
        <div class="island-template-music island-template-music-large" data-active-lyric-index="${activeIndex}">
            <div class="island-template-music-large-header">
                ${renderIslandMusicCover(song, 'island-template-music-large-cover', 'island-template-music-large-cover-placeholder')}
                <div class="island-template-music-large-info">
                    <div class="island-template-music-large-title">${title}</div>
                    <div class="island-template-music-large-artist">${artist}</div>
                </div>
                <button class="island-template-music-btn island-template-action-btn${activeLikeClass}" data-island-action="toggle-like" aria-label="收藏">${likeIcon}</button>
            </div>
            <div class="island-template-music-progress">
                <div class="island-template-music-progress-bar">
                    <div class="island-template-music-progress-fill" style="width:${progress}%;background:${escapeHtml(color)};"></div>
                </div>
            </div>
            <div class="island-template-music-time">
                <span>${formatIslandTime(currentTime)}</span>
                <span>${formatIslandTime(duration)}</span>
            </div>
            <div class="island-template-music-large-controls">
                <button class="island-template-music-large-btn" data-island-action="prev" aria-label="后退10秒">${UI_ICONS.prev}</button>
                <button class="island-template-music-large-btn island-template-music-large-btn-main" data-island-action="toggle-play" aria-label="播放暂停">${playing ? UI_ICONS.pause : UI_ICONS.play}</button>
                <button class="island-template-music-large-btn" data-island-action="next" aria-label="快进10秒">${UI_ICONS.next}</button>
            </div>
            <div class="island-template-music-lyrics">${lyricsHtml}</div>
        </div>
    `;
}

function syncMusicIslandLyrics(container) {
    const lyricsContainer = container?.querySelector('.island-template-music-lyrics');
    const activeLine = lyricsContainer?.querySelector('.island-template-music-lyric-line.active');
    if (!lyricsContainer || !activeLine) {
        return;
    }

    const targetTop = activeLine.offsetTop - (lyricsContainer.clientHeight / 2) + (activeLine.clientHeight / 2);
    lyricsContainer.scrollTop = Math.max(0, targetTop);
}

function bindMusicIslandTemplate(container, payload = {}) {
    const actionButtons = container.querySelectorAll('[data-island-action]');
    actionButtons.forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            const actionName = button.getAttribute('data-island-action');
            const handler = payload?.actions?.[actionName];
            if (typeof handler === 'function') {
                handler({ action: actionName, payload, event });
            }
        });
    });

    syncMusicIslandLyrics(container);

    // ★ 模板是用 show() 时的快照渲染的,每次重渲染(含 large→medium 降档)都会把
    //   播放图标/波形退回快照状态。framework 在每次重渲染后都会调用 bind(),
    //   这里回调给 app,让它按"当前真实播放状态"再校正一次 DOM。
    if (typeof payload?.onBound === 'function') {
        try { payload.onBound(container); } catch (err) {
            console.warn('[island] music onBound failed', err);
        }
    }
}

// ============================================
// 通话岛 - 中型 / 大型 模板
// ============================================

/** mm:ss */
function formatCallTimeStr(ms) {
    const safe = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 从 payload 拿当前通话时长 */
function resolveCallDurationMs(payload) {
    if (Number.isFinite(payload?.durationMs) && payload.durationMs >= 0) {
        return payload.durationMs;
    }
    if (Number.isFinite(payload?.connectTime) && payload.connectTime > 0) {
        return Date.now() - payload.connectTime;
    }
    return 0;
}

/** 内联头像 HTML */
function renderCallAvatarInline(payload) {
    const name = payload.name || '?';
    const initial = (name || '?').charAt(0).toUpperCase();
    const color = payload.avatarBg || '#A8C8EC';
    if (payload.avatar) {
        return `<img src="${escapeHtml(payload.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
    }
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;background:linear-gradient(135deg,${escapeHtml(color)},${escapeHtml(color + 'cc')});color:white;">${escapeHtml(initial)}</div>`;
}

/** 通话类型文字 */
function getCallTypeLabel(payload) {
    return payload?.callType === 'video' ? '视频' : '语音';
}

/** hh:mm */
function formatCallMsgTime(ts) {
    try {
        const d = new Date(ts || Date.now());
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '';
    }
}

/**
 * 中型通话岛(用户提供的 HTML 结构原样复原)
 */
function renderCallMediumIslandTemplate(size, payload = {}) {
    const name = escapeHtml(payload.name || '对方');
    const callTypeLabel = getCallTypeLabel(payload);
    const durationStr = formatCallTimeStr(resolveCallDurationMs(payload));
    const messagesCount = Array.isArray(payload.messages) ? payload.messages.length : 0;

    return `
<div style="display:flex;flex-direction:column;padding:12px 14px;color:white;height:100%;box-sizing:border-box;">
    <div style="display:flex;align-items:center;margin-bottom:15px;margin-top:10px;">
        <div style="width:40px;height:40px;border-radius:12px;overflow:hidden;margin-right:12px;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
            ${renderCallAvatarInline(payload)}
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
            <div style="display:flex;align-items:center;gap:5px;">
                <div style="width:6px;height:6px;background:#4ade80;border-radius:50%;animation:islandPulse 1.5s ease-in-out infinite;"></div>
                <span style="font-size:12px;color:#4ade80;">${callTypeLabel}</span>
                <span data-call-duration style="font-size:12px;color:rgba(255,255,255,0.6);font-family:'SF Mono',monospace;">${durationStr}</span>
            </div>
        </div>
        <button data-island-action="hangup" aria-label="挂断" title="挂断" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(239,68,68,0.4);flex-shrink:0;transition:transform 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        </button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" data-island-action="msg-input" placeholder="${messagesCount > 0 ? `已发 ${messagesCount} 条` : '发送消息...'}" autocomplete="off" style="flex:1;padding:8px 14px;border:none;border-radius:18px;background:rgba(255,255,255,0.12);color:white;font-size:13px;outline:none;backdrop-filter:blur(10px);min-width:0;">
        <button data-island-action="send-msg" aria-label="发送" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(74,222,128,0.3);transition:transform 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
    </div>
</div>
<style>@keyframes islandPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }</style>`;
}

/**
 * 大型通话岛(用户提供的 HTML 结构原样复原)
 */
function renderCallLargeIslandTemplate(size, payload = {}) {
    const name = escapeHtml(payload.name || '对方');
    const callTypeLabel = getCallTypeLabel(payload);
    const durationStr = formatCallTimeStr(resolveCallDurationMs(payload));
    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    const messagesHtml = messages.length
        ? messages.map((m) => {
            const isUser = m.sender === 'user';
            const label = isUser ? '我' : (m.senderName || 'AI');
            const content = escapeHtml(String(m.content || ''));
            const time = formatCallMsgTime(m.timestamp);
            return `<div style="display:flex;flex-direction:column;gap:2px;${isUser ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
                <div style="font-size:10px;color:rgba(255,255,255,0.5);padding:0 4px;">${escapeHtml(label)} · ${time}</div>
                <div style="max-width:80%;padding:6px 10px;border-radius:10px;background:${isUser ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.1)'};color:#fff;font-size:13px;line-height:1.4;word-break:break-word;">${content}</div>
            </div>`;
        }).join('')
        : `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-size:13px;text-align:center;padding:20px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom:8px;opacity:0.5;"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            <div>在灵动岛发送消息</div>
            <div style="font-size:11px;margin-top:4px;opacity:0.6;">通话中的对话将显示在这里</div>
        </div>`;

    return `
<div style="display:flex;flex-direction:column;height:100%;color:white;box-sizing:border-box;">
    <div style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="width:44px;height:44px;border-radius:14px;overflow:hidden;margin-right:14px;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,0.3);">
            ${renderCallAvatarInline(payload)}
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:3px;">${name}</div>
            <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:7px;height:7px;background:#4ade80;border-radius:50%;animation:islandPulse 1.5s ease-in-out infinite;box-shadow:0 0 6px #4ade80;"></div>
                <span style="font-size:13px;color:#4ade80;">${callTypeLabel}</span>
                <span data-call-duration style="font-size:13px;color:rgba(255,255,255,0.5);font-family:'SF Mono',monospace;margin-left:4px;">${durationStr}</span>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button data-island-action="hangup" aria-label="挂断" title="挂断" style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(239,68,68,0.4);transition:transform 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
            </button>
        </div>
    </div>
    <div data-island-action="messages-scroll" style="flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:rgba(0,0,0,0.15);scrollbar-width:none;-ms-overflow-style:none;">
        ${messagesHtml}
    </div>
    <div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:10px;align-items:center;background:rgba(0,0,0,0.15);">
        <input type="text" data-island-action="msg-input" placeholder="输入消息..." autocomplete="off" style="flex:1;padding:10px 16px;border:none;border-radius:20px;background:rgba(255,255,255,0.1);color:white;font-size:14px;outline:none;backdrop-filter:blur(10px);">
        <button data-island-action="send-msg" aria-label="发送" style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(74,222,128,0.35);transition:all 0.2s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
    </div>
</div>
<style>
@keyframes islandPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
[data-island-action="messages-scroll"]::-webkit-scrollbar { display:none; }
</style>`;
}

/**
 * 通话岛事件挂载:挂断 / 发送 / 输入回车 / 消息列表自动滚到底
 */
function bindCallIslandTemplate(container, payload = {}) {
    if (!container) return;
    const actions = payload?.actions || {};

    // 自动滚到消息列表底部
    const msgScroll = container.querySelector('[data-island-action="messages-scroll"]');
    if (msgScroll) {
        requestAnimationFrame(() => { msgScroll.scrollTop = msgScroll.scrollHeight; });
    }

    const actionButtons = container.querySelectorAll('[data-island-action]');
    // ★ v0.74 send-msg 修复:click 时从 msg-input 读取 value,否则 handler 拿不到 value → 发了空
    const msgInput = container.querySelector('[data-island-action="msg-input"]');
    actionButtons.forEach((btn) => {
        const actionName = btn.getAttribute('data-island-action');
        if (actionName === 'msg-input') {
            btn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    const handler = actions['send-msg'];
                    if (typeof handler === 'function') {
                        const input = btn;
                        handler({ action: 'send-msg', value: input.value, payload, event });
                        input.value = '';
                    }
                }
            });
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
            });
            return;
        }
        if (actionName === 'messages-scroll') return;
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            const handler = actions[actionName];
            if (typeof handler === 'function') {
                let value;
                if (actionName === 'send-msg' && msgInput) {
                    value = msgInput.value;
                    msgInput.value = '';
                }
                handler({ action: actionName, value, payload, event });
            }
        });
    });
}

/** 创建 Island 模板注册表 */
export function createIslandTemplates() {
    return {
        music: {
            render(size, payload) {
                return renderMusicIslandTemplate(size, payload);
            },
            bind(container, payload) {
                bindMusicIslandTemplate(container, payload);
            }
        },

        // ★ 通话岛 - 中型 + 大型合一:同一个模板名,根据 size 自动渲染对应布局
        //   - size === 'medium' → 中型(头像+名字+类型+时长+挂断+输入区)
        //   - size === 'large'  → 大型(中型 + 消息列表)
        'call-medium': {
            render(size, payload) {
                if (size === 'large') {
                    return renderCallLargeIslandTemplate(size, payload);
                }
                return renderCallMediumIslandTemplate(size, payload);
            },
            bind(container, payload) {
                bindCallIslandTemplate(container, payload);
            },
        },
    };
}

/** 确保 Island 模板所需 CSS 被加载（仅一次） */
export function ensureIslandTemplateStyles() {
    if (document.getElementById('music-island-template-styles')) {
        return;
    }

    const isSingleFile = typeof window !== 'undefined' && window.__LISTEN_SINGLE_FILE__ === true;

    // 单文件模式下 import.meta.url 不再指向真实文件位置,
    // 拼出来的 CSS 路径会变成 blob/data URL 形式导致 fetch 404。
    // 走 vite 的 import 提前把 CSS 字符串编译进 JS,然后直接写 <style>。
    // 多个文件构建下保持原行为,通过相对路径加载 css/music-island.css。
    let cssText = '';
    if (isSingleFile) {
        try {
            // 由 vite.config.single.js 在打包时把该文件内容替换到 __INLINE_CSS__ 占位符
            cssText = (typeof __INLINE_CSS__ !== 'undefined' && __INLINE_CSS__)
                || (typeof __MUSIC_ISLAND_CSS__ !== 'undefined' && __MUSIC_ISLAND_CSS__)
                || '';
        } catch (_) {
            cssText = '';
        }
    }

    if (cssText) {
        const styleEl = document.createElement('style');
        styleEl.id = 'music-island-template-styles';
        styleEl.textContent = cssText;
        document.head.appendChild(styleEl);
        console.log('[island-templates] CSS inlined (single-file mode)');
        return;
    }

    const link = document.createElement('link');
    link.id = 'music-island-template-styles';
    link.rel = 'stylesheet';
    const cssPath = new URL('../../css/music-island.css', import.meta.url).pathname;
    link.href = cssPath;
    console.log('[island-templates] loading CSS:', cssPath);
    link.onload = () => console.log('[island-templates] CSS loaded:', cssPath);
    link.onerror = () => console.error('[island-templates] CSS load failed:', cssPath);
    document.head.appendChild(link);
}
