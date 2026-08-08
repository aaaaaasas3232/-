/**
 * chat-app / 收藏详情页
 *
 * Phase 11+ 收藏功能重构
 *
 * 功能:
 *   - 分类标签页: 全部 / 文字 / 图片 / 位置 / 游戏 / 视频通话
 *   - "全部": 对话片段收藏(多选消息合并为一个收藏项)
 *   - "文字/图片/位置/游戏/通话": 单独收藏的消息
 *   - 对话片段支持折叠/展开,展示完整消息流
 *   - 每条收藏显示: 发送者头像/名字、时间、收藏来源
 *
 * 数据结构:
 *   type='conversation': 对话片段(多选消息收藏)
 *     - favoriteId: 收藏唯一ID
 *     - type: 'conversation'
 *     - sourceType: 'private' | 'group'
 *     - sourceId: 联系人ID或群ID
 *     - sourceName: 联系人或群名称
 *     - messages: 消息数组 [{id, sender, senderName, type, content, time, ...}]
 *     - time: 收藏时间
 *     - messageCount: 消息数量
 *     - firstMessage: 第一条消息摘要
 *
 *   type='text'/'image'/'location'/'game'/'voice_call'/'video_call': 单条收藏
 *     - favoriteId: 收藏唯一ID
 *     - type: 消息类型
 *     - content: 收藏内容摘要
 *     - sender: 发送者
 *     - senderName: 发送者名字
 *     - time: 收藏时间
 *     - sourceType: 'private' | 'group'
 *     - sourceId: 联系人ID或群ID
 *     - sourceName: 联系人或群名称
 */

import { escapeHtml } from '@/src/core/escape.js';

// ─── SVG 图标 ─────────────────────────────────────────────

const ICON_BACK = `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34-4.61-4.49 6.37-.93L12 2.8Z" fill="currentColor"/></svg>`;
const ICON_STAR_OUTLINE = `<svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34-4.61-4.49 6.37-.93L12 2.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m16.5 16.5 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_ARROW = `<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_IMAGE = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_LOCATION = `<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="3" fill="currentColor"/></svg>`;
const ICON_GAME = `<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="10" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_VIDEO = `<svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_VOICE = `<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_TEXT = `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_EXPAND = `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_COLLAPSE = `<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_PRIVATE = `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_GROUP = `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

// ─── 分类配置 ─────────────────────────────────────────────
// 注意:全部(showConversation=true)显示对话片段,其他显示单条收藏

const CATEGORIES = [
    { id: 'all', label: '全部', icon: ICON_STAR_OUTLINE, showConversation: true },
    { id: 'text', label: '文字', icon: ICON_TEXT, showConversation: false },
    { id: 'image', label: '图片', icon: ICON_IMAGE, showConversation: false },
    { id: 'location', label: '位置', icon: ICON_LOCATION, showConversation: false },
    { id: 'game', label: '游戏', icon: ICON_GAME, showConversation: false },
    { id: 'video_call', label: '视频通话', icon: ICON_VIDEO, showConversation: false },
    { id: 'voice_call', label: '语音通话', icon: ICON_VOICE, showConversation: false },
];

// ─── 演示数据 ─────────────────────────────────────────────

const DEMO_FAVORITES = [
    // ========== 对话片段收藏(type='conversation') ==========
    // 示例:用户选择了多条消息(文字+图片+文字)收藏成一个片段
    {
        favoriteId: 'conv-1',
        type: 'conversation',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
        time: '今天 09:32',
        messageCount: 5,
        messages: [
            { id: 'm5', sender: 'user', senderName: '我', senderColor: 'pink', type: 'text', content: '好的，我想了解如何更好地使用 AI 助手', time: '昨天 20:08' },
            { id: 'm6', sender: 'ai', senderName: '小美', senderColor: 'blue', type: 'text', content: '使用 AI 助手的技巧：\n1. 问清楚具体的问题\n2. 分步骤提问\n3. 可以让我帮你修改润色文章\n4. 代码问题可以发给我帮你 review', time: '昨天 20:10' },
            { id: 'img-1', sender: 'ai', senderName: '小美', senderColor: 'blue', type: 'descriptive_image', content: '阳光洒在窗台上，一只橘猫正慵懒地躺在毛茸茸的垫子上，眯着眼睛享受午后的温暖时光。背景是淡蓝色的窗帘随风轻摇。', imagePreview: '🌅 猫咪图', cardColor: '#FFF3E0', time: '昨天 20:12' },
            { id: 'm7', sender: 'user', senderName: '我', senderColor: 'pink', type: 'text', content: '太棒了！谢谢小美', time: '昨天 20:15' },
            { id: 'm8', sender: 'ai', senderName: '小美', senderColor: 'blue', type: 'text', content: '不客气~ 有问题随时问我哦！', time: '昨天 20:16' },
        ],
    },
    // 另一个对话片段收藏
    {
        favoriteId: 'conv-2',
        type: 'conversation',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
        time: '昨天 21:30',
        messageCount: 4,
        messages: [
            { id: 'm10', sender: 'user', senderName: '我', senderColor: 'pink', type: 'text', content: '小美，昨天看的电影太精彩了！', time: '昨天 20:00' },
            { id: 'm18', sender: 'ai', senderName: '小美', senderColor: 'blue', type: 'text', content: '是呀！那段特效太震撼了', time: '昨天 20:05' },
            { id: 'm19', sender: 'user', senderName: '我', senderColor: 'pink', type: 'text', content: '下次再一起看~', time: '昨天 20:08' },
            { id: 'm20', sender: 'ai', senderName: '小美', senderColor: 'blue', type: 'text', content: '好呀！期待下一次~', time: '昨天 20:10' },
        ],
    },
    // 群聊对话片段收藏
    {
        favoriteId: 'conv-3',
        type: 'conversation',
        sourceType: 'group',
        sourceId: 'group-1',
        sourceName: '游戏群',
        time: '今天 14:15',
        messageCount: 6,
        messages: [
            { id: 'game-msg-1', sender: 'system', senderName: '系统', senderColor: 'gray', type: 'system', content: '【狼人杀】游戏已创建,参与者:小美、小明、小蓝、小红、玩家', time: '14:00' },
            { id: 'game-msg-2', sender: 'ai', senderName: '小蓝', senderColor: 'blue', type: 'text', content: '我是预言家,昨晚验了3号是狼人,归票3号', time: '14:06' },
            { id: 'game-msg-3', sender: 'ai', senderName: '小美', senderColor: 'pink', type: 'text', content: '我觉得2号不像狼人,他一直在帮好人说话', time: '14:07' },
            { id: 'game-msg-4', sender: 'ai', senderName: '小明', senderColor: 'purple', type: 'text', content: '同意,3号发言太爆了,肯定是狼', time: '14:08' },
            { id: 'game-msg-5', sender: 'user', senderName: '我', senderColor: 'pink', type: 'text', content: '投3号', time: '14:10' },
            { id: 'game-msg-6', sender: 'system', senderName: '系统', senderColor: 'gray', type: 'system', content: '3号被投票出局,遗言说昨晚查验了4号是好人', time: '14:12' },
        ],
    },

    // ========== 单条收藏(text) ==========
    {
        favoriteId: 'fav-1',
        messageId: 'm1',
        type: 'text',
        sender: 'ai',
        senderName: '小美',
        senderColor: 'blue',
        content: '当然可以！我是你的 AI 助手小美，可以帮你回答问题、聊天、写作、编程等各种任务。有什么具体想了解的吗？',
        time: '今天 09:32',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
    },
    {
        favoriteId: 'fav-12',
        messageId: 'grp-1',
        type: 'text',
        sender: 'ai',
        senderName: '小红',
        senderColor: 'pink',
        content: '周末大家有没有空?想组织一次聚餐~',
        time: '昨天 18:00',
        sourceType: 'group',
        sourceId: 'group-1',
        sourceName: '游戏群',
    },

    // ========== 单条收藏(image) ==========
    {
        favoriteId: 'fav-4',
        messageId: 'img-1',
        type: 'image',
        sender: 'ai',
        senderName: '小美',
        senderColor: 'blue',
        content: '阳光洒在窗台上，一只橘猫正慵懒地躺在毛茸茸的垫子上，眯着眼睛享受午后的温暖时光。背景是淡蓝色的窗帘随风轻摇。',
        imagePreview: '🌅 猫咪图',
        cardColor: '#FFF3E0',
        time: '今天 14:26',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
    },
    {
        favoriteId: 'fav-5',
        messageId: 'img-2',
        type: 'image',
        sender: 'user',
        senderName: '我',
        senderColor: 'pink',
        content: '海边日落的壮丽景色，橙红色的晚霞映照在波光粼粼的海面上，一群海鸥在天空飞翔，远处帆船点点。',
        imagePreview: '🌊 日落图',
        cardColor: '#E8F2FF',
        time: '今天 14:31',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
    },

    // ========== 单条收藏(location) ==========
    {
        favoriteId: 'fav-6',
        messageId: 'loc-1',
        type: 'location',
        sender: 'ai',
        senderName: '小美',
        senderColor: 'blue',
        content: '上海中心大厦',
        locationAddress: '上海市浦东新区陆家嘴环路 501 号',
        locationName: '上海中心大厦',
        time: '今天 13:00',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
    },
    {
        favoriteId: 'fav-7',
        messageId: 'loc-2',
        type: 'location',
        sender: 'user',
        senderName: '我',
        senderColor: 'pink',
        content: '那家日料店',
        locationAddress: '上海市黄浦区南京东路 100 号 3 楼',
        locationName: '那家日料店',
        time: '今天 13:15',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
    },

    // ========== 单条收藏(voice_call) ==========
    {
        favoriteId: 'fav-8',
        messageId: 'cr-voice-1',
        type: 'voice_call',
        sender: 'system',
        senderName: '语音通话',
        senderColor: 'blue',
        content: '语音通话 5分26秒',
        duration: 326,
        summary: '聊了下周末去哪儿吃饭、推荐了新开的那家日料店',
        time: '今天 14:00',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
        contextMessages: [
            { role: 'user', content: '小美,周末要不要一起吃饭呀?', time: '14:00', senderName: '我' },
            { role: 'ai', content: '好呀!你有什么想吃的吗?上次那家日料店我还挺想再去的~', time: '14:01', senderName: '小美' },
            { role: 'user', content: '我也正想说那家店呢!晚上七点?', time: '14:02', senderName: '我' },
            { role: 'ai', content: '没问题,我订个位~今天有点累,吃完想回家躺一会儿', time: '14:05', senderName: '小美' },
            { role: 'user', content: '工作辛苦啦,那我请你吃大餐补补', time: '14:10', senderName: '我' },
            { role: 'ai', content: '(撒娇)那我要吃三文鱼、烤鳗鱼还有甜虾哦~谢谢老公~', time: '14:12', senderName: '小美' },
            { role: 'user', content: '都依你', time: '14:14', senderName: '我' },
            { role: 'ai', content: '嘻嘻,那我先去忙了,晚上见~', time: '14:15', senderName: '小美' },
            { role: 'user', content: '好,晚上见', time: '14:16', senderName: '我' },
        ],
    },

    // ========== 单条收藏(video_call) ==========
    {
        favoriteId: 'fav-9',
        messageId: 'cr-video-1',
        type: 'video_call',
        sender: 'system',
        senderName: '视频通话',
        senderColor: 'pink',
        content: '视频通话 30分25秒',
        duration: 1825,
        summary: '视频看了一下午的旅行照片,讨论了国庆小长假去京都的计划',
        time: '昨天 21:30',
        sourceType: 'private',
        sourceId: 'ai-1',
        sourceName: '小美',
        contextMessages: [
            { role: 'user', content: '小美,我把今天的照片整理了一下,视频看看?', time: '21:30', senderName: '我' },
            { role: 'ai', content: '好呀!我刚洗完澡等你呢~', time: '21:31', senderName: '小美' },
            { role: 'user', content: '看这张,在清水寺拍的,光影好好看', time: '21:35', senderName: '我' },
            { role: 'ai', content: '哇,这也太美了吧!你看地上的影子~下次我们也去吧?', time: '21:36', senderName: '小美' },
            { role: 'user', content: '国庆节?正好七天假', time: '21:40', senderName: '我' },
            { role: 'ai', content: '太好了!那我们早点订机票 and 住宿,京都秋天红叶超美的~', time: '21:42', senderName: '小美' },
            { role: 'user', content: '预算大概多少?机票+酒店', time: '21:46', senderName: '我' },
            { role: 'ai', content: '我查了下,人均五六千左右应该够住好一些的町屋了', time: '21:48', senderName: '小美' },
            { role: 'user', content: '那就这么定了!我去做攻略', time: '21:55', senderName: '我' },
            { role: 'ai', content: '辛苦啦~我先去吹头发啦,晚安~', time: '22:00', senderName: '小美' },
            { role: 'user', content: '晚安,做美梦~', time: '22:01', senderName: '我' },
        ],
    },

    // ========== 单条收藏(game) ==========
    {
        favoriteId: 'fav-10',
        messageId: 'game-1',
        type: 'game',
        sender: 'ai',
        senderName: '小蓝',
        senderColor: 'blue',
        content: '狼人杀游戏已开始',
        gameType: 'werewolf',
        gameTitle: '狼人杀',
        summary: '第3天:2号被投票出局,遗言说昨晚查验了3号是狼人',
        time: '今天 14:15',
        sourceType: 'group',
        sourceId: 'group-1',
        sourceName: '游戏群',
        contextMessages: [
            { role: 'system', content: '【狼人杀】游戏已创建,参与者:小美、小明、小蓝、小红、玩家', time: '14:00', senderName: '系统' },
            { role: 'system', content: '天亮了,昨夜 2 号玩家被狼人击杀', time: '14:05', senderName: '系统' },
            { role: 'ai', content: '我是预言家,昨晚验了3号是狼人,归票3号', time: '14:06', senderName: '小蓝' },
            { role: 'ai', content: '我觉得2号不像狼人,他一直在帮好人说话', time: '14:07', senderName: '小美' },
            { role: 'ai', content: '同意,3号发言太爆了,肯定是狼', time: '14:08', senderName: '小明' },
            { role: 'user', content: '投3号', time: '14:10', senderName: '我' },
        ],
    },
];

// ─── 导出到全局（供交互逻辑使用）─────────────────────────────

// 将数据导出到全局，供 index.js 中的交互逻辑使用
if (typeof window !== 'undefined') {
    window.__chatDemoFavorites = DEMO_FAVORITES;
    window.__chatFavoritesRenderer = {
        renderFavoriteList,
        renderContextMessagesPreview,
        renderContextMessagesFull,
    };
}

// ─── 工具函数 ─────────────────────────────────────────────

/**
 * 格式化通话时长
 */
function formatCallDuration(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins + '分' + (secs > 0 ? `${secs}秒` : '');
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours + '小时' + (mins > 0 ? `${mins}分` : '');
}

/**
 * ★ v0.44 格式化相对时间(createdAt → "今天 14:26")
 * @param {number} ts - 毫秒时间戳
 */
function formatRelativeTime(ts) {
    if (!ts || typeof ts !== 'number') return '最近';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    if (isToday) return `今天 ${h}:${m}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${h}:${m}`;
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    return `${mo}月${day}日 ${h}:${m}`;
}

/**
 * 获取来源图标
 */
function getSourceIcon(sourceType) {
    return sourceType === 'group' ? ICON_GROUP : ICON_PRIVATE;
}

/**
 * 获取类型图标
 */
function getTypeIcon(type) {
    const cat = CATEGORIES.find(c => c.id === type);
    return cat ? cat.icon : ICON_TEXT;
}

/**
 * 获取类型标签
 */
function getTypeLabel(type) {
    const cat = CATEGORIES.find(c => c.id === type);
    return cat ? cat.label : '文字';
}

/**
 * 获取头像背景渐变
 */
function getAvatarBg(senderColor) {
    if (senderColor === 'pink') {
        return 'linear-gradient(135deg, #f2aacb, #ffcbdc)';
    } else if (senderColor === 'purple') {
        return 'linear-gradient(135deg, #c4b5fd, #ddd6fe)';
    } else if (senderColor === 'gray') {
        return 'linear-gradient(135deg, #c0c0c0, #d8d8d8)';
    }
    return 'linear-gradient(135deg, #9fc8ed, #c9dfff)';
}

/**
 * 渲染单条消息(用于对话片段内的消息流)
 */
function renderConversationMessage(msg) {
    const { id, sender, senderName, senderColor, type, content, time, imagePreview, cardColor, locationName, locationAddress } = msg;

    if (type === 'system') {
        return `<div class="conv-msg conv-msg--system">${escapeHtml(content)}</div>`;
    }

    const isUser = sender === 'user';
    const align = isUser ? 'flex-end' : 'flex-start';
    const bg = isUser ? '#FFE4EC' : '#E8F2FF';
    const avatarBg = getAvatarBg(senderColor || (isUser ? 'pink' : 'blue'));
    const name = escapeHtml(senderName || (isUser ? '我' : 'AI'));

    let contentHtml = '';
    if (type === 'descriptive_image' || type === 'image') {
        contentHtml = `
            <div class="conv-msg-content conv-msg-content--image">
                <div class="conv-image-preview" style="background: ${escapeHtml(cardColor || '#FFE4EC')};">
                    <div class="conv-image-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                    </div>
                    <div class="conv-image-text">${escapeHtml(imagePreview || '图片')}</div>
                </div>
            </div>
        `;
    } else if (type === 'location') {
        contentHtml = `
            <div class="conv-msg-content conv-msg-content--location">
                <div class="conv-location">
                    <div class="conv-location-icon">${ICON_LOCATION}</div>
                    <div class="conv-location-info">
                        <div class="conv-location-name">${escapeHtml(locationName || content)}</div>
                        ${locationAddress ? `<div class="conv-location-addr">${escapeHtml(locationAddress)}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    } else {
        contentHtml = `<div class="conv-msg-content conv-msg-content--text">${escapeHtml(content)}</div>`;
    }

    return `
        <div class="conv-msg" style="justify-content: ${align};">
            ${!isUser ? `
                <div class="conv-avatar" style="background: ${avatarBg};">
                    ${name.charAt(0)}
                </div>
            ` : ''}
            <div class="conv-bubble" style="background: ${bg};">
                <div class="conv-bubble-header">
                    <span class="conv-sender">${name}</span>
                    <span class="conv-time">${escapeHtml(time)}</span>
                </div>
                ${contentHtml}
            </div>
            ${isUser ? `
                <div class="conv-avatar" style="background: ${avatarBg};">
                    ${name.charAt(0)}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * 渲染对话片段项
 */
function renderConversationItem(item, isExpanded = false) {
    // ★ v0.44 兼容:真实收藏用 id,DEMO 用 favoriteId
    const favId = item.id || item.favoriteId;
    const { sourceType, sourceName, time, messageCount, messages } = item;

    const sourceIcon = getSourceIcon(sourceType);
    const firstMsg = messages[0];
    const firstMsgPreview = firstMsg
        ? (firstMsg.content?.substring(0, 50) + (firstMsg.content?.length > 50 ? '...' : ''))
        : '对话片段';

    // 收集消息类型统计
    const typeStats = {};
    messages.forEach(msg => {
        const t = msg.type === 'descriptive_image' ? 'image' : (msg.type || 'text');
        typeStats[t] = (typeStats[t] || 0) + 1;
    });
    const typeIcons = Object.entries(typeStats)
        .map(([t, count]) => {
            const icon = getTypeIcon(t);
            return `<span class="conv-type-stat" title="${getTypeLabel(t)}">${icon}<span>${count}</span></span>`;
        }).join('');

    return `
        <div class="chat-favorite-item chat-favorite-item--conversation"
             data-favorite-id="${escapeHtml(favId)}"
             data-type="conversation"
             data-expanded="${isExpanded}">
            <div class="fav-item-header">
                <div class="chat-favorite-avatar" style="background: linear-gradient(135deg, #f2aacb, #ffcbdc);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                </div>
                <div class="fav-item-meta">
                    <div class="fav-item-sender">
                        <span>${escapeHtml(sourceName)}</span>
                        <span class="fav-item-time">${escapeHtml(time)}</span>
                    </div>
                    <div class="fav-item-source">
                        <span class="fav-source-icon">${sourceIcon}</span>
                        <span>${escapeHtml(sourceName)}</span>
                        <span class="fav-type-badge fav-type-badge--conversation">
                            <span class="conv-type-icons">${typeIcons}</span>
                            <span>${messageCount} 条消息</span>
                        </span>
                    </div>
                </div>
                <button class="fav-expand-btn ${isExpanded ? 'expanded' : ''}"
                        ${`data-app-action='${escapeHtml(JSON.stringify({
                            action: 'appMethod',
                            appId: 'chat',
                            method: 'toggleFavoriteExpand',
                            payload: { favoriteId: favId },
                        }))}'`}
                        aria-label="${isExpanded ? '收起' : '展开'}">
                    ${isExpanded ? ICON_COLLAPSE : ICON_EXPAND}
                </button>
            </div>

            <div class="conv-preview">
                <div class="conv-preview-text">${escapeHtml(firstMsgPreview)}</div>
            </div>

            <div class="conv-messages" ${!isExpanded ? 'style="display:none;"' : ''}>
                ${messages.map(msg => renderConversationMessage(msg)).join('')}
            </div>
        </div>
    `;
}

/**
 * 渲染收藏项(单条收藏)
 */
function renderFavoriteItem(item, isExpanded = false) {
    // ★ v0.44 兼容:真实收藏用 id,DEMO 用 favoriteId
    const favId = item.id || item.favoriteId;
    const {
        type,
        sender,
        senderName,
        senderColor,
        content,
        time,
        sourceType,
        sourceName,
        imagePreview,
        cardColor,
        locationName,
        locationAddress,
        duration,
        summary,
        contextMessages,
        gameType,
        gameTitle,
        createdAt,
    } = item;

    const avatarBg = getAvatarBg(senderColor);
    const typeIcon = getTypeIcon(type);
    const sourceIcon = getSourceIcon(sourceType);
    const typeLabel = getTypeLabel(type);

    // ★ v0.44:真实收藏没有 time 字段,需要从 createdAt 格式化
    const displayTime = time || (createdAt ? formatRelativeTime(createdAt) : '最近');

    // 根据类型渲染不同内容
    let contentHtml = '';
    if (type === 'image') {
        contentHtml = `
            <div class="fav-image-preview" style="background: ${escapeHtml(cardColor || '#FFE4EC')};">
                <div class="fav-image-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                </div>
                <div class="fav-image-text">${escapeHtml(imagePreview || '图片')}</div>
            </div>
        `;
    } else if (type === 'location') {
        contentHtml = `
            <div class="fav-location-preview">
                <div class="fav-location-icon">${ICON_LOCATION}</div>
                <div class="fav-location-info">
                    <div class="fav-location-name">${escapeHtml(locationName || content)}</div>
                    ${locationAddress ? `<div class="fav-location-addr">${escapeHtml(locationAddress)}</div>` : ''}
                </div>
            </div>
        `;
    } else if (type === 'voice_call' || type === 'video_call') {
        const callIcon = type === 'video_call' ? ICON_VIDEO : ICON_VOICE;
        const durationText = duration ? formatCallDuration(duration) : '';
        contentHtml = `
            <div class="fav-call-preview">
                <div class="fav-call-icon">${callIcon}</div>
                <div class="fav-call-info">
                    <div class="fav-call-title">${escapeHtml(getTypeLabel(type))}</div>
                    <div class="fav-call-duration">${durationText}</div>
                    ${summary ? `<div class="fav-call-summary">${escapeHtml(summary)}</div>` : ''}
                </div>
            </div>
        `;
    } else if (type === 'game') {
        contentHtml = `
            <div class="fav-game-preview">
                <div class="fav-game-icon">${ICON_GAME}</div>
                <div class="fav-game-info">
                    <div class="fav-game-title">${escapeHtml(gameTitle || '游戏')}</div>
                    ${summary ? `<div class="fav-game-summary">${escapeHtml(summary)}</div>` : ''}
                </div>
            </div>
        `;
    } else {
        contentHtml = `<div class="fav-text-content">${escapeHtml(content)}</div>`;
    }

    // 渲染上下文消息(用于游戏/通话等需要展示完整流程的情况)
    let contextHtml = '';
    if (contextMessages && contextMessages.length > 0) {
        contextHtml = `
            <div class="fav-context ${isExpanded ? 'expanded' : ''}" data-context="${escapeHtml(favId)}">
                <button class="fav-context-header" ${`data-app-action='${escapeHtml(JSON.stringify({
                    action: 'appMethod',
                    appId: 'chat',
                    method: 'toggleFavoriteContext',
                    payload: { favoriteId: favId },
                }))}'`} type="button">
                    <span class="fav-context-label">${isExpanded ? '收起' : `查看全流程 (${contextMessages.length} 条)`}</span>
                    ${isExpanded ? ICON_COLLAPSE : ICON_EXPAND}
                </button>
                <div class="fav-context-messages">
                    ${isExpanded ? renderContextMessagesFull(contextMessages) : renderContextMessagesPreview(contextMessages, 3)}
                </div>
            </div>
        `;
    }

    return `
        <div class="chat-favorite-item"
             data-favorite-id="${escapeHtml(favId)}"
             data-type="${escapeHtml(type)}"
             data-searchable="${escapeHtml(`${senderName} ${content} ${sourceName}`)}">
            <div class="fav-item-header">
                <div class="chat-favorite-avatar" style="background: ${avatarBg};">
                    ${escapeHtml(senderName?.charAt(0) || '?')}
                </div>
                <div class="fav-item-meta">
                    <div class="fav-item-sender">
                        <span>${escapeHtml(senderName)}</span>
                        <span class="fav-item-time">${escapeHtml(displayTime)}</span>
                    </div>
                    <div class="fav-item-source">
                        <span class="fav-source-icon">${sourceIcon}</span>
                        <span>${escapeHtml(sourceName)}</span>
                        <span class="fav-type-badge">
                            <span class="fav-type-icon">${typeIcon}</span>
                            <span>${typeLabel}</span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="fav-item-content">
                ${contentHtml}
            </div>
            ${contextHtml}
        </div>
    `;
}

/**
 * 渲染上下文消息预览(前N条)
 */
function renderContextMessagesPreview(messages, limit = 3) {
    const visibleMessages = messages.slice(0, limit);
    const hasMore = messages.length > limit;

    return `
        ${visibleMessages.map(msg => renderContextMessageItem(msg)).join('')}
        ${hasMore ? `<div class="fav-ctx-more">+ 还有 ${messages.length - limit} 条消息</div>` : ''}
    `;
}

/**
 * 渲染完整上下文消息
 */
function renderContextMessagesFull(messages) {
    return messages.map(msg => renderContextMessageItem(msg)).join('');
}

/**
 * 渲染单条上下文消息
 */
function renderContextMessageItem(msg) {
    if (msg.role === 'system' || msg.type === 'system') {
        return `<div class="fav-ctx-system">${escapeHtml(msg.content)}</div>`;
    }
    const isUser = msg.role === 'user';
    const bg = isUser ? '#FFE4EC' : '#E8F2FF';
    const align = isUser ? 'flex-end' : 'flex-start';
    return `
        <div class="fav-ctx-msg" style="justify-content: ${align};">
            <div class="fav-ctx-bubble" style="background: ${bg};">
                <span class="fav-ctx-sender">${escapeHtml(msg.senderName || (isUser ? '我' : 'AI'))}</span>
                <span class="fav-ctx-content">${escapeHtml(msg.content)}</span>
            </div>
        </div>
    `;
}

/**
 * 渲染分类标签
 *
 * ★ v0.36 改造:从 data-action 属性改成 data-app-action 走 framework 派发
 * (此前 data-action 是「孤儿属性」,framework click 委托不识别,只能依赖
 *  index.js 里 inline addEventListener — 那个 listener 在 v-html 重建后
 *  会失效,导致按钮点不了。改走 data-app-action 后由 framework 顶层委托
 *  统一派发,跟 v-html 重建解耦)
 */
function renderCategoryTabs(activeCategory = 'all') {
    return CATEGORIES.map(cat => {
        const isActive = cat.id === activeCategory;
        const actionAttr = `data-app-action='${escapeHtml(JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'switchFavoriteCategory',
            payload: { category: cat.id },
        }))}'`;
        return `
            <button class="fav-category-tab ${isActive ? 'active' : ''}"
                    data-category="${escapeHtml(cat.id)}"
                    ${actionAttr}>
                <span class="fav-tab-icon">${cat.icon}</span>
                <span class="fav-tab-label">${escapeHtml(cat.label)}</span>
            </button>
        `;
    }).join('');
}

/**
 * 渲染收藏列表
 *
 * ★ v0.36 改造:展开状态从外部传入(由 index.js 维护 in-memory state),
 * 避免依赖 inline addEventListener + innerHTML 局部刷新。
 * 切分类时整个 page 重画由 framework detailRenderTick 触发,
 * 这样 v-html 重建不会丢失任何状态(状态在 app 侧,不在 DOM 节点上)。
 *
 * @param {Array} favorites - 收藏列表
 * @param {string} category - 当前分类
 * @param {Object} state - 展开状态 { expandedConv: Set, expandedContext: Set }
 */
function renderFavoriteList(favorites, category = 'all', state = {}) {
    const expandedConv = state.expandedConv instanceof Set
        ? state.expandedConv
        : new Set(Array.isArray(state.expandedConv) ? state.expandedConv : []);
    const expandedContext = state.expandedContext instanceof Set
        ? state.expandedContext
        : new Set(Array.isArray(state.expandedContext) ? state.expandedContext : []);
    if (favorites.length === 0) {
        const label = category === 'all' ? '对话片段' : getTypeLabel(category);
        return `
            <div class="fav-empty">
                <div class="fav-empty-icon">${ICON_STAR_OUTLINE}</div>
                <div class="fav-empty-text">暂无${label}收藏</div>
            </div>
        `;
    }

    const showConversation = category === 'all';
    return favorites.map(item => {
        const favId = item.id || item.favoriteId;
        if (showConversation) {
            // 全部分类:渲染对话片段
            return renderConversationItem(item, expandedConv.has(favId));
        } else {
            // 其他分类:渲染单条收藏
            return renderFavoriteItem(item, expandedContext.has(favId));
        }
    }).join('');
}

/**
 * 统计各分类数量
 * @param {Array} favorites - 所有收藏
 * @param {Object} options - 选项
 * @param {string} options.contactId - 可选,筛选特定联系人
 * @param {string} options.sourceType - 可选,'private' 或 'group'
 */
function countByCategory(favorites, options = {}) {
    const { contactId, sourceType } = options;

    // 先过滤
    let filtered = favorites;
    if (contactId && sourceType) {
        filtered = favorites.filter(f =>
            f.sourceType === sourceType && (
                f.sourceId === contactId ||
                f.aiPersonId === contactId
            )
        );
    }

    // 全部:只统计对话片段
    const conversationCount = filtered.filter(f => f.type === 'conversation').length;

    // 单条收藏:按类型统计
    const singleCounts = { all: conversationCount };
    CATEGORIES.forEach(cat => {
        if (cat.id !== 'all') {
            singleCounts[cat.id] = filtered.filter(f => f.type === cat.id).length;
        }
    });

    return singleCounts;
}

// ─── 主渲染函数 ───────────────────────────────────────────

/**
 * 渲染收藏详情页
 *
 * ★ v0.36 改造:state 参数(分类 / 搜索 keyword / 展开状态)从外部传入,
 * 而不是依赖 inline addEventListener。methods 改 state 后通过
 * __detailRenderTick.value++ 触发 framework 重画整页,
 * 这样 v-html 重建不会丢失任何状态(状态在 app 侧,不在 DOM 节点上)。
 *
 * @param {Object} app
 * @param {Object} options - 可选配置
 * @param {string} options.initialCategory - 初始显示的分类
 * @param {string} options.contactId - 可选，筛选特定联系人的收藏
 * @param {string} options.sourceType - 可选，'private' 或 'group'
 * @param {string} options.sourceName - 可选，联系人或群名称
 * @param {Array} [options.realFavorites] - 真实收藏数据(sdk.chatFavorites.list),会与 DEMO_FAVORITES 合并
 * @param {Object} [options.state] - 当前 in-memory 状态(由 chat-app methods 维护)
 * @param {string} [options.state.category] - 当前激活分类
 * @param {string} [options.state.searchKeyword] - 搜索关键词
 * @param {Set|Array} [options.state.expandedConv] - 已展开的对话片段 ID
 * @param {Set|Array} [options.state.expandedContext] - 已展开的上下文 ID
 */
export function renderFavoritesPage(app, options = {}) {
    const state = options.state || {};
    const initialCategory = state.category || options?.initialCategory || 'all';
    const searchKeyword = state.searchKeyword || '';
    const contactId = options?.contactId;
    const sourceType = options?.sourceType;
    const sourceName = options?.sourceName;
    const realFavorites = Array.isArray(options.realFavorites) ? options.realFavorites : [];

    // ★ v0.44 修复:收藏数据来源
    //   favoriteMessage 写入 sdk.chatFavorites(单条收藏,id=fav-xxx),
    //   favoriteMulti 写入 app.state._conversationFavorites(对话片段,id=conv-xxx),
    //   两者合并后还需要跟 DEMO_FAVORITES 合并(兜底演示数据)
    //   合并策略:用 id 或 favoriteId 作为唯一标识去重
    const getFavKey = f => f.id || f.favoriteId || '';
    const seen = new Set(realFavorites.map(getFavKey));
    const mergedFavorites = [
        ...realFavorites,
        ...DEMO_FAVORITES.filter(f => !seen.has(getFavKey(f))),
    ];

    // 根据筛选条件过滤收藏
    let filteredFavorites = mergedFavorites;
    if (contactId && sourceType) {
        // ★ v0.44 修复:必须从 mergedFavorites 过滤,不能只读 DEMO_FAVORITES
        //   真实收藏(sourceId=undefined)用 aiPersonId 匹配,DEMO 用 sourceId 匹配
        filteredFavorites = mergedFavorites.filter(f =>
            f.sourceType === sourceType && (
                f.sourceId === contactId ||
                f.aiPersonId === contactId
            )
        );
    }

    // ★ v0.36 应用搜索 keyword(本地 in-memory,跟 db 解耦)
    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        filteredFavorites = filteredFavorites.filter(f => {
            const haystack = [
                f.sourceName,
                f.senderName,
                f.content,
                f.summary,
                f.locationName,
                f.locationAddress,
                f.gameTitle,
                f.firstMessage,
                ...(Array.isArray(f.messages) ? f.messages.map(m => m.content) : []),
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(kw);
        });
    }

    const categoryCounts = countByCategory(filteredFavorites, { contactId, sourceType });
    const totalCount = categoryCounts.all;

    const categoryTabsHtml = renderCategoryTabs(initialCategory);

    // 根据分类过滤
    let filteredByCategory;
    if (initialCategory === 'all') {
        // 全部:只显示对话片段
        filteredByCategory = filteredFavorites.filter(f => f.type === 'conversation');
    } else {
        // 其他分类:显示对应类型的单条收藏
        filteredByCategory = filteredFavorites.filter(f => f.type === initialCategory);
    }

    const favoriteListHtml = renderFavoriteList(filteredByCategory, initialCategory, state);

    // 页面标题
    const pageTitle = sourceName
        ? `${escapeHtml(sourceName)}的收藏`
        : '收藏';

    // 如果是特定联系人的收藏,显示来源提示
    const sourceHint = sourceName
        ? `<div class="fav-source-hint">
            <span class="fav-source-icon">${sourceType === 'group' ? ICON_GROUP : ICON_PRIVATE}</span>
            <span>查看 ${escapeHtml(sourceName)} 的收藏</span>
           </div>`
        : '';

    return `
        <div class="chat-favorites" data-current-category="${escapeHtml(initialCategory)}" data-contact-id="${escapeHtml(contactId || '')}" data-source-type="${escapeHtml(sourceType || '')}">
            <div class="chat-favorites-topbar">
                <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' aria-label="返回">
                    ${ICON_BACK}
                </button>
                <h1>${pageTitle}</h1>
                <span class="chat-favorites-topbar-spacer"></span>
            </div>

            <div class="chat-favorites-scroll">
                ${sourceHint}

                <!-- 搜索框(input 事件由 window 级委托捕获,见 chat-app/index.js) -->
                <div class="chat-favorites-search">
                    ${ICON_SEARCH}
                    <input type="search" placeholder="搜索收藏内容" aria-label="搜索收藏内容"
                           data-favorites-search
                           data-app-search
                           value="${escapeHtml(searchKeyword)}">
                </div>

                <!-- 收藏统计 -->
                <div class="chat-favorites-summary">
                    <div class="chat-favorites-summary-icon">${ICON_STAR}</div>
                    <div>
                        <strong>我的收藏</strong>
                        <span>${totalCount} 个对话片段 · ${filteredFavorites.filter(f => f.type !== 'conversation').length} 条单项收藏</span>
                    </div>
                </div>

                <!-- 分类标签 -->
                <div class="fav-category-tabs" data-favorites-tabs>
                    ${categoryTabsHtml}
                </div>

                <!-- 列表标题 -->
                <div class="chat-favorites-section-title">
                    ${initialCategory === 'all' ? '收藏的对话片段' : `${getTypeLabel(initialCategory)}收藏`}
                </div>

                <!-- 收藏列表 -->
                <div class="chat-favorites-list">
                    ${favoriteListHtml}
                </div>
            </div>
        </div>
    `;
}

export default renderFavoritesPage;
