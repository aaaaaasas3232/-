/**
 * Prompt 模块 · 业务方法层
 *
 * 所有 UI 触发的操作（由 action system → appMethod 调用）都在这里。
 * 数据层委托给 prompt-db.js，渲染层在 section.js。
 *
 * 渲染模式：预加载（同步）
 */

import {
    getAllLibraries,
    getLibraryPackages,
    getPackageGroups,
    getGroupPrompts,
    getGroup,
    getGroupWithPath,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    createPackage,
    updatePackage,
    deletePackage,
    createGroup,
    updateGroup,
    deleteGroup,
    createPrompt,
    updatePrompt,
    deletePrompt,
    countChildren,
} from './prompt-db.js';

// ============================================
// 内存缓存 + UI 状态
// ============================================

let _cache = {
    libraries: [],
    packages: [],
    groups: [],
    prompts: [],

    currentView: 'libraries',
    currentLibraryId: null,
    currentPackageId: null,
    currentGroupId: null,

    _modalType: null,
    _modalData: null,

    _editPromptId: null,
    _previewTime: null,

    _lastRenderKey: 0,
};

export const getPromptCache = () => _cache;

export async function loadPromptCache() {
    try {
        _cache.libraries = await getAllLibraries();
    } catch {
        _cache.libraries = [];
    }
}

export const setPromptCache = (patch) => Object.assign(_cache, patch);

// ============================================
// 工具函数
// ============================================

const _invalidate = () => {
    _cache._lastRenderKey = Date.now();
    if (typeof window !== 'undefined') {
        window.refreshPhoneApps?.();
    }
};

const _getInputValue = (id) => {
    const el = document.getElementById(id);
    return el?.value || '';
};

const _getTextareaValue = (id) => {
    const el = document.getElementById(id);
    return el?.value || '';
};

const _showModal = (type, data = {}) => {
    _cache._modalType = type;
    _cache._modalData = data;
    _invalidate();
};

const _closeModal = () => {
    _cache._modalType = null;
    _cache._modalData = null;
    _cache._editPromptId = null;
    _invalidate();
};

const _toast = (type, title, msg) => {
    if (typeof window !== 'undefined' && window.toolkit?.island) {
        window.toolkit.island.notify(type === 'error' ? 'error' : 'success', title, msg);
    }
};

const _reloadAll = () => {
    getAllLibraries().then(libs => {
        _cache.libraries = libs;
        if (_cache.currentView === 'packages' && _cache.currentLibraryId) {
            return getLibraryPackages(_cache.currentLibraryId);
        }
        return null;
    }).then(pkgs => {
        if (pkgs) _cache.packages = pkgs;
        if (_cache.currentView === 'groups' && _cache.currentPackageId) {
            return getPackageGroups(_cache.currentPackageId);
        }
        return null;
    }).then(groups => {
        if (groups) _cache.groups = groups;
        if (_cache.currentView === 'prompts' && _cache.currentGroupId) {
            return getGroupPrompts(_cache.currentGroupId);
        }
        return null;
    }).then(prompts => {
        if (prompts) _cache.prompts = prompts;
        _invalidate();
    }).catch(e => { console.error('[prompt] _reloadAll error:', e); _invalidate(); });
};

const _reloadPackages = (libraryId) => {
    getLibraryPackages(libraryId).then(pkgs => {
        _cache.packages = _cache.packages.filter(p => p.libraryId !== libraryId).concat(pkgs);
        _invalidate();
    });
};

const _reloadGroups = (packageId) => {
    getPackageGroups(packageId).then(groups => {
        _cache.groups = _cache.groups.filter(g => g.packageId !== packageId).concat(groups);
        _invalidate();
    });
};

const _reloadPrompts = (groupId) => {
    getGroupPrompts(groupId).then(prompts => {
        _cache.prompts = _cache.prompts.filter(p => p.groupId !== groupId).concat(prompts);
        _invalidate();
    });
};

// ============================================
// 方法合集
// ============================================

export const buildPromptMethods = () => ({
    // ---- 导航 ----
    promptOpenLibrary: async ({ libraryId }) => {
        _cache.currentView = 'packages';
        _cache.currentLibraryId = libraryId;
        _cache.currentPackageId = null;
        _cache.currentGroupId = null;
        _reloadPackages(libraryId);
    },

    promptOpenPackage: async ({ packageId, libraryId }) => {
        _cache.currentView = 'groups';
        _cache.currentPackageId = packageId;
        _cache.currentLibraryId = libraryId;
        _cache.currentGroupId = null;
        _reloadGroups(packageId);
    },

    promptOpenGroup: async ({ groupId, packageId }) => {
        _cache.currentView = 'prompts';
        _cache.currentGroupId = groupId;
        _cache.currentPackageId = packageId;
        _reloadPrompts(groupId);
    },

    promptGoBack: ({ level }) => {
        switch (level) {
            case 'library':
                _cache.currentView = 'libraries';
                _cache.currentLibraryId = null;
                _cache.currentPackageId = null;
                _cache.currentGroupId = null;
                break;
            case 'package':
                _cache.currentView = 'packages';
                _cache.currentPackageId = null;
                _cache.currentGroupId = null;
                break;
            case 'group':
                _cache.currentView = 'groups';
                _cache.currentGroupId = null;
                break;
        }
        _invalidate();
    },

    // ---- Prompt 库 CRUD ----
    promptShowAddLibrary: () => _showModal('addLibrary'),

    promptCreateLibrary: async () => {
        const name = _getInputValue('prompt-lib-name')?.trim();
        const description = _getInputValue('prompt-lib-desc')?.trim() || '';
        if (!name) return;
        try {
            await createLibrary({ name, description });
            _closeModal();
            _reloadAll();
            _toast('success', '已创建', name);
        } catch (e) { _toast('error', '创建失败', e.message); }
    },

    promptEditLibrary: ({ libraryId }) => {
        const lib = _cache.libraries.find(l => l.id === libraryId);
        if (!lib) return;
        _showModal('editLibrary', { libraryId, name: lib.name, description: lib.description || '' });
    },

    promptSaveLibrary: async ({ libraryId }) => {
        const name = _getInputValue('prompt-lib-name')?.trim();
        const description = _getInputValue('prompt-lib-desc')?.trim() || '';
        if (!name) return;
        try {
            await updateLibrary(libraryId, { name, description });
            _closeModal();
            _reloadAll();
        } catch (e) { _toast('error', '保存失败', e.message); }
    },

    promptDeleteLibrary: async ({ libraryId }) => {
        const lib = _cache.libraries.find(l => l.id === libraryId);
        if (!lib) return;
        const count = await countChildren('packages', libraryId);
        if (count > 0) {
            _toast('error', '无法删除', '请先删除库内的所有 Prompt 包');
            return;
        }
        _showModal('confirmDelete', { type: 'library', id: libraryId, name: lib.name });
    },

    // ---- Prompt 包 CRUD ----
    promptShowAddPackage: ({ libraryId }) => {
        _cache._tempLibraryId = libraryId;
        _showModal('addPackage');
    },

    promptCreatePackage: async ({ libraryId }) => {
        const safeLibraryId = libraryId || _cache._tempLibraryId;
        const name = _getInputValue('prompt-pkg-name')?.trim();
        const description = _getInputValue('prompt-pkg-desc')?.trim() || '';
        if (!name || !safeLibraryId) return;
        try {
            await createPackage({ libraryId: safeLibraryId, name, description });
            _closeModal();
            _reloadPackages(safeLibraryId);
            _toast('success', '已创建', name);
        } catch (e) { _toast('error', '创建失败', e.message); }
    },

    promptEditPackage: ({ packageId }) => {
        const pkg = _cache.packages.find(p => p.id === packageId);
        if (!pkg) return;
        _showModal('editPackage', { packageId, name: pkg.name, description: pkg.description || '' });
    },

    promptSavePackage: async ({ packageId }) => {
        const name = _getInputValue('prompt-pkg-name')?.trim();
        const description = _getInputValue('prompt-pkg-desc')?.trim() || '';
        if (!name) return;
        try {
            await updatePackage(packageId, { name, description });
            _closeModal();
            const pkg = _cache.packages.find(p => p.id === packageId);
            if (pkg) _reloadPackages(pkg.libraryId);
        } catch (e) { _toast('error', '保存失败', e.message); }
    },

    promptDeletePackage: async ({ packageId }) => {
        const pkg = _cache.packages.find(p => p.id === packageId);
        if (!pkg) return;
        const count = await countChildren('groups', packageId);
        if (count > 0) {
            _toast('error', '无法删除', '请先删除包内的所有 Prompt 组');
            return;
        }
        _showModal('confirmDelete', { type: 'package', id: packageId, name: pkg.name });
    },

    // ---- Prompt 组 CRUD ----
    promptShowAddGroup: ({ packageId }) => {
        _cache._tempPackageId = packageId;
        _showModal('addGroup');
    },

    promptCreateGroup: async ({ packageId }) => {
        const safePackageId = packageId || _cache._tempPackageId;
        const name = _getInputValue('prompt-grp-name')?.trim();
        if (!name || !safePackageId) return;
        try {
            const pkg = _cache.packages.find(p => p.id === safePackageId);
            await createGroup({
                packageId: safePackageId,
                libraryId: pkg?.libraryId,
                name,
            });
            _closeModal();
            _reloadGroups(safePackageId);
            _toast('success', '已创建', name);
        } catch (e) { _toast('error', '创建失败', e.message); }
    },

    promptEditGroup: ({ groupId }) => {
        const group = _cache.groups.find(g => g.id === groupId);
        if (!group) return;
        _showModal('editGroup', {
            groupId,
            name: group.name,
            priority: group.priority ?? 10,
            injectionDepth: group.injectionDepth ?? '',
            timeWindowEnabled: group.timeWindow?.enabled ?? false,
            timeWindowStart: group.timeWindow?.start ?? '00:00',
            timeWindowEnd: group.timeWindow?.end ?? '23:59',
            timeWindowDays: group.timeWindow?.daysOfWeek ?? [0,1,2,3,4,5,6],
            historyDepth: group.historyDepth ?? 1,
            enabled: group.enabled ?? true,
        });
    },

    promptSaveGroup: async ({ groupId }) => {
        const name = _getInputValue('prompt-grp-name')?.trim();
        const priority = parseInt(_getInputValue('prompt-grp-priority') || '10', 10);
        const injectionDepthRaw = _getInputValue('prompt-grp-depth');
        const injectionDepth = injectionDepthRaw === '' ? null : parseInt(injectionDepthRaw, 10);
        const timeWindowEnabled = document.getElementById('prompt-grp-tw-enable')?.checked ?? false;
        const timeWindowStart = _getInputValue('prompt-grp-tw-start') || '00:00';
        const timeWindowEnd = _getInputValue('prompt-grp-tw-end') || '23:59';
        const historyDepth = parseInt(_getInputValue('prompt-grp-hist-depth') || '1', 10);
        const enabled = document.getElementById('prompt-grp-enabled')?.checked ?? true;

        const timeWindow = timeWindowEnabled
            ? { enabled: true, start: timeWindowStart, end: timeWindowEnd, daysOfWeek: [0,1,2,3,4,5,6] }
            : null;

        if (!name) return;
        try {
            await updateGroup(groupId, {
                name,
                priority: isNaN(priority) ? 10 : priority,
                injectionDepth,
                timeWindow,
                historyDepth: Math.min(Math.max(historyDepth, 1), 5),
                enabled,
            });
            _closeModal();
            const group = _cache.groups.find(g => g.id === groupId);
            if (group) _reloadGroups(group.packageId);
        } catch (e) { _toast('error', '保存失败', e.message); }
    },

    promptDeleteGroup: ({ groupId }) => {
        const group = _cache.groups.find(g => g.id === groupId);
        if (!group) return;
        _showModal('confirmDelete', { type: 'group', id: groupId, name: group.name });
    },

    // ---- Prompt 条目 CRUD ----
    promptShowAddPrompt: ({ groupId }) => {
        _cache._tempGroupId = groupId;
        _showModal('addPrompt');
    },

    promptCreatePrompt: async ({ groupId }) => {
        const safeGroupId = groupId || _cache._tempGroupId;
        const text = _getTextareaValue('prompt-item-text')?.trim();
        const keywordsRaw = _getInputValue('prompt-item-keywords')?.trim() || '';
        const keywords = keywordsRaw ? keywordsRaw.split(/[,，]/).map(k => k.trim()).filter(Boolean) : [];

        if (!text) {
            _toast('error', '创建失败', 'Prompt 内容不能为空');
            return;
        }
        try {
            const group = _cache.groups.find(g => g.id === safeGroupId);
            await createPrompt({
                groupId: safeGroupId,
                packageId: group?.packageId,
                libraryId: group?.libraryId,
                text,
                keywords,
            });
            _closeModal();
            _reloadPrompts(safeGroupId);
            _toast('success', '已创建', 'Prompt 条目');
        } catch (e) { _toast('error', '创建失败', e.message); }
    },

    promptEditPrompt: ({ promptId }) => {
        const prompt = _cache.prompts.find(p => p.id === promptId);
        if (!prompt) return;
        _showModal('editPrompt', {
            promptId,
            text: prompt.text || '',
            keywords: (prompt.keywords || []).join(', '),
            priorityEnabled: prompt.priority?.enabled ?? false,
            priorityValue: prompt.priority?.value ?? 10,
            timeWindowEnabled: prompt.timeWindow?.enabled ?? false,
            timeWindowStart: prompt.timeWindow?.start ?? '00:00',
            timeWindowEnd: prompt.timeWindow?.end ?? '23:59',
            injectionDepthEnabled: prompt.injectionDepth?.enabled ?? false,
            injectionDepthValue: prompt.injectionDepth?.value ?? 0,
            vectorFallback: prompt.vectorFallback ?? false,
            vectorThreshold: prompt.vectorThreshold ?? 0.6,
        });
    },

    promptSavePrompt: async ({ promptId }) => {
        const text = _getTextareaValue('prompt-item-text')?.trim();
        const keywordsRaw = _getInputValue('prompt-item-keywords')?.trim() || '';
        const keywords = keywordsRaw ? keywordsRaw.split(/[,，]/).map(k => k.trim()).filter(Boolean) : [];
        const priorityEnabled = document.getElementById('prompt-item-priority-enable')?.checked ?? false;
        const priorityValue = parseInt(_getInputValue('prompt-item-priority-value') || '10', 10);
        const timeWindowEnabled = document.getElementById('prompt-item-tw-enable')?.checked ?? false;
        const timeWindowStart = _getInputValue('prompt-item-tw-start') || '00:00';
        const timeWindowEnd = _getInputValue('prompt-item-tw-end') || '23:59';
        const injectionDepthEnabled = document.getElementById('prompt-item-depth-enable')?.checked ?? false;
        const injectionDepthValue = parseInt(_getInputValue('prompt-item-depth-value') || '0', 10);
        const vectorFallback = document.getElementById('prompt-item-vector')?.checked ?? false;
        const vectorThreshold = parseFloat(_getInputValue('prompt-item-threshold') || '0.6');

        if (!text) {
            _toast('error', '保存失败', 'Prompt 内容不能为空');
            return;
        }

        const timeWindow = timeWindowEnabled
            ? { enabled: true, start: timeWindowStart, end: timeWindowEnd, daysOfWeek: [0,1,2,3,4,5,6] }
            : null;

        try {
            await updatePrompt(promptId, {
                text,
                keywords,
                priority: priorityEnabled ? { enabled: true, value: isNaN(priorityValue) ? 10 : priorityValue } : { enabled: false, value: 10 },
                timeWindow,
                injectionDepth: injectionDepthEnabled ? { enabled: true, value: isNaN(injectionDepthValue) ? 0 : injectionDepthValue } : { enabled: false, value: 0 },
                vectorFallback,
                vectorThreshold: isNaN(vectorThreshold) ? 0.6 : vectorThreshold,
            });
            _closeModal();
            const prompt = _cache.prompts.find(p => p.id === promptId);
            if (prompt) _reloadPrompts(prompt.groupId);
        } catch (e) { _toast('error', '保存失败', e.message); }
    },

    promptDeletePrompt: ({ promptId }) => {
        const prompt = _cache.prompts.find(p => p.id === promptId);
        if (!prompt) return;
        _showModal('confirmDelete', { type: 'prompt', id: promptId, name: prompt.text?.slice(0, 20) || 'Prompt 条目' });
    },

    // ---- 确认删除 ----
    promptConfirmDelete: async ({ type, id }) => {
        try {
            switch (type) {
                case 'library': await deleteLibrary(id); break;
                case 'package': await deletePackage(id); break;
                case 'group': await deleteGroup(id); break;
                case 'prompt': await deletePrompt(id); break;
            }
            _closeModal();
            await _reloadAll();
            _toast('success', '已删除', '');
        } catch (e) { _toast('error', '删除失败', e.message); }
    },

    // ---- 弹窗控制 ----
    promptCloseModal: () => _closeModal(),

    // ---- 预览时间设置 ----
    promptSetPreviewTime: ({ time }) => {
        _cache._previewTime = time;
        _invalidate();
    },

    promptResetPreviewTime: () => {
        _cache._previewTime = null;
        _invalidate();
    },
});
