/**
 * 小听 - 主数据库配置
 *
 * 包含 5 张基础数据表 + 旧设置 App 的 5 张表 + settings-sdk 12 张新表
 *
 * 思路：所有 store 都提前 appendBaseStore 注册到 ListenDb，
 * 这样不管哪个 App 注册时声明，都能保证 IndexedDB onupgradeneeded 时这些 store 已就位。
 */
import { ListenDb } from './engine.js';

export function createBaseStoresDatabase() {
    const myDb = new ListenDb({ dbName: 'listen_db' });

    const baseStores = [
        { name: 'Userinfo', keyPath: 'userId' },
        { name: 'charInfo', keyPath: 'charId' },
        { name: 'worldInfo', keyPath: 'worldId' },
        { name: 'apiInfo', keyPath: 'apiId' },
        { name: 'AppSettings', keyPath: 'key' },
    ];

    // 设置 App 保留的旧表（外观、API）
    const settingsStores = [
        { name: 'deviceSettings', keyPath: 'key' },
        { name: 'apiProfiles',    keyPath: 'key' },
    ];

    // settings-sdk 新表（12 张）— 见 js/apps/setting/world/sdk/settings-sdk.js
    // v0.17：删除 sdkSocialAccounts / sdkSocialAccountTemplates（社媒已移除）
    // v0.18：新增 sdkDiaries（人设日记，按 entityType+entityId+date 存）
    const sdkStores = [
        { name: 'sdkUsers',                  keyPath: 'id' },
        { name: 'sdkAiPersons',              keyPath: 'id' },
        { name: 'sdkWorlds',                 keyPath: 'id' },
        { name: 'sdkWorldGroups',            keyPath: 'id' },          // ★ v0.11 世界观组
        { name: 'sdkTagGroups',              keyPath: 'id' },
        { name: 'sdkTags',                   keyPath: 'id' },
        { name: 'sdkFactions',               keyPath: 'id' },
        { name: 'sdkPlaces',                 keyPath: 'id' },          // ★ 地点（箱庭地图容器）
        { name: 'sdkLocations',              keyPath: 'id' },          // ★ 场所（地点下的 pin）
        { name: 'sdkSnapshots',              keyPath: 'key' },
        { name: 'sdkActive',                 keyPath: 'key' },
        { name: 'sdkDrafts',                keyPath: 'id' },          // ★ v0.11 草稿
        { name: 'sdkDiaries',                keyPath: 'id' },          // ★ v0.18 人设日记（id = `${entityType}:${entityId}:${date}`）
        { name: 'sdkSchedules',              keyPath: 'id' },          // ★ v0.19 人设日程（id = `${entityType}:${entityId}:${date}`）
        { name: 'sdkWeeklySchedules',         keyPath: 'id' },          // ★ v0.31 每周重复日程（id = `${entityType}:${entityId}:${dayOfWeek}`）
        // ★ API 管理器表
        { name: 'apiKeys',                   keyPath: 'id' },          // API 密钥
        { name: 'apiGroups',                 keyPath: 'id' },          // API 组
        { name: 'apiUsageLogs',              keyPath: 'id' },          // API 调用日志
        // ★ 天气 App 表
        { name: 'weatherCities',              keyPath: 'id' },          // 天气 App 城市列表
        // ★ v0.27 chat-app 联系人已改为存到 user 实体上:
        //   user.socialProfiles.chat.calendarContacts[] / storyContacts[]
        //   不再独立成表,删除 chatContacts 表的注册(已无业务读)

        // ★ v0.30 chat-app 真实消息存储
        //   每条消息独立 record,keyPath = id(murmur 用字符串 ID)
        //   aiPersonId + mode 字段用于按会话拉消息
        //   存真实数据,不再只读 DEMO_MESSAGES
        { name: 'chatMessages', keyPath: 'id' },

        // ★ v0.42 chat-app 故事存档
        //   故事模式聊天记录的"快照封存":每条记录独立存一条完整快照
        //     id              string  存档 ID(archive-<ts>-<rand>)
        //     userId          string  哪个 user 封存的
        //     aiPersonId      string  跟哪个 AI 的故事
        //     mode            'story' (固定:故事模式才有存档)
        //     name            string  封存标题
        //     description     string  封存简介
        //     messages        array   完整消息快照(原消息列表,只读)
        //     messageCount    number  消息条数
        //     createdAt       number  封存时间戳
        //     updatedAt       number  更新时间戳
        { name: 'sdkStoryArchives', keyPath: 'id' },

        // ★ v0.43 chat-app 单条收藏(每条收藏一条独立记录,id=fav-<userId>-<aiPersonId>-<mode>-<msgId>)
        //   区别于「对话片段收藏」(type='conversation') 走 window.__chatDemoFavorites (内存 demo),
        //   单条收藏(text / image / location / voice_call / video_call / game)
        //   走真实持久化,跟消息解耦 — 消息被删后收藏仍可看
        //   字段:
        //     id              string  fav-<userId>-<aiPersonId>-<mode>-<msgId>
        //     userId          string  哪个 user 收藏的
        //     aiPersonId      string  跟哪个 AI 的对话
        //     mode            'calendar' | 'story'
        //     sourceType      'private' | 'group'
        //     conversationId  string  会话 id(私聊=aiPersonId, 群聊=groupId)
        //     messageId       string  原始消息 id(便于后续编辑 / 删除收藏)
        //     type            string  message.type 副本
        //     sender          'user' | 'ai' | 'system'
        //     senderName      string
        //     content         string  text 时存正文,非 text 时存 summary
        //     imageDescription / imagePreview / cardColor  image 字段
        //     locationName / locationAddress                 location 字段
        //     duration / summary / callType                 通话字段
        //     gameType / gameTitle                          game 字段
        //     createdAt      number
        //     updatedAt      number
        { name: 'sdkChatFavorites', keyPath: 'id' },

        // ★ v0.61 chat-app 消息归档(v0.61.4 消息归档)
        //   chatMessages 只保留「当天」消息,昨天及更早的进入归档表
        //   字段(同 chatMessages + archivedAt):
        //     id              string  原消息 id(同步过来,不重新生成)
        //     aiPersonId      string
        //     mode            'calendar' | 'story'
        //     conversationType 'private' | 'group'
        //     conversationId  string
        //     sender          'user' | 'ai' | 'system'
        //     senderId        string
        //     senderName      string
        //     type            string  text / image / sticker / voice / location / chat_record / call_record / pat / ...
        //     content         string
        //     chatRecord / replyTo / locationCard / redpacketCard / transferCard / callRecord / imageUrl / ...
        //     timestamp       number  原发送时间
        //     archivedAt      number  归档时间戳
        //     archivedDay     string  'YYYY-MM-DD' 归档当日(便于按日聚合)
        { name: 'chatArchiveMessages', keyPath: 'id' },

        // ★ v0.61.5 第三方 App Prompt 注册 SDK 用户状态(v0.61.5 SDK 注册接口)
        //   - 内存注册表 settingsSdk._appPromptRegistry 由 App 启动时 register() 写入,
        //     卸载 App 时自动清空(内存 Map)
        //   - 用户编辑过的状态(启停 / content / order / 自定义预览数据)落这张表,
        //     **永久保留**:App 卸载再重装后 register() 会从这张表恢复用户状态
        //   - keyPath = 'key'(字符串 `${appId}::${promptId}`)
        //   - 字段:
        //     key             string  `${appId}::${promptId}`
        //     appId           string  注册方 appId(如 'music' / 'weather-app')
        //     promptId        string  注册方定义的 promptId
        //     active          boolean 是否注入到 AI prompt
        //     content         string  用户编辑后的 content
        //     order           number  注入顺序
        //     customPreviewData object|null 用户自定义预览数据(null = 用 register.previewData)
        //     updatedAt       number
        { name: 'appPromptStates', keyPath: 'key' },
    ];

    for (const store of baseStores) {
        myDb.appendBaseStore(store.name, store.keyPath);
    }
    for (const store of settingsStores) {
        myDb.appendBaseStore(store.name, store.keyPath);
    }
    for (const store of sdkStores) {
        myDb.appendBaseStore(store.name, store);
    }

    myDb.open()
        .then(() => myDb.ensureSchema())
        .catch(error => {
            console.error('[db/base-stores] 打开主数据库失败:', error);
        });

    return myDb;
}