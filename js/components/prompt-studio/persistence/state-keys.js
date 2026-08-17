/**
 * prompt-studio / persistence / state-keys.js
 * ------------------------------------------------------------
 * localStorage key 常量集中点(阶段 1 步骤 1.7)
 *
 * 为什么放 prompt-studio:这些 key 是 prompt-studio 内部的持久化,
 * chat-app 业务不应该直接读 / 写 —— 走 prompt-studio 的 state-loaders 间接访问。
 *
 * 注意:**绝对不能改动** key 字符串 —— 老用户已经写过这些 key,
 * 改名 = 数据全丢。
 */

export const STATE_KEYS = {
    /** 拖拽顺序(contextOrder[aiPersonId] = string[] of id) */
    CONTEXT_ORDER: 'xiaoting::chat-context-order-v1',
    /** 「回复格式 + 短句聊天风格」启停开关(replyFormatInject[aiPersonId] = boolean,默认 true) */
    REPLY_FORMAT_INJECT: 'xiaoting::chat-reply-format-inject-v1',
    /** 「AI 表情包库」启停开关(stickerLibraryInject[aiPersonId] = boolean,默认 true) */
    STICKER_LIBRARY_INJECT: 'xiaoting::chat-sticker-library-inject-v1',
    /** 「记忆概要」启停开关(memorySummaryInject[aiPersonId][summaryId] = boolean,默认 true) */
    MEMORY_SUMMARY_INJECT: 'xiaoting::chat-memory-summary-inject-v1',
    /** 「上下文模式」启停开关(contextModeInject[aiPersonId][modeKey] = boolean,默认 true) */
    CONTEXT_MODE_INJECT: 'xiaoting::chat-context-mode-inject-v1',
    /** 卡片 CSS 编辑器覆盖(localStorage 直接以 `${prefix}${appId}::${promptId}` 为 key 存) */
    CARD_CSS_PREFIX: 'xiaoting::prompt-card-css-',
};
