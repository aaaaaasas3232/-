// ============================================
// App 内置页面模板（hero / info-list / quick-actions / ...）
// 从 apps.js 第 517-660 行提取
// ============================================

import { escapeHtml, normalizeTextList, renderTextBlock } from './escape.js';
import { createActionAttr } from './actions.js';
import { UI_TOKENS, UI_ICONS, UI_SYMBOLS } from './icons.js';
import { renderSettingsGroup, renderSurfaceCard, renderActionButton } from './renderers.js';

/** 模板注册器 */
export function createTemplateRegistry() {
    const templates = new Map();

    const getMissingTemplateMarkup = name => `
        <div class="app-card">
            <div class="text-[18px] font-bold text-slate-900">模板不存在</div>
            <div class="mt-2 text-sm leading-6 text-slate-600">未找到名为 ${escapeHtml(name)} 的模板。</div>
        </div>
    `;

    return Object.freeze({
        register: (name, render) => !!name && typeof render === 'function' && (templates.set(name, render), true),
        render: (name, payload = {}) => templates.get(name)?.(payload) ?? getMissingTemplateMarkup(name),
        has: name => templates.has(name),
        remove: name => templates.delete(name),
        clear: () => templates.clear(),
        keys: () => [...templates.keys()]
    });
}

export const appTemplates = createTemplateRegistry();

appTemplates.register('hero', ({ badge, title, description, actions = [], meta = [] } = {}) => {
    const metaList = normalizeTextList(meta);
    return `
    <section class="app-card">
        ${badge ? `<div class="inline-flex rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-white">${escapeHtml(badge)}</div>` : ''}
        ${renderTextBlock(title, 'mt-3 text-[22px] font-bold tracking-tight text-slate-900')}
        ${renderTextBlock(description, 'mt-3 text-sm leading-7 text-slate-600')}
        ${metaList.length ? `<div class="mt-4 flex flex-wrap gap-2">${metaList.map(item => `<span class="rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold text-slate-600">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
        ${actions.length ? `<div class="mt-4 space-y-3">${actions.map(renderActionButton).join('')}</div>` : ''}
    </section>
`;
});

appTemplates.register('info-list', ({ title, items = [] } = {}) => `
    <section class="app-card bg-white/55">
        ${renderTextBlock(title, 'text-sm font-semibold text-slate-800')}
        <div class="mt-3 space-y-3">
            ${items.map(item => {
                const itemTitle = item?.title || item?.label || '';
                const itemText = item?.text || item?.value || '';
                return `
                <div class="rounded-[18px] bg-white/70 px-4 py-3">
                    <div class="text-sm font-semibold text-slate-800">${escapeHtml(itemTitle)}</div>
                    <div class="mt-1 text-[13px] leading-6 text-slate-600">${escapeHtml(itemText)}</div>
                </div>
            `;
            }).join('')}
        </div>
    </section>
`);

appTemplates.register('quick-actions', ({ title, actions = [], appId = '' } = {}) => `
    <section class="app-card bg-white/55" data-ui="quick-actions">
        ${renderTextBlock(title, 'text-sm font-semibold text-slate-800')}
        <div class="mt-3 grid grid-cols-2 gap-3">
            ${actions.map(action => `
                <button
                    class="rounded-[20px] bg-white/80 px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                    ${createActionAttr(action.action, action.action?.appId || appId)}
                    data-ui="quick-action"
                    data-role="action-tile"
                >
                    <div class="text-lg">${escapeHtml(action.icon || '•')}</div>
                    <div class="mt-2 text-sm font-semibold text-slate-800">${escapeHtml(action.title || '')}</div>
                    <div class="mt-1 text-[12px] leading-5 text-slate-500">${escapeHtml(action.description || '')}</div>
                </button>
            `).join('')}
        </div>
    </section>
`);

appTemplates.register('profile-hero', ({ badge, title, description, meta = [], action, actionLabel = '查看详情', appId = '', avatar = UI_SYMBOLS.avatarListen, sectionId = '', triggerId = '' } = {}) => {
    const metaList = normalizeTextList(meta);
    return `
        <section class="${UI_TOKENS.radius.card} ${UI_TOKENS.surface.card} px-4 py-4 ${UI_TOKENS.shadow.card}" data-ui="profile-hero" ${sectionId ? `id="${escapeHtml(sectionId)}"` : ''}>
            <button class="flex w-full items-center gap-4 text-left" ${action ? createActionAttr(action, appId) : ''} data-role="profile-trigger" ${triggerId ? `id="${escapeHtml(triggerId)}"` : ''}>
                <div class="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-100 text-[28px] font-semibold text-slate-700">${escapeHtml(avatar)}</div>
                <div class="min-w-0 flex-1">
                    ${badge ? `<div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">${escapeHtml(badge)}</div>` : ''}
                    <div class="text-[20px] font-semibold tracking-tight text-slate-900">${escapeHtml(title)}</div>
                    ${description ? `<div class="mt-1 text-[13px] text-slate-500">${escapeHtml(description)}</div>` : ''}
                    ${metaList.length ? `<div class="mt-2 flex flex-wrap gap-2">${metaList.map(item => `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
                </div>
                <div class="text-[22px] text-slate-400">${UI_ICONS.chevronRight}</div>
            </button>
            ${action ? `<div class="sr-only">${escapeHtml(actionLabel)}</div>` : ''}
        </section>
    `;
});

appTemplates.register('group-list', ({ rows = [], appId = '', className = '', sectionId = '', dataUi = 'group-list' } = {}) =>
    renderSettingsGroup({ rows, className, sectionId, dataUi }, appId)
);

appTemplates.register('share-card', ({ title, summary, sourceApp = '', targetApp = '', action, appId = '', cover = '', meta = [] } = {}) => {
    const metaList = normalizeTextList(meta);
    return `
        <section class="${UI_TOKENS.radius.tile} ${UI_TOKENS.surface.card} px-4 py-4 ${UI_TOKENS.shadow.tile}" data-ui="share-card">
            <div class="flex items-start gap-3">
                ${cover ? `<div class="flex h-11 w-11 items-center justify-center rounded-[14px] bg-slate-100 text-slate-700">${cover}</div>` : ''}
                <div class="min-w-0 flex-1">
                    <div class="text-[15px] font-semibold text-slate-900">${escapeHtml(title || '共享内容')}</div>
                    ${summary ? `<div class="mt-1 text-[13px] leading-6 text-slate-500">${escapeHtml(summary)}</div>` : ''}
                    ${(sourceApp || targetApp) ? `<div class="mt-2 text-[11px] text-slate-400">${escapeHtml(sourceApp || '来源应用')}${targetApp ? ` → ${escapeHtml(targetApp)}` : ''}</div>` : ''}
                    ${metaList.length ? `<div class="mt-3 flex flex-wrap gap-2">${metaList.map(item => `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
                </div>
            </div>
            ${action ? `<div class="mt-4">${renderActionButton({ label: '打开共享内容', ...action }, appId)}</div>` : ''}
        </section>
    `;
});

appTemplates.register('glass-action-card', ({
    id = '',
    title = '',
    description = '',
    action = null,
    appId = '',
    icon = '',
    className = '',
    buttonClassName = '',
    panelClassName = 'rounded-[28px] border border-white/70 bg-white/55 backdrop-blur-[20px] shadow-[0_18px_44px_rgba(15,23,42,0.10)]',
} = {}) => `
    <section class="${panelClassName} ${className}" data-ui="glass-action-card" ${id ? `id="${escapeHtml(id)}"` : ''}>
        <button class="w-full px-4 py-4 text-left ${buttonClassName}" ${action ? createActionAttr(action, appId) : ''}>
            ${icon ? `<div class="mb-3 text-[18px] text-slate-700">${icon}</div>` : ''}
            <div class="text-[16px] font-semibold text-slate-900">${escapeHtml(title)}</div>
            ${description ? `<div class="mt-1 text-[13px] leading-6 text-slate-500">${escapeHtml(description)}</div>` : ''}
        </button>
    </section>
`);

appTemplates.register('settings-note', ({ title, text, sectionId = '' } = {}) =>
    renderSurfaceCard({
        id: sectionId,
        title,
        description: text,
        dataUi: 'settings-note',
    })
);
