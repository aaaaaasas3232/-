/**
 * chat-app / 发起群聊页面 (v0.33)
 *
 * 业务流程:
 *   1. 进入新页 new-group,选择至少 2 个 AI 成员(来源 = 当前 world 下的 AI 列表)
 *   2. 选好 → 进入「选择消息存储模式」步骤(calendar / story)
 *   3. 用户选定 → 调 sdk.chatGroups.create(),跳转到新群聊页 group-{id}
 *
 * 设计:
 *   - 一页内分两步(step 1 选人,step 2 选 mode),用本地 state 切换
 *   - 通过 data-app-action 派发:
 *     - "toggle-ai-{aiId}"  切换某个 AI 的选中状态(payload.aiPersonId)
 *     - "next-mode"         进入第二步
 *     - "back-step1"        从第二步返回第一步
 *     - "confirm-create"    提交 create(已带 mode)
 *     - "pick-mode-{calendar|story}"  第二步选 mode(payload.mode)
 *
 * ★ v0.39 关键修复:
 *   - 拆出 sync renderNewGroupPage(只拼 HTML)+ async renderNewGroupPageAsync(等 getWorldAiPersons)
 *   - 修正 data-app-action payload 嵌套:之前 `aiPersonId` / `mode` 直接放顶层,
 *     methods 里读 payload.aiPersonId 拿到 undefined → 方法直接 return,UI 无反应
 */

import { escapeHtml } from '@/src/core/escape.js';
import { DEFAULT_AI_AVATAR_BG } from '../aiMeta.js';
import { SNAIL_EMPTY_SVG } from '../snail-icon.js';

const VALID_MODES = new Set(['calendar', 'story']);

/**
 * 渲染选中状态过滤后的 AI 列表(同样使用 getWorldAiPersons)
 *
 * @param {Object} aiList  从 getWorldAiPersons() 拿的 AI 数组
 * @param {Set}   selectedIds 已选中的 aiPersonId 集合(可选,首次空 Set)
 */
export function renderAiPickGrid(aiList, selectedIds = new Set()) {
    if (!Array.isArray(aiList) || aiList.length === 0) {
        return `
            <div class="new-group-empty">
                <div class="new-group-empty-icon">${SNAIL_EMPTY_SVG}</div>
                <div class="new-group-empty-text">当前世界观下还没有可用的 AI 人设</div>
            </div>
        `;
    }
    return aiList.map((ai) => {
        const checked = selectedIds.has(ai.id);
        const initial = escapeHtml((ai.name || ai.id || '?').charAt(0));
        const avatarBg = ai.avatarBg || DEFAULT_AI_AVATAR_BG;
        const avatar = ai.avatar;
        const avatarInner = avatar
            ? `<img src="${escapeHtml(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
            : initial;
        return `
            <button type="button" class="new-group-ai-pill ${checked ? 'is-selected' : ''}" data-app-action='{"action":"appMethod","appId":"chat","method":"toggleNewGroupAi","payload":{"aiPersonId":"${escapeHtml(ai.id)}"}}'>
                <span class="new-group-ai-check">${checked ? '✓' : ''}</span>
                <span class="new-group-ai-avatar" style="background:${escapeHtml(avatarBg)};">${avatarInner}</span>
                <span class="new-group-ai-name">${escapeHtml(ai.name || ai.id)}</span>
            </button>
        `;
    }).join('');
}

/**
 * Step 1 渲染函数:选 AI
 */
function renderStep1(aiList, selectedIds) {
    const selectedCount = selectedIds.size;
    const canNext = selectedCount >= 2;
    return `
        <div class="new-group-step new-group-step-1">
            <div class="new-group-tip">
                <span class="new-group-tip-dot"></span>
                <span>选择至少 <strong>2</strong> 位 AI 发起群聊 · 已选 <strong data-new-group-count>${selectedCount}</strong> 位</span>
            </div>
            <div class="new-group-ai-grid">
                ${renderAiPickGrid(aiList, selectedIds)}
            </div>
            <div class="new-group-actions">
                <button type="button" class="new-group-btn new-group-btn-ghost"
                    data-app-action='{"action":"appMethod","appId":"chat","method":"cancelNewGroup"}'>取消</button>
                <button type="button" class="new-group-btn new-group-btn-primary ${canNext ? '' : 'is-disabled'}"
                    ${canNext ? '' : 'disabled'}
                    data-app-action='{"action":"appMethod","appId":"chat","method":"confirmNewGroupStep1"}'>下一步</button>
            </div>
        </div>
    `;
}

/**
 * Step 2 渲染函数:选 mode
 */
function renderStep2(selectedIds, aiList, presetMode = '') {
    const names = Array.from(selectedIds).map((id) => {
        const ai = aiList.find((a) => a.id === id);
        return ai?.name || id;
    });
    const displayNames = names.slice(0, 3).map(escapeHtml).join('、');
    const overflowNote = names.length > 3 ? ` 等 ${names.length} 位` : '';
    const checkedCal = presetMode === 'calendar' ? 'checked' : '';
    const checkedSto = presetMode === 'story' ? 'checked' : '';
    return `
        <div class="new-group-step new-group-step-2">
            <div class="new-group-summary">
                <span class="new-group-summary-label">已选成员</span>
                <span class="new-group-summary-list">${displayNames}${overflowNote}</span>
            </div>
            <div class="new-group-mode-question">选择群聊消息存储模式</div>
            <div class="new-group-mode-options">
                <label class="new-group-mode-option ${presetMode === 'calendar' ? 'is-selected' : ''}">
                    <input type="radio" name="new-group-mode" value="calendar" ${checkedCal} data-app-action='{"action":"appMethod","appId":"chat","method":"pickNewGroupMode","payload":{"mode":"calendar"}}'>
                    <div class="new-group-mode-radio"></div>
                    <div class="new-group-mode-info">
                        <div class="new-group-mode-title">日历模式</div>
                        <div class="new-group-mode-hint">日常聊天 · 蓝色主题 · 消息按日期归档</div>
                    </div>
                </label>
                <label class="new-group-mode-option ${presetMode === 'story' ? 'is-selected' : ''}">
                    <input type="radio" name="new-group-mode" value="story" ${checkedSto} data-app-action='{"action":"appMethod","appId":"chat","method":"pickNewGroupMode","payload":{"mode":"story"}}'>
                    <div class="new-group-mode-radio"></div>
                    <div class="new-group-mode-info">
                        <div class="new-group-mode-title">故事模式</div>
                        <div class="new-group-mode-hint">情景扮演 / 游戏 · 粉色主题 · 与日历模式独立</div>
                    </div>
                </label>
            </div>
            <div class="new-group-actions">
                <button type="button" class="new-group-btn new-group-btn-ghost"
                    data-app-action='{"action":"appMethod","appId":"chat","method":"backToNewGroupStep1"}'>上一步</button>
                <button type="button" class="new-group-btn new-group-btn-primary ${VALID_MODES.has(presetMode) ? '' : 'is-disabled'}"
                    ${VALID_MODES.has(presetMode) ? '' : 'disabled'}
                    data-app-action='{"action":"appMethod","appId":"chat","method":"confirmCreateNewGroup"}'>创建群聊</button>
            </div>
        </div>
    `;
}

/**
 * 主渲染入口(sync)
 * @param {Object} app
 * @param {Object} options { step?, selectedIds?: string[], presetMode?: string, aiList?: Array }
 *
 * ★ v0.39:把 AI 列表拉取移出去,渲染函数只负责拼 HTML。
 *   - aiList 由调用方(异步 wrapper)提前 await getWorldAiPersons() 拿到
 *   - 没传 aiList 或 aiList=[] 时,走空状态分支(避免 Promise 误进 Array 判断)
 *   - 这样能正确接入 framework 的 resolveAsyncRenderer 异步渲染管线,
 *     不会再因「返回了带空 grid 的 HTML + 后置 syncNow 失败」卡死在空状态
 */
export function renderNewGroupPage(app, options = {}) {
    const step = options.step === 2 ? 2 : 1;
    const selectedIds = new Set(Array.isArray(options.selectedIds) ? options.selectedIds : []);
    const presetMode = options.presetMode || '';
    const aiList = Array.isArray(options.aiList) ? options.aiList : [];

    // 数据持久化在 window 上,跨 v-html 保留 (避免重复选)
    const state = {
        step,
        selectedIds: Array.from(selectedIds),
        presetMode,
        aiList,
    };

    const stepBody = step === 2
        ? renderStep2(new Set(selectedIds), aiList, presetMode)
        : renderStep1(aiList, new Set(selectedIds));

    const title = step === 2 ? '选择群聊模式' : '发起群聊';

    return `
        <div class="new-group-page" data-new-group-state='${escapeHtml(JSON.stringify(state))}'>
            <!-- 顶部 header (返回 + 标题) -->
            <div class="chat-header">
                <div class="chat-header-left">
                    <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                        <svg viewBox="0 0 24 24">
                            <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <div class="chat-header-info">
                        <div class="chat-header-name">${escapeHtml(title)}</div>
                        <div class="chat-header-status">第 ${step} / 2 步</div>
                    </div>
                </div>
            </div>
            <div class="new-group-body">
                ${stepBody}
            </div>
        </div>
    `;
}

/**
 * ★ v0.39 异步渲染入口(让 framework 的 resolveAsyncRenderer 接管 Promise + cache)
 *
 *   - 优先用 window.__chatAppInternal.getWorldAiPersons()(由 new-chat-page.js 挂载)
 *   - 失败 fallback 到 import 直接调(防止 window 上没挂载)
 *   - 把 await 拿到的 aiList 灌进 options,再调 sync renderNewGroupPage
 *   - 这样 framework 会:
 *       1. 看到 renderDetailPage 返回 Promise
 *       2. 第一次显示 loading HTML
 *       3. Promise resolve 后写 cache + ++tick
 *       4. 触发 Vue 重算,命中 cache 返回真实 HTML
 */
export async function renderNewGroupPageAsync(app, options = {}) {
    let aiList = [];
    try {
        let getter = null;
        if (typeof window !== 'undefined' && window.__chatAppInternal?.getWorldAiPersons) {
            getter = window.__chatAppInternal.getWorldAiPersons;
        } else {
            // 兜底:动态 import 拿取
            const mod = await import('./new-chat-page.js');
            getter = mod.getWorldAiPersons;
        }
        if (typeof getter === 'function') {
            aiList = await getter();
        }
    } catch (err) {
        console.warn('[new-group-page] load ai list failed', err);
    }
    return renderNewGroupPage(app, { ...options, aiList });
}

export default renderNewGroupPage;
