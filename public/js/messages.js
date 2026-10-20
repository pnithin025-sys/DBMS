// =====================================================================
// PIXORA DIRECT MESSAGES (CHAT) CONTROLLER
// =====================================================================

const Messages = {
    activeConversationId: null,
    conversations: [],

    async renderMessages(container, requestedConvId = null) {
        container.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto; width: 100%;">
                <div class="chat-container">
                    <!-- Left Sidebar Conversations List -->
                    <div class="chat-sidebar">
                        <div class="chat-sidebar-header">
                            <strong style="font-size:16px;">Messages</strong>
                            <button class="btn btn-icon" onclick="Messages.openNewChatModal()">
                                <svg width="22" height="22"><use href="/assets/icons.svg#icon-create"/></svg>
                            </button>
                        </div>
                        <div class="chat-conversations-list" id="conversations-list">
                            <div style="padding:20px; text-align:center;">
                                <div class="spinner" style="margin:0 auto 10px;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Main Active Chat View -->
                    <div class="chat-main" id="chat-main-area">
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted);">
                            <div style="font-size:48px; margin-bottom:12px;">💬</div>
                            <h3>Your Messages</h3>
                            <p style="font-size:14px; margin-top:6px;">Send private photos and messages to a friend or group.</p>
                            <button class="btn btn-primary" style="margin-top:16px;" onclick="Messages.openNewChatModal()">Send Message</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadConversations(requestedConvId);
        this.setupSocketListeners();
    },

    async loadConversations(autoSelectConvId = null) {
        const listContainer = document.getElementById('conversations-list');
        if (!listContainer) return;

        try {
            const data = await API.get('/messages/conversations');
            if (data.success && data.conversations) {
                this.conversations = data.conversations;

                if (this.conversations.length === 0) {
                    listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">No conversations yet.</div>';
                    return;
                }

                listContainer.innerHTML = this.conversations.map(c => `
                    <div class="conv-item ${c.conversation_id === this.activeConversationId ? 'active' : ''}" id="conv-item-${c.conversation_id}" onclick="Messages.selectConversation(${c.conversation_id})">
                        <img src="${c.display_avatar || '/assets/default-avatar.svg'}" class="avatar avatar-md" alt="${c.display_name}">
                        <div class="conv-info">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div class="conv-title">${c.display_name}</div>
                                <span style="font-size:11px; color:var(--text-muted);">${c.last_message_time ? Feed.timeAgo(c.last_message_time) : ''}</span>
                            </div>
                            <div class="conv-preview" style="${c.unread_count > 0 ? 'font-weight:700; color:var(--text-primary);' : ''}">
                                ${c.last_message_content || 'Started a conversation'}
                            </div>
                        </div>
                        ${c.unread_count > 0 ? `<div class="nav-badge" style="position:static;">${c.unread_count}</div>` : ''}
                    </div>
                `).join('');

                if (autoSelectConvId) {
                    this.selectConversation(parseInt(autoSelectConvId, 10));
                } else if (this.conversations.length > 0 && window.innerWidth > 768) {
                    this.selectConversation(this.conversations[0].conversation_id);
                }
            }
        } catch (error) {
            console.error('Failed loading conversations:', error);
        }
    },

    async selectConversation(convId) {
        this.activeConversationId = convId;
        document.querySelectorAll('.conv-item').forEach(item => item.classList.remove('active'));
        const activeItem = document.getElementById(`conv-item-${convId}`);
        if (activeItem) activeItem.classList.add('active');

        const conv = this.conversations.find(c => c.conversation_id === convId);
        const mainArea = document.getElementById('chat-main-area');
        if (!mainArea) return;

        mainArea.innerHTML = `
            <!-- Chat Header -->
            <div class="chat-header">
                <img src="${conv ? conv.display_avatar : '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                <div>
                    <div style="font-weight:700; font-size:14px;">${conv ? conv.display_name : 'Chat'}</div>
                    <div style="font-size:11px; color:var(--success);">Active now</div>
                </div>
            </div>

            <!-- Messages Stream -->
            <div class="chat-messages-area" id="chat-stream">
                <div style="text-align:center; padding:20px;">
                    <div class="spinner" style="margin:0 auto;"></div>
                </div>
            </div>

            <!-- Input Bar -->
            <form class="chat-input-bar" onsubmit="Messages.handleSendMessage(event)">
                <input type="text" id="chat-msg-input" placeholder="Message..." autocomplete="off">
                <button type="submit" class="btn btn-primary" style="padding:8px 16px;">Send</button>
            </form>
        `;

        // Join socket room
        const socket = window.getSocket ? window.getSocket() : null;
        if (socket) {
            socket.emit('join_conversation', convId);
        }

        await this.loadMessages(convId);
    },

    async loadMessages(convId) {
        const stream = document.getElementById('chat-stream');
        if (!stream) return;

        try {
            const data = await API.get(`/messages/conversations/${convId}`);
            if (data.success && data.messages) {
                const myId = Auth.currentUser ? Auth.currentUser.user_id : null;

                stream.innerHTML = data.messages.map(m => {
                    const isSent = m.sender_id === myId;
                    return `
                        <div class="msg-bubble ${isSent ? 'sent' : 'received'}">
                            ${m.media_url ? `<img src="${m.media_url}" style="border-radius:12px; margin-bottom:6px; max-width:240px;">` : ''}
                            ${m.content ? `<div>${m.content}</div>` : ''}
                            <div style="font-size:10px; opacity:0.75; text-align:right; margin-top:4px;">
                                ${Feed.timeAgo(m.created_at)}
                            </div>
                        </div>
                    `;
                }).join('');

                stream.scrollTop = stream.scrollHeight;
            }
        } catch (error) {
            console.error('Failed loading messages:', error);
        }
    },

    async handleSendMessage(event) {
        event.preventDefault();
        const input = document.getElementById('chat-msg-input');
        if (!input || !input.value.trim() || !this.activeConversationId) return;

        const content = input.value.trim();
        input.value = '';

        try {
            // Send via REST API (which also persists to DB)
            const data = await API.post(`/messages/conversations/${this.activeConversationId}`, { content });
            if (data.success && data.message) {
                const stream = document.getElementById('chat-stream');
                if (stream) {
                    stream.insertAdjacentHTML('beforeend', `
                        <div class="msg-bubble sent">
                            <div>${data.message.content}</div>
                            <div style="font-size:10px; opacity:0.75; text-align:right; margin-top:4px;">Just now</div>
                        </div>
                    `);
                    stream.scrollTop = stream.scrollHeight;
                }

                // Also notify via Socket if active
                const socket = window.getSocket ? window.getSocket() : null;
                if (socket) {
                    socket.emit('send_message', {
                        conversationId: this.activeConversationId,
                        content: data.message.content
                    });
                }
            }
        } catch (error) {
            if (window.showToast) window.showToast('Failed to send message', 'error');
        }
    },

    setupSocketListeners() {
        const socket = window.getSocket ? window.getSocket() : null;
        if (!socket || socket._hasChatListeners) return;
        socket._hasChatListeners = true;

        socket.on('new_message', (msg) => {
            if (msg.conversation_id === this.activeConversationId) {
                const myId = Auth.currentUser ? Auth.currentUser.user_id : null;
                if (msg.sender_id !== myId) {
                    const stream = document.getElementById('chat-stream');
                    if (stream) {
                        stream.insertAdjacentHTML('beforeend', `
                            <div class="msg-bubble received">
                                ${msg.content ? `<div>${msg.content}</div>` : ''}
                                <div style="font-size:10px; opacity:0.75; text-align:right; margin-top:4px;">Just now</div>
                            </div>
                        `);
                        stream.scrollTop = stream.scrollHeight;
                    }
                }
            }
        });
    },

    openNewChatModal() {
        App.showModal(`
            <div style="display:flex; flex-direction:column; max-height:80vh;">
                <div class="modal-header">
                    <div class="modal-title">New Direct Message</div>
                    <div class="modal-close" onclick="App.closeModal()">✕</div>
                </div>
                <div class="modal-body">
                    <input type="text" id="new-chat-search" placeholder="Search user by username or name..." oninput="Messages.handleSearchUser(this.value)" style="width:100%; padding:10px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:16px;">
                    <div id="new-chat-user-results" style="max-height:300px; overflow-y:auto;">
                        <p style="text-align:center; color:var(--text-muted); font-size:13px;">Type to search users...</p>
                    </div>
                </div>
            </div>
        `);
    },

    async handleSearchUser(query) {
        const results = document.getElementById('new-chat-user-results');
        if (!query.trim() || query.length < 2) {
            results.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:13px;">Type to search users...</p>';
            return;
        }

        try {
            const data = await API.get(`/search?q=${encodeURIComponent(query)}`);
            if (data.success && data.users) {
                if (data.users.length === 0) {
                    results.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:13px;">No users found.</p>';
                    return;
                }

                results.innerHTML = data.users.map(u => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${u.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                            <div>
                                <strong style="font-size:13px;">${u.username}</strong>
                                <div style="font-size:11px; color:var(--text-muted);">${u.full_name || ''}</div>
                            </div>
                        </div>
                        <button class="btn btn-primary" style="font-size:12px; padding:4px 12px;" onclick="User.startDirectMessage(${u.user_id}); App.closeModal();">Chat</button>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Search error:', e);
        }
    }
};

window.Messages = Messages;
