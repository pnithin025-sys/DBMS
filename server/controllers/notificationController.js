const { query } = require('../config/db');

// Get notifications for current user
async function getNotifications(req, res, next) {
    try {
        const userId = req.user.user_id;

        const notifications = await query(
            `SELECT 
                n.notification_id,
                n.recipient_id,
                n.actor_id,
                n.type,
                n.entity_id,
                n.entity_type,
                n.is_read,
                n.created_at,
                u.username AS actor_username,
                u.full_name AS actor_name,
                u.avatar_url AS actor_avatar,
                u.is_verified AS actor_verified,
                pm.media_url AS post_preview_media
             FROM notifications n
             JOIN users u ON n.actor_id = u.user_id
             LEFT JOIN post_media pm ON n.entity_type = 'post' AND pm.post_id = n.entity_id AND pm.carousel_order = 1
             WHERE n.recipient_id = ?
             ORDER BY n.created_at DESC
             LIMIT 50`,
            [userId]
        );

        return res.json({ success: true, notifications });
    } catch (error) {
        next(error);
    }
}

// Mark single notification as read
async function markAsRead(req, res, next) {
    try {
        const notifId = parseInt(req.params.id, 10);
        await query(
            'UPDATE notifications SET is_read = TRUE WHERE notification_id = ? AND recipient_id = ?',
            [notifId, req.user.user_id]
        );
        return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
        next(error);
    }
}

// Mark all as read
async function markAllAsRead(req, res, next) {
    try {
        await query('UPDATE notifications SET is_read = TRUE WHERE recipient_id = ?', [req.user.user_id]);
        return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
        next(error);
    }
}

// Get unread notification badge count
async function getUnreadCount(req, res, next) {
    try {
        const [row] = await query(
            'SELECT COUNT(*) AS unread_count FROM notifications WHERE recipient_id = ? AND is_read = FALSE',
            [req.user.user_id]
        );
        return res.json({ success: true, unread_count: row.unread_count || 0 });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount
};
