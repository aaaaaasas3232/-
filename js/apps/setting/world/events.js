/**
 * 世界观模块 · 事件处理器
 *
 * 处理表单中的动态交互：
 * - 预设按钮（24时制 / 12时辰制 / 自定义）
 * - 日期清除按钮
 * - 隐藏 input 更新
 * - Toggle Tab 切换
 */

let _initialized = false;

/**
 * 处理 Toggle Tab 切换
 */
function handleToggleTab(e) {
    const btn = e.target.closest('.wv-editor__toggle-tab');
    if (!btn) return;

    const tabs = btn.closest('.wv-editor__toggle-tabs');
    if (!tabs) return;

    const value = btn.dataset.value;
    const hiddenInput = tabs.parentElement.querySelector('input[type="hidden"]');

    // 更新按钮状态
    tabs.querySelectorAll('.wv-editor__toggle-tab').forEach(b => {
        b.classList.toggle('is-active', b.dataset.value === value);
    });

    // 更新隐藏值
    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

/**
 * 处理预设按钮点击
 */
function handlePresetClick(e) {
    const btn = e.target.closest('[data-hours-preset]');
    if (!btn) return;

    const preset = btn.dataset.hoursPreset;
    let count = parseInt(btn.dataset.hoursCount) || 12;
    // 支持新旧两种 class 名
    const block = btn.closest('.wv-hours-block, .wv-hours-block-wrapper');
    if (!block) return;

    // 如果是自定义模式，支持选择数量
    if (preset === 'custom') {
        // 弹出数量选择（通过自定义按钮组实现）
        // 检查是否有自定义数量选择器
        const customSelector = block.querySelector('.wv-hours-custom-selector');
        if (customSelector) {
            // 已经显示数量选择器，切换到选中的数量
            const activeBtn = customSelector.querySelector('.wv-custom-count-btn.is-active');
            if (activeBtn) {
                count = parseInt(activeBtn.dataset.hoursCount) || 6;
            }
        } else {
            // 第一次点击自定义，显示数量选择器
            renderCustomSelector(block, count);
            // 更新按钮状态
            block.querySelectorAll('.wv-preset-btn').forEach(b => {
                b.classList.toggle('is-active', b.dataset.hoursPreset === preset);
            });
            return; // 不继续执行，由数量选择器处理
        }
    }

    // 更新按钮状态
    block.querySelectorAll('.wv-preset-btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.hoursPreset === preset);
    });

    // 更新 data 属性
    block.dataset.hoursMode = preset;

    // 生成新的时辰数据
    let customHours = [];
    if (preset === '24h') {
        customHours = Array.from({ length: 24 }, (_, i) => `${i}时`);
    } else if (preset === '12h') {
        customHours = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    } else {
        // 自定义模式，使用选中的数量
        customHours = Array.from({ length: count }, (_, i) => `时段${i + 1}`);
    }

    // 更新隐藏数据
    const hiddenInput = block.querySelector('input[type="hidden"]');
    if (hiddenInput) {
        try {
            const data = JSON.parse(hiddenInput.value || '{}');
            data.customHours = customHours;
            hiddenInput.value = JSON.stringify(data);
        } catch (err) {
            console.error('[events] 解析 hours 数据失败:', err);
        }
    }

    // 重新渲染时段列表
    const body = block.querySelector('.wv-hours-body');
    if (body) {
        const hourLabel = '时';
        const periodCount = customHours.length;
        const segmentHours = (24 / periodCount).toFixed(1);
        const ratioHint = `1 ${hourLabel} = ${segmentHours} 小时`;

        const periodsHtml = customHours.map((name, i) => {
            const startHour = Math.floor(i * (24 / periodCount));
            const endHour = Math.floor((i + 1) * (24 / periodCount));
            return `
                <div class="wv-hours-period" data-period-idx="${i}">
                    <span class="wv-hours-period__range">${startHour}-${endHour}</span>
                    <input class="wv-hours-period__name" type="text"
                        data-hours-period="${i}"
                        placeholder="${hourLabel}" value="${name}">
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div class="wv-hours-hint">${ratioHint}</div>
            <div class="wv-hours-periods">${periodsHtml}</div>
        `;
    }
}

/**
 * 渲染自定义数量选择器
 */
function renderCustomSelector(block, currentCount) {
    const presetsContainer = block.querySelector('.wv-hours-presets');
    if (!presetsContainer) return;

    // 检查是否已有选择器
    let selector = block.querySelector('.wv-hours-custom-selector');
    if (selector) {
        selector.remove();
    }

    // 创建数量选择器
    const counts = [3, 4, 5, 6, 7, 8];
    const buttonsHtml = counts.map(c => `
        <button class="wv-custom-count-btn ${c === currentCount ? 'is-active' : ''}"
            data-hours-count="${c}">
            ${c}时段
        </button>
    `).join('');

    selector = document.createElement('div');
    selector.className = 'wv-hours-custom-selector is-visible';
    selector.innerHTML = buttonsHtml;

    // 插入到预设行下面（作为兄弟元素）
    presetsContainer.insertAdjacentElement('afterend', selector);

    // 监听数量选择按钮
    selector.addEventListener('click', (e) => {
        const countBtn = e.target.closest('.wv-custom-count-btn');
        if (!countBtn) return;

        const newCount = parseInt(countBtn.dataset.hoursCount) || 6;

        // 更新按钮状态
        selector.querySelectorAll('.wv-custom-count-btn').forEach(b => {
            b.classList.toggle('is-active', parseInt(b.dataset.hoursCount) === newCount);
        });

        // 重新应用当前预设（使用新数量）
        applyCustomPreset(block, newCount);
    });
}

/**
 * 应用自定义预设（指定数量）
 */
function applyCustomPreset(block, count) {
    // 更新所有自定义按钮的 data-count
    block.querySelectorAll('.wv-preset-btn[data-hours-preset="custom"]').forEach(btn => {
        btn.dataset.hoursCount = count;
    });

    // 生成新的时辰数据
    const customHours = Array.from({ length: count }, (_, i) => `时段${i + 1}`);

    // 更新隐藏数据
    const hiddenInput = block.querySelector('input[type="hidden"]');
    if (hiddenInput) {
        try {
            const data = JSON.parse(hiddenInput.value || '{}');
            data.customHours = customHours;
            hiddenInput.value = JSON.stringify(data);
        } catch (err) {
            console.error('[events] 解析 hours 数据失败:', err);
        }
    }

    // 重新渲染时段列表
    const body = block.querySelector('.wv-hours-body');
    if (body) {
        const hourLabel = '时';
        const periodCount = customHours.length;
        const segmentHours = (24 / periodCount).toFixed(1);
        const ratioHint = `1 ${hourLabel} = ${segmentHours} 小时`;

        const periodsHtml = customHours.map((name, i) => {
            const startHour = Math.floor(i * (24 / periodCount));
            const endHour = Math.floor((i + 1) * (24 / periodCount));
            return `
                <div class="wv-hours-period" data-period-idx="${i}">
                    <span class="wv-hours-period__range">${startHour}-${endHour}</span>
                    <input class="wv-hours-period__name" type="text"
                        data-hours-period="${i}"
                        placeholder="${hourLabel}" value="${name}">
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div class="wv-hours-hint">${ratioHint}</div>
            <div class="wv-hours-periods">${periodsHtml}</div>
        `;
    }
}

/**
 * 处理输入变化（同步到隐藏 input）
 */
function handleInput(e) {
    const target = e.target;

    // 时段名称输入变化
    if (target.matches('.wv-hours-period__name')) {
        const block = target.closest('.wv-hours-block, .wv-hours-block-wrapper');
        if (!block) return;

        const periodInputs = block.querySelectorAll('.wv-hours-period__name');
        const periodNames = Array.from(periodInputs).map(input => input.value.trim());

        // 更新隐藏的 JSON 数据
        const hiddenInput = block.querySelector('input[type="hidden"]');
        if (hiddenInput) {
            try {
                const data = JSON.parse(hiddenInput.value || '{}');
                data.customHours = periodNames;
                hiddenInput.value = JSON.stringify(data);
            } catch (err) {
                console.error('[events] 解析 hours 数据失败:', err);
            }
        }
        return;
    }

    // 日期输入变化（v0.17：3 段格式 "year/month/day"）
    if (target.matches('.wv-date-input--num')) {
        const row = target.closest('.wv-date-row');
        if (!row) return;

        // 解析字段可见性（隐藏字段不写入日期字符串，对应段位保留为空）
        let visibility = { year: true, month: true, day: true };
        const visibilityAttr = row.querySelector('[data-wv-date-hidden="1"]')?.getAttribute('data-wv-date-visibility');
        if (visibilityAttr) {
            try { visibility = { ...visibility, ...JSON.parse(visibilityAttr) }; } catch (_) { /* ignore */ }
        }

        // 读取所有日期输入（年/月/日，3 段数值）
        const yearInput = row.querySelector('[data-timeline-field$="_years"], [data-chronicle-event-field$="_years"], [data-world-field$="_years"]');
        const monthInput = row.querySelector('[data-timeline-field$="_months"], [data-chronicle-event-field$="_months"], [data-world-field$="_months"]');
        const dayInput = row.querySelector('[data-timeline-field$="_days"], [data-chronicle-event-field$="_days"], [data-world-field$="_days"]');

        const yearRaw = yearInput ? yearInput.value.trim() : '';
        const monthRaw = monthInput ? monthInput.value.trim() : '';
        const dayRaw = dayInput ? dayInput.value.trim() : '';
        const year = visibility.year ? yearRaw : '';
        const month = visibility.month ? monthRaw : '';
        const day = visibility.day ? dayRaw : '';

        // 找到对应的 hidden input（通过 field key）
        const fieldKey = row.querySelector('[data-date-clear]')?.dataset.dateClear || 'date';
        const hiddenInput = row.querySelector(`input[data-world-field="${fieldKey}"], input[data-timeline-field="${fieldKey}"], input[data-chronicle-event-field="${fieldKey}"]`);
        if (hiddenInput) {
            const hasAny = year || month || day;
            // v0.17：3 段格式 "year/month/day"
            hiddenInput.value = hasAny ? `${year}/${month}/${day}` : '';
        }
        return;
    }

    // 周名称输入变化
    if (target.matches('.wv-weekday-input')) {
        const row = target.closest('.wv-weekdays-row');
        if (!row) return;

        const weekInputs = row.querySelectorAll('.wv-weekday-input');
        const weekNames = Array.from(weekInputs).map(input => input.value.trim() || input.placeholder);

        // 更新隐藏的 JSON 数据
        const hiddenInput = row.querySelector('[data-wv-weekdays-field]');
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(weekNames);
        }
        return;
    }
}

/**
 * 处理日期清除按钮点击
 */
function handleDateClear(e) {
    const btn = e.target.closest('[data-date-clear]');
    if (!btn) return;

    const fieldKey = btn.dataset.dateClear;
    const row = btn.closest('.wv-date-row');
    if (!row) return;

    // 清空年/月/日 输入框
    row.querySelectorAll('input[type="number"]').forEach(input => {
        input.value = '';
    });

    // 更新隐藏的日期字符串
    const hiddenInput = row.querySelector(`input[data-world-field="${fieldKey}"], input[data-timeline-field="${fieldKey}"], input[data-chronicle-event-field="${fieldKey}"]`);
    if (hiddenInput) {
        hiddenInput.value = '';
    }
}

/**
 * 处理场所访问备注的勾选切换
 * 勾选时启用频率选择和备注输入框，取消勾选时禁用
 */
function handleLocationAccessToggle(e) {
    const checkbox = e.target.closest('.wv-location-access__checkbox');
    if (!checkbox) return;

    const personaCard = checkbox.closest('.wv-location-access__persona');
    if (!personaCard) return;

    const isEnabled = checkbox.checked;

    // 切换 card 的 enabled 样式
    personaCard.classList.toggle('is-enabled', isEnabled);

    // 获取 body
    const body = personaCard.querySelector('.wv-location-access__persona-body');
    if (!body) return;

    // 切换 body 的折叠样式
    body.classList.toggle('is-collapsed', !isEnabled);

    // 启用/禁用频率选择和备注输入框
    const frequencySelect = body.querySelector('.wv-location-access__frequency');
    const noteTextarea = body.querySelector('.wv-location-access__note');

    if (frequencySelect) frequencySelect.disabled = !isEnabled;
    if (noteTextarea) noteTextarea.disabled = !isEnabled;

    // 更新计数
    updateLocationAccessCount(personaCard.closest('.wv-location-access'));
}

/**
 * 处理场所访问备注的全选/清空
 */
function handleLocationAccessSelect(e) {
    const btn = e.target.closest('[data-location-access-select]');
    if (!btn) return;

    const selectType = btn.dataset.locationAccessSelect;
    const container = btn.closest('.wv-location-access');
    if (!container) return;

    const checkboxes = container.querySelectorAll('.wv-location-access__checkbox');

    if (selectType === 'all') {
        checkboxes.forEach(cb => {
            if (!cb.checked) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    } else if (selectType === 'none') {
        checkboxes.forEach(cb => {
            if (cb.checked) {
                cb.checked = false;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
}

/**
 * 更新场所访问备注的已选计数
 */
function updateLocationAccessCount(container) {
    if (!container) return;
    const checkboxes = container.querySelectorAll('.wv-location-access__checkbox');
    const enabledCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const totalCount = checkboxes.length;
    const countEl = container.querySelector('.wv-location-access__count');
    if (countEl) {
        countEl.textContent = `${enabledCount}/${totalCount}`;
    }
}

// ============================================
// 统一委托：data-* 标签 → app:page-action 事件
// 取代了原来 library.js / library.js 里的 inline onchange/oninput。
// ============================================

const APP_METHOD_ACTIONS = {
    'data-world-assign': (el) => ({
        action: 'appMethod',
        appId: 'settings',
        method: 'worldAssignGroup',
        payload: { worldId: el.dataset.worldAssign, groupId: el.value || null },
    }),
    'data-wv-select-place': (el) => ({
        action: 'appMethod',
        appId: 'settings',
        method: 'worldSelectMapPlace',
        payload: { placeId: el.value },
    }),
    'data-wv-map-center': (el) => ({
        action: 'appMethod',
        appId: 'settings',
        method: 'worldSetMapCenter',
        payload: { locId: el.value },
    }),
};

/** 找到第一个匹配的 data-* 映射项。 */
function findDataAction(el) {
    for (const key of Object.keys(APP_METHOD_ACTIONS)) {
        if (el.hasAttribute(key)) return APP_METHOD_ACTIONS[key](el);
    }
    return null;
}

/** 触发 app:page-action 事件。 */
function dispatchPageAction(action) {
    window.dispatchEvent(new CustomEvent('app:page-action', { detail: action }));
}

function handleSelectChange(e) {
    const a = findDataAction(e.target);
    if (a) dispatchPageAction(a);
}

function handleZoomInput(e) {
    const t = e.target;
    if (!t.matches('[data-wv-zoom]')) return;
    dispatchPageAction({
        action: 'appMethod',
        appId: 'settings',
        method: 'worldSyncMapZoom',
        payload: { zoom: Number(t.value) },
    });
}

function handleZoomChange(e) {
    const t = e.target;
    if (!t.matches('[data-wv-zoom]')) return;
    dispatchPageAction({
        action: 'appMethod',
        appId: 'settings',
        method: 'worldSetMapZoom',
        payload: { zoom: Number(t.value) },
    });
}

/**
 * 主点击处理
 */
function handleClick(e) {
    handleToggleTab(e);
    handlePresetClick(e);
    handleDateClear(e);
    handleLocationAccessToggle(e);
    handleLocationAccessSelect(e);
}

// ============================================
// 初始化
// ============================================

export function initWorldEventHandlers() {
    if (_initialized) return;
    _initialized = true;

    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleSelectChange, true);
    document.addEventListener('change', handleZoomChange, true);
    document.addEventListener('input', handleZoomInput, true);
}

export function destroyWorldEventHandlers() {
    if (!_initialized) return;
    _initialized = false;

    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('change', handleSelectChange, true);
    document.removeEventListener('change', handleZoomChange, true);
    document.removeEventListener('input', handleZoomInput, true);
}
