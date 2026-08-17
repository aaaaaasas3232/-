/**
 * 顶部状态栏时钟适配器
 * ====================================================================
 * 把「世界观纪时 / 时差」接到手机顶部那个时间上。
 *
 * 为什么要一层适配器，而不是让 framework 直接 import settings-sdk：
 *   framework 是底座，settings 是业务 App。底座反向依赖业务 App 会成环，
 *   而且 settings 没装/没就绪时状态栏必须照样能走。
 *   所以约定一个全局插槽：
 *
 *       window.__phoneClockAdapter = { formatStatusBarTime(date) -> string|null }
 *
 *   framework 的 getTime() 只在这个插槽存在、且返回非空字符串时才用它，
 *   其余情况一律回落到原来的 HH:mm。
 *
 * ★ 必须同步
 *   状态栏每秒调一次 getTime()。格式化过程里任何 await 都来不及，
 *   所以配置走 localStorage（同步读）+ settings-sdk 的内存 cache（同步读）。
 *   这跟灵动岛偏好用 localStorage 是同一个理由（AGENTS2 §9.10）。
 *
 * ★ 显示模式存在哪
 *   localStorage['xiaoting::phone-clock-mode-v1'] = 'real' | 'chronology' | 'offset'
 *   —— 这是「设备级显示偏好」，不是世界观数据，所以不进 IndexedDB。
 *   世界观那边只负责回答「辰时是几点」，不负责「用户想不想看辰时」。
 */

import {
    CLOCK_MODES,
    CLOCK_MODE_STORAGE_KEY,
} from './sdk/chronology/chronology-constants.js';

const VALID_MODES = new Set(Object.values(CLOCK_MODES));

/** 同步读当前显示模式；坏值一律当 real */
export function getClockMode() {
    try {
        const raw = localStorage.getItem(CLOCK_MODE_STORAGE_KEY);
        if (raw && VALID_MODES.has(raw)) return raw;
    } catch (_) { /* 隐私模式下 localStorage 会抛，静默回落 */ }
    return CLOCK_MODES.REAL;
}

/** 写显示模式并立刻让状态栏重算一次（不用等下一秒的 tick） */
export function setClockMode(mode) {
    const next = VALID_MODES.has(mode) ? mode : CLOCK_MODES.REAL;
    try { localStorage.setItem(CLOCK_MODE_STORAGE_KEY, next); } catch (_) {}
    try {
        window.dispatchEvent(new CustomEvent('phone:clock-mode-changed', { detail: { mode: next } }));
    } catch (_) {}
    return next;
}

/**
 * 当前模式下的状态栏时间文本。
 * 任何一步拿不到东西都返回 null，让 framework 用它自己的 HH:mm。
 */
function formatStatusBarTime(date) {
    const mode = getClockMode();
    if (mode === CLOCK_MODES.REAL) return null;

    const chrono = window.settingsSdk?.chronology;
    if (!chrono?.getStatusBarClockText) return null;

    try {
        const text = chrono.getStatusBarClockText(date || new Date(), mode);
        return (typeof text === 'string' && text) ? text : null;
    } catch (err) {
        // 世界观没配好（比如开了纪时但 divisions 是 0）不该把状态栏搞崩
        console.warn('[chronology-clock] formatStatusBarTime failed', err);
        return null;
    }
}

let _installed = false;

/** 装适配器。settings app 启动时调一次即可，重复调用无副作用。 */
export function installPhoneClockAdapter() {
    if (_installed || typeof window === 'undefined') return;
    _installed = true;
    window.__phoneClockAdapter = { formatStatusBarTime, getClockMode, setClockMode };
}
