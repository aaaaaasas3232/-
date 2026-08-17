/**
 * 氧气 · 电池桥（settings / nook 的受控接口）
 *
 * 氧气永远不直接写 deviceSettings 表，也不 import settings 内部模块 ——
 * 一切走 `externalAppRegistry.invokeService('settings', ...)`：
 *
 *   batteryGetState()               → { capacity:0~1, bound:boolean }
 *   batteryBind()                   → 绑定并把电量置满
 *   batteryUnbind()                 → 解绑（电量停在解绑瞬间的值）
 *   batterySetCapacity({value,low}) → 绑定期间由氧气写电量；low 时电池填充临时变红
 *
 * `invokeService` 找不到 App 或方法时返回 Promise.resolve(null) 不抛，
 * 所以这里必须处理「对方不在」——返回 null，调用方自己兜底。
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';

const SETTINGS_APP = 'settings';

async function call(name, payload) {
    try {
        return await externalAppRegistry.invokeService(SETTINGS_APP, name, payload);
    } catch (err) {
        console.warn(`[blog] 电池桥 ${name} 调用失败`, err);
        return null;
    }
}

export function getBatteryState() {
    return call('batteryGetState');
}

export function bindBattery() {
    return call('batteryBind', { sourceApp: 'blog' });
}

export function unbindBattery() {
    return call('batteryUnbind', { sourceApp: 'blog' });
}

/** @param {number} value 0~1 @param {boolean} low 低氧时电池填充临时变红 */
export function setBatteryCapacity(value, low = false) {
    return call('batterySetCapacity', { sourceApp: 'blog', value, low });
}

/**
 * 等桥就绪再调（关机彩蛋结束时 settings 可能还在注册流程里）。
 * 轮询最多 waitMs，成功一次就返回。
 */
export async function setBatteryCapacityWhenReady(value, low = false, waitMs = 10000) {
    const startedAt = Date.now();
    /* eslint-disable no-await-in-loop */
    while (Date.now() - startedAt < waitMs) {
        const result = await setBatteryCapacity(value, low);
        if (result && result.ok) return result;
        await new Promise((r) => setTimeout(r, 400));
    }
    /* eslint-enable no-await-in-loop */
    return null;
}
