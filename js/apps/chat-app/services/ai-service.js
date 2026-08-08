/**
 * chat-app / AI 服务层（v0.62,真实 AI 对话）
 *
 * 职责:
 *   1) 拼装完整 systemPrompt — 走 window.__chatPromptBuilder.build()
 *   2) 调用 AI SDK — 走 window.__apiSdk + executeApiRequest({apiKeyId|groupId, ...})
 *   3) 解析 AI 返回内容 — 把 [发红包:88:祝福] / [发位置:名:地址] / [发图片:#xxx:#xxx:描述] /
 *      [发语音:秒数:内容] / [转账:金额:备注] / [引用:msgId:回复] 等特殊动作格式串拆出来,
 *      转成 message-renderer 能渲染的 messages 列表
 *   4) console.log 完整 prompt + AI 原文 — 调试用
 *
 * 设计:
 *   - 不依赖任何 framework 状态,纯函数式
 *   - 调用方只需 await `callAiAndSplit({aiPersonId, mode, historyLimit}) → {messages, raw, stats}`
 *   - 调用方拿到 messages[] 后,自己负责写盘 + 渲染(避免服务层耦合 chat-app state)
 *
 * 依赖:
 *   - window.settingsSdk(prewarm 已就绪)
 *   - window.__apiSdk(api manager 已加载)
 *   - window.__chatPromptBuilder(chat-app index.js 启动时挂)
 *   - executeApiRequest 来自 api-key-sdk.js(为方便这里动态 import)
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================================
// 0) K链摘要生成（v0.63）
// ============================================================

/**
 * 生成K链压缩摘要
 *
 * 业务场景：当K链满了时，把最早的几个回合压缩成一条梗概。
 *
 * 流程：
 * 1. 把回合列表（每回合 = 一组连续user消息 + 一组连续ai消息）格式化成输入文本
 * 2. 构造压缩专用的system prompt（简短，节省token）
 * 3. 调用AI生成梗概
 * 4. 返回梗概文本
 *
 * @param {Array} rounds - 回合数组，每项 = [{sender, content, ...}, ...]
 * @param {object} opts
 * @param {string} opts.aiPersonId - AI人设ID（用于查找API key）
 * @param {string} [opts.mode='calendar'] - 模式
 * @param {string} [opts.summaryStyle='concise'] - 摘要风格（concise/detailed）
 * @returns {Promise<{ok: boolean, summary: string, error?: string}>}
 */
export async function generateKChainSummary(rounds, opts = {}) {
    const { aiPersonId, mode = 'calendar', summaryStyle = 'concise' } = opts;

    if (!Array.isArray(rounds) || rounds.length === 0) {
        return { ok: false, summary: '', error: '没有回合可压缩' };
    }

    const apiSdk = window.__apiSdk;
    if (!apiSdk) {
        return { ok: false, summary: '', error: 'API SDK未加载' };
    }

    // 1. 格式化回合列表
    const formattedRounds = [];
    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        if (!Array.isArray(round)) continue;

        const parts = [];
        for (const msg of round) {
            if (!msg || !msg.content) continue;
            const sender = msg.sender === 'ai' ? 'AI' : '用户';
            let text = String(msg.content || '').replace(/\s+/g, ' ').trim();

            // 特殊消息类型处理
            if (msg.stickerCode || msg.type === 'sticker') {
                text = `[表情包]${msg.stickerName || msg.stickerCode || '表情包'}`;
            } else if (msg.locationCard || msg.type === 'location') {
                text = `[位置]${msg.locationCard?.name || msg.locationCard?.address || '位置'}`;
            } else if (msg.imageDescription || (msg.type === 'image' && !msg.url)) {
                text = `[图片]${msg.imageDescription || '图片'}`;
            } else if (msg.redpacketCard || msg.type === 'redpacket') {
                const amt = msg.redpacketCard?.amount || '';
                const bless = msg.redpacketCard?.blessing || '';
                text = `[红包]${amt}元 ${bless}`;
            } else if (msg.transferCard || msg.type === 'transfer') {
                const amt = msg.transferCard?.amount || '';
                const note = msg.transferCard?.note || '';
                text = `[转账]${amt}元 ${note}`;
            }

            if (!text) continue;
            if (text.length > 200) text = text.slice(0, 200) + '…';
            parts.push(`${sender}: ${text}`);
        }
        if (parts.length > 0) {
            formattedRounds.push(`【回合${i + 1}】\n${parts.join('\n')}`);
        }
    }

    if (formattedRounds.length === 0) {
        return { ok: false, summary: '', error: '没有有效内容可压缩' };
    }

    const roundsText = formattedRounds.join('\n\n');

    // 2. 构造压缩prompt
    const styleDesc = summaryStyle === 'detailed'
        ? '详细风格：涵盖话题、情感变化、重要细节'
        : '简洁风格：1-3句话概括核心内容';

    const systemPrompt = `# 压缩任务

你是一个对话压缩助手。你的任务是把一段聊天记录压缩成简短的梗概。

压缩规则：
- ${styleDesc}
- 保留关键信息：主要话题、人物互动、情感基调
- 忽略细节和重复内容
- 直接输出梗概，不要前缀说明，不要markdown格式
- 语言风格自然，像在描述"用户和AI聊了什么"

输入的聊天记录如下：
${roundsText}

请直接输出梗概（最多50字）：`;

    // 3. 查找API key
    const apiRef = getDefaultApiRef(aiPersonId);
    if (!apiRef) {
        return { ok: false, summary: '', error: '未找到可用的API Key' };
    }

    // 4. 调用AI
    try {
        const { executeApiRequest } = await import('../../setting/api-manager/api-key-sdk.js');

        const apiResp = await executeApiRequest({
            apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
            groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
            endpoint: 'chat/completions',
            method: 'POST',
            body: {
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: '请压缩这段对话' }],
                temperature: 0.3, // 压缩任务用低温，保持一致
                max_tokens: 100, // 梗概很短，不需要长输出
            },
            timeout: 30000, // 压缩任务30秒足够
        });

        if (!apiResp || apiResp.success === false) {
            const errMsg = apiResp?.error || 'AI调用失败';
            return { ok: false, summary: '', error: errMsg };
        }

        const raw = apiResp?.data?.choices?.[0]?.message?.content || '';
        const summary = raw.trim().replace(/^["']|["']$/g, '').slice(0, 200);

        if (!summary) {
            return { ok: false, summary: '', error: 'AI返回为空' };
        }

        return { ok: true, summary };
    } catch (err) {
        console.warn('[generateKChainSummary] AI调用异常:', err);
        return { ok: false, summary: '', error: err?.message || 'AI调用异常' };
    }
}

// ============================================================
// 1) 解析 AI 返回内容 → 消息数组
// ============================================================

/**
 * 解析 AI 返回的文本,拆分成"普通文本 + 特殊动作"段落数组
 * 返回: Array<{ type:'text'|'redpacket'|'location'|'image'|'voice'|'transfer'|'reply', ...payload }>
 *
 * 例:
 *   "生日快乐！[发红包:88:恭喜发财] [发图片:#FFE4EC:#D4728A:夕阳] 明天见"
 *   →
 *   [
 *     { type: 'text', text: '生日快乐！' },
 *     { type: 'redpacket', amount: 88, blessing: '恭喜发财' },
 *     { type: 'image', cardColor: '#FFE4EC', textColor: '#D4728A', description: '夕阳' },
 *     { type: 'text', text: '明天见' },
 *   ]
 */
export function parseAiResponse(raw) {
    if (!raw || typeof raw !== 'string') return [];
    const out = [];
    let i = 0;
    const len = raw.length;

    function pushText(t) {
        const trimmed = String(t || '').replace(/^\s+|\s+$/g, '');
        if (!trimmed) return;
        const last = out[out.length - 1];
        if (last && last.type === 'text') {
            last.text = (last.text + ' ' + trimmed).replace(/^\s+/, '');
        } else {
            out.push({ type: 'text', text: trimmed });
        }
    }

    while (i < len) {
        // 找下一个 [
        const open = raw.indexOf('[', i);
        if (open === -1) {
            pushText(raw.slice(i));
            break;
        }
        if (open > i) pushText(raw.slice(i, open));
        // 找匹配的 ]
        const close = raw.indexOf(']', open + 1);
        if (close === -1) {
            pushText(raw.slice(open));
            break;
        }
        const token = raw.slice(open + 1, close);
        const parsed = _parseOneToken(token);
        if (parsed) {
            out.push(parsed);
            i = close + 1;
        } else {
            // 不是合法 token,作为普通文本塞回去
            pushText(raw.slice(open, close + 1));
            i = close + 1;
        }
    }
    return out;
}

function _parseOneToken(token) {
    if (!token) return null;
    const parts = token.split(':');
    const head = parts[0];
    switch (head) {
        case '发红包': {
            const amount = Number(parts[1]) || 0;
            const blessing = parts.slice(2).join(':') || '恭喜发财';
            return { type: 'redpacket', amount, blessing };
        }
        case '转账': {
            const amount = Number(parts[1]) || 0;
            const note = parts.slice(2).join(':') || '';
            return { type: 'transfer', amount, note };
        }
        case '发位置': {
            const name = parts[1] || '位置';
            const address = parts.slice(2).join(':') || '';
            return { type: 'location', name, address };
        }
        case '发图片': {
            const cardColor = parts[1] || '#FFE4EC';
            const textColor = parts[2] || '#D4728A';
            const description = parts.slice(3).join(':') || '';
            return { type: 'image', cardColor, textColor, description };
        }
        case '发语音': {
            const duration = Number(parts[1]) || 0;
            const content = parts.slice(2).join(':') || '';
            return { type: 'voice', duration, content };
        }
        case '引用': {
            const msgId = parts[1] || '';
            const content = parts.slice(2).join(':') || '';
            return { type: 'reply', msgId, content };
        }
        case '分享聊天记录': {
            const count = Number(parts[1] || 5);
            return { type: 'share_chat_record', count };
        }
        case '分享音乐': {
            const song = parts[1] || '';
            const artist = parts.slice(2).join(':') || '';
            return { type: 'share_music', song, artist };
        }
        case '表情包': {
            // ★ v0.64 「AI 表情包」:跟其他特殊动作同款 [表情包:名称] 格式
            //   - name: 表情包名称(用户给图命名,如「狗-哭」「蝴蝶-飞飞」)
            //   - parts[1] 必填,否则视为非法 token(继续走默认 case)
            const name = String(parts[1] || '').trim();
            if (!name) return null;
            return { type: 'sticker', name };
        }
        // ★ v0.67 通话触发(AI 主动打来)
        case '打电话': {
            return { type: 'call', callType: 'voice' };
        }
        case '视频通话': {
            return { type: 'call', callType: 'video' };
        }
        default:
            return null;
    }
}

/**
 * 把分段数组转成可以写进 chatMessages 的消息对象列表
 *   - 普通文本: { type:'text', content:'...' }
 *   - 红宝: { type:'redpacket', redpacketCard:{...}, content:'[红包]' }
 *   - 位置: { type:'location', locationCard:{...}, content:'[位置]' }
 *   - 图片: { type:'descriptive_image', imageDescription, cardColor, textColor, content:'[图片]' }
 *   - 语音: { type:'voice', voiceContent, voiceDuration, content:'[语音]' }
 *   - 转账: { type:'transfer', transferCard:{...}, content:'[转账]' }
 *
 * @returns {Array<object>}
 */
export function segmentsToMessages(segments, ctxOpts = {}) {
    const now = Date.now();
    const baseId = `ai_${now}_`;
    let idx = 0;
    const out = [];
    for (const seg of segments || []) {
        const id = `${baseId}${idx++}`;
        if (seg.type === 'text') {
            if (!seg.text) continue;
            out.push({
                id,
                sender: 'ai',
                type: 'text',
                content: seg.text,
                timestamp: now + idx,
            });
        } else if (seg.type === 'redpacket') {
            out.push({
                id,
                sender: 'ai',
                type: 'redpacket',
                content: '[红包]',
                redpacketCard: {
                    amount: seg.amount,
                    message: seg.blessing,
                    style: 'normal',
                    opened: false,
                    fromAI: true,
                },
                timestamp: now + idx,
            });
        } else if (seg.type === 'transfer') {
            out.push({
                id,
                sender: 'ai',
                type: 'transfer',
                content: '[转账]',
                transferCard: {
                    amount: seg.amount,
                    note: seg.note,
                    received: false,
                    fromAI: true,
                },
                timestamp: now + idx,
            });
        } else if (seg.type === 'location') {
            out.push({
                id,
                sender: 'ai',
                type: 'location',
                content: '[位置]',
                locationCard: {
                    name: seg.name,
                    address: seg.address,
                },
                timestamp: now + idx,
            });
        } else if (seg.type === 'image') {
            out.push({
                id,
                sender: 'ai',
                type: 'descriptive_image',
                content: '[图片]',
                imageDescription: seg.description,
                cardColor: seg.cardColor,
                textColor: seg.textColor,
                timestamp: now + idx,
            });
        } else if (seg.type === 'voice') {
            out.push({
                id,
                sender: 'ai',
                type: 'voice',
                content: '[语音]',
                voiceContent: seg.content,
                voiceDuration: seg.duration,
                timestamp: now + idx,
            });
        } else if (seg.type === 'reply') {
            out.push({
                id,
                sender: 'ai',
                type: 'text',
                content: seg.content,
                replyTo: { msgId: seg.msgId },
                timestamp: now + idx,
            });
        } else if (seg.type === 'share_chat_record') {
            // v0.62 暂不展开,落一条 system 占位 + content 提示
            out.push({
                id,
                sender: 'ai',
                type: 'text',
                content: `[分享聊天记录: 最近 ${seg.count} 条]`,
                timestamp: now + idx,
            });
        } else if (seg.type === 'share_music') {
            out.push({
                id,
                sender: 'ai',
                type: 'text',
                content: `[分享音乐: ${seg.song}${seg.artist ? ' - ' + seg.artist : ''}]`,
                timestamp: now + idx,
            });
        } else if (seg.type === 'sticker') {
            // ★ v0.64 「AI 表情包」:暂时落一条占位 sticker 消息
            //   - name: AI 输出的表情包名(用户原话里给的名字)
            //   - stickerCode / url: 「在 sendMessageWithAi 写盘阶段」从 chat-history 反查填充
            //     (见 _resolveAiStickerFromHistory + aiPerson.boundResources.stickerGroupIds)
            //   - 渲染阶段(text-bubble.js case 'sticker')需要 msg.url,如果没有就降级显示名称
            out.push({
                id,
                sender: 'ai',
                type: 'sticker',
                content: `[表情包]${seg.name}`,
                stickerCode: '',
                stickerName: seg.name,
                url: '',
                aiStickerUnresolved: true, // ★ 标记:等 _resolveAiStickerFromHistory 处理
                timestamp: now + idx,
            });
        }
    }
    return out;
}

// ============================================================
// ★ v0.64 「AI 偷用户表情包」机制 + AI sticker 解析
// ============================================================

/**
 * ★ v0.64 「AI 偷用户表情包」
 *
 * 业务场景:
 *   - 用户发过一张 sticker,content = '[表情包]开心' 或 stickerName='开心'
 *   - AI 也发了同样的 [表情包]开心 → 但 AI 的 stickerGroupIds 里没有这张图
 *   - 期望:自动把那个图组(整个 groupId)加到 aiPerson.boundResources.stickerGroupIds
 *
 * 触发时机:
 *   - segmentsToMessages 完成后,在 sendMessageWithAi 写盘循环里调用
 *   - 每条 sticker 段触发一次(同一 name 重复就跳过,SDK 已经有 set 去重)
 *
 * @param {string} aiPersonId   AI 人设 id
 * @param {string} mode         'calendar' | 'story'
 * @param {string} stickerName  AI 输出的 [表情包:名称] 中的名称
 * @param {Array}  userHistory  跟当前 AI 的近期聊天消息数组(sender='user' + sender='ai' 全部)
 *                              用于反查「用户是否发过同名称的表情」
 * @returns {Promise<{stolen:boolean, stickerCode?:string, groupId?:string, sourceGroupName?:string}>}
 */
export async function _stealStickerIfNeeded(aiPersonId, mode, stickerName, userHistory = []) {
    const sdk = window.settingsSdk;
    const result = { stolen: false, stickerCode: '', groupId: '', sourceGroupName: '' };
    if (!sdk || !aiPersonId || !stickerName) return result;

    const target = String(stickerName).trim();
    if (!target) return result;

    // 1) 反查用户历史:找一张 sticker 消息,stickerName 或 stickerCode 跟 target 匹配
    //    顺序:最近 → 最远,只要找到第一条就停
    let stolenFrom = null;
    if (Array.isArray(userHistory)) {
        for (let i = userHistory.length - 1; i >= 0; i--) {
            const m = userHistory[i];
            if (!m || (m.type !== 'sticker' && !m.stickerCode)) continue;
            if (m.sender !== 'user') continue;
            const cand = String(m.stickerName || m.stickerCode || '').trim();
            if (cand && cand === target) {
                stolenFrom = m;
                break;
            }
            // 退路:code 完全相等(用户没设 stickerName 的旧消息)
            if (m.stickerCode && m.stickerCode === target) {
                stolenFrom = m;
                break;
            }
        }
    }
    if (!stolenFrom) {
        // AI 自己想的名称,用户从没发过 → 不偷(避免把不存在的表情加进 AI 资源)
        return result;
    }
    const stolenCode = String(stolenFrom.stickerCode || '').trim();
    if (!stolenCode) return result;

    // 2) 反查这个 code 属于哪个 groupId
    //    - 走 gallery_db.images 反查(唯一可靠,因为 chatMessages 不存 groupId)
    //    - 加载 getImageByCode → 拿它的 groupId
    let imageRecord = null;
    try {
        const { getImageByCode } = await import('../../setting/gallery/gallery-db.js');
        imageRecord = await getImageByCode(stolenCode);
    } catch (err) {
        console.warn('[chat-ai-service] _stealSticker getImageByCode failed:', err);
    }
    if (!imageRecord || !imageRecord.groupId) return result;

    const sourceGroupId = String(imageRecord.groupId);

    // 3) 检查 AI 人设是否已经有这个 groupId(避免重复 add)
    let ai = null;
    try { ai = sdk.aiPersons?.get?.(aiPersonId); } catch (_) {}
    if (!ai) return result;
    const boundIds = Array.isArray(ai.boundResources?.stickerGroupIds)
        ? ai.boundResources.stickerGroupIds.slice()
        : [];
    if (boundIds.includes(sourceGroupId)) {
        // 已经在 AI 资源里,算「不需要偷」(但仍然返回 stolenCode 让 sticker 正常渲染)
        result.stickerCode = stolenCode;
        result.groupId = sourceGroupId;
        return result;
    }

    // 4) ★ 偷:把 sourceGroupId 加到 aiPerson.boundResources.stickerGroupIds
    boundIds.push(sourceGroupId);
    try {
        await sdk.aiPersons.update(aiPersonId, {
            boundResources: {
                ...(ai.boundResources || {}),
                stickerGroupIds: boundIds,
            },
        });
        result.stolen = true;
        result.stickerCode = stolenCode;
        result.groupId = sourceGroupId;
        result.sourceGroupName = imageRecord.groupName || '';
        // 偷完后让 prompt-manager 立刻重画(nook 组新加一组 sticker)
        try {
            if (typeof window.invalidateRendererCache === 'function') {
                window.invalidateRendererCache('chat', null);
            }
        } catch (_) {}
        // 不需要 syncNow({ force: true }),用户已经在聊天页(切走才需要)
        return result;
    } catch (err) {
        console.warn('[chat-ai-service] stealSticker update aiPerson failed:', err);
        return result;
    }
}

/**
 * ★ v0.64 「AI sticker 解析」
 *
 * 业务背景:
 *   - AI 输出 [表情包:名称],segmentsToMessages 已经落了占位 sticker 消息
 *     (stickerCode='', url='', aiStickerUnresolved=true)
 *   - 写盘前要:(1) 偷表情包(2) 拿到真 code (3) 填 stickerCode + url
 *   - 渲染阶段(text-bubble.js case 'sticker')用 msg.url,没有就降级显示名称
 *
 * 调用方:
 *   - sendMessageWithAi 在写盘循环里,await sdk.chatMessages.add 之前调用
 *   - 返回值是改造后的 msg(原对象不变,返回一个新对象避免外部引用混淆)
 *
 * @param {object} msg       AI sticker 占位消息(由 segmentsToMessages 生成)
 * @param {string} aiPersonId
 * @param {string} mode
 * @param {Array}  userHistory
 * @returns {Promise<object>} 改造后的 msg(可能仍是占位,如果偷不到/找不到原图)
 */
export async function _resolveAiStickerFromHistory(msg, aiPersonId, mode, userHistory = []) {
    if (!msg || msg.type !== 'sticker') return msg;
    const name = String(msg.stickerName || msg.content?.replace(/^\[表情包\]/, '') || '').trim();
    if (!name) return msg;
    const stealResult = await _stealStickerIfNeeded(aiPersonId, mode, name, userHistory);
    const finalCode = stealResult.stickerCode || '';
    const next = { ...msg };
    if (finalCode) {
        // 拿到真 code → 立即按需读 source(url)塞进 msg.url
        try {
            const { _loadSource } = await import('../components/emoji-picker-panel.js');
            const url = await _loadSource(finalCode);
            next.stickerCode = finalCode;
            next.url = url || '';
            next.aiStickerUnresolved = !url; // 拿到 url 才算 resolved
            if (stealResult.stolen) {
                next.aiStickerStolen = true;
                next.aiStickerStolenFromGroup = stealResult.groupId || '';
                next.aiStickerStolenFromName = stealResult.sourceGroupName || '';
            }
        } catch (err) {
            console.warn('[chat-ai-service] resolveAiSticker _loadSource failed:', err);
            next.stickerCode = finalCode;
            next.aiStickerUnresolved = true;
        }
    } else {
        // 偷不到:保持原占位(stickerCode='', aiStickerUnresolved=true)
        // text-bubble.js 渲染时降级显示 [表情包]名称 + 灵动岛提示「表情包不存在」
        next.aiStickerUnresolved = true;
    }
    return next;
}

// ============================================================
// 2) 调用 AI SDK
// ============================================================

/**
 * 找到当前 AI 人设绑定的「默认 API ref」
 *   - 优先用 localStorage 里用户手动选过的:xiaoting::chat-default-api-key::{aiPersonId}
 *   - 兜底聚合 aiPerson.boundResources.apiRefs[] + 用户人设的 boundResources.apiRefs[]
 *     (用户人设 = defaultUserCard.getDefault() 或 users.getActive())
 *     - 两者都有 → 优先用 ai 的(用户人设列表作为备选)
 *     - 两者只有一个 → 用那个
 *     - 都没有 → 返回 null
 *   - 返回 { type:'key'|'group', refId } 或 null
 */
export function getDefaultApiRef(aiPersonId) {
    try {
        const ai = window.settingsSdk?.aiPersons?.get?.(aiPersonId);
        if (!ai) return null;
        // ★ v0.62.6 兜底聚合:AI 人设 + 用户人设 的 apiRefs(去重)
        //   顺序:AI refs 先,用户人设 refs 后(AI 优先)
        const aiRefs = Array.isArray(ai.boundResources?.apiRefs) ? ai.boundResources.apiRefs : [];
        const user = window.settingsSdk?.defaultUserCard?.getDefault?.() || window.settingsSdk?.users?.getActive?.() || null;
        const userRefs = Array.isArray(user?.boundResources?.apiRefs) ? user.boundResources.apiRefs : [];
        const seen = new Set();
        const refs = [];
        for (const r of [...aiRefs, ...userRefs]) {
            if (!r || typeof r !== 'object') continue;
            // ★ 兼容多种存储形态:
            //   新:{ refType: 'key'|'group', refId: 'xxx' }
            //   旧:{ apiKeyId: 'xxx' } / { groupId: 'xxx' } / { type, id }
            let refType = '';
            let refId = '';
            if (r.refType === 'key' || r.refType === 'group') {
                refType = r.refType;
                refId = String(r.refId || '');
            } else if (r.apiKeyId) {
                refType = 'key';
                refId = String(r.apiKeyId);
            } else if (r.groupId) {
                refType = 'group';
                refId = String(r.groupId);
            } else if (r.type === 'key' || r.type === 'group') {
                refType = r.type;
                refId = String(r.id || '');
            } else if (r.id) {
                // 仅 id:走 resolveRef 内部兼容
                refType = 'key';
                refId = String(r.id);
            }
            if (!refType || !refId) continue;
            const dedupKey = refType + '::' + refId;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);
            refs.push({ refType, refId, _origin: r });
        }
        const apiSdk = window.__apiSdk;
        if (!apiSdk) return null;

        // 先查 localStorage
        const localKey = 'xiaoting::chat-default-api-key::' + aiPersonId;
        let savedId = '';
        try { savedId = localStorage.getItem(localKey) || ''; } catch (_) {}

        function resolveRef(refLike) {
            if (!refLike) return null;
            // ★ 真实存储形态:{ refType: 'key'|'group', refId, name, subTitle, addedAt }
            if (refLike.refType === 'key') {
                const k = apiSdk.apiKeySdk?.get?.(refLike.refId);
                if (k && k.enabled !== false) return { type: 'key', refId: k.id || refLike.refId };
            }
            if (refLike.refType === 'group') {
                const g = apiSdk.apiGroupSdk?.get?.(refLike.refId);
                if (g) return { type: 'group', refId: g.id || refLike.refId };
            }
            // 兼容旧形态:{ apiKeyId } / { groupId } / { id, type }
            if (refLike.apiKeyId || refLike.type === 'key') {
                const id = refLike.apiKeyId || refLike.id;
                const k = apiSdk.apiKeySdk?.get?.(id);
                if (k && k.enabled !== false) return { type: 'key', refId: id };
            }
            if (refLike.groupId || refLike.type === 'group') {
                const id = refLike.groupId || refLike.id;
                const g = apiSdk.apiGroupSdk?.get?.(id);
                if (g) return { type: 'group', refId: id };
            }
            // 仅 id
            const k = apiSdk.apiKeySdk?.get?.(refLike.id || refLike);
            if (k && k.enabled !== false) return { type: 'key', refId: k.id };
            const g = apiSdk.apiGroupSdk?.get?.(refLike.id || refLike);
            if (g) return { type: 'group', refId: g.id };
            return null;
        }

        // localStorage 里存的形态是 refType::refId(例:'key::xxx' 或 'group::xxx'),也兼容老形态(纯 id)
        let savedRefType = '';
        let savedRefId = '';
        if (savedId && savedId.includes('::')) {
            const parts = savedId.split('::');
            savedRefType = parts[0] === 'group' ? 'group' : 'key';
            savedRefId = parts.slice(1).join('::'); // refId 里也可能含 ::
        } else {
            savedRefId = savedId;
        }

        // 先查 localStorage
        if (savedRefId) {
            // 用 savedRefType 去 refs 里精确找
            let matched = null;
            if (savedRefType) {
                matched = refs.find((x) => x.refType === savedRefType && x.refId === savedRefId);
            }
            // fallback:任何 refType 的 savedRefId
            if (!matched) matched = refs.find((x) => x.refId === savedRefId);
            if (matched) {
                const r = resolveRef(matched);
                if (r) return r;
            }
        }
        // 兜底:第一个 ref
        for (const ref of refs) {
            const r = resolveRef(ref);
            if (r) return r;
        }
        console.warn('[chat-ai-service] getDefaultApiRef 无可用 ref,aiPersonId=', aiPersonId, 'aiRefs=', aiRefs.length, 'userRefs=', userRefs.length, 'savedRefId=', savedRefId, 'aggregated=', refs.length);
        return null;
    } catch (e) {
        console.error('[chat-ai-service] getDefaultApiRef threw', e);
        return null;
    }
}

/**
 * 调用 AI SDK 并解析返回
 * @param {object} opts
 * @param {string} opts.aiPersonId
 * @param {'calendar'|'story'} opts.mode
 * @param {string} opts.userText 用户刚发的文本(用于拼装 messages)
 * @param {number} [opts.historyLimit=12]
 * @returns {Promise<{ ok:boolean, raw?:string, segments?:Array, messages?:Array, stats?:object, error?:string, prompt?:string, systemPrompt?:string }>}
 */
export async function callAiAndSplit(opts = {}) {
    const { aiPersonId, mode = 'calendar', userText, historyLimit = 12 } = opts;
    const sdk = window.settingsSdk;
    const apiSdk = window.__apiSdk;
    const builder = window.__chatPromptBuilder;

    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };
    if (!apiSdk) return { ok: false, error: 'API SDK 未加载,请先在设置中配置 API Key' };
    if (!builder || typeof builder.build !== 'function') {
        return { ok: false, error: 'prompt-builder 未挂载' };
    }

    // 1) 拼装 system prompt
    let buildResult;
    try {
        // ★ v0.62.x 「回复格式与聊天风格」开关
        //   - 默认 true:注入到 systemPrompt 末尾
        //   - false:完全不注入(用户主动关闭)
        //   - 来源:跟 renderPromptManagerPage 同源,从 localStorage 读(防止 HMR 后内存丢失)
        let replyFormatInject = { enabled: true };
        try {
            const raw = localStorage.getItem('xiaoting::chat-reply-format-inject-v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && aiPersonId) {
                    replyFormatInject = { enabled: parsed[aiPersonId] !== false };
                }
            }
        } catch (_) { /* ignore */ }

        // ★ v0.63.2 K 链摘要注入开关(跟 replyFormatInject 同样的模式)
        //   - 默认 true:把 buildKChainContext 拼出来的多 K 文本注入到 systemPrompt
        //   - false:完全不注入(用户主动关闭 prompt-manager 上的「K 链」toggle,或总开关关闭)
        //   - 两个条件都要看:
        //     · rollingConfig.enabled(总开关,chat-settings #set-rolling-enabled)
        //     · kChainActiveMap[aiPersonId] !== false(个人 toggle)
        //   - 任一为 false → 不注入
        let kChainInject = { enabled: true };
        try {
            // (1) 总开关:从 SDK 读 rollingConfig
            const cfg = sdk.rollingSummaries?.getRollingConfig?.(aiPersonId);
            const totalEnabled = !!(cfg && cfg.enabled);
            // (2) 个人 toggle:从 localStorage 读
            const raw = localStorage.getItem('xiaoting::chat-k-chain-active-v1');
            let personalEnabled = true;
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object' && aiPersonId) {
                        personalEnabled = parsed[aiPersonId] !== false;
                    }
                } catch (_) { /* ignore */ }
            }
        kChainInject = { enabled: totalEnabled && personalEnabled };
    } catch (_) { /* ignore */ }

    // ★ v0.66 memory summary inject override:读 app.state.chat.memorySummaryInject
    //   让 prompt-builder 在拼「分级记忆」段时,把用户在 prompt-manager 里关闭的某条概要排除掉
    let memorySummaryInjectOverride = {};
    try {
        const app = (typeof window !== 'undefined' && (window.__chatAppSingleton || window.externalAppRegistry?.getApp?.('chat'))) || null;
        const aiMap = app?.state?.chat?.memorySummaryInject?.[aiPersonId];
        if (aiMap && typeof aiMap === 'object') memorySummaryInjectOverride = { [aiPersonId]: aiMap };
    } catch (_) { /* ignore */ }

    buildResult = builder.build({
        aiPersonId,
        mode,
        historyLimit,
        replyFormatInject,
        kChainInject,
        memorySummaryInjectOverride,
    });
    // builder.build 可能是 async(基于 prompt-builder.js 的实现是 sync 函数),
    // 这里兼容 await
    if (buildResult && typeof buildResult.then === 'function') {
        buildResult = await buildResult;
    }
    } catch (err) {
        console.error('[chat-ai-service] build prompt failed', err);
        return { ok: false, error: '拼装 prompt 失败:' + (err?.message || String(err)) };
    }
    const systemPrompt = buildResult?.systemPrompt || '';
    console.log('[chat-ai-service] systemPrompt ====== START ======');
    console.log(systemPrompt);
    console.log('[chat-ai-service] systemPrompt ====== END (length=' + systemPrompt.length + ') ======');

    // 2) 选 API ref
    const apiRef = getDefaultApiRef(aiPersonId);
    if (!apiRef) {
        // ★ v0.62.6 错误提示更精确:分别检查 AI 人设 + 用户人设
        const ai = sdk.aiPersons?.get?.(aiPersonId);
        const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
        const aiHas = Array.isArray(ai?.boundResources?.apiRefs) && ai.boundResources.apiRefs.length > 0;
        const userHas = Array.isArray(user?.boundResources?.apiRefs) && user.boundResources.apiRefs.length > 0;
        let detail = 'AI 人设未绑定 API';
        if (!aiHas && !userHas) detail = 'AI 人设和用户人设都没绑定 API';
        else if (!aiHas && userHas) detail = 'AI 人设未绑定,用户人设绑定的 API Key/分组已被禁用';
        else if (aiHas && !userHas) detail = 'AI 人设绑定的 API Key/分组已被禁用';
        return { ok: false, error: detail + ',请到「聊天设置 → API 调用」配置', prompt: systemPrompt };
    }

    // 3) 拼 messages(只把 userText 作为本次输入;chat 历史已经走 prompt-builder 拼到 systemPrompt)
    //    这样能让 LLM 更准确理解"我刚发的这句话"的上下文
    const messages = [{ role: 'user', content: userText || '' }];

    // 4) 调用 AI
    let apiResp;
    try {
        const { executeApiRequest } = await import('../../setting/api-manager/api-key-sdk.js');
        console.log('[chat-ai-service] 选定的 API ref:', apiRef);
        apiResp = await executeApiRequest({
            apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
            groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
            endpoint: 'chat/completions',
            method: 'POST',
            body: {
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                temperature: 0.7,
            },
            timeout: 60000,
        });
    } catch (err) {
        console.error('[chat-ai-service] executeApiRequest threw', err);
        return { ok: false, error: '调用 AI SDK 异常:' + (err?.message || String(err)), prompt: systemPrompt };
    }

    if (!apiResp || apiResp.success === false) {
        const errMsg = apiResp?.error || 'AI 返回失败';
        const status = apiResp?.statusCode;
        // ★ v0.62.6:把 HTTP 错误翻译成更友好的中文提示
        let friendly = errMsg;
        if (status === 401) {
            friendly = 'API Key 鉴权失败(401),请到设置→API 管理检查 key 是否正确 / 是否过期 / 账号余额是否充足';
        } else if (status === 403) {
            friendly = 'API Key 被拒绝访问(403),可能账号被禁用或权限不足';
        } else if (status === 404) {
            friendly = 'API 接口未找到(404),请检查 baseUrl 和 model 是否正确';
        } else if (status === 429) {
            friendly = 'API 调用频率超限(429),请稍后再试或换一个 key';
        } else if (status >= 500) {
            friendly = 'AI 服务器错误(' + status + '),请稍后重试';
        }
        return { ok: false, error: friendly, prompt: systemPrompt, httpStatus: status };
    }

    // 5) 解析返回
    const raw = apiResp?.data?.choices?.[0]?.message?.content || '';
    console.log('[chat-ai-service] AI raw response ====== START ======');
    console.log(raw);
    console.log('[chat-ai-service] AI raw response ====== END (length=' + raw.length + ') ======');

    if (!raw || !raw.trim()) {
        return { ok: false, error: 'AI 返回为空', raw: '', prompt: systemPrompt };
    }

    const segments = parseAiResponse(raw);
    const aiMessages = segmentsToMessages(segments);
    if (aiMessages.length === 0) {
        // 解析失败也要落一条 text 占位,避免前端气泡空白
        aiMessages.push({
            id: 'ai_fallback_' + Date.now(),
            sender: 'ai',
            type: 'text',
            content: raw.trim().slice(0, 1000),
            timestamp: Date.now(),
        });
    }

    return {
        ok: true,
        raw,
        segments,
        messages: aiMessages,
        stats: {
            ...(buildResult?.stats || {}),
            ...(apiResp?.usage || {}),
            apiKeyId: apiResp?.apiKeyId,
            groupId: apiResp?.groupId,
            latency: apiResp?.latency,
        },
        prompt: systemPrompt,
    };
}