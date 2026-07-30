/**
 * Settings App · 人设 (Persona) 业务方法
 *
 *   - 全部通过 settingsSdk.persona.* / aiPersons / users 来操作。
 *   - methods 接收 payload,内部用 this.app.state / this.toolkit / sdk 协同。
 */

import { _invalidateGalleryTree, _loadPromptTree, _invalidatePromptTree } from './resources-section.js';
import { getApiSdk, waitApiSdkReady } from '@/js/apps/setting/api-manager/api-manager-section.js';

async function ensureApiSdk() {
    if (typeof window === 'undefined') return null;
    if (!window.__apiSdk?.apiKeySdk) {
        const fresh = getApiSdk();
        if (!fresh) {
            console.error('[persona-ai] getApiSdk() returned null (no window.myDb?)');
            return null;
        }
    }
    const apisdk = window.__apiSdk;
    // 等缓存加载完成(不论 list 是否有数据,只要 db 读取操作结束)
    try {
        await waitApiSdkReady();
    } catch (err) {
        console.warn('[persona-ai] waitApiSdkReady warn', err);
    }
    return apisdk;
}

function refresh() {
    window.refreshPhoneApps?.();
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) {
        appsRef.value = [...appsRef.value];
    }
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
}

/** 通用刷新：触发 settings-sdk:change + Vue reactive。 */
function notifyKind(toolkit, kind) {
    toolkit?.island?.notify?.('success', '已' + kind);
}

function todayYmd() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bumpDetailRenderTick() {
    // 让 framework 的 currentDetailView 重新计算 → v-html 重渲当前 detail panel
    try { window.__detailRenderTick?.value; if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
}

/**
 * 把 entityType 转换成对应 entity api 名字。约定: 'ai' -> 'aiPersons'，'user' -> 'users'。
 */
function apiKey(entityType) {
    return entityType === 'user' ? 'users' : 'aiPersons';
}

/**
 * 取得当前 entityType 的 active id。
 */
function getActiveId(sdk, entityType) {
    if (!sdk) return null;
    if (entityType === 'user') return sdk.users.getActive()?.id;
    return sdk.aiPersons.getActive()?.id;
}

/**
 * 把 DOM 中所有 data-persona-field 的值收集成 patch。
 *   data-persona-field="entityType|groupKey|fieldKey"
 */
function collectFieldsFromDom(entityType) {
    const prefix = `${entityType}|`;
    const fields = document.querySelectorAll(`[data-persona-field^="${entityType}|"]`);
    const patch = {};
    fields.forEach(el => {
        const attr = el.getAttribute('data-persona-field');
        if (!attr || !attr.startsWith(prefix)) return;
        const parts = attr.slice(prefix.length).split('|');
        const raw = (el.value ?? '').toString();
        // 模块字段（如 memory|text）需要合并到父对象
        if (parts.length >= 2) {
            // parts[0] = groupKey (如 memory), parts[1] = fieldKey (如 text)
            const [groupKey, fieldKey] = parts;
            patch[groupKey] = patch[groupKey] || {};
            patch[groupKey][fieldKey] = raw;
        } else {
            patch[parts[0]] = raw;
        }
    });
    return patch;
}

/**
 * 通过全局 __phoneConfirm 通道弹出确认弹窗。
 * 用户点确认后会异步调用 onConfirm；点取消则什么都不做。
 */
function openConfirmModal({
    title = '确认操作',
    text = '',
    confirmLabel = '确定',
    danger = false,
    onConfirm = null,
} = {}) {
    if (typeof window === 'undefined') return;
    if (typeof window.__phoneConfirm?.request === 'function') {
        window.__phoneConfirm.request({ title, text, confirmLabel, danger, onConfirm });
    }
}

function openVariantFormModal({ kind, source, worlds = [], onSubmit }) {
    if (typeof document === 'undefined') return;
    document.querySelector('[data-persona-variant-modal]')?.remove();
    const isPhase = kind === 'lifePhase';
    const overlay = document.createElement('div');
    overlay.className = 'persona-variant-modal';
    overlay.setAttribute('data-persona-variant-modal', '');
    const safe = (value) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const worldOptions = worlds.map(world =>
        `<option value="${safe(world.id)}">${safe(world.name || world.id)}</option>`
    ).join('');
    overlay.innerHTML = `
        <div class="persona-variant-modal__backdrop" data-variant-cancel></div>
        <div class="persona-variant-modal__sheet" role="dialog" aria-modal="true" aria-label="${isPhase ? '创建人生阶段卡' : '创建 parO 平行卡'}">
            <div class="persona-variant-modal__head">
                <div class="persona-variant-modal__eyebrow">复制自 ${safe(source.name || source.id)}</div>
                <div class="persona-variant-modal__title">${isPhase ? '创建人生阶段卡' : '创建 parO 平行卡'}</div>
                <div class="persona-variant-modal__desc">${isPhase ? '保留当前世界观，复制完成后作为独立角色卡使用。' : '完整复制当前人设，默认解除世界观绑定。'}</div>
            </div>
            <div class="persona-variant-modal__body">
                <label class="persona-variant-modal__field"><span>卡片名称</span><input data-variant-field="name" value="${safe(`${source.name || source.id} · ${isPhase ? '新阶段' : 'parO'}`)}"></label>
                ${isPhase ? `
                    <label class="persona-variant-modal__field"><span>阶段名称</span><input data-variant-field="phaseName" placeholder="例如：高中时期"></label>
                    <label class="persona-variant-modal__field"><span>年龄</span><input data-variant-field="age" type="number" min="0" max="120" placeholder="例如：${safe(source.age ?? '')}" value="${safe(source.age ?? '')}"></label>
                ` : `
                    <label class="persona-variant-modal__field"><span>新世界观</span><select data-variant-field="boundWorldId"><option value="">暂不绑定（自由模式）</option>${worldOptions}</select></label>
                `}
                <label class="persona-variant-modal__field"><span>${isPhase ? '想要的时间线' : '平行设定想法'} <small>为后续 AI 生成预留</small></span><textarea data-variant-field="timelinePrompt" rows="3" placeholder="先记录你的想法；后续接入 API 后可让 AI 自动改写整张卡。"></textarea></label>
            </div>
            <div class="persona-variant-modal__actions">
                <button class="persona-btn persona-btn--ghost" data-variant-cancel>取消</button>
                <button class="persona-btn persona-btn--primary" data-variant-submit>创建独立卡</button>
            </div>
        </div>`;
    const close = () => overlay.remove();
    overlay.addEventListener('click', async (event) => {
        if (event.target.closest('[data-variant-cancel]')) { close(); return; }
        if (!event.target.closest('[data-variant-submit]')) return;
        const value = (key) => overlay.querySelector(`[data-variant-field="${key}"]`)?.value?.trim() || '';
        const submit = overlay.querySelector('[data-variant-submit]');
        submit.disabled = true;
        try {
            await onSubmit({
                name: value('name'), phaseName: value('phaseName'), age: value('age'),
                boundWorldId: value('boundWorldId'), timelinePrompt: value('timelinePrompt'),
            });
            close();
        } catch (error) {
            submit.disabled = false;
            throw error;
        }
    });
    (document.querySelector('#phone') || document.body).appendChild(overlay);
    requestAnimationFrame(() => overlay.querySelector('[data-variant-field="name"]')?.focus());
}

export function buildPersonaMethods() {
    return {
        async personaDelete(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const entityType = payload.entityType || 'ai';
            const id = getActiveId(sdk, entityType);
            if (!id) return null;

            const persona = sdk[apiKey(entityType)].get(id);
            const name = persona?.name || id;
            const label = entityType === 'user' ? '用户' : 'AI';

            openConfirmModal({
                title: `删除 ${label} 人设`,
                text: `确定删除「${name}」？此操作不可撤销。`,
                confirmLabel: '删除',
                danger: true,
                onConfirm: async () => {
                    const api = sdk[apiKey(entityType)];
                    await api.remove(id);
                    this.toolkit?.island?.notify?.('success', '已删除', name);

                    // 删除后切换到列表视图
                    const route = this.app.state.personaHome || (this.app.state.personaHome = {});
                    delete route.entityId;

                    // 尝试切换到另一个 active 实体
                    const all = api.list ? api.list() : [];
                    const remaining = all.filter(item => item.id !== id);
                    if (remaining.length > 0) {
                        const next = remaining[0];
                        route.entityType = entityType;
                        route.entityId = next.id;
                    } else {
                        // 没有剩余实体，切换到另一个类型
                        route.entityType = entityType === 'user' ? 'ai' : 'user';
                        const otherApi = sdk[apiKey(route.entityType)];
                        const otherActive = otherApi.getActive();
                        if (otherActive) {
                            route.entityId = otherActive.id;
                        } else {
                            delete route.entityId;
                        }
                    }

                    refresh();
                },
            });
        },

        async personaSave(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const entityType = payload.entityType || 'ai';
            const id = getActiveId(sdk, entityType);
            if (!id) return null;
            const api = sdk[apiKey(entityType)];
            const patch = collectFieldsFromDom(entityType);
            // 同步切换 profile level
            const next = await api.update(id, patch);
            this.toolkit?.island?.notify?.('success', '已保存', next.name || id);
            refresh();
            return next;
        },

        async personaToggleModule(payload = {}) {
            const sdk = window.settingsSdk;
            console.log('[personaToggleModule] 开始', { payload, hasPersona: !!sdk?.persona });
            if (!sdk?.persona) {
                console.warn('[personaToggleModule] no sdk.persona');
                return null;
            }
            const { entityType, moduleKey } = payload;
            console.log('[personaToggleModule] 解析参数', { entityType, moduleKey });
            if (!moduleKey) {
                console.warn('[personaToggleModule] missing moduleKey', payload);
                return null;
            }
            const id = getActiveId(sdk, entityType);
            console.log('[personaToggleModule] 获取ID', { id });
            if (!id) {
                console.warn('[personaToggleModule] no active id', { entityType });
                return null;
            }
            const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
            const currentModule = api.get(id)?.[moduleKey] || { enabled: false };
            const nextEnabled = !(currentModule.enabled === true);
            console.debug('[personaToggleModule]', {
                entityType, id, moduleKey,
                beforeEnabled: currentModule.enabled === true,
                nextEnabled,
                beforeModule: currentModule,
            });
            try {
                const result = await sdk.persona.module.toggle(entityType, id, moduleKey, nextEnabled);
                console.log('[personaToggleModule] toggle结果', { result });
            } catch (err) {
                console.error('[personaToggleModule] toggle 失败', err);
                throw err;
            }
            const after = api.get(id);
            console.debug('[personaToggleModule] after', { afterEnabled: after?.[moduleKey]?.enabled === true });
            refresh();
            return true;
        },

        async personaSetInject(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.persona) return null;
            const { entityType, moduleKey, inject } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id) return null;
            await sdk.persona.module.setInject(entityType, id, moduleKey, inject);
            refresh();
            return true;
        },

        async personaSetProfileLevel(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.profile) return null;
            const { entityType, level } = payload;
            // UI 用「简略 / 详细」；SDK 用「minimal / detailed」。做一层映射。
            const normalized = level === 'simple' ? 'minimal' : level === 'detailed' ? 'detailed' : level;
            const id = getActiveId(sdk, entityType);
            if (id) {
                await sdk.profile.setLevelFor(entityType, id, normalized);
            } else {
                await sdk.profile.setLevel(normalized);
            }
            // 同步到 app.state.ui（保留「简略 / 详细」语义给渲染层用）
            const ui = this.app.state.ui || (this.app.state.ui = {});
            ui.profileLevel = level;
            refresh();
            return level;
        },

        personaAddPhase(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.persona?.variants) return null;
            const entityType = payload.entityType || 'ai';
            const id = getActiveId(sdk, entityType);
            const source = id ? sdk[apiKey(entityType)].get(id) : null;
            if (!source) return null;
            openVariantFormModal({
                kind: 'lifePhase',
                source,
                worlds: sdk.worlds.list(),
                onSubmit: async (form) => {
                    const card = await sdk.persona.variants.create(entityType, id, 'lifePhase', form);
                    if (!card) return null;
                    this.toolkit?.island?.notify?.('success', '已创建阶段卡', card.name);
                    refresh();
                    return card;
                },
            });
            return true;
        },

        async personaRemovePhase(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.persona?.variants) return null;
            const { entityType = 'ai', phaseId } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id || !phaseId) return null;
            const card = sdk[apiKey(entityType)].get(phaseId);
            openConfirmModal({
                title: '删除阶段卡',
                text: `确定删除「${card?.name || phaseId}」？独立卡中的编辑内容也会一并删除。`,
                confirmLabel: '删除',
                danger: true,
                onConfirm: async () => {
                    await sdk.persona.variants.remove(entityType, id, phaseId, 'lifePhase');
                    refresh();
                },
            });
            return true;
        },

        personaActivatePhase() {
            this.toolkit?.island?.notify?.('info', '阶段卡已独立', '请在卡片列表中打开并使用');
            return true;
        },

        personaCloneParO(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.persona?.variants) return null;
            const entityType = payload.entityType || 'ai';
            const id = getActiveId(sdk, entityType);
            const source = id ? sdk[apiKey(entityType)].get(id) : null;
            if (!source) return null;
            openVariantFormModal({
                kind: 'paro',
                source,
                worlds: sdk.worlds.list(),
                onSubmit: async (form) => {
                    const card = await sdk.persona.variants.create(entityType, id, 'paro', form);
                    if (!card) return null;
                    this.toolkit?.island?.notify?.('success', '已创建 parO 卡', card.name);
                    refresh();
                    return card;
                },
            });
            return true;
        },

        /**
         * AI 生成阶段卡 / parO 卡内容。
         *
         * 流程：
         *   1. 从 card.parentPersonaId 找到来源卡，从 boundResources.apiRefs 选一个 API key（优先单一 API）。
         *   2. 用来源卡的完整 schema + card.phaseMeta.timelinePrompt 拼成 prompt。
         *   3. 调 LLM（OpenAI 兼容 chat/completions），要求返回严格 JSON。
         *   4. 把解析后的字段写回 card（独立 update，不动来源卡）。
         *
         * 注意：用户在 Console 里能看到完整 prompt 和返回。
         */
        async personaAiFillVariant(payload = {}) {
            const sdk = window.settingsSdk;
            const { entityType = 'ai', variantType, cardId } = payload;
            if (!sdk) return null;
            if (!['lifePhase', 'paro'].includes(variantType) || !cardId) return null;
            const api = sdk[entityType === 'user' ? 'users' : 'aiPersons'];
            const card = api.get(cardId);
            if (!card) {
                this.toolkit?.island?.notify?.('warning', '卡不存在');
                return null;
            }
            const sourceId = card.parentPersonaId || card.rootPersonaId || cardId;
            const source = api.get(sourceId) || card;

            // 选 API：优先单一 API key
            const apisdk = await ensureApiSdk();
            console.log('[persona-ai] window.__apiSdk =', apisdk);
            if (!apisdk) {
                this.toolkit?.island?.notify?.('warning', 'API 模块未就绪', '请打开 API 管理');
                return null;
            }
            if (!apisdk.apiKeySdk) {
                this.toolkit?.island?.notify?.('warning', 'apiKeySdk 缺失', '打开 API 管理初始化');
                return null;
            }
            const boundRefs = (source.boundResources?.apiRefs) || [];
            console.log('[persona-ai] source bound apiRefs =', JSON.stringify(boundRefs));
            const findKeyRef = boundRefs.find(r => r.refType === 'key' && apisdk.apiKeySdk.get(r.refId));
            const findGroupRef = boundRefs.find(r => r.refType === 'group' && apisdk.apiGroupSdk?.get?.(r.refId));
            console.log('[persona-ai] findKeyRef =', findKeyRef, 'findGroupRef =', findGroupRef);
            const preferredRef = findKeyRef || findGroupRef || null;
            if (!preferredRef) {
                this.toolkit?.island?.notify?.('warning', '尚未绑定 API 资源', '请在资源绑定里添加一个');
                return null;
            }
            let key;
            if (preferredRef.refType === 'key') {
                key = apisdk.apiKeySdk.get(preferredRef.refId);
            } else {
                const group = apisdk.apiGroupSdk.get(preferredRef.refId);
                const firstId = group?.apiKeyIds?.find(id => apisdk.apiKeySdk.get(id));
                key = firstId ? apisdk.apiKeySdk.get(firstId) : null;
            }
            console.log('[persona-ai] picked key =', key && { id: key.id, label: key.label, baseUrl: key.baseUrl, hasApiKey: !!key.apiKey, model: key.model });
            if (!key || !key.baseUrl || !key.apiKey || !key.model) {
                this.toolkit?.island?.notify?.('warning', '所选 API 资源不可用', '请补全 baseUrl/apiKey/model');
                return null;
            }

            const hint = (card.phaseMeta?.timelinePrompt || '').trim();
            const isPhase = variantType === 'lifePhase';

            // 构造 prompt：把 schema 列清楚，让 AI 输出严格 JSON
            const systemPrompt = [
                '你是一名「角色卡设计师」，专门为虚拟人物生成详尽的人设设定。',
                '你收到的输入是「来源人设卡 + 用户补充想法」，需要按照指定 schema 输出严格 JSON。',
                '要求：',
                '1. 只输出 JSON（不要任何 markdown、注释或解释）。',
                '2. 保留来源人设核心特征（性别、年龄区间、世界观），但根据「用户想法」做合理推演与差异。',
                '3. 对 listField（数组）字段，每条尽量 3-6 条；每条 30-80 字。',
                '4. 对 text 字段，120-300 字。',
                '5. MBTI 类型必须是 4 个字母（I/E + N/S + F/T + J/P）。',
            ].join('\n');

            const userPrompt = [
                `# 任务`,
                isPhase
                    ? `为「${source.name}」生成一张「人生阶段卡」。`
                    : `为「${source.name}」生成一张「parO 平行卡」（平行宇宙/平行设定的角色变体）。`,
                '',
                `# 来源人设 (base persona)`,
                JSON.stringify({
                    name: source.name,
                    gender: source.gender,
                    age: source.age,
                    appearance: source.appearance,
                    personality: source.personality,
                    bio: source.bio,
                    experience: source.experience,
                    mbti: source.mbti,
                    psychological: source.psychological,
                    moral: source.moral,
                    skills: source.skills,
                    preferences: source.preferences,
                    boundWorldId: source.boundWorldId,
                }, null, 2),
                '',
                `# 用户想法 (hint)`,
                hint || '（未提供）',
                '',
                `# 输出 JSON schema`,
                '请输出如下结构的 JSON（顶层是对象，下面字段按需填）：',
                JSON.stringify({
                    name: 'string，卡名',
                    age: 'number 或 string，年龄',
                    appearance: 'string，外貌',
                    personality: 'string，性格',
                    bio: 'string，背景故事',
                    experience: 'string，相关经历',
                    mbti: { type: '4字母', description: 'string 简短说明' },
                    psychological: 'string，心理画像',
                    moral: 'string，价值观与底线',
                    skills: 'string，能力 / 特长',
                    preferences: { hobbies: 'string[]', likes: 'string[]', dislikes: 'string[]' },
                }, null, 2),
                '',
                '# 严格要求',
                '- 严格用 JSON 输出，第一字符是 {，最后一字符是 }。',
                '- 不要在 JSON 外包裹 markdown。',
            ].join('\n');

            console.log('[persona-ai] USING API =>', {
                keyLabel: key.label || key.id,
                provider: key.provider,
                model: key.model,
                baseUrl: key.baseUrl,
            });
            console.log('[persona-ai] PROMPT =>', {
                system: systemPrompt,
                user: userPrompt,
                hint,
                sourceId: source.id,
                cardId: card.id,
                variantType,
            });

            const finalUrl = (key.proxyUrl ? key.proxyUrl.replace(/\/$/, '') : key.baseUrl.replace(/\/$/, '')) + '/chat/completions';
            const sanitizeHeaderValue = (v) => {
                try {
                    if (!v) return v;
                    if (/^[\x00-\x7f]*$/.test(v)) return v;
                    return '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(v))) + '?=';
                } catch (_) {
                    return v;
                }
            };
            const headers = { 'Content-Type': 'application/json' };
            if (key.authHeader && key.authHeader.trim()) {
                headers[key.authHeader.trim()] = sanitizeHeaderValue(key.apiKey);
            } else {
                headers['Authorization'] = 'Bearer ' + sanitizeHeaderValue(key.apiKey);
            }
            const body = JSON.stringify({
                model: key.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 1500,
            });

            this.toolkit?.island?.notify?.('info', 'AI 生成中…', preferredRef.name || preferredRef.refId);
            try {
                const resp = await fetch(finalUrl, {
                    method: 'POST',
                    headers,
                    body,
                    signal: AbortSignal.timeout((key.timeout || 60) * 1000),
                });
                const latency = Date.now();
                if (!resp.ok) {
                    const txt = await resp.text().catch(() => '');
                    console.error('[persona-ai] HTTP ERROR', resp.status, txt.slice(0, 500));
                    this.toolkit?.island?.notify?.('warning', `AI 生成失败 HTTP ${resp.status}`);
                    return null;
                }
                const data = await resp.json().catch(() => null);
                const rawText = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
                console.log('[persona-ai] RAW RESPONSE =>', rawText);
                if (!rawText) {
                    this.toolkit?.island?.notify?.('warning', 'AI 返回为空');
                    return null;
                }
                // 解析：去掉 ```json 包裹
                const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
                let parsed;
                try {
                    parsed = JSON.parse(stripped);
                } catch (err) {
                    console.error('[persona-ai] JSON PARSE FAIL', err, stripped.slice(0, 500));
                    this.toolkit?.island?.notify?.('warning', 'AI 返回不是合法 JSON', '查看 console');
                    return null;
                }

                // 把 AI 输出归一化成 persona patch
                const patch = {};
                if (typeof parsed.name === 'string' && parsed.name.trim()) patch.name = parsed.name.trim();
                if (parsed.age != null && parsed.age !== '') {
                    const n = Number(parsed.age);
                    if (Number.isFinite(n)) patch.age = n;
                    else patch.age = parsed.age;
                }
                if (typeof parsed.appearance === 'string') patch.appearance = parsed.appearance;
                if (typeof parsed.personality === 'string') patch.personality = parsed.personality;
                if (typeof parsed.bio === 'string') patch.bio = parsed.bio;
                if (typeof parsed.experience === 'string') patch.experience = parsed.experience;
                if (parsed.mbti && typeof parsed.mbti === 'object') {
                    const mbtiBase = source.mbti || { enabled: false, injectMode: 'none', type: '', description: '' };
                    patch.mbti = {
                        ...mbtiBase,
                        enabled: true,
                        injectMode: 'current',
                        type: typeof parsed.mbti.type === 'string' ? parsed.mbti.type : (mbtiBase.type || ''),
                        description: typeof parsed.mbti.description === 'string' ? parsed.mbti.description : (mbtiBase.description || ''),
                    };
                }
                if (typeof parsed.psychological === 'string') {
                    const base = source.psychological || { enabled: false, injectMode: 'none' };
                    patch.psychological = { ...base, enabled: true, injectMode: 'current', text: parsed.psychological };
                }
                if (typeof parsed.moral === 'string') {
                    const base = source.moral || { enabled: false, injectMode: 'none' };
                    patch.moral = { ...base, enabled: true, injectMode: 'current', text: parsed.moral };
                }
                if (typeof parsed.skills === 'string') {
                    const base = source.skills || { enabled: false, injectMode: 'none' };
                    patch.skills = { ...base, enabled: true, injectMode: 'current', text: parsed.skills };
                }
                if (parsed.preferences && typeof parsed.preferences === 'object') {
                    const basePref = source.preferences || { enabled: false, injectMode: 'none' };
                    const next = { ...basePref, enabled: true, injectMode: 'current' };
                    ['hobbies', 'likes', 'dislikes'].forEach((k) => {
                        if (Array.isArray(parsed.preferences[k])) {
                            next[k] = parsed.preferences[k].map(String);
                        }
                    });
                    patch.preferences = next;
                }
                if (isPhase) {
                    patch.phaseMeta = {
                        ...(card.phaseMeta || {}),
                        timelinePrompt: hint,
                        // ★ AI 生成时，如果用户没填 phaseName，用 AI 给的「name」前段或保留旧的
                        name: (card.phaseMeta?.name) || (typeof parsed.phaseMeta?.name === 'string' ? parsed.phaseMeta.name : ''),
                    };
                }

                console.log('[persona-ai] PATCH =>', patch);
                await api.update(cardId, patch);
                console.log('[persona-ai] DONE in', Date.now() - latency, 'ms');
                this.toolkit?.island?.notify?.('success', 'AI 已写入', patch.name || card.name || cardId);
                refresh();
                return patch;
            } catch (err) {
                console.error('[persona-ai] ERROR', err);
                this.toolkit?.island?.notify?.('warning', 'AI 生成失败', err?.message || String(err));
                return null;
            }
        },

        async personaRemoveParO(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.persona?.variants) return null;
            const { entityType = 'ai', parOId } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id || !parOId) return null;
            const card = sdk[apiKey(entityType)].get(parOId);
            openConfirmModal({
                title: '删除 parO 卡',
                text: `确定删除「${card?.name || parOId}」？独立卡中的编辑内容也会一并删除。`,
                confirmLabel: '删除',
                danger: true,
                onConfirm: async () => {
                    await sdk.persona.variants.remove(entityType, id, parOId, 'paro');
                    refresh();
                },
            });
            return true;
        },

        async personaOpenVariant(payload = {}) {
            const sdk = window.settingsSdk;
            const entityType = payload.entityType || 'ai';
            const api = sdk?.[apiKey(entityType)];
            if (!api?.get(payload.cardId)) return null;
            await api.setActive(payload.cardId);
            const route = this.app.state[entityType] || (this.app.state[entityType] = {});
            route.sub = 'edit';
            route.id = payload.cardId;
            refresh();
            return api.get(payload.cardId);
        },

        async personaRollMood(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.persona) return null;
            const { entityType } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id) return null;
            const mood = await sdk.persona.probability.roll(entityType, id);
            this.toolkit?.island?.notify?.('success', '今日心情', mood || '平静');
            refresh();
            return mood;
        },

        async personaScheduleAddEvent(payload = {}) {
            console.log('[methods] personaScheduleAddEvent payload=', payload);
            const sdk = window.settingsSdk;
            console.log('[methods] settingsSdk.schedule =', sdk?.schedule);
            if (!sdk?.schedule) { console.warn('[methods] no schedule sdk'); return null; }
            const { entityType, title, startTime, endTime, note } = payload;
            const home = this.app.state?.personaHome || {};
            const date = payload.date || home.scheduleOpenDate || todayYmd();
            console.log('[methods] resolved date=', date, 'home.scheduleOpenDate=', home.scheduleOpenDate, 'home.entityType=', home.entityType);
            if (!title) {
                console.warn('[methods] empty title');
                this.toolkit?.island?.notify?.('error', '需要标题');
                return null;
            }
            const et = entityType || home.entityType || 'ai';
            const id = getActiveId(sdk, et);
            console.log('[methods] et=', et, 'id=', id);
            if (!id) {
                console.warn('[methods] no active id');
                this.toolkit?.island?.notify?.('error', '请先选择人设');
                return null;
            }
            const day = await sdk.schedule.addEvent(et, id, date, { title, startTime, endTime, note });
            console.log('[methods] addEvent returned day=', day);
            this.toolkit?.island?.notify?.('success', '已添加', title);
            refresh();
            bumpDetailRenderTick();
            return day;
        },

        async personaScheduleToggleOpen(payload = {}) {
            console.log('[methods] personaScheduleToggleOpen payload=', payload);
            const home = this.app.state.personaHome || (this.app.state.personaHome = {});
            const date = payload?.date || '';
            home.scheduleOpenDate = (home.scheduleOpenDate === date) ? '' : date;
            console.log('[methods] scheduleOpenDate ->', home.scheduleOpenDate);
            refresh();
            bumpDetailRenderTick();
            return home.scheduleOpenDate;
        },

        async personaScheduleUpdateEvent(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.schedule) return null;
            const { entityType, eventId, title, startTime, endTime, note } = payload;
            const home = this.app.state?.personaHome || {};
            const date = payload.date || home.scheduleOpenDate || todayYmd();
            if (!eventId || !title) return null;
            const et = entityType || home.entityType || 'ai';
            const id = getActiveId(sdk, et);
            if (!id) return null;
            const day = await sdk.schedule.updateEvent(et, id, date, eventId, { title, startTime, endTime, note });
            refresh();
            bumpDetailRenderTick();
            return day;
        },

        async personaScheduleRemoveEvent(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.schedule) return null;
            const { entityType, eventId } = payload;
            const home = this.app.state?.personaHome || {};
            const date = payload.date || home.scheduleOpenDate || todayYmd();
            if (!eventId) return null;
            const et = entityType || home.entityType || 'ai';
            const id = getActiveId(sdk, et);
            if (!id) return null;
            await sdk.schedule.removeEvent(et, id, date, eventId);
            this.toolkit?.island?.notify?.('success', '已删除');
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        async personaDailyCalc(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk?.persona) return null;
            const { entityType } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id) return null;
            await sdk.persona.probability.dailyCalculate(entityType, id);
            refresh();
            return true;
        },

        /* ============================================
         * 圈子（与世界观下其他人设的关系）
         *  数据存在 persona.circle.members: [{ id, kind, refId, name, note, addedAt }]
         *  picking 旗标存在 persona.circle.picking（不入库，只在 state 上）
         * ============================================ */

        /** 打开「拉取面板」：把 circle.picking 设为 true 让 renderer 显示候选人列表。 */
        async personaCircleOpenPicker(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const { entityType } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id) return null;
            const api = sdk[apiKey(entityType)];
            const persona = api.get(id);
            if (!persona) return null;
            const home = this.app.state.personaHome || (this.app.state.personaHome = {});
            home.circlePickerOpen = true;
            // 注意：不直接修改 persona，只在 state 上打标，renderer 据此切到 picker 视图
            // 但我们要让 refresh 触发重渲 → 直接刷新
            refresh();
            return true;
        },

        async personaCircleClosePicker(payload = {}) {
            const home = this.app.state.personaHome || (this.app.state.personaHome = {});
            home.circlePickerOpen = false;
            refresh();
            return true;
        },

        /** 真正把候选人 + 当前 textarea 里的备注写进 circle.members。 */
        async personaCircleConfirmAdd(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const { entityType } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id) return null;
            const api = sdk[apiKey(entityType)];
            const persona = api.get(id);
            if (!persona) return null;

            // 从 DOM 取：单选 value 是 `${kind}::${refId}`，textarea 是 data-circle-pick-note
            const checked = document.querySelector('input[name="persona-circle-pick"]:checked');
            const noteEl = document.querySelector('[data-circle-pick-note]');
            if (!checked) {
                this.toolkit?.island?.notify?.('error', '请先选中一个人设');
                return null;
            }
            const [kind, refId] = String(checked.value || '').split('::');
            if (!kind || !refId || (kind !== 'user' && kind !== 'ai')) {
                this.toolkit?.island?.notify?.('error', '选中项无效');
                return null;
            }
            const refApi = kind === 'user' ? sdk.users : sdk.aiPersons;
            const refEntity = refApi.get(refId);
            if (!refEntity) {
                this.toolkit?.island?.notify?.('error', '引用的人设不存在');
                return null;
            }
            const note = String(noteEl?.value || '').trim();
            // 校验：note 不能超过 200 字（防误填乱写）
            const trimmedNote = note.length > 200 ? note.slice(0, 200) : note;

            const prev = (persona.circle && typeof persona.circle === 'object') ? persona.circle : { members: [] };
            const members = Array.isArray(prev.members) ? prev.members.slice() : [];
            // 防重复
            if (members.some(m => m.kind === kind && m.refId === refId)) {
                this.toolkit?.island?.notify?.('error', '已经在圈子里了');
                return null;
            }
            const member = {
                id: `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                kind,
                refId,
                name: refEntity.name || refId,
                note: trimmedNote,
                addedAt: Date.now(),
            };
            members.push(member);
            await api.update(id, { circle: { ...prev, members } });

            // 关闭 picker + 清状态
            const home = this.app.state.personaHome || (this.app.state.personaHome = {});
            home.circlePickerOpen = false;
            this.toolkit?.island?.notify?.('success', '已加入圈子', member.name);
            refresh();
            return member;
        },

        /** 更新某个成员的备注 —— 直接用 island prompt 弹出 modal 更稳。
         *  简化做法：拿到当前 note，让用户在 modal 里再写一次。
         */
        async personaCircleEditNote(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const { entityType, memberId } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id || !memberId) return null;
            const api = sdk[apiKey(entityType)];
            const persona = api.get(id);
            if (!persona) return null;
            const prev = (persona.circle && typeof persona.circle === 'object') ? persona.circle : { members: [] };
            const members = Array.isArray(prev.members) ? prev.members.slice() : [];
            const idx = members.findIndex(m => m.id === memberId);
            if (idx < 0) return null;

            const member = members[idx];
            const initial = member.note || '';
            const next = (typeof window.prompt === 'function')
                ? window.prompt(`为「${member.name}」写下你对其的认知（不超过 200 字）`, initial)
                : null;
            if (next == null) return null; // 用户取消
            const trimmed = String(next).slice(0, 200);
            members[idx] = { ...member, note: trimmed };
            await api.update(id, { circle: { ...prev, members } });
            this.toolkit?.island?.notify?.('success', trimmed ? '已更新' : '已清空');
            refresh();
            return members[idx];
        },

        async personaCircleRemoveMember(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const { entityType, memberId } = payload;
            const id = getActiveId(sdk, entityType);
            if (!id || !memberId) return null;
            const api = sdk[apiKey(entityType)];
            const persona = api.get(id);
            if (!persona) return null;
            const prev = (persona.circle && typeof persona.circle === 'object') ? persona.circle : { members: [] };
            const members = (Array.isArray(prev.members) ? prev.members : []).filter(m => m.id !== memberId);
            await api.update(id, { circle: { ...prev, members } });
            this.toolkit?.island?.notify?.('success', '已移出圈子');
            refresh();
            return true;
        },

        /** 未绑世界观时按这个走：直接跳到世界观的库选择页。 */
        async personaOpenWorldBinding(payload = {}) {
            // 复用 worldview 入口（worldOpenLibrary 在 world methods 里）
            const action = {
                action: 'appMethod',
                appId: 'settings',
                method: 'worldOpenLibrary',
                payload: {},
            };
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('app:page-action', { detail: action }));
            }
            return true;
        },

        /* ============================================
         * 资源绑定 (boundResources)
         *  数据存放在 persona.boundResources 上：
         *    avatarGroupIds  : string[]  头像库绑定的图组 id
         *    stickerGroupIds : string[]  表情包库绑定的图组 id
         *    apiRefs         : [{ id, name, platform, url }]  API 资源（占位）
         *    promptIds       : string[]  提示词绑定（占位，等 prompt 模块）
         *  第三方账号不在此处管理（在别处独立）。
         * ============================================ */

        async _resourcesEntityActiveId(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const et = payload.entityType || window.settingsApp?.state?.personaHome?.entityType || 'user';
            return et === 'user' ? sdk.users.getActive()?.id : sdk.aiPersons.getActive()?.id;
        },

        async _resourcesGetPersona(payload = {}) {
            const sdk = window.settingsSdk;
            const id = await this._resourcesEntityActiveId(payload);
            if (!sdk || !id) return null;
            const et = payload.entityType || window.settingsApp?.state?.personaHome?.entityType || 'user';
            return et === 'user' ? sdk.users.get(id) : sdk.aiPersons.get(id);
        },

        /** 打开图组选择器（按 kind 区分：avatar / sticker）。 */
        async personaResourcesOpenPicker(payload = {}) {
            const home = window.settingsApp?.state?.personaHome || (window.settingsApp.state.personaHome = {});
            home.resources = home.resources || {};
            home.resources.pickerKind = payload.kind || '';
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        async personaResourcesClosePicker(payload = {}) {
            const home = window.settingsApp?.state?.personaHome || (window.settingsApp.state.personaHome = {});
            if (home.resources) home.resources.pickerKind = '';
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        /** 选择器里点某个图组：add / remove。 */
        async personaResourcesPickerConfirm(payload = {}) {
            const { kind, groupId, action } = payload;
            if (!kind || !groupId) return null;
            const persona = await this._resourcesGetPersona(payload);
            if (!persona) return null;
            const sdk = window.settingsSdk;
            const id = await this._resourcesEntityActiveId(payload);
            const et = payload.entityType || window.settingsApp?.state?.personaHome?.entityType || 'user';
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const prev = persona.boundResources || {};
            const field = kind === 'avatar' ? 'avatarGroupIds' : 'stickerGroupIds';
            const list = Array.isArray(prev[field]) ? prev[field].slice() : [];
            if (action === 'remove') {
                const idx = list.indexOf(groupId);
                if (idx >= 0) list.splice(idx, 1);
            } else {
                if (!list.includes(groupId)) list.push(groupId);
            }
            await api.update(id, { boundResources: { ...prev, [field]: list } });
            this.toolkit?.island?.notify?.('success', action === 'remove' ? '已解绑' : '已绑定');
            // 让资源绑定的"图组列表"下次重渲时校验路径
            _invalidateGalleryTree();
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        /** 在已绑定列表里直接移除某个图组。 */
        async personaResourcesRemoveGroup(payload = {}) {
            return this.personaResourcesPickerConfirm({ ...payload, action: 'remove' });
        },

        /** 添加 API 资源：从 __apiSdk 选择一个 key 或 group，写入 persona.boundResources.apiRefs */
        async personaResourcesAddApi(payload = {}) {
            const { refType, refId } = payload;
            if (!refType || !refId) return null;
            if (refType !== 'key' && refType !== 'group') return null;
            const persona = await this._resourcesGetPersona(payload);
            if (!persona) return null;
            const sdk = window.settingsSdk;
            const id = await this._resourcesEntityActiveId(payload);
            const et = payload.entityType || window.settingsApp?.state?.personaHome?.entityType || 'user';
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const apisdk = window.__apiSdk;
            if (!apisdk) {
                this.toolkit?.island?.notify?.('warn', 'API 模块未就绪');
                return null;
            }
            // 解析条目（仅缓存里存在则允许）
            const ref = refType === 'key'
                ? apisdk.apiKeySdk.get(refId)
                : apisdk.apiGroupSdk.get(refId);
            if (!ref) {
                this.toolkit?.island?.notify?.('warn', '资源不存在', '可能已被删除');
                return null;
            }
            const prev = persona.boundResources || {};
            const refs = Array.isArray(prev.apiRefs) ? prev.apiRefs.slice() : [];
            // 防止重复
            if (refs.some(r => r.refType === refType && r.refId === refId)) {
                this.toolkit?.island?.notify?.('info', '已绑定');
                return null;
            }
            // 写入条目（snapshot 字段用于在原资源被删除/改名后仍可显示）
            const snap = refType === 'key'
                ? {
                    name: ref.label || ref.id,
                    subTitle: `${ref.provider || 'API'} · ${ref.model || ref.baseUrl || ''}`.trim(),
                  }
                : {
                    name: ref.name || ref.id,
                    subTitle: `${(ref.apiKeyIds || []).length} 个密钥`,
                  };
            refs.push({
                refType,
                refId,
                ...snap,
                addedAt: Date.now(),
            });
            await api.update(id, { boundResources: { ...prev, apiRefs: refs } });
            this.toolkit?.island?.notify?.('success', '已绑定', snap.name);
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        async personaResourcesRemoveApi(payload = {}) {
            const { refType, refId } = payload;
            if (!refType || !refId) return null;
            const persona = await this._resourcesGetPersona(payload);
            if (!persona) return null;
            const sdk = window.settingsSdk;
            const id = await this._resourcesEntityActiveId(payload);
            const et = payload.entityType || window.settingsApp?.state?.personaHome?.entityType || 'user';
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const prev = persona.boundResources || {};
            const refs = (Array.isArray(prev.apiRefs) ? prev.apiRefs : [])
                .filter(r => !(r.refType === refType && r.refId === refId));
            await api.update(id, { boundResources: { ...prev, apiRefs: refs } });
            this.toolkit?.island?.notify?.('success', '已解绑');
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        /** 打开 API 选择器（按 type 区分：key / group）。 */
        async personaResourcesOpenApiPicker(payload = {}) {
            const home = window.settingsApp?.state?.personaHome || (window.settingsApp.state.personaHome = {});
            home.resources = home.resources || {};
            home.resources.apiPicker = { open: true, type: payload.refType || 'key' };
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        async personaResourcesCloseApiPicker(payload = {}) {
            const home = window.settingsApp?.state?.personaHome || (window.settingsApp.state.personaHome = {});
            if (home.resources?.apiPicker) home.resources.apiPicker.open = false;
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        async personaResourcesSwitchApiPicker(payload = {}) {
            const home = window.settingsApp?.state?.personaHome || (window.settingsApp.state.personaHome = {});
            home.resources = home.resources || {};
            home.resources.apiPicker = home.resources.apiPicker || { open: true };
            home.resources.apiPicker.type = payload.refType || 'key';
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        /**
         * 添加提示词绑定：
         *   - 有 payload.promptId → 直接绑定该组
         *   - 无 → 打开选择器面板
         */
        async personaResourcesAddPrompt(payload = {}) {
            const { promptId } = payload;
            if (promptId) {
                // 直接绑定指定的 prompt 组
                const persona = await this._resourcesGetPersona(payload);
                if (!persona) return null;
                const sdk = window.settingsSdk;
                const id = await this._resourcesEntityActiveId(payload);
                const et = payload.entityType || window.settingsApp?.state?.personaHome?.entityType || 'user';
                const api = et === 'user' ? sdk.users : sdk.aiPersons;
                const prev = persona.boundResources || {};
                const ids = Array.isArray(prev.promptIds) ? prev.promptIds.slice() : [];
                if (!ids.includes(promptId)) {
                    ids.push(promptId);
                }
                await api.update(id, { boundResources: { ...prev, promptIds: ids } });
                refresh();
                bumpDetailRenderTick();
                return true;
            }
            // 无 promptId → 打开选择器
            return this.personaResourcesOpenPromptPicker(payload);
        },

        /** 关闭提示词选择器 */
        async personaResourcesClosePromptPicker(payload = {}) {
            const home = window.settingsApp?.state?.personaHome || (window.settingsApp.state.personaHome = {});
            home.resources = home.resources || {};
            home.resources.promptPicker = { open: false };
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        /** 打开提示词选择器 */
        async personaResourcesOpenPromptPicker(payload = {}) {
            // 先确保 prompt 树已加载
            await _loadPromptTree();
            const home = window.settingsApp?.state?.personaHome || (window.settingsApp.state.personaHome = {});
            home.resources = home.resources || {};
            home.resources.promptPicker = { open: true };
            refresh();
            bumpDetailRenderTick();
            return true;
        },

        async personaResourcesRemovePrompt(payload = {}) {
            const persona = await this._resourcesGetPersona(payload);
            if (!persona) return null;
            const sdk = window.settingsSdk;
            const id = await this._resourcesEntityActiveId(payload);
            const et = payload.entityType || window.settingsApp?.state?.personaHome?.entityType || 'user';
            const api = et === 'user' ? sdk.users : sdk.aiPersons;
            const prev = persona.boundResources || {};
            const ids = (Array.isArray(prev.promptIds) ? prev.promptIds : []).filter(p => p !== payload.promptId);
            await api.update(id, { boundResources: { ...prev, promptIds: ids } });
            refresh();
            bumpDetailRenderTick();
            return true;
        },
    };
}
