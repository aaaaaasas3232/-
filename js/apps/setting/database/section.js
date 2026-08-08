/**
 * 设置 App · 数据库管理模块
 *
 * 设计目标：把 IndexedDB 里的每一张数据表都「暴露在用户面前」，
 * 用户可以查看、编辑、删除、新增记录。
 *
 * 任务边界：
 *   - 本模块只负责「低级数据表」可视化和编辑
 *   - 业务级「导入与导出」（角色卡、AI 人设卡、世界观）由
 *     import-export/section.js 负责
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// 工具函数
// ============================================

function dbAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

function safeJSONStringify(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch (e) {
        return String(value);
    }
}

// ============================================
// 数据表分类
// ============================================

const STORE_CATEGORIES = [
    {
        id: 'users',
        label: '用户 / AI 人设',
        desc: '多用户、多 AI 实例的人设数据',
        stores: [
            { name: 'sdkUsers', label: '用户列表' },
            { name: 'sdkAiPersons', label: 'AI 人设列表' },
        ],
    },
    {
        id: 'worlds',
        label: '世界观',
        desc: '世界、组、地点、标签、阵营等',
        stores: [
            { name: 'sdkWorlds', label: '世界观' },
            { name: 'sdkWorldGroups', label: '世界观组' },
            { name: 'sdkPlaces', label: '地点（地图）' },
            { name: 'sdkLocations', label: '场所（地点下的 pin）' },
            { name: 'sdkFactions', label: '阵营' },
            { name: 'sdkTagGroups', label: '标签组' },
            { name: 'sdkTags', label: '标签' },
            { name: 'sdkSnapshots', label: '快照' },
        ],
    },
    {
        id: 'persona',
        label: '人设主页',
        desc: '心情 / 周历 / 日程 / 日记 / 草稿',
        stores: [
            { name: 'sdkDrafts', label: '草稿' },
            { name: 'sdkDiaries', label: '日记' },
            { name: 'sdkSchedules', label: '日程' },
            { name: 'sdkActive', label: '激活状态' },
        ],
    },
    {
        id: 'api',
        label: 'API 管理',
        desc: 'API 密钥 / 组 / 调用日志',
        stores: [
            { name: 'apiKeys', label: 'API 密钥' },
            { name: 'apiGroups', label: 'API 组' },
            { name: 'apiUsageLogs', label: '调用日志' },
            { name: 'apiProfiles', label: '旧版 API 配置' },
        ],
    },
    {
        id: 'device',
        label: '设备 / 外观',
        desc: '手机壳、电池、壁纸等设备级设置',
        stores: [
            { name: 'deviceSettings', label: '设备设置' },
            { name: 'AppSettings', label: '应用设置' },
        ],
    },
    {
        id: 'weather',
        label: '天气 App',
        desc: '天气 App 的城市列表与缓存',
        stores: [
            { name: 'weatherCities', label: '城市与天气缓存' },
        ],
    },
    {
        id: 'base',
        label: '基础数据',
        desc: '框架启动时建立的旧表',
        stores: [
            { name: 'Userinfo', label: '旧用户表' },
            { name: 'charInfo', label: '旧角色表' },
            { name: 'worldInfo', label: '旧世界观表' },
            { name: 'apiInfo', label: '旧 API 表' },
        ],
    },
];

const ALL_STORES = STORE_CATEGORIES.flatMap(c => c.stores.map(s => ({ ...s, categoryId: c.id, categoryLabel: c.label })));

// ============================================
// IndexedDB 工具
// ============================================

function getDb() {
    return window.myDb || null;
}

function getStoreKeyPath(storeName) {
    const declared = {
        sdkUsers: 'id',
        sdkAiPersons: 'id',
        sdkWorlds: 'id',
        sdkWorldGroups: 'id',
        sdkTagGroups: 'id',
        sdkTags: 'id',
        sdkFactions: 'id',
        sdkPlaces: 'id',
        sdkLocations: 'id',
        sdkSnapshots: 'key',
        sdkActive: 'key',
        sdkDrafts: 'id',
        sdkDiaries: 'id',
        sdkSchedules: 'id',
        apiKeys: 'id',
        apiGroups: 'id',
        apiUsageLogs: 'id',
        apiProfiles: 'key',
        deviceSettings: 'key',
        AppSettings: 'key',
        weatherCities: 'id',
        Userinfo: 'userId',
        charInfo: 'charId',
        worldInfo: 'worldId',
        apiInfo: 'apiId',
    };
    return declared[storeName] || 'id';
}

async function listStore(storeName) {
    const db = getDb();
    if (!db) throw new Error('数据库未初始化');
    return db.getAll(storeName);
}

async function putRecord(storeName, record) {
    const db = getDb();
    if (!db) throw new Error('数据库未初始化');
    const keyPath = getStoreKeyPath(storeName);
    if (record[keyPath] === undefined || record[keyPath] === null || record[keyPath] === '') {
        record[keyPath] = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return db.put(storeName, record);
}

async function deleteRecord(storeName, key) {
    const db = getDb();
    if (!db) throw new Error('数据库未初始化');
    return db.remove(storeName, key);
}

async function clearStore(storeName) {
    const db = getDb();
    if (!db) throw new Error('数据库未初始化');
    return db.clear(storeName);
}

// ============================================
// 渲染入口
// ============================================

export function renderDatabaseSection(app) {
    const state = app.state.database || {};
    const tab = state.tab || 'browse';

    return `
        <div class="db-mgr-page">
            <div class="db-mgr-tabs">
                <button class="db-mgr-tab ${tab === 'browse' ? 'is-active' : ''}"
                    ${dbAction('dbSetTab', { tab: 'browse' })}>数据表浏览</button>
                <button class="db-mgr-tab ${tab === 'inspect' ? 'is-active' : ''}"
                    ${dbAction('dbSetTab', { tab: 'inspect' })}>数据库检查</button>
            </div>

            ${tab === 'browse' ? renderBrowseTab(app) : ''}
            ${tab === 'inspect' ? renderInspectTab(app) : ''}
        </div>
    `;
}

// ============================================
// Tab 1: 数据表浏览（默认主页）
// ============================================

function renderBrowseTab(app) {
    const state = app.state.database || {};
    const activeStore = state.activeStore || '';
    const storeData = state.storeData || [];
    const editingKey = state.editingKey || '';
    const editDraft = state.editDraft || '';
    const loadError = state.loadError || '';

    if (activeStore) {
        return renderStoreDetail(app, {
            activeStore, storeData, editingKey, editDraft, loadError,
        });
    }

    return `
        <div class="db-mgr-content">
            <div class="db-mgr-section">
                <div class="db-mgr-section-title">所有数据表</div>
                <p class="db-mgr-desc">点开任意一张表，可查看、编辑、删除、新增记录</p>
                <div class="db-mgr-categories">
                    ${STORE_CATEGORIES.map(cat => `
                        <div class="db-mgr-category">
                            <div class="db-mgr-category__head">
                                <span class="db-mgr-category__label">${escapeHtml(cat.label)}</span>
                                <span class="db-mgr-category__desc">${escapeHtml(cat.desc)}</span>
                            </div>
                            <div class="db-mgr-category__stores">
                                ${cat.stores.map(s => `
                                    <button class="db-mgr-store-btn"
                                        ${dbAction('dbOpenStore', { store: s.name })}>
                                        <span class="db-mgr-store-btn__name">${escapeHtml(s.name)}</span>
                                        <span class="db-mgr-store-btn__label">${escapeHtml(s.label)}</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderStoreDetail(app, { activeStore, storeData, editingKey, editDraft, loadError }) {
    const keyPath = getStoreKeyPath(activeStore);
    const storeLabel = ALL_STORES.find(s => s.name === activeStore)?.label || activeStore;

    return `
        <div class="db-mgr-content">
            <div class="db-mgr-store-detail">
                <div class="db-mgr-store-detail__head">
                    <button class="db-mgr-back-btn" ${dbAction('dbCloseStore')}>‹ 返回</button>
                    <div class="db-mgr-store-detail__title">
                        <span class="db-mgr-store-detail__name">${escapeHtml(activeStore)}</span>
                        <span class="db-mgr-store-detail__label">${escapeHtml(storeLabel)}</span>
                    </div>
                    <button class="db-mgr-btn db-mgr-btn--primary db-mgr-btn--small" ${dbAction('dbAddRecord')}>+ 新增</button>
                </div>

                ${loadError ? `
                    <div class="db-mgr-error">${escapeHtml(loadError)}</div>
                ` : ''}

                <div class="db-mgr-store-meta">
                    主键：<code>${escapeHtml(keyPath)}</code>
                    · 共 <strong>${storeData.length}</strong> 条
                    · <button class="db-mgr-link-btn" ${dbAction('dbClearStore')}>清空整张表</button>
                </div>

                ${storeData.length === 0 ? `
                    <div class="db-mgr-empty">这张表是空的，点「+ 新增」添加第一条记录</div>
                ` : `
                    <div class="db-mgr-record-list">
                        ${storeData.map((record, idx) => renderRecordRow(record, idx, keyPath, activeStore, editingKey)).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderRecordRow(record, idx, keyPath, activeStore, editingKey) {
    const key = record[keyPath];
    const keyStr = key === undefined || key === null ? '(无主键)' : String(key);
    const isEditing = editingKey === String(key);
    const isNew = editingKey === '__new__' && idx === 0;

    if (isEditing) {
        const draft = (record.__editDraft !== undefined) ? record.__editDraft : safeJSONStringify(record);
        const saveAction = isNew ? 'dbSaveNewRecord' : 'dbSaveRecord';
        return `
            <div class="db-mgr-record db-mgr-record--editing">
                <div class="db-mgr-record__head">
                    <span class="db-mgr-record__key">${isNew ? '新增记录' : '编辑主键：' + escapeHtml(keyStr)}</span>
                    <div class="db-mgr-record__actions">
                        <button class="db-mgr-btn db-mgr-btn--small db-mgr-btn--primary" ${dbAction(saveAction, isNew ? {} : { store: activeStore, key })}>保存</button>
                        <button class="db-mgr-btn db-mgr-btn--small" ${dbAction('dbCancelEdit')}>取消</button>
                        ${isNew ? '' : `<button class="db-mgr-btn db-mgr-btn--small db-mgr-btn--danger" ${dbAction('dbDeleteRecord', { store: activeStore, key })}>删除</button>`}
                    </div>
                </div>
                <textarea class="db-mgr-record__editor" data-record-editor rows="14"
                    oninput="window.__dbRecordEditInput && window.__dbRecordEditInput(this.value)">${escapeHtml(draft)}</textarea>
                <div class="db-mgr-record__hint">编辑 JSON 后点「保存」。${isNew ? '' : '保存会用 JSON 解析后的对象覆盖整条记录。'}</div>
            </div>
        `;
    }

    const preview = safeJSONStringify(record);
    const truncated = preview.length > 160 ? preview.slice(0, 160) + '…' : preview;

    return `
        <div class="db-mgr-record">
            <div class="db-mgr-record__head">
                <span class="db-mgr-record__key">${escapeHtml(keyStr)}</span>
                <div class="db-mgr-record__actions">
                    <button class="db-mgr-btn db-mgr-btn--small" ${dbAction('dbEditRecord', { store: activeStore, key })}>编辑</button>
                    <button class="db-mgr-btn db-mgr-btn--small db-mgr-btn--danger" ${dbAction('dbDeleteRecord', { store: activeStore, key })}>删除</button>
                </div>
            </div>
            <pre class="db-mgr-record__preview">${escapeHtml(truncated)}</pre>
        </div>
    `;
}

// ============================================
// Tab 2: 数据库检查（只读诊断）
// ============================================

function renderInspectTab(app) {
    const state = app.state.database || {};
    const inspect = state.inspect || null;
    const error = state.inspectError || '';
    const isClearing = state.isClearing || false;
    const showConfirm = state.showClearConfirm || false;

    return `
        <div class="db-mgr-content">
            <div class="db-mgr-section">
                <div class="db-mgr-section-title">数据库连接</div>
                <p class="db-mgr-desc">检查 IndexedDB 连接、版本、当前已存在的表</p>
                <button class="db-mgr-btn db-mgr-btn--primary" ${dbAction('dbInspect')}>立即检查</button>
                ${error ? `<div class="db-mgr-error">${escapeHtml(error)}</div>` : ''}
            </div>

            ${inspect ? `
                <div class="db-mgr-section">
                    <div class="db-mgr-section-title">诊断结果</div>
                    <pre class="db-mgr-import-result">${escapeHtml(safeJSONStringify(inspect))}</pre>
                </div>
            ` : ''}

            <div class="db-mgr-section">
                <div class="db-mgr-section-title db-mgr-section-title--danger">危险操作</div>
                <p class="db-mgr-desc">以下操作不可恢复，请谨慎使用</p>
                ${showConfirm ? `
                    <div class="db-mgr-confirm-box">
                        <p class="db-mgr-confirm-text">确定要清除所有数据库内容吗？这将删除：</p>
                        <ul class="db-mgr-confirm-list">
                            <li>listen_db（所有用户/AI/世界数据）</li>
                            <li>listen_music_db（音乐数据）</li>
                            <li>所有 localStorage 数据</li>
                        </ul>
                        <p class="db-mgr-confirm-warning">此操作不可恢复，确定继续吗？</p>
                        <div class="db-mgr-confirm-actions">
                            <button class="db-mgr-btn db-mgr-btn--danger" ${dbAction('dbConfirmClearAll')}>确定清除</button>
                            <button class="db-mgr-btn db-mgr-btn--primary" ${dbAction('dbCancelClearAll')}>取消</button>
                        </div>
                    </div>
                ` : `
                    <button class="db-mgr-btn db-mgr-btn--danger"
                        ${dbAction('dbClearAll')}
                        ${isClearing ? 'disabled' : ''}>
                        ${isClearing ? '清除中...' : '一键清除所有数据库内容'}
                    </button>
                    <p class="db-mgr-hint">这将删除 listen_db、listen_music_db 和所有 localStorage 数据，重置数据库版本</p>
                `}
            </div>
        </div>
    `;
}

// ============================================
// 方法
// ============================================

export function buildDatabaseMethods() {
    function refresh() {
        try { window.refreshPhoneApps?.(); } catch (_) {}
    }

    function setState(app, patch) {
        if (!app.state.database) app.state.database = {};
        Object.assign(app.state.database, patch);
    }

    return {
        dbSetTab({ tab }) {
            const app = this.app;
            setState(app, { tab, activeStore: '', storeData: [], editingKey: '', editDraft: '' });
            refresh();
        },

        async dbOpenStore({ store }) {
            const app = this.app;
            setState(app, { activeStore: store, loadError: '', editingKey: '', editDraft: '' });
            refresh();
            try {
                const items = await listStore(store);
                setState(app, { storeData: items });
                refresh();
            } catch (e) {
                setState(app, { storeData: [], loadError: e.message || String(e) });
                refresh();
            }
        },

        dbCloseStore() {
            const app = this.app;
            setState(app, { activeStore: '', storeData: [], editingKey: '', editDraft: '', loadError: '' });
            refresh();
        },

        dbEditRecord({ store, key }) {
            const app = this.app;
            const data = app.state.database?.storeData || [];
            const found = data.find(r => String(r[getStoreKeyPath(store)]) === String(key));
            if (!found) {
                this.app.toolkit.island.notify('warning', '未找到记录', '');
                return;
            }
            setState(app, { editingKey: String(key), editDraft: safeJSONStringify(found) });
            refresh();
        },

        dbCancelEdit() {
            const app = this.app;
            setState(app, { editingKey: '', editDraft: '' });
            refresh();
        },

        async dbSaveRecord({ store, key }) {
            const app = this.app;
            const draftText = window.__dbCurrentEditDraft || app.state.database?.editDraft || '';
            if (!draftText.trim()) {
                this.app.toolkit.island.notify('warning', '内容为空', '没有可保存的内容');
                return;
            }
            let parsed;
            try {
                parsed = JSON.parse(draftText);
            } catch (e) {
                this.app.toolkit.island.notify('error', 'JSON 解析失败', e.message);
                return;
            }
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                this.app.toolkit.island.notify('error', '类型错误', '每条记录必须是 JSON 对象');
                return;
            }
            const keyPath = getStoreKeyPath(store);
            if (parsed[keyPath] === undefined || parsed[keyPath] === null || parsed[keyPath] === '') {
                parsed[keyPath] = key;
            }
            try {
                await putRecord(store, parsed);
                const items = await listStore(store);
                setState(app, { storeData: items, editingKey: '', editDraft: '', isNewDraft: false });
                window.__dbCurrentEditDraft = '';
                this.app.toolkit.island.notify('success', '已保存', `${store} · ${parsed[keyPath]}`);
                refresh();
            } catch (e) {
                this.app.toolkit.island.notify('error', '保存失败', e.message);
            }
        },

        async dbDeleteRecord({ store, key }) {
            const app = this.app;
            if (window.__phoneConfirm?.request) {
                const ok = await new Promise((resolve) => {
                    window.__phoneConfirm.request({
                        title: '删除记录',
                        text: `确定要删除「${store}」中主键为「${key}」的记录吗？`,
                        confirmLabel: '删除',
                        danger: true,
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false),
                    });
                });
                if (!ok) return;
            }
            try {
                await deleteRecord(store, key);
                const items = await listStore(store);
                setState(app, { storeData: items, editingKey: '', editDraft: '' });
                this.app.toolkit.island.notify('info', '已删除', String(key));
                refresh();
            } catch (e) {
                this.app.toolkit.island.notify('error', '删除失败', e.message);
            }
        },

        dbAddRecord() {
            const app = this.app;
            const store = app.state.database?.activeStore;
            if (!store) return;
            const keyPath = getStoreKeyPath(store);
            const newRecord = { [keyPath]: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
            setState(app, {
                editingKey: '__new__',
                editDraft: safeJSONStringify(newRecord),
                storeData: [newRecord, ...(app.state.database?.storeData || [])],
                isNewDraft: true,
            });
            window.__dbCurrentEditDraft = safeJSONStringify(newRecord);
            refresh();
        },

        async dbSaveNewRecord() {
            const app = this.app;
            const store = app.state.database?.activeStore;
            const draftText = window.__dbCurrentEditDraft || app.state.database?.editDraft || '';
            let parsed;
            try {
                parsed = JSON.parse(draftText);
            } catch (e) {
                this.app.toolkit.island.notify('error', 'JSON 解析失败', e.message);
                return;
            }
            try {
                await putRecord(store, parsed);
                const items = await listStore(store);
                setState(app, { storeData: items, editingKey: '', editDraft: '', isNewDraft: false });
                window.__dbCurrentEditDraft = '';
                this.app.toolkit.island.notify('success', '已新增', '');
                refresh();
            } catch (e) {
                this.app.toolkit.island.notify('error', '新增失败', e.message);
            }
        },

        async dbClearStore() {
            const app = this.app;
            const store = app.state.database?.activeStore;
            if (!store) return;
            if (window.__phoneConfirm?.request) {
                const ok = await new Promise((resolve) => {
                    window.__phoneConfirm.request({
                        title: '清空数据表',
                        text: `确定要清空「${store}」表里的所有记录吗？此操作不可恢复！`,
                        confirmLabel: '清空',
                        danger: true,
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false),
                    });
                });
                if (!ok) return;
            }
            try {
                await clearStore(store);
                setState(app, { storeData: [], editingKey: '', editDraft: '' });
                this.app.toolkit.island.notify('info', '已清空', store);
                refresh();
            } catch (e) {
                this.app.toolkit.island.notify('error', '清空失败', e.message);
            }
        },

        async dbInspect() {
            const app = this.app;
            setState(app, { inspectError: '' });
            try {
                const db = getDb();
                if (!db) throw new Error('window.myDb 不存在');
                const summary = {
                    hasDb: !!db,
                    dbName: db.dbName || '(unknown)',
                    version: db.version || 0,
                    stores: [],
                };
                let storeNames = [];
                if (typeof db.getStoreNames === 'function') {
                    storeNames = db.getStoreNames();
                } else if (Array.isArray(db.stores)) {
                    storeNames = db.stores.map(s => s.name);
                }
                for (const name of storeNames) {
                    try {
                        const count = (await db.getAll(name)).length;
                        summary.stores.push({ name, count });
                    } catch (e) {
                        summary.stores.push({ name, error: e.message || String(e) });
                    }
                }
                setState(app, { inspect: summary });
                refresh();
            } catch (e) {
                setState(app, { inspect: null, inspectError: e.message || String(e) });
                refresh();
            }
        },

        dbClearAll() {
            const app = this.app;
            setState(app, { showClearConfirm: true });
            refresh();
        },

        dbCancelClearAll() {
            const app = this.app;
            setState(app, { showClearConfirm: false });
            refresh();
        },

        async dbConfirmClearAll() {
            const app = this.app;
            setState(app, { isClearing: true, showClearConfirm: false });
            refresh();

            try {
                // 关闭现有数据库连接
                if (window.myDb) {
                    window.myDb.close();
                    window.myDb = null;
                }
                if (window.musicDb) {
                    window.musicDb.close();
                    window.musicDb = null;
                }

                // 删除 IndexedDB 数据库（必须等待删除完成！）
                const deleteDb = (name) => {
                    return new Promise((resolve) => {
                        const req = indexedDB.deleteDatabase(name);
                        req.onsuccess = () => {
                            console.log(`[dbClearAll] 已删除数据库: ${name}`);
                            resolve();
                        };
                        req.onerror = () => {
                            console.warn(`[dbClearAll] 删除数据库失败: ${name}`, req.error);
                            resolve();
                        };
                        req.onblocked = () => {
                            console.warn(`[dbClearAll] 删除数据库被阻塞: ${name}，等待连接关闭...`);
                        };
                    });
                };

                // 依次删除，等每个完成再删下一个
                await deleteDb('listen_db');
                await deleteDb('listen_music_db');

                // 清除 localStorage
                localStorage.clear();
                console.log('[dbClearAll] 已清除 localStorage');

                setState(app, { isClearing: false, inspect: null });

                // 短暂延迟确保所有连接都关闭了
                await new Promise(r => setTimeout(r, 100));

                // 刷新页面
                window.location.reload();
            } catch (e) {
                setState(app, { isClearing: false });
                this.app.toolkit.island.notify('error', '清除失败', e.message);
                refresh();
            }
        },
    };
}

// ============================================
// 全局：跨重渲染保存编辑器实时内容
// ============================================

if (typeof window !== 'undefined') {
    window.__dbRecordEditInput = function (value) {
        window.__dbCurrentEditDraft = value;
        const app = window.settingsApp;
        if (app?.state?.database) app.state.database.editDraft = value;
    };
}

export function handleDatabaseChange(event) {
    // 编辑器实时同步在 window.__dbRecordEditInput 处理
}

export function handleDatabaseClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;
}