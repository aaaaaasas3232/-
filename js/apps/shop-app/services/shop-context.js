/**
 * 四叶草 · 给 murmur 的实时上下文
 *
 * ── 为什么不能只靠 prompt-manager ─────────────────────────────────
 *
 * murmur 发消息时读的是 prompt-manager 生成好的 **pre 快照**。快照有两个致命限制：
 *
 *   1. 心愿单**随时在变**。用户刚加一条、AI 刚买掉一条，快照都不知道。
 *   2. 快照是**一份**，而心愿单上下文**对每个 AI 内容不一样** ——
 *      给 a 的是「你给她买了 0 件」，给 b 的是「你匿名给她买了 1 件」。
 *
 * 所以走和「一起听」同一条路：挂 `window.__shopContext`，
 * 由 `ai-service.callAiAndSplit` 在**发送时现算**再追加。
 * murmur 不 import 购物软件，只读全局，购物软件没装也不会炸。
 *
 * ── 匿名不是真匿名 ────────────────────────────────────────────────
 *
 * 用户的心愿单有 3 件，b 匿名买了其中 1 件：
 *   给 a 看到的：还剩 2 件，你一件都没买（**不知道 b 买过**）
 *   给 b 看到的：还剩 2 件，你匿名买了【商品名】（**自己记得**）
 *
 * AI 之间不互通 —— a 永远不会知道是谁买的，连「有人买过」都不知道。
 * 这是用户明确要的：惊喜不能提前漏。
 */

import { asArray, fmtMoney } from '../utils.js';

export const SHOP_CONTEXT_HEADING = '四叶草购物';

let _read = null;

/**
 * 由 store 注入一个「现在的数据长什么样」的读取函数。
 * 传 null 表示 App 卸载 / 还没配置好 —— 此时 getContext 返回空串，
 * murmur 那边什么都不会追加。
 */
export function installShopContext(reader) {
    _read = typeof reader === 'function' ? reader : null;
    if (typeof window === 'undefined') return;
    window.__shopContext = {
        heading: SHOP_CONTEXT_HEADING,
        getContext,
        isActive,
        strip: stripShopBlock,
    };
}

export function isActive() {
    try {
        const snap = _read?.();
        return Boolean(snap?.ready);
    } catch (_) {
        return false;
    }
}

/**
 * 生成给某个 AI 的那一段。
 *
 * @param {string} aiPersonId 当前正在跟谁说话
 * @returns {string} 空串表示「这次不用追加」
 */
export function getContext(aiPersonId) {
    let snap;
    try {
        snap = _read?.();
    } catch (err) {
        console.warn('[shop] 读实时上下文失败', err);
        return '';
    }
    if (!snap?.ready) return '';

    const currency = snap.currency || '金币';
    const me = String(aiPersonId || '');
    const blocks = [];

    // ── 心愿单 ────────────────────────────────────────────────
    const wishes = asArray(snap.wishlist);
    const pending = wishes.filter((w) => !w.fulfilled);
    // 「我」买过的（实名或匿名都算）
    const boughtByMe = wishes.filter((w) => w.fulfilled && String(w.fulfilledBy) === me);

    if (wishes.length) {
        const lines = [];
        if (pending.length) {
            lines.push(`${snap.userName}的心愿单还剩 ${pending.length} 件：`);
            for (const w of pending) {
                const price = w.price ? `，约 ${fmtMoney(w.price)} ${currency}` : '';
                lines.push(`  - ${w.title}${price}${w.note ? `（${w.note}）` : ''}`);
            }
        } else {
            lines.push(`${snap.userName}的心愿单已经全部实现了。`);
        }

        if (boughtByMe.length) {
            const names = boughtByMe.map((w) => `【${w.title}】`).join('、');
            const anon = boughtByMe.some((w) => w.anonymous);
            lines.push(anon
                ? `你已经匿名给${snap.userName}买了 ${boughtByMe.length} 件：${names}。她不知道是你买的。`
                : `你已经给${snap.userName}买了 ${boughtByMe.length} 件：${names}。`);
        } else {
            lines.push(`你还没有给${snap.userName}买过心愿单上的东西。`);
        }

        blocks.push([
            '心愿单须知:',
            '  - Principle: 下面是用户在四叶草购物软件里写下的心愿单。你可以选择买、也可以不买。',
            '  - Behaviors:',
            '    - 想买就输出 [送礼:商品名:金额:留言]；不想让她知道是你，用 [匿名送礼:商品名:金额:留言]',
            '    - 金额从下面列出的价格来，没写价格就自己按这个世界的物价估一个',
            '    - 买之前先看你自己的余额够不够，不够就别买，可以说「等我攒攒」',
            '    - **不要在聊天里念心愿单**。她知道自己写了什么，你复述一遍很奇怪',
            '    - 买了可以说也可以不说；匿名买的就更不该说漏嘴',
            '',
            ...lines,
        ].join('\n'));
    }

    // ── 你的钱包 ──────────────────────────────────────────────
    if (typeof snap.aiBalance === 'function') {
        const balance = snap.aiBalance(me);
        if (balance != null) {
            blocks.push(`你现在有 ${fmtMoney(balance)} ${currency}。买东西会真的从这里扣，扣完就没了。`);
        }
    }

    // ── 最近发生的事（**按对话方过滤**）────────────────────────
    //
    // ★ 这一段必须逐条判断「这个 AI 该不该知道」，不能给一份共用的文案。
    //   - 用户自己买的：谁都能知道，她自己会说
    //   - 别人送她的：**只有送的那个人知道**。匿名与否都一样 ——
    //     A 不该知道 B 送过什么，连「有人送过」都不该知道
    //   - 她送出去的：只有收礼那位知道
    //
    // 第一版把这段文案在 store 里就拼好了（那里拿不到 aiId），
    // 结果匿名礼物的商品名出现在了每个 AI 的上下文里。
    const recent = [];
    for (const o of asArray(snap.orders)) {
        const name = o.items?.[0]?.label || '一样东西';
        if (o.type === 'gift-in') {
            if (String(o.from?.id || '') !== me) continue;
            recent.push(o.anonymous
                ? `你匿名送了她「${name}」，她不知道是你`
                : `你送了她「${name}」`);
        } else if (o.type === 'gift-out') {
            if (String(o.to?.id || '') !== me) continue;
            recent.push(`她送了你「${name}」`);
        } else {
            recent.push(`她自己买了「${name}」`);
        }
        if (recent.length >= 4) break;
    }
    if (recent.length) {
        blocks.push(['最近在四叶草发生的:', ...recent.map((r) => `  - ${r}`)].join('\n'));
    }

    // ── 小剧场概要 ────────────────────────────────────────────
    // 只给「这个 AI 参演过的」那几场，而且只给概要不给全文 ——
    // 全文几百上千字，塞进去等于把用户真正的聊天记录挤掉
    const theaters = asArray(snap.theaters)
        .filter((t) => t.summary && asArray(t.participants).some((p) => String(p.id) === me))
        .slice(0, 3);
    if (theaters.length) {
        blocks.push([
            '你和她一起经历过的:',
            ...theaters.map((t) => `  - 《${t.title}》${t.summary}`),
            '（这些是已经发生过的事，可以自然提起，但别逐句复述）',
        ].join('\n'));
    }

    if (!blocks.length) return '';
    return `# ${SHOP_CONTEXT_HEADING}\n${blocks.join('\n\n')}`;
}

/**
 * 把 pre 里那段过期的剪掉。
 *
 * pre 里的段落现在都包成 `<XX开始>` / `<XX结束>`，优先按标签剪；
 * 剪不到就退回「一级标题到下一个一级标题」的老逻辑
 * —— 老用户 localStorage 里那份没标签的 pre 照样要能处理。
 */
export function stripShopBlock(text) {
    let out = String(text || '');
    if (!out) return out;

    const tagged = new RegExp(
        `<${SHOP_CONTEXT_HEADING}开始>[\\s\\S]*?<${SHOP_CONTEXT_HEADING}结束>\\n*`,
        'g',
    );
    if (tagged.test(out)) return out.replace(tagged, '').trim();

    const headingIdx = out.indexOf(`# ${SHOP_CONTEXT_HEADING}`);
    if (headingIdx < 0) return out;
    const rest = out.slice(headingIdx + 1);
    const nextIdx = rest.indexOf('\n# ');
    out = nextIdx < 0
        ? out.slice(0, headingIdx)
        : out.slice(0, headingIdx) + rest.slice(nextIdx + 1);
    return out.trim();
}
