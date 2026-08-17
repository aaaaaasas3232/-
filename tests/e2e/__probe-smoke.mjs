/**
 * 全系统冒烟：每个 App 都能打开、没有 JS 报错、没有指向空 method 的按钮。
 * 每次大改之后跑一遍，防止「改 A 弄坏 B」。
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

async function run() {
    const { page, close } = await launch({ port: 9422, prefix: 'smoke' });

    try {
        section('启动');
        const apps = await page.evaluate(`(window.__phoneAppsRef?.value || []).map(a => a.id)`);
        check('App 都注册上了', apps.length >= 15, `${apps.length} 个：${apps.join(', ')}`);

        const bootErrors = page.errors();
        check('启动阶段没有报错', bootErrors.length === 0, bootErrors.slice(0, 3).join(' | '));

        section('逐个打开');
        const missingByApp = {};
        for (const id of apps) {
            const before = page.errors().length;
            try {
                await openApp(page, id, { settleMs: 900 });
            } catch (err) {
                check(`${id} 能打开`, false, err.message);
                continue;
            }
            const after = page.errors().length;
            check(`${id} 打开无报错`, after === before,
                after === before ? '' : page.errors().slice(before, before + 2).join(' | '));

            // 页面上所有 appMethod 按钮都得有对应实现
            const missing = await page.evaluate(`
                (() => {
                    const shell = document.querySelector('.app-shell[data-app-id="${id}"]');
                    if (!shell) return [];
                    const app = (window.__phoneAppsRef?.value || []).find(a => a.id === '${id}');
                    const keys = Object.keys(app?.methods || {});
                    const out = new Set();
                    shell.querySelectorAll('[data-app-action]').forEach(el => {
                        try {
                            const a = JSON.parse(el.getAttribute('data-app-action'));
                            if (a.action !== 'appMethod') return;
                            const target = a.appId || '${id}';
                            if (target !== '${id}') return;   // 跨 app 调用另说
                            if (!keys.includes(a.method)) out.add(a.method);
                        } catch (_) { /* 属性不是 JSON，跳过 */ }
                    });
                    return [...out];
                })()
            `);
            if (missing.length) missingByApp[id] = missing;
        }
        check('★ 没有指向空 method 的按钮', Object.keys(missingByApp).length === 0,
            Object.entries(missingByApp).map(([k, v]) => `${k}: ${v.join('/')}`).join(' | '));

        section('世界模式动态可见性');
        const modeSeed = await page.evaluate(`
            (async () => {
                const sdk = window.settingsSdk;
                const world = await sdk.worlds.create({
                    name: '演员模式探针',
                    summary: '只用于验证动态 App 可见性。',
                    experienceMode: 'actor',
                });
                let user = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!user) user = await sdk.users.create({ name: '探针用户' });
                await sdk.users.update(user.id, { boundWorldId: world.id });
                await sdk.defaultUserCard.setDefault(user.id);
                return { worldId: world.id };
            })()
        `);
        await page.waitFor(`!(window.__phoneAppsRef?.value || []).some(a => a.id === 'job')`, {
            label: '演员模式隐藏求职 App',
        });
        check('★ 演员世界会动态移除普通求职 App', true);

        await page.evaluate(`
            window.settingsSdk.worlds.update(${JSON.stringify(modeSeed.worldId)}, {
                experienceMode: 'general',
            })
        `);
        await page.waitFor(`(window.__phoneAppsRef?.value || []).some(a => a.id === 'job')`, {
            label: '通用模式恢复求职 App',
        });
        check('★ 切回通用世界会恢复求职 App', true);

        section('总控制台');
        const errs = page.errors();
        check('全程没有 JS 报错', errs.length === 0, errs.slice(0, 6).join('\n              '));
    } catch (err) {
        console.error('\n探针崩了：', err.message);
        check('探针跑完', false, err.message);
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

run();
