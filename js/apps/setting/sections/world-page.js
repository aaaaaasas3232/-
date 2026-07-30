/**
 * 设置 App · 世界观子页
 */

import {
    renderGroup,
    renderField,
    renderSaveBar,
} from '../ui-components.js';

const SECTION_FOOTER = '世界观设定将作为 AI 回答的背景信息。每行一条要点。';

export function renderWorldSection(app) {
    const ui = app.state.ui.world;
    const draft = app.state.draft.worldKeyPointsText || (ui.keyPoints || []).join('\n');
    const savedAt = app.state.savedAt.world;

    return `
        <div class="settings-world">
            ${renderGroup({
                title: '世界观',
                content: `
                    <div class="settings-stack">
                        ${renderField({
                            kind: 'input',
                            label: '名称',
                            value: ui.name || '',
                            fieldPath: 'world.name',
                            placeholder: '给这个世界观起个名字',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '一句话主旨',
                            value: ui.summary || '',
                            fieldPath: 'world.summary',
                            rows: 2,
                            placeholder: '用一句话概括世界观的核心氛围',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '要点',
                            value: draft,
                            fieldPath: 'world.keyPoints',
                            rows: 5,
                            helper: '每行一条要点；保存时会被切成数组。',
                            placeholder: '魔法体系 / 关键角色 / 历史节点 …',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '时间线 / 编年史',
                            value: ui.timeline || '',
                            fieldPath: 'world.timeline',
                            rows: 3,
                            placeholder: '按年份或事件节点排列',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '备注',
                            value: ui.notes || '',
                            fieldPath: 'world.notes',
                            rows: 2,
                        })}
                    </div>
                `,
                footer: SECTION_FOOTER,
            })}

            ${renderSaveBar({
                saveMethod: 'saveWorld',
                resetMethod: 'resetWorld',
                saveLabel: '保存世界观',
                resetLabel: '恢复默认',
                savedAt,
            })}
        </div>
    `;
}