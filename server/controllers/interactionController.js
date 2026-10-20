const { query, withTransaction } = require('../config/db');

// Toggle Like on Post
async function togglePostLike(req, res, next) {
    try {
        const userId = req.user.user_id;
        const postId = parseInt(req.params.id, 10);

        let action = 'liked';

        await withTransaction(async (conn) => {
            const [existing] = await conn.execute(
                'SELECT 1 FROM post_likes WHERE user_id = ? AND post_id = ?',
                [userId, postId]
            );

            if (existing.length > 0) {
                await conn.execute('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
                action = 'unliked';
            } else {
                await conn.execute('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
                // Trigger notification if not self-like
                const [post] = await conn.execute('SELECT user_id FROM posts WHERE post_id = ?', [postId]);
                if (post.length > 0 && post[0].user_id !== userId) {
                    await conn.execute(
                        'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'like_post\', ?, \'post\')',
                        [post[0].user_id, userId, postId]
                    );
                }
            }
        });

        const [countRow] = await query('SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?', [postId]);

        return res.json({
            success: true,
            action,
            likes_count: countRow[0].count,
            is_liked: action === 'liked'
        });
    } catch (error) {
        next(error);
    }
}

// Toggle Like on Comment
async function toggleCommentLike(req, res, next) {
    try {
        const userId = req.user.user_id;
        const commentId = parseInt(req.params.id, 10);

        let action = 'liked';

        await withTransaction(async (conn) => {
            const [existing] = await conn.execute(
                'SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ?',
                [userId, commentId]
            );

            if (existing.length > 0) {
                await conn.execute('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?', [userId, commentId]);
                action = 'unliked';
            } else {
                await conn.execute('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)', [userId, commentId]);
                const [comm] = await conn.execute('SELECT user_id, post_id FROM comments WHERE comment_id = ?', [commentId]);
                if (comm.length > 0 && comm[0].user_id !== userId) {
                    await conn.execute(
                        'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'like_comment\', ?, \'comment\')',
                        [comm[0].user_id, userId, comm[0].post_id]
                    );
                }
            }
        });

        const [countRow] = await query('SELECT COUNT(*) AS count FROM comment_likes WHERE comment_id = ?', [commentId]);

        return res.json({
            success: true,
            action,
            likes_count: countRow[0].count,
            is_liked: action === 'liked'
        });
    } catch (error) {
        next(error);
    }
}

// Toggle Save Post (Bookmark)
async function toggleSavePost(req, res, next) {
    try {
        const userId = req.user.user_id;
        const postId = parseInt(req.params.id, 10);

        let action = 'saved';

        const existing = await query('SELECT 1 FROM saved_posts WHERE user_id = ? AND post_id = ?', [userId, postId]);
        if (existing.length > 0) {
            await query('DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?', [userId, postId]);
            action = 'unsaved';
        } else {
            await query('INSERT INTO saved_posts (user_id, post_id) VALUES (?, ?)', [userId, postId]);
        }

        return res.json({
            success: true,
            action,
            is_saved: action === 'saved'
        });
    } catch (error) {
        next(error);
    }
}

// Get user Collections
async function getCollections(req, res, next) {
    try {
        const userId = req.user.user_id;
        const collections = await query(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.collection_id) AS item_count
             FROM collections c
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`,
            [userId]
        );
        return res.json({ success: true, collections });
    } catch (error) {
        next(error);
    }
}

// Create Collection
async function createCollection(req, res, next) {
    try {
        const userId = req.user.user_id;
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Collection name is required.' });
        }

        const [result] = await query(
            'INSERT INTO collections (user_id, name) VALUES (?, ?)',
            [userId, name.trim()]
        );

        return res.status(201).json({
            success: true,
            message: 'Collection created.',
            collection_id: result.insertId
        });
    } catch (error) {
        next(error);
    }
}

// Delete Collection
async function deleteCollection(req, res, next) {
    try {
        const collectionId = parseInt(req.params.id, 10);
        await query('DELETE FROM collections WHERE collection_id = ? AND user_id = ?', [collectionId, req.user.user_id]);
        return res.json({ success: true, message: 'Collection deleted.' });
    } catch (error) {
        next(error);
    }
}

// Add post to collection
async function addPostToCollection(req, res, next) {
    try {
        const collectionId = parseInt(req.params.collectionId, 10);
        const { post_id } = req.body;

        // Verify collection belongs to user
        const coll = await query('SELECT user_id FROM collections WHERE collection_id = ?', [collectionId]);
        if (coll.length === 0 || coll[0].user_id !== req.user.user_id) {
            return res.status(403).json({ success: false, message: 'Unauthorized collection.' });
        }

        await query(
            'INSERT IGNORE INTO collection_items (collection_id, post_id) VALUES (?, ?)',
            [collectionId, post_id]
        );

        // Also ensure it is in saved_posts
        await query('INSERT IGNORE INTO saved_posts (user_id, post_id) VALUES (?, ?)', [req.user.user_id, post_id]);

        return res.json({ success: true, message: 'Post added to collection.' });
    } catch (error) {
        next(error);
    }
}

// Remove post from collection
async function removePostFromCollection(req, res, next) {
    try {
        const collectionId = parseInt(req.params.collectionId, 10);
        const postId = parseInt(req.params.postId, 10);

        await query(
            `DELETE ci FROM collection_items ci
             JOIN collections c ON ci.collection_id = c.collection_id
             WHERE ci.collection_id = ? AND ci.post_id = ? AND c.user_id = ?`,
            [collectionId, postId, req.user.user_id]
        );

        return res.json({ success: true, message: 'Post removed from collection.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    togglePostLike,
    toggleCommentLike,
    toggleSavePost,
    getCollections,
    createCollection,
    deleteCollection,
    addPostToCollection,
    removePostFromCollection
};
