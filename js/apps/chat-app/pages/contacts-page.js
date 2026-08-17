/**
 * chat-app / 通讯录页面
 *
 * 来源:旧版 ChatApp.prototype.renderContactsPage + renderContactItem
 * 样式:蓝粉渐变背景 + 韩风卡片设计
 *
 * 样式规范:
 *   - 所有样式写到 css/apps/chat/_chat-contacts.css
 *   - JS 只放动态数据属性(data-*)和无法预知的动态颜色
 *   - 不允许 style="" 内联非颜色类的样式
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getChatRecordMode } from '../chat-mode.js';
import { ensureSdkReadyThenRefresh } from './messages-page.js';
import { resolveAiAvatar, resolveContactDisplay } from '../aiMeta.js';
import { SNAIL_EMPTY_SVG } from '../snail-icon.js';

// 默认联系人数据(只在 SDK 完全空时兜底)
// ★ v0.80:移除占位联系人(示例角色) — 真实联系人全部走 SDK,没数据就空。
const DEMO_CONTACTS = [];

// ★ v0.80:移除演示用的好友申请数据 — 真实好友申请全部走 SDK。
const DEMO_PENDING_REQUESTS = [];

// ★ v0.71 头像背景色已统一到 aiMeta.resolveAiAvatar,删除本地 getAvatarColor 重复实现

function renderCategoryLabel(type) {
    // ★ 已删除:通讯录页面不再显示「主角色/配角/NPC」分类标签
    //   理由:联系人只有"主角色"一类,不需要标签。
    //   保留这个函数以兼容旧调用,直接返回空字符串。
    void type;
    return '';
}

function renderContactItem(contact, index) {
    // ★ v0.71 头像背景:aiMeta.resolveAiAvatar (社媒头像背景) → 缺失用 aiMeta 默认
    const bgColor = (contact.avatarBg || resolveAiAvatar(contact.id).bg);
    const avatarContent = contact.avatar
        ? `<img src="${escapeHtml(contact.avatar)}" alt="" class="contact-avatar-img">`
        : escapeHtml((contact.name || '?').charAt(0));
    // ★ v0.27 contact-item 点击进入私聊副本
    //   pageId = private-<aiPersonId>-<mode>,因为同 AI 可能在日历+故事下各有副本
    const detailAction = `data-app-action='${escapeHtml(JSON.stringify({
        action: 'detail',
        appId: 'chat',
        pageId: `private-${contact.aiPersonId || contact.id}-${contact.recordMode || 'calendar'}`,
    }))}'`;
    return `
        <div class="contact-item" data-ai-id="${escapeHtml(contact.id)}" ${detailAction}>
            <div class="contact-avatar" data-color="${bgColor}">
                ${avatarContent}
            </div>
            <div class="contact-info">
                <div class="contact-name">
                    ${escapeHtml(contact.name)}
                    ${contact.remark ? `<span class="contact-remark">(${escapeHtml(contact.remark)})</span>` : ''}
                </div>
                <div class="contact-signature">${escapeHtml((contact.personality || '暂无个性签名').substring(0, 50))}</div>
            </div>
            <div class="contact-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                </svg>
            </div>
        </div>
    `;
}

function renderFriendRequestEntry(requests) {
    if (!requests || requests.length === 0) return '';

    const count = requests.length;
    const firstReq = requests[0];
    const desc = count === 1
        ? `${escapeHtml(firstReq.aiName)}请求恢复聊天`
        : `${escapeHtml(firstReq.aiName)}等${count}人请求恢复聊天`;

    return `
        <div class="friend-request-entry">
            <div class="friend-request-avatar-stack">
                ${requests.slice(0, 3).map((req) => {
                    // ★ v0.71 好友请求头像:aiMeta.resolveAiAvatar 背景
                    const color = resolveAiAvatar(req.aiId || req.id).bg;
                    return `
                        <div class="friend-request-avatar">
                            ${req.aiAvatar
                                ? `<img src="${escapeHtml(req.aiAvatar)}" alt="" />`
                                : `<div class="friend-request-avatar-inner" data-color="${color}">${escapeHtml(req.aiName.charAt(0))}</div>`
                            }
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="friend-request-info">
                <div class="friend-request-title">好友申请</div>
                <div class="friend-request-desc">${desc}</div>
            </div>
            <div class="friend-request-action">
                <div class="friend-request-badge">${count}</div>
                <svg class="friend-request-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                </svg>
            </div>
        </div>
    `;
}

function renderEmptyState() {
    return `
        <div class="contacts-empty">
            <div class="contacts-empty-icon">${SNAIL_EMPTY_SVG}</div>
            <div class="contacts-empty-title">暂无联系人</div>
            <div class="contacts-empty-sub">在系统配置中添加AI角色</div>
        </div>
    `;
}

/**
 * v0.27 从当前默认 user 人设的 socialProfiles.chat.calendarContacts / storyContacts
 * 读取当前 mode 下的所有联系人 entry（不走 chatContacts 那张表）。
 */
function loadContactsForMode(mode) {
    const sdk = window.settingsSdk;
    const out = { contacts: [], isEmptyWorld: false, isEmptySdk: false };

    if (!sdk) {
        out.isEmptySdk = true;
        return out;
    }

    const defaultUser = sdk.defaultUserCard?.getDefault?.();
    const currentUser = defaultUser || sdk.users.getActive();
    if (!currentUser?.boundWorldId) {
        out.isEmptyWorld = true;
        return out;
    }

    const list = (typeof sdk.chatFriends?.list === 'function')
        ? sdk.chatFriends.list(currentUser, mode)
        : [];

    out.contacts = list.map((c) => {
        // ★ v0.81 使用 resolveContactDisplay 统一获取 AI 的显示信息（包括签名）
        const display = resolveContactDisplay(c, c.aiPersonId);
        return {
            id: c.aiPersonId,                // ★ v0.27:pageId 用 aiPersonId 而非副本 id
            aiPersonId: c.aiPersonId,
            recordMode: mode,
            type: 'main',
            name: display.nickname,            // 优先备注 > 社媒名 > 副本快照
            remark: c.remark || (mode === 'story' ? '故事模式' : ''),
            personality: display.signature || '', // 网络签名显示在个性签名位置
            avatar: display.avatar,
            avatarBg: display.avatarBg,
            status: 'online',
        };
    });

    if (out.contacts.length === 0) out.contacts = DEMO_CONTACTS;
    return out;
}

/**
 * 按关键词过滤联系人(大小写不敏感,匹配 name / remark / aiPersonId)
 */
function filterContactsByKeyword(contacts, keyword) {
    if (!keyword) return contacts;
    const kw = String(keyword).toLowerCase().trim();
    if (!kw) return contacts;
    return contacts.filter((c) => {
        const hay = [c.name, c.remark, c.aiPersonId, c.id]
            .filter(Boolean)
            .map((s) => String(s).toLowerCase())
            .join(' ');
        return hay.includes(kw);
    });
}

/**
 * 渲染通讯录空结果(被搜索关键词过滤后没有命中)
 */
function renderNoSearchResult(keyword) {
    return `
        <div class="contacts-empty contacts-empty--search">
            <div class="contacts-empty-icon">${SNAIL_EMPTY_SVG}</div>
            <div class="contacts-empty-title">未找到匹配的联系人</div>
            <div class="contacts-empty-sub">没有匹配「${escapeHtml(keyword)}」的联系人</div>
        </div>
    `;
}

export function renderContactsPage(app, options = {}) {
    const mode = getChatRecordMode();
    const { contacts: rawContacts, isEmptyWorld, isEmptySdk } = loadContactsForMode(mode);
    // ★ 顶栏搜索框关键词:framework 把 input 事件转发到 chat-app 的 onTopbarSearchInput,
    //   方法把 keyword 写到 app.state.chat.contacts.searchKeyword,这里读取并过滤
    const searchKeyword = (app?.state?.chat?.contacts?.searchKeyword || '').trim();

    if (isEmptySdk) ensureSdkReadyThenRefresh(app);

    let bodyHtml;
    if (isEmptySdk) {
        // ★ v0.23 SDK 还没 bootstrap,显示通用空状态 + 等 ready 后自动重画
        bodyHtml = renderEmptyState();
    } else if (isEmptyWorld) {
        bodyHtml = `
            <div class="contacts-empty">
                <div class="contacts-empty-icon">${SNAIL_EMPTY_SVG}</div>
                <div class="contacts-empty-title">默认用户卡未绑定世界观</div>
                <div class="contacts-empty-sub">请先去「设置 → 人设」给默认用户卡绑定世界观，通讯录才会显示可添加的 AI 人设</div>
            </div>
        `;
    } else {
        // ★ 已删除:通讯录不再显示「主角色」分类标签,直接渲染联系人列表
        const filtered = filterContactsByKeyword(rawContacts, searchKeyword);
        bodyHtml = filtered.length > 0
            ? filtered.map((c) => renderContactItem(c)).join('')
            : renderNoSearchResult(searchKeyword || rawContacts[0]?.name || '');
    }

    return `
        <div class="chat-contacts" data-chat-mode="${escapeHtml(mode)}">
            <div class="contacts-container">
                ${bodyHtml}
            </div>
        </div>
    `;
}

export default renderContactsPage;
