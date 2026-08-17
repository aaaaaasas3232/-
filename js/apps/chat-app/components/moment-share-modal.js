/**
 * 朋友圈分享弹窗组件 (AcModal 风格)
 * 
 * 用户点击分享按钮后，弹出选择联系人/群组的弹窗，
 * 选择后发送分享卡片到对应私聊或群聊
 */

import { AcModal } from './ac-modal.js';

// ─── Vue 组件定义 ─────────────────────────────────────────

const MomentShareModal = {
    name: 'MomentShareModal',
    components: { AcModal },
    props: {
        shareData: { type: Object, default: () => ({}) },
    },
    emits: ['close'],
    data() {
        return {
            searchKeyword: '',
            contacts: [],
            loaded: false,
            selectedContact: null,
            _sharing: false,
            _canceled: false,
        };
    },
    created() {
        this.loadContacts();
    },
    computed: {
        filteredContacts() {
            if (!this.searchKeyword) return this.contacts;
            const kw = this.searchKeyword.toLowerCase();
            return this.contacts.filter(c => c.name.toLowerCase().includes(kw));
        },
    },
    methods: {
        loadContacts() {
            const contacts = [];
            const sdk = window.settingsSdk;
            const defaultUser = sdk?.users?.getActive?.();
            
            try {
                // 获取私聊列表
                if (sdk?.chatFriends?.list) {
                    const friendList = sdk.chatFriends.list(defaultUser, 'calendar') || [];
                    friendList.forEach(entry => {
                        const ai = sdk.aiPersons?.get?.(entry.aiPersonId);
                        const chatProfile = ai?.socialProfiles?.chat || {};
                        const name = entry.remark || chatProfile.nickname || ai?.name || entry.aiPersonId;
                        contacts.push({
                            id: entry.aiPersonId,
                            name: name,
                            avatar: ai?.avatar || entry.avatar || '',
                            avatarBg: ai?.avatarBg || entry.avatarBg || '#A29BFE',
                            type: 'private',
                            isAi: true,
                        });
                    });
                }
                
                // 获取群聊列表
                if (sdk?.chatGroups?.list) {
                    const groupList = sdk.chatGroups.list(defaultUser, 'calendar') || [];
                    groupList.forEach(entry => {
                        // ★ 字段名对齐 chatGroups.list 返回结构:members 是数组，
                        //   里面只有 AI，人数要 +1 把用户本人算进去
                        const memberCount = (Array.isArray(entry.members) ? entry.members.length : 0) + 1;
                        contacts.push({
                            id: entry.groupId || entry.id,
                            name: entry.name || '群聊',
                            avatar: entry.avatar || '',
                            avatarBg: entry.avatarBg || '#6C5CE7',
                            type: 'group',
                            isAi: false,
                            memberCount,
                        });
                    });
                }
                
                console.log('[MomentShareModal] Loaded contacts:', contacts.length);
            } catch (e) {
                console.warn('[MomentShareModal] loadContacts failed:', e);
            }
            
            this.contacts = contacts;
            this.loaded = true;
        },
        
        selectContact(contact) {
            this.selectedContact = contact;
        },
        
        async doShare() {
            if (this._sharing || this._canceled) return;
            if (!this.selectedContact) return;
            this._sharing = true;
            
            const contact = this.selectedContact;
            const shareData = this.shareData;
            console.log('[MomentShareModal] doShare START, id=', contact.id);
            
            // 1. 立即关闭弹窗 (Vue 组件本轮代码执行完后才被销毁)
            this._canceled = true;
            try {
                window.__appNavigation?.closeModal?.();
            } catch (_) {}
            
            // 2. 拿到所需 snapshot 后立即异步发送 - 不依赖 Vue 实例
            const sdk = window.settingsSdk;
            if (!sdk) {
                console.warn('[MomentShareModal] settingsSdk not available');
                return;
            }
            const defaultUser = sdk.users?.getActive?.();
            const mode = 'calendar';
            
            const authorName = shareData?.authorName || '匿名';
            const content = shareData?.content || '';
            const momentId = shareData?.momentId || '';
            const aiImages = Array.isArray(shareData?.aiImages) ? shareData.aiImages : [];
            
            const shareMsg = {
                id: `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'share-card',
                shareType: 'moment',
                momentId: String(momentId || ''),
                authorName: String(authorName || ''),
                content: String(content || ''),
                aiImages: aiImages.map(x => String(x || '')),
                sender: 'user',
                senderId: defaultUser?.id || '',
                senderName: '我',
                timestamp: Date.now(),
                status: 'sent',
            };
            
            // 防御性 deep clone,剥离 Vue 响应式 Proxy
            let safeMsg;
            try {
                safeMsg = JSON.parse(JSON.stringify(shareMsg));
            } catch (e) {
                safeMsg = shareMsg;
            }
            
            // 3. 异步发送
            try {
                if (contact.type === 'private') {
                    await sdk.chatMessages.add(defaultUser, contact.id, mode, safeMsg);
                    if (sdk.chatFriends?.updateLastMessage) {
                        await sdk.chatFriends.updateLastMessage(sdk, defaultUser, contact.id, mode, {
                            content: `[朋友圈分享] ${authorName}`,
                            timestamp: Date.now(),
                            senderName: '我',
                            type: 'share-card',
                        });
                    }
                    // ★ 派发事件,让聊天页/消息列表立即刷新(否则需要手动刷新页面才看到卡片)
                    try {
                        window.dispatchEvent(new CustomEvent('chat:message-sent', {
                            detail: {
                                aiPersonId: contact.id,
                                mode,
                                message: safeMsg,
                            },
                        }));
                    } catch (_) {}
                } else if (contact.type === 'group') {
                    await sdk.chatMessages.add(defaultUser, contact.id, mode, {
                        ...safeMsg,
                        conversationType: 'group',
                    });
                    if (sdk.chatGroups?.updateLastMessage) {
                        await sdk.chatGroups.updateLastMessage(sdk, defaultUser, contact.id, mode, {
                            content: `[朋友圈分享] ${authorName}`,
                            timestamp: Date.now(),
                            senderName: '我',
                            type: 'share-card',
                        });
                    }
                    // ★ 派发事件,让群聊页/消息列表立即刷新
                    try {
                        window.dispatchEvent(new CustomEvent('chat:message-sent', {
                            detail: {
                                groupId: contact.id,
                                mode,
                                message: { ...safeMsg, conversationType: 'group' },
                            },
                        }));
                    } catch (_) {}
                }

                // ★ 兜底:显式触发整页重画,确保即使事件没人监听也能看到新卡片
                try {
                    if (window.__appRendererBridge?.syncNow) {
                        window.__appRendererBridge.syncNow({ force: true });
                    } else if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) {}

                console.log('[MomentShareModal] share sent to', contact.id);
                window.__phoneIsland?.notify?.('success', '已分享到聊天', contact.name);
            } catch (e) {
                console.error('[MomentShareModal] send failed:', e);
                window.__phoneIsland?.notify?.('error', '分享失败', e.message || '请重试');
            }
        },
        
        doCancel() {
            if (this._canceled) return;
            this._canceled = true;
            try {
                window.__appNavigation?.closeModal?.();
            } catch (err) {
                console.error('[MomentShareModal] closeModal failed:', err);
            }
        },
    },
    template: `
        <AcModal
            class="moment-share-modal"
            title="分享到聊天"
            :show-close="true"
            :close-on-backdrop="true"
            max-width="340px"
            @close="doCancel"
        >
            <div class="share-search-wrap">
                <input 
                    type="text" 
                    v-model="searchKeyword"
                    placeholder="搜索联系人或群组..."
                    class="share-search-input"
                >
            </div>
            
            <div class="share-contacts-body">
                <div 
                    v-for="contact in filteredContacts" 
                    :key="contact.id" 
                    class="share-contact-item"
                    :class="{ 'share-contact-item--selected': selectedContact?.id === contact.id }"
                    @click="selectContact(contact)"
                >
                    <div class="share-contact-avatar" :style="{ background: 'linear-gradient(135deg, ' + contact.avatarBg + ', ' + contact.avatarBg + ')'}">
                        <img v-if="contact.avatar" :src="contact.avatar" class="share-contact-avatar-img">
                        <span v-else>{{ contact.name.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="share-contact-info">
                        <div class="share-contact-name">{{ contact.name }}</div>
                        <div class="share-contact-subtitle">
                            {{ contact.type === 'group' ? (contact.memberCount + ' 位成员') : (contact.isAi ? 'AI 助手' : '联系人') }}
                        </div>
                    </div>
                    <div v-if="selectedContact?.id === contact.id" class="share-contact-check">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                    </div>
                </div>
                
                <div v-if="!loaded" class="share-list-empty">
                    加载中...
                </div>
                <div v-else-if="filteredContacts.length === 0" class="share-list-empty">
                    暂无聊天记录
                </div>
            </div>
            
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="doCancel">取消</button>
                <button 
                    type="button" 
                    class="ac-btn ac-btn-primary" 
                    :disabled="!selectedContact"
                    @click="doShare"
                >发送</button>
            </template>
        </AcModal>
    `,
};

// ─── 导出组件 ─────────────────────────────────────────

export { MomentShareModal };

// ─── 弹窗打开函数 ─────────────────────────────────────────

/**
 * 打开分享弹窗
 * @param {Object} shareData - 分享数据
 * @param {Function} onSelect - 选择联系人后的回调 (可选,组件内部已直接完成发送)
 */
export function openMomentShareModal(shareData, onSelect) {
    if (window.__chatAppBridge?.chatModalManager) {
        window.__chatAppBridge.chatModalManager._dispatch(MomentShareModal, {
            shareData: shareData,
        });
    } else if (window.chatModalManager) {
        window.chatModalManager._dispatch(MomentShareModal, {
            shareData: shareData,
        });
    } else {
        console.warn('[MomentShareModal] chatModalManager not found');
    }
}

// ─── 挂载到全局 ─────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.__MomentShareModal = {
        open: openMomentShareModal,
    };
}

export default {
    open: openMomentShareModal,
    MomentShareModal,
};
