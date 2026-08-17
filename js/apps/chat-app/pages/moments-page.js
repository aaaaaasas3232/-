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
import { renderDescImageCard, renderDescImageGridItem } from '../components/desc-image-modal.js';
import { getAiMeta, resolveAiAvatar, resolveUserAvatar } from '../aiMeta.js';
import { loadAllMoments, getFavoritedMomentIds } from '../services/moments-service.js';
import { renderSwipeRow } from '@/src/core/components/swipe-actions.js';

// ─── 工具函数 ───────────────────────────────────────────

// ★ v0.71 头像色统一改用 aiMeta.resolveAiAvatar / resolveUserAvatar
//   之前这里有一份 getAvatarColor(id) 重复实现,删除

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

// ─── 朋友圈滑动操作按钮 ───────────────────────────────────

/**
 * 生成朋友圈卡片的滑动操作按钮（左滑露出）。
 * 编辑/删除按钮通过左滑手势显示，收藏按钮始终可见。
 */
function renderMomentSwipeActions(momentId, authorId, isUser) {
    const mk = (method) => escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method,
        payload: { momentId, authorId, isUser },
    }));
    return `
        <div class="moment-swipe-stack">
            <button type="button" class="swipe-row__action moment-swipe-action--edit"
                data-app-action='${mk('editMoment')}' aria-label="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button type="button" class="swipe-row__action moment-swipe-action--delete"
                data-app-action='${mk('deleteMoment')}' aria-label="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    `;
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

    // ★ v0.71 统一头像来源:
    //   - isUser=true → 用 resolveUserAvatar().bg (用户头像背景)
    //   - isUser=false → 用 resolveAiAvatar(authorId).bg (AI 头像背景)
    const avatarData = isUser
        ? resolveUserAvatar()
        : resolveAiAvatar(item.authorId || '');
    const authorAvatar = item.authorAvatar || avatarData.url;
    const avatarBg = avatarData.bg;

    // 评论区域已移除(用户要求)
    let commentsHtml = '';
    // 原评论区代码保留注释:
    // const comments = item.comments || [];
    // if (comments.length > 0) { ... }

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
    // ★ v0.87 收藏 / 编辑 / 转发 / 删除四件套,用户的和 AI 的动态一视同仁。
    //   之前只有用户自己的卡有删除,AI 的卡什么都不能做。
    const isFavorited = !!item._favorited;
    const momentId = escapeHtml(item.id || '');
    const dataAttrs = `data-moment-id="${momentId}" data-author-id="${authorId}" data-is-user="${isUser}"`;

    // 卡片内容（除操作按钮外）
    const cardContent = `
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

        <!-- 收藏按钮（始终可见） -->
        <div class="moments-card-actions moments-card-actions--fixed">
            <button class="moment-like-btn${isFavorited ? ' liked' : ''}"
                    data-moment-id="${momentId}"
                    data-author-id="${authorId}"
                    data-is-user="${isUser}"
                    aria-pressed="${isFavorited}"
                    title="${isFavorited ? '取消收藏' : '收藏'}">
                <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            </button>
            <button class="moment-share-btn"
                    data-moment-id="${momentId}"
                    data-author-id="${authorId}"
                    data-is-user="${isUser}"
                    title="分享">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
            </button>
        </div>
    `;

    // 左滑操作按钮（编辑、删除）
    const swipeActionsHtml = renderMomentSwipeActions(momentId, authorId, isUser);

    // ★ v0.88 朋友圈卡片改为左滑显示编辑/删除按钮，更符合操作习惯
    return renderSwipeRow({
        actionsHtml: swipeActionsHtml,
        contentHtml: cardContent,
        extraClass: 'moments-swipe-row',
        dataAttrs,
    });
}

// ─── 演示数据 ────────────────────────────────────────────
// ★ v0.80 移除 DEMO_MOMENTS 占位朋友圈 — 朋友圈数据全部从 SDK / chatMoments 读,
//   没数据就展示空状态(「还没有动态」),不再展示「小美/小明/小蓝」的示例动态。

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
 * 合并调用方传入的动态 + 用户自己发的 + 所有 AI 发的，按时间倒序。
 *
 * ★ v0.87 之前这里只合并了用户自己的动态，AI 用 [发朋友圈:] 发的内容
 * 只能在「聊天设置 → AI 朋友圈概要」弹窗里看到，主 feed 里根本不出现。
 */
function mergeMoments(extraMoments) {
    const seen = new Set();
    const out = [];
    for (const m of [...loadAllMoments(), ...(extraMoments || [])]) {
        if (!m || !m.id) continue;
        const key = String(m.id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
    }
    return out.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
}

/**
 * 渲染动态页面 (朋友圈)
 *
 * 三种用法:
 *   - renderMomentsPage(app)                              → 全局朋友圈(viewer 是当前 user)
 *   - renderMomentsPage(app, moments, userData)           → 指定数据 + 当前 user
 *   - renderMomentsPage(app, null, null, owner)           → AI 专属朋友圈(viewer 是 owner)
 *     owner = { aiPersonId, mode }
 *
 * @param {Object} app
 * @param {Array} moments 动态列表(默认演示数据+用户发布)
 * @param {Object} userData 当前用户数据 { avatar, background, name, userId }
 * @param {Object} owner 看 AI 朋友圈时传入 { aiPersonId, mode }
 */
export function renderMomentsPage(app, moments = null, userData = null, owner = null) {
    // ★ v0.80 移除 demo fallback — moments 直接使用调用方传入的列表(SDK 提供),没传就是空
    const demoMoments = moments || [];
    const momentList = owner ? demoMoments : mergeMoments(demoMoments);

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
    // ★ v0.71 统一头像(背景)来源:owner → resolveAiAvatar,非 owner → resolveUserAvatar
    const userAv = resolveUserAvatar();
    let profileAvatar = userAv.url || userData?.avatar || '';
    let profileBackground = userData?.background || '';
    let profileName = userData?.name || '我';
    let profileAvatarBg = userAv.bg;

    if (owner && owner.aiPersonId) {
        const aiAv = resolveAiAvatar(owner.aiPersonId);
        profileAvatar = aiAv.url || userData?.avatar || '';
        profileBackground = aiAv.url ? '' : (userData?.background || '');
        profileName = getAiMeta(owner.aiPersonId).nickname || owner.aiPersonId;
        profileAvatarBg = aiAv.bg;
    }

    // 更新当前用户的动态显示:isUser 卡片或者 authorId 匹配 owner 的卡片都用当前 profile
    // 顺便把收藏状态回填到每张卡（之前只在点击时加 CSS class，一重渲染就丢了）
    const favoritedIds = getFavoritedMomentIds();
    const processedMoments = momentList.map(item => {
        const _favorited = favoritedIds.has(String(item.id));
        const isOwnerCard = owner && item.authorId === owner.aiPersonId;
        if ((item.isUser && userData) || isOwnerCard) {
            return {
                ...item,
                _favorited,
                authorName: profileName,
                authorAvatar: profileAvatar,
            };
        }
        return { ...item, _favorited };
    });

    // 背景样式:优先用 owner.background,没有就用渐变蓝色背景
    // ★ 修复:不使用用户头像背景色(#F4A6CD玫红色),改为固定蓝色渐变
    const backgroundStyle = profileBackground
        ? `background-image: url("${escapeHtml(profileBackground)}"); background-size: cover; background-position: center;`
        : `background: linear-gradient(135deg, #E8F2FF, #F0F5FF);`;

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

    // 渲染页面并注入事件绑定脚本
    // ★ v0.31+ AI 朋友圈 detail 页:chat-app 全局隐藏了 framework 的 .app-detail-header,
    //   所以这里把返回按钮直接放进 .moments-profile-section 内部(absolute 定位覆盖在
    //   蓝色渐变背景之上),不再渲染独立的白条 topbar,也不再显示「xx 的朋友圈」标题。
    const backBtnHtml = owner
        ? `<button class="moments-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' aria-label="返回">
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>`
        : '';

    // ★ 修复:发布朋友圈按钮使用 detail action 导航到 chat-post 页面
    const postBtnNavAction = owner
        ? null  // AI 朋友圈不显示发布按钮
        : '{"action":"detail","appId":"chat","pageId":"chat-post"}';

    const pageHtml = `
        <div class="moments-page" ${owner ? `data-owner-id="${escapeHtml(owner.aiPersonId)}" data-owner-mode="${escapeHtml(owner.mode || 'calendar')}"` : ''}>

            <!-- 韩风博主信息区(返回按钮 absolute 定位覆盖在背景之上) -->
            <div class="moments-profile-section" ${backgroundStyle ? `style="${backgroundStyle}"` : ''}>
                ${backBtnHtml}
                <div class="moments-profile-avatar">
                    ${avatarContent}
                </div>
            </div>

            <!-- 发布新动态 / 查看更多按钮 -->
            ${postBtnNavAction ? `
            <button class="moments-post-btn"
                    data-app-action='${postBtnNavAction}'>
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
            ` : ''}

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
