/**
 * Prompt 模块 · 渲染层
 *
 * 使用 data-app-action，框架自动处理点击事件
 * 白色主色调 + 蓝色辅助
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getPromptCache } from './prompt-methods.js';
import { isInTimeWindow } from './prompt-db.js';

const SETTINGS_APP_ID = 'settings';

const wvAction = (method, payload = {}) => {
    const obj = { action: 'appMethod', appId: SETTINGS_APP_ID, method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
};

// ============================================
// 主渲染入口（同步）
// ============================================

export function renderPromptSection() {
    const cache = getPromptCache();

    if (cache._modalType) {
        return renderModalContent(cache);
    }

    switch (cache.currentView) {
        case 'packages':  return renderPackagesView(cache);
        case 'groups':    return renderGroupsView(cache);
        case 'prompts':   return renderPromptsView(cache);
        default:          return renderLibrariesView(cache);
    }
}

// ============================================
// 视图：Prompt 库列表
// ============================================

function renderLibrariesView(cache) {
    const libs = cache.libraries || [];

    return `
        <div class="prompt-app">
            <div class="prompt-content">
                ${libs.length === 0 ? renderEmptyLibrary() : ''}
                ${libs.map(lib => renderLibraryCard(lib)).join('')}
                ${libs.length < 9 ? renderAddCard('library', '新建 Prompt 库', 'promptShowAddLibrary', {}) : ''}
            </div>
        </div>
    `;
}

function renderLibraryCard(lib) {
    const num = String(lib._num ?? 0);
    return `
        <div class="prompt-card" ${wvAction('promptOpenLibrary', { libraryId: lib.id })}>
            <div class="prompt-card__icon" style="background:linear-gradient(135deg,${lib.color || '#3b82f6'},${adjustColor(lib.color || '#3b82f6', 20)})">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
            </div>
            <div class="prompt-card__body">
                <div class="prompt-card__header">
                    <span class="prompt-card__num">${num}</span>
                    <span class="prompt-card__name">${escapeHtml(lib.name)}</span>
                </div>
                <div class="prompt-card__meta">
                    ${lib.description ? `<span class="prompt-card__desc">${escapeHtml(lib.description)}</span>` : '<span class="prompt-card__desc prompt-card__desc--empty">暂无描述</span>'}
                </div>
            </div>
            <div class="prompt-card__arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `;
}

// ============================================
// 视图：Prompt 包列表
// ============================================

function renderPackagesView(cache) {
    const libId = cache.currentLibraryId;
    const lib = (cache.libraries || []).find(l => l.id === libId);
    if (!lib) return renderLibrariesView(cache);

    const pkgs = (cache.packages || []).filter(p => p.libraryId === libId);

    return `
        <div class="prompt-app">
            <div class="prompt-nav">
                <button class="prompt-nav__back" ${wvAction('promptGoBack', { level: 'library' })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="prompt-nav__text">
                    <div class="prompt-nav__title">${escapeHtml(lib.name)}</div>
                    <div class="prompt-nav__subtitle">Prompt 包</div>
                </div>
                <div style="flex:1"></div>
                <button class="prompt-nav__action" ${wvAction('promptEditLibrary', { libraryId: libId })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <div class="prompt-content">
                ${pkgs.length === 0 ? renderEmptyPackage() : ''}
                ${pkgs.map(pkg => renderPackageCard(pkg, libId)).join('')}
                ${pkgs.length < 9 ? renderAddCard('package', '新建 Prompt 包', 'promptShowAddPackage', { libraryId: libId }) : ''}
            </div>
        </div>
    `;
}

function renderPackageCard(pkg, libraryId) {
    const num = String(pkg._num ?? 0);
    return `
        <div class="prompt-card" ${wvAction('promptOpenPackage', { packageId: pkg.id, libraryId })}>
            <div class="prompt-card__icon" style="background:linear-gradient(135deg,#0ea5e9,#38bdf8)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
            </div>
            <div class="prompt-card__body">
                <div class="prompt-card__header">
                    <span class="prompt-card__num">${num}</span>
                    <span class="prompt-card__name">${escapeHtml(pkg.name)}</span>
                </div>
                <div class="prompt-card__meta">
                    ${pkg.description ? `<span class="prompt-card__desc">${escapeHtml(pkg.description)}</span>` : '<span class="prompt-card__desc prompt-card__desc--empty">暂无描述</span>'}
                </div>
            </div>
            <div class="prompt-card__arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `;
}

// ============================================
// 视图：Prompt 组列表
// ============================================

function renderGroupsView(cache) {
    const pkgId = cache.currentPackageId;
    const pkg = (cache.packages || []).find(p => p.id === pkgId);
    if (!pkg) return renderLibrariesView(cache);

    const lib = (cache.libraries || []).find(l => l.id === pkg.libraryId);
    const groups = (cache.groups || []).filter(g => g.packageId === pkgId);

    return `
        <div class="prompt-app">
            <div class="prompt-nav">
                <button class="prompt-nav__back" ${wvAction('promptGoBack', { level: 'package' })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="prompt-nav__text">
                    <div class="prompt-nav__title">${escapeHtml(pkg.name)}</div>
                    <div class="prompt-nav__subtitle">${escapeHtml(lib?.name || '')} / Prompt 组</div>
                </div>
                <div style="flex:1"></div>
                <button class="prompt-nav__action" ${wvAction('promptEditPackage', { packageId: pkgId })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <div class="prompt-content">
                ${groups.length === 0 ? renderEmptyGroup() : ''}
                ${groups.map(group => renderGroupCard(group, pkgId)).join('')}
                ${groups.length < 9 ? renderAddCard('group', '新建 Prompt 组', 'promptShowAddGroup', { packageId: pkgId }) : ''}
            </div>
        </div>
    `;
}

function renderGroupCard(group, packageId) {
    const num = String(group._num ?? 0);
    const hasTimeWindow = group.timeWindow?.enabled;
    return `
        <div class="prompt-card" ${wvAction('promptOpenGroup', { groupId: group.id, packageId })}>
            <div class="prompt-card__icon" style="background:linear-gradient(135deg,#6366f1,#818cf8)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 9h6M9 13h4"/>
                </svg>
            </div>
            <div class="prompt-card__body">
                <div class="prompt-card__header">
                    <span class="prompt-card__num">${num}</span>
                    <span class="prompt-card__name">${escapeHtml(group.name)}</span>
                    ${!group.enabled ? '<span class="prompt-badge prompt-badge--off">已禁用</span>' : ''}
                </div>
                <div class="prompt-card__meta">
                    <span class="prompt-meta-item">
                        <span class="prompt-meta-label">优先级</span>
                        <span class="prompt-meta-value">${group.priority ?? 10}</span>
                    </span>
                    ${hasTimeWindow ? `
                        <span class="prompt-meta-item prompt-meta-item--time">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ${escapeHtml(group.timeWindow.start)} - ${escapeHtml(group.timeWindow.end)}
                        </span>
                    ` : ''}
                </div>
            </div>
            <div class="prompt-card__arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `;
}

// ============================================
// 视图：Prompt 条目列表
// ============================================

function renderPromptsView(cache) {
    const groupId = cache.currentGroupId;
    const group = (cache.groups || []).find(g => g.id === groupId);
    if (!group) return renderLibrariesView(cache);

    const pkg = (cache.packages || []).find(p => p.id === group.packageId);
    const lib = (cache.libraries || []).find(l => l.id === group.libraryId);
    const prompts = (cache.prompts || []).filter(p => p.groupId === groupId);

    return `
        <div class="prompt-app">
            <div class="prompt-nav">
                <button class="prompt-nav__back" ${wvAction('promptGoBack', { level: 'group' })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="prompt-nav__text">
                    <div class="prompt-nav__title">${escapeHtml(group.name)}</div>
                    <div class="prompt-nav__subtitle">${escapeHtml(lib?.name || '')} / ${escapeHtml(pkg?.name || '')}</div>
                </div>
                <div style="flex:1"></div>
                <button class="prompt-nav__action" ${wvAction('promptEditGroup', { groupId })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <div class="prompt-group-info">
                <div class="prompt-group-info__row">
                    <div class="prompt-group-info__item">
                        <span class="prompt-group-info__label">优先级</span>
                        <span class="prompt-group-info__value">${group.priority ?? 10}</span>
                    </div>
                    <div class="prompt-group-info__item">
                        <span class="prompt-group-info__label">状态</span>
                        <span class="prompt-group-info__value ${group.enabled ? 'prompt-group-info__value--on' : 'prompt-group-info__value--off'}">${group.enabled ? '启用' : '禁用'}</span>
                    </div>
                </div>
                ${group.timeWindow?.enabled ? `
                    <div class="prompt-group-info__row">
                        <div class="prompt-group-info__item prompt-group-info__item--full">
                            <span class="prompt-group-info__label">时间窗</span>
                            <span class="prompt-group-info__value">${escapeHtml(group.timeWindow.start)} - ${escapeHtml(group.timeWindow.end)}</span>
                        </div>
                    </div>
                ` : ''}
                ${group.historyDepth > 1 ? `
                    <div class="prompt-group-info__row">
                        <div class="prompt-group-info__item">
                            <span class="prompt-group-info__label">历史深度</span>
                            <span class="prompt-group-info__value">${group.historyDepth}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="prompt-content">
                ${prompts.length === 0 ? renderEmptyPrompt() : ''}
                ${prompts.map((p, idx) => renderPromptCard(p, idx)).join('')}
                <div class="prompt-add-item" ${wvAction('promptShowAddPrompt', { groupId })}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>添加 Prompt 条目</span>
                </div>
            </div>
        </div>
    `;
}

function renderPromptCard(prompt, index) {
    const priorityLabel = prompt.priority?.enabled
        ? `覆盖优先级: ${prompt.priority.value}`
        : '继承组优先级';

    const hasTimeWindow = prompt.timeWindow?.enabled;

    const previewTime = getPromptCache()._previewTime;
    const now = previewTime ? new Date(previewTime) : new Date();
    const inTimeWindow = isInTimeWindow(prompt.timeWindow, now);

    return `
        <div class="prompt-item-card" ${wvAction('promptEditPrompt', { promptId: prompt.id })}>
            <div class="prompt-item-card__header">
                <span class="prompt-item-card__index">${index + 1}</span>
                <div class="prompt-item-card__tags">
                    ${hasTimeWindow ? `<span class="prompt-badge prompt-badge--tw ${inTimeWindow ? '' : 'prompt-badge--inactive'}">时间窗</span>` : ''}
                </div>
            </div>
            <div class="prompt-item-card__text">${escapeHtml(prompt.text || '')}</div>
            <div class="prompt-item-card__footer">
                <span class="prompt-item-card__priority">${priorityLabel}</span>
            </div>
        </div>
    `;
}

// ============================================
// 空状态
// ============================================

function renderEmptyLibrary() {
    return `
        <div class="prompt-empty">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#bfdbfe" stroke-width="1.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <div class="prompt-empty__title">暂无 Prompt 库</div>
            <div class="prompt-empty__desc">创建一个 Prompt 库来管理你的提示词</div>
        </div>
    `;
}

function renderEmptyPackage() {
    return `
        <div class="prompt-empty">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#bfdbfe" stroke-width="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <div class="prompt-empty__title">暂无 Prompt 包</div>
            <div class="prompt-empty__desc">在库内创建一个 Prompt 包来分类管理</div>
        </div>
    `;
}

function renderEmptyGroup() {
    return `
        <div class="prompt-empty">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#bfdbfe" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 9h6M9 13h4"/>
            </svg>
            <div class="prompt-empty__title">暂无 Prompt 组</div>
            <div class="prompt-empty__desc">在包内创建一个 Prompt 组来存放提示词</div>
        </div>
    `;
}

function renderEmptyPrompt() {
    return `
        <div class="prompt-empty">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#bfdbfe" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <div class="prompt-empty__title">暂无 Prompt 条目</div>
            <div class="prompt-empty__desc">添加具体的提示词内容</div>
        </div>
    `;
}

// ============================================
// 通用卡片
// ============================================

function renderAddCard(type, label, method, payload) {
    return `
        <div class="prompt-card prompt-card--add" ${wvAction(method, payload)}>
            <div class="prompt-card__icon prompt-card__icon--add">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </div>
            <div class="prompt-card__body">
                <div class="prompt-card__name prompt-card__name--add">${label}</div>
            </div>
        </div>
    `;
}

// ============================================
// 弹窗内容
// ============================================

function renderModalContent(cache) {
    switch (cache._modalType) {
        case 'addLibrary':      return renderModalAddLibrary();
        case 'editLibrary':     return renderModalEditLibrary(cache._modalData);
        case 'addPackage':      return renderModalAddPackage();
        case 'editPackage':     return renderModalEditPackage(cache._modalData);
        case 'addGroup':        return renderModalAddGroup();
        case 'editGroup':       return renderModalEditGroup(cache._modalData);
        case 'addPrompt':       return renderModalAddPrompt();
        case 'editPrompt':      return renderModalEditPrompt(cache._modalData);
        case 'confirmDelete':   return renderModalConfirmDelete(cache._modalData);
        default:                return '';
    }
}

// ---- 库弹窗 ----

function renderModalAddLibrary() {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal">
                <div class="prompt-modal__title">新建 Prompt 库</div>
                <div class="prompt-modal__body">
                    <input class="prompt-input" type="text" id="prompt-lib-name" placeholder="库名称，如：人设通用" maxlength="20" autocomplete="off"/>
                    <textarea class="prompt-textarea" id="prompt-lib-desc" placeholder="简短描述（可选）" maxlength="100" rows="2"></textarea>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptCreateLibrary')}>创建</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalEditLibrary(data) {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal">
                <div class="prompt-modal__title">编辑 Prompt 库</div>
                <div class="prompt-modal__body">
                    <input class="prompt-input" type="text" id="prompt-lib-name" placeholder="库名称" maxlength="20" value="${escapeHtml(data.name || '')}" autocomplete="off"/>
                    <textarea class="prompt-textarea" id="prompt-lib-desc" placeholder="简短描述（可选）" maxlength="100" rows="2">${escapeHtml(data.description || '')}</textarea>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--danger" ${wvAction('promptDeleteLibrary', { libraryId: data.libraryId })}>删除</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptSaveLibrary', { libraryId: data.libraryId })}>保存</button>
                </div>
            </div>
        </div>
    `;
}

// ---- 包弹窗 ----

function renderModalAddPackage() {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal">
                <div class="prompt-modal__title">新建 Prompt 包</div>
                <div class="prompt-modal__body">
                    <input class="prompt-input" type="text" id="prompt-pkg-name" placeholder="包名称，如：聊天语气" maxlength="20" autocomplete="off"/>
                    <textarea class="prompt-textarea" id="prompt-pkg-desc" placeholder="简短描述（可选）" maxlength="100" rows="2"></textarea>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptCreatePackage')}>创建</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalEditPackage(data) {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal">
                <div class="prompt-modal__title">编辑 Prompt 包</div>
                <div class="prompt-modal__body">
                    <input class="prompt-input" type="text" id="prompt-pkg-name" placeholder="包名称" maxlength="20" value="${escapeHtml(data.name || '')}" autocomplete="off"/>
                    <textarea class="prompt-textarea" id="prompt-pkg-desc" placeholder="简短描述（可选）" maxlength="100" rows="2">${escapeHtml(data.description || '')}</textarea>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--danger" ${wvAction('promptDeletePackage', { packageId: data.packageId })}>删除</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptSavePackage', { packageId: data.packageId })}>保存</button>
                </div>
            </div>
        </div>
    `;
}

// ---- 组弹窗 ----

function renderModalAddGroup() {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal">
                <div class="prompt-modal__title">新建 Prompt 组</div>
                <div class="prompt-modal__body">
                    <input class="prompt-input" type="text" id="prompt-grp-name" placeholder="组名称，如：深夜聊天" maxlength="20" autocomplete="off"/>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptCreateGroup')}>创建</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalEditGroup(data) {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal prompt-modal--wide">
                <div class="prompt-modal__title">编辑 Prompt 组</div>
                <div class="prompt-modal__body">
                    <div class="prompt-form-group">
                        <label class="prompt-form-label">组名称</label>
                        <input class="prompt-input" type="text" id="prompt-grp-name" placeholder="组名称" maxlength="20" value="${escapeHtml(data.name || '')}" autocomplete="off"/>
                    </div>
                    <div class="prompt-form-row">
                        <div class="prompt-form-group prompt-form-group--half">
                            <label class="prompt-form-label">优先级</label>
                            <input class="prompt-input prompt-input--sm" type="number" id="prompt-grp-priority" placeholder="10" value="${data.priority ?? 10}" min="0" max="100"/>
                        </div>
                        <div class="prompt-form-group prompt-form-group--half">
                            <label class="prompt-form-label">历史深度</label>
                            <input class="prompt-input prompt-input--sm" type="number" id="prompt-grp-hist-depth" placeholder="1" value="${data.historyDepth ?? 1}" min="1" max="5"/>
                        </div>
                    </div>
                    <div class="prompt-form-group">
                        <label class="prompt-form-label">注入深度</label>
                        <input class="prompt-input prompt-input--sm" type="number" id="prompt-grp-depth" placeholder="留空表示跟随组（0=最底）" value="${data.injectionDepth ?? ''}" min="0" max="10"/>
                    </div>
                    <div class="prompt-form-group">
                        <label class="prompt-form-label">
                            <input type="checkbox" id="prompt-grp-tw-enable" ${data.timeWindowEnabled ? 'checked' : ''}/>
                            启用时间窗
                        </label>
                        <div class="prompt-form-row">
                            <input class="prompt-input prompt-input--sm" type="time" id="prompt-grp-tw-start" value="${data.timeWindowStart ?? '00:00'}"/>
                            <span class="prompt-form-sep">至</span>
                            <input class="prompt-input prompt-input--sm" type="time" id="prompt-grp-tw-end" value="${data.timeWindowEnd ?? '23:59'}"/>
                        </div>
                    </div>
                    <div class="prompt-form-group">
                        <label class="prompt-form-label">
                            <input type="checkbox" id="prompt-grp-enabled" ${data.enabled ? 'checked' : ''}/>
                            启用该组
                        </label>
                    </div>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--danger" ${wvAction('promptDeleteGroup', { groupId: data.groupId })}>删除</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptSaveGroup', { groupId: data.groupId })}>保存</button>
                </div>
            </div>
        </div>
    `;
}

// ---- Prompt 条目弹窗 ----

function renderModalAddPrompt() {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal prompt-modal--wide">
                <div class="prompt-modal__title">添加 Prompt 条目</div>
                <div class="prompt-modal__body">
                    <div class="prompt-form-group">
                        <label class="prompt-form-label">Prompt 内容</label>
                        <textarea class="prompt-textarea prompt-textarea--lg" id="prompt-item-text" placeholder="输入提示词内容，支持变量 {{ai.name}}、{{user.name}}、{{now}} 等" rows="5"></textarea>
                    </div>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptCreatePrompt')}>添加</button>
                </div>
            </div>
        </div>
    `;
}

function renderModalEditPrompt(data) {
    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal prompt-modal--wide">
                <div class="prompt-modal__title">编辑 Prompt 条目</div>
                <div class="prompt-modal__body">
                    <div class="prompt-form-group">
                        <label class="prompt-form-label">Prompt 内容</label>
                        <textarea class="prompt-textarea prompt-textarea--lg" id="prompt-item-text" placeholder="输入提示词内容" rows="5">${escapeHtml(data.text || '')}</textarea>
                    </div>
                    <div class="prompt-form-row">
                        <div class="prompt-form-group prompt-form-group--half">
                            <label class="prompt-form-label">
                                <input type="checkbox" id="prompt-item-priority-enable" ${data.priorityEnabled ? 'checked' : ''}/>
                                覆盖优先级
                            </label>
                            <input class="prompt-input prompt-input--sm" type="number" id="prompt-item-priority-value" value="${data.priorityValue ?? 10}" min="0" max="100"/>
                        </div>
                        <div class="prompt-form-group prompt-form-group--half">
                            <label class="prompt-form-label">
                                <input type="checkbox" id="prompt-item-depth-enable" ${data.injectionDepthEnabled ? 'checked' : ''}/>
                                覆盖注入深度
                            </label>
                            <input class="prompt-input prompt-input--sm" type="number" id="prompt-item-depth-value" value="${data.injectionDepthValue ?? 0}" min="0" max="10"/>
                        </div>
                    </div>
                    <div class="prompt-form-group">
                        <label class="prompt-form-label">
                            <input type="checkbox" id="prompt-item-tw-enable" ${data.timeWindowEnabled ? 'checked' : ''}/>
                            启用时间窗
                        </label>
                        <div class="prompt-form-row">
                            <input class="prompt-input prompt-input--sm" type="time" id="prompt-item-tw-start" value="${data.timeWindowStart ?? '00:00'}"/>
                            <span class="prompt-form-sep">至</span>
                            <input class="prompt-input prompt-input--sm" type="time" id="prompt-item-tw-end" value="${data.timeWindowEnd ?? '23:59'}"/>
                        </div>
                    </div>
                </div>
                <div class="prompt-modal__actions">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--danger" ${wvAction('promptDeletePrompt', { promptId: data.promptId })}>删除</button>
                    <button class="prompt-modal__btn prompt-modal__btn--primary" ${wvAction('promptSavePrompt', { promptId: data.promptId })}>保存</button>
                </div>
            </div>
        </div>
    `;
}

// ---- 确认删除弹窗 ----

function renderModalConfirmDelete(data) {
    const titles = {
        library: '删除 Prompt 库',
        package: '删除 Prompt 包',
        group: '删除 Prompt 组',
        prompt: '删除 Prompt 条目',
    };
    const msgs = {
        library: `确定要删除「${escapeHtml(data.name || '')}」吗？删除后无法恢复。`,
        package: `确定要删除「${escapeHtml(data.name || '')}」吗？请先删除包内的所有 Prompt 组。`,
        group: `确定要删除 Prompt 组「${escapeHtml(data.name || '')}」吗？组内的所有 Prompt 条目也会被删除。`,
        prompt: `确定要删除该 Prompt 条目吗？`,
    };

    return `
        <div class="prompt-modal-overlay">
            <div class="prompt-modal prompt-modal--confirm">
                <div class="prompt-modal__title prompt-modal__title--danger">${titles[data.type] || '确认删除'}</div>
                <div class="prompt-modal__msg">${msgs[data.type] || '确定要删除吗？'}</div>
                <div class="prompt-modal__actions prompt-modal__actions--confirm">
                    <button class="prompt-modal__btn prompt-modal__btn--ghost" ${wvAction('promptCloseModal')}>取消</button>
                    <button class="prompt-modal__btn prompt-modal__btn--danger-solid" ${wvAction('promptConfirmDelete', { type: data.type, id: data.id })}>确认删除</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 工具函数
// ============================================

function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
