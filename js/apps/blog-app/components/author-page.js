/**
 * 氧气 · 作者主页 + 站内闲聊
 *
 * 主页点开才生成（懒生成）。看过主页才能打招呼；
 * 闲聊没有编辑 / 删除 / 重 roll —— 网友说出去的话就是说出去了。
 * 聊得投缘可以「收进 nook」（registerEncounteredCharacter，幂等）。
 *
 * 例外是作者本人（隐藏彩蛋的那个人）：档案是常量、不调 AI，
 * 作品只列已经解锁的彩蛋，也没有打招呼和收进 nook。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCount } from '../utils.js';
import { FRIEND_HINT_AFTER, postTypeLabel } from '../constants.js';

export const OxAuthorPage = {
    name: 'OxAuthorPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        author() { return store.getAuthorById(this.s.activeAuthorId); },
        loading() { return Boolean(this.s.loading.author); },
        friendLoading() { return Boolean(this.s.loading.friend); },
        works() { return this.author?.works || []; },
        followLabel() {
            if (!this.author) return '';
            return `${fmtCount(this.author.followers)} 关注者 · 关注 ${fmtCount(this.author.following)}`;
        },
        isFriend() { return Boolean(this.author?.nookPersonId); },
        /** 作者本人：只能读他留下的东西，没有打招呼，也不收进角色库 */
        isEggAuthor() { return store.isEggAuthorId(this.s.activeAuthorId); },
    },
    methods: {
        back() { store.popView(); },
        typeLabel(t) { return postTypeLabel(t); },
        open(stub) { void store.openPost(stub); },
        chat() { void store.startChat(this.author.authorId); },
        addFriend() { void store.addFriend(this.author.authorId); },
    },
    template: `
        <div class="ox-page ox-authorpage">
            <OxSubtop :title="author ? author.name : '主页'" @back="back" />

            <div v-if="s.error" class="ox-errorbar"><span>{{ s.error }}</span></div>

            <OxLoading v-if="loading" :lines="['翻 TA 的主页', '看 TA 是什么样的人']" />

            <template v-else-if="author && author.profileGenerated">
                <header class="ox-authorhead">
                    <OxAvatar :name="author.name" :slot_="author.slot || 0" :size="52" />
                    <div class="ox-authorhead__main">
                        <p class="ox-authorhead__name">{{ author.name }}</p>
                        <p class="ox-authorhead__follow">{{ followLabel }}</p>
                    </div>
                </header>
                <p v-if="author.bio" class="ox-authorbio">{{ author.bio }}</p>

                <div v-if="!isEggAuthor" class="ox-post__actions">
                    <OxButton size="sm" variant="ink" icon-name="comment" @click="chat">打个招呼</OxButton>
                    <OxButton
                        size="sm" :variant="isFriend ? 'soft' : 'line'" icon-name="users"
                        :loading="friendLoading" :disabled="isFriend"
                        @click="addFriend"
                    >{{ isFriend ? '已在 nook' : '收进 nook' }}</OxButton>
                </div>

                <OxSection title="TA 的帖子" :sub="works.length + ' 条'">
                    <p v-if="!works.length && isEggAuthor" class="ox-muted">你还没读到过他留下的东西。</p>
                    <p v-else-if="!works.length" class="ox-muted">TA 只是路过，没怎么发过东西。</p>
                    <div v-else class="ox-feed-list">
                        <OxStubCard
                            v-for="stub in works" :key="stub.id"
                            :stub="stub"
                            @open="open"
                            @open-author="() => {}"
                        />
                    </div>
                </OxSection>
            </template>

            <OxEmpty v-else icon-name="question" title="主页没打开" desc="回上一页重进一次试试。" />
        </div>
    `,
};

export const OxChatPage = {
    name: 'OxChatPage',
    components: { ...UI },
    data() {
        return { input: '' };
    },
    computed: {
        s() { return store.getState(); },
        peer() { return store.getAuthorById(this.s.chatPeerId); },
        messages() { return this.s.chatMessages; },
        sending() { return this.s.loading.chat; },
        showFriendHint() {
            return this.messages.length >= FRIEND_HINT_AFTER && !this.peer?.nookPersonId;
        },
    },
    methods: {
        back() { store.popView(); },
        async send() {
            const text = this.input.trim();
            if (!text) return;
            this.input = '';
            await store.sendChatMessage(text);
            this.$nextTick(() => {
                const box = this.$refs.list;
                if (box) box.scrollTop = box.scrollHeight;
            });
        },
        addFriend() { void store.addFriend(this.peer.authorId); },
    },
    mounted() {
        this.$nextTick(() => {
            const box = this.$refs.list;
            if (box) box.scrollTop = box.scrollHeight;
        });
    },
    template: `
        <div class="ox-page ox-chatpage">
            <OxSubtop :title="peer ? peer.name : '闲聊'" @back="back" />
            <p class="ox-chat__note">站内闲聊没有重 roll、编辑和删除 —— 说出去的话就是说出去了。</p>

            <div v-if="s.error" class="ox-errorbar"><span>{{ s.error }}</span></div>

            <div ref="list" class="ox-chat__list">
                <p v-if="!messages.length" class="ox-muted ox-chat__empty">从一句「你好」开始。</p>
                <div
                    v-for="m in messages" :key="m.id"
                    class="ox-chat__msg" :class="m.role === 'user' ? 'is-user' : 'is-peer'"
                >
                    <span class="ox-chat__bubble">{{ m.text }}</span>
                </div>
                <p v-if="sending" class="ox-chat__msg is-peer"><span class="ox-chat__bubble is-thinking">……</span></p>
            </div>

            <div v-if="showFriendHint" class="ox-chat__friendhint">
                <span>聊得投缘的话，可以把 TA 收进 nook 角色库</span>
                <OxButton size="sm" variant="ink" @click="addFriend">收进 nook</OxButton>
            </div>

            <div class="ox-chat__inputrow">
                <input
                    v-model="input" class="ox-room__input" type="text" maxlength="200"
                    placeholder="说点什么"
                    @keydown.enter.prevent="send"
                />
                <OxButton size="sm" variant="ink" icon-name="send" :disabled="sending" @click="send"></OxButton>
            </div>
        </div>
    `,
};
