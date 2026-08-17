/**
 * settings-sdk · 纪时系统（Chronology System）v0.17
 *
 * 核心理念：
 *   不同世界观的时间单位可以不同（如"年/月/日"或"纪/章/日"）。
 *
 * 时间单位层级（v0.17，已彻底移除"周/基周期"）：
 *   - 大周期（年）：最大循环单位，用户自定义名称（如"纪"、"元"、"年"）
 *   - 中周期（月）：中间循环单位，用户自定义名称
 *   - 小周期（日）：较小循环单位（v0.17 后默认指"日"，原"周"被删除）
 *   - 微周期（时）：小周期内部的细分循环（如 1 日 = 24 时辰）
 *   - 瞬周期（分秒）：最小时间颗粒
 *
 * 用法示例：
 *   const chrono = createChronologyApi({ cache, toolkit });
 *   const worldTime = chrono.realToWorld(new Date());  // 现实→世界
 *   const realTime = chrono.worldToReal({ year: 5, month: 3 }); // 世界→现实
 *   const formatted = chrono.format(worldTime, 'full');  // 格式化输出
 *
 * v0.16 新增：
 *   - createChronologyAnchor：抽象接口，由各 App（人物、地点、社媒）自行定义锚点
 *     存到自己的 store；具体实现在 settings-sdk/anchors.js。
 */

import { uniqueId } from '../defaults.js';
import {
    DEFAULT_CHRONOLOGY_FALLBACK,
    DEFAULT_DIVISIONS,
    DEFAULT_12_HOURS,
    DEFAULT_24_HOURS,
} from './chronology-constants.js';

export function createChronologyApi({ cache, toolkit }) {

    const getChronologyConfig = (worldId) => {
        // ⚠️ 这里原来写的是 `cache.worlds.getActive()` —— cache.worlds 是一个裸 Map，
        //    Map 没有 getActive()，不传 worldId 调用会直接 TypeError。
        //    「当前世界观」在 cache 里是 cache.activeWorldId（getActive 是
        //    sdk.worlds 那层的方法，不是 cache 那层的）。
        const world = worldId
            ? cache.worlds.get(worldId)
            : cache.worlds.get(cache.activeWorldId);
        if (!world) return null;
        return {
            ...DEFAULT_CHRONOLOGY_FALLBACK,
            ...(world.chronologySettings || {}),
        };
    };

    const getBaseYear = (worldId) => getChronologyConfig(worldId)?.baseYear ?? 2000;

    // ============================================
    // 核心转换算法（v0.17：去掉周/基周期，只保留 大/中/日/时/分/秒）
    // ============================================

    const realToWorld = (realDate, worldId) => {
        const cfg = getChronologyConfig(worldId);
        if (!cfg?.enabled) {
            const d = realDate instanceof Date ? realDate : new Date(realDate);
            return {
                year: d.getFullYear(),
                month: d.getMonth() + 1,
                day: d.getDate(),
                hour: d.getHours(),
                minute: d.getMinutes(),
                second: d.getSeconds(),
                worldDateStr: d.toISOString().slice(0, 10),
            };
        }

        const d = realDate instanceof Date ? realDate : new Date(realDate);
        const baseYear = cfg.baseYear || 2000;
        const diffDays = (d.getTime() - new Date(baseYear, 0, 1).getTime()) / 86400000;
        const divisions = getDivisions(cfg);

        const worldDays = diffDays;
        const totalHours = worldDays * divisions.day;
        const totalMinutes = totalHours * divisions.hour;
        const totalSeconds = totalMinutes * divisions.minute;
        const totalMonths = worldDays / divisions.month;
        const totalYears = totalMonths / divisions.year;

        const worldYear = Math.floor(totalYears);
        const remainderMonths = totalMonths % divisions.year;
        const worldMonth = Math.floor(remainderMonths) + 1;
        const remainderDays = remainderMonths % 1 * divisions.month;
        const worldDay = Math.floor(remainderDays) + 1;
        const remainderHours = remainderDays % 1 * divisions.day;
        const worldHour = Math.floor(remainderHours);
        const remainderMinutes = remainderHours % 1 * divisions.hour;
        const worldMinute = Math.floor(remainderMinutes);
        const worldSecond = Math.floor(remainderMinutes % 1 * divisions.minute);

        return {
            year: worldYear,
            month: worldMonth,
            day: worldDay,
            hour: worldHour,
            minute: worldMinute,
            second: worldSecond,
            divisions,
            worldDateStr: `${worldYear}-${String(worldMonth).padStart(2, '0')}-${String(worldDay).padStart(2, '0')}`,
        };
    };

    const worldToReal = (worldTime, worldId) => {
        const cfg = getChronologyConfig(worldId);
        if (!cfg?.enabled) {
            return new Date(
                worldTime.year || new Date().getFullYear(),
                (worldTime.month || 1) - 1,
                worldTime.day || 1,
                worldTime.hour || 0,
                worldTime.minute || 0
            );
        }

        const divisions = getDivisions(cfg);
        const totalYears = worldTime.year || 0;
        const totalMonths = totalYears * divisions.year + (worldTime.month || 1) - 1;
        const totalDays = totalMonths * divisions.month + (worldTime.day || 1) - 1;
        const totalHours = totalDays * divisions.day + (worldTime.hour || 0);
        const totalMinutes = totalHours * divisions.hour + (worldTime.minute || 0);

        const realDays = totalDays;
        const baseYear = cfg.baseYear || 2000;
        const realDate = new Date(baseYear, 0, 1);
        realDate.setDate(realDate.getDate() + Math.floor(realDays));
        realDate.setHours(Math.floor((realDays % 1) * 24));
        realDate.setMinutes(Math.floor(((realDays % 1) * 24 % 1) * 60));

        return realDate;
    };

    const getDivisions = (cfg) => ({
        year: cfg.yearDivisions || DEFAULT_DIVISIONS.year,
        month: cfg.monthDivisions || DEFAULT_DIVISIONS.month,
        day: cfg.dayDivisions || DEFAULT_DIVISIONS.day,
        hour: cfg.hourDivisions || DEFAULT_DIVISIONS.hour,
        minute: cfg.minuteDivisions || DEFAULT_DIVISIONS.minute,
    });

    // ============================================
    // 格式化（v0.17：去掉周、基周期；只显示 大/中/日）
    // ============================================

    const format = (worldTime, formatType = 'full', worldId) => {
        const cfg = getChronologyConfig(worldId);
        const labels = {
            year: cfg?.yearLabel || '年',
            month: cfg?.monthLabel || '月',
            day: cfg?.dayLabel || '日',
            hour: cfg?.hourLabel || '时',
        };
        const cyclePrefix = (name, n, label) => name ? `${name}${n}${label}` : `${n}${label}`;

        const { year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0 } = worldTime;
        const hourName = getHourName(hour, cfg);

        switch (formatType) {
            case 'date': return `${cyclePrefix(cfg?.largeCycleName, year, labels.year)}${cyclePrefix(cfg?.mediumCycleName, month, labels.month)}${cyclePrefix(cfg?.smallCycleName, day, labels.day)}`;
            case 'time': return `${hourName}${minute}分${second}秒`;
            case 'short': return `${cyclePrefix(cfg?.largeCycleName, year, labels.year)}${cyclePrefix(cfg?.mediumCycleName, month, labels.month)}`;
            case 'verbose': return `${cyclePrefix(cfg?.largeCycleName, year, labels.year)}${cyclePrefix(cfg?.mediumCycleName, month, labels.month)}${cyclePrefix(cfg?.smallCycleName, day, labels.day)} ${hourName}${minute}分${second}秒`;
            default: return `${cyclePrefix(cfg?.largeCycleName, year, labels.year)}${cyclePrefix(cfg?.mediumCycleName, month, labels.month)}${cyclePrefix(cfg?.smallCycleName, day, labels.day)} ${hourName}${minute}分`;
        }
    };

    const getHourName = (hour, cfg) => {
        const customHours = cfg?.customHours || [];
        if (customHours.length > 0) {
            const divisions = getDivisions(cfg);
            if (divisions.day === 12) {
                return customHours[Math.floor((hour + 1) / 2) % 12] || `时辰${hour}`;
            }
            return customHours[Math.floor(hour / (24 / customHours.length)) % customHours.length] || `${hour}时`;
        }
        const divisions = getDivisions(cfg);
        if (divisions.day === 12) {
            return DEFAULT_12_HOURS[Math.floor((hour + 1) / 2) % 12] || `时辰${hour}`;
        }
        return `${hour}时`;
    };

    const getHourNames = (worldId) => {
        const cfg = getChronologyConfig(worldId);
        const divisions = getDivisions(cfg);
        const customHours = cfg?.customHours || [];
        if (customHours.length > 0) return customHours;
        if (divisions.day === 12) return DEFAULT_12_HOURS;
        return DEFAULT_24_HOURS;
    };

    // ============================================
    // 摘要（v0.17：去掉周/基周期）
    // ============================================

    const getChronologySummary = (worldId) => {
        const cfg = getChronologyConfig(worldId);
        if (!cfg?.enabled) return null;

        const divisions = getDivisions(cfg);
        const customHours = cfg?.customHours || [];
        return {
            baseYear: cfg.baseYear,
            cycleNames: {
                large: cfg.largeCycleName,
                medium: cfg.mediumCycleName,
                small: cfg.smallCycleName,  // 小周期 = 日
            },
            unitLabels: {
                year: cfg.yearLabel,
                month: cfg.monthLabel,
                day: cfg.dayLabel,
                hour: cfg.hourLabel,
            },
            hourSystem: customHours.length > 0
                ? { type: 'custom', names: customHours }
                : { type: divisions.day === 12 ? '12时辰' : '24小时' },
            note: `基准年 ${cfg.baseYear} = 世界观 ${cfg.largeCycleName || ''}0${cfg.yearLabel}`,
        };
    };

    // ============================================
    // 时差系统（2026-08-13）
    // ============================================
    //
    // 和纪时映射是两套并行的东西：
    //   · 纪时映射 = 用户和 AI 在两个世界，时间单位都不一样（12:33 → 辰时）
    //   · 时差     = 用户和 AI 在同一个世界的不同地区，单位一样只差钟点
    //
    // 两个都开时的组合顺序是「先算时差、再套纪时」：时差决定「几点」，
    // 纪时决定「这个点叫什么」。反过来做的话，跨日边界会算错。

    const getTimeOffsetConfig = (worldId) => {
        const cfg = getChronologyConfig(worldId);
        if (!cfg) return null;
        return {
            enabled: !!cfg.timeOffsetEnabled,
            userRegionName: cfg.userRegionName || '',
            userOffsetHours: Number(cfg.userOffsetHours) || 0,
            aiRegionName: cfg.aiRegionName || '',
            aiOffsetHours: Number(cfg.aiOffsetHours) || 0,
        };
    };

    /**
     * 某个 AI 的时差（小时）。
     * 优先读 aiPerson.chronologyOffsetHours（per-AI 覆盖），
     * 没有就用世界观里的 aiOffsetHours。
     */
    const getAiOffsetHours = (aiPersonId, worldId) => {
        const off = getTimeOffsetConfig(worldId);
        if (!off?.enabled) return 0;
        if (aiPersonId) {
            try {
                const ai = cache.aiPersons?.get?.(aiPersonId);
                const own = ai?.chronologyOffsetHours;
                if (own !== undefined && own !== null && own !== '') return Number(own) || 0;
            } catch (_) { /* AI 不存在就走世界观默认值 */ }
        }
        return off.aiOffsetHours;
    };

    const getAiRegionName = (aiPersonId, worldId) => {
        const off = getTimeOffsetConfig(worldId);
        if (!off?.enabled) return '';
        if (aiPersonId) {
            try {
                const ai = cache.aiPersons?.get?.(aiPersonId);
                if (ai?.chronologyRegionName) return String(ai.chronologyRegionName);
            } catch (_) { /* 同上 */ }
        }
        return off.aiRegionName;
    };

    /** 把现实时间按 offsetHours 平移，返回一个新的 Date（不改入参） */
    const shiftByHours = (date, hours) => {
        const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
        if (!hours) return d;
        d.setTime(d.getTime() + hours * 3600000);
        return d;
    };

    const getUserLocalDate = (realDate, worldId) => {
        const off = getTimeOffsetConfig(worldId);
        if (!off?.enabled) return realDate instanceof Date ? realDate : new Date(realDate);
        return shiftByHours(realDate, off.userOffsetHours);
    };

    const getAiLocalDate = (aiPersonId, realDate, worldId) => {
        const off = getTimeOffsetConfig(worldId);
        if (!off?.enabled) return realDate instanceof Date ? realDate : new Date(realDate);
        return shiftByHours(realDate, getAiOffsetHours(aiPersonId, worldId));
    };

    // ============================================
    // 时钟文本（给状态栏 / 聊天头 / prompt 用）
    // ============================================

    const pad2 = (n) => String(n).padStart(2, '0');

    /**
     * 把一个 Date 渲染成「这个世界里的钟点文字」。
     *   mode='real'       → 12:33
     *   mode='offset'     → 12:33（已经平移过的本地时间）
     *   mode='chronology' → 辰时 / 5时 …（走 getHourName）
     *
     * 纪时模式下如果世界观没开 enabled，会自动退回 HH:mm —— 不然用户
     * 打开开关却什么都没配，状态栏会显示一串奇怪的东西。
     */
    const formatClockText = (date, mode, worldId) => {
        const d = date instanceof Date ? date : new Date(date);
        if (mode === 'chronology') {
            const cfg = getChronologyConfig(worldId);
            if (cfg?.enabled) {
                const world = realToWorld(d, worldId);
                return getHourName(world.hour, cfg);
            }
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    };

    /** 状态栏用：按 mode 算出用户视角的时间文本 */
    const getStatusBarClockText = (realDate, mode, worldId) => {
        const d = realDate instanceof Date ? realDate : new Date(realDate);
        if (mode === 'offset') {
            return formatClockText(getUserLocalDate(d, worldId), 'real', worldId);
        }
        if (mode === 'chronology') {
            // 时差也开着的话，先平移到用户所在地再映射纪时
            return formatClockText(getUserLocalDate(d, worldId), 'chronology', worldId);
        }
        return formatClockText(d, 'real', worldId);
    };

    /**
     * 给 prompt 用的一段「现在几点」说明。
     * 只有开了纪时或时差才返回内容，两个都没开返回空串
     * （空串的话调用方就不要往 prompt 里塞这一段）。
     */
    const getTimeContextForPrompt = (aiPersonId, realDate, worldId) => {
        const d = realDate instanceof Date ? realDate : new Date(realDate || Date.now());
        const cfg = getChronologyConfig(worldId);
        const off = getTimeOffsetConfig(worldId);
        const lines = [];

        if (off?.enabled) {
            const userD = getUserLocalDate(d, worldId);
            const aiD = getAiLocalDate(aiPersonId, d, worldId);
            const aiRegion = getAiRegionName(aiPersonId, worldId) || 'AI 所在地';
            const userRegion = off.userRegionName || '用户所在地';
            const diff = getAiOffsetHours(aiPersonId, worldId) - off.userOffsetHours;
            lines.push(`- 你在${aiRegion}，现在是 ${pad2(aiD.getHours())}:${pad2(aiD.getMinutes())}。`);
            lines.push(`- 用户在${userRegion}，那边现在是 ${pad2(userD.getHours())}:${pad2(userD.getMinutes())}。`);
            if (diff !== 0) {
                lines.push(`- 两地时差 ${diff > 0 ? '+' : ''}${diff} 小时（你比对方${diff > 0 ? '快' : '慢'} ${Math.abs(diff)} 小时），说时间时要按各自当地的钟点讲。`);
            }
        }

        if (cfg?.enabled) {
            const base = off?.enabled ? getAiLocalDate(aiPersonId, d, worldId) : d;
            const world = realToWorld(base, worldId);
            lines.push(`- 这个世界的纪时：${format(world, 'default', worldId)}。`);
            lines.push('- 提到时间时用世界观的纪时说法，不要说“下午三点”这种现实说法。');
        }

        return lines.length ? lines.join('\n') : '';
    };

    // ============================================
    // 锚点（抽象，由各模块自行实现）
    // ============================================

    const createChronologyAnchor = (worldId, worldTime, label, description) => {
        const realDate = worldToReal(worldTime, worldId);
        return {
            id: uniqueId('anchor'),
            worldRef: worldId,
            label: label || `时间锚点`,
            description: description || '',
            worldTime: { ...worldTime },
            realDate: realDate.toISOString(),
            createdAt: Date.now(),
        };
    };

    return {
        getChronologyConfig,
        getBaseYear,
        realToWorld,
        worldToReal,
        format,
        getHourName,
        getHourNames,
        getChronologySummary,
        createChronologyAnchor,
        // 时差系统
        getTimeOffsetConfig,
        getAiOffsetHours,
        getAiRegionName,
        getUserLocalDate,
        getAiLocalDate,
        // 时钟文本
        formatClockText,
        getStatusBarClockText,
        getTimeContextForPrompt,
    };
}