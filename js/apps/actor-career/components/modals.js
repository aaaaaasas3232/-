/**
 * 追光 · 弹窗集合
 *
 * 事件处理 / 跨日 / 快进 / 人设同步三选一 / 阶段结算进度 /
 * 获奖 / AI 人设变化三选一 / 开新档 / 生成结局。
 * 全部由 store.modal 驱动，root 统一渲染。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { tierSpec } from '../constants.js';
import { eventDefById } from '../services/event-engine.js';

export const AcModals = {
    name: 'AcModals',
    components: { ...UI },
    data() {
        return {
            ffDays: 7,
            ffOpinion: '',
            newSaveName: '',
            resetWrites: true,
            endingOpinion: '',
        };
    },
    computed: {
        s() { return store.getState(); },
        modal() { return this.s.modal; },
        eventDef() {
            return this.modal?.type === 'event' ? eventDefById(this.modal.defId) : null;
        },
        eventRow() {
            return this.modal?.type === 'event'
                ? this.s.events.find((e) => e.id === this.modal.eventId)
                : null;
        },
        run() { return this.s.settlementRun; },
        prCost() {
            return this.s.save ? tierSpec(this.s.save.tier).prCost : 0;
        },
    },
    methods: {
        close() { store.closeModal(); },
        pickOption(optionId) {
            store.resolveEventOption(this.modal.eventId, optionId);
        },
        confirmNextDay() { store.confirmNextDay(); },
        async doFastForward() {
            const result = await store.fastForwardDays(this.ffDays, this.ffOpinion);
            if (result?.aiError) store.showToast(`时间推进了，但叙事没生成：${result.aiError}`);
            this.ffOpinion = '';
        },
        personaChoice(choice) { store.applyPersonaChoice(choice); },
        aiDiffChoice(choice) { store.resolveAiPersonaDiff(this.modal.npcId, choice); },
        async createSave() {
            await store.createSave({ name: this.newSaveName, resetPersonaWrites: this.resetWrites });
            this.newSaveName = '';
            store.closeModal();
        },
        async doEnding() {
            store.closeModal();
            const result = await store.generateEnding(this.endingOpinion);
            if (!result.ok && result.error) store.showToast(result.error);
            this.endingOpinion = '';
        },
        optionCostText(option) {
            if (!option.costKind) return '';
            const spec = tierSpec(this.s.save.tier);
            const amount = option.costKind === 'bigMoney' ? spec.prCost * 6 : spec.prCost;
            return `花费 ${amount} ${this.s.identity.currency}`;
        },
        tierLabelOf(t) { return tierSpec(t).label; },
        formatJson(o) {
            try { return JSON.stringify(o, null, 2); } catch (_) { return String(o); }
        },
    },
    template: `
        <div>
            <!-- 突发事件 -->
            <AcModalShell v-if="modal && modal.type === 'event' && eventDef" :title="eventDef.title" persistent>
                <p class="zg-prose">{{ eventDef.desc }}</p>
                <p v-if="eventRow && eventRow.npcName" class="zg-note">牵扯到的人：{{ eventRow.npcName }}</p>
                <p v-if="eventRow && eventRow.chance" class="zg-note">这件事发生的概率是 {{ eventRow.chance }}%（分线曲线 × 你的属性护盾）</p>
                <div class="zg-optionlist">
                    <button v-for="option in eventDef.options" :key="option.id" type="button"
                        class="zg-optionrow" @click="pickOption(option.id)">
                        <b>{{ option.label }}</b>
                        <span v-if="optionCostText(option)" class="zg-optionrow__cost">{{ optionCostText(option) }}</span>
                        <i v-if="option.effects && option.effects.note">{{ option.effects.note }}</i>
                    </button>
                </div>
            </AcModalShell>

            <!-- 跨日 -->
            <AcModalShell v-else-if="modal && modal.type === 'next-day'" title="这一天要过去了" @close="close">
                <p class="zg-prose" v-if="modal.reason === 'midnight'">已经到 24:00 了。进入下一天，还是现实里明天再来？</p>
                <p class="zg-prose" v-else-if="modal.reason === 'real-day-crossed'">现实里已经过了一天。要让档里也进入新的一天吗？</p>
                <p class="zg-prose" v-else>确定收工进入下一天？精力会恢复一部分，新的一天会掷一次事件签。</p>
                <template #actions>
                    <AcBtn variant="ghost" @click="close">明天再玩</AcBtn>
                    <AcBtn variant="ink" @click="confirmNextDay">进入下一天</AcBtn>
                </template>
            </AcModalShell>

            <!-- 快进 -->
            <AcModalShell v-else-if="modal && modal.type === 'fast-forward'" title="快进时间线" @close="close">
                <p class="zg-prose">整档的纪时会一起前进 —— 世界日期、锚点、事件掷签都按新时间走，退不回来（除非回档）。</p>
                <div class="zg-chiprow">
                    <button v-for="d in [3, 7, 14, 30]" :key="d" type="button"
                        class="zg-chip" :class="{ 'is-on': ffDays === d }" @click="ffDays = d">{{ d }} 天</button>
                </div>
                <AcField label="自定义天数"><input class="zg-input" type="number" v-model.number="ffDays" min="1" max="90" /></AcField>
                <AcField label="这段时间想怎么过（进入生成，可空）">
                    <textarea class="zg-input zg-input--area" v-model.trim="ffOpinion" rows="2"
                        placeholder="如：闭关上课，不接通告"></textarea>
                </AcField>
                <template #actions>
                    <AcBtn variant="ghost" @click="close">取消</AcBtn>
                    <AcBtn variant="ink" :loading="s.loading.fastForward" @click="doFastForward">快进 {{ ffDays }} 天</AcBtn>
                </template>
            </AcModalShell>

            <!-- 人设同步三选一 -->
            <AcModalShell v-else-if="modal && modal.type === 'persona-sync'" title="要同步到人设卡吗" persistent>
                <p class="zg-prose">{{ modal.line }}</p>
                <p class="zg-note">发生了会改变「你是谁」的事。写进 nook 人设经历会影响所有 App 里的你；存成阶段卡则只留在追光的卡库里。</p>
                <div class="zg-optionlist">
                    <button type="button" class="zg-optionrow" @click="personaChoice('overwrite')">
                        <b>写进人设经历</b><i>会留台账，重开档可回收</i>
                    </button>
                    <button type="button" class="zg-optionrow" @click="personaChoice('stagecard')">
                        <b>存成阶段卡</b><i>跨档保留，不动 nook 人设</i>
                    </button>
                    <button type="button" class="zg-optionrow" @click="personaChoice('skip')">
                        <b>暂时不动</b><i>只留在大事记里</i>
                    </button>
                </div>
            </AcModalShell>

            <!-- 阶段结算进度（多块串行） -->
            <AcModalShell v-else-if="modal && modal.type === 'settlement'" title="阶段结算" :persistent="s.loading.settlement"
                @close="close" wide>
                <p v-if="run" class="zg-prose">
                    {{ tierLabelOf(run.fromTier) }} → {{ tierLabelOf(run.toTier) }} · 五块内容逐块生成，生成过的块不会重来（没有重 roll）。
                </p>
                <div v-if="run" class="zg-blocklist">
                    <div v-for="block in run.blocks" :key="block.id" class="zg-blockrow" :class="'is-' + block.status">
                        <span class="zg-blockrow__dot"></span>
                        <div class="zg-blockrow__main">
                            <b>{{ block.label }}</b>
                            <p v-if="block.status === 'running'">生成中……</p>
                            <p v-else-if="block.status === 'failed'" class="is-danger">{{ block.error }}（已完成的块保留，可稍后重新发起结算续跑）</p>
                            <pre v-else-if="block.status === 'done' && typeof block.output === 'string'" class="zg-blockrow__out">{{ block.output }}</pre>
                            <pre v-else-if="block.status === 'done'" class="zg-blockrow__out">{{ formatJson(block.output) }}</pre>
                        </div>
                    </div>
                </div>
                <template #actions>
                    <AcBtn v-if="!s.loading.settlement" variant="ink" @click="close">好</AcBtn>
                </template>
            </AcModalShell>

            <!-- 获奖 -->
            <AcModalShell v-else-if="modal && modal.type === 'award'" title="颁奖夜" @close="close">
                <div class="zg-awardwin">
                    <AcIcon name="trophy" :size="40" />
                    <b>{{ modal.honor }}</b>
                    <p v-if="modal.contest">概率 {{ Math.round(modal.contest.chance * 100) }}% · roll {{ modal.contest.roll.toFixed(3) }}（seed 已存档，可回放）</p>
                </div>
                <template #actions>
                    <AcBtn variant="gold" @click="close">收下奖杯</AcBtn>
                </template>
            </AcModalShell>

            <!-- AI 人设变化三选一 -->
            <AcModalShell v-else-if="modal && modal.type === 'ai-persona-diff'" :title="modal.npcName + ' 的人设变了'" persistent>
                <p class="zg-prose">TA 在 nook 里的人设卡更新了。这个档里的 TA 要跟着变吗？</p>
                <div class="zg-optionlist">
                    <button type="button" class="zg-optionrow" @click="aiDiffChoice('overwrite')">
                        <b>覆盖快照</b><i>档里的 TA 立刻用新人设</i>
                    </button>
                    <button type="button" class="zg-optionrow" @click="aiDiffChoice('stagecard')">
                        <b>旧人设存成阶段卡，再覆盖</b><i>老版本封存进卡库</i>
                    </button>
                    <button type="button" class="zg-optionrow" @click="aiDiffChoice('keep')">
                        <b>先不动</b><i>档里的 TA 保持这一档开始时的样子</i>
                    </button>
                </div>
            </AcModalShell>

            <!-- 开新档 -->
            <AcModalShell v-else-if="modal && modal.type === 'new-save'" title="开新档" @close="close">
                <p class="zg-prose">时间线回到原点（从现在重新开始走），线级与属性按首配重置，30 位 NPC 还是那 30 位。阶段卡不删。</p>
                <AcField label="档名"><input class="zg-input" v-model.trim="newSaveName" :placeholder="'第 ' + (s.saves.length + 1) + ' 档'" maxlength="12" /></AcField>
                <label class="zg-checkline">
                    <input type="checkbox" v-model="resetWrites" />
                    <span>同时回收之前写进人设经历的内容（推荐：新档从干净的人设开始）</span>
                </label>
                <template #actions>
                    <AcBtn variant="ghost" @click="close">取消</AcBtn>
                    <AcBtn variant="ink" @click="createSave">开档</AcBtn>
                </template>
            </AcModalShell>

            <!-- 生成结局 -->
            <AcModalShell v-else-if="modal && modal.type === 'ending-ask'" title="为这一档写结局" @close="close">
                <p class="zg-prose">把这一档从入行到今天的大事记交给 AI，写一篇结局。写完还能继续玩日常。</p>
                <AcField label="想要什么样的结局（可空）">
                    <textarea class="zg-input zg-input--area" v-model.trim="endingOpinion" rows="2"
                        placeholder="如：落点放在一场安静的谢幕"></textarea>
                </AcField>
                <template #actions>
                    <AcBtn variant="ghost" @click="close">再等等</AcBtn>
                    <AcBtn variant="gold" :loading="s.loading.ending" @click="doEnding">生成结局</AcBtn>
                </template>
            </AcModalShell>
        </div>
    `,
};
