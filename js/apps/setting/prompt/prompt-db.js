/**
 * Prompt 模块 · IndexedDB 操作层
 *
 * 数据结构（4层，对齐图库）：
 *   - library (Prompt 库): { id, name, icon, color, _num, description, order, createdAt, updatedAt }
 *   - package (Prompt 包): { id, libraryId, name, _num, description, order, createdAt, updatedAt }
 *   - group   (Prompt 组): { id, packageId, libraryId, name, _num, priority, injectionDepth,
 *                             timeWindow, conditions, historyDepth, enabled, order, createdAt, updatedAt }
 *   - prompt  (Prompt 条目): { id, groupId, packageId, libraryId, order,
 *                              priority, timeWindow, injectionDepth, keywords, text, variables,
 *                              vectorFallback, vectorThreshold, createdAt, updatedAt }
 *
 * 数据库：单独的 'prompt_db'
 */

import { ListenDb } from '@/js/db/engine.js';

// ============================================
// 数据库初始化
// ============================================

let _promptDb = null;

export async function initPromptDb() {
    if (_promptDb) return _promptDb.open();

    _promptDb = new ListenDb({
        dbName: 'prompt_db',
        dbVersion: 1,
    });

    _promptDb.registerStore('libraries', 'id');
    _promptDb.registerStore('packages', 'id');
    _promptDb.registerStore('groups', 'id');
    _promptDb.registerStore('prompts', 'id');

    _promptDb.open().catch(err => {
        console.error('[prompt-db] 初始化失败', err);
    });

    return _promptDb.open();
}

async function _withDb(fn) {
    if (!_promptDb) {
        await initPromptDb();
    }
    if (_promptDb.ready) {
        await _promptDb.ready;
    }
    return fn(_promptDb);
}

// ============================================
// Prompt 库 (Library) CRUD
// ============================================

export async function getAllLibraries() {
    return _withDb(async (db) => {
        const all = await db.getAllRecords('libraries');
        return all.sort((a, b) => a.order ?? a.createdAt - (b.order ?? b.createdAt));
    });
}

export async function getLibrary(id) {
    return _withDb(db => db.get('libraries', id));
}

export async function createLibrary({ name, description = '', icon = '', color = '#3b82f6' }) {
    return _withDb(async (db) => {
        const all = await db.getAllRecords('libraries');
        if (all.length >= 9) throw new Error('Prompt 库上限9个');

        const usedNumbers = new Set(all.map(l => l._num ?? 0));
        let num = 0;
        while (usedNumbers.has(num) && num < 9) num++;
        if (num >= 9) throw new Error('Prompt 库编号已满');

        const id = `plib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = {
            id, name, description, icon, color,
            _num: num,
            order: all.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await db.put('libraries', record);
        return record;
    });
}

export async function updateLibrary(id, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('libraries', id);
        if (!existing) throw new Error('Prompt 库不存在');
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        await db.put('libraries', updated);
        return updated;
    });
}

export async function deleteLibrary(id) {
    return _withDb(async (db) => {
        const packages = await db.find('packages', p => p.libraryId === id);
        if (packages.length > 0) {
            throw new Error('请先删除库内的所有 Prompt 包');
        }
        await db.remove('libraries', id);
    });
}

// ============================================
// Prompt 包 (Package) CRUD
// ============================================

export async function getLibraryPackages(libraryId) {
    return _withDb(async (db) => {
        const packages = await db.find('packages', p => p.libraryId === libraryId);
        return packages.sort((a, b) => a.order ?? a.createdAt - (b.order ?? b.createdAt));
    });
}

export async function getPackage(id) {
    return _withDb(db => db.get('packages', id));
}

export async function createPackage({ libraryId, name, description = '' }) {
    return _withDb(async (db) => {
        const library = await db.get('libraries', libraryId);
        if (!library) throw new Error('Prompt 库不存在');

        const packages = await db.find('packages', p => p.libraryId === libraryId);
        if (packages.length >= 9) throw new Error('Prompt 包上限9个');

        const usedNumbers = new Set(packages.map(p => p._num ?? 0));
        let num = 0;
        while (usedNumbers.has(num) && num < 9) num++;
        if (num >= 9) throw new Error('Prompt 包编号已满');

        const id = `ppkg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = {
            id, libraryId, name, description,
            _num: num,
            order: packages.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await db.put('packages', record);
        return record;
    });
}

export async function updatePackage(id, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('packages', id);
        if (!existing) throw new Error('Prompt 包不存在');
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        await db.put('packages', updated);
        return updated;
    });
}

export async function deletePackage(id) {
    return _withDb(async (db) => {
        const groups = await db.find('groups', g => g.packageId === id);
        if (groups.length > 0) {
            throw new Error('请先删除包内的所有 Prompt 组');
        }
        await db.remove('packages', id);
    });
}

// ============================================
// Prompt 组 (Group) CRUD
// ============================================

export async function getPackageGroups(packageId) {
    return _withDb(async (db) => {
        const groups = await db.find('groups', g => g.packageId === packageId);
        return groups.sort((a, b) => a.order ?? a.createdAt - (b.order ?? b.createdAt));
    });
}

export async function getGroup(id) {
    return _withDb(db => db.get('groups', id));
}

export async function createGroup({ packageId, libraryId, name, priority = 10, injectionDepth = null, timeWindow = null, historyDepth = 1, enabled = true }) {
    return _withDb(async (db) => {
        const pkg = await db.get('packages', packageId);
        if (!pkg) throw new Error('Prompt 包不存在');

        const groups = await db.find('groups', g => g.packageId === packageId);
        if (groups.length >= 9) throw new Error('Prompt 组上限9个');

        const usedNumbers = new Set(groups.map(g => g._num ?? 0));
        let num = 0;
        while (usedNumbers.has(num) && num < 9) num++;
        if (num >= 9) throw new Error('Prompt 组编号已满');

        const id = `pgrp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = {
            id, packageId, libraryId, name,
            _num: num,
            priority,
            injectionDepth,
            timeWindow,
            conditions: { enabled: false },
            historyDepth,
            enabled,
            order: groups.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await db.put('groups', record);
        return record;
    });
}

export async function updateGroup(id, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('groups', id);
        if (!existing) throw new Error('Prompt 组不存在');
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        await db.put('groups', updated);
        return updated;
    });
}

export async function deleteGroup(id) {
    return _withDb(async (db) => {
        const group = await db.get('groups', id);
        if (!group) throw new Error('Prompt 组不存在');

        const prompts = await db.find('prompts', p => p.groupId === id);
        for (const p of prompts) {
            await db.remove('prompts', p.id);
        }
        await db.remove('groups', id);
    });
}

// ============================================
// Prompt 条目 CRUD
// ============================================

export async function getGroupPrompts(groupId) {
    return _withDb(async (db) => {
        const prompts = await db.find('prompts', p => p.groupId === groupId);
        return prompts.sort((a, b) => a.order - b.order);
    });
}

export async function getPrompt(id) {
    return _withDb(db => db.get('prompts', id));
}

export async function createPrompt({ groupId, packageId, libraryId, text, keywords = [], priority = null, injectionDepth = null, timeWindow = null, vectorFallback = false, vectorThreshold = 0.6 }) {
    return _withDb(async (db) => {
        const group = await db.get('groups', groupId);
        if (!group) throw new Error('Prompt 组不存在');

        const prompts = await db.find('prompts', p => p.groupId === groupId);

        const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = {
            id, groupId, packageId: packageId ?? group.packageId, libraryId: libraryId ?? group.libraryId,
            order: prompts.length,
            text,
            keywords,
            priority: priority !== null ? { enabled: false, value: priority } : null,
            timeWindow: timeWindow !== null ? { enabled: false, start: '00:00', end: '23:59', daysOfWeek: [0,1,2,3,4,5,6], ...timeWindow } : null,
            injectionDepth: injectionDepth !== null ? { enabled: false, value: injectionDepth } : null,
            vectorFallback,
            vectorThreshold,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await db.put('prompts', record);
        return record;
    });
}

export async function updatePrompt(id, patch) {
    return _withDb(async (db) => {
        const existing = await db.get('prompts', id);
        if (!existing) throw new Error('Prompt 条目不存在');
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        await db.put('prompts', updated);
        return updated;
    });
}

export async function deletePrompt(id) {
    return _withDb(async (db) => {
        await db.remove('prompts', id);
    });
}

// ============================================
// 辅助查询
// ============================================

export async function countChildren(type, parentId) {
    return _withDb(async (db) => {
        switch (type) {
            case 'packages': return (await db.find('packages', p => p.libraryId === parentId)).length;
            case 'groups': return (await db.find('groups', g => g.packageId === parentId)).length;
            case 'prompts': return (await db.find('prompts', p => p.groupId === parentId)).length;
            default: return 0;
        }
    });
}

export async function getGroupWithPath(groupId) {
    return _withDb(async (db) => {
        const group = await db.get('groups', groupId);
        if (!group) return null;
        const pkg = await db.get('packages', group.packageId);
        if (!pkg) return null;
        const lib = await db.get('libraries', group.libraryId);
        if (!lib) return null;
        return { library: lib, package: pkg, group };
    });
}

// ============================================
// 拼装相关工具函数
// ============================================

export function isInTimeWindow(timeWindow, now = new Date()) {
    if (!timeWindow?.enabled) return true;
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = (timeWindow.start ?? '00:00').split(':').map(Number);
    const [eh, em] = (timeWindow.end ?? '23:59').split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const inRange = start <= end
        ? cur >= start && cur < end
        : cur >= start || cur < end;
    if (!inRange) return false;
    if (Array.isArray(timeWindow.daysOfWeek) && timeWindow.daysOfWeek.length < 7) {
        return timeWindow.daysOfWeek.includes(now.getDay());
    }
    return true;
}

export function resolveField(field, groupValue) {
    if (field === null || field === undefined) return groupValue;
    if (typeof field === 'object' && 'enabled' in field) {
        return field.enabled ? field.value : groupValue;
    }
    return field ?? groupValue;
}
