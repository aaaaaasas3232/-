/**
 * chat-press-sender.js
 *
 * ★ v0.70 抽取自 chat-app/index.js
 *   原来 initPrivateChatInteractions(6836/6857) 和 initGroupChatInteractions(9267/9284)
 *   各自内联了 startPress / endPress + 各种 pointer/touch 事件监听,以及 Enter 键发送。
 *   群聊版本在 startPress 里多了一句 "输入框为空则不响应" 的判断;
 *   私聊长按触发 AI 调用 endPress 里走 _longPressInvokeAi。
 *
 *   抽出来时把这块行为参数化:
 *     - threshold: 长按阈值(私聊 1500ms,群聊 800ms)
 *     - requireTextOnStart: 为 true 时输入框为空不启动长按（现在群聊/私聊都允许空按）
 *     - onShortPress: 短按回调(默认调用传入的 doSend)
 *     - onLongPress: 长按回调；输入框没字时短按也走这条（请对方回一句）
 *
 * 用法:
 *   const { bindEnterToSend, bindPressToSend } = createChatSendHandlers({
 *     sendBtn, messageInput,
 *     threshold: 1500,
 *     requireTextOnStart: false,
 *     doSend: async () => { ... },
 *     onLongPress: async () => { ... },
 *   });
 *   bindEnterToSend();
 *   bindPressToSend();
 */

import { readInputText } from './chat-sender-profile.js';

/**
 * 把 sendBtn 绑成「短按 doSend / 长按 onLongPress / Enter doSend」三合一发送按钮
 *
 * @param {{
 *   sendBtn: HTMLElement|null,
 *   messageInput: HTMLElement|null,
 *   threshold?: number,
 *   requireTextOnStart?: boolean,
 *   doSend: () => Promise<void>|void,
 *   onLongPress?: () => Promise<void>|void,
 *   notifyEmpty?: () => void,
 * }} opts
 * @returns {{
 *   bindEnterToSend: () => void,
 *   bindPressToSend: () => void,
 * }}
 */
export function createChatSendHandlers(opts) {
    const {
        sendBtn,
        messageInput,
        threshold = 1500,
        requireTextOnStart = false,
        doSend,
        onLongPress,
        notifyEmpty,
    } = opts || {};

    if (!sendBtn) {
        // 没按钮也允许 bindEnterToSend
    }

    function _notifyEmpty() {
        if (typeof notifyEmpty === 'function') {
            notifyEmpty();
        } else {
            try {
                window.__phoneIsland?.notify?.('warning', '消息为空', '请先输入内容');
            } catch (_) {}
        }
    }

    function bindEnterToSend() {
        if (!messageInput) return;
        messageInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                ev.preventDefault();
                doSend();
            }
        });
    }

    function bindPressToSend() {
        if (!sendBtn) return;
        const PRESS_THRESHOLD_MS = threshold;
        let pressTimer = null;
        let pressTriggered = false;
        let pressStartTs = 0;
        // ★ v0.67.x 修复:pointer + touch 重复事件触发 → 用 endPressRunning 锁去重
        let endPressRunning = false;
        // ★ BugFix 长按 armed 后松手:pointerup 会在 touchend 之后再触发一次
        //   endPressRunning 锁 0ms 已解锁,会导致走 else 分支误触发 doSend()
        //   这里用一个稍长的"长按消化窗口"吞掉这次重入
        let longPressConsumed = false;
        const LONG_PRESS_CONSUME_MS = 50;

        const startPress = (ev) => {
            const inputText = readInputText(messageInput);
            if (requireTextOnStart && !inputText) return;
            pressTriggered = false;
            longPressConsumed = false; // 新一次按下,重置长按消化标记
            sendBtn.classList.add('is-pressing');
            sendBtn.classList.remove('is-pressing--armed');
            sendBtn.style.setProperty('--press-progress', '0');
            pressStartTs = Date.now();
            sendBtn.style.setProperty('--press-duration', PRESS_THRESHOLD_MS + 'ms');
            pressTimer = setTimeout(() => {
                pressTriggered = true;
                sendBtn.classList.add('is-pressing--armed');
            }, PRESS_THRESHOLD_MS);
            if (typeof ev?.preventDefault === 'function') ev.preventDefault();
            if (typeof ev?.stopPropagation === 'function') ev.stopPropagation();
        };

        const endPress = (ev) => {
            if (endPressRunning) return;
            // ★ BugFix:如果这次松手是长按触发的,标记"已消费"
            //   pointer 系列后续事件(touchend→pointerup 的二次触发)应当被吞掉,
            //   否则会走 else 分支误触发 doSend(),导致长按后再发一条普通消息。
            if (pressTriggered) {
                longPressConsumed = true;
                setTimeout(() => { longPressConsumed = false; }, LONG_PRESS_CONSUME_MS);
            }
            endPressRunning = true;
            setTimeout(() => { endPressRunning = false; }, 0);
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            sendBtn.classList.remove('is-pressing', 'is-pressing--armed');
            sendBtn.style.setProperty('--press-progress', '0');
            const inputText = readInputText(messageInput);
            if (pressTriggered) {
                pressTriggered = false;
                ev?.preventDefault?.();
                ev?.stopPropagation?.();
                if (typeof onLongPress === 'function') {
                    onLongPress();
                }
            } else {
                // ★ BugFix:长按刚刚消费过的 50ms 窗口内,pointer 系列重入事件会被吞掉
                if (longPressConsumed) {
                    return;
                }
                ev?.preventDefault?.();
                ev?.stopPropagation?.();
                if (!inputText) {
                    // 没字也算发送：走长按那条「请对方回一句」的路，不写空气泡
                    if (typeof onLongPress === 'function') {
                        onLongPress();
                        return;
                    }
                    _notifyEmpty();
                    return;
                }
                doSend();
            }
        };

        // ★ v0.67.x:pointerType 区分触摸 / 鼠标,endPressRunning 锁去重
        sendBtn.addEventListener('pointerdown', startPress);
        sendBtn.addEventListener('pointerup', endPress);
        sendBtn.addEventListener('pointercancel', endPress);
        sendBtn.addEventListener('pointerleave', (ev) => {
            if (pressTimer) endPress(ev);
        });
        sendBtn.addEventListener('touchstart', (ev) => {
            // 仅记录触摸路径,不去重;endPressRunning 锁保证 endPress 只跑一次
            startPress(ev);
        }, { passive: true });
        sendBtn.addEventListener('touchend', endPress);
        sendBtn.addEventListener('touchcancel', endPress);
    }

    return { bindEnterToSend, bindPressToSend };
}
