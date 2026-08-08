/**
 * 设置 App · 导入与导出模块
 *
 * 业务级「导入与导出」——只关心用户能直观理解的业务实体：
 *   - 用户角色卡 (sdkUsers)
 *   - AI 人设卡   (sdkAiPersons)
 *   - 世界观       (sdkWorlds / sdkWorldGroups / sdkPlaces / sdkLocations / sdkFactions / sdkTagGroups / sdkTags)
 *   - Prompt 库    (不归 settings SDK 管，仍走 IndexedDB)
 *
 * 与「数据库管理」不同：
 *   - 数据库管理 → 暴露所有 db 表，可查看 / 编辑 / 保存 / 删除
 *   - 导入与导出 → 高层业务语义，一键导出整类（角色卡、世界观），导入时按 ID 合并/覆盖
 *
 * 操作策略：
 *   导出时用 SDK 的 list()（内存副本最权威），没有 SDK 时直接从 IndexedDB 读。
 *   导入时按 record.id 做合并：用户决定「覆盖 / 跳过 / 新建」。
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// 工具
// ============================================

function safeJSONStringify(value) {
    try { return JSON.stringify(value, null, 2); }
    catch (e) { return String(value); }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

// ============================================
// 业务表分组
// ============================================

const BUSINESS_GROUPS = [
    {
        id: 'users',
        label: '用户角色卡',
        desc: '所有用户人设数据',
        color: '#2196F3',
        scopes: [
            { kind: 'sdk', name: 'users', label: '用户' },
        ],
        fallbackStore: 'sdkUsers',
    },
    {
        id: 'ai',
        label: 'AI 人设卡',
        desc: '所有AI角色配置',
        color: '#4CAF50',
        scopes: [
            { kind: 'sdk', name: 'aiPersons', label: 'AI 人设' },
        ],
        fallbackStore: 'sdkAiPersons',
    },
    {
        id: 'world',
        label: '世界观',
        desc: '世界观及其下属人设数据',
        color: '#FF9800',
        scopes: [
            { kind: 'sdk', name: 'worlds',         label: '世界观' },
            { kind: 'sdk', name: 'worldGroups',    label: '世界观组' },
            { kind: 'sdk', name: 'places',         label: '地点' },
            { kind: 'sdk', name: 'locations',      label: '场所' },
            { kind: 'sdk', name: 'factions',       label: '阵营' },
            { kind: 'sdk', name: 'tagGroups',      label: '标签组' },
            { kind: 'sdk', name: 'tags',           label: '标签' },
        ],
        fallbackStores: ['sdkWorlds', 'sdkWorldGroups', 'sdkPlaces', 'sdkLocations', 'sdkFactions', 'sdkTagGroups', 'sdkTags'],
    },
    {
        id: 'prompt',
        label: 'Prompt 库',
        desc: '提示词模板与变量',
        color: '#9C27B0',
        scopes: [],
        fallbackStores: ['promptTemplates', 'promptVariables'],
    },
];

// ============================================
// 数据访问层
// ============================================

function getSdk() {
    return window.settingsSdk || null;
}

function getDb() {
    return window.myDb || null;
}

async function fetchScopeData(scope) {
    const sdk = getSdk();
    if (sdk && sdk[scope] && typeof sdk[scope].list === 'function') {
        return { source: 'sdk', items: sdk[scope].list() };
    }
    const storeName = scopeToStoreName(scope);
    if (!storeName) return { source: 'db', items: [] };
    const db = getDb();
    if (!db) return { source: 'db', items: [] };
    const items = await db.getAll(storeName);
    return { source: 'db', items };
}

async function putScopeItems(scope, items, policy) {
    // policy: 'overwrite' | 'skip' | 'rename'
    const sdk = getSdk();
    const storeName = scopeToStoreName(scope);
    const results = { total: items.length, created: 0, updated: 0, skipped: 0, renamed: 0 };

    if (sdk && sdk[scope]) {
        for (const item of items) {
            const existing = sdk[scope].get?.(item.id);
            if (existing) {
                if (policy === 'skip') { results.skipped++; continue; }
                if (policy === 'rename') {
                    const renamed = { ...item, id: `${item.id}_${Date.now().toString(36)}` };
                    await sdk[scope].create(renamed);
                    results.renamed++;
                    continue;
                }
                await sdk[scope].update(item.id, item);
                results.updated++;
            } else {
                await sdk[scope].create(item);
                results.created++;
            }
        }
        return results;
    }

    // 兜底写 IndexedDB
    const db = getDb();
    if (!db || !storeName) return { ...results, error: '数据库 / SDK 不可用' };
    for (const item of items) {
        const existing = await db.get(storeName, item.id);
        if (existing) {
            if (policy === 'skip') { results.skipped++; continue; }
            if (policy === 'rename') {
                const renamed = { ...item, id: `${item.id}_${Date.now().toString(36)}` };
                await db.put(storeName, renamed);
                results.renamed++;
                continue;
            }
            await db.put(storeName, item);
            results.updated++;
        } else {
            await db.put(storeName, item);
            results.created++;
        }
    }
    return results;
}

function scopeToStoreName(scope) {
    const map = {
        users: 'sdkUsers',
        aiPersons: 'sdkAiPersons',
        worlds: 'sdkWorlds',
        worldGroups: 'sdkWorldGroups',
        places: 'sdkPlaces',
        locations: 'sdkLocations',
        factions: 'sdkFactions',
        tagGroups: 'sdkTagGroups',
        tags: 'sdkTags',
        draft: 'sdkDrafts',
        diary: 'sdkDiaries',
        schedule: 'sdkSchedules',
    };
    return map[scope] || null;
}

async function fetchStoreList(storeName) {
    const db = getDb();
    if (!db) return [];
    return db.getAll(storeName);
}

async function putStoreItems(storeName, items, policy) {
    const db = getDb();
    if (!db) return { total: 0, created: 0, updated: 0, skipped: 0, renamed: 0, error: '数据库不可用' };
    const results = { total: items.length, created: 0, updated: 0, skipped: 0, renamed: 0 };
    for (const item of items) {
        const existing = await db.get(storeName, item.id);
        if (existing) {
            if (policy === 'skip') { results.skipped++; continue; }
            if (policy === 'rename') {
                const renamed = { ...item, id: `${item.id}_${Date.now().toString(36)}` };
                await db.put(storeName, renamed);
                results.renamed++;
                continue;
            }
            await db.put(storeName, item);
            results.updated++;
        } else {
            await db.put(storeName, item);
            results.created++;
        }
    }
    return results;
}

// ============================================
// 导出逻辑
// ============================================

async function exportGroup(group) {
    const out = { group: group.id, exportTime: new Date().toISOString(), data: {} };
    // 业务 SDK scope
    for (const scope of group.scopes) {
        const { items } = await fetchScopeData(scope.name);
        out.data[scope.name] = items;
    }
    // 兜底 IndexedDB 表
    for (const storeName of group.fallbackStores || []) {
        if (out.data[storeName]) continue; // 已被 scope 覆盖
        const items = await fetchStoreList(storeName);
        out.data[storeName] = items;
    }
    return out;
}

async function exportAll() {
    const result = {
        exportTime: new Date().toISOString(),
        version: '1.0',
        groups: {},
    };
    for (const g of BUSINESS_GROUPS) {
        result.groups[g.id] = await exportGroup(g);
    }
    return result;
}

// ============================================
// 导入逻辑
// ============================================

function summarizeResult(perScope) {
    let total = 0, created = 0, updated = 0, skipped = 0, renamed = 0;
    for (const v of Object.values(perScope)) {
        total += v.total || 0;
        created += v.created || 0;
        updated += v.updated || 0;
        skipped += v.skipped || 0;
        renamed += v.renamed || 0;
    }
    return { total, created, updated, skipped, renamed };
}

async function importGroup(group, payload, policy) {
    const perScope = {};
    // 业务 SDK scope
    for (const scope of group.scopes) {
        const items = payload?.data?.[scope.name];
        if (Array.isArray(items)) {
            perScope[scope.name] = await putScopeItems(scope.name, items, policy);
        }
    }
    // 兜底 IndexedDB 表
    for (const storeName of group.fallbackStores || []) {
        if (perScope[storeName]) continue;
        const items = payload?.data?.[storeName];
        if (Array.isArray(items)) {
            perScope[storeName] = await putStoreItems(storeName, items, policy);
        }
    }
    return perScope;
}

async function importAll(payload, policy) {
    const summary = {};
    for (const g of BUSINESS_GROUPS) {
        const groupPayload = payload?.groups?.[g.id];
        if (groupPayload) {
            summary[g.id] = summarizeResult(await importGroup(g, groupPayload, policy));
        }
    }
    return summary;
}

// ============================================
// 渲染入口
// ============================================

export function renderImportExportSection(app) {
    const state = app.state.importExport || {};
    const tab = state.tab || 'export';
    const policy = state.policy || 'overwrite';
    const importTarget = state.importTarget || '';
    const lastResult = state.lastResult || null;

    return `
        <div class="ie-page">
            <div class="ie-tabs">
                <button class="ie-tab ${tab === 'export' ? 'is-active' : ''}"
                    data-ie-tab="export">导出</button>
                <button class="ie-tab ${tab === 'import' ? 'is-active' : ''}"
                    data-ie-tab="import">导入</button>
            </div>

            ${tab === 'export' ? renderExportTab() : ''}
            ${tab === 'import' ? renderImportTab(importTarget, policy, lastResult) : ''}
        </div>
    `;
}

// ============================================
// Tab 1: 导出
// ============================================

function renderExportTab() {
    return `
        <div class="ie-content">
            <div class="ie-section">
                <div class="ie-section-title">按业务分组导出</div>
                <p class="ie-desc">每个分组都包含自己旗下的全部数据。导出文件为 JSON，可用于备份、迁移、分享。</p>
                <div class="ie-group-list">
                    ${BUSINESS_GROUPS.map(g => `
                        <div class="ie-group" style="--ie-accent:${g.color}">
                            <div class="ie-group__head">
                                <span class="ie-group__dot"></span>
                                <span class="ie-group__label">${escapeHtml(g.label)}</span>
                            </div>
                            <p class="ie-group__desc">${escapeHtml(g.desc)}</p>
                            <div class="ie-group__scopes">
                                ${[...g.scopes.map(s => s.label), ...(g.fallbackStores || []).map(s => s)].map(t => `
                                    <span class="ie-scope-chip">${escapeHtml(t)}</span>
                                `).join('')}
                            </div>
                            <div class="ie-group__actions">
                                <button class="ie-btn ie-btn--primary" data-ie-action="export-group" data-group="${escapeHtml(g.id)}">导出该分组</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="ie-section">
                <div class="ie-section-title">一键导出全部业务数据</div>
                <p class="ie-desc">把所有分组打包到一个文件，结构为 { groups: { users: {...}, ai: {...}, world: {...}, prompt: {...} } }。</p>
                <button class="ie-btn ie-btn--primary" data-ie-action="export-all">导出全部</button>
            </div>
        </div>
    `;
}

// ============================================
// Tab 2: 导入
// ============================================

function renderImportTab(importTarget, policy, lastResult) {
    return `
        <div class="ie-content">
            <div class="ie-section">
                <div class="ie-section-title">选择文件与目标</div>
                <p class="ie-desc">导入逻辑：按主键 id 合并记录。冲突时按下方「冲突策略」处理。</p>

                <div class="ie-form-row">
                    <label class="ie-form-label">目标分组</label>
                    <select class="ie-form-select" data-ie-input="target">
                        <option value="">-- 请选择要导入到哪个分组 --</option>
                        ${BUSINESS_GROUPS.map(g => `
                            <option value="${escapeHtml(g.id)}" ${importTarget === g.id ? 'selected' : ''}>
                                ${escapeHtml(g.label)}
                            </option>
                        `).join('')}
                        <option value="__full__" ${importTarget === '__full__' ? 'selected' : ''}>全部（用全库导出文件）</option>
                    </select>
                </div>

                <div class="ie-form-row">
                    <label class="ie-form-label">冲突策略</label>
                    <div class="ie-policy-group">
                        ${[
                            { id: 'overwrite', label: '覆盖', desc: '用新数据覆盖同 id 的旧记录（默认）' },
                            { id: 'skip',      label: '跳过', desc: '同 id 的旧记录保留，只新增' },
                            { id: 'rename',    label: '新建副本', desc: '给新记录加上时间戳后缀，保留旧记录' },
                        ].map(p => `
                            <label class="ie-policy ${policy === p.id ? 'is-active' : ''}">
                                <input type="radio" name="ie-policy" value="${escapeHtml(p.id)}" ${policy === p.id ? 'checked' : ''} data-ie-input="policy" />
                                <span class="ie-policy__label">${escapeHtml(p.label)}</span>
                                <span class="ie-policy__desc">${escapeHtml(p.desc)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <input type="file" id="ie-import-file" accept=".json" style="display:none;" />
                <button class="ie-btn ie-btn--primary" data-ie-action="pick-file">选择 JSON 并导入</button>
            </div>

            ${lastResult ? `
                <div class="ie-section">
                    <div class="ie-section-title">上次导入结果</div>
                    <pre class="ie-result">${escapeHtml(safeJSONStringify(lastResult))}</pre>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================
// 方法
// ============================================

export function buildImportExportMethods() {
    function refresh() {
        try { window.refreshPhoneApps?.(); } catch (_) {}
    }

    function setState(app, patch) {
        if (!app.state.importExport) app.state.importExport = { tab: 'export', policy: 'overwrite' };
        Object.assign(app.state.importExport, patch);
    }

    function notify(kind, title, sub) {
        try { window.settingsApp?.toolkit?.island?.notify(kind, title, sub); } catch (_) {}
    }

    return {
        // ---- tab 切换 ----
        ieSetTab({ tab }) {
            setState(this.app, { tab });
            refresh();
        },

        // ---- 表单状态同步 ----
        ieSetPolicy({ policy }) {
            setState(this.app, { policy });
            refresh();
        },

        ieSetTarget({ target }) {
            setState(this.app, { importTarget: target });
            refresh();
        },

        // ---- 导出 ----
        async ieExportGroup({ group }) {
            const g = BUSINESS_GROUPS.find(x => x.id === group);
            if (!g) return notify('error', '未知分组', group);
            try {
                const payload = await exportGroup(g);
                const filename = `xiaoting_${g.id}_${Date.now()}.json`;
                downloadBlob(new Blob([safeJSONStringify(payload)], { type: 'application/json' }), filename);
                notify('success', '已导出', `${g.label} → ${filename}`);
            } catch (e) {
                notify('error', '导出失败', e.message || String(e));
            }
        },

        async ieExportAll() {
            try {
                const payload = await exportAll();
                const filename = `xiaoting_business_full_${Date.now()}.json`;
                downloadBlob(new Blob([safeJSONStringify(payload)], { type: 'application/json' }), filename);
                notify('success', '已导出全部业务数据', filename);
            } catch (e) {
                notify('error', '导出失败', e.message || String(e));
            }
        },

        // ---- 导入：点击按钮 → 触发文件选择 ----
        iePickFile() {
            const app = this.app;
            const target = app.state.importExport?.importTarget || '';
            if (!target) {
                notify('warning', '请先选择目标分组', '');
                return;
            }
            const input = document.getElementById('ie-import-file');
            if (input) input.click();
        },

        // ---- 真正导入（异步文件读取后派发） ----
        async ieDoImport({ json }) {
            const app = this.app;
            const state = app.state.importExport || {};
            const target = state.importTarget;
            const policy = state.policy || 'overwrite';
            if (!target) return notify('warning', '请先选择目标分组', '');
            if (!json) return notify('error', '文件为空', '');

            let payload;
            try { payload = JSON.parse(json); }
            catch (e) { return notify('error', 'JSON 解析失败', e.message); }

            try {
                let summary;
                if (target === '__full__') {
                    summary = await importAll(payload, policy);
                } else {
                    const g = BUSINESS_GROUPS.find(x => x.id === target);
                    if (!g) return notify('error', '未知分组', target);
                    const groupPayload = payload?.groups?.[target] || payload;
                    const perScope = await importGroup(g, groupPayload, policy);
                    summary = { [target]: summarizeResult(perScope) };
                }
                setState(app, { lastResult: summary });
                notify('success', '导入完成', '');
                refresh();
            } catch (e) {
                notify('error', '导入失败', e.message || String(e));
            }
        },
    };
}

// ============================================
// 全局事件监听（无需手动注册到 framework）
// ============================================

if (typeof window !== 'undefined') {
    document.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const btn = target.closest('[data-ie-action]');
        if (!btn) return;
        // 只在 settings app 内响应
        const shell = target.closest('.app-shell');
        if (!shell) return;

        const action = btn.getAttribute('data-ie-action');
        const group = btn.getAttribute('data-group');

        switch (action) {
            case 'export-group':
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'appMethod', appId: 'settings', method: 'ieExportGroup', payload: { group } },
                }));
                break;
            case 'export-all':
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'appMethod', appId: 'settings', method: 'ieExportAll', payload: {} },
                }));
                break;
            case 'pick-file':
                window.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'appMethod', appId: 'settings', method: 'iePickFile', payload: {} },
                }));
                break;
        }
    }, true);

    // tab 切换
    document.addEventListener('click', (event) => {
        const t = event.target;
        if (!(t instanceof HTMLElement)) return;
        const tabBtn = t.closest('[data-ie-tab]');
        if (!tabBtn) return;
        if (!t.closest('.app-shell')) return;
        const tab = tabBtn.getAttribute('data-ie-tab');
        window.dispatchEvent(new CustomEvent('app:page-action', {
            detail: { action: 'appMethod', appId: 'settings', method: 'ieSetTab', payload: { tab } },
        }));
    }, true);

    // 表单同步
    document.addEventListener('change', (event) => {
        const t = event.target;
        if (!(t instanceof HTMLElement)) return;
        if (!t.closest('.app-shell')) return;
        const which = t.getAttribute('data-ie-input');
        if (which === 'policy') {
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'settings', method: 'ieSetPolicy', payload: { policy: t.value } },
            }));
        } else if (which === 'target') {
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'settings', method: 'ieSetTarget', payload: { target: t.value } },
            }));
        }
    }, true);

    // 文件选择
    document.addEventListener('change', async (event) => {
        const t = event.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id !== 'ie-import-file') return;
        const file = t.files?.[0];
        t.value = '';
        if (!file) return;
        try {
            const text = await readFileAsText(file);
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'settings', method: 'ieDoImport', payload: { json: text } },
            }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'appMethod', appId: 'settings', method: 'ieDoImport', payload: { json: '' } },
            }));
        }
    }, true);
}