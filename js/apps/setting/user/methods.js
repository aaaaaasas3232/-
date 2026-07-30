/**
 * 用户人设模块 · 业务方法
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

export function buildUserMethods() {
    return {
        userRoute(payload = {}) {
            const route = this.app.state.user || (this.app.state.user = {});
            route.sub = payload.sub || 'list';
            route.id = payload.id || null;
            refresh();
        },

        async userCreate(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const user = await sdk.users.create(payload);
            this.toolkit.island.notify('success', '已创建用户', user.name || user.id);
            refresh();
            return user;
        },

        async userDelete(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return false;
            await sdk.users.remove(payload.id);
            this.toolkit.island.notify('success', '已删除用户', payload.id);
            refresh();
            return true;
        },

        async userSetActive(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk || !payload.id) return null;
            const inst = await sdk.users.setActive(payload.id);
            this.toolkit.island.notify('success', '已切换', inst?.name || payload.id);
            refresh();
            return inst;
        },

        async userUpdateField(payload = {}) {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const { field, value } = payload;
            const user = sdk.users.getActive();
            if (!user) return null;
            const listFields = ['preferences'];
            let patch = {};
            if (listFields.includes(field) && typeof value === 'string') {
                patch[field] = value.split('\n').map(s => s.trim()).filter(Boolean);
            } else {
                patch[field] = value;
            }
            return await sdk.users.update(user.id, patch);
        },

        async userSave() {
            const sdk = window.settingsSdk;
            if (!sdk) return null;
            const user = sdk.users.getActive();
            if (!user) return null;

            // 从 DOM 收集所有 data-user-field 的值
            const fields = document.querySelectorAll('[data-user-field]');
            const patch = {};
            fields.forEach(el => {
                const field = el.getAttribute('data-user-field');
                const value = el.value;
                if (field === 'preferences') {
                    patch[field] = value.split('\n').map(s => s.trim()).filter(Boolean);
                } else {
                    patch[field] = value;
                }
            });

            await sdk.users.update(user.id, patch);
            this.toolkit.island.notify('success', '已保存用户资料', user.name || user.id);
            refresh();
            return patch;
        },
    };
}
