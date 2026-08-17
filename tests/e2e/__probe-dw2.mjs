/**
 * 梦境编织本轮改动验收：
 *   4. 弹窗只淡入不旋转（且只影响本 App）
 *   5. 灵感从弹窗变成整页，能查看/编辑/删除/保存
 *   6. 主题色实时铺开 + 保存/改名/覆盖/删除 + 粘贴全部
 *   7. IF 线工作台变成完整详情页
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

const SHELL = '.app-shell[data-app-id="dream-weaver"]';

async function run() {
    const { page, close } = await launch({ port: 9416, prefix: 'dw2-probe' });

    try {
        await openApp(page, 'dream-weaver', { settleMs: 2000 });
        await page.waitFor(`document.querySelector('${SHELL} .dw-root')`, { label: '根组件' });
        check('App 打开了', await page.exists(`${SHELL} .dw-root`));

        section('弹窗动画：淡入不旋转');
        // @import 进来的子样式表要递归进去找，否则什么都看不到
        const anim = await page.evaluate(`
            (() => {
                const out = { dw: '', global: '', fadeKf: '' };
                const walk = (sheet) => {
                    let rules; try { rules = sheet.cssRules; } catch (_) { return; }
                    for (const r of rules || []) {
                        if (r.styleSheet) { walk(r.styleSheet); continue; }
                        const sel = r.selectorText || '';
                        if (sel.includes('.dw-modal .ac-modal') && !sel.includes('--closing') && r.style && r.style.animation) out.dw = r.style.animation;
                        if (sel === '.ac-modal' && r.style && r.style.animation) out.global = r.style.animation;
                        if (r.type === CSSRule.KEYFRAMES_RULE && r.name === 'dwModalFadeIn') {
                            out.fadeKf = [...r.cssRules].map(k => k.cssText).join(' ');
                        }
                    }
                };
                for (const s of document.styleSheets) walk(s);
                return out;
            })()
        `);
        check('梦境编织弹窗用自己的动画', anim.dw.includes('dwModalFadeIn'), anim.dw || '(没有)');
        check('★ 全局 AcModal 仍是弹跳（其他 app 不受影响）', anim.global.includes('acBounceIn'), anim.global || '(没有)');
        check('★ 淡入关键帧里没有 rotate', !!anim.fadeKf && !anim.fadeKf.includes('rotate'), anim.fadeKf.slice(0, 90));

        section('灵感页');
        // ★ 不能 import('/js/apps/.../store.js') —— vite 会给 App 内部的模块加
        //   ?t= 时间戳，动态 import 拿到的是**另一个模块实例**，改的是另一份 STATE。
        //   走 App 自己暴露的 service，和真实调用同一条路径。
        const openInsp = await page.evaluate(`
            (async () => {
                const app = (window.__phoneAppsRef?.value || []).find(a => a.id === 'dream-weaver');
                await app.services.captureInspiration({ text: '探针灵感一：夜里的城市是安静的' });
                await app.services.captureInspiration({ text: '探针灵感二：她把伞留在了门口' });
                return true;
            })()
        `);
        await sleep(900);
        check('灵感数据写进去了', openInsp);

        // 走真实入口：我的 tab → 素材 → 灵感
        await page.clickText(`${SHELL} .dw-tabbar-item`, '我的');
        await sleep(700);
        await page.clickText(`${SHELL} .dw-row`, '灵感');
        await sleep(800);
        check('★ 灵感是整页不是弹窗', await page.exists(`${SHELL} .dw-inspiration-page.dw-page-full`));
        check('没有再弹旧的素材弹窗', !(await page.exists(`${SHELL} .dw-library-modal`)));
        const cards = await page.count(`${SHELL} .dw-inspiration-card`);
        check('列出了灵感卡片', cards >= 2, `${cards} 张`);
        await page.screenshot('01-inspiration');

        // 进详情编辑
        await page.click(`${SHELL} .dw-inspiration-card`);
        await sleep(500);
        const inDetail = await page.evaluate(`
            (() => {
                const shell = document.querySelector('${SHELL}');
                const ta = shell?.querySelector('.dw-inspiration-detail textarea');
                return { hasTa: !!ta, value: ta ? ta.value.slice(0, 12) : '' };
            })()
        `);
        check('点进详情能编辑', inDetail.hasTa, inDetail.value);
        const saved = await page.evaluate(`
            (async () => {
                const shell = document.querySelector('${SHELL}');
                const ta = shell.querySelector('.dw-inspiration-detail textarea');
                ta.value = '探针改过的内容';
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 200));
                const btn = shell.querySelector('.dw-page-topbar-act');
                btn.click();
                await new Promise(r => setTimeout(r, 500));
                // 回列表看卡片文字，验证真的落到 state 上了
                const back = shell.querySelector('.dw-page-topbar .dw-nav-icon-btn');
                back.click();
                await new Promise(r => setTimeout(r, 400));
                return [...shell.querySelectorAll('.dw-inspiration-card-text')].some(e => e.textContent.includes('探针改过的内容'));
            })()
        `);
        check('★ 改完点保存真的存下去了', saved);
        await page.screenshot('02-inspiration-detail');

        section('IF 线工作台');
        // 返回 → 开一本书 → 工具面板 → IF 线；书架上没书就先建一本
        await page.evaluate(`
            (async () => {
                const shell = document.querySelector('${SHELL}');
                const back = shell.querySelector('.dw-page-topbar .dw-nav-icon-btn');
                if (back) back.click();
                await new Promise(r => setTimeout(r, 400));
                window.dispatchEvent(new CustomEvent('dream-weaver:open-ifline'));
            })()
        `);
        await sleep(900);
        check('★ IF 线是整页', await page.exists(`${SHELL} .dw-ifline-page.dw-page-full`));
        const segs = await page.evaluate(`
            [...document.querySelectorAll('${SHELL} .dw-ifline-segs > .dw-ifline-seg')].map(e => e.textContent.trim())
        `);
        check('三段导航齐全', segs.join('/') === '推演/对话/存档', segs.join('/'));
        // 切到存档段
        await page.clickText(`${SHELL} .dw-ifline-seg`, '存档');
        await sleep(500);
        check('存档段能打开', await page.exists(`${SHELL} .dw-ifline-archive-head`));
        await page.screenshot('03-ifline');

        section('主题：实时生效 + 保存管理');
        // 返回 → 我的 → 外观 → 主题与配色
        await page.evaluate(`
            (() => {
                const shell = document.querySelector('${SHELL}');
                const back = shell.querySelector('.dw-page-topbar .dw-nav-icon-btn');
                if (back) back.click();
            })()
        `);
        await sleep(600);
        await page.clickText(`${SHELL} .dw-tabbar-item`, '我的');
        await sleep(600);
        await page.clickText(`${SHELL} .dw-row`, '主题与配色');
        await sleep(900);
        check('主题弹窗打开', await page.exists(`${SHELL} .dw-theme-modal`));

        const before = await page.evaluate(`
            getComputedStyle(document.querySelector('${SHELL}')).getPropertyValue('--dw-primary').trim()
        `);
        // 展开自定义颜色 → 打开第一个分类 → 改第一个色值
        const live = await page.evaluate(`
            (async () => {
                const shell = document.querySelector('${SHELL}');
                const toggle = shell.querySelector('.dw-theme-editor-toggle');
                if (toggle) toggle.click();
                await new Promise(r => setTimeout(r, 300));
                const box = shell.querySelector('.dw-batch-input');
                if (!box) return { ok: false, why: '没有批量输入框' };
                box.value = '--dw-primary: #1E88E5;';
                box.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 200));
                const apply = shell.querySelector('.dw-batch-apply');
                apply.click();
                await new Promise(r => setTimeout(r, 500));
                return { ok: true, now: getComputedStyle(shell).getPropertyValue('--dw-primary').trim() };
            })()
        `);
        check('★ 改颜色后整个 App 立刻变（不用点应用）',
            live.ok && live.now.toLowerCase() === '#1e88e5', `${before} → ${live.now || live.why}`);

        const pasteBtn = await page.evaluate(`
            [...document.querySelectorAll('${SHELL} .dw-batch-mini')].map(e => e.textContent.trim())
        `);
        check('★ 有「粘贴全部」按钮', pasteBtn.includes('粘贴全部'), pasteBtn.join(' / '));

        // 走 UI：存为新主题 → 出现 chip + 改名/覆盖/删除三个按钮
        const savedTheme = await page.evaluate(`
            (async () => {
                const shell = document.querySelector('${SHELL}');
                const saveBtn = [...shell.querySelectorAll('.ac-btn')].find(b => b.textContent.includes('存为新主题'));
                if (!saveBtn || saveBtn.disabled) return { ok: false, why: '存为新主题按钮不可用' };
                saveBtn.click();
                await new Promise(r => setTimeout(r, 500));
                const input = shell.querySelector('.dw-rename-modal input');
                if (!input) return { ok: false, why: '没弹出命名框' };
                input.value = '探针配色';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 200));
                const ok = [...shell.querySelectorAll('.dw-rename-modal .ac-btn')].find(b => b.textContent.includes('保存'));
                ok.click();
                await new Promise(r => setTimeout(r, 600));
                return { ok: true };
            })()
        `);
        check('★ 主题能命名保存', savedTheme.ok, savedTheme.why || '');

        // 重开主题弹窗看 chip
        await page.clickText(`${SHELL} .dw-row`, '主题与配色');
        await sleep(800);
        const chipUi = await page.evaluate(`
            (() => {
                const shell = document.querySelector('${SHELL}');
                const chips = [...shell.querySelectorAll('.dw-theme-chip')];
                const first = chips[0];
                return {
                    n: chips.length,
                    name: first?.querySelector('.dw-theme-chip-main')?.textContent.trim() || '',
                    acts: first ? first.querySelectorAll('.dw-theme-chip-act').length : 0,
                    hasDel: !!first?.querySelector('.dw-theme-chip-del'),
                };
            })()
        `);
        check('保存的主题出现在列表里', chipUi.n >= 1, `${chipUi.n} 个：${chipUi.name}`);
        check('★ 每条有改名 + 覆盖两个按钮', chipUi.acts === 2, String(chipUi.acts));
        check('★ 每条有删除按钮', chipUi.hasDel);
        await page.screenshot('04-theme');

        // 关掉弹窗（没点应用）→ 颜色退回去
        await page.evaluate(`
            (() => {
                const overlay = document.querySelector('${SHELL} .dw-theme-modal.ac-overlay');
                if (overlay) overlay.click();
            })()
        `);
        await sleep(700);

        section('控制台');
        const errs = page.errors();
        check('没有 JS 报错', errs.length === 0, errs.slice(0, 4).join(' | '));
    } catch (err) {
        console.error('\n探针崩了：', err.message);
        check('探针跑完', false, err.message);
        try { await page.screenshot('99-crash'); } catch (_) { /* noop */ }
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

run();
