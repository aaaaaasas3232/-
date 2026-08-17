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
import {
    settlePersona,
    migrateLegacyAssets,
    formatAmount,
    formatYmd,
} from './income-engine.js';
import { buildPersonaContextText, buildContextFromPersona } from './home-section.js';
import { getGroupImages, getImageSrcByCode } from '../gallery/gallery-db.js';
// ★ 已删除:clearOnlineStatusCache 导入 — chat-app 不再使用在线状态缓存
import { getSocialProfile } from './social-profile.js';
import { getSocialApp } from '@/src/core/social-app-registry.js';
import {
    callAiRaw,
    parseAiJsonOrFallback,
    resolveApiKeyIdForPersona,
    resolveApiKey,
    gatherContextForAI,
    buildTodayScheduleSystemPrompt,
    buildTodayScheduleUserPrompt,
    sanitizeTodaySchedule,
} from './space-ai.js';
import {
    getAccessibleLocationsForPersona,
    getPlaceWeather,
    readWeatherAppState,
} from './space-sdk.js';

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

        async personaAvatarPickerToggle() {
            const app = this.app;
            const route = app.state.personaHome || (app.state.personaHome = {});
            route.avatarPickerOpen = !route.avatarPickerOpen;
            refresh();
            if (!route.avatarPickerOpen) return false;

            route.avatarPickerLoading = true;
            refresh();
            const sdk = getSettingsSdk() || window.settingsSdk;
            const persona = entityApi(sdk, route.entityType || 'user')?.get(route.entityId);
            const groupIds = Array.isArray(persona?.boundResources?.avatarGroupIds)
                ? persona.boundResources.avatarGroupIds
                : [];
            const records = (await Promise.all(groupIds.map(id => getGroupImages(id)))).flat();
            route.avatarPickerImages = (await Promise.all(records.map(async image => ({
                code: image.code,
                name: image.name || image.code,
                src: await getImageSrcByCode(image.code),
            })))).filter(image => image.src);
            route.avatarPickerLoading = false;
            refresh();
            return true;
        },

        async personaAvatarSelect(payload = {}) {
            const app = this.app;
            const route = app.state.personaHome || {};
            const sdk = getSettingsSdk() || window.settingsSdk;
            const api = entityApi(sdk, route.entityType || 'user');
            const persona = api?.get(route.entityId);
            if (!persona) return null;

            const code = typeof payload.code === 'string' ? payload.code : '';
            const selected = code
                ? (route.avatarPickerImages || []).find(image => image.code === code)
                : null;
            if (code && !selected) return null;

            const updated = await api.update(persona.id, {
                avatar: selected?.src || '',
                avatarCode: selected?.code || '',
            });
            route.avatarPickerOpen = false;
            refresh();
            this.toolkit?.island?.notify?.('success', selected ? '头像已更新' : '已恢复文字头像');
            return updated;
        },

        personaMediaPickerMode(payload = {}) {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            route.mediaPickerMode = payload.mode === 'background' ? 'background' : 'avatar';
            refresh();
        },

        async personaBackgroundSelect(payload = {}) {
            const app = this.app;
            const route = app.state.personaHome || {};
            const sdk = getSettingsSdk() || window.settingsSdk;
            const api = entityApi(sdk, route.entityType || 'user');
            const persona = api?.get(route.entityId);
            if (!persona) return null;

            const code = typeof payload.code === 'string' ? payload.code : '';
            const selected = code
                ? (route.avatarPickerImages || []).find(image => image.code === code)
                : null;
            if (code && !selected) return null;

            const updated = await api.update(persona.id, {
                profileBackground: selected?.src || '',
                profileBackgroundCode: selected?.code || '',
            });
            refresh();
            this.toolkit?.island?.notify?.('success', selected ? '卡片背景已更新' : '已恢复默认背景');
            return updated;
        },

        async personaBackgroundBlurSet(payload = {}) {
            const app = this.app;
            const route = app.state.personaHome || {};
            const sdk = getSettingsSdk() || window.settingsSdk;
            const api = entityApi(sdk, route.entityType || 'user');
            const persona = api?.get(route.entityId);
            if (!persona) return null;
            const value = Math.max(0, Math.min(24, Number(payload.value) || 0));
            const updated = await api.update(persona.id, { profileBackgroundBlur: value });
            refresh();
            return updated;
        },

        // ============================================
        // 社媒形象配置
        // ============================================

        /** 展开/收起社媒配置面板 */
        socialProfileToggle(payload = {}) {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const appId = payload.appId || 'chat';
            if (route.socialProfileExpanded === appId) {
                route.socialProfileExpanded = null;
            } else {
                route.socialProfileExpanded = appId;
                route.socialImagePickerOpen = null; // 收起时关闭图片选择器
            }
            refresh();
        },

        /** 打开/关闭社媒图片选择器 */
        async socialImagePickerToggle(payload = {}) {
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const appId = payload.appId || 'chat';
            const mode = payload.mode || 'avatar';

            if (route.socialImagePickerOpen === appId && route.socialImagePickerMode === mode) {
                route.socialImagePickerOpen = null;
                route.socialImagePickerImages = [];
                refresh();
                return;
            }

            route.socialImagePickerOpen = appId;
            route.socialImagePickerMode = mode;
            route.socialImagePickerLoading = true;
            refresh();

            const sdk = getSettingsSdk() || window.settingsSdk;
            const persona = entityApi(sdk, route.entityType || 'user')?.get(route.entityId);
            if (!persona) {
                route.socialImagePickerImages = [];
                route.socialImagePickerLoading = false;
                refresh();
                return;
            }

            // 从人设绑定的头像库加载图片
            const groupIds = Array.isArray(persona?.boundResources?.avatarGroupIds)
                ? persona.boundResources.avatarGroupIds
                : [];
            const records = (await Promise.all(groupIds.map(id => getGroupImages(id)))).flat();
            route.socialImagePickerImages = (await Promise.all(records.map(async image => ({
                code: image.code,
                name: image.name || image.code,
                src: await getImageSrcByCode(image.code),
            })))).filter(image => image.src);
            route.socialImagePickerLoading = false;
            refresh();
        },

        /** 选择社媒头像/背景 */
        async socialImageSelect(payload = {}) {
            const { appId, type, code } = payload;
            const route = this.app.state.personaHome || {};
            const sdk = getSettingsSdk() || window.settingsSdk;
            const api = entityApi(sdk, route.entityType || 'user');
            const persona = api?.get(route.entityId);
            if (!persona) return null;

            // 找到选中的图片信息
            const selected = code
                ? (route.socialImagePickerImages || []).find(i => i.code === code)
                : null;

            // 更新到 persona.socialProfiles
            const profiles = { ...(persona.socialProfiles || {}) };
            if (!profiles[appId]) profiles[appId] = {};

            if (type === 'avatar') {
                profiles[appId].avatarCode = code || '';
                profiles[appId].avatar = selected?.src || '';
            } else if (type === 'background') {
                profiles[appId].backgroundCode = code || '';
                profiles[appId].background = selected?.src || '';
            }

            await api.update(persona.id, { socialProfiles: profiles });
            // ★ 已删除:clearOnlineStatusCache() 调用 — chat-app 不再使用在线状态缓存
            this.toolkit?.island?.notify?.('success', selected ? `${type === 'avatar' ? '头像' : '背景'}已更新` : '已清除');
            return selected;
        },

        /** 保存社媒配置（网名） */
        async socialProfileSave(payload = {}) {
            const appId = payload.appId || 'chat';
            const route = this.app.state.personaHome || {};
            const sdk = getSettingsSdk() || window.settingsSdk;
            const api = entityApi(sdk, route.entityType || 'user');
            const persona = api?.get(route.entityId);
            if (!persona) return null;

            // 只收集这个 App 声明过的字段。面板本来就不渲染没声明的行，
            // 这里再无条件写一遍的话，会把已有值覆盖成空字符串。
            const fields = getSocialApp(appId)?.fields || ['nickname', 'avatar', 'background'];
            const readInput = (attr) => document.querySelector(`[${attr}="${appId}"]`)?.value?.trim() || '';

            // ★ 已删除:在线时间收集 — chat-app 不再展示"在线/离线",
            //   也不再让用户设置在线时间段(socialProfile.onlineHours 不再写)。

            const profiles = { ...(persona.socialProfiles || {}) };
            if (!profiles[appId]) profiles[appId] = {};

            if (fields.includes('nickname')) {
                profiles[appId].nickname = readInput('data-social-nickname');
            }
            if (fields.includes('signature')) {
                profiles[appId].signature = readInput('data-social-signature');
            }
            if (fields.includes('pat')) {
                profiles[appId].patSetting = readInput('data-social-pat-setting');
            }
            // ★ 已删除:onlineHours 字段不再写入 persona.socialProfiles[appId]

            // 合并 pending 中的头像和背景（AI 生成的结果）
            const pending = route.socialProfilePending || {};
            if (fields.includes('avatar') && pending.avatarCode) {
                profiles[appId].avatarCode = pending.avatarCode;
                profiles[appId].avatar = pending.avatar || '';
            }
            if (fields.includes('background') && pending.backgroundCode) {
                profiles[appId].backgroundCode = pending.backgroundCode;
                profiles[appId].background = pending.background || '';
            }

            // 如果当前有选中的头像/背景（从选择器选的），直接使用
            const currentProfile = getSocialProfile(persona, appId);
            if (currentProfile?.avatarCode && !profiles[appId].avatarCode) {
                profiles[appId].avatarCode = currentProfile.avatarCode;
                profiles[appId].avatar = currentProfile.avatar || '';
            }
            if (currentProfile?.backgroundCode && !profiles[appId].backgroundCode) {
                profiles[appId].backgroundCode = currentProfile.backgroundCode;
                profiles[appId].background = currentProfile.background || '';
            }

            await api.update(persona.id, { socialProfiles: profiles });
            // 清除 pending 状态
            route.socialProfilePending = null;
            // ★ 已删除:clearOnlineStatusCache() 调用 — chat-app 不再使用在线状态缓存
            this.toolkit?.island?.notify?.('success', '社媒配置已保存');
            refresh();
            return profiles[appId];
        },

        /**
         * AI 生成社媒形象配置
         * 基于人设信息生成适合该软件的网名和在线时间段
         */
        async socialProfileGenerate(payload = {}) {
            const appId = payload.appId || 'chat';
            const toolkit = this.toolkit;
            const sdk = getSettingsSdk() || window.settingsSdk;
            const route = this.app.state.personaHome || {};
            const api = entityApi(sdk, route.entityType || 'user');
            const persona = api?.get(route.entityId);
            if (!persona) return null;

            // 显示加载状态
            toolkit.island.show('mini', {
                type: 'info',
                title: 'AI 生成中…',
                message: `正在为 ${appId === 'chat' ? 'murmur' : appId} 生成配置`,
                icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            });

            try {
                // 构建人设上下文
                const personaInfo = [];
                if (persona.name) personaInfo.push(`名字：${persona.name}`);
                if (persona.personality) personaInfo.push(`性格：${persona.personality}`);
                if (persona.bio) personaInfo.push(`简介：${persona.bio}`);
                if (persona.identity) personaInfo.push(`身份：${persona.identity}`);
                if (persona.age) personaInfo.push(`年龄：${persona.age}`);
                if (persona.gender) personaInfo.push(`性别：${persona.gender}`);

                // 获取人设的世界观信息
                let worldInfo = '';
                if (persona.boundWorldId && sdk?.worlds) {
                    const world = sdk.worlds.get(persona.boundWorldId);
                    if (world?.name) worldInfo = `世界观：${world.name}`;
                }

                // 获取人设绑定的头像库图片
                const groupIds = Array.isArray(persona?.boundResources?.avatarGroupIds)
                    ? persona.boundResources.avatarGroupIds
                    : [];
                const avatarRecords = groupIds.length > 0
                    ? (await Promise.all(groupIds.map(id => getGroupImages(id)))).flat()
                    : [];
                const avatarList = avatarRecords.map(img => ({
                    code: img.code,
                    name: img.name || img.code,
                }));

                // 构建 prompt
                // 名字从社交 App 注册表读，别再写三目链 —— 那样每接一个新社交 App
                // 都要回来改一次，而漏改的表现只是 prompt 里少一个词，没人会发现。
                const socialEntry = getSocialApp(appId);
                const appName = socialEntry
                    ? `${socialEntry.label}${socialEntry.desc ? `（${socialEntry.desc}）` : ''}`
                    : appId;
                let systemPrompt = `你是一个社交媒体形象顾问。根据用户的人设信息，为其在${appName}上生成合适的形象配置。

请分析人设的性格、身份、年龄等因素，选择：
1. 一个自然的网名/昵称（8字以内，符合人设风格）
2. 合理的在线时间段（考虑人设的生活习惯，如学生可能晚上在线，上班族可能午休在线等）
${avatarList.length > 0 ? `3. 从以下头像列表中选择最合适的1个头像编号（code）：\n${avatarList.map(a => `  - ${a.code}: ${a.name}`).join('\n')}` : ''}
${avatarList.length > 0 ? `4. 从以下背景图列表中选择最合适的1个背景图编号（code）：\n${avatarList.map(a => `  - ${a.code}: ${a.name}`).join('\n')}` : ''}

请以JSON格式返回：
{
  "nickname": "网名"${avatarList.length > 0 ? `,
  "avatarCode": "头像编号",
  "backgroundCode": "背景图编号"` : ''}
}

注意：
- 网名要符合人设身份和性格
- 返回纯JSON，不要其他内容
${avatarList.length > 0 ? `- 头像和背景图编号必须从提供的列表中选择，请选择最符合人设气质的外形` : ''}`;

                const userPrompt = `人设信息：
${personaInfo.join('\n')}
${worldInfo ? worldInfo + '\n' : ''}
${avatarList.length > 0 ? `可选头像/背景图编号列表：\n${avatarList.map(a => `${a.code}: ${a.name}`).join('\n')}` : ''}

请为这个人在${appName}上生成合适的网名${avatarList.length > 0 ? '、头像和背景图' : ''}。`;

                // 打印发送给 AI 的内容
                console.log('[socialProfileGenerate] 发送给 AI 的内容：');
                console.log('--- system prompt ---');
                console.log(systemPrompt);
                console.log('--- user prompt ---');
                console.log(userPrompt);

                // 获取 API Key
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

                let result = null;
                if (apiKeyId) {
                    const apiSdk = getApiSdk();
                    const apiKey = apiSdk?.apiKeySdk?.get?.(apiKeyId);
                    if (apiKey) {
                        const content = await callAiRaw({
                            apiKey,
                            systemPrompt,
                            userPrompt,
                            maxTokens: avatarList.length > 0 ? 300 : 200,
                            temperature: 0.7,
                        });

                        // 打印 AI 返回的内容
                        console.log('[socialProfileGenerate] AI 返回的内容：');
                        console.log(content);

                        const parsed = parseAiJsonOrFallback(content, null);
                        if (parsed && typeof parsed === 'object') {
                            result = parsed;
                        }
                    }
                }

                if (!result) {
                    toolkit.island.dismiss();
                    toolkit.island.notify('error', 'API 未配置', '请先在资源管理中添加 API Key');
                    return null;
                }

                // 设置待生成结果到 state
                // ★ 已删除:socialProfilePending.onlineHours — chat-app 不再展示"在线/离线"
                route.socialProfilePending = {
                    appId,
                    nickname: result.nickname || '',
                };

                // 如果有头像库，解析头像和背景
                if (avatarList.length > 0) {
                    const validCodes = new Set(avatarList.map(a => a.code));
                    const avatarCode = result.avatarCode && validCodes.has(result.avatarCode) ? result.avatarCode : '';
                    const backgroundCode = result.backgroundCode && validCodes.has(result.backgroundCode) ? result.backgroundCode : '';

                    if (avatarCode) {
                        route.socialProfilePending.avatarCode = avatarCode;
                        route.socialProfilePending.avatar = await getImageSrcByCode(avatarCode);
                    }
                    if (backgroundCode) {
                        route.socialProfilePending.backgroundCode = backgroundCode;
                        route.socialProfilePending.background = await getImageSrcByCode(backgroundCode);
                    }
                }

                // 更新网名输入框
                const nicknameInput = document.querySelector(`[data-social-nickname="${appId}"]`);
                if (nicknameInput && result.nickname) {
                    nicknameInput.value = result.nickname;
                }

                // ★ 已删除:在线时间选择器更新逻辑(chat-app 不再展示在线/离线)

                toolkit.island.dismiss();
                toolkit.island.notify('success', '已生成配置', '可自行调整后保存');
                refresh();
                return result;

            } catch (err) {
                console.error('[socialProfileGenerate] 生成失败', err);
                toolkit.island.dismiss();
                toolkit.island.notify('error', '生成失败', err.message || '请稍后重试');
                return null;
            }
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
                    toolkit.island.show('mini', {
                        type: 'info',
                        title: '重新生成中…',
                        message: 'AI 重新分析中',
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
                    todaySchedule: diary.todaySchedule || [],
                } : { date: editDate, todaySchedule: [] };
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

            let mood, moodIntensity, diary, todaySchedule;

            if (pendingData) {
                // 使用待保存数据，同时保留现有日程
                mood = pendingData.mood;
                moodIntensity = pendingData.moodIntensity;
                diary = pendingData.diary;
                const existingDiary = sdk.diary.getDateDiary?.(entityType, entityId, editDate);
                todaySchedule = existingDiary?.todaySchedule || [];
            } else if (isEditing) {
                // 从 DOM 获取编辑表单的值（支持今日心情卡片和心情详情面板两种表单）
                const overlay = document.querySelector('.phome-mood-edit-inline, .phome-mood-detail__edit-section');
                if (!overlay) {
                    toolkit.island.notify('warning', '未找到编辑表单');
                    return null;
                }
                mood = overlay.querySelector('[data-edit-mood]')?.value?.trim() || '';
                moodIntensity = parseInt(overlay.querySelector('[data-edit-intensity]')?.value || '50') / 100;
                diary = overlay.querySelector('[data-edit-diary]')?.value?.trim() || '';
                // 解析日程文本（格式：HH:MM-HH:MM 地点 [活动]）
                const scheduleText = overlay.querySelector('[data-edit-schedule]')?.value?.trim() || '';
                todaySchedule = [];
                if (scheduleText) {
                    for (const line of scheduleText.split('\n')) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        // 匹配 HH:MM-HH:MM 或 HH-HH 格式
                        const timeMatch = trimmed.match(/^(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
                        if (timeMatch) {
                            const fromHour = parseFloat(timeMatch[1] + (timeMatch[2] ? '.' + timeMatch[2] : '.0'));
                            const toHour = parseFloat(timeMatch[3] + (timeMatch[4] ? '.' + timeMatch[4] : '.0'));
                            const rest = trimmed.slice(timeMatch[0].length).trim();
                            const parts = rest.split(/\s{2,}|\t/);
                            todaySchedule.push({
                                fromHour,
                                toHour,
                                locationName: parts[0] || '',
                                activity: parts[1] || '',
                                locationId: parts[0] || '',
                                placeName: '',
                                phase: 'past',
                            });
                        }
                    }
                }
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
            const isPositive = moodIntensity > 0.5;
            await sdk.diary.setMoodDetail(entityType, entityId, {
                mood,
                moodIntensity,
                isPositive,
                diary,
                todaySchedule,
                date: editDate,
            });

            // ★ v0.30 不再把 mood 写到 persona.dailyMood —— 心情是按日记记录走,
            // 持久化到人设会让昨天的「郁闷」跨天一直显示成默认心情。

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
            // ★ v0.30 不再写入 persona.dailyMood —— 心情按日记记录
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
            toolkit.island.show('mini', {
                type: 'info',
                title: '生成中…',
                message: 'AI 分析今日心情',
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

        /**
         * 添加一条每周重复日程。
         * payload: { weekday, title, startTime?, endTime?, note? }
         */
        async personaWeeklyScheduleAddEvent(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.weeklySchedule) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) {
                notify(this.toolkit, 'warning', '请先选择人设');
                return null;
            }
            const dow = payload.weekday;
            if (dow === undefined || dow < 0 || dow > 6) {
                notify(this.toolkit, 'error', '周几无效', '');
                return null;
            }
            if (!payload.title) {
                notify(this.toolkit, 'error', '标题不能为空', '');
                return null;
            }
            const next = await sdk.weeklySchedule.addEvent(entityType, entityId, dow, payload);
            refresh();
            notify(this.toolkit, 'success', '已添加每周重复', payload.title);
            return next;
        },

        /**
         * 更新一条每周重复日程。
         * payload: { weekday, eventId, title?, startTime?, endTime?, note? }
         */
        async personaWeeklyScheduleUpdateEvent(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.weeklySchedule) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId || payload.weekday === undefined || !payload.eventId) return null;
            const next = await sdk.weeklySchedule.updateEvent(entityType, entityId, payload.weekday, payload.eventId, payload);
            refresh();
            notify(this.toolkit, 'success', '已保存', '');
            return next;
        },

        /**
         * 删除一条每周重复日程。
         * payload: { weekday, eventId }
         */
        async personaWeeklyScheduleRemoveEvent(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.weeklySchedule || payload.weekday === undefined || !payload.eventId) return null;
            const entityType = payload.entityType || this.app.state.personaHome?.entityType || 'user';
            const entityId   = payload.entityId   || this.app.state.personaHome?.entityId;
            if (!entityId) return null;
            await sdk.weeklySchedule.removeEvent(entityType, entityId, payload.weekday, payload.eventId);
            refresh();
            notify(this.toolkit, 'success', '已删除', '');
            return true;
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

        /** 循环切换 space injectMode: none ↔ current。
 *  空间模块只承载「当天」的数据(当前所在 / 今日日程 / 可去场所),
 *  不存在「本周/全部」的概念,所以只给两档。*/
        async personaSpaceCycleInject(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk?.persona) return false;
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const et = route.entityType || 'user';
            const pid = route.entityId;
            if (!pid) return false;
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const persona = api.get(pid);
            if (!persona) return false;
            const current = persona.space?.injectMode || 'none';
            const next = current === 'none' ? 'current' : 'none';
            try {
                await sdk.persona.module.update(et, pid, 'space', { injectMode: next });
            } catch (err) {
                console.warn('[personaSpaceCycleInject]', err);
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
            const worldState = this.app.state.world || (this.app.state.world = {});
            worldState.currentWorldId = persona.boundWorldId;
            worldState.sub = 'overview';
            worldState.activeSettingsSection = 'assets';
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'detail', appId: 'settings', pageId: 'world' },
            }));
        },

        /**
         * ★ v0.67 打开钱包流水历史页（不限制 50 条）
         *   - 默认跳转到 detail 'transaction-history'
         *   - payload 透传 entityType + entityId,让 history 页知道展示谁的流水
         */
        openTransactionHistory(payload = {}) {
            const sdk = getSettingsSdk() || window.settingsSdk;
            if (!sdk) return;
            // 路由上下文里塞 entityType + entityId,history 页从 app.state 读
            const route = this.app.state.personaHome || (this.app.state.personaHome = {});
            const entityType = payload.entityType || route.entityType || 'user';
            const entityId = payload.entityId || route.entityId || '';
            // 缓存到 router,history 页用
            route.txFilter = { entityType, entityId };
            refresh();
            const action = {
                action: 'detail',
                appId: 'settings',
                pageId: 'transaction-history',
                payload: { entityType, entityId },
            };
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

        /* ============================================
         * ★ v0.30 空间模块 · AI 行程生成
         *   - personaSpaceGenerateTodaySchedule     生成/重 roll 今日日程
         * ============================================ */

        /**
         * 内部:组装 context + apiKey,返回 { apiKey, ctx } 或抛错。
         */
        async _personaSpacePrepare() {
            const sdk = getSettingsSdk() || window.settingsSdk;
            const app = this.app;
            const toolkit = this.toolkit;
            if (!sdk) throw new Error('settingsSdk 未就绪');
            const entityType = app.state?.personaHome?.entityType || 'user';
            const entityId = app.state?.personaHome?.entityId;
            const persona = entityApi(sdk, entityType).get(entityId);
            if (!persona) throw new Error('未选择人设');
            const worldId = persona.boundWorldId;
            const world = worldId ? sdk.worlds?.get?.(worldId) : null;
            const todayDiary = sdk.diary?.getToday?.(entityType, entityId) || null;
            const accessible = getAccessibleLocationsForPersona(sdk, worldId, persona.id, { includeRare: false });
            // 找当前主要地点
            const places = worldId && sdk.places?.list ? sdk.places.list({ worldRef: worldId }) : [];
            const primaryPlace = accessible.find(a => a.place)?.place || places[0] || null;
            const weatherAppState = readWeatherAppState();
            const weather = getPlaceWeather(weatherAppState, primaryPlace);

            const ctx = gatherContextForAI({ app, persona, world, todayDiary, weather });
            const apiKeyId = resolveApiKeyIdForPersona(persona);
            const apiKey = resolveApiKey(apiKeyId);
            if (!apiKey || !apiKey.apiKey) {
                throw new Error('未配置 API Key,请在资源管理中添加 API Key');
            }
            return { sdk, app, toolkit, persona, world, todayDiary, ctx, apiKey, accessible };
        },

        /**
         * 生成(或重 roll)今日日程:拼 prompt → 调 LLM → 白名单校验 → 写入 todaySchedule。
         */
        async personaSpaceGenerateTodaySchedule(payload = {}) {
            const app = this.app;
            const toolkit = this.toolkit;
            try {
                // 生成期间用 mini 灵动岛 + 顶部 notify，让用户能继续滚动浏览其他卡片。
                // backdrop 模式（medium/large）会铺满 fixed inset-0 锁住滚动，生成时间长体感很卡。
                toolkit.island.show('mini', {
                    type: 'info',
                    title: '规划今日行程…',
                    message: 'AI 正在安排场所',
                    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                });
                const { sdk, ctx, apiKey, persona } = await this._personaSpacePrepare();
                const systemPrompt = buildTodayScheduleSystemPrompt();
                const userPrompt = buildTodayScheduleUserPrompt(ctx);
                // 优先使用 API Key 里配置的 maxTokens(用户在资源管理填的「最大输出」);
                // 兜底 4096,适配 DeepSeek-R1 / 类 thinking 模型的 reasoning_content 预算。
                const scheduleMaxTokens = Math.max(2048, Number(apiKey?.maxTokens) || 4096);
                const content = await callAiRaw({ apiKey, systemPrompt, userPrompt, maxTokens: scheduleMaxTokens, temperature: 0.7 });
                console.log('[space-ai] 行程 LLM 原文长度=', String(content || '').length, '预览=', String(content || '').slice(0, 120));
                const parsed = parseAiJsonOrFallback(content, null);
                console.log('[space-ai] 行程 parsed 类型=', Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed);
                const allowedIds = new Set();
                for (const a of (ctx.worldSpace?.groups?.flatMap(g => g.locations) || [])) {
                    if (a.location?.id) allowedIds.add(a.location.id);
                }
                console.log('[space-ai] 行程 allowedIds=', [...allowedIds]);
                const nowHour = ctx.worldTime?.realHour ?? new Date().getHours();
                const segments = sanitizeTodaySchedule(parsed, allowedIds, { nowHour });
                if (segments.length === 0) {
                    toolkit.island.dismiss();
                    const hint = parsed === null
                        ? `AI 原文未识别为 JSON:${String(content).slice(0, 80)}…`
                        : (allowedIds.size === 0
                            ? '此 persona 没有可去的场所,无法生成行程。'
                            : `AI 返回 ${Array.isArray(parsed) ? parsed.length : 0} 段,但 ${[...allowedIds].filter(Boolean).length} 个 locationId 全部未匹配白名单。`);
                    toolkit.island.notify('warning', '生成失败', hint);
                    return null;
                }
                const entityType = app.state?.personaHome?.entityType || 'user';
                const entityId = persona.id;
                const todayDiary = sdk.diary?.getToday?.(entityType, entityId) || { id: `${entityType}:${entityId}:${formatDate()}`, entityType, entityId, date: formatDate() };
                const warnings = (() => {
                    const r = [];
                    // 提示但不阻止(用户在空间卡里能看见)
                    return r;
                })();
                await sdk.diary.upsert({
                    ...todayDiary,
                    todaySchedule: segments,
                    todayScheduleGeneratedAt: Date.now(),
                    todayScheduleSource: 'ai',
                    updatedAt: Date.now(),
                });
                toolkit.island.dismiss();
                toolkit.island.notify('success', '已生成今日日程', `${segments.length} 段行程`);
                refresh();
                return segments;
            } catch (err) {
                console.error('[personaSpaceGenerateTodaySchedule]', err);
                this.toolkit?.island?.dismiss?.();
                const msg = String(err?.message || err);
                if (msg.includes('API Key')) {
                    this.toolkit?.island?.notify?.('error', 'API 未配置', '请先在资源管理中添加 API Key');
                } else {
                    this.toolkit?.island?.notify?.('error', '生成失败', msg.slice(0, 60));
                }
                return null;
            }
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
 * 重构 v0.30:复用 space-ai.callAiRaw,prompt 注入今日天气 + 世界观时间
 */
async function callMoodApi({ apiKey, systemPrompt, userPrompt }) {
    const content = await callAiRaw({
        apiKey,
        systemPrompt,
        userPrompt,
        maxTokens: 600,
        temperature: 0.7,
    });
    const parsed = parseAiJsonOrFallback(content, null);
    if (parsed && typeof parsed === 'object') {
        return {
            mood: parsed.mood || '平静',
            moodIntensity: Math.max(0.1, Math.min(1, parseFloat(parsed.moodIntensity) || 0.5)),
            diary: parsed.diary || '',
        };
    }
    // 解析失败,尝试从文本提取
    const lines = content.split('\n').filter(Boolean);
    const moodLine = lines.find(l => /心情|情绪|状态/.test(l)) || '';
    const moodMatch = moodLine.match(/[开心平静期待专注小确幸低落焦虑疲惫]+/);
    return {
        mood: moodMatch ? moodMatch[0] : '平静',
        moodIntensity: 0.5,
        diary: content.slice(0, 100),
    };
}

/**
 * 构建心情分析的用户 prompt
 * 重构 v0.30:追加天气 + 世界观空间段
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
        if (world.chronologySettings?.enabled) {
            parts.push(`纪时：启用,自定义段名=${(world.chronologySettings.customHours || []).join('/')}`);
        }
    }

    // 今日日程
    if (schedule?.events?.length) {
        parts.push(`\n【今日日程】`);
        schedule.events.forEach(e => {
            const time = e.startTime ? `[${e.startTime}${e.endTime ? '-' + e.endTime : ''}]` : '[全天]';
            parts.push(`${time} ${e.title}${e.note ? ' - ' + e.note : ''}`);
        });
    }

    // 今日天气(若能拿到)
    try {
        const sdk = (typeof window !== 'undefined' ? window.settingsSdk : null);
        const worldId = persona?.boundWorldId;
        if (sdk?.places && worldId) {
            const places = sdk.places.list({ worldRef: worldId }) || [];
            const weatherAppState = window.weatherAppState;
            for (const place of places) {
                if (!place?.realCityRef) continue;
                const w = weatherAppState?.weatherCache?.[place.realCityRef];
                if (w?.temperature != null) {
                    parts.push(`\n【今日天气】`);
                    parts.push(`${place.realCityRef}(${place.name}): ${w.description || ''}, ${w.temperature}°C, 湿度 ${w.humidity ?? '--'}%, 风力 ${w.wind ?? '--'} 级`);
                    parts.push(`提示：天气影响情绪(雨天 → 内敛 / 晴 → 放松)。`);
                    break;
                }
            }
        }
    } catch (_) { /* ignore */ }

    // 当前心情（如果有的话）
    if (today?.mood) {
        parts.push(`\n【当前心情】${today.mood}`);
    }

    parts.push(`\n请根据以上信息，分析并生成该角色今日的心情状态。`);
    return parts.join('\n');
}
