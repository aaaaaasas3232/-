/**
 * settings-sdk · 启动器（bootstrap）
 *
 *   在 settings app 注册时调用一次：
 *     const sdk = await bootstrapSettingsSdk({ toolkit });
 *
 *   行为：
 *     1. 构造 sdk 实例（createSettingsSdk）
 *     2. 顺序 hydrate：users → aiPersons → worlds → worldGroups → tagGroups → tags →
 *        locations → snapshots → profile → drafts
 *     3. 把 sdk 实例挂到 window.settingsSdk + 模块内单例
 *
 *   注意：
 *     - 时间线 / 时间锚点 都嵌在世界实例里，不需要独立 hydrate。
 *     - 创建 settings App 时要在 appConfig.stores 里把 sdkDrafts 表声明进去。
 */

import { createSettingsSdk, setSettingsSdk } from './settings-sdk.js';
import { SYSTEM_TAG_GROUPS } from './defaults.js';
import { installPhoneClockAdapter } from '../chronology-clock.js';

export async function bootstrapSettingsSdk({ toolkit }) {
    // ★ 兼容预热场景：prewarm 调用时没有 toolkit，直接用 window.myDb 构造一个最小化 wrapper
    if (!toolkit || !toolkit.db) {
        console.warn('[bootstrap] 未传入 toolkit，使用 window.myDb 替代');
        if (typeof window !== 'undefined' && window.myDb) {
            toolkit = { db: window.myDb };
        } else {
            console.error('[bootstrap] window.myDb 也不可用，SDK 将无法持久化');
            toolkit = { db: null };
        }
    }

    const sdk = createSettingsSdk({ toolkit });

    // ★ v0.18.1 启动前强制保证 db schema 已升级（处理历史 db 没建新 store 的情况）
    // 注意：toolkit.db 是 createAppDbApi 的闭包，没有 ensureSchema()，必须直接走 window.myDb
    const realDb = typeof window !== 'undefined' ? window.myDb : null;
    if (realDb) {
        try {
            // ★ 修复：确保数据库已打开完成（等待 ready promise）
            if (realDb.ready) {
                await realDb.ready;
            }
            await realDb.ensureSchema?.();

            const afterStores = realDb.db ? Array.from(realDb.db.objectStoreNames || []) : [];
            console.log('[settings-sdk.bootstrap] ensureSchema 后 version=', realDb.db?.version,
                '| stores=', afterStores.length,
                '| store names=', afterStores.slice(0, 10), afterStores.length > 10 ? '...' : '');

            // 验证关键 store 是否存在
            if (afterStores.length > 0) {
                const criticalStores = ['sdkUsers', 'sdkAiPersons', 'sdkWorlds'];
                const missingCritical = criticalStores.filter(s => !afterStores.includes(s));
                if (missingCritical.length > 0) {
                    console.error('[settings-sdk.bootstrap] 严重错误：关键 store 缺失!', missingCritical);
                }
            }
        } catch (err) {
            console.warn('[settings-sdk] ensureSchema 失败', err);
        }
    } else {
        console.warn('[settings-sdk.bootstrap] realDb 不存在');
    }

    // 1. 顺序 hydrate（顺序很重要：user/ai/world 先 → group/tag/geo/snapshot → profile）
    //    单个模块失败（表未声明 / 磁盘异常）只跳过它自己，不能让整条链断掉——
    //    否则后面的 setSettingsSdk / 时钟适配器全都不会执行。
    const step = async (label, fn) => {
        try {
            await fn();
        } catch (err) {
            console.warn(`[settings-sdk.bootstrap] ${label} hydrate 失败，已跳过`, err);
        }
    };

    await step('users', () => sdk.users.hydrate());
    await step('aiPersons', () => sdk.aiPersons.hydrate());
    await step('worlds', () => sdk.worlds.hydrate());
    await step('worldGroups', () => sdk.worldGroups.hydrate());
    await step('tagGroups', () => sdk.tagGroups.hydrate());
    await step('tags', () => sdk.tags.hydrate());
    await step('places', () => sdk.places.hydrate());   // ★ 地点（箱庭地图容器）
    await step('locations', () => sdk.locations.hydrate());
    await step('snapshot', () => sdk.snapshot.hydrate());
    await step('profile', () => sdk.profile.hydrate());
    await step('drafts', () => sdk.drafts.hydrate());
    await step('diary', () => sdk.diary.hydrate());   // ★ v0.18 人设日记
    await step('schedule', () => sdk.schedule.hydrate()); // ★ v0.19 人设日程
    await step('weeklySchedule', () => sdk.weeklySchedule.hydrate()); // ★ v0.31 每周重复日程
    await step('chatMessages', () => sdk.chatMessages.hydrate());   // ★ v0.30 chat-app 真实消息
    await step('chatArchive', () => sdk.chatArchive.hydrate());   // ★ v0.61 chat-app 消息归档
    await step('storyArchives', () => sdk.storyArchives.hydrate());  // ★ v0.42 chat-app 故事存档
    await step('chatFavorites', () => sdk.chatFavorites.hydrate());  // ★ v0.43 chat-app 单条收藏
    await step('appPrompts', () => sdk.appPrompts.hydrate());    // ★ v0.61.5 第三方 App Prompt 用户状态

    // ★ v0.23 旧嵌套 lifePhases / parOs 一次性迁移为顶级独立卡。
    await step('persona.variants.migrateLegacy', () => sdk.persona.variants.migrateLegacy());

    setSettingsSdk(sdk);
    if (typeof window !== 'undefined') {
        window.settingsSdk = sdk;
        window.LISTEN_SYSTEM_TAG_GROUPS = SYSTEM_TAG_GROUPS;
    }

    // 顶部状态栏时间的「纪时 / 时差」适配器。
    // 必须在 window.settingsSdk 就位之后装 —— 适配器是同步的，
    // 装早了第一次格式化会拿不到 sdk（虽然会回落成 HH:mm，但白闪一下）。
    installPhoneClockAdapter();

    return sdk;
}