/**
 * 湛蓝回忆 · K 链记忆面板
 *
 * 原型的「记忆管理」是:玩到第 5 次选择时按钮变成「一键总结 (5次选择)」,
 * 用户手动点一下,AI 把最近的日志切成若干个「记忆模块」({分类: [条目]}),
 * 之后发消息时用**关键词匹配**挑出「相关记忆」拼进 prompt。
 *
 * 三个问题:
 *   1. 全局一份。回到旧节点开新分支,记忆还是另一条线的。
 *   2. 靠关键词匹配挑记忆(`extractKeywords` 就是按标点切词然后取交集),
 *      经常挑不到该挑的,或者把不相干的塞进去。
 *   3. 不压缩,只分类。玩到第 50 幕时记忆模块本身就已经很长了。
 *
 * 现在换成 **K 链**:滑动窗口 + 迭代式增量压缩,窗口状态挂在**每个节点**上。
 * 规则和推演见 `services/kchain.js` 的文件头。这一屏负责让它**看得见**:
 *
 *   - 窗口现在几格、还差几幕触发
 *   - 这条线路上压出过哪些 K、每个 K 覆盖了多少幕、正文是什么(可以手改)
 *
 * 「K 链记忆最终在上下文里长什么样 / 排在第几段」属于**拼接**的事,在「提示词」面板。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { pathTo } from '../services/kchain.js';
import { asArray, truncate, formatRelative } from '../utils.js';

export const GgPanelMemory = {
    name: 'GgPanelMemory',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { editingK: '' };
    },
    computed: {
        state() { return store.getState(); },
        game() { return store.getGame(); },
        settings() { return store.getSettings(); },
        kChain() { return this.settings.kChain; },
        stats() { return store.getKStats(); },
        node() { return store.getCurrentNode(); },

        /** 窗口格子:满 windowSize 个就触发压缩 */
        slots() {
            const units = asArray(this.node?.kState?.units);
            const size = Math.max(2, this.kChain.windowSize);
            const out = [];
            for (let i = 0; i < size; i += 1) {
                const unit = units[i];
                if (!unit) { out.push({ kind: 'empty', label: '空位' }); continue; }
                if (unit.type === 'k') {
                    out.push({ kind: 'k', label: `K${unit.index}`, sub: `${asArray(unit.coversNodeIds).length} 幕` });
                } else {
                    const target = this.state.nodes.find((n) => String(n.id) === String(unit.nodeId));
                    out.push({ kind: 'r', label: target ? `第 ${target.depth + 1} 幕` : '回合', sub: target?.choice?.text ? truncate(target.choice.text, 8) : '' });
                }
            }
            return out;
        },

        /** 这条线路上生成过的所有 K(按时间从早到晚) */
        chain() {
            if (!this.node) return [];
            const path = pathTo(this.node, store.getNodeMap());
            const out = [];
            for (const n of path) {
                for (const unit of asArray(n.kState?.units)) {
                    if (unit.type !== 'k') continue;
                    if (out.some((x) => x.unit.index === unit.index)) continue;
                    out.push({ nodeId: n.id, unit, at: n.depth + 1 });
                }
            }
            return out.sort((a, b) => a.unit.index - b.unit.index);
        },

        canCompress() {
            const units = asArray(this.node?.kState?.units).length;
            return units >= 2 && !this.state.compressing;
        },

    },
    methods: {
        setK(patch) { store.updateKChain(patch); },
        async onCompress() {
            const result = await store.compressNode(this.node?.id);
            if (!result.ok) this.$emit('notify', result.error);
        },
        onEditK(item) {
            this.editingK = this.editingK === item.unit.id ? '' : item.unit.id;
        },
        onKContent(item, value) {
            store.editKUnit(item.nodeId, item.unit.id, value);
        },
        onJump(nodeId) {
            if (store.setCurrentNode(nodeId)) this.$emit('notify', '已切到这一幕');
        },
        rel(ts) { return formatRelative(ts); },
    },
    template: `
        <div class="gg-panel-body">
            <GgEmpty v-if="!node" text="还没有剧情" hint="生成第一幕之后,记忆链就会开始积累" />

            <template v-else>
                <!-- 窗口 -->
                <GgSection title="当前窗口" icon-name="layers" :hint="stats.windowUsed + ' / ' + stats.windowSize">
                    <div class="gg-kslots">
                        <div v-for="(slot, i) in slots" :key="i" class="gg-kslot" :data-kind="slot.kind">
                            <span class="gg-kslot-label">{{ slot.label }}</span>
                            <span v-if="slot.sub" class="gg-kslot-sub">{{ slot.sub }}</span>
                        </div>
                    </div>
                    <p class="gg-kslot-hint">
                        <template v-if="!kChain.enabled">K 链已关闭,上下文里会带整条线路的原文。</template>
                        <template v-else-if="stats.pending">正在压缩这一批…</template>
                        <template v-else-if="stats.untilCompress > 0">再走 {{ stats.untilCompress }} 幕就会自动压成 K{{ stats.kCount }}。</template>
                        <template v-else>已经满格,下一幕生成时会压缩。</template>
                        <template v-if="stats.rawTail"> 另外 {{ stats.rawTail }} 幕原文会一直保留。</template>
                    </p>
                    <div class="gg-row-actions">
                        <GgButton size="sm" variant="ghost" icon-name="compress" :loading="state.compressing" :disabled="!canCompress" @click="onCompress">
                            立刻压一次
                        </GgButton>
                    </div>
                </GgSection>

                <!-- 链条 -->
                <GgSection title="这条线路的记忆链" icon-name="memory" :hint="chain.length + ' 个 K'">
                    <GgEmpty v-if="!chain.length" text="还没有压缩过" hint="窗口满了会自动生成 K0" />
                    <div v-for="item in chain" :key="item.unit.id" class="gg-kcard">
                        <div class="gg-kcard-head">
                            <GgTag tone="k">K{{ item.unit.index }}</GgTag>
                            <span class="gg-kcard-meta">第 {{ item.at }} 幕生成 · 覆盖 {{ item.unit.coversNodeIds.length }} 幕 · {{ rel(item.unit.createdAt) }}</span>
                            <GgButton size="sm" icon-name="edit" icon-only label="编辑" @click="onEditK(item)" />
                            <GgButton size="sm" icon-name="target" icon-only label="跳到那一幕" @click="onJump(item.nodeId)" />
                        </div>
                        <GgTextarea
                            v-if="editingK === item.unit.id"
                            :model-value="item.unit.content"
                            :rows="6"
                            @update:model-value="onKContent(item, $event)"
                        />
                        <p v-else class="gg-kcard-text">{{ item.unit.content }}</p>
                    </div>
                </GgSection>

                <!-- 设置 -->
                <GgSection title="K 链设置" icon-name="settings">
                    <GgSwitch label="启用 K 链" hint="关掉之后每次都带整条线路的原文,几十幕之后会很贵" :model-value="kChain.enabled" @update:model-value="setK({ enabled: $event })" />
                    <GgSwitch label="满了自动压缩" :model-value="kChain.autoCompress" :disabled="!kChain.enabled" @update:model-value="setK({ autoCompress: $event })" />
                    <GgSlider label="窗口大小" suffix=" 格" :min="2" :max="8" :model-value="kChain.windowSize" @update:model-value="setK({ windowSize: $event })" />
                    <p class="gg-hint">几个单元触发一次压缩。K 自己也算一格,所以 4 格 = K + 3 幕新剧情。</p>
                    <GgSlider label="额外保留原文" suffix=" 幕" :min="0" :max="6" :model-value="kChain.rawTail" @update:model-value="setK({ rawTail: $event })" />
                    <p class="gg-hint">压缩刚发生那一瞬间窗口只剩一个 K,不留原文的话 AI 手上一句原话都没有,人物会跳戏。</p>
                </GgSection>

                <p class="gg-hint">
                    K 链记忆是「拼接顺序」里的一段。想看它在上下文里长什么样、或者调它的位置,
                    去「提示词」面板。
                </p>
            </template>
        </div>
    `,
};

export default GgPanelMemory;
