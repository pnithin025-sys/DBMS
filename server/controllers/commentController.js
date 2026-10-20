const { query, withTransaction } = require('../config/db');

// Add comment or reply
async function addComment(req, res, next) {
    try {
        const userId = req.user.user_id;
        const postId = parseInt(req.params.postId, 10);
        const { content, parent_comment_id } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Comment content cannot be empty.' });
        }

        // Check if post exists and commenting is allowed
        const posts = await query('SELECT user_id, comments_disabled FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        if (posts[0].comments_disabled) {
            return res.status(403).json({ success: false, message: 'Comments are disabled for this post.' });
        }

        let newCommentId;

        await withTransaction(async (conn) => {
            const [result] = await conn.execute(
                `INSERT INTO comments (post_id, user_id, parent_comment_id, content) 
                 VALUES (?, ?, ?, ?)`,
                [postId, userId, parent_comment_id || null, content.trim()]
            );
            newCommentId = result.insertId;

            // Trigger notification to post author if not self
            const postAuthorId = posts[0].user_id;
            if (postAuthorId !== userId && !parent_comment_id) {
                await conn.execute(
                    'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'comment\', ?, \'post\')',
                    [postAuthorId, userId, postId]
                );
            }

            // If it's a reply, notify parent comment author
            if (parent_comment_id) {
                const [parents] = await conn.execute('SELECT user_id FROM comments WHERE comment_id = ?', [parent_comment_id]);
                if (parents.length > 0 && parents[0].user_id !== userId) {
                    await conn.execute(
                        'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'reply\', ?, \'comment\')',
                        [parents[0].user_id, userId, postId]
                    );
                }
            }

            // Parse @mentions
            const mentionRegex = /@([a-zA-Z0-9_]+)/g;
            let mentionMatch;
            const foundMentions = new Set();
            while ((mentionMatch = mentionRegex.exec(content)) !== null) {
                foundMentions.add(mentionMatch[1].toLowerCase());
            }

            for (const mentionUsername of foundMentions) {
                const [userRows] = await conn.execute('SELECT user_id FROM users WHERE username = ? AND is_active = TRUE', [mentionUsername]);
                if (userRows.length > 0 && userRows[0].user_id !== userId) {
                    await conn.execute(
                        'INSERT INTO mentions (mentioned_user_id, source_type, source_id) VALUES (?, \'comment\', ?)',
                        [userRows[0].user_id, newCommentId]
                    );
                    await conn.execute(
                        'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'mention\', ?, \'comment\')',
                        [userRows[0].user_id, userId, newCommentId]
                    );
                }
            }
        });

        // Fetch inserted comment object to return
        const createdComment = await query(
            `SELECT c.*, u.username, u.full_name, u.avatar_url, u.is_verified,
                    0 AS likes_count,
                    FALSE AS is_liked_by_me
             FROM comments c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.comment_id = ?`,
            [newCommentId]
        );

        return res.status(201).json({
            success: true,
            message: 'Comment posted.',
            comment: createdComment[0]
        });
    } catch (error) {
        next(error);
    }
}

// Get comments for a post (with 1-level replies nested)
async function getComments(req, res, next) {
    try {
        const postId = parseInt(req.params.postId, 10);
        const currentUserId = req.user ? req.user.user_id : null;

        const allComments = await query(
            `SELECT c.comment_id, c.post_id, c.user_id, c.parent_comment_id, c.content, c.is_pinned, c.created_at,
                    u.username, u.full_name, u.avatar_url, u.is_verified,
                    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id) AS likes_count,
                    EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.comment_id AND cl.user_id = ?) AS is_liked_by_me
             FROM comments c
             JOIN users u ON c.user_id = u.user_id
             WHERE c.post_id = ? AND u.is_active = TRUE
             ORDER BY c.is_pinned DESC, c.created_at ASC`,
            [currentUserId, postId]
        );

        // Group into top-level and nested replies
        const topLevel = [];
        const repliesMap = {};

        for (const comment of allComments) {
            if (!comment.parent_comment_id) {
                comment.replies = [];
                topLevel.push(comment);
                repliesMap[comment.comment_id] = comment;
            } else {
                if (repliesMap[comment.parent_comment_id]) {
                    repliesMap[comment.parent_comment_id].replies.push(comment);
                } else {
                    topLevel.push(comment); // Fallback if parent missing
                }
            }
        }

        return res.json({ success: true, comments: topLevel });
    } catch (error) {
        next(error);
    }
}

// Delete comment
async function deleteComment(req, res, next) {
    try {
        const commentId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const comments = await query(
            `SELECT c.user_id, p.user_id AS post_owner_id 
             FROM comments c
             JOIN posts p ON c.post_id = p.post_id
             WHERE c.comment_id = ?`,
            [commentId]
        );

        if (comments.length === 0) {
            return res.status(404).json({ success: false, message: 'Comment not found.' });
        }

        const { user_id, post_owner_id } = comments[0];

        // Allowed if author, post owner, or admin
        if (user_id !== userId && post_owner_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized to delete this comment.' });
        }

        await query('DELETE FROM comments WHERE comment_id = ?', [commentId]);
        return res.json({ success: true, message: 'Comment deleted successfully.' });
    } catch (error) {
        next(error);
    }
}

// Pin / unpin comment (post owner only)
async function togglePin(req, res, next) {
    try {
        const commentId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const comments = await query(
            `SELECT c.is_pinned, p.user_id AS post_owner_id 
             FROM comments c
             JOIN posts p ON c.post_id = p.post_id
             WHERE c.comment_id = ?`,
            [commentId]
        );

        if (comments.length === 0) return res.status(404).json({ success: false, message: 'Comment not found.' });
        if (comments[0].post_owner_id !== userId) {
            return res.status(403).json({ success: false, message: 'Only the post owner can pin comments.' });
        }

        const newPinned = !comments[0].is_pinned;
        await query('UPDATE comments SET is_pinned = ? WHERE comment_id = ?', [newPinned, commentId]);

        return res.json({
            success: true,
            message: newPinned ? 'Comment pinned.' : 'Comment unpinned.',
            is_pinned: newPinned
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    addComment,
    getComments,
    deleteComment,
    togglePin
};
