/**
 * murmur 的提示词预览卡片 == 聊天里真正发出去的卡片
 *
 * 判据不是「看着差不多」，而是**同一段数据画出来的 HTML 逐字符相同**。
 */
import { launch, openApp, check, section, report, sleep } from './__probe-kit.mjs';

async function run() {
    const { page, close } = await launch({ port: 9421, prefix: 'card-probe' });

    try {
        await openApp(page, 'chat', { settleMs: 1500 });

        section('预览 == 真实卡片本体');
        const cmp = await page.evaluate(`
            (async () => {
                const sc = await import('/js/apps/chat-app/components/share-cards.js');
                const pc = await import('/js/apps/chat-app/components/app-prompt-card.js');
                const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();

                const cases = [
                    {
                        type: 'red-packet-card',
                        data: { message: '恭喜发财', senderName: '小听', style: 'normal' },
                        real: () => sc.renderShareCardBody('redpacket', { message: '恭喜发财', senderName: '小听', style: 'normal' }, { interactive: false }),
                    },
                    {
                        type: 'location-card',
                        data: { name: '星巴克', address: '朝阳区某某路 1 号' },
                        real: () => sc.renderShareCardBody('location', { name: '星巴克', address: '朝阳区某某路 1 号' }, { interactive: false }),
                    },
                    {
                        type: 'music-card',
                        data: { title: '示例曲', artist: '小听', color: '#fb7299' },
                        real: () => sc.renderShareCardBody('song', { title: '示例曲', artist: '小听', color: '#fb7299' }, { interactive: false }),
                    },
                    {
                        type: 'transfer-card',
                        data: { amount: 88, note: '奶茶钱', received: false },
                        real: () => sc.renderShareCardBody('transfer', { amount: 88, note: '奶茶钱', received: false }, { interactive: false }),
                    },
                ];

                return cases.map((c) => {
                    const previewHtml = pc.renderAppPromptCardPreview({ previewType: c.type, previewData: c.data });
                    // 预览外面包了一层 .pm-preview-card--real，剥掉再比
                    const inner = previewHtml.replace(/^\\s*<div class="pm-preview-card pm-preview-card--real">/, '').replace(/<\\/div>\\s*$/, '');
                    return {
                        type: c.type,
                        same: norm(inner) === norm(c.real()),
                        preview: norm(inner).slice(0, 70),
                        real: norm(c.real()).slice(0, 70),
                    };
                });
            })()
        `);
        for (const r of cmp) {
            check(`★ ${r.type} 预览和真实卡片一字不差`, r.same,
                r.same ? '' : `预览「${r.preview}」\n              真实「${r.real}」`);
        }

        section('真实气泡里用的也是同一份');
        const bubble = await page.evaluate(`
            (async () => {
                const sc = await import('/js/apps/chat-app/components/share-cards.js');
                const html = sc.renderRedpacketBubble(
                    { id: 'm1', sender: 'ai', senderName: '小听', redpacketCard: { message: '恭喜发财', style: 'normal' } },
                    { name: '小听' }, {},
                );
                return {
                    hasCard: html.includes('redpacket-card'),
                    hasTitle: html.includes('恭喜发财'),
                    hasSender: html.includes('小听 给你发了一个红包'),
                    hasWrapper: html.includes('message-bubble') || html.includes('message-'),
                };
            })()
        `);
        check('气泡里有卡片本体', bubble.hasCard);
        check('文案对', bubble.hasTitle && bubble.hasSender);
        check('外面还是完整气泡（头像/时间）', bubble.hasWrapper);

        section('预览里的卡片不该点了就跳走');
        const nonInteractive = await page.evaluate(`
            (async () => {
                const pc = await import('/js/apps/chat-app/components/app-prompt-card.js');
                const html = pc.renderAppPromptCardPreview({ previewType: 'music-card', previewData: { title: 'x', songId: 1 } });
                return !html.includes('data-app-action');
            })()
        `);
        check('★ 预览卡片没有 data-app-action', nonInteractive);

        section('自定义 CSS 覆盖：一次改两边');
        const cssInfo = await page.evaluate(`
            (async () => {
                const m = await import('/js/components/prompt-studio/core/card-css.js');
                const tpl = m.getDefaultCardCss('red-packet-card');
                m.injectCardCss('probe::rp', '.app-shell[data-app-id="chat"] .redpacket-card { border-radius: 2px; }');
                const el = document.getElementById('pm-card-css-probe__rp');
                const inHead = !!el && el.parentElement === document.head;
                m.injectCardCss('probe::rp', '');
                return {
                    usesRealClass: tpl.includes('.redpacket-card'),
                    notPreviewOnly: !tpl.includes('pm-preview-card--red-packet'),
                    inHead,
                    cleared: !document.getElementById('pm-card-css-probe__rp'),
                };
            })()
        `);
        check('★ 默认 CSS 模板针对真实类名', cssInfo.usesRealClass);
        check('★ 不再是只管预览的类名', cssInfo.notPreviewOnly);
        check('★ 样式注入到 head（聊天里也生效）', cssInfo.inHead);
        check('清空能移除', cssInfo.cleared);

        section('控制台');
        const errs = page.errors();
        check('没有 JS 报错', errs.length === 0, errs.slice(0, 4).join(' | '));
    } catch (err) {
        console.error('\n探针崩了：', err.message);
        check('探针跑完', false, err.message);
    } finally {
        await close();
    }

    process.exit(report() ? 0 : 1);
}

run();
