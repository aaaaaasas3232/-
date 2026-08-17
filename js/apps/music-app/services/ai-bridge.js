/**
 * music-app · services/ai-bridge.js
 * AI 桥接(发邀请卡 / 分享歌单 / 偷歌)。
 *
 * 走 window.settingsSdk.aiPersons(等 ready)。
 * 不直接依赖 chat-app(降低耦合,即使 chat 没装也能跑)。
 */

let _sdkReady = false;
let _sdkResolve = null;
const _sdkPromise = new Promise((resolve) => { _sdkResolve = resolve; });

if (typeof window !== 'undefined') {
    if (window.settingsSdk?.aiPersons) {
        _sdkReady = true;
        _sdkResolve(window.settingsSdk);
    } else {
        window.addEventListener('settings-sdk-ready', () => {
            if (window.settingsSdk) {
                _sdkReady = true;
                _sdkResolve(window.settingsSdk);
            }
        });
    }
}

async function _getSdk(timeoutMs = 2000) {
    if (_sdkReady) return window.settingsSdk;
    try {
        return await Promise.race([
            _sdkPromise,
            new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ]);
    } catch (_) { return null; }
}

/** 供 chat-bridge 复用同一份"等 SDK ready"逻辑 */
export function getSettingsSdk(timeoutMs = 2000) {
    return _getSdk(timeoutMs);
}

/**
 * 读取所有 AI 人设
 * @returns {Promise<Array>}
 */
export async function listAiPersons() {
    const sdk = await _getSdk();
    if (!sdk?.aiPersons?.list) return [];
    try {
        return sdk.aiPersons.list() || [];
    } catch (_) { return []; }
}

/**
 * 邀请 AI 一起听
 * @param {Object} opts {aiId, songId, songTitle}
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function inviteAiListenTogether(opts) {
    const sdk = await _getSdk();
    if (!sdk?.aiPersons) return { ok: false, message: 'settingsSdk 未就绪' };
    const { aiId, songId, songTitle } = opts || {};
    if (!aiId) return { ok: false, message: '缺少 aiId' };

    try {
        // 读 AI 人设
        let ai = null;
        if (typeof sdk.aiPersons.get === 'function') {
            ai = sdk.aiPersons.get(aiId);
        } else if (Array.isArray(sdk.aiPersons.list)) {
            ai = sdk.aiPersons.list().find((p) => p.id === aiId);
        }
        if (!ai) return { ok: false, message: '找不到 AI 人设' };

        // 写入 ai.boundResources.listenTogetherSongs(本次邀请的歌曲)
        const boundResources = ai.boundResources || {};
        const list = Array.isArray(boundResources.listenTogetherSongs) ? boundResources.listenTogetherSongs : [];
        if (songId && !list.includes(songId)) {
            list.push(songId);
        }
        boundResources.listenTogetherSongs = list;
        ai.boundResources = boundResources;
        if (typeof sdk.aiPersons.update === 'function') {
            sdk.aiPersons.update(ai.id, ai);
        }
        return { ok: true, message: `已邀请 ${ai.name || 'AI'} 一起听` };
    } catch (e) {
        console.warn('[music] inviteAiListenTogether failed', e);
        return { ok: false, message: e?.message || '邀请失败' };
    }
}

// ---------------------------------------------------------------------------
// 音乐分享 → Nook
//
// 「分享给 AI」要让 AI 真的知道这件事，所以除了往聊天里发卡片，还要写进
// prompt 体系。注意目标是 sdk.replyPrompts 而不是 nookSdk.prompts：
//   - prompt-manager 的「Nook」折叠组展示的就是 replyPrompts
//   - 只有 replyPrompts 会进 activeList → orderedCards → 最终 pre
//   - nookSdk.prompts(aiPerson.nookPrompts[]) 是另一套数据，历史上正是因为
//     写错这边导致「保存了但 prompt 不变」，别再踩（见 docs/AGENTS2.md）
// 一个 AI 只维护一张卡，反复分享是更新内容而不是不停加卡。
// ---------------------------------------------------------------------------

const MUSIC_SHARE_PROMPT_ID = 'rp-music-shared';
const MAX_SHARED_ITEMS = 12;

function _findAi(sdk, aiId) {
    if (typeof sdk.aiPersons.get === 'function') return sdk.aiPersons.get(aiId);
    if (typeof sdk.aiPersons.list === 'function') {
        return (sdk.aiPersons.list() || []).find((p) => p.id === aiId) || null;
    }
    return null;
}

function _fmtDate(ts) {
    const d = new Date(Number(ts) || Date.now());
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function _buildMusicSharePromptContent(songs, playlists) {
    const lines = ['# 音乐分享', '', '用户跟你分享过这些音乐，聊天时可以自然提起：'];
    songs.slice(0, MAX_SHARED_ITEMS).forEach((s) => {
        lines.push(`- 《${s.title || '未知歌曲'}》- ${s.artist || '未知歌手'}（${_fmtDate(s.sharedAt)} 分享）`);
    });
    playlists.slice(0, MAX_SHARED_ITEMS).forEach((p) => {
        const names = Array.isArray(p.songNames) && p.songNames.length
            ? `：${p.songNames.slice(0, 4).join(' / ')}`
            : '';
        lines.push(`- 歌单「${p.name || '未命名'}」（${Number(p.songCount) || (p.songIds || []).length} 首${names}）`);
    });
    lines.push('');
    lines.push('用户说「我分享给你的那首歌」时，指的就是上面这些。可以聊聊感受、问问为什么喜欢，别装作不知道。');
    return lines.join('\n');
}

/** 把该 AI 的「音乐分享」卡片刷成最新（没有就建，有就更新） */
async function _syncMusicSharePrompt(sdk, ai) {
    const api = sdk?.replyPrompts;
    if (!api?.list) return;
    const bound = ai.boundResources || {};
    const songs = Array.isArray(bound.sharedSongs) ? bound.sharedSongs : [];
    const playlists = Array.isArray(bound.sharedPlaylists) ? bound.sharedPlaylists : [];
    if (songs.length === 0 && playlists.length === 0) return;

    const content = _buildMusicSharePromptContent(songs, playlists);
    const existing = api.get?.(ai.id, MUSIC_SHARE_PROMPT_ID);
    try {
        if (existing) {
            await api.update(ai.id, MUSIC_SHARE_PROMPT_ID, { content });
        } else {
            await api.add(ai.id, {
                id: MUSIC_SHARE_PROMPT_ID,
                title: '音乐分享',
                content,
                source: 'music',
                active: true,
            });
        }
        // prompt-manager 开着时让它重画
        try {
            window.invalidateRendererCache?.('chat', null);
            window.__appRendererBridge?.syncNow?.({ force: true });
        } catch (_) { /* noop */ }
    } catch (e) {
        console.warn('[music] 同步音乐分享 prompt 失败', e);
    }
}

/**
 * 分享单曲给 AI：写 boundResources.sharedSongs + 刷新 Nook 里的「音乐分享」卡
 * @param {Object} opts {aiId, song}
 */
export async function shareSongToAi(opts) {
    const sdk = await _getSdk();
    if (!sdk?.aiPersons) return { ok: false, message: 'settingsSdk 未就绪' };
    const { aiId, song } = opts || {};
    if (!aiId || !song) return { ok: false, message: '缺少参数' };

    try {
        const ai = _findAi(sdk, aiId);
        if (!ai) return { ok: false, message: '找不到 AI 人设' };
        const boundResources = { ...(ai.boundResources || {}) };
        const prev = Array.isArray(boundResources.sharedSongs) ? boundResources.sharedSongs : [];
        // 同一首重复分享只更新时间，最新的排前面
        const next = [
            { songId: song.id, title: song.title, artist: song.artist, sharedAt: Date.now() },
            ...prev.filter((s) => String(s.songId) !== String(song.id)),
        ].slice(0, MAX_SHARED_ITEMS);
        boundResources.sharedSongs = next;
        await sdk.aiPersons.update?.(ai.id, { boundResources });
        await _syncMusicSharePrompt(sdk, { ...ai, boundResources });
        return { ok: true, message: `已分享给 ${ai.name || 'AI'}` };
    } catch (e) {
        console.warn('[music] shareSongToAi failed', e);
        return { ok: false, message: e?.message || '分享失败' };
    }
}

/**
 * 分享歌单给 AI
 * @param {Object} opts {aiId, playlistId, playlistName, songIds, songNames}
 */
export async function sharePlaylistToAi(opts) {
    const sdk = await _getSdk();
    if (!sdk?.aiPersons) return { ok: false, message: 'settingsSdk 未就绪' };
    const { aiId, playlistId, playlistName, songIds, songNames } = opts || {};
    if (!aiId) return { ok: false, message: '缺少 aiId' };

    try {
        const ai = _findAi(sdk, aiId);
        if (!ai) return { ok: false, message: '找不到 AI 人设' };
        const boundResources = { ...(ai.boundResources || {}) };
        const prev = Array.isArray(boundResources.sharedPlaylists) ? boundResources.sharedPlaylists : [];
        const entry = {
            playlistId,
            name: playlistName,
            songIds: Array.isArray(songIds) ? songIds : [],
            songNames: Array.isArray(songNames) ? songNames : [],
            songCount: Array.isArray(songIds) ? songIds.length : 0,
            sharedAt: Date.now(),
        };
        boundResources.sharedPlaylists = [
            entry,
            ...prev.filter((p) => String(p.playlistId) !== String(playlistId)),
        ].slice(0, MAX_SHARED_ITEMS);
        await sdk.aiPersons.update?.(ai.id, { boundResources });
        await _syncMusicSharePrompt(sdk, { ...ai, boundResources });
        return { ok: true, message: `已分享「${playlistName}」给 ${ai.name || 'AI'}` };
    } catch (e) {
        console.warn('[music] sharePlaylistToAi failed', e);
        return { ok: false, message: e?.message || '分享失败' };
    }
}

/**
 * 读取 AI 的"为一起听准备的歌曲"(AI 切歌用)
 * @param {string} aiId
 * @returns {Promise<Array<number>>}
 */
export async function getAiListenTogetherSongs(aiId) {
    const sdk = await _getSdk();
    if (!sdk?.aiPersons) return [];
    try {
        let ai = null;
        if (typeof sdk.aiPersons.get === 'function') {
            ai = sdk.aiPersons.get(aiId);
        } else if (Array.isArray(sdk.aiPersons.list)) {
            ai = sdk.aiPersons.list().find((p) => p.id === aiId);
        }
        if (!ai) return [];
        return Array.isArray(ai?.boundResources?.listenTogetherSongs)
            ? ai.boundResources.listenTogetherSongs
            : [];
    } catch (_) { return []; }
}