/**
 * settings-sdk · 资金流水（v0.67 私聊红包/转账 + 人设钱包）
 *
 *   业务含义：每个 user / aiPerson 都有自己的「钱包」（assetBalance 计算实时值），
 *   钱包下挂一条「资金流水」记录最近发生的收支事件。
 *
 *   数据存储：在 persona（user / aiPerson）顶层加 assetFlow: [{ id, type, direction,
 *   amount, counterpartyType, counterpartyId, counterpartyName, sourceType,
 *   sourceId, note, balance, timestamp }] 数组。
 *
 *   设计要点：
 *     1) 资金流动真的发生：每次写一条流水时同步更新 assetBalance（用 persona.asset.adjust）
 *     2) UI 渲染：钱包页 + 私聊设置页都直接读 assetFlow
 *     3) 重复检测：同一笔「AI 发红包 → user 领」的同 (amount, counterpartyId, sourceId)
 *        在 24h 内视为重复,去重保留最早一条（防 SDK 写入 + UI 重画的 race）
 *     4) 与 income-engine 兼容：assetFlow 是支出流水,incomeEvents 是定时收入,两套独立
 *
 *   API：
 *     list(entityType, entityId, opts?)             读某 persona 流水
 *     listBySource(sourceType, sourceId, opts?)    按来源（如某条红包消息）查流水
 *     add(entry, entityType, entityId)             新增一条流水（同步调 asset.adjust）
 *     getBalance(entityType, entityId)             读当前余额（走 asset.getBalance）
 *     settleAndSync(entityType, entityId)          结算定时收入 → 同步到 assetFlow 一条「定时收入到账」记录
 *     removeBySource(sourceType, sourceId, entityType, entityId)  按 sourceId 撤回（撤销时用）
 */

const FLOW_FIELD = 'assetFlow';
const DEFAULT_LIMIT = 50;
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * 生成流水 id（短 hash，避免冲突）
 */
function genId() {
    return `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 取出某 persona 的流水数组（保证是 array,缺失则给空数组）。
 */
function readFlowArray(persona) {
    if (!persona) return [];
    const arr = persona[FLOW_FIELD];
    return Array.isArray(arr) ? arr : [];
}

/**
 * 写回 persona 的流水数组（走 mergePatch 持久化）。
 */
async function writeFlowArray(sdk, entityType, entityId, list) {
    const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
    await api.update(entityId, { [FLOW_FIELD]: list });
}

/**
 * 按金额 + 来源 + 对方 + 方向 在 24h 内查重，返回已存在的 entry 或 null。
 */
function findDuplicate(list, entry) {
    const windowStart = (entry.timestamp || Date.now()) - DEDUP_WINDOW_MS;
    for (const prev of list) {
        if (!prev) continue;
        if ((prev.timestamp || 0) < windowStart) continue;
        if (prev.amount !== entry.amount) continue;
        if (prev.sourceType !== entry.sourceType) continue;
        if (prev.sourceId !== entry.sourceId) continue;
        if (prev.counterpartyId !== entry.counterpartyId) continue;
        if (prev.direction !== entry.direction) continue;
        return prev;
    }
    return null;
}

/**
 * 创建 assetFlow API（挂在 sdk.assetFlow 跟 toolkit.assetFlow）
 */
export function createAssetFlowApi(sdk) {
    return {
        /**
         * 读流水（最新在前）
         * @param {string} entityType 'user' | 'ai'
         * @param {string} entityId
         * @param {object} [opts] { limit, sourceType, counterpartyId }
         */
        list(entityType = 'user', entityId, opts = {}) {
            if (!sdk || !entityId) return [];
            const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
            const inst = api.get(entityId);
            if (!inst) return [];
            let arr = readFlowArray(inst);
            if (opts.sourceType) {
                arr = arr.filter((e) => e && e.sourceType === opts.sourceType);
            }
            if (opts.counterpartyId) {
                arr = arr.filter((e) => e && e.counterpartyId === opts.counterpartyId);
            }
            // 按 timestamp 降序
            arr = arr.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const limit = Number(opts.limit) || DEFAULT_LIMIT;
            return limit > 0 ? arr.slice(0, limit) : arr;
        },

        /**
         * 读与某条 source 关联的所有流水
         * @param {string} sourceType 'redpacket' | 'transfer' | 'income' | 'manual'
         * @param {string} sourceId   消息 id 或事件 id
         * @param {object} [opts] { entityType, entityId } - 可限定到某 persona
         */
        listBySource(sourceType, sourceId, opts = {}) {
            if (!sdk || !sourceType || !sourceId) return [];
            const out = [];
            const targets = [];
            if (opts.entityType && opts.entityId) {
                targets.push({ type: opts.entityType, id: opts.entityId });
            } else {
                // 默认全扫
                for (const u of sdk.users.getAll?.() || []) targets.push({ type: 'user', id: u.id });
                for (const a of sdk.aiPersons.getAll?.() || []) targets.push({ type: 'ai', id: a.id });
            }
            for (const { type, id } of targets) {
                const arr = readFlowArray(sdk[type === 'user' ? 'users' : 'aiPersons'].get(id));
                for (const e of arr) {
                    if (e && e.sourceType === sourceType && e.sourceId === sourceId) {
                        out.push({ ...e, _personaType: type, _personaId: id });
                    }
                }
            }
            return out;
        },

        /**
         * 新增一条流水 + 同步更新 persona.assetBalance（走 sdk.persona.asset.adjust）
         * 注意：金额是「绝对值」,方向由 direction 决定
         *
         * @param {object} entry { type, direction, amount, counterpartyType, counterpartyId, counterpartyName, sourceType, sourceId, note }
         * @param {string} entityType
         * @param {string} entityId
         * @returns {Promise<{ok: boolean, entry?: object, balance?: number, error?: string, duplicated?: boolean}>}
         */
        async add(entry = {}, entityType = 'user', entityId) {
            if (!sdk || !entityId) return { ok: false, error: 'sdk/entityId missing' };
            if (typeof entry.amount !== 'number' || !Number.isFinite(entry.amount)) {
                return { ok: false, error: 'amount invalid' };
            }
            const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
            const inst = api.get(entityId);
            if (!inst) return { ok: false, error: 'persona not found' };
            const list = readFlowArray(inst);
            const fullEntry = {
                id: genId(),
                type: entry.type || 'unknown',
                direction: entry.direction === 'in' ? 'in' : 'out',
                amount: Math.abs(entry.amount),
                counterpartyType: entry.counterpartyType || (entityType === 'user' ? 'ai' : 'user'),
                counterpartyId: entry.counterpartyId || '',
                counterpartyName: entry.counterpartyName || '',
                sourceType: entry.sourceType || 'manual',
                sourceId: entry.sourceId || '',
                note: entry.note || '',
                timestamp: entry.timestamp || Date.now(),
                balance: 0, // 写入后再回填
            };
            // 查重（24h 内同 amount/sourceId/counterpartyId/direction）
            const dup = findDuplicate(list, fullEntry);
            if (dup) {
                return { ok: true, duplicated: true, entry: dup };
            }
            // ★ v0.67.x 余额校验:支出方向必须保证余额 >= 金额
            //   - 防止「adjust() 用 Math.max(0, ...) 兜底」导致余额为 0 还能发红包
            //   - 入口路径(chat-asset-service.userSendRedpacket)有同样的检查,
            //     但加在 SDK 里是最后一道防线,任何绕过 service 直接调 add() 都会被拦
            const assetApi = sdk.persona?.asset;
            if (assetApi?.getBalance && fullEntry.direction === 'out') {
                const currentBalance = assetApi.getBalance(entityType, entityId) || 0;
                if (currentBalance < fullEntry.amount) {
                    return {
                        ok: false,
                        error: '余额不足',
                        insufficientBalance: true,
                        currentBalance,
                        amount: fullEntry.amount,
                    };
                }
            }
            // 调 persona.asset.adjust 改余额 + 落盘
            const delta = fullEntry.direction === 'in' ? fullEntry.amount : -fullEntry.amount;
            let newBalance = null;
            if (assetApi?.adjust) {
                newBalance = await assetApi.adjust(delta, fullEntry.note, entityType, entityId);
            }
            // 回填 balance 字段（写完后再读一次,避免并发覆盖）
            if (typeof newBalance === 'number') {
                fullEntry.balance = newBalance;
            }
            // 写回 assetFlow 数组
            list.push(fullEntry);
            await writeFlowArray(sdk, entityType, entityId, list);
            return { ok: true, entry: fullEntry, balance: newBalance };
        },

        /**
         * 读当前余额（走 sdk.persona.asset.getBalance）
         */
        getBalance(entityType = 'user', entityId) {
            const assetApi = sdk.persona?.asset;
            if (!assetApi?.getBalance) return 0;
            return assetApi.getBalance(entityType, entityId) || 0;
        },

        /**
         * 结算定时收入 → 在 assetFlow 写一条「定时收入到账」(direction='in', sourceType='income-settle')
         * 注意：persona.asset.adjust 已经把定时收入合到 assetBalance,我们这里只是补一条流水记录
         *
         * @returns {Promise<{ok: boolean, accrued?: number, entries?: Array}>}
         */
        async settleAndSync(entityType = 'user', entityId) {
            if (!sdk || !entityId) return { ok: false };
            const assetApi = sdk.persona?.asset;
            if (!assetApi?.settle) return { ok: false };
            const accrued = await assetApi.settle(entityType, entityId);
            if (typeof accrued === 'number' && accrued !== 0) {
                const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
                const inst = api.get(entityId);
                const list = readFlowArray(inst);
                const balance = assetApi.getBalance(entityType, entityId) || 0;
                const name = entityType === 'user'
                    ? (inst?.socialProfiles?.chat?.nickname || inst?.name || '用户')
                    : (inst?.name || 'AI');
                list.push({
                    id: genId(),
                    type: 'income-settle',
                    direction: 'in',
                    amount: Math.abs(accrued),
                    counterpartyType: 'system',
                    counterpartyId: 'income-engine',
                    counterpartyName: '定时收入到账',
                    sourceType: 'income-settle',
                    sourceId: `settle-${Date.now()}`,
                    note: `${name} 的定时收入`,
                    timestamp: Date.now(),
                    balance,
                });
                await writeFlowArray(sdk, entityType, entityId, list);
            }
            return { ok: true, accrued };
        },

        /**
         * 撤回某 source 关联的所有流水（同时反向调整余额）
         * 用于：红包 24h 未领取退款 / 转账 24h 未收款退回 等场景
         */
        async removeBySource(sourceType, sourceId, entityType = 'user', entityId) {
            if (!sdk || !sourceType || !sourceId || !entityId) return { ok: false };
            const api = entityType === 'user' ? sdk.users : sdk.aiPersons;
            const inst = api.get(entityId);
            if (!inst) return { ok: false };
            const list = readFlowArray(inst);
            const removeList = list.filter((e) => e && e.sourceType === sourceType && e.sourceId === sourceId);
            if (removeList.length === 0) return { ok: true, removed: 0 };
            // 反向调整余额（每条流水方向反转 delta）
            const assetApi = sdk.persona?.asset;
            for (const e of removeList) {
                const delta = e.direction === 'in' ? -e.amount : e.amount;
                if (assetApi?.adjust) {
                    await assetApi.adjust(delta, `撤回:${e.note}`, entityType, entityId);
                }
            }
            const nextList = list.filter((e) => !(e && e.sourceType === sourceType && e.sourceId === sourceId));
            await writeFlowArray(sdk, entityType, entityId, nextList);
            return { ok: true, removed: removeList.length };
        },

        /**
         * 按 entityType + entityId 清除全部流水（危险操作,清空钱包历史）
         * 主要给「危险操作：清空钱包」按钮用
         */
        async clear(entityType = 'user', entityId) {
            if (!sdk || !entityId) return { ok: false };
            await writeFlowArray(sdk, entityType, entityId, []);
            return { ok: true };
        },
    };
}
