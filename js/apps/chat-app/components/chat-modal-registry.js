/**
 * chat-app / 弹窗管理器
 *
 * 统一管理 chat-app 的弹窗，提供与 framework appModal 兼容的接口。
 * 使用 Vue 组件模式渲染弹窗，由 framework 的 app-modal-layer 统一展示。
 *
 * 用法：
 *   import { chatModalManager } from './chat-modal-registry.js';
 *
 *   // 打开地点卡片
 *   chatModalManager.openLocationCard({ name: '天安门', address: '北京市东城区' });
 *
 *   // 打开图片描述
 *   chatModalManager.openDescImage({ description: '...', cardColor: '#FFE4EC' });
 *
 *   // 打开发送图片弹窗
 *   chatModalManager.openDescImageSend();
 */

import {
    CHAT_MODAL_COMPONENTS,
    LocationCardModal,
    LocationPickerModal,
    DescImageModal,
    DescImageSendModal,
    VoiceRecordModal,
    ModeSelectorModal,
    AiRemarkModal,
    ChatBackgroundModal,
    ForwardTargetModal,
    ChatRecordDetailModal,
    StoryArchiveSaveModal,
    StoryArchiveRestoreConfirmModal,
    StoryArchiveDeleteConfirmModal,
    MessageEditModal,  // ★ v0.43 消息编辑弹窗
    MessageDeleteConfirmModal,  // ★ v0.44 消息删除确认弹窗
    RedpacketSendModal,  // ★ v0.45 红包发送弹窗
    TransferSendModal,  // ★ v0.45 转账发送弹窗
    RedpacketReceiveModal,  // ★ v0.67 红包领取确认弹窗
    TransferReceiveModal,  // ★ v0.67 转账收款确认弹窗
    CallSummaryModal,  // ★ v0.67 通话结束概要弹窗
    IncomingCallModal,  // ★ v0.67 AI 来电弹窗
    EditReplyPromptModal, // ★ v0.50 回复提示词编辑弹窗
    SystemPromptEditModal, // ★ v0.57 系统 prompt 编辑弹窗
    AppPromptPreviewModal, // ★ v0.61.8 App Prompt 预览编辑器
    ContextLengthModal, // ★ v0.61.8.11 上下文长度设置弹窗
    RollingCapacityModal, // ★ v0.63 滚动摘要容量设置弹窗
    ApiCallModal, // ★ v0.62.1 API 调用设置弹窗
} from './chat-modal-components.js';

import { DescImageDetailModal } from './desc-image-modal.js';
import { SummaryRangeModal } from './summary-range-modal.js'; // ★ v0.61.3 概要范围选择弹窗
import { SummaryEditModal } from './summary-edit-modal.js';   // ★ v0.61.3 概要编辑/确认弹窗

/**
 * 颜色预设
 */
export const LOCATION_PRESETS = {
    default: {
        bgGradient: 'linear-gradient(135deg, #E8F2FF, #D6E4FF)',
        iconColor: '#4A6FA5',
        borderColor: '#4A6FA5',
    },
};

export const DESC_IMAGE_PRESETS = {
    pink: { cardColor: '#FFE4EC', textColor: '#D4728A', borderColor: '#C0607A', name: '淡粉' },
    blue: { cardColor: '#E8F2FF', textColor: '#4A6FA5', borderColor: '#3A5F95', name: '淡蓝' },
    green: { cardColor: '#E8F8F0', textColor: '#4CAF50', borderColor: '#3A8F40', name: '淡绿' },
    purple: { cardColor: '#F3E8FF', textColor: '#8B5CF6', borderColor: '#7B4CD6', name: '淡紫' },
    yellow: { cardColor: '#FFF8E1', textColor: '#FF9800', borderColor: '#DF7800', name: '淡黄' },
    orange: { cardColor: '#FFF3E0', textColor: '#FF5722', borderColor: '#DF4712', name: '淡橙' },
};

/**
 * 发送图片弹窗颜色预设
 */
export const SEND_IMAGE_COLORS = [
    { name: '淡粉', cardColor: '#FFE4EC', textColor: '#D4728A' },
    { name: '淡蓝', cardColor: '#E8F2FF', textColor: '#4A6FA5' },
    { name: '淡绿', cardColor: '#E8F8F0', textColor: '#4CAF50' },
    { name: '淡紫', cardColor: '#F3E8FF', textColor: '#8B5CF6' },
    { name: '淡黄', cardColor: '#FFF8E1', textColor: '#FF9800' },
];

/**
 * 弹窗管理器
 *
 * 通过 dispatchModalAction 发送 action，由 framework 处理。
 * framework 的 appModal 会被设置为 { visible: true, type: 'chat-component', component: {...}, props: {...} }
 */
class ChatModalManager {
    /**
     * 派发弹窗 action 到 framework
     * @param {Object} component - Vue 组件定义对象
     * @param {Object} props - 组件 props
     * @param {Object} callbacks - 事件回调映射
     */
    _dispatch(component, props, callbacks = {}) {
        const action = {
            action: 'modal',
            modalType: 'chat-component',
            component: component, // 直接传组件对象
            props: props,
            callbacks: callbacks,
        };

        document.dispatchEvent(new CustomEvent('app:page-action', {
            detail: action,
            bubbles: true,
        }));
    }

    /**
     * 打开地点卡片弹窗
     * @param {Object} options
     * @param {string} options.name - 地点名称
     * @param {string} options.address - 详细地址
     * @param {Object} options.style - 样式配置（可选）
     * @param {Function} options.onSatisfied - 满意按钮回调
     * @param {Function} options.onShare - 分享按钮回调
     */
    openLocationCard({ name, address, style = {}, onSatisfied, onShare }) {
        const mergedStyle = {
            ...LOCATION_PRESETS.default,
            ...style,
        };

        this._dispatch(LocationCardModal, {
            name: name || '位置',
            address: address || '',
            ...mergedStyle,
        }, {
            onSatisfied: onSatisfied || (() => {
                window.__phoneIsland?.notify?.('success', '已确认', '位置已确认');
            }),
            onShare: onShare || (() => {
                if (navigator.share) {
                    navigator.share({ title: name, text: address });
                } else {
                    window.__phoneIsland?.notify?.('info', '分享功能', '复制链接即将开放');
                }
            }),
        });
    }

    /**
     * 打开图片描述弹窗
     * @param {Object} options
     * @param {string} options.description - 图片描述
     * @param {string} options.cardColor - 卡片背景色
     * @param {string} options.textColor - 文字颜色
     * @param {string} options.borderColor - 边框颜色
     * @param {Function} options.onClose - 关闭回调
     * @param {Function} options.onFavorite - 收藏回调
     * @param {Function} options.onShare - 分享回调
     */
    openDescImage({ description, cardColor, textColor, borderColor, onClose, onFavorite, onShare }) {
        this._dispatch(DescImageModal, {
            description: description || '',
            cardColor: cardColor || '#FFE4EC',
            textColor: textColor || '#D4728A',
            borderColor: borderColor || '#C0607A',
        }, {
            onClose: onClose || (() => {}),
            onFavorite: onFavorite || (() => {
                window.__phoneIsland?.notify?.('success', '已收藏', '图片已添加到收藏');
            }),
            onShare: onShare || (() => {
                if (navigator.share) {
                    navigator.share({ title: '图片描述', text: description });
                } else {
                    window.__phoneIsland?.notify?.('info', '分享功能', '复制链接即将开放');
                }
            }),
        });
    }

    /**
     * 打开发送图片弹窗
     * @param {Object} options
     * @param {Function} options.onConfirm - 确认发送回调，参数为 { description, cardColor, textColor }
     * @param {Function} options.onCancel - 取消回调
     */
    openDescImageSend({ onConfirm, onCancel }) {
        this._dispatch(DescImageSendModal, {
            title: '发送模拟图片',
            hint: '描述你想发送的图片内容',
            placeholder: '例如：阳光洒在窗台上，一只橘猫正在午睡...',
            colors: SEND_IMAGE_COLORS,
        }, {
            onConfirm: onConfirm || ((result) => {
                window.__phoneIsland?.notify?.('success', '图片已发送', `「${result.description.substring(0, 20)}...」`);
            }),
            onCancel: onCancel || (() => {}),
        });
    }

    /**
     * 打开语音录制弹窗
     * @param {Object} options
     * @param {Function} options.onConfirm - 确认发送回调，参数为 { content, duration }
     * @param {Function} options.onCancel - 取消回调
     */
    openVoiceRecord({ onConfirm, onCancel }) {
        this._dispatch(VoiceRecordModal, {
            title: '语音消息',
        }, {
            onConfirm: onConfirm || ((result) => {
                window.__phoneIsland?.notify?.('success', '语音已发送', `「${result.content.substring(0, 20)}${result.content.length > 20 ? '...' : ''}」(${result.duration}秒)`);
            }),
            onCancel: onCancel || (() => {}),
        });
    }

    /**
     * ★ v0.45 打开红包发送弹窗
     * @param {Object} options
     * @param {Function} options.onConfirm - 确认发送回调，参数为 { message, amount, style }
     * @param {Function} options.onCancel - 取消回调
     */
    openRedpacketSend({ onConfirm, onCancel }) {
        this._dispatch(RedpacketSendModal, {
            title: '发红包',
        }, {
            onConfirm: onConfirm || ((result) => {
                window.__phoneIsland?.notify?.('success', '红包已发送', `¥${result.amount} - ${result.message}`);
            }),
            onCancel: onCancel || (() => {}),
        });
    }

    /**
     * ★ v0.45 打开转账发送弹窗
     * @param {Object} options
     * @param {Function} options.onConfirm - 确认发送回调，参数为 { amount, note }
     * @param {Function} options.onCancel - 取消回调
     */
    openTransferSend({ onConfirm, onCancel }) {
        this._dispatch(TransferSendModal, {
            title: '转账',
        }, {
            onConfirm: onConfirm || ((result) => {
                window.__phoneIsland?.notify?.('success', '转账已发送', `¥${result.amount} - ${result.note}`);
            }),
            onCancel: onCancel || (() => {}),
        });
    }

    /**
     * ★ v0.45 打开地点选择弹窗（发送位置）
     *   - 从当前用户绑定的世界场所列表中选择
     *   - 选择后回调 { id, name, address, position }
     *
     * @param {Object} options
     * @param {Function} options.onSelect - 选中地点回调，参数为 { id, name, address, position }
     * @param {Function} options.onClose - 关闭回调
     */
    openLocationPicker({ onSelect, onClose }) {
        this._dispatch(LocationPickerModal, {}, {
            onSelect: (payload) => {
                try {
                    onSelect?.(payload);
                } catch (err) {
                    console.error('[chat-modal] location-picker onSelect failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] location-picker onClose failed', err); }
            },
        });
    }

    /**
     * 打开聊天记录模式选择弹窗（添加新朋友时）
     * @param {Object} options
     * @param {string} options.name - 当前联系人/AI 名称(显示用)
     * @param {Function} options.onSelect - 选中模式回调,参数为 'calendar' | 'story'
     * @param {Function} options.onClose - 关闭/取消回调
     */
    openRecordModeSelector({ name, addedInMode, addedInOtherMode, onSelect, onClose } = {}) {
        this._dispatch(ModeSelectorModal, {
            name: name || '',
            addedInMode: !!addedInMode,
        }, {
            onSelect: (mode) => {
                try {
                    onSelect?.(mode);
                } catch (err) {
                    console.error('[chat-modal] mode-selector onSelect failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] mode-selector onClose failed', err); }
            },
        });
    }

    /**
     * 打开 AI 备注编辑弹窗
     * @param {Object} options
     * @param {string} options.name - 当前联系人/AI 名称(显示用)
     * @param {string} options.avatarBg - 头像背景色
     * @param {string} options.remark - 当前备注内容（空则显示 placeholder）
     * @param {string} options.mode - 当前模式（'calendar' | 'story'）
     * @param {Function} options.onSave - 保存回调，参数为备注文本
     * @param {Function} options.onClose - 关闭回调
     */
    openAiRemark({ name, avatarBg, remark, mode, onSave, onClose }) {
        this._dispatch(AiRemarkModal, {
            name: name || '',
            avatarBg: avatarBg || '#A8C8EC',
            remark: remark || '',
            mode: mode || 'calendar',
        }, {
            onSave: (text) => {
                try {
                    onSave?.(text);
                } catch (err) {
                    console.error('[chat-modal] ai-remark onSave failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] ai-remark onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.43 打开消息编辑弹窗
     * @param {Object} options
     * @param {string} options.originalText
     * @param {string} options.senderLabel
     * @param {string} options.messageType
     * @param {boolean} options.editable
     * @param {Function} options.onSave 新内容回调
     * @param {Function} options.onClose 关闭回调
     */
    openMessageEdit({ originalText, senderLabel, messageType, editable, onSave, onClose } = {}) {
        this._dispatch(MessageEditModal, {
            originalText: originalText || '',
            senderLabel: senderLabel || '',
            messageType: messageType || 'text',
            editable: editable !== false,
        }, {
            onSave: (newText) => {
                try {
                    onSave?.(newText);
                } catch (err) {
                    console.error('[chat-modal] message-edit onSave failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] message-edit onClose failed', err); }
            },
        });
    }

    /**
     * 打开聊天背景选择弹窗（v0.29.1 - 极简版，只支持上传图片）
     * @param {Object} options
     * @param {string} options.currentValue - 当前背景值（'image:<dataURL>' / ''）
     * @param {Function} options.onSave - 保存回调，参数为新的 image 值（'' 表示清空）
     * @param {Function} options.onClose - 关闭回调
     */
    openChatBackground({ currentValue, onSave, onClose }) {
        this._dispatch(ChatBackgroundModal, {
            currentValue: currentValue || '',
        }, {
            onSave: (value) => {
                try {
                    onSave?.(value);
                } catch (err) {
                    console.error('[chat-modal] chat-background onSave failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] chat-background onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.33 打开转发目标选择弹窗 (统一接口,详见 chat-modal-components.js 的 ForwardTargetModal)
     * @param {Object} options
     * @param {string}   options.mode        'calendar' | 'story'
     * @param {Array}    options.privateChats  [{ id, name, avatar, avatarBg, subtitle }]
     * @param {Array}    options.groupChats    [{ id, name, members, avatar }]
     * @param {Function} options.onSelect   选中目标回调 { type, id, target }
     * @param {Function} options.onClose    关闭回调
     */
    openForwardTargetSelection({ mode, privateChats, groupChats, onSelect, onClose } = {}) {
        // ★ 真实接口是 openForwardTarget,这里做一层 alias 兼容早期 chat-forward.js
        return this.openForwardTarget({ mode, privateChats, groupChats, onSelect, onClose });
    }

    /**
     * 打开图片描述详情弹窗 (Vue 组件版本)
     * @param {Object} options
     * @param {string} options.description - 图片描述
     * @param {string} options.cardColor - 卡片背景色
     * @param {string} options.textColor - 文字颜色
     * @param {string} options.borderColor - 边框颜色
     * @param {Function} options.onClose - 关闭回调
     * @param {Function} options.onFavorite - 收藏回调
     * @param {Function} options.onShare - 分享回调
     */
    openDescImageDetail({ description, cardColor, textColor, borderColor, onClose, onFavorite, onShare }) {
        this._dispatch(DescImageDetailModal, {
            description: description || '',
            cardColor: cardColor || '#FFE4EC',
            textColor: textColor || '#D4728A',
            borderColor: borderColor || '#C0607A',
        }, {
            onClose: onClose || (() => {}),
            onFavorite: onFavorite || (() => {
                window.__phoneIsland?.notify?.('success', '已收藏', '图片已添加到收藏');
            }),
            onShare: onShare || (() => {
                if (navigator.share) {
                    navigator.share({ title: '图片描述', text: description });
                } else {
                    window.__phoneIsland?.notify?.('info', '分享功能', '复制链接即将开放');
                }
            }),
        });
    }

    /**
     * 打开转发选目标弹窗（v0.33）
     * @param {Object} options
     * @param {'calendar'|'story'} options.mode  当前模式(用于文案展示)
     * @param {Array}  options.privateChats  可转发的私聊目标 [{ id, name, avatar, avatarBg, subtitle }]
     * @param {Array}  options.groupChats    可转发的群聊目标 [{ id, name, members, avatar }]
     * @param {Function} options.onSelect   选中目标回调,参数 { type: 'private'|'group', id, target }
     * @param {Function} options.onClose    关闭回调
     */
    openForwardTarget({ mode, privateChats, groupChats, onSelect, onClose } = {}) {
        this._dispatch(ForwardTargetModal, {
            mode: mode || 'calendar',
            privateChats: Array.isArray(privateChats) ? privateChats : [],
            groupChats: Array.isArray(groupChats) ? groupChats : [],
        }, {
            onSelect: (payload) => {
                try {
                    onSelect?.(payload);
                } catch (err) {
                    console.error('[chat-modal] forward-target onSelect failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] forward-target onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.42 打开故事存档「封存」弹窗
     *   - 用户在故事存档页点「封存当前聊天记录」触发
     *   - 弹窗里填标题 + 简介,确认后由 app 进程
     *     1) 调 sdk.storyArchives.add() 写存档
     *     2) 调 sdk.chatMessages.removeAllForConversation() 清空当前故事会话
     *     3) 刷新存档列表
     *
     * @param {Object} options
     * @param {string} options.contactName      当前 AI 名称(显示在弹窗里)
     * @param {number} options.messageCount    当前故事会话消息条数
     * @param {string} options.suggestedName   建议的默认标题(基于时间生成)
     * @param {Function} options.onConfirm     回调({ name, description })
     * @param {Function} options.onClose       关闭回调
     */
    openArchiveSave({ contactName, messageCount, suggestedName, onConfirm, onClose } = {}) {
        this._dispatch(StoryArchiveSaveModal, {
            contactName: contactName || '',
            messageCount: Number(messageCount) || 0,
            suggestedName: suggestedName || '',
        }, {
            onConfirm: (payload) => {
                try {
                    onConfirm?.(payload);
                } catch (err) {
                    console.error('[chat-modal] archive-save onConfirm failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] archive-save onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.42 打开「恢复存档覆盖确认」弹窗
     *   - 当前故事会话有消息时,点「恢复」会先弹这个
     *   - 二次确认后才真正恢复(防止误触)
     *
     * @param {Object} options
     * @param {string} options.archiveName
     * @param {number} options.currentCount
     * @param {Function} options.onConfirm
     * @param {Function} options.onClose
     */
    openArchiveRestoreConfirm({ archiveName, currentCount, onConfirm, onClose } = {}) {
        this._dispatch(StoryArchiveRestoreConfirmModal, {
            archiveName: archiveName || '',
            currentCount: Number(currentCount) || 0,
        }, {
            onConfirm: () => {
                try {
                    onConfirm?.();
                } catch (err) {
                    console.error('[chat-modal] archive-restore-confirm onConfirm failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] archive-restore-confirm onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.42 打开「删除存档确认」弹窗
     *
     * @param {Object} options
     * @param {string} options.archiveName
     * @param {string} options.archiveDate      已格式化时间字符串
     * @param {number} options.messageCount
     * @param {Function} options.onConfirm
     * @param {Function} options.onClose
     */
    openArchiveDeleteConfirm({ archiveName, archiveDate, messageCount, onConfirm, onClose } = {}) {
        this._dispatch(StoryArchiveDeleteConfirmModal, {
            archiveName: archiveName || '',
            archiveDate: archiveDate || '',
            messageCount: Number(messageCount) || 0,
        }, {
            onConfirm: () => {
                try {
                    onConfirm?.();
                } catch (err) {
                    console.error('[chat-modal] archive-delete-confirm onConfirm failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] archive-delete-confirm onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.50 打开「编辑 / 新增 replyPrompt」弹窗
     *   - initial: { title, content, source, active }
     *   - isCreate: true 时是新增模式,弹窗标题变「新增回复提示词」
     *   - onSave: ({ title, content, source, active }) => void
     *
     * @param {Object} options
     * @param {Object} options.initial  初始值(title 为空 = 新增模式)
     * @param {boolean} options.isCreate
     * @param {Function} options.onSave
     * @param {Function} options.onClose
     */
    openEditReplyPrompt({ initial, isCreate, onSave, onClose } = {}) {
        this._dispatch(EditReplyPromptModal, {
            initial: initial || { title: '', content: '', source: 'custom', active: true },
            isCreate: !!isCreate,
        }, {
            onSave: (next) => {
                try {
                    onSave?.(next);
                } catch (err) {
                    console.error('[chat-modal] edit-reply-prompt onSave failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] edit-reply-prompt onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.57 打开「系统 prompt 编辑」弹窗(只编辑「回复须知」)
     * options:
     *   - kind          'user' | 'ai'
     *   - aiPersonId    string
     *   - title         string(显示用)
     *   - baseContent   string(人设上下文快照,只读)
     *   - replyNote     string(当前回复须知文本)
     *   - position      'before' | 'after'
     *   - onSave({ note, position })  保存回调
     *   - onClose()                   关闭回调
     */
    openSystemPromptEdit({ kind, aiPersonId, title, baseContent, replyNote, position, onSave, onClose } = {}) {
        this._dispatch(SystemPromptEditModal, {
            kind: kind === 'ai' ? 'ai' : 'user',
            aiPersonId: String(aiPersonId || ''),
            title: String(title || ''),
            baseContent: String(baseContent || ''),
            replyNote: String(replyNote || ''),
            position: position === 'before' ? 'before' : 'after',
        }, {
            onSave: (next) => {
                try {
                    onSave?.(next);
                } catch (err) {
                    console.error('[chat-modal] system-prompt-edit onSave failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] system-prompt-edit onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.44 打开「消息删除确认」弹窗
     *
     * @param {Object} options
     * @param {Function} options.onConfirm - 确认删除回调
     * @param {Function} options.onClose   - 关闭回调
     */
    openMessageDeleteConfirm({ onConfirm, onClose } = {}) {
        this._dispatch(MessageDeleteConfirmModal, {}, {
            onConfirm: () => {
                try {
                    onConfirm?.();
                } catch (err) {
                    console.error('[chat-modal] message-delete-confirm onConfirm failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] message-delete-confirm onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.33 打开聊天记录详情弹窗
     *   - 用户点击 chat-record-card 触发
     *   - 单条:显示该消息
     *   - 多条:列出**全部**消息(不只是 preview 的 3 条折叠)
     *   - 1:1 复原 chat.js 的 openChatRecordModal(aiId, msgId)
     *
     * @param {Object} options
     * @param {string} options.title         卡片标题 (e.g. "X 和 Y 的聊天记录")
     * @param {Array}  options.messages      完整消息数组
     * @param {string} options.sourceLabel   来源副标 (e.g. "来自与 小美 的对话")
     * @param {Function} options.onClose     关闭回调
     */
    openChatRecordDetail({ title, messages, sourceLabel, onClose } = {}) {
        this._dispatch(ChatRecordDetailModal, {
            title: title || '聊天记录',
            messages: Array.isArray(messages) ? messages : [],
            sourceLabel: sourceLabel || '',
        }, {
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] chat-record-detail onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.61.3 打开「概要范围选择」弹窗(日历模式 / 故事模式)
     *   - mode='calendar' → 显示「最近 N 天 / 本月 / 上月 / 本年」预设 + 月份日期方块
     *   - mode='story'     → 隐藏日期选择,展示当前故事会话 + 直接进入下一步
     *
     * @param {Object} options
     * @param {'calendar'|'story'} options.mode
     * @param {string} options.contactName
     * @param {Array<{dateKey:string, count:number}>} [options.availableDays]
     * @param {Array} [options.messages]    故事模式必传
     * @param {Function} options.onConfirm  ({ mode, startDay, endDay, selectedDays, messages, contactName }) => void
     * @param {Function} options.onClose
     */
    openSummaryRange({ mode, contactName, availableDays, messages, onConfirm, onClose } = {}) {
        const safeMode = mode === 'story' ? 'story' : 'calendar';
        this._dispatch(SummaryRangeModal, {
            mode: safeMode,
            contactName: contactName || '',
            availableDays: Array.isArray(availableDays) ? availableDays : [],
            messages: Array.isArray(messages) ? messages : [],
        }, {
            onConfirm: (payload) => {
                try { onConfirm?.(payload); } catch (err) {
                    console.error('[chat-modal] summary-range onConfirm failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] summary-range onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.61.3 打开「概要编辑/确认」弹窗
     *   - 展示占位 AI 生成的 title / content
     *   - 用户可改 / 重 Roll / 切 asPrompt / 保存
     *
     * @param {Object} options
     * @param {'calendar'|'story'} options.mode
     * @param {string} options.initialTitle
     * @param {string} options.initialContent
     * @param {{start:string,end:string}} options.dateRange
     * @param {number} options.messageCount
     * @param {boolean} options.defaultAsPrompt
     * @param {Function} options.onSave   ({ title, content, asPrompt, mode, dateRange, messageCount }) => void
     * @param {Function} options.onReroll (重新生成标题/内容后,可重新 _dispatch 同一弹窗)
     * @param {Function} options.onClose
     */
    openSummaryEdit({ mode, initialTitle, initialContent, dateRange, messageCount, defaultAsPrompt, promptPrefix, aiPersonaSummary, userPersonaSummary, toolkit, onSave, onGenerate, onReroll, onClose } = {}) {
        const safeMode = mode === 'story' ? 'story' : 'calendar';
        // ★ v0.66 bug 修复:
        //   textarea 初始内容 = 用户传入的 initialContent(应该是空字符串等 AI 生成),
        //   不要再把 promptPrefix 拼到 content 里。promptPrefix 仅用于内部 AI 调用,跟用户看到的 textarea 完全隔离。
        const safeInitialContent = String(initialContent || '');
        this._dispatch(SummaryEditModal, {
            mode: safeMode,
            initialTitle: initialTitle || '',
            initialContent: safeInitialContent,
            dateRange: dateRange || { start: '', end: '' },
            messageCount: Number(messageCount) || 0,
            defaultAsPrompt: !!defaultAsPrompt,
            // ★ v0.66 人设信息
            aiPersonaSummary: String(aiPersonaSummary || '').trim(),
            userPersonaSummary: String(userPersonaSummary || '').trim(),
            toolkit: toolkit || null,
        }, {
            onSave: (next) => {
                try { onSave?.(next); } catch (err) {
                    console.error('[chat-modal] summary-edit onSave failed', err);
                }
            },
            // ★ v0.66 AI 生成回调:当 textarea 为空时点主按钮触发
            onGenerate: (payload) => {
                try { onGenerate?.(payload); } catch (err) {
                    console.error('[chat-modal] summary-edit onGenerate failed', err);
                }
            },
            onReroll: () => {
                try { onReroll?.(); } catch (err) {
                    console.error('[chat-modal] summary-edit onReroll failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] summary-edit onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.61.8 打开「第三方 App Prompt 预览编辑器」(preview + JSON 编辑器)
     *   - 弹出 AppPromptPreviewModal:实时预览 + JSON 文本框 + 复制/编辑/保存/复原
     *   - 真正的预览逻辑封装在 AppPromptPreviewModal(实时响应 textarea 修改)
     *   - onSave 回调收到 previewData 时,调用方负责写 sdk.appPrompts.setState(...)
     *
     * @param {Object} options
     * @param {string} options.appId
     * @param {string} options.promptId
     * @param {string} [options.previewType]   'text' | 'music-card' | 'red-packet-card' | 'location-card'
     * @param {object} [options.previewData]   当前 previewData(customPreviewData || previewData)
     * @param {object} [options.originalPreviewData]  register 时的原始 previewData(用于「复原」)
     * @param {string} [options.label]
     * @param {Function} [options.onSave]      (previewData) => Promise<void>  保存后回调
     * @param {Function} [options.onClose]
     */
    openAppPromptPreview({ appId, promptId, previewType, previewData, originalPreviewData, label, onSave, onClose } = {}) {
        const safeType = ['text', 'music-card', 'red-packet-card', 'location-card'].includes(previewType)
            ? previewType : 'text';
        const safeData = previewData && typeof previewData === 'object' ? previewData : {};
        const safeOriginal = originalPreviewData && typeof originalPreviewData === 'object'
            ? originalPreviewData : null;
        this._dispatch(AppPromptPreviewModal, {
            appId: String(appId || ''),
            promptId: String(promptId || ''),
            previewType: safeType,
            previewData: safeData,
            originalPreviewData: safeOriginal,
            label: String(label || promptId || 'App Prompt'),
        }, {
            save: async (payload) => {
                try {
                    if (typeof onSave === 'function') {
                        await onSave(payload);
                    } else {
                        // 默认行为:写 sdk.appPrompts.setState(customPreviewData)
                        const sdk = window.settingsSdk;
                        if (sdk?.appPrompts?.setState) {
                            await sdk.appPrompts.setState(appId, promptId, {
                                customPreviewData: payload?.previewData || {},
                            });
                        }
                    }
                } catch (err) {
                    console.warn('[chat-modal] openAppPromptPreview onSave failed', err);
                }
            },
            notify: (payload) => {
                try {
                    window.__phoneIsland?.notify?.(
                        payload?.level || 'info',
                        payload?.title || '',
                        payload?.sub || '',
                    );
                } catch (_) { /* noop */ }
            },
            close: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] openAppPromptPreview onClose failed', err); }
            },
        });
    }

    /**
     * ★ v0.61.8.11 打开「上下文长度」设置弹窗
     *   - 用户自定义「回合」数,保存后写入 aiPerson.socialProfiles.chat.rollingConfig.contextRounds
     *   - 调用方负责 onSave 时调用 sdk.rollingSummaries.setRollingConfig(aiPersonId, { contextRounds })
     *
     * @param {Object} options
     * @param {string} options.aiPersonId   AI 人设 ID
     * @param {string} options.contactName  联系人名称(显示用)
     * @param {number} options.currentValue 当前回合数
     * @param {string} [options.mode]       'calendar' | 'story'
     * @param {Function} [options.onSave]   (value: number) => Promise<void>
     * @param {Function} [options.onClose]
     */
    openContextLength({ aiPersonId, contactName, currentValue, mode = 'calendar', onSave, onClose } = {}) {
        const safeValue = Number(currentValue) || 20;
        this._dispatch(ContextLengthModal, {
            aiPersonId: String(aiPersonId || ''),
            contactName: String(contactName || ''),
            currentValue: safeValue,
            mode: mode === 'story' ? 'story' : 'calendar',
        }, {
            onSave: async (value) => {
                try {
                    if (typeof onSave === 'function') {
                        await onSave(value);
                    } else {
                        // 默认行为:写 rollingConfig.contextRounds
                        const sdk = window.settingsSdk;
                        if (sdk?.rollingSummaries?.setRollingConfig && aiPersonId) {
                            await sdk.rollingSummaries.setRollingConfig(aiPersonId, {
                                contextRounds: Number(value) || 20,
                            });
                        }
                    }
                } catch (err) {
                    console.warn('[chat-modal] openContextLength onSave failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) {
                    console.error('[chat-modal] openContextLength onClose failed', err);
                }
            },
        });
    }

    /**
     * ★ v0.63 打开「滚动摘要容量」设置弹窗
     *   - 用户自定义 kMergeSize + maxChainLength,保存后写入 aiPerson.socialProfiles.chat.rollingConfig
     *   - 调用方负责 onSave 时调用 sdk.rollingSummaries.setRollingConfig(aiPersonId, { kMergeSize, maxChainLength })
     *
     * @param {Object} options
     * @param {string} options.aiPersonId
     * @param {string} options.contactName
     * @param {number} options.currentMergeSize
     * @param {number} options.currentChainLength
     * @param {string} [options.mode]
     * @param {Function} [options.onSave]  ({kMergeSize, maxChainLength}) => Promise<void>
     * @param {Function} [options.onClose]
     */
    openRollingCapacity({ aiPersonId, contactName, currentMergeSize, currentChainLength, mode = 'calendar', onSave, onClose } = {}) {
        const safeMergeSize = Number(currentMergeSize) || 5;
        const safeChainLength = Number(currentChainLength) || 10;
        this._dispatch(RollingCapacityModal, {
            aiPersonId: String(aiPersonId || ''),
            contactName: String(contactName || ''),
            currentMergeSize: safeMergeSize,
            currentChainLength: safeChainLength,
            mode: mode === 'story' ? 'story' : 'calendar',
        }, {
            onSave: async (payload) => {
                try {
                    if (typeof onSave === 'function') {
                        await onSave(payload);
                    } else {
                        const sdk = window.settingsSdk;
                        if (sdk?.rollingSummaries?.setRollingConfig && aiPersonId) {
                            await sdk.rollingSummaries.setRollingConfig(aiPersonId, {
                                kMergeSize: Number(payload?.kMergeSize) || 5,
                                maxChainLength: Number(payload?.maxChainLength) || 10,
                            });
                        }
                    }
                } catch (err) {
                    console.warn('[chat-modal] openRollingCapacity onSave failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) {
                    console.error('[chat-modal] openRollingCapacity onClose failed', err);
                }
            },
        });
    }

    /**
     * ★ v0.62.1 API 调用设置弹窗
     *   - 列出当前 AI 人设 + 用户人设绑定的所有 API Key / Group
     *   - 用户选完 → 触发 onSelect(refId),由调用方持久化到 localStorage
     *   - 空状态引导跳到 settings → AI 人设编辑器
     *
     * @param {Object} options
     * @param {string} options.aiPersonId       当前 AI 人设 ID
     * @param {string} options.contactName      显示名(AI 名 / 备注)
     * @param {Array}  options.refs             [{ refId, type:'key'|'group', label, model, baseUrl, enabled, source:'ai'|'user', keyCount? }]
     * @param {string} options.defaultRefId     当前已选中的 refId
     * @param {Function} options.onSelect       选完后回调(refId: string),refId 为空表示清除
     * @param {Function} options.onClose        关闭回调
     */
    openApiCallModal({ aiPersonId, contactName, refs = [], defaultRefId = '', onSelect, onClose } = {}) {
        this._dispatch(ApiCallModal, {
            aiPersonId: String(aiPersonId || ''),
            contactName: String(contactName || ''),
            refs: Array.isArray(refs) ? refs : [],
            defaultRefId: String(defaultRefId || ''),
        }, {
            onSelect: (refId) => {
                try {
                    if (typeof onSelect === 'function') onSelect(refId);
                } catch (err) {
                    console.error('[chat-modal] openApiCallModal onSelect failed', err);
                }
            },
            onClose: () => {
                try { onClose?.(); } catch (err) {
                    console.error('[chat-modal] openApiCallModal onClose failed', err);
                }
            },
        });
    }

    /**
     * ★ v0.67 打开红包领取确认弹窗(点 AI 红包卡片时触发)
     * @param {Object} options
     * @param {string} options.message 祝福语
     * @param {number} options.amount 金额
     * @param {string} options.senderName 发送者名
     * @param {boolean} options.insufficientBalance AI 余额不足
     * @param {Function} options.onAccept 用户点击「领取红包」
     * @param {Function} options.onReject 用户点击「不领取」
     * @param {Function} options.onClose 弹窗关闭
     */
    openRedpacketReceive({ message, amount, senderName, insufficientBalance = false, onAccept, onReject, onClose } = {}) {
        this._dispatch(RedpacketReceiveModal, {
            message: String(message || '恭喜发财'),
            amount: Number(amount) || 0,
            senderName: String(senderName || '对方'),
            insufficientBalance: !!insufficientBalance,
        }, {
            accept: () => {
                try { onAccept?.(); } catch (err) { console.error('[chat-modal] redpacket-receive accept failed', err); }
            },
            reject: () => {
                try { onReject?.(); } catch (err) { console.error('[chat-modal] redpacket-receive reject failed', err); }
            },
            close: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] redpacket-receive close failed', err); }
            },
        });
    }

    /**
     * ★ v0.67 打开转账收款确认弹窗(点 AI 转账卡片时触发)
     */
    openTransferReceive({ amount, note, senderName, insufficientBalance = false, onAccept, onReturn, onClose } = {}) {
        this._dispatch(TransferReceiveModal, {
            amount: Number(amount) || 0,
            note: String(note || '转账'),
            senderName: String(senderName || '对方'),
            insufficientBalance: !!insufficientBalance,
        }, {
            accept: () => {
                try { onAccept?.(); } catch (err) { console.error('[chat-modal] transfer-receive accept failed', err); }
            },
            return: () => {
                try { onReturn?.(); } catch (err) { console.error('[chat-modal] transfer-receive return failed', err); }
            },
            close: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] transfer-receive close failed', err); }
            },
        });
    }

    /**
     * ★ v0.67 打开通话结束概要弹窗
     */
    openCallSummary({ callType, duration, summary, senderName, wasConnected, onViewDetail, onClose } = {}) {
        this._dispatch(CallSummaryModal, {
            callType: String(callType || 'voice'),
            duration: Number(duration) || 0,
            summary: String(summary || ''),
            senderName: String(senderName || '对方'),
            wasConnected: wasConnected !== false,
        }, {
            viewDetail: () => {
                try { onViewDetail?.(); } catch (err) { console.error('[chat-modal] call-summary viewDetail failed', err); }
            },
            close: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] call-summary close failed', err); }
            },
        });
    }

    /**
     * ★ v0.67 打开 AI 来电弹窗
     * @param {Object} options
     * @param {string} options.callerName AI 人设名
     * @param {string} options.callerAvatar AI 头像 URL
     * @param {string} options.callType 'voice' | 'video'
     * @param {Function} options.onAccept 用户接听
     * @param {Function} options.onReject 用户拒绝
     * @param {Function} options.onClose 弹窗关闭
     */
    openIncomingCall({ callerName, callerAvatar, callType = 'voice', onAccept, onReject, onClose } = {}) {
        this._dispatch(IncomingCallModal, {
            callerName: String(callerName || 'AI'),
            callerAvatar: String(callerAvatar || ''),
            callType: String(callType || 'voice'),
        }, {
            accept: () => {
                try { onAccept?.(); } catch (err) { console.error('[chat-modal] incoming-call accept failed', err); }
            },
            reject: () => {
                try { onReject?.(); } catch (err) { console.error('[chat-modal] incoming-call reject failed', err); }
            },
            close: () => {
                try { onClose?.(); } catch (err) { console.error('[chat-modal] incoming-call close failed', err); }
            },
        });
    }
}

// 单例
export const chatModalManager = new ChatModalManager();
