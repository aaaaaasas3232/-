/**
 * 群聊小游戏 / 提示词生成器
 *
 * 仿「App 制作」那套：用户回答几个问题 → 生成一份**足够详细、AI 照着写就能跑**
 * 的提示词 → 拿去问 AI → 把回来的 JS 上传回小游戏页 → 每个群都能玩。
 *
 * ── 为什么提示词要写这么长 ────────────────────────────────────────
 *
 * 上传的玩法不是普通脚本，它要接进一套已经存在的骨架：
 * 调度器按 step 名字调它、界面只订阅状态、用户随时可能切出去。
 * 这些约束不写清楚，AI 会很自然地写出 `setTimeout` + `document.querySelector`
 * ——代码看着没毛病，装上去一切出界面就「AI 不动了」，而且不报错。
 *
 * 所以提示词里必须钉死四件事：
 *   1. 不许 import（运行时加载，没有构建）
 *   2. 不许 setTimeout（用 kit.schedule，把「待办」写成数据）
 *   3. 不许碰 DOM（引擎只读写 session）
 *   4. 每一步都要有名字（调度器按名字调，也才排查得了）
 */

const FLOW_PRESETS = [
    {
        id: 'round-speak',
        name: '轮流发言型',
        desc: '每人依次说一段，说完进入下一环节。谁是卧底、剧本杀都是这种。',
        steps: '开局 → 逐个发言 → 讨论 → 投票 → 结算 → 下一轮',
    },
    {
        id: 'day-night',
        name: '昼夜交替型',
        desc: '夜里各角色秘密行动，白天公开讨论投票。狼人杀是这种。',
        steps: '入夜 → 各角色行动 → 天亮播报 → 发言 → 投票 → 入夜',
    },
    {
        id: 'turn-based',
        name: '回合制走子型',
        desc: '按座位轮流操作，每回合一个人动。大富翁、飞行棋是这种。',
        steps: '轮到某人 → 他操作（掷骰/出牌）→ 结算 → 交给下一位',
    },
    {
        id: 'coop',
        name: '合作闯关型',
        desc: '所有人一起对抗规则本身，没有互相淘汰。密室、解谜是这种。',
        steps: '出题 → 大家依次给线索/答案 → 判定 → 下一关',
    },
    {
        id: 'freeform',
        name: '自由互动型',
        desc: '没有固定轮次，用户点什么就发生什么。真心话大冒险、抽签是这种。',
        steps: '用户选动作 → AI 响应 → 记一笔 → 等下一次操作',
    },
];

const WIN_PRESETS = [
    { id: 'elimination', name: '淘汰制', desc: '一方全部出局就分胜负' },
    { id: 'score', name: '积分制', desc: '到达目标分数或回合数结束时比分' },
    { id: 'survival', name: '生存制', desc: '撑过 N 轮就算赢' },
    { id: 'guess', name: '猜中即胜', desc: '猜对答案立刻结束' },
    { id: 'endless', name: '不分胜负', desc: '玩够了手动结束，只留记录' },
];

export const GAME_FLOW_PRESETS = FLOW_PRESETS;
export const GAME_WIN_PRESETS = WIN_PRESETS;

export function createDefaultGameAnswers() {
    return {
        name: '',
        gameId: '',
        desc: '',
        tone: 'blue',
        minPlayers: 3,
        maxPlayers: 8,
        flow: 'round-speak',
        winRule: 'elimination',
        hasRoles: true,
        roles: '',
        userPlays: true,
        aiSpeaks: true,
        needsInput: true,
        rounds: 3,
        extraRules: '',
    };
}

/** 名字 → 一个能当 id 用的英文 slug */
export function slugifyGameId(name, fallback = 'my-game') {
    const raw = String(name || '').trim().toLowerCase();
    const ascii = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (ascii && /^[a-z]/.test(ascii)) return ascii.slice(0, 24);
    // 中文名转不出来就用哈希，保证稳定且合法
    let h = 0;
    for (let i = 0; i < raw.length; i += 1) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
    return `${fallback}-${h.toString(36).slice(0, 6)}`;
}

function pick(list, id) {
    return list.find((x) => x.id === id) || list[0];
}

/**
 * 生成提示词。
 * @param {object} answers createDefaultGameAnswers() 的形状
 * @returns {string} Markdown 提示词
 */
export function buildGamePrompt(answers = {}) {
    const a = { ...createDefaultGameAnswers(), ...answers };
    const gameId = a.gameId || slugifyGameId(a.name);
    const flow = pick(FLOW_PRESETS, a.flow);
    const win = pick(WIN_PRESETS, a.winRule);
    const name = a.name || '我的小游戏';

    return `# 帮我写一个群聊小游戏

你要产出**一个 JS 文件**，我会把它上传到「小听」这个手机模拟器里 murmur 的小游戏页。
装上之后，我的每个群聊都能开这一局，和内置的狼人杀、谁是卧底、大富翁平级。

## 一、我想要的游戏

| 项 | 值 |
|---|---|
| 名字 | ${name} |
| id | \`${gameId}\`（只能小写字母 / 数字 / 连字符，不能和 werewolf / undercover / monopoly 撞） |
| 一句话介绍 | ${a.desc || '（你按玩法补一句）'} |
| 人数 | ${a.minPlayers} - ${a.maxPlayers} 人（**含我自己**） |
| 配色 | \`${a.tone}\` |
| 流程类型 | **${flow.name}** —— ${flow.desc}<br>典型节奏：${flow.steps} |
| 胜负判定 | **${win.name}** —— ${win.desc} |
| 有身份牌吗 | ${a.hasRoles ? `有：${a.roles || '（你按玩法设计几个身份）'}` : '没有，所有人一样'} |
| 我参不参与 | ${a.userPlays ? '参与（要有我的操作界面）' : '不参与，我只看 AI 之间玩（上帝视角）'} |
| AI 要说话吗 | ${a.aiSpeaks ? '要，每个 AI 都按自己的人设发言' : '不用，AI 只做选择不说话'} |
| 要我打字吗 | ${a.needsInput ? '要，有需要我输入文字的环节' : '不用，我只点按钮'} |
| 大概几轮 | ${a.rounds} 轮左右 |
${a.extraRules ? `\n**我额外想要的规则**：\n${a.extraRules}\n` : ''}
## 二、文件长什么样（照抄这个骨架）

\`\`\`js
// ${name}
// 上传到 murmur → 小游戏 → 做一个新游戏 → 上传玩法文件

const kit = window.__chatGameKit;

export default {
    meta: {
        id: '${gameId}',
        name: '${name}',
        desc: '${a.desc || '一句话介绍'}',
        tone: '${a.tone}',              // blue / pink / slate / violet / amber
        minPlayers: ${a.minPlayers},
        maxPlayers: ${a.maxPlayers},
        tag: '${a.minPlayers}-${a.maxPlayers} 人',
    },

    /** 开局：发身份 / 铺场，并排出第一步 */
    setup(session) {
        session.players.forEach((p, i) => {
            p.role = /* 按玩法分配 */ 'player';
            p.alive = true;
        });
        session.round = 1;
        kit.setPhase(session, 'opening', '准备开始');
        kit.addLog(session, { kind: 'system', text: '${name} 开始了' });
        kit.schedule(session, 'openRound', 600);   // ★ 不是 setTimeout
    },

    /** 步骤执行器：调度器按名字调这里 */
    async runStep(session, step, payload) {
        switch (step) {
            case 'openRound':
                kit.setPhase(session, 'speaking', \`第 \${session.round} 轮\`);
                kit.schedule(session, 'nextSpeaker', 500, { index: 0 });
                return;

            case 'nextSpeaker': {
                const order = kit.alivePlayers(session);
                const player = order[payload.index];
                if (!player) { kit.schedule(session, 'toVote', 500); return; }
                if (player.isUser) {
                    // 轮到我：把球交出去，不排下一步、不设倒计时
                    kit.awaitUser(session, 'speech', { index: payload.index });
                    return;
                }
                await kit.withBusy(session, step, \`\${player.name} 正在想…\`, async () => {
                    const reply = await kit.askAi({
                        session, player,
                        system: '（这里写这个 AI 此刻知道什么、该以什么身份说话）',
                        user: '（这里写「现在请你说一段」）',
                    });
                    kit.addLog(session, { kind: 'speech', playerId: player.id, text: kit.cleanSpeech(reply) });
                }, payload);
                kit.schedule(session, 'nextSpeaker', 800, { index: payload.index + 1 });
                return;
            }

            // …其余步骤同理，每一步都要有名字
        }
    },

    /** 我点了操作区里的按钮 */
    async handleUserAction(session, action, payload) {
        if (action === 'speech') {
            kit.addLog(session, { kind: 'speech', playerId: kit.USER_PLAYER_ID, text: payload.text || '' });
            kit.clearPending(session);
            kit.schedule(session, 'nextSpeaker', 300, { index: (payload.index ?? 0) + 1 });
        }
    },

    /** 画界面。只读 session，返回结构，不碰 DOM */
    buildView(session) {
        return {
            tone: '${a.tone}',
            title: '${name}',
            subtitle: \`第 \${session.round} 轮\`,
            right: '',
            head: kit.ui.seatStrip(session.players, { session }),
            action: session.pending?.action === 'speech'
                ? kit.ui.textInput({ placeholder: '说点什么…', submit: { action: 'speech' } })
                : kit.ui.thinking('等待中'),
            viewerId: kit.USER_PLAYER_ID,
        };
    },

    /** 结算屏 */
    buildResult(session) {
        return kit.ui.resultPanel({
            title: session.winner ? \`\${session.winner} 获胜\` : '本局结束',
            summary: session.result?.summary || '',
            players: session.players,
        });
    },
};
\`\`\`

## 三、四条硬约束（违反其中任何一条，装上去都会「看着没错但就是不动」）

1. **一行 \`import\` 都不能写。**
   这个文件是运行时用 \`import(blobURL)\` 加载的，没有构建步骤、没有 importmap，
   任何相对路径和 \`@\` 别名都会抛 \`Failed to resolve module specifier\`。
   需要的一切都在 \`window.__chatGameKit\` 上（清单见第四节）。

2. **不许用 \`setTimeout\`。**
   「等一会儿再做某事」要写成 \`kit.schedule(session, '步骤名', 毫秒, payload)\`。
   setTimeout 是闭包 —— 用户切出对局页去别的 App 聊天、或者刷新页面，
   整条流程就断在半路，而且异常会被吞掉，界面上**什么都不会发生**，
   用户只会看到「AI 不动了」。schedule 把待办写成数据存进对局，切走也照跑。

3. **引擎里一行 DOM 都不能碰。**
   不许 \`document.querySelector\`、不许 \`innerHTML\`。
   状态写进 session，界面由 \`buildView\` 按当前状态重画。
   用户回到这一页时看到的就是最新状态。

4. **每一步都要有名字。**
   \`runStep\` 的 switch 分支就是步骤名。不能写匿名回调 ——
   有名字之后「现在卡在哪一步」才是可打印、可排查的。

## 四、能用的 API（\`window.__chatGameKit\`）

**流程**
- \`kit.schedule(session, step, delayMs, payload)\` 排下一步
- \`kit.awaitUser(session, action, data)\` 把球交给用户（**不设超时**，他可能去别的 App 待很久）
- \`kit.clearPending(session)\` 用户操作完，清掉等待态
- \`kit.withBusy(session, step, label, asyncFn, payload)\` 包一段异步活儿，自动加锁 + 超时自愈

**AI**
- \`await kit.askAi({ session, player, system, user })\` → 字符串
- \`kit.cleanSpeech(raw, maxLen)\` 清掉 AI 爱加的引号、前后缀
- \`kit.parseTarget(raw, candidates)\` 从回答里解析出它选了谁
- \`kit.parseJson(raw)\` 容错解析 JSON（AI 常常裹一层 \`\`\`json）
- \`kit.splitLines(raw, maxLines)\`

**对局状态**
- \`kit.addLog(session, { kind, playerId, text })\` kind: system / speech / action / vote / result
- \`kit.setPhase(session, phase, label)\`
- \`kit.notifyTurn(session, text)\` 轮到用户时提醒他（他可能不在这一页）
- \`kit.settle(session, winner, summary)\` 分出胜负，停在结算屏
- \`kit.updateSession(groupId, mutator)\`

**玩家**
- \`kit.alivePlayers(session)\` / \`kit.aliveExcept(session, id)\` / \`kit.getPlayer(session, id)\`
- \`kit.userPlayer(session)\` / \`kit.isUserPlaying(session)\` / \`kit.USER_PLAYER_ID\`
- \`kit.shuffle(arr)\` / \`kit.pickRandom(arr)\`

**给 AI 看的上下文**（拼 system prompt 时用，别自己重写一份）
- \`kit.describeRoster(session)\` 现在场上有谁、谁还活着
- \`kit.describeRecentSpeech(session, limit)\` 最近说了什么
- \`kit.describeSelf(player)\` 这个 AI 自己是谁、什么身份

**界面**（\`kit.ui.*\`，全都返回 HTML 字符串）
- \`seatStrip(players, opts)\` / \`seatGrid\` / \`targetPicker({ players, action })\`
- \`button({ label, action, payload, tone })\` / \`buttonRow([...])\`
- \`textInput({ placeholder, submit })\` / \`thinking(label)\`
- \`panel({ title, hint, body })\` / \`chip(text, tone)\` / \`keyValue(rows)\` / \`empty(text)\`
- \`resultPanel({ title, summary, players })\` / \`roleCard(...)\` / \`voteBoard(rows)\`
- \`kit.escapeHtml(s)\` —— 任何来自 AI 或用户的文字进 HTML 前都要过它

## 五、交付要求

- 只给我**一个完整的 .js 文件**，可以直接存盘上传，不要分片、不要省略。
- 中文注释，把「为什么这么设计」写清楚，不要写「这里是一个循环」这种废话。
- 每个 \`runStep\` 分支开头用一行注释说明「这一步在做什么、下一步去哪」。
- AI 请求要有兜底：\`askAi\` 可能超时或返回垃圾，那时候用规则随机决定，不能卡住。
- 用户中途离开是常态，任何时候 session 都要是「能被重新画出来」的完整状态。

写完先自己过一遍第三节那四条。`;
}

/**
 * 一份能直接装上跑的示例玩法（「投票淘汰」最小可玩版）。
 * 用户可以先装它看效果，再照着改 —— 比对着提示词从零开始容易。
 */
export function buildSampleGameCode() {
    return `// 举手表决 —— 群聊小游戏示例
// 装上就能玩：每轮所有人给一个理由，然后投票淘汰一个，最后剩两个人时结束。
// 这个文件的价值不在玩法本身，而在于它把「一个玩法要实现哪五个函数」演示了一遍。

const kit = window.__chatGameKit;

export default {
    meta: {
        id: 'show-of-hands',
        name: '举手表决',
        desc: '每轮陈述一句，然后投票淘汰一个人',
        tone: 'amber',
        minPlayers: 3,
        maxPlayers: 8,
        tag: '3-8 人',
    },

    setup(session) {
        session.players.forEach((p) => { p.alive = true; p.votes = 0; });
        session.round = 1;
        kit.setPhase(session, 'opening', '准备开始');
        kit.addLog(session, { kind: 'system', text: '举手表决开始。每轮说一句话，然后投票。' });
        kit.schedule(session, 'openRound', 600);
    },

    async runStep(session, step, payload) {
        switch (step) {
            // 开一轮：清票数，从第一个活人开始说
            case 'openRound':
                session.players.forEach((p) => { p.votes = 0; });
                kit.setPhase(session, 'speaking', \`第 \${session.round} 轮 · 陈述\`);
                kit.schedule(session, 'speak', 400, { index: 0 });
                return;

            // 轮到某人说话。是我就等我打字，是 AI 就问模型
            case 'speak': {
                const order = kit.alivePlayers(session);
                const player = order[payload.index];
                if (!player) { kit.schedule(session, 'openVote', 600); return; }

                if (player.isUser) {
                    kit.notifyTurn(session, '轮到你说了');
                    kit.awaitUser(session, 'speech', { index: payload.index });
                    return;
                }

                await kit.withBusy(session, step, \`\${player.name} 正在想…\`, async () => {
                    let text = '';
                    try {
                        text = await kit.askAi({
                            session, player,
                            system: \`\${kit.describeSelf(player)}\\n\${kit.describeRoster(session)}\\n你们在玩「举手表决」，每轮每人说一句话争取不被投出去。\`,
                            user: \`\${kit.describeRecentSpeech(session, 12)}\\n\\n轮到你了，说一句话（40 字以内，不要解释规则）。\`,
                        });
                    } catch (_) { /* 下面兜底 */ }
                    // ★ AI 挂了也得往下走，不能卡住整局
                    const line = kit.cleanSpeech(text, 60) || '我没什么好说的。';
                    kit.addLog(session, { kind: 'speech', playerId: player.id, text: line });
                }, payload);

                kit.schedule(session, 'speak', 800, { index: payload.index + 1 });
                return;
            }

            // 投票：我先投，然后 AI 依次投
            case 'openVote':
                kit.setPhase(session, 'voting', \`第 \${session.round} 轮 · 投票\`);
                if (kit.isUserPlaying(session) && kit.userPlayer(session)?.alive) {
                    kit.notifyTurn(session, '投票时间');
                    kit.awaitUser(session, 'vote', {});
                } else {
                    kit.schedule(session, 'aiVote', 500, { index: 0 });
                }
                return;

            case 'aiVote': {
                const voters = kit.alivePlayers(session).filter((p) => !p.isUser);
                const voter = voters[payload.index];
                if (!voter) { kit.schedule(session, 'settleVote', 700); return; }

                const targets = kit.aliveExcept(session, voter.id);
                let picked = null;
                await kit.withBusy(session, step, \`\${voter.name} 正在投票…\`, async () => {
                    try {
                        const raw = await kit.askAi({
                            session, player: voter,
                            system: kit.describeRoster(session),
                            user: \`\${kit.describeRecentSpeech(session, 12)}\\n\\n投一个你想淘汰的人，只回名字。\`,
                        });
                        picked = kit.parseTarget(raw, targets);
                    } catch (_) { /* 兜底见下 */ }
                }, payload);

                const target = picked || kit.pickRandom(targets);
                if (target) {
                    target.votes = (target.votes || 0) + 1;
                    kit.addLog(session, { kind: 'vote', playerId: voter.id, text: \`投给 \${target.name}\` });
                }
                kit.schedule(session, 'aiVote', 600, { index: payload.index + 1 });
                return;
            }

            case 'settleVote': {
                const alive = kit.alivePlayers(session);
                const out = alive.slice().sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
                if (out && (out.votes || 0) > 0) {
                    out.alive = false;
                    kit.addLog(session, { kind: 'result', text: \`\${out.name} 被投出局（\${out.votes} 票）\` });
                } else {
                    kit.addLog(session, { kind: 'result', text: '没人被投出局' });
                }

                const left = kit.alivePlayers(session);
                if (left.length <= 2) {
                    kit.settle(session, left.map((p) => p.name).join(' 和 '), \`撑到最后的是 \${left.map((p) => p.name).join('、')}\`);
                    return;
                }
                session.round += 1;
                kit.schedule(session, 'openRound', 1200);
                return;
            }
        }
    },

    async handleUserAction(session, action, payload) {
        if (action === 'speech') {
            const text = kit.cleanSpeech(payload.text || '', 60) || '（沉默）';
            kit.addLog(session, { kind: 'speech', playerId: kit.USER_PLAYER_ID, text });
            kit.clearPending(session);
            kit.schedule(session, 'speak', 300, { index: (payload.index ?? 0) + 1 });
            return;
        }
        if (action === 'vote') {
            const target = kit.getPlayer(session, payload.targetId);
            if (target) {
                target.votes = (target.votes || 0) + 1;
                kit.addLog(session, { kind: 'vote', playerId: kit.USER_PLAYER_ID, text: \`投给 \${target.name}\` });
            }
            kit.clearPending(session);
            kit.schedule(session, 'aiVote', 400, { index: 0 });
        }
    },

    buildView(session) {
        const pending = session.pending?.action || '';
        let action = kit.ui.thinking('等待中');
        if (pending === 'speech') {
            action = kit.ui.textInput({ placeholder: '说一句话…', submit: { action: 'speech', payload: session.pending.data } });
        } else if (pending === 'vote') {
            action = kit.ui.targetPicker({
                players: kit.aliveExcept(session, kit.USER_PLAYER_ID),
                action: 'vote',
                hint: '投一个你想淘汰的人',
            });
        }
        return {
            tone: 'amber',
            title: '举手表决',
            subtitle: \`第 \${session.round} 轮 · 还剩 \${kit.alivePlayers(session).length} 人\`,
            right: '',
            head: kit.ui.seatStrip(session.players, { session }),
            action,
            viewerId: kit.USER_PLAYER_ID,
        };
    },

    buildResult(session) {
        return kit.ui.resultPanel({
            title: session.winner ? \`\${session.winner} 撑到了最后\` : '本局结束',
            summary: session.result?.summary || '',
            players: session.players,
        });
    },
};
`;
}

export default buildGamePrompt;
