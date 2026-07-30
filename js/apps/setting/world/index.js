/**
 * 设置 App · 世界观模块 · 主入口（v0.16）
 *
 * 目录结构：
 *   world/                 — 世界观 UI 层
 *     ├── index.js         — 导出入口
 *     ├── bootstrap.js     — SDK 启动
 *     ├── library.js       — 渲染层
 *     ├── methods.js       — 业务方法
 *     ├── sdk/             — settings-sdk 核心
 *     │   ├── settings-sdk.js
 *     │   ├── bus.js          事件总线
 *     │   ├── defaults.js     数据模型 / 常量 / ID 生成
 *     │   ├── helpers.js      公共工具
 *     │   ├── bootstrap.js    启动器
 *     │   ├── crud.js         通用 CRUD（user / ai / world）
 *     │   ├── tags.js         标签组 + 标签
 *     │   ├── snapshots.js    每日快照 + 加权随机
 *     │   ├── profile.js      profile 模式
 *     │   ├── timelines.js    时间线（personal + world）
 *     │   ├── drafts.js       草稿
 *     │   ├── anchors.js      时间锚点（段锚点 + 点锚点）
 *     │   ├── chronology/     ★ 时间系统（纪时/锚点/时间线）
 *     │   │   ├── index.js
 *     │   │   ├── chronology-api.js
 *     │   │   └── chronology-constants.js
 *     │   └── geo/           ★ 地理系统（地点 / 场所）
 *     │       ├── index.js
 *     │       ├── geo-api.js
 *     │       └── geo-constants.js
 *     ├── sdk/profile-schema.js
 *     └── presets/world-presets.js
 *
 * v0.17 变更：
 *   - 删除 social-accounts.js / feed.js / app-bindings.js（社媒、上下文注入、App 绑定）
 *   - 纪时系统：彻底删除"基周期"/"周"概念，小周期默认代表"日"
 *   - WORLD_FORM_SCHEMA 同步去掉小周期 / 基周期 / 周字段
 *   - DEFAULT_WORLD_INSTANCE 去掉 appBindings / injectionConfig / calendarSettings
 */

// ========== SDK 核心层 ==========

export { createSettingsSdk, getSettingsSdk, setSettingsSdk } from './sdk/settings-sdk.js';
export { bootstrapSettingsSdk } from './sdk/bootstrap.js';

// 数据模型 / 常量
export {
    USER_SCHEMA, AI_SCHEMA, WORLD_SCHEMA,
    VISIBILITY, FIELD_TYPE,
    filterSchemaByMode, getSchema, visibilitySymbol, getRequiredKeys,
} from './sdk/profile-schema.js';

export {
    SYSTEM_TAG_GROUPS, MOOD_PRESETS, REAL_CITIES,
    SDK_STORES, DEFAULT_ACTIVE_USER_ID, DEFAULT_ACTIVE_AI_ID, DEFAULT_ACTIVE_WORLD_ID,
} from './sdk/defaults.js';

// 工具
export { createEventBus } from './sdk/bus.js';
export { weightedPick, localDateKey } from './sdk/snapshots.js';

// CRUD 工厂
export { createEntityApi, createUsersApi } from './sdk/crud.js';
export { createWorldGroupsApi } from './sdk/groups.js';
export { createTagGroupsApi, createTagsApi } from './sdk/tags.js';
export { createSnapshotApi } from './sdk/snapshots.js';
export { createProfileApi } from './sdk/profile.js';

// ★ 时间系统（v0.16）
export { createChronologyApi } from './sdk/chronology/index.js';
export {
    ANCHOR_TYPES,
    TIMELINE_CATEGORIES, TIMELINE_TYPES,
    DEFAULT_ANCHOR,
    DEFAULT_TIMELINE_EVENT,
    DEFAULT_CHRONOLOGY_FALLBACK, DEFAULT_DIVISIONS,
    DEFAULT_12_HOURS, DEFAULT_24_HOURS,
} from './sdk/chronology/index.js';

// ★ 地理系统（地点 / 场所）
export { createPlacesApi, createLocationsApi } from './sdk/geo/index.js';
export {
    DEFAULT_PLACE, DEFAULT_LOCATION, REAL_CITIES,
} from './sdk/geo/index.js';

// 表单 schema 抽象（renderer / reader / schema 常量）
export { renderEditForm } from './sdk/form-renderer.js';
export { readForm } from './sdk/form-reader.js';
export {
    WORLD_GROUP_FORM_SCHEMA,
    TAG_GROUP_FORM_SCHEMA,
    ANCHOR_FORM_SCHEMA,
    TIMELINE_FORM_SCHEMA,
    CHRONICLE_EVENT_FORM_SCHEMA,
    LOCATION_FORM_SCHEMA,
    PLACE_FORM_SCHEMA,
    WORLD_FORM_SCHEMA,
} from './sdk/form-schema.js';

// ========== UI 层 ==========

export { bootstrapWorldSdk, renderWorldLibrary, buildWorldMethods } from './index-ui.js';
export { WORLD_PRESET_CATEGORY_INFO, WORLD_PRESET_TEMPLATES, WORLD_PRESET_CATEGORIES, buildPresetGroupState, createWorldFromPreset } from './presets/world-presets.js';