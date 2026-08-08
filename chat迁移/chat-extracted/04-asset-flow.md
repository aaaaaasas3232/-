# 04 — 资金流动计算(收款 / 扣款 / 交易记录)

> **chat.js 原始范围**:`5347–5987`(02 + 03 的全集) + `22038–22138`(钱包页 + 交易历史)
> 总长度 **约 740 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | 红包 / 转账的实际余额操作 | 全部位于 5347–5987(详见 `02-redpacket-card-click.md` / `03-transfer-card-click.md`)| 5347–5987 |
> | 钱包页 | `openWallet` / `loadWalletTransactions` | 22038, 22088 |
> | 交易历史页 | `openTransactionHistory` | 22139 |
>
> ## 核心数据
>
> - **用户资金**:`PhoneCore.user.balance` / `PhoneCore.user.transactionHistory`
> - **AI 资金**:`PhoneCore.getAI(id).balance` / `ai.transactionHistory`
> - **数据结构**:
>
> ```js
> {
>   id: 'tx-{ts}-{rand}',
>   type: 'send' | 'receive' | 'redpacket_send' | 'redpacket_receive' | 'transfer_send' | 'transfer_receive',
>   amount: 100,
>   currency: 'CNY',
>   fromId: 'ai-1', // 或 'user'
>   toId: 'user',
>   message: '恭喜发财', // 红包祝福语 / 转账备注
>   relatedMsgId: 'msg-xxx',
>   timestamp: 1700000000000
> }
> ```
>
> ## 关联
>
> - 入口(点击卡片):`02` / `03`
> - 触发(AI 指令):`08-call-parse-ai.md` 中 `parseAIResponse` 识别 `[发红包:..]` / `[转账:..]`
>
> ---
>
> 下面是 chat.js 5347–5987 + 22038–22138 的原始代码,未做精简。

```js
// ================ chat.js 行 5347 ~ 5987 ================
// ================ chat.js 行 5347 ~ 5987 ================
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
    ChatApp.prototype.rejectRedpacket = function(aiId, msgId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        var msg = self.findMessageByMsgId(aiId, msgId);
        if (!msg || !msg.redpacketCard) return;
        
        var amount = msg.redpacketCard.amount;
        msg.redpacketCard.rejected = true;
        msg.redpacketCard.rejectedAt = Date.now();
        
        // 添加系统消息通知AI用户拒绝了红包
        ai.chatHistory.push({
            id: 'sys_' + Date.now(),
            role: 'system',
            type: 'action_notify',
            content: '[用户拒绝领取你发的' + amount.toFixed(2) + '元红包]',
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
        
        this.showToast('已拒绝红包');
        
        // AI对用户拒绝红包做出反应
        setTimeout(function() {
            self.getAIResponse(aiId, page);
        }, 1000 + Math.random() * 1500);
    };
    
    // 接受转账
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

// ================ chat.js 行 22038 ~ 22138 (钱包 + 交易历史) ================
    ChatApp.prototype.openWallet = function() {
        var self = this;
        var mask = PhoneCore.user.getCurrentMask();
        var balance = mask ? (mask.balance || 0) : 0;
        var userId = mask ? mask.id : (PhoneCore.user.id || 'default');
        var userName = mask ? mask.name : (PhoneCore.user.name || '用户');
        
        var html = '<div style="padding:20px;background:linear-gradient(180deg,#F5FAF5 0%,#FFFFFF 100%);min-height:100%;">';
        
        // 余额卡片 - 更精美的设计
        html += '<div style="background:linear-gradient(135deg,#34C759 0%,#30D158 50%,#28C050 100%);border-radius:20px;padding:28px;color:white;margin-bottom:25px;box-shadow:0 8px 24px rgba(52,199,89,0.3);position:relative;overflow:hidden;">';
        // 装饰元素
        html += '<div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:rgba(255,255,255,0.1);border-radius:50%;"></div>';
        html += '<div style="position:absolute;bottom:-20px;left:20px;width:60px;height:60px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>';
        // 用户名
        html += '<div style="font-size:13px;opacity:0.8;margin-bottom:6px;">' + userName + ' 的钱包</div>';
        // 余额标签
        html += '<div style="font-size:12px;opacity:0.7;margin-bottom:8px;">账户余额</div>';
        // 余额数值
        html += '<div style="font-size:36px;font-weight:700;letter-spacing:-1px;text-shadow:0 2px 4px rgba(0,0,0,0.1);">¥ ' + balance.toFixed(2) + '</div>';
        // 钱包图标
        html += '<div style="position:absolute;top:20px;right:20px;opacity:0.2;"><svg width="48" height="48" viewBox="0 0 24 24" fill="white"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="16" cy="12" r="2"/></svg></div>';
        html += '</div>';
        
        // 交易记录标题
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#333;">交易记录</div>';
        html += '<div style="font-size:12px;color:#34C759;" id="refresh-transactions" style="cursor:pointer;">刷新</div>';
        html += '</div>';
        
        // 交易记录列表
        html += '<div id="transactions-list" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">加载中...</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html, { title: '钱包', backColor: '#34C759' });
        
        // 加载交易记录
        self.loadWalletTransactions(page, userId);
        
        // 绑定刷新按钮
        var refreshBtn = page.querySelector('#refresh-transactions');
        if (refreshBtn) {
            refreshBtn.onclick = function() {
                self.loadWalletTransactions(page, userId);
            };
        }
    };
    
    // 加载钱包交易记录
    ChatApp.prototype.loadWalletTransactions = function(page, userId) {
        var self = this;
        var container = page.querySelector('#transactions-list');
        if (!container) return;
        
        container.innerHTML = '<div style="padding:30px;text-align:center;color:#999;"><div class="loading-spinner" style="display:inline-block;width:24px;height:24px;border:2px solid #e0e0e0;border-top-color:#34C759;border-radius:50%;animation:spin 0.8s linear infinite;"></div><div style="margin-top:10px;font-size:13px;">加载中...</div></div>';
        
        // 尝试从数据库获取交易记录
        PhoneCore.transactions.getByUser(userId).then(function(transactions) {
            if (!transactions || transactions.length === 0) {
                container.innerHTML = '<div style="padding:50px 20px;text-align:center;">';
                container.innerHTML += '<svg width="48" height="48" viewBox="0 0 24 24" fill="#ccc" style="margin-bottom:12px;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z"/></svg>';
                container.innerHTML += '<div style="color:#999;font-size:14px;">暂无交易记录</div>';
                container.innerHTML += '<div style="color:#ccc;font-size:12px;margin-top:6px;">收发红包、转账后记录将显示在这里</div>';
                container.innerHTML += '</div>';
            } else {
                var html = '';
                transactions.sort(function(a, b) {
                    return b.timestamp - a.timestamp;
                }).forEach(function(trans, index) {
                    var isIncome = trans.to === userId || trans.type === 'income';
                    var icon = isIncome ? 
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="#34C759"><path d="M19 9l-7 7-7-7"/></svg>' :
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="#FF3B30"><path d="M5 15l7-7 7 7"/></svg>';
                    
                    html += '<div style="display:flex;align-items:center;padding:16px 20px;' + (index > 0 ? 'border-top:1px solid #f5f5f5;' : '') + '">';
                    // 图标
                    html += '<div style="width:40px;height:40px;background:' + (isIncome ? '#E8F5E9' : '#FFEBEE') + ';border-radius:10px;display:flex;align-items:center;justify-content:center;margin-right:14px;">' + icon + '</div>';
                    // 信息
                    html += '<div style="flex:1;">';
                    html += '<div style="font-weight:500;color:#333;font-size:14px;">' + (trans.description || (isIncome ? '收入' : '支出')) + '</div>';
                    html += '<div style="font-size:11px;color:#999;margin-top:4px;">' + new Date(trans.timestamp).toLocaleString() + '</div>';
                    html += '</div>';
                    // 金额
                    html += '<div style="font-size:16px;font-weight:600;color:' + (isIncome ? '#34C759' : '#FF3B30') + ';">';
                    html += (isIncome ? '+' : '-') + '¥' + Math.abs(trans.amount).toFixed(2);
                    html += '</div>';
                    html += '</div>';
                });
                container.innerHTML = html;
            }
        }).catch(function(err) {
            console.error('加载交易记录失败:', err);
            container.innerHTML = '<div style="padding:50px 20px;text-align:center;">';
            container.innerHTML += '<div style="color:#999;font-size:14px;">加载失败</div>';
            container.innerHTML += '<div style="color:#34C759;font-size:12px;margin-top:10px;cursor:pointer;" onclick="this.parentElement.parentElement.innerHTML=\'重新加载中...\'">点击重试</div>';
            container.innerHTML += '</div>';
        });
    };

    // 交易记录

```

