# 06 — 发帖子(朋友圈 + 微博 + 帖子渲染 + 评论)

> **chat.js 原始范围**:`19604–20049`(朋友圈分享到聊天) + `20113–20170`(保存图片) + `20603–21145`(朋友圈评论 AI 互动) + `21147–21313`(发布朋友圈 UI) + `21363–21491`(AI 描述图生成器) + `23113–23301`(微博转发卡片渲染 + 接收分享 + AI 回应)
> 总长度 **约 2200 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | 朋友圈发布 | `openPostMoment` / `updateMomentImagesPreview` / `openAIImageGenerator` | 21147, 21314, 21363 |
> | 朋友圈卡片渲染 | 位于 `renderMomentsList`(18723+)| — |
> | 朋友圈详情 + 评论 | `openMomentDetail` / `renderMomentDetailPage` / `submitMomentComment` / `triggerAICommentReply` / `generateAICommentReply` / `triggerAIReplyOnUserMoment` / `generateAIReplyOnUserMoment` / `aiCommentOnMoment` / `triggerAICommentReplyToAI` / `triggerAICommentInteraction` / `generateAIInteractionReply` | 20205, 20251, 20603, 20687, 20734, 20782, 20849, 20899, 20978, 21023, 21083 |
> | 朋友圈分享到聊天 / 微博 | `openShareMomentPanel` / `shareMomentToFriend` / `sendMomentCard` / `forwardMomentToMyMoments` / `copyMomentContent` / `saveMomentImages` | 19647, 19825, 19903, 19946, 20050, 20113 |
> | 微博分享到聊天 | `openShareToWeiboModal` / `publishToWeibo` | 3948, 4116 |
> | 微博卡片渲染 | `renderWeiboCard` | 23113 |
> | 微博接收 + AI 回应 | `receiveWeiboShare` / `triggerAIWeiboResponse` | 23210, 23263 |
>
> ## 关联
>
> 朋友圈页整体渲染见 `js/apps/chat-app/pages/moments-page.js`(新 chat-app),旧版在 `chat.js 18654–19603`(`renderMomentsPage` / `renderMomentsList` / `bindMomentsListEvents` / `renderMomentItem` / `bindMomentsPageEvents`)。
>
> ---
>
> 下面是 chat.js 19604–20049 + 20113–20170 + 20603–21145 + 21147–21313 + 21363–21491 + 23113–23301 的原始代码,未做精简。

```js
// ================ chat.js 行 19604 ~ 20049 ================
// ================ chat.js 行 19604 ~ 20049 ================
    // ============ 朋友圈分享功能 ============
    
    // 分享朋友圈动态
    ChatApp.prototype.shareMoment = function(aiId, momentId, isUserMoment) {
        var self = this;
        var moment = null;
        var momentOwner = null;
        
        // 获取动态数据
        if (isUserMoment) {
            // 用户自己的动态，需要从数据库获取
            PhoneCore.db.getAll('app_data').then(function(dataList) {
                var item = dataList.find(function(d) {
                    return d.appId && d.appId.indexOf('user_moments_') === 0 && d.data && d.data.id === momentId;
                });
                if (item && item.data) {
                    var mask = PhoneCore.user.getCurrentMask();
                    momentOwner = {
                        id: 'user',
                        name: mask ? mask.name : '我',
                        avatar: mask ? mask.avatar : null
                    };
                    self.openShareMomentPanel(item.data, momentOwner);
                }
            });
        } else {
            // AI的动态
            var ai = PhoneCore.getAI(aiId);
            if (ai && ai.moments) {
                moment = ai.moments.find(function(m) { return m.id === momentId; });
                if (moment) {
                    momentOwner = {
                        id: ai.id,
                        name: ai.name,
                        avatar: ai.avatar
                    };
                    self.openShareMomentPanel(moment, momentOwner);
                }
            }
        }
    };
    
    // 打开分享面板
    ChatApp.prototype.openShareMomentPanel = function(moment, owner) {
        var self = this;
        
        // 确保appWindow存在
        if (!this.appWindow) {
            this.showToast('无法打开分享面板');
            return;
        }
        
        // 创建分享面板遮罩层 - 使用absolute定位在应用窗口内
        var overlay = document.createElement('div');
        overlay.className = 'share-panel-overlay';
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
        
        // 分享面板
        var panelHtml = '<div class="share-panel" style="width:100%;background:linear-gradient(180deg,#FFFFFF 0%,#FFF8FA 100%);border-radius:20px 20px 0 0;padding:20px 16px 30px;animation:slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);">';
        
        // 标题栏
        panelHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        panelHtml += '<div style="font-size:18px;font-weight:600;color:#262626;">分享动态</div>';
        panelHtml += '<div class="share-panel-close" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;background:rgba(142,142,142,0.1);transition:all 0.3s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E8E" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>';
        panelHtml += '</div>';
        
        // 动态预览卡片
        panelHtml += '<div class="share-preview-card" style="background:white;border-radius:12px;padding:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1px solid rgba(255,177,193,0.15);">';
        panelHtml += '<div style="display:flex;align-items:center;margin-bottom:10px;">';
        panelHtml += '<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;margin-right:10px;border:2px solid #FFE6F0;">';
        if (owner.avatar) {
            panelHtml += '<img src="' + owner.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            panelHtml += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;background:linear-gradient(135deg,#FFB1C1,#A8C8EC);color:white;font-weight:600;">' + owner.name.charAt(0) + '</div>';
        }
        panelHtml += '</div>';
        panelHtml += '<div style="flex:1;">';
        panelHtml += '<div style="font-weight:600;color:#262626;font-size:14px;">' + owner.name + '</div>';
        panelHtml += '<div style="font-size:11px;color:#8E8E8E;">' + this.formatTime(moment.timestamp) + '</div>';
        panelHtml += '</div>';
        panelHtml += '</div>';
        
        // 内容预览
        if (moment.content) {
            var previewContent = moment.content.length > 60 ? moment.content.substring(0, 60) + '...' : moment.content;
            panelHtml += '<div style="font-size:13px;color:#262626;line-height:1.5;margin-bottom:8px;white-space:pre-wrap;">' + previewContent + '</div>';
        }
        
        // 图片预览
        var hasImages = (moment.images && moment.images.length > 0) || (moment.aiImages && moment.aiImages.length > 0);
        if (hasImages) {
            var imgCount = (moment.images ? moment.images.length : 0) + (moment.aiImages ? moment.aiImages.length : 0);
            panelHtml += '<div style="display:flex;gap:4px;margin-top:8px;">';
            if (moment.images && moment.images.length > 0) {
                panelHtml += '<div style="width:50px;height:50px;border-radius:6px;overflow:hidden;background:#f0f0f0;"><img src="' + moment.images[0] + '" style="width:100%;height:100%;object-fit:cover;"></div>';
            } else if (moment.aiImages && moment.aiImages.length > 0) {
                var shareAiImg = moment.aiImages[0];
                var shareCardColor = shareAiImg.cardColor || '#FFE4EC';
                var shareTextColor = shareAiImg.textColor || '#D4728A';
                panelHtml += '<div style="width:50px;height:50px;border-radius:6px;overflow:hidden;background:' + shareCardColor + ';display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="' + shareTextColor + '" opacity="0.6"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>';
            }
            if (imgCount > 1) {
                panelHtml += '<div style="width:50px;height:50px;border-radius:6px;background:rgba(142,142,142,0.1);display:flex;align-items:center;justify-content:center;font-size:12px;color:#8E8E8E;font-weight:500;">+' + (imgCount - 1) + '</div>';
            }
            panelHtml += '</div>';
        }
        panelHtml += '</div>';
        
        // 分享选项
        panelHtml += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">';
        
        // 分享给好友
        panelHtml += '<div class="share-option" data-action="friend" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:12px 8px;border-radius:12px;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);">';
        panelHtml += '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#FFB1C1,#FF8FAB);display:flex;align-items:center;justify-content:center;margin-bottom:8px;box-shadow:0 4px 12px rgba(255,177,193,0.3);">';
        panelHtml += '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
        panelHtml += '</div>';
        panelHtml += '<span style="font-size:12px;color:#262626;font-weight:500;">发送给好友</span>';
        panelHtml += '</div>';
        
        // 转发到朋友圈
        panelHtml += '<div class="share-option" data-action="moments" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:12px 8px;border-radius:12px;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);">';
        panelHtml += '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#A8C8EC,#8EB5E0);display:flex;align-items:center;justify-content:center;margin-bottom:8px;box-shadow:0 4px 12px rgba(168,200,236,0.3);">';
        panelHtml += '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        panelHtml += '</div>';
        panelHtml += '<span style="font-size:12px;color:#262626;font-weight:500;">转发朋友圈</span>';
        panelHtml += '</div>';
        
        // 复制内容
        panelHtml += '<div class="share-option" data-action="copy" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:12px 8px;border-radius:12px;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);">';
        panelHtml += '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#B8A9C9,#9D8EC3);display:flex;align-items:center;justify-content:center;margin-bottom:8px;box-shadow:0 4px 12px rgba(157,142,195,0.3);">';
        panelHtml += '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        panelHtml += '</div>';
        panelHtml += '<span style="font-size:12px;color:#262626;font-weight:500;">复制内容</span>';
        panelHtml += '</div>';
        
        // 保存图片（如果有图片）
        if (hasImages && moment.images && moment.images.length > 0) {
            panelHtml += '<div class="share-option" data-action="save" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:12px 8px;border-radius:12px;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);">';
            panelHtml += '<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#7BC88C,#5AB06A);display:flex;align-items:center;justify-content:center;margin-bottom:8px;box-shadow:0 4px 12px rgba(90,176,106,0.3);">';
            panelHtml += '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
            panelHtml += '</div>';
            panelHtml += '<span style="font-size:12px;color:#262626;font-weight:500;">保存图片</span>';
            panelHtml += '</div>';
        } else {
            // 占位
            panelHtml += '<div style="display:flex;flex-direction:column;align-items:center;padding:12px 8px;"></div>';
        }
        
        panelHtml += '</div>';
        
        // 取消按钮
        panelHtml += '<button class="share-cancel-btn" style="width:100%;padding:14px;background:rgba(142,142,142,0.08);border:none;border-radius:12px;font-size:15px;color:#8E8E8E;cursor:pointer;font-weight:500;transition:all 0.3s;">取消</button>';
        
        panelHtml += '</div>';
        
        overlay.innerHTML = panelHtml;
        this.appWindow.appendChild(overlay);
        
        // 添加动画样式（如果不存在）
        if (!document.getElementById('share-panel-animations')) {
            var style = document.createElement('style');
            style.id = 'share-panel-animations';
            style.textContent = '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
            document.head.appendChild(style);
        }
        
        // 关闭面板
        var closePanel = function() {
            overlay.style.animation = 'fadeIn 0.2s ease reverse';
            overlay.querySelector('.share-panel').style.animation = 'slideUp 0.2s ease reverse';
            setTimeout(function() {
                overlay.remove();
            }, 200);
        };
        
        // 点击遮罩关闭
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                closePanel();
            }
        };
        
        // 关闭按钮
        overlay.querySelector('.share-panel-close').onclick = closePanel;
        overlay.querySelector('.share-cancel-btn').onclick = closePanel;
        
        // 分享选项点击
        overlay.querySelectorAll('.share-option').forEach(function(option) {
            // 悬停效果
            option.onmouseenter = function() {
                option.style.background = 'rgba(255,177,193,0.1)';
                option.style.transform = 'scale(1.05)';
            };
            option.onmouseleave = function() {
                option.style.background = 'transparent';
                option.style.transform = 'scale(1)';
            };
            
            option.onclick = function() {
                var action = option.getAttribute('data-action');
                closePanel();
                
                switch(action) {
                    case 'friend':
                        self.shareMomentToFriend(moment, owner);
                        break;
                    case 'moments':
                        self.forwardMomentToMyMoments(moment, owner);
                        break;
                    case 'copy':
                        self.copyMomentContent(moment, owner);
                        break;
                    case 'save':
                        self.saveMomentImages(moment);
                        break;
                }
            };
        });
    };
    
    // 分享给好友
    ChatApp.prototype.shareMomentToFriend = function(moment, owner) {
        var self = this;
        var allAIs = Object.values(PhoneCore.ais);
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;color:#262626;">发送给</div>';
        
        // 动态卡片预览
        html += '<div style="background:white;border-radius:12px;padding:15px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">';
        html += '<div style="display:flex;align-items:center;margin-bottom:10px;">';
        html += '<div style="width:32px;height:32px;border-radius:50%;overflow:hidden;margin-right:8px;border:1px solid #FFE6F0;">';
        if (owner.avatar) {
            html += '<img src="' + owner.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;background:linear-gradient(135deg,#FFB1C1,#A8C8EC);color:white;">' + owner.name.charAt(0) + '</div>';
        }
        html += '</div>';
        html += '<span style="font-weight:500;color:#262626;font-size:13px;">' + owner.name + ' 的动态</span>';
        html += '</div>';
        if (moment.content) {
            var previewText = moment.content.length > 40 ? moment.content.substring(0, 40) + '...' : moment.content;
            html += '<div style="font-size:12px;color:#666;line-height:1.4;">' + previewText + '</div>';
        }
        if (moment.images && moment.images.length > 0) {
            html += '<div style="margin-top:8px;display:flex;gap:4px;">';
            html += '<div style="width:40px;height:40px;border-radius:4px;overflow:hidden;"><img src="' + moment.images[0] + '" style="width:100%;height:100%;object-fit:cover;"></div>';
            if (moment.images.length > 1) {
                html += '<div style="width:40px;height:40px;border-radius:4px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">+' + (moment.images.length - 1) + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        
        // 联系人列表
        html += '<div style="font-size:13px;color:#8E8E8E;margin-bottom:12px;font-weight:500;">选择联系人</div>';
        
        allAIs.forEach(function(ai) {
            html += '<div class="share-target-item" data-ai-id="' + ai.id + '" style="display:flex;align-items:center;padding:14px;background:white;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);border:1px solid transparent;">';
            html += '<div style="width:45px;height:45px;border-radius:50%;margin-right:12px;overflow:hidden;border:2px solid #FFE6F0;">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:' + self.getAvatarColor(ai.id) + ';color:white;font-weight:600;">' + ai.name.charAt(0) + '</div>';
            }
            html += '</div>';
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:600;color:#262626;font-size:14px;">' + ai.name + '</div>';
            html += '<div style="font-size:12px;color:#8E8E8E;margin-top:2px;">' + (ai.personality || '点击发送动态') + '</div>';
            html += '</div>';
            html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';
            html += '</div>';
        });
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 选择目标
        page.querySelectorAll('.share-target-item').forEach(function(item) {
            // 悬停效果
            item.onmouseenter = function() {
                item.style.borderColor = '#FFB1C1';
                item.style.background = 'rgba(255,177,193,0.05)';
            };
            item.onmouseleave = function() {
                item.style.borderColor = 'transparent';
                item.style.background = 'white';
            };
            
            item.onclick = function() {
                var aiId = item.getAttribute('data-ai-id');
                self.sendMomentCard(aiId, moment, owner);
                page.querySelector('.app-back-btn').click();
            };
        });
    };
    
    // 发送动态卡片给好友
    ChatApp.prototype.sendMomentCard = function(aiId, moment, owner) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 创建动态分享卡片消息
        var shareMessage = {
            id: 'msg_' + Date.now(),
            role: 'user',
            type: 'moment_share',
            content: '',
            momentCard: {
                id: moment.id,
                ownerId: owner.id,
                ownerName: owner.name,
                ownerAvatar: owner.avatar,
                content: moment.content,
                images: moment.images,
                aiImages: moment.aiImages,
                timestamp: moment.timestamp
            },
            timestamp: Date.now()
        };
        
        if (!ai.chatHistory) {
            ai.chatHistory = [];
        }
        ai.chatHistory.push(shareMessage);
        PhoneCore.saveAI(ai);
        
        PhoneCore.notifications.send({
            type: 'success',
            title: '分享成功',
            message: '已分享给 ' + ai.name,
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#4CAF50"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
            size: 'mini',
            duration: 2000
        });
        
        // 打开聊天
        this.openChatDetail(aiId);
    };
    
    // 转发到朋友圈
    ChatApp.prototype.forwardMomentToMyMoments = function(moment, owner) {
        var self = this;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;color:#262626;">转发到朋友圈</div>';
        
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        
        // 转发来源标识
        html += '<div style="background:linear-gradient(135deg,#FFF5F7,#F0F7FF);border-radius:8px;padding:10px 12px;margin-bottom:15px;display:flex;align-items:center;gap:8px;">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="#A8C8EC"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
        html += '<span style="font-size:12px;color:#8E8E8E;">转发自 <span style="color:#262626;font-weight:500;">' + owner.name + '</span></span>';
        html += '</div>';
        
        // 文字输入 - 预填充原始内容
        var forwardText = moment.content || '';
        html += '<textarea id="forward-content" placeholder="说点什么..." style="width:100%;padding:0;border:none;font-size:15px;min-height:80px;resize:none;outline:none;box-sizing:border-box;line-height:1.5;">' + forwardText + '</textarea>';
        
        // 原始动态预览
        html += '<div style="background:#F9F9F9;border-radius:10px;padding:12px;margin-top:15px;border-left:3px solid #FFB1C1;">';
        html += '<div style="display:flex;align-items:center;margin-bottom:8px;">';
        html += '<div style="width:28px;height:28px;border-radius:50%;overflow:hidden;margin-right:8px;">';
        if (owner.avatar) {
            html += '<img src="' + owner.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;background:linear-gradient(135deg,#FFB1C1,#A8C8EC);color:white;">' + owner.name.charAt(0) + '</div>';
        }
        html += '</div>';
        html += '<span style="font-size:12px;color:#666;font-weight:500;">' + owner.name + '</span>';
        html += '</div>';
        if (moment.content) {
            var shortContent = moment.content.length > 50 ? moment.content.substring(0, 50) + '...' : moment.content;
            html += '<div style="font-size:12px;color:#666;line-height:1.4;">' + shortContent + '</div>';
        }
        if (moment.images && moment.images.length > 0) {
            html += '<div style="margin-top:8px;display:flex;gap:4px;">';
            for (var i = 0; i < Math.min(3, moment.images.length); i++) {
                html += '<div style="width:36px;height:36px;border-radius:4px;overflow:hidden;"><img src="' + moment.images[i] + '" style="width:100%;height:100%;object-fit:cover;"></div>';
            }
            if (moment.images.length > 3) {
                html += '<div style="width:36px;height:36px;border-radius:4px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">+' + (moment.images.length - 3) + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="forward-moment-btn" style="width:100%;padding:15px;background:linear-gradient(135deg,#FFB1C1,#A8C8EC);color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;font-weight:600;box-shadow:0 4px 15px rgba(255,177,193,0.3);transition:all 0.3s;">发布转发</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 发布转发
        var forwardBtn = page.querySelector('#forward-moment-btn');
        if (forwardBtn) {
            forwardBtn.onclick = function() {
                var content = page.querySelector('#forward-content').value.trim();
                
                var forwardMoment = {
                    id: 'moment_' + Date.now(),
                    content: content,
                    images: moment.images ? moment.images.slice() : [],
                    aiImages: moment.aiImages ? moment.aiImages.slice() : [],
                    location: '',
                    visibility: 'public',
                    timestamp: Date.now(),
                    likes: [],
                    comments: [],
                    isUserMoment: true,
                    isForward: true,
                    forwardFrom: {
                        id: owner.id,
                        name: owner.name,
                        avatar: owner.avatar,
                        originalContent: moment.content,
                        originalTimestamp: moment.timestamp
                    }
                };
                
                // 保存到数据库 - appId作为主键需要唯一
                PhoneCore.db.put('app_data', {
                    appId: 'user_moments_' + forwardMoment.id,
                    momentId: forwardMoment.id,
                    data: forwardMoment,
                    createTime: Date.now()
                }).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '转发成功',
                        message: '动态已发布到朋友圈',
                        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#4CAF50"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
                        size: 'mini',
                        duration: 2000
                    });
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                });
            };
        }
    };
    
    // 复制动态内容

// ================ chat.js 行 20113 ~ 20170 (保存图片) ================
    ChatApp.prototype.saveMomentImages = function(moment) {
        var self = this;
        
        if (!moment.images || moment.images.length === 0) {
            this.showToast('没有可保存的图片');
            return;
        }
        
        // 保存所有图片
        var savedCount = 0;
        moment.images.forEach(function(imgSrc, index) {
            // 创建下载链接
            var link = document.createElement('a');
            link.href = imgSrc;
            link.download = 'moment_image_' + Date.now() + '_' + index + '.jpg';
            
            // 如果是base64图片，直接下载
            if (imgSrc.startsWith('data:')) {
                link.click();
                savedCount++;
            } else {
                // 外部图片，尝试通过canvas处理
                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    try {
                        var dataUrl = canvas.toDataURL('image/jpeg');
                        link.href = dataUrl;
                        link.click();
                        savedCount++;
                    } catch (e) {
                        // 跨域限制，打开新窗口
                        window.open(imgSrc, '_blank');
                    }
                };
                img.onerror = function() {
                    window.open(imgSrc, '_blank');
                };
                img.src = imgSrc;
            }
        });
        
        PhoneCore.notifications.send({
            type: 'success',
            title: '保存图片',
            message: '正在保存 ' + moment.images.length + ' 张图片',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>',
            size: 'mini',
            duration: 2000
        });
    };

    // 打开微博帖子详情（从聊天中点击微博卡片）

// ================ chat.js 行 20603 ~ 21145 (朋友圈评论 AI 互动) ================
    ChatApp.prototype.submitMomentComment = function(aiId, momentId, content, isUserMoment, replyTo) {
        var self = this;
        var mask = PhoneCore.user.getCurrentMask();
        
        var newComment = {
            id: 'comment_' + Date.now(),
            author: mask ? mask.name : '我',
            authorAvatar: mask ? mask.avatar : (PhoneCore.user.avatar || ''),
            isUserComment: true, // 标记为用户评论，以便渲染时可以使用当前mask的头像
            content: content,
            timestamp: Date.now()
        };
        
        // 如果是回复评论
        if (replyTo) {
            newComment.replyTo = replyTo;
        }
        
        // 处理用户发布的动态评论
        if (isUserMoment || aiId === 'user_self') {
            PhoneCore.db.getAll('app_data').then(function(dataList) {
                var item = dataList.find(function(d) {
                    return d.appId && d.appId.indexOf('user_moments_') === 0 && d.data && d.data.id === momentId;
                });
                if (item && item.data) {
                    var moment = item.data;
                    if (!moment.comments) moment.comments = [];
                    moment.comments.push(newComment);
                    
                    // 更新数据库并等待完成后再刷新UI
                    item.data = moment; // 更新item对象
                    PhoneCore.db.put('app_data', item).then(function() {
                        // 延迟刷新，确保数据库更新完成
                        setTimeout(function() {
                            self.refreshCurrentTab();
                            self.showToast('评论成功');
                            
                            // 检查是否需要触发AI回复（用户朋友圈下有AI评论过）
                            self.triggerAIReplyOnUserMoment(moment, newComment);
                        }, 100);
                    }).catch(function(err) {
                        console.error('更新评论失败:', err);
                        self.showToast('评论失败');
                    });
                } else {
                    self.showToast('找不到动态');
                }
            }).catch(function(err) {
                console.error('查询动态失败:', err);
                self.showToast('评论失败');
            });
            return;
        }
        
        // 处理AI动态的评论
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.moments) {
            self.showToast('找不到AI');
            return;
        }
        
        var moment = ai.moments.find(function(m) { return m.id === momentId; });
        if (!moment) {
            self.showToast('找不到动态');
            return;
        }
        
        if (!moment.comments) moment.comments = [];
        moment.comments.push(newComment);
        
        // 保存AI并等待完成后再刷新
        PhoneCore.saveAI(ai);
        
        // 延迟刷新，确保数据保存完成
        setTimeout(function() {
            self.refreshCurrentTab();
            self.showToast('评论成功');
            
            // 触发AI回复评论
            self.triggerAICommentReply(ai, moment, newComment);
        }, 100);
    };
    
    // AI回复朋友圈评论
    ChatApp.prototype.triggerAICommentReply = function(ai, moment, userComment) {
        var self = this;
        
        // 获取评论轮次配置
        var config = ai.momentsReadConfig || { commentRounds: 2 };
        var maxRounds = config.commentRounds || 2;
        
        if (maxRounds <= 0) return;
        
        // 计算当前对话轮次（计算用户与AI之间的来回次数）
        var comments = moment.comments || [];
        var currentRound = 0;
        var lastWasUser = false;
        for (var i = 0; i < comments.length; i++) {
            var c = comments[i];
            var isAI = c.author === ai.name;
            var isUser = !isAI && c.author !== ai.name;
            if (isUser && !lastWasUser) {
                currentRound++;
                lastWasUser = true;
            } else if (isAI) {
                lastWasUser = false;
            }
        }
        
        if (currentRound > maxRounds) return;
        
        // 构建评论上下文
        var commentContext = '朋友圈内容：' + (moment.content || '(图片动态)') + '\n';
        commentContext += '评论区对话：\n';
        comments.slice(-6).forEach(function(c) {
            var isMe = c.author === ai.name;
            commentContext += (isMe ? '你' : c.author) + '：' + c.content + '\n';
        });
        
        // 构建AI提示词
        var prompt = '你是' + ai.name + '，有人在你的朋友圈动态下评论了。\n';
        prompt += commentContext;
        prompt += '\n请简短地回复最后一条评论（不超过30字），用自然的聊天语气，符合你的人设。只输出回复内容，不要带引号或前缀。';
        
        // 调用AI生成回复
        setTimeout(function() {
            self.generateAICommentReply(ai, moment.id, prompt, userComment.author);
        }, 1500 + Math.random() * 2000);
    };
    
    // 生成AI评论回复
    ChatApp.prototype.generateAICommentReply = function(ai, momentId, prompt, replyToAuthor) {
        var self = this;
        
        PhoneCore.api.call({
            messages: [{ role: 'user', content: prompt }],
            model: ai.model || 'gpt-3.5-turbo',
            max_tokens: 100
        }).then(function(response) {
            var reply = response.content || response.message || '';
            reply = reply.trim().replace(/^["']|["']$/g, '');
            
            if (reply && reply.length > 0 && reply.length < 100) {
                // 重新获取AI和moment，确保数据最新
                var freshAI = PhoneCore.getAI(ai.id);
                if (!freshAI || !freshAI.moments) return;
                
                var moment = freshAI.moments.find(function(m) { return m.id === momentId; });
                if (!moment) return;
                
                var newComment = {
                    id: 'comment_' + Date.now(),
                    author: freshAI.name,
                    authorAvatar: freshAI.avatar || '',
                    content: reply,
                    timestamp: Date.now(),
                    replyTo: replyToAuthor,
                    isAI: true
                };
                
                if (!moment.comments) moment.comments = [];
                moment.comments.push(newComment);
                
                PhoneCore.saveAI(freshAI);
                
                // 触发评论区其他AI互动
                self.triggerAICommentInteraction(moment, newComment, freshAI.id);
                
                // 刷新朋友圈显示
                setTimeout(function() {
                    self.refreshCurrentTab();
                }, 200);
            }
        }).catch(function(err) {
            console.error('AI评论回复生成失败:', err);
        });
    };
    
    // 触发AI在用户朋友圈下的回复
    ChatApp.prototype.triggerAIReplyOnUserMoment = function(moment, userComment) {
        var self = this;
        var comments = moment.comments || [];
        
        // 找出在这条朋友圈评论过的AI
        var aiCommenters = {};
        comments.forEach(function(c) {
            if (c.isAI && c.author) {
                aiCommenters[c.author] = true;
            }
        });
        
        var aiNames = Object.keys(aiCommenters);
        if (aiNames.length === 0) return;
        
        // 对每个评论过的AI，检查是否应该回复
        aiNames.forEach(function(aiName) {
            // 找到对应的AI
            var ai = Object.values(PhoneCore.ais).find(function(a) {
                return a.name === aiName;
            });
            if (!ai) return;
            
            // 获取评论轮次配置
            var config = ai.momentsReadConfig || { commentRounds: 2 };
            var maxRounds = config.commentRounds || 2;
            if (maxRounds <= 0) return;
            
            // 计算该AI与用户之间的对话轮次
            var aiRounds = 0;
            var lastWasUser = false;
            for (var i = 0; i < comments.length; i++) {
                var c = comments[i];
                var isThisAI = c.author === aiName && c.isAI;
                var isUser = !c.isAI;
                if (isUser && !lastWasUser) {
                    aiRounds++;
                    lastWasUser = true;
                } else if (isThisAI) {
                    lastWasUser = false;
                }
            }
            
            if (aiRounds > maxRounds) return;
            
            // 构建评论上下文
            var commentContext = '朋友圈内容：' + (moment.content || '(图片动态)') + '\n';
            commentContext += '这是用户发的朋友圈动态，你之前在下面评论过。\n';
            commentContext += '评论区对话：\n';
            comments.slice(-6).forEach(function(c) {
                var isMe = c.author === aiName && c.isAI;
                commentContext += (isMe ? '你' : c.author) + '：' + c.content + '\n';
            });
            
            // 构建AI提示词
            var prompt = '你是' + ai.name + '，你之前评论过用户的朋友圈动态，现在用户又发了新评论。\n';
            prompt += commentContext;
            prompt += '\n请简短地回复最后一条评论（不超过30字），用自然的聊天语气，符合你的人设。只输出回复内容，不要带引号或前缀。';
            
            // 延迟调用AI生成回复
            setTimeout(function() {
                self.generateAIReplyOnUserMoment(ai, moment.id, prompt, userComment.author);
            }, 2000 + Math.random() * 3000);
        });
    };
    
    // 生成AI在用户朋友圈下的回复
    ChatApp.prototype.generateAIReplyOnUserMoment = function(ai, momentId, prompt, replyToAuthor) {
        var self = this;
        
        PhoneCore.api.call({
            messages: [{ role: 'user', content: prompt }],
            model: ai.model || 'gpt-3.5-turbo',
            max_tokens: 100
        }).then(function(response) {
            var reply = response.content || response.message || '';
            reply = reply.trim().replace(/^["']|["']$/g, '');
            
            if (reply && reply.length > 0 && reply.length < 100) {
                // 从数据库获取最新的moment
                PhoneCore.db.getAll('app_data').then(function(dataList) {
                    var item = dataList.find(function(d) {
                        return d.appId && d.appId.indexOf('user_moments_') === 0 && d.data && d.data.id === momentId;
                    });
                    if (item && item.data) {
                        var moment = item.data;
                        var newComment = {
                            id: 'comment_' + Date.now(),
                            author: ai.name,
                            authorAvatar: ai.avatar || '',
                            content: reply,
                            timestamp: Date.now(),
                            replyTo: replyToAuthor,
                            isAI: true
                        };
                        
                        if (!moment.comments) moment.comments = [];
                        moment.comments.push(newComment);
                        
                        item.data = moment;
                        PhoneCore.db.put('app_data', item).then(function() {
                            // 触发评论区其他AI互动
                            self.triggerAICommentInteraction(moment, newComment, 'user');
                            
                            setTimeout(function() {
                                self.refreshCurrentTab();
                            }, 200);
                        });
                    }
                });
            }
        }).catch(function(err) {
            console.error('AI评论用户朋友圈回复失败:', err);
        });
    };
    
    // AI主动评论朋友圈（评论其他AI或用户的朋友圈）
    ChatApp.prototype.aiCommentOnMoment = function(ai, targetAuthor, commentContent, replyTo) {
        var self = this;
        var mask = PhoneCore.user.getCurrentMask ? PhoneCore.user.getCurrentMask() : null;
        var userName = mask ? mask.name : '用户';
        
        // 创建评论对象
        var newComment = {
            id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            author: ai.name,
            authorAvatar: ai.avatar || '',
            content: commentContent,
            timestamp: Date.now(),
            isAI: true
        };
        
        if (replyTo) {
            newComment.replyTo = replyTo;
        }
        
        // 检查是否是评论用户的朋友圈
        if (targetAuthor === userName || targetAuthor === '用户' || targetAuthor === '我') {
            // 评论用户朋友圈
            PhoneCore.db.getAll('app_data').then(function(dataList) {
                // 找到用户最新的朋友圈
                var userMoments = dataList.filter(function(d) {
                    return d.appId && d.appId.indexOf('user_moments_') === 0 && d.data;
                }).sort(function(a, b) {
                    return (b.data.timestamp || 0) - (a.data.timestamp || 0);
                });
                
                if (userMoments.length > 0) {
                    var item = userMoments[0];
                    var moment = item.data;
                    if (!moment.comments) moment.comments = [];
                    moment.comments.push(newComment);
                    item.data = moment;
                    
                    PhoneCore.db.put('app_data', item).then(function() {
                        console.log(ai.name + ' 评论了用户的朋友圈：' + commentContent);
                        // 触发其他AI互动
                        self.triggerAICommentInteraction(moment, newComment, 'user');
                        setTimeout(function() {
                            self.refreshCurrentTab();
                        }, 200);
                    });
                }
            });
            return;
        }
        
        // 检查是否是评论其他AI的朋友圈
        var targetAI = Object.values(PhoneCore.ais).find(function(a) {
            return a.name === targetAuthor;
        });
        
        if (targetAI && targetAI.moments && targetAI.moments.length > 0) {
            // 找到目标AI的最新朋友圈
            var targetMoment = targetAI.moments[0];
            if (!targetMoment.comments) targetMoment.comments = [];
            targetMoment.comments.push(newComment);
            PhoneCore.saveAI(targetAI);
            
            console.log(ai.name + ' 评论了 ' + targetAuthor + ' 的朋友圈：' + commentContent);
            
            // 触发目标AI回复
            if (targetAI.id !== ai.id) {
                self.triggerAICommentReplyToAI(targetAI, targetMoment, newComment);
            }
            
            // 触发其他AI互动（在评论区的其他AI）
            self.triggerAICommentInteraction(targetMoment, newComment, targetAI.id);
            
            setTimeout(function() {
                self.refreshCurrentTab();
            }, 200);
        }
    };
    
    // AI回复其他AI在自己朋友圈的评论
    ChatApp.prototype.triggerAICommentReplyToAI = function(ownerAI, moment, aiComment) {
        var self = this;
        
        var config = ownerAI.momentsReadConfig || { commentRounds: 2 };
        var maxRounds = config.commentRounds || 2;
        if (maxRounds <= 0) return;
        
        // 计算当前这个AI与评论者之间的对话轮次
        var comments = moment.comments || [];
        var commenterName = aiComment.author;
        var currentRound = 0;
        var lastWasCommenter = false;
        
        for (var i = 0; i < comments.length; i++) {
            var c = comments[i];
            var isOwner = c.author === ownerAI.name;
            var isCommenter = c.author === commenterName;
            if (isCommenter && !lastWasCommenter) {
                currentRound++;
                lastWasCommenter = true;
            } else if (isOwner) {
                lastWasCommenter = false;
            }
        }
        
        if (currentRound > maxRounds) return;
        
        // 构建评论上下文
        var commentContext = '朋友圈内容：' + (moment.content || '(图片动态)') + '\n';
        commentContext += '评论区对话：\n';
        comments.slice(-6).forEach(function(c) {
            var isMe = c.author === ownerAI.name;
            commentContext += (isMe ? '你' : c.author) + '：' + c.content + '\n';
        });
        
        var prompt = '你是' + ownerAI.name + '，有人在你的朋友圈动态下评论了。\n';
        prompt += commentContext;
        prompt += '\n请简短地回复最后一条评论（不超过30字），用自然的聊天语气，符合你的人设。只输出回复内容，不要带引号或前缀。';
        
        setTimeout(function() {
            self.generateAICommentReply(ownerAI, moment.id, prompt, aiComment.author);
        }, 1500 + Math.random() * 2000);
    };
    
    // 触发朋友圈评论区的AI互动（当有新评论时，通知评论区里的其他AI）
    ChatApp.prototype.triggerAICommentInteraction = function(moment, newComment, momentOwnerId) {
        var self = this;
        var comments = moment.comments || [];
        
        // 收集评论区里评论过的AI（排除刚评论的AI和动态所有者）
        var aiCommenters = {};
        comments.forEach(function(c) {
            if (c.isAI && c.author && c.author !== newComment.author) {
                aiCommenters[c.author] = true;
            }
        });
        
        var aiNames = Object.keys(aiCommenters);
        if (aiNames.length === 0) return;
        
        // 对每个在评论区评论过的AI，随机决定是否回复
        aiNames.forEach(function(aiName) {
            // 30%概率触发AI互动回复
            if (Math.random() > 0.3) return;
            
            var ai = Object.values(PhoneCore.ais).find(function(a) {
                return a.name === aiName;
            });
            if (!ai) return;
            
            // 检查是否是动态所有者（所有者通过其他逻辑回复）
            if (momentOwnerId !== 'user' && ai.id === momentOwnerId) return;
            
            var config = ai.momentsReadConfig || { commentRounds: 2 };
            var maxRounds = config.commentRounds || 2;
            if (maxRounds <= 0) return;
            
            // 计算该AI在这条朋友圈下的互动轮次
            var aiInteractions = 0;
            comments.forEach(function(c) {
                if (c.author === aiName && c.isAI) aiInteractions++;
            });
            
            if (aiInteractions >= maxRounds) return;
            
            // 构建评论上下文
            var commentContext = '朋友圈内容：' + (moment.content || '(图片动态)') + '\n';
            commentContext += '这是别人发的朋友圈，你之前在下面评论过。现在评论区有新回复。\n';
            commentContext += '评论区对话：\n';
            comments.slice(-6).forEach(function(c) {
                var isMe = c.author === aiName;
                commentContext += (isMe ? '你' : c.author) + '：' + c.content + '\n';
            });
            
            var prompt = '你是' + ai.name + '，你之前在一条朋友圈下评论过，现在评论区有新消息。\n';
            prompt += commentContext;
            prompt += '\n如果你想回应最后一条评论，请简短地回复（不超过30字），用自然的聊天语气。如果不需要回复可以输出"[不回复]"。只输出回复内容，不要带引号或前缀。';
            
            setTimeout(function() {
                self.generateAIInteractionReply(ai, moment, prompt, newComment.author, momentOwnerId);
            }, 3000 + Math.random() * 4000);
        });
    };
    
    // 生成AI在评论区的互动回复
    ChatApp.prototype.generateAIInteractionReply = function(ai, moment, prompt, replyToAuthor, momentOwnerId) {
        var self = this;
        
        PhoneCore.api.call({
            messages: [{ role: 'user', content: prompt }],
            model: ai.model || 'gpt-3.5-turbo',
            max_tokens: 100
        }).then(function(response) {
            var reply = response.content || response.message || '';
            reply = reply.trim().replace(/^["']|["']$/g, '');
            
            // 如果AI选择不回复
            if (reply.includes('[不回复]') || reply.length === 0 || reply.length > 100) {
                return;
            }
            
            var newComment = {
                id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                author: ai.name,
                authorAvatar: ai.avatar || '',
                content: reply,
                timestamp: Date.now(),
                replyTo: replyToAuthor,
                isAI: true
            };
            
            // 根据动态所有者类型保存评论
            if (momentOwnerId === 'user') {
                // 用户朋友圈
                PhoneCore.db.getAll('app_data').then(function(dataList) {
                    var item = dataList.find(function(d) {
                        return d.appId && d.appId.indexOf('user_moments_') === 0 && d.data && d.data.id === moment.id;
                    });
                    if (item && item.data) {
                        if (!item.data.comments) item.data.comments = [];
                        item.data.comments.push(newComment);
                        PhoneCore.db.put('app_data', item).then(function() {
                            setTimeout(function() {
                                self.refreshCurrentTab();
                            }, 200);
                        });
                    }
                });
            } else {
                // AI的朋友圈
                var ownerAI = PhoneCore.getAI(momentOwnerId);
                if (ownerAI && ownerAI.moments) {
                    var targetMoment = ownerAI.moments.find(function(m) { return m.id === moment.id; });
                    if (targetMoment) {
                        if (!targetMoment.comments) targetMoment.comments = [];
                        targetMoment.comments.push(newComment);
                        PhoneCore.saveAI(ownerAI);
                        setTimeout(function() {
                            self.refreshCurrentTab();
                        }, 200);
                    }
                }
            }
        }).catch(function(err) {
            console.error('AI评论区互动回复失败:', err);
        });
    };


// ================ chat.js 行 21147 ~ 21313 (发布朋友圈 UI) ================
    ChatApp.prototype.openPostMoment = function() {
        var self = this;
        
        var html = '<div style="padding:16px;background:linear-gradient(180deg,#F8FAFC 0%,#FFF 100%);min-height:100%;">';
        html += '<div style="font-size:18px;font-weight:600;margin-bottom:16px;color:#333;">发布新动态</div>';
        
        // 内容输入区
        html += '<div style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);border:1px solid #F0F0F0;">';
        html += '<textarea id="moment-content" placeholder="分享你此刻的想法..." style="width:100%;padding:0;border:none;font-size:15px;min-height:100px;resize:none;outline:none;box-sizing:border-box;line-height:1.6;color:#333;"></textarea>';
        
        // 图片预览区
        html += '<div id="moment-images-preview" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;"></div>';
        
        // 添加图片按钮组
        html += '<div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #F0F0F0;">';
        html += '<button id="add-moment-image" style="padding:8px 14px;background:#F5F5F5;border:1px solid #E8E8E8;border-radius:8px;font-size:12px;color:#666;cursor:pointer;display:flex;align-items:center;gap:5px;">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>图片</button>';
        html += '<button id="add-ai-image" style="padding:8px 14px;background:#FFF5F7;border:1px solid #FFE4EC;border-radius:8px;font-size:12px;color:#D4728A;cursor:pointer;display:flex;align-items:center;gap:5px;">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="#D4728A" opacity="0.8"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>文字描述</button>';
        html += '</div>';
        html += '</div>';
        
        // 位置选项
        html += '<div style="background:white;border-radius:12px;padding:14px 16px;margin-bottom:12px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.05);border:1px solid #F0F0F0;" id="add-location">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<span style="display:flex;align-items:center;gap:8px;font-size:14px;color:#333;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#A8C8EC"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>添加位置</span>';
        html += '<span id="location-text" style="color:#999;font-size:13px;">不显示</span>';
        html += '</div>';
        html += '</div>';
        
        // 可见范围
        html += '<div style="background:white;border-radius:12px;padding:14px 16px;margin-bottom:20px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.05);border:1px solid #F0F0F0;" id="set-visibility">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<span style="display:flex;align-items:center;gap:8px;font-size:14px;color:#333;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#A8C8EC"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>谁可以看</span>';
        html += '<span id="visibility-text" style="color:#999;font-size:13px;">公开</span>';
        html += '</div>';
        html += '</div>';
        
        // 发布按钮
        html += '<button id="publish-moment-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#A8C8EC,#B8D4F0);color:white;border:none;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;box-shadow:0 2px 8px rgba(168,200,236,0.4);">发布动态</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        var momentImages = [];
        var momentLocation = '';
        var momentVisibility = 'public';
        
        // 添加图片
        var addImageBtn = page.querySelector('#add-moment-image');
        var imagesPreview = page.querySelector('#moment-images-preview');
        
        if (addImageBtn) {
            addImageBtn.onclick = function() {
                if (momentImages.length >= 9) {
                    alert('最多添加9张图片');
                    return;
                }
                
                PhoneCore.resources.createImageInput(function(resource) {
                    momentImages.push(resource.data);
                    self.updateMomentImagesPreview(imagesPreview, momentImages, aiImageDescriptions);
                });
            };
        }
        
        // AI描述图片数组
        var aiImageDescriptions = [];
        
        // AI生成图片按钮
        var addAiImageBtn = page.querySelector('#add-ai-image');
        if (addAiImageBtn) {
            addAiImageBtn.onclick = function() {
                if (momentImages.length + aiImageDescriptions.length >= 9) {
                    alert('最多添加9张图片');
                    return;
                }
                self.openAIImageGenerator(function(aiImage) {
                    aiImageDescriptions.push(aiImage);
                    self.updateMomentImagesPreview(imagesPreview, momentImages, aiImageDescriptions);
                });
            };
        }
        
        // 位置
        var locationBtn = page.querySelector('#add-location');
        if (locationBtn) {
            locationBtn.onclick = function() {
                var location = prompt('输入位置（留空不显示）：', momentLocation);
                if (location !== null) {
                    momentLocation = location;
                    page.querySelector('#location-text').textContent = location || '不显示位置 ›';
                }
            };
        }
        
        // 可见范围
        var visibilityBtn = page.querySelector('#set-visibility');
        if (visibilityBtn) {
            visibilityBtn.onclick = function() {
                var options = ['公开', '仅好友', '仅自己'];
                var current = momentVisibility === 'public' ? 0 : momentVisibility === 'friends' ? 1 : 2;
                var next = (current + 1) % 3;
                momentVisibility = ['public', 'friends', 'private'][next];
                page.querySelector('#visibility-text').textContent = options[next] + ' ›';
            };
        }
        
        // 发布
        var publishBtn = page.querySelector('#publish-moment-btn');
        if (publishBtn) {
            publishBtn.onclick = function() {
                var content = page.querySelector('#moment-content').value.trim();
                
                if (!content && momentImages.length === 0 && aiImageDescriptions.length === 0) {
                    alert('请输入内容或添加图片');
                    return;
                }
                
                // 使用更可靠的唯一ID
                var uniqueId = 'moment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                var moment = {
                    id: uniqueId,
                    content: content,
                    images: momentImages,
                    aiImages: aiImageDescriptions, // AI描述生成的图片
                    location: momentLocation,
                    visibility: momentVisibility,
                    timestamp: Date.now(),
                    likes: [],
                    comments: [],
                    isUserMoment: true
                };
                
                // 保存到数据库 - appId作为主键需要唯一
                PhoneCore.db.put('app_data', {
                    appId: 'user_moments_' + uniqueId,  // 使用唯一的appId作为主键
                    momentId: moment.id,
                    data: moment,
                    createTime: Date.now()
                }).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '发布成功',
                        message: '动态已发布',
                        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#4A6FA5"><circle cx="12" cy="12" r="3.2"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
                        size: 'mini',
                        duration: 2000
                    });
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                    // 发布成功后滚动到顶部显示新动态
                    setTimeout(function() {
                        var contentArea = self.appWindow.querySelector('#main-content-area');
                        if (contentArea) {
                            contentArea.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }, 100);
                }).catch(function(err) {
                    console.error('发布失败:', err);
                    self.showToast('发布失败，请重试');
                });
            };
        }
    };


// ================ chat.js 行 21363 ~ 21491 (AI 描述图生成器) ================
    ChatApp.prototype.openAIImageGenerator = function(callback) {
        var self = this;
        
        // 在手机壳内显示弹窗
        var container = this.appWindow || document.body;
        
        var modalHtml = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;" id="ai-image-modal">';
        modalHtml += '<div style="background:#FFFFFF;border-radius:20px;width:90%;max-width:300px;overflow:hidden;animation:slideUp 0.3s cubic-bezier(0.68,-0.55,0.265,1.55);box-shadow:0 10px 40px rgba(0,0,0,0.2);">';
        
        // 头部 - 去掉渐变
        modalHtml += '<div style="background:#F8F9FA;padding:20px;text-align:center;">';
        modalHtml += '<div style="width:50px;height:50px;margin:0 auto 12px;background:white;border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">';
        modalHtml += '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        modalHtml += '</div>';
        modalHtml += '<div style="font-size:18px;font-weight:600;color:#333;">文字描述图片</div>';
        modalHtml += '<div style="font-size:12px;color:#8E8E8E;margin-top:4px;">用文字描述一张图片，让AI理解画面</div>';
        modalHtml += '</div>';
        
        // 输入区域
        modalHtml += '<div style="padding:20px;">';
        modalHtml += '<textarea id="ai-image-desc" placeholder="例如：阳光洒在窗台上，一只橘猫正在午睡..." style="width:100%;height:80px;padding:14px;border:1px solid #E0E0E0;border-radius:14px;font-size:14px;resize:none;outline:none;box-sizing:border-box;background:#FAFAFA;transition:all 0.3s;"></textarea>';
        
        // 颜色标签选择 - 淡粉、淡绿、淡蓝
        modalHtml += '<div style="margin-top:14px;">';
        modalHtml += '<div style="font-size:12px;color:#666;margin-bottom:8px;">选择卡片颜色</div>';
        modalHtml += '<div style="display:flex;gap:10px;justify-content:center;">';
        var colorTags = [
            { name: '淡粉', color: '#FFE4EC', textColor: '#D4728A' },
            { name: '淡绿', color: '#E4F5E8', textColor: '#5A9E6F' },
            { name: '淡蓝', color: '#E4F0F5', textColor: '#5A8AAE' }
        ];
        colorTags.forEach(function(tag, idx) {
            modalHtml += '<button class="ai-color-btn" data-color="' + tag.color + '" data-text-color="' + tag.textColor + '" data-name="' + tag.name + '" style="width:70px;padding:10px 0;background:' + tag.color + ';border:2px solid transparent;border-radius:12px;font-size:12px;color:' + tag.textColor + ';cursor:pointer;transition:all 0.2s;font-weight:500;">' + tag.name + '</button>';
        });
        modalHtml += '</div>';
        modalHtml += '</div>';
        
        // 按钮
        modalHtml += '<div style="display:flex;gap:10px;margin-top:20px;">';
        modalHtml += '<button id="cancel-ai-image" style="flex:1;padding:14px;background:#F0F0F0;border:none;border-radius:12px;font-size:14px;color:#666;cursor:pointer;">取消</button>';
        modalHtml += '<button id="confirm-ai-image" style="flex:1;padding:14px;background:#333;border:none;border-radius:12px;font-size:14px;color:white;font-weight:500;cursor:pointer;">添加图片</button>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        
        modalHtml += '</div>';
        modalHtml += '</div>';
        
        var modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        container.appendChild(modal.firstChild);
        
        var modalEl = container.querySelector('#ai-image-modal');
        var textarea = modalEl.querySelector('#ai-image-desc');
        var selectedColor = colorTags[0].color; // 默认淡粉
        var selectedTextColor = colorTags[0].textColor;
        var selectedColorName = colorTags[0].name;
        
        // 默认选中第一个颜色
        var firstColorBtn = modalEl.querySelector('.ai-color-btn');
        if (firstColorBtn) {
            firstColorBtn.style.borderColor = selectedTextColor;
        }
        
        // 输入框聚焦效果
        textarea.onfocus = function() {
            textarea.style.borderColor = '#A8C8EC';
            textarea.style.background = '#FFFFFF';
        };
        textarea.onblur = function() {
            textarea.style.borderColor = '#E0E0E0';
            textarea.style.background = '#FAFAFA';
        };
        
        // 颜色标签点击
        modalEl.querySelectorAll('.ai-color-btn').forEach(function(btn) {
            btn.onclick = function() {
                modalEl.querySelectorAll('.ai-color-btn').forEach(function(b) {
                    b.style.borderColor = 'transparent';
                });
                selectedColor = btn.getAttribute('data-color');
                selectedTextColor = btn.getAttribute('data-text-color');
                selectedColorName = btn.getAttribute('data-name');
                btn.style.borderColor = selectedTextColor;
            };
        });
        
        // 取消按钮
        modalEl.querySelector('#cancel-ai-image').onclick = function() {
            modalEl.style.animation = 'fadeOut 0.2s ease';
            setTimeout(function() { modalEl.remove(); }, 200);
        };
        
        // 确认添加
        modalEl.querySelector('#confirm-ai-image').onclick = function() {
            var desc = textarea.value.trim();
            if (!desc) {
                self.showToast('请输入图片描述');
                textarea.focus();
                return;
            }
            
            // 创建文字描述图片对象
            var aiImage = {
                id: 'ai_img_' + Date.now(),
                description: desc,
                cardColor: selectedColor,
                textColor: selectedTextColor,
                colorName: selectedColorName,
                createdAt: Date.now()
            };
            
            modalEl.style.animation = 'fadeOut 0.2s ease';
            setTimeout(function() { 
                modalEl.remove();
                if (callback) callback(aiImage);
                self.showToast('图片描述已添加');
            }, 200);
        };
        
        // 点击背景关闭
        modalEl.onclick = function(e) {
            if (e.target === modalEl) {
                modalEl.style.animation = 'fadeOut 0.2s ease';
                setTimeout(function() { modalEl.remove(); }, 200);
            }
        };
    };

    // AI朋友圈

// ================ chat.js 行 23113 ~ 23301 (微博转发卡片 + 接收 + AI 回应) ================
    ChatApp.prototype.renderWeiboCard = function(postData, msgId) {
        var html = '';
        
        // 微博风格配色
        var weiboOrange = '#FF8200';
        var weiboRed = '#E6162D';
        var borderColor = '#e0e6ed';
        var textGray = '#939393';
        
        html += '<div class="weibo-share-card" data-post-id="' + (postData.id || '') + '" data-msg-id="' + msgId + '" style="';
        html += 'background:#FFFFFF;border-radius:12px;overflow:hidden;width:200px;';
        html += 'border:1px solid ' + borderColor + ';cursor:pointer;';
        html += 'box-shadow:0 2px 8px rgba(0,0,0,0.06);">';
        
        // 顶部 - 作者信息
        html += '<div style="padding:10px 12px;display:flex;align-items:center;gap:8px;">';
        // 作者头像
        html += '<div style="width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#f0f0f0;">';
        if (postData.authorAvatar) {
            html += '<img src="' + postData.authorAvatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;background:linear-gradient(135deg,' + weiboOrange + ',' + weiboRed + ');color:white;font-weight:600;">' + (postData.authorName ? postData.authorName.charAt(0) : '微') + '</div>';
        }
        html += '</div>';
        // 昵称 + 认证标识
        html += '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;">';
        html += '<span style="font-weight:500;color:#333;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (postData.authorName || '微博用户') + '</span>';
        // 认证标识
        if (postData.verified) {
            var verifyColor = postData.verifiedType === 'official' ? '#FF8200' : '#FFB400';
            var verifyIcon = postData.verifiedType === 'official' 
                ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="' + verifyColor + '"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/><circle cx="12" cy="12" r="10" fill="none" stroke="' + verifyColor + '" stroke-width="2"/></svg>'
                : '<svg width="12" height="12" viewBox="0 0 24 24" fill="' + verifyColor + '"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>';
            html += '<span title="' + (postData.verifiedReason || '认证用户') + '">' + verifyIcon + '</span>';
        }
        html += '</div>';
        html += '</div>';
        
        // 中部 - 帖子内容摘要（限制50字）
        html += '<div style="padding:0 12px 10px;">';
        if (postData.content) {
            var contentText = postData.content.length > 50 ? postData.content.substring(0, 50) + '...' : postData.content;
            html += '<div style="font-size:12px;color:#333;line-height:1.5;word-break:break-all;">' + contentText + '</div>';
        }
        html += '</div>';
        
        // 图片缩略图（最多显示1张）
        if (postData.images && postData.images.length > 0) {
            html += '<div style="padding:0 12px 10px;">';
            html += '<div style="position:relative;width:100%;height:80px;border-radius:8px;overflow:hidden;background:#f5f5f5;">';
            html += '<img src="' + postData.images[0] + '" style="width:100%;height:100%;object-fit:cover;">';
            if (postData.images.length > 1) {
                html += '<div style="position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,0.6);color:white;font-size:10px;padding:2px 6px;border-radius:4px;">+' + (postData.images.length - 1) + '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
        
        // 底部 - 互动数据
        html += '<div style="padding:8px 12px;background:#FAFAFA;border-top:1px solid ' + borderColor + ';display:flex;align-items:center;justify-content:space-between;">';
        // 互动数据
        html += '<div style="display:flex;align-items:center;gap:12px;font-size:10px;color:' + textGray + ';">';
        // 点赞数
        html += '<span style="display:flex;align-items:center;gap:2px;">';
        html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="' + textGray + '"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
        html += (postData.likeCount || 0);
        html += '</span>';
        // 评论数
        html += '<span style="display:flex;align-items:center;gap:2px;">';
        html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="' + textGray + '"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>';
        html += (postData.commentCount || 0);
        html += '</span>';
        // 转发数
        html += '<span style="display:flex;align-items:center;gap:2px;">';
        html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="' + textGray + '"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>';
        html += (postData.repostCount || 0);
        html += '</span>';
        html += '</div>';
        // 微博标识
        html += '<div style="display:flex;align-items:center;gap:4px;">';
        html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="' + weiboRed + '"><circle cx="12" cy="12" r="10"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">微</text></svg>';
        html += '<span style="font-size:10px;color:' + weiboOrange + ';">查看详情</span>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        return html;
    };
    
    // ============ 接收微博分享 ============
    
    /**
     * 接收外部转发的微博消息
     * @param {string} aiId - 接收消息的AI ID
     * @param {object} weiboCardData - 微博卡片数据
     * @param {boolean} triggerAIResponse - 是否触发AI回应，默认true
     */
    ChatApp.prototype.receiveWeiboShare = function(aiId, weiboCardData, triggerAIResponse) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) {
            console.error('[ChatApp] receiveWeiboShare: AI not found:', aiId);
            return;
        }
        
        if (!ai.chatHistory) ai.chatHistory = [];
        
        // 创建微博分享消息
        var weiboMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            role: 'user',
            type: 'weibo_share',
            content: '[分享了一条微博]',
            weiboCard: weiboCardData,
            timestamp: Date.now()
        };
        
        ai.chatHistory.push(weiboMessage);
        PhoneCore.saveAI(ai);
        
        console.log('[ChatApp] 收到微博分享:', ai.name, weiboCardData.authorName);
        
        // 刷新当前聊天界面（如果正在查看该聊天）
        if (this.currentChatId === aiId && this.appWindow) {
            var messagesContainer = this.appWindow.querySelector('#messages-container');
            if (messagesContainer) {
                messagesContainer.innerHTML = this.renderMessages(aiId);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                this.bindMessageActions(this.appWindow, aiId);
            }
        }
        
        // 刷新聊天列表
        this.refreshChatList();
        
        // 触发AI回应（默认触发）
        if (triggerAIResponse !== false) {
            // 延迟一段时间后触发AI回应，模拟自然对话
            var delay = 1000 + Math.random() * 2000; // 1-3秒随机延迟
            setTimeout(function() {
                self.triggerAIWeiboResponse(aiId, weiboCardData);
            }, delay);
        }
    };
    
    /**
     * 触发AI对微博分享的回应
     * @param {string} aiId - AI ID
     * @param {object} weiboCardData - 微博卡片数据
     */
    ChatApp.prototype.triggerAIWeiboResponse = function(aiId, weiboCardData) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 构建包含微博内容的上下文提示
        var weiboContext = '用户分享了一条微博给你，请对这条微博内容进行评论或回应：\n\n';
        weiboContext += '【微博内容】\n';
        weiboContext += '作者：@' + weiboCardData.authorName + '\n';
        weiboContext += '内容：' + weiboCardData.content + '\n';
        if (weiboCardData.images && weiboCardData.images.length > 0) {
            weiboContext += '（附带' + weiboCardData.images.length + '张图片）\n';
        }
        weiboContext += '\n请用你的角色性格，对这条微博发表看法、评论或与用户讨论。回复要自然，就像朋友之间分享有趣内容后的交流。';
        
        // 创建一个临时的上下文消息用于AI理解
        var contextMessage = {
            role: 'user',
            content: weiboContext,
            isContextOnly: true, // 标记为仅上下文，不显示在聊天中
            timestamp: Date.now()
        };
        
        // 获取当前页面
        var page = this.appWindow;
        
        // 调用AI回复逻辑
        if (this.getAIResponse) {
            // 使用自定义的上下文调用AI
            this.getAIResponseWithContext(aiId, page, contextMessage);
        }
    };
    
    /**
     * 使用自定义上下文获取AI回复
     * @param {string} aiId - AI ID
     * @param {object} page - 页面元素
     * @param {object} contextMessage - 上下文消息
     */

```

