/**
 * ==========================================
 * 【小游戏核心模块 - GameCore】
 * ==========================================
 * 
 * 用途：
 * 1. 提供游戏开发的通用工具函数
 * 2. 管理游戏注册（方便扩展新游戏）
 * 3. 作为新游戏开发的参考模板
 * 
 * 已有游戏：
 * - werewolf.js  狼人杀
 * - undercover.js  谁是卧底
 * 
 * 添加新游戏步骤：
 * 1. 在 js/games/ 目录下创建新文件，如 newgame.js
 * 2. 在 GameCore.games 中注册游戏信息
 * 3. 在 chat.js 的 openGameSelector 中添加游戏卡片
 * 4. 在 index.html 中添加 <script src="js/games/newgame.js"></script>
 */

// 游戏核心管理器
var GameCore = {
    
    // 已注册的游戏列表
    games: {
        werewolf: {
            name: '狼人杀',
            description: '经典桌游，考验推理与演技',
            minPlayers: 4,
            maxPlayers: 12,
            icon: '🐺',
            color: '#4A6FA5',
            bgGradient: 'linear-gradient(135deg,#A8C8EC,#D6E4FF)',
            setupFunction: 'openWerewolfSetup'
        },
        undercover: {
            name: '谁是卧底',
            description: '语言描述，找出隐藏的卧底',
            minPlayers: 3,
            maxPlayers: 10,
            icon: '🕵️',
            color: '#C76B8F',
            bgGradient: 'linear-gradient(135deg,#FFD6E0,#FFF0F3)',
            setupFunction: 'openUndercoverSetup'
        },
        monopoly: {
            name: '大富翁',
            description: '经典棋盘游戏，掷骰子前进',
            minPlayers: 1,
            maxPlayers: 4,
            icon: '🎲',
            color: '#7B8FA1',
            bgGradient: 'linear-gradient(135deg,#E8E4E1,#F5F5F5)',
            setupFunction: 'openMonopolySetup'
        }
        // 在这里添加新游戏...
        // example: {
        //     name: '游戏名称',
        //     description: '游戏描述',
        //     minPlayers: 3,
        //     maxPlayers: 8,
        //     icon: '🎮',
        //     color: '#主题色',
        //     bgGradient: 'linear-gradient(...)',
        //     setupFunction: 'openExampleSetup'
        // }
    },
    
    // 获取游戏信息
    getGame: function(gameId) {
        return this.games[gameId] || null;
    },
    
    // 获取所有游戏
    getAllGames: function() {
        return this.games;
    },
    
    // 注册新游戏
    registerGame: function(gameId, gameInfo) {
        this.games[gameId] = gameInfo;
        console.log('[GameCore] 注册游戏:', gameId, gameInfo.name);
    },
    
    // 检查人数是否满足游戏要求
    checkPlayerCount: function(gameId, playerCount) {
        var game = this.games[gameId];
        if (!game) return { valid: false, message: '游戏不存在' };
        
        if (playerCount < game.minPlayers) {
            return { 
                valid: false, 
                message: game.name + '至少需要' + game.minPlayers + '人参与' 
            };
        }
        if (playerCount > game.maxPlayers) {
            return { 
                valid: false, 
                message: game.name + '最多支持' + game.maxPlayers + '人参与' 
            };
        }
        return { valid: true };
    }
};

/**
 * ==========================================
 * 【新游戏开发模板】
 * ==========================================
 * 
 * 复制以下模板到新文件，替换 Example 为你的游戏名
 * 
 * 必需实现的函数：
 * - openExampleSetup(groupId)     游戏设置页面
 * - startExampleGame(...)         开始游戏
 * - openExampleGameUI()           游戏主界面
 * 
 * 建议实现的函数：
 * - renderExampleMessages()       渲染游戏消息
 * - renderExampleInputArea()      渲染输入区域
 * - updateExampleUI()             更新UI
 * - addExampleMessage(msg)        添加消息
 * - checkExampleGameEnd()         检查游戏结束
 * - endExampleGame(winner)        结束游戏
 * - saveExampleGameRecord()       保存游戏记录
 * - renderExampleRecordCard(msg)  渲染记录卡片
 * - openExampleRecordDetail(...)  记录详情页
 */

/*
// ========== 游戏模板示例（注释状态，需要时取消注释） ==========

// 步骤1: 在 GameCore.games 中注册
// GameCore.registerGame('example', {
//     name: '示例游戏',
//     description: '这是一个示例游戏',
//     minPlayers: 3,
//     maxPlayers: 8,
//     icon: '🎮',
//     color: '#6B8FC7',
//     bgGradient: 'linear-gradient(135deg,#D6E4FF,#E8F0FF)',
//     setupFunction: 'openExampleSetup'
// });

// 步骤2: 实现游戏设置页面
// ChatApp.prototype.openExampleSetup = function(groupId) {
//     var self = this;
//     var group = this.getGroupChat(groupId);
//     if (!group) return;
//     
//     var memberCount = group.members.length;
//     var gameInfo = GameCore.getGame('example');
//     
//     // 检查人数
//     var check = GameCore.checkPlayerCount('example', memberCount + 1);
//     if (!check.valid) {
//         PhoneCore.notifications.send({
//             type: 'warning',
//             title: '人数不足',
//             message: check.message,
//             size: 'mini'
//         });
//         return;
//     }
//     
//     // 构建设置页面HTML...
//     var html = '<div style="padding:20px;">...</div>';
//     
//     var setupPage = this.openDetailPage(html, {
//         title: gameInfo.name,
//         titleColor: gameInfo.color,
//         bgColor: '#E8F4FF'
//     });
//     
//     // 绑定事件...
// };

// 步骤3: 实现游戏启动
// ChatApp.prototype.startExampleGame = function(groupId, options) {
//     // 初始化游戏状态
//     this.exampleGame = {
//         id: 'game_' + Date.now(),
//         groupId: groupId,
//         type: 'example',
//         phase: 'playing',
//         round: 1,
//         players: [],
//         chatHistory: [],
//         startTime: Date.now()
//     };
//     
//     // 打开游戏界面
//     this.openExampleGameUI();
// };

// 步骤4: 实现游戏界面
// ChatApp.prototype.openExampleGameUI = function() {
//     var game = this.exampleGame;
//     if (!game) return;
//     
//     var html = '<div class="example-game">...</div>';
//     
//     var gamePage = this.openDetailPage(html, { ... });
//     this.exampleGamePage = gamePage;
//     
//     // 绑定游戏事件
//     this.bindExampleGameEvents(gamePage);
// };

// ========== 游戏模板结束 ==========
*/

console.log('[GameCore] 游戏核心模块已加载，已注册游戏:', Object.keys(GameCore.games).join(', '));
