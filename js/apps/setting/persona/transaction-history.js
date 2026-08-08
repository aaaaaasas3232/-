/**
 * settings App · 钱包流水历史页 (v0.67)
 *
 * 入口: renderTransactionHistory(app)
 *
 * 读 app.state.personaHome.txFilter = { entityType, entityId }
 * → 拿所有流水(不限 50 条),分页/无限滚动展示
 */

import { escapeHtml } from '@/src/core/escape.js';

const PAGE_SIZE = 50;

/**
 * 渲染单条流水
 */
function renderFlowItem(entry) {
    const isIn = entry.direction === 'in';
    const sign = isIn ? '+' : '-';
    const amountClass = isIn ? 'txh__amount--in' : 'txh__amount--out';
    const amountText = `${sign}${(Number(entry.amount) || 0).toFixed(2)}`;

    const typeMap = {
        'redpacket': isIn ? '收到红包' : '发红包',
        'transfer': isIn ? '收到转账' : '转账',
        'income-settle': '定时收入到账',
        'manual': '手动调整',
        'unknown': '其他',
    };
    const typeLabel = typeMap[entry.type] || entry.type || '其他';

    const counterparty = entry.counterpartyName ? escapeHtml(entry.counterpartyName) : '';
    const note = entry.note ? escapeHtml(entry.note) : '';

    const date = new Date(entry.timestamp || Date.now());
    const dateText = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

    return `
        <article class="txh__item ${isIn ? 'is-in' : 'is-out'}">
            <div class="txh__item-main">
                <div class="txh__item-title">${typeLabel}${counterparty ? ` · ${counterparty}` : ''}</div>
                ${note ? `<div class="txh__item-note">${note}</div>` : ''}
                <div class="txh__item-meta">${dateText}</div>
            </div>
            <div class="txh__item-amount ${amountClass}">${amountText}</div>
        </article>
    `;
}

/**
 * 渲染钱包流水历史页(全部流水,无 50 条限制)
 */
export function renderTransactionHistory(app) {
    const sdk = window.settingsSdk;
    if (!sdk?.assetFlow) {
        return `<div class="settings-empty">SDK 未就绪,请稍后再试</div>`;
    }

    const route = app?.state?.personaHome || {};
    const filter = route.txFilter || {};
    const entityType = filter.entityType || route.entityType || 'user';
    let entityId = filter.entityId || route.entityId || '';

    // 默认 user 卡:取默认用户卡 id
    if (entityType === 'user' && !entityId) {
        try {
            entityId = sdk?.defaultUserCard?.getDefault?.()?.id || sdk?.users?.getActive?.()?.id || '';
        } catch (_) { entityId = ''; }
    }

    if (!entityId) {
        return `<div class="settings-empty">未找到 persona</div>`;
    }

    // 读全部流水(limit=0)
    const flows = sdk.assetFlow.list(entityType, entityId, { limit: 0 });

    // 当前余额
    const balance = sdk.assetFlow.getBalance(entityType, entityId) || 0;

    // 取 persona name
    let personaName = '';
    try {
        const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
        const inst = api.get(entityId);
        personaName = entityType === 'user'
            ? (inst?.socialProfiles?.chat?.nickname || inst?.name || '用户')
            : (inst?.name || 'AI');
    } catch (_) {}

    const listHtml = flows.length === 0
        ? `<div class="txh__empty">还没有流水记录</div>`
        : flows.map((e) => renderFlowItem(e)).join('');

    return `
        <div class="txh">
            <header class="txh__header">
                <div class="txh__title">${escapeHtml(personaName)} 的钱包流水</div>
                <div class="txh__subtitle">当前余额 ¥${balance.toFixed(2)} · 共 ${flows.length} 条</div>
            </header>
            <div class="txh__list">
                ${listHtml}
            </div>
        </div>
    `;
}
