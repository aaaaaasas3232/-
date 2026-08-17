/**
 * 设置 App · 数据库管理模块
 *
 * 设计目标：把 IndexedDB 里的每一张数据表都「暴露在用户面前」，
 * 用户可以查看、编辑、删除，新增记录。
 *
 * UI 设计：人设主页风格
 */

import { escapeHtml } from '@/src/core/escape.js';
import { listCatalog, getStoreInfo, auditStores, LOCAL_STORAGE_KEYS } from '@/src/core/db-catalog.js';
import { closeGalleryDb } from '../gallery/gallery-db.js';
import { closePromptDb } from '../prompt/prompt-db.js';

// 图库 / Prompt 各自跑在独立的 IndexedDB 里，不在 listen_db 的 store 清单内，
// 「一键清除」必须显式点名，否则它们会在清库后原样留下来。
const ALL_DATABASES = ['listen_db', 'listen_music_db', 'gallery_db', 'prompt_db'];

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
// IndexedDB 工具
// ============================================

function getDb() {
    return window.myDb || null;
}

function getStoreKeyPath(storeName) {
    return getStoreInfo(storeName)?.keyPath || 'id';
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
            <div class="db-mgr-card">
                <div class="db-mgr-card__head">
                    <span class="db-mgr-card__title">所有数据表</span>
                </div>
                <div class="db-mgr-card__body">
                    <p class="db-mgr-card__sub" style="margin:0 0 14px;font-size:12px;color:rgba(60,60,67,0.6);">点开任意一张表，可查看、编辑、删除、新增记录</p>
                    <div class="db-mgr-categories">
                        ${listCatalog().map(cat => `
                            <div class="db-mgr-category">
                                <div class="db-mgr-category__head">
                                    <span class="db-mgr-category__label">${escapeHtml(cat.label)}</span>
                                    <span class="db-mgr-category__desc">${escapeHtml(cat.desc)}</span>
                                </div>
                                <div class="db-mgr-category__stores">
                                    ${cat.stores.map(s => `
                                        <button class="db-mgr-store-btn"
                                            ${dbAction('dbOpenStore', { store: s.name })}
                                            title="${escapeHtml(s.note || s.desc)}">
                                            <span class="db-mgr-store-btn__name">${escapeHtml(s.name)}</span>
                                            <span class="db-mgr-store-btn__label">${escapeHtml(s.desc)}</span>
                                            <span class="db-mgr-store-btn__meta">${escapeHtml(s.owner)} · 主键 ${escapeHtml(s.keyPath)}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderStoreDetail(app, { activeStore, storeData, editingKey, editDraft, loadError }) {
    const keyPath = getStoreKeyPath(activeStore);
    const storeLabel = getStoreInfo(activeStore)?.desc || activeStore;

    return `
        <div class="db-mgr-content">
            <div class="db-mgr-store-detail">
                <div class="db-mgr-store-detail__head">
                    <button class="db-mgr-back-btn" ${dbAction('dbCloseStore')}>&#8249;</button>
                    <div class="db-mgr-store-detail__title">
                        <span class="db-mgr-store-detail__name">${escapeHtml(activeStore)}</span>
                        <span class="db-mgr-store-detail__label">${escapeHtml(storeLabel)}</span>
                    </div>
                    <button class="db-mgr-btn db-mgr-btn--primary db-mgr-btn--small" ${dbAction('dbAddRecord')}>+ 新增</button>
                </div>

                ${loadError ? `
                    <div style="padding:12px 14px;">
                        <div class="db-mgr-error">${escapeHtml(loadError)}</div>
                    </div>
                ` : ''}

                <div class="db-mgr-store-meta">
                    <span>主键: <code>${escapeHtml(keyPath)}</code></span>
                    <span>共 <strong>${storeData.length}</strong> 条</span>
                    <button class="db-mgr-link-btn" ${dbAction('dbClearStore')}>清空整张表</button>
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
                        <button class="db-mgr-btn db-mgr-btn--primary db-mgr-btn--small" ${dbAction(saveAction, isNew ? {} : { store: activeStore, key })}>保存</button>
                        <button class="db-mgr-btn db-mgr-btn--secondary db-mgr-btn--small" ${dbAction('dbCancelEdit')}>取消</button>
                        ${isNew ? '' : `<button class="db-mgr-btn db-mgr-btn--danger db-mgr-btn--small" ${dbAction('dbDeleteRecord', { store: activeStore, key })}>删除</button>`}
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
                    <button class="db-mgr-btn db-mgr-btn--secondary db-mgr-btn--small" ${dbAction('dbEditRecord', { store: activeStore, key })}>编辑</button>
                    <button class="db-mgr-btn db-mgr-btn--danger db-mgr-btn--small" ${dbAction('dbDeleteRecord', { store: activeStore, key })}>删除</button>
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
    const audit = state.audit || null;

    return `
        <div class="db-mgr-content">
            <div class="db-mgr-card">
                <div class="db-mgr-card__head">
                    <span class="db-mgr-card__title">一致性对账</span>
                </div>
                <div class="db-mgr-card__body">
                    <p class="db-mgr-card__sub" style="margin:0 0 14px;font-size:12px;color:rgba(60,60,67,0.6);">把三份清单摆在一起比：数据库里实际有的表、各 App 声明的表、目录登记的表。三者本该完全一致，对不上就是「保存成功但刷新就没了」这类问题的来源。</p>
                    <button class="db-mgr-btn db-mgr-btn--primary" ${dbAction('dbAudit')}>开始对账</button>
                    ${audit ? renderAuditResult(audit) : ''}
                </div>
            </div>

            <div class="db-mgr-card">
                <div class="db-mgr-card__head">
                    <span class="db-mgr-card__title">localStorage 键</span>
                </div>
                <div class="db-mgr-card__body">
                    <p class="db-mgr-card__sub" style="margin:0 0 14px;font-size:12px;color:rgba(60,60,67,0.6);">不走 IndexedDB、但同样是持久化数据的那几项</p>
                    <div class="db-mgr-ls-list">
                        ${LOCAL_STORAGE_KEYS.map(k => {
                            const raw = (() => { try { return localStorage.getItem(k.key); } catch (_) { return null; } })();
                            const size = raw ? `${(raw.length / 1024).toFixed(1)} KB` : '空';
                            return `
                                <div class="db-mgr-ls-row">
                                    <div class="db-mgr-ls-key">${escapeHtml(k.key)}</div>
                                    <div class="db-mgr-ls-desc">${escapeHtml(k.desc)}</div>
                                    <div class="db-mgr-ls-size">${escapeHtml(size)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <div class="db-mgr-card">
                <div class="db-mgr-card__head">
                    <span class="db-mgr-card__title">数据库连接</span>
                </div>
                <div class="db-mgr-card__body">
                    <p class="db-mgr-card__sub" style="margin:0 0 14px;font-size:12px;color:rgba(60,60,67,0.6);">检查 IndexedDB 连接、版本、当前已存在的表</p>
                    <button class="db-mgr-btn db-mgr-btn--primary" ${dbAction('dbInspect')}>立即检查</button>
                    ${error ? `<div class="db-mgr-error" style="margin-top:12px;">${escapeHtml(error)}</div>` : ''}
                </div>
            </div>

            ${inspect ? `
                <div class="db-mgr-card">
                    <div class="db-mgr-card__head">
                        <span class="db-mgr-card__title">诊断结果</span>
                    </div>
                    <div class="db-mgr-card__body">
                        <pre class="db-mgr-import-result">${escapeHtml(safeJSONStringify(inspect))}</pre>
                    </div>
                </div>
            ` : ''}

            <div class="db-mgr-card db-mgr-card--danger">
                <div class="db-mgr-card__head">
                    <span class="db-mgr-card__title">危险操作</span>
                </div>
                <div class="db-mgr-card__body">
                    <p class="db-mgr-card__sub" style="margin:0 0 14px;font-size:12px;color:rgba(60,60,67,0.6);">以下操作不可恢复，请谨慎使用</p>
                    ${showConfirm ? `
                        <div class="db-mgr-confirm-box">
                            <p class="db-mgr-confirm-text">确定要清除所有数据库内容吗？这将删除：</p>
                            <ul class="db-mgr-confirm-list">
                                <li>listen_db（所有用户/AI/世界数据）</li>
                                <li>listen_music_db（音乐数据）</li>
                                <li>gallery_db（图库/图包/图组/图片）</li>
                                <li>prompt_db（Prompt 库/包/组/条目）</li>
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
                        <p class="db-mgr-hint">这将删除 listen_db、listen_music_db、gallery_db、prompt_db 和所有 localStorage 数据，重置数据库版本</p>
                    `}
                </div>
            </div>
        </div>
    `;
}

function renderAuditResult(audit) {
    const problem = (title, why, list) => {
        if (!list.length) return '';
        return `
            <div class="db-mgr-audit-block">
                <div class="db-mgr-audit-title">${escapeHtml(title)}（${list.length}）</div>
                <div class="db-mgr-audit-why">${why}</div>
                <div class="db-mgr-audit-tags">${list.map(n => `<span class="db-mgr-audit-tag">${escapeHtml(n)}</span>`).join('')}</div>
            </div>
        `;
    };

    const clean = audit.missingInDb.length === 0
        && audit.uncatalogued.length === 0
        && audit.undeclared.length === 0;

    return `
        <div class="db-mgr-audit">
            <div class="db-mgr-audit-summary ${clean ? 'is-ok' : 'is-warn'}">
                数据库里 ${audit.actual.length} 张表 · App 声明 ${audit.appDeclared.length} 张 · 目录登记 ${audit.declared.length} 张
                ${clean ? ' · 完全一致' : ''}
            </div>
            ${problem('声明了但数据库里没有', '多半是声明了 stores 却走同步注册，表压根没建出来，写入会静默失败。修法：在 js/apps/index.js 的 appFactories 里把它改成 <code>async: true</code>。', audit.missingInDb)}
            ${problem('数据库里有但没人声明', '要么是已卸载 App 留下的孤儿表，要么是代码里直接写死表名在用。前者可以清掉，后者要补 stores 声明。', audit.undeclared)}
            ${problem('还没登记进目录', '表是真实存在的，只是 <code>src/core/db-catalog.js</code> 里没写。补上说明，这个页面才能显示它。', audit.uncatalogued)}
            ${Object.keys(audit.counts).length ? `
                <div class="db-mgr-audit-block">
                    <div class="db-mgr-audit-title">各表记录数</div>
                    <div class="db-mgr-audit-counts">
                        ${Object.entries(audit.counts).sort((a, b) => b[1] - a[1]).map(([name, n]) => `
                            <div class="db-mgr-audit-count ${n === 0 ? 'is-empty' : ''}">
                                <span>${escapeHtml(name)}</span><b>${n < 0 ? '读取失败' : n}</b>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================
// 方法
// ============================================

export function buildDatabaseMethods() {
    function refresh() {
        // 触发 detail 页面重画（根据 AGENTS.md §32 规则，detail 页修改数据后用 __detailRenderTick 触发）
        try {
            if (typeof window.__detailRenderTick !== 'undefined' && window.__detailRenderTick.value !== undefined) {
                window.__detailRenderTick.value++;
            }
        } catch (_) {}
        // 同时 try refreshPhoneApps 作为兜底
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

        async dbAudit() {
            const app = this.app;
            try {
                const audit = await auditStores({ withCounts: true });
                setState(app, { audit });
                const problems = audit.missingInDb.length + audit.uncatalogued.length + audit.undeclared.length;
                this.app.toolkit.island.notify(
                    problems ? 'warning' : 'success',
                    problems ? `发现 ${problems} 处不一致` : '三份清单完全一致',
                    problems ? '展开看每一类该怎么修' : `共 ${audit.actual.length} 张表`,
                );
            } catch (err) {
                setState(app, { inspectError: err?.message || String(err) });
            }
            refresh();
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
                if (window.myDb) {
                    window.myDb.close();
                    window.myDb = null;
                }
                if (window.musicDb) {
                    window.musicDb.close();
                    window.musicDb = null;
                }
                closeGalleryDb();
                closePromptDb();

                const deleteDb = (name) => {
                    return new Promise((resolve) => {
                        const req = indexedDB.deleteDatabase(name);
                        // 有连接没关干净时 deleteDatabase 会一直挂着，超时兜底避免卡在「清除中...」
                        const timer = setTimeout(() => {
                            console.warn(`[dbClearAll] 删除数据库超时: ${name}`);
                            resolve();
                        }, 3000);
                        const done = (log) => { clearTimeout(timer); log(); resolve(); };
                        req.onsuccess = () => done(() => console.log(`[dbClearAll] 已删除数据库: ${name}`));
                        req.onerror = () => done(() => console.warn(`[dbClearAll] 删除数据库失败: ${name}`, req.error));
                        req.onblocked = () => console.warn(`[dbClearAll] 删除数据库被阻塞: ${name}，等待连接关闭...`);
                    });
                };

                // 已知库 + 运行时实际存在的库（覆盖后加的独立库）
                let names = [...ALL_DATABASES];
                if (typeof indexedDB.databases === 'function') {
                    try {
                        const existing = await indexedDB.databases();
                        for (const { name } of existing) {
                            if (name && !names.includes(name)) names.push(name);
                        }
                    } catch (e) {
                        console.warn('[dbClearAll] 枚举数据库失败，仅清除已知库', e);
                    }
                }
                for (const name of names) {
                    await deleteDb(name);
                }

                localStorage.clear();
                console.log('[dbClearAll] 已清除 localStorage');

                setState(app, { isClearing: false, inspect: null });

                await new Promise(r => setTimeout(r, 100));

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

export function handleDatabaseChange(event) {}

export function handleDatabaseClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const shell = target.closest('.app-shell');
    if (!shell) return;
}
