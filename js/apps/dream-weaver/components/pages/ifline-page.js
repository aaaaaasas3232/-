/**
 * 梦境编织 · IF 线工作台（详情页）
 *
 * 原来是盖在编辑器上的一块浮动面板（top:50px; bottom:80px），
 * 高度只有半屏多一点：推演出来的正文要在一个几行高的框里滚，存档折在一个
 * 手风琴里，改一版就多存一条、想删还得先展开存档。
 *
 * 这一版做成整页，分三段：
 *   推演  —— 视角角色 / 人称 / 假设 → 生成，输出**可直接编辑**再存
 *   对话  —— 和某个角色即兴对戏，支持删单条、重生成最后一条
 *   存档  —— 文本档和对话档并列，能搜、能改名、能载入、能删
 *
 * 生成中切段落不会中断（AbortController 挂在 GEN_SCOPE 上，只有退出页面或
 * 用户点停止才 abort），这点和原面板一致。
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { generateIfText, continueIfText, generateIfChatReply } from '../../services/ifline-service.js';
import { createAbort, abort, releaseAbort } from '../../services/ai-service.js';
import { resolveCharacterName } from '../../services/prompt-builder.js';
import { makeId, formatRelative, truncate } from '../../utils.js';

const GEN_SCOPE = '__ifline__';

const POV_OPTIONS = [
    { id: 'first', label: '第一人称' },
    { id: 'second', label: '第二人称' },
    { id: 'third', label: '第三人称' },
];

const SEGMENTS = [
    { id: 'text', label: '推演' },
    { id: 'chat', label: '对话' },
    { id: 'archive', label: '存档' },
];

export const DwIfLinePage = {
    name: 'DwIfLinePage',
    components: SHARED_COMPONENTS,
    props: {
        app: { type: Object, required: true },
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        return {
            seg: 'text',
            // ── 推演 ──
            characterId: 'narrator',
            pov: 'third',
            premise: '',
            output: '',
            outputMeta: null,
            /** 载入存档时记住是哪一条，再存就覆盖它而不是新增 */
            editingArchiveId: '',
            // ── 对话 ──
            chatCharacterId: '',
            chat: null,
            draft: '',
            // ── 存档 ──
            archiveKind: 'text',   // text | chat
            archiveKeyword: '',
            // ── 公共 ──
            busy: false,
        };
    },
    computed: {
        book() {
            const id = this.payload?.bookId || store.getState().openBookId;
            return (store.getState().books || []).find((b) => String(b.id) === String(id)) || null;
        },
        characters() { return this.book?.characters || []; },
        povOptions() { return POV_OPTIONS; },
        segments() { return SEGMENTS; },
        textArchives() { return this.book?.ifLineArchives || []; },
        chatArchives() { return this.book?.ifLineChats || []; },
        filteredArchives() {
            const kw = this.archiveKeyword.trim().toLowerCase();
            const list = this.archiveKind === 'text' ? this.textArchives : this.chatArchives;
            if (!kw) return list;
            return list.filter((a) => {
                const hay = this.archiveKind === 'text'
                    ? `${a.title || ''} ${a.characterName || ''} ${a.premise || ''} ${a.content || ''}`
                    : `${a.title || ''} ${a.characterName || ''} ${(a.messages || []).map((m) => m.content).join(' ')}`;
                return hay.toLowerCase().includes(kw);
            });
        },
        currentCharacter() {
            if (this.characterId === 'narrator') return null;
            return this.characters.find((c) => String(c.id) === String(this.characterId)) || null;
        },
        currentCharacterName() {
            return this.characterId === 'narrator' ? '旁白' : (resolveCharacterName(this.currentCharacter) || '角色');
        },
        chatCharacter() {
            return this.characters.find((c) => String(c.id) === String(this.chatCharacterId)) || null;
        },
        canGenerate() { return !this.busy && Boolean(this.premise.trim()); },
        canSend() { return !this.busy && Boolean(this.draft.trim()) && Boolean(this.chat); },
        outputChars() { return this.output.length; },
    },
    methods: {
        nameOf(c) { return resolveCharacterName(c) || '(未命名)'; },
        povLabel(id) { return POV_OPTIONS.find((p) => p.id === id)?.label || '第三人称'; },
        preview(text) { return truncate(text, 40); },
        relative(ts) { return formatRelative(ts); },
        archiveTitle(a) {
            if (a.title) return a.title;
            if (this.archiveKind === 'text') return `${a.characterName || '旁白'} · ${a.povLabel || ''}`.trim();
            return a.characterName || '对话';
        },

        // ── 推演 ──────────────────────────
        onNewText() {
            this.output = '';
            this.outputMeta = null;
            this.premise = '';
            this.editingArchiveId = '';
            this.seg = 'text';
        },

        async onGenerate() {
            if (!this.canGenerate || !this.book) return;
            this.busy = true;
            this.output = '';
            this.editingArchiveId = '';
            this.outputMeta = { characterName: this.currentCharacterName, povLabel: this.povLabel(this.pov) };
            const signal = createAbort(GEN_SCOPE);
            let result;
            try {
                result = await generateIfText({
                    book: this.book,
                    orderedChapters: store.getOrderedChapters(),
                    chapter: store.getOpenChapter(),
                    library: store.getState().library,
                    characterId: this.characterId,
                    characterName: this.currentCharacterName,
                    pov: this.pov,
                    povLabel: this.povLabel(this.pov),
                    premise: this.premise.trim(),
                    signal,
                    onChunk: (_d, full) => { this.output = full; },
                });
            } catch (err) {
                result = { ok: false, error: err?.message || String(err) };
            } finally {
                releaseAbort(GEN_SCOPE);
                this.busy = false;
            }
            if (!result.ok && !result.aborted) {
                this.$emit('notify', result.error || '生成失败');
                return;
            }
            this.output = result.text || this.output;
        },

        async onContinue() {
            if (this.busy || !this.output || !this.book) return;
            this.busy = true;
            const before = this.output;
            const signal = createAbort(GEN_SCOPE);
            let result;
            try {
                result = await continueIfText({
                    book: this.book,
                    orderedChapters: store.getOrderedChapters(),
                    chapter: store.getOpenChapter(),
                    library: store.getState().library,
                    characterName: this.outputMeta?.characterName || this.currentCharacterName,
                    povLabel: this.outputMeta?.povLabel || this.povLabel(this.pov),
                    current: before,
                    signal,
                    onChunk: (_d, full) => { this.output = `${before}\n\n${full}`; },
                });
            } catch (err) {
                result = { ok: false, error: err?.message || String(err) };
            } finally {
                releaseAbort(GEN_SCOPE);
                this.busy = false;
            }
            if (!result.ok && !result.aborted) {
                this.output = before;
                this.$emit('notify', result.error || '续写失败');
            }
        },

        onSaveText() {
            if (!this.output.trim() || !this.book) return;
            const patch = {
                characterId: this.characterId,
                characterName: this.outputMeta?.characterName || this.currentCharacterName,
                pov: this.pov,
                povLabel: this.outputMeta?.povLabel || this.povLabel(this.pov),
                premise: this.premise.trim(),
                content: this.output,
            };
            if (this.editingArchiveId) {
                store.updateIfArchive(this.book.id, this.editingArchiveId, patch);
                this.$emit('notify', '已更新这条存档');
            } else {
                const saved = store.addIfArchive(this.book.id, patch);
                this.editingArchiveId = saved?.id || '';
                this.$emit('notify', '已存进 IF 线存档');
            }
        },

        onAdoptAsChapter() {
            const text = this.output.trim();
            if (!text) return;
            void (async () => {
                const chapter = await store.addChapter({ title: `IF · ${this.preview(this.premise) || this.currentCharacterName}` });
                if (!chapter) return;
                store.addMessage(chapter.id, { role: 'ai', content: text });
                this.$emit('notify', '已新建一章放进去了');
                this.$emit('close');
            })();
        },

        async onCopyOutput() {
            try {
                await navigator.clipboard.writeText(this.output);
                this.$emit('notify', '已复制');
            } catch (_) { this.$emit('notify', '这个环境不让复制'); }
        },

        // ── 存档 ──────────────────────────
        onLoadArchive(a) {
            if (this.archiveKind === 'text') {
                this.characterId = a.characterId || 'narrator';
                this.pov = a.pov || 'third';
                this.premise = a.premise || '';
                this.output = a.content || '';
                this.outputMeta = { characterName: a.characterName, povLabel: a.povLabel };
                this.editingArchiveId = a.id;
                this.seg = 'text';
            } else {
                this.chat = JSON.parse(JSON.stringify(a));
                this.chatCharacterId = a.characterId;
                this.seg = 'chat';
                this.scrollChatSoon(false);
            }
        },

        onRenameArchive(a) {
            const kind = this.archiveKind;
            store.openModal('rename', {
                title: '给这条存档起个名',
                value: this.archiveTitle(a),
                placeholder: '比如：如果她没回头',
                // ★ DwRenameModal 调的是 onSubmit，不是 onConfirm（写错就是点了保存没反应）
                onSubmit: (name) => {
                    const title = String(name || '').trim();
                    if (!this.book) return;
                    if (kind === 'text') store.updateIfArchive(this.book.id, a.id, { title });
                    else store.updateIfChat(this.book.id, a.id, { title });
                    this.$emit('notify', '已改名');
                },
            });
        },

        onDeleteArchive(a) {
            const kind = this.archiveKind;
            store.openModal('confirm', {
                title: '删掉这条存档？',
                message: this.archiveTitle(a),
                danger: true,
                onConfirm: () => {
                    if (!this.book) return;
                    if (kind === 'text') {
                        store.removeIfArchive(this.book.id, a.id);
                        if (String(this.editingArchiveId) === String(a.id)) this.editingArchiveId = '';
                    } else {
                        store.removeIfChat(this.book.id, a.id);
                        if (this.chat && String(this.chat.id) === String(a.id)) this.chat = null;
                    }
                    this.$emit('notify', '已删除');
                },
            });
        },

        // ── 对话 ──────────────────────────
        onStartChat() {
            const character = this.chatCharacter;
            if (!character) {
                this.$emit('notify', '先选一个聊天对象');
                return;
            }
            this.chat = {
                id: makeId('ifchat'),
                characterId: character.id,
                characterName: this.nameOf(character),
                tone: character.tone || '',
                messages: [],
                createdAt: Date.now(),
            };
            this.draft = '';
        },

        async onSend() {
            if (!this.canSend || !this.book) return;
            const text = this.draft.trim();
            this.draft = '';
            this.chat.messages.push({ role: 'user', content: text });
            this.scrollChatSoon();
            await this.runReply();
        },

        async runReply() {
            this.busy = true;
            const reply = { role: 'ai', content: '' };
            this.chat.messages.push(reply);
            const signal = createAbort(GEN_SCOPE);
            let result;
            try {
                result = await generateIfChatReply({
                    book: this.book,
                    orderedChapters: store.getOrderedChapters(),
                    chapter: store.getOpenChapter(),
                    library: store.getState().library,
                    characterId: this.chat.characterId,
                    characterName: this.chat.characterName,
                    history: this.chat.messages.slice(0, -1),
                    signal,
                    onChunk: (_d, full) => { reply.content = full; this.scrollChatSoon(false); },
                });
            } catch (err) {
                result = { ok: false, error: err?.message || String(err) };
            } finally {
                releaseAbort(GEN_SCOPE);
                this.busy = false;
            }

            if (result.ok || (result.aborted && reply.content)) {
                reply.content = result.text || reply.content;
            } else {
                this.chat.messages.pop();
                if (!result.aborted) this.$emit('notify', result.error || '回复失败');
            }
            this.scrollChatSoon();
        },

        /** 重新生成最后一条 AI 回复：把它删掉再跑一次 */
        async onRerollLast() {
            if (this.busy || !this.chat) return;
            const last = this.chat.messages[this.chat.messages.length - 1];
            if (!last || last.role !== 'ai') {
                this.$emit('notify', '最后一条不是它说的，没得重来');
                return;
            }
            this.chat.messages.pop();
            await this.runReply();
        },

        onDeleteMessage(index) {
            if (this.busy || !this.chat) return;
            this.chat.messages.splice(index, 1);
        },

        onArchiveChat() {
            if (!this.chat || this.chat.messages.length === 0) {
                this.$emit('notify', '还没聊什么');
                return;
            }
            if (!this.book) return;
            store.saveIfChat(this.book.id, this.chat);
            this.$emit('notify', '已封存这段对话');
        },

        onCloseChat() { this.chat = null; },

        scrollChatSoon(smooth = true) {
            this.$nextTick(() => {
                const el = this.$refs.chatScroller;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
            });
        },

        onStop() { abort(GEN_SCOPE); },
        onClose() {
            if (this.busy) abort(GEN_SCOPE);
            this.$emit('close');
        },
    },
    beforeUnmount() {
        if (this.busy) abort(GEN_SCOPE);
    },
    template: `
        <div class="dw-page-full dw-ifline-page">
            <header class="dw-page-topbar">
                <button type="button" class="dw-nav-icon-btn" aria-label="返回" @click="onClose"><DwIcon name="chevronLeft" /></button>
                <div class="dw-page-topbar-title">
                    <h1>IF 线工作台</h1>
                    <p>{{ book ? book.title : '未选书' }} · 存档 {{ textArchives.length }} 文本 / {{ chatArchives.length }} 对话</p>
                </div>
                <span class="dw-page-topbar-spacer"></span>
            </header>

            <div class="dw-ifline-segs">
                <button v-for="s in segments" :key="s.id" type="button"
                        class="dw-ifline-seg" :class="{ 'is-on': seg === s.id }"
                        @click="seg = s.id">{{ s.label }}</button>
            </div>

            <div class="dw-page-body">
                <!-- ── 推演 ─────────────────────────── -->
                <section v-if="seg === 'text'" class="dw-ifline-sec">
                    <DwSection title="推演设置" icon-name="magic">
                        <DwField label="视角角色">
                            <div class="if-char-selector">
                                <button type="button" class="if-char-btn" :class="{ active: characterId === 'narrator' }"
                                        @click="characterId = 'narrator'">旁白</button>
                                <button v-for="c in characters" :key="c.id" type="button" class="if-char-btn"
                                        :class="{ active: characterId === c.id }" :data-tone="c.tone || null"
                                        @click="characterId = c.id">{{ nameOf(c) }}</button>
                            </div>
                        </DwField>
                        <DwField label="人称">
                            <DwSegmented :model-value="pov" :options="povOptions" @update:model-value="pov = $event" />
                        </DwField>
                        <DwField label="假设" hint="写清「如果……会怎样」，越具体推演越准">
                            <DwTextarea v-model="premise" :rows="3" placeholder="如果她那天没有回头…" />
                        </DwField>
                    </DwSection>

                    <div class="dw-ifline-run">
                        <DwButton v-if="!busy" variant="primary" icon-name="magic" label="生成 IF 线内容"
                                  :disabled="!canGenerate" @click="onGenerate" />
                        <DwButton v-else variant="ghost" danger icon-name="stop" label="停止" @click="onStop" />
                        <DwButton variant="ghost" icon-name="plus" label="清空重来" @click="onNewText" />
                    </div>

                    <DwSection v-if="output || busy" title="推演结果" icon-name="note">
                        <p v-if="outputMeta" class="dw-ifline-meta">
                            {{ outputMeta.characterName }} · {{ outputMeta.povLabel }} · {{ outputChars }} 字
                            <span v-if="editingArchiveId"> · 载自存档</span>
                        </p>
                        <!-- 输出直接可编辑：AI 写完常常要改一两句，以前只能复制出去改再贴回来 -->
                        <DwTextarea v-model="output" :rows="14" placeholder="生成的内容会出现在这里，可以直接改" />
                        <div class="dw-ifline-out-acts">
                            <DwButton variant="ghost" icon-name="refresh" label="重新生成" :disabled="busy" @click="onGenerate" />
                            <DwButton variant="ghost" icon-name="plus" label="继续写" :disabled="busy" @click="onContinue" />
                            <DwButton variant="ghost" icon-name="copy" label="复制" @click="onCopyOutput" />
                            <DwButton variant="primary" icon-name="save" :label="editingArchiveId ? '更新存档' : '存档'" @click="onSaveText" />
                            <DwButton variant="ghost" icon-name="book" label="建成新章" @click="onAdoptAsChapter" />
                        </div>
                    </DwSection>
                </section>

                <!-- ── 对话 ─────────────────────────── -->
                <section v-else-if="seg === 'chat'" class="dw-ifline-sec">
                    <template v-if="!chat">
                        <DwSection title="和谁对戏" icon-name="chat">
                            <div class="if-char-selector">
                                <button v-for="c in characters" :key="c.id" type="button" class="if-char-btn"
                                        :class="{ active: chatCharacterId === c.id }" :data-tone="c.tone || null"
                                        @click="chatCharacterId = c.id">{{ nameOf(c) }}</button>
                            </div>
                            <DwEmpty v-if="!characters.length" icon-name="user" title="这本书还没有角色"
                                     text="先在「工具 → 设定 → 角色」里建一个" />
                            <div class="dw-ifline-run">
                                <DwButton variant="primary" icon-name="chat" label="开始聊天"
                                          :disabled="!chatCharacterId" @click="onStartChat" />
                            </div>
                        </DwSection>
                    </template>

                    <div v-else class="if-chat-container dw-ifline-chat">
                        <header class="if-chat-header">
                            <span class="if-chat-avatar" :data-tone="chat.tone || null">{{ chat.characterName.charAt(0) }}</span>
                            <span class="if-chat-name">{{ chat.characterName }}</span>
                            <button type="button" class="if-chip" @click="onRerollLast" :disabled="busy">重来一条</button>
                            <button type="button" class="if-chip" @click="onArchiveChat">封存</button>
                            <button type="button" class="if-chip" @click="onCloseChat">结束</button>
                        </header>

                        <div ref="chatScroller" class="if-chat-messages">
                            <p v-if="chat.messages.length === 0" class="if-empty-state">说点什么开始</p>
                            <div v-for="(msg, i) in chat.messages" :key="i"
                                 class="if-chat-bubble" :class="msg.role === 'user' ? 'user' : 'ai'">
                                {{ msg.content }}<span v-if="busy && i === chat.messages.length - 1 && msg.role === 'ai'" class="dw-msg-caret"></span>
                                <button type="button" class="dw-ifline-msg-del" aria-label="删除这条"
                                        @click="onDeleteMessage(i)">×</button>
                            </div>
                        </div>

                        <div class="if-chat-input">
                            <DwTextarea v-model="draft" :rows="1" placeholder="说点什么…" />
                            <button type="button" class="if-chat-send" :class="{ 'is-stop': busy }"
                                    :disabled="!busy && !canSend" :aria-label="busy ? '停止' : '发送'"
                                    @click="busy ? onStop() : onSend()"><DwIcon :name="busy ? 'stop' : 'send'" /></button>
                        </div>
                    </div>
                </section>

                <!-- ── 存档 ─────────────────────────── -->
                <section v-else class="dw-ifline-sec">
                    <div class="dw-ifline-archive-head">
                        <div class="dw-ifline-segs dw-ifline-segs--sub">
                            <button type="button" class="dw-ifline-seg" :class="{ 'is-on': archiveKind === 'text' }"
                                    @click="archiveKind = 'text'">文本 {{ textArchives.length }}</button>
                            <button type="button" class="dw-ifline-seg" :class="{ 'is-on': archiveKind === 'chat' }"
                                    @click="archiveKind = 'chat'">对话 {{ chatArchives.length }}</button>
                        </div>
                        <DwInput v-model="archiveKeyword" placeholder="搜索存档" />
                    </div>

                    <DwEmpty v-if="!filteredArchives.length" icon-name="folder"
                             :title="archiveKeyword ? '没搜到' : '还没有存档'"
                             :text="archiveKeyword ? '换个词试试' : '在「推演」里生成一段，点存档就会出现在这里'" />

                    <ul v-else class="dw-ifline-archives">
                        <li v-for="a in filteredArchives" :key="a.id" class="dw-ifline-archive">
                            <button type="button" class="dw-ifline-archive-main" @click="onLoadArchive(a)">
                                <span class="dw-ifline-archive-title">{{ archiveTitle(a) }}</span>
                                <span class="dw-ifline-archive-sub">
                                    {{ archiveKind === 'text'
                                        ? preview(a.premise || a.content)
                                        : (a.messages.length + ' 条 · ' + preview(a.messages.length ? a.messages[a.messages.length - 1].content : '')) }}
                                </span>
                                <span class="dw-ifline-archive-time">{{ relative(a.updatedAt || a.createdAt) }}</span>
                            </button>
                            <div class="dw-ifline-archive-acts">
                                <button type="button" class="dw-nav-icon-btn" aria-label="改名" @click.stop="onRenameArchive(a)"><DwIcon name="pen" /></button>
                                <button type="button" class="dw-nav-icon-btn" aria-label="删除" @click.stop="onDeleteArchive(a)"><DwIcon name="trash" /></button>
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    `,
};

export default DwIfLinePage;
