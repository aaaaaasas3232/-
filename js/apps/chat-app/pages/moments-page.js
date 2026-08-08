/**
 * chat-app / 动态页面 (朋友圈)
 *
 * Phase 11 — UI 复原
 *
 * 旧版 renderMomentsPage() 结构分析:
 * - 渐变背景(profile-section + 头像 + 发布按钮)
 * - 动态列表(加载态 / 空态 / 卡片流)
 * - 单条卡片(头像+名字+时间+文字+图片+位置+点赞/评论/分享)
 *
 * 简化策略(Phase 11):
 * - 1:1 复原 UI 结构(HTML + CSS)
 * - 交互逻辑后续 Phase 再接入(toolkit.island / IndexedDB)
 *
 * 样式规范:
 *   - 所有样式写到 css/apps/chat/_chat-moments.css
 *   - JS 只放动态数据属性(data-*)和无法预知的动态颜色
 *   - 不允许 style="" 内联非颜色类的样式
 */

import { escapeHtml } from '@/src/core/escape.js';
import { bindDescImageEvents, renderDescImageCard, renderDescImageGridItem } from '../components/desc-image-modal.js';
import { getAiMeta } from '../aiMeta.js';

// ─── 工具函数 ───────────────────────────────────────────

function getAvatarColor(id) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F8B500', '#6C5CE7', '#A29BFE'];
    let index = 0;
    for (let i = 0; i < (id || '').length; i++) {
        index += id.charCodeAt(i);
    }
    return colors[index % colors.length];
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── 单条动态卡片 ─────────────────────────────────────────

/**
 * 渲染单条动态卡片
 *
 * 旧版:ChatApp.prototype.renderMomentItem
 * 本版:纯 HTML 字符串,无交互(Phase 11 只做 UI)
 *
 * @param {Object} item { id, authorName, authorAvatar, authorId, isUser, timestamp, content, images[], likes[], comments[], location }
 */
function renderMomentCard(item) {
    const authorName = escapeHtml(item.authorName || item.author || '匿名');
    const authorId = escapeHtml(item.authorId || '');
    const isUser = !!item.isUser;
    const content = item.content ? escapeHtml(item.content) : '';
    const timeStr = formatTime(item.timestamp || item.ts);
    const likeCount = (item.likes || []).length;
    const commentCount = (item.comments || []).length;

    // 头像
    const avatarBg = getAvatarColor(authorId);

    // 评论区 HTML (简化版:只显示评论数,点击后续 Phase 实现)
    let commentsHtml = '';
    const comments = item.comments || [];
    if (comments.length > 0) {
        const commentItems = comments.slice(0, 3).map(c => {
            const cAuthor = escapeHtml(c.author || c.authorName || '匿名');
            const cContent = escapeHtml(c.content || '');
            const cIsReply = !!c.replyTo;
            return `
                <div class="comment-item">
                    <div class="comment-content">
                        <span class="comment-author">${cAuthor}</span>
                        ${cIsReply ? `<span class="comment-reply-tag">回复</span><span class="comment-author">${escapeHtml(c.replyTo || '')}</span>` : ''}
                        <span class="comment-text">：${cContent}</span>
                    </div>
                </div>
            `;
        }).join('');
        commentsHtml = `
            <div class="moments-comments-list">
                ${commentItems}
                ${comments.length > 3 ? `<div class="comments-expand">展开全部 ${comments.length} 条评论</div>` : ''}
            </div>
        `;
    }

    // 图片区域（包括真实图片和 AI 描述图片）
    let imagesHtml = '';
    const images = item.images || [];
    const aiImages = item.aiImages || [];

    if (images.length > 0 || aiImages.length > 0) {
        const totalImages = images.length + aiImages.length;

        // 单图情况
        if (totalImages === 1) {
            if (images.length === 1) {
                imagesHtml = `
                    <div class="post-images post-images--single">
                        <img src="${escapeHtml(images[0])}" alt="" class="post-image post-image--single" onerror="this.parentElement.innerHTML='<div class=\\'post-image-placeholder\\'></div>'">
                    </div>
                `;
            } else {
                // 单个 AI 图片
                const aiImg = aiImages[0];
                imagesHtml = `
                    <div class="post-images post-images--single">
                        ${renderDescImageCard(aiImg.description, aiImg.cardColor || '#FFE4EC', aiImg.textColor || '#D4728A')}
                    </div>
                `;
            }
        } else {
            // 多图网格
            const gridCols = totalImages <= 4 ? 2 : 3;
            const maxShow = Math.min(totalImages, 9);
            let displayedCount = 0;

            const imgItems = [];

            // 先显示真实图片
            for (let i = 0; i < images.length && displayedCount < maxShow; i++) {
                const img = images[i];
                const extraOverlay = (displayedCount === maxShow - 1 && totalImages > 9)
                    ? `<div class="post-image-overlay">+${totalImages - 9}</div>`
                    : '';
                imgItems.push(`
                    <div class="post-image-wrap">
                        <img src="${escapeHtml(img)}" alt="" class="post-image" onerror="this.style.display='none'">
                        ${extraOverlay}
                    </div>
                `);
                displayedCount++;
            }

            // 再显示 AI 图片
            for (let i = 0; i < aiImages.length && displayedCount < maxShow; i++) {
                const aiImg = aiImages[i];
                const height = gridCols === 2 ? 135 : 90;
                imgItems.push(renderDescImageGridItem(
                    aiImg.description,
                    aiImg.cardColor || '#FFE4EC',
                    aiImg.textColor || '#D4728A',
                    height
                ));
                displayedCount++;
            }

            imagesHtml = `
                <div class="post-images post-images--multi">
                    <div class="post-images-grid" data-cols="${gridCols}">
                        ${imgItems.join('')}
                    </div>
                </div>
            `;
        }
    }

    // 位置卡片
    let locationHtml = '';
    if (item.location) {
        locationHtml = `
            <div class="location-preview">
                <div class="location-icon">
                    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>
                <div class="location-name">${escapeHtml(item.location)}</div>
            </div>
        `;
    }

    // 用户标识
    const userBadge = isUser ? '<span class="moments-user-badge">(我)</span>' : '';

    return `
        <div class="moments-card moment-item"
             data-moment-id="${escapeHtml(item.id || '')}"
             data-author-id="${authorId}"
             data-is-user="${isUser}">

            <!-- 头部:头像+名字+时间 -->
            <div class="moments-card-header">
                <div class="post-avatar">
                    <div class="post-avatar-inner" data-color="${avatarBg}">
                        ${item.authorAvatar
                            ? `<img src="${escapeHtml(item.authorAvatar)}" alt="" class="post-avatar-img">`
                            : escapeHtml(authorName.charAt(0))
                        }
                    </div>
                </div>
                <div class="moments-author-info">
                    <div class="moments-author-name">
                        ${authorName}
                        ${userBadge}
                    </div>
                    <div class="moments-author-time">${timeStr}</div>
                </div>
            </div>

            <!-- 文字内容 -->
            ${content ? `<div class="moments-card-content">${content}</div>` : ''}

            <!-- 图片区域 -->
            ${imagesHtml}

            <!-- 位置 -->
            ${locationHtml}

            <!-- 互动按钮 -->
            <div class="moments-card-actions">
                <button class="moment-like-btn"
                        data-moment-id="${escapeHtml(item.id || '')}"
                        data-author-id="${authorId}"
                        data-is-user="${isUser}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    <span>${likeCount}</span>
                </button>
                <button class="moment-comment-btn"
                        data-moment-id="${escapeHtml(item.id || '')}"
                        data-author-id="${authorId}"
                        data-is-user="${isUser}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <span>${commentCount}</span>
                </button>
                <button class="moment-share-btn"
                        data-moment-id="${escapeHtml(item.id || '')}"
                        data-author-id="${authorId}"
                        data-is-user="${isUser}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    <span>分享</span>
                </button>
            </div>

            <!-- 评论区 -->
            ${commentsHtml ? `<div class="moments-card-comments">${commentsHtml}</div>` : ''}

        </div>
    `;
}

// ─── 演示数据 ────────────────────────────────────────────

const DEMO_MOMENTS = [
    {
        id: 'moment-demo-1',
        authorName: '小美',
        authorId: 'ai-xiaomei',
        authorAvatar: '',
        isUser: false,
        timestamp: Date.now() - 1800000, // 30分钟前
        content: '今天的咖啡拉花好漂亮呀~心情也跟着美起来了 ☕️',
        images: [],
        likes: [{ id: 'l1', name: '小明' }],
        comments: [
            { id: 'c1', author: '小明', content: '真的很好看！在哪里喝的？' },
        ],
    },
    {
        id: 'moment-demo-2',
        authorName: '小明',
        authorId: 'ai-xiaoming',
        authorAvatar: '',
        isUser: false,
        timestamp: Date.now() - 7200000, // 2小时前
        content: '周末去了海边，日落真的很美 🌅',
        images: [
            'https://picsum.photos/seed/sunset1/400/300',
            'https://picsum.photos/seed/sunset2/400/300',
            'https://picsum.photos/seed/sunset3/400/300',
            'https://picsum.photos/seed/sunset4/400/300',
        ],
        aiImages: [
            {
                description: '金色阳光洒在海面上，波光粼粼，远处的灯塔在夕阳中显得格外宁静',
                cardColor: '#FFF3E0',
                textColor: '#FF9800',
            },
            {
                description: '一只海鸥在晚霞中翱翔，剪影映衬着橙红色的天空',
                cardColor: '#E8F2FF',
                textColor: '#4A6FA5',
            },
        ],
        likes: [
            { id: 'l2', name: '小美' },
            { id: 'l3', name: '小蓝' },
        ],
        comments: [],
    },
    {
        id: 'moment-demo-3',
        authorName: '我',
        authorId: 'user_self',
        isUser: true,
        timestamp: Date.now() - 86400000, // 1天前
        content: '新买的小盆栽，希望能养活它们 🌱',
        aiImages: [
            {
                description: '窗台上摆放着几盆可爱的多肉植物，晶莹剔透的叶片在阳光下闪闪发亮',
                cardColor: '#E8F8F0',
                textColor: '#4CAF50',
            },
        ],
        likes: [],
        comments: [
            { id: 'c2', author: '小美', content: '好可爱！' },
            { id: 'c3', author: '小明', content: '加油！' },
            { id: 'c4', author: '小美', replyTo: '小明', content: '哈哈' },
        ],
    },
    {
        id: 'moment-demo-4',
        authorName: '小蓝',
        authorId: 'ai-xiaolan',
        authorAvatar: '',
        isUser: false,
        timestamp: Date.now() - 3600000, // 1小时前
        content: '今天画了一幅画，分享给大家看看~',
        aiImages: [
            {
                description: '一幅梦幻的星空画作，深蓝色的夜空中繁星点点，一条银河横贯天际，画面下方是一片宁静的湖面，倒映着星光',
                cardColor: '#F3E8FF',
                textColor: '#8B5CF6',
            },
        ],
        likes: [
            { id: 'l4', name: '小美' },
        ],
        comments: [],
    },
];

// ─── 用户数据获取 ────────────────────────────────────────

/**
 * 获取当前用户用于动态页面的数据
 * @returns {Promise<{avatar, background, name, userId}>}
 */
async function getMomentsUserData() {
    try {
        const sdk = window.settingsSdk;
        if (!sdk?.users) return null;

        const currentUser = sdk.users.getActive();
        if (!currentUser) return null;

        const chatProfile = currentUser.socialProfiles?.chat || {};

        // 获取头像
        let avatarUrl = '';
        if (chatProfile.avatarCode) {
            try {
                const { getImageSrcByCode } = await import('../../setting/gallery/gallery-db.js');
                avatarUrl = await getImageSrcByCode(chatProfile.avatarCode) || '';
            } catch (_) {}
        }
        if (!avatarUrl && chatProfile.avatar) {
            avatarUrl = chatProfile.avatar;
        }

        // 获取背景
        let backgroundUrl = '';
        if (chatProfile.backgroundCode) {
            try {
                const { getImageSrcByCode } = await import('../../setting/gallery/gallery-db.js');
                backgroundUrl = await getImageSrcByCode(chatProfile.backgroundCode) || '';
            } catch (_) {}
        }
        if (!backgroundUrl && chatProfile.background) {
            backgroundUrl = chatProfile.background;
        }

        return {
            avatar: avatarUrl,
            background: backgroundUrl,
            name: chatProfile.nickname || currentUser.name || '我',
            userId: currentUser.id,
        };
    } catch (_) {
        return null;
    }
}

// ─── 空态 & 加载态 ────────────────────────────────────────

function renderLoadingState() {
    return `
        <div class="moments-loading">
            <svg class="moments-spinner" viewBox="0 0 24 24">
                <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
            </svg>
            <div class="moments-loading-text">加载中...</div>
        </div>
    `;
}

function renderEmptyState() {
    return `
        <div class="moments-empty">
            <div class="moments-empty-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
            </div>
            <div class="moments-empty-text">暂无动态</div>
            <div class="moments-empty-hint">快去和朋友们互动吧</div>
        </div>
    `;
}

// ─── 主渲染函数 ──────────────────────────────────────────

/**
 * 渲染动态页面 (朋友圈)
 *
 * 三种用法:
 *   - renderMomentsPage(app)                              → 全局朋友圈(viewer 是当前 user)
 *   - renderMomentsPage(app, moments, userData)           → 指定数据 + 当前 user
 *   - renderMomentsPage(app, null, null, owner)           → AI 专属朋友圈(viewer 是 owner)
 *     owner = { aiPersonId, mode }
 *
 * v0.31:
 *   - AI 专属朋友圈:用 aiPerson.socialProfiles.chat.* 实时数据填背景图/头像/名字
 *   - 列表中匹配 owner.aiPersonId 的卡片自动套用 owner 头像/名字
 *   - 未传 owner 时维持「我」视角
 *
 * @param {Object} app
 * @param {Array} moments 动态列表(默认演示数据)
 * @param {Object} userData 当前用户数据 { avatar, background, name, userId }
 * @param {Object} owner 看 AI 朋友圈时传入 { aiPersonId, mode }
 */
export function renderMomentsPage(app, moments = null, userData = null, owner = null) {
    const momentList = moments || DEMO_MOMENTS;

    // ★ v0.31 ★ v0.32:用户视角时,如果没传 userData,自动从 SDK 同步读当前 user 社媒数据
    //   注意:avatarCode 走 gallery-db 异步解析,这里只能拿到 avatar URL 字段;
    //   root tab 的交互初始化里再异步补一次(覆盖 avatarCode 的情况)
    if (!userData && !owner) {
        try {
            const sdk = window.settingsSdk;
            if (sdk?.users?.getActive) {
                const activeUser = sdk.users.getActive();
                if (activeUser) {
                    const chatProfile = activeUser.socialProfiles?.chat || {};
                    userData = {
                        avatar: chatProfile.avatar || activeUser.avatar || '',
                        avatarCode: chatProfile.avatarCode || '',
                        background: chatProfile.background || '',
                        backgroundCode: chatProfile.backgroundCode || '',
                        name: chatProfile.nickname || activeUser.name || '我',
                        userId: activeUser.id,
                    };
                }
            }
        } catch (_) {}
    }

    // ★ v0.31 owner 视角:读 aiPerson 实时社媒数据作为 profile-section
    let profileAvatar = userData?.avatar || '';
    let profileBackground = userData?.background || '';
    let profileName = userData?.name || '我';
    let profileAvatarBg = '';

    if (owner && owner.aiPersonId) {
        const meta = getAiMeta(owner.aiPersonId);
        profileAvatar = meta.avatar || '';
        profileBackground = meta.background || '';
        profileName = meta.nickname || owner.aiPersonId;
        profileAvatarBg = meta.avatarBg || '';
    }

    // 更新当前用户的动态显示:isUser 卡片或者 authorId 匹配 owner 的卡片都用当前 profile
    const processedMoments = momentList.map(item => {
        const isOwnerCard = owner && item.authorId === owner.aiPersonId;
        if (item.isUser && userData) {
            return {
                ...item,
                authorName: profileName,
                authorAvatar: profileAvatar,
            };
        }
        if (isOwnerCard) {
            return {
                ...item,
                authorName: profileName,
                authorAvatar: profileAvatar,
            };
        }
        return item;
    });

    // 背景样式:优先用 owner.background,没有就用 userData.background
    const backgroundStyle = profileBackground
        ? `background-image: url("${escapeHtml(profileBackground)}"); background-size: cover; background-position: center;`
        : (profileAvatarBg
            ? `background: ${escapeHtml(profileAvatarBg)};`
            : '');

    const avatarContent = profileAvatar
        ? `<img src="${escapeHtml(profileAvatar)}" alt="" class="profile-avatar-img">`
        : `<div class="profile-avatar-placeholder">
               <svg viewBox="0 0 24 24">
                   <circle cx="12" cy="8" r="4"/><path d="M4 20v-2c0-2.21 3.58-4 8-4s8 1.79 8 4v2"/>
               </svg>
           </div>`;

    const listContent = processedMoments.length > 0
        ? processedMoments.map((item, i) => renderMomentCard(item)).join('')
        : renderEmptyState();

    // ★ v0.31 「发布新动态」按钮:AI 专属页面下转为「查看 TA 的更多动态」入口(给用户视觉提示)
    const postBtnAvatar = profileAvatar
        ? `<img src="${escapeHtml(profileAvatar)}" alt="" class="moments-post-avatar-img">`
        : `<svg viewBox="0 0 24 24">
               <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
           </svg>`;
    const postBtnTitle = owner ? `查看 ${profileName} 的更多动态` : '发布新动态';
    const postBtnHint = owner ? '由 AI 自主发布的日常...' : '分享你的生活点滴...';
    const postBtnAction = owner
        ? 'placeholderSoon'
        : 'chat-post';

    // 渲染页面并注入事件绑定脚本
    // ★ v0.31 AI 朋友圈 detail 页需要自带返回按钮(chat-app 全局隐藏了
    //   framework 的 .app-detail-header,所以 self-manage topbar)
    const topbarHtml = owner
        ? `<div class="moments-topbar">
                <button class="moments-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' aria-label="返回">
                    <svg viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="moments-topbar-title">${escapeHtml(profileName)}的朋友圈</div>
            </div>`
        : '';

    const pageHtml = `
        <div class="moments-page" ${owner ? `data-owner-id="${escapeHtml(owner.aiPersonId)}" data-owner-mode="${escapeHtml(owner.mode || 'calendar')}"` : ''}>

            ${topbarHtml}

            <!-- 韩风博主信息区 -->
            <div class="moments-profile-section" ${backgroundStyle ? `style="${backgroundStyle}"` : ''}>
                <div class="moments-profile-avatar">
                    ${avatarContent}
                </div>
            </div>

            <!-- 发布新动态 / 查看更多按钮 -->
            <button class="moments-post-btn"
                    data-app-action='{"action":"appMethod","appId":"chat","method":"${postBtnAction}"}'>
                <div class="moments-post-avatar">
                    ${postBtnAvatar}
                </div>
                <div class="moments-post-info">
                    <div class="moments-post-title">${escapeHtml(postBtnTitle)}</div>
                    <div class="moments-post-hint">${escapeHtml(postBtnHint)}</div>
                </div>
                <div class="moments-post-arrow">
                    <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                </div>
            </button>

            <!-- 动态列表 -->
            <div class="moments-list" id="momentsList">
                ${listContent}
            </div>

        </div>
    `;

    // 返回 HTML 并注入事件绑定
    return pageHtml + `<script>window.__chatAppMomentsReady && window.__chatAppMomentsReady();</script>`;
}

export default renderMomentsPage;
