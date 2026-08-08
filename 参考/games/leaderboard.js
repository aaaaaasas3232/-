/**
 * ==========================================
 * 【游戏排行榜模块 - GameLeaderboard】
 * ==========================================
 * 
 * 功能：
 * 1. 综合排行榜（总胜场、总胜率）
 * 2. 狼人杀排行榜（好人胜率、狼人胜率、神职胜率等）
 * 3. 谁是卧底排行榜（平民胜率、卧底胜率）
 * 4. 详细数据展示
 * 5. 游戏历史记录
 * 
 * 依赖：
 * - games.js (GameStats对象)
 * - chat.js (ChatApp)
 * - core.js (PhoneCore)
 */

(function() {
    'use strict';

    // ============ 排行榜常量配置 ============
    var LEADERBOARD_CONFIG = {
        // 颜色配置 - 韩风蓝粉色系
        colors: {
            primary: '#4A6FA5',
            secondary: '#7A9BBF',
            accent: '#A8C8EC',
            pink: '#E88FAC',
            pinkLight: '#FFD6E0',
            gold: '#FFD700',
            silver: '#C0C0C0',
            bronze: '#CD7F32',
            wolf: '#e74c3c',
            village: '#27ae60',
            seer: '#9b59b6',
            witch: '#8e44ad',
            hunter: '#e67e22',
            guard: '#3498db',
            cupid: '#e91e63',
            undercover: '#e74c3c',
            civilian: '#27ae60'
        },
        // 排行榜类型
        types: {
            all: { name: '综合', color: '#4A6FA5', bgGradient: 'linear-gradient(135deg,#A8C8EC,#D6E4FF)' },
            werewolf: { name: '狼人杀', color: '#4A6FA5', bgGradient: 'linear-gradient(135deg,#A8C8EC,#D6E4FF)' },
            undercover: { name: '谁是卧底', color: '#C76B8F', bgGradient: 'linear-gradient(135deg,#FFD6E0,#FFF0F3)' }
        },
        // 狼人杀子榜单
        werewolfCategories: [
            { id: 'total', name: '总榜', sortKey: 'werewolf.totalWins' },
            { id: 'wolf', name: '狼人', sortKey: 'werewolf.roles.wolf.wins', color: '#e74c3c' },
            { id: 'village', name: '好人', sortKey: 'werewolf.villageWins', color: '#27ae60' },
            { id: 'seer', name: '预言家', sortKey: 'werewolf.roles.seer.wins', color: '#9b59b6' },
            { id: 'witch', name: '女巫', sortKey: 'werewolf.roles.witch.wins', color: '#8e44ad' },
            { id: 'hunter', name: '猎人', sortKey: 'werewolf.roles.hunter.wins', color: '#e67e22' },
            { id: 'guard', name: '守卫', sortKey: 'werewolf.roles.guard.wins', color: '#3498db' }
        ],
        // 谁是卧底子榜单
        undercoverCategories: [
            { id: 'total', name: '总榜', sortKey: 'undercover.totalWins' },
            { id: 'civilian', name: '平民', sortKey: 'undercover.civilianWins', color: '#27ae60' },
            { id: 'undercover', name: '卧底', sortKey: 'undercover.undercoverWins', color: '#e74c3c' }
        ]
    };

    // ============ 辅助函数 ============
    
    // 获取嵌套对象属性
    function getNestedValue(obj, path) {
        var parts = path.split('.');
        var current = obj;
        for (var i = 0; i < parts.length; i++) {
            if (current === undefined || current === null) return 0;
            current = current[parts[i]];
        }
        return current || 0;
    }

    // 格式化日期
    function formatDate(timestamp) {
        var date = new Date(timestamp);
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');
        return month + '/' + day + ' ' + hours + ':' + minutes;
    }

    // 计算胜率
    function calcWinRate(wins, games) {
        if (!games || games === 0) return 0;
        return Math.round((wins / games) * 100);
    }

    // ============ 狼人杀详细排行榜 ============
    
    /**
     * 打开狼人杀详细排行榜
     * 包含：总榜、狼人胜率榜、好人胜率榜、各神职胜率榜
     */
    ChatApp.prototype.openWerewolfLeaderboard = function() {
        var self = this;
        var currentCategory = 'total';
        var currentSort = 'wins';
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#F0F7FF 100%);min-height:100%;">';
        
        // 标题区域
        html += '<div style="text-align:center;margin-bottom:16px;">';
        html += '<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:white;border-radius:20px;border:1px solid #D6E4FF;">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="#4A6FA5"><path d="M12 3c-1.94 0-3.64.85-4.5 2.14-.42-.08-.85-.14-1.3-.14C3.01 5 1 7.01 1 9.5c0 1.12.4 2.14 1.06 2.93C1.4 13.52 1 15.23 1 17c0 2.76 2.24 5 5 5 .7 0 1.36-.14 1.97-.4.91.26 1.93.4 3.03.4s2.12-.14 3.03-.4c.61.26 1.27.4 1.97.4 2.76 0 5-2.24 5-5 0-1.77-.4-3.48-1.06-4.57.66-.79 1.06-1.81 1.06-2.93 0-2.49-2.01-4.5-4.2-4.5-.45 0-.88.06-1.3.14C15.64 3.85 13.94 3 12 3z"/></svg>';
        html += '<span style="font-size:14px;font-weight:600;color:#3A5A80;">狼人杀排行榜</span>';
        html += '</div>';
        html += '</div>';
        
        // 子类别Tab
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;background:white;padding:10px;border-radius:12px;border:1px solid #D6E4FF;">';
        LEADERBOARD_CONFIG.werewolfCategories.forEach(function(cat, index) {
            var isActive = index === 0;
            var catColor = cat.color || '#4A6FA5';
            html += '<button class="ww-lb-cat-btn" data-category="' + cat.id + '" style="padding:8px 12px;background:' + (isActive ? catColor : 'transparent') + ';border:1px solid ' + (isActive ? catColor : '#D6E4FF') + ';border-radius:16px;color:' + (isActive ? 'white' : catColor) + ';font-size:11px;font-weight:500;cursor:pointer;transition:all 0.2s;">';
            html += cat.name;
            html += '</button>';
        });
        html += '</div>';
        
        // 排序选项
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:0 4px;">';
        html += '<div style="font-size:12px;color:#7A9BBF;">点击玩家查看详情</div>';
        html += '<select id="ww-lb-sort" style="padding:6px 10px;border:1px solid #D6E4FF;border-radius:6px;font-size:11px;color:#4A6FA5;background:white;outline:none;cursor:pointer;">';
        html += '<option value="wins">按胜场</option>';
        html += '<option value="winRate">按胜率</option>';
        html += '<option value="games">按场次</option>';
        html += '</select>';
        html += '</div>';
        
        // 排行榜列表容器
        html += '<div id="ww-lb-list">';
        html += this.renderWerewolfLeaderboardList('total', 'wins');
        html += '</div>';
        
        // 统计摘要
        html += '<div style="margin-top:16px;padding:12px;background:white;border-radius:12px;border:1px solid #D6E4FF;">';
        html += '<div style="font-size:12px;font-weight:600;color:#3A5A80;margin-bottom:10px;">数据统计</div>';
        html += this.renderWerewolfStats();
        html += '</div>';
        
        html += '</div>';
        
        var lbPage = this.openDetailPage(html, { 
            title: '狼人杀排行', 
            titleColor: '#4A6FA5', 
            bgColor: '#E8F4FF' 
        });
        
        // 绑定类别切换
        lbPage.querySelectorAll('.ww-lb-cat-btn').forEach(function(btn) {
            btn.onclick = function() {
                // 更新按钮样式
                lbPage.querySelectorAll('.ww-lb-cat-btn').forEach(function(b) {
                    b.style.background = 'transparent';
                    b.style.color = b.getAttribute('data-category') === 'total' ? '#4A6FA5' : 
                        LEADERBOARD_CONFIG.werewolfCategories.find(function(c) { return c.id === b.getAttribute('data-category'); }).color || '#4A6FA5';
                    b.style.borderColor = '#D6E4FF';
                });
                var catData = LEADERBOARD_CONFIG.werewolfCategories.find(function(c) { return c.id === btn.getAttribute('data-category'); });
                var btnColor = catData.color || '#4A6FA5';
                btn.style.background = btnColor;
                btn.style.color = 'white';
                btn.style.borderColor = btnColor;
                
                currentCategory = btn.getAttribute('data-category');
                lbPage.querySelector('#ww-lb-list').innerHTML = self.renderWerewolfLeaderboardList(currentCategory, currentSort);
                self.bindWerewolfLeaderboardEvents(lbPage, currentCategory, currentSort);
            };
        });
        
        // 绑定排序切换
        var sortSelect = lbPage.querySelector('#ww-lb-sort');
        if (sortSelect) {
            sortSelect.onchange = function() {
                currentSort = sortSelect.value;
                lbPage.querySelector('#ww-lb-list').innerHTML = self.renderWerewolfLeaderboardList(currentCategory, currentSort);
                self.bindWerewolfLeaderboardEvents(lbPage, currentCategory, currentSort);
            };
        }
        
        // 绑定玩家点击事件
        this.bindWerewolfLeaderboardEvents(lbPage, currentCategory, currentSort);
    };
    
    // 渲染狼人杀排行榜列表
    ChatApp.prototype.renderWerewolfLeaderboardList = function(category, sortBy) {
        var self = this;
        var data = GameStats.getData();
        var players = [];
        
        // 收集玩家数据
        for (var playerId in data.players) {
            var stats = data.players[playerId];
            var ww = stats.werewolf;
            
            if (ww.totalGames === 0) continue;
            
            var entry = {
                id: playerId,
                name: stats.name,
                isUser: stats.isUser,
                totalGames: ww.totalGames,
                totalWins: ww.totalWins
            };
            
            // 根据类别获取相关数据
            if (category === 'total') {
                entry.games = ww.totalGames;
                entry.wins = ww.totalWins;
                entry.winRate = calcWinRate(ww.totalWins, ww.totalGames);
            } else if (category === 'wolf') {
                entry.games = ww.roles.wolf.games;
                entry.wins = ww.roles.wolf.wins;
                entry.winRate = calcWinRate(ww.roles.wolf.wins, ww.roles.wolf.games);
            } else if (category === 'village') {
                entry.games = ww.villageGames;
                entry.wins = ww.villageWins;
                entry.winRate = calcWinRate(ww.villageWins, ww.villageGames);
            } else if (category === 'seer') {
                entry.games = ww.roles.seer.games;
                entry.wins = ww.roles.seer.wins;
                entry.winRate = calcWinRate(ww.roles.seer.wins, ww.roles.seer.games);
            } else if (category === 'witch') {
                entry.games = ww.roles.witch.games;
                entry.wins = ww.roles.witch.wins;
                entry.winRate = calcWinRate(ww.roles.witch.wins, ww.roles.witch.games);
            } else if (category === 'hunter') {
                entry.games = ww.roles.hunter.games;
                entry.wins = ww.roles.hunter.wins;
                entry.winRate = calcWinRate(ww.roles.hunter.wins, ww.roles.hunter.games);
            } else if (category === 'guard') {
                entry.games = ww.roles.guard.games;
                entry.wins = ww.roles.guard.wins;
                entry.winRate = calcWinRate(ww.roles.guard.wins, ww.roles.guard.games);
            }
            
            // 只添加有相关记录的玩家
            if (entry.games > 0) {
                players.push(entry);
            }
        }
        
        // 排序
        players.sort(function(a, b) {
            if (sortBy === 'winRate') {
                if (b.winRate === a.winRate) return b.games - a.games;
                return b.winRate - a.winRate;
            } else if (sortBy === 'games') {
                return b.games - a.games;
            } else {
                if (b.wins === a.wins) return b.winRate - a.winRate;
                return b.wins - a.wins;
            }
        });
        
        var html = '';
        
        if (players.length === 0) {
            html += '<div style="text-align:center;padding:40px 20px;color:#7A9BBF;">';
            html += '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="1.5" style="margin-bottom:12px;opacity:0.5;"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
            html += '<div style="font-size:13px;font-weight:500;margin-bottom:6px;">暂无数据</div>';
            html += '<div style="font-size:11px;color:#A8C8EC;">完成游戏后排行榜会显示数据</div>';
            html += '</div>';
            return html;
        }
        
        // 获取类别颜色
        var catData = LEADERBOARD_CONFIG.werewolfCategories.find(function(c) { return c.id === category; });
        var catColor = catData && catData.color ? catData.color : '#4A6FA5';
        
        html += '<div style="background:white;border-radius:12px;overflow:hidden;border:1px solid #D6E4FF;">';
        
        players.forEach(function(player, index) {
            var rankColor = index === 0 ? LEADERBOARD_CONFIG.colors.gold : 
                           index === 1 ? LEADERBOARD_CONFIG.colors.silver : 
                           index === 2 ? LEADERBOARD_CONFIG.colors.bronze : '#7A9BBF';
            var bgColor = player.isUser ? 'rgba(74,111,165,0.06)' : 'transparent';
            
            html += '<div class="ww-lb-player-item" data-player-id="' + player.id + '" style="display:flex;align-items:center;padding:12px;background:' + bgColor + ';border-bottom:1px solid #F0F4FF;cursor:pointer;transition:all 0.2s;">';
            
            // 排名
            html += '<div style="width:28px;height:28px;border-radius:50%;background:' + (index < 3 ? rankColor : '#F0F4FF') + ';display:flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;">';
            html += '<span style="color:' + (index < 3 ? 'white' : '#7A9BBF') + ';font-size:11px;font-weight:600;">' + (index + 1) + '</span>';
            html += '</div>';
            
            // 头像
            var avatarBg = player.isUser ? '#4A6FA5' : self.getAvatarColor(player.id);
            html += '<div style="width:36px;height:36px;border-radius:50%;background:' + avatarBg + ';display:flex;align-items:center;justify-content:center;color:white;font-size:13px;flex-shrink:0;overflow:hidden;margin-right:10px;border:2px solid ' + (player.isUser ? '#D6E4FF' : 'transparent') + ';">';
            
            if (player.isUser && PhoneCore.user && PhoneCore.user.avatar) {
                html += '<img src="' + PhoneCore.user.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else if (!player.isUser) {
                var ai = PhoneCore.getAI(player.id);
                if (ai && ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += player.name.charAt(0);
                }
            } else {
                html += player.name.charAt(0);
            }
            html += '</div>';
            
            // 名字和场次
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:13px;color:#3A5A80;font-weight:' + (player.isUser ? '600' : '500') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + player.name + (player.isUser ? ' (你)' : '') + '</div>';
            html += '<div style="font-size:10px;color:#A8C8EC;margin-top:2px;">' + player.games + ' 场</div>';
            html += '</div>';
            
            // 胜负数据
            html += '<div style="text-align:right;flex-shrink:0;">';
            html += '<div style="font-size:14px;font-weight:600;color:' + catColor + ';">' + player.wins + ' 胜</div>';
            html += '<div style="font-size:10px;color:#7A9BBF;margin-top:2px;">胜率 ' + player.winRate + '%</div>';
            html += '</div>';
            
            html += '</div>';
        });
        
        html += '</div>';
        
        return html;
    };
    
    // 渲染狼人杀统计摘要
    ChatApp.prototype.renderWerewolfStats = function() {
        var data = GameStats.getData();
        var history = data.history.filter(function(h) { return h.type === 'werewolf'; });
        
        var totalGames = history.length;
        var wolfWins = history.filter(function(h) { return h.winner === 'wolf'; }).length;
        var villageWins = history.filter(function(h) { return h.winner === 'village'; }).length;
        var loversWins = history.filter(function(h) { return h.winner === 'lovers'; }).length;
        
        var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">';
        
        html += '<div style="text-align:center;padding:10px;background:#F8FAFF;border-radius:8px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#4A6FA5;">' + totalGames + '</div>';
        html += '<div style="font-size:10px;color:#7A9BBF;margin-top:2px;">总场次</div>';
        html += '</div>';
        
        html += '<div style="text-align:center;padding:10px;background:#FFF5F5;border-radius:8px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#e74c3c;">' + wolfWins + '</div>';
        html += '<div style="font-size:10px;color:#e74c3c;margin-top:2px;">狼人胜</div>';
        html += '</div>';
        
        html += '<div style="text-align:center;padding:10px;background:#F0FFF5;border-radius:8px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#27ae60;">' + villageWins + '</div>';
        html += '<div style="font-size:10px;color:#27ae60;margin-top:2px;">好人胜</div>';
        html += '</div>';
        
        html += '<div style="text-align:center;padding:10px;background:#FFF5FF;border-radius:8px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#e91e63;">' + loversWins + '</div>';
        html += '<div style="font-size:10px;color:#e91e63;margin-top:2px;">情侣胜</div>';
        html += '</div>';
        
        html += '</div>';
        
        return html;
    };
    
    // 绑定狼人杀排行榜事件
    ChatApp.prototype.bindWerewolfLeaderboardEvents = function(page, category, sort) {
        var self = this;
        page.querySelectorAll('.ww-lb-player-item').forEach(function(item) {
            item.onclick = function() {
                var playerId = item.getAttribute('data-player-id');
                self.openPlayerStatsDetail(playerId);
            };
            // 悬停效果
            item.onmouseenter = function() {
                item.style.background = 'rgba(74,111,165,0.08)';
            };
            item.onmouseleave = function() {
                var isUser = item.querySelector('[data-player-id]');
                item.style.background = item.getAttribute('data-player-id') === 'user' ? 'rgba(74,111,165,0.06)' : 'transparent';
            };
        });
    };

    // ============ 谁是卧底详细排行榜 ============
    
    /**
     * 打开谁是卧底详细排行榜
     * 包含：总榜、平民胜率榜、卧底胜率榜
     */
    ChatApp.prototype.openUndercoverLeaderboard = function() {
        var self = this;
        var currentCategory = 'total';
        var currentSort = 'wins';
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#FFF5F7 0%,#FFF0F3 100%);min-height:100%;">';
        
        // 标题区域
        html += '<div style="text-align:center;margin-bottom:16px;">';
        html += '<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:white;border-radius:20px;border:1px solid #FFD6E0;">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="#E88FAC"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        html += '<span style="font-size:14px;font-weight:600;color:#C76B8F;">谁是卧底排行榜</span>';
        html += '</div>';
        html += '</div>';
        
        // 子类别Tab
        html += '<div style="display:flex;gap:8px;margin-bottom:16px;background:white;padding:10px;border-radius:12px;border:1px solid #FFD6E0;">';
        LEADERBOARD_CONFIG.undercoverCategories.forEach(function(cat, index) {
            var isActive = index === 0;
            var catColor = cat.color || '#C76B8F';
            html += '<button class="uc-lb-cat-btn" data-category="' + cat.id + '" style="flex:1;padding:10px;background:' + (isActive ? catColor : 'transparent') + ';border:1px solid ' + (isActive ? catColor : '#FFD6E0') + ';border-radius:10px;color:' + (isActive ? 'white' : catColor) + ';font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;">';
            html += cat.name;
            html += '</button>';
        });
        html += '</div>';
        
        // 排序选项
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:0 4px;">';
        html += '<div style="font-size:12px;color:#E88FAC;">点击玩家查看详情</div>';
        html += '<select id="uc-lb-sort" style="padding:6px 10px;border:1px solid #FFD6E0;border-radius:6px;font-size:11px;color:#C76B8F;background:white;outline:none;cursor:pointer;">';
        html += '<option value="wins">按胜场</option>';
        html += '<option value="winRate">按胜率</option>';
        html += '<option value="games">按场次</option>';
        html += '</select>';
        html += '</div>';
        
        // 排行榜列表容器
        html += '<div id="uc-lb-list">';
        html += this.renderUndercoverLeaderboardList('total', 'wins');
        html += '</div>';
        
        // 统计摘要
        html += '<div style="margin-top:16px;padding:12px;background:white;border-radius:12px;border:1px solid #FFD6E0;">';
        html += '<div style="font-size:12px;font-weight:600;color:#C76B8F;margin-bottom:10px;">数据统计</div>';
        html += this.renderUndercoverStats();
        html += '</div>';
        
        html += '</div>';
        
        var lbPage = this.openDetailPage(html, { 
            title: '谁是卧底排行', 
            titleColor: '#C76B8F', 
            bgColor: '#FFF5F7' 
        });
        
        // 绑定类别切换
        lbPage.querySelectorAll('.uc-lb-cat-btn').forEach(function(btn) {
            btn.onclick = function() {
                // 更新按钮样式
                lbPage.querySelectorAll('.uc-lb-cat-btn').forEach(function(b) {
                    var bCatData = LEADERBOARD_CONFIG.undercoverCategories.find(function(c) { return c.id === b.getAttribute('data-category'); });
                    b.style.background = 'transparent';
                    b.style.color = bCatData.color || '#C76B8F';
                    b.style.borderColor = '#FFD6E0';
                });
                var catData = LEADERBOARD_CONFIG.undercoverCategories.find(function(c) { return c.id === btn.getAttribute('data-category'); });
                var btnColor = catData.color || '#C76B8F';
                btn.style.background = btnColor;
                btn.style.color = 'white';
                btn.style.borderColor = btnColor;
                
                currentCategory = btn.getAttribute('data-category');
                lbPage.querySelector('#uc-lb-list').innerHTML = self.renderUndercoverLeaderboardList(currentCategory, currentSort);
                self.bindUndercoverLeaderboardEvents(lbPage, currentCategory, currentSort);
            };
        });
        
        // 绑定排序切换
        var sortSelect = lbPage.querySelector('#uc-lb-sort');
        if (sortSelect) {
            sortSelect.onchange = function() {
                currentSort = sortSelect.value;
                lbPage.querySelector('#uc-lb-list').innerHTML = self.renderUndercoverLeaderboardList(currentCategory, currentSort);
                self.bindUndercoverLeaderboardEvents(lbPage, currentCategory, currentSort);
            };
        }
        
        // 绑定玩家点击事件
        this.bindUndercoverLeaderboardEvents(lbPage, currentCategory, currentSort);
    };
    
    // 渲染谁是卧底排行榜列表
    ChatApp.prototype.renderUndercoverLeaderboardList = function(category, sortBy) {
        var self = this;
        var data = GameStats.getData();
        var players = [];
        
        // 收集玩家数据
        for (var playerId in data.players) {
            var stats = data.players[playerId];
            var uc = stats.undercover;
            
            if (uc.totalGames === 0) continue;
            
            var entry = {
                id: playerId,
                name: stats.name,
                isUser: stats.isUser,
                totalGames: uc.totalGames,
                totalWins: uc.totalWins
            };
            
            // 根据类别获取相关数据
            if (category === 'total') {
                entry.games = uc.totalGames;
                entry.wins = uc.totalWins;
                entry.winRate = calcWinRate(uc.totalWins, uc.totalGames);
            } else if (category === 'civilian') {
                entry.games = uc.civilianGames;
                entry.wins = uc.civilianWins;
                entry.winRate = calcWinRate(uc.civilianWins, uc.civilianGames);
            } else if (category === 'undercover') {
                entry.games = uc.undercoverGames;
                entry.wins = uc.undercoverWins;
                entry.winRate = calcWinRate(uc.undercoverWins, uc.undercoverGames);
            }
            
            // 只添加有相关记录的玩家
            if (entry.games > 0) {
                players.push(entry);
            }
        }
        
        // 排序
        players.sort(function(a, b) {
            if (sortBy === 'winRate') {
                if (b.winRate === a.winRate) return b.games - a.games;
                return b.winRate - a.winRate;
            } else if (sortBy === 'games') {
                return b.games - a.games;
            } else {
                if (b.wins === a.wins) return b.winRate - a.winRate;
                return b.wins - a.wins;
            }
        });
        
        var html = '';
        
        if (players.length === 0) {
            html += '<div style="text-align:center;padding:40px 20px;color:#E88FAC;">';
            html += '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFB3C6" stroke-width="1.5" style="margin-bottom:12px;opacity:0.5;"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
            html += '<div style="font-size:13px;font-weight:500;margin-bottom:6px;">暂无数据</div>';
            html += '<div style="font-size:11px;color:#FFB3C6;">完成游戏后排行榜会显示数据</div>';
            html += '</div>';
            return html;
        }
        
        // 获取类别颜色
        var catData = LEADERBOARD_CONFIG.undercoverCategories.find(function(c) { return c.id === category; });
        var catColor = catData && catData.color ? catData.color : '#C76B8F';
        
        html += '<div style="background:white;border-radius:12px;overflow:hidden;border:1px solid #FFD6E0;">';
        
        players.forEach(function(player, index) {
            var rankColor = index === 0 ? LEADERBOARD_CONFIG.colors.gold : 
                           index === 1 ? LEADERBOARD_CONFIG.colors.silver : 
                           index === 2 ? LEADERBOARD_CONFIG.colors.bronze : '#E88FAC';
            var bgColor = player.isUser ? 'rgba(232,143,172,0.08)' : 'transparent';
            
            html += '<div class="uc-lb-player-item" data-player-id="' + player.id + '" style="display:flex;align-items:center;padding:12px;background:' + bgColor + ';border-bottom:1px solid #FFF0F3;cursor:pointer;transition:all 0.2s;">';
            
            // 排名
            html += '<div style="width:28px;height:28px;border-radius:50%;background:' + (index < 3 ? rankColor : '#FFF0F3') + ';display:flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;">';
            html += '<span style="color:' + (index < 3 ? 'white' : '#E88FAC') + ';font-size:11px;font-weight:600;">' + (index + 1) + '</span>';
            html += '</div>';
            
            // 头像
            var avatarBg = player.isUser ? '#C76B8F' : self.getAvatarColor(player.id);
            html += '<div style="width:36px;height:36px;border-radius:50%;background:' + avatarBg + ';display:flex;align-items:center;justify-content:center;color:white;font-size:13px;flex-shrink:0;overflow:hidden;margin-right:10px;border:2px solid ' + (player.isUser ? '#FFD6E0' : 'transparent') + ';">';
            
            if (player.isUser && PhoneCore.user && PhoneCore.user.avatar) {
                html += '<img src="' + PhoneCore.user.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else if (!player.isUser) {
                var ai = PhoneCore.getAI(player.id);
                if (ai && ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += player.name.charAt(0);
                }
            } else {
                html += player.name.charAt(0);
            }
            html += '</div>';
            
            // 名字和场次
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:13px;color:#C76B8F;font-weight:' + (player.isUser ? '600' : '500') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + player.name + (player.isUser ? ' (你)' : '') + '</div>';
            html += '<div style="font-size:10px;color:#FFB3C6;margin-top:2px;">' + player.games + ' 场</div>';
            html += '</div>';
            
            // 胜负数据
            html += '<div style="text-align:right;flex-shrink:0;">';
            html += '<div style="font-size:14px;font-weight:600;color:' + catColor + ';">' + player.wins + ' 胜</div>';
            html += '<div style="font-size:10px;color:#E88FAC;margin-top:2px;">胜率 ' + player.winRate + '%</div>';
            html += '</div>';
            
            html += '</div>';
        });
        
        html += '</div>';
        
        return html;
    };
    
    // 渲染谁是卧底统计摘要
    ChatApp.prototype.renderUndercoverStats = function() {
        var data = GameStats.getData();
        var history = data.history.filter(function(h) { return h.type === 'undercover'; });
        
        var totalGames = history.length;
        var civilianWins = history.filter(function(h) { return h.winner === 'civilian'; }).length;
        var undercoverWins = history.filter(function(h) { return h.winner === 'undercover'; }).length;
        
        var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';
        
        html += '<div style="text-align:center;padding:10px;background:#FFF8F8;border-radius:8px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#C76B8F;">' + totalGames + '</div>';
        html += '<div style="font-size:10px;color:#E88FAC;margin-top:2px;">总场次</div>';
        html += '</div>';
        
        html += '<div style="text-align:center;padding:10px;background:#F0FFF5;border-radius:8px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#27ae60;">' + civilianWins + '</div>';
        html += '<div style="font-size:10px;color:#27ae60;margin-top:2px;">平民胜</div>';
        html += '</div>';
        
        html += '<div style="text-align:center;padding:10px;background:#FFF5F5;border-radius:8px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#e74c3c;">' + undercoverWins + '</div>';
        html += '<div style="font-size:10px;color:#e74c3c;margin-top:2px;">卧底胜</div>';
        html += '</div>';
        
        html += '</div>';
        
        return html;
    };
    
    // 绑定谁是卧底排行榜事件
    ChatApp.prototype.bindUndercoverLeaderboardEvents = function(page, category, sort) {
        var self = this;
        page.querySelectorAll('.uc-lb-player-item').forEach(function(item) {
            item.onclick = function() {
                var playerId = item.getAttribute('data-player-id');
                self.openPlayerStatsDetail(playerId);
            };
            // 悬停效果
            item.onmouseenter = function() {
                item.style.background = 'rgba(232,143,172,0.1)';
            };
            item.onmouseleave = function() {
                item.style.background = item.getAttribute('data-player-id') === 'user' ? 'rgba(232,143,172,0.08)' : 'transparent';
            };
        });
    };

    // ============ 增强的综合排行榜入口 ============
    
    /**
     * 打开综合游戏排行榜入口
     * 可以选择查看不同游戏的排行榜
     */
    ChatApp.prototype.openGameLeaderboardHub = function(groupId) {
        var self = this;
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#FFF5F7 50%,#FFFFFF 100%);min-height:100%;">';
        
        // 顶部标题
        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div style="font-size:18px;font-weight:600;color:#3A5A80;">游戏排行榜</div>';
        html += '<div style="font-size:12px;color:#7A9BBF;margin-top:6px;">查看各游戏的排名和数据</div>';
        html += '</div>';
        
        // 我的数据卡片
        html += '<div id="hub-my-stats" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;cursor:pointer;transition:all 0.2s;">';
        html += this.renderMyStatsCard();
        html += '</div>';
        
        // 游戏分类入口
        html += '<div style="font-size:13px;font-weight:600;color:#3A5A80;margin-bottom:12px;padding-left:4px;">游戏排行</div>';
        
        // 狼人杀入口
        html += '<div id="hub-werewolf" style="display:flex;align-items:center;background:white;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #D6E4FF;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#A8C8EC,#D6E4FF);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">';
        html += '<svg width="22" height="22" viewBox="0 0 24 24" fill="#4A6FA5"><path d="M12 3c-1.94 0-3.64.85-4.5 2.14-.42-.08-.85-.14-1.3-.14C3.01 5 1 7.01 1 9.5c0 1.12.4 2.14 1.06 2.93C1.4 13.52 1 15.23 1 17c0 2.76 2.24 5 5 5 .7 0 1.36-.14 1.97-.4.91.26 1.93.4 3.03.4s2.12-.14 3.03-.4c.61.26 1.27.4 1.97.4 2.76 0 5-2.24 5-5 0-1.77-.4-3.48-1.06-4.57.66-.79 1.06-1.81 1.06-2.93 0-2.49-2.01-4.5-4.2-4.5-.45 0-.88.06-1.3.14C15.64 3.85 13.94 3 12 3z"/></svg>';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#3A5A80;">狼人杀</div>';
        html += '<div style="font-size:11px;color:#7A9BBF;margin-top:3px;">总榜 / 狼人 / 好人 / 神职胜率</div>';
        html += '</div>';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
        html += '</div>';
        
        // 谁是卧底入口
        html += '<div id="hub-undercover" style="display:flex;align-items:center;background:white;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #FFD6E0;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#FFD6E0,#FFF0F3);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">';
        html += '<svg width="22" height="22" viewBox="0 0 24 24" fill="#E88FAC"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#C76B8F;">谁是卧底</div>';
        html += '<div style="font-size:11px;color:#E88FAC;margin-top:3px;">总榜 / 平民 / 卧底胜率</div>';
        html += '</div>';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB3C6" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
        html += '</div>';
        
        // 最近记录入口
        html += '<div id="hub-history" style="display:flex;align-items:center;background:white;border-radius:12px;padding:14px;border:1px solid #E9ECEF;cursor:pointer;transition:all 0.2s;">';
        html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#E9ECEF,#F5F5F5);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">';
        html += '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A9BBF" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:600;color:#666;">游戏历史</div>';
        html += '<div style="font-size:11px;color:#999;margin-top:3px;">查看最近的游戏记录</div>';
        html += '</div>';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCC" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
        html += '</div>';
        
        html += '</div>';
        
        var hubPage = this.openDetailPage(html, { 
            title: '游戏排行', 
            titleColor: '#4A6FA5', 
            bgColor: '#E8F4FF' 
        });
        
        // 绑定事件
        var myStatsCard = hubPage.querySelector('#hub-my-stats');
        if (myStatsCard) {
            myStatsCard.onclick = function() {
                self.openPlayerStatsDetail('user');
            };
        }
        
        var werewolfBtn = hubPage.querySelector('#hub-werewolf');
        if (werewolfBtn) {
            werewolfBtn.onclick = function() {
                self.openWerewolfLeaderboard();
            };
        }
        
        var undercoverBtn = hubPage.querySelector('#hub-undercover');
        if (undercoverBtn) {
            undercoverBtn.onclick = function() {
                self.openUndercoverLeaderboard();
            };
        }
        
        var historyBtn = hubPage.querySelector('#hub-history');
        if (historyBtn) {
            historyBtn.onclick = function() {
                self.openRecentGamesHistory();
            };
        }
    };
    
    // 渲染我的数据卡片
    ChatApp.prototype.renderMyStatsCard = function() {
        var stats = GameStats.getPlayerDetail('user');
        
        var html = '<div style="display:flex;align-items:center;margin-bottom:12px;">';
        
        // 头像
        html += '<div style="width:50px;height:50px;border-radius:50%;background:#4A6FA5;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;flex-shrink:0;overflow:hidden;margin-right:12px;border:2px solid #D6E4FF;">';
        if (PhoneCore.user && PhoneCore.user.avatar) {
            html += '<img src="' + PhoneCore.user.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            var userName = (PhoneCore.user && PhoneCore.user.name) ? PhoneCore.user.name : '我';
            html += userName.charAt(0);
        }
        html += '</div>';
        
        html += '<div style="flex:1;">';
        html += '<div style="font-size:15px;font-weight:600;color:#3A5A80;">' + ((PhoneCore.user && PhoneCore.user.name) || '我') + '</div>';
        html += '<div style="font-size:11px;color:#7A9BBF;margin-top:3px;">点击查看详细数据</div>';
        html += '</div>';
        
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
        html += '</div>';
        
        // 统计数据
        if (stats && stats.totalGames > 0) {
            var totalWinRate = calcWinRate(stats.totalWins, stats.totalGames);
            
            html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';
            
            html += '<div style="text-align:center;padding:10px;background:#F8FAFF;border-radius:8px;">';
            html += '<div style="font-size:18px;font-weight:600;color:#4A6FA5;">' + stats.totalGames + '</div>';
            html += '<div style="font-size:10px;color:#7A9BBF;margin-top:2px;">总场次</div>';
            html += '</div>';
            
            html += '<div style="text-align:center;padding:10px;background:#F0FFF5;border-radius:8px;">';
            html += '<div style="font-size:18px;font-weight:600;color:#27ae60;">' + stats.totalWins + '</div>';
            html += '<div style="font-size:10px;color:#27ae60;margin-top:2px;">总胜场</div>';
            html += '</div>';
            
            html += '<div style="text-align:center;padding:10px;background:#FFF8F5;border-radius:8px;">';
            html += '<div style="font-size:18px;font-weight:600;color:#e67e22;">' + totalWinRate + '%</div>';
            html += '<div style="font-size:10px;color:#e67e22;margin-top:2px;">胜率</div>';
            html += '</div>';
            
            html += '</div>';
        } else {
            html += '<div style="text-align:center;padding:16px;background:#F8FAFF;border-radius:8px;color:#7A9BBF;font-size:12px;">';
            html += '暂无游戏记录，快去玩游戏吧';
            html += '</div>';
        }
        
        return html;
    };

    // ============ 增强的玩家详情页 ============
    
    /**
     * 增强版玩家数据详情页
     * 包含更详细的角色分析
     */
    ChatApp.prototype.openEnhancedPlayerDetail = function(playerId) {
        var self = this;
        var stats = GameStats.getPlayerDetail(playerId);
        
        if (!stats) {
            stats = GameStats.createPlayerStats(playerId, playerId === 'user' ? (PhoneCore.user.name || '我') : '未知');
        }
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#E8F4FF 0%,#FFF5F7 50%,#FFFFFF 100%);min-height:100%;">';
        
        // 玩家头部信息卡片
        html += '<div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid #D6E4FF;text-align:center;">';
        
        // 头像
        var avatarBg = stats.isUser ? '#4A6FA5' : self.getAvatarColor(playerId);
        html += '<div style="width:72px;height:72px;margin:0 auto 12px;border-radius:50%;background:' + avatarBg + ';display:flex;align-items:center;justify-content:center;color:white;font-size:26px;overflow:hidden;box-shadow:0 4px 16px rgba(74,111,165,0.25);border:3px solid white;">';
        
        if (stats.isUser && PhoneCore.user && PhoneCore.user.avatar) {
            html += '<img src="' + PhoneCore.user.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else if (!stats.isUser) {
            var ai = PhoneCore.getAI(playerId);
            if (ai && ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += stats.name.charAt(0);
            }
        } else {
            html += stats.name.charAt(0);
        }
        html += '</div>';
        
        html += '<div style="font-size:18px;font-weight:600;color:#3A5A80;margin-bottom:4px;">' + stats.name + '</div>';
        
        // 总体数据
        var totalWinRate = calcWinRate(stats.totalWins, stats.totalGames);
        html += '<div style="display:flex;justify-content:center;gap:24px;margin-top:16px;">';
        html += '<div><div style="font-size:22px;font-weight:700;color:#4A6FA5;">' + stats.totalGames + '</div><div style="font-size:11px;color:#7A9BBF;">总场次</div></div>';
        html += '<div><div style="font-size:22px;font-weight:700;color:#27ae60;">' + stats.totalWins + '</div><div style="font-size:11px;color:#7A9BBF;">总胜场</div></div>';
        html += '<div><div style="font-size:22px;font-weight:700;color:#e67e22;">' + totalWinRate + '%</div><div style="font-size:11px;color:#7A9BBF;">总胜率</div></div>';
        html += '</div>';
        
        html += '</div>';
        
        // 狼人杀数据卡片
        html += this.renderEnhancedWerewolfCard(stats.werewolf);
        
        // 谁是卧底数据卡片
        html += this.renderEnhancedUndercoverCard(stats.undercover);
        
        html += '</div>';
        
        this.openDetailPage(html, { 
            title: '玩家数据', 
            titleColor: '#4A6FA5', 
            bgColor: '#E8F4FF' 
        });
    };
    
    // 渲染增强版狼人杀卡片
    ChatApp.prototype.renderEnhancedWerewolfCard = function(ww) {
        var html = '<div style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;border:1px solid #D6E4FF;">';
        
        // 标题
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#A8C8EC,#D6E4FF);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="#4A6FA5"><path d="M12 3c-1.94 0-3.64.85-4.5 2.14-.42-.08-.85-.14-1.3-.14C3.01 5 1 7.01 1 9.5c0 1.12.4 2.14 1.06 2.93C1.4 13.52 1 15.23 1 17c0 2.76 2.24 5 5 5 .7 0 1.36-.14 1.97-.4.91.26 1.93.4 3.03.4s2.12-.14 3.03-.4c.61.26 1.27.4 1.97.4 2.76 0 5-2.24 5-5 0-1.77-.4-3.48-1.06-4.57.66-.79 1.06-1.81 1.06-2.93 0-2.49-2.01-4.5-4.2-4.5-.45 0-.88.06-1.3.14C15.64 3.85 13.94 3 12 3z"/></svg>';
        html += '</div>';
        html += '<div style="font-size:15px;font-weight:600;color:#3A5A80;">狼人杀</div>';
        html += '</div>';
        
        if (ww.totalGames === 0) {
            html += '<div style="text-align:center;padding:20px;color:#A8C8EC;font-size:12px;">暂无游戏记录</div>';
        } else {
            // 基础统计
            var wwWinRate = calcWinRate(ww.totalWins, ww.totalGames);
            html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">';
            html += '<div style="text-align:center;padding:10px;background:#F8FAFF;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#4A6FA5;">' + ww.totalGames + '</div><div style="font-size:9px;color:#7A9BBF;margin-top:2px;">场次</div></div>';
            html += '<div style="text-align:center;padding:10px;background:#F0FFF5;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#27ae60;">' + ww.totalWins + '</div><div style="font-size:9px;color:#7A9BBF;margin-top:2px;">胜场</div></div>';
            html += '<div style="text-align:center;padding:10px;background:#FFF8F5;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#e67e22;">' + wwWinRate + '%</div><div style="font-size:9px;color:#7A9BBF;margin-top:2px;">胜率</div></div>';
            html += '<div style="text-align:center;padding:10px;background:#F5F0FF;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#9b59b6;">' + ww.survivalRate + '%</div><div style="font-size:9px;color:#7A9BBF;margin-top:2px;">存活率</div></div>';
            html += '</div>';
            
            // 阵营统计
            html += '<div style="font-size:11px;font-weight:600;color:#7A9BBF;margin-bottom:8px;">阵营表现</div>';
            html += '<div style="display:flex;gap:8px;margin-bottom:16px;">';
            
            var wolfWinRate = calcWinRate(ww.wolfWins, ww.wolfGames);
            var villageWinRate = calcWinRate(ww.villageWins, ww.villageGames);
            
            html += '<div style="flex:1;background:#FFF5F5;border-radius:10px;padding:12px;text-align:center;border:1px solid #FFE0E0;">';
            html += '<div style="font-size:14px;font-weight:600;color:#e74c3c;">' + ww.wolfWins + '/' + ww.wolfGames + '</div>';
            html += '<div style="font-size:10px;color:#e74c3c;margin-top:4px;">狼人 ' + wolfWinRate + '%</div>';
            html += '</div>';
            
            html += '<div style="flex:1;background:#F0FFF5;border-radius:10px;padding:12px;text-align:center;border:1px solid #D6F5E0;">';
            html += '<div style="font-size:14px;font-weight:600;color:#27ae60;">' + ww.villageWins + '/' + ww.villageGames + '</div>';
            html += '<div style="font-size:10px;color:#27ae60;margin-top:4px;">好人 ' + villageWinRate + '%</div>';
            html += '</div>';
            
            if (ww.loversGames > 0) {
                var loversWinRate = calcWinRate(ww.loversWins, ww.loversGames);
                html += '<div style="flex:1;background:#FFF5FF;border-radius:10px;padding:12px;text-align:center;border:1px solid #FFD6FF;">';
                html += '<div style="font-size:14px;font-weight:600;color:#e91e63;">' + ww.loversWins + '/' + ww.loversGames + '</div>';
                html += '<div style="font-size:10px;color:#e91e63;margin-top:4px;">情侣 ' + loversWinRate + '%</div>';
                html += '</div>';
            }
            
            html += '</div>';
            
            // 角色详细统计
            html += '<div style="font-size:11px;font-weight:600;color:#7A9BBF;margin-bottom:8px;">角色表现</div>';
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';
            
            var roleOrder = ['wolf', 'seer', 'witch', 'hunter', 'guard', 'cupid', 'villager'];
            var roleNames = { wolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', cupid: '丘比特', villager: '村民' };
            var roleColors = { wolf: '#e74c3c', seer: '#9b59b6', witch: '#8e44ad', hunter: '#e67e22', guard: '#3498db', cupid: '#e91e63', villager: '#27ae60' };
            
            roleOrder.forEach(function(role) {
                var r = ww.roles[role];
                if (r && r.games > 0) {
                    var roleWinRate = calcWinRate(r.wins, r.games);
                    html += '<div style="background:#F8FAFF;border-radius:8px;padding:10px;display:flex;justify-content:space-between;align-items:center;">';
                    html += '<span style="font-size:11px;color:' + roleColors[role] + ';font-weight:500;">' + roleNames[role] + '</span>';
                    html += '<span style="font-size:10px;color:#7A9BBF;">' + r.wins + '/' + r.games + ' (' + roleWinRate + '%)</span>';
                    html += '</div>';
                }
            });
            
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    };
    
    // 渲染增强版谁是卧底卡片
    ChatApp.prototype.renderEnhancedUndercoverCard = function(uc) {
        var html = '<div style="background:white;border-radius:16px;padding:16px;border:1px solid #FFD6E0;">';
        
        // 标题
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#FFD6E0,#FFF0F3);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="#E88FAC"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        html += '</div>';
        html += '<div style="font-size:15px;font-weight:600;color:#C76B8F;">谁是卧底</div>';
        html += '</div>';
        
        if (uc.totalGames === 0) {
            html += '<div style="text-align:center;padding:20px;color:#FFB3C6;font-size:12px;">暂无游戏记录</div>';
        } else {
            // 基础统计
            var ucWinRate = calcWinRate(uc.totalWins, uc.totalGames);
            var ucSurvivalRate = calcWinRate(uc.survivedGames, uc.totalGames);
            
            html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">';
            html += '<div style="text-align:center;padding:10px;background:#FFF8F8;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#C76B8F;">' + uc.totalGames + '</div><div style="font-size:9px;color:#E88FAC;margin-top:2px;">场次</div></div>';
            html += '<div style="text-align:center;padding:10px;background:#F0FFF5;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#27ae60;">' + uc.totalWins + '</div><div style="font-size:9px;color:#E88FAC;margin-top:2px;">胜场</div></div>';
            html += '<div style="text-align:center;padding:10px;background:#FFF8F5;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#e67e22;">' + ucWinRate + '%</div><div style="font-size:9px;color:#E88FAC;margin-top:2px;">胜率</div></div>';
            html += '<div style="text-align:center;padding:10px;background:#F5F0FF;border-radius:8px;"><div style="font-size:16px;font-weight:600;color:#9b59b6;">' + ucSurvivalRate + '%</div><div style="font-size:9px;color:#E88FAC;margin-top:2px;">存活率</div></div>';
            html += '</div>';
            
            // 身份统计
            html += '<div style="font-size:11px;font-weight:600;color:#E88FAC;margin-bottom:8px;">身份表现</div>';
            html += '<div style="display:flex;gap:8px;">';
            
            var civilianWinRate = calcWinRate(uc.civilianWins, uc.civilianGames);
            var undercoverWinRate = calcWinRate(uc.undercoverWins, uc.undercoverGames);
            
            html += '<div style="flex:1;background:#F0FFF5;border-radius:10px;padding:14px;text-align:center;border:1px solid #D6F5E0;">';
            html += '<div style="font-size:15px;font-weight:600;color:#27ae60;">' + uc.civilianWins + '/' + uc.civilianGames + '</div>';
            html += '<div style="font-size:10px;color:#27ae60;margin-top:4px;">平民 ' + civilianWinRate + '%</div>';
            html += '</div>';
            
            html += '<div style="flex:1;background:#FFF5F5;border-radius:10px;padding:14px;text-align:center;border:1px solid #FFE0E0;">';
            html += '<div style="font-size:15px;font-weight:600;color:#e74c3c;">' + uc.undercoverWins + '/' + uc.undercoverGames + '</div>';
            html += '<div style="font-size:10px;color:#e74c3c;margin-top:4px;">卧底 ' + undercoverWinRate + '%</div>';
            html += '</div>';
            
            html += '</div>';
            
            // 特殊成就
            if (uc.hiddenUntilEnd > 0) {
                html += '<div style="margin-top:12px;padding:10px;background:#FFF8F5;border-radius:8px;border:1px solid #FFE8DD;">';
                html += '<div style="font-size:11px;color:#e67e22;display:flex;align-items:center;gap:6px;">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="#e67e22"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>';
                html += '卧底隐藏到最后: ' + uc.hiddenUntilEnd + ' 次';
                html += '</div>';
                html += '</div>';
            }
        }
        
        html += '</div>';
        return html;
    };

    // ============ 覆盖原有入口方法 ============
    
    /**
     * 覆盖games.js中的openGameLeaderboard方法
     * 使用新的排行榜入口页面
     */
    var originalOpenGameLeaderboard = ChatApp.prototype.openGameLeaderboard;
    ChatApp.prototype.openGameLeaderboard = function(groupId) {
        // 使用新的排行榜入口
        this.openGameLeaderboardHub(groupId);
    };

    console.log('[GameLeaderboard] 游戏排行榜模块已加载');

})();
