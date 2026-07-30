/**
 * Settings App · 人设 (Persona) · 资源绑定 section
 *
 *   - 在 detailed 模式下挂在人设编辑器末尾。
 *   - 由 renderer.js 通过 renderResourcesSectionSync(app, resourcesLoaded) 调用。
 *   - 首次进入会异步加载「图库 / 图包 / 图组」整棵树到内存缓存，
 *     加载完成后:
 *       ① 设置 window.__resourcesTreeReady = true
 *       ② 触发 Vue reactive (__detailRenderTick / __phoneAppsRef)
 *       ③ 再次让 settings 应用层调用 renderResourcesSectionSync(...)
 *     选择器走 pickerKind 状态位 (avatar / sticker)，由 personaResources* 方法更新。
 *
 *   所有来自图库、档案和数据库的动态文本都先经过 escapeHtml。
 */

import { escapeHtml } from '@/src/core/escape.js';
import {
    getAllLibraries,
    getLibraryAlbums,
    getAlbumGroups,
} from '../gallery/gallery-db.js';
import {
    getAllLibraries as getPromptLibraries,
    getLibraryPackages,
    getPackageGroups,
} from '../prompt/prompt-db.js';

// ============================================
// 内部缓存
// ============================================

const _treeCache = {
    libraries: [],   // [{ id, name, _num, createdAt }]
    albums: [],      // [{ id, libraryId, name, ... }]
    groups: [],      // [{ id, albumId, libraryId, name, imageSize, ... }]
    ready: false,    // 是否至少加载过一遍
    loading: null,   // 正在进行的 promise
};

// Prompt 库缓存
const _promptCache = {
    libraries: [],
    packages: [],
    groups: [],
    ready: false,
    loading: null,
};

/**
 * 加载 Prompt 库整棵树（库 → 包 → 组）
 */
export async function _loadPromptTree() {
    if (_promptCache.loading) return _promptCache.loading;
    _promptCache.loading = _doLoadPromptTree();
    return _promptCache.loading;
}

async function _doLoadPromptTree() {
    try {
        const libs = await getPromptLibraries();
        const packages = [];
        const groups = [];
        for (const lib of libs) {
            const pkgs = await getLibraryPackages(lib.id);
            packages.push(...pkgs);
            for (const pkg of pkgs) {
                const grps = await getPackageGroups(pkg.id);
                groups.push(...grps);
            }
        }
        _promptCache.libraries = libs;
        _promptCache.packages = packages;
        _promptCache.groups = groups;
        _promptCache.ready = true;
    } catch (err) {
        console.error('[resources] 加载 Prompt 树失败', err);
    }
    _promptCache.loading = null;
    return _promptCache;
}

/**
 * 让 prompt 缓存失效（删 / 改 prompt 组后调用）
 */
export function _invalidatePromptTree() {
    _promptCache.ready = false;
}

/**
 * 根据 promptId 查找组信息
 */
function _findPromptGroup(promptId) {
    return _promptCache.groups.find(g => g.id === promptId) || null;
}

/**
 * 让 gallery-methods 主动失效缓存（删 / 改图组路径后调用）。
 * 当前实现只是标记 __resourcesTreeReady = false，强制下次重渲时再重新载入。
 */
export function _invalidateGalleryTree() {
    _treeCache.ready = false;
    if (typeof window !== 'undefined') {
        window.__resourcesTreeReady = false;
    }
}

/**
 * 把当前 entityType 对应的 persona.boundResources 兜底成空对象。
 */
function getBound(persona) {
    if (!persona) return { avatarGroupIds: [], stickerGroupIds: [], apiRefs: [], promptIds: [] };
    const b = persona.boundResources || {};
    return {
        avatarGroupIds: Array.isArray(b.avatarGroupIds) ? b.avatarGroupIds : [],
        stickerGroupIds: Array.isArray(b.stickerGroupIds) ? b.stickerGroupIds : [],
        apiRefs: Array.isArray(b.apiRefs) ? b.apiRefs : [],
        promptIds: Array.isArray(b.promptIds) ? b.promptIds : [],
    };
}

/**
 * 取得当前 active persona。
 */
function getActivePersona() {
    const sdk = window.settingsSdk;
    if (!sdk) return null;
    const et = window.settingsApp?.state?.personaHome?.entityType || 'user';
    const api = et === 'user' ? sdk.users : sdk.aiPersons;
    return api.getActive?.() || null;
}

function getActiveEntityType() {
    return window.settingsApp?.state?.personaHome?.entityType || 'user';
}

function getPickerKind() {
    return window.settingsApp?.state?.personaHome?.resources?.pickerKind || '';
}

/**
 * 当前 persona 的 resources 模块是否启用。默认开启（缺字段 / 老数据 → true）。
 */
function isResourcesEnabled(persona) {
    if (!persona) return false;
    const m = persona.resources;
    if (!m || typeof m !== 'object') return true;
    return m.enabled !== false;
}

/**
 * 与 renderer.js 同款的 action attribute 构造。
 */
function wvAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

/**
 * head 右侧的开关按钮：与 renderer.renderHeadToggle 同结构。
 */
function renderResourcesHeadToggle(enabled, et) {
    const action = wvAction('personaToggleModule', { entityType: et, moduleKey: 'resources' });
    const cls = `settings-switch${enabled ? ' is-on' : ''}`;
    const checked = enabled ? 'true' : 'false';
    return `<button type="button" class="${cls}" ${action} role="switch" aria-checked="${checked}"><span class="settings-switch__knob"></span></button>`;
}

// ============================================
// 异步加载树
// ============================================

/**
 * 预加载库 / 包 / 组 三层。会被多个入口多次触发，但只跑一次。
 */
async function ensureTreeLoaded() {
    if (_treeCache.loading) {
        try { await _treeCache.loading; } catch (_) {}
        return _treeCache;
    }
    if (_treeCache.ready && typeof window !== 'undefined' && window.__resourcesTreeReady) {
        return _treeCache;
    }
    const p = (async () => {
        try {
            const libs = await getAllLibraries().catch(() => []);
            _treeCache.libraries = Array.isArray(libs) ? libs : [];

            // 把所有 albums / groups 拉一次（后面会随方法失效重拉）
            const albumLists = await Promise.all(_treeCache.libraries.map(l => getLibraryAlbums(l.id).catch(() => [])));
            _treeCache.albums = albumLists.flat();

            const groupLists = await Promise.all(_treeCache.albums.map(a => getAlbumGroups(a.id).catch(() => [])));
            _treeCache.groups = groupLists.flat();
        } catch (e) {
            console.error('[resources-section] 加载图库树失败', e);
        } finally {
            _treeCache.ready = true;
            _treeCache.loading = null;
            if (typeof window !== 'undefined') {
                window.__resourcesTreeReady = true;
                // 触发 Vue 重渲
                const tickRef = window.__detailRenderTick;
                if (tickRef && typeof tickRef.value === 'number') tickRef.value++;
                const appsRef = window.__phoneAppsRef;
                if (appsRef && Array.isArray(appsRef.value)) appsRef.value = [...appsRef.value];
                window.refreshPhoneApps?.();
            }
        }
        return _treeCache;
    })();
    _treeCache.loading = p;
    return p;
}

// ============================================
// Vue 启动后自动预加载一次（之后由方法触发重渲）
// ============================================

if (typeof window !== 'undefined' && !window.__resourcesTreeScheduled) {
    window.__resourcesTreeScheduled = true;
    window.addEventListener('DOMContentLoaded', () => {
        // microtask 延迟，等 settingsSdk 可用
        setTimeout(() => { ensureTreeLoaded(); _loadPromptTree(); }, 0);
    });
    // 即便已经晚于 DOMContentLoaded，也跑一次（避免错过了 hydration）
    setTimeout(() => { ensureTreeLoaded(); _loadPromptTree(); }, 200);
}

// ============================================
// 渲染 helper
// ============================================

function renderGroupRow(kind, group, persona, et) {
    const field = kind === 'avatar' ? 'avatarGroupIds' : 'stickerGroupIds';
    const bound = getBound(persona);
    const isBound = bound[field].includes(group.id);
    const path = [
        _treeCache.libraries.find(l => l.id === group.libraryId)?.name,
        _treeCache.albums.find(a => a.id === group.albumId)?.name,
    ].filter(Boolean).map(s => escapeHtml(s)).join(' · ');
    return `
        <div class="persona-resources-row ${isBound ? 'is-bound' : ''}" data-resources-row="1">
            <div class="persona-resources-row__main">
                <div class="persona-resources-row__title">${escapeHtml(group.name || group.id)}</div>
                <div class="persona-resources-row__path">${path}</div>
            </div>
            <div class="persona-resources-row__action">
                <button class="persona-btn persona-btn--small ${isBound ? 'persona-btn--ghost' : 'persona-btn--primary'}"
                    data-app-action='${escapeHtml(JSON.stringify({
                        action: 'appMethod',
                        appId: 'settings',
                        method: isBound ? 'personaResourcesRemoveGroup' : 'personaResourcesPickerConfirm',
                        payload: { entityType: et, kind, groupId: group.id, action: isBound ? 'remove' : 'add' },
                    }))}'>
                    ${isBound ? '解绑' : '绑定'}
                </button>
            </div>
        </div>
    `;
}

function actionAttr(method, payload = {}) {
    return `data-app-action='${escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'settings',
        method,
        payload,
    }))}'`;
}

function renderResourceGroup({ title, subtitle, actionHtml = '', content = '', pickerHtml = '' }) {
    return `
        <div class="persona-resources-group">
            <div class="persona-resources-group__head">
                <div class="persona-resources-group__heading">
                    <div class="persona-resources-group__title">${escapeHtml(title)}</div>
                    ${subtitle ? `<div class="persona-resources-group__subtitle">${escapeHtml(subtitle)}</div>` : ''}
                </div>
                ${actionHtml ? `<div class="persona-resources-group__action">${actionHtml}</div>` : ''}
            </div>
            <div class="persona-resources-list">${content}</div>
            ${pickerHtml}
        </div>
    `;
}

function renderKindSection(kind, persona, et) {
    const title = kind === 'avatar' ? '头像库' : '表情包库';
    const field = kind === 'avatar' ? 'avatarGroupIds' : 'stickerGroupIds';
    const bound = getBound(persona);
    const pickerOpen = getPickerKind() === kind;
    const boundGroups = bound[field]
        .map(gid => _treeCache.groups.find(g => g.id === gid))
        .filter(Boolean);
    const allGroups = _treeCache.groups.slice();

    const boundHtml = boundGroups.length === 0
        ? '<div class="persona-resources-empty">还没有绑定的图组。</div>'
        : boundGroups.map(g => renderGroupRow(kind, g, persona, et)).join('');

    const toggleAttr = pickerOpen
        ? actionAttr('personaResourcesClosePicker', { entityType: et })
        : actionAttr('personaResourcesOpenPicker', { entityType: et, kind });
    const actionHtml = `<button class="persona-btn persona-btn--small persona-btn--ghost" ${toggleAttr}>${pickerOpen ? '收起' : '+ 添加图组'}</button>`;

    const pickerHtml = pickerOpen
        ? `
            <div class="persona-resources-picker">
                <div class="persona-resources-picker__head">选择要绑定的图组（${allGroups.length} 个可选）</div>
                <div class="persona-resources-picker__list">
                    ${allGroups.length === 0
                        ? '<div class="persona-resources-empty">图库里还没有图组，先去图库建一个。</div>'
                        : allGroups.map(g => renderGroupRow(kind, g, persona, et)).join('')}
                </div>
            </div>
        `
        : '';

    return renderResourceGroup({
        title,
        subtitle: `已绑定 ${boundGroups.length} 个图组`,
        actionHtml,
        content: boundHtml,
        pickerHtml,
    });
}

function renderApiRow(ref, et) {
    const name = escapeHtml(ref.name || (ref.refType === 'group' ? '未命名 API 组' : '未命名 API'));
    const sub = ref.subTitle ? escapeHtml(ref.subTitle) : '';
    const badge = ref.refType === 'group'
        ? '<span class="persona-resources-badge persona-resources-badge--group">组</span>'
        : '<span class="persona-resources-badge persona-resources-badge--key">API</span>';
    return `
        <div class="persona-resources-row">
            <div class="persona-resources-row__main">
                <div class="persona-resources-row__title">${badge}${name}</div>
                <div class="persona-resources-row__path">${sub}</div>
            </div>
            <div class="persona-resources-row__action">
                <button class="persona-btn persona-btn--small persona-btn--danger" ${actionAttr('personaResourcesRemoveApi', { entityType: et, refType: ref.refType, refId: ref.refId })}>删除</button>
            </div>
        </div>
    `;
}

/**
 * 渲染 API 资源选择器：两个子 tab（单一 API / API 组），展示所有未绑定的 key/group，可点击绑定。
 */
function renderApiPicker(persona, et) {
    const home = window.settingsApp?.state?.personaHome || {};
    const picker = home.resources?.apiPicker || { open: false, type: 'key' };
    if (!picker.open) return '';
    const apisdk = window.__apiSdk;
    const refs = (persona.boundResources?.apiRefs) || [];
    const boundSet = new Set(refs.map(r => `${r.refType}::${r.refId}`));
    const isKey = picker.type === 'key';
    const keys = isKey && apisdk?.apiKeySdk ? apisdk.apiKeySdk.list() : [];
    const groups = !isKey && apisdk?.apiGroupSdk ? apisdk.apiGroupSdk.list() : [];
    const empty = isKey
        ? '还没有 API 密钥，先去「API 管理」添加一个。'
        : '还没有 API 组，先去「API 管理」建一个。';
    const rows = isKey
        ? keys.map(k => {
            const id = `key::${k.id}`;
            const bound = boundSet.has(id);
            const sub = `${k.provider || 'API'} · ${k.model || k.baseUrl || ''}`.trim();
            return `
                <div class="persona-resources-row${bound ? ' is-bound' : ''}">
                    <div class="persona-resources-row__main">
                        <div class="persona-resources-row__title">${escapeHtml(k.label || k.id)}</div>
                        <div class="persona-resources-row__path">${escapeHtml(sub)}</div>
                    </div>
                    <div class="persona-resources-row__action">
                        <button class="persona-btn persona-btn--small persona-btn--ghost" ${actionAttr('personaResourcesAddApi', { entityType: et, refType: 'key', refId: k.id })} ${bound ? 'disabled' : ''}>${bound ? '已绑定' : '绑定'}</button>
                    </div>
                </div>
            `;
        }).join('')
        : groups.map(g => {
            const id = `group::${g.id}`;
            const bound = boundSet.has(id);
            const sub = `${(g.apiKeyIds || []).length} 个密钥`;
            return `
                <div class="persona-resources-row${bound ? ' is-bound' : ''}">
                    <div class="persona-resources-row__main">
                        <div class="persona-resources-row__title">${escapeHtml(g.name || g.id)}</div>
                        <div class="persona-resources-row__path">${escapeHtml(sub)}</div>
                    </div>
                    <div class="persona-resources-row__action">
                        <button class="persona-btn persona-btn--small persona-btn--ghost" ${actionAttr('personaResourcesAddApi', { entityType: et, refType: 'group', refId: g.id })} ${bound ? 'disabled' : ''}>${bound ? '已绑定' : '绑定'}</button>
                    </div>
                </div>
            `;
        }).join('');
    const tabKeyCls = `persona-tag${isKey ? ' is-on' : ''}`;
    const tabGroupCls = `persona-tag${!isKey ? ' is-on' : ''}`;
    return `
        <div class="persona-resources-picker">
            <div class="persona-resources-picker__head">
                <div class="persona-resources-picker__tabs">
                    <button class="${tabKeyCls}" ${actionAttr('personaResourcesSwitchApiPicker', { entityType: et, refType: 'key' })}>单一 API</button>
                    <button class="${tabGroupCls}" ${actionAttr('personaResourcesSwitchApiPicker', { entityType: et, refType: 'group' })}>API 组</button>
                </div>
                <button class="persona-btn persona-btn--small persona-btn--ghost" ${actionAttr('personaResourcesCloseApiPicker', { entityType: et })}>收起</button>
            </div>
            <div class="persona-resources-picker__list">
                ${(isKey ? keys.length === 0 : groups.length === 0)
                    ? `<div class="persona-resources-empty">${escapeHtml(empty)}</div>`
                    : rows}
            </div>
        </div>
    `;
}

function renderApiSection(persona, et) {
    const refs = getBound(persona).apiRefs;
    const content = refs.length === 0
        ? '<div class="persona-resources-empty">尚未添加 API 资源。</div>'
        : refs.map(r => renderApiRow(r, et)).join('');
    const home = window.settingsApp?.state?.personaHome || {};
    const pickerOpen = !!(home.resources?.apiPicker?.open);
    const openAttr = pickerOpen
        ? actionAttr('personaResourcesCloseApiPicker', { entityType: et })
        : actionAttr('personaResourcesOpenApiPicker', { entityType: et, refType: 'key' });
    const actionHtml = `<button class="persona-btn persona-btn--small persona-btn--ghost" ${openAttr}>${pickerOpen ? '收起' : '+ 添加'}</button>`;
    return renderResourceGroup({
        title: 'API 资源',
        subtitle: '外部账号与接口绑定',
        actionHtml,
        content,
        pickerHtml: renderApiPicker(persona, et),
    });
}

function renderPromptRow(promptId, et) {
    // 尝试从缓存获取组信息来显示真实名称
    const group = _findPromptGroup(promptId);
    let displayName = promptId;
    let subPath = '提示词资源';
    if (group) {
        displayName = escapeHtml(group.name || group.id);
        // 尝试找到包和库
        const pkg = _promptCache.packages.find(p => p.id === group.packageId);
        const lib = pkg ? _promptCache.libraries.find(l => l.id === group.libraryId) : null;
        if (lib && pkg) {
            subPath = `${escapeHtml(lib.name)} · ${escapeHtml(pkg.name)}`;
        } else if (pkg) {
            subPath = escapeHtml(pkg.name);
        }
    }
    return `
        <div class="persona-resources-row">
            <div class="persona-resources-row__main">
                <div class="persona-resources-row__title">${displayName}</div>
                <div class="persona-resources-row__path">${subPath}</div>
            </div>
            <div class="persona-resources-row__action">
                <button class="persona-btn persona-btn--small persona-btn--danger" ${actionAttr('personaResourcesRemovePrompt', { entityType: et, promptId })}>删除</button>
            </div>
        </div>
    `;
}

function renderPromptPicker(persona, et) {
    const home = window.settingsApp?.state?.personaHome || {};
    const picker = home.resources?.promptPicker || { open: false };
    if (!picker.open) return '';

    const bound = getBound(persona).promptIds;
    const boundSet = new Set(bound);

    // 渲染库 → 包 → 组树
    let rowsHtml = '';
    if (_promptCache.libraries.length === 0) {
        rowsHtml = '<div class="persona-resources-empty">还没有创建 Prompt 库，请先去 Prompt 设置页添加。</div>';
    } else {
        const rows = [];
        for (const lib of _promptCache.libraries) {
            const libPkgs = _promptCache.packages.filter(p => p.libraryId === lib.id);
            for (const pkg of libPkgs) {
                const pkgGroups = _promptCache.groups.filter(g => g.packageId === pkg.id);
                for (const group of pkgGroups) {
                    const id = group.id;
                    const isBound = boundSet.has(id);
                    const disabled = isBound ? ' disabled' : '';
                    const btnText = isBound ? '已绑定' : '绑定';
                    rows.push(`
                        <div class="persona-resources-row${isBound ? ' is-bound' : ''}">
                            <div class="persona-resources-row__main">
                                <div class="persona-resources-row__title">${escapeHtml(group.name || group.id)}</div>
                                <div class="persona-resources-row__path">${escapeHtml(lib.name)} · ${escapeHtml(pkg.name)}</div>
                            </div>
                            <div class="persona-resources-row__action">
                                <button class="persona-btn persona-btn--small ${isBound ? 'persona-btn--ghost' : 'persona-btn--primary'}"
                                    ${actionAttr('personaResourcesAddPrompt', { entityType: et, promptId: id })}
                                    ${disabled}>${btnText}</button>
                            </div>
                        </div>
                    `);
                }
            }
        }
        rowsHtml = rows.join('');
    }

    return `
        <div class="persona-resources-picker">
            <div class="persona-resources-picker__head">选择要绑定的 Prompt 组（${_promptCache.groups.length} 个可选）</div>
            <div class="persona-resources-picker__list">${rowsHtml}</div>
        </div>
    `;
}

function renderPromptSection(persona, et) {
    const ids = getBound(persona).promptIds;
    const content = ids.length === 0
        ? '<div class="persona-resources-empty">尚未绑定提示词。</div>'
        : ids.map(id => renderPromptRow(id, et)).join('');
    const home = window.settingsApp?.state?.personaHome || {};
    const pickerOpen = !!(home.resources?.promptPicker?.open);
    const openAttr = pickerOpen
        ? actionAttr('personaResourcesClosePromptPicker', { entityType: et })
        : actionAttr('personaResourcesOpenPromptPicker', { entityType: et });
    const actionHtml = `<button class="persona-btn persona-btn--small persona-btn--ghost" ${openAttr}>${pickerOpen ? '收起' : '+ 添加'}</button>`;
    return renderResourceGroup({
        title: '提示词资源',
        subtitle: '绑定此人设使用的提示词',
        actionHtml,
        content,
        pickerHtml: renderPromptPicker(persona, et),
    });
}

// ============================================
// 同步入口（renderer.js 在 v-html 流程里直接调用）
// ============================================

/**
 * 同步渲染资源绑定 section。
 *   - resourcesLoaded: 是否已加载过树（来自 window.__resourcesTreeReady）
 *
 *   行为：
 *     - 首次（未加载）返回 loading 占位，触发后台预加载；加载完会自动 refresh。
 *     - 已加载 → 立刻渲染四个子 section。
 */
export function renderResourcesSectionSync(app, resourcesLoaded) {
    const persona = getActivePersona();
    const et = getActiveEntityType();
    const enabled = isResourcesEnabled(persona);

    // 触发后台加载（无论是否已加载过都安全）
    if (!resourcesLoaded || !_treeCache.ready) {
        ensureTreeLoaded();
    }

    // 关闭状态：清空缓存并展示 off 占位，避免 toggle 一开就看到陈旧数据。
    if (persona && !enabled) {
        return `
            <section class="settings-section is-off persona-resources-section">
                <div class="settings-section__head">
                    <div class="settings-section__head-text">
                        <div class="settings-section__head-title">资源绑定</div>
                        <div class="settings-section__head-sub">统一管理头像、表情包、API 与提示词资源</div>
                    </div>
                    <div class="settings-section__head-meta">
                        ${renderResourcesHeadToggle(false, et)}
                    </div>
                </div>
                <div class="settings-section__body settings-section__body--off">
                    <div class="settings-section__off-hint">资源绑定未启用。打开开关后可以给此 ${et === 'user' ? '用户' : 'AI 人设'}绑定头像、表情包、API 与提示词。</div>
                </div>
            </section>
        `;
    }

    if (!_treeCache.ready || (typeof window !== 'undefined' && !window.__resourcesTreeReady)) {
        return `
            <section class="settings-section is-on">
                <div class="settings-section__head">
                    <div class="settings-section__head-text">
                        <div class="settings-section__head-title">资源绑定</div>
                        <div class="settings-section__head-sub">正在加载图库…</div>
                    </div>
                    <div class="settings-section__head-meta">
                        ${renderResourcesHeadToggle(true, et)}
                    </div>
                </div>
                <div class="settings-section__body">
                    <div class="settings-section__off-hint">图库树加载中，加载完后会自动刷新此处。</div>
                </div>
            </section>
        `;
    }

    if (!persona) {
        return `
            <section class="settings-section is-on">
                <div class="settings-section__head">
                    <div class="settings-section__head-text">
                        <div class="settings-section__head-title">资源绑定</div>
                        <div class="settings-section__head-sub">未选中实体</div>
                    </div>
                    <div class="settings-section__head-meta">
                        ${renderResourcesHeadToggle(true, et)}
                    </div>
                </div>
            </section>
        `;
    }

    const groupsHtml = [
        renderKindSection('avatar', persona, et),
        renderKindSection('sticker', persona, et),
        renderApiSection(persona, et),
        renderPromptSection(persona, et),
    ].join('');

    return `
        <section class="settings-section is-on persona-resources-section">
            <div class="settings-section__head">
                <div class="settings-section__head-text">
                    <div class="settings-section__head-title">资源绑定</div>
                    <div class="settings-section__head-sub">统一管理头像、表情包、API 与提示词资源</div>
                </div>
                <div class="settings-section__head-meta">
                    ${renderResourcesHeadToggle(true, et)}
                </div>
            </div>
            <div class="settings-section__body persona-resources-section__body">
                <div class="persona-resources-groups">${groupsHtml}</div>
            </div>
        </section>
    `;
}
