/**
 * 声浪 · 我的
 *
 * 选手档案（七维 + 人气 + 精力）/ 生涯（荣誉 / 薪资 / 余额）/
 * 功能入口（赛季 / 战队配置 / 身份小号 / 社媒联动 / 锚点 / 大事记 /
 * 阶段卡 / 存档 / 提示词 / 主题 / 结局）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { ATTR_DEFS, startTierSpec } from '../constants.js';
import { fmtMoney, skillScore, asArray } from '../utils.js';

export const EfMePage = {
    name: 'EfMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        save() { return this.s.save; },
        profile() { return this.s.profile; },
        attrs() { return this.save?.attrs || {}; },
        attrDefs() { return ATTR_DEFS.filter((a) => !a.locked); },
        tier() { return startTierSpec(this.save?.startTier); },
        skill() { return skillScore(this.attrs); },
        teamName() { return store.teamNameOf(this.profile?.userTeamId); },
        posLabel() { return store.userPosLabel(); },
        honors() { return asArray(this.save?.honors); },
        seasonRecord() {
            const season = this.save?.season;
            if (!season) return '休赛期';
            const mine = asArray(season.series).filter((sr) => (
                sr.result && (sr.homeId === this.profile.userTeamId || sr.awayId === this.profile.userTeamId)
            ));
            const wins = mine.filter((sr) => sr.result.winnerId === this.profile.userTeamId).length;
            return `${season.name}：${wins}胜${mine.length - wins}负`;
        },
        salaryText() {
            return `月薪 ${fmtMoney(this.profile?.salary?.monthSalary || 0)} · 赢场奖金 ${fmtMoney(this.profile?.salary?.winBonus || 0)}`;
        },
        balanceText() { return `${fmtMoney(this.s.balance)} ${this.s.identity.currency}`; },
        rankSummary() {
            const latest = asArray(this.save?.rankSummaries)[0];
            if (!latest) return '还没有排位记录（去赛点打两把）';
            return `${latest.modeLabel} ${latest.wins}胜${latest.losses}负 · 巅峰分 ${latest.ratingAfter}`;
        },
        menus() {
            return [
                { id: 'season', icon: 'trophy', label: '赛季详情', desc: '积分榜 / 赛程 / 对阵' },
                { id: 'teams', icon: 'users', label: '战队配置', desc: '改名 / 看名册 / 换 AI 角色卡' },
                { id: 'identities', icon: 'ghost', label: '身份与小号', desc: '匿名马甲管理' },
                { id: 'social', icon: 'link', label: '社媒联动', desc: '氧气 / 萤火里的互关与官博' },
                { id: 'anchors', icon: 'calendar', label: '锚点日历', desc: '赛事与节日（可编辑）' },
                { id: 'timeline', icon: 'timeline', label: '生涯大事记', desc: '这一档发生过的事' },
                { id: 'risk', icon: 'alert', label: '风险面板', desc: '每个突发事件的真实概率' },
                { id: 'stagecards', icon: 'save', label: '阶段卡', desc: '跨档保留的人设快照' },
                { id: 'saves', icon: 'hourglass', label: '存档', desc: '开新档 / 读档 / 回收人设改写' },
                { id: 'prompts', icon: 'prompt', label: '提示词透明', desc: '发出去的每一段都在这' },
                { id: 'theme', icon: 'palette', label: '配色', desc: '观众席 / 主场夜 / 自定义' },
            ];
        },
        endingText() { return this.save?.endingText || ''; },
    },
    methods: {
        open(id) { store.setView(id); },
        askEnding() { store.openModal({ type: 'ending-ask' }); },
        openEnding() { store.setView('ending'); },
    },
    template: `
        <div class="ef-page">
            <div class="ef-idcard">
                <EfAvatar :name="profile ? profile.gameId : '?'" :hue="140" :size="52" />
                <div class="ef-idcard__main">
                    <b>{{ profile ? profile.gameId : '' }}</b>
                    <i>{{ teamName }} · {{ posLabel }} · {{ tier.label }}</i>
                    <em>{{ profile && profile.realNameShown ? profile.realNameShown + ' · ' : '' }}{{ profile ? profile.region : '' }}</em>
                </div>
                <div class="ef-idcard__skill">
                    <b>{{ skill }}</b>
                    <i>综合战力</i>
                </div>
            </div>

            <EfSection title="七维属性" :sub="'数值只会因训练、比赛与事件变化'">
                <EfBar v-for="def in attrDefs" :key="def.key"
                    :label="def.key === 'pool' ? '英雄池' : def.label" :value="attrs[def.key] || 0" />
                <EfBar label="人气" :value="attrs.fame || 0" kind="fame" />
                <EfBar label="精力" :value="save ? save.energy : 0" kind="energy" />
            </EfSection>

            <EfSection title="生涯">
                <div class="ef-liferow"><span>本赛季</span><b>{{ seasonRecord }}</b></div>
                <div class="ef-liferow"><span>合同</span><b>{{ salaryText }}</b></div>
                <div class="ef-liferow"><span>余额</span><b>{{ balanceText }}</b></div>
                <div class="ef-liferow"><span>排位</span><b>{{ rankSummary }}</b></div>
                <div class="ef-liferow" v-if="profile && profile.honorsInit"><span>入行前</span><b>{{ profile.honorsInit }}</b></div>
                <div class="ef-honors" v-if="honors.length">
                    <EfTag v-for="h in honors" :key="h.id" tone="warn">{{ h.title }}</EfTag>
                </div>
            </EfSection>

            <EfSection title="功能">
                <button v-for="m in menus" :key="m.id" type="button" class="ef-menurow" @click="open(m.id)">
                    <EfIcon :name="m.icon" :size="17" />
                    <span class="ef-menurow__main"><b>{{ m.label }}</b><i>{{ m.desc }}</i></span>
                    <EfIcon name="chevron" :size="14" />
                </button>
            </EfSection>

            <EfSection title="结局">
                <p class="ef-note">随时可以为这一档写一篇生涯结局，写完还能继续玩。</p>
                <div class="ef-inline">
                    <EfBtn variant="volt" iconName="flag" :loading="s.loading.ending" @click="askEnding">生成结局</EfBtn>
                    <EfBtn v-if="endingText" variant="ghost" @click="openEnding">看已写的结局</EfBtn>
                </div>
            </EfSection>
        </div>
    `,
};
