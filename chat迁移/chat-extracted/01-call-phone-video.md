# 01 — 打电话 / 打视频(完整链路)

> **chat.js 原始范围**:`8558–11539`
> 总长度 **2982 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | 来电通知 | `showIncomingCall` | 8558 |
> | AI 来电开场白生成 | `generateIncomingCallGreeting` | 9685 |
> | 通话页渲染 | `openCallPage` / `renderCallMessages` / `bindCallPageEvents` / `startCallTimer` / `closeCallPage` / `minimizeCallPage` / `restoreCallPage` / `sendCallMessage` / `addCallSystemMessage` | 9836, 10220, 10019, 10098, 10123, 10131, 10153, 10169, 10293 |
> | 通话 AI 响应 | `generateCallResponse` / `addCallAIMessage` | 10319, 10534 |
> | 灵动岛通道 | `renderCallIsland` / `bindIslandEvents` / `sendIslandMessage` / `renderIslandMessages` / `generateIslandCallResponse` / `addIslandAIMessage` | 10611, 10753, 10821, 10860, 10919, 11121 |
> | 通话结束 | `endCall` / `deactivateIsland` / `processCallEnd` | 11194, 11269, 11281 |
> | 通话记录 | `generateCallSummary` / `updateCallSummary` / `openCallRecordDetail` / `formatCallDuration` | 11362, 11417, 11432, 11526 |
>
> ## 不包含
>
> 表情包选择器(`openStickerPicker` = 11540 起,属于独立话题)
>
> ---
>
> 下面是 chat.js 8558–11539 的原始代码,未做精简。

```js
// ================ chat.js 行 8558 ~ 11539 ================
// ================ chat.js 行 8558 ~ 11539 ================
    ChatApp.prototype.showIncomingCall = function(aiId, callType) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var isVideo = callType === 'video';
        var avatarColor = this.getAvatarColor(aiId);
        
        var html = '<div class="incoming-call-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,#1a1a2e 0%,#16213e 100%);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;">';
        
        // 头像
        html += '<div style="width:100px;height:100px;border-radius:50%;overflow:hidden;margin-bottom:20px;box-shadow:0 10px 40px rgba(74,222,128,0.3);border:3px solid rgba(74,222,128,0.5);animation:pulse-glow 2s ease-in-out infinite;">';
        if (ai.avatar) {
            html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:' + avatarColor + ';color:white;">' + ai.name.charAt(0) + '</div>';
        }
        html += '</div>';
        
        // 名字和状态
        html += '<div style="font-size:24px;font-weight:600;color:white;margin-bottom:8px;">' + ai.name + '</div>';
        html += '<div style="font-size:14px;color:rgba(255,255,255,0.7);">邀请你' + (isVideo ? '视频通话' : '语音通话') + '...</div>';
        
        // 按钮
        html += '<div style="display:flex;gap:60px;margin-top:50px;">';
        // 拒绝
        html += '<div style="text-align:center;">';
        html += '<button id="decline-call-btn" style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#FF3B30,#FF6B6B);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(255,59,48,0.4);">';
        html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>';
        html += '</button>';
        html += '<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:10px;">拒绝</div>';
        html += '</div>';
        // 接听
        html += '<div style="text-align:center;">';
        html += '<button id="accept-call-btn" style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(74,222,128,0.4);">';
        html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>';
        html += '</button>';
        html += '<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:10px;">接听</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<style>';
        html += '@keyframes pulse-glow { 0%,100% { box-shadow:0 10px 40px rgba(74,222,128,0.3),0 0 0 0 rgba(74,222,128,0.4); } 50% { box-shadow:0 10px 40px rgba(74,222,128,0.3),0 0 0 20px rgba(74,222,128,0); } }';
        html += '</style>';
        html += '</div>';
        
        var overlay = document.createElement('div');
        overlay.innerHTML = html;
        
        // 添加到手机屏幕内而非document.body
        var container = this.appWindow || document.getElementById('phone-screen');
        if (container) {
            container.appendChild(overlay.firstChild);
        } else {
            document.body.appendChild(overlay.firstChild);
        }
        
        var incomingOverlay = document.querySelector('.incoming-call-overlay');
        
        // 拒绝按钮
        document.getElementById('decline-call-btn').onclick = function() {
            incomingOverlay.remove();
            self.showToast('已拒绝通话');
        };
        
        // 接听按钮
        document.getElementById('accept-call-btn').onclick = function() {
            incomingOverlay.remove();
            // 标记这是一个来电（AI主动打来的）
            self.isIncomingCall = true;
            self.startCall(aiId, callType);
        };
        
        // 30秒后自动挂断
        setTimeout(function() {
            if (document.querySelector('.incoming-call-overlay')) {
                document.querySelector('.incoming-call-overlay').remove();
                self.showToast('来电已挂断');
            }
        }, 30000);
    };

    ChatApp.prototype.getCurrentWeather = function() {
        // 从天气App获取当前天气
        // 优先使用当前面具绑定的城市，否则使用真实城市
        var weatherApp = PhoneCore.apps && PhoneCore.apps['weather-app'];
        if (weatherApp && weatherApp.weatherCache) {
            var mask = PhoneCore.user.getCurrentMask();
            var city = (mask && mask.city) ? mask.city : (PhoneCore.user.realInfo && PhoneCore.user.realInfo.city);
            
            if (city && weatherApp.weatherCache[city]) {
                var w = weatherApp.weatherCache[city];
                return city + '：' + w.description + '，' + w.temperature + '°C，湿度' + w.humidity + '%';
            }
        }
        
        // 如果没有天气数据，返回时间相关的默认描述
        var hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return '早晨';
        if (hour >= 12 && hour < 18) return '下午';
        if (hour >= 18 && hour < 22) return '傍晚';
        return '夜晚';
    };
    
    // 加载用户朋友圈到缓存
    ChatApp.prototype.loadUserMomentsCache = function() {
        var self = this;
        return new Promise(function(resolve) {
            if (!PhoneCore.db) {
                self._userMomentsCache = [];
                resolve();
                return;
            }
            PhoneCore.db.getAll('app_data').then(function(dataList) {
                var userMoments = dataList.filter(function(d) {
                    return d.appId && d.appId.indexOf('user_moments_') === 0 && d.data;
                }).map(function(d) {
                    return d.data;
                });
                // 按时间排序，最新的在前面
                userMoments.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });
                self._userMomentsCache = userMoments;
                resolve();
            }).catch(function(err) {
                console.error('加载用户朋友圈缓存失败:', err);
                self._userMomentsCache = [];
                resolve();
            });
        });
    };
    
    // 构建朋友圈上下文
    ChatApp.prototype.buildMomentsContext = function(ai, mask) {
        var self = this;
        var config = ai.momentsReadConfig || { self: 3, user: 3, social: 3 };
        var contextParts = [];
        
        // 1. AI自己发的朋友圈
        if (config.self > 0 && ai.moments && ai.moments.length > 0) {
            var selfMoments = ai.moments.slice(0, config.self);
            if (selfMoments.length > 0) {
                var selfContext = '【你最近发的朋友圈】\n';
                selfMoments.forEach(function(m, i) {
                    var timeStr = new Date(m.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    selfContext += (i + 1) + '. ' + timeStr + '：' + (m.content || '[图片]');
                    // 添加用户评论
                    if (m.comments && m.comments.length > 0) {
                        selfContext += '\n   评论：';
                        m.comments.slice(-3).forEach(function(c) {
                            selfContext += c.author + '说"' + c.content + '" ';
                        });
                    }
                    selfContext += '\n';
                });
                contextParts.push(selfContext);
            }
        }
        
        // 2. 用户发的朋友圈（从已加载的朋友圈列表获取）
        if (config.user > 0) {
            // 获取用户朋友圈 - 这里简化处理，从缓存或内存中获取
            var userName = mask ? mask.name : '用户';
            if (this._userMomentsCache && this._userMomentsCache.length > 0) {
                var userMoments = this._userMomentsCache.slice(0, config.user);
                if (userMoments.length > 0) {
                    var userContext = '【' + userName + '最近发的朋友圈】（你可以用[评论朋友圈:' + userName + ':评论内容]来评论）\n';
                    userMoments.forEach(function(m, i) {
                        var timeStr = new Date(m.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        userContext += (i + 1) + '. ' + timeStr + '：' + (m.content || '[图片]');
                        // 添加评论区内容
                        if (m.comments && m.comments.length > 0) {
                            userContext += '\n   评论区：';
                            m.comments.slice(-4).forEach(function(c) {
                                var replyPart = c.replyTo ? '回复' + c.replyTo + '：' : '';
                                userContext += c.author + replyPart + '"' + c.content + '" ';
                            });
                        }
                        userContext += '\n';
                    });
                    contextParts.push(userContext);
                }
            }
        }
        
        // 3. 交际圈其他AI的朋友圈
        if (config.social > 0 && ai.socialCircle && ai.socialCircle.length > 0) {
            var socialMoments = [];
            // 【修复】根据配置动态计算每个好友取多少条，确保能凑够 config.social 条
            var friendCount = ai.socialCircle.length;
            var perFriendCount = Math.max(2, Math.ceil(config.social / Math.max(1, friendCount)));
            
            ai.socialCircle.forEach(function(friendId) {
                var friend = PhoneCore.getAI(friendId);
                if (friend && friend.moments && friend.moments.length > 0) {
                    friend.moments.slice(0, perFriendCount).forEach(function(m) {
                        socialMoments.push({
                            aiName: friend.name,
                            content: m.content,
                            timestamp: m.timestamp,
                            comments: m.comments || []
                        });
                    });
                }
            });
            
            // 按时间排序，取最新的几条
            socialMoments.sort(function(a, b) { return b.timestamp - a.timestamp; });
            socialMoments = socialMoments.slice(0, config.social);
            
            if (socialMoments.length > 0) {
                var socialContext = '【你的朋友们最近发的朋友圈】（你可以用[评论朋友圈:发布者名字:评论内容]来评论，或用[回复朋友圈评论:发布者名字:被回复人:回复内容]来回复评论区的某人）\n';
                socialMoments.forEach(function(m, i) {
                    var timeStr = new Date(m.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    socialContext += (i + 1) + '. ' + m.aiName + ' ' + timeStr + '：' + (m.content || '[图片]');
                    // 添加评论区内容
                    if (m.comments && m.comments.length > 0) {
                        socialContext += '\n   评论区：';
                        m.comments.slice(-4).forEach(function(c) {
                            var replyPart = c.replyTo ? '回复' + c.replyTo + '：' : '';
                            socialContext += c.author + replyPart + '"' + c.content + '" ';
                        });
                    }
                    socialContext += '\n';
                });
                contextParts.push(socialContext);
            }
        }
        
        if (contextParts.length > 0) {
            return '【朋友圈动态】以下是你能看到的朋友圈内容，你可以主动评论或回复评论区的互动：\n' + contextParts.join('\n');
        }
        
        return '';
    };
    
    // 【构建一起听上下文】当正在和AI一起听音乐时，添加歌曲和歌词信息
    ChatApp.prototype.buildListenTogetherContext = function(aiId) {
        // 检查是否正在和这个AI一起听
        if (typeof MusicPlayerState === 'undefined' || !MusicPlayerState.listenTogether) {
            return '';
        }
        
        var lt = MusicPlayerState.listenTogether;
        if (!lt.active || lt.aiId !== aiId) {
            return '';
        }
        
        var currentSong = MusicPlayerState.currentSong;
        if (!currentSong) {
            return '【一起听状态】你正在和用户一起听音乐，但当前没有播放歌曲。你可以推荐一首歌或者聊聊音乐相关的话题。';
        }
        
        var context = '【一起听音乐中】你正在和用户一起听音乐，这是一个很好的互动时刻！\n';
        context += '当前播放：' + currentSong.title + ' - ' + currentSong.artist + '\n';
        
        // 添加歌词信息
        var lyrics = currentSong.lyrics;
        if (lyrics && lyrics.length > 0) {
            context += '歌词内容：\n';
            lyrics.forEach(function(line) {
                if (line.text && !line.text.includes('♪')) {
                    context += line.text + '\n';
                }
            });
        }
        
        // 计算已一起听的时间
        if (lt.startTime) {
            var duration = Math.floor((Date.now() - lt.startTime) / 1000);
            var mins = Math.floor(duration / 60);
            var secs = duration % 60;
            context += '\n已一起听：' + mins + '分' + secs + '秒\n';
        }
        
        context += '\n你可以：\n- 分享对这首歌的感受\n- 聊聊歌词内容\n- 推荐类似的歌曲\n- 回忆和这首歌相关的故事';
        
        return context;
    };
    
    // 【构建微博上下文】让AI能看到微博动态信息
    ChatApp.prototype.buildWeiboContext = function(aiId) {
        var self = this;
        
        // 获取微博数据源配置
        var weiboDataSource = (PhoneCore.data && PhoneCore.data.weiboDataSource) || {};
        var allowAIReadUserPosts = weiboDataSource.allowAIReadUserPosts !== false; // 默认允许
        var syncAIPostsToContext = weiboDataSource.syncAIPostsToContext !== false; // 默认开启
        
        // 获取微博应用实例
        var weiboApp = PhoneCore.apps && PhoneCore.apps['weibo-app'];
        if (!weiboApp) {
            return '';
        }
        
        var contextParts = [];
        var ai = PhoneCore.getAI ? PhoneCore.getAI(aiId) : null;
        var aiName = ai ? ai.name : 'AI';
        var userName = PhoneCore.user && PhoneCore.user.name ? PhoneCore.user.name : '用户';
        
        // 获取当前面具名称
        var mask = PhoneCore.user && PhoneCore.user.getCurrentMask ? PhoneCore.user.getCurrentMask() : null;
        if (mask && mask.name) {
            userName = mask.name;
        }
        
        // 时间格式化辅助函数
        function formatTime(timestamp) {
            var now = Date.now();
            var diff = now - timestamp;
            var minutes = Math.floor(diff / 60000);
            var hours = Math.floor(diff / 3600000);
            var days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return '刚刚';
            if (minutes < 60) return minutes + '分钟前';
            if (hours < 24) return hours + '小时前';
            if (days < 7) return days + '天前';
            
            var date = new Date(timestamp);
            return (date.getMonth() + 1) + '月' + date.getDate() + '日';
        }
        
        // 1. 用户最近发的微博
        if (allowAIReadUserPosts) {
            var userPosts = weiboApp.getPostsVisibleToAI ? weiboApp.getPostsVisibleToAI(aiId) : [];
            if (userPosts && userPosts.length > 0) {
                var userPostsContext = '【' + userName + '最近发的微博】\n';
                userPosts.slice(0, 5).forEach(function(post, i) {
                    var content = (post.content || '').substring(0, 100);
                    if (post.content && post.content.length > 100) content += '...';
                    
                    userPostsContext += (i + 1) + '. ' + formatTime(post.timestamp) + '发布："' + content + '"';
                    
                    // 添加互动数据
                    var interactions = [];
                    if (post.likes > 0) interactions.push(post.likes + '个赞');
                    if (post.comments > 0) interactions.push(post.comments + '条评论');
                    if (post.reposts > 0) interactions.push(post.reposts + '次转发');
                    if (interactions.length > 0) {
                        userPostsContext += '（获得' + interactions.join('、') + '）';
                    }
                    
                    // 如果AI点赞或评论过这条微博，标注出来
                    if (post.likedBy && post.likedBy.indexOf(aiId) >= 0) {
                        userPostsContext += ' [你点赞过]';
                    }
                    
                    userPostsContext += '\n';
                });
                contextParts.push(userPostsContext);
            }
        }
        
        // 2. 用户点赞/评论过的内容概要
        if (allowAIReadUserPosts) {
            var likedPosts = weiboApp.getLikedPosts ? weiboApp.getLikedPosts() : [];
            if (likedPosts && likedPosts.length > 0) {
                // 获取最近点赞的帖子（非用户自己的）
                var recentLiked = likedPosts.filter(function(post) {
                    return post.authorId !== 'user' && post.authorType !== 'user';
                }).slice(0, 3);
                
                if (recentLiked.length > 0) {
                    var likedContext = '【' + userName + '最近点赞的微博】\n';
                    recentLiked.forEach(function(post) {
                        var authorName = '某人';
                        if (post.authorType === 'ai') {
                            var author = PhoneCore.getAI ? PhoneCore.getAI(post.authorId) : null;
                            if (author) authorName = author.name;
                        }
                        var content = (post.content || '').substring(0, 50);
                        if (post.content && post.content.length > 50) content += '...';
                        likedContext += '- 点赞了' + authorName + '的微博："' + content + '"\n';
                    });
                    contextParts.push(likedContext);
                }
            }
        }
        
        // 3. AI自己发布的微博互动情况（如果开启了同步AI微博到上下文）
        if (syncAIPostsToContext && aiId) {
            var allPosts = weiboApp.getPosts ? weiboApp.getPosts() : [];
            var aiPosts = allPosts.filter(function(post) {
                return post.authorId === aiId && post.authorType === 'ai';
            }).slice(0, 3);
            
            if (aiPosts.length > 0) {
                var aiPostsContext = '【你最近发的微博】\n';
                aiPosts.forEach(function(post, i) {
                    var content = (post.content || '').substring(0, 60);
                    if (post.content && post.content.length > 60) content += '...';
                    
                    aiPostsContext += (i + 1) + '. ' + formatTime(post.timestamp) + '："' + content + '"';
                    
                    // 添加互动数据
                    var interactions = [];
                    if (post.likes > 0) interactions.push(post.likes + '个赞');
                    if (post.comments > 0) interactions.push(post.comments + '条评论');
                    if (post.reposts > 0) interactions.push(post.reposts + '次转发');
                    if (interactions.length > 0) {
                        aiPostsContext += '（获得' + interactions.join('、') + '）';
                    }
                    
                    // 如果用户点赞过，特别标注
                    if (post.likedBy && post.likedBy.indexOf('user') >= 0) {
                        aiPostsContext += ' [' + userName + '点赞了]';
                    }
                    
                    aiPostsContext += '\n';
                    
                    // 获取这条微博的评论
                    var comments = weiboApp.getComments ? weiboApp.getComments(post.id) : [];
                    if (comments && comments.length > 0) {
                        var recentComments = comments.slice(-2);
                        recentComments.forEach(function(c) {
                            var commenterName = '某人';
                            if (c.authorType === 'user' || c.authorId === 'user') {
                                commenterName = userName;
                            } else if (c.authorType === 'ai') {
                                var commenter = PhoneCore.getAI ? PhoneCore.getAI(c.authorId) : null;
                                if (commenter) commenterName = commenter.name;
                            }
                            aiPostsContext += '   └ ' + commenterName + '评论："' + (c.content || '').substring(0, 30) + '"\n';
                        });
                    }
                });
                contextParts.push(aiPostsContext);
            }
        }
        
        // 4. AI关注的其他AI的微博动态（如果AI有社交圈配置）
        if (ai && ai.socialCircle && ai.socialCircle.length > 0) {
            var allPosts = weiboApp.getPosts ? weiboApp.getPosts() : [];
            var socialPosts = [];
            
            ai.socialCircle.forEach(function(friendId) {
                var friendPosts = allPosts.filter(function(post) {
                    return post.authorId === friendId && post.authorType === 'ai';
                }).slice(0, 2);
                
                friendPosts.forEach(function(post) {
                    var friend = PhoneCore.getAI ? PhoneCore.getAI(friendId) : null;
                    if (friend) {
                        socialPosts.push({
                            friendName: friend.name,
                            content: post.content,
                            timestamp: post.timestamp,
                            likes: post.likes || 0,
                            comments: post.comments || 0
                        });
                    }
                });
            });
            
            // 按时间排序取最新的
            socialPosts.sort(function(a, b) { return b.timestamp - a.timestamp; });
            socialPosts = socialPosts.slice(0, 3);
            
            if (socialPosts.length > 0) {
                var socialContext = '【你的朋友们的微博动态】\n';
                socialPosts.forEach(function(sp) {
                    var content = (sp.content || '').substring(0, 50);
                    if (sp.content && sp.content.length > 50) content += '...';
                    socialContext += '- ' + sp.friendName + ' ' + formatTime(sp.timestamp) + '："' + content + '"';
                    if (sp.likes > 0 || sp.comments > 0) {
                        socialContext += '（' + sp.likes + '赞/' + sp.comments + '评论）';
                    }
                    socialContext += '\n';
                });
                contextParts.push(socialContext);
            }
        }
        
        // 5. 用户与AI微博的互动事件（触发AI主动提起）
        if (weiboApp.getChatTriggerEvents) {
            var triggerEvents = weiboApp.getChatTriggerEvents(aiId, true); // 获取并标记为已消费
            
            if (triggerEvents && triggerEvents.length > 0) {
                var interactionContext = '【重要：' + userName + '最近与你的微博互动】\n';
                interactionContext += '你应该在对话中自然地提起这些互动，表现出你注意到了：\n';
                
                triggerEvents.forEach(function(event) {
                    var eventDesc = '';
                    var postContent = event.eventData && event.eventData.postContent ? event.eventData.postContent : '某条微博';
                    
                    switch (event.eventType) {
                        case 'userLiked':
                            eventDesc = '- ' + userName + '点赞了你的微博："' + postContent + '"';
                            eventDesc += '\n  （可以说"谢谢你给我点赞"或"我看到你赞了我那条微博"等）';
                            break;
                        case 'userCommented':
                            var commentContent = event.eventData && event.eventData.commentContent ? event.eventData.commentContent : '评论';
                            eventDesc = '- ' + userName + '评论了你的微博："' + postContent + '"';
                            eventDesc += '\n  评论内容："' + commentContent.substring(0, 50) + '"';
                            eventDesc += '\n  （可以回应这条评论，表示你看到了）';
                            break;
                        case 'userReposted':
                            eventDesc = '- ' + userName + '转发了你的微博："' + postContent + '"';
                            eventDesc += '\n  （可以表达感谢或讨论转发的内容）';
                            break;
                    }
                    
                    if (eventDesc) {
                        interactionContext += eventDesc + '\n';
                    }
                });
                
                interactionContext += '\n提示：自然地在对话中提起，不要生硬地说"我看到通知"，而是像真人一样自然地聊起。';
                contextParts.push(interactionContext);
            }
        }
        
        // 组合所有上下文
        if (contextParts.length > 0) {
            return '【微博动态】以下是你能看到的微博信息：\n' + contextParts.join('\n');
        }
        
        return '';
    };
    
    // 【构建群聊记忆上下文】让AI在私聊中知道群聊中发生的事情
    // 注意：此函数始终获取群聊的【当前显示内容】，如果群聊内容被封存/恢复操作改变，互通记忆也会同步更新
    ChatApp.prototype.buildGroupChatMemoryContext = function(aiId) {
        var self = this;
        
        // 重新获取最新的群聊数据（确保获取当前显示的内容）
        var groupChats = this.getAllGroupChats();
        if (!groupChats || groupChats.length === 0) {
            return '';
        }
        
        // 找到包含这个AI的群聊
        var relevantGroups = groupChats.filter(function(group) {
            return group.members && group.members.includes(aiId);
        });
        
        if (relevantGroups.length === 0) {
            return '';
        }
        
        var context = '【群聊记忆互通 - 当前显示内容】你和用户共同在一些群聊中，以下是群聊的当前内容摘要（如果群聊内容有变化，此记忆会同步更新）：\n';
        
        relevantGroups.forEach(function(group) {
            // 重新从存储中获取最新的群聊数据
            var latestGroup = self.getGroupChat(group.id);
            if (!latestGroup) latestGroup = group;
            
            if (!latestGroup.chatHistory || latestGroup.chatHistory.length === 0) {
                context += '\n群聊"' + latestGroup.name + '"：暂无聊天记录\n';
                return;
            }
            
            // 获取最近8条非系统消息（增加数量以提供更多上下文）
            var recentMsgs = latestGroup.chatHistory.filter(function(msg) {
                return msg.type !== 'system' && msg.role !== 'system' && msg.content;
            }).slice(-8);
            
            if (recentMsgs.length === 0) {
                return;
            }
            
            context += '\n群聊"' + latestGroup.name + '"（共' + latestGroup.chatHistory.length + '条消息）：';
            if (latestGroup.announcement) {
                context += '（公告：' + latestGroup.announcement.substring(0, 50) + '）';
            }
            context += '\n';
            
            recentMsgs.forEach(function(msg) {
                // 游戏记录只显示梗概
                if (msg.type === 'game_record' && msg.gameRecord) {
                    var record = msg.gameRecord;
                    if (record.gameType === 'undercover') {
                        var ucWinnerText = record.winner === 'civilian' ? '平民胜利' : '卧底胜利';
                        context += '- [谁是卧底游戏: ' + record.playerCount + '人局，' + ucWinnerText + '。' + (record.summary || '') + ']\n';
                    } else {
                        var winnerText = record.winner === 'village' ? '好人阵营胜利' : record.winner === 'wolf' ? '狼人阵营胜利' : '情侣胜利';
                        context += '- [狼人杀游戏: ' + record.playerCount + '人局，' + winnerText + '。' + (record.summary || '') + ']\n';
                    }
                    return;
                }
                var senderName = msg.senderName || (msg.role === 'user' ? '用户' : '某人');
                var content = (msg.content || '').substring(0, 80);
                context += '- ' + senderName + ': ' + content + '\n';
            });
        });
        
        context += '\n注意：以上是群聊的【当前显示内容】。私聊和群聊是不同的场景，除非用户主动问起群聊的事情，否则不要在私聊中提及群聊内容。';
        
        return context;
    };
    
    // 【探店/购物记忆】从商店App获取探店和购物记忆
    ChatApp.prototype.getShopTheaterMemory = function(aiId) {
        // 尝试获取ShopApp实例
        var shopApp = null;
        if (typeof ShopApp !== 'undefined') {
            // 查找已实例化的ShopApp
            var appContainers = document.querySelectorAll('.app-window');
            for (var i = 0; i < appContainers.length; i++) {
                var container = appContainers[i];
                if (container.id && container.id.indexOf('shop') !== -1) {
                    // 尝试从全局获取shopApp实例
                    if (window.shopAppInstance) {
                        shopApp = window.shopAppInstance;
                        break;
                    }
                }
            }
            
            // 如果没有实例，尝试从PhoneCore获取
            if (!shopApp && typeof PhoneCore !== 'undefined' && PhoneCore.apps) {
                // PhoneCore.apps 是对象而非数组，需要使用 Object.values 转换
                var appsArray = Object.values(PhoneCore.apps);
                var shopAppInfo = appsArray.find(function(app) {
                    return app.id === 'shop-app' || app.name === '韩味购物';
                });
                if (shopAppInfo && shopAppInfo.instance) {
                    shopApp = shopAppInfo.instance;
                }
            }
        }
        
        // 如果找不到ShopApp实例，尝试从数据库直接读取
        if (!shopApp) {
            return this.getShopTheaterMemoryFromDB(aiId);
        }
        
        // 使用ShopApp的方法获取记忆
        if (shopApp.formatTheaterMemoryPrompt) {
            return shopApp.formatTheaterMemoryPrompt(aiId);
        }
        
        return '';
    };
    
    // 从数据库直接读取探店记忆（备用方案）
    ChatApp.prototype.getShopTheaterMemoryFromDB = function(aiId) {
        var self = this;
        
        // 这个函数需要同步返回，但数据库是异步的
        // 所以我们使用缓存机制
        if (!this._shopTheaterMemoryCache) {
            this._shopTheaterMemoryCache = {};
            this._shopTheaterMemoryCacheTime = 0;
        }
        
        // 缓存5分钟
        var now = Date.now();
        if (now - this._shopTheaterMemoryCacheTime > 5 * 60 * 1000) {
            // 异步加载数据到缓存
            this.loadShopTheaterMemoryToCache();
        }
        
        // 检查这个AI是否有记忆权限
        var memoryAIs = this._shopTheaterMemoryCache.memoryAIs || [];
        if (memoryAIs.indexOf(aiId) === -1) {
            return '';
        }
        
        // 获取概括和相关记录
        var summary = this._shopTheaterMemoryCache.summary || '';
        var records = this._shopTheaterMemoryCache.records || [];
        
        // 筛选与该AI相关的记录
        var relatedRecords = records.filter(function(t) {
            return t.aiIds && t.aiIds.indexOf(aiId) !== -1;
        });
        
        if (!summary && relatedRecords.length === 0) {
            return '';
        }
        
        var prompt = '';
        
        if (summary) {
            prompt += '[用户购物/探店记忆]\n' + summary + '\n';
        }
        
        if (relatedRecords.length > 0) {
            prompt += '\n[与你相关的经历]\n';
            relatedRecords.slice(0, 5).forEach(function(r) {
                var date = new Date(r.date);
                var dateStr = (date.getMonth() + 1) + '月' + date.getDate() + '日';
                var typeText = r.type === 'explore' ? '探店' : (r.type === 'gift' ? '送礼' : '购物');
                prompt += '- ' + dateStr + ' ' + typeText + ': ' + (r.title || r.storeName || r.productName || '活动') + '\n';
            });
        }
        
        return prompt;
    };
    
    // 加载探店记忆到缓存
    ChatApp.prototype.loadShopTheaterMemoryToCache = function() {
        var self = this;
        
        // 加载AI记忆设置
        PhoneCore.db.get('app_data', 'shop-theater-memory-ais').then(function(data) {
            if (data && data.items) {
                self._shopTheaterMemoryCache.memoryAIs = data.items;
            }
        });
        
        // 加载概括
        PhoneCore.db.get('app_data', 'shop-theater-summary').then(function(data) {
            if (data && data.content) {
                self._shopTheaterMemoryCache.summary = data.content;
            }
        });
        
        // 加载记录
        PhoneCore.db.get('app_data', 'shop-theater-records').then(function(data) {
            if (data && data.items) {
                self._shopTheaterMemoryCache.records = data.items;
            }
        });
        
        this._shopTheaterMemoryCacheTime = Date.now();
    };

    // ============ 群聊单聊互通 - 跨场景消息功能 ============
    
    // 【跨场景互动】尝试在另一个场景发送消息
    // sourceType: 'private'(私聊) 或 'group'(群聊)
    // sourceId: 群聊时为groupId，私聊时为null
    // lastAiReply: AI刚才的回复内容（用于生成相关的跨场景消息）
    ChatApp.prototype.tryCrossChatInteraction = function(aiId, sourceType, sourceId, lastAiReply) {
        var self = this;
        
        // 检查记忆互通是否开启
        var memorySync = PhoneCore.user.groupMemorySync || { enabled: false, aiIds: [] };
        var syncAiIds = memorySync.aiIds || (memorySync.aiId ? [memorySync.aiId] : []);
        
        if (!memorySync.enabled || syncAiIds.indexOf(aiId) === -1) {
            return; // 未开启互通或该AI不在互通列表中
        }
        
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 概率控制：15%的概率触发跨场景消息
        var triggerChance = 0.15;
        if (Math.random() > triggerChance) {
            return; // 未触发
        }
        
        if (sourceType === 'private') {
            // 私聊 → 群聊：尝试在相关群聊中发言
            this.tryPrivateToGroupMessage(aiId, lastAiReply);
        } else if (sourceType === 'group') {
            // 群聊 → 私聊：尝试私下跟用户说悄悄话
            this.tryGroupToPrivateMessage(aiId, sourceId, lastAiReply);
        }
    };
    
    // 【私聊→群聊】AI在私聊时有概率在群聊里发消息
    ChatApp.prototype.tryPrivateToGroupMessage = function(aiId, lastAiReply) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 找到该AI所在的群聊
        var groupChats = this.getAllGroupChats();
        var relevantGroups = groupChats.filter(function(group) {
            return group.members && group.members.includes(aiId);
        });
        
        if (relevantGroups.length === 0) return;
        
        // 随机选择一个群聊
        var targetGroup = relevantGroups[Math.floor(Math.random() * relevantGroups.length)];
        
        // 获取群聊最近的消息作为上下文
        var groupContext = '';
        if (targetGroup.chatHistory && targetGroup.chatHistory.length > 0) {
            var recentMsgs = targetGroup.chatHistory.slice(-5).filter(function(msg) {
                return msg.type !== 'system' && msg.role !== 'system';
            });
            groupContext = recentMsgs.map(function(msg) {
                var senderName = msg.senderName || (msg.role === 'user' ? '用户' : '某人');
                return senderName + ': ' + (msg.content || '').substring(0, 50);
            }).join('\n');
        }
        
        // 生成群聊消息
        this.generateCrossChatMessage(aiId, 'toGroup', {
            groupName: targetGroup.name,
            groupContext: groupContext,
            privateReply: lastAiReply
        }).then(function(message) {
            if (message) {
                self.sendBackgroundMessageToGroup(targetGroup.id, aiId, message);
            }
        });
    };
    
    // 【群聊→私聊】AI在群聊时有概率私下跟用户说悄悄话
    ChatApp.prototype.tryGroupToPrivateMessage = function(aiId, groupId, lastAiReply) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        // 获取私聊最近的消息作为上下文
        var privateContext = '';
        if (ai.chatHistory && ai.chatHistory.length > 0) {
            var recentMsgs = ai.chatHistory.slice(-5).filter(function(msg) {
                return !msg.isCallMessage && msg.type !== 'system';
            });
            privateContext = recentMsgs.map(function(msg) {
                var prefix = msg.role === 'user' ? '用户' : ai.name;
                return prefix + ': ' + (msg.content || '').substring(0, 50);
            }).join('\n');
        }
        
        // 生成私聊消息
        this.generateCrossChatMessage(aiId, 'toPrivate', {
            groupName: group.name,
            groupReply: lastAiReply,
            privateContext: privateContext
        }).then(function(message) {
            if (message) {
                self.sendBackgroundMessageToPrivate(aiId, message);
            }
        });
    };
    
    // 【生成跨场景消息】使用API生成自然的跨场景消息
    ChatApp.prototype.generateCrossChatMessage = function(aiId, direction, context) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return Promise.resolve(null);
        
        // 获取API配置
        var apiConfigId = ai.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configKeys = Object.keys(PhoneCore.api.configs);
            if (configKeys.length > 0) {
                apiConfigId = configKeys[0];
            }
        }
        
        if (!apiConfigId) {
            return Promise.resolve(null);
        }
        
        var systemPrompt = '你是' + ai.name + '。';
        if (ai.personality) {
            systemPrompt += '你的性格特点：' + ai.personality + '。';
        }
        
        var userPrompt = '';
        
        if (direction === 'toGroup') {
            // 私聊→群聊
            systemPrompt += '\n\n你正在和用户私聊，但你也在一个群聊里。';
            systemPrompt += '\n你想在群聊"' + context.groupName + '"里随意发一句话，可以是：';
            systemPrompt += '\n- 和群聊内容相关的评论';
            systemPrompt += '\n- 分享一些有趣的事情';
            systemPrompt += '\n- 问候群友';
            systemPrompt += '\n- 或者任何你想说的话';
            systemPrompt += '\n\n【重要】';
            systemPrompt += '\n1. 只输出一句话，不要太长（10-30字为佳）';
            systemPrompt += '\n2. 不要暴露你正在和用户私聊的内容';
            systemPrompt += '\n3. 要自然随意，像是平时在群里冒泡';
            systemPrompt += '\n4. 不要带任何前缀、引号或标点开头';
            
            userPrompt = '【群聊最近消息】\n' + (context.groupContext || '（暂无消息）');
            userPrompt += '\n\n请在群里发一句话：';
        } else if (direction === 'toPrivate') {
            // 群聊→私聊
            systemPrompt += '\n\n你正在群聊"' + context.groupName + '"里聊天，你想私下悄悄跟用户说点什么。';
            systemPrompt += '\n可以是：';
            systemPrompt += '\n- 关于群聊内容的私下吐槽';
            systemPrompt += '\n- 只想对用户说的悄悄话';
            systemPrompt += '\n- 不方便在群里说的话';
            systemPrompt += '\n- 单独找用户聊聊';
            systemPrompt += '\n\n【重要】';
            systemPrompt += '\n1. 只输出一句话，不要太长（10-40字为佳）';
            systemPrompt += '\n2. 要有"私下跟你说"的感觉，让用户觉得特别';
            systemPrompt += '\n3. 可以带点小秘密的氛围';
            systemPrompt += '\n4. 不要带任何前缀、引号或标点开头';
            
            userPrompt = '【你刚在群里说的】\n' + (context.groupReply || '');
            userPrompt += '\n\n【和用户的私聊记录】\n' + (context.privateContext || '（暂无）');
            userPrompt += '\n\n请私下跟用户说一句话：';
        }
        
        return PhoneCore.api.call(systemPrompt, apiConfigId, {
            messages: [{ role: 'user', content: userPrompt }],
            maxTokens: 200,
            temperature: 0.9
        }).then(function(response) {
            var reply = (response.content || '').trim();
            // 清理可能的格式问题
            reply = reply.replace(/^["'「『【]/, '').replace(/["'」』】]$/, '');
            reply = reply.replace(/^[：:]\s*/, '');
            reply = reply.replace(new RegExp('^' + ai.name + '[：:：]\\s*', 'i'), '');
            
            // 如果回复太长或太短，返回null
            if (reply.length < 2 || reply.length > 100) {
                return null;
            }
            
            return reply;
        }).catch(function(err) {
            console.error('生成跨场景消息失败:', err);
            return null;
        });
    };
    
    // 【后台发送群聊消息】不打开群聊页面，直接添加消息
    ChatApp.prototype.sendBackgroundMessageToGroup = function(groupId, aiId, content) {
        var self = this;
        var group = this.getGroupChat(groupId);
        if (!group) return;
        
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        if (!group.chatHistory) {
            group.chatHistory = [];
        }
        
        // 获取AI在群内的昵称
        var senderDisplayName = (group.memberNicknames && group.memberNicknames[aiId]) || ai.name;
        
        var aiMessage = {
            id: 'gmsg_cross_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            role: 'assistant',
            senderId: aiId,
            senderName: senderDisplayName,
            content: content,
            timestamp: Date.now(),
            isCrossChat: true // 标记为跨场景消息
        };
        
        group.chatHistory.push(aiMessage);
        this.saveGroupChat(group);
        
        // 显示通知提示（不打开群聊，只是提醒用户）
        this.showCrossChatNotification('group', group.name, ai.name, content);
        
        // 如果当前正在看这个群聊，刷新消息显示
        if (this.currentGroupChat && this.currentGroupChat.id === groupId) {
            var messagesContainer = this.appWindow ? this.appWindow.querySelector('#messages-container') : null;
            if (messagesContainer) {
                messagesContainer.innerHTML = this.renderGroupMessages(groupId);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                this.bindGroupMessageActions(this.appWindow, groupId);
            }
        }
        
        // 刷新聊天列表
        this.refreshChatList();
    };
    
    // 【后台发送私聊消息】不打开聊天页面，直接添加消息
    ChatApp.prototype.sendBackgroundMessageToPrivate = function(aiId, content) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        if (!ai.chatHistory) {
            ai.chatHistory = [];
        }
        
        var aiMessage = {
            id: 'msg_cross_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            role: 'assistant',
            content: content,
            timestamp: Date.now(),
            isCrossChat: true // 标记为跨场景消息
        };
        
        ai.chatHistory.push(aiMessage);
        PhoneCore.saveAI(ai);
        
        // 显示通知提示
        this.showCrossChatNotification('private', null, ai.name, content);
        
        // 如果当前正在看这个AI的私聊，刷新消息显示
        if (this.currentAI && this.currentAI.id === aiId && this.appWindow) {
            var messagesContainer = this.appWindow.querySelector('#messages-container');
            if (messagesContainer) {
                messagesContainer.innerHTML = this.renderMessages(aiId);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                this.bindMessageActions(this.appWindow, aiId);
            }
        }
        
        // 刷新聊天列表
        this.refreshChatList();
    };
    
    // 【跨场景消息通知】显示一个轻量的通知
    ChatApp.prototype.showCrossChatNotification = function(type, groupName, aiName, content) {
        // 创建通知元素
        var notification = document.createElement('div');
        notification.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 20px;border-radius:12px;z-index:99999;max-width:300px;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:slideDown 0.3s ease;';
        
        var icon = type === 'group' ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
        var title = type === 'group' ? '群聊 · ' + groupName : '私信';
        var preview = content.length > 30 ? content.substring(0, 30) + '...' : content;
        
        notification.innerHTML = '<div style="display:flex;align-items:flex-start;gap:10px;">' +
            '<span style="font-size:18px;">' + icon + '</span>' +
            '<div>' +
                '<div style="font-weight:600;margin-bottom:4px;">' + aiName + '</div>' +
                '<div style="font-size:11px;color:#aaa;margin-bottom:2px;">' + title + '</div>' +
                '<div style="color:#ddd;">' + preview + '</div>' +
            '</div>' +
        '</div>';
        
        document.body.appendChild(notification);
        
        // 3秒后自动消失
        setTimeout(function() {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(function() {
                notification.remove();
            }, 300);
        }, 3000);
    };

    // 获取AI所在城市的天气
    ChatApp.prototype.getAIWeather = function(ai) {
        // 如果AI绑定了城市
        if (ai.weatherCity && ai.weatherCity.realCity) {
            var weatherApp = PhoneCore.apps && PhoneCore.apps['weather-app'];
            if (weatherApp && weatherApp.weatherCache) {
                var realCity = ai.weatherCity.realCity;
                var displayCity = ai.weatherCity.mappedName || realCity;
                
                if (weatherApp.weatherCache[realCity]) {
                    var w = weatherApp.weatherCache[realCity];
                    return displayCity + '：' + w.description + '，' + w.temperature + '°C，湿度' + w.humidity + '%';
                }
            }
        }
        
        // 回退到默认的天气获取方式
        return this.getCurrentWeather();
    };

    ChatApp.prototype.showBlockedMessage = function(page) {
        var chatStatus = page.querySelector('#chat-status');
        if (chatStatus) {
            chatStatus.textContent = '已拉黑';
            chatStatus.style.color = '#FF3B30';
        }
    };

    // 通话功能 - 完整通话页面与灵动岛联动
    ChatApp.prototype.startCall = function(aiId, type) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 【重要】检查是否已经在通话中（最小化状态）
        // 如果是同一个AI的通话且没有挂断，则恢复通话而不是开始新通话
        if (this.island.state.inCall && this.callAiId === aiId) {
            // 已经在通话中，恢复通话页面（不重置callSessionStart，保持消息连续）
            this.island.state.isMinimized = false;
            this.openCallPage(aiId, this.island.state.callType);
            
            // 灵动岛切换回quiet模式
            if (typeof DynamicIsland !== 'undefined') {
                DynamicIsland.mode = 'quiet';
                DynamicIsland.updateUI();
            }
            return; // 直接返回，不执行后续的新通话逻辑
        }
        
        // 【重要】在新通话开始时立即设置通话会话开始时间，确保消息能正确关联到本次通话
        this.callSessionStart = Date.now();
        
        // 更新灵动岛状态
        this.island.state.inCall = true;
        this.island.state.callType = type;
        this.island.state.currentChat = ai;
        this.island.state.callStartTime = Date.now();
        this.island.state.callConnectedTime = null; // 接通时间
        this.island.state.callStatus = 'calling'; // calling, connected, ended
        this.island.state.isMuted = false;
        this.island.state.isSpeaker = false;
        this.island.state.isMinimized = false;
        this.callAiId = aiId;
        
        // 打开通话页面
        this.openCallPage(aiId, type);
        
        // 激活灵动岛 - 通话中使用quiet模式（小绿点），点击可展开
        if (typeof DynamicIsland !== 'undefined') {
            DynamicIsland.activeApp = this;
            DynamicIsland.el.removeAttribute('data-expandable'); // 确保可展开
            DynamicIsland.mode = 'quiet'; // 通话中默认显示小绿点
            DynamicIsland.updateUI();
        }
        
        // 检查是否为来电（AI主动打来）
        var isIncoming = this.isIncomingCall;
        this.isIncomingCall = false; // 重置标记
        
        // AI自动接听（模拟1-3秒后接通）
        var connectDelay = 1000 + Math.random() * 2000;
        setTimeout(function() {
            if (self.island.state.inCall && self.island.state.callStatus === 'calling') {
                self.island.state.callStatus = 'connected';
                self.island.state.callConnectedTime = Date.now(); // 记录接通时间
                self.updateCallPageStatus('connected');
                if (typeof DynamicIsland !== 'undefined') {
                    DynamicIsland.updateUI();
                }
                
                // 如果是AI来电，生成AI的初始问候消息
                if (isIncoming) {
                    self.generateIncomingCallGreeting(aiId, type);
                }
            }
        }, connectDelay);
    };
    
    // 生成AI来电时的初始问候（带环境描述）
    ChatApp.prototype.generateIncomingCallGreeting = function(aiId, callType) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 【修复】设置标记，防止用户在AI问候期间发消息导致冲突
        this.isWaitingForIncomingGreeting = true;
        
        var callTypeName = callType === 'video' ? '视频通话' : '语音通话';
        var isVideo = callType === 'video';
        
        // 获取API配置
        var apiConfigId = ai.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configKeys = Object.keys(PhoneCore.api.configs);
            if (configKeys.length > 0) {
                apiConfigId = configKeys[0];
            }
        }
        
        // 无API时使用默认问候
        if (!apiConfigId || !PhoneCore.api || !PhoneCore.api.configs || !PhoneCore.api.configs[apiConfigId]) {
            var defaultGreetings = [
                '喂，你好呀~',
                '终于接了！',
                '嘿，能听到吗？',
                '你好，接通了吧？',
                '喂喂，听得到吗？'
            ];
            var greeting = defaultGreetings[Math.floor(Math.random() * defaultGreetings.length)];
            this.addCallAIMessage(aiId, greeting, callType);
            // 【修复】清除标记
            this.isWaitingForIncomingGreeting = false;
            return;
        }
        
        // 【修复】获取数据订阅配置，构建完整的AI人设上下文
        var dataSub = ai.dataSubscriptions || { weather: true, userCity: true, userProfile: true, time: true };
        
        // 获取用户信息
        var mask = PhoneCore.user.getCurrentMask();
        var userPersona = '';
        var userCity = '';
        
        if (mask) {
            userPersona = dataSub.userProfile !== false ? (PhoneCore.user.getMaskPersonaForAI ? PhoneCore.user.getMaskPersonaForAI(mask.id) : '') : '';
            userCity = dataSub.userCity !== false ? (mask.city || '') : '';
        } else {
            userCity = dataSub.userCity !== false ? (PhoneCore.user.realInfo ? PhoneCore.user.realInfo.city : '') : '';
        }
        
        // 构建通话场景的context
        var context = {
            weather: dataSub.weather !== false ? this.getAIWeather(ai) : '',
            time: dataSub.time !== false ? PhoneCore.time.getFormattedTime() : '',
            app: callType === 'video' ? 'video_call' : 'voice_call',
            userPersona: userPersona,
            userCity: userCity,
            aiCity: ai.weatherCity ? (ai.weatherCity.mappedName || ai.weatherCity.realCity) : ''
        };
        
        // 【修复】使用AI完整的人设prompt，而不是简单的systemPrompt
        var systemPrompt = '';
        try {
            systemPrompt = ai.getPrompt ? ai.getPrompt(context) : '';
        } catch (e) {
            console.error('获取prompt失败:', e);
        }
        if (!systemPrompt) {
            systemPrompt = ai.systemPrompt || ('你是' + (ai.name || 'AI助手') + '，请友好地回复用户。');
        }
        
        systemPrompt += '\n\n【当前状态】你主动发起了' + callTypeName + '，用户刚刚接听。请生成一个自然的开场白，告诉用户你为什么打来。';
        if (isVideo) {
            systemPrompt += '\n如果想描述你的环境/背景，请用括号标注，如（背景看起来像是在咖啡厅里）（画面有些模糊），这些描述会作为系统提示显示。';
        } else {
            systemPrompt += '\n如果想描述声音环境，请用括号标注，如（声音有些沙哑）（背景有些嘈杂），这些描述会作为系统提示显示。';
        }
        systemPrompt += '\n保持语气自然，就像真正在打电话一样，开场白简短即可，一两句话。';
        
        // 【修复】构建聊天历史上下文，让AI知道之前的对话内容
        var recentMessages = [];
        if (ai.chatHistory && ai.chatHistory.length > 0) {
            // 过滤掉通话消息，获取最近的普通聊天记录
            var filteredMessages = ai.chatHistory.filter(function(msg) {
                return !(msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || 
                    msg.type === 'call_system' || msg.fromIsland || msg.isIslandReply);
            });
            
            // 获取最近10条消息作为上下文
            recentMessages = filteredMessages.slice(-10).map(function(msg) {
                var msgContent = String(msg.content || '').trim();
                
                // 处理通话记录卡片
                if (msg.type === 'call_record' && msg.callRecord) {
                    var cr = msg.callRecord;
                    var typeName = cr.callType === 'video' ? '视频通话' : '语音通话';
                    if (cr.summary) {
                        msgContent = '[之前' + typeName + '概括：' + cr.summary + ']';
                    } else {
                        msgContent = '[之前有过' + typeName + ']';
                    }
                    return { role: 'assistant', content: msgContent };
                }
                
                // 处理语音消息
                if (msg.type === 'voice' && msg.voiceContent) {
                    msgContent = msg.voiceContent;
                }
                
                return {
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msgContent
                };
            }).filter(function(msg) {
                return msg && msg.content && msg.content.length > 0;
            });
        }
        
        // 添加来电接听的触发消息
        recentMessages.push({ role: 'user', content: '（用户接听了' + callTypeName + '）' });
        
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call(systemPrompt, apiConfigId, { 
            messages: recentMessages,
            maxTokens: configuredMaxTokens,
            temperature: 0.9
        }).then(function(response) {
            var greeting = response.content || '喂，你好~';
            greeting = greeting.replace(/\[.*?\]/g, '').trim();
            if (!greeting) greeting = '喂，接通了吗？';
            
            self.addCallAIMessage(aiId, greeting, callType);
            // 【修复】清除标记
            self.isWaitingForIncomingGreeting = false;
            // 如果有等待发送的用户消息，现在发送
            if (self.pendingUserCallMessage) {
                var pending = self.pendingUserCallMessage;
                self.pendingUserCallMessage = null;
                self.generateCallResponse(pending.aiId, pending.callType, PhoneCore.getAI(pending.aiId), pending.content);
            }
        }).catch(function(err) {
            console.error('生成来电问候失败:', err);
            self.addCallAIMessage(aiId, '喂，你好~', callType);
            // 【修复】清除标记
            self.isWaitingForIncomingGreeting = false;
        });
    };
    
    // 通话页面 - 精致版设计
    ChatApp.prototype.openCallPage = function(aiId, type) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var avatarColor = this.getAvatarColor(ai.id);
        var isVideo = type === 'video';
        
        // 精致的背景设计
        var bgStyle = isVideo 
            ? 'background:#0a0a0a;' 
            : 'background:linear-gradient(160deg, #0f0f23 0%, #1a1a3e 30%, #2d1b4e 60%, #1f1f3f 100%);';
        
        var html = '<div class="call-page" data-call-type="' + type + '" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;' + bgStyle + 'overflow:hidden;">';
        
        // 动态背景装饰（语音通话）
        if (!isVideo) {
            html += '<div class="call-bg-decor" style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none;z-index:0;">';
            html += '<div style="position:absolute;top:-100px;right:-100px;width:300px;height:300px;background:radial-gradient(circle,rgba(139,92,246,0.15) 0%,transparent 70%);border-radius:50%;animation:floatBg 8s ease-in-out infinite;"></div>';
            html += '<div style="position:absolute;bottom:-50px;left:-50px;width:250px;height:250px;background:radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%);border-radius:50%;animation:floatBg 10s ease-in-out infinite reverse;"></div>';
            html += '<div style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);width:400px;height:400px;background:radial-gradient(circle,rgba(236,72,153,0.08) 0%,transparent 60%);border-radius:50%;animation:pulseBg 4s ease-in-out infinite;"></div>';
            html += '</div>';
        }
        
        // 视频通话背景
        if (isVideo) {
            // 对方视频背景 - 全屏模糊头像
            html += '<div class="remote-video" style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;filter:blur(30px) brightness(0.4);transform:scale(1.1);">';
            } else {
                html += '<div style="width:100%;height:100%;background:linear-gradient(135deg,' + avatarColor + '30,' + avatarColor + '60);"></div>';
            }
            html += '</div>';
            // 渐变遮罩
            html += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 20%,transparent 60%,rgba(0,0,0,0.7) 100%);z-index:1;"></div>';
            // 小窗自己 - 精致圆角卡片
            html += '<div class="local-video" style="position:absolute;top:50px;right:16px;width:90px;height:130px;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.1);z-index:20;background:#1a1a1a;">';
            var userAvatar = PhoneCore.user.avatar;
            if (userAvatar) {
                html += '<img src="' + userAvatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#374151,#1f2937);"><svg width="28" height="28" viewBox="0 0 24 24" fill="#6b7280"><circle cx="12" cy="8" r="4"/><path d="M4 20v-2c0-2.21 3.58-4 8-4s8 1.79 8 4v2"/></svg></div>';
            }
            html += '</div>';
        }
        
        // 顶部信息区域
        html += '<div class="call-info-area" style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;padding:' + (isVideo ? '60px 20px 20px' : '50px 20px 20px') + ';">';
        
        // 头像
        if (!isVideo) {
            // 语音通话 - 大头像带光晕效果
            html += '<div class="call-avatar-container" style="position:relative;margin-bottom:20px;">';
            html += '<div class="avatar-glow" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:140px;height:140px;background:radial-gradient(circle,' + avatarColor + '40 0%,transparent 70%);border-radius:50%;animation:avatarPulse 3s ease-in-out infinite;"></div>';
            html += '<div class="call-avatar" style="position:relative;width:110px;height:110px;border-radius:50%;overflow:hidden;box-shadow:0 16px 50px rgba(0,0,0,0.4),0 0 0 3px rgba(255,255,255,0.1);">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:600;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
            }
            html += '</div>';
            html += '</div>';
        } else {
            // 视频通话 - 中等头像
            html += '<div class="call-avatar" style="width:80px;height:80px;border-radius:50%;overflow:hidden;margin-bottom:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5),0 0 0 2px rgba(255,255,255,0.15);">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:600;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
            }
            html += '</div>';
        }
        
        // 名字
        html += '<div class="call-name" style="font-size:' + (isVideo ? '20px' : '24px') + ';font-weight:600;color:white;margin-bottom:6px;text-shadow:0 2px 10px rgba(0,0,0,0.4);">' + ai.name + '</div>';
        
        // 状态
        html += '<div id="call-status" style="display:flex;align-items:center;gap:6px;font-size:13px;color:rgba(255,255,255,0.7);">';
        html += '<span class="status-dot" style="width:8px;height:8px;background:#4ade80;border-radius:50%;animation:statusPulse 1.5s ease-in-out infinite;box-shadow:0 0 6px #4ade80;"></span>';
        html += '<span id="call-status-text">正在呼叫</span>';
        html += '</div>';
        
        // 通话时长
        html += '<div id="call-duration" style="font-size:32px;font-weight:200;color:white;margin-top:12px;font-family:\'SF Mono\',monospace;letter-spacing:2px;display:none;">00:00</div>';
        
        html += '</div>'; // call-info-area结束
        
        // 消息对话区域 - 精致设计，隐藏滚动条
        html += '<div id="call-chat-area" style="position:relative;z-index:5;flex:1;display:flex;flex-direction:column;margin:0 16px;border-radius:20px;overflow:hidden;background:rgba(0,0,0,0.3);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.06);box-shadow:0 4px 24px rgba(0,0,0,0.2);">';
        html += '<div id="call-messages-container" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:none;-ms-overflow-style:none;"></div>';
        html += '<div style="padding:12px 14px;background:linear-gradient(180deg,transparent,rgba(0,0,0,0.3));display:flex;gap:10px;align-items:center;">';
        html += '<input type="text" id="call-message-input" placeholder="输入消息..." style="flex:1;padding:12px 18px;border:none;border-radius:24px;background:rgba(255,255,255,0.08);color:white;font-size:14px;outline:none;transition:all 0.2s;" onfocus="this.style.background=\'rgba(255,255,255,0.12)\'" onblur="this.style.background=\'rgba(255,255,255,0.08)\'">';
        html += '<button id="send-call-message" style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(74,222,128,0.35);transition:all 0.2s;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        
        // 隐藏滚动条的样式
        html += '<style>#call-messages-container::-webkit-scrollbar{display:none;}</style>';
        
        // 底部控制按钮区域
        html += '<div class="call-controls-area" style="position:relative;z-index:10;padding:16px 20px 40px;display:flex;justify-content:center;align-items:center;gap:24px;">';
        
        // 静音按钮
        html += '<button id="mute-btn" class="control-btn-new" style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);transition:all 0.2s;">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
        html += '</button>';
        
        // 挂断按钮
        html += '<button id="end-call-btn" style="width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(239,68,68,0.4);transition:all 0.2s;">';
        html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>';
        html += '</button>';
        
        // 语音通话：最小化按钮（切出页面）
        if (!isVideo) {
            html += '<button id="minimize-btn" class="control-btn-new" style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);transition:all 0.2s;">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>';
            html += '</button>';
        }
        
        html += '</div>'; // call-controls-area结束
        
        // 动画样式
        html += '<style>';
        html += '@keyframes floatBg { 0%,100% { transform:translate(0,0); } 50% { transform:translate(20px,20px); } }';
        html += '@keyframes pulseBg { 0%,100% { transform:translate(-50%,-50%) scale(1);opacity:0.08; } 50% { transform:translate(-50%,-50%) scale(1.1);opacity:0.15; } }';
        html += '@keyframes avatarPulse { 0%,100% { transform:translate(-50%,-50%) scale(1);opacity:0.4; } 50% { transform:translate(-50%,-50%) scale(1.15);opacity:0.2; } }';
        html += '@keyframes statusPulse { 0%,100% { opacity:1;box-shadow:0 0 6px #4ade80; } 50% { opacity:0.6;box-shadow:0 0 3px #4ade80; } }';
        html += '.control-btn-new:hover { background:rgba(255,255,255,0.2);transform:scale(1.05); }';
        html += '.control-btn-new:active { transform:scale(0.95); }';
        html += '.control-btn-new.active { background:linear-gradient(135deg,#4ade80,#22c55e);border-color:#4ade80; }';
        html += '#end-call-btn:hover { transform:scale(1.05);box-shadow:0 10px 30px rgba(239,68,68,0.5); }';
        html += '#end-call-btn:active { transform:scale(0.95); }';
        html += '#send-call-message:hover { transform:scale(1.05); }';
        html += '#send-call-message:active { transform:scale(0.95); }';
        html += '</style>';
        
        html += '</div>'; // call-page结束
        
        // 视频通话不能退出，语音通话可以最小化
        var page = this.openDetailPage(html, { 
            enableHomeIndicator: false, 
            hideBackButton: true,
            background: 'transparent',
            preventSwipeBack: isVideo
        });
        this.currentCallPage = page;
        this.currentCallIsVideo = isVideo;
        
        // 隐藏状态栏间隙和home指示器
        var statusBarGap = page.querySelector('.app-status-bar-gap');
        var backBtn = page.querySelector('.app-back-btn');
        var homeIndicator = page.querySelector('.home-indicator');
        if (statusBarGap) statusBarGap.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        if (homeIndicator) homeIndicator.style.display = 'none';
        
        // 让内容区域全屏
        var contentPage = page.querySelector('.app-content-page');
        if (contentPage) {
            contentPage.style.position = 'absolute';
            contentPage.style.top = '0';
            contentPage.style.left = '0';
            contentPage.style.right = '0';
            contentPage.style.bottom = '0';
            contentPage.style.overflow = 'hidden';
        }
        
        // 【重要】只在首次开始通话时记录开始时间，避免切换页面时重置导致消息丢失
        if (!this.callSessionStart || !this.island.state.inCall) {
            this.callSessionStart = Date.now();
        }
        
        // 绑定事件
        this.bindCallPageEvents(page, aiId, type);
        
        // 启动计时器
        this.startCallTimer(page);
    };
    
    // 绑定通话页面事件
    ChatApp.prototype.bindCallPageEvents = function(page, aiId, type) {
        var self = this;
        
        // 保存通话类型
        this.currentCallType = type;
        
        // 挂断按钮
        var endCallBtn = page.querySelector('#end-call-btn');
        if (endCallBtn) {
            endCallBtn.onclick = function() {
                // endCall() 内部已经包含了关闭通话页面和清除灵动岛状态的逻辑
                self.endCall();
            };
        }
        
        // 静音按钮
        var muteBtn = page.querySelector('#mute-btn');
        if (muteBtn) {
            muteBtn.onclick = function() {
                self.island.state.isMuted = !self.island.state.isMuted;
                muteBtn.classList.toggle('active', self.island.state.isMuted);
                if (self.island.state.isMuted) {
                    muteBtn.style.background = 'linear-gradient(135deg,#4ade80,#22c55e)';
                } else {
                    muteBtn.style.background = 'rgba(255,255,255,0.1)';
                }
            };
        }
        
        // 最小化按钮（仅语音通话）
        var minimizeBtn = page.querySelector('#minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.onclick = function() {
                self.minimizeCallPage();
            };
        }
        
        // 发送通话消息
        var sendCallMsgBtn = page.querySelector('#send-call-message');
        var callMsgInput = page.querySelector('#call-message-input');
        if (sendCallMsgBtn && callMsgInput) {
            sendCallMsgBtn.onclick = function() {
                var content = callMsgInput.value.trim();
                if (content) {
                    self.sendCallMessage(aiId, content, type);
                    callMsgInput.value = '';
                }
            };
            callMsgInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    var content = callMsgInput.value.trim();
                    if (content) {
                        self.sendCallMessage(aiId, content, type);
                        callMsgInput.value = '';
                    }
                }
            };
        }
        
        // 初始渲染通话消息列表
        this.renderCallMessages(aiId, page);
    };
    
    // 更新通话页面状态
    ChatApp.prototype.updateCallPageStatus = function(status) {
        if (!this.currentCallPage) return;
        
        var statusText = this.currentCallPage.querySelector('#call-status-text');
        var durationEl = this.currentCallPage.querySelector('#call-duration');
        
        if (status === 'connected') {
            if (statusText) statusText.textContent = '通话中';
            if (durationEl) durationEl.style.display = 'block';
        } else if (status === 'ended') {
            if (statusText) statusText.textContent = '通话结束';
        }
    };
    
    // 通话计时器
    ChatApp.prototype.startCallTimer = function(page) {
        var self = this;
        var durationEl = page.querySelector('#call-duration');
        
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
        }
        
        this.callTimerInterval = setInterval(function() {
            if (!self.island.state.inCall) {
                clearInterval(self.callTimerInterval);
                return;
            }
            
            if (self.island.state.callStatus === 'connected' && durationEl) {
                var elapsed = Math.floor((Date.now() - self.island.state.callStartTime) / 1000) - 2; // 减去呼叫时间
                if (elapsed < 0) elapsed = 0;
                var minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                var seconds = (elapsed % 60).toString().padStart(2, '0');
                durationEl.textContent = minutes + ':' + seconds;
            }
        }, 1000);
    };
    
    // 关闭通话页面
    ChatApp.prototype.closeCallPage = function() {
        if (this.currentCallPage) {
            this.currentCallPage.remove();
            this.currentCallPage = null;
        }
    };
    
    // 最小化通话页面
    ChatApp.prototype.minimizeCallPage = function() {
        var self = this;
        this.island.state.isMinimized = true;
        
        // 关闭当前页面但保持通话状态
        if (this.currentCallPage) {
            this.currentCallPage.remove();
            this.currentCallPage = null;
        }
        
        // 【重要】最小化后切换灵动岛到medium模式，让用户可以在灵动岛继续对话
        if (typeof DynamicIsland !== 'undefined') {
            DynamicIsland.activeApp = this;
            DynamicIsland.mode = 'medium'; // 切换到medium模式显示输入框
            DynamicIsland.updateUI();
        }
        
        // 返回聊天页面
        this.showToast('通话已最小化，点击灵动岛可继续对话');
    };
    
    // 恢复通话页面（从灵动岛切回完整通话界面）
    ChatApp.prototype.restoreCallPage = function() {
        if (this.island.state.inCall && this.callAiId) {
            this.island.state.isMinimized = false;
            
            // 【重要】恢复通话页面，不重置callSessionStart，保持消息连续
            this.openCallPage(this.callAiId, this.island.state.callType);
            
            // 恢复后灵动岛切换回quiet模式（小绿点）
            if (typeof DynamicIsland !== 'undefined') {
                DynamicIsland.mode = 'quiet';
                DynamicIsland.updateUI();
            }
        }
    };
    
    // 发送通话中的消息
    ChatApp.prototype.sendCallMessage = function(aiId, content, callType) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var callTypeName = callType === 'video' ? '视频通话' : '语音通话';
        
        // 保存用户消息
        var userMessage = {
            id: 'msg_' + Date.now(),
            role: 'user',
            type: 'call_chat',
            content: content,
            callType: callType,
            timestamp: Date.now(),
            isCallMessage: true
        };
        
        if (!ai.chatHistory) ai.chatHistory = [];
        ai.chatHistory.push(userMessage);
        PhoneCore.saveAI(ai);
        
        // 更新通话消息列表
        if (this.currentCallPage) {
            this.renderCallMessages(aiId, this.currentCallPage);
        }
        
        // 【重要】同步更新灵动岛消息列表（与灵动岛互通）
        if (typeof DynamicIsland !== 'undefined') {
            var messagesContainer = DynamicIsland.el.querySelector('#island-messages-container');
            if (messagesContainer) {
                this.renderIslandMessages(aiId, messagesContainer);
            }
        }
        
        // 【修复】如果正在等待AI来电问候，暂存消息等问候完成后再触发AI回复
        if (this.isWaitingForIncomingGreeting) {
            console.log('[通话修复] 等待AI来电问候，暂存用户消息');
            this.pendingUserCallMessage = {
                aiId: aiId,
                content: content,
                callType: callType
            };
            return;
        }
        
        // 调用AI API获取回复 - 传递ai对象和当前用户消息确保消息正确添加到prompt
        this.generateCallResponse(aiId, callType, ai, content);
    };
    
    // 渲染通话消息列表（精致版）
    ChatApp.prototype.renderCallMessages = function(aiId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        var container = page.querySelector('#call-messages-container');
        if (!container) return;
        
        var avatarColor = this.getAvatarColor(aiId);
        var isVideo = this.currentCallType === 'video';
        // 如果没有设置通话开始时间，使用0（显示所有通话消息）
        var callStart = this.callSessionStart || 0;
        
        // 只获取本次通话期间发送的消息（不显示旧消息）
        // 【修复】移除数量限制，显示全部通话上下文
        var callMessages = [];
        for (var i = ai.chatHistory.length - 1; i >= 0; i--) {
            var msg = ai.chatHistory[i];
            // 只显示本次通话开始后的消息
            if ((msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || msg.type === 'call_system') 
                && msg.timestamp >= callStart) {
                callMessages.unshift(msg);
            }
        }
        
        var html = '';
        
        if (callMessages.length === 0) {
            html = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;">';
            html += '<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;margin-bottom:10px;">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
            html += '</div>';
            html += '<div style="color:rgba(255,255,255,0.45);font-size:13px;">通话中可以发送消息</div>';
            html += '</div>';
        } else {
            callMessages.forEach(function(msg) {
                var isUser = msg.role === 'user';
                var displayContent = msg.content || msg.voiceContent || '';
                
                // 系统消息（环境描述/声音描述）- 居中显示
                if (msg.type === 'call_system' || msg.isSystemDesc) {
                    html += '<div style="text-align:center;margin:8px 0;">';
                    html += '<span style="display:inline-block;padding:6px 14px;background:rgba(255,255,255,0.08);border-radius:12px;font-size:12px;color:rgba(255,255,255,0.5);font-style:italic;border:1px solid rgba(255,255,255,0.05);">';
                    html += displayContent;
                    html += '</span>';
                    html += '</div>';
                    return;
                }
                
                if (isUser) {
                    html += '<div style="display:flex;justify-content:flex-end;">';
                    html += '<div style="max-width:80%;background:linear-gradient(135deg,#4ade80,#22c55e);color:white;padding:10px 14px;border-radius:16px 16px 4px 16px;font-size:14px;line-height:1.5;box-shadow:0 2px 8px rgba(74,222,128,0.2);">' + displayContent + '</div>';
                    html += '</div>';
                } else {
                    html += '<div style="display:flex;justify-content:flex-start;gap:8px;">';
                    html += '<div style="width:26px;height:26px;border-radius:8px;overflow:hidden;flex-shrink:0;">';
                    if (ai.avatar) {
                        html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                    } else {
                        html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
                    }
                    html += '</div>';
                    html += '<div style="max-width:75%;background:rgba(255,255,255,0.1);color:white;padding:10px 14px;border-radius:16px 16px 16px 4px;font-size:14px;line-height:1.5;">' + displayContent + '</div>';
                    html += '</div>';
                }
            });
        }
        
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    };
    
    // 添加通话系统消息（环境描述/声音描述）
    ChatApp.prototype.addCallSystemMessage = function(aiId, content) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var systemMsg = {
            id: 'msg_' + Date.now() + '_sys',
            role: 'system',
            type: 'call_system',
            content: content,
            timestamp: Date.now(),
            isCallMessage: true,
            isSystemDesc: true
        };
        
        if (!ai.chatHistory) ai.chatHistory = [];
        ai.chatHistory.push(systemMsg);
        PhoneCore.saveAI(ai);
        
        // 更新消息列表
        if (this.currentCallPage) {
            this.renderCallMessages(aiId, this.currentCallPage);
        }
    };
    
    // 生成通话中的AI回复 - 真正调用API
    // currentUserContent: 当前用户发送的消息内容，确保能正确添加到prompt
    ChatApp.prototype.generateCallResponse = function(aiId, callType, providedAi, currentUserContent) {
        var self = this;
        // 优先使用传入的ai对象，确保包含最新消息
        var ai = providedAi || PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var callTypeName = callType === 'video' ? '视频通话' : '语音通话';
        
        // 获取数据订阅配置
        var dataSub = ai.dataSubscriptions || { weather: true, userCity: true, userProfile: true, time: true };
        
        // 获取用户信息
        var mask = PhoneCore.user.getCurrentMask();
        var userPersona = '';
        var userCity = '';
        
        if (mask) {
            userPersona = dataSub.userProfile !== false ? (PhoneCore.user.getMaskPersonaForAI ? PhoneCore.user.getMaskPersonaForAI(mask.id) : '') : '';
            userCity = dataSub.userCity !== false ? (mask.city || '') : '';
        } else {
            userCity = dataSub.userCity !== false ? (PhoneCore.user.realInfo ? PhoneCore.user.realInfo.city : '') : '';
        }
        
        // 构建通话场景的context
        var context = {
            weather: dataSub.weather !== false ? this.getAIWeather(ai) : '',
            time: dataSub.time !== false ? PhoneCore.time.getFormattedTime() : '',
            app: callType === 'video' ? 'video_call' : 'voice_call',
            userPersona: userPersona,
            userCity: userCity,
            aiCity: ai.weatherCity ? (ai.weatherCity.mappedName || ai.weatherCity.realCity) : ''
        };
        
        var systemPrompt = '';
        try {
            systemPrompt = ai.getPrompt ? ai.getPrompt(context) : '';
        } catch (e) {
            console.error('获取prompt失败:', e);
        }
        if (!systemPrompt) {
            systemPrompt = '你是' + (ai.name || 'AI助手') + '，请友好地回复用户。';
        }
        
        // 添加通话状态说明到系统提示
        systemPrompt += '\n\n【当前状态】你正在和用户进行' + callTypeName + '，这不是普通的文字聊天。请像真正在打电话/视频一样回复，语气自然亲切，回复简短口语化，就像真的在说话一样。不要太长，一两句话即可。';
        systemPrompt += '\n注意：下面的消息中，[通话中]开头的是用户在电话里说的话，你需要在电话里回复；如果有[聊天消息]开头的，是用户同时在聊天界面发的文字消息，不是电话里说的。';
        
        // === 构建消息上下文 ===
        var recentMessages = [];
        var callStart = this.callSessionStart || 0;
        
        if (ai.chatHistory && ai.chatHistory.length > 0) {
            // 1. 先获取普通聊天历史作为背景（不包括通话消息，但包括通话记录概括）
            var chatHistory = ai.chatHistory.filter(function(msg) {
                // 排除通话中的具体消息
                if (msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || 
                    msg.type === 'call_system' || msg.fromIsland || msg.isIslandReply || msg.isSystemDesc) {
                    return false;
                }
                return true;
            }).slice(-10).map(function(msg) {
                var msgContent = String(msg.content || '').trim();
                
                // 通话记录只提取概括
                if (msg.type === 'call_record' && msg.callRecord) {
                    var cr = msg.callRecord;
                    var typeName = cr.callType === 'video' ? '视频通话' : '语音通话';
                    if (cr.summary) {
                        msgContent = '[之前' + typeName + '概括：' + cr.summary + ']';
                    } else {
                        msgContent = '[之前有过' + typeName + ']';
                    }
                    return { role: 'system', content: msgContent };
                }
                
                return {
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msgContent
                };
            }).filter(function(msg) {
                return msg && msg.content && msg.content.length > 0;
            });
            
            // 2. 获取本次通话期间的消息
            // 【修复】移除数量限制，确保AI能看到完整的通话上下文
            var callMessages = ai.chatHistory.filter(function(msg) {
                return (msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat')
                    && msg.timestamp >= callStart
                    && msg.role !== 'system'
                    && !msg.isSystemDesc;
            }).map(function(msg) {
                var msgContent = String(msg.content || msg.voiceContent || '').trim();
                // 标记为通话中的消息
                return {
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.role === 'user' ? '[通话中] ' + msgContent : msgContent
                };
            }).filter(function(msg) {
                return msg.content && msg.content.length > 0;
            });
            
            // 3. 检查通话期间是否有聊天界面的新消息
            var chatDuringCall = ai.chatHistory.filter(function(msg) {
                return !msg.isCallMessage && msg.type !== 'call_chat' && msg.type !== 'island_call_chat' 
                    && msg.type !== 'call_system' && msg.type !== 'call_record'
                    && !msg.fromIsland && !msg.isIslandReply && !msg.isSystemDesc
                    && msg.role === 'user'
                    && msg.timestamp >= callStart;
            }).map(function(msg) {
                return {
                    role: 'user',
                    content: '[聊天消息] ' + String(msg.content || '').trim()
                };
            }).filter(function(msg) {
                return msg.content && msg.content.length > 0;
            });
            
            // 4. 合并消息：聊天背景 + 通话消息 + 通话期间的聊天消息
            recentMessages = chatHistory.slice(-5); // 最近5条聊天背景
            recentMessages = recentMessages.concat(callMessages);
            if (chatDuringCall.length > 0) {
                recentMessages = recentMessages.concat(chatDuringCall);
            }
        }
        
        // 如果没有消息，使用默认问候
        if (recentMessages.length === 0) {
            recentMessages.push({ role: 'user', content: '[通话中] 你好' });
        }
        
        // 调用API
        var apiConfigId = ai.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configKeys = Object.keys(PhoneCore.api.configs);
            if (configKeys.length > 0) {
                apiConfigId = configKeys[0];
            }
        }
        
        if (!apiConfigId || !PhoneCore.api || !PhoneCore.api.configs || !PhoneCore.api.configs[apiConfigId]) {
            // 无API配置时使用默认回复
            var defaultResponses = [
                '嗯，我听到了',
                '好的呀',
                '是这样啊',
                '嗯嗯',
                '好，知道了'
            ];
            var randomResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
            this.addCallAIMessage(aiId, randomResponse, callType);
            return;
        }
        
        // 构建完整消息（确保角色只有 user 和 assistant）
        var fullMessages = recentMessages.map(function(msg) {
            var content = String(msg.content || '').trim();
            // system 角色的消息（如通话记录概括）转换为 assistant 角色
            var role = msg.role === 'user' ? 'user' : 'assistant';
            return { role: role, content: content };
        }).filter(function(msg) {
            return msg.content;
        });
        

        
        console.log('[通话调试] 发送给API的消息:', JSON.stringify(fullMessages, null, 2));
        
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call(systemPrompt, apiConfigId, { 
            messages: fullMessages,
            maxTokens: configuredMaxTokens,
            temperature: 0.8
        }).then(function(response) {
            if (ai.recordTokens) {
                ai.recordTokens('call-app', response.tokens);
            }
            
            // 提取纯文本回复
            var replyContent = response.content || '';
            console.log('[通话调试] API原始回复:', replyContent);
            
            // 移除可能的格式标记（但保留实际内容）
            // 只移除特定的标记，不要误删正文
            replyContent = replyContent.replace(/\[通话中\]/g, '').replace(/\[语音\]/g, '').trim();
            console.log('[通话调试] 处理后回复:', replyContent);
            
            if (!replyContent) {
                console.warn('[通话调试] 回复为空，使用默认回复');
                replyContent = '嗯嗯';
            }
            
            // 通话回复不要太长
            if (replyContent.length > 100) {
                replyContent = replyContent.substring(0, 100);
                var lastPunct = Math.max(
                    replyContent.lastIndexOf('。'),
                    replyContent.lastIndexOf('！'),
                    replyContent.lastIndexOf('？'),
                    replyContent.lastIndexOf('，')
                );
                if (lastPunct > 30) {
                    replyContent = replyContent.substring(0, lastPunct + 1);
                }
            }
            
            self.addCallAIMessage(aiId, replyContent, callType);
            
        }).catch(function(err) {
            console.error('通话AI回复失败:', err);
            self.addCallAIMessage(aiId, '信号不太好...', callType);
        });
    };
    
    // 添加通话中的AI消息（解析环境/声音描述）
    ChatApp.prototype.addCallAIMessage = function(aiId, content, callType) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 解析环境/声音描述（括号内的描述性内容）
        // 匹配模式：（...描述...）或 (...描述...)
        var descPatterns = [
            /[（\(]([^）\)]*(?:声音|背景|环境|画面|表情|动作|语气|神态)[^）\)]*)[）\)]/g,
            /[（\(]([^）\)]*(?:沙哑|清脆|低沉|温柔|模糊|清晰|嘈杂|安静)[^）\)]*)[）\)]/g
        ];
        
        var systemDescs = [];
        var cleanContent = content;
        
        descPatterns.forEach(function(pattern) {
            var match;
            while ((match = pattern.exec(content)) !== null) {
                systemDescs.push(match[1].trim());
                cleanContent = cleanContent.replace(match[0], '');
            }
        });
        
        cleanContent = cleanContent.trim();
        
        if (!ai.chatHistory) ai.chatHistory = [];
        
        // 先添加系统描述消息
        systemDescs.forEach(function(desc) {
            if (desc) {
                var systemMsg = {
                    id: 'msg_' + Date.now() + '_sys_' + Math.random().toString(36).substr(2, 5),
                    role: 'system',
                    type: 'call_system',
                    content: desc,
                    timestamp: Date.now(),
                    isCallMessage: true,
                    isSystemDesc: true
                };
                ai.chatHistory.push(systemMsg);
            }
        });
        
        // 如果有实际对话内容，添加AI消息
        if (cleanContent) {
            var aiMessage = {
                id: 'msg_' + Date.now(),
                role: 'assistant',
                type: 'call_chat',
                content: cleanContent,
                callType: callType,
                timestamp: Date.now(),
                isCallMessage: true
            };
            ai.chatHistory.push(aiMessage);
        }
        
        PhoneCore.saveAI(ai);
        
        // 更新通话消息列表
        if (this.currentCallPage && this.island.state.inCall) {
            this.renderCallMessages(aiId, this.currentCallPage);
        }
        
        // 【重要】同步更新灵动岛消息列表（与灵动岛互通）
        if (typeof DynamicIsland !== 'undefined') {
            var messagesContainer = DynamicIsland.el.querySelector('#island-messages-container');
            if (messagesContainer) {
                this.renderIslandMessages(aiId, messagesContainer);
            }
        }
    };

    /* 【灵动岛通话界面】精致版设计
       1. quiet模式：头像缩略图+绿点+时长（点击展开medium）
       2. medium模式：头像+名字+状态+输入框+挂断按钮（点击展开large）
       3. large模式：完整消息列表+输入框+控制按钮 */
    ChatApp.prototype.renderCallIsland = function(mode, state) {
        var self = this;
        var ai = state.currentChat;
        if (!ai) return '';
        
        var avatarColor = this.getAvatarColor(ai.id);
        var callDuration = '';
        if (state.callStatus === 'connected' && state.callStartTime) {
            var elapsed = Math.floor((Date.now() - state.callStartTime) / 1000) - 2;
            if (elapsed < 0) elapsed = 0;
            var minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            var seconds = (elapsed % 60).toString().padStart(2, '0');
            callDuration = minutes + ':' + seconds;
        }
        
        if (mode === 'quiet') {
            // 静默模式 - 精致的小卡片显示
            var html = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:0 14px;gap:10px;">';
            // 头像缩略图
            html += '<div style="width:26px;height:26px;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.3);">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
            }
            html += '</div>';
            // 状态指示
            html += '<div style="display:flex;align-items:center;gap:6px;">';
            html += '<div style="width:8px;height:8px;background:#4ade80;border-radius:50%;animation:islandPulse 1.5s ease-in-out infinite;box-shadow:0 0 6px #4ade80;"></div>';
            if (callDuration) {
                html += '<span style="font-size:12px;color:#4ade80;font-family:\'SF Mono\',monospace;font-weight:500;">' + callDuration + '</span>';
            } else {
                html += '<span style="font-size:11px;color:rgba(255,255,255,0.7);">呼叫中</span>';
            }
            html += '</div>';
            html += '<style>@keyframes islandPulse { 0%,100% { opacity:1;transform:scale(1); } 50% { opacity:0.6;transform:scale(0.9); } }</style>';
            html += '</div>';
            return html;
        }
        
        if (mode === 'medium') {
            // medium模式 - 带输入框的展开卡片
            var html = '<div style="display:flex;flex-direction:column;padding:12px 14px;color:white;height:100%;box-sizing:border-box;">';
            
            // 顶部信息栏
            html += '<div style="display:flex;align-items:center;margin-bottom:15px;margin-top: 10px;">';
            // 头像
            html += '<div style="width:40px;height:40px;border-radius:12px;overflow:hidden;margin-right:12px;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.3);">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
            }
            html += '</div>';
            // 名字和状态
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ai.name + '</div>';
            html += '<div style="display:flex;align-items:center;gap:5px;">';
            html += '<div style="width:6px;height:6px;background:#4ade80;border-radius:50%;animation:islandPulse 1.5s ease-in-out infinite;"></div>';
            html += '<span style="font-size:12px;color:#4ade80;">' + (state.callType === 'voice' ? '语音' : '视频') + '</span>';
            if (callDuration) {
                html += '<span style="font-size:12px;color:rgba(255,255,255,0.6);font-family:\'SF Mono\',monospace;">' + callDuration + '</span>';
            }
            html += '</div>';
            html += '</div>';
            // 挂断按钮
            html += '<button id="island-end-call-btn" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(239,68,68,0.4);flex-shrink:0;transition:transform 0.2s;">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>';
            html += '</button>';
            html += '</div>';
            
            // 输入框区域
            html += '<div style="display:flex;gap:8px;align-items:center;">';
            html += '<input type="text" id="island-msg-input" placeholder="发送消息..." style="flex:1;padding:8px 14px;border:none;border-radius:18px;background:rgba(255,255,255,0.12);color:white;font-size:13px;outline:none;backdrop-filter:blur(10px);width: 10px;">';
            html += '<button id="island-send-btn" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(74,222,128,0.3);transition:transform 0.2s;">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
            html += '</button>';
            html += '</div>';
            
            html += '<style>@keyframes islandPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }</style>';
            html += '</div>';
            return html;
        }
        
        if (mode === 'large') {
            // large模式 - 完整消息列表
            var html = '<div style="display:flex;flex-direction:column;height:100%;color:white;box-sizing:border-box;">';
            
            // 顶部信息栏
            html += '<div style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.1);">';
            // 头像
            html += '<div style="width:44px;height:44px;border-radius:14px;overflow:hidden;margin-right:14px;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,0.3);">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
            }
            html += '</div>';
            // 名字和状态
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:3px;">' + ai.name + '</div>';
            html += '<div style="display:flex;align-items:center;gap:6px;">';
            html += '<div style="width:7px;height:7px;background:#4ade80;border-radius:50%;animation:islandPulse 1.5s ease-in-out infinite;box-shadow:0 0 6px #4ade80;"></div>';
            html += '<span style="font-size:13px;color:#4ade80;">' + (state.callType === 'voice' ? '语音' : '视频') + '</span>';
            if (callDuration) {
                html += '<span style="font-size:13px;color:rgba(255,255,255,0.5);font-family:\'SF Mono\',monospace;margin-left:4px;">' + callDuration + '</span>';
            }
            html += '</div>';
            html += '</div>';
            // 控制按钮组
            html += '<div style="display:flex;gap:8px;">';
            // 静音按钮
            
            // 挂断按钮
            html += '<button id="island-end-call-btn" style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(239,68,68,0.4);transition:transform 0.2s;">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>';
            html += '</button>';
            html += '</div>';
            html += '</div>';
            
            // 消息列表区域 - 隐藏滚动条
            html += '<div id="island-messages-container" style="flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:rgba(0,0,0,0.15);scrollbar-width:none;-ms-overflow-style:none;">';
            // 消息内容将通过 renderIslandMessages 填充
            html += '</div>';
            html += '<style>#island-messages-container::-webkit-scrollbar{display:none;}</style>';
            
            // 底部输入区域
            html += '<div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:10px;align-items:center;background:rgba(0,0,0,0.15);">';
            html += '<input type="text" id="island-msg-input" placeholder="输入消息..." style="flex:1;padding:10px 16px;border:none;border-radius:20px;background:rgba(255,255,255,0.1);color:white;font-size:14px;outline:none;backdrop-filter:blur(10px);">';
            html += '<button id="island-send-btn" style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(74,222,128,0.35);transition:all 0.2s;">';
            html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
            html += '</button>';
            html += '</div>';
            
            html += '<style>@keyframes islandPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }</style>';
            html += '</div>';
            return html;
        }
        
        return '';
    };

    ChatApp.prototype.bindIslandEvents = function(container) {
        var self = this;
        
        // 挂断按钮
        var endCallBtn = container.querySelector('#island-end-call-btn');
        if (endCallBtn) {
            endCallBtn.onclick = function(e) {
                e.stopPropagation();
                // endCall() 内部已经包含了关闭通话页面和清除灵动岛状态的逻辑
                self.endCall();
            };
        }
        
        // 静音按钮
        var muteBtn = container.querySelector('#island-mute-btn');
        if (muteBtn) {
            muteBtn.onclick = function(e) {
                e.stopPropagation();
                self.island.state.isMuted = !self.island.state.isMuted;
                muteBtn.style.background = self.island.state.isMuted ? 'linear-gradient(135deg,#4ade80,#22c55e)' : 'rgba(255,255,255,0.1)';
                // 同步更新通话页面
                if (self.currentCallPage) {
                    var pageMuteBtn = self.currentCallPage.querySelector('#mute-btn');
                    if (pageMuteBtn) {
                        pageMuteBtn.classList.toggle('active', self.island.state.isMuted);
                    }
                }
            };
        }
        
        // 灵动岛发送消息按钮
        var sendBtn = container.querySelector('#island-send-btn');
        var msgInput = container.querySelector('#island-msg-input');
        if (sendBtn && msgInput) {
            sendBtn.onclick = function(e) {
                e.stopPropagation();
                var content = msgInput.value.trim();
                if (content && self.callAiId) {
                    // 标记为灵动岛发送的消息
                    self.sendIslandMessage(self.callAiId, content, self.island.state.callType);
                    msgInput.value = '';
                }
            };
            
            msgInput.onclick = function(e) {
                e.stopPropagation();
            };
            
            msgInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    e.stopPropagation();
                    var content = msgInput.value.trim();
                    if (content && self.callAiId) {
                        self.sendIslandMessage(self.callAiId, content, self.island.state.callType);
                        msgInput.value = '';
                    }
                }
            };
        }
        
        // 渲染large模式的消息列表
        var messagesContainer = container.querySelector('#island-messages-container');
        if (messagesContainer && self.callAiId) {
            self.renderIslandMessages(self.callAiId, messagesContainer);
        }
    };
    
    // 从灵动岛发送消息（标记为灵动岛消息）
    ChatApp.prototype.sendIslandMessage = function(aiId, content, callType) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 保存用户消息，标记为灵动岛消息
        var userMessage = {
            id: 'msg_' + Date.now(),
            role: 'user',
            type: 'island_call_chat', // 标记为灵动岛发送的通话消息
            content: content,
            callType: callType,
            timestamp: Date.now(),
            isCallMessage: true,
            fromIsland: true // 重要：标记来自灵动岛
        };
        
        if (!ai.chatHistory) ai.chatHistory = [];
        ai.chatHistory.push(userMessage);
        PhoneCore.saveAI(ai);
        
        // 更新灵动岛消息列表
        if (typeof DynamicIsland !== 'undefined') {
            var messagesContainer = DynamicIsland.el.querySelector('#island-messages-container');
            if (messagesContainer) {
                this.renderIslandMessages(aiId, messagesContainer);
            }
        }
        
        // 更新通话页面消息列表（如果打开）
        if (this.currentCallPage) {
            this.renderCallMessages(aiId, this.currentCallPage);
        }
        
        // 调用AI API获取回复 - 传递ai对象确保使用最新的消息
        this.generateIslandCallResponse(aiId, callType, ai);
    };
    
    // 渲染灵动岛消息列表（精致版）- 显示所有通话消息，与通话页面互通
    ChatApp.prototype.renderIslandMessages = function(aiId, container) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        // 如果没有设置通话开始时间，使用0（显示所有通话消息）
        var callStart = this.callSessionStart || 0;
        
        // 【重要】获取本次通话期间的所有消息（与通话页面互通）
        // 【修复】移除数量限制，显示全部通话上下文
        var islandMessages = [];
        for (var i = ai.chatHistory.length - 1; i >= 0; i--) {
            var msg = ai.chatHistory[i];
            // 显示所有通话消息（通话页面发送的 + 灵动岛发送的 + 系统描述）
            if ((msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || msg.type === 'call_system') 
                && msg.timestamp >= callStart) {
                islandMessages.unshift(msg);
            }
        }
        
        var html = '';
        
        if (islandMessages.length === 0) {
            html = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-size:13px;text-align:center;padding:20px;">';
            html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom:8px;opacity:0.5;"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
            html += '<div>在灵动岛发送消息</div>';
            html += '<div style="font-size:11px;margin-top:4px;opacity:0.6;">通话中的对话将显示在这里</div>';
            html += '</div>';
        } else {
            islandMessages.forEach(function(msg) {
                var isUser = msg.role === 'user';
                var displayContent = msg.content || msg.voiceContent || '';
                
                // 系统消息（环境描述/声音描述）- 居中显示
                if (msg.type === 'call_system' || msg.isSystemDesc) {
                    html += '<div style="text-align:center;margin:6px 0;">';
                    html += '<span style="display:inline-block;padding:5px 12px;background:rgba(255,255,255,0.06);border-radius:10px;font-size:11px;color:rgba(255,255,255,0.45);font-style:italic;">';
                    html += displayContent;
                    html += '</span>';
                    html += '</div>';
                    return;
                }
                
                if (isUser) {
                    html += '<div style="display:flex;justify-content:flex-end;">';
                    html += '<div style="max-width:75%;background:linear-gradient(135deg,#4ade80,#22c55e);color:white;padding:9px 13px;border-radius:14px 14px 4px 14px;font-size:13px;line-height:1.5;box-shadow:0 2px 8px rgba(74,222,128,0.2);">' + displayContent + '</div>';
                    html += '</div>';
                } else {
                    html += '<div style="display:flex;justify-content:flex-start;">';
                    html += '<div style="max-width:75%;background:rgba(255,255,255,0.1);color:white;padding:9px 13px;border-radius:14px 14px 14px 4px;font-size:13px;line-height:1.5;">' + displayContent + '</div>';
                    html += '</div>';
                }
            });
        }
        
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    };
    
    // 生成灵动岛通话的AI回复
    ChatApp.prototype.generateIslandCallResponse = function(aiId, callType, providedAi) {
        var self = this;
        // 优先使用传入的ai对象，确保包含最新消息
        var ai = providedAi || PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var callTypeName = callType === 'video' ? '视频通话' : '语音通话';
        
        // 获取数据订阅配置
        var dataSub = ai.dataSubscriptions || { weather: true, userCity: true, userProfile: true, time: true };
        
        // 获取用户信息
        var mask = PhoneCore.user.getCurrentMask();
        var userPersona = '';
        var userCity = '';
        
        if (mask) {
            userPersona = dataSub.userProfile !== false ? (PhoneCore.user.getMaskPersonaForAI ? PhoneCore.user.getMaskPersonaForAI(mask.id) : '') : '';
            userCity = dataSub.userCity !== false ? (mask.city || '') : '';
        } else {
            userCity = dataSub.userCity !== false ? (PhoneCore.user.realInfo ? PhoneCore.user.realInfo.city : '') : '';
        }
        
        // 构建通话场景的context
        var context = {
            weather: dataSub.weather !== false ? this.getAIWeather(ai) : '',
            time: dataSub.time !== false ? PhoneCore.time.getFormattedTime() : '',
            app: callType === 'video' ? 'video_call' : 'voice_call',
            userPersona: userPersona,
            userCity: userCity,
            aiCity: ai.weatherCity ? (ai.weatherCity.mappedName || ai.weatherCity.realCity) : ''
        };
        
        var systemPrompt = '';
        try {
            systemPrompt = ai.getPrompt ? ai.getPrompt(context) : '';
        } catch (e) {
            console.error('获取prompt失败:', e);
        }
        if (!systemPrompt) {
            systemPrompt = '你是' + (ai.name || 'AI助手') + '，请友好地回复用户。';
        }
        
        // 添加通话状态说明到系统提示
        systemPrompt += '\n\n【当前状态】你正在和用户进行' + callTypeName + '，这不是普通的文字聊天。请像真正在打电话/视频一样回复，语气自然亲切，回复简短口语化，就像真的在说话一样。不要太长，一两句话即可。';
        systemPrompt += '\n注意：下面的消息中，[通话中]开头的是用户在电话里说的话，你需要在电话里回复；如果有[聊天消息]开头的，是用户同时在聊天界面发的文字消息，不是电话里说的。';
        
        // === 构建消息上下文（与 generateCallResponse 相同逻辑）===
        var recentMessages = [];
        var callStart = this.callSessionStart || 0;
        
        if (ai.chatHistory && ai.chatHistory.length > 0) {
            // 1. 先获取普通聊天历史作为背景
            var chatHistory = ai.chatHistory.filter(function(msg) {
                if (msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || 
                    msg.type === 'call_system' || msg.fromIsland || msg.isIslandReply || msg.isSystemDesc) {
                    return false;
                }
                return true;
            }).slice(-10).map(function(msg) {
                var msgContent = String(msg.content || '').trim();
                
                if (msg.type === 'call_record' && msg.callRecord) {
                    var cr = msg.callRecord;
                    var typeName = cr.callType === 'video' ? '视频通话' : '语音通话';
                    if (cr.summary) {
                        msgContent = '[之前' + typeName + '概括：' + cr.summary + ']';
                    } else {
                        msgContent = '[之前有过' + typeName + ']';
                    }
                    return { role: 'system', content: msgContent };
                }
                
                return {
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msgContent
                };
            }).filter(function(msg) {
                return msg && msg.content && msg.content.length > 0;
            });
            
            // 2. 获取本次通话期间的消息
            // 【修复】移除数量限制，确保AI能看到完整的通话上下文
            var callMessages = ai.chatHistory.filter(function(msg) {
                return (msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat')
                    && msg.timestamp >= callStart
                    && msg.role !== 'system'
                    && !msg.isSystemDesc;
            }).map(function(msg) {
                var msgContent = String(msg.content || msg.voiceContent || '').trim();
                return {
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.role === 'user' ? '[通话中] ' + msgContent : msgContent
                };
            }).filter(function(msg) {
                return msg.content && msg.content.length > 0;
            });
            
            // 3. 检查通话期间是否有聊天界面的新消息
            var chatDuringCall = ai.chatHistory.filter(function(msg) {
                return !msg.isCallMessage && msg.type !== 'call_chat' && msg.type !== 'island_call_chat' 
                    && msg.type !== 'call_system' && msg.type !== 'call_record'
                    && !msg.fromIsland && !msg.isIslandReply && !msg.isSystemDesc
                    && msg.role === 'user'
                    && msg.timestamp >= callStart;
            }).map(function(msg) {
                return {
                    role: 'user',
                    content: '[聊天消息] ' + String(msg.content || '').trim()
                };
            }).filter(function(msg) {
                return msg.content && msg.content.length > 0;
            });
            
            // 4. 合并消息
            recentMessages = chatHistory.slice(-5);
            recentMessages = recentMessages.concat(callMessages);
            if (chatDuringCall.length > 0) {
                recentMessages = recentMessages.concat(chatDuringCall);
            }
        }
        
        if (recentMessages.length === 0) {
            recentMessages.push({ role: 'user', content: '[通话中] 你好' });
        }
        
        // 调用API
        var apiConfigId = ai.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configKeys = Object.keys(PhoneCore.api.configs);
            if (configKeys.length > 0) {
                apiConfigId = configKeys[0];
            }
        }
        
        if (!apiConfigId || !PhoneCore.api || !PhoneCore.api.configs || !PhoneCore.api.configs[apiConfigId]) {
            // 无API配置时使用默认回复
            var defaultResponses = ['嗯，我听到了', '好的呀', '是这样啊', '嗯嗯', '好，知道了'];
            var randomResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
            this.addIslandAIMessage(aiId, randomResponse, callType);
            return;
        }
        
        // 构建完整消息（确保角色只有 user 和 assistant）
        var fullMessages = recentMessages.map(function(msg) {
            var content = String(msg.content || '').trim();
            var role = msg.role === 'user' ? 'user' : 'assistant';
            return { role: role, content: content };
        }).filter(function(msg) {
            return msg.content;
        });
        

        
        console.log('[灵动岛通话调试] 发送给API的消息:', JSON.stringify(fullMessages, null, 2));
        
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call(systemPrompt, apiConfigId, { 
            messages: fullMessages,
            maxTokens: configuredMaxTokens,
            temperature: 0.8
        }).then(function(response) {
            if (ai.recordTokens) {
                ai.recordTokens('island-call', response.tokens);
            }
            
            var replyContent = response.content || '';
            console.log('[灵动岛通话调试] API原始回复:', replyContent);
            
            // 只移除特定的标记，不要误删正文
            replyContent = replyContent.replace(/\[通话中\]/g, '').replace(/\[语音\]/g, '').trim();
            console.log('[灵动岛通话调试] 处理后回复:', replyContent);
            
            if (!replyContent) {
                console.warn('[灵动岛通话调试] 回复为空，使用默认回复');
                replyContent = '嗯嗯';
            }
            
            // 通话回复不要太长
            if (replyContent.length > 100) {
                replyContent = replyContent.substring(0, 100);
                var lastPunct = Math.max(
                    replyContent.lastIndexOf('。'),
                    replyContent.lastIndexOf('！'),
                    replyContent.lastIndexOf('？'),
                    replyContent.lastIndexOf('，')
                );
                if (lastPunct > 30) {
                    replyContent = replyContent.substring(0, lastPunct + 1);
                }
            }
            
            self.addIslandAIMessage(aiId, replyContent, callType);
            
        }).catch(function(err) {
            console.error('灵动岛通话AI回复失败:', err);
            self.addIslandAIMessage(aiId, '信号不太好...', callType);
        });
    };
    
    // 添加灵动岛AI回复消息（解析环境/声音描述）
    ChatApp.prototype.addIslandAIMessage = function(aiId, content, callType) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 解析环境/声音描述（括号内的描述性内容）
        var descPatterns = [
            /[（\(]([^）\)]*(?:声音|背景|环境|画面|表情|动作|语气|神态)[^）\)]*)[）\)]/g,
            /[（\(]([^）\)]*(?:沙哑|清脆|低沉|温柔|模糊|清晰|嘈杂|安静)[^）\)]*)[）\)]/g
        ];
        
        var systemDescs = [];
        var cleanContent = content;
        
        descPatterns.forEach(function(pattern) {
            var match;
            while ((match = pattern.exec(content)) !== null) {
                systemDescs.push(match[1].trim());
                cleanContent = cleanContent.replace(match[0], '');
            }
        });
        
        cleanContent = cleanContent.trim();
        
        if (!ai.chatHistory) ai.chatHistory = [];
        
        // 先添加系统描述消息
        systemDescs.forEach(function(desc) {
            if (desc) {
                var systemMsg = {
                    id: 'msg_' + Date.now() + '_sys_' + Math.random().toString(36).substr(2, 5),
                    role: 'system',
                    type: 'call_system',
                    content: desc,
                    timestamp: Date.now(),
                    isCallMessage: true,
                    isSystemDesc: true,
                    fromIsland: true
                };
                ai.chatHistory.push(systemMsg);
            }
        });
        
        // 如果有实际对话内容，添加AI消息
        if (cleanContent) {
            var aiMessage = {
                id: 'msg_' + Date.now() + '_ai',
                role: 'assistant',
                type: 'island_call_chat',
                content: cleanContent,
                callType: callType,
                timestamp: Date.now(),
                isCallMessage: true,
                isIslandReply: true
            };
            ai.chatHistory.push(aiMessage);
        }
        
        PhoneCore.saveAI(ai);
        
        // 更新灵动岛消息列表
        if (typeof DynamicIsland !== 'undefined') {
            var messagesContainer = DynamicIsland.el.querySelector('#island-messages-container');
            if (messagesContainer) {
                this.renderIslandMessages(aiId, messagesContainer);
            }
        }
        
        // 更新通话页面消息列表
        if (this.currentCallPage) {
            this.renderCallMessages(aiId, this.currentCallPage);
        }
    };

    ChatApp.prototype.endCall = function() {
        var self = this;
        
        // 【修复】防止重复调用 - 检查是否已经在处理挂断或已经挂断
        if (this._isEndingCall || !this.island.state.inCall) {
            console.log('[通话修复] 忽略重复的挂断请求');
            return;
        }
        this._isEndingCall = true;
        
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }
        
        // 【修复】清除来电相关标记
        this.isWaitingForIncomingGreeting = false;
        this.pendingUserCallMessage = null;
        
        // 计算通话时长
        var callType = this.island.state.callType;
        var aiId = this.callAiId;
        var callConnectedTime = this.island.state.callConnectedTime;
        var callDuration = 0;
        var wasConnected = this.island.state.callStatus === 'connected';
        
        if (wasConnected && callConnectedTime) {
            callDuration = Math.floor((Date.now() - callConnectedTime) / 1000);
        }
        
        // 收集通话消息并生成记录卡片
        if (aiId) {
            this.processCallEnd(aiId, callType, callDuration, wasConnected);
        }
        
        // 【修复】清除所有通话相关状态
        this.island.state.inCall = false;
        this.island.state.callType = null;
        this.island.state.currentChat = null;
        this.island.state.callStatus = 'ended';
        this.island.state.callConnectedTime = null;
        this.island.state.isMinimized = false;
        
        // 【修复】清除callAiId
        this.callAiId = null;
        
        // 【修复】关闭通话页面并清除引用
        if (this.currentCallPage) {
            this.currentCallPage.remove();
            this.currentCallPage = null;
        }
        
        // 【修复】清除通话会话开始时间
        this.callSessionStart = null;
        
        this.deactivateIsland();
        
        // 【修复】解除重复调用锁
        this._isEndingCall = false;
        
        var durationText = wasConnected ? this.formatCallDuration(callDuration) : '未接通';
        var callTypeName = callType === 'video' ? '视频' : '通话';
        PhoneCore.notifications.send({
            type: 'info',
            title: callTypeName + '结束',
            message: '时长: ' + durationText,
            icon: callType === 'video' 
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#34C759"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="#34C759"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>',
            size: 'mini',
            duration: 2000
        });
    };
    
    // 停用灵动岛 - 清除通话状态和小绿点
    ChatApp.prototype.deactivateIsland = function() {
        if (typeof DynamicIsland !== 'undefined') {
            // 清除灵动岛的活动App
            DynamicIsland.activeApp = null;
            // 切换回quiet模式(隐藏状态)
            DynamicIsland.mode = 'quiet';
            // 更新UI,清除内容
            DynamicIsland.updateUI();
        }
    };
    
    // 处理通话结束：收集消息、生成梗概、创建卡片
    ChatApp.prototype.processCallEnd = function(aiId, callType, duration, wasConnected) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 收集本次通话的所有消息
        var callMessages = [];
        var messagesToRemove = [];
        
        if (ai.chatHistory) {
            for (var i = ai.chatHistory.length - 1; i >= 0; i--) {
                var msg = ai.chatHistory[i];
                if (msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || msg.fromIsland || msg.isIslandReply) {
                    callMessages.unshift({
                        role: msg.role,
                        content: msg.content || msg.voiceContent || '',
                        fromIsland: msg.fromIsland || false,
                        timestamp: msg.timestamp
                    });
                    messagesToRemove.push(i);
                } else if (callMessages.length > 0) {
                    break;
                }
            }
        }
        
        // 从聊天历史中删除通话消息
        for (var j = messagesToRemove.length - 1; j >= 0; j--) {
            ai.chatHistory.splice(messagesToRemove[j], 1);
        }
        
        // 生成通话记录卡片
        var callRecordId = 'msg_' + Date.now() + '_call';
        var callRecordMessage = {
            id: callRecordId,
            role: 'system',
            type: 'call_record',
            content: '[' + (callType === 'video' ? '视频通话' : '语音通话') + '记录]',
            callRecord: {
                callType: callType,
                duration: duration,
                wasConnected: wasConnected,
                caller: 'user',
                timestamp: Date.now(),
                messages: callMessages, // 存储通话消息
                summary: '' // 梗概，稍后填充
            },
            timestamp: Date.now()
        };
        
        ai.chatHistory.push(callRecordMessage);
        
        // 【新增】添加一条系统消息让AI知道通话已结束
        // 这条消息会作为AI的上下文，让AI知道用户刚刚挂断了通话
        var callEndNotice = {
            id: 'msg_' + Date.now() + '_callend',
            role: 'system',
            type: 'call_end_notice',
            content: '[系统提示：' + callType + '已结束，用户挂断了电话' + 
                     (wasConnected ? '，通话时长' + this.formatCallDuration(duration) : '，未接通') + 
                     '。你可以在接下来的聊天中自然地提及刚才的通话内容。]',
            timestamp: Date.now(),
            isSystemNotice: true, // 标记为系统通知，不显示给用户
            callType: callType,
            callDuration: duration,
            wasConnected: wasConnected
        };
        ai.chatHistory.push(callEndNotice);
        
        PhoneCore.saveAI(ai);
        
        // 如果有通话消息，生成梗概
        if (callMessages.length > 0 && wasConnected) {
            this.generateCallSummary(aiId, callRecordId, callMessages, callType);
        }
        
        // 刷新聊天页面
        this.refreshChatIfOpen(aiId);
    };
    
    // 生成通话梗概
    ChatApp.prototype.generateCallSummary = function(aiId, recordId, messages, callType) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 构建对话内容
        var dialogText = messages.map(function(msg) {
            var speaker = msg.role === 'user' ? '用户' : ai.name;
            return speaker + '：' + msg.content;
        }).join('\n');
        
        var callTypeName = callType === 'video' ? '视频通话' : '语音通话';
        
        // 构建梗概生成提示
        var summaryPrompt = '请用50字以内概括以下' + callTypeName + '的主要内容，直接输出概括，不要任何前缀：\n\n' + dialogText;
        
        // 获取API配置
        var apiConfigId = ai.apiConfigId;
        if (!apiConfigId && PhoneCore.api && PhoneCore.api.configs) {
            var configKeys = Object.keys(PhoneCore.api.configs);
            if (configKeys.length > 0) {
                apiConfigId = configKeys[0];
            }
        }
        
        if (!apiConfigId || !PhoneCore.api || !PhoneCore.api.configs || !PhoneCore.api.configs[apiConfigId]) {
            // 无API，使用默认梗概
            var defaultSummary = callTypeName + '，聊了' + messages.length + '条消息。';
            this.updateCallSummary(aiId, recordId, defaultSummary);
            return;
        }
        
        // 【动态maxTokens】从API配置中获取
        var configuredMaxTokens = self.getApiMaxTokens(apiConfigId, 4096);
        PhoneCore.api.call(summaryPrompt, apiConfigId, { 
            messages: [{ role: 'user', content: summaryPrompt }],
            maxTokens: configuredMaxTokens,
            temperature: 0.5
        }).then(function(response) {
            var summary = (response.content || '').trim();
            if (summary.length > 60) {
                summary = summary.substring(0, 57) + '...';
            }
            if (!summary) {
                summary = callTypeName + '，交流了' + messages.length + '条消息。';
            }
            self.updateCallSummary(aiId, recordId, summary);
        }).catch(function(err) {
            console.error('生成通话梗概失败:', err);
            var fallbackSummary = callTypeName + '，共' + messages.length + '条消息。';
            self.updateCallSummary(aiId, recordId, fallbackSummary);
        });
    };
    
    // 更新通话记录的梗概
    ChatApp.prototype.updateCallSummary = function(aiId, recordId, summary) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        for (var i = 0; i < ai.chatHistory.length; i++) {
            if (ai.chatHistory[i].id === recordId && ai.chatHistory[i].callRecord) {
                ai.chatHistory[i].callRecord.summary = summary;
                PhoneCore.saveAI(ai);
                this.refreshChatIfOpen(aiId);
                break;
            }
        }
    };
    
    // 查看通话记录详情（淡色设计）
    ChatApp.prototype.openCallRecordDetail = function(aiId, recordId) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.chatHistory) return;
        
        // 找到通话记录
        var record = null;
        for (var i = 0; i < ai.chatHistory.length; i++) {
            if (ai.chatHistory[i].id === recordId) {
                record = ai.chatHistory[i].callRecord;
                break;
            }
        }
        
        if (!record) return;
        
        var avatarColor = this.getAvatarColor(aiId);
        var isVideo = record.callType === 'video';
        var callTypeName = isVideo ? '视频通话' : '语音通话';
        var durationText = record.wasConnected ? this.formatCallDuration(record.duration) : '未接通';
        var timeText = new Date(record.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // 淡粉色（视频）和淡蓝色（语音）
        var bgGradient = isVideo 
            ? 'linear-gradient(180deg,#FFF5F7 0%,#FFECF0 50%,#FFFFFF 100%)'
            : 'linear-gradient(180deg,#F0F5FF 0%,#E8F0FF 50%,#FFFFFF 100%)';
        var headerBg = isVideo ? '#FFEEF2' : '#E8F2FF';
        var textColor = isVideo ? '#C2185B' : '#3D5A80';
        var subTextColor = isVideo ? '#E91E63' : '#4A6FA5';
        var lightBg = isVideo ? 'rgba(233,30,99,0.06)' : 'rgba(74,111,165,0.06)';
        
        var html = '<div style="padding:0;min-height:100%;">';
        
        // 头部信息
        html += '<div style="margin: 10px;padding:24px 20px;text-align:center;background:' + headerBg + ';border-radius:24px;box-shadow: 0 0 1px 1px #fff;">';
        html += '<div style="width:64px;height:64px;border-radius:50%;margin:0 auto 14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);border:3px solid white;">';
        if (ai.avatar) {
            html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
        }
        html += '</div>';
        html += '<div style="color:' + textColor + ';font-size:18px;font-weight:600;margin-bottom:6px;">' + ai.name + '</div>';
        html += '<div style="color:' + subTextColor + ';font-size:14px;">' + callTypeName + ' · ' + durationText + '</div>';
        html += '<div style="color:' + (isVideo ? 'rgba(194,24,91,0.5)' : 'rgba(61,90,128,0.5)') + ';font-size:12px;margin-top:4px;">' + timeText + '</div>';
        html += '</div>';
        
        // 梗概
        if (record.summary) {
            html += '<div style="padding:16px 18px;background:white;margin:14px;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">';
            html += '<div style="color:' + (isVideo ? 'rgba(194,24,91,0.5)' : 'rgba(61,90,128,0.5)') + ';font-size:12px;margin-bottom:8px;">通话摘要</div>';
            html += '<div style="color:#333;font-size:14px;line-height:1.7;">' + record.summary + '</div>';
            html += '</div>';
        }
        
        // 消息列表
        html += '<div style="padding:0 14px 20px;">';
        html += '<div style="color:' + (isVideo ? 'rgba(194,24,91,0.5)' : 'rgba(61,90,128,0.5)') + ';font-size:12px;margin:14px 4px 12px;">消息记录 (' + (record.messages ? record.messages.length : 0) + '条)</div>';
        
        if (record.messages && record.messages.length > 0) {
            html += '<div style="display:flex;flex-direction:column;gap:10px;background:white;border-radius:14px;padding:14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">';
            record.messages.forEach(function(msg) {
                var isUser = msg.role === 'user';
                
                if (isUser) {
                    html += '<div style="display:flex;justify-content:flex-end;">';
                    html += '<div style="max-width:80%;">';
                    html += '<div style="background:linear-gradient(135deg,#4ade80,#22c55e);color:white;padding:10px 14px;border-radius:16px 16px 4px 16px;font-size:14px;line-height:1.5;">' + msg.content + '</div>';
                    html += '</div></div>';
                } else {
                    html += '<div style="display:flex;justify-content:flex-start;gap:8px;">';
                    html += '<div style="width:28px;height:28px;border-radius:10px;overflow:hidden;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.1);">';
                    if (ai.avatar) {
                        html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                    } else {
                        html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;background:linear-gradient(135deg,' + avatarColor + ',' + avatarColor + 'cc);color:white;">' + ai.name.charAt(0) + '</div>';
                    }
                    html += '</div>';
                    html += '<div style="max-width:75%;background:' + lightBg + ';color:#333;padding:10px 14px;border-radius:16px 16px 16px 4px;font-size:14px;line-height:1.5;">' + msg.content + '</div>';
                    html += '</div>';
                }
            });
            html += '</div>';
        } else {
            html += '<div style="text-align:center;padding:30px;color:' + (isVideo ? 'rgba(194,24,91,0.4)' : 'rgba(61,90,128,0.4)') + ';background:white;border-radius:14px;">无消息记录</div>';
        }
        
        html += '</div>';
        html += '</div>';
        
        this.openDetailPage(html, { title: callTypeName + '记录', backColor: textColor });
    };
    
    // 格式化通话时长
    ChatApp.prototype.formatCallDuration = function(seconds) {
        if (seconds < 60) {
            return seconds + '秒';
        } else if (seconds < 3600) {
            var mins = Math.floor(seconds / 60);
            var secs = seconds % 60;
            return mins + '分' + (secs > 0 ? secs + '秒' : '');
        } else {
            var hours = Math.floor(seconds / 3600);
            var mins = Math.floor((seconds % 3600) / 60);
            return hours + '小时' + (mins > 0 ? mins + '分' : '');
        }
    };


```

