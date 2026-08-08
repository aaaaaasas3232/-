/**
 * 设置 App · 状态 hydrate
 *
 * 把 IndexedDB 里读到的记录规范化、塞进 app.state，并立刻把外观应用到 DOM。
 * 失败回退到默认值。
 *
 * 注意：世界 / 用户 / AI 人设数据现在由 settings-sdk 管理（world/sdk/settings-sdk.js）。
 * 本文件仅处理外观相关的旧数据 hydrate，settings-sdk 在 main.js 的 _bootstrapSettingsSdk 里初始化。
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

export async function hydrateAll({ toolkit, app }) {
    const db = toolkit.db;
    const state = app.state;
    console.log('[settings.hydrate] 开始加载设置数据');

    try {
        // 外观数据 hydrate
        const themeRaw = await db.get(APPEARANCE_STORE_NAME, APPEARANCE_DB_KEY);
        console.log('[settings.hydrate] 加载外观设置:', themeRaw ? JSON.stringify({
            hideCase: themeRaw.hideCase,
            phoneHeight: themeRaw.phoneHeight,
            showStatusBar: themeRaw.showStatusBar,
        }) : 'null');
        state.ui.appearance = normalizeAppearance(themeRaw);

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
    console.log('[settings.hydrate] 加载完成，已应用主题');
}
