const { query, withTransaction } = require('../config/db');

// Get all conversations for current user
async function getConversations(req, res, next) {
    try {
        const userId = req.user.user_id;

        const conversations = await query(
            `SELECT 
                c.conversation_id,
                c.is_group,
                c.title,
                c.updated_at,
                m.message_id AS last_message_id,
                m.sender_id AS last_sender_id,
                m.content AS last_message_content,
                m.message_type AS last_message_type,
                m.created_at AS last_message_time,
                (
                    SELECT COUNT(*) 
                    FROM messages unread_m
                    LEFT JOIN message_reads mr ON unread_m.message_id = mr.message_id AND mr.user_id = ?
                    WHERE unread_m.conversation_id = c.conversation_id 
                      AND unread_m.sender_id <> ?
                      AND mr.message_id IS NULL
                ) AS unread_count
             FROM conversations c
             JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
             LEFT JOIN messages m ON m.message_id = (
                 SELECT MAX(m2.message_id) FROM messages m2 WHERE m2.conversation_id = c.conversation_id
             )
             WHERE cp.user_id = ?
             ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
            [userId, userId, userId]
        );

        // Populate participants for each conversation
        for (const conv of conversations) {
            conv.participants = await query(
                `SELECT u.user_id, u.username, u.full_name, u.avatar_url, u.is_verified
                 FROM conversation_participants cp
                 JOIN users u ON cp.user_id = u.user_id
                 WHERE cp.conversation_id = ?`,
                [conv.conversation_id]
            );

            // If 1-to-1, set displayed conversation title and avatar to other participant
            if (!conv.is_group) {
                const other = conv.participants.find(p => p.user_id !== userId) || conv.participants[0];
                conv.display_name = other ? other.full_name || other.username : 'Chat';
                conv.display_avatar = other ? other.avatar_url : '/assets/default-avatar.svg';
                conv.other_user_id = other ? other.user_id : null;
            } else {
                conv.display_name = conv.title || 'Group Chat';
                conv.display_avatar = '/assets/group-avatar.svg';
            }
        }

        return res.json({ success: true, conversations });
    } catch (error) {
        next(error);
    }
}

// Get messages for a conversation
async function getMessages(req, res, next) {
    try {
        const userId = req.user.user_id;
        const convId = parseInt(req.params.conversationId, 10);

        // Verify participant
        const check = await query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
            [convId, userId]
        );
        if (check.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not a member of this chat.' });
        }

        const messages = await query(
            `SELECT 
                m.message_id,
                m.conversation_id,
                m.sender_id,
                m.message_type,
                m.content,
                m.media_url,
                m.shared_item_id,
                m.is_deleted,
                m.created_at,
                u.username AS sender_username,
                u.avatar_url AS sender_avatar,
                EXISTS(SELECT 1 FROM message_reads mr WHERE mr.message_id = m.message_id AND mr.user_id <> m.sender_id) AS is_seen
             FROM messages m
             JOIN users u ON m.sender_id = u.user_id
             WHERE m.conversation_id = ?
             ORDER BY m.created_at ASC`,
            [convId]
        );

        // Mark unread messages as read
        await query(
            `INSERT IGNORE INTO message_reads (message_id, user_id)
             SELECT m.message_id, ? 
             FROM messages m
             WHERE m.conversation_id = ? AND m.sender_id <> ?`,
            [userId, convId, userId]
        );

        return res.json({ success: true, messages });
    } catch (error) {
        next(error);
    }
}

// Send message
async function sendMessage(req, res, next) {
    try {
        const senderId = req.user.user_id;
        const convId = parseInt(req.params.conversationId, 10);
        const { content, message_type = 'text', shared_item_id } = req.body;

        let mediaUrl = null;
        if (req.file) {
            mediaUrl = `/uploads/posts/${req.file.filename}`;
        }

        if (!content && !mediaUrl && !shared_item_id) {
            return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
        }

        let newMessageId;

        await withTransaction(async (conn) => {
            const [result] = await conn.execute(
                `INSERT INTO messages (conversation_id, sender_id, message_type, content, media_url, shared_item_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [convId, senderId, message_type, content ? content.trim() : null, mediaUrl, shared_item_id || null]
            );
            newMessageId = result.insertId;

            // Mark read by sender
            await conn.execute(
                'INSERT INTO message_reads (message_id, user_id) VALUES (?, ?)',
                [newMessageId, senderId]
            );

            // Update conversation updated_at
            await conn.execute('UPDATE conversations SET updated_at = NOW() WHERE conversation_id = ?', [convId]);
        });

        const createdMessage = await query(
            `SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
             FROM messages m
             JOIN users u ON m.sender_id = u.user_id
             WHERE m.message_id = ?`,
            [newMessageId]
        );

        return res.status(201).json({
            success: true,
            message: createdMessage[0]
        });
    } catch (error) {
        next(error);
    }
}

// Get or Create Direct (1-to-1) Conversation
async function getOrCreateDirect(req, res, next) {
    try {
        const myId = req.user.user_id;
        const targetUserId = parseInt(req.body.target_user_id, 10);

        if (!targetUserId || myId === targetUserId) {
            return res.status(400).json({ success: false, message: 'Valid target user required.' });
        }

        // Check if direct conversation already exists
        const existing = await query(
            `SELECT c.conversation_id 
             FROM conversations c
             JOIN conversation_participants cp1 ON c.conversation_id = cp1.conversation_id AND cp1.user_id = ?
             JOIN conversation_participants cp2 ON c.conversation_id = cp2.conversation_id AND cp2.user_id = ?
             WHERE c.is_group = FALSE`,
            [myId, targetUserId]
        );

        if (existing.length > 0) {
            return res.json({ success: true, conversation_id: existing[0].conversation_id });
        }

        // Create new direct conversation
        let newConvId;
        await withTransaction(async (conn) => {
            const [convResult] = await conn.execute(
                'INSERT INTO conversations (is_group) VALUES (FALSE)'
            );
            newConvId = convResult.insertId;

            await conn.execute('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [newConvId, myId]);
            await conn.execute('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [newConvId, targetUserId]);
        });

        return res.status(201).json({ success: true, conversation_id: newConvId });
    } catch (error) {
        next(error);
    }
}

// Create Group Conversation
async function createGroup(req, res, next) {
    try {
        const myId = req.user.user_id;
        const { title, participant_ids } = req.body;

        if (!title || !participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'Title and participant IDs required.' });
        }

        let newConvId;
        await withTransaction(async (conn) => {
            const [convResult] = await conn.execute(
                'INSERT INTO conversations (is_group, title) VALUES (TRUE, ?)',
                [title.trim()]
            );
            newConvId = convResult.insertId;

            // Add creator
            await conn.execute('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [newConvId, myId]);

            // Add other members
            for (const pid of participant_ids) {
                if (pid !== myId) {
                    await conn.execute('INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [newConvId, pid]);
                }
            }
        });

        return res.status(201).json({ success: true, conversation_id: newConvId });
    } catch (error) {
        next(error);
    }
}

// Delete message (soft delete)
async function deleteMessage(req, res, next) {
    try {
        const messageId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const msg = await query('SELECT sender_id FROM messages WHERE message_id = ?', [messageId]);
        if (msg.length === 0) return res.status(404).json({ success: false, message: 'Message not found.' });
        if (msg[0].sender_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        await query('UPDATE messages SET is_deleted = TRUE, content = \'This message was deleted.\' WHERE message_id = ?', [messageId]);
        return res.json({ success: true, message: 'Message deleted.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getConversations,
    getMessages,
    sendMessage,
    getOrCreateDirect,
    createGroup,
    deleteMessage
};
