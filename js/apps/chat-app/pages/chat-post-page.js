/**
 * chat-app / 发布新动态详情页
 *
 * UI 结构:
 *   - 顶栏:左返回 + 中间标题「发布新动态」
 *   - 内容卡片:大文本域(分享想法)+ 图片预览网格 + AI描述生成按钮
 *   - 位置选项:点击打开位置选择弹窗
 *   - 发布按钮:渐变蓝底
 */

/**
 * 渲染「发布新动态」详情页
 *
 * @param {Object} app - app 配置(framework 注入)
 * @returns {string} HTML 字符串
 */
export function renderChatPostPage(app) {
    // 顶部 header(只保留返回按钮 + 居中标题)
    // 跟 chat-private / chat-settings 同款自接管 header 的策略
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

                    <!-- 添加图片按钮组(只保留AI描述生成) -->
                    <div class="chat-post-toolbar">
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

                <!-- 发布按钮 -->
                <button id="publish-moment-btn" class="chat-post-publish-btn" type="button">
                    发布动态
                </button>

            </div>
        </div>
    `;
}

export default renderChatPostPage;
