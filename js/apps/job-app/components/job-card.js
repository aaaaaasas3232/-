/**
 * 灯塔 · 职位卡
 *
 * 招聘板和收藏页共用一张卡，所以它抽出来单放一个文件。
 *
 * ── 不留图位 ──────────────────────────────────────────────────────
 *
 * 职位图 AI 生成不出来，灰色占位符会让整个列表看着像坏了，
 * 随机图片又和世界观对不上。识别度由排版承担：
 * 左边一条 3px 的竖线区分「普通 / 特殊工种 / 已收藏」，
 * 一屏能看四五个，信息密度比带图的高。
 */

import { UI } from './ui.js';
import { JOB_TYPES } from '../constants.js';
import { icon } from '../icons.js';

const TYPE_LABEL = Object.fromEntries(JOB_TYPES.map((t) => [t.id, t.label]));

export const JbJobCard = {
    name: 'JbJobCard',
    components: { ...UI },
    props: {
        job: { type: Object, required: true },
        currency: { type: String, default: '金币' },
    },
    emits: ['open', 'save'],
    computed: {
        typeLabel() { return TYPE_LABEL[this.job.jobType] || ''; },
        isSpecial() { return Boolean(this.job.track); },
        markSvg() { return icon(this.job.favorited ? 'bookmark' : 'bookmark', { size: 17 }); },
        payLine() {
            if (this.job.payText) return this.job.payText;
            const n = Number(this.job.payAmount) || 0;
            if (!n) return '面议';
            return this.job.payMode === 'monthly' ? `每月 ${n}` : `每天最多 ${n}`;
        },
    },
    template: `
        <article
            class="jb-job"
            :class="{ 'is-special': isSpecial, 'is-saved': job.favorited }"
        >
            <button class="jb-job__main" @click="$emit('open', job)">
                <header class="jb-job__head">
                    <h3 class="jb-job__title">{{ job.title }}</h3>
                    <span v-if="isSpecial" class="jb-tag jb-tag--accent">星探在找人</span>
                </header>

                <p class="jb-job__meta">
                    <span v-if="job.employer">{{ job.employer }}</span>
                    <span v-if="job.area">{{ job.area }}</span>
                    <span v-if="typeLabel">{{ typeLabel }}</span>
                </p>

                <p class="jb-job__blurb">{{ job.blurb }}</p>

                <footer class="jb-job__foot">
                    <span class="jb-job__pay">{{ payLine }} <i>{{ currency }}</i></span>
                    <span v-for="t in job.tags" :key="t" class="jb-tag">{{ t }}</span>
                </footer>
            </button>

            <button
                class="jb-job__save jb-iconbtn"
                :class="{ 'is-on': job.favorited }"
                :title="job.favorited ? '取消收藏' : '收藏'"
                v-html="markSvg"
                @click.stop="$emit('save', job)"
            ></button>
        </article>
    `,
};
