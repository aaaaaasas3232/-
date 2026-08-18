/**
 * 点灯 · 技能解析回归（不启浏览器）
 *
 * 专打「模型把 starlit JSON 写进正文」那一类：漏围栏、同行、未闭合、
 * 数组被空行拆碎。跑：node tests/e2e/__probe-sl-parser.mjs
 */
import { parseReply, firstSkill, glossTexts, looksLikeSkillDebris } from '../../js/apps/starlit/services/skill-parser.js';
import { resolveLessonBubbles, alignGloss } from '../../js/apps/starlit/services/bubble-split.js';

let passed = 0;
let failed = 0;

function check(name, cond, detail = '') {
    if (cond) {
        passed += 1;
        console.log(`  ✓ ${name}`);
    } else {
        failed += 1;
        console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ''}`);
    }
}

function section(title) {
    console.log(`\n${title}`);
}

section('正规围栏');
{
    const raw = [
        'Good morning!',
        '',
        'I had bread.',
        '',
        '```starlit',
        '{"kind":"gloss","texts":["早上好！","我吃了面包。"]}',
        '```',
    ].join('\n');
    const r = parseReply(raw);
    check('正文只留两段', r.text === 'Good morning!\n\nI had bread.');
    check('抽出 gloss', firstSkill(r.skills, 'gloss')?.kind === 'gloss');
    check('texts 两条', glossTexts(firstSkill(r.skills, 'gloss')).length === 2);
    const plan = resolveLessonBubbles(r.text, glossTexts(firstSkill(r.skills, 'gloss')));
    check('描边对齐', plan.glosses[0] === '早上好！' && plan.glosses[1] === '我吃了面包。');
}

section('同行围栏 / 未闭合');
{
    const same = parseReply('Hello\n\n```starlit {"kind":"gloss","texts":["你好"]}\n```');
    check('同行围栏抠出 gloss', glossTexts(firstSkill(same.skills, 'gloss'))[0] === '你好');
    check('同行围栏正文干净', same.text === 'Hello');

    const open = parseReply('Hello\n\n```starlit\n{"kind":"gloss","texts":["你好"]}');
    check('未闭合围栏也能抠', glossTexts(firstSkill(open.skills, 'gloss'))[0] === '你好');
    check('未闭合后正文干净', open.text === 'Hello');
}

section('没围栏：starlit {json} / 裸 JSON');
{
    const bare = parseReply('おはよう。\n\nstarlit {"kind":"gloss","texts":["早上好。"]}');
    check('bare starlit 抽出', glossTexts(firstSkill(bare.skills, 'gloss'))[0] === '早上好。');
    check('bare starlit 正文干净', bare.text === 'おはよう。');
    check('bare 正文不含 starlit', !/starlit|"kind"/.test(bare.text));

    const naked = parseReply('おはよう。\n\n{"kind":"gloss","texts":["早上好。"]}');
    check('裸 JSON 抽出', glossTexts(firstSkill(naked.skills, 'gloss'))[0] === '早上好。');
    check('裸 JSON 正文干净', naked.text === 'おはよう。');
}

section('用户现场：整段只丢了一个拆碎的 gloss');
{
    const chunks = [
        'starlit {"kind":"gloss","texts":["今天先不急着给规则，你感受一下日语句子长什么样。',
        '","日语和中文最不一样的：动词永远放在最后面。',
        '","わたしはごはんをたべます。 我是我，ごはん是饭，たべます是吃（礼貌形）。',
        '","先盯住这一句：这句里哪个是名词，哪个是动词？ 答出一个就够。 "]}',
    ];
    check('碎片能识别', chunks.every((c) => looksLikeSkillDebris(c)));
    const joined = chunks.join('\n');
    const r = parseReply(joined);
    const texts = glossTexts(firstSkill(r.skills, 'gloss'));
    check('拼回去能解析', texts.length >= 3);
    check('正文不再带 JSON', !r.text.includes('"kind"') && !r.text.includes('starlit'));
    const plan = resolveLessonBubbles(r.text, texts);
    check('空正文时用 gloss 当气泡', plan.bodies.length >= 3 && plan.bodies[0].includes('今天先不急'));
    check('空正文时描边也挂上', plan.glosses.length === plan.bodies.length && plan.glosses.every(Boolean));
    check('气泡里没有协议残骸', plan.bodies.every((b) => !/"kind"|starlit|^\s*",/.test(b)));
}

section('一个围栏里连续两块');
{
    const raw = [
        'Hi.',
        '```starlit',
        '{"kind":"gloss","texts":["嗨。"]}',
        '{"kind":"word","term":"hi","pos":"int.","meaning":"嗨"}',
        '```',
    ].join('\n');
    const r = parseReply(raw);
    check('两块都在', r.skills.length === 2);
    check('word 还在', firstSkill(r.skills, 'word')?.term === 'hi');
}

section('残骸识别不会误伤正常句子');
{
    check('普通中文不是残骸', !looksLikeSkillDebris('今天先不急着给规则，你感受一下。'));
    check('普通日语不是残骸', !looksLikeSkillDebris('わたしはごはんをたべます。'));
}

section('译文按气泡切开，不堆在第一泡');
{
    const bodies = [
        '日语里，动作不凭空发生。',
        '它总得打在一个对象身上：吃打在饭上，喝打在水上。',
    ];
    const dumped = '日语里，动作不凭空发生。它总得打在一个对象身上：吃打在饭上，喝打在水上。';
    const aligned = alignGloss(bodies, [dumped]);
    check('第一泡只拿第一句', aligned[0] === '日语里，动作不凭空发生。', aligned[0]);
    check('第二泡拿剩下那句', aligned[1].includes('吃打在饭上'), aligned[1]);
    check('第一泡不再装着第二句', !aligned[0].includes('吃打在饭上'));

    const oneToOne = alignGloss(['Hello.', 'Bye.'], ['你好。', '再见。']);
    check('本来就一对一时不乱动', oneToOne[0] === '你好。' && oneToOne[1] === '再见。');
}

console.log(`\n${passed} 过 / ${failed} 败`);
if (failed) process.exit(1);
