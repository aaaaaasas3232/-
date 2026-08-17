/**
 * 灯塔 · 给 murmur 的实时上下文
 *
 * ── 为什么不能只靠 prompt-manager 的 pre 快照 ─────────────────────
 *
 *   1. 工作状态**随时在变**：今天演没演、这个月发没发工资、刚辞了一份。
 *   2. 快照是**一份**，而这段上下文**对每个 AI 内容不一样** ——
 *      同事知道办公室里的事，不对付的那位记着上周的梁子，
 *      毫无关系的第三个人只知道「她最近在上班」。
 *
 * 所以走和「一起听」「四叶草」同一条路：挂 `window.__jobContext`，
 * 由 `ai-service.callAiAndSplit` 在**发送时现算**再追加。
 * murmur 不 import 这个 App，只读全局，没装也不会炸。
 *
 * ── 谁能知道什么 ──────────────────────────────────────────────────
 *
 *   同事      知道这份工作的日常、最近几天发生的事、我的表现
 *   不对付    知道同样的事，但立场相反 —— 而且要让他记得自己在和我作对
 *   其他 AI   只知道「她现在做什么工作」这一句，不知道细节
 *
 * ★ 判断必须逐条做，不能在 store 里拼好一份共用文案再传下来。
 *   四叶草那轮真的因此泄漏过匿名礼物的商品名：心愿单那段守住了，
 *   「最近发生的」那段漏了。**能拿到 aiId 的地方才配拼这段文案。**
 */

import { stripBlock } from '@/src/core/context-composer.js';
import { asArray, fmtMoney, fmtDay } from '../utils.js';

export const JOB_CONTEXT_HEADING = '灯塔求职';

let _read = null;

/**
 * 由 store 注入一个「现在的数据长什么样」的读取函数。
 * 传 null 表示 App 还没配置好 —— 此时 getContext 返回空串。
 */
export function installJobContext(reader) {
    _read = typeof reader === 'function' ? reader : null;
    if (typeof window === 'undefined') return;
    window.__jobContext = {
        heading: JOB_CONTEXT_HEADING,
        getContext,
        isActive,
        strip: stripJobBlock,
    };
}

export function isActive() {
    try {
        return Boolean(_read?.()?.ready);
    } catch (_) {
        return false;
    }
}

/**
 * 生成给某个 AI 的那一段。
 * @param {string} aiPersonId 当前正在跟谁说话
 * @returns {string} 空串表示「这次不用追加」
 */
export function getContext(aiPersonId) {
    let snap;
    try {
        snap = _read?.();
    } catch (err) {
        console.warn('[job] 读实时上下文失败', err);
        return '';
    }
    if (!snap?.ready) return '';

    const me = String(aiPersonId || '');
    const currency = snap.currency || '金币';
    const userName = snap.userName || '她';
    const posts = asArray(snap.posts);

    if (!posts.length) {
        // 没工作也是信息 —— 但只说一句，不要展开成一段
        return snap.seeking
            ? `${userName}最近在找工作，还没定下来。她主动提起时可以聊，不要追着问。`
            : '';
    }

    const blocks = [];
    const outside = [];

    for (const post of posts) {
        const isColleague = asArray(post.colleagueIds).some((id) => String(id) === me);
        const isRival = asArray(post.rivalIds).some((id) => String(id) === me);

        if (!isColleague && !isRival) {
            outside.push(`${post.title}${post.company ? `（${post.company}）` : ''}`);
            continue;
        }

        const lines = [];
        lines.push(isRival
            ? `你和${userName}在同一个地方做事，但你们不对付。`
            : `你和${userName}是同事。`);
        lines.push(`  地方：${post.company || post.title}`);
        lines.push(`  她的活：${post.title}${post.duty ? ` —— ${post.duty}` : ''}`);
        if (post.shiftText) lines.push(`  她的班：${post.shiftText}`);

        const digests = asArray(post.digests).slice(0, 4);
        if (digests.length) {
            lines.push('  最近几天发生的：');
            for (const d of digests) lines.push(`    ${fmtDay(d.day)}：${d.text}`);
        }

        lines.push(isRival
            ? '  你记着这些事，而且立场和她相反。聊天里可以夹枪带棒，但不要每句都提工作。'
            : '  这些事你都在场。可以自然提起，像同事之间那样，不要复述一遍给她听。');

        blocks.push(lines.join('\n'));
    }

    if (outside.length) {
        blocks.push(
            `${userName}现在的工作：${outside.join('、')}。\n`
            + '  你不在她工作的地方，只知道她做这个，不知道里面具体发生了什么。\n'
            + '  她愿意说你再接话，不要假装知道细节。',
        );
    }

    // 钱的部分对谁都一样 —— 这是她自己会说的事，不涉及第三方
    if (snap.monthIncome > 0) {
        blocks.push(`这个月她从工作里挣了 ${fmtMoney(snap.monthIncome)} ${currency}。`);
    }

    if (!blocks.length) return '';

    return [
        '她的工作须知:',
        '  - Principle: 下面是她在「灯塔」这个求职软件里的真实工作状态。',
        '  - Behaviors:',
        '    - 只有她聊到工作、累不累、今天怎么样时才用得上',
        '    - 不要主动汇报她的工作日程，那是她自己的事',
        '    - 不知道的别编，宁可问一句「今天怎么样」',
        '',
        ...blocks,
    ].join('\n');
}

/**
 * 把 pre 快照里可能残留的旧段落剪掉。
 *
 * murmur 侧的注入方式是「先 strip 再包一层同名标签补回去」，
 * 所以这里必须认得那对标签。**直接用框架的 `stripBlock`** ——
 * 自己再写一遍正则就是同一个约定的第二份实现，标签格式一改就悄悄失效。
 */
export function stripJobBlock(systemPrompt) {
    return stripBlock(String(systemPrompt || ''), JOB_CONTEXT_HEADING);
}
