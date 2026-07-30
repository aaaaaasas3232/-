/**
 * 小听框架 - 小组件选择面板（widget picker）
 * 责任：
 *   - 在桌面编辑态被触发，拉出一个浮层列出当前已注册的所有 widgets
 *   - 点击某 widget → 调 desktop-edit 的 addWidgetAndClosePicker
 *   - 提供 panelRef 给 core-shim 嵌入模板
 *
 * 与灵动岛迷你 widget 显示解耦：这里是一个独立的 full-viewport 浮层，
 * 灵动岛上 mini 模式的 widget 图标只是"几个 widget 占一起"的视觉预览。
 * 真正的 picker UI 在这里。
 *
 * 设计前提：
 *   - 由 core-shim 的 setup() 创建 picker 实例，传入 desktop-edit 的 API
 *   - 模板里 :style、:class 都基于 picker state 计算
 *   - 与 island 解耦：island 只是被 desk-edit 调用来拉一下迷你 widget 预览
 */
export function useWidgetPicker({ listAvailableWidgets, addWidgetAndClosePicker, closePicker }) {
    const visible = Vue.ref(false);
    const widgetsRef = Vue.ref([]);

    function refreshSnapshots() {
        widgetsRef.value = listAvailableWidgets();
    }

    function openPicker(initialList = null) {
        const list = Array.isArray(initialList) ? initialList : listAvailableWidgets();
        widgetsRef.value = list.slice();
        visible.value = true;
    }

    function updateSnapshotsFromRegistry() {
        // panel 已经开的话，只更新当前列表，让已添加的标记刷新
        if (!visible.value) return;
        widgetsRef.value = listAvailableWidgets();
    }

    function closePickerUi() {
        visible.value = false;
        widgetsRef.value = [];
    }

    function pickWidget(qualifiedId) {
        // 不再检查 visible.value：pointerup 会早于 click 触发 closeWidgetPicker，
        // 把 visible 设回 false；如果这里再 guard，widget 就加不上去了。
        // 让 addWidgetAndClosePicker 自己处理"qualifiedId 是否存在"。
        const picked = addWidgetAndClosePicker(qualifiedId);
        if (picked) {
            refreshSnapshots();
        }
    }

    return {
        visible,
        widgetsRef,
        openPicker,
        closePickerUi,
        updateSnapshotsFromRegistry,
        onPickWidget: pickWidget,
        onClose: () => {
            if (typeof closePicker === 'function') {
                closePicker();
            } else {
                closePickerUi();
            }
        },
    };
}