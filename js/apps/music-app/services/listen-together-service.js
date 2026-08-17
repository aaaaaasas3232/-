/**
 * music-app · services/listen-together-service.js
 * 一起听 session 管理(IndexedDB)。
 *
 * 自建 store:listenTogetherSessions(已在 appConfig.stores 声明)
 * 模拟旧版 PhoneCore.activity.startActivity / endActivity / getAllRecords。
 */

const STORE = 'listenTogetherSessions';

function _getDb(app) {
    if (app?.toolkit?.db) return app.toolkit.db;
    if (typeof window !== 'undefined' && window.myDb) return window.myDb;
    return null;
}

/**
 * 启动 session
 * @param {Object} app
 * @param {Object} session {sessionId, aiId, aiName, startTime}
 * @returns {Promise<boolean>}
 */
export async function startListenTogether(app, session) {
    const db = _getDb(app);
    if (!db || !session) return false;
    const record = {
        ...session,
        active: true,
        startTime: session.startTime || Date.now(),
    };
    try {
        if (typeof db.put === 'function') {
            await db.put(STORE, record);
            return true;
        }
    } catch (e) {
        console.warn('[music] startListenTogether failed', e);
    }
    return false;
}

/**
 * 结束 session
 * @param {Object} app
 * @param {string} sessionId
 * @param {Object} updates {endTime, summary, duration, songCount}
 * @returns {Promise<boolean>}
 */
export async function endListenTogether(app, sessionId, updates = {}) {
    const db = _getDb(app);
    if (!db) return false;
    try {
        let record = null;
        if (typeof db.get === 'function') {
            record = await db.get(STORE, sessionId);
        }
        if (!record) {
            record = { sessionId, active: false, ...updates };
        } else {
            record.active = false;
            record.endTime = updates.endTime || Date.now();
            if (updates.summary) record.summary = updates.summary;
            if (updates.duration) record.duration = updates.duration;
            if (updates.songCount) record.songCount = updates.songCount;
        }
        if (typeof db.put === 'function') {
            await db.put(STORE, record);
            return true;
        }
    } catch (e) {
        console.warn('[music] endListenTogether failed', e);
    }
    return false;
}

/**
 * 读取所有 sessions
 * @param {Object} app
 * @returns {Promise<Array>}
 */
export async function getListenTogetherSessions(app) {
    const db = _getDb(app);
    if (!db) return [];
    try {
        if (typeof db.getAll === 'function') {
            const list = await db.getAll(STORE);
            return Array.isArray(list) ? list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)) : [];
        }
    } catch (e) {
        console.warn('[music] getListenTogetherSessions failed', e);
    }
    return [];
}

/**
 * 读取当前 active session
 */
export async function getActiveListenTogether(app) {
    const list = await getListenTogetherSessions(app);
    return list.find((s) => s.active) || null;
}

/**
 * 生成新 sessionId
 */
export function generateSessionId() {
    return `lt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}