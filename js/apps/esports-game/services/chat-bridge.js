/**
 * 赛点 · murmur 桥
 *
 * 游戏邀请 / 战绩分享 / 他人战绩八卦 —— 全部以「用户发的文字消息」写进
 * murmur 会话（不发明新卡片类型，AI 从消息文本里就能读懂并接话）。
 * 必须能在赛点没打开过的情况下工作：不 import store，只写消息。
 */

const VALID_MODES = new Set(['calendar', 'story']);

function resolveMode(aiId, preferred) {
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

async function addChatMessage(aiId, text, mode) {
    const sdk = typeof window !== 'undefined' ? window.settingsSdk : null;
    if (!sdk?.chatMessages?.add || !aiId) return null;
    try {
        return await sdk.chatMessages.add(null, aiId, resolveMode(aiId, mode), {
            sender: 'user',
            type: 'text',
            content: String(text || ''),
        });
    } catch (err) {
        console.warn('[esports-game] 写聊天消息失败', err);
        return null;
    }
}

function pokeChat() {
    try {
        window.invalidateRendererCache?.('chat', null);
        window.__appRendererBridge?.syncNow?.({ force: true });
    } catch (_) { /* noop */ }
}

/** 游戏邀请：发给某个 AI 的私聊 */
export async function sendGameInvite({ aiId, gameName, modeLabel, note }) {
    if (!aiId) return null;
    const lines = [
        `「游戏邀请」一起打《${gameName}》的${modeLabel}吗？`,
        note ? `留言：${note}` : '',
    ].filter(Boolean);
    const record = await addChatMessage(aiId, lines.join('\n'));
    pokeChat();
    return record;
}

/** 分享一次排位概要 */
export async function shareSessionToChat({ aiId, gameName, session, note }) {
    if (!aiId || !session) return null;
    const lines = [
        `「战绩分享」今天的${session.modeLabel}：${session.wins}胜${session.losses}负，巅峰分 ${session.ratingAfter}（${session.ratingDelta >= 0 ? '+' : ''}${session.ratingDelta}）`,
        `——来自《${gameName}》`,
        note ? note : '',
    ].filter(Boolean);
    const record = await addChatMessage(aiId, lines.join('\n'));
    pokeChat();
    return record;
}

/** 分享单局（可以拿去问 AI：这把怎么回事） */
export async function shareMatchToChat({ aiId, gameName, match, modeLabel, note }) {
    if (!aiId || !match) return null;
    const lines = [
        `「对局分享」${modeLabel}第${match.seq}局 ${match.win ? '赢了' : '输了'}：${match.hero}（${match.kdaText}）${match.mvp ? ' · MVP' : ''}`,
        `——来自《${gameName}》`,
        note ? note : '',
    ].filter(Boolean);
    const record = await addChatMessage(aiId, lines.join('\n'));
    pokeChat();
    return record;
}

/** 分享别人的今日战绩（拿去八卦 / 制造危机感） */
export async function shareRecordToChat({ aiId, gameName, record, note }) {
    if (!aiId || !record) return null;
    const lines = [
        `「战绩围观」${record.name} 今天打了 ${record.games} 把：${record.wins}胜${record.losses}负${record.lateNight ? '（还熬夜打到后半夜）' : ''}`,
        `——来自《${gameName}》`,
        note ? note : '',
    ].filter(Boolean);
    const row = await addChatMessage(aiId, lines.join('\n'));
    pokeChat();
    return row;
}
