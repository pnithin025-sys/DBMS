const { verifyToken } = require('../utils/tokenHelper');
const { query, withTransaction } = require('../config/db');

function initSocket(io) {
    // Authentication middleware for Socket.IO connections
    io.use((socket, next) => {
        let token = null;

        // Try parsing cookie from handshake headers
        const cookieHeader = socket.handshake.headers.cookie;
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').reduce((res, c) => {
                const [k, v] = c.trim().split('=');
                if (k && v) res[k] = decodeURIComponent(v);
                return res;
            }, {});
            token = cookies.token;
        }

        // Fallback to auth query or auth token
        if (!token && socket.handshake.auth && socket.handshake.auth.token) {
            token = socket.handshake.auth.token;
        }

        if (token) {
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
                socket.user = decoded;
            }
        }
        next();
    });

    io.on('connection', (socket) => {
        const userId = socket.user ? socket.user.userId : null;

        if (userId) {
            // Join user-specific notification and DM room
            socket.join(`user_${userId}`);
            console.log(`[Socket.IO] User ${userId} connected (${socket.id})`);
        }

        // Join a conversation room
        socket.on('join_conversation', (conversationId) => {
            socket.join(`conversation_${conversationId}`);
        });

        // Leave conversation room
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(`conversation_${conversationId}`);
        });

        // Typing indicators
        socket.on('typing_start', ({ conversationId, username }) => {
            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                conversationId,
                username,
                isTyping: true
            });
        });

        socket.on('typing_stop', ({ conversationId, username }) => {
            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                conversationId,
                username,
                isTyping: false
            });
        });

        // Real-time chat message broadcast
        socket.on('send_message', async (data) => {
            try {
                if (!userId) return;
                const { conversationId, content, message_type = 'text', media_url, shared_item_id } = data;

                let newMessageId;
                await withTransaction(async (conn) => {
                    const [res] = await conn.execute(
                        `INSERT INTO messages (conversation_id, sender_id, message_type, content, media_url, shared_item_id) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [conversationId, userId, message_type, content || null, media_url || null, shared_item_id || null]
                    );
                    newMessageId = res.insertId;

                    await conn.execute('INSERT INTO message_reads (message_id, user_id) VALUES (?, ?)', [newMessageId, userId]);
                    await conn.execute('UPDATE conversations SET updated_at = NOW() WHERE conversation_id = ?', [conversationId]);
                });

                const [msgRows] = await query(
                    `SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
                     FROM messages m
                     JOIN users u ON m.sender_id = u.user_id
                     WHERE m.message_id = ?`,
                    [newMessageId]
                );

                const messagePayload = msgRows[0];

                // Emit to conversation room
                io.to(`conversation_${conversationId}`).emit('new_message', messagePayload);

                // Notify all other participants in their private rooms
                const participants = await query(
                    'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id <> ?',
                    [conversationId, userId]
                );

                for (const p of participants) {
                    io.to(`user_${p.user_id}`).emit('new_message_alert', {
                        conversationId,
                        message: messagePayload
                    });
                }
            } catch (err) {
                console.error('[Socket.IO Message Error]:', err.message);
            }
        });

        // Message seen receipt
        socket.on('mark_seen', async ({ conversationId, messageId }) => {
            try {
                if (!userId) return;
                await query('INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)', [messageId, userId]);
                socket.to(`conversation_${conversationId}`).emit('message_read', {
                    conversationId,
                    messageId,
                    userId
                });
            } catch (err) {
                console.error('[Socket.IO Read Error]:', err.message);
            }
        });

        socket.on('disconnect', () => {
            if (userId) {
                console.log(`[Socket.IO] User ${userId} disconnected`);
            }
        });
    });
}

module.exports = {
    initSocket
};
