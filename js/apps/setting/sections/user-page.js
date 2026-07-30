/**
 * 设置 App · 用户人设子页
 */

import {
    renderGroup,
    renderField,
    renderSaveBar,
} from '../ui-components.js';

const SECTION_FOOTER = '让 AI 知道你是谁、喜欢什么。代词可选。';

export function renderUserSection(app) {
    const ui = app.state.ui.user;
    const draft = app.state.draft.userPreferencesText || (ui.preferences || []).join('\n');
    const savedAt = app.state.savedAt.user;

    return `
        <div class="settings-user">
            ${renderGroup({
                title: '用户人设',
                content: `
                    <div class="settings-stack">
                        ${renderField({
                            kind: 'input',
                            label: '显示名',
                            value: ui.name || '',
                            fieldPath: 'user.name',
                            placeholder: '我 / 你的名字',
                        })}
                        ${renderField({
                            kind: 'input',
                            label: '代词',
                            value: ui.pronouns || '',
                            fieldPath: 'user.pronouns',
                            placeholder: '他 / 她 / 它 · 留空',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '关于我',
                            value: ui.summary || '',
                            fieldPath: 'user.summary',
                            rows: 3,
                            placeholder: '一句话或一段话描述自己',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '偏好',
                            value: draft,
                            fieldPath: 'user.preferences',
                            rows: 4,
                            helper: '每行一条偏好；保存时会被切成数组。',
                            placeholder: '喜欢简短回答 / 二次元 / 夜猫子 …',
                        })}
                        ${renderField({
                            kind: 'textarea',
                            label: '备注',
                            value: ui.notes || '',
                            fieldPath: 'user.notes',
                            rows: 2,
                        })}
                    </div>
                `,
                footer: SECTION_FOOTER,
            })}

            ${renderSaveBar({
                saveMethod: 'saveUser',
                resetMethod: 'resetUser',
                saveLabel: '保存用户人设',
                resetLabel: '恢复默认',
                savedAt,
            })}
        </div>
    `;
}