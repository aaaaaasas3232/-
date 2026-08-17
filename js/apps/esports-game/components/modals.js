/**
 * 赛点 · 弹窗集合
 *
 * 到点跨日提示 / 绑情侣标 / 分享（场次 / 单局 / 他人战绩）到 murmur。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { DEFAULT_COUPLE_TAG } from '../constants.js';

export const EgModals = {
    name: 'EgModals',
    components: { ...UI },
    data() {
        return {
            tagName: '',
            shareTargetId: '',
            shareNote: '',
        };
    },
    computed: {
        s() { return store.getState(); },
        modal() { return this.s.modal; },
        ais() { return store.companionOptions().filter((c) => c.type === 'ai'); },
        defaultTag() { return DEFAULT_COUPLE_TAG; },
        openForumAction() {
            return JSON.stringify({ action: 'openApp', targetAppId: 'esports-forum' });
        },
    },
    methods: {
        close() { store.closeModal(); },
        async confirmBind() {
            const result = await store.bindCouple(this.modal.targetId, this.tagName || this.defaultTag);
            if (!result.ok && result.error) store.showToast(result.error);
            else {
                this.tagName = '';
                store.closeModal();
            }
        },
        pickedAi() {
            return this.ais.find((c) => c.id === this.shareTargetId) || this.ais[0] || null;
        },
        async confirmShare() {
            const target = this.pickedAi();
            if (!target) {
                store.showToast('这个世界还没有绑定的 AI');
                return;
            }
            let ok = false;
            if (this.modal.type === 'share-session') {
                ok = await store.shareSession(target, this.modal.session, this.shareNote);
            } else if (this.modal.type === 'share-match') {
                ok = await store.shareMatch(target, this.modal.match, this.modal.modeLabel, this.shareNote);
            } else if (this.modal.type === 'share-record') {
                ok = await store.shareRecord(target, this.modal.record, this.shareNote);
            }
            if (ok) {
                this.shareNote = '';
                store.closeModal();
            }
        },
    },
    template: `
        <div>
            <!-- 24:00 -->
            <EgModalShell v-if="modal && modal.type === 'midnight'" title="打到 24:00 了" @close="close">
                <p class="eg-prose">今天到头了。跨不跨日是生涯层面的决定 —— 去声浪按「进入下一天」，精力会恢复，赛程与事件照走。</p>
                <template #actions>
                    <EgBtn variant="ghost" @click="close">再待会儿</EgBtn>
                    <button type="button" class="eg-btn eg-btn--blue" :data-app-action="openForumAction" @click="close">去声浪跨日</button>
                </template>
            </EgModalShell>

            <!-- 绑情侣标 -->
            <EgModalShell v-else-if="modal && modal.type === 'bind-couple'" :title="'与 ' + modal.name + ' 绑情侣标'" @close="close">
                <p class="eg-prose">情侣标会公开显示在双方的游戏主页上，赛区的人都看得到；murmur 里的 TA 也会知道这件事。</p>
                <EgField label="标的名字">
                    <input class="eg-input" v-model.trim="tagName" :placeholder="defaultTag" maxlength="10" />
                </EgField>
                <template #actions>
                    <EgBtn variant="ghost" @click="close">再想想</EgBtn>
                    <EgBtn variant="blue" iconName="heartRing" @click="confirmBind">戴上</EgBtn>
                </template>
            </EgModalShell>

            <!-- 分享到 murmur -->
            <EgModalShell v-else-if="modal && (modal.type === 'share-session' || modal.type === 'share-match' || modal.type === 'share-record')"
                title="分享到 murmur" @close="close">
                <p class="eg-prose" v-if="modal.type === 'share-record'">把别人的战绩发给 AI，可以一起八卦，也可以制造一点危机感。</p>
                <p class="eg-prose" v-else>发给谁？TA 会在聊天里收到这份战绩，可以问 TA「这把怎么回事」。</p>
                <EgField label="发给">
                    <select class="eg-input" v-model="shareTargetId">
                        <option v-for="c in ais" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                </EgField>
                <EgField label="附一句话（可空）">
                    <input class="eg-input" v-model.trim="shareNote" maxlength="40" placeholder="如：怎么会打出这样？ / 有危机感了吗" />
                </EgField>
                <EgEmpty v-if="!ais.length" iconName="users" title="这个世界还没有绑定的 AI" />
                <template #actions>
                    <EgBtn variant="ghost" @click="close">取消</EgBtn>
                    <EgBtn variant="blue" iconName="share" :disabled="!ais.length" @click="confirmShare">发送</EgBtn>
                </template>
            </EgModalShell>
        </div>
    `,
};
