/**
 * 氧气 · 弹窗中枢
 *
 * composer（发帖 / 编辑）/ essay（随笔）/ confirm / share（分享给 AI）/
 * reroll（AI 帖带意见重 roll）/ geometry（打开几何体 = 琥珀）/ drawer /
 * xiaoting-name / xiaoting-teach / theme-save / theme-rename。
 * 小巧、白底黑字、Q 弹入场。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import * as world from '../services/world-context.js';
import { POST_TYPES, SHAPES } from '../constants.js';

export const OxModals = {
    name: 'OxModals',
    components: { ...UI },
    data() {
        return {
            // composer
            cType: 'short',
            cTags: '',
            cContent: '',
            cWantReplies: true,
            cEditingId: '',
            // essay
            eText: '',
            eMood: '',
            eEditingId: '',
            // 通用输入
            inputText: '',
            // share
            shareAiId: '',
            POST_TYPES,
        };
    },
    computed: {
        s() { return store.getState(); },
        modal() { return this.s.modal; },
        type() { return this.modal?.type || ''; },
        payload() { return this.modal?.payload || {}; },
        worldAis() { return world.listWorldAis(this.s.identity.world); },
        drawerGeos() { return store.drawerGeometries(); },
        activeGeometry() {
            const id = this.payload.geometryId;
            return this.s.geometries.find((g) => String(g.id) === String(id)) || null;
        },
        geoDate() {
            const g = this.activeGeometry;
            if (!g) return '';
            const d = new Date(g.createdAt || 0);
            return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
        },
        commonTags() {
            const bag = new Map();
            for (const p of this.s.posts) {
                for (const t of (p.tags || [])) bag.set(t, (bag.get(t) || 0) + 1);
            }
            return [...bag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
        },
    },
    watch: {
        modal(next) {
            if (!next) return;
            if (next.type === 'composer') this.initComposer();
            if (next.type === 'essay') this.initEssay();
            if (next.type === 'share') this.shareAiId = this.worldAis[0]?.id || '';
            if (next.type === 'reroll' || next.type === 'xiaoting-name'
                || next.type === 'xiaoting-teach' || next.type === 'theme-save') this.inputText = '';
            if (next.type === 'theme-rename') this.inputText = next.payload?.theme?.name || '';
        },
    },
    methods: {
        close() { store.closeModal(); },
        shapeLabel(id) { return (SHAPES.find((x) => x.id === id) || {}).label || id; },

        // ── composer ──────────────────────────────────────
        initComposer() {
            const id = this.payload.postId || '';
            this.cEditingId = id;
            if (id) {
                const post = this.s.posts.find((p) => String(p.id) === String(id));
                if (post) {
                    this.cType = post.type;
                    this.cTags = (post.tags || []).join('、');
                    this.cContent = post.content || '';
                    this.cWantReplies = post.wantReplies !== false;
                    return;
                }
            }
            this.cType = 'short';
            this.cTags = '';
            this.cContent = '';
            this.cWantReplies = true;
        },
        addTagQuick(t) {
            const list = this.cTags.split(/[、,，\s/]+/).filter(Boolean);
            if (list.includes(t)) return;
            list.push(t);
            this.cTags = list.join('、');
        },
        async submitComposer() {
            const tags = this.cTags.split(/[、,，\s/]+/).map((t) => t.trim()).filter(Boolean);
            if (this.cEditingId) {
                await store.updateUserPost(this.cEditingId, {
                    tags, content: this.cContent, type: this.cType,
                });
                this.close();
                return;
            }
            const record = await store.createUserPost({
                type: this.cType,
                tags,
                content: this.cContent,
                wantReplies: this.cWantReplies,
            });
            if (record) this.close();
        },

        // ── essay ─────────────────────────────────────────
        initEssay() {
            const id = this.payload.essayId || '';
            this.eEditingId = id;
            if (id) {
                const essay = this.s.essays.find((e) => String(e.id) === String(id));
                if (essay) {
                    this.eText = essay.text;
                    this.eMood = essay.mood || '';
                    return;
                }
            }
            this.eText = '';
            this.eMood = '';
        },
        async submitEssay() {
            const record = await store.saveEssay({
                id: this.eEditingId || '',
                text: this.eText,
                mood: this.eMood,
            });
            if (record) this.close();
        },

        // ── 其他 ──────────────────────────────────────────
        async submitShare() {
            if (!this.shareAiId) return;
            await store.sharePostToAi(this.payload.postId, this.shareAiId);
            this.close();
        },
        async submitReroll() {
            const opinion = this.inputText.trim();
            if (!opinion) { store.showToast('意见是必填的 —— 说说上一版哪里不对'); return; }
            this.close();
            await store.rerollAiPost(this.payload.postId, opinion);
        },
        async submitName() {
            await store.setXiaotingName(this.inputText);
            this.close();
        },
        async submitTeach() {
            await store.teachXiaoting(this.inputText);
            this.close();
        },
        submitThemeSave() {
            store.saveCustomTheme({
                name: this.inputText,
                baseThemeId: this.payload.baseThemeId,
                colors: this.payload.colors,
            });
            store.showToast('配色已保存');
            this.close();
        },
        submitThemeRename() {
            store.updateCustomTheme(this.payload.theme?.id, { name: this.inputText });
            this.close();
        },
        confirmOk() {
            const fn = this.payload.onOk;
            this.close();
            if (typeof fn === 'function') fn();
        },
        async deleteGeometry() {
            const g = this.activeGeometry;
            this.close();
            if (g) await store.removeGeometry(g.id);
        },
        async deleteDrawerGeo(id) {
            await store.removeGeometry(id);
        },
    },
    template: `
        <div v-if="modal" class="ox-modalmask" @click.self="close">
            <div class="ox-modal" :class="'ox-modal--' + type">

                <!-- 发帖 / 编辑 -->
                <template v-if="type === 'composer'">
                    <p class="ox-modal__title">{{ cEditingId ? '编辑' : '呼吸一次' }}</p>
                    <div class="ox-seg ox-seg--fill">
                        <button
                            v-for="t in POST_TYPES" :key="t.id" type="button"
                            class="ox-seg__item" :class="{ 'is-on': cType === t.id }"
                            @click="cType = t.id"
                        >{{ t.label }}</button>
                    </div>
                    <OxField label="标签（1~5 个，它们是帖子的门面）">
                        <input v-model="cTags" class="ox-input" type="text" placeholder="用顿号或 / 隔开" />
                        <div v-if="commonTags.length" class="ox-ob__chips ox-ob__chips--tight">
                            <button v-for="t in commonTags" :key="t" type="button" class="ox-chip" @click="addTagQuick(t)">{{ t }}</button>
                        </div>
                    </OxField>
                    <OxField label="正文（列表里没人看得到它，点进来的人才配读）">
                        <textarea v-model="cContent" class="ox-textarea" :rows="cType === 'long' ? 8 : 4" maxlength="4000"></textarea>
                    </OxField>
                    <div v-if="!cEditingId" class="ox-switchrow ox-switchrow--tight">
                        <div class="ox-switchrow__main">
                            <p class="ox-switchrow__title">{{ cWantReplies ? '想被回应' : '只是说说' }}</p>
                            <p class="ox-switchrow__desc">{{ cWantReplies ? '其他住民会来评论（你点了才生成）' : '永远不会有评论区，风吹过去就算' }}</p>
                        </div>
                        <button type="button" class="ox-switch" :class="{ 'is-on': cWantReplies }" @click="cWantReplies = !cWantReplies"><i></i></button>
                    </div>
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">算了</OxButton>
                        <OxButton variant="ink" @click="submitComposer">{{ cEditingId ? '保存' : '发出去' }}</OxButton>
                    </div>
                </template>

                <!-- 随笔 -->
                <template v-else-if="type === 'essay'">
                    <p class="ox-modal__title">{{ eEditingId ? '改一改' : '随笔' }}</p>
                    <OxField>
                        <textarea v-model="eText" class="ox-textarea" rows="6" maxlength="4000" placeholder="写给自己的。不发广场、不调 AI。"></textarea>
                    </OxField>
                    <OxField label="心情（可选）">
                        <input v-model="eMood" class="ox-input" type="text" maxlength="8" placeholder="一个词就够" />
                    </OxField>
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">算了</OxButton>
                        <OxButton variant="ink" @click="submitEssay">记下</OxButton>
                    </div>
                </template>

                <!-- 通用确认 -->
                <template v-else-if="type === 'confirm'">
                    <p class="ox-modal__title">{{ payload.title || '确认' }}</p>
                    <p class="ox-modal__message">{{ payload.message || '' }}</p>
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">取消</OxButton>
                        <OxButton :variant="payload.danger ? 'danger' : 'ink'" @click="confirmOk">{{ payload.okLabel || '确定' }}</OxButton>
                    </div>
                </template>

                <!-- 分享给 AI -->
                <template v-else-if="type === 'share'">
                    <p class="ox-modal__title">分享到 murmur</p>
                    <p class="ox-modal__message">卡片里只有标签和一句预感，对方点开才会读到全文。</p>
                    <div class="ox-ailist">
                        <button
                            v-for="a in worldAis" :key="a.id" type="button"
                            class="ox-airow ox-airow--pick" :class="{ 'is-on': shareAiId === a.id }"
                            @click="shareAiId = a.id"
                        >
                            <OxAvatar :name="a.name" :url="a.avatar" :size="30" />
                            <span class="ox-airow__name">{{ a.name }}</span>
                        </button>
                    </div>
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">算了</OxButton>
                        <OxButton variant="ink" :disabled="!shareAiId" @click="submitShare">分享</OxButton>
                    </div>
                </template>

                <!-- AI 帖重 roll（意见必填） -->
                <template v-else-if="type === 'reroll'">
                    <p class="ox-modal__title">让 TA 重写</p>
                    <OxField label="你的意见（必填，会进提示词）">
                        <textarea v-model="inputText" class="ox-textarea" rows="3" maxlength="300" placeholder="上一版哪里不对，这一版要怎么写"></textarea>
                    </OxField>
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">算了</OxButton>
                        <OxButton variant="ink" @click="submitReroll">重写</OxButton>
                    </div>
                </template>

                <!-- 几何体：琥珀 -->
                <template v-else-if="type === 'geometry'">
                    <template v-if="activeGeometry">
                        <p class="ox-modal__title">{{ shapeLabel(activeGeometry.shape) }} · {{ activeGeometry.sizeHint }}</p>
                        <div class="ox-amber">
                            <p class="ox-amber__quote">「{{ activeGeometry.sealedQuote }}」</p>
                            <p class="ox-amber__date">{{ geoDate }} · 你自己说过的话</p>
                        </div>
                        <div class="ox-modal__acts">
                            <OxButton variant="ghost" icon-name="trash" @click="deleteGeometry">化掉它</OxButton>
                            <OxButton variant="ink" @click="close">收好</OxButton>
                        </div>
                    </template>
                </template>

                <!-- 抽屉 -->
                <template v-else-if="type === 'drawer'">
                    <p class="ox-modal__title">抽屉</p>
                    <p class="ox-modal__message">房间放不下的礼物沉在这里，封存的句子都还在。</p>
                    <div class="ox-drawerlist">
                        <div v-for="g in drawerGeos" :key="g.id" class="ox-drawerrow">
                            <span class="ox-drawerrow__shape">{{ shapeLabel(g.shape) }}</span>
                            <span class="ox-drawerrow__quote">「{{ g.sealedQuote }}」</span>
                            <button type="button" class="ox-essay__act" @click="deleteDrawerGeo(g.id)"><OxIcon name="trash" :size="14" /></button>
                        </div>
                        <p v-if="!drawerGeos.length" class="ox-muted">抽屉是空的。</p>
                    </div>
                    <div class="ox-modal__acts">
                        <OxButton variant="ink" @click="close">好</OxButton>
                    </div>
                </template>

                <!-- 取名 -->
                <template v-else-if="type === 'xiaoting-name'">
                    <p class="ox-modal__title">给她取个名字</p>
                    <p class="ox-modal__message">她不知道自己是谁。名字是你给的，她会记一辈子。</p>
                    <input v-model="inputText" class="ox-input" type="text" maxlength="10" placeholder="名字" />
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">再想想</OxButton>
                        <OxButton variant="ink" :disabled="!inputText.trim()" @click="submitName">就叫这个</OxButton>
                    </div>
                </template>

                <!-- 教她说话 -->
                <template v-else-if="type === 'xiaoting-teach'">
                    <p class="ox-modal__title">教她一句</p>
                    <p class="ox-modal__message">教过的说法她会慢慢用（最多记 16 句）。</p>
                    <input v-model="inputText" class="ox-input" type="text" maxlength="20" placeholder="比如：晚安啦" />
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">算了</OxButton>
                        <OxButton variant="ink" :disabled="!inputText.trim()" @click="submitTeach">教她</OxButton>
                    </div>
                </template>

                <!-- 主题保存 / 改名 -->
                <template v-else-if="type === 'theme-save'">
                    <p class="ox-modal__title">存为新配色</p>
                    <input v-model="inputText" class="ox-input" type="text" maxlength="12" placeholder="配色名字" />
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">算了</OxButton>
                        <OxButton variant="ink" :disabled="!inputText.trim()" @click="submitThemeSave">保存</OxButton>
                    </div>
                </template>
                <template v-else-if="type === 'theme-rename'">
                    <p class="ox-modal__title">改名</p>
                    <input v-model="inputText" class="ox-input" type="text" maxlength="12" />
                    <div class="ox-modal__acts">
                        <OxButton variant="ghost" @click="close">算了</OxButton>
                        <OxButton variant="ink" :disabled="!inputText.trim()" @click="submitThemeRename">保存</OxButton>
                    </div>
                </template>

            </div>
        </div>
    `,
};
