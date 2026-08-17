/**
 * 追光 · 圈子页（30 位 NPC）与 NPC 聊天覆盖页
 *
 * 名册跨档共享、启用状态每档独立；AI 可拉进来当 NPC；
 * 聊得投缘可以注册进 nook 角色库（幂等）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { listWorldAis } from '../services/world-context.js';
import { npcPersonaText } from '../services/npc-engine.js';

export const AcCirclePage = {
    name: 'AcCirclePage',
    components: { ...UI },
    data() {
        return { showAiPicker: false, worldAis: [], filter: 'all' };
    },
    computed: {
        s() { return store.getState(); },
        npcs() {
            const all = store.visibleNpcs();
            if (this.filter === 'active') return all.filter((n) => n.active);
            if (this.filter === 'ai') return all.filter((n) => n.fromAi);
            return all;
        },
        activeCount() { return store.visibleNpcs().filter((n) => n.active).length; },
        hiddenLeft() {
            const save = this.s.save;
            const roster = this.s.profile?.npcRoster || [];
            return roster.filter((n) => n.hidden && !(save?.revealedNpcIds || []).includes(n.id)).length;
        },
    },
    methods: {
        openNpc(npc) { store.openNpcChat(npc.id); },
        toggle(npc) { store.toggleNpcActive(npc.id); },
        openAiPicker() {
            this.worldAis = listWorldAis();
            this.showAiPicker = true;
        },
        async pickAi(ai) {
            await store.addAiAsNpc(ai.id);
            this.showAiPicker = false;
        },
    },
    template: `
        <div class="zg-page">
            <AcSection title="圈子" :sub="'启用 ' + activeCount + ' 人' + (hiddenLeft ? ' · 还有 ' + hiddenLeft + ' 位没揭开' : '')">
                <template #action>
                    <AcBtn size="sm" variant="soft" iconName="plus" @click="openAiPicker">拉 AI 进圈</AcBtn>
                </template>
                <div class="zg-seg">
                    <button v-for="f in [['all','全部'],['active','已启用'],['ai','世界角色']]" :key="f[0]"
                        type="button" class="zg-seg__item" :class="{ 'is-on': filter === f[0] }"
                        @click="filter = f[0]">{{ f[1] }}</button>
                </div>
                <div v-for="npc in npcs" :key="npc.id" class="zg-npcrow" :class="{ 'is-off': !npc.active }">
                    <AcAvatar :name="npc.name" :hue="npc.hue" :size="42" />
                    <div class="zg-npcrow__main" @click="openNpc(npc)">
                        <b>{{ npc.name }}
                            <AcTag v-if="npc.fromAi" tone="info">世界角色</AcTag>
                            <AcTag v-else-if="npc.hidden" tone="violet">隐藏</AcTag>
                        </b>
                        <p>{{ npc.occupation }}（{{ npc.status }}）{{ npc.mbti ? ' · ' + npc.mbti : '' }}</p>
                        <p class="zg-npcrow__attitude">{{ npc.attitude }}{{ npc.chatted ? ' · 聊过' : '' }}</p>
                    </div>
                    <button type="button" class="zg-switch" :class="{ 'is-on': npc.active }"
                        @click="toggle(npc)" :title="npc.active ? '停用' : '启用'"><i></i></button>
                </div>
            </AcSection>

            <AcModalShell v-if="showAiPicker" title="把世界角色拉进圈子" @close="showAiPicker = false">
                <AcEmpty v-if="!worldAis.length" iconName="users" title="这个世界还没有绑定的 AI"
                    desc="去 nook 给这个世界绑几个 AI 人设" />
                <div v-else class="zg-booklist">
                    <button v-for="ai in worldAis" :key="ai.id" type="button" class="zg-bookrow" @click="pickAi(ai)">
                        <b>{{ ai.name }}</b>
                        <span>{{ ai.role || ai.personality || 'AI' }}</span>
                    </button>
                </div>
                <p class="zg-note">拉进来后 TA 会以自己的人设出现在这个档里。TA 的人设卡以后变了，会问你要不要覆盖快照、存阶段卡、还是先不动。</p>
            </AcModalShell>
        </div>
    `,
};

export const AcNpcPage = {
    name: 'AcNpcPage',
    components: { ...UI },
    data() {
        return { draft: '', showPersona: false };
    },
    computed: {
        s() { return store.getState(); },
        npc() {
            const id = this.s.npcChat.npcId;
            const roster = [...(this.s.profile?.npcRoster || []), ...(this.s.save?.npcExtra || [])];
            const save = this.s.save;
            const found = roster.find((n) => n.id === id);
            if (!found) return null;
            return { ...found, active: (save?.npcActiveIds || []).includes(id) };
        },
        messages() { return this.s.npcChat.messages; },
        personaText() {
            return this.npc?.fromAi && this.npc.personaSnapshot
                ? this.npc.personaSnapshot
                : npcPersonaText(this.npc || {}, { withAgenda: false });
        },
    },
    methods: {
        close() { store.setView(''); },
        async send() {
            const text = this.draft;
            this.draft = '';
            await store.sendNpcChat(text);
            this.$nextTick(() => {
                const box = this.$refs.scroll;
                if (box) box.scrollTop = box.scrollHeight;
            });
        },
        register() { store.registerNpcToNook(this.npc.id); },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <template v-if="npc">
                    <AcAvatar :name="npc.name" :hue="npc.hue" :size="30" />
                    <b>{{ npc.name }}</b>
                    <span class="zg-overlay__sub">{{ npc.occupation }}</span>
                    <span class="zg-section__spacer"></span>
                    <AcBtn size="sm" variant="soft" iconName="heart"
                        :loading="s.loading.register === npc.id" @click="register">加入角色库</AcBtn>
                </template>
            </header>
            <div v-if="npc" class="zg-overlay__body zg-npcchat" ref="scroll">
                <button type="button" class="zg-linklike" @click="showPersona = !showPersona">
                    {{ showPersona ? '收起人设' : '看看这个人' }}
                </button>
                <pre v-if="showPersona" class="zg-personacard">{{ personaText }}</pre>
                <AcEmpty v-if="!messages.length" iconName="users" title="还没说过话"
                    desc="打个招呼吧。这些对话每档独立保存" />
                <div v-for="m in messages" :key="m.id"
                    class="zg-chatmsg" :class="m.role === 'user' ? 'is-user' : 'is-npc'">
                    <p>{{ m.text }}</p>
                </div>
                <p v-if="s.loading.npcReply" class="zg-note">对方正在输入……</p>
            </div>
            <footer v-if="npc" class="zg-chatinput">
                <input class="zg-input" v-model.trim="draft" maxlength="200"
                    :placeholder="'对 ' + npc.name + ' 说……'"
                    @keydown.enter="send" />
                <AcBtn variant="ink" :disabled="!draft || s.loading.npcReply" @click="send">说</AcBtn>
            </footer>
        </div>
    `,
};
