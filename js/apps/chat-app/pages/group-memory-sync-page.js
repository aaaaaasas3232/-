/**
 * chat-app / 群聊记忆互通设置详情页 (v0.87)
 *
 *   入口:个人页面 → 群聊记忆互通 菜单项
 *     - pageId: 'group-memory-sync'
 *
 *   功能:
 *     - 顶部 header(返回 + 标题)
 *     - 说明卡片(跟收藏页一样的白底毛玻璃卡片 + 简介文字)
 *     - 总开关卡(启用记忆互通)
 *     - AI 选择列表(可选 / 已选,跟旧 chat.js 的 AI select-item 风格对齐)
 *     - 每个已选 AI 的单独配置卡:
 *       - 个人启停 toggle
 *       - 读今天群聊回合数(0~50,默认 8)
 *       - 读往期群聊概要数(0~10,默认 3)
 *       - 关联群聊数(展示给用户看「这个 AI 在 N 个群聊里」)
 *     - 全选 / 取消全选 按钮
 *     - 互通效果说明卡
 *     - 保存按钮(走灵动岛通知成功 / 失败)
 *
 *   设计要点:
 *     - 视觉延续收藏页风格(线性渐变背景 + 毛玻璃卡片)
 *     - 所有按钮走 data-app-action 派发,不 appendChild / addEventListener
 *     - 顶部 header 用 framework closeDetailPage 派发
 *     - mode 仅影响「是否显示 AI 关联群聊」的故事模式不进入此页(profile 里群聊记忆互通只在日历模式显示?当前保留日历/故事均显示,但注入侧 prompt-builder 走 mode=='story' 直接跳过)
 */

import { escapeHtml } from '@/src/core/escape.js';
import { resolveAiAvatar, DEFAULT_AI_AVATAR_BG } from '../aiMeta.js';

// ─── SVG 图标 ─────────────────────────────────────────────

const ICON_BACK = `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
const ICON_PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_MINUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

// ─── Header ─────────────────────────────────────────────

function renderHeaderBar() {
    return `
        <div class="gms-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                ${ICON_BACK}
            </button>
            <div class="gms-topbar-title">群聊记忆互通</div>
            <div class="gms-topbar-spacer"></div>
        </div>
    `;
}

// ─── 卡片外壳 ─────────────────────────────────────────────

function cardWrap(content) {
    return `<div class="gms-card">${content}</div>`;
}

function renderIntroCard() {
    return cardWrap(`
        <div class="gms-card-title">群聊记忆互通</div>
        <div class="gms-card-desc">
            开启后,选定的 AI 在私聊和群聊中可以共享记忆和上下文。
            <br>AI 在群聊中的对话内容会同步到私聊记忆,私聊中的信息也会在群聊时被参考。
        </div>
    `);
}

/**
 * 总开关卡(整个群聊记忆互通的总开关)
 *   - enabled=true → 绿 + 文字「已启用 · N 个 AI」
 *   - enabled=false → 灰 + 文字「已关闭」
 */
function renderGlobalToggleCard(globalConfig, enabledAiCount) {
    const enabled = !!globalConfig.enabled;
    const statusText = enabled
        ? `已启用 · ${enabledAiCount} 个 AI`
        : '已关闭';
    return cardWrap(`
        <div class="gms-global-row">
            <div class="gms-global-info">
                <div class="gms-global-title">启用记忆互通</div>
                <div class="gms-global-desc">开启后,选定的 AI 可在群聊和私聊间共享记忆</div>
            </div>
            <label class="gms-toggle">
                <input type="checkbox"
                       class="gms-global-toggle-input"
                       ${enabled ? 'checked' : ''}
                       data-app-action='{"action":"appMethod","appId":"chat","method":"toggleGroupMemorySyncGlobal"}' />
                <span class="gms-toggle-slider"></span>
            </label>
            <div class="gms-global-status ${enabled ? 'gms-global-status--on' : ''}">${escapeHtml(statusText)}</div>
        </div>
    `);
}

/**
 * AI 选择 + 配置卡
 *   - 列表展示所有 AI(从 sdk.worlds 拿所有 aiPersons)
 *   - 已选 AI(在 globalConfig.aiIds 里的)→ 绿色边框 + 勾选
 *   - 未选 AI → 灰色边框 + 未选
 *   - 点 AI 行:切换 aiIds 成员(走 appMethod toggleGroupMemorySyncAi)
 *
 * @param {object} opts
 * @param {Array} opts.allAIs           所有 AI 人设数组
 * @param {Array} opts.selectedAiIds    已选 aiId 列表
 * @param {Map}  opts.aiConfigMap       aiId → 单 AI 配置 {enabled, contextRounds, summaryReadCount}
 * @param {Map}  opts.aiGroupCountMap   aiId → 该 AI 关联的群聊数(供「关联 N 个群聊」展示)
 */
function renderAiListCard(opts) {
    const { allAIs, selectedAiIds, aiConfigMap, aiGroupCountMap } = opts;
    const selectedSet = new Set(selectedAiIds);

    if (!allAIs || allAIs.length === 0) {
        return cardWrap(`
            <div class="gms-ai-list-header">
                <div class="gms-ai-list-title">选择互通的 AI</div>
                <div class="gms-ai-list-sub">可选择多个 AI,它们的私聊记忆将与群聊互通</div>
            </div>
            <div class="gms-empty">暂无 AI 角色</div>
        `);
    }

    const items = allAIs.map((ai) => {
        const isSelected = selectedSet.has(ai.id);
        const cfg = aiConfigMap.get(ai.id) || { enabled: true, contextRounds: 8, summaryReadCount: 3 };
        const aiEnabled = isSelected && cfg.enabled !== false;
        const avatar = resolveAiAvatar(ai.id);
        const initial = ai.name ? ai.name.charAt(0) : '?';
        const groupCount = aiGroupCountMap.get(ai.id) || 0;
        const groupText = groupCount > 0 ? `关联 ${groupCount} 个群聊` : '暂未加入群聊';

        const safeNickname = escapeHtml(ai.name || ai.id || '未命名');
        const safeGroupText = escapeHtml(groupText);

        // 选中 + 已配置 → 展开显示配置项
        const configHtml = isSelected ? renderAiConfigSection(ai.id, cfg, groupCount) : '';

        return `
            <div class="gms-ai-item ${isSelected ? 'gms-ai-item--selected' : ''} ${aiEnabled ? '' : 'gms-ai-item--disabled'}"
                 data-ai-id="${escapeHtml(ai.id)}">
                <div class="gms-ai-item-row"
                     data-app-action='{"action":"appMethod","appId":"chat","method":"toggleGroupMemorySyncAiMembership","payload":{"aiPersonId":"${escapeHtml(ai.id)}"}}'>
                    <div class="gms-ai-checkbox ${isSelected ? 'gms-ai-checkbox--on' : ''}">
                        ${isSelected ? ICON_CHECK : ''}
                    </div>
                    <div class="gms-ai-avatar" style="background: ${escapeHtml(avatar.bg || DEFAULT_AI_AVATAR_BG)};">
                        ${avatar.url ? `<img src="${escapeHtml(avatar.url)}" alt="">` : escapeHtml(avatar.text || initial)}
                    </div>
                    <div class="gms-ai-info">
                        <div class="gms-ai-name">${safeNickname}</div>
                        <div class="gms-ai-sub ${groupCount > 0 ? 'gms-ai-sub--linked' : ''}">${safeGroupText}</div>
                    </div>
                </div>
                ${configHtml}
            </div>
        `;
    }).join('');

    const selectedCount = selectedAiIds.length;

    return cardWrap(`
        <div class="gms-ai-list-header">
            <div>
                <div class="gms-ai-list-title">选择互通的 AI</div>
                <div class="gms-ai-list-sub">可选择多个 AI,它们的私聊记忆将与群聊互通</div>
            </div>
            <span class="gms-ai-list-count">已选 ${selectedCount} 个</span>
        </div>
        <div class="gms-ai-list-bulk">
            <button type="button" class="gms-bulk-btn gms-bulk-btn--select"
                data-app-action='{"action":"appMethod","appId":"chat","method":"selectAllGroupMemorySyncAi"}'>全选</button>
            <button type="button" class="gms-bulk-btn gms-bulk-btn--deselect"
                data-app-action='{"action":"appMethod","appId":"chat","method":"deselectAllGroupMemorySyncAi"}'>取消全选</button>
        </div>
        <div class="gms-ai-list">${items}</div>
    `);
}

/**
 * 单个 AI 的展开配置区(已选中后才显示)
 *   - 个人 toggle 开关(切 enabled)
 *   - 「读今天群聊回合」stepper
 *   - 「读往期群聊概要」stepper
 */
function renderAiConfigSection(aiId, cfg, groupCount) {
    if (groupCount <= 0) {
        return `
            <div class="gms-ai-config">
                <div class="gms-ai-config-hint">该 AI 暂未加入任何群聊,无法读取群聊记忆</div>
            </div>
        `;
    }

    const enabled = cfg.enabled !== false;
    const rounds = Number(cfg.contextRounds) || 0;
    const summaries = Number(cfg.summaryReadCount) || 0;

    return `
        <div class="gms-ai-config">
            <div class="gms-ai-config-row">
                <div class="gms-ai-config-label">启用此 AI 的互通</div>
                <label class="gms-toggle gms-toggle--small">
                    <input type="checkbox"
                           class="gms-ai-config-toggle"
                           data-ai-id="${escapeHtml(aiId)}"
                           ${enabled ? 'checked' : ''}
                           data-app-action='{"action":"appMethod","appId":"chat","method":"toggleGroupMemorySyncAiEnabled","payload":{"aiPersonId":"${escapeHtml(aiId)}"}}' />
                    <span class="gms-toggle-slider"></span>
                </label>
            </div>
            <div class="gms-ai-config-row">
                <div class="gms-ai-config-label">读今天群聊回合数</div>
                <div class="gms-stepper">
                    <button type="button" class="gms-stepper-btn"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"decrementGroupMemorySyncRounds","payload":{"aiPersonId":"${escapeHtml(aiId)}"}}'>${ICON_MINUS}</button>
                    <span class="gms-stepper-value">${rounds}</span>
                    <button type="button" class="gms-stepper-btn"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"incrementGroupMemorySyncRounds","payload":{"aiPersonId":"${escapeHtml(aiId)}"}}'>${ICON_PLUS}</button>
                </div>
            </div>
            <div class="gms-ai-config-row">
                <div class="gms-ai-config-label">读往期群聊概要数</div>
                <div class="gms-stepper">
                    <button type="button" class="gms-stepper-btn"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"decrementGroupMemorySyncSummaries","payload":{"aiPersonId":"${escapeHtml(aiId)}"}}'>${ICON_MINUS}</button>
                    <span class="gms-stepper-value">${summaries}</span>
                    <button type="button" class="gms-stepper-btn"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"incrementGroupMemorySyncSummaries","payload":{"aiPersonId":"${escapeHtml(aiId)}"}}'>${ICON_PLUS}</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 底部说明 + 保存按钮(说明 + 大绿色按钮)
 */
function renderNoticeAndSaveCard() {
    return `
        <div class="gms-notice-card">
            <div class="gms-notice-title">互通效果说明</div>
            <ul class="gms-notice-list">
                <li>· 在群聊中,选定的 AI 会参考各自私聊中的对话历史</li>
                <li>· AI 在群聊中发言时,会根据私聊中建立的关系回复</li>
                <li>· 群聊中发生的重要事件会被 AI 在私聊中记住</li>
                <li>· 故事模式不参与互通(只在日历模式生效)</li>
                <li>· 多个 AI 可同时开启互通,互不干扰</li>
            </ul>
        </div>
    `;
}

/**
 * ★ v0.87 主入口 — 渲染整个详情页
 *
 * @param {object} app
 * @param {object} opts
 * @param {object} opts.sdk        settingsSdk 实例
 * @param {object} opts.user       当前用户对象
 * @returns {string} HTML 字符串
 */
export function renderGroupMemorySyncPage(app, opts = {}) {
    const { sdk, user } = opts;
    if (!sdk || !user) {
        return `
            <div class="gms-page">
                ${renderHeaderBar()}
                <div class="gms-scroll">
                    <div class="gms-empty">SDK 尚未就绪,请稍后重试</div>
                </div>
            </div>
        `;
    }

    // 1) 全局配置
    const globalConfig = (() => {
        try { return sdk.groupMemorySync?.getGlobalConfig(user) || { enabled: false, aiIds: [] }; }
        catch (_) { return { enabled: false, aiIds: [] }; }
    })();

    // 2) 所有 AI(从 sdk.aiPersons.list 取)
    const allAIs = (() => {
        try {
            const sdk2 = sdk;
            if (!sdk2?.aiPersons) return [];
            // 优先用 list,没有就 Object.values(cache)
            if (typeof sdk2.aiPersons.list === 'function') {
                return sdk2.aiPersons.list() || [];
            }
            const cache = sdk2.aiPersons?.cache;
            if (cache instanceof Map) {
                return Array.from(cache.values());
            }
            return [];
        } catch (_) { return []; }
    })();

    // 3) 每个 AI 的单 AI 配置
    const aiConfigMap = new Map();
    for (const ai of allAIs) {
        try {
            const cfg = sdk.groupMemorySync?.getAiConfig(ai.id) || { enabled: true, contextRounds: 8, summaryReadCount: 3 };
            aiConfigMap.set(ai.id, cfg);
        } catch (_) {
            aiConfigMap.set(ai.id, { enabled: true, contextRounds: 8, summaryReadCount: 3 });
        }
    }

    // 4) 每个 AI 关联的群聊数(从 user.socialProfiles.chat.calendarGroups 遍历 members)
    const aiGroupCountMap = new Map();
    try {
        const calendarGroups = user.socialProfiles?.chat?.calendarGroups || [];
        for (const group of calendarGroups) {
            if (!group || !Array.isArray(group.members)) continue;
            for (const memberId of group.members) {
                aiGroupCountMap.set(memberId, (aiGroupCountMap.get(memberId) || 0) + 1);
            }
        }
    } catch (_) { /* no-op */ }

    // 5) 实际启用的 AI 数(总开关 ON + aiIds 命中 + 单 AI enabled)
    const enabledAiIds = (() => {
        try {
            return sdk.groupMemorySync?.listEnabledAiIds(user) || [];
        } catch (_) { return []; }
    })();

    return `
        <div class="gms-page">
            ${renderHeaderBar()}
            <div class="gms-scroll">
                ${renderIntroCard()}
                ${renderGlobalToggleCard(globalConfig, enabledAiIds.length)}
                ${renderAiListCard({
                    allAIs,
                    selectedAiIds: globalConfig.aiIds || [],
                    aiConfigMap,
                    aiGroupCountMap,
                })}
                ${renderNoticeAndSaveCard()}
            </div>
        </div>
    `;
}

/**
 * ★ v0.87 重画入口(配置变更后)
 *   - 业务在 toggleGroupMemorySyncGlobal / toggleGroupMemorySyncAiMembership /
 *     toggleGroupMemorySyncAiEnabled / stepper 等 method 写完 SDK 后,
 *     调本函数强制重画
 *   - 走 AGENTS.md §32 的二段式:invalidateRendererCache + bridge.syncNow
 */
export async function rerenderGroupMemorySyncPage(app) {
    try {
        if (typeof window !== 'undefined' && typeof window.invalidateRendererCache === 'function') {
            window.invalidateRendererCache('chat', null);
        }
    } catch (_) {}
    try {
        if (window.__appRendererBridge?.syncNow) {
            window.__appRendererBridge.syncNow({ force: true });
        } else if (typeof window !== 'undefined' && window.__detailRenderTick) {
            window.__detailRenderTick.value++;
        }
    } catch (_) {}
}

export default renderGroupMemorySyncPage;