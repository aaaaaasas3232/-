/**
 * 梦境编织 · 正则替换系统：三种模式 + 效果预览 + HTML 消毒
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

const SHELL = '.app-shell[data-app-id="dream-weaver"]';

async function run() {
    const { page, close } = await launch({ port: 9418, prefix: 'dwre-probe' });

    try {
        await openApp(page, 'dream-weaver', { settleMs: 2000 });
        await page.waitFor(`document.querySelector('${SHELL} .dw-root')`, { label: '根组件' });

        section('切分服务：三种模式');
        const svc = await page.evaluate(`
            (async () => {
                // 这里可以直接 import：只是跑纯函数，不碰 App 的 STATE 单例
                const m = await import('/js/apps/dream-weaver/services/format-service.js');
                const seg = m.segmentContent('她递来一颗[糖果]，说“给你”。', {
                    rules: [
                        { pattern: '\\\\[糖果\\\\]', flags: 'g', mode: 'html', enabled: true,
                          replacement: '<svg viewBox="0 0 24 24" width="16"><circle cx="12" cy="12" r="5" fill="#f7a"/></svg>' },
                        { pattern: '[“"]([^”"]+)[”"]', flags: 'g', mode: 'segment', kind: 'dialogue', enabled: true },
                    ],
                });
                const rep = m.segmentContent('把甲换成乙：甲甲甲', {
                    rules: [{ pattern: '甲', flags: 'g', mode: 'replace', replacement: '乙', enabled: true }],
                });
                const xss = m.segmentContent('[危险]', {
                    rules: [{ pattern: '\\\\[危险\\\\]', flags: 'g', mode: 'html', enabled: true,
                              replacement: '<span onclick="alert(1)"><script>alert(2)<\\/script>好</span>' }],
                });
                const injected = m.segmentContent('[标签:<img src=x onerror=alert(1)>]', {
                    rules: [{ pattern: '\\\\[标签:([^\\\\]]+)\\\\]', flags: 'g', mode: 'html', enabled: true,
                              replacement: '<span>$1</span>' }],
                });
                const prev = m.previewRule(
                    { pattern: '\\\\[糖果\\\\]', flags: 'g', mode: 'html',
                      replacement: '<svg viewBox="0 0 24 24" width="16"><circle cx="12" cy="12" r="5" fill="#f7a"/></svg>' },
                    '来一颗[糖果]',
                );
                return {
                    types: seg.map(s => s.type),
                    htmlSeg: seg.find(s => s.type === 'html')?.html || '',
                    dialogue: seg.find(s => s.type === 'dialogue')?.text || '',
                    replaced: rep.map(s => s.text).join(''),
                    xssHtml: xss.find(s => s.type === 'html')?.html ?? '(没产出)',
                    injectedHtml: injected.find(s => s.type === 'html')?.html ?? '(没产出)',
                    prevTypes: prev.map(s => s.type),
                };
            })()
        `);
        check('HTML 模式产出 html 片段', svc.types.includes('html'), svc.types.join(','));
        check('画出来的是真 SVG', svc.htmlSeg.includes('<svg'), svc.htmlSeg.slice(0, 50));
        check('同一段里标记规则照常工作', svc.dialogue === '给你', svc.dialogue);
        check('★ 换文字模式真的换了', svc.replaced === '把乙换成乙：乙乙乙', svc.replaced);
        check('★ 模板里的 onclick 被洗掉', !svc.xssHtml.includes('onclick'), svc.xssHtml.slice(0, 60));
        check('★ 模板里的 script 被洗掉', !svc.xssHtml.includes('<script'), svc.xssHtml.slice(0, 60));
        // 转义正确 = 注入的标签变成了实体文本，DOM 里不会真的多出一个 <img>
        check('★ 捕获组里的注入被转义',
            !svc.injectedHtml.includes('<img') && svc.injectedHtml.includes('&lt;img'),
            svc.injectedHtml.slice(0, 80));
        check('previewRule 和正文走同一条路', svc.prevTypes.includes('html'), svc.prevTypes.join(','));

        section('规则编辑器 UI');
        await page.clickText(`${SHELL} .dw-tabbar-item`, '我的');
        await sleep(700);
        // ★ 不能按整行 textContent 找：「对话渲染成气泡」那行的说明里也写着「正则规则」，
        //   会被先命中，结果点成了一个开关。按 label 精确匹配。
        await page.evaluate(`
            (() => {
                const rows = [...document.querySelectorAll('${SHELL} .dw-row')];
                const row = rows.find(r => (r.querySelector('.dw-row-label')?.textContent || '').trim() === '正则规则');
                if (row) { row.scrollIntoView({ block: 'center' }); row.click(); return true; }
                return false;
            })()
        `);
        await sleep(900);
        check('规则弹窗打开', await page.exists(`${SHELL} .dw-regex-modal`));
        const list = await page.evaluate(`
            (() => {
                const rows = [...document.querySelectorAll('${SHELL} .dw-rule-row')];
                return {
                    n: rows.length,
                    tags: rows.map(r => r.querySelector('.dw-rule-mode-tag')?.textContent.trim() || ''),
                };
            })()
        `);
        check('规则列表有内容', list.n >= 3, `${list.n} 条`);
        check('★ 每条标了工作方式', list.tags.filter(Boolean).length === list.n, list.tags.join('/'));
        check('★ 内置了「画出来」的示例', list.tags.includes('绘制'), list.tags.join('/'));
        await page.screenshot('01-rule-list');

        // 进「画出来」那条的编辑页
        const opened = await page.evaluate(`
            (() => {
                const rows = [...document.querySelectorAll('${SHELL} .dw-rule-row')];
                const row = rows.find(r => (r.textContent || '').includes('糖果'));
                if (!row) return false;
                row.querySelector('.dw-nav-icon-btn').click();
                return true;
            })()
        `);
        await sleep(700);
        check('打开了糖果规则', opened);
        const editor = await page.evaluate(`
            (() => {
                const shell = document.querySelector('${SHELL}');
                const txt = shell.textContent || '';
                return {
                    hasModes: txt.includes('只标记') && txt.includes('换文字') && txt.includes('画出来'),
                    hasPreview: !!shell.querySelector('.dw-rule-preview'),
                    hasSnippets: shell.querySelectorAll('.dw-rule-snippet').length,
                    previewHtml: shell.querySelector('.dw-rule-preview .dw-seg--html')?.innerHTML || '',
                    count: shell.querySelector('.dw-rule-preview-count')?.textContent.trim() || '',
                };
            })()
        `);
        check('三种工作方式都能选', editor.hasModes);
        check('★ 有效果预览区', editor.hasPreview);
        check('★ 预览里真的画出了糖', editor.previewHtml.includes('<svg'), editor.previewHtml.slice(0, 40) || '(空)');
        check('有现成模板可以套', editor.hasSnippets >= 4, `${editor.hasSnippets} 个`);
        check('显示命中数', editor.count.includes('命中'), editor.count);
        await page.screenshot('02-rule-editor');

        section('控制台');
        const errs = page.errors();
        check('没有 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '));
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
