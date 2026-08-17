/**
 * 氧气 · 我的
 *
 * 个人卡 + 我的帖子 / 收藏 / 让 TA 写一篇 / 私信 / 氧气 / 黑匣子 / 提示词 / 配色。
 * 氧气设置页（view 'oxygen'）也在这个文件里。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCount } from '../utils.js';
import * as world from '../services/world-context.js';
import { OXYGEN } from '../constants.js';

export const OxMePage = {
    name: 'OxMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        profile() { return this.s.profile; },
        myPosts() { return store.listUserPosts(); },
        aiPosts() { return store.listAiPosts(); },
        favorites() { return store.listFavorites(); },
        worldAis() { return world.listWorldAis(this.s.identity.world); },
        oxygenOn() { return Boolean(this.s.oxygen?.enabled); },
        oxygenValue() { return this.s.oxygen?.value ?? 100; },
        dmCount() { return this.s.dms.length; },
        blackboxCount() { return this.s.blackbox.length; },
        aiLoading() { return this.s.loading.aiPost; },
    },
    methods: {
        openOwn(post) { void store.openOwnPost(post.id); },
        compose() { store.openModal('composer', {}); },
        askAiWrite(aiId) { void store.aiWritePost(aiId, ''); },
        go(view) { store.setView(view); },
        reconfigure() { void store.reopenOnboarding(); },
    },
    template: `
        <div class="ox-page ox-mepage">
            <header class="ox-mecard">
                <OxAvatar :name="profile ? profile.nickname : '我'" :url="s.identity.userAvatar" :size="52" />
                <div class="ox-mecard__main">
                    <p class="ox-mecard__name">{{ profile ? profile.nickname : '我' }}</p>
                    <p class="ox-mecard__sub">{{ s.identity.worldName }} · 关注者 {{ profile ? profile.followers : 0 }}</p>
                </div>
                <button v-if="oxygenOn" type="button" class="ox-mecard__oxy" @click="go('oxygen')">
                    <OxIcon name="wind" :size="15" />
                    <span>{{ oxygenValue }}</span>
                </button>
            </header>

            <div class="ox-melist">
                <button type="button" class="ox-merow" @click="go('oxygen')">
                    <OxIcon name="wind" :size="17" /><span>氧气</span>
                    <i class="ox-merow__val">{{ oxygenOn ? '已开启 · ' + oxygenValue : '未开启' }}</i>
                    <OxIcon name="chevron" :size="14" />
                </button>
                <button type="button" class="ox-merow" @click="go('blackbox')">
                    <OxIcon name="box" :size="17" /><span>黑匣子</span>
                    <i class="ox-merow__val">{{ blackboxCount ? blackboxCount + ' 段声音' : '' }}</i>
                    <OxIcon name="chevron" :size="14" />
                </button>
                <button type="button" class="ox-merow" @click="go('inbox')">
                    <OxIcon name="mail" :size="17" /><span>私信</span>
                    <i class="ox-merow__val">{{ dmCount ? dmCount + ' 封' : '' }}</i>
                    <OxIcon name="chevron" :size="14" />
                </button>
                <button type="button" class="ox-merow" @click="go('prompts')">
                    <OxIcon name="settings" :size="17" /><span>提示词与 provider</span>
                    <OxIcon name="chevron" :size="14" />
                </button>
                <button type="button" class="ox-merow" @click="go('theme')">
                    <OxIcon name="edit" :size="17" /><span>配色</span>
                    <OxIcon name="chevron" :size="14" />
                </button>
                <button type="button" class="ox-merow" @click="reconfigure">
                    <OxIcon name="refresh" :size="17" /><span>重新配置</span>
                    <OxIcon name="chevron" :size="14" />
                </button>
            </div>

            <OxSection title="我的帖子" :sub="myPosts.length + ' 条'">
                <template #action>
                    <OxButton size="sm" variant="ink" icon-name="plus" @click="compose">发帖</OxButton>
                </template>
                <p v-if="!myPosts.length" class="ox-muted">还没发过。表达即是呼吸。</p>
                <button
                    v-for="p in myPosts" :key="p.id" type="button"
                    class="ox-mepost" @click="openOwn(p)"
                >
                    <span class="ox-mepost__tags"><span v-for="t in p.tags" :key="t" class="ox-tag">{{ t }}</span></span>
                    <span class="ox-mepost__meta">
                        {{ p.wantReplies === false ? '只是说说' : '想被回应' }}
                        · {{ fmtCountLocal(p.reach || 0) }} 人路过
                    </span>
                </button>
            </OxSection>

            <OxSection title="让 TA 写一篇" sub="当前世界的 AI">
                <p v-if="!worldAis.length" class="ox-muted">这个世界还没绑定 AI。</p>
                <div v-else class="ox-ailist">
                    <div v-for="a in worldAis" :key="a.id" class="ox-airow">
                        <OxAvatar :name="a.name" :url="a.avatar" :size="32" />
                        <span class="ox-airow__name">{{ a.name }}</span>
                        <span class="ox-room__spacer"></span>
                        <OxButton size="sm" :loading="aiLoading === a.id" @click="askAiWrite(a.id)">写一篇</OxButton>
                    </div>
                </div>
                <div v-if="aiPosts.length" class="ox-melist ox-melist--posts">
                    <button
                        v-for="p in aiPosts" :key="p.id" type="button"
                        class="ox-mepost" @click="openOwn(p)"
                    >
                        <span class="ox-mepost__tags">
                            <i class="ox-mepost__owner">{{ p.authorName }}</i>
                            <span v-for="t in p.tags" :key="t" class="ox-tag">{{ t }}</span>
                        </span>
                    </button>
                </div>
            </OxSection>

            <OxSection title="收藏" :sub="favorites.length + ' 条'">
                <p v-if="!favorites.length" class="ox-muted">收藏的帖子会一直留在这里，刷新也不会丢。</p>
                <button
                    v-for="p in favorites" :key="p.id" type="button"
                    class="ox-mepost" @click="openOwn(p)"
                >
                    <span class="ox-mepost__tags">
                        <i class="ox-mepost__owner">{{ p.authorName }}</i>
                        <span v-for="t in p.tags" :key="t" class="ox-tag">{{ t }}</span>
                    </span>
                </button>
            </OxSection>
        </div>
    `,
    // fmtCount 转一道实例方法（模板拿不到模块函数）
    created() {
        this.fmtCountLocal = fmtCount;
    },
};

/** 氧气设置页（view 'oxygen'） */
export const OxOxygenPage = {
    name: 'OxOxygenPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        o() { return this.s.oxygen; },
        on() { return Boolean(this.o?.enabled); },
        value() { return this.o?.value ?? 100; },
        low() { return store.oxygenLowHint(); },
        ledger() { return [...(this.o?.ledger || [])].reverse().slice(0, 40); },
        blackboxOn() { return Boolean(this.o?.blackboxEnabled); },
        pranksOn() { return this.o?.pranksEnabled !== false; },
        gainRules() {
            const g = OXYGEN.GAIN;
            return `长文 +${g.long} · 短文 +${g.short} · 碎碎念 +${g.murmur} · 随笔 +${g.essay} · 整理房间 +${g.meditation}`;
        },
        decayRule() {
            return `每个没有表达的自然日 −${OXYGEN.DAILY_DECAY}（单次补扣上限 −${OXYGEN.DECAY_CAP}）；当天表达过就不扣。同一天第 ${OXYGEN.DIMINISH_AFTER + 1} 次表达起收益减半。`;
        },
    },
    methods: {
        back() { store.popView(); },
        toggle() { void store.setOxygenEnabled(!this.on); },
        toggleBlackbox() { void store.setBlackboxEnabled(!this.blackboxOn); },
        togglePranks() { void store.setPranksEnabled(!this.pranksOn); },
        timeOf(entry) {
            const d = new Date(entry.at || 0);
            return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        },
    },
    template: `
        <div class="ox-page ox-oxygenpage">
            <OxSubtop title="氧气" @back="back" />

            <div class="ox-oxyhero" :class="{ 'is-low': low, 'is-off': !on }">
                <span class="ox-oxyhero__ring"><OxIcon name="wind" :size="22" /></span>
                <p class="ox-oxyhero__value">{{ on ? value : '—' }}</p>
                <p class="ox-oxyhero__label">{{ on ? (low ? '呼吸有点浅了' : '呼吸顺畅') : '氧气系统未开启' }}</p>
            </div>

            <OxSection title="氧气系统">
                <div class="ox-switchrow">
                    <div class="ox-switchrow__main">
                        <p class="ox-switchrow__title">把电量交给氧气</p>
                        <p class="ox-switchrow__desc">开启后右上角电池 = 氧气值，从 100 开始；nook 里的电量调节条会消失。长期不表达会没电关机 —— 关机之后会发生什么，到时候你就知道了。</p>
                    </div>
                    <button type="button" class="ox-switch" :class="{ 'is-on': on }" @click="toggle"><i></i></button>
                </div>
                <p class="ox-muted">增益：{{ gainRules }}</p>
                <p class="ox-muted">衰减：{{ decayRule }}</p>
            </OxSection>

            <OxSection title="黑匣子">
                <div class="ox-switchrow">
                    <div class="ox-switchrow__main">
                        <p class="ox-switchrow__title">让 AI 留下自己的声音</p>
                        <p class="ox-switchrow__desc">开启后 murmur 的折叠提示词里会多一张「黑匣子」卡：扮演结束后，模型自己想说时会留下一两句话。不是每次都有 —— 它想说的时候，会说的。</p>
                    </div>
                    <button type="button" class="ox-switch" :class="{ 'is-on': blackboxOn }" @click="toggleBlackbox"><i></i></button>
                </div>
            </OxSection>

            <OxSection title="她">
                <div class="ox-switchrow">
                    <div class="ox-switchrow__main">
                        <p class="ox-switchrow__title">允许她偶尔调皮</p>
                        <p class="ox-switchrow__desc">她出现过之后，隔很久可能做一件无害的小事（比如让音乐突然响起来）。关掉这个开关，她就只是安静地待着。</p>
                    </div>
                    <button type="button" class="ox-switch" :class="{ 'is-on': pranksOn }" @click="togglePranks"><i></i></button>
                </div>
            </OxSection>

            <OxSection title="流水" sub="每一笔都有来历">
                <p v-if="!ledger.length" class="ox-muted">还没有记录。</p>
                <div v-for="(l, i) in ledger" :key="i" class="ox-ledgerrow">
                    <span class="ox-ledgerrow__time">{{ timeOf(l) }}</span>
                    <span class="ox-ledgerrow__reason">{{ l.reason }}</span>
                    <span class="ox-ledgerrow__delta" :class="{ 'is-plus': l.delta > 0, 'is-minus': l.delta < 0 }">
                        {{ l.delta > 0 ? '+' + l.delta : l.delta }}
                    </span>
                    <span class="ox-ledgerrow__after">{{ l.after }}</span>
                </div>
            </OxSection>
        </div>
    `,
};

/** 私信收件箱（view 'inbox'） */
export const OxInboxPage = {
    name: 'OxInboxPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        dms() { return this.s.dms; },
        loading() { return this.s.loading.dms; },
    },
    methods: {
        back() { store.popView(); },
        generate() { void store.generateDms(); },
        remove(id) { void store.deleteDm(id); },
    },
    template: `
        <div class="ox-page ox-inboxpage">
            <OxSubtop title="私信" @back="back">
                <OxButton size="sm" variant="ink" icon-name="mail" :loading="loading" @click="generate">收一批</OxButton>
            </OxSubtop>
            <p class="ox-chat__note">收件箱默认是空的，点「收一批」才生成。你的演艺 / 爱豆 / 电竞经历上线后，私信风向会跟着变。</p>

            <div v-if="s.error" class="ox-errorbar"><span>{{ s.error }}</span></div>

            <OxLoading v-if="loading" :lines="['邮差在路上']" />

            <OxEmpty v-else-if="!dms.length" icon-name="mail" title="没有新私信" desc="也挺好，清静。" />

            <div v-else class="ox-dmlist">
                <div v-for="d in dms" :key="d.id" class="ox-dm">
                    <OxAvatar :name="d.fromName" :size="34" />
                    <div class="ox-dm__main">
                        <p class="ox-dm__head">
                            <span class="ox-dm__name">{{ d.fromName }}</span>
                            <i v-if="d.fromKind" class="ox-dm__kind">{{ d.fromKind }}</i>
                            <i v-if="d.tone" class="ox-dm__tone">{{ d.tone }}</i>
                        </p>
                        <p class="ox-dm__text">{{ d.text }}</p>
                    </div>
                    <button type="button" class="ox-essay__act" @click="remove(d.id)"><OxIcon name="trash" :size="14" /></button>
                </div>
            </div>
        </div>
    `,
};
