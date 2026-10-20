const { query } = require('../config/db');
const { logAction } = require('../utils/auditLogger');

// Upload a new Reel (video + caption)
async function uploadReel(req, res, next) {
    try {
        const userId = req.user.user_id;
        const { caption } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a video file for your reel.' });
        }

        const videoUrl = `/uploads/reels/${req.file.filename}`;
        // Set default thumbnail fallback
        const thumbnailUrl = '/assets/reel-placeholder.jpg';

        const [result] = await query(
            'INSERT INTO reels (user_id, video_url, thumbnail_url, caption) VALUES (?, ?, ?, ?)',
            [userId, videoUrl, thumbnailUrl, caption ? caption.trim() : null]
        );

        await logAction('UPLOAD_REEL', 'reels', result.insertId, userId);

        return res.status(201).json({
            success: true,
            message: 'Reel uploaded successfully!',
            reel_id: result.insertId,
            video_url: videoUrl
        });
    } catch (error) {
        next(error);
    }
}

// Get paginated Reels feed for vertical scroll
async function getReels(req, res, next) {
    try {
        const currentUserId = req.user ? req.user.user_id : null;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const reels = await query(
            `SELECT 
                r.reel_id,
                r.user_id,
                r.video_url,
                r.thumbnail_url,
                r.caption,
                r.view_count,
                r.created_at,
                u.username,
                u.full_name,
                u.avatar_url,
                u.is_verified,
                (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.reel_id) AS likes_count,
                (SELECT COUNT(*) FROM reel_comments rc WHERE rc.reel_id = r.reel_id) AS comments_count,
                EXISTS(SELECT 1 FROM reel_likes rl WHERE rl.reel_id = r.reel_id AND rl.user_id = ?) AS is_liked_by_me,
                EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = r.user_id AND f.status = 'accepted') AS is_following
             FROM reels r
             JOIN users u ON r.user_id = u.user_id
             WHERE u.is_active = TRUE
             ORDER BY r.created_at DESC
             LIMIT ? OFFSET ?`,
            [currentUserId, currentUserId, limit, offset]
        );

        return res.json({
            success: true,
            reels,
            page,
            has_more: reels.length === limit
        });
    } catch (error) {
        next(error);
    }
}

// Increment view count on reel
async function incrementView(req, res, next) {
    try {
        const reelId = parseInt(req.params.id, 10);
        await query('UPDATE reels SET view_count = view_count + 1 WHERE reel_id = ?', [reelId]);
        return res.json({ success: true });
    } catch (error) {
        next(error);
    }
}

// Toggle like on Reel
async function toggleReelLike(req, res, next) {
    try {
        const userId = req.user.user_id;
        const reelId = parseInt(req.params.id, 10);

        let action = 'liked';
        const existing = await query('SELECT 1 FROM reel_likes WHERE user_id = ? AND reel_id = ?', [userId, reelId]);

        if (existing.length > 0) {
            await query('DELETE FROM reel_likes WHERE user_id = ? AND reel_id = ?', [userId, reelId]);
            action = 'unliked';
        } else {
            await query('INSERT INTO reel_likes (user_id, reel_id) VALUES (?, ?)', [userId, reelId]);
            action = 'liked';
            // Trigger notification
            const reel = await query('SELECT user_id FROM reels WHERE reel_id = ?', [reelId]);
            if (reel.length > 0 && reel[0].user_id !== userId) {
                await query(
                    'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'like_post\', ?, \'reel\')',
                    [reel[0].user_id, userId, reelId]
                );
            }
        }

        const [countRow] = await query('SELECT COUNT(*) AS count FROM reel_likes WHERE reel_id = ?', [reelId]);

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

// Add comment to Reel
async function addReelComment(req, res, next) {
    try {
        const userId = req.user.user_id;
        const reelId = parseInt(req.params.id, 10);
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Comment content cannot be empty.' });
        }

        const [result] = await query(
            'INSERT INTO reel_comments (reel_id, user_id, content) VALUES (?, ?, ?)',
            [reelId, userId, content.trim()]
        );

        const comment = await query(
            `SELECT rc.*, u.username, u.full_name, u.avatar_url, u.is_verified
             FROM reel_comments rc
             JOIN users u ON rc.user_id = u.user_id
             WHERE rc.comment_id = ?`,
            [result.insertId]
        );

        return res.status(201).json({
            success: true,
            comment: comment[0]
        });
    } catch (error) {
        next(error);
    }
}

// Get comments for Reel
async function getReelComments(req, res, next) {
    try {
        const reelId = parseInt(req.params.id, 10);
        const comments = await query(
            `SELECT rc.*, u.username, u.full_name, u.avatar_url, u.is_verified
             FROM reel_comments rc
             JOIN users u ON rc.user_id = u.user_id
             WHERE rc.reel_id = ?
             ORDER BY rc.created_at ASC`,
            [reelId]
        );
        return res.json({ success: true, comments });
    } catch (error) {
        next(error);
    }
}

// Delete Reel
async function deleteReel(req, res, next) {
    try {
        const reelId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const reels = await query('SELECT user_id FROM reels WHERE reel_id = ?', [reelId]);
        if (reels.length === 0) return res.status(404).json({ success: false, message: 'Reel not found.' });
        if (reels[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        await query('DELETE FROM reels WHERE reel_id = ?', [reelId]);
        return res.json({ success: true, message: 'Reel deleted.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    uploadReel,
    getReels,
    incrementView,
    toggleReelLike,
    addReelComment,
    getReelComments,
    deleteReel
};
