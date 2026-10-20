const { query, withTransaction } = require('../config/db');

// Upload an ephemeral 24-hour Story
async function uploadStory(req, res, next) {
    try {
        const userId = req.user.user_id;
        const { is_close_friends_only, caption } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an image or video for your story.' });
        }

        const isVideo = req.file.mimetype.startsWith('video');
        const mediaUrl = `/uploads/stories/${req.file.filename}`;

        const [result] = await query(
            `INSERT INTO stories (user_id, media_url, media_type, is_close_friends_only, caption, expires_at) 
             VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL 24 HOUR)`,
            [
                userId,
                mediaUrl,
                isVideo ? 'video' : 'image',
                Boolean(is_close_friends_only === 'true' || is_close_friends_only === true),
                caption ? caption.trim() : null
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Story shared successfully!',
            story_id: result.insertId,
            media_url: mediaUrl
        });
    } catch (error) {
        next(error);
    }
}

// Get active Story tray on home feed
async function getFeedStories(req, res, next) {
    try {
        const currentUserId = req.user.user_id;

        // Fetch active stories (own + followed users)
        const rows = await query(
            `SELECT 
                s.story_id,
                s.user_id,
                s.media_url,
                s.media_type,
                s.is_close_friends_only,
                s.caption,
                s.created_at,
                s.expires_at,
                u.username,
                u.full_name,
                u.avatar_url,
                u.is_verified,
                EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.story_id AND sv.viewer_id = ?) AS is_viewed_by_me,
                (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.story_id) AS views_count
             FROM stories s
             JOIN users u ON s.user_id = u.user_id
             WHERE s.expires_at > NOW()
               AND u.is_active = TRUE
               AND (
                   s.user_id = ?
                   OR (
                       s.user_id IN (
                           SELECT following_id FROM follows WHERE follower_id = ? AND status = 'accepted'
                       )
                       AND (
                           s.is_close_friends_only = FALSE 
                           OR EXISTS(SELECT 1 FROM close_friends cf WHERE cf.user_id = s.user_id AND cf.friend_id = ?)
                       )
                   )
               )
             ORDER BY s.created_at ASC`,
            [currentUserId, currentUserId, currentUserId, currentUserId]
        );

        // Group stories by creator
        const grouped = {};
        for (const story of rows) {
            if (!grouped[story.user_id]) {
                grouped[story.user_id] = {
                    user_id: story.user_id,
                    username: story.username,
                    full_name: story.full_name,
                    avatar_url: story.avatar_url,
                    is_verified: story.is_verified,
                    is_all_viewed: true,
                    stories: []
                };
            }
            if (!story.is_viewed_by_me) {
                grouped[story.user_id].is_all_viewed = false;
            }
            grouped[story.user_id].stories.push(story);
        }

        const tray = Object.values(grouped);
        // Put own stories first, then unviewed, then viewed
        tray.sort((a, b) => {
            if (a.user_id === currentUserId) return -1;
            if (b.user_id === currentUserId) return 1;
            if (!a.is_all_viewed && b.is_all_viewed) return -1;
            if (a.is_all_viewed && !b.is_all_viewed) return 1;
            return 0;
        });

        return res.json({ success: true, tray });
    } catch (error) {
        next(error);
    }
}

// Record unique story view
async function recordStoryView(req, res, next) {
    try {
        const viewerId = req.user.user_id;
        const storyId = parseInt(req.params.id, 10);

        await query(
            'INSERT IGNORE INTO story_views (story_id, viewer_id) VALUES (?, ?)',
            [storyId, viewerId]
        );

        return res.json({ success: true });
    } catch (error) {
        next(error);
    }
}

// Get viewers for a story (author only)
async function getStoryViewers(req, res, next) {
    try {
        const userId = req.user.user_id;
        const storyId = parseInt(req.params.id, 10);

        const story = await query('SELECT user_id FROM stories WHERE story_id = ?', [storyId]);
        if (story.length === 0 || story[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized to view story audience.' });
        }

        const viewers = await query(
            `SELECT u.user_id, u.username, u.full_name, u.avatar_url, sv.viewed_at
             FROM story_views sv
             JOIN users u ON sv.viewer_id = u.user_id
             WHERE sv.story_id = ?
             ORDER BY sv.viewed_at DESC`,
            [storyId]
        );

        return res.json({ success: true, viewers });
    } catch (error) {
        next(error);
    }
}

// Delete story
async function deleteStory(req, res, next) {
    try {
        const storyId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const story = await query('SELECT user_id FROM stories WHERE story_id = ?', [storyId]);
        if (story.length === 0) return res.status(404).json({ success: false, message: 'Story not found.' });
        if (story[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        await query('DELETE FROM stories WHERE story_id = ?', [storyId]);
        return res.json({ success: true, message: 'Story deleted.' });
    } catch (error) {
        next(error);
    }
}

// Create profile highlight
async function createHighlight(req, res, next) {
    try {
        const userId = req.user.user_id;
        const { title, cover_image_url, story_ids } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Highlight title is required.' });
        }

        let newHlId;
        await withTransaction(async (conn) => {
            const [result] = await conn.execute(
                'INSERT INTO highlights (user_id, title, cover_image_url) VALUES (?, ?, ?)',
                [userId, title.trim(), cover_image_url || null]
            );
            newHlId = result.insertId;

            if (story_ids && Array.isArray(story_ids)) {
                for (const sid of story_ids) {
                    await conn.execute(
                        'INSERT IGNORE INTO highlight_items (highlight_id, story_id) VALUES (?, ?)',
                        [newHlId, sid]
                    );
                }
            }
        });

        return res.status(201).json({ success: true, message: 'Highlight created.', highlight_id: newHlId });
    } catch (error) {
        next(error);
    }
}

// Get highlight stories
async function getHighlightStories(req, res, next) {
    try {
        const highlightId = parseInt(req.params.id, 10);
        const stories = await query(
            `SELECT s.*, u.username, u.avatar_url
             FROM highlight_items hi
             JOIN stories s ON hi.story_id = s.story_id
             JOIN users u ON s.user_id = u.user_id
             WHERE hi.highlight_id = ?
             ORDER BY hi.created_at ASC`,
            [highlightId]
        );
        return res.json({ success: true, stories });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    uploadStory,
    getFeedStories,
    recordStoryView,
    getStoryViewers,
    deleteStory,
    createHighlight,
    getHighlightStories
};
