/**
 * settings-sdk · 默认用户卡 (Default User Card) v0.23
 *
 *   业务含义：Murmur、chat 等社媒 App 默认从「默认用户卡」读取「我」是谁，
 *   区别于「当前激活用户卡」（activeUserId，UI 编辑器用）。
 *   - 默认卡：每个 User 实例自带 isDefaultUserCard 标记（true 只能有一个）。
 *   - 设默认 = 清除其他所有 User 的 isDefaultUserCard，再给目标写 true。
 *   - 删除/移除默认卡 = 默认卡变为 null（getDefault 兜底返回 activeUser）。
 *
 *   存储：
 *     - isDefaultUserCard 字段在 sdkUsers 每条记录上
 *     - 不再单独存 activeDefaultUser key（避免两份状态不同步）
 *
 *   API：
 *     getDefault()                    返回默认 User 实例（兜底 activeUser）
 *     getDefaultId()                  返回默认 User id
 *     setDefault(userId)              切默认卡（异步落盘 + emit）
 *     clearDefault()                  清除默认卡
 *     listWithDefault()               所有 User + 默认标记（false 表示非默认）
 *     isDefault(userId)               单条判断
 */

const DEFAULT_FIELD = 'isDefaultUserCard';

/**
 * 在缓存里挑出默认卡（isDefaultUserCard === true）。如果没有任何卡标 true，
 * 兜底返回传入的 activeUser（让 UI 不至于空白）。
 */
function pickDefault(cacheUsers, fallbackUser) {
    for (const u of cacheUsers.values()) {
        if (u && u[DEFAULT_FIELD] === true) return u;
    }
    return fallbackUser || null;
}

export function createDefaultUserCardApi({ cache, events, bump, getActiveUser }) {
    return {
        getDefault() {
            const users = cache?.users;
            if (!users) return null;
            return pickDefault(users, getActiveUser ? getActiveUser() : null);
        },

        getDefaultId() {
            const u = this.getDefault();
            return u?.id || null;
        },

        isDefault(userId) {
            const users = cache?.users;
            const u = users?.get(userId);
            return !!(u && u[DEFAULT_FIELD] === true);
        },

        listWithDefault() {
            const users = cache?.users;
            if (!users) return [];
            return Array.from(users.values()).map((u) => ({
                ...u,
                _isDefault: u[DEFAULT_FIELD] === true,
            }));
        },

        /**
         * 把 userId 设为默认。先清除所有其他 User 的标记，
         * 再给目标写 true。两者都落盘（如果 toolkit.db 可用）。
         */
        async setDefault(userId) {
            const users = cache?.users;
            const target = users?.get(userId);
            if (!target || !users) return null;

            const t = Date.now();
            const updates = [];
            for (const [id, u] of users) {
                const nextFlag = id === userId ? true : false;
                if (u[DEFAULT_FIELD] === nextFlag) continue;
                const next = { ...u, [DEFAULT_FIELD]: nextFlag, updatedAt: t };
                users.set(id, next);
                updates.push(next);
            }

            // 异步落盘：批量 put
            const toolkit = this._toolkit;
            if (toolkit?.db && updates.length) {
                try {
                    await toolkit.db.bulkPut('sdkUsers', updates);
                } catch (err) {
                    console.warn('[defaultUserCard] bulkPut failed:', err);
                }
            }

            bump('defaultUserCard', 'setDefault', { userId });
            return users.get(userId);
        },

        /**
         * 清除默认卡（只把当前默认卡标记改 false）。
         * 不会动其他字段。
         */
        async clearDefault() {
            const users = cache?.users;
            if (!users) return false;
            const cur = pickDefault(users, null);
            if (!cur) return false;

            const t = Date.now();
            const next = { ...cur, [DEFAULT_FIELD]: false, updatedAt: t };
            users.set(cur.id, next);

            const toolkit = this._toolkit;
            if (toolkit?.db) {
                try {
                    await toolkit.db.put('sdkUsers', next);
                } catch (err) {
                    console.warn('[defaultUserCard] put failed:', err);
                }
            }

            bump('defaultUserCard', 'clearDefault', { userId: cur.id });
            return true;
        },

        /**
         * 用户删除时调用：如果删的就是默认卡，自动尝试 fallback 到
         * 当前 activeUser（保持「总有一个默认」语义）。
         */
        async onUserRemoved(userId) {
            const users = cache?.users;
            const u = users?.get(userId);
            if (!u || u[DEFAULT_FIELD] !== true) return false;

            const t = Date.now();
            const next = { ...u, [DEFAULT_FIELD]: false, updatedAt: t };
            users.set(userId, next);
            const toolkit = this._toolkit;
            if (toolkit?.db) {
                try { await toolkit.db.put('sdkUsers', next); } catch {}
            }

            // 如果有 activeUser 不是被删的那个，让它当默认
            const active = getActiveUser ? getActiveUser() : null;
            if (active && active.id !== userId) {
                return this.setDefault(active.id);
            }
            return true;
        },

        _setToolkit(toolkit) {
            this._toolkit = toolkit;
        },

        DEFAULT_FIELD,
    };
}