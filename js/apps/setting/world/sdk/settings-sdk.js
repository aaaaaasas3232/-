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
import { createScheduleApi } from './schedule.js';

const bump = (events) => (scope, action, payload) => events.emit({ scope, action, payload });

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

// ★ v0.18 人设日记
        sdk.diary = createDiaryApi({ toolkit, cache, events, bump: notify });

        // ★ v0.19 人设日程
        sdk.schedule = createScheduleApi({ toolkit, cache, events, bump: notify });

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