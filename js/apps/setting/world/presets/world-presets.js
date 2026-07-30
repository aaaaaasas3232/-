/**
 * 预设世界观组（World Preset Groups）
 *
 * 用于快速创建和管理预设世界观。
 * 每个预设组包含：
 *   - 元信息（名称、图标、描述）
 *   - 预设数据（可一键导入到用户的世界观库）
 *
 * 结构：
 *   现代组 → 爱豆世界、电竞世界、校园世界...
 *   古代组 → 武侠世界、宫廷世界...
 *   玄幻组 → 修仙世界、魔法世界...
 *   架空组 → 赛博世界、末日世界...
 */

export const WORLD_PRESET_CATEGORIES = Object.freeze({
    MODERN: 'modern',
    ANCIENT: 'ancient',
    FANTASY: 'fantasy',
    CUSTOM: 'custom',
});

export const WORLD_PRESET_CATEGORY_INFO = Object.freeze({
    [WORLD_PRESET_CATEGORIES.MODERN]: Object.freeze({
        id: WORLD_PRESET_CATEGORIES.MODERN,
        name: '现代组',
        icon: '🏙️',
        description: '贴近现实的世界观',
        color: '#0A84FF',
    }),
    [WORLD_PRESET_CATEGORIES.ANCIENT]: Object.freeze({
        id: WORLD_PRESET_CATEGORIES.ANCIENT,
        name: '古代组',
        icon: '🏯',
        description: '历史或架空古代背景',
        color: '#FF9500',
    }),
    [WORLD_PRESET_CATEGORIES.FANTASY]: Object.freeze({
        id: WORLD_PRESET_CATEGORIES.FANTASY,
        name: '玄幻组',
        icon: '✨',
        description: '修仙、魔法等超自然元素',
        color: '#AF52DE',
    }),
    [WORLD_PRESET_CATEGORIES.CUSTOM]: Object.freeze({
        id: WORLD_PRESET_CATEGORIES.CUSTOM,
        name: '架空组',
        icon: '🌌',
        description: '赛博、末日、科幻等虚构设定',
        color: '#30D158',
    }),
});

/**
 * 预设世界观模板
 */
export const WORLD_PRESET_TEMPLATES = Object.freeze([
    // ========== 现代组 ==========
    Object.freeze({
        id: 'preset-idol-world',
        category: WORLD_PRESET_CATEGORIES.MODERN,
        name: '爱豆世界',
        summary: '娱乐圈背景，偶像、粉丝、经纪公司构成的世界',
        keyPoints: [
            '娱乐圈生态：偶像练习生、出道、成团、solo发展',
            '粉丝文化：打榜、控评、反黑、应援',
            '经纪公司：三大、社方、中小厂牌',
            '媒体生态：娱乐新闻、综艺、影视',
        ],
        tagRefs: ['现代', '娱乐圈', '偶像'],
        icon: '🎤',
        color: '#EC4899',
    }),
    Object.freeze({
        id: 'preset-esports-world',
        category: WORLD_PRESET_CATEGORIES.MODERN,
        name: '电竞世界',
        summary: '电子竞技行业，职业选手、战队、赛事为核心',
        keyPoints: [
            '职业电竞：选手、教练、领队、经纪人',
            '热门项目：LOL、DOTA2、CSGO、PUBG、王者荣耀',
            '赛事体系：世界赛、联赛、杯赛',
            '俱乐部运营：赞助商、粉丝经济、直播',
        ],
        tagRefs: ['现代', '电竞', '游戏'],
        icon: '🎮',
        color: '#6366F1',
    }),
    Object.freeze({
        id: 'preset-campus-world',
        category: WORLD_PRESET_CATEGORIES.MODERN,
        name: '校园世界',
        summary: '学校生活，同学、老师、考试构成日常',
        keyPoints: [
            '学生类型：学霸、学渣、校草/校花',
            '社团活动：学生会、兴趣社团、体育队',
            '师生关系：严师、朋友、对手',
            '校园事件：考试、运动会、文艺汇演',
        ],
        tagRefs: ['现代', '校园', '青春'],
        icon: '📚',
        color: '#10B981',
    }),

    // ========== 古代组 ==========
    Object.freeze({
        id: 'preset-wuxia-world',
        category: WORLD_PRESET_CATEGORIES.ANCIENT,
        name: '武侠世界',
        summary: '江湖侠客，刀光剑影，快意恩仇',
        keyPoints: [
            '江湖门派：少林、武当、峨眉、五岳剑派',
            '武功秘籍：内功、外功、轻功、阵法',
            '人物身份：掌门、弟子、散修、魔头',
            '江湖规矩：武林盟主、正邪对立、门派恩怨',
        ],
        tagRefs: ['古代', '武侠', '江湖'],
        icon: '⚔️',
        color: '#DC2626',
    }),
    Object.freeze({
        id: 'preset-palace-world',
        category: WORLD_PRESET_CATEGORIES.ANCIENT,
        name: '宫廷世界',
        summary: '皇宫深院，权谋争斗，后宫风云',
        keyPoints: [
            '皇室体系：皇帝、太后、皇子、公主',
            '后宫格局：皇后、贵妃、嫔妃、宫女',
            '朝堂势力：文官、武将、宦官、外戚',
            '经典主题：夺嫡、宫斗、联姻、造反',
        ],
        tagRefs: ['古代', '宫廷', '权谋'],
        icon: '👑',
        color: '#B91C1C',
    }),

    // ========== 玄幻组 ==========
    Object.freeze({
        id: 'preset-cultivation-world',
        category: WORLD_PRESET_CATEGORIES.FANTASY,
        name: '修仙世界',
        summary: '修真问道，飞升成仙，长生不老',
        keyPoints: [
            '修炼体系：练气、筑基、金丹、元婴、化神',
            '修仙门派：正道、魔道、邪道、散修',
            '资源争夺：灵根、灵脉、丹药、法器',
            '天道法则：渡劫、心魔、天道意志',
        ],
        tagRefs: ['玄幻', '修仙', '东方神话'],
        icon: '☯️',
        color: '#7C3AED',
    }),
    Object.freeze({
        id: 'preset-magic-world',
        category: WORLD_PRESET_CATEGORIES.FANTASY,
        name: '魔法世界',
        summary: '西方奇幻，魔法学院，精灵与龙',
        keyPoints: [
            '魔法体系：元素魔法、亡灵魔法、神术、炼金术',
            '种族设定：人类、精灵、矮人、兽人、龙族',
            '势力分布：王国、公会、教会、黑暗势力',
            '经典元素：勇者、魔王、魔法学院、神器',
        ],
        tagRefs: ['玄幻', '魔法', '西方奇幻'],
        icon: '🔮',
        color: '#8B5CF6',
    }),

    // ========== 架空组 ==========
    Object.freeze({
        id: 'preset-cyberpunk-world',
        category: WORLD_PRESET_CATEGORIES.CUSTOM,
        name: '赛博世界',
        summary: '高科技低生活，网络与义体的未来都市',
        keyPoints: [
            '科技设定：神经链接、义体改造、AI觉醒',
            '社会阶层：企业、帮派、街头混混、仿生人',
            '核心矛盾：人类vs机器、贫富差距、意识上传',
            '视觉元素：霓虹灯、雨夜、高楼、贫民窟',
        ],
        tagRefs: ['架空', '赛博朋克', '科幻'],
        icon: '🤖',
        color: '#06B6D4',
    }),
    Object.freeze({
        id: 'preset-apocalypse-world',
        category: WORLD_PRESET_CATEGORIES.CUSTOM,
        name: '末日世界',
        summary: '文明崩塌，废土求生，变异与希望',
        keyPoints: [
            '末日成因：丧尸、核战、病毒、外星入侵、AI叛变',
            '生存资源：食物、水源、医疗、武器燃料',
            '势力分布：幸存者营地、掠夺者、变异体、原住民',
            '核心冲突：资源争夺、信仰危机、人类存亡',
        ],
        tagRefs: ['架空', '末日', '废土'],
        icon: '☢️',
        color: '#65A30D',
    }),
]);

/**
 * 获取某个分类下的所有预设
 */
export function getPresetsByCategory(category) {
    return WORLD_PRESET_TEMPLATES.filter(p => p.category === category);
}

/**
 * 获取所有分类及其预设
 */
export function getPresetsGroupedByCategory() {
    const result = {};
    for (const category of Object.values(WORLD_PRESET_CATEGORIES)) {
        result[category] = getPresetsByCategory(category);
    }
    return result;
}

/**
 * 根据预设创建世界观实例
 */
export function createWorldFromPreset(presetId) {
    const preset = WORLD_PRESET_TEMPLATES.find(p => p.id === presetId);
    if (!preset) return null;

    const t = Date.now();
    return {
        id: `world-${t}`,
        name: preset.name,
        summary: preset.summary,
        keyPoints: [...preset.keyPoints],
        timeline: '',
        notes: `由预设「${preset.name}」创建`,
        tagRefs: [...preset.tagRefs],
        locations: [],

        // ★ v0.17 时间线 + 锚点（已移除阶段相关字段；已彻底移除 App绑定 / 上下文注入 / 日历）
        timelines: { personal: { user: [] }, world: [] },
        anchors: [],

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

/**
 * 世界观组数据结构（用于UI展示）
 * 这是运行时状态，不存储
 */
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
            presets: items.map(p => ({
                id: p.id,
                name: p.name,
                summary: p.summary,
                icon: p.icon,
                color: p.color,
                keyPointsCount: p.keyPoints?.length || 0,
                // v0.16：阶段→锚点
                anchorCount: p.anchors?.length || 0,
                locationCount: p.locations?.length || 0,
            })),
        });
    }

    return result;
}
