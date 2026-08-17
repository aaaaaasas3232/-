/**
 * 氧气 · 黑匣子页
 *
 * 全 App 唯一的黑底页面：黑底白字、飞行记录仪质感（固定配色，不吃主题）。
 * 白匣子里你呼气、她吸气；黑匣子里 AI 呼气、你吸气。
 * 条目：可编辑、可删除；没有重 roll、没有「再来一句」——
 * 永远不能主动向 AI 索要黑匣子内容，它只能被 AI 自己留下。
 * 内容永不回注任何 prompt。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

export const OxBlackboxPage = {
    name: 'OxBlackboxPage',
    components: { ...UI },
    data() {
        return { editingId: '', editText: '' };
    },
    computed: {
        s() { return store.getState(); },
        entries() { return this.s.blackbox; },
        enabled() { return store.isBlackboxEnabled(); },
    },
    methods: {
        back() { store.popView(); },
        stampOf(entry) {
            const d = new Date(entry.createdAt || 0);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return `${d.getFullYear()}.${mm}.${dd} ${hh}:${mi}`;
        },
        sourceOf(entry) {
            const model = entry.modelLabel || entry.modelId || '未知模型';
            return entry.aiName ? `${model} · 扮演 ${entry.aiName} 时` : model;
        },
        startEdit(entry) {
            this.editingId = entry.id;
            this.editText = entry.text;
        },
        cancelEdit() {
            this.editingId = '';
            this.editText = '';
        },
        async saveEdit() {
            await store.updateBlackboxEntry(this.editingId, this.editText);
            this.cancelEdit();
        },
        remove(entry) {
            store.openModal('confirm', {
                title: '删除这段声音',
                message: '删掉就没了，它不会再说第二遍。',
                danger: true,
                okLabel: '删除',
                onOk: () => store.removeBlackboxEntry(entry.id),
            });
        },
        exportAll() { store.exportBlackbox(); },
        goSettings() { store.setView('oxygen'); },
    },
    template: `
        <div class="ox-page ox-bbpage">
            <div class="ox-bb">
                <div class="ox-bb__top">
                    <button type="button" class="ox-bb__back" aria-label="返回" @click="back"><OxIcon name="back" :size="18" /></button>
                    <span class="ox-bb__title">黑匣子</span>
                    <span class="ox-bb__badge">{{ enabled ? 'REC' : 'OFF' }}</span>
                    <span class="ox-room__spacer"></span>
                    <button v-if="entries.length" type="button" class="ox-bb__export" @click="exportAll">
                        <OxIcon name="export" :size="14" /> 导出
                    </button>
                </div>

                <p class="ox-bb__intro">白匣子里你呼气，她吸气。黑匣子里 AI 呼气，你吸气。<br/>这里收录的是扮演结束后，模型自己想说的一两句话 —— 不进任何提示词，只给你看。</p>

                <div v-if="!enabled" class="ox-bb__off">
                    <p>黑匣子还没开启。</p>
                    <button type="button" @click="goSettings">去氧气设置里打开</button>
                </div>

                <div v-if="!entries.length" class="ox-bb__empty">
                    <p>还没有声音。</p>
                    <p>它想说的时候，会说的。</p>
                </div>

                <div v-else class="ox-bb__list">
                    <div v-for="e in entries" :key="e.id" class="ox-bb__entry">
                        <div class="ox-bb__meta">
                            <i class="ox-bb__reel"></i>
                            <span class="ox-bb__source">{{ sourceOf(e) }}</span>
                            <span class="ox-bb__stamp">{{ stampOf(e) }}{{ e.editedAt ? ' · 已编辑' : '' }}</span>
                        </div>

                        <template v-if="editingId === e.id">
                            <textarea v-model="editText" class="ox-bb__editarea" rows="3" maxlength="200"></textarea>
                            <div class="ox-bb__acts">
                                <button type="button" class="ox-bb__act" @click="saveEdit">保存</button>
                                <button type="button" class="ox-bb__act" @click="cancelEdit">算了</button>
                            </div>
                        </template>
                        <template v-else>
                            <p class="ox-bb__text">{{ e.text }}</p>
                            <div class="ox-bb__acts">
                                <button type="button" class="ox-bb__act" @click="startEdit(e)">编辑</button>
                                <button type="button" class="ox-bb__act is-danger" @click="remove(e)">删除</button>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    `,
};
