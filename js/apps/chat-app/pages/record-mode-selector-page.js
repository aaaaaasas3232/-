/**
 * chat-app / 添加新朋友 — 聊天记录模式选择页 (v0.23)
 *
 *   进入流程：消息列表 → 「+」→ 弹本选择页（日历模式 vs 故事模式）
 *   选定后 push 到 new-chat 联系人列表页（new-chat 会读 sdk.chatContacts
 *   按当前 mode 过滤已添加联系人，避免重复）。
 *
 *   模式语义：
 *     - 日历模式 = 正常使用，社媒 App 真实可调用
 *     - 故事模式 = 暂时性情景扮演 / 游戏模式，背景会变成粉色
 *
 *   设计：
 *     - 自接管 header（返回 + 标题）
 *     - 两个大卡片（图标 + 标题 + 描述），点击直接 push 到下一层
 *     - 通过 data-app-action 派发到 chat-app 的 method
 */

import { escapeHtml } from '@/src/core/escape.js';

const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
</svg>`;

const ICON_STORY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
</svg>`;

/**
 * 渲染「选择聊天记录模式」页面
 */
export function renderRecordModeSelectorPage(app) {
    const cardCal = `
        <button class="chat-mode-selector-card chat-mode-selector-card--calendar" data-app-action='${escapeHtml(JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'selectRecordMode',
            payload: { mode: 'calendar' },
        }))}'>
            <div class="chat-mode-selector-card__icon chat-mode-selector-card__icon--calendar">
                ${ICON_CALENDAR}
            </div>
            <div class="chat-mode-selector-card__title">日历视图模式</div>
            <div class="chat-mode-selector-card__desc">
                正常使用模式。聊天记录按日期归档，可被社媒 App（Murmur 等）真实调用。
            </div>
            <div class="chat-mode-selector-card__hint">
                <span class="chat-mode-selector-card__chip">蓝色背景</span>
                <span class="chat-mode-selector-card__chip">真实社交</span>
            </div>
        </button>
    `;
    const cardStory = `
        <button class="chat-mode-selector-card chat-mode-selector-card--story" data-app-action='${escapeHtml(JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'selectRecordMode',
            payload: { mode: 'story' },
        }))}'>
            <div class="chat-mode-selector-card__icon chat-mode-selector-card__icon--story">
                ${ICON_STORY}
            </div>
            <div class="chat-mode-selector-card__title">故事记录模式</div>
            <div class="chat-mode-selector-card__desc">
                暂时性情景扮演 / 游戏模式。消息列表背景变为粉色，与日历模式独立副本。
            </div>
            <div class="chat-mode-selector-card__hint">
                <span class="chat-mode-selector-card__chip chat-mode-selector-card__chip--story">粉色背景</span>
                <span class="chat-mode-selector-card__chip chat-mode-selector-card__chip--story">游戏模式</span>
            </div>
        </button>
    `;
    return `
        <div class="chat-mode-selector-page">
            <div class="chat-mode-selector-header">
                <button class="new-chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                    <svg viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="chat-mode-selector-title">选择聊天记录模式</div>
            </div>
            <div class="chat-mode-selector-desc">
                选定后无法更改（同一 AI 可在另一个模式下再添加一次作为独立联系人）。
            </div>
            <div class="chat-mode-selector-list">
                ${cardCal}
                ${cardStory}
            </div>
        </div>
    `;
}

export default renderRecordModeSelectorPage;