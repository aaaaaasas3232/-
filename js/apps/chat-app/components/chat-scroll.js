/**
 * chat-scroll.js
 *
 * ★ v0.70 抽取自 chat-app/index.js
 *   原来 scrollToBottomWithRetry 是 chat-app/index.js 里的 module-scope 函数,
 *   私聊/群聊初始化时都靠它做"进入页面滚到底" + "消息 append 后滚到底"。
 *   把它独立成模块,emoji-panel 等组件也能 import 用。
 */

/**
 * 真实聊天软件体验:发完一条消息(图片/语音/文字/位置/红包/转账/表情)后,
 * 滚动条必须稳定停在最新一条,不能让用户看到「中间」位置。
 *
 * 难点:消息气泡里的图片/语音波形是异步加载的,
 *      scrollHeight 在加载完后才会变大,所以同步一次 scrollTop 不够。
 *
 * 策略:同步 + requestAnimationFrame(下一帧,等 img 标签 layout 完成)
 *      + 200ms 兜底(等 decode 完成/网络图加载)
 *
 * @param {HTMLElement|null} container 消息滚动容器(.chat-messages)
 */
export function scrollToBottomWithRetry(container) {
    if (!container) return;
    // 1) 同步滚:气泡 append 后立即滚,能解决文字 / sticker / 表情等同步 DOM
    try { container.scrollTop = container.scrollHeight; } catch (_) {}
    // 2) 下一帧再滚:等新加节点的 layout 完成(同步插入的 <img> 此时已有自然高度)
    try {
        requestAnimationFrame(() => {
            try { container.scrollTop = container.scrollHeight; } catch (_) {}
        });
    } catch (_) {}
    // 3) 200ms 兜底:等图片/音频异步加载完后,scrollHeight 才会真正反映最终高度
    setTimeout(() => {
        try { container.scrollTop = container.scrollHeight; } catch (_) {}
    }, 200);
}
