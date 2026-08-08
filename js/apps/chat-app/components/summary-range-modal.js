/**
 * chat-app / 概要范围选择弹窗 (v0.61.3)
 *
 *   用途:用户在「历史消息页」「故事存档页」点「生成概要」/「故事概要」时,
 *   先弹这个弹窗选日期范围 / 故事会话,选定后弹 summary-edit-modal 让用户
 *   编辑/确认概要内容。
 *
 *   v0.61 占位版:选完范围后立刻 buildPlaceholderFromMessages 拼一段文本,
 *   然后关闭本弹窗 + 弹 summary-edit-modal。
 *
 *   设计要点:
 *     - 完全 Vue 组件配置 + framework appModal 协议(由 chat-modal-registry
 *       通过 _dispatch 派发)
 *     - 选择态全部走 component 内部 data(选择日期用 selectedDays: Set)
 *     - 所有 action 通过 $emit('close' / 'confirm') 派发,不直接绑 addEventListener
 *     - 取消按钮 / 点遮罩 / 右上角 X 都触发 close
 *
 *   props:
 *     mode            'calendar' | 'story'         日历/故事模式
 *     contactName     string                       联系人名(标题副标)
 *     availableDays   Array<{ dateKey, count }>    哪些天有聊天记录(可选)
 *     messages        Array                        当前故事会话的消息列表(可选)
 *
 *   events:
 *     close()
 *     confirm({ startDay, endDay, messages, mode, contactName })
 */

const SummaryRangeModal = {
    name: 'SummaryRangeModal',
    props: {
        mode: { type: String, default: 'calendar' },  // 'calendar' | 'story'
        contactName: { type: String, default: '' },
        availableDays: { type: Array, default: () => [] },
        messages: { type: Array, default: () => [] },
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            // 日历模式选择态
            selectedDays: new Set(),
            // 故事模式不需要选日期(整个故事会话),用一个隐藏的 placeholder
            monthOffset: 0,  // 0 = 当前月(预留:后续可翻月份选范围)
            monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
            weekDays: ['日', '一', '二', '三', '四', '五', '六'],
            nowDate: new Date(),
        };
    },
    computed: {
        isCalendar() { return this.mode === 'calendar'; },
        isStory() { return this.mode === 'story'; },
        title() {
            return this.isStory ? '故事概要' : '生成概要';
        },
        subtitle() {
            return this.contactName ? `${this.contactName}` : '请选择范围';
        },
        sortedDays() {
            const list = Array.isArray(this.availableDays) ? this.availableDays : [];
            return list
                .slice()
                .sort((a, b) => (a.dateKey || '').localeCompare(b.dateKey || ''));
        },
        daysByMonth() {
            const byMonth = new Map();  // key = 'YYYY-MM' → { year, month, days: [...] }
            for (const d of this.sortedDays) {
                const dk = String(d.dateKey || '');
                const m = dk.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (!m) continue;
                const year = Number(m[1]);
                const month = Number(m[2]); // 1-12
                const day = Number(m[3]);
                const key = `${year}-${String(month).padStart(2, '0')}`;
                if (!byMonth.has(key)) {
                    byMonth.set(key, { year, month, days: [] });
                }
                byMonth.get(key).days.push({
                    dateKey: dk,
                    day,
                    count: Number(d.count) || 0,
                });
            }
            // 月份升序
            return Array.from(byMonth.values()).sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });
        },
        selectedCount() {
            return this.selectedDays.size;
        },
        selectedRangeText() {
            if (this.selectedDays.size === 0) return '请选择日期';
            const arr = Array.from(this.selectedDays).sort();
            const lo = arr[0];
            const hi = arr[arr.length - 1];
            if (lo === hi) return lo;
            return `${lo} ~ ${hi}(共 ${this.selectedCount} 天)`;
        },
        messageCount() {
            const list = Array.isArray(this.messages) ? this.messages : [];
            if (this.isStory) return list.length;
            // 日历模式 = 选中的天数里有消息的总数(粗略:假定每个 day.count)
            let n = 0;
            for (const d of this.sortedDays) {
                if (this.selectedDays.has(d.dateKey)) n += Number(d.count) || 0;
            }
            return n;
        },
        canConfirm() {
            if (this.isStory) return this.messageCount > 0;
            return this.selectedCount > 0;
        },
    },
    methods: {
        toggleDay(dateKey) {
            if (!dateKey) return;
            const next = new Set(this.selectedDays);
            if (next.has(dateKey)) next.delete(dateKey);
            else next.add(dateKey);
            this.selectedDays = next;
        },
        applyPreset(preset) {
            // 预设:3天 / 7天 / 本月 / 上月 / 本年
            const sorted = this.sortedDays.slice();
            if (sorted.length === 0) return;
            const last = sorted[sorted.length - 1];
            if (!last) return;
            const target = new Set();
            if (preset === 'recent3' || preset === 'recent7') {
                const n = preset === 'recent3' ? 3 : 7;
                for (let i = Math.max(0, sorted.length - n); i < sorted.length; i++) {
                    target.add(sorted[i].dateKey);
                }
            } else if (preset === 'thisMonth') {
                const [y, m] = last.dateKey.split('-').map(Number);
                for (const d of sorted) {
                    const [dy, dm] = d.dateKey.split('-').map(Number);
                    if (dy === y && dm === m) target.add(d.dateKey);
                }
            } else if (preset === 'lastMonth') {
                const [y, m] = last.dateKey.split('-').map(Number);
                let prevY = y;
                let prevM = m - 1;
                if (prevM < 1) { prevY -= 1; prevM = 12; }
                for (const d of sorted) {
                    const [dy, dm] = d.dateKey.split('-').map(Number);
                    if (dy === prevY && dm === prevM) target.add(d.dateKey);
                }
            } else if (preset === 'thisYear') {
                const [y] = last.dateKey.split('-').map(Number);
                for (const d of sorted) {
                    const [dy] = d.dateKey.split('-').map(Number);
                    if (dy === y) target.add(d.dateKey);
                }
            }
            this.selectedDays = target;
        },
        onConfirm() {
            if (!this.canConfirm) return;
            const arr = Array.from(this.selectedDays).sort();
            const startDay = arr[0] || '';
            const endDay = arr[arr.length - 1] || '';
            this.$emit('confirm', {
                mode: this.mode,
                startDay,
                endDay,
                selectedDays: arr.slice(),
                messages: Array.isArray(this.messages) ? this.messages.slice() : [],
                contactName: this.contactName,
            });
            this.$emit('close');
        },
        onCancel() { this.$emit('close'); },
    },
    template: `
        <div class="summary-range-modal-overlay" @click.self="onCancel">
            <div class="summary-range-modal">
                <div class="summary-range-modal-header">
                    <div class="summary-range-modal-title">{{ title }}</div>
                    <div class="summary-range-modal-subtitle">{{ subtitle }}</div>
                    <button class="summary-range-modal-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <!-- 故事模式:不需选日期,显示当前故事概要 -->
                <div class="summary-range-modal-body" v-if="isStory">
                    <div class="summary-range-mode-block">
                        <div class="summary-range-mode-icon" data-kind="story">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z"/>
                            </svg>
                        </div>
                        <div class="summary-range-mode-text">
                            <div class="summary-range-mode-title">当前故事会话</div>
                            <div class="summary-range-mode-desc">包含 {{ messageCount }} 条消息,占位 AI 将拼接生成概要</div>
                        </div>
                    </div>
                </div>

                <!-- 日历模式:按月展示可选日期方块 + 预设按钮 -->
                <div class="summary-range-modal-body" v-else>
                    <div class="summary-range-presets">
                        <button type="button" class="summary-range-preset-chip" @click="applyPreset('recent3')">最近3天</button>
                        <button type="button" class="summary-range-preset-chip" @click="applyPreset('recent7')">最近7天</button>
                        <button type="button" class="summary-range-preset-chip" @click="applyPreset('thisMonth')">本月</button>
                        <button type="button" class="summary-range-preset-chip" @click="applyPreset('lastMonth')">上月</button>
                        <button type="button" class="summary-range-preset-chip" @click="applyPreset('thisYear')">本年</button>
                    </div>

                    <div class="summary-range-months">
                        <div class="summary-range-month" v-for="m in daysByMonth" :key="m.year + '-' + m.month">
                            <div class="summary-range-month-title">{{ m.year }} 年 {{ monthNames[m.month - 1] }}</div>
                            <div class="summary-range-day-grid">
                                <button v-for="d in m.days" :key="d.dateKey"
                                    type="button"
                                    class="summary-range-day-btn"
                                    :class="{ 'is-selected': selectedDays.has(d.dateKey) }"
                                    @click="toggleDay(d.dateKey)"
                                    :title="d.dateKey + ' · ' + d.count + ' 条'">
                                    <span class="summary-range-day-num">{{ d.day }}</span>
                                    <span class="summary-range-day-dot" v-if="d.count > 0"></span>
                                </button>
                            </div>
                        </div>
                        <div class="summary-range-empty" v-if="daysByMonth.length === 0">
                            暂无聊天记录可选
                        </div>
                    </div>
                </div>

                <div class="summary-range-modal-footer">
                    <div class="summary-range-modal-hint">
                        <template v-if="isCalendar">已选 {{ selectedRangeText }} · 共 {{ messageCount }} 条消息</template>
                        <template v-else>将生成 {{ messageCount }} 条消息的故事概要</template>
                    </div>
                    <div class="summary-range-modal-actions">
                        <button class="summary-range-btn summary-range-btn-cancel" @click="onCancel">取消</button>
                        <button class="summary-range-btn summary-range-btn-confirm"
                            :disabled="!canConfirm"
                            :class="{ 'is-disabled': !canConfirm }"
                            @click="onConfirm">
                            生成概要
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
};

export default SummaryRangeModal;
export { SummaryRangeModal };