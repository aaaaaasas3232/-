/**
 * 梦境编织 · 目录抽屉
 *
 * 卷 → 章两级。支持新建 / 改名 / 删除 / 跨卷拖动。
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { isSameId } from '../../utils.js';

export const DwChapterNav = {
    name: 'DwChapterNav',
    components: SHARED_COMPONENTS,
    props: {
        book: { type: Object, required: true },
        chapters: { type: Array, required: true },
        openChapterId: { type: String, default: '' },
    },
    emits: ['open-chapter'],
    data() {
        return {
            collapsed: {},          // volumeId -> true 表示折叠
            dragChapterId: '',
        };
    },
    computed: {
        chapterMap() {
            const map = new Map();
            for (const chapter of this.chapters) map.set(String(chapter.id), chapter);
            return map;
        },
        volumes() {
            return (this.book.volumes || []).map((volume) => ({
                ...volume,
                items: (volume.chapterIds || [])
                    .map((id) => this.chapterMap.get(String(id)))
                    .filter(Boolean),
            }));
        },
        totalChapters() {
            return this.chapters.length;
        },
    },
    methods: {
        isOpen(chapterId) {
            return isSameId(chapterId, this.openChapterId);
        },
        toggleVolume(volumeId) {
            this.collapsed = { ...this.collapsed, [volumeId]: !this.collapsed[volumeId] };
        },
        async onAddChapter(volumeId) {
            const chapter = await store.addChapter({ volumeId });
            if (chapter) this.$emit('open-chapter', chapter.id);
        },
        onAddVolume() {
            store.addVolume();
        },
        onRenameVolume(volume) {
            store.openModal('rename', {
                title: '重命名卷',
                value: volume.name,
                onSubmit: (name) => store.updateVolume(volume.id, { name }),
            });
        },
        onRemoveVolume(volume) {
            if (this.book.volumes.length <= 1) return;
            const count = volume.chapterIds?.length || 0;
            store.openModal('confirm', {
                title: '删除这一卷?',
                message: count
                    ? `卷里的 ${count} 章会移到相邻的卷,不会被删除。`
                    : '这一卷是空的,删掉不影响任何内容。',
                onConfirm: () => store.removeVolume(volume.id),
            });
        },
        onChapterMenu(chapter) {
            store.openSheet('chapter-menu', { chapterId: chapter.id });
        },

        // ── 拖动排序 ──────────────────────────
        onDragStart(chapter, event) {
            this.dragChapterId = String(chapter.id);
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                // Firefox 不设 data 就不触发 drop
                event.dataTransfer.setData('text/plain', String(chapter.id));
            }
        },
        onDrop(volumeId, index) {
            if (!this.dragChapterId) return;
            store.moveChapter(this.dragChapterId, volumeId, index);
            this.dragChapterId = '';
        },
        onDragEnd() {
            this.dragChapterId = '';
        },
    },
    template: `
        <div class="dw-nav">
            <header class="dw-nav-head">
                <div>
                    <h3 class="dw-nav-title">目录</h3>
                    <p class="dw-nav-sub">{{ volumes.length }} 卷 · {{ totalChapters }} 章</p>
                </div>
                <DwButton variant="ghost" size="sm" icon-name="plus" @click="onAddVolume">新卷</DwButton>
            </header>

            <div class="dw-nav-list">
                <section v-for="volume in volumes" :key="volume.id" class="dw-nav-volume">
                    <header class="dw-nav-volume-head">
                        <button
                            type="button"
                            class="dw-nav-volume-toggle"
                            :aria-expanded="String(!collapsed[volume.id])"
                            @click="toggleVolume(volume.id)"
                        >
                            <DwIcon :name="collapsed[volume.id] ? 'chevronRight' : 'chevronDown'" />
                            <span class="dw-nav-volume-name">{{ volume.name }}</span>
                            <span class="dw-nav-volume-count">{{ volume.items.length }}</span>
                        </button>
                        <button type="button" class="dw-nav-icon-btn" aria-label="重命名卷" @click="onRenameVolume(volume)">
                            <DwIcon name="edit" />
                        </button>
                        <button
                            type="button"
                            class="dw-nav-icon-btn"
                            aria-label="删除卷"
                            :disabled="book.volumes.length <= 1"
                            @click="onRemoveVolume(volume)"
                        ><DwIcon name="trash" /></button>
                    </header>

                    <ol v-show="!collapsed[volume.id]" class="dw-nav-chapters">
                        <li
                            v-for="(chapter, index) in volume.items"
                            :key="chapter.id"
                            class="dw-nav-chapter"
                            :class="{ 'is-open': isOpen(chapter.id), 'is-dragging': dragChapterId === String(chapter.id) }"
                            draggable="true"
                            @dragstart="onDragStart(chapter, $event)"
                            @dragend="onDragEnd"
                            @dragover.prevent
                            @drop.prevent="onDrop(volume.id, index)"
                            @click="$emit('open-chapter', chapter.id)"
                        >
                            <span class="dw-nav-chapter-index">{{ index + 1 }}</span>
                            <div class="dw-nav-chapter-main">
                                <p class="dw-nav-chapter-title">{{ chapter.title }}</p>
                                <p class="dw-nav-chapter-sub">
                                    {{ chapter.messages.length }} 段
                                    <template v-if="chapter.useSummary && chapter.summary"> · 有梗概</template>
                                    <template v-if="chapter.isInnerView"> · 内心</template>
                                </p>
                            </div>
                            <button type="button" class="dw-nav-icon-btn" aria-label="章节操作" @click.stop="onChapterMenu(chapter)">
                                <DwIcon name="moreVertical" />
                            </button>
                        </li>

                        <li
                            class="dw-nav-drop-tail"
                            @dragover.prevent
                            @drop.prevent="onDrop(volume.id, volume.items.length)"
                        >
                            <button type="button" class="dw-nav-add" @click="onAddChapter(volume.id)">
                                <DwIcon name="plus" /><span>新增一章</span>
                            </button>
                        </li>
                    </ol>
                </section>
            </div>
        </div>
    `,
};

export default DwChapterNav;
