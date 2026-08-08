# 08 — parseAIResponse 中识别通话 / 红包 / 转账 / 一起听等特殊指令

> **chat.js 原始范围**:`7925–8414`(parseAIResponse 主解析) + `8436–8557`(addAIMessage 内分发各类型)
> 总长度 **约 610 行**
>
> ## 包含内容
>
> | 主题 | 函数 | 行号 |
> |---|---|---|
> | AI 响应解析 | `parseAIResponse` | 7925 |
> | 添加 AI 消息(按 type 分发) | `addAIMessage` / `addAIStickerMessage` | 8436, 8522 |
> | 表情包查找 | `findSticker` | 8415 |
>
> ## 特殊指令格式(被识别后插入消息列表)
>
> | 指令 | 触发函数 | 详见 |
> |---|---|---|
> | `[打电话]` / `[打视频]` | `addAIMessage → showIncomingCall` | `01-call-phone-video.md` |
> | `[发红包:金额:祝福语]` | `addAIMessage → openRedpacket` | `02-redpacket-card-click.md` |
> | `[转账:金额:备注]` | `addAIMessage → acceptTransfer` | `03-transfer-card-click.md` |
> | `[分享音乐:歌名:歌手]` | `addAIMessage → handleListenTogetherInvite / handlePlaylistShareClick` | `05-music-card-jump.md` |
> | `[发位置:地点名:详细地址]` | `addAIMessage → sendLocationMessage` | — |
> | `[发图片:背景色:文字色:描述]` | `addAIMessage → sendImageMessage` | — |
> | `[发语音:秒数:文字]` | `addAIMessage → sendVoiceMessage` | — |
> | `[引用:消息id:回复]` | `addAIMessage → renderMessages` 标注引用 | — |
> | 贴纸名(`[sticker:xxx]`)| `addAIMessage → addAIStickerMessage` | — |
>
> ## 关联
>
> - 上游:`generateAIResponse`(6342)+ `processAndSendAIReplies`(6743)+ `enhanceAIResponse`(6793,提示词增强)
> - 下游:`01-call-phone-video` / `02-redpacket-card-click` / `03-transfer-card-click` / `05-music-card-jump` 各拆解文件
>
> ## 上下文依赖
>
> - `PhoneCore.getAI(id)` —— 取 AI 人设数据
> - `PhoneCore.user` —— 当前用户
> - `self.addAIMessage(...)` —— 自身消息入库(也走 data-app-action 派发)
>
> ---
>
> 下面是 chat.js 7925–8414 + 8436–8557 的原始代码,未做精简。

```js
// ================ chat.js 行 7925 ~ 8414 ================
// ================ chat.js 行 7925 ~ 8414 ================
    ChatApp.prototype.parseAIResponse = function(content, ai) {
        var replies = [];
        var self = this;
        var manager = PhoneCore.stickerManager;
        
        // 【表情包切分】在表情包指令位置插入分隔符，确保表情包单独成条
        // 匹配所有表情包格式：[表情包:xxx]、[表情:xxx]
        var stickerPattern = /\[表情包[:：](.+?)\]|\[表情[:：](.+?)\]/g;
        var hasStickerInMiddle = stickerPattern.test(content);
        if (hasStickerInMiddle) {
            // 重置正则lastIndex
            stickerPattern.lastIndex = 0;
            // 在表情包指令前后插入分隔符，确保表情包单独一条
            content = content.replace(stickerPattern, function(match) {
                return '|' + match + '|';
            });
            // 清理多余的分隔符（比如连续的||）
            content = content.replace(/\|+/g, '|').replace(/^\||\|$/g, '');
        }
        
        // 检查是否包含表情包指令（按情绪发送，使用新的三层结构）
        var stickerPackMatch = content.match(/\[表情包[:：](.+?)\]/);
        if (stickerPackMatch) {
            var stickerFound = false;
            if (ai.stickerLibraryIds && ai.stickerLibraryIds.length > 0 && manager) {
                var emotionName = stickerPackMatch[1];
                var sticker = manager.getRandomStickerByEmotion(ai.stickerLibraryIds, emotionName);
                if (sticker && sticker.resourceId) {
                    stickerFound = true;
                    // 异步获取资源URL
                    PhoneCore.resources.get(sticker.resourceId).then(function(resource) {
                        if (resource) {
                            // 创建一个新的消息来显示表情
                            self.addAIStickerMessage(ai.id, resource.data, { name: sticker.name, packName: emotionName });
                        }
                    });
                }
            }
            // 【修复】无论是否找到表情包，都要移除指令文本，避免显示原始指令
            content = content.replace(stickerPackMatch[0], '').trim();
        }
        
        // 检查是否包含表情指令（按表情名发送）
        var stickerNameMatch = content.match(/\[表情[:：](.+?)\]/);
        if (stickerNameMatch) {
            var stickerFound = false;
            if (ai.stickerLibraryIds && ai.stickerLibraryIds.length > 0 && manager) {
                var stickerName = stickerNameMatch[1];
                var sticker = manager.getStickerByName(ai.stickerLibraryIds, stickerName);
                if (sticker && sticker.resourceId) {
                    stickerFound = true;
                    // 异步获取资源URL
                    PhoneCore.resources.get(sticker.resourceId).then(function(resource) {
                        if (resource) {
                            self.addAIStickerMessage(ai.id, resource.data, { name: sticker.name, packName: '' });
                        }
                    });
                }
            }
            // 【修复】无论是否找到表情包，都要移除指令文本，避免显示原始指令
            content = content.replace(stickerNameMatch[0], '').trim();
        }
        
        // 兼容旧格式：检查是否包含旧的表情包指令
        var oldStickerMatch = content.match(/\[表情:(.+?)\]/);
        if (oldStickerMatch && !stickerPackMatch && !stickerNameMatch) {
            var oldStickerFound = false;
            // 先尝试按情绪查找，再按表情名查找
            if (ai.stickerLibraryIds && ai.stickerLibraryIds.length > 0 && manager) {
                var name = oldStickerMatch[1];
                var sticker = manager.getRandomStickerByEmotion(ai.stickerLibraryIds, name);
                if (!sticker) {
                    sticker = manager.getStickerByName(ai.stickerLibraryIds, name);
                }
                if (sticker && sticker.resourceId) {
                    oldStickerFound = true;
                    PhoneCore.resources.get(sticker.resourceId).then(function(resource) {
                        if (resource) {
                            self.addAIStickerMessage(ai.id, resource.data, { name: sticker.name, packName: name });
                        }
                    });
                }
            }
            // 兼容旧的stickerPacks格式
            else if (ai.stickerPacks && ai.stickerPacks.length > 0) {
                var stickerName = oldStickerMatch[1];
                var sticker = this.findSticker(ai.stickerPacks, stickerName);
                if (sticker) {
                    oldStickerFound = true;
                    replies.push({
                        type: 'sticker',
                        content: '',
                        extra: { stickerUrl: sticker.data }
                    });
                }
            }
            // 【修复】无论是否找到表情包，都要移除指令文本，避免显示原始指令
            content = content.replace(oldStickerMatch[0], '').trim();
        }
        
        // 检查是否包含换头像指令（支持多种格式）
        var avatarMatch = content.match(/\[换头像[:：](.+?)\]|\[切换头像[:：](.+?)\]/);
        if (avatarMatch && ai.avatarLibrary && ai.avatarLibrary.length > 0) {
            var avatarName = (avatarMatch[1] || avatarMatch[2] || '').trim();
            
            // 支持随机换头像
            if (avatarName === '随机' || !avatarName || !ai.avatarLibraryEnabled) {
                // 随机选择一个头像
                var randomIndex = Math.floor(Math.random() * ai.avatarLibrary.length);
                var randomAvatar = ai.avatarLibrary[randomIndex];
                if (randomAvatar) {
                    ai.avatar = randomAvatar.url;
                    ai.updatedAt = Date.now();
                    PhoneCore.saveAI(ai);
                }
            } else {
                // 根据名称换头像
                var changed = ai.changeAvatar(avatarName);
                if (changed) {
                    PhoneCore.saveAI(ai);
                }
            }
            content = content.replace(avatarMatch[0], '').trim();
        }
        
        // 检查是否包含联系人卡片
        var contactMatch = content.match(/$$推荐好友:(.+?)$$/);
        if (contactMatch) {
            var contactName = contactMatch[1];
            replies.push({
                type: 'contact_card',
                content: '',
                extra: {
                    contactCard: {
                        id: 'pending_' + Date.now(),
                        name: contactName,
                        avatar: '',
                        isPending: true
                    }
                }
            });
            content = content.replace(contactMatch[0], '').trim();
        }
        
        // 【重要】检查当前是否在通话中 - 如果在通话中，禁止再次触发通话请求（防止即时回复模式的bug）
        var isCurrentlyInCall = this.island && this.island.state && this.island.state.inCall;
        
        // 检查是否包含语音通话请求
        var callMatch = content.match(/\[发起语音通话\]|\[打电话\]|\[语音通话\]/);
        if (callMatch) {
            // 【防重复通话】只有在非通话状态下才触发来电
            if (!isCurrentlyInCall) {
                replies.push({
                    type: 'incoming_call',
                    content: '',
                    extra: {
                        callType: 'voice',
                        aiId: ai.id
                    }
                });
            } else {
                console.log('[parseAIResponse] 当前正在通话中，忽略语音通话请求');
            }
            content = content.replace(callMatch[0], '').trim();
        }
        
        // 检查是否包含视频通话请求
        var videoMatch = content.match(/\[发起视频通话\]|\[打视频\]|\[视频通话\]/);
        if (videoMatch) {
            // 【防重复通话】只有在非通话状态下才触发来电
            if (!isCurrentlyInCall) {
                replies.push({
                    type: 'incoming_call',
                    content: '',
                    extra: {
                        callType: 'video',
                        aiId: ai.id
                    }
                });
            } else {
                console.log('[parseAIResponse] 当前正在通话中，忽略视频通话请求');
            }
            content = content.replace(videoMatch[0], '').trim();
        }
        
        // 检查是否包含红包
        var redpacketMatch = content.match(/\[发红包:(\d+(?:\.\d{1,2})?):(.+?)\]/);
        if (redpacketMatch) {
            var redpacketAmount = parseFloat(redpacketMatch[1]);
            var aiAssets = ai.assets || 0;
            // 验证AI资产是否足够发红包（发送时验证，领取时扣款）
            if (redpacketAmount > 0 && redpacketAmount <= aiAssets) {
                replies.push({
                    type: 'redpacket',
                    content: '',
                    extra: {
                        amount: redpacketAmount,
                        message: redpacketMatch[2]
                    }
                });
            } else {
                // 资产不足，将红包指令替换为文字说明
                content = content.replace(redpacketMatch[0], '（想发红包但余额不足）').trim();
            }
            content = content.replace(redpacketMatch[0], '').trim();
        }
        
        // 检查是否AI要领取红包
        var openRedpacketMatch = content.match(/\[领取红包\]/);
        if (openRedpacketMatch) {
            // 调用领取红包逻辑
            this.aiOpenRedpacket(ai.id);
            content = content.replace(openRedpacketMatch[0], '').trim();
        }
        
        // 检查是否包含转账
        var transferMatch = content.match(/\[转账:(\d+(?:\.\d{1,2})?)\]/);
        if (transferMatch) {
            var transferAmount = parseFloat(transferMatch[1]);
            var aiAssetsForTransfer = ai.assets || 0;
            // 验证AI资产是否足够转账（发送时验证，收款时扣款）
            if (transferAmount > 0 && transferAmount <= aiAssetsForTransfer) {
                replies.push({
                    type: 'transfer',
                    content: '',
                    extra: {
                        amount: transferAmount
                    }
                });
            } else {
                // 资产不足，将转账指令替换为文字说明
                content = content.replace(transferMatch[0], '（想转账但余额不足）').trim();
            }
            content = content.replace(transferMatch[0], '').trim();
        }
        
        // 检查是否AI要接收转账
        var acceptTransferMatch = content.match(/\[接收转账\]/);
        if (acceptTransferMatch) {
            // 调用接收转账逻辑
            this.aiAcceptTransfer(ai.id);
            content = content.replace(acceptTransferMatch[0], '').trim();
        }
        
        // 检查是否AI要代付购物
        var shopPaymentMatch = content.match(/\[代付:(\d+(?:\.\d{1,2})?)\]/);
        if (shopPaymentMatch) {
            var paymentAmount = parseFloat(shopPaymentMatch[1]);
            var aiAssetsForPayment = ai.assets || 0;
            // 验证AI资产是否足够代付
            if (paymentAmount > 0 && paymentAmount <= aiAssetsForPayment) {
                replies.push({
                    type: 'shop_payment',
                    content: '',
                    extra: {
                        amount: paymentAmount
                    }
                });
            } else {
                // 资产不足，将代付指令替换为文字说明
                content = content.replace(shopPaymentMatch[0], '（想帮你代付但余额不足）').trim();
            }
            content = content.replace(shopPaymentMatch[0], '').trim();
        }
        
        // 检查是否AI拒绝代付
        var rejectPaymentMatch = content.match(/\[拒绝代付\]/);
        if (rejectPaymentMatch) {
            replies.push({
                type: 'reject_payment',
                content: '',
                extra: {}
            });
            content = content.replace(rejectPaymentMatch[0], '').trim();
        }
        
        // 检查是否AI请求用户代付
        var requestUserPayMatch = content.match(/\[请求代付:(\d+(?:\.\d{1,2})?):(.+?)\]/);
        if (requestUserPayMatch) {
            var requestAmount = parseFloat(requestUserPayMatch[1]);
            var productName = requestUserPayMatch[2];
            if (requestAmount > 0 && productName) {
                replies.push({
                    type: 'request_user_payment',
                    content: '',
                    extra: {
                        amount: requestAmount,
                        productName: productName
                    }
                });
            }
            content = content.replace(requestUserPayMatch[0], '').trim();
        }
        
        // 检查是否包含一起听邀请
        var listenTogetherMatch = content.match(/\[一起听:(.+?)\]/);
        if (listenTogetherMatch) {
            var searchTitle = listenTogetherMatch[1];
            var songInfo = { title: searchTitle, artist: '', color: '#fb7299', id: null };
            
            // 尝试从MusicPlayerState.songs中查找匹配的歌曲
            if (typeof MusicPlayerState !== 'undefined' && MusicPlayerState.songs) {
                var matchedSong = MusicPlayerState.songs.find(function(s) {
                    return s.title.includes(searchTitle) || searchTitle.includes(s.title);
                });
                if (matchedSong) {
                    songInfo = {
                        id: matchedSong.id,
                        title: matchedSong.title,
                        artist: matchedSong.artist,
                        color: matchedSong.color || '#fb7299',
                        cover: matchedSong.cover
                    };
                } else {
                    // 没找到匹配的歌曲，随机选一首
                    var randomSong = MusicPlayerState.songs[Math.floor(Math.random() * MusicPlayerState.songs.length)];
                    if (randomSong) {
                        songInfo = {
                            id: randomSong.id,
                            title: randomSong.title,
                            artist: randomSong.artist,
                            color: randomSong.color || '#fb7299',
                            cover: randomSong.cover
                        };
                    }
                }
            }
            
            replies.push({
                type: 'listen_together_invite',
                content: '',
                extra: {
                    inviteCard: {
                        id: 'invite_' + Date.now(),
                        songId: songInfo.id,
                        songTitle: songInfo.title,
                        songArtist: songInfo.artist,
                        songColor: songInfo.color,
                        songCover: songInfo.cover,
                        sender: 'ai'
                    }
                }
            });
            content = content.replace(listenTogetherMatch[0], '').trim();
        }
        
        // 检查是否包含拍一拍回应
        var pokeBackMatch = content.match(/\[拍一拍用户\]|\[拍一拍\]/);
        if (pokeBackMatch) {
            replies.push({
                type: 'poke_back',
                content: '',
                extra: {
                    targetName: 'user'
                }
            });
            content = content.replace(pokeBackMatch[0], '').trim();
        }
        
        // 检查是否包含位置分享
        var locationMatch = content.match(/\[分享位置:(.+?):(.+?)\]/);
        if (locationMatch) {
            replies.push({
                type: 'location',
                content: '',
                extra: {
                    locationCard: {
                        name: locationMatch[1],
                        address: locationMatch[2]
                    }
                }
            });
            content = content.replace(locationMatch[0], '').trim();
        }
        
        // 检查是否包含歌曲分享
        var songShareMatch = content.match(/\[分享歌曲:(.+?):(.+?)\]/);
        if (songShareMatch) {
            replies.push({
                type: 'song_share',
                content: '',
                extra: {
                    songCard: {
                        id: 'song_' + Date.now(),
                        title: songShareMatch[1],
                        artist: songShareMatch[2],
                        color: '#fb7299'
                    }
                }
            });
            content = content.replace(songShareMatch[0], '').trim();
        }
        
        // 检查是否包含发朋友圈
        var momentMatch = content.match(/\[发朋友圈:(.+?)\]/);
        if (momentMatch) {
            var momentContent = momentMatch[1];
            // 创建朋友圈动态
            var newMoment = {
                id: 'moment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                content: momentContent,
                images: [],
                timestamp: Date.now(),
                likes: [],
                comments: []
            };
            
            // 添加到AI的朋友圈列表
            if (!ai.moments) ai.moments = [];
            ai.moments.unshift(newMoment); // 添加到开头
            PhoneCore.saveAI(ai);
            
            content = content.replace(momentMatch[0], '').trim();
        }
        
        // 检查是否包含评论朋友圈
        var commentMomentMatch = content.match(/\[评论朋友圈:(.+?):(.+?)\]/);
        if (commentMomentMatch) {
            var targetAuthor = commentMomentMatch[1].trim();
            var commentContent = commentMomentMatch[2].trim();
            this.aiCommentOnMoment(ai, targetAuthor, commentContent, null);
            content = content.replace(commentMomentMatch[0], '').trim();
        }
        
        // 检查是否包含回复朋友圈评论
        var replyCommentMatch = content.match(/\[回复朋友圈评论:(.+?):(.+?):(.+?)\]/);
        if (replyCommentMatch) {
            var momentAuthor = replyCommentMatch[1].trim();
            var replyToAuthor = replyCommentMatch[2].trim();
            var replyContent = replyCommentMatch[3].trim();
            this.aiCommentOnMoment(ai, momentAuthor, replyContent, replyToAuthor);
            content = content.replace(replyCommentMatch[0], '').trim();
        }
        
        // 检查是否包含转发聊天记录
        var chatRecordMatch = content.match(/\[转发聊天记录:(.+?)\]/s);
        if (chatRecordMatch) {
            var recordContent = chatRecordMatch[1];
            // 解析聊天记录内容，格式：发送者:内容|发送者:内容
            var recordMessages = [];
            var msgParts = recordContent.split('|');
            msgParts.forEach(function(part) {
                var colonIdx = part.indexOf(':');
                if (colonIdx > 0) {
                    var sender = part.substring(0, colonIdx).trim();
                    var msgContent = part.substring(colonIdx + 1).trim();
                    if (sender && msgContent) {
                        recordMessages.push({
                            role: sender === ai.name ? 'assistant' : 'user',
                            senderName: sender,
                            content: msgContent,
                            timestamp: Date.now()
                        });
                    }
                }
            });
            
            if (recordMessages.length > 0) {
                var userName = PhoneCore.user.getCurrentMask ? (PhoneCore.user.getCurrentMask() ? PhoneCore.user.getCurrentMask().name : '对方') : '对方';
                replies.push({
                    type: 'chat_record',
                    content: '',
                    extra: {
                        chatRecord: {
                            title: ai.name + '和' + userName + '的聊天记录',
                            messages: recordMessages,
                            participants: [ai.name, userName]
                        }
                    }
                });
            }
            content = content.replace(chatRecordMatch[0], '').trim();
        }
        
        // 剩余文本作为普通消息 - 使用智能分句
        if (content) {
            // 使用智能分句函数，根据 | 或换行分割成多条消息
            var sentences = this.splitIntoSentences(content);
            
            sentences.forEach(function(sentence) {
                replies.push({
                    type: 'text',
                    content: sentence
                });
            });
        }
        
        return replies.length > 0 ? replies : [{ type: 'text', content: content }];
    };


// ================ chat.js 行 8436 ~ 8557 (addAIMessage + addAIStickerMessage) ================
    ChatApp.prototype.addAIMessage = function(aiId, page, content, type, extra) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        type = type || 'text';
        extra = extra || {};
        
        var aiMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            role: 'assistant',
            content: content,
            type: type,
            timestamp: Date.now()
        };
        
        if (type === 'sticker') {
            aiMessage.stickerUrl = extra.stickerUrl;
        } else if (type === 'contact_card') {
            aiMessage.contactCard = extra.contactCard;
        } else if (type === 'share_card') {
            aiMessage.shareCard = extra.shareCard;
        } else if (type === 'incoming_call') {
            // AI发起通话 - 显示来电通知
            this.showIncomingCall(aiId, extra.callType);
            return; // 不添加到消息历史
        } else if (type === 'redpacket') {
            aiMessage.content = '[红包]';
            aiMessage.redpacketCard = {
                amount: extra.amount,
                message: extra.message,
                fromAI: true,
                opened: false
            };
        } else if (type === 'transfer') {
            aiMessage.content = '[转账]';
            aiMessage.transferCard = {
                amount: extra.amount,
                fromAI: true,
                accepted: false
            };
        } else if (type === 'shop_payment') {
            // AI代付
            aiMessage.content = '[代付]';
            aiMessage.shopPaymentCard = {
                id: 'payment_' + Date.now(),
                amount: extra.amount,
                fromAI: true,
                accepted: false,
                rejected: false
            };
        } else if (type === 'reject_payment') {
            // AI拒绝代付
            aiMessage.type = 'reject_payment';
            aiMessage.content = '[拒绝代付]';
            aiMessage.rejectPaymentCard = {
                id: 'reject_' + Date.now(),
                timestamp: Date.now()
            };
        } else if (type === 'request_user_payment' && extra) {
            // AI请求用户代付
            aiMessage.content = '[请求代付]';
            aiMessage.requestPaymentCard = {
                id: 'request_pay_' + Date.now(),
                amount: extra.amount,
                productName: extra.productName,
                fromAI: true,
                paid: false,
                rejected: false
            };
        }
        
        ai.chatHistory.push(aiMessage);
        PhoneCore.saveAI(ai);
        
        // 刷新消息显示
        if (page) {
            var messagesContainer = page.querySelector('#messages-container');
            if (messagesContainer) {
                messagesContainer.innerHTML = this.renderMessages(aiId);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                this.bindMessageActions(page, aiId);
            }
        }
    };
    
    // 【AI发送表情消息】用于异步发送表情（从新的三层结构获取）
    ChatApp.prototype.addAIStickerMessage = function(aiId, stickerUrl, stickerInfo) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        stickerInfo = stickerInfo || {};
        
        var aiMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            role: 'assistant',
            type: 'sticker',
            content: '',
            stickerUrl: stickerUrl,
            stickerName: stickerInfo.name || '',      // 表情名称
            stickerPackName: stickerInfo.packName || '', // 表情包名称（情绪名）
            timestamp: Date.now()
        };
        
        if (!ai.chatHistory) {
            ai.chatHistory = [];
        }
        ai.chatHistory.push(aiMessage);
        PhoneCore.saveAI(ai);
        
        // 尝试刷新当前聊天页面（如果打开着）
        var chatPage = this.appWindow ? this.appWindow.querySelector('.app-page') : null;
        if (chatPage) {
            var messagesContainer = chatPage.querySelector('#messages-container');
            if (messagesContainer) {
                messagesContainer.innerHTML = this.renderMessages(aiId);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                this.bindMessageActions(chatPage, aiId);
            }
        }
    };
    
    // 显示AI来电界面

```

