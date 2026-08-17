/**
 * App 制作 · 状态单例
 *
 * 一份 `Vue.reactive` 的 state，所有组件读它、通过这里的 mutator 改它。
 * 组件不直接改 answers 的深层字段 —— 那样会漏掉落盘和「预览需要重算」的联动。
 *
 * ── 为什么草稿存 localStorage 而不是 IndexedDB ────────────────────
 * 问卷答案就是一坨几 KB 的 JSON，读写都要求同步（组件 data() 里要立刻拿到
 * 上次填到哪儿）。IndexedDB 是异步的，首屏会闪一下空问卷再跳到有内容。
 * 这个 App 也没有「多份草稿」的需求，一个 key 够了。
 */

import { DRAFT_KEY, PAGE_PRESETS } from './constants.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;

function reactive(obj) {
    return Vue?.reactive ? Vue.reactive(obj) : obj;
}

function uid(prefix = 'p') {
    return `${prefix}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
}

/** 一张页面卡的默认形状。新增页面时按这个建。 */
export function makePage(overrides = {}) {
    return {
        key: uid('pg'),
        name: '',
        desc: '',
        layout: 'column',
        density: 'normal',
        cards: ['info'],
        cardFields: ['title', 'subtitle', 'chevron'],
        hasSearch: false,
        subpages: [],
        emptyText: '',
        ...overrides,
    };
}

function defaultAnswers() {
    return {
        // 基本
        appName: '',
        appId: '',
        appDesc: '',
        tagline: '',
        renderMode: 'vue',

        // 视觉
        style: 'ios-blue',
        // 主色覆盖：空 = 跟随上面那套配色自带的 prim
        accentColor: '',
        radius: 'md',
        elevation: 'sm',
        density: 'normal',

        // 顶栏
        topbarType: 'standard',
        topbarLeft: 'none',
        topbarRight: [],
        // 纯按钮组专用（type = 'buttons-only'）
        topbarButtons: ['add', 'search', 'filter'],
        topbarButtonLabels: true,
        topbarSearchInPage: false,

        // 底栏
        tabbarType: 'default',
        tabbarShowLabels: true,
        fabPosition: 'none',
        fabLabel: '新建',

        // 页面
        pagePreset: 'list-mine',
        pages: PAGE_PRESETS[0].pages.map((p) => makePage(p)),

        // 白膜
        modals: ['confirm', 'toast'],
        islands: ['toast'],
        widgets: [],
        widgetSizes: ['M'],

        // 能力
        capabilities: ['db'],
        systemReads: [],
        crossApp: ['islandKinds'],
        stores: ['items'],

        // 自由描述（喂给提示词，不进代码生成）
        engineerStyle: '',
        extraNotes: '',
    };
}

const state = reactive({
    /** 当前在问卷的第几段 */
    step: 0,
    /** 用户是否展开了右侧实时预览 */
    previewOpen: true,
    /** 预览里正在看哪一页（页面 key） */
    previewPageKey: '',

    answers: defaultAnswers(),

    /** 生成结果 */
    generated: {
        code: '',
        prompt: '',
        at: 0,
    },
    /** 白膜已经装到桌面了吗 */
    installedAppId: '',

    /** AI 助手对话 */
    chat: {
        messages: [],
        input: '',
        sending: false,
        error: '',
    },

    /** 科普抽屉：当前展开的分组 / 词条 */
    learn: {
        groupId: '',
        termId: '',
    },

    _hydrated: false,
});

export function getState() {
    return state;
}

// ---------------------------------------------------------------------------
// 落盘
// ---------------------------------------------------------------------------

let saveTimer = null;

function persistNow() {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            answers: state.answers,
            step: state.step,
            savedAt: Date.now(),
        }));
    } catch (err) {
        console.warn('[app-maker] 草稿落盘失败', err);
    }
}

/** 防抖落盘。输入框每敲一个字都调它，但只有停下来 600ms 才真写。 */
export function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; persistNow(); }, 600);
}

/** 组件卸载 / 页面隐藏时调，把还没写的那次补上 */
export function flushPersist() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    persistNow();
}

export function hydrate() {
    if (state._hydrated) return;
    state._hydrated = true;
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved?.answers && typeof saved.answers === 'object') {
            // 浅合并：新版本加的字段用默认值补齐，老草稿不会因为缺字段而崩
            Object.assign(state.answers, saved.answers);
            // pages 是数组，浅合并会整个替换掉，这里补齐每一项缺的字段
            if (Array.isArray(saved.answers.pages)) {
                state.answers.pages = saved.answers.pages.map((p) => makePage(p));
            }
        }
        if (Number.isInteger(saved?.step)) state.step = saved.step;
    } catch (err) {
        console.warn('[app-maker] 草稿读取失败，用默认值', err);
    }
}

// ---------------------------------------------------------------------------
// mutator
// ---------------------------------------------------------------------------

export function setAnswer(field, value) {
    state.answers[field] = value;
    persist();
}

/** 多选题的开关。传 max 可以限制最多选几个。 */
export function toggleAnswer(field, value, max = 0) {
    const arr = Array.isArray(state.answers[field]) ? state.answers[field] : [];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
        arr.splice(idx, 1);
    } else {
        if (max > 0 && arr.length >= max) arr.shift();
        arr.push(value);
    }
    state.answers[field] = [...arr];
    persist();
}

export function setPageField(pageKey, field, value) {
    const page = state.answers.pages.find((p) => p.key === pageKey);
    if (!page) return;
    page[field] = value;
    persist();
}

export function togglePageArray(pageKey, field, value) {
    const page = state.answers.pages.find((p) => p.key === pageKey);
    if (!page) return;
    const arr = Array.isArray(page[field]) ? page[field] : [];
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
    page[field] = [...arr];
    persist();
}

export function addPage() {
    // 框架的 tab 栏在 5 个以上就开始挤，图标和文字会叠在一起
    if (state.answers.pages.length >= 5) return false;
    state.answers.pages.push(makePage({ name: `页面 ${state.answers.pages.length + 1}` }));
    persist();
    return true;
}

export function removePage(pageKey) {
    if (state.answers.pages.length <= 1) return false;
    const idx = state.answers.pages.findIndex((p) => p.key === pageKey);
    if (idx < 0) return false;
    state.answers.pages.splice(idx, 1);
    if (state.previewPageKey === pageKey) state.previewPageKey = '';
    persist();
    return true;
}

export function movePage(pageKey, delta) {
    const pages = state.answers.pages;
    const idx = pages.findIndex((p) => p.key === pageKey);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= pages.length) return false;
    const [item] = pages.splice(idx, 1);
    pages.splice(next, 0, item);
    persist();
    return true;
}

export function applyPagePreset(presetValue) {
    const preset = PAGE_PRESETS.find((p) => p.value === presetValue);
    state.answers.pagePreset = presetValue;
    if (preset && presetValue !== 'custom') {
        state.answers.pages = preset.pages.map((p) => makePage(p));
        state.previewPageKey = state.answers.pages[0]?.key || '';
    }
    persist();
}

export function setStep(step) {
    state.step = Math.max(0, step);
    persist();
}

export function setGenerated(code, prompt) {
    state.generated.code = code;
    state.generated.prompt = prompt;
    state.generated.at = Date.now();
}

export function setInstalled(appId) {
    state.installedAppId = appId || '';
}

export function resetDraft() {
    state.answers = defaultAnswers();
    state.step = 0;
    state.generated = { code: '', prompt: '', at: 0 };
    state.installedAppId = '';
    state.previewPageKey = '';
    flushPersist();
}

// ---------------------------------------------------------------------------
// AI 助手
// ---------------------------------------------------------------------------

export function pushChatMessage(role, content, extra = {}) {
    state.chat.messages.push({
        id: uid('m'),
        role,
        content,
        at: Date.now(),
        ...extra,
    });
    // 只留最近 40 条：这个对话是一次性的润色工具，不需要长期历史，
    // 而且全量带进上下文会让每次请求越来越贵
    if (state.chat.messages.length > 40) state.chat.messages.splice(0, state.chat.messages.length - 40);
}

export function clearChat() {
    state.chat.messages = [];
    state.chat.error = '';
}
