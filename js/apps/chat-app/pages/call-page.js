/**
 * chat-app / 语音通话页面
 *
 * Phase 11 UI 复原
 *
 * 功能:
 *   - 全屏深色渐变背景 + 动态装饰
 *   - 大头像 + 光晕动画
 *   - 通话状态 + 计时器
 *   - 消息对话区域
 *   - 底部控制按钮（静音/挂断/最小化）
 *
 * 当前阶段:1:1 复原 UI,模拟效果
 */

import { escapeHtml } from '@/src/core/escape.js';

// Demo 联系人数据
const DEMO_CONTACTS = {
    'ai-1': { id: 'ai-1', name: '小美', avatarBg: '#FF9ECD', status: '在线' },
    'ai-2': { id: 'ai-2', name: '小明', avatarBg: '#A8C8EC', status: '在线' },
    'ai-3': { id: 'ai-3', name: '小蓝', avatarBg: '#B8E6CF', status: '离线' },
};

// 头像背景色工具
function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD', '#B8E6CF', '#D4B8F0'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * 渲染语音通话页面
 *
 * @param {Object} app - app 配置
 * @param {string} contactId - 联系人 id
 * @param {string} callType - 通话类型 'voice' | 'video'
 * @returns {string} HTML 字符串
 */
export function renderCallPage(app, contactId, callType = 'voice') {
    const contact = DEMO_CONTACTS[contactId] || { id: contactId, name: '未知联系人', avatarBg: '#E8E8E8', status: '在线' };
    const avatarColor = getAvatarColor(contactId);
    const isVideo = callType === 'video';

    // 背景样式
    const bgStyle = isVideo
        ? 'background:#0a0a0a;'
        : 'background:linear-gradient(160deg, #0f0f23 0%, #1a1a3e 30%, #2d1b4e 60%, #1f1f3f 100%);';

    // 动态背景装饰（仅语音通话）
    const bgDecorHtml = !isVideo ? `
        <div class="call-bg-decor">
            <div class="call-bg-orb call-bg-orb-1"></div>
            <div class="call-bg-orb call-bg-orb-2"></div>
            <div class="call-bg-orb call-bg-orb-3"></div>
        </div>
    ` : '';

    // 视频通话背景
    const videoBgHtml = isVideo ? `
        <div class="call-video-bg">
            <div class="call-video-blur" style="background:linear-gradient(135deg,${avatarColor}30,${avatarColor}60);"></div>
        </div>
        <div class="call-video-gradient"></div>
        <div class="call-local-video">
            <div class="call-local-avatar" style="background:linear-gradient(135deg,#374151,#1f2937);">
                <svg viewBox="0 0 24 24" fill="#6b7280" width="28" height="28">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20v-2c0-2.21 3.58-4 8-4s8 1.79 8 4v2"/>
                </svg>
            </div>
        </div>
    ` : '';

    // 头像区域
    const avatarHtml = !isVideo ? `
        <div class="call-avatar-container">
            <div class="call-avatar-glow"></div>
            <div class="call-avatar">
                <div class="call-avatar-inner" style="background:linear-gradient(135deg,${avatarColor},${avatarColor}cc);">
                    ${escapeHtml(contact.name.charAt(0))}
                </div>
            </div>
        </div>
    ` : `
        <div class="call-avatar call-avatar-video">
            <div class="call-avatar-inner" style="background:linear-gradient(135deg,${avatarColor},${avatarColor}cc);">
                ${escapeHtml(contact.name.charAt(0))}
            </div>
        </div>
    `;

    return `
        <div class="call-page" data-call-type="${callType}">
            ${bgDecorHtml}
            ${videoBgHtml}

            <!-- 顶部信息区域 -->
            <div class="call-info-area">
                ${avatarHtml}

                <div class="call-name">${escapeHtml(contact.name)}</div>

                <div class="call-status">
                    <span class="call-status-dot"></span>
                    <span class="call-status-text" id="call-status-text">正在呼叫...</span>
                </div>

                <div class="call-duration" id="call-duration">00:00</div>
            </div>

            <!-- 消息对话区域 -->
            <div class="call-chat-area">
                <div class="call-messages-container" id="call-messages-container">
                    <!-- 通话消息列表 -->
                </div>
                <div class="call-input-area">
                    <input type="text" class="call-message-input" id="call-message-input"
                           placeholder="输入消息..." autocomplete="off">
                    <button class="call-send-btn" id="call-send-btn">
                        <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- 底部控制按钮 -->
            <div class="call-controls-area">
                <button class="call-control-btn" id="mute-btn" title="静音">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                </button>

                <button class="call-end-btn" id="end-call-btn" title="挂断">
                    <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                    </svg>
                </button>

                ${!isVideo ? `
                <button class="call-control-btn" id="minimize-btn" title="最小化">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 13H5v-2h14v2z"/>
                    </svg>
                </button>
                ` : ''}
            </div>
        </div>
    `;
}

export default renderCallPage;
