/**
 * Settings App · 人设主页 API Bridge
 *
 * 把 settingsSdk 的 diary / persona / asset 在 toolkit 上挂一个稳定入口，
 * 这样别的 app（购物 / 聊天 / 工作 ...）可以通过 toolkit.persona.asset.{...} 直接操作人设资产。
 *
 * 用法：
 *   import { installPersonaApis } from './persona/persona-bridge.js';
 *   在 settings app 的 hydrate 完成（settingsSdk 初始化）之后调用 installPersonaApis(toolkit)。
 */

import { generateSegments } from './diary-generator.js';
import { getSettingsSdk } from '../world/sdk/settings-sdk.js';

/**
 * 安装 toolkit.persona.* 的全部 API。
 *  - diary.generate(ctx): 生成日记段落
 *  - asset.getBalance(): 当前余额（含积欠）
 *  - asset.adjust(delta, note?): 增减余额（先 settle，再加 delta）
 *  - asset.settle(): 把积欠合到余额
 *  - asset.addIncome(event): 添加一条收入事件
 *  - asset.updateIncome(eventId, patch): 更新一条收入事件
 *  - asset.removeIncome(eventId): 删除一条收入事件
 *  - asset.toggleIncome(eventId, enabled): 启停收入事件
 * @param {object} toolkit
 */
export function installPersonaApis(toolkit) {
    if (!toolkit) return null;
    if (!toolkit.persona) toolkit.persona = {};

    // diary API
    if (!toolkit.persona.diary) {
        toolkit.persona.diary = {
            async generate(ctx = {}) {
                return await generateSegments(ctx);
            },
        };
    }

    // asset API：直接复用 settingsSdk.persona.asset（已在 sdk 初始化时创建）
    if (!toolkit.persona.asset) {
        const sdk = getSettingsSdk();
        if (sdk?.persona?.asset) {
            toolkit.persona.asset = sdk.persona.asset;
        }
    }

    return toolkit.persona;
}

/**
 * 兼容旧名（不要删除，避免外部已经 import 旧函数的地方炸）
 * @deprecated 用 installPersonaApis 替代
 */
export function installPersonaDiaryApi(toolkit) {
    return installPersonaApis(toolkit);
}