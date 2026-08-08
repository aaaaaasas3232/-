# 03 — 点击转账卡片(收款 / 退回 / 发送)

> **chat.js 原始范围**:`5552–5755`(接收/确认/退回) + `5883–5987`(转账发送) + `5949–5987`(AI 收款)
> 总长度 **约 145 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | 收款 | `acceptTransfer` / `showTransferOptions` / `confirmAcceptTransfer` / `returnTransfer` | 5552, 5589, 5635, 5715 |
> | 转账发送入口 | `openTransferSend` | 5883 |
> | AI 收款 | `aiAcceptTransfer` | 5949 |
>
> ## 关联
>
> 卡片 HTML 渲染在 `renderMessages` 内联字符串里 — `[转账:金额:备注]` 由 `parseAIResponse`(7925,详见 `08-call-parse-ai.md`)识别。
>
> 资金扣减/入账规则详见 `04-asset-flow.md`。
>
> ---
>
> 下面是 chat.js 5552–5755 + 5883–5987 的原始代码,未做精简。

```js
// ================ chat.js 行 5552 ~ 5755 ================
// ================ chat.js 行 5552 ~ 5755 ================
    ChatApp.prototype.acceptTransfer = function(aiId, msgId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        var msg = self.findMessageByMsgId(aiId, msgId);
        if (!msg || !msg.transferCard) return;
        
        if (msg.transferCard.accepted) {
            this.showToast('转账已收款');
            return;
        }
        
        if (msg.transferCard.returned) {
            this.showToast('转账已退回');
            return;
        }
        
        if (!msg.transferCard.fromAI) {
            this.showToast('这是你发的转账');
            return;
        }
        
        var amount = msg.transferCard.amount;
        var aiAssets = ai.assets || 0;
        
        // 验证AI资产是否足够
        if (aiAssets < amount) {
            this.showToast('对方余额不足');
            return;
        }
        
        // 显示转账操作选项
        this.showTransferOptions(aiId, msgId, page, amount);
    };
    
    // 显示转账操作选项
    ChatApp.prototype.showTransferOptions = function(aiId, msgId, page, amount) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        
        // 获取手机屏幕容器
        var phoneScreen = document.getElementById('phone-screen');
        if (!phoneScreen) phoneScreen = document.body;
        
        // 创建选项弹窗（定位到手机屏幕内）
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
        
        var dialog = document.createElement('div');
        dialog.style.cssText = 'background:white;border-radius:16px;padding:24px;width:260px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.15);';
        dialog.innerHTML = '<div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">转账</div>' +
            '<div style="font-size:32px;font-weight:700;color:#4A9EF7;margin:16px 0;">¥' + amount.toFixed(2) + '</div>' +
            '<div style="font-size:13px;color:#999;margin-bottom:20px;">来自 ' + ai.name + ' 的转账</div>' +
            '<div style="display:flex;gap:12px;">' +
            '<button id="return-transfer" style="flex:1;padding:12px;border:1px solid #ddd;background:white;border-radius:8px;font-size:15px;color:#666;cursor:pointer;">退回</button>' +
            '<button id="accept-transfer" style="flex:1;padding:12px;border:none;background:linear-gradient(135deg,#6BB5FF,#4A9EF7);border-radius:8px;font-size:15px;color:white;cursor:pointer;">收款</button>' +
            '</div>';
        
        overlay.appendChild(dialog);
        phoneScreen.appendChild(overlay);
        
        // 点击遮罩关闭
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
        
        // 退回
        dialog.querySelector('#return-transfer').onclick = function() {
            overlay.remove();
            self.returnTransfer(aiId, msgId, page);
        };
        
        // 收款
        dialog.querySelector('#accept-transfer').onclick = function() {
            overlay.remove();
            self.confirmAcceptTransfer(aiId, msgId, page);
        };
    };
    
    // 确认收款
    ChatApp.prototype.confirmAcceptTransfer = function(aiId, msgId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        var msg = self.findMessageByMsgId(aiId, msgId);
        if (!msg || !msg.transferCard) return;
        
        var amount = msg.transferCard.amount;
        var aiAssets = ai.assets || 0;
        
        // 再次验证AI资产
        if (aiAssets < amount) {
            this.showToast('对方余额不足');
            return;
        }
        
        msg.transferCard.accepted = true;
        msg.transferCard.acceptedAt = Date.now();
        
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
            name: '转账给用户',
            amount: amount,
            to: 'user',
            timestamp: Date.now()
        });
        
        // 记录到交易系统
        PhoneCore.transactions.record({
            type: 'transfer',
            amount: amount,
            from: aiId,
            to: userId,
            description: ai.name + ' 的转账',
            appId: 'chat-app'
        });
        
        // 添加系统消息通知AI用户收了转账
        ai.chatHistory.push({
            id: 'sys_' + Date.now(),
            role: 'system',
            type: 'action_notify',
            content: '[用户收取了你发的' + amount.toFixed(2) + '元转账]',
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
        
        this.showToast('已收款 ¥' + amount.toFixed(2));
        
        // AI对用户收款转账做出反应
        setTimeout(function() {
            self.getAIResponse(aiId, page);
        }, 1000 + Math.random() * 1500);
    };
    
    // 退回转账
    ChatApp.prototype.returnTransfer = function(aiId, msgId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        var msg = self.findMessageByMsgId(aiId, msgId);
        if (!msg || !msg.transferCard) return;
        
        var amount = msg.transferCard.amount;
        msg.transferCard.returned = true;
        msg.transferCard.returnedAt = Date.now();
        
        // 添加系统消息通知AI用户退回了转账
        ai.chatHistory.push({
            id: 'sys_' + Date.now(),
            role: 'system',
            type: 'action_notify',
            content: '[用户退回了你发的' + amount.toFixed(2) + '元转账]',
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
        
        this.showToast('已退回转账');
        
        // AI对用户退回转账做出反应
        setTimeout(function() {
            self.getAIResponse(aiId, page);
        }, 1000 + Math.random() * 1500);
    };
    
    // 红包发送

// ================ chat.js 行 5883 ~ 5987 ================
    ChatApp.prototype.openTransferSend = function(aiId, page) {
        var self = this;
        var mask = PhoneCore.user.getCurrentMask();
        var balance = mask ? mask.balance : 0;
        var userId = mask ? mask.id : 'default';
        
        var amount = prompt('输入转账金额（余额: ¥' + balance.toFixed(2) + '）:', '100');
        if (amount !== null && !isNaN(parseFloat(amount))) {
            var amountNum = parseFloat(amount);
            if (amountNum > balance) {
                this.showToast('余额不足');
                return;
            }
            
            if (mask) {
                mask.balance -= amountNum;
            }
            
            var ai = PhoneCore.getAI(aiId);
            if (!ai) return;
            
            var transferMessage = {
                id: 'msg_' + Date.now(),
                role: 'user',
                type: 'transfer',
                content: '[转账]',
                transferCard: {
                    amount: amountNum,
                    fromAI: false,
                    accepted: false
                },
                timestamp: Date.now()
            };
            
            if (!ai.chatHistory) ai.chatHistory = [];
            ai.chatHistory.push(transferMessage);
            PhoneCore.saveAI(ai);
            
            // 记录到交易系统 - 用户发出转账
            PhoneCore.transactions.record({
                type: 'transfer',
                amount: amountNum,
                from: userId,
                to: aiId,
                description: '转账给 ' + ai.name,
                appId: 'chat-app'
            });
            
            var messagesContainer = page.querySelector('#messages-container');
            if (messagesContainer) {
                messagesContainer.innerHTML = this.renderMessages(aiId);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                this.bindMessageActions(page, aiId);
            }
            
            this.showToast('转账已发送');
            
            // AI通过API回复（AI可以选择是否接收转账）
            var self = this;
            setTimeout(function() {
                self.getAIResponse(aiId, page);
            }, 1000 + Math.random() * 1500);
        }
    };
    
    // AI接收用户发的转账（由AI通过特殊格式触发）
    ChatApp.prototype.aiAcceptTransfer = function(aiId) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return false;
        
        // 找到未接收的转账消息
        var msg = null;
        for (var i = 0; i < ai.chatHistory.length; i++) {
            var m = ai.chatHistory[i];
            if (m.transferCard && !m.transferCard.fromAI && !m.transferCard.accepted) {
                msg = m;
                break;
            }
        }
        
        if (!msg) return false;
        
        var amount = msg.transferCard.amount;
        msg.transferCard.accepted = true;
        msg.transferCard.acceptedAt = Date.now();
        
        // 增加AI资产
        ai.assets = (ai.assets || 0) + amount;
        
        // 添加到AI交易记录
        if (!ai.transactionHistory) ai.transactionHistory = [];
        ai.transactionHistory.push({
            type: 'income',
            name: '收到转账',
            amount: amount,
            from: 'user',
            timestamp: Date.now()
        });
        
        PhoneCore.saveAI(ai);
        this.refreshChatIfOpen(aiId);
        return true;
    };
    
    // Toast提示

// ================ chat.js 行 5949 ~ 5987 (AI 收款,与上面发送区间重叠) ================
    ChatApp.prototype.aiAcceptTransfer = function(aiId) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return false;
        
        // 找到未接收的转账消息
        var msg = null;
        for (var i = 0; i < ai.chatHistory.length; i++) {
            var m = ai.chatHistory[i];
            if (m.transferCard && !m.transferCard.fromAI && !m.transferCard.accepted) {
                msg = m;
                break;
            }
        }
        
        if (!msg) return false;
        
        var amount = msg.transferCard.amount;
        msg.transferCard.accepted = true;
        msg.transferCard.acceptedAt = Date.now();
        
        // 增加AI资产
        ai.assets = (ai.assets || 0) + amount;
        
        // 添加到AI交易记录
        if (!ai.transactionHistory) ai.transactionHistory = [];
        ai.transactionHistory.push({
            type: 'income',
            name: '收到转账',
            amount: amount,
            from: 'user',
            timestamp: Date.now()
        });
        
        PhoneCore.saveAI(ai);
        this.refreshChatIfOpen(aiId);
        return true;
    };
    
    // Toast提示

```

