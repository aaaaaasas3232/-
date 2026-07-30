// ============================================
// 页面 / 详情页默认渲染器
// 从 apps.js 第 661-719 行提取
// ============================================

import { renderTextBlock } from './escape.js';
import { renderActionButton } from './renderers.js';
import { appTemplates } from './templates.js';

function renderPageByBlocks(page) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    if (!blocks.length) {
        return '';
    }
    return `<div class="space-y-3">${blocks.map(block => {
        if (!block?.template) {
            return '';
        }
        return appTemplates.render(block.template, block.payload || {});
    }).join('')}</div>`;
}

export function createDefaultPageRenderer(page) {
    if (page?.blocks?.length) {
        return renderPageByBlocks(page);
    }

    const sections = [];

    if (page?.title || page?.description || (page?.actions && page.actions.length)) {
        sections.push(`
            <div class="app-card">
                ${renderTextBlock(page?.title, 'text-[18px] font-bold text-slate-900')}
                ${renderTextBlock(page?.description, 'mt-2 text-sm leading-6 text-slate-600')}
                ${(page?.actions || []).map(renderActionButton).join('')}
            </div>
        `);
    }

    if (page?.note?.title || page?.note?.text) {
        sections.push(`
            <div class="app-card bg-white/55">
                ${renderTextBlock(page.note.title, 'text-sm font-semibold text-slate-800')}
                ${renderTextBlock(page.note.text, 'mt-2 text-[13px] leading-6 text-slate-600')}
            </div>
        `);
    }

    return `<div class="space-y-3">${sections.join('')}</div>`;
}

export function createDefaultDetailRenderer(detailPage) {
    if (detailPage?.blocks?.length) {
        return renderPageByBlocks(detailPage);
    }

    const paragraphs = (detailPage?.paragraphs || []).map((paragraph, index) => {
        const spacingClass = index === 0 ? 'mt-3' : 'mt-4';
        return renderTextBlock(paragraph, `text-sm leading-7 text-slate-600 ${spacingClass}`);
    }).join('');

    return `
        <div class="app-card">
            ${renderTextBlock(detailPage?.title, 'text-[20px] font-bold text-slate-900')}
            ${paragraphs}
        </div>
    `;
}
