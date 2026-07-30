/**
 * 小听框架 - 系统时钟（Vue 组合）
 * 提供每秒更新一次的系统时间 ref。
 */
import { getTime } from './utils.js';

export function useSystemClock() {
    const systemTime = Vue.ref(getTime());
    let timerId = null;

    Vue.onMounted(() => {
        timerId = window.setInterval(() => {
            systemTime.value = getTime();
        }, 1000);
    });

    Vue.onBeforeUnmount(() => {
        if (timerId !== null) {
            clearInterval(timerId);
        }
    });

    return { systemTime };
}