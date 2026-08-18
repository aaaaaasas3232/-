/**
 * chat-app / 弹窗组件库
 *
 * 所有弹窗都封装成 Vue 组件配置，由 chat-modal-manager 统一管理。
 * 与 framework 的 island-components.js 风格一致。
 *
 * 组件列表：
 *   - location-card    地点卡片弹窗
 *   - desc-image       图片描述弹窗
 *   - desc-image-send  发送图片弹窗
 *   - voice-record      语音录制弹窗
 *   - mode-selector    模式选择弹窗（添加新朋友时）
 *   - ai-remark        AI 备注编辑弹窗
 *   - chat-background  聊天背景选择弹窗
 *   - forward-target   转发目标选择弹窗
 *   - chat-record-detail  聊天记录详情弹窗 (v0.33)
 */

// ============================================
// 语音录制弹窗 (韩风精致版)
// ============================================

import { AcModal } from './ac-modal.js';
import { DEFAULT_AI_AVATAR_BG } from '../aiMeta.js';
// Prompt 变量清单（插入菜单 + 未知变量提示）
import { listPromptVariablesByGroup, inspectPromptVariables } from '@/src/core/prompt-variables.js';

const VoiceRecordModal = {
    name: 'VoiceRecordModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '语音消息' },
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            inputValue: '',
            duration: 5,
            waveBars: this._generateWaveBars(20),
        };
    },
    computed: {
        durationText() {
            return this.duration + 's';
        },
    },
    methods: {
        _generateWaveBars(count) {
            const bars = [];
            for (let i = 0; i < count; i++) {
                bars.push(4 + Math.random() * 16);
            }
            return bars;
        },
        onDurationChange(e) {
            this.duration = parseInt(e.target.value);
        },
        onInputChange(e) {
            const len = e.target.value.length;
            this.duration = Math.max(1, Math.min(60, Math.ceil(len / 5)));
        },
        onConfirm() {
            if (!this.inputValue.trim()) {
                window.__phoneIsland?.notify?.('warning', '请输入语音内容', '描述你想发送的语音内容');
                return;
            }
            this.$emit('confirm', {
                content: this.inputValue.trim(),
                duration: this.duration,
            });
        },
    },
    template: `
        <AcModal
            class="voice-record-modal"
            :title="title"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'340px'"
            @close="$emit('close')"
        >
            <div class="voice-record-input-group">
                <textarea
                    class="voice-record-textarea"
                    placeholder="输入想说的内容..."
                    rows="3"
                    v-model="inputValue"
                    @input="onInputChange"
                ></textarea>
            </div>

            <div class="voice-record-wave">
                <div
                    v-for="(height, index) in waveBars"
                    :key="index"
                    class="voice-bar"
                    :style="{ height: height + 'px' }"
                ></div>
            </div>

            <div class="voice-record-action">
                <div class="voice-record-duration-row">
                    <input
                        type="range"
                        class="voice-record-slider"
                        min="1"
                        max="60"
                        v-model.number="duration"
                        @input="onDurationChange"
                    />
                    <span class="voice-record-duration-display">{{ durationText }}</span>
                </div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onConfirm">发送</button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 地点卡片弹窗
// ============================================
const LocationCardModal = {
    name: 'LocationCardModal',
    components: { AcModal },
    props: {
        name: { type: String, default: '位置' },
        address: { type: String, default: '' },
        bgGradient: { type: String, default: 'linear-gradient(135deg, #E8F2FF, #D6E4FF)' },
        iconColor: { type: String, default: '#4A6FA5' },
        borderColor: { type: String, default: '#4A6FA5' },
        favorited: { type: Boolean, default: false },
    },
    emits: ['close', 'favorite', 'share'],
    template: `
        <AcModal
            class="location-card-detail-modal"
            title="位置"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'320px'"
            @close="$emit('close')"
        >
            <div class="location-card-modal-card"
                 :style="{ background: bgGradient, borderColor: borderColor }">
                <div class="location-card-modal-card-img" :style="{ color: iconColor }">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.6;">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <div class="location-card-modal-card-label">位置</div>
                </div>
            </div>
            <div class="location-card-modal-content">
                <div class="location-card-modal-name" :style="{ color: iconColor }">{{ name }}</div>
                <div v-if="address" class="location-card-modal-address">{{ address }}</div>
            </div>
            <template #footer>
                <button type="button" class="card-detail-icon-btn" :class="{ 'is-on': favorited }" aria-label="收藏" @click="$emit('favorite')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
                <button type="button" class="card-detail-icon-btn" aria-label="分享" @click="$emit('share')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 地点选择弹窗 (发送位置) — v0.68 迁移到 AcModal
//   - 从世界观场所列表中选择地点
//   - 选择后发送 location 类型消息到聊天
//   - 原生底部抽屉风格 → 粉蓝云朵 AcModal 风格
// ============================================
const LocationPickerModal = {
    name: 'LocationPickerModal',
    components: { AcModal },
    emits: ['close', 'select'],
    data() {
        return {
            locations: [],        // 场所列表
            loading: true,
            selectedId: null,     // 选中的场所 id
            searchQuery: '',      // 搜索关键词
            worldName: '',        // 世界名称
        };
    },
    computed: {
        // 根据搜索过滤列表
        filteredLocations() {
            if (!this.searchQuery.trim()) return this.locations;
            const q = this.searchQuery.toLowerCase();
            return this.locations.filter(loc =>
                (loc.name || '').toLowerCase().includes(q) ||
                (loc.summary || '').toLowerCase().includes(q) ||
                (loc.placeName || '').toLowerCase().includes(q)
            );
        },
        // 副标题:世界名(空时不显示) — 不带 emoji
        modalSubtitle() {
            return this.worldName || '';
        },
        // 当前选中的地点对象(供 confirmSend 使用)
        selectedLocation() {
            if (!this.selectedId) return null;
            return this.locations.find((loc) => loc.id === this.selectedId) || null;
        },
    },
    async mounted() {
        await this.loadLocations();
    },
    methods: {
        async loadLocations() {
            this.loading = true;
            try {
                const sdk = window.settingsSdk;
                if (sdk) {
                    // 获取当前用户绑定的世界
                    const user = sdk.users?.getActive?.() || sdk.defaultUserCard?.getDefault?.();
                    const worldId = user?.boundWorldId || '';

                    if (worldId && sdk.locations) {
                        // 获取该世界的所有场所
                        const worldLocations = sdk.locations.list({ worldRef: worldId });
                        // 同时获取场所关联的地点名称(placeName)
                        const places = sdk.places ? sdk.places.list({ worldRef: worldId }) : [];
                        const placeNameMap = {};
                        places.forEach(p => { placeNameMap[p.id] = p.name; });

                        this.locations = worldLocations.map(loc => ({
                            ...loc,
                            placeName: placeNameMap[loc.placeRef] || '',
                        }));
                        this.worldName = sdk.worlds?.get?.(worldId)?.name || '当前世界';
                    } else {
                        this.locations = [];
                    }
                }
            } catch (err) {
                console.warn('[LocationPicker] load failed:', err);
                this.locations = [];
            }
            this.loading = false;
        },
        // 只标记选中,不立即关闭
        selectLocation(loc) {
            this.selectedId = loc.id;
        },
        // 点「发送」按钮才真正发出 select 事件
        confirmSend() {
            const loc = this.selectedLocation;
            if (!loc) {
                window.__phoneIsland?.notify?.('warning', '请先选择地点', '从列表里点一个地点再发送');
                return;
            }
            this.$emit('select', {
                id: loc.id,
                name: loc.name || '未知地点',
                address: loc.placeName ? `${loc.placeName} · ${loc.name}` : loc.name,
                position: loc.position,
            });
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="location-picker-modal"
            title="发送位置"
            :subtitle="modalSubtitle"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <!-- 搜索框 -->
            <div class="location-picker-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="搜索地点..."
                    class="location-picker-search-input"
                />
            </div>
            <!-- 加载状态 -->
            <div v-if="loading" class="location-picker-loading">
                <div class="location-picker-spinner"></div>
                <span>加载中...</span>
            </div>
            <!-- 空状态 -->
            <div v-else-if="filteredLocations.length === 0" class="location-picker-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#D1D5DB">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <span>{{ searchQuery ? '未找到匹配的地点' : '该世界暂无地点' }}</span>
            </div>
            <!-- 地点列表 -->
            <div v-else class="location-picker-list">
                <button
                    v-for="loc in filteredLocations"
                    :key="loc.id"
                    type="button"
                    class="location-picker-item"
                    :class="{ 'location-picker-item--selected': selectedId === loc.id }"
                    @click.stop="selectLocation(loc)"
                >
                    <div class="location-picker-item-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                    </div>
                    <div class="location-picker-item-content">
                        <div class="location-picker-item-name">{{ loc.name }}</div>
                        <div class="location-picker-item-meta" v-if="loc.placeName || loc.summary">
                            {{ loc.placeName || loc.summary }}
                        </div>
                    </div>
                    <div class="location-picker-item-check" v-if="selectedId === loc.id">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    </div>
                </button>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!selectedId" @click="confirmSend">发送</button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 图片描述弹窗
// ============================================
const DescImageModal = {
    name: 'DescImageModal',
    components: { AcModal },
    props: {
        description: { type: String, default: '' },
        cardColor: { type: String, default: '#FFE4EC' },
        textColor: { type: String, default: '#D4728A' },
        borderColor: { type: String, default: '#C0607A' },
        favorited: { type: Boolean, default: false },
    },
    emits: ['close', 'favorite', 'share'],
    template: `
        <AcModal
            class="desc-image-detail-modal"
            title="图片"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'320px'"
            @close="$emit('close')"
        >
            <div class="desc-image-modal-card"
                 :style="{ background: cardColor, borderColor: borderColor }">
                <div class="desc-image-modal-card-img" :style="{ color: textColor }">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.6;">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    <div class="desc-image-modal-card-label">文字描述图片</div>
                </div>
            </div>
            <div class="desc-image-modal-content">
                <div class="desc-image-modal-desc">{{ description }}</div>
            </div>
            <template #footer>
                <button type="button" class="card-detail-icon-btn" :class="{ 'is-on': favorited }" aria-label="收藏" @click="$emit('favorite')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
                <button type="button" class="card-detail-icon-btn" aria-label="分享" @click="$emit('share')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 发送图片弹窗 (AC 风通用弹窗包裹)
//   - ★ v0.69 视觉升级:用通用 AcModal (粉蓝云朵) 替换旧版矩形弹窗
//   - props/emits/data/methods/onConfirm 行为完全不变,只是套了层新外壳
//   - 旧的 .desc-image-send-* 类名保留,保证如果有别处直接调用不破坏样式
// ============================================

const DescImageSendModal = {
    name: 'DescImageSendModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '发送模拟图片' },
        hint: { type: String, default: '写一个日常生活里看得见的瞬间，不要写成立绘' },
        placeholder: { type: String, default: '例如：窗台上的一杯温水，傍晚的光刚退...' },
        colors: {
            type: Array,
            default: () => [
                { name: '粉', cardColor: '#FFE4EC', textColor: '#D4728A', shadowColor: 'rgba(212, 114, 138, 0.45)' },
                { name: '蓝', cardColor: '#E8F2FF', textColor: '#4A6FA5', shadowColor: 'rgba(74, 111, 165, 0.4)' },
                { name: '绿', cardColor: '#E8F8F0', textColor: '#4CAF50', shadowColor: 'rgba(76, 175, 80, 0.4)' },
                { name: '紫', cardColor: '#F3E8FF', textColor: '#8B5CF6', shadowColor: 'rgba(139, 92, 246, 0.45)' },
                { name: '黄', cardColor: '#FFF8E1', textColor: '#FF9800', shadowColor: 'rgba(255, 152, 0, 0.4)' },
            ]
        },
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            inputValue: '',
            selectedColorIndex: 0,
        };
    },
    computed: {
        selectedColor() {
            return this.colors[this.selectedColorIndex] || this.colors[0];
        },
    },
    template: `
        <AcModal
            class="desc-image-send-modal"
            :title="title"
            :subtitle="hint"
            :show-close="true"
            :close-on-backdrop="true"
            @close="$emit('close')"
        >
            <div class="desc-image-send-body">
                <textarea
                    class="desc-image-send-textarea"
                    :placeholder="placeholder"
                    rows="3"
                    v-model="inputValue"
                ></textarea>
                <div class="desc-image-send-colors">
                    <div class="desc-image-send-colors-grid">
                        <button
                            v-for="(color, index) in colors"
                            :key="index"
                            type="button"
                            class="desc-image-send-color-btn"
                            :class="{ active: index === selectedColorIndex }"
                            :style="{ background: color.cardColor, color: color.textColor, '--color-btn-shadow': color.shadowColor }"
                            :title="color.name"
                            @click="selectedColorIndex = index"
                        >
                            <span class="desc-image-send-color-name">{{ color.name }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onConfirm">发送</button>
            </template>
        </AcModal>
    `,
    methods: {
        onConfirm() {
            if (!this.inputValue.trim()) {
                window.__phoneIsland?.notify?.('warning', '请输入图片描述', '描述你想发送的图片内容');
                return;
            }
            this.$emit('confirm', {
                description: this.inputValue.trim(),
                cardColor: this.selectedColor.cardColor,
                textColor: this.selectedColor.textColor,
            });
        },
    },
};

// ============================================
// 聊天记录模式选择弹窗
//   - 添加新朋友 → 选 mode → 创建 chatContacts
//   - 两个大卡片（日历 / 故事） + 描述 + chips
//   - 复用 framework chat-component 弹窗层
// ============================================
const ModeSelectorModal = {
    name: 'ModeSelectorModal',
    props: {
        name: { type: String, default: '' },
        // ★ v0.28:当前 pending mode 的已添加状态（让对应按钮变灰）
        addedInMode: { type: Boolean, default: false },
    },
    emits: ['close', 'select'],
    computed: {
        otherModeAdded() {
            // 另一个 mode 是否已添加（通过 props.addedInMode 推算：
            // addedInMode=true → 当前 mode 已加，异 mode 未加；addedInMode=false → 当前 mode 未加）
            return false; // 目前只传 addedInMode(当前 mode)，异 mode 不需要变灰
        },
    },
    template: `
        <div class="mode-selector-modal-overlay" @click.self="$emit('close')">
            <div class="mode-selector-modal">
                <div class="mode-selector-modal-header">
                    <div class="mode-selector-modal-title">选择聊天记录模式</div>
                    <div v-if="name" class="mode-selector-modal-subtitle">为「{{ name }}」选择</div>
                </div>
                <div class="mode-selector-modal-list">
                    <button
                        class="chat-mode-selector-card chat-mode-selector-card--calendar"
                        :class="{ 'chat-mode-selector-card--disabled': addedInMode }"
                        @click.stop="addedInMode ? null : ($emit('select', 'calendar'), $emit('close'))"
                    >
                        <div class="chat-mode-selector-card__icon chat-mode-selector-card__icon--calendar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                        </div>
                        <div class="chat-mode-selector-card__title">
                            日历视图模式
                            <span v-if="addedInMode" class="chat-mode-selector-card__badge">已添加</span>
                        </div>
                        <div class="chat-mode-selector-card__desc">
                            正常使用模式。聊天记录按日期归档,可被社媒 App 真实调用。
                        </div>
                    </button>
                    <button class="chat-mode-selector-card chat-mode-selector-card--story" @click.stop="$emit('select', 'story'); $emit('close')">
                        <div class="chat-mode-selector-card__icon chat-mode-selector-card__icon--story">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            </svg>
                        </div>
                        <div class="chat-mode-selector-card__title">故事记录模式</div>
                        <div class="chat-mode-selector-card__desc">
                            暂时性情景扮演 / 游戏模式。消息列表背景变为粉色,与日历模式独立副本。
                        </div>
                    </button>
                </div>
                <button class="mode-selector-modal-cancel" @click="$emit('close')">取消</button>
            </div>
        </div>
    `,
};

// ============================================
// AI 备注弹窗 (v0.69+ AcModal)
//   - 点击私聊页顶栏更多按钮 → 弹出备注编辑弹窗
//   - 每个 AI 可以分别给日历模式和故事模式设置不同备注
//   - 禁用 emoji 输入，只接受纯文本
// ============================================
const AiRemarkModal = {
    name: 'AiRemarkModal',
    components: { AcModal },
    props: {
        // 当前联系人名称（显示用）
        name: { type: String, default: '' },
        // 当前联系人头像背景色
        avatarBg: { type: String, default: DEFAULT_AI_AVATAR_BG },
        // 当前备注内容（空则显示 placeholder）
        remark: { type: String, default: '' },
        // 当前模式（calendar / story），用于显示不同的标签
        mode: { type: String, default: 'calendar' },
    },
    emits: ['close', 'save'],
    data() {
        return {
            inputValue: this.remark || '',
            maxLength: 200,
            isSaving: false,
        };
    },
    computed: {
        modalHint() {
            return '日历模式和故事模式可以设置不同的备注';
        },
        modalPlaceholder() {
            return '添加备注信息,如称呼、特征、相处方式等...';
        },
        modeLabel() {
            return this.mode === 'story' ? '故事模式' : '日历模式';
        },
        charCount() {
            return this.inputValue.length;
        },
        charCountClass() {
            return this.charCount > this.maxLength * 0.9 ? 'warning' : '';
        },
    },
    watch: {
        // 禁止 emoji 输入
        inputValue(newVal) {
            // 移除 emoji 字符（保留中文、英文、数字、常用标点）
            const clean = newVal.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');
            if (clean !== newVal) {
                this.inputValue = clean;
            }
        },
    },
    methods: {
        onSave() {
            if (this.charCount > this.maxLength) {
                window.__phoneIsland?.notify?.('warning', '内容过长', `最多 ${this.maxLength} 个字符`);
                return;
            }
            this.isSaving = true;
            this.$emit('save', this.inputValue.trim());
            // 延迟关闭，让保存操作完成
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 300);
        },
    },
    template: `
        <AcModal
            class="ai-remark-modal"
            :show-header="false"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <!-- ★ v0.70 标题 + 联系人条 整体由我们自己渲染,
                 避免被 AcModal 的 header slot 替换机制吃掉默认 title -->
            <div class="ai-remark-header">
                <h2 class="ac-modal-title">设置备注</h2>
                <div class="ai-remark-contact" v-if="name">
                    <div class="ai-remark-avatar" :style="{ background: avatarBg }">
                        {{ name.charAt(0) }}
                    </div>
                    <div class="ai-remark-contact-info">
                        <div class="ai-remark-contact-name">{{ name }}</div>
                    </div>
                    <!-- ★ v0.70 去掉 inline style,改用 .ac-btn-primary 同色系样式,
                         风格跟底部保存按钮统一 -->
                    <div
                        class="ai-remark-mode-tag"
                        v-if="modeLabel"
                    >
                        {{ modeLabel }}专属
                    </div>
                </div>
            </div>

            <!-- 备注输入区 -->
            <div class="ai-remark-input-group">
                <textarea
                    class="ai-remark-textarea"
                    v-model="inputValue"
                    :maxlength="maxLength"
                    :placeholder="modalPlaceholder"
                    rows="4"
                ></textarea>
                <div class="ai-remark-char-count" :class="charCountClass">
                    {{ charCount }} / {{ maxLength }}
                </div>
            </div>

            <!-- 提示文字 -->
            <div class="ai-remark-hint" v-if="modalHint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>{{ modalHint }}</span>
            </div>

            <!-- 底部按钮 -->
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button
                    type="button"
                    class="ac-btn ac-btn-primary ai-remark-save-btn"
                    :class="{ saving: isSaving }"
                    @click="onSave"
                    :disabled="isSaving"
                >
                    <span v-if="!isSaving">保存</span>
                    <span v-else>保存中...</span>
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 聊天背景选择弹窗（v0.29.1 - 极简版，只支持上传图片 · v0.69+ AcModal）
//   - 进入聊天设置页 → 「聊天背景」 → 弹出此弹窗
//   - 不提供纯色/渐变预设，只支持上传本地图片
//   - input[type=file] 选图片，转 dataURL，点保存写盘
//   - 顶部：「当前背景」预览区（已有图就 <img>，没图就 empty 占位）
//   - 中间：「选择图片」/「更换图片」按钮
//   - 底部：恢复默认 / 取消 / 保存 三个按钮
// ============================================
const ChatBackgroundModal = {
    name: 'ChatBackgroundModal',
    components: { AcModal },
    props: {
        // 当前背景值（带前缀或空字符串）
        currentValue: { type: String, default: '' },
    },
    emits: ['close', 'save'],
    data() {
        // 只关心 image 前缀，其他类型 / 旧值都忽略（界面只让选图）
        let activeImage = '';
        if (this.currentValue) {
            if (this.currentValue.startsWith('image:')) {
                activeImage = this.currentValue.slice('image:'.length);
            } else if (!this.currentValue.startsWith('color:') && !this.currentValue.startsWith('gradient:')) {
                // 兼容旧版无前缀 = 当 image 处理
                activeImage = this.currentValue;
            }
        }
        return {
            activeImage,
            isSaving: false,
            uploadError: '',
        };
    },
    computed: {
        hasCurrentImage() {
            return !!this.activeImage;
        },
    },
    methods: {
        clearBackground() {
            // 仅清掉当前选中的预览（保存按钮才会真正写入）
            this.activeImage = '';
            this.uploadError = '';
        },
        resetBackground() {
            // 底部「恢复默认」按钮：直接把空字符串保存进去
            this.activeImage = '';
            this.$emit('save', '');
        },
        onFileChange(e) {
            this.uploadError = '';
            const file = e?.target?.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                this.uploadError = '请选择图片文件';
                return;
            }
            // 限制大小 2MB（dataURL 太大会让 IndexedDB 写入失败）
            if (file.size > 2 * 1024 * 1024) {
                this.uploadError = '图片不能超过 2MB';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                this.activeImage = String(reader.result || '');
            };
            reader.onerror = () => {
                this.uploadError = '读取文件失败';
            };
            reader.readAsDataURL(file);
            // 让选同一张图也能再次触发 change
            if (e?.target) e.target.value = '';
        },
        onSave() {
            if (this.isSaving) return;
            this.isSaving = true;
            const value = this.activeImage ? `image:${this.activeImage}` : '';
            this.$emit('save', value);
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 300);
        },
    },
    template: `
        <AcModal
            class="chat-bg-modal"
            title="设置聊天背景"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <!-- 主体内容 -->
            <div class="chat-bg-body">
                <label class="chat-bg-pick-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>{{ hasCurrentImage ? '更换图片' : '选择图片' }}</span>
                    <input type="file" accept="image/*" @change="onFileChange" hidden />
                </label>

                <div v-if="hasCurrentImage" class="chat-bg-current">
                    <div class="chat-bg-current-img" :style="{ backgroundImage: 'url(' + activeImage + ')' }">
                        <button class="chat-bg-current-clear" type="button" @click.stop="clearBackground" aria-label="清除">×</button>
                    </div>
                </div>

                <div v-else class="chat-bg-current-empty">
                    <div class="chat-bg-current-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>暂无自定义背景</span>
                    </div>
                </div>

                <div v-if="uploadError" class="chat-bg-upload-error">{{ uploadError }}</div>
            </div>

            <!-- 底部按钮(恢复默认 + 取消 + 保存) -->
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary chat-bg-btn-clear" @click="resetBackground" :disabled="!hasCurrentImage">
                    恢复默认
                </button>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button
                    type="button"
                    class="ac-btn ac-btn-primary chat-bg-save-btn"
                    :class="{ saving: isSaving }"
                    @click="onSave"
                    :disabled="isSaving"
                >
                    <span v-if="!isSaving">保存</span>
                    <span v-else>保存中...</span>
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 转发选目标弹窗（v0.33）
// ============================================
/**
 * 转发选目标弹窗
 *
 * props:
 *   mode          'calendar' | 'story'            当前消息的模式(决定可选目标)
 *   privateChats  Array<{ id, name, avatar, avatarBg, subtitle? }>   可转发的私聊目标
 *   groupChats    Array<{ id, name, members, avatar }>                可转发的群聊目标
 *
 * emits:
 *   close                                         关闭弹窗
 *   select(target)                                选择目标,target = { type: 'private'|'group', id }
 */
const ForwardTargetModal = {
    name: 'ForwardTargetModal',
    components: { AcModal },
    props: {
        mode: { type: String, default: 'calendar' },
        privateChats: { type: Array, default: () => [] },
        groupChats: { type: Array, default: () => [] },
        privateLabel: { type: String, default: '私聊' },
        groupLabel: { type: String, default: '群聊' },
        modeLabel: { type: String, default: '当前模式' },
    },
    emits: ['close', 'select'],
    data() {
        return {
            // ★ 两步式交互:选中的目标 { type: 'private'|'group', id, target }
            //  - 点击列表项 → 写入 selected
            //  - 点击底部「发送」→ emit('select', selected) → 关闭(由调用方关)
            //  - 点击底部「取消」 → emit('close')(已选中也不发)
            selected: null,
        };
    },
    computed: {
        modeBadgeText() {
            return this.mode === 'story' ? '故事模式' : '日历模式';
        },
        hasAnyTarget() {
            return this.privateChats.length > 0 || this.groupChats.length > 0;
        },
        subtitleText() {
            return `仅显示${this.modeBadgeText}下的会话`;
        },
        canSend() {
            return !!(this.selected && (this.selected.id || this.selected.target?.id));
        },
    },
    methods: {
        pickPrivate(target) {
            // ★ 选中(高亮),但不立即转发 —— 走两步式
            this.selected = { type: 'private', id: target.id, target };
        },
        pickGroup(target) {
            this.selected = { type: 'group', id: target.id, target };
        },
        onAvatarText(name = '') {
            return name ? String(name).charAt(0) : '?';
        },
        onCancel() {
            this.$emit('close');
        },
        onSend() {
            if (!this.canSend) return;
            this.$emit('select', this.selected);
        },
        isSelected(type, id) {
            return this.selected && this.selected.type === type && String(this.selected.id) === String(id);
        },
    },
    template: `
        <AcModal
            class="forward-target-modal"
            title="选择转发目标"
            :subtitle="subtitleText"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <!-- 私聊列表 -->
            <div v-if="privateChats.length > 0" class="forward-target-section">
                <div class="forward-target-section-title">{{ privateLabel }} · {{ privateChats.length }}</div>
                <div class="forward-target-list">
                    <div
                        v-for="t in privateChats"
                        :key="t.id"
                        class="forward-target-item"
                        :class="{ 'forward-target-item--selected': isSelected('private', t.id) }"
                        @click="pickPrivate(t)"
                    >
                        <div class="forward-target-avatar" :style="{ background: t.avatarBg || DEFAULT_AI_AVATAR_BG }">
                            <img v-if="t.avatar" :src="t.avatar" alt="" class="forward-target-avatar-img" />
                            <span v-else>{{ onAvatarText(t.name) }}</span>
                        </div>
                        <div class="forward-target-meta">
                            <div class="forward-target-name">{{ t.name || t.id }}</div>
                            <div v-if="t.subtitle" class="forward-target-subtitle">{{ t.subtitle }}</div>
                        </div>
                        <div v-if="isSelected('private', t.id)" class="forward-target-checkmark">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#5b8ec9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 群聊列表 -->
            <div v-if="groupChats.length > 0" class="forward-target-section">
                <div class="forward-target-section-title">{{ groupLabel }} · {{ groupChats.length }}</div>
                <div class="forward-target-list">
                    <div
                        v-for="t in groupChats"
                        :key="t.id"
                        class="forward-target-item"
                        :class="{ 'forward-target-item--selected': isSelected('group', t.id) }"
                        @click="pickGroup(t)"
                    >
                        <div class="forward-target-avatar forward-target-avatar-group" :style="{ background: t.avatar || 'linear-gradient(135deg,#A8C8EC,#F4A6CD)' }">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                        </div>
                        <div class="forward-target-meta">
                            <div class="forward-target-name">{{ t.name || t.id }}</div>
                            <div class="forward-target-subtitle">{{ (t.members || []).length }} 位成员</div>
                        </div>
                        <div v-if="isSelected('group', t.id)" class="forward-target-checkmark">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#5b8ec9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="!hasAnyTarget" class="forward-target-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#9CA3AF" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                <div class="forward-target-empty-title">暂无可转发的会话</div>
                <div class="forward-target-empty-hint">请先去「消息」或「通讯录」添加{{ modeBadgeText }}下的好友 / 群聊</div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button
                    type="button"
                    class="ac-btn ac-btn-primary"
                    :disabled="!canSend"
                    @click="onSend"
                >
                    发送
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 聊天记录详情弹窗 (v0.33)
//   - 用户点击 chat-record-card 时打开
//   - 单条:以单条详情样式呈现
//   - 多条:列出全部消息(不只是 preview 的 3 条)
//   - 1:1 复原 chat.js 的 openChatRecordModal() 行为
//
//   ★ 注意:framework chat-component 通道只透传 7 个标准 event
//     (close/save/select/navigate/share/favorite/confirm),
//     所以 onForward 用 prop 传进来,不 emit 事件
// ============================================
const ChatRecordDetailModal = {
    name: 'ChatRecordDetailModal',
    props: {
        title: { type: String, default: '聊天记录' },
        messages: { type: Array, default: () => [] },
        sourceLabel: { type: String, default: '' },
        contactName: { type: String, default: '' }, // ★ v0.85 新增:用于显示 AI 发送者名字
    },
    emits: ['close'],
    computed: {
        isEmpty() {
            return !Array.isArray(this.messages) || this.messages.length === 0;
        },
        countText() {
            const n = this.messages.length;
            return `共 ${n} 条消息`;
        },
    },
    methods: {
        senderNameOf(m) {
            if (m.sender === 'user') return '我';
            // ★ v0.85 修复:如果是 AI 消息但 senderName 是 'AI' 或空,
            //   尝试从 contactName prop 拿真实名字
            if (m.sender === 'ai' || m.sender === 'AI') {
                const storedName = m.senderName;
                if (storedName && storedName !== 'AI' && storedName.trim()) {
                    return storedName;
                }
                if (this.contactName) {
                    return this.contactName;
                }
                return storedName || 'AI';
            }
            return m.senderName || m.sender || '?';
        },
        contentOf(m) {
            if (m.type === 'image' || m.imageUrl || m.imageDescription) return '[图片]';
            if (m.type === 'sticker' || m.stickerUrl) return '[表情]';
            if (m.type === 'voice') return '[语音]';
            if (m.type === 'location' || m.locationCard) return '[位置]';
            if (m.type === 'redpacket' || m.redpacketCard) return '[红包]';
            if (m.type === 'transfer' || m.transferCard) return '[转账]';
            if (m.type === 'chat_record' || m.chatRecord) return '[聊天记录]';
            return m.content || '';
        },
        formatTime(ts) {
            if (!ts) return '';
            const d = new Date(ts);
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        },
    },
    template: `
        <div class="chat-record-detail-overlay" @click.self="$emit('close')">
            <div class="chat-record-detail-modal">
                <div class="chat-record-detail-modal-header">
                    <span class="chat-record-detail-modal-title">{{ title }}<span v-if="sourceLabel"> 来自 {{ sourceLabel }}</span></span>
                    <button class="chat-record-detail-modal-close" id="close-record-modal" aria-label="关闭" @click="$emit('close')">&times;</button>
                </div>

                <div class="chat-record-detail-modal-body">
                    <div v-if="isEmpty" class="chat-record-detail-modal-empty">
                        <div class="chat-record-detail-modal-empty-title">暂无消息</div>
                        <div class="chat-record-detail-modal-empty-hint">该聊天记录为空</div>
                    </div>
                    <div v-else class="chat-record-detail-modal-list">
                        <div
                            v-for="(m, idx) in messages"
                            :key="m.id || idx"
                            class="chat-record-detail-bubble"
                            :class="m.sender === 'user' ? 'from-user' : 'from-ai'"
                        >
                            <div class="chat-record-detail-bubble-sender">{{ senderNameOf(m) }}</div>
                            <div class="chat-record-detail-bubble-content">{{ contentOf(m) }}</div>
                            <div class="chat-record-detail-bubble-time">{{ formatTime(m.timestamp) }}</div>
                        </div>
                    </div>
                </div>

                <div class="chat-record-detail-modal-footer">
                    <div class="chat-record-detail-modal-footer-text">{{ countText }}</div>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 故事存档系列弹窗（v0.42）
//   - StoryArchiveSaveModal       封存：让用户填标题+简介，确认封存后清空当前故事聊天
//   - StoryArchiveRestoreConfirmModal  恢复：当前故事聊天有数据时弹覆盖确认
//   - StoryArchiveDeleteConfirmModal  删除：单条存档确认删除
// ============================================

/**
 * 封存弹窗：让用户填标题 + 简介,确认后写存档 + 清空当前故事会话
 *
 * props:
 *   contactName     string  联系人/AI 名称(显示用)
 *   messageCount    number  当前消息条数
 *   suggestedName   string  默认标题(基于时间生成)
 *
 * emits:
 *   close
 *   confirm({ name, description })
 */
const StoryArchiveSaveModal = {
    name: 'StoryArchiveSaveModal',
    props: {
        contactName: { type: String, default: '' },
        messageCount: { type: Number, default: 0 },
        suggestedName: { type: String, default: '' },
    },
    emits: ['close', 'confirm'],
    data() {
        const initialName = (this.suggestedName || '').trim();
        return {
            name: initialName,
            description: '',
            maxNameLength: 50,
            maxDescLength: 200,
            isSaving: false,
        };
    },
    computed: {
        charCountName() { return this.name.length; },
        charCountDesc() { return this.description.length; },
        nameWarning() { return this.charCountName > this.maxNameLength * 0.9 ? 'warning' : ''; },
        descWarning() { return this.charCountDesc > this.maxDescLength * 0.9 ? 'warning' : ''; },
        canSubmit() {
            return this.name.trim().length > 0
                && this.charCountName <= this.maxNameLength
                && this.charCountDesc <= this.maxDescLength;
        },
        messageCountText() {
            const n = this.messageCount || 0;
            return `当前共有 ${n} 条消息`;
        },
    },
    methods: {
        onSubmit() {
            if (!this.canSubmit) {
                window.__phoneIsland?.notify?.('warning', '请输入封存标题');
                return;
            }
            this.isSaving = true;
            this.$emit('confirm', {
                name: this.name.trim(),
                description: this.description.trim(),
            });
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="archive-save-modal-overlay" @click.self="onCancel">
            <div class="archive-save-modal">
                <div class="archive-save-header">
                    <div class="archive-save-title">封存当前聊天记录</div>
                    <button class="archive-save-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="archive-save-body">
                    <div class="archive-save-hint">
                        <span class="archive-save-hint-name">{{ contactName || '当前 AI' }}</span>
                        <span class="archive-save-hint-count">{{ messageCountText }}</span>
                    </div>
                    <div class="archive-save-hint-desc">封存后当前故事聊天将被清空,你可以随时回来查看或恢复这条存档。</div>

                    <div class="archive-save-field">
                        <label class="archive-save-label">封存标题 <span class="archive-save-required">*</span></label>
                        <input
                            type="text"
                            class="archive-save-input"
                            v-model="name"
                            :maxlength="maxNameLength"
                            placeholder="为这次故事起个名字,例如：夏日海边度假"
                        />
                        <div class="archive-save-count" :class="nameWarning">
                            {{ charCountName }} / {{ maxNameLength }}
                        </div>
                    </div>

                    <div class="archive-save-field">
                        <label class="archive-save-label">封存简介</label>
                        <textarea
                            class="archive-save-textarea"
                            v-model="description"
                            :maxlength="maxDescLength"
                            rows="3"
                            placeholder="简单记录这次故事的内容,方便以后回忆..."
                        ></textarea>
                        <div class="archive-save-count" :class="descWarning">
                            {{ charCountDesc }} / {{ maxDescLength }}
                        </div>
                    </div>
                </div>

                <div class="archive-save-actions">
                    <button class="archive-save-btn archive-save-btn-cancel" @click="onCancel">取消</button>
                    <button
                        class="archive-save-btn archive-save-btn-confirm"
                        :class="{ saving: isSaving, disabled: !canSubmit }"
                        :disabled="isSaving || !canSubmit"
                        @click="onSubmit"
                    >
                        <span v-if="!isSaving">封存</span>
                        <span v-else>封存中...</span>
                    </button>
                </div>
            </div>
        </div>
    `,
};

/**
 * 恢复存档覆盖确认弹窗
 * - 当前故事会话有未封存的数据时,弹「恢复会覆盖当前记录」二次确认
 * - 用户点 "继续恢复" → emit confirm()
 * - 用户点 "取消" → emit close()
 *
 * props:
 *   archiveName     string  即将恢复的存档名称
 *   currentCount    number  当前故事会话的消息条数
 *
 * emits:
 *   close
 *   confirm()
 */
const StoryArchiveRestoreConfirmModal = {
    name: 'StoryArchiveRestoreConfirmModal',
    props: {
        archiveName: { type: String, default: '' },
        currentCount: { type: Number, default: 0 },
    },
    emits: ['close', 'confirm'],
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="archive-confirm-modal-overlay" @click.self="onCancel">
            <div class="archive-confirm-modal archive-confirm-modal--warning">
                <div class="archive-confirm-icon">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                <div class="archive-confirm-title">恢复存档会覆盖当前聊天</div>
                <div class="archive-confirm-text">
                    <div v-if="currentCount > 0" class="archive-confirm-line">
                        当前故事模式还有 <b>{{ currentCount }}</b> 条未封存的消息,
                        恢复存档「<b>{{ archiveName }}</b>」后将被覆盖。
                    </div>
                    <div v-else class="archive-confirm-line">
                        将恢复存档「<b>{{ archiveName }}</b>」,当前故事模式会被替换。
                    </div>
                    <div class="archive-confirm-hint">
                        建议先「封存当前聊天记录」再恢复,避免误丢数据。
                    </div>
                </div>
                <div class="archive-confirm-actions">
                    <button class="archive-confirm-btn archive-confirm-btn-cancel" @click="onCancel">取消</button>
                    <button class="archive-confirm-btn archive-confirm-btn-danger" @click="onConfirm">继续恢复</button>
                </div>
            </div>
        </div>
    `,
};

/**
 * 消息编辑弹窗 (v0.43)
 *
 *   - 单条消息操作「编辑」时弹出此弹窗
 *   - 复用 ai-remark 的样式(.ai-remark-modal-overlay / .ai-remark-modal)
 *     因为风格统一,不必单独写 CSS(AI 备注弹窗已存在)
 *   - 只允许编辑文本类型(text / location / voice_call / video_call / call_record)的文字内容
 *     非文本类型(image / game / chat_record)直接 disable textarea + 提示「该消息不支持编辑」
 *
 * props:
 *   originalText   string  原文本
 *   senderLabel    string  发送者标签('我' / AI名)
 *   messageType    string  'text' | 'location' | 'voice_call' | 'video_call' | ...
 *   editable       boolean 是否允许编辑(非文本消息 = false)
 *
 * emits:
 *   close
 *   save(newText) 用户点保存时回调
 */
const MessageEditModal = {
    name: 'MessageEditModal',
    components: { AcModal },
    props: {
        originalText: { type: String, default: '' },
        senderLabel: { type: String, default: '' },
        messageType: { type: String, default: 'text' },
        editable: { type: Boolean, default: true },
    },
    emits: ['close', 'save'],
    data() {
        return {
            inputValue: this.originalText || '',
            maxLength: 2000,
            isSaving: false,
        };
    },
    computed: {
        charCount() {
            return this.inputValue.length;
        },
        charCountClass() {
            return this.charCount > this.maxLength * 0.9 ? 'warning' : '';
        },
        canSubmit() {
            if (!this.editable) return false;
            const v = this.inputValue.trim();
            return v.length > 0 && v !== (this.originalText || '').trim();
        },
        typeHint() {
            if (this.messageType === 'text') return '编辑文本消息';
            if (this.messageType === 'location') return '编辑地点文本';
            if (this.messageType === 'voice_call' || this.messageType === 'video_call' || this.messageType === 'call_record') return '编辑通话备注';
            return '该消息不支持编辑';
        },
        titleText() {
            return `编辑消息${this.senderLabel ? ` · ${this.senderLabel}` : ''}`;
        },
    },
    methods: {
        onSave() {
            if (!this.canSubmit) {
                if (!this.editable) {
                    window.__phoneIsland?.notify?.('warning', '该消息不支持编辑', '');
                    return;
                }
                if (!this.inputValue.trim()) {
                    window.__phoneIsland?.notify?.('warning', '内容不能为空', '');
                    return;
                }
                window.__phoneIsland?.notify?.('info', '内容未变化', '');
                return;
            }
            this.isSaving = true;
            this.$emit('save', this.inputValue.trim());
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 300);
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="ai-remark-modal"
            :title="titleText"
            :subtitle="typeHint"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <div class="ai-remark-input-group">
                <textarea
                    class="ai-remark-textarea"
                    v-model="inputValue"
                    :maxlength="maxLength"
                    :disabled="!editable"
                    placeholder="输入新内容..."
                    rows="5"
                ></textarea>
                <div class="ai-remark-char-count" :class="charCountClass">
                    {{ charCount }} / {{ maxLength }}
                </div>
            </div>

            <div class="ai-remark-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                </svg>
                <span>编辑后直接覆盖原内容,不留痕迹</span>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button
                    type="button"
                    class="ac-btn ac-btn-primary ai-remark-save-btn"
                    :class="{ saving: isSaving }"
                    :disabled="isSaving || !canSubmit"
                    @click="onSave"
                >
                    <span v-if="!isSaving">保存</span>
                    <span v-else>保存中...</span>
                </button>
            </template>
        </AcModal>
    `,
};

/**
 * 消息删除确认弹窗 (v0.44)
 *
 * 消息操作「删除」时弹出此确认弹窗
 * ★ v0.85 迁移到 AcModal(粉蓝云朵风格)
 *
 * props: 无需 props，确认即可
 *
 * emits:
 *   close
 *   confirm()
 */
const MessageDeleteConfirmModal = {
    name: 'MessageDeleteConfirmModal',
    components: { AcModal },
    emits: ['close', 'confirm'],
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="message-delete-confirm-modal"
            title="删除消息"
            subtitle="此操作不可撤销，消息删除后将无法恢复"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'300px'"
            @close="onCancel"
        >
            <div class="message-delete-confirm-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
            </div>
            <div class="message-delete-confirm-text">
                确定要删除这条消息吗？
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-danger" @click="onConfirm">删除</button>
            </template>
        </AcModal>
    `,
};

/**
 * 清空聊天记录确认弹窗 (v0.85)
 *
 * props:
 *   targetName     string  目标名称(AI名字或群名)
 *   targetType     string  'private' 或 'group'
 *
 * emits:
 *   close
 *   confirm()
 */
const ClearChatConfirmModal = {
    name: 'ClearChatConfirmModal',
    components: { AcModal },
    props: {
        targetName: { type: String, default: '' },
        targetType: { type: String, default: 'private' },
    },
    emits: ['close', 'confirm'],
    computed: {
        displayTitle() {
            return this.targetType === 'group' ? '清空群聊记录?' : '清空聊天记录?';
        },
        displayText() {
            return this.targetType === 'group'
                ? '此操作将删除该群聊的所有消息,不可恢复'
                : '此操作将删除该聊天的所有消息,不可恢复';
        },
    },
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="clear-chat-confirm-modal"
            :title="displayTitle"
            :subtitle="displayText"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'300px'"
            @close="onCancel"
        >
            <div class="clear-chat-confirm-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
            </div>
            <div class="clear-chat-confirm-target" v-if="targetName">
                <span class="clear-chat-confirm-label">目标:</span>
                <span class="clear-chat-confirm-name">{{ targetName }}</span>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-danger" @click="onConfirm">清空</button>
            </template>
        </AcModal>
    `,
};

/**
 * 退出群聊确认弹窗 (v0.85)
 *
 * props:
 *   groupName     string  群聊名称
 *
 * emits:
 *   close
 *   confirm()
 */
const ExitGroupConfirmModal = {
    name: 'ExitGroupConfirmModal',
    components: { AcModal },
    props: {
        groupName: { type: String, default: '' },
    },
    emits: ['close', 'confirm'],
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="exit-group-confirm-modal"
            title="退出群聊?"
            subtitle="退出后将不再接收该群聊的消息"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'300px'"
            @close="onCancel"
        >
            <div class="exit-group-confirm-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M15 9l-6 6"/>
                    <path d="M9 9l6 6"/>
                </svg>
            </div>
            <div class="exit-group-confirm-target" v-if="groupName">
                <span class="exit-group-confirm-label">群聊:</span>
                <span class="exit-group-confirm-name">{{ groupName }}</span>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-danger" @click="onConfirm">退出</button>
            </template>
        </AcModal>
    `,
};

/**
 * 取消收藏确认弹窗 (v0.85)
 *
 * props:
 *   messagePreview     string  消息预览文本
 *
 * emits:
 *   close
 *   confirm()
 */
const UnfavoriteConfirmModal = {
    name: 'UnfavoriteConfirmModal',
    components: { AcModal },
    props: {
        messagePreview: { type: String, default: '' },
        subtitle: { type: String, default: '确定要取消收藏这条消息吗？' },
    },
    emits: ['close', 'confirm'],
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="unfavorite-confirm-modal"
            title="取消收藏"
            :subtitle="subtitle"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'300px'"
            @close="onCancel"
        >
            <div class="unfavorite-confirm-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
            </div>
            <div class="unfavorite-confirm-preview" v-if="messagePreview">
                <div class="unfavorite-confirm-preview-text">{{ messagePreview }}</div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-danger" @click="onConfirm">取消收藏</button>
            </template>
        </AcModal>
    `,
};

/**
 * 删除存档确认弹窗
 *
 * props:
 *   archiveName     string  即将删除的存档名称
 *   archiveDate     string  存档时间(已格式化)
 *   messageCount    number  存档消息数
 *
 * emits:
 *   close
 *   confirm()
 */
const StoryArchiveDeleteConfirmModal = {
    name: 'StoryArchiveDeleteConfirmModal',
    props: {
        archiveName: { type: String, default: '' },
        archiveDate: { type: String, default: '' },
        messageCount: { type: Number, default: 0 },
    },
    emits: ['close', 'confirm'],
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="archive-confirm-modal-overlay" @click.self="onCancel">
            <div class="archive-confirm-modal archive-confirm-modal--danger">
                <div class="archive-confirm-icon">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                </div>
                <div class="archive-confirm-title">删除这条消息?</div>
                <div class="archive-confirm-text">
                    <div class="archive-confirm-line">
                        此操作不可撤销，消息删除后将无法恢复。
                    </div>
                    <div class="archive-confirm-hint archive-confirm-hint--danger">
                        请确认是否删除此消息。
                    </div>
                </div>
                <div class="archive-confirm-actions">
                    <button class="archive-confirm-btn archive-confirm-btn-cancel" @click="onCancel">取消</button>
                    <button class="archive-confirm-btn archive-confirm-btn-danger" @click="onConfirm">删除</button>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 红包发送弹窗 (v0.45 · v0.67.x 余额校验 · v0.69+ AcModal)
// ============================================
const RedpacketSendModal = {
    name: 'RedpacketSendModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '发红包' },
        // ★ v0.67.x 当前可用余额(从 SDK 读),UI 显示 + 余额不足时禁用按钮
        currentBalance: { type: Number, default: 0 },
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            message: '',
            amount: '6.66',
            style: 'normal',
        };
    },
    computed: {
        amountDisplay() {
            const n = parseFloat(this.amount);
            return isNaN(n) ? '0.00' : n.toFixed(2);
        },
        // ★ v0.67.x 余额不足时禁用按钮
        insufficientBalance() {
            const amt = parseFloat(this.amount);
            if (isNaN(amt) || amt <= 0) return false;
            return amt > (this.currentBalance || 0);
        },
    },
    methods: {
        onConfirm() {
            const amount = parseFloat(this.amount);
            if (isNaN(amount) || amount <= 0) {
                window.__phoneIsland?.notify?.('warning', '请输入金额', '金额必须大于0');
                return;
            }
            // ★ v0.67.x 余额校验:余额不足时禁用按钮 + 提示
            if (amount > (this.currentBalance || 0)) {
                window.__phoneIsland?.notify?.(
                    'warning',
                    '余额不足',
                    `当前余额 ¥${(this.currentBalance || 0).toFixed(2)},无法发送 ¥${amount.toFixed(2)} 红包`,
                );
                return;
            }
            this.$emit('confirm', {
                message: this.message.trim() || '恭喜发财',
                amount,
                style: this.style,
            });
        },
    },
    template: `
        <AcModal
            class="redpacket-send-modal"
            :title="title"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <!-- 主体内容 -->
            <div class="redpacket-send-form">
                <div class="redpacket-send-amount-row">
                    <span class="redpacket-send-yen">¥</span>
                    <input
                        type="number"
                        class="redpacket-send-amount-input"
                        v-model="amount"
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                    />
                </div>
                <div class="redpacket-send-message-row">
                    <input
                        type="text"
                        class="redpacket-send-message-input"
                        v-model="message"
                        placeholder="恭喜发财"
                        maxlength="50"
                    />
                </div>
                <!-- ★ v0.67.x 显示当前余额 -->
                <div class="redpacket-send-balance">
                    <span class="redpacket-send-balance-label">当前余额</span>
                    <span class="redpacket-send-balance-value">¥{{ (currentBalance || 0).toFixed(2) }}</span>
                </div>
                <div class="redpacket-send-hint" v-if="!insufficientBalance">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>红包将在接收时自动拆开</span>
                </div>
                <!-- ★ v0.67.x 余额不足时显示警告提示 -->
                <div class="redpacket-send-hint redpacket-send-hint--warning" v-else>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>余额不足,无法发送</span>
                </div>
            </div>

            <!-- 底部按钮 -->
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary redpacket-send-confirm-btn" @click="onConfirm" :disabled="insufficientBalance">
                    塞钱进红包
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 转账发送弹窗 (v0.45 · v0.67.x 余额校验 · v0.69+ AcModal)
// ============================================
const TransferSendModal = {
    name: 'TransferSendModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '转账' },
        // ★ v0.67.x 当前可用余额
        currentBalance: { type: Number, default: 0 },
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            amount: '100.00',
            note: '',
        };
    },
    computed: {
        amountDisplay() {
            const n = parseFloat(this.amount);
            return isNaN(n) ? '0.00' : n.toFixed(2);
        },
        // ★ v0.67.x 余额不足时禁用按钮
        insufficientBalance() {
            const amt = parseFloat(this.amount);
            if (isNaN(amt) || amt <= 0) return false;
            return amt > (this.currentBalance || 0);
        },
    },
    methods: {
        onConfirm() {
            const amount = parseFloat(this.amount);
            if (isNaN(amount) || amount <= 0) {
                window.__phoneIsland?.notify?.('warning', '请输入金额', '金额必须大于0');
                return;
            }
            // ★ v0.67.x 余额校验
            if (amount > (this.currentBalance || 0)) {
                window.__phoneIsland?.notify?.(
                    'warning',
                    '余额不足',
                    `当前余额 ¥${(this.currentBalance || 0).toFixed(2)},无法转账 ¥${amount.toFixed(2)}`,
                );
                return;
            }
            this.$emit('confirm', {
                amount,
                note: this.note.trim() || '转账',
            });
        },
    },
    template: `
        <AcModal
            class="transfer-send-modal"
            :title="title"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <!-- 主体内容 -->
            <div class="transfer-send-form">
                <div class="transfer-send-amount-row">
                    <span class="transfer-send-yen">¥</span>
                    <input
                        type="number"
                        class="transfer-send-amount-input"
                        v-model="amount"
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                    />
                </div>
                <div class="transfer-send-note-row">
                    <input
                        type="text"
                        class="transfer-send-note-input"
                        v-model="note"
                        placeholder="转账说明"
                        maxlength="100"
                    />
                </div>
                <!-- ★ v0.67.x 显示当前余额 -->
                <div class="transfer-send-balance">
                    <span class="transfer-send-balance-label">当前余额</span>
                    <span class="transfer-send-balance-value">¥{{ (currentBalance || 0).toFixed(2) }}</span>
                </div>
                <!-- ★ v0.67.x 余额不足时显示警告 -->
                <div class="transfer-send-hint transfer-send-hint--warning" v-if="insufficientBalance">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>余额不足,无法转账</span>
                </div>
            </div>

            <!-- 底部按钮 -->
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary transfer-send-confirm-btn" @click="onConfirm" :disabled="insufficientBalance">
                    确认转账 ¥{{ amountDisplay }}
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================================
// ★ v0.67 红包领取/拒绝确认弹窗
//   - 点 AI 红包卡片触发
//   - 显示红包金额 + 祝福语 + 来自谁
//   - 底部两个按钮:不领取 / 领取
//   - 用户原话「必须弹两个按钮」(2026-08-08)
// ============================================================
const RedpacketReceiveModal = {
    name: 'RedpacketReceiveModal',
    props: {
        message: { type: String, default: '恭喜发财' },
        amount: { type: Number, default: 0 },
        senderName: { type: String, default: '对方' },
        insufficientBalance: { type: Boolean, default: false },
    },
    emits: ['close', 'accept', 'reject'],
    computed: {
        amountDisplay() {
            const n = Number(this.amount) || 0;
            return n.toFixed(2);
        },
    },
    methods: {
        onAccept() {
            if (this.insufficientBalance) {
                window.__phoneIsland?.notify?.('warning', '对方余额不足', '红包无法领取');
                return;
            }
            this.$emit('accept');
            this.$emit('close');
        },
        onReject() {
            this.$emit('reject');
            this.$emit('close');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="redpacket-receive-overlay" @click.self="onCancel">
            <div class="redpacket-receive-modal">
                <div class="redpacket-receive-header">
                    <div class="redpacket-receive-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#FF6B8A" stroke-width="2">
                            <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/>
                            <path d="M4 12h16v-2a2 2 0 0 0-4-2H8a2 2 0 0 0-4 2v2z"/>
                            <circle cx="12" cy="14" r="1.5" fill="#FF6B8A"/>
                        </svg>
                    </div>
                    <div class="redpacket-receive-greeting">{{ message }}</div>
                    <div class="redpacket-receive-amount">¥{{ amountDisplay }}</div>
                    <div class="redpacket-receive-from">来自 {{ senderName }} 的红包</div>
                    <div v-if="insufficientBalance" class="redpacket-receive-warning">对方余额不足,无法领取</div>
                </div>
                <div class="redpacket-receive-actions">
                    <button class="redpacket-receive-btn redpacket-receive-btn--reject" type="button" @click="onReject">不领取</button>
                    <button class="redpacket-receive-btn redpacket-receive-btn--accept" type="button" @click="onAccept" :disabled="insufficientBalance">领取红包</button>
                </div>
            </div>
        </div>
    `,
};

// ============================================================
// ★ v0.67 转账收款/退回确认弹窗
//   - 点 AI 转账卡片触发
//   - 显示转账金额 + 备注
//   - 底部两个按钮:退回 / 收款
// ============================================================
const TransferReceiveModal = {
    name: 'TransferReceiveModal',
    props: {
        amount: { type: Number, default: 0 },
        note: { type: String, default: '转账' },
        senderName: { type: String, default: '对方' },
        insufficientBalance: { type: Boolean, default: false },
    },
    emits: ['close', 'accept', 'return'],
    computed: {
        amountDisplay() {
            const n = Number(this.amount) || 0;
            return n.toFixed(2);
        },
    },
    methods: {
        onAccept() {
            if (this.insufficientBalance) {
                window.__phoneIsland?.notify?.('warning', '对方余额不足', '无法收款');
                return;
            }
            this.$emit('accept');
            this.$emit('close');
        },
        onReturn() {
            this.$emit('return');
            this.$emit('close');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="transfer-receive-overlay" @click.self="onCancel">
            <div class="transfer-receive-modal">
                <div class="transfer-receive-header">
                    <div class="transfer-receive-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#4A9EF7" stroke-width="2" stroke-linecap="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="M12 8v8m-4-4h8"/>
                        </svg>
                    </div>
                    <div class="transfer-receive-title">转账</div>
                    <div class="transfer-receive-amount">¥{{ amountDisplay }}</div>
                    <div class="transfer-receive-note">{{ note }}</div>
                    <div class="transfer-receive-from">来自 {{ senderName }} 的转账</div>
                    <div v-if="insufficientBalance" class="transfer-receive-warning">对方余额不足,无法收款</div>
                </div>
                <div class="transfer-receive-actions">
                    <button class="transfer-receive-btn transfer-receive-btn--return" type="button" @click="onReturn">退回</button>
                    <button class="transfer-receive-btn transfer-receive-btn--accept" type="button" @click="onAccept" :disabled="insufficientBalance">收款</button>
                </div>
            </div>
        </div>
    `,
};

// ============================================================
// ★ v0.67 通话结束概要弹窗(展示通话时长 + 总结 + 关闭)
// ============================================================
const CallSummaryModal = {
    name: 'CallSummaryModal',
    props: {
        callType: { type: String, default: 'voice' },
        duration: { type: Number, default: 0 },
        summary: { type: String, default: '' },
        senderName: { type: String, default: '对方' },
        wasConnected: { type: Boolean, default: true },
        // ★ v0.68 修复点击查看详情卡死:framework 的 @viewDetail 没有 handler,
        //   通过 prop 直接传 callback,在 methods.onView() 里直接调用
        onViewDetail: { type: Function, default: null },
    },
    emits: ['close', 'viewDetail'],
    computed: {
        durationText() {
            const s = Math.max(0, Number(this.duration) || 0);
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        },
        typeText() {
            return this.callType === 'video' ? '视频通话' : '语音通话';
        },
    },
    methods: {
        onView() {
            // ★ v0.68 修复:framework 没有 @viewDetail handler,直接调 prop callback
            try {
                if (typeof this.onViewDetail === 'function') {
                    this.onViewDetail();
                }
            } catch (err) {
                console.warn('[CallSummaryModal] onViewDetail failed:', err);
            }
            this.$emit('close');
        },
        onClose() {
            this.$emit('close');
        },
    },
    template: `
        <div class="call-summary-overlay" @click.self="onClose">
            <div class="call-summary-modal">
                <div class="call-summary-icon">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#4CAF50" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                </div>
                <div class="call-summary-type">{{ typeText }} 已结束</div>
                <div class="call-summary-duration">{{ durationText }}</div>
                <div class="call-summary-status" v-if="!wasConnected">未接通</div>
                <div class="call-summary-divider"></div>
                <div class="call-summary-content" v-if="summary">{{ summary }}</div>
                <div class="call-summary-content call-summary-content--empty" v-else>本次通话暂无总结</div>
                <div class="call-summary-actions">
                    <button class="call-summary-btn call-summary-btn--ghost" type="button" @click="onClose">关闭</button>
                    <button class="call-summary-btn call-summary-btn--primary" type="button" @click="onView">查看详情</button>
                </div>
            </div>
        </div>
    `,
};

// ============================================================
// ★ v0.67 入站来电弹窗(AI 主动打来时弹出,等待用户接/挂)
// ============================================================
const IncomingCallModal = {
    name: 'IncomingCallModal',
    props: {
        callerName: { type: String, default: 'AI' },
        callerAvatar: { type: String, default: '' },
        callType: { type: String, default: 'voice' },
    },
    emits: ['accept', 'reject', 'close'],
    computed: {
        typeText() {
            return this.callType === 'video' ? '视频通话' : '语音通话';
        },
        initial() {
            const s = String(this.callerName || '?').trim();
            return Array.from(s)[0] || '?';
        },
    },
    methods: {
        onAccept() {
            this.$emit('accept');
            this.$emit('close');
        },
        onReject() {
            this.$emit('reject');
            this.$emit('close');
        },
    },
    template: `
        <div class="incoming-call-overlay" @click.self="onReject">
            <div class="incoming-call-avatar">
                <img v-if="callerAvatar" :src="callerAvatar" alt="" />
                <div v-else style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:600;color:white;background:linear-gradient(135deg,#4A9EF7,#9C27B0);">{{ initial }}</div>
            </div>
            <div class="incoming-call-caller">{{ callerName }}</div>
            <div class="incoming-call-type">邀请你{{ typeText }}…</div>
            <div class="incoming-call-subtitle">来电中</div>
            <div class="incoming-call-actions">
                <div>
                    <button class="incoming-call-btn incoming-call-btn--reject" type="button" @click="onReject" aria-label="拒绝">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
                            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                        </svg>
                    </button>
                    <div class="incoming-call-btn-label">拒绝</div>
                </div>
                <div>
                    <button class="incoming-call-btn incoming-call-btn--accept" type="button" @click="onAccept" aria-label="接听">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                        </svg>
                    </button>
                    <div class="incoming-call-btn-label">接听</div>
                </div>
            </div>
        </div>
    `,
};

// ============================================================
// ★ v0.50 回复提示词编辑弹窗(const 定义必须在注册表之前,否则 TDZ)
//   - 提供 title / content / source / active 四个字段
//   - title 必填;content / source 可选;active 默认 true
//   - source 提供下拉(自定义 / 人设空间 / 聊天记录 / 音乐 / 天气 / 日程 / 相册 / 朋友圈)
//   - 保存后回调 onSave({ title, content, source, active })
// ============================================================

const REPLY_PROMPT_SOURCE_OPTIONS = [
    { value: 'custom', label: '自定义' },
    { value: 'persona', label: '人设空间' },
    { value: 'chat', label: '聊天记录' },
    { value: 'music', label: '音乐' },
    { value: 'weather', label: '天气' },
    { value: 'calendar', label: '日程' },
    { value: 'album', label: '相册' },
    { value: 'moments', label: '朋友圈' },
];

const EditReplyPromptModal = {
    name: 'EditReplyPromptModal',
    components: { AcModal },
    props: {
        initial: {
            type: Object,
            default: () => ({ title: '', content: '', source: 'custom', active: true }),
        },
        isCreate: { type: Boolean, default: false },
        // 这条 prompt 在 Prompt 库里的原文（只有「从库里拉取来的」才有）。
        // 用户把拉来的 prompt 改坏了之后，得有路退回去。
        originContent: { type: String, default: '' },
    },
    emits: ['close', 'save'],
    data() {
        return {
            title: String(this.initial?.title || ''),
            content: String(this.initial?.content || ''),
            source: String(this.initial?.source || 'custom'),
            active: this.initial?.active !== false,
            isSaving: false,
            titleMax: 60,
            contentMax: 2000,
            sourceOptions: REPLY_PROMPT_SOURCE_OPTIONS,
            // 变量清单菜单（默认收起 —— 展开占掉半个弹窗，多数时候用不到）
            varMenuOpen: false,
            varGroups: listPromptVariablesByGroup(),
        };
    },
    computed: {
        modalTitle() {
            return this.isCreate ? '新增回复提示词' : '编辑回复提示词';
        },
        modalHint() {
            return '已启用的提示词会按顺序注入到 AI 回复指令里(系统提示词)';
        },
        titleCount() { return this.title.length; },
        contentCount() { return this.content.length; },
        canSave() {
            return this.title.trim().length > 0 && !this.isSaving;
        },
        // 没有库原文（自己新建的 prompt）就不显示这个按钮 ——
        // 「复原」对一条从头写的 prompt 没有意义。
        hasOrigin() { return String(this.originContent || '').trim().length > 0; },
        canRestore() {
            return this.hasOrigin && String(this.originContent) !== this.content;
        },
        // 正文里写错的变量名（比如 {{usrName}}）。即时提示，
        // 别等发给 AI 之后才发现 prompt 里躺着一串没被替换的占位符。
        unknownVars() {
            return inspectPromptVariables(this.content).unknown;
        },
    },
    methods: {
        // ★ 把变量名包成 "{{<name>}}" 字符串（避免在 Vue template 里写
        //   "'{{' + name + '}}'" 这种让 template 解析器在字符串字面量
        //   边界误判的语法；所有用法统一走这个函数）
        formatVarToken(name) {
            return `{{${String(name || '')}}}`;
        },
        onSave() {
            if (!this.canSave) return;
            this.isSaving = true;
            this.$emit('save', {
                title: this.title.trim(),
                content: this.content,
                source: this.source || 'custom',
                active: !!this.active,
            });
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 200);
        },
        onCancel() { this.$emit('close'); },
        toggleActive() { this.active = !this.active; },
        /** 退回 Prompt 库里的原文。只填回输入框，要不要留下由用户按保存决定。 */
        onRestoreOrigin() {
            if (!this.canRestore) return;
            this.content = String(this.originContent || '');
        },
        toggleVarMenu() { this.varMenuOpen = !this.varMenuOpen; },
        /**
         * 把变量插到光标处。
         * 直接改 v-model 绑的字符串会把光标顶到末尾，所以要读一下
         * selectionStart/End 再自己拼，并在下一帧把光标放回变量后面。
         */
        insertVariable(name) {
            const token = `{{${name}}}`;
            const el = this.$refs.contentArea;
            if (!el) { this.content += token; return; }
            const start = el.selectionStart ?? this.content.length;
            const end = el.selectionEnd ?? start;
            this.content = this.content.slice(0, start) + token + this.content.slice(end);
            this.$nextTick(() => {
                el.focus();
                const pos = start + token.length;
                try { el.setSelectionRange(pos, pos); } catch (_) {}
            });
        },
    },
    template: `
        <AcModal
            class="edit-reply-prompt-modal"
            :title="modalTitle"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <div class="reply-prompt-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>{{ modalHint }}</span>
            </div>
            <div class="reply-prompt-field">
                <div class="reply-prompt-label-row">
                    <label class="reply-prompt-label">标题</label>
                    <span class="reply-prompt-counter">{{ titleCount }} / {{ titleMax }}</span>
                </div>
                <input type="text" class="reply-prompt-input" v-model="title"
                    :maxlength="titleMax" placeholder="例如:温暖陪伴风格"/>
            </div>
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">来源</label>
                <select class="reply-prompt-select" v-model="source">
                    <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
            </div>
            <div class="reply-prompt-field">
                <div class="reply-prompt-label-row">
                    <label class="reply-prompt-label">正文(完整 prompt)</label>
                    <div class="reply-prompt-label-tools">
                        <button type="button" class="reply-prompt-restore-btn"
                            title="插入变量（发送给 AI 前会替换成真实值）"
                            @click="toggleVarMenu">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round">
                                <path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/>
                                <path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>
                            </svg>
                            <span>变量</span>
                        </button>
                        <button v-if="hasOrigin" type="button" class="reply-prompt-restore-btn"
                            :disabled="!canRestore"
                            :title="canRestore ? '退回这条 prompt 在库里的原文' : '当前内容就是库里的原文'"
                            @click="onRestoreOrigin">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 2v6h6"/>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 8"/>
                            </svg>
                            <span>复原原文</span>
                        </button>
                        <span class="reply-prompt-counter">{{ contentCount }} / {{ contentMax }}</span>
                    </div>
                </div>
                <div v-if="varMenuOpen" class="prompt-var-menu">
                    <div class="prompt-var-menu-hint">点一下插到光标处。发送给 AI 前会替换成真实值，拿不到值时替换成空。</div>
                    <div v-for="g in varGroups" :key="g.group" class="prompt-var-group">
                        <div class="prompt-var-group-title">{{ g.group }}</div>
                        <div class="prompt-var-chips">
                            <button v-for="v in g.items" :key="v.name" type="button"
                                class="prompt-var-chip"
                                :title="v.desc + '（示例：' + v.example + '）'"
                                @click="insertVariable(v.name)">
                                <code>{{ formatVarToken(v.name) }}</code>
                                <span>{{ v.label }}</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div v-if="unknownVars.length" class="prompt-var-warning">
                    这些变量名系统不认识，会原样发给 AI：
                    <code v-for="n in unknownVars" :key="n">{{ formatVarToken(n) }}</code>
                </div>
                <textarea class="reply-prompt-textarea" ref="contentArea" v-model="content"
                    :maxlength="contentMax"
                    placeholder="例如:回复时尽量短句,1~2 句话即可。结尾可以用「啦」「呢」「嗯嗯」..."
                    rows="6"></textarea>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary"
                    :disabled="!canSave"
                    @click="onSave">
                    <span v-if="!isSaving">{{ isCreate ? '新增' : '保存' }}</span>
                    <span v-else>保存中...</span>
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.57 系统 prompt 弹窗(只编辑「回复须知」文本 + 位置)
//   - 复用 reply-prompt-* 样式(极简风)
//   - 顶部展示「人设上下文」快照(只读,黑灰背景)
//   - 编辑区域:「回复须知」textarea + 「位置」segmented-tabs(before/after)
//   - 不能修改人设字段
// ============================================
const SystemPromptEditModal = {
    name: 'SystemPromptEditModal',
    components: { AcModal },
    props: {
        kind: { type: String, default: 'user' },          // 'user' | 'ai'
        aiPersonId: { type: String, default: '' },
        title: { type: String, default: '' },
        baseContent: { type: String, default: '' },       // 人设上下文快照
        replyNote: { type: String, default: '' },
        position: { type: String, default: 'after' },     // 'before' | 'after'
        // 系统预设的原始「回复须知」。用户改坏了可以一键退回来。
        // 由调用方传进来（defaultReplyNote(kind, ctx) 的产物），组件自己不去算 ——
        // 算法在 reply-format-instructions.js，组件不该知道它。
        defaultNote: { type: String, default: '' },
    },
    emits: ['close', 'save'],
    data() {
        // ★ v0.58 修复:不要用 `position` 做 data 字段 —— 它会和 props.position
        //   冲突(Vue 3 优先取 prop,赋值到 this.position 等于改 prop,会被静默忽略,
        //   表现为「按钮点了没反应」)。改用 currentPosition。
        return {
            note: String(this.replyNote || ''),
            currentPosition: this.position === 'before' ? 'before' : 'after',
            isSaving: false,
            noteMax: 500,
        };
    },
    computed: {
        modalTitle() {
            return `编辑${this.title || (this.kind === 'user' ? '当前用户人设' : '当前 AI 人设')}`;
        },
        modalHint() {
            return '只能编辑「回复须知」文本 + 位置。人设字段由 settings app 管控,不会改动。';
        },
        noteCount() { return this.note.length; },
        canSave() { return this.note.trim().length > 0 && !this.isSaving; },
        // 已经和预设一字不差就没必要给「复原」——按了什么都不会变，
        // 那种按钮只会让人怀疑是不是坏了。
        canRestore() {
            const d = String(this.defaultNote || '').trim();
            return !!d && d !== this.note.trim();
        },
        fullPreview() {
            const note = this.note.trim();
            const noteLine = note ? `【回复须知】${note}` : '';
            if (!noteLine) return this.baseContent;
            return this.currentPosition === 'before'
                ? `${noteLine}\n\n${this.baseContent}`
                : `${this.baseContent}\n\n${noteLine}`;
        },
    },
    methods: {
        onSave() {
            if (!this.canSave) return;
            this.isSaving = true;
            this.$emit('save', { note: this.note.trim(), position: this.currentPosition });
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 200);
        },
        onCancel() { this.$emit('close'); },
        /**
         * 退回系统预设。
         * 只填回输入框、不直接落盘 —— 用户还能看一眼再决定要不要按保存，
         * 而且如果他其实想留着自己那版，直接关掉弹窗就行。
         */
        onRestoreDefault() {
            if (!this.canRestore) return;
            this.note = String(this.defaultNote || '');
            this.currentPosition = 'after';
        },
    },
    template: `
        <AcModal
            class="system-prompt-edit-modal"
            :title="modalTitle"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <div class="reply-prompt-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>{{ modalHint }}</span>
            </div>
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">人设上下文（不可修改）</label>
                <div class="system-prompt-position-tabs">
                    <button type="button" class="system-prompt-position-tab"
                        :class="{ active: currentPosition === 'before' }"
                        @click="currentPosition = 'before'">放在人设前</button>
                    <button type="button" class="system-prompt-position-tab"
                        :class="{ active: currentPosition === 'after' }"
                        @click="currentPosition = 'after'">放在人设后</button>
                </div>
                <pre class="system-prompt-preview">{{ baseContent }}</pre>
            </div>
            <div class="reply-prompt-field">
                <div class="reply-prompt-label-row">
                    <label class="reply-prompt-label">回复须知</label>
                    <div class="reply-prompt-label-tools">
                        <button type="button" class="reply-prompt-restore-btn"
                            :disabled="!canRestore"
                            :title="canRestore ? '把「回复须知」退回系统预设文案' : '当前内容就是系统预设'"
                            @click="onRestoreDefault">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 2v6h6"/>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 8"/>
                            </svg>
                            <span>复原预设</span>
                        </button>
                        <span class="reply-prompt-counter">{{ noteCount }} / {{ noteMax }}</span>
                    </div>
                </div>
                <textarea class="reply-prompt-textarea" v-model="note"
                    :maxlength="noteMax"
                    placeholder="例如:请用第三人称描写对方,语气克制,称呼对方为「你」"
                    rows="4"></textarea>
            </div>
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">预览(完整注入效果)</label>
                <pre class="system-prompt-preview system-prompt-preview--live">{{ fullPreview }}</pre>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary"
                    :disabled="!canSave"
                    @click="onSave">
                    <span v-if="!isSaving">保存</span>
                    <span v-else>保存中...</span>
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.61.8 App Prompt 特殊卡片预览编辑器(子组件)
//   - 顶部:预览卡片(实时根据 textarea 修改)
//   - 下方:JSON 文本框(默认只读,点「编辑」可改)
//   - 按钮组:复制 / 编辑 / 保存 / 复原
//   - 保存走 sdk.appPrompts.setState(customPreviewData)
//   - 复原回到原始 previewData(register 时的)
// ============================================================

// 局部 XSS escape 工具(组件内 v-html 拼接用)
function _appPromptEscapeText(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- 子组件:音乐卡片预览(实时) ----
const AppPromptMusicPreview = {
    name: 'AppPromptMusicPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const song = String(d.song || d.title || this.label || '未命名歌曲');
            const artist = String(d.artist || d.singer || '未知歌手');
            const cover = String(d.cover || '');
            const coverHtml = cover
                ? `<div class="pm-preview-card__cover" style="background-image:url('${_appPromptEscapeText(cover)}')"></div>`
                : `<div class="pm-preview-card__cover pm-preview-card__cover--placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                    </svg>
                </div>`;
            return `
                <div class="pm-preview-card pm-preview-card--music">
                    ${coverHtml}
                    <div class="pm-preview-card__meta">
                        <div class="pm-preview-card__title">${_appPromptEscapeText(song)}</div>
                        <div class="pm-preview-card__sub">${_appPromptEscapeText(artist)}</div>
                    </div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};
// ---- 子组件:红包卡片预览 ----
const AppPromptRedPacketPreview = {
    name: 'AppPromptRedPacketPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const message = String(d.message || d.title || this.label || '恭喜发财');
            const sender = String(d.sender || '对方发来红包');
            return `
                <div class="pm-preview-card pm-preview-card--red-packet">
                    <div class="pm-preview-card__redpacket-header">
                        <div class="pm-preview-card__redpacket-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="12" cy="14" r="2.5"/>
                            </svg>
                        </div>
                        <div class="pm-preview-card__redpacket-text">
                            <div class="pm-preview-card__redpacket-title">${_appPromptEscapeText(message)}</div>
                            <div class="pm-preview-card__redpacket-sender">${_appPromptEscapeText(sender)}</div>
                        </div>
                    </div>
                    <div class="pm-preview-card__redpacket-footer">
                        <span class="pm-preview-card__redpacket-cta">点击领取红包</span>
                    </div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};
// ---- 子组件:位置卡片预览 ----
const AppPromptLocationPreview = {
    name: 'AppPromptLocationPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const name = String(d.name || d.title || this.label || '位置');
            const address = String(d.address || '');
            return `
                <div class="pm-preview-card pm-preview-card--location">
                    <div class="pm-preview-card__location-map">
                        <div class="pm-preview-card__location-grid"></div>
                        <div class="pm-preview-card__location-pin">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                        </div>
                    </div>
                    <div class="pm-preview-card__location-info">
                        <div class="pm-preview-card__location-name">${_appPromptEscapeText(name)}</div>
                        ${address ? `<div class="pm-preview-card__location-address">${_appPromptEscapeText(address)}</div>` : ''}
                    </div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};
// ---- 子组件:文本预览 ----
const AppPromptTextPreview = {
    name: 'AppPromptTextPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const text = String(d.text || d.preview || this.label || '(空文本)');
            return `
                <div class="pm-preview-card pm-preview-card--text">
                    <div class="pm-preview-card__text">${_appPromptEscapeText(text)}</div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};

// ---- 主弹窗组件(注册子组件) ----
const AppPromptPreviewModal = {
    name: 'AppPromptPreviewModal',
    components: {
        AcModal,
        AppPromptMusicPreview,
        AppPromptRedPacketPreview,
        AppPromptLocationPreview,
        AppPromptTextPreview,
    },
    props: {
        appId: { type: String, default: '' },
        promptId: { type: String, default: '' },
        previewType: { type: String, default: 'text' },        // 'text' | 'music-card' | 'red-packet-card' | 'location-card'
        previewData: { type: Object, default: () => ({}) },   // 原始 previewData
        originalPreviewData: { type: Object, default: null },  // 复原基准(可选)
        label: { type: String, default: '' },
    },
    emits: ['close', 'save', 'notify'],
    data() {
        // 编辑器内部维护一份 textarea 文本,实时同步到 previewObject
        return {
            isReadOnly: true,
            isSaving: false,
            jsonText: JSON.stringify(this.previewData || {}, null, 2),
            parseError: '',
        };
    },
    computed: {
        modalTitle() {
            return `预览 / 编辑:${this.label || this.promptId || 'App Prompt'}`;
        },
        modalHint() {
            return '实时编辑下方 JSON,预览区会同步更新。点「保存」写回 SDK,「复原」回到原始值。';
        },
        // 解析后的对象(JSON 合法时),实时驱动预览
        previewObject() {
            if (!this.jsonText || !this.jsonText.trim()) return {};
            try {
                const parsed = JSON.parse(this.jsonText);
                this.parseError = '';
                return (parsed && typeof parsed === 'object') ? parsed : {};
            } catch (e) {
                this.parseError = String(e?.message || e);
                // 解析失败时,回退用 props.previewData 让预览不消失
                return this.previewData || {};
            }
        },
        canSave() {
            return !this.isSaving && !this.parseError && this.jsonText.trim().length > 0;
        },
        hasChanges() {
            return this.jsonText !== JSON.stringify(this.previewData || {}, null, 2);
        },
    },
    methods: {
        onCancel() { this.$emit('close'); },
        onToggleEdit() { this.isReadOnly = !this.isReadOnly; },
        async onSave() {
            if (!this.canSave) return;
            this.isSaving = true;
            try {
                // 用 $emit('save') 把最新对象交给调用方,调用方负责写 SDK
                this.$emit('save', { previewData: this.previewObject });
            } finally {
                setTimeout(() => {
                    this.isSaving = false;
                    this.$emit('close');
                }, 200);
            }
        },
        onRestore() {
            const base = this.originalPreviewData || this.previewData || {};
            this.jsonText = JSON.stringify(base, null, 2);
            this.parseError = '';
            this.isReadOnly = true;
        },
        async onCopy() {
            try {
                if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(this.jsonText);
                    this.$emit('notify', { level: 'success', title: '已复制', sub: 'JSON 已复制到剪贴板' });
                } else {
                    this.$emit('notify', { level: 'warning', title: '复制失败', sub: '当前环境不支持剪贴板 API' });
                }
            } catch (e) {
                this.$emit('notify', { level: 'warning', title: '复制失败', sub: String(e?.message || e) });
            }
        },
    },
    template: `
        <AcModal
            class="app-prompt-preview-modal"
            :title="modalTitle"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'460px'"
            @close="$emit('close')"
        >
            <div class="reply-prompt-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>{{ modalHint }}</span>
            </div>
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">预览区(实时)</label>
                <div class="app-prompt-preview-stage">
                    <app-prompt-music-preview v-if="previewType === 'music-card'" :preview-data="previewObject" :label="label" />
                    <app-prompt-red-packet-preview v-else-if="previewType === 'red-packet-card'" :preview-data="previewObject" :label="label" />
                    <app-prompt-location-preview v-else-if="previewType === 'location-card'" :preview-data="previewObject" :label="label" />
                    <app-prompt-text-preview v-else :preview-data="previewObject" :label="label" />
                </div>
            </div>
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">
                    预览数据(JSON)
                    <span v-if="parseError" class="app-prompt-preview-error">解析失败:{{ parseError }}</span>
                    <span v-else-if="hasChanges" class="app-prompt-preview-dirty">已修改</span>
                </label>
                <textarea
                    class="reply-prompt-textarea app-prompt-preview-textarea"
                    v-model="jsonText"
                    :readonly="isReadOnly"
                    spellcheck="false"
                    rows="10"></textarea>
            </div>

            <template #footer>
                <button type="button" class="reply-prompt-btn-secondary"
                    @click="onCopy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>复制</span>
                </button>
                <button type="button" class="reply-prompt-btn-secondary"
                    @click="onToggleEdit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                    </svg>
                    <span>{{ isReadOnly ? '编辑' : '锁定' }}</span>
                </button>
                <button type="button" class="reply-prompt-btn-secondary"
                    :disabled="!hasChanges"
                    @click="onRestore">复原</button>
                <span class="app-prompt-preview-spacer"></span>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary"
                    :disabled="!canSave"
                    @click="onSave">
                    <span v-if="!isSaving">保存</span>
                    <span v-else>保存中...</span>
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.61.8.11 上下文长度设置弹窗(ContextLengthModal)
//   - 用于「聊天设置 → 上下文长度」行的点击弹窗
//   - 用户自定义一个「回合」数(1回合 = 1组用户消息 + 1组AI回复)
//   - 保存后写入 aiPerson.socialProfiles.chat.rollingConfig.contextRounds
//   - 用于「当前聊天回合」prompt 的范围控制
//   - v0.72 改 AcModal(粉蓝云朵风格),删除旧的自渲染外壳
// ============================================
const ContextLengthModal = {
    name: 'ContextLengthModal',
    components: { AcModal },
    props: {
        // 当前 AI 人设 ID
        aiPersonId: { type: String, default: '' },
        // 当前联系人名称(显示用)
        contactName: { type: String, default: '' },
        // 当前回合数(来自 rollingConfig.contextRounds)
        currentValue: { type: Number, default: 20 },
        // 当前 mode
        mode: { type: String, default: 'calendar' },
    },
    emits: ['close', 'save'],
    data() {
        return {
            inputValue: this.currentValue || 20,
            isSaving: false,
        };
    },
    computed: {
        displayValue() {
            return this.inputValue;
        },
        // 回合数有效范围: 1-100
        isValid() {
            const n = Number(this.inputValue);
            return Number.isInteger(n) && n >= 1 && n <= 100;
        },
        hintText() {
            if (!this.isValid) {
                return '请输入 1-100 之间的整数';
            }
            return `最近 ${this.inputValue} 个回合(1回合=1组用户+1组AI)`;
        },
    },
    methods: {
        onDecrease() {
            const n = Number(this.inputValue);
            if (n > 1) this.inputValue = n - 1;
        },
        onIncrease() {
            const n = Number(this.inputValue);
            if (n < 100) this.inputValue = n + 1;
        },
        onInput(e) {
            const raw = String(e?.target?.value || '');
            const n = parseInt(raw, 10);
            if (!isNaN(n) && n >= 1 && n <= 100) {
                this.inputValue = n;
            }
        },
        onSave() {
            if (!this.isValid || this.isSaving) return;
            this.isSaving = true;
            this.$emit('save', this.inputValue);
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 300);
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="ctx-length-modal"
            title="上下文长度"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'320px'"
            @close="$emit('close')"
        >
            <div class="ctx-length-desc">
                <span>设置「当前聊天回合」Prompt 包含的回合数</span>
            </div>

            <div class="ctx-length-control">
                <button type="button" class="ctx-length-btn ctx-length-btn--minus"
                    @click="onDecrease" :disabled="inputValue <= 1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>

                <div class="ctx-length-display">
                    <input type="number" class="ctx-length-input"
                        :value="inputValue"
                        min="1" max="100"
                        @input="onInput" />
                    <span class="ctx-length-unit">回合</span>
                </div>

                <button type="button" class="ctx-length-btn ctx-length-btn--plus"
                    @click="onIncrease" :disabled="inputValue >= 100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>
            </div>

            <div class="ctx-length-hint" :class="{ 'ctx-length-hint--error': !isValid }">
                {{ hintText }}
            </div>

            <div class="ctx-length-example">
                <div class="ctx-length-example-title">回合定义示例</div>
                <div class="ctx-length-example-item">
                    <span class="ctx-length-example-label">1回合=</span>
                    <span>用户:你好 → AI:不错</span>
                </div>
                <div class="ctx-length-example-item">
                    <span class="ctx-length-example-label">最新回合=</span>
                    <span>用户:吃了吗 → AI:吃了 → AI:你呢</span>
                </div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary"
                    :disabled="!isValid || isSaving"
                    @click="onSave">
                    {{ isSaving ? '保存中...' : '保存' }}
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.88 K 链记忆设置弹窗(KChainModal)
//   - 入口:聊天设置 →「K 链记忆」行(就在「上下文长度」下面)
//   - 开关 + 窗口回合数(数字步进器,和 ContextLengthModal 同款)
//     + 当前这一版记忆正文(可手改)+ 进度提示 + 清空
//   - 「还差 N 轮」这一行是关键:上一版 K 链之所以被用户删掉,
//     很大一部分原因是开了之后完全看不出它在干什么
// ============================================
const KChainModal = {
    name: 'KChainModal',
    components: { AcModal },
    props: {
        aiPersonId: { type: String, default: '' },
        contactName: { type: String, default: '' },
        mode: { type: String, default: 'calendar' },
        // { enabled, windowSize }
        config: { type: Object, default: () => ({ enabled: false, windowSize: 5 }) },
        // { current:{index,content,rounds}, history:[] }
        slot: { type: Object, default: () => ({ current: { index: 0, content: '', rounds: 0 }, history: [] }) },
        // 距上次压缩已经过了几个回合
        pending: { type: Number, default: 0 },
    },
    emits: ['close', 'save', 'clear'],
    data() {
        return {
            enabled: this.config?.enabled === true,
            windowSize: Number(this.config?.windowSize) || 5,
            content: String(this.slot?.current?.content || ''),
            isSaving: false,
        };
    },
    computed: {
        version() { return Number(this.slot?.current?.index) || 0; },
        isValid() {
            const n = Number(this.windowSize);
            return Number.isInteger(n) && n >= 2 && n <= 50;
        },
        left() { return Math.max(0, Number(this.windowSize) - Number(this.pending)); },
        progressText() {
            if (!this.enabled) return '关闭状态:不会拼任何 K 链相关的内容,一个 token 都不多花。';
            if (this.left > 0) {
                return `已经攒了 ${this.pending} 个回合,还差 ${this.left} 轮。在那之前「生成记忆」这段指令不会发出去。`;
            }
            return '已经攒够了 —— 下一次发消息时,AI 会在回复的同时把记忆更新一版。';
        },
    },
    methods: {
        onDecrease() { if (this.windowSize > 2) this.windowSize -= 1; },
        onIncrease() { if (this.windowSize < 50) this.windowSize += 1; },
        onInput(e) {
            const n = parseInt(String(e?.target?.value || ''), 10);
            if (!isNaN(n) && n >= 2 && n <= 50) this.windowSize = n;
        },
        onSave() {
            if (!this.isValid || this.isSaving) return;
            this.isSaving = true;
            this.$emit('save', {
                enabled: this.enabled,
                windowSize: Number(this.windowSize),
                content: this.content,
            });
            setTimeout(() => { this.isSaving = false; this.$emit('close'); }, 300);
        },
        onClear() {
            this.content = '';
            this.$emit('clear');
        },
    },
    template: `
        <AcModal
            class="kchain-modal"
            title="K 链记忆"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'330px'"
            @close="$emit('close')"
        >
            <div class="ctx-length-desc">
                <span>攒够 N 个回合,AI 就在回复的同时顺手把记忆压缩更新一次</span>
            </div>

            <label class="kchain-switch">
                <span class="kchain-switch-label">启用 K 链记忆</span>
                <input type="checkbox" v-model="enabled" />
            </label>

            <template v-if="enabled">
                <div class="ctx-length-control">
                    <button type="button" class="ctx-length-btn ctx-length-btn--minus"
                        @click="onDecrease" :disabled="windowSize <= 2">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                    <div class="ctx-length-display">
                        <input type="number" class="ctx-length-input"
                            :value="windowSize" min="2" max="50" @input="onInput" />
                        <span class="ctx-length-unit">回合</span>
                    </div>
                    <button type="button" class="ctx-length-btn ctx-length-btn--plus"
                        @click="onIncrease" :disabled="windowSize >= 50">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>
                <div class="ctx-length-hint" :class="{ 'ctx-length-hint--error': !isValid }">
                    {{ isValid ? progressText : '请输入 2-50 之间的整数' }}
                </div>

                <div class="kchain-current">
                    <div class="kchain-current-head">
                        <span class="kchain-current-title">
                            当前记忆
                            <em v-if="version">第 {{ version }} 版 · 覆盖 {{ slot.current.rounds }} 回合</em>
                            <em v-else>还没生成</em>
                        </span>
                        <button v-if="content" type="button" class="kchain-clear" @click="onClear">清空</button>
                    </div>
                    <textarea
                        class="kchain-textarea"
                        v-model="content"
                        rows="6"
                        placeholder="攒够回合后由 AI 自动写入。你也可以直接在这儿改 —— 改完的内容就是下一轮真正发出去的那份。"
                    ></textarea>
                </div>

                <p class="kchain-note">
                    新记忆是把旧记忆和这几个回合**合并重写**的,不是往后面追加,所以它不会越滚越长。
                </p>
            </template>

            <div v-else class="ctx-length-hint">{{ progressText }}</div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary"
                    :disabled="!isValid || isSaving" @click="onSave">
                    {{ isSaving ? '保存中...' : '保存' }}
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.72 「当前模式提示词」编辑弹窗(ContextModeEditorModal)
//   - 4 个 tab:聊天 / 语音 / 视频 / 游戏
//   - 每个 tab 下方一个 textarea(展示对应模式的提示词正文)
//   - 底部按钮:恢复默认 / 取消 / 保存
//   - 4 段 prompt 文本通过 contextMode.setModePromptOverrides 持久化
//   - v0.72 改 AcModal(粉蓝云朵风格):
//     - 外壳 / 关闭按钮 / 取消+保存按钮由 AcModal 提供
//     - 4-tab 内部布局 + textarea + 恢复默认按钮作为业务内容
//     - selector hook:.cmd-modal(class 透传到 .ac-overlay)
// ============================================
export const ContextModeEditorModal = {
    name: 'ContextModeEditorModal',
    components: { AcModal },
    props: {
        aiPersonId: { type: String, default: '' },
        tabs: { type: Array, default: () => [] }, // [{ key, label, icon, desc }]
        snapshot: { type: Object, default: () => ({}) }, // 当前 4 段(含 override)
        defaults: { type: Object, default: () => ({}) }, // 4 段默认文本(用于「恢复默认」立即生效)
    },
    emits: ['close', 'save'],
    data() {
        const initialTab = (this.tabs[0] && this.tabs[0].key) || 'chat';
        return {
            activeTab: initialTab,
            values: { ...(this.snapshot || {}) },
        };
    },
    computed: {
        activePanel() {
            return this.tabs.find((t) => t.key === this.activeTab) || null;
        },
        canSave() {
            // 4 段都必须有内容
            return this.tabs.every((t) => String(this.values[t.key] || '').trim().length > 0);
        },
        canReset() {
            // 当前 tab 文本与默认不同 → 恢复默认按钮可用
            const cur = String(this.values[this.activeTab] || '');
            const def = String(this.defaults[this.activeTab] || '');
            return cur !== def;
        },
    },
    methods: {
        switchTab(key) {
            if (!this.tabs.some((t) => t.key === key)) return;
            this.activeTab = key;
        },
        onSave() {
            if (!this.canSave) return;
            this.$emit('save', { ...this.values });
        },
        onReset() {
            // 恢复当前 tab 的默认文本(UX:textarea 立即显示默认文本,需点保存才生效)
            const def = String(this.defaults[this.activeTab] || '');
            this.values = { ...this.values, [this.activeTab]: def };
        },
    },
    template: `
        <AcModal
            class="cmd-modal"
            title="当前模式提示词"
            subtitle="切换 chat / voice / video / game 时，AI 看到的对应卡片正文。改完后所有 AI 人设共用一份。"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'520px'"
            @close="$emit('close')"
        >
            <div class="cmd-tabs" role="tablist">
                <button
                    v-for="t in tabs"
                    :key="t.key"
                    type="button"
                    class="ac-btn ac-btn-primary cmd-tab"
                    :class="{ 'is-active': activeTab === t.key }"
                    :aria-selected="activeTab === t.key"
                    role="tab"
                    @click="switchTab(t.key)"
                >
                    <span class="cmd-tab__label">{{ t.label }}</span>
                </button>
            </div>

            <div class="cmd-panels">
                <div
                    v-for="t in tabs"
                    :key="t.key"
                    class="cmd-panel"
                    :hidden="activeTab !== t.key"
                    role="tabpanel"
                >
                    <textarea
                        class="cmd-textarea"
                        :value="values[t.key] || ''"
                        spellcheck="false"
                        rows="10"
                        :placeholder="'在此填写 ' + t.label + ' 模式的提示词…'"
                        @input="values[t.key] = $event.target.value"
                    ></textarea>
                </div>
            </div>

            <template #footer>
                <button
                    type="button"
                    class="ac-btn ac-btn-secondary cmd-btn--reset"
                    :disabled="!canReset"
                    @click="onReset"
                >恢复默认</button>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canSave" @click="onSave">保存</button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 导出注册表
// ============================================
export const CHAT_MODAL_COMPONENTS = {
    'location-card': LocationCardModal,
    'location-picker': LocationPickerModal,
    'desc-image': DescImageModal,
    'desc-image-send': DescImageSendModal,
    'voice-record': VoiceRecordModal,
    'mode-selector': ModeSelectorModal,
    'ai-remark': AiRemarkModal,
    'chat-background': ChatBackgroundModal,
    'forward-target': ForwardTargetModal,
    'chat-record-detail': ChatRecordDetailModal,
    // ★ v0.42 故事存档系列弹窗
    'archive-save': StoryArchiveSaveModal,
    'archive-restore-confirm': StoryArchiveRestoreConfirmModal,
    'archive-delete-confirm': StoryArchiveDeleteConfirmModal,
    // ★ v0.43 消息编辑弹窗(复用 ai-remark 样式,精简版)
    'message-edit': MessageEditModal,
    // ★ v0.44 消息删除确认弹窗
    'message-delete-confirm': MessageDeleteConfirmModal,
    // ★ v0.45 红包/转账发送弹窗
    'redpacket-send': RedpacketSendModal,
    'transfer-send': TransferSendModal,
    // ★ v0.67 红包/转账接收确认弹窗(点 AI 发的红包/转账卡片触发)
    'redpacket-receive': RedpacketReceiveModal,
    'transfer-receive': TransferReceiveModal,
    // ★ v0.67 通话结束概要弹窗
    'call-summary': CallSummaryModal,
    'incoming-call': IncomingCallModal, // ★ v0.67 AI 来电弹窗
    // ★ v0.50 回复提示词编辑弹窗(新增 / 编辑共用的 Vue 组件 modal)
    'edit-reply-prompt': EditReplyPromptModal,
    // ★ v0.57 系统 prompt 编辑弹窗(只编辑「回复须知」)
    'system-prompt-edit': SystemPromptEditModal,
    // ★ v0.61.8 App Prompt 预览编辑器(预览卡片 + JSON 文本框 + 复制/编辑/保存/复原)
    'app-prompt-preview': AppPromptPreviewModal,
    // ★ v0.61.8.11 上下文长度设置弹窗
    'context-length': ContextLengthModal,
    // ★ v0.88 K 链记忆设置弹窗
    'k-chain': KChainModal,
    'context-mode-editor': ContextModeEditorModal, // ★ v0.72 当前模式提示词编辑弹窗
};

// ============================================================
// ★ v0.50 回复提示词编辑弹窗(定义在 CHAT_MODAL_COMPONENTS 之后注册会触发 TDZ,
//   这里**重新挪到这里**——必须放在注册表之前,否则 chat-modal-components.js:1705
//   报「Cannot access 'EditReplyPromptModal' before initialization」)
// ============================================================
// ============================================================

// 导出组件引用(方便直接使用)

// ============================================================
// ★ v0.62.1 API 调用设置弹窗 (v0.69+ AcModal)
//   - 复用弹窗范式(跟 image-picker / context-length / ai-remark 同款)
//   - 不再走详情页,弹出即用,选完即关
//   - 列出当前 AI 人设 + 用户人设绑定的所有 API Key / Group
//     - AI 人设 → aiPerson.boundResources.apiRefs[]
//     - 用户人设 → defaultUserCard / activeUser.boundResources.apiRefs[]
//   - 选默认 API → localStorage(xiaoting::chat-default-api-key::{aiPersonId}) 持久化
//   - 空状态:引导跳到 settings 的 AI 人设编辑器
// ============================================================

const ApiCallModal = {
    name: 'ApiCallModal',
    components: { AcModal },
    props: {
        aiPersonId: { type: String, default: '' },
        contactName: { type: String, default: '' },
        defaultRefId: { type: String, default: '' },
        refs: { type: Array, default: () => [] }, // [{ refId, type:'key'|'group', label, model, baseUrl, enabled, source:'ai'|'user' }]
    },
    emits: ['close', 'select'],
    data() {
        return {
            selectedRefId: String(this.defaultRefId || ''),
            isSaving: false,
        };
    },
    computed: {
        modalTitle() {
            const name = this.contactName || this.aiPersonId || 'AI';
            return `${name} · API 调用`;
        },
        aiRefs() {
            return (this.refs || []).filter((r) => r.source === 'ai');
        },
        userRefs() {
            return (this.refs || []).filter((r) => r.source === 'user');
        },
        hasAnyRefs() {
            return (this.refs || []).length > 0;
        },
    },
    methods: {
        onPick(refId) {
            this.selectedRefId = refId;
        },
        onConfirm() {
            if (!this.selectedRefId || this.isSaving) return;
            this.isSaving = true;
            const t = (this.refs.find((r) => r.refId === this.selectedRefId) || {}).type || 'key';
            this.$emit('select', this.selectedRefId, t);
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 200);
        },
        onClear() {
            if (this.isSaving) return;
            this.selectedRefId = '';
            this.$emit('select', '', 'key');
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 200);
        },
        onGoBindSettings() {
            // 跳到 settings 的 AI 人设编辑器
            try {
                document.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'openApp', targetAppId: 'settings', pageId: `persona-ai-${this.aiPersonId}` },
                    bubbles: true,
                }));
            } catch (_) {}
            this.$emit('close');
        },
        onManageApi() {
            try {
                document.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'openApp', targetAppId: 'settings', pageId: 'api-manager' },
                    bubbles: true,
                }));
            } catch (_) {}
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="api-call-modal"
            :title="modalTitle"
            :subtitle="'长按发送按钮时调用「默认 API」回复'"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'380px'"
            @close="$emit('close')"
        >
            <!-- 主体内容 -->
            <div class="api-call-modal-body">
                <template v-if="hasAnyRefs">
                    <div v-if="aiRefs.length" class="api-call-section">
                        <div class="api-call-section-title">AI 人设绑定 <span class="api-call-section-count">{{ aiRefs.length }}</span></div>
                        <div
                            v-for="ref in aiRefs"
                            :key="'ai-' + ref.refId"
                            class="api-call-row"
                            :class="{ 'is-selected': selectedRefId === ref.refId, 'is-disabled': ref.enabled === false }"
                            @click="ref.enabled !== false && onPick(ref.refId)"
                        >
                            <div class="api-call-radio" :class="{ 'is-checked': selectedRefId === ref.refId }">
                                <svg v-if="selectedRefId === ref.refId" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                            <div class="api-call-row-body">
                                <div class="api-call-row-title">
                                    {{ ref.label }}
                                    <span v-if="!ref.enabled" class="api-call-row-status">已停用</span>
                                </div>
                                <div class="api-call-row-sub">{{ ref.type === 'key' ? (ref.model || '未设置模型') : '组 · 含 ' + (ref.keyCount || 0) + ' 个 Key' }}</div>
                            </div>
                            <span class="api-call-row-tag">{{ ref.type === 'key' ? 'Key' : '组' }}</span>
                        </div>
                    </div>

                    <div v-if="userRefs.length" class="api-call-section">
                        <div class="api-call-section-title">用户人设绑定 <span class="api-call-section-count">{{ userRefs.length }}</span></div>
                        <div
                            v-for="ref in userRefs"
                            :key="'user-' + ref.refId"
                            class="api-call-row"
                            :class="{ 'is-selected': selectedRefId === ref.refId, 'is-disabled': ref.enabled === false }"
                            @click="ref.enabled !== false && onPick(ref.refId)"
                        >
                            <div class="api-call-radio" :class="{ 'is-checked': selectedRefId === ref.refId }">
                                <svg v-if="selectedRefId === ref.refId" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                            <div class="api-call-row-body">
                                <div class="api-call-row-title">
                                    {{ ref.label }}
                                    <span v-if="!ref.enabled" class="api-call-row-status">已停用</span>
                                </div>
                                <div class="api-call-row-sub">{{ ref.type === 'key' ? (ref.model || '未设置模型') : '组 · 含 ' + (ref.keyCount || 0) + ' 个 Key' }}</div>
                            </div>
                            <span class="api-call-row-tag">{{ ref.type === 'key' ? 'Key' : '组' }}</span>
                        </div>
                    </div>
                </template>

                <template v-else>
                    <div class="api-call-empty">
                        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#A8C8EC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="32" cy="32" r="28"/>
                            <path d="M22 32l8 8 14-16"/>
                        </svg>
                        <div class="api-call-empty-title">尚未绑定任何 API</div>
                        <div class="api-call-empty-hint">前往设置 → AI 人设 → 资源绑定 → 添加 API Key</div>
                        <button class="api-call-cta" @click="onGoBindSettings">去设置绑定</button>
                    </div>
                </template>
            </div>

            <!-- 底部按钮 -->
            <template #footer>
                <template v-if="hasAnyRefs">
                    <button class="ac-btn ac-btn-secondary" type="button" @click="onManageApi">管理 Key</button>
                    <button class="ac-btn ac-btn-secondary" type="button" @click="onClear" :disabled="!defaultRefId">清除默认</button>
                </template>
                <button
                    class="ac-btn ac-btn-primary api-call-confirm-btn"
                    type="button"
                    @click="onConfirm"
                    :disabled="!selectedRefId || isSaving"
                >
                    {{ isSaving ? '保存中…' : '设为默认' }}
                </button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.74 添加层级弹窗(迁移到 AcModal)
//   - 替代原先 index.js 里 document.createElement + body.appendChild 的野生 DOM 写法
//   - 由 chat-modal-registry.openAddLevel 统一 dispatch
//   - 业务样式复用 .reply-prompt-* (跟 EditReplyPromptModal / SystemPromptEditModal 同款)
// ============================================
const AddLevelModal = {
    name: 'AddLevelModal',
    components: { AcModal },
    props: {
        levels: { type: Array, default: () => [] },  // 现有层级,渲染「在 X 之后」选项
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            position: '',          // 'after-<id>' | 'append'
            name: '',
            cycle: 14,
        };
    },
    computed: {
        // ★ v0.75 转为升序(小周期在前)用于选项和校验逻辑
        safeLevels() {
            return (Array.isArray(this.levels) ? this.levels : [])
                .map((l) => ({
                    id: String(l.id || ''),
                    name: String(l.name || ''),
                    cycle: Math.max(1, Number(l.cycle) || 1),
                }))
                .sort((a, b) => (Number(a.cycle) || 0) - (Number(b.cycle) || 0));
        },
        positionOptions() {
            return this.safeLevels.map((l) => ({
                value: `after-${l.id}`,
                label: `在 ${l.name} 之后`,
            }));
        },
        hintState() {
            // 'success' | 'error' | 'idle'
            const cycle = Math.max(1, Math.floor(Number(this.cycle) || 0));
            if (!cycle) return 'error';
            const value = cycle;
            if (this.position === 'append') {
                const max = this.safeLevels.reduce((m, l) => Math.max(m, l.cycle), 0);
                return value > max ? 'success' : 'error';
            }
            const m = /^after-(.+)$/.exec(this.position || '');
            if (!m) return 'idle';
            const anchor = this.safeLevels.find((l) => l.id === m[1]);
            if (!anchor) return 'error';
            if (value <= anchor.cycle) return 'error';
            const idx = this.safeLevels.findIndex((l) => l.id === m[1]);
            const lower = this.safeLevels[idx + 1];
            if (lower && value >= lower.cycle) return 'error';
            return 'success';
        },
        hintText() {
            const cycle = Math.max(1, Math.floor(Number(this.cycle) || 0));
            if (!cycle) return '周期必须 ≥ 1';
            const value = cycle;
            if (this.position === 'append') {
                const max = this.safeLevels.reduce((m, l) => Math.max(m, l.cycle), 0);
                return value > max ? `必须 > 当前最上层周期(${max})` : `必须 > 当前最上层周期(${max})`;
            }
            const m = /^after-(.+)$/.exec(this.position || '');
            if (!m) return '请选择位置';
            const anchor = this.safeLevels.find((l) => l.id === m[1]);
            if (!anchor) return '';
            const idx = this.safeLevels.findIndex((l) => l.id === m[1]);
            const lower = this.safeLevels[idx + 1];
            if (value <= anchor.cycle) return `必须 > ${anchor.name} 周期(${anchor.cycle})`;
            if (lower && value >= lower.cycle) return `必须 < ${lower.name} 周期(${lower.cycle})`;
            return '✓ 合法';
        },
        canConfirm() {
            return this.hintState === 'success' && this.name.trim().length > 0;
        },
    },
    mounted() {
        // 默认插入位置:第一层之后(若没有层级则追加到最上层)
        if (this.safeLevels.length > 0) {
            this.position = `after-${this.safeLevels[0].id}`;
        } else {
            this.position = 'append';
        }
    },
    methods: {
        onConfirm() {
            if (!this.canConfirm) return;
            this.$emit('confirm', {
                name: this.name.trim() || '新层级',
                cycle: Math.max(1, Math.floor(Number(this.cycle) || 1)),
                position: this.position,
            });
        },
        onCancel() { this.$emit('close'); },
    },
    template: `
        <AcModal
            class="add-level-modal"
            title="添加层级"
            subtitle="在已有层级之间插入新层级,新层初始存量为 0"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'340px'"
            @close="onCancel"
        >
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">插入位置</label>
                <select v-model="position" class="reply-prompt-select">
                    <option v-for="opt in positionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    <option value="append">追加到最上层</option>
                </select>
            </div>
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">层级名称</label>
                <input
                    type="text"
                    class="reply-prompt-input"
                    v-model="name"
                    placeholder="例如:季概要"
                />
            </div>
            <div class="reply-prompt-field">
                <label class="reply-prompt-label">周期(天)</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input
                        type="number"
                        class="reply-prompt-input"
                        v-model.number="cycle"
                        min="1"
                        step="1"
                        style="flex:1;"
                    />
                    <span style="font-size:13px;color:#8896a8;">天</span>
                </div>
                <div class="reply-prompt-hint" :class="{ 'is-success': hintState === 'success', 'is-error': hintState === 'error' }">
                    {{ hintText }}
                </div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canConfirm" @click="onConfirm">添加</button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.75 删除层级确认弹窗(AcModal)
//   - 替代 index.js 里 window.__phoneConfirm.request 的野生确认弹窗
//   - 由 chat-modal-registry.openRemoveLevelConfirm 统一 dispatch
//   - 风格跟 AddLevelModal 对齐(粉蓝云朵)
// ============================================
const RemoveLevelConfirmModal = {
    name: 'RemoveLevelConfirmModal',
    components: { AcModal },
    props: {
        levelName: { type: String, default: '' },
    },
    emits: ['close', 'confirm'],
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="remove-level-confirm-modal"
            title="确认删除"
            :subtitle="\`删除 \${levelName} 后该层概要将标记为已删除(数据保留可恢复),上层自动降级\`"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'300px'"
            @close="onCancel"
        >
            <div class="remove-level-confirm-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
            </div>
            <div class="remove-level-confirm-hint">
                此操作不可撤销
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-danger" @click="onConfirm">删除</button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.75 修改周期确认弹窗(AcModal)
//   - 替代 index.js 里 window.__phoneConfirm.request 的野生确认弹窗
//   - 由 chat-modal-registry.openUpdateLevelCycleConfirm 统一 dispatch
//   - 风格跟 AddLevelModal 对齐(粉蓝云朵)
// ============================================
const UpdateLevelCycleConfirmModal = {
    name: 'UpdateLevelCycleConfirmModal',
    components: { AcModal },
    props: {
        levelName: { type: String, default: '' },
        oldCycle: { type: Number, default: 0 },
        newCycle: { type: Number, default: 0 },
    },
    emits: ['close', 'confirm'],
    computed: {
        levelNameDisplay() {
            return this.levelName || '该层级';
        },
    },
    methods: {
        onConfirm() {
            this.$emit('confirm');
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="update-level-cycle-confirm-modal"
            title="确认修改周期"
            :subtitle="\`修改后该层所有存量清零,从下层已压缩数量重新开始计数\`"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'300px'"
            @close="onCancel"
        >
            <div class="update-level-cycle-compare">
                <div class="update-level-cycle-side">
                    <div class="update-level-cycle-label">原周期</div>
                    <div class="update-level-cycle-value">{{ oldCycle }}<span class="update-level-cycle-unit">天</span></div>
                </div>
                <div class="update-level-cycle-arrow">→</div>
                <div class="update-level-cycle-side">
                    <div class="update-level-cycle-label">新周期</div>
                    <div class="update-level-cycle-value update-level-cycle-value--new">{{ newCycle }}<span class="update-level-cycle-unit">天</span></div>
                </div>
            </div>
            <div class="update-level-cycle-level-name">
                层级: {{ levelNameDisplay }}
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onConfirm">确认修改</button>
            </template>
        </AcModal>
    `,
};

// ============================================================
// ★ 通用选项弹窗(选择列表项)
//   - 用于群聊 API 设置时选择 AI 成员
//   - 可复用为其他列表选择场景
// ============================================================

const ChoiceModal = {
    name: 'ChoiceModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        items: { type: Array, default: () => [] }, // [{ id, label, savedLabel, subLabel, isUser }]
    },
    emits: ['select', 'close'],
    methods: {
        onSelect(item) {
            window.__appNavigation?.emitChatComponentEvent('select', item.id);
        },
        onClose() {
            window.__appNavigation?.emitChatComponentEvent('close');
        },
    },
    template: `
        <AcModal
            class="choice-modal"
            :title="title"
            :subtitle="subtitle"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'320px'"
            @close="onClose"
        >
            <div class="choice-list">
                <div
                    v-for="item in items"
                    :key="item.id"
                    class="choice-item"
                    :class="{
                        'choice-item-user': item.isUser,
                        'choice-item-disabled': item.disabled,
                    }"
                    @click="!item.disabled && onSelect(item)"
                >
                    <div class="choice-item-main">
                        <span class="choice-item-label">{{ item.label }}</span>
                        <span v-if="item.subLabel" class="choice-item-sub">{{ item.subLabel }}</span>
                        <span v-else-if="item.savedLabel" class="choice-item-sub">{{ item.savedLabel }}</span>
                        <span v-else-if="item.description" class="choice-item-sub">{{ item.description }}</span>
                    </div>
                    <svg v-if="!item.isUser && !item.disabled" class="choice-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                    <span v-else-if="item.isUser" class="choice-item-badge">本人</span>
                </div>
            </div>
        </AcModal>
    `,
};

// ============================================================
// ★ v0.79 可读取朋友圈设置弹窗(MomentsReadModal)
//   - 入口:聊天设置 → 「可读取朋友圈」行
//   - 3 个数值:自己(AI 已发朋友圈)/用户(USER_MOMENTS_INSTRUCTIONS 里喂给 AI 的条数)/交际圈(预留)
//   - 风格:AcModal(粉蓝云朵),仿 ContextLengthModal 数字步进器
//   - 保存:onSave({ self, user, social }) → 业务方写回 contact.momentsReadConfig
// ============================================================
const MomentsReadModal = {
    name: 'MomentsReadModal',
    components: { AcModal },
    props: {
        aiPersonId: { type: String, default: '' },
        contactName: { type: String, default: '' },
        // 当前值 { self, user, social },缺省 3
        currentValue: { type: Object, default: () => ({ self: 3, user: 3, social: 3 }) },
    },
    emits: ['close', 'save'],
    data() {
        return {
            self: this._safe(this.currentValue?.self, 3),
            user: this._safe(this.currentValue?.user, 3),
            social: this._safe(this.currentValue?.social, 3),
            isSaving: false,
        };
    },
    computed: {
        // 3 行:自己 / 用户 / 交际圈
        rows() {
            return [
                { key: 'self', label: '自己', sub: 'aiPerson.moments[] 摘要喂给 AI 的条数', value: this.self },
                { key: 'user', label: '用户', sub: '用户朋友圈喂给 AI 的条数', value: this.user },
                { key: 'social', label: '交际圈', sub: '交际圈朋友动态条数(预留)', value: this.social },
            ];
        },
    },
    methods: {
        _safe(v, fallback) {
            const n = parseInt(v, 10);
            if (!Number.isInteger(n) || n < 0 || n > 99) return fallback;
            return n;
        },
        _ensureRange(key) {
            const max = 20;
            if (this[key] < 0) this[key] = 0;
            if (this[key] > max) this[key] = max;
        },
        onDecrease(key) {
            if (this[key] > 0) this[key] -= 1;
        },
        onIncrease(key) {
            const max = 20;
            if (this[key] < max) this[key] += 1;
        },
        onInput(key, e) {
            const raw = String(e?.target?.value || '');
            const n = parseInt(raw, 10);
            if (!isNaN(n) && n >= 0 && n <= 20) {
                this[key] = n;
            }
        },
        onSave() {
            if (this.isSaving) return;
            this._ensureRange('self');
            this._ensureRange('user');
            this._ensureRange('social');
            this.isSaving = true;
            this.$emit('save', {
                self: this.self,
                user: this.user,
                social: this.social,
            });
            setTimeout(() => {
                this.isSaving = false;
                this.$emit('close');
            }, 300);
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="moments-read-modal"
            title="可读取朋友圈"
            subtitle="设置每条朋友圈动态拼接到 AI 上下文的最大条数"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="$emit('close')"
        >
            <div class="moments-read-list">
                <div v-for="row in rows" :key="row.key" class="moments-read-row">
                    <div class="moments-read-row__info">
                        <div class="moments-read-row__label">{{ row.label }}</div>
                        <div class="moments-read-row__sub">{{ row.sub }}</div>
                    </div>
                    <div class="moments-read-counter">
                        <button type="button" class="moments-read-btn"
                            @click="onDecrease(row.key)" :disabled="row.value <= 0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </button>
                        <input type="number" class="moments-read-input"
                            :value="row.value"
                            min="0" max="20"
                            @input="onInput(row.key, $event)" />
                        <button type="button" class="moments-read-btn"
                            @click="onIncrease(row.key)" :disabled="row.value >= 20">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                <line x1="5" y1="12" x2="19" y2="12"/>
                                <line x1="12" y1="5" x2="12" y2="19"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="isSaving" @click="onSave">保存</button>
            </template>
        </AcModal>
    `,
};

// ============================================================
// ★ v0.79 AI 朋友圈概要详情查看弹窗(AiMomentsDetailModal)
//   - 入口:聊天设置 → 「朋友圈管理」行
//   - 列出 aiPerson.moments[] 全部条目(完整原文 + 概要)
//   - 每条概要可手动编辑 / 重生成 / 删除
//   - 「重生成」调 chat-asset-service.regenerateMomentSummary
//   - 「保存概要」调 sdk.moments.setSummary
//   - 「删除」调 sdk.moments.remove
//   - 数据源变化(添加 / 删除 / 编辑概要) → onChange 回调让调用方整页重画
//   - 风格:AcModal 粉蓝云朵 + 列表滚动
// ============================================================
const AiMomentsDetailModal = {
    name: 'AiMomentsDetailModal',
    components: { AcModal },
    props: {
        aiPersonId: { type: String, default: '' },
        contactName: { type: String, default: '' },
        // 初始列表(从 sdk.moments.list 拉)
        initialMoments: { type: Array, default: () => [] },
        // onChange(payload) → 任意数据变化时通知调用方
        // payload: { type: 'regenerate'|'save'|'delete'|'reload', momentId?, summary? }
    },
    emits: ['close', 'change'],
    data() {
        return {
            // 本地副本(用户编辑时立刻反映在 UI,save 后才落盘)
            moments: (Array.isArray(this.initialMoments) ? this.initialMoments : []).map((m) => ({ ...m })),
            // 正在「重生成概要」的 momentId 集合(用于 spinner)
            generating: {},
            // 详情展开的 momentId
            expanded: {},
            // 单条概要 textarea 编辑内容(尚未保存)
            editingSummary: {},
        };
    },
    computed: {
        sortedMoments() {
            return this.moments.slice().sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
        },
        summaryCount() {
            return this.moments.filter((m) => m && m.summary).length;
        },
    },
    methods: {
        _formatTime(ts) {
            if (!ts) return '';
            const d = new Date(Number(ts));
            if (Number.isNaN(d.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        toggleExpand(id) {
            this.expanded = { ...this.expanded, [id]: !this.expanded[id] };
        },
        onSummaryInput(id, e) {
            const next = String(e?.target?.value || '');
            this.editingSummary = { ...this.editingSummary, [id]: next };
        },
        isSummaryDirty(m) {
            const draft = this.editingSummary[m.id];
            if (draft === undefined) return false;
            return draft !== (m.summary || '');
        },
        async saveSummary(m) {
            const draft = this.editingSummary[m.id];
            if (draft === undefined) return;
            const next = String(draft || '').trim();
            try {
                const sdk = window.settingsSdk;
                if (!sdk?.moments?.setSummary) throw new Error('SDK 未就绪');
                await sdk.moments.setSummary(this.aiPersonId, m.id, next);
                // 更新本地副本
                this.moments = this.moments.map((x) => (x.id === m.id ? { ...x, summary: next } : x));
                // 清掉 draft
                const { [m.id]: _omit, ...rest } = this.editingSummary;
                this.editingSummary = rest;
                this.$emit('change', { type: 'save', momentId: m.id, summary: next });
            } catch (err) {
                console.warn('[AiMomentsDetailModal] saveSummary failed', err);
                if (window.__phoneIsland?.notify) {
                    window.__phoneIsland.notify('error', '保存概要失败', err?.message || '');
                }
            }
        },
        async regenerateSummary(m) {
            this.generating = { ...this.generating, [m.id]: true };
            try {
                const { regenerateMomentSummary } = await import('../services/chat-asset-service.js');
                const res = await regenerateMomentSummary({
                    aiPersonId: this.aiPersonId,
                    momentId: m.id,
                });
                if (res?.ok) {
                    const next = String(res.summary || '').trim();
                    this.moments = this.moments.map((x) => (x.id === m.id ? { ...x, summary: next } : x));
                    // 清掉 draft
                    const { [m.id]: _omit, ...rest } = this.editingSummary;
                    this.editingSummary = rest;
                    this.$emit('change', { type: 'regenerate', momentId: m.id, summary: next });
                } else {
                    if (window.__phoneIsland?.notify) {
                        window.__phoneIsland.notify('error', '重生成概要失败', res?.error || '');
                    }
                }
            } catch (err) {
                console.warn('[AiMomentsDetailModal] regenerateSummary failed', err);
            } finally {
                const { [m.id]: _omit, ...rest } = this.generating;
                this.generating = rest;
            }
        },
        async deleteMoment(m) {
            const ok = window.confirm
                ? window.confirm('删除这条朋友圈?删除后无法恢复。')
                : true;
            if (!ok) return;
            try {
                const sdk = window.settingsSdk;
                if (!sdk?.moments?.remove) throw new Error('SDK 未就绪');
                await sdk.moments.remove(this.aiPersonId, m.id);
                this.moments = this.moments.filter((x) => x.id !== m.id);
                this.$emit('change', { type: 'delete', momentId: m.id });
            } catch (err) {
                console.warn('[AiMomentsDetailModal] deleteMoment failed', err);
                if (window.__phoneIsland?.notify) {
                    window.__phoneIsland.notify('error', '删除失败', err?.message || '');
                }
            }
        },
        onClose() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="ai-moments-detail-modal"
            title="AI 朋友圈概要"
            :subtitle="contactName ? (contactName + ' · 共 ' + moments.length + ' 条 · ' + summaryCount + ' 条已生成概要') : ('共 ' + moments.length + ' 条 · ' + summaryCount + ' 条已生成概要')"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'520px'"
            :max-height="'80vh'"
            @close="onClose"
        >
            <div class="ai-moments-list">
                <div v-if="moments.length === 0" class="ai-moments-empty">
                    <div class="ai-moments-empty__icon">📷</div>
                    <div class="ai-moments-empty__title">还没有发过朋友圈</div>
                    <div class="ai-moments-empty__sub">AI 在对话中输出 [发朋友圈:内容] 就会自动生成一条</div>
                </div>
                <div
                    v-for="m in sortedMoments"
                    :key="m.id"
                    class="ai-moments-item"
                    :class="{ 'is-expanded': expanded[m.id] }"
                >
                    <div class="ai-moments-item__head" @click="toggleExpand(m.id)">
                        <div class="ai-moments-item__time">{{ _formatTime(m.timestamp) }}</div>
                        <div class="ai-moments-item__content">{{ m.content }}</div>
                        <div class="ai-moments-item__meta">
                            <span v-if="m.images && m.images.length > 0" class="ai-moments-tag">图片 × {{ m.images.length }}</span>
                            <span v-else-if="m.aiImages && m.aiImages.length > 0" class="ai-moments-tag">AI 图 × {{ m.aiImages.length }}</span>
                            <span v-if="m.location" class="ai-moments-tag">📍 {{ m.location }}</span>
                            <span class="ai-moments-tag" :class="{ 'is-on': m.summary }">概要 {{ m.summary ? '已生成' : '待生成' }}</span>
                        </div>
                        <div class="ai-moments-item__arrow" :class="{ 'is-open': expanded[m.id] }">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div v-if="expanded[m.id]" class="ai-moments-item__body">
                        <div class="ai-moments-field">
                            <div class="ai-moments-field__label">概要正文(用户看不到原文,只看到概要;概要注入到 AI prompt 防止重复主题)</div>
                            <textarea
                                class="ai-moments-textarea"
                                :value="editingSummary[m.id] !== undefined ? editingSummary[m.id] : (m.summary || '')"
                                spellcheck="false"
                                rows="3"
                                placeholder="点击「重生成」让系统自动提取,或手动填写 1~2 句"
                                @input="onSummaryInput(m.id, $event)"
                            ></textarea>
                            <div class="ai-moments-field__actions">
                                <button
                                    type="button"
                                    class="ac-btn ac-btn-secondary ai-moments-btn"
                                    :disabled="!!generating[m.id]"
                                    @click="regenerateSummary(m)"
                                >{{ generating[m.id] ? '生成中…' : '重生成概要' }}</button>
                                <button
                                    type="button"
                                    class="ac-btn ac-btn-primary ai-moments-btn"
                                    :disabled="!isSummaryDirty(m)"
                                    @click="saveSummary(m)"
                                >保存概要</button>
                            </div>
                        </div>
                        <div class="ai-moments-footer">
                            <button
                                type="button"
                                class="ac-btn ac-btn-danger ai-moments-btn ai-moments-btn--danger"
                                @click="deleteMoment(m)"
                            >删除这条朋友圈</button>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onClose">关闭</button>
            </template>
        </AcModal>
    `,
};

// ============================================
// ★ v0.85 朋友圈删除确认弹窗(MomentDeleteConfirmModal)
//   - 用户朋友圈卡片点删除按钮时弹出
//   - 风格:AcModal(粉蓝云朵)
// ============================================
const MomentDeleteConfirmModal = {
    name: 'MomentDeleteConfirmModal',
    components: { AcModal },
    emits: ['close', 'confirm'],
    props: {
        momentId: { type: String, default: '' },
        momentContent: { type: String, default: '' },
    },
    methods: {
        onConfirm() {
            this.$emit('confirm', { momentId: this.momentId });
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="moment-delete-confirm-modal"
            title="删除朋友圈"
            subtitle="确定要删除这条朋友圈动态吗？此操作不可撤销"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'300px'"
            @close="onCancel"
        >
            <div class="moment-delete-confirm-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
            </div>
            <div class="moment-delete-confirm-preview" v-if="momentContent">
                <div class="moment-delete-confirm-preview-text">{{ momentContent }}</div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onCancel">取消</button>
                <button type="button" class="ac-btn ac-btn-danger" @click="onConfirm">删除</button>
            </template>
        </AcModal>
    `,
};

// ============================================
// 群成员选择器弹窗 (v0.81)
//   - 用于选择群主 / 管理员 / 任何成员
//   - 走 chatModalManager.openGroupMemberPicker
//   - props.candidates: [{ id, label, avatar, avatarBg, initial, kind, isCurrentUser, disabled, disabledReason }]
//   - props.title / props.subtitle: 顶部标题与副标题
//   - props.confirmLabel: 确认按钮文案
//   - emits.pick(memberObj) 单选确认
// ============================================
const GroupMemberPickerModal = {
    name: 'GroupMemberPickerModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '选择成员' },
        subtitle: { type: String, default: '' },
        confirmLabel: { type: String, default: '确认' },
        candidates: { type: Array, default: () => [] },
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            selectedId: '',
        };
    },
    computed: {
        hasSelection() {
            return !!this.selectedId;
        },
        selectedItem() {
            return this.candidates.find((c) => c.id === this.selectedId) || null;
        },
    },
    methods: {
        selectItem(item) {
            if (!item || item.disabled) return;
            this.selectedId = item.id;
        },
        onConfirm() {
            if (!this.selectedItem) return;
            // ★ v0.81 走框架 @confirm 路由(framework index.html 仅把 emit('confirm', ...)
            //   透过 emitChatComponentEvent('onConfirm', ...) 派发到 _chatComponentCallbacks.onConfirm)
            this.$emit('confirm', this.selectedItem);
        },
        onClose() {
            this.$emit('close');
        },
    },
    template: `
        <AcModal
            class="cgm-picker-modal"
            :show-header="false"
            :show-close="true"
            :close-on-backdrop="true"
            :max-width="'360px'"
            @close="onClose"
        >
            <div class="cgm-picker-header">
                <h2 class="ac-modal-title">{{ title }}</h2>
                <p v-if="subtitle" class="cgm-picker-sub">{{ subtitle }}</p>
            </div>

            <div class="cgm-picker-list" v-if="candidates.length > 0">
                <button
                    v-for="item in candidates"
                    :key="item.id"
                    type="button"
                    class="cgm-picker-item"
                    :class="{ 'is-selected': selectedId === item.id, 'is-disabled': item.disabled }"
                    :disabled="item.disabled"
                    @click="selectItem(item)"
                >
                    <span class="cgm-picker-avatar" :style="{ background: item.avatarBg }">
                        <img v-if="item.avatar" :src="item.avatar" alt="" />
                        <span v-else class="cgm-picker-initial">{{ item.initial || '?' }}</span>
                    </span>
                    <span class="cgm-picker-info">
                        <span class="cgm-picker-name">{{ item.label }}<span v-if="item.isCurrentUser" class="cgm-picker-me">（我）</span></span>
                        <span class="cgm-picker-tag" v-if="item.tag">{{ item.tag }}</span>
                        <span class="cgm-picker-disabled" v-if="item.disabled && item.disabledReason">{{ item.disabledReason }}</span>
                    </span>
                    <span v-if="selectedId === item.id" class="cgm-picker-check">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                </button>
            </div>
            <div v-else class="cgm-picker-empty">
                <div class="cgm-picker-empty-text">暂无可选成员</div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onClose">取消</button>
                <button
                    type="button"
                    class="ac-btn ac-btn-primary"
                    :disabled="!hasSelection"
                    @click="onConfirm"
                >{{ confirmLabel }}</button>
            </template>
        </AcModal>
    `,
};

export {
    LocationCardModal,
    LocationPickerModal,
    DescImageModal,
    DescImageSendModal,
    VoiceRecordModal,
    ModeSelectorModal,
    AiRemarkModal,
    ChatBackgroundModal,
    ForwardTargetModal,
    ChatRecordDetailModal,
    StoryArchiveSaveModal,
    StoryArchiveRestoreConfirmModal,
    StoryArchiveDeleteConfirmModal,
    MessageEditModal,
    MessageDeleteConfirmModal,
    RedpacketSendModal,
    TransferSendModal,
    RedpacketReceiveModal, // ★ v0.67
    TransferReceiveModal, // ★ v0.67
    CallSummaryModal, // ★ v0.67
    IncomingCallModal, // ★ v0.67 AI 来电弹窗
    EditReplyPromptModal, // ★ v0.50
    SystemPromptEditModal, // ★ v0.57
    AppPromptPreviewModal, // ★ v0.61.8
    ContextLengthModal, // ★ v0.61.8.11
    KChainModal, // ★ v0.88 K 链记忆设置
    ApiCallModal, // ★ v0.62.1
    AddLevelModal, // ★ v0.74 添加层级弹窗(AcModal)
    RemoveLevelConfirmModal, // ★ v0.75 删除层级确认弹窗(AcModal)
    UpdateLevelCycleConfirmModal, // ★ v0.75 修改周期确认弹窗(AcModal)
    ChoiceModal, // ★ 通用选项弹窗
    MomentsReadModal, // ★ v0.79 可读取朋友圈设置弹窗(AcModal)
    AiMomentsDetailModal, // ★ v0.79 AI 朋友圈概要详情弹窗(AcModal)
    MomentDeleteConfirmModal, // ★ v0.85 朋友圈删除确认弹窗(AcModal)
    ClearChatConfirmModal, // ★ v0.85 清空聊天记录确认弹窗(AcModal)
    ExitGroupConfirmModal, // ★ v0.85 退出群聊确认弹窗(AcModal)
    UnfavoriteConfirmModal, // ★ v0.85 取消收藏确认弹窗(AcModal)
    GroupMemberPickerModal, // ★ v0.81 群成员选择器
    AcModal, // ★ v0.69 通用弹窗组件(粉蓝云朵)
};

