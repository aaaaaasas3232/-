// ============================================
// 全局图标库 + 设置页构造器
// 从 apps.js 第 411-496 行提取
// ============================================

import { UI_ICONS, UI_SYMBOLS } from './icons.js';
import {
    createActionObject,
    createContentCardAction,
    createDetailAction,
    createModalAction,
    createAppMethodAction,
    createShareRecordAction,
} from './actions.js';
import { renderSettingsGroup } from './renderers.js';

function createPresetIconLibrary() {
    const library = new Map();

    function register(name, value) {
        if (!name || !value) {
            return false;
        }
        library.set(name, value);
        return true;
    }

    function get(name, fallback = '') {
        return library.get(name) || fallback;
    }

    function has(name) {
        return library.has(name);
    }

    function entries() {
        return [...library.entries()];
    }

    return Object.freeze({
        register,
        get,
        has,
        entries,
    });
}

export const sharedIconLibrary = createPresetIconLibrary();
sharedIconLibrary.register('heart', UI_ICONS.heart);
sharedIconLibrary.register('play', UI_ICONS.play);
sharedIconLibrary.register('pause', UI_ICONS.pause);
sharedIconLibrary.register('send', UI_ICONS.send);
sharedIconLibrary.register('plus', UI_ICONS.plus);
sharedIconLibrary.register('back', UI_ICONS.back);
sharedIconLibrary.register('settingsBlue', {
    glyph: UI_SYMBOLS.settingsBlue,
    className: 'flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#3b82f6] text-white text-[15px]'
});
sharedIconLibrary.register('privacyBlue', {
    glyph: UI_SYMBOLS.privacyBlue,
    className: 'flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#2563eb] text-white text-[15px]'
});

export function resolveNamedIcon(name, fallback = '') {
    return sharedIconLibrary.get(name, fallback);
}

export function createRowPreset({ title = '', iconName = '', description = '', action = null, rowId = '', dataRole = '' } = {}, appId = '') {
    const iconPreset = iconName ? resolveNamedIcon(iconName, null) : null;
    return {
        title,
        description,
        action: createActionObject(action, appId),
        rowId,
        dataRole,
        icon: typeof iconPreset === 'object' ? iconPreset.glyph : iconPreset,
        iconClassName: typeof iconPreset === 'object' ? iconPreset.className : '',
    };
}

export function createSettingsPageBuilder(appId = '') {
    return {
        detail(pageId) {
            return createDetailAction(pageId, appId);
        },
        modal(modalType, payload = {}) {
            return createModalAction(modalType, payload, appId);
        },
        method(methodName, payload = {}) {
            return createAppMethodAction(methodName, payload, appId);
        },
        share(targetAppId, entityType, entityId, payload = {}) {
            return createShareRecordAction(targetAppId, entityType, entityId, payload);
        },
        contentCard(targetAppId, entityType, entityId, payload = {}) {
            return createContentCardAction(targetAppId, entityType, entityId, payload);
        },
        row(config = {}) {
            return createRowPreset(config, appId);
        },
        group(config = {}) {
            return renderSettingsGroup(config, appId);
        },
    };
}
