/**
 * 追光 · 社交影响 providers
 *
 * 演员生涯 → 氧气（blog）/ 萤火（youtube）的唯一通道。
 * provider 只读当前档的概要、不调 AI；社交 App 在用户点击生成时才收集。
 *
 * providerId 发布后不能改：
 *   recent-career   近期演艺经历（feed / 评论风向）
 *   fanbase-trend   粉丝与舆论变化
 *   new-work        新作品动态
 *   dm-vibe         私信风向（channel: dm）
 *   hot-terms       热搜词条（channel: hot-search，专供氧气热搜榜）
 */

import { registerSocialInfluenceProvider } from '@/src/core/social-influence-registry.js';
import { tierSpec } from '../constants.js';
import { asArray } from '../utils.js';

/**
 * @param {() => {save:object|null, timeline:Array, profile:object|null}} readState
 *   由 store 提供的懒读取（provider 被收集时才执行，永不调 AI）
 */
export function registerActorProviders(readState) {
    const read = () => {
        try {
            return readState() || {};
        } catch (_) {
            return {};
        }
    };

    const specs = [
        {
            providerId: 'recent-career',
            label: '近期演艺经历',
            targetAppIds: ['blog', 'youtube'],
            channels: ['feed', 'comment', 'hot-search'],
            getContent() {
                const { save, timeline } = read();
                if (!save) return '';
                const spec = tierSpec(save.tier);
                const recent = asArray(timeline).slice(0, 4).map((t) => t.title).join('；');
                if (!recent) return '';
                return `用户是${spec.label}演员（${spec.group}）。近期经历：${recent}。`;
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
                const spec = tierSpec(save.tier);
                const mood = save.shieldUntilDay > (save.clock?.day || 0)
                    ? '刚经历舆情风波，公关刚压下去，粉丝情绪紧绷'
                    : fame >= 60 ? '粉丝盘活跃，路人盘在扩大' : '粉丝量不大但黏性高';
                return `用户知名度 ${fame}/100（${spec.label}）。当前舆论状态：${mood}。`;
            },
        },
        {
            providerId: 'new-work',
            label: '新作品动态',
            targetAppIds: ['blog', 'youtube'],
            channels: ['feed', 'hot-search'],
            getContent() {
                const { save, projects } = read();
                if (!save) return '';
                const active = asArray(projects).find((p) => p.status === 'shooting' || p.status === 'aired');
                if (!active) return '';
                return active.status === 'aired'
                    ? `用户主演的《${active.title}》刚播出，热度${active.airing?.heat >= 75 ? '爆了' : '平稳'}。`
                    : `用户正在拍《${active.title}》（${active.roleName ? `饰 ${active.roleName}` : '出演'}），剧组路透偶有流出。`;
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
                if (fame >= 55) return '用户是有国民度的演员：私信里有粉丝表白、剧组邀约、品牌合作，也混着黑子的阴阳怪气。';
                if (fame >= 25) return '用户是小有名气的演员：私信以粉丝鼓励和同行寒暄为主，偶尔有小品牌来谈合作。';
                return '用户是没什么名气的演员：私信不多，多是群发广告和剧组群演招募。';
            },
        },
        {
            providerId: 'hot-terms',
            label: '热搜词条',
            targetAppIds: ['blog'],
            channels: ['hot-search'],
            getContent() {
                const { save, timeline, profile } = read();
                if (!save) return '';
                const name = profile?.stageName || '这位演员';
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
        sourceAppId: 'actor-career',
        ...spec,
    }));
    return () => unregisters.forEach((fn) => fn());
}
