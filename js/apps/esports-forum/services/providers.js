/**
 * 声浪 · 社交影响 providers
 *
 * 电竞生涯 → 氧气（blog）/ 萤火（youtube）的唯一通道。
 * provider 只读当前档的概要、不调 AI；社交 App 在用户点击生成时才收集。
 *
 * 「战队官博注册进氧气/萤火」「队友与用户互关」走的就是这里：
 * team-circle provider 把（用户在社媒偏好里放行的）队友账号、战队官博
 * 描述给氧气/萤火的生成器 —— 那边「同名 = 同一个人」的幂等机制会把这些
 * 账号固化成稳定身份，热度决定他们动态下的评论量。
 *
 * providerId 发布后不能改：
 *   season-identity  赛季身份（feed / comment / hot-search）
 *   recent-results   近期赛果与 rank 战绩
 *   team-circle      战队社媒圈（官博 + 互关队友，受社媒偏好开关控制）
 *   fanbase-trend    粉丝与舆论变化
 *   dm-vibe          私信风向（channel: dm）
 *   hot-terms        热搜词条（channel: hot-search，专供氧气热搜榜）
 */

import { registerSocialInfluenceProvider } from '@/src/core/social-influence-registry.js';
import { startTierSpec } from '../constants.js';
import { asArray } from '../utils.js';

/**
 * @param {() => object} readState 由 store 提供的懒读取（provider 被收集时才执行，永不调 AI）
 *   期望返回 { profile, save, season, timeline, heat, teamNameOf, teammates, rankSummaries }
 */
export function registerEsportsProviders(readState) {
    const read = () => {
        try {
            return readState() || {};
        } catch (_) {
            return {};
        }
    };

    const specs = [
        {
            providerId: 'season-identity',
            label: '赛季身份',
            targetAppIds: ['blog', 'youtube'],
            channels: ['feed', 'comment', 'hot-search'],
            getContent() {
                const { profile, save, season, teamNameOf } = read();
                if (!profile?.configured || !save) return '';
                const spec = startTierSpec(save.startTier);
                const team = teamNameOf ? teamNameOf(profile.userTeamId) : '战队';
                const stage = season ? `正在打「${season.name}」` : '处于休赛期';
                return `用户是职业电竞选手（ID：${profile.gameId}，${spec.label}出身），效力于${team}，${stage}。人气 ${Math.round(save.attrs?.fame ?? 0)}/100。`;
            },
        },
        {
            providerId: 'recent-results',
            label: '近期赛果与战绩',
            targetAppIds: ['blog', 'youtube'],
            channels: ['feed', 'comment', 'hot-search'],
            getContent() {
                const { save, timeline } = read();
                if (!save) return '';
                const recent = asArray(timeline).slice(0, 4).map((t) => t.title).join('；');
                const rank = asArray(save.rankSummaries).slice(0, 2)
                    .map((r) => `${r.modeLabel}${r.wins}胜${r.losses}负`).join('；');
                const bits = [recent && `近期：${recent}`, rank && `最近排位：${rank}`].filter(Boolean);
                return bits.length ? `用户的近期赛场动态 —— ${bits.join('。')}。` : '';
            },
        },
        {
            providerId: 'team-circle',
            label: '战队社媒圈（官博与互关队友）',
            targetAppIds: ['blog', 'youtube'],
            channels: ['feed', 'comment'],
            getContent() {
                const { profile, teammates, heat, teamNameOf } = read();
                if (!profile?.configured) return '';
                const prefs = profile.socialPrefs || {};
                const lines = [];
                const teamName = teamNameOf ? teamNameOf(profile.userTeamId) : '战队';
                if (prefs.officialBlogs !== false) {
                    const h = heat?.[profile.userTeamId] ?? 40;
                    lines.push(`「${teamName}官方」是用户战队的官博账号，会发赛报与日常，热度 ${h}/100（热度越高动态下评论越多，输赢都会被围观）。`);
                }
                if (prefs.syncTeammates !== false && asArray(teammates).length) {
                    const names = asArray(teammates)
                        .filter((t) => !asArray(prefs.hiddenPlayerIds).includes(t.id))
                        .map((t) => `${t.gameId}（${t.posLabel}）`)
                        .join('、');
                    if (names) {
                        lines.push(`用户的队友 ${names} 都注册了账号并与用户互相关注，他们会在用户动态下互动，口吻像真的队友。`);
                    }
                }
                for (const extra of asArray(read().visibleOthers)) {
                    lines.push(`${extra.teamName} 的选手 ${extra.names} 也活跃在这个平台上，与用户是同赛区同行。`);
                }
                return lines.join('\n');
            },
        },
        {
            providerId: 'fanbase-trend',
            label: '粉丝与舆论变化',
            targetAppIds: ['blog', 'youtube'],
            channels: ['feed', 'comment', 'dm'],
            getContent() {
                const { save } = read();
                if (!save) return '';
                const fame = Math.round(save.attrs?.fame ?? 0);
                const mood = save.shieldUntilDay > (save.clock?.day || 0)
                    ? '刚经历舆情风波，公关刚把词条压下去，粉丝情绪紧绷'
                    : fame >= 60 ? '粉丝盘大且活跃，黑粉也成建制' : fame >= 25 ? '粉丝不多但黏性高' : '关注者寥寥，评论区很安静';
                return `用户人气 ${fame}/100。当前舆论状态：${mood}。`;
            },
        },
        {
            providerId: 'dm-vibe',
            label: '私信风向',
            targetAppIds: ['blog', 'youtube'],
            channels: ['dm'],
            getContent() {
                const { save } = read();
                if (!save) return '';
                const fame = Math.round(save.attrs?.fame ?? 0);
                if (fame >= 55) return '用户是有国民度的电竞选手：私信里有粉丝表白、赛评人约稿、品牌合作，也混着赌狗问内幕和黑粉阴阳。';
                if (fame >= 25) return '用户是小有名气的电竞选手：私信以粉丝加油和同行寒暄为主，偶尔有代练工作室来挖人。';
                return '用户是没什么名气的电竞选手：私信不多，多是广告机器人和陪玩工作室群发。';
            },
        },
        {
            providerId: 'hot-terms',
            label: '热搜词条',
            targetAppIds: ['blog'],
            channels: ['hot-search'],
            getContent() {
                const { profile, timeline } = read();
                if (!profile?.configured) return '';
                const name = profile.gameId || '这位选手';
                const terms = asArray(timeline)
                    .filter((t) => t.major)
                    .slice(0, 3)
                    .map((t) => `${name}${t.title}`);
                if (!terms.length) return '';
                return `与用户有关的热搜词条：${terms.join('；')}`;
            },
        },
    ];

    const unregisters = specs.map((spec) => registerSocialInfluenceProvider({
        sourceAppId: 'esports-forum',
        ...spec,
    }));
    return () => unregisters.forEach((fn) => fn());
}
