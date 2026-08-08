/**
 * ==========================================
 * 【小游戏 - 狼人杀】
 * ==========================================
 * 
 * 从 chat.js 中剪切狼人杀相关代码到这里
 * 搜索关键词：werewolf、狼人
 */

// ========== 在下面粘贴狼人杀代码 ==========
    // 狼人杀本子配置
    ChatApp.prototype.werewolfConfigs = {
        // 4人本 - 入门
        '4': {
            name: '4人入门局',
            roles: { wolf: 1, villager: 2, seer: 1 },
            description: '1狼1预言家2村民'
        },
        // 5人本
        '5': {
            name: '5人基础局',
            roles: { wolf: 1, villager: 2, seer: 1, witch: 1 },
            description: '1狼1预言家1女巫2村民'
        },
        // 6人本
        '6': {
            name: '6人标准局',
            roles: { wolf: 2, villager: 2, seer: 1, witch: 1 },
            description: '2狼1预言家1女巫2村民'
        },
        // 7人本
        '7': {
            name: '7人经典局',
            roles: { wolf: 2, villager: 2, seer: 1, witch: 1, hunter: 1 },
            description: '2狼1预言家1女巫1猎人2村民'
        },
        // 8人本
        '8': {
            name: '8人进阶局',
            roles: { wolf: 2, villager: 3, seer: 1, witch: 1, hunter: 1 },
            description: '2狼1预言家1女巫1猎人3村民'
        },
        // 9人本
        '9': {
            name: '9人标准局',
            roles: { wolf: 3, villager: 3, seer: 1, witch: 1, hunter: 1 },
            description: '3狼1预言家1女巫1猎人3村民'
        },
        // 10人本 - 加入丘比特
        '10': {
            name: '10人丘比特局',
            roles: { wolf: 3, villager: 3, seer: 1, witch: 1, hunter: 1, cupid: 1 },
            description: '3狼1预言家1女巫1猎人1丘比特3村民'
        },
        // 11人本
        '11': {
            name: '11人守卫局',
            roles: { wolf: 3, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 },
            description: '3狼1预言家1女巫1猎人1守卫4村民'
        },
        // 12人本 - 完整版
        '12': {
            name: '12人完整局',
            roles: { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, cupid: 1 },
            description: '4狼1预言家1女巫1猎人1丘比特4村民'
        }
    };
    
    // 角色信息
    ChatApp.prototype.werewolfRoles = {
        wolf: {
            name: '狼人',
            team: 'wolf',
            color: '#e74c3c',
            icon: '',
            description: '每晚可以杀死一名玩家，知道同伴身份'
        },
        villager: {
            name: '村民',
            team: 'village',
            color: '#27ae60',
            icon: '',
            description: '普通村民，依靠推理找出狼人'
        },
        seer: {
            name: '预言家',
            team: 'village',
            color: '#9b59b6',
            icon: '',
            description: '每晚可以查验一名玩家的身份'
        },
        witch: {
            name: '女巫',
            team: 'village',
            color: '#8e44ad',
            icon: '',
            description: '有一瓶解药可救人，一瓶毒药可杀人'
        },
        hunter: {
            name: '猎人',
            team: 'village',
            color: '#e67e22',
            icon: '',
            description: '死亡时可以开枪带走一名玩家'
        },
        cupid: {
            name: '丘比特',
            team: 'village',
            color: '#e91e63',
            icon: '',
            description: '游戏开始时连接两名玩家，一死俱死'
        },
        guard: {
            name: '守卫',
            team: 'village',
            color: '#3498db',
            icon: '',
            description: '每晚可以守护一名玩家免受狼人攻击'
        }
    };
    
    // 获取用户在游戏中的显示名称（优先使用群昵称/人设名，避免显示"我"让AI混淆）
    ChatApp.prototype.getUserGameName = function(groupId) {
        // 优先级：群昵称 > 人设名 > 用户名 > 默认名
        var displayName = null;
        
        // 1. 尝试获取群昵称
        if (groupId && PhoneCore.user && PhoneCore.user.groupNicknames) {
            displayName = PhoneCore.user.groupNicknames[groupId];
        }
        
        // 2. 尝试获取当前人设名
        if (!displayName && PhoneCore.user) {
            var currentMask = PhoneCore.user.getCurrentMask ? PhoneCore.user.getCurrentMask() : null;
            if (currentMask && currentMask.name) {
                displayName = currentMask.name;
            }
        }
        
        // 3. 使用用户名
        if (!displayName && PhoneCore.user && PhoneCore.user.name) {
            displayName = PhoneCore.user.name;
        }
        
        // 4. 最后才用默认名称（但尽量避免用"我"）
        return displayName || '玩家';
    };
    
    // 狼人杀游戏设置页面
    ChatApp.prototype.openWerewolfSetup = function(groupId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        // 【修复】检查是否已有正在进行的游戏
        // 如果有未结束的游戏且是同一群聊，应该恢复游戏而不是开始新游戏
        if (this.currentGame && this.currentGame.groupId === groupId && 
            this.currentGame.phase !== 'ended') {
            // 恢复游戏
            this.resumeWerewolfGame();
            return;
        }
        
        // 如果有已结束的游戏或其他群聊的游戏，清理它
        if (this.currentGame) {
            this.currentGame = null;
            this.gamePageElement = null;
        }
        
        var memberCount = group.members.length;
        var availableConfigs = [];
        
        // 获取可用的本子（人数 <= 成员数+1，因为用户也可以参与）
        for (var num in this.werewolfConfigs) {
            if (parseInt(num) <= memberCount + 1) {
                availableConfigs.push({
                    playerCount: parseInt(num),
                    config: this.werewolfConfigs[num]
                });
            }
        }
        
        if (availableConfigs.length === 0) {
            PhoneCore.notifications.send({
                type: 'warning',
                title: '人数不足',
                message: '狼人杀至少需要4人参与',
                size: 'mini'
            });
            return;
        }
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#F0F7FF 100%);min-height:100%;">';
        
        // 标题
        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#3A5A80;margin-bottom:6px;">狼人杀</div>';
        html += '<div style="font-size:11px;color:#7A9BBF;">群内有 ' + memberCount + ' 名成员</div>';
        html += '</div>';
        
        // 选择本子
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">选择本子</div>';
        html += '<div id="config-selector" style="display:flex;flex-wrap:wrap;gap:6px;">';
        
        availableConfigs.forEach(function(item, index) {
            var isDefault = index === availableConfigs.length - 1;
            html += '<button class="config-btn' + (isDefault ? ' active' : '') + '" data-count="' + item.playerCount + '" style="padding:8px 14px;background:' + (isDefault ? '#4A6FA5' : 'white') + ';border:1px solid ' + (isDefault ? '#A8C8EC' : '#D6E4FF') + ';border-radius:8px;color:' + (isDefault ? 'white' : '#4A6FA5') + ';font-size:11px;cursor:pointer;transition:all 0.2s;">';
            html += item.playerCount + '人';
            html += '</button>';
        });
        
        html += '</div>';
        html += '<div id="config-desc" style="margin-top:8px;padding:10px;background:rgba(168,200,236,0.15);border-radius:8px;color:#7A9BBF;font-size:10px;">';
        var defaultConfig = availableConfigs[availableConfigs.length - 1];
        html += defaultConfig.config.description;
        html += '</div>';
        html += '</div>';
        
        // API配置选择
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">AI模型配置</div>';
        html += '<select id="game-api-select" style="width:100%;padding:10px 12px;background:white;border:1px solid #D6E4FF;border-radius:8px;color:#3A5A80;font-size:12px;cursor:pointer;outline:none;">';
        
        // 获取所有可用的API配置
        if (PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            if (configIds.length === 0) {
                html += '<option value="">未配置API</option>';
            } else {
                configIds.forEach(function(configId) {
                    var config = PhoneCore.api.configs[configId];
                    var displayName = config.name || config.model || configId;
                    html += '<option value="' + configId + '">' + displayName + '</option>';
                });
            }
        } else {
            html += '<option value="">未配置API</option>';
        }
        
        html += '</select>';
        html += '<div style="font-size:10px;color:#A8C8EC;margin-top:6px;">选择游戏中AI使用的模型配置</div>';
        html += '</div>';
        
        // 参与模式
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">参与模式</div>';
        html += '<div style="display:flex;gap:8px;">';
        html += '<button id="mode-player" class="mode-btn active" style="flex:1;padding:12px;background:#4A6FA5;border:1px solid #A8C8EC;border-radius:10px;color:white;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="font-size:12px;font-weight:600;">玩家模式</div>';
        html += '<div style="font-size:10px;opacity:0.8;margin-top:3px;">参与游戏获得身份</div>';
        html += '</button>';
        html += '<button id="mode-god" class="mode-btn" style="flex:1;padding:12px;background:white;border:1px solid #D6E4FF;border-radius:10px;color:#4A6FA5;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="font-size:12px;font-weight:600;">上帝视角</div>';
        html += '<div style="font-size:10px;opacity:0.7;margin-top:3px;">观战全部流程</div>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        
        // 提示词管理入口
        var werewolfPrompts = group.werewolfPrompts || {};
        var hasSystemPrompt = werewolfPrompts.systemPrompt && werewolfPrompts.systemPrompt.trim();
        var relationCount = (werewolfPrompts.relations || []).length;
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">提示词设置</div>';
        html += '<div id="werewolf-prompts-btn" style="display:flex;align-items:center;padding:12px;background:white;border:1px solid #D6E4FF;border-radius:10px;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#A8C8EC,#D6E4FF);border-radius:10px;display:flex;align-items:center;justify-content:center;margin-right:12px;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="#4A6FA5"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:13px;font-weight:500;color:#3A5A80;">提示词管理</div>';
        html += '<div style="font-size:10px;color:#7A9BBF;margin-top:2px;">';
        if (hasSystemPrompt || relationCount > 0) {
            var statusParts = [];
            if (hasSystemPrompt) statusParts.push('已设系统提示词');
            if (relationCount > 0) statusParts.push(relationCount + '个关系设定');
            html += statusParts.join(' / ');
        } else {
            html += '自定义AI行为和角色关系';
        }
        html += '</div>';
        html += '</div>';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
        html += '</div>';
        html += '</div>';
        
        // 选择参与的AI（玩家模式）
        html += '<div id="player-selection" style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">选择参与者 <span id="selected-count" style="color:#7A9BBF;">(需选择 ' + (defaultConfig.playerCount - 1) + ' 人)</span></div>';
        html += '<div id="ai-list" style="max-height:180px;overflow-y:auto;">';
        
        group.members.forEach(function(memberId, index) {
            var ai = PhoneCore.getAI(memberId);
            if (!ai) return;
            
            var isSelected = index < defaultConfig.playerCount - 1;
            html += '<label class="ai-checkbox" style="display:flex;align-items:center;padding:8px 10px;background:' + (isSelected ? 'rgba(74,111,165,0.15)' : 'white') + ';border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all 0.2s;border:1px solid ' + (isSelected ? '#A8C8EC' : '#E9ECEF') + ';">';
            html += '<input type="checkbox" name="ai-player" value="' + memberId + '" ' + (isSelected ? 'checked' : '') + ' style="display:none;">';
            html += '<div style="width:30px;height:30px;border-radius:50%;background:' + self.getAvatarColor(memberId) + ';margin-right:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += ai.name.charAt(0);
            }
            html += '</div>';
            html += '<div style="flex:1;color:#3A5A80;font-size:12px;">' + ai.name + '</div>';
            html += '<div class="check-icon" style="width:18px;height:18px;border-radius:50%;background:' + (isSelected ? '#4A6FA5' : '#E9ECEF') + ';display:flex;align-items:center;justify-content:center;">';
            html += '<span class="check-mark" style="opacity:' + (isSelected ? '1' : '0') + ';font-size:10px;color:#4A6FA5;">✓</span>';
            html += '</div>';
            html += '</label>';
        });
        
        html += '</div>';
        html += '</div>';
        
        // 开始游戏按钮
        html += '<button id="start-game-btn" style="width:100%;padding:12px;background:linear-gradient(135deg,#4A6FA5,#5A8FBF);border:none;border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(74,111,165,0.3);">';
        html += '开始游戏';
        html += '</button>';
        
        html += '</div>';
        
        var setupPage = this.openDetailPage(html, { title: '游戏设置', titleColor: '#4A6FA5', bgColor: '#E8F4FF' });
        
        var selectedConfig = defaultConfig.playerCount;
        var isGodMode = false;
        
        // 本子选择
        setupPage.querySelectorAll('.config-btn').forEach(function(btn) {
            btn.onclick = function() {
                setupPage.querySelectorAll('.config-btn').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.background = 'white';
                    b.style.borderColor = '#D6E4FF';
                    b.style.color = '#4A6FA5';
                });
                btn.classList.add('active');
                btn.style.background = '#4A6FA5';
                btn.style.borderColor = '#A8C8EC';
                btn.style.color = 'white';
                
                selectedConfig = parseInt(btn.getAttribute('data-count'));
                var config = self.werewolfConfigs[selectedConfig];
                setupPage.querySelector('#config-desc').textContent = config.description;
                setupPage.querySelector('#selected-count').textContent = '(需选择 ' + (selectedConfig - (isGodMode ? 0 : 1)) + ' 人)';
                
                // 更新选择状态
                updateAISelection();
            };
        });
        
        // 模式切换
        var playerModeBtn = setupPage.querySelector('#mode-player');
        var godModeBtn = setupPage.querySelector('#mode-god');
        var playerSelection = setupPage.querySelector('#player-selection');
        
        playerModeBtn.onclick = function() {
            isGodMode = false;
            playerModeBtn.classList.add('active');
            playerModeBtn.style.background = '#4A6FA5';
            playerModeBtn.style.borderColor = '#A8C8EC';
            playerModeBtn.style.color = 'white';
            godModeBtn.classList.remove('active');
            godModeBtn.style.background = 'white';
            godModeBtn.style.borderColor = '#D6E4FF';
            godModeBtn.style.color = '#4A6FA5';
            setupPage.querySelector('#selected-count').textContent = '(需选择 ' + (selectedConfig - 1) + ' 人)';
            updateAISelection();
        };
        
        godModeBtn.onclick = function() {
            isGodMode = true;
            godModeBtn.classList.add('active');
            godModeBtn.style.background = '#4A6FA5';
            godModeBtn.style.borderColor = '#A8C8EC';
            godModeBtn.style.color = 'white';
            playerModeBtn.classList.remove('active');
            playerModeBtn.style.background = 'white';
            playerModeBtn.style.borderColor = '#D6E4FF';
            playerModeBtn.style.color = '#4A6FA5';
            setupPage.querySelector('#selected-count').textContent = '(需选择 ' + selectedConfig + ' 人)';
            updateAISelection();
        };
        
        // AI选择
        function updateAISelection() {
            var requiredCount = selectedConfig - (isGodMode ? 0 : 1);
            var checkboxes = setupPage.querySelectorAll('input[name="ai-player"]');
            var checkedCount = 0;
            
            checkboxes.forEach(function(cb, index) {
                var label = cb.closest('.ai-checkbox');
                if (index < requiredCount) {
                    cb.checked = true;
                    label.style.background = 'rgba(74,111,165,0.15)';
                    label.style.borderColor = '#A8C8EC';
                    label.querySelector('.check-icon').style.background = '#4A6FA5';
                    label.querySelector('.check-mark').style.opacity = '1';
                } else {
                    cb.checked = false;
                    label.style.background = 'white';
                    label.style.borderColor = '#E9ECEF';
                    label.querySelector('.check-icon').style.background = '#E9ECEF';
                    label.querySelector('.check-mark').style.opacity = '0';
                }
            });
        }
        
        setupPage.querySelectorAll('.ai-checkbox').forEach(function(label) {
            label.onclick = function(e) {
                e.preventDefault();
                var checkbox = label.querySelector('input');
                var requiredCount = selectedConfig - (isGodMode ? 0 : 1);
                var currentChecked = setupPage.querySelectorAll('input[name="ai-player"]:checked').length;
                
                if (checkbox.checked) {
                    checkbox.checked = false;
                    label.style.background = 'white';
                    label.style.borderColor = '#E9ECEF';
                    label.querySelector('.check-icon').style.background = '#E9ECEF';
                    label.querySelector('.check-mark').style.opacity = '0';
                } else if (currentChecked < requiredCount) {
                    checkbox.checked = true;
                    label.style.background = 'rgba(74,111,165,0.15)';
                    label.style.borderColor = '#A8C8EC';
                    label.querySelector('.check-icon').style.background = '#4A6FA5';
                    label.querySelector('.check-mark').style.opacity = '1';
                }
            };
        });
        
        // 提示词管理按钮
        var promptsBtn = setupPage.querySelector('#werewolf-prompts-btn');
        if (promptsBtn) {
            promptsBtn.onclick = function() {
                self.openWerewolfPromptsManager(groupId);
            };
        }
        
        // 开始游戏
        setupPage.querySelector('#start-game-btn').onclick = function() {
            var selectedAIs = [];
            setupPage.querySelectorAll('input[name="ai-player"]:checked').forEach(function(cb) {
                selectedAIs.push(cb.value);
            });
            
            var requiredCount = selectedConfig - (isGodMode ? 0 : 1);
            if (selectedAIs.length !== requiredCount) {
                PhoneCore.notifications.send({
                    type: 'warning',
                    title: '人数不符',
                    message: '请选择 ' + requiredCount + ' 名AI参与游戏',
                    size: 'mini'
                });
                return;
            }
            
            // 获取选择的API配置
            var apiSelect = setupPage.querySelector('#game-api-select');
            var selectedApiConfig = apiSelect ? apiSelect.value : null;
            
            // 关闭设置页面，打开游戏界面
            setupPage.querySelector('.app-back-btn').click();
            setTimeout(function() {
                self.startWerewolfGame(groupId, selectedConfig, selectedAIs, isGodMode, selectedApiConfig);
            }, 350);
        };
    };
    
    // 开始狼人杀游戏
    ChatApp.prototype.startWerewolfGame = function(groupId, playerCount, selectedAIs, isGodMode, apiConfigId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        var config = this.werewolfConfigs[playerCount];
        if (!config) return;
        
        // 初始化游戏状态
        this.currentGame = {
            id: 'game_' + Date.now(),
            groupId: groupId,
            type: 'werewolf',
            playerCount: playerCount,
            config: config,
            isGodMode: isGodMode,
            apiConfigId: apiConfigId, // 游戏使用的API配置
            players: [],
            alivePlayers: [],
            deadPlayers: [],
            round: 0,
            phase: 'night', // night, day_speech, day_vote
            currentSpeaker: 0,
            speechOrder: [], // 发言顺序（每轮随机）
            gameLog: [],
            chatHistory: [],
            lovers: [], // 丘比特连接的情侣
            guardedPlayer: null, // 守卫守护的玩家
            witchSaveUsed: false,
            witchPoisonUsed: false,
            nightKillTarget: null,
            startTime: Date.now(),
            pendingUserAction: null, // 【修复】追踪等待的用户操作，用于恢复游戏时显示正确界面
            werewolfPrompts: group.werewolfPrompts || null // 【提示词管理】加载自定义提示词配置
        };
        
        // 分配角色
        var roles = [];
        for (var roleName in config.roles) {
            for (var i = 0; i < config.roles[roleName]; i++) {
                roles.push(roleName);
            }
        }
        
        // 洗牌
        for (var i = roles.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = roles[i];
            roles[i] = roles[j];
            roles[j] = temp;
        }
        
        // 分配给玩家
        var playerIndex = 0;
        
        // 用户玩家（如果不是上帝模式）
        if (!isGodMode) {
            this.currentGame.players.push({
                id: 'user',
                name: this.getUserGameName(groupId),
                isUser: true,
                role: roles[playerIndex],
                isAlive: true,
                seatNumber: 0 // 稍后随机分配
            });
            playerIndex++;
        }
        
        // AI玩家
        selectedAIs.forEach(function(aiId) {
            var ai = PhoneCore.getAI(aiId);
            if (ai) {
                self.currentGame.players.push({
                    id: aiId,
                    name: ai.name,
                    isUser: false,
                    role: roles[playerIndex],
                    isAlive: true,
                    seatNumber: 0, // 稍后随机分配
                    personality: ai.personality || ''
                });
                playerIndex++;
            }
        });
        
        // 随机分配座位号
        var seatNumbers = [];
        for (var i = 1; i <= this.currentGame.players.length; i++) {
            seatNumbers.push(i);
        }
        // Fisher-Yates 洗牌座位号
        for (var i = seatNumbers.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = seatNumbers[i];
            seatNumbers[i] = seatNumbers[j];
            seatNumbers[j] = temp;
        }
        // 分配座位号给玩家
        this.currentGame.players.forEach(function(p, idx) {
            p.seatNumber = seatNumbers[idx];
        });
        
        // 设置存活玩家
        this.currentGame.alivePlayers = this.currentGame.players.map(function(p) { return p.id; });
        
        // 获取群聊上下文（前10句）
        var groupContext = [];
        if (group.chatHistory && group.chatHistory.length > 0) {
            var recentMsgs = group.chatHistory.filter(function(msg) {
                return msg.type !== 'system' && msg.role !== 'system';
            }).slice(-10);
            
            recentMsgs.forEach(function(msg) {
                groupContext.push({
                    sender: msg.senderName || (msg.role === 'user' ? '用户' : '未知'),
                    content: msg.content || ''
                });
            });
        }
        this.currentGame.groupContext = groupContext;
        
        // 打开游戏界面
        this.openWerewolfGameUI();
    };
    
    // 狼人杀游戏界面
    ChatApp.prototype.openWerewolfGameUI = function() {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        var html = '<div class="werewolf-game" style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,#E8F4FF 0%,#D4E9FF 50%,#C5DFFF 100%);display:flex;flex-direction:column;overflow:hidden;">';
        
        // 顶部状态栏
        html += '<div class="game-header" style="padding:10px 14px;background:linear-gradient(90deg,#4A90D9,#5A9FE8);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.2);box-shadow:0 2px 8px rgba(74,144,217,0.2);">';
        html += '<div style="display:flex;gap:6px;">';
        html += '<button id="game-back-btn" style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-size:14px;color:white;" title="退出游戏">';
        html += '←';
        html += '</button>';
        html += '<button id="game-minimize-btn" style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-size:12px;color:white;" title="最小化（游戏继续，轮到你时会通知）">';
        html += '−';
        html += '</button>';
        html += '</div>';
        html += '<div style="text-align:center;">';
        html += '<div id="game-phase" style="font-size:13px;font-weight:600;color:#fff;">狼人杀</div>';
        html += '<div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">';
        html += '<span id="game-round">第 ' + game.round + ' 轮</span>';
        html += '<span style="margin:0 6px;opacity:0.3;">|</span>';
        html += '<span id="alive-count">存活 ' + game.alivePlayers.length + '/' + game.players.length + ' 人</span>';
        html += '</div>';
        html += '</div>';
        html += '<button id="game-info-btn" style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-size:14px;color:white;">';
        html += 'i';
        html += '</button>';
        html += '</div>';
        
        // 发言顺序显示区域（白天发言阶段显示）
        html += '<div id="speech-order-bar" style="display:none;padding:8px 12px;background:rgba(255,255,255,0.9);border-bottom:1px solid rgba(74,144,217,0.1);">';
        html += '<div style="font-size:10px;color:#5A8FBF;margin-bottom:6px;">发言顺序</div>';
        html += '<div id="speech-order-list" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;"></div>';
        html += '</div>';
        
        // 玩家身份区域
        html += '<div id="player-role-area" style="padding:12px;text-align:center;background:rgba(255,255,255,0.3);margin:8px 12px;border-radius:12px;box-shadow:0 2px 8px rgba(74,144,217,0.1);">';
        html += this.renderPlayerRoleCard(game);
        html += '</div>';
        
        // 聊天消息区域
        html += '<div id="game-messages" style="flex:1;overflow-y:auto;padding:0 12px;">';
        html += this.renderGameMessages();
        html += '</div>';
        
        // 操作区域
        html += '<div id="game-actions" style="padding:12px;background:linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.95));border-top:1px solid rgba(74,144,217,0.15);box-shadow:0 -2px 8px rgba(74,144,217,0.1);">';
        html += this.renderGameActions();
        html += '</div>';
        
        html += '</div>';
        
        // 样式
        html += '<style>';
        html += '.werewolf-game .msg-bubble { max-width:80%;padding:8px 12px;border-radius:10px;margin:4px 0;font-size:12px;box-shadow:0 1px 4px rgba(74,144,217,0.1); }';
        html += '.werewolf-game .msg-system { text-align:center;color:#5A8FBF;font-size:10px;margin:10px 0;font-weight:500; }';
        html += '.werewolf-game .msg-ai { background:white;color:#3A5A80;margin-right:auto;border:1px solid rgba(74,144,217,0.15); }';
        html += '.werewolf-game .msg-user { background:linear-gradient(135deg,#4A90D9,#5A9FE8);color:white;margin-left:auto; }';
        html += '.werewolf-game .msg-new { animation:msgFadeIn 0.3s ease; }';
        html += '@keyframes msgFadeIn { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }';
        html += '@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }';
        html += '</style>';
        
        var gamePage = this.openDetailPage(html, { 
            enableHomeIndicator: false,
            fullscreen: true
        });
        
        this.gamePageElement = gamePage;
        
        // 隐藏默认返回按钮
        var defaultBack = gamePage.querySelector('.app-back-btn');
        if (defaultBack) defaultBack.style.display = 'none';
        
        // 绑定事件
        this.bindGameEvents(gamePage);
        
        // 【修复】只有新游戏才开始游戏流程
        // 如果 round > 0 表示游戏已经在进行中（从最小化恢复），不需要重新开始
        if (game.round === 0) {
            setTimeout(function() {
                self.runGamePhase();
            }, 500);
        } else if (game.pendingUserAction) {
            // 【修复】恢复游戏时，如果有等待的用户操作，重新显示操作界面
            setTimeout(function() {
                self.restorePendingUserAction();
            }, 100);
        }
    };
    
    // 【修复】恢复等待的用户操作界面
    ChatApp.prototype.restorePendingUserAction = function() {
        var self = this;
        var game = this.currentGame;
        if (!game || !game.pendingUserAction) return;
        
        var action = game.pendingUserAction;
        var data = game.pendingActionData || {};
        
        // 根据操作类型恢复相应的界面
        // 注意：这些函数需要 targets 数组，我们从 pendingActionData 中恢复
        var getTargetPlayers = function(targetIds) {
            if (!targetIds) return [];
            return game.players.filter(function(p) { 
                return targetIds.includes(p.id) && p.isAlive; 
            });
        };
        
        // 创建夜晚行动回调（继续到下一个行动）
        var createNightCallback = function() {
            var actions = game._pendingNightActions;
            var nextIndex = (game._nightActionIndex || 0) + 1;
            return function() {
                if (actions && actions.length > 0) {
                    self.executeNightActions(actions, nextIndex);
                }
            };
        };
        
        switch (action) {
            case 'speech':
                this.showUserSpeechInput();
                break;
            case 'vote':
                var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
                this.showUserVoteAction(alivePlayers);
                break;
            case 'wolf_kill':
                var wolfTargets = getTargetPlayers(data.targets);
                if (wolfTargets.length > 0) {
                    this.showUserWolfAction(wolfTargets, createNightCallback());
                }
                break;
            case 'seer_check':
                var seerTargets = getTargetPlayers(data.targets);
                if (seerTargets.length > 0) {
                    this.showUserSeerAction(seerTargets, createNightCallback());
                }
                break;
            case 'witch_action':
            case 'witch_poison':
                var witch = game.players.find(function(p) { return p.isUser && p.role === 'witch'; });
                if (witch) {
                    if (action === 'witch_poison') {
                        this.showWitchPoisonTargets(createNightCallback());
                    } else {
                        this.showUserWitchAction(witch, createNightCallback());
                    }
                }
                break;
            case 'guard_protect':
                var guardTargets = getTargetPlayers(data.targets);
                if (guardTargets.length > 0) {
                    this.showUserGuardAction(guardTargets, createNightCallback());
                }
                break;
            case 'cupid_link':
                var cupidTargets = getTargetPlayers(data.targets);
                if (cupidTargets.length > 0) {
                    this.showUserCupidAction(cupidTargets, createNightCallback());
                }
                break;
            case 'hunter_shoot':
                var hunterTargets = getTargetPlayers(data.targets);
                if (hunterTargets.length > 0) {
                    this.showHunterShootAction(hunterTargets);
                }
                break;
        }
    };
    
    // 渲染玩家身份卡片
    ChatApp.prototype.renderPlayerRoleCard = function(game) {
        var html = '';
        var userPlayer = game.players.find(function(p) { return p.isUser; });
        
        if (game.isGodMode) {
            html += '<div style="background:rgba(200,170,80,0.15);border:1px solid rgba(200,170,80,0.4);border-radius:10px;padding:10px 16px;display:inline-block;">';
            html += '<div style="font-size:12px;font-weight:600;color:#c8aa50;">上帝视角</div>';
            html += '<div style="font-size:10px;color:rgba(200,170,80,0.7);margin-top:3px;">全知全能，观察一切</div>';
            html += '</div>';
        } else if (userPlayer) {
            var roleInfo = this.werewolfRoles[userPlayer.role];
            html += '<div style="background:rgba(' + this.hexToRgb(roleInfo.color) + ',0.15);border:1px solid ' + roleInfo.color + '50;border-radius:10px;padding:10px 16px;display:inline-block;">';
            html += '<div style="display:flex;align-items:center;justify-content:center;gap:6px;">';
            html += '<span style="color:' + roleInfo.color + ';">' + roleInfo.icon + '</span>';
            html += '<span style="font-size:13px;font-weight:600;color:' + roleInfo.color + ';">' + roleInfo.name + '</span>';
            html += '</div>';
            html += '<div style="font-size:10px;color:#6a7a8a;margin-top:4px;">' + roleInfo.description + '</div>';
            
            // 如果是狼人，显示同伴
            if (userPlayer.role === 'wolf') {
                var wolves = game.players.filter(function(p) { return p.role === 'wolf' && !p.isUser; });
                if (wolves.length > 0) {
                    html += '<div style="font-size:10px;color:#e74c3c;margin-top:6px;padding-top:6px;border-top:1px solid rgba(231,76,60,0.2);">狼队友: ' + wolves.map(function(w) { return w.name; }).join('、') + '</div>';
                }
            }
            
            html += '</div>';
        }
        
        return html;
    };
    
    // 颜色转换辅助函数
    ChatApp.prototype.hexToRgb = function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? parseInt(result[1], 16) + ',' + parseInt(result[2], 16) + ',' + parseInt(result[3], 16) : '255,255,255';
    };
    
    // 渲染游戏消息
    ChatApp.prototype.renderGameMessages = function() {
        var game = this.currentGame;
        if (!game) return '';
        
        var html = '';
        var self = this;
        
        game.chatHistory.forEach(function(msg) {
            if (msg.type === 'system') {
                html += '<div class="msg-system">' + msg.content + '</div>';
            } else if (msg.type === 'phase') {
                html += '<div style="text-align:center;margin:15px 0;">';
                html += '<div style="display:inline-block;padding:6px 14px;background:' + msg.color + '25;border-radius:12px;color:' + msg.color + ';font-size:11px;font-weight:500;">';
                html += msg.content;
                html += '</div>';
                html += '</div>';
            } else if (msg.type === 'speech' || msg.type === 'review') {
                var isUser = msg.playerId === 'user';
                html += '<div style="display:flex;align-items:flex-start;gap:6px;margin:8px 0;' + (isUser ? 'flex-direction:row-reverse;' : '') + '">';
                
                // 头像
                if (!isUser) {
                    var player = game.players.find(function(p) { return p.id === msg.playerId; });
                    var ai = player ? PhoneCore.getAI(player.id) : null;
                    html += '<div style="width:26px;height:26px;border-radius:50%;background:' + (player ? self.getAvatarColor(player.id) : '#666') + ';flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">';
                    if (ai && ai.avatar) {
                        html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                    } else {
                        html += (msg.playerName || '?').charAt(0);
                    }
                    html += '</div>';
                }
                
                // 消息
                html += '<div style="max-width:75%;">';
                if (!isUser) {
                    html += '<div style="font-size:10px;color:#5A8FBF;margin-bottom:3px;font-weight:500;">' + (msg.playerName || '未知') + '</div>';
                }
                html += '<div class="msg-bubble ' + (isUser ? 'msg-user' : 'msg-ai') + '">';
                html += msg.content;
                html += '</div>';
                html += '</div>';
                html += '</div>';
            }
        });
        
        return html;
    };
    
    // 渲染游戏操作区域
    ChatApp.prototype.renderGameActions = function() {
        var game = this.currentGame;
        if (!game) return '';
        
        var html = '';
        
        // 根据游戏阶段显示不同操作
        if (game.phase === 'waiting') {
            html += '<div style="text-align:center;color:#5A8FBF;padding:8px;">';
            html += '<div style="display:inline-flex;gap:4px;align-items:center;">';
            html += '<span style="width:5px;height:5px;background:#4A90D9;border-radius:50%;animation:pulse 1s infinite;"></span>';
            html += '<span style="width:5px;height:5px;background:#4A90D9;border-radius:50%;animation:pulse 1s infinite 0.2s;"></span>';
            html += '<span style="width:5px;height:5px;background:#4A90D9;border-radius:50%;animation:pulse 1s infinite 0.4s;"></span>';
            html += '</div>';
            html += '<div style="margin-top:6px;font-size:11px;">等待中...</div>';
            html += '</div>';
        } else if (game.phase === 'user_action') {
            html += '<div id="user-action-area"></div>';
        } else if (game.phase === 'ended') {
            html += '<button id="start-review-btn" style="width:100%;padding:10px;background:linear-gradient(135deg,#4A90D9,#5A9FE8);border:none;border-radius:8px;color:white;font-size:12px;font-weight:500;cursor:pointer;margin-bottom:8px;box-shadow:0 2px 8px rgba(74,144,217,0.3);">';
            html += '开始复盘';
            html += '</button>';
            html += '<button id="end-game-btn" style="width:100%;padding:10px;background:#E8F4FF;border:1px solid rgba(74,144,217,0.3);border-radius:8px;color:#4A90D9;font-size:12px;font-weight:500;cursor:pointer;">';
            html += '结束游戏';
            html += '</button>';
        } else if (game.phase === 'review') {
            // 复盘聊天模式
            html += '<div style="display:flex;gap:8px;align-items:flex-end;">';
            html += '<div style="flex:1;background:white;border:1px solid rgba(74,144,217,0.2);border-radius:8px;padding:8px 10px;box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);">';
            html += '<input type="text" id="review-input" placeholder="发送消息..." style="width:100%;background:transparent;border:none;color:#3A5A80;font-size:11px;outline:none;">';
            html += '</div>';
            html += '<button id="send-review-btn" style="padding:8px 14px;background:linear-gradient(135deg,#4A90D9,#5A9FE8);border:none;border-radius:8px;color:white;font-size:11px;cursor:pointer;box-shadow:0 2px 6px rgba(74,144,217,0.3);">发送</button>';
            html += '<button id="end-review-btn" style="padding:8px 14px;background:#E8F4FF;border:1px solid rgba(74,144,217,0.3);border-radius:8px;color:#4A90D9;font-size:11px;cursor:pointer;">结束</button>';
            html += '</div>';
        } else {
            // 显示跳过按钮（调试用）或等待状态
            html += '<div style="text-align:center;color:#5A8FBF;padding:8px;font-size:11px;">';
            html += '游戏进行中...';
            html += '</div>';
        }
        
        return html;
    };
    
    // 绑定游戏事件
    ChatApp.prototype.bindGameEvents = function(page) {
        var self = this;
        
        // 返回按钮
        var backBtn = page.querySelector('#game-back-btn');
        if (backBtn) {
            backBtn.onclick = function() {
                var game = self.currentGame;
                
                // 防止重复点击
                if (backBtn.disabled || (game && game._isSaving)) {
                    return;
                }
                backBtn.disabled = true;
                
                if (!game) {
                    page.classList.remove('slide-in');
                    page.classList.add('slide-out');
                    setTimeout(function() {
                        page.remove();
                        self.pageStack.pop();
                    }, 300);
                    return;
                }
                
                // 如果游戏已结束或正在复盘，保存记录后退出
                if (game.phase === 'ended' || game.phase === 'review') {
                    self.saveGameRecord();
                } else {
                    // 游戏进行中，询问是否保存
                    if (confirm('确定要退出游戏吗？将保存当前进度为游戏记录。')) {
                        // 标记游戏为提前结束
                        game.endTime = Date.now();
                        game.winner = game.winner || 'none';
                        game.phase = 'ended';
                        
                        self.addGameMessage({
                            type: 'system',
                            content: '游戏提前结束'
                        });
                        
                        self.saveGameRecord();
                    } else {
                        // 用户取消，恢复按钮
                        backBtn.disabled = false;
                    }
                }
            };
        }
        
        // 信息按钮
        var infoBtn = page.querySelector('#game-info-btn');
        if (infoBtn) {
            infoBtn.onclick = function() {
                self.showGameInfo();
            };
        }
        
        // 最小化按钮
        var minimizeBtn = page.querySelector('#game-minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.onclick = function() {
                self.minimizeGame();
            };
        }
    };
    
    // 最小化游戏（隐藏界面，游戏继续在后台运行）
    ChatApp.prototype.minimizeGame = function() {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        // 标记游戏为最小化状态
        game.isMinimized = true;
        
        // 关闭游戏界面但保留游戏状态
        if (this.gamePageElement) {
            this.gamePageElement.classList.remove('slide-in');
            this.gamePageElement.classList.add('slide-out');
            setTimeout(function() {
                if (self.gamePageElement) {
                    self.gamePageElement.remove();
                    self.pageStack.pop();
                }
                self.gamePageElement = null;
            }, 300);
        }
        
        // 发送通知
        PhoneCore.notifications.send({
            type: 'info',
            title: '狼人杀',
            message: '游戏已最小化，轮到你时会通知',
            size: 'mini'
        });
    };
    
    // 恢复游戏界面（从最小化状态）
    ChatApp.prototype.resumeWerewolfGame = function() {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        game.isMinimized = false;
        this.openWerewolfGameUI();
        
        // 滚动到底部并更新游戏UI
        setTimeout(function() {
            if (self.gamePageElement) {
                var messagesContainer = self.gamePageElement.querySelector('#game-messages');
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
                // 【修复】恢复游戏时更新游戏UI，确保发言顺序栏等状态正确显示
                self.updateGameUI();
            }
        }, 100);
    };
    
    // 通知用户该他行动了
    ChatApp.prototype.notifyUserTurn = function(actionType) {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        var message = '';
        switch (actionType) {
            case 'wolf_kill':
                message = '狼人回合 - 选择击杀目标';
                break;
            case 'seer_check':
                message = '预言家回合 - 选择查验目标';
                break;
            case 'witch_action':
                message = '女巫回合 - 决定是否使用药水';
                break;
            case 'guard_protect':
                message = '守卫回合 - 选择守护目标';
                break;
            case 'cupid_link':
                message = '丘比特回合 - 连接情侣';
                break;
            case 'speech':
                message = '轮到你发言了';
                break;
            case 'vote':
                message = '投票环节 - 选择放逐目标';
                break;
            case 'hunter_shoot':
                message = '猎人技能 - 选择开枪目标';
                break;
            default:
                message = '轮到你行动了';
        }
        
        // 如果游戏已最小化，发送通知并提供恢复选项
        if (game.isMinimized) {
            PhoneCore.notifications.send({
                type: 'warning',
                title: '狼人杀 - 你的回合',
                message: message,
                size: 'normal',
                duration: 0, // 不自动消失
                onClick: function() {
                    self.resumeWerewolfGame();
                }
            });
        }
    };
    
    // 显示游戏信息
    ChatApp.prototype.showGameInfo = function() {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#D4E9FF 100%);min-height:100%;">';
        html += '<div style="font-size:14px;font-weight:600;color:#3A5A80;margin-bottom:16px;">玩家列表 (' + game.alivePlayers.length + '/' + game.players.length + ' 存活)</div>';
        
        game.players.forEach(function(player) {
            var roleInfo = self.werewolfRoles[player.role];
            var ai = !player.isUser ? PhoneCore.getAI(player.id) : null;
            
            html += '<div style="display:flex;align-items:center;padding:10px;background:white;border-radius:10px;margin-bottom:6px;box-shadow:0 1px 4px rgba(74,144,217,0.1);' + (!player.isAlive ? 'opacity:0.5;' : '') + '">';
            
            // 头像
            html += '<div style="width:32px;height:32px;border-radius:50%;background:' + self.getAvatarColor(player.id) + ';margin-right:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;position:relative;">';
            if (ai && ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else if (player.isUser && PhoneCore.user.avatar) {
                html += '<img src="' + PhoneCore.user.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += player.name.charAt(0);
            }
            if (!player.isAlive) {
                html += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#e74c3c;font-size:14px;">X</div>';
            }
            html += '</div>';
            
            // 信息
            html += '<div style="flex:1;">';
            html += '<div style="color:#3A5A80;font-weight:500;font-size:12px;">' + player.name + (player.isUser ? ' (你)' : '') + '</div>';
            html += '<div style="font-size:10px;color:#8AAFCF;">' + player.seatNumber + '号位</div>';
            html += '</div>';
            
            // 身份（上帝模式或自己或游戏结束或死亡）
            if (game.isGodMode || player.isUser || !player.isAlive || game.phase === 'ended' || game.phase === 'review') {
                html += '<div style="display:flex;align-items:center;gap:3px;color:' + roleInfo.color + ';font-size:11px;">';
                html += '<span>' + roleInfo.icon + '</span>';
                html += '<span>' + roleInfo.name + '</span>';
                html += '</div>';
            } else {
                html += '<div style="color:#BFCFE0;font-size:11px;">???</div>';
            }
            
            html += '</div>';
        });
        
        // 游戏统计
        html += '<div style="margin-top:20px;padding:12px;background:white;border-radius:10px;box-shadow:0 1px 4px rgba(74,144,217,0.1);">';
        html += '<div style="font-size:12px;color:#5A8FBF;margin-bottom:8px;">游戏统计</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
        html += '<div style="text-align:center;"><div style="font-size:16px;color:#4A90D9;font-weight:600;">' + game.round + '</div><div style="font-size:10px;color:#8AAFCF;">当前轮数</div></div>';
        html += '<div style="text-align:center;"><div style="font-size:16px;color:#4a9a6a;font-weight:600;">' + game.alivePlayers.length + '</div><div style="font-size:10px;color:#8AAFCF;">存活人数</div></div>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        this.openDetailPage(html, { title: '游戏信息', titleColor: '#3A5A80', bgColor: '#E8F4FF' });
    };
    
    // 运行游戏阶段
    ChatApp.prototype.runGamePhase = function() {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        // 检查游戏是否结束
        if (this.checkGameEnd()) {
            return;
        }
        
        if (game.phase === 'night') {
            this.runNightPhase();
        } else if (game.phase === 'day_speech') {
            this.runDaySpeechPhase();
        } else if (game.phase === 'day_vote') {
            this.runDayVotePhase();
        }
    };
    
    // 夜晚阶段
    ChatApp.prototype.runNightPhase = function() {
        var self = this;
        var game = this.currentGame;
        
        game.round++;
        game.nightKillTarget = null;
        game.guardedPlayer = null;
        
        // 添加阶段提示
        this.addGameMessage({
            type: 'phase',
            content: '第 ' + game.round + ' 个夜晚降临',
            color: '#4a5568'
        });
        
        this.updateGameUI();
        
        // 按顺序执行夜晚行动
        var nightActions = [];
        
        // 丘比特（仅第一夜）
        if (game.round === 1) {
            var cupid = game.players.find(function(p) { return p.role === 'cupid' && p.isAlive; });
            if (cupid) {
                nightActions.push({ type: 'cupid', player: cupid });
            }
        }
        
        // 守卫
        var guard = game.players.find(function(p) { return p.role === 'guard' && p.isAlive; });
        if (guard) {
            nightActions.push({ type: 'guard', player: guard });
        }
        
        // 狼人
        var wolves = game.players.filter(function(p) { return p.role === 'wolf' && p.isAlive; });
        if (wolves.length > 0) {
            nightActions.push({ type: 'wolf', players: wolves });
        }
        
        // 女巫
        var witch = game.players.find(function(p) { return p.role === 'witch' && p.isAlive; });
        if (witch) {
            nightActions.push({ type: 'witch', player: witch });
        }
        
        // 预言家
        var seer = game.players.find(function(p) { return p.role === 'seer' && p.isAlive; });
        if (seer) {
            nightActions.push({ type: 'seer', player: seer });
        }
        
        // 执行夜晚行动
        this.executeNightActions(nightActions, 0);
    };
    
    // 执行夜晚行动序列
    ChatApp.prototype.executeNightActions = function(actions, index) {
        var self = this;
        var game = this.currentGame;
        
        // 【修复】保存夜晚行动状态，用于恢复游戏时继续执行
        game._pendingNightActions = actions;
        game._nightActionIndex = index;
        
        if (index >= actions.length) {
            // 所有夜晚行动完成，清除状态
            game._pendingNightActions = null;
            game._nightActionIndex = null;
            // 处理结果
            setTimeout(function() {
                self.resolveNightResults();
            }, 1000);
            return;
        }
        
        var action = actions[index];
        
        setTimeout(function() {
            self.processNightAction(action, function() {
                self.executeNightActions(actions, index + 1);
            });
        }, 800);
    };
    
    // 处理单个夜晚行动
    ChatApp.prototype.processNightAction = function(action, callback) {
        var self = this;
        var game = this.currentGame;
        
        if (action.type === 'wolf') {
            this.processWolfAction(action.players, callback);
        } else if (action.type === 'seer') {
            this.processSeerAction(action.player, callback);
        } else if (action.type === 'witch') {
            this.processWitchAction(action.player, callback);
        } else if (action.type === 'guard') {
            this.processGuardAction(action.player, callback);
        } else if (action.type === 'cupid') {
            this.processCupidAction(action.player, callback);
        } else {
            callback();
        }
    };
    
    // 狼人行动
    ChatApp.prototype.processWolfAction = function(wolves, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.addGameMessage({
            type: 'system',
            content: '狼人请睁眼...'
        });
        this.updateGameUI();
        
        // 获取可杀目标（所有存活玩家，包括狼人自己，允许自刀）
        var targets = game.players.filter(function(p) {
            return p.isAlive;
        });
        
        // 检查是否有用户是狼人
        var userWolf = wolves.find(function(w) { return w.isUser; });
        
        if (userWolf) {
            // 用户是狼人，需要用户选择
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'wolf_kill';
            game.pendingActionData = { targets: targets.map(function(p) { return p.id; }) };
            self.notifyUserTurn('wolf_kill');
            setTimeout(function() {
                self.showUserWolfAction(targets, callback);
            }, 500);
        } else {
            // 全是AI狼人，AI决定杀谁
            this.aiWolfDecision(wolves, targets, callback);
        }
    };
    
    // 显示用户狼人操作界面
    ChatApp.prototype.showUserWolfAction = function(targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return callback();
        
        // 【修复】标记等待用户操作
        game.pendingUserAction = 'wolf_kill';
        game.pendingActionData = { targets: targets.map(function(t) { return t.id; }) };
        
        // 获取所有狼人（包括用户和AI队友）
        var wolves = game.players.filter(function(p) { return p.isAlive && p.role === 'wolf'; });
        var aiWolves = wolves.filter(function(w) { return !w.isUser; });
        var userWolf = wolves.find(function(w) { return w.isUser; });
        
        // 初始化狼人讨论历史
        if (!game.wolfDiscussion) {
            game.wolfDiscussion = [];
        }
        
        var html = '<div style="padding:8px 0;">';
        
        // 显示狼人队友信息
        if (aiWolves.length > 0) {
            html += '<div style="font-size:12px;color:#c85a5a;margin-bottom:8px;text-align:center;font-weight:500;">狼人夜话</div>';
            html += '<div style="font-size:11px;color:#8a5a5a;margin-bottom:8px;text-align:center;">你的队友: ' + aiWolves.map(function(w) { return w.name; }).join('、') + '</div>';
            
            // 讨论区域
            html += '<div id="wolf-chat-area" style="max-height:120px;overflow-y:auto;background:rgba(200,90,90,0.1);border-radius:8px;padding:8px;margin-bottom:10px;border:1px solid rgba(200,90,90,0.2);">';
            if (game.wolfDiscussion.length === 0) {
                html += '<div style="font-size:11px;color:#9a7a7a;text-align:center;">正在等待队友发言...</div>';
            }
            html += '</div>';
            
            // 用户输入区域
            html += '<div style="display:flex;gap:6px;margin-bottom:10px;">';
            html += '<input type="text" id="wolf-chat-input" placeholder="与队友讨论今晚杀谁..." style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.8);border:1px solid rgba(200,90,90,0.3);border-radius:8px;color:#5a3030;font-size:11px;outline:none;">';
            html += '<button id="wolf-chat-send" style="padding:8px 12px;background:rgba(200,90,90,0.3);border:1px solid rgba(200,90,90,0.4);border-radius:8px;color:#c85a5a;font-size:11px;cursor:pointer;">发送</button>';
            html += '</div>';
        }
        
        // 目标选择
        html += '<div style="font-size:11px;color:#7a5a5a;margin-bottom:8px;text-align:center;">选择今晚要击杀的目标</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        
        targets.forEach(function(target) {
            html += '<button class="wolf-target-btn" data-id="' + target.id + '" style="padding:8px 12px;background:rgba(200,90,90,0.2);border:1px solid rgba(200,90,90,0.4);border-radius:8px;color:#c85a5a;font-size:11px;cursor:pointer;transition:all 0.2s;">';
            html += target.name;
            html += '</button>';
        });
        
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        // 如果有AI狼人队友，生成他们的发言
        if (aiWolves.length > 0) {
            self.generateWolfTeammateDiscussion(aiWolves, targets, userWolf);
            
            // 绑定发送消息事件
            var chatInput = actionArea.querySelector('#wolf-chat-input');
            var chatSend = actionArea.querySelector('#wolf-chat-send');
            
            if (chatSend && chatInput) {
                var sendMessage = function() {
                    var msg = chatInput.value.trim();
                    if (!msg) return;
                    
                    // 禁用输入，等待AI回复
                    chatInput.disabled = true;
                    chatSend.disabled = true;
                    chatSend.style.opacity = '0.5';
                    chatInput.placeholder = '等待回复...';
                    
                    // 添加用户消息
                    game.wolfDiscussion.push({
                        sender: userWolf ? userWolf.name : '你',
                        content: msg,
                        isUser: true
                    });
                    chatInput.value = '';
                    self.updateWolfChatArea();
                    
                    // AI队友回复，回复完成后重新启用输入
                    setTimeout(function() {
                        self.generateWolfTeammateReply(aiWolves, targets, msg, userWolf, function() {
                            // 回复完成，重新启用输入
                            chatInput.disabled = false;
                            chatSend.disabled = false;
                            chatSend.style.opacity = '1';
                            chatInput.placeholder = '说点什么...';
                            chatInput.focus();
                        });
                    }, 800 + Math.random() * 1000);
                };
                
                chatSend.onclick = sendMessage;
                chatInput.onkeypress = function(e) {
                    if (e.key === 'Enter') sendMessage();
                };
            }
        }
        
        // 绑定目标选择事件
        actionArea.querySelectorAll('.wolf-target-btn').forEach(function(btn) {
            btn.onclick = function() {
                var targetId = btn.getAttribute('data-id');
                var targetPlayer = targets.find(function(t) { return t.id === targetId; });
                game.nightKillTarget = targetId;
                
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                game.pendingActionData = null;
                
                // 记录狼人击杀行动到gameLog
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'wolfKill',
                    targetId: targetId,
                    targetName: targetPlayer ? targetPlayer.name : '某人'
                });
                
                // 清空讨论历史
                game.wolfDiscussion = [];
                
                self.addGameMessage({
                    type: 'system',
                    content: '狼人决定击杀 ' + (targetPlayer ? targetPlayer.name : '某人')
                });
                
                actionArea.innerHTML = self.renderGameActions();
                callback();
            };
        });
    };
    
    // 生成狼人队友初始讨论
    ChatApp.prototype.generateWolfTeammateDiscussion = function(aiWolves, targets, userWolf) {
        var self = this;
        var game = this.currentGame;
        
        // 让第一个AI狼人先发言
        var firstWolf = aiWolves[0];
        
        // 构建完整游戏上下文
        var gameContext = '';
        
        // 玩家列表（带座位号）
        gameContext += '【所有玩家】\n';
        game.players.forEach(function(p) {
            var status = p.isAlive ? '存活' : '死亡';
            gameContext += p.seatNumber + '号 ' + p.name + ' [' + status + ']\n';
        });
        gameContext += '\n';
        
        // 狼人队友信息
        var wolfTeammates = aiWolves.filter(function(w) { return w.id !== firstWolf.id; });
        if (wolfTeammates.length > 0 || userWolf) {
            gameContext += '【你的狼人队友】\n';
            if (userWolf) {
                gameContext += userWolf.seatNumber + '号 ' + userWolf.name + '\n';
            }
            wolfTeammates.forEach(function(w) {
                gameContext += w.seatNumber + '号 ' + w.name + '\n';
            });
            gameContext += '\n';
        }
        
        // 游戏事件历史
        if (game.gameLog && game.gameLog.length > 0) {
            gameContext += '【已发生的事件】\n';
            game.gameLog.forEach(function(log) {
                if (log.event === 'death') {
                    var causeText = '';
                    switch(log.cause) {
                        case 'vote': causeText = '被投票放逐'; break;
                        case 'night': causeText = '被狼刀'; break;
                        case 'witch_poison': causeText = '夜晚死亡'; break; // 狼人不知道女巫毒了谁
                        case 'hunter': causeText = '被猎人带走'; break;
                        case 'lover_death': causeText = '殉情'; break;
                        default: causeText = '死亡';
                    }
                    var deadP = game.players.find(function(p) { return p.id === log.playerId; });
                    var seatNum = deadP ? deadP.seatNumber + '号' : '';
                    gameContext += '第' + log.round + '轮: ' + seatNum + log.playerName + ' ' + causeText + '\n';
                }
            });
            gameContext += '\n';
        }
        
        // 完整聊天历史
        if (game.chatHistory && game.chatHistory.length > 0) {
            gameContext += '【聊天记录】\n';
            game.chatHistory.forEach(function(msg) {
                if (msg.type === 'phase') {
                    gameContext += '--- ' + msg.content + ' ---\n';
                } else if (msg.type === 'speech') {
                    var sp = game.players.find(function(p) { return p.id === msg.playerId; });
                    var seat = sp ? sp.seatNumber + '号' : '';
                    gameContext += seat + msg.playerName + ': ' + msg.content + '\n';
                }
            });
            gameContext += '\n';
        }
        
        // 之前的狼人夜话
        if (game.wolfDiscussion && game.wolfDiscussion.length > 0) {
            gameContext += '【之前的狼人夜话】\n';
            game.wolfDiscussion.forEach(function(msg) {
                gameContext += msg.sender + ': ' + msg.content + '\n';
            });
            gameContext += '\n';
        }
        
        // 获取AI性格
        var wolfAI = PhoneCore.getAI(firstWolf.id);
        var wolfPersonality = wolfAI && wolfAI.personality ? wolfAI.personality.substring(0, 150) : '';
        
        var prompt = '<role>你是' + firstWolf.name + '（狼人），第' + game.round + '夜和狼队友私聊商量刀谁</role>\n';
        if (wolfPersonality) {
            prompt += '<personality>' + wolfPersonality + '</personality>\n';
        }
        prompt += gameContext;
        prompt += '<targets>可刀：' + targets.map(function(t) { return t.name; }).join('、') + '</targets>\n\n';
        prompt += '<output>\n';
        prompt += '说1-2句话，提议刀谁+简单理由\n';
        prompt += '语气像微信私聊，口语化，用你的性格说\n';
        prompt += '示例风格：\n';
        prompt += '• "刀xxx吧，感觉ta是预言家"\n';
        prompt += '• "xxx今天说话太多了，先弄掉"\n';
        prompt += '• "随便吧，xxx？我没啥想法"\n';
        prompt += '</output>\n';
        prompt += '直接输出，不要加角色名前缀：';
        
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (!apiConfigId) {
            // 无API，不显示默认发言，直接返回
            return;
        }
        
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call('狼人杀游戏，扮演狼人' + firstWolf.name + '。中文对话。', apiConfigId, {
            messages: [{ role: 'user', content: prompt }],
            maxTokens: configuredMaxTokens,
            temperature: 0.85
        }).then(function(response) {
            var content = response && typeof response === 'object' ? response.content : response;
            content = (content || '').trim().replace(/^["'「」『』]|["'「」『』]$/g, '');
            // 移除可能的角色名前缀
            content = content.replace(/^[\w\u4e00-\u9fa5]+[:：]\s*/, '');
            
            if (content && content.length >= 2) {
                game.wolfDiscussion.push({
                    sender: firstWolf.name,
                    content: content,
                    isUser: false
                });
                self.updateWolfChatArea();
            }
            // 如果内容为空，不显示任何默认发言
        }).catch(function() {
            // API失败，不显示默认发言
        });
    };
    
    // 狼人队友回复用户消息
    ChatApp.prototype.generateWolfTeammateReply = function(aiWolves, targets, userMessage, userWolf, callback) {
        var self = this;
        var game = this.currentGame;
        
        // 随机选一个AI狼人回复
        var replier = aiWolves[Math.floor(Math.random() * aiWolves.length)];
        
        // 构建完整游戏上下文
        var gameContext = '';
        
        // 玩家列表（带座位号）
        gameContext += '【所有玩家】\n';
        game.players.forEach(function(p) {
            var status = p.isAlive ? '存活' : '死亡';
            gameContext += p.seatNumber + '号 ' + p.name + ' [' + status + ']\n';
        });
        gameContext += '\n';
        
        // 游戏事件历史
        if (game.gameLog && game.gameLog.length > 0) {
            var hasDeaths = game.gameLog.some(function(log) { return log.event === 'death'; });
            if (hasDeaths) {
                gameContext += '【已发生的死亡事件】\n';
                game.gameLog.forEach(function(log) {
                    if (log.event === 'death') {
                        var causeText = '';
                        switch(log.cause) {
                            case 'vote': causeText = '被投票放逐'; break;
                            case 'night': causeText = '被狼刀'; break;
                            case 'witch_poison': causeText = '夜晚死亡'; break; // 狼人不知道女巫毒了谁
                            case 'hunter': causeText = '被猎人带走'; break;
                            case 'lover_death': causeText = '殉情'; break;
                            default: causeText = '死亡';
                        }
                        var deadP = game.players.find(function(p) { return p.id === log.playerId; });
                        var seatNum = deadP ? deadP.seatNumber + '号' : '';
                        gameContext += '第' + log.round + '轮: ' + seatNum + log.playerName + ' ' + causeText + '\n';
                    }
                });
                gameContext += '\n';
            }
        }
        
        // 完整聊天历史
        if (game.chatHistory && game.chatHistory.length > 0) {
            gameContext += '【聊天记录】\n';
            game.chatHistory.forEach(function(msg) {
                if (msg.type === 'phase') {
                    gameContext += '--- ' + msg.content + ' ---\n';
                } else if (msg.type === 'speech') {
                    var sp = game.players.find(function(p) { return p.id === msg.playerId; });
                    var seat = sp ? sp.seatNumber + '号' : '';
                    gameContext += seat + msg.playerName + ': ' + msg.content + '\n';
                }
            });
            gameContext += '\n';
        }
        
        // 狼人夜话历史
        var wolfChatHistory = '';
        if (game.wolfDiscussion && game.wolfDiscussion.length > 0) {
            wolfChatHistory = game.wolfDiscussion.map(function(msg) {
                return msg.sender + ': ' + msg.content;
            }).join('\n');
        }
        
        // 获取AI性格
        var replierAI = PhoneCore.getAI(replier.id);
        var replierPersonality = replierAI && replierAI.personality ? replierAI.personality.substring(0, 150) : '';
        
        var prompt = '<role>你是' + replier.name + '（狼人），第' + game.round + '夜狼人私聊</role>\n';
        if (replierPersonality) {
            prompt += '<personality>' + replierPersonality + '</personality>\n';
        }
        prompt += gameContext;
        prompt += '<targets>可刀：' + targets.map(function(t) { return t.name; }).join('、') + '</targets>\n\n';
        prompt += '<wolf_chat>\n' + wolfChatHistory + '\n</wolf_chat>\n';
        prompt += '<last_message>队友说：' + userMessage + '</last_message>\n\n';
        prompt += '<output>\n';
        prompt += '回复队友，可以：\n';
        prompt += '• 同意："行，就ta"\n';
        prompt += '• 反对："别吧，我觉得xxx更该刀"\n';
        prompt += '• 补充："也行，不过xxx也挺可疑"\n';
        prompt += '1-2句话，用你的性格说，像微信私聊\n';
        prompt += '</output>\n';
        prompt += '直接输出，不要加角色名前缀：';
        
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (!apiConfigId) {
            // 无API，不显示默认回复
            if (callback) callback();
            return;
        }
        
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call('狼人杀游戏，扮演狼人' + replier.name + '。中文对话。', apiConfigId, {
            messages: [{ role: 'user', content: prompt }],
            maxTokens: configuredMaxTokens,
            temperature: 0.85
        }).then(function(response) {
            var content = response && typeof response === 'object' ? response.content : response;
            content = (content || '').trim().replace(/^["'「」『』]|["'「」『』]$/g, '');
            // 移除可能的角色名前缀
            content = content.replace(/^[\w\u4e00-\u9fa5]+[:：]\s*/, '');
            
            if (content && content.length >= 2) {
                game.wolfDiscussion.push({
                    sender: replier.name,
                    content: content,
                    isUser: false
                });
                self.updateWolfChatArea();
            }
            // 回复完成，调用callback
            if (callback) callback();
        }).catch(function() {
            // API失败，也要调用callback
            if (callback) callback();
        });
    };
    
    // 更新狼人聊天区域
    ChatApp.prototype.updateWolfChatArea = function() {
        var game = this.currentGame;
        if (!game || !this.gamePageElement) return;
        
        var chatArea = this.gamePageElement.querySelector('#wolf-chat-area');
        if (!chatArea) return;
        
        var html = '';
        game.wolfDiscussion.forEach(function(msg) {
            var bgColor = msg.isUser ? 'rgba(100,150,200,0.2)' : 'rgba(200,90,90,0.2)';
            var textColor = msg.isUser ? '#6496c8' : '#c85a5a';
            html += '<div style="margin-bottom:6px;padding:6px 8px;background:' + bgColor + ';border-radius:6px;">';
            html += '<span style="font-size:10px;color:' + textColor + ';font-weight:500;">' + msg.sender + ':</span> ';
            html += '<span style="font-size:11px;color:#5a4040;">' + msg.content + '</span>';
            html += '</div>';
        });
        
        chatArea.innerHTML = html || '<div style="font-size:11px;color:#9a7a7a;text-align:center;">暂无消息</div>';
        chatArea.scrollTop = chatArea.scrollHeight;
    };
    
    // AI狼人决策
    ChatApp.prototype.aiWolfDecision = function(wolves, targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        // 由第一只狼代表做决定
        var leadWolf = wolves[0];
        
        // 上帝视角：生成狼人讨论场景
        if (game.isGodMode) {
            this.generateWolfDiscussion(wolves, targets, function(targetId, discussionContent) {
                game.nightKillTarget = targetId;
                var targetPlayer = game.players.find(function(p) { return p.id === targetId; });
                
                // 记录狼人击杀行动到gameLog（包含心理活动）
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'wolfKill',
                    targetId: targetId,
                    targetName: targetPlayer ? targetPlayer.name : '某人',
                    reason: discussionContent || '' // 保存狼人讨论内容作为心理活动
                });
                
                self.addGameMessage({
                    type: 'system',
                    content: '狼人决定击杀 ' + (targetPlayer ? targetPlayer.name : '某人')
                });
                self.updateGameUI();
                callback();
            });
        } else {
            // 普通模式：静默决策，但仍然记录决策原因
            this.callGameAI(leadWolf.id, 'wolf_kill', {
                targets: targets.map(function(t) { return { id: t.id, name: t.name, seatNumber: t.seatNumber }; }),
                teammates: wolves.filter(function(w) { return w.id !== leadWolf.id; }).map(function(w) { return w.name; })
            }, function(response) {
                var targetId = self.parseTargetFromResponse(response, targets);
                game.nightKillTarget = targetId;
                var targetPlayer = game.players.find(function(p) { return p.id === targetId; });
                
                // 从response中提取决策原因
                var reasonContent = (response || '').toString();
                reasonContent = reasonContent.replace(/\[击杀[:：][^\]]+\]/, '').trim();
                if (reasonContent.length > 100) reasonContent = reasonContent.substring(0, 100) + '...';
                
                // 记录狼人击杀行动到gameLog（包含心理活动）
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'wolfKill',
                    targetId: targetId,
                    targetName: targetPlayer ? targetPlayer.name : '某人',
                    reason: reasonContent || ''
                });
                
                self.addGameMessage({
                    type: 'system',
                    content: '狼人选择了目标'
                });
                self.updateGameUI();
                callback();
            });
        }
    };
    
    // 生成狼人讨论场景（上帝视角）
    ChatApp.prototype.generateWolfDiscussion = function(wolves, targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        // 构建游戏上下文
        var prompt = '<task>旁白视角：描写第' + game.round + '夜狼人私聊商量刀人的场景</task>\n\n';
        
        prompt += '<players>\n';
        game.players.forEach(function(p) {
            var status = p.isAlive ? '[存活]' : '[死亡]';
            var roleTag = p.role === 'wolf' ? '[狼]' : '';
            prompt += status + ' ' + p.name + roleTag + '\n';
        });
        prompt += '</players>\n\n';
        
        // 狼人信息
        var wolvesInfo = wolves.map(function(w) {
            var wolfAI = PhoneCore.getAI(w.id);
            var personality = wolfAI && wolfAI.personality ? '(' + wolfAI.personality.substring(0, 30) + ')' : '';
            return w.name + personality;
        });
        prompt += '<wolves>' + wolvesInfo.join('、') + '</wolves>\n';
        prompt += '<targets>可刀：' + targets.map(function(t) { return t.name; }).join('、') + '</targets>\n\n';
        
        // 游戏事件历史
        if (game.gameLog && game.gameLog.length > 0) {
            var hasDeaths = game.gameLog.some(function(log) { return log.event === 'death'; });
            if (hasDeaths) {
                prompt += '<deaths>\n';
                game.gameLog.forEach(function(log) {
                    if (log.event === 'death') {
                        var causeText = '';
                        switch(log.cause) {
                            case 'vote': causeText = '票出'; break;
                            case 'night': causeText = '被刀'; break;
                            case 'witch_poison': causeText = '夜死'; break;
                            case 'hunter': causeText = '被带走'; break;
                            case 'lover_death': causeText = '殉情'; break;
                            default: causeText = '死亡';
                        }
                        prompt += 'D' + log.round + ': ' + log.playerName + ' ' + causeText + '\n';
                    }
                });
                prompt += '</deaths>\n\n';
            }
        }
        
        // 聊天历史
        if (game.chatHistory && game.chatHistory.length > 0) {
            var speeches = game.chatHistory.filter(function(m) { return m.type === 'speech'; }).slice(-8);
            if (speeches.length > 0) {
                prompt += '<day_chat>\n';
                speeches.forEach(function(msg) {
                    prompt += msg.playerName + ': ' + msg.content + '\n';
                });
                prompt += '</day_chat>\n\n';
            }
        }
        
        prompt += '<output>\n';
        prompt += '写狼人私聊讨论的对话（2-3句），要求：\n';
        prompt += '• 像微信私聊，口语化，用各自性格\n';
        prompt += '• 讨论刀谁，简短有来有回\n';
        prompt += '• 最后必须加：[击杀:目标名字]\n';
        prompt += '\n示例：\n';
        prompt += '小明: 刀xxx吧，ta今天发言太精准了\n';
        prompt += '小红: 行，就ta，感觉是预言家\n';
        prompt += '[击杀:xxx]\n';
        prompt += '</output>';
        
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (!apiConfigId) {
            // 无API，不显示默认描述，直接随机选择目标
            var targetIdx = Math.floor(Math.random() * targets.length);
            var target = targets[targetIdx];
            callback(target.id, ''); // 第二个参数是心理活动内容
            return;
        }
        
        // 修复：使用messages格式，兼容Gemini等API
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call('狼人杀旁白，中文回复。', apiConfigId, {
            messages: [{ role: 'user', content: prompt }],
            maxTokens: configuredMaxTokens,
            temperature: 0.85
        }).then(function(response) {
            var content = response && typeof response === 'object' ? response.content : response;
            content = (content || '').trim();
            
            // 解析目标
            var targetId = null;
            var killMatch = content.match(/\[击杀[:：]([^\]]+)\]/);
            if (killMatch) {
                var targetName = killMatch[1].trim();
                var targetPlayer = targets.find(function(t) { return t.name === targetName; });
                if (targetPlayer) {
                    targetId = targetPlayer.id;
                }
                // 移除标记，只显示描述
                content = content.replace(/\[击杀[:：][^\]]+\]/, '').trim();
            }
            
            if (!targetId) {
                targetId = self.parseTargetFromResponse(content, targets);
            }
            
            // 显示场景描述
            if (content) {
                self.addGameMessage({
                    type: 'narrative',
                    content: content
                });
            }
            
            // 返回targetId和讨论内容（心理活动）
            callback(targetId, content || '');
        }).catch(function() {
            var targetIdx = Math.floor(Math.random() * targets.length);
            callback(targets[targetIdx].id, '');
        });
    };
    
    // 预言家行动
    ChatApp.prototype.processSeerAction = function(seer, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.addGameMessage({
            type: 'system',
            content: '预言家请睁眼...'
        });
        this.updateGameUI();
        
        // 获取可查验目标
        var targets = game.players.filter(function(p) {
            return p.isAlive && p.id !== seer.id;
        });
        
        if (seer.isUser) {
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'seer_check';
            game.pendingActionData = { targets: targets.map(function(p) { return p.id; }) };
            self.notifyUserTurn('seer_check');
            setTimeout(function() {
                self.showUserSeerAction(targets, callback);
            }, 500);
        } else {
            this.aiSeerDecision(seer, targets, callback);
        }
    };
    
    // 显示用户预言家操作
    ChatApp.prototype.showUserSeerAction = function(targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return callback();
        
        // 【修复】标记等待用户操作
        game.pendingUserAction = 'seer_check';
        game.pendingActionData = { targets: targets.map(function(t) { return t.id; }) };
        
        var html = '<div style="padding:8px 0;">';
        html += '<div style="font-size:11px;color:#7a5a9a;margin-bottom:10px;text-align:center;">选择要查验的玩家</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        
        targets.forEach(function(target) {
            html += '<button class="seer-target-btn" data-id="' + target.id + '" style="padding:8px 12px;background:rgba(140,100,170,0.2);border:1px solid rgba(140,100,170,0.4);border-radius:8px;color:#8c64aa;font-size:11px;cursor:pointer;transition:all 0.2s;">';
            html += target.name;
            html += '</button>';
        });
        
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        actionArea.querySelectorAll('.seer-target-btn').forEach(function(btn) {
            btn.onclick = function() {
                var targetId = btn.getAttribute('data-id');
                var target = game.players.find(function(p) { return p.id === targetId; });
                var isWolf = target.role === 'wolf';
                
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                game.pendingActionData = null;
                
                // 记录预言家查验到gameLog
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'seerCheck',
                    targetId: targetId,
                    targetName: target.name,
                    result: isWolf ? '狼人' : '好人'
                });
                
                self.addGameMessage({
                    type: 'system',
                    content: target.name + ' 的身份是: ' + (isWolf ? '狼人' : '好人')
                });
                
                actionArea.innerHTML = self.renderGameActions();
                self.updateGameUI();
                callback();
            };
        });
    };
    
    // AI预言家决策
    ChatApp.prototype.aiSeerDecision = function(seer, targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.callGameAI(seer.id, 'seer_check', {
            targets: targets.map(function(t) { return { id: t.id, name: t.name, seatNumber: t.seatNumber }; })
        }, function(response) {
            var targetId = self.parseTargetFromResponse(response, targets);
            var target = game.players.find(function(p) { return p.id === targetId; });
            
            if (target) {
                var isWolf = target.role === 'wolf';
                
                // 从response中提取决策原因
                var reasonContent = (response || '').toString().trim();
                if (reasonContent.length > 80) reasonContent = reasonContent.substring(0, 80) + '...';
                
                // 记录预言家查验到gameLog（包含心理活动）
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'seerCheck',
                    seerId: seer.id,
                    seerName: seer.name,
                    targetId: target.id,
                    targetName: target.name,
                    result: isWolf ? '狼人' : '好人',
                    reason: reasonContent || ''
                });
                
                // AI预言家的查验结果只有上帝模式能看到
                if (game.isGodMode) {
                    // 生成简短的心理描写
                    var narratives = isWolf ? [
                        seer.name + '查了' + target.name + '，心里一惊——是狼！',
                        seer.name + '看向' + target.name + '... 果然，狼人！',
                        '查验结果出来了，' + seer.name + '发现' + target.name + '是狼人'
                    ] : [
                        seer.name + '查了' + target.name + '，松了口气——好人',
                        seer.name + '确认了' + target.name + '是好人，可以信任',
                        '查验结果：' + target.name + '是好人，' + seer.name + '记下了'
                    ];
                    self.addGameMessage({
                        type: 'narrative',
                        content: narratives[Math.floor(Math.random() * narratives.length)]
                    });
                } else {
                    self.addGameMessage({
                        type: 'system',
                        content: '预言家完成了查验'
                    });
                }
            }
            
            self.updateGameUI();
            callback();
        });
    };
    
    // 女巫行动
    ChatApp.prototype.processWitchAction = function(witch, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.addGameMessage({
            type: 'system',
            content: '女巫请睁眼...'
        });
        
        // 如果是用户女巫，在聊天区域也显示被杀者信息
        if (witch.isUser) {
            var killedPlayer = null;
            if (game.nightKillTarget) {
                killedPlayer = game.players.find(function(p) { return String(p.id) === String(game.nightKillTarget); });
            }
            
            if (killedPlayer) {
                this.addGameMessage({
                    type: 'system',
                    content: '今晚 ' + killedPlayer.name + ' 被狼人杀害'
                });
            } else {
                this.addGameMessage({
                    type: 'system',
                    content: '今晚是平安夜，无人被杀'
                });
            }
        }
        
        this.updateGameUI();
        
        if (witch.isUser) {
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'witch_action';
            self.notifyUserTurn('witch_action');
            setTimeout(function() {
                self.showUserWitchAction(witch, callback);
            }, 500);
        } else {
            this.aiWitchDecision(witch, callback);
        }
    };
    
    // 显示用户女巫操作
    ChatApp.prototype.showUserWitchAction = function(witch, callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return callback();
        
        // 【修复】标记等待用户操作
        game.pendingUserAction = 'witch_action';
        
        // 使用字符串比较确保 ID 匹配（防止类型不匹配问题）
        var killedPlayer = null;
        if (game.nightKillTarget) {
            killedPlayer = game.players.find(function(p) { return String(p.id) === String(game.nightKillTarget); });
        }
        
        var html = '<div style="padding:8px 0;">';
        
        // 显示今晚的情况
        html += '<div style="font-size:12px;color:#8e44ad;margin-bottom:8px;text-align:center;font-weight:500;">女巫行动</div>';
        
        if (killedPlayer && !game.witchSaveUsed) {
            // 有人被杀且解药未用
            html += '<div style="font-size:12px;color:#e74c3c;margin-bottom:12px;text-align:center;padding:8px;background:rgba(231,76,60,0.1);border-radius:8px;border:1px solid rgba(231,76,60,0.3);">';
            html += '今晚 <strong>' + killedPlayer.name + '</strong> 被狼人杀害';
            html += '</div>';
        } else if (game.witchSaveUsed && !killedPlayer) {
            html += '<div style="font-size:11px;color:#7a5a8a;margin-bottom:10px;text-align:center;">今晚没有人被杀（解药已用完）</div>';
        } else if (!killedPlayer) {
            html += '<div style="font-size:11px;color:#27ae60;margin-bottom:10px;text-align:center;">今晚是平安夜，没有人被杀</div>';
        }
        
        html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
        
        // 解药
        if (!game.witchSaveUsed && killedPlayer) {
            html += '<button id="witch-save-btn" style="padding:10px 16px;background:rgba(74,154,106,0.25);border:1px solid rgba(74,154,106,0.5);border-radius:8px;color:#4a9a6a;font-size:12px;cursor:pointer;font-weight:500;">使用解药救人</button>';
        } else if (game.witchSaveUsed) {
            html += '<div style="padding:10px 16px;background:rgba(0,0,0,0.05);border-radius:8px;color:#9a8aaa;font-size:11px;">解药已用完</div>';
        }
        
        // 毒药
        if (!game.witchPoisonUsed) {
            html += '<button id="witch-poison-btn" style="padding:10px 16px;background:rgba(140,100,170,0.25);border:1px solid rgba(140,100,170,0.5);border-radius:8px;color:#8c64aa;font-size:12px;cursor:pointer;font-weight:500;">使用毒药</button>';
        } else {
            html += '<div style="padding:10px 16px;background:rgba(0,0,0,0.05);border-radius:8px;color:#9a8aaa;font-size:11px;">毒药已用完</div>';
        }
        
        // 不使用
        html += '<button id="witch-skip-btn" style="padding:10px 16px;background:rgba(100,80,120,0.15);border:1px solid rgba(100,80,120,0.3);border-radius:8px;color:#6a5a7a;font-size:12px;cursor:pointer;">不使用药水</button>';
        
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        var saveBtn = actionArea.querySelector('#witch-save-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var savedPlayer = killedPlayer;
                game.witchSaveUsed = true;
                game.nightKillTarget = null;
                
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                
                // 记录女巫解药到gameLog
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'witchSave',
                    targetId: savedPlayer ? savedPlayer.id : null,
                    targetName: savedPlayer ? savedPlayer.name : '某人'
                });
                
                self.addGameMessage({ type: 'system', content: '女巫使用了解药' });
                actionArea.innerHTML = self.renderGameActions();
                callback();
            };
        }
        
        var poisonBtn = actionArea.querySelector('#witch-poison-btn');
        if (poisonBtn) {
            poisonBtn.onclick = function() {
                // 【修复】进入毒药选择界面，更新操作类型
                game.pendingUserAction = 'witch_poison';
                self.showWitchPoisonTargets(callback);
            };
        }
        
        var skipBtn = actionArea.querySelector('#witch-skip-btn');
        if (skipBtn) {
            skipBtn.onclick = function() {
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                actionArea.innerHTML = self.renderGameActions();
                callback();
            };
        }
    };
    
    // 显示女巫毒药目标
    ChatApp.prototype.showWitchPoisonTargets = function(callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        var targets = game.players.filter(function(p) { return p.isAlive && !p.isUser; });
        
        var html = '<div style="padding:8px 0;">';
        html += '<div style="font-size:11px;color:#7a5a8a;margin-bottom:10px;text-align:center;">选择毒药目标</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        
        targets.forEach(function(target) {
            html += '<button class="poison-target-btn" data-id="' + target.id + '" style="padding:8px 12px;background:rgba(140,100,170,0.2);border:1px solid rgba(140,100,170,0.4);border-radius:8px;color:#8c64aa;font-size:11px;cursor:pointer;">' + target.name + '</button>';
        });
        
        html += '<button id="cancel-poison-btn" style="padding:8px 12px;background:rgba(100,80,120,0.1);border:1px solid rgba(100,80,120,0.25);border-radius:8px;color:#7a6a8a;font-size:11px;cursor:pointer;">取消</button>';
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        actionArea.querySelectorAll('.poison-target-btn').forEach(function(btn) {
            btn.onclick = function() {
                var targetId = btn.getAttribute('data-id');
                var targetPlayer = game.players.find(function(p) { return p.id === targetId; });
                game.witchPoisonUsed = true;
                game.witchPoisonTarget = targetId;
                
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                
                // 记录女巫毒药到gameLog
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'witchPoison',
                    targetId: targetId,
                    targetName: targetPlayer ? targetPlayer.name : '某人'
                });
                
                self.addGameMessage({ type: 'system', content: '女巫使用了毒药' });
                actionArea.innerHTML = self.renderGameActions();
                callback();
            };
        });
        
        var cancelBtn = actionArea.querySelector('#cancel-poison-btn');
        if (cancelBtn) {
            cancelBtn.onclick = function() {
                // 【修复】返回女巫主操作界面
                game.pendingUserAction = 'witch_action';
                self.showUserWitchAction({ isUser: true }, callback);
            };
        }
    };
    
    // AI女巫决策
    ChatApp.prototype.aiWitchDecision = function(witch, callback) {
        var self = this;
        var game = this.currentGame;
        
        // 使用字符串比较确保 ID 匹配
        var killedPlayer = game.players.find(function(p) { return String(p.id) === String(game.nightKillTarget); });
        
        // 上帝视角：生成女巫思考场景
        if (game.isGodMode) {
            this.generateWitchThinking(witch, killedPlayer, function(decision) {
                if (decision.useSave && killedPlayer && !game.witchSaveUsed) {
                    game.witchSaveUsed = true;
                    game.nightKillTarget = null;
                    
                    // 记录女巫解药到gameLog（包含心理活动）
                    game.gameLog.push({
                        round: game.round,
                        event: 'nightAction',
                        action: 'witchSave',
                        witchId: witch.id,
                        witchName: witch.name,
                        targetId: killedPlayer.id,
                        targetName: killedPlayer.name,
                        reason: decision.reason || ''
                    });
                    
                    self.addGameMessage({ type: 'system', content: '女巫使用了解药救了 ' + killedPlayer.name });
                }
                
                if (decision.usePoison && decision.poisonTarget && !game.witchPoisonUsed) {
                    game.witchPoisonUsed = true;
                    game.witchPoisonTarget = decision.poisonTarget;
                    var poisonedPlayer = game.players.find(function(p) { return p.id === decision.poisonTarget; });
                    
                    // 记录女巫毒药到gameLog（包含心理活动）
                    game.gameLog.push({
                        round: game.round,
                        event: 'nightAction',
                        action: 'witchPoison',
                        witchId: witch.id,
                        witchName: witch.name,
                        targetId: decision.poisonTarget,
                        targetName: poisonedPlayer ? poisonedPlayer.name : '某人',
                        reason: decision.reason || ''
                    });
                    
                    self.addGameMessage({ type: 'system', content: '女巫使用了毒药毒死 ' + (poisonedPlayer ? poisonedPlayer.name : '某人') });
                }
                
                if (!decision.useSave && !decision.usePoison) {
                    // 记录女巫不行动的原因
                    game.gameLog.push({
                        round: game.round,
                        event: 'nightAction',
                        action: 'witchSkip',
                        witchId: witch.id,
                        witchName: witch.name,
                        reason: decision.reason || ''
                    });
                    self.addGameMessage({ type: 'system', content: '女巫选择不使用药水' });
                }
                
                self.updateGameUI();
                callback();
            });
        } else {
            // 普通模式：静默决策
            this.callGameAI(witch.id, 'witch_action', {
                killedPlayer: killedPlayer ? { id: killedPlayer.id, name: killedPlayer.name } : null,
                hasSavePotion: !game.witchSaveUsed,
                hasPoisonPotion: !game.witchPoisonUsed,
                alivePlayers: game.players.filter(function(p) { return p.isAlive && p.id !== witch.id; }).map(function(p) { return { id: p.id, name: p.name }; })
            }, function(response) {
                var decision = self.parseWitchDecision(response);
                
                if (decision.useSave && killedPlayer && !game.witchSaveUsed) {
                    game.witchSaveUsed = true;
                    game.nightKillTarget = null;
                    
                    // 记录女巫解药到gameLog
                    game.gameLog.push({
                        round: game.round,
                        event: 'nightAction',
                        action: 'witchSave',
                        witchId: witch.id,
                        witchName: witch.name,
                        targetId: killedPlayer.id,
                        targetName: killedPlayer.name
                    });
                }
                
                if (decision.usePoison && decision.poisonTarget && !game.witchPoisonUsed) {
                    game.witchPoisonUsed = true;
                    game.witchPoisonTarget = decision.poisonTarget;
                    var poisonedPlayer = game.players.find(function(p) { return p.id === decision.poisonTarget; });
                    
                    // 记录女巫毒药到gameLog
                    game.gameLog.push({
                        round: game.round,
                        event: 'nightAction',
                        action: 'witchPoison',
                        witchId: witch.id,
                        witchName: witch.name,
                        targetId: decision.poisonTarget,
                        targetName: poisonedPlayer ? poisonedPlayer.name : '某人'
                    });
                }
                
                self.updateGameUI();
                callback();
            });
        }
    };
    
    // 生成女巫思考场景（上帝视角）- 聚焦心理博弈
    ChatApp.prototype.generateWitchThinking = function(witch, killedPlayer, callback) {
        var self = this;
        var game = this.currentGame;
        
        // 获取女巫性格
        var witchAI = PhoneCore.getAI(witch.id);
        var witchPersonality = witchAI && witchAI.personality ? witchAI.personality.substring(0, 80) : '';
        
        var prompt = '<scene>第' + game.round + '夜，' + witch.name + '（女巫）的内心独白</scene>\n';
        if (witchPersonality) prompt += '<personality>' + witchPersonality + '</personality>\n\n';
        
        prompt += '<situation>\n';
        if (killedPlayer && !game.witchSaveUsed) {
            prompt += killedPlayer.name + '被狼人杀了\n';
            prompt += '你有解药，可以救（但只有这一瓶！）\n';
            if (game.round === 1) {
                prompt += '【首夜救人风险提示】\n';
                prompt += '• 狼人可能自刀（故意杀队友骗药）\n';
                prompt += '• 不清楚被杀者身份，可能救了狼人\n';
                prompt += '• 老玩家一般首夜不救，留药救关键神职\n';
                prompt += '• 建议：首夜不救，观察白天发言再说\n';
            } else {
                prompt += '根据ta白天的表现，像好人吗？值得救吗？\n';
                prompt += '• 解药只有一瓶，要谨慎，别谁都救\n';
            }
        } else if (game.witchSaveUsed) {
            prompt += '（解药已用完）\n';
        } else if (!killedPlayer) {
            prompt += '平安夜，无人被刀\n';
        }
        
        if (!game.witchPoisonUsed) {
            prompt += '你有毒药\n';
            prompt += '可毒：' + game.players.filter(function(p) { return p.isAlive && p.id !== witch.id; }).map(function(p) { return p.name; }).join('、') + '\n';
            if (game.round === 1) {
                prompt += '（首夜盲毒风险很大，不建议用）\n';
            }
        }
        prompt += '</situation>\n\n';
        
        prompt += '<output>\n';
        prompt += '写一段内心独白（20-35字），用你的性格\n';
        prompt += '示例风格：\n';
        prompt += '• "卧槽要不要救啊...算了首夜先不动"\n';
        prompt += '• "这人今天挺正的，救一下吧"\n';
        prompt += '• "我毒xxx，今天ta太假了"\n';
        prompt += '\n最后必须加决定标签：\n';
        prompt += '[决定:救人] 或 [决定:毒xxx] 或 [决定:不用]\n';
        prompt += '</output>';
        
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (!apiConfigId) {
            // 无API，不显示默认描述，直接做决定
            var decision = { useSave: false, usePoison: false, poisonTarget: null, reason: '' };
            // 第一轮不救人（概率只有10%救，因为狼人可能自刀），后续轮次40%概率救
            if (killedPlayer && !game.witchSaveUsed) {
                var saveChance = game.round === 1 ? 0.1 : 0.4;
                if (Math.random() < saveChance) {
                    decision.useSave = true;
                    decision.reason = game.round === 1 ? '首夜冒险救一下' : '这人感觉是好人，救了';
                } else {
                    decision.reason = game.round === 1 ? '首夜不救，观察一下' : '药留着吧，不确定';
                }
            }
            callback(decision);
            return;
        }
        
        // 修复：使用messages格式，兼容Gemini等API
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call('狼人杀旁白，中文回复。', apiConfigId, {
            messages: [{ role: 'user', content: prompt }],
            maxTokens: configuredMaxTokens,
            temperature: 0.9
        }).then(function(response) {
            var content = response && typeof response === 'object' ? response.content : response;
            
            var decision = { useSave: false, usePoison: false, poisonTarget: null, reason: '' };
            
            // 解析决定
            var decisionMatch = content.match(/\[决定[:：]([^\]]+)\]/);
            if (decisionMatch) {
                var decisionText = decisionMatch[1].trim();
                if (decisionText.includes('救')) {
                    decision.useSave = true;
                } else if (decisionText.includes('毒')) {
                    decision.usePoison = true;
                    // 提取毒杀目标
                    game.players.forEach(function(p) {
                        if (decisionText.includes(p.name)) {
                            decision.poisonTarget = p.id;
                        }
                    });
                }
                content = content.replace(/\[决定[:：][^\]]+\]/, '').trim();
            }
            
            // 保存思考内容作为决策原因
            decision.reason = content || '';
            
            // 显示思考场景
            if (content) {
                self.addGameMessage({
                    type: 'narrative',
                    content: content
                });
            }
            
            callback(decision);
        }).catch(function() {
            callback({ useSave: false, usePoison: false, poisonTarget: null, reason: '' });
        });
    };
    
    // 解析女巫决定
    ChatApp.prototype.parseWitchDecision = function(response) {
        var decision = { useSave: false, usePoison: false, poisonTarget: null };
        
        // 确保response是字符串
        if (typeof response === 'object' && response.content) {
            response = response.content;
        }
        if (typeof response !== 'string') {
            return decision;
        }
        
        var lowerResponse = response.toLowerCase();
        
        if (lowerResponse.includes('解药') || lowerResponse.includes('救') || lowerResponse.includes('save')) {
            decision.useSave = true;
        }
        
        if (lowerResponse.includes('毒药') || lowerResponse.includes('毒') || lowerResponse.includes('poison')) {
            decision.usePoison = true;
            // 尝试从回复中提取目标
            var game = this.currentGame;
            game.players.forEach(function(p) {
                if (response.includes(p.name)) {
                    decision.poisonTarget = p.id;
                }
            });
        }
        
        return decision;
    };
    
    // 守卫行动
    ChatApp.prototype.processGuardAction = function(guard, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.addGameMessage({
            type: 'system',
            content: '守卫请睁眼...'
        });
        this.updateGameUI();
        
        var targets = game.players.filter(function(p) { return p.isAlive; });
        
        if (guard.isUser) {
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'guard_protect';
            game.pendingActionData = { targets: targets.map(function(p) { return p.id; }) };
            self.notifyUserTurn('guard_protect');
            setTimeout(function() {
                self.showUserGuardAction(targets, callback);
            }, 500);
        } else {
            this.aiGuardDecision(guard, targets, callback);
        }
    };
    
    // 用户守卫操作
    ChatApp.prototype.showUserGuardAction = function(targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return callback();
        
        // 【修复】标记等待用户操作
        game.pendingUserAction = 'guard_protect';
        game.pendingActionData = { targets: targets.map(function(t) { return t.id; }) };
        
        var html = '<div style="padding:8px 0;">';
        html += '<div style="font-size:11px;color:#5a7a9a;margin-bottom:10px;text-align:center;">选择要守护的玩家</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        
        targets.forEach(function(target) {
            html += '<button class="guard-target-btn" data-id="' + target.id + '" style="padding:8px 12px;background:rgba(80,130,180,0.2);border:1px solid rgba(80,130,180,0.4);border-radius:8px;color:#5082b4;font-size:11px;cursor:pointer;">' + target.name + '</button>';
        });
        
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        actionArea.querySelectorAll('.guard-target-btn').forEach(function(btn) {
            btn.onclick = function() {
                var targetId = btn.getAttribute('data-id');
                var targetPlayer = game.players.find(function(p) { return p.id === targetId; });
                game.guardedPlayer = targetId;
                
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                game.pendingActionData = null;
                
                // 记录守卫守护到gameLog
                game.gameLog.push({
                    round: game.round,
                    event: 'nightAction',
                    action: 'guardProtect',
                    targetId: targetId,
                    targetName: targetPlayer ? targetPlayer.name : '某人'
                });
                
                self.addGameMessage({ type: 'system', content: '守卫选择了守护目标' });
                actionArea.innerHTML = self.renderGameActions();
                callback();
            };
        });
    };
    
    // AI守卫决策
    ChatApp.prototype.aiGuardDecision = function(guard, targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.callGameAI(guard.id, 'guard_protect', {
            targets: targets.map(function(t) { return { id: t.id, name: t.name }; })
        }, function(response) {
            var targetId = self.parseTargetFromResponse(response, targets);
            game.guardedPlayer = targetId;
            var target = game.players.find(function(p) { return p.id === targetId; });
            
            // 记录守卫守护到gameLog
            game.gameLog.push({
                round: game.round,
                event: 'nightAction',
                action: 'guardProtect',
                guardId: guard.id,
                guardName: guard.name,
                targetId: targetId,
                targetName: target ? target.name : '某人'
            });
            
            if (game.isGodMode) {
                if (target) {
                    var narratives = [
                        guard.name + '警觉地环顾四周，最终在' + target.name + '身旁驻守，手握武器严阵以待。',
                        '夜色中，' + guard.name + '悄无声息地移动到' + target.name + '附近，守护着ta的安全。',
                        guard.name + '深吸一口气，决定今晚守在' + target.name + '身边，愿这道屏障能挡住黑暗。'
                    ];
                    self.addGameMessage({
                        type: 'narrative',
                        content: narratives[Math.floor(Math.random() * narratives.length)]
                    });
                    self.addGameMessage({ type: 'system', content: '守卫守护了 ' + target.name });
                }
            }
            
            self.updateGameUI();
            callback();
        });
    };
    
    // 丘比特行动
    ChatApp.prototype.processCupidAction = function(cupid, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.addGameMessage({
            type: 'system',
            content: '丘比特请睁眼，选择一对情侣...'
        });
        this.updateGameUI();
        
        var targets = game.players.filter(function(p) { return p.isAlive; });
        
        if (cupid.isUser) {
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'cupid_link';
            game.pendingActionData = { targets: targets.map(function(p) { return p.id; }) };
            self.notifyUserTurn('cupid_link');
            setTimeout(function() {
                self.showUserCupidAction(targets, callback);
            }, 500);
        } else {
            this.aiCupidDecision(cupid, targets, callback);
        }
    };
    
    // 用户丘比特操作
    ChatApp.prototype.showUserCupidAction = function(targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return callback();
        
        // 【修复】标记等待用户操作
        game.pendingUserAction = 'cupid_link';
        game.pendingActionData = { targets: targets.map(function(t) { return t.id; }) };
        
        var selectedLovers = [];
        
        var renderSelection = function() {
            var html = '<div style="padding:8px 0;">';
            html += '<div style="font-size:11px;color:#9a5a7a;margin-bottom:10px;text-align:center;">选择两名玩家成为情侣 (' + selectedLovers.length + '/2)</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
            
            targets.forEach(function(target) {
                var isSelected = selectedLovers.includes(target.id);
                html += '<button class="cupid-target-btn" data-id="' + target.id + '" style="padding:8px 12px;background:' + (isSelected ? 'rgba(200,90,138,0.4)' : 'rgba(200,90,138,0.2)') + ';border:1px solid ' + (isSelected ? '#c85a8a' : 'rgba(200,90,138,0.4)') + ';border-radius:8px;color:#c85a8a;font-size:11px;cursor:pointer;">' + target.name + '</button>';
            });
            
            html += '</div>';
            
            if (selectedLovers.length === 2) {
                html += '<button id="confirm-lovers-btn" style="margin-top:12px;width:100%;padding:10px;background:#c85a8a;border:1px solid #d86a9a;border-radius:8px;color:white;font-size:11px;cursor:pointer;">确认连接</button>';
            }
            
            html += '</div>';
            
            actionArea.innerHTML = html;
            
            actionArea.querySelectorAll('.cupid-target-btn').forEach(function(btn) {
                btn.onclick = function() {
                    var targetId = btn.getAttribute('data-id');
                    var idx = selectedLovers.indexOf(targetId);
                    if (idx > -1) {
                        selectedLovers.splice(idx, 1);
                    } else if (selectedLovers.length < 2) {
                        selectedLovers.push(targetId);
                    }
                    renderSelection();
                };
            });
            
            var confirmBtn = actionArea.querySelector('#confirm-lovers-btn');
            if (confirmBtn) {
                confirmBtn.onclick = function() {
                    game.lovers = selectedLovers;
                    
                    // 【修复】清除等待用户操作标记
                    game.pendingUserAction = null;
                    game.pendingActionData = null;
                    
                    var lover1 = game.players.find(function(p) { return p.id === selectedLovers[0]; });
                    var lover2 = game.players.find(function(p) { return p.id === selectedLovers[1]; });
                    self.addGameMessage({ type: 'system', content: lover1.name + ' 和 ' + lover2.name + ' 成为了情侣' });
                    actionArea.innerHTML = self.renderGameActions();
                    callback();
                };
            }
        };
        
        renderSelection();
    };
    
    // AI丘比特决策
    ChatApp.prototype.aiCupidDecision = function(cupid, targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        // AI随机选择两人
        var shuffled = targets.slice().sort(function() { return Math.random() - 0.5; });
        game.lovers = [shuffled[0].id, shuffled[1].id];
        
        var lover1 = game.players.find(function(p) { return p.id === game.lovers[0]; });
        var lover2 = game.players.find(function(p) { return p.id === game.lovers[1]; });
        
        if (game.isGodMode) {
            self.addGameMessage({ type: 'system', content: '丘比特连接了 ' + lover1.name + ' 和 ' + lover2.name });
        } else {
            self.addGameMessage({ type: 'system', content: '丘比特完成了连接' });
        }
        
        self.updateGameUI();
        callback();
    };
    
    // 处理夜晚结果
    ChatApp.prototype.resolveNightResults = function() {
        var self = this;
        var game = this.currentGame;
        
        var deadThisNight = [];
        var deathCauses = {}; // 记录每个死亡玩家的死因
        
        // 狼人击杀（如果没被守卫保护且没被女巫救）
        if (game.nightKillTarget && String(game.nightKillTarget) !== String(game.guardedPlayer)) {
            deadThisNight.push(game.nightKillTarget);
            deathCauses[game.nightKillTarget] = 'night'; // 被狼人杀害
        }
        
        // 女巫毒杀
        if (game.witchPoisonTarget) {
            if (!deadThisNight.includes(game.witchPoisonTarget)) {
                deadThisNight.push(game.witchPoisonTarget);
            }
            deathCauses[game.witchPoisonTarget] = 'witch_poison'; // 被女巫毒杀
            game.witchPoisonTarget = null;
        }
        
        // 处理死亡（使用正确的死因）
        deadThisNight.forEach(function(playerId) {
            var cause = deathCauses[playerId] || 'night';
            self.killPlayer(playerId, cause);
        });
        
        // 进入白天 - 逐句显示消息
        var dayMessages = [];
        dayMessages.push({ type: 'phase', content: '天亮了', color: '#f39c12' });
        
        if (deadThisNight.length > 0) {
            // 逐个显示死亡信息
            deadThisNight.forEach(function(id) {
                var p = game.players.find(function(pp) { return String(pp.id) === String(id); });
                if (p) {
                    dayMessages.push({ type: 'system', content: p.name + ' 昨晚死亡' });
                }
            });
        } else {
            dayMessages.push({ type: 'system', content: '平安夜，无人死亡' });
        }
        
        // 检查是否有猎人需要开枪
        var huntersToShoot = [];
        deadThisNight.forEach(function(playerId) {
            var player = game.players.find(function(p) { return String(p.id) === String(playerId); });
            if (player && player.role === 'hunter') {
                huntersToShoot.push(player);
            }
        });
        
        // 进入发言阶段的函数
        var proceedToSpeech = function() {
            self.updateGameUI();
            
            // 检查游戏是否结束
            if (self.checkGameEnd()) {
                return;
            }
            
            // 进入白天发言阶段
            game.phase = 'day_speech';
            game.currentSpeaker = 0;
            
            // 按座位号顺序生成发言顺序
            var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
            // 按座位号排序存活玩家，然后生成索引顺序
            var sortedBySeats = alivePlayers.slice().sort(function(a, b) { return a.seatNumber - b.seatNumber; });
            game.speechOrder = sortedBySeats.map(function(p) {
                return alivePlayers.findIndex(function(ap) { return ap.id === p.id; });
            });
            
            setTimeout(function() {
                self.runGamePhase();
            }, 1500);
        };
        
        // 逐句显示，然后处理猎人技能
        this.addGameMessagesSequentially(dayMessages, 500, function() {
            // 如果有猎人需要开枪
            if (huntersToShoot.length > 0) {
                // 处理猎人开枪（带callback）
                var processHunterIndex = 0;
                var processNextHunter = function() {
                    if (processHunterIndex >= huntersToShoot.length) {
                        // 所有猎人处理完毕，继续发言阶段
                        proceedToSpeech();
                        return;
                    }
                    var hunter = huntersToShoot[processHunterIndex];
                    processHunterIndex++;
                    self.triggerHunterSkill(hunter, processNextHunter);
                };
                processNextHunter();
            } else {
                // 没有猎人，直接进入发言阶段
                proceedToSpeech();
            }
        });
        
        this.updateGameUI();
    };
    
    // 杀死玩家
    ChatApp.prototype.killPlayer = function(playerId, cause) {
        var game = this.currentGame;
        var player = game.players.find(function(p) { return p.id === playerId; });
        
        if (player && player.isAlive) {
            player.isAlive = false;
            game.deadPlayers.push(playerId);
            game.alivePlayers = game.alivePlayers.filter(function(id) { return id !== playerId; });
            
            // 记录死亡日志
            game.gameLog.push({
                round: game.round,
                event: 'death',
                playerId: playerId,
                playerName: player.name,
                cause: cause
            });
            
            // 情侣殉情
            if (game.lovers && game.lovers.includes(playerId)) {
                var loverId = game.lovers.find(function(id) { return id !== playerId; });
                var lover = game.players.find(function(p) { return p.id === loverId; });
                if (lover && lover.isAlive) {
                    this.addGameMessage({
                        type: 'system',
                        content: lover.name + ' 因情侣死亡而殉情'
                    });
                    this.killPlayer(loverId, 'lover_death');
                }
            }
        }
    };
    
    // 猎人技能（带callback，确保开枪完成后再继续流程）
    ChatApp.prototype.triggerHunterSkill = function(hunter, callback) {
        var self = this;
        var game = this.currentGame;
        
        this.addGameMessage({
            type: 'system',
            content: hunter.name + ' 是猎人，可以开枪带走一人'
        });
        
        if (hunter.isUser) {
            // 用户选择开枪目标
            var targets = game.players.filter(function(p) { return p.isAlive; });
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'hunter_shoot';
            game.pendingActionData = { targets: targets.map(function(t) { return t.id; }), callback: callback };
            this.notifyUserTurn('hunter_shoot');
            this.showHunterShootAction(targets, callback);
        } else {
            // AI选择开枪目标
            var targets = game.players.filter(function(p) { return p.isAlive; });
            var targetIdx = Math.floor(Math.random() * targets.length);
            var target = targets[targetIdx];
            
            this.addGameMessage({
                type: 'system',
                content: hunter.name + ' 开枪带走了 ' + target.name
            });
            this.killPlayer(target.id, 'hunter');
            
            // AI开枪后立即回调
            if (callback) callback();
        }
    };
    
    // 用户猎人开枪（带callback）
    ChatApp.prototype.showHunterShootAction = function(targets, callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return;
        
        // 【修复】标记等待用户操作，保存callback
        game.pendingUserAction = 'hunter_shoot';
        game.pendingActionData = { targets: targets.map(function(t) { return t.id; }), callback: callback };
        
        var html = '<div style="padding:8px 0;">';
        html += '<div style="font-size:11px;color:#9a6a3a;margin-bottom:10px;text-align:center;">你是猎人，选择开枪目标</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        
        targets.forEach(function(target) {
            html += '<button class="hunter-target-btn" data-id="' + target.id + '" style="padding:8px 12px;background:rgba(200,140,80,0.2);border:1px solid rgba(200,140,80,0.4);border-radius:8px;color:#c88c50;font-size:11px;cursor:pointer;">' + target.name + '</button>';
        });
        
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        actionArea.querySelectorAll('.hunter-target-btn').forEach(function(btn) {
            btn.onclick = function() {
                var targetId = btn.getAttribute('data-id');
                var target = game.players.find(function(p) { return p.id === targetId; });
                
                // 保存callback引用
                var savedCallback = game.pendingActionData ? game.pendingActionData.callback : callback;
                
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                game.pendingActionData = null;
                
                self.addGameMessage({
                    type: 'system',
                    content: '你开枪带走了 ' + target.name
                });
                self.killPlayer(targetId, 'hunter');
                actionArea.innerHTML = self.renderGameActions();
                self.updateGameUI();
                
                // 【关键】用户开枪完成后，调用callback继续游戏流程
                if (savedCallback) {
                    setTimeout(function() {
                        savedCallback();
                    }, 500);
                }
            };
        });
    };
    
    // 白天发言阶段
    ChatApp.prototype.runDaySpeechPhase = function() {
        var self = this;
        var game = this.currentGame;
        
        var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
        
        // 确保有发言顺序（如果没有则按座位号顺序生成）
        if (!game.speechOrder || game.speechOrder.length === 0) {
            // 按座位号排序存活玩家，然后生成索引顺序
            var sortedBySeats = alivePlayers.slice().sort(function(a, b) { return a.seatNumber - b.seatNumber; });
            game.speechOrder = sortedBySeats.map(function(p) {
                return alivePlayers.findIndex(function(ap) { return ap.id === p.id; });
            });
        }
        
        // 更新发言顺序显示
        this.updateSpeechOrderDisplay();
        
        if (game.currentSpeaker >= alivePlayers.length) {
            // 发言结束，隐藏发言顺序栏，进入投票
            this.hideSpeechOrderDisplay();
            game.phase = 'day_vote';
            setTimeout(function() {
                self.runGamePhase();
            }, 500);
            return;
        }
        
        // 使用随机顺序获取发言者
        var speakerIndex = game.speechOrder[game.currentSpeaker];
        var speaker = alivePlayers[speakerIndex];
        
        this.addGameMessage({
            type: 'system',
            content: '请 ' + speaker.name + ' 发言 (' + (game.currentSpeaker + 1) + '/' + alivePlayers.length + ')'
        });
        this.updateGameUI();
        
        if (speaker.isUser) {
            // 用户发言
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'speech';
            this.notifyUserTurn('speech');
            this.showUserSpeechInput();
        } else {
            // AI发言
            this.processAISpeech(speaker);
        }
    };
    
    // 更新发言顺序显示
    ChatApp.prototype.updateSpeechOrderDisplay = function() {
        var game = this.currentGame;
        if (!game || !this.gamePageElement) return;
        
        var orderBar = this.gamePageElement.querySelector('#speech-order-bar');
        var orderList = this.gamePageElement.querySelector('#speech-order-list');
        if (!orderBar || !orderList) return;
        
        var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
        if (!game.speechOrder || game.speechOrder.length === 0) return;
        
        // 显示发言顺序栏
        orderBar.style.display = 'block';
        
        var html = '';
        var self = this;
        game.speechOrder.forEach(function(playerIdx, orderIdx) {
            var player = alivePlayers[playerIdx];
            if (!player) return;
            
            var isCurrent = orderIdx === game.currentSpeaker;
            var isDone = orderIdx < game.currentSpeaker;
            var bgColor = isCurrent ? '#4A90D9' : isDone ? '#9BBF5A' : 'rgba(74,144,217,0.15)';
            var textColor = isCurrent || isDone ? 'white' : '#5A8FBF';
            var borderColor = isCurrent ? '#3A80C9' : isDone ? '#8BAF4A' : 'rgba(74,144,217,0.3)';
            
            html += '<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;padding:4px 8px;background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:12px;font-size:10px;color:' + textColor + ';' + (isCurrent ? 'box-shadow:0 2px 6px rgba(74,144,217,0.3);' : '') + '">';
            html += '<span style="font-weight:600;">' + (orderIdx + 1) + '</span>';
            html += '<span>' + player.name + '</span>';
            if (isDone) {
                html += '<span style="font-size:8px;">✓</span>';
            } else if (isCurrent) {
                html += '<span style="font-size:8px;animation:pulse 1s infinite;">●</span>';
            }
            html += '</div>';
        });
        
        orderList.innerHTML = html;
    };
    
    // 隐藏发言顺序显示
    ChatApp.prototype.hideSpeechOrderDisplay = function() {
        if (!this.gamePageElement) return;
        var orderBar = this.gamePageElement.querySelector('#speech-order-bar');
        if (orderBar) {
            orderBar.style.display = 'none';
        }
    };
    
    // 用户发言输入（无时间限制，可发多条消息）
    ChatApp.prototype.showUserSpeechInput = function() {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return;
        
        // 【修复】标记等待用户操作
        game.pendingUserAction = 'speech';
        
        var speechEnded = false;
        var userMessageCount = 0;
        
        // 计算发言顺序位置
        var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
        var speakPosition = game.currentSpeaker + 1;
        var totalSpeakers = alivePlayers.length;
        
        var html = '<div>';
        // 发言顺序显示（无倒计时）
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html += '<div style="font-size:10px;color:#5A8FBF;">';
        if (speakPosition === 1) {
            html += '你是第一个发言';
        } else {
            html += '你的发言 (' + speakPosition + '/' + totalSpeakers + ')';
        }
        html += '</div>';
        html += '<div style="font-size:10px;color:#8AAFCF;">发完点"结束发言"</div>';
        html += '</div>';
        // 输入区域
        html += '<div style="display:flex;gap:8px;align-items:flex-end;">';
        html += '<div style="flex:1;background:white;border:1px solid rgba(74,144,217,0.2);border-radius:8px;padding:8px 10px;box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);">';
        html += '<input type="text" id="user-speech-input" placeholder="输入你的发言..." style="width:100%;background:transparent;border:none;color:#3A5A80;font-size:11px;outline:none;">';
        html += '</div>';
        html += '<button id="send-speech-btn" style="padding:8px 14px;background:linear-gradient(135deg,#4A90D9,#5A9FE8);border:none;border-radius:8px;color:white;font-size:11px;cursor:pointer;box-shadow:0 2px 6px rgba(74,144,217,0.3);">发送</button>';
        html += '<button id="end-speech-btn" style="padding:8px 14px;background:#E8F4FF;border:1px solid rgba(74,144,217,0.3);border-radius:8px;color:#4A90D9;font-size:11px;cursor:pointer;">结束发言</button>';
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        var input = actionArea.querySelector('#user-speech-input');
        var sendBtn = actionArea.querySelector('#send-speech-btn');
        var endBtn = actionArea.querySelector('#end-speech-btn');
        
        input.focus();
        
        // 结束发言，进入下一个玩家
        var finishSpeech = function() {
            if (speechEnded) return;
            speechEnded = true;
            
            // 【修复】清除等待用户操作标记
            game.pendingUserAction = null;
            
            // 清除倒计时
            if (self.userSpeechTimer) {
                clearInterval(self.userSpeechTimer);
                self.userSpeechTimer = null;
            }
            
            // 如果一条消息都没发，添加一个默认消息
            if (userMessageCount === 0) {
                var userPlayer = game.players.find(function(p) { return p.isUser; });
                self.addGameMessage({
                    type: 'speech',
                    playerId: 'user',
                    playerName: userPlayer ? userPlayer.name : '玩家',
                    content: '(无发言)'
                });
            }
            
            game.currentSpeaker++;
            actionArea.innerHTML = self.renderGameActions();
            self.updateGameUI();
            
            setTimeout(function() {
                self.runDaySpeechPhase();
            }, 500);
        };
        
        // 发送消息（不结束发言）
        var sendMessage = function() {
            var content = input.value.trim();
            if (!content || speechEnded) return;
            
            var userPlayer = game.players.find(function(p) { return p.isUser; });
            self.addGameMessage({
                type: 'speech',
                playerId: 'user',
                playerName: userPlayer ? userPlayer.name : '玩家',
                content: content
            });
            
            userMessageCount++;
            input.value = '';
            input.focus();
        };
        
        sendBtn.onclick = sendMessage;
        endBtn.onclick = finishSpeech;
        input.onkeypress = function(e) {
            if (e.key === 'Enter') sendMessage();
        };
        // 无时间限制，用户自行决定何时结束发言
    };
    
    // AI发言（一次API调用，可发多条消息）
    ChatApp.prototype.processAISpeech = function(speaker) {
        var self = this;
        var game = this.currentGame;
        
        // 上帝视角：先生成心理活动
        if (game.isGodMode) {
            this.generateSpeakerMindset(speaker, function() {
                self.doAISpeech(speaker);
            });
        } else {
            this.doAISpeech(speaker);
        }
    };
    
    // 生成发言者心理（上帝视角）- 聚焦心理博弈和神态
    ChatApp.prototype.generateSpeakerMindset = function(speaker, callback) {
        var self = this;
        var game = this.currentGame;
        
        var roleInfo = this.werewolfRoles[speaker.role];
        var roleName = roleInfo ? roleInfo.name : '村民';
        var isWolf = speaker.role === 'wolf';
        
        // 获取AI性格
        var speakerAI = PhoneCore.getAI(speaker.id);
        var speakerPersonality = speakerAI && speakerAI.personality ? speakerAI.personality.substring(0, 80) : '';
        
        var prompt = '<scene>第' + game.round + '轮白天，' + speaker.name + '（' + roleName + '）准备发言</scene>\n';
        if (speakerPersonality) prompt += '<personality>' + speakerPersonality + '</personality>\n';
        
        // 获取本轮发言（不是所有发言）
        var recentSpeeches = game.chatHistory.filter(function(m) { return m.type === 'speech'; }).slice(-3);
        if (recentSpeeches.length > 0) {
            prompt += '<context>前面发言：';
            recentSpeeches.forEach(function(s) {
                prompt += s.playerName + ':' + (s.content || '').substring(0, 30) + '；';
            });
            prompt += '</context>\n';
        }
        
        prompt += '<output>\n';
        prompt += '写ta发言前的心理或神态（15-25字）\n';
        prompt += '示例：\n';
        prompt += '• 心理："完了被怀疑了，得想办法解释..."\n';
        prompt += '• 神态：ta深吸一口气，手指轻轻敲着桌子\n';
        prompt += '• 混合：ta表面镇定，内心却在飞速思考对策\n';
        prompt += '不写环境描写，只写人物状态\n';
        prompt += '</output>';
        
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (!apiConfigId) {
            // 无API，直接跳过心理描写
            callback();
            return;
        }
        
        // 修复：使用messages格式，兼容Gemini等API
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        
        // 带重试的API调用
        var maxRetries = 2;
        var retryDelay = 1000;
        
        var attemptMindsetCall = function(retryCount) {
            PhoneCore.api.call('狼人杀旁白，中文回复。', apiConfigId, {
                messages: [{ role: 'user', content: prompt }],
                maxTokens: configuredMaxTokens,
                temperature: 0.85
            }).then(function(response) {
                var content = response && typeof response === 'object' ? response.content : response;
                if (content) {
                    self.addGameMessage({
                        type: 'narrative',
                        content: content.trim()
                    });
                }
                callback();
            }).catch(function(err) {
                console.error('Mindset API call failed (attempt ' + (retryCount + 1) + '):', err);
                
                if (retryCount < maxRetries) {
                    setTimeout(function() {
                        attemptMindsetCall(retryCount + 1);
                    }, retryDelay);
                } else {
                    // 重试失败，直接跳过心理描写
                    callback();
                }
            });
        };
        
        attemptMindsetCall(0);
    };
    
    // 执行AI发言
    ChatApp.prototype.doAISpeech = function(speaker) {
        var self = this;
        var game = this.currentGame;
        
        // 计算发言顺序位置
        var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
        var speakPosition = game.currentSpeaker + 1; // 当前是第几个发言（从1开始）
        var totalSpeakers = alivePlayers.length;
        
        // 获取本轮之前的发言（只获取当前轮次白天的发言）
        var currentRoundSpeeches = [];
        var foundDayStart = false;
        for (var i = game.chatHistory.length - 1; i >= 0; i--) {
            var msg = game.chatHistory[i];
            if (msg.type === 'phase' && (msg.content.includes('天亮') || msg.content.includes('投票'))) {
                foundDayStart = true;
                break;
            }
            if (msg.type === 'speech') {
                currentRoundSpeeches.unshift(msg);
            }
        }
        
        this.callGameAI(speaker.id, 'day_speech', {
            round: game.round,
            speakPosition: speakPosition,
            totalSpeakers: totalSpeakers,
            alivePlayers: game.players.filter(function(p) { return p.isAlive; }).map(function(p) { return { name: p.name, seatNumber: p.seatNumber }; }),
            deadPlayers: game.players.filter(function(p) { return !p.isAlive; }).map(function(p) { return p.name; }),
            recentSpeeches: currentRoundSpeeches.slice(-5), // 只取本轮的发言
            multiMessage: true // 标记支持多条消息
        }, function(response) {
            // 【智能分句】根据 | 或换行分割成多条消息
            var messages = self.splitIntoSentences(response);
            
            // 逐条显示消息
            var showMessages = function(index) {
                if (index >= messages.length) {
                    // 所有消息显示完毕，进入下一个发言者
                    game.currentSpeaker++;
                    self.updateGameUI();
                    
                    setTimeout(function() {
                        self.runDaySpeechPhase();
                    }, 800);
                    return;
                }
                
                self.addGameMessage({
                    type: 'speech',
                    playerId: speaker.id,
                    playerName: speaker.name,
                    content: messages[index]
                });
                
                // 每条消息间隔600-1200ms，模拟真实发言节奏
                var delay = 600 + Math.random() * 600;
                setTimeout(function() {
                    showMessages(index + 1);
                }, delay);
            };
            
            showMessages(0);
        });
    };
    
    // 白天投票阶段（用户和AI同时投票）
    ChatApp.prototype.runDayVotePhase = function() {
        var self = this;
        var game = this.currentGame;
        
        this.addGameMessage({
            type: 'phase',
            content: '投票环节',
            color: '#e74c3c'
        });
        this.updateGameUI();
        
        var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
        game.votes = {};
        game.votedPlayers = [];
        
        // 检查是否有用户参与投票
        var userPlayer = alivePlayers.find(function(p) { return p.isUser; });
        var aiPlayers = alivePlayers.filter(function(p) { return !p.isUser; });
        
        // 用于存储AI投票结果
        game.pendingAIVotes = [];
        game.aiVotesCompleted = false;
        
        // 同时发起AI投票请求
        if (aiPlayers.length > 0) {
            this.processAllAIVotesParallel(aiPlayers, function(voteResults) {
                game.pendingAIVotes = voteResults;
                game.aiVotesCompleted = true;
                // 如果用户已经投完或无需用户投票，显示结果
                if (!userPlayer || game.userVoteCompleted) {
                    self.showAllVoteResults();
                }
            });
        } else {
            game.aiVotesCompleted = true;
        }
        
        if (userPlayer) {
            // 【修复】先设置 pendingUserAction，确保即使界面不存在（最小化状态）也能在恢复时正确显示
            game.pendingUserAction = 'vote';
            game.pendingActionData = { alivePlayers: alivePlayers.map(function(p) { return p.id; }) };
            game.userVoteCompleted = false;
            this.notifyUserTurn('vote');
            this.showUserVoteAction(alivePlayers);
        } else {
            // 无用户参与，标记为已完成
            game.userVoteCompleted = true;
            // 如果AI也完成了，显示结果
            if (game.aiVotesCompleted) {
                this.showAllVoteResults();
            }
        }
    };
    
    // 用户投票（与AI同时进行）
    ChatApp.prototype.showUserVoteAction = function(alivePlayers) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return;
        
        // 【修复】标记等待用户操作，保存参数用于恢复
        game.pendingUserAction = 'vote';
        game.pendingActionData = { alivePlayers: alivePlayers.map(function(p) { return p.id; }) };
        
        var targets = alivePlayers.filter(function(p) { return !p.isUser; });
        
        var html = '<div style="padding:8px 0;">';
        html += '<div style="font-size:11px;color:#5a7aba;margin-bottom:10px;text-align:center;">投票放逐一名玩家（所有人同时投票）</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        
        targets.forEach(function(target) {
            html += '<button class="vote-target-btn" data-id="' + target.id + '" style="padding:8px 12px;background:rgba(200,90,90,0.2);border:1px solid rgba(200,90,90,0.4);border-radius:8px;color:#c85a5a;font-size:11px;cursor:pointer;">' + target.name + '</button>';
        });
        
        html += '<button class="vote-target-btn" data-id="abstain" style="padding:8px 12px;background:rgba(90,120,170,0.1);border:1px solid rgba(90,120,170,0.25);border-radius:8px;color:#6a8aba;font-size:11px;cursor:pointer;">弃票</button>';
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        actionArea.querySelectorAll('.vote-target-btn').forEach(function(btn) {
            btn.onclick = function() {
                var targetId = btn.getAttribute('data-id');
                
                // 【修复】清除等待用户操作标记
                game.pendingUserAction = null;
                game.pendingActionData = null;
                
                // 保存用户投票（但先不显示，等所有人都投完再一起显示）
                if (targetId !== 'abstain') {
                    game.votes['user'] = targetId;
                    game.userVoteTarget = targetId;
                } else {
                    game.userVoteTarget = 'abstain';
                }
                
                game.userVoteCompleted = true;
                actionArea.innerHTML = '<div style="padding:16px;text-align:center;color:#7A9BBF;font-size:11px;">等待其他玩家投票...</div>';
                
                // 如果AI也完成了，显示所有结果
                if (game.aiVotesCompleted) {
                    self.showAllVoteResults();
                }
            };
        });
    };
    
    // 并行处理所有AI投票（不等待用户）
    ChatApp.prototype.processAllAIVotesParallel = function(aiPlayers, callback) {
        var self = this;
        var game = this.currentGame;
        
        if (aiPlayers.length === 0) {
            callback([]);
            return;
        }
        
        var completedCount = 0;
        var voteResults = [];
        
        // 同时对所有AI发起投票请求
        aiPlayers.forEach(function(voter, idx) {
            self.callGameAI(voter.id, 'vote', {
                alivePlayers: game.players.filter(function(p) { return p.isAlive && p.id !== voter.id; }).map(function(p) { return { id: p.id, name: p.name }; }),
                speeches: game.chatHistory.filter(function(m) { return m.type === 'speech'; }).slice(-10)
            }, function(response) {
                var targetId = self.parseTargetFromResponse(response, game.players.filter(function(p) { return p.isAlive && p.id !== voter.id; }));
                
                // 保存结果，保持顺序
                voteResults[idx] = {
                    voter: voter,
                    targetId: targetId
                };
                
                completedCount++;
                
                // 所有AI都投票完成后，调用回调
                if (completedCount === aiPlayers.length) {
                    callback(voteResults);
                }
            });
        });
    };
    
    // 显示所有投票结果（用户和AI同时揭晓）
    ChatApp.prototype.showAllVoteResults = function() {
        var self = this;
        var game = this.currentGame;
        
        // 先显示用户的投票
        var userPlayer = game.players.find(function(p) { return p.isUser && p.isAlive; });
        if (userPlayer && game.userVoteTarget) {
            if (game.userVoteTarget !== 'abstain') {
                game.votes['user'] = game.userVoteTarget;
                var target = game.players.find(function(p) { return p.id === game.userVoteTarget; });
                this.addGameMessage({
                    type: 'system',
                    content: '你投票给了 ' + (target ? target.name : '某人')
                });
            } else {
                this.addGameMessage({
                    type: 'system',
                    content: '你选择了弃票'
                });
            }
            game.votedPlayers.push('user');
        }
        
        // 按顺序显示AI投票结果
        var voteResults = game.pendingAIVotes || [];
        this.displayVoteResults(voteResults, game, function() {
            self.resolveVoteResults();
        });
    };
    
    // 处理所有AI投票（并行调用API，同时投票）
    ChatApp.prototype.processAllAIVotes = function(aiPlayers, index) {
        var self = this;
        var game = this.currentGame;
        
        // 如果没有AI玩家需要投票，直接统计结果
        if (aiPlayers.length === 0) {
            setTimeout(function() {
                self.resolveVoteResults();
            }, 500);
            return;
        }
        
        // 记录已完成的投票数和结果
        var completedCount = 0;
        var voteResults = [];
        
        // 同时对所有AI发起投票请求
        aiPlayers.forEach(function(voter, idx) {
            self.callGameAI(voter.id, 'vote', {
                alivePlayers: game.players.filter(function(p) { return p.isAlive && p.id !== voter.id; }).map(function(p) { return { id: p.id, name: p.name }; }),
                speeches: game.chatHistory.filter(function(m) { return m.type === 'speech'; }).slice(-10)
            }, function(response) {
                var targetId = self.parseTargetFromResponse(response, game.players.filter(function(p) { return p.isAlive && p.id !== voter.id; }));
                
                // 保存结果，保持顺序
                voteResults[idx] = {
                    voter: voter,
                    targetId: targetId
                };
                
                completedCount++;
                
                // 所有AI都投票完成后，按顺序显示结果
                if (completedCount === aiPlayers.length) {
                    self.displayVoteResults(voteResults, game, function() {
                        self.resolveVoteResults();
                    });
                }
            });
        });
    };
    
    // 按顺序显示投票结果（营造同时投票后揭晓的感觉）
    ChatApp.prototype.displayVoteResults = function(voteResults, game, callback) {
        var self = this;
        var displayIndex = 0;
        
        function displayNext() {
            if (displayIndex >= voteResults.length) {
                // 所有结果显示完毕
                setTimeout(callback, 500);
                return;
            }
            
            var result = voteResults[displayIndex];
            var voter = result.voter;
            var targetId = result.targetId;
            
            if (targetId) {
                game.votes[voter.id] = targetId;
                var target = game.players.find(function(p) { return p.id === targetId; });
                self.addGameMessage({
                    type: 'system',
                    content: voter.name + ' 投票给了 ' + (target ? target.name : '某人')
                });
            } else {
                self.addGameMessage({
                    type: 'system',
                    content: voter.name + ' 弃票'
                });
            }
            
            game.votedPlayers.push(voter.id);
            self.updateGameUI();
            
            displayIndex++;
            // 快速连续显示，营造同时投票的感觉
            setTimeout(displayNext, 150);
        }
        
        // 稍等一下再开始显示，给用户一个"思考中"的感觉
        setTimeout(displayNext, 300);
    };
    
    // 统计投票结果
    ChatApp.prototype.resolveVoteResults = function() {
        var self = this;
        var game = this.currentGame;
        
        // 统计票数
        var voteCount = {};
        for (var voterId in game.votes) {
            var targetId = game.votes[voterId];
            voteCount[targetId] = (voteCount[targetId] || 0) + 1;
        }
        
        // 记录投票详情到gameLog（供AI分析）
        var voteDetails = [];
        for (var voterId in game.votes) {
            var voter = game.players.find(function(p) { return p.id === voterId; });
            var target = game.players.find(function(p) { return p.id === game.votes[voterId]; });
            if (voter && target) {
                voteDetails.push({ voterId: voterId, voterName: voter.name, targetId: game.votes[voterId], targetName: target.name });
            }
        }
        game.gameLog.push({
            round: game.round,
            event: 'voteRecord',
            votes: voteDetails
        });
        
        // 找出最高票
        var maxVotes = 0;
        var maxVotedPlayers = [];
        
        for (var playerId in voteCount) {
            if (voteCount[playerId] > maxVotes) {
                maxVotes = voteCount[playerId];
                maxVotedPlayers = [playerId];
            } else if (voteCount[playerId] === maxVotes) {
                maxVotedPlayers.push(playerId);
            }
        }
        
        if (maxVotedPlayers.length === 1 && maxVotes > 0) {
            var eliminatedId = maxVotedPlayers[0];
            var eliminated = game.players.find(function(p) { return p.id === eliminatedId; });
            
            this.addGameMessage({
                type: 'system',
                content: eliminated.name + ' 以 ' + maxVotes + ' 票被放逐'
            });
            
            // 添加遗言环节
            this.addGameMessage({
                type: 'system',
                content: eliminated.name + ' 可以发表遗言'
            });
            
            this.updateGameUI();
            
            // 触发遗言环节
            this.triggerLastWords(eliminated, function() {
                // 遗言结束后杀死玩家
                self.killPlayer(eliminatedId, 'vote');
                
                // 进入夜晚的函数
                var proceedToNight = function() {
                    self.updateGameUI();
                    
                    // 检查游戏是否结束
                    if (self.checkGameEnd()) {
                        return;
                    }
                    
                    // 进入下一个夜晚
                    game.phase = 'night';
                    
                    setTimeout(function() {
                        self.runGamePhase();
                    }, 1500);
                };
                
                // 猎人技能（带callback等待开枪完成）
                if (eliminated.role === 'hunter') {
                    self.triggerHunterSkill(eliminated, proceedToNight);
                } else {
                    proceedToNight();
                }
            });
            return; // 等待遗言环节完成
            
        } else if (maxVotedPlayers.length > 1) {
            var names = maxVotedPlayers.map(function(id) {
                var p = game.players.find(function(pp) { return pp.id === id; });
                return p ? p.name : '';
            }).join('、');
            this.addGameMessage({
                type: 'system',
                content: '平票！' + names + ' 各 ' + maxVotes + ' 票，无人被放逐'
            });
        } else {
            this.addGameMessage({
                type: 'system',
                content: '无人被投票，无人被放逐'
            });
        }
        
        this.updateGameUI();
        
        // 检查游戏是否结束
        if (this.checkGameEnd()) {
            return;
        }
        
        // 进入下一个夜晚
        game.phase = 'night';
        
        setTimeout(function() {
            self.runGamePhase();
        }, 1500);
    };
    
    // 遗言环节
    ChatApp.prototype.triggerLastWords = function(player, callback) {
        var self = this;
        var game = this.currentGame;
        
        if (player.isUser) {
            // 用户发表遗言
            this.showUserLastWordsInput(player, callback);
        } else {
            // AI发表遗言
            this.generateAILastWords(player, callback);
        }
    };
    
    // 用户遗言输入
    ChatApp.prototype.showUserLastWordsInput = function(player, callback) {
        var self = this;
        var game = this.currentGame;
        
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (!actionArea) return callback();
        
        game.pendingUserAction = 'last_words';
        
        var html = '<div style="padding:8px 0;">';
        html += '<div style="font-size:12px;color:#8a5a5a;margin-bottom:8px;text-align:center;font-weight:500;">发表你的遗言</div>';
        html += '<div style="display:flex;gap:6px;">';
        html += '<input type="text" id="last-words-input" placeholder="说出你的遗言..." style="flex:1;padding:10px 12px;background:rgba(255,255,255,0.9);border:1px solid rgba(200,90,90,0.3);border-radius:8px;color:#5a3030;font-size:12px;outline:none;">';
        html += '<button id="last-words-send" style="padding:10px 16px;background:rgba(200,90,90,0.3);border:1px solid rgba(200,90,90,0.4);border-radius:8px;color:#c85a5a;font-size:12px;cursor:pointer;">发送</button>';
        html += '<button id="last-words-skip" style="padding:10px 16px;background:rgba(100,100,100,0.2);border:1px solid rgba(100,100,100,0.3);border-radius:8px;color:#888;font-size:12px;cursor:pointer;">跳过</button>';
        html += '</div>';
        html += '</div>';
        
        actionArea.innerHTML = html;
        
        var input = actionArea.querySelector('#last-words-input');
        var sendBtn = actionArea.querySelector('#last-words-send');
        var skipBtn = actionArea.querySelector('#last-words-skip');
        
        var finishLastWords = function(content) {
            game.pendingUserAction = null;
            
            if (content) {
                self.addGameMessage({
                    type: 'speech',
                    playerId: player.id,
                    playerName: player.name,
                    content: '【遗言】' + content
                });
                
                // 记录遗言到gameLog
                game.gameLog.push({
                    round: game.round,
                    event: 'lastWords',
                    playerId: player.id,
                    playerName: player.name,
                    content: content
                });
            }
            
            actionArea.innerHTML = self.renderGameActions();
            callback();
        };
        
        sendBtn.onclick = function() {
            var content = input.value.trim();
            finishLastWords(content);
        };
        
        skipBtn.onclick = function() {
            finishLastWords('');
        };
        
        input.onkeypress = function(e) {
            if (e.key === 'Enter') {
                var content = input.value.trim();
                finishLastWords(content);
            }
        };
        
        input.focus();
    };
    
    // AI遗言生成
    ChatApp.prototype.generateAILastWords = function(player, callback) {
        var self = this;
        var game = this.currentGame;
        
        var ai = PhoneCore.getAI(player.id);
        var roleInfo = this.werewolfRoles[player.role];
        
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId && ai) {
            apiConfigId = ai.apiConfigId;
        }
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (!apiConfigId) {
            // 无API，使用默认遗言
            var defaultWords = ['我是好人...', '你们会后悔的', '记住今天', '...'];
            var content = defaultWords[Math.floor(Math.random() * defaultWords.length)];
            self.addGameMessage({
                type: 'speech',
                playerId: player.id,
                playerName: player.name,
                content: '【遗言】' + content
            });
            setTimeout(callback, 800);
            return;
        }
        
        var prompt = '<scene>你是' + player.name + '（' + roleInfo.name + '），被投票出局，发表遗言</scene>\n';
        if (ai && ai.personality) {
            prompt += '<personality>' + ai.personality.substring(0, 100) + '</personality>\n';
        }
        prompt += '\n<tips>\n';
        if (player.role === 'wolf') {
            prompt += '你是狼人！遗言可以：\n';
            prompt += '• 装无辜："我真是好人啊你们瞎"\n';
            prompt += '• 拉人下水："我死可以，xxx比我可疑多了"\n';
            prompt += '• 摆烂认了："行行行，是狼，下一把见"\n';
        } else if (player.role === 'seer') {
            prompt += '你是预言家！最后机会，把查验信息告诉大家\n';
            prompt += '• "我是预言家，xxx是狼！相信我"\n';
        } else if (player.role === 'witch') {
            prompt += '你是女巫！可以透露用药信息\n';
            prompt += '• "我是女巫，那晚我救了xxx"\n';
        } else if (player.role === 'guard') {
            prompt += '你是守卫！可以说你守过谁\n';
        } else {
            prompt += '你是村民！可以：\n';
            prompt += '• 吐槽投你的人\n';
            prompt += '• 给出你的判断/线索\n';
            prompt += '• 表达委屈或不服\n';
        }
        prompt += '</tips>\n\n';
        prompt += '<output>\n';
        prompt += '用你的性格说遗言，10-25字，可以：\n';
        prompt += '• 正经："xxx绝对有问题，看好他"\n';
        prompt += '• 吐槽："就这？你们眼瞎啊"\n';
        prompt += '• 摆烂："行吧行吧，爱咋咋"\n';
        prompt += '</output>\n';
        prompt += '直接输出遗言内容：';
        
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call('狼人杀遗言，中文回复。', apiConfigId, {
            messages: [{ role: 'user', content: prompt }],
            maxTokens: configuredMaxTokens,
            temperature: 0.9
        }).then(function(response) {
            var content = response && typeof response === 'object' ? response.content : response;
            content = (content || '...').replace(/^【遗言】/, '').trim();
            
            self.addGameMessage({
                type: 'speech',
                playerId: player.id,
                playerName: player.name,
                content: '【遗言】' + content
            });
            
            // 记录遗言到gameLog
            game.gameLog.push({
                round: game.round,
                event: 'lastWords',
                playerId: player.id,
                playerName: player.name,
                content: content
            });
            
            self.updateGameUI();
            setTimeout(callback, 1000);
        }).catch(function() {
            self.addGameMessage({
                type: 'speech',
                playerId: player.id,
                playerName: player.name,
                content: '【遗言】...'
            });
            setTimeout(callback, 800);
        });
    };
    
    // 检查游戏结束
    ChatApp.prototype.checkGameEnd = function() {
        var game = this.currentGame;
        if (!game) return true;
        
        var aliveWolves = game.players.filter(function(p) { return p.isAlive && p.role === 'wolf'; });
        var aliveVillagers = game.players.filter(function(p) { return p.isAlive && p.role !== 'wolf'; });
        
        var gameEnded = false;
        var winner = null;
        
        // 狼人全灭
        if (aliveWolves.length === 0) {
            gameEnded = true;
            winner = 'village';
        }
        
        // 好人数量 <= 狼人数量
        if (aliveVillagers.length <= aliveWolves.length) {
            gameEnded = true;
            winner = 'wolf';
        }
        
        // 情侣获胜条件
        if (game.lovers && game.lovers.length === 2) {
            var loversAlive = game.lovers.filter(function(id) {
                var p = game.players.find(function(pp) { return pp.id === id; });
                return p && p.isAlive;
            });
            
            if (loversAlive.length === 2 && game.alivePlayers.length === 2) {
                gameEnded = true;
                winner = 'lovers';
            }
        }
        
        if (gameEnded) {
            this.endGame(winner);
            return true;
        }
        
        return false;
    };
    
    // 结束游戏
    ChatApp.prototype.endGame = function(winner) {
        var self = this;
        var game = this.currentGame;
        
        game.phase = 'ended';
        game.winner = winner;
        game.endTime = Date.now();
        
        var winnerText = '';
        var winnerColor = '';
        
        if (winner === 'village') {
            winnerText = '好人阵营胜利';
            winnerColor = '#27ae60';
        } else if (winner === 'wolf') {
            winnerText = '狼人阵营胜利';
            winnerColor = '#e74c3c';
        } else if (winner === 'lovers') {
            winnerText = '情侣胜利';
            winnerColor = '#e91e63';
        }
        
        // 游戏结束 - 逐句显示结果和身份
        var endMessages = [];
        endMessages.push({ type: 'phase', content: '游戏结束 - ' + winnerText, color: winnerColor });
        endMessages.push({ type: 'system', content: '身份揭晓:' });
        
        // 逐个显示每个玩家的身份
        game.players.forEach(function(p) {
            var roleInfo = self.werewolfRoles[p.role];
            var status = p.isAlive ? '' : ' (已死亡)';
            endMessages.push({ type: 'system', content: p.name + ' → ' + roleInfo.name + status });
        });
        
        // 逐句显示，完成后刷新UI和显示按钮
        this.addGameMessagesSequentially(endMessages, 300, function() {
            self.updateGameUI(true); // 游戏结束，强制刷新显示所有身份
            
            // 显示结束按钮和复盘按钮
            var actionArea = self.gamePageElement ? self.gamePageElement.querySelector('#game-actions') : null;
            if (actionArea) {
                actionArea.innerHTML = self.renderGameActions();
                self.bindEndGameEvents(actionArea);
            }
        });
    };
    
    // 绑定游戏结束后的事件
    ChatApp.prototype.bindEndGameEvents = function(actionArea) {
        var self = this;
        var game = this.currentGame;
        
        // 开始复盘按钮
        var startReviewBtn = actionArea.querySelector('#start-review-btn');
        if (startReviewBtn) {
            startReviewBtn.onclick = function() {
                self.startGameReview();
            };
        }
        
        // 结束游戏按钮
        var endGameBtn = actionArea.querySelector('#end-game-btn');
        if (endGameBtn) {
            endGameBtn.onclick = function() {
                // 防止重复点击
                if (endGameBtn.disabled || (self.currentGame && self.currentGame._isSaving)) {
                    return;
                }
                endGameBtn.disabled = true;
                self.saveGameRecord();
            };
        }
        
        // 复盘模式下的发送按钮
        var sendReviewBtn = actionArea.querySelector('#send-review-btn');
        if (sendReviewBtn) {
            var reviewInput = actionArea.querySelector('#review-input');
            
            sendReviewBtn.onclick = function() {
                var content = reviewInput.value.trim();
                if (content) {
                    self.sendReviewMessage(content);
                    reviewInput.value = '';
                }
            };
            
            if (reviewInput) {
                reviewInput.onkeypress = function(e) {
                    if (e.key === 'Enter') {
                        sendReviewBtn.click();
                    }
                };
                reviewInput.focus();
            }
        }
        
        // 结束复盘按钮
        var endReviewBtn = actionArea.querySelector('#end-review-btn');
        if (endReviewBtn) {
            endReviewBtn.onclick = function() {
                self.endGameReview();
            };
        }
    };
    
    // 开始游戏复盘
    ChatApp.prototype.startGameReview = function() {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        game.phase = 'review';
        game.reviewHistory = [];
        
        // 添加复盘开始提示
        this.addGameMessage({
            type: 'phase',
            content: '复盘闲聊',
            color: '#4A6FA5'
        });
        
        var winnerText = game.winner === 'wolf' ? '狼人阵营' : game.winner === 'village' ? '好人阵营' : '情侣';
        this.addGameMessage({
            type: 'system',
            content: winnerText + '获胜！身份已公开，大家来聊聊这局吧~'
        });
        
        this.updateGameUI(true); // 复盘模式，强制刷新
        
        // 更新操作区域
        var actionArea = this.gamePageElement.querySelector('#game-actions');
        if (actionArea) {
            actionArea.innerHTML = this.renderGameActions();
            this.bindEndGameEvents(actionArea);
        }
        
        // 生成所有AI的复盘感想（像闲聊一样）
        this.generateAllAIReviews();
    };
    
    // 一次性生成所有AI的复盘感想
    ChatApp.prototype.generateAllAIReviews = function() {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        var aiPlayers = game.players.filter(function(p) { return !p.isUser; });
        if (aiPlayers.length === 0) return;
        
        // 构建统一的复盘prompt，一次生成所有AI的感想
        var roleInfoList = aiPlayers.map(function(p) {
            var roleInfo = self.werewolfRoles[p.role];
            return p.name + '(' + roleInfo.name + ',' + (p.isAlive ? '存活' : '死亡') + ')';
        }).join('、');
        
        var winnerText = game.winner === 'village' ? '好人阵营' : game.winner === 'wolf' ? '狼人阵营' : '情侣';
        
        // 收集游戏中的关键事件作为话题素材
        var keyMoments = [];
        game.gameLog.forEach(function(log) {
            if (log.event === 'death') {
                var causeText = '';
                switch(log.cause) {
                    case 'vote': causeText = '被投出去了'; break;
                    case 'night': causeText = '被狼杀了'; break;
                    case 'witch_poison': causeText = '被女巫毒杀了'; break;
                    case 'hunter': causeText = '被猎人带走了'; break;
                    case 'lover_death': causeText = '殉情了'; break;
                    default: causeText = '死了';
                }
                keyMoments.push(log.playerName + causeText);
            }
        });
        
        var reviewPrompt = '<task>生成狼人杀复盘闲聊</task>\n\n';
        reviewPrompt += '<context>\n';
        reviewPrompt += '游戏结束，' + winnerText + '获胜\n';
        reviewPrompt += '参与者：' + roleInfoList + '\n';
        reviewPrompt += '游戏时长：' + game.round + '轮\n';
        if (keyMoments.length > 0) {
            reviewPrompt += '关键事件：' + keyMoments.slice(0, 4).join('、') + '\n';
        }
        reviewPrompt += '</context>\n\n';
        reviewPrompt += '<requirements>\n';
        reviewPrompt += '为每位玩家生成一句复盘感想：\n';
        reviewPrompt += '• 朋友聊天语气，可用"哈哈"、"我靠"、"绝了"、"太难了"\n';
        reviewPrompt += '• 内容多样：吐槽表现、回忆精彩时刻、开玩笑、表达心情\n';
        reviewPrompt += '• 每人10-25字，口语化，不要书面语\n';
        reviewPrompt += '• 可以@其他玩家互动\n';
        reviewPrompt += '• 重要：必须贴合每个人的性格！\n';
        reviewPrompt += '</requirements>\n\n';
        
        reviewPrompt += '<players>\n';
        aiPlayers.forEach(function(p, idx) {
            var roleInfo = self.werewolfRoles[p.role];
            var isWinner = (game.winner === 'wolf' && p.role === 'wolf') || (game.winner === 'village' && p.role !== 'wolf');
            var status = isWinner ? '赢' : '输';
            var alive = p.isAlive ? '存活' : '已死';
            var playerAI = PhoneCore.getAI(p.id);
            var personality = playerAI && playerAI.personality ? playerAI.personality.substring(0, 50) : '普通';
            reviewPrompt += p.name + '｜' + roleInfo.name + '｜' + status + '｜' + alive + '｜性格:' + personality + '\n';
        });
        reviewPrompt += '</players>\n\n';
        reviewPrompt += '<output_format>\n';
        reviewPrompt += '每行格式：玩家名: 感想内容\n';
        reviewPrompt += '示例：\n';
        reviewPrompt += '小明: 我靠我演得那么好还是被发现了哈哈\n';
        reviewPrompt += '小红: 就说xxx有问题吧，你们不信\n';
        reviewPrompt += '直接输出，不要序号\n';
        reviewPrompt += '</output_format>';
        
        // 获取API配置
        var apiConfigId = null;
        if (PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (apiConfigId) {
            // 修复：使用messages格式，兼容Gemini等API
            // 【动态maxTokens】从API配置中获取
            var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
            PhoneCore.api.call('狼人杀评论员，中文回复。', apiConfigId, {
                messages: [{ role: 'user', content: reviewPrompt }],
                maxTokens: configuredMaxTokens,
                temperature: 0.8
            }).then(function(response) {
                var content = response && typeof response === 'object' ? response.content : response;
                self.parseAndShowAIReviews(content, aiPlayers);
            }).catch(function() {
                self.showDefaultAIReviews(aiPlayers);
            });
        } else {
            self.showDefaultAIReviews(aiPlayers);
        }
    };
    
    // 解析并显示AI复盘内容
    ChatApp.prototype.parseAndShowAIReviews = function(response, aiPlayers) {
        var self = this;
        var game = this.currentGame;
        if (!game || !response) {
            this.showDefaultAIReviews(aiPlayers);
            return;
        }
        
        var lines = response.split('\n').filter(function(l) { return l.trim(); });
        var reviewMessages = [];
        
        aiPlayers.forEach(function(player) {
            var found = false;
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].includes(player.name)) {
                    var parts = lines[i].split(/[:：]/);
                    if (parts.length >= 2) {
                        var content = parts.slice(1).join(':').trim();
                        reviewMessages.push({ player: player, content: content });
                        found = true;
                        break;
                    }
                }
            }
            // 如果没找到该玩家的发言，不添加默认发言，直接跳过
            // if (!found) { ... }
        });
        
        // 依次显示AI复盘消息
        var showIndex = 0;
        var showNext = function() {
            if (showIndex >= reviewMessages.length || !self.currentGame) return;
            
            var item = reviewMessages[showIndex];
            self.addGameMessage({
                type: 'review',
                playerId: item.player.id,
                playerName: item.player.name,
                content: item.content
            });
            
            // 记录到复盘历史
            if (game.reviewHistory) {
                game.reviewHistory.push({
                    playerId: item.player.id,
                    playerName: item.player.name,
                    content: item.content,
                    timestamp: Date.now()
                });
            }
            
            self.updateGameUI();
            showIndex++;
            
            setTimeout(showNext, 600);
        };
        
        setTimeout(showNext, 800);
    };
    
    // 显示默认AI复盘内容 - 已禁用，不显示任何默认发言
    ChatApp.prototype.showDefaultAIReviews = function(aiPlayers) {
        // 不显示任何默认发言，直接返回
        return;
    };
    
    // 发送复盘消息
    ChatApp.prototype.sendReviewMessage = function(content) {
        var self = this;
        var game = this.currentGame;
        if (!game || game.phase !== 'review') return;
        
        // 添加用户消息
        var userPlayer = game.players.find(function(p) { return p.isUser; });
        var userName = userPlayer ? userPlayer.name : '玩家';
        this.addGameMessage({
            type: 'review',
            playerId: 'user',
            playerName: userName,
            content: content
        });
        
        if (game.reviewHistory) {
            game.reviewHistory.push({
                playerId: 'user',
                playerName: userName,
                content: content,
                timestamp: Date.now()
            });
        }
        
        this.updateGameUI();
        
        // 用户发消息后，随机选择1-3个AI进行回复（更像闲聊）
        this.generateReviewReplies(content);
    };
    
    // 生成复盘闲聊回复（多个AI互动）
    ChatApp.prototype.generateReviewReplies = function(userMessage) {
        var self = this;
        var game = this.currentGame;
        if (!game || game.phase !== 'review') return;
        
        var aiPlayers = game.players.filter(function(p) { return !p.isUser; });
        if (aiPlayers.length === 0) return;
        
        // 随机选择1-3个AI回复
        var replyCount = Math.min(aiPlayers.length, Math.floor(Math.random() * 3) + 1);
        var shuffled = aiPlayers.slice().sort(function() { return Math.random() - 0.5; });
        var repliers = shuffled.slice(0, replyCount);
        
        // 构建复盘对话的上下文
        var recentReviews = (game.reviewHistory || []).slice(-6);
        var contextText = recentReviews.map(function(r) {
            return r.playerName + ': ' + r.content;
        }).join('\n');
        
        // 获取API配置
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        // 为每个要回复的AI生成回复
        var showIndex = 0;
        var generateReply = function(idx) {
            if (idx >= repliers.length || !self.currentGame || self.currentGame.phase !== 'review') return;
            
            var player = repliers[idx];
            var roleInfo = self.werewolfRoles[player.role];
            var isWinner = (game.winner === 'wolf' && player.role === 'wolf') || (game.winner === 'village' && player.role !== 'wolf');
            
            // 获取AI性格
            var playerAI = PhoneCore.getAI(player.id);
            var playerPersonality = playerAI && playerAI.personality ? playerAI.personality.substring(0, 100) : '';
            
            var prompt = '<scene>狼人杀复盘闲聊，' + (game.winner === 'wolf' ? '狼人' : '好人') + '胜</scene>\n';
            prompt += '<you>' + player.name + '(' + roleInfo.name + ')，你' + (isWinner ? '赢了' : '输了') + '</you>\n';
            if (playerPersonality) prompt += '<personality>' + playerPersonality.substring(0, 50) + '</personality>\n';
            
            prompt += '<all_players>' + game.players.map(function(p) {
                var pRole = self.werewolfRoles[p.role];
                return p.name + '-' + pRole.name;
            }).join('、') + '</all_players>\n';
            
            if (contextText) {
                prompt += '<recent_chat>\n' + contextText + '\n</recent_chat>\n';
            }
            
            var userPlayer = game.players.find(function(p) { return p.isUser; });
            var userName = userPlayer ? userPlayer.name : '玩家';
            prompt += '\n<reply_to>' + userName + '说：' + userMessage + '</reply_to>\n';
            prompt += '<output>用你的性格自然回复（10-30字），像朋友聊天</output>\n';
            prompt += '直接输出回复内容：';
            
            if (apiConfigId) {
                var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
                PhoneCore.api.call('狼人杀复盘闲聊，中文回复。', apiConfigId, {
                    messages: [{ role: 'user', content: prompt }],
                    maxTokens: configuredMaxTokens,
                    temperature: 0.9
                }).then(function(response) {
                    if (!self.currentGame || self.currentGame.phase !== 'review') return;
                    
                    var content = response && typeof response === 'object' ? response.content : response;
                    if (content) {
                        content = content.trim().replace(/^["']|["']$/g, '');
                        self.addGameMessage({
                            type: 'review',
                            playerId: player.id,
                            playerName: player.name,
                            content: content
                        });
                        
                        if (game.reviewHistory) {
                            game.reviewHistory.push({
                                playerId: player.id,
                                playerName: player.name,
                                content: content,
                                timestamp: Date.now()
                            });
                        }
                        
                        self.updateGameUI();
                    }
                    
                    // 继续下一个AI回复
                    setTimeout(function() {
                        generateReply(idx + 1);
                    }, 600 + Math.random() * 800);
                }).catch(function() {
                    setTimeout(function() {
                        generateReply(idx + 1);
                    }, 400);
                });
            } else {
                // 无API时直接跳过，不显示默认回复
                setTimeout(function() {
                    generateReply(idx + 1);
                }, 200);
            }
        };
        
        // 延迟后开始生成回复
        setTimeout(function() {
            generateReply(0);
        }, 800);
    };
    
    // 结束游戏复盘
    ChatApp.prototype.endGameReview = function() {
        var game = this.currentGame;
        if (!game) return;
        
        // 添加复盘结束提示
        this.addGameMessage({
            type: 'system',
            content: '复盘讨论结束'
        });
        
        game.phase = 'ended';
        this.updateGameUI();
        
        // 保存游戏记录
        this.saveGameRecord();
    };
    
    // 保存游戏记录
    ChatApp.prototype.saveGameRecord = function() {
        var self = this;
        var game = this.currentGame;
        
        // 防止重复保存
        if (!game || game._isSaving) {
            return;
        }
        game._isSaving = true;
        
        var group = this.getGroupChat(game.groupId);
        
        if (!group) {
            this.closeGamePage();
            return;
        }
        
        // 先创建游戏记录卡片（概要稍后生成）
        var gameRecord = {
            id: game.id,
            type: 'werewolf',
            playerCount: game.playerCount,
            rounds: game.round,
            winner: game.winner,
            duration: (game.endTime || Date.now()) - game.startTime,
            players: game.players.map(function(p) {
                return {
                    id: p.id,
                    name: p.name,
                    role: p.role,
                    isAlive: p.isAlive,
                    isUser: p.isUser
                };
            }),
            summary: '正在生成概要...',
            fullLog: game.chatHistory,
            gameLog: game.gameLog,
            reviewHistory: game.reviewHistory || [],
            timestamp: Date.now()
        };
        
        var recordId = 'gmsg_game_' + Date.now();
        var recordMessage = {
            id: recordId,
            role: 'system',
            type: 'game_record',
            content: '[狼人杀游戏记录]',
            gameRecord: gameRecord,
            timestamp: Date.now()
        };
        
        if (!group.chatHistory) {
            group.chatHistory = [];
        }
        group.chatHistory.push(recordMessage);
        self.saveGroupChat(group);
        
        // 记录到游戏积分排行榜系统
        if (typeof GameStats !== 'undefined' && GameStats.recordWerewolfGame) {
            try {
                GameStats.recordWerewolfGame({
                    id: game.id,
                    groupId: game.groupId,
                    playerCount: game.playerCount,
                    rounds: game.round,
                    winner: game.winner,
                    lovers: game.lovers || [],
                    players: game.players.map(function(p) {
                        return {
                            id: p.id,
                            name: p.name,
                            role: p.role,
                            isAlive: p.isAlive,
                            isUser: p.isUser
                        };
                    })
                });
            } catch (e) {
                console.error('[Werewolf] 记录积分失败:', e);
            }
        }
        
        // 先关闭游戏页面
        self.closeGamePage();
        
        PhoneCore.notifications.send({
            type: 'success',
            title: '游戏记录已保存',
            size: 'mini'
        });
        
        // 保存需要的游戏数据用于后台生成概要
        var gameDataForSummary = {
            groupId: game.groupId,
            recordId: recordId,
            round: game.round,
            winner: game.winner,
            playerCount: game.playerCount,
            players: game.players.map(function(p) {
                return { id: p.id, name: p.name, role: p.role, isAlive: p.isAlive };
            }),
            gameLog: game.gameLog,
            chatHistory: game.chatHistory,
            apiConfigId: game.apiConfigId
        };
        
        // 后台生成概要
        setTimeout(function() {
            self.generateGameSummaryAsync(gameDataForSummary);
        }, 500);
    };
    
    // 后台异步生成游戏概要
    ChatApp.prototype.generateGameSummaryAsync = function(gameData) {
        var self = this;
        
        // 整理游戏关键事件（按时间顺序）
        var deathsByRound = {};
        var votedOut = [];
        var nightKills = [];
        
        gameData.gameLog.forEach(function(log) {
            if (log.event === 'death') {
                var roundKey = '第' + log.round + '轮';
                if (!deathsByRound[roundKey]) deathsByRound[roundKey] = [];
                
                var causeText = '';
                switch(log.cause) {
                    case 'night': causeText = '夜间死亡'; nightKills.push(log.playerName); break;
                    case 'vote': causeText = '被投票出局'; votedOut.push(log.playerName); break;
                    case 'hunter': causeText = '被猎人带走'; break;
                    case 'lover_death': causeText = '殉情'; break;
                    case 'poison': causeText = '被毒杀'; break;
                    default: causeText = '死亡';
                }
                deathsByRound[roundKey].push(log.playerName + causeText);
            }
        });
        
        // 检查是否有丘比特（情侣机制）
        var hasCupid = gameData.players.some(function(p) { return p.role === 'cupid'; });
        var winnerText = gameData.winner === 'village' ? '好人阵营' : gameData.winner === 'wolf' ? '狼人阵营' : (hasCupid ? '情侣' : '好人阵营');
        
        // 构建概要prompt - 客观简洁，聚焦游戏流程
        var summaryPrompt = '<task>客观简洁地概括这局狼人杀游戏流程，2-3句话</task>\n\n';
        
        summaryPrompt += '<game_info>\n';
        summaryPrompt += '人数：' + gameData.playerCount + '人\n';
        summaryPrompt += '轮数：' + gameData.round + '轮\n';
        summaryPrompt += '赢家：' + winnerText + '\n';
        summaryPrompt += '</game_info>\n\n';
        
        summaryPrompt += '<roster>\n';
        var wolves = [];
        var villagers = [];
        gameData.players.forEach(function(p) {
            var roleInfo = self.werewolfRoles[p.role];
            var status = p.isAlive ? '✓' : '✗';
            var info = p.name + '(' + (roleInfo ? roleInfo.name : p.role) + status + ')';
            if (p.role === 'wolf') {
                wolves.push(info);
            } else {
                villagers.push(info);
            }
        });
        summaryPrompt += '狼人：' + wolves.join('、') + '\n';
        summaryPrompt += '好人：' + villagers.join('、') + '\n';
        summaryPrompt += '</roster>\n\n';
        
        summaryPrompt += '<deaths>\n';
        for (var round in deathsByRound) {
            summaryPrompt += round + '：' + deathsByRound[round].join('、') + '\n';
        }
        summaryPrompt += '</deaths>\n\n';
        
        summaryPrompt += '<output>\n';
        summaryPrompt += '要求：\n';
        summaryPrompt += '• 客观描述胜负结果和主要原因\n';
        summaryPrompt += '• 简述关键转折点（谁被刀/谁被投出等）\n';
        summaryPrompt += '• 语气平实，像游戏回顾\n';
        summaryPrompt += '• 不要添加无关角色或机制（如没有丘比特就不要提情侣）\n';
        summaryPrompt += '示例风格："本局好人阵营获胜。第1夜xxx被刀，第2天xxx被票出后游戏结束。"\n';
        summaryPrompt += '</output>\n';
        summaryPrompt += '直接输出，无需标题：';
        
        // 调用API生成概要
        var apiConfigId = gameData.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        var updateSummary = function(summary) {
            // 更新群聊中的游戏记录
            var group = self.getGroupChat(gameData.groupId);
            if (group && group.chatHistory) {
                var recordMsg = group.chatHistory.find(function(msg) {
                    return msg.id === gameData.recordId;
                });
                if (recordMsg && recordMsg.gameRecord) {
                    recordMsg.gameRecord.summary = summary;
                    self.saveGroupChat(group);
                }
            }
        };
        
        if (apiConfigId) {
            var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
            PhoneCore.api.call('狼人杀游戏解说，中文回复。', apiConfigId, {
                messages: [{ role: 'user', content: summaryPrompt }],
                maxTokens: configuredMaxTokens,
                temperature: 0.8
            }).then(function(response) {
                var content = response && typeof response === 'object' ? response.content : response;
                if (content) {
                    content = content.trim();
                }
                updateSummary(content || self.generateDefaultSummaryFromData(gameData));
            }).catch(function() {
                updateSummary(self.generateDefaultSummaryFromData(gameData));
            });
        } else {
            updateSummary(self.generateDefaultSummaryFromData(gameData));
        }
    };
    
    // 从数据生成默认概要
    ChatApp.prototype.generateDefaultSummaryFromData = function(gameData) {
        var self = this;
        var winnerText = gameData.winner === 'village' ? '好人阵营' : gameData.winner === 'wolf' ? '狼人阵营' : '情侣';
        var wolves = gameData.players.filter(function(p) { return p.role === 'wolf'; }).map(function(p) { return p.name; });
        var firstDeath = gameData.gameLog.find(function(log) { return log.event === 'death'; });
        
        var summary = gameData.playerCount + '人局，经过' + gameData.round + '轮激烈角逐，' + winnerText + '获得胜利。';
        
        if (wolves.length > 0) {
            summary += '本局狼人是' + wolves.join('和') + '。';
        }
        
        if (firstDeath) {
            summary += firstDeath.playerName + '是第一个出局的玩家。';
        }
        
        return summary;
    };
    
    // 关闭游戏页面
    ChatApp.prototype.closeGamePage = function() {
        var self = this;
        
        if (this.gamePageElement) {
            this.gamePageElement.classList.remove('slide-in');
            this.gamePageElement.classList.add('slide-out');
            setTimeout(function() {
                if (self.gamePageElement) {
                    self.gamePageElement.remove();
                    self.pageStack.pop();
                }
                self.currentGame = null;
                self.gamePageElement = null;
                self.refreshChatList();
            }, 300);
        }
    };
    
    // 调用游戏AI
    ChatApp.prototype.callGameAI = function(aiId, actionType, context, callback) {
        var self = this;
        var game = this.currentGame;
        var player = game.players.find(function(p) { return p.id === aiId; });
        
        if (!player) {
            callback('');
            return;
        }
        
        var ai = PhoneCore.getAI(aiId);
        var roleInfo = this.werewolfRoles[player.role];
        
        // ========== 构建完整的游戏上下文 ==========
        var systemPrompt = '<setting>狼人杀·熟人局，一群老朋友线下聚会玩游戏，气氛轻松欢乐</setting>\n\n';
        
        // === 你的身份信息 ===
        systemPrompt += '<identity>\n';
        systemPrompt += '你是【' + player.name + '】\n';
        systemPrompt += '身份：' + roleInfo.name + '\n';
        systemPrompt += '目标：' + (roleInfo.team === 'wolf' ? '伪装好人，暗中消灭好人阵营' : '找出狼人，投票处决他们') + '\n';
        
        // 狼人知道队友
        if (player.role === 'wolf') {
            var teammates = game.players.filter(function(p) { return p.role === 'wolf' && p.id !== player.id; });
            if (teammates.length > 0) {
                systemPrompt += '狼队友：' + teammates.map(function(t) { return t.name; }).join('、') + '（你们夜里一起行动，白天互相掩护）\n';
            }
            systemPrompt += '\n【狼人生存法则】\n';
            systemPrompt += '• 白天像普通村民一样分析，偶尔"怀疑"队友显得真实\n';
            systemPrompt += '• 跟着场上节奏走，别冒头也别太沉默\n';
            systemPrompt += '• 被质疑时自然反驳，不要慌张露马脚\n';
        }
        systemPrompt += '</identity>\n\n';
        
        // === 完整玩家列表 ===
        systemPrompt += '<players count="' + game.players.length + '">\n';
        game.players.forEach(function(p) {
            var status = p.isAlive ? '[存活]' : '[死亡]';
            systemPrompt += status + ' ' + p.name + '\n';
        });
        systemPrompt += '</players>\n\n';
        
        // === 游戏进程 ===
        systemPrompt += '<timeline>\n';
        if (game.gameLog && game.gameLog.length > 0) {
            var eventsByRound = {};
            game.gameLog.forEach(function(log) {
                var roundKey = 'D' + log.round;
                if (!eventsByRound[roundKey]) eventsByRound[roundKey] = [];
                
                var eventText = '';
                if (log.event === 'death') {
                    var causeText = '';
                    switch(log.cause) {
                        case 'vote': causeText = '票出'; break;
                        case 'night': 
                        case 'witch_poison': 
                            causeText = '夜死'; break;
                        case 'hunter': causeText = '被带走'; break;
                        case 'lover_death': causeText = '殉情'; break;
                        default: causeText = '死亡';
                    }
                    eventText = log.playerName + ' ' + causeText;
                }
                
                // 投票记录
                if (log.event === 'voteRecord' && log.votes) {
                    var voteTexts = log.votes.map(function(v) {
                        return v.voterName + '→' + v.targetName;
                    });
                    eventText = '投票: ' + voteTexts.join('，');
                }
                
                // 女巫用药记录
                if (log.event === 'nightAction' && log.action === 'witchSave') {
                    eventText = '有人被救';
                }
                if (log.event === 'nightAction' && log.action === 'witchPoison') {
                    eventText = '女巫出手';
                }
                
                // 遗言记录
                if (log.event === 'lastWords') {
                    eventText = log.playerName + '遗言："' + (log.content || '').substring(0, 30) + '"';
                }
                
                if (eventText) {
                    eventsByRound[roundKey].push(eventText);
                }
            });
            
            for (var round in eventsByRound) {
                systemPrompt += round + ': ' + eventsByRound[round].join(' | ') + '\n';
            }
        } else {
            systemPrompt += '（游戏刚开始，暂无事件）\n';
        }
        systemPrompt += '</timeline>\n\n';
        
        // === 当前状态 ===
        var phaseText = game.phase === 'night' ? '夜晚' : game.phase === 'day_speech' ? '白天讨论' : game.phase === 'day_vote' ? '投票' : game.phase;
        systemPrompt += '<now>第' + game.round + '天 ' + phaseText + '</now>\n\n';
        
        var alivePlayers = game.players.filter(function(p) { return p.isAlive; });
        var deadPlayers = game.players.filter(function(p) { return !p.isAlive; });
        systemPrompt += '<alive>' + alivePlayers.map(function(p) { return p.name; }).join('、') + '</alive>\n';
        if (deadPlayers.length > 0) {
            systemPrompt += '<dead>' + deadPlayers.map(function(p) { return p.name; }).join('、') + '</dead>\n';
        }
        systemPrompt += '\n';
        
        // === 聊天记录 ===
        if (game.chatHistory && game.chatHistory.length > 0) {
            systemPrompt += '<chat>\n';
            game.chatHistory.forEach(function(msg) {
                if (msg.type === 'phase') {
                    systemPrompt += '--- ' + msg.content + ' ---\n';
                } else if (msg.type === 'system') {
                    systemPrompt += '[' + msg.content + ']\n';
                } else if (msg.type === 'speech') {
                    systemPrompt += msg.playerName + ': ' + msg.content + '\n';
                }
            });
            systemPrompt += '</chat>\n\n';
        }
        
        // === 你的性格（核心！）===
        if (ai && ai.personality) {
            systemPrompt += '<personality>\n';
            systemPrompt += ai.personality.substring(0, 300) + '\n';
            systemPrompt += '</personality>\n\n';
            
            systemPrompt += '<voice_guide>\n';
            systemPrompt += '说话风格必须贴合你的性格：\n';
            systemPrompt += '• 活泼型 → "哈哈哈不是吧"、"我觉得吧~"、喜欢调侃、话多\n';
            systemPrompt += '• 冷静型 → 短句、直接、"就这样"、不废话\n';
            systemPrompt += '• 温柔型 → "我感觉可能..."、"会不会是..."、关心队友\n';
            systemPrompt += '• 毒舌型 → "切"、"笑死"、嘴硬吐槽、表面嫌弃\n';
            systemPrompt += '• 憨憨型 → "啊？"、"真的假的"、容易被带节奏\n';
            systemPrompt += '• 社恐型 → "那个..."、"我不太确定"、说话少、犹豫\n';
            systemPrompt += '• 老练型 → 分析到位、爱总结、"我来捋一下"\n';
            systemPrompt += '</voice_guide>\n\n';
        }
        
        // === 用户自定义提示词 ===
        var customPrompts = this.getWerewolfCustomPrompts(game.groupId, aiId, actionType);
        if (customPrompts) {
            systemPrompt += customPrompts;
        }
        
        // === 熟人局规则 ===
        systemPrompt += '<rules>\n';
        systemPrompt += '1. 直呼其名，禁用"X号玩家"这种生硬称呼\n';
        systemPrompt += '2. 像微信群聊，短句口语化，可开玩笑吐槽\n';
        systemPrompt += '3. 每条消息5-25字，长话分多条发\n';
        systemPrompt += '4. 可用语气词：emmm、啊这、绝了、离谱、我靠\n';
        systemPrompt += '5. 可穿插场外梗："你上把也这样骗我"\n';
        systemPrompt += '</rules>\n\n';
        
        // ========== 根据行动类型添加具体指令 ==========
        var userPrompt = '';
        
        switch (actionType) {
            case 'wolf_kill':
                userPrompt = '【狼人夜间行动】第' + game.round + '夜\n\n';
                userPrompt += '可选目标：' + context.targets.map(function(t) { return t.name; }).join('、') + '\n\n';
                
                if (game.round === 1) {
                    userPrompt += '<strategy>\n';
                    userPrompt += '首夜策略：\n';
                    userPrompt += '• 优先刀疑似神职（发言有条理、像在引导场上的人）\n';
                    userPrompt += '• 或刀位置边缘的人（不容易被注意）\n';
                    userPrompt += '• 避免刀太强势的人（容易暴露你们在针对）\n';
                    userPrompt += '</strategy>\n\n';
                } else {
                    userPrompt += '<strategy>\n';
                    userPrompt += '选刀优先级：\n';
                    userPrompt += '1. 已暴露/疑似神职（预言家、女巫）\n';
                    userPrompt += '2. 发言逻辑强、在带节奏找狼的人\n';
                    userPrompt += '3. 投票精准、威胁你们存活的人\n';
                    userPrompt += '避免：别刀太明显会被猜到的目标\n';
                    userPrompt += '</strategy>\n\n';
                }
                userPrompt += '直接回复一个名字：';
                break;
                
            case 'seer_check':
                userPrompt = '【预言家查验】第' + game.round + '夜\n\n';
                userPrompt += '可查验：' + context.targets.map(function(t) { return t.name; }).join('、') + '\n\n';
                
                // 已有的查验记录
                var prevChecks = game.gameLog.filter(function(log) {
                    return log.event === 'nightAction' && log.action === 'seerCheck' && log.seerId === player.id;
                });
                if (prevChecks.length > 0) {
                    userPrompt += '<your_info>\n';
                    prevChecks.forEach(function(check) {
                        userPrompt += '第' + check.round + '夜查' + check.targetName + '→' + check.result + '\n';
                    });
                    userPrompt += '（勿重复查验）\n';
                    userPrompt += '</your_info>\n\n';
                }
                
                if (game.round === 1) {
                    userPrompt += '<strategy>\n';
                    userPrompt += '首夜策略：查"看起来挺正常"的人\n';
                    userPrompt += '• 太沉默或太活跃的反而不急着查\n';
                    userPrompt += '• 查到狼→心里有数，白天可以引导\n';
                    userPrompt += '• 查到好人→排除嫌疑，也是收获\n';
                    userPrompt += '</strategy>\n\n';
                } else {
                    userPrompt += '<strategy>\n';
                    userPrompt += '查验优先级：\n';
                    userPrompt += '1. 白天发言可疑、逻辑有问题的人\n';
                    userPrompt += '2. 帮死掉的狼人说话/洗地的人\n';
                    userPrompt += '3. 投票行为奇怪的人\n';
                    userPrompt += '</strategy>\n\n';
                }
                
                userPrompt += '直接回复一个名字：';
                break;
                
            case 'witch_action':
                userPrompt = '【女巫行动】第' + game.round + '夜\n\n';
                
                if (context.killedPlayer && context.hasSavePotion) {
                    userPrompt += '今晚【' + context.killedPlayer.name + '】被狼人杀了\n';
                    userPrompt += '你有解药，可以救\n\n';
                    
                    if (game.round === 1) {
                        userPrompt += '<strategy>\n';
                        userPrompt += '首夜用药需谨慎！解药只有一瓶\n';
                        userPrompt += '不救的理由：\n';
                        userPrompt += '• 不清楚ta是什么身份\n';
                        userPrompt += '• 可能救到狼人的盟友\n';
                        userPrompt += '• 留着救后面暴露的神职更值\n';
                        userPrompt += '救的理由：\n';
                        userPrompt += '• 直觉觉得是关键好人\n';
                        userPrompt += '• 想制造平安夜迷惑狼人\n';
                        userPrompt += '</strategy>\n\n';
                    } else {
                        userPrompt += '<strategy>\n';
                        userPrompt += '判断是否值得救：\n';
                        userPrompt += '• ta白天的发言像好人吗？\n';
                        userPrompt += '• ta是不是在积极找狼？\n';
                        userPrompt += '• ta可能是神职吗？\n';
                        userPrompt += '如果是重要好人/神职，果断救\n';
                        userPrompt += '如果不确定，宁可不救\n';
                        userPrompt += '</strategy>\n\n';
                    }
                } else if (context.killedPlayer && !context.hasSavePotion) {
                    userPrompt += context.killedPlayer.name + '被刀了\n';
                    userPrompt += '（解药已用，无法救援）\n\n';
                } else if (!context.killedPlayer) {
                    userPrompt += '平安夜，无人被刀\n\n';
                }
                
                if (context.hasPoisonPotion) {
                    userPrompt += '你有毒药\n';
                    userPrompt += '可毒：' + context.alivePlayers.map(function(p) { return p.name; }).join('、') + '\n';
                    if (game.round === 1) {
                        userPrompt += '首夜无发言，盲毒风险大，建议不用\n';
                    } else {
                        userPrompt += '可以毒白天表现最像狼的人\n';
                    }
                    userPrompt += '\n';
                } else {
                    userPrompt += '（毒药已用完）\n\n';
                }
                
                userPrompt += '回复格式：救人 / 毒[名字] / 不使用';
                break;
                
            case 'guard_protect':
                userPrompt = '【守卫守护】第' + game.round + '夜\n\n';
                userPrompt += '可守护：' + context.targets.map(function(t) { return t.name; }).join('、') + '\n\n';
                
                if (game.lastGuarded) {
                    var lastGuardedPlayer = game.players.find(function(p) { return p.id === game.lastGuarded; });
                    if (lastGuardedPlayer) {
                        userPrompt += '昨晚守了【' + lastGuardedPlayer.name + '】，不能连守！\n\n';
                    }
                }
                
                userPrompt += '<strategy>\n';
                userPrompt += '守护优先级：\n';
                userPrompt += '1. 已暴露/疑似的神职（预言家、女巫）\n';
                userPrompt += '2. 白天发言很有价值、在带好人节奏的人\n';
                userPrompt += '3. 你觉得狼人今晚会刀的人\n';
                userPrompt += '• 有时可以守自己\n';
                userPrompt += '• 也可以反向思维，守狼人不会想刀的人\n';
                userPrompt += '</strategy>\n\n';
                userPrompt += '直接回复一个名字：';
                break;
                
            case 'day_speech':
                // 发言顺序信息
                var speakPosition = context.speakPosition || 1;
                var totalSpeakers = context.totalSpeakers || context.alivePlayers.length;
                
                userPrompt = '【白天发言】第' + context.round + '天 (' + speakPosition + '/' + totalSpeakers + ')\n\n';
                
                if (speakPosition === 1) {
                    userPrompt += '<context>你是首位发言，前面没人说过话</context>\n';
                    userPrompt += '<tips>\n';
                    userPrompt += '• 可以聊昨晚的事、提出疑问、表达感受\n';
                    userPrompt += '• 禁止说"听了前面的话"（你前面没人！）\n';
                    userPrompt += '• 可以开个话题让大家接\n';
                    userPrompt += '</tips>\n\n';
                } else if (context.recentSpeeches && context.recentSpeeches.length > 0) {
                    userPrompt += '<recent_speech>\n';
                    context.recentSpeeches.forEach(function(s) {
                        userPrompt += s.playerName + ': ' + (s.content || '') + '\n';
                    });
                    userPrompt += '</recent_speech>\n\n';
                }
                
                // 根据身份给不同提示
                if (player.role === 'seer') {
                    var seerChecks = game.gameLog.filter(function(log) {
                        return log.event === 'nightAction' && log.action === 'seerCheck' && log.seerId === player.id;
                    });
                    if (seerChecks.length > 0) {
                        userPrompt += '<your_info type="预言家">\n';
                        seerChecks.forEach(function(check) {
                            userPrompt += '第' + check.round + '夜查' + check.targetName + '→' + check.result + '\n';
                        });
                        userPrompt += '</your_info>\n';
                        userPrompt += '<tips>\n';
                        if (game.round === 1) {
                            userPrompt += '【第一天策略】\n';
                            userPrompt += '• 不一定要首日跳预言家！可以先装村民观察\n';
                            userPrompt += '• 首跳容易被狼人针对、被狼人对跳\n';
                            userPrompt += '• 可以先参与讨论，看看场上形势\n';
                            userPrompt += '• 如果查到狼，也可以先憋着等好时机\n';
                        } else {
                            userPrompt += '• 跳身份时机：被怀疑时、关键投票前、好人阵营劣势时\n';
                            userPrompt += '• 报验时说清楚："我是预言家，我查了xxx是狼/好人"\n';
                        }
                        userPrompt += '• 如果不跳，可以装村民引导讨论\n';
                        userPrompt += '</tips>\n\n';
                    }
                } else if (player.role === 'wolf') {
                    userPrompt += '<tips type="狼人伪装">\n';
                    userPrompt += '• 表现得像在认真找狼，提出合理怀疑\n';
                    userPrompt += '• 可以轻度"怀疑"狼队友（显得客观）\n';
                    userPrompt += '• 帮被质疑的队友解围，但不要太刻意\n';
                    userPrompt += '• 如果队友暴露了，可以带头投他（弃车保帅）\n';
                    userPrompt += '• 不要太沉默，也不要太活跃\n';
                    userPrompt += '</tips>\n\n';
                } else if (player.role === 'witch') {
                    userPrompt += '<tips type="女巫">\n';
                    userPrompt += '• 一般不急着跳身份\n';
                    userPrompt += '• 如果你救了人/毒了人，可以选择性透露\n';
                    userPrompt += '• 关键时刻再报身份和用药情况\n';
                    userPrompt += '</tips>\n\n';
                } else if (player.role === 'guard') {
                    userPrompt += '<tips type="守卫">\n';
                    userPrompt += '• 守卫一般不急着跳，容易被刀\n';
                    userPrompt += '• 如果守到了人（平安夜），可以适当暗示\n';
                    userPrompt += '</tips>\n\n';
                } else {
                    // 普通村民
                    userPrompt += '<tips type="村民">\n';
                    userPrompt += '• 认真分析发言，找出可疑的人\n';
                    userPrompt += '• 可以追问、质疑、提出自己的看法\n';
                    userPrompt += '• 相信自己的直觉\n';
                    userPrompt += '</tips>\n\n';
                }
                
                var examplePlayer = context.alivePlayers[0] ? context.alivePlayers[0].name : '小明';
                userPrompt += '<output_format>\n';
                userPrompt += '• 用你的性格说话！\n';
                userPrompt += '• 短句，像微信群聊，一条5-20字\n';
                userPrompt += '• 用 | 分隔多条消息\n';
                userPrompt += '• 可用：emmm、啊这、我觉得、害、绝了\n';
                userPrompt += '示例：emmm总感觉哪里不对|' + examplePlayer + '你咋看|有点怀疑你哈哈\n';
                userPrompt += '</output_format>\n\n';
                userPrompt += '直接输出发言内容：';
                break;
                
            case 'vote':
                userPrompt = '【投票环节】第' + game.round + '天\n\n';
                userPrompt += '可投：' + context.alivePlayers.map(function(p) { return p.name; }).join('、') + '\n\n';
                
                // 根据身份给不同提示
                if (player.role === 'wolf') {
                    var wolfTeammates = game.players.filter(function(p) { 
                        return p.role === 'wolf' && p.id !== player.id && p.isAlive; 
                    });
                    userPrompt += '<strategy type="狼人投票">\n';
                    if (wolfTeammates.length > 0) {
                        userPrompt += '队友：' + wolfTeammates.map(function(t) { return t.name; }).join('、') + '（别投他们！）\n';
                    }
                    userPrompt += '• 跟着场上主流节奏投，不要显得另类\n';
                    userPrompt += '• 优先票掉疑似神职的好人\n';
                    userPrompt += '• 如果队友被集火了，也可以跟投（弃车保帅）\n';
                    userPrompt += '• 别投票太特立独行，容易暴露\n';
                    userPrompt += '</strategy>\n\n';
                } else if (player.role === 'seer') {
                    var seerChecks = game.gameLog.filter(function(log) {
                        return log.event === 'nightAction' && log.action === 'seerCheck' && log.seerId === player.id;
                    });
                    var knownWolves = seerChecks.filter(function(c) { return c.result === '狼人'; });
                    if (knownWolves.length > 0) {
                        userPrompt += '<your_info>\n';
                        userPrompt += '你查到的狼人：' + knownWolves.map(function(c) { return c.targetName; }).join('、') + '\n';
                        userPrompt += '优先投他们！\n';
                        userPrompt += '</your_info>\n\n';
                    }
                    userPrompt += '<strategy>预言家掌握关键信息，带动好人投票方向</strategy>\n\n';
                } else {
                    userPrompt += '<strategy>\n';
                    userPrompt += '投票依据：\n';
                    userPrompt += '1. 发言逻辑有问题、前后矛盾的人\n';
                    userPrompt += '2. 帮可疑的人说话、洗地的人\n';
                    userPrompt += '3. 表现太沉默或太刻意的人\n';
                    userPrompt += '4. 跟着预言家（如果有人跳了且可信）\n';
                    userPrompt += '</strategy>\n\n';
                }
                userPrompt += '直接回复一个名字：';
                break;
        }
        
        // ========== 调用API ==========
        var apiConfigId = game.apiConfigId;
        if (!apiConfigId) {
            apiConfigId = ai ? ai.apiConfigId : null;
        }
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configIds = Object.keys(PhoneCore.api.configs);
            apiConfigId = configIds.length > 0 ? configIds[0] : null;
        }
        
        if (!apiConfigId) {
            callback(this.getDefaultGameResponse(actionType, context));
            return;
        }
        
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        var maxRetries = 2;
        var retryDelay = 1000;
        
        var attemptApiCall = function(retryCount) {
            PhoneCore.api.call(systemPrompt, apiConfigId, {
                messages: [{ role: 'user', content: userPrompt }],
                maxTokens: configuredMaxTokens,
                temperature: 0.8
            }).then(function(response) {
                var content = response && typeof response === 'object' ? response.content : response;
                callback(content || self.getDefaultGameResponse(actionType, context));
            }).catch(function(err) {
                console.error('Game AI call failed (attempt ' + (retryCount + 1) + '):', err);
                
                if (retryCount < maxRetries) {
                    console.log('Retrying API call in ' + retryDelay + 'ms...');
                    setTimeout(function() {
                        attemptApiCall(retryCount + 1);
                    }, retryDelay);
                } else {
                    console.error('All API call attempts failed, using default response');
                    callback(self.getDefaultGameResponse(actionType, context));
                }
            });
        };
        
        attemptApiCall(0);
    };
    
    // 默认游戏回复（无API或API失败时）- 返回空，不显示任何默认发言
    ChatApp.prototype.getDefaultGameResponse = function(actionType, context) {
        // 不显示任何默认发言，返回空字符串
        if (actionType === 'day_speech') {
            return ''; // 不显示默认发言
        }
        
        // 对于需要选择目标的动作，随机选择（这是必须的，否则游戏无法继续）
        if (context.targets && context.targets.length > 0) {
            var idx = Math.floor(Math.random() * context.targets.length);
            return context.targets[idx].name;
        }
        
        if (context.alivePlayers && context.alivePlayers.length > 0) {
            var idx = Math.floor(Math.random() * context.alivePlayers.length);
            return context.alivePlayers[idx].name;
        }
        
        return '';
    };
    
    // 从回复中解析目标玩家
    ChatApp.prototype.parseTargetFromResponse = function(response, targets) {
        if (!response || !targets || targets.length === 0) {
            return targets[0] ? targets[0].id : null;
        }
        
        // 确保response是字符串
        if (typeof response === 'object' && response.content) {
            response = response.content;
        }
        if (typeof response !== 'string') {
            return targets[0] ? targets[0].id : null;
        }
        
        // 尝试匹配玩家名字
        for (var i = 0; i < targets.length; i++) {
            if (response.includes(targets[i].name)) {
                return targets[i].id;
            }
        }
        
        // 匹配座位号
        var seatMatch = response.match(/(\d+)号/);
        if (seatMatch) {
            var seatNum = parseInt(seatMatch[1]);
            var target = targets.find(function(t) { return t.seatNumber === seatNum; });
            if (target) return target.id;
        }
        
        // 默认返回第一个
        return targets[0].id;
    };
    
    // 添加游戏消息（增量添加，避免闪烁）
    ChatApp.prototype.addGameMessage = function(msg) {
        var self = this;
        var game = this.currentGame;
        if (!game) return;
        
        msg.timestamp = Date.now();
        msg.id = 'gmsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        game.chatHistory.push(msg);
        
        // 增量渲染新消息到DOM（避免闪烁）
        var messagesContainer = this.gamePageElement ? this.gamePageElement.querySelector('#game-messages') : null;
        if (messagesContainer) {
            var msgHtml = this.renderSingleGameMessage(msg);
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = msgHtml;
            var newMsgEl = tempDiv.firstElementChild;
            if (newMsgEl) {
                newMsgEl.classList.add('msg-new');
                messagesContainer.appendChild(newMsgEl);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    };
    
    // 逐条显示多条系统消息（带延迟动画效果）
    ChatApp.prototype.addGameMessagesSequentially = function(messages, delay, callback) {
        var self = this;
        delay = delay || 400;
        
        var showNext = function(index) {
            if (index >= messages.length) {
                if (callback) callback();
                return;
            }
            
            self.addGameMessage(messages[index]);
            
            setTimeout(function() {
                showNext(index + 1);
            }, delay);
        };
        
        showNext(0);
    };
    
    // 渲染单条游戏消息
    ChatApp.prototype.renderSingleGameMessage = function(msg) {
        var self = this;
        var game = this.currentGame;
        var html = '';
        
        if (msg.type === 'system') {
            html = '<div class="msg-system">' + msg.content + '</div>';
        } else if (msg.type === 'narrative') {
            // 叙事/心理描写（上帝视角专用）
            html = '<div style="text-align:center;margin:12px 8px;">';
            html += '<div style="display:inline-block;max-width:90%;padding:10px 14px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.1));border:1px solid rgba(139,92,246,0.25);border-radius:12px;color:#a78bfa;font-size:11px;line-height:1.6;font-style:italic;text-align:left;">';
            html += msg.content;
            html += '</div>';
            html += '</div>';
        } else if (msg.type === 'phase') {
            html = '<div style="text-align:center;margin:15px 0;">';
            html += '<div style="display:inline-block;padding:6px 14px;background:' + msg.color + '25;border-radius:12px;color:' + msg.color + ';font-size:11px;font-weight:500;">';
            html += msg.content;
            html += '</div>';
            html += '</div>';
        } else if (msg.type === 'speech' || msg.type === 'review') {
            var isUser = msg.playerId === 'user';
            html = '<div style="display:flex;align-items:flex-start;gap:6px;margin:8px 0;' + (isUser ? 'flex-direction:row-reverse;' : '') + '">';
            
            // 头像
            if (!isUser) {
                var player = game.players.find(function(p) { return p.id === msg.playerId; });
                var ai = player ? PhoneCore.getAI(player.id) : null;
                html += '<div style="width:26px;height:26px;border-radius:50%;background:' + (player ? self.getAvatarColor(player.id) : '#666') + ';flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">';
                if (ai && ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += (msg.playerName || '?').charAt(0);
                }
                html += '</div>';
            }
            
            // 消息
            html += '<div style="max-width:75%;">';
            if (!isUser) {
                html += '<div style="font-size:10px;color:#5A8FBF;margin-bottom:3px;font-weight:500;">' + (msg.playerName || '未知') + '</div>';
            }
            html += '<div class="msg-bubble ' + (isUser ? 'msg-user' : 'msg-ai') + '">';
            html += msg.content;
            html += '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        return html;
    };
    
    // 更新游戏UI（只更新状态，不重新渲染消息）
    ChatApp.prototype.updateGameUI = function(forceRefreshMessages) {
        var game = this.currentGame;
        if (!game || !this.gamePageElement) return;
        
        // 只在需要时才完全刷新消息区域（如游戏结束时显示所有身份）
        if (forceRefreshMessages) {
            var messagesContainer = this.gamePageElement.querySelector('#game-messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = this.renderGameMessages();
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
        
        // 更新轮次显示
        var roundEl = this.gamePageElement.querySelector('#game-round');
        if (roundEl) {
            roundEl.textContent = '第 ' + game.round + ' 轮';
        }
        
        // 更新存活人数显示
        var aliveEl = this.gamePageElement.querySelector('#alive-count');
        if (aliveEl) {
            aliveEl.textContent = '存活 ' + game.alivePlayers.length + '/' + game.players.length + ' 人';
        }
        
        // 更新阶段显示
        var phaseEl = this.gamePageElement.querySelector('#game-phase');
        if (phaseEl) {
            var phaseText = '狼人杀';
            if (game.phase === 'night') phaseText = '夜晚';
            else if (game.phase === 'day_speech') phaseText = '白天发言';
            else if (game.phase === 'day_vote') phaseText = '投票环节';
            else if (game.phase === 'ended') phaseText = '游戏结束';
            else if (game.phase === 'review') phaseText = '复盘讨论';
            phaseEl.textContent = phaseText;
        }
        
        // 控制发言顺序栏的显示
        var orderBar = this.gamePageElement.querySelector('#speech-order-bar');
        if (orderBar) {
            if (game.phase === 'day_speech' && game.speechOrder && game.speechOrder.length > 0) {
                orderBar.style.display = 'block';
                this.updateSpeechOrderDisplay();
            } else {
                orderBar.style.display = 'none';
            }
        }
    };
    
    // 渲染游戏记录卡片（在群聊中显示）- 底部悬浮删除按钮样式
    ChatApp.prototype.renderGameRecordCard = function(msg) {
        var self = this;
        var record = msg.gameRecord;
        if (!record) return '';
        
        // 判断游戏类型
        if (record.gameType === 'undercover') {
            return this.renderUndercoverRecordCard(msg);
        }
        
        // 狼人杀游戏卡片（默认）
        var winnerText = record.winner === 'village' ? '好人胜' : record.winner === 'wolf' ? '狼人胜' : record.winner === 'lovers' ? '情侣胜' : '未分胜负';
        var winnerColor = record.winner === 'village' ? '#4a9a6a' : record.winner === 'wolf' ? '#c85a5a' : record.winner === 'lovers' ? '#c85a8a' : '#888';
        var duration = Math.floor(record.duration / 60000);
        
        // 使用 message-wrapper 结构，与通话记录卡片样式保持一致
        var html = '<div class="message-wrapper special-msg-wrapper" data-msg-id="' + msg.id + '" style="text-align:center;margin:16px 0;position:relative;">';
        html += '<div class="game-record-card" data-record-id="' + record.id + '" data-msg-id="' + msg.id + '" style="display:inline-block;background:#f5f7fa;border:1px solid #e0e4ea;border-radius:12px;padding:14px;width:240px;cursor:pointer;transition:all 0.2s;text-align:left;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        
        // 游戏图标
        html += '<div style="width:42px;height:42px;background:linear-gradient(135deg,#A8C8EC,#D6E4FF);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
        html += '<span style="font-size:18px;color:#4A6FA5;">W</span>';
        html += '</div>';
        
        // 信息
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#333;">狼人杀</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:3px;">' + record.playerCount + '人局 / ' + record.rounds + '轮 / ' + duration + '分钟</div>';
        html += '</div>';
        
        // 结果
        html += '<div style="text-align:right;">';
        html += '<div style="font-size:12px;font-weight:600;color:' + winnerColor + ';">' + winnerText + '</div>';
        html += '<span style="font-size:12px;color:#A8C8EC;margin-top:2px;">→</span>';
        html += '</div>';
        
        html += '</div>';
        
        // 梗概
        if (record.summary) {
            html += '<div style="font-size:11px;color:#666;margin-top:10px;padding-top:10px;border-top:1px solid #e8e8e8;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">';
            html += record.summary;
            html += '</div>';
        }
        
        html += '</div>';
        
        // 底部悬浮按钮组（与通话记录卡片样式一致）
        html += '<div class="message-actions special-actions" style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);display:none;gap:4px;z-index:100;">';
        // 收藏按钮
        html += '<button class="action-btn game-record-favorite-btn" data-record-id="' + record.id + '" data-msg-id="' + msg.id + '" title="收藏" style="width:26px;height:26px;border:1px solid #D6E4FF;background:#FFF;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
        html += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF6B9D" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
        html += '</button>';
        // 删除按钮
        html += '<button class="action-btn game-record-delete-btn" data-record-id="' + record.id + '" data-msg-id="' + msg.id + '" title="删除记录" style="width:26px;height:26px;border:1px solid #D6E4FF;background:#FFF;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
        html += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF6B9D" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
        html += '</button>';
        html += '</div>';
        
        html += '</div>';
        
        return html;
    };
    
    // 删除游戏记录
    ChatApp.prototype.deleteGameRecord = function(groupId, msgId, cardElement) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group || !group.chatHistory) return;
        
        // 从聊天历史中移除该消息
        var index = group.chatHistory.findIndex(function(msg) {
            return msg.id === msgId;
        });
        
        if (index !== -1) {
            group.chatHistory.splice(index, 1);
            this.saveGroupChat(group);
            
            // 从 DOM 中移除卡片元素（带动画）
            if (cardElement) {
                cardElement.style.transition = 'all 0.3s ease';
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'translateX(-20px)';
                cardElement.style.height = cardElement.offsetHeight + 'px';
                setTimeout(function() {
                    cardElement.style.height = '0';
                    cardElement.style.padding = '0';
                    cardElement.style.margin = '0';
                    cardElement.style.border = 'none';
                }, 150);
                setTimeout(function() {
                    cardElement.remove();
                }, 300);
            }
            
            PhoneCore.notifications.send({
                type: 'success',
                title: '游戏记录已删除',
                size: 'mini'
            });
        }
    };
    
    // 打开游戏记录详情
    ChatApp.prototype.openGameRecordDetail = function(groupId, recordId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        // 查找游戏记录
        var recordMsg = group.chatHistory.find(function(msg) {
            return msg.type === 'game_record' && msg.gameRecord && msg.gameRecord.id === recordId;
        });
        
        if (!recordMsg || !recordMsg.gameRecord) {
            PhoneCore.notifications.send({
                type: 'error',
                title: '记录不存在',
                size: 'mini'
            });
            return;
        }
        
        var record = recordMsg.gameRecord;
        
        // 判断游戏类型
        if (record.gameType === 'undercover') {
            this.openUndercoverRecordDetail(groupId, record);
            return;
        }
        
        // 狼人杀游戏记录详情（默认）
        var winnerText = record.winner === 'village' ? '好人阵营胜利' : record.winner === 'wolf' ? '狼人阵营胜利' : record.winner === 'lovers' ? '情侣胜利' : '未分胜负';
        var winnerColor = record.winner === 'village' ? '#4a9a6a' : record.winner === 'wolf' ? '#c85a5a' : record.winner === 'lovers' ? '#c85a8a' : '#888';
        var duration = Math.floor(record.duration / 60000);
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#F0F7FF 100%);min-height:100%;">';
        
        // 游戏结果头部
        html += '<div style="text-align:center;padding:16px 0;margin-bottom:16px;">';
        html += '<div style="width:56px;height:56px;margin:0 auto 12px;background:linear-gradient(135deg,#A8C8EC,#D6E4FF);border-radius:16px;display:flex;align-items:center;justify-content:center;">';
        html += '<span style="font-size:24px;color:#4A6FA5;">W</span>';
        html += '</div>';
        html += '<div style="font-size:16px;font-weight:600;color:' + winnerColor + ';margin-bottom:6px;">' + winnerText + '</div>';
        html += '<div style="font-size:11px;color:#7A9BBF;">' + record.playerCount + '人局 / ' + record.rounds + '轮 / ' + duration + '分钟</div>';
        html += '</div>';
        
        // 玩家列表
        html += '<div style="background:white;border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">玩家身份</div>';
        
        record.players.forEach(function(player) {
            var roleInfo = self.werewolfRoles[player.role];
            html += '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #E9ECEF;">';
            html += '<div style="width:26px;height:26px;border-radius:50%;background:' + self.getAvatarColor(player.id) + ';margin-right:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">' + player.name.charAt(0) + '</div>';
            html += '<div style="flex:1;">';
            html += '<div style="color:#3A5A80;font-size:11px;">' + player.name + (player.isUser ? ' (你)' : '') + '</div>';
            html += '</div>';
            html += '<div style="display:flex;align-items:center;gap:4px;">';
            html += '<span style="color:' + roleInfo.color + ';">' + roleInfo.icon + '</span>';
            html += '<span style="color:' + roleInfo.color + ';font-size:10px;">' + roleInfo.name + '</span>';
            if (!player.isAlive) {
                html += '<span style="color:#999;font-size:9px;margin-left:4px;">(死亡)</span>';
            }
            html += '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        
        // 游戏梗概
        if (record.summary) {
            html += '<div style="background:white;border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid #D6E4FF;">';
            html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:8px;">游戏概要</div>';
            html += '<div style="color:#7A9BBF;font-size:10px;line-height:1.6;">' + record.summary + '</div>';
            html += '</div>';
        }
        
        // 夜晚动作记录（从gameLog中提取）
        if (record.gameLog && record.gameLog.length > 0) {
            var nightActions = record.gameLog.filter(function(log) { return log.event === 'nightAction'; });
            var deathLogs = record.gameLog.filter(function(log) { return log.event === 'death'; });
            
            if (nightActions.length > 0 || deathLogs.length > 0) {
                html += '<div style="background:white;border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid #D6E4FF;">';
                html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">夜晚动作记录</div>';
                html += '<div style="max-height:200px;overflow-y:auto;">';
                
                // 按轮次分组显示
                var roundLogs = {};
                nightActions.forEach(function(log) {
                    var round = log.round || 1;
                    if (!roundLogs[round]) roundLogs[round] = [];
                    roundLogs[round].push(log);
                });
                deathLogs.forEach(function(log) {
                    var round = log.round || 1;
                    if (!roundLogs[round]) roundLogs[round] = [];
                    roundLogs[round].push(log);
                });
                
                Object.keys(roundLogs).sort(function(a, b) { return a - b; }).forEach(function(round) {
                    html += '<div style="margin-bottom:10px;">';
                    html += '<div style="font-size:10px;font-weight:600;color:#4A6FA5;margin-bottom:6px;padding:4px 8px;background:rgba(74,111,165,0.1);border-radius:6px;display:inline-block;">第 ' + round + ' 夜</div>';
                    
                    roundLogs[round].forEach(function(log) {
                        var actionText = '';
                        var actionIcon = '';
                        var actionColor = '#666';
                        var reasonText = '';
                        
                        if (log.event === 'nightAction') {
                            switch (log.action) {
                                case 'wolfKill':
                                    actionIcon = '[狼]';
                                    actionText = '狼人击杀 ' + log.targetName;
                                    actionColor = '#c85a5a';
                                    if (log.reason) reasonText = log.reason;
                                    break;
                                case 'witchSave':
                                    actionIcon = '[救]';
                                    actionText = '女巫解药救了 ' + log.targetName;
                                    actionColor = '#4a9a6a';
                                    if (log.reason) reasonText = log.reason;
                                    break;
                                case 'witchPoison':
                                    actionIcon = '[毒]';
                                    actionText = '女巫毒药毒了 ' + log.targetName;
                                    actionColor = '#8c64aa';
                                    if (log.reason) reasonText = log.reason;
                                    break;
                                case 'witchSkip':
                                    actionIcon = '[巫]';
                                    actionText = '女巫选择不使用药水';
                                    actionColor = '#7a5a8a';
                                    if (log.reason) reasonText = log.reason;
                                    break;
                                case 'guardProtect':
                                    actionIcon = '[守]';
                                    actionText = '守卫守护 ' + log.targetName;
                                    actionColor = '#5082b4';
                                    break;
                                case 'seerCheck':
                                    actionIcon = '[查]';
                                    actionText = '预言家查验 ' + log.targetName + ': ' + log.result;
                                    actionColor = '#9b59b6';
                                    if (log.reason) reasonText = log.reason;
                                    break;
                            }
                        } else if (log.event === 'death') {
                            var causeText = '';
                            switch (log.cause) {
                                case 'night': causeText = '夜间死亡'; break;
                                case 'vote': causeText = '被投票出局'; break;
                                case 'hunter': causeText = '被猎人带走'; break;
                                case 'lover_death': causeText = '殉情'; break;
                                case 'poison': causeText = '被毒杀'; break;
                                default: causeText = '死亡';
                            }
                            actionIcon = '[亡]';
                            actionText = log.playerName + ' ' + causeText;
                            actionColor = '#999';
                        }
                        
                        if (actionText) {
                            html += '<div style="padding:4px 8px;font-size:10px;color:' + actionColor + ';">';
                            html += '<div style="display:flex;align-items:center;gap:6px;">';
                            html += '<span>' + actionIcon + '</span>';
                            html += '<span>' + actionText + '</span>';
                            html += '</div>';
                            // 显示心理活动（如果有）
                            if (reasonText) {
                                html += '<div style="margin-left:24px;margin-top:2px;font-size:9px;color:#9a8aaa;font-style:italic;">' + reasonText + '</div>';
                            }
                            html += '</div>';
                        }
                    });
                    
                    html += '</div>';
                });
                
                html += '</div>';
                html += '</div>';
            }
        }
        
        // 完整游戏记录
        html += '<div style="background:white;border-radius:10px;padding:12px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">游戏流程</div>';
        html += '<div style="max-height:280px;overflow-y:auto;">';
        
        if (record.fullLog && record.fullLog.length > 0) {
            record.fullLog.forEach(function(msg) {
                if (msg.type === 'system') {
                    html += '<div style="text-align:center;padding:5px 0;font-size:10px;color:#A8C8EC;">' + msg.content + '</div>';
                } else if (msg.type === 'phase') {
                    html += '<div style="text-align:center;padding:6px 0;">';
                    html += '<span style="display:inline-block;padding:3px 10px;background:' + (msg.color || '#4A6FA5') + '25;border-radius:10px;color:' + (msg.color || '#4A6FA5') + ';font-size:10px;font-weight:500;">' + msg.content + '</span>';
                    html += '</div>';
                } else if (msg.type === 'speech' || msg.type === 'review') {
                    var isUser = msg.playerId === 'user';
                    html += '<div style="display:flex;gap:6px;margin:6px 0;' + (isUser ? 'flex-direction:row-reverse;' : '') + '">';
                    html += '<div style="max-width:75%;">';
                    html += '<div style="font-size:9px;color:#A8C8EC;margin-bottom:2px;' + (isUser ? 'text-align:right;' : '') + '">' + (msg.playerName || '未知') + '</div>';
                    html += '<div style="padding:6px 10px;background:' + (isUser ? 'linear-gradient(135deg,#4A6FA5,#5A8FBF)' : '#F0F7FF') + ';border-radius:8px;color:' + (isUser ? 'white' : '#3A5A80') + ';font-size:10px;">' + msg.content + '</div>';
                    html += '</div>';
                    html += '</div>';
                }
            });
        } else {
            html += '<div style="text-align:center;color:#A8C8EC;font-size:11px;padding:16px;">暂无详细记录</div>';
        }
        
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        this.openDetailPage(html, { title: '游戏记录', titleColor: '#4A6FA5', bgColor: '#E8F4FF' });
    };
    
    // ============ 狼人杀提示词管理 ============
    
    // 打开狼人杀提示词管理页面
    ChatApp.prototype.openWerewolfPromptsManager = function(groupId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        // 确保数据结构存在
        if (!group.werewolfPrompts) {
            group.werewolfPrompts = {
                systemPrompt: '',
                relations: [],
                triggerSettings: {
                    gameStart: true,
                    nightAction: true,
                    daySpeech: true,
                    vote: true
                }
            };
        }
        
        var prompts = group.werewolfPrompts;
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#F0F7FF 100%);min-height:100%;">';
        
        // 标题说明
        html += '<div style="background:rgba(74,111,165,0.1);border-radius:12px;padding:14px;margin-bottom:20px;">';
        html += '<div style="font-size:12px;color:#4A6FA5;line-height:1.6;">';
        html += '自定义AI在狼人杀游戏中的行为表现，包括系统提示词和角色关系设定。';
        html += '</div>';
        html += '</div>';
        
        // 系统提示词设置
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
        html += '<div>';
        html += '<div style="font-size:14px;font-weight:600;color:#3A5A80;">系统提示词</div>';
        html += '<div style="font-size:10px;color:#7A9BBF;margin-top:2px;">全局生效，影响所有AI的游戏行为</div>';
        html += '</div>';
        html += '<div id="edit-system-prompt-btn" style="padding:6px 12px;background:linear-gradient(135deg,#4A6FA5,#5A8FBF);border-radius:8px;color:white;font-size:11px;cursor:pointer;">';
        html += prompts.systemPrompt ? '编辑' : '设置';
        html += '</div>';
        html += '</div>';
        
        if (prompts.systemPrompt && prompts.systemPrompt.trim()) {
            html += '<div style="background:#F5F9FF;border-radius:8px;padding:10px;font-size:11px;color:#5A7A9A;line-height:1.5;max-height:80px;overflow-y:auto;">';
            html += prompts.systemPrompt.substring(0, 200) + (prompts.systemPrompt.length > 200 ? '...' : '');
            html += '</div>';
        } else {
            html += '<div style="text-align:center;padding:12px;color:#A8C8EC;font-size:11px;">未设置系统提示词</div>';
        }
        html += '</div>';
        
        // 关系设定
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
        html += '<div>';
        html += '<div style="font-size:14px;font-weight:600;color:#3A5A80;">角色关系设定</div>';
        html += '<div style="font-size:10px;color:#7A9BBF;margin-top:2px;">描述角色之间的关系，如好友、对手等</div>';
        html += '</div>';
        html += '<div id="add-relation-btn" style="padding:6px 12px;background:linear-gradient(135deg,#5A8FBF,#6AA0CF);border-radius:8px;color:white;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;">';
        html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>添加';
        html += '</div>';
        html += '</div>';
        
        html += '<div id="relations-list">';
        if (prompts.relations && prompts.relations.length > 0) {
            prompts.relations.forEach(function(relation, index) {
                html += '<div class="relation-item" data-index="' + index + '" style="display:flex;align-items:center;padding:10px;background:#F5F9FF;border-radius:8px;margin-bottom:8px;cursor:pointer;">';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:12px;color:#3A5A80;font-weight:500;">' + (relation.name || '关系' + (index + 1)) + '</div>';
                html += '<div style="font-size:10px;color:#7A9BBF;margin-top:2px;">' + (relation.description || '').substring(0, 50) + (relation.description && relation.description.length > 50 ? '...' : '') + '</div>';
                html += '</div>';
                html += '<div class="delete-relation-btn" data-index="' + index + '" style="width:24px;height:24px;background:rgba(200,90,90,0.15);border-radius:6px;display:flex;align-items:center;justify-content:center;margin-left:8px;">';
                html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="#c85a5a"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
                html += '</div>';
                html += '</div>';
            });
        } else {
            html += '<div style="text-align:center;padding:20px;color:#A8C8EC;font-size:11px;">';
            html += '<div style="margin-bottom:4px;">暂无关系设定</div>';
            html += '<div style="font-size:10px;">添加关系可以让AI理解角色间的特殊联系</div>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        
        // 提示词读取时机
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:14px;font-weight:600;color:#3A5A80;margin-bottom:12px;">读取时机</div>';
        html += '<div style="font-size:10px;color:#7A9BBF;margin-bottom:12px;">选择提示词在哪些阶段注入到AI</div>';
        
        var triggerOptions = [
            { id: 'gameStart', name: '游戏开始', desc: '首轮夜晚前读取' },
            { id: 'nightAction', name: '夜晚行动', desc: '每个夜晚行动时读取' },
            { id: 'daySpeech', name: '白天发言', desc: '每次发言前读取' },
            { id: 'vote', name: '投票环节', desc: '投票时读取' }
        ];
        
        triggerOptions.forEach(function(opt) {
            var isChecked = prompts.triggerSettings && prompts.triggerSettings[opt.id] !== false;
            html += '<label class="trigger-option" style="display:flex;align-items:center;padding:10px 12px;background:#F5F9FF;border-radius:8px;margin-bottom:8px;cursor:pointer;">';
            html += '<input type="checkbox" name="trigger-' + opt.id + '" ' + (isChecked ? 'checked' : '') + ' style="display:none;">';
            html += '<div class="trigger-checkbox" style="width:18px;height:18px;border-radius:5px;background:' + (isChecked ? '#4A6FA5' : '#D6E4FF') + ';display:flex;align-items:center;justify-content:center;margin-right:10px;transition:all 0.2s;">';
            html += '<svg class="trigger-check" width="10" height="10" viewBox="0 0 24 24" fill="white" style="opacity:' + (isChecked ? '1' : '0') + ';transition:all 0.2s;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
            html += '</div>';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:12px;color:#3A5A80;">' + opt.name + '</div>';
            html += '<div style="font-size:10px;color:#7A9BBF;margin-top:1px;">' + opt.desc + '</div>';
            html += '</div>';
            html += '</label>';
        });
        html += '</div>';
        
        // 快速模板
        html += '<div style="background:white;border-radius:12px;padding:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:14px;font-weight:600;color:#3A5A80;margin-bottom:12px;">快速模板</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        
        var templates = [
            { id: 'campus', name: '校园背景', desc: '大学同学玩狼人杀' },
            { id: 'office', name: '职场背景', desc: '同事团建玩游戏' },
            { id: 'friends', name: '老友聚会', desc: '多年老友聚会' },
            { id: 'custom', name: '清空设置', desc: '重置所有设定' }
        ];
        
        templates.forEach(function(tpl) {
            html += '<div class="template-btn" data-template="' + tpl.id + '" style="flex:1;min-width:45%;padding:10px;background:#F5F9FF;border:1px solid #D6E4FF;border-radius:8px;cursor:pointer;text-align:center;">';
            html += '<div style="font-size:11px;color:#4A6FA5;font-weight:500;">' + tpl.name + '</div>';
            html += '<div style="font-size:9px;color:#7A9BBF;margin-top:2px;">' + tpl.desc + '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html, { title: '提示词管理', titleColor: '#4A6FA5', bgColor: '#E8F4FF' });
        
        // 绑定事件
        this.bindWerewolfPromptsEvents(page, groupId);
    };
    
    // 绑定提示词管理页面事件
    ChatApp.prototype.bindWerewolfPromptsEvents = function(page, groupId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        // 编辑系统提示词
        var editSystemBtn = page.querySelector('#edit-system-prompt-btn');
        if (editSystemBtn) {
            editSystemBtn.onclick = function() {
                self.openWerewolfSystemPromptEditor(groupId);
            };
        }
        
        // 添加关系
        var addRelationBtn = page.querySelector('#add-relation-btn');
        if (addRelationBtn) {
            addRelationBtn.onclick = function() {
                self.openWerewolfRelationEditor(groupId, null);
            };
        }
        
        // 编辑关系
        page.querySelectorAll('.relation-item').forEach(function(item) {
            item.onclick = function(e) {
                if (e.target.closest('.delete-relation-btn')) return;
                var index = parseInt(item.getAttribute('data-index'));
                self.openWerewolfRelationEditor(groupId, index);
            };
        });
        
        // 删除关系
        page.querySelectorAll('.delete-relation-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var index = parseInt(btn.getAttribute('data-index'));
                if (confirm('确定要删除这个关系设定吗?')) {
                    group.werewolfPrompts.relations.splice(index, 1);
                    self.saveGroupChat(group);
                    page.querySelector('.app-back-btn').click();
                    setTimeout(function() {
                        self.openWerewolfPromptsManager(groupId);
                    }, 350);
                }
            };
        });
        
        // 读取时机切换
        page.querySelectorAll('.trigger-option').forEach(function(label) {
            label.onclick = function() {
                var checkbox = label.querySelector('input[type="checkbox"]');
                var checkboxDiv = label.querySelector('.trigger-checkbox');
                var checkIcon = label.querySelector('.trigger-check');
                
                checkbox.checked = !checkbox.checked;
                
                if (checkbox.checked) {
                    checkboxDiv.style.background = '#4A6FA5';
                    checkIcon.style.opacity = '1';
                } else {
                    checkboxDiv.style.background = '#D6E4FF';
                    checkIcon.style.opacity = '0';
                }
                
                // 保存设置
                if (!group.werewolfPrompts.triggerSettings) {
                    group.werewolfPrompts.triggerSettings = {};
                }
                
                var triggerId = checkbox.name.replace('trigger-', '');
                group.werewolfPrompts.triggerSettings[triggerId] = checkbox.checked;
                self.saveGroupChat(group);
            };
        });
        
        // 快速模板
        page.querySelectorAll('.template-btn').forEach(function(btn) {
            btn.onclick = function() {
                var templateId = btn.getAttribute('data-template');
                self.applyWerewolfPromptTemplate(groupId, templateId);
                page.querySelector('.app-back-btn').click();
                setTimeout(function() {
                    self.openWerewolfPromptsManager(groupId);
                }, 350);
            };
        });
    };
    
    // 应用提示词模板
    ChatApp.prototype.applyWerewolfPromptTemplate = function(groupId, templateId) {
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        if (!group.werewolfPrompts) {
            group.werewolfPrompts = { systemPrompt: '', relations: [], triggerSettings: {} };
        }
        
        switch (templateId) {
            case 'campus':
                group.werewolfPrompts.systemPrompt = '这是一群大学同学在宿舍玩狼人杀，大家都是年轻人，说话活泼接地气，会开玩笑、吐槽、互相调侃。游戏氛围轻松愉快，可以用一些网络用语和校园梗。';
                group.werewolfPrompts.relations = [
                    { name: '室友关系', description: '有些玩家是室友，平时一起生活，了解彼此的说话习惯和小动作。' },
                    { name: '社团关系', description: '有些玩家在同一个社团，经常一起活动，比较有默契。' }
                ];
                break;
            case 'office':
                group.werewolfPrompts.systemPrompt = '这是公司同事在团建时玩狼人杀，虽然是工作关系但大家已经比较熟了。说话可以轻松一些，但不会太出格。偶尔会有一些职场梗和工作相关的调侃。';
                group.werewolfPrompts.relations = [
                    { name: '部门同事', description: '同一个部门的同事，工作中经常合作，比较了解对方。' },
                    { name: '上下级', description: '有些玩家有上下级关系，但在游戏中平等对待。' }
                ];
                break;
            case 'friends':
                group.werewolfPrompts.systemPrompt = '这是一群认识多年的老朋友聚会玩狼人杀，大家非常熟悉彼此，可以毫无顾忌地开玩笑。每个人都知道其他人的性格特点和说话习惯，所以会根据这些来分析和推理。';
                group.werewolfPrompts.relations = [
                    { name: '发小关系', description: '有些玩家是从小一起长大的发小，默契度极高。' },
                    { name: '损友关系', description: '有些玩家是互相损的好朋友，经常互怼但感情很好。' }
                ];
                break;
            case 'custom':
                group.werewolfPrompts.systemPrompt = '';
                group.werewolfPrompts.relations = [];
                break;
        }
        
        this.saveGroupChat(group);
        PhoneCore.notifications.send({
            type: 'success',
            title: templateId === 'custom' ? '已清空设置' : '已应用模板',
            size: 'mini'
        });
    };
    
    // 系统提示词编辑器
    ChatApp.prototype.openWerewolfSystemPromptEditor = function(groupId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        var prompts = group.werewolfPrompts || {};
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#F0F7FF 100%);min-height:100%;">';
        
        // 说明
        html += '<div style="background:rgba(74,111,165,0.1);border-radius:10px;padding:12px;margin-bottom:16px;">';
        html += '<div style="font-size:11px;color:#4A6FA5;line-height:1.6;">';
        html += '系统提示词会在游戏开始时注入到所有AI，影响它们的整体行为风格。可以设定游戏的背景故事、氛围、角色特点等。';
        html += '</div>';
        html += '</div>';
        
        // 输入区
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:13px;font-weight:600;color:#3A5A80;margin-bottom:10px;">提示词内容</div>';
        html += '<textarea id="system-prompt-input" placeholder="例如：这是一群老朋友在线下聚会玩狼人杀，大家互相很熟悉，说话比较随意轻松..." style="width:100%;height:180px;padding:12px;border:1px solid #D6E4FF;border-radius:10px;font-size:12px;line-height:1.6;color:#3A5A80;resize:none;box-sizing:border-box;outline:none;">' + (prompts.systemPrompt || '') + '</textarea>';
        html += '<div style="display:flex;justify-content:space-between;margin-top:8px;">';
        html += '<div style="font-size:10px;color:#A8C8EC;">建议50-200字</div>';
        html += '<div id="char-count" style="font-size:10px;color:#A8C8EC;">' + (prompts.systemPrompt || '').length + '/500</div>';
        html += '</div>';
        html += '</div>';
        
        // 示例参考
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:13px;font-weight:600;color:#3A5A80;margin-bottom:10px;">参考示例</div>';
        html += '<div style="font-size:11px;color:#7A9BBF;line-height:1.6;">';
        html += '<div style="padding:8px;background:#F5F9FF;border-radius:6px;margin-bottom:8px;">';
        html += '"这是一个推理氛围比较浓厚的局，大家都很认真地玩，会仔细分析发言找破绽。狼人要小心伪装，好人要积极发言找线索。"';
        html += '</div>';
        html += '<div style="padding:8px;background:#F5F9FF;border-radius:6px;">';
        html += '"这是欢乐的娱乐局，大家主要是来开心的，可以多开玩笑，不用太认真。狼人可以大胆一点，好人也不用太严肃。"';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        // 保存按钮
        html += '<button id="save-system-prompt-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4A6FA5,#5A8FBF);border:none;border-radius:10px;color:white;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(74,111,165,0.3);">保存</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html, { title: '系统提示词', titleColor: '#4A6FA5', bgColor: '#E8F4FF' });
        
        var input = page.querySelector('#system-prompt-input');
        var charCount = page.querySelector('#char-count');
        var saveBtn = page.querySelector('#save-system-prompt-btn');
        
        // 字数统计
        if (input && charCount) {
            input.oninput = function() {
                var len = input.value.length;
                charCount.textContent = len + '/500';
                charCount.style.color = len > 500 ? '#c85a5a' : '#A8C8EC';
            };
        }
        
        // 保存
        if (saveBtn) {
            saveBtn.onclick = function() {
                var content = input.value.trim();
                if (content.length > 500) {
                    PhoneCore.notifications.send({ type: 'warning', title: '内容过长，请精简', size: 'mini' });
                    return;
                }
                
                if (!group.werewolfPrompts) {
                    group.werewolfPrompts = { systemPrompt: '', relations: [], triggerSettings: {} };
                }
                group.werewolfPrompts.systemPrompt = content;
                self.saveGroupChat(group);
                
                PhoneCore.notifications.send({ type: 'success', title: '保存成功', size: 'mini' });
                page.querySelector('.app-back-btn').click();
            };
        }
    };
    
    // 关系设定编辑器
    ChatApp.prototype.openWerewolfRelationEditor = function(groupId, relationIndex) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        var isNew = relationIndex === null;
        var prompts = group.werewolfPrompts || {};
        var relation = isNew ? {} : (prompts.relations && prompts.relations[relationIndex]) || {};
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#F0F7FF 100%);min-height:100%;">';
        
        // 说明
        html += '<div style="background:rgba(74,111,165,0.1);border-radius:10px;padding:12px;margin-bottom:16px;">';
        html += '<div style="font-size:11px;color:#4A6FA5;line-height:1.6;">';
        html += '设定角色之间的特殊关系，AI会根据这些关系调整游戏中的互动方式。';
        html += '</div>';
        html += '</div>';
        
        // 名称
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:13px;font-weight:600;color:#3A5A80;margin-bottom:10px;">关系名称</div>';
        html += '<input type="text" id="relation-name" value="' + (relation.name || '') + '" placeholder="如：好友、对手、暗恋" style="width:100%;padding:12px;border:1px solid #D6E4FF;border-radius:10px;font-size:13px;color:#3A5A80;box-sizing:border-box;outline:none;">';
        html += '</div>';
        
        // 涉及成员
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:13px;font-weight:600;color:#3A5A80;margin-bottom:10px;">涉及成员</div>';
        html += '<div style="font-size:10px;color:#7A9BBF;margin-bottom:10px;">选择这个关系涉及的角色（可多选）</div>';
        html += '<div id="member-selector" style="display:flex;flex-wrap:wrap;gap:8px;">';
        
        var selectedMembers = relation.members || [];
        group.members.forEach(function(memberId) {
            var ai = PhoneCore.getAI(memberId);
            if (!ai) return;
            
            var isSelected = selectedMembers.includes(memberId);
            html += '<label class="member-chip" data-member="' + memberId + '" style="display:flex;align-items:center;padding:6px 10px;background:' + (isSelected ? 'rgba(74,111,165,0.2)' : '#F5F9FF') + ';border:1px solid ' + (isSelected ? '#4A6FA5' : '#D6E4FF') + ';border-radius:16px;cursor:pointer;transition:all 0.2s;">';
            html += '<input type="checkbox" name="relation-member" value="' + memberId + '" ' + (isSelected ? 'checked' : '') + ' style="display:none;">';
            html += '<div style="width:20px;height:20px;border-radius:50%;background:' + self.getAvatarColor(memberId) + ';margin-right:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += ai.name.charAt(0);
            }
            html += '</div>';
            html += '<span style="font-size:11px;color:' + (isSelected ? '#3A5A80' : '#7A9BBF') + ';">' + ai.name + '</span>';
            html += '</label>';
        });
        
        // 添加用户选项
        var isUserSelected = selectedMembers.includes('user');
        html += '<label class="member-chip" data-member="user" style="display:flex;align-items:center;padding:6px 10px;background:' + (isUserSelected ? 'rgba(74,111,165,0.2)' : '#F5F9FF') + ';border:1px solid ' + (isUserSelected ? '#4A6FA5' : '#D6E4FF') + ';border-radius:16px;cursor:pointer;transition:all 0.2s;">';
        html += '<input type="checkbox" name="relation-member" value="user" ' + (isUserSelected ? 'checked' : '') + ' style="display:none;">';
        html += '<div style="width:20px;height:20px;border-radius:50%;background:#FF8FAB;margin-right:6px;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;">我</div>';
        html += '<span style="font-size:11px;color:' + (isUserSelected ? '#3A5A80' : '#7A9BBF') + ';">玩家(我)</span>';
        html += '</label>';
        
        html += '</div>';
        html += '</div>';
        
        // 关系描述
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:13px;font-weight:600;color:#3A5A80;margin-bottom:10px;">关系描述</div>';
        html += '<textarea id="relation-description" placeholder="详细描述这个关系的特点，AI会据此调整互动方式。\n例如：他们是多年好友，说话比较随意，会互相调侃开玩笑..." style="width:100%;height:120px;padding:12px;border:1px solid #D6E4FF;border-radius:10px;font-size:12px;line-height:1.6;color:#3A5A80;resize:none;box-sizing:border-box;outline:none;">' + (relation.description || '') + '</textarea>';
        html += '</div>';
        
        // 读取时机
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:13px;font-weight:600;color:#3A5A80;margin-bottom:10px;">读取时机</div>';
        html += '<div style="font-size:10px;color:#7A9BBF;margin-bottom:10px;">选择在什么阶段让AI知道这个关系</div>';
        
        var relationTriggers = [
            { id: 'always', name: '始终生效', desc: '所有阶段都读取' },
            { id: 'speech', name: '仅发言时', desc: '只在白天发言时读取' },
            { id: 'vote', name: '仅投票时', desc: '只在投票时读取' },
            { id: 'night', name: '仅夜晚时', desc: '只在夜晚行动时读取' }
        ];
        
        var currentTrigger = relation.trigger || 'always';
        relationTriggers.forEach(function(opt) {
            var isChecked = currentTrigger === opt.id;
            html += '<label class="relation-trigger-option" style="display:flex;align-items:center;padding:8px 10px;background:' + (isChecked ? 'rgba(74,111,165,0.15)' : '#F5F9FF') + ';border:1px solid ' + (isChecked ? '#4A6FA5' : '#E9ECEF') + ';border-radius:8px;margin-bottom:6px;cursor:pointer;">';
            html += '<input type="radio" name="relation-trigger" value="' + opt.id + '" ' + (isChecked ? 'checked' : '') + ' style="display:none;">';
            html += '<div class="trigger-radio" style="width:16px;height:16px;border-radius:50%;background:' + (isChecked ? '#4A6FA5' : 'white') + ';border:2px solid ' + (isChecked ? '#4A6FA5' : '#D6E4FF') + ';margin-right:10px;display:flex;align-items:center;justify-content:center;">';
            html += '<div style="width:6px;height:6px;border-radius:50%;background:white;opacity:' + (isChecked ? '1' : '0') + ';"></div>';
            html += '</div>';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:12px;color:#3A5A80;">' + opt.name + '</div>';
            html += '<div style="font-size:10px;color:#7A9BBF;">' + opt.desc + '</div>';
            html += '</div>';
            html += '</label>';
        });
        html += '</div>';
        
        // 保存按钮
        html += '<button id="save-relation-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4A6FA5,#5A8FBF);border:none;border-radius:10px;color:white;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(74,111,165,0.3);">保存</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html, { title: isNew ? '添加关系' : '编辑关系', titleColor: '#4A6FA5', bgColor: '#E8F4FF' });
        
        // 成员选择切换
        page.querySelectorAll('.member-chip').forEach(function(chip) {
            chip.onclick = function() {
                var checkbox = chip.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                
                if (checkbox.checked) {
                    chip.style.background = 'rgba(74,111,165,0.2)';
                    chip.style.borderColor = '#4A6FA5';
                    chip.querySelector('span').style.color = '#3A5A80';
                } else {
                    chip.style.background = '#F5F9FF';
                    chip.style.borderColor = '#D6E4FF';
                    chip.querySelector('span').style.color = '#7A9BBF';
                }
            };
        });
        
        // 读取时机选择
        page.querySelectorAll('.relation-trigger-option').forEach(function(label) {
            label.onclick = function() {
                page.querySelectorAll('.relation-trigger-option').forEach(function(l) {
                    l.style.background = '#F5F9FF';
                    l.style.borderColor = '#E9ECEF';
                    var radio = l.querySelector('.trigger-radio');
                    radio.style.background = 'white';
                    radio.style.borderColor = '#D6E4FF';
                    radio.querySelector('div').style.opacity = '0';
                });
                
                label.style.background = 'rgba(74,111,165,0.15)';
                label.style.borderColor = '#4A6FA5';
                var radio = label.querySelector('.trigger-radio');
                radio.style.background = '#4A6FA5';
                radio.style.borderColor = '#4A6FA5';
                radio.querySelector('div').style.opacity = '1';
                
                label.querySelector('input[type="radio"]').checked = true;
            };
        });
        
        // 保存
        var saveBtn = page.querySelector('#save-relation-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#relation-name').value.trim();
                var description = page.querySelector('#relation-description').value.trim();
                var selectedMembers = [];
                page.querySelectorAll('input[name="relation-member"]:checked').forEach(function(cb) {
                    selectedMembers.push(cb.value);
                });
                var trigger = page.querySelector('input[name="relation-trigger"]:checked');
                trigger = trigger ? trigger.value : 'always';
                
                if (!name) {
                    PhoneCore.notifications.send({ type: 'warning', title: '请输入关系名称', size: 'mini' });
                    return;
                }
                if (!description) {
                    PhoneCore.notifications.send({ type: 'warning', title: '请输入关系描述', size: 'mini' });
                    return;
                }
                
                if (!group.werewolfPrompts) {
                    group.werewolfPrompts = { systemPrompt: '', relations: [], triggerSettings: {} };
                }
                if (!group.werewolfPrompts.relations) {
                    group.werewolfPrompts.relations = [];
                }
                
                var relationData = {
                    name: name,
                    description: description,
                    members: selectedMembers,
                    trigger: trigger
                };
                
                if (isNew) {
                    group.werewolfPrompts.relations.push(relationData);
                } else {
                    group.werewolfPrompts.relations[relationIndex] = relationData;
                }
                
                self.saveGroupChat(group);
                PhoneCore.notifications.send({ type: 'success', title: '保存成功', size: 'mini' });
                page.querySelector('.app-back-btn').click();
            };
        }
    };
    
    // 获取狼人杀游戏的自定义提示词（用于注入到AI调用）
    ChatApp.prototype.getWerewolfCustomPrompts = function(groupId, playerId, phase) {
        // 优先从当前游戏中获取提示词（确保游戏中途修改不影响当前游戏）
        var prompts = null;
        if (this.currentGame && this.currentGame.werewolfPrompts) {
            prompts = this.currentGame.werewolfPrompts;
        } else {
            var group = this.getGroupChat(groupId);
            if (group && group.werewolfPrompts) {
                prompts = group.werewolfPrompts;
            }
        }
        
        if (!prompts) return '';
        
        var result = '';
        
        // 检查是否在指定阶段读取
        var triggerSettings = prompts.triggerSettings || {};
        var shouldIncludeSystem = false;
        
        switch (phase) {
            case 'gameStart':
                shouldIncludeSystem = triggerSettings.gameStart !== false;
                break;
            case 'night':
            case 'nightAction':
                shouldIncludeSystem = triggerSettings.nightAction !== false;
                break;
            case 'speech':
            case 'day_speech':
                shouldIncludeSystem = triggerSettings.daySpeech !== false;
                break;
            case 'vote':
            case 'day_vote':
                shouldIncludeSystem = triggerSettings.vote !== false;
                break;
            default:
                shouldIncludeSystem = true;
        }
        
        // 系统提示词
        if (shouldIncludeSystem && prompts.systemPrompt && prompts.systemPrompt.trim()) {
            result += '<custom_setting>\n' + prompts.systemPrompt.trim() + '\n</custom_setting>\n\n';
        }
        
        // 关系设定
        if (prompts.relations && prompts.relations.length > 0) {
            var relevantRelations = [];
            
            prompts.relations.forEach(function(relation) {
                // 检查是否在当前阶段读取
                var shouldInclude = false;
                switch (relation.trigger) {
                    case 'always':
                        shouldInclude = true;
                        break;
                    case 'speech':
                        shouldInclude = phase === 'speech' || phase === 'day_speech';
                        break;
                    case 'vote':
                        shouldInclude = phase === 'vote' || phase === 'day_vote';
                        break;
                    case 'night':
                        shouldInclude = phase === 'night' || phase === 'nightAction';
                        break;
                    default:
                        shouldInclude = true;
                }
                
                if (!shouldInclude) return;
                
                // 检查是否涉及当前玩家
                var members = relation.members || [];
                if (members.length === 0 || members.includes(playerId)) {
                    relevantRelations.push(relation);
                }
            });
            
            if (relevantRelations.length > 0) {
                result += '<relationships>\n';
                relevantRelations.forEach(function(rel) {
                    result += '【' + rel.name + '】' + rel.description + '\n';
                });
                result += '</relationships>\n\n';
            }
        }
        
        return result;
    };


// ========== 狼人杀代码结束 ==========
