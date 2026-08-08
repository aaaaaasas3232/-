/**
 * chat-app / 私聊详情页
 *
 * Phase 11 页面 UI 复原
 *
 * 功能:
 *   - 顶部 header (返回 + 头像 + 名字 + 状态 + 更多)
 *   - 消息气泡列表 (用户/AI/系统消息)
 *   - 回复预览区
 *   - 输入区域 (输入框 + 工具栏)
 *
 *  v0.49 表情包库绑定贯通:
 *   - renderEmojiPickerPanel 渲染 picker DOM 到 chat-private 末尾
 *   - data-emoji-open="1" 切显隐(emojiBtn toggle)
 *   - 工具栏「表情」按钮删除,替换为「自定义」占位
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderMessage, renderMessageList, renderVoiceBubble } from '../components/message-renderer.js';
import { renderEmojiPickerPanel, _fillEmojiPickerImages } from '../components/emoji-picker-panel.js';
import { chatModalManager } from '../components/chat-modal-registry.js';
import { getAiMeta, resolveContactDisplay } from '../aiMeta.js';

/**
 * 把带前缀的 chatBackground 值转成 CSS 值（chat-page 私聊页专用）
 * 输入: 'color:#E8F2FF' / 'gradient:linear-gradient(...)' / 'image:url/dataURL' / ''
 * 输出: 可直接塞进 style="background: ...; background-image: ..." 的字符串
 *
 * 注意:对 url(...)里的引号做转义,避免破坏外层 style 属性
 */
function chatBackgroundToStyle(value) {
    if (!value) return '';
    if (value.startsWith('color:')) {
        const hex = value.slice('color:'.length);
        return `background-color: ${hex}; background-image: none;`;
    }
    if (value.startsWith('gradient:')) {
        const grad = value.slice('gradient:'.length);
        return `background: ${grad}; background-image: ${grad};`;
    }
    if (value.startsWith('image:')) {
        const url = value.slice('image:'.length);
        // 把 url 里的 " 转义掉
        const safeUrl = url.replace(/"/g, '\\"');
        return `background-image: url("${safeUrl}"); background-color: #F8F9FA; background-size: cover; background-position: center; background-repeat: no-repeat;`;
    }
    // 兼容旧版无前缀 = 当 image 处理
    const safeUrl = value.replace(/"/g, '\\"');
    return `background-image: url("${safeUrl}"); background-color: #F8F9FA; background-size: cover; background-position: center; background-repeat: no-repeat;`;
}

/**
 * 判断消息是否为今天的消息
 * @param {Object} msg - 消息对象
 * @returns {boolean}
 */
function isTodayMessage(msg) {
    if (!msg) return false;
    
    // 有时间戳的消息
    if (msg.timestamp) {
        const msgDate = new Date(Number(msg.timestamp));
        const today = new Date();
        return msgDate.toDateString() === today.toDateString();
    }
    
    // 对于 system 类型的日期分割线，通过内容判断
    if (msg.type === 'system' && msg.content) {
        const content = msg.content;
        // 格式: "今天 HH:MM" / "昨天 HH:MM" / "MM/DD HH:MM" / "1天前" 等
        if (content.startsWith('今天')) return true;
        if (content.startsWith('昨天')) return false;
        // "1天前" / "2天前" 等表示非今天
        if (/^\d+天前/.test(content)) return false;
        // 尝试解析日期
        const match = content.match(/^(\d{1,2})\/(\d{1,2})/);
        if (match) {
            const month = parseInt(match[1]);
            const day = parseInt(match[2]);
            const today = new Date();
            return month === today.getMonth() + 1 && day === today.getDate();
        }
    }
    
    return false;
}

/**
 * 过滤消息列表，只保留当天的消息和当天的日期分割线
 * @param {Array} messages - 原始消息数组
 * @returns {Array} 过滤后的消息数组
 */
function filterTodayMessages(messages) {
    if (!Array.isArray(messages)) return [];
    
    const result = [];
    let seenTodayDivider = false;
    
    for (const msg of messages) {
        // 日期分割线(system 类型)
        if (msg.type === 'system') {
            const content = msg.content || '';
            
            // 如果是当天的分割线，保留并标记
            if (content.startsWith('今天') && !seenTodayDivider) {
                result.push(msg);
                seenTodayDivider = true;
            }
            // 如果是"昨天"或更早的分割线，保留但不影响是否已见当天
            else if (content.startsWith('昨天') || /^\d+天前/.test(content)) {
                result.push(msg);
            }
            // 尝试解析日期格式 "MM/DD HH:MM"
            else {
                const match = content.match(/^(\d{1,2})\/(\d{1,2})/);
                if (match) {
                    const month = parseInt(match[1]);
                    const day = parseInt(match[2]);
                    const today = new Date();
                    if (month === today.getMonth() + 1 && day === today.getDate()) {
                        if (!seenTodayDivider) {
                            result.push(msg);
                            seenTodayDivider = true;
                        }
                    } else {
                        // 非今天的日期分割线也保留，用于显示日期
                        result.push(msg);
                    }
                }
            }
        } 
        // 普通消息，如果是当天的就保留
        else if (isTodayMessage(msg)) {
            // 如果还没见过当天的分割线，但消息是今天的，可能消息比分割线更早出现
            // 此时在消息前插入一个"今天"的分割线
            if (!seenTodayDivider) {
                result.push({
                    id: 'today-divider-' + Date.now(),
                    type: 'system',
                    content: '今天'
                });
                seenTodayDivider = true;
            }
            result.push(msg);
        }
        // 非今天的普通消息不保留
    }
    
    return result;
}

/**
 * 把 timestamp 转成 HH:MM 格式的显示字符串。
 *  - 今天的: HH:MM
 *  - 昨天的: "昨天 HH:MM"
 *  - 早于昨天的: "MM/DD HH:MM"
 * 用来补 msg.time 字段(text-bubble.js / renderMessageActions 都读 msg.time)。
 */
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (sameDay) return `${hh}:${mm}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hh}:${mm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/**
 * 把 SDK 消息记录规范成 renderMessageList 期望的形状:
 *  - 补 time 字段(从 timestamp 算出)
 *  - 补 senderName(AI 消息用 aiPerson.name,user 消息用 defaultUser.name)
 *  - 兼容 DEMO_MESSAGES 静态字段(msg.time 已经存在就直接保留)
 */
function normalizeMessages(messages, contact) {
    if (!Array.isArray(messages)) return [];
    return messages.map((m) => {
        if (!m) return m;
        // DEMO_MESSAGES 静态数据已经有完整字段,跳过
        if (m.time && !m.timestamp) return m;
        const ts = Number(m.timestamp) || Date.now();
        const senderName = m.senderName || (
            m.sender === 'user'
                ? (contact?.senderName || '我')
                : (contact?.name || 'AI')
        );
        return {
            ...m,
            id: m.id,
            sender: m.sender || 'user',
            type: m.type || 'text',
            content: m.content || '',
            timestamp: ts,
            time: m.time || formatMessageTime(ts),
            senderName,
        };
    });
}

// Demo 联系人数据
const DEMO_CONTACTS = {
    'ai-1': { id: 'ai-1', name: '小美', type: 'ai', status: 'online', avatar: null },
    'ai-2': { id: 'ai-2', name: '小明', type: 'ai', status: 'online', avatar: null },
    'ai-3': { id: 'ai-3', name: '小蓝', type: 'ai', status: 'offline', avatar: null },
    'ai-4': { id: 'ai-4', name: '小红', type: 'ai', status: 'offline', avatar: null },
    'group-1': { id: 'group-1', name: '游戏群', type: 'group' },
};

// Demo 消息数据
const DEMO_MESSAGES = [
    { id: 'm1', sender: 'ai', senderName: '小美', type: 'text', content: '你好呀！有什么我可以帮你的吗？', time: '14:23' },
    { id: 'm2', sender: 'user', type: 'text', content: '你好小美，我想问一下关于 AI 助手的问题', time: '14:24' },
    { id: 'm3', sender: 'ai', senderName: '小美', type: 'text', content: '当然可以！我是你的 AI 助手小美，可以帮你回答问题、聊天、写作、编程等各种任务。有什么具体想了解的吗？', time: '14:25' },
    { id: 'img-1', sender: 'ai', senderName: '小美', type: 'descriptive_image', imageDescription: '阳光洒在窗台上，一只橘猫正慵懒地躺在毛茸茸的垫子上，眯着眼睛享受午后的温暖时光。背景是淡蓝色的窗帘随风轻摇。', cardColor: '#FFF3E0', textColor: '#FF9800', time: '14:26' },
    { id: 'm4', sender: 'system', type: 'system', content: '今天 14:30' },
    { id: 'img-2', sender: 'user', type: 'descriptive_image', imageDescription: '海边日落的壮丽景色，橙红色的晚霞映照在波光粼粼的海面上，一群海鸥在天空飞翔，远处帆船点点。', cardColor: '#E8F2FF', textColor: '#4A6FA5', time: '14:31' },
    { id: 'm5', sender: 'user', type: 'text', content: '好的，我想了解如何更好地使用 AI 助手', time: '14:32' },
    { id: 'm6', sender: 'ai', senderName: '小美', type: 'text', content: '使用 AI 助手的技巧：\n1. 问清楚具体的问题\n2. 分步骤提问\n3. 可以让我帮你修改润色文章\n4. 代码问题可以发给我帮你 review', time: '14:33' },
    { id: 'm7', sender: 'user', type: 'text', content: '太棒了！谢谢小美', time: '14:35' },
    { id: 'm8', sender: 'ai', senderName: '小美', type: 'text', content: '不客气~ 有问题随时问我哦！', time: '14:36' },
    { id: 'm9', sender: 'system', type: 'system', content: '今天 18:00' },
    { id: 'm10', sender: 'user', type: 'text', content: '小美，今天晚上有空吗？', time: '18:05' },
    { id: 'm11', sender: 'ai', senderName: '小美', type: 'text', content: '晚上可以呀，怎么了？', time: '18:06' },
    { id: 'm12', sender: 'user', type: 'text', content: '想约你一起看电影', time: '18:08' },
    { id: 'm13', sender: 'ai', senderName: '小美', type: 'text', content: '好呀！看什么类型的电影？', time: '18:10' },
    { id: 'm14', sender: 'user', type: 'text', content: '科幻片怎么样？', time: '18:12' },
    { id: 'm15', sender: 'ai', senderName: '小美', type: 'text', content: '没问题，我最近也超喜欢科幻片的！', time: '18:15' },
    { id: 'm16', sender: 'system', type: 'system', content: '昨天 20:00' },
    { id: 'm17', sender: 'user', type: 'text', content: '小美，昨天看的电影太精彩了！', time: '昨天 20:00' },
    { id: 'm18', sender: 'ai', senderName: '小美', type: 'text', content: '是呀！那段特效太震撼了', time: '昨天 20:05' },
    { id: 'm19', sender: 'user', type: 'text', content: '下次再一起看~', time: '昨天 20:08' },
    { id: 'm20', sender: 'ai', senderName: '小美', type: 'text', content: '好呀！期待下一次~', time: '昨天 20:10' },
    { id: 'm21', sender: 'system', type: 'system', content: '1天前 晚安' },
    { id: 'm22', sender: 'ai', senderName: '小蓝', type: 'text', content: '晚安~', time: '1天前 晚安' },
    { id: 'm23', sender: 'user', type: 'text', content: '早安小美！新的一天开始了', time: '今天 07:30' },
    { id: 'm24', sender: 'ai', senderName: '小美', type: 'text', content: '早安！今天天气真不错呀，感觉心情也变好了呢~', time: '今天 07:32' },
    { id: 'm25', sender: 'user', type: 'text', content: '是啊，感觉今天会有好事发生', time: '今天 07:33' },
    { id: 'm26', sender: 'ai', senderName: '小美', type: 'text', content: '那祝你今天一切顺利哦！有什么计划吗？', time: '今天 07:35' },
    { id: 'm27', sender: 'user', type: 'text', content: '今天要开会，然后下午有个项目要交付', time: '今天 07:36' },
    { id: 'm28', sender: 'ai', senderName: '小美', type: 'text', content: '加油！相信你一定可以顺利完成任务的~', time: '今天 07:38' },
    { id: 'm29', sender: 'system', type: 'system', content: '今天 08:00' },
    { id: 'm30', sender: 'user', type: 'text', content: '对了，晚上要不要一起吃饭？', time: '今天 08:02' },
    { id: 'm31', sender: 'ai', senderName: '小美', type: 'text', content: '好啊！去哪里吃？你选地方~', time: '今天 08:05' },
    { id: 'm32', sender: 'user', type: 'text', content: '上次去的那家日料店怎么样？', time: '今天 08:06' },
    { id: 'm33', sender: 'ai', senderName: '小美', type: 'text', content: '那家很好吃！刺身特别新鲜，就去那里吧~', time: '今天 08:08' },
    { id: 'm34', sender: 'user', type: 'text', content: '好的，那晚上几点见？', time: '今天 08:10' },
    { id: 'm35', sender: 'ai', senderName: '小美', type: 'text', content: '七点怎么样？在老地方见~', time: '今天 08:12' },
    { id: 'm36', sender: 'user', type: 'text', content: '没问题，不见不散！', time: '今天 08:15' },
    { id: 'm37', sender: 'ai', senderName: '小美', type: 'text', content: '嗯嗯，等你哦~ 上班加油！', time: '今天 08:16' },
    { id: 'm38', sender: 'system', type: 'system', content: '今天 09:15' },
    { id: 'm39', sender: 'ai', senderName: '小美', type: 'text', content: '刚才发给你的那个文档看了吗？', time: '今天 09:15' },
    { id: 'm40', sender: 'user', type: 'text', content: '看了，写的很详细，有几个地方想请教一下', time: '今天 09:20' },
    { id: 'm41', sender: 'ai', senderName: '小美', type: 'text', content: '好的，你说~ 我详细给你讲解', time: '今天 09:22' },
    { id: 'm42', sender: 'user', type: 'text', content: '这个第三段的方案感觉有点复杂，有没有更简单的实现方式？', time: '今天 09:25' },
    { id: 'm43', sender: 'ai', senderName: '小美', type: 'text', content: '其实可以用一个更简单的思路，我给你画个图说明一下...', time: '今天 09:28' },
    { id: 'm44', sender: 'user', type: 'text', content: '哇，这样清晰多了！明白了', time: '今天 09:30' },
    { id: 'm45', sender: 'ai', senderName: '小美', type: 'text', content: '有问题随时问哦~', time: '今天 09:32' },
    {
        id: 'cr-voice-1', sender: 'system', type: 'call_record', time: '今天 14:00',
        callRecord: {
            id: 'cr-voice-1', callType: 'voice', wasConnected: true, duration: 326,
            timestamp: Date.now() - 3 * 3600 * 1000,
            summary: '聊了下周末去哪儿吃饭、推荐了新开的那家日料店,顺便撒娇说最近有点累想休息',
            messages: [
                { role: 'user', content: '小美,周末要不要一起吃饭呀?', time: '14:00' },
                { role: 'ai', content: '好呀!你有什么想吃的吗?上次那家日料店我还挺想再去的~', time: '14:01' },
                { role: 'user', content: '我也正想说那家店呢!晚上七点?', time: '14:02' },
                { role: 'ai', content: '没问题,我订个位~今天有点累,吃完想回家躺一会儿', time: '14:05' },
                { role: 'user', content: '工作辛苦啦,那我请你吃大餐补补', time: '14:10' },
                { role: 'ai', content: '(撒娇)那我要吃三文鱼、烤鳗鱼还有甜虾哦~谢谢老公~', time: '14:12' },
                { role: 'user', content: '都依你', time: '14:14' },
                { role: 'ai', content: '嘻嘻,那我先去忙了,晚上见~', time: '14:15' },
                { role: 'user', content: '好,晚上见', time: '14:16' },
            ],
        },
    },
    {
        id: 'cr-video-1', sender: 'system', type: 'call_record', time: '昨天 21:30',
        callRecord: {
            id: 'cr-video-1', callType: 'video', wasConnected: true, duration: 1825,
            timestamp: Date.now() - 26 * 3600 * 1000,
            summary: '视频看了一下午的旅行照片,讨论了国庆小长假去京都的计划和住宿预算',
            messages: [
                { role: 'user', content: '小美,我把今天的照片整理了一下,视频看看?', time: '21:30' },
                { role: 'ai', content: '好呀!我刚洗完澡等你呢~', time: '21:31' },
                { role: 'user', content: '看这张,在清水寺拍的,光影好好看', time: '21:35' },
                { role: 'ai', content: '哇,这也太美了吧!你看地上的影子~下次我们也去吧?', time: '21:36' },
                { role: 'user', content: '国庆节?正好七天假', time: '21:40' },
                { role: 'ai', content: '太好了!那我们早点订机票和住宿,京都秋天红叶超美的~', time: '21:42' },
                { role: 'user', content: '预算大概多少?机票+酒店', time: '21:46' },
                { role: 'ai', content: '我查了下,人均五六千左右应该够住好一些的町屋了', time: '21:48' },
                { role: 'user', content: '那就这么定了!我去做攻略', time: '21:55' },
                { role: 'ai', content: '辛苦啦~我先去吹头发啦,晚安~', time: '22:00' },
                { role: 'user', content: '晚安,做美梦~', time: '22:01' },
            ],
        },
    },
    { id: 'loc-1', sender: 'ai', senderName: '小美', type: 'location', time: '今天 13:00', locationCard: { name: '上海中心大厦', address: '上海市浦东新区陆家嘴环路 501 号', lat: 31.2335, lng: 121.5054 } },
    { id: 'loc-2', sender: 'user', type: 'location', time: '今天 13:15', locationCard: { name: '那家日料店', address: '上海市黄浦区南京东路 100 号 3 楼', lat: 31.2360, lng: 121.4800 } },
    { id: 'rp-1', sender: 'ai', senderName: '小美', type: 'redpacket', time: '今天 14:00', redpacketCard: { style: 'normal', message: '今天心情好,请你喝奶茶~', opened: false } },
    { id: 'rp-2', sender: 'user', type: 'redpacket', time: '今天 14:30', redpacketCard: { style: 'opened', message: '恭喜发财,大吉大利', opened: true, amount: 88.88 } },
    { id: 'rp-3', sender: 'ai', senderName: '小强', type: 'redpacket', time: '昨天 20:15', redpacketCard: { style: 'expired', message: '生日快乐呀~', opened: false, expired: true } },
    { id: 'rp-4', sender: 'ai', senderName: '群活动', type: 'redpacket', time: '昨天 19:00', redpacketCard: { style: 'cover', coverTitle: '口令红包', coverSubtitle: '发送口令领取', message: '大吉大利', opened: false } },
    { id: 'transfer-1', sender: 'ai', senderName: '老王', type: 'transfer', time: '今天 10:30', transferCard: { amount: 200.00, note: '还款', received: false } },
    { id: 'transfer-2', sender: 'user', type: 'transfer', time: '今天 10:35', transferCard: { amount: 500.00, note: '房租', received: true } },
];

// 渲染工具栏按钮
function renderToolbarButton(action, label, iconSvg) {
    return `
        <button class="toolbar-btn" data-action="${escapeHtml(action)}">
            <div class="toolbar-btn-icon">
                ${iconSvg}
            </div>
            <span class="toolbar-btn-label">${escapeHtml(label)}</span>
        </button>
    `;
}

/**
 * 渲染私聊详情页（v0.27 user 字段存储）
 *
 *   pageId 格式: `private-<aiPersonId>-<mode>`
 *   contactId 参数 = `private-<aiPersonId>-${mode}` 拦截剩下的部分
 *   解析得到 aiPersonId + mode,从 sdk.chatFriends 读取对应 entry。
 *
 *   兼容:contactId 仍可能传旧的副本 id,先尝试 parse 失败再 fallback DEMO_CONTACTS。
 */
export function renderPrivateChatPage(app, contactId) {
    let contact = { id: contactId, name: '未知联系人', status: 'offline', type: 'ai' };

    // v0.28 解析 pageId: 'private-{aiPersonId}-{mode}'
    let aiPersonId = contactId;
    let mode = 'calendar';
    // 先去掉 private- 前缀
    const withoutPrivate = contactId.startsWith('private-')
        ? contactId.slice('private-'.length)
        : contactId;
    const lastDash = withoutPrivate.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = withoutPrivate.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            mode = tail;
            aiPersonId = withoutPrivate.slice(0, lastDash);
        }
    }

    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
        const entry = (sdk && defaultUser)
            ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode)
            : null;
        if (entry) {
            // ★ v0.31 实时读 aiPerson.socialProfiles.chat.*(网名/头像/背景),
            //   故事模式和日历模式都用同一个 aiPerson 数据。
            //   备注(remark)优先于社媒名(per-mode 字段,排在最外)。
            const display = resolveContactDisplay(entry, aiPersonId);
            contact = {
                ...contact,
                id: aiPersonId,
                name: display.nickname,
                // ★ v0.31 实时 avatar / avatarBg(原本是 entry 快照,改为 aiPerson 实时)
                avatar: display.avatar,
                avatarBg: display.avatarBg,
                aiPersonId: entry.aiPersonId,
                recordMode: entry.recordMode || mode,
                remark: entry.remark || '',
                chatBackground: entry.chatBackground || '', // 聊天背景 per-mode 保留 entry 快照
                status: 'online',
            };
        } else {
            // 兜底:DEMO_CONTACTS(老路径)
            const legacy = DEMO_CONTACTS[contactId];
            if (legacy) contact = legacy;
        }
    } catch (_) {}

    const statusText = contact.status === 'online' ? '在线' : '离线';
    const statusColor = contact.status === 'online' ? '#4CAF50' : '#999';

    // ★ v0.30 加载真实消息:SDK 就绪时从 chatMessages 拉消息,否则用 DEMO_MESSAGES
    //   - 真实消息需要补 time / senderName 字段(demo 已有)
    //   - DEMO_MESSAGES 静态数据留着做冷启动 fallback + 老路径兼容
    let messages = DEMO_MESSAGES;
    try {
        const sdk = window.settingsSdk;
        // ★ LOG-4: renderPrivateChatPage 读消息前
        console.log('[LOG-4][renderPrivate] contactId=', contactId, 'aiPersonId=', aiPersonId, 'mode=', mode, 'sdk?=', !!sdk, 'chatMessages?=', !!sdk?.chatMessages, 'cacheMapSize=', sdk?.chatMessages?._cacheSize?.() ?? 'N/A');
        if (sdk?.chatMessages?.list) {
            const realMessages = sdk.chatMessages.list(null, aiPersonId, mode);
            // ★ LOG-5: 读到消息后
            console.log('[LOG-5][renderPrivate] realMessages.length=', realMessages?.length, 'using real?=', Array.isArray(realMessages) && realMessages.length > 0, 'types=', realMessages?.slice(-5).map(m => m.type).join(','));
            if (Array.isArray(realMessages) && realMessages.length > 0) {
                messages = realMessages;
            }
        }
    } catch (err) {
        console.warn('[chat-page] load real messages failed, fallback to DEMO:', err);
    }

    // ★ v0.61.8 过滤消息列表:只显示当天的消息,隐藏之前的聊天记录
    //   - 按日期过滤，保留当天的消息和日期分割线
    //   - 让用户只能看到今天的聊天内容
    messages = filterTodayMessages(messages);

    // ★ v0.61.4 自动归档:fire-and-forget 把当天以前的消息搬到 chatArchiveMessages
    //   - 不阻塞 renderPage 返回(archive 是 async,后台执行)
    //   - archive() 内部已经从 chatMessages.cache / db 删掉旧消息
    //   - 完成后只通知灵动岛提示,不触发 tick++(v0.38 syncRenderer 死循环温床)
    //     改用 framework 暴露的 syncNow({ force: true }) 触发整页重画
    try {
        const sdk = window.settingsSdk;
        if (sdk?.chatArchive?.archive) {
            sdk.chatArchive.archive(aiPersonId, mode, {
                now: Date.now(),
                conversationType: 'private',
            }).then((res) => {
                if (res && res.archivedCount > 0) {
                    const daySummary = Object.entries(res.byDay || {})
                        .map(([d, n]) => `${d} ${n}条`).join('、');
                    try {
                        window.__phoneIsland?.notify?.('info',
                            `已归档 ${res.archivedCount} 条历史消息`,
                            daySummary || '');
                    } catch (_) {}
                    // ★ 不用 ++tick / invalidateRendererCache(走 v0.38 syncRenderer 死循环温床),
                    //   改用 framework 暴露的 syncNow({ force: true }) 触发整页重画
                    try {
                        window.__appRendererBridge?.syncNow?.({ force: true });
                    } catch (_) {}
                }
            }).catch((err) => {
                console.warn('[chat-page] archive pass failed', err);
            });
        }
    } catch (_) {}

    // ★ v0.61.3 滚动摘要 K 链压缩(异步,fire-and-forget,不阻塞 renderPage)
    //   - 用户在 chat-settings 配置的 contextRounds + rollingEnabled 决定是否触发
    //   - 压缩成功时只通知灵动岛,不自动重画(避免死循环)
    try {
        const sdk = window.settingsSdk;
        if (sdk?.rollingSummaries?.compressIfNeeded) {
            const cfg = sdk.rollingSummaries.getRollingConfig?.(aiPersonId);
            if (cfg?.enabled) {
                sdk.rollingSummaries.compressIfNeeded(aiPersonId, mode, messages, {
                    contextRounds: cfg.contextRounds,
                    kMergeSize: cfg.kMergeSize,
                    maxChainLength: cfg.maxChainLength,
                }).then((res) => {
                    if (res?.compressed) {
                        try {
                            window.__phoneIsland?.notify?.('info',
                                '已生成滚动摘要',
                                `K 链现有 ${res.chainLength} 个 K`);
                        } catch (_) {}
                    }
                }).catch((err) => {
                    console.warn('[chat-page] rolling compress failed', err);
                });
            }
        }
    } catch (_) {}

    // 使用组件系统渲染消息列表
    // ★ v0.32 userAvatar / userAvatarBg:从 SDK 拿当前 user 社媒头像,
    //   让用户消息气泡(self avatar)也用真实头像,不再是固定「我」+ #F4A6CD
    let userAvatar = '';
    let userAvatarBg = '';
    try {
        const sdk = window.settingsSdk;
        if (sdk?.users?.getActive) {
            const activeUser = sdk.users.getActive();
            if (activeUser) {
                const chatProfile = activeUser.socialProfiles?.chat || {};
                userAvatar = chatProfile.avatar || activeUser.avatar || '';
                userAvatarBg = chatProfile.avatarBg || activeUser.avatarBg || '';
            }
        }
    } catch (_) {}
    const messageListHtml = renderMessageList(
        normalizeMessages(messages, contact),
        contact,
        { userAvatar, userAvatarBg, aiPersonId, mode }
    );

    // ★ v0.43 读取 chat action state(replyingTo / multiSelectActive / selectedMessages)
    //   用于动态渲染 reply-preview + 多选 toolbar 激活态
    let replyingTo = null;
    let multiSelectActive = false;
    let selectedCount = 0;
    try {
        const state = app?.state?.chat?.action;
        if (state) {
            replyingTo = state.replyingTo || null;
            multiSelectActive = !!state.multiSelectActive;
            if (state.selectedMessages && state.selectedMessages.size) {
                // 只算当前 (aiPersonId, mode) 对应的 key
                const prefix = `${aiPersonId}::${mode}::`;
                state.selectedMessages.forEach((k) => { if (k.startsWith(prefix)) selectedCount++; });
            }
        }
    } catch (_) {}
    const replyPreviewHtml = replyingTo
        ? (() => {
            const label = replyingTo.senderLabel || (replyingTo.sender === 'user' ? '我' : contact.name || aiPersonId);
            const txt = String(replyingTo.text || '').slice(0, 60);
            // ★ v0.44 修复:添加 active 类让 CSS 显示块生效(默认 .reply-preview 是 display:none)
            return `
            <div class="reply-preview active" id="replyPreview">
                <div class="reply-preview-content">
                    <svg class="reply-quote-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="2" style="vertical-align:middle;margin-right:4px;flex-shrink:0;">
                        <path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
                    </svg>
                    <span class="reply-preview-text" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">回复 <strong>${escapeHtml(label)}</strong>:${escapeHtml(txt)}</span>
                    <button class="cancel-reply-btn" type="button"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"cancelReply"}'
                        style="width:20px;height:20px;background:#F0F0F0;border:none;color:#8E8E8E;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:8px;font-size:12px;">×</button>
                </div>
            </div>`;
        })()
        : '';
    const replyPreviewStyle = replyingTo ? '' : ' style="display:none"';
    const multiSelectBarStyle = multiSelectActive ? '' : ' style="display:none"';

    // ★ v0.49 表情面板开关:读取 app.state.chat.emojiOpen,挂到 .chat-private 的 data-emoji-open 属性
    //   CSS 选择器 [data-emoji-open="1"] 切显隐 — 不靠 v-html 重画
    let emojiOpen = false;
    try {
        emojiOpen = !!(app?.state?.chat?.emojiOpen);
    } catch (_) {}
    const chatPrivateClass = `chat-private chat-${mode}${multiSelectActive ? ' multi-select-mode' : ''}`;
    const chatPrivateDataEmoji = emojiOpen ? ' data-emoji-open="1"' : '';

    // 工具栏按钮 SVG
    const toolbarButtons = `
        ${renderToolbarButton('image', '图片', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('voice', '语音', '<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('custom', '自定义', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="9" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>')}
        ${renderToolbarButton('location', '位置', '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('redpacket', '红包', '<svg viewBox="0 0 24 24"><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12h16v-2a2 2 0 0 0-4-2H8a2 2 0 0 0-4 2v2z" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('transfer', '转账', '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8m-4-4h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>')}
        ${renderToolbarButton('call', '通话', '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('favorite', '收藏', '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
    `;

    const bgAttr = contact.chatBackground
        ? ` data-chat-bg="1" style="${chatBackgroundToStyle(contact.chatBackground).replace(/"/g, '&quot;')}"`
        : '';

    // ★ v0.33 把当前消息列表写到 dataset.rawMessages(JSON 字符串),
    //   让 chat-forward.js 能从 DOM 抓出来作为「被转发消息」的原始数据。
    //   容量有限(消息很多会让 attribute 变大),只存最近 100 条 + 关键字段。
    // ★ v0.67 扩 compact 字段:保留 redpacketCard / transferCard 字段,
    //   让 .redpacket-card / .transfer-card 点击 handler 能从 DOM 拿完整信息。
    const compactMessages = messages.slice(-100).map((m) => ({
        id: m.id,
        sender: m.sender,
        senderId: m.senderId || '',
        senderName: m.senderName || '',
        type: m.type || 'text',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: m.timestamp || Date.now(),
        redpacketCard: m.redpacketCard || null,
        transferCard: m.transferCard || null,
    }));
    const rawMessagesAttr = ` data-raw-messages="${escapeHtml(JSON.stringify(compactMessages))}"`;

    return `
        <div class="${chatPrivateClass}" data-contact-id="${escapeHtml(contactId)}" data-mode="${escapeHtml(mode)}" data-conversation-type="private" data-conversation-id="${escapeHtml(aiPersonId)}" data-conversation-name="${escapeHtml(contact.name)}"${bgAttr}${rawMessagesAttr}${chatPrivateDataEmoji}>
            <!-- 顶部栏 -->
            <div class="chat-header">
                <div class="chat-header-left">
                    <button class="chat-back-btn" id="chatBackBtn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                        <svg viewBox="0 0 24 24">
                            <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <div class="chat-header-avatar" style="background: ${escapeHtml(contact.avatarBg || '#A8C8EC')};">
                        ${contact.avatar
                            ? `<img src="${escapeHtml(contact.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
                            : escapeHtml((contact.name || '?').charAt(0))}
                    </div>
                    <div class="chat-header-info">
                        <div class="chat-header-name">${escapeHtml(contact.name)}</div>
                        <div class="chat-header-status" data-status="${contact.status}">
                            <span class="status-dot" style="background: ${statusColor};"></span>
                            ${escapeHtml(statusText)}
                        </div>
                    </div>
                </div>
            <div class="chat-header-right">
                    <div class="header-actions">
                        <button class="header-btn"
                            data-app-action='{"action":"appMethod","appId":"chat","method":"triggerVoiceCall"}'
                            title="语音通话">
                            <svg viewBox="0 0 24 24">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="header-btn"
                            data-app-action='{"action":"appMethod","appId":"chat","method":"triggerVideoCall"}'
                            title="视频通话">
                            <svg viewBox="0 0 24 24">
                                <polygon points="23 7 16 12 23 17 23 7" fill="none" stroke="currentColor" stroke-width="2"/>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="header-btn"
                            data-app-action='{"action":"appMethod","appId":"chat","method":"toggleMultiSelect","payload":{"aiPersonId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}"}}'
                            title="多选">
                            <svg viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="header-btn" data-app-action='{"action":"detail","appId":"chat","pageId":"chat-settings-${escapeHtml(aiPersonId)}-${escapeHtml(mode)}"}' title="更多">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="1"/>
                                <circle cx="19" cy="12" r="1"/>
                                <circle cx="5" cy="12" r="1"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 多选模式浮层 -->
            <div class="multi-select-bar" aria-label="多选操作"${multiSelectBarStyle}>
                <span class="multi-select-count">已选 <strong data-selected-count>${selectedCount}</strong> 条</span>
                <div class="multi-select-actions">
                    <button class="multi-select-action" type="button"
                        data-app-action="${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'favoriteMulti', payload: { aiPersonId, mode } }))}"
                        title="收藏">收藏</button>
                    <button class="multi-select-action" type="button"
                        data-app-action="${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'forwardMulti', payload: { aiPersonId, mode } }))}"
                        title="转发">转发</button>
                    <button class="multi-select-action multi-select-action--danger" type="button"
                        data-app-action="${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'deleteMulti', payload: { aiPersonId, mode } }))}"
                        title="删除">删除</button>
                    <button class="multi-select-cancel" type="button"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"exitMultiSelect"}'>取消</button>
                </div>
            </div>

            <!-- 消息列表 -->
            <div class="chat-messages">
                ${messageListHtml}
            </div>

            <!-- 回复预览 -->
            ${replyPreviewHtml}
            <!-- /reply-preview 静态占位(v0.43 已改为动态 ${replyPreviewHtml}) -->
            <div id="replyPreviewStatic"${replyPreviewStyle} hidden></div>

            <!-- 输入区域 -->
            <div class="input-container">
                <button class="expand-toolbar-btn" id="expandToolbarBtn" type="button" aria-label="展开聊天工具" aria-expanded="false">
                    <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
                    </svg>
                </button>

                <div class="input-wrapper">
                    <div class="message-input" contenteditable="true" data-placeholder="输入消息..." id="messageInput"></div>
                    <button class="emoji-btn" id="emojiBtn">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>

                <button class="send-btn" id="sendBtn">
                    <svg viewBox="0 0 24 24">
                        <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor"/>
                    </svg>
                </button>
            </div>

            <!-- 工具组 -->
            <div class="input-toolbar" id="inputToolbar">
                <div class="toolbar-content">
                    <div class="toolbar-grid">
                        ${toolbarButtons}
                    </div>
                </div>
            </div>

            <!-- ★ v0.49 表情选择器面板 (与工具组同级,data-emoji-open 控制显隐) -->
            ${renderEmojiPickerHtml(aiPersonId)}
        </div>
    `;
}

/**
 * ★ v0.49 渲染表情选择器面板 HTML
 *   - 同步返回字符串(v-html 上下文)
 *   - 缩略图异步填充:由 initPrivateChatInteractions 在 DOM 出现后调 _fillEmojiPickerImages
 *
 * @param {string} aiPersonId 当前对话 AI 人设 id (仅用于调试,实际读 user persona 的 stickerGroupIds)
 */
function renderEmojiPickerHtml(aiPersonId) {
    let stickerGroupIds = [];
    try {
        const sdk = window.settingsSdk;
        const activeUser = sdk?.users?.getActive?.();
        if (activeUser) {
            const bound = activeUser.boundResources || {};
            stickerGroupIds = Array.isArray(bound.stickerGroupIds) ? bound.stickerGroupIds : [];
        }
    } catch (_) {}
    return `<div class="chat-emoji-picker" data-picker-target="${escapeHtml(aiPersonId)}">${renderEmojiPickerPanel({ stickerGroupIds })}</div>`;
}

export default renderPrivateChatPage;

/**
 * 处理私聊页顶栏按钮点击（语音/视频/多选/备注等）
 * @param {string} action - 按钮 action 类型
 * @param {Object} data - 按钮 data 属性数据
 * @param {Object} app - app 实例
 */
export function handlePrivateChatAction(action, data, app) {
    switch (action) {
        case 'remark':
            // 打开备注弹窗
            if (data && data.contactId && data.mode) {
                openAiRemarkModal(data.contactId, data.mode, app);
            }
            break;
        case 'voice-call':
            window.__phoneIsland?.notify?.('info', '语音通话', '即将开放');
            break;
        case 'video-call':
            window.__phoneIsland?.notify?.('info', '视频通话', '即将开放');
            break;
        case 'multiselect':
            window.__phoneIsland?.notify?.('info', '多选模式', '即将开放');
            break;
        default:
            console.warn('[chat] unknown private action:', action);
    }
}

/**
 * 打开 AI 备注弹窗
 * @param {string} contactId - 联系人 ID (aiPersonId)
 * @param {string} mode - 当前模式 'calendar' | 'story'
 * @param {Object} app - app 实例
 */
export function openAiRemarkModal(contactId, mode) {
    const sdk = window.settingsSdk;

    // 解析 contactId: 可能是 'ai0' 或 'ai0::calendar' 格式
    let aiPersonId = contactId;
    let effectiveMode = mode;
    if (contactId && contactId.includes('::')) {
        const parts = contactId.split('::');
        aiPersonId = parts[0];
        effectiveMode = parts[1] || mode || 'calendar';
    }

    console.log('[chat] openAiRemarkModal', { contactId, aiPersonId, mode, effectiveMode });

    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
    const entry = (sdk && defaultUser)
        ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, effectiveMode)
        : null;

    console.log('[chat] openAiRemarkModal entry:', entry);

    const name = entry?.displayName || aiPersonId || '未知联系人';
    const avatarBg = entry?.avatarBg || '#A8C8EC';
    const currentRemark = entry?.remark || '';

    chatModalManager.openAiRemark({
        name,
        avatarBg,
        remark: currentRemark,
        mode: effectiveMode,
        onSave: async (remarkText) => {
            console.log('[chat] AiRemarkModal onSave called, remarkText:', remarkText);
            // 保存备注到 SDK
            if (sdk && defaultUser) {
                try {
                    console.log('[chat] calling sdk.chatFriends.updateRemark', { aiPersonId, effectiveMode, remarkText });
                    await sdk.chatFriends?.updateRemark?.(sdk, defaultUser, aiPersonId, effectiveMode, remarkText);
                    console.log('[chat] updateRemark completed');
                    window.__phoneIsland?.notify?.('success', '备注已保存', remarkText ? `「${remarkText.slice(0, 20)}...」` : '已清空备注');
                } catch (err) {
                    console.error('[chat] save remark failed:', err);
                    window.__phoneIsland?.notify?.('error', '保存失败', '请重试');
                }
            } else {
                window.__phoneIsland?.notify?.('success', '备注已保存', '（Demo 模式）');
            }
        },
        onClose: () => {
            console.log('[chat] AiRemarkModal onClose called');
            // 关闭后刷新聊天设置页和私聊页显示最新备注名
            setTimeout(() => {
                // 刷新聊天设置页
                if (typeof window.__detailRenderTick !== 'undefined') {
                    window.__detailRenderTick.value++;
                }
                // 通知聊天页刷新联系人名称
                document.dispatchEvent(new CustomEvent('chat:remark-updated', {
                    detail: { contactId: aiPersonId, mode: effectiveMode }
                }));
            }, 100);
        },
    });
}

/**
 * 从 DEMO_MESSAGES 里反查一条通话记录
 */
export function findDemoCallRecordById(callRecordId) {
    for (const msg of DEMO_MESSAGES) {
        if (msg.type === 'call_record' && msg.callRecord && msg.callRecord.id === callRecordId) {
            return msg.callRecord;
        }
    }
    return null;
}

/**
 * 拍一拍:在私聊页注入一条居中提示气泡
 *
 *  - 文案来源:user/AI 的 patSetting(socialProfiles.chat.patSetting)
 *  - 由 chat-page 内部维护一段「拍一拍」气泡模板(没有边框和底色,也没有头像占位),
 *    后续注入 DOM 直接 append 到 .chat-messages
 *  - 仅针对「私聊页」(chatPrivate)有效;群聊目前不做
 *
 * @param {HTMLElement} chatPrivate - 私聊容器 .chat-private
 * @param {string} [from] - 谁发起拍一拍:'user' = 用户拍 AI;'ai' = AI 拍用户。默认 'user'(双击 AI 头像)
 * @returns {boolean} - true 表示成功注入,false 表示环境不满足
 *
 * ★ v0.45:改为 async，持久化拍一拍消息到 IndexedDB
 * ★ v0.61.9:from 参数区分双击用户头像/双击 AI 头像,只生成对应方向的 1 条气泡
 */
export async function triggerPatAction(chatPrivate, from = 'user') {
    if (!chatPrivate) return false;
    try {
        const sdk = window.settingsSdk;
        const contactId = chatPrivate.dataset.contactId || '';
        const mode = chatPrivate.dataset.mode || 'calendar';

        // 解析 aiPersonId（contactId 可能是 ai0 或旧格式 ai-1 或 private-xxx-mode）
        let aiPersonId = contactId;
        const withoutPrivate = contactId.startsWith('private-')
            ? contactId.slice('private-'.length)
            : contactId;
        const lastDash = withoutPrivate.lastIndexOf('-');
        if (lastDash > 0 && (withoutPrivate.slice(lastDash + 1) === 'calendar' || withoutPrivate.slice(lastDash + 1) === 'story')) {
            aiPersonId = withoutPrivate.slice(0, lastDash);
        }

        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        const userPat = defaultUser?.patSetting
            || sdk?.users?.get?.(defaultUser?.id)?.patSetting
            || '拍了拍我';
        let aiPerson = null;
        try {
            aiPerson = sdk?.aiPersons?.get?.(aiPersonId);
            if (!aiPerson && sdk?.aiPersons?.list) {
                aiPerson = sdk.aiPersons.list().find((p) => p.id === aiPersonId) || null;
            }
        } catch (_) {}
        const aiPat = aiPerson?.socialProfiles?.chat?.patSetting
            || aiPerson?.patSetting
            || '拍了拍我';

        const messagesContainer = chatPrivate.querySelector('.chat-messages');
        if (!messagesContainer) return false;

        const now = Date.now();
        const userNick = escapeHtml(defaultUser?.socialProfiles?.chat?.nickname || defaultUser?.name || '我');
        const aiNick = escapeHtml(aiPerson?.socialProfiles?.chat?.nickname || aiPerson?.name || aiPersonId || '对方');
        const userPatText = escapeHtml(userPat);
        const aiPatText = escapeHtml(aiPat);

        if (from === 'ai') {
            // AI 拍用户
            const aiMsgId = `pat-ai-${now}`;
            if (sdk?.chatMessages?.add && defaultUser) {
                await sdk.chatMessages.add(defaultUser, aiPersonId, mode, {
                    id: aiMsgId,
                    sender: 'ai',
                    senderName: aiNick,
                    type: 'pat',
                    content: `${aiNick} ${aiPatText} ${userNick}`,
                    timestamp: now,
                });
            }
            const aiPatMsg = document.createElement('div');
            aiPatMsg.className = 'message-wrapper pat-bubble pat-from-ai';
            aiPatMsg.innerHTML = `
                <div class="pat-bubble-inner">
                    <div class="pat-bubble-text">
                        <span class="pat-bubble-actor">${aiNick}</span>
                        <span class="pat-bubble-action"> ${aiPatText}</span>
                        <span class="pat-bubble-target"> ${userNick}</span>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(aiPatMsg);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return true;
        }

        // 默认:用户拍 AI
        const userMsgId = `pat-user-${now}`;
        if (sdk?.chatMessages?.add && defaultUser) {
            await sdk.chatMessages.add(defaultUser, aiPersonId, mode, {
                id: userMsgId,
                sender: 'user',
                senderName: userNick,
                type: 'pat',
                content: `${userNick} ${userPatText} ${aiNick}`,
                timestamp: now,
            });
        }

        const userPatMsg = document.createElement('div');
        userPatMsg.className = 'message-wrapper pat-bubble pat-from-user';
        userPatMsg.innerHTML = `
            <div class="pat-bubble-inner">
                <div class="pat-bubble-text">
                    <span class="pat-bubble-actor">${userNick}</span>
                    <span class="pat-bubble-action"> ${userPatText}</span>
                    <span class="pat-bubble-target"> ${aiNick}</span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(userPatMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return true;
    } catch (err) {
        console.warn('[chat-page] triggerPatAction failed:', err);
        return false;
    }
}

// 导出组件引用供外部使用
export { renderMessage, renderVoiceBubble as renderVoiceMessageBubble };
