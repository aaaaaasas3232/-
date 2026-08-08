/**
 * chat-app / 图片描述详情弹窗组件 (Vue 组件)
 *
 * Vue 组件模式，用于显示图片描述详情
 *
 * 用法：
 * 1. 注册: import { DescImageModal } from './desc-image-modal.js';
 * 2. 调用: chatModalManager.open('desc-image-detail', { description, cardColor, textColor, borderColor });
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// Vue 组件: 图片描述详情弹窗
// ============================================

export const DescImageDetailModal = {
    name: 'DescImageDetailModal',
    props: {
        description: { type: String, default: '' },
        cardColor: { type: String, default: '#FFE4EC' },
        textColor: { type: String, default: '#D4728A' },
        borderColor: { type: String, default: '#C0607A' },
    },
    emits: ['close', 'favorite', 'share'],
    computed: {
        safeCardColor() {
            return escapeHtml(this.cardColor || '#FFE4EC');
        },
        safeTextColor() {
            return escapeHtml(this.textColor || '#D4728A');
        },
        safeBorderColor() {
            return escapeHtml(this.borderColor || '#C0607A');
        },
        safeDesc() {
            return escapeHtml(this.description || '');
        },
    },
    template: `
        <div class="desc-image-modal-overlay" @click.self="$emit('close')">
            <div class="desc-image-modal">
                <!-- 按钮区域 -->
                <div class="desc-image-modal-actions">
                    <button class="desc-image-modal-action-btn" @click.stop="$emit('favorite')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        收藏
                    </button>
                    <button class="desc-image-modal-action-btn" @click.stop="$emit('share')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        分享
                    </button>
                </div>
                <!-- 图片内容区域 -->
                <div class="desc-image-modal-card"
                     :style="{ background: safeCardColor, borderColor: safeBorderColor }">
                    <div class="desc-image-modal-card-img" :style="{ color: safeTextColor }">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.6;">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                        <div class="desc-image-modal-card-label">文字描述图片</div>
                    </div>
                </div>
                <!-- 描述文字 -->
                <div class="desc-image-modal-content">
                    <div class="desc-image-modal-desc">{{ description }}</div>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 兼容旧版 API (DOM 模式，已废弃)
// ============================================

/**
 * @deprecated 使用 Vue 组件模式替代
 * 显示模拟图片详情弹窗 (DOM 模式)
 */
export function showDescImageModal(description, cardColor = '#FFE4EC', textColor = '#D4728A', borderColor = '#C0607A', container = null) {
    const mountContainer = container || document.body;
    mountContainer.querySelector('.desc-image-modal-overlay')?.remove();

    const safeDesc = escapeHtml(description || '');
    const safeCardColor = escapeHtml(cardColor || '#FFE4EC');
    const safeTextColor = escapeHtml(textColor || '#D4728A');
    const safeBorderColor = escapeHtml(borderColor || '#C0607A');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div class="desc-image-modal-overlay">
            <div class="desc-image-modal">
                <div class="desc-image-modal-card" style="background: ${safeCardColor}; border-color: ${safeBorderColor}; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div class="desc-image-modal-icon" style="color: ${safeTextColor};">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.6;">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                    </div>
                    <div class="desc-image-modal-label" style="color: ${safeTextColor};">文字描述图片</div>
                </div>
                <div class="desc-image-modal-content">
                    <div class="desc-image-modal-desc">${safeDesc}</div>
                </div>
            </div>
        </div>
    `;
    const modal = wrapper.firstElementChild;
    mountContainer.appendChild(modal);

    // 关闭处理
    let escHandler;
    const close = () => {
        modal.classList.add('desc-image-modal--closing');
        setTimeout(() => modal.remove(), 200);
        document.removeEventListener('keydown', escHandler);
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    return modal;
}

// ============================================
// 颜色预设
// ============================================

export const DESC_IMAGE_PRESETS = {
    pink: { cardColor: '#FFE4EC', textColor: '#D4728A', borderColor: '#C0607A', name: '淡粉' },
    blue: { cardColor: '#E8F2FF', textColor: '#4A6FA5', borderColor: '#3A5F95', name: '淡蓝' },
    green: { cardColor: '#E8F8F0', textColor: '#4CAF50', borderColor: '#3A8F40', name: '淡绿' },
    purple: { cardColor: '#F3E8FF', textColor: '#8B5CF6', borderColor: '#7B4CD6', name: '淡紫' },
    yellow: { cardColor: '#FFF8E1', textColor: '#FF9800', borderColor: '#DF7800', name: '淡黄' },
    orange: { cardColor: '#FFF3E0', textColor: '#FF5722', borderColor: '#DF4712', name: '淡橙' },
};

// ============================================
// 渲染函数 (用于消息中的卡片)
// ============================================

/**
 * 渲染模拟图片气泡（在聊天消息中使用）
 *
 * 只返回 .desc-image-card 气泡内容，包装器由调用方提供
 *
 * @param {Object} msg - 消息对象
 * @returns {string} HTML 字符串（.desc-image-card）
 */
export function renderDescImageBubble(msg) {
    const desc = msg.imageDescription || msg.desc || '';
    const cardColor = msg.cardColor || '#FFE4EC';
    const textColor = msg.textColor || '#D4728A';

    // 短描述（超过20字截断）
    const shortDesc = desc.length > 20 ? desc.substring(0, 20) + '...' : desc;

    // JSON 序列化 data 属性
    const dataDesc = escapeHtml(desc);
    const dataColor = escapeHtml(cardColor);
    const dataTextColor = escapeHtml(textColor);

    return `
        <div class="desc-image-card"
             data-desc="${dataDesc}"
             data-color="${dataColor}"
             data-text-color="${dataTextColor}">
            <div class="desc-image-card-inner" style="background: ${escapeHtml(cardColor)};">
                <div class="desc-image-card-icon" style="color: ${escapeHtml(textColor)};">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.7;">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                </div>
                <div class="desc-image-card-text-group">
                    <div class="desc-image-card-text" style="color: ${escapeHtml(textColor)}; font-size: 12px;">${escapeHtml(shortDesc)}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染动态页面中的模拟图片（单图大卡片）
 */
export function renderDescImageCard(description, cardColor = '#FFE4EC', textColor = '#D4728A') {
    const shortDesc = description.length > 50 ? description.substring(0, 50) + '...' : description;

    const dataDesc = escapeHtml(description);
    const dataColor = escapeHtml(cardColor);
    const dataTextColor = escapeHtml(textColor);

    return `
        <div class="ai-image-display clickable-desc-image"
             data-desc="${dataDesc}"
             data-color="${dataColor}"
             data-text-color="${dataTextColor}"
             style="width: 100%; height: 210px; background: ${escapeHtml(cardColor)}; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; cursor: pointer;">
            <div class="ai-image-display-label" style="position: absolute; top: 10px; left: 10px; background: rgba(255,255,255,0.8); color: ${escapeHtml(textColor)}; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 600;">文字描述</div>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="${escapeHtml(textColor)}" style="margin-bottom: 12px; opacity: 0.6;">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            <div style="font-size: 14px; color: ${escapeHtml(textColor)}; text-align: center; padding: 0 20px; line-height: 1.5;">"${escapeHtml(shortDesc)}"</div>
            <div style="font-size: 11px; color: ${escapeHtml(textColor)}; opacity: 0.6; margin-top: 10px;">点击查看完整描述</div>
        </div>
    `;
}

/**
 * 渲染动态页面中的模拟图片（网格小卡片）
 */
export function renderDescImageGridItem(description, cardColor = '#FFE4EC', textColor = '#D4728A', height = 135) {
    const shortDesc = description.length > 15 ? description.substring(0, 15) + '...' : description;

    const dataDesc = escapeHtml(description);
    const dataColor = escapeHtml(cardColor);
    const dataTextColor = escapeHtml(textColor);

    return `
        <div class="ai-image-grid-item clickable-desc-image"
             data-desc="${dataDesc}"
             data-color="${dataColor}"
             data-text-color="${dataTextColor}"
             style="position: relative; height: ${height}px; overflow: hidden; background: ${escapeHtml(cardColor)}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; cursor: pointer;">
            <div class="ai-image-grid-label" style="position: absolute; top: 4px; left: 4px; background: rgba(255,255,255,0.8); color: ${escapeHtml(textColor)}; padding: 2px 5px; border-radius: 6px; font-size: 8px; font-weight: 600;">描述</div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${escapeHtml(textColor)}" style="margin-bottom: 4px; opacity: 0.6;">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            <div style="font-size: 9px; color: ${escapeHtml(textColor)}; text-align: center; line-height: 1.2;">${escapeHtml(shortDesc)}</div>
        </div>
    `;
}

/**
 * 绑定模拟图片点击事件
 */
export function bindDescImageEvents(container, showModal = showDescImageModal) {
    if (!container) return;

    container.querySelectorAll('.clickable-desc-image, .desc-image-card').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const desc = el.getAttribute('data-desc') || '';
            const cardColor = el.getAttribute('data-color') || '#FFE4EC';
            const textColor = el.getAttribute('data-text-color') || '#D4728A';
            showModal(desc, cardColor, textColor, container);
        });
    });
}

// 将函数挂到 window 上供其他模块使用
if (typeof window !== 'undefined') {
    window.__chatAppDescImage = {
        showDescImageModal,
        bindDescImageEvents,
        renderDescImageCard,
        renderDescImageGridItem,
        DESC_IMAGE_PRESETS,
    };
}
