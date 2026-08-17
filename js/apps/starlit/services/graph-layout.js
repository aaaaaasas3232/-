/**
 * 点灯 · 推理墙的排版算法
 *
 * 用户手动摆完卡片，点「整理」，这里算出一版最舒服的排布。
 * **不调 API** —— 内容一个字都没变，纯几何问题。
 *
 * ── 为什么不引第三方图布局库 ────────────────────────────────────
 * d3-force / cytoscape 都要几十上百 KB，还都自带自己的一套渲染，
 * 而我们只需要「给一堆矩形算坐标」。这里三百行搞定，
 * 单文件打包也不用多背一个依赖。
 *
 * ── 算法 ────────────────────────────────────────────────────────
 *   1. 按连线切成若干连通分量（互相没关系的知识群应该分开摆）
 *   2. 每个分量内跑力导向：连线拉近、卡片互斥、向心力收拢
 *   3. 矩形去重叠（力导向只管质点，不管卡片有宽高）
 *   4. 分量之间按「装箱」摆成几列，谁大谁先放
 *
 * ── 性能 ────────────────────────────────────────────────────────
 * 迭代次数随卡片数自适应，斥力用网格分桶（只算邻近格子），
 * 所以 300 张卡也是几十毫秒的事，不会卡住主线程。
 * 真到了几千张，`plan()` 会直接退回「网格排列」——
 * 与其算十秒钟不如立刻给一个能用的结果。
 */

import { CARD_SIZE } from '../constants.js';
import { asArray, clamp, round } from '../utils.js';

/** 超过这个数量就不跑力导向了，直接网格 */
const FORCE_LIMIT = 420;

/** 卡片之间至少留这么宽的缝 */
const PAD = 26;

function sizeOf(card) {
    return {
        w: Number(card?.w) || (card?.type === 'code' ? CARD_SIZE.codeW : CARD_SIZE.w),
        h: Number(card?.h) || (card?.type === 'code' ? CARD_SIZE.codeH : CARD_SIZE.h),
    };
}

// ============================================================
// 连通分量
// ============================================================

/**
 * 按连线把卡片切成互不相干的几群。
 * 卡片堆（stackId 相同）当作一条隐形的强连线，绝不能被拆开。
 */
export function splitComponents(cards, links) {
    const list = asArray(cards).filter((c) => c && c.id);
    const index = new Map(list.map((c, i) => [String(c.id), i]));
    const parent = list.map((_, i) => i);

    const find = (x) => {
        let r = x;
        while (parent[r] !== r) { parent[r] = parent[parent[r]]; r = parent[r]; }
        return r;
    };
    const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[rb] = ra;
    };

    for (const link of asArray(links)) {
        const a = index.get(String(link?.from));
        const b = index.get(String(link?.to));
        if (a === undefined || b === undefined) continue;
        union(a, b);
    }

    // 同一堆的必须在一起
    const stacks = new Map();
    list.forEach((c, i) => {
        const sid = String(c.stackId || '');
        if (!sid) return;
        if (stacks.has(sid)) union(stacks.get(sid), i);
        else stacks.set(sid, i);
    });

    const groups = new Map();
    list.forEach((c, i) => {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(c);
    });

    // 大群先摆
    return [...groups.values()].sort((a, b) => b.length - a.length);
}

// ============================================================
// 力导向
// ============================================================

/**
 * 一个分量内部的力导向。就地修改 nodes 的 x/y。
 * nodes: [{ id, x, y, w, h }]
 */
function relax(nodes, edges, iterations) {
    const n = nodes.length;
    if (n <= 1) return;

    // 理想边长：跟卡片尺寸挂钩，卡越大间距越大
    const avgW = nodes.reduce((s, p) => s + p.w, 0) / n;
    const avgH = nodes.reduce((s, p) => s + p.h, 0) / n;
    const ideal = Math.max(avgW, avgH) * 1.25 + PAD;
    const area = ideal * ideal * n;
    const side = Math.sqrt(area);

    // 初值：还没摆过的散在圆周上（全部堆在原点会算不出方向）
    nodes.forEach((p, i) => {
        if (!Number.isFinite(p.x) || (p.x === 0 && p.y === 0)) {
            const a = (i / n) * Math.PI * 2;
            const r = side * 0.32 * (0.55 + ((i * 37) % 100) / 220);
            p.x = Math.cos(a) * r;
            p.y = Math.sin(a) * r;
        }
        p.vx = 0;
        p.vy = 0;
    });

    const cell = ideal * 1.15;
    let temp = side * 0.14;
    const cool = temp / (iterations + 1);

    for (let step = 0; step < iterations; step += 1) {
        // 斥力：网格分桶，只和邻近 9 格比
        const buckets = new Map();
        for (const p of nodes) {
            const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
            let arr = buckets.get(key);
            if (!arr) { arr = []; buckets.set(key, arr); }
            arr.push(p);
        }

        for (const p of nodes) {
            const cx = Math.floor(p.x / cell);
            const cy = Math.floor(p.y / cell);
            for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
                for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
                    const arr = buckets.get(`${gx},${gy}`);
                    if (!arr) continue;
                    for (const q of arr) {
                        if (q === p) continue;
                        let dx = p.x - q.x;
                        let dy = p.y - q.y;
                        let d2 = dx * dx + dy * dy;
                        if (d2 < 1e-4) {
                            // 完全重合时给一个确定的、不随机的推开方向，
                            // 否则每次点整理结果都不一样
                            dx = ((p.seed % 17) - 8) || 1;
                            dy = ((p.seed % 13) - 6) || 1;
                            d2 = dx * dx + dy * dy;
                        }
                        const d = Math.sqrt(d2);
                        const force = (ideal * ideal) / d;
                        p.vx += (dx / d) * force;
                        p.vy += (dy / d) * force;
                    }
                }
            }
        }

        // 引力：有连线的互相拉
        for (const e of edges) {
            const a = e.a;
            const b = e.b;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const force = (d * d) / ideal * (e.weight || 1);
            const fx = (dx / d) * force;
            const fy = (dy / d) * force;
            a.vx -= fx; a.vy -= fy;
            b.vx += fx; b.vy += fy;
        }

        // 向心力：防止孤立的点被斥力甩到天边
        for (const p of nodes) {
            p.vx -= p.x * 0.012;
            p.vy -= p.y * 0.012;
        }

        // 位移（限速 = 退火）
        for (const p of nodes) {
            const d = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
            const move = Math.min(d, temp);
            p.x += (p.vx / d) * move;
            p.y += (p.vy / d) * move;
            p.vx = 0;
            p.vy = 0;
        }
        temp = Math.max(temp - cool, side * 0.004);
    }
}

/**
 * 矩形去重叠。力导向把点分开了，但卡片是有宽高的，
 * 尤其代码卡又宽又高，不推一遍会压在一起。
 */
function separate(nodes, rounds = 26) {
    for (let r = 0; r < rounds; r += 1) {
        let moved = false;
        for (let i = 0; i < nodes.length; i += 1) {
            for (let j = i + 1; j < nodes.length; j += 1) {
                const a = nodes[i];
                const b = nodes[j];
                const minX = (a.w + b.w) / 2 + PAD;
                const minY = (a.h + b.h) / 2 + PAD;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const ox = minX - Math.abs(dx);
                const oy = minY - Math.abs(dy);
                if (ox <= 0 || oy <= 0) continue;

                moved = true;
                // 沿重叠较小的那个轴推开，位移最小
                if (ox < oy) {
                    const push = (ox / 2) * (dx >= 0 ? 1 : -1);
                    a.x -= push; b.x += push;
                } else {
                    const push = (oy / 2) * (dy >= 0 ? 1 : -1);
                    a.y -= push; b.y += push;
                }
            }
        }
        if (!moved) break;
    }
}

function boundsOf(nodes) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const p of nodes) {
        minX = Math.min(minX, p.x - p.w / 2);
        minY = Math.min(minY, p.y - p.h / 2);
        maxX = Math.max(maxX, p.x + p.w / 2);
        maxY = Math.max(maxY, p.y + p.h / 2);
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ============================================================
// 对外
// ============================================================

/**
 * 纯网格排列。卡片特别多、或者根本没有连线时用它 ——
 * 这种情况下力导向只会算出一团毫无信息量的云。
 */
export function gridPlan(cards, { columns = 0 } = {}) {
    const list = asArray(cards).filter((c) => c && c.id);
    if (list.length === 0) return {};
    const cols = columns || Math.max(1, Math.ceil(Math.sqrt(list.length * 1.4)));
    const cellW = Math.max(...list.map((c) => sizeOf(c).w)) + PAD;
    const cellH = Math.max(...list.map((c) => sizeOf(c).h)) + PAD;
    const out = {};
    list.forEach((card, i) => {
        const { w, h } = sizeOf(card);
        out[card.id] = {
            x: round((i % cols) * cellW + (cellW - w) / 2),
            y: round(Math.floor(i / cols) * cellH + (cellH - h) / 2),
        };
    });
    return out;
}

/**
 * 主入口：算一版排布。
 *
 * @returns {{ positions: Record<string,{x,y}>, bounds: {x,y,w,h}, mode: string }}
 *          positions 是**左上角**坐标（和 card.x/card.y 一致）
 */
export function plan(cards, links, options = {}) {
    const list = asArray(cards).filter((c) => c && c.id && !c.stackId);
    // 堆里的卡不参与排版：它们跟着堆首走
    const stacked = asArray(cards).filter((c) => c && c.id && c.stackId);

    if (list.length === 0) {
        return { positions: {}, bounds: { x: 0, y: 0, w: 0, h: 0 }, mode: 'empty' };
    }

    if (list.length > FORCE_LIMIT) {
        const positions = gridPlan(list);
        return { positions, bounds: boundsOf(list.map((c) => {
            const s = sizeOf(c);
            const p = positions[c.id];
            return { x: p.x + s.w / 2, y: p.y + s.h / 2, w: s.w, h: s.h };
        })), mode: 'grid' };
    }

    const hasLinks = asArray(links).length > 0;
    const groups = hasLinks ? splitComponents(list, links) : [list];

    // 每个分量单独松弛，然后记下它的包围盒
    const laid = groups.map((group) => {
        const nodes = group.map((card, i) => {
            const s = sizeOf(card);
            return {
                id: String(card.id),
                card,
                x: Number(card.x) + s.w / 2 || 0,
                y: Number(card.y) + s.h / 2 || 0,
                w: s.w,
                h: s.h,
                seed: i * 7 + group.length,
            };
        });
        const byId = new Map(nodes.map((p) => [p.id, p]));
        const edges = [];
        for (const link of asArray(links)) {
            const a = byId.get(String(link?.from));
            const b = byId.get(String(link?.to));
            if (a && b && a !== b) edges.push({ a, b, weight: link.kind === 'part' ? 1.5 : 1 });
        }

        const iterations = clamp(Math.round(260 - nodes.length * 0.55), 70, 260);
        relax(nodes, edges, iterations);
        separate(nodes);
        const bounds = boundsOf(nodes);
        return { nodes, bounds };
    });

    // 分量之间装箱：按高度从大到小，逐列往下堆，列宽超过目标宽度就换列
    laid.sort((a, b) => b.bounds.w * b.bounds.h - a.bounds.w * a.bounds.h);
    const gutter = PAD * 2.4;
    const totalW = laid.reduce((s, g) => s + g.bounds.w + gutter, 0);
    const targetW = Math.max(
        options.targetWidth || 0,
        Math.sqrt(totalW * (laid[0]?.bounds.h || 300)) * 1.35,
        laid[0]?.bounds.w || 300,
    );

    let cursorX = 0;
    let cursorY = 0;
    let rowH = 0;
    const positions = {};

    for (const group of laid) {
        if (cursorX > 0 && cursorX + group.bounds.w > targetW) {
            cursorX = 0;
            cursorY += rowH + gutter;
            rowH = 0;
        }
        const dx = cursorX - group.bounds.x;
        const dy = cursorY - group.bounds.y;
        for (const p of group.nodes) {
            positions[p.id] = {
                x: round(p.x + dx - p.w / 2),
                y: round(p.y + dy - p.h / 2),
            };
        }
        cursorX += group.bounds.w + gutter;
        rowH = Math.max(rowH, group.bounds.h);
    }

    // 堆里的卡跟着堆首（堆首一定是散卡之一或堆内第一张）
    const stackHead = new Map();
    for (const c of stacked) {
        const sid = String(c.stackId);
        if (!stackHead.has(sid)) stackHead.set(sid, c);
    }
    for (const c of stacked) {
        const head = stackHead.get(String(c.stackId));
        const base = positions[head.id] || { x: Number(head.x) || 0, y: Number(head.y) || 0 };
        const order = Number(c.stackOrder) || 0;
        positions[c.id] = {
            x: round(base.x + order * CARD_SIZE.stackOffsetX),
            y: round(base.y + order * CARD_SIZE.stackOffsetY),
        };
    }

    const all = Object.entries(positions).map(([id, p]) => {
        const card = asArray(cards).find((c) => String(c.id) === id);
        const s = sizeOf(card);
        return { x: p.x + s.w / 2, y: p.y + s.h / 2, w: s.w, h: s.h };
    });

    return { positions, bounds: boundsOf(all), mode: hasLinks ? 'force' : 'grid' };
}

/**
 * 分块：把墙切成「一小块一小块」，方便一块一块看（MarginNote 那种读法）。
 * 一个连通分量就是一块；散卡按空间聚类粗略归堆。
 *
 * @returns {Array<{id, title, cardIds, bounds}>}
 */
export function clusterRegions(cards, links) {
    const list = asArray(cards).filter((c) => c && c.id);
    if (list.length === 0) return [];
    const groups = splitComponents(list, links);

    return groups.map((group, i) => {
        const rects = group.map((c) => {
            const s = sizeOf(c);
            return { x: Number(c.x) || 0, y: Number(c.y) || 0, w: s.w, h: s.h };
        });
        const minX = Math.min(...rects.map((r) => r.x));
        const minY = Math.min(...rects.map((r) => r.y));
        const maxX = Math.max(...rects.map((r) => r.x + r.w));
        const maxY = Math.max(...rects.map((r) => r.y + r.h));

        // 块名：取这一块里连线最多那张卡的标题（它多半是这一块的中心概念）
        const degree = new Map();
        for (const link of asArray(links)) {
            for (const key of [String(link.from), String(link.to)]) {
                degree.set(key, (degree.get(key) || 0) + 1);
            }
        }
        const hub = group.slice().sort((a, b) => (degree.get(String(b.id)) || 0) - (degree.get(String(a.id)) || 0))[0];

        return {
            id: `rg_${i}`,
            title: hub?.title || `第 ${i + 1} 块`,
            cardIds: group.map((c) => String(c.id)),
            count: group.length,
            bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        };
    }).sort((a, b) => b.count - a.count);
}

/**
 * 给定视口尺寸，算出「刚好把这块装进去」的缩放和平移。
 * 双击某一块、点「聚焦」都用它。
 */
export function fitTo(bounds, viewport, { padding = 46, maxZoom = 1.4, minZoom = 0.28 } = {}) {
    const bw = Math.max(1, bounds?.w || 0);
    const bh = Math.max(1, bounds?.h || 0);
    const vw = Math.max(1, viewport?.w || 1);
    const vh = Math.max(1, viewport?.h || 1);
    const zoom = clamp(Math.min((vw - padding * 2) / bw, (vh - padding * 2) / bh), minZoom, maxZoom);
    return {
        zoom: round(zoom, 3),
        x: round(vw / 2 - (bounds.x + bw / 2) * zoom),
        y: round(vh / 2 - (bounds.y + bh / 2) * zoom),
    };
}
