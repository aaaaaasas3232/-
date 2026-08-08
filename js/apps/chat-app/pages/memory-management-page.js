/**
 * chat-app / 聊天记录层级管理页 (v0.65 新建)
 *
 *   入口:聊天设置 → 聊天记录管理 → 层级管理
 *     - pageId: 'memory-management-{aiPersonId}-{mode}'
 *
 *   功能(v0.65):
 *     - 顶部 header(返回 + 标题)
 *     - 入口卡片:历史消息(跳转到 memory-history 页,按层查看概要)
 *     - 层级配置卡片:
 *       - 列出所有层级(L1 日概要固定 / L2+ 可改周期可删)
 *       - 改周期:内联 input,实时校验 + blur 时弹确认弹窗
 *       - 删层级:点 × 按钮,弹确认弹窗
 *       - 增层级:底部 [+] 按钮,弹表单弹窗(选位置 + 名称 + 周期)
 *     - 改 / 删 / 增 完成后立刻从 SDK 重读 config 重画
 *     - 灵动岛通知结果
 *
 *   设计要点:
 *     - 蓝色主、白色辅、简洁大方
 *     - 所有按钮走 data-app-action 派发
 *     - 不在 v-html 里 appendChild / addEventListener
 */

import { escapeHtml } from '@/src/core/escape.js';

// 头像背景色工具(同 calendar-view-page)
function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * 渲染顶部 header
 */
function renderHeaderBar() {
    return `
        <div class="memory-mgmt-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="memory-mgmt-topbar-title">层级管理</div>
            <div class="memory-mgmt-topbar-spacer"></div>
        </div>
    `;
}

/**
 * 渲染单层配置项
 *   - level.editable=false → 周期 input 不可改 + 无删除按钮
 *   - level.editable=true  → 可改 + 可删
 */
function renderLevelItem(level, prevLevel, nextLevel, aiPersonId) {
    const editable = !!level.editable;
    const deletable = !!level.deletable;
    // 校验当前值
    const cycleNum = Math.max(1, Number(level.cycle) || 1);
    // 上层 = order 更小;下层 = order 更大
    const upperLevel = prevLevel;
    const lowerLevel = nextLevel;
    // 改周期:内联 input + 旁边一个保存按钮(framework 顶层 click 委托派发)
    // 实时校验 + 红框提示,但只有点保存按钮才提交
    const constraintHint = lowerLevel
        ? `需 > ${lowerLevel.name}(${lowerLevel.cycle})` + (upperLevel ? ` · < ${upperLevel.name}(${upperLevel.cycle})` : '')
        : (upperLevel ? `需 < ${upperLevel.name}(${upperLevel.cycle})` : '');
    return `
        <div class="memory-mgmt-level-item" data-level-id="${escapeHtml(level.id)}">
            <div class="memory-mgmt-level-info">
                <div class="memory-mgmt-level-name">
                    <span class="memory-mgmt-level-id">${escapeHtml(level.id)}</span>
                    <span class="memory-mgmt-level-name-text">${escapeHtml(level.name)}</span>
                    ${!editable ? '<span class="memory-mgmt-level-fixed">固定</span>' : ''}
                </div>
                <div class="memory-mgmt-level-cycle-row">
                    <span class="memory-mgmt-level-cycle-label">周期</span>
                    <input type="number"
                           class="memory-mgmt-level-cycle-input"
                           data-level-id="${escapeHtml(level.id)}"
                           data-prev-upper="${upperLevel ? upperLevel.cycle : ''}"
                           data-prev-lower="${lowerLevel ? lowerLevel.cycle : ''}"
                           data-prev-upper-name="${upperLevel ? upperLevel.name : ''}"
                           data-prev-lower-name="${lowerLevel ? lowerLevel.name : ''}"
                           value="${cycleNum}"
                           min="1"
                           step="1"
                           ${editable ? '' : 'disabled'} />
                    <span class="memory-mgmt-level-cycle-unit">天</span>
                    ${editable ? `
                    <button type="button" class="memory-mgmt-level-save-btn"
                        data-level-id="${escapeHtml(level.id)}"
                        data-app-action='${escapeHtml(JSON.stringify({
                            action: 'appMethod',
                            appId: 'chat',
                            method: 'saveUpdateLevelCycle',
                            payload: { aiPersonId, levelId: level.id },
                        }))}'
                        aria-label="保存周期">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>
                    ` : ''}
                </div>
                ${editable && constraintHint ? `<div class="memory-mgmt-level-hint">${escapeHtml(constraintHint)}</div>` : ''}
            </div>
            ${editable ? `
            <div class="memory-mgmt-level-actions">
                <button type="button" class="memory-mgmt-level-remove-btn"
                    data-app-action='{"action":"appMethod","appId":"chat","method":"openRemoveLevelModal","payload":{"levelId":"${escapeHtml(level.id)}"}}'
                    aria-label="删除层级">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                    </svg>
                </button>
            </div>
            ` : '<div class="memory-mgmt-level-actions-spacer"></div>'}
        </div>
    `;
}

/**
 * 渲染层级管理页
 *
 * @param {Object} app - chat-app 实例(framework 注入)
 * @param {string} pageId - 'memory-management-{aiPersonId}-{mode}'
 * @returns {string} HTML
 */
export function renderMemoryManagementPage(app, pageId) {
    // 解析 pageId: 'memory-management-ai0-calendar'
    let aiPersonId = '';
    let mode = 'calendar';
    const m = String(pageId || '').match(/^memory-management-(.+?)(-(calendar|story))?$/);
    if (m) {
        aiPersonId = m[1] || '';
        if (m[3]) mode = m[3];
    } else {
        // 兜底:从 pageId 末尾截
        const stripped = String(pageId || '').replace(/^memory-management-/, '');
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

    // 读层级配置
    let config = { levels: [] };
    try {
        const sdk = window.settingsSdk;
        if (sdk?.memorySummaries?.getConfig) {
            config = sdk.memorySummaries.getConfig(aiPersonId) || config;
        }
    } catch (_) {}
    const levels = Array.isArray(config.levels) ? config.levels.slice() : [];
    // 按 order 升序
    levels.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // 渲染层级列表(每层要知道 upper/lower 才能显示约束)
    const levelItemsHtml = levels.map((lvl, idx) => {
        // prevLevel = 数组中 idx-1 = order 更小的(上层)
        // nextLevel = 数组中 idx+1 = order 更大的(下层)
        return renderLevelItem(lvl, levels[idx - 1], levels[idx + 1], aiPersonId);
    }).join('');

    // 头部信息(联系人名 + aiPerson 头像)
    let contactName = aiPersonId;
    let avatarColor = getAvatarColor(aiPersonId);
    let avatarText = '?';
    try {
        const sdk = window.settingsSdk;
        const ai = sdk?.aiPersons?.get?.(aiPersonId);
        if (ai) {
            const chatProfile = ai.socialProfiles?.chat || {};
            contactName = chatProfile.nickname || ai.name || aiPersonId;
        }
    } catch (_) {}
    avatarText = String(contactName || '?').charAt(0);

    const headerHtml = `
        <div class="memory-mgmt-header">
            <div class="memory-mgmt-header-avatar" data-avatar-color="${escapeHtml(avatarColor)}">
                <span class="memory-mgmt-header-avatar-text">${escapeHtml(avatarText)}</span>
            </div>
            <div class="memory-mgmt-header-text">
                <div class="memory-mgmt-header-name">${escapeHtml(contactName)}</div>
                <div class="memory-mgmt-header-sub">${escapeHtml(mode === 'calendar' ? '日历模式' : '故事模式')} · ${levels.length} 个层级</div>
            </div>
        </div>
    `;

    // 入口卡片:历史消息(跳到 memory-history 页)
    const historyAction = JSON.stringify({
        action: 'detail',
        appId: 'chat',
        pageId: `memory-history-${escapeHtml(aiPersonId)}-${escapeHtml(mode)}`,
    });
    const entryCardHtml = `
        <div class="memory-mgmt-entry-card">
            <div class="memory-mgmt-entry" data-app-action='${escapeHtml(historyAction)}'>
                <div class="memory-mgmt-entry-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>
                <div class="memory-mgmt-entry-text">
                    <div class="memory-mgmt-entry-title">历史消息</div>
                    <div class="memory-mgmt-entry-desc">按层级查看概要</div>
                </div>
                <svg class="memory-mgmt-entry-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </div>
        </div>
    `;

    // 层级配置卡片
    const configCardTitle = `
        <div class="memory-mgmt-section-title">
            <span>层级配置</span>
            <span class="memory-mgmt-section-sub">每层独立计数,满 ${'$'}{'{N}'} 条触发上一层生成</span>
        </div>
    `;
    const configCardHtml = `
        <div class="memory-mgmt-config-card">
            ${configCardTitle}
            <div class="memory-mgmt-level-list">
                ${levelItemsHtml}
            </div>
            <button type="button" class="memory-mgmt-add-level-btn"
                data-app-action='{"action":"appMethod","appId":"chat","method":"openAddLevelModal"}'>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>添加层级</span>
            </button>
        </div>
    `;

    return `
        <div class="memory-mgmt" data-ai-person-id="${escapeHtml(aiPersonId)}" data-mode="${escapeHtml(mode)}">
            ${renderHeaderBar()}
            <div class="memory-mgmt-page">
                ${headerHtml}
                ${entryCardHtml}
                ${configCardHtml}
            </div>
        </div>
    `;
}

export default renderMemoryManagementPage;