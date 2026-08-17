/**
 * 点灯 · 长按手势 mixin
 *
 * 卡片里好几处都要「长按这段文字 → 翻译」，逻辑一模一样，抽出来共用。
 *
 * ── 为什么不用第三方手势库 ────────────────────────────────────────
 * 只需要一个判定，但对「和滚动共存」的要求很高。
 * 引一个库进来要处理它自己的 passive / preventDefault 策略，反而更难控。
 *
 * ── 关键取舍 ──────────────────────────────────────────────────────
 *
 * 1. **滑动就取消**。手指移动超过 8px 视为用户在滚页面，立刻放弃长按判定。
 *    不做这一条的话，用户滑动列表时会不停触发翻译。
 *
 * 2. **只在触发那一刻 preventDefault**，不在 pointerdown 时拦。
 *    一上来就拦会把整块区域变成滚不动的死区。
 *
 * 3. **触发后吞掉紧随其后的 click**。长按结束时浏览器还会补一个 click，
 *    不吞的话会顺带把卡片点开 —— 用户长按只想看翻译，不想跳页。
 */

import { LONG_PRESS_MS } from '../constants.js';

export const longPressMixin = {
    data() {
        return { _lpFired: false };
    },
    methods: {
        /**
         * 绑到 @pointerdown 上。
         * @param {PointerEvent} event
         * @param {Function} handler 长按达成时调用
         */
        lpDown(event, handler) {
            this.lpCancel();
            this._lpFired = false;
            this._lpX = event.clientX;
            this._lpY = event.clientY;

            this._lpTimer = setTimeout(() => {
                this._lpTimer = null;
                this._lpFired = true;
                try { navigator.vibrate?.(12); } catch (_) { /* 不支持就算了 */ }
                if (typeof handler === 'function') handler();
            }, LONG_PRESS_MS);
        },

        /** 绑到 @pointermove */
        lpMove(event) {
            if (!this._lpTimer) return;
            if (Math.abs(event.clientX - this._lpX) > 8 || Math.abs(event.clientY - this._lpY) > 8) {
                this.lpCancel();
            }
        },

        /** 绑到 @pointerup / @pointercancel / @pointerleave */
        lpUp() {
            this.lpCancel();
        },

        lpCancel() {
            if (this._lpTimer) {
                clearTimeout(this._lpTimer);
                this._lpTimer = null;
            }
        },

        /**
         * 绑到 @click.capture。长按刚触发过就把这次 click 吞掉。
         * @returns {boolean} true = 已吞掉，调用方应当 return
         */
        lpSwallowClick(event) {
            if (!this._lpFired) return false;
            this._lpFired = false;
            event.stopPropagation();
            event.preventDefault();
            return true;
        },
    },
    beforeUnmount() {
        this.lpCancel();
    },
};

export default longPressMixin;
