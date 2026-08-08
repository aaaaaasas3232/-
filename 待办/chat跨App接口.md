# Chat App 跨 App 接口文档

> 聊天 App 暴露给其他 App 的 SDK API 清单。
> 所有其他 App 通过 `window.__chatSdk` 调用。

---

## 1. 暴露入口

```javascript
// 两种方式
window.__chatSdk               // 全局 SDK 实例（推荐）
window.__chatSdkToolkit        // 框架 toolkit 版（在 app 内通过 this.toolkit.chatSdk 访问）
```

```javascript
// 在 App 内通过 toolkit 访问
methods: {
    async myMethod() {
        const sessions = await this.toolkit.chatSdk.listSessions({ limit: 5 });
    }
}
```

---

## 2. Read-Only API（所有 App 可读）

### 2.1 listSessions

```typescript
listSessions(options?: {
    type?: 'private' | 'group',        // 会话类型过滤
    limit?: number,                      // 限制数量（默认 50）
    orderBy?: 'recent' | 'created',      // 排序
    windowTag?: 'A' | 'B',               // 双窗口过滤
}): Promise<SessionInfo[]>
```

### 2.2 getSession

```typescript
getSession(sessionId: string): Promise<SessionInfo | null>
```

### 2.3 getSessionSummary

```typescript
getSessionSummary(sessionId: string, options?: {
    limit?: number,
    types?: Array<'rolling' | 'history' | 'call' | 'game' | 'manual'>,
}): Promise<SummaryInfo[]>
```

### 2.4 getRecentMessages / getAllMessages

```typescript
getRecentMessages(sessionId: string, limit?: number): Promise<MessageInfo[]>
getAllMessages(sessionId: string): Promise<MessageInfo[]>
```

### 2.5 listSummaries / getSummary

```typescript
listSummaries(options?: {
    sessionId?: string,
    type?: SummaryType,
    limit?: number,
}): Promise<SummaryInfo[]>
getSummary(summaryId: string): Promise<SummaryInfo | null>
```

### 2.6 listCalls / getCall

```typescript
listCalls(options?: { sessionId?: string }): Promise<CallInfo[]>
getCall(callId: string): Promise<CallInfo | null>
```

### 2.7 listGames / getGame

```typescript
listGames(options?: { sessionId?: string }): Promise<GameInfo[]>
getGame(gameId: string): Promise<GameInfo | null>
```

### 2.8 search

```typescript
search(query: {
    keyword: string,
    types?: Array<'message' | 'summary'>,
}): Promise<Array<{
    type: 'message' | 'summary',
    id: string,
    sessionId: string,
    content: any,
    score: number,
}>>
```

### 2.9 getSessionStats

```typescript
getSessionStats(sessionId: string): Promise<{
    totalMessages: number,
    userMessages: number,
    aiMessages: number,
    totalCalls: number,
    totalCallDuration: number,
    totalGames: number,
    firstMessageAt: number,
    lastMessageAt: number,
}>
```

### 2.10 listArchives

```typescript
listArchives(): Promise<Array<{
    id: string,
    sessionId: string,
    title: string,
    description: string,
    messageCount: number,
    createdAt: number,
}>>
```

---

## 3. Write API（需授权）

### 3.1 sendMessage

```typescript
sendMessage(sessionId: string, content: string, options?: {
    appId?: string,
}): Promise<MessageInfo | null>
```

> 注意：调用后 AI 会自动回复。

### 3.2 createSession

```typescript
createSession(options: {
    id?: string,
    type?: 'private' | 'group',
    name: string,
    aiPersonId?: string,
    aiPersonName?: string,
    participants?: Array<{ id, name }>,
    windowTag?: 'A' | 'B',
}): Promise<SessionInfo | null>
```

### 3.3 deleteSession

```typescript
deleteSession(sessionId: string): Promise<boolean>
```

### 3.4 editSummary

```typescript
editSummary(summaryId: string, newContent: string, options?: {
    appId?: string,
}): Promise<SummaryInfo | null>
```

### 3.5 injectContext

```typescript
injectContext(data: {
    sessionId: string,
    sourceId?: string,
    sourceType?: 'message' | 'summary' | 'custom' | 'game-round' | 'call-segment',
    content: string,
}, options?: { appId?: string }): Promise<InjectionInfo | null>
```

### 3.6 buildContextForAI

```typescript
buildContextForAI(sessionId: string, options?: {
    maxTokens?: number,
    recentTurns?: number,
}): Promise<string>  // 返回完整 prompt 字符串
```

### 3.7 setReplyMode

```typescript
setReplyMode(mode: 'instant' | 'hold' | 'delay', options?: {
    delayMs?: number,
}): Promise<boolean>
```

### 3.8 createArchive / createSummary

```typescript
createArchive(sessionId: string, options?: {
    title?: string,
    description?: string,
    tag?: string,
}): Promise<ArchiveInfo | null>

createSummary(sessionId: string, options?: {
    type?: 'rolling' | 'history' | 'manual',
    messageIds?: string[],
    customPrompt?: string,
}): Promise<SummaryInfo | null>
```

### 3.9 publishSummary / deleteSummary

```typescript
publishSummary(summaryId: string): Promise<SummaryInfo | null>
deleteSummary(summaryId: string): Promise<boolean>
```

### 3.10 estimateTokens

```typescript
estimateTokens(text: string): Promise<number>
```

---

## 4. 跨 App 集成示例

### 4.1 设置 App - 人设主页（用聊天摘要调整 AI 人设）

```javascript
// js/apps/setting/persona/main.js
export default function createPersonaApp() {
    return {
        id: 'persona',
        name: '人设',
        methods: {
            async loadChatContext() {
                const sessions = await this.toolkit.chatSdk.listSessions({
                    type: 'private',
                    limit: 5,
                });

                const summaries = sessions.length ? await this.toolkit.chatSdk.getSessionSummary(
                    sessions[0].id,
                    { limit: 3 }
                ) : [];

                return { sessions, summaries };
            },

            async adjustPersonaFromChats() {
                const { sessions, summaries } = await this.loadChatContext();
                const prompt = `基于以下聊天摘要，调整 AI 人设：\n${summaries.map(s => s.summary).join('\n')}`;
                const newPersona = await this.sdk.ai.chat(prompt);
                // ...
            },
        },
    };
}
```

### 4.2 朋友圈 App（用聊天主题生成朋友圈）

```javascript
methods: {
    async generatePostFromChat(chatSessionId) {
        const summaries = await this.toolkit.chatSdk.getSessionSummary(chatSessionId, {
            limit: 2,
            types: ['rolling', 'call', 'game'],
        });
        const recent = await this.toolkit.chatSdk.getRecentMessages(chatSessionId, 10);

        const prompt = `根据以下聊天内容生成一条朋友圈文案：\n${summaries.map(s => s.summary).join('\n')}\n${recent.map(m => `${m.senderName}: ${m.content}`).join('\n')}`;
        const post = await this.sdk.ai.chat(prompt);
        return post;
    },
}
```

### 4.3 人设主页 - 展示通话记录

```javascript
async showRecentCalls() {
    const calls = await this.toolkit.chatSdk.listCalls({ limit: 10 });
    return calls.map(c => ({
        icon: '📞',
        title: c.callType === 'video' ? '视频通话' : '语音通话',
        duration: Math.round((c.duration || 0) / 60) + ' 分钟',
        summary: c.summary,
    }));
}
```

---

## 5. 权限矩阵

| App             | Read | Edit | Inject | BuildCtx | Archive |
|-----------------|:----:|:----:|:------:|:--------:|:-------:|
| settings        |  ✅  |  ✅  |   ✅   |    ✅    |   ✅    |
| persona         |  ✅  |  ✅  |   ✅   |    ✅    |   ✅    |
| moments         |  ✅  |  ❌  |   ❌   |    ✅    |   ❌    |
| homepage        |  ✅  |  ❌  |   ❌   |    ✅    |   ❌    |
| prompt-survey   |  ✅  |  ❌  |   ❌   |    ❌    |   ❌    |
| appstore        |  ✅  |  ❌  |   ❌   |    ❌    |   ❌    |
| 其他            |  ✅  |  ❌  |   ❌   |    ❌    |   ❌    |

> Read 是默认开放给所有 App 的。其他 Write 操作必须白名单授权。

---

## 6. 数据脱敏规则

所有 Read API 返回的数据都经过脱敏：

**保留字段**：
- 基础信息（id, name, content, summary）
- 时间戳（createdAt, lastActiveAt）
- 公开元数据（type, role, senderName）

**移除字段**：
- IndexedDB 原始引用
- 内部状态字段（_internal_*）
- 生成摘要的 prompt
- 用户标记（私密 marks）
- 加密字段（如有）

---

## 7. 错误处理

所有 API 返回 Promise，失败时：
- 返回 `null`（单条查询）
- 返回 `[]`（列表查询）
- 不抛异常到调用方

调用方应该检查返回值是否为 null / []，并优雅降级。

```javascript
const sessions = await window.__chatSdk.listSessions();
if (!sessions || !sessions.length) {
    // 没有会话，显示空状态
}
```

---

## 8. 事件订阅

Chat Core 派发的事件：

| 事件 | detail | 触发时机 |
|------|--------|----------|
| `chat:session-changed` | `{ sessionId, reason }` | 会话创建/删除/更新 |
| `chat:message-added` | `{ message }` | 新消息写入 |
| `chat:summary-created` | `{ summary }` | 摘要生成（含 K/H/call/game/manual） |
| `chat:summary-edited` | `{ summaryId, sessionId }` | 摘要被编辑 |
| `chat:context-changed` | `{ sessionId, reason }` | 上下文变化（编辑摘要/注入） |
| `chat:call-started` | `{ callId }` | 通话开始 |
| `chat:call-ended` | `{ callId, summaryId }` | 通话结束 |
| `chat:game-started` | `{ gameId }` | 游戏开始 |
| `chat:game-ended` | `{ gameId, summaryId }` | 游戏结束 |

订阅示例：

```javascript
window.addEventListener('chat:summary-edited', (e) => {
    const { summaryId, sessionId } = e.detail;
    // 重新构建 prompt
});
```

---

## 9. 实战调试入口

```javascript
// 1. 直接看所有会话
console.table(await window.__chatSdk.listSessions());

// 2. 看某个会话的摘要
console.log(await window.__chatSdk.getSessionSummary('demo_session_001'));

// 3. 看最近消息
console.log(await window.__chatSdk.getRecentMessages('demo_session_001', 20));

// 4. 搜索
console.log(await window.__chatSdk.search({ keyword: '天气' }));

// 5. 看 prompt（这是真正发给 AI 的内容）
console.log(await window.__chatSdk.buildContextForAI('demo_session_001'));

// 6. 估算 token
console.log(await window.__chatSdk.estimateTokens('一段文本'));
```

---

## 10. 历史与版本

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-08-03 | 初始版本，从 参考/chat.js 迁移 |

---

**关键原则**：
1. 其他 App 只能通过 SDK 访问数据，不能直接读 IndexedDB
2. 写操作（edit/inject/buildCtx/archive）有权限检查
3. 所有数据经过脱敏
4. 异步 API，失败时返回安全默认值，不抛错
5. 重大事件通过 CustomEvent 派发，方便订阅