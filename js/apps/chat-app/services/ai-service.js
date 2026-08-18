/**
 * chat-app / AI 服务层（v0.62,真实 AI 对话）
 *
 * 职责:
 *   1) 读取 prompt-manager 已生成的最终 pre（不再经过 prompt-builder）
 *      pre = 发给 AI 的 systemPrompt,一字不动
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
 *   - context-preview.js(prompt-manager 最终 pre 的镜像)
 *   - executeApiRequest 来自 api-key-sdk.js(为方便这里动态 import)
 */

import { readContextPreview, writeContextPreview } from './context-preview.js';
import { wrapPromptBlock, replacePromptBlock, readPromptBlock, hasPromptBlock, stripPromptBlock } from './prompt-tags.js';
// 一起听 / 四叶草 / 灯塔 / 日记这四段实时块的唯一声明。prompt-manager 画预览用同一份,
// 所以「预览里看到的段落」和「真正发出去的段落」不可能对不上号。
import { collectLiveContextBlocks, stripLiveContextBlocks } from './live-context-registry.js';
import { makeOwnerKey, isGroupEnabled, isCardEnabled } from './prompt-toggles.js';

// ★ v0.88:这里原来有个 `generateKChainSummary()` —— 第一版 K 链「攒够 N 轮就
//   单独发一次压缩请求」的实现。K 链 SDK 2026-08-09 被删之后它就没人调了,
//   但函数还留着(index.js 也还 import 着),看起来像还有一条压缩链路在跑。
//   第二版 K 链改成「搭在正常回复那一次调用上」,不再需要独立请求 ——
//   留着它就是第二份实现,迟早有人接错。整块删掉,新实现见 `k-chain-service.js`。

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

    /**
     * 推一段纯文本。
     * - 不再合并相邻 text 段:因为「|」分句的多条短消息需要各自独立气泡
     * - 每条 push 出去的 text 都是「一条独立气泡」的原料
     */
    function pushText(t) {
        const trimmed = String(t || '').replace(/^\s+|\s+$/g, '');
        if (!trimmed) return;
        out.push({ type: 'text', text: trimmed });
    }

    /**
     * 处理一段 raw 子串(可能含 | 分句 + [...] 特殊动作)
     * - 按 | / | / \n / \r\n / /n 切(全角竖线 + 半角竖线 + 各种换行符都支持)
     * - 修复 v0.85:AI 有时会用 /n 或换行符分割内容
     * - 每个切分后的子段单独走 [...] token 识别
     * - 这样能保证:
     *     A) | / \n / /n 切出的每一段要么是纯 text,要么是单个特殊动作 token
     *     B) text 和 [特殊动作] 永远不会在同一个 text 段里混排
     *     C) [发图片:...] / [发红包:...] 始终是独立气泡,不会和文字拼接
     */
    function handleSegment(seg) {
        if (!seg) return;
        // ★ v0.85 修复:支持多种分隔符(| / | / \n / \r\n / /n)
        const parts = String(seg).split(/[|｜\n\r]|(?:\/n)/);
        for (const part of parts) {
            handlePart(part);
        }
    }

    /**
     * 处理一个「| 切完后的子段」:走原 for-loop 的 [token] 识别逻辑
     * 递归查找 [ ... ] 子串:
     *   - token 前的 → pushText
     *   - 合法 token  → out.push(tokenObj)
     *   - 非法 token  → 原样 pushText(降级显示)
     */
    function handlePart(part) {
        const s = String(part || '');
        if (!s) return;
        let j = 0;
        const slen = s.length;
        while (j < slen) {
            const open = s.indexOf('[', j);
            if (open === -1) {
                pushText(s.slice(j));
                return;
            }
            if (open > j) pushText(s.slice(j, open));
            const close = s.indexOf(']', open + 1);
            if (close === -1) {
                pushText(s.slice(open));
                return;
            }
            const token = s.slice(open + 1, close);
            const parsed = _parseOneToken(token);
            if (parsed) {
                out.push(parsed);
                j = close + 1;
            } else {
                // 不是合法 token,作为普通文本塞回去
                pushText(s.slice(open, close + 1));
                j = close + 1;
            }
        }
    }

    handleSegment(raw);
    return out;
}

/**
 * 按歌名（+可选歌手）到音乐 App 的曲库里找歌。
 * 音乐 App 没装或没找到都返回 null，卡片会退化成"只展示不能播"。
 */
function _lookupSongByTitle(title, artist) {
    try {
        return window.__musicListenTogether?.findSong?.(title, artist) || null;
    } catch (_) {
        return null;
    }
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
        case '记忆': {
            // ★ v0.88 K 链:这不是一条消息,是 AI 顺手交回来的记忆摘要。
            //   `callAiAndSplit` 会在 segmentsToMessages 之前把它滤掉 ——
            //   漏滤的话用户会看到一个装着三百字摘要的气泡。
            const text = parts.slice(1).join(':').trim();
            if (!text) return null;
            return { type: 'kchain_memory', text };
        }
        case '分享音乐': {
            const song = parts[1] || '';
            const artist = parts.slice(2).join(':') || '';
            return { type: 'share_music', song, artist };
        }
        case '一起听': {
            const song = parts.slice(1).join(':').trim();
            return { type: 'listen_together', song };
        }
        case '表情包': {
            // ★ v0.64 「AI 表情包」:跟其他特殊动作同款 [表情包:名称] 格式
            //   - name: 表情包名称(用户给图命名,如「狗-哭」「蝴蝶-飞飞」)
            //   - parts[1] 必填,否则视为非法 token(继续走默认 case)
            const name = String(parts[1] || '').trim();
            if (!name) return null;
            return { type: 'sticker', name };
        }
        // ★ v0.79 AI 发朋友圈
        //   - 跟旧 chat.js 同款 [发朋友圈:内容] 格式
        //   - chat-asset-service.aiSendMoment 会负责写完整朋友圈到 aiPerson.moments[] + 生成概要
        case '发朋友圈': {
            const content = parts.slice(1).join(':').trim();
            if (!content) return null;
            return { type: 'moment', content };
        }
        // ── 萤火视频(2026-08-15)──────────────────────────────
        // AI 给用户分享一条「萤火」上的视频。这是普通卡片消息(和 [发位置] 同款,
        // 无副作用),点击卡片走 contentCard 确认协议,由萤火按快照恢复/生成详情。
        // 格式必须和 youtube-app/services/app-prompts.js 注册的说明逐字一致。
        case '分享视频': {
            const title = (parts[1] || '').trim();
            if (!title) return null;
            const blurb = parts.slice(2).join(':').trim();
            return { type: 'youtube_share', title, blurb };
        }
        // ── 氧气博客(2026-08-15)──────────────────────────────
        // AI 给用户分享一条「氧气」上的帖子。氧气是标签优先的博客:卡片只带
        // 标签和一句预感,点击走 contentCard 确认协议,由氧气按快照建档 + 生成正文。
        // 格式必须和 blog-app/services/app-prompts.js 注册的说明逐字一致。
        case '分享帖子': {
            const tags = (parts[1] || '').split('/').map((t) => t.trim()).filter(Boolean);
            if (!tags.length) return null;
            const blurb = parts.slice(2).join(':').trim();
            return { type: 'blog_share', tags, blurb };
        }
        // ── 黑匣子(2026-08-15)────────────────────────────────
        // 扮演结束后模型自己留下的一两句话。**不是消息**:
        // callAiAndSplit 会在 segmentsToMessages 之前把它滤掉并送进氧气
        // (blog)的黑匣子;黑匣子 prompt 卡没注入本轮 system prompt 时,
        // 同形文本按普通文本显示(防误触发)。
        case '黑匣子': {
            const text = parts.slice(1).join(':').trim();
            if (!text) return null;
            return { type: 'blackbox', text };
        }
        // ── 四叶草购物(2026-08-13)─────────────────────────────
        // AI 用自己的余额给用户买东西。和群管理同款:这不是消息,是**动作** ——
        // 要扣 AI 的钱、写订单、勾掉心愿单,最后才产出一张礼物卡。
        // 这里只识别成 shop_gift 段,真正执行在写盘那一层(需要 aiPersonId / mode,
        // 而解析函数是纯函数、拿不到这些)。
        case '送礼':
        case '匿名送礼': {
            const name = (parts[1] || '').trim();
            if (!name) return null;
            const price = Number(parts[2]) || 0;
            const message = parts.slice(3).join(':').trim();
            return { type: 'shop_gift', gift: { name, price, message, anonymous: head === '匿名送礼' } };
        }
        // ★ v0.67 通话触发(AI 主动打来)
        case '打电话': {
            return { type: 'call', callType: 'voice' };
        }
        case '视频通话': {
            return { type: 'call', callType: 'video' };
        }
        // ── 群管理(2026-08-13)──────────────────────────────
        // 这三个 token 不产生气泡,它们是「动作」:落库改群数据 + 写一条群公告。
        // 这里只负责识别成 group_admin 段,真正执行在 chat-app 写盘那一层
        // (services/group-admin-service.js),因为执行需要 user / groupId 上下文,
        // 而解析函数是纯函数、拿不到这些。
        case '群昵称': {
            const target = (parts[1] || '').trim();
            const nickname = parts.slice(2).join(':').trim();
            if (!target) return null;
            return { type: 'group_admin', action: { kind: 'nickname', target, nickname } };
        }
        case '我的群昵称': {
            const nickname = parts.slice(1).join(':').trim();
            if (!nickname) return null;
            return { type: 'group_admin', action: { kind: 'self-nickname', nickname } };
        }
        case '设为管理员': {
            const target = parts.slice(1).join(':').trim();
            if (!target) return null;
            return { type: 'group_admin', action: { kind: 'admin', target, on: true } };
        }
        case '取消管理员': {
            const target = parts.slice(1).join(':').trim();
            if (!target) return null;
            return { type: 'group_admin', action: { kind: 'admin', target, on: false } };
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
            // 落成真正的歌曲卡；songId 由 music app 按歌名反查（找不到就只当展示卡）
            const matched = _lookupSongByTitle(seg.song, seg.artist);
            out.push({
                id,
                sender: 'ai',
                type: 'song_share',
                content: `[分享音乐: ${seg.song}${seg.artist ? ' - ' + seg.artist : ''}]`,
                songCard: {
                    songId: matched?.id ?? null,
                    title: seg.song || matched?.title || '未知歌曲',
                    artist: seg.artist || matched?.artist || '未知歌手',
                    cover: matched?.cover || '',
                    color: matched?.color || '#fb7299',
                },
                timestamp: now + idx,
            });
        } else if (seg.type === 'listen_together') {
            // AI 主动邀请一起听：发卡 + 通知 music app 开会话
            const matched = _lookupSongByTitle(seg.song, '');
            out.push({
                id,
                sender: 'ai',
                type: 'listen_together_invite',
                content: seg.song ? `[一起听: ${seg.song}]` : '[一起听]',
                inviteCard: {
                    songId: matched?.id ?? null,
                    title: seg.song || matched?.title || '',
                    artist: matched?.artist || '',
                    cover: matched?.cover || '',
                    color: matched?.color || '#7c5cff',
                    invitedBy: 'ai',
                },
                listenTogetherRequest: { song: seg.song || '' },
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
        } else if (seg.type === 'youtube_share') {
            // 萤火视频卡。videoId 留空 —— AI 发的是「它口中的一条视频」,
            // 用户点开卡片确认后,萤火用这份快照现场建档 + 生成详情。
            // 写入 type / message-renderer 注册表 / share-cards 渲染器三处对齐。
            out.push({
                id,
                sender: 'ai',
                type: 'youtube_video_share',
                content: `[视频] ${seg.title}`,
                youtubeCard: {
                    videoId: `aivid_${now}_${idx}`,
                    title: seg.title,
                    blurb: seg.blurb || '',
                    coverText: seg.title.slice(0, 8),
                    coverHue: (seg.title.length + idx) % 8,
                    creatorName: '',
                    kind: '',
                    views: 0,
                    durationSec: 0,
                    fromAi: true,
                },
                timestamp: now + idx,
            });
        } else if (seg.type === 'blog_share') {
            // 氧气帖子卡。postId 现造 —— AI 发的是「它口中的一条帖子」,
            // 用户点开卡片确认后,氧气用这份快照现场建档 + 生成正文。
            // 写入 type / message-renderer 注册表 / share-cards 渲染器三处对齐。
            out.push({
                id,
                sender: 'ai',
                type: 'blog_post_share',
                content: `[帖子] ${seg.tags.join(' / ')}`,
                blogCard: {
                    postId: `aipost_${now}_${idx}`,
                    tags: seg.tags,
                    type: 'short',
                    authorName: '',
                    blurb: seg.blurb || '',
                    fromAi: true,
                },
                timestamp: now + idx,
            });
        } else if (seg.type === 'moment') {
            // ★ v0.79 AI 发朋友圈
            //   - 这种消息类型是「AI 发朋友圈后由 chat-asset-service.aiSendMoment 写出来的」
            //   - segmentsToMessages 不直接处理 —— 真实写入走 chat-asset-service.aiSendMoment
            //   - 这里只产出一个 marker,表示「这一轮 AI 已经触发了发朋友圈」,
            //     让 sendMessageWithAi 在循环里识别 + 调 aiSendMoment
            out.push({
                id,
                sender: 'ai',
                type: 'moment', // ★ marker — 走 aiSendMoment
                content: seg.content,
                momentContent: seg.content,
                timestamp: now + idx,
            });
        } else if (seg.type === 'group_admin') {
            // 群管理动作（设管理员 / 改群昵称）。
            // 同样是 marker：不写 chatMessages，由写盘那一层交给
            // group-admin-service 执行，执行完它自己会写一条群公告。
            out.push({
                id,
                sender: 'ai',
                type: 'group_admin',
                content: '[群务]',
                groupAdminAction: seg.action,
                timestamp: now + idx,
            });
        } else if (seg.type === 'shop_gift') {
            // 四叶草送礼。也是 marker：真正执行（扣 AI 的钱、写订单、
            // 勾心愿单、产出礼物卡）由写盘那一层调 shop 的 service 完成。
            // ★ 这里**不能**直接写一张礼物卡，否则会出现「卡片有了但钱没扣」——
            //   而余额不足是很常见的情况。
            out.push({
                id,
                sender: 'ai',
                type: 'shop_gift_request',
                content: '[礼物]',
                shopGift: seg.gift,
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
    const { aiPersonId, mode = 'calendar', userText, historyLimit = 12, groupId = '' } = opts;
    const sdk = window.settingsSdk;
    const apiSdk = window.__apiSdk;

    if (!sdk) return { ok: false, error: 'settingsSdk 未就绪' };
    if (!apiSdk) return { ok: false, error: 'API SDK 未加载,请先在设置中配置 API Key' };

    // 0) 先无头重跑一次 prompt-manager 的拼装，把 pre 刷到最新。
    //    pre 一直是 renderPromptManagerPage 的副作用，用户不点进那一页它就是旧快照：
    //    今天新聊的回合、刚改的人设、新装 App 的 prompt 全都进不去
    //    （从没打开过时更惨，下面直接报错发不出去）。
    //    这里是"发送前"这个时机的补刷；"打开私聊"那个时机在 index.js 里。
    //    群聊必须刷 `group_<id>-<mode>` 那份，不能去刷发言 AI 的私聊 pre ——
    //    私聊 pre 带着音乐 / 天气 / 购物等第三方卡，群聊只要 nook + murmur + 群信息。
    const isGroupCall = !!groupId;
    const previewPersonId = isGroupCall ? `group_${groupId}-${mode}` : aiPersonId;
    try {
        await window.__chatRefreshContextPreview?.(isGroupCall
            ? { isGroup: true, groupId, mode, aiPersonId }
            : { aiPersonId, mode });
    } catch (err) {
        console.warn('[chat-ai-service] 发送前刷新 pre 失败，继续用缓存那份', err);
    }

    // 1) 读取 prompt-manager 已按卡片顺序生成的最终 pre。
    let systemPrompt = '';
    try {
        systemPrompt = readContextPreview({ aiPersonId: previewPersonId, mode }) || '';
        if (!systemPrompt) {
            return { ok: false, error: 'prompt-manager 预览还没生成,请先在 prompt 管理页确认内容' };
        }
    } catch (err) {
        console.error('[chat-ai-service] readContextPreview failed', err);
        return { ok: false, error: '读取 prompt 预览失败:' + (err?.message || String(err)) };
    }

    // 1.5) 实时块（一起听 / 四叶草 / 灯塔 / 日记）。
    //
    //      pre 是 prompt-manager 生成那一刻的快照，而这四段过期得特别快：歌词进度、
    //      心愿单里谁买过、这个月发没发工资、经期第几天。而且后三段**对每个 AI
    //      内容还不一样**（匿名礼物不能互相泄漏），一份共用快照根本做不到。
    //      所以统一剪掉旧的、拼一份发送这一刻现算的。
    //
    //      开关在这里生效：用户在 prompt 管理页把某张实时卡（或它所在的整组）关掉了，
    //      这里就只剪不拼。以前这段是四个写死的 try 块，既不看开关、四叶草和灯塔还
    //      压根没在预览里出现过 —— 用户看不见、关不掉，照样每轮都发。
    //      群聊不要这些第三方实时块：只剪干净，不再拼回去。
    try {
        systemPrompt = stripLiveContextBlocks(systemPrompt);
        if (!isGroupCall) {
            const liveOwnerKey = makeOwnerKey({ aiPersonId });
            const liveBlocks = collectLiveContextBlocks(aiPersonId, {
                isEnabled: (b) => isGroupEnabled(liveOwnerKey, b.group) && isCardEnabled(liveOwnerKey, b.id),
            });
            for (const b of liveBlocks) {
                systemPrompt = `${systemPrompt}\n\n${wrapPromptBlock(b.tag, b.content)}`.trim();
            }
        }
    } catch (err) {
        console.warn('[chat-ai-service] 注入实时上下文失败', err);
    }

    // 1.57) K 链记忆：和上面几段同一条路 —— pre 是快照，而「现在攒够几个回合了」
    //       每一轮都在变，快照必然过期。
    //       两段分开：当前记忆总是带；「顺手生成新记忆」那段**只在该压缩的那一轮才拼**，
    //       其余轮次一个字都不发（用户明确要求的省 token 点，那段指令两百来字）。
    //       群聊没有单一 AI 的滚动记忆，这段跳过。
    let kChainPending = 0;
    let kChainRequested = false;
    if (!isGroupCall) {
        try {
            const kc = window.__chatKChain;
            if (kc) {
                systemPrompt = stripPromptBlock(stripPromptBlock(systemPrompt, kc.tag), kc.requestTag);
                const kBlock = kc.getContext?.(aiPersonId, mode) || '';
                if (kBlock) systemPrompt = `${systemPrompt}\n\n${wrapPromptBlock(kc.tag, kBlock)}`.trim();

                kChainPending = kc.countPending?.(aiPersonId, mode) || 0;
                const kReq = kc.getRequest?.(aiPersonId, mode, kChainPending) || '';
                if (kReq) {
                    kChainRequested = true;
                    systemPrompt = `${systemPrompt}\n\n${wrapPromptBlock(kc.requestTag, kReq)}`.trim();
                }
            }
        } catch (err) {
            console.warn('[chat-ai-service] 注入 K 链失败', err);
        }
    }

    // 1.6) 群聊：群名称 / 公告 / 备注 / 成员职务与群昵称在发送时现算。
    //      预览里那份没有「就是你」，发言 AI 必须按 selfId 重算；
    //      群主是谁、谁改了群昵称随时在变，快照必然过期。
    if (isGroupCall) {
        try {
            systemPrompt = stripPromptBlock(stripPromptBlock(systemPrompt, '群信息'), '群成员与职务');
            const groupOwnerKey = makeOwnerKey({ isGroup: true, groupId });
            if (isGroupEnabled(groupOwnerKey, 'murmur') && isCardEnabled(groupOwnerKey, 'group-info')) {
                const groupUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                const group = groupUser ? sdk.chatGroups?.get?.(groupUser, groupId, mode) : null;
                if (group) {
                    const { buildGroupAdminPromptBlock } = await import('./group-admin-service.js');
                    const block = buildGroupAdminPromptBlock({
                        sdk, user: groupUser, group, selfId: aiPersonId,
                    });
                    if (block) systemPrompt = `${systemPrompt}\n\n${wrapPromptBlock('群信息', block)}`.trim();
                }
            }
        } catch (err) {
            console.warn('[chat-ai-service] 注入群信息失败', err);
        }
    }

    // 1.7) 把「当前聊天回合」挪到最末尾。
    //      上面这些块全都是往末尾追加的，于是刚刚发生的对话被一堆背景资料压在了中间，
    //      离用户这句话最远。长上下文里模型对「最后出现」的内容最敏感，聊天记录理应
    //      占那个位置。pre 里它本来就排在最后一张卡，这里只是把追加打乱的顺序摆回去。
    try {
        if (hasPromptBlock(systemPrompt, '当前聊天回合')) {
            const rounds = readPromptBlock(systemPrompt, '当前聊天回合');
            if (rounds) {
                systemPrompt = stripPromptBlock(systemPrompt, '当前聊天回合');
                systemPrompt = `${systemPrompt}\n\n${wrapPromptBlock('当前聊天回合', rounds)}`.trim();
            }
        }
    } catch (err) {
        console.warn('[chat-ai-service] 归位当前聊天回合失败', err);
    }

    console.log('[chat-ai-service] systemPrompt ====== START ======');
    console.log(systemPrompt);
    console.log('[chat-ai-service] systemPrompt ====== END (length=' + systemPrompt.length + ') ======');

    // ★ v0.70 显示完整调用上下文,方便调试 mode 切换是否生效
    //   用户原话:「在用户打电话打视频的时候 console.log 也显示完整上下文」
    try {
        const cm = window.__chatContextMode;
        console.log('[chat-ai-service] fullContext ====== START ======');
        console.log({
            aiPersonId,
            mode,
            currentMode: cm?.getCurrentMode?.(),
            currentModePromptLength: cm?.getCurrentModePrompt?.()?.length,
            userText,
            systemPromptLength: systemPrompt.length,
            historyLimit,
            apiRef: getDefaultApiRef(aiPersonId),
        });
        console.log('[chat-ai-service] fullContext ====== END ======');
    } catch (_) {}

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

    // 3) 拼 messages（systemPrompt 就是 pre；本次用户输入单独作为 user message）
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

    const rawSegments = parseAiResponse(raw);

    // ── 黑匣子（氧气 blog）─────────────────────────────────────
    // `[黑匣子:…]` 是扮演结束后模型自己留下的话,**不是一条消息**。
    // 门闸:只在黑匣子 prompt 卡真的注入了**本轮** system prompt 时才剥离
    // （卡正文里带着字面量 `[黑匣子`,直接查发送文本最可靠）;
    // 卡关着时同形文本按普通文本显示,防误触发。
    // 剥离后送进氧气的黑匣子,带上本次调用真实使用的模型名;
    // 氧气未启用时它自己会静默丢弃。黑匣子内容永不回注任何 prompt。
    const blackboxInjected = systemPrompt.includes('[黑匣子');
    const allSegments = [];
    for (const seg of rawSegments) {
        if (seg && seg.type === 'blackbox') {
            if (!blackboxInjected) {
                allSegments.push({ type: 'text', text: `[黑匣子:${seg.text}]` });
                continue;
            }
            try {
                const keyInfo = window.__apiSdk?.apiKeySdk?.get?.(apiResp?.apiKeyId) || null;
                const aiInfo = sdk.aiPersons?.get?.(aiPersonId) || null;
                // fire-and-forget:写黑匣子失败不该拖住这一轮回复的渲染
                void window.__oxygenBlackbox?.append?.({
                    text: seg.text,
                    modelId: keyInfo?.model || '',
                    modelLabel: keyInfo?.label || keyInfo?.model || '',
                    aiPersonId,
                    aiName: aiInfo?.name || '',
                    mode,
                });
            } catch (err) {
                console.warn('[chat-ai-service] 黑匣子转交失败', err);
            }
            continue;
        }
        allSegments.push(seg);
    }

    // ★ v0.88 K 链:`[记忆:…]` 是 AI 顺手交回来的摘要,**不是一条消息**。
    //   必须在 segmentsToMessages 之前滤掉 —— 漏滤的话用户会看到一个
    //   装着三百字摘要的气泡(而且还会被存进聊天记录)。
    const memorySegments = allSegments.filter((s) => s && s.type === 'kchain_memory');
    const segments = allSegments.filter((s) => !s || s.type !== 'kchain_memory');

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

    // ★ v0.88 K 链:摘要要在 aiMessages **拿到时间戳之后**才落盘。
    //   `applySummary` 会把「计数起点」推到 lastAt,而这一轮 AI 消息的
    //   timestamp 已经在 segmentsToMessages 里定下来了 —— 起点必须盖过它们,
    //   否则刚被压进去的这一轮下次又被数成待压缩,触发间隔永远差一。
    if (memorySegments.length) {
        const merged = memorySegments.map((s) => s.text).filter(Boolean).join('\n');
        const newestAt = aiMessages.reduce((max, m) => Math.max(max, Number(m?.timestamp) || 0), 0);
        // fire-and-forget:写记忆失败不该拖住这一轮回复的渲染,
        // 下一轮 pending 还是够,会再要一次
        void window.__chatKChain?.ingest?.(aiPersonId, mode, merged, kChainPending, newestAt + 1);
    } else if (kChainRequested) {
        // 要了但没给。不报错(这一轮回复本身是好的),只留一条能搜到的记录
        console.warn('[chat-ai-service] 这一轮要求生成 K 链记忆,但 AI 没有返回 [记忆:…],下一轮会再要一次');
    }

    return {
        ok: true,
        raw,
        segments,
        messages: aiMessages,
        stats: {
            ...(apiResp?.usage || {}),
            apiKeyId: apiResp?.apiKeyId,
            groupId: apiResp?.groupId,
            latency: apiResp?.latency,
        },
        prompt: systemPrompt,
    };
}

// ============================================================
// ★ v0.72 重roll 工具
//   - 重roll 场景:删除该消息之后的所有消息,需要把 systemPrompt 里的
//     「当前聊天回合」段同步替换成"不含后续消息"的新回合
//   - 无状态工具:输入(原 systemPrompt, 新 contextRounds 文本) → 输出 newPrompt
// ============================================================

/**
 * 把 systemPrompt 里的「当前聊天回合」整段替换/插入成新文本
 *  - 段头锚:# 当前聊天回合(以 `# 当前聊天回合` 开头)
 *  - 段边界:遇到下一个 `---` 分割线 或 文本末尾(对", 1 回合 = 1 组用户 + 1 组 AI)"收尾)
 *  - 找不到旧段 → 在末尾追加
 *  - 若 newContextRounds 为空 → 直接把旧段删掉
 */
export function replaceContextRoundsInPrompt(systemPrompt, newContextRounds) {
    const src = String(systemPrompt || '');
    let next = String(newContextRounds || '').trim();
    // 去掉 newContextRounds 末尾可能多余的单换行(computeContextRoundsPrompt 用 join('\n') 会留一个 \n)
    next = next.replace(/[\r\n]+$/, '').trim();
    if (!src) return next ? wrapPromptBlock('当前聊天回合', next) : '';
    // ★ v0.87 新版 pre 每段都带 `<当前聊天回合开始>…<当前聊天回合结束>`,按标签整段换最稳。
    //   下面那套「找 # 标题 + 找下一个空行」的老逻辑留给还没刷新过的历史 pre。
    if (hasPromptBlock(src, '当前聊天回合')) {
        return replacePromptBlock(src, '当前聊天回合', next);
    }
    const startIdx = src.indexOf('# 当前聊天回合');
    if (startIdx === -1) {
        // 没有旧段 → 末尾追加
        return next ? (src.replace(/[\r\n]+$/, '') + '\n\n' + next) : src;
    }
    // 找段结束:从 startIdx 开始,找下一个 '\n\n' 双换行分隔符或文末
    let endIdx = src.length;
    const after = src.slice(startIdx);
    const doubleNl = after.indexOf('\n\n');
    if (doubleNl !== -1) {
        endIdx = startIdx + doubleNl;
    }
    const before = src.slice(0, startIdx).replace(/[\r\n]+$/, '');
    const afterOk = src.slice(endIdx).replace(/^[\r\n]+/, '');
    if (!next) {
        return afterOk ? (before + '\n\n' + afterOk) : before;
    }
    const parts = [before, next, afterOk].filter(Boolean);
    return parts.join('\n\n');
}

/**
 * ★ v0.72 重roll 用:重算 contextRounds + 替换 systemPrompt 的对应段 + 写回 contextPreview 缓存
 *   - 输入:旧系统 prompt(可空)、新的 messages 列表(已删除后续)、{ aiPersonId, mode }
 *   - 必须传入 computeContextRoundsPrompt 来生成新回合文本(由 chat-app 注入,避免循环依赖)
 *   - 返回:新的 systemPrompt 文本(同时已 writeContextPreview 写回缓存,后续 callAiAndSplit 直接读到新值)
 */
export function recomputeContextPreviewAfterReroll({
    aiPersonId,
    mode = 'calendar',
    messages,
    oldSystemPrompt,
    computeContextRoundsPrompt,
}) {
    let newRounds = '';
    try {
        if (typeof computeContextRoundsPrompt === 'function') {
            newRounds = computeContextRoundsPrompt(aiPersonId, messages || [], undefined) || '';
        }
    } catch (_) {
        newRounds = '';
    }
    // 旧 prompt: 优先用调用方传入;否则从缓存/DOM 读
    let base = String(oldSystemPrompt || '');
    if (!base) {
        try {
            base = readContextPreview({ aiPersonId, mode }) || '';
        } catch (_) {
            base = '';
        }
    }
    const next = replaceContextRoundsInPrompt(base, newRounds);
    try {
        writeContextPreview(aiPersonId, mode, next);
    } catch (_) { /* 忽略,继续返回 next */ }
    return next;
}

// ============================================================
// ★ v0.79 AI 朋友圈概要生成
//   - 由 chat-asset-service.aiSendMoment 在后台异步调用
//   - 走 settings-sdk 的 API(跟 chat.js 旧版 generateKChainSummary 同款路径)
//   - 默认返回「空 summary」 — 用户可手动调 regenerateMomentSummary 重生成
//   - 主题去重由 prompt-builder 注入的 AI_MOMENTS_INSTRUCTIONS + AI 已发过的概要本身保证
// ============================================================

/**
 * 为某条朋友圈生成概要
 * @param {object} opts
 * @param {string} opts.aiPersonId
 * @param {string} opts.momentId
 * @param {string} opts.content    朋友圈正文
 * @param {string} [opts.mode]     'calendar' | 'story'
 * @returns {Promise<{ok:boolean, summary?:string, error?:string}>}
 */
export async function _generateMomentSummary({ aiPersonId, momentId, content, mode = 'calendar' }) {
    if (!aiPersonId || !momentId) return { ok: false, error: '参数缺失' };
    const sdk = window.settingsSdk;
    if (!sdk) return { ok: false, error: 'SDK 未就绪' };

    // ★ 默认实现:留空 summary
    //   - 不调 LLM(节省 token / 防止 LLM 误生成超长概要)
    //   - 用户可手动调 chat-asset-service.regenerateMomentSummary 重生成
    //   - prompt-builder 的 _renderAiMomentsContextBlock 只取有 summary 的条目
    //   - summary 留空时,prompt 里 AI 朋友圈上下文段为空,不会注入
    //   - 这样既实现了「防 AI 朋友圈过多 / 防重复主题」(因为列表里只有 summary 非空的才会被注入)
    //     又保留了完整原文(aiPerson.moments[].content)在朋友圈列表页显示
    //
    // ★ 真实 LLM 生成版(本期不接 — 留空 + 控制台 debug):
    //   const apiRef = getDefaultApiRef(aiPersonId);
    //   if (!apiRef) return { ok: false, error: '未配置 API' };
    //   const sys = '你是一个朋友圈概要生成助手。输出一句话概要(20字以内),只描述主题和情绪。';
    //   const user = `朋友圈正文:${content}\n请输出一句话概要:`;
    //   const resp = await executeApiRequest(apiRef, sys, user);
    //   await sdk.moments.setSummary(aiPersonId, momentId, resp);
    //   return { ok: true, summary: resp };
    return { ok: true, summary: '' };
}
