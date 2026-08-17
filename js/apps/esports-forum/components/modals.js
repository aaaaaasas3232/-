/**
 * 声浪 · 弹窗集合
 *
 * 突发事件 / 跨日 / 快进 / 人设同步三选一 / AI 人设变化三选一 /
 * 开新档 / 删档确认 / 赛季收官 / 生成结局 / 发帖 / 开小号 / 换 AI 角色卡。
 * 全部由 store.modal 驱动，root 统一渲染。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { prCostByFame } from '../constants.js';
import { eventDefById } from '../services/event-engine.js';
import { listWorldAis } from '../services/world-context.js';
import { asArray } from '../utils.js';

export const EfModals = {
    name: 'EfModals',
    components: { ...UI },
    data() {
        return {
            ffDays: 7,
            ffOpinion: '',
            newSaveName: '',
            resetWrites: true,
            endingOpinion: '',
            postTitle: '',
            postBody: '',
            postIdentityId: '',
            newIdentityName: '',
            replaceAiId: '',
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
        identities() { return asArray(this.s.profile?.identities); },
        worldAis() { return listWorldAis(); },
        prCost() {
            return this.s.save ? prCostByFame(this.s.save.attrs?.fame ?? 0) : 0;
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
        aiDiffChoice(choice) { store.resolveAiPersonaDiff(this.modal.slotId, choice); },
        async createSave() {
            await store.createSave({ name: this.newSaveName, resetPersonaWrites: this.resetWrites });
            this.newSaveName = '';
            store.closeModal();
        },
        async confirmDeleteSave() {
            await store.deleteSave(this.modal.saveId);
            store.closeModal();
        },
        async doEnding() {
            store.closeModal();
            const result = await store.generateEnding(this.endingOpinion);
            if (!result.ok && result.error) store.showToast(result.error);
            this.endingOpinion = '';
        },
        async submitPost() {
            const result = await store.createUserPost({
                boardId: this.modal.boardId,
                title: this.postTitle,
                body: this.postBody,
                identityId: this.postIdentityId,
            });
            if (result.ok) {
                this.postTitle = '';
                this.postBody = '';
                store.closeModal();
                store.setView('thread', { postId: result.post.id, boardId: result.post.boardId });
            } else if (result.error) {
                store.showToast(result.error);
            }
        },
        async submitIdentity() {
            const result = await store.addIdentity(this.newIdentityName);
            if (result.ok) {
                this.newIdentityName = '';
                store.closeModal();
            } else if (result.error) {
                store.showToast(result.error);
            }
        },
        async submitReplace() {
            if (!this.replaceAiId) return;
            const result = await store.replaceSlotWithAi(this.modal.playerId, this.replaceAiId);
            if (result.ok) {
                this.replaceAiId = '';
                store.closeModal();
            } else if (result.error) {
                store.showToast(result.error);
            }
        },
        optionCostText(option) {
            if (!option.costKind) return '';
            const amount = option.costKind === 'bigMoney' ? this.prCost * 5 : this.prCost;
            return `花费 ${amount} ${this.s.identity.currency}`;
        },
    },
    template: `
        <div>
            <!-- 突发事件 -->
            <EfModalShell v-if="modal && modal.type === 'event' && eventDef" :title="eventDef.title" persistent>
                <p class="ef-prose">{{ eventDef.desc }}</p>
                <p v-if="eventRow && eventRow.chance" class="ef-note">这件事发生的概率是 {{ eventRow.chance }}%（人气曲线 × 你的属性护盾）</p>
                <div class="ef-optionlist">
                    <button v-for="option in eventDef.options" :key="option.id" type="button"
                        class="ef-optionrow" @click="pickOption(option.id)">
                        <b>{{ option.label }}</b>
                        <span v-if="optionCostText(option)" class="ef-optionrow__cost">{{ optionCostText(option) }}</span>
                        <i v-if="option.effects && option.effects.note">{{ option.effects.note }}</i>
                    </button>
                </div>
            </EfModalShell>

            <!-- 跨日 -->
            <EfModalShell v-else-if="modal && modal.type === 'next-day'" title="这一天要过去了" @close="close">
                <p class="ef-prose" v-if="modal.reason === 'midnight'">已经到 24:00 了。进入下一天，还是现实里明天再来？</p>
                <p class="ef-prose" v-else-if="modal.reason === 'real-day-crossed'">现实里已经过了一天。要让档里也进入新的一天吗？</p>
                <p class="ef-prose" v-else>确定收工进入下一天？精力会恢复一部分，赛程照走，新的一天会掷一次事件签。</p>
                <template #actions>
                    <EfBtn variant="ghost" @click="close">明天再玩</EfBtn>
                    <EfBtn variant="ink" @click="confirmNextDay">进入下一天</EfBtn>
                </template>
            </EfModalShell>

            <!-- 快进 -->
            <EfModalShell v-else-if="modal && modal.type === 'fast-forward'" title="快进时间线" @close="close">
                <p class="ef-prose">整档的纪时一起前进 —— 赛程照打（你的比赛会按状态自动打完）、事件照掷、锚点照开，退不回来（除非回档）。</p>
                <div class="ef-chiprow">
                    <button v-for="d in [3, 7, 14, 30]" :key="d" type="button"
                        class="ef-chip" :class="{ 'is-on': ffDays === d }" @click="ffDays = d">{{ d }} 天</button>
                </div>
                <EfField label="自定义天数"><input class="ef-input" type="number" v-model.number="ffDays" min="1" max="90" /></EfField>
                <EfField label="这段时间想怎么过（进入生成，可空）">
                    <textarea class="ef-input ef-input--area" v-model.trim="ffOpinion" rows="2"
                        placeholder="如：闭关猛练新版本，不看论坛"></textarea>
                </EfField>
                <template #actions>
                    <EfBtn variant="ghost" @click="close">取消</EfBtn>
                    <EfBtn variant="ink" :loading="s.loading.fastForward" @click="doFastForward">快进 {{ ffDays }} 天</EfBtn>
                </template>
            </EfModalShell>

            <!-- 人设同步三选一 -->
            <EfModalShell v-else-if="modal && modal.type === 'persona-sync'" title="要同步到人设卡吗" persistent>
                <p class="ef-prose">{{ modal.line }}</p>
                <p class="ef-note">发生了会改变「你是谁」的事。写进 nook 人设经历会影响所有 App 里的你；存成阶段卡则只留在声浪的卡库里。</p>
                <div class="ef-optionlist">
                    <button type="button" class="ef-optionrow" @click="personaChoice('overwrite')">
                        <b>写进人设经历</b><i>会留台账，重开档可回收</i>
                    </button>
                    <button type="button" class="ef-optionrow" @click="personaChoice('stagecard')">
                        <b>存成阶段卡</b><i>跨档保留，不动 nook 人设</i>
                    </button>
                    <button type="button" class="ef-optionrow" @click="personaChoice('skip')">
                        <b>暂时不动</b><i>只留在大事记里</i>
                    </button>
                </div>
            </EfModalShell>

            <!-- AI 人设变化三选一 -->
            <EfModalShell v-else-if="modal && modal.type === 'ai-persona-diff'" :title="modal.npcName + ' 的人设变了'" persistent>
                <p class="ef-prose">TA 在 nook 里的人设卡更新了。这个档里的 TA 要跟着变吗？</p>
                <div class="ef-optionlist">
                    <button type="button" class="ef-optionrow" @click="aiDiffChoice('overwrite')">
                        <b>覆盖快照</b><i>档里的 TA 立刻用新人设</i>
                    </button>
                    <button type="button" class="ef-optionrow" @click="aiDiffChoice('stagecard')">
                        <b>旧人设存成阶段卡，再覆盖</b><i>老版本封存进卡库</i>
                    </button>
                    <button type="button" class="ef-optionrow" @click="aiDiffChoice('keep')">
                        <b>先不动</b><i>档里的 TA 保持替换时的样子</i>
                    </button>
                </div>
            </EfModalShell>

            <!-- 开新档 -->
            <EfModalShell v-else-if="modal && modal.type === 'new-save'" title="开新档" @close="close">
                <p class="ef-prose">时间线回到原点，属性按首配重置，赛季从第一个启用赛事重开。18 支战队还是那 18 支。阶段卡不删。</p>
                <EfField label="档名"><input class="ef-input" v-model.trim="newSaveName" :placeholder="'第 ' + (s.saves.length + 1) + ' 档'" maxlength="12" /></EfField>
                <label class="ef-checkline">
                    <input type="checkbox" v-model="resetWrites" />
                    <span>同时回收之前写进人设经历的内容（推荐：新档从干净的人设开始）</span>
                </label>
                <template #actions>
                    <EfBtn variant="ghost" @click="close">取消</EfBtn>
                    <EfBtn variant="ink" @click="createSave">开档</EfBtn>
                </template>
            </EfModalShell>

            <!-- 删档确认 -->
            <EfModalShell v-else-if="modal && modal.type === 'confirm-delete-save'" title="删除这个档？" @close="close">
                <p class="ef-prose">这一档的赛季、帖子、大事记会一起删掉；写进世界观时间轴的大事会回收。阶段卡不受影响。</p>
                <template #actions>
                    <EfBtn variant="ghost" @click="close">手滑了</EfBtn>
                    <EfBtn variant="danger" @click="confirmDeleteSave">删除</EfBtn>
                </template>
            </EfModalShell>

            <!-- 赛季收官 -->
            <EfModalShell v-else-if="modal && modal.type === 'season-end'" :title="modal.seasonName + ' 收官'" @close="close">
                <div class="ef-awardwin">
                    <EfIcon name="trophy" :size="40" />
                    <b>{{ modal.isChampion ? '你们是冠军！' : modal.isRunner ? '亚军 —— 差一步登顶' : '冠军：' + modal.champion }}</b>
                    <p v-if="modal.prize">个人奖金 {{ modal.prize }} {{ s.identity.currency }} 已入账</p>
                </div>
                <template #actions>
                    <EfBtn variant="volt" @click="close">{{ modal.isChampion ? '举起奖杯' : '记住这一天' }}</EfBtn>
                </template>
            </EfModalShell>

            <!-- 生成结局 -->
            <EfModalShell v-else-if="modal && modal.type === 'ending-ask'" title="为这一档写结局" @close="close">
                <p class="ef-prose">把这一档从出道到今天的大事记交给 AI，写一篇结局。写完还能继续玩日常。</p>
                <EfField label="想要什么样的结局（可空）">
                    <textarea class="ef-input ef-input--area" v-model.trim="endingOpinion" rows="2"
                        placeholder="如：落点放在退役夜的最后一场直播"></textarea>
                </EfField>
                <template #actions>
                    <EfBtn variant="ghost" @click="close">再等等</EfBtn>
                    <EfBtn variant="volt" :loading="s.loading.ending" @click="doEnding">生成结局</EfBtn>
                </template>
            </EfModalShell>

            <!-- 发帖 -->
            <EfModalShell v-else-if="modal && modal.type === 'new-post'" title="发帖（匿名）" @close="close" wide>
                <EfField label="用哪个马甲">
                    <select class="ef-input" v-model="postIdentityId">
                        <option value="">{{ identities.find(i => i.isMain) ? identities.find(i => i.isMain).name : '主马甲' }}</option>
                        <option v-for="i in identities.filter(x => !x.isMain)" :key="i.id" :value="i.id">{{ i.name }}（小号）</option>
                    </select>
                </EfField>
                <EfField label="标题"><input class="ef-input" v-model.trim="postTitle" maxlength="40" placeholder="像个路人一样起标题" /></EfField>
                <EfField label="正文（可空）">
                    <textarea class="ef-input ef-input--area" v-model.trim="postBody" rows="4" placeholder="没人知道发帖的是选手本人"></textarea>
                </EfField>
                <p class="ef-note">发出去之后可以点「生成评论」看看大家的反应；评论可以删，但不能重 roll。murmur 里的 AI 永远不知道这个马甲是你。</p>
                <template #actions>
                    <EfBtn variant="ghost" @click="close">取消</EfBtn>
                    <EfBtn variant="ink" @click="submitPost">发出去</EfBtn>
                </template>
            </EfModalShell>

            <!-- 开小号 -->
            <EfModalShell v-else-if="modal && modal.type === 'new-identity'" title="开个小号" @close="close">
                <EfField label="小号名"><input class="ef-input" v-model.trim="newIdentityName" maxlength="16" placeholder="如：路灯下蹲着" /></EfField>
                <p class="ef-note">小号发的帖和主马甲互不关联。用小号进自家板块冲浪的选手不止你一个。</p>
                <template #actions>
                    <EfBtn variant="ghost" @click="close">取消</EfBtn>
                    <EfBtn variant="ink" @click="submitIdentity">注册</EfBtn>
                </template>
            </EfModalShell>

            <!-- 换 AI 角色卡 -->
            <EfModalShell v-else-if="modal && modal.type === 'replace-slot'" :title="'替换 ' + modal.playerName" @close="close">
                <p class="ef-prose">选一张这个世界观下已有的 AI 角色卡顶上这个位置。TA 的人设会进比赛叙事与社媒；数值沿用槽位。</p>
                <div class="ef-optionlist">
                    <button v-for="ai in worldAis" :key="ai.id" type="button"
                        class="ef-optionrow" :class="{ 'is-on': replaceAiId === ai.id }"
                        @click="replaceAiId = ai.id">
                        <b>{{ ai.name }}</b>
                        <i>{{ ai.role || ai.personality || 'AI 角色' }}</i>
                    </button>
                </div>
                <EfEmpty v-if="!worldAis.length" iconName="users" title="这个世界还没有绑定的 AI 角色" desc="去 nook 给这个世界绑几个 AI 再来" />
                <template #actions>
                    <EfBtn variant="ghost" @click="close">取消</EfBtn>
                    <EfBtn variant="ink" :disabled="!replaceAiId" @click="submitReplace">替换</EfBtn>
                </template>
            </EfModalShell>
        </div>
    `,
};
