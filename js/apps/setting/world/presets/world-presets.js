/**
 * 预设世界观
 *
 * 目前只保留两套做好的体验模式：演员世界、电竞世界。
 * 其他题材留给用户自己从空白世界拓展。
 */

import { AWARD_PRESETS, FESTIVAL_PRESETS as ACTOR_FESTIVALS } from '../../../actor-career/constants.js';
import { TOURNAMENT_PRESETS, FESTIVAL_PRESETS as ESPORTS_FESTIVALS } from '../../../esports-forum/constants.js';
import {
    awardsToRangeAnchors,
    festivalsToPointAnchors,
    tournamentsToRangeAnchors,
    SOURCE_ACTOR,
    SOURCE_ESPORTS,
} from '../sdk/anchor-sync.js';

export const WORLD_PRESET_CATEGORIES = Object.freeze({
    EXPERIENCE: 'experience',
});

export const WORLD_PRESET_CATEGORY_INFO = Object.freeze({
    [WORLD_PRESET_CATEGORIES.EXPERIENCE]: Object.freeze({
        id: WORLD_PRESET_CATEGORIES.EXPERIENCE,
        name: '体验模式',
        icon: '',
        description: '做好的两套世界观，导入后对应专属 App 会出现',
        color: '#0A84FF',
    }),
});

function defaultCurrencies(name, symbol) {
    return [{
        id: 'curr-base',
        name,
        symbol,
        unit: '',
        note: '基准货币',
        exchangeToBase: 1,
        isBase: true,
        order: 0,
    }];
}

export const WORLD_PRESET_TEMPLATES = Object.freeze([
    Object.freeze({
        id: 'preset-actor-world',
        category: WORLD_PRESET_CATEGORIES.EXPERIENCE,
        experienceMode: 'actor',
        name: '演员世界',
        summary: '以试镜、剧组、作品与公众评价为核心的演艺行业世界。演员按 18 线到 1 线分层，越靠近聚光灯中央，机会与风险一起放大。',
        keyPoints: [
            '分线体系：演员从 18 线到 1 线逐级向上，线级决定片酬、资源与舆论关注度',
            '职业路径：上课打磨声台形表 → 试镜 → 进组拍摄 → 上映 → 奖项与晋线',
            '行业角色：演员、导演、制片人、选角导演、经纪人、编剧、娱记、站姐、投资人',
            '作品体系：电视剧、电影、舞台剧、短剧；改编剧本与原创剧本并行',
            '舆论生态：热搜、代拍、黑粉、公关买断黑料是日常；线级越高被全网黑的概率越高',
            '荣誉生态：新人奖到金梧桐奖逐级加冕，颁奖夜与电影节是全行业的固定节点',
            '资金流动：片酬、综艺通告费、代言与奖金是收入；公关费与危机处理是支出',
        ],
        tagRefs: ['现代', '演员', '演艺'],
        color: '#0A84FF',
        currencies: defaultCurrencies('元', '¥'),
        flows: [
            {
                id: 'actor-flow-industry',
                title: '行业规则',
                content: '这个行业按「线」排座次：18 线跑组无门，10 线开始有熟脸，5 线进入当红梯队，1 线是顶流。角色档位（龙套/小配角/重要配角/二番/主角）与演员的演技功底和知名度强相关，越级接主角会被全行业看笑话。试镜看的是声台形表的真功夫，也看咖位是否匹配。',
            },
            {
                id: 'actor-flow-publicity',
                title: '舆论法则',
                content: '树大招风是铁律：无名之辈的黑料没人买，顶流的呼吸都能上热搜。代拍、营销号、黑粉产业链常年运转；公关可以买断一次黑料，但买不断所有的眼睛。艺人的抗压值与人脉决定了一场舆情的最终走向。',
            },
            {
                id: 'actor-flow-anchor',
                title: '行业节点',
                content: '演员评选日给每条线排座次；奖项公布日集中揭晓提名与归属；春晖电影节是一年里最重要的红毯；影迷嘉年华与平台招商会决定下一年的资源流向。奖项从新人风采奖到金梧桐奖逐级加冕，得奖条件由组委会公示。',
            },
        ],
        anchors: [
            ...awardsToRangeAnchors(AWARD_PRESETS, SOURCE_ACTOR),
            ...festivalsToPointAnchors(ACTOR_FESTIVALS, SOURCE_ACTOR),
        ],
    }),
    Object.freeze({
        id: 'preset-esports-world',
        category: WORLD_PRESET_CATEGORIES.EXPERIENCE,
        experienceMode: 'esports',
        name: '电竞世界',
        summary: '电子竞技行业，职业选手、战队、赛事为核心。赛季按四大赛循环，转会窗与颁奖夜是全年固定节点。',
        keyPoints: [
            '职业电竞：选手、教练、领队、经纪人',
            '热门项目：自研战术射击，位置与英雄池决定上场权',
            '赛事体系：春夏两大满贯 + 挑战者杯 + 年度总决赛，中间夹表演赛',
            '俱乐部运营：赞助商、粉丝经济、直播与青训',
            '资金流动：比赛奖金、直播分成、商务是收入；公关与转会是支出',
        ],
        tagRefs: ['现代', '电竞', '游戏'],
        color: '#2563EB',
        currencies: defaultCurrencies('金币', 'G'),
        flows: [
            {
                id: 'esports-flow-season',
                title: '赛季节奏',
                content: '一年从春霖杯开始，经过裂隙挑战者杯、骄阳杯，在岁末巅峰收束。表演赛穿插其间，给替补和粉丝一个看见人的窗口。',
            },
            {
                id: 'esports-flow-transfer',
                title: '转会与合同',
                content: '转会窗开启日合同与流言齐飞。一线选手的身价跟近期赛场表现和商务绑定，青训想上一线得先在闪光赛里证明自己。',
            },
        ],
        anchors: [
            ...tournamentsToRangeAnchors(TOURNAMENT_PRESETS),
            ...festivalsToPointAnchors(ESPORTS_FESTIVALS, SOURCE_ESPORTS),
        ],
    }),
]);

export function getPresetsByCategory(category) {
    return WORLD_PRESET_TEMPLATES.filter((p) => p.category === category);
}

export function getPresetsGroupedByCategory() {
    const result = {};
    for (const category of Object.values(WORLD_PRESET_CATEGORIES)) {
        result[category] = getPresetsByCategory(category);
    }
    return result;
}

export function createWorldFromPreset(presetId) {
    const preset = WORLD_PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return null;

    const t = Date.now();
    return {
        id: `world-${t}`,
        name: preset.name,
        summary: preset.summary,
        experienceMode: preset.experienceMode || 'general',
        keyPoints: [...preset.keyPoints],
        timeline: '',
        notes: `由预设「${preset.name}」创建`,
        tagRefs: [...(preset.tagRefs || [])],
        locations: [],
        flows: Array.isArray(preset.flows) ? preset.flows.map((f) => ({ ...f })) : [],
        timelines: { personal: { user: [] }, world: [] },
        anchors: Array.isArray(preset.anchors) ? preset.anchors.map((a) => ({ ...a })) : [],
        currencies: Array.isArray(preset.currencies) ? preset.currencies.map((c) => ({ ...c })) : [],
        holidays: [],
        eventAggregator: {
            includePersonalEvents: false,
            includedOwners: [],
            visibility: { toUserSelf: true, toOtherUsers: false, toAiPersons: [] },
            showInWorldTimeline: false,
            displayStyle: 'dot',
        },
        createdAt: t,
        updatedAt: t,
        _fromPreset: presetId,
    };
}

export function buildPresetGroupState(presets = WORLD_PRESET_TEMPLATES) {
    const grouped = getPresetsGroupedByCategory();
    const result = [];

    for (const [category, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;
        const info = WORLD_PRESET_CATEGORY_INFO[category];
        result.push({
            id: category,
            name: info.name,
            icon: info.icon,
            description: info.description,
            color: info.color,
            presets: items.map((p) => ({
                id: p.id,
                name: p.name,
                summary: p.summary,
                color: p.color,
                keyPointsCount: p.keyPoints?.length || 0,
                anchorCount: p.anchors?.length || 0,
                locationCount: p.locations?.length || 0,
            })),
        });
    }

    return result;
}
