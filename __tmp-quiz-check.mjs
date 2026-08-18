import { matchOption, registerCustomSets, getQuestion, countQuestions, getSet, listSets } from './js/apps/persona-lab/question-bank.js';
import { parseQuizText, describeSet, QUIZ_FORMAT_GUIDE } from './js/apps/persona-lab/services/quiz-format.js';

let pass = 0;
let fail = 0;
const t = (label, ok, detail = '') => {
    if (ok) { pass += 1; console.log(`  ok  ${label}`); }
    else { fail += 1; console.log(`  FAIL ${label} ${detail}`); }
};

const OPTS = ['很主动，喜欢认识新的人', '看情况，只跟聊得来的说', '偏观察，参与得少', '会找机会躲开'];

console.log('\n— matchOption —');
t('整句就是选项', matchOption('偏观察，参与得少', OPTS) === 2);
t('选项出现在回答里', matchOption('大概是偏观察，参与得少吧，我不太爱先开口。', OPTS) === 2);
t('序号开头', matchOption('2. 看情况', OPTS) === 1);
t('圆圈序号', matchOption('④ 会找机会躲开', OPTS) === 3);
t('句中写第几个', matchOption('我想想，我选第3个吧，人多的时候先听。', OPTS) === 2);
t('半句也算落到选项', matchOption('我比较偏观察，人多的时候不太想掺和。', OPTS) === 2);
t('答了就必须落到一项', matchOption('这些都不太像我，我一般先看看再说。', OPTS) >= 0, String(matchOption('这些都不太像我，我一般先看看再说。', OPTS)));
t('空回答 → -1', matchOption('', OPTS) === -1);
t('擂台：结论在后面', matchOption('比起狗，她更愿意是猫。', ['狗', '猫']) === 1, String(matchOption('比起狗，她更愿意是猫。', ['狗', '猫'])));
t('擂台：只提一个', matchOption('还是狗吧。', ['狗', '猫']) === 0);

console.log('\n— 内置题库 —');
t('内置 6 套', listSets().length === 6, String(listSets().length));
t('固定题 16 题', countQuestions('mbti') === 16);
const ladder0 = getQuestion('animal', 0, {});
t('擂台第一轮是池子前两个', ladder0.options.join('/') === '狗/猫', ladder0.options.join('/'));
const ladder1 = getQuestion('animal', 1, { 0: '猫' });
t('第一轮选了挑战者 → 它当擂主', ladder1.options.join('/') === '猫/兔子', ladder1.options.join('/'));
const ladder1b = getQuestion('animal', 1, {});
t('没落到选项 → 擂主留任', ladder1b.options.join('/') === '狗/兔子', ladder1b.options.join('/'));

console.log('\n— parseQuizText —');
const FIXED = `
题库：童年底色
说明：问她是怎么长大的
类型：固定

问：小时候家里最常有的声音是什么？
选：电视一直开着
选：谁在厨房忙
- 很安静
1. 外面街上的动静

问：那时候你放学先去哪？
选：直接回家
选：绕远路
`;
const r1 = parseQuizText(FIXED);
t('解析出 1 套', r1.sets.length === 1, JSON.stringify(r1.notes));
t('2 道题', r1.sets[0]?.questions.length === 2);
t('列表符号也算选项', r1.sets[0]?.options[0].length === 4, JSON.stringify(r1.sets[0]?.options[0]));
t('名字取自「题库：」', r1.sets[0]?.name === '童年底色', r1.sets[0]?.name);
t('概述', describeSet(r1.sets[0]) === '2 题 · 2 题带选项', describeSet(r1.sets[0]));

const LADDER = `
题库：她更受不了哪个
类型：擂台
提示：这两件事，她更能忍哪个？
轮数：12
项：说话不算数
项：当众开她玩笑
项：擅自替她做决定
项：借了东西不还
`;
const r2 = parseQuizText(LADDER);
t('擂台解析', r2.sets[0]?.kind === 'ladder' && r2.sets[0]?.pool.length === 4, JSON.stringify(r2.sets[0]));
t('轮数被池子大小夹住', r2.sets[0]?.rounds === 3, String(r2.sets[0]?.rounds));

const MULTI = parseQuizText(FIXED + '\n' + LADDER);
t('一次多套', MULTI.sets.length === 2, String(MULTI.sets.length));

const JUNK = parseQuizText('这是一段闲聊，没有任何题目。\n随便写点什么。');
t('没题目 → 一套都不给', JUNK.sets.length === 0);
t('并且逐行报出来', JUNK.notes.length === 2, JSON.stringify(JUNK.notes));

const LOOSE = parseQuizText('问：你怕黑吗？\n选：怕\n选：不怕');
t('没写「题库：」也能吃进去', LOOSE.sets.length === 1 && LOOSE.sets[0].name === '你怕黑吗？', JSON.stringify(LOOSE.sets[0]?.name));

const ORPHAN = parseQuizText('题库：测试\n选：孤儿选项\n问：真问题\n选：A项');
t('选项在「问」之前 → 报一条提示', ORPHAN.notes.some((n) => n.includes('写在「问」前面')), JSON.stringify(ORPHAN.notes));
t('后面的题照收', ORPHAN.sets[0]?.questions.length === 1);

console.log('\n— 自定义题库接进 getQuestion —');
registerCustomSets([{ ...r1.sets[0], id: 'custom-1' }]);
t('列表里多一套', listSets().length === 7);
t('能按 id 取到', getSet('custom-1')?.name === '童年底色');
t('题数对', countQuestions('custom-1') === 2);
t('取到第 2 题', getQuestion('custom-1', 1, {})?.question === '那时候你放学先去哪？');
registerCustomSets([]);
t('注销之后取不到', getSet('custom-1') === null && listSets().length === 6);

console.log('\n— 格式说明 —');
t('说明本身能被解析回来（AI 照抄也不会炸）', parseQuizText(QUIZ_FORMAT_GUIDE).sets.length >= 2,
    JSON.stringify(parseQuizText(QUIZ_FORMAT_GUIDE).sets.map((s) => s.name)));

console.log(`\n${pass} / ${pass + fail} 通过`);
process.exitCode = fail ? 1 : 0;
