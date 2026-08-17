/**
 * relax-app / 音色选择器(分组 + 折叠 + 长按收藏)
 *
 * 「音声」面板的捏捏音 / 界面点击音、「捏捏」面板的 per-toy 音色,三处用的是同一套
 * 清单。音色从 9 个涨到 39 个之后再各写一份网格,任何改动都要同步三遍 ——
 * 所以整块抽到这里,三处只传「当前选中的是谁」+ 接选中事件。
 *
 * 排序规则(用户要的「收藏在最上面,自己传的排前面」):
 *   ① 收藏      —— 跨分组聚合,原分组里保留一份并打星标
 *   ② 我的音声  —— 用户上传的,按 createdAt 倒序(最新加的在最前)
 *   ③ 内置分组  —— 顺序见 sound-service 的 SOUND_PRESETS
 *
 * ★ 收藏 / 折叠状态直接读写 store,不走 props
 *   它们既不属于 scene,也不属于某个面板,而是「跨三个选择器共享的一份偏好」。
 *   往上提到 relax-root 再一层层传下来,只会让三个面板各多背四个 props,
 *   而 store 本身就是 Vue.reactive 的,这里读它照样有响应式。
 *
 * ★ 长按 600ms = 收藏,短按 = 试听
 *   长按判定要能被「手指开始滑动」打断,否则在抽屉里滚动列表会误收藏,
 *   所以 pointermove 超过阈值就取消;长按已经触发过的那一次,
 *   随后到达的 click 要吞掉,不然会「收藏完顺带响一声」。
 */

import * as store from '../store.js';
import { listSoundPresets, listSoundGroups, haptic } from '../services/sound-service.js';
import { ICON_STAR, ICON_CHEVRON_DOWN, ICON_CLOSE, ICON_MUSIC, ICON_WAVE } from './icons.js';

/** 长按判定时长。再短容易误触,再长会让人以为没反应。 */
const LONG_PRESS_MS = 600;
/** 按下后手指位移超过这个距离(px)就当作在滚列表,取消长按 */
const MOVE_TOLERANCE = 12;
/** 收藏成功后星标的高亮时长,跟 CSS 动画对齐 */
const FAV_FLASH_MS = 520;

const FAV_GROUP_KEY = '@fav';
const MINE_GROUP_KEY = '@mine';

export const RxSoundPicker = {
    name: 'RxSoundPicker',
    props: {
        /**
         * 折叠状态的存储命名空间。同屏有三个选择器,共用一份折叠状态的话
         * 在一处展开「打击」,另外两处也跟着展开,面板会一下子拉得老长。
         */
        scope: { type: String, required: true },
        customSounds: { type: Array, default: () => [] },
        /** 当前选中的内置音;用了自定义音时传 null */
        presetId: { type: String, default: null },
        /** 当前选中的自定义音 */
        customId: { type: String, default: null },
        /** 是否在自定义音上显示删除按钮(只有「音声」面板的主列表需要) */
        removable: { type: Boolean, default: false },
    },
    emits: ['pick-preset', 'pick-custom', 'remove-custom'],
    data() {
        return {
            presets: listSoundPresets(),
            builtinGroups: listSoundGroups(),
            /** 正在被按住的条目 key —— 驱动缩放 + 进度环 */
            holdKey: null,
            /** 刚被收藏 / 取消收藏的条目 key —— 驱动星标弹一下 */
            flashKey: null,
        };
    },
    computed: {
        favorites() {
            return store.getState().soundPrefs.favorites;
        },
        hasFavorites() {
            return this.items.some(item => item.fav);
        },
        /** 全量条目,顺序 = 自定义音(新→旧)在前,内置音按清单顺序在后 */
        items() {
            const customs = [...this.customSounds]
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                .map(record => ({
                    key: store.soundFavKey('custom', record.id),
                    kind: 'custom',
                    id: record.id,
                    name: record.name,
                    hint: '自己传的',
                    group: MINE_GROUP_KEY,
                    record,
                    active: this.customId === record.id,
                }));

            const presets = this.presets.map(preset => ({
                key: store.soundFavKey('preset', preset.id),
                kind: 'preset',
                id: preset.id,
                name: preset.name,
                hint: preset.hint,
                group: preset.group,
                record: null,
                active: !this.customId && this.presetId === preset.id,
            }));

            return [...customs, ...presets].map(item => ({
                ...item,
                fav: this.favorites.includes(item.key),
            }));
        },
        groups() {
            const list = [];
            const favItems = this.items.filter(item => item.fav);
            if (favItems.length) {
                list.push({ key: FAV_GROUP_KEY, name: '收藏', icon: ICON_STAR, items: favItems });
            }

            const mineItems = this.items.filter(item => item.group === MINE_GROUP_KEY);
            if (mineItems.length) {
                list.push({ key: MINE_GROUP_KEY, name: '我的音声', icon: ICON_MUSIC, items: mineItems });
            }

            for (const name of this.builtinGroups) {
                const items = this.items.filter(item => item.group === name);
                if (items.length) {
                    list.push({ key: name, name, icon: ICON_WAVE, items });
                }
            }

            // 默认只展开收藏 / 我的音声 / 第一个内置组 —— 39 个音全摊开等于没分组
            const firstBuiltin = this.builtinGroups[0];
            return list.map(group => ({
                ...group,
                open: store.isSoundGroupOpen(
                    this.scope,
                    group.key,
                    group.key === FAV_GROUP_KEY
                        || group.key === MINE_GROUP_KEY
                        || group.key === firstBuiltin,
                ),
            }));
        },
    },
    beforeUnmount() {
        this.cancelHold();
        if (this._flashTimer) clearTimeout(this._flashTimer);
    },
    methods: {
        toggleGroup(group) {
            store.setSoundGroupOpen(this.scope, group.key, !group.open);
        },

        // ---------- 长按收藏 ----------
        onHoldStart(item, event) {
            // 鼠标右键 / 中键不参与,留给系统菜单
            if (event.button != null && event.button !== 0) return;
            this.cancelHold();
            this._holdFired = false;
            this._holdX = event.clientX;
            this._holdY = event.clientY;
            this.holdKey = item.key;
            this._holdTimer = setTimeout(() => {
                this._holdTimer = null;
                this._holdFired = true;
                this.holdKey = null;
                this.commitFavorite(item);
            }, LONG_PRESS_MS);
        },
        onHoldMove(event) {
            if (!this._holdTimer) return;
            const dx = event.clientX - this._holdX;
            const dy = event.clientY - this._holdY;
            if (dx * dx + dy * dy > MOVE_TOLERANCE * MOVE_TOLERANCE) this.cancelHold();
        },
        onHoldEnd() {
            this.cancelHold();
        },
        cancelHold() {
            if (this._holdTimer) {
                clearTimeout(this._holdTimer);
                this._holdTimer = null;
            }
            this.holdKey = null;
        },
        commitFavorite(item) {
            store.toggleSoundFavorite(item.key);
            // 长按不试听,所以「收到了」这件事只能靠震动 + 星标动画表达。
            // 震动要认用户在「音声」里的总开关,不然关了震动这里还在抖。
            if (store.getState().scene.sound.haptics) haptic('light');
            this.flashKey = item.key;
            if (this._flashTimer) clearTimeout(this._flashTimer);
            this._flashTimer = setTimeout(() => {
                this._flashTimer = null;
                this.flashKey = null;
            }, FAV_FLASH_MS);
        },

        /** 短按 = 选中 + 试听。长按刚触发过的这一下要吞掉。 */
        onTap(item) {
            if (this._holdFired) {
                this._holdFired = false;
                return;
            }
            if (item.kind === 'custom') this.$emit('pick-custom', item.record);
            else this.$emit('pick-preset', item.id);
        },
    },
    template: `
        <div class="rx-sound-picker">
            <p v-if="!hasFavorites" class="rx-sound-tip">
                ${ICON_STAR}
                <span>长按任意音色收藏,收藏会排到最上面</span>
            </p>

            <section
                v-for="group in groups"
                :key="group.key"
                class="rx-sound-group"
                :class="{ 'is-open': group.open }"
            >
                <button type="button" class="rx-sound-group-head" @click="toggleGroup(group)">
                    <span class="rx-sound-group-icon" aria-hidden="true" v-html="group.icon"></span>
                    <span class="rx-sound-group-title">{{ group.name }}</span>
                    <span class="rx-sound-group-count">{{ group.items.length }}</span>
                    <span class="rx-sound-group-caret" aria-hidden="true">${ICON_CHEVRON_DOWN}</span>
                </button>

                <div v-if="group.open" class="rx-sound-group-body">
                    <div class="rx-sound-grid">
                        <div
                            v-for="item in group.items"
                            :key="group.key + '/' + item.key"
                            class="rx-sound-cell"
                        >
                            <button
                                type="button"
                                class="rx-sound-chip"
                                :class="{
                                    'is-active': item.active,
                                    'is-fav': item.fav,
                                    'is-holding': holdKey === item.key,
                                    'is-flash': flashKey === item.key,
                                }"
                                @pointerdown="onHoldStart(item, $event)"
                                @pointermove="onHoldMove($event)"
                                @pointerup="onHoldEnd"
                                @pointerleave="onHoldEnd"
                                @pointercancel="onHoldEnd"
                                @contextmenu.prevent
                                @click="onTap(item)"
                            >
                                <span class="rx-sound-wave" aria-hidden="true">
                                    <i></i><i></i><i></i><i></i>
                                </span>
                                <span class="rx-sound-name">{{ item.name }}</span>
                                <span class="rx-sound-hint">{{ item.hint }}</span>
                                <span v-if="item.fav" class="rx-sound-fav" aria-hidden="true">${ICON_STAR}</span>
                                <span class="rx-sound-hold" aria-hidden="true"></span>
                            </button>

                            <button
                                v-if="removable && item.kind === 'custom'"
                                type="button"
                                class="rx-sound-cell-del"
                                :aria-label="'删除 ' + item.name"
                                @click.stop="$emit('remove-custom', item.record)"
                            >${ICON_CLOSE}</button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    `,
};
