// ============================================
// 动作系统（actions）
// 用于 app 间跳转、弹窗、调用方法、分享等
// ============================================

import { escapeHtml } from './escape.js';

/* 规范化 action 对象，自动补 appId */
export function createActionObject(action, appId) {
    const normalizedAction = action && typeof action === 'object'
        ? { ...action }
        : {};

    if (appId && !normalizedAction.appId) {
        normalizedAction.appId = appId;
    }

    return normalizedAction;
}

/* 把 action 序列化成字符串（用于 HTML data 属性） */
export function serializeAction(action, appId) {
    return escapeHtml(JSON.stringify(createActionObject(action, appId)));
}

/* 生成 data-app-action 属性字符串 */
export function createActionAttr(action, appId) {
    return `data-app-action='${serializeAction(action, appId)}'`;
}

export function createDetailAction(pageId, appId = '') {
    return {
        action: 'detail',
        pageId,
        ...(appId ? { appId } : {})
    };
}

export function createOpenAppAction(targetAppId, pageId = '', payload = {}) {
    return {
        action: 'openApp',
        targetAppId,
        ...(pageId ? { pageId } : {}),
        ...(payload && Object.keys(payload).length ? { payload } : {})
    };
}

export function createModalAction(modalType = 'center', payload = {}, appId = '') {
    return createActionObject({
        action: 'modal',
        modalType,
        payload,
    }, appId);
}

export function createDeepLinkAction(targetAppId, pageId, payload = {}) {
    return {
        action: 'deepLink',
        targetAppId,
        pageId,
        payload,
    };
}

export function createShareRecordAction(targetAppId, entityType, entityId, payload = {}) {
    return {
        action: 'shareRecord',
        targetAppId,
        entityType,
        entityId,
        payload,
    };
}

export function createAppMethodAction(method, payload = {}, appId = '') {
    return createActionObject({
        action: 'appMethod',
        method,
        payload,
    }, appId);
}

export function createAppAction(action, appId) {
    return JSON.stringify(createActionObject(action, appId));
}
