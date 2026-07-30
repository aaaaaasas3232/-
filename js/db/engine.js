/**
 * 小听 - IndexedDB 引擎
 * 提供动态 store 注册、CRUD、事务封装、批量操作
 * 不直接创建任何数据库实例——交给 store 配置文件去做
 */
export class ListenDb {
    constructor({ dbName = 'listen_db', dbVersion = 1 } = {}) {
        this.db = null;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
        this.ready = null;
        this._pendingStores = [];
        this._baseStores = [];
    }

    registerStore(storeName, keyPath = 'id') {
        if (!storeName) {
            return;
        }

        // Already in the open database — nothing to do
        if (this._hasOpenStore(storeName)) {
            return;
        }

        // Track the store if not already known (avoid duplicate pending entries)
        if (!this._hasStoreDefinition(storeName)) {
            this._pendingStores.push({ name: storeName, keyPath });
        }

        // Database is open but missing this store (e.g. the DB was created
        // with an older schema). Close it, bump the version so that
        // onupgradeneeded fires on the next open, and reopen.
        if (this.db) {
            const nextVersion = this.db.version + 1;
            this.close();
            this.dbVersion = Math.max(this.dbVersion + 1, nextVersion);
            this.ready = null;
            this.open().catch(() => {});
        }
    }

    appendBaseStore(storeName, keyPath = 'id') {
        if (this._baseStores.some(store => store.name === storeName)) {
            return;
        }
        this._baseStores.push({ name: storeName, keyPath });
    }

    open() {
        if (this.ready) {
            return this.ready;
        }

        // Ensure the version is high enough to include every store (base + pending).
        // IndexedDB only fires onupgradeneeded when the requested version is
        // strictly greater than the version already on disk.
        const neededVersion = this._baseStores.length + this._pendingStores.length;
        if (neededVersion > this.dbVersion) {
            this.dbVersion = neededVersion;
            // If already open at a lower version, close and reopen
            if (this.db) {
                this.close();
                this.ready = null;
            }
        }

        this.ready = this._openWithVersion(this.dbVersion).catch(error => {
            if (error?.name === 'VersionError') {
                // 磁盘上的 db version 高于内存里记的 dbVersion（其它 tab 已升级过 / 旧 db 残留）。
                // 不必报错，直接无参 open() 拿到当前最新版即可。
                console.debug('[ListenDb.open] dbVersion', this.dbVersion, '低于磁盘版本，回落到最新版本打开');
                return this._openWithVersion();
            }
            throw error;
        }).catch(error => {
            this.ready = null;
            throw error;
        });

        return this.ready;
    }

    _openWithVersion(version) {
        return new Promise((resolve, reject) => {
            const request = version ? indexedDB.open(this.dbName, version) : indexedDB.open(this.dbName);

            request.onerror = e => {
                const error = request.error || e?.target?.error || null;
                const isVersionConflict = error?.name === 'VersionError';
                if (isVersionConflict) {
                    console.debug('[ListenDb] 数据库版本冲突（请求', version, '但磁盘更高），将回落最新版本');
                } else {
                    console.error('[ListenDb] 数据库打开失败', {
                        dbName: this.dbName,
                        version: version || 'latest',
                        errorName: error?.name || 'UnknownError',
                        errorMessage: error?.message || '',
                        event: e,
                    });
                }
                reject(error || e);
            };

            request.onblocked = () => {
                console.warn('[ListenDb] 数据库升级被阻塞', {
                    dbName: this.dbName,
                    version: version || 'latest',
                });
            };

            request.onupgradeneeded = e => {
                const db = e.target.result;
                const allStores = [...this._baseStores, ...this._pendingStores];

                for (const store of allStores) {
                    if (!db.objectStoreNames.contains(store.name)) {
                        db.createObjectStore(store.name, { keyPath: store.keyPath });
                    }
                }
                this._pendingStores = [];
            };

            request.onsuccess = e => {
                this.db = e.target.result;
                this.dbVersion = this.db.version;
                this.db.onversionchange = () => {
                    this.close();
                };
                resolve(this.db);
            };
        });
    }

    async add(storeName, data) {
        return this._request(storeName, 'readwrite', store => store.add(data));
    }

    async get(storeName, key) {
        return this._request(storeName, 'readonly', store => store.get(key));
    }

    async getAll(storeName, query) {
        return this._request(storeName, 'readonly', store => store.getAll(query));
    }

    async getAllRecords(storeName) {
        return this._request(storeName, 'readonly', store => store.getAll());
    }

    async remove(storeName, key) {
        return this._request(storeName, 'readwrite', store => store.delete(key));
    }

    async put(storeName, data) {
        return this._request(storeName, 'readwrite', store => store.put(data));
    }

    async clear(storeName) {
        return this._request(storeName, 'readwrite', store => store.clear());
    }

    async count(storeName) {
        return this._request(storeName, 'readonly', store => store.count());
    }

    getStoreNames() {
        if (!this.db) return [];
        return Array.from(this.db.objectStoreNames);
    }

    findOne(storeName, predicate) {
        return new Promise((resolve, reject) => {
            try {
                this._exec(storeName, 'readonly', store => {
                    const request = store.openCursor();
                    request.onsuccess = e => {
                        const cursor = e.target.result;
                        if (!cursor) {
                            resolve(undefined);
                            return;
                        }
                        if (predicate(cursor.value)) {
                            resolve(cursor.value);
                            return;
                        }
                        cursor.continue();
                    };
                    request.onerror = e => reject(e);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    find(storeName, predicate) {
        return new Promise((resolve, reject) => {
            const results = [];
            try {
                this._exec(storeName, 'readonly', store => {
                    const request = store.openCursor();
                    request.onsuccess = e => {
                        const cursor = e.target.result;
                        if (!cursor) {
                            resolve(results);
                            return;
                        }
                        if (predicate(cursor.value)) {
                            results.push(cursor.value);
                        }
                        cursor.continue();
                    };
                    request.onerror = e => reject(e);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    bulkPut(storeName, list = []) {
        return new Promise((resolve, reject) => {
            try {
                this._exec(storeName, 'readwrite', (store, tx) => {
                    list.forEach(item => store.put(item));
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = e => reject(e);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    _exec(storeName, mode, callback) {
        if (!this.db) {
            throw new Error('[ListenDb] 数据库未初始化，请先调用 open()');
        }
        const tx = this.db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        return callback(store, tx);
    }

    _request(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            try {
                const request = this._exec(storeName, mode, store => callback(store));
                request.onsuccess = () => resolve(request.result);
                request.onerror = e => reject(e);
            } catch (error) {
                reject(error);
            }
        });
    }

    _hasStoreDefinition(storeName) {
        return this._baseStores.some(store => store.name === storeName)
            || this._pendingStores.some(store => store.name === storeName);
    }

    _hasOpenStore(storeName) {
        return Boolean(this.db?.objectStoreNames?.contains(storeName));
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.ready = null;
    }

    /**
     * 显式保证 db schema 包含所有 _baseStores / _pendingStores。
     * 若 db 还没打开 -> 调 open()。
     * 若 db 已打开但缺 store -> bump version + close + open()。
     *
     * 用于 app 注册后 / 新增 store 后强制升级 IndexedDB schema。
     */
    async ensureSchema() {
        if (!this.db) {
            return this.open();
        }
        const wanted = [...this._baseStores, ...this._pendingStores];
        const existing = Array.from(this.db.objectStoreNames || []);
        const missing = wanted.filter(s => !existing.includes(s.name));
        const currentVersion = this.db.version || 0;
        if (missing.length === 0) {
            console.debug('[ListenDb.ensureSchema] schema 已是最新，共', wanted.length, '个 store, version=', currentVersion);
            return this.db;
        }
        console.log('[ListenDb.ensureSchema] 缺 store:', missing.map(s => s.name), '| 当前 version=', currentVersion);
        // ★ v0.18.1 直接用「store 数」做新 version（确保一定 > 当前 version，触发 onupgradeneeded）
        const nextVersion = Math.max(currentVersion + 1, this._baseStores.length + this._pendingStores.length + 1);
        console.log('[ListenDb.ensureSchema] 升级 version', currentVersion, '->', nextVersion);
        this.close();
        this.dbVersion = nextVersion;
        return this.open();
    }
}