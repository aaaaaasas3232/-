/**
 * ==========================================
 * 【小游戏 - 大富翁】
 * ==========================================
 * 
 * 功能：
 * - 3D骰子动画
 * - 数字转盘
 * - 大富翁地图（飞行棋/真心话大冒险主题）
 * - 支持1人+AI游戏
 * - 无印良品毛玻璃风格UI
 * - AI回复全部通过API真实生成
 */

// SVG图标定义
var MonopolySVG = {
    dice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    wheel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v10l8.5 5M12 12l-8.5 5"/></svg>',
    stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
    log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
    game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/></svg>',
    robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>',
    mask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    thunder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    celebrate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>',
    sleep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>'
};

// 注册大富翁游戏到GameCore
if (typeof GameCore !== 'undefined') {
    GameCore.registerGame('monopoly', {
        name: '大富翁',
        description: '经典棋盘游戏，掷骰子前进',
        minPlayers: 1,
        maxPlayers: 4,
        icon: MonopolySVG.dice,
        iconType: 'svg',
        color: '#7B8FA1',
        bgGradient: 'linear-gradient(135deg,#E8E4E1,#F5F5F5)',
        setupFunction: 'openMonopolySetup'
    });
}

// ============ 大富翁游戏系统 ============

// 大富翁莫兰迪配色方案
var MonopolyColors = {
    colors: [
        '#d8e2dc', '#ffe5d9', '#ffcad4', '#f4acb7', '#9d8189',
        '#d8e2dc', '#e8e8e4', '#f5ebe0', '#e3d5ca', '#d5bdaf',
        '#b8c0ff', '#c8b6ff', '#e7c6ff', '#ffd6ff', '#a0c4ff',
        '#bdb2ff', '#ffc6ff', '#fffffc', '#cbc0d3', '#efd3d7'
    ],
    text: '#313735',
    bg: '#fafafa',
    cardBg: '#ffffff',
    cardShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    player1Glow: 'rgba(255, 183, 197, 0.8)',
    player2Glow: 'rgba(176, 198, 255, 0.8)',
    glass: 'rgba(255, 255, 255, 0.25)',
    glassBorder: 'rgba(255, 255, 255, 0.3)'
};

// 飞行棋主题格子内容
var LudoBoardContent = [
    '起点', '前进2格', '休息一回', '幸运卡', '后退1格',
    '交换位置', '前进3格', '停一回合', '安全区', '随机事件',
    '前进1格', '后退2格', '双倍奖励', '传送门', '陷阱',
    '加速', '减速', '保护罩', '炸弹', '终点'
];

// 真心话大冒险主题格子内容
var TruthDareBoardContent = [
    '起点', '真心话', '大冒险', '真心话', '大冒险',
    '自由选择', '真心话', '大冒险', '跳过', '真心话',
    '大冒险', '真心话', '双倍挑战', '大冒险', '真心话',
    '交换任务', '大冒险', '真心话', '终极挑战', '终点'
];

// 大富翁设置页面
ChatApp.prototype.openMonopolySetup = function(groupId) {
    var self = this;
    var group = this.getGroupChat(groupId);
    if (!group) return;
    
    var memberCount = group.members.length;
    var maxPlayers = Math.min(4, memberCount + 1);
    
    // 毛玻璃风格CSS
    var glassStyle = 'background:rgba(255,255,255,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.3);';
    
    var html = '<div style="padding:16px;background:linear-gradient(180deg,#F5F5F5 0%,#E8E4E1 100%);min-height:100%;">';
    
    // 标题卡片
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">';
    html += '<div style="width:40px;height:40px;margin:0 auto 8px;color:#313735;">' + MonopolySVG.dice + '</div>';
    html += '<div style="font-size:18px;font-weight:600;color:#313735;margin-bottom:4px;">大富翁</div>';
    html += '<div style="font-size:12px;color:#7B8FA1;">群内有 ' + memberCount + ' 名成员</div>';
    html += '</div>';
    
    // 游戏主题选择
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:16px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#313735;margin-bottom:12px;">游戏主题</div>';
    html += '<div id="theme-selector" style="display:flex;gap:10px;">';
    
    // 飞行棋主题
    html += '<button class="theme-btn active" data-theme="ludo" style="flex:1;padding:16px 12px;' + glassStyle + 'border-radius:12px;cursor:pointer;transition:all 0.3s;border:2px solid #b8c0ff !important;">';
    html += '<div style="width:28px;height:28px;margin:0 auto 6px;color:#313735;">' + MonopolySVG.plane + '</div>';
    html += '<div style="font-size:12px;font-weight:600;color:#313735;">飞行棋</div>';
    html += '<div style="font-size:10px;color:#7B8FA1;margin-top:4px;">前进后退</div>';
    html += '</button>';
    
    // 真心话大冒险主题
    html += '<button class="theme-btn" data-theme="truth_dare" style="flex:1;padding:16px 12px;' + glassStyle + 'border-radius:12px;cursor:pointer;transition:all 0.3s;">';
    html += '<div style="width:28px;height:28px;margin:0 auto 6px;color:#313735;">' + MonopolySVG.chat + '</div>';
    html += '<div style="font-size:12px;font-weight:600;color:#313735;">真心话大冒险</div>';
    html += '<div style="font-size:10px;color:#7B8FA1;margin-top:4px;">问答挑战</div>';
    html += '</button>';
    
    html += '</div>';
    html += '</div>';
    
    // API配置选择
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:16px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#313735;margin-bottom:12px;">AI模型配置</div>';
    html += '<select id="mp-api-select" style="width:100%;padding:10px 12px;background:white;border:1px solid rgba(184,192,255,0.5);border-radius:8px;color:#313735;font-size:12px;cursor:pointer;outline:none;">';
    
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
    html += '<div style="font-size:10px;color:#7B8FA1;margin-top:6px;">选择游戏中AI使用的模型配置</div>';
    html += '</div>';
    
    // 游戏人数选择
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:16px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#313735;margin-bottom:12px;">游戏人数</div>';
    html += '<div id="player-count-selector" style="display:flex;flex-wrap:wrap;gap:8px;">';
    
    for (var num = 1; num <= maxPlayers; num++) {
        var isDefault = num === 1;
        var playerDesc = num === 1 ? '你 + 1个AI' : '你 + ' + num + '个AI';
        html += '<button class="mp-count-btn' + (isDefault ? ' active' : '') + '" data-count="' + num + '" style="flex:1;min-width:70px;padding:12px 8px;' + glassStyle + 'border-radius:10px;cursor:pointer;transition:all 0.3s;' + (isDefault ? 'border:2px solid #b8c0ff !important;' : '') + '">';
        html += '<div style="font-size:16px;font-weight:600;color:#313735;">' + (num + 1) + '人</div>';
        html += '<div style="font-size:9px;color:#7B8FA1;margin-top:2px;">' + playerDesc + '</div>';
        html += '</button>';
    }
    
    html += '</div>';
    html += '</div>';
    
    // 选择AI玩家
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:16px;">';
    html += '<div style="font-size:13px;font-weight:600;color:#313735;margin-bottom:12px;">选择AI对手 <span id="mp-selected-count" style="color:#7B8FA1;">(需选择 1 人)</span></div>';
    html += '<div id="mp-ai-list" style="max-height:200px;overflow-y:auto;">';
    
    group.members.forEach(function(memberId, index) {
        var ai = PhoneCore.getAI(memberId);
        if (!ai) return;
        
        var isSelected = index === 0;
        html += '<label class="mp-ai-checkbox" style="display:flex;align-items:center;padding:10px 12px;' + glassStyle + 'border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.3s;' + (isSelected ? 'border:2px solid #b8c0ff !important;' : '') + '">';
        html += '<input type="checkbox" name="mp-ai-player" value="' + memberId + '" ' + (isSelected ? 'checked' : '') + ' style="display:none;">';
        html += '<div style="width:36px;height:36px;border-radius:50%;background:' + self.getAvatarColor(memberId) + ';margin-right:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:500;">';
        if (ai.avatar) {
            html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += ai.name.charAt(0);
        }
        html += '</div>';
        html += '<div style="flex:1;color:#313735;font-size:13px;font-weight:500;">' + ai.name + '</div>';
        html += '<div class="mp-check-icon" style="width:22px;height:22px;border-radius:50%;background:' + (isSelected ? '#b8c0ff' : 'rgba(0,0,0,0.1)') + ';display:flex;align-items:center;justify-content:center;transition:all 0.3s;">';
        html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="opacity:' + (isSelected ? '1' : '0') + ';"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        html += '</div>';
        html += '</label>';
    });
    
    html += '</div>';
    html += '</div>';
    
    // 开始游戏按钮
    html += '<button id="start-monopoly-btn" style="width:100%;padding:16px;' + glassStyle + 'background:linear-gradient(135deg,rgba(184,192,255,0.8),rgba(200,182,255,0.8)) !important;border-radius:14px;color:#313735;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(184,192,255,0.4);display:flex;align-items:center;justify-content:center;gap:8px;">';
    html += '<span style="width:20px;height:20px;display:inline-flex;">' + MonopolySVG.game + '</span>';
    html += '<span>开始游戏</span>';
    html += '</button>';
    
    html += '</div>';
    
    var setupPage = this.openDetailPage(html, { title: '游戏设置', titleColor: '#313735', bgColor: '#F5F5F5' });
    
    var selectedTheme = 'ludo';
    var selectedPlayerCount = 1;
    
    // 主题选择
    setupPage.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.onclick = function() {
            setupPage.querySelectorAll('.theme-btn').forEach(function(b) {
                b.classList.remove('active');
                b.style.borderColor = 'rgba(255,255,255,0.3)';
            });
            btn.classList.add('active');
            btn.style.borderColor = '#b8c0ff';
            selectedTheme = btn.getAttribute('data-theme');
        };
    });
    
    // 人数选择
    setupPage.querySelectorAll('.mp-count-btn').forEach(function(btn) {
        btn.onclick = function() {
            setupPage.querySelectorAll('.mp-count-btn').forEach(function(b) {
                b.classList.remove('active');
                b.style.borderColor = 'rgba(255,255,255,0.3)';
            });
            btn.classList.add('active');
            btn.style.borderColor = '#b8c0ff';
            
            selectedPlayerCount = parseInt(btn.getAttribute('data-count'));
            setupPage.querySelector('#mp-selected-count').textContent = '(需选择 ' + selectedPlayerCount + ' 人)';
            updateMPAISelection();
        };
    });
    
    // 更新AI选择
    function updateMPAISelection() {
        var checkboxes = setupPage.querySelectorAll('input[name="mp-ai-player"]');
        checkboxes.forEach(function(cb, index) {
            var label = cb.closest('.mp-ai-checkbox');
            if (index < selectedPlayerCount) {
                cb.checked = true;
                label.style.borderColor = '#b8c0ff';
                label.querySelector('.mp-check-icon').style.background = '#b8c0ff';
                label.querySelector('svg').style.opacity = '1';
            } else {
                cb.checked = false;
                label.style.borderColor = 'rgba(255,255,255,0.3)';
                label.querySelector('.mp-check-icon').style.background = 'rgba(0,0,0,0.1)';
                label.querySelector('svg').style.opacity = '0';
            }
        });
    }
    
    // AI选择点击
    setupPage.querySelectorAll('.mp-ai-checkbox').forEach(function(label) {
        label.onclick = function(e) {
            e.preventDefault();
            var checkbox = label.querySelector('input');
            var currentChecked = setupPage.querySelectorAll('input[name="mp-ai-player"]:checked').length;
            
            if (checkbox.checked) {
                checkbox.checked = false;
                label.style.borderColor = 'rgba(255,255,255,0.3)';
                label.querySelector('.mp-check-icon').style.background = 'rgba(0,0,0,0.1)';
                label.querySelector('svg').style.opacity = '0';
            } else if (currentChecked < selectedPlayerCount) {
                checkbox.checked = true;
                label.style.borderColor = '#b8c0ff';
                label.querySelector('.mp-check-icon').style.background = '#b8c0ff';
                label.querySelector('svg').style.opacity = '1';
            }
        };
    });
    
    // 开始游戏
    setupPage.querySelector('#start-monopoly-btn').onclick = function() {
        var selectedAIs = [];
        setupPage.querySelectorAll('input[name="mp-ai-player"]:checked').forEach(function(cb) {
            selectedAIs.push(cb.value);
        });
        
        if (selectedAIs.length !== selectedPlayerCount) {
            PhoneCore.notifications.send({
                type: 'warning',
                title: '人数不符',
                message: '请选择 ' + selectedPlayerCount + ' 名AI参与游戏',
                size: 'mini'
            });
            return;
        }
        
        // 获取选择的API配置
        var apiSelect = setupPage.querySelector('#mp-api-select');
        var selectedApiConfig = apiSelect ? apiSelect.value : null;
        
        setupPage.querySelector('.app-back-btn').click();
        setTimeout(function() {
            self.startMonopolyGame(groupId, selectedTheme, selectedAIs, selectedApiConfig);
        }, 350);
    };
};

// 开始大富翁游戏
ChatApp.prototype.startMonopolyGame = function(groupId, theme, selectedAIs, apiConfigId) {
    var self = this;
    var group = this.getGroupChat(groupId);
    if (!group) return;
    
    // 初始化游戏状态
    this.monopolyGame = {
        id: 'mpgame_' + Date.now(),
        groupId: groupId,
        type: 'monopoly',
        theme: theme,
        apiConfigId: apiConfigId,
        players: [],
        currentPlayer: 0,
        round: 1,
        phase: 'rolling',
        boardContent: theme === 'ludo' ? LudoBoardContent : TruthDareBoardContent,
        chatHistory: [],
        startTime: Date.now(),
        isRolling: false,
        lastDiceValue: 0,
        wheelValue: 0,
        skipNextTurn: {} // 记录需要跳过回合的玩家
    };
    
    var game = this.monopolyGame;
    
    // 添加用户玩家
    game.players.push({
        id: 'user',
        name: PhoneCore.user.name || '你',
        avatar: PhoneCore.user.avatar || null,
        position: 0,
        rounds: 0,
        steps: 0,
        isAI: false,
        color: MonopolyColors.player1Glow
    });
    
    // 添加AI玩家
    var playerColors = [
        MonopolyColors.player2Glow,
        'rgba(200, 182, 255, 0.8)',
        'rgba(255, 214, 255, 0.8)'
    ];
    
    selectedAIs.forEach(function(aiId, index) {
        var ai = PhoneCore.getAI(aiId);
        if (ai) {
            game.players.push({
                id: aiId,
                name: ai.name,
                avatar: ai.avatar || null,
                position: 0,
                rounds: 0,
                steps: 0,
                isAI: true,
                color: playerColors[index % playerColors.length]
            });
        }
    });
    
    // 打开游戏界面
    this.openMonopolyGameUI();
};

// 获取大富翁游戏的API配置ID
ChatApp.prototype.getMonopolyApiConfigId = function() {
    var game = this.monopolyGame;
    if (!game) return null;
    
    var apiConfigId = game.apiConfigId;
    if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
        var configIds = Object.keys(PhoneCore.api.configs);
        apiConfigId = configIds.length > 0 ? configIds[0] : null;
    }
    return apiConfigId;
};

// 大富翁游戏界面
ChatApp.prototype.openMonopolyGameUI = function() {
    var self = this;
    var game = this.monopolyGame;
    if (!game) return;
    
    var glassStyle = 'background:rgba(255,255,255,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.3);';
    
    var html = '<div class="monopoly-game" style="padding:12px;background:linear-gradient(180deg,#F5F5F5 0%,#E8E4E1 100%);min-height:100%;overflow-y:auto;">';
    
    // 注入CSS动画和隐藏滚动条
    html += '<style>';
    html += '@keyframes mpRoll { 0% { transform: rotateX(0deg) rotateY(0deg); } 100% { transform: rotateX(360deg) rotateY(720deg); } }';
    html += '@keyframes mpSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    html += '@keyframes mpPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }';
    html += '@keyframes mpGlow { 0%, 100% { box-shadow: 0 0 10px var(--glow-color); } 50% { box-shadow: 0 0 25px var(--glow-color); } }';
    html += '@keyframes mpBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }';
    html += '@keyframes mpFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }';
    html += '.mp-rolling { animation: mpRoll 1.5s ease; }';
    html += '.mp-cell-active { animation: mpGlow 1s ease-in-out infinite; }';
    html += '.mp-bounce { animation: mpBounce 0.5s ease; }';
    html += '.monopoly-game::-webkit-scrollbar { display: none; }';
    html += '.monopoly-game { -ms-overflow-style: none; scrollbar-width: none; }';
    html += '#mp-ai-list::-webkit-scrollbar { display: none; }';
    html += '#mp-ai-list { -ms-overflow-style: none; scrollbar-width: none; }';
    html += '#mp-event-log::-webkit-scrollbar { display: none; }';
    html += '#mp-event-log { -ms-overflow-style: none; scrollbar-width: none; }';
    html += '</style>';
    
    // 当前玩家指示
    html += '<div style="' + glassStyle + 'border-radius:12px;padding:12px;margin-bottom:12px;text-align:center;">';
    html += '<div id="mp-turn-indicator" style="font-size:14px;font-weight:600;color:#313735;display:flex;align-items:center;justify-content:center;gap:6px;">';
    html += '<span style="width:16px;height:16px;display:inline-flex;">' + MonopolySVG.target + '</span>';
    html += '<span>' + game.players[game.currentPlayer].name + ' 的回合</span>';
    html += '</div>';
    html += '<div style="font-size:11px;color:#7B8FA1;margin-top:4px;">第 ' + game.round + ' 轮</div>';
    html += '</div>';
    
    // 大富翁地图卡片
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:12px;margin-bottom:12px;">';
    html += '<div style="font-size:12px;font-weight:600;color:#313735;margin-bottom:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px;">';
    html += '<span style="width:14px;height:14px;display:inline-flex;">' + (game.theme === 'ludo' ? MonopolySVG.plane : MonopolySVG.chat) + '</span>';
    html += '<span>' + (game.theme === 'ludo' ? '飞行棋地图' : '真心话大冒险') + '</span>';
    html += '</div>';
    html += '<div id="mp-board" class="monopoly-board" style="display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(6,1fr);gap:3px;aspect-ratio:1;">';
    html += this.renderMonopolyBoard();
    html += '</div>';
    html += '</div>';
    
    // 数字转盘卡片
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:12px;">';
    html += '<div style="font-size:12px;font-weight:600;color:#313735;margin-bottom:12px;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px;">';
    html += '<span style="width:14px;height:14px;display:inline-flex;">' + MonopolySVG.wheel + '</span>';
    html += '<span>转盘</span>';
    html += '</div>';
    html += '<div id="mp-wheel-container" style="position:relative;width:300px;height:300px;margin:0 auto;">';
    html += this.renderMonopolyWheel();
    html += '</div>';
    html += '</div>';
    
    // 骰子卡片
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:12px;">';
    html += '<div style="font-size:12px;font-weight:600;color:#313735;margin-bottom:12px;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px;">';
    html += '<span style="width:14px;height:14px;display:inline-flex;">' + MonopolySVG.dice + '</span>';
    html += '<span>掷骰子</span>';
    html += '</div>';
    html += '<div id="mp-dice-container" style="display:flex;justify-content:center;gap:30px;padding:20px 0;perspective:600px;">';
    html += this.renderMonopolyDice(1) + this.renderMonopolyDice(2);
    html += '</div>';
    html += '<div style="text-align:center;margin-top:10px;">';
    html += '<button id="mp-roll-btn" style="padding:12px 40px;' + glassStyle + 'background:linear-gradient(135deg,rgba(184,192,255,0.9),rgba(200,182,255,0.9)) !important;border-radius:25px;color:#313735;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.3s;display:inline-flex;align-items:center;gap:8px;">';
    html += '<span style="width:18px;height:18px;display:inline-flex;">' + MonopolySVG.dice + '</span>';
    html += '<span>掷骰子</span>';
    html += '</button>';
    html += '</div>';
    html += '</div>';
    
    // 玩家状态卡片
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:12px;">';
    html += '<div style="font-size:12px;font-weight:600;color:#313735;margin-bottom:12px;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px;">';
    html += '<span style="width:14px;height:14px;display:inline-flex;">' + MonopolySVG.stats + '</span>';
    html += '<span>游戏记录</span>';
    html += '</div>';
    html += '<div id="mp-players-stats" style="display:flex;flex-direction:column;gap:10px;">';
    html += this.renderMonopolyPlayersStats();
    html += '</div>';
    html += '</div>';
    
    // 事件消息区域
    html += '<div style="' + glassStyle + 'border-radius:16px;padding:16px;margin-bottom:12px;">';
    html += '<div style="font-size:12px;font-weight:600;color:#313735;margin-bottom:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px;">';
    html += '<span style="width:14px;height:14px;display:inline-flex;">' + MonopolySVG.log + '</span>';
    html += '<span>游戏日志</span>';
    html += '</div>';
    html += '<div id="mp-event-log" style="max-height:150px;overflow-y:auto;font-size:12px;color:#7B8FA1;">';
    html += '<div style="text-align:center;padding:10px;color:#aaa;">游戏开始!</div>';
    html += '</div>';
    html += '</div>';
    
    // 重置按钮
    html += '<button id="mp-reset-btn" style="width:100%;padding:14px;' + glassStyle + 'border-radius:12px;color:#7B8FA1;font-size:13px;cursor:pointer;transition:all 0.3s;display:flex;align-items:center;justify-content:center;gap:8px;">';
    html += '<span style="width:16px;height:16px;display:inline-flex;">' + MonopolySVG.reset + '</span>';
    html += '<span>重置游戏</span>';
    html += '</button>';
    
    html += '</div>';
    
    var gamePage = this.openDetailPage(html, { 
        title: '大富翁', 
        titleColor: '#313735', 
        bgColor: '#F5F5F5' 
    });
    
    this.monopolyGamePage = gamePage;
    
    // 绑定事件
    this.bindMonopolyEvents(gamePage);
    
    // 添加初始日志
    this.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.game + '</span> 游戏开始! ' + game.players.map(function(p) { return p.name; }).join('、') + ' 参与游戏');
    this.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.target + '</span> ' + game.players[0].name + ' 先手');
};

// 渲染大富翁地图
ChatApp.prototype.renderMonopolyBoard = function() {
    var game = this.monopolyGame;
    if (!game) return '';
    
    var html = '';
    var colors = MonopolyColors.colors;
    
    // 创建格子位置映射（环形）
    var positions = [];
    
    // 上排 (0-5)
    for (var i = 0; i < 6; i++) {
        positions.push({ x: i, y: 0, index: i });
    }
    // 右侧 (6-9)
    for (var i = 1; i < 5; i++) {
        positions.push({ x: 5, y: i, index: 5 + i });
    }
    // 下排 (10-15) 反向
    for (var i = 5; i >= 0; i--) {
        positions.push({ x: i, y: 5, index: 15 - i });
    }
    // 左侧 (16-19) 反向
    for (var i = 4; i >= 1; i--) {
        positions.push({ x: 0, y: i, index: 19 - i + 1 });
    }
    
    positions = positions.slice(0, 20);
    
    // 创建6x6网格的所有位置
    var grid = {};
    positions.forEach(function(pos, idx) {
        grid[pos.x + ',' + pos.y] = idx;
    });
    
    // 渲染6x6网格
    for (var y = 0; y < 6; y++) {
        for (var x = 0; x < 6; x++) {
            var key = x + ',' + y;
            var cellIndex = grid[key];
            
            if (cellIndex !== undefined) {
                var isActive = false;
                var activePlayer = null;
                
                game.players.forEach(function(player, pIdx) {
                    if (player.position === cellIndex) {
                        isActive = true;
                        activePlayer = player;
                    }
                });
                
                var cellColor = colors[cellIndex % colors.length];
                var glowStyle = isActive ? '--glow-color:' + activePlayer.color + ';' : '';
                
                html += '<div class="mp-cell' + (isActive ? ' mp-cell-active' : '') + '" data-index="' + cellIndex + '" style="' + glowStyle + 'position:relative;border-radius:6px;background:' + cellColor + ';display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2px;text-align:center;transition:all 0.3s;cursor:pointer;min-height:0;">';
                html += '<div style="font-weight:bold;font-size:10px;color:#313735;">' + (cellIndex + 1) + '</div>';
                html += '<div style="font-size:7px;color:#555;word-break:break-all;line-height:1.1;">' + game.boardContent[cellIndex] + '</div>';
                
                if (isActive) {
                    var playerMarkers = '';
                    game.players.forEach(function(player, pIdx) {
                        if (player.position === cellIndex) {
                            playerMarkers += '<div style="width:12px;height:12px;border-radius:50%;background:' + player.color + ';border:1px solid white;font-size:6px;display:flex;align-items:center;justify-content:center;color:white;">' + (pIdx + 1) + '</div>';
                        }
                    });
                    html += '<div style="position:absolute;top:2px;right:2px;display:flex;gap:1px;">' + playerMarkers + '</div>';
                }
                
                html += '</div>';
            } else {
                html += '<div style="background:rgba(255,255,255,0.3);border-radius:6px;"></div>';
            }
        }
    }
    
    return html;
};

// 渲染数字转盘
ChatApp.prototype.renderMonopolyWheel = function() {
    var game = this.monopolyGame;
    var html = '';
    
    html += '<div id="mp-center-circle" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.4);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.5);box-shadow:0 8px 32px rgba(0,0,0,0.1);display:flex;justify-content:center;align-items:center;font-size:24px;font-weight:bold;color:#313735;z-index:10;transition:transform 0.5s ease;">';
    html += game.wheelValue || '0';
    html += '</div>';
    
    for (var i = 0; i < 6; i++) {
        var angle = (i * 60) * (Math.PI / 180);
        var radius = 100;
        var x = radius * Math.cos(angle);
        var y = radius * Math.sin(angle);
        
        html += '<div class="mp-wheel-num" data-value="' + (i + 1) + '" style="position:absolute;left:calc(50% + ' + x + 'px - 30px);top:calc(50% + ' + y + 'px - 30px);width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.25);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.3);box-shadow:0 4px 6px rgba(0,0,0,0.1);display:flex;justify-content:center;align-items:center;font-weight:bold;font-size:18px;color:#313735;transition:all 0.5s ease;transform-origin:center;">';
        html += (i + 1);
        html += '</div>';
    }
    
    return html;
};

// 渲染3D骰子
ChatApp.prototype.renderMonopolyDice = function(diceId) {
    var html = '<div id="mp-dice-' + diceId + '" class="mp-dice" style="width:60px;height:60px;position:relative;transform-style:preserve-3d;transition:transform 1.5s ease;cursor:pointer;">';
    
    var faces = [
        { dots: 1, transform: 'translateZ(30px)' },
        { dots: 6, transform: 'rotateY(180deg) translateZ(30px)' },
        { dots: 3, transform: 'rotateY(90deg) translateZ(30px)' },
        { dots: 4, transform: 'rotateY(-90deg) translateZ(30px)' },
        { dots: 2, transform: 'rotateX(90deg) translateZ(30px)' },
        { dots: 5, transform: 'rotateX(-90deg) translateZ(30px)' }
    ];
    
    faces.forEach(function(face) {
        html += '<div class="mp-dice-face" style="position:absolute;width:100%;height:100%;border-radius:8px;background:rgba(255,255,255,0.9);backdrop-filter:blur(5px);display:flex;justify-content:center;align-items:center;box-shadow:inset 0 0 8px rgba(0,0,0,0.1);border:1px solid rgba(255,255,255,0.5);transform:' + face.transform + ';">';
        html += renderDots(face.dots);
        html += '</div>';
    });
    
    html += '</div>';
    
    function renderDots(count) {
        var dotHtml = '';
        var dotStyle = 'width:10px;height:10px;border-radius:50%;background:#313735;position:absolute;';
        
        var positions = {
            1: [[0, 0]],
            2: [[-15, -15], [15, 15]],
            3: [[-15, -15], [0, 0], [15, 15]],
            4: [[-15, -15], [15, -15], [-15, 15], [15, 15]],
            5: [[-15, -15], [15, -15], [0, 0], [-15, 15], [15, 15]],
            6: [[-15, -15], [15, -15], [-15, 0], [15, 0], [-15, 15], [15, 15]]
        };
        
        positions[count].forEach(function(pos) {
            dotHtml += '<div style="' + dotStyle + 'transform:translate(' + pos[0] + 'px,' + pos[1] + 'px);"></div>';
        });
        
        return dotHtml;
    }
    
    return html;
};

// 渲染玩家状态
ChatApp.prototype.renderMonopolyPlayersStats = function() {
    var game = this.monopolyGame;
    if (!game) return '';
    
    var html = '';
    var self = this;
    
    game.players.forEach(function(player, index) {
        var isCurrentPlayer = index === game.currentPlayer;
        var borderStyle = isCurrentPlayer ? 'border-left:4px solid ' + player.color + ';' : 'border-left:4px solid transparent;';
        
        html += '<div class="mp-player-stat" style="display:flex;align-items:center;padding:10px 12px;background:rgba(255,255,255,0.5);border-radius:10px;' + borderStyle + 'transition:all 0.3s;">';
        
        html += '<div style="width:32px;height:32px;border-radius:50%;background:' + (player.avatar ? 'transparent' : self.getAvatarColor(player.id)) + ';margin-right:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;border:2px solid ' + player.color + ';">';
        if (player.avatar) {
            html += '<img src="' + player.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += player.name.charAt(0);
        }
        html += '</div>';
        
        html += '<div style="flex:1;">';
        html += '<div style="font-size:13px;font-weight:600;color:#313735;display:flex;align-items:center;gap:4px;">';
        html += '<span>' + player.name + '</span>';
        html += '<span style="width:14px;height:14px;display:inline-flex;">' + (player.isAI ? MonopolySVG.robot : MonopolySVG.user) + '</span>';
        html += '</div>';
        html += '<div style="font-size:10px;color:#7B8FA1;">位置: ' + (player.position + 1) + '</div>';
        html += '</div>';
        
        html += '<div style="text-align:right;">';
        html += '<div style="font-size:14px;font-weight:bold;color:#313735;">' + player.steps + '</div>';
        html += '<div style="font-size:9px;color:#7B8FA1;">总步数</div>';
        html += '</div>';
        
        html += '</div>';
    });
    
    return html;
};

// 绑定游戏事件
ChatApp.prototype.bindMonopolyEvents = function(gamePage) {
    var self = this;
    var game = this.monopolyGame;
    
    var rollBtn = gamePage.querySelector('#mp-roll-btn');
    if (rollBtn) {
        rollBtn.onclick = function() {
            if (game.isRolling) return;
            
            var currentPlayer = game.players[game.currentPlayer];
            if (currentPlayer.isAI) {
                self.showToast('等待AI掷骰子...');
                return;
            }
            
            self.rollMonopolyDice();
        };
    }
    
    var resetBtn = gamePage.querySelector('#mp-reset-btn');
    if (resetBtn) {
        resetBtn.onclick = function() {
            if (confirm('确定要重置游戏吗?')) {
                self.resetMonopolyGame();
            }
        };
    }
};

// 掷骰子
ChatApp.prototype.rollMonopolyDice = function() {
    var self = this;
    var game = this.monopolyGame;
    var gamePage = this.monopolyGamePage;
    if (!game || !gamePage || game.isRolling) return;
    
    game.isRolling = true;
    
    var dice1 = gamePage.querySelector('#mp-dice-1');
    var dice2 = gamePage.querySelector('#mp-dice-2');
    var rollBtn = gamePage.querySelector('#mp-roll-btn');
    
    var currentPlayerIndex = game.currentPlayer;
    var currentDice = currentPlayerIndex === 0 ? dice1 : dice2;
    
    if (rollBtn) {
        rollBtn.style.opacity = '0.5';
        rollBtn.style.pointerEvents = 'none';
    }
    
    if (currentDice) currentDice.classList.add('mp-rolling');
    
    var result = Math.floor(Math.random() * 6) + 1;
    
    setTimeout(function() {
        if (currentDice) currentDice.classList.remove('mp-rolling');
        
        self.setDiceFace(currentDice, result);
        
        game.wheelValue = result;
        self.animateWheel(result);
        
        game.lastDiceValue = result;
        
        var currentPlayer = game.players[game.currentPlayer];
        self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.dice + '</span> ' + currentPlayer.name + ' 掷出了 ' + result);
        
        setTimeout(function() {
            self.moveMonopolyPlayer(result);
        }, 800);
        
    }, 1500);
};

// 设置骰子面
ChatApp.prototype.setDiceFace = function(dice, value) {
    if (!dice) return;
    
    var rotations = {
        1: 'rotateX(0deg) rotateY(0deg)',
        2: 'rotateX(-90deg) rotateY(0deg)',
        3: 'rotateX(0deg) rotateY(-90deg)',
        4: 'rotateX(0deg) rotateY(90deg)',
        5: 'rotateX(90deg) rotateY(0deg)',
        6: 'rotateX(0deg) rotateY(180deg)'
    };
    
    dice.style.transform = rotations[value] || rotations[1];
};

// 转盘动画
ChatApp.prototype.animateWheel = function(value) {
    var gamePage = this.monopolyGamePage;
    if (!gamePage) return;
    
    var centerCircle = gamePage.querySelector('#mp-center-circle');
    var wheelContainer = gamePage.querySelector('#mp-wheel-container');
    var wheelNums = gamePage.querySelectorAll('.mp-wheel-num');
    
    var displayValue = value;
    var targetNum = value % 6 === 0 ? 6 : value % 6;
    
    wheelNums.forEach(function(num) {
        num.style.transition = 'transform 1s ease-out';
    });
    
    var rotateStyle = document.createElement('style');
    rotateStyle.id = 'mp-rotate-style';
    rotateStyle.textContent = '@keyframes mpRotateWheel { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .mp-rotating { animation: mpRotateWheel 1s ease-out forwards; }';
    gamePage.appendChild(rotateStyle);
    
    if (wheelContainer) {
        wheelContainer.classList.add('mp-rotating');
    }
    
    setTimeout(function() {
        if (wheelContainer) {
            wheelContainer.classList.remove('mp-rotating');
        }
        
        var targetCircle = null;
        wheelNums.forEach(function(num) {
            if (parseInt(num.getAttribute('data-value')) === targetNum) {
                targetCircle = num;
            }
        });
        
        if (targetCircle && wheelContainer) {
            var rect = targetCircle.getBoundingClientRect();
            var containerRect = wheelContainer.getBoundingClientRect();
            
            var initialX = rect.left - containerRect.left + rect.width / 2 - containerRect.width / 2;
            var initialY = rect.top - containerRect.top + rect.height / 2 - containerRect.height / 2;
            
            var movingNumber = targetCircle.cloneNode(true);
            movingNumber.style.position = 'absolute';
            movingNumber.style.left = '50%';
            movingNumber.style.top = '50%';
            movingNumber.style.transform = 'translate(' + initialX + 'px, ' + initialY + 'px)';
            movingNumber.style.setProperty('--initial-x', initialX + 'px');
            movingNumber.style.setProperty('--initial-y', initialY + 'px');
            movingNumber.style.zIndex = '20';
            
            var moveStyle = document.createElement('style');
            moveStyle.id = 'mp-move-style';
            moveStyle.textContent = '@keyframes mpMoveToCenter { 0% { transform: translate(var(--initial-x), var(--initial-y)) scale(1); opacity: 1; } 50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.8; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } } .mp-moving-to-center { animation: mpMoveToCenter 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }';
            gamePage.appendChild(moveStyle);
            
            movingNumber.classList.add('mp-moving-to-center');
            wheelContainer.appendChild(movingNumber);
            
            targetCircle.style.opacity = '0';
            
            if (centerCircle) {
                centerCircle.style.opacity = '0';
                centerCircle.textContent = displayValue;
            }
            
            setTimeout(function() {
                movingNumber.remove();
                targetCircle.style.opacity = '1';
                
                if (centerCircle) {
                    var popStyle = document.createElement('style');
                    popStyle.id = 'mp-pop-style';
                    popStyle.textContent = '@keyframes mpPopFromCenter { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } } .mp-pop-center { animation: mpPopFromCenter 0.5s ease-out forwards; }';
                    gamePage.appendChild(popStyle);
                    
                    centerCircle.classList.add('mp-pop-center');
                    centerCircle.style.opacity = '1';
                    
                    setTimeout(function() {
                        centerCircle.classList.remove('mp-pop-center');
                        var oldStyles = gamePage.querySelectorAll('#mp-rotate-style, #mp-move-style, #mp-pop-style');
                        oldStyles.forEach(function(s) { s.remove(); });
                    }, 500);
                }
            }, 800);
        } else {
            if (centerCircle) {
                centerCircle.textContent = displayValue;
            }
        }
    }, 1000);
};

// 移动玩家
ChatApp.prototype.moveMonopolyPlayer = function(steps) {
    var self = this;
    var game = this.monopolyGame;
    var gamePage = this.monopolyGamePage;
    if (!game || !gamePage) return;
    
    var currentPlayer = game.players[game.currentPlayer];
    var oldPosition = currentPlayer.position;
    var newPosition = (oldPosition + steps) % 20;
    
    if (newPosition < oldPosition) {
        currentPlayer.rounds++;
        self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.celebrate + '</span> ' + currentPlayer.name + ' 完成了第 ' + currentPlayer.rounds + ' 圈!');
    }
    
    currentPlayer.position = newPosition;
    currentPlayer.steps += steps;
    
    var boardContainer = gamePage.querySelector('#mp-board');
    if (boardContainer) {
        boardContainer.innerHTML = self.renderMonopolyBoard();
    }
    
    var statsContainer = gamePage.querySelector('#mp-players-stats');
    if (statsContainer) {
        statsContainer.innerHTML = self.renderMonopolyPlayersStats();
    }
    
    setTimeout(function() {
        self.triggerMonopolyCellEvent(newPosition);
    }, 500);
};

// 触发格子事件
ChatApp.prototype.triggerMonopolyCellEvent = function(position) {
    var self = this;
    var game = this.monopolyGame;
    if (!game) return;
    
    var currentPlayer = game.players[game.currentPlayer];
    var cellContent = game.boardContent[position];
    
    self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.pin + '</span> ' + currentPlayer.name + ' 到达【' + cellContent + '】');
    
    if (game.theme === 'truth_dare') {
        self.handleTruthDareEvent(cellContent, currentPlayer);
    } else {
        self.handleLudoEvent(cellContent, currentPlayer, position);
    }
};

// 处理真心话大冒险事件 - 全部使用AI生成
ChatApp.prototype.handleTruthDareEvent = function(cellContent, player) {
    var self = this;
    var game = this.monopolyGame;
    
    if (cellContent === '真心话') {
        // 用AI生成真心话问题
        self.generateMonopolyAIContent('truth_question', player, function(question) {
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.question + '</span> 真心话: ' + question);
            
            if (player.isAI) {
                // AI用AI生成回答
                self.generateMonopolyAIContent('truth_answer', player, function(answer) {
                    self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.chat + '</span> ' + player.name + ': ' + answer);
                    self.endMonopolyTurn();
                }, question);
            } else {
                self.showMonopolyDialog('真心话', question, function() {
                    self.endMonopolyTurn();
                });
            }
        });
    } else if (cellContent === '大冒险') {
        // 用AI生成大冒险任务
        self.generateMonopolyAIContent('dare_challenge', player, function(challenge) {
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.mask + '</span> 大冒险: ' + challenge);
            
            if (player.isAI) {
                // AI用AI生成完成挑战的反应
                self.generateMonopolyAIContent('dare_response', player, function(response) {
                    self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.star + '</span> ' + player.name + ': ' + response);
                    self.endMonopolyTurn();
                }, challenge);
            } else {
                self.showMonopolyDialog('大冒险', challenge, function() {
                    self.endMonopolyTurn();
                });
            }
        });
    } else if (cellContent === '双倍挑战') {
        self.generateMonopolyAIContent('double_challenge', player, function(content) {
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.thunder + '</span> 双倍挑战: ' + content);
            if (player.isAI) {
                self.generateMonopolyAIContent('double_response', player, function(response) {
                    self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.star + '</span> ' + player.name + ': ' + response);
                    self.endMonopolyTurn();
                }, content);
            } else {
                self.showMonopolyDialog('双倍挑战', content, function() {
                    self.endMonopolyTurn();
                });
            }
        });
    } else if (cellContent === '终极挑战') {
        self.generateMonopolyAIContent('ultimate_challenge', player, function(content) {
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.thunder + '</span> 终极挑战: ' + content);
            if (player.isAI) {
                self.generateMonopolyAIContent('ultimate_response', player, function(response) {
                    self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.star + '</span> ' + player.name + ': ' + response);
                    self.endMonopolyTurn();
                }, content);
            } else {
                self.showMonopolyDialog('终极挑战', content, function() {
                    self.endMonopolyTurn();
                });
            }
        });
    } else if (cellContent === '自由选择') {
        if (player.isAI) {
            var choice = Math.random() > 0.5 ? '真心话' : '大冒险';
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.star + '</span> ' + player.name + ' 选择了' + choice);
            self.handleTruthDareEvent(choice, player);
        } else {
            self.showMonopolyChoiceDialog('自由选择', '请选择真心话或大冒险', ['真心话', '大冒险'], function(choice) {
                self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.star + '</span> ' + player.name + ' 选择了' + choice);
                self.handleTruthDareEvent(choice, player);
            });
        }
    } else if (cellContent === '交换任务') {
        // 随机选一个其他玩家交换位置
        var otherPlayers = game.players.filter(function(p) { return p.id !== player.id; });
        if (otherPlayers.length > 0) {
            var target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
            var tempPos = player.position;
            player.position = target.position;
            target.position = tempPos;
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.star + '</span> ' + player.name + ' 和 ' + target.name + ' 交换了位置!');
            self.updateMonopolyUI();
        }
        self.endMonopolyTurn();
    } else {
        // 起点、跳过等
        self.endMonopolyTurn();
    }
};

// AI内容生成核心方法
ChatApp.prototype.generateMonopolyAIContent = function(type, player, callback, context) {
    var self = this;
    var game = this.monopolyGame;
    if (!game) { if (callback) callback('(游戏已结束)'); return; }
    
    var apiConfigId = this.getMonopolyApiConfigId();
    if (!apiConfigId) {
        // 无API配置时的简单回退
        console.error('[大富翁] 无可用API配置');
        if (callback) callback('(未配置AI模型)');
        return;
    }
    
    var ai = player.isAI ? PhoneCore.getAI(player.id) : null;
    var playerNames = game.players.map(function(p) { return p.name; }).join('、');
    var recentLogs = game.chatHistory.slice(-8).map(function(h) { return h.message.replace(/<[^>]*>/g, ''); }).join('\n');
    
    var systemPrompt = '你正在参与一个大富翁游戏。';
    systemPrompt += '\n参与玩家: ' + playerNames;
    systemPrompt += '\n当前是第' + game.round + '轮。';
    systemPrompt += '\n当前玩家: ' + player.name;
    if (ai && ai.personality) {
        systemPrompt += '\n\n你的人设: ' + ai.personality;
    }
    systemPrompt += '\n\n最近游戏记录:\n' + (recentLogs || '暂无');
    systemPrompt += '\n\n【重要规则】';
    systemPrompt += '\n1. 不要使用任何emoji或表情符号';
    systemPrompt += '\n2. 回复要简短自然，符合游戏氛围';
    systemPrompt += '\n3. 直接输出内容，不要加任何前缀';
    
    var userPrompt = '';
    
    switch (type) {
        case 'truth_question':
            userPrompt = '请生成一个有趣的真心话问题，适合朋友之间玩的，1-2句话即可。不要重复之前出现过的问题。';
            break;
        case 'truth_answer':
            systemPrompt += '\n你是' + player.name + '，请用你的性格和口吻回答这个真心话问题。';
            userPrompt = '真心话问题: "' + context + '"\n请用1-3句话回答这个问题，要真诚有趣。';
            break;
        case 'dare_challenge':
            userPrompt = '请生成一个有趣的大冒险任务，适合朋友之间玩的，不要太过分，1-2句话描述任务即可。';
            break;
        case 'dare_response':
            systemPrompt += '\n你是' + player.name + '，你刚完成了一个大冒险任务。';
            userPrompt = '大冒险任务: "' + context + '"\n请用1-2句话描述你完成这个任务的过程或感受。';
            break;
        case 'double_challenge':
            userPrompt = '请生成一个双倍挑战任务，比普通挑战更有难度但依然有趣，2-3句话描述。';
            break;
        case 'double_response':
            systemPrompt += '\n你是' + player.name + '，你刚完成了一个双倍挑战。';
            userPrompt = '双倍挑战: "' + context + '"\n请用1-2句话描述你完成挑战的反应。';
            break;
        case 'ultimate_challenge':
            userPrompt = '请生成一个终极挑战任务，是最高难度的有趣挑战，2-3句话描述。';
            break;
        case 'ultimate_response':
            systemPrompt += '\n你是' + player.name + '，你刚完成了终极挑战。';
            userPrompt = '终极挑战: "' + context + '"\n请用1-2句话描述你完成挑战的反应。';
            break;
        case 'ludo_event':
            systemPrompt += '\n你是' + player.name + '，你在飞行棋中遇到了一个事件。';
            userPrompt = '你踩到了【' + context + '】格子。请用1句话表达你的反应。';
            break;
        case 'ludo_comment':
            systemPrompt += '\n你是' + player.name + '，你在观看飞行棋游戏。';
            userPrompt = '游戏中发生了: ' + context + '\n请用1句话发表你的看法或吐槽。';
            break;
        default:
            userPrompt = context || '请说一句话。';
    }
    
    var messages = [
        { role: 'user', content: userPrompt }
    ];
    
    var configuredMaxTokens = self.getApiMaxTokens ? self.getApiMaxTokens(apiConfigId, 500) : 500;
    
    PhoneCore.api.call(systemPrompt, apiConfigId, {
        messages: messages,
        maxTokens: configuredMaxTokens,
        temperature: 0.9
    }).then(function(response) {
        var content = (response.content || response || '').toString().trim();
        // 清理前缀
        content = content.replace(/^["'`]|["'`]$/g, '');
        content = content.replace(/^(回答|回复|反应|描述|问题)[：:]\s*/i, '');
        
        // 去除所有emoji
        content = self.removeEmoji(content);
        
        if (content && content.length >= 2) {
            if (callback) callback(content);
        } else {
            console.error('[大富翁] AI返回内容为空，类型:', type);
            if (callback) callback('(AI思考中...)');
        }
    }).catch(function(err) {
        console.error('[大富翁] AI生成失败:', type, err);
        if (callback) callback('(网络异常，请稍后)');
    });
};

// 去除emoji的工具方法
ChatApp.prototype.removeEmoji = function(text) {
    if (!text) return text;
    // 移除常见emoji范围
    return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{20E3}]|[\u{FE0F}]|[\u{E0020}-\u{E007F}]/gu, '').trim();
};

// 处理飞行棋事件 - 增加AI评论
ChatApp.prototype.handleLudoEvent = function(cellContent, player, position) {
    var self = this;
    var game = this.monopolyGame;
    
    var moveAmount = 0;
    var message = '';
    var shouldSkipTurn = false;
    
    switch (cellContent) {
        case '前进1格':
            moveAmount = 1;
            message = '向前移动1格!';
            break;
        case '前进2格':
            moveAmount = 2;
            message = '向前移动2格!';
            break;
        case '前进3格':
            moveAmount = 3;
            message = '向前移动3格!';
            break;
        case '后退1格':
            moveAmount = -1;
            message = '后退1格!';
            break;
        case '后退2格':
            moveAmount = -2;
            message = '后退2格!';
            break;
        case '休息一回':
        case '停一回合':
            message = '需要休息一回合';
            shouldSkipTurn = true;
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.sleep + '</span> ' + player.name + ' 需要休息一回合');
            break;
        case '幸运卡':
            moveAmount = Math.floor(Math.random() * 3) + 1;
            message = '幸运! 前进' + moveAmount + '格!';
            break;
        case '陷阱':
            moveAmount = -(Math.floor(Math.random() * 2) + 1);
            message = '踩到陷阱! 后退' + Math.abs(moveAmount) + '格!';
            break;
        case '随机事件':
            moveAmount = Math.floor(Math.random() * 5) - 2;
            if (moveAmount > 0) {
                message = '随机事件: 前进' + moveAmount + '格!';
            } else if (moveAmount < 0) {
                message = '随机事件: 后退' + Math.abs(moveAmount) + '格!';
            } else {
                message = '随机事件: 原地不动';
            }
            break;
        case '交换位置':
            var otherPlayers = game.players.filter(function(p) { return p.id !== player.id; });
            if (otherPlayers.length > 0) {
                var target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
                var tempPos = player.position;
                player.position = target.position;
                target.position = tempPos;
                message = player.name + ' 和 ' + target.name + ' 交换了位置!';
            }
            break;
        case '传送门':
            var newPos = Math.floor(Math.random() * 20);
            player.position = newPos;
            message = '传送门! 传送到第 ' + (newPos + 1) + ' 格!';
            break;
        case '加速':
            moveAmount = Math.floor(Math.random() * 3) + 2;
            message = '加速! 前进' + moveAmount + '格!';
            break;
        case '减速':
            moveAmount = -(Math.floor(Math.random() * 2) + 1);
            message = '减速! 后退' + Math.abs(moveAmount) + '格!';
            break;
        case '保护罩':
            message = '获得保护罩，下次陷阱无效';
            player.hasShield = true;
            break;
        case '炸弹':
            if (player.hasShield) {
                message = '保护罩抵消了炸弹!';
                player.hasShield = false;
            } else {
                moveAmount = -3;
                message = '踩到炸弹! 后退3格!';
            }
            break;
        case '双倍奖励':
            moveAmount = game.lastDiceValue;
            message = '双倍奖励! 再前进' + moveAmount + '格!';
            break;
        case '安全区':
            message = '安全区，安全休息';
            break;
    }
    
    if (shouldSkipTurn) {
        game.skipNextTurn[player.id] = true;
    }
    
    if (message) {
        self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.star + '</span> ' + message);
    }
    
    // AI玩家对事件发表评论
    if (player.isAI && message) {
        self.generateMonopolyAIContent('ludo_event', player, function(comment) {
            self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.chat + '</span> ' + player.name + ': ' + comment);
        }, cellContent);
    }
    
    if (moveAmount !== 0) {
        setTimeout(function() {
            var newPos = (player.position + moveAmount + 20) % 20;
            player.position = newPos;
            player.steps += Math.abs(moveAmount);
            
            self.updateMonopolyUI();
            self.endMonopolyTurn();
        }, 1000);
    } else {
        self.endMonopolyTurn();
    }
};

// 更新游戏UI
ChatApp.prototype.updateMonopolyUI = function() {
    var gamePage = this.monopolyGamePage;
    if (!gamePage) return;
    
    var boardContainer = gamePage.querySelector('#mp-board');
    if (boardContainer) {
        boardContainer.innerHTML = this.renderMonopolyBoard();
    }
    var statsContainer = gamePage.querySelector('#mp-players-stats');
    if (statsContainer) {
        statsContainer.innerHTML = this.renderMonopolyPlayersStats();
    }
};

// 显示选择对话框
ChatApp.prototype.showMonopolyChoiceDialog = function(title, content, choices, callback) {
    var self = this;
    var gamePage = this.monopolyGamePage;
    if (!gamePage) {
        if (callback) callback(choices[0]);
        return;
    }
    
    var dialogHtml = '<div id="mp-dialog-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;animation:mpFadeIn 0.3s ease;">';
    dialogHtml += '<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:20px;padding:24px;margin:20px;max-width:300px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2);">';
    dialogHtml += '<div style="font-size:16px;font-weight:600;color:#313735;margin-bottom:16px;">' + title + '</div>';
    dialogHtml += '<div style="font-size:14px;color:#7B8FA1;margin-bottom:20px;line-height:1.6;">' + content + '</div>';
    dialogHtml += '<div style="display:flex;gap:10px;justify-content:center;">';
    
    choices.forEach(function(choice) {
        dialogHtml += '<button class="mp-choice-btn" data-choice="' + choice + '" style="padding:12px 24px;background:linear-gradient(135deg,rgba(184,192,255,0.9),rgba(200,182,255,0.9));border:none;border-radius:25px;color:#313735;font-size:14px;font-weight:600;cursor:pointer;">' + choice + '</button>';
    });
    
    dialogHtml += '</div>';
    dialogHtml += '</div>';
    dialogHtml += '</div>';
    
    var dialogEl = document.createElement('div');
    dialogEl.innerHTML = dialogHtml;
    dialogEl = dialogEl.firstChild;
    
    var phoneScreen = this.appWindow || document.getElementById('phone-screen');
    if (phoneScreen) {
        phoneScreen.appendChild(dialogEl);
    }
    
    dialogEl.querySelectorAll('.mp-choice-btn').forEach(function(btn) {
        btn.onclick = function() {
            var choice = btn.getAttribute('data-choice');
            dialogEl.remove();
            if (callback) callback(choice);
        };
    });
};

// 显示对话框
ChatApp.prototype.showMonopolyDialog = function(title, content, callback) {
    var self = this;
    var gamePage = this.monopolyGamePage;
    if (!gamePage) {
        if (callback) callback();
        return;
    }
    
    var dialogHtml = '<div id="mp-dialog-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;animation:mpFadeIn 0.3s ease;">';
    dialogHtml += '<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:20px;padding:24px;margin:20px;max-width:300px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2);">';
    dialogHtml += '<div style="font-size:16px;font-weight:600;color:#313735;margin-bottom:16px;">' + title + '</div>';
    dialogHtml += '<div style="font-size:14px;color:#7B8FA1;margin-bottom:20px;line-height:1.6;">' + content + '</div>';
    dialogHtml += '<button id="mp-dialog-btn" style="padding:12px 30px;background:linear-gradient(135deg,rgba(184,192,255,0.9),rgba(200,182,255,0.9));border:none;border-radius:25px;color:#313735;font-size:14px;font-weight:600;cursor:pointer;">完成</button>';
    dialogHtml += '</div>';
    dialogHtml += '</div>';
    
    var dialogEl = document.createElement('div');
    dialogEl.innerHTML = dialogHtml;
    dialogEl = dialogEl.firstChild;
    
    var phoneScreen = this.appWindow || document.getElementById('phone-screen');
    if (phoneScreen) {
        phoneScreen.appendChild(dialogEl);
    }
    
    dialogEl.querySelector('#mp-dialog-btn').onclick = function() {
        dialogEl.remove();
        if (callback) callback();
    };
};

// 结束回合
ChatApp.prototype.endMonopolyTurn = function() {
    var self = this;
    var game = this.monopolyGame;
    var gamePage = this.monopolyGamePage;
    if (!game || !gamePage) return;
    
    game.isRolling = false;
    
    // 切换到下一个玩家
    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
    
    // 如果回到第一个玩家，增加回合数
    if (game.currentPlayer === 0) {
        game.round++;
    }
    
    // 检查是否需要跳过回合
    var nextPlayer = game.players[game.currentPlayer];
    if (game.skipNextTurn[nextPlayer.id]) {
        delete game.skipNextTurn[nextPlayer.id];
        self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.sleep + '</span> ' + nextPlayer.name + ' 本回合休息，跳过');
        
        // 递归跳到下一个玩家
        setTimeout(function() {
            self.endMonopolyTurn();
        }, 500);
        return;
    }
    
    // 更新回合指示
    var turnIndicator = gamePage.querySelector('#mp-turn-indicator');
    if (turnIndicator) {
        turnIndicator.innerHTML = '<span style="width:16px;height:16px;display:inline-flex;vertical-align:middle;margin-right:4px;">' + MonopolySVG.target + '</span>' + nextPlayer.name + ' 的回合';
    }
    
    var roundDisplay = turnIndicator ? turnIndicator.nextElementSibling : null;
    if (roundDisplay) {
        roundDisplay.textContent = '第 ' + game.round + ' 轮';
    }
    
    // 恢复掷骰子按钮
    var rollBtn = gamePage.querySelector('#mp-roll-btn');
    if (rollBtn) {
        rollBtn.style.opacity = '1';
        rollBtn.style.pointerEvents = 'auto';
    }
    
    // 更新玩家状态高亮
    var statsContainer = gamePage.querySelector('#mp-players-stats');
    if (statsContainer) {
        statsContainer.innerHTML = self.renderMonopolyPlayersStats();
    }
    
    // 如果是AI回合，自动掷骰子
    if (nextPlayer.isAI) {
        self.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.robot + '</span> ' + nextPlayer.name + ' 准备掷骰子...');
        setTimeout(function() {
            self.aiRollMonopolyDice();
        }, 1500);
    }
};

// AI掷骰子
ChatApp.prototype.aiRollMonopolyDice = function() {
    var self = this;
    var game = this.monopolyGame;
    if (!game || game.isRolling) return;
    
    var currentPlayer = game.players[game.currentPlayer];
    if (!currentPlayer.isAI) return;
    
    this.rollMonopolyDice();
};

// 添加游戏日志
ChatApp.prototype.addMonopolyLog = function(message) {
    var gamePage = this.monopolyGamePage;
    if (!gamePage) return;
    
    var logContainer = gamePage.querySelector('#mp-event-log');
    if (!logContainer) return;
    
    var time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    var logEntry = document.createElement('div');
    logEntry.style.cssText = 'padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);animation:mpFadeIn 0.3s ease;';
    logEntry.innerHTML = '<span style="color:#aaa;font-size:10px;">[' + time + ']</span> ' + message;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    if (this.monopolyGame) {
        this.monopolyGame.chatHistory.push({
            time: Date.now(),
            message: message
        });
    }
};

// 重置游戏
ChatApp.prototype.resetMonopolyGame = function() {
    var game = this.monopolyGame;
    if (!game) return;
    
    game.players.forEach(function(player) {
        player.position = 0;
        player.rounds = 0;
        player.steps = 0;
        player.hasShield = false;
    });
    
    game.currentPlayer = 0;
    game.round = 1;
    game.phase = 'rolling';
    game.isRolling = false;
    game.lastDiceValue = 0;
    game.wheelValue = 0;
    game.chatHistory = [];
    game.skipNextTurn = {};
    
    this.openMonopolyGameUI();
    
    this.addMonopolyLog('<span style="width:12px;height:12px;display:inline-flex;vertical-align:middle;">' + MonopolySVG.reset + '</span> 游戏已重置');
};

// 渲染大富翁游戏记录卡片
ChatApp.prototype.renderMonopolyRecordCard = function(msg) {
    var record = msg.gameRecord;
    if (!record || record.gameType !== 'monopoly') return '';
    
    var glassStyle = 'background:rgba(255,255,255,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
    var themeIcon = record.theme === 'ludo' ? MonopolySVG.plane : MonopolySVG.chat;
    var themeName = record.theme === 'ludo' ? '飞行棋' : '真心话大冒险';
    
    var html = '<div class="game-record-card" data-record-id="' + msg.id + '" style="' + glassStyle + 'border-radius:16px;padding:16px;margin:8px 0;cursor:pointer;transition:all 0.3s;border:1px solid rgba(184,192,255,0.3);">';
    
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
    html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#E8E4E1,#F5F5F5);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#313735;">' + themeIcon + '</div>';
    html += '<div style="flex:1;">';
    html += '<div style="font-size:14px;font-weight:600;color:#313735;">大富翁 - ' + themeName + '</div>';
    html += '<div style="font-size:11px;color:#7B8FA1;margin-top:2px;">' + record.playerCount + '人局 · ' + record.rounds + '回合</div>';
    html += '</div>';
    html += '</div>';
    
    if (record.summary) {
        html += '<div style="font-size:12px;color:#7B8FA1;line-height:1.5;">' + record.summary + '</div>';
    }
    
    html += '</div>';
    
    return html;
};

console.log('[Monopoly] 大富翁游戏模块已加载');
