/**
 * Settings App · 人设主页 · 业务方法
 *
 * 走 settingsSdk（user / ai / world / diary / persona）
 * + toolkit.persona.asset.* 桥接。
 *
 * 注：日记段（生成 / 重 roll / 编辑 / 删除 / 选日历）已经从人设主页拆出，
 *     下沉到独立的「日记 App」中。人设主页只保留 mood 相关方法。
 */

import { getSettingsSdk } from '../world/sdk/settings-sdk.js';
import { bootstrapSettingsSdk } from '../world/sdk/bootstrap.js';
import { installPersonaDiaryApi } from './persona-bridge.js';
import { getApiSdk } from '../api-manager/api-manager-section.js';
import { formatDate } from './diary-generator.js';
import { escapeHtml } from '@/src/core/escape.js';
import {
    settlePersona,
    migrateLegacyAssets,
    formatAmount,
    formatYmd,
} from './income-engine.js';
import { buildPersonaContextText, buildContextFromPersona } from './home-section.js';

function refresh() {
    window.refreshPhoneApps?.();
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) appsRef.value = [...appsRef.value];
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') tickRef.value = tickRef.value + 1;
}

function notify(toolkit, kind) {
    toolkit?.island?.notify?.('success', kind);
}

/** 确保 settingsSdk 已就绪；未初始化则用当前 toolkit 主动 bootstrap 一次。*/
async function ensureSdkReady(toolkit) {
    if (getSettingsSdk()) return getSettingsSdk();
    try {
        const sdk = await bootstrapSettingsSdk({ toolkit });
        return sdk;
    } catch (err) {
        console.warn('[personaHome] bootstrapSettingsSdk 失败', err);
        return null;
    }
}

/** 根据 entityType 取 sdk。*/
function entityApi(sdk, entityType) {
    return entityType === 'user' ? sdk.users : sdk.aiPersons;
}

/** 切换进某个具体人设主页（保留在 settings 详情页栈里）。*/
function pushHome(app, entityType, entityId) {
    const route = app.state.personaHome || (app.state.personaHome = {});
    route.entityType = entityType;
    route.entityId   = entityId;
    refresh();
}

/** 派发一个 detail 动作，让 framework 把当前栈切到指定 pageId。*/
function navigateToDetail(pageId) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('app:page-action', {
        detail: { action: 'detail', appId: 'settings', pageId },
    }));
}

export function buildPersonaHomeMethods() {
    return {
        /** 路由切换：从 AI / User 编辑器切到对应主页。*/
        async personaHomeOpen(payload = {}) {
            const app = this.app;
            const toolkit = this.toolkit;
            // ★ v0.18.1 先确保 SDK 已就绪，未就绪则主动 bootstrap 一次
            await ensureSdkReady(toolkit);
            installPersonaDiaryApi(toolkit);
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (payload.entityType && payload.entityId) {
                pushHome(app, payload.entityType, payload.entityId);
            } else             if (payload.entityType === 'ai' || payload.entityType === 'user') {
                if (sdk) {
                    const inst = entityApi(sdk, payload.entityType).getActive();
                    if (inst) pushHome(app, payload.entityType, inst.id);
                }
            }
            // ★ 资产系统 v2：进入主页时自动迁移 + 结算（不需要 await 结果，渲染层会从 cache 读到最新值）
            try {
                await this.personaAssetSettle({});
            } catch (err) {
                console.warn('[personaHome] personaAssetSettle failed', err);
            }
            // 推一个 detail 事件，让 framework 把栈切到 personaHome
            navigateToDetail('personaHome');
            return app.state.personaHome;
        },

        /** 心情权重编辑（打开输入弹层 —— 这里直接 update）。*/
        async personaSetMoodWeights(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return null;
            const { entityType, weights } = payload;
            const id = this.app.state.personaHome?.entityId;
            if (!id) return null;
            await sdk.persona.probability.setWeights(entityType, id, weights || {});
            refresh();
            return weights;
        },

        /**
         * 重 roll 今日心情（弹窗收集用户意见 → API 生成）
         */
        async personaRollTodayMood(payload = {}) {
            const app = this.app;
            const sdk = getSettingsSdk() || window.settingsSdk;
            const toolkit = this.toolkit;
            if (!sdk?.diary) return null;

            const entityType = payload.entityType || app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || app.state.personaHome?.entityId;
            if (!entityId) return null;

            // 打开弹窗收集用户意见
            const modalAction = toolkit.actions.modal('prompt', {
                title: '重roll心情',
                text: '有什么想法想让 AI 更好地生成心情？',
                placeholder: '例如：最近工作压力大，想要轻松一点的...（可选）',
                confirmLabel: '重roll',
                cancelLabel: '取消',
                onConfirm: async (userNote) => {
                    // 用户确认后开始生成
                    toolkit.island.show('medium', {
                        type: 'info',
                        title: '重新生成中',
                        message: '正在让 AI 重新分析...',
                        icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                    });

                    try {
                        // 构建上下文
                        const api = entityApi(sdk, entityType);
                        const persona = api.get(entityId);
                        const world = persona?.boundWorldId ? sdk.worlds.get(persona.boundWorldId) : null;
                        const today = sdk.diary.getToday(entityType, entityId);
                        const schedule = sdk.schedule?.getDay?.(entityType, entityId, today?.date || new Date().toLocaleDateString('en-CA'));

                        // 获取绑定的 API
                        const boundApiRef = persona?.boundResources?.apiRefs?.[0];
                        let apiKeyId = null;
                        if (boundApiRef) {
                            if (typeof boundApiRef === 'string') {
                                apiKeyId = boundApiRef;
                            } else if (boundApiRef.refType === 'key' && boundApiRef.refId) {
                                apiKeyId = boundApiRef.refId;
                            } else if (boundApiRef.refType === 'group' && boundApiRef.refId) {
                                const apiSdk = getApiSdk();
                                const group = apiSdk?.apiGroupSdk?.get?.(boundApiRef.refId);
                                apiKeyId = group?.apiKeyIds?.[0] || null;
                            } else if (boundApiRef.id) {
                                apiKeyId = boundApiRef.id;
                            }
                        }

                        const systemPrompt = `你是一个细腻的情感分析师。根据用户提供的今日信息，用自己的感受去体会这一天，分析并生成：

1. 用简洁的词语描述你感受到的情绪（如："今天阳光很好，心里暖洋洋的"、"项目上线了，有成就感"、"有点疲惫但充实"等）
2. 心情强度（0.1~1.0，0.1最淡/1.0最浓）
3. 是否是正面情绪（true/false）
4. 一段心情日记（50-200字，以第一人称描述当日的心情、感受或事件）

请以JSON格式返回：
{
  "mood": "情绪描述词语",
  "moodIntensity": 0.0~1.0的数值,
  "isPositive": true或false,
  "diary": "一段心情日记"
}`;

                        // 构建用户 prompt，加入用户意见
                        let userPrompt = buildMoodAnalysisPrompt({ persona, world, schedule, today });
                        if (userNote && userNote.trim()) {
                            userPrompt += `\n\n用户补充意见：${userNote.trim()}`;
                        }

                        // 调用 API
                        let result = null;
                        if (apiKeyId) {
                            const apiSdk = getApiSdk();
                            const apiKey = apiSdk?.apiKeySdk?.get?.(apiKeyId);
                            if (apiKey) {
                                result = await callMoodApi({ apiKey, systemPrompt, userPrompt });
                            }
                        }

                        if (!result) {
                            toolkit.island.dismiss();
                            toolkit.island.notify('error', 'API 未配置', '请先在资源管理中添加 API Key');
                            return;
                        }

                        // 设置待保存状态
                        app.state.personaHome = app.state.personaHome || {};
                        app.state.personaHome.moodPendingSave = {
                            mood: result.mood,
                            moodIntensity: result.moodIntensity,
                            isPositive: result.isPositive !== undefined ? result.isPositive : (result.moodIntensity > 0.5),
                            diary: result.diary || '',
                        };

                        toolkit.island.dismiss();
                        toolkit.island.notify('info', '已重新生成', '点击保存以持久化');
                        refresh();

                    } catch (err) {
                        console.error('[personaRollTodayMood] 生成失败', err);
                        toolkit.island.dismiss();
                        toolkit.island.notify('error', '生成失败', err.message || '请稍后重试');
                    }
                }
            });

            // 派发弹窗
            if (modalAction) {
                window.dispatchEvent(new CustomEvent('app:page-action', { detail: modalAction }));
            }
        },

        /**
         * 打开心情编辑模式（内联编辑）
         */
        async personaEditMood(payload = {}) {
            const app = this.app;
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.diary) return null;

            const entityType = app.state.personaHome?.entityType || 'user';
            const entityId   = app.state.personaHome?.entityId;
            if (!entityId) return null;

            const route = app.state.personaHome || {};
            
            // 保存要编辑的日期
            const editDate = payload.date || formatDate();
            route.moodEditDate = editDate;

            // 如果有待保存数据（AI生成/重roll），编辑时用待保存数据
            if (route.moodPendingSave) {
                // 临时把 pendingSave 塞到 moodEditRecord，让编辑表单能读取
                route.moodEditRecord = {
                    mood: route.moodPendingSave.mood,
                    moodIntensity: route.moodPendingSave.moodIntensity,
                    diary: route.moodPendingSave.diary,
                    isPositive: route.moodPendingSave.isPositive,
                    date: editDate,
                };
            } else {
                // 从数据库读取该日期的心情数据
                const diary = sdk.diary.getDateDiary?.(entityType, entityId, editDate);
                route.moodEditRecord = diary ? {
                    mood: diary.mood || '',
                    moodIntensity: diary.moodIntensity ?? 0.5,
                    diary: diary.diary || '',
                    isPositive: diary.isPositive,
                    date: editDate,
                } : { date: editDate };
            }

            // 切换到编辑模式
            route.moodEditMode = true;
            refresh();
            return true;
        },

        /**
         * 保存编辑后的心情（也用于保存 AI 生成/重 roll 的心情）
         */
        async personaSaveMoodEdit(payload = {}) {
            const app = this.app;
            const toolkit = this.toolkit;
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.diary) return null;

            const entityType = app.state.personaHome?.entityType || 'user';
            const entityId   = app.state.personaHome?.entityId;
            if (!entityId) return null;

            const route = app.state.personaHome || {};

            // 优先使用待保存数据（AI生成/重roll）
            const pendingData = route.moodPendingSave;
            const isEditing = route.moodEditMode;

            let mood, moodIntensity, diary;

            if (pendingData) {
                // 使用待保存数据
                mood = pendingData.mood;
                moodIntensity = pendingData.moodIntensity;
                diary = pendingData.diary;
            } else if (isEditing) {
                // 从 DOM 获取编辑表单的值
                const overlay = document.querySelector('.phome-mood-edit-inline');
                if (!overlay) {
                    toolkit.island.notify('warning', '未找到编辑表单');
                    return null;
                }
                mood = overlay.querySelector('[data-edit-mood]')?.value?.trim() || '';
                moodIntensity = parseInt(overlay.querySelector('[data-edit-intensity]')?.value || '50') / 100;
                diary = overlay.querySelector('[data-edit-diary]')?.value?.trim() || '';
            } else {
                toolkit.island.notify('warning', '没有待保存的心情');
                return null;
            }

            if (!mood) {
                toolkit.island.notify('warning', '心情不能为空');
                return null;
            }

            // 获取编辑的日期
            const editDate = route.moodEditDate || formatDate();
            const today = formatDate();

            // 保存到数据库
            await sdk.diary.setMoodDetail(entityType, entityId, {
                mood,
                moodIntensity,
                isPositive: moodIntensity > 0.5,
                diary,
                date: editDate,
            });

            // 只有编辑的是今天时才更新 persona.dailyMood
            if (editDate === today) {
                await sdk.diary.setMood(entityType, entityId, mood);
                const personaApi = entityApi(sdk, entityType);
                if (personaApi?.update) {
                    await personaApi.update(entityId, { dailyMood: mood });
                }
            }

            // 清除编辑模式和待保存状态
            route.moodEditMode = false;
            route.moodPendingSave = null;
            route.moodEditRecord = null;
            route.moodEditDate = null;

            refresh();
            toolkit.island.notify('success', '心情已保存', mood);
            return true;
        },

        /**
         * 取消编辑/重置待保存状态
         */
        async personaCancelMoodEdit(payload = {}) {
            const app = this.app;
            app.state.personaHome = app.state.personaHome || {};
            app.state.personaHome.moodEditMode = false;
            app.state.personaHome.moodPendingSave = null;
            app.state.personaHome.moodEditRecord = null;
            app.state.personaHome.moodEditDate = null;
            refresh();
            return true;
        },

        /** 直接设置今日心情字符串（不重抽）。*/
        async personaSetTodayMood(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.diary || !sdk?.persona) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            const mood = payload.mood || '';
            await sdk.diary.setMood(entityType, entityId, mood);
            await entityApi(sdk, entityType).update(entityId, { dailyMood: mood });
            refresh();
            return mood;
        },

        /**
         * 设置今日心情详情（心情 + 浓度 + 日记）
         * payload: { mood, moodIntensity?, isPositive?, diary? }
         */
        async personaSetMoodDetail(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.diary) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            const result = await sdk.diary.setMoodDetail(entityType, entityId, payload);
            refresh();
            return result;
        },

        /**
         * 使用 AI 生成今日心情（调用人设绑定的 API）
         */
        async personaGenerateMood(payload = {}) {
            const app = this.app;
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.diary) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) return null;

            const toolkit = this.toolkit;
            toolkit.island.show('medium', {
                type: 'info',
                title: '生成中',
                message: '正在让 AI 分析今日心情...',
                icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            });

            try {
                // 构建上下文
                const api = entityApi(sdk, entityType);
                const persona = api.get(entityId);
                const world = persona?.boundWorldId ? sdk.worlds.get(persona.boundWorldId) : null;
                const today = sdk.diary.getToday(entityType, entityId);
                const schedule = sdk.schedule?.getDay?.(entityType, entityId, today?.date || new Date().toLocaleDateString('en-CA'));

                // 从人设获取绑定的 API
                const boundApiRef = persona?.boundResources?.apiRefs?.[0];
                let apiKeyId = null;
                if (boundApiRef) {
                    // apiRef 可能是字符串（直接是 id）也可能是对象 {refType, refId}
                    if (typeof boundApiRef === 'string') {
                        apiKeyId = boundApiRef;
                    } else if (boundApiRef.refType === 'key' && boundApiRef.refId) {
                        apiKeyId = boundApiRef.refId;
                    } else if (boundApiRef.refType === 'group' && boundApiRef.refId) {
                        // 如果是 group，需要获取组内第一个 key
                        const apiSdk = getApiSdk();
                        const group = apiSdk?.apiGroupSdk?.get?.(boundApiRef.refId);
                        apiKeyId = group?.apiKeyIds?.[0] || null;
                    } else if (boundApiRef.id) {
                        // 可能是直接存了 API Key 对象
                        apiKeyId = boundApiRef.id;
                    }
                }

                console.log('[personaGenerateMood] 调试信息:');
                console.log('  - persona:', persona?.name, persona?.id);
                console.log('  - boundApiRef:', boundApiRef);
                console.log('  - apiKeyId:', apiKeyId);
                console.log('  - entityType:', entityType);
                console.log('  - entityId:', entityId);

                // 构建 prompt
                const systemPrompt = `你是一个细腻的情感分析师。根据用户提供的今日信息，用自己的感受去体会这一天，分析并生成：

1. 用简洁的词语描述你感受到的情绪（如："今天阳光很好，心里暖洋洋的"、"项目上线了，有成就感"、"有点疲惫但充实"等）
2. 心情强度（0.1~1.0，0.1最淡/1.0最浓）
3. 是否是正面情绪（true/false）
4. 一段心情日记（50-200字，以第一人称描述当日的心情、感受或事件）

请以JSON格式返回：
{
  "mood": "情绪描述词语",
  "moodIntensity": 0.0~1.0的数值,
  "isPositive": true或false,
  "diary": "一段心情日记"
}`;

                const userPrompt = buildMoodAnalysisPrompt({ persona, world, schedule, today });

                // 调用 API
                let result = null;
                if (apiKeyId) {
                    console.log('[personaGenerateMood] 尝试调用 API, apiKeyId:', apiKeyId);
                    const apiSdk = getApiSdk();
                    console.log('[personaGenerateMood] apiSdk:', !!apiSdk);
                    const apiKey = apiSdk?.apiKeySdk?.get?.(apiKeyId);
                    console.log('[personaGenerateMood] apiKey:', apiKey ? { id: apiKey.id, name: apiKey.label || apiKey.name } : null);
                    if (apiKey) {
                        console.log('[personaGenerateMood] 正在调用 callMoodApi...');
                        result = await callMoodApi({
                            apiKey,
                            systemPrompt,
                            userPrompt,
                        });
                        console.log('[personaGenerateMood] API 返回结果:', result);
                    } else {
                        console.log('[personaGenerateMood] apiKey 获取失败');
                    }
                } else {
                    console.log('[personaGenerateMood] 没有 apiKeyId，跳过 API 调用');
                }

                // 必须使用 API 生成，不允许本地生成
                if (!result) {
                    console.error('[personaGenerateMood] API 调用失败，但没有本地生成备选');
                    toolkit.island.dismiss();
                    toolkit.island.notify('error', 'API 未配置', '请先在资源管理中添加 API Key');
                    return null;
                }

                // 设置待保存状态（不直接存库）
                app.state.personaHome = app.state.personaHome || {};
                app.state.personaHome.moodPendingSave = {
                    mood: result.mood,
                    moodIntensity: result.moodIntensity,
                    isPositive: result.isPositive !== undefined ? result.isPositive : (result.moodIntensity > 0.5),
                    diary: result.diary || '',
                };

                toolkit.island.dismiss();
                toolkit.island.notify('info', '心情已生成', '点击保存以持久化到日历');
                refresh();
                return result;

            } catch (err) {
                console.error('[personaGenerateMood] 生成失败', err);
                toolkit.island.dismiss();
                toolkit.island.notify('error', '生成失败', err.message || '请稍后重试');
                return null;
            }
        },

        /**
         * 切换月历显示月份
         */
        personaCalendarChangeMonth(payload = {}) {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            if (payload.year !== undefined) route.calendarYear = payload.year;
            if (payload.month !== undefined) route.calendarMonth = payload.month;
            refresh();
            return { year: route.calendarYear, month: route.calendarMonth };
        },

        /**
         * 点击月历上的日期，查看当日心情详情
         */
        personaCalendarSelectDate(payload = {}) {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const date = payload.date || '';
            if (route.calendarSelectedDate === date) {
                delete route.calendarSelectedDate;
            } else {
                route.calendarSelectedDate = date;
            }
            refresh();
            return route.calendarSelectedDate;
        },

        /**
         * 切换心情日历注入模式
         * none -> today -> month -> full
         */
        async personaMoodCalendarCycleInject(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const pid = route.entityId;
            if (!pid) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(pid);
            if (!persona) return false;

            const current = persona.moodCalendar?.injectMode || 'none';
            const cycle = { none: 'today', today: 'month', month: 'full', full: 'none' };
            const next = cycle[current] || 'none';
            try {
                await sdk.persona.module.update(et, pid, 'moodCalendar', { injectMode: next });
            } catch (err) {
                console.warn('[personaMoodCalendarCycleInject]', err);
                return false;
            }
            refresh();
            return true;
        },

        /** 把 home 的 entity 临时切到另一个（不离开 personaHome detail 页）。*/
        personaHomePickEntity(payload = {}) {
            const app = this.app;
            if (payload.entityType && payload.entityId) {
                pushHome(app, payload.entityType, payload.entityId);
                notify(this.toolkit, '已切换');
            }
            return app.state.personaHome;
        },

        /* ============================================
         * ★ v0.19 人设日程（schedule）—— 仅人设主页可编辑
         *   - 数据挂在 user/ai persona 上（sdk.schedule.addEvent ...）
         *   - world 侧的 wv-schedule 只读消费（见 world/library.js）
         * ============================================ */

        /**
         * 给某一天追加一条日程。
         * payload: { date?: 'YYYY-MM-DD', title, startTime?, endTime?, note?, kind? }
         * 未传 date 时使用今天。
         */
        async personaScheduleAddEvent(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.schedule) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) {
                notify(this.toolkit, 'warning', '请先选择人设');
                return null;
            }
            const date = payload.date || (sdk.diary?.getToday?.(entityType, entityId)?.date)
                || new Date().toLocaleDateString('en-CA');
            if (!payload.title) {
                notify(this.toolkit, 'error', '标题不能为空', '');
                return null;
            }
            const next = await sdk.schedule.addEvent(entityType, entityId, date, payload);
            // 切到刚加的日期展开
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            route.scheduleOpenDate = date;
            refresh();
            notify(this.toolkit, 'success', '已添加日程', payload.title);
            return next;
        },

        /** 编辑一条日程。payload: { date, eventId, ...patch } */
        async personaScheduleUpdateEvent(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.schedule || !payload.date || !payload.eventId) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            const next = await sdk.schedule.updateEvent(entityType, entityId, payload.date, payload.eventId, payload);
            refresh();
            notify(this.toolkit, 'success', '已保存日程', '');
            return next;
        },

        /** 删除一条日程。payload: { date, eventId } */
        async personaScheduleRemoveEvent(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.schedule || !payload.date || !payload.eventId) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            await sdk.schedule.removeEvent(entityType, entityId, payload.date, payload.eventId);
            refresh();
            notify(this.toolkit, 'success', '已删除日程', '');
            return true;
        },

        /**
         * 选择 / 切换「展开的日期」。展开 = 下方展示当日日程卡片。
         * payload: { date } 或 { clear: true } 收起。
         * 行为仅写入 app.state.personaHome.scheduleOpenDate。
         */
        personaScheduleToggleOpen(payload = {}) {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            if (payload.clear) {
                delete route.scheduleOpenDate;
            } else if (payload.date) {
                route.scheduleOpenDate = route.scheduleOpenDate === payload.date ? '' : payload.date;
                if (!route.scheduleOpenDate) delete route.scheduleOpenDate;
            }
            refresh();
            return route.scheduleOpenDate || '';
        },

        /* ============================================
         * injectMode 切换（通用）
         *   支持: schedule, mood
         * ============================================ */

        /** 循环切换 schedule injectMode: none → current → nearby → full → none。*/
        async personaScheduleCycleInject(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const pid = route.entityId;
            if (!pid) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(pid);
            if (!persona) return false;
            const current = persona.schedule?.injectMode || 'none';
            const cycle = { none: 'current', current: 'nearby', nearby: 'full', full: 'none' };
            const next = cycle[current] || 'none';
            try {
                await sdk.persona.module.update(et, pid, 'schedule', { injectMode: next });
            } catch (err) {
                console.warn('[personaScheduleCycleInject]', err);
                return false;
            }
            refresh();
            return true;
        },

        /** 循环切换 mood injectMode: none → current → none。*/
        async personaMoodCycleInject(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const pid = route.entityId;
            if (!pid) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(pid);
            if (!persona) return false;
            const current = persona.mood?.injectMode || 'current';
            const next = current === 'current' ? 'none' : 'current';
            try {
                await sdk.persona.module.update(et, pid, 'mood', { injectMode: next });
            } catch (err) {
                console.warn('[personaMoodCycleInject]', err);
                return false;
            }
            refresh();
            return true;
        },

        /* ============================================
         * 作息模块 v2（结构化数据 + injectMode）
         *   - 数据: persona.rhythm = { enabled, injectMode, entries: [{ id, startTime, endTime, daysOfWeek, description }] }
         *   - injectMode: 'none' | 'current' | 'full'
         *   - 编辑态: rhythmEditing=true / rhythmDraft={ fields }
         * ============================================ */

        personaRhythmEdit() {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            route.rhythmEditing = true;
            delete route.rhythmDraft;
            refresh();
            return true;
        },

        personaRhythmFinishEdit() {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            delete route.rhythmEditing;
            delete route.rhythmDraft;
            refresh();
            return true;
        },

        personaRhythmAddDraft() {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            route.rhythmEditing = true;
            route.rhythmDraft = {};
            refresh();
            return true;
        },

        async personaRhythmRemove(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const id = route.entityId;
            if (!id) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(id);
            if (!persona) return false;
            const entries = Array.isArray(persona.rhythm?.entries) ? persona.rhythm.entries : [];
            const filtered = entries.filter(e => e.id !== payload.id);
            try {
                await sdk.persona.module.update(et, id, 'rhythm', { entries: filtered });
            } catch (err) {
                console.warn('[personaRhythmRemove]', err);
                return false;
            }
            delete route.rhythmDraft;
            refresh();
            return true;
        },

        async personaRhythmSaveDraft(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const pid = route.entityId;
            if (!pid) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(pid);
            if (!persona) return false;

            const startTimeEl = document.querySelector('[data-rhythm-field="startTime"]');
            const endTimeEl = document.querySelector('[data-rhythm-field="endTime"]');
            const descEl = document.querySelector('[data-rhythm-field="description"]');
            const dayEls = Array.from(document.querySelectorAll('[data-rhythm-day]:checked'));
            const allDayEl = document.querySelector('[data-rhythm-day-all]');

            const startTime = startTimeEl?.value || '';
            const endTime = endTimeEl?.value || '';
            const description = descEl?.value?.trim() || '';
            const daysOfWeek = allDayEl?.checked ? [] : dayEls.map(el => Number(el.value));

            if (!startTime || !description) {
                delete route.rhythmDraft;
                refresh();
                return true;
            }

            const entries = Array.isArray(persona.rhythm?.entries) ? persona.rhythm.entries.slice() : [];
            const editId = route.rhythmDraft?.id;
            const newEntry = {
                id: editId || `rhythm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
                startTime, endTime, daysOfWeek, description,
            };

            if (editId) {
                const idx = entries.findIndex(e => e.id === editId);
                if (idx >= 0) entries[idx] = newEntry;
            } else {
                entries.push(newEntry);
            }

            try {
                await sdk.persona.module.update(et, pid, 'rhythm', { entries });
            } catch (err) {
                console.warn('[personaRhythmSaveDraft]', err);
                return false;
            }
            delete route.rhythmDraft;
            refresh();
            return true;
        },

        personaRhythmCancelDraft() {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            delete route.rhythmDraft;
            refresh();
            return true;
        },

        async personaRhythmToggleEnabled() {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const pid = route.entityId;
            if (!pid) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(pid);
            if (!persona) return false;
            const currentEnabled = !!persona.rhythm?.enabled;
            try {
                await sdk.persona.module.update(et, pid, 'rhythm', {
                    enabled: !currentEnabled,
                    injectMode: currentEnabled ? 'none' : 'current',
                });
            } catch (err) {
                console.warn('[personaRhythmToggleEnabled]', err);
                return false;
            }
            refresh();
            return true;
        },

        async personaRhythmCycleInject(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const pid = route.entityId;
            if (!pid) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(pid);
            if (!persona) return false;
            const current = persona.rhythm?.injectMode || 'none';
            const cycle = { none: 'current', current: 'full', full: 'none' };
            const next = cycle[current] || 'none';
            try {
                await sdk.persona.module.update(et, pid, 'rhythm', { injectMode: next });
            } catch (err) {
                console.warn('[personaRhythmCycleInject]', err);
                return false;
            }
            refresh();
            return true;
        },

        /* ============================================
         * 资产系统 v2（无 emoji · 无固定标签 · 单 balance + 任意 income events）
         *   - 数据: persona.assetBalance + persona.incomeEvents[]
         *   - income event 自由度: name / amount / frequency
         *     (monthly|weekly|daily|once) / dayOfMonth / dayOfWeek / enabled
         *   - 打开页面时自动 settle(把上次到现在该发的钱合到 assetBalance)
         *   - 其他 app 通过 toolkit.persona.asset.adjust(delta) 增减
         * ============================================ */

        /**
         * 进入主页时调用一次：
         *   1) 检测旧 persona.assets[] -> 自动迁移到 assetBalance + incomeEvents
         *   2) 计算并把积欠收入合到 assetBalance（推进 assetLastSettledAt）
         * 返回 { migrated, settled }。
         */
        async personaAssetSettle(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            const api = entityApi(sdk, entityType);
            let inst = api.get(entityId);
            if (!inst) return null;

            const result = { migrated: false, settled: false, droppedFields: [], accrued: 0 };
            // 1) 旧字段迁移
            const mig = migrateLegacyAssets(inst);
            if (mig.changed) {
                // 先在内存里删旧字段
                for (const f of mig.dropFields || []) delete inst[f];
                Object.assign(inst, mig.patch);
                await api.update(entityId, { ...mig.patch });
                result.migrated = true;
                result.droppedFields = mig.dropFields || [];
            }
            // 2) 积欠结算
            const { next, accrued } = settlePersona(inst, Date.now());
            if (accrued !== 0) {
                await api.update(entityId, {
                    assetBalance: next.assetBalance,
                    assetLastSettledAt: next.assetLastSettledAt,
                });
                result.settled = true;
                result.accrued = accrued;
            } else if (!inst.assetLastSettledAt) {
                // 首次打开页面也写一下锚点
                await api.update(entityId, { assetLastSettledAt: Date.now() });
            }
            return result;
        },

        /**
         * 设置/调整基础余额。
         *   payload: { balance: number }
         * 注意：会先 settle 一次积欠，再覆盖 assetBalance。
         */
        async personaAssetSetBalance(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk || typeof payload.balance !== 'number') return false;
            const entityType = this.app.state.personaHome?.entityType || 'user';
            const entityId   = this.app.state.personaHome?.entityId;
            if (!entityId) return false;
            const api = entityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return false;
            // 先 settle
            const { next, accrued } = settlePersona(inst, Date.now());
            const patch = {
                assetBalance: payload.balance,
                assetLastSettledAt: next.assetLastSettledAt,
            };
            await api.update(entityId, patch);
            refresh();
            notify(this.toolkit, 'success', '已更新余额',
                accrued > 0 ? `已结算 +${formatAmount(accrued)}` : '');
            return true;
        },

        /**
         * 直接调整余额（用于外部 app 的交易：购物扣款、红包收入等）。
         *   payload: { delta: number, note?: string }
         *   delta 为正表示增加，负表示减少；不允许扣到 < 0。
         * 同时也推进 assetLastSettledAt，避免下次结算时把差额再算进来。
         */
        async personaAssetAdjustBalance(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk || typeof payload.delta !== 'number') return false;
            const entityType = this.app.state.personaHome?.entityType || 'user';
            const entityId   = this.app.state.personaHome?.entityId;
            if (!entityId) return false;
            const api = entityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return false;

            // 先 settle，再加 delta
            const { next: settled } = settlePersona(inst, Date.now());
            const baseBalance = settled.assetBalance || 0;
            const newBalance = Math.max(0, baseBalance + payload.delta);
            const patch = {
                assetBalance: newBalance,
                assetLastSettledAt: settled.assetLastSettledAt,
            };
            await api.update(entityId, patch);
            refresh();
            const sign = payload.delta > 0 ? '+' : '';
            const note = payload.note ? ` (${payload.note})` : '';
            notify(this.toolkit, payload.delta > 0 ? 'success' : 'warning',
                `${sign}${formatAmount(payload.delta)}`, `余额 ${formatAmount(newBalance)}${note}`);
            return newBalance;
        },

        /**
         * 添加一条收入事件。
         *   payload: {
         *     name: string,
         *     amount: number,
         *     frequency: 'monthly'|'weekly'|'daily'|'once',
         *     startDate?: 'YYYY-MM-DD',
         *     dayOfMonth?: 1..31,   // frequency=monthly
         *     dayOfWeek?: 0..6,     // frequency=weekly
         *     enabled?: boolean,
         *     createdBy?: string,
         *     source?: string,
         *   }
         * 创建后自动 settle 一次（让今天立即到账的也合进来）。
         */
        async personaIncomeAdd(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk) return null;
            const entityType = this.app.state.personaHome?.entityType || 'user';
            const entityId   = this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            const api = entityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return null;

            const freq = payload.frequency || 'monthly';
            const event = {
                id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                name: (payload.name || '').trim() || '收入',
                amount: Number(payload.amount) || 0,
                frequency: freq,
                startDate: payload.startDate || formatYmd(new Date()),
                dayOfMonth: freq === 'monthly' ? (Number(payload.dayOfMonth) || 1) : null,
                dayOfWeek:  freq === 'weekly'  ? (Number(payload.dayOfWeek)  || 0) : null,
                enabled: payload.enabled !== false,
                createdBy: payload.createdBy || 'settings',
                source: payload.source || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            const list = Array.isArray(inst.incomeEvents) ? inst.incomeEvents.slice() : [];
            list.push(event);

            // 先 settle，再合事件
            const { next } = settlePersona(
                { ...inst, incomeEvents: list }, Date.now()
            );
            await api.update(entityId, {
                incomeEvents: list,
                assetBalance: next.assetBalance,
                assetLastSettledAt: next.assetLastSettledAt,
            });
            refresh();
            notify(this.toolkit, 'success', '已添加收入事件', event.name);
            return event;
        },

        /**
         * 更新一条收入事件。
         *   payload: { eventId, name?, amount?, frequency?, startDate?, dayOfMonth?, dayOfWeek?, enabled? }
         */
        async personaIncomeUpdate(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk || !payload.eventId) return null;
            const entityType = this.app.state.personaHome?.entityType || 'user';
            const entityId   = this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            const api = entityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return null;

            const list = Array.isArray(inst.incomeEvents) ? inst.incomeEvents.slice() : [];
            const idx = list.findIndex(e => e.id === payload.eventId);
            if (idx < 0) return null;
            const prev = list[idx];
            const freq = payload.frequency || prev.frequency;
            const updated = {
                ...prev,
                ...(payload.name !== undefined ? { name: (payload.name || '').trim() || prev.name } : {}),
                ...(payload.amount !== undefined ? { amount: Number(payload.amount) || 0 } : {}),
                ...(payload.frequency !== undefined ? { frequency: freq } : {}),
                ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
                ...(freq === 'monthly'
                    ? { dayOfMonth: Number(payload.dayOfMonth ?? prev.dayOfMonth ?? 1) || 1 }
                    : { dayOfMonth: null }),
                ...(freq === 'weekly'
                    ? { dayOfWeek: Number(payload.dayOfWeek ?? prev.dayOfWeek ?? 0) || 0 }
                    : { dayOfWeek: null }),
                ...(payload.enabled !== undefined ? { enabled: !!payload.enabled } : {}),
                updatedAt: Date.now(),
            };
            list[idx] = updated;

            const { next } = settlePersona(
                { ...inst, incomeEvents: list }, Date.now()
            );
            await api.update(entityId, {
                incomeEvents: list,
                assetBalance: next.assetBalance,
                assetLastSettledAt: next.assetLastSettledAt,
            });
            refresh();
            notify(this.toolkit, 'success', '已保存收入事件', updated.name);
            return updated;
        },

        /**
         * 启用 / 停用一条收入事件。
         *   payload: { eventId, enabled: boolean }
         */
        async personaIncomeToggle(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk || !payload.eventId) return false;
            const entityType = this.app.state.personaHome?.entityType || 'user';
            const entityId   = this.app.state.personaHome?.entityId;
            if (!entityId) return false;
            const api = entityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return false;

            const list = Array.isArray(inst.incomeEvents) ? inst.incomeEvents.slice() : [];
            const idx = list.findIndex(e => e.id === payload.eventId);
            if (idx < 0) return false;
            const prev = list[idx];
            const updated = { ...prev, enabled: payload.enabled !== false, updatedAt: Date.now() };
            list[idx] = updated;

            const { next } = settlePersona(
                { ...inst, incomeEvents: list }, Date.now()
            );
            await api.update(entityId, {
                incomeEvents: list,
                assetBalance: next.assetBalance,
                assetLastSettledAt: next.assetLastSettledAt,
            });
            refresh();
            return true;
        },

        /**
         * 删除一条收入事件。
         *   payload: { eventId }
         */
        async personaIncomeRemove(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk || !payload.eventId) return false;
            const entityType = this.app.state.personaHome?.entityType || 'user';
            const entityId   = this.app.state.personaHome?.entityId;
            if (!entityId) return false;
            const api = entityApi(sdk, entityType);
            const inst = api.get(entityId);
            if (!inst) return false;

            const list = (Array.isArray(inst.incomeEvents) ? inst.incomeEvents : [])
                .filter(e => e.id !== payload.eventId);

            const { next } = settlePersona(
                { ...inst, incomeEvents: list }, Date.now()
            );
            await api.update(entityId, {
                incomeEvents: list,
                assetBalance: next.assetBalance,
                assetLastSettledAt: next.assetLastSettledAt,
            });
            refresh();
            notify(this.toolkit, 'success', '已删除收入事件', '');
            return true;
        },

        /**
         * 打开世界观资产配置页。
         */
        openWorldAssets() {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk) return;
            const route = this.app.state.personaHome;
            if (!route) return;
            const persona = entityApi(sdk, route.entityType || 'user').get(route.entityId);
            if (!persona?.boundWorldId) {
                notify(this.toolkit, 'warning', '提示', '当前人设未绑定世界观');
                return;
            }
            const action = { action: 'detail', appId: 'settings', pageId: `world:assets` };
            window.dispatchEvent(new CustomEvent('app:page-action', { detail: action }));
        },

        /**
         * 接 API 的占位方法 —— 真实 LLM 日记生成接入这里。
         * 当前默认走本地 composeSegment（见 persona/diary-generator.js）。
         * 接入后续步骤：
         *   1. 在 settings app 自身或一个独立 ai-client app 里提供 kit.persona.diary.generate
         *   2. 这里直接 await toolkit.persona.diary.generate(...) 即可（已写好调用）
         */

        /* ============================================
         * ★ v0.19 人设上下文编辑（发送给人设的 YAML 格式数据）
         * ============================================ */

        /** 开始编辑上下文 */
        contextEditStart() {
            const app = this.app;
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk) return;

            const entityType = app.state?.personaHome?.entityType || 'user';
            const entityId = app.state?.personaHome?.entityId;
            const api = entityApi(sdk, entityType);
            const persona = api.get(entityId);

            // 优先取 persona.customContext，其次从 persona 动态生成
            let contextText = persona?.customContext;
            if (!contextText) {
                contextText = buildPersonaContextText(app);
            }

            app.state.personaHome = app.state.personaHome || {};
            app.state.personaHome.contextEditing = true;
            app.state.personaHome.contextDraft = contextText;
            // 缓存进入编辑时的内容（用于回退）
            app.state.personaHome.contextBeforeEdit = persona?.customContext || contextText;
            refresh();
        },

        /** 复制上下文文本 */
        contextCopy() {
            const text = buildPersonaContextText(this.app);
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                notify(this.toolkit, 'success', '已复制', '上下文已复制到剪贴板');
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                notify(this.toolkit, 'success', '已复制', '上下文已复制到剪贴板');
            });
        },

        /** 刷新上下文：清除 customContext 缓存，强制重新生成 */
        contextRefresh() {
            const app = this.app;
            const sdk = window.settingsSdk;
            if (!sdk) return;

            const entityType = app.state?.personaHome?.entityType || 'user';
            const entityId = app.state?.personaHome?.entityId;
            if (!entityId) return;
            const api = entityApi(sdk, entityType);

            // 清除 customContext，恢复使用自动生成的上下文
            api.update(entityId, { customContext: null });

            notify(this.toolkit, 'success', '已刷新', '上下文已重新生成');
            refresh();
        },

        /** 恢复默认（使用系统生成的上下文） */
        contextRestoreDefault() {
            const app = this.app;
            const sdk = window.settingsSdk;
            if (!sdk) return;

            const entityType = app.state?.personaHome?.entityType || 'user';
            const entityId = app.state?.personaHome?.entityId;
            const api = entityApi(sdk, entityType);
            const persona = api.get(entityId);

            // 强制从 persona 动态生成（忽略 customContext）
            let defaultText = '';
            if (persona) {
                defaultText = buildContextFromPersona(persona, entityType);
            }

            app.state.personaHome = app.state.personaHome || {};
            app.state.personaHome.contextEditing = true;
            app.state.personaHome.contextDraft = defaultText;
            refresh();
            notify(this.toolkit, 'info', '已恢复默认', '已切换到系统生成的上下文');
        },

        /** 回退到上次保存的内容（只缓存一次） */
        contextRevert() {
            const app = this.app;
            const prev = app.state?.personaHome?.contextBeforeEdit;
            if (!prev) {
                notify(this.toolkit, 'warning', '无法回退', '没有可回退的版本');
                return;
            }
            // 当前内容变成新的回退点
            const current = app.state.personaHome.contextDraft;
            app.state.personaHome.contextDraft = prev;
            app.state.personaHome.contextBeforeEdit = current;
            refresh();
            notify(this.toolkit, 'success', '已回退', '已恢复到上一个版本');
        },

        /** 取消编辑 */
        contextCancel() {
            const app = this.app;
            app.state.personaHome = app.state.personaHome || {};
            app.state.personaHome.contextEditing = false;
            delete app.state.personaHome.contextDraft;
            refresh();
        },

        /** 保存编辑内容 */
        contextSave() {
            const app = this.app;
            const draft = app.state?.personaHome?.contextDraft;
            if (draft === undefined) return;

            // 保存到 persona.customContext
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (sdk) {
                const entityType = app.state?.personaHome?.entityType || 'user';
                const entityId = app.state?.personaHome?.entityId;
                const api = entityApi(sdk, entityType);
                api.update(entityId, { customContext: draft });
            }

            app.state.personaHome = app.state.personaHome || {};
            app.state.personaHome.contextEditing = false;
            // 保存当前内容供下次回退
            app.state.personaHome.contextBeforeEdit = draft;
            notify(this.toolkit, 'success', '已保存', '');
            refresh();
        },
    };
}

/* 把草稿输入（textarea 字符串 / 数组）切干净：
   - 字符串按行切
   - 每行 trim
   - 过滤空行
   - 已是数组时同样 trim + 过滤 */
function parseRhythmIncoming(raw) {
    if (Array.isArray(raw)) {
        return raw.map(s => String(s || '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

/**
 * 调用 API 生成心情
 */
async function callMoodApi({ apiKey, systemPrompt, userPrompt }) {
    console.log('[callMoodApi] API Key 完整配置:', {
        id: apiKey.id,
        label: apiKey.label || apiKey.name,
        provider: apiKey.provider,
        baseUrl: apiKey.baseUrl,
        hasApiKey: !!apiKey.apiKey,
        model: apiKey.model,
    });

    if (!apiKey.apiKey) {
        throw new Error('API Key 内容为空，请在 API 管理中检查密钥配置');
    }

    const model = apiKey.model || 'gpt-3.5-turbo';
    const body = {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        model,
        temperature: 0.7,
        max_tokens: 500,
    };

    const isAnthropic = apiKey.provider === 'anthropic';
    const endpoint = isAnthropic ? 'messages' : 'chat/completions';
    const baseUrl = (apiKey.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const url = `${baseUrl}/${endpoint}`;

    const headers = { 'Content-Type': 'application/json' };

    // 添加认证头
    if (isAnthropic) {
        headers['x-api-key'] = apiKey.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body.max_tokens = 1024;
        body.messages = [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }];
    } else if (apiKey.provider === 'gemini') {
        headers['x-goog-api-key'] = apiKey.apiKey;
    } else {
        headers['Authorization'] = `Bearer ${apiKey.apiKey}`;
    }

    console.log('[callMoodApi] 发送请求到:', url);

    const startTime = performance.now();
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const latency = Math.round(performance.now() - startTime);

    console.log('[callMoodApi] 响应状态:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败 (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const result = await response.json();
    console.log('[callMoodApi] 响应数据:', result);

    // 解析响应
    let content = '';
    if (isAnthropic) {
        content = result?.content?.[0]?.text || '';
    } else {
        content = result?.choices?.[0]?.message?.content || '';
    }

    console.log('[callMoodApi] 解析内容:', content.slice(0, 200));

    // 尝试解析 JSON
    try {
        // 提取 JSON（可能有 markdown 代码块）
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1];
        else {
            const braceMatch = content.match(/\{[\s\S]*\}/);
            if (braceMatch) jsonStr = braceMatch[0];
        }
        const parsed = JSON.parse(jsonStr);
        return {
            mood: parsed.mood || '平静',
            moodIntensity: Math.max(0.1, Math.min(1, parseFloat(parsed.moodIntensity) || 0.5)),
            diary: parsed.diary || '',
        };
    } catch {
        // 解析失败，尝试从文本提取
        const lines = content.split('\n').filter(Boolean);
        const moodLine = lines.find(l => /心情|情绪|状态/.test(l)) || '';
        const moodMatch = moodLine.match(/[开心平静期待专注小确幸低落焦虑疲惫]+/);
        return {
            mood: moodMatch ? moodMatch[0] : '平静',
            moodIntensity: 0.5,
            diary: content.slice(0, 100),
        };
    }
}

/**
 * 构建心情分析的用户 prompt
 */
function buildMoodAnalysisPrompt({ persona, world, schedule, today }) {
    const parts = [];

    // 人设基本信息
    if (persona) {
        parts.push(`【人设信息】`);
        if (persona.name) parts.push(`名字：${persona.name}`);
        if (persona.personality) parts.push(`性格：${persona.personality}`);
        if (persona.bio) parts.push(`简介：${persona.bio}`);
    }

    // 世界观
    if (world) {
        parts.push(`\n【世界观】`);
        if (world.name) parts.push(`世界观名称：${world.name}`);
        if (world.summary) parts.push(`概要：${world.summary}`);
    }

    // 今日日程
    if (schedule?.events?.length) {
        parts.push(`\n【今日日程】`);
        schedule.events.forEach(e => {
            const time = e.startTime ? `[${e.startTime}${e.endTime ? '-' + e.endTime : ''}]` : '[全天]';
            parts.push(`${time} ${e.title}${e.note ? ' - ' + e.note : ''}`);
        });
    }

    // 当前心情（如果有的话）
    if (today?.mood) {
        parts.push(`\n【当前心情】${today.mood}`);
    }

    parts.push(`\n请根据以上信息，分析并生成该角色今日的心情状态。`);
    return parts.join('\n');
}
