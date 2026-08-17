/**
 * music-app · 往 murmur 注册「音乐 App 提供的提示词」
 *
 *   这些卡片会出现在 murmur →「回复提示词」→「可用 Prompt」→「音乐」折叠区里。
 *   用户可以逐条启用/关闭；启用的正文会进入最终 system prompt（pre）。
 *
 *   为什么这几条要归音乐 App 而不是写死在 chat 的 SPECIAL_ACTIONS_HELP 里：
 *     - 没装音乐 App 的用户不该被告知「你可以用 [分享音乐:...]」——AI 会输出一张点不开的卡
 *     - 用户关掉这条 prompt 时，AI 就该真的不再分享音乐（写死在 chat 里做不到）
 *
 *   写作风格对齐「AI 人设须知 / 用户人设须知」：Principle + Behaviors 两层，
 *   短句、不铺陈背景。长篇大论只会挤掉真正重要的上下文。
 *
 *   ⚠️ promptId 一旦发布就不能改：用户的启停/编辑状态按 `music::<promptId>` 存 IndexedDB。
 */

export const MUSIC_APP_PROMPTS = [
    {
        promptId: 'share-song',
        label: '分享音乐卡片',
        category: 'special-action',
        previewType: 'music-card',
        previewData: { song: '示例曲', artist: '小听', cover: '' },
        defaultActive: true,
        defaultOrder: 10,
        content: `分享音乐须知:
  - Principle: 聊到某首歌、想安利、或者用户问"有什么好听的"时,直接把歌甩给对方,格式 [分享音乐:歌名:歌手]。
  - Behaviors:
    - 例:[分享音乐:示例曲:小听]
    - 单独成段,前后不要加「|」
    - 歌名歌手都要写全,系统靠它在曲库里找歌;找不到会退化成一张点不开的卡
    - 一轮最多分享一首,别刷屏
    - 分享完补一句为什么推它,别只丢个卡就没了`,
    },
    {
        promptId: 'listen-together',
        label: '邀请一起听',
        category: 'special-action',
        previewType: 'music-card',
        previewData: { song: '示例曲', artist: '一起听 · 邀请中', cover: '' },
        defaultActive: true,
        defaultOrder: 20,
        content: `一起听须知:
  - Principle: 想和用户同步听同一首歌时用 [一起听:歌名],这会真的开一个"一起听"会话并开始播放。
  - Behaviors:
    - 例:[一起听:示例曲]
    - 单独成段,前后不要加「|」
    - 比 [分享音乐] 重,只在气氛到了(深夜/情绪话题/用户说无聊)才发起
    - 已经在一起听时不要重复发起,直接聊正在放的这首
    - 上下文里有「一起听」那段时说明你们正在听:可以自然接歌词、聊这首歌,但别每句都提`,
    },
    {
        promptId: 'music-taste',
        label: '听歌口味感知',
        category: 'context',
        previewType: 'text',
        hidePreview: true,  // 不需要小眼睛预览，这个 prompt 只给 AI 参考用
        previewData: { text: '用户最近在单曲循环《示例曲》,已经听了 12 次' },
        defaultActive: false,
        defaultOrder: 30,
        content: `听歌口味须知:
  - Principle: 上下文里的播放记录是真实数据,用它判断用户当下的状态,不要拿来复读。
  - Behaviors:
    - 单曲循环 / 播放次数很高 = 用户正沉在某种情绪里,顺着聊,别急着劝
    - 深夜听慢歌和白天听快歌是两回事,回应语气跟着变
    - 不要报数据("你听了这首 12 次"),要用感受说("这首你最近好像循环了很久")
    - 用户没提音乐时,不要主动把话题拐到听歌上`,
    },
];

/**
 * 注册全部音乐 prompt。
 * 在 hydrate 里调用即可 —— 注册表是内存的，每次启动都要重新注册；
 * 用户改过的正文和启停状态存在 IndexedDB，register 之后会自动合并回来。
 *
 * @param {object} toolkit App toolkit（需要 toolkit.prompts）
 */
export function registerMusicAppPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(MUSIC_APP_PROMPTS);
}

export default registerMusicAppPrompts;
