# 07 — 玩游戏(游戏选择器 + 卡片点击)

> **chat.js 原始范围**:`15585–15689`
> 总长度 **约 105 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | 游戏选择器 | `openGameSelector` | 15588 |
>
> ## 包含的游戏
>
> 1. **狼人杀**(`data-game="werewolf"`)— `openWerewolfSetup(groupId)`
> 2. **谁是卧底**(`data-game="undercover"`)— `openUndercoverSetup(groupId)`
> 3. **大富翁**(`data-game="monopoly"`)— `openMonopolySetup(groupId)`
> 4. 排行榜入口(置顶卡片)
>
> ## 关联
>
> - 入口:群聊工具栏 / 群聊工具区
> - 排行榜实现 / 玩家数据存储:**不在 chat.js 主流程内**(由群聊设置 + IndexedDB 持久化,详见 `js/apps/chat-app/pages/game-leaderboard-page.js`)
>
> ## 不包含
>
> `openGroupSettings`(15691 起,属于群设置独立话题)
>
> ---
>
> 下面是 chat.js 15585–15689 的原始代码,未做精简。

```js
// ================ chat.js 行 15585 ~ 15689 ================
// ================ chat.js 行 15585 ~ 15689 ================
    // ============ 小游戏系统 ============
    
    // 游戏选择器
    ChatApp.prototype.openGameSelector = function(groupId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        var html = '<div style="padding:20px;background:linear-gradient(180deg,#E8F4FF 0%,#F0F7FF 100%);min-height:100%;">';
        html += '<div style="font-size:15px;font-weight:600;color:#4A6FA5;margin-bottom:20px;text-align:center;">小游戏</div>';
        
        // 排行榜入口卡片（置顶）
        html += '<div id="leaderboard-card" style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.3s;border:1px solid #E8D6F0;box-shadow:0 2px 8px rgba(155,122,160,0.12);">';
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<div style="width:48px;height:48px;background:linear-gradient(135deg,#E8D6F0,#F5EEFF);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="#9B7AA0"><path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/></svg>';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#7A5A80;">积分排行榜</div>';
        html += '<div style="font-size:11px;color:#9B7AA0;margin-top:3px;">查看游戏胜率和角色数据</div>';
        html += '</div>';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="#C9A0DC"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>';
        html += '</div>';
        html += '</div>';
        
        // 狼人杀卡片
        html += '<div class="game-card" data-game="werewolf" style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.3s;border:1px solid #D6E4FF;box-shadow:0 2px 8px rgba(74,111,165,0.1);">';
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<div style="width:48px;height:48px;background:linear-gradient(135deg,#A8C8EC,#D6E4FF);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="#4A6FA5"><path d="M12 3c-1.94 0-3.64.85-4.5 2.14-.42-.08-.85-.14-1.3-.14C3.01 5 1 7.01 1 9.5c0 1.12.4 2.14 1.06 2.93C1.4 13.52 1 15.23 1 17c0 2.76 2.24 5 5 5 .7 0 1.36-.14 1.97-.4.91.26 1.93.4 3.03.4s2.12-.14 3.03-.4c.61.26 1.27.4 1.97.4 2.76 0 5-2.24 5-5 0-1.77-.4-3.48-1.06-4.57.66-.79 1.06-1.81 1.06-2.93 0-2.49-2.01-4.5-4.2-4.5-.45 0-.88.06-1.3.14C15.64 3.85 13.94 3 12 3zm-4 5c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-4 8c-2 0-3.5-1.5-3.5-3h7c0 1.5-1.5 3-3.5 3z"/></svg>';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#3A5A80;">狼人杀</div>';
        html += '<div style="font-size:11px;color:#7A9BBF;margin-top:3px;">经典桌游，考验推理与演技</div>';
        html += '<div style="font-size:10px;color:#A8C8EC;margin-top:4px;">4-12 人</div>';
        html += '</div>';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="#A8C8EC"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>';
        html += '</div>';
        html += '</div>';
        
        // 谁是卧底卡片
        html += '<div class="game-card" data-game="undercover" style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.3s;border:1px solid #FFD6E0;box-shadow:0 2px 8px rgba(244,166,205,0.15);">';
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<div style="width:48px;height:48px;background:linear-gradient(135deg,#FFD6E0,#FFF0F3);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="#E88FAC"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#C76B8F;">谁是卧底</div>';
        html += '<div style="font-size:11px;color:#E88FAC;margin-top:3px;">语言描述，找出隐藏的卧底</div>';
        html += '<div style="font-size:10px;color:#FFB3C6;margin-top:4px;">3-10 人</div>';
        html += '</div>';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="#FFB3C6"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>';
        html += '</div>';
        html += '</div>';
        
        // 大富翁卡片
        html += '<div class="game-card" data-game="monopoly" style="background:rgba(255,255,255,0.8);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.3s;border:1px solid rgba(184,192,255,0.4);box-shadow:0 2px 8px rgba(123,143,161,0.12);">';
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<div style="width:48px;height:48px;background:linear-gradient(135deg,#E8E4E1,#F5F5F5);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;">🎲</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#7B8FA1;">大富翁</div>';
        html += '<div style="font-size:11px;color:#9BA8B4;margin-top:3px;">经典棋盘游戏，掷骰子前进</div>';
        html += '<div style="font-size:10px;color:#b8c0ff;margin-top:4px;">1-4 人 · 飞行棋/真心话大冒险</div>';
        html += '</div>';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="#b8c0ff"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>';
        html += '</div>';
        html += '</div>';
        
        // 更多游戏（即将推出）
        html += '<div style="background:rgba(168,200,236,0.15);border-radius:12px;padding:16px;text-align:center;border:1px dashed #A8C8EC;">';
        html += '<div style="color:#7A9BBF;font-size:12px;">更多游戏即将推出...</div>';
        html += '</div>';
        
        html += '</div>';
        
        var gamePage = this.openDetailPage(html, { title: '小游戏', titleColor: '#4A6FA5', bgColor: '#E8F4FF' });
        
        // 绑定游戏卡片点击
        gamePage.querySelectorAll('.game-card').forEach(function(card) {
            card.onmouseenter = function() { card.style.transform = 'translateY(-3px)'; };
            card.onmouseleave = function() { card.style.transform = ''; };
            card.onclick = function() {
                var gameType = card.getAttribute('data-game');
                if (gameType === 'werewolf') {
                    self.openWerewolfSetup(groupId);
                } else if (gameType === 'undercover') {
                    self.openUndercoverSetup(groupId);
                } else if (gameType === 'monopoly') {
                    self.openMonopolySetup(groupId);
                }
            };
        });
        
        // 绑定排行榜卡片点击
        var lbCard = gamePage.querySelector('#leaderboard-card');
        if (lbCard) {
            lbCard.onmouseenter = function() { lbCard.style.transform = 'translateY(-3px)'; };
            lbCard.onmouseleave = function() { lbCard.style.transform = ''; };
            lbCard.onclick = function() {
                self.openGameLeaderboard(groupId);
            };
        }
    };
    
    

```

