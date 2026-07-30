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
import {
    computePersonaBalance,
    settlePersona,
    formatAmount,
} from './income-engine.js';
import { getSettingsSdk } from '../world/sdk/settings-sdk.js';

function pickEntityApi(sdk, entityType) {
    return entityType === 'user' ? sdk.users : sdk.aiPersons;
}

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
    if (!toolkit.persona.diary) {
        toolkit.persona.diary = {
            async generate(ctx = {}) {
                return await generateSegments(ctx);
            },
        };
    }
    if (!toolkit.persona.asset) {
        toolkit.persona.asset = {
            /** 读取某个人设当前实际余额（含积欠）。*/
            getBalance(entityType = 'user', entityId) {
                const sdk = getSettingsSdk();
                if (!sdk || !entityId) return 0;
                const inst = pickEntityApi(sdk, entityType).get(entityId);
                if (!inst) return 0;
                const { balance } = computePersonaBalance(inst, Date.now());
                return balance;
            },

            /** 取得人设 + 当前余额 + 货币名（其他 app 展示用）。*/
            snapshot(entityType = 'user', entityId) {
                const sdk = getSettingsSdk();
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
             *  - delta > 0：加；delta < 0：减
             *  - 会先 settle，再覆盖 assetBalance（避免下次结算把差额再算一遍）
             *  - 不允许扣到 < 0
             * 返回新的余额。
             */
            async adjust(delta, note = '', entityType = 'user', entityId) {
                const sdk = getSettingsSdk();
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
                if (typeof toolkit?.island?.notify === 'function') {
                    const sign = delta > 0 ? '+' : '';
                    toolkit.island.notify(
                        delta > 0 ? 'success' : 'warning',
                        `${sign}${formatAmount(delta)}`,
                        `余额 ${formatAmount(newBalance)}${note ? ' · ' + note : ''}`,
                    );
                }
                return newBalance;
            },

            /** 把积欠的定时收入合到余额（一般 adjust 前会自动调用一次；外部手动调也行）。*/
            async settle(entityType = 'user', entityId) {
                const sdk = getSettingsSdk();
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

            /**
             * 添加一条收入事件（其他 app 也可以调用，比如工作 app 给某个人设加一份周薪）。
             *   event: { name, amount, frequency, startDate?, dayOfMonth?, dayOfWeek?, enabled?, source? }
             */
            async addIncome(event = {}, entityType = 'user', entityId) {
                const sdk = getSettingsSdk();
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

            /** 更新一条收入事件。patch: { name?, amount?, frequency?, startDate?, dayOfMonth?, dayOfWeek?, enabled? } */
            async updateIncome(eventId, patch = {}, entityType = 'user', entityId) {
                const sdk = getSettingsSdk();
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
                const sdk = getSettingsSdk();
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
                return await toolkit.persona.asset.updateIncome(
                    eventId, { enabled: !!enabled }, entityType, entityId,
                );
            },
        };
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