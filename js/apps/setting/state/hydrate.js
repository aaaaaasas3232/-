/**
 * 设置 App · 状态 hydrate
 *
 * 把 IndexedDB 里读到的记录规范化、塞进 app.state，并立刻把外观应用到 DOM。
 * 失败回退到默认值。
 *
 * 注意：世界/用户/AI 数据现在由 settings-sdk 管理（worldviews/settings-sdk.js）。
 * 本文件仅处理外观相关的旧数据hydrate，settings-sdk 在 main.js 的 _bootstrapSettingsSdk 里初始化。
 *
 * 外观相关表 / key 在 appearance-general/defaults.js 里。
 */

import {
    applyDeviceTheme,
    initialAppearance,
    APPEARANCE_DB_KEY,
    APPEARANCE_STORE_NAME,
} from '../appearance-general/index.js';
import { deserialize as deserializeStatusBar } from '../appearance-general/phone-statusbar/index.js';
import { DB_KEY, STORE_NAME } from '../defaults.js';

/**
 * 把 IndexedDB 里读到的 device-theme 记录规范化成 state.ui.appearance 的形状。
 * 状态栏字段的缺省 / 类型纠正委托给 phone-statusbar 模块。
 */
function normalizeAppearance(raw) {
    const base = initialAppearance();
    if (!raw || typeof raw !== 'object') return base;
    const statusBar = deserializeStatusBar(raw);
    return {
        ...base,
        ...raw,
        hideCase: Boolean(raw.hideCase),
        ...statusBar,
    };
}

/**
 * 旧的世界/用户/AI normalize（向后兼容）。
 * 这些现在由 settings-sdk 管理，但如果旧数据还在库里，我们尝试读取。
 */
async function tryHydrateLegacyData(db, state) {
    try {
        // 旧表可能有 worldBook / userPersona / aiPersona
        // 如果 settings-sdk 已经接管，这些查询会失败，静默跳过即可
        const [worldRaw, userRaw, aiRaw] = await Promise.all([
            db.get(STORE_NAME.world, DB_KEY.world).catch(() => null),
            db.get(STORE_NAME.user, DB_KEY.user).catch(() => null),
            db.get(STORE_NAME.ai, DB_KEY.ai).catch(() => null),
        ]);

        if (worldRaw) {
            state.ui.world = {
                name: worldRaw.name || '',
                summary: worldRaw.summary || '',
                keyPoints: Array.isArray(worldRaw.keyPoints) ? worldRaw.keyPoints : [],
                timeline: worldRaw.timeline || '',
                notes: worldRaw.notes || '',
            };
            state.draft.worldKeyPointsText = (state.ui.world.keyPoints || []).join('\n');
        }

        if (userRaw) {
            state.ui.user = {
                name: userRaw.name || '',
                pronouns: userRaw.pronouns || '',
                summary: userRaw.summary || '',
                preferences: Array.isArray(userRaw.preferences) ? userRaw.preferences : [],
                notes: userRaw.notes || '',
            };
            state.draft.userPreferencesText = (state.ui.user.preferences || []).join('\n');
        }

        if (aiRaw) {
            state.ui.ai = {
                name: aiRaw.name || '',
                role: aiRaw.role || '',
                tone: aiRaw.tone || '',
                summary: aiRaw.summary || '',
                rules: Array.isArray(aiRaw.rules) ? aiRaw.rules : [],
                notes: aiRaw.notes || '',
            };
            state.draft.aiRulesText = (state.ui.ai.rules || []).join('\n');
        }
    } catch (err) {
        // 旧数据不存在或已迁移，静默跳过
        console.debug('[settings] 旧数据 hydrate 跳过（已迁移到 settings-sdk）');
    }
}

export async function hydrateAll({ toolkit, app }) {
    const db = toolkit.db;
    const state = app.state;

    try {
        // 外观数据仍然通过旧方式 hydrate
        const themeRaw = await db.get(APPEARANCE_STORE_NAME, APPEARANCE_DB_KEY);
        state.ui.appearance = normalizeAppearance(themeRaw);

        // 尝试 hydrate 旧数据（向后兼容）
        await tryHydrateLegacyData(db, state);

        // 用户预设
        const userPresetsRaw = await db.get(APPEARANCE_STORE_NAME, 'caseUserPresets');
        if (userPresetsRaw && Array.isArray(userPresetsRaw.presets)) {
            state.userPresets = userPresetsRaw.presets;
        }
    } catch (err) {
        console.warn('[settings] hydrate 失败，使用默认值', err);
    }

    applyDeviceTheme(state.ui.appearance);
    window.refreshPhoneApps?.();
}