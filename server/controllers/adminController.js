const { query } = require('../config/db');
const { logAction } = require('../utils/auditLogger');

// Get high-level platform analytics & metrics
async function getMetrics(req, res, next) {
    try {
        const [counts] = await query(
            `SELECT 
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS active_users,
                (SELECT COUNT(*) FROM posts WHERE is_archived = FALSE) AS total_posts,
                (SELECT COUNT(*) FROM reels) AS total_reels,
                (SELECT COUNT(*) FROM comments) AS total_comments,
                (SELECT COUNT(*) FROM post_likes) + (SELECT COUNT(*) FROM reel_likes) AS total_likes,
                (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pending_reports`
        );

        // Daily activity metrics (last 7 days posts)
        const dailyActivity = await query(
            `SELECT 
                DATE(created_at) AS date,
                COUNT(*) AS posts_count
             FROM posts
             WHERE created_at >= NOW() - INTERVAL 7 DAY
             GROUP BY DATE(created_at)
             ORDER BY date ASC`
        );

        return res.json({
            success: true,
            metrics: counts,
            daily_activity: dailyActivity
        });
    } catch (error) {
        next(error);
    }
}

// Get all moderation reports
async function getReports(req, res, next) {
    try {
        const status = req.query.status || 'pending';
        const reports = await query(
            `SELECT 
                r.*,
                reporter.username AS reporter_username,
                reporter.avatar_url AS reporter_avatar,
                reviewer.username AS reviewer_username
             FROM reports r
             JOIN users reporter ON r.reporter_id = reporter.user_id
             LEFT JOIN users reviewer ON r.reviewed_by = reviewer.user_id
             WHERE ${status === 'all' ? '1=1' : 'r.status = ?'}
             ORDER BY r.created_at DESC`,
            status === 'all' ? [] : [status]
        );

        return res.json({ success: true, reports });
    } catch (error) {
        next(error);
    }
}

// Update report status
async function updateReportStatus(req, res, next) {
    try {
        const reportId = parseInt(req.params.id, 10);
        const { status } = req.body;
        const adminId = req.user.user_id;

        const validStatuses = ['pending', 'reviewed', 'dismissed', 'action_taken'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid report status.' });
        }

        await query(
            'UPDATE reports SET status = ?, reviewed_by = ? WHERE report_id = ?',
            [status, adminId, reportId]
        );

        return res.json({ success: true, message: 'Report status updated.' });
    } catch (error) {
        next(error);
    }
}

// Remove offensive content directly from moderation panel
async function removeContent(req, res, next) {
    try {
        const { target_type, target_id, report_id } = req.body;
        const adminId = req.user.user_id;

        if (target_type === 'post') {
            await query('DELETE FROM posts WHERE post_id = ?', [target_id]);
        } else if (target_type === 'comment') {
            await query('DELETE FROM comments WHERE comment_id = ?', [target_id]);
        } else if (target_type === 'reel') {
            await query('DELETE FROM reels WHERE reel_id = ?', [target_id]);
        }

        if (report_id) {
            await query(
                'UPDATE reports SET status = \'action_taken\', reviewed_by = ? WHERE report_id = ?',
                [adminId, report_id]
            );
        }

        await logAction('ADMIN_DELETE_CONTENT', target_type, target_id, adminId);

        return res.json({ success: true, message: 'Content removed successfully.' });
    } catch (error) {
        next(error);
    }
}

// Toggle user deactivation status (Ban / Unban)
async function toggleUserStatus(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);
        const adminId = req.user.user_id;

        const users = await query('SELECT is_active, username FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

        const newState = !users[0].is_active;
        await query('UPDATE users SET is_active = ? WHERE user_id = ?', [newState, userId]);

        await logAction(newState ? 'ADMIN_REACTIVATE_USER' : 'ADMIN_BAN_USER', 'users', userId, adminId);

        return res.json({
            success: true,
            message: newState ? 'User reactivated.' : 'User banned / deactivated.',
            is_active: newState
        });
    } catch (error) {
        next(error);
    }
}

// Verify user badge
async function verifyUser(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);
        const users = await query('SELECT is_verified FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

        const newState = !users[0].is_verified;
        await query('UPDATE users SET is_verified = ? WHERE user_id = ?', [newState, userId]);

        return res.json({
            success: true,
            message: newState ? 'User verified with badge.' : 'User verification removed.',
            is_verified: newState
        });
    } catch (error) {
        next(error);
    }
}

// Get recent trigger audit logs
async function getAuditLogs(req, res, next) {
    try {
        const logs = await query(
            `SELECT al.*, u.username AS performed_by_username
             FROM audit_logs al
             LEFT JOIN users u ON al.performed_by = u.user_id
             ORDER BY al.logged_at DESC
             LIMIT 50`
        );
        return res.json({ success: true, logs });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getMetrics,
    getReports,
    updateReportStatus,
    removeContent,
    toggleUserStatus,
    verifyUser,
    getAuditLogs
};
