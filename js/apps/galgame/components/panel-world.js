/**
 * 湛蓝回忆 · 设定面板
 *
 * 原型这一屏是「世界观配置」,里面用户要**手填**世界观背景、玩家身份、
 * 每个角色的名字性格、每个场景的名字描述 —— 而这些东西在本系统里
 * nook 早就有了。用户的要求是「人设跟 api 世界观场景等要改从 nook 拉取」,
 * 所以这里的定位变了:
 *
 *   **从 nook 挑** —— 世界观、玩家人设、出场角色、场景(场所)
 *   **在这儿配** —— 立绘、场景配图、本作限定备注、NPC 标记、主线任务
 *
 * (自定义提示词和故事手记在「提示词」面板 —— 那两样是「怎么拼 prompt」的事,
 *  跟这一屏的「这局有什么」不是一码事,放在一起会让这一屏长得看不到底。)
 *
 * 后面这一组是 nook 里没有的东西。它们按 nook 的 id 存
 * (`library.cast[aiPersonId]` / `library.scenes[].locationId`),
 * 所以在 nook 里改了名字这边立刻跟着变,而立绘不会被覆盖掉。
 *
 * 原型还有一个很坑的行为:`saveWorldviewConfig()` 每次都调
 * `initializeAffectionSystem()`,而后者把好感度表**整个清空重建成 50**。
 * 也就是说进设置点一下「保存配置」,攒了几十轮的好感度全部归零,还不提示。
 * 现在没有「保存配置」这个动作了 —— 改哪儿存哪儿,好感度只由判定结果增量更新。
 */

import * as store from '../store.js';
import * as nook from '../services/nook-bridge.js';
import { SHARED_COMPONENTS } from './shared.js';
import { GENRES, MOODS } from '../constants.js';
import { asArray, truncate } from '../utils.js';
import { affectionTone } from '../theme.js';

export const GgPanelWorld = {
    name: 'GgPanelWorld',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return {
            open: 'game',
            MOODS,
            expandedCast: '',
        };
    },
    computed: {
        state() { return store.getState(); },
        game() { return store.getGame(); },
        library() { return this.state.library; },
        sdkReady() { return this.state.sdkReady; },

        worldOptions() {
            return nook.listWorlds().map((w) => ({ value: w.id, label: w.summary ? `${w.name} — ${w.summary}` : w.name }));
        },
        userOptions() {
            return nook.listUserCards().map((u) => ({ value: u.id, label: u.isDefault ? `${u.name}(默认)` : u.name }));
        },
        genreOptions() {
            return GENRES.map((g) => ({ value: g.id, label: g.label }));
        },

        playerCard() { return nook.getPlayerCard(this.game?.userPersonaId); },
        world() { return nook.getWorld(this.game?.worldId, this.playerCard); },

        /** 这个世界观下能选的角色 */
        roster() {
            const chosen = new Set(asArray(this.game?.castIds).map(String));
            return nook.listWorldAis(this.world).map((ai) => {
                const conf = this.library.cast[ai.id] || {};
                return {
                    ai,
                    picked: chosen.has(String(ai.id)),
                    isNpc: conf.isNpc === true,
                    trackAffection: conf.trackAffection !== false && conf.isNpc !== true,
                    note: String(conf.note || ''),
                    sprites: conf.sprites || {},
                    defaultMood: conf.defaultMood || 'default',
                    spriteCount: Object.keys(conf.sprites || {}).length,
                };
            });
        },

        scenes() { return asArray(this.library.scenes); },

        apiInfo() {
            return nook.describeApiRef(nook.resolveApiRef(this.playerCard));
        },

        affectionRows() {
            const affection = this.game?.affection || {};
            return store.getCast().filter((c) => c.trackAffection).map((c) => {
                const value = affection[c.id]?.value ?? 50;
                return { id: c.id, name: c.name, value, tone: affectionTone(value), thoughts: affection[c.id]?.thoughts || '' };
            });
        },
    },
    methods: {
        toggle(key) { this.open = this.open === key ? '' : key; },
        set(patch) { store.updateGame(patch); },

        onPickWorld(worldId) {
            // 换世界观等于换一批角色和场景,已选的角色多半不在新世界里 —— 提醒但不强删,
            // 因为跨世界观客串是合理玩法,强删会让人措手不及
            store.updateGame({ worldId });
            this.$emit('notify', '世界观已切换,角色和场景记得重新挑一下');
        },

        onToggleCast(aiId) {
            store.toggleCastMember(aiId);
        },
        onExpandCast(aiId) {
            this.expandedCast = this.expandedCast === aiId ? '' : aiId;
        },
        onCastField(aiId, patch) {
            store.setCastConfig(aiId, patch);
        },
        onSprite(aiId, mood, url) {
            store.setCastConfig(aiId, { sprites: { [mood]: url } });
        },
        spriteOf(member, mood) {
            return member.sprites[mood] || '';
        },

        onPullScenes() {
            const { added, updated } = store.pullScenesFromNook();
            if (!added && !updated) {
                this.$emit('notify', '这个世界观下还没有场所,先去 nook 的「地图」里加几个');
                return;
            }
            this.$emit('notify', `从 nook 拉到 ${added} 个新场景,更新 ${updated} 个`);
        },
        onAddScene() { store.addScene({ name: '新场景' }); },
        onSceneField(id, patch) { store.updateScene(id, patch); },
        onRemoveScene(id) { store.removeScene(id); },

        async onCheckQuest() {
            const result = await store.checkQuest();
            if (!result.ok) this.$emit('notify', result.error);
        },

        onNewGame() { store.openModal('new-game', {}); },
        onSwitchGame(id) { void store.openGame(id); },
        onDeleteGame(g) {
            const confirmApi = typeof window !== 'undefined' ? window.__phoneConfirm : null;
            const run = () => { void store.removeGame(g.id); };
            if (confirmApi?.request) {
                confirmApi.request({
                    title: `删掉「${g.title}」?`,
                    text: '这一局的全部剧情、存档和 CG 都会一起删除,不能撤销。',
                    confirmLabel: '删除',
                    danger: true,
                    onConfirm: run,
                });
            } else run();
        },

        short(text, n = 24) { return truncate(text, n); },
    },
    template: `
        <div class="gg-panel-body">
            <p v-if="!sdkReady" class="gg-panel-warn">
                <GgIcon name="warning" />正在连接 nook…人设和世界观暂时读不到
            </p>

            <!-- ① 这一局 -->
            <GgSection title="这一局" icon-name="settings" collapsible :open="open === 'game'" @toggle="toggle('game')">
                <template v-if="game">
                    <GgField label="标题">
                        <GgInput :model-value="game.title" @update:model-value="set({ title: $event })" />
                    </GgField>
                    <GgField label="世界观" hint="从 nook 挑一个;背景、要点、夹子都会自动进上下文">
                        <GgSelect :model-value="game.worldId" :options="worldOptions" placeholder="跟随当前激活" @update:model-value="onPickWorld" />
                    </GgField>
                    <GgField label="玩家人设" hint="AI 不会替这个角色说话,他的言行由你从选项里选">
                        <GgSelect :model-value="game.userPersonaId" :options="userOptions" placeholder="用默认用户卡" @update:model-value="set({ userPersonaId: $event })" />
                    </GgField>
                    <GgField label="题材">
                        <GgSelect :model-value="game.genre" :options="genreOptions" @update:model-value="set({ genre: $event })" />
                    </GgField>
                    <GgField label="故事时间" hint="如「现代」「洪武三年春」,留空就用「现在」">
                        <GgInput :model-value="game.worldTimeText" placeholder="现代" @update:model-value="set({ worldTimeText: $event })" />
                    </GgField>
                    <GgField label="开场要求" hint="只影响第一幕">
                        <GgTextarea :model-value="game.openingHint" :rows="2" placeholder="例:从我转学第一天走进教室开始" @update:model-value="set({ openingHint: $event })" />
                    </GgField>

                    <p class="gg-api-line" :class="{ 'is-bad': !apiInfo.ok }">
                        <GgIcon :name="apiInfo.ok ? 'link' : 'warning'" />
                        <span>{{ apiInfo.label }}</span>
                        <em>{{ apiInfo.sub }}</em>
                    </p>
                </template>
                <GgEmpty v-else text="还没有故事" hint="新建一局就能开始">
                    <GgButton variant="primary" icon-name="plus" @click="onNewGame">新建一局</GgButton>
                </GgEmpty>
            </GgSection>

            <!-- ② 出场角色 -->
            <GgSection v-if="game" title="出场角色" icon-name="users" :hint="game.castIds.length + ' 人'" collapsible :open="open === 'cast'" @toggle="toggle('cast')">
                <GgEmpty v-if="!roster.length" text="这个世界观下还没有 AI 人设" hint="去 nook 建几张卡,并把它们绑到这个世界观" />
                <div v-for="m in roster" :key="m.ai.id" class="gg-cast-row" :class="{ 'is-picked': m.picked }">
                    <button type="button" class="gg-cast-main" @click="onExpandCast(m.ai.id)">
                        <span class="gg-cast-name">{{ m.ai.name }}</span>
                        <span class="gg-cast-sub">{{ short(m.ai.personality || m.ai.bio || '未填性格', 20) }}</span>
                        <GgTag v-if="m.spriteCount">{{ m.spriteCount }} 张立绘</GgTag>
                        <GgTag v-if="m.isNpc" tone="muted">NPC</GgTag>
                    </button>
                    <label class="gg-cast-pick">
                        <input type="checkbox" :checked="m.picked" @change="onToggleCast(m.ai.id)" />
                        <span>出场</span>
                    </label>

                    <div v-if="expandedCast === m.ai.id" class="gg-cast-detail">
                        <GgSwitch label="当作配角 / NPC" hint="NPC 不进好感度统计" :model-value="m.isNpc" @update:model-value="onCastField(m.ai.id, { isNpc: $event })" />
                        <GgSwitch v-if="!m.isNpc" label="统计好感度" :model-value="m.trackAffection" @update:model-value="onCastField(m.ai.id, { trackAffection: $event })" />
                        <GgField label="本作限定备注" hint="只在这个游戏里生效,不会写回 nook">
                            <GgTextarea :model-value="m.note" :rows="2" placeholder="例:在这条线里她还不知道我的身份" @update:model-value="onCastField(m.ai.id, { note: $event })" />
                        </GgField>

                        <p class="gg-sub-title">立绘 <em>nook 里没有这一项,只能在这儿配</em></p>
                        <div v-for="mood in MOODS" :key="mood.id" class="gg-sprite-row">
                            <span class="gg-sprite-mood">{{ mood.label }}</span>
                            <GgInput
                                :model-value="spriteOf(m, mood.id)"
                                placeholder="图片链接(http/https 或 data:image)"
                                @update:model-value="onSprite(m.ai.id, mood.id, $event)"
                            />
                            <img v-if="spriteOf(m, mood.id)" class="gg-sprite-thumb" :src="spriteOf(m, mood.id)" alt="" />
                        </div>
                    </div>
                </div>
            </GgSection>

            <!-- ③ 场景 -->
            <GgSection v-if="game" title="场景" icon-name="map" :hint="scenes.length + ' 个'" collapsible :open="open === 'scene'" @toggle="toggle('scene')">
                <div class="gg-row-actions">
                    <GgButton size="sm" variant="ghost" icon-name="download" @click="onPullScenes">从 nook 拉取场所</GgButton>
                    <GgButton size="sm" variant="quiet" icon-name="plus" @click="onAddScene">手动添加</GgButton>
                </div>
                <GgEmpty v-if="!scenes.length" text="还没有场景" hint="有场景后 AI 会用 [SCENE] 标注切换,背景图跟着换" />
                <div v-for="s in scenes" :key="s.id" class="gg-scene-row">
                    <div class="gg-scene-head">
                        <GgInput :model-value="s.name" :disabled="Boolean(s.locationId)" @update:model-value="onSceneField(s.id, { name: $event })" />
                        <GgTag v-if="s.locationId">来自 nook</GgTag>
                        <GgButton size="sm" icon-name="trash" icon-only label="删除" @click="onRemoveScene(s.id)" />
                    </div>
                    <GgTextarea
                        :model-value="s.description"
                        :rows="2"
                        :placeholder="s.locationId ? '简介来自 nook,改这里不会写回去' : '这个地方长什么样'"
                        @update:model-value="onSceneField(s.id, { description: $event })"
                    />
                    <div class="gg-scene-img">
                        <GgInput :model-value="s.imageUrl" placeholder="背景图链接" @update:model-value="onSceneField(s.id, { imageUrl: $event })" />
                        <img v-if="s.imageUrl" class="gg-scene-thumb" :src="s.imageUrl" alt="" />
                    </div>
                </div>
            </GgSection>

            <!-- ④ 主线 & 好感度 -->
            <GgSection v-if="game" title="主线与好感度" icon-name="flag" collapsible :open="open === 'quest'" @toggle="toggle('quest')">
                <GgField label="主线任务">
                    <GgInput :model-value="game.quest.title" placeholder="例:找到治好她的方法" @update:model-value="set({ quest: { ...game.quest, title: $event } })" />
                </GgField>
                <GgField label="目标描述">
                    <GgTextarea :model-value="game.quest.description" :rows="2" @update:model-value="set({ quest: { ...game.quest, description: $event } })" />
                </GgField>
                <div class="gg-row-actions">
                    <GgTag :tone="game.quest.completed ? 'ok' : ''">{{ game.quest.completed ? '已完成' : '进行中' }}</GgTag>
                    <GgButton size="sm" variant="ghost" icon-name="sparkle" :loading="state.judging" :disabled="!game.quest.title || game.quest.completed" @click="onCheckQuest">
                        让 AI 判定
                    </GgButton>
                </div>

                <p class="gg-sub-title">好感度</p>
                <GgEmpty v-if="!affectionRows.length" text="还没有参与统计的角色" />
                <div v-for="a in affectionRows" :key="a.id" class="gg-affection-item">
                    <span class="gg-affection-name">{{ a.name }}</span>
                    <GgAffectionBar :value="a.value" :tone="a.tone" />
                    <em class="gg-affection-num">{{ a.value }}</em>
                    <span v-if="a.thoughts" class="gg-affection-say">「{{ a.thoughts }}」</span>
                </div>
            </GgSection>

            <!-- ⑤ 全部故事 -->
            <GgSection title="全部故事" icon-name="layers" :hint="state.games.length + ' 局'" collapsible :open="open === 'games'" @toggle="toggle('games')">
                <div class="gg-row-actions">
                    <GgButton size="sm" variant="primary" icon-name="plus" @click="onNewGame">新建一局</GgButton>
                </div>
                <div v-for="g in state.games" :key="g.id" class="gg-list-row" :class="{ 'is-active': g.id === state.activeGameId }">
                    <button type="button" class="gg-list-main" @click="onSwitchGame(g.id)">
                        <span class="gg-list-title">{{ g.title }}</span>
                        <span class="gg-list-sub">{{ g.castIds.length }} 位角色 · K{{ Math.max(0, g.kCounter - 1) }}</span>
                    </button>
                    <GgButton size="sm" icon-name="trash" icon-only label="删除" @click="onDeleteGame(g)" />
                </div>
            </GgSection>
        </div>
    `,
};

export default GgPanelWorld;
