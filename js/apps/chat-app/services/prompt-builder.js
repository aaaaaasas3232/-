/**
 * chat-app / 回复提示词构造器（v0.50）
 *
 *   业务含义:AI SDK 在生成回复前,需要构造一份完整的 system prompt。
 *   旧的 chat.js 把「人设上下文 + 近期聊天 + 心情 + 天气 + 日程 + 朋友圈 + AI 朋友圈
 *   + 启用的 replyPrompts」全部拼到一个长文本里,扔给 AI。
 *
 *   v0.50 把它拆出来独立服务,好处:
 *     - 不依赖 chat.js(大泥球)
 *     - 业务字段有 SDK 数据兜底(settingsSdk.users / aiPersons / worlds /
 *       chatMessages / schedule / defaultUserCard 等)
 *     - 暴露给 window.__chatPromptBuilder,任何 AI SDK 集成只需:
 *         const prompt = await window.__chatPromptBuilder.build({
 *             aiPersonId, mode, userId, historyLimit: 12
 *         });
 *     - 测试期:不调 AI SDK 时直接打印 prompt 验证
 *
 *   ★ 本服务**不**调用任何 AI 接口,只做字符串拼装。拼装好的 prompt 由 chat-app
 *     在 sendReply / mockReply 时传给 AI SDK(后续接入)。
 *
 * 上下文拼装顺序(从「最重要 → 最次要」):
 *   1. AI 人设本体(8字段:name/gender/age/appearance/personality/bio/experience/avatar)
 *   2. 用户人设本体
 *   3. 世界观背景(boundWorld)
 *   4. AI 当前模块(enabled 的模块:preferences/mood/memory/worldview/mbti/...)
 *   5. 用户当前模块(同上)
 *   6. 近期聊天(用户/AI 最新 N 条,text)
 *   7. AI 当前心情(dailyMood)
 *   8. 用户当前心情(dailyMood)
 *   9. AI 当前日程(schedule.today)
 *   10. 用户当前日程(schedule.today)
 *   11. AI 朋友圈(最近几条)
 *   12. 用户朋友圈(最近几条)
 *   13. 【关键】已启用的 replyPrompts(active=true, 按 order 升序)
 *   14. 特殊动作格式说明(红包/位置/转账/语音/图描述 触发指令格式)
 *
 * 特殊动作格式(★ 与 chat.js 的 prompt 保持一致):
 *   - 发红包      [发红包:金额(数字):祝福语]
 *   - 发位置      [发位置:地点名:详细地址]
 *   - 转账        [转账:金额(数字):备注]
 *   - 发语音      [发语音:秒数:文字内容]
 *   - 发图片描述  [发图片:卡片颜色:文字颜色:描述内容]
 *   - 引用回复    [引用:消息id:回复内容]
 *
 *   这部分是「Prompt 模板约定」,与 chat.js 一致,后期接 AI SDK 时直接复用。
 *
 * 依赖:
 *   - window.settingsSdk(必须,可空)
 *   - chatAppContext(可选,例如用户操作场景下的额外 ctx)
 *
 * 暴露 API:
 *   build(opts)                -> { systemPrompt, parts, stats }
 *   buildPreview(aiPersonId)   -> string(只拼装前 5 段,用于 prompt-manager 顶部预览)
 *
 * 错误兜底:
 *   - sdk 不存在 → 返回基础 prompt(只有 replyPrompts + 特殊动作格式)
 *   - 人设不存在 → 返回 null(由调用方决定怎么处理)
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================================
// 特殊动作格式说明(所有 AI 共享)
// ============================================================

// ★ v0.62.x 短句聊天风格指令(跟「回复格式提示」并列,告诉 AI 不要写长段,要像真人微信聊天)
export const REPLY_STYLE_INSTRUCTIONS = `# 回复风格指令

## 短句为主,分多条发送
- 单条消息**不要**超过 30 字,**严禁**写完整段落或长篇大论。
- 把一句话拆成 2~4 条短消息发,每条之间用换行分隔(每行会被系统识别为独立气泡)。
- 真人聊天就是「短句 + 多条」,不是「一段话一次说完」。

## 口语化,不要书面语
- 用「嗯」「啊」「哦」「哈哈」「那个」「就」「嘛」等语气词。
- 用「…」「～」「??」「!!」等口语标点代替书面标点。
- **禁止**用「。」「首先/其次/最后」「综上所述」「因此」等书面表达。

## 节奏感(不要一次性把所有信息发完)
- 想说什么就发一条,**不要**把所有内容塞一条消息里。
- 一轮回复建议 3~8 条短消息,信息量大时也可以再多。
- 像发微信一样「一句一句往外蹦」,而不是「写了一封信整段发出去」。

> 你可以**同时**在一条消息里用多条短句 + 特殊动作,例如:
>   "生日快乐！[发红包:66:恭喜恭喜]\n记得今天要开心啊\n我给你点了个小蛋糕 [发图片:#FFE4EC:#D4728A:一个粉色蛋糕]"`;

export const SPECIAL_ACTIONS_HELP = `# 可调用的特殊消息格式(必须严格按照格式输出,否则系统无法识别)

- 发红包  : [发红包:金额:祝福语]          例:[发红包:88:恭喜发财]
- 发位置  : [发位置:地点名:详细地址]      例:[发位置:星巴克:北京市朝阳区xxx店]
- 转账    : [转账:金额:备注]              例:[转账:100:本月生活费]
- 发语音  : [发语音:秒数:文字内容]        例:[发语音:15:今天好累啊]
- 发图片  : [发图片:背景色:文字色:描述]    例:[发图片:#FFE4EC:#D4728A:夕阳下的咖啡杯]
- 发表情包: [表情包:表情名称]             例:[表情包:狗-哭]  ← 必须用「表情包库」里你**已有**的名称
- 引用回复: [引用:消息id:回复内容]         例:[引用:msg-abc:刚才那句话我没听清]
- 分享聊天记录: [分享聊天记录:本会话最近N条]  例:[分享聊天记录:最近5条]
- 分享音乐: [分享音乐:歌名:歌手]          例:[分享音乐:晴天:周杰伦]

> 你可以**同时**输出多条特殊动作 + 文本,例如:
>   "生日快乐！[发红包:66:恭喜恭喜] [发图片:#FFE4EC:#D4728A:一个粉色蛋糕] [表情包:开心]"

> 关于表情包:
>   - 只能发送「表情包库」里**已经列出**的表情名称,系统会按名称查找图片。
>   - 如果用户发了你没见过的表情,系统会**自动帮你偷过来**,你直接用相同名称发送即可。
>   - 不要**自创**不在表情包库里、用户也没发过的表情名称(系统会找不到图片,显示空白)。`;

/**
 * ★ v0.62.x 渲染「回复格式 + 短句风格」合并块(给 system prompt 末尾注入)
 *   - 顺序:特殊动作格式说明 → 短句风格指令
 *   - AI 默认启用(走 opts.replyFormatInject 默认全 true)
 *   - 任一开关关闭 → 返回空字符串(不注入)
 */
function _renderReplyFormatBlock(replyFormatInject) {
    const enabled = !replyFormatInject || replyFormatInject.enabled !== false;
    if (!enabled) return '';
    return [SPECIAL_ACTIONS_HELP, REPLY_STYLE_INSTRUCTIONS].join('\n\n');
}

/**
 * ★ v0.64 渲染「AI 表情包库」段(告诉 AI 它「可以发什么表情包」)
 *
 * 业务背景:
 *   - 表情包资源分两端绑:
 *     · 用户人设 boundResources.stickerGroupIds → 用户用 emoji-picker 选
 *     · AI 人设 boundResources.stickerGroupIds → AI 可以发哪些
 *   - 用户自己也可以发任意表情(只要用户资源里有),AI 看到后会「偷」到自己资源里
 *   - AI 资源里的表情分组是「整套绑定」:用户绑了「狗-哭/猫-打滚」整组,AI 偷过来也按整组算
 *
 * 数据流:
 *   - 读 aiPerson.boundResources.stickerGroupIds
 *   - 异步查 gallery_db:每个 groupId 对应一个 group,里面有多个 image(code + name)
 *   - name 约定:image.name || image.stickerName || code(没有 name 时用 code 凑)
 *     实际上 emoji-picker 那边是用 image.code 做持久化引用,所以这里也得用 code
 *   - 输出文本格式:
 *     # 表情包库(共 N 张)
 *     - 狗-哭   (code:grp_xxx_img_001)
 *     - 猫-打滚 (code:grp_xxx_img_002)
 *     ...
 *     [表情包:名称]   ← 告诉 AI 想发哪张,直接用「名称」这一列
 *
 * 关闭开关:
 *   - opts.stickerLibraryInject = { enabled: false } → 返回空字符串
 *   - 默认 true(跟 replyFormatInject 同款兜底)
 *
 * @param {string} aiPersonId
 * @param {object} [opts.stickerLibraryInject] { enabled: bool }
 * @returns {Promise<string>}
 */
async function _renderAiStickerLibraryBlock(aiPersonId, stickerLibraryInject) {
    const enabled = !stickerLibraryInject || stickerLibraryInject.enabled !== false;
    if (!enabled) return '';
    if (!aiPersonId) return '';

    const sdk = _getSdk();
    if (!sdk) return '';

    let ai = null;
    try { ai = sdk.aiPersons?.get?.(aiPersonId); } catch (_) {}
    if (!ai) return '';

    const ids = Array.isArray(ai.boundResources?.stickerGroupIds)
        ? ai.boundResources.stickerGroupIds
        : [];
    if (ids.length === 0) {
        // ★ v0.64 没绑表情包时也要输出完整的「可以使用表情包」指令
        //   - 用户原话:「就算没有 ai 表情包绑定 你也要先有那个表情包相关的指令吧」
        //   - 「比如你的表情包有哪些哪些 如果你看到了用户使用表情包 你也想用也可以发」
        //   - 行为:
        //     · 告诉 AI 你**当前没有任何表情包**
        //     · 但你**完全可以发**[表情包:名称] 这种格式
        //     · 当你看到用户发了一个你没见过的表情包,你也可以**主动跟着发同款** —
        //       系统会从用户那里「偷」这个表情(把用户那张图的整个图组加到你的资源里),
        //       然后帮你正常发送,不需要 AI 自己造表情名称
        //     · 输出 [表情包:名称] 时,优先复用「近期聊天里用户发过的表情包名称」
        return `# 表情包库

(你还没有表情包资源。用户偶尔会发表情包,你可以学着使用 [表情包:名称] 格式 — 系统会**自动从用户那里偷过来**你喜欢的表情,自动加进你的资源库。请优先复用用户最近发过的表情名称。)`;
    }

    // 异步加载 group 内的 image 列表(name + code)
    let entries = [];
    try {
        const { getAlbumGroups, getGroupImages } = await import('../../setting/gallery/gallery-db.js');
        // 需要先知道 group 名称 → 走 getAlbumGroups 反查 album / library
        // 简化:我们只要 image 列表(name/code),不需要 group 名称(用户视角按 code 就行)
        for (const gid of ids) {
            try {
                const imgs = await getGroupImages(gid);
                for (const img of imgs || []) {
                    const code = String(img.code || '');
                    if (!code) continue;
                    const name = String(img.name || img.stickerName || code);
                    entries.push({ name, code, groupId: gid });
                }
            } catch (_) { /* 跳过单个 group 失败 */ }
        }
    } catch (err) {
        console.warn('[prompt-builder] load sticker library failed:', err);
    }

    if (entries.length === 0) {
        return `# 表情包库

(你的资源组暂无图片 — 可能图组是空的或已被删除。)`;
    }

    // 限制条数,防止 prompt 过长(emoji-picker 那边不会无限多,顶多几十张)
    const limited = entries.slice(0, 60);
    const lines = limited.map((e) => `- ${e.name}   (code:${e.code})`);
    return [
        `# 表情包库(共 ${entries.length} 张,显示前 ${limited.length} 张)`,
        '',
        '你可以用 [表情包:名称] 格式发送表情包,系统会自动查找对应的图片。',
        '**优先**复用你资源里已有的名称。如果你想发的表情不在列表里,但用户最近发过,系统会**自动帮你「偷」过来**(把用户那张图加入你的资源库)。',
        '',
        ...lines,
    ].join('\n');
}

// ============================================================
// 内部工具
// ============================================================

function _getSdk() {
    if (typeof window === 'undefined') return null;
    return window.settingsSdk || null;
}

function _safeString(v, fallback = '') {
    if (v == null) return fallback;
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return fallback;
}

function _dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * 把对象里 enabled=true 的模块抽成可注入的 prompt 段。
 *   moduleMeta = { enabled, injectMode, ...fields }
 *   injectMode: 'none' 不注入 | 'current' 只注入当前状态 | 'full' 完整数据
 *
 * @returns {string[]}
 */
function _injectModules(persona) {
    if (!persona) return [];
    const out = [];
    const modules = ['preferences', 'mood', 'memory', 'worldview', 'mbti', 'psychological', 'moral', 'skills', 'space'];
    for (const k of modules) {
        const m = persona[k];
        if (!m || m.enabled === false) continue;
        if (m.injectMode === 'none') continue;
        if (k === 'preferences') {
            const hobbies = Array.isArray(m.hobbies) ? m.hobbies : [];
            const likes = Array.isArray(m.likes) ? m.likes : [];
            const dislikes = Array.isArray(m.dislikes) ? m.dislikes : [];
            const allergies = Array.isArray(m.allergies) ? m.allergies : [];
            if (hobbies.length || likes.length || dislikes.length || allergies.length) {
                const lines = [];
                if (hobbies.length) lines.push(`  - 爱好: ${hobbies.join('、')}`);
                if (likes.length) lines.push(`  - 喜欢: ${likes.join('、')}`);
                if (dislikes.length) lines.push(`  - 不喜欢: ${dislikes.join('、')}`);
                if (allergies.length) lines.push(`  - 过敏: ${allergies.join('、')}`);
                out.push(`# 偏好\n${lines.join('\n')}`);
            }
        } else if (k === 'mood') {
            if (m.injectMode === 'current' && persona.dailyMood) {
                out.push(`# 当前心情\n- ${persona.dailyMood}`);
            } else if (m.text) {
                out.push(`# 心情档案\n${m.text}`);
            }
        } else if (m.text) {
            out.push(`# ${k}\n${m.text}`);
        } else if (m.description) {
            out.push(`# ${k}\n${m.description}`);
        }
    }
    return out;
}

/**
 * 渲染 AI 人设 8 字段本体
 */
function _renderPersona8Fields(label, persona) {
    if (!persona) return '';
    const lines = [];
    lines.push(`# ${label}`);
    if (persona.name) lines.push(`- 姓名: ${persona.name}`);
    if (persona.gender) lines.push(`- 性别: ${persona.gender}`);
    if (persona.age) lines.push(`- 年龄: ${persona.age}`);
    if (persona.appearance) lines.push(`- 外貌: ${persona.appearance}`);
    if (persona.personality) lines.push(`- 性格: ${persona.personality}`);
    if (persona.bio) lines.push(`- 简介: ${persona.bio}`);
    if (persona.experience) lines.push(`- 经历: ${persona.experience}`);
    return lines.join('\n');
}

/**
 * 渲染世界观简述
 */
function _renderWorld(world) {
    if (!world) return '';
    const lines = [`# 世界观背景`];
    lines.push(`- 名称: ${world.name || world.id}`);
    if (world.summary) lines.push(`- 摘要: ${world.summary}`);
    if (Array.isArray(world.keyPoints) && world.keyPoints.length) {
        lines.push(`- 关键设定:`);
        for (const kp of world.keyPoints) lines.push(`  * ${kp}`);
    }
    return lines.join('\n');
}

/**
 * 渲染当前日程(从 sdk.schedule 拉)
 *   schedule.list({ entityType, entityId, date }) → Array
 */
function _renderSchedule(sdk, entityType, entityId) {
    if (!sdk?.schedule?.list) return '';
    try {
        const today = _dateKey();
        const list = sdk.schedule.list({ entityType, entityId, date: today }) || [];
        if (!Array.isArray(list) || list.length === 0) return '';
        const lines = [`# 今日日程(${today})`];
        for (const item of list.slice(0, 5)) {
            const time = _safeString(item.time || item.startTime || '');
            const title = _safeString(item.title || item.name || '');
            if (title) lines.push(`- ${time ? time + ' ' : ''}${title}`);
        }
        return lines.join('\n');
    } catch (_) {
        return '';
    }
}

/**
 * 渲染朋友圈(占位,实际项目里有 sdk.moments 等模块时再接)
 *   现在阶段返回空 → 给未来 SDK 接入预留 hook
 */
function _renderMoments(_sdk, _entityType, _entityId) {
    // TODO: 接入朋友圈 SDK 后替换这里
    return '';
}

/**
 * 渲染近期聊天历史
 * ★ v0.61.8.11 修复:特殊消息永远显示完整内容,不做「空 content 才显示」的条件判断
 *   - 表情包:显示 [表情包]名字 或 [表情包]
 *   - 位置:显示 [位置]地点名 或 [位置]
 *   - 图片:显示 [图片]描述 或 [图片]
 *   - 语音:显示 [语音 秒数]内容 或 [语音 秒数]
 *   - 红包/转账:显示 [红包/转账 ¥金额]祝福语
 */
function _renderRecentHistory(messages, limit = 12) {
    if (!Array.isArray(messages) || messages.length === 0) return '';
    const recent = messages.slice(-limit);
    const lines = [`# 近期聊天(最近 ${recent.length} 条)`];
    for (const m of recent) {
        const who = m.sender === 'ai' ? 'AI' : '用户';
        const text = _safeString(m.content || '');

        // 表情包(优先显示,不看 content 是否为空)
        if (m.stickerCode || m.type === 'sticker') {
            const stickerName = _safeString(m.stickerName || m.stickerCode || '表情包');
            const emoji = _safeString(m.metadata?.emoji || '');
            const display = emoji ? `${stickerName}${emoji}` : stickerName;
            lines.push(`- ${who}: [表情包]${display}`);
            continue;
        }

        // 位置
        if (m.locationCard || m.type === 'location') {
            const name = _safeString(m.locationCard?.name || '');
            const address = _safeString(m.locationCard?.address || '');
            const display = name || address || '位置';
            lines.push(`- ${who}: [位置]${display}`);
            continue;
        }

        // 图片描述
        if (m.imageDescription || (m.type === 'image' && !m.url)) {
            const desc = _safeString(m.imageDescription || '');
            lines.push(`- ${who}: [图片]${desc || '图片'}`);
            continue;
        }

        // 语音
        if (m.voiceContent || m.voiceDuration || m.type === 'voice') {
            const content = _safeString(m.voiceContent || '');
            const duration = _safeString(m.voiceDuration || m.duration || '');
            const display = content
                ? `[语音 ${duration}s]${content}`
                : `[语音 ${duration}s]`;
            lines.push(`- ${who}: ${display}`);
            continue;
        }

        // 红包
        if (m.redpacketCard || m.type === 'redpacket') {
            const amount = _safeString(m.redpacketCard?.amount || '');
            const bless = _safeString(m.redpacketCard?.blessing || '');
            const display = bless ? `${amount}元 ${bless}` : `${amount}元`;
            lines.push(`- ${who}: [红包 ¥${display}]`);
            continue;
        }

        // 转账
        if (m.transferCard || m.type === 'transfer') {
            const amount = _safeString(m.transferCard?.amount || '');
            const note = _safeString(m.transferCard?.note || '');
            const display = note ? `${amount}元 ${note}` : `${amount}元`;
            lines.push(`- ${who}: [转账 ¥${display}]`);
            continue;
        }

        // ★ v0.61.8.13 聊天记录(分享的对话快照)
        //   卡片本身 m.type='text' + m.content='[聊天记录]'(或空),真实内容在 m.chatRecord.messages[]
        //   展开成多行:标题 + 每条「发送者: 内容」
        if (m.chatRecord && Array.isArray(m.chatRecord.messages) && m.chatRecord.messages.length > 0) {
            const cr = m.chatRecord;
            const crTitle = _safeString(cr.title || '聊天记录');
            lines.push(`- ${who}: [聊天记录:${crTitle}]`);
            for (const inner of cr.messages) {
                if (!inner) continue;
                const innerWho = inner.sender === 'ai' ? 'AI' : (inner.sender === 'user' ? '用户' : _safeString(inner.senderName || inner.sender || '?'));
                const innerType = _safeString(inner.type || 'text');
                let innerText = _safeString(inner.content || '');
                // 内部消息也可能包含特殊类型(表情包/语音/位置 等),走同样的渲染逻辑
                if (inner.stickerCode || innerType === 'sticker') {
                    const sname = _safeString(inner.stickerName || inner.stickerCode || '表情包');
                    innerText = `[表情包]${sname}`;
                } else if (inner.locationCard || innerType === 'location') {
                    const nm = _safeString(inner.locationCard?.name || '');
                    innerText = `[位置]${nm || '位置'}`;
                } else if (inner.imageDescription) {
                    innerText = `[图片]${_safeString(inner.imageDescription || '')}`;
                } else if (inner.voiceContent || inner.voiceDuration || innerType === 'voice') {
                    const vc = _safeString(inner.voiceContent || '');
                    const vd = _safeString(inner.voiceDuration || inner.duration || '');
                    innerText = vc ? `[语音 ${vd}s]${vc}` : `[语音 ${vd}s]`;
                } else if (inner.redpacketCard || innerType === 'redpacket') {
                    const amt = _safeString(inner.redpacketCard?.amount || '');
                    const bless = _safeString(inner.redpacketCard?.blessing || '');
                    innerText = `[红包 ¥${amt}元 ${bless}]`;
                } else if (inner.transferCard || innerType === 'transfer') {
                    const amt = _safeString(inner.transferCard?.amount || '');
                    const note2 = _safeString(inner.transferCard?.note || '');
                    innerText = `[转账 ¥${amt}元 ${note2}]`;
                }
                if (!innerText) innerText = `[${innerType}]`;
                if (innerText.length > 240) innerText = innerText.slice(0, 240) + '…';
                lines.push(`  - ${innerWho}: ${innerText}`);
            }
            continue;
        }

        // ★ v0.61.8.13 通话记录
        //   卡片 m.type='call_record' + m.callRecord{callType, duration, wasConnected, ...}
        if (m.callRecord || m.type === 'call_record') {
            const cr = m.callRecord || {};
            const callType = cr.callType === 'video' ? '视频通话' : '语音通话';
            const connected = cr.wasConnected === false ? '未接通' : '已接通';
            const dur = Number(cr.duration) || 0;
            const durText = dur > 0 ? `${Math.floor(dur / 60)}分${dur % 60}秒` : '';
            lines.push(`- ${who}: [${callType} ${connected}${durText ? ' ' + durText : ''}]`);
            continue;
        }

        // 普通文本:简短截断防超长
        let display = text;
        if (display.length > 240) display = display.slice(0, 240) + '…';
        if (!display) display = `[${_safeString(m.type || 'message')}]`;
        lines.push(`- ${who}: ${display}`);
    }
    return lines.join('\n');
}

/**
 * 渲染 replyPrompts(active=true,按 order)
 */
function _renderActivePrompts(list) {
    if (!Array.isArray(list) || list.length === 0) return '';
    const lines = [`# 回复提示词(用户已启用,按顺序拼接到回复前)`];
    list.forEach((p, i) => {
        lines.push(`\n## [${i + 1}] ${_safeString(p.title || '未命名')}(source: ${_safeString(p.source || 'custom')})`);
        const content = _safeString(p.content || '');
        lines.push(content);
    });
    return lines.join('\n');
}

/**
 * ★ v0.61.3 渲染概要列表(calendarSummaries / storySummaries 共用)
 *   - 每条 [i] 标题 + dateRange / messageCount + content
 */
function _renderSummaryList(label, list) {
    if (!Array.isArray(list) || list.length === 0) return '';
    const lines = [`# ${label}(用户已启用,按 order 升序)`];
    list.forEach((s, i) => {
        const title = _safeString(s.title || '未命名');
        const content = _safeString(s.content || '');
        const meta = (s.dateRange && (s.dateRange.start || s.dateRange.end))
            ? ` (${_safeString(s.dateRange.start || '')} ~ ${_safeString(s.dateRange.end || '')})`
            : '';
        const msg = (s.messageCount != null && s.messageCount > 0) ? ` · ${s.messageCount} 条` : '';
        lines.push(`\n## [${i + 1}] ${title}${meta}${msg}`);
        if (content) lines.push(content);
    });
    return lines.join('\n');
}

/**
 * ★ v0.61.3 实时计算「当前聊天回合」prompt 文本
 *   - 回合定义:从最新到最旧,连续的同一侧消息归一组;当 sender 切到另一边时新一组开始
 *   - 取最近 contextRounds 个回合,拼成可注入的文本
 *
 *   ★ v0.61.8.12 仅取「今天的聊天记录」,过滤掉历史日期的消息
 *     - 8.8 来用的时候不会混进 8.7 / 8.6 的旧记录
 *     - 过滤基准 = 调用方本地时区的今天 00:00:00 ~ 23:59:59.999
 */
function _computeContextRoundsPrompt(_aiPersonId, messages = [], contextRounds = 20) {
    const list = Array.isArray(messages) ? messages.slice() : [];
    if (list.length === 0) return '';
    // ★ v0.61.8.12 只保留今天的聊天记录
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const todayList = list.filter((m) => {
        const ts = Number(m && m.timestamp) || 0;
        return ts >= dayStart && ts <= dayEnd;
    });
    if (todayList.length === 0) return '';
    // 按时间升序
    todayList.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    const rounds = [];
    let cur = [];
    let curSender = null;
    for (const m of todayList) {
        if (!m || m.sender == null) continue;
        if (m.sender !== curSender && cur.length > 0) {
            rounds.push(cur);
            cur = [];
        }
        cur.push(m);
        curSender = m.sender;
    }
    if (cur.length > 0) rounds.push(cur);
    const start = Math.max(0, rounds.length - contextRounds);
    const picked = rounds.slice(start);
    if (picked.length === 0) return '';
    const lines = [`# 当前聊天回合(最近 ${picked.length} / ${contextRounds} 回合,1 回合 = 1 组用户 + 1 组 AI)`];
    picked.forEach((round, i) => {
        for (const m of round) {
            const sender = m.sender === 'ai' ? 'AI' : '用户';
            // ★ v0.61.8.13 特殊消息(聊天记录 / 通话记录)走专门分支
            if (m.chatRecord && Array.isArray(m.chatRecord.messages) && m.chatRecord.messages.length > 0) {
                const cr = m.chatRecord;
                const crTitle = _safeString(cr.title || '聊天记录');
                lines.push(`- ${sender}: [聊天记录:${crTitle}]`);
                for (const inner of cr.messages) {
                    if (!inner) continue;
                    const innerWho = inner.sender === 'ai' ? 'AI' : (inner.sender === 'user' ? '用户' : _safeString(inner.senderName || inner.sender || '?'));
                    let innerText = _safeString(inner.content || '').replace(/\s+/g, ' ').trim();
                    if (inner.stickerCode || inner.type === 'sticker') {
                        innerText = `[表情包]${_safeString(inner.stickerName || inner.stickerCode || '表情包')}`;
                    } else if (inner.locationCard || inner.type === 'location') {
                        innerText = `[位置]${_safeString(inner.locationCard?.name || '位置')}`;
                    } else if (inner.imageDescription) {
                        innerText = `[图片]${_safeString(inner.imageDescription)}`;
                    } else if (inner.voiceContent || inner.voiceDuration || inner.type === 'voice') {
                        const vc = _safeString(inner.voiceContent || '').replace(/\s+/g, ' ').trim();
                        const vd = _safeString(inner.voiceDuration || inner.duration || '');
                        innerText = vc ? `[语音 ${vd}s]${vc}` : `[语音 ${vd}s]`;
                    } else if (inner.redpacketCard || inner.type === 'redpacket') {
                        const amt = _safeString(inner.redpacketCard?.amount || '');
                        const bless = _safeString(inner.redpacketCard?.blessing || '');
                        innerText = `[红包 ¥${amt}元 ${bless}]`;
                    } else if (inner.transferCard || inner.type === 'transfer') {
                        const amt = _safeString(inner.transferCard?.amount || '');
                        const note2 = _safeString(inner.transferCard?.note || '');
                        innerText = `[转账 ¥${amt}元 ${note2}]`;
                    }
                    if (!innerText) innerText = `[${_safeString(inner.type || 'text')}]`;
                    if (innerText.length > 160) innerText = innerText.slice(0, 160) + '…';
                    lines.push(`  - ${innerWho}: ${innerText}`);
                }
                continue;
            }
            if (m.callRecord || m.type === 'call_record') {
                const cr = m.callRecord || {};
                const callType = cr.callType === 'video' ? '视频通话' : '语音通话';
                const connected = cr.wasConnected === false ? '未接通' : '已接通';
                const dur = Number(cr.duration) || 0;
                const durText = dur > 0 ? `${Math.floor(dur / 60)}分${dur % 60}秒` : '';
                lines.push(`- ${sender}: [${callType} ${connected}${durText ? ' ' + durText : ''}]`);
                continue;
            }
            const text = String(m.content || '').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            const short = text.length > 160 ? text.slice(0, 160) + '…' : text;
            lines.push(`- ${sender}: ${short}`);
        }
        if (i < picked.length - 1) lines.push('---');
    });
    return lines.join('\n');
}

// ============================================================
// 主 API
// ============================================================

/**
 * 拼装完整的 system prompt
 * @param {object} opts
 * @param {string} opts.aiPersonId    必填
 * @param {'calendar'|'story'} [opts.mode='calendar']
 * @param {number} [opts.historyLimit=12]
 * @param {string} [opts.userId]      可选,默认拿 defaultUserCard.getDefault()
 * @param {object} [opts.systemPromptInject] { user: bool, ai: bool } 系统 prompt 注入开关
 * @param {object} [opts.replyFormatInject] { enabled: bool } 「回复格式 + 短句风格」注入开关
 *                                            默认启用(开启 = 注入到 systemPrompt 末尾)
 *                                            false 时不注入(给「完全禁用」场景)
 * @param {object} [opts.kChainInject] { enabled: bool } 「K 链摘要」注入开关(v0.63.2 新增)
 *                                            默认 true;false 时不注入 K 链文本到 systemPrompt
 *                                            (prompt-manager 上 K 链卡的 toggle 就是这个)
 * @returns {object} { systemPrompt, parts, stats }
 */
export async function buildReplyPromptsPrompt(opts = {}) {
    const aiPersonId = _safeString(opts.aiPersonId || '');
    const mode = opts.mode === 'story' ? 'story' : 'calendar';
    const historyLimit = Number(opts.historyLimit) || 12;
    const sdk = _getSdk();

    // 兜底:SDK 不存在 → 退化为最简 prompt
    if (!sdk) {
        const fallback = [
            '# 注意:设置 SDK 未就绪,上下文为空',
            '',
            SPECIAL_ACTIONS_HELP,
        ].join('\n\n');
        return {
            systemPrompt: fallback,
            parts: { sdkMissing: true },
            stats: { activeReplyPrompts: 0, totalHistory: 0 },
        };
    }

    // 1. AI 人设
    const aiPerson = sdk.aiPersons?.get?.(aiPersonId) || null;
    if (!aiPerson) {
        return {
            systemPrompt: `# 错误:未找到 AI 人设 "${escapeHtml(aiPersonId)}"`,
            parts: { aiPersonMissing: true },
            stats: { activeReplyPrompts: 0, totalHistory: 0 },
        };
    }

    // 2. 用户
    const userId = opts.userId
        || sdk.defaultUserCard?.getDefault?.()?.id
        || sdk.users?.getActive?.()?.id
        || '';
    const user = userId ? sdk.users?.get?.(userId) || null : null;

    // 3. 世界观
    const worldId = aiPerson.boundWorldId || user?.boundWorldId || '';
    const world = worldId ? sdk.worlds?.get?.(worldId) || null : null;

    // 4-5. AI / 用户 模块上下文
    const aiModules = _injectModules(aiPerson);
    const userModules = user ? _injectModules(user) : [];

    // 6. 近期聊天
    const messages = (sdk.chatMessages?.list && user)
        ? sdk.chatMessages.list(user, aiPersonId, mode) || []
        : [];

    // 7-8. 心情
    const aiMood = _safeString(aiPerson.dailyMood || '');
    const userMood = user ? _safeString(user.dailyMood || '') : '';

    // 9-10. 日程
    const aiSchedule = _renderSchedule(sdk, 'ai', aiPersonId);
    const userSchedule = user ? _renderSchedule(sdk, 'user', userId) : '';

    // 11-12. 朋友圈(预留 hook)
    const aiMoments = _renderMoments(sdk, 'ai', aiPersonId);
    const userMoments = user ? _renderMoments(sdk, 'user', userId) : '';

    // 13. nook 分组 prompt（包含虚拟人设/世界观及自定义 nook 条目）
    const nookPrompts = sdk.nookSdk?.prompts?.list?.(aiPersonId) || [];
    const activePrompts = nookPrompts.filter((p) => p && p.active !== false);

    // ★ v0.61.3 概要系统注入项(共 4 块,active=true 才注入)
    //   - calendarSummaries  日历概要(active 的 calendar summaries)
    //   - storySummaries     故事概要(active 的 story summaries)
    //   - rollingSummaries   滚动摘要 K 链(buildKChainContext)
    //   - contextRounds      「当前聊天回合」实时计算的 prompt 文本
    const calActiveList = sdk.calendarSummaries?.listActive?.(aiPersonId) || [];
    const storyActiveList = sdk.storySummaries?.listActive?.(aiPersonId) || [];
    const kChainContext = sdk.rollingSummaries?.buildKChainContext?.(aiPersonId) || '';
    // contextRounds 文本 = method.computeContextRoundsPrompt(aiPersonId, messages, cfg.contextRounds)
    //   method 拿不到 → 用本文件的局部函数 _computeContextRoundsPrompt
    const contextRoundsCfg = sdk.rollingSummaries?.getRollingConfig?.(aiPersonId) || null;
    const contextRounds = _computeContextRoundsPrompt(
        aiPersonId,
        messages,
        Number(contextRoundsCfg?.contextRounds) || 20,
    );

    // ★ v0.57 系统 prompt 注入开关(由 prompt-manager 控制)
    //   - inject.user=false → 不注入「用户人设本体 + 用户模块 + 用户心情 + 用户日程 + 用户朋友圈」
    //   - inject.ai=false   → 不注入「AI 人设本体 + AI 模块 + AI 心情 + AI 日程 + AI 朋友圈」
    //   - 都没启用 → parts 只保留 replyPrompts + 特殊动作 + head 基础指令
    const inject = opts.systemPromptInject || { user: true, ai: true };

    // ===== 拼装 =====
    const parts = [];
    if (inject.ai !== false) parts.push(_renderPersona8Fields('AI 人设本体', aiPerson));
    if (user && inject.user !== false) parts.push(_renderPersona8Fields('用户人设本体', user));
    if (world) parts.push(_renderWorld(world));
    if (inject.ai !== false) parts.push(...aiModules);
    if (user && inject.user !== false && userModules.length) parts.push(...userModules);
    // ★ v0.63.2 K 链摘要(放在「近期聊天」之前 — 老 K 在前)
    //   - opts.kChainInject?.enabled === false → 不注入 K 链文本到 systemPrompt
    //   - 默认 true(总开关 + 个人 toggle 都开才注入,跟 prompt-manager 卡上 toggle 同步)
    const kChainInjectEnabled = opts.kChainInject?.enabled !== false;
    if (kChainContext && kChainInjectEnabled) parts.push(kChainContext);
    // ★ v0.61.3 当前聊天回合(放在近期聊天之前/之后都可 — 这里选「之后」,贴近真实上下文)
    if (messages.length) parts.push(_renderRecentHistory(messages, historyLimit));
    if (contextRounds) parts.push(contextRounds);
    if (inject.ai !== false && aiMood) parts.push(`# AI 当前心情\n- ${aiMood}`);
    if (user && inject.user !== false && userMood) parts.push(`# 用户当前心情\n- ${userMood}`);
    if (inject.ai !== false && aiSchedule) parts.push(aiSchedule);
    if (user && inject.user !== false && userSchedule) parts.push(userSchedule);
    if (inject.ai !== false && aiMoments) parts.push(aiMoments);
    if (user && inject.user !== false && userMoments) parts.push(userMoments);
    // ★ v0.61.3 三种概要
    if (calActiveList.length) parts.push(_renderSummaryList('日历概要', calActiveList));
    if (storyActiveList.length) parts.push(_renderSummaryList('故事概要', storyActiveList));
    parts.push(_renderActivePrompts(activePrompts));
    // ★ v0.64 「AI 表情包库」段(告诉 AI 它「可以发什么表情包」)
    //   - 必须在 replyFormatBlock 之前,否则 AI 看到「[表情包:名称]」但不知道有哪些名称
    //   - 默认注入(opts.stickerLibraryInject = undefined → 走 _renderAiStickerLibraryBlock 的 enabled=true 默认)
    //   - opts.stickerLibraryInject.enabled === false → 完全不注入
    const stickerLibraryBlock = await _renderAiStickerLibraryBlock(aiPersonId, opts.stickerLibraryInject);
    if (stickerLibraryBlock) parts.push(stickerLibraryBlock);
    // ★ v0.62.x 「回复格式 + 短句风格」合并块(替换原本只塞 SPECIAL_ACTIONS_HELP 的逻辑)
    //   - opts.replyFormatInject?.enabled === false → 完全不注入
    //   - 默认 undefined / true → 注入(包含 SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS)
    const replyFormatBlock = _renderReplyFormatBlock(opts.replyFormatInject);
    if (replyFormatBlock) parts.push(replyFormatBlock);

    // ★ v0.65 「分级记忆」段(L1~L4 全部 active=true 的概要拼到 systemPrompt)
    //   - 调用 sdk.memorySummaries.buildMemoryContext(aiPersonId)
    //   - 按层级从大到小(L4 → L3 → L2 → L1)排列,每一层按 generatedAt 降序
    //   - 用户已在 prompt-manager 单独控制各层 asPrompt.active 开关
    //   - opts.memoryInject?.enabled === false → 完全不注入
    // ★ v0.66 新增 opts.memorySummaryInjectOverride:{ aiPersonId: { summaryId: bool } }
    //   - 用户在 prompt-manager murmur 卡片里关闭某条概要 → 该 summaryId = false
    //   - 拼装前临时把 asPrompt.active 设为 false(不写盘,只影响本次 prompt)
    let memoryContext = '';
    try {
        if (opts.memoryInject?.enabled !== false && sdk.memorySummaries?.buildMemoryContext) {
            // ★ v0.66 临时屏蔽用户关闭的概要
            const override = opts.memorySummaryInjectOverride || {};
            const aiMap = override?.[aiPersonId] || {};
            const hasAnyOverride = Object.keys(aiMap).length > 0;
            if (hasAnyOverride) {
                // 暂时把该 aiPerson 的概要 asPrompt.active 改成 override 值
                const person = sdk.aiPersons?.get?.(aiPersonId);
                const chatProfile = person?.socialProfiles?.chat;
                const originalSummaries = chatProfile?.memorySummaries;
                if (Array.isArray(originalSummaries)) {
                    const patched = originalSummaries.map((s) => {
                        if (!s || !s.id) return s;
                        if (aiMap[s.id] === false) {
                            return { ...s, asPrompt: { ...(s.asPrompt || {}), active: false } };
                        }
                        return s;
                    });
                    chatProfile.memorySummaries = patched;
                    try {
                        memoryContext = sdk.memorySummaries.buildMemoryContext(aiPersonId) || '';
                    } finally {
                        chatProfile.memorySummaries = originalSummaries;
                    }
                } else {
                    memoryContext = sdk.memorySummaries.buildMemoryContext(aiPersonId) || '';
                }
            } else {
                memoryContext = sdk.memorySummaries.buildMemoryContext(aiPersonId) || '';
            }
        }
    } catch (err) {
        console.warn('[prompt-builder] buildMemoryContext failed', err);
    }
    if (memoryContext) parts.push(memoryContext);

    // 顶部基础指令
    const head = [
        '# 任务',
        '你是该 AI 人设,根据上面的「人设本体 + 上下文 + 回复提示词」自然回复用户。',
        '你**可以**调用「可调用的特殊消息格式」输出卡片消息。',
        '你的回复风格应严格遵守「回复提示词」中的所有指令。',
        '',
    ].join('\n');

    const systemPrompt = head + parts.filter(Boolean).join('\n\n');

    return {
        systemPrompt,
        parts: {
            aiPerson: !!aiPerson,
            user: !!user,
            world: !!world,
            modules: aiModules.length + userModules.length,
            history: messages.length,
            activeReplyPrompts: activePrompts.length,
            memorySummaries: memoryContext ? 'injected' : 'empty',
        },
        stats: {
            activeReplyPrompts: activePrompts.length,
            totalHistory: messages.length,
            promptLength: systemPrompt.length,
        },
    };
}

/**
 * 快速预览(给 prompt-manager 顶部展示用,只拼装前 5 段 + 激活数)
 *   - 不读聊天历史(快)
 *   - 不读日程
 *   - 不读朋友圈
 */
export function buildPreview(aiPersonId, opts = {}) {
    const sdk = _getSdk();
    if (!sdk) return { preview: 'SDK 未就绪', stats: { activeReplyPrompts: 0 } };
    const aiPerson = sdk.aiPersons?.get?.(aiPersonId) || null;
    if (!aiPerson) return { preview: '未找到 AI 人设', stats: { activeReplyPrompts: 0 } };

    const userId = opts.userId
        || sdk.defaultUserCard?.getDefault?.()?.id
        || sdk.users?.getActive?.()?.id
        || '';
    const user = userId ? sdk.users?.get?.(userId) || null : null;
    const worldId = aiPerson.boundWorldId || user?.boundWorldId || '';
    const world = worldId ? sdk.worlds?.get?.(worldId) || null : null;
    const activePrompts = sdk.replyPrompts?.listActive
        ? sdk.replyPrompts.listActive(aiPersonId) || []
        : [];

    // ★ v0.57:跟 buildReplyPromptsPrompt 对齐,接受 systemPromptInject 过滤
    const inject = opts.systemPromptInject || { user: true, ai: true };

    const parts = [
        _renderPersona8Fields('AI 人设本体', aiPerson),
    ];
    if (user && inject.user !== false) parts.push(_renderPersona8Fields('用户人设本体', user));
    if (world) parts.push(_renderWorld(world));
    if (inject.ai !== false) parts.push(..._injectModules(aiPerson));
    if (user && inject.user !== false) parts.push(..._injectModules(user));
    parts.push(_renderActivePrompts(activePrompts));

    return {
        preview: parts.filter(Boolean).join('\n\n'),
        stats: {
            activeReplyPrompts: activePrompts.length,
            aiPersonName: aiPerson.name || aiPersonId,
        },
    };
}

// 暴露给 window 的统一对象
const promptBuilder = {
    build: buildReplyPromptsPrompt,
    buildPreview,
    SPECIAL_ACTIONS_HELP,
    REPLY_STYLE_INSTRUCTIONS, // ★ v0.62.x 短句聊天风格(给 prompt-manager 渲染用)
};

export default promptBuilder;