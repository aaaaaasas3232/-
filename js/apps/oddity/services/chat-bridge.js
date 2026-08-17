/**
 * 小奇怪 · 往 murmur 发战绩卡
 *
 * ── 复用而不是新造(用户原话「能复用就复用」)────────────────────────
 *
 * murmur 已经有一张 `type: 'game_record'` 的战绩卡(群聊小游戏在用):
 *   - 渲染器:js/apps/chat-app/components/game-cards.js
 *   - 注册表:message-renderer.js 的 cardMessageRenderers
 *   - 详情页:按消息 id 全局查(`sdk.chatMessages.get(msgId)`),
 *     所以发进**私聊**一样能点开看名单
 *
 * 这里只做写入侧,三处对齐里的另外两处一个都不用动。
 * 写法照抄 music-app/services/chat-bridge.js:只依赖 settingsSdk,
 * 不 import chat-app,chat 没装也不会炸。
 */

import { asArray, truncate } from '../utils.js';
import * as nook from './nook-bridge.js';

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

function pokeChatUi() {
    try {
        window.invalidateRendererCache?.('chat', null);
        window.__appRendererBridge?.syncNow?.({ force: true });
    } catch (_) { /* noop */ }
}

/**
 * 把三种游戏的终局压成 murmur 认识的 gameRecord。
 *
 * @param {object} opts
 * @param {'minesweeper'|'gomoku'|'haveyou'} opts.kind
 * @param {object} opts.state  引擎的终局 state
 * @returns {object|null}
 */
export function buildRecord({ kind, state } = {}) {
    if (!state) return null;

    if (kind === 'minesweeper') {
        const players = asArray(state.players).map((p) => ({
            id: p.id,
            name: p.name,
            isUser: p.kind !== 'ai',
            roleLabel: `${state.scores?.[p.id] ?? 0} 分`,
            win: state.winner === p.id,
        }));
        const { p1 = 0, p2 = 0 } = state.scores || {};
        return {
            id: `oq-ms-${state.startedAt || Date.now()}`,
            gameId: 'oq-minesweeper',
            gameName: '扫雷 · 小奇怪',
            tone: 'blue',
            rounds: state.moveCount || 0,
            durationMs: Math.max(0, (state.finishedAt || Date.now()) - (state.startedAt || Date.now())),
            winner: state.winner || 'none',
            winnerLabel: state.winner === 'draw'
                ? `打平,${p1} : ${p2}`
                : `${players.find((p) => p.id === state.winner)?.name || '?'}赢了,${Math.max(p1, p2)} : ${Math.min(p1, p2)}`,
            summary: `9×9 扫了 ${state.moveCount} 步,踩出 ${asArray(state.cells).filter((c) => c.mine && c.revealed).length} 颗雷。`,
            godMode: false,
            players,
            highlights: asArray(state.log).filter((l) => l.kind === 'mine').slice(-3).map((l) => l.text),
            endedAt: state.finishedAt || Date.now(),
        };
    }

    if (kind === 'gomoku') {
        const players = asArray(state.players).map((p) => ({
            id: p.id,
            name: p.name,
            isUser: p.kind !== 'ai',
            roleLabel: p.id === 'black' ? '执黑' : '执白',
            win: state.winner === p.id,
        }));
        return {
            id: `oq-go-${state.startedAt || Date.now()}`,
            gameId: 'oq-gomoku',
            gameName: '五子棋 · 小奇怪',
            tone: 'violet',
            rounds: state.moveCount || 0,
            durationMs: Math.max(0, (state.finishedAt || Date.now()) - (state.startedAt || Date.now())),
            winner: state.winner || 'none',
            winnerLabel: state.winner === 'draw'
                ? '下满了,平局'
                : `${players.find((p) => p.id === state.winner)?.name || '?'}五连成型`,
            summary: `${state.moveCount} 手分出结果。`,
            godMode: false,
            players,
            highlights: asArray(state.log).filter((l) => l.kind === 'flavor').slice(-3).map((l) => l.text),
            endedAt: state.finishedAt || Date.now(),
        };
    }

    if (kind === 'haveyou') {
        const players = asArray(state.seats).map((s) => ({
            id: s.id,
            name: s.name,
            isUser: s.kind !== 'ai',
            roleLabel: s.alive ? `剩 ${s.lives} 点` : '出局',
            win: state.winnerId === s.id,
        }));
        return {
            id: `oq-hy-${state.startedAt || Date.now()}`,
            gameId: 'oq-haveyou',
            gameName: '你有我没有 · 小奇怪',
            tone: 'amber',
            rounds: Math.max(0, (state.roundNo || 1) - 1),
            durationMs: Math.max(0, (state.finishedAt || Date.now()) - (state.startedAt || Date.now())),
            winner: state.winnerId || 'none',
            winnerLabel: state.winnerId
                ? `${players.find((p) => p.id === state.winnerId)?.name || '?'}是最后活着的`
                : '所有人都出局了',
            summary: `${Math.max(0, (state.roundNo || 1) - 1)} 轮 · ${state.mode === 'local' ? '本地模式' : 'AI 模式'}。`,
            godMode: false,
            players,
            highlights: asArray(state.log).filter((l) => l.kind === 'claim').slice(-3).map((l) => truncate(l.text, 40)),
            endedAt: state.finishedAt || Date.now(),
        };
    }

    return null;
}

/**
 * 发到某个私聊。
 *
 * @param {object} opts { contactId, record, note }
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function shareRecordTo({ contactId, record, note = '' } = {}) {
    if (!contactId || !record) return { ok: false, error: '没有可分享的战绩' };
    const sdk = nook.sdk();
    if (!sdk?.chatMessages?.add) return { ok: false, error: 'murmur 还没就绪,稍后再试' };

    try {
        await sdk.chatMessages.add(null, String(contactId), resolveMode(contactId), {
            sender: 'system',
            senderName: '',
            type: 'game_record',
            content: `[${record.gameName || '小游戏'}战绩]`,
            gameRecord: record,
            timestamp: Date.now(),
        });
        if (note) {
            await sdk.chatMessages.add(null, String(contactId), resolveMode(contactId), {
                sender: 'user',
                type: 'text',
                content: String(note),
            });
        }
        pokeChatUi();
        return { ok: true };
    } catch (err) {
        console.warn('[oddity] 分享战绩失败', err);
        return { ok: false, error: err?.message || '写入聊天失败' };
    }
}

/** 能收战绩卡的联系人(nook 里的 AI 人设) */
export function listShareTargets() {
    return nook.listSeatCandidates(nook.getWorld('', nook.getPlayerCard('')));
}
