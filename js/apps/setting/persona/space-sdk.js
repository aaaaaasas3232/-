/**
 * Settings App · 人设主页 · 「空间」模块 SDK helper
 *
 * 职责(纯函数,不动 this):
 *   - getAccessibleLocationsForPersona   按 persona 过滤场所(基于 accessNotes.visitors)
 *   - getPlaceWeather                    从天气 App 的 state 拿该地点映射城市的天气
 *   - hourToPhase                        现实小时 → 纪时段名(考虑 hoursRatio)
 *   - currentPhase                       当前现实时间 → 纪时段名 + 段内小时偏移
 *   - isSleepPhase                       判断当前 phase 是否在作息睡眠窗口里
 *   - getCurrentLocationBySchedule       按今日日程命中项返回「现在该在哪」
 *   - getSpatialMappableSummary          一句话汇总「人设 + 世界 + 空间」
 *
 * 所有读取都容错(window.settingsSdk / window.weatherAppState 不可用时返回安全默认值)。
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// 1) 场所访问过滤
// ============================================

/**
 * 取出当前 persona 能去的全部场所(按地点分组)。
 *
 * @param {object} sdk  window.settingsSdk
 * @param {string} worldId
 * @param {string} personaId
 * @param {object} [opts]
 * @param {boolean} [opts.includeRare]  默认 false;true 时把 rarely/never 也纳入
 * @returns {Array<{ place, location, accessConfig, frequencyLabel }>}
 */
export function getAccessibleLocationsForPersona(sdk, worldId, personaId, opts = {}) {
    const out = [];
    if (!sdk || !worldId || !personaId) return out;
    const places = typeof sdk.places?.list === 'function'
        ? sdk.places.list({ worldRef: worldId }) : [];
    const locations = typeof sdk.locations?.list === 'function'
        ? sdk.locations.list({ worldRef: worldId }) : [];
    const placeMap = new Map(places.map(p => [p.id, p]));

    for (const loc of locations) {
        if (!loc) continue;
        const visitors = loc?.accessNotes?.visitors || {};
        const access = visitors[personaId];
        if (!access || !access.enabled) continue;
        const freq = access.frequency || 'sometimes';
        if (!opts.includeRare && (freq === 'rarely' || freq === 'never')) continue;

        const place = loc.placeRef ? placeMap.get(loc.placeRef) : null;
        out.push({
            place,
            location: loc,
            accessConfig: access,
            frequencyLabel: frequencyToLabel(freq),
            frequencyValue: freq,
        });
    }
    // 按地点名 + 场所名升序,便于稳定渲染
    out.sort((a, b) => {
        const an = (a.place?.name || '') + (a.location?.name || '');
        const bn = (b.place?.name || '') + (b.location?.name || '');
        return an.localeCompare(bn, 'zh-Hans-CN');
    });
    return out;
}

export const FREQUENCY_LABELS = Object.freeze({
    always: '总是',
    often: '经常',
    sometimes: '偶尔',
    rarely: '很少',
    never: '从不',
});

export function frequencyToLabel(value) {
    return FREQUENCY_LABELS[value] || '偶尔';
}

// ============================================
// 2) 天气反查
// ============================================

/**
 * 从天气 App 的运行时 state 里,拿某地点映射的真实城市天气快照。
 * weather-app 把 cities[].name 当 weatherCache 的 key,
 * mappedName 仅作显示用,不影响 key。
 *
 * @param {object} weatherAppState  window.weatherAppState
 * @param {object} place  sdk.places.get(placeId)
 * @returns {object|null}
 */
export function getPlaceWeather(weatherAppState, place) {
    if (!weatherAppState || !place?.realCityRef) return null;
    const cache = weatherAppState.weatherCache || {};
    const cityName = place.realCityRef;
    const w = cache[cityName];
    if (!w || w.temperature == null) return null;
    return { ...w, cityName, displayName: place.name };
}

/**
 * 给 AI 用的天气一句话摘要。
 */
export function summarizeWeatherForAI(weather) {
    if (!weather) return '今日天气暂不可用(尚未映射城市或未添加)。';
    return `${weather.cityName}天气: ${weather.description || '晴'}, ${weather.temperature}°C,湿度 ${weather.humidity ?? '--'}%,风力 ${weather.wind ?? '--'} 级`;
}

/**
 * 优先读天气 App 运行时 state(window.weatherAppState);
 * 不可用时回退到同步写盘的 localStorage 镜像 weather-app::cities-v1,
 * 以解决「首次进入设置页时天气 App 还没 hydrate 导致读不到映射」的问题。
 *
 * 返回的 shape 至少包含 { cities, weatherCache }。
 * @returns {object|null}
 */
export function readWeatherAppState() {
    if (typeof window === 'undefined') return null;
    const runtimeState = window.weatherAppState;
    if (runtimeState?.weatherCache && Object.keys(runtimeState.weatherCache).length > 0) {
        return runtimeState;
    }
    try {
        const raw = window.localStorage?.getItem('weather-app::cities-v1');
        if (!raw) return runtimeState || null;
        const persisted = JSON.parse(raw);
        if (!persisted || typeof persisted !== 'object') return runtimeState || null;
        return {
            cities: Array.isArray(persisted.cities) ? persisted.cities : [],
            weatherCache: persisted.weatherCache && typeof persisted.weatherCache === 'object'
                ? persisted.weatherCache
                : {},
        };
    } catch (_) {
        return runtimeState || null;
    }
}

// ============================================
// 3) 纪时换算
// ============================================

/**
 * 把现实小时 0-23 映射成自定义纪时段名 + 段内 0..(hoursRatio.real/hoursRatio.base) 小时偏移。
 *
 * world.chronologySettings:
 *   - customHours: string[]            段名数组(必须)
 *   - hoursRatio: { base: number, real: number }  // 1 时段 = real/base 现实小时
 *
 * 默认: 24 段(每段 1 小时,customHours = ['0时', ..., '23时'])
 *
 * @param {number} hour  现实小时(0-23)
 * @param {object} chronologySettings
 * @returns {{ index: number, name: string, phaseHourOffset: number, totalPhases: number }}
 */
export function hourToPhase(hour, chronologySettings) {
    const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
    if (!chronologySettings?.enabled) {
        return { index: safeHour, name: `${safeHour}时`, phaseHourOffset: 0, totalPhases: 24 };
    }
    const customHours = Array.isArray(chronologySettings.customHours) ? chronologySettings.customHours : [];
    const ratio = chronologySettings.hoursRatio || { base: 24, real: 24 };
    const baseCount = Math.max(1, Number(ratio.base) || customHours.length || 24);
    const realHours = Math.max(1, Number(ratio.real) || 24);
    const phaseWidthHours = realHours / baseCount;
    const totalPhases = customHours.length || baseCount;
    let index = Math.floor(safeHour / phaseWidthHours);
    if (index < 0) index = 0;
    if (index >= totalPhases) index = totalPhases - 1;
    const phaseStartHour = index * phaseWidthHours;
    const phaseHourOffset = safeHour - phaseStartHour;
    const name = customHours[index] || `时段${index}`;
    return { index, name, phaseHourOffset, totalPhases, phaseWidthHours };
}

/**
 * 给定 Date,拿到当前 phase 信息(走 sdk.chronology.realToWorld 更精确;无 SDK 时回退到本地 hourToPhase)。
 */
export function getCurrentPhase(world, now = new Date()) {
    const cfg = world?.chronologySettings;
    const sdk = (typeof window !== 'undefined' ? window.settingsSdk : null);
    if (cfg?.enabled && sdk?.chronology?.realToWorld) {
        try {
            const wt = sdk.chronology.realToWorld(now, world.id);
            if (wt) {
                const worldTimeStr = sdk.chronology.format?.(wt, 'full', world.id) || '';
                return {
                    index: -1,
                    name: worldTimeStr,
                    phaseHourOffset: 0,
                    totalPhases: -1,
                    phaseWidthHours: 0,
                    rawWorldTime: wt,
                    realHour: now.getHours(),
                    realMinute: now.getMinutes(),
                };
            }
        } catch (_) { /* fallthrough */ }
    }
    return {
        ...hourToPhase(now.getHours(), cfg),
        realHour: now.getHours(),
        realMinute: now.getMinutes(),
    };
}

// ============================================
// 4) 「现在该在哪」
// ============================================

/**
 * 根据今日日程返回「现实小时 X 应该所在的场所」。
 * 若 schedule 为空 / 无命中,返回 null。
 */
export function getCurrentLocationBySchedule(todaySchedule, now = new Date()) {
    if (!Array.isArray(todaySchedule) || todaySchedule.length === 0) return null;
    const hour = now.getHours();
    const minute = now.getMinutes();
    const cur = hour * 60 + minute;
    // 优先 fromHour/toHour 是 24h 整数;若无则忽略该段
    const hit = todaySchedule.find(seg => {
        if (seg == null) return false;
        const fromH = Number(seg.fromHour);
        const toH = Number(seg.toHour);
        if (!Number.isFinite(fromH) || !Number.isFinite(toH)) return false;
        const fromMin = fromH * 60;
        const toMin = toH * 60 + 59;
        return cur >= fromMin && cur <= toMin;
    });
    return hit || null;
}

// ============================================
// 5) 睡眠判定(用于 openingDiary 梦境分支)
// ============================================

/**
 * 判断世界时间 phase 是否落在 persona 的作息睡眠窗口里。
 * rhythmEntry: { startTime: 'HH:MM', endTime: 'HH:MM', daysOfWeek?: number[], description?: string }
 *
 * 简化规则:
 *   - 没有 rhythm 或 enabled=false → 永远 false(不视为睡眠)
 *   - 遍历 entries,任一覆盖当前现实时刻 + 当前周索引 → 视为睡眠
 *
 * @param {object} persona  persona.rhythm = { enabled, entries[] }
 * @param {Date}   now
 * @returns {boolean}
 */
export function isSleepPhase(persona, now = new Date()) {
    const rhythm = persona?.rhythm;
    if (!rhythm?.enabled) return false;
    const entries = Array.isArray(rhythm.entries) ? rhythm.entries : [];
    const dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const curMin = now.getHours() * 60 + now.getMinutes();
    return entries.some(e => {
        if (!e?.startTime) return false;
        const matchesDay = !e.daysOfWeek?.length || e.daysOfWeek.includes(dayIdx);
        if (!matchesDay) return false;
        const [sh, sm] = e.startTime.split(':').map(Number);
        const [eh, em] = (e.endTime || e.startTime).split(':').map(Number);
        const startMin = (sh || 0) * 60 + (sm || 0);
        let endMin = (eh || 0) * 60 + (em || 0);
        if (endMin <= startMin) endMin += 24 * 60; // 跨夜
        const cur = curMin < startMin && endMin > 24 * 60 ? curMin + 24 * 60 : curMin;
        return cur >= startMin && cur <= endMin;
    });
}

/**
 // ============================================
// 6) 校验:今日日程 vs 作息 / 本周日程
// ============================================

/**
 * 校验 AI 生成的今日日程是否与作息冲突。
 * 冲突定义:
 *   - 作息条目里某 locationId 在某时段被标记;
 *     AI 把同一时段安排到别的 locationId → conflict
 *   - 注意:作息的 locationId 是可选字段(旧版没有),没填就跳过该条
 *
 * @returns {Array<{ seg, reason }>}
 */
export function validateScheduleAgainstRhythm(todaySchedule, rhythmEntries, locationNameById) {
    const warnings = [];
    if (!Array.isArray(todaySchedule) || !Array.isArray(rhythmEntries)) return warnings;
    for (const seg of todaySchedule) {
        if (seg?.fromHour == null || seg?.toHour == null) continue;
        const fromH = Number(seg.fromHour);
        const toH = Number(seg.toHour);
        const overlap = rhythmEntries.find(r => {
            if (!r?.startTime || !r?.locationId) return false;
            const [sh, sm] = r.startTime.split(':').map(Number);
            const [eh, em] = (r.endTime || r.startTime).split(':').map(Number);
            const rs = (sh || 0) * 60 + (sm || 0);
            let re = (eh || 0) * 60 + (em || 0);
            if (re <= rs) re += 24 * 60;
            const ss = fromH * 60;
            const se = toH * 60;
            const aS = Math.max(rs, ss);
            const aE = Math.min(re, se);
            return aE > aS; // 时段有重叠
        });
        if (overlap && overlap.locationId && overlap.locationId !== seg.locationId) {
            warnings.push({
                seg,
                reason: `AI 把 ${seg.fromHour}-${seg.toHour} 安排在 ${seg.locationName || seg.locationId},
                         但你的作息这段时间指定在 ${locationNameById?.[overlap.locationId] || overlap.locationId}。`,
            });
        }
    }
    return warnings;
}

/**
 * 校验 AI 今日日程与「本周日程」(显式日程事件)是否时间重叠。
 * @param {Array} todaySchedule
 * @param {Array} weeklyEvents  本周日程 events
 */
export function validateScheduleAgainstWeekly(todaySchedule, weeklyEvents) {
    const warnings = [];
    if (!Array.isArray(todaySchedule) || !Array.isArray(weeklyEvents)) return warnings;
    for (const seg of todaySchedule) {
        if (seg?.fromHour == null || seg?.toHour == null) continue;
        const fromMin = Number(seg.fromHour) * 60;
        const toMin = Number(seg.toHour) * 60;
        for (const evt of weeklyEvents) {
            if (!evt?.startTime) continue;
            const [sh, sm] = evt.startTime.split(':').map(Number);
            const [eh, em] = (evt.endTime || evt.startTime).split(':').map(Number);
            const rs = (sh || 0) * 60 + (sm || 0);
            let re = (eh || 0) * 60 + (em || 0);
            if (re <= rs) re += 24 * 60;
            const aS = Math.max(rs, fromMin);
            const aE = Math.min(re, toMin);
            if (aE > aS) {
                warnings.push({
                    seg,
                    reason: `AI 把 ${seg.fromHour}-${seg.toHour} 安排在 ${seg.locationName || seg.locationId},
                             与本周日程「${evt.title}」时间重叠。`,
                });
            }
        }
    }
    return warnings;
}

// ============================================
// 7) 一句话汇总(给灵动岛用)
// ============================================

export function getSpatialSummary(world, persona, todaySchedule) {
    const worldName = world?.name || '未绑定世界';
    const placeCount = 0; // 占位;具体数字由渲染层统计
    const segCount = Array.isArray(todaySchedule) ? todaySchedule.length : 0;
    return `世界:${worldName} · 今日行程 ${segCount} 段`;
}

// ============================================
// 安全默认值(防止 window 不可用时崩)
// ============================================

export function safeEscape(text) {
    return escapeHtml(text == null ? '' : String(text));
}