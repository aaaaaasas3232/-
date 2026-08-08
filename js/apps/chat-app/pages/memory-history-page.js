/**
 * chat-app / 历史消息页 (v0.65 重写)
 *
 *   入口:层级管理页 → 历史消息卡片
 *     - pageId: 'memory-history-{aiPersonId}-{mode}'
 *
 *   功能(v0.65):
 *     - 顶部 header(返回 + 标题 + 「+ 新建概要」按钮)
 *     - 层级 tab 切换器(L1/L2/L3/... 按层级顺序)
 *     - 当前选中层的概要列表(每条卡片:标题/日期范围/预览/操作按钮)
 *     - 浮动"+ 新建概要"按钮 → 弹 SummaryRangeModal 选日期范围 → 弹 SummaryEditModal
 *     - 若当前层满足满 N 消 N 条件,显示「生成 {层名}」按钮
 *     - 概要卡片操作:编辑 / 重 Roll / 删除(软删)
 *     - L1 / L2+ 列表统一用同一个模板,UI 一致
 *
 *   设计要点:
 *     - 蓝色主、白色辅、简洁大方
 *     - 所有按钮走 data-app-action 派发
 *     - 不在 v-html 里 appendChild / addEventListener
 *     - 复用 chat-modal-registry 的 SummaryRangeModal + SummaryEditModal
 */

import { escapeHtml } from '@/src/core/escape.js';
import { chatModalManager } from '../components/chat-modal-registry.js';

const DEFAULT_LEVEL_LABELS = Object.freeze({
    L1: '日',
    L2: '周',
    L3: '月',
    L4: '年',
    L5: '季',
    L6: '十年',
});

function _shortName(level) {
    const id = String(level?.id || '');
    return DEFAULT_LEVEL_LABELS[id] || (String(level?.name || id).slice(0, 2));
}

/**
 * 渲染顶部 header
 */
function renderHeaderBar(aiPersonId, mode, contactName) {
    return `
        <div class="memory-history-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="memory-history-topbar-title">历史消息</div>
            <div class="memory-history-topbar-spacer"></div>
        </div>
    `;
}

/**
 * 渲染层级 tab 切换器
 *   levels: [{ id, name, count }] 当前层级配置 + 该层概要计数
 */
function renderLevelTabs(aiPersonId, mode, levels, activeLevelId) {
    const tabsHtml = levels.map((lvl) => {
        const isActive = lvl.id === activeLevelId;
        const action = JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'switchMemoryHistoryLevel',
            payload: { aiPersonId, mode, levelId: lvl.id },
        });
        return `
            <button type="button" class="memory-history-level-tab ${isActive ? 'is-active' : ''}"
                data-level-id="${escapeHtml(lvl.id)}"
                data-app-action='${escapeHtml(action)}'>
                <span class="memory-history-level-tab-label">${escapeHtml(_shortName(lvl))}</span>
                <span class="memory-history-level-tab-name">${escapeHtml(lvl.name)}</span>
                ${Number(lvl.count) > 0 ? `<span class="memory-history-level-tab-count">${lvl.count}</span>` : ''}
            </button>
        `;
    }).join('');
    return `<div class="memory-history-level-tabs">${tabsHtml}</div>`;
}

/**
 * 渲染单条概要卡片
 *   ★ v0.66:新增「应用到 Prompt 管理」按钮(active 状态显示已应用)
 */
function renderSummaryCard(summary, aiPersonId, mode) {
    const dateRange = summary.originalDateRange || {};
    const dateText = (dateRange.start && dateRange.end && dateRange.start !== dateRange.end)
        ? `${dateRange.start} ~ ${dateRange.end}`
        : (dateRange.start || '');
    const preview = String(summary.content || '').trim();
    const previewShort = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;
    const sourceText = `来源 ${summary.messageCount || 0} 条消息`;
    const isActive = summary.asPrompt && summary.asPrompt.active !== false;
    return `
        <div class="memory-history-card" data-summary-id="${escapeHtml(summary.id)}">
            <div class="memory-history-card-head">
                <div class="memory-history-card-title">${escapeHtml(summary.title || '未命名概要')}</div>
                <div class="memory-history-card-date">${escapeHtml(dateText)}</div>
            </div>
            <div class="memory-history-card-preview">${escapeHtml(previewShort || '(无内容)')}</div>
            <div class="memory-history-card-apply-row">
                <button type="button" class="memory-history-card-apply-btn ${isActive ? 'is-applied' : ''}"
                    ${isActive ? 'disabled' : ''}
                    data-app-action='${escapeHtml(JSON.stringify({
                        action: 'appMethod',
                        appId: 'chat',
                        method: 'applyMemorySummaryToPromptManager',
                        payload: { aiPersonId, mode, summaryId: summary.id },
                    }))}'>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <span>${isActive ? '已应用到 Prompt 管理' : '应用到 Prompt 管理'}</span>
                </button>
            </div>
            <div class="memory-history-card-meta">
                <span class="memory-history-card-source">${escapeHtml(sourceText)}</span>
                <div class="memory-history-card-actions">
                    <button type="button" class="memory-history-card-btn"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"editMemorySummary","payload":{"aiPersonId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}","summaryId":"${escapeHtml(summary.id)}"}}'>
                        编辑
                    </button>
                    <button type="button" class="memory-history-card-btn"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"rerollMemorySummary","payload":{"aiPersonId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}","summaryId":"${escapeHtml(summary.id)}"}}'>
                        重 Roll
                    </button>
                    <button type="button" class="memory-history-card-btn is-danger"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"deleteMemorySummary","payload":{"aiPersonId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}","summaryId":"${escapeHtml(summary.id)}"}}'>
                        删除
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染历史消息页
 *
 * @param {Object} app - chat-app 实例
 * @param {string} pageId - 'memory-history-{aiPersonId}-{mode}'
 * @returns {string} HTML
 */
export function renderMemoryHistoryPage(app, pageId) {
    // 解析 pageId
    let aiPersonId = '';
    let mode = 'calendar';
    const m = String(pageId || '').match(/^memory-history-(.+?)(-(calendar|story))?$/);
    if (m) {
        aiPersonId = m[1] || '';
        if (m[3]) mode = m[3];
    } else {
        const stripped = String(pageId || '').replace(/^memory-history-/, '');
        const lastDash = stripped.lastIndexOf('-');
        if (lastDash > 0) {
            const tail = stripped.slice(lastDash + 1);
            if (tail === 'calendar' || tail === 'story') {
                mode = tail;
                aiPersonId = stripped.slice(0, lastDash);
            } else {
                aiPersonId = stripped;
            }
        } else {
            aiPersonId = stripped;
        }
    }

    // 读配置 + 数据
    let config = { levels: [] };
    let summariesByLevel = {};
    try {
        const sdk = window.settingsSdk;
        if (sdk?.memorySummaries) {
            config = sdk.memorySummaries.getConfig(aiPersonId) || config;
            summariesByLevel = sdk.memorySummaries.listByLevel(aiPersonId) || {};
        }
    } catch (_) {}
    const levels = (config.levels || []).slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // 当前激活层(从 window 读 / 默认 L1)
    let activeLevelId = 'L1';
    try {
        if (typeof window !== 'undefined' && window.__memoryHistoryActiveLevel) {
            activeLevelId = window.__memoryHistoryActiveLevel[aiPersonId] || 'L1';
        }
    } catch (_) {}
    // 确保 active 在 levels 里
    if (!levels.some((l) => l.id === activeLevelId)) {
        activeLevelId = levels[0]?.id || 'L1';
    }

    // 当前层概要列表
    const currentList = (summariesByLevel[activeLevelId] || []).slice();

    // tab 显示每层 count
    const levelsWithCount = levels.map((l) => ({
        ...l,
        count: (summariesByLevel[l.id] || []).length,
    }));

    // 联系人名
    let contactName = aiPersonId;
    try {
        const sdk = window.settingsSdk;
        const ai = sdk?.aiPersons?.get?.(aiPersonId);
        if (ai) {
            const chatProfile = ai.socialProfiles?.chat || {};
            contactName = chatProfile.nickname || ai.name || aiPersonId;
        }
    } catch (_) {}

    // 当前层是否满足「生成」条件(L2+ 才有意义,需要下层有 cycle 条未消耗)
    let canGenerate = false;
    let needCount = 0;
    let haveCount = 0;
    try {
        const sdk = window.settingsSdk;
        if (sdk?.memorySummaries?.listAvailableForLayer && activeLevelId !== 'L1') {
            const available = sdk.memorySummaries.listAvailableForLayer(aiPersonId, activeLevelId) || [];
            haveCount = available.length;
            const curLevel = levels.find((l) => l.id === activeLevelId);
            needCount = Math.max(1, Number(curLevel?.cycle) || 1);
            canGenerate = haveCount >= needCount;
        }
    } catch (_) {}

    // 「+ 新建概要」按钮:L1 任何时候都能点;L2+ 禁用(必须用「生成 {层名}」按钮)
    const createBtnHtml = activeLevelId === 'L1'
        ? `
            <button type="button" class="memory-history-create-btn"
                data-app-action='{"action":"appMethod","appId":"chat","method":"openMemoryHistoryCreateModal","payload":{"aiPersonId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}","levelId":"${escapeHtml(activeLevelId)}"}}'>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
        `
        : '';

    // 「生成 {层名}」按钮(仅 L2+ 且满足条件时显示)
    const generateBtnHtml = (activeLevelId !== 'L1')
        ? `
            <button type="button" class="memory-history-generate-btn ${canGenerate ? '' : 'is-disabled'}"
                ${canGenerate ? '' : 'disabled'}
                data-app-action='{"action":"appMethod","appId":"chat","method":"generateMemorySummaryManually","payload":{"aiPersonId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}","levelId":"${escapeHtml(activeLevelId)}"}}'>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.76 1.02 6.39 2.66L21 8"/>
                    <polyline points="21 3 21 8 16 8"/>
                </svg>
                <span>${canGenerate ? '生成概要' : `还需 ${needCount - haveCount} 条 ${activeLevelId}`}</span>
            </button>
        `
        : '';

    // 概要列表
    let listHtml;
    if (currentList.length === 0) {
        const emptyMsg = activeLevelId === 'L1'
            ? '点击右下角「+」新建概要'
            : `下层概要不足 ${needCount} 条,无法生成`;
        listHtml = `
            <div class="memory-history-empty">
                <div class="memory-history-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <div class="memory-history-empty-text">${escapeHtml(emptyMsg)}</div>
            </div>
        `;
    } else {
        listHtml = `<div class="memory-history-list">${currentList.map((s) => renderSummaryCard(s, aiPersonId, mode)).join('')}</div>`;
    }

    return `
        <div class="memory-history" data-ai-person-id="${escapeHtml(aiPersonId)}" data-mode="${escapeHtml(mode)}" data-level-id="${escapeHtml(activeLevelId)}">
            ${renderHeaderBar(aiPersonId, mode, contactName)}
            <div class="memory-history-page">
                <div class="memory-history-context-name">${escapeHtml(contactName)}</div>
                ${renderLevelTabs(aiPersonId, mode, levelsWithCount, activeLevelId)}
                ${generateBtnHtml}
                ${listHtml}
            </div>
            ${createBtnHtml}
        </div>
    `;
}

export default renderMemoryHistoryPage;