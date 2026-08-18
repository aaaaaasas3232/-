/**
 * murmur · 回复提示词的开关存储(整组开关 + 卡片开关)
 *
 * ── 为什么单独一份 ────────────────────────────────────────────────
 *
 * prompt-manager 里每加一张卡就复制一遍「读内存 → 空了读 localStorage → 回填内存」
 * 的三段式,现在已经有七份几乎一样的代码(systemPromptInject / replyFormatInject /
 * userMomentsInject / aiMomentsInject / contextModeInject / memorySummaryInject /
 * stickerLibraryInject)。整组开关和实时卡开关不再复制第八、第九份。
 *
 * 更要紧的理由:**发送时还要再查一次**。一起听 / 四叶草 / 灯塔 / 日记这四段是
 * `ai-service` 在发送前现算再追加的,预览里关掉了发送时也必须不追加。而 ai-service
 * 拿不到 `app.state`。放在模块级单例 + localStorage,预览端和发送端读的是同一份,
 * 不存在「界面关了、AI 照样收到」。
 *
 * ── 存储形状 ──────────────────────────────────────────────────────
 *
 *   组开关   xiaoting::chat-prompt-group-inject-v1
 *            { [ownerKey]: { [source]: boolean } }      source = 'nook' | 'murmur' | appId
 *   卡片开关 xiaoting::chat-prompt-card-inject-v1
 *            { [ownerKey]: { [cardId]: boolean } }
 *
 *   ownerKey 私聊是 aiPersonId,群聊是 `group::<groupId>` —— 和 contextOrder 一个口径,
 *   免得两套 key 在同一份数据里撞车。
 *
 * 两张表都是「缺省 = 开」:没写过的 key 一律当启用,所以老用户升级上来什么都不会被关掉。
 */

const GROUP_STORAGE_KEY = 'xiaoting::chat-prompt-group-inject-v1';
const CARD_STORAGE_KEY = 'xiaoting::chat-prompt-card-inject-v1';

/** null = 还没从 localStorage 读过 */
let _groupMap = null;
let _cardMap = null;

function readStore(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (_) {
        return {};
    }
}

function writeStore(key, map) {
    try {
        localStorage.setItem(key, JSON.stringify(map));
    } catch (_) { /* 隐私模式 / 配额满:内存那份仍然生效 */ }
}

function groupMap() {
    if (!_groupMap) _groupMap = readStore(GROUP_STORAGE_KEY);
    return _groupMap;
}

function cardMap() {
    if (!_cardMap) _cardMap = readStore(CARD_STORAGE_KEY);
    return _cardMap;
}

/**
 * 私聊 → aiPersonId;群聊 → `group::<groupId>`。
 * 和 prompt-manager 里 contextOrder 的 owner key 保持完全一致。
 */
export function makeOwnerKey({ aiPersonId = '', isGroup = false, groupId = '' } = {}) {
    if (isGroup && groupId) return `group::${groupId}`;
    return String(aiPersonId || '');
}

// ============================================================
// 整组开关
// ============================================================

/** 这一组是否参与拼装(缺省开) */
export function isGroupEnabled(ownerKey, source) {
    const key = String(ownerKey || '');
    const src = String(source || '');
    if (!key || !src) return true;
    return groupMap()[key]?.[src] !== false;
}

/** 显式设置某组,返回设置后的值 */
export function setGroupEnabled(ownerKey, source, enabled) {
    const key = String(ownerKey || '');
    const src = String(source || '');
    if (!key || !src) return true;
    const map = groupMap();
    if (!map[key]) map[key] = {};
    map[key][src] = enabled !== false;
    writeStore(GROUP_STORAGE_KEY, map);
    return map[key][src];
}

/** 翻转某组,返回翻转后的值 */
export function toggleGroupEnabled(ownerKey, source) {
    return setGroupEnabled(ownerKey, source, !isGroupEnabled(ownerKey, source));
}

// ============================================================
// 卡片开关(只服务本轮新增的卡:总纲 + 四张实时卡)
//   老卡片各有各的 localStorage key,不动它们 —— 迁移的收益抵不上迁移的风险。
// ============================================================

export function isCardEnabled(ownerKey, cardId) {
    const key = String(ownerKey || '');
    const id = String(cardId || '');
    if (!key || !id) return true;
    return cardMap()[key]?.[id] !== false;
}

export function setCardEnabled(ownerKey, cardId, enabled) {
    const key = String(ownerKey || '');
    const id = String(cardId || '');
    if (!key || !id) return true;
    const map = cardMap();
    if (!map[key]) map[key] = {};
    map[key][id] = enabled !== false;
    writeStore(CARD_STORAGE_KEY, map);
    return map[key][id];
}

export function toggleCardEnabled(ownerKey, cardId) {
    return setCardEnabled(ownerKey, cardId, !isCardEnabled(ownerKey, cardId));
}

/** 单测 / 探针用:把两张表恢复到「什么都没写过」 */
export function _resetPromptToggles() {
    _groupMap = {};
    _cardMap = {};
    writeStore(GROUP_STORAGE_KEY, _groupMap);
    writeStore(CARD_STORAGE_KEY, _cardMap);
}

export default {
    makeOwnerKey,
    isGroupEnabled,
    setGroupEnabled,
    toggleGroupEnabled,
    isCardEnabled,
    setCardEnabled,
    toggleCardEnabled,
};
