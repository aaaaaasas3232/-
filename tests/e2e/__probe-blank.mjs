/**
 * 一次性诊断：5173 首页到底画了什么、控制台有没有炸。
 */
import { launch, check, section, report, sleep } from './__probe-kit.mjs';

async function run() {
    const { page, close } = await launch({ port: 9460, prefix: 'blank', appsTimeout: 90000 });
    try {
        section('启动');
        const state = await page.evaluate(`JSON.stringify({
            href: location.href,
            title: document.title,
            ready: document.readyState,
            phone: !!document.getElementById('phone'),
            bodyText: (document.body?.innerText || '').trim().slice(0, 240),
            appCount: (window.__phoneAppsRef?.value || []).length,
            appIds: (window.__phoneAppsRef?.value || []).map(a => a.id),
            desktopIcons: document.querySelectorAll('.desktop-icon, .app-icon, .phone-app-icon').length,
            dockItems: document.querySelectorAll('.dock-item, .phone-dock-item, .bar-item').length,
            activeApp: document.querySelector('.app-shell[data-app-id]')?.dataset?.appId || '',
            windows: document.querySelectorAll('.app-window').length,
            hiddenPhone: (() => {
                const el = document.getElementById('phone');
                if (!el) return 'no-phone';
                const s = getComputedStyle(el);
                return { display: s.display, visibility: s.visibility, opacity: s.opacity, w: el.offsetWidth, h: el.offsetHeight };
            })(),
        })`);
        console.log(state);

        const errors = page.errors();
        console.log('\n── 控制台错误 ──');
        if (!errors.length) console.log('  (无)');
        errors.slice(0, 20).forEach((l) => console.log('  ' + l));

        console.log('\n── 全部 console 末 30 条 ──');
        page.console.slice(-30).forEach((l) => console.log('  ' + l));

        const shot = await page.screenshot('home');
        console.log('\n截图:', shot);

        check('有 #phone', await page.exists('#phone'));
        check('有注册 App', (await page.evaluate(`(window.__phoneAppsRef?.value || []).length`)) > 0);
        check('启动无 error/exception', errors.length === 0, errors.slice(0, 3).join(' | '));
    } finally {
        await close();
    }
    report();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
