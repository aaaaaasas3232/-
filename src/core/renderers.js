// ============================================
// 通用渲染器：设置页 / 设置组 / 卡片 / ActionButton
// 从 apps.js 第 339-515 行提取
// ============================================

import { escapeHtml, renderTextBlock } from './escape.js';
import { createActionAttr } from './actions.js';
import { UI_TOKENS, UI_ICONS } from './icons.js';

function renderIconGlyph(icon) {
    return icon || '•';
}

export function renderChevronRow({
    title = '',
    description = '',
    action = null,
    icon = '',
    iconClassName = '',
    className = '',
    bodyClassName = '',
    titleClassName = '',
    descriptionClassName = '',
    trailing = UI_ICONS.chevronRight,
    dataUi = 'chevron-row',
    dataRole = 'action-row',
    rowId = '',
} = {}, appId = '') {
    return `
        <button
            class="flex w-full items-center gap-3 text-left ${className}" ${action ? createActionAttr(action, appId) : ''}
            data-ui="${escapeHtml(dataUi)}"
            data-role="${escapeHtml(dataRole)}"
            ${rowId ? `id="${escapeHtml(rowId)}"` : ''}
        >
            ${icon ? `<div class="${iconClassName || 'flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/80 text-[18px] shadow-[0_8px_18px_rgba(15,23,42,0.08)]'}">${renderIconGlyph(icon)}</div>` : ''}
            <div class="min-w-0 flex-1 ${bodyClassName}" data-role="row-body">
                <div class="${titleClassName || 'text-[16px] font-medium text-slate-900'}" data-role="row-title">${escapeHtml(title)}</div>
                ${description ? `<div class="${descriptionClassName || 'mt-1 text-[13px] text-slate-500'}" data-role="row-description">${escapeHtml(description)}</div>` : ''}
            </div>
            <div class="text-[20px] text-slate-300" data-role="row-trailing">${renderIconGlyph(trailing)}</div>
        </button>
    `;
}

export function renderSettingsGroup({
    rows = [],
    className = '',
    contentClassName = 'px-4 py-1',
    dividerClassName = 'h-px bg-slate-200/80',
    sectionId = '',
    dataUi = 'settings-group'
} = {}, appId = '') {
    const renderedRows = rows
        .map((row, index) => `${index > 0 ? `<div class="${dividerClassName}" data-role="group-divider"></div>` : ''}${renderChevronRow({ className: `py-4 ${row.className || ''}`.trim(), ...row }, appId)}`)
        .join('');

    return `
        <section class="${UI_TOKENS.radius.card} ${UI_TOKENS.surface.card} ${UI_TOKENS.shadow.card} overflow-hidden ${className}" data-ui="${escapeHtml(dataUi)}" ${sectionId ? `id="${escapeHtml(sectionId)}"` : ''}>
            <div class="${contentClassName}" data-role="group-content">
                ${renderedRows}
            </div>
        </section>
    `;
}

export function renderActionButton(action, appId = '') {
    return `
        <button class="detail-link" ${createActionAttr(action, appId)}>
            <span>${escapeHtml(action?.label || '查看')}</span>
            <span>${UI_ICONS.chevronRight}</span>
        </button>
    `;
}

export function renderSectionShell({
    id = '',
    dataUi = 'app-section',
    className = '',
    content = '',
} = {}) {
    return `
        <section class="${className}" data-ui="${escapeHtml(dataUi)}" ${id ? `id="${escapeHtml(id)}"` : ''}>
            ${content}
        </section>
    `;
}

export function renderSurfaceCard({
    id = '',
    title = '',
    description = '',
    className = `${UI_TOKENS.radius.card} ${UI_TOKENS.surface.soft} px-4 py-4`,
    titleClassName = 'text-sm font-semibold text-slate-800',
    descriptionClassName = 'mt-2 text-[13px] leading-6 text-slate-600',
    content = '',
    dataUi = 'surface-card',
} = {}) {
    return `
        <section class="${className}" data-ui="${escapeHtml(dataUi)}" ${id ? `id="${escapeHtml(id)}"` : ''}>
            ${title ? `<div class="${titleClassName}">${escapeHtml(title)}</div>` : ''}
            ${description ? `<div class="${descriptionClassName}">${escapeHtml(description)}</div>` : ''}
            ${content || ''}
        </section>
    `;
}
