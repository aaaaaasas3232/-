/**
 * 小奇怪 · 心事夹 (统一收藏页)
 *
 * 汇集前三个标签页（果冻心、沙漏双面心语、打字机欲言又止）的全部收藏记录。
 * 支持多分类筛选、一键复制、动效跳转回放与管理删除。
 */

import * as store from '../store.js';
import { copyText, formatDate } from '../utils.js';
import { SHARED_COMPONENTS } from './shared.js';

export const OqViewFavorites = {
    name: 'OqViewFavorites',
    components: { ...SHARED_COMPONENTS },
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        return {
            activeFilter: 'all', // all | heart | hourglass | typewriter
            filterTabs: [
                { id: 'all', label: '全部' },
                { id: 'heart', label: '果冻心' },
                { id: 'hourglass', label: '沙漏双面' },
                { id: 'typewriter', label: '欲言又止' },
                { id: 'bottle', label: '漂流瓶' },
            ],
            copiedId: null,
        };
    },
    computed: {
        allList() {
            return store.listFavorites();
        },
        filteredList() {
            if (this.activeFilter === 'all') return this.allList;
            return this.allList.filter((item) => item.kind === this.activeFilter);
        },
    },
    methods: {
        formatDate(ts) {
            return formatDate(ts, 'YYYY-MM-DD HH:mm');
        },

        getKindBadge(kind) {
            switch (kind) {
                case 'heart':
                    return { label: '果冻心', tone: 'heart' };
                case 'hourglass':
                    return { label: '沙漏双面', tone: 'hourglass' };
                case 'typewriter':
                    return { label: '欲言又止', tone: 'typewriter' };
                case 'bottle':
                    return { label: '漂流瓶', tone: 'bottle' };
                default:
                    return { label: '心事', tone: 'default' };
            }
        },

        async onCopy(item) {
            let textToCopy = item.content || item.text || '';
            if (item.kind === 'hourglass' && item.meta?.surface && item.meta?.deep) {
                textToCopy = `【表】${item.meta.surface}\n【里】${item.meta.deep}`;
            }
            const ok = await copyText(textToCopy);
            if (!ok) {
                this.$emit('notify', '复制失败，请手动选择');
                return;
            }
            this.copiedId = item.id;
            if (this._copyTimer) clearTimeout(this._copyTimer);
            this._copyTimer = setTimeout(() => {
                this.copiedId = null;
            }, 1800);
            this.$emit('notify', '已复制心语文本');
        },

        onDelete(id) {
            store.removeFavorite(id);
            this.$emit('notify', '已移出收藏');
        },

        replayTypewriter(item) {
            if (item.meta?.steps) {
                // 将草稿加载到打字机中并切换到该 tab
                store.addHesitation({
                    title: item.title || '收藏的欲言又止',
                    author: item.meta?.personaName || 'AI',
                    steps: item.meta.steps,
                    finalPreview: item.meta?.finalPreview || '',
                });
                store.setTab('watch');
                store.setSubTab('watch', 'typewriter');
                this.$emit('notify', '正在回放该草稿动效');
            }
        },
    },
    template: `
        <div class="oq-fav-root">
            <!-- 分类筛选 Chip 栏 -->
            <div class="oq-fav-filter-bar">
                <button
                    v-for="tab in filterTabs"
                    :key="tab.id"
                    type="button"
                    class="oq-fav-chip"
                    :class="{ 'is-active': activeFilter === tab.id }"
                    @click="activeFilter = tab.id"
                >
                    {{ tab.label }}
                    <span v-if="tab.id === 'all'" class="oq-fav-chip-count">({{ allList.length }})</span>
                </button>
            </div>

            <!-- 收藏列表 -->
            <div v-if="filteredList.length" class="oq-fav-list">
                <div
                    v-for="item in filteredList"
                    :key="item.id"
                    class="oq-fav-card"
                    :data-kind="item.kind"
                >
                    <div class="oq-fav-card-head">
                        <div class="oq-fav-card-info">
                            <span class="oq-fav-tag" :data-tone="getKindBadge(item.kind).tone">
                                {{ getKindBadge(item.kind).label }}
                            </span>
                            <span class="oq-fav-card-title">{{ item.title }}</span>
                        </div>
                        <span class="oq-fav-card-date">{{ formatDate(item.createdAt) }}</span>
                    </div>

                    <!-- 正文展示区域 -->
                    <div class="oq-fav-card-body">
                        <!-- 沙漏双面心语 -->
                        <div v-if="item.kind === 'hourglass' && (item.meta?.surface || item.meta?.deep)" class="oq-fav-dual">
                            <div class="oq-fav-dual-row is-surface">
                                <span class="oq-fav-dual-label">表</span>
                                <span class="oq-fav-dual-text">{{ item.meta.surface }}</span>
                            </div>
                            <div class="oq-fav-dual-row is-deep">
                                <span class="oq-fav-dual-label">里</span>
                                <span class="oq-fav-dual-text">{{ item.meta.deep }}</span>
                            </div>
                        </div>

                        <!-- 果冻心 / 打字机 / 文本 -->
                        <div v-else class="oq-fav-text-box">
                            <p class="oq-fav-main-text">{{ item.content || item.text }}</p>
                        </div>
                    </div>

                    <!-- 操作栏 -->
                    <div class="oq-fav-card-actions">
                        <button
                            v-if="item.kind === 'typewriter' && item.meta?.steps"
                            type="button"
                            class="oq-btn oq-btn--sm oq-btn--ghost"
                            @click="replayTypewriter(item)"
                        >
                            <svg viewBox="0 0 24 24" class="oq-btn-svg" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                            </svg>
                            <span>回放动效</span>
                        </button>

                        <button
                            type="button"
                            class="oq-btn oq-btn--sm oq-btn--ghost"
                            @click="onCopy(item)"
                        >
                            <svg viewBox="0 0 24 24" class="oq-btn-svg" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                            </svg>
                            <span>{{ copiedId === item.id ? '已复制' : '复制' }}</span>
                        </button>

                        <button
                            type="button"
                            class="oq-btn oq-btn--sm oq-btn--quiet"
                            title="移出收藏"
                            @click="onDelete(item.id)"
                        >
                            <span>删除</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 空状态 -->
            <div v-else class="oq-fav-empty">
                <div class="oq-fav-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                    </svg>
                </div>
                <div class="oq-fav-empty-title">心事夹空空的</div>
                <p class="oq-fav-empty-hint">在「果冻心」、「沙漏」或「打字机」中点击收藏，动人瞬间与秘密心语便会收录在这里。</p>
            </div>
        </div>
    `,
};

export default OqViewFavorites;
