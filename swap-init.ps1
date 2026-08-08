param(
    [string]$Path = 'c:\Users\Administrator\Desktop\小听启动\js\apps\chat-app\index.js',
    [int]$TopEnd = 2211,        # 0-based inclusive, 即第2212行(top 最后一行)
    [int]$BotStart = 2753        # 0-based inclusive, 即第2754行(bot 第一行)
)

$lines = Get-Content $Path
$top = $lines[0..$TopEnd]
$bot = $lines[$BotStart..($lines.Count-1)]

# 新 init 块 — 直接作为 method 注入到 methods 对象里
$newMethod = @'

            /** 为私聊详情页绑定输入区与工具栏交互(每次进 detail 都会调用一次,这里要做幂等)
             *   ★ v0.43 改造:
             *   - 所有按钮交互(via data-app-action)→ framework 顶层 click 委托 → methods
             *   - 本方法只保留:
             *     1. 工具栏「+/-」按钮展开/收起 (CSS class toggle,framework 没有 API)
             *     2. 模拟图片卡片点击 / 位置卡片点击 / 语音转文字 toggle (framework 没
             *        有「打开某个组件的内部」接口,必须在这里派 modal)
             *     3. 引用预览「×」按钮 (framework 没暴露)
             *     4. 双击 AI 头像 → 拍一拍
             *     5. #sendBtn / #messageInput 发送文本消息(含 replyTo 引用回复)
             *   - 单条消息的复制/编辑/引用/收藏/删除/转发 → message-actions.js 的 data-app-action
             *   - 多选模式选中/取消 → message-actions.js 的 data-app-action
             *   - 多选条 收藏/转发/删除 → chat-page.js 的 data-app-action
             */
            async initPrivateChatInteractions() {
                const chatPrivate = document.querySelector('.app-shell[data-app-id="chat"] .chat-private')
                    || document.querySelector('.chat-private')
                    || document.querySelector('.app-detail-body .chat-private')
                    || document.querySelector('.app-detail-surface .chat-private');

                if (!chatPrivate) {
                    console.warn('[chat-app] initPrivateChatInteractions: .chat-private not found');
                    return;
                }
                if (chatPrivate.__chatInteractionsBound) return;
                chatPrivate.__chatInteractionsBound = true;

                // 抓取 this 引用(click listener 里 this 会丢)
                const _self = this;
                const app = this.app;

                /**
                 * 把消息对象追加到消息列表末尾 + 滚动到底部
                 *  复用 renderTextBubble 与 renderMessageList 保持视觉一致
                 */
                const appendMessageBubble = (msg, contact) => {
                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                    if (!messagesContainer) return;
                    const aiPersonId = chatPrivate.dataset.conversationId || '';
                    const mode = chatPrivate.dataset.mode || 'calendar';
                    const html = renderTextBubble(msg, contact || {}, { aiPersonId, mode });
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html.trim();
                    const node = tmp.firstElementChild;
                    if (node) {
                        messagesContainer.appendChild(node);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                };

                /**
                 * 解析 chatPrivate.dataset.contactId 为 aiPersonId + mode
                 */
                const parseContactId = (raw) => {
                    let id = String(raw || '');
                    if (id.startsWith('private-')) id = id.slice('private-'.length);
                    const lastDash = id.lastIndexOf('-');
                    if (lastDash > 0) {
                        const tail = id.slice(lastDash + 1);
                        if (tail === 'calendar' || tail === 'story') {
                            return { aiPersonId: id.slice(0, lastDash), mode: tail };
                        }
                    }
                    return { aiPersonId: id, mode: chatPrivate.dataset.mode || 'calendar' };
                };

                const doSend = async () => {
                    const messageInput = chatPrivate.querySelector('#messageInput');
                    if (!messageInput) return;
                    const text = (messageInput.innerText || messageInput.textContent || '').trim();
                    if (!text) return;

                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                    const sdk = window.settingsSdk;
                    if (!sdk?.chatMessages?.add) {
                        _self.toolkit?.island?.notify?.('error', '发送失败', 'SDK 未就绪');
                        return;
                    }

                    let senderName = '我';
                    try {
                        const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                        senderName = defaultUser?.socialProfiles?.chat?.nickname || defaultUser?.name || '我';
                    } catch (_) {}

                    // ★ v0.43 引用回复:读 state.action.replyingTo,有就把 replyTo 字段写入
                    const st = _self._ensureChatActionState(app);
                    const replyTo = st.replyingTo ? {
                        id: st.replyingTo.id,
                        sender: st.replyingTo.sender,
                        senderName: st.replyingTo.senderName,
                        type: st.replyingTo.type,
                        content: st.replyingTo.content,
                    } : null;

                    const msg = {
                        sender: 'user',
                        senderName,
                        type: 'text',
                        content: text,
                        replyTo,
                        timestamp: Date.now(),
                    };

                    try {
                        const saved = await sdk.chatMessages.add(null, aiPersonId, mode, msg);
                        if (!saved) {
                            _self.toolkit?.island?.notify?.('error', '发送失败', '请重试');
                            return;
                        }
                        appendMessageBubble(saved, { name: senderName, senderName });
                        messageInput.innerHTML = '';
                        messageInput.focus();
                        // ★ 引用回复完成后清掉 state
                        if (replyTo) {
                            st.replyingTo = null;
                        }
                        try {
                            const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                            if (defaultUser && sdk.chatFriends?.updateLastMessage) {
                                await sdk.chatFriends.updateLastMessage(sdk, defaultUser, aiPersonId, mode, {
                                    content: text,
                                    timestamp: saved.timestamp,
                                    senderName,
                                    type: 'text',
                                });
                            }
                        } catch (e) {
                            console.warn('[chat-app] updateLastMessage failed:', e);
                        }
                        try {
                            window.dispatchEvent(new CustomEvent('chat:message-sent', {
                                detail: { aiPersonId, mode, message: saved },
                            }));
                        } catch (_) {}
                    } catch (err) {
                        console.warn('[chat-app] send message failed:', err);
                        _self.toolkit?.island?.notify?.('error', '发送失败', err?.message || '请重试');
                    }
                };

                const sendBtn = chatPrivate.querySelector('#sendBtn');
                const messageInput = chatPrivate.querySelector('#messageInput');

                if (sendBtn) {
                    sendBtn.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        doSend();
                    });
                }
                if (messageInput) {
                    messageInput.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                            ev.preventDefault();
                            doSend();
                        }
                    });
                }

                // ★ v0.43 引用预览「×」按钮 / 工具栏展开 / 工具栏按钮 / 卡片点击 / 语音转文字
                chatPrivate.addEventListener('click', (event) => {
                    // 取消引用回复
                    const cancelReplyBtn = event.target.closest('#cancelReplyBtn');
                    if (cancelReplyBtn) {
                        const st2 = _self._ensureChatActionState(app);
                        if (st2.replyingTo) {
                            st2.replyingTo = null;
                            _self._triggerChatActionRerender();
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 工具栏「展开/收起」(纯 CSS class,framework 没有 API)
                    const expandBtn = event.target.closest('.expand-toolbar-btn');
                    if (expandBtn) {
                        const toolbar = chatPrivate.querySelector('.input-toolbar');
                        if (!toolbar) return;
                        const expanded = toolbar.classList.toggle('expanded');
                        expandBtn.classList.toggle('active', expanded);
                        expandBtn.setAttribute('aria-expanded', String(expanded));
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 工具栏按钮(image / voice / favorite / pat / ...)
                    const toolBtn = event.target.closest('.toolbar-btn');
                    if (toolBtn) {
                        const expandBtn2 = chatPrivate.querySelector('.expand-toolbar-btn');
                        const toolbar = chatPrivate.querySelector('.input-toolbar');
                        toolbar?.classList.remove('expanded');
                        expandBtn2?.classList.remove('active');
                        expandBtn2?.setAttribute('aria-expanded', 'false');

                        const action = toolBtn.dataset.action;

                        if (action === 'image') {
                            chatModalManager.openDescImageSend({
                                onConfirm: (result) => {
                                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                    if (messagesContainer) {
                                        const tempMsg = document.createElement('div');
                                        tempMsg.className = 'message-wrapper user temporary-message';
                                        const shortDesc = result.description.length > 30 ? result.description.substring(0, 30) + '...' : result.description;
                                        tempMsg.innerHTML = `
                                            <button class="message-select-button" type="button" aria-label="选择消息" data-message-select="temp-${Date.now()}">
                                                <span class="message-select-check"></span>
                                            </button>
                                            <div class="message sent">
                                                <div class="avatar self" data-poke="self" style="background: #F4A6CD;">我</div>
                                                <div class="message-content">
                                                    <div class="message-bubble message-bubble-card">
                                                        <div class="desc-image-card" data-desc="${escapeHtml(result.description)}" data-color="${escapeHtml(result.cardColor)}" data-text-color="${escapeHtml(result.textColor)}">
                                                            <div class="desc-image-card-inner" style="background: ${escapeHtml(result.cardColor)};">
                                                                <div class="desc-image-card-icon" style="color: ${escapeHtml(result.textColor)};">
                                                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.7;">
                                                                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                                                    </svg>
                                                                </div>
                                                                <div class="desc-image-card-text" style="color: ${escapeHtml(result.textColor)};">${escapeHtml(shortDesc)}</div>
                                                                <div class="desc-image-card-hint" style="color: ${escapeHtml(result.textColor)};">点击查看详情</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="message-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </div>
                                        `;
                                        messagesContainer.appendChild(tempMsg);
                                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                        setTimeout(() => tempMsg.classList.remove('temporary-message'), 100);
                                    }
                                },
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        if (action === 'voice') {
                            chatModalManager.openVoiceRecord({
                                onConfirm: (result) => {
                                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                    if (messagesContainer) {
                                        const voiceMsg = {
                                            id: 'voice-' + Date.now(),
                                            sender: 'user',
                                            type: 'voice',
                                            content: '[语音消息]',
                                            voiceContent: result.content,
                                            duration: result.duration,
                                            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                                        };
                                        const tempMsg = document.createElement('div');
                                        tempMsg.className = 'message-wrapper user temporary-message';
                                        tempMsg.innerHTML = renderVoiceMessageBubble(voiceMsg, null);
                                        messagesContainer.appendChild(tempMsg);
                                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                        setTimeout(() => tempMsg.classList.remove('temporary-message'), 100);
                                    }
                                },
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        if (action === 'favorite') {
                            const contactId = chatPrivate.dataset.contactId || 'ai-1';
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: { action: 'detail', appId: 'chat', pageId: `favorites-private-${contactId}` },
                                bubbles: true,
                            }));
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        if (action === 'pat') {
                            const ok = triggerPatAction(chatPrivate);
                            if (!ok) _self.toolkit?.island?.notify?.('warning', '拍一拍未完成', '请稍后再试');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        if (action) {
                            const labels = {
                                voice: '语音', sticker: '表情', location: '位置',
                                redpacket: '红包', transfer: '转账', call: '通话',
                                favorite: '收藏', pat: '拍一拍',
                            };
                            _self.toolkit?.island?.notify?.('info', labels[action] || '聊天工具', '功能即将开放');
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 模拟图片卡片点击 — 显示图片描述详情
                    const descImageCard = event.target.closest('.desc-image-card');
                    if (descImageCard) {
                        const desc = descImageCard.dataset.desc || '';
                        const cardColor = descImageCard.dataset.color || '#FFE4EC';
                        const textColor = descImageCard.dataset.textColor || '#D4728A';
                        const borderColor = Object.values(DESC_IMAGE_PRESETS || {}).find((p) => p.cardColor === cardColor)?.borderColor || '#C0607A';
                        chatModalManager.openDescImage({ description: desc, cardColor, textColor, borderColor });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 地点卡片点击 — 显示地点详情弹窗
                    const locationCard = event.target.closest('.location-card-in-chat');
                    if (locationCard) {
                        const name = locationCard.dataset.locationName || '位置';
                        const address = locationCard.dataset.locationAddress || '';
                        const mapEl = locationCard.querySelector('.location-card-map');
                        const bgGradient = mapEl ? (
                            mapEl.style.background || 'linear-gradient(135deg, #E8F2FF, #D6E4FF)'
                        ) : 'linear-gradient(135deg, #E8F2FF, #D6E4FF)';
                        chatModalManager.openLocationCard({ name, address, style: { bgGradient } });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 语音消息转文字切换
                    const voiceTranscribeToggle = event.target.closest('.voice-transcribe-toggle');
                    if (voiceTranscribeToggle) {
                        const transcribeEl = voiceTranscribeToggle.closest('.voice-transcribe');
                        if (transcribeEl) {
                            transcribeEl.classList.toggle('expanded');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                    }
                });

                // 双击 AI 头像触发拍一拍
                chatPrivate.addEventListener('dblclick', (event) => {
                    const aiAvatar = event.target.closest('.avatar[data-poke="other"]');
                    if (!aiAvatar) return;
                    event.preventDefault();
                    event.stopPropagation();
                    triggerPatAction(chatPrivate);
                });

                console.log('[chat-app] initPrivateChatInteractions bound (v0.43)');
            },
'@

# 合并: top + newMethod + bot
$out = @($top) + $newMethod + @($bot)
$out | Set-Content $Path -Encoding UTF8 -NoNewline
Write-Host ('NEW_TOTAL=' + $out.Count)