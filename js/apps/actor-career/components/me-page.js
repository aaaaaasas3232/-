/**
 * 追光 · 我的页
 *
 * 档案身份 / 存档管理（开档 · 读档 · 删档 · 结局）/ 阶段卡库 /
 * 人设改写台账 / 配色 / 提示词透明页入口。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { tierSpec } from '../constants.js';
import { fmtMoney, fmtRelative } from '../utils.js';

export const AcMePage = {
    name: 'AcMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        save() { return this.s.save; },
        profile() { return this.s.profile; },
        tier() { return this.save ? tierSpec(this.save.tier) : null; },
        writesCount() { return (this.profile?.personaWrites || []).length; },
    },
    methods: {
        fmtMoney,
        openSaves() { store.setView('saves'); },
        openCards() { store.setView('stagecards'); },
        openTheme() { store.setView('theme'); },
        openPrompts() { store.setView('prompts'); },
        openAnchors() { store.setView('anchors'); },
        openEnding() {
            if (this.save?.endingText) store.setView('ending');
            else store.openModal({ type: 'ending-ask' });
        },
    },
    template: `
        <div class="zg-page">
            <section class="zg-mecard">
                <div class="zg-mecard__name">
                    <b>{{ profile.stageName || s.identity.userName }}</b>
                    <AcTag tone="warn">{{ tier.label }}</AcTag>
                </div>
                <p class="zg-mecard__line">{{ profile.agencyStatus }}{{ profile.genres?.length ? ' · ' + profile.genres.join('/') : '' }}</p>
                <p v-if="profile.goal" class="zg-mecard__line is-dim">目标：{{ profile.goal }}</p>
                <p class="zg-mecard__line is-dim">{{ s.identity.worldName }} · {{ fmtMoney(s.balance) }} {{ s.identity.currency }}</p>
            </section>

            <AcSection title="这一档">
                <div class="zg-menurow" @click="openSaves">
                    <AcIcon name="save" :size="18" />
                    <div><b>存档管理</b><p>当前「{{ save.name }}」 · 共 {{ s.saves.length }} 档 · 换档读档开新档</p></div>
                    <AcIcon name="chevron" :size="15" />
                </div>
                <div class="zg-menurow" @click="openEnding">
                    <AcIcon name="flag" :size="18" />
                    <div><b>结局</b><p>{{ save.endingText ? '这档已写下结局（还能继续玩日常）' : '为这一档生成一篇结局' }}</p></div>
                    <AcIcon name="chevron" :size="15" />
                </div>
                <div class="zg-menurow" @click="openCards">
                    <AcIcon name="mask" :size="18" />
                    <div><b>阶段卡库</b><p>{{ s.stageCards.length }} 张 · 跨档保留，重开档也不删</p></div>
                    <AcIcon name="chevron" :size="15" />
                </div>
                <div class="zg-menurow" @click="openAnchors">
                    <AcIcon name="calendar" :size="18" />
                    <div><b>锚点配置</b><p>奖项（段锚点）与节日（点锚点），随时可改</p></div>
                    <AcIcon name="chevron" :size="15" />
                </div>
            </AcSection>

            <AcSection title="系统">
                <div class="zg-menurow" @click="openPrompts">
                    <AcIcon name="prompt" :size="18" />
                    <div><b>提示词与联动</b><p>看每次生成实际发了什么 · 社交影响 provider</p></div>
                    <AcIcon name="chevron" :size="15" />
                </div>
                <div class="zg-menurow" @click="openTheme">
                    <AcIcon name="palette" :size="18" />
                    <div><b>配色</b><p>两套内置主题 + 全部 token 可改</p></div>
                    <AcIcon name="chevron" :size="15" />
                </div>
                <div class="zg-menurow is-static">
                    <AcIcon name="edit" :size="18" />
                    <div><b>人设改写台账</b><p>{{ writesCount ? '本档案共写过 ' + writesCount + ' 行进人设经历，重开档可一键回收' : '还没往人设经历里写过东西（每次都会先问你）' }}</p></div>
                </div>
            </AcSection>

            <AcSection title="说明">
                <p class="zg-note">追光的每一次掷签（突发事件、试镜、演出成色、奖项）都带 seed 存档，回放一致；演出与阶段结算没有重 roll。钱与聊天红包、四叶草、候鸟同一本账。</p>
            </AcSection>
        </div>
    `,
};

export const AcSavesPage = {
    name: 'AcSavesPage',
    components: { ...UI },
    data() {
        return { confirmDeleteId: '' };
    },
    computed: {
        s() { return store.getState(); },
        saves() { return this.s.saves; },
    },
    methods: {
        fmtRelative,
        tierLabel(save) { return tierSpec(save.tier).label; },
        close() { store.setView(''); },
        pick(save) {
            if (save.id !== this.s.save?.id) store.switchSave(save.id);
        },
        openNew() { store.openModal({ type: 'new-save' }); },
        async del(saveId) {
            if (this.confirmDeleteId !== saveId) {
                this.confirmDeleteId = saveId;
                return;
            }
            this.confirmDeleteId = '';
            await store.deleteSave(saveId);
        },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b>存档管理</b>
                <span class="zg-section__spacer"></span>
                <AcBtn size="sm" variant="ink" iconName="plus" @click="openNew">开新档</AcBtn>
            </header>
            <div class="zg-overlay__body">
                <p class="zg-note">同一档案键下所有档共享那 30 位 NPC；新开档时间回到原点、属性按首配重置，阶段卡不删。写进人设的经历行可以在开档时选择回收。</p>
                <div v-for="save in saves" :key="save.id" class="zg-savecard"
                    :class="{ 'is-on': save.id === s.save?.id, 'is-ended': save.status === 'ended' }"
                    @click="pick(save)">
                    <div class="zg-savecard__main">
                        <b>{{ save.name }}
                            <AcTag v-if="save.id === s.save?.id" tone="success">当前</AcTag>
                            <AcTag v-if="save.status === 'ended'" tone="violet">已有结局</AcTag>
                        </b>
                        <p>{{ tierLabel(save) }} · 第 {{ save.clock?.day || 1 }} 天 · 作品 {{ save.finishedWorks || 0 }} 部 · 荣誉 {{ (save.honors || []).length }} 项</p>
                        <p class="is-dim">最近游玩 {{ fmtRelative(save.lastPlayedAt) }}</p>
                    </div>
                    <AcBtn size="sm" :variant="confirmDeleteId === save.id ? 'danger' : 'ghost'"
                        iconName="trash" @click.stop="del(save.id)">
                        {{ confirmDeleteId === save.id ? '确认删除' : '' }}
                    </AcBtn>
                </div>
            </div>
        </div>
    `,
};

export const AcStageCardsPage = {
    name: 'AcStageCardsPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        cards() { return this.s.stageCards; },
    },
    methods: {
        close() { store.setView(''); },
        del(card) { store.deleteStageCard(card.id); },
        tierLabel(t) { return tierSpec(t).label; },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b>阶段卡库</b>
            </header>
            <div class="zg-overlay__body">
                <AcEmpty v-if="!cards.length" iconName="mask" title="还没有阶段卡"
                    desc="重大事件与阶段结算时可以把人设的某个阶段封存成卡；AI 人设变化时也可以" />
                <div v-for="card in cards" :key="card.id" class="zg-stagecard">
                    <div class="zg-stagecard__head">
                        <b>{{ card.title }}</b>
                        <AcTag :tone="card.subjectType === 'ai' ? 'info' : 'plain'">{{ card.subjectName }}</AcTag>
                        <span class="zg-section__spacer"></span>
                        <AcBtn size="sm" variant="ghost" iconName="trash" @click="del(card)"></AcBtn>
                    </div>
                    <pre class="zg-stagecard__body">{{ card.content }}</pre>
                </div>
            </div>
        </div>
    `,
};
