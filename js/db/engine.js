/**
 * 小听 - IndexedDB 引擎
 * 提供动态 store 注册、CRUD、事务封装、批量操作
 * 不直接创建任何数据库实例——交给 store 配置文件去做
 */

/**
 * 规范化 store 配置：兼容 'id' | { keyPath, indexes }
 */
function normalizeStoreOptions(keyPathOrOpts) {
    if (keyPathOrOpts && typeof keyPathOrOpts === 'object' && !Array.isArray(keyPathOrOpts)) {
        const opts = { ...keyPathOrOpts };
        if (!opts.keyPath) opts.keyPath = 'id';
        if (!Array.isArray(opts.indexes)) opts.indexes = [];
        return opts;
    }
    return { keyPath: keyPathOrOpts || 'id', indexes: [] };
}

export class ListenDb {
    constructor({ dbName = 'listen_db', dbVersion = 1 } = {}) {
        this.db = null;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
        this.ready = null;
        this._pendingStores = [];
        this._baseStores = [];
        // ★ 防抖：避免重复打「已是最新」「升级中」日志。
        // schema 一旦稳定，连续调 N 次 ensureSchema 也只产生 1 条日志。
        this._lastSchemaLogKey = null;
    }

    /**
     * 注册 store，可附带 indexes。
     * @param {string} storeName
     * @param {string|object} [keyPathOrOpts]
     *   - 传 'id' 这种字符串：当作 keyPath，indexes 空
     *   - 传 { keyPath?: 'id', indexes?: [{name, keyPath, unique?, multiEntry?}] }
     */
    registerStore(storeName, keyPathOrOpts = 'id') {
        if (!storeName) {
            return;
        }

        const opts = normalizeStoreOptions(keyPathOrOpts);

        // Already in the open database — nothing to do
        if (this._hasOpenStore(storeName)) {
            // 同步一下「已声明」的索引（如果磁盘上还没有）—— 但既然 db 已开、
            // 加索引需要重新触发 onupgradeneeded，下面的 upgrade 分支会处理。
            return;
        }

        // Track the store if not already known (avoid duplicate pending entries)
        if (!this._hasStoreDefinition(storeName)) {
            this._pendingStores.push({ name: storeName, ...opts });
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

    /**
     * appendBaseStore(name, keyPath | opts) —— 同 registerStore 但走 _baseStores。
     */
    appendBaseStore(storeName, keyPathOrOpts = 'id') {
        const opts = normalizeStoreOptions(keyPathOrOpts);
        if (this._baseStores.some(store => store.name === storeName)) {
            return;
        }
        this._baseStores.push({ name: storeName, ...opts });
    }

    open() {
        if (this.ready) {
            return this.ready;
        }

        this.ready = this._doOpen();

        return this.ready;
    }

    /**
     * 实际执行打开数据库的逻辑。
     * 处理两种情况：
     * 1. 正常打开：带版本号，触发 onupgradeneeded 创建缺失的 store
     * 2. 回落打开：无版本号，不触发 onupgradeneeded，需要在成功后检测并强制升级
     */
    async _doOpen() {
        // 计算需要的版本号
        const neededVersion = this._baseStores.length + this._pendingStores.length;
        let targetVersion = Math.max(neededVersion, this.dbVersion);

        // 如果已有 db 但需要更高版本，先关闭
        if (this.db && targetVersion > this.db.version) {
            this.close();
            this.ready = null;
        }

        try {
            // 尝试用目标版本打开
            this.db = await this._openWithVersion(targetVersion);

            // 检查回落打开的情况（不带版本号打开）
            if (targetVersion <= this.db.version && this.db.version > 0) {
                // 这种情况说明要么没传版本号，要么传了 ≤ 磁盘版本的号
                // 不触发 onupgradeneeded，需要主动检测并升级
                const existing = Array.from(this.db.objectStoreNames || []);
                const allDefined = [...this._baseStores, ...this._pendingStores];
                const missing = allDefined.filter(s => !existing.includes(s.name));

                if (missing.length > 0) {
                    console.log('[ListenDb] 回落后检测到缺失 store，将强制升级:', missing.map(s => s.name));
                    // 关闭前先把当前 version 存住,避免 close() 把 this.db 置 null 后访问 .version 崩溃
                    const oldVersion = this.db ? this.db.version : this.dbVersion;
                    this.close();
                    this.dbVersion = oldVersion + 1;
                    this.ready = null;
                    try {
                        this.db = await this._openWithVersion(this.dbVersion);
                    } catch (e) {
                        // 升级 open 失败 -> 清掉 ready,让后续 open() 重试
                        this.ready = null;
                        throw e;
                    }
                }
            }

            return this.db;
        } catch (error) {
            if (error?.name === 'VersionError') {
                // 磁盘版本更高，回落到最新版本
                console.debug('[ListenDb.open] dbVersion', this.dbVersion, '低于磁盘版本，回落到最新版本打开');
                this._pendingStores = [];

                // 不带版本号打开（获取当前磁盘版本）
                this.db = await this._openWithVersion(null);

                // 关键修复：回落打开后检测缺失的 store 并强制升级
                const existing = Array.from(this.db.objectStoreNames || []);
                const allDefined = [...this._baseStores, ...this._pendingStores];
                const missing = allDefined.filter(s => !existing.includes(s.name));

                if (missing.length > 0) {
                    console.log('[ListenDb] 回落后检测到缺失 store，将强制升级:', missing.map(s => s.name));
                    // 同样先存 version 再 close,避免 null.version
                    const oldVersion = this.db ? this.db.version : this.dbVersion;
                    this.close();
                    this.dbVersion = oldVersion + 1;
                    this.db = await this._openWithVersion(this.dbVersion);
                }

                return this.db;
            }
            this.ready = null;
            throw error;
        }
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
                // ★ 关键修复：合并所有 store 定义，确保 base + pending 都被处理
                // 如果是 VersionError 后回落的情况，_pendingStores 可能为空，
                // 但磁盘上可能还缺 store，此时仍需检查
                const allStores = [...this._baseStores, ...this._pendingStores];
                // 去重：避免 base 和 pending 中有同名 store
                const seen = new Set();
                const uniqueStores = allStores.filter(s => {
                    if (seen.has(s.name)) return false;
                    seen.add(s.name);
                    return true;
                });

                for (const storeDef of uniqueStores) {
                    let store;
                    if (!db.objectStoreNames.contains(storeDef.name)) {
                        store = db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath });
                    } else {
                        // store 已存在（可能是更早的 schema 创建的，但缺索引）
                        // onupgradeneeded 里允许对已存在的 store 用 transaction.objectStore 获取
                        store = e.target.transaction.objectStore(storeDef.name);
                    }

                    // 同步创建索引
                    if (Array.isArray(storeDef.indexes)) {
                        for (const idx of storeDef.indexes) {
                            if (!idx || !idx.name) continue;
                            if (!store.indexNames.contains(idx.name)) {
                                store.createIndex(idx.name, idx.keyPath || idx.name, {
                                    unique: !!idx.unique,
                                    multiEntry: !!idx.multiEntry,
                                });
                            }
                        }
                    }
                }
                // 清空 pending stores，避免重复处理
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

    /**
     * 通过索引查所有匹配记录。
     * @param {string} storeName
     * @param {string} indexName
     * @param {IDBValidKey|IDBKeyRange} query
     */
    async getAllFromIndex(storeName, indexName, query) {
        return this._request(storeName, 'readonly', store => {
            const index = store.index(indexName);
            return index.getAll(query);
        });
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
            // ★ ensureSchema() 在升级过程中会 close() + reopen()，
            // 期间 this.db 短暂为 null。这里改成「先 await open() 再读」，
            // 避免甩出 '数据库未初始化' 错误打断上层模块的同步读 API。
            const run = () => {
                try {
                    if (!this.db) throw new Error('[ListenDb] 数据库未初始化，请先调用 open()');
                    const request = this._exec(storeName, mode, store => callback(store));
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = e => reject(e);
                } catch (error) {
                    // 如果是「db 没初始化」，转成异步重试，给 open() 一次机会
                    if (String(error?.message || '').includes('数据库未初始化')) {
                        this.open().then(run, reject);
                    } else {
                        reject(error);
                    }
                }
            };

            if (!this.db) {
                this.open().then(run, reject);
                return;
            }
            run();
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
     * 若 db 还没打开 -> 先调 open() 并等待完成。
     * 若 db 已打开但缺 store / 索引 -> close + 用更高 version 重开
     *   (会触发 onupgradeneeded 补 store / 索引)。
     *
     * 注意：close+open 期间 this.db 短暂为 null。已在 _request() 兜底「等
     * open() 完成再读」，所以同步读 API 不会被打崩。
     *
     * 用于 app 注册后 / 新增 store 后强制升级 IndexedDB schema。
     */
    async ensureSchema() {
        // ★ 修复：如果 db 还没打开，先等待 open 完成
        if (!this.db) {
            await this.open();
        }
        const wanted = [...this._baseStores, ...this._pendingStores];
        const existing = Array.from(this.db.objectStoreNames || []);
        const missing = wanted.filter(s => !existing.includes(s.name));

        // ★ 索引一致性检查：即使 store 都在，也要看索引是否齐备。
        const missingIndexes = [];
        for (const def of wanted) {
            if (!Array.isArray(def.indexes) || !def.indexes.length) continue;
            if (!existing.includes(def.name)) continue;
            try {
                const objectStore = this.db.transaction(def.name, 'readonly').objectStore(def.name);
                for (const idx of def.indexes) {
                    if (!idx || !idx.name) continue;
                    if (!objectStore.indexNames.contains(idx.name)) {
                        missingIndexes.push(`${def.name}.${idx.name}`);
                    }
                }
            } catch (_) {}
        }

        const currentVersion = this.db.version || 0;
        const logKey = `${currentVersion}|${missing.length}|${missingIndexes.length}|${existing.length}`;

        if (missing.length === 0 && missingIndexes.length === 0) {
            if (this._lastSchemaLogKey !== logKey) {
                this._lastSchemaLogKey = logKey;
                if (console.debug) {
                    console.debug('[ListenDb.ensureSchema] schema 已是最新，共', wanted.length, '个 store, version=', currentVersion);
                }
            }
            return this.db;
        }

        // 升级：close + 用更高 version 重开，触发 onupgradeneeded 补 store / 索引
        if (this._lastSchemaLogKey !== logKey) {
            this._lastSchemaLogKey = logKey;
            console.log('[ListenDb.ensureSchema] 需要升级: 缺 store=', missing.map(s => s.name), '| 缺索引=', missingIndexes, '| 当前 version=', currentVersion);
        }
        const nextVersion = Math.max(currentVersion + 1, this._baseStores.length + this._pendingStores.length + 1);
        this.close();
        this.dbVersion = nextVersion;
        this._pendingStores = [];
        return this.open();
    }
}