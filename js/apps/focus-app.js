const FOCUS_ICON = `
    <svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
            <linearGradient id="focus-tile" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#6D5DFB" />
                <stop offset="100%" stop-color="#B968F0" />
            </linearGradient>
        </defs>
        <rect width="60" height="60" rx="14" fill="url(#focus-tile)" />
        <circle cx="30" cy="31" r="17" fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.96" />
        <path d="M30 20v12l8 5" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M24 10h12" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
    </svg>
`;

function createFocusPage() {
    return {
        props: { app: Object },
        data() {
            return {
                remaining: 25 * 60,
                running: false,
                timer: null,
            };
        },
        computed: {
            timeLabel() {
                const minutes = Math.floor(this.remaining / 60);
                const seconds = this.remaining % 60;
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            },
            buttonLabel() {
                return this.running ? '暂停' : '开始专注';
            },
        },
        methods: {
            toggleTimer() {
                this.running = !this.running;
                if (this.running) this.startTicking();
                else this.stopTicking();
            },
            startTicking() {
                this.stopTicking();
                this.timer = window.setInterval(() => {
                    if (this.remaining > 0) {
                        this.remaining -= 1;
                        return;
                    }
                    this.running = false;
                    this.stopTicking();
                    this.app.toolkit.island.notify('success', '专注完成', '休息一下，再继续前进');
                }, 1000);
            },
            stopTicking() {
                if (this.timer) window.clearInterval(this.timer);
                this.timer = null;
            },
            resetTimer() {
                this.running = false;
                this.stopTicking();
                this.remaining = 25 * 60;
            },
        },
        beforeUnmount() {
            this.stopTicking();
        },
        template: `
            <main class="focus-app">
                <section class="focus-card">
                    <div class="focus-kicker">FOCUS SESSION</div>
                    <div class="focus-time">{{ timeLabel }}</div>
                    <div class="focus-caption">一次只做一件事</div>
                    <button class="focus-primary" type="button" @click="toggleTimer">{{ buttonLabel }}</button>
                    <button class="focus-secondary" type="button" @click="resetTimer">重置</button>
                </section>
            </main>
        `,
    };
}

export default function createFocusApp() {
    return {
        id: 'focus-app',
        name: '片刻',
        icon: FOCUS_ICON,
        iconBg: 'linear-gradient(135deg, #6D5DFB, #B968F0)',
        distribution: {
            requiresInstall: true,
            appStore: {
                subtitle: '把注意力留给此刻',
                category: '效率',
                isGame: false,
                rating: 4.9,
                ratingsCount: '128',
                size: '8.6 MB',
                age: '4+',
                version: '1.0.0',
                whatsNew: '首次发布：新增 25 分钟专注计时与完成提醒。',
                description: '片刻是一款轻量的专注计时器。没有复杂设置，只为帮你开始一段安静、完整的专注时间。',
                accent: 'linear-gradient(145deg, #6D5DFB 0%, #B968F0 100%)',
            },
        },
        background: 'linear-gradient(180deg, #F3F0FF 0%, #FBF9FF 100%)',
        statusBarColor: '#2C2050',
        homeIndicatorColor: 'rgba(44,32,80,0.3)',
        topbar: {
            visible: true,
            title: '片刻',
            subtitle: '专注计时',
            showPill: false,
        },
        nav: { type: 'none' },
        pages: [{ id: 'home', label: '专注', nav: true }],
        defaultRootPageId: 'home',
        renderMode: 'vue',
        renderPage() {
            return createFocusPage();
        },
    };
}
