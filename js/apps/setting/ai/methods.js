/**
 * AI 人设模块 · 业务方法
 */

function refresh() {
    window.refreshPhoneApps?.();
    // 强制让 Vue 重新评估 currentDetailView 等 reactive 链，
    // 这样 detail 内的 renderPage 才会重新执行。
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) {
        appsRef.value = [...appsRef.value];
    }
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
}

export function buildAiMethods() {
    return {
        aiRoute(payload = {}) {
            const route = this.app.state.ai || (this.app.state.ai = {});
            route.sub = payload.sub || 'list';
            route.id = payload.id || null;
            refresh();
        },

        aiSearch(payload = {}) {
            const route = this.app.state.ai || (this.app.state.ai = {});
            route.search = payload.value || '';
            refresh();
        },

        aiClearSearch() {
            const route = this.app.state.ai || (this.app.state.ai = {});
            route.search = '';
            refresh();
        },

        async aiCreate(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            // 一个 AI 绑定一个世界观（默认绑定当前激活的世界观）
            const activeWorld = sdk.worlds.getActive();
            const ai = await sdk.aiPersons.create({
                boundWorldId: activeWorld?.id || '',
                ...payload,
            });
            // v0.17：已移除社媒自动派生
            this.toolkit.island.notify('success', '已创建 AI 人设', ai.name || ai.id);
            refresh();
            return ai;
        },

        async aiDelete(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return false;
            await sdk.aiPersons.remove(payload.id);
            this.toolkit.island.notify('success', '已删除 AI 人设', payload.id);
            refresh();
            return true;
        },

        async aiSetActive(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return null;
            const inst = await sdk.aiPersons.setActive(payload.id);
            this.toolkit.island.notify('success', '已切换', inst?.name || payload.id);
            refresh();
            return inst;
        },

        async aiUpdateField(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const { field, value } = payload;
            const ai = sdk.aiPersons.getActive();
            if (!ai) return null;
            const listFields = ['rules'];
            let patch = {};
            if (listFields.includes(field) && typeof value === 'string') {
                patch[field] = value.split('\n').map(s => s.trim()).filter(Boolean);
            } else {
                patch[field] = value;
            }
            return await sdk.aiPersons.update(ai.id, patch);
        },

        async aiSave() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const ai = sdk.aiPersons.getActive();
            if (!ai) return null;

            // 从 DOM 收集所有 data-ai-field 的值
            const fields = document.querySelectorAll('[data-ai-field]');
            const patch = {};
            fields.forEach(el => {
                const field = el.getAttribute('data-ai-field');
                const value = el.value;
                if (field === 'rules') {
                    patch[field] = value.split('\n').map(s => s.trim()).filter(Boolean);
                } else {
                    patch[field] = value;
                }
            });

            await sdk.aiPersons.update(ai.id, patch);

            // v0.17：已移除社媒自动派生
            this.toolkit.island.notify('success', '已保存 AI 人设', ai.name || ai.id);
            refresh();
            return patch;
        },
    };
}
