/**
 * 设置 App · API 子页
 *
 * 注意：API Key 是明文保存在本机 IndexedDB 的，需要明显的警告。
 */

import {
    renderGroup,
    renderField,
    renderChipGroup,
    renderSlider,
    renderSaveBar,
    renderWarningHint,
} from '../ui-components.js';
import { PROVIDER_OPTIONS } from '../defaults.js';

const SECTION_FOOTER = 'API 配置供后续 AI 请求使用。Provider 不同，调用格式可能略有差异。';

export function renderApiSection(app) {
    const ui = app.state.ui.api;
    const savedAt = app.state.savedAt.api;

    const providerChips = renderChipGroup({
        presets: PROVIDER_OPTIONS.map(opt => ({ label: opt.label, value: opt.value })),
        currentValue: ui.provider,
        toAction: preset => ({
            action: 'appMethod',
            method: 'updateApiField',
            payload: { field: 'provider', value: preset.value },
        }),
    });

    const tempValue = Number(ui.temperature) || 0;
    const temperatureSlider = renderSlider({
        min: 0,
        max: 2,
        step: 0.1,
        value: tempValue,
        field: 'temperature',
        method: 'updateApiField',
        label: 'Temperature',
        valueLabel: String(tempValue),
    });

    return `
        <div class="settings-api">
            ${renderGroup({
                title: 'API',
                content: `
                    <div class="settings-stack">
                        ${renderField({
                            kind: 'input',
                            label: '显示名',
                            value: ui.label || '',
                            fieldPath: 'api.label',
                            placeholder: '默认 API',
                        })}
                        <div class="settings-stack__sub">Provider</div>
                        ${providerChips}
                        ${renderField({
                            kind: 'input',
                            label: 'Base URL',
                            value: ui.baseUrl || '',
                            fieldPath: 'api.baseUrl',
                            placeholder: 'https://api.openai.com/v1',
                        })}
                        ${renderField({
                            kind: 'input',
                            label: 'API Key',
                            value: ui.apiKey || '',
                            fieldPath: 'api.apiKey',
                            placeholder: 'sk-…',
                        })}
                        ${renderField({
                            kind: 'input',
                            label: '模型',
                            value: ui.model || '',
                            fieldPath: 'api.model',
                            placeholder: 'gpt-4o-mini',
                        })}
                        ${temperatureSlider}
                        ${renderField({
                            kind: 'textarea',
                            label: '备注',
                            value: ui.notes || '',
                            fieldPath: 'api.notes',
                            rows: 2,
                        })}
                    </div>
                `,
                footer: SECTION_FOOTER,
            })}

            ${renderWarningHint('API Key 当前以明文保存在本机 IndexedDB。不要在公共设备上填写。')}

            ${renderSaveBar({
                saveMethod: 'saveApi',
                resetMethod: 'resetApi',
                saveLabel: '保存 API',
                resetLabel: '恢复默认',
                savedAt,
            })}
        </div>
    `;
}