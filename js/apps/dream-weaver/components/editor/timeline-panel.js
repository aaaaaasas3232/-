/**
 * 梦境编织 · 时间线面板
 *
 * 记录故事内发生过的事,按你排的顺序显示,可以选择性注入 prompt。
 *
 * ── 清理掉的历史包袱 ──────────────────────────────────────────────
 *
 * 原版同时存在 `book.timeline`(旧结构,`{worldTime, characterAges}`)和
 * `book.timelineEvents`(新结构,数组),迁移代码写了一半就停在
 * 「两个都读、只写新的」的中间状态(10177-10183),于是老数据里的
 * `characterAges` 永远没人更新,「角色年龄」功能算出来的永远是初始值。
 *
 * 这里只有 `timelineEvents` 一种结构,`worldTime` 提升成书的顶层字段,
 * 角色年龄由「出生年 + 当前故事时间」**现算**,不再单独存一份会过期的快照。
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { resolveCharacterName } from '../../services/prompt-builder.js';
import { parseStoryTime, findById, truncate } from '../../utils.js';

export const DwTimelinePanel = {
    name: 'DwTimelinePanel',
    components: SHARED_COMPONENTS,
    props: {
        book: { type: Object, required: true },
        chapters: { type: Array, default: () => [] },
    },
    emits: ['notify'],
    computed: {
        events() {
            return this.book.timelineEvents || [];
        },
        injectedCount() {
            return this.events.filter((e) => e.includeInPrompt !== false).length;
        },
        /**
         * 角色年龄:现算,不存快照。
         * 只有「角色填了出生年」且「当前故事时间能解析出年份」时才算得出来。
         */
        ages() {
            const now = parseStoryTime(this.book.worldTime);
            if (!now.sortable || !now.date) return [];
            const year = now.date.getFullYear();
            return (this.book.characters || [])
                .filter((c) => Number.isFinite(c.birthYear) && c.birthYear > 0)
                .map((c) => ({ id: c.id, name: resolveCharacterName(c), age: year - c.birthYear }));
        },
    },
    methods: {
        bindLabel(event) {
            if (event.bindType === 'chapter') {
                const chapter = findById(this.chapters, event.chapterId);
                return chapter ? `绑定:${chapter.title}` : '绑定的章节已删除';
            }
            if (event.bindType === 'message') return '绑定到某一段正文';
            return '';
        },
        onAdd() {
            store.openModal('timeline-event', { bookId: this.book.id, mode: 'create' });
        },
        onEdit(event) {
            store.openModal('timeline-event', { bookId: this.book.id, mode: 'edit', event });
        },
        onRemove(event) {
            store.openModal('confirm', {
                title: '删除这条事件?',
                message: truncate(event.title, 40),
                onConfirm: () => store.removeTimelineEvent(this.book.id, event.id),
            });
        },
        onToggleInject(event) {
            store.updateTimelineEvent(this.book.id, event.id, { includeInPrompt: event.includeInPrompt === false });
        },
        onMove(event, delta) {
            store.moveTimelineEvent(this.book.id, event.id, delta);
        },
        canMove(event, delta) {
            const i = this.events.findIndex((e) => e.id === event.id);
            const j = i + delta;
            return i >= 0 && j >= 0 && j < this.events.length;
        },
        onSetWorldTime() {
            store.openModal('rename', {
                title: '当前故事时间',
                value: this.book.worldTime,
                placeholder: '比如 第三年春 / 2024-03-15',
                onSubmit: (value) => store.updateBook(this.book.id, { worldTime: value }),
            });
        },
    },
    template: `
        <div class="dw-timeline-panel">
            <header class="dw-panel-head">
                <div>
                    <h3 class="dw-panel-title">时间线</h3>
                    <p class="dw-panel-sub">{{ events.length }} 条 · {{ injectedCount }} 条会进上下文</p>
                </div>
                <DwButton variant="ghost" size="sm" icon-name="plus" @click="onAdd">新事件</DwButton>
            </header>

            <DwRow
                label="当前故事时间"
                :value="book.worldTime || '未设置'"
                icon-name="clock"
                chevron
                @click="onSetWorldTime"
            />

            <DwSection v-if="ages.length" title="此刻的角色年龄" subtitle="由出生年和当前故事时间现算" collapsible :default-open="false">
                <div class="dw-age-grid">
                    <div v-for="item in ages" :key="item.id" class="dw-age-item">
                        <span class="dw-age-name">{{ item.name }}</span>
                        <span class="dw-age-value">{{ item.age }} 岁</span>
                    </div>
                </div>
            </DwSection>

            <DwEmpty
                v-if="events.length === 0"
                icon-name="timeline"
                title="还没有事件"
                text="把关键情节记下来,AI 就不会写出前后矛盾的事。"
                action-label="记一条"
                @action="onAdd"
            />

            <ol v-else class="dw-timeline">
                <li
                    v-for="event in events"
                    :key="event.id"
                    class="dw-timeline-item"
                    :class="{ 'is-muted': event.includeInPrompt === false }"
                >
                    <span class="dw-timeline-dot" aria-hidden="true"></span>
                    <div class="dw-timeline-body">
                        <p class="dw-timeline-time">{{ event.time || '时间未定' }}</p>
                        <p class="dw-timeline-title">{{ event.title || '(无标题)' }}</p>
                        <p v-if="event.description" class="dw-timeline-desc">{{ event.description }}</p>
                        <p v-if="bindLabel(event)" class="dw-timeline-bind">{{ bindLabel(event) }}</p>
                    </div>
                    <div class="dw-timeline-actions">
                        <button
                            type="button"
                            class="dw-nav-icon-btn"
                            aria-label="上移"
                            title="上移"
                            :disabled="!canMove(event, -1)"
                            @click="onMove(event, -1)"
                        ><DwIcon name="chevronUp" /></button>
                        <button
                            type="button"
                            class="dw-nav-icon-btn"
                            aria-label="下移"
                            title="下移"
                            :disabled="!canMove(event, 1)"
                            @click="onMove(event, 1)"
                        ><DwIcon name="chevronDown" /></button>
                        <button
                            type="button"
                            class="dw-nav-icon-btn"
                            :class="{ 'is-on': event.includeInPrompt !== false }"
                            :aria-label="event.includeInPrompt !== false ? '不再注入上下文' : '注入上下文'"
                            :title="event.includeInPrompt !== false ? '会进上下文' : '不进上下文'"
                            @click="onToggleInject(event)"
                        ><DwIcon name="layers" /></button>
                        <button type="button" class="dw-nav-icon-btn" aria-label="编辑" @click="onEdit(event)"><DwIcon name="edit" /></button>
                        <button type="button" class="dw-nav-icon-btn" aria-label="删除" @click="onRemove(event)"><DwIcon name="trash" /></button>
                    </div>
                </li>
            </ol>
        </div>
    `,
};

export default DwTimelinePanel;
