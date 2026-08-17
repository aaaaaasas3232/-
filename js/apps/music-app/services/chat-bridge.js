/**
 * music-app · services/chat-bridge.js
 *
 * 把音乐相关的东西发进 murmur（chat app）的会话里。
 *
 * 对齐原型 music-app.js 的 shareCurrentSong / sendListenTogetherInvite /
 * sharePlaylistToAI —— 原型直接 push 到 ai.chatHistory，这里改成走
 * settingsSdk.chatMessages，消息类型：
 *   song_share             → 歌曲卡
 *   playlist_share         → 歌单卡
 *   listen_together_invite → 一起听邀请卡
 *
 * chat 侧渲染器见 js/apps/chat-app/components/share-cards.js。
 * 这里只依赖 settingsSdk，不 import chat-app，chat 没装也不会炸。
 */

import { getSettingsSdk } from './ai-bridge.js';

const VALID_MODES = new Set(['calendar', 'story']);

/**
 * 会话 mode：优先看 chat 里正打开的那个会话，否则回落 calendar。
 */
function _resolveMode(aiId, preferred) {
    if (preferred && VALID_MODES.has(preferred)) return preferred;
    try {
        const el = document.querySelector(
            `.app-shell[data-app-id="chat"] [data-conversation-id="${CSS.escape(String(aiId))}"][data-mode]`,
        );
        const mode = el?.getAttribute('data-mode');
        if (mode && VALID_MODES.has(mode)) return mode;
    } catch (_) { /* CSS.escape 不支持时忽略 */ }
    return 'calendar';
}

async function _addMessage(aiId, mode, msg) {
    const sdk = await getSettingsSdk();
    if (!sdk?.chatMessages?.add) return null;
    try {
        return await sdk.chatMessages.add(null, aiId, _resolveMode(aiId, mode), msg);
    } catch (e) {
        console.warn('[music] 写入聊天消息失败', e);
        return null;
    }
}

/** 让聊天页把新消息画出来（chat 正打开着时才有可见效果） */
function _pokeChatUi() {
    try {
        window.invalidateRendererCache?.('chat', null);
        window.__appRendererBridge?.syncNow?.({ force: true });
    } catch (_) { /* noop */ }
}

function _songCard(song, extra = {}) {
    return {
        songId: song?.id ?? null,
        title: song?.title || '未知歌曲',
        artist: song?.artist || '未知歌手',
        cover: song?.cover || '',
        color: song?.color || '#fb7299',
        duration: Number(song?.duration) || 0,
        ...extra,
    };
}

/**
 * 分享一首歌到会话
 * @param {{aiId:string, song:object, sender?:'user'|'ai', mode?:string}} opts
 */
export async function sendSongShare(opts = {}) {
    const { aiId, song, sender = 'user', mode } = opts;
    if (!aiId || !song) return null;
    const record = await _addMessage(aiId, mode, {
        sender,
        type: 'song_share',
        content: `[分享歌曲] ${song.title || ''} - ${song.artist || ''}`,
        songCard: _songCard(song),
    });
    _pokeChatUi();
    return record;
}

/**
 * 分享一张歌单到会话
 * @param {{aiId:string, playlist:object, songs?:Array, sender?:'user'|'ai', mode?:string}} opts
 */
export async function sendPlaylistShare(opts = {}) {
    const { aiId, playlist, songs = [], sender = 'user', mode } = opts;
    if (!aiId || !playlist) return null;
    const names = songs.map((s) => s?.title).filter(Boolean).slice(0, 5);
    const record = await _addMessage(aiId, mode, {
        sender,
        type: 'playlist_share',
        content: `[分享歌单] ${playlist.name || ''}`,
        playlistCard: {
            playlistId: playlist.id ?? null,
            name: playlist.name || '歌单',
            color: playlist.color || '#fb7299',
            cover: playlist.cover || '',
            songCount: songs.length,
            songNames: names,
        },
    });
    _pokeChatUi();
    return record;
}

/**
 * 发一张一起听邀请卡
 * @param {{aiId:string, song?:object, sender?:'user'|'ai', mode?:string}} opts
 */
export async function sendListenTogetherInvite(opts = {}) {
    const { aiId, song, sender = 'user', mode } = opts;
    if (!aiId) return null;
    const record = await _addMessage(aiId, mode, {
        sender,
        type: 'listen_together_invite',
        content: song ? `[一起听] ${song.title || ''}` : '[一起听]',
        inviteCard: {
            ...(song ? _songCard(song) : {}),
            invitedBy: sender,
        },
    });
    _pokeChatUi();
    return record;
}

/**
 * 发一条普通文本（AI 接受邀请的回话、切歌时的推荐语等）
 * @param {{aiId:string, text:string, sender?:'user'|'ai', mode?:string}} opts
 */
export async function sendChatText(opts = {}) {
    const { aiId, text, sender = 'ai', mode } = opts;
    if (!aiId || !text) return null;
    const record = await _addMessage(aiId, mode, {
        sender,
        type: 'text',
        content: String(text),
    });
    _pokeChatUi();
    return record;
}
