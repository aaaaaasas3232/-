// ============================================
// App Toolkit（每个 App 拿到一个工具包）
// 从 apps.js 第 917-967 行提取
// ============================================

import { APP_ICONS, UI_ICONS, UI_SYMBOLS, UI_TOKENS } from './icons.js';
import { sharedIconLibrary } from './icon-library.js';
import { createSettingsPageBuilder } from './icon-library.js';
import {
    createDetailAction,
    createModalAction,
    createAppMethodAction,
    createOpenAppAction,
    createDeepLinkAction,
    createShareRecordAction,
    createContentCardAction,
} from './actions.js';
import { appTemplates } from './templates.js';
import {
    renderActionButton,
    renderChevronRow,
    renderSettingsGroup,
    renderSurfaceCard,
    renderSectionShell,
} from './renderers.js';
import { createIslandHelper } from './island-helper.js';
import { createAppPromptHelper } from './app-prompt-registry.js';
import { createAppDbApi, createSharedStoreApi } from './store-api.js';
import {
    collectSocialInfluences,
    listSocialInfluenceProviders,
    registerSocialInfluenceProvider,
    unregisterSocialInfluenceProvider,
} from './social-influence-registry.js';

export function createAppToolkit(appConfig, stores) {
    return {
        island: createIslandHelper(appConfig.id, appConfig.name),
        // 往 murmur「回复提示词」页注册本 App 的提示词（详见 docs/跨App注册Prompt指导方案.md）
        prompts: createAppPromptHelper(appConfig.id),
        socialInfluences: {
            register: (spec = {}) => registerSocialInfluenceProvider({
                ...spec,
                sourceAppId: appConfig.id,
            }),
            unregister: providerId => unregisterSocialInfluenceProvider(appConfig.id, providerId),
            list: (targetAppId, options = {}) => listSocialInfluenceProviders(targetAppId, options),
            collect: (targetAppId, options = {}) => collectSocialInfluences({
                ...options,
                targetAppId,
            }),
        },
        templates: appTemplates,
        db: createAppDbApi(appConfig.id, stores),
        shared: createSharedStoreApi(appConfig.id),
        icons: APP_ICONS,
        uiIcons: UI_ICONS,
        uiSymbols: UI_SYMBOLS,
        iconLibrary: sharedIconLibrary,
        tokens: UI_TOKENS,
        actions: {
            detail: pageId => createDetailAction(pageId, appConfig.id),
            modal: (modalType, payload = {}) => createModalAction(modalType, payload, appConfig.id),
            method: (methodName, payload = {}) => createAppMethodAction(methodName, payload, appConfig.id),
            openApp: (targetAppId, pageId = '', payload = {}) => createOpenAppAction(targetAppId, pageId, payload),
            deepLink: createDeepLinkAction,
            share: createShareRecordAction,
            contentCard: createContentCardAction,
        },
        builders: {
            settings: createSettingsPageBuilder(appConfig.id),
        },
        renderers: {
            renderActionButton,
            renderChevronRow,
            renderSettingsGroup,
            renderSurfaceCard,
            renderSectionShell,
        },
        app: appConfig,
    };
}
