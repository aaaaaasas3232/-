---
name: 聊天App迁移规划
overview: 将参考/chat.js (25k+行) 迁移到小听启动框架，设计双窗口+双摘要系统
todos:
  - id: chat-css
    content: 1:1 复原 chat.js 韩风蓝粉 CSS 样式
    status: completed
  - id: chat-schema
    content: 设计 IndexedDB schema (chatSessions, chatMessages, chatArchives, chatSummaries含type字段)
    status: completed
  - id: chat-store
    content: 实现 chat-store.js 存储服务（含窗口隔离 CRUD）
    status: completed
  - id: summary-engine
    content: 实现 summary-engine.js 滚动摘要(K) + 历史摘要(H)双引擎
    status: completed
  - id: history-manager
    content: 实现 history-manager.js 历史记忆管理（含编辑/重Roll/发布）
    status: completed
  - id: prompt-engine
    content: 实现 prompt-engine.js Prompt 构建器（K+H双注入）
    status: completed
  - id: reply-mode
    content: 实现 reply-mode.js 回复方式自定义（即时/长按/延迟）
    status: completed
  - id: world-bridge
    content: 实现 world-bridge.js 世界观整合
    status: completed
  - id: messages-page
    content: 实现 messages-page.js 消息列表（含双窗口入口）
    status: completed
  - id: chat-detail-page
    content: 实现 chat-detail-page.js 聊天详情
    status: completed
  - id: summary-ui
    content: 实现历史摘要生成/编辑/重Roll/发布/注入 UI
    status: completed
  - id: ai-service
    content: 实现 ai-service.js AI 回复生成
    status: completed
  - id: chat-components
    content: 实现消息气泡、输入区域组件
    status: completed
  - id: secondary-pages
    content: 实现通讯录、动态、个人页
    status: completed
  - id: archive-feature
    content: 实现存档功能（保存/恢复/查看/删除）
    status: completed
  - id: interface-docs
    content: 创建 待办/chat跨App接口.md 记录跨 App 接口
    status: completed
  - id: chat-games
    content: 迁移游戏系统 (werewolf/undercover)
    status: completed
  - id: chat-registration
    content: 注册到 js/apps/index.js 并测试
    status: completed
isProject: false
---

# 聊天App迁移规划

> **核心原则**：
> 1. **1:1 复原 UI** - 保留原 chat.js 韩风蓝粉 CSS 设计
> 2. **保留所有交互细节** - 回复模式、上下文生命周期、游戏内完整上下文等
> 3. **双摘要系统** - 滚动摘要(K)自动生成 + 历史摘要(H)手动生成可编辑

---

# 第一部分：核心架构设计

## 1.1 设计理念：Chat Model（聊天模型）

### 1.1.1 为什么需要 Chat Model

原 chat.js 的问题：

```
问题1：私聊和群聊代码高度重复
├── chat.js 私聊功能
│   ├── 消息列表
│   ├── 聊天详情
│   ├── 输入区域
│   ├── AI 回复
│   ├── 表情包
│   ├── 图片
│   ├── 语音
│   └── ...（3000行）
│
├── 群聊功能（几乎复制一遍）
│   ├── 消息列表（改动很小）
│   ├── 聊天详情（改动很小）
│   ├── 输入区域（完全一样）
│   ├── AI 回复（改动很小）
│   └── ...（又3000行）
│
└── 重复代码导致维护噩梦
    - 改一个bug要改两处
    - 新功能要写两遍
    - 历史记录功能完全没做
```

**解决方案：提取公共的 Chat Model**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Chat Model（聊天模型）                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  核心原则：                                                              │
│  - 私聊和群聊是 Chat Model 的两种模式（平行）                             │
│  - 通话是 Chat 的「功能」之一，不是模式（属于某一个会话的临时状态）        │
│  - 游戏也是 Chat 的「功能」之一（属于某一个会话的临时状态）              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        ChatCore（核心）                              │ │
│  │  - 消息存储（chat-store）                                           │ │
│  │  - 消息渲染（message-renderer）                                     │ │
│  │  - 输入处理（input-handler）                                        │ │
│  │  - 滚动控制（scroll-controller）                                    │ │
│  │  - 历史记录（history-viewer）                                       │ │
│  │  - 表情包（emoji-picker）                                           │ │
│  │  - 图片上传（image-uploader）                                       │ │
│  │  - 语音录制（voice-recorder）                                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              ▲                                           │
│                              │ 继承/组合                                  │
│         ┌────────────────────┴────────────────────┐                     │
│         │                                         │                     │
│  ┌──────┴──────────────┐                ┌─────────┴──────────┐         │
│  │ ChatPrivate         │                │  ChatGroup         │         │
│  │  （私聊模式）       │                │  （群聊模式）      │         │
│  │                     │                │                     │         │
│  │  - 1v1 AI           │                │  - 多人 AI         │         │
│  │  - 朋友圈/nook联动  │                │  - 群公告           │         │
│  │  - 可以叠加以下功能:│                │  - @成员            │         │
│  │    ├─ 📞 通话      │                │  - 可以叠加以下功能:│         │
│  │    └─ 🎮 游戏      │                │    ├─ 📞 通话      │         │
│  └─────────────────────┘                │    └─ 🎮 游戏      │         │
│                                         └─────────────────────┘         │
│                                                                          │
│  通话和游戏是「运行时临时状态」，不是模式：                                │
│  - 在某个 ChatPrivate/ChatGroup 内启动通话                                │
│  - 在某个 ChatPrivate/ChatGroup 内启动游戏                                │
│  - 通话/游戏结束后，留下摘要，聊天继续                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1.2 Chat Model 的结构

```javascript
// chat-model.js - 聊天模型核心
// 这是 chat.js 没有的，全新设计

/**
 * ChatModel - 聊天模型的基类
 * 
 * 设计原则：
 * 1. 所有聊天类型（私聊/群聊/通话）都继承这个基类
 * 2. 公共功能在基类实现，子类只实现差异化部分
 * 3. 使用组合模式：把可复用的组件组合进来
 * 
 * 继承链：
 * ChatModel → ChatPrivate / ChatGroup / ChatCall
 */
class ChatModel {
  constructor(options) {
    // 公共属性
    this.sessionId = options.sessionId;
    this.windowId = options.windowId;
    this.mode = options.mode;  // 'date' | 'topic'
    
    // 公共组件（组合进来）
    this.messageStore = new ChatMessageStore(this);      // 消息存储
    this.messageRenderer = new ChatMessageRenderer(this); // 消息渲染
    this.inputHandler = new ChatInputHandler(this);      // 输入处理
    this.scrollController = new ScrollController(this);  // 滚动控制
    this.emojiPicker = new EmojiPicker(this);            // 表情包
    this.imageUploader = new ImageUploader(this);        // 图片上传
    this.voiceRecorder = new VoiceRecorder(this);         // 语音录制
    
    // 状态
    this.state = reactive({
      messages: [],
      inputText: '',
      isLoading: false,
      hasMore: true,
      // ... 其他状态
    });
  }
  
  // ========== 公共方法 ==========
  
  // 发送消息（所有聊天类型通用）
  async sendMessage(content, type = 'text') {
    // 1. 校验
    // 2. 保存到数据库
    // 3. 渲染到列表
    // 4. 触发 AI 回复（如果是 AI 会话）
  }
  
  // 加载消息（分页）
  async loadMessages(options = {}) {
    // 1. 从数据库读取
    // 2. 渲染
    // 3. 更新状态
  }
  
  // 滚动加载更多
  async loadMore() {
    // 分页加载
  }
  
  // ========== 需要子类实现的方法 ==========
  
  // 生成 AI 回复（子类必须实现）
  async generateAIResponse() {
    throw new Error('子类必须实现 generateAIResponse()');
  }
  
  // 获取上下文（子类实现差异化）
  async buildContext() {
    throw new Error('子类必须实现 buildContext()');
  }
  
  // 处理消息挂件（子类可选实现）
  async handleMessageAction(action, payload) {
    // 通用处理
  }
}
```

### 1.1.3 ChatPrivate（私聊）

```javascript
// chat-private.js - 私聊模型
// 继承 ChatModel，实现私聊特有的功能

/**
 * ChatPrivate - 私聊模型
 * 
 * 继承 ChatModel，新增功能：
 * 1. 单人 AI 对话
 * 2. 单人游戏支持
 * 3. 朋友圈联动
 * 4. Nook 个人主页联动
 * 5. 双窗口支持（按日期/按主题）
 * 
 * 与原 chat.js 的关系：
 * - 原 chat.js 的私聊逻辑 → 移到此类
 * - 部分复用（消息渲染、输入处理）
 * - 大幅改写（AI 回复、历史记录、游戏）
 */
class ChatPrivate extends ChatModel {
  constructor(options) {
    super(options);
    
    // 私聊特有属性
    this.personaId = options.personaId;       // AI 人设 ID
    this.personaName = options.personaName;   // AI 人设名（冗余存储）
    this.personaAvatar = options.avatar;      // AI 头像（冗余存储）
    
    // 私聊特有组件
    this.gameManager = new PrivateGameManager(this);  // 私聊游戏管理器
    this.momentsBridge = new MomentsBridge(this);     // 朋友圈联动
    this.nookBridge = new NookBridge(this);           // nook 联动
    
    // 私聊特有状态
    this.state = reactive({
      ...this.state,
      isTyping: false,           // AI 正在输入
      lastReadAt: null,          // 最后已读时间
      unreadCount: 0,            // 未读消息数
      activeGame: null,          // 当前进行的游戏
    });
  }
  
  // ========== 私聊特有方法 ==========
  
  /**
   * 生成 AI 回复
   * 
   * 与原 chat.js 的关系：
   * - 原 _generateAIResponseCore() → 重写为此方法
   * - 原 prompt 构建逻辑 → 移到 prompt-engine
   * - 原智能记忆 → 改为滚动摘要系统
   */
  async generateAIResponse() {
    // 1. 构建上下文（prompt-engine）
    const context = await this.buildContext();
    
    // 2. 调用 AI
    const response = await this.callAI(context);
    
    // 3. 保存消息
    await this.messageStore.add({
      role: 'assistant',
      content: response.text,
      actions: response.actions,
    });
    
    // 4. 触发朋友圈/nook（仅按日期模式）
    if (this.mode === 'date') {
      await this.maybeTriggerSocial(response);
    }
    
    return response;
  }
  
  /**
   * 构建上下文
   * 
   * 与原 chat.js 的关系：
   * - 原 systemPrompt 构建 → 迁移到 prompt-engine
   * - 原 buildSmartMemoryPrompt() → 改为滚动摘要
   * - 新增历史摘要注入
   */
  async buildContext() {
    return await this.promptEngine.buildPrivatePrompt(this, {
      // 滚动摘要（自动注入）
      includeRolling: true,
      
      // 用户选中的历史摘要（手动注入）
      selectedHistories: this.state.selectedHistorySummaries || [],
      
      // AI 行为开关（按日期模式开启，按主题模式关闭）
      socialEnabled: this.mode === 'date',
    });
  }
  
  /**
   * 触发社交行为（朋友圈/nook）
   * 
   * 与原 chat.js 的关系：
   * - 原 momentsContext → 迁移到此
   * - 原 weiboContext → 迁移到此
   * 
   * 注意：
   * - 只在按日期模式触发
   * - 按主题模式不触发（游戏模式）
   */
  async maybeTriggerSocial(aiResponse) {
    if (aiResponse.shouldPostMoments) {
      await this.momentsBridge.createPost(aiResponse.momentsContent);
    }
    if (aiResponse.shouldUpdateNook) {
      await this.nookBridge.updateTimeline(aiResponse.nookContent);
    }
  }
  
  // ========== 私聊游戏 ==========
  
  /**
   * 启动私聊游戏
   * 
   * 与原 chat.js 的关系：
   * - 原狼人杀/谁是卧底 → 重构为私聊版本
   * - 原 werewolf.js → 迁移到 games/private/
   * 
   * 注意：
   * - 私聊游戏是 1v1（用户 vs AI）
   * - 与群聊游戏不同
   */
  async startGame(gameType) {
    // 1. 检查当前模式（游戏只能在按主题模式玩）
    if (this.mode !== 'topic') {
      throw new Error('游戏只能在按主题模式进行');
    }
    
    // 2. 创建游戏实例
    const game = await this.gameManager.createGame(gameType, {
      type: 'private',  // 标记为私聊游戏
      participants: [this.personaId],  // 只有 AI
    });
    
    // 3. 更新状态
    this.state.activeGame = game;
    
    // 4. 发送游戏开始消息
    await this.sendSystemMessage(game.getStartMessage());
    
    return game;
  }
}
```

### 1.1.4 ChatGroup（群聊）

```javascript
// chat-group.js - 群聊模型
// 继承 ChatModel，实现群聊特有的功能

/**
 * ChatGroup - 群聊模型
 * 
 * 继承 ChatModel，新增功能：
 * 1. 多人 AI 对话（每个成员都是独立的 AI）
 * 2. 多人游戏支持
 * 3. 群公告
 * 4. @成员 功能
 * 5. 双窗口支持
 * 
 * 与原 chat.js 的关系：
 * - 原群聊逻辑 → 移到此类
 * - 部分复用 ChatPrivate 的组件
 * - 大幅改写（成员管理、游戏）
 */
class ChatGroup extends ChatModel {
  constructor(options) {
    super(options);
    
    // 群聊特有属性
    this.groupId = options.groupId;
    this.groupName = options.groupName;
    this.memberIds = options.memberIds;       // 所有成员 ID
    this.memberMap = new Map();                // memberId → persona info
    
    // 群聊特有组件
    this.memberManager = new GroupMemberManager(this);  // 成员管理
    this.gameManager = new GroupGameManager(this);     // 群聊游戏管理器
    this.announcement = new GroupAnnouncement(this);   // 群公告
    
    // 群聊特有状态
    this.state = reactive({
      ...this.state,
      activeMembers: [],           // 当前在线的成员
      mentions: [],                 // 被 @ 的成员
      currentSpeaker: null,         // 当前发言者
      activeGame: null,             // 当前进行的游戏
      announcement: null,           // 群公告
    });
  }
  
  // ========== 群聊特有方法 ==========
  
  /**
   * 生成 AI 回复（群聊版）
   * 
   * 与原 chat.js 的关系：
   * - 原 generateGroupMemberResponse() → 重写为此方法
   * - 每个成员独立生成回复
   */
  async generateAIResponse(targetMemberId) {
    // 1. 获取目标成员
    const member = this.memberMap.get(targetMemberId);
    
    // 2. 构建上下文（群聊版）
    const context = await this.buildContext(member);
    
    // 3. 调用该成员的 AI
    const response = await this.callAI(context, member);
    
    // 4. 保存消息（标记发送者）
    await this.messageStore.add({
      role: 'assistant',
      senderId: targetMemberId,     // 标记是哪个成员发的
      content: response.text,
      actions: response.actions,
      mentions: response.mentions,  // @了谁
    });
    
    return response;
  }
  
  /**
   * 构建上下文（群聊版）
   */
  async buildContext(member) {
    return await this.promptEngine.buildGroupPrompt(this, {
      member,  // 指定是哪个成员的上下文
      
      // 群聊特有
      includeMembers: true,
      includeGroupAnnouncement: true,
      
      // 私聊记忆互通（如果有开启）
      includePrivateMemory: member.enablePrivateMemory,
    });
  }
  
  /**
   * 广播消息给所有成员
   * 
   * 注意：
   * - 不是每个成员都回复
   * - 可能有 0-N 个成员回复
   * - 回复是异步的
   */
  async broadcastToMembers(message) {
    const responders = this.memberManager.getRandomResponders(message);
    
    await Promise.all(
      responders.map(member => this.generateAIResponse(member.id))
    );
  }
  
  // ========== 群聊游戏 ==========
  
  /**
   * 启动群聊游戏
   * 
   * 与原 chat.js 的关系：
   * - 原狼人杀/谁是卧底 → 重构为群聊版本
   * - 原 werewolf.js → 迁移到 games/group/
   * 
   * 注意：
   * - 群聊游戏是多人的
   * - 每个成员都有角色
   * - 与私聊游戏不同
   */
  async startGame(gameType) {
    // 1. 检查成员数量
    if (this.memberIds.length < 3) {
      throw new Error('群聊游戏至少需要3个成员');
    }
    
    // 2. 创建游戏实例
    const game = await this.gameManager.createGame(gameType, {
      type: 'group',  // 标记为群聊游戏
      participants: this.memberIds,  // 所有成员都参与
      ownerId: this.state.currentUserId,
    });
    
    // 3. 分配角色
    await game.assignRoles(this.memberIds);
    
    // 4. 更新状态
    this.state.activeGame = game;
    
    // 5. 发送游戏开始消息
    await this.sendSystemMessage(game.getStartMessage());
    
    return game;
  }
  
  /**
   * 处理游戏指令
   */
  async handleGameAction(action, payload) {
    if (!this.state.activeGame) return;
    
    // 群聊游戏的指令处理
    await this.state.activeGame.handleAction(action, payload, {
      senderId: payload.senderId,
      group: this,
    });
  }
}
```

### 1.1.5 Call（通话功能）- 隶属于 Chat 的临时状态

> **重要重新定位**：Call **不是**与 ChatPrivate/ChatGroup 平行的第三种模式。
> Call 是某个会话（私聊/群聊）内的**临时状态/功能**。

```
❌ 错误：ChatPrivate / ChatGroup / ChatCall 三者平行
✅ 正确：ChatPrivate / ChatGroup 是两种模式；Call/Game 是它们的「临时功能」
```

**关键区别表**：

| 维度 | 通话（Call） | 游戏（Game） |
|------|-------------|-------------|
| **归属** | 隶属于某个 ChatPrivate/ChatGroup | 隶属于某个 ChatPrivate/ChatGroup |
| **状态** | `in-call`（临时状态） | `in-game`（临时状态） |
| **期间能否在聊天界面发普通消息** | ✅ 可以（AI 知道这是通话中发的） | ❌ 不可以（必须切到游戏界面） |
| **期间能否在灵动岛发普通消息** | ✅ 可以（AI 知道这是通话中发的） | ❌ 不可以 |
| **期间能否切到其他 App** | ✅ 可以 | ⚠️ 有限制（提示后切走） |
| **期间 AI 上下文** | 聊天摘要 + 通话期间所有消息（完整） | 聊天摘要 + 游戏内消息（完整） |
| **结束后处理** | 生成通话摘要，拼接到会话摘要链 | 生成游戏摘要 + 保存完整流程 |
| **完整记录** | 用户可查看、可编辑 | 用户可查看、可回放 |
| **后续上下文** | 只有摘要进入 ❌ 不再注入完整 | 只有摘要进入 ❌ 不再注入完整 |

**通话/游戏的上下文演变示意**：

```
正常聊天 50 条 → 通话 → 继续聊天

┌─────────────────────────────────────────────────────────────┐
│ [T0] 正常聊天                                                │
│      上下文：琐碎消息 + 滚动摘要 K1 + 最近 3 回合            │
│      存储：完整 50 条消息                                    │
└─────────────────────────────────────────────────────────────┘
                         ↓ 小A 打来电话
┌─────────────────────────────────────────────────────────────┐
│ [T1] 进入 in-call 状态                                      │
│      上下文：K1 摘要 + 通话期间所有消息（完整）              │
│      - 通话期间在聊天界面发的消息 → 进上下文                 │
│      - 通话期间在灵动岛发的消息 → 进上下文                   │
│      - 通话语音转写内容 → 进上下文                          │
│      存储：完整通话记录（独立 store）                        │
└─────────────────────────────────────────────────────────────┘
                         ↓ 挂断电话
┌─────────────────────────────────────────────────────────────┐
│ [T2] 通话结束                                               │
│      - 通话记录被完整存储                                    │
│      - 生成通话摘要 S_call                                    │
│      - state 回到 idle                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓ 继续聊天
┌─────────────────────────────────────────────────────────────┐
│ [T3] 后续聊天上下文                                         │
│      ✅ K1 摘要（之前聊天）                                  │
│      ✅ S_call 摘要（新增）                                  │
│      ❌ 通话期间的完整消息（不再进上下文）                    │
│      ❌ 通话期间的灵动岛消息（不再进上下文）                  │
│      ⚠️ 用户可手动编辑摘要加入更多细节                       │
└─────────────────────────────────────────────────────────────┘
```

```javascript
// services/call/call-manager.js
// 通话管理器 - 作为 Chat 的功能存在

/**
 * CallManager - 通话管理器
 * 
 * 职责：
 * 1. 管理通话状态（in-call / idle）
 * 2. 通话期间允许聊天界面和灵动岛发消息
 * 3. 通话期间构建完整上下文（不摘要）
 * 4. 通话结束生成摘要，清理临时数据
 * 
 * 与 ChatPrivate/ChatGroup 的关系：
 * - CallManager 不是 ChatPrivate/ChatGroup 的子类
 * - CallManager 是 Chat 的「功能模块」，被 Chat 实例持有
 * - 一个 Chat 实例最多同时只有一个 activeCall
 */
class CallManager {
  constructor(options) {
    this.chat = options.chat;  // 持有 Chat 实例（私聊/群聊）
    this.sdk = options.sdk;
    
    // 通话状态
    this.state = reactive({
      isInCall: false,
      callType: null,         // 'voice' | 'video'
      callId: null,
      startedAt: null,
      duration: 0,
      isMuted: false,
      isCameraOff: false,
      participants: [],
    });
    
    // 通话期间的消息容器
    this.callMessages = [];  // 通话期间产生的所有消息
    
    // 通话计时器
    this._durationTimer = null;
    
    // 通话语音通道（占位）
    this.voiceChannel = null;
  }
  
  /**
   * 启动通话
   */
  async startCall(options) {
    if (this.state.isInCall) {
      throw new Error('已有通话在进行中');
    }
    
    const { callType = 'voice', participants = [] } = options;
    
    this.state.isInCall = true;
    this.state.callType = callType;
    this.state.callId = `call_${Date.now()}`;
    this.state.startedAt = Date.now();
    this.state.duration = 0;
    this.state.participants = participants;
    this.state.isMuted = false;
    this.state.isCameraOff = false;
    
    // 修改 Chat 状态
    this.chat.state.mode = 'in-call';
    this.chat.state.activeCall = this;
    
    // 启动计时器
    this._durationTimer = setInterval(() => {
      this.state.duration = Date.now() - this.state.startedAt;
    }, 1000);
    
    // 启动语音通道
    this.voiceChannel = await this._initVoiceChannel(callType, participants);
    
    // 通知灵动岛显示通话状态
    this.toolkit.island.show('large', {
      type: 'call',
      callType,
      participants,
      duration: this.state.duration,
      onAction: (action) => this.handleIslandAction(action),
    });
    
    // 持久化通话记录
    await this.db.put('chatCalls', {
      id: this.state.callId,
      sessionId: this.chat.sessionId,
      callType,
      startedAt: this.state.startedAt,
      participants,
      messages: [],
      status: 'ongoing',
    });
  }
  
  /**
   * 处理通话期间的消息（来自聊天界面/灵动岛）
   * 
   * ⚠️ 这是关键设计：
   * 通话期间，聊天界面和灵动岛都可以发普通消息
   * 这些消息会：
   * 1. 进入通话上下文（AI 能看到）
   * 2. 持久化到 chatMessages（普通消息存储）
   * 3. 同时记录到 callMessages（通话期间消息）
   */
  async handleMessage(message) {
    if (!this.state.isInCall) return;
    
    // 标记消息是通话期间发的
    message.duringCall = this.state.callId;
    message.duringCallType = 'phone';
    
    // 添加到通话消息容器
    this.callMessages.push(message);
    
    // 同步到通话记录的 messages 字段
    await this._appendToCallRecord(message);
  }
  
  /**
   * 通话期间构建 AI 上下文
   * 
   * 关键：通话期间不摘要，完整保留上下文
   */
  async buildContext() {
    const recentSummaries = await this._getRecentSummaries(1);  // 只取 K1
    
    return {
      // ✅ 之前聊天的滚动摘要（K1）
      chatSummary: recentSummaries[0]?.summary || '',
      
      // ✅ 通话期间所有消息（完整，不摘要）
      callMessages: this.callMessages,
      
      // ✅ 通话元数据
      callMeta: {
        callType: this.state.callType,
        duration: this.state.duration,
        participants: this.state.participants,
        isInCall: true,
      },
      
      // 系统指令
      systemInstructions: `你正在与用户通话中。
通话时长：${Math.floor(this.state.duration / 1000)} 秒
通话类型：${this.state.callType === 'video' ? '视频通话' : '语音通话'}
对方知道你们正在通话。
你可以根据通话的语气/情绪调整你的回复。`,
    };
  }
  
  /**
   * 结束通话
   * 
   * 关键步骤：
   * 1. 停止通话通道
   * 2. 生成通话摘要
   * 3. 持久化完整通话记录
   * 4. 把摘要拼接到会话摘要链
   * 5. 清理临时数据
   * 6. state 回到 idle
   */
  async endCall() {
    if (!this.state.isInCall) return;
    
    const endedAt = Date.now();
    const duration = endedAt - this.state.startedAt;
    
    // 1. 停止通话通道
    this._stopVoiceChannel();
    
    // 2. 生成通话摘要
    const summary = await this._generateCallSummary();
    
    // 3. 持久化完整通话记录
    await this.db.put('chatCalls', {
      id: this.state.callId,
      sessionId: this.chat.sessionId,
      callType: this.state.callType,
      startedAt: this.state.startedAt,
      endedAt,
      duration,
      participants: this.state.participants,
      messages: this.callMessages,
      summary,
      summaryId: summary.id,
      status: 'completed',
    });
    
    // 4. 把摘要拼接到会话摘要链
    await this.db.put('chatSummaries', summary);
    
    // 5. 清理临时数据
    this.callMessages = [];
    
    // 6. 状态回到 idle
    this.state.isInCall = false;
    this.state.callType = null;
    this.state.callId = null;
    this.state.startedAt = null;
    this.state.duration = 0;
    
    if (this._durationTimer) {
      clearInterval(this._durationTimer);
      this._durationTimer = null;
    }
    
    // 7. 修改 Chat 状态
    this.chat.state.mode = 'idle';
    this.chat.state.activeCall = null;
    
    // 8. 通知灵动岛关闭
    this.toolkit.island.dismiss();
    
    // 9. 通知聊天界面刷新（现在上下文变了）
    this.chat.events.emit('context-changed', {
      reason: 'call-ended',
      summaryId: summary.id,
    });
    
    return summary;
  }
  
  /**
   * 生成通话摘要
   * 
   * 摘要内容：
   * - 通话主题（聊了什么）
   * - 通话期间的关键事件
   * - 通话期间的情感基调
   * - 通话产生的决定/约定
   */
  async _generateCallSummary() {
    const prompt = `请根据以下通话内容生成通话摘要。

【通话元数据】
通话类型：${this.state.callType}
通话时长：${Math.floor(this.state.duration / 1000)} 秒
参与者：${this.state.participants.map(p => p.name).join('、')}

【通话内容】
${this.callMessages.map(m => 
  `${m.senderName}: ${m.content}`
).join('\n')}

【输出要求】
1. 通话主题（1-2 句话）
2. 关键事件（按时间顺序）
3. 情感基调
4. 通话产生的决定或约定
5. 摘要控制在 200 字以内`;
    
    const summaryContent = await this.sdk.ai.chat(prompt);
    
    return {
      id: `summary_call_${this.state.callId}`,
      sessionId: this.chat.sessionId,
      type: 'call',  // 摘要类型：call
      callId: this.state.callId,
      summary: summaryContent,
      createdAt: Date.now(),
      
      // 后续聊天可见的字段
      visibleInContext: true,
      injectionPriority: 'normal',
    };
  }
}
```

---

## 1.2 Games 文件夹设计

### 1.2.0 关键定位：游戏是 Chat 的「功能」

> **重要重新定位**：和 Call 一样，Game **不是**与 ChatPrivate/ChatGroup 平行的第三种模式。
> Game 是某个会话（私聊/群聊）内的**临时状态/功能**。

```
❌ 错误：ChatPrivate / ChatGroup / ChatGame 三者平行
✅ 正确：ChatPrivate / ChatGroup 是两种模式；Call/Game 是它们的「临时功能」

差异：游戏比通话「更隔离」
  - 通话期间：聊天界面 + 灵动岛 都能发普通消息（AI 知道你在电话里）
  - 游戏期间：不能切到聊天界面，也不能在灵动岛发普通消息
              只能在「游戏界面」发言（游戏内聊天）
```

**游戏与通话的核心差异**：

| 维度 | 通话（Call） | 游戏（Game） |
|------|-------------|-------------|
| **归属** | 隶属于某个会话 | 隶属于某个会话 |
| **状态** | `in-call`（临时状态） | `in-game`（临时状态） |
| **期间的 UI** | 通话界面 + 聊天界面共存 | 只有游戏界面（聊天界面隐藏） |
| **期间能否在聊天界面发消息** | ✅ 可以 | ❌ 不可以（聊天界面不显示） |
| **期间能否在灵动岛发消息** | ✅ 可以 | ❌ 不可以（被游戏锁住） |
| **期间能否切到其他 App** | ✅ 可以 | ⚠️ 提示后允许（再切回会保留游戏） |
| **期间 AI 上下文** | 之前聊天摘要 + 通话期间所有消息 | 之前聊天摘要 + 游戏内消息 |
| **结束后生成** | 通话摘要 | 游戏摘要 + 完整流程保存 |
| **后续上下文** | 只有摘要进入 | 只有摘要进入 |

**游戏期间的上下文处理**：

```
正常聊天 50 条 → 启动狼人杀 → 游戏结束 → 继续聊天

┌─────────────────────────────────────────────────────────────┐
│ [T0] 正常聊天                                                │
│      上下文：琐碎消息 + 滚动摘要 K1 + 最近 3 回合            │
└─────────────────────────────────────────────────────────────┘
                         ↓ 启动狼人杀
┌─────────────────────────────────────────────────────────────┐
│ [T1] 进入 in-game 状态                                      │
│      - 切换到游戏界面（普通聊天界面隐藏）                    │
│      - 灵动岛被游戏锁住，不能发普通消息                      │
│      - 玩家只能在游戏界面发言（按游戏规则）                  │
│      - 玩家之间的对话被记录为「游戏内消息」                  │
│      - AI 上下文：K1 摘要 + 游戏内消息（完整）               │
│      存储：完整游戏流程（chatGameRounds / chatGameMessages） │
└─────────────────────────────────────────────────────────────┘
                         ↓ 游戏结束
┌─────────────────────────────────────────────────────────────┐
│ [T2] 游戏结束                                               │
│      - 游戏流程被完整保存（用户可回放）                      │
│      - 生成游戏摘要 S_game                                   │
│      - state 回到 idle                                       │
│      - 回到普通聊天界面（之前的聊天内容依然在）              │
└─────────────────────────────────────────────────────────────┘
                         ↓ 继续聊天
┌─────────────────────────────────────────────────────────────┐
│ [T3] 后续聊天上下文                                         │
│      ✅ K1 摘要（之前聊天）                                  │
│      ✅ S_game 摘要（新增）                                  │
│      ❌ 游戏内消息（不再进上下文）                            │
│      ⚠️ 用户可手动编辑摘要加入更多细节                       │
└─────────────────────────────────────────────────────────────┘
```

**完整文件结构**：

```
js/apps/chat-app/games/
├── base/                          # 游戏基础设施
│   ├── game-core.js              # 游戏基类
│   ├── game-engine.js            # 游戏引擎
│   ├── game-state.js             # 游戏状态机
│   ├── game-phases.js            # 游戏阶段定义
│   └── game-message-renderer.js  # 游戏消息渲染
│
├── private/                       # 私聊游戏（1v1）
│   ├── game-manager-private.js   # 私聊游戏管理器
│   ├── werewolf-private.js
│   ├── undercover-private.js
│   └── trivia-private.js
│
├── group/                         # 群聊游戏（多人）
│   ├── game-manager-group.js     # 群聊游戏管理器
│   ├── werewolf-group.js
│   ├── undercover-group.js
│   └── trivia-group.js
│
└── shared/                        # 公用游戏逻辑
    ├── prompts/                   # 游戏 Prompt
    │   ├── werewolf-prompts.js
    │   ├── undercover-prompts.js
    │   └── trivia-prompts.js
    └── utils/
        ├── role-assigner.js
        └── vote-calculator.js
```

### 1.2.1 GameManager（游戏管理器 - 作为 Chat 的功能模块）

```javascript
// games/base/game-manager.js
// 游戏管理器 - 作为 Chat 的功能模块

/**
 * GameManager - 游戏管理器
 * 
 * 职责：
 * 1. 管理游戏状态（in-game / idle）
 * 2. 游戏期间锁住聊天界面和灵动岛
 * 3. 游戏期间构建上下文（聊天摘要 + 游戏内消息）
 * 4. 游戏结束生成摘要，保存完整流程
 * 
 * 与 CallManager 的关键差异：
 * - CallManager：通话期间聊天界面/灵动岛依然可用
 * - GameManager：游戏期间聊天界面/灵动岛被锁
 * 
 * 与 ChatPrivate/ChatGroup 的关系：
 * - GameManager 不是 ChatPrivate/ChatGroup 的子类
 * - GameManager 是 Chat 的「功能模块」，被 Chat 实例持有
 * - 一个 Chat 实例最多同时只有一个 activeGame
 */
class GameManager {
  constructor(options) {
    this.chat = options.chat;  // 持有 Chat 实例
    this.sdk = options.sdk;
    
    // 游戏状态
    this.state = reactive({
      isInGame: false,
      gameType: null,         // 'werewolf' | 'undercover' | 'trivia'
      gameId: null,
      gameInstance: null,     // 具体游戏实例
      chatType: null,         // 'private' | 'group' - 标记是私聊游戏还是群聊游戏
      startedAt: null,
      currentRound: 0,
      currentPhase: null,
    });
    
    // 游戏期间的消息容器
    this.gameMessages = [];  // 游戏内产生的所有消息
  }
  
  /**
   * 启动游戏
   */
  async startGame(options) {
    if (this.state.isInGame) {
      throw new Error('已有游戏在进行中');
    }
    
    const { gameType, participants = [], gameConfig = {} } = options;
    
    // 根据游戏类型和聊天类型选择游戏类
    const GameClass = this._getGameClass(gameType, this.chat.type);
    if (!GameClass) {
      throw new Error(`未找到游戏：${gameType} (${this.chat.type})`);
    }
    
    // 创建游戏实例
    const gameInstance = new GameClass({
      gameId: `game_${Date.now()}`,
      gameType,
      chatType: this.chat.type,  // 'private' | 'group'
      sessionId: this.chat.sessionId,
      participants,
      config: gameConfig,
      ownerId: this.chat.state.currentUserId,
      chat: this.chat,  // 引用 Chat 实例
      sdk: this.sdk,
    });
    
    this.state.isInGame = true;
    this.state.gameType = gameType;
    this.state.gameId = gameInstance.gameId;
    this.state.gameInstance = gameInstance;
    this.state.chatType = this.chat.type;
    this.state.startedAt = Date.now();
    this.state.currentRound = 0;
    this.state.currentPhase = 'init';
    
    // 修改 Chat 状态
    this.chat.state.mode = 'in-game';
    this.chat.state.activeGame = this;
    
    // 锁定灵动岛
    this.toolkit.island.lockForGame();
    
    // 通知 Chat 切换到游戏界面
    this.chat.events.emit('enter-game', { 
      gameId: gameInstance.gameId,
      gameType,
    });
    
    // 启动游戏
    await gameInstance.start();
    
    // 持久化游戏记录
    await this.db.put('chatGames', {
      id: gameInstance.gameId,
      sessionId: this.chat.sessionId,
      gameType,
      chatType: this.chat.type,
      startedAt: this.state.startedAt,
      participants,
      status: 'ongoing',
    });
  }
  
  /**
   * 处理游戏内消息
   * 
   * 与 CallManager.handleMessage 的关键差异：
   * - CallManager：处理的是普通聊天消息（带 duringCall 标记）
   * - GameManager：处理的是游戏内消息（按游戏规则发起的发言）
   * 
   * 这些消息不会写进 chatMessages（普通消息存储），
   * 而是写进 chatGameMessages（游戏内消息存储）。
   */
  async handleGameMessage(message) {
    if (!this.state.isInGame) return;
    
    this.gameMessages.push(message);
    
    // 同步到游戏记录的 messages 字段
    await this._appendToGameRecord(message);
  }
  
  /**
   * 游戏期间构建 AI 上下文
   * 
   * 与 CallManager.buildContext 的关键差异：
   * - CallManager：上下文包含「通话期间所有消息」（包括普通聊天消息）
   * - GameManager：上下文只包含「游戏内消息」，不包含普通聊天
   * 
   * 因为游戏期间用户不能发普通消息，所以上下文很干净。
   */
  async buildContext() {
    const recentSummaries = await this._getRecentSummaries(1);  // K1
    
    return {
      // ✅ 之前聊天的滚动摘要（K1）
      chatSummary: recentSummaries[0]?.summary || '',
      
      // ✅ 游戏内消息（完整）
      gameMessages: this.gameMessages,
      
      // ✅ 游戏元数据
      gameMeta: {
        gameType: this.state.gameType,
        chatType: this.state.chatType,
        currentRound: this.state.currentRound,
        currentPhase: this.state.currentPhase,
        players: this.state.gameInstance?.state.players,
      },
      
      // 游戏专用的 system prompt（来自 games/shared/prompts/）
      systemPrompt: this._getGameSystemPrompt(),
    };
  }
  
  /**
   * 结束游戏
   * 
   * 关键步骤：
   * 1. 结束游戏实例
   * 2. 生成游戏摘要
   * 3. 持久化完整游戏流程
   * 4. 把摘要拼接到会话摘要链
   * 5. 清理临时数据
   * 6. state 回到 idle
   * 7. 解锁灵动岛
   * 8. 通知 Chat 切回聊天界面
   */
  async endGame(options = {}) {
    if (!this.state.isInGame) return;
    
    const { reason = 'completed' } = options;
    
    const endedAt = Date.now();
    const duration = endedAt - this.state.startedAt;
    
    // 1. 结束游戏实例
    await this.state.gameInstance.end();
    
    // 2. 生成游戏摘要
    const summary = await this._generateGameSummary();
    
    // 3. 持久化完整游戏流程
    await this.db.put('chatGames', {
      id: this.state.gameId,
      sessionId: this.chat.sessionId,
      gameType: this.state.gameType,
      chatType: this.state.chatType,
      startedAt: this.state.startedAt,
      endedAt,
      duration,
      participants: Array.from(this.state.gameInstance.state.players.values()),
      messages: this.gameMessages,
      rounds: this.state.gameInstance.state.history,
      summary,
      summaryId: summary.id,
      status: 'completed',
      endReason: reason,
    });
    
    // 4. 把摘要拼接到会话摘要链
    await this.db.put('chatSummaries', summary);
    
    // 5. 清理临时数据
    this.gameMessages = [];
    
    // 6. 状态回到 idle
    this.state.isInGame = false;
    this.state.gameType = null;
    this.state.gameId = null;
    this.state.gameInstance = null;
    this.state.chatType = null;
    this.state.startedAt = null;
    this.state.currentRound = 0;
    this.state.currentPhase = null;
    
    // 7. 修改 Chat 状态
    this.chat.state.mode = 'idle';
    this.chat.state.activeGame = null;
    
    // 8. 解锁灵动岛
    this.toolkit.island.unlockForGame();
    
    // 9. 通知 Chat 切回聊天界面
    this.chat.events.emit('exit-game', { 
      gameId: this.state.gameId,
      summaryId: summary.id,
    });
    
    return summary;
  }
  
  /**
   * 生成游戏摘要
   * 
   * 与通话摘要的差异：
   * - 通话摘要：偏重情感和决定
   * - 游戏摘要：偏重流程和结果
   */
  async _generateGameSummary() {
    const gameInstance = this.state.gameInstance;
    
    const prompt = `请根据以下游戏内容生成游戏摘要。

【游戏元数据】
游戏类型：${this.state.gameType}
游戏模式：${this.state.chatType === 'private' ? '私聊' : '群聊'}
游戏时长：${Math.floor((Date.now() - this.state.startedAt) / 1000)} 秒
玩家：${Array.from(gameInstance.state.players.values()).map(p => p.name).join('、')}
结果：${gameInstance.state.winner || '未完成'}

【游戏流程】
${this.gameMessages.map(m => 
  `${m.senderName}（${m.role || '玩家'}）: ${m.content}`
).join('\n')}

【输出要求】
1. 游戏结果（输赢）
2. 关键事件（按时间顺序）
3. 各玩家表现
4. 游戏产生的趣事或梗
5. 摘要控制在 200 字以内`;
    
    const summaryContent = await this.sdk.ai.chat(prompt);
    
    return {
      id: `summary_game_${this.state.gameId}`,
      sessionId: this.chat.sessionId,
      type: 'game',  // 摘要类型：game
      gameId: this.state.gameId,
      gameType: this.state.gameType,
      summary: summaryContent,
      createdAt: Date.now(),
      
      // 后续聊天可见的字段
      visibleInContext: true,
      injectionPriority: 'normal',
    };
  }
  
  /**
   * 获取游戏类
   */
  _getGameClass(gameType, chatType) {
    const registry = {
      private: {
        werewolf: WerewolfPrivate,
        undercover: UndercoverPrivate,
        trivia: TriviaPrivate,
      },
      group: {
        werewolf: WerewolfGroup,
        undercover: UndercoverGroup,
        trivia: TriviaGroup,
      },
    };
    return registry[chatType]?.[gameType];
  }
}
```

**与 CallManager 的并排对比**：

| 操作 | CallManager（通话） | GameManager（游戏） |
|------|--------------------|--------------------|
| `startCall` / `startGame` | 设置 `mode='in-call'` | 设置 `mode='in-game'` |
| 期间能否发普通消息 | ✅ 走 `handleMessage` | ❌ 被锁住 |
| 期间能否在灵动岛发 | ✅ 可以 | ❌ 灵动岛被锁 |
| `handleMessage` | 处理普通消息 + 标记 duringCall | **不存在**（不允许发普通消息） |
| `handleGameMessage` | 不存在 | 处理游戏内消息 |
| `buildContext` | 聊天摘要 + 通话期间所有消息 | 聊天摘要 + 游戏内消息 |
| 期间 UI | 通话界面 + 聊天界面共存 | 只有游戏界面（聊天界面隐藏） |
| `endCall` / `endGame` | 生成通话摘要 | 生成游戏摘要 + 保存完整流程 |
| 灵动岛 | 通话时显示通话状态 | 游戏时锁住 |

**Chat 实例如何集成**：

```javascript
// services/chat-core.js
// Chat 实例持有 CallManager 和 GameManager

class ChatCore {
  constructor(options) {
    this.sessionId = options.sessionId;
    this.type = options.type;  // 'private' | 'group'
    
    this.state = reactive({
      mode: 'idle',           // 'idle' | 'in-call' | 'in-game'
      activeCall: null,       // CallManager | null
      activeGame: null,       // GameManager | null
    });
    
    // 创建功能模块（每个 Chat 实例都有这两个）
    this.callManager = new CallManager({ chat: this, sdk: this.sdk });
    this.gameManager = new GameManager({ chat: this, sdk: this.sdk });
  }
  
  /**
   * 启动通话（不切换 UI，但标记 in-call）
   */
  async startCall(options) {
    if (this.state.mode === 'in-game') {
      throw new Error('游戏中不能启动通话');
    }
    return await this.callManager.startCall(options);
  }
  
  /**
   * 启动游戏（切换 UI 到游戏界面）
   */
  async startGame(options) {
    if (this.state.mode !== 'idle') {
      throw new Error('当前有通话/游戏进行中');
    }
    return await this.gameManager.startGame(options);
  }
}
```

### 1.2.2 Game Core（游戏基类）

```javascript
// games/base/game-core.js
// 这是 chat.js 没有的，全新设计

/**
 * GameCore - 游戏基类
 * 
 * 所有游戏都继承这个基类
 * 定义通用的游戏逻辑和接口
 */
class GameCore {
  constructor(options) {
    // 游戏基本信息
    this.gameId = options.gameId;
    this.gameType = options.gameType;  // 'werewolf' | 'undercover' | ...
    this.chatType = options.chatType;  // 'private' | 'group'
    this.sessionId = options.sessionId;
    
    // 参与者
    this.participants = options.participants;  // [{ id, name, avatar }]
    this.ownerId = options.ownerId;  // 游戏创建者
    
    // 游戏状态
    this.state = new GameState({
      phase: 'waiting',  // waiting → playing → ended
      currentRound: 0,
      maxRounds: Infinity,
      players: new Map(),  // playerId → playerState
      votes: new Map(),    // round → votes
      history: [],         // 游戏历史记录
    });
    
    // 回调
    this.onStateChange = options.onStateChange;
    this.onMessage = options.onMessage;  // 发送游戏消息
    this.onEnd = options.onEnd;        // 游戏结束回调
  }
  
  // ========== 抽象方法（子类必须实现）==========
  
  /**
   * 获取游戏名称
   */
  getName() {
    throw new Error('子类必须实现 getName()');
  }
  
  /**
   * 获取游戏描述
   */
  getDescription() {
    throw new Error('子类必须实现 getDescription()');
  }
  
  /**
   * 获取最小玩家数
   */
  getMinPlayers() {
    throw new Error('子类必须实现 getMinPlayers()');
  }
  
  /**
   * 分配角色
   * 子类实现具体的角色分配逻辑
   */
  async assignRoles(participantIds) {
    throw new Error('子类必须实现 assignRoles()');
  }
  
  /**
   * 处理玩家动作
   * 子类实现具体的动作处理逻辑
   */
  async handleAction(action, payload, context) {
    throw new Error('子类必须实现 handleAction()');
  }
  
  /**
   * 检查游戏是否结束
   * 子类实现具体的胜利判断逻辑
   */
  checkWinCondition() {
    throw new Error('子类必须实现 checkWinCondition()');
  }
  
  /**
   * 获取胜利者
   */
  getWinners() {
    throw new Error('子类必须实现 getWinners()');
  }
  
  // ========== 公共方法 ==========
  
  /**
   * 开始游戏
   */
  async start() {
    // 1. 验证玩家数量
    if (this.participants.length < this.getMinPlayers()) {
      throw new Error(`需要至少 ${this.getMinPlayers()} 名玩家`);
    }
    
    // 2. 分配角色
    await this.assignRoles(this.participants);
    
    // 3. 更新状态
    this.state.setPhase('playing');
    this.state.currentRound = 1;
    
    // 4. 发送开始消息
    await this.onMessage(this.getStartMessage());
    
    // 5. 执行第一个阶段
    await this.executePhase();
  }
  
  /**
   * 结束游戏
   */
  async end() {
    this.state.setPhase('ended');
    
    // 1. 获取胜利者
    const winners = this.getWinners();
    
    // 2. 发送结束消息
    await this.onMessage(this.getEndMessage(winners));
    
    // 3. 生成游戏摘要
    const summary = await this.generateSummary(winners);
    
    // 4. 调用结束回调
    await this.onEnd({
      gameId: this.gameId,
      gameType: this.gameType,
      winners,
      summary,
      history: this.state.history,
    });
  }
  
  /**
   * 获取开始消息
   */
  getStartMessage() {
    const roleList = Array.from(this.state.players.values())
      .map(p => `${p.name}：${p.roleName}`)
      .join('\n');
    
    return {
      type: 'game_start',
      gameType: this.gameType,
      content: `【${this.getName()}】开始！\n\n角色分配：\n${roleList}`,
    };
  }
  
  /**
   * 生成游戏摘要
   */
  async generateSummary(winners) {
    // 调用 AI 生成摘要
    return await this.promptEngine.generateGameSummary(this, {
      gameType: this.gameType,
      winners,
      history: this.state.history,
      players: this.state.players,
    });
  }
  
  /**
   * 获取玩家状态
   */
  getPlayer(playerId) {
    return this.state.players.get(playerId);
  }
  
  /**
   * 更新玩家状态
   */
  updatePlayer(playerId, updates) {
    const player = this.state.players.get(playerId);
    if (player) {
      Object.assign(player, updates);
      this.state.emit('playerUpdate', { playerId, updates });
    }
  }
}

/**
 * GameState - 游戏状态机
 */
class GameState {
  constructor(initial) {
    this._state = reactive(initial);
  }
  
  get phase() { return this._state.phase; }
  set phase(v) { this._state.phase = v; }
  
  get currentRound() { return this._state.currentRound; }
  set currentRound(v) { this._state.currentRound = v; }
  
  setPhase(phase) {
    this._state.phase = phase;
    this.emit('phaseChange', phase);
  }
  
  emit(event, data) {
    // 触发回调
  }
}
```

### 1.2.3 ⚠️ 旧设计已统一到 GameManager

> **说明**：原本计划有 `PrivateGameManager` / `GroupGameManager` 两个独立的游戏管理器。
> 但因为 Game（游戏）和 Call（通话）一样都是 Chat 的「功能模块」，
> 已经统一为一个 `GameManager`（见 1.2.1），它内部根据 `chat.type` 区分私聊/群聊。
>
> 所以不再需要独立的 PrivateGameManager / GroupGameManager。
>
> 原本 1.2.3 / 1.2.4 的实现细节已合并到 1.2.1 GameManager 中：
> - 私聊游戏的 participants 由 Chat 的 2 个玩家组成
> - 群聊游戏的 participants 由 Chat 的群成员组成
> - GameManager 通过 `chat.type` 自动选择正确的游戏类

### 1.2.3 Private Game Manager（私聊游戏管理器）

```javascript
// games/private/game-manager-private.js
// 管理私聊游戏

/**
 * PrivateGameManager - 私聊游戏管理器
 * 
 * 职责：
 * 1. 创建和管理私聊游戏（1v1）
 * 2. 私聊游戏只有 AI 一个玩家
 * 3. 用户作为另一个玩家参与
 * 
 * 与原 chat.js 的关系：
 * - 原 werewolf.js/undercover.js → 重构为此
 * - 保留原有的游戏逻辑
 * - 新增统一的游戏管理
 */
class PrivateGameManager {
  constructor(chatPrivate) {
    this.chat = chatPrivate;
    this.activeGame = null;  // 当前活跃的游戏
    this.gameHistory = [];    // 历史游戏记录
  }
  
  /**
   * 创建游戏
   * 
   * 与原 chat.js 的关系：
   * - 原 startGame() → 迁移到此
   */
  async createGame(gameType, options) {
    // 1. 检查是否已有活跃游戏
    if (this.activeGame) {
      throw new Error('当前有进行中的游戏，请先结束');
    }
    
    // 2. 检查模式（游戏只能在按主题模式）
    if (this.chat.mode !== 'topic') {
      throw new Error('游戏只能在按主题模式的窗口进行');
    }
    
    // 3. 获取游戏类
    const GameClass = this.getGameClass(gameType, 'private');
    
    // 4. 创建游戏实例
    const game = new GameClass({
      gameId: `game_${Date.now()}`,
      gameType,
      chatType: 'private',
      sessionId: this.chat.sessionId,
      participants: [
        { id: this.chat.state.currentUserId, name: '我' },
        { id: this.chat.personaId, name: this.chat.personaName },
      ],
      ownerId: this.chat.state.currentUserId,
      
      // 回调
      onStateChange: (state) => this.handleStateChange(state),
      onMessage: (msg) => this.handleGameMessage(msg),
      onEnd: (result) => this.handleGameEnd(result),
    });
    
    // 5. 保存引用
    this.activeGame = game;
    
    return game;
  }
  
  /**
   * 获取游戏类
   */
  getGameClass(gameType, chatType) {
    const games = {
      werewolf: {
        private: WerewolfPrivate,
        group: WerewolfGroup,
      },
      undercover: {
        private: UndercoverPrivate,
        group: UndercoverGroup,
      },
    };
    
    return games[gameType]?.[chatType] || throw new Error(`不支持的游戏类型: ${gameType}`);
  }
  
  /**
   * 处理游戏状态变化
   */
  async handleStateChange(state) {
    // 更新 UI
    this.chat.state.activeGame = state;
    
    // 如果需要 AI 响应
    if (state.needsAIResponse) {
      await this.requestAIResponse(state);
    }
  }
  
  /**
   * 请求 AI 响应
   */
  async requestAIResponse(gameState) {
    const prompt = this.buildGamePrompt(gameState);
    const response = await this.chat.callAI(prompt);
    
    // 解析 AI 的游戏动作
    const action = this.parseGameAction(response);
    
    // 执行动作
    await this.activeGame.handleAction(action.type, action.payload, {
      senderId: this.chat.personaId,
      isAI: true,
    });
  }
  
  /**
   * 处理游戏消息
   */
  async handleGameMessage(message) {
    await this.chat.sendSystemMessage(message);
  }
  
  /**
   * 游戏结束处理
   */
  async handleGameEnd(result) {
    // 1. 保存到历史
    this.gameHistory.push({
      ...result,
      endedAt: Date.now(),
    });
    
    // 2. 清空活跃游戏
    this.activeGame = null;
    
    // 3. 更新状态
    this.chat.state.activeGame = null;
  }
}
```

### 1.2.4 Group Game Manager（群聊游戏管理器）

```javascript
// games/group/game-manager-group.js
// 管理群聊游戏

/**
 * GroupGameManager - 群聊游戏管理器
 * 
 * 职责：
 * 1. 创建和管理群聊游戏（多人）
 * 2. 所有群成员都可能参与游戏
 * 3. 处理多人游戏逻辑
 * 
 * 与原 chat.js 的关系：
 * - 原 werewolf.js/undercover.js → 重构为此
 * - 保留原有的多人游戏逻辑
 * - 新增统一的游戏管理
 */
class GroupGameManager {
  constructor(chatGroup) {
    this.chat = chatGroup;
    this.activeGame = null;
    this.gameHistory = [];
  }
  
  /**
   * 创建游戏
   */
  async createGame(gameType, options) {
    // 1. 检查是否已有活跃游戏
    if (this.activeGame) {
      throw new Error('当前有进行中的游戏');
    }
    
    // 2. 检查玩家数量
    const memberCount = this.chat.memberIds.length;
    const minPlayers = this.getMinPlayers(gameType);
    if (memberCount < minPlayers) {
      throw new Error(`需要至少 ${minPlayers} 名成员，当前 ${memberCount} 名`);
    }
    
    // 3. 获取游戏类
    const GameClass = this.getGameClass(gameType, 'group');
    
    // 4. 创建游戏
    const game = new GameClass({
      gameId: `game_${Date.now()}`,
      gameType,
      chatType: 'group',
      sessionId: this.chat.sessionId,
      participants: this.chat.memberIds.map(id => ({
        id,
        ...this.chat.memberMap.get(id),
      })),
      ownerId: options.ownerId,
      
      onStateChange: (state) => this.handleStateChange(state),
      onMessage: (msg) => this.handleGameMessage(msg),
      onEnd: (result) => this.handleGameEnd(result),
    });
    
    this.activeGame = game;
    return game;
  }
  
  /**
   * 处理用户加入游戏
   */
  async joinGame(userId) {
    if (!this.activeGame) return;
    
    const player = this.chat.memberMap.get(userId);
    await this.activeGame.addPlayer(player);
  }
  
  /**
   * 处理用户离开游戏
   */
  async leaveGame(userId) {
    if (!this.activeGame) return;
    
    await this.activeGame.removePlayer(userId);
    
    // 检查是否因人数不足需要结束游戏
    if (this.activeGame.getActivePlayerCount() < this.activeGame.getMinPlayers()) {
      await this.activeGame.endprematurely('人数不足');
    }
  }
  
  /**
   * 处理游戏状态变化
   */
  async handleStateChange(state) {
    this.chat.state.activeGame = state;
    
    // 通知相关成员
    if (state.notifyMembers) {
      await this.notifyMembers(state.notifyMembers);
    }
    
    // 如果需要 AI 响应
    if (state.needsAIResponse) {
      await this.requestAIResponses(state);
    }
  }
  
  /**
   * 请求多个 AI 响应
   */
  async requestAIResponses(gameState) {
    const responders = gameState.currentResponders;
    
    await Promise.all(
      responders.map(memberId => this.requestAIResponse(memberId, gameState))
    );
  }
  
  /**
   * 请求单个 AI 响应
   */
  async requestAIResponse(memberId, gameState) {
    const member = this.chat.memberMap.get(memberId);
    const prompt = this.buildGamePrompt(gameState, member);
    const response = await this.chat.callAI(prompt, member);
    
    const action = this.parseGameAction(response);
    
    await this.activeGame.handleAction(action.type, action.payload, {
      senderId: memberId,
      isAI: true,
    });
  }
}
```

### 1.2.5 Werewolf Private（私聊狼人杀）

```javascript
// games/private/werewolf-private.js
// 私聊狼人杀

/**
 * WerewolfPrivate - 私聊狼人杀
 * 
 * 私聊狼人杀规则（简化版）：
 * - 只有 2 个玩家：我 和 AI
 * - AI 扮演狼人，我扮演村民
 * - 通过对话推断对方身份
 * - 最后投票
 * 
 * 与原 chat.js 的关系：
 * - 原 werewolf.js → 迁移到此
 * - 简化规则适配 1v1
 */
class WerewolfPrivate extends GameCore {
  getName() { return '狼人杀（私聊版）'; }
  getDescription() { return '1v1 狼人杀，简化为村民 vs 狼人'; }
  getMinPlayers() { return 2; }
  
  /**
   * 分配角色（简化版）
   * - 随机分配：1个狼人 + 1个村民
   */
  async assignRoles(participantIds) {
    const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
    const roles = {
      [shuffled[0]]: { role: 'werewolf', roleName: '狼人' },
      [shuffled[1]]: { role: 'villager', roleName: '村民' },
    };
    
    for (const [id, role] of Object.entries(roles)) {
      this.state.players.set(id, {
        ...role,
        isAlive: true,
        hasVoted: false,
        voteTarget: null,
      });
      
      // 私信告知角色（保密）
      if (id !== this.ownerId) {
        await this.notifyRoleSecretly(id, role);
      }
    }
  }
  
  /**
   * 处理游戏动作
   */
  async handleAction(action, payload, context) {
    switch (action) {
      case 'speak':
        return await this.handleSpeak(payload, context);
      case 'vote':
        return await this.handleVote(payload, context);
      case 'accuse':
        return await this.handleAccuse(payload, context);
      default:
        console.warn('未知动作:', action);
    }
  }
  
  /**
   * 处理发言
   */
  async handleSpeak(payload, context) {
    const player = this.state.players.get(context.senderId);
    
    // 记录发言
    this.state.history.push({
      type: 'speak',
      senderId: context.senderId,
      content: payload.content,
      timestamp: Date.now(),
    });
    
    // 如果是 AI 发言，需要生成回复
    if (context.isAI) {
      // AI 已经在外部生成并调用了这里
      return;
    }
    
    // 如果是我发言，AI 需要回应
    if (!context.isAI && this.state.phase === 'playing') {
      // 请求 AI 响应（由管理器调用）
      return { needsAIResponse: true };
    }
  }
  
  /**
   * 处理投票
   */
  async handleVote(payload, context) {
    const voter = this.state.players.get(context.senderId);
    voter.hasVoted = true;
    voter.voteTarget = payload.targetId;
    
    this.state.votes.set(this.state.currentRound, {
      ...this.state.votes.get(this.state.currentRound),
      [context.senderId]: payload.targetId,
    });
    
    // 检查是否所有人都投了
    const allVoted = Array.from(this.state.players.values())
      .every(p => p.isAlive && p.hasVoted);
    
    if (allVoted) {
      await this.tallyVotes();
    }
  }
  
  /**
   * 统计票数
   */
  async tallyVotes() {
    const roundVotes = this.state.votes.get(this.state.currentRound);
    const voteCount = {};
    
    for (const targetId of Object.values(roundVotes)) {
      voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    }
    
    // 找出票数最多的人
    const maxVotes = Math.max(...Object.values(voteCount));
    const eliminated = Object.entries(voteCount)
      .filter(([_, count]) => count === maxVotes)
      .map(([id]) => id);
    
    // 处理结果
    if (eliminated.length === 1) {
      await this.eliminatePlayer(eliminated[0]);
    } else {
      // 平票，重新投票
      await this.onMessage({
        type: 'vote_tie',
        content: `平票！${eliminated.length} 人票数相同，重新投票`,
      });
      
      // 重置投票状态
      for (const player of this.state.players.values()) {
        player.hasVoted = false;
        player.voteTarget = null;
      }
    }
  }
  
  /**
   * 淘汰玩家
   */
  async eliminatePlayer(playerId) {
    const player = this.state.players.get(playerId);
    player.isAlive = false;
    
    await this.onMessage({
      type: 'elimination',
      content: `投票结果：${player.name} 被投票出局！身份是：${player.roleName}`,
    });
    
    // 检查胜利条件
    await this.checkWinCondition();
  }
  
  /**
   * 检查胜利条件
   */
  async checkWinCondition() {
    const alivePlayers = Array.from(this.state.players.values())
      .filter(p => p.isAlive);
    
    const aliveWerewolf = alivePlayers.find(p => p.role === 'werewolf');
    const aliveVillager = alivePlayers.find(p => p.role === 'villager');
    
    if (!aliveWerewolf) {
      // 狼人被淘汰，村民胜利
      this.state.winner = 'villager';
      await this.end();
    } else if (!aliveVillager) {
      // 村民被淘汰，狼人胜利
      this.state.winner = 'werewolf';
      await this.end();
    } else if (this.state.currentRound >= 5) {
      // 超过最大回合，平局
      this.state.winner = 'draw';
      await this.end();
    } else {
      // 继续游戏
      this.state.currentRound++;
      this.state.phase = 'discussion';
      
      // 重置投票状态
      for (const player of this.state.players.values()) {
        player.hasVoted = false;
        player.voteTarget = null;
      }
      
      await this.executePhase();
    }
  }
  
  /**
   * 获取胜利者
   */
  getWinners() {
    if (this.state.winner === 'werewolf') {
      return [this.ownerId];  // AI 胜利
    } else if (this.state.winner === 'villager') {
      return [this.ownerId === this.chat.personaId 
        ? this.chat.personaId 
        : this.chat.state.currentUserId];  // 我胜利
    }
    return [];
  }
  
  /**
   * 获取结束消息
   */
  getEndMessage(winners) {
    const winner = winners[0];
    const isMeWinner = winner === this.ownerId;
    
    return {
      type: 'game_end',
      gameType: 'werewolf',
      content: `【狼人杀结束】

${isMeWinner ? '你胜利了！' : '你输了！'}

${Array.from(this.state.players.values()).map(p => 
  `${p.name}：${p.roleName}`
).join('\n')}

游戏回合数：${this.state.currentRound}`,
    };
  }
}
```

### 1.2.6 Werewolf Group（群聊狼人杀）

```javascript
// games/group/werewolf-group.js
// 群聊狼人杀

/**
 * WerewolfGroup - 群聊狼人杀
 * 
 * 群聊狼人杀规则（完整版）：
 * - 4+ 个玩家
 * - 角色：狼人、村民、预言家、女巫、猎人等
 * - 夜间行动 + 白天发言 + 投票
 * 
 * 与私聊版的区别：
 * - 完整角色系统
 * - 夜间阶段（狼人杀人、预言家查验、女巫用药）
 * - 多人投票
 * - 遗言机制
 */
class WerewolfGroup extends GameCore {
  getName() { return '狼人杀（群聊版）'; }
  getDescription() { return '完整版狼人杀，支持多种角色'; }
  getMinPlayers() { return 4; }
  
  // 角色定义
  static ROLES = {
    werewolf: { name: '狼人', count: (n) => Math.floor(n / 4), team: 'werewolf' },
    villager: { name: '村民', count: (n) => Math.floor(n / 4), team: 'villager' },
    seer: { name: '预言家', count: 1, team: 'villager' },
    witch: { name: '女巫', count: 1, team: 'villager' },
    hunter: { name: '猎人', count: 1, team: 'villager' },
  };
  
  /**
   * 分配角色（完整版）
   */
  async assignRoles(participantIds) {
    const count = participantIds.length;
    const roleList = [];
    
    // 根据人数分配角色
    const werewolfCount = WerewolfGroup.ROLES.werewolf.count(count);
    const villagerCount = WerewolfGroup.ROLES.villager.count(count);
    
    // 添加狼人
    for (let i = 0; i < werewolfCount; i++) {
      roleList.push('werewolf');
    }
    
    // 添加村民
    for (let i = 0; i < villagerCount; i++) {
      roleList.push('villager');
    }
    
    // 添加神职
    if (count >= 6) roleList.push('seer');
    if (count >= 6) roleList.push('witch');
    if (count >= 7) roleList.push('hunter');
    
    // 随机分配
    const shuffledRoles = roleList.sort(() => Math.random() - 0.5);
    const shuffledPlayers = [...participantIds].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffledPlayers.length; i++) {
      const role = shuffledRoles[i] || 'villager';
      const roleInfo = WerewolfGroup.ROLES[role];
      
      this.state.players.set(shuffledPlayers[i], {
        role,
        roleName: roleInfo.name,
        team: roleInfo.team,
        isAlive: true,
        hasVoted: false,
        voteTarget: null,
        // 角色特有状态
        ...this.getRoleState(role),
      });
    }
  }
  
  /**
   * 获取角色特有状态
   */
  getRoleState(role) {
    switch (role) {
      case 'seer':
        return { canCheck: true, checkedPlayers: [] };
      case 'witch':
        return { 
          hasPotion: true,      // 救药
          hasPoison: true,     // 毒药
          usedPotion: false,
          usedPoison: false,
          savedPlayer: null,
          poisonedPlayer: null,
        };
      case 'hunter':
        return { canShoot: true, shotTarget: null };
      default:
        return {};
    }
  }
  
  /**
   * 执行游戏阶段
   */
  async executePhase() {
    switch (this.state.phase) {
      case 'waiting':
        // 等待玩家加入
        break;
        
      case 'night':
        await this.executeNightPhase();
        break;
        
      case 'day':
        await this.executeDayPhase();
        break;
        
      case 'vote':
        await this.executeVotePhase();
        break;
    }
  }
  
  /**
   * 夜间阶段
   */
  async executeNightPhase() {
    await this.onMessage({
      type: 'phase_night',
      content: '【夜间阶段】天黑了，请闭眼...',
    });
    
    // 等待各角色行动
    const nightActions = await this.waitForNightActions();
    
    // 处理夜间结果
    const result = this.processNightActions(nightActions);
    
    // 公布死亡信息
    if (result.died.length > 0) {
      for (const playerId of result.died) {
        this.state.players.get(playerId).isAlive = false;
      }
      
      await this.onMessage({
        type: 'night_result',
        content: `天亮了！昨夜死亡：${result.died.map(id => 
          this.state.players.get(id).name
        ).join('、')}`,
      });
    } else {
      await this.onMessage({
        type: 'night_result',
        content: '天亮了！昨夜是平安夜',
      });
    }
    
    // 检查胜利条件
    if (this.checkWinCondition()) return;
    
    // 进入白天
    this.state.phase = 'day';
    await this.executeDayPhase();
  }
  
  /**
   * 等待夜间行动
   */
  async waitForNightActions() {
    const actions = {};
    const nightRoles = ['werewolf', 'seer', 'witch'];
    
    // 等待每个有夜间能力的角色行动
    for (const [playerId, player] of this.state.players) {
      if (!player.isAlive) continue;
      if (!nightRoles.includes(player.role)) continue;
      
      actions[playerId] = await this.waitForPlayerAction(playerId, 'night');
    }
    
    return actions;
  }
  
  /**
   * 等待玩家行动
   */
  async waitForPlayerAction(playerId, phase) {
    return new Promise((resolve) => {
      // 设置超时
      const timeout = setTimeout(() => {
        resolve({ type: 'timeout' });
      }, 30000);  // 30秒超时
      
      // 监听玩家动作
      this.once(`playerAction:${playerId}`, (action) => {
        clearTimeout(timeout);
        resolve(action);
      });
    });
  }
  
  /**
   * 处理夜间行动
   */
  processNightActions(actions) {
    const result = {
      died: [],
      saved: null,
      checked: {},
    };
    
    // 狼人杀人
    const werewolfVotes = {};
    for (const [playerId, action] of Object.entries(actions)) {
      const player = this.state.players.get(playerId);
      if (player?.role === 'werewolf' && action.targetId) {
        werewolfVotes[action.targetId] = (werewolfVotes[action.targetId] || 0) + 1;
      }
    }
    
    if (Object.keys(werewolfVotes).length > 0) {
      const killed = Object.entries(werewolfVotes)
        .sort((a, b) => b[1] - a[1])[0][0];
      result.died.push(killed);
    }
    
    // 女巫救人/毒人
    for (const [playerId, action] of Object.entries(actions)) {
      const player = this.state.players.get(playerId);
      if (player?.role === 'witch') {
        if (action.save && result.died.includes(action.save) && player.hasPotion) {
          result.saved = action.save;
          result.died = result.died.filter(id => id !== action.save);
          player.usedPotion = true;
        }
        if (action.poison && player.hasPoison) {
          result.died.push(action.poison);
          player.usedPoison = true;
        }
      }
    }
    
    return result;
  }
  
  /**
   * 白天阶段
   */
  async executeDayPhase() {
    this.state.phase = 'day';
    
    await this.onMessage({
      type: 'phase_day',
      content: `【白天阶段 - 第${this.state.currentRound}天】\n请各位玩家发言`,
    });
    
    // 等待发言结束
    // ... (省略等待逻辑)
    
    // 进入投票阶段
    this.state.phase = 'vote';
    await this.executeVotePhase();
  }
  
  /**
   * 投票阶段
   */
  async executeVotePhase() {
    await this.onMessage({
      type: 'phase_vote',
      content: '【投票阶段】请各位投票选出要放逐的玩家',
    });
    
    // 等待所有人投票
    const votes = await this.waitForAllVotes();
    
    // 统计票数
    const result = this.tallyGroupVotes(votes);
    
    if (result.eliminated) {
      const player = this.state.players.get(result.eliminated);
      player.isAlive = false;
      
      await this.onMessage({
        type: 'elimination',
        content: `${player.name} 被投票出局！身份是：${player.roleName}`,
      });
      
      // 猎人开枪检测
      if (player.role === 'hunter' && player.canShoot) {
        // 等待猎人开枪
      }
    } else {
      await this.onMessage({
        type: 'vote_tie',
        content: '投票平票，今天无人出局',
      });
    }
    
    // 检查胜利条件
    if (!this.checkWinCondition()) {
      this.state.currentRound++;
      this.state.phase = 'night';
      await this.executeNightPhase();
    }
  }
  
  /**
   * 统计群聊投票
   */
  tallyGroupVotes(votes) {
    const voteCount = {};
    
    for (const targetId of Object.values(votes)) {
      voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    }
    
    const maxVotes = Math.max(...Object.values(voteCount));
    const candidates = Object.entries(voteCount)
      .filter(([_, count]) => count === maxVotes);
    
    if (candidates.length === 1) {
      return { eliminated: candidates[0][0] };
    }
    
    return { eliminated: null };  // 平票
  }
  
  /**
   * 检查胜利条件
   */
  checkWinCondition() {
    const alivePlayers = Array.from(this.state.players.values())
      .filter(p => p.isAlive);
    
    const aliveWerewolf = alivePlayers.filter(p => p.team === 'werewolf').length;
    const aliveVillager = alivePlayers.filter(p => p.team === 'villager').length;
    
    if (aliveWerewolf === 0) {
      this.state.winner = 'villager';
      this.end();
      return true;
    }
    
    if (aliveWerewolf >= aliveVillager) {
      this.state.winner = 'werewolf';
      this.end();
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取胜利者
   */
  getWinners() {
    if (this.state.winner === 'werewolf') {
      return Array.from(this.state.players.entries())
        .filter(([_, p]) => p.team === 'werewolf' && p.isAlive)
        .map(([id]) => id);
    } else {
      return Array.from(this.state.players.entries())
        .filter(([_, p]) => p.team === 'villager' && p.isAlive)
        .map(([id]) => id);
    }
  }
}
```

---

## 1.3 历史记录系统设计

### 1.3.1 设计理念

原 chat.js 的问题：

```
问题：没有历史记录系统
├── 聊天消息只显示最近的几条
├── 没有按日期/按主题查看历史
├── 没有历史摘要功能
└── 用户想要回顾之前的对话非常困难
```

**新的设计：完整的历史记录系统**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         历史记录系统                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    HistoryViewer（历史查看器）                        │ │
│  │                                                                      │ │
│  │  功能：                                                             │ │
│  │  - 按日期查看历史消息                                               │ │
│  │  - 按主题查看历史消息（按主题模式）                                  │ │
│  │  - 历史摘要生成/编辑/发布/注入                                      │ │
│  │  - 历史消息搜索                                                     │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              ▲                                           │
│         ┌────────────────────┼────────────────────┐                    │
│         │                    │                    │                    │
│  ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐          │
│  │ PrivateHistory│      │ GroupHistory  │      │ CallHistory │          │
│  │  （私聊历史）│      │  （群聊历史）│      │  （通话历史）│          │
│  │              │      │              │      │              │          │
│  │ - 个人摘要   │      │ - 多人摘要   │      │ - 通话摘要  │          │
│  │ - 朋友圈联动│      │ - 群公告     │      │ - 时长统计  │          │
│  └─────────────┘      └─────────────┘      └─────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3.2 HistoryViewer（历史查看器基类）

```javascript
// history/history-viewer.js
// 历史查看器基类

/**
 * HistoryViewer - 历史查看器基类
 * 
 * 功能：
 * 1. 按日期/主题查看历史消息
 * 2. 历史摘要管理（生成/编辑/重Roll/发布/注入）
 * 3. 历史消息搜索
 * 
 * 与原 chat.js 的关系：
 * - 原完全没有此功能，全新设计
 */
class HistoryViewer {
  constructor(options) {
    this.chat = options.chat;
    this.sessionId = options.sessionId;
    this.windowId = options.windowId;
    this.mode = options.mode;  // 'date' | 'topic'
    
    // 历史摘要管理器
    this.summaryManager = new HistorySummaryManager(this);
  }
  
  // ========== 历史消息查看 ==========
  
  /**
   * 获取历史消息
   * 
   * @param {Object} filter - 筛选条件
   * @param {string} filter.type - 'date' | 'topic' | 'all'
   * @param {string} filter.date - 日期（按日期模式）
   * @param {string} filter.topicId - 主题ID（按主题模式）
   * @param {number} filter.page - 页码
   * @param {number} filter.limit - 每页数量
   */
  async getMessages(filter = {}) {
    const { type = 'all', date, topicId, page = 1, limit = 20 } = filter;
    
    let messages;
    
    if (this.mode === 'date') {
      messages = await this.getMessagesByDate(date, page, limit);
    } else if (this.mode === 'topic') {
      messages = await this.getMessagesByTopic(topicId, page, limit);
    } else {
      messages = await this.getAllMessages(page, limit);
    }
    
    return messages;
  }
  
  /**
   * 按日期获取消息
   */
  async getMessagesByDate(date, page, limit) {
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setHours(23, 59, 59, 999);
    
    return await this.chat.messageStore.query({
      sessionId: this.sessionId,
      timestamp: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      page,
      limit,
    });
  }
  
  /**
   * 按主题获取消息
   */
  async getMessagesByTopic(topicId, page, limit) {
    return await this.chat.messageStore.query({
      sessionId: this.sessionId,
      topicId,
      page,
      limit,
    });
  }
  
  // ========== 日期导航 ==========
  
  /**
   * 获取有消息的日期列表（用于日历导航）
   */
  async getDatesWithMessages() {
    const messages = await this.chat.messageStore.getDistinctDates(this.sessionId);
    return messages;
  }
  
  /**
   * 获取日期范围内的消息概览
   */
  async getDateRangeOverview(startDate, endDate) {
    const messages = await this.chat.messageStore.query({
      sessionId: this.sessionId,
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
      groupBy: 'day',  // 按天分组
    });
    
    return messages.map(day => ({
      date: day.date,
      messageCount: day.count,
      lastMessage: day.lastMessage,
      hasSummary: day.hasSummary,
    }));
  }
  
  // ========== 主题管理（按主题模式）==========
  
  /**
   * 获取主题列表
   */
  async getTopics() {
    if (this.mode !== 'topic') return [];
    
    const session = await this.chat.getSession(this.sessionId);
    return session.topics || [];
  }
  
  /**
   * 创建新主题
   */
  async createTopic(name) {
    if (this.mode !== 'topic') {
      throw new Error('只能在按主题模式创建主题');
    }
    
    const topic = {
      id: `topic_${Date.now()}`,
      name,
      createdAt: Date.now(),
      messageCount: 0,
      isActive: true,
    };
    
    // 保存到会话
    const session = await this.chat.getSession(this.sessionId);
    session.topics = session.topics || [];
    session.topics.push(topic);
    await this.chat.saveSession(session);
    
    // 更新活跃主题
    await this.setActiveTopic(topic.id);
    
    return topic;
  }
  
  /**
   * 设置活跃主题
   */
  async setActiveTopic(topicId) {
    const session = await this.chat.getSession(this.sessionId);
    
    for (const topic of session.topics) {
      topic.isActive = (topic.id === topicId);
    }
    
    session.activeTopicId = topicId;
    await this.chat.saveSession(session);
  }
  
  // ========== 消息搜索 ==========
  
  /**
   * 搜索历史消息
   */
  async searchMessages(keyword, options = {}) {
    const { limit = 50 } = options;
    
    return await this.chat.messageStore.search({
      sessionId: this.sessionId,
      keyword,
      limit,
    });
  }
}
```

### 1.3.3 HistorySummaryManager（历史摘要管理器）

```javascript
// history/history-summary-manager.js
// 历史摘要管理器

/**
 * HistorySummaryManager - 历史摘要管理器
 * 
 * 功能：
 * 1. 生成历史摘要（用户手动触发）
 * 2. 编辑摘要
 * 3. 重Roll 摘要
 * 4. 发布摘要（变为可注入状态）
 * 5. 注入摘要到当前对话
 * 
 * 与原 chat.js 的关系：
 * - 原完全没有此功能，全新设计
 */
class HistorySummaryManager {
  constructor(historyViewer) {
    this.viewer = historyViewer;
    this.chat = historyViewer.chat;
  }
  
  // ========== 生成摘要 ==========
  
  /**
   * 生成历史摘要
   * 
   * 用户选择某个日期/主题，点击"生成摘要"
   * 
   * @param {Object} options
   * @param {string} options.type - 'date' | 'topic'
   * @param {string} options.date - 日期（type=date时）
   * @param {string} options.topicId - 主题ID（type=topic时）
   * @param {string} options.style - 'concise' | 'detailed'
   */
  async generate(options) {
    const { type, date, topicId, style = 'detailed' } = options;
    
    // 1. 获取要摘要的消息
    let messages;
    if (type === 'date') {
      messages = await this.viewer.getMessagesByDate(date, 1, 1000);
    } else if (type === 'topic') {
      messages = await this.viewer.getMessagesByTopic(topicId, 1, 1000);
    }
    
    if (!messages || messages.length === 0) {
      throw new Error('没有可摘要的消息');
    }
    
    // 2. 调用 AI 生成摘要
    const summaryText = await this.callAISummarize(messages, {
      style,
      type,
      date,
      topicId,
    });
    
    // 3. 创建摘要记录
    const summary = {
      id: `sum_${Date.now()}`,
      windowId: this.chat.windowId,
      sessionId: this.chat.sessionId,
      type: 'history',  // 区别于滚动摘要 'rolling'
      level: 0,
      summaryText,
      
      history: {
        dateRange: type === 'date' ? { type: 'day', value: date } : null,
        topicId: type === 'topic' ? topicId : null,
        topicName: type === 'topic' ? this.getTopicName(topicId) : null,
        status: 'draft',  // 草稿状态
        lastEditedAt: null,
        editedCount: 0,
      },
      
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // 4. 保存到数据库
    await this.chat.messageStore.saveSummary(summary);
    
    return summary;
  }
  
  /**
   * 调用 AI 生成摘要
   */
  async callAISummarize(messages, options) {
    const { style, type, date, topicId } = options;
    
    // 构建 prompt
    let prompt = `请为以下对话生成一个${style === 'concise' ? '简洁' : '详细'}的摘要：\n\n`;
    
    // 添加日期/主题信息
    if (type === 'date') {
      prompt += `日期：${date}\n`;
    } else if (type === 'topic') {
      prompt += `主题：${this.getTopicName(topicId)}\n`;
    }
    
    // 添加消息
    prompt += '\n【对话内容】\n';
    for (const msg of messages) {
      const sender = msg.role === 'user' ? '我' : 'AI';
      prompt += `${sender}：${msg.content}\n`;
    }
    
    prompt += '\n请生成摘要：';
    
    // 调用 AI
    const response = await this.chat.callAI({
      prompt,
      maxTokens: style === 'concise' ? 100 : 300,
      temperature: 0.7,
    });
    
    return response.text;
  }
  
  // ========== 编辑摘要 ==========
  
  /**
   * 编辑摘要
   * 
   * @param {string} summaryId
   * @param {string} newText - 新的摘要内容
   */
  async edit(summaryId, newText) {
    const summary = await this.chat.messageStore.getSummary(summaryId);
    
    if (!summary) {
      throw new Error('摘要不存在');
    }
    
    if (summary.type !== 'history') {
      throw new Error('只能编辑历史摘要');
    }
    
    // 更新内容
    summary.summaryText = newText;
    summary.history.lastEditedAt = Date.now();
    summary.history.editedCount = (summary.history.editedCount || 0) + 1;
    summary.updatedAt = Date.now();
    
    // 保存
    await this.chat.messageStore.saveSummary(summary);
    
    return summary;
  }
  
  // ========== 重Roll 摘要 ==========
  
  /**
   * 重新生成摘要
   * 
   * @param {string} summaryId - 要重新生成的摘要ID
   * @param {Object} options - 生成选项
   */
  async reroll(summaryId, options = {}) {
    const oldSummary = await this.chat.messageStore.getSummary(summaryId);
    
    if (!oldSummary) {
      throw new Error('摘要不存在');
    }
    
    // 获取原始消息
    let messages;
    if (oldSummary.history.dateRange) {
      messages = await this.viewer.getMessagesByDate(
        oldSummary.history.dateRange.value, 
        1, 
        1000
      );
    } else if (oldSummary.history.topicId) {
      messages = await this.viewer.getMessagesByTopic(
        oldSummary.history.topicId, 
        1, 
        1000
      );
    }
    
    // 重新生成
    const newText = await this.callAISummarize(messages, {
      style: options.style || 'detailed',
      type: oldSummary.history.dateRange ? 'date' : 'topic',
      date: oldSummary.history.dateRange?.value,
      topicId: oldSummary.history.topicId,
    });
    
    // 更新摘要
    oldSummary.summaryText = newText;
    oldSummary.history.lastEditedAt = Date.now();
    oldSummary.updatedAt = Date.now();
    
    await this.chat.messageStore.saveSummary(oldSummary);
    
    return oldSummary;
  }
  
  // ========== 发布摘要 ==========
  
  /**
   * 发布摘要
   * 
   * 发布后，摘要变为"可注入"状态
   * 用户可以在聊天时选择注入
   * 
   * @param {string} summaryId
   */
  async publish(summaryId) {
    const summary = await this.chat.messageStore.getSummary(summaryId);
    
    if (!summary) {
      throw new Error('摘要不存在');
    }
    
    if (summary.type !== 'history') {
      throw new Error('只能发布历史摘要');
    }
    
    if (summary.history.status === 'published') {
      throw new Error('摘要已经发布过了');
    }
    
    // 更新状态
    summary.history.status = 'published';
    summary.updatedAt = Date.now();
    
    await this.chat.messageStore.saveSummary(summary);
    
    return summary;
  }
  
  // ========== 注入摘要 ==========
  
  /**
   * 获取可注入的摘要列表
   */
  async getInjectableSummaries() {
    return await this.chat.messageStore.getSummaries({
      windowId: this.chat.windowId,
      type: 'history',
      'history.status': 'published',
    });
  }
  
  /**
   * 注入摘要到当前对话
   * 
   * @param {string[]} summaryIds - 要注入的摘要ID列表
   */
  async injectSummaries(summaryIds) {
    const summaries = await Promise.all(
      summaryIds.map(id => this.chat.messageStore.getSummary(id))
    );
    
    // 添加到当前会话的已选摘要
    this.chat.state.selectedHistorySummaries = summaryIds;
    
    // 在 UI 上显示已注入的摘要
    for (const summary of summaries) {
      await this.chat.sendSystemMessage({
        type: 'summary_injected',
        content: `【已注入历史摘要】\n${summary.summaryText}`,
        summaryId: summary.id,
      });
    }
    
    return summaries;
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 获取主题名称
   */
  getTopicName(topicId) {
    const session = this.chat.getSession(this.chat.sessionId);
    const topic = session.topics?.find(t => t.id === topicId);
    return topic?.name || '未命名主题';
  }
}
```

---

（第一部分结束）

---

# 第二部分：表情包系统与消息存储

## 2.1 表情包系统设计

### 2.1.1 设计理念

原 chat.js 的问题：

```
问题：表情包系统混乱
├── 表情包存储：有的存本地，有的存云端
├── 表情包格式：GIF、WebP、静态图混用
├── 表情包分类：没有统一分类
├── 表情包搜索：只支持最近使用
└── 表情包来源：系统表情 + 用户上传
```

**新的设计：统一的表情包系统**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         表情包系统架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    EmojiStore（表情包商店）                          │ │
│  │                                                                      │ │
│  │  数据来源：                                                          │ │
│  │  - 系统表情包（内置）                                                │ │
│  │  - 用户上传的表情包                                                  │ │
│  │  - 订阅的表情包（未来）                                             │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    EmojiPicker（表情选择器）                          │ │
│  │                                                                      │ │
│  │  分类：                                                             │ │
│  │  - 最近使用                                                        │ │
│  │  - 笑脸 & 情感                                                    │ │
│  │  - 人物 & 手势                                                    │ │
│  │  - 动物 & 自然                                                    │ │
│  │  │   - ...                                                        │ │
│  │  - 我的收藏                                                        │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    EmojiMessage（表情消息）                          │ │
│  │                                                                      │ │
│  │  消息结构：                                                        │ │
│  │  {                                                                │ │
│  │    type: 'emoji',                                                 │ │
│  │    emojiId: 'xxx',                                                │ │
│  │    emojiName: '笑哭',                                             │ │
│  │    emojiUrl: 'https://...',                                       │ │
│  │    isAnimated: true,                                              │ │
│  │  }                                                                │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1.2 EmojiStore（表情包商店）

```javascript
// emoji/emoji-store.js
// 表情包商店

/**
 * EmojiStore - 表情包商店
 * 
 * 职责：
 * 1. 管理所有表情包资源
 * 2. 提供表情包分类和搜索
 * 3. 管理用户收藏的表情包
 * 4. 缓存表情包资源
 * 
 * 与原 chat.js 的关系：
 * - 原表情包逻辑 → 迁移到此
 * - 新增分类、搜索、收藏功能
 * 
 * 注意：
 * - 表情包存储在小听启动的系统中
 * - 不复用 chat.js 原来的存储方式
 */
class EmojiStore {
  constructor() {
    // 系统表情包
    this.systemEmojis = this.initSystemEmojis();
    
    // 用户上传的表情包
    this.userEmojis = new Map();  // emojiId → emoji
    
    // 用户收藏的表情包
    this.favorites = new Set();  // emojiId 集合
    
    // 最近使用
    this.recentlyUsed = [];  // emojiId 数组，按使用时间排序
    
    // 缓存
    this.cache = new Map();  // emojiId → Blob/URL
    
    // 加载用户数据
    this.loadUserData();
  }
  
  // ========== 系统表情包初始化 ==========
  
  initSystemEmojis() {
    // 系统表情包使用内置的 Emoji 资源
    // 这里定义分类和映射
    
    return {
      // 分类
      categories: [
        { id: 'recent', name: '最近使用', icon: '🕐' },
        { id: 'smileys', name: '笑脸 & 情感', icon: '😀' },
        { id: 'people', name: '人物 & 手势', icon: '👋' },
        { id: 'animals', name: '动物 & 自然', icon: '🐶' },
        { id: 'food', name: '食物 & 饮料', icon: '🍔' },
        { id: 'activities', name: '活动 & 旅行', icon: '⚽' },
        { id: 'objects', name: '物品', icon: '💡' },
        { id: 'symbols', name: '符号', icon: '❤️' },
        { id: 'favorites', name: '我的收藏', icon: '⭐' },
      ],
      
      // 表情包数据
      emojis: [
        // 笑脸 & 情感
        { id: 'emoji_001', name: '笑哭', category: 'smileys', char: '😂', animated: null },
        { id: 'emoji_002', name: '微笑', category: 'smileys', char: '😊', animated: null },
        { id: 'emoji_003', name: '大笑', category: 'smileys', char: '🤣', animated: null },
        { id: 'emoji_004', name: '爱心', category: 'smileys', char: '❤️', animated: null },
        { id: 'emoji_005', name: '星星眼', category: 'smileys', char: '🤩', animated: null },
        // ... 更多表情
      ],
    };
  }
  
  // ========== 用户数据管理 ==========
  
  async loadUserData() {
    // 从 IndexedDB 加载用户上传的表情包
    const userEmojis = await this.db.getAll('userEmojis');
    for (const emoji of userEmojis) {
      this.userEmojis.set(emoji.id, emoji);
    }
    
    // 加载收藏
    const favorites = await this.db.get('userPrefs', 'emoji_favorites');
    if (favorites) {
      this.favorites = new Set(favorites.emojiIds || []);
    }
    
    // 加载最近使用
    const recentlyUsed = await this.db.get('userPrefs', 'emoji_recently_used');
    if (recentlyUsed) {
      this.recentlyUsed = recentlyUsed.emojiIds || [];
    }
  }
  
  async saveUserData() {
    // 保存收藏
    await this.db.put('userPrefs', {
      key: 'emoji_favorites',
      emojiIds: Array.from(this.favorites),
    });
    
    // 保存最近使用
    await this.db.put('userPrefs', {
      key: 'emoji_recently_used',
      emojiIds: this.recentlyUsed,
    });
  }
  
  // ========== 查询接口 ==========
  
  /**
   * 获取分类下的表情包
   */
  getEmojisByCategory(categoryId) {
    // 系统表情
    const systemEmojis = this.systemEmojis.emojis.filter(e => e.category === categoryId);
    
    // 用户上传的表情
    const userEmojisInCategory = Array.from(this.userEmojis.values())
      .filter(e => e.category === categoryId);
    
    return [...systemEmojis, ...userEmojisInCategory];
  }
  
  /**
   * 获取最近使用的表情包
   */
  getRecentlyUsed(limit = 20) {
    return this.recentlyUsed
      .slice(0, limit)
      .map(id => this.getEmojiById(id))
      .filter(Boolean);
  }
  
  /**
   * 获取收藏的表情包
   */
  getFavorites() {
    return Array.from(this.favorites)
      .map(id => this.getEmojiById(id))
      .filter(Boolean);
  }
  
  /**
   * 根据 ID 获取表情包
   */
  getEmojiById(emojiId) {
    // 先查系统表情
    const system = this.systemEmojis.emojis.find(e => e.id === emojiId);
    if (system) return system;
    
    // 再查用户表情
    return this.userEmojis.get(emojiId);
  }
  
  /**
   * 搜索表情包
   */
  search(keyword) {
    const lower = keyword.toLowerCase();
    
    // 搜索系统表情
    const systemResults = this.systemEmojis.emojis
      .filter(e => e.name.toLowerCase().includes(lower));
    
    // 搜索用户表情
    const userResults = Array.from(this.userEmojis.values())
      .filter(e => e.name.toLowerCase().includes(lower));
    
    return [...systemResults, ...userResults];
  }
  
  // ========== 收藏管理 ==========
  
  /**
   * 添加到收藏
   */
  async addFavorite(emojiId) {
    this.favorites.add(emojiId);
    await this.saveUserData();
  }
  
  /**
   * 从收藏移除
   */
  async removeFavorite(emojiId) {
    this.favorites.delete(emojiId);
    await this.saveUserData();
  }
  
  /**
   * 是否已收藏
   */
  isFavorite(emojiId) {
    return this.favorites.has(emojiId);
  }
  
  // ========== 最近使用 ==========
  
  /**
   * 记录使用
   */
  async recordUsage(emojiId) {
    // 从数组中移除（如果存在）
    const index = this.recentlyUsed.indexOf(emojiId);
    if (index > -1) {
      this.recentlyUsed.splice(index, 1);
    }
    
    // 添加到开头
    this.recentlyUsed.unshift(emojiId);
    
    // 限制长度
    if (this.recentlyUsed.length > 50) {
      this.recentlyUsed = this.recentlyUsed.slice(0, 50);
    }
    
    await this.saveUserData();
  }
  
  // ========== 用户上传 ==========
  
  /**
   * 上传表情包
   * 
   * @param {File} file - 图片文件
   * @param {string} name - 表情包名称
   * @param {string} category - 分类
   */
  async uploadEmoji(file, name, category = 'custom') {
    // 1. 验证文件
    const validTypes = ['image/gif', 'image/webp', 'image/png', 'image/jpeg'];
    if (!validTypes.includes(file.type)) {
      throw new Error('不支持的图片格式');
    }
    
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('图片大小不能超过 2MB');
    }
    
    // 2. 上传到存储
    const emojiId = `emoji_user_${Date.now()}`;
    const emojiUrl = await this.uploadFile(file, emojiId);
    
    // 3. 创建记录
    const emoji = {
      id: emojiId,
      name,
      category,
      url: emojiUrl,
      isAnimated: file.type === 'image/gif',
      createdAt: Date.now(),
    };
    
    // 4. 保存
    this.userEmojis.set(emojiId, emoji);
    await this.db.put('userEmojis', emoji);
    
    return emoji;
  }
  
  /**
   * 上传文件到存储
   */
  async uploadFile(file, id) {
    // 使用小听启动的文件存储系统
    // 这里假设有一个 uploadToStorage 方法
    const url = await window.__storage.upload(file, `emojis/${id}`);
    return url;
  }
  
  /**
   * 删除用户表情包
   */
  async deleteEmoji(emojiId) {
    const emoji = this.userEmojis.get(emojiId);
    if (!emoji) return;
    
    // 从收藏移除
    this.favorites.delete(emojiId);
    
    // 删除记录
    this.userEmojis.delete(emojiId);
    await this.db.delete('userEmojis', emojiId);
    
    // 删除文件
    if (emoji.url) {
      await window.__storage.delete(emoji.url);
    }
  }
}
```

### 2.1.3 EmojiPicker（表情选择器组件）

```javascript
// emoji/emoji-picker.js
// 表情选择器

/**
 * EmojiPicker - 表情选择器
 * 
 * UI 组件，提供表情包选择功能
 * 
 * 与原 chat.js 的关系：
 * - 原表情选择器 → 重构为此
 * - 新增分类 Tab、搜索、收藏功能
 */
class EmojiPicker {
  constructor(options) {
    this.chat = options.chat;
    this.store = options.emojiStore;
    
    // 当前分类
    this.currentCategory = 'recent';
    
    // 搜索关键词
    this.searchKeyword = '';
    
    // 渲染容器
    this.container = options.container;
    
    // 回调
    this.onSelect = options.onSelect || (() => {});
  }
  
  /**
   * 渲染表情选择器
   */
  render() {
    const html = `
      <div class="emoji-picker">
        <!-- 搜索框 -->
        <div class="emoji-search">
          <input type="text" placeholder="搜索表情" v-model="keyword" />
        </div>
        
        <!-- 分类 Tab -->
        <div class="emoji-tabs">
          ${this.renderTabs()}
        </div>
        
        <!-- 表情网格 -->
        <div class="emoji-grid">
          ${this.renderEmojiGrid()}
        </div>
        
        <!-- 底部操作 -->
        <div class="emoji-footer">
          <button @click="showUpload">上传表情</button>
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    this.bindEvents();
  }
  
  /**
   * 渲染分类 Tab
   */
  renderTabs() {
    return this.store.systemEmojis.categories.map(cat => `
      <button 
        class="emoji-tab ${this.currentCategory === cat.id ? 'active' : ''}"
        data-category="${cat.id}"
        title="${cat.name}"
      >
        ${cat.icon}
      </button>
    `).join('');
  }
  
  /**
   * 渲染表情网格
   */
  renderEmojiGrid() {
    let emojis;
    
    if (this.searchKeyword) {
      emojis = this.store.search(this.searchKeyword);
    } else if (this.currentCategory === 'recent') {
      emojis = this.store.getRecentlyUsed();
    } else if (this.currentCategory === 'favorites') {
      emojis = this.store.getFavorites();
    } else {
      emojis = this.store.getEmojisByCategory(this.currentCategory);
    }
    
    if (emojis.length === 0) {
      return '<div class="emoji-empty">暂无表情</div>';
    }
    
    return emojis.map(emoji => `
      <div class="emoji-item" data-emoji-id="${emoji.id}" title="${emoji.name}">
        ${emoji.char || `<img src="${emoji.url}" alt="${emoji.name}" />`}
      </div>
    `).join('');
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // Tab 切换
    this.container.querySelectorAll('.emoji-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentCategory = tab.dataset.category;
        this.renderEmojiGrid();
      });
    });
    
    // 搜索
    const searchInput = this.container.querySelector('.emoji-search input');
    searchInput.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value;
      this.renderEmojiGrid();
    });
    
    // 选择表情
    this.container.querySelectorAll('.emoji-item').forEach(item => {
      item.addEventListener('click', () => {
        const emojiId = item.dataset.emojiId;
        this.selectEmoji(emojiId);
      });
    });
    
    // 长按显示收藏选项
    this.container.querySelectorAll('.emoji-item').forEach(item => {
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const emojiId = item.dataset.emojiId;
        this.showEmojiMenu(emojiId, e);
      });
    });
  }
  
  /**
   * 选择表情
   */
  async selectEmoji(emojiId) {
    const emoji = this.store.getEmojiById(emojiId);
    if (!emoji) return;
    
    // 记录使用
    await this.store.recordUsage(emojiId);
    
    // 触发回调
    this.onSelect(emoji);
  }
  
  /**
   * 显示表情菜单（收藏/删除）
   */
  showEmojiMenu(emojiId, event) {
    const emoji = this.store.getEmojiById(emojiId);
    if (!emoji) return;
    
    // 构建菜单
    const menuItems = [];
    
    // 收藏/取消收藏
    if (this.store.isFavorite(emojiId)) {
      menuItems.push({ label: '取消收藏', action: () => this.store.removeFavorite(emojiId) });
    } else {
      menuItems.push({ label: '添加收藏', action: () => this.store.addFavorite(emojiId) });
    }
    
    // 删除（只有用户表情可以删除）
    if (emojiId.startsWith('emoji_user_')) {
      menuItems.push({ label: '删除', action: () => this.store.deleteEmoji(emojiId) });
    }
    
    // 显示菜单
    // ... (使用框架的菜单组件)
  }
}
```

### 2.1.4 表情包消息处理

```javascript
// emoji/emoji-message.js
// 表情包消息处理

/**
 * EmojiMessage - 表情包消息
 * 
 * 处理表情包消息的发送和渲染
 */
class EmojiMessage {
  /**
   * 发送表情包
   */
  async send(chat, emoji) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: chat.sessionId,
      role: 'user',
      type: 'emoji',
      content: emoji.name,
      timestamp: Date.now(),
      extra: {
        emojiId: emoji.id,
        emojiName: emoji.name,
        emojiUrl: emoji.url || emoji.char,
        isAnimated: emoji.isAnimated || false,
      },
    };
    
    // 保存消息
    await chat.messageStore.add(message);
    
    // 渲染消息
    chat.messageRenderer.renderMessage(message);
    
    // 如果是 AI 会话，生成回复
    if (chat.isAIChat) {
      await chat.generateAIResponse();
    }
    
    return message;
  }
  
  /**
   * 渲染表情包消息
   */
  static render(message, isMine) {
    const { emojiUrl, emojiName, isAnimated } = message.extra;
    
    // 判断是系统表情还是图片
    const content = emojiUrl?.startsWith('http') || emojiUrl?.startsWith('/')
      ? `<img src="${emojiUrl}" alt="${emojiName}" ${isAnimated ? 'class="emoji-animated"' : ''} />`
      : `<span class="emoji-char">${emojiUrl}</span>`;
    
    return `
      <div class="message-bubble ${isMine ? 'mine' : 'theirs'}">
        <div class="message-emoji">
          ${content}
          <span class="emoji-name">${emojiName}</span>
        </div>
        ${this.renderTime(message.timestamp)}
      </div>
    `;
  }
}
```

---

## 2.2 消息存储系统设计

### 2.2.1 设计理念

原 chat.js 的问题：

```
问题：消息存储混乱
├── 消息存储位置：有的存 IndexedDB，有的存 localStorage
├── 消息结构：不统一，缺少必要字段
├── 消息查询：没有索引，查询慢
├── 消息分页：没有做分页
└── 消息同步：没有考虑多端同步
```

**新的设计：统一的消息存储系统**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         消息存储系统                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    ChatMessageStore（消息存储器）                     │ │
│  │                                                                      │ │
│  │  功能：                                                             │ │
│  │  - 统一的消息 CRUD                                                  │ │
│  │  - 自动索引                                                         │ │
│  │  - 分页查询                                                         │ │
│  │  - 全文搜索                                                         │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    IndexedDB Schema                                  │ │
│  │                                                                      │ │
│  │  Store: chatMessages                                                │ │
│  │  - keyPath: 'id'                                                    │ │
│  │  - indexes:                                                        │ │
│  │    - sessionId (会话ID)                                             │ │
│  │    - timestamp (时间)                                                │ │
│  │    - topicId (主题ID，按主题模式)                                    │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2.2 ChatMessageStore（消息存储器）

```javascript
// store/chat-message-store.js
// 消息存储器

/**
 * ChatMessageStore - 消息存储器
 * 
 * 职责：
 * 1. 统一的消息 CRUD
 * 2. 自动索引
 * 3. 分页查询
 * 4. 全文搜索
 * 
 * 与原 chat.js 的关系：
 * - 原消息存储逻辑 → 迁移到此
 * - 统一存储位置（IndexedDB）
 * - 新增索引和分页
 * 
 * 注意：
 * - 使用小听启动的 IndexedDB 引擎
 * - 不复用 chat.js 原来的存储方式
 */
class ChatMessageStore {
  constructor(options) {
    this.db = options.db;  // IndexedDB 实例
    this.sessionId = options.sessionId;
    this.windowId = options.windowId;
  }
  
  // ========== 索引定义 ==========
  
  /**
   * 获取索引定义
   * 
   * 在应用启动时注册到数据库
   */
  static getIndexes() {
    return [
      { name: 'idx_session_timestamp', keyPath: ['sessionId', 'timestamp'] },
      { name: 'idx_session_topic', keyPath: ['sessionId', 'topicId'] },
      { name: 'idx_sender', keyPath: ['sessionId', 'senderId'] },
    ];
  }
  
  // ========== 添加消息 ==========
  
  /**
   * 添加消息
   */
  async add(message) {
    // 补全字段
    const fullMessage = {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: message.sessionId || this.sessionId,
      windowId: message.windowId || this.windowId,
      role: message.role || 'user',
      type: message.type || 'text',
      content: message.content || '',
      timestamp: message.timestamp || Date.now(),
      
      // 扩展字段
      extra: message.extra || {},
      
      // 搜索字段（方便后续扩展）
      searchableContent: message.content?.toLowerCase() || '',
    };
    
    // 验证
    if (!fullMessage.content && fullMessage.type === 'text') {
      throw new Error('消息内容不能为空');
    }
    
    // 保存
    await this.db.put('chatMessages', fullMessage);
    
    return fullMessage;
  }
  
  /**
   * 批量添加消息
   */
  async addBatch(messages) {
    const fullMessages = messages.map(msg => ({
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: msg.sessionId || this.sessionId,
      windowId: msg.windowId || this.windowId,
      role: msg.role || 'user',
      type: msg.type || 'text',
      content: msg.content || '',
      timestamp: msg.timestamp || Date.now(),
      extra: msg.extra || {},
      searchableContent: msg.content?.toLowerCase() || '',
    }));
    
    await this.db.bulkPut('chatMessages', fullMessages);
    
    return fullMessages;
  }
  
  // ========== 查询消息 ==========
  
  /**
   * 获取消息
   */
  async get(messageId) {
    return await this.db.get('chatMessages', messageId);
  }
  
  /**
   * 获取会话的最新消息
   */
  async getLatest(limit = 20) {
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      [this.sessionId]
    );
    
    // 按时间倒序，取最新的 limit 条
    return messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .reverse();
  }
  
  /**
   * 分页查询消息
   * 
   * @param {Object} options
   * @param {string} options.beforeId - 获取此消息之前的消息
   * @param {number} options.limit - 每页数量
   * @param {string} options.topicId - 主题ID（按主题模式）
   */
  async getPage(options = {}) {
    const { beforeId, limit = 20, topicId } = options;
    
    // 构建查询条件
    let messages;
    
    if (topicId) {
      // 按主题查询
      messages = await this.db.getAllFromIndex(
        'chatMessages',
        'idx_session_topic',
        [this.sessionId, topicId]
      );
    } else {
      // 按会话查询
      messages = await this.db.getAllFromIndex(
        'chatMessages',
        'idx_session_timestamp',
        this.sessionId
      );
    }
    
    // 按时间排序
    messages.sort((a, b) => a.timestamp - b.timestamp);
    
    // 如果有 beforeId，找到该消息的位置
    if (beforeId) {
      const beforeIndex = messages.findIndex(m => m.id === beforeId);
      if (beforeIndex > -1) {
        messages = messages.slice(Math.max(0, beforeIndex - limit), beforeIndex);
      }
    } else {
      // 取最新的 limit 条
      messages = messages.slice(-limit);
    }
    
    return messages;
  }
  
  /**
   * 获取指定时间范围的消息
   */
  async getByDateRange(startDate, endDate) {
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      this.sessionId
    );
    
    return messages
      .filter(m => m.timestamp >= startDate && m.timestamp <= endDate)
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * 获取指定日期的消息
   */
  async getByDate(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.getByDateRange(startOfDay.getTime(), endOfDay.getTime());
  }
  
  /**
   * 获取指定主题的消息
   */
  async getByTopic(topicId) {
    return await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_topic',
      [this.sessionId, topicId]
    );
  }
  
  /**
   * 获取消息数量
   */
  async getCount() {
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      this.sessionId
    );
    return messages.length;
  }
  
  /**
   * 获取消息数量（按日期）
   */
  async getCountByDate(date) {
    const messages = await this.getByDate(date);
    return messages.length;
  }
  
  // ========== 搜索 ==========
  
  /**
   * 搜索消息
   */
  async search(keyword, options = {}) {
    const { limit = 50 } = options;
    const lowerKeyword = keyword.toLowerCase();
    
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      this.sessionId
    );
    
    return messages
      .filter(m => m.searchableContent.includes(lowerKeyword))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * 获取有消息的日期列表
   */
  async getDatesWithMessages() {
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      this.sessionId
    );
    
    // 提取日期，去重
    const dates = new Set();
    
    for (const msg of messages) {
      const date = new Date(msg.timestamp);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dates.add(dateStr);
    }
    
    return Array.from(dates).sort().reverse();
  }
  
  // ========== 删除 ==========
  
  /**
   * 删除消息
   */
  async delete(messageId) {
    await this.db.delete('chatMessages', messageId);
  }
  
  /**
   * 删除会话的所有消息
   */
  async deleteAll() {
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      this.sessionId
    );
    
    await this.db.bulkDelete('chatMessages', messages.map(m => m.id));
  }
  
  /**
   * 删除指定日期之前的所有消息
   */
  async deleteBefore(date) {
    const beforeTimestamp = new Date(date).getTime();
    
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      this.sessionId
    );
    
    const toDelete = messages
      .filter(m => m.timestamp < beforeTimestamp)
      .map(m => m.id);
    
    await this.db.bulkDelete('chatMessages', toDelete);
    
    return toDelete.length;
  }
  
  // ========== 摘要相关 ==========
  
  /**
   * 获取用于摘要的消息
   * 
   * @param {number} count - 要获取的消息数量
   */
  async getForSummary(count = 10) {
    const messages = await this.db.getAllFromIndex(
      'chatMessages',
      'idx_session_timestamp',
      this.sessionId
    );
    
    // 取最新的 count 条
    return messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-count);
  }
  
  /**
   * 删除已摘要的消息
   * 
   * @param {string[]} messageIds - 要删除的消息ID
   */
  async deleteSummarized(messageIds) {
    await this.db.bulkDelete('chatMessages', messageIds);
  }
}
```

### 2.2.3 ChatSessionStore（会话存储器）

```javascript
// store/chat-session-store.js
// 会话存储器

/**
 * ChatSessionStore - 会话存储器
 * 
 * 职责：
 * 1. 管理会话元数据
 * 2. 管理窗口配置
 * 3. 管理记忆配置
 * 
 * 与原 chat.js 的关系：
 * - 原会话管理逻辑 → 迁移到此
 * - 新增窗口配置和记忆配置
 */
class ChatSessionStore {
  constructor(options) {
    this.db = options.db;
  }
  
  // ========== 会话 CRUD ==========
  
  /**
   * 创建会话
   */
  async create(session) {
    const fullSession = {
      id: session.id || `sess_${Date.now()}`,
      personaId: session.personaId,
      personaName: session.personaName,
      personaAvatar: session.personaAvatar,
      type: session.type || 'private',  // 'private' | 'group'
      mode: session.mode || 'date',    // 'date' | 'topic'
      
      // 窗口 ID
      windowId: session.windowId || `${session.type === 'group' ? 'group' : 'chat'}_${session.mode}_${session.personaId}`,
      
      // 名称
      name: session.name || session.personaName,
      
      // 最后消息
      lastMessage: null,
      lastMessageAt: null,
      
      // 未读数
      unreadCount: 0,
      
      // 创建时间
      createdAt: Date.now(),
      updatedAt: Date.now(),
      
      // 记忆配置
      memoryConfig: {
        // 按日期模式
        dateSummaryFrequency: 'day',
        dateSummaries: {},
        
        // 按主题模式
        topics: [],
        activeTopicId: null,
        
        // 用户选中的历史摘要
        selectedHistorySummaries: [],
      },
      
      // 滚动摘要配置
      rollingConfig: {
        enabled: true,
        threshold: 10,
        style: 'concise',
      },
      
      // AI 行为开关（按日期模式开启，按主题模式关闭）
      aiBehavior: {
        postMoments: session.mode === 'date',
        returnToNook: session.mode === 'date',
        socialActions: session.mode === 'date',
      },
    };
    
    await this.db.put('chatSessions', fullSession);
    
    return fullSession;
  }
  
  /**
   * 获取会话
   */
  async get(sessionId) {
    return await this.db.get('chatSessions', sessionId);
  }
  
  /**
   * 获取会话（按窗口ID）
   */
  async getByWindowId(windowId) {
    const sessions = await this.db.getAll('chatSessions');
    return sessions.find(s => s.windowId === windowId);
  }
  
  /**
   * 更新会话
   */
  async update(sessionId, updates) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    Object.assign(session, updates, {
      updatedAt: Date.now(),
    });
    
    await this.db.put('chatSessions', session);
    
    return session;
  }
  
  /**
   * 删除会话
   */
  async delete(sessionId) {
    // 删除会话本身
    await this.db.delete('chatSessions', sessionId);
    
    // 注意：会话下的消息不会被删除，需要单独处理
  }
  
  /**
   * 获取用户的所有私聊会话
   */
  async getPrivateSessions(personaId = null) {
    const sessions = await this.db.getAll('chatSessions');
    
    let filtered = sessions.filter(s => s.type === 'private');
    
    if (personaId) {
      filtered = filtered.filter(s => s.personaId === personaId);
    }
    
    // 按最后消息时间排序
    return filtered
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }
  
  /**
   * 获取用户的所有群聊会话
   */
  async getGroupSessions() {
    const sessions = await this.db.getAll('chatSessions');
    return sessions
      .filter(s => s.type === 'group')
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }
  
  /**
   * 获取指定人设的所有会话
   */
  async getSessionsByPersona(personaId) {
    const sessions = await this.db.getAll('chatSessions');
    return sessions.filter(s => s.personaId === personaId);
  }
  
  // ========== 窗口管理 ==========
  
  /**
   * 检查人设是否已有某模式的窗口
   */
  async hasWindow(personaId, mode) {
    const sessions = await this.getSessionsByPersona(personaId);
    return sessions.some(s => s.mode === mode);
  }
  
  /**
   * 获取人设的窗口数量
   */
  async getWindowCount(personaId) {
    const sessions = await this.getSessionsByPersona(personaId);
    return sessions.length;
  }
  
  /**
   * 创建按日期模式的窗口
   */
  async createDateWindow(personaId, personaInfo) {
    // 检查是否已有
    if (await this.hasWindow(personaId, 'date')) {
      throw new Error('该人设已有按日期模式的窗口');
    }
    
    return this.create({
      personaId,
      personaName: personaInfo.name,
      personaAvatar: personaInfo.avatar,
      type: 'private',
      mode: 'date',
    });
  }
  
  /**
   * 创建按主题模式的窗口
   */
  async createTopicWindow(personaId, personaInfo) {
    // 检查是否已有
    if (await this.hasWindow(personaId, 'topic')) {
      throw new Error('该人设已有按主题模式的窗口');
    }
    
    // 检查窗口数量（最多2个）
    const count = await this.getWindowCount(personaId);
    if (count >= 2) {
      throw new Error('每个人设最多创建2个窗口');
    }
    
    const session = await this.create({
      personaId,
      personaName: personaInfo.name,
      personaAvatar: personaInfo.avatar,
      type: 'private',
      mode: 'topic',
    });
    
    // 自动创建第一个主题
    await this.addTopic(session.id, '默认主题');
    
    return session;
  }
  
  // ========== 主题管理（按主题模式）==========
  
  /**
   * 添加主题
   */
  async addTopic(sessionId, topicName) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    if (session.mode !== 'topic') {
      throw new Error('只能在按主题模式的会话添加主题');
    }
    
    const topic = {
      id: `topic_${Date.now()}`,
      name: topicName,
      createdAt: Date.now(),
      messageCount: 0,
      isActive: session.memoryConfig.topics.length === 0,  // 第一个主题默认激活
    };
    
    session.memoryConfig.topics.push(topic);
    
    if (topic.isActive) {
      session.memoryConfig.activeTopicId = topic.id;
    }
    
    await this.update(sessionId, { memoryConfig: session.memoryConfig });
    
    return topic;
  }
  
  /**
   * 设置活跃主题
   */
  async setActiveTopic(sessionId, topicId) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    for (const topic of session.memoryConfig.topics) {
      topic.isActive = (topic.id === topicId);
    }
    
    session.memoryConfig.activeTopicId = topicId;
    
    await this.update(sessionId, { memoryConfig: session.memoryConfig });
  }
  
  // ========== 记忆配置 ==========
  
  /**
   * 更新记忆配置
   */
  async updateMemoryConfig(sessionId, config) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    session.memoryConfig = {
      ...session.memoryConfig,
      ...config,
    };
    
    await this.update(sessionId, { memoryConfig: session.memoryConfig });
  }
  
  /**
   * 添加选中的历史摘要
   */
  async addSelectedHistorySummary(sessionId, summaryId) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    const selected = session.memoryConfig.selectedHistorySummaries || [];
    if (!selected.includes(summaryId)) {
      selected.push(summaryId);
      session.memoryConfig.selectedHistorySummaries = selected;
      await this.update(sessionId, { memoryConfig: session.memoryConfig });
    }
  }
  
  /**
   * 移除选中的历史摘要
   */
  async removeSelectedHistorySummary(sessionId, summaryId) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    const selected = session.memoryConfig.selectedHistorySummaries || [];
    const index = selected.indexOf(summaryId);
    if (index > -1) {
      selected.splice(index, 1);
      session.memoryConfig.selectedHistorySummaries = selected;
      await this.update(sessionId, { memoryConfig: session.memoryConfig });
    }
  }
}
```

### 2.2.4 IndexedDB Schema 注册

```javascript
// store/db-schema.js
// IndexedDB Schema 注册

/**
 * 注册聊天相关的 IndexedDB Schema
 * 
 * 在应用启动时调用此函数注册
 */
function registerChatSchemas(db) {
  // chatMessages - 消息表
  db.registerStore({
    name: 'chatMessages',
    keyPath: 'id',
    indexes: [
      { name: 'idx_session_timestamp', keyPath: ['sessionId', 'timestamp'], unique: false },
      { name: 'idx_session_topic', keyPath: ['sessionId', 'topicId'], unique: false },
      { name: 'idx_sender', keyPath: ['sessionId', 'senderId'], unique: false },
    ],
  });
  
  // chatSessions - 会话表
  db.registerStore({
    name: 'chatSessions',
    keyPath: 'id',
    indexes: [
      { name: 'idx_persona', keyPath: 'personaId', unique: false },
      { name: 'idx_type', keyPath: 'type', unique: false },
      { name: 'idx_window', keyPath: 'windowId', unique: false },
    ],
  });
  
  // chatArchives - 存档表
  db.registerStore({
    name: 'chatArchives',
    keyPath: 'id',
    indexes: [
      { name: 'idx_session', keyPath: 'sessionId', unique: false },
      { name: 'idx_created', keyPath: 'createdAt', unique: false },
    ],
  });
  
  // chatSummaries - 摘要表
  db.registerStore({
    name: 'chatSummaries',
    keyPath: 'id',
    indexes: [
      { name: 'idx_window', keyPath: 'windowId', unique: false },
      { name: 'idx_session', keyPath: 'sessionId', unique: false },
      { name: 'idx_type', keyPath: 'type', unique: false },
    ],
  });
  
  // userEmojis - 用户表情包表
  db.registerStore({
    name: 'userEmojis',
    keyPath: 'id',
    indexes: [
      { name: 'idx_category', keyPath: 'category', unique: false },
    ],
  });
  
  // userPrefs - 用户偏好表
  db.registerStore({
    name: 'userPrefs',
    keyPath: 'key',
  });
  
  console.log('Chat DB schemas registered');
}
```

---

（第二部分结束）

---

# 第三部分：Prompt 构建器与摘要引擎

## 3.1 Prompt 构建器设计

### 3.1.1 设计理念

原 chat.js 的问题：

```
问题：Prompt 构建混乱
├── prompt 构建逻辑分散在各个地方
├── 没有统一的 priority 机制
├── 没有 injectionDepth 机制
├── 没有滚动摘要
├── 没有历史摘要注入
└── 每个场景（私聊/群聊/通话/游戏）都是独立写的
```

**新的设计：统一的 Prompt 构建器**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Prompt 构建器架构                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    PromptEngine（Prompt 引擎）                         │ │
│  │                                                                      │ │
│  │  功能：                                                             │ │
│  │  - 统一管理所有 Prompt 来源                                          │ │
│  │  - priority 机制（数字越小越靠前）                                   │ │
│  │  - injectionDepth 机制（数字越小越靠底）                            │ │
│  │  - 自动注入滚动摘要（K）                                            │ │
│  │  - 支持手动注入历史摘要（H）                                        │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    PromptBuilder（Prompt 构建器）                      │ │
│  │                                                                      │ │
│  │  场景：                                                             │ │
│  │  - buildPrivatePrompt() → 私聊                                      │ │
│  │  - buildGroupPrompt() → 群聊                                        │ │
│  │  - buildCallPrompt() → 通话                                        │ │
│  │  - buildGamePrompt() → 游戏                                        │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    PromptSources（Prompt 来源）                         │ │
│  │                                                                      │ │
│  │  来源：                                                             │ │
│  │  - 人设基础 (p=0)                                                  │ │
│  │  - 用户人设 (p=1)                                                  │ │
│  │  - 滚动摘要 K (p=2)                                                 │ │
│  │  - 世界观碎知识 (p=3)                                               │ │
│  │  - 普通 prompt 组 (p=10)                                            │ │
│  │  - 时间窗 prompt (p=15)                                             │ │
│  │  - 兜底 prompt (depth=0)                                           │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1.2 PromptEngine（Prompt 引擎）

```javascript
// prompt/prompt-engine.js
// Prompt 引擎

/**
 * PromptEngine - Prompt 引擎
 * 
 * 职责：
 * 1. 统一管理所有 Prompt 来源
 * 2. 按 priority 和 injectionDepth 排序
 * 3. 构建完整的 system prompt
 * 
 * 与原 chat.js 的关系：
 * - 原 _generateAIResponseCore() 的 prompt 构建 → 迁移到此
 * - 原 buildSmartMemoryPrompt() → 改为滚动摘要
 * - 新增 priority/injectionDepth 机制
 */
class PromptEngine {
  constructor(options) {
    this.chat = options.chat;
    this.db = options.db;
    
    // Prompt 来源注册表
    this.sources = new Map();
    
    // 注册默认来源
    this.registerDefaultSources();
  }
  
  // ========== Prompt 来源注册 ==========
  
  /**
   * 注册默认的 Prompt 来源
   */
  registerDefaultSources() {
    // 人设基础 (priority = 0)
    this.registerSource({
      id: 'persona_base',
      priority: 0,
      type: 'static',
      getText: (ctx) => this.chat.persona?.getPrompt?.() || '',
    });
    
    // 用户人设 (priority = 1)
    this.registerSource({
      id: 'user_persona',
      priority: 1,
      type: 'static',
      getText: (ctx) => this.chat.userPersona?.getPrompt?.() || '',
    });
    
    // 滚动摘要 K (priority = 2)
    this.registerSource({
      id: 'rolling_summary',
      priority: 2,
      type: 'dynamic',
      getText: async (ctx) => {
        const latest = await this.getLatestRollingSummary();
        return latest ? `\n【最近对话摘要】\n${latest.summaryText}` : '';
      },
    });
    
    // 世界观碎知识 (priority = 3)
    this.registerSource({
      id: 'world_knowledge',
      priority: 3,
      type: 'dynamic',
      getText: async (ctx) => {
        const knowledge = await this.chat.worldBridge?.getKnowledge?.() || '';
        return knowledge ? `\n【世界观知识】\n${knowledge}` : '';
      },
    });
    
    // 时间感知 (priority = 5)
    this.registerSource({
      id: 'time_awareness',
      priority: 5,
      type: 'static',
      getText: (ctx) => {
        const now = new Date();
        return `\n【当前时间】${now.toLocaleString('zh-CN')}`;
      },
    });
    
    // 朋友圈上下文 (priority = 10)
    this.registerSource({
      id: 'moments_context',
      priority: 10,
      type: 'dynamic',
      getText: async (ctx) => {
        if (!ctx.includeSocial) return '';
        const moments = await this.chat.momentsBridge?.getRecentPosts?.() || [];
        if (moments.length === 0) return '';
        return `\n【朋友圈动态】\n${moments.map(p => `- ${p.content}`).join('\n')}`;
      },
    });
    
    // 兜底 prompt (injectionDepth = 0)
    this.registerSource({
      id: 'fallback_prompt',
      injectionDepth: 0,
      type: 'dynamic',
      getText: async (ctx) => {
        const fallback = await this.getFallbackPrompt();
        return fallback ? `\n【补充说明】\n${fallback}` : '';
      },
    });
  }
  
  /**
   * 注册 Prompt 来源
   */
  registerSource(source) {
    this.sources.set(source.id, source);
  }
  
  /**
   * 取消注册 Prompt 来源
   */
  unregisterSource(sourceId) {
    this.sources.delete(sourceId);
  }
  
  // ========== 构建 Prompt ==========
  
  /**
   * 构建完整的 system prompt
   */
  async build(options = {}) {
    const ctx = {
      chat: this.chat,
      includeRolling: options.includeRolling !== false,
      includeSocial: options.includeSocial !== false,
      selectedHistorySummaries: options.selectedHistorySummaries || [],
      ...options,
    };
    
    // 1. 收集所有来源
    const parts = [];
    
    for (const source of this.sources.values()) {
      // 检查是否应该包含
      if (source.condition && !source.condition(ctx)) {
        continue;
      }
      
      // 获取文本
      let text;
      if (source.type === 'async') {
        text = await source.getText(ctx);
      } else {
        text = source.getText(ctx);
      }
      
      if (!text) continue;
      
      // 添加到对应位置
      if (source.priority !== undefined) {
        parts.push({
          type: 'priority',
          priority: source.priority,
          text,
          sourceId: source.id,
        });
      } else if (source.injectionDepth !== undefined) {
        parts.push({
          type: 'depth',
          depth: source.injectionDepth,
          text,
          sourceId: source.id,
        });
      }
    }
    
    // 2. 添加历史摘要（用户选中的）
    for (const summaryId of ctx.selectedHistorySummaries) {
      const summary = await this.getHistorySummary(summaryId);
      if (summary) {
        parts.push({
          type: 'priority',
          priority: 2.5,  // 在滚动摘要之后，历史摘要之前
          text: `\n【历史摘要】\n${summary.summaryText}`,
          sourceId: 'history_summary',
        });
      }
    }
    
    // 3. 按 priority 和 injectionDepth 排序
    const priorityParts = parts
      .filter(p => p.type === 'priority')
      .sort((a, b) => a.priority - b.priority);
    
    const depthParts = parts
      .filter(p => p.type === 'depth')
      .sort((a, b) => a.depth - b.depth);
    
    // 4. 拼接
    const priorityText = priorityParts.map(p => p.text).join('\n');
    const depthText = depthParts.map(p => p.text).join('\n');
    
    return priorityText + (depthText ? '\n' + depthText : '');
  }
  
  // ========== 场景化构建 ==========
  
  /**
   * 构建私聊 prompt
   */
  async buildPrivatePrompt(options = {}) {
    return this.build({
      includeRolling: true,
      includeSocial: this.chat.mode === 'date',  // 按日期模式才包含社交
      selectedHistorySummaries: options.selectedHistorySummaries || [],
    });
  }
  
  /**
   * 构建群聊 prompt
   */
  async buildGroupPrompt(options = {}) {
    const { member, includeGroupContext = true } = options;
    
    let prompt = await this.build({
      includeRolling: true,
      includeSocial: true,
      selectedHistorySummaries: options.selectedHistorySummaries || [],
    });
    
    // 添加群聊特有的内容
    if (includeGroupContext) {
      prompt += '\n【群聊上下文】';
      prompt += `\n你当前在群聊"${this.chat.groupName}"中`;
      prompt += `\n群成员：${this.chat.memberNames.join('、')}`;
      
      if (member) {
        prompt += `\n你扮演的角色：${member.name}`;
      }
    }
    
    return prompt;
  }
  
  /**
   * 构建通话 prompt
   */
  async buildCallPrompt(options = {}) {
    const { callType, duration } = options;
    
    let prompt = await this.build({
      includeRolling: false,  // 通话中不过滤
      includeSocial: false,
    });
    
    // 添加通话特有内容
    prompt += '\n【通话状态】';
    prompt += '\n你正在与用户进行通话中';
    prompt += `\n通话类型：${callType === 'video' ? '视频通话' : '语音通话'}`;
    prompt += `\n通话时长：${Math.floor(duration / 60)}分${duration % 60}秒`;
    prompt += '\n请保持对话的自然流畅';
    
    return prompt;
  }
  
  /**
   * 构建游戏 prompt
   */
  async buildGamePrompt(options = {}) {
    const { gameType, gameState } = options;
    
    // 游戏场景不过滤上下文，读取全部
    let prompt = await this.build({
      includeRolling: false,
      includeSocial: false,
      selectedHistorySummaries: [],
    });
    
    // 添加游戏特有的内容
    prompt += '\n【游戏状态】';
    prompt += `\n游戏类型：${gameType}`;
    prompt += `\n游戏阶段：${gameState.phase}`;
    prompt += `\n当前回合：${gameState.currentRound}`;
    
    // 添加游戏规则（根据游戏类型）
    prompt += this.getGameRules(gameType);
    
    return prompt;
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 获取最新的滚动摘要
   */
  async getLatestRollingSummary() {
    const summaries = await this.db.getAllFromIndex(
      'chatSummaries',
      'idx_window',
      this.chat.windowId
    );
    
    return summaries
      .filter(s => s.type === 'rolling')
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }
  
  /**
   * 获取历史摘要
   */
  async getHistorySummary(summaryId) {
    return await this.db.get('chatSummaries', summaryId);
  }
  
  /**
   * 获取兜底 prompt
   */
  async getFallbackPrompt() {
    // 从用户配置的 prompt 组中获取
    const config = await this.db.get('chatSessions', this.chat.sessionId);
    const fallbackId = config?.rollingConfig?.fallbackPromptId;
    
    if (fallbackId) {
      const prompt = await this.db.get('promptGroups', fallbackId);
      return prompt?.content;
    }
    
    return null;
  }
  
  /**
   * 获取游戏规则
   */
  getGameRules(gameType) {
    const rules = {
      werewolf: `\n【狼人杀规则】
1. 游戏分为狼人和村民两个阵营
2. 夜间狼人可以杀人，白天村民讨论并投票放逐
3. 狼人全部死亡则村民胜利，村民全部死亡则狼人胜利
4. 预言家每晚可以查验一个人的身份
5. 女巫有一瓶解药和一瓶毒药
6. 猎人被投票出局时可以开枪带走一人`,

      undercover: `\n【谁是卧底规则】
1. 每个人会得到一个词语，卧底的词语与其他人不同
2. 轮流描述自己的词语，但不能说出那个词
3. 所有人都描述完后投票认为谁是卧底
4. 卧底存活且未被找出则卧底胜利，否则好人胜利
5. 如果大部分人投错，卧底也可以胜利`,

      trivia: `\n【答题规则】
1. 系统会提出问题
2. 你需要根据问题给出答案
3. 回答正确得分，错误不扣分
4. 最终得分最高者获胜`,
    };
    
    return rules[gameType] || '';
  }
}
```

### 3.1.3 摘要生成器（Prompt）

```javascript
// prompt/summary-prompts.js
// 摘要生成 Prompt 模板

/**
 * SummaryPrompts - 摘要生成 Prompt 模板
 * 
 * 用于生成滚动摘要和历史摘要
 */
const SummaryPrompts = {
  /**
   * 滚动摘要 Prompt
   */
  rolling: {
    concise: `请将以下对话压缩成一个简洁的摘要，保留关键信息和对话脉络：

【对话】
{messages}

请生成 50-100 字的摘要：`,

    detailed: `请将以下对话压缩成一个详细摘要，保留关键细节：

【对话】
{messages}

请生成 100-200 字的摘要：`,

    chronological: `请按时间顺序总结以下对话，保留重要事件：

【对话】
{messages}

请生成摘要：`,
  },

  /**
   * 历史摘要 Prompt
   */
  history: {
    day: `请为以下日期的对话生成一个摘要：

日期：{date}
消息数量：{messageCount}

【对话】
{messages}

请生成 100-200 字的摘要，包含：
1. 主要讨论的话题
2. 重要的决定或约定
3. 情感基调`,

    week: `请为以下一周的对话生成一个摘要：

日期范围：{startDate} - {endDate}
消息数量：{messageCount}

【对话】
{messages}

请生成 200-300 字的摘要，包含：
1. 本周的主要话题
2. 重要事件和决定
3. 情感变化
4. 下周可能的方向`,

    month: `请为以下一个月的对话生成一个摘要：

日期范围：{startDate} - {endDate}
消息数量：{messageCount}

【对话】
{messages}

请生成 300-500 字的摘要，包含：
1. 本月的主要事件
2. 重要话题和决定
3. 关系发展
4. 下月展望`,

    topic: `请为以下主题的对话生成一个摘要：

主题：{topicName}
消息数量：{messageCount}

【对话】
{messages}

请生成 150-300 字的摘要，包含：
1. 主题的核心内容
2. 重要进展
3. 情感基调
4. 后续计划`,
  },

  /**
   * 格式化消息为文本
   */
  formatMessages(messages) {
    return messages.map(m => {
      const role = m.role === 'user' ? '用户' : 'AI';
      return `[${role}] ${m.content}`;
    }).join('\n');
  },

  /**
   * 构建滚动摘要 Prompt
   */
  buildRollingPrompt(messages, style = 'concise') {
    const template = this.rolling[style] || this.rolling.concise;
    return template.replace('{messages}', this.formatMessages(messages));
  },

  /**
   * 构建历史摘要 Prompt
   */
  buildHistoryPrompt(options) {
    const { type, date, startDate, endDate, topicName, messageCount, messages } = options;
    
    let template;
    if (type === 'day') {
      template = this.history.day;
      template = template.replace('{date}', date);
    } else if (type === 'week' || type === 'month') {
      template = this.history[type];
      template = template.replace('{startDate}', startDate);
      template = template.replace('{endDate}', endDate);
    } else if (type === 'topic') {
      template = this.history.topic;
      template = template.replace('{topicName}', topicName);
    }
    
    template = template.replace('{messageCount}', messageCount || messages.length);
    template = template.replace('{messages}', this.formatMessages(messages));
    
    return template;
  },
};
```

---

## 3.2 滚动摘要引擎

### 3.2.1 设计理念

原 chat.js 的问题：

```
问题：没有滚动摘要
├── 原 buildSmartMemoryPrompt() 只能读取最后一条消息
├── 没有 K0/K1/K2 摘要链
├── 没有自动压缩机制
└── 历史消息越来越多，上下文越来越长
```

**新的设计：滚动摘要引擎**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         滚动摘要引擎                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  【C 窗口】                              【K 链】                         │
│  ─────────                              ──────                           │
│  [msg1, msg2, ..., msg10]              [K0, K1, K2, ...]               │
│           │                             ↑                                 │
│           │                             │                                 │
│           ▼                             │                                 │
│  C 满了（10条）─────▶ 压缩 ────▶ 生成 K ──▶ C 清空                     │
│                                    │                                      │
│                                    ▼                                      │
│                              保存到数据库                                  │
│                                    │                                      │
│                                    ▼                                      │
│  拼装时：K2 + [msg1, msg2, ...]   ────▶ 发送给 AI                      │
│                                                                          │
│  注意：只取最新的 K，不取所有 K                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2.2 RollingSummaryEngine（滚动摘要引擎）

```javascript
// summary/rolling-summary-engine.js
// 滚动摘要引擎

/**
 * RollingSummaryEngine - 滚动摘要引擎
 * 
 * 职责：
 * 1. 监控 C 窗口的消息数量
 * 2. 当 C 满了时自动生成滚动摘要
 * 3. 管理 K0/K1/K2 摘要链
 * 4. 提供摘要查询接口
 * 
 * 与原 chat.js 的关系：
 * - 原完全没有此功能，全新设计
 */
class RollingSummaryEngine {
  constructor(options) {
    this.chat = options.chat;
    this.db = options.db;
    this.summaryPrompts = options.summaryPrompts || SummaryPrompts;
    
    // 配置
    this.config = {
      threshold: options.threshold || 10,      // C 窗口阈值
      style: options.style || 'concise',      // 摘要风格
      maxChainLength: options.maxChainLength || 5,  // K 链最大长度
    };
    
    // 当前消息计数
    this.currentCount = 0;
    
    // 待摘要的消息
    this.pendingMessages = [];
  }
  
  // ========== 消息处理 ==========
  
  /**
   * 添加消息到 C 窗口
   * 
   * @param {Object} message - 消息对象
   * @returns {boolean} - 是否触发了摘要
   */
  async addMessage(message) {
    // 添加到待摘要队列
    this.pendingMessages.push(message);
    this.currentCount++;
    
    // 检查是否达到阈值
    if (this.currentCount >= this.config.threshold) {
      await this.generateSummary();
      return true;
    }
    
    return false;
  }
  
  /**
   * 批量添加消息
   */
  async addMessages(messages) {
    for (const msg of messages) {
      await this.addMessage(msg);
    }
  }
  
  /**
   * 清空 C 窗口（不生成摘要）
   */
  clearWindow() {
    this.pendingMessages = [];
    this.currentCount = 0;
  }
  
  // ========== 摘要生成 ==========
  
  /**
   * 生成滚动摘要
   * 
   * 当 C 窗口满了时调用此方法
   */
  async generateSummary() {
    if (this.pendingMessages.length === 0) {
      return null;
    }
    
    // 1. 获取待摘要的消息
    const messagesToSummarize = [...this.pendingMessages];
    
    // 2. 清空 C 窗口
    this.clearWindow();
    
    // 3. 获取当前层级
    const currentLevel = await this.getCurrentLevel();
    
    // 4. 构建 Prompt
    const prompt = this.summaryPrompts.buildRollingPrompt(
      messagesToSummarize,
      this.config.style
    );
    
    // 5. 调用 AI 生成摘要
    const summaryText = await this.chat.callAI({
      prompt,
      maxTokens: 200,
      temperature: 0.7,
    });
    
    // 6. 创建摘要记录
    const summary = {
      id: `sum_rolling_${Date.now()}`,
      windowId: this.chat.windowId,
      sessionId: this.chat.sessionId,
      type: 'rolling',
      level: currentLevel,
      
      summaryText,
      
      rolling: {
        sourceMessageIds: messagesToSummarize.map(m => m.id),
        threshold: this.config.threshold,
        style: this.config.style,
        messageCount: messagesToSummarize.length,
      },
      
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // 7. 保存到数据库
    await this.db.put('chatSummaries', summary);
    
    // 8. 删除已摘要的消息
    await this.chat.messageStore.deleteBatch(
      messagesToSummarize.map(m => m.id)
    );
    
    // 9. 如果 K 链太长，合并最早的摘要
    await this.pruneChain();
    
    return summary;
  }
  
  /**
   * 获取当前摘要层级
   */
  async getCurrentLevel() {
    const summaries = await this.getSummaryChain();
    if (summaries.length === 0) {
      return 0;
    }
    
    return summaries.length;
  }
  
  /**
   * 获取 K 链
   */
  async getSummaryChain() {
    const summaries = await this.db.getAllFromIndex(
      'chatSummaries',
      'idx_window',
      this.chat.windowId
    );
    
    return summaries
      .filter(s => s.type === 'rolling')
      .sort((a, b) => a.level - b.level);
  }
  
  /**
   * 获取最新的摘要
   */
  async getLatestSummary() {
    const chain = await this.getSummaryChain();
    return chain[chain.length - 1] || null;
  }
  
  /**
   * 裁剪 K 链
   * 
   * 当 K 链太长时，合并最早的摘要
   */
  async pruneChain() {
    const chain = await this.getSummaryChain();
    
    if (chain.length > this.config.maxChainLength) {
      // 需要合并
      const toMerge = chain.slice(0, chain.length - this.config.maxChainLength);
      const keep = chain.slice(-this.config.maxChainLength);
      
      // 合并摘要内容
      const mergedText = toMerge.map(s => s.summaryText).join('\n\n');
      
      // 删除被合并的摘要
      for (const summary of toMerge) {
        await this.db.delete('chatSummaries', summary.id);
      }
      
      // 更新最高层级的摘要
      const topLevel = keep[0];
      topLevel.summaryText = `[早期摘要]\n${mergedText}\n\n[近期摘要]\n${topLevel.summaryText}`;
      topLevel.level = 0;
      topLevel.updatedAt = Date.now();
      
      // 重新编号
      for (let i = 0; i < keep.length; i++) {
        keep[i].level = i;
        keep[i].updatedAt = Date.now();
        await this.db.put('chatSummaries', keep[i]);
      }
    }
  }
  
  // ========== 摘要注入 ==========
  
  /**
   * 获取要注入到 Prompt 的摘要
   * 
   * 通常只注入最新的 K
   */
  async getInjectableSummaries() {
    const latest = await this.getLatestSummary();
    return latest ? [latest] : [];
  }
  
  /**
   * 构建摘要注入文本
   */
  buildSummaryText(summaries) {
    if (!summaries || summaries.length === 0) {
      return '';
    }
    
    return summaries.map(s => s.summaryText).join('\n\n');
  }
}
```

---

## 3.3 AI 服务设计

### 3.3.1 设计理念

原 chat.js 的问题：

```
问题：AI 调用混乱
├── AI 调用逻辑分散
├── 没有统一的错误处理
├── 没有超时控制
├── 没有重试机制
└── 每个场景（私聊/群聊/游戏）都独立写 AI 调用
```

**新的设计：统一的 AI 服务**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI 服务架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    AIService（AI 服务）                               │ │
│  │                                                                      │ │
│  │  功能：                                                             │ │
│  │  - 统一的 AI 调用接口                                               │ │
│  │  - 自动选择 API 配置                                               │ │
│  │  - 错误处理和重试                                                  │ │
│  │  - 超时控制                                                         │ │
│  │  - 流式输出支持                                                    │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    API 配置                                          │ │
│  │                                                                      │ │
│  │  来源：                                                             │ │
│  │  - 小听启动的 API Key SDK                                          │ │
│  │  - 用户配置的 API                           │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3.2 AIService（AI 服务）

```javascript
// ai/ai-service.js
// AI 服务

/**
 * AIService - AI 服务
 * 
 * 职责：
 * 1. 统一的 AI 调用接口
 * 2. 自动选择 API 配置
 * 3. 错误处理和重试
 * 4. 超时控制
 * 5. 流式输出支持
 * 
 * 与原 chat.js 的关系：
 * - 原 _generateAIResponseCore() / generateGroupMemberResponse() → 迁移到此
 * - 原 API 调用逻辑 → 统一到这里
 */
class AIService {
  constructor(options) {
    this.chat = options.chat;
    this.sdk = options.sdk;  // 小听启动的 SDK
    
    // 配置
    this.config = {
      maxRetries: 3,
      timeout: 60000,  // 60秒
      retryDelay: 1000,  // 1秒
    };
  }
  
  // ========== 核心调用 ==========
  
  /**
   * 调用 AI 生成回复
   * 
   * @param {Object} options
   * @param {string} options.prompt - system prompt
   * @param {Array} options.messages - 历史消息
   * @param {Object} options.config - API 配置
   */
  async call(options) {
    const { prompt, messages, config } = options;
    
    // 1. 获取 API 配置
    const apiConfig = await this.getAPIConfig(config);
    
    // 2. 构建请求
    const requestBody = this.buildRequestBody(prompt, messages, apiConfig);
    
    // 3. 执行请求（带重试）
    let lastError;
    for (let i = 0; i < this.config.maxRetries; i++) {
      try {
        const response = await this.executeRequest(requestBody, apiConfig);
        return response;
      } catch (error) {
        lastError = error;
        
        // 如果是 API 错误且可重试
        if (this.isRetryableError(error) && i < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * (i + 1));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }
  
  /**
   * 流式调用 AI
   */
  async *callStream(options) {
    const { prompt, messages, config } = options;
    
    const apiConfig = await this.getAPIConfig(config);
    const requestBody = this.buildRequestBody(prompt, messages, apiConfig);
    
    // 设置流式参数
    requestBody.stream = true;
    
    const response = await this.executeStreamRequest(requestBody, apiConfig);
    
    // 解析流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // 解析 SSE 格式
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }
  
  // ========== 请求构建 ==========
  
  /**
   * 获取 API 配置
   */
  async getAPIConfig(override) {
    // 优先使用传入的配置
    if (override?.apiKey) {
      return override;
    }
    
    // 从人设获取配置
    if (this.chat.persona?.apiConfigId) {
      const config = await this.sdk.apiKeys.get(this.chat.persona.apiConfigId);
      if (config) return config;
    }
    
    // 从 SDK 获取默认配置
    const sdkConfig = this.sdk.apiKeySdk?.getDefault();
    if (sdkConfig) return sdkConfig;
    
    // 抛出错误
    throw new Error('未配置 AI API');
  }
  
  /**
   * 构建请求体
   */
  buildRequestBody(prompt, messages, config) {
    // 转换消息格式
    const formattedMessages = [
      { role: 'system', content: prompt },
      ...messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];
    
    return {
      model: config.model || 'gpt-4',
      messages: formattedMessages,
      max_tokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.8,
      stream: false,
    };
  }
  
  /**
   * 执行请求
   */
  async executeRequest(body, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new AIError(response.status, errorText);
      }
      
      const data = await response.json();
      
      // 解析响应
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AIError('INVALID_RESPONSE', 'AI 返回内容为空');
      }
      
      // 解析 AI 的动作（如果有）
      const parsed = this.parseActions(content);
      
      return {
        text: parsed.text,
        actions: parsed.actions,
        raw: content,
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new AIError('TIMEOUT', 'AI 响应超时');
      }
      
      throw error;
    }
  }
  
  /**
   * 执行流式请求
   */
  async executeStreamRequest(body, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new AIError(response.status, errorText);
      }
      
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new AIError('TIMEOUT', 'AI 响应超时');
      }
      
      throw error;
    }
  }
  
  // ========== 响应解析 ==========
  
  /**
   * 解析 AI 响应中的动作
   * 
   * AI 可以在回复中包含特殊标记来触发动作
   */
  parseActions(text) {
    // 查找动作标记
    const actionPattern = /<action>([\s\S]*?)<\/action>/g;
    const actions = [];
    let match;
    
    while ((match = actionPattern.exec(text)) !== null) {
      try {
        const action = JSON.parse(match[1]);
        actions.push(action);
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    // 移除动作标记
    const cleanText = text.replace(actionPattern, '').trim();
    
    return {
      text: cleanText,
      actions,
    };
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 判断是否可重试
   */
  isRetryableError(error) {
    if (error instanceof AIError) {
      // 超时、网络错误可以重试
      if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
        return true;
      }
      
      // 服务器错误可以重试
      if (error.code >= 500) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 延迟
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * AIError - AI 错误
 */
class AIError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AIError';
    this.code = code;
  }
}
```

---

## 3.4 回复模式设计

### 3.4.1 设计理念

原 chat.js 的问题：

```
问题：回复模式功能不完善
├── 即时回复模式正常
├── 长按发送模式有问题
├── 延迟回复模式没有完全实现
└── 模式切换时状态管理混乱
```

**新的设计：统一的回复模式管理**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         回复模式系统                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  【即时回复】                    【长按发送】                            │
│  ──────────                      ──────────                               │
│  发送消息 → 立即触发 AI 回复      发送消息 → 不触发 → 长按发送按钮才触发   │
│                                                                          │
│  【延迟回复】                                                            │
│  ──────────                                                           │
│  发送消息 → 累积到队列 → 计时器结束 → 统一发给 AI                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4.2 ReplyModeManager（回复模式管理器）

```javascript
// reply/reply-mode-manager.js
// 回复模式管理器

/**
 * ReplyModeManager - 回复模式管理器
 * 
 * 职责：
 * 1. 管理回复模式
 * 2. 处理即时回复、长按发送、延迟回复
 * 3. 管理延迟队列
 * 
 * 与原 chat.js 的关系：
 * - 原 messageMode 配置 → 迁移到此
 * - 原延迟回复逻辑 → 迁移到此并完善
 */
class ReplyModeManager {
  constructor(options) {
    this.chat = options.chat;
    
    // 当前模式
    this.mode = options.mode || 'instant';  // 'instant' | 'longpress' | 'delayed'
    
    // 延迟回复配置
    this.delayedConfig = {
      baseDelay: options.baseDelay || 30,       // 基础延迟秒数
      randomRange: options.randomRange || 10,   // 随机浮动秒数
      accumulateMessages: [],                     // 待发送的消息队列
      timer: null,                              // 延迟计时器
    };
    
    // 长按发送状态
    this.longpressState = {
      pendingMessages: [],  // 待发送的消息（长按发送）
      isHolding: false,    // 是否正在长按
      holdTimer: null,     // 长按计时器
    };
    
    // 回调
    this.onSend = options.onSend || (() => {});
    this.onAIResponse = options.onAIResponse || (() => {});
  }
  
  // ========== 模式切换 ==========
  
  /**
   * 设置回复模式
   */
  setMode(mode) {
    const oldMode = this.mode;
    this.mode = mode;
    
    // 切换模式时清理状态
    if (oldMode === 'delayed') {
      this.clearDelayedQueue();
    }
    if (oldMode === 'longpress') {
      this.clearLongpressState();
    }
  }
  
  /**
   * 获取当前模式
   */
  getMode() {
    return this.mode;
  }
  
  // ========== 即时回复模式 ==========
  
  /**
   * 发送消息（即时回复模式）
   */
  async sendInstant(content, type = 'text') {
    // 1. 发送消息
    await this.chat.sendMessage(content, type);
    
    // 2. 触发 AI 回复
    await this.onAIResponse();
  }
  
  // ========== 长按发送模式 ==========
  
  /**
   * 添加待发送消息（长按发送模式）
   */
  addPendingMessage(content, type = 'text') {
    if (this.mode !== 'longpress') return;
    
    const message = {
      content,
      type,
      timestamp: Date.now(),
    };
    
    this.longpressState.pendingMessages.push(message);
    
    return message;
  }
  
  /**
   * 开始长按
   */
  startLongpress() {
    if (this.mode !== 'longpress') return;
    if (this.longpressState.pendingMessages.length === 0) return;
    
    this.longpressState.isHolding = true;
    
    // 开始计时
    this.longpressState.holdTimer = setTimeout(() => {
      this.executeLongpressSend();
    }, 500);  // 500ms 触发
  }
  
  /**
   * 取消长按
   */
  cancelLongpress() {
    if (this.longpressState.holdTimer) {
      clearTimeout(this.longpressState.holdTimer);
      this.longpressState.holdTimer = null;
    }
    this.longpressState.isHolding = false;
  }
  
  /**
   * 执行长按发送
   */
  async executeLongpressSend() {
    if (!this.longpressState.isHolding) return;
    
    // 发送所有待发送的消息
    const messages = [...this.longpressState.pendingMessages];
    this.clearLongpressState();
    
    // 逐条发送并触发 AI 回复
    for (const msg of messages) {
      await this.chat.sendMessage(msg.content, msg.type);
    }
    
    // 只在最后触发一次 AI 回复
    if (messages.length > 0) {
      await this.onAIResponse();
    }
  }
  
  /**
   * 清空长按状态
   */
  clearLongpressState() {
    this.longpressState.pendingMessages = [];
    this.cancelLongpress();
  }
  
  // ========== 延迟回复模式 ==========
  
  /**
   * 发送消息（延迟回复模式）
   */
  async sendDelayed(content, type = 'text') {
    if (this.mode !== 'delayed') {
      // 非延迟模式，直接发送
      return this.sendInstant(content, type);
    }
    
    // 1. 添加到延迟队列
    const message = {
      content,
      type,
      timestamp: Date.now(),
    };
    
    this.delayedConfig.accumulateMessages.push(message);
    
    // 2. 发送消息到聊天界面（不触发 AI）
    await this.chat.sendMessage(content, type, { delayMode: true });
    
    // 3. 如果是第一条消息，启动计时器
    if (this.delayedConfig.accumulateMessages.length === 1) {
      this.startDelayedTimer();
    }
    
    return message;
  }
  
  /**
   * 启动延迟计时器
   */
  startDelayedTimer() {
    if (this.delayedConfig.timer) {
      clearTimeout(this.delayedConfig.timer);
    }
    
    // 计算延迟时间
    const delay = this.calculateDelay();
    
    this.delayedConfig.timer = setTimeout(() => {
      this.executeDelayedSend();
    }, delay * 1000);
  }
  
  /**
   * 计算延迟时间
   */
  calculateDelay() {
    const base = this.delayedConfig.baseDelay;
    const range = this.delayedConfig.randomRange;
    const random = (Math.random() * 2 - 1) * range;
    
    return Math.max(1, base + random);
  }
  
  /**
   * 执行延迟发送
   */
  async executeDelayedSend() {
    if (this.delayedConfig.accumulateMessages.length === 0) return;
    
    // 获取所有累积的消息
    const messages = [...this.delayedConfig.accumulateMessages];
    this.clearDelayedQueue();
    
    // 合并消息内容（用换行分隔）
    const combinedContent = messages.map(m => m.content).join('\n');
    
    // 触发 AI 回复
    await this.onAIResponse({
      type: 'delayed',
      messages,
      combinedContent,
    });
  }
  
  /**
   * 清空延迟队列
   */
  clearDelayedQueue() {
    this.delayedConfig.accumulateMessages = [];
    
    if (this.delayedConfig.timer) {
      clearTimeout(this.delayedConfig.timer);
      this.delayedConfig.timer = null;
    }
  }
  
  /**
   * 手动触发延迟发送（不等待计时器）
   */
  async manualTrigger() {
    if (this.mode !== 'delayed') return;
    if (this.delayedConfig.accumulateMessages.length === 0) return;
    
    await this.executeDelayedSend();
  }
  
  /**
   * 获取延迟队列状态
   */
  getDelayedStatus() {
    return {
      mode: this.mode,
      queueLength: this.delayedConfig.accumulateMessages.length,
      nextSendIn: this.delayedConfig.timer 
        ? Math.max(0, this.getRemainingTime() / 1000).toFixed(0) + '秒'
        : null,
    };
  }
  
  /**
   * 获取剩余时间
   */
  getRemainingTime() {
    // 如果有计时器，返回剩余时间
    // 这里简化处理，实际需要记录开始时间
    return 0;
  }
}
```

---

（第三部分结束）

---

# 第四部分：UI 与 CSS 结构

## 4.1 CSS 文件结构

### 4.1.1 文件组织

```
css/
└── chat/                          # 聊天 App 专用 CSS
    ├── _chat-base.css             # ★ 1:1 复原的韩风基础样式
    ├── _chat-private.css          # ★ 1:1 复原的私聊样式
    ├── _chat-group.css            # ★ 1:1 复原的群聊样式
    ├── _chat-call.css             # ★ 1:1 复原的通话样式
    ├── _chat-bubble.css           # 消息气泡组件
    ├── _chat-input.css            # 输入区域组件
    ├── _chat-emoji.css            # 表情包选择器
    ├── _chat-history.css          # 历史记录页
    ├── _chat-summary.css          # 摘要编辑/选择弹窗
    ├── _chat-game.css             # 游戏房间
    └── _chat-responsive.css       # 响应式适配
```

### 4.1.2 复原原则

| 来源 | 处理方式 |
|------|---------|
| 原 chat.js 内联 CSS | **1:1 迁移**到对应的 `_chat-*.css` 文件 |
| 原 chat.js `<style>` 标签 | **1:1 迁移** |
| 复用现有框架组件 | 替换为小听启动的 island 组件样式 |
| 移动到 App 容器 | 用 `.chat-app-container` 作为根类隔离作用域 |

### 4.1.3 必须保留的样式（关键样式清单）

> 真实构建时需要从 chat.js 中**完整复制**以下 CSS 区块，不能改：

- ✅ **配色变量**：`--chat-bg-start`、`--chat-primary`、`--chat-accent` 等所有 CSS 变量
- ✅ **渐变背景**：`linear-gradient(#E8F2FF → #FFF5F7 → #FFFFFF)`
- ✅ **消息气泡**：`#FFE8F0`（用户）、`#E8F2FF`（AI）、圆角、阴影
- ✅ **头像样式**：`border-radius: 16px`、在线指示器
- ✅ **动画**：`chatItemIn`、`typingDot`、`pulse` 关键帧
- ✅ **滚动条**：自定义滚动条样式
- ✅ **输入区**：毛玻璃、圆角、发送按钮渐变

### 4.1.4 必须改动的地方（明确说明）

| 改动点 | 原 chat.js 写法 | 新框架写法 | 为什么改 |
|--------|----------------|-----------|---------|
| **作用域隔离** | 全局选择器 | 统一用 `.chat-app-container` 作为根类 | chat.js 是独立页面，全局样式没问题；现在要整合到小听启动框架，必须隔离避免污染其他 App |
| **图标字体** | 如果用了 iconfont | 改用框架的 `toolkit.icons` 或 SVG | 小听启动有统一的图标库 |
| **模态框** | 自写的 modal | 用 `window.__phoneConfirm` | 框架有标准的确认弹窗 |
| **灵动岛** | 自写的提示 | 用 `toolkit.island.notify` | 框架有统一的灵动岛提示 |
| **Tab 栏** | 自写的顶部 tab | 用框架的 topbar 配置 | 框架统一处理 |
| **页面容器** | 自写的 `.chat-app` | 用 `getBackground()` 方法返回容器背景 | 框架规定 App 必须提供此方法 |

### 4.1.5 关键改动点注释模板

每个改动点都要在 CSS 顶部用注释标明：

```css
/* ============================================
 * chat-app CSS
 * 1:1 复原 chat.js 韩风蓝粉设计
 * 
 * 改动记录：
 * - [2026-08-03] 全局选择器改为 .chat-app-container 前缀（chat.js 是独立页面）
 * - [2026-08-03] 自写 modal 改为 window.__phoneConfirm（框架统一）
 * - [2026-08-03] 自写图标改为 toolkit.icons（框架图标库）
 * ============================================ */
```

### 4.1.6 容器背景与 statusBar

App 容器需要 `getBackground(state)` 方法返回背景 CSS：

```javascript
// main.js
return {
  getBackground(state) {
    return 'linear-gradient(180deg, #E8F2FF 0%, #FFF5F7 50%, #FFFFFF 100%)';
  },
};
```

**这一段是 1:1 复原**——原 chat.js 的背景直接迁移。

---

## 4.2 UI 组件结构

### 4.2.1 文件组织

```
js/apps/chat-app/
├── components/
│   ├── chat-base.js              # 基础组件类（基类）
│   ├── chat-bubble.js            # 消息气泡（复用基类）
│   ├── chat-input.js             # 输入区域
│   ├── chat-toolbar.js           # 工具栏
│   ├── chat-emoji-picker.js      # 表情包选择器
│   ├── chat-image-uploader.js    # 图片上传
│   ├── chat-voice-recorder.js    # 语音录制
│   ├── chat-member-list.js       # 群成员列表
│   ├── chat-game-panel.js        # 游戏面板
│   └── chat-system-message.js    # 系统消息（摘要、游戏等）
```

### 4.2.2 组件复用设计

```
ChatBaseComponent（基础组件）
├── 公共方法：onMount、onUnmount、emit、props
│
├── ChatBubble（消息气泡）
│   ├── render(message, isMine)
│   ├── 根据 message.type 渲染不同样式
│   └── 子类型：text、image、voice、emoji、game、call、summary
│
├── ChatInput（输入区域）
│   ├── 文本输入
│   ├── 表情按钮
│   ├── 图片按钮
│   ├── 语音按钮
│   ├── 长按发送（按模式启用）
│   └── 延迟队列显示
│
└── ChatEmojiPicker（表情选择器）
    ├── 分类 Tab
    ├── 表情网格
    ├── 搜索框
    └── 长按菜单（收藏/删除）
```

### 4.2.3 组件复用策略

| 组件 | 私聊 | 群聊 | 通话 | 复用方式 |
|------|------|------|------|---------|
| ChatBubble | ✅ | ✅ | ✅ | 完全复用 |
| ChatInput | ✅ | ✅ | ❌ | 复用基础组件 |
| ChatEmojiPicker | ✅ | ✅ | ❌ | 完全复用 |
| ChatToolbar | ✅ | ✅ | ❌ | 复用，传不同 props |
| ChatMemberList | ❌ | ✅ | ❌ | 群聊专用 |
| ChatGamePanel | ✅ | ✅ | ❌ | 完全复用 |

---

## 4.3 页面结构

### 4.3.1 页面列表

| Page ID | 用途 | renderMode | 备注 |
|---------|------|-----------|------|
| `messages` | 消息列表 | hybrid | 主入口页 |
| `chat` | 聊天详情 | hybrid + vue | 核心交互页 |
| `history` | 历史记录 | hybrid | 新增功能 |
| `summary-edit` | 摘要编辑弹窗 | template | 新增功能 |
| `summary-select` | 摘要注入选择 | template | 新增功能 |
| `contacts` | 通讯录 | template | 1:1 复原 |
| `moments` | 动态 | template | 1:1 复原 |
| `profile` | 个人 | template | 1:1 复原 |
| `archive` | 聊天存档 | template | 新增功能 |
| `game` | 游戏房间 | hybrid | 1:1 复原 + 重构 |

### 4.3.2 页面文件组织

```
js/apps/chat-app/
├── pages/
│   ├── messages-page.js          # 消息列表（含双窗口入口）
│   ├── chat-page.js              # 聊天详情（核心）
│   ├── history-page.js           # 历史记录
│   ├── summary-edit-modal.js     # 摘要编辑弹窗
│   ├── summary-select-modal.js   # 摘要注入选择
│   ├── contacts-page.js          # 通讯录
│   ├── moments-page.js           # 动态
│   ├── profile-page.js           # 个人
│   ├── archive-page.js           # 存档列表
│   └── game-page.js              # 游戏房间
```

---

（第四部分结束）

---

# 第五部分：跨 App 接口与世界观整合

## 5.1 跨 App 接口设计

### 5.1.1 设计理念

原 chat.js 的问题：

```
问题：跨 App 接口混乱
├── chat.js 自己管理所有数据（朋友圈、微博、日程等）
├── 每个功能都自己写一套逻辑
├── 不复用现有 App 的能力
└── 数据同步困难
```

**新的设计：复用现有 App 的 SDK**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         跨 App 接口架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    ChatApp（聊天 App）                                │ │
│  │                                                                      │ │
│  │  通过 SDK 调用其他 App 的能力，不重复实现：                          │ │
│  │  - 朋友圈：通过 momentsSdk 读写朋友圈                                │ │
│  │  - 日程：通过 scheduleSdk 获取日程                                  │ │
│  │  - 音乐：通过 musicSdk 分享歌曲                                     │ │
│  │  - 人设：通过 personaSdk 获取 AI 信息                                │ │
│  │  - 世界观：通过 worldSdk 获取世界观                                  │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              ▲                                           │
│                              │ SDK 调用                                    │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    小听启动 SDK 体系                                   │ │
│  │                                                                      │ │
│  │  - momentsSdk（朋友圈）                                              │ │
│  │  - scheduleSdk（日程）                                               │ │
│  │  - musicSdk（音乐）                                                 │ │
│  │  - personaSdk（人设）                                                │ │
│  │  - worldSdk（世界观）                                                │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.1.2 接口清单

| 接口 | SDK | 用途 | 触发场景 |
|------|-----|------|---------|
| `persona.getPrompt()` | personaSdk | 获取人设 system prompt | 每次 AI 回复 |
| `persona.getInfo()` | personaSdk | 获取人设基本信息 | 消息列表/聊天页 |
| `world.getKnowledge()` | worldSdk | 获取世界观碎知识 | 每次 AI 回复 |
| `world.getLocations()` | worldSdk | 获取当前位置 | AI 回复中 |
| `moments.createPost()` | momentsSdk | AI 发朋友圈 | 按日期模式 |
| `moments.getRecent()` | momentsSdk | 获取最近朋友圈 | 每次 AI 回复 |
| `moments.getComments()` | momentsSdk | 获取评论 | AI 回复中 |
| `schedule.getToday()` | scheduleSdk | 获取今日日程 | AI 回复中 |
| `schedule.create()` | scheduleSdk | AI 创建日程 | AI 回复中 |
| `music.getNowPlaying()` | musicSdk | 获取当前播放 | AI 回复中 |
| `music.shareSong()` | musicSdk | 分享歌曲卡片 | 聊天中 |
| `diary.getMood()` | diarySdk | 获取心情 | AI 回复中 |

### 5.1.3 接口封装

```javascript
// bridges/chat-bridge.js
// ChatApp 的跨 App 桥接

/**
 * ChatBridge - ChatApp 的跨 App 桥接
 * 
 * 职责：
 * 1. 封装所有跨 App 接口调用
 * 2. 处理接口不存在的情况（App 未安装）
 * 3. 提供统一的接口抽象
 * 
 * 与原 chat.js 的关系：
 * - 原 chat.js 自己实现朋友圈/微博/日程 → 改为调用其他 App 的 SDK
 * - 大幅减少重复实现
 */
class ChatBridge {
  constructor(options) {
    this.chat = options.chat;
    this.sdk = options.sdk;  // 小听启动的主 SDK
  }
  
  // ========== 人设接口 ==========
  
  /**
   * 获取人设
   */
  getPersona(personaId) {
    return this.sdk.personas?.get?.(personaId);
  }
  
  /**
   * 获取人设 Prompt
   */
  getPersonaPrompt(personaId) {
    const persona = this.getPersona(personaId);
    if (!persona) return '';
    
    return persona.getPrompt?.({
      app: 'chat',
      sessionId: this.chat.sessionId,
    }) || persona.prompt || '';
  }
  
  // ========== 世界观接口 ==========
  
  /**
   * 获取世界观碎知识
   */
  async getWorldKnowledge(personaId) {
    const persona = this.getPersona(personaId);
    if (!persona?.worldId) return '';
    
    const world = await this.sdk.worlds?.get?.(persona.worldId);
    if (!world) return '';
    
    return world.knowledge || '';
  }
  
  /**
   * 获取当前位置
   */
  async getCurrentLocation(personaId) {
    const persona = this.getPersona(personaId);
    if (!persona?.currentLocationId) return null;
    
    return await this.sdk.locations?.get?.(persona.currentLocationId);
  }
  
  // ========== 朋友圈接口（按日期模式触发）==========
  
  /**
   * AI 发朋友圈
   */
  async createMomentsPost(personaId, content, options = {}) {
    if (!this.shouldTriggerMoments(personaId)) {
      return null;
    }
    
    if (!this.sdk.moments?.createPost) {
      console.warn('朋友圈 SDK 未提供 createPost 方法');
      return null;
    }
    
    return await this.sdk.moments.createPost({
      authorId: personaId,
      content,
      images: options.images || [],
      fromApp: 'chat',
      ...options,
    });
  }
  
  /**
   * 获取最近朋友圈
   */
  async getRecentMoments(personaId, limit = 10) {
    if (!this.sdk.moments?.getRecent) {
      return [];
    }
    
    return await this.sdk.moments.getRecent({
      authorId: personaId,
      limit,
    });
  }
  
  /**
   * 是否应该触发朋友圈
   * 
   * 按日期模式：✅ 触发
   * 按主题模式：❌ 不触发
   */
  shouldTriggerMoments(personaId) {
    return this.chat.mode === 'date';
  }
  
  // ========== Nook 接口（按日期模式触发）==========
  
  /**
   * AI 更新 Nook 个人主页
   */
  async updateNookTimeline(personaId, content) {
    if (this.chat.mode !== 'date') {
      return null;
    }
    
    if (!this.sdk.nook?.appendTimeline) {
      console.warn('Nook SDK 未提供 appendTimeline 方法');
      return null;
    }
    
    return await this.sdk.nook.appendTimeline({
      personaId,
      content,
      fromApp: 'chat',
    });
  }
  
  // ========== 日程接口 ==========
  
  /**
   * 获取今日日程
   */
  async getTodaySchedule(personaId) {
    if (!this.sdk.schedules?.getToday) {
      return null;
    }
    
    return await this.sdk.schedules.getToday(personaId);
  }
  
  // ========== 音乐接口 ==========
  
  /**
   * 获取当前播放
   */
  async getNowPlaying() {
    if (!this.sdk.music?.getNowPlaying) {
      return null;
    }
    
    return await this.sdk.music.getNowPlaying();
  }
  
  /**
   * 分享歌曲到聊天
   */
  async createSongMessage(song) {
    return {
      type: 'music',
      content: song.name,
      extra: {
        songId: song.id,
        songName: song.name,
        artist: song.artist,
        album: song.album,
        coverUrl: song.coverUrl,
        duration: song.duration,
      },
    };
  }
  
  // ========== 日记/心情接口 ==========
  
  /**
   * 获取今日心情
   */
  async getMood(personaId) {
    if (!this.sdk.diary?.getMood) {
      return null;
    }
    
    return await this.sdk.diary.getMood(personaId);
  }
}
```

### 5.1.4 接口降级策略

如果某个 App 的 SDK 不存在或方法未实现：

```javascript
// 安全的接口调用
async function safeAPICall(apiCall, fallback = null) {
  try {
    const result = await apiCall();
    return result ?? fallback;
  } catch (error) {
    console.warn('接口调用失败:', error);
    return fallback;
  }
}

// 使用示例
const moments = await safeAPICall(
  () => this.sdk.moments?.getRecent?.(personaId),
  []  // 默认空数组
);
```

---

## 5.2 待办/chat跨App接口.md

### 5.2.1 接口文档

需要在 `待办/` 下创建 `chat跨App接口.md`，记录：

```markdown
# ChatApp 跨 App 接口文档

## 给其他 App 提供的接口

### ChatApp 提供的方法

| 方法 | 参数 | 返回值 | 用途 |
|------|------|--------|------|
| `chat.openConversation(personaId, mode)` | 人设ID, 模式 | 无 | 打开指定人设的聊天 |
| `chat.sendMessage(personaId, content)` | 人设ID, 内容 | 消息对象 | 主动发送消息（程序触发） |
| `chat.getRecentMessages(personaId, limit)` | 人设ID, 数量 | 消息数组 | 获取最近消息 |
| `chat.triggerAIResponse(personaId)` | 人设ID | 无 | 触发 AI 回复 |

### ChatApp 监听的事件

| 事件 | 参数 | 触发场景 |
|------|------|---------|
| `chat:message-sent` | { personaId, message } | 发送消息时 |
| `chat:message-received` | { personaId, message } | 收到消息时 |
| `chat:window-opened` | { personaId, mode } | 打开聊天窗口 |
| `chat:window-closed` | { personaId, mode } | 关闭聊天窗口 |

## ChatApp 使用的其他 App 接口

详见上方接口清单（§5.1.2）

## 待对接的接口

| 接口 | 状态 | 备注 |
|------|------|------|
| `moments.createPost()` | 待对接 | 朋友圈 App 完成后 |
| `nook.appendTimeline()` | 待对接 | Nook App 完成后 |
| `schedules.getToday()` | 待对接 | 日程 App 完成后 |
| `music.shareSong()` | 已可用 | 音乐 App 已实现 |
```

---

（第五部分结束）

---

# 第六部分：存档功能

## 6.1 存档系统设计

### 6.1.1 设计理念

原 chat.js 的问题：

```
问题：没有存档系统
├── 用户想要保存特定时间点的聊天状态
├── 用户想要保存游戏房间
├── 用户想要在多个聊天之间切换
└── 想要恢复历史状态
```

**新的设计：完整的存档系统**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         存档系统架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    ArchiveManager（存档管理器）                        │ │
│  │                                                                      │ │
│  │  功能：                                                             │ │
│  │  - 创建存档（快照当前会话）                                         │ │
│  │  - 恢复存档（从快照恢复）                                           │ │
│  │  - 查看存档列表                                                     │ │
│  │  - 删除存档                                                         │ │
│  │  - 导出存档                                                         │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    chatArchives 表                                   │ │
│  │                                                                      │ │
│  │  存储：                                                             │ │
│  │  - 会话元数据                                                       │ │
│  │  - 消息快照                                                         │ │
│  │  - 摘要快照                                                         │ │
│  │  - 游戏状态（如有）                                                  │ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.1.2 ArchiveManager（存档管理器）

```javascript
// archive/archive-manager.js
// 存档管理器

/**
 * ArchiveManager - 存档管理器
 * 
 * 职责：
 * 1. 创建/恢复/查看/删除存档
 * 2. 存档内容快照
 * 3. 存档导出（JSON 格式）
 * 
 * 与原 chat.js 的关系：
 * - 原完全没有此功能，全新设计
 */
class ArchiveManager {
  constructor(options) {
    this.chat = options.chat;
    this.db = options.db;
  }
  
  // ========== 创建存档 ==========
  
  /**
   * 创建存档
   * 
   * @param {Object} options
   * @param {string} options.name - 存档名称
   * @param {string} options.description - 存档描述
   * @param {boolean} options.includeMessages - 是否包含消息（默认 true）
   * @param {boolean} options.includeSummaries - 是否包含摘要（默认 true）
   * @param {boolean} options.includeGame - 是否包含游戏状态（默认 true）
   */
  async create(options = {}) {
    const {
      name = `存档 ${new Date().toLocaleString('zh-CN')}`,
      description = '',
      includeMessages = true,
      includeSummaries = true,
      includeGame = true,
    } = options;
    
    // 1. 收集存档数据
    const archiveData = {
      id: `archive_${Date.now()}`,
      sessionId: this.chat.sessionId,
      windowId: this.chat.windowId,
      name,
      description,
      
      // 会话元数据
      session: await this.chat.sessionStore.get(this.chat.sessionId),
      
      // 消息
      messages: includeMessages 
        ? await this.chat.messageStore.getAll(this.chat.sessionId)
        : [],
      
      // 摘要
      summaries: includeSummaries 
        ? await this.db.getAllFromIndex('chatSummaries', 'idx_session', this.chat.sessionId)
        : [],
      
      // 游戏状态（如果有）
      gameState: includeGame && this.chat.state.activeGame 
        ? await this.serializeGameState(this.chat.state.activeGame)
        : null,
      
      // 元数据
      meta: {
        messageCount: 0,
        summaryCount: 0,
        archivedAt: Date.now(),
        chatType: this.chat.type,
        mode: this.chat.mode,
        version: '1.0',
      },
    };
    
    archiveData.meta.messageCount = archiveData.messages.length;
    archiveData.meta.summaryCount = archiveData.summaries.length;
    
    // 2. 保存到数据库
    await this.db.put('chatArchives', archiveData);
    
    return archiveData;
  }
  
  /**
   * 序列化游戏状态
   */
  async serializeGameState(game) {
    return {
      gameId: game.gameId,
      gameType: game.gameType,
      chatType: game.chatType,
      phase: game.state.phase,
      currentRound: game.state.currentRound,
      players: Array.from(game.state.players.entries()).map(([id, p]) => ({
        id,
        ...p,
      })),
      votes: Array.from(game.state.votes.entries()),
      history: game.state.history,
    };
  }
  
  // ========== 恢复存档 ==========
  
  /**
   * 恢复存档
   * 
   * @param {string} archiveId - 存档 ID
   */
  async restore(archiveId) {
    const archive = await this.get(archiveId);
    if (!archive) {
      throw new Error('存档不存在');
    }
    
    // 1. 确认恢复
    const confirmed = await this.confirmRestore(archive);
    if (!confirmed) return;
    
    // 2. 恢复会话元数据
    await this.db.put('chatSessions', archive.session);
    
    // 3. 恢复消息
    if (archive.messages.length > 0) {
      // 先清空现有消息
      await this.chat.messageStore.deleteAll();
      // 再恢复
      await this.chat.messageStore.addBatch(archive.messages);
    }
    
    // 4. 恢复摘要
    if (archive.summaries.length > 0) {
      await this.db.bulkPut('chatSummaries', archive.summaries);
    }
    
    // 5. 恢复游戏状态
    if (archive.gameState) {
      await this.restoreGameState(archive.gameState);
    }
    
    return archive;
  }
  
  /**
   * 恢复游戏状态
   */
  async restoreGameState(stateData) {
    // 创建游戏实例
    const GameClass = this.getGameClass(stateData.gameType, stateData.chatType);
    
    const game = new GameClass({
      gameId: stateData.gameId,
      gameType: stateData.gameType,
      chatType: stateData.chatType,
      sessionId: this.chat.sessionId,
      participants: stateData.players.map(p => ({
        id: p.id,
        name: p.name,
      })),
      ownerId: this.chat.state.currentUserId,
    });
    
    // 恢复游戏状态
    game.state.phase = stateData.phase;
    game.state.currentRound = stateData.currentRound;
    
    stateData.players.forEach(p => {
      game.state.players.set(p.id, p);
    });
    
    game.state.votes = new Map(stateData.votes);
    game.state.history = stateData.history;
    
    // 设置到当前聊天
    this.chat.state.activeGame = game;
    
    return game;
  }
  
  // ========== 查询存档 ==========
  
  /**
   * 获取存档
   */
  async get(archiveId) {
    return await this.db.get('chatArchives', archiveId);
  }
  
  /**
   * 获取会话的所有存档
   */
  async list(sessionId) {
    const archives = await this.db.getAllFromIndex(
      'chatArchives',
      'idx_session',
      sessionId
    );
    
    return archives.sort((a, b) => b.meta.archivedAt - a.meta.archivedAt);
  }
  
  // ========== 删除存档 ==========
  
  /**
   * 删除存档
   */
  async delete(archiveId) {
    await this.db.delete('chatArchives', archiveId);
  }
  
  // ========== 导出存档 ==========
  
  /**
   * 导出存档为 JSON
   */
  async exportToJSON(archiveId) {
    const archive = await this.get(archiveId);
    if (!archive) {
      throw new Error('存档不存在');
    }
    
    return JSON.stringify(archive, null, 2);
  }
  
  /**
   * 下载存档文件
   */
  async download(archiveId) {
    const json = await this.exportToJSON(archiveId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${archiveId}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 确认恢复
   */
  async confirmRestore(archive) {
    return await window.__phoneConfirm.request({
      title: '恢复存档',
      text: `确定要恢复到「${archive.name}」吗？\n当前所有未保存的聊天记录将被覆盖。`,
      confirmLabel: '恢复',
      danger: true,
    });
  }
}
```

---

## 6.2 游戏系统迁移

### 6.2.1 原 chat.js 的游戏分析

```
原 chat.js 的游戏：
├── werewolf.js（狼人杀）
│   ├── 角色分配逻辑
│   ├── 发言逻辑
│   ├── 投票逻辑
│   ├── 胜利判断
│   └── 状态管理
│
├── undercover.js（谁是卧底）
│   ├── 词语分配
│   ├── 发言逻辑
│   └── 胜利判断
│
└── 问题：
    - 私聊游戏和群聊游戏混在一起
    - 没有抽象出通用逻辑
    - AI 提示词直接写在代码里
    - 没有游戏存档
```

### 6.2.2 迁移策略

| 原 chat.js 内容 | 新位置 | 处理方式 |
|----------------|--------|---------|
| 角色分配逻辑 | `games/base/` | 抽象为通用方法 |
| 发言/投票逻辑 | `games/base/` | 抽象为通用方法 |
| 胜利判断 | `games/base/` | 抽象为通用方法 |
| 游戏 Prompt | `games/shared/prompts/` | 独立文件，方便编辑 |
| 群聊版狼人杀 | `games/group/werewolf-group.js` | 迁移并完善 |
| 私聊版狼人杀 | `games/private/werewolf-private.js` | **新增** |
| 群聊版谁是卧底 | `games/group/undercover-group.js` | 迁移并完善 |
| 私聊版谁是卧底 | `games/private/undercover-private.js` | **新增** |

### 6.2.3 游戏 Prompt 独立化

原 chat.js 的问题：游戏 prompt 写在代码里，难编辑。

新的设计：游戏 prompt 独立到配置文件。

```javascript
// games/shared/prompts/werewolf-prompts.js
// 狼人杀 Prompt 模板

export const WerewolfPrompts = {
  // 主持人 prompt
  host: `你是狼人杀游戏的主持人，公平公正地推进游戏进程。
当前阶段：{phase}
当前回合：{round}

【存活玩家】
{alivePlayers}

【死亡玩家】
{deadPlayers}

请根据当前阶段推进游戏...`,
  
  // 狼人 prompt
  werewolf: `你是狼人，目标是杀光所有好人。
当前夜晚，你需要和其他狼人商量今晚要杀谁。
当前存活玩家：{alivePlayers}

请发言（最多 50 字）：`,
  
  // 村民 prompt
  villager: `你是村民，没有特殊能力。
当前白天，请根据你的判断发言讨论谁是狼人。
当前存活玩家：{alivePlayers}

请发言（最多 50 字）：`,
  
  // 预言家 prompt
  seer: `你是预言家，每晚可以查验一个人的身份。
当前夜晚，请选择要查验的人。
当前存活玩家：{alivePlayers}

请回复一个人名进行查验：`,
  
  // 女巫 prompt
  witch: `你是女巫，有一瓶解药和一瓶毒药。
解药状态：{potionStatus}
毒药状态：{poisonStatus}
今晚死亡的玩家：{deadPlayer}

请选择：
1. 使用解药救人
2. 使用毒药毒人
3. 都不使用`,
};
```

### 6.2.4 游戏存档与恢复

```javascript
// games/base/game-archive.js
// 游戏存档

/**
 * 游戏存档
 * 
 * 存档内容：
 * - 游戏类型/参与者/角色分配
 * - 当前阶段/回合
 * - 玩家状态
 * - 投票历史
 * - 发言历史
 */

class GameArchive {
  /**
   * 序列化游戏状态
   */
  static serialize(game) {
    return {
      gameId: game.gameId,
      gameType: game.gameType,
      chatType: game.chatType,
      phase: game.state.phase,
      currentRound: game.state.currentRound,
      players: this.serializePlayers(game.state.players),
      votes: Array.from(game.state.votes.entries()),
      history: game.state.history,
      archivedAt: Date.now(),
    };
  }
  
  static serializePlayers(playersMap) {
    return Array.from(playersMap.entries()).map(([id, p]) => ({
      id,
      role: p.role,
      roleName: p.roleName,
      team: p.team,
      isAlive: p.isAlive,
      // 角色特有状态
      roleState: this.extractRoleState(p),
    }));
  }
  
  static extractRoleState(player) {
    // 提取角色特有状态
    const state = {};
    if (player.role === 'seer') {
      state.checkedPlayers = player.checkedPlayers;
    }
    if (player.role === 'witch') {
      state.hasPotion = player.hasPotion;
      state.hasPoison = player.hasPoison;
      state.usedPotion = player.usedPotion;
      state.usedPoison = player.usedPoison;
    }
    if (player.role === 'hunter') {
      state.canShoot = player.canShoot;
    }
    return state;
  }
}
```

---

## 6.3 游戏可扩展设计

### 6.3.1 新增游戏类型

未来要新增游戏，只需：

1. **创建游戏类**（继承 `GameCore`）
2. **创建游戏 Prompt**（在 `games/shared/prompts/`）
3. **注册游戏**（在 `games/index.js`）

```javascript
// games/index.js
// 游戏注册入口

import { WerewolfPrivate, WerewolfGroup } from './private/werewolf-private.js';
import { WerewolfGroup as WerewolfGroupGame } from './group/werewolf-group.js';
// ... 其他游戏

export const GameRegistry = {
  private: {
    werewolf: WerewolfPrivate,
    undercover: UndercoverPrivate,
    trivia: TriviaPrivate,
  },
  group: {
    werewolf: WerewolfGroupGame,
    undercover: UndercoverGroupGame,
    trivia: TriviaGroupGame,
  },
};

/**
 * 注册自定义游戏
 */
export function registerGame(gameType, chatType, gameClass) {
  if (!GameRegistry[chatType]) {
    GameRegistry[chatType] = {};
  }
  GameRegistry[chatType][gameType] = gameClass;
}
```

### 6.3.2 游戏 UI 集成

游戏消息渲染：

```javascript
// games/base/game-message-renderer.js
// 游戏消息渲染器

class GameMessageRenderer {
  /**
   * 渲染游戏消息
   */
  static render(message) {
    const { type, gameType, content, data } = message.extra;
    
    switch (type) {
      case 'game_start':
        return this.renderGameStart(gameType, content);
      case 'phase_change':
        return this.renderPhaseChange(content, data);
      case 'elimination':
        return this.renderElimination(content);
      case 'game_end':
        return this.renderGameEnd(content, data);
      case 'night_result':
        return this.renderNightResult(content);
      default:
        return this.renderGenericGameMessage(content);
    }
  }
  
  static renderGameStart(gameType, content) {
    return `
      <div class="game-message game-start">
        <div class="game-icon">${this.getGameIcon(gameType)}</div>
        <div class="game-content">${escapeHtml(content)}</div>
      </div>
    `;
  }
  
  static getGameIcon(gameType) {
    const icons = {
      werewolf: '🐺',
      undercover: '🕵️',
      trivia: '❓',
    };
    return icons[gameType] || '🎮';
  }
}
```

---

（第六部分结束）

---

# 第七部分：完整文件结构与实施顺序

## 7.1 完整文件结构

```
js/apps/chat-app/
├── main.js                       # App 主入口（注册）
├── services/                     # 服务层
│   ├── chat-core.js             # 聊天核心（基类）
│   ├── chat-private.js          # 私聊模型
│   ├── chat-group.js            # 群聊模型
│   ├── chat-call.js             # 通话模型
│   │
│   ├── store/                    # 存储层
│   │   ├── db-schema.js         # IndexedDB Schema 注册
│   │   ├── chat-message-store.js # 消息存储
│   │   ├── chat-session-store.js # 会话存储
│   │   └── chat-archive-store.js # 存档存储
│   │
│   ├── summary/                  # 摘要系统
│   │   ├── rolling-summary-engine.js  # 滚动摘要引擎
│   │   ├── history-summary-manager.js # 历史摘要管理器
│   │   └── summary-prompts.js   # 摘要 Prompt 模板
│   │
│   ├── prompt/                   # Prompt 构建器
│   │   ├── prompt-engine.js     # Prompt 引擎
│   │   ├── prompt-sources.js    # Prompt 来源管理
│   │   ├── summary-prompts.js   # 摘要 Prompt
│   │   └── game-prompts.js      # 游戏 Prompt
│   │
│   ├── ai/                       # AI 服务
│   │   ├── ai-service.js        # AI 调用服务
│   │   └── ai-error.js          # AI 错误处理
│   │
│   ├── reply/                    # 回复模式
│   │   └── reply-mode-manager.js # 回复模式管理器
│   │
│   ├── emoji/                    # 表情包系统
│   │   ├── emoji-store.js       # 表情包商店
│   │   ├── emoji-picker.js      # 表情包选择器
│   │   └── emoji-message.js     # 表情包消息
│   │
│   ├── history/                  # 历史记录
│   │   ├── history-viewer.js    # 历史查看器
│   │   └── history-summary-manager.js # 历史摘要
│   │
│   ├── archive/                  # 存档
│   │   └── archive-manager.js   # 存档管理器
│   │
│   └── bridges/                  # 跨 App 接口
│       ├── chat-bridge.js       # 跨 App 桥接
│       ├── moments-bridge.js    # 朋友圈桥接
│       ├── nook-bridge.js       # Nook 桥接
│       └── world-bridge.js      # 世界观桥接
│
├── games/                        # 游戏系统
│   ├── base/
│   │   ├── game-core.js         # 游戏基类
│   │   ├── game-state.js        # 游戏状态机
│   │   ├── game-message-renderer.js # 游戏消息渲染
│   │   └── game-manager.js      # 游戏管理器（统一的私聊/群聊）
│   │
│   ├── private/                  # 私聊游戏（1v1）
│   │   ├── werewolf-private.js
│   │   ├── undercover-private.js
│   │   └── trivia-private.js
│   │
│   ├── group/                    # 群聊游戏（多人）
│   │   ├── werewolf-group.js
│   │   ├── undercover-group.js
│   │   └── trivia-group.js
│   │
│   └── shared/
│       ├── prompts/              # 游戏 Prompt
│       │   ├── werewolf-prompts.js
│       │   ├── undercover-prompts.js
│       │   └── trivia-prompts.js
│       └── utils/
│           ├── role-assigner.js
│           └── vote-calculator.js

├── call/                          # 通话功能
│   ├── call-manager.js          # 通话管理器
│   ├── call-channel.js          # 语音/视频通道
│   ├── call-renderer.js         # 通话 UI 渲染
│   └── call-page.js             # 通话页面
│
├── pages/                        # 页面
│   ├── messages-page.js          # 消息列表
│   ├── chat-page.js              # 聊天详情
│   ├── history-page.js           # 历史记录
│   ├── summary-edit-modal.js     # 摘要编辑
│   ├── summary-select-modal.js   # 摘要注入选择
│   ├── contacts-page.js          # 通讯录
│   ├── moments-page.js           # 动态
│   ├── profile-page.js           # 个人
│   ├── archive-page.js           # 存档列表
│   └── game-page.js              # 游戏房间
│
└── components/                   # UI 组件
    ├── chat-base.js              # 基础组件
    ├── chat-bubble.js            # 消息气泡
    ├── chat-input.js             # 输入区域
    ├── chat-toolbar.js           # 工具栏
    ├── chat-emoji-picker.js      # 表情选择器
    ├── chat-image-uploader.js    # 图片上传
    ├── chat-voice-recorder.js    # 语音录制
    ├── chat-member-list.js       # 群成员列表
    ├── chat-game-panel.js        # 游戏面板
    └── chat-system-message.js    # 系统消息

css/chat/                         # 聊天 CSS
├── _chat-base.css                # 基础（1:1 复原）
├── _chat-private.css             # 私聊（1:1 复原）
├── _chat-group.css               # 群聊（1:1 复原）
├── _chat-call.css                # 通话（1:1 复原）
├── _chat-bubble.css              # 消息气泡
├── _chat-input.css               # 输入区域
├── _chat-emoji.css               # 表情包
├── _chat-history.css             # 历史记录
├── _chat-summary.css             # 摘要
├── _chat-game.css                # 游戏
└── _chat-responsive.css          # 响应式
```

---

## 7.2 实施顺序

> **重要**：以下顺序是**构建顺序**，每个 Phase 完成后再进入下一个。

### Phase 1: CSS 1:1 复原（先外观）

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 1.1 | 提取 chat.js 内联 CSS 和 `<style>` 标签 | 无 |
| 1.2 | 创建 `css/chat/_chat-base.css` | 1.1 |
| 1.3 | 创建 `css/chat/_chat-private.css` | 1.2 |
| 1.4 | 创建 `css/chat/_chat-group.css` | 1.3 |
| 1.5 | 创建 `css/chat/_chat-bubble.css` | 1.4 |
| 1.6 | 创建 `css/chat/_chat-input.css` | 1.5 |
| 1.7 | 添加作用域隔离 `.chat-app-container` | 1.2-1.6 |
| 1.8 | 添加改动注释（每个改动点标注） | 1.7 |

### Phase 2: 数据层

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 2.1 | `store/db-schema.js` Schema 注册 | 无 |
| 2.2 | `store/chat-message-store.js` | 2.1 |
| 2.3 | `store/chat-session-store.js` | 2.1 |
| 2.4 | `store/chat-archive-store.js` | 2.1 |

### Phase 3: 核心服务

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 3.1 | `ai/ai-service.js` AI 服务 | 无 |
| 3.2 | `ai/ai-error.js` | 3.1 |
| 3.3 | `prompt/prompt-engine.js` | 3.1 |
| 3.4 | `prompt/prompt-sources.js` | 3.3 |
| 3.5 | `summary/rolling-summary-engine.js` | 2.2, 3.3 |
| 3.6 | `summary/summary-prompts.js` | 3.5 |
| 3.7 | `bridges/chat-bridge.js` | 无 |

### Phase 4: Chat 模型基类

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 4.1 | `services/chat-core.js` 基类 | 3.1-3.7, 2.2-2.4 |
| 4.2 | `services/chat-private.js` | 4.1 |
| 4.3 | `services/chat-group.js` | 4.1 |
| 4.4 | `services/chat-call.js` | 4.1 |

### Phase 5: 回复模式

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 5.1 | `reply/reply-mode-manager.js` | 4.1 |

### Phase 6: 表情包系统

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 6.1 | `emoji/emoji-store.js` | 无 |
| 6.2 | `emoji/emoji-picker.js` | 6.1 |
| 6.3 | `emoji/emoji-message.js` | 6.2 |
| 6.4 | `_chat-emoji.css` | 6.2 |

### Phase 7: 历史记录

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 7.1 | `history/history-viewer.js` | 4.1, 2.2 |
| 7.2 | `summary/history-summary-manager.js` | 7.1 |
| 7.3 | `_chat-history.css` | 7.1 |
| 7.4 | `_chat-summary.css` | 7.2 |

### Phase 8: 存档

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 8.1 | `archive/archive-manager.js` | 4.1, 2.2-2.4 |

### Phase 9: 游戏系统（统一 GameManager）

> 游戏是 Chat 的功能模块，由统一的 GameManager 管理私聊/群聊游戏。

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 9.1 | `games/base/game-core.js` | 无 |
| 9.2 | `games/base/game-state.js` | 9.1 |
| 9.3 | `games/base/game-manager.js`（统一私聊/群聊） | 9.1, 4.1 |
| 9.4 | `games/shared/prompts/werewolf-prompts.js` | 无 |
| 9.5 | `games/private/werewolf-private.js` | 9.1, 9.4 |
| 9.6 | `games/group/werewolf-group.js` | 9.1, 9.4 |
| 9.7 | `games/group/undercover-group.js` | 9.1 |
| 9.8 | `games/shared/prompts/undercover-prompts.js` | 9.7 |
| 9.9 | `games/private/undercover-private.js` | 9.1, 9.8 |
| 9.10 | `games/base/game-message-renderer.js` | 9.1 |

### Phase 9.5: 通话功能（Call - 统一的 CallManager）

> 通话也是 Chat 的功能模块。

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 9.5.1 | `call/call-manager.js`（统一私聊/群聊通话） | 4.1 |
| 9.5.2 | `call/call-channel.js`（语音/视频通道抽象） | 9.5.1 |
| 9.5.3 | `call/call-renderer.js`（通话 UI 渲染） | 9.5.1 |
| 9.5.4 | `call/call-page.js`（通话页面） | 9.5.3 |

### Phase 10: UI 组件

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 10.1 | `components/chat-base.js` | 无 |
| 10.2 | `components/chat-bubble.js` | 10.1 |
| 10.3 | `components/chat-input.js` | 10.1, 6.2 |
| 10.4 | `components/chat-toolbar.js` | 10.1 |
| 10.5 | `components/chat-emoji-picker.js` | 6.2 |
| 10.6 | `components/chat-member-list.js` | 10.1 |

### Phase 11: 页面

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 11.1 | `pages/messages-page.js` | 10.x, 2.3, 4.2 |
| 11.2 | `pages/chat-page.js` | 10.x, 4.1-4.4 |
| 11.3 | `pages/history-page.js` | 7.1, 7.3 |
| 11.4 | `pages/summary-edit-modal.js` | 7.2, 7.4 |
| 11.5 | `pages/summary-select-modal.js` | 7.2, 7.4 |
| 11.6 | `pages/archive-page.js` | 8.1 |
| 11.7 | `pages/game-page.js` | 9.x, 10.x |
| 11.8 | `pages/contacts-page.js` | 10.x |
| 11.9 | `pages/moments-page.js` | 10.x |
| 11.10 | `pages/profile-page.js` | 10.x |

### Phase 12: 注册与集成

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 12.1 | 创建 `main.js` | 11.x |
| 12.2 | 创建 `待办/chat跨App接口.md` | 5.1 |
| 12.3 | 在 `js/apps/index.js` 注册 | 12.1 |
| 12.4 | 测试 | 12.3 |

---

## 7.3 依赖关系图

```
Phase 1 (CSS) ──独立，无依赖
    ↓
Phase 2 (Data) ──独立，无依赖
    ↓
Phase 3 (Services) ──依赖 Phase 2
    ↓
Phase 4 (Models) ──依赖 Phase 2, 3
    ↓
Phase 5 (Reply) ──依赖 Phase 4
    ↓
Phase 6 (Emoji) ──独立
    ↓
Phase 7 (History) ──依赖 Phase 2, 4
    ↓
Phase 8 (Archive) ──依赖 Phase 2, 4
    ↓
Phase 9 (Games) ──依赖 Phase 4
    ↓
Phase 10 (Components) ──依赖 Phase 6
    ↓
Phase 11 (Pages) ──依赖 Phase 2-10
    ↓
Phase 12 (Register) ──依赖 Phase 11
```

---

## 7.4 复用清单

> 构建时必须复用的，不要重写：

| 复用来源 | 用法 |
|---------|------|
| `toolkit.island` | 所有通知都用灵动岛 |
| `toolkit.db` | 数据库操作 |
| `toolkit.icons` | 图标 |
| `toolkit.actions` | action 属性 |
| `toolkit.templates` | 内置模板 |
| `window.__phoneConfirm` | 确认弹窗 |
| `window.__detailRenderTick` | 强制重画 detail 页 |
| 小听启动的 `island-components` | 内部组件 |
| 小听启动的 `escape.js` | XSS 防护 |
| 小听启动的 SDK（persona/world/moments） | 跨 App 接口 |

---

（第七部分结束）

---

# 第八部分：通话/游戏的上下文拼接（核心设计）

> 补充：用户反复强调的关键设计点。

## 8.1 通话期间：双通道消息 + 完整上下文

### 8.1.1 通话期间用户能做什么

```
通话进行中（in-call）：

  ┌────────────────────────────────────────────────────┐
  │  通话界面（通话进行中显示）                          │
  │  - 视频/语音通话画面                                │
  │  - 通话控制（静音/挂断）                            │
  │  - 灵动岛显示通话状态                                │
  └────────────────────────────────────────────────────┘
  
  同一时间，用户可以：
  
  ✅ 在聊天界面发普通消息（双通道）
     - 聊天界面依然在另一个视图（可切换）
     - AI 知道这是「通话中发的消息」
     
  ✅ 在灵动岛发普通消息
     - 灵动岛显示通话状态 + 输入框
     - AI 知道这是「通话中在灵动岛发的消息」
     
  ✅ 切换到其他 App
     - 通话在后台继续
     - 返回 Chat 时通话还在
  
  ❌ 不能在灵动岛触发 widget picker
  ❌ 不能编辑历史摘要（要先结束通话）
```

### 8.1.2 通话期间的 AI 上下文

```javascript
// CallManager.buildContext()
async buildContext() {
  return {
    // ✅ 之前聊天的滚动摘要（K1）
    chatSummary: await this._getLatestSummary(),
    
    // ✅ 通话期间在聊天界面发的消息（完整，不摘要）
    chatMessagesDuringCall: await this._getChatMessagesDuringCall(),
    
    // ✅ 通话期间在灵动岛发的消息（完整，不摘要）
    islandMessagesDuringCall: await this._getIslandMessagesDuringCall(),
    
    // ✅ 通话期间语音转写（如果有）
    callTranscripts: this.state.transcripts,
    
    // 系统指令
    systemInstructions: `你正在与用户通话中...
通话时长：${duration}
对方知道你们正在通话。
你可以根据通话的语气/情绪调整回复。
用户可能在通话中用文字补充内容，请综合理解。`,
  };
}
```

### 8.1.3 通话结束后的处理

```javascript
// CallManager.endCall()
async endCall() {
  // 1. 完整存储通话记录
  const callRecord = {
    id: this.state.callId,
    sessionId: this.chat.sessionId,
    callType: this.state.callType,
    startedAt: this.state.startedAt,
    endedAt: Date.now(),
    duration: this.state.duration,
    
    // 通话期间所有渠道的消息（完整）
    messages: this._collectAllMessages(),
    // 包括：
    // - 通话语音转写
    // - 通话期间在聊天界面发的消息
    // - 通话期间在灵动岛发的消息
    
    status: 'completed',
  };
  
  // 2. 生成通话摘要
  const summary = await this._generateCallSummary();
  callRecord.summary = summary;
  callRecord.summaryId = summary.id;
  
  // 3. 持久化
  await this.db.put('chatCalls', callRecord);
  await this.db.put('chatSummaries', summary);
  
  // 4. 关键：标记这些消息后续不再进上下文
  // 通过摘要覆盖：之前通话期间的完整消息 → 通话摘要
  await this._markMessagesAsArchived();
  
  // 5. 回到 idle
  this.state.isInCall = false;
  this.chat.state.mode = 'idle';
  this.chat.state.activeCall = null;
}
```

### 8.1.4 通话结束后的 AI 上下文

```javascript
// 后续聊天时，Chat.buildContext()
async buildContext() {
  // 1. 取最近 N 个滚动摘要（K 链）
  const summaries = await this._getRecentSummaries(3);
  // 这些摘要里可能包含：
  // - 之前聊天的滚动摘要（type: 'rolling'）
  // - 通话摘要（type: 'call'）
  // - 游戏摘要（type: 'game'）
  
  // 2. 取最近 3 回合的完整消息
  const recentMessages = await this.messageStore.getRecent(this.sessionId, 3);
  
  // 3. 关键：通话期间的完整消息不再进上下文
  // 它们被「通话摘要」替代了
  // 但用户仍可以在「历史记录」里查看完整通话
  
  return {
    systemPrompt: ...,
    summaries,  // 包含聊天摘要 + 通话摘要 + 游戏摘要
    recentMessages,  // 只包含通话结束后发的消息
  };
}
```

**图示：上下文演变**：

```
时间线 ──────────────────────────────────────────────────►

[T0] 50 条普通消息
  上下文：琐碎消息 + 滚动摘要 K1 + 最近 3 回合
  │
  ├─ K1 摘要：之前聊过天气、心情...
  └─ 完整 50 条（存 chatMessages）
  
[T1] 启动通话
  上下文：K1 摘要 + 通话期间所有消息（完整）
  │
  ├─ 通话语音转写（3 分钟对话）
  ├─ 通话期间在聊天界面发的消息（5 条）
  └─ 通话期间在灵动岛发的消息（2 条）
  
  存储：完整通话记录（独立 chatCalls 表）
  
[T2] 通话结束 → 生成通话摘要 S_call
  S_call 内容：通话讨论了 X，决定了 Y
  
[T3] 继续聊天
  上下文：K1 摘要 + S_call 摘要 + 通话后新发的消息
  │
  ├─ K1 摘要（之前聊天）✓
  ├─ S_call 摘要（通话）✓ 新进
  ├─ 通话期间语音转写 ❌ 不再进
  ├─ 通话期间聊天界面消息 ❌ 不再进
  ├─ 通话期间灵动岛消息 ❌ 不再进
  └─ 通话后新消息 ✓ 完整进
```

---

## 8.2 游戏期间：单通道（游戏界面独占）

### 8.2.1 游戏期间用户能做什么

```
游戏进行中（in-game）：

  ┌────────────────────────────────────────────────────┐
  │  游戏界面（游戏进行中显示）                          │
  │  - 游戏规则                                        │
  │  - 当前阶段（白天/黑夜/投票）                       │
  │  - 玩家状态（存活/死亡）                            │
  │  - 游戏内发言区                                    │
  │  - 灵动岛被锁住（不能发普通消息）                   │
  └────────────────────────────────────────────────────┘
  
  同一时间，用户只能：
  
  ✅ 在游戏界面发游戏内消息
     - 按游戏规则的发言
     - AI 作为某个角色回应
     
  ❌ 不能切到普通聊天界面发消息
     - 普通聊天界面被隐藏
     
  ❌ 不能在灵动岛发普通消息
     - 灵动岛被游戏锁住
     - 可以显示游戏状态
     
  ⚠️ 切换到其他 App
     - 第一次切换会提示「游戏进行中，确认离开？」
     - 离开后游戏继续在后台
     - 回到 Chat 时返回游戏界面
```

### 8.2.2 游戏期间的 AI 上下文

```javascript
// GameManager.buildContext()
async buildContext() {
  return {
    // ✅ 之前聊天的滚动摘要（K1）
    chatSummary: await this._getLatestSummary(),
    
    // ✅ 游戏内消息（完整）
    gameMessages: this.gameMessages,
    
    // ✅ 游戏元数据
    gameMeta: {
      gameType: this.state.gameType,        // 'werewolf' | 'undercover' | ...
      currentRound: this.state.currentRound,
      currentPhase: this.state.currentPhase, // 'night' | 'day' | 'vote'
      players: Array.from(this.state.gameInstance.state.players.values()),
    },
    
    // 游戏专用 system prompt
    systemPrompt: this._getGameSystemPrompt(),
  };
}
```

**关键差异**：

```
通话期间 buildContext() vs 游戏期间 buildContext()：

              通话 (Call)              游戏 (Game)
─────────────────────────────────────────────────────
聊天摘要        ✅ K1 摘要              ✅ K1 摘要
通话语音        ✅ 完整                  ❌ 不存在
聊天消息        ✅ 通话期间发的完整       ❌ 不允许发
灵动岛消息      ✅ 通话期间发的完整       ❌ 不允许发
游戏内消息      ❌ 不存在                ✅ 完整
系统指令        通话模式                 游戏模式
─────────────────────────────────────────────────────
```

### 8.2.3 游戏结束后的处理

```javascript
// GameManager.endGame()
async endGame() {
  // 1. 完整存储游戏流程
  const gameRecord = {
    id: this.state.gameId,
    sessionId: this.chat.sessionId,
    gameType: this.state.gameType,        // 'werewolf' | 'undercover'
    chatType: this.state.chatType,        // 'private' | 'group'
    startedAt: this.state.startedAt,
    endedAt: Date.now(),
    duration: Date.now() - this.state.startedAt,
    
    // 玩家和最终角色
    players: Array.from(this.state.gameInstance.state.players.values()),
    winner: this.state.gameInstance.state.winner,
    
    // 完整游戏流程
    rounds: this.state.gameInstance.state.history,
    messages: this.gameMessages,
    
    // 游戏摘要
    summary: null,
    summaryId: null,
    
    status: 'completed',
  };
  
  // 2. 生成游戏摘要
  const summary = await this._generateGameSummary();
  gameRecord.summary = summary;
  gameRecord.summaryId = summary.id;
  
  // 3. 持久化
  await this.db.put('chatGames', gameRecord);
  await this.db.put('chatSummaries', summary);
  
  // 4. 状态回到 idle
  this.state.isInGame = false;
  this.chat.state.mode = 'idle';
  this.chat.state.activeGame = null;
}
```

### 8.2.4 游戏流程的保存和回放

```javascript
// 用户查看完整游戏流程
async viewGameRecord(gameId) {
  const gameRecord = await this.db.get('chatGames', gameId);
  
  // 渲染游戏回放界面
  return this.renderGameReplay(gameRecord);
}

renderGameReplay(record) {
  return {
    type: 'replay',
    title: `${record.gameType} 游戏回放`,
    duration: record.duration,
    winner: record.winner,
    rounds: record.rounds.map(round => ({
      roundNumber: round.round,
      phase: round.phase,
      events: round.events,  // 阶段内的事件
      messages: round.messages,  // 阶段内的发言
    })),
    summary: record.summary,
  };
}
```

---

## 8.3 摘要的统一管理

### 8.3.1 摘要类型

```javascript
// chatSummaries 表中的 type 字段
const SummaryTypes = {
  ROLLING: 'rolling',        // 滚动摘要（普通聊天的）
  CALL: 'call',              // 通话摘要
  GAME: 'game',              // 游戏摘要
  MANUAL: 'manual',          // 用户手动摘要
  HISTORY: 'history',        // 历史摘要（更早的）
};
```

### 8.3.2 摘要进入上下文的规则

```javascript
// PromptEngine.buildContext()
async buildContext() {
  // 1. 取最近 N 个摘要（按 type 过滤）
  const summaries = await this.db.getAllFromIndex(
    'chatSummaries',
    'idx_session',
    this.sessionId
  );
  
  // 2. 按优先级排序
  // 滚动摘要：最新 1-3 个
  // 通话摘要：最近 1-2 个
  // 游戏摘要：最近 1-2 个
  // 历史摘要：手动触发
  
  const recentRolling = summaries
    .filter(s => s.type === 'rolling')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  
  const recentCalls = summaries
    .filter(s => s.type === 'call')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 2);
  
  const recentGames = summaries
    .filter(s => s.type === 'game')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 2);
  
  // 3. 合并
  const allSummaries = [
    ...recentRolling,
    ...recentCalls,
    ...recentGames,
  ].sort((a, b) => a.createdAt - b.createdAt);
  
  // 4. 拼接成 Prompt
  return {
    systemPrompt: '...',
    summaries: allSummaries.map(s => this._formatSummary(s)),
    recentMessages: ...,
  };
}
```

**摘要拼接示意**：

```
[系统提示]
你正在和小A 聊天。你的性格是...

[历史摘要 1]
- K1（滚动）：你们之前聊过天气、心情...

[历史摘要 2]
- S_call（通话）：3天前通过电话讨论了下周计划...

[历史摘要 3]
- S_game（游戏）：上周玩过狼人杀，你赢了...

[最近 3 回合]
- 用户：你今天怎么这么晚？
- 小A：在开会
- 用户：辛苦了
```

---

## 8.4 用户编辑摘要

### 8.4.1 用户能编辑摘要吗？

```
✅ 用户可以查看所有摘要
✅ 用户可以编辑摘要内容
✅ 用户可以删除摘要
✅ 用户可以手动触发新摘要生成
❌ 用户不能改变摘要类型
❌ 用户不能改变摘要之间的顺序（按时间）
```

### 8.4.2 编辑摘要的实现

```javascript
// 用户编辑摘要
async editSummary(summaryId, newContent) {
  const summary = await this.db.get('chatSummaries', summaryId);
  
  // 标记为已编辑
  summary.summary = newContent;
  summary.editedAt = Date.now();
  summary.editedBy = 'user';
  summary.originalSummary = summary.originalSummary || summary.summary;
  
  await this.db.put('chatSummaries', summary);
  
  // 触发 Chat 重新构建上下文
  this.events.emit('context-changed', { reason: 'summary-edited' });
}
```

### 8.4.3 让特定消息重新进入上下文

```
场景：用户想让游戏里的某个精彩瞬间让 AI 记住

操作路径：
1. 进入游戏记录页面
2. 选择某个游戏
3. 找到某条消息/某个回合
4. 「加入聊天上下文」按钮
5. 这条消息会被「注入」到聊天摘要中

实现：
1. 找到对应的摘要（游戏的）
2. 在摘要后面追加「用户特别标记的内容」
3. 标记为「高优先级」
4. 下次构建上下文时，这条会被优先包含
```

```javascript
async injectToContext(sourceId, sourceType, content) {
  // sourceId: 消息 ID 或 摘要 ID
  // sourceType: 'message' | 'summary' | 'game-round' | 'call-segment'
  
  const session = await this.db.get('chatSessions', this.sessionId);
  
  // 创建「注入记录」
  const injection = {
    id: `injection_${Date.now()}`,
    sessionId: this.sessionId,
    sourceId,
    sourceType,
    content,
    injectedAt: Date.now(),
    injectedBy: 'user',
    priority: 'high',
  };
  
  await this.db.put('chatContextInjections', injection);
  
  // 通知 Chat 重建上下文
  this.events.emit('context-changed', { reason: 'user-injection' });
}
```

---

## 8.5 完整上下文演变示例

```
时间线：
──────────────────────────────────────────────────────────────────

[T0] 用户跟小A 聊了 50 条普通消息
  上下文：
    - System Prompt
    - K1 摘要（之前聊的）
    - 最近 3 回合
  存储：
    - chatMessages: 50 条
    - chatSummaries: K1
    
──────────────────────────────────────────────────────────────────

[T1] 小A 打来电话（5 分钟）
  通话期间上下文：
    - System Prompt (带通话状态)
    - K1 摘要
    - 通话期间在聊天界面发的 5 条消息
    - 通话期间在灵动岛发的 2 条消息
    - 通话语音转写
  通话期间存储：
    - chatMessages: 通话期间发的 5 条（带 duringCall 标记）
    - chatMessages: 通话期间在灵动岛发的 2 条
    - chatCalls: 完整通话记录
    
──────────────────────────────────────────────────────────────────

[T2] 通话结束 → 生成 S_call 摘要
  摘要内容：「通过电话讨论了周末计划，决定周六一起去爬山」
  
  存储：
    - chatSummaries: S_call
    - chatCalls.status = 'completed'
    - chatCalls.summary = S_call
    
──────────────────────────────────────────────────────────────────

[T3] 继续聊了 10 条
  上下文：
    - System Prompt
    - K1 摘要（之前聊的）
    - S_call 摘要（通话）✨ 新
    - 最近 3 回合（通话后的）
  存储：
    - chatMessages: 通话后 10 条
    - chatSummaries: K1, S_call
    
──────────────────────────────────────────────────────────────────

[T4] 启动狼人杀游戏（5 分钟）
  游戏期间上下文：
    - System Prompt (带游戏状态)
    - K1 摘要
    - S_call 摘要
    - 游戏内消息（完整）
  游戏期间存储：
    - chatGameMessages: 游戏内消息
    - chatGames: 完整游戏流程（持续中）
    
  ⚠️ 普通聊天界面被隐藏
  ⚠️ 灵动岛被锁
  ⚠️ 不能切到其他 App 直接发普通消息
    
──────────────────────────────────────────────────────────────────

[T5] 游戏结束 → 生成 S_game 摘要
  摘要内容：「玩了一局狼人杀，AI 赢了，主要靠投票阶段分析」
  
  存储：
    - chatSummaries: S_game
    - chatGames.status = 'completed'
    - chatGames.summary = S_game
    
──────────────────────────────────────────────────────────────────

[T6] 继续聊天
  最终上下文：
    - System Prompt
    - K1 摘要（之前聊的）
    - S_call 摘要（通话）✨ 
    - S_game 摘要（游戏）✨
    - 最近 3 回合
  
  不在上下文：
    - 通话期间的完整消息（被 S_call 替代）
    - 游戏内消息（被 S_game 替代）
    
  用户可以查看：
    - 完整通话记录（chatCalls 表）
    - 完整游戏流程（chatGames 表）
    - 用户可以编辑这些摘要
    - 用户可以手动让某些消息重新进上下文
    
──────────────────────────────────────────────────────────────────
```

---

## 8.6 关键设计总结

### 8.6.1 Chat App 的三状态

```
Chat 的 mode 字段：
  - 'idle'     普通聊天
  - 'in-call'  通话中（聊天界面可用，灵动岛可用）
  - 'in-game'  游戏中（聊天界面锁，灵动岛锁）
```

### 8.6.2 三个核心 Manager

```
Chat 实例持有三个核心 Manager：
  1. ChatCore（基础）- 消息存储、上下文构建、摘要生成
  2. CallManager（通话）- 通话状态、语音通道、通话摘要
  3. GameManager（游戏）- 游戏状态、游戏规则、游戏摘要

ChatCore 永远存在
CallManager / GameManager 可以为空
```

### 8.6.3 摘要的拼接

```
聊天上下文 = 
  滚动摘要 K1, K2, K3 + 
  通话摘要 + 
  游戏摘要 + 
  最近 3 回合

按时间顺序拼接，最近的事件权重更高。
用户可以编辑摘要、注入内容。
```

### 8.6.4 完整记录的可访问性

```
用户可以查看：
  - 完整聊天消息
  - 完整通话记录
  - 完整游戏流程
  - 所有摘要
  - 可以编辑、删除、重新生成

用户不能：
  - 把完整记录自动加入上下文（只能编辑摘要来影响）
```

---

# 第九部分：跨 App SDK 暴露

> 聊天记录和摘要可能被其他 App 调用（设置、Persona、朋友圈、人设主页等）。
> 必须通过统一的 SDK 暴露出去。

## 9.1 为什么需要跨 App SDK

```
场景示例：

1. 设置 App - 人设主页 → 空间模块
   需要调用：今天跟小A 聊了什么话题 → 用来生成空间布局

2. 设置 App - Persona 模块
   需要调用：用户跟 AI 的对话风格 → 用来调整 AI 性格

3. 朋友圈 App
   需要调用：AI 在聊天里说了什么 → 用来生成朋友圈文案

4. 人设主页 - AI 日程生成
   需要调用：用户最近的聊天主题 → 用来推测用户兴趣
```

**关键约束**：

```
- 其他 App 不能直接访问 Chat App 的内部 store
- 其他 App 只能通过 SDK 拿到「安全的数据」
- SDK 要控制访问粒度（谁能读 / 谁能写）
- SDK 要脱敏（敏感信息不暴露）
```

## 9.2 SDK 分层设计

```
┌────────────────────────────────────────────────────────────┐
│              Chat SDK（对外暴露）                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 1: Read-Only SDK（所有 App 可读）             │  │
│  │                                                      │  │
│  │  - chat.session.list()              所有会话          │  │
│  │  - chat.session.get(id)             单个会话          │  │
│  │  - chat.session.getSummary(id)      会话摘要          │  │
│  │  - chat.session.getRecentMessages() 最近消息          │  │
│  │  - chat.summary.list()              所有摘要          │  │
│  │  - chat.summary.get(id)             单个摘要          │  │
│  │  - chat.call.list()                 通话记录          │  │
│  │  - chat.call.getSummary(callId)     通话摘要          │  │
│  │  - chat.game.list()                 游戏记录          │  │
│  │  - chat.game.getSummary(gameId)     游戏摘要          │  │
│  │  - chat.search(query)               全文搜索          │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 2: Authenticated SDK（需授权）                 │  │
│  │                                                      │  │
│  │  - chat.summary.edit(id, content)   编辑摘要          │  │
│  │  - chat.summary.inject(...)         注入内容          │  │
│  │  - chat.context.buildForAI(...)     构建 AI 上下文     │  │
│  │  - chat.session.export(id)          导出会话          │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 3: Private SDK（仅内部使用）                   │  │
│  │                                                      │  │
│  │  - chat.internal.*  所有内部 API                      │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 9.3 Chat SDK 实现

```javascript
// sdk/chat-sdk.js
// 聊天 App 对外 SDK

import { myDb } from '@/js/db/index.js';
import { escapeHtml } from '@/src/core/escape.js';

/**
 * ChatSDK - 聊天 App 的对外 SDK
 * 
 * 设计原则：
 * 1. 只暴露安全的数据访问接口
 * 2. 内部数据脱敏（敏感字段不返回）
 * 3. 异步优先（避免阻塞）
 * 4. 错误处理友好
 */
class ChatSDK {
  constructor() {
    this._db = myDb;
    this._initialized = false;
    this._permissionCache = new Map();
    
    // 暴露三个层级的 API
    this.read = this.read.bind(this);
    this.write = this.write.bind(this);
    this.internal = this._internal.bind(this);
  }
  
  // ============================================================
  // Layer 1: Read-Only API
  // ============================================================
  
  /**
   * 列出所有会话
   * 
   * @param {Object} options
   * @param {string} options.type - 'private' | 'group' | null（全部）
   * @param {number} options.limit - 限制数量
   * @param {string} options.orderBy - 'recent' | 'active' | 'created'
   * @returns {Promise<Array<SessionInfo>>}
   */
  async read_listSessions(options = {}) {
    const { type, limit = 50, orderBy = 'recent' } = options;
    
    let sessions = await this._db.getAll('chatSessions');
    
    // 按类型过滤
    if (type) {
      sessions = sessions.filter(s => s.type === type);
    }
    
    // 排序
    if (orderBy === 'recent') {
      sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    } else if (orderBy === 'created') {
      sessions.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // 限制数量
    sessions = sessions.slice(0, limit);
    
    // 脱敏：移除敏感字段
    return sessions.map(s => this._sanitizeSession(s));
  }
  
  /**
   * 获取单个会话信息
   */
  async read_getSession(sessionId) {
    const session = await this._db.get('chatSessions', sessionId);
    return session ? this._sanitizeSession(session) : null;
  }
  
  /**
   * 获取会话的摘要
   * 
   * @param {string} sessionId
   * @param {Object} options
   * @param {number} options.limit - 摘要数量
   * @param {string[]} options.types - 摘要类型过滤
   */
  async read_getSessionSummary(sessionId, options = {}) {
    const { limit = 3, types } = options;
    
    let summaries = await this._db.getAllFromIndex(
      'chatSummaries',
      'idx_session',
      sessionId
    );
    
    // 按类型过滤
    if (types && types.length) {
      summaries = summaries.filter(s => types.includes(s.type));
    }
    
    // 按时间倒序
    summaries.sort((a, b) => b.createdAt - a.createdAt);
    
    // 限制数量
    summaries = summaries.slice(0, limit);
    
    return summaries.map(s => this._sanitizeSummary(s));
  }
  
  /**
   * 获取会话最近的消息
   * 
   * @param {string} sessionId
   * @param {number} limit - 消息数量
   */
  async read_getRecentMessages(sessionId, limit = 20) {
    const messages = await this._db.getAllFromIndex(
      'chatMessages',
      'idx_session',
      sessionId
    );
    
    // 按时间倒序
    messages.sort((a, b) => b.createdAt - a.createdAt);
    
    // 限制
    const recent = messages.slice(0, limit).reverse();
    
    return recent.map(m => this._sanitizeMessage(m));
  }
  
  /**
   * 列出所有摘要
   */
  async read_listSummaries(options = {}) {
    const { sessionId, type, limit = 50 } = options;
    
    let summaries = await this._db.getAll('chatSummaries');
    
    if (sessionId) {
      summaries = summaries.filter(s => s.sessionId === sessionId);
    }
    
    if (type) {
      summaries = summaries.filter(s => s.type === type);
    }
    
    summaries.sort((a, b) => b.createdAt - a.createdAt);
    summaries = summaries.slice(0, limit);
    
    return summaries.map(s => this._sanitizeSummary(s));
  }
  
  /**
   * 获取单个摘要
   */
  async read_getSummary(summaryId) {
    const summary = await this._db.get('chatSummaries', summaryId);
    return summary ? this._sanitizeSummary(summary) : null;
  }
  
  /**
   * 列出所有通话记录
   */
  async read_listCalls(options = {}) {
    const { sessionId, limit = 20 } = options;
    
    let calls = await this._db.getAll('chatCalls');
    
    if (sessionId) {
      calls = calls.filter(c => c.sessionId === sessionId);
    }
    
    calls.sort((a, b) => b.startedAt - a.startedAt);
    calls = calls.slice(0, limit);
    
    return calls.map(c => this._sanitizeCall(c));
  }
  
  /**
   * 获取通话摘要
   */
  async read_getCallSummary(callId) {
    const call = await this._db.get('chatCalls', callId);
    if (!call) return null;
    
    return {
      id: call.id,
      sessionId: call.sessionId,
      callType: call.callType,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      duration: call.duration,
      summary: call.summary,
      summaryId: call.summaryId,
    };
  }
  
  /**
   * 列出所有游戏记录
   */
  async read_listGames(options = {}) {
    const { sessionId, gameType, limit = 20 } = options;
    
    let games = await this._db.getAll('chatGames');
    
    if (sessionId) {
      games = games.filter(g => g.sessionId === sessionId);
    }
    
    if (gameType) {
      games = games.filter(g => g.gameType === gameType);
    }
    
    games.sort((a, b) => b.startedAt - a.startedAt);
    games = games.slice(0, limit);
    
    return games.map(g => this._sanitizeGame(g));
  }
  
  /**
   * 获取游戏摘要
   */
  async read_getGameSummary(gameId) {
    const game = await this._db.get('chatGames', gameId);
    if (!game) return null;
    
    return {
      id: game.id,
      sessionId: game.sessionId,
      gameType: game.gameType,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      duration: game.duration,
      summary: game.summary,
      summaryId: game.summaryId,
    };
  }
  
  /**
   * 全文搜索
   * 
   * @param {Object} query
   * @param {string} query.keyword - 关键词
   * @param {string[]} query.types - 搜索类型 'message' | 'summary' | 'call' | 'game'
   */
  async read_search(query) {
    const { keyword, types = ['message', 'summary'] } = query;
    
    if (!keyword) return [];
    
    const results = [];
    
    // 搜索消息
    if (types.includes('message')) {
      const messages = await this._db.getAll('chatMessages');
      const matched = messages.filter(m => 
        m.content && m.content.includes(keyword)
      );
      results.push(...matched.slice(0, 20).map(m => ({
        type: 'message',
        id: m.id,
        sessionId: m.sessionId,
        content: this._sanitizeMessage(m),
        score: this._calcScore(m, keyword),
      })));
    }
    
    // 搜索摘要
    if (types.includes('summary')) {
      const summaries = await this._db.getAll('chatSummaries');
      const matched = summaries.filter(s => 
        s.summary && s.summary.includes(keyword)
      );
      results.push(...matched.slice(0, 10).map(s => ({
        type: 'summary',
        id: s.id,
        sessionId: s.sessionId,
        content: this._sanitizeSummary(s),
        score: this._calcScore(s, keyword),
      })));
    }
    
    return results.sort((a, b) => b.score - a.score);
  }
  
  // ============================================================
  // Layer 2: Authenticated API
  // ============================================================
  
  /**
   * 编辑摘要（需授权）
   */
  async write_editSummary(summaryId, newContent, options = {}) {
    await this._checkPermission('write:summary', options);
    
    const summary = await this._db.get('chatSummaries', summaryId);
    if (!summary) throw new Error('摘要不存在');
    
    summary.summary = newContent;
    summary.editedAt = Date.now();
    summary.editedBy = options.appId || 'unknown';
    summary.originalSummary = summary.originalSummary || summary.summary;
    
    await this._db.put('chatSummaries', summary);
    
    // 通知 Chat 重建上下文
    this._emitContextChanged(summary.sessionId, 'summary-edited');
    
    return summary;
  }
  
  /**
   * 注入内容到上下文（需授权）
   */
  async write_injectContext(injectionData, options = {}) {
    await this._checkPermission('write:injection', options);
    
    const { sessionId, sourceId, sourceType, content } = injectionData;
    
    const injection = {
      id: `injection_${Date.now()}`,
      sessionId,
      sourceId,
      sourceType,
      content,
      injectedAt: Date.now(),
      injectedBy: options.appId || 'unknown',
      priority: 'high',
    };
    
    await this._db.put('chatContextInjections', injection);
    
    this._emitContextChanged(sessionId, 'user-injection');
    
    return injection;
  }
  
  /**
   * 构建 AI 上下文（供其他 App 调用）
   * 
   * 用于：其他 App 想让 AI 知道「用户最近的聊天情况」
   */
  async write_buildContextForAI(sessionId, options = {}) {
    await this._checkPermission('write:context', options);
    
    const { maxTokens = 4000 } = options;
    
    // 调用内部的 ChatCore.buildContext
    const chatCore = await this._getChatCore(sessionId);
    return await chatCore.buildContextForAI({ maxTokens });
  }
  
  /**
   * 导出会话（需授权）
   */
  async write_exportSession(sessionId, options = {}) {
    await this._checkPermission('write:export', options);
    
    const session = await this._db.get('chatSessions', sessionId);
    const messages = await this._db.getAllFromIndex(
      'chatMessages',
      'idx_session',
      sessionId
    );
    const summaries = await this._db.getAllFromIndex(
      'chatSummaries',
      'idx_session',
      sessionId
    );
    
    return {
      session,
      messages,
      summaries,
      exportedAt: Date.now(),
      format: options.format || 'json',
    };
  }
  
  // ============================================================
  // Private API（仅内部）
  // ============================================================
  
  _internal() {
    // 内部 API 不暴露
    throw new Error('内部 API 不可访问');
  }
  
  // ============================================================
  // 工具方法
  // ============================================================
  
  _sanitizeSession(session) {
    return {
      id: session.id,
      type: session.type,
      name: session.name,
      participants: session.participants,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      messageCount: session.messageCount,
      // 不返回：内部状态、用户标记等敏感字段
    };
  }
  
  _sanitizeMessage(message) {
    return {
      id: message.id,
      sessionId: message.sessionId,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
      // 标记字段
      duringCall: !!message.duringCall,
      duringGame: !!message.duringGame,
      // 不返回：原始 IndexedDB 引用
    };
  }
  
  _sanitizeSummary(summary) {
    return {
      id: summary.id,
      sessionId: summary.sessionId,
      type: summary.type,
      summary: summary.summary,
      createdAt: summary.createdAt,
      editedAt: summary.editedAt,
      // 不返回：原始全文、生成 prompt
    };
  }
  
  _sanitizeCall(call) {
    return {
      id: call.id,
      sessionId: call.sessionId,
      callType: call.callType,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      duration: call.duration,
      // 不返回：完整消息内容（仅返回摘要）
      summary: call.summary,
    };
  }
  
  _sanitizeGame(game) {
    return {
      id: game.id,
      sessionId: game.sessionId,
      gameType: game.gameType,
      chatType: game.chatType,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      duration: game.duration,
      winner: game.winner,
      // 不返回：完整流程（仅返回摘要）
      summary: game.summary,
    };
  }
  
  _calcScore(item, keyword) {
    if (!item || !keyword) return 0;
    const text = JSON.stringify(item).toLowerCase();
    const kw = keyword.toLowerCase();
    
    let score = 0;
    const occurrences = (text.match(new RegExp(kw, 'g')) || []).length;
    score += occurrences * 10;
    
    // 时间越近分数越高
    const age = Date.now() - (item.createdAt || 0);
    score += Math.max(0, 100 - age / (1000 * 60 * 60 * 24));  // 每天减 1 分
    
    return score;
  }
  
  async _checkPermission(action, options) {
    // 简化的权限检查
    const appId = options.appId || 'unknown';
    
    // 白名单
    const allowedApps = [
      'settings', 'persona', 'moments', 'homepage',
      'prompt-survey', 'appstore',
    ];
    
    if (!allowedApps.includes(appId)) {
      throw new Error(`App ${appId} 无权限执行 ${action}`);
    }
    
    // 缓存
    const key = `${appId}:${action}`;
    if (!this._permissionCache.has(key)) {
      this._permissionCache.set(key, true);
    }
  }
  
  _emitContextChanged(sessionId, reason) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat:context-changed', {
        detail: { sessionId, reason },
      }));
    }
  }
  
  async _getChatCore(sessionId) {
    // 内部获取 ChatCore 实例
    if (!window.__chatCores) {
      window.__chatCores = new Map();
    }
    if (!window.__chatCores.has(sessionId)) {
      // 创建 ChatCore 实例
      const ChatCore = await import('../core/chat-core.js');
      window.__chatCores.set(sessionId, new ChatCore.default({ sessionId }));
    }
    return window.__chatCores.get(sessionId);
  }
}

// 单例
const chatSDK = new ChatSDK();

// 挂载到全局
if (typeof window !== 'undefined') {
  window.__chatSdk = chatSDK;
}

export default chatSDK;
export { ChatSDK };
```

## 9.4 SDK 注册到全局

```javascript
// src/index.js 或 index.html
import chatSDK from '@/js/apps/chat-app/sdk/chat-sdk.js';

// 挂载到全局，所有 App 可访问
window.__chatSdk = chatSDK;

// 同时挂载到 framework 的工具包系统
// 这样其他 App 可以通过 toolkit.chatSdk 访问
```

```javascript
// 在其他 App 中使用
// js/apps/setting/persona/main.js

export default function createPersonaApp() {
  return {
    id: 'persona',
    name: '人设',
    // ...
    methods: {
      async loadChatContext() {
        // 通过 SDK 读取聊天摘要
        const sessions = await window.__chatSdk.read_listSessions({
          type: 'private',
          limit: 5,
        });
        
        const summaries = await window.__chatSdk.read_getSessionSummary(
          sessions[0]?.id,
          { limit: 3 }
        );
        
        return { sessions, summaries };
      },
      
      async adjustPersonaFromChats() {
        const { sessions, summaries } = await this.loadChatContext();
        
        // 用聊天摘要调整 AI 人设
        const prompt = `基于以下聊天摘要，调整 AI 人设：
${summaries.map(s => s.summary).join('\n')}
`;
        
        const newPersona = await this.sdk.ai.chat(prompt);
        // ...
      },
    },
  };
}
```

## 9.5 跨 App 调用示例

### 9.5.1 朋友圈 App 调用聊天摘要

```javascript
// js/apps/moments/methods.js

async generatePostFromChat(chatSessionId) {
  // 1. 读取最近聊天
  const summaries = await window.__chatSdk.read_getSessionSummary(chatSessionId, {
    limit: 2,
    types: ['rolling', 'call', 'game'],
  });
  
  // 2. 读取最近消息
  const recent = await window.__chatSdk.read_getRecentMessages(chatSessionId, 10);
  
  // 3. 拼接 prompt
  const prompt = `根据以下聊天内容，生成一条朋友圈文案：

最近聊天摘要：
${summaries.map(s => s.summary).join('\n')}

最近消息：
${recent.map(m => `${m.senderName}: ${m.content}`).join('\n')}

要求：自然、有情感、不超过 100 字`;
  
  const post = await this.sdk.ai.chat(prompt);
  return post;
}
```

### 9.5.2 设置 - 空间模块调用聊天主题

```javascript
// js/apps/setting/persona/space-ai.js

async generateSpaceLayout() {
  // 1. 读取最近 7 天的聊天
  const sessions = await window.__chatSdk.read_listSessions({
    limit: 10,
    orderBy: 'recent',
  });
  
  // 2. 提取主题
  const topics = [];
  for (const session of sessions) {
    const summaries = await window.__chatSdk.read_getSessionSummary(session.id, {
      limit: 1,
      types: ['rolling'],  // 只看聊天摘要
    });
    topics.push(...summaries.map(s => s.summary));
  }
  
  // 3. AI 生成空间布局
  const layout = await this.sdk.ai.chat(`
基于用户最近聊天的主题：
${topics.join('\n')}

生成空间布局建议...
`);
  
  return layout;
}
```

### 9.5.3 人设主页调用通话记录

```javascript
// js/apps/persona-home/main.js

async showRecentCalls() {
  // 1. 读取所有通话
  const calls = await window.__chatSdk.read_listCalls({ limit: 10 });
  
  // 2. 读取通话摘要
  const callSummaries = await Promise.all(
    calls.map(c => window.__chatSdk.read_getCallSummary(c.id))
  );
  
  // 3. 渲染到人设主页
  return callSummaries.map(c => ({
    icon: '📞',
    title: c.callType === 'video' ? '视频通话' : '语音通话',
    duration: formatDuration(c.duration),
    summary: c.summary,
    date: new Date(c.startedAt).toLocaleDateString(),
  }));
}
```

## 9.6 SDK 权限管理

```javascript
// sdk/chat-sdk-permission.js

const PERMISSION_MATRIX = {
  // ┌─────────────┬──────────┬──────────┬──────────┬──────────┐
  // │ App         │ Read     │ Edit     │ Inject   │ BuildCtx │
  // ├─────────────┼──────────┼──────────┼──────────┼──────────┤
  // │ settings    │ ✅       │ ✅       │ ✅       │ ✅       │
  // │ persona     │ ✅       │ ✅       │ ✅       │ ✅       │
  // │ moments     │ ✅       │ ❌       │ ❌       │ ✅       │
  // │ homepage    │ ✅       │ ❌       │ ❌       │ ✅       │
  // │ prompt-survey│ ✅      │ ❌       │ ❌       │ ❌       │
  // │ appstore    │ ✅       │ ❌       │ ❌       │ ❌       │
  // │ 其他        │ ❌       │ ❌       │ ❌       │ ❌       │
  // └─────────────┴──────────┴──────────┴──────────┴──────────┘
};

const APP_PERMISSIONS = {
  settings: ['read', 'edit', 'inject', 'buildCtx'],
  persona: ['read', 'edit', 'inject', 'buildCtx'],
  moments: ['read', 'buildCtx'],
  homepage: ['read', 'buildCtx'],
  'prompt-survey': ['read'],
  appstore: ['read'],
};

function checkPermission(appId, action) {
  const perms = APP_PERMISSIONS[appId] || [];
  return perms.includes(action);
}
```

## 9.7 SDK 文档

### 9.7.1 完整 API 列表

```typescript
// types.ts

interface SessionInfo {
  id: string;
  type: 'private' | 'group';
  name: string;
  participants: string[];
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
}

interface MessageInfo {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  createdAt: number;
  duringCall?: boolean;
  duringGame?: boolean;
}

interface SummaryInfo {
  id: string;
  sessionId: string;
  type: 'rolling' | 'call' | 'game' | 'manual' | 'history';
  summary: string;
  createdAt: number;
  editedAt?: number;
}

interface CallInfo {
  id: string;
  sessionId: string;
  callType: 'voice' | 'video';
  startedAt: number;
  endedAt?: number;
  duration?: number;
  summary?: string;
}

interface GameInfo {
  id: string;
  sessionId: string;
  gameType: string;
  chatType: 'private' | 'group';
  startedAt: number;
  endedAt?: number;
  duration?: number;
  winner?: string;
  summary?: string;
}

// API 签名
declare class ChatSDK {
  // === Read APIs ===
  read_listSessions(options?: ListSessionsOptions): Promise<SessionInfo[]>;
  read_getSession(sessionId: string): Promise<SessionInfo | null>;
  read_getSessionSummary(sessionId: string, options?: GetSummaryOptions): Promise<SummaryInfo[]>;
  read_getRecentMessages(sessionId: string, limit?: number): Promise<MessageInfo[]>;
  read_listSummaries(options?: ListSummariesOptions): Promise<SummaryInfo[]>;
  read_getSummary(summaryId: string): Promise<SummaryInfo | null>;
  read_listCalls(options?: ListCallsOptions): Promise<CallInfo[]>;
  read_getCallSummary(callId: string): Promise<CallInfo | null>;
  read_listGames(options?: ListGamesOptions): Promise<GameInfo[]>;
  read_getGameSummary(gameId: string): Promise<GameInfo | null>;
  read_search(query: SearchQuery): Promise<SearchResult[]>;
  
  // === Write APIs ===
  write_editSummary(summaryId: string, content: string, options?: EditOptions): Promise<SummaryInfo>;
  write_injectContext(data: InjectionData, options?: InjectOptions): Promise<void>;
  write_buildContextForAI(sessionId: string, options?: BuildContextOptions): Promise<string>;
  write_exportSession(sessionId: string, options?: ExportOptions): Promise<ExportData>;
}
```

### 9.7.2 使用示例

```javascript
// 1. 列出最近的私聊
const sessions = await window.__chatSdk.read_listSessions({
  type: 'private',
  limit: 10,
  orderBy: 'recent',
});

// 2. 获取会话的最近摘要
const summaries = await window.__chatSdk.read_getSessionSummary('session-1', {
  limit: 3,
  types: ['rolling', 'call'],
});

// 3. 获取最近消息
const messages = await window.__chatSdk.read_getRecentMessages('session-1', 20);

// 4. 搜索聊天内容
const results = await window.__chatSdk.read_search({
  keyword: '周末',
  types: ['message', 'summary'],
});

// 5. 构建 AI 上下文（让 AI 知道用户的聊天情况）
const context = await window.__chatSdk.write_buildContextForAI('session-1', {
  maxTokens: 4000,
});

// 6. 编辑摘要
const updated = await window.__chatSdk.write_editSummary(
  'summary-123',
  '新的摘要内容...',
  { appId: 'settings' }
);

// 7. 注入内容到上下文
await window.__chatSdk.write_injectContext({
  sessionId: 'session-1',
  sourceId: 'game-round-5',
  sourceType: 'game-round',
  content: '游戏第 5 回合非常精彩',
}, { appId: 'settings' });
```

---

## 9.8 SDK 安全约束

### 9.8.1 数据脱敏规则

```
所有 read_* API 返回的数据都经过脱敏：

✅ 保留字段：
  - 基础信息（id, name, content）
  - 时间戳
  - 摘要内容

❌ 移除字段：
  - IndexedDB 原始引用
  - 内部状态字段（_internal_*, __private_*）
  - 生成摘要的 prompt
  - 用户标记（私密标记）
  - 加密字段（如果有）
```

### 9.8.2 写入限制

```
write_* API 必须通过权限检查：

✅ 允许：
  - 白名单 App
  - 显式授权
  - 经过验证的 appId

❌ 禁止：
  - 未知 App
  - 未授权的操作
  - 批量修改
```

### 9.8.3 错误处理

```javascript
// SDK 调用失败时返回友好错误
try {
  const summary = await window.__chatSdk.read_getSummary('invalid-id');
} catch (error) {
  console.error('读取摘要失败:', error.message);
  // SDK 会抛出：
  // - '摘要不存在'
  // - 'App xxx 无权限'
  // - '数据格式错误'
}
```

---

（第九部分结束）

---

# 第十部分：完整 SDK 接口检查与问题清单

## 10.1 检查范围

```
本次检查覆盖：
1. Chat SDK（对外暴露）
2. ChatCore（内部核心）
3. CallManager（通话管理器）
4. GameManager（游戏管理器）
5. SummaryEngine（摘要引擎）
6. PromptEngine（Prompt 构建器）
7. HistoryManager（历史管理器）
8. toolkit 相关 API
9. 与 framework 的对接
```

## 10.2 检查项

### 10.2.1 Chat SDK 对外 API

#### ✅ 必有的 API

```
读取类（read_*）：
- [✅] read_listSessions - 列出会话
- [✅] read_getSession - 获取单个会话
- [✅] read_getSessionSummary - 获取会话摘要
- [✅] read_getRecentMessages - 获取最近消息
- [✅] read_listSummaries - 列出所有摘要
- [✅] read_getSummary - 获取单个摘要
- [✅] read_listCalls - 列出通话
- [✅] read_getCallSummary - 获取通话摘要
- [✅] read_listGames - 列出游戏
- [✅] read_getGameSummary - 获取游戏摘要
- [✅] read_search - 全文搜索

写入类（write_*）：
- [✅] write_editSummary - 编辑摘要
- [✅] write_injectContext - 注入内容
- [✅] write_buildContextForAI - 构建 AI 上下文
- [✅] write_exportSession - 导出会话
```

#### ⚠️ 缺少的 API

```
- [⚠️] read_getCallMessages - 获取通话期间完整消息
       用途：其他 App 想看通话期间聊了什么（但不是上下文）
       建议：补充

- [⚠️] read_getGameRounds - 获取游戏完整流程
       用途：其他 App 想看游戏回放
       建议：补充

- [⚠️] read_getSessionStats - 获取会话统计
       用途：消息数量、活跃度等
       建议：补充

- [⚠️] write_markMessage - 标记消息（如「重要」）
       用途：用户想让某条消息加入上下文
       建议：补充

- [⚠️] write_createSummary - 手动触发摘要
       用途：用户手动让 AI 重新生成摘要
       建议：补充
```

### 10.2.2 ChatCore 内部 API

```
核心方法：
- [✅] buildContext - 构建上下文
- [✅] buildContextForAI - 构建 AI 上下文（供其他 App 调用）
- [✅] addMessage - 添加消息
- [✅] updateMessage - 更新消息
- [✅] deleteMessage - 删除消息
- [✅] generateRollingSummary - 生成滚动摘要
- [✅] archiveOldMessages - 归档旧消息
- [✅] applySummary - 应用摘要
- [✅] rollBackSummary - 回滚摘要
- [✅] emitContextChanged - 通知上下文变更
```

### 10.2.3 CallManager API

```
- [✅] startCall - 启动通话
- [✅] endCall - 结束通话
- [✅] handleMessage - 处理通话期间的消息
- [✅] buildContext - 通话期间构建上下文
- [✅] mute - 静音
- [✅] toggleCamera - 切换摄像头
- [✅] _generateCallSummary - 生成通话摘要

⚠️ 建议补充：
- [⚠️] isInCall - 查询通话状态
- [⚠️] getCurrentCallId - 获取当前通话 ID
- [⚠️] getCallStats - 获取通话统计（时长、消息数）
```

### 10.2.4 GameManager API

```
- [✅] startGame - 启动游戏
- [✅] endGame - 结束游戏
- [✅] handleGameMessage - 处理游戏内消息
- [✅] buildContext - 游戏期间构建上下文
- [✅] _generateGameSummary - 生成游戏摘要

⚠️ 建议补充：
- [⚠️] isInGame - 查询游戏状态
- [⚠️] getCurrentGameId - 获取当前游戏 ID
- [⚠️] getAvailableGames - 获取可用游戏列表
- [⚠️] lockIslandForGame - 锁定灵动岛（游戏期间）
- [⚠️] unlockIslandForGame - 解锁灵动岛（游戏结束）
```

### 10.2.5 SummaryEngine API

```
- [✅] generateRollingSummary - 生成滚动摘要
- [✅] generateCallSummary - 生成通话摘要
- [✅] generateGameSummary - 生成游戏摘要
- [✅] generateManualSummary - 手动生成摘要
- [✅] editSummary - 编辑摘要
- [✅] rollBackSummary - 回滚摘要

⚠️ 建议补充：
- [⚠️] regenerateSummary - 重新生成摘要
- [⚠️] mergeSummaries - 合并多个摘要
- [⚠️] splitSummary - 拆分摘要
```

### 10.2.6 PromptEngine API

```
- [✅] buildChatPrompt - 构建聊天 prompt
- [✅] buildCallPrompt - 构建通话 prompt
- [✅] buildGamePrompt - 构建游戏 prompt
- [✅] buildSummaryPrompt - 构建摘要 prompt

⚠️ 建议补充：
- [⚠️] estimateTokens - 估算 token 数
- [⚠️] truncateContext - 截断上下文
```

### 10.2.7 HistoryManager API

```
- [✅] archiveSession - 归档会话
- [✅] viewArchive - 查看归档
- [✅] editArchive - 编辑归档
- [✅] deleteArchive - 删除归档
- [✅] publishArchive - 发布归档

⚠️ 建议补充：
- [⚠️] exportArchive - 导出归档
- [⚠️] importArchive - 导入归档
```

### 10.2.8 framework 对接

```
- [✅] registerPhoneApp - 注册 App
- [✅] toolkit.db - 数据库访问
- [✅] toolkit.island - 灵动岛
- [✅] toolkit.actions - 动作系统
- [✅] createOpenAppAction - 打开 App 动作
- [✅] createAppMethodAction - 调用方法动作
- [✅] createShareRecordAction - 共享记录动作

⚠️ 建议补充：
- [⚠️] createCallAction - 启动通话动作
       用途：在 App 中通过动作启动通话
       示例：createActionAttr({ action: 'startCall', targetSessionId: 'xxx' })
       
- [⚠️] createGameAction - 启动游戏动作
       用途：在 App 中通过动作启动游戏
       示例：createActionAttr({ action: 'startGame', gameType: 'werewolf' })
       
- [⚠️] toolkit.chatSdk - 聊天 SDK 访问
       用途：在 toolkit 中暴露 SDK
       示例：this.toolkit.chatSdk.read_listSessions(...)
```

## 10.3 接口一致性问题

### 10.3.1 ✅ 一致的部分

```
1. 所有 SDK 方法都是 async ✓
2. 所有 SDK 返回值都经过脱敏 ✓
3. 所有 SDK 错误都有友好提示 ✓
4. 所有 write_* API 都有权限检查 ✓
5. 所有 API 都有 TypeScript 类型声明 ✓
```

### 10.3.2 ⚠️ 需要修正的问题

```
问题 1：toolkit.chatSdk 暴露
  当前：toolkit 中没有 chatSdk
  修正：在 toolkit 中暴露 window.__chatSdk
  位置：src/core/app-toolkit.js

问题 2：callAction / gameAction 缺失
  当前：没有专门的 startCall / startGame 动作
  修正：在 actions.js 中添加 startCall / startGame 动作
  位置：src/core/actions.js

问题 3：IslandLock 接口
  当前：灵动岛锁定逻辑分散
  修正：统一 island.lockForGame() / island.unlockForGame() / island.allowMessages()
  位置：src/core/island-helper.js

问题 4：SessionType 枚举
  当前：type 用字符串 'private' | 'group'
  修正：定义为常量
  位置：chat-app/core/constants.js

问题 5：SummaryType 枚举
  当前：type 用字符串 'rolling' | 'call' | 'game'
  修正：定义为常量
  位置：chat-app/core/constants.js

问题 6：事件命名不一致
  当前：有的用 phone:xxx，有的用 chat:xxx
  修正：统一命名空间
  位置：chat-app/core/events.js
```

## 10.4 需要补充的 SDK API

### 10.4.1 补充列表

```javascript
// sdk/chat-sdk-additional.js
// 补充 SDK API

class ChatSDKAdditional {
  
  // === 补充 1: 获取通话期间完整消息 ===
  async read_getCallMessages(callId, options = {}) {
    await this._checkPermission('read', options);
    
    const call = await this._db.get('chatCalls', callId);
    if (!call) return null;
    
    // 通话期间的消息（已脱敏）
    return {
      callId,
      messages: (call.messages || []).map(m => this._sanitizeMessage(m)),
      transcripts: call.transcripts || [],
    };
  }
  
  // === 补充 2: 获取游戏完整流程 ===
  async read_getGameRounds(gameId, options = {}) {
    await this._checkPermission('read', options);
    
    const game = await this._db.get('chatGames', gameId);
    if (!game) return null;
    
    return {
      gameId,
      gameType: game.gameType,
      rounds: game.rounds || [],
      winner: game.winner,
      duration: game.duration,
    };
  }
  
  // === 补充 3: 获取会话统计 ===
  async read_getSessionStats(sessionId, options = {}) {
    await this._checkPermission('read', options);
    
    const session = await this._db.get('chatSessions', sessionId);
    const messages = await this._db.getAllFromIndex(
      'chatMessages',
      'idx_session',
      sessionId
    );
    const calls = await this._db.getAllFromIndex(
      'chatCalls',
      'idx_session',
      sessionId
    );
    const games = await this._db.getAllFromIndex(
      'chatGames',
      'idx_session',
      sessionId
    );
    
    return {
      sessionId,
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.senderId === 'user').length,
      aiMessages: messages.filter(m => m.senderId !== 'user').length,
      totalCalls: calls.length,
      totalCallDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
      totalGames: games.length,
      wins: games.filter(g => g.winner === 'user').length,
      firstMessageAt: messages[0]?.createdAt,
      lastMessageAt: messages[messages.length - 1]?.createdAt,
    };
  }
  
  // === 补充 4: 标记消息为重要 ===
  async write_markMessage(messageId, options = {}) {
    await this._checkPermission('write:mark', options);
    
    const { markType = 'important' } = options;
    
    const message = await this._db.get('chatMessages', messageId);
    if (!message) throw new Error('消息不存在');
    
    message.marks = message.marks || [];
    if (!message.marks.includes(markType)) {
      message.marks.push(markType);
    }
    
    await this._db.put('chatMessages', message);
    
    return message;
  }
  
  // === 补充 5: 手动触发摘要 ===
  async write_createSummary(sessionId, options = {}) {
    await this._checkPermission('write:summary', options);
    
    const { 
      type = 'manual',
      messageRange = 'all',  // 'all' | { from: idx, to: idx }
      customPrompt = null,
    } = options;
    
    const summaryEngine = await this._getSummaryEngine();
    
    return await summaryEngine.generateManualSummary(sessionId, {
      type,
      messageRange,
      customPrompt,
    });
  }
  
  // === 补充 6: 估算 token ===
  async write_estimateTokens(text) {
    // 简化的 token 估算（中文 1 字符 ≈ 1.5 token）
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
  }
}
```

## 10.5 检查总结

### 10.5.1 当前 SDK 完整度

```
✅ 已完成（核心）：
- 11 个 read_* API
- 4 个 write_* API
- 完整的数据脱敏
- 权限管理

⚠️ 建议补充（次要）：
- 6 个补充 API（read_getCallMessages / read_getGameRounds 等）
- 3 个 framework 动作（startCall / startGame / lockIsland）
- 2 个枚举常量（SessionType / SummaryType）

✅ 接口一致性：
- 所有 API 风格一致
- 错误处理友好
- TypeScript 类型完整
```

### 10.5.2 后续待办

```
1. [必须] 把 SDK 挂到 window.__chatSdk
2. [必须] 把 SDK 暴露到 toolkit
3. [必须] 补充 startCall / startGame 动作
4. [建议] 补充 6 个次要 API
5. [建议] 定义 SessionType / SummaryType 常量
6. [建议] 统一事件命名空间
```

---

（第十部分结束，迁移规划全部完结）


