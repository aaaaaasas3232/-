/**
 * ==========================================
 * 【小游戏 - 谁是卧底】
 * ==========================================
 * 
 * 从 chat.js 中剪切谁是卧底相关代码到这里
 * 搜索关键词：undercover、卧底
 */

// ========== 在下面粘贴谁是卧底代码 ==========

    // ============ 谁是卧底游戏系统 ============
    
    // 谁是卧底设置页面
    ChatApp.prototype.openUndercoverSetup = function(groupId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        var memberCount = group.members.length;
        
        // 可选人数配置（3-10人）
        var minPlayers = 3;
        var maxPlayers = Math.min(10, memberCount + 1); // +1是用户
        
        if (maxPlayers < minPlayers) {
            PhoneCore.notifications.send({
                type: 'warning',
                title: '人数不足',
                message: '谁是卧底至少需要3人参与',
                size: 'mini'
            });
            return;
        }
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#FFF5F7 0%,#FFF0F3 100%);min-height:100%;">';
        
        // 标题
        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#C76B8F;margin-bottom:6px;">谁是卧底</div>';
        html += '<div style="font-size:11px;color:#E88FAC;">群内有 ' + memberCount + ' 名成员</div>';
        html += '</div>';
        
        // 选择人数
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">游戏人数</div>';
        html += '<div id="player-count-selector" style="display:flex;flex-wrap:wrap;gap:6px;">';
        
        for (var num = minPlayers; num <= maxPlayers; num++) {
            var isDefault = num === Math.min(maxPlayers, 5);
            var undercoverCount = num <= 4 ? 1 : (num <= 7 ? 1 : 2);
            html += '<button class="player-count-btn' + (isDefault ? ' active' : '') + '" data-count="' + num + '" style="padding:10px 14px;background:' + (isDefault ? '#E88FAC' : 'white') + ';border:1px solid ' + (isDefault ? '#FFB3C6' : '#FFD6E0') + ';border-radius:8px;color:' + (isDefault ? 'white' : '#C76B8F') + ';font-size:11px;cursor:pointer;transition:all 0.2s;">';
            html += num + '人';
            html += '</button>';
        }
        
        html += '</div>';
        html += '<div id="player-count-desc" style="margin-top:8px;padding:10px;background:rgba(232,143,172,0.15);border-radius:8px;color:#C76B8F;font-size:10px;">';
        var defaultCount = Math.min(maxPlayers, 5);
        var defaultUndercoverCount = defaultCount <= 4 ? 1 : (defaultCount <= 7 ? 1 : 2);
        html += defaultCount + '人局: ' + defaultUndercoverCount + '名卧底，' + (defaultCount - defaultUndercoverCount) + '名平民';
        html += '</div>';
        html += '</div>';
        
        // 词语类型选择
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">词语类型</div>';
        html += '<div id="word-type-selector" style="display:flex;flex-wrap:wrap;gap:6px;">';
        
        var wordTypes = [
            { id: 'word', name: '词语', desc: '常见物品/概念' },
            { id: 'idiom', name: '成语', desc: '四字成语' },
            { id: 'poetry', name: '诗词', desc: '古诗词句' },
            { id: 'movie', name: '影视', desc: '电影/电视剧' },
            { id: 'food', name: '美食', desc: '各类食物' }
        ];
        
        wordTypes.forEach(function(type, index) {
            var isDefault = index === 0;
            html += '<button class="word-type-btn' + (isDefault ? ' active' : '') + '" data-type="' + type.id + '" style="padding:10px 14px;background:' + (isDefault ? '#E88FAC' : 'white') + ';border:1px solid ' + (isDefault ? '#FFB3C6' : '#FFD6E0') + ';border-radius:8px;color:' + (isDefault ? 'white' : '#C76B8F') + ';font-size:11px;cursor:pointer;transition:all 0.2s;">';
            html += type.name;
            html += '</button>';
        });
        
        html += '</div>';
        html += '<div id="word-type-desc" style="margin-top:8px;padding:10px;background:rgba(232,143,172,0.15);border-radius:8px;color:#C76B8F;font-size:10px;">';
        html += '词语: 常见物品/概念';
        html += '</div>';
        html += '</div>';
        
        // API配置选择
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">AI模型配置</div>';
        html += '<select id="undercover-api-select" style="width:100%;padding:10px 12px;background:white;border:1px solid #FFD6E0;border-radius:8px;color:#C76B8F;font-size:12px;cursor:pointer;outline:none;">';
        
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
        html += '<div style="font-size:10px;color:#FFB3C6;margin-top:6px;">用于生成词语对和AI玩家描述</div>';
        html += '</div>';
        
        // 参与模式
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">参与模式</div>';
        html += '<div style="display:flex;gap:8px;">';
        html += '<button id="uc-mode-player" class="uc-mode-btn active" style="flex:1;padding:12px;background:#E88FAC;border:1px solid #FFB3C6;border-radius:10px;color:white;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="font-size:12px;font-weight:600;">玩家模式</div>';
        html += '<div style="font-size:10px;opacity:0.8;margin-top:3px;">参与游戏获得词语</div>';
        html += '</button>';
        html += '<button id="uc-mode-god" class="uc-mode-btn" style="flex:1;padding:12px;background:white;border:1px solid #FFD6E0;border-radius:10px;color:#C76B8F;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="font-size:12px;font-weight:600;">上帝视角</div>';
        html += '<div style="font-size:10px;opacity:0.7;margin-top:3px;">观战全部流程</div>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        
        // 选择参与的AI
        html += '<div id="uc-player-selection" style="margin-bottom:20px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">选择参与者 <span id="uc-selected-count" style="color:#E88FAC;">(需选择 ' + (defaultCount - 1) + ' 人)</span></div>';
        html += '<div id="uc-ai-list" style="max-height:180px;overflow-y:auto;">';
        
        group.members.forEach(function(memberId, index) {
            var ai = PhoneCore.getAI(memberId);
            if (!ai) return;
            
            var isSelected = index < defaultCount - 1;
            html += '<label class="uc-ai-checkbox" style="display:flex;align-items:center;padding:8px 10px;background:' + (isSelected ? 'rgba(232,143,172,0.15)' : 'white') + ';border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all 0.2s;border:1px solid ' + (isSelected ? '#FFB3C6' : '#E9ECEF') + ';">';
            html += '<input type="checkbox" name="uc-ai-player" value="' + memberId + '" ' + (isSelected ? 'checked' : '') + ' style="display:none;">';
            html += '<div style="width:30px;height:30px;border-radius:50%;background:' + self.getAvatarColor(memberId) + ';margin-right:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += ai.name.charAt(0);
            }
            html += '</div>';
            html += '<div style="flex:1;color:#C76B8F;font-size:12px;">' + ai.name + '</div>';
            html += '<div class="uc-check-icon" style="width:18px;height:18px;border-radius:50%;background:' + (isSelected ? '#E88FAC' : '#E9ECEF') + ';display:flex;align-items:center;justify-content:center;">';
            html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="white" style="opacity:' + (isSelected ? '1' : '0') + ';"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
            html += '</div>';
            html += '</label>';
        });
        
        html += '</div>';
        html += '</div>';
        
        // 开始游戏按钮
        html += '<button id="start-undercover-btn" style="width:100%;padding:12px;background:linear-gradient(135deg,#E88FAC,#C76B8F);border:none;border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(232,143,172,0.3);">';
        html += '开始游戏';
        html += '</button>';
        
        html += '</div>';
        
        var setupPage = this.openDetailPage(html, { title: '游戏设置', titleColor: '#C76B8F', bgColor: '#FFF5F7' });
        
        var selectedPlayerCount = defaultCount;
        var selectedWordType = 'word';
        var isGodMode = false;
        
        // 人数选择
        setupPage.querySelectorAll('.player-count-btn').forEach(function(btn) {
            btn.onclick = function() {
                setupPage.querySelectorAll('.player-count-btn').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.background = 'white';
                    b.style.borderColor = '#FFD6E0';
                    b.style.color = '#C76B8F';
                });
                btn.classList.add('active');
                btn.style.background = '#E88FAC';
                btn.style.borderColor = '#FFB3C6';
                btn.style.color = 'white';
                
                selectedPlayerCount = parseInt(btn.getAttribute('data-count'));
                var undercoverCount = selectedPlayerCount <= 4 ? 1 : (selectedPlayerCount <= 7 ? 1 : 2);
                setupPage.querySelector('#player-count-desc').textContent = selectedPlayerCount + '人局: ' + undercoverCount + '名卧底，' + (selectedPlayerCount - undercoverCount) + '名平民';
                setupPage.querySelector('#uc-selected-count').textContent = '(需选择 ' + (selectedPlayerCount - (isGodMode ? 0 : 1)) + ' 人)';
                
                updateUCAISelection();
            };
        });
        
        // 词语类型选择
        setupPage.querySelectorAll('.word-type-btn').forEach(function(btn) {
            btn.onclick = function() {
                setupPage.querySelectorAll('.word-type-btn').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.background = 'white';
                    b.style.borderColor = '#FFD6E0';
                    b.style.color = '#C76B8F';
                });
                btn.classList.add('active');
                btn.style.background = '#E88FAC';
                btn.style.borderColor = '#FFB3C6';
                btn.style.color = 'white';
                
                selectedWordType = btn.getAttribute('data-type');
                var typeInfo = wordTypes.find(function(t) { return t.id === selectedWordType; });
                if (typeInfo) {
                    setupPage.querySelector('#word-type-desc').textContent = typeInfo.name + ': ' + typeInfo.desc;
                }
            };
        });
        
        // 模式切换
        var playerModeBtn = setupPage.querySelector('#uc-mode-player');
        var godModeBtn = setupPage.querySelector('#uc-mode-god');
        
        playerModeBtn.onclick = function() {
            isGodMode = false;
            playerModeBtn.classList.add('active');
            playerModeBtn.style.background = '#E88FAC';
            playerModeBtn.style.borderColor = '#FFB3C6';
            playerModeBtn.style.color = 'white';
            godModeBtn.classList.remove('active');
            godModeBtn.style.background = 'white';
            godModeBtn.style.borderColor = '#FFD6E0';
            godModeBtn.style.color = '#C76B8F';
            setupPage.querySelector('#uc-selected-count').textContent = '(需选择 ' + (selectedPlayerCount - 1) + ' 人)';
            updateUCAISelection();
        };
        
        godModeBtn.onclick = function() {
            isGodMode = true;
            godModeBtn.classList.add('active');
            godModeBtn.style.background = '#E88FAC';
            godModeBtn.style.borderColor = '#FFB3C6';
            godModeBtn.style.color = 'white';
            playerModeBtn.classList.remove('active');
            playerModeBtn.style.background = 'white';
            playerModeBtn.style.borderColor = '#FFD6E0';
            playerModeBtn.style.color = '#C76B8F';
            setupPage.querySelector('#uc-selected-count').textContent = '(需选择 ' + selectedPlayerCount + ' 人)';
            updateUCAISelection();
        };
        
        // AI选择
        function updateUCAISelection() {
            var requiredCount = selectedPlayerCount - (isGodMode ? 0 : 1);
            var checkboxes = setupPage.querySelectorAll('input[name="uc-ai-player"]');
            
            checkboxes.forEach(function(cb, index) {
                var label = cb.closest('.uc-ai-checkbox');
                if (index < requiredCount) {
                    cb.checked = true;
                    label.style.background = 'rgba(232,143,172,0.15)';
                    label.style.borderColor = '#FFB3C6';
                    label.querySelector('.uc-check-icon').style.background = '#E88FAC';
                    label.querySelector('svg').style.opacity = '1';
                } else {
                    cb.checked = false;
                    label.style.background = 'white';
                    label.style.borderColor = '#E9ECEF';
                    label.querySelector('.uc-check-icon').style.background = '#E9ECEF';
                    label.querySelector('svg').style.opacity = '0';
                }
            });
        }
        
        setupPage.querySelectorAll('.uc-ai-checkbox').forEach(function(label) {
            label.onclick = function(e) {
                e.preventDefault();
                var checkbox = label.querySelector('input');
                var requiredCount = selectedPlayerCount - (isGodMode ? 0 : 1);
                var currentChecked = setupPage.querySelectorAll('input[name="uc-ai-player"]:checked').length;
                
                if (checkbox.checked) {
                    checkbox.checked = false;
                    label.style.background = 'white';
                    label.style.borderColor = '#E9ECEF';
                    label.querySelector('.uc-check-icon').style.background = '#E9ECEF';
                    label.querySelector('svg').style.opacity = '0';
                } else if (currentChecked < requiredCount) {
                    checkbox.checked = true;
                    label.style.background = 'rgba(232,143,172,0.15)';
                    label.style.borderColor = '#FFB3C6';
                    label.querySelector('.uc-check-icon').style.background = '#E88FAC';
                    label.querySelector('svg').style.opacity = '1';
                }
            };
        });
        
        // 开始游戏
        setupPage.querySelector('#start-undercover-btn').onclick = function() {
            var selectedAIs = [];
            setupPage.querySelectorAll('input[name="uc-ai-player"]:checked').forEach(function(cb) {
                selectedAIs.push(cb.value);
            });
            
            var requiredCount = selectedPlayerCount - (isGodMode ? 0 : 1);
            if (selectedAIs.length !== requiredCount) {
                PhoneCore.notifications.send({
                    type: 'warning',
                    title: '人数不符',
                    message: '请选择 ' + requiredCount + ' 名AI参与游戏',
                    size: 'mini'
                });
                return;
            }
            
            var apiSelect = setupPage.querySelector('#undercover-api-select');
            var selectedApiConfig = apiSelect ? apiSelect.value : null;
            
            if (!selectedApiConfig) {
                PhoneCore.notifications.send({
                    type: 'warning',
                    title: '请配置API',
                    message: '需要API来生成游戏词语',
                    size: 'mini'
                });
                return;
            }
            
            setupPage.querySelector('.app-back-btn').click();
            setTimeout(function() {
                self.startUndercoverGame(groupId, selectedPlayerCount, selectedAIs, selectedWordType, isGodMode, selectedApiConfig);
            }, 350);
        };
    };
    
    // 开始谁是卧底游戏
    ChatApp.prototype.startUndercoverGame = function(groupId, playerCount, selectedAIs, wordType, isGodMode, apiConfigId) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        // 显示加载中 - 添加到手机屏幕内而非document.body
        var loadingHtml = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,245,247,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;">';
        loadingHtml += '<div style="width:60px;height:60px;border:3px solid #FFD6E0;border-top-color:#E88FAC;border-radius:50%;animation:ucSpin 1s linear infinite;"></div>';
        loadingHtml += '<div style="margin-top:20px;color:#C76B8F;font-size:14px;font-weight:500;">AI正在生成词语...</div>';
        loadingHtml += '<div style="margin-top:8px;color:#E88FAC;font-size:12px;">请稍候</div>';
        loadingHtml += '<style>@keyframes ucSpin { to { transform: rotate(360deg); } }</style>';
        loadingHtml += '</div>';
        
        var loadingEl = document.createElement('div');
        loadingEl.innerHTML = loadingHtml;
        loadingEl = loadingEl.firstChild;
        var phoneScreen = this.appWindow || document.getElementById('phone-screen');
        if (phoneScreen) {
            phoneScreen.appendChild(loadingEl);
        } else {
            document.body.appendChild(loadingEl);
        }
        
        // 调用AI生成词语对
        this.generateUndercoverWords(wordType, apiConfigId).then(function(wordPair) {
            loadingEl.remove();
            
            if (!wordPair || !wordPair.civilian || !wordPair.undercover) {
                PhoneCore.notifications.send({
                    type: 'error',
                    title: '生成失败',
                    message: '无法生成词语，请重试',
                    size: 'mini'
                });
                return;
            }
            
            // 初始化游戏状态
            var undercoverCount = playerCount <= 4 ? 1 : (playerCount <= 7 ? 1 : 2);
            
            self.undercoverGame = {
                id: 'ucgame_' + Date.now(),
                groupId: groupId,
                type: 'undercover',
                playerCount: playerCount,
                wordType: wordType,
                wordPair: wordPair,
                isGodMode: isGodMode,
                apiConfigId: apiConfigId,
                undercoverCount: undercoverCount,
                players: [],
                alivePlayers: [],
                eliminatedPlayers: [],
                round: 0,
                phase: 'describe', // describe, vote, review, ended
                currentSpeaker: 0,
                gameLog: [],
                chatHistory: [],
                startTime: Date.now()
            };
            
            // 分配角色
            var roles = [];
            for (var i = 0; i < undercoverCount; i++) {
                roles.push('undercover');
            }
            for (var i = undercoverCount; i < playerCount; i++) {
                roles.push('civilian');
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
            
            // 用户玩家
            if (!isGodMode) {
                var userRole = roles[playerIndex];
                self.undercoverGame.players.push({
                    id: 'user',
                    name: PhoneCore.user.name || '我',
                    isUser: true,
                    role: userRole,
                    word: userRole === 'undercover' ? wordPair.undercover : wordPair.civilian,
                    isAlive: true,
                    seatNumber: playerIndex + 1
                });
                playerIndex++;
            }
            
            // AI玩家
            selectedAIs.forEach(function(aiId) {
                var ai = PhoneCore.getAI(aiId);
                if (ai) {
                    var aiRole = roles[playerIndex];
                    self.undercoverGame.players.push({
                        id: aiId,
                        name: ai.name,
                        isUser: false,
                        role: aiRole,
                        word: aiRole === 'undercover' ? wordPair.undercover : wordPair.civilian,
                        isAlive: true,
                        seatNumber: playerIndex + 1,
                        personality: ai.personality || ''
                    });
                    playerIndex++;
                }
            });
            
            // 设置存活玩家
            self.undercoverGame.alivePlayers = self.undercoverGame.players.map(function(p) { return p.id; });
            
            // 打开游戏界面
            self.openUndercoverGamePage(groupId);
            
            // 开始第一轮
            self.startUndercoverRound();
            
        }).catch(function(err) {
            loadingEl.remove();
            console.error('生成词语失败:', err);
            PhoneCore.notifications.send({
                type: 'error',
                title: '生成失败',
                message: '无法生成词语: ' + (err.message || '请重试'),
                size: 'mini'
            });
        });
    };
    
    // 生成谁是卧底词语对（处理Gemini无用户信息问题）
    ChatApp.prototype.generateUndercoverWords = function(wordType, apiConfigId) {
        var self = this;
        
        var typePrompts = {
            'word': '请生成一对相似但有区别的常见词语（如：苹果/梨子、足球/篮球、猫/狗）',
            'idiom': '请生成一对意思相近但有微妙区别的四字成语',
            'poetry': '请生成一对来自不同诗人但意境相似的诗句（每句7-10字）',
            'movie': '请生成一对同类型但不同的知名电影或电视剧名称',
            'food': '请生成一对相似但不同的食物名称（如：包子/饺子、可乐/雪碧）'
        };
        
        var prompt = typePrompts[wordType] || typePrompts['word'];
        
        // 构建完整的系统提示（不依赖用户信息，避免Gemini问题）
        var systemPrompt = '你是一个谁是卧底游戏的词语生成器。' + prompt + '。要求：1.两个词语要有关联性，能让玩家描述时产生误导 2.难度适中，大部分人都能理解 3.只返回JSON格式，不要其他内容。返回格式：{"civilian":"平民词语","undercover":"卧底词语"}';
        
        return new Promise(function(resolve, reject) {
            if (!PhoneCore.api || !apiConfigId) {
                reject(new Error('未配置API'));
                return;
            }
            
            // 使用简单的用户消息，不包含角色历史（避免Gemini需要用户信息的问题）
            var messages = [
                { role: 'user', content: '请生成一对谁是卧底游戏的词语，直接返回JSON。' }
            ];
            
            PhoneCore.api.call(systemPrompt, apiConfigId, {
                messages: messages,
                maxTokens: 500,
                temperature: 0.9
            }).then(function(response) {
                var content = (response.content || '').trim();
                
                // 尝试解析JSON
                try {
                    // 清理可能的markdown标记
                    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    
                    var wordPair = JSON.parse(content);
                    if (wordPair.civilian && wordPair.undercover) {
                        resolve(wordPair);
                    } else {
                        reject(new Error('词语格式错误'));
                    }
                } catch (e) {
                    // 尝试从文本中提取
                    var civilianMatch = content.match(/平民[词语]*[：:]\s*["""']?([^"""'\n,，]+)/);
                    var undercoverMatch = content.match(/卧底[词语]*[：:]\s*["""']?([^"""'\n,，]+)/);
                    
                    if (civilianMatch && undercoverMatch) {
                        resolve({
                            civilian: civilianMatch[1].trim(),
                            undercover: undercoverMatch[1].trim()
                        });
                    } else {
                        // 使用备用词库
                        var backupWords = self.getBackupUndercoverWords(wordType);
                        resolve(backupWords);
                    }
                }
            }).catch(function(err) {
                console.error('AI生成词语失败:', err);
                // 使用备用词库
                var backupWords = self.getBackupUndercoverWords(wordType);
                resolve(backupWords);
            });
        });
    };
    
    // 备用词库
    ChatApp.prototype.getBackupUndercoverWords = function(wordType) {
        var wordPairs = {
            'word': [
                { civilian: '苹果', undercover: '梨子' },
                { civilian: '猫', undercover: '狗' },
                { civilian: '足球', undercover: '篮球' },
                { civilian: '雨伞', undercover: '阳伞' },
                { civilian: '咖啡', undercover: '奶茶' },
                { civilian: '地铁', undercover: '公交车' },
                { civilian: '手机', undercover: '平板' },
                { civilian: '眼镜', undercover: '墨镜' }
            ],
            'idiom': [
                { civilian: '画蛇添足', undercover: '多此一举' },
                { civilian: '对牛弹琴', undercover: '鸡同鸭讲' },
                { civilian: '守株待兔', undercover: '坐享其成' },
                { civilian: '杯弓蛇影', undercover: '草木皆兵' }
            ],
            'poetry': [
                { civilian: '床前明月光', undercover: '举头望明月' },
                { civilian: '春眠不觉晓', undercover: '夜来风雨声' },
                { civilian: '白日依山尽', undercover: '黄河入海流' }
            ],
            'movie': [
                { civilian: '哈利波特', undercover: '指环王' },
                { civilian: '复仇者联盟', undercover: '正义联盟' },
                { civilian: '泰坦尼克号', undercover: '海上钢琴师' }
            ],
            'food': [
                { civilian: '包子', undercover: '饺子' },
                { civilian: '可乐', undercover: '雪碧' },
                { civilian: '面包', undercover: '蛋糕' },
                { civilian: '火锅', undercover: '麻辣烫' }
            ]
        };
        
        var pairs = wordPairs[wordType] || wordPairs['word'];
        return pairs[Math.floor(Math.random() * pairs.length)];
    };
    
    // 打开谁是卧底游戏页面
    ChatApp.prototype.openUndercoverGamePage = function(groupId) {
        var self = this;
        var game = this.undercoverGame;
        if (!game) return;
        
        var html = '<div style="display:flex;flex-direction:column;height:100%;background:linear-gradient(180deg,#FFF5F7 0%,#FFF0F3 100%);">';
        
        // 顶部状态栏（整合返回按钮）
        html += '<div style="padding:10px 12px;background:linear-gradient(135deg,#FFE8F0,#FFD6E8);border-bottom:1px solid #FFD6E0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        // 左侧：返回按钮 + 标题
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<button id="uc-back-btn" style="padding:4px 8px;background:rgba(199,107,143,0.15);border:none;border-radius:6px;color:#C76B8F;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:2px;">';
        html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C76B8F" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';
        html += '返回';
        html += '</button>';
        html += '<div>';
        html += '<div style="font-size:13px;font-weight:600;color:#C76B8F;">谁是卧底</div>';
        html += '<div id="uc-game-status" style="font-size:10px;color:#E88FAC;margin-top:1px;">第 <span id="uc-round">1</span> 轮 - <span id="uc-phase">描述阶段</span></div>';
        html += '</div>';
        html += '</div>';
        // 右侧：存活人数
        html += '<div style="text-align:right;">';
        html += '<div id="uc-alive-count" style="font-size:11px;color:#C76B8F;">存活 ' + game.alivePlayers.length + '/' + game.players.length + ' 人</div>';
        html += '</div>';
        html += '</div>';
        
        // 玩家词语显示（如果是玩家模式）
        if (!game.isGodMode) {
            var userPlayer = game.players.find(function(p) { return p.isUser; });
            if (userPlayer) {
                html += '<div style="margin-top:10px;padding:10px 14px;background:white;border-radius:10px;border:1px solid #FFD6E0;">';
                html += '<div style="font-size:10px;color:#E88FAC;margin-bottom:4px;">你的词语</div>';
                html += '<div style="font-size:16px;font-weight:600;color:#C76B8F;">' + userPlayer.word + '</div>';
                html += '</div>';
            }
        } else {
            // 上帝模式显示两个词语
            html += '<div style="margin-top:10px;display:flex;gap:8px;">';
            html += '<div style="flex:1;padding:10px;background:white;border-radius:10px;border:1px solid #FFD6E0;text-align:center;">';
            html += '<div style="font-size:10px;color:#4a9a6a;margin-bottom:4px;">平民词语</div>';
            html += '<div style="font-size:14px;font-weight:600;color:#4a9a6a;">' + game.wordPair.civilian + '</div>';
            html += '</div>';
            html += '<div style="flex:1;padding:10px;background:white;border-radius:10px;border:1px solid #FFD6E0;text-align:center;">';
            html += '<div style="font-size:10px;color:#c85a5a;margin-bottom:4px;">卧底词语</div>';
            html += '<div style="font-size:14px;font-weight:600;color:#c85a5a;">' + game.wordPair.undercover + '</div>';
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
        
        // 玩家列表
        html += '<div id="uc-player-bar" style="padding:10px 16px;background:white;border-bottom:1px solid #FFE8F0;overflow-x:auto;white-space:nowrap;">';
        html += this.renderUndercoverPlayerBar();
        html += '</div>';
        
        // 消息区域
        html += '<div id="uc-messages" style="flex:1;overflow-y:auto;padding:16px;">';
        html += this.renderUndercoverMessages();
        html += '</div>';
        
        // 输入区域
        html += '<div id="uc-input-area" style="padding:12px 16px;background:white;border-top:1px solid #FFE8F0;">';
        html += this.renderUndercoverInputArea();
        html += '</div>';
        
        html += '</div>';
        
        var gamePage = this.openDetailPage(html, {
            title: '谁是卧底',
            titleColor: '#C76B8F',
            bgColor: '#FFF5F7',
            onBack: function() {
                if (game.phase !== 'ended' && game.phase !== 'review') {
                    if (!confirm('游戏进行中，确定要退出吗？将保存当前进度为游戏记录。')) {
                        return false;
                    }
                    // 中途退出，标记游戏结束并保存
                    game.endTime = Date.now();
                    game.winner = game.winner || 'none';
                    self.saveUndercoverRecordAndExit();
                    return true;
                }
                // 游戏已结束或复盘中，保存记录
                if (game.phase === 'ended' || game.phase === 'review') {
                    self.saveUndercoverRecordAndExit();
                }
                self.undercoverGame = null;
                self.undercoverGamePage = null;
                return true;
            }
        });
        
        // 隐藏默认返回按钮
        var defaultBackBtn = gamePage.querySelector('.app-back-btn');
        if (defaultBackBtn) {
            defaultBackBtn.style.display = 'none';
        }
        
        // 绑定自定义返回按钮
        var customBackBtn = gamePage.querySelector('#uc-back-btn');
        if (customBackBtn) {
            customBackBtn.onclick = function() {
                defaultBackBtn.click(); // 触发原有的返回逻辑
            };
        }
        
        this.undercoverGamePage = gamePage;
        this.bindUndercoverGameEvents(gamePage);
    };
    
    // 渲染玩家条
    ChatApp.prototype.renderUndercoverPlayerBar = function() {
        var self = this;
        var game = this.undercoverGame;
        if (!game) return '';
        
        var html = '<div style="display:flex;gap:10px;">';
        
        game.players.forEach(function(player) {
            var isAlive = game.alivePlayers.indexOf(player.id) !== -1;
            var isCurrent = game.phase === 'describe' && game.alivePlayers[game.currentSpeaker] === player.id;
            var bgColor = !isAlive ? '#E8E8E8' : (isCurrent ? '#FFE8F0' : 'white');
            var borderColor = isCurrent ? '#E88FAC' : '#FFD6E0';
            
            html += '<div class="uc-player-item" data-player-id="' + player.id + '" style="display:flex;flex-direction:column;align-items:center;padding:8px;background:' + bgColor + ';border-radius:10px;border:2px solid ' + borderColor + ';min-width:50px;opacity:' + (isAlive ? '1' : '0.5') + ';transition:all 0.3s;">';
            
            // 头像
            var avatarBg = player.isUser ? '#E88FAC' : self.getAvatarColor(player.id);
            html += '<div style="width:36px;height:36px;border-radius:50%;background:' + avatarBg + ';display:flex;align-items:center;justify-content:center;color:white;font-size:14px;overflow:hidden;position:relative;">';
            
            if (!player.isUser) {
                var ai = PhoneCore.getAI(player.id);
                if (ai && ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += player.name.charAt(0);
                }
            } else {
                if (PhoneCore.user.avatar) {
                    html += '<img src="' + PhoneCore.user.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += player.name.charAt(0);
                }
            }
            
            // 淘汰标记
            if (!isAlive) {
                html += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">';
                html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
                html += '</div>';
            }
            
            html += '</div>';
            
            // 名字
            html += '<div style="font-size:10px;color:' + (isAlive ? '#C76B8F' : '#999') + ';margin-top:4px;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + player.name + '</div>';
            
            // 游戏结束后显示身份
            if (game.phase === 'ended' || game.phase === 'review') {
                var roleColor = player.role === 'undercover' ? '#c85a5a' : '#4a9a6a';
                var roleText = player.role === 'undercover' ? '卧底' : '平民';
                html += '<div style="font-size:9px;color:' + roleColor + ';font-weight:600;margin-top:2px;">' + roleText + '</div>';
            }
            
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    };
    
    // 渲染消息区域
    ChatApp.prototype.renderUndercoverMessages = function() {
        var game = this.undercoverGame;
        if (!game) return '';
        
        var html = '';
        
        game.chatHistory.forEach(function(msg) {
            if (msg.type === 'system') {
                html += '<div style="text-align:center;padding:8px 0;">';
                html += '<span style="display:inline-block;padding:5px 14px;background:rgba(232,143,172,0.15);border-radius:20px;font-size:11px;color:#E88FAC;">' + msg.content + '</span>';
                html += '</div>';
            } else if (msg.type === 'phase') {
                html += '<div style="text-align:center;padding:10px 0;">';
                html += '<span style="display:inline-block;padding:6px 16px;background:linear-gradient(135deg,#FFE8F0,#FFD6E8);border-radius:20px;font-size:12px;color:#C76B8F;font-weight:500;">' + msg.content + '</span>';
                html += '</div>';
            } else if (msg.type === 'describe' || msg.type === 'review_chat') {
                var isUser = msg.playerId === 'user';
                html += '<div style="display:flex;gap:8px;margin:8px 0;' + (isUser ? 'flex-direction:row-reverse;' : '') + '">';
                html += '<div style="max-width:75%;">';
                html += '<div style="font-size:10px;color:#E88FAC;margin-bottom:3px;' + (isUser ? 'text-align:right;' : '') + '">' + (msg.playerName || '未知') + '</div>';
                html += '<div style="padding:10px 14px;background:' + (isUser ? 'linear-gradient(135deg,#E88FAC,#C76B8F)' : 'white') + ';border:1px solid ' + (isUser ? 'transparent' : '#FFD6E0') + ';border-radius:14px;color:' + (isUser ? 'white' : '#333') + ';font-size:13px;line-height:1.5;">' + msg.content + '</div>';
                html += '</div>';
                html += '</div>';
            } else if (msg.type === 'discuss') {
                // 讨论阶段消息 - 使用不同的样式区分
                var isUser = msg.playerId === 'user';
                html += '<div style="display:flex;gap:8px;margin:8px 0;' + (isUser ? 'flex-direction:row-reverse;' : '') + '">';
                html += '<div style="max-width:75%;">';
                html += '<div style="font-size:10px;color:#9B7AA0;margin-bottom:3px;' + (isUser ? 'text-align:right;' : '') + '">' + (msg.playerName || '未知') + ' <span style="color:#C9A0DC;font-size:9px;">[讨论]</span></div>';
                html += '<div style="padding:10px 14px;background:' + (isUser ? 'linear-gradient(135deg,#C9A0DC,#9B7AA0)' : '#F8F0FF') + ';border:1px solid ' + (isUser ? 'transparent' : '#E8D6F0') + ';border-radius:14px;color:' + (isUser ? 'white' : '#333') + ';font-size:13px;line-height:1.5;">' + msg.content + '</div>';
                html += '</div>';
                html += '</div>';
            } else if (msg.type === 'vote_result') {
                html += '<div style="text-align:center;padding:12px 0;">';
                html += '<div style="display:inline-block;padding:12px 20px;background:white;border:1px solid #FFD6E0;border-radius:12px;">';
                html += '<div style="font-size:11px;color:#E88FAC;margin-bottom:6px;">投票结果</div>';
                html += '<div style="font-size:14px;color:#C76B8F;font-weight:600;">' + msg.content + '</div>';
                html += '</div>';
                html += '</div>';
            }
        });
        
        return html;
    };
    
    // 渲染输入区域
    ChatApp.prototype.renderUndercoverInputArea = function() {
        var game = this.undercoverGame;
        if (!game) return '';
        
        var html = '';
        
        if (game.phase === 'describe') {
            // 描述阶段
            var currentPlayerId = game.alivePlayers[game.currentSpeaker];
            var currentPlayer = game.players.find(function(p) { return p.id === currentPlayerId; });
            
            if (currentPlayer && currentPlayer.isUser) {
                html += '<div style="display:flex;gap:10px;align-items:flex-end;">';
                html += '<input type="text" id="uc-describe-input" placeholder="用一句话描述你的词语..." style="flex:1;padding:12px 16px;border:1px solid #FFD6E0;border-radius:20px;font-size:13px;outline:none;background:#FFF5F7;">';
                html += '<button id="uc-describe-btn" style="padding:12px 20px;background:linear-gradient(135deg,#E88FAC,#C76B8F);border:none;border-radius:20px;color:white;font-size:13px;font-weight:500;cursor:pointer;">发送</button>';
                html += '</div>';
                html += '<div style="margin-top:4px;font-size:10px;color:#E88FAC;text-align:center;">描述回合只能说一句话哦</div>';
            } else {
                html += '<div style="text-align:center;padding:10px;color:#E88FAC;font-size:12px;">';
                html += (currentPlayer ? currentPlayer.name : '玩家') + ' 正在描述中...';
                html += '</div>';
            }
        } else if (game.phase === 'discuss') {
            // 讨论阶段
            if (!game.isGodMode) {
                var userPlayer = game.players.find(function(p) { return p.isUser; });
                if (userPlayer && game.alivePlayers.indexOf(userPlayer.id) !== -1) {
                    html += '<div style="display:flex;gap:10px;align-items:flex-end;">';
                    html += '<input type="text" id="uc-discuss-input" placeholder="自由讨论，分析谁是卧底..." style="flex:1;padding:12px 16px;border:1px solid #FFD6E0;border-radius:20px;font-size:13px;outline:none;background:#FFF5F7;">';
                    html += '<button id="uc-discuss-btn" style="padding:12px 16px;background:linear-gradient(135deg,#E88FAC,#C76B8F);border:none;border-radius:20px;color:white;font-size:12px;font-weight:500;cursor:pointer;">发送</button>';
                    html += '</div>';
                    html += '<div style="margin-top:6px;font-size:10px;color:#E88FAC;text-align:center;">点击发送可连续发多条 | 长按发送让AI一并回复</div>';
                    html += '<div style="margin-top:10px;text-align:center;">';
                    html += '<button id="uc-start-vote-btn" style="padding:10px 24px;background:white;border:1px solid #FFD6E0;border-radius:20px;color:#C76B8F;font-size:12px;cursor:pointer;transition:all 0.2s;">进入投票</button>';
                    html += '</div>';
                } else {
                    html += '<div style="text-align:center;padding:10px;color:#999;font-size:12px;">你已出局，等待其他玩家讨论</div>';
                    html += '<div style="margin-top:10px;text-align:center;">';
                    html += '<button id="uc-start-vote-btn" style="padding:10px 24px;background:white;border:1px solid #FFD6E0;border-radius:20px;color:#C76B8F;font-size:12px;cursor:pointer;">进入投票</button>';
                    html += '</div>';
                }
            } else {
                html += '<div style="text-align:center;padding:10px;color:#E88FAC;font-size:12px;">讨论阶段 - 上帝视角观战中</div>';
                html += '<div style="margin-top:10px;text-align:center;">';
                html += '<button id="uc-start-vote-btn" style="padding:10px 24px;background:white;border:1px solid #FFD6E0;border-radius:20px;color:#C76B8F;font-size:12px;cursor:pointer;">进入投票</button>';
                html += '</div>';
            }
        } else if (game.phase === 'vote') {
            // 投票阶段
            if (!game.isGodMode) {
                var userPlayer = game.players.find(function(p) { return p.isUser; });
                if (userPlayer && game.alivePlayers.indexOf(userPlayer.id) !== -1) {
                    html += '<div style="font-size:11px;color:#E88FAC;margin-bottom:8px;text-align:center;">选择你认为是卧底的玩家</div>';
                    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
                    
                    game.alivePlayers.forEach(function(playerId) {
                        if (playerId === 'user') return; // 不能投自己
                        var player = game.players.find(function(p) { return p.id === playerId; });
                        if (player) {
                            html += '<button class="uc-vote-btn" data-player-id="' + playerId + '" style="padding:10px 16px;background:white;border:1px solid #FFD6E0;border-radius:10px;color:#C76B8F;font-size:12px;cursor:pointer;transition:all 0.2s;">';
                            html += player.name;
                            html += '</button>';
                        }
                    });
                    
                    html += '</div>';
                } else {
                    html += '<div style="text-align:center;padding:10px;color:#999;font-size:12px;">你已出局，等待其他玩家投票</div>';
                }
            } else {
                html += '<div style="text-align:center;padding:10px;color:#E88FAC;font-size:12px;">AI玩家正在投票...</div>';
            }
        } else if (game.phase === 'review') {
            // 复盘阶段 - 真实聊天
            html += '<div style="display:flex;gap:10px;align-items:flex-end;">';
            html += '<input type="text" id="uc-review-input" placeholder="复盘讨论，随便聊聊..." style="flex:1;padding:12px 16px;border:1px solid #FFD6E0;border-radius:20px;font-size:13px;outline:none;background:#FFF5F7;">';
            html += '<button id="uc-review-send-btn" style="padding:12px 20px;background:linear-gradient(135deg,#E88FAC,#C76B8F);border:none;border-radius:20px;color:white;font-size:13px;font-weight:500;cursor:pointer;">发送</button>';
            html += '</div>';
            html += '<div style="margin-top:10px;text-align:center;">';
            html += '<button id="uc-end-game-btn" style="padding:10px 24px;background:white;border:1px solid #FFD6E0;border-radius:20px;color:#C76B8F;font-size:12px;cursor:pointer;">结束游戏</button>';
            html += '</div>';
        } else if (game.phase === 'ended') {
            html += '<div style="text-align:center;padding:10px;color:#C76B8F;font-size:13px;font-weight:500;">游戏已结束</div>';
        }
        
        return html;
    };
    
    // 绑定游戏事件
    ChatApp.prototype.bindUndercoverGameEvents = function(page) {
        var self = this;
        var game = this.undercoverGame;
        if (!game) return;
        
        // 描述按钮
        var describeBtn = page.querySelector('#uc-describe-btn');
        var describeInput = page.querySelector('#uc-describe-input');
        
        if (describeBtn && describeInput) {
            describeBtn.onclick = function() {
                var content = describeInput.value.trim();
                if (!content) return;
                
                self.submitUndercoverDescription('user', content);
                describeInput.value = '';
            };
            
            describeInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    describeBtn.click();
                }
            };
        }
        
        // 讨论阶段按钮
        var discussBtn = page.querySelector('#uc-discuss-btn');
        var discussInput = page.querySelector('#uc-discuss-input');
        var startVoteBtn = page.querySelector('#uc-start-vote-btn');
        
        if (discussBtn && discussInput) {
            var longPressTimer = null;
            var isLongPress = false;
            
            // 普通点击发送（不触发AI）
            discussBtn.onclick = function(e) {
                if (isLongPress) {
                    isLongPress = false;
                    return;
                }
                var content = discussInput.value.trim();
                if (!content) return;
                
                self.sendUndercoverDiscussMessage('user', content, false);
                discussInput.value = '';
            };
            
            // 长按发送（触发AI回复）
            discussBtn.onmousedown = discussBtn.ontouchstart = function(e) {
                e.preventDefault();
                isLongPress = false;
                longPressTimer = setTimeout(function() {
                    isLongPress = true;
                    var content = discussInput.value.trim();
                    if (!content) return;
                    
                    // 按钮反馈
                    discussBtn.style.transform = 'scale(0.95)';
                    discussBtn.textContent = 'AI回复中...';
                    
                    self.sendUndercoverDiscussMessage('user', content, true);
                    discussInput.value = '';
                    
                    setTimeout(function() {
                        discussBtn.style.transform = '';
                        discussBtn.textContent = '发送';
                    }, 500);
                }, 500);
            };
            
            discussBtn.onmouseup = discussBtn.ontouchend = discussBtn.onmouseleave = function() {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };
            
            discussInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    discussBtn.click();
                }
            };
        }
        
        // 进入投票按钮
        if (startVoteBtn) {
            startVoteBtn.onclick = function() {
                self.startUndercoverVoting();
            };
        }
        
        // 投票按钮
        page.querySelectorAll('.uc-vote-btn').forEach(function(btn) {
            btn.onclick = function() {
                var targetId = btn.getAttribute('data-player-id');
                self.submitUndercoverVote('user', targetId);
            };
        });
        
        // 复盘聊天
        var reviewSendBtn = page.querySelector('#uc-review-send-btn');
        var reviewInput = page.querySelector('#uc-review-input');
        
        if (reviewSendBtn && reviewInput) {
            reviewSendBtn.onclick = function() {
                var content = reviewInput.value.trim();
                if (!content) return;
                
                self.sendUndercoverReviewMessage('user', content);
                reviewInput.value = '';
            };
            
            reviewInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    reviewSendBtn.click();
                }
            };
        }
        
        // 结束游戏按钮
        var endGameBtn = page.querySelector('#uc-end-game-btn');
        if (endGameBtn) {
            endGameBtn.onclick = function() {
                self.finishUndercoverGame();
            };
        }
    };
    
    // 开始新一轮
    ChatApp.prototype.startUndercoverRound = function() {
        var game = this.undercoverGame;
        if (!game) return;
        
        game.round++;
        game.phase = 'describe';
        game.currentSpeaker = 0;
        game.roundVotes = {};
        
        // 添加轮次消息
        this.addUndercoverMessage({
            type: 'phase',
            content: '第 ' + game.round + ' 轮开始 - 描述阶段'
        });
        
        this.updateUndercoverUI();
        
        // 如果第一个发言的是AI，开始AI发言
        var firstPlayerId = game.alivePlayers[0];
        if (firstPlayerId !== 'user') {
            this.generateAIUndercoverDescription(firstPlayerId);
        }
    };
    
    // 提交描述
    ChatApp.prototype.submitUndercoverDescription = function(playerId, content) {
        var game = this.undercoverGame;
        if (!game || game.phase !== 'describe') return;
        
        var player = game.players.find(function(p) { return p.id === playerId; });
        if (!player) return;
        
        // 添加描述消息
        this.addUndercoverMessage({
            type: 'describe',
            playerId: playerId,
            playerName: player.name,
            content: content
        });
        
        // 记录到游戏日志
        game.gameLog.push({
            round: game.round,
            type: 'describe',
            playerId: playerId,
            playerName: player.name,
            content: content
        });
        
        // 移到下一个发言者
        game.currentSpeaker++;
        
        if (game.currentSpeaker >= game.alivePlayers.length) {
            // 所有人发言完毕，进入讨论阶段
            this.startUndercoverDiscussion();
        } else {
            this.updateUndercoverUI();
            
            // 如果下一个是AI，生成AI描述
            var nextPlayerId = game.alivePlayers[game.currentSpeaker];
            if (nextPlayerId !== 'user') {
                var self = this;
                setTimeout(function() {
                    self.generateAIUndercoverDescription(nextPlayerId);
                }, 1000 + Math.random() * 1500);
            }
        }
    };
    
    // 生成AI描述
    ChatApp.prototype.generateAIUndercoverDescription = function(aiId) {
        var self = this;
        var game = this.undercoverGame;
        if (!game) return;
        
        var player = game.players.find(function(p) { return p.id === aiId; });
        if (!player) return;
        
        var ai = PhoneCore.getAI(aiId);
        
        // 获取之前的描述
        var previousDescriptions = game.chatHistory.filter(function(m) {
            return m.type === 'describe';
        }).map(function(m) {
            return m.playerName + ': ' + m.content;
        }).join('\n');
        
        // 获取所有玩家信息
        var playerList = game.players.map(function(p) {
            return p.name + '(座位' + p.seatNumber + ')';
        }).join('、');
        
        var systemPrompt = '你正在玩谁是卧底游戏。你的词语是"' + player.word + '"。';
        systemPrompt += '\n你是' + player.name + '，座位号' + player.seatNumber + '。';
        systemPrompt += '\n参与玩家：' + playerList;
        systemPrompt += '\n当前是第' + game.round + '轮描述阶段。';
        systemPrompt += '\n\n【重要规则】描述回合只能说一句话！用一句话描述你的词语，不能直接说出词语本身。要让队友理解但又不能太明显。';
        systemPrompt += '\n\n之前的描述：\n' + (previousDescriptions || '暂无');
        systemPrompt += '\n\n请直接给出你的一句话描述（10-30字），不要有任何前缀或解释，只说一句话！';
        
        if (ai && ai.personality) {
            systemPrompt += '\n\n你的性格：' + ai.personality;
        }
        
        // 让每个AI的请求更独特，加入随机因子和玩家信息
        var uniqueContext = '现在轮到' + player.name + '(座位' + player.seatNumber + ')描述词语"' + player.word + '"。';
        uniqueContext += '时间戳:' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        uniqueContext += '\n请用一句话描述你的词语，不要重复别人说过的话。';
        
        var messages = [
            { role: 'user', content: uniqueContext }
        ];
        
        PhoneCore.api.call(systemPrompt, game.apiConfigId, {
            messages: messages,
            maxTokens: 300,
            temperature: 0.9
        }).then(function(response) {
            var content = (response.content || '').trim();
            // 清理可能的前缀
            content = content.replace(/^我[：:]\s*/i, '');
            content = content.replace(/^描述[：:]\s*/i, '');
            content = content.replace(/^[""'「『]|[""'」』]$/g, ''); // 去掉引号
            content = content.substring(0, 100); // 描述回合严格限制长度
            
            if (content && content.length >= 2) {
                self.submitUndercoverDescription(aiId, content);
            } else {
                // API返回空内容时报错而不是使用预设
                console.error('AI描述内容为空:', aiId, response);
                // 重试一次
                self.retryAIUndercoverDescription(aiId, 1);
            }
        }).catch(function(err) {
            console.error('AI描述生成失败:', aiId, err);
            // 重试而不是使用预设
            self.retryAIUndercoverDescription(aiId, 1);
        });
    };
    
    // 重试AI描述
    ChatApp.prototype.retryAIUndercoverDescription = function(aiId, retryCount) {
        var self = this;
        var game = this.undercoverGame;
        if (!game || retryCount > 2) {
            // 重试次数用完，跳过这个玩家
            console.error('AI描述重试失败，跳过:', aiId);
            var player = game.players.find(function(p) { return p.id === aiId; });
            if (player) {
                self.addUndercoverMessage({
                    type: 'system',
                    content: player.name + ' 思考中...(网络延迟)'
                });
            }
            // 继续下一个玩家
            game.currentSpeaker++;
            if (game.currentSpeaker >= game.alivePlayers.length) {
                self.startUndercoverDiscussion();
            } else {
                self.updateUndercoverUI();
                var nextPlayerId = game.alivePlayers[game.currentSpeaker];
                if (nextPlayerId !== 'user') {
                    setTimeout(function() {
                        self.generateAIUndercoverDescription(nextPlayerId);
                    }, 500);
                }
            }
            return;
        }
        
        setTimeout(function() {
            console.log('重试AI描述, 次数:', retryCount + 1, aiId);
            self.generateAIUndercoverDescription(aiId);
        }, 1000 * retryCount);
    };
    
    // 开始讨论阶段
    ChatApp.prototype.startUndercoverDiscussion = function() {
        var game = this.undercoverGame;
        if (!game) return;
        
        game.phase = 'discuss';
        
        this.addUndercoverMessage({
            type: 'phase',
            content: '讨论阶段 - 自由讨论，长按发送可让AI回复'
        });
        
        this.updateUndercoverUI();
    };
    
    // 发送讨论消息
    ChatApp.prototype.sendUndercoverDiscussMessage = function(playerId, content, triggerAI) {
        var self = this;
        var game = this.undercoverGame;
        if (!game || game.phase !== 'discuss') return;
        
        var player = game.players.find(function(p) { return p.id === playerId; });
        if (!player) return;
        
        // 添加消息
        this.addUndercoverMessage({
            type: 'discuss',
            playerId: playerId,
            playerName: player.name,
            content: content
        });
        
        // 记录到游戏日志
        game.gameLog.push({
            round: game.round,
            type: 'discuss',
            playerId: playerId,
            playerName: player.name,
            content: content
        });
        
        this.updateUndercoverUI();
        
        // 如果需要触发AI回复（长按发送）
        if (triggerAI && playerId === 'user') {
            this.generateAIDiscussResponse(content);
        }
    };
    
    // AI讨论回复
    ChatApp.prototype.generateAIDiscussResponse = function(userMessage) {
        var self = this;
        var game = this.undercoverGame;
        if (!game || game.phase !== 'discuss') return;
        
        // 获取存活的AI玩家
        var aliveAIs = game.alivePlayers.filter(function(id) {
            return id !== 'user';
        });
        
        if (aliveAIs.length === 0) return;
        
        // 随机选择1-2个AI回复
        var respondCount = Math.min(aliveAIs.length, Math.random() > 0.5 ? 2 : 1);
        var shuffled = aliveAIs.sort(function() { return Math.random() - 0.5; });
        var responders = shuffled.slice(0, respondCount);
        
        responders.forEach(function(aiId, index) {
            setTimeout(function() {
                self.generateSingleAIDiscussResponse(aiId, userMessage);
            }, 800 + index * 1200);
        });
    };
    
    // 单个AI讨论回复
    ChatApp.prototype.generateSingleAIDiscussResponse = function(aiId, userMessage) {
        var self = this;
        var game = this.undercoverGame;
        if (!game || game.phase !== 'discuss') return;
        
        var player = game.players.find(function(p) { return p.id === aiId; });
        if (!player) return;
        
        var ai = PhoneCore.getAI(aiId);
        
        // 获取所有轮次的描述（完整上下文）
        var allDescriptions = game.chatHistory.filter(function(m) {
            return m.type === 'describe';
        }).map(function(m) {
            return '第' + m.round + '轮 ' + m.playerName + ': ' + m.content;
        }).join('\n');
        
        // 获取完整讨论记录（不限制条数）
        var discussHistory = game.chatHistory.filter(function(m) {
            return m.type === 'discuss';
        }).map(function(m) {
            return m.playerName + ': ' + m.content;
        }).join('\n');
        
        // 获取用户最近连续发送的消息
        var recentUserMessages = [];
        var discussMessages = game.chatHistory.filter(function(m) {
            return m.type === 'discuss' && m.round === game.round;
        });
        // 从后往前遍历，收集用户连续的消息
        for (var i = discussMessages.length - 1; i >= 0; i--) {
            if (discussMessages[i].playerId === 'user') {
                recentUserMessages.unshift(discussMessages[i].content);
            } else {
                break; // 遇到非用户消息就停止
            }
        }
        var userMessagesText = recentUserMessages.length > 1 
            ? recentUserMessages.join('；') 
            : userMessage;
        
        // 获取玩家列表和自己的信息
        var playerList = game.players.map(function(p) {
            var status = game.alivePlayers.indexOf(p.id) !== -1 ? '存活' : '出局';
            return p.name + '(' + status + ')';
        }).join('、');
        
        var systemPrompt = '你正在玩谁是卧底游戏，现在是讨论环节。';
        systemPrompt += '\n你是' + player.name + '，你的词语是"' + player.word + '"。';
        systemPrompt += '\n参与玩家：' + playerList;
        systemPrompt += '\n当前是第' + game.round + '轮讨论。';
        systemPrompt += '\n\n【历史描述】\n' + allDescriptions;
        if (discussHistory) {
            systemPrompt += '\n\n【讨论记录】\n' + discussHistory;
        }
        systemPrompt += '\n\n【用户刚才说】' + userMessagesText;
        systemPrompt += '\n\n请以' + player.name + '的身份回复，可以分析谁可能是卧底，推理线索，或者表达你的看法。自然地聊天，不要有任何前缀。';
        
        if (ai && ai.personality) {
            systemPrompt += '\n\n你的性格：' + ai.personality;
        }
        
        // 让请求更独特
        var uniqueContext = '[' + player.name + '回复] ' + userMessagesText;
        uniqueContext += '\n(时间:' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + ')';
        
        var messages = [
            { role: 'user', content: uniqueContext }
        ];
        
        PhoneCore.api.call(systemPrompt, game.apiConfigId, {
            messages: messages,
            maxTokens: 2000,
            temperature: 0.9
        }).then(function(response) {
            var content = (response.content || '').trim();
            content = content.replace(/^我[：:]\s*/i, '');
            content = content.replace(/^\[.*?\]\s*/i, ''); // 去掉可能的前缀标记
            
            if (content && content.length >= 2 && game.phase === 'discuss') {
                self.sendUndercoverDiscussMessage(aiId, content, false);
            } else {
                console.error('AI讨论回复内容为空:', aiId);
            }
        }).catch(function(err) {
            console.error('AI讨论回复失败:', aiId, err);
        });
    };
    
    // 开始投票
    ChatApp.prototype.startUndercoverVoting = function() {
        var game = this.undercoverGame;
        if (!game) return;
        
        game.phase = 'vote';
        game.roundVotes = {};
        
        this.addUndercoverMessage({
            type: 'phase',
            content: '投票阶段 - 选出你认为的卧底'
        });
        
        this.updateUndercoverUI();
        
        // AI玩家自动投票
        var self = this;
        game.alivePlayers.forEach(function(playerId, index) {
            if (playerId !== 'user') {
                setTimeout(function() {
                    self.generateAIUndercoverVote(playerId);
                }, 500 + index * 800);
            }
        });
    };
    
    // 生成AI投票
    ChatApp.prototype.generateAIUndercoverVote = function(aiId) {
        var self = this;
        var game = this.undercoverGame;
        if (!game || game.phase !== 'vote') return;
        
        var player = game.players.find(function(p) { return p.id === aiId; });
        if (!player) return;
        
        // 获取可投票的玩家（不包括自己）
        var candidates = game.alivePlayers.filter(function(id) { return id !== aiId; });
        
        if (candidates.length === 0) return;
        
        // AI根据描述分析投票
        var descriptions = game.chatHistory.filter(function(m) {
            return m.type === 'describe' && m.round === game.round;
        });
        
        // 简单策略：随机选择一个
        // 卧底倾向于投平民，平民倾向于找出异常描述
        var targetId;
        if (player.role === 'undercover') {
            // 卧底随机投一个平民
            var civilians = candidates.filter(function(id) {
                var p = game.players.find(function(pl) { return pl.id === id; });
                return p && p.role === 'civilian';
            });
            targetId = civilians.length > 0 ? civilians[Math.floor(Math.random() * civilians.length)] : candidates[Math.floor(Math.random() * candidates.length)];
        } else {
            // 平民尝试找出卧底（简单随机）
            targetId = candidates[Math.floor(Math.random() * candidates.length)];
        }
        
        this.submitUndercoverVote(aiId, targetId);
    };
    
    // 提交投票
    ChatApp.prototype.submitUndercoverVote = function(playerId, targetId) {
        var game = this.undercoverGame;
        if (!game || game.phase !== 'vote') return;
        
        game.roundVotes[playerId] = targetId;
        
        // 检查是否所有人都投票了
        var allVoted = game.alivePlayers.every(function(id) {
            return game.roundVotes[id] !== undefined;
        });
        
        if (allVoted) {
            this.processUndercoverVotes();
        }
    };
    
    // 处理投票结果
    ChatApp.prototype.processUndercoverVotes = function() {
        var self = this;
        var game = this.undercoverGame;
        if (!game) return;
        
        // 统计票数
        var voteCounts = {};
        for (var voterId in game.roundVotes) {
            var targetId = game.roundVotes[voterId];
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        }
        
        // 找出票数最多的玩家
        var maxVotes = 0;
        var eliminated = [];
        
        for (var playerId in voteCounts) {
            if (voteCounts[playerId] > maxVotes) {
                maxVotes = voteCounts[playerId];
                eliminated = [playerId];
            } else if (voteCounts[playerId] === maxVotes) {
                eliminated.push(playerId);
            }
        }
        
        // 如果有平票，随机选择一个
        var eliminatedId = eliminated[Math.floor(Math.random() * eliminated.length)];
        var eliminatedPlayer = game.players.find(function(p) { return p.id === eliminatedId; });
        
        // 从存活列表移除
        var idx = game.alivePlayers.indexOf(eliminatedId);
        if (idx !== -1) {
            game.alivePlayers.splice(idx, 1);
            game.eliminatedPlayers.push(eliminatedId);
        }
        
        // 显示结果
        var resultText = eliminatedPlayer.name + ' 被投票出局';
        if (game.isGodMode || game.phase === 'ended') {
            resultText += ' (身份: ' + (eliminatedPlayer.role === 'undercover' ? '卧底' : '平民') + ')';
        }
        
        this.addUndercoverMessage({
            type: 'vote_result',
            content: resultText
        });
        
        // 记录投票详情到游戏日志
        var voteDetails = [];
        for (var voterId in game.roundVotes) {
            var targetId = game.roundVotes[voterId];
            var voter = game.players.find(function(p) { return p.id === voterId; });
            var target = game.players.find(function(p) { return p.id === targetId; });
            if (voter && target) {
                voteDetails.push({
                    voterId: voterId,
                    voterName: voter.name,
                    targetId: targetId,
                    targetName: target.name
                });
            }
        }
        
        game.gameLog.push({
            round: game.round,
            type: 'vote',
            voteDetails: voteDetails,
            voteCounts: voteCounts
        });
        
        // 记录淘汰到游戏日志
        game.gameLog.push({
            round: game.round,
            type: 'elimination',
            playerId: eliminatedId,
            playerName: eliminatedPlayer.name,
            role: eliminatedPlayer.role,
            votes: maxVotes
        });
        
        // 检查游戏是否结束
        this.checkUndercoverGameEnd();
    };
    
    // 检查游戏结束
    ChatApp.prototype.checkUndercoverGameEnd = function() {
        var game = this.undercoverGame;
        if (!game) return;
        
        // 统计存活的卧底和平民
        var aliveUndercover = 0;
        var aliveCivilian = 0;
        
        game.alivePlayers.forEach(function(playerId) {
            var player = game.players.find(function(p) { return p.id === playerId; });
            if (player) {
                if (player.role === 'undercover') {
                    aliveUndercover++;
                } else {
                    aliveCivilian++;
                }
            }
        });
        
        var gameEnded = false;
        var winner = null;
        
        // 所有卧底被找出 -> 平民胜利
        if (aliveUndercover === 0) {
            gameEnded = true;
            winner = 'civilian';
        }
        // 卧底数量 >= 平民数量 -> 卧底胜利
        else if (aliveUndercover >= aliveCivilian) {
            gameEnded = true;
            winner = 'undercover';
        }
        
        if (gameEnded) {
            this.endUndercoverGame(winner);
        } else {
            // 继续下一轮
            var self = this;
            setTimeout(function() {
                self.startUndercoverRound();
            }, 1500);
        }
        
        this.updateUndercoverUI();
    };
    
    // 结束游戏
    ChatApp.prototype.endUndercoverGame = function(winner) {
        var game = this.undercoverGame;
        if (!game) return;
        
        game.phase = 'review';
        game.winner = winner;
        game.endTime = Date.now();
        
        var winnerText = winner === 'civilian' ? '平民胜利' : '卧底胜利';
        
        this.addUndercoverMessage({
            type: 'phase',
            content: '游戏结束 - ' + winnerText + '!'
        });
        
        // 显示词语
        this.addUndercoverMessage({
            type: 'system',
            content: '平民词语: ' + game.wordPair.civilian + ' / 卧底词语: ' + game.wordPair.undercover
        });
        
        // 进入复盘阶段
        this.addUndercoverMessage({
            type: 'phase',
            content: '复盘时间 - 可以自由聊天讨论'
        });
        
        this.updateUndercoverUI();
        
        // 让AI也参与复盘讨论
        var self = this;
        setTimeout(function() {
            self.generateAIReviewComment();
        }, 2000);
    };
    
    // AI复盘评论（使用AI生成真正的复盘内容）
    ChatApp.prototype.generateAIReviewComment = function(userMessage) {
        var self = this;
        var game = this.undercoverGame;
        if (!game || game.phase !== 'review') return;
        
        // 随机选一个AI发言
        var aiPlayers = game.players.filter(function(p) { return !p.isUser; });
        if (aiPlayers.length === 0) return;
        
        var speaker = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];
        var ai = PhoneCore.getAI(speaker.id);
        
        // 获取完整游戏记录
        var allDescriptions = game.chatHistory.filter(function(m) {
            return m.type === 'describe';
        }).map(function(m) {
            return '第' + m.round + '轮 ' + m.playerName + ': ' + m.content;
        }).join('\n');
        
        var allDiscussions = game.chatHistory.filter(function(m) {
            return m.type === 'discuss';
        }).map(function(m) {
            return m.playerName + ': ' + m.content;
        }).join('\n');
        
        var reviewChats = game.chatHistory.filter(function(m) {
            return m.type === 'review_chat';
        }).map(function(m) {
            return m.playerName + ': ' + m.content;
        }).join('\n');
        
        // 玩家身份信息
        var playerInfo = game.players.map(function(p) {
            return p.name + '(' + (p.role === 'undercover' ? '卧底' : '平民') + ', 词语:' + p.word + ')';
        }).join(', ');
        
        var winnerText = game.winner === 'civilian' ? '平民胜利' : '卧底胜利';
        
        var systemPrompt = '你刚刚玩完一局谁是卧底游戏，现在是复盘讨论时间。';
        systemPrompt += '\n\n【游戏结果】' + winnerText;
        systemPrompt += '\n【平民词语】' + game.wordPair.civilian;
        systemPrompt += '\n【卧底词语】' + game.wordPair.undercover;
        systemPrompt += '\n【玩家身份】' + playerInfo;
        systemPrompt += '\n【你的身份】' + speaker.name + '(' + (speaker.role === 'undercover' ? '卧底' : '平民') + ')';
        systemPrompt += '\n\n【游戏中的描述】\n' + allDescriptions;
        if (allDiscussions) {
            systemPrompt += '\n\n【讨论记录】\n' + allDiscussions;
        }
        if (reviewChats) {
            systemPrompt += '\n\n【复盘聊天】\n' + reviewChats;
        }
        if (userMessage) {
            systemPrompt += '\n\n【用户刚说】' + userMessage;
        }
        systemPrompt += '\n\n请以' + speaker.name + '的身份自然地进行复盘讨论，可以分析谁的描述暴露了身份、哪个环节是转折点、自己的策略等。不要有任何前缀。';
        
        if (ai && ai.personality) {
            systemPrompt += '\n\n你的性格：' + ai.personality;
        }
        
        // 让请求更独特
        var uniqueContext = '[' + speaker.name + '复盘] ' + (userMessage || '游戏结束了，来复盘一下吧');
        uniqueContext += '\n(时间:' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + ')';
        
        var messages = [
            { role: 'user', content: uniqueContext }
        ];
        
        PhoneCore.api.call(systemPrompt, game.apiConfigId, {
            messages: messages,
            maxTokens: 2000,
            temperature: 0.9
        }).then(function(response) {
            var content = (response.content || '').trim();
            content = content.replace(/^我[：:]\s*/i, '');
            content = content.replace(/^\[.*?\]\s*/i, ''); // 去掉可能的前缀标记
            
            if (content && content.length >= 2 && game.phase === 'review') {
                self.sendUndercoverReviewMessage(speaker.id, content);
            } else {
                console.error('AI复盘评论内容为空:', speaker.id);
            }
        }).catch(function(err) {
            console.error('AI复盘评论失败:', speaker.id, err);
            // 不再使用预设回复，只记录错误
        });
    };
    
    // 发送复盘消息
    ChatApp.prototype.sendUndercoverReviewMessage = function(playerId, content) {
        var game = this.undercoverGame;
        if (!game || game.phase !== 'review') return;
        
        var player = game.players.find(function(p) { return p.id === playerId; });
        if (!player) return;
        
        this.addUndercoverMessage({
            type: 'review_chat',
            playerId: playerId,
            playerName: player.name,
            content: content
        });
        
        // 记录到游戏日志
        game.gameLog.push({
            type: 'review_chat',
            playerId: playerId,
            playerName: player.name,
            content: content
        });
        
        this.updateUndercoverUI();
        
        // 用户发言后AI回应
        if (playerId === 'user') {
            var self = this;
            setTimeout(function() {
                self.generateAIReviewComment(content);
            }, 1000 + Math.random() * 1500);
        }
    };
    
    // 保存谁是卧底记录并退出（不关闭页面，由onBack处理）
    ChatApp.prototype.saveUndercoverRecordAndExit = function() {
        var self = this;
        var game = this.undercoverGame;
        if (!game || game._isSaving) return;
        game._isSaving = true;
        
        // 生成游戏概要
        var duration = (game.endTime || Date.now()) - game.startTime;
        var winnerText = game.winner === 'civilian' ? '平民胜利' : game.winner === 'undercover' ? '卧底胜利' : '未分胜负';
        
        // 生成简短概要
        var summary = game.playerCount + '人局，共' + game.round + '轮，' + winnerText + '。';
        summary += '平民词:' + game.wordPair.civilian + '，卧底词:' + game.wordPair.undercover;
        
        // 创建游戏记录
        var gameRecord = {
            id: game.id,
            gameType: 'undercover',
            playerCount: game.playerCount,
            rounds: game.round,
            duration: duration,
            winner: game.winner,
            wordPair: game.wordPair,
            wordType: game.wordType,
            players: game.players.map(function(p) {
                return {
                    id: p.id,
                    name: p.name,
                    role: p.role,
                    word: p.word,
                    isUser: p.isUser,
                    eliminated: game.eliminatedPlayers.indexOf(p.id) !== -1
                };
            }),
            summary: summary,
            fullLog: game.gameLog,
            timestamp: Date.now()
        };
        
        // 添加到群聊记录
        var group = this.getGroupChat(game.groupId);
        if (group) {
            if (!group.chatHistory) group.chatHistory = [];
            
            var recordMessage = {
                id: 'ucgame_record_' + Date.now(),
                role: 'system',
                type: 'game_record',
                content: '[谁是卧底游戏记录]',
                gameRecord: gameRecord,
                timestamp: Date.now()
            };
            
            group.chatHistory.push(recordMessage);
            this.saveGroupChat(group);
        }
        
        // 记录到游戏积分排行榜系统
        if (typeof GameStats !== 'undefined' && GameStats.recordUndercoverGame) {
            try {
                GameStats.recordUndercoverGame({
                    id: game.id,
                    groupId: game.groupId,
                    playerCount: game.playerCount,
                    rounds: game.round,
                    winner: game.winner,
                    wordPair: game.wordPair,
                    players: game.players.map(function(p) {
                        return {
                            id: p.id,
                            name: p.name,
                            role: p.role,
                            isUser: p.isUser,
                            eliminated: game.eliminatedPlayers.indexOf(p.id) !== -1
                        };
                    })
                });
            } catch (e) {
                console.error('[Undercover] 记录积分失败:', e);
            }
        }
        
        PhoneCore.notifications.send({
            type: 'success',
            title: '游戏记录已保存',
            size: 'mini'
        });
    };
    
    // 完成游戏并保存记录（从结束游戏按钮调用）
    ChatApp.prototype.finishUndercoverGame = function() {
        var self = this;
        var game = this.undercoverGame;
        if (!game) return;
        
        game.phase = 'ended';
        
        // 保存记录
        this.saveUndercoverRecordAndExit();
        
        // 关闭游戏页面
        if (this.undercoverGamePage) {
            this.undercoverGamePage.querySelector('.app-back-btn').click();
        }
        
        this.undercoverGame = null;
        this.undercoverGamePage = null;
    };
    
    // 添加消息
    ChatApp.prototype.addUndercoverMessage = function(msg) {
        var game = this.undercoverGame;
        if (!game) return;
        
        msg.timestamp = Date.now();
        msg.round = game.round;
        game.chatHistory.push(msg);
    };
    
    // 更新UI
    ChatApp.prototype.updateUndercoverUI = function() {
        var game = this.undercoverGame;
        var page = this.undercoverGamePage;
        if (!game || !page) return;
        
        // 更新轮次
        var roundEl = page.querySelector('#uc-round');
        if (roundEl) roundEl.textContent = game.round;
        
        // 更新阶段
        var phaseEl = page.querySelector('#uc-phase');
        if (phaseEl) {
            var phaseText = {
                'describe': '描述阶段',
                'discuss': '讨论阶段',
                'vote': '投票阶段',
                'review': '复盘讨论',
                'ended': '游戏结束'
            };
            phaseEl.textContent = phaseText[game.phase] || game.phase;
        }
        
        // 更新存活人数
        var aliveEl = page.querySelector('#uc-alive-count');
        if (aliveEl) {
            aliveEl.textContent = '存活 ' + game.alivePlayers.length + '/' + game.players.length + ' 人';
        }
        
        // 更新玩家条
        var playerBar = page.querySelector('#uc-player-bar');
        if (playerBar) {
            playerBar.innerHTML = this.renderUndercoverPlayerBar();
        }
        
        // 更新消息
        var messagesEl = page.querySelector('#uc-messages');
        if (messagesEl) {
            messagesEl.innerHTML = this.renderUndercoverMessages();
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        
        // 更新输入区域
        var inputArea = page.querySelector('#uc-input-area');
        if (inputArea) {
            inputArea.innerHTML = this.renderUndercoverInputArea();
            this.bindUndercoverGameEvents(page);
        }
    };
    
    // 渲染谁是卧底游戏记录卡片
    ChatApp.prototype.renderUndercoverRecordCard = function(msg) {
        var record = msg.gameRecord;
        if (!record || record.gameType !== 'undercover') return '';
        
        var winnerText = record.winner === 'civilian' ? '平民胜' : '卧底胜';
        var winnerColor = record.winner === 'civilian' ? '#4a9a6a' : '#c85a5a';
        var duration = Math.floor(record.duration / 60000);
        
        var html = '<div class="message-wrapper special-msg-wrapper" data-msg-id="' + msg.id + '" style="text-align:center;margin:16px 0;position:relative;">';
        html += '<div class="game-record-card undercover-record" data-record-id="' + record.id + '" data-msg-id="' + msg.id + '" style="display:inline-block;background:linear-gradient(135deg,#FFF5F7,#FFE8F0);border:1px solid #FFD6E0;border-radius:12px;padding:14px;width:240px;cursor:pointer;transition:all 0.2s;text-align:left;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        
        // 游戏图标
        html += '<div style="width:42px;height:42px;background:linear-gradient(135deg,#FFD6E0,#FFF0F3);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="#E88FAC"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        html += '</div>';
        
        // 信息
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#C76B8F;">谁是卧底</div>';
        html += '<div style="font-size:11px;color:#E88FAC;margin-top:3px;">' + record.playerCount + '人局 / ' + record.rounds + '轮 / ' + duration + '分钟</div>';
        html += '</div>';
        
        // 结果
        html += '<div style="text-align:right;">';
        html += '<div style="font-size:12px;font-weight:600;color:' + winnerColor + ';">' + winnerText + '</div>';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFB3C6" style="margin-top:2px;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>';
        html += '</div>';
        
        html += '</div>';
        
        // 概要
        if (record.summary) {
            html += '<div style="font-size:11px;color:#C76B8F;margin-top:10px;padding-top:10px;border-top:1px solid #FFD6E0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">';
            html += record.summary;
            html += '</div>';
        }
        
        html += '</div>';
        
        // 底部悬浮按钮组（与通话记录卡片样式一致）
        html += '<div class="message-actions special-actions" style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);display:none;gap:4px;z-index:100;">';
        // 收藏按钮
        html += '<button class="action-btn game-record-favorite-btn" data-record-id="' + record.id + '" data-msg-id="' + msg.id + '" title="收藏" style="width:26px;height:26px;border:1px solid #FFD6E0;background:#FFF;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
        html += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF6B9D" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
        html += '</button>';
        // 删除按钮
        html += '<button class="action-btn game-record-delete-btn" data-record-id="' + record.id + '" data-msg-id="' + msg.id + '" title="删除记录" style="width:26px;height:26px;border:1px solid #FFD6E0;background:#FFF;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
        html += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF6B9D" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
        html += '</button>';
        html += '</div>';
        
        html += '</div>';
        
        return html;
    };
    
    // 谁是卧底游戏记录详情页
    ChatApp.prototype.openUndercoverRecordDetail = function(groupId, record) {
        var self = this;
        
        var winnerText = record.winner === 'civilian' ? '平民胜利' : '卧底胜利';
        var winnerColor = record.winner === 'civilian' ? '#4a9a6a' : '#c85a5a';
        var duration = Math.floor(record.duration / 60000);
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#FFF5F7 0%,#FFF0F3 100%);min-height:100%;">';
        
        // 游戏结果头部
        html += '<div style="text-align:center;padding:16px 0;margin-bottom:16px;">';
        html += '<div style="width:56px;height:56px;margin:0 auto 12px;background:linear-gradient(135deg,#FFD6E0,#FFF0F3);border-radius:16px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="#E88FAC"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        html += '</div>';
        html += '<div style="font-size:16px;font-weight:600;color:' + winnerColor + ';margin-bottom:6px;">' + winnerText + '</div>';
        html += '<div style="font-size:11px;color:#E88FAC;">' + record.playerCount + '人局 / ' + record.rounds + '轮 / ' + duration + '分钟</div>';
        html += '</div>';
        
        // 词语对
        html += '<div style="display:flex;gap:10px;margin-bottom:16px;">';
        html += '<div style="flex:1;background:white;border-radius:10px;padding:12px;border:1px solid #D6E4FF;text-align:center;">';
        html += '<div style="font-size:10px;color:#4a9a6a;margin-bottom:6px;">平民词语</div>';
        html += '<div style="font-size:16px;font-weight:600;color:#4a9a6a;">' + (record.wordPair ? record.wordPair.civilian : '-') + '</div>';
        html += '</div>';
        html += '<div style="flex:1;background:white;border-radius:10px;padding:12px;border:1px solid #FFD6E0;text-align:center;">';
        html += '<div style="font-size:10px;color:#c85a5a;margin-bottom:6px;">卧底词语</div>';
        html += '<div style="font-size:16px;font-weight:600;color:#c85a5a;">' + (record.wordPair ? record.wordPair.undercover : '-') + '</div>';
        html += '</div>';
        html += '</div>';
        
        // 玩家列表
        html += '<div style="background:white;border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid #FFD6E0;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">玩家身份</div>';
        
        if (record.players) {
            record.players.forEach(function(player) {
                var roleColor = player.role === 'undercover' ? '#c85a5a' : '#4a9a6a';
                var roleText = player.role === 'undercover' ? '卧底' : '平民';
                
                html += '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #FFE8F0;">';
                html += '<div style="width:26px;height:26px;border-radius:50%;background:' + self.getAvatarColor(player.id) + ';margin-right:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">' + player.name.charAt(0) + '</div>';
                html += '<div style="flex:1;">';
                html += '<div style="color:#C76B8F;font-size:11px;">' + player.name + (player.isUser ? ' (你)' : '') + '</div>';
                html += '<div style="font-size:9px;color:#E88FAC;">词语: ' + player.word + '</div>';
                html += '</div>';
                html += '<div style="display:flex;align-items:center;gap:4px;">';
                html += '<span style="color:' + roleColor + ';font-size:10px;font-weight:500;">' + roleText + '</span>';
                if (player.eliminated) {
                    html += '<span style="color:#999;font-size:9px;margin-left:4px;">(出局)</span>';
                }
                html += '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        // 游戏概要
        if (record.summary) {
            html += '<div style="background:white;border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid #FFD6E0;">';
            html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:8px;">游戏概要</div>';
            html += '<div style="color:#E88FAC;font-size:10px;line-height:1.6;">' + record.summary + '</div>';
            html += '</div>';
        }
        
        // 投票记录（从fullLog中提取）
        if (record.fullLog && record.fullLog.length > 0) {
            var voteLogs = record.fullLog.filter(function(log) { return log.type === 'vote'; });
            var elimLogs = record.fullLog.filter(function(log) { return log.type === 'elimination'; });
            
            if (voteLogs.length > 0 || elimLogs.length > 0) {
                html += '<div style="background:white;border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid #FFD6E0;">';
                html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">📊 投票记录</div>';
                html += '<div style="max-height:180px;overflow-y:auto;">';
                
                // 按轮次分组
                var roundData = {};
                voteLogs.forEach(function(log) {
                    var round = log.round || 1;
                    if (!roundData[round]) roundData[round] = { votes: null, elim: null };
                    roundData[round].votes = log;
                });
                elimLogs.forEach(function(log) {
                    var round = log.round || 1;
                    if (!roundData[round]) roundData[round] = { votes: null, elim: null };
                    roundData[round].elim = log;
                });
                
                Object.keys(roundData).sort(function(a, b) { return a - b; }).forEach(function(round) {
                    var data = roundData[round];
                    html += '<div style="margin-bottom:10px;">';
                    html += '<div style="font-size:10px;font-weight:600;color:#E88FAC;margin-bottom:6px;padding:4px 8px;background:rgba(232,143,172,0.1);border-radius:6px;display:inline-block;">第 ' + round + ' 轮投票</div>';
                    
                    // 显示投票详情
                    if (data.votes && data.votes.voteDetails) {
                        data.votes.voteDetails.forEach(function(vote) {
                            html += '<div style="padding:3px 8px;font-size:10px;color:#C76B8F;">';
                            html += vote.voterName + ' → ' + vote.targetName;
                            html += '</div>';
                        });
                    }
                    
                    // 显示淘汰结果
                    if (data.elim) {
                        var roleText = data.elim.role === 'undercover' ? '卧底' : '平民';
                        var roleColor = data.elim.role === 'undercover' ? '#c85a5a' : '#4a9a6a';
                        html += '<div style="padding:4px 8px;font-size:10px;color:' + roleColor + ';font-weight:500;margin-top:4px;">';
                        html += '💔 ' + data.elim.playerName + ' 被投出 (' + roleText + ', ' + data.elim.votes + '票)';
                        html += '</div>';
                    }
                    
                    html += '</div>';
                });
                
                html += '</div>';
                html += '</div>';
            }
        }
        
        // 完整游戏记录
        html += '<div style="background:white;border-radius:10px;padding:12px;border:1px solid #FFD6E0;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">游戏流程</div>';
        html += '<div style="max-height:280px;overflow-y:auto;">';
        
        if (record.fullLog && record.fullLog.length > 0) {
            record.fullLog.forEach(function(msg) {
                if (msg.type === 'elimination') {
                    var roleText = msg.role === 'undercover' ? '卧底' : '平民';
                    html += '<div style="text-align:center;padding:6px 0;">';
                    html += '<span style="display:inline-block;padding:4px 12px;background:#FFE8F0;border-radius:10px;font-size:10px;color:#C76B8F;">' + msg.playerName + ' 被投出 (' + roleText + ')</span>';
                    html += '</div>';
                } else if (msg.type === 'describe') {
                    var isUser = msg.playerId === 'user';
                    html += '<div style="display:flex;gap:6px;margin:6px 0;' + (isUser ? 'flex-direction:row-reverse;' : '') + '">';
                    html += '<div style="max-width:75%;">';
                    html += '<div style="font-size:9px;color:#E88FAC;margin-bottom:2px;' + (isUser ? 'text-align:right;' : '') + '">' + (msg.playerName || '未知') + ' (第' + msg.round + '轮)</div>';
                    html += '<div style="padding:6px 10px;background:' + (isUser ? 'linear-gradient(135deg,#E88FAC,#C76B8F)' : '#FFF5F7') + ';border:1px solid ' + (isUser ? 'transparent' : '#FFD6E0') + ';border-radius:8px;color:' + (isUser ? 'white' : '#C76B8F') + ';font-size:10px;">' + msg.content + '</div>';
                    html += '</div>';
                    html += '</div>';
                } else if (msg.type === 'review_chat') {
                    var isUser = msg.playerId === 'user';
                    html += '<div style="display:flex;gap:6px;margin:6px 0;' + (isUser ? 'flex-direction:row-reverse;' : '') + '">';
                    html += '<div style="max-width:75%;">';
                    html += '<div style="font-size:9px;color:#999;margin-bottom:2px;' + (isUser ? 'text-align:right;' : '') + '">' + (msg.playerName || '未知') + ' (复盘)</div>';
                    html += '<div style="padding:6px 10px;background:' + (isUser ? '#E8E8E8' : '#F5F5F5') + ';border-radius:8px;color:#666;font-size:10px;">' + msg.content + '</div>';
                    html += '</div>';
                    html += '</div>';
                }
            });
        } else {
            html += '<div style="text-align:center;color:#E88FAC;font-size:11px;padding:16px;">暂无详细记录</div>';
        }
        
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        this.openDetailPage(html, { title: '游戏记录', titleColor: '#C76B8F', bgColor: '#FFF5F7' });
    };



// ========== 谁是卧底代码结束 ==========
