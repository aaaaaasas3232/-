/**
 * prompt-studio / core / app-group.js
 * ------------------------------------------------------------
 * 按 App 分组的元数据常量(阶段 1 步骤 1.5 辅助)
 *
 * 从 prompt-manager-page.js 原封不动搬过来(来源行号:~1590):
 *   - APP_GROUP_LABELS    常量
 *   - getAppGroupInfo(source) 函数
 *
 * 函数签名 / 行为 0 修改。
 */

const APP_GROUP_LABELS = {
    'nook': { name: 'Nook', icon: '🌿', color: '#7CB342', desc: '当前用户人设 / AI 人设 / 世界观' },
    'murmur': { name: 'Murmur', icon: '💬', color: '#4A6FA5', desc: '当前聊天回合 · 上下文模式 (4 张互斥卡)' },
    'chat': { name: 'Murmur', icon: '💬', color: '#4A6FA5', desc: '当前聊天回合 · 上下文模式 (4 张互斥卡)' },
    'music': { name: '音乐', icon: '🎵', color: '#E91E63', desc: '音乐 App 提供的提示词' },
    'weather': { name: '天气', icon: '�️', color: '#FF9800', desc: '天气 App 提供的提示词' },
    'focus': { name: '专注', icon: '⏱️', color: '#9C27B0', desc: '专注 App 提供的提示词' },
    'gallery': { name: '图库', icon: '🖼️', color: '#2196F3', desc: '图库 App 提供的提示词' },
    'default': { name: '其他', icon: '📦', color: '#607D8B', desc: '其他 App' },
};

/**
 * 获取某 source 的展示元数据
 * @param {string} source  'nook' | 'murmur' | 'music' | 'weather' | ...
 * @returns {object}
 */
export function getAppGroupInfo(source) {
    return APP_GROUP_LABELS[source] || { ...APP_GROUP_LABELS['default'], name: source || '其他' };
}
