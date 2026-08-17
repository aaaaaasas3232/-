// ============================================
// App 数据表 API + 共享记录 API
// 从 apps.js 第 784-915 行提取
// ============================================

import { normalizeTextList } from './escape.js';
import { createActionObject, createDeepLinkAction } from './actions.js';

export const SHARED_STORES = Object.freeze([
    { name: 'sharedRecords', keyPath: 'id' }
]);

function normalizeStoreConfig(storeConfig) {
    if (!storeConfig) {
        return [];
    }

    if (Array.isArray(storeConfig)) {
        return storeConfig
            .map(item => {
                if (typeof item === 'string') {
                    return { name: item, keyPath: 'id' };
                }
                if (item?.name) {
                    // ★ indexes 必须透传：engine.registerStore 支持
                    // { keyPath, indexes: [{name, keyPath, unique?, multiEntry?}] }，
                    // 之前这里丢掉了 indexes，app 声明的索引永远建不出来。
                    const normalized = { name: item.name, keyPath: item.keyPath || 'id' };
                    if (Array.isArray(item.indexes) && item.indexes.length) {
                        normalized.indexes = item.indexes;
                    }
                    return normalized;
                }
                return null;
            })
            .filter(Boolean);
    }

    return [];
}

export { normalizeStoreConfig };

export function createAppDbApi(appId, stores = []) {
    const storeMap = Object.fromEntries(stores.map(store => [store.name, store]));

    function ensureStore(storeName) {
        if (!storeMap[storeName]) {
            throw new Error(`[AppDb:${appId}] 未声明的数据表: ${storeName}`);
        }
        return window.myDb;
    }

    return {
        stores,
        add(storeName, data) {
            return ensureStore(storeName).add(storeName, data);
        },
        get(storeName, key) {
            return ensureStore(storeName).get(storeName, key);
        },
        getAll(storeName, query) {
            return ensureStore(storeName).getAll(storeName, query);
        },
        getAllRecords(storeName) {
            return ensureStore(storeName).getAllRecords(storeName);
        },
        put(storeName, data) {
            return ensureStore(storeName).put(storeName, data);
        },
        remove(storeName, key) {
            return ensureStore(storeName).remove(storeName, key);
        },
        // 插件常写成 db.delete；和 remove 同一条路
        delete(storeName, key) {
            return ensureStore(storeName).remove(storeName, key);
        },
        clear(storeName) {
            return ensureStore(storeName).clear(storeName);
        },
        count(storeName) {
            return ensureStore(storeName).count(storeName);
        },
        bulkPut(storeName, records) {
            return ensureStore(storeName).bulkPut(storeName, records);
        },
        bulkRemove(storeName, keys) {
            return ensureStore(storeName).bulkRemove(storeName, keys);
        }
    };
}

export function createSharedStoreApi(appId) {
    const [sharedStore] = SHARED_STORES;
    const sharedStoreName = sharedStore.name;

    function getSharedDb() {
        if (!window.myDb) {
            return null;
        }
        return window.myDb;
    }

    function createSharedRecord(record = {}) {
        const now = new Date().toISOString();
        const entityType = record.entityType || 'record';
        const entityId = record.entityId || `${appId}-${Date.now()}`;
        return {
            id: record.id || `${entityType}:${entityId}`,
            sourceApp: record.sourceApp || appId,
            targetApp: record.targetApp || '',
            entityType,
            entityId,
            title: record.title || '',
            summary: record.summary || '',
            cover: record.cover || '',
            cardTemplate: record.cardTemplate || 'share-card',
            action: createActionObject(record.action || createDeepLinkAction(record.targetApp || appId, record.pageId || '', { entityType, entityId })),
            payload: record.payload || {},
            tags: normalizeTextList(record.tags),
            createdAt: record.createdAt || now,
            updatedAt: now,
        };
    }

    return {
        storeName: sharedStoreName,
        normalizeRecord: createSharedRecord,
        async put(record) {
            const db = getSharedDb();
            if (!db) {
                return createSharedRecord(record);
            }
            const normalizedRecord = createSharedRecord(record);
            await db.put(sharedStoreName, normalizedRecord);
            return normalizedRecord;
        },
        async get(recordId) {
            const db = getSharedDb();
            if (!db) {
                return null;
            }
            return db.get(sharedStoreName, recordId);
        },
        async getAll(query) {
            const db = getSharedDb();
            if (!db) {
                return [];
            }
            return db.getAll(sharedStoreName, query);
        },
        async listByTarget(targetApp) {
            const records = await this.getAll();
            return (records || []).filter(item => !targetApp || item?.targetApp === targetApp);
        },
    };
}
