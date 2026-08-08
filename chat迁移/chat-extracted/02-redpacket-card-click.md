# 02 — 点击红包卡片(领取 / 拒绝 / 发送)

> **chat.js 原始范围**:`5347–5510`(红包领取/拒绝) + `5756–5882`(红包发送) + `5844–5882`(AI 领红包)
> 总长度 **约 230 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | 领取红包 | `openRedpacket` / `showRedpacketOptions` / `confirmOpenRedpacket` / `rejectRedpacket` | 5347, 5384, 5431, 5511 |
> | 红包发送入口 | `openRedPacketSend` / `sendRedPacketMessage` | 5756, 5777 |
> | AI 领红包 | `aiOpenRedpacket` | 5844 |
>
> ## 关联
>
> 卡片 HTML 渲染在 `renderMessages`(1150+) 内联字符串里 — `[发红包:金额:祝福语]` 这种 AI 触发指令由 `parseAIResponse`(7925,详见 `08-call-parse-ai.md`)识别。
>
> 资金扣减/入账规则详见 `04-asset-flow.md`。
>
> ---
>
> 下面是 chat.js 5347–5510 + 5756–5882 的原始代码,未做精简。

```js
// ================ chat.js 行 5347 ~ 5510 ================
// ================ chat.js 行 5347 ~ 5510 ================
    ChatApp.prototype.openRedpacket = function(aiId, msgId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        var msg = self.findMessageByMsgId(aiId, msgId);
        if (!msg || !msg.redpacketCard) return;
        
        if (msg.redpacketCard.opened) {
            this.showToast('红包已领取');
            return;
        }
        
        if (msg.redpacketCard.rejected) {
            this.showToast('红包已拒绝');
            return;
        }
        
        if (!msg.redpacketCard.fromAI) {
            this.showToast('这是你发的红包');
            return;
        }
        
        var amount = msg.redpacketCard.amount;
        var aiAssets = ai.assets || 0;
        
        // 验证AI资产是否足够
        if (aiAssets < amount) {
            this.showToast('对方余额不足');
            return;
        }
        
        // 显示红包操作选项
        this.showRedpacketOptions(aiId, msgId, page, amount);
    };
    
    // 显示红包操作选项
    ChatApp.prototype.showRedpacketOptions = function(aiId, msgId, page, amount) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        var msg = self.findMessageByMsgId(aiId, msgId);
        
        // 获取手机屏幕容器
        var phoneScreen = document.getElementById('phone-screen');
        if (!phoneScreen) phoneScreen = document.body;
        
        // 创建选项弹窗（定位到手机屏幕内）
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
        
        var dialog = document.createElement('div');
        dialog.style.cssText = 'background:white;border-radius:16px;padding:24px;width:260px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.15);';
        dialog.innerHTML = '<div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">' + (msg.redpacketCard.message || '恭喜发财') + '</div>' +
            '<div style="font-size:32px;font-weight:700;color:#FF6B8A;margin:16px 0;">¥' + amount.toFixed(2) + '</div>' +
            '<div style="font-size:13px;color:#999;margin-bottom:20px;">来自 ' + ai.name + ' 的红包</div>' +
            '<div style="display:flex;gap:12px;">' +
            '<button id="reject-redpacket" style="flex:1;padding:12px;border:1px solid #ddd;background:white;border-radius:8px;font-size:15px;color:#666;cursor:pointer;">不领取</button>' +
            '<button id="accept-redpacket" style="flex:1;padding:12px;border:none;background:linear-gradient(135deg,#FF8FAB,#FF6B8A);border-radius:8px;font-size:15px;color:white;cursor:pointer;">领取红包</button>' +
            '</div>';
        
        overlay.appendChild(dialog);
        phoneScreen.appendChild(overlay);
        
        // 点击遮罩关闭
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
        
        // 不领取
        dialog.querySelector('#reject-redpacket').onclick = function() {
            overlay.remove();
            self.rejectRedpacket(aiId, msgId, page);
        };
        
        // 领取
        dialog.querySelector('#accept-redpacket').onclick = function() {
            overlay.remove();
            self.confirmOpenRedpacket(aiId, msgId, page);
        };
    };
    
    // 确认领取红包
    ChatApp.prototype.confirmOpenRedpacket = function(aiId, msgId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        var msg = self.findMessageByMsgId(aiId, msgId);
        if (!msg || !msg.redpacketCard) return;
        
        var amount = msg.redpacketCard.amount;
        var aiAssets = ai.assets || 0;
        
        // 再次验证AI资产
        if (aiAssets < amount) {
            this.showToast('对方余额不足');
            return;
        }
        
        msg.redpacketCard.opened = true;
        msg.redpacketCard.openedAt = Date.now();
        
        // 增加用户余额
        var mask = PhoneCore.user.getCurrentMask();
        var userId = mask ? mask.id : 'default';
        if (mask) {
            mask.balance = (mask.balance || 0) + amount;
            PhoneCore.saveUserProfile();
        }
        
        // 扣减AI资产
        ai.assets = Math.max(0, aiAssets - amount);
        
        // 添加到AI交易记录
        if (!ai.transactionHistory) ai.transactionHistory = [];
        ai.transactionHistory.push({
            type: 'expense',
            name: '红包被领取',
            amount: amount,
            to: 'user',
            timestamp: Date.now()
        });
        
        // 记录到交易系统
        PhoneCore.transactions.record({
            type: 'redpacket',
            amount: amount,
            from: aiId,
            to: userId,
            description: ai.name + ' 的红包',
            appId: 'chat-app'
        });
        
        // 添加系统消息通知AI用户领取了红包（这条消息不显示给用户，只用于AI上下文）
        ai.chatHistory.push({
            id: 'sys_' + Date.now(),
            role: 'system',
            type: 'action_notify',
            content: '[用户领取了你发的' + amount.toFixed(2) + '元红包]',
            hidden: true,
            timestamp: Date.now()
        });
        
        PhoneCore.saveAI(ai);
        
        // 刷新消息
        var messagesContainer = page.querySelector('#messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = this.renderMessages(aiId);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            this.bindMessageActions(page, aiId);
        }
        
        this.showToast('领取了 ¥' + amount.toFixed(2) + ' 红包');
        
        // AI对用户领取红包做出反应
        setTimeout(function() {
            self.getAIResponse(aiId, page);
        }, 1000 + Math.random() * 1500);
    };
    
    // 拒绝红包

// ================ chat.js 行 5756 ~ 5882 ================
    ChatApp.prototype.openRedPacketSend = function(aiId, page) {
        var self = this;
        var mask = PhoneCore.user.getCurrentMask();
        var balance = mask ? mask.balance : 0;
        
        var amount = prompt('输入红包金额（余额: ¥' + balance.toFixed(2) + '）:', '10');
        if (amount !== null && !isNaN(parseFloat(amount))) {
            var amountNum = parseFloat(amount);
            if (amountNum > balance) {
                this.showToast('余额不足');
                return;
            }
            
            var message = prompt('输入祝福语:', '恭喜发财，大吉大利');
            if (message !== null) {
                this.sendRedPacketMessage(aiId, amountNum, message, page);
            }
        }
    };
    
    // 发送红包消息
    ChatApp.prototype.sendRedPacketMessage = function(aiId, amount, message, page) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var mask = PhoneCore.user.getCurrentMask();
        var userId = mask ? mask.id : 'default';
        if (mask) {
            mask.balance -= amount;
        }
        
        var redpacketMessage = {
            id: 'msg_' + Date.now(),
            role: 'user',
            type: 'redpacket',
            content: '[红包]',
            redpacketCard: {
                amount: amount,
                message: message || '恭喜发财',
                fromAI: false,
                opened: false
            },
            timestamp: Date.now()
        };
        
        if (!ai.chatHistory) ai.chatHistory = [];
        ai.chatHistory.push(redpacketMessage);
        PhoneCore.saveAI(ai);
        
        // 记录到交易系统 - 用户发出红包
        PhoneCore.transactions.record({
            type: 'redpacket',
            amount: amount,
            from: userId,
            to: aiId,
            description: '发给 ' + ai.name + ' 的红包',
            appId: 'chat-app'
        });
        
        var messagesContainer = page.querySelector('#messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = this.renderMessages(aiId);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            this.bindMessageActions(page, aiId);
        }
        
        this.showToast('红包已发送');
        
        // AI通过API回复（AI可以选择是否领取红包）
        var self = this;
        
        // 显示正在输入状态
        var chatStatus = page.querySelector('#chat-status');
        if (chatStatus) {
            chatStatus.textContent = '正在输入...';
            chatStatus.style.color = '#007AFF';
        }
        
        // 设置AI状态为typing（聊天列表也会显示）
        ai.status = 'typing';
        PhoneCore.saveAI(ai);
        
        setTimeout(function() {
            self.getAIResponse(aiId, page);
        }, 1000 + Math.random() * 1500);
    };
    
    // AI领取用户发的红包（由AI通过特殊格式触发）
    ChatApp.prototype.aiOpenRedpacket = function(aiId, msgId) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return false;
        
        // 找到红包消息
        var msg = null;
        for (var i = 0; i < ai.chatHistory.length; i++) {
            var m = ai.chatHistory[i];
            if (m.redpacketCard && !m.redpacketCard.fromAI && !m.redpacketCard.opened) {
                msg = m;
                break;
            }
        }
        
        if (!msg) return false;
        
        var amount = msg.redpacketCard.amount;
        msg.redpacketCard.opened = true;
        msg.redpacketCard.openedAt = Date.now();
        
        // 增加AI资产
        ai.assets = (ai.assets || 0) + amount;
        
        // 添加到AI交易记录
        if (!ai.transactionHistory) ai.transactionHistory = [];
        ai.transactionHistory.push({
            type: 'income',
            name: '收到红包',
            amount: amount,
            from: 'user',
            timestamp: Date.now()
        });
        
        PhoneCore.saveAI(ai);
        this.refreshChatIfOpen(aiId);
        return true;
    };
    
    // 转账发送

// ================ chat.js 行 5844 ~ 5882 (AI 领红包,与上面发送区间重叠) ================
    ChatApp.prototype.aiOpenRedpacket = function(aiId, msgId) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return false;
        
        // 找到红包消息
        var msg = null;
        for (var i = 0; i < ai.chatHistory.length; i++) {
            var m = ai.chatHistory[i];
            if (m.redpacketCard && !m.redpacketCard.fromAI && !m.redpacketCard.opened) {
                msg = m;
                break;
            }
        }
        
        if (!msg) return false;
        
        var amount = msg.redpacketCard.amount;
        msg.redpacketCard.opened = true;
        msg.redpacketCard.openedAt = Date.now();
        
        // 增加AI资产
        ai.assets = (ai.assets || 0) + amount;
        
        // 添加到AI交易记录
        if (!ai.transactionHistory) ai.transactionHistory = [];
        ai.transactionHistory.push({
            type: 'income',
            name: '收到红包',
            amount: amount,
            from: 'user',
            timestamp: Date.now()
        });
        
        PhoneCore.saveAI(ai);
        this.refreshChatIfOpen(aiId);
        return true;
    };
    
    // 转账发送

```

