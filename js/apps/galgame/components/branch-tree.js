/**
 * 湛蓝回忆 · 剧情分支树
 *
 * 原型的「节点分析」是一列**平铺的卡片**,只能看到「第 N 个选择点有哪几个选项」,
 * 看不出分支关系;而它的「跳转到此节点」实现是
 *
 *     gameHistory = gameHistory.slice(0, node.gameStateIndex);
 *     nodeHistory = nodeHistory.slice(0, nodeIndex + 1);
 *
 * —— **直接把后面的剧情截断扔掉**。也就是说原型里根本不存在「分支」:
 * 回到过去就等于毁掉未来,而且没有任何提示(只有一句 confirm 说「重置进度」)。
 *
 * 这里把剧情存成一棵真的树,这个组件负责把它画出来:
 *
 *   - 横向布局:深度 → 列,兄弟 → 行,父节点纵向居中于子节点之间
 *   - 当前所在线路(根 → 当前节点)高亮
 *   - 生成过 K 摘要的节点带 K 角标 —— 一眼能看出「这条线压到第几次了」
 *   - 点节点选中,底部卡片给「跳过去 / 删掉这条分支」;双击直接跳
 *   - 拖拽平移 + 滚轮/双指缩放
 *
 * ★ `touch-action: none`(在 CSS 里)不是笔误:写成 `pan-y` 的话浏览器会接管纵向手势,
 *   一旦接管后续 `preventDefault()` 就失效,表现是「拖动时灵时不灵」(AGENTS2 §13.5.2)。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { summarizeNode } from '../services/story-engine.js';
import { asArray, clamp, truncate } from '../utils.js';
import { TREE_SOFT_LIMIT } from '../constants.js';

const COL_W = 132;
const ROW_H = 62;
const PAD = 28;
const NODE_W = 104;
const NODE_H = 44;

/**
 * 横向 tidy tree 布局。
 *
 * 叶子按出现顺序占行,内部节点取「第一个子节点」和「最后一个子节点」的中点 ——
 * 这是最简单的一种紧凑树布局,深度和分支再多也不会互相压到。
 *
 * 带环保护:数据坏了(手改过 parentId)宁可画不全,也不能死循环卡死整个 App。
 */
function layoutTree(nodes, rootId) {
    const map = new Map(nodes.map((n) => [String(n.id), n]));
    const pos = new Map();
    const seen = new Set();
    let cursor = 0;

    const walk = (id) => {
        const key = String(id);
        if (seen.has(key)) return null;
        seen.add(key);
        const node = map.get(key);
        if (!node) return null;

        const children = asArray(node.childIds).map((c) => map.get(String(c))).filter(Boolean);
        if (!children.length) {
            const row = cursor;
            cursor += 1;
            pos.set(key, { col: node.depth, row });
            return row;
        }
        const rows = children.map((c) => walk(c.id)).filter((r) => r != null);
        const row = rows.length ? (Math.min(...rows) + Math.max(...rows)) / 2 : (cursor += 1) - 1;
        pos.set(key, { col: node.depth, row });
        return row;
    };

    walk(rootId);
    // 树里没挂上的孤儿(理论上不该有,但数据坏了要能看见,不能凭空消失)
    for (const node of nodes) {
        if (pos.has(String(node.id))) continue;
        pos.set(String(node.id), { col: node.depth, row: cursor });
        cursor += 1;
    }
    return pos;
}

export const GgBranchTree = {
    name: 'GgBranchTree',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return {
            zoom: 1,
            panX: 0,
            panY: 0,
            selectedId: '',
            pathOnly: false,
            dragging: false,
        };
    },
    computed: {
        state() { return store.getState(); },
        game() { return store.getGame(); },
        allNodes() { return this.state.nodes; },
        currentId() { return this.game?.currentNodeId || ''; },

        /** 当前线路上的节点 id —— 高亮和「只看当前线」都用它 */
        pathIds() {
            return new Set(store.getCurrentPath().map((n) => String(n.id)));
        },

        visibleNodes() {
            if (!this.pathOnly) return this.allNodes;
            const ids = this.pathIds;
            // 当前线路 + 它们的直接子节点(不然看不到「还能往哪儿拐」)
            const keep = new Set(ids);
            for (const node of this.allNodes) {
                if (!ids.has(String(node.id))) continue;
                for (const child of asArray(node.childIds)) keep.add(String(child));
            }
            return this.allNodes.filter((n) => keep.has(String(n.id)));
        },

        layout() {
            const rootId = this.game?.rootNodeId || this.allNodes[0]?.id || '';
            return layoutTree(this.visibleNodes, rootId);
        },

        placed() {
            const path = this.pathIds;
            return this.visibleNodes.map((node) => {
                const p = this.layout.get(String(node.id)) || { col: node.depth, row: 0 };
                /**
                 * 角标只打在**压缩发生的那一幕**上。
                 *
                 * 压完窗口会重置成 `[K]`,后面几幕的窗口是 `[K, R, R…]` ——
                 * 只判断「窗口里有没有 k」的话,K0 会连着在三四个节点上都显示一遍,
                 * 看起来像压了好几次。压缩点的判据是「窗口里只有那一个 k」。
                 */
                const units = asArray(node.kState?.units);
                const kUnit = units.length === 1 && units[0].type === 'k' ? units[0] : null;
                return {
                    node,
                    x: PAD + p.col * COL_W,
                    y: PAD + p.row * ROW_H,
                    onPath: path.has(String(node.id)),
                    isCurrent: String(node.id) === String(this.currentId),
                    label: summarizeNode(node, 14),
                    choice: node.choice?.text ? truncate(node.choice.text, 10) : '',
                    isCustom: node.choice?.kind === 'custom',
                    kLabel: kUnit ? `K${kUnit.index}` : '',
                    pending: node.kState?.pending === true,
                    ending: Boolean(node.ending),
                };
            });
        },

        edges() {
            const byId = new Map(this.placed.map((p) => [String(p.node.id), p]));
            const out = [];
            for (const item of this.placed) {
                const parent = item.node.parentId ? byId.get(String(item.node.parentId)) : null;
                if (!parent) continue;
                const x1 = parent.x + NODE_W;
                const y1 = parent.y + NODE_H / 2;
                const x2 = item.x;
                const y2 = item.y + NODE_H / 2;
                const mid = x1 + (x2 - x1) / 2;
                out.push({
                    id: `${parent.node.id}->${item.node.id}`,
                    d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
                    onPath: item.onPath && parent.onPath,
                });
            }
            return out;
        },

        canvasSize() {
            let w = 320;
            let h = 220;
            for (const item of this.placed) {
                w = Math.max(w, item.x + NODE_W + PAD);
                h = Math.max(h, item.y + NODE_H + PAD);
            }
            return { w, h };
        },

        canvasStyle() {
            return {
                width: `${this.canvasSize.w}px`,
                height: `${this.canvasSize.h}px`,
                transform: `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`,
            };
        },

        selected() {
            return this.placed.find((p) => String(p.node.id) === String(this.selectedId)) || null;
        },

        selectedDetail() {
            if (!this.selected) return null;
            const node = this.selected.node;
            const kUnit = asArray(node.kState?.units).find((u) => u.type === 'k');
            return {
                node,
                lines: asArray(node.segments).slice(0, 3),
                subtreeSize: store.countSubtree(node.id),
                kContent: kUnit ? kUnit.content : '',
                kLabel: kUnit ? `K${kUnit.index}` : '',
                windowUsed: asArray(node.kState?.units).length,
            };
        },

        tooBig() {
            return this.allNodes.length > TREE_SOFT_LIMIT && !this.pathOnly;
        },
    },
    methods: {
        // ── 交互 ────────────────────────────
        onSelect(nodeId) {
            this.selectedId = String(this.selectedId) === String(nodeId) ? '' : String(nodeId);
        },
        onJump(nodeId) {
            if (store.setCurrentNode(nodeId)) {
                this.$emit('notify', '已切到这一幕');
            }
        },
        onDelete(nodeId) {
            const size = store.countSubtree(nodeId);
            const run = async () => {
                await store.deleteSubtree(nodeId);
                this.selectedId = '';
            };
            if (size <= 1) { void run(); return; }
            // 删的是一整条线,必须走顶层确认 —— 这是不可撤销操作
            const confirmApi = typeof window !== 'undefined' ? window.__phoneConfirm : null;
            if (confirmApi?.request) {
                confirmApi.request({
                    title: '删掉这条分支?',
                    text: `连同后面 ${size - 1} 幕一起删除,不能撤销。`,
                    confirmLabel: '删除',
                    danger: true,
                    onConfirm: () => { void run(); },
                });
            } else {
                void run();
            }
        },

        // ── 平移 ────────────────────────────
        onPointerDown(event) {
            if (event.target.closest?.('.gg-tree-node')) return;
            this.dragging = true;
            this._startX = event.clientX - this.panX;
            this._startY = event.clientY - this.panY;
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        onPointerMove(event) {
            if (!this.dragging) return;
            this.panX = event.clientX - this._startX;
            this.panY = event.clientY - this._startY;
        },
        onPointerUp(event) {
            this.dragging = false;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
        },
        onWheel(event) {
            event.preventDefault();
            this.setZoom(this.zoom * (event.deltaY > 0 ? 0.9 : 1.1));
        },
        setZoom(next) {
            this.zoom = clamp(Number(next.toFixed(3)), 0.35, 2);
        },
        zoomIn() { this.setZoom(this.zoom * 1.2); },
        zoomOut() { this.setZoom(this.zoom / 1.2); },

        /** 回到当前所在的那一幕(默认视角:你在哪儿就看哪儿) */
        focusCurrent() {
            const hit = this.placed.find((p) => p.isCurrent);
            const box = this.$refs.viewport;
            if (!hit || !box) { this.fitAll(); return; }
            this.zoom = 1;
            this.panX = box.clientWidth / 2 - (hit.x + NODE_W / 2);
            this.panY = box.clientHeight / 2 - (hit.y + NODE_H / 2);
        },
        /**
         * 全览:缩到整棵树都进得来。
         *
         * 下限 0.4 —— 再小节点上的字就完全看不清了,那还不如让用户自己拖。
         */
        fitAll() {
            const box = this.$refs.viewport;
            if (!box) { this.zoom = 1; this.panX = 0; this.panY = 0; return; }
            const { w, h } = this.canvasSize;
            const scale = Math.min(box.clientWidth / w, box.clientHeight / h, 1);
            this.zoom = clamp(Number(scale.toFixed(3)), 0.4, 1);
            this.panX = Math.max(0, (box.clientWidth - w * this.zoom) / 2);
            this.panY = Math.max(0, (box.clientHeight - h * this.zoom) / 2);
        },
    },
    mounted() {
        this.selectedId = this.currentId;
        this.$nextTick(() => this.focusCurrent());
    },
    template: `
        <div class="gg-tree">
            <div class="gg-tree-toolbar">
                <GgButton size="sm" icon-name="target" @click="focusCurrent">回到当前</GgButton>
                <GgButton size="sm" icon-name="layers" @click="fitAll">全览</GgButton>
                <GgButton size="sm" icon-name="zoomOut" icon-only label="缩小" @click="zoomOut" />
                <span class="gg-tree-zoom">{{ Math.round(zoom * 100) }}%</span>
                <GgButton size="sm" icon-name="zoomIn" icon-only label="放大" @click="zoomIn" />
                <label class="gg-tree-only">
                    <input type="checkbox" v-model="pathOnly" />
                    <span>只看当前线</span>
                </label>
            </div>

            <p v-if="tooBig" class="gg-tree-warn">
                这棵树已经有 {{ allNodes.length }} 幕了,勾上「只看当前线」会流畅很多。
            </p>

            <div
                ref="viewport"
                class="gg-tree-viewport"
                :class="{ 'is-dragging': dragging }"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
                @wheel="onWheel"
            >
                <div class="gg-tree-canvas" :style="canvasStyle">
                    <svg class="gg-tree-edges" :width="canvasSize.w" :height="canvasSize.h" aria-hidden="true">
                        <path
                            v-for="edge in edges"
                            :key="edge.id"
                            :d="edge.d"
                            class="gg-tree-edge"
                            :class="{ 'is-path': edge.onPath }"
                        />
                    </svg>

                    <button
                        v-for="item in placed"
                        :key="item.node.id"
                        type="button"
                        class="gg-tree-node"
                        :class="{
                            'is-path': item.onPath,
                            'is-current': item.isCurrent,
                            'is-selected': String(item.node.id) === String(selectedId),
                            'is-custom': item.isCustom,
                            'is-ending': item.ending
                        }"
                        :style="{ left: item.x + 'px', top: item.y + 'px' }"
                        @click="onSelect(item.node.id)"
                        @dblclick="onJump(item.node.id)"
                    >
                        <span v-if="item.choice" class="gg-tree-choice">{{ item.choice }}</span>
                        <span class="gg-tree-label">{{ item.label }}</span>
                        <span v-if="item.kLabel" class="gg-tree-k">{{ item.kLabel }}</span>
                        <span v-else-if="item.pending" class="gg-tree-k is-pending">压缩中</span>
                        <span v-if="item.ending" class="gg-tree-ending" aria-label="结局"><GgIcon name="flag" /></span>
                    </button>
                </div>
            </div>

            <div v-if="selectedDetail" class="gg-tree-detail">
                <div class="gg-tree-detail-head">
                    <span class="gg-tree-detail-title">
                        第 {{ selectedDetail.node.depth + 1 }} 幕
                        <em v-if="selectedDetail.node.choice.text">· {{ selectedDetail.node.choice.text }}</em>
                    </span>
                    <GgTag>窗口 {{ selectedDetail.windowUsed }} 格</GgTag>
                    <GgTag v-if="selectedDetail.kLabel" tone="k">{{ selectedDetail.kLabel }}</GgTag>
                </div>
                <p v-for="(line, i) in selectedDetail.lines" :key="i" class="gg-tree-detail-line">
                    <b v-if="line.speaker">{{ line.speaker }}</b>{{ line.text }}
                </p>
                <p v-if="selectedDetail.kContent" class="gg-tree-detail-k">
                    <b>{{ selectedDetail.kLabel }}</b>{{ selectedDetail.kContent }}
                </p>
                <div class="gg-tree-detail-actions">
                    <GgButton variant="primary" size="sm" icon-name="play" @click="onJump(selectedDetail.node.id)">跳到这里</GgButton>
                    <GgButton variant="danger" size="sm" icon-name="trash" @click="onDelete(selectedDetail.node.id)">
                        删除{{ selectedDetail.subtreeSize > 1 ? '这条分支(' + selectedDetail.subtreeSize + '幕)' : '这一幕' }}
                    </GgButton>
                </div>
            </div>
        </div>
    `,
};

export default GgBranchTree;
