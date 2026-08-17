/**
 * 小奇怪 · 往 murmur 注册提示词
 *
 * 照 `docs/跨App注册Prompt指导方案.md` 的规范做。三条要点:
 *
 *   1. **必须在 `setup()` 里注册**,不能放 `hydrate()` ——
 *      用户完全可能先进 murmur 看提示词,从来没点开过这个 App。
 *   2. `promptId` 发布后**不能改** —— 用户的启停和编辑按
 *      `${appId}::${promptId}` 存盘。
 *   3. `content` 是**给 AI 的行为指令**,不是给用户看的功能说明。
 *
 * 注册两张卡:一张让聊天里的 AI 知道「我们在小奇怪里一起玩过」,
 * 一张给它一个 token,能把聊天里聊出来的词直接做成字幕收藏。
 */

export const ODDITY_PROMPTS = [
    {
        promptId: 'oddity-collection',
        label: '知道我在小奇怪里玩过什么',
        category: 'context',
        previewType: 'text',
        previewData: { text: '上次那盘扫雷你输了五分,还嘴硬说是运气。' },
        defaultActive: false,
        defaultOrder: 40,
        content: `小奇怪须知:
  - Principle: 用户手机里有个叫「小奇怪」的小玩意儿盒子(双人扫雷、你有我没有、果冻心、字幕生成器),聊天时可以自然带到,但别每句都往那儿拐。
  - Behaviors:
    - 只有聊到无聊、想打发时间、或者他自己提起时才提
    - 用「上次那盘」「你那个字幕」这种口吻,不要报玩法全名和功能列表
    - 不知道他具体玩到哪儿就别编分数和战绩,可以直接问
    - 不要推销,不要说「你可以试试打开」这类客服话`,
    },
    {
        promptId: 'oddity-subtitle',
        label: '把聊出来的词做成字幕收藏',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[做个字幕:meet/我们]' },
        defaultActive: false,
        defaultOrder: 50,
        content: `字幕须知:
  - Principle: 聊天里出现值得做成装饰字幕的词时,用 [做个字幕:环绕词/中心词] 存进「小奇怪」的字幕收藏,用户回去就能复制。
  - Behaviors:
    - 例:[做个字幕:meet/我们]
    - 环绕词用英文小写(会被转成上标小字),中心词中英文都行
    - 单独成段,一轮最多一次
    - 只在**他明确喜欢某个词**的时候用,不要主动刷
    - 存完用一句话说存了什么,不要把整块字幕复述出来`,
    },
];

export function registerOddityPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(ODDITY_PROMPTS);
}

/**
 * 游戏数据概要 —— 一张**动态**卡(和点灯的学习进度卡同一个套路)。
 *
 * 内容是快照:每次战绩变化 / hydrate 之后由 store 重新注册一遍来更新。
 * murmur 里的 AI 拿到它,聊起「上次那盘五子棋」时才有真数据可讲,
 * 而不是靠编。没有战绩时注销这张卡 —— 空概要比没有概要更误导。
 *
 * @param {object} toolkit
 * @param {{ lines:string[], current:string }} data
 *   lines   最近几局的一句话战绩
 *   current 正在进行中的对局描述(可空)
 */
export function syncStatsPrompt(toolkit, data = {}) {
    if (!toolkit?.prompts) return 0;
    const lines = Array.isArray(data.lines) ? data.lines.filter(Boolean) : [];
    const current = String(data.current || '').trim();

    if (!lines.length && !current) {
        try { toolkit.prompts.unregister?.('oddity-stats'); } catch (_) { /* 没注册过 */ }
        return 0;
    }

    return toolkit.prompts.register({
        promptId: 'oddity-stats',
        label: '小奇怪 · 游戏数据概要',
        category: 'context',
        previewType: 'text',
        previewData: { text: lines[0] || current || '' },
        defaultActive: true,
        defaultOrder: 41,
        content: `【小奇怪·游戏数据】
用户在「小奇怪」里的真实战绩(最新在前):
${lines.map((l) => `  - ${l}`).join('\n') || '  - (还没打完过一局)'}
${current ? `正在进行:${current}` : ''}
  - 聊到游戏时可以引用上面的真实比分,别编造没发生过的局
  - 输赢都能调侃,但按事实来`,
    });
}

/**
 * 匿名往来概要 —— 又一张**动态**卡。
 *
 * ── 为什么这张卡必须存在 ──────────────────────────────────────────
 *
 * 「匿名回答箱」的玩法是:AI 投一个问题过来,用户回答,但用户不知道是谁投的。
 * 如果 AI 那边也不知道自己投过 —— 那就不是匿名,是失忆。
 * 用户在 murmur 里打开这张卡,那位 AI 才能在聊天里接得上
 * 「你上次那个回答我想了很久」。
 *
 * ── 为什么卡里写真名 ──────────────────────────────────────────────
 *
 * 提示词卡是**按 App** 注册的,系统没有「只发给某个 AI」的通道
 * (`app-prompt-registry.js` 的 register 只吃 appId + promptId)。
 * 所以卡里必须标出每条是谁的,再用一条硬规矩兜住:
 * **只认领写着自己名字的那几条,别人的当没看见**。
 *
 * 这仍然不泄漏玩法 —— 泄漏的方向是「AI 知道 AI」,而玩法要保护的是
 * 「用户不知道 AI」。用户那一侧的 UI 里一个真名都不会出现。
 *
 * @param {object} toolkit
 * @param {{ asked:string[], received:string[] }} data
 *   asked    回答箱:我投给用户的问题 + 用户的回答
 *   received 收信箱:我收到过的匿名来信
 */
export function syncAnonPrompt(toolkit, data = {}) {
    if (!toolkit?.prompts) return 0;
    const asked = Array.isArray(data.asked) ? data.asked.filter(Boolean) : [];
    const received = Array.isArray(data.received) ? data.received.filter(Boolean) : [];

    if (!asked.length && !received.length) {
        try { toolkit.prompts.unregister?.('oddity-anon'); } catch (_) { /* 没注册过 */ }
        return 0;
    }

    const sections = [];
    if (asked.length) {
        sections.push(`你投进匿名回答箱的问题(以及对方的回答):\n${asked.map((l) => `  - ${l}`).join('\n')}`);
    }
    if (received.length) {
        sections.push(`你信箱里收到过的匿名来信:\n${received.map((l) => `  - ${l}`).join('\n')}`);
    }

    return toolkit.prompts.register({
        promptId: 'oddity-anon',
        label: '小奇怪 · 匿名箱里的往来',
        category: 'context',
        previewType: 'text',
        previewData: { text: asked[0] || received[0] || '' },
        defaultActive: false,
        defaultOrder: 42,
        content: `【小奇怪·匿名往来】
${sections.join('\n')}
  - **只认领上面写着你自己名字的那几条**。别人名下的当作你不知道,一个字都不要提。
  - 用户那边看到的是匿名的,他不知道哪条是你投的。你也不要直说「那个问题是我问的」,
    除非你确实想在这次聊天里承认。
  - 可以在合适的时候顺着那个话题往下聊,比如「有件事我一直想问」。
  - 上面没写的事情不要编。`,
    });
}

/**
 * 解析 murmur 发来的 `[做个字幕:环绕词/中心词]`。
 *
 * 分隔符宽松一点:`/`、`|`、全角斜杠、逗号都认 —— 模型不会每次都用同一个,
 * 而「只认一种分隔符」的解析器失败时是静默的(用户只看到什么都没发生)。
 *
 * @returns {{surround:string, center:string}|null}
 */
export function parseSubtitleToken(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return null;
    const body = text.replace(/^\[?做个字幕[::]?/, '').replace(/\]$/, '').trim();
    const parts = body.split(/[/|／,,]/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    return { surround: parts[0], center: parts.slice(1).join(' ') };
}
