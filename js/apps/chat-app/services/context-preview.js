/*
 * chat-app / 当前上下文 pre 存储
 *
 * 这里不拼装 prompt。prompt-manager 负责生成最终 pre，本服务只保存和读取
 * 那份最终文本，让私聊页/通话页在 prompt-manager DOM 不存在时仍能发送同一份内容。
 */

const _previews = new Map();
const STORAGE_PREFIX = 'xiaoting::chat-context-preview-v1::';

function makeKey(aiPersonId, mode) {
    return `${aiPersonId || ''}::${mode || 'calendar'}`;
}

function makeStorageKey(aiPersonId, mode) {
    return `${STORAGE_PREFIX}${encodeURIComponent(aiPersonId || '')}::${mode || 'calendar'}`;
}

function persistEntry(aiPersonId, mode, entry) {
    try {
        localStorage.setItem(makeStorageKey(aiPersonId, mode), JSON.stringify(entry));
    } catch (_) {}
}

function readPersistedEntry(aiPersonId, mode) {
    try {
        const raw = localStorage.getItem(makeStorageKey(aiPersonId, mode));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed.text === 'string' ? parsed : null;
    } catch (_) {
        return null;
    }
}

/** 保存 prompt-manager 已经生成好的最终 pre。 */
export function writeContextPreview(aiPersonId, mode, text) {
    if (!aiPersonId) return;
    const entry = {
        text: String(text || ''),
    };
    _previews.set(makeKey(aiPersonId, mode), entry);
    persistEntry(aiPersonId, mode, entry);
}

/**
 * 读取最终 pre：先读当前 aiPersonId + mode 的镜像，再读当前 DOM。
 * 不会退回其他 AI 人设的缓存，避免串人设。
 */
export function readContextPreview({ aiPersonId, mode = 'calendar' } = {}) {
    if (aiPersonId) {
        const key = makeKey(aiPersonId, mode);
        const cached = _previews.get(key) || readPersistedEntry(aiPersonId, mode);
        if (cached) _previews.set(key, cached);
        if (cached?.text) return cached.text;
    }

    try {
        const managers = document.querySelectorAll(
            '.app-shell[data-app-id="chat"] .prompt-manager[data-ai-person-id]'
        );
        for (const manager of managers) {
            if (aiPersonId && manager.dataset.aiPersonId !== String(aiPersonId)) continue;
            if (mode && manager.dataset.chatMode !== String(mode)) continue;
            const pre = manager.querySelector('.pm-context-preview__raw');
            const text = (pre?.textContent || pre?.innerText || '').trim();
            if (text) return text;
        }
    } catch (_) {}

    return '';
}
