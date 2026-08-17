/**
 * relax-app / 解压主体宿主
 *
 * 职责:把 registry 里登记的主体挂到盘子内圈,并把 `host` 契约交给它。
 * 主体的两种形态都在这里收口:
 *   - `mount(host)`   → 直接给 DOM,拿回 controller
 *   - `component`     → 用 Vue.createApp 挂一个子 app(和 framework 的 vue 模式同一套路)
 *
 * ★ 为什么主体用「子 Vue app / 裸 DOM」而不是直接写成本组件的子组件
 *   主体是**用户后续自己往 toys/ 里丢文件**扩展的,不该被迫遵守本组件的
 *   props/emit 约定,更不该因为写错一个响应式依赖就把整个舞台带崩。
 *   隔离成子 app 后,主体内部报错只影响主体那一块(有 errorHandler 兜),
 *   舞台/背景/装饰照常。
 *
 * ★ 生命周期必须干净
 *   主体大概率会挂 raf / setInterval / pointer 监听。切主体 / 离开 app 时
 *   必须走 destroy + onCleanup,否则「切了 5 个主体后风扇起飞」。
 */

import { getRelaxToy } from '../registry.js';

export const ToyHost = {
    name: 'ToyHost',
    props: {
        toyId: { type: String, default: null },
        tint: { type: String, default: '#ffc8dd' },
        scale: { type: Number, default: 1 },
        rows: { type: Number, default: 4 },
        cols: { type: Number, default: 4 },
        /**
         * 由父级(stage)注入的能力,转手给主体:
         * { playSound, haptic, notify, getToyState, setToyState }
         */
        bridge: { type: Object, required: true },
    },
    data() {
        return {
            mountError: '',
        };
    },
    computed: {
        toy() {
            return this.toyId ? getRelaxToy(this.toyId) : null;
        },
        wrapStyle() {
            return {
                transform: `scale(${this.scale})`,
                // 主体统一用这个变量取色,不实现 setTint 也能染色
                '--rx-toy-tint': this.tint,
                color: this.tint,
            };
        },
    },
    watch: {
        toyId() {
            this.remount();
        },
        tint(next) {
            this.applyTint(next);
        },
        scale() {
            this.$nextTick(() => this.reportSize());
        },
        // 行/列变化 → 整块板重建,主体有机会走自己的 controller.setRowsCols
        rows() { this.applyRowsCols(); },
        cols() { this.applyRowsCols(); },
    },
    mounted() {
        this._cleanups = [];
        // 每次挂载发一张号,用来作废「在途的异步 mount」(见 remount / settleMount)
        this._mountToken = 0;
        this.remount();

        // 容器尺寸变化要通知主体(手机旋转 / 盘子缩放 / 面板弹出)
        if (typeof ResizeObserver !== 'undefined') {
            this._observer = new ResizeObserver(() => this.reportSize());
            if (this.$refs.slot) this._observer.observe(this.$refs.slot);
        }
    },
    beforeUnmount() {
        this.teardown();
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
    },
    methods: {
        /** 拆掉当前主体:先跑主体自己的 destroy,再跑它注册的 cleanup */
        teardown() {
            // ★ 先把号作废。主体可以写成 async mount(),拆的时候它可能还没 resolve;
            //   号变了之后,那次 mount 回来会自己把成果丢掉,不会往已经清空的
            //   slot 里再塞一份 DOM,也不会留下一个停不掉的 raf。
            this._mountToken = (this._mountToken || 0) + 1;

            if (this._controller?.destroy) {
                try {
                    this._controller.destroy();
                } catch (err) {
                    console.warn('[relax/toy-host] 主体 destroy 抛错', err);
                }
            }
            this._controller = null;

            for (const fn of (this._cleanups || [])) {
                try {
                    fn();
                } catch (err) {
                    console.warn('[relax/toy-host] cleanup 抛错', err);
                }
            }
            this._cleanups = [];

            if (this._subApp) {
                try {
                    this._subApp.unmount();
                } catch (err) {
                    console.warn('[relax/toy-host] 子 app unmount 抛错', err);
                }
                this._subApp = null;
            }

            const slot = this.$refs.slot;
            if (slot) slot.innerHTML = '';
        },

        remount() {
            this.teardown();
            this.mountError = '';

            const toy = this.toy;
            const slot = this.$refs.slot;
            if (!toy || !slot) return;

            // ★ 防御性兜底:teardown 已经清过 slot,但如果出现 race
            //   (例如 hydrate 期间 scene 被整体替换 + watch toyId 同步触发两次,
            //    或者 framework 重挂),slot 里可能残留了上一次 mount 的 wrap。
            //   这里在挂新 toy 之前**硬清一次**,确保任何情况下都只会有一个主体根节点。
            //   用 while 循环清掉所有子节点,比 innerHTML = '' 更显式。
            while (slot.firstChild) {
                slot.removeChild(slot.firstChild);
            }

            const token = this._mountToken;
            const host = this.createHost(slot);

            try {
                if (toy.mount) {
                    const result = toy.mount(host);
                    /*
                     * ★ 主体允许写成 `async mount()`(巧克力要先把 d3 拉下来)。
                     *   以前这里直接 `this._controller = toy.mount(host)`,
                     *   异步主体存进去的是一个 **Promise** —— 于是
                     *   setTint / setSize / destroy / reset 全都调不到:
                     *     · 改色没反应(只设了 CSS 变量,canvas 根本不读);
                     *     · 切主体时 raf 停不掉,detach 的 canvas 一直在跑;
                     *     · 「重来一次」退化成整块重挂。
                     *   而且 async 抛错不会被下面的 catch 接住,slot 会一直空着。
                     */
                    if (result && typeof result.then === 'function') {
                        result.then(
                            controller => this.settleMount(token, controller),
                            err => this.failMount(toy, token, err),
                        );
                        return;
                    }
                    this.settleMount(token, result);
                    return;
                }
                if (toy.component) {
                    this.mountComponent(toy, slot, host);
                    this.settleMount(token, null);
                }
            } catch (err) {
                this.failMount(toy, token, err);
            }
        },

        /**
         * mount 收尾(同步 / 异步共用):认领 controller,再把颜色和尺寸补一次。
         * 号对不上说明这次 mount 已经过期(期间又切了主体,或者组件已卸载),
         * 成果必须就地拆掉,不能塞进当前的 slot。
         */
        settleMount(token, controller) {
            const slot = this.$refs.slot;
            if (token !== this._mountToken || !slot) {
                if (controller?.destroy) {
                    try {
                        controller.destroy();
                    } catch (err) {
                        console.warn('[relax/toy-host] 过期主体 destroy 抛错', err);
                    }
                }
                return;
            }

            this._controller = controller || null;

            // ★ 保险栓:挂完之后再断言 slot 里只剩一个直接子节点,
            //   避免「上下两块板」这类残留在视觉上叠出来。
            const children = slot.children;
            for (let i = children.length - 1; i > 0; i--) {
                children[i].remove();
            }

            this.applyTint(this.tint);
            this.reportSize();
        },

        failMount(toy, token, err) {
            console.error(`[relax/toy-host] 主体 ${toy.id} 挂载失败`, err);
            if (token !== this._mountToken) return;
            this.mountError = `「${toy.name}」加载失败`;
        },

        mountComponent(toy, slot, host) {
            const Vue = window.Vue;
            if (!Vue?.createApp) {
                this.mountError = 'Vue 未就绪';
                return;
            }
            const subApp = Vue.createApp(toy.component, { host });
            subApp.config.errorHandler = (err) => {
                console.error(`[relax/toy ${toy.id}] 渲染错误`, err);
            };
            subApp.mount(slot);
            this._subApp = subApp;
        },

        /** 构造交给主体的 host 对象(契约见 registry.js) */
        createHost(slot) {
            const bridge = this.bridge || {};
            const component = this;
            return {
                el: slot,
                // ★ tint / width / height / rows / cols 用 getter 而不是快照值。
                //   host 对象在 mount 时构造一次、被主体长期持有,
                //   写成快照的话用户改完颜色、盘子缩放、调整个数之后主体读到的还是旧值。
                get tint() {
                    return component.tint;
                },
                get rows() {
                    return component.rows;
                },
                get cols() {
                    return component.cols;
                },
                get width() {
                    return slot.getBoundingClientRect().width;
                },
                get height() {
                    return slot.getBoundingClientRect().height;
                },
                playSound: (opts) => bridge.playSound?.(opts),
                playSoundId: (id, opts) => bridge.playSoundId?.(id, opts),
                haptic: (strength) => bridge.haptic?.(strength),
                notify: (type, title, message) => bridge.notify?.(type, title, message),
                getState: () => bridge.getToyState?.() || {},
                setState: (patch) => bridge.setToyState?.(patch),
                onCleanup: (fn) => {
                    if (typeof fn === 'function') this._cleanups.push(fn);
                },
            };
        },

        applyTint(hex) {
            const slot = this.$refs.slot;
            if (slot) slot.style.setProperty('--rx-toy-tint', hex);
            if (this._controller?.setTint) {
                try {
                    this._controller.setTint(hex);
                } catch (err) {
                    console.warn('[relax/toy-host] setTint 抛错', err);
                }
            }
        },

        /**
         * ★ 用 offsetWidth/Height 而不是 getBoundingClientRect():
         *   .rx-toy-host 上挂着 transform: scale(),后者返回的是缩放**之后**的尺寸。
         *   主体拿它算内部单位的话,用户每调一次大小,主体就会在已经放大的容器里
         *   再按放大后的数值排一遍版,越缩越离谱。主体要的是未缩放的布局尺寸,
         *   视觉上的放大由父级 transform 负责。
         */
        reportSize() {
            const slot = this.$refs.slot;
            if (!slot || !this._controller?.setSize) return;
            try {
                this._controller.setSize(slot.offsetWidth, slot.offsetHeight);
            } catch (err) {
                console.warn('[relax/toy-host] setSize 抛错', err);
            }
        },

        /** 主体行/列变化:优先调 controller.setRowsCols,否则整块重建 */
        applyRowsCols() {
            if (this._controller?.setRowsCols) {
                try {
                    this._controller.setRowsCols(this.rows, this.cols);
                    return;
                } catch (err) {
                    console.warn('[relax/toy-host] setRowsCols 抛错,改走 remount', err);
                }
            }
            this.remount();
        },

        /**
         * 父级(relax-root)调:让主体应用用户新写的 HTML/CSS。
         * 走 controller.setHtmlTemplate(若有),否则 remount + 把模板
         * 暂时存到下次 mount 时的 state(主体自己读 host.getState())。
         */
        applyHtmlTemplate(payload) {
            if (this._controller?.setHtmlTemplate) {
                try {
                    this._controller.setHtmlTemplate(payload);
                    return;
                } catch (err) {
                    console.warn('[relax/toy-host] setHtmlTemplate 抛错', err);
                }
            }
            this.remount();
        },

        /** 供父级调用:「重来一次」 */
        resetToy() {
            if (this._controller?.reset) {
                try {
                    this._controller.reset();
                    return true;
                } catch (err) {
                    console.warn('[relax/toy-host] reset 抛错', err);
                }
            }
            // 主体没实现 reset → 退化成重新挂一次
            this.remount();
            return true;
        },
    },
    template: `
        <div class="rx-toy-host" :style="wrapStyle">
            <div ref="slot" class="rx-toy-slot"></div>

            <div v-if="mountError" class="rx-toy-error">{{ mountError }}</div>

            <div v-else-if="!toyId" class="rx-toy-empty">
                <div class="rx-toy-empty-ring"></div>
                <p class="rx-toy-empty-text">盘子空着</p>
                <p class="rx-toy-empty-hint">去「捏捏」挑一个放上来</p>
            </div>
        </div>
    `,
};
