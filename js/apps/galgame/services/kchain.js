/**
 * 湛蓝回忆 · K 链记忆(滑动窗口 + 迭代式增量压缩)
 *
 * ── 规则 ──────────────────────────────────────────────────────────
 *
 * 窗口里放「单元」。单元只有两种:
 *
 *   `r`  一条真实回合(指向一个剧情节点)
 *   `k`  一次压缩产物(一段摘要)
 *
 * 每生成一个新节点就往窗口里追加一个 `r`。窗口一旦**满 windowSize 个单元**,
 * 就把这 windowSize 个单元整体打包送去压缩,产物是一个新的 `k`,
 * 窗口重置成 `[k]`。于是:
 *
 *   R1 R2 R3 R4         → 满 4 → 压成 K0 → 窗口 [K0]
 *   K0 R5 R6 R7         → 满 4 → 压成 K1 → 窗口 [K1]
 *   K1 R8 R9 R10        → 满 4 → 压成 K2 → 窗口 [K2]
 *
 * 每个 K 都把上一个 K 吃进去了,所以窗口里**永远最多一个 k**,
 * 而这一个 k 覆盖了从开局到上次压缩为止的全部剧情。
 *
 * ── 为什么窗口状态存在节点上 ──────────────────────────────────────
 *
 * 这是整个设计的关键。窗口状态**只取决于「根 → 本节点」这条路径**,
 * 所以把它存在节点自己身上(`node.kState`),就等于给每条分支各记了一份窗口。
 *
 * 于是用户的要求自动成立:
 *
 *   「在第一个节点选了故事 2、走到故事 2 的节点 3,下一步继续生成就会出现 K0;
 *     但此时回到前面的节点去生成别的故事,不会生成 K0,
 *     因为那条故事线还没到该生成 K0 的时候。」
 *
 * 不需要任何「判断玩家是不是回溯了」的特判 —— 回到旧节点,读到的就是旧窗口。
 * 如果窗口是全局一份(原型的 `memoryModules` 就是全局的),
 * 回溯之后计数会串,压出来的摘要里会混进另一条线的剧情。
 *
 * ── 上下文共存 ────────────────────────────────────────────────────
 *
 * 发给 AI 的记忆分两段:
 *
 *   `memory`  窗口里的 k(压缩记忆)
 *   `recent`  窗口里的 r 原文 **+** 路径末尾 `rawTail` 回合的原文(去重后按顺序)
 *
 * `rawTail` 是为了兜住「压缩刚发生那一瞬间窗口只剩一个 k」的情况 ——
 * 此时若不留原文,AI 手上一句原话都没有,人物会立刻跳戏。
 * 设成 0 就是严格按窗口走。
 */

import { makeId, asArray, clamp } from '../utils.js';
import { KCHAIN_DEFAULTS } from '../constants.js';

// ============================================================
// 路径
// ============================================================

/**
 * 根 → node 的完整路径(含 node 本身)。
 *
 * 带环保护:数据坏掉时(比如手工改过 parentId)宁可少返回几个节点,
 * 也不能让这里死循环把整个 App 卡死。
 */
export function pathTo(node, nodeMap) {
    const out = [];
    const seen = new Set();
    let cur = node;
    while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        out.push(cur);
        cur = cur.parentId ? nodeMap.get(String(cur.parentId)) : null;
    }
    return out.reverse();
}

// ============================================================
// 窗口推进
// ============================================================

/**
 * 父节点窗口 + 一条新回合 = 新窗口。
 *
 * @param {object} parentKState  父节点的 `kState`(根节点传 null)
 * @param {string} nodeId        新回合对应的节点 id
 * @param {number} windowSize
 * @returns {{ units:Array, kCount:number, pending:boolean, needsCompress:boolean }}
 */
export function advanceWindow(parentKState, nodeId, windowSize = KCHAIN_DEFAULTS.windowSize) {
    const size = Math.max(2, Number(windowSize) || KCHAIN_DEFAULTS.windowSize);
    const prev = asArray(parentKState?.units);
    const units = [...prev, { type: 'r', nodeId: String(nodeId) }];
    return {
        units,
        kCount: Number(parentKState?.kCount) || 0,
        pending: false,
        needsCompress: units.length >= size,
    };
}

/** 窗口里的 k 单元(设计上最多一个,但按数组处理更耐脏数据) */
export function kUnitsOf(kState) {
    return asArray(kState?.units).filter((u) => u.type === 'k');
}

/** 窗口里 r 单元指向的节点 id */
export function rNodeIdsOf(kState) {
    return asArray(kState?.units).filter((u) => u.type === 'r').map((u) => String(u.nodeId));
}

// ============================================================
// 单元 → 文本
// ============================================================

/** 一个节点渲染成「玩家选择 + 剧情正文」 */
export function renderNodeText(node, index) {
    if (!node) return '';
    const head = node.choice?.text
        ? `【第 ${index} 幕|玩家选择:${node.choice.text}】`
        : `【第 ${index} 幕|开场】`;
    const body = asArray(node.segments)
        .map((s) => (s.speaker ? `${s.speaker}:${s.text}` : s.text))
        .filter(Boolean)
        .join('\n');
    return body ? `${head}\n${body}` : '';
}

/**
 * 把窗口里的单元铺成待压缩素材。
 *
 * k 单元标成「前情摘要」,让压缩 prompt 知道这一段要被**合并**进新摘要,
 * 而不是当成一段普通剧情再复述一遍。
 */
export function collectUnitTexts(units, nodeMap) {
    const out = [];
    let sceneNo = 0;
    for (const unit of asArray(units)) {
        if (unit.type === 'k') {
            out.push({ kind: 'k', label: `前情摘要 K${unit.index}`, text: String(unit.content || '') });
            continue;
        }
        const node = nodeMap.get(String(unit.nodeId));
        if (!node) continue;
        sceneNo += 1;
        const text = renderNodeText(node, sceneNo);
        if (text) out.push({ kind: 'r', label: `第 ${sceneNo} 幕`, text });
    }
    return out.filter((x) => x.text.trim());
}

// ============================================================
// 压缩 prompt
// ============================================================

/**
 * 压缩指令。
 *
 * 写法对齐项目里最好的那几段(`docs/跨App注册Prompt指导方案.md` §5.1):
 * Principle 一条说清这段干嘛,Behaviors 三到六条讲具体动作和边界。
 * **不铺陈背景** —— 上下文长度有限,多写一百行解释就等于把剧情挤掉一百行。
 */
export function buildCompressPrompt({ materials, maxChars = 320, kIndex = 0 }) {
    const body = materials
        .map((m) => `<${m.label}>\n${m.text}\n</${m.label}>`)
        .join('\n\n');

    return `记忆压缩须知:
  - Principle: 把下面几段剧情压成一份「只读它就能接着往下写」的记忆,不是写读后感。
  - Behaviors:
    - 必须留下: 谁做了什么、说定了什么、关系怎么变的、拿到或失去了什么、还悬着哪些事
    - 必须丢掉: 环境描写、语气词、反复出现的心理活动、对同一件事的第二次描述
    - 出现「前情摘要」时把它**并进**新摘要里,按时间从早到晚重写成一段连续叙述,不要保留「摘要中提到」这类转述口吻
    - 用第三人称过去时,人名写全,不要用「他/她」指代两个以上的人
    - 直接输出摘要正文:不要标题、不要编号、不要「本段讲述了」这类开场
    - 控制在 ${maxChars} 字以内

这是第 ${kIndex} 次压缩,要压缩的内容:

${body}`;
}

// ============================================================
// 组装给 prompt 用的两段
// ============================================================

/**
 * 读出当前节点该带的记忆与原文。
 *
 * @param {object} node      当前所在节点(生成下一幕时就是父节点)
 * @param {Map}    nodeMap
 * @param {object} kChain    settings.kChain
 * @returns {{ memory:string, recent:string, stats:object }}
 */
export function readContext(node, nodeMap, kChain = KCHAIN_DEFAULTS) {
    const conf = { ...KCHAIN_DEFAULTS, ...(kChain || {}) };
    if (!node) return { memory: '', recent: '', stats: emptyStats(conf) };

    const path = pathTo(node, nodeMap);
    const indexOf = new Map(path.map((n, i) => [String(n.id), i + 1]));

    // ── 压缩记忆 ──
    const kState = conf.enabled ? node.kState : null;
    const ks = kUnitsOf(kState);
    const memory = ks
        .map((u) => `K${u.index}(覆盖前 ${asArray(u.coversNodeIds).length} 幕):\n${u.content}`)
        .join('\n\n');

    // ── 原文回合 ──
    // 窗口里的 r + 路径末尾 rawTail 幕,**取并集再按路径顺序排** ——
    // 不去重的话压缩刚发生那一轮会把同一幕写两遍。
    const wanted = new Set(conf.enabled ? rNodeIdsOf(kState) : path.map((n) => String(n.id)));
    const tail = clamp(conf.rawTail, 0, 12);
    if (tail > 0) {
        for (const n of path.slice(-tail)) wanted.add(String(n.id));
    }
    const recentNodes = path.filter((n) => wanted.has(String(n.id)));
    const recent = recentNodes
        .map((n) => renderNodeText(n, indexOf.get(String(n.id)) || 0))
        .filter(Boolean)
        .join('\n\n');

    return {
        memory,
        recent,
        stats: {
            enabled: conf.enabled,
            windowSize: conf.windowSize,
            rawTail: tail,
            /** 窗口里现在有几个单元 */
            windowUsed: asArray(kState?.units).length,
            /** 还差几个单元触发压缩 */
            untilCompress: Math.max(0, conf.windowSize - asArray(kState?.units).length),
            kCount: Number(kState?.kCount) || 0,
            pending: kState?.pending === true,
            totalScenes: path.length,
            rawScenes: recentNodes.length,
        },
    };
}

function emptyStats(conf) {
    return {
        enabled: conf.enabled,
        windowSize: conf.windowSize,
        rawTail: conf.rawTail,
        windowUsed: 0,
        untilCompress: conf.windowSize,
        kCount: 0,
        pending: false,
        totalScenes: 0,
        rawScenes: 0,
    };
}

// ============================================================
// 产出一个 k 单元
// ============================================================

/**
 * 把压缩结果包成 k 单元。
 *
 * `coversNodeIds` 记的是「这个 K 覆盖了哪些节点」——
 * 它是**累加**的:新 K 要把旧 K 覆盖过的节点一起继承下来,
 * 否则剧情树上「哪些幕已经被压缩」的标记会在第二次压缩后全部丢掉。
 */
export function makeKUnit({ units, index, content, nodeMap }) {
    const covers = [];
    for (const unit of asArray(units)) {
        if (unit.type === 'k') {
            for (const id of asArray(unit.coversNodeIds)) covers.push(String(id));
        } else if (unit.nodeId && nodeMap.has(String(unit.nodeId))) {
            covers.push(String(unit.nodeId));
        }
    }
    return {
        type: 'k',
        id: makeId('k'),
        index: Number(index) || 0,
        content: String(content || '').trim(),
        coversNodeIds: [...new Set(covers)],
        createdAt: Date.now(),
    };
}
