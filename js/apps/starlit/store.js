/**
 * 点灯 · 状态单例
 *
 * 一份 Vue.reactive，所有组件读它、只通过这里的 mutator 改它。
 * 生成任务只往 store 写、不碰 DOM —— 用户切出去组件卸载了，写照样继续。
 *
 * ── 档案切换 ──────────────────────────────────────────────────────
 * `hydrate()` 每次现算档案键，和上次不一样就整份换掉。
 * 不依赖任何「用户切换了」的事件（挂事件等于挂运气）。
 *
 * ── AI 调用边界（很重要）──────────────────────────────────────────
 * 没有任何定时器会调 AI。每一次请求都由用户的一次点击触发：
 *   建主题 → 出问卷；交问卷 → 出侧写；点规划 → 出课程表；
 *   点开课 → 老师开口；每说一句 → 一次；点下课 → 结课那一次；
 *   反转课堂同理。整理推理墙、播弹幕、改卡片一律不调 API。
 */

import {
    CARD_SIZE, LESSON_STATUS, MODES, WALL_ZOOM,
} from './constants.js';
import {
    asArray, clamp, dictLine, hash01, sameId, tidyText, truncate, uid,
} from './utils.js';
import * as dbx from './services/db.js';
import * as world from './services/world-context.js';
import * as ai from './services/ai-service.js';
import * as prompts from './services/prompt-builder.js';
import * as parser from './services/skill-parser.js';
import * as library from './services/card-library.js';
import * as layout from './services/graph-layout.js';
import * as srs from './services/srs.js';
import * as ticker from './services/ticker.js';
import { splitBubbles, alignGloss } from './services/bubble-split.js';
import * as translator from './services/translate-service.js';
import { registerStarlitPrompts, syncTopicPrompts, unregisterTopicPrompt } from './services/app-prompts.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const state = reactive({
    ready: false,
    blocked: '',

    identity: {
        userName: '我', userAvatar: '', userAvatarBg: '',
        worldName: '', hasWorld: false,
        profileKey: '', userId: '', ready: false,
    },
    profile: null,

    /** topics | lessons | wall | dict | me */
    tab: 'topics',
    /**
     * 覆盖页：'' | 'topic-new' | 'survey' | 'plan' | 'lesson'
     *        | 'flip' | 'wall' | 'card' | 'theme' | 'ticker' | 'review'
     */
    view: '',

    topics: [],
    activeTopicId: '',

    lessons: [],
    activeLessonId: '',

    /** 当前打开的会话消息（lesson 或 flip） */
    messages: [],
    scene: 'lesson',

    cards: [],
    links: [],
    dict: [],
    stuck: [],

    /** 推理墙 */
    wall: {
        x: 0, y: 0, zoom: 1,
        selectedId: '',
        /** 正在从哪张卡拉线 */
        linkingFrom: '',
        /** 摊开的卡片堆 */
        spreadStackId: '',
        spreadIndex: 0,
        /** 分块聚焦 */
        regions: [],
        focusRegionId: '',
        showGrid: true,
        /** 全屏（在手机壳里的全屏） */
        full: false,
        /** 上次整理用了多久，给用户一个感知 */
        lastTidyMs: 0,
    },

    /** 打开的卡片详情 */
    activeCardId: '',

    /** 新建主题的临时表单 */
    draft: {
        title: '', mode: MODES.language, target: '', targetNative: '',
        teacherSource: 'model', teacherAiId: '',
    },

    /** 问卷临时态 */
    survey: { questions: [], index: 0, goal: '' },

    /** 输入框 */
    composer: '',

    loading: {
        survey: false, profile: false, plan: false,
        reply: false, summary: false, flip: false, flipEnd: false,
        expand: '', enrich: false, tidy: false,
    },
    error: '',
    toast: '',

    /**
     * 长按翻译出来的悬浮层。
     * null = 没开着。开着时整屏只有一个 —— 连按两处会替换，不会叠起来。
     * { text, source, kind, loading, error, x, y }  x/y 是百分比
     */
    translation: null,

    /** { type, payload } */
    modal: null,

    _app: null,
    _hydrating: false,
    _seq: 0,
});

export function getState() {
    return state;
}

// ---------------------------------------------------------------------------
// 便捷读取
// ---------------------------------------------------------------------------

export function activeTopic() {
    return state.topics.find((t) => sameId(t.id, state.activeTopicId)) || null;
}

export function activeLesson() {
    return state.lessons.find((l) => sameId(l.id, state.activeLessonId)) || null;
}

export function activeCard() {
    return state.cards.find((c) => sameId(c.id, state.activeCardId)) || null;
}

export function cardById(id) {
    return state.cards.find((c) => sameId(c.id, id)) || null;
}

export function lessonCards(lessonId) {
    const id = String(lessonId || '');
    return state.cards.filter((c) => (
        sameId(c.lessonId, id) || asArray(c.usedInLessons).some((x) => sameId(x, id))
    ));
}

export function showToast(text) {
    state.toast = String(text || '');
    if (!state.toast) return;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { state.toast = ''; }, 2600);
}

export function setError(text) {
    state.error = String(text || '');
    if (state.error) showToast(state.error);
}

export function setTab(id) {
    state.tab = id;
    state.view = '';
}

export function setView(id) {
    state.view = id || '';
}

export function openModal(type, payload = {}) {
    state.modal = { type, payload };
}

export function closeModal() {
    state.modal = null;
}

function nextSeq() {
    state._seq += 1;
    return state._seq;
}

// ---------------------------------------------------------------------------
// 落盘
// ---------------------------------------------------------------------------

let profileTimer = null;

function persistProfile() {
    if (profileTimer) clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
        profileTimer = null;
        if (state.profile) dbx.saveProfile(state._app, state.profile);
    }, 400);
}

export function flushPersist() {
    if (profileTimer) { clearTimeout(profileTimer); profileTimer = null; }
    const jobs = [];
    if (state.profile) jobs.push(dbx.saveProfile(state._app, state.profile));
    if (pendingCards.size) jobs.push(flushCards());
    return Promise.all(jobs);
}

/**
 * 卡片坐标改动攒批落盘。
 * 拖一张卡会连着触发几十次 move，一次一写会把 IndexedDB 打爆、掉帧。
 */
const pendingCards = new Set();
let cardTimer = null;

function persistCard(card) {
    if (!card?.id) return;
    pendingCards.add(String(card.id));
    if (cardTimer) return;
    cardTimer = setTimeout(flushCards, 520);
}

async function flushCards() {
    if (cardTimer) { clearTimeout(cardTimer); cardTimer = null; }
    if (pendingCards.size === 0) return;
    const ids = [...pendingCards];
    pendingCards.clear();
    const rows = ids.map((id) => cardById(id)).filter(Boolean);
    if (rows.length) await dbx.saveCards(state._app, rows);
}

function persistTopic(topic) {
    const t = topic || activeTopic();
    if (t) dbx.saveTopic(state._app, t);
}

function persistLesson(lesson) {
    if (lesson) dbx.saveLesson(state._app, lesson);
}

// ---------------------------------------------------------------------------
// 启动 / 切档
// ---------------------------------------------------------------------------

/**
 * 只用 `_hydrating` 防并发，不用 `_hydrated` 硬阻断 ——
 * 硬阻断会让首次失败后永远没有第二次机会。
 */
export async function hydrate(app) {
    if (app) state._app = app;
    if (state._hydrating) return;
    state._hydrating = true;

    try {
        const block = world.describeBlock();
        state.blocked = block;
        if (block) { state.ready = true; return; }

        const identity = world.readIdentity();
        const key = identity.profileKey;
        if (!key) { state.blocked = '还没有默认用户卡'; state.ready = true; return; }

        const switched = state.identity.profileKey && state.identity.profileKey !== key;
        Object.assign(state.identity, {
            userName: identity.userName,
            userAvatar: identity.userAvatar,
            userAvatarBg: identity.userAvatarBg,
            worldName: identity.worldName,
            hasWorld: identity.hasWorld,
            profileKey: key,
            userId: identity.userId,
            ready: true,
        });

        if (switched) {
            // 换档：把上一档的东西全清掉，别让两档串味
            state.topics = [];
            state.lessons = [];
            state.messages = [];
            state.cards = [];
            state.links = [];
            state.dict = [];
            state.stuck = [];
            state.activeTopicId = '';
            state.activeLessonId = '';
            state.view = '';
        }

        state.profile = (await dbx.loadProfile(state._app, key)) || dbx.makeProfile(key);
        state.topics = await dbx.listTopics(state._app, key);
        state.dict = await dbx.listDict(state._app, key);

        if (state.activeTopicId && !activeTopic()) state.activeTopicId = '';
        if (!state.activeTopicId && state.topics.length) state.activeTopicId = state.topics[0].id;
        if (state.activeTopicId) await loadTopicData(state.activeTopicId);

        applyProfileTheme();
        syncMurmurPrompts();
        syncTicker();
        state.ready = true;
    } catch (err) {
        console.error('[starlit] hydrate 失败', err);
        state.blocked = '读取数据时出错了，退出重进一次看看';
        state.ready = true;
    } finally {
        state._hydrating = false;
    }
}

export function recheckIdentity() {
    const key = world.getProfileKey();
    if (key && key !== state.identity.profileKey) {
        state.ready = false;
        hydrate(state._app);
    }
}

/** 换主题时把它名下的四张表读进来 */
async function loadTopicData(topicId) {
    const id = String(topicId || '');
    if (!id) return;
    const [lessons, cards, links, stuck] = await Promise.all([
        dbx.listLessons(state._app, id),
        dbx.listCards(state._app, id),
        dbx.listLinks(state._app, id),
        dbx.listStuck(state._app, id),
    ]);
    state.lessons = lessons;
    state.cards = cards;
    state.links = links;
    state.stuck = stuck;
    const topic = activeTopic();
    if (topic?.wall) {
        state.wall.x = Number(topic.wall.x) || 0;
        state.wall.y = Number(topic.wall.y) || 0;
        state.wall.zoom = clamp(Number(topic.wall.zoom) || 1, WALL_ZOOM.min, WALL_ZOOM.max);
    }
    recomputeRegions();
}

export async function selectTopic(topicId) {
    if (sameId(topicId, state.activeTopicId)) return;
    await flushCards();
    state.activeTopicId = String(topicId || '');
    state.activeLessonId = '';
    state.messages = [];
    state.wall.selectedId = '';
    state.wall.linkingFrom = '';
    state.wall.spreadStackId = '';
    state.wall.focusRegionId = '';
    await loadTopicData(state.activeTopicId);
}

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------

export function resetDraft() {
    state.draft = {
        title: '',
        mode: MODES.language,
        target: '',
        targetNative: '',
        teacherSource: state.profile?.teacherSource || 'model',
        teacherAiId: state.profile?.teacherAiId || '',
        // 语言模式的浸没维度，建主题时就能选（之后在「我的」里也能改）
        immersion: 'gradual',
    };
}

export function listTeacherCandidates() {
    return world.listTeacherCandidates();
}

/** 建主题 → 立刻出问卷（第一次安排课程之前先摸底） */
export async function createTopic() {
    const d = state.draft;
    const title = String(d.title || '').trim();
    if (!title) { setError('给这个主题起个名字'); return null; }
    if (!state.identity.profileKey) { setError('还没有默认用户卡'); return null; }

    const teacherSource = d.teacherSource === 'persona' && d.teacherAiId ? 'persona' : 'model';
    const teacher = teacherSource === 'persona' ? world.getTeacher(d.teacherAiId) : null;

    const topic = dbx.makeTopic(state.identity.profileKey, {
        title,
        mode: d.mode,
        target: String(d.target || '').trim(),
        targetNative: String(d.targetNative || '').trim(),
        teacherSource,
        teacherAiId: teacherSource === 'persona' ? d.teacherAiId : '',
        teacherName: teacher?.name || '',
        surveyStage: 'none',
        immersion: d.immersion === 'full' ? 'full' : 'gradual',
    });

    await dbx.saveTopic(state._app, topic);
    state.topics.unshift(topic);
    state.activeTopicId = topic.id;
    state.lessons = [];
    state.cards = [];
    state.links = [];
    state.stuck = [];

    // 记住这次选的老师来源，下次建主题默认沿用
    if (state.profile) {
        state.profile.teacherSource = teacherSource;
        state.profile.teacherAiId = topic.teacherAiId;
        persistProfile();
    }

    state.view = 'survey';
    await generateSurvey();
    return topic;
}

export async function renameTopic(topicId, title) {
    const topic = state.topics.find((t) => sameId(t.id, topicId));
    if (!topic) return;
    topic.title = String(title || '').trim() || topic.title;
    await dbx.saveTopic(state._app, topic);
    syncMurmurPrompts();
}

export async function deleteTopic(topicId) {
    const idx = state.topics.findIndex((t) => sameId(t.id, topicId));
    if (idx === -1) return;
    const [removed] = state.topics.splice(idx, 1);
    await dbx.purgeTopic(state._app, removed.id);
    unregisterTopicPrompt(state._app?.toolkit, removed.id);
    state.dict = state.dict.filter((d) => !sameId(d.topicId, removed.id));
    if (sameId(state.activeTopicId, removed.id)) {
        state.activeTopicId = state.topics[0]?.id || '';
        state.lessons = [];
        state.cards = [];
        state.links = [];
        state.stuck = [];
        state.messages = [];
        if (state.activeTopicId) await loadTopicData(state.activeTopicId);
    }
    syncTicker();
    showToast('已删除');
}

/** 换老师（随时可以换，已上的课不受影响） */
export async function setTeacher(source, aiId) {
    const topic = activeTopic();
    if (!topic) return;
    topic.teacherSource = source === 'persona' && aiId ? 'persona' : 'model';
    topic.teacherAiId = topic.teacherSource === 'persona' ? String(aiId) : '';
    topic.teacherName = topic.teacherSource === 'persona' ? (world.getTeacher(aiId)?.name || '') : '';
    await dbx.saveTopic(state._app, topic);
    showToast(topic.teacherSource === 'persona' ? `换成 ${topic.teacherName} 来教` : '换成模型本身来教');
}

// ---------------------------------------------------------------------------
// 问卷 → 侧写 → 规划
// ---------------------------------------------------------------------------

export async function generateSurvey() {
    const topic = activeTopic();
    if (!topic || state.loading.survey) return;
    state.loading.survey = true;
    state.error = '';
    try {
        const res = await ai.generateJson({
            system: prompts.buildSurveyPrompt(topic, state.identity),
            user: '出这份问卷。',
            temperature: 0.7,
        });
        if (!res.ok) { setError(res.error); return; }

        const questions = asArray(res.data?.questions).map((q, i) => ({
            id: String(q?.id || `q${i + 1}`),
            kind: q?.kind === 'text' ? 'text' : 'choice',
            q: String(q?.q || '').trim(),
            options: asArray(q?.options).map((o) => String(o || '').trim()).filter(Boolean),
            placeholder: String(q?.placeholder || '').trim(),
            answer: '',
        })).filter((q) => q.q && (q.kind === 'text' || q.options.length >= 2));

        if (questions.length === 0) { setError('这份问卷是空的，再点一次'); return; }

        topic.surveyQuestions = questions;
        topic.surveyStage = 'answering';
        state.survey.questions = questions;
        state.survey.index = 0;
        await dbx.saveTopic(state._app, topic);
    } finally {
        state.loading.survey = false;
    }
}

export function answerSurvey(questionId, value) {
    const topic = activeTopic();
    if (!topic) return;
    const q = asArray(topic.surveyQuestions).find((x) => sameId(x.id, questionId));
    if (q) q.answer = String(value ?? '');
}

export function setSurveyGoal(text) {
    state.survey.goal = String(text ?? '');
}

/** 交卷 → 侧写 + 建议目标 */
export async function submitSurvey() {
    const topic = activeTopic();
    if (!topic || state.loading.profile) return;
    const answered = asArray(topic.surveyQuestions).filter((q) => String(q.answer || '').trim());
    if (answered.length === 0) { setError('至少答一题，不然摸不到底'); return; }

    state.loading.profile = true;
    state.error = '';
    try {
        const res = await ai.generateJson({
            system: prompts.buildProfilePrompt(topic, topic.surveyQuestions, state.identity),
            user: '给出评估。',
            temperature: 0.7,
        });
        if (!res.ok) { setError(res.error); return; }

        topic.learnerProfile = tidyText(res.data?.profile || res.data?.level || '');
        topic.profileVersion = 1;
        topic.surveyStage = 'done';
        await dbx.saveTopic(state._app, topic);

        state.survey.suggested = asArray(res.data?.suggestedGoals)
            .map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4);
        state.survey.level = String(res.data?.level || '').trim();
        showToast('摸底完成');
    } finally {
        state.loading.profile = false;
    }
}

/** 定终点 → 排课 */
export async function planLessons(goal) {
    const topic = activeTopic();
    if (!topic || state.loading.plan) return;
    const target = String(goal ?? state.survey.goal ?? '').trim();
    if (!target) { setError('说说你想达到什么程度'); return; }

    state.loading.plan = true;
    state.error = '';
    try {
        topic.goal = target;
        const res = await ai.generateJson({
            system: prompts.buildPlanPrompt(topic, state.identity),
            user: '排课。',
            temperature: 0.8,
        });
        if (!res.ok) { setError(res.error); return; }

        const rows = asArray(res.data?.lessons).map((l, i) => dbx.makeLesson(
            state.identity.profileKey,
            topic.id,
            {
                index: i + 1,
                title: String(l?.title || `第 ${i + 1} 节`).trim(),
                objectives: asArray(l?.objectives).map((o) => ({
                    id: uid('ob'),
                    text: String(o || '').trim(),
                    from: 'plan',
                    done: false,
                })).filter((o) => o.text),
                thesis: '',
            },
        )).filter((l) => l.title);

        if (rows.length === 0) { setError('没排出课来，再点一次'); return; }

        // 重新规划：把旧的没上过的课删掉，上过的留着
        const kept = state.lessons.filter((l) => l.status !== LESSON_STATUS.planned);
        for (const old of state.lessons) {
            if (old.status === LESSON_STATUS.planned) await dbx.removeLesson(state._app, old.id);
        }
        rows.forEach((l, i) => { l.index = kept.length + i + 1; });

        await dbx.saveLessons(state._app, rows);
        state.lessons = [...kept, ...rows].sort((a, b) => a.index - b.index);

        topic.planned = true;
        topic.throughline = String(res.data?.throughline || '').trim();
        await dbx.saveTopic(state._app, topic);
        syncMurmurPrompts();

        state.view = '';
        state.tab = 'lessons';
        showToast(`排了 ${rows.length} 节课`);
    } finally {
        state.loading.plan = false;
    }
}

/** 用户手动加一节课 */
export async function addLesson(title) {
    const topic = activeTopic();
    if (!topic) return;
    const lesson = dbx.makeLesson(state.identity.profileKey, topic.id, {
        index: state.lessons.length + 1,
        title: String(title || '').trim() || `第 ${state.lessons.length + 1} 节`,
    });
    await dbx.saveLesson(state._app, lesson);
    state.lessons.push(lesson);
}

export async function updateLesson(lessonId, patch) {
    const lesson = state.lessons.find((l) => sameId(l.id, lessonId));
    if (!lesson) return;
    Object.assign(lesson, patch || {});
    await dbx.saveLesson(state._app, lesson);
}

export async function deleteLesson(lessonId) {
    const idx = state.lessons.findIndex((l) => sameId(l.id, lessonId));
    if (idx === -1) return;
    const [removed] = state.lessons.splice(idx, 1);
    await dbx.removeMessagesByLesson(state._app, removed.id);
    await dbx.removeLesson(state._app, removed.id);
    state.lessons.forEach((l, i) => { l.index = i + 1; });
    await dbx.saveLessons(state._app, state.lessons);
}

// ---------------------------------------------------------------------------
// 上课
// ---------------------------------------------------------------------------

export async function openLesson(lessonId, scene = 'lesson') {
    const lesson = state.lessons.find((l) => sameId(l.id, lessonId));
    if (!lesson) return;
    state.activeLessonId = lesson.id;
    state.scene = scene;
    state.composer = '';
    state.messages = await dbx.listMessages(state._app, lesson.id, scene);
    state._seq = state.messages.reduce((m, x) => Math.max(m, x.seq || 0), 0);
    state.view = scene === 'flip' ? 'flip' : 'lesson';
}

async function pushMessage(patch) {
    const lesson = activeLesson();
    const topic = activeTopic();
    if (!lesson || !topic) return null;
    const msg = dbx.makeMessage(state.identity.profileKey, topic.id, lesson.id, {
        scene: state.scene,
        seq: nextSeq(),
        ...patch,
    });
    state.messages.push(msg);
    await dbx.saveMessage(state._app, msg);
    return msg;
}

export async function removeMessage(messageId) {
    const idx = state.messages.findIndex((m) => sameId(m.id, messageId));
    if (idx === -1) return;
    const [removed] = state.messages.splice(idx, 1);
    await dbx.removeMessage(state._app, removed.id);
}

/**
 * 老师说一句。
 * userText 为空 = 开场白（用户点「开始上课」）。
 */
export async function teacherSpeak(userText = '') {
    const topic = activeTopic();
    const lesson = activeLesson();
    if (!topic || !lesson || state.loading.reply) return;

    state.loading.reply = true;
    state.error = '';
    try {
        if (lesson.status === LESSON_STATUS.planned) {
            lesson.status = LESSON_STATUS.active;
            lesson.startedAt = Date.now();
            await dbx.saveLesson(state._app, lesson);
            syncMurmurPrompts();
        }

        const system = prompts.buildLessonSystem({
            topic, lesson, identity: state.identity, cards: state.cards, stuck: state.stuck,
        });
        const res = await ai.generateChat({
            messages: prompts.buildLessonMessages(system, state.messages, userText),
            temperature: 0.88,
        });
        if (!res.ok) { setError(res.error); return; }

        await consumeTeacherReply(res.raw);
    } finally {
        state.loading.reply = false;
    }
}

/** 把老师的一条回复落成消息 + 卡片 + 词条 + 卡住点 */
async function consumeTeacherReply(raw) {
    const topic = activeTopic();
    const lesson = activeLesson();
    const { text, skills } = parser.parseReply(raw);

    const gloss = parser.firstSkill(skills, 'gloss');
    const correct = parser.firstSkill(skills, 'correct');

    // 批改：贴在用户上一条消息上，让他直接看到自己那句被改成什么样
    if (correct) {
        for (let i = state.messages.length - 1; i >= 0; i -= 1) {
            if (state.messages[i].role === 'me') {
                state.messages[i].correction = {
                    fixed: String(correct.fixed || '').trim(),
                    tip: String(correct.tip || '').trim(),
                };
                if (!state.messages[i].gloss) state.messages[i].gloss = String(correct.gloss || '').trim();
                await dbx.saveMessage(state._app, state.messages[i]);
                break;
            }
        }
    }

    // 卡片
    const createdIds = [];
    const drafts = [];
    for (const skill of skills) {
        const draft = parser.skillToCardDraft(skill);
        if (draft) drafts.push(draft);
    }
    const { creates, reuses } = library.dedupeDrafts(drafts, state.cards);
    for (const draft of creates) {
        const card = await createCard(draft, { lessonId: lesson?.id });
        if (card) createdIds.push(card.id);
    }
    for (const { card } of reuses) {
        await markCardUsed(card, lesson?.id);
        createdIds.push(card.id);
    }

    // 显式的 reuse 块
    for (const skill of parser.allSkills(skills, 'reuse')) {
        const hit = cardById(skill.cardId) || state.cards.find((c) => c.title === skill.title);
        if (hit) {
            await markCardUsed(hit, lesson?.id);
            if (!createdIds.includes(hit.id)) createdIds.push(hit.id);
        }
    }

    // 词典
    for (const skill of parser.allSkills(skills, 'dict')) {
        for (const item of parser.skillToDictDrafts(skill)) await addDictEntry(item, { silent: true });
    }

    // 卡住点 + 目标追加
    for (const skill of parser.allSkills(skills, 'stuck')) {
        const draft = parser.skillToStuckDraft(skill);
        if (draft) await addStuck(draft);
    }
    for (const skill of parser.allSkills(skills, 'objective')) {
        await appendObjective(Number(skill.lessonIndex) || 0, String(skill.text || '').trim(), 'ai');
    }

    /*
     * 拆气泡。
     *
     * ★ 卡片只挂在**最后一个**气泡上 —— 挂在每一个上会让同一张卡
     *   在聊天里出现好几次，用户以为老师给了三张一样的卡。
     * ★ 老师按协议用空行分段，本地再按宽度兜一次底（模型不分段时照样能拆）。
     */
    const settings = state.profile?.bubble || {};
    const bodies = splitBubbles(text, {
        enabled: settings.split !== false,
        maxChars: Number(settings.maxChars) || undefined,
    });

    if (!bodies.length) {
        await pushMessage({
            role: 'teacher',
            text: '（老师这次只给了卡片）',
            cardIds: createdIds,
        });
    } else {
        const glosses = alignGloss(bodies, parser.glossTexts(gloss));
        for (let i = 0; i < bodies.length; i += 1) {
            const last = i === bodies.length - 1;
            await pushMessage({
                role: 'teacher',
                text: bodies[i],
                gloss: glosses[i] || '',
                cardIds: last ? createdIds : [],
            });
        }
    }

    if (createdIds.length) syncTicker();
}

export async function sendMessage(text) {
    const body = String(text ?? state.composer ?? '').trim();
    if (!body || state.loading.reply) return;
    state.composer = '';
    await pushMessage({ role: 'me', text: body });
    await teacherSpeak(body);
}

/** 结课：总结 + 卡片网络 + 侧写覆盖 */
export async function endLesson() {
    const topic = activeTopic();
    const lesson = activeLesson();
    if (!topic || !lesson || state.loading.summary) return;
    if (state.messages.length < 2) {
        setError('还没怎么上，先聊两句再下课');
        return;
    }

    state.loading.summary = true;
    state.error = '';
    try {
        const res = await ai.generateJson({
            system: prompts.buildLessonSummaryPrompt({
                topic, lesson, identity: state.identity,
                transcript: state.messages, cards: state.cards,
            }),
            user: '收课。',
            temperature: 0.75,
        });
        if (!res.ok) { setError(res.error); return; }

        const data = res.data || {};

        // 1. 卡片（走一遍库，能复用就复用）
        const drafts = parser.summaryCardsToDrafts(data.cards);
        const { creates, reuses } = library.dedupeDrafts(drafts, state.cards);
        const idMap = new Map();
        const born = [];

        for (const draft of creates) {
            const card = await createCard(draft, { lessonId: lesson.id, silent: true });
            if (card) { idMap.set(String(draft.tmpId), card.id); born.push(card); }
        }
        for (const { draft, card } of reuses) {
            idMap.set(String(draft.tmpId), card.id);
            await markCardUsed(card, lesson.id);
        }
        for (const rawId of asArray(data.reuseCardIds)) {
            const hit = cardById(rawId);
            if (hit) { idMap.set(String(rawId), hit.id); await markCardUsed(hit, lesson.id); }
        }

        // 新卡先摆在一起（用户之后可以点整理，或者自己拖）
        placeNewCards(born);

        // 2. 连线
        const linkDrafts = parser.summaryLinksToDrafts(data.links, idMap);
        const links = [];
        for (const d of linkDrafts) {
            if (!cardById(d.from) || !cardById(d.to)) continue;
            if (state.links.some((l) => (
                (sameId(l.from, d.from) && sameId(l.to, d.to))
                || (sameId(l.from, d.to) && sameId(l.to, d.from))
            ))) continue;
            const link = dbx.makeLink(state.identity.profileKey, topic.id, d.from, d.to, {
                kind: d.kind, label: d.label, by: 'ai',
            });
            links.push(link);
            state.links.push(link);
        }
        if (links.length) await dbx.saveLinks(state._app, links);

        // 3. 词典
        for (const item of asArray(data.dict)) {
            await addDictEntry({
                front: String(item?.front || '').trim(),
                pos: String(item?.pos || '').trim(),
                back: String(item?.back || '').trim(),
                hint: String(item?.hint || '').trim(),
                by: 'ai',
            }, { silent: true });
        }

        // 4. 卡住点 → 顺手安排到后面的课
        for (const item of asArray(data.stuck)) {
            const draft = parser.skillToStuckDraft({ kind: 'stuck', ...item });
            if (draft) await addStuck(draft);
        }

        // 5. 侧写覆盖（不是追加 —— 追加会让它越滚越长）
        const nextProfile = tidyText(data.profile || '');
        if (nextProfile) {
            topic.learnerProfile = nextProfile;
            topic.profileVersion = (Number(topic.profileVersion) || 0) + 1;
        }

        // 6. 收课
        lesson.summary = tidyText(data.summary || '');
        lesson.status = LESSON_STATUS.done;
        lesson.endedAt = Date.now();
        lesson.cardIds = [...new Set([...asArray(lesson.cardIds), ...born.map((c) => c.id), ...[...idMap.values()]])];
        lesson.flip.studentLevel = topic.learnerProfile;

        await dbx.saveLesson(state._app, lesson);
        await dbx.saveTopic(state._app, topic);

        recomputeRegions();
        syncMurmurPrompts();
        syncTicker();

        if (topic.teacherSource === 'persona' && topic.teacherAiId && lesson.summary) {
            world.appendTeacherExperience(
                topic.teacherAiId,
                `在「点灯」里给 ${state.identity.userName} 上了「${topic.title}」的第 ${lesson.index} 节课：${truncate(lesson.summary, 90)}`,
            );
        }

        state.view = 'review';
        showToast(`这节课收了 ${born.length + reuses.length} 张卡`);
    } finally {
        state.loading.summary = false;
    }
}

// ---------------------------------------------------------------------------
// 反转课堂
// ---------------------------------------------------------------------------

/**
 * 开反转课堂。
 * **不给 AI 任何这节课的记忆** —— 它只拿到一份「你是这个水平的学生」。
 */
export async function startFlip(lessonId) {
    const topic = activeTopic();
    const lesson = state.lessons.find((l) => sameId(l.id, lessonId)) || activeLesson();
    if (!topic || !lesson) return;

    // 用「上这节课之前」的那一版侧写：第一节就是问卷那版，
    // 之后每节用上一节结课时覆盖的那版
    const level = lesson.flip.studentLevel || topic.learnerProfile || '';
    lesson.flip = { ...lesson.flip, status: 'running', studentLevel: level, startedAt: Date.now() };
    await dbx.saveLesson(state._app, lesson);

    state.activeLessonId = lesson.id;
    state.scene = 'flip';
    state.composer = '';
    state.messages = await dbx.listMessages(state._app, lesson.id, 'flip');
    state._seq = state.messages.reduce((m, x) => Math.max(m, x.seq || 0), 0);
    state.view = 'flip';

    if (state.messages.length === 0) {
        await pushMessage({
            role: 'system',
            text: '现在你是老师。把这节课的内容讲给这位同学听 —— 什么时候下课由他说了算。',
        });
    }
}

export async function sendFlipMessage(text) {
    const body = String(text ?? state.composer ?? '').trim();
    if (!body || state.loading.flip) return;
    const topic = activeTopic();
    const lesson = activeLesson();
    if (!topic || !lesson) return;

    state.composer = '';
    await pushMessage({ role: 'me', text: body });

    state.loading.flip = true;
    state.error = '';
    try {
        const system = prompts.buildFlipSystem({ topic, studentLevel: lesson.flip.studentLevel });
        const history = state.messages
            .filter((m) => m.role !== 'system')
            .slice(-22)
            .map((m) => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }));

        const res = await ai.generateChat({
            messages: [{ role: 'system', content: system }, ...history],
            temperature: 0.92,
        });
        if (!res.ok) { setError(res.error); return; }

        const { text: reply, skills } = parser.parseReply(res.raw);
        const end = parser.firstSkill(skills, 'end');

        await pushMessage({ role: 'student', text: reply || '（他愣住了）' });

        if (end) {
            await pushMessage({
                role: 'system',
                text: end.understood
                    ? `他说他听懂了：${String(end.reason || '').trim()}`
                    : `他还是没通：${String(end.reason || '').trim()}`,
            });
            await finishFlip(Boolean(end.understood), 'ai');
        }
    } finally {
        state.loading.flip = false;
    }
}

/** 结束反转课堂。正常路径由 AI 触发；用户也能强制结束。 */
export async function finishFlip(understood, endedBy = 'user') {
    const topic = activeTopic();
    const lesson = activeLesson();
    if (!topic || !lesson || state.loading.flipEnd) return;

    state.loading.flipEnd = true;
    try {
        const res = await ai.generateJson({
            system: prompts.buildFlipSummaryPrompt({
                topic, lesson, transcript: state.messages, understood,
            }),
            user: '复盘。',
            temperature: 0.7,
        });

        const data = res.ok ? (res.data || {}) : {};
        lesson.flip = {
            ...lesson.flip,
            status: 'done',
            endedBy,
            summary: tidyText(data.summary || (understood ? '他听懂了。' : '这次没讲通。')),
            clearOn: asArray(data.clearOn).map(String).filter(Boolean),
            shakyOn: asArray(data.shakyOn).map(String).filter(Boolean),
            endedAt: Date.now(),
        };
        lesson.status = LESSON_STATUS.flipped;

        const nextProfile = tidyText(data.profile || '');
        if (nextProfile) {
            topic.learnerProfile = nextProfile;
            topic.profileVersion = (Number(topic.profileVersion) || 0) + 1;
            await dbx.saveTopic(state._app, topic);
        }

        for (const item of asArray(data.stuck)) {
            const draft = parser.skillToStuckDraft({ kind: 'stuck', ...item });
            if (draft) await addStuck(draft);
        }

        await dbx.saveLesson(state._app, lesson);
        state.view = 'review';
        showToast(understood ? '他听懂了，这节课过了' : '这次没讲通，但记录留下了');
    } finally {
        state.loading.flipEnd = false;
    }
}

// ---------------------------------------------------------------------------
// 卡片
// ---------------------------------------------------------------------------

/** 新卡的落点：在已有卡片的右下方找一片空地，别一开始就叠在一起 */
function nextFreeSpot(index = 0) {
    const cols = 4;
    const baseX = 40;
    const baseY = 40;
    const stepX = CARD_SIZE.w + 34;
    const stepY = CARD_SIZE.h + 40;
    const n = state.cards.length + index;
    return {
        x: baseX + (n % cols) * stepX,
        y: baseY + Math.floor(n / cols) * stepY,
    };
}

export async function createCard(draft, { lessonId = '', silent = false } = {}) {
    const topic = activeTopic();
    if (!topic || !draft) return null;
    const spot = nextFreeSpot();
    const isCode = draft.type === 'code';
    const card = dbx.makeCard(state.identity.profileKey, topic.id, {
        ...draft,
        lessonId: String(lessonId || ''),
        usedInLessons: lessonId ? [String(lessonId)] : [],
        x: spot.x,
        y: spot.y,
        w: isCode ? CARD_SIZE.codeW : CARD_SIZE.w,
        h: isCode ? CARD_SIZE.codeH : CARD_SIZE.h,
    });
    delete card.tmpId;
    await dbx.saveCard(state._app, card);
    state.cards.push(card);
    if (!silent) showToast(`收到一张「${truncate(card.title, 10)}」`);
    return card;
}

/** 一批新卡围着已有内容摆一圈，避免全叠在左上角 */
function placeNewCards(cards) {
    const list = asArray(cards);
    if (list.length === 0) return;
    const others = state.cards.filter((c) => !list.some((n) => sameId(n.id, c.id)));
    const maxY = others.length ? Math.max(...others.map((c) => (Number(c.y) || 0) + (Number(c.h) || CARD_SIZE.h))) : 0;
    const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(list.length))));
    list.forEach((card, i) => {
        card.x = 40 + (i % cols) * (CARD_SIZE.w + 34);
        card.y = maxY + 56 + Math.floor(i / cols) * (CARD_SIZE.h + 40);
        persistCard(card);
    });
}

async function markCardUsed(card, lessonId) {
    if (!card || !lessonId) return;
    const ids = new Set(asArray(card.usedInLessons).map(String));
    if (ids.has(String(lessonId))) return;
    ids.add(String(lessonId));
    card.usedInLessons = [...ids];
    await dbx.saveCard(state._app, card);
}

export async function updateCard(cardId, patch) {
    const card = cardById(cardId);
    if (!card) return;
    Object.assign(card, patch || {}, { edited: true });
    await dbx.saveCard(state._app, card);
}

export async function deleteCard(cardId) {
    const idx = state.cards.findIndex((c) => sameId(c.id, cardId));
    if (idx === -1) return;
    const [removed] = state.cards.splice(idx, 1);
    state.links = state.links.filter((l) => !sameId(l.from, removed.id) && !sameId(l.to, removed.id));
    await dbx.purgeCard(state._app, removed.id);
    if (sameId(state.activeCardId, removed.id)) state.activeCardId = '';
    recomputeRegions();
}

/** 用户在墙上新建一张空白便利贴 */
export async function createBlankCard(x = 0, y = 0, type = 'note') {
    const topic = activeTopic();
    if (!topic) return null;
    const card = dbx.makeCard(state.identity.profileKey, topic.id, {
        type,
        title: '新卡片',
        brief: '',
        x, y,
        w: CARD_SIZE.w,
        h: CARD_SIZE.h,
        edited: true,
    });
    await dbx.saveCard(state._app, card);
    state.cards.push(card);
    state.activeCardId = card.id;
    return card;
}

export function moveCard(cardId, x, y) {
    const card = cardById(cardId);
    if (!card) return;
    card.x = Math.round(x);
    card.y = Math.round(y);
    persistCard(card);
}

/** 拖到重合 → 叠成一堆 */
export async function stackCards(dragId, targetId) {
    const a = cardById(dragId);
    const b = cardById(targetId);
    if (!a || !b || sameId(a.id, b.id)) return;

    const stackId = b.stackId || a.stackId || uid('st');
    const members = state.cards.filter((c) => c.stackId && sameId(c.stackId, stackId));
    const base = members.length
        ? members.reduce((m, c) => (Number(c.stackOrder) > Number(m.stackOrder) ? c : m), members[0])
        : null;

    if (!b.stackId) {
        b.stackId = stackId;
        b.stackOrder = 0;
        persistCard(b);
    }
    a.stackId = stackId;
    a.stackOrder = (base ? Number(base.stackOrder) : Number(b.stackOrder) || 0) + 1;
    a.x = Number(b.x) + a.stackOrder * CARD_SIZE.stackOffsetX;
    a.y = Number(b.y) + a.stackOrder * CARD_SIZE.stackOffsetY;
    persistCard(a);

    await flushCards();
    showToast(`叠成一堆（${members.length + (b.stackId ? 0 : 1) + 1} 张）`);
}

export function stackMembers(stackId) {
    return state.cards
        .filter((c) => c.stackId && sameId(c.stackId, stackId))
        .sort((a, b) => (Number(a.stackOrder) || 0) - (Number(b.stackOrder) || 0));
}

/** 点一下卡片堆 → 摊开到画面中央 */
export function spreadStack(stackId) {
    state.wall.spreadStackId = String(stackId || '');
    state.wall.spreadIndex = 0;
}

export function closeSpread() {
    state.wall.spreadStackId = '';
    state.wall.spreadIndex = 0;
}

export function spreadStep(delta) {
    const members = stackMembers(state.wall.spreadStackId);
    if (!members.length) return;
    state.wall.spreadIndex = clamp(state.wall.spreadIndex + delta, 0, members.length - 1);
}

/** 从堆里抽一张出来 */
export async function unstackCard(cardId) {
    const card = cardById(cardId);
    if (!card?.stackId) return;
    const sid = card.stackId;
    card.stackId = '';
    card.stackOrder = 0;
    card.x = Number(card.x) + CARD_SIZE.w + 26;
    persistCard(card);

    // 只剩一张的堆没有意义，散掉
    const rest = stackMembers(sid);
    if (rest.length <= 1) {
        for (const c of rest) { c.stackId = ''; c.stackOrder = 0; persistCard(c); }
        if (sameId(state.wall.spreadStackId, sid)) closeSpread();
    }
    await flushCards();
}

// ---------------------------------------------------------------------------
// 连线
// ---------------------------------------------------------------------------

export function beginLink(cardId) {
    state.wall.linkingFrom = String(cardId || '');
}

export function cancelLink() {
    state.wall.linkingFrom = '';
}

export async function completeLink(toId, kind = 'because') {
    const from = state.wall.linkingFrom;
    state.wall.linkingFrom = '';
    const topic = activeTopic();
    if (!topic || !from || !toId || sameId(from, toId)) return;
    if (!cardById(from) || !cardById(toId)) return;

    const existing = state.links.find((l) => (
        (sameId(l.from, from) && sameId(l.to, toId)) || (sameId(l.from, toId) && sameId(l.to, from))
    ));
    if (existing) {
        // 已经连过了 → 再连一次视为换关系类型
        existing.kind = kind;
        await dbx.saveLink(state._app, existing);
        showToast('换了这条线的关系');
        return;
    }

    const link = dbx.makeLink(state.identity.profileKey, topic.id, from, toId, { kind, by: 'user' });
    state.links.push(link);
    await dbx.saveLink(state._app, link);
    recomputeRegions();
}

export async function updateLink(linkId, patch) {
    const link = state.links.find((l) => sameId(l.id, linkId));
    if (!link) return;
    Object.assign(link, patch || {});
    await dbx.saveLink(state._app, link);
}

export async function deleteLink(linkId) {
    const idx = state.links.findIndex((l) => sameId(l.id, linkId));
    if (idx === -1) return;
    const [removed] = state.links.splice(idx, 1);
    await dbx.removeLink(state._app, removed.id);
    recomputeRegions();
}

// ---------------------------------------------------------------------------
// 推理墙
// ---------------------------------------------------------------------------

export function panWall(dx, dy) {
    state.wall.x += dx;
    state.wall.y += dy;
}

export function zoomWall(factor, cx = 0, cy = 0) {
    const before = state.wall.zoom;
    const next = clamp(before * factor, WALL_ZOOM.min, WALL_ZOOM.max);
    if (next === before) return;
    // 以指定点为锚缩放，不然一放大内容就跑没了
    state.wall.x = cx - ((cx - state.wall.x) * next) / before;
    state.wall.y = cy - ((cy - state.wall.y) * next) / before;
    state.wall.zoom = next;
}

export function setWallView(view) {
    Object.assign(state.wall, view || {});
    const topic = activeTopic();
    if (topic) {
        topic.wall = { x: state.wall.x, y: state.wall.y, zoom: state.wall.zoom };
        persistTopic(topic);
    }
}

export function recomputeRegions() {
    state.wall.regions = layout.clusterRegions(state.cards, state.links);
}

/**
 * 点「整理」。纯几何，不调 API。
 * 卡片多的时候会跳过力导向直接网格 —— 与其算十秒不如立刻给个能用的。
 */
export async function tidyWall(viewport) {
    if (state.loading.tidy) return;
    state.loading.tidy = true;
    const t0 = Date.now();
    try {
        const result = layout.plan(state.cards, state.links, {
            targetWidth: Math.max(680, (viewport?.w || 700) / Math.max(0.4, state.wall.zoom)),
        });
        for (const [id, pos] of Object.entries(result.positions)) {
            const card = cardById(id);
            if (!card) continue;
            card.x = pos.x;
            card.y = pos.y;
            persistCard(card);
        }
        await flushCards();
        recomputeRegions();

        if (viewport?.w && result.bounds.w) {
            const fit = layout.fitTo(result.bounds, viewport);
            state.wall.zoom = fit.zoom;
            state.wall.x = fit.x;
            state.wall.y = fit.y;
            setWallView({});
        }
        state.wall.lastTidyMs = Date.now() - t0;
        showToast(result.mode === 'grid'
            ? `卡片太多，按网格排了（${state.wall.lastTidyMs}ms）`
            : `整理好了（${state.wall.lastTidyMs}ms）`);
    } finally {
        state.loading.tidy = false;
    }
}

/** 聚焦某一块：一小块一小块看 */
export function focusRegion(regionId, viewport) {
    const region = state.wall.regions.find((r) => sameId(r.id, regionId));
    state.wall.focusRegionId = region ? String(regionId) : '';
    if (!region || !viewport?.w) return;
    const fit = layout.fitTo(region.bounds, viewport);
    state.wall.zoom = fit.zoom;
    state.wall.x = fit.x;
    state.wall.y = fit.y;
    setWallView({});
}

export function fitAll(viewport) {
    if (state.cards.length === 0 || !viewport?.w) return;
    const xs = state.cards.map((c) => Number(c.x) || 0);
    const ys = state.cards.map((c) => Number(c.y) || 0);
    const xe = state.cards.map((c) => (Number(c.x) || 0) + (Number(c.w) || CARD_SIZE.w));
    const ye = state.cards.map((c) => (Number(c.y) || 0) + (Number(c.h) || CARD_SIZE.h));
    const bounds = {
        x: Math.min(...xs), y: Math.min(...ys),
        w: Math.max(...xe) - Math.min(...xs),
        h: Math.max(...ye) - Math.min(...ys),
    };
    const fit = layout.fitTo(bounds, viewport);
    state.wall.zoom = fit.zoom;
    state.wall.x = fit.x;
    state.wall.y = fit.y;
    setWallView({});
}

/** 卡片的固定微旋转：让墙看起来像真贴过便利贴，而不是一张表格 */
export function cardTilt(card) {
    return (hash01(card?.id) - 0.5) * 2.6;
}

/** 用户点某张卡「讲深一点」 */
export async function expandCard(cardId, question = '') {
    const topic = activeTopic();
    const card = cardById(cardId);
    if (!topic || !card || state.loading.expand) return;
    state.loading.expand = card.id;
    try {
        const res = await ai.generateJson({
            system: prompts.buildCardExpandPrompt(topic, card, question),
            user: '再讲一层。',
            temperature: 0.8,
        });
        if (!res.ok) { setError(res.error); return; }
        const body = tidyText(res.data?.body || '');
        const origin = tidyText(res.data?.origin || '');
        card.body = [card.body, body, origin && `【由来】${origin}`].filter(Boolean).join('\n\n');
        await dbx.saveCard(state._app, card);
        showToast('讲深了一层');
    } finally {
        state.loading.expand = '';
    }
}

// ---------------------------------------------------------------------------
// 错题本
// ---------------------------------------------------------------------------

export async function addStuck(draft) {
    const topic = activeTopic();
    const lesson = activeLesson();
    if (!topic || !draft?.point) return null;
    // 同一个点不重复记
    if (state.stuck.some((s) => s.point === draft.point && s.status !== 'resolved')) return null;

    const row = dbx.makeStuck(state.identity.profileKey, topic.id, {
        lessonId: lesson?.id || '',
        point: draft.point,
        why: draft.why || '',
        prerequisite: draft.prerequisite || '',
    });

    // AI 说了要安排到第几节，就直接挂过去
    const target = Number(draft.lessonIndex) || 0;
    if (target > 0) {
        const hit = state.lessons.find((l) => l.index === target);
        if (hit) {
            row.scheduledLessonId = hit.id;
            row.status = 'scheduled';
            await appendObjective(target, `补讲：${draft.point}`, 'stuck');
        }
    }

    state.stuck.unshift(row);
    await dbx.saveStuck(state._app, row);
    return row;
}

export async function appendObjective(lessonIndex, text, from = 'ai') {
    const body = String(text || '').trim();
    if (!body) return;
    const lesson = state.lessons.find((l) => l.index === Number(lessonIndex))
        // 没指定就挂到下一节还没上的课上
        || state.lessons.find((l) => l.status === LESSON_STATUS.planned);
    if (!lesson) return;
    if (asArray(lesson.objectives).some((o) => o.text === body)) return;
    lesson.objectives = [...asArray(lesson.objectives), { id: uid('ob'), text: body, from, done: false }];
    await dbx.saveLesson(state._app, lesson);
}

export async function resolveStuck(stuckId) {
    const row = state.stuck.find((s) => sameId(s.id, stuckId));
    if (!row) return;
    row.status = row.status === 'resolved' ? 'open' : 'resolved';
    row.resolvedAt = row.status === 'resolved' ? Date.now() : 0;
    await dbx.saveStuck(state._app, row);
}

export async function deleteStuck(stuckId) {
    const idx = state.stuck.findIndex((s) => sameId(s.id, stuckId));
    if (idx === -1) return;
    const [removed] = state.stuck.splice(idx, 1);
    await dbx.removeStuck(state._app, removed.id);
}

// ---------------------------------------------------------------------------
// 知识点词典
// ---------------------------------------------------------------------------

export async function addDictEntry(draft, { silent = false } = {}) {
    const topic = activeTopic();
    const front = String(draft?.front || '').trim();
    if (!front || !state.identity.profileKey) return null;

    const existing = state.dict.find((d) => (
        d.front === front && sameId(d.topicId, topic?.id || '')
    ));
    if (existing) {
        if (draft.back && !existing.back) {
            existing.back = draft.back;
            await dbx.saveDictEntry(state._app, existing);
        }
        return existing;
    }

    const entry = dbx.makeDictEntry(state.identity.profileKey, topic?.id || '', {
        front,
        pos: String(draft.pos || '').trim(),
        back: String(draft.back || '').trim(),
        hint: String(draft.hint || '').trim(),
        by: draft.by === 'ai' ? 'ai' : 'user',
        dueAt: Date.now(),
    });
    state.dict.unshift(entry);
    await dbx.saveDictEntry(state._app, entry);
    if (!silent) showToast('已加进词典');
    syncTicker();
    return entry;
}

/**
 * 一次粘一整段，一行一条。
 * 支持三种写法：`eat v. 吃` / `eat = 吃` / `eat|v.|吃`
 */
export async function addDictBulk(text) {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    let n = 0;
    for (const line of lines) {
        let front = ''; let pos = ''; let back = '';
        if (line.includes('|')) {
            [front, pos, back] = line.split('|').map((x) => (x || '').trim());
        } else if (line.includes('=')) {
            const [a, b] = line.split('=');
            front = (a || '').trim();
            back = (b || '').trim();
        } else {
            const m = line.match(/^(\S+)\s+([a-z]{1,6}\.)\s+(.+)$/i);
            if (m) { [, front, pos, back] = m; } else {
                const parts = line.split(/\s+/);
                front = parts.shift() || '';
                back = parts.join(' ');
            }
        }
        if (!front) continue;
        const row = await addDictEntry({ front, pos, back }, { silent: true });
        if (row) n += 1;
    }
    showToast(n ? `加了 ${n} 条` : '一条都没识别出来');
    return n;
}

export async function updateDictEntry(entryId, patch) {
    const entry = state.dict.find((d) => sameId(d.id, entryId));
    if (!entry) return;
    Object.assign(entry, patch || {});
    await dbx.saveDictEntry(state._app, entry);
    syncTicker();
}

export async function deleteDictEntry(entryId) {
    const idx = state.dict.findIndex((d) => sameId(d.id, entryId));
    if (idx === -1) return;
    const [removed] = state.dict.splice(idx, 1);
    await dbx.removeDictEntry(state._app, removed.id);
    syncTicker();
}

/** 自评 → 走 SRS */
export async function gradeDictEntry(entryOrId, gradeId) {
    const id = typeof entryOrId === 'object' ? entryOrId?.id : entryOrId;
    const entry = state.dict.find((d) => sameId(d.id, id));
    if (!entry) return;
    Object.assign(entry, srs.grade(entry, gradeId));
    await dbx.saveDictEntry(state._app, entry);
}

export async function setDictBucket(entryOrId, bucket) {
    const id = typeof entryOrId === 'object' ? entryOrId?.id : entryOrId;
    await updateDictEntry(id, { bucket });
}

/** AI 补全释义 / 词根 */
export async function enrichDict(entryIds) {
    const topic = activeTopic();
    if (!topic || state.loading.enrich) return;
    const rows = state.dict.filter((d) => asArray(entryIds).some((x) => sameId(x, d.id)));
    if (rows.length === 0) return;

    state.loading.enrich = true;
    try {
        const res = await ai.generateJson({
            system: prompts.buildDictEnrichPrompt(topic, rows),
            user: '补全。',
            temperature: 0.6,
        });
        if (!res.ok) { setError(res.error); return; }
        for (const item of asArray(res.data?.items)) {
            const hit = rows.find((r) => r.front === String(item?.front || '').trim());
            if (!hit) continue;
            hit.pos = String(item.pos || hit.pos || '').trim();
            hit.back = String(item.back || hit.back || '').trim();
            hit.hint = String(item.hint || hit.hint || '').trim();
        }
        await dbx.saveDictEntries(state._app, rows);
        syncTicker();
        showToast(`补全了 ${rows.length} 条`);
    } finally {
        state.loading.enrich = false;
    }
}

export function dictStats() {
    return srs.stats(state.dict);
}

// ---------------------------------------------------------------------------
// 悬浮播放
// ---------------------------------------------------------------------------

/** 词典 / 设置一变就调它。这是 ticker 引擎的唯一入口。 */
export function syncTicker() {
    const p = state.profile;
    if (!p) return;
    const scope = p.ticker?.topicId
        ? state.dict.filter((d) => sameId(d.topicId, p.ticker.topicId))
        : state.dict;

    ticker.configure({
        entries: scope,
        ticker: p.ticker,
        island: p.island,
        tv: p.tv,
        islandHelper: state._app?.toolkit?.island,
        onGrade: (entry, gradeId) => { gradeDictEntry(entry.id, gradeId); },
        onBucket: (entry, bucket) => { setDictBucket(entry.id, bucket); },
        onResize: (width) => {
            if (!state.profile) return;
            state.profile.tv = { ...state.profile.tv, width };
            persistProfile();
        },
    });
}

export function updateTickerSetting(group, patch) {
    if (!state.profile) return;
    state.profile[group] = { ...(state.profile[group] || {}), ...(patch || {}) };
    persistProfile();
    syncTicker();
}

export function tickerSnapshot() {
    return ticker.snapshot();
}

// ---------------------------------------------------------------------------
// 主题配色
// ---------------------------------------------------------------------------

let themeApplier = null;

export function registerThemeApplier(fn) {
    themeApplier = typeof fn === 'function' ? fn : null;
    applyProfileTheme();
}

function currentColors() {
    const p = state.profile;
    if (!p) return {};
    if (p.activeCustomThemeId) {
        const hit = asArray(p.customThemes).find((t) => sameId(t.id, p.activeCustomThemeId));
        if (hit) return hit.colors || {};
    }
    return p.customColors || {};
}

function applyProfileTheme() {
    if (!themeApplier || !state.profile) return;
    themeApplier(state.profile.themeId || 'lantern', currentColors());
}

export function applyTheme(themeId, colors) {
    if (!state.profile) return;
    state.profile.themeId = themeId || state.profile.themeId;
    state.profile.customColors = { ...(colors || {}) };
    state.profile.activeCustomThemeId = '';
    persistProfile();
    applyProfileTheme();
}

export function saveCustomTheme(name, colors, baseThemeId) {
    if (!state.profile) return null;
    const theme = {
        id: uid('th'),
        name: String(name || '未命名').trim(),
        baseThemeId: baseThemeId || state.profile.themeId,
        colors: { ...(colors || {}) },
        createdAt: Date.now(),
    };
    state.profile.customThemes = [...asArray(state.profile.customThemes), theme];
    state.profile.activeCustomThemeId = theme.id;
    state.profile.themeId = theme.baseThemeId;
    persistProfile();
    applyProfileTheme();
    return theme;
}

export function updateCustomTheme(themeId, patch) {
    if (!state.profile) return;
    const hit = asArray(state.profile.customThemes).find((t) => sameId(t.id, themeId));
    if (!hit) return;
    Object.assign(hit, patch || {});
    persistProfile();
    if (sameId(state.profile.activeCustomThemeId, themeId)) applyProfileTheme();
}

export function removeCustomTheme(themeId) {
    if (!state.profile) return;
    state.profile.customThemes = asArray(state.profile.customThemes).filter((t) => !sameId(t.id, themeId));
    if (sameId(state.profile.activeCustomThemeId, themeId)) {
        state.profile.activeCustomThemeId = '';
        applyProfileTheme();
    }
    persistProfile();
}

export function useCustomTheme(themeId) {
    if (!state.profile) return;
    state.profile.activeCustomThemeId = String(themeId || '');
    const hit = asArray(state.profile.customThemes).find((t) => sameId(t.id, themeId));
    if (hit?.baseThemeId) state.profile.themeId = hit.baseThemeId;
    persistProfile();
    applyProfileTheme();
}

// ---------------------------------------------------------------------------
// 翻译呈现 / 拆气泡 / 长按翻译
// ---------------------------------------------------------------------------

/** 翻译贴哪儿：'meme' 描边贴边上 | 'tap' 点开才展开 */
export function setGlossMode(mode) {
    if (!state.profile) return;
    state.profile.glossMode = mode === 'tap' ? 'tap' : 'meme';
    persistProfile();
}

/** 老师一条回复要不要拆成短气泡 */
export function setBubbleSplit(on) {
    if (!state.profile) return;
    state.profile.bubble = { ...(state.profile.bubble || {}), split: on !== false };
    persistProfile();
}

export function setBubbleWidth(maxChars) {
    if (!state.profile) return;
    const value = Math.min(120, Math.max(20, Math.floor(Number(maxChars) || 46)));
    state.profile.bubble = { ...(state.profile.bubble || {}), maxChars: value };
    persistProfile();
}

/** 长按翻译用哪个引擎 */
export function setTranslateEngine(engine) {
    if (!state.profile) return;
    state.profile.translate = {
        ...(state.profile.translate || {}),
        engine: engine === 'ai' ? 'ai' : 'local',
    };
    persistProfile();
}

/** 主题的浸没维度（全外文 / 循序渐进） */
export async function setTopicImmersion(topicId, immersion) {
    const topic = state.topics.find((t) => sameId(t.id, topicId)) || activeTopic();
    if (!topic) return;
    topic.immersion = immersion === 'full' ? 'full' : 'gradual';
    await dbx.saveTopic(state._app, topic);
}

/**
 * 长按翻译。
 *
 * ★ 「最多把这个卡片内容发给 AI」这条约束落在 translate-service 的
 *   cardTranslatableText() 上 —— 这里拿到的就已经是上限了，
 *   不会再有世界观、聊天历史之类的东西混进去。
 *
 * @param {string} text  要翻的内容
 * @param {object} opts  { source: 显示在悬浮层上的来源标签 }
 */
export async function translateText(text, opts = {}) {
    const body = String(text || '').trim();
    if (!body) return;

    const settings = state.profile?.translate || {};
    const engine = settings.engine === 'ai' ? 'ai' : 'local';
    const topic = activeTopic();

    // 先把层开出来（带 loading），用户长按之后立刻有反馈
    state.translation = {
        text: '',
        source: String(opts.source || '').trim(),
        origin: body,
        kind: engine,
        loading: engine === 'ai',
        error: '',
        x: Number(settings.memeX) || 50,
        y: Number(settings.memeY) || 72,
    };

    const result = await translator.translate(body, {
        engine,
        entries: state.dict,
        target: topic?.targetNative || topic?.target || '',
    });

    // 期间用户可能已经关掉了，或者又长按了别处 —— 别把结果盖回去
    if (!state.translation || state.translation.origin !== body) return;

    if (!result.ok) {
        state.translation.loading = false;
        state.translation.error = result.error || '翻不出来';
        return;
    }

    state.translation.loading = false;
    state.translation.text = result.text;
    state.translation.kind = result.kind;
    state.translation.hits = result.hits || [];
}

/** 直接翻一张卡（长按卡片时用） */
export function translateCard(cardId) {
    const card = cardById(cardId);
    if (!card) return Promise.resolve();
    return translateText(translator.cardTranslatableText(card), { source: card.title || '这张卡' });
}

/** 悬浮层被拖动。x/y 是百分比，跟着屏幕走不跟像素走 */
export function moveTranslation(x, y) {
    if (!state.translation) return;
    const nx = Math.min(96, Math.max(4, Number(x) || 0));
    const ny = Math.min(94, Math.max(6, Number(y) || 0));
    state.translation.x = nx;
    state.translation.y = ny;
    if (state.profile) {
        state.profile.translate = { ...(state.profile.translate || {}), memeX: nx, memeY: ny };
        persistProfile();
    }
}

export function closeTranslation() {
    state.translation = null;
}

// ---------------------------------------------------------------------------
// murmur
// ---------------------------------------------------------------------------

function syncMurmurPrompts() {
    const toolkit = state._app?.toolkit;
    if (!toolkit) return;
    const map = {};
    for (const topic of state.topics) {
        map[topic.id] = sameId(topic.id, state.activeTopicId) ? state.lessons : [];
    }
    syncTopicPrompts(toolkit, state.topics, map);
}

export function registerStaticPrompts(toolkit) {
    registerStarlitPrompts(toolkit);
}

// ---------------------------------------------------------------------------
// 给外部（services / 小组件）用的只读概要
// ---------------------------------------------------------------------------

export function overview() {
    const topic = activeTopic();
    const done = state.lessons.filter((l) => l.status === LESSON_STATUS.done || l.status === LESSON_STATUS.flipped);
    return {
        topicTitle: topic?.title || '',
        totalLessons: state.lessons.length,
        doneLessons: done.length,
        cards: state.cards.length,
        links: state.links.length,
        dictTotal: state.dict.length,
        dictDue: srs.stats(state.dict).due,
        nextLine: state.dict.length ? dictLine(state.dict[0]) : '',
    };
}
