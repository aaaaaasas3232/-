# 05 — 点击音乐卡片跳转 app(一起听 + 歌曲分享 + 歌单分享)

> **chat.js 原始范围**:`6023–6085`(跳转处理) + 卡片 HTML 渲染位于 `renderMessages`(1150+) 内联字符串
> 总长度 **约 65 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | 一起听邀请 | `handleListenTogetherInvite` | 6023 |
> | 歌单分享点击 | `handlePlaylistShareClick` | 6070 |
>
> ## 关联
>
> - 卡片 HTML 渲染在 `renderMessages` 内联字符串里 — `[分享音乐:歌名:歌手]` 由 `parseAIResponse`(7925,详见 `08-call-parse-ai.md`)识别后插入消息列表
> - 跳转目标:`startListenTogether`(全局函数,在 chat.js 之外的 music player 模块)
>
> ## 上下文依赖
>
> - `MusicPlayerState` —— 全局音乐播放状态机(读)
> - `startListenTogether` —— 全局函数,启动一起听
> - `PhoneCore.db.get('shared_music', shareId)` —— 读取歌单分享记录
>
> ---
>
> 下面是 chat.js 6023–6085 的原始代码,未做精简。

```js
// ================ chat.js 行 6023 ~ 6085 ================
// ================ chat.js 行 6023 ~ 6085 ================
    ChatApp.prototype.handleListenTogetherInvite = function(aiId) {
        // 检查是否已经在一起听
        if (typeof MusicPlayerState !== 'undefined' && MusicPlayerState.listenTogether && MusicPlayerState.listenTogether.active) {
            // 已经在一起听，直接打开音乐App查看
            var musicApp = PhoneCore.getApp('music-app');
            if (musicApp) {
                musicApp.open();
                setTimeout(function() {
                    if (musicApp.appWindow) {
                        var tabItems = musicApp.appWindow.querySelectorAll('.app-tab-item');
                        if (tabItems[1]) {
                            tabItems[1].click();
                        }
                    }
                }, 300);
            }
            return;
        }
        
        // 打开音乐App并开始一起听
        var musicApp = PhoneCore.getApp('music-app');
        if (musicApp) {
            // 启动一起听
            if (typeof startListenTogether === 'function') {
                startListenTogether(aiId);
            }
            // 打开音乐App
            musicApp.open();
            // 切换到一起听标签页（索引1是一起听标签）
            setTimeout(function() {
                if (musicApp.appWindow) {
                    var tabItems = musicApp.appWindow.querySelectorAll('.app-tab-item');
                    if (tabItems[1]) {
                        tabItems[1].click();
                    }
                }
            }, 300);
            
            PhoneCore.notifications.send({
                type: 'success',
                title: '已加入一起听',
                size: 'mini'
            });
        }
    };
    
    /* 【处理歌单分享点击】 */
    ChatApp.prototype.handlePlaylistShareClick = function(shareId) {
        // 打开音乐App查看歌单
        var musicApp = PhoneCore.getApp('music-app');
        if (musicApp) {
            musicApp.open();
            PhoneCore.notifications.send({
                type: 'info',
                title: '查看歌单',
                message: '歌曲名仅供参考，需自行添加',
                icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#F472B6"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
                size: 'medium'
            });
        }
    };

    // 发送消息

```

