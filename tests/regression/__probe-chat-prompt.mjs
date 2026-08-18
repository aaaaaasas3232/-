/**
 * murmur 回复提示词 —— 「预览里看到的 == 真正发出去的」回归探针
 *
 * 这一坨的历史病灶全是同一类:**开关能点、界面会变、AI 那边照旧**。
 * 所以断言全都盯着「链路有没有真的接上」,而不是界面长什么样:
 *
 *   ① 整组开关 / 卡片开关是同一份存储 —— prompt-manager 拼 pre 和 ai-service
 *      追加实时块读的必须是同一张表,不然「关了照样发」会重新长出来
 *   ② 实时块(一起听 / 四叶草 / 灯塔 / 日记)只声明一次,收集时吃开关、剪切时剪干净
 *   ③ 段落标签:卡片自带 tag 优先,「当前聊天回合」能被整段搬到末尾
 *   ④ 人设卡不再吐出光秃秃的 `age:`
 *   ⑤ 对话总则常量存在且讲清楚了标签约定
 *
 * 纯逻辑,不需要浏览器:
 *   node --experimental-loader ./__loader-alias.mjs tests/regression/__probe-chat-prompt.mjs
 */

// ── 最小 window / localStorage 桩(必须在 import 业务模块之前装好)────────────
const _store = new Map();
globalThis.localStorage = {
    getItem: (k) => (_store.has(k) ? _store.get(k) : null),
    setItem: (k, v) => { _store.set(String(k), String(v)); },
    removeItem: (k) => { _store.delete(k); },
    clear: () => { _store.clear(); },
};
globalThis.window = globalThis.window || globalThis;
globalThis.window.localStorage = globalThis.localStorage;

const {
    makeOwnerKey, isGroupEnabled, toggleGroupEnabled,
    isCardEnabled, toggleCardEnabled, _resetPromptToggles,
} = await import('../../js/apps/chat-app/services/prompt-toggles.js');
const {
    LIVE_CONTEXT_BLOCKS, collectLiveContextBlocks, stripLiveContextBlocks,
} = await import('../../js/apps/chat-app/services/live-context-registry.js');
const {
    wrapPromptBlock, stripPromptBlock, readPromptBlock, hasPromptBlock, resolveTagName,
} = await import('../../js/apps/chat-app/services/prompt-tags.js');
const { buildContextFromPersona } = await import('../../js/apps/setting/persona/context-text.js');
const { CHAT_PREAMBLE_INSTRUCTIONS } = await import('../../js/apps/chat-app/services/reply-format-instructions.js');

const results = [];
function check(label, ok, detail = '') {
    results.push({ label, ok });
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ============================================================
// ① 开关存储
// ============================================================
console.log('\n── 整组 / 卡片开关 ──────────────────────');
_resetPromptToggles();

const owner = makeOwnerKey({ aiPersonId: 'ai0' });
const groupOwner = makeOwnerKey({ aiPersonId: 'anything', isGroup: true, groupId: 'g1' });

check('私聊 ownerKey = aiPersonId', owner === 'ai0', owner);
check('群聊 ownerKey 带 group:: 前缀,不会和私聊撞车', groupOwner === 'group::g1', groupOwner);
check('没写过的组默认是开的(老用户升级上来什么都不会被关掉)', isGroupEnabled(owner, 'nook') === true);
check('没写过的卡默认是开的', isCardEnabled(owner, 'chat-preamble') === true);

check('关掉 nook 组', toggleGroupEnabled(owner, 'nook') === false);
check('关掉后读出来也是关的', isGroupEnabled(owner, 'nook') === false);
check('只影响这一组', isGroupEnabled(owner, 'murmur') === true);
check('只影响这个 AI', isGroupEnabled('ai1', 'nook') === true);
check('再点一次能开回来', toggleGroupEnabled(owner, 'nook') === true);

check('关掉一张卡', toggleCardEnabled(owner, 'listen-together') === false);
check('卡片开关和组开关互不干扰', isGroupEnabled(owner, 'music') === true && isCardEnabled(owner, 'listen-together') === false);
// 「预览端和发送端读的是同一份」的物理保证:两边都只 import 这个模块,
// 而这个模块的状态过得了 localStorage 这一关(发送端可能在另一次渲染周期里读)
const persisted = JSON.parse(globalThis.localStorage.getItem('xiaoting::chat-prompt-card-inject-v1') || '{}');
check('卡片开关落盘了(ai-service 在另一个时刻读得到)', persisted?.ai0?.['listen-together'] === false, JSON.stringify(persisted));
toggleCardEnabled(owner, 'listen-together');

// ============================================================
// ② 实时块注册表
// ============================================================
console.log('\n── 实时块(一起听 / 四叶草 / 灯塔 / 日记)──');

check('四段全在注册表里', LIVE_CONTEXT_BLOCKS.length === 4, LIVE_CONTEXT_BLOCKS.map((b) => b.id).join(','));
check('四叶草和灯塔也在(以前它们只在 ai-service 里被追加,预览完全看不到)',
    LIVE_CONTEXT_BLOCKS.some((b) => b.id === 'shop-live') && LIVE_CONTEXT_BLOCKS.some((b) => b.id === 'job-live'));

// 装两个供给方:音乐(自带 strip)、日记(只有 getContext)
globalThis.window.__musicListenTogether = {
    getContext: (aiId) => (aiId === 'ai0' ? '正在和你一起听《枕边童话》,唱到第 3 句' : ''),
    strip: (t) => String(t || '').replace('LEGACY-LT-BLOCK', '').trim(),
};
globalThis.window.__diaryContext = {
    getContext: () => '经期第 3 天',
};
delete globalThis.window.__shopContext;
delete globalThis.window.__jobContext;

const all = collectLiveContextBlocks('ai0');
check('只收到装了的那两段', all.length === 2, all.map((b) => b.id).join(','));
check('没装的 App 不会凭空造段', !all.some((b) => b.id === 'shop-live'));

const filtered = collectLiveContextBlocks('ai0', { isEnabled: (b) => b.id !== 'listen-together' });
check('isEnabled 说不要就真的不算(关掉的卡连 getContext 都不调)',
    filtered.length === 1 && filtered[0].id === 'diary-live', filtered.map((b) => b.id).join(','));

const otherAi = collectLiveContextBlocks('ai9');
check('一起听按 aiPersonId 分,别人那边是空的', !otherAi.some((b) => b.id === 'listen-together'));

const dirty = [
    wrapPromptBlock('用户人设', '# 角色卡: 我'),
    wrapPromptBlock('一起听', '过期的歌词进度'),
    wrapPromptBlock('日记本', '过期的经期天数'),
    'LEGACY-LT-BLOCK',
].join('\n\n');
const cleaned = stripLiveContextBlocks(dirty);
check('旧的一起听段被剪掉', !hasPromptBlock(cleaned, '一起听'));
check('旧的日记段被剪掉', !hasPromptBlock(cleaned, '日记本'));
check('供给方自己的 strip 也跑了(剪得掉没有标签的老快照)', !cleaned.includes('LEGACY-LT-BLOCK'), cleaned.replace(/\n/g, '⏎'));
check('别人的段一个字没动', hasPromptBlock(cleaned, '用户人设'));

// ============================================================
// ③ 段落标签 + 「当前聊天回合」归位
// ============================================================
console.log('\n── 标签与段落顺序 ───────────────────────');

check('卡片自带 tag 时以它为准', resolveTagName({ id: 'x', title: '一起听（实时）', tag: '一起听' }) === '一起听');
check('实时块 id 也能解析出标签(老 pre 里没有 tag 字段)', resolveTagName({ id: 'shop-live' }) === '四叶草购物');
check('总纲有自己的标签', resolveTagName({ id: 'chat-preamble' }) === '对话总则');

// ai-service 发送前那一步:所有实时块 / K 链 / 群花名册都是往末尾追加的,
// 追加完必须把聊天记录重新拽回最后一段 —— 否则刚发生的对话被背景资料压在中间。
let prompt = [
    wrapPromptBlock('AI人设', '# 角色卡: 阿澈'),
    wrapPromptBlock('当前聊天回合', '用户: 在吗\nAI: 在的'),
].join('\n\n');
prompt = `${prompt}\n\n${wrapPromptBlock('一起听', '正在听《枕边童话》')}`;
prompt = `${prompt}\n\n${wrapPromptBlock('群成员与职务', '群主: 阿澈')}`;

const rounds = readPromptBlock(prompt, '当前聊天回合');
prompt = `${stripPromptBlock(prompt, '当前聊天回合')}\n\n${wrapPromptBlock('当前聊天回合', rounds)}`.trim();

check('读得出整段回合正文', rounds.includes('在吗') && rounds.includes('在的'), rounds.replace(/\n/g, ' / '));
check('回合被搬到了最后一段', prompt.trimEnd().endsWith('<当前聊天回合结束>'), prompt.slice(-40).replace(/\n/g, '⏎'));
check('搬完只剩一份,没有搬成两份', prompt.split('<当前聊天回合开始>').length - 1 === 1);
check('中间那些段还在', hasPromptBlock(prompt, '一起听') && hasPromptBlock(prompt, '群成员与职务') && hasPromptBlock(prompt, 'AI人设'));

// ============================================================
// ④ 人设卡不吐空字段
// ============================================================
console.log('\n── 人设卡正文 ───────────────────────────');

globalThis.window.settingsSdk = undefined;
const emptyAge = buildContextFromPersona({ name: '我', chineseName: '我', age: '' }, 'user');
check('年龄没填时不写 `age:` 这一行', !/age:\s*$/m.test(emptyAge), emptyAge.replace(/\n/g, '⏎'));
check('名字还在', emptyAge.includes('chineseName: 我'));

const realAge = buildContextFromPersona({ name: '我', chineseName: '我', age: 24 }, 'user');
check('填了年龄照常输出', realAge.includes('age: 24'));
const zeroAge = buildContextFromPersona({ name: '我', chineseName: '我', age: 0 }, 'user');
check('age = 0 不算空(修空值时最容易顺手误伤的一个)', zeroAge.includes('age: 0'));

// ============================================================
// ⑤ 对话总则
// ============================================================
console.log('\n── 对话总则 ─────────────────────────────');
check('常量存在且不是空串', typeof CHAT_PREAMBLE_INSTRUCTIONS === 'string' && CHAT_PREAMBLE_INSTRUCTIONS.length > 60);
check('讲清楚了 <XX开始> 是段落边界不是台词', CHAT_PREAMBLE_INSTRUCTIONS.includes('<XX开始>'));
check('给了冲突时的优先级', CHAT_PREAMBLE_INSTRUCTIONS.includes('优先级'));

// ============================================================
const failed = results.filter((r) => !r.ok);
console.log(`\n${'─'.repeat(44)}`);
console.log(`共 ${results.length} 项,通过 ${results.length - failed.length},失败 ${failed.length}`);
if (failed.length > 0) {
    failed.forEach((r) => console.log(`  ✗ ${r.label}`));
    process.exit(1);
}
