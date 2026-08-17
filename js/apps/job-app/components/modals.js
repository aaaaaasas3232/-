/**
 * 灯塔 · 弹层
 *
 * 全部套 `JbSheet`（从底部升起、点遮罩关、没有叉）。
 * 这条规矩收在组件里而不是「每处都记得传参数」—— 靠纪律维持的一致性
 * 迟早会漏一个，而漏掉的那个通常只是「多了个叉」这种没人会专门报的小瑕疵。
 *
 * 一个 `<jb-modals>` 挂在根组件里，按 `state.modal.type` 查表分发。
 * 查表式是最不容易出错的写法：漏了一个 key，`MODAL_MAP[type]` 直接是
 * undefined，下面那条 warn 会说出来。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { PAY_MODES, SHIFT_MODES, JOB_CATEGORIES } from '../constants.js';

/* ── 自己加一份工作 ───────────────────────────────────────────── */

const AddPost = {
    name: 'JbAddPost',
    components: { ...UI },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close'],
    data() {
        return {
            title: '', company: '', category: '', place: '', duty: '', note: '',
            payMode: 'monthly', payAmount: '', shiftMode: 'weekly',
            busy: false,
        };
    },
    computed: {
        currency() { return store.getState().identity.currency; },
        payModes() { return PAY_MODES; },
        shiftModes() { return SHIFT_MODES; },
        categories() { return JOB_CATEGORIES.filter((c) => c !== '全部'); },
        ok() { return this.title.trim().length > 0; },
        amountLabel() { return this.payMode === 'monthly' ? '一个月多少' : '一天最多多少'; },
    },
    methods: {
        async submit() {
            if (!this.ok || this.busy) return;
            this.busy = true;
            try {
                await store.addManualPost({
                    title: this.title, company: this.company, category: this.category,
                    place: this.place, duty: this.duty, note: this.note,
                    payMode: this.payMode, payAmount: Number(this.payAmount) || 0,
                    shiftMode: this.shiftMode,
                });
                this.$emit('close');
            } finally {
                this.busy = false;
            }
        },
    },
    template: `
        <jb-sheet
            title="自己加一份工作"
            desc="不用经过面试。适合把现实里已经有的活搬进来。"
            size="lg" @close="$emit('close')"
        >
            <jb-field label="职位名">
                <jb-input v-model="title" placeholder="比如：夜班守灯人" :maxlength="20" />
            </jb-field>
            <jb-field label="单位">
                <jb-input v-model="company" placeholder="谁雇的你" :maxlength="20" />
            </jb-field>
            <jb-field label="分类">
                <div class="jb-chips">
                    <jb-chip
                        v-for="c in categories" :key="c"
                        :active="category === c" @click="category = c"
                    >{{ c }}</jb-chip>
                </div>
            </jb-field>
            <jb-field label="地点">
                <jb-input v-model="place" placeholder="在哪一带" :maxlength="20" />
            </jb-field>
            <jb-field label="日常在做什么" hint="这句会进小剧场提示词，写具体点">
                <jb-textarea v-model="duty" :rows="3" placeholder="比如：入夜点灯，天亮熄灯，中间记录海面的动静" />
            </jb-field>

            <jb-field label="怎么给钱">
                <div class="jb-seg">
                    <button
                        v-for="m in payModes" :key="m.id"
                        class="jb-seg__btn" :class="{ 'is-on': payMode === m.id }"
                        @click="payMode = m.id"
                    >{{ m.label }}</button>
                </div>
            </jb-field>
            <jb-field :label="amountLabel" :hint="'单位：' + currency + '。之后还能在工作详情里改'">
                <jb-input v-model="payAmount" type="number" placeholder="0" />
            </jb-field>

            <jb-field label="什么时候上班">
                <div class="jb-seg">
                    <button
                        v-for="m in shiftModes" :key="m.id"
                        class="jb-seg__btn" :class="{ 'is-on': shiftMode === m.id }"
                        @click="shiftMode = m.id"
                    >{{ m.label }}</button>
                </div>
            </jb-field>

            <jb-field label="备注（可以不写）">
                <jb-textarea v-model="note" :rows="2" />
            </jb-field>

            <template #footer>
                <jb-btn variant="ghost" @click="$emit('close')">算了</jb-btn>
                <jb-btn variant="primary" block :disabled="!ok" :loading="busy" @click="submit">
                    加进去
                </jb-btn>
            </template>
        </jb-sheet>
    `,
};

/* ── 分发 ─────────────────────────────────────────────────────── */

const MODAL_MAP = {
    'add-post': AddPost,
};

export const JbModals = {
    name: 'JbModals',
    computed: {
        modal() { return store.getState().modal; },
        /**
         * ★ 返回**组件对象**，不是组件名。
         *
         * 第一版写的是 `components: MODAL_MAP` + `:is="MODAL_MAP[type].name"`，
         * 这两句合起来是坏的：注册进去的 key 是 `'add-post'`（业务含义的名字），
         * 而 Vue 解析 `:is="'JbAddPost'"` 时只会去试
         * `registry['JbAddPost']` / camelize / capitalize 三种拼法，
         * 全都对不上 `'add-post'` —— 结果是**点了「自己加一份工作」什么都不出现**，
         * 控制台只有一条容易被淹掉的 resolve 警告。浏览器冒烟抓到的就是这个。
         *
         * 直接给对象就绕开了整类「名字对不上」的问题，也不用再维护一份注册表。
         */
        current() {
            const type = this.modal?.type;
            if (!type) return null;
            const comp = MODAL_MAP[type];
            if (!comp) {
                // 分发表里没有 = 有人 openModal 了一个不存在的 type。
                // 静默返回的话表现是「点了没反应」，只能靠这条 warn 发现
                console.warn(`[job] 没有名为 "${type}" 的弹层`);
                return null;
            }
            return comp;
        },
    },
    methods: {
        close() { store.closeModal(); },
    },
    template: `
        <component
            v-if="current"
            :is="current"
            :payload="modal.payload"
            @close="close"
        />
    `,
};
