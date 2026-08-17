/**
 * 设置 App · settings-sdk（统一中间层 / mediator）
 *
 *   所有跨 App 的实体数据（user / ai / world / tagGroup / tag /
 *   snapshot / location / timeline / draft / anchor）
 *   都通过这一层做 CRUD。其它 App 在注册数据源 / 注入上下文时只需要调 SDK。
 *
 * 设计原则：
 *   - 数据模型按「prototype + instance」结构（每条记录都自洽，instance.id 稳定）
 *   - SDK 永远同步返回当前快照（来自 IndexedDB 的内存副本），CRUD 异步写库
 *   - 所有写入操作触发 'settings-sdk:change' 事件（detail 携带 { scope, action, payload }）
 *   - 默认 profile = 'minimal'（遵循 §0.2 末段）
 *
 * 对外暴露（节选）：
 *   settingsSdk.users / aiPersons / worlds / tagGroups / tags / locations
 *   settingsSdk.snapshot / profile
 *   settingsSdk.timelines / drafts / anchors
 *   settingsSdk.events.on / .emit
 */

import { escapeHtml } from '@/src/core/escape.js';

import { createEntityApi } from './crud.js';
import { createWorldGroupsApi } from './groups.js';
import { createTagGroupsApi, createTagsApi } from './tags.js';
import { createPlacesApi, createLocationsApi } from './geo/index.js';
import { createSnapshotApi, weightedPick } from './snapshots.js';
import { createProfileApi } from './profile.js';
import { createEventBus } from './bus.js';
import { createTimelinesApi } from './timelines.js';
import { createDraftsApi } from './drafts.js';
import { createChronologyApi } from './chronology/index.js';
import { createAnchorsApi } from './anchors.js';
import { bindPersona } from './persona.js';
import { createDiaryApi } from './diary.js';
import { createScheduleApi, createWeeklyScheduleApi } from './schedule.js';
import { createDefaultUserCardApi } from './default-user-card.js';
import { chatFriends } from './chat-friends.js';
import { chatGroups } from './chat-groups.js';
import { createChatMessagesApi } from './chat-messages.js';
import { createStoryArchivesApi } from './story-archives.js';
import { createChatFavoritesApi } from './chat-favorites.js';
import { createNookPromptsApi } from '../../nook/sdk/prompts.js';
import { createReplyPromptsApi } from './reply-prompts.js'; // ★ v0.50 chat-app 回复提示词 SDK
import { createGroupReplyPromptsApi } from './group-reply-prompts.js'; // ★ v0.82 chat-app 群聊回复提示词 SDK(公共池)
import { createPromptLibraryApi } from './prompt-library.js'; // ★ v0.58 chat-app 拉取 prompt 库 SDK
import { createChatArchiveApi } from './chat-archive.js'; // ★ v0.61 chat-app 消息归档 SDK
import { createCalendarSummariesApi } from './calendar-summaries.js'; // ★ v0.61.3 chat-app 日历概要 SDK
import { createStorySummariesApi } from './story-summaries.js'; // ★ v0.61.3 chat-app 故事概要 SDK
import { createChatWindowConfigApi } from './chat-window-config.js'; // ★ v0.61.3+ chat-app 上下文长度 SDK(原 K 链 SDK 精简版)
import { createKChainApi } from './k-chain.js'; // ★ v0.88 K 链记忆(第二版,只管存)
import { createMemorySummariesApi } from './memory-summaries.js'; // ★ v0.65 chat-app 分级记忆系统 SDK
import { createAppPromptsApi } from './app-prompts.js'; // ★ v0.61.5 第三方 App Prompt 注册 SDK
import { createAssetFlowApi } from './asset-flow.js'; // ★ v0.67 资金流水 SDK(红包/转账/钱包)
import { createMomentsApi } from './moments.js';
import { createGroupMemorySyncApi } from './group-memory-sync.js'; // ★ v0.87 群聊记忆互通 SDK(私聊→回复提示词注入群聊记忆) // ★ v0.79 chat-app 朋友圈 SDK(AI 发朋友圈 + 概要)
import {
    computePersonaBalance,
    settlePersona,
    formatAmount,
} from '../../persona/income-engine.js';
import { saveSnapshot } from './chat-snapshot.js';

const bump = (events) => (scope, action, payload) => events.emit({ scope, action, payload });

// ============================================
// 资产 API 工厂（给 sdk.persona.asset 和 toolkit.persona.asset 共用）
// ============================================

function pickEntityApi(sdk, entityType) {
    return entityType === 'user' ? sdk.users : sdk.aiPersons;
}

function _createAssetApi(sdk, toolkit) {
    return {
        /** 读取某个人设当前实际余额（含积欠）。*/
        getBalance(entityType = 'user', entityId) {
            if (!sdk || !entityId) return 0;
            const inst = pickEntityApi(sdk, entityType).get(entityId);
            if (!inst) return 0;
            const { balance } = computePersonaBalance(inst, Date.now());
            return balance;
        },

        /** 取得人设 + 当前余额 + 货币名（其他 app 展示用）。*/
        snapshot(entityType = 'user', entityId) {
            if (!sdk || !entityId) return null;
            const inst = pickEntityApi(sdk, entityType).get(entityId);
            if (!inst) return null;
            const { balance, accrued } = computePersonaBalance(inst, Date.now());
            const world = inst.boundWorldId ? sdk.worlds.get(inst.boundWorldId) : null;
            const baseCurrency = (world?.currencies || []).find(c => c.isBase)
                || (world?.currencies || [])[0] || null;
            return {
                balance,
                accrued,
                baseBalance: Number(inst.assetBalance) || 0,
                settledAt: inst.assetLastSettledAt || 0,
                currency: baseCurrency ? {
                    id: baseCurrency.id,
                    name: baseCurrency.name,
                    unit: baseCurrency.unit || '',
                } : null,
                events: Array.isArray(inst.incomeEvents) ? inst.incomeEvents.slice() : [],
            };
        },

        /**
         * 增减余额（用于购物扣款、聊天红包收入等）。
         * - delta > 0：加；delta < 0：减
         * - 会先 settle，再覆盖 assetBalance（避免下次结算把差额再算一遍）
         * - 不允许扣到 < 0
         * 返回新的余额。
         */
        async adjust(delta, note = '', entityType = 'user', entityId) {
            if (!sdk || typeof delta !== 'number' || !entityId) return null;
            const api = pickEntityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return null;
            const { next: settled } = settlePersona(inst, Date.now());
            const newBalance = Math.max(0, (settled.assetBalance || 0) + delta);
            await api.update(entityId, {
                assetBalance: newBalance,
                assetLastSettledAt: settled.assetLastSettledAt,
            });
            if (toolkit?.island?.notify) {
                const sign = delta > 0 ? '+' : '';
                toolkit.island.notify(
                    delta > 0 ? 'success' : 'warning',
                    `${sign}${formatAmount(delta)}`,
                    `余额 ${formatAmount(newBalance)}${note ? ' · ' + note : ''}`,
                );
            }
            return newBalance;
        },

        /** 把积欠的定时收入合到余额。*/
        async settle(entityType = 'user', entityId) {
            if (!sdk || !entityId) return null;
            const api = pickEntityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return null;
            const { next, accrued } = settlePersona(inst, Date.now());
            if (accrued !== 0 || !inst.assetLastSettledAt) {
                await api.update(entityId, {
                    assetBalance: next.assetBalance,
                    assetLastSettledAt: next.assetLastSettledAt,
                });
            }
            return accrued;
        },

        /** 添加一条收入事件。*/
        async addIncome(event = {}, entityType = 'user', entityId) {
            if (!sdk || !entityId || !event) return null;
            const api = pickEntityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return null;
            const freq = event.frequency || 'monthly';
            const item = {
                id: event.id || `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                name: (event.name || '').trim() || '收入',
                amount: Number(event.amount) || 0,
                frequency: freq,
                startDate: event.startDate || (() => {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                })(),
                dayOfMonth: freq === 'monthly' ? (Number(event.dayOfMonth) || 1) : null,
                dayOfWeek:  freq === 'weekly'  ? (Number(event.dayOfWeek)  || 0) : null,
                enabled: event.enabled !== false,
                createdBy: event.createdBy || 'external',
                source: event.source || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            const list = Array.isArray(inst.incomeEvents) ? inst.incomeEvents.slice() : [];
            list.push(item);
            const { next } = settlePersona({ ...inst, incomeEvents: list }, Date.now());
            await api.update(entityId, {
                incomeEvents: list,
                assetBalance: next.assetBalance,
                assetLastSettledAt: next.assetLastSettledAt,
            });
            return item;
        },

        /** 更新一条收入事件。*/
        async updateIncome(eventId, patch = {}, entityType = 'user', entityId) {
            if (!sdk || !eventId || !entityId) return null;
            const api = pickEntityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return null;
            const list = (Array.isArray(inst.incomeEvents) ? inst.incomeEvents : []).slice();
            const idx = list.findIndex(e => e.id === eventId);
            if (idx < 0) return null;
            const prev = list[idx];
            const freq = patch.frequency || prev.frequency;
            list[idx] = {
                ...prev,
                ...(patch.name !== undefined ? { name: (patch.name || '').trim() || prev.name } : {}),
                ...(patch.amount !== undefined ? { amount: Number(patch.amount) || 0 } : {}),
                ...(patch.frequency !== undefined ? { frequency: freq } : {}),
                ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
                ...(freq === 'monthly'
                    ? { dayOfMonth: Number(patch.dayOfMonth ?? prev.dayOfMonth ?? 1) || 1 }
                    : { dayOfMonth: null }),
                ...(freq === 'weekly'
                    ? { dayOfWeek: Number(patch.dayOfWeek ?? prev.dayOfWeek ?? 0) || 0 }
                    : { dayOfWeek: null }),
                ...(patch.enabled !== undefined ? { enabled: !!patch.enabled } : {}),
                updatedAt: Date.now(),
            };
            const { next } = settlePersona({ ...inst, incomeEvents: list }, Date.now());
            await api.update(entityId, {
                incomeEvents: list,
                assetBalance: next.assetBalance,
                assetLastSettledAt: next.assetLastSettledAt,
            });
            return list[idx];
        },

        /** 删除一条收入事件。*/
        async removeIncome(eventId, entityType = 'user', entityId) {
            if (!sdk || !eventId || !entityId) return false;
            const api = pickEntityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return false;
            const list = (Array.isArray(inst.incomeEvents) ? inst.incomeEvents : [])
                .filter(e => e.id !== eventId);
            const { next } = settlePersona({ ...inst, incomeEvents: list }, Date.now());
            await api.update(entityId, {
                incomeEvents: list,
                assetBalance: next.assetBalance,
                assetLastSettledAt: next.assetLastSettledAt,
            });
            return true;
        },

        /** 启用 / 停用一条收入事件。*/
        async toggleIncome(eventId, enabled, entityType = 'user', entityId) {
            return await sdk.persona.asset.updateIncome(
                eventId, { enabled: !!enabled }, entityType, entityId,
            );
        },
    };
}

// ============================================
// 工厂
// ============================================

export function createSettingsSdk({ toolkit }) {
    const events = createEventBus();
    const notify = bump(events);

    // ---- 内存缓存（所有 SDK API 都从内存读，CRUD 异步落盘） ----
    const cache = {
        users: new Map(),
        aiPersons: new Map(),
        worlds: new Map(),
        worldGroups: new Map(),
        tagGroups: new Map(),
        tags: new Map(),
        places: new Map(),             // ★ 地点（空间地图容器）
        locations: new Map(),          // ★ 场所（地点下的 pin）
        snapshots: new Map(),
        drafts: new Map(),
        chatMessages: new Map(),        // ★ v0.30 chat-app 真实消息存储
        storyArchives: new Map(),        // ★ v0.42 chat-app 故事存档
        chatFavorites: new Map(),        // ★ v0.43 chat-app 单条收藏
        chatArchiveMessages: new Map(),  // ★ v0.61 chat-app 消息归档(昨天及更早)
        activeUserId: null,
        activeAiId: null,
        activeWorldId: null,
        profileLevel: 'minimal',
        profileOverrides: {},
    };

    const sdk = {
        events,
        weightedPick,

        // 基础实体
        users:     createEntityApi({ toolkit, cache, events, bump: notify, scope: 'users' }),
        aiPersons: createEntityApi({ toolkit, cache, events, bump: notify, scope: 'aiPersons' }),
        worlds:    createEntityApi({ toolkit, cache, events, bump: notify, scope: 'worlds' }),

        // ★ v0.11 世界观组
        worldGroups: createWorldGroupsApi({ toolkit, cache, events, bump: notify }),

        // 标签
        tagGroups: createTagGroupsApi({ toolkit, cache, events, bump: notify }),
        tags:      createTagsApi({ toolkit, cache, events, bump: notify }),

        // 地点 / 场所
        places:    createPlacesApi({ toolkit, cache, events, bump: notify }),   // ★ 地点（箱庭地图容器）
        locations: createLocationsApi({ toolkit, cache, events, bump: notify }), // ★ 场所（地点下的 pin）

        // 快照
        snapshot:       createSnapshotApi({ toolkit, cache, events, bump: notify }),

        // profile
        profile: createProfileApi({ cache, events, bump: notify }),

        // ★ v0.11 时间线 + 草稿
        timelines:   createTimelinesApi({ toolkit, cache, events, bump: notify }),
        drafts:      createDraftsApi({ toolkit, cache, events, bump: notify }),

        // ★ v0.16 时间锚点（段锚点 / 点锚点）
        anchors:     createAnchorsApi({ toolkit, cache, events, bump: notify }),

        // ★ v0.12 纪时系统
        chronology:  createChronologyApi({ cache, toolkit }),

        // 工具
        escape: (value) => escapeHtml(value == null ? '' : String(value)),
        cache,
    };

        // ★ v0.17 人设 SDK：模块开关 / 阶段 / parO / 资源 / 每日计算
        //   必须在对象已经构造好之后挂载，因为 persona 内部要调 sdk.users / .aiPersons
        sdk.persona = bindPersona(sdk);

        // ★ v0.20 资产系统（余额 + 收入事件）
        //   同时也在 toolkit.persona.asset 上挂载一份（installPersonaApis 会覆盖）
        sdk.persona.asset = _createAssetApi(sdk, toolkit);

        // ★ v0.18 人设日记
        sdk.diary = createDiaryApi({ toolkit, cache, events, bump: notify });

        // ★ v0.19 人设日程
        sdk.schedule = createScheduleApi({ toolkit, cache, events, bump: notify });

        // ★ v0.31 每周重复日程
        sdk.weeklySchedule = createWeeklyScheduleApi({ toolkit, cache, events, bump: notify });

        // ★ v0.23 默认用户卡（Murmur / chat 等社媒读取「我」的来源）
        sdk.defaultUserCard = createDefaultUserCardApi({
            cache, events, bump: notify,
            getActiveUser: () => sdk.users.getActive(),
        });
        sdk.defaultUserCard._setToolkit(toolkit);

        // ★ v0.27 chat-app 好友名单:存在 user.socialProfiles.chat.calendarContacts / storyContacts
        //   每个 user 各自绑定各自的 AI 名单,模式独立。
        sdk.chatFriends = chatFriends;

        // ★ v0.33 chat-app 群聊名单:存在 user.socialProfiles.chat.calendarGroups / storyGroups
        //   与 chatFriends 平行的二维列表,同样按 mode 隔离。群聊消息走 chatMessages(conversationType='group')。
        sdk.chatGroups = chatGroups;

        // ★ v0.30 chat-app 真实消息存储
        //   listen_db.chatMessages 表独立存消息,按 (aiPersonId, mode) 拉取,
        //   联系人副本只是 UI 抽象,消息独立持久化(副本被删后仍能恢复)。
        sdk.chatMessages = createChatMessagesApi({ toolkit, cache, events, bump: notify });

        // ★ v0.42 chat-app 故事存档
        //   把某会话的完整消息快照封存下来,可在故事存档页查看/恢复/删除
        //   写入时机:故事存档页 → 「封存当前聊天记录」按钮 → 弹窗填标题/简介 → 调用 add()
        sdk.storyArchives = createStoryArchivesApi({ toolkit, cache, events, bump: notify });

        // ★ v0.43 chat-app 单条收藏(text / image / location / call / game / chat_record)
        //   跟 conversation 级收藏(window.__chatDemoFavorites 内存 demo)区分,
        //   单条收藏持久化到 sdkChatFavorites 表,刷新后仍在
        //   写入时机:消息操作按钮(单条) / 多选条「收藏」按钮
        sdk.chatFavorites = createChatFavoritesApi({ toolkit, cache, events, bump: notify });

        // ★ v0.61 chat-app 消息归档 SDK(2026-08-08 v0.61.4)
        //   把 chatMessages 里「昨天及更早」的消息静默搬到 chatArchiveMessages 表,
        //   私聊/群聊详情页只渲染当天消息;日历/历史/故事存档等页面按需合并读两个表。
        //   - list / listByDate / listByRange / count 同步读 cache
        //   - archive(aiPersonId, mode) 异步,把符合条件的消息搬到 chatArchiveMessages
        //     并从 chatMessages.cache / db 删掉
        //   - 与 storyArchives(sdkStoryArchives)互不干扰,各走各的表
        //   - 后期接 AI SDK 时,prompt-builder 只读 chatMessages 当天消息,
        //     不需要改 archive 链路
        sdk.chatArchive = createChatArchiveApi({
            toolkit, cache, events, bump: notify,
            chatMessages: sdk.chatMessages,
        });

        // ★ v0.61.3 chat-app 「日历概要」SDK
        //   数据挂在 aiPerson.socialProfiles.chat.calendarSummaries[] 顶层数组字段
        //   - add / update / remove / setActive / setOrder 全部走 aiPersons.update 落盘
        //   - list / listActive 同步读 cache
        //   - 占位 AI 生成:buildPlaceholderFromMessages 拼接前 N 条消息文本
        //   后期接真实 AI 时替换 buildPlaceholderFromMessages 即可
        sdk.calendarSummaries = createCalendarSummariesApi(sdk);

        // ★ v0.61.3 chat-app 「故事概要」SDK
        //   数据挂在 aiPerson.socialProfiles.chat.storySummaries[] 顶层数组字段
        //   - 同 calendarSummaries,API 形态完全对齐
        //   - 占位生成:buildPlaceholderFromMessages 拼接故事会话消息
        sdk.storySummaries = createStorySummariesApi(sdk);

// ★ v0.61.3+ chat-app 上下文长度 SDK(原 K 链 SDK 精简版)
//   字段名沿用 rollingConfig(contextRounds)避免迁移老数据;
//   实际只暴露 getRollingConfig / setRollingConfig(写入 contextRounds)
//   K 链相关 API(compressIfNeeded / buildKChainContext / add / clearAll ...)已全部移除
sdk.rollingSummaries = createChatWindowConfigApi(sdk);

        // ★ v0.88 K 链记忆(第二版)—— 滑动窗口 + 迭代式增量压缩
        //   配置(enabled/windowSize/keepVersions)与状态(current/history/lastAt)分开存,
        //   状态再按 mode 分槽,日历和故事互不污染。
        //   本 SDK 只管存;数回合和拼 prompt 在 chat-app 的 services/k-chain-service.js
        //   (那两件事依赖 chat-app 的「回合」口径,放这里就成了跨层依赖)。
        sdk.kChain = createKChainApi(sdk);

        // ★ v0.65 chat-app 「分级记忆系统」SDK
        //   数据挂在 aiPerson.socialProfiles.chat.memoryConfig + memorySummaries 顶层
        //   - 默认层级:L1 日概要(固定) / L2 周概要 / L3 月概要 / L4 年概要
        //   - getConfig / setLevels / addLevel / removeLevel(软删) / updateLevelCycle
        //   - list / listByLevel / listAvailableForLayer / get / add / update / remove(软删)
        //   - setActive / setOrder
        //   - generateLevelSummary(aiPersonId, levelId, opts)  ★ 满 N 消 N 滚动消耗
        //   - buildMemoryContext(aiPersonId) 注入 prompt 用
        //   - validateCycleConstraints(levels) 暴露给 UI 实时校验
        sdk.memorySummaries = createMemorySummariesApi(sdk);

        // ★ v0.61.5 第三方 App Prompt 注册 SDK
        //   - 注册表走内存 Map(sdk.appPrompts._registry),App 卸载时自动清空
        //   - 用户状态走 IndexedDB `appPromptStates` 表(永久保留)
        //   - 音乐 / 天气 / 未来 App 启动时调 sdk.appPrompts.register(...) 注册自家卡片
        //   - prompt-manager 页通过 sdk.appPrompts.list() 拿到所有条目
        //   - 卸载 app 时调 sdk.appPrompts.unregister(appId, promptId) 清内存注册表
        sdk.appPrompts = createAppPromptsApi({ toolkit, cache, events, bump: notify });

        // ★ v0.50 chat-app 回复提示词 SDK
        //   数据挂在 aiPerson.replyPrompts 顶层(深合并友好),无需新表/新 store
        //   - list(aiPersonId) / listActive(aiPersonId) / get / add / update / remove
        //   - toggleActive / setOrder / setActiveIds
        //   - 写入后通过 aiPersons.update 自动派发 events('aiPersons','update')
        //   后期接 AI SDK 时直接调 listActive(aiPersonId) 拿已启用的 prompt 列表
        sdk.replyPrompts = createReplyPromptsApi(sdk);

        // ★ v0.82 chat-app 群聊回复提示词 SDK(公共池模型)
        //   数据挂在 chatGroup.prompts[] 顶层(跟 aiPerson.replyPrompts 平行)
        //   - 区别:私聊 replyPrompts 挂在 AI 人设上(只有 1 个 AI);
        //     群聊 prompts 挂在群聊上(N 个 AI 共享同一份 pool)
        //   - 接口:list(user, groupId, mode) / listActive / get / add / update / remove
        //     / toggleActive / setOrder(都带 user / groupId / mode 三参数)
        //   - 写入后通过 chatGroups.update 自动派发 events('chatGroups','update')
        //   - 用户场景:群聊设置 → 回复提示词 → 加「群氛围 / 角色扮演 / 副本设定」
        //     一类的公告式 prompt,所有群成员 AI 都会看到
        sdk.groupReplyPrompts = createGroupReplyPromptsApi(sdk);
        sdk.nookSdk = { prompts: createNookPromptsApi(sdk) };

        // ★ v0.67 chat-app 资金流水 SDK
        //   - 数据挂在 persona.assetFlow[] 顶层(跟 incomeEvents 平行的数组)
        //   - 写一条流水 = 同步调 persona.asset.adjust 改余额(真实资金流动)
        //   - 钱包页 + 私聊红包/转账都走这条 SDK
        sdk.assetFlow = createAssetFlowApi(sdk);

        // ★ v0.79 chat-app 朋友圈 SDK
        //   - 数据挂在 aiPerson.moments[] 顶层(跟 replyPrompts 平行的数组)
        //   - 每条朋友圈带 content(完整原文) + summary(概要,prompt 注入用)
        //   - buildMomentsContext(aiPersonId, { readCount }) 给 prompt-builder 拼 systemPrompt
        //   - 跟 prompt-builder §v0.79 接入,跟 replyFormatInject 同款注入开关
        sdk.moments = createMomentsApi(sdk);

        // ★ v0.87 群聊记忆互通 SDK(私聊 → 回复提示词注入群聊记忆)
        //   - 数据双层:user.groupMemorySync(总开关 + aiIds 名单) +
        //     aiPerson.groupMemorySyncConfig(单 AI 配置:enabled / contextRounds / summaryReadCount)
        //   - 总开关 + 单 AI 都开启 → 该 AI 私聊 prompt 注入「群聊记忆」段
        //   - listEnabledAiIds(user) → prompt-builder 拿名单 + getAiConfig 拿配置
        //   - 跟 replyPrompts / moments / memorySummaries 完全平行,都是 aiPerson 顶层字段
        sdk.groupMemorySync = createGroupMemorySyncApi(sdk);

        // ★ v0.58 chat-app 拉取 prompt 库 SDK
        //   - 数据源是 settings app 的 Prompt 工程模块(prompt_db 独立库)
        //   - 只读:listLibraries / listLibraryFull / listAllPrompts / getPrompt / getPromptWithPath
        //   - chat-app 在 prompt-manager 底部展示「Prompt 库」section,点「拉取」
        //     把 prompt_db 条目复制成 aiPerson.replyPrompts 一条新记录
        sdk.promptLibrary = createPromptLibraryApi();

        // ★ v0.28 chat-app 顶层 localStorage 快照
        //   - users / aiPersons / worlds 任意 CRUD → 重新构建快照
        //   - defaultUserCard.setDefault → 重新构建快照
        //   - 用户切换 → 重新构建快照
        //   监听器只在 sdk 构造时挂一次,卸载由 settings app 卸载(浏览器关闭)兜底
        const writeChatSnapshot = () => {
            try { saveSnapshot(sdk); } catch (err) {
                console.warn('[settings-sdk] writeChatSnapshot failed', err);
            }
        };
        events.on((evt) => {
            if (!evt || !evt.scope) return;
            // 任何写操作 + 用户切换 + 默认卡切换都触发
            const dirtyScopes = new Set(['users', 'aiPersons', 'worlds', 'sdk']);
            if (dirtyScopes.has(evt.scope) || evt.action === 'setActive' || evt.action === 'import') {
                writeChatSnapshot();
            }
        });
        // 浏览器关闭 / 隐藏时兜底写一次
        const flushOnVisibility = () => writeChatSnapshot();
        if (typeof window !== 'undefined') {
            window.addEventListener('visibilitychange', flushOnVisibility);
        }

        return sdk;
    }

// ============================================
// 单例（settings app 全局）
// ============================================

let _instance = null;
let _readyPromise = null;

export const getSettingsSdk = () => _instance;

export const whenSettingsSdkReady = () => {
    if (_instance) return Promise.resolve(_instance);
    if (_readyPromise) return _readyPromise;
    // 还没启动过 bootstrap，返回一个挂起 promise，直到第一次 setSettingsSdk
    _readyPromise = new Promise((resolve) => {
        if (typeof window === 'undefined') { resolve(null); return; }
        const onReady = () => resolve(_instance);
        window.addEventListener('settings-sdk-ready', onReady, { once: true });
    });
    return _readyPromise;
};

export function setSettingsSdk(sdk) {
    _instance = sdk;
    if (typeof window !== 'undefined') {
        window.settingsSdk = sdk;
        window.dispatchEvent(new CustomEvent('settings-sdk-ready'));
    }
}