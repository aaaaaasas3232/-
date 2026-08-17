/**
 * 候鸟 · 弹窗集合
 *
 * 查表式分发。★ `current` 返回**组件对象**而不是名字字符串 ——
 * `components: { 'ticket-confirm': X }` + `:is="'TvTicketConfirm'"` 那种写法
 * Vue 解析不到，弹层全是死的（AGENTS2 §17.3，四叶草和灯塔都栽过）。
 */

import * as store from '../store.js';
import { TvModal } from './modal.js';
import { UI } from './ui.js';
import { fmtMoney, money, safeImageUrl, truncate } from '../utils.js';
import { BG_BLUR_MAX, BG_DATAURL_MAX } from '../constants.js';

const BASE = { TvModal, ...UI };

// ============================================================
// 机票确认
// ============================================================

const TicketConfirm = {
    name: 'TvTicketConfirm',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { busy: false };
    },
    computed: {
        s() { return store.getState(); },
        dest() { return this.payload.dest || {}; },
        price() { return money(this.dest.detail?.ticketPrice); },
        currency() { return this.s.identity.currency; },
        balance() { return money(this.s.balance); },
        after() { return money(this.balance - this.price); },
        enough() { return this.balance >= this.price; },
        priceText() { return fmtMoney(this.price); },
        balanceText() { return fmtMoney(this.balance); },
        afterText() { return fmtMoney(this.after); },
    },
    methods: {
        fmt(n) { return fmtMoney(money(n)); },
        async onConfirm() {
            if (this.busy || !this.enough) return;
            this.busy = true;
            const res = await store.confirmBuyTicket(this.dest);
            this.busy = false;
            if (res.ok) {
                this.$emit('close');
            } else {
                this.$emit('notify', res.error || '购票失败');
            }
        },
    },
    template: `
        <TvModal title="确认出行" subtitle="确认后立刻扣款出票" @close="$emit('close')">
            <div class="tv-buy">
                <div class="tv-buy__row"><span>目的地</span><b>{{ dest.placeName }} · {{ dest.locationName }}</b></div>
                <div class="tv-buy__math">
                    <span class="tv-buy__cell"><i>现在有</i><b>{{ balanceText }}</b></span>
                    <span class="tv-buy__op">-</span>
                    <span class="tv-buy__cell"><i>这张票</i><b class="is-out">{{ priceText }}</b></span>
                    <span class="tv-buy__op">=</span>
                    <span class="tv-buy__cell"><i>付完剩</i><b :class="{ 'is-bad': !enough }">{{ afterText }}</b></span>
                </div>
                <p class="tv-buy__unit">单位：{{ currency }}</p>
                <p v-if="!enough" class="tv-buy__warn">余额不够，还差 {{ fmt(price - balance) }} {{ currency }}。取消不会扣任何钱。</p>
                <p v-else class="tv-buy__note">取消不扣款；确认后这张票可以在出发前退掉，钱会原路退回。</p>
            </div>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!enough || busy" @click="onConfirm">{{ busy ? '出票中' : '确认购票' }}</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 通用确认（删除等）
// ============================================================

const ConfirmModal = {
    name: 'TvConfirm',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { busy: false };
    },
    methods: {
        async onOk() {
            if (this.busy) return;
            this.busy = true;
            try {
                if (typeof this.payload.onOk === 'function') await this.payload.onOk();
            } finally {
                this.busy = false;
                this.$emit('close');
            }
        },
    },
    template: `
        <TvModal :title="payload.title || '确认'" @close="$emit('close')">
            <p class="tv-modal-text">{{ payload.text || '' }}</p>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn" :class="payload.danger ? 'ac-btn-danger' : 'ac-btn-primary'" :disabled="busy" @click="onOk">{{ payload.okLabel || '确定' }}</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 重 roll 意见（必填）
// ============================================================

const OpinionModal = {
    name: 'TvOpinion',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { text: '', busy: false };
    },
    computed: {
        ok() { return this.text.trim().length > 0; },
    },
    methods: {
        async onSubmit() {
            if (!this.ok || this.busy) return;
            this.busy = true;
            const opinion = this.text.trim();
            this.$emit('close');
            if (typeof this.payload.onSubmit === 'function') await this.payload.onSubmit(opinion);
            this.busy = false;
        },
    },
    template: `
        <TvModal :title="payload.title || '这一版哪里不对'" subtitle="意见会进入这次的提示词，必须写点什么" @close="$emit('close')">
            <textarea
                v-model="text"
                class="tv-textarea"
                rows="4"
                :placeholder="payload.placeholder || '比如：节奏太赶了 / 别让她一直道歉 / 多写点路上的风景'"
            ></textarea>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!ok || busy" @click="onSubmit">带着意见重写</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 编辑消息
// ============================================================

const EditMessageModal = {
    name: 'TvEditMessage',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { text: String(this.payload.message?.text || '') };
    },
    computed: {
        ok() { return this.text.trim().length > 0; },
    },
    methods: {
        async onSave() {
            if (!this.ok) return;
            await store.editMessage(this.payload.message?.id, this.text);
            this.$emit('close');
        },
    },
    template: `
        <TvModal title="编辑这一条" wide @close="$emit('close')">
            <textarea v-model="text" class="tv-textarea" rows="6"></textarea>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!ok" @click="onSave">保存</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 消息操作面板（长按弹出）
// ============================================================

const MessageActionsModal = {
    name: 'TvMessageActions',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    computed: {
        s() { return store.getState(); },
        msg() { return this.payload.message || {}; },
        trip() { return store.currentTrip(); },
        ongoing() { return this.trip?.status === 'ongoing'; },
        companions() { return this.trip?.companions || []; },
        canReroll() { return this.msg.role === 'narration' || this.msg.role === 'ai'; },
        preview() { return truncate(this.msg.text, 42); },
        busy() { return !!(this.s.loading.narration || this.s.loading.reply); },
    },
    methods: {
        close() { this.$emit('close'); },
        async replyBy(aiId) {
            if (this.busy) return;
            const msg = { ...this.msg };
            this.close();
            await store.generateAiReply(aiId, msg);
        },
        async narrate() {
            if (this.busy) return;
            this.close();
            await store.continueNarration();
        },
        edit() {
            const msg = this.msg;
            this.close();
            store.openModal('edit-message', { message: msg });
        },
        reroll() {
            const msg = this.msg;
            this.close();
            store.openModal('opinion', {
                title: '重写这一条',
                onSubmit: (opinion) => store.rerollMessage(msg.id, opinion),
            });
        },
        del() {
            const msg = this.msg;
            this.close();
            store.openModal('confirm', {
                title: '删除这一条',
                text: '删掉就找不回来了。',
                danger: true,
                okLabel: '删除',
                onOk: () => store.deleteMessage(msg.id),
            });
        },
    },
    template: `
        <TvModal title="这一条" :subtitle="preview" @close="close">
            <div class="tv-actlist">
                <template v-if="ongoing">
                    <button v-for="c in companions" :key="c.id" type="button" class="tv-actlist__item" :disabled="busy" @click="replyBy(c.id)">
                        <TvAvatar :name="c.name" :url="c.avatar" :bg="c.avatarBg" :size="24" />
                        <span>让 {{ c.name }} 回复</span>
                    </button>
                    <button type="button" class="tv-actlist__item" :disabled="busy" @click="narrate">
                        <TvIcon name="quote" :size="18" /><span>继续旁白</span>
                    </button>
                </template>
                <button type="button" class="tv-actlist__item" @click="edit">
                    <TvIcon name="edit" :size="18" /><span>编辑</span>
                </button>
                <button v-if="canReroll && ongoing" type="button" class="tv-actlist__item" :disabled="busy" @click="reroll">
                    <TvIcon name="reroll" :size="18" /><span>重 roll（要先提意见）</span>
                </button>
                <button type="button" class="tv-actlist__item is-danger" @click="del">
                    <TvIcon name="trash" :size="18" /><span>删除</span>
                </button>
            </div>
        </TvModal>
    `,
};

// ============================================================
// 旅行背景（URL / 本地图 + 模糊度）
// ============================================================

const BackgroundModal = {
    name: 'TvBackground',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        const bg = store.currentTrip()?.background || {};
        return {
            url: String(bg.url || ''),
            blur: Number(bg.blur) || 0,
            blurMax: BG_BLUR_MAX,
        };
    },
    computed: {
        previewUrl() { return safeImageUrl(this.url); },
        previewStyle() {
            if (!this.previewUrl) return {};
            return {
                backgroundImage: `url("${this.previewUrl.replace(/"/g, '%22')}")`,
                filter: `blur(${this.blur}px)`,
            };
        },
    },
    methods: {
        pickFile() {
            this.$refs.file?.click();
        },
        onFile(event) {
            const file = event.target?.files?.[0];
            if (!file) return;
            if (!/^image\//.test(file.type)) {
                this.$emit('notify', '只能选图片文件');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = String(reader.result || '');
                if (dataUrl.length > BG_DATAURL_MAX) {
                    this.$emit('notify', '这张图太大了，换一张 1MB 以内的');
                    return;
                }
                this.url = dataUrl;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        },
        clearBg() {
            this.url = '';
        },
        async onSave() {
            if (this.url && !safeImageUrl(this.url)) {
                this.$emit('notify', '这个地址不像一张图（只支持 http/https 图片链接）');
                return;
            }
            await store.setTripBackground(safeImageUrl(this.url), this.blur);
            this.$emit('close');
        },
    },
    template: `
        <TvModal title="旅行背景" subtitle="放一张旅行图，增加代入感" wide @close="$emit('close')">
            <div class="tv-bgset">
                <div class="tv-bgset__preview">
                    <div v-if="previewUrl" class="tv-bgset__img" :style="previewStyle"></div>
                    <p v-else class="tv-bgset__none">还没有背景</p>
                </div>
                <TvField label="图片链接">
                    <input v-model="url" class="tv-input" type="text" placeholder="https:// 开头的图片地址" />
                </TvField>
                <div class="tv-bgset__row">
                    <TvButton icon-name="image" size="sm" @click="pickFile">上传本地图</TvButton>
                    <TvButton v-if="url" icon-name="x" size="sm" variant="ghost" @click="clearBg">清空</TvButton>
                    <!-- accept 写显式 MIME 而不是「image 斜杠星号」：
                         那个写法会被审计脚本的注释剥离器当成块注释开头，
                         把后面的 MODAL_MAP 和导出整段吃掉，误报成「弹层没分发」 -->
                    <input ref="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" class="tv-hidden-input" @change="onFile" />
                </div>
                <TvField :label="'模糊度 ' + blur + 'px'">
                    <input v-model.number="blur" class="tv-range" type="range" min="0" :max="blurMax" step="1" />
                </TvField>
            </div>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 足迹备注
// ============================================================

const NoteModal = {
    name: 'TvNote',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { text: String(this.payload.trip?.note || '') };
    },
    methods: {
        async onSave() {
            await store.setTripNote(this.payload.trip?.id, this.text);
            this.$emit('close');
        },
    },
    template: `
        <TvModal title="这趟旅行的备注" @close="$emit('close')">
            <textarea v-model="text" class="tv-textarea" rows="4" placeholder="写点只给自己看的话"></textarea>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 注册到 Nook
// ============================================================

const NookModal = {
    name: 'TvNookRegister',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { busy: false, result: null };
    },
    computed: {
        trip() { return this.payload.trip || {}; },
        dest() { return this.trip.destination || {}; },
        already() { return !!this.trip.nook?.locationId; },
        planText() {
            if (this.dest.existingPlaceId) {
                return `「${this.dest.placeName}」在世界里已经登记过，只会在它下面新增场所「${this.dest.locationName}」。`;
            }
            return `会先创建地点「${this.dest.placeName}」，再在它下面登记场所「${this.dest.locationName}」。重复点击不会造出第二份。`;
        },
    },
    methods: {
        async onRegister() {
            if (this.busy) return;
            this.busy = true;
            this.result = await store.registerTripToNook(this.trip.id);
            this.busy = false;
        },
    },
    template: `
        <TvModal title="登记到世界" subtitle="写进 nook 的空间系统" @close="$emit('close')">
            <div v-if="already || result?.ok" class="tv-nookdone">
                <p class="tv-modal-text">已经登记好了。以后在世界空间里能看到它：</p>
                <div class="tv-nookdone__ids">
                    <p>地点 id：<code>{{ trip.nook?.placeId || result?.place?.id }}</code></p>
                    <p>场所 id：<code>{{ trip.nook?.locationId || result?.location?.id }}</code></p>
                </div>
            </div>
            <p v-else class="tv-modal-text">{{ planText }}</p>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">关闭</button>
                <button v-if="!already && !result?.ok" type="button" class="ac-btn ac-btn-primary" :disabled="busy" @click="onRegister">{{ busy ? '登记中' : '确认登记' }}</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 主题：存为新配色 / 改名
// ============================================================

const ThemeSaveModal = {
    name: 'TvThemeSave',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { name: '' };
    },
    methods: {
        onSave() {
            const saved = store.saveCustomTheme({
                name: this.name.trim() || '我的配色',
                baseThemeId: this.payload.baseThemeId,
                colors: this.payload.colors,
            });
            this.$emit('close');
            if (saved) this.$emit('notify', `已存「${saved.name}」`);
        },
    },
    template: `
        <TvModal title="存为新配色" @close="$emit('close')">
            <input v-model="name" class="tv-input" type="text" placeholder="给这套配色起个名字" maxlength="16" />
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </TvModal>
    `,
};

const ThemeRenameModal = {
    name: 'TvThemeRename',
    components: BASE,
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close', 'notify'],
    data() {
        return { name: String(this.payload.theme?.name || '') };
    },
    methods: {
        onSave() {
            const next = this.name.trim();
            if (!next) return;
            store.updateCustomTheme(this.payload.theme?.id, { name: next });
            this.$emit('close');
            this.$emit('notify', '已改名');
        },
    },
    template: `
        <TvModal title="改名" @close="$emit('close')">
            <input v-model="name" class="tv-input" type="text" maxlength="16" />
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!name.trim()" @click="onSave">保存</button>
            </template>
        </TvModal>
    `,
};

// ============================================================
// 分发
// ============================================================

const MODAL_MAP = {
    'ticket-confirm': TicketConfirm,
    'confirm': ConfirmModal,
    'opinion': OpinionModal,
    'edit-message': EditMessageModal,
    'msg-actions': MessageActionsModal,
    'background': BackgroundModal,
    'note': NoteModal,
    'nook-register': NookModal,
    'theme-save': ThemeSaveModal,
    'theme-rename': ThemeRenameModal,
};

export const TvModals = {
    name: 'TvModals',
    emits: ['notify'],
    computed: {
        s() { return store.getState(); },
        /** ★ 返回组件对象。返回名字字符串的话 Vue 解析不到，弹层全是死的。 */
        current() {
            const type = this.s.modal?.type;
            if (!type) return null;
            const comp = MODAL_MAP[type];
            if (!comp) {
                console.warn(`[travel] 没有名为 "${type}" 的弹层`);
                return null;
            }
            return comp;
        },
        payload() { return this.s.modal?.payload || {}; },
    },
    methods: {
        close() { store.closeModal(); },
        notify(text) {
            store.showToast(text);
            this.$emit('notify', text);
        },
    },
    template: `
        <component
            :is="current"
            v-if="current"
            :key="s.modal.type"
            :payload="payload"
            @close="close"
            @notify="notify"
        />
    `,
};
