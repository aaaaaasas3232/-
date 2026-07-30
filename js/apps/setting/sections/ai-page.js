/**
 * 设置 App · AI 人设子页
 */

import {
    renderGroup,
    renderField,
    renderSaveBar,
} from '../ui-components.js';

const SECTION_FOOTER = '让 AI 知道自己是谁、怎么说话、要遵守什么。';

export function renderAiSection(app) {
    const ui = app.state.ui.ai;
    const draft = app.state.draft.aiRulesText || (ui.rules || []).join('\n');
    const savedAt = app.state.savedAt.ai;

    return `
        <div class="settings-ai">
            ${renderGroup({
                title: 'AI 人设',
                content: `
                    <div class="settings-stack">
                        ${renderField({
                            kind: 'input',
                            label: 'AI 名字',
                            value: ui.name || '',
                            fieldPath: 'ai.name',
                            placeholder: '默认 AI',
                        })}
                        ${renderField({
                            kind: 'input',
                            label: '角色',
                            value: ui.role || '',
                            fieldPath: 'ai.role',
                            placeholder: '通用助手 / 心理陪伴 / 创作搭档 …',
                        })}
                        ${renderField({
                            kind: 'input',
                            label: '语气',
                            value: ui.tone || '',
                            fieldPath: 'ai.tone',
                            placeholder: '温柔、克制、像朋友',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '总述',
                            value: ui.summary || '',
                            fieldPath: 'ai.summary',
                            rows: 3,
                            placeholder: '用一段话描述 AI 的整体定位',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '规则',
                            value: draft,
                            fieldPath: 'ai.rules',
                            rows: 5,
                            helper: '每行一条规则；保存时会被切成数组。',
                            placeholder: '不主动给出医疗建议 / 优先使用中文 / 避免 emoji …',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '备注',
                            value: ui.notes || '',
                            fieldPath: 'ai.notes',
                            rows: 2,
                        })}
                    </div>
                `,
                footer: SECTION_FOOTER,
            })}

            ${renderSaveBar({
                saveMethod: 'saveAi',
                resetMethod: 'resetAi',
                saveLabel: '保存 AI 人设',
                resetLabel: '恢复默认',
                savedAt,
            })}
        </div>
    `;
}