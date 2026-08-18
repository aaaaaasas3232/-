/**
 * 人设卡正文（nook 预览 / murmur 提示词的唯一出口）
 *
 * murmur 以前自己写了一份只拼到「4. 背景」的短卡，nook 主页 pre 里
 * 从履历到三观的后半段发不出去。两边必须走这一份，和 nook「当前人设上下文」一致。
 */

import { getAccessibleLocationsForPersona } from './space-sdk.js';

function getChronoLabel(hour, hourNames) {
    if (hour == null || !hourNames?.length) return '';
    return hourNames[Math.floor((hour + 1) / 2) % 12] || '';
}

function appendRhythmLine(sections, indent, e, daysStr, hourNames) {
    const startH = e.startTime ? parseInt(e.startTime.split(':')[0]) : null;
    const endH = e.endTime ? parseInt(e.endTime.split(':')[0]) : null;
    const chronoStart = getChronoLabel(startH, hourNames);
    const chronoEnd = endH != null && endH !== startH ? getChronoLabel(endH, hourNames) : '';
    const prefix = indent || '    ';
    const dayTag = daysStr ? `[${daysStr}]` : '';
    if (chronoStart) {
        const chronoStr = chronoEnd ? `${chronoStart}~${chronoEnd}` : chronoStart;
        sections.push(`${prefix}- ${dayTag}${chronoStr} ${e.description}`);
    } else {
        const range = e.endTime ? `${e.startTime}-${e.endTime}` : e.startTime;
        sections.push(`${prefix}- [${range}]${dayTag} ${e.description}`);
    }
}

function getWeekDayNames(worldId) {
    const sdk = window.settingsSdk;
    const world = worldId ? sdk?.worlds?.get?.(worldId) : null;
    const list = world?.chronologySettings?.weekDayNames;
    if (Array.isArray(list) && list.length >= 7 && list.every((s) => typeof s === 'string' && s.length > 0)) {
        return list.slice(0, 7);
    }
    return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
}

function formatNowHm() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildChronoTimeNote(boundWorldId) {
    const sdk = window.settingsSdk;
    const world = boundWorldId ? sdk?.worlds?.get?.(boundWorldId) : null;
    if (!world?.chronologySettings?.enabled) return '';

    const cfg = world.chronologySettings;
    const lines = [];
    lines.push('> 时间观：本世界观使用专属纪时。');

    try {
        const worldTime = sdk.chronology.realToWorld?.(new Date(), boundWorldId);
        if (worldTime) {
            const worldTimeStr = sdk.chronology.format(worldTime, 'full', boundWorldId);
            lines.push(`> - 用户向你发送消息的现实时间（UTC+8 ${formatNowHm()}） = 当前世界时间 ${worldTimeStr}。请直接以此时间观理解用户的"现在"，不必反复换算现实时钟。`);
        }
    } catch (_) { /* ignore */ }

    const customHours = Array.isArray(cfg.customHours) ? cfg.customHours : [];
    const DEFAULT_12_NAMES = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时',
        '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    const DEFAULT_24_NAMES = Array.from({ length: 24 }, (_, i) => `${i}时`);
    const customHoursKey = customHours.join(',');
    const isPreset12 = customHours.length === 12 && customHoursKey === DEFAULT_12_NAMES.join(',');
    const isPreset24 = customHours.length === 24 && customHoursKey === DEFAULT_24_NAMES.join(',');
    const isPreset = isPreset12 || isPreset24;
    if (customHours.length > 0 && !isPreset) {
        const ratio = cfg.hoursRatio || { base: 1, real: 1 };
        const ratioStr = (ratio.base === ratio.real || !ratio.base || !ratio.real)
            ? ''
            : `（1 时段 = 现实 ${ratio.real / ratio.base} 小时）`;
        lines.push(`> - 时段名称：${customHours.join(' / ')}${ratioStr}。请使用这些时段名指代"X 时~Y 时"这类时间段。`);
    }

    const DEFAULT_WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const customWeekDays = Array.isArray(cfg.weekDayNames) && cfg.weekDayNames.length >= 7
        ? cfg.weekDayNames.slice(0, 7)
        : null;
    if (customWeekDays) {
        const isDefault = customWeekDays.every((n, i) => DEFAULT_WEEK[i] === n);
        if (!isDefault) {
            const pairs = customWeekDays.map((n, i) => `${n}=${DEFAULT_WEEK[i]}`);
            lines.push(`> - 周名映射：${pairs.join('，')}。当用户提到"周五"等现实周名时，请自动理解为本世界观的"${customWeekDays[4]}"；反之亦然。`);
        }
    }

    if (lines.length <= 1) return '';
    return lines.join('\n');
}

function appendEventTimeLine(sections, indent, e, hourNames) {
    const startH = e.startTime ? parseInt(e.startTime.split(':')[0]) : null;
    const endH = e.endTime ? parseInt(e.endTime.split(':')[0]) : null;
    const chronoStart = getChronoLabel(startH, hourNames);
    const chronoEnd = endH != null && endH !== startH ? getChronoLabel(endH, hourNames) : '';
    const prefix = indent || '    ';
    if (chronoStart) {
        const chronoStr = chronoEnd ? `${chronoStart}~${chronoEnd}` : chronoStart;
        sections.push(`${prefix}- ${chronoStr} ${e.title}`);
    } else {
        const timeStr = e.endTime ? `${e.startTime}-${e.endTime}` : (e.startTime || '');
        sections.push(`${prefix}- [${timeStr}] ${e.title}`);
    }
}

function sortScheduleEvents(events) {
    const ts = (e) => {
        if (!e || !e.startTime) return -1;
        const [h, m] = String(e.startTime).split(':').map((n) => parseInt(n, 10) || 0);
        return h * 60 + m;
    };
    return [...events].sort((a, b) => {
        const ta = ts(a);
        const tb = ts(b);
        if (ta !== tb) return ta - tb;
        return (a?.createdAt || 0) - (b?.createdAt || 0);
    });
}

/**
 * 从 persona 动态生成上下文文本（忽略 customContext）。
 * 格式、章节顺序与 nook「当前人设上下文」pre 一致。
 *
 * @param {object} persona
 * @param {'user'|'ai'} entityType
 */
export function buildContextFromPersona(persona, entityType) {
    const sdk = window.settingsSdk;
    if (!persona) return '';

    const sections = [];
    const name = persona.name || persona.chineseName || '';

    sections.push(`# 角色卡${name ? ': ' + name : ''}`);

    const boundWorldId = persona.boundWorldId;
    const chronoNote = boundWorldId && sdk?.chronology
        ? buildChronoTimeNote(boundWorldId)
        : '';
    if (chronoNote) sections.push(chronoNote);
    sections.push('');

    const basicFields = [];
    if (persona.chineseName || persona.name) basicFields.push(`chineseName: ${persona.chineseName || persona.name}`);
    if (persona.gender) basicFields.push(`gender: ${persona.gender}`);
    // age 这一行以前只判 `!= null`。人设编辑器里没填的年龄存的是空字符串，
    // `'' != null` 为真 —— 于是 pre 里出现一行光秃秃的 `age:`，模型只能猜那是什么意思。
    // 其余字段本来就是 truthy 判断，这里对齐它们。
    if (persona.age != null && String(persona.age).trim() !== '') basicFields.push(`age: ${persona.age}`);
    if (persona.identity || persona.role) basicFields.push(`identity: ${persona.identity || persona.role}`);
    if (persona.bio) basicFields.push(`bio: ${persona.bio}`);
    if (persona.personality) basicFields.push(`personality: ${persona.personality}`);
    if (persona.tone) basicFields.push(`tone: ${persona.tone}`);
    if (basicFields.length > 0) {
        sections.push('# 1. 基本信息');
        sections.push(basicFields.join('\n'));
        sections.push('');
    }

    if (persona.appearance) {
        sections.push('# 2. 外貌与体征');
        sections.push('appearance:');
        if (typeof persona.appearance === 'string') {
            const lines = persona.appearance.split('\n').filter((l) => l.trim());
            if (lines.length === 1) sections.push(`  ${lines[0]}`);
            else lines.forEach((l) => sections.push(`  - ${l}`));
        } else if (typeof persona.appearance === 'object') {
            const app = persona.appearance;
            if (app.height) sections.push(`  height: ${app.height}`);
            if (app.bodyType) sections.push(`  body_type: ${app.bodyType}`);
            if (app.hairStyle) sections.push(`  hair_style: ${app.hairStyle}`);
            if (app.eyeColor) sections.push(`  eye_color: ${app.eyeColor}`);
            if (Array.isArray(app.facialFeatures)) {
                sections.push('  facial_features:');
                app.facialFeatures.forEach((f) => sections.push(`    - ${f}`));
            }
            if (app.clothingStyle) sections.push(`  clothing_style: ${app.clothingStyle}`);
            if (Array.isArray(app.specialMarks)) {
                sections.push('  special_marks:');
                app.specialMarks.forEach((m) => sections.push(`    - ${m}`));
            }
        }
        sections.push('');
    }

    if (persona.personality || persona.personalityTraits || persona.currentOccupation) {
        sections.push('# 3. 性格特质');
        sections.push('traits:');
        if (Array.isArray(persona.personalityTraits?.core)) {
            sections.push('  core_personality:');
            persona.personalityTraits.core.forEach((t) => sections.push(`    - ${t}`));
        }
        if (persona.personality) {
            sections.push('  core_personality:');
            sections.push(`    - ${persona.personality}`);
        }
        if (persona.currentOccupation) {
            sections.push(`  current_occupation: ${persona.currentOccupation}`);
        }
        sections.push('');
    }

    if (persona.experience || persona.background || persona.family?.enabled || persona.origin) {
        sections.push('# 4. 角色介绍');
        sections.push('experience:');
        if (persona.experience) {
            const lines = persona.experience.split('\n').filter((l) => l.trim());
            if (lines.length === 1) sections.push(`  ${lines[0]}`);
            else lines.forEach((l) => sections.push(`  - ${l}`));
        }
        if (persona.family?.enabled) {
            const f = persona.family;
            sections.push('  family:');
            if (Array.isArray(f.members)) {
                for (const mem of f.members) {
                    const rel = (mem.relation || '').toLowerCase();
                    const relKey = rel.includes('父') || rel.includes('dad') ? 'father'
                        : rel.includes('母') || rel.includes('mom') ? 'mother'
                            : rel.includes('兄') || rel.includes('弟') ? 'brother'
                                : rel.includes('姐') || rel.includes('妹') ? 'sister'
                                    : 'member';
                    sections.push(`    ${relKey}:`);
                    if (mem.name) sections.push(`      name: ${mem.name}`);
                    if (mem.description) sections.push(`      condition: ${mem.description}`);
                }
            }
            if (f.notes) sections.push(`    family_status: ${f.notes}`);
        }
        if (persona.origin) sections.push(`  origin: ${persona.origin}`);
        if (persona.background) sections.push(`  ${typeof persona.background === 'string' ? persona.background : JSON.stringify(persona.background)}`);
        sections.push('');
    }

    let timelineData = persona.lifePhases;
    if (persona.boundWorldId && sdk?.worlds) {
        const world = sdk.worlds.get(persona.boundWorldId);
        if (world?.timelines?.personal?.[entityType]) {
            timelineData = world.timelines.personal[entityType];
        }
    }
    if (Array.isArray(timelineData) && timelineData.length > 0) {
        sections.push('# 5. 人生履历 (Timeline)');
        sections.push('timeline:');
        for (const phase of timelineData) {
            const ageStr = phase.ageRange?.[0] ? `age: ${phase.ageRange[0]}` : phase.age ? `age: ${phase.age}` : '';
            sections.push(`  - ${ageStr}`);
            if (phase.name) sections.push(`    event: ${phase.name}`);
            if (phase.description) sections.push(`    description: ${phase.description}`);
            if (phase.tone) sections.push(`    tone: ${phase.tone}`);
            if (phase.mood) sections.push(`    mood: ${phase.mood}`);
        }
        sections.push('');
    }

    if (persona.social?.enabled && Array.isArray(persona.social.relations) && persona.social.relations.length > 0) {
        sections.push('# 6. 人际关系');
        sections.push('relationships:');
        for (const rel of persona.social.relations) {
            sections.push(`  - name: "${rel.name || rel.id}"`);
            if (rel.type) sections.push(`    type: ${rel.type}`);
            if (rel.description) sections.push(`    description: "${rel.description}"`);
            if (rel.affection != null) sections.push(`    affection: ${rel.affection}`);
            if (rel.impression) sections.push(`    impression: ${rel.impression}`);
        }
        sections.push('');
    }

    const prefEnabled = persona.preferences?.enabled;
    const prefMod = persona.preferences || {};
    const hobbies = Array.isArray(prefMod.hobbies) ? prefMod.hobbies : (typeof prefMod.hobbies === 'string' ? prefMod.hobbies.split('\n').filter(Boolean) : []);
    const likes = Array.isArray(prefMod.likes) ? prefMod.likes : (typeof prefMod.likes === 'string' ? prefMod.likes.split('\n').filter(Boolean) : []);
    const dislikes = Array.isArray(prefMod.dislikes) ? prefMod.dislikes : (typeof prefMod.dislikes === 'string' ? prefMod.dislikes.split('\n').filter(Boolean) : []);
    const allergies = Array.isArray(prefMod.allergies) ? prefMod.allergies : (typeof prefMod.allergies === 'string' ? prefMod.allergies.split('\n').filter(Boolean) : []);
    if (prefEnabled && (hobbies.length || likes.length || dislikes.length || allergies.length)) {
        sections.push('# 8. 偏好');
        sections.push('preferences:');
        if (hobbies.length) {
            sections.push('  hobbies:');
            hobbies.forEach((h) => sections.push(`    - ${h}`));
        }
        if (likes.length) {
            sections.push('  likes:');
            likes.forEach((l) => sections.push(`    - ${l}`));
        }
        if (dislikes.length) {
            sections.push('  dislikes:');
            dislikes.forEach((d) => sections.push(`    - ${d}`));
        }
        if (allergies.length) {
            sections.push('  allergies:');
            allergies.forEach((a) => sections.push(`    - ${a}`));
        }
        sections.push('');
    }

    const hasBalance = persona.assetBalance != null;
    const hasIncome = Array.isArray(persona.incomeEvents) && persona.incomeEvents.length > 0;
    const assetNoteRaw = persona?.assetNotes?.description;
    const assetNoteText = typeof assetNoteRaw === 'string'
        ? assetNoteRaw
        : (Array.isArray(assetNoteRaw) ? assetNoteRaw.filter(Boolean).join('\n') : '');
    const hasAssetNote = !!assetNoteText.trim();
    if (hasBalance || hasIncome || hasAssetNote) {
        sections.push('# 9. 资产');
        sections.push('assets:');
        if (hasBalance) {
            const world = persona.boundWorldId ? sdk?.worlds?.get(persona.boundWorldId) : null;
            const currency = world?.currencies?.find((c) => c.isBase) || world?.currencies?.[0];
            const unit = currency?.name || currency?.symbol || '';
            sections.push(`  balance: ${persona.assetBalance}${unit ? ' ' + unit : ''}`);
        }
        if (hasIncome) {
            sections.push('  income:');
            for (const evt of persona.incomeEvents) {
                sections.push(`    - ${evt.name}: ${evt.amount} (${evt.frequency})`);
            }
        }
        if (hasAssetNote && persona?.assetNotes?.enabled === true) {
            for (const line of assetNoteText.split('\n').map((s) => s.trim()).filter(Boolean)) {
                sections.push(`  note: ${line}`);
            }
        }
        sections.push('');
    }

    const moodInject = persona?.mood?.injectMode || 'none';
    if (moodInject !== 'none') {
        const todayData = sdk?.diary?.getToday?.(entityType, persona.id);
        const mood = todayData?.mood || persona.dailyMood;
        if (mood) {
            sections.push('# 10. 今日心情');
            sections.push(`mood: ${mood}`);
            sections.push('');
        }
    }

    const schedInject = persona?.schedule?.injectMode || 'none';
    if (schedInject !== 'none') {
        const pid = persona.id;
        const now = new Date();
        const nowHour = now.getHours();
        const nowDate = now.toLocaleDateString('en-CA');
        const hourNames = persona?.boundWorldId && sdk?.chronology
            ? (sdk.chronology.getHourNames?.(persona.boundWorldId) || [])
            : [];

        if (schedInject === 'current') {
            const todayDay = sdk?.schedule?.getDay?.(entityType, pid, nowDate);
            const ongoing = (todayDay?.events || []).filter((e) => {
                if (!e.startTime) return false;
                const sh = parseInt(e.startTime.split(':')[0]) || 0;
                const eh = e.endTime ? (parseInt(e.endTime.split(':')[0]) || 23) : 23;
                return nowHour >= sh && nowHour <= eh;
            });
            if (ongoing.length > 0) {
                sections.push('# 11. 当前日程');
                sections.push('current_schedule:');
                sortScheduleEvents(ongoing).forEach((e) => appendEventTimeLine(sections, '  ', e, hourNames));
                sections.push('');
            }
        } else if (schedInject === 'nearby') {
            const nearbyDays = [];
            const today = new Date(now);
            for (let offset = -1; offset <= 1; offset++) {
                const d = new Date(today);
                d.setDate(today.getDate() + offset);
                nearbyDays.push({ offset, dateStr: d.toLocaleDateString('en-CA') });
            }
            const nearbyLabels = { '-1': '昨天', '0': '今天', '1': '明天' };
            sections.push('# 11. 近期日程');
            sections.push('nearby_schedule:');
            let nearbyHasAny = false;
            nearbyDays.forEach(({ offset, dateStr }) => {
                const dayData = sdk?.schedule?.getDay?.(entityType, pid, dateStr);
                const evts = sortScheduleEvents(dayData?.events || []);
                if (evts.length === 0) return;
                nearbyHasAny = true;
                sections.push(`  ${nearbyLabels[String(offset)] || dateStr}:`);
                evts.forEach((e) => appendEventTimeLine(sections, '    ', e, hourNames));
            });
            if (!nearbyHasAny) sections.push('  （昨天/今天/明天都没有日程）');
            sections.push('');
        } else {
            const weekDays = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                weekDays.push({ dateStr: d.toLocaleDateString('en-CA'), date: d });
            }
            const weekDayNames = getWeekDayNames(persona?.boundWorldId);
            sections.push('# 11. 本周日程');
            sections.push('weekly_schedule:');
            weekDays.forEach(({ dateStr, date }) => {
                const dayData = sdk?.schedule?.getDay?.(entityType, pid, dateStr);
                const evts = sortScheduleEvents(dayData?.events || []);
                if (evts.length === 0) return;
                const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
                const wd = weekDayNames[dayIdx] || '';
                sections.push(`  ${wd}:`);
                evts.forEach((e) => appendEventTimeLine(sections, '    ', e, hourNames));
            });
            sections.push('');
        }
    }

    const rhythmInject = persona?.rhythm?.injectMode || 'none';
    if (rhythmInject !== 'none') {
        const nowHour = new Date().getHours();
        const nowDay = new Date().getDay();
        const nowDayIdx = nowDay === 0 ? 6 : nowDay - 1;
        const entries = persona.rhythm?.entries || [];
        const worldId = persona.boundWorldId;
        const hourNames = worldId && sdk?.chronology
            ? (sdk.chronology.getHourNames?.(worldId) || []) : [];
        const weekdayNames = getWeekDayNames(worldId);

        sections.push('# 12. 作息');
        sections.push('daily_rhythm:');

        if (rhythmInject === 'current') {
            const matched = entries.filter((e) => {
                const sh = parseInt(e.startTime?.split(':')[0]) ?? null;
                if (sh == null) return false;
                const eh = e.endTime ? parseInt(e.endTime.split(':')[0]) : sh;
                const matchesHour = nowHour >= sh && nowHour <= eh;
                const matchesDay = !e.daysOfWeek?.length || e.daysOfWeek.includes(nowDayIdx);
                return matchesHour && matchesDay;
            });

            if (matched.length > 0) {
                const curChrono = hourNames[Math.floor((nowHour + 1) / 2) % 12] || `${nowHour}时`;
                sections.push(`  当前时段（${curChrono}）:`);
                matched.forEach((e) => {
                    const daysStr = e.daysOfWeek?.length === 0 ? '每天'
                        : e.daysOfWeek.map((d) => weekdayNames[d]).join('/');
                    appendRhythmLine(sections, '    ', e, daysStr, hourNames);
                });
            } else {
                sections.push('  当前时段: （暂无）');
            }
        } else if (entries.length === 0) {
            sections.push('  （未设置作息）');
        } else {
            const sortedEntries = [...entries].sort((a, b) => {
                const aHasStart = !!a.startTime;
                const bHasStart = !!b.startTime;
                if (aHasStart !== bHasStart) return aHasStart ? -1 : 1;
                const ah = aHasStart ? parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1] || '0') : 0;
                const bh = bHasStart ? parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1] || '0') : 0;
                return ah - bh;
            });
            sortedEntries.forEach((e) => {
                const daysStr = e.daysOfWeek?.length === 0 ? '每天'
                    : e.daysOfWeek.map((d) => weekdayNames[d]).join('/');
                appendRhythmLine(sections, '    ', e, daysStr, hourNames);
            });
        }
        sections.push('');
    }

    if (persona.monthlyPlan?.enabled) {
        const mp = persona.monthlyPlan;
        sections.push('# 13. 月计划');
        if (Array.isArray(mp.goals) && mp.goals.length > 0) {
            sections.push('goals:');
            for (const goal of mp.goals) {
                const progress = goal.progress != null ? ` (${Math.round(goal.progress * 100)}%)` : '';
                sections.push(`  - ${goal.content}${progress}`);
            }
        }
        sections.push('');
    }

    const memoryHasEnabled = persona?.memory?.enabled;
    const rawMemory = persona?.memory?.text || persona?.memory?.content || (typeof persona?.memory === 'string' ? persona?.memory : '') || '';
    const memoryLines = typeof rawMemory === 'string' ? rawMemory.split('\n').filter((l) => l.trim()) : [];
    if (memoryHasEnabled && memoryLines.length > 0) {
        sections.push('# 14. 记忆');
        sections.push('memories:');
        memoryLines.forEach((l) => sections.push(`  - ${l}`));
        sections.push('');
    }

    const worldviewHasEnabled = persona?.worldview?.enabled;
    const rawWorldview = persona?.worldview?.text || '';
    const worldviewLines = typeof rawWorldview === 'string' ? rawWorldview.split('\n').filter((l) => l.trim()) : [];
    if (worldviewHasEnabled && worldviewLines.length > 0) {
        sections.push('# 15. 三观');
        sections.push('worldview:');
        worldviewLines.forEach((l) => sections.push(`  - ${l}`));
        sections.push('');
    }

    const mbtiEnabled = persona?.mbti?.enabled;
    const mbtiType = persona?.mbti?.type;
    const mbtiDesc = persona?.mbti?.description;
    if (mbtiEnabled && (mbtiType || mbtiDesc)) {
        sections.push('# 16. MBTI');
        sections.push('mbti:');
        if (mbtiType) sections.push(`  type: ${mbtiType}`);
        if (mbtiDesc) sections.push(`  description: ${mbtiDesc}`);
        sections.push('');
    }

    const psychEnabled = persona?.psychological?.enabled;
    const rawPsych = persona?.psychological?.text || '';
    const psychLines = typeof rawPsych === 'string' ? rawPsych.split('\n').filter((l) => l.trim()) : [];
    if (psychEnabled && psychLines.length > 0) {
        sections.push('# 17. 心理内核');
        sections.push('psychological_core:');
        psychLines.forEach((l) => sections.push(`  - ${l}`));
        sections.push('');
    }

    const moralEnabled = persona?.moral?.enabled;
    const rawMoral = persona?.moral?.text || '';
    const moralLines = typeof rawMoral === 'string' ? rawMoral.split('\n').filter((l) => l.trim()) : [];
    if (moralEnabled && moralLines.length > 0) {
        sections.push('# 18. 道德底线');
        sections.push('moral_boundary:');
        moralLines.forEach((l) => sections.push(`  - ${l}`));
        sections.push('');
    }

    const skillsEnabled = persona?.skills?.enabled;
    const rawSkills = persona?.skills?.text || '';
    const skillLines = typeof rawSkills === 'string' ? rawSkills.split('\n').filter((l) => l.trim()) : [];
    if (skillsEnabled && skillLines.length > 0) {
        sections.push('# 19. 技能与兴趣');
        sections.push('skills_and_interests:');
        skillLines.forEach((l) => sections.push(`  - ${l}`));
        sections.push('');
    }

    if (Array.isArray(persona.rules) && persona.rules.length > 0) {
        sections.push('# 行为规则');
        persona.rules.forEach((r) => sections.push(`- ${r}`));
        sections.push('');
    }

    const spaceInject = persona?.space?.injectMode || 'none';
    if (spaceInject === 'current' && persona?.boundWorldId) {
        const worldId = persona.boundWorldId;
        const world = sdk?.worlds?.get?.(worldId);
        const accessible = getAccessibleLocationsForPersona(sdk, worldId, persona.id, { includeRare: false });
        const todayDiary = sdk?.diary?.getToday?.(entityType, persona.id) || null;
        const todaySchedule = Array.isArray(todayDiary?.todaySchedule) ? todayDiary.todaySchedule : [];
        const hourNames = sdk?.chronology?.getHourNames?.(worldId) || [];

        sections.push('# 20. 空间');
        sections.push('space:');
        if (world?.name) sections.push(`  world: ${world.name}`);
        if (world?.description) sections.push(`  world_desc: ${world.description}`);

        const primaryPlace = accessible.find((a) => a.place)?.place || null;
        if (primaryPlace?.name) sections.push(`  current_place: ${primaryPlace.name}`);

        const curSeg = todaySchedule.find((seg) => {
            const now = new Date();
            const cur = now.getHours() * 60 + now.getMinutes();
            const fromH = Number(seg?.fromHour);
            const toH = Number(seg?.toHour);
            if (!Number.isFinite(fromH) || !Number.isFinite(toH)) return false;
            return cur >= fromH * 60 && cur <= toH * 60 + 59;
        }) || null;
        if (curSeg) {
            const locName = curSeg.locationName || curSeg.placeName || '';
            sections.push(`  current_schedule: [${curSeg.fromHour}-${curSeg.toHour}${hourNames[Math.floor(curSeg.fromHour / 2) % 12] ? ' ' + hourNames[Math.floor(curSeg.fromHour / 2) % 12] : ''}] ${locName} · ${curSeg.activity || ''}`);
        } else {
            sections.push('  current_schedule: （当前空闲）');
        }

        const sortedEvents = [...todaySchedule].sort((a, b) => (a.fromHour || 0) - (b.fromHour || 0));
        if (sortedEvents.length > 0) {
            sections.push('  today_schedule:');
            sortedEvents.forEach((e) => {
                const chrono = hourNames[Math.floor((Number(e.fromHour) || 0) / 2) % 12] || '';
                const locName = e.locationName || e.placeName || '';
                sections.push(`    - [${e.fromHour}-${e.toHour}${chrono ? ' ' + chrono : ''}] ${locName} · ${e.activity || ''}`);
            });
        } else {
            sections.push('  today_schedule: （今日未规划）');
        }

        if (accessible.length > 0) {
            sections.push('  accessible_places:');
            accessible.forEach((a) => {
                const locName = a.place?.name || a.location?.name || '';
                if (locName) sections.push(`    - ${locName}`);
            });
        }
        sections.push('');
    }

    return sections.filter((s) => s !== '').join('\n');
}

/**
 * murmur / 变量系统实际发出去的人设正文。
 * 用户在 nook 里保存过 customContext 就用那份，否则跟预览 pre 同一套生成。
 */
export function resolvePersonaContextText(persona, entityType) {
    if (!persona) return '';
    const custom = typeof persona.customContext === 'string' ? persona.customContext.trim() : '';
    if (custom) return custom;
    try {
        return buildContextFromPersona(persona, entityType === 'ai' ? 'ai' : 'user');
    } catch (err) {
        console.warn('[persona-context] 生成人设卡失败，回退短卡', err);
        const name = persona.name || persona.chineseName || '';
        const bits = [`# 角色卡${name ? ': ' + name : ''}`];
        if (persona.personality) bits.push(`personality: ${persona.personality}`);
        if (persona.bio) bits.push(`bio: ${persona.bio}`);
        if (persona.experience) bits.push(`experience: ${persona.experience}`);
        return bits.join('\n');
    }
}
