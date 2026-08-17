/**
 * 梦境编织 · 书架
 *
 * 原版这里有三套并存的 UI:`renderBookshelfTab`(列表)、`renderOpenedBook`(3D 摊开书)、
 * `openBookDetail`(详情叠层)。后两套的入口在某次改版里被旁路了 —— 点书直接进编辑器 ——
 * 但代码留着,占了近千行死代码,还在 `refreshBookshelf` 里被反复引用。
 *
 * 这里只保留真正在用的那一套:网格书架 → 点书进编辑器,长按/更多出菜单。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { formatRelative } from '../utils.js';

const BookCard = {
    name: 'DwBookCard',
    components: SHARED_COMPONENTS,
    props: {
        book: { type: Object, required: true },
    },
    emits: ['open', 'menu'],
    computed: {
        chapterCount() {
            return (this.book.volumes || []).reduce((sum, v) => sum + (v.chapterIds?.length || 0), 0);
        },
        updatedText() {
            return formatRelative(this.book.updatedAt);
        },
    },
    template: `
        <article class="dw-book-card" :data-tone="book.coverTone" @click="$emit('open', book.id)">
            <div class="dw-book-cover">
                <span class="dw-book-spine" aria-hidden="true"></span>
                <h3 class="dw-book-cover-title">{{ book.title }}</h3>
                <p v-if="book.author" class="dw-book-cover-author">{{ book.author }}</p>
            </div>
            <div class="dw-book-meta">
                <p class="dw-book-title">{{ book.title }}</p>
                <p class="dw-book-sub">{{ chapterCount }} 章 · {{ updatedText }}</p>
            </div>
            <button
                type="button"
                class="dw-book-more"
                aria-label="更多操作"
                @click.stop="$emit('menu', book.id)"
            ><DwIcon name="moreHorizontal" /></button>
        </article>
    `,
};

export const DwShelf = {
    name: 'DwShelf',
    components: { ...SHARED_COMPONENTS, BookCard },
    props: {
        app: { type: Object, required: true },
    },
    data() {
        return { keyword: '' };
    },
    computed: {
        allBooks() {
            return store.getState().books;
        },
        books() {
            const kw = this.keyword.trim().toLowerCase();
            if (!kw) return this.allBooks;
            return this.allBooks.filter(
                (b) =>
                    b.title.toLowerCase().includes(kw) ||
                    b.author.toLowerCase().includes(kw) ||
                    b.synopsis.toLowerCase().includes(kw),
            );
        },
        ready() {
            return store.getState().ready;
        },
    },
    methods: {
        onOpen(bookId) {
            this.$emit('open-book', bookId);
        },
        onMenu(bookId) {
            store.openSheet('book-menu', { bookId });
        },
        onCreate() {
            store.openModal('book-edit', { mode: 'create' });
        },
    },
    emits: ['open-book'],
    template: `
        <div class="dw-shelf">
            <header class="dw-shelf-head">
                <div class="dw-shelf-titles">
                    <h1 class="dw-shelf-title">梦境编织</h1>
                    <p class="dw-shelf-sub">{{ books.length }} 本书</p>
                </div>
                <DwButton variant="primary" size="sm" icon-name="plus" @click="onCreate">新建</DwButton>
            </header>

            <div v-if="allBooks.length > 3" class="dw-shelf-search">
                <DwIcon name="search" />
                <input
                    class="dw-shelf-search-input"
                    type="search"
                    placeholder="搜书名 / 作者 / 梗概"
                    :value="keyword"
                    @input="keyword = $event.target.value"
                />
            </div>

            <DwSpinner v-if="!ready" label="正在打开书架…" />

            <DwEmpty
                v-else-if="books.length === 0 && keyword"
                icon-name="search"
                title="没找到"
                :text="'没有匹配「' + keyword + '」的书'"
            />

            <DwEmpty
                v-else-if="books.length === 0"
                icon-name="book"
                title="书架还是空的"
                text="新建一本书,从第一句话开始。"
                action-label="新建一本书"
                @action="onCreate"
            />

            <div v-else class="dw-book-grid">
                <BookCard
                    v-for="book in books"
                    :key="book.id"
                    :book="book"
                    @open="onOpen"
                    @menu="onMenu"
                />
            </div>
        </div>
    `,
};

export default DwShelf;
