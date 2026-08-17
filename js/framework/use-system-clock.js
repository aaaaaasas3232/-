/**
 * 小听框架 - 系统时钟（Vue 组合）
 * 提供每秒更新一次的系统时间 ref。
 *
 * 时间文本本身由 utils.getTime() 决定 —— 它可能是现实时间 HH:mm，
 * 也可能是世界观纪时（「辰时」）或带时差的本地时间，取决于用户
 * 在设置里选的显示模式。这里只负责「多久刷一次」。
 */
import { getTime } from './utils.js';

export function useSystemClock() {
    const systemTime = Vue.ref(getTime());
    let timerId = null;

    // 用户在设置里换了时间显示模式（真实 / 纪时 / 时差）时立刻重算一次，
    // 不然要等下一个整秒才变，看着像「点了没反应」。
    const onModeChanged = () => { systemTime.value = getTime(); };

    Vue.onMounted(() => {
        timerId = window.setInterval(() => {
            systemTime.value = getTime();
        }, 1000);
        window.addEventListener('phone:clock-mode-changed', onModeChanged);
    });

    Vue.onBeforeUnmount(() => {
        if (timerId !== null) {
            clearInterval(timerId);
        }
        window.removeEventListener('phone:clock-mode-changed', onModeChanged);
    });

    return { systemTime };
}
