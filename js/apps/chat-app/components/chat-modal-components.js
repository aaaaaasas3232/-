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

import { escapeHtml } from '@/src/core/escape.js';

const VoiceRecordModal = {
    name: 'VoiceRecordModal',
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
        <div class="voice-record-modal-overlay" @click.self="$emit('close')">
            <div class="voice-record-modal">
                <div class="voice-record-header">
                    <div class="voice-record-title">{{ title }}</div>
                    <button class="voice-record-close" @click="$emit('close')" aria-label="关闭">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

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
                    <div class="voice-record-btn-row">
                        <button class="voice-record-cancel" @click="$emit('close')">取消</button>
                        <button class="voice-record-confirm" @click="onConfirm">发送</button>
                    </div>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 地点卡片弹窗
// ============================================
const LocationCardModal = {
    name: 'LocationCardModal',
    props: {
        name: { type: String, default: '位置' },
        address: { type: String, default: '' },
        bgGradient: { type: String, default: 'linear-gradient(135deg, #E8F2FF, #D6E4FF)' },
        iconColor: { type: String, default: '#4A6FA5' },
        borderColor: { type: String, default: '#4A6FA5' },
    },
    emits: ['close', 'satisfied', 'share'],
    template: `
        <div class="location-card-modal-overlay" @click.self="$emit('close')">
            <div class="location-card-modal">
                <!-- 按钮区域 -->
                <div class="location-card-modal-actions">
                    <button class="location-card-modal-action-btn location-card-modal-action-btn-primary" :style="{ background: borderColor }" @click.stop="$emit('satisfied')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        满意
                    </button>
                    <button class="location-card-modal-action-btn" @click.stop="$emit('share')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        分享
                    </button>
                </div>
                <!-- 图片内容区域 -->
                <div class="location-card-modal-card"
                     :style="{ background: bgGradient, borderColor: borderColor }">
                    <div class="location-card-modal-card-img" :style="{ color: iconColor }">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.6;">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        <div class="location-card-modal-card-label">位置</div>
                    </div>
                </div>
                <!-- 描述文字 -->
                <div class="location-card-modal-content">
                    <div class="location-card-modal-name" :style="{ color: iconColor }">{{ name }}</div>
                    <div v-if="address" class="location-card-modal-address">{{ address }}</div>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 地点选择弹窗 (发送位置)
//   - 从世界观场所列表中选择地点
//   - 选择后发送 location 类型消息到聊天
// ============================================
const LocationPickerModal = {
    name: 'LocationPickerModal',
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
        selectLocation(loc) {
            this.selectedId = loc.id;
            this.$emit('select', {
                id: loc.id,
                name: loc.name || '未知地点',
                address: loc.placeName ? `${loc.placeName} · ${loc.name}` : loc.name,
                position: loc.position,
            });
            this.$emit('close');
        },
        handleOverlayClick(e) {
            if (e.target === e.currentTarget) {
                this.$emit('close');
            }
        },
    },
    template: `
        <div class="location-picker-modal-overlay" @click="handleOverlayClick">
            <div class="location-picker-modal">
                <!-- 标题栏 -->
                <div class="location-picker-header">
                    <span class="location-picker-title">发送位置</span>
                    <button class="location-picker-close" @click.stop="$emit('close')">取消</button>
                </div>
                <!-- 世界信息 -->
                <div class="location-picker-world" v-if="worldName">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.5">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    <span>{{ worldName }}</span>
                </div>
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
            </div>
        </div>
    `,
};

// ============================================
// 图片描述弹窗
// ============================================
const DescImageModal = {
    name: 'DescImageModal',
    props: {
        description: { type: String, default: '' },
        cardColor: { type: String, default: '#FFE4EC' },
        textColor: { type: String, default: '#D4728A' },
        borderColor: { type: String, default: '#C0607A' },
    },
    emits: ['close', 'favorite', 'share'],
    template: `
        <div class="desc-image-modal-overlay" @click.self="$emit('close')">
            <div class="desc-image-modal">
                <!-- 按钮区域 -->
                <div class="desc-image-modal-actions">
                    <button class="desc-image-modal-action-btn" @click.stop="$emit('favorite')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        收藏
                    </button>
                    <button class="desc-image-modal-action-btn" @click.stop="$emit('share')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        分享
                    </button>
                </div>
                <!-- 图片内容区域 -->
                <div class="desc-image-modal-card"
                     :style="{ background: cardColor, borderColor: borderColor }">
                    <div class="desc-image-modal-card-img" :style="{ color: textColor }">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.6;">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                        <div class="desc-image-modal-card-label">文字描述图片</div>
                    </div>
                </div>
                <!-- 描述文字 -->
                <div class="desc-image-modal-content">
                    <div class="desc-image-modal-desc">{{ description }}</div>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 发送图片弹窗 (韩风精致版)
// ============================================
const DescImageSendModal = {
    name: 'DescImageSendModal',
    props: {
        title: { type: String, default: '发送模拟图片' },
        hint: { type: String, default: '描述你想发送的图片内容' },
        placeholder: { type: String, default: '例如：阳光洒在窗台上，一只橘猫正在午睡...' },
        colors: {
            type: Array,
            default: () => [
                { name: '粉', cardColor: '#FFE4EC', textColor: '#D4728A' },
                { name: '蓝', cardColor: '#E8F2FF', textColor: '#4A6FA5' },
                { name: '绿', cardColor: '#E8F8F0', textColor: '#4CAF50' },
                { name: '紫', cardColor: '#F3E8FF', textColor: '#8B5CF6' },
                { name: '黄', cardColor: '#FFF8E1', textColor: '#FF9800' },
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
        <div class="desc-image-send-overlay" @click.self="$emit('close')">
            <div class="desc-image-send-modal">
                <div class="desc-image-send-header">
                    <div class="desc-image-send-title">{{ title }}</div>
                </div>
                <div class="desc-image-send-body">
                    <textarea
                        class="desc-image-send-textarea"
                        :placeholder="placeholder"
                        rows="3"
                        v-model="inputValue"
                    ></textarea>
                    <div class="desc-image-send-colors">
                        <div class="desc-image-send-colors-grid">
                            <button v-for="(color, index) in colors"
                                    :key="index"
                                    class="desc-image-send-color-btn"
                                    :class="{ active: index === selectedColorIndex }"
                                    :style="{ background: color.cardColor, color: color.textColor }"
                                    :title="color.name"
                                    @click="selectedColorIndex = index">
                                <span class="desc-image-send-color-dot"></span>
                                <span class="desc-image-send-color-name">{{ color.name }}</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="desc-image-send-footer">
                    <button class="desc-image-send-cancel" @click="$emit('close')">取消</button>
                    <button class="desc-image-send-confirm" @click="onConfirm">发送</button>
                </div>
            </div>
        </div>
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
// AI 备注弹窗
//   - 点击私聊页顶栏更多按钮 → 弹出备注编辑弹窗
//   - 每个 AI 可以分别给日历模式和故事模式设置不同备注
//   - 禁用 emoji 输入，只接受纯文本
// ============================================
const AiRemarkModal = {
    name: 'AiRemarkModal',
    props: {
        // 当前联系人名称（显示用）
        name: { type: String, default: '' },
        // 当前联系人头像背景色
        avatarBg: { type: String, default: '#A8C8EC' },
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
        modalTitle() {
            return '设置备注';
        },
        modalHint() {
            return '日历模式和故事模式可以设置不同的备注';
        },
        modalPlaceholder() {
            return '添加备注信息，如称呼、特征、相处方式等...';
        },
        modeLabel() {
            return this.mode === 'story' ? '故事模式' : '日历模式';
        },
        modeTagStyle() {
            return this.mode === 'story'
                ? 'background: #FFE4EC; color: #D4728A; border: 1px solid #FFB3D1;'
                : 'background: #E8F2FF; color: #4A6FA5; border: 1px solid #B3D4FF;';
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
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="ai-remark-modal-overlay" @click.self="onCancel">
            <div class="ai-remark-modal">
                <!-- 标题区 -->
                <div class="ai-remark-header">
                    <div class="ai-remark-title">{{ modalTitle }}</div>
                    <button class="ai-remark-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <!-- 联系人信息 -->
                <div class="ai-remark-contact">
                    <div class="ai-remark-avatar" :style="{ background: avatarBg }">
                        {{ name ? name.charAt(0) : '?' }}
                    </div>
                    <div class="ai-remark-contact-info">
                        <div class="ai-remark-contact-name">{{ name || '未知联系人' }}</div>
                        <div class="ai-remark-mode-tag" :style="modeTagStyle" v-if="modeLabel">
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

                <!-- 按钮区 -->
                <div class="ai-remark-actions">
                    <button class="ai-remark-btn ai-remark-btn-cancel" @click="onCancel">取消</button>
                    <button
                        class="ai-remark-btn ai-remark-btn-save"
                        :class="{ saving: isSaving }"
                        @click="onSave"
                        :disabled="isSaving"
                    >
                        <span v-if="!isSaving">保存</span>
                        <span v-else class="ai-remark-saving-text">保存中...</span>
                    </button>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 聊天背景选择弹窗（v0.29.1 - 极简版，只支持上传图片）
//   - 进入聊天设置页 → 「聊天背景」 → 弹出此弹窗
//   - 不提供纯色/渐变预设，只支持上传本地图片
//   - input[type=file] 选图片，转 dataURL，点保存写盘
//   - 顶部：「当前背景」预览区（已有图就 <img>，没图就 empty 占位）
//   - 中间：「选择图片」/「更换图片」按钮
//   - 底部：恢复默认 / 取消 / 保存 三个按钮
// ============================================
const ChatBackgroundModal = {
    name: 'ChatBackgroundModal',
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
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="chat-bg-modal-overlay" @click.self="onCancel">
            <div class="chat-bg-modal">
                <div class="chat-bg-header">
                    <div class="chat-bg-title">设置聊天背景</div>
                    <button class="chat-bg-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

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
                        <div class="chat-bg-current-label">当前背景</div>
                        <div class="chat-bg-current-img" :style="{ backgroundImage: 'url(' + activeImage + ')' }">
                            <button class="chat-bg-current-clear" type="button" @click.stop="clearBackground" aria-label="清除">×</button>
                        </div>
                    </div>

                    <div v-else class="chat-bg-current-empty">
                        <div class="chat-bg-current-label">当前背景</div>
                        <div class="chat-bg-current-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span>暂无自定义背景</span>
                        </div>
                    </div>

                    <div v-if="uploadError" class="chat-bg-upload-error">{{ uploadError }}</div>
                </div>

                <div class="chat-bg-actions">
                    <button class="chat-bg-btn chat-bg-btn-clear" @click="resetBackground" :disabled="!hasCurrentImage">
                        恢复默认
                    </button>
                    <button class="chat-bg-btn chat-bg-btn-cancel" @click="onCancel">取消</button>
                    <button
                        class="chat-bg-btn chat-bg-btn-save"
                        :class="{ saving: isSaving }"
                        @click="onSave"
                        :disabled="isSaving"
                    >
                        <span v-if="!isSaving">保存</span>
                        <span v-else>保存中...</span>
                    </button>
                </div>
            </div>
        </div>
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
    props: {
        mode: { type: String, default: 'calendar' },
        privateChats: { type: Array, default: () => [] },
        groupChats: { type: Array, default: () => [] },
        privateLabel: { type: String, default: '私聊' },
        groupLabel: { type: String, default: '群聊' },
        modeLabel: { type: String, default: '当前模式' },
    },
    emits: ['close', 'select'],
    computed: {
        modeBadgeText() {
            return this.mode === 'story' ? '故事模式' : '日历模式';
        },
        hasAnyTarget() {
            return this.privateChats.length > 0 || this.groupChats.length > 0;
        },
    },
    methods: {
        pickPrivate(target) {
            this.$emit('select', { type: 'private', id: target.id, target });
        },
        pickGroup(target) {
            this.$emit('select', { type: 'group', id: target.id, target });
        },
        onAvatarText(name = '') {
            return name ? String(name).charAt(0) : '?';
        },
    },
    template: `
        <div class="forward-target-modal-overlay" @click.self="$emit('close')">
            <div class="forward-target-modal">
                <div class="forward-target-modal-header">
                    <div class="forward-target-modal-title">选择转发目标</div>
                    <div class="forward-target-modal-mode">
                        <span class="forward-target-modal-mode-tag">{{ modeBadgeText }}</span>
                        <span class="forward-target-modal-mode-hint">仅显示{{ modeBadgeText }}下的会话</span>
                    </div>
                    <button class="forward-target-modal-close" aria-label="关闭" @click="$emit('close')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="forward-target-modal-body">
                    <!-- 私聊列表 -->
                    <div v-if="privateChats.length > 0" class="forward-target-section">
                        <div class="forward-target-section-title">{{ privateLabel }} · {{ privateChats.length }}</div>
                        <div class="forward-target-list">
                            <div
                                v-for="t in privateChats"
                                :key="t.id"
                                class="forward-target-item"
                                @click="pickPrivate(t)"
                            >
                                <div class="forward-target-avatar" :style="{ background: t.avatarBg || '#A8C8EC' }">
                                    <img v-if="t.avatar" :src="t.avatar" alt="" class="forward-target-avatar-img" />
                                    <span v-else>{{ onAvatarText(t.name) }}</span>
                                </div>
                                <div class="forward-target-meta">
                                    <div class="forward-target-name">{{ t.name || t.id }}</div>
                                    <div v-if="t.subtitle" class="forward-target-subtitle">{{ t.subtitle }}</div>
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
                </div>
            </div>
        </div>
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
        <div class="ai-remark-modal-overlay" @click.self="onCancel">
            <div class="ai-remark-modal">
                <div class="ai-remark-header">
                    <div class="ai-remark-title">编辑消息</div>
                    <button class="ai-remark-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="ai-remark-contact">
                    <div class="ai-remark-avatar" style="background: #A8C8EC;">
                        {{ senderLabel ? senderLabel.charAt(0) : '我' }}
                    </div>
                    <div class="ai-remark-contact-info">
                        <div class="ai-remark-contact-name">{{ senderLabel || '我' }} 的消息</div>
                        <div class="ai-remark-mode-tag" style="background: #E8F2FF; color: #4A6FA5; border: 1px solid #B3D4FF;">
                            {{ typeHint }}
                        </div>
                    </div>
                </div>

                <div class="ai-remark-input-group">
                    <textarea
                        class="ai-remark-textarea"
                        v-model="inputValue"
                        :maxlength="maxLength"
                        :disabled="!editable"
                        placeholder="输入新内容..."
                        rows="4"
                    ></textarea>
                    <div class="ai-remark-char-count" :class="charCountClass">
                        {{ charCount }} / {{ maxLength }}
                    </div>
                </div>

                <div class="ai-remark-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>编辑后对方能看到「已编辑」标记</span>
                </div>

                <div class="ai-remark-actions">
                    <button class="ai-remark-btn ai-remark-btn-cancel" @click="onCancel">取消</button>
                    <button
                        class="ai-remark-btn ai-remark-btn-save"
                        :class="{ saving: isSaving, disabled: !canSubmit }"
                        :disabled="isSaving || !canSubmit"
                        @click="onSave"
                    >
                        <span v-if="!isSaving">保存</span>
                        <span v-else>保存中...</span>
                    </button>
                </div>
            </div>
        </div>
    `,
};

/**
 * 消息删除确认弹窗 (v0.44)
 *
 * 消息操作「删除」时弹出此确认弹窗
 * 复用 archive-confirm-modal 的样式
 *
 * props: 无需 props，确认即可
 *
 * emits:
 *   close
 *   confirm()
 */
const MessageDeleteConfirmModal = {
    name: 'MessageDeleteConfirmModal',
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
                <div class="archive-confirm-title">删除这条消息？</div>
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
// 红包发送弹窗 (v0.45)
// ============================================
const RedpacketSendModal = {
    name: 'RedpacketSendModal',
    props: {
        title: { type: String, default: '发红包' },
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
    },
    methods: {
        onConfirm() {
            const amount = parseFloat(this.amount);
            if (isNaN(amount) || amount <= 0) {
                window.__phoneIsland?.notify?.('warning', '请输入金额', '金额必须大于0');
                return;
            }
            this.$emit('confirm', {
                message: this.message.trim() || '恭喜发财',
                amount,
                style: this.style,
            });
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="redpacket-send-modal-overlay" @click.self="$emit('close')">
            <div class="redpacket-send-modal">
                <div class="redpacket-send-header">
                    <div class="redpacket-send-title">{{ title }}</div>
                    <button class="redpacket-send-close" @click="$emit('close')" aria-label="关闭">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
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
                </div>
                <div class="redpacket-send-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>红包将在接收时自动拆开</span>
                </div>
                <div class="redpacket-send-actions">
                    <button class="redpacket-send-btn" @click="onConfirm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        塞钱进红包
                    </button>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// 转账发送弹窗 (v0.45)
// ============================================
const TransferSendModal = {
    name: 'TransferSendModal',
    props: {
        title: { type: String, default: '转账' },
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
    },
    methods: {
        onConfirm() {
            const amount = parseFloat(this.amount);
            if (isNaN(amount) || amount <= 0) {
                window.__phoneIsland?.notify?.('warning', '请输入金额', '金额必须大于0');
                return;
            }
            this.$emit('confirm', {
                amount,
                note: this.note.trim() || '转账',
            });
        },
        onCancel() {
            this.$emit('close');
        },
    },
    template: `
        <div class="transfer-send-modal-overlay" @click.self="$emit('close')">
            <div class="transfer-send-modal">
                <div class="transfer-send-header">
                    <div class="transfer-send-title">{{ title }}</div>
                    <button class="transfer-send-close" @click="$emit('close')" aria-label="关闭">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
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
                </div>
                <div class="transfer-send-actions">
                    <button class="transfer-send-btn" @click="onConfirm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                        确认转账 ¥{{ amountDisplay }}
                    </button>
                </div>
            </div>
        </div>
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
            this.$emit('viewDetail');
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
    props: {
        initial: {
            type: Object,
            default: () => ({ title: '', content: '', source: 'custom', active: true }),
        },
        isCreate: { type: Boolean, default: false },
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
    },
    methods: {
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
    },
    template: `
        <div class="reply-prompt-modal-overlay" @click.self="onCancel">
            <div class="reply-prompt-modal">
                <div class="reply-prompt-header">
                    <div class="reply-prompt-title">{{ modalTitle }}</div>
                    <button class="reply-prompt-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="reply-prompt-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>{{ modalHint }}</span>
                </div>
                <div class="reply-prompt-field">
                    <label class="reply-prompt-label">标题 <span class="reply-prompt-required">*</span></label>
                    <input type="text" class="reply-prompt-input" v-model="title"
                        :maxlength="titleMax" placeholder="例如:温暖陪伴风格"/>
                    <div class="reply-prompt-counter">{{ titleCount }} / {{ titleMax }}</div>
                </div>
                <div class="reply-prompt-field">
                    <label class="reply-prompt-label">来源</label>
                    <select class="reply-prompt-select" v-model="source">
                        <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                </div>
                <div class="reply-prompt-field reply-prompt-toggle-row">
                    <span class="reply-prompt-label">启用</span>
                    <button type="button"
                        class="reply-prompt-toggle" :class="{ 'on': active }"
                        :aria-pressed="active"
                        @click="toggleActive">
                        <span class="reply-prompt-toggle-track">
                            <span class="reply-prompt-toggle-thumb"></span>
                        </span>
                    </button>
                </div>
                <div class="reply-prompt-field">
                    <label class="reply-prompt-label">正文(完整 prompt)</label>
                    <textarea class="reply-prompt-textarea" v-model="content"
                        :maxlength="contentMax"
                        placeholder="例如:回复时尽量短句,1~2 句话即可。结尾可以用「啦」「呢」「嗯嗯」..."
                        rows="6"></textarea>
                    <div class="reply-prompt-counter">{{ contentCount }} / {{ contentMax }}</div>
                </div>
                <div class="reply-prompt-actions">
                    <button class="reply-prompt-btn reply-prompt-btn-cancel" @click="onCancel">取消</button>
                    <button class="reply-prompt-btn reply-prompt-btn-save"
                        :class="{ saving: isSaving }"
                        :disabled="!canSave"
                        @click="onSave">
                        <span v-if="!isSaving">{{ isCreate ? '新增' : '保存' }}</span>
                        <span v-else>保存中...</span>
                    </button>
                </div>
            </div>
        </div>
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
    props: {
        kind: { type: String, default: 'user' },          // 'user' | 'ai'
        aiPersonId: { type: String, default: '' },
        title: { type: String, default: '' },
        baseContent: { type: String, default: '' },       // 人设上下文快照
        replyNote: { type: String, default: '' },
        position: { type: String, default: 'after' },     // 'before' | 'after'
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
    },
    template: `
        <div class="reply-prompt-modal-overlay" @click.self="onCancel">
            <div class="reply-prompt-modal">
                <div class="reply-prompt-header">
                    <div class="reply-prompt-title">{{ modalTitle }}</div>
                    <button class="reply-prompt-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
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
                    <pre class="system-prompt-preview">{{ baseContent }}</pre>
                </div>
                <div class="reply-prompt-field">
                    <label class="reply-prompt-label">位置</label>
                    <div class="system-prompt-position-tabs">
                        <button type="button" class="system-prompt-position-tab"
                            :class="{ active: currentPosition === 'before' }"
                            @click="currentPosition = 'before'">放在人设前</button>
                        <button type="button" class="system-prompt-position-tab"
                            :class="{ active: currentPosition === 'after' }"
                            @click="currentPosition = 'after'">放在人设后</button>
                    </div>
                </div>
                <div class="reply-prompt-field">
                    <label class="reply-prompt-label">回复须知 <span class="reply-prompt-required">*</span></label>
                    <textarea class="reply-prompt-textarea" v-model="note"
                        :maxlength="noteMax"
                        placeholder="例如:请用第三人称描写对方,语气克制,称呼对方为「你」"
                        rows="4"></textarea>
                    <div class="reply-prompt-counter">{{ noteCount }} / {{ noteMax }}</div>
                </div>
                <div class="reply-prompt-field">
                    <label class="reply-prompt-label">预览(完整注入效果)</label>
                    <pre class="system-prompt-preview system-prompt-preview--live">{{ fullPreview }}</pre>
                </div>
                <div class="reply-prompt-actions">
                    <button class="reply-prompt-btn reply-prompt-btn-cancel" @click="onCancel">取消</button>
                    <button class="reply-prompt-btn reply-prompt-btn-save"
                        :class="{ saving: isSaving }"
                        :disabled="!canSave"
                        @click="onSave">
                        <span v-if="!isSaving">保存</span>
                        <span v-else>保存中...</span>
                    </button>
                </div>
            </div>
        </div>
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
        <div class="reply-prompt-modal-overlay" @click.self="onCancel">
            <div class="reply-prompt-modal app-prompt-preview-modal">
                <div class="reply-prompt-header">
                    <div class="reply-prompt-title">{{ modalTitle }}</div>
                    <button class="reply-prompt-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
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
                <div class="reply-prompt-actions app-prompt-preview-actions">
                    <button type="button" class="reply-prompt-btn reply-prompt-btn-secondary"
                        @click="onCopy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>复制</span>
                    </button>
                    <button type="button" class="reply-prompt-btn reply-prompt-btn-secondary"
                        @click="onToggleEdit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                        </svg>
                        <span>{{ isReadOnly ? '编辑' : '锁定' }}</span>
                    </button>
                    <button type="button" class="reply-prompt-btn reply-prompt-btn-secondary"
                        :disabled="!hasChanges"
                        @click="onRestore">复原</button>
                    <button type="button" class="reply-prompt-btn reply-prompt-btn-cancel"
                        @click="onCancel">取消</button>
                    <button type="button" class="reply-prompt-btn reply-prompt-btn-save"
                        :class="{ saving: isSaving }"
                        :disabled="!canSave"
                        @click="onSave">
                        <span v-if="!isSaving">保存</span>
                        <span v-else>保存中...</span>
                    </button>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// ★ v0.61.8.11 上下文长度设置弹窗(ContextLengthModal)
//   - 用于「聊天设置 → 上下文长度」行的点击弹窗
//   - 用户自定义一个「回合」数(1回合 = 1组用户消息 + 1组AI回复)
//   - 保存后写入 aiPerson.socialProfiles.chat.rollingConfig.contextRounds
//   - 用于「当前聊天回合」prompt 的范围控制
// ============================================
const ContextLengthModal = {
    name: 'ContextLengthModal',
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
        <div class="ctx-length-modal-overlay" @click.self="onCancel">
            <div class="ctx-length-modal">
                <div class="ctx-length-header">
                    <div class="ctx-length-title">上下文长度</div>
                    <button class="ctx-length-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="ctx-length-body">
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
                </div>

                <div class="ctx-length-footer">
                    <button type="button" class="ctx-length-btn-cancel" @click="onCancel">取消</button>
                    <button type="button" class="ctx-length-btn-save"
                        :disabled="!isValid || isSaving"
                        @click="onSave">
                        {{ isSaving ? '保存中...' : '保存' }}
                    </button>
                </div>
            </div>
        </div>
    `,
};

// ============================================
// ★ v0.63 滚动摘要容量设置弹窗(RollingCapacityModal)
//   - 复用 ctx-length-modal 的视觉风格(同款毛玻璃 + 蓝粉主色)
//   - 同时编辑两个数字:kMergeSize + maxChainLength
//   - 保存后写入 aiPerson.socialProfiles.chat.rollingConfig.{kMergeSize, maxChainLength}
//   - 用于控制 K 链长度(最长多少 K)/ 每多少回合压缩成一个 K
// ============================================
const RollingCapacityModal = {
    name: 'RollingCapacityModal',
    props: {
        aiPersonId: { type: String, default: '' },
        contactName: { type: String, default: '' },
        currentMergeSize: { type: Number, default: 5 },
        currentChainLength: { type: Number, default: 10 },
        mode: { type: String, default: 'calendar' },
    },
    emits: ['close', 'save'],
    data() {
        return {
            mergeSize: Number(this.currentMergeSize) || 5,
            chainLength: Number(this.currentChainLength) || 10,
            isSaving: false,
        };
    },
    computed: {
        mergeSizeValid() {
            const n = Number(this.mergeSize);
            return Number.isInteger(n) && n >= 1 && n <= 50;
        },
        chainLengthValid() {
            const n = Number(this.chainLength);
            return Number.isInteger(n) && n >= 1 && n <= 30;
        },
        isValid() {
            return this.mergeSizeValid && this.chainLengthValid;
        },
        mergeHintText() {
            if (!this.mergeSizeValid) return '合并粒度请输入 1-50 之间的整数';
            return `每 ${this.mergeSize} 回合压缩成 1 个 K`;
        },
        chainHintText() {
            if (!this.chainLengthValid) return '链长请输入 1-30 之间的整数';
            return `K 链最多保留 ${this.chainLength} 个 K`;
        },
    },
    methods: {
        decMergeSize() {
            if (this.mergeSize > 1) this.mergeSize -= 1;
        },
        incMergeSize() {
            if (this.mergeSize < 50) this.mergeSize += 1;
        },
        decChainLength() {
            if (this.chainLength > 1) this.chainLength -= 1;
        },
        incChainLength() {
            if (this.chainLength < 30) this.chainLength += 1;
        },
        onMergeInput(e) {
            const raw = String(e?.target?.value || '');
            const n = parseInt(raw, 10);
            if (!isNaN(n) && n >= 1 && n <= 50) this.mergeSize = n;
        },
        onChainInput(e) {
            const raw = String(e?.target?.value || '');
            const n = parseInt(raw, 10);
            if (!isNaN(n) && n >= 1 && n <= 30) this.chainLength = n;
        },
        onSave() {
            if (!this.isValid || this.isSaving) return;
            this.isSaving = true;
            this.$emit('save', {
                kMergeSize: Number(this.mergeSize) || 5,
                maxChainLength: Number(this.chainLength) || 10,
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
        <div class="ctx-length-modal-overlay" @click.self="onCancel">
            <div class="ctx-length-modal">
                <div class="ctx-length-header">
                    <div class="ctx-length-title">滚动摘要容量</div>
                    <button class="ctx-length-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="ctx-length-body">
                    <div class="ctx-length-desc">
                        <span>设置 K 链的合并粒度 + 最长保留多少个 K</span>
                    </div>

                    <div class="rcap-field">
                        <div class="rcap-field-label">合并粒度</div>
                        <div class="ctx-length-control">
                            <button type="button" class="ctx-length-btn ctx-length-btn--minus"
                                @click="decMergeSize" :disabled="mergeSize <= 1">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </button>

                            <div class="ctx-length-display">
                                <input type="number" class="ctx-length-input"
                                    :value="mergeSize"
                                    min="1" max="50"
                                    @input="onMergeInput" />
                                <span class="ctx-length-unit">回合</span>
                            </div>

                            <button type="button" class="ctx-length-btn ctx-length-btn--plus"
                                @click="incMergeSize" :disabled="mergeSize >= 50">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </button>
                        </div>
                        <div class="ctx-length-hint" :class="{ 'ctx-length-hint--error': !mergeSizeValid }">
                            {{ mergeHintText }}
                        </div>
                    </div>

                    <div class="rcap-field">
                        <div class="rcap-field-label">K 链长度</div>
                        <div class="ctx-length-control">
                            <button type="button" class="ctx-length-btn ctx-length-btn--minus"
                                @click="decChainLength" :disabled="chainLength <= 1">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </button>

                            <div class="ctx-length-display">
                                <input type="number" class="ctx-length-input"
                                    :value="chainLength"
                                    min="1" max="30"
                                    @input="onChainInput" />
                                <span class="ctx-length-unit">K</span>
                            </div>

                            <button type="button" class="ctx-length-btn ctx-length-btn--plus"
                                @click="incChainLength" :disabled="chainLength >= 30">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </button>
                        </div>
                        <div class="ctx-length-hint" :class="{ 'ctx-length-hint--error': !chainLengthValid }">
                            {{ chainHintText }}
                        </div>
                    </div>
                </div>

                <div class="ctx-length-footer">
                    <button type="button" class="ctx-length-btn-cancel" @click="onCancel">取消</button>
                    <button type="button" class="ctx-length-btn-save"
                        :disabled="!isValid || isSaving"
                        @click="onSave">
                        {{ isSaving ? '保存中...' : '保存' }}
                    </button>
                </div>
            </div>
        </div>
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
    // ★ v0.63 滚动摘要容量设置弹窗(K 链合并粒度 + 链长)
    'rolling-capacity': RollingCapacityModal,
};

// ============================================================
// ★ v0.50 回复提示词编辑弹窗(定义在 CHAT_MODAL_COMPONENTS 之后注册会触发 TDZ,
//   这里**重新挪到这里**——必须放在注册表之前,否则 chat-modal-components.js:1705
//   报「Cannot access 'EditReplyPromptModal' before initialization」)
// ============================================================
// ============================================================

// 导出组件引用(方便直接使用)

// ============================================================
// ★ v0.62.1 API 调用设置弹窗
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
        onCancel() {
            this.$emit('close');
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
        <div class="api-call-modal-overlay" @click.self="onCancel">
            <div class="api-call-modal">
                <div class="api-call-modal-header">
                    <div class="api-call-modal-title">{{ modalTitle }}</div>
                    <button class="api-call-modal-close" aria-label="关闭" @click="onCancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="api-call-modal-hint">
                    长按发送按钮时会调用「默认 API」回复。<br/>
                    <span class="api-call-modal-hint--sub">默认设置只对当前 AI 人设生效</span>
                </div>

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

                <div class="api-call-modal-footer">
                    <button class="api-call-foot-btn api-call-foot-btn--ghost" type="button" @click="onManageApi" v-if="hasAnyRefs">管理 Key / 组</button>
                    <button class="api-call-foot-btn api-call-foot-btn--ghost" type="button" @click="onClear" :disabled="!defaultRefId" v-if="hasAnyRefs">清除默认</button>
                    <button class="api-call-foot-btn api-call-foot-btn--primary" type="button" @click="onConfirm" :disabled="!selectedRefId || isSaving">
                        {{ isSaving ? '保存中…' : '设为默认' }}
                    </button>
                </div>
            </div>
        </div>
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
    RollingCapacityModal, // ★ v0.63
    ApiCallModal, // ★ v0.62.1
};
