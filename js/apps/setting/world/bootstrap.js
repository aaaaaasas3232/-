/**
 * 世界观模块 · SDK 启动（启动整个 settings-sdk）
 *
 * bootstrapWorldSdk() 异步初始化所有 settings-sdk 数据
 * （包含 users / aiPersons / worlds / tagGroups / tags /
 * locations / snapshot）。
 *
 * UI 层（world/user/ai 各自的 detail 页）都从 window.settingsSdk 读取数据。
 */

import { bootstrapSettingsSdk } from './sdk/bootstrap.js';

export async function bootstrapWorldSdk({ toolkit }) {
    return await bootstrapSettingsSdk({ toolkit });
}
