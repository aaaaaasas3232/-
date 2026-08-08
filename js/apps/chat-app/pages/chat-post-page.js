/**
 * chat-app / 发布新动态详情页
 *
 * Phase 11 — UI 复原
 *
 * 来源:旧版 chat.js `ChatApp.prototype.openPostMoment()`
 *
 * UI 结构:
 *   - 顶栏:左返回 + 中间标题「发布新动态」
 *   - 内容卡片:大文本域(分享想法)+ 图片预览网格(空态) + 图片/AI图片按钮
 *   - 位置选项:点击切换是否显示位置
 *   - 可见范围:点击切换 公开 / 仅好友 / 仅自己
 *   - 发布按钮:渐变蓝底
 *
 * 当前阶段:1:1 复原 UI,交互留待 Phase 4+ 接入(发布/图片/AI生成)
 * 顶部 header 返回按钮认真写(自接管,同 chat-settings / chat-private 同款)
 */

import { escapeHtml } from '@/src/core/escape.js';

/**
 * 渲染「发布新动态」详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @returns {string} HTML 字符串
 */
export function renderChatPostPage(app) {
    // 顶部 header(只保留返回按钮 + 居中标题)
    // ★ 跟 chat-private / chat-settings 同款自接管 header 的策略
    const headerBarHtml = `
        <div class="chat-post-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="chat-post-title">发布新动态</div>
        </div>
    `;

    return `
        <div class="chat-post">
            ${headerBarHtml}
            <div class="chat-post-page">

                <!-- 内容输入卡片 -->
                <div class="chat-post-card">
                    <textarea
                        id="moment-content"
                        class="chat-post-textarea"
                        placeholder="分享你此刻的想法..."
                    ></textarea>

                    <!-- 图片预览区(空态) -->
                    <div id="moment-images-preview" class="chat-post-images-preview"></div>

                    <!-- 添加图片按钮组 -->
                    <div class="chat-post-toolbar">
                        <button id="add-moment-image" class="chat-post-toolbar-btn" type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span>图片</span>
                        </button>
                        <button id="add-ai-image" class="chat-post-toolbar-btn chat-post-toolbar-btn--ai" type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.8">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                            </svg>
                            <span>文字描述</span>
                        </button>
                    </div>
                </div>

                <!-- 位置选项 -->
                <div class="chat-post-row" id="add-location">
                    <div class="chat-post-row-left">
                        <svg class="chat-post-row-icon" viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        <span class="chat-post-row-label">添加位置</span>
                    </div>
                    <span id="location-text" class="chat-post-row-value">不显示</span>
                </div>

                <!-- 可见范围 -->
                <div class="chat-post-row" id="set-visibility">
                    <div class="chat-post-row-left">
                        <svg class="chat-post-row-icon" viewBox="0 0 24 24">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                        <span class="chat-post-row-label">谁可以看</span>
                    </div>
                    <span id="visibility-text" class="chat-post-row-value">公开</span>
                </div>

                <!-- 发布按钮 -->
                <button id="publish-moment-btn" class="chat-post-publish-btn" type="button">
                    发布动态
                </button>

            </div>
        </div>
    `;
}

export default renderChatPostPage;
