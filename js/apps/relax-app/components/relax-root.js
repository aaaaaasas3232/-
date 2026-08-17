/**
 * relax-app / 根组件
 *
 * 布局:舞台常驻铺满 + 面板以「抽屉」形式盖上来 + 底部液态 tab 栏。
 *
 * ★ 为什么舞台常驻(而不是每个 tab 一个页面)
 *   解压主体大概率带动画 / 物理 / canvas。如果切 tab 就卸载舞台,
 *   每次回来主体都要重新 mount(掉状态 + 掉帧 + 重新 decode 音频)。
 *   舞台常驻 + 面板浮在上面,主体全程只挂载一次,而且改颜色时能**边改边看**。
 *
 * ★ hydrate 契约(AGENTS.md §47)
 *   framework 不会调 `app.methods.hydrate()`。所以:
 *     data()    → 同步用 store 快照(store 自带默认舞台)→ 首屏立刻有画面
 *     mounted() → subscribe + microtask 调 store.hydrate(this.app)
 *   千万别在 renderPage 的同步阶段调 hydrate,vue 模式那里没有可调的位置。
 *
 * ★ 状态流向是单向的
 *   store(唯一真相)→ subscribe → 本组件 sceneRev++ → 子组件 props
 *   子组件 emit → 本组件调 store mutator → store notify → 回到上面
 *   子组件**从不**直接改 scene 对象。
 */

import { LiquidTabBar } from './liquid-tab-bar.js';
import { RelaxStage } from './relax-stage.js';
import { ToyPanel } from './panels/toy-panel.js';
import { DecoratePanel } from './panels/decorate-panel.js';
import { SoundPanel } from './panels/sound-panel.js';
import { RxConfirmModal, RxSaveSceneModal, RxSceneLibraryModal } from './modals.js';
import { RxCustomToyPage } from './pages/custom-toy-page.js';
import * as store from '../store.js';
import {
    ensureAudioContext,
    playSoundConfig,
    playSoundPreset,
    haptic as fireHaptic,
    disposeCustomSound,
} from '../services/sound-service.js';
import {
    addCustomImage,
    addCustomSound,
    addCustomPlate,
    addCustomDecoration,
    deleteSavedScene,
    fileToDataUrl,
    listCustomImages,
    listCustomSounds,
    listCustomPlates,
    listCustomDecorations,
    listSavedScenes,
    removeCustomImage,
    removeCustomSound,
    removeCustomPlate,
    removeCustomDecoration,
    saveSceneAs,
} from '../services/scene-store.js';
import { getRelaxToy } from '../registry.js';
import { getDecoration } from '../assets/decorations.js';
import { ICON_CHEVRON_LEFT, ICON_CLOSE, ICON_FLIP, ICON_GRIP, ICON_ISLAND } from './icons.js';

const TABS = Object.freeze([
    { id: 'stage', glyph: '台', label: '舞台', color: '#e8788f' },
    { id: 'toy',   glyph: '捏', label: '捏捏', color: '#7cb8e8' },
    { id: 'decor', glyph: '妆', label: '装扮', color: '#8fc98f' },
    { id: 'sound', glyph: '音', label: '音声', color: '#e8b45b' },
]);

/*
 * ============================================================
 * 界面点击音
 * ============================================================
 * 挂在根节点的 capture pointerdown 上(跟解锁 AudioContext 复用同一个监听),
 * 而不是去每个按钮上加 @click ——
 * tab 栏、存档 chip、瓦片、色块、开关、弹窗按钮全是原生 <button>,
 * 一个委托就全覆盖了,以后加新按钮也不用记得补。
 */

/** 点在这些东西上才响。点面板空白、标题文字不响。 */
const UI_SOUND_HIT_SELECTOR = [
    'button',
    '[role="button"]',
    'a[href]',
    'input',
    'select',
    'textarea',
    'label',
    '.rx-tile',
    '.rx-chip',
].join(',');

/**
 * 这些区域**不**响:
 *   .rx-stage        —— 舞台。捏主体的声音由主体自己的 host.playSound() 负责,
 *                       再叠一层界面音就成了「捏一下响两声」。
 *   .rx-deco-bar     —— 装饰浮动工具栏,拖动时会连续触发,吵。
 *   .rx-sound-chip   —— 音色瓦片。点它本来就会试听,再叠界面音就是两声。
 *   .rx-sound-row    —— 自定义音那一行,同上。
 *   [data-ui-mute]   —— 通用逃生口:任何「自己会出声」的按钮加这个属性即可。
 */
const UI_SOUND_MUTE_SELECTOR = [
    '.rx-stage',
    '.rx-deco-bar',
    '.rx-sound-chip',
    '.rx-sound-row',
    '[data-ui-mute]',
].join(',');

/** 连点最小间隔(ms)。防止快速连点糊成一片噪音。 */
const UI_SOUND_MIN_GAP_MS = 55;

export function createRelaxRoot() {
    return {
        name: 'RelaxRoot',
        components: {
            LiquidTabBar,
            RelaxStage,
            ToyPanel,
            DecoratePanel,
            SoundPanel,
            RxConfirmModal,
            RxSaveSceneModal,
            RxSceneLibraryModal,
            RxCustomToyPage,
        },
        props: {
            app: { type: Object, required: true },
        },
        data() {
            return {
                tabs: TABS,
                activeTab: 'stage',

                /*
                 * ★ 内部视图层(不是 framework 的页面栈)
                 *   解压角只注册了一个框架页(stage),所有导航都靠自己的状态。
                 *   'custom-editor' 打开时舞台**继续挂在下面**:
                 *   主体不重挂 → 回来的时候瞬间就在,而且已经捏爆的格子还是爆的。
                 *   tab 栏 / 抽屉 / 舞台浮动条由 `.rx-root.is-editor` 一并隐藏。
                 */
                view: 'stage',
                /** 打开编辑页那一刻的快照(编辑页里改的是它的副本,不回写 store) */
                editorSeed: null,

                decorateSubTab: 'bg',
                savedScenes: [],
                audioUnlocked: false,

                // 装饰子 tab 用:进入「编辑装饰位置」模式后,面板收起,
                // 舞台全屏,装饰可拖;点装饰会浮出 mini 工具栏调整属性。
                decoEditMode: false,

                // 弹窗:同一时刻只开一个
                modal: null,   // { type, payload }

                // ---- 属性 mini 工具栏(rx-deco-bar)拖拽 ----
                // 偏移量是从「初始居中靠下」位置出发的位移。
                // 用 transform 驱动,比 left/top 改 GPU 友好,而且不会触发布局重排。
                decoBarOffsetX: 0,
                decoBarOffsetY: 0,
                decoBarDragging: false,
            };
        },
        computed: {
            // ★ store.getState() 是 Vue.reactive 对象,在 computed 里读就能自动追踪
            //   嵌套改动(scene.plate.tint 之类),不需要 rev++ 之类的假信号。
            store() {
                return store;
            },
            scene() {
                return store.getState().scene;
            },
            customSounds() {
                return store.getState().customSounds;
            },
            customImages() {
                return store.getState().customImages;
            },
            customPlates() {
                return store.getState().customPlates;
            },
            customDecorations() {
                return store.getState().customDecorations;
            },
            /** 当前选中的自定义盘子(舞台展示用) */
            activeCustomPlateRecord() {
                return store.resolveActiveCustomPlate();
            },
            activeCustomPlateUrl() {
                return this.activeCustomPlateRecord?.dataUrl || null;
            },
            selectedDecorationUid() {
                return store.getState().selectedDecorationUid;
            },
            selectedDecoration() {
                const uid = this.selectedDecorationUid;
                if (!uid) return null;
                return this.scene.decorations.find(item => item.uid === uid) || null;
            },
            selectedDecorationName() {
                if (!this.selectedDecoration) return '';
                return getDecoration(this.selectedDecoration.presetId)?.name || '';
            },
            /** 装饰子 tab 打开时才让舞台可编辑,免得玩的时候误拖 */
            stageEditable() {
                return this.activeTab === 'decor' && this.decorateSubTab === 'deco';
            },
            panelOpen() {
                // ★ 装饰子 tab 进入「编辑装饰位置」模式时,把面板也强行收起,
                //   让舞台完全暴露,装饰才好拖;此时 panelOpen=false 触发抽屉下滑。
                if (this.activeTab === 'decor' && this.decorateSubTab === 'deco' && this.decoEditMode) {
                    return false;
                }
                return this.activeTab !== 'stage';
            },
            /** 装饰子 tab + 编辑模式下选中装饰 → 浮出属性 mini 工具栏 */
            showFloatingDecoBar() {
                return this.activeTab === 'decor'
                    && this.decorateSubTab === 'deco'
                    && this.decoEditMode
                    && !!this.selectedDecoration;
            },
            /**
             * mini 工具栏的 inline style:用 transform 表达位移,
             * 让拖拽走 GPU 合成层,不会因频繁改 left/top 触发 layout / paint。
             * 初始偏移 0 → 落回 CSS 默认定位(底部居中)。
             */
            decoBarStyle() {
                return {
                    transform: `translate(${this.decoBarOffsetX}px, ${this.decoBarOffsetY}px)`,
                };
            },
            activeCustomImageUrl() {
                const record = store.resolveActiveCustomImage();
                return record?.dataUrl || null;
            },
            activeToy() {
                return this.scene.toy.id ? getRelaxToy(this.scene.toy.id) : null;
            },
            stageCaption() {
                if (this.activeToy) return this.activeToy.name;
                return '盘子空着';
            },
            /** 交给主体的能力包(见 registry.js 的 host 契约)
             *
             * ★ per-toy 声音:resolveActiveSoundConfig(toyId) 先看 toySounds 覆盖,
             *   没有再回退到 scene.sound —— 这样「全局默认 + 每个按钮单独覆盖」的
             *   语义对主体透明。主体只管 host.playSound() 就行,不需要关心是否被覆盖。
             */
            toyBridge() {
                const component = this;
                return {
                    playSound: (opts) => {
                        const toyId = component.scene.toy.id;
                        const cfg = store.resolveActiveSoundConfig(toyId);
                        const customRec = store.resolveActiveToyCustomSound(toyId);
                        component.unlockAudio();
                        playSoundConfig(cfg, customRec, opts);
                    },
                    playSoundId: (id, opts) => {
                        this.unlockAudio();
                        playSoundPreset(id, { volume: this.scene.sound.volume, ...opts });
                    },
                    haptic: (strength) => {
                        if (this.scene.sound.haptics) fireHaptic(strength);
                    },
                    notify: (type, title, message) => {
                        this.app?.toolkit?.island?.notify?.(type || 'info', title || '', message || '');
                    },
                    getToyState: () => store.getToyState(this.scene.toy.id),
                    setToyState: (patch) => store.patchToyState(this.scene.toy.id, patch),
                };
            },
        },
        watch: {
            // 选中不同装饰时,把工具栏的拖拽偏移归零,
            // 免得换了个装饰,工具栏还卡在上次拖到的角落。
            selectedDecorationUid(next, prev) {
                if (next !== prev) {
                    this.decoBarOffsetX = 0;
                    this.decoBarOffsetY = 0;
                }
            },
        },
        mounted() {
            // ★ framework 不会帮我们调 hydrate(AGENTS.md §47),自己在 microtask 里启动。
            //   放 microtask 而不是同步:让首帧先用默认舞台画出来,不卡白屏。
            Promise.resolve().then(() => store.hydrate(this.app));

            // 任何一次点击都顺手解锁 AudioContext(自动播放策略要求首次出声在用户手势里),
            // 同一个监听里顺带把「界面点击音」也放了。
            this._lastUiSoundAt = 0;
            this._unlockHandler = (event) => {
                this.unlockAudio();
                this.playUiClickSound(event);
            };
            this.$el?.addEventListener?.('pointerdown', this._unlockHandler, { capture: true });

            // ★ 防丢存档:页面被切到后台 / 浏览器即将关闭时,防抖里没落盘的改动会被吞掉。
            //   beforeUnmount 靠不住(框架切 app 时 Vue 同步 unmount,
            //   但 IndexedDB 的 put 是异步,可能没写完 tab 就被覆盖);
            //   pagehide + visibilitychange 才是真正「最后机会」:
            //   - pagehide:浏览器关闭 / tab 关闭 / 前进后退切换
            //   - visibilitychange(隐藏):用户切到别的 tab / 锁屏
            this._pageHideHandler = () => { void store.flushPersist(); };
            this._visibilityHandler = () => {
                if (document.visibilityState === 'hidden') void store.flushPersist();
            };
            window.addEventListener('pagehide', this._pageHideHandler);
            window.addEventListener('visibilitychange', this._visibilityHandler);
        },
        beforeUnmount() {
            this.$el?.removeEventListener?.('pointerdown', this._unlockHandler, { capture: true });
            if (this._pageHideHandler) {
                window.removeEventListener('pagehide', this._pageHideHandler);
                this._pageHideHandler = null;
            }
            if (this._visibilityHandler) {
                window.removeEventListener('visibilitychange', this._visibilityHandler);
                this._visibilityHandler = null;
            }
            // 离开 app 前把防抖里没落盘的改动写掉
            void store.flushPersist();
        },
        methods: {
            // ---------- 音频 ----------
            unlockAudio() {
                if (this.audioUnlocked) return;
                const ctx = ensureAudioContext();
                if (ctx) this.audioUnlocked = true;
            },

            /** 按用户当前配置播一次(主体触发 + 试听都走这里) */
            playCurrentSound(opts = {}) {
                this.unlockAudio();
                playSoundConfig(this.scene.sound, store.resolveActiveCustomSound(), opts);
            },

            /**
             * 界面点击音:点 tab / 存档 / 瓦片 / 开关等任意控件时响一下。
             * 由根节点的 capture pointerdown 委托触发,见 mounted。
             *
             * ★ 用 scene.uiSound 而不是 scene.sound —— 两套配置独立,
             *   关掉「捏的时候出声」不会把界面音一起关掉。
             */
            playUiClickSound(event) {
                const cfg = this.scene.uiSound;
                if (!cfg?.enabled) return;

                const target = event?.target;
                if (!target?.closest) return;
                if (target.closest(UI_SOUND_MUTE_SELECTOR)) return;
                if (!target.closest(UI_SOUND_HIT_SELECTOR)) return;

                const now = performance.now();
                if (now - this._lastUiSoundAt < UI_SOUND_MIN_GAP_MS) return;
                this._lastUiSoundAt = now;

                // 轻微随机音高:连点时不像复读机
                playSoundConfig(cfg, store.resolveUiCustomSound(), {
                    rate: 0.97 + Math.random() * 0.07,
                });
            },

            /** 「界面点击音」区域的试听 */
            playUiSoundPreview(payload = {}) {
                this.unlockAudio();
                const cfg = this.scene.uiSound;
                if (payload.presetId && !cfg.customId) {
                    playSoundPreset(payload.presetId, { volume: cfg.volume });
                    return;
                }
                playSoundConfig({ ...cfg, enabled: true }, store.resolveUiCustomSound());
            },

            /**
             * 面板里的试听。payload 可以指定「还没写进 store 的那个音」,
             * 因为 emit 顺序是 set-* 先、preview 后,store 已经更新了,
             * 这里直接读 store 就行;payload 只用于兜底。
             */
            onPreviewSound(payload = {}) {
                this.unlockAudio();
                if (payload.presetId && !this.scene.sound.customId) {
                    playSoundPreset(payload.presetId, { volume: this.scene.sound.volume });
                    return;
                }
                this.playCurrentSound();
            },

            // ---------- tab ----------
            onSelectTab(tabId) {
                this.activeTab = tabId;
                // 离开装扮时清掉选中态,免得回到舞台还挂着控制柄
                if (tabId !== 'decor') {
                    store.selectDecoration(null);
                    this.decoEditMode = false;
                }
                // 切到「背景/盘子」子区域时顺手退出装饰编辑模式
                if (tabId === 'decor') this.decoEditMode = false;
            },

            // ---------- 装饰编辑模式 ----------
            enterDecoEditMode() {
                this.decoEditMode = true;
                store.selectDecoration(null);
            },
            exitDecoEditMode() {
                this.decoEditMode = false;
                store.selectDecoration(null);
            },
            onSelectDecoration(uid) {
                store.selectDecoration(uid);
                // 注:**不**在这里退出 decoEditMode。
                // 装饰编辑模式下点空白处只是取消选中装饰,
                // 浮动工具栏收起、舞台继续可拖;真正退出编辑模式
                // 走「返回调整」按钮或切别的 tab。
            },
            patchSelectedDecoration(patch) {
                if (!this.selectedDecorationUid) return;
                store.updateDecoration(this.selectedDecorationUid, patch);
            },
            removeSelectedDecoration() {
                if (!this.selectedDecorationUid) return;
                store.removeDecoration(this.selectedDecorationUid);
            },

            // ---------- 属性 mini 工具栏拖拽 ----------
            /**
             * 拖工具栏:只在头部 rx-deco-bar-head 上按下才进入拖拽态,
             * 这样下面的 range / 按钮 / 颜色选择器仍能正常点击 / 滑动。
             * 用 pointer events 走一套统一的鼠标 + 触屏路径。
             */
            onDecoBarHeadPointerDown(event) {
                // 鼠标右键 / 非主指针按下 → 不接管,留给系统菜单
                if (event.button != null && event.button !== 0) return;

                const bar = this.$refs.decoBarEl;
                if (!bar) return;

                // ★ 重新浮出时把位置重置回默认(底部居中),免得拖得很偏,
                //   再选另一个装饰时还卡在角落。
                //   但**不要**在同一次会话内反复重置 —— 只在「bar 刚出现 / 选中变化」时归零。
                this.decoBarOffsetX = 0;
                this.decoBarOffsetY = 0;

                const startX = event.clientX;
                const startY = event.clientY;
                const baseX = this.decoBarOffsetX;
                const baseY = this.decoBarOffsetY;

                // 记下工具栏在舞台内的「锚框」,拖拽时把位移钳在可视区
                const parent = bar.offsetParent || bar.parentElement;
                const parentRect = parent ? parent.getBoundingClientRect() : null;
                const barRect = bar.getBoundingClientRect();

                let maxX = 0;
                let maxY = 0;
                let minX = 0;
                let minY = 0;
                if (parentRect) {
                    // ★ 不允许整块拖出舞台,左右各留 8px 余量;上下各留 8px。
                    //   translate 是相对当前位置的偏移,所以 limit 是 「舞台 - 工具栏尺寸 - 余量」。
                    maxX = (parentRect.width - barRect.width) / 2 - 8;
                    minX = -maxX;
                    maxY = (parentRect.height - barRect.height) / 2 - 8;
                    minY = -maxY;
                }

                this.decoBarDragging = true;

                // 阻止这次按下冒泡成「点选装饰」之类的事件
                event.stopPropagation();
                // 把后续 pointermove / pointerup 锁定在 head 上,
                // 即使手指 / 鼠标拖出工具栏外也照样能收到事件。
                if (event.pointerId != null && event.target?.setPointerCapture) {
                    try { event.target.setPointerCapture(event.pointerId); } catch { /* ignore */ }
                }

                const onMove = (e) => {
                    let dx = e.clientX - startX;
                    let dy = e.clientY - startY;
                    if (dx > maxX) dx = maxX;
                    else if (dx < minX) dx = minX;
                    if (dy > maxY) dy = maxY;
                    else if (dy < minY) dy = minY;
                    this.decoBarOffsetX = baseX + dx;
                    this.decoBarOffsetY = baseY + dy;
                };

                const onUp = (e) => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                    window.removeEventListener('pointercancel', onUp);
                    this.decoBarDragging = false;
                    if (e.pointerId != null && e.target?.releasePointerCapture) {
                        try { e.target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                    }
                };

                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
                window.addEventListener('pointercancel', onUp);
            },

            // ---------- 主体 ----------
            onSetToy({ id, defaultTint }) {
                store.setToy(id, defaultTint);
            },
            onResetToy() {
                store.clearToyState(this.scene.toy.id);
                // 4x4 调成 6x6 之后 cleanup 也会清,需要顺带重置行列
                this.$refs.stage?.resetToy?.();
                this.notify('success', '已恢复', this.activeToy?.name || '');
            },
            /** 用户调行/列(气池板、我的捏捏) */
            onSetToyRowsCols({ rows, cols }) {
                store.setToyRowsCols(rows, cols);
            },
            /**
             * 用户点「打开编辑器」:切到自定义编辑页。
             * ★ 只在这里读一次 toyState 当种子;编辑页内部改的是副本,
             *   没点「应用到主体」就什么都没写进 store。
             */
            onOpenCustomEditor() {
                const toyId = this.scene.toy.id;
                const saved = store.getToyState(toyId) || {};
                const layout = (saved.layout === 'free' || saved.layout === 'code') ? saved.layout : 'grid';
                this.editorSeed = {
                    html: typeof saved.html === 'string' ? saved.html : '',
                    css: typeof saved.css === 'string' ? saved.css : '',
                    // js 只有「写代码」那一档有
                    js: typeof saved.js === 'string' ? saved.js : '',
                    // 老存档里没有 layout 这一项 → 'grid',和它当年的行为一致
                    layout,
                    // 模板 id 空着交给编辑页 —— 它知道每种做法的第一套预设叫什么
                    templateId: typeof saved.activeTemplateId === 'string' ? saved.activeTemplateId : '',
                    // 老存档里没有 blueprint 这一项 → null,编辑页会自己给一份空白蓝图
                    blueprint: (saved.blueprint && typeof saved.blueprint === 'object') ? saved.blueprint : null,
                };
                this.view = 'custom-editor';
            },
            /** 编辑页点「应用到主体」 */
            onApplyCustomToy(payload) {
                const toyId = this.scene.toy.id;
                // 写到 toyState(走 store.patchToyState,浅合并 + 防抖落盘)
                store.patchToyState(toyId, {
                    html: payload.html,
                    css: payload.css,
                    js: payload.js,
                    layout: payload.layout,
                    activeTemplateId: payload.activeTemplateId,
                    blueprint: payload.blueprint,
                });
                // 推给 toyHost:有 controller.setHtmlTemplate 就走热更,不重挂
                this.$refs.stage?.$refs?.toyHost?.applyHtmlTemplate?.(payload);
                this.notify('success', '模板已应用', '回舞台按一下看看');
            },
            /**
             * 编辑页的返回。有没应用的改动时先问一句 —— 直接退会静默丢掉刚写的代码。
             * 复用 RxConfirmModal,不另造一套确认框。
             */
            onRequestCloseCustomEditor(payload = {}) {
                if (!payload.dirty) {
                    this.closeCustomEditor();
                    return;
                }
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '还有没应用的改动',
                        message: '刚写的 HTML / CSS 还没应用到主体,现在返回就没了。',
                        confirmLabel: '不要了',
                        cancelLabel: '继续改',
                        danger: true,
                        onConfirm: () => this.closeCustomEditor(),
                    },
                };
            },
            closeCustomEditor() {
                this.view = 'stage';
                this.editorSeed = null;
            },
            // ---------- per-toy 音色 ----------
            /**
             * 用户在「捏捏」面板里点了某个音色瓦片。
             * ToyPanel 已经把 presetId / customId 各自取非空塞过来,
             * 这里直接落 store,scene.toySounds 会被防抖落盘。
             */
            onSetToySound({ presetId = null, customId = null } = {}) {
                const toyId = this.scene.toy.id;
                if (!toyId) return;
                // 用 patchToySound 而不是完全替换:用户可能只改一项
                store.setToySound(toyId, { presetId, customId });
                // 立即播一下当反馈
                this.onPreviewToySound();
            },
            onClearToySound() {
                const toyId = this.scene.toy.id;
                if (!toyId) return;
                store.clearToySound(toyId);
                this.notify('success', '已恢复全局默认');
            },
            /**
             * 试听「这个主体当前用哪个音」。
             * resolveActive* 已经按 toyId 优先查覆盖 → 没设走全局,
             * 直接走 playSoundConfig 就行,不需要关心覆盖状态。
             */
            onPreviewToySound() {
                const toyId = this.scene.toy.id;
                if (!toyId) return;
                this.unlockAudio();
                const cfg = store.resolveActiveSoundConfig(toyId);
                const customRec = store.resolveActiveToyCustomSound(toyId);
                playSoundConfig(cfg, customRec, { rate: 0.95 + Math.random() * 0.1 });
            },

            // ---------- 背景 ----------
            async onUploadImage(file) {
                const dataUrl = await fileToDataUrl(file);
                const result = await addCustomImage(this.app, { name: file.name, dataUrl });
                if (!result.ok) {
                    this.notify('warning', '没能保存', result.reason);
                    return;
                }
                store.setCustomImages(await listCustomImages(this.app));
                store.setBackgroundCustomImage(result.record.id);
                this.notify('success', '背景换好了', result.record.name);
            },
            onRemoveImage(imageId) {
                const record = this.customImages.find(item => item.id === imageId);
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '删掉这张背景',
                        message: `「${record?.name || '这张图'}」会从舞台上移除,删了就找不回来了。`,
                        confirmLabel: '删掉',
                        danger: true,
                        onConfirm: async () => {
                            await removeCustomImage(this.app, imageId);
                            store.setCustomImages(await listCustomImages(this.app));
                            if (this.scene.background.customImageId === imageId) {
                                store.setBackgroundCustomImage(null);
                            }
                        },
                    },
                };
            },

            // ---------- 自定义盘子 ----------
            async onUploadPlate(file) {
                const dataUrl = await fileToDataUrl(file);
                if (!dataUrl) {
                    this.notify('warning', '没能读取', '文件读取失败');
                    return;
                }
                // 顺手读一下真实 aspect,装饰用不上,盘子也用不上,纯给装饰做参考。
                // 盘子保持方 aspect = 1。
                const result = await addCustomPlate(this.app, { name: file.name, dataUrl });
                if (!result.ok) {
                    this.notify('warning', '没能保存', result.reason);
                    return;
                }
                store.setCustomPlates(await listCustomPlates(this.app));
                store.setPlateCustom(result.record.id);
                this.notify('success', '盘子换好了', result.record.name);
            },
            onRemovePlate(plateId) {
                const record = this.customPlates.find(item => item.id === plateId);
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '删掉这个盘子',
                        message: `「${record?.name || '这个盘子'}」会被移除。如果正在用它,会自动换回内置盘子。`,
                        confirmLabel: '删掉',
                        danger: true,
                        onConfirm: async () => {
                            await removeCustomPlate(this.app, plateId);
                            store.setCustomPlates(await listCustomPlates(this.app));
                            if (this.scene.plate.customId === plateId) {
                                store.setPlateCustom(null);
                            }
                        },
                    },
                };
            },
            onPickPlateCustom(plateId) {
                store.setPlateCustom(plateId);
            },

            // ---------- 自定义装饰 ----------
            /**
             * 上传后尝试读真实 aspect(image 头):装饰的瓦片预览、舞台定位都依赖它。
             * 上传阶段读不出来的就用 1(默认正方),不影响摆位,只是预览偏一点。
             */
            async onUploadDecoration(file) {
                const dataUrl = await fileToDataUrl(file);
                if (!dataUrl) {
                    this.notify('warning', '没能读取', '文件读取失败');
                    return;
                }
                let aspect = 1;
                try {
                    const img = await new Promise((resolve, reject) => {
                        const el = new Image();
                        el.onload = () => resolve(el);
                        el.onerror = reject;
                        el.src = dataUrl;
                    });
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        aspect = img.naturalWidth / img.naturalHeight;
                    }
                } catch { /* 用默认 1 兜底 */ }

                const result = await addCustomDecoration(this.app, { name: file.name, dataUrl, aspect });
                if (!result.ok) {
                    this.notify('warning', '没能保存', result.reason);
                    return;
                }
                store.setCustomDecorations(await listCustomDecorations(this.app));
                // 加完顺手摆一个,直接跳到装饰子 tab,跟内置装饰一样的体验
                const added = store.addDecoration(`custom:${result.record.id}`);
                if (added?.error) {
                    this.notify('warning', '保存了但摆不下', added.error);
                    return;
                }
                this.decorateSubTab = 'deco';
                this.notify('success', '贴纸存好了', result.record.name);
            },
            onRemoveDecorationCustom(decoId) {
                const record = this.customDecorations.find(item => item.id === decoId);
                const presetKey = `custom:${decoId}`;
                const onStage = this.scene.decorations.some(d => d.presetId === presetKey);
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '删掉这张贴纸',
                        message: `「${record?.name || '这张贴纸'}」${onStage ? '还在舞台上,会一并被移除' : '会被移除'}。`,
                        confirmLabel: '删掉',
                        danger: true,
                        onConfirm: async () => {
                            await removeCustomDecoration(this.app, decoId);
                            store.setCustomDecorations(await listCustomDecorations(this.app));
                            if (onStage) {
                                // 把还在舞台上的引用都清掉
                                const ids = this.scene.decorations
                                    .filter(d => d.presetId === presetKey)
                                    .map(d => d.uid);
                                ids.forEach(uid => store.removeDecoration(uid));
                            }
                        },
                    },
                };
            },

            // ---------- 音声 ----------
            async onUploadSound(file) {
                const dataUrl = await fileToDataUrl(file);
                const result = await addCustomSound(this.app, { name: file.name, dataUrl });
                if (!result.ok) {
                    this.notify('warning', '没能保存', result.reason);
                    return;
                }
                store.setCustomSounds(await listCustomSounds(this.app));
                store.setSoundCustom(result.record.id);
                this.unlockAudio();
                this.playCurrentSound();
                this.notify('success', '音色换好了', result.record.name);
            },
            onRemoveSound(sound) {
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '删掉这段音',
                        message: `「${sound.name}」会被移除。如果正在用它,会自动换回内置音。`,
                        confirmLabel: '删掉',
                        danger: true,
                        onConfirm: async () => {
                            await removeCustomSound(this.app, sound.id);
                            disposeCustomSound(sound.id);
                            store.setCustomSounds(await listCustomSounds(this.app));
                            if (this.scene.sound.customId === sound.id) {
                                store.setSoundCustom(null);
                            }
                            // 界面点击音也可能正引用它 —— 一起换回内置音
                            if (this.scene.uiSound.customId === sound.id) {
                                store.setUiSoundCustom(null);
                            }
                        },
                    },
                };
            },

            // ---------- 装饰 ----------
            onAddDecoration(presetId) {
                const result = store.addDecoration(presetId);
                if (result?.error) {
                    this.notify('warning', '摆不下了', result.error);
                    return;
                }
                // 加完自动跳到装饰子 tab,这样立刻能拖
                this.decorateSubTab = 'deco';
            },
            onClearDecorations() {
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '清空装饰',
                        message: `舞台上的 ${this.scene.decorations.length} 个装饰都会被移除。`,
                        confirmLabel: '清空',
                        danger: true,
                        onConfirm: () => store.clearDecorations(),
                    },
                };
            },

            // ---------- 舞台存档 ----------
            async openLibrary() {
                this.savedScenes = await listSavedScenes(this.app);
                this.modal = { type: 'library', payload: {} };
            },
            openSaveModal() {
                this.modal = { type: 'save', payload: { initialName: this.scene.name } };
            },
            async onConfirmSave(name) {
                await store.flushPersist();
                const record = await saveSceneAs(this.app, this.scene, name);
                this.modal = null;
                if (record) {
                    store.setSceneName(name);
                    this.notify('success', '存好了', name);
                } else {
                    this.notify('warning', '没能保存', '存档写入失败');
                }
            },
            onApplyScene(scene) {
                store.applyScene(scene);
                this.modal = null;
                this.activeTab = 'stage';
                this.notify('success', '换好了', scene.name);
            },
            onRemoveSavedScene(scene) {
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '删掉这个存档',
                        message: `「${scene.name}」会被删除,当前舞台不受影响。`,
                        confirmLabel: '删掉',
                        danger: true,
                        onConfirm: async () => {
                            await deleteSavedScene(this.app, scene.id);
                            this.savedScenes = await listSavedScenes(this.app);
                            // 删完回到存档库,而不是甩用户回舞台
                            this.modal = { type: 'library', payload: {} };
                        },
                    },
                };
            },
            openResetConfirm() {
                this.modal = {
                    type: 'confirm',
                    payload: {
                        title: '重置舞台',
                        message: '背景、盘子、装饰、主体、音声都会回到最初的样子。存档不受影响。',
                        confirmLabel: '重置',
                        danger: true,
                        onConfirm: () => {
                            store.resetScene();
                            this.activeTab = 'stage';
                        },
                    },
                };
            },

            // ---------- 弹窗 ----------
            closeModal() {
                this.modal = null;
            },
            async onModalConfirm() {
                const handler = this.modal?.payload?.onConfirm;
                // 先关再跑:handler 里可能会重新开一个弹窗(比如删存档后回到存档库)
                this.modal = null;
                if (typeof handler === 'function') await handler();
            },

            notify(type, title, message) {
                this.app?.toolkit?.island?.notify?.(type, title, message);
            },
        },
        template: `
            <div class="rx-root" :class="{ 'is-panel-open': panelOpen, 'is-editor': view === 'custom-editor' }">
                <!-- 舞台常驻 -->
                <RelaxStage
                    ref="stage"
                    :scene="scene"
                    :custom-image-url="activeCustomImageUrl"
                    :custom-plate-url="activeCustomPlateUrl"
                    :editable="stageEditable"
                    :selected-decoration-uid="selectedDecorationUid"
                    :bridge="toyBridge"
            @select-decoration="onSelectDecoration($event)"
            @move-decoration="store.updateDecoration($event.uid, { x: $event.x, y: $event.y })"
            @remove-decoration="store.removeDecoration($event)"
            @commit-decoration="store.bringDecorationToFront($event)"
        />

                <!-- 舞台页的浮动条 -->
                <header class="rx-stage-bar" :class="{ 'is-hidden': panelOpen, 'is-deco-edit': decoEditMode && activeTab === 'decor' && decorateSubTab === 'deco' }">
                    <div class="rx-stage-bar-actions">
                        <button type="button" class="rx-chip" @click="openSaveModal">存一套</button>
                        <button type="button" class="rx-chip" @click="openLibrary">存档</button>
                        <button type="button" class="rx-chip rx-chip-quiet" @click="openResetConfirm">重置</button>
                        <!-- 「灵动岛与小组件」走 framework 的全局委托（data-presence-center），
                             不用注册 method、不占路由。见 docs/framework-灵动岛与小组件总览.md -->
                        <button
                            type="button"
                            class="rx-chip rx-chip-quiet rx-chip-icon"
                            data-presence-center="relax"
                            aria-label="灵动岛与小组件"
                            title="灵动岛与小组件"
                        >${ICON_ISLAND}</button>
                    </div>
                </header>

                <!-- 装饰编辑模式浮层:在面板里点「编辑装饰位置」后,面板收起,
                     舞台暴露;点装饰浮出 mini 工具栏,属性全在上面调。 -->
                <div v-if="decoEditMode && activeTab === 'decor' && decorateSubTab === 'deco'" class="rx-deco-floating">
                    <button
                        type="button"
                        class="rx-deco-floating-back"
                        @click="exitDecoEditMode"
                    >
                        <span class="rx-deco-floating-back-arrow">${ICON_CHEVRON_LEFT}</span>
                        <span>返回调整</span>
                    </button>
                    <div class="rx-deco-floating-tip">
                        {{ selectedDecoration ? '点空白处取消选中' : '拖动装饰换位置,点装饰改属性' }}
                    </div>
                </div>

                <div
                    v-if="showFloatingDecoBar"
                    ref="decoBarEl"
                    class="rx-deco-bar"
                    :class="{ 'is-dragging': decoBarDragging }"
                    :style="decoBarStyle"
                >
                    <div
                        ref="decoBarHeadEl"
                        class="rx-deco-bar-head"
                        @pointerdown="onDecoBarHeadPointerDown"
                    >
                        <span class="rx-deco-bar-grip" aria-hidden="true">${ICON_GRIP}</span>
                        <span class="rx-deco-bar-title">{{ selectedDecorationName }}</span>
                        <button
                            type="button"
                            class="rx-deco-bar-close"
                            aria-label="收起"
                            @pointerdown.stop
                            @click="store.selectDecoration(null)"
                        >${ICON_CLOSE}</button>
                    </div>
                    <div class="rx-deco-bar-row rx-deco-bar-fields-row">
                        <div class="rx-deco-bar-field">
                            <span class="rx-deco-bar-label">大小</span>
                            <input
                                type="range" min="0.3" max="2.4" step="0.05"
                                :value="selectedDecoration.scale"
                                @input="patchSelectedDecoration({ scale: parseFloat($event.target.value) })"
                            />
                        </div>
                    </div>
                    <div class="rx-deco-bar-row rx-deco-bar-fields-row">
                        <div class="rx-deco-bar-field">
                            <span class="rx-deco-bar-label">旋转</span>
                            <input
                                type="range" min="-180" max="180" step="1"
                                :value="selectedDecoration.rotate"
                                @input="patchSelectedDecoration({ rotate: parseFloat($event.target.value) })"
                            />
                        </div>
                    </div>
                    <div class="rx-deco-bar-row rx-deco-bar-actions">
                        <label class="rx-deco-bar-color">
                            <input
                                type="color"
                                :value="selectedDecoration.tint"
                                @input="patchSelectedDecoration({ tint: $event.target.value })"
                            />
                            <span class="rx-deco-bar-swatch" :style="{ background: selectedDecoration.tint }"></span>
                            <span class="rx-deco-bar-label">颜色</span>
                        </label>
                        <button
                            type="button"
                            class="rx-deco-bar-btn"
                            @click="patchSelectedDecoration({ flip: !selectedDecoration.flip })"
                        >
                            ${ICON_FLIP}
                            <span>翻转</span>
                        </button>
                        <button
                            type="button"
                            class="rx-deco-bar-btn rx-deco-bar-btn-danger"
                            @click="removeSelectedDecoration"
                        >移除</button>
                    </div>
                </div>

                <!-- 面板抽屉 -->
                <section class="rx-sheet" :class="{ 'is-open': panelOpen }">
                    <div class="rx-sheet-grip" @click="onSelectTab('stage')">
                        <span class="rx-sheet-grip-bar"></span>
                    </div>

                    <div class="rx-sheet-scroll">
                        <ToyPanel
                            v-if="activeTab === 'toy'"
                            :scene="scene"
                            :custom-sounds="customSounds"
                            @set-toy="onSetToy"
                            @set-toy-tint="store.setToyTint($event)"
                            @set-toy-scale="store.setToyScale($event)"
                            @set-toy-rows-cols="onSetToyRowsCols"
                            @reset-toy="onResetToy"
                            @edit-custom="onOpenCustomEditor"
                            @set-toy-sound="onSetToySound"
                            @clear-toy-sound="onClearToySound"
                            @preview-toy-sound="onPreviewToySound"
                        />

                        <DecoratePanel
                            v-else-if="activeTab === 'decor'"
                            :scene="scene"
                            :custom-images="customImages"
                            :custom-plates="customPlates"
                            :custom-decorations="customDecorations"
                            :selected-decoration-uid="selectedDecorationUid"
                            :sub-tab="decorateSubTab"
                            @change-sub-tab="decorateSubTab = $event"
                            @set-bg-preset="store.setBackgroundPreset($event)"
                            @set-bg-tint="store.setBackgroundTint($event)"
                            @set-bg-image="store.setBackgroundCustomImage($event)"
                            @set-bg-filter="store.setBackgroundFilter($event)"
                            @upload-image="onUploadImage"
                            @remove-image="onRemoveImage"
                            @set-plate-enabled="store.setPlateEnabled($event)"
                            @set-plate-preset="store.setPlatePreset($event)"
                            @set-plate-tint="store.setPlateTint($event)"
                            @set-plate-transform="store.setPlateTransform($event)"
                            @set-plate-custom="store.setPlateCustom($event)"
                            @upload-plate="onUploadPlate"
                            @remove-plate="onRemovePlate"
                            @add-decoration="onAddDecoration"
                            @add-custom-decoration="onUploadDecoration"
                            @remove-custom-decoration="onRemoveDecorationCustom"
                            @update-decoration="store.updateDecoration($event.uid, $event)"
                            @remove-decoration="store.removeDecoration($event)"
                            @clear-decorations="onClearDecorations"
                            @enter-deco-edit="enterDecoEditMode"
                        />

                        <SoundPanel
                            v-else-if="activeTab === 'sound'"
                            :scene="scene"
                            :custom-sounds="customSounds"
                            :audio-unlocked="audioUnlocked"
                            @set-sound-enabled="store.setSoundEnabled($event)"
                            @set-sound-preset="store.setSoundPreset($event)"
                            @set-sound-custom="store.setSoundCustom($event)"
                            @set-volume="store.setSoundVolume($event)"
                            @set-haptics="store.setHaptics($event)"
                            @preview-sound="onPreviewSound"
                            @upload-sound="onUploadSound"
                            @remove-sound="onRemoveSound"
                            @set-ui-sound-enabled="store.setUiSoundEnabled($event)"
                            @set-ui-sound-preset="store.setUiSoundPreset($event)"
                            @set-ui-sound-custom="store.setUiSoundCustom($event)"
                            @set-ui-volume="store.setUiSoundVolume($event)"
                            @preview-ui-sound="playUiSoundPreview"
                        />
                    </div>
                </section>

                <!-- 液态 tab 栏 -->
                <LiquidTabBar :tabs="tabs" :active-id="activeTab" @select="onSelectTab" />

                <!-- 自定义捏捏编辑页:整屏,盖在舞台上,tab 栏和抽屉由 .is-editor 收起。
                     z-index 5 < .app-bottom 的 6,底部动作条自己让开 --app-safe-bottom,
                     所以编辑页开着也能划出去退出 App。 -->
                <RxCustomToyPage
                    v-if="view === 'custom-editor' && editorSeed"
                    :initial-html="editorSeed.html"
                    :initial-css="editorSeed.css"
                    :initial-js="editorSeed.js"
                    :initial-layout="editorSeed.layout"
                    :initial-template-id="editorSeed.templateId"
                    :initial-blueprint="editorSeed.blueprint"
                    :rows="scene.toy.rows"
                    :cols="scene.toy.cols"
                    :tint="scene.toy.tint"
                    @request-close="onRequestCloseCustomEditor"
                    @apply="onApplyCustomToy"
                />

                <!-- 弹窗 -->
                <RxConfirmModal
                    v-if="modal?.type === 'confirm'"
                    v-bind="modal.payload"
                    @close="closeModal"
                    @confirm="onModalConfirm"
                />
                <RxSaveSceneModal
                    v-else-if="modal?.type === 'save'"
                    :initial-name="modal.payload.initialName"
                    @close="closeModal"
                    @confirm="onConfirmSave"
                />
                <RxSceneLibraryModal
                    v-else-if="modal?.type === 'library'"
                    :scenes="savedScenes"
                    @close="closeModal"
                    @apply="onApplyScene"
                    @remove="onRemoveSavedScene"
                />
            </div>
        `,
    };
}
