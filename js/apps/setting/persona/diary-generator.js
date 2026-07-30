/**
 * Settings App · 人设日记生成器
 *
 * 负责生成 ~50 字一段的日记段落；目前先用本地「拼装式」生成，
 * 真实接入 toolkit.persona.diary.generate() 时只需替换 `generateSegments`。
 *
 * 输入 ctx：{ entityType, entityId, mood, date, persona, world }
 * 输出：[{ text, source = 'generated' }]
 *
 * 生成策略（v0.18 占位）：
 *   - 根据 mood 选句式 + 时间戳 + 角色标签
 *   - 每段约 25~50 字（中文）
 *   - 默认 1 段，可一次 roll 多段（用户控制）
 */

import { MOOD_PRESETS, MOOD_LABELS, getMoodIsPositive, getMoodDefaultIntensity } from '@/src/core/mood.js';

export { MOOD_PRESETS, MOOD_LABELS, getMoodIsPositive, getMoodDefaultIntensity };

// 重新导出方便外部使用（兼容旧导入路径）
export { formatDate } from '@/src/core/mood.js';

const TIME_OF_DAY = [
    { start: 5,  end: 9,  label: '清晨' },
    { start: 9,  end: 11, label: '上午' },
    { start: 11, end: 14, label: '中午' },
    { start: 14, end: 18, label: '下午' },
    { start: 18, end: 22, label: '晚上' },
    { start: 22, end: 24, label: '深夜' },
    { start: 0,  end: 5,  label: '凌晨' },
];

export function timeOfDay(now = new Date()) {
    const h = now.getHours();
    return (TIME_OF_DAY.find(t => h >= t.start && h < t.end) || TIME_OF_DAY[0]).label;
}

const MOOD_OPENERS = {
    '开心':    ['今天心情不错', '神清气爽', '有点小兴奋'],
    '平静':    ['平平淡淡的一天', '心很静', '一切如常'],
    '期待':    ['有点期待', '心里想着接下来', '期待一下明天'],
    '专注':    ['专注了一整天', '进入心流', '全神贯注'],
    '小确幸':  ['今天拾到一点小确幸', '被小事治愈', '贪到一点甜'],
    '低落':    ['今天不太在状态', '有点丧', '情绪偏低'],
    '焦虑':    ['有点焦', '放心不下', '心里乱糟糟'],
    '疲惫':    ['身体有点沉', '蠃意袭来', '想要休息'],
};

const MOOD_LINES = {
    '开心':    '事不多但顺心，节奏刚好。',
    '平静':    '没发生什么大事，但也不烦。',
    '期待':    '想好好准备，不让期待落空。',
    '专注':    '时间过得快，什么也没听见。',
    '小确幸':  '一杯热的东西、一点静默，就够了。',
    '低落':    '让自己早一点睡，明天再说。',
    '焦虑':    '深呼吸三次，先把手机放下。',
    '疲惫':    '今天不硬撑了，让身体先休息。',
};

const MOOD_DIARY_TEMPLATES = {
    '开心':    [
        '阳光很好，心情也跟着亮了起来。',
        '今天遇到了些好事，嘴角不自觉上扬。',
        '做啥都顺，感觉世界都对自己温柔了几分。',
    ],
    '平静':    [
        '没有波澜，只有淡淡的安宁。',
        '适合独处，适合发呆，适合慢慢来。',
        '一杯茶，一本书，便是整个下午。',
    ],
    '期待':    [
        '心里有个小火焰在跳动。',
        '等待着，期待着，美好的事情即将发生。',
        '今天格外有干劲，连空气都带着甜味。',
    ],
    '专注':    [
        '世界安静下来，只剩下手头的事。',
        '时间在流逝，但每一刻都被充分利用。',
        '进入心流，外界的喧嚣都与我无关。',
    ],
    '小确幸':  [
        '被微不足道的小事温暖到了。',
        '平凡的日子也有闪闪发光的瞬间。',
        '今天贪到了一点甜，很满足。',
    ],
    '低落':    [
        '今天情绪有点沉，想一个人待着。',
        '什么都不想做，只想安静地发呆。',
        '允许自己低落，明天会好起来的。',
    ],
    '焦虑':    [
        '心里像有只小鹿在横冲直撞。',
        '放心不下，却又不知道在担心什么。',
        '深呼吸，把注意力拉回到当下。',
    ],
    '疲惫':    [
        '身体在叫嚣着需要休息。',
        '今天有点累，允许自己慢一点。',
        '充电中，明天又是新的一天。',
    ],
};

/**
 * 拼接式生成（本地占位）。
 * 返回：长度 ≤ 60 字的一段。
 */
export function composeSegment({ mood = '平静', name = '我', timeLabel = '此刻', world = '' } = {}) {
    const openers = MOOD_OPENERS[mood] || MOOD_OPENERS['平静'];
    const opener = openers[Math.floor(Math.random() * openers.length)];
    const line = MOOD_LINES[mood] || MOOD_LINES['平静'];
    const tail = world ? `（${world}）` : '';
    const text = `${timeLabel}，${opener}。${line}${tail}`;
    // 裁剪到 60 字内
    return text.length > 60 ? text.slice(0, 60) : text;
}

/**
 * 本地生成心情详情（占位实现）
 * 返回：{ mood, moodIntensity, isPositive, diary }
 */
export function composeMoodDetail({ mood = '平静', name = '我' } = {}) {
    const preset = MOOD_PRESETS.find(m => m.label === mood);
    const isPositive = preset ? preset.isPositive : true;
    // 浓度在预设值附近随机波动 ±0.15
    const baseIntensity = preset ? preset.defaultIntensity : 0.5;
    const intensity = Math.max(0.1, Math.min(0.95, baseIntensity + (Math.random() - 0.5) * 0.3));

    const diaryOptions = MOOD_DIARY_TEMPLATES[mood] || MOOD_DIARY_TEMPLATES['平静'];
    const diary = diaryOptions[Math.floor(Math.random() * diaryOptions.length)];

    return {
        mood,
        moodIntensity: Math.round(intensity * 100) / 100,
        isPositive,
        diary,
    };
}

/**
 * 公开 API：toolkit.persona.diary.generate(ctx) 兼容入口。
 * 内部目前走 composeSegment；接入真 AI 后只需替换本函数实现。
 *
 * @param {object} ctx
 * @returns {Promise<Array<{text:string, source?:string}>>}
 */
export async function generateSegments(ctx = {}) {
    const persona = ctx.persona || {};
    const world = ctx.world?.name || '';
    const name = persona.name || (ctx.entityType === 'ai' ? '我' : '我');
    const mood = ctx.mood || '平静';
    const timeLabel = timeOfDay();
    const text = composeSegment({ mood, name, timeLabel, world });
    return [{ text, source: 'generated' }];
}

/**
 * 公开 API：生成心情详情（心情 + 浓度 + 日记）
 * 当没有 AI 可用时，使用本地组合式生成
 *
 * @param {object} ctx - { entityType, entityId, mood, date, persona, world, apiKey? }
 * @returns {Promise<{mood, moodIntensity, isPositive, diary}>}
 */
export async function generateMoodDetail(ctx = {}) {
    const { mood = '平静', persona, world } = ctx;

    // 如果有 AI API，使用真实调用
    if (ctx.apiKey || ctx.apiKeyId) {
        try {
            const detail = await callAiForMoodDetail(ctx);
            if (detail) return detail;
        } catch (err) {
            console.warn('[diary-generator] AI 生成心情失败，使用本地生成', err);
        }
    }

    // 回退到本地生成
    return composeMoodDetail({ mood, name: persona?.name || '我' });
}

/**
 * 调用 AI 生成心情详情
 * 需要有有效的 API 配置
 */
async function callAiForMoodDetail(ctx = {}) {
    // 这个函数需要由外部传入真正的 API 调用逻辑
    // 目前只是占位，由外部的 AI 调用器实现
    if (typeof ctx.onGenerate === 'function') {
        return await ctx.onGenerate(ctx);
    }
    return null;
}
