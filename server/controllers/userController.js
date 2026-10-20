const { query, withTransaction } = require('../config/db');
const { logAction } = require('../utils/auditLogger');

// Get profile by username
async function getProfile(req, res, next) {
    try {
        const { username } = req.params;
        const currentUserId = req.user ? req.user.user_id : null;

        const users = await query(
            `SELECT user_id, username, full_name, bio, website, avatar_url, gender, 
                    is_private, is_verified, is_active, role, created_at
             FROM users WHERE username = ?`,
            [username.toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const profileUser = users[0];

        // Check if current user is blocked or has blocked profileUser
        if (currentUserId && currentUserId !== profileUser.user_id) {
            const blockCheck = await query(
                `SELECT 1 FROM blocks 
                 WHERE (blocker_id = ? AND blocked_id = ?) 
                    OR (blocker_id = ? AND blocked_id = ?)`,
                [currentUserId, profileUser.user_id, profileUser.user_id, currentUserId]
            );

            if (blockCheck.length > 0) {
                return res.status(403).json({
                    success: false,
                    message: 'User is not available.',
                    is_blocked: true
                });
            }
        }

        // Aggregate statistics (posts, followers, following)
        const stats = await query(
            `SELECT 
                (SELECT COUNT(*) FROM posts WHERE user_id = ? AND is_archived = FALSE) AS posts_count,
                (SELECT COUNT(*) FROM follows WHERE following_id = ? AND status = 'accepted') AS followers_count,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND status = 'accepted') AS following_count`,
            [profileUser.user_id, profileUser.user_id, profileUser.user_id]
        );

        // Check relationship between current user and profile user
        let relationship = {
            is_me: currentUserId === profileUser.user_id,
            following_status: 'none', // 'none', 'following', 'pending'
            is_follower: false,
            is_close_friend: false,
            is_muted: false,
            is_blocked: false
        };

        if (currentUserId && !relationship.is_me) {
            const followRow = await query(
                'SELECT status FROM follows WHERE follower_id = ? AND following_id = ?',
                [currentUserId, profileUser.user_id]
            );
            if (followRow.length > 0) {
                relationship.following_status = followRow[0].status;
            }

            const isFollowerRow = await query(
                'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? AND status = \'accepted\'',
                [profileUser.user_id, currentUserId]
            );
            relationship.is_follower = isFollowerRow.length > 0;

            const closeFriendRow = await query(
                'SELECT 1 FROM close_friends WHERE user_id = ? AND friend_id = ?',
                [currentUserId, profileUser.user_id]
            );
            relationship.is_close_friend = closeFriendRow.length > 0;

            const muteRow = await query(
                'SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ?',
                [currentUserId, profileUser.user_id]
            );
            relationship.is_muted = muteRow.length > 0;
        }

        // Determine if posts can be viewed
        const canViewContent = relationship.is_me || 
                              !profileUser.is_private || 
                              relationship.following_status === 'accepted';

        // Fetch user highlights
        const highlights = await query(
            'SELECT highlight_id, title, cover_image_url FROM highlights WHERE user_id = ? ORDER BY created_at DESC',
            [profileUser.user_id]
        );

        return res.json({
            success: true,
            user: {
                ...profileUser,
                posts_count: stats[0].posts_count,
                followers_count: stats[0].followers_count,
                following_count: stats[0].following_count,
                relationship,
                can_view_content: canViewContent,
                highlights
            }
        });
    } catch (error) {
        next(error);
    }
}

// Update profile details
async function updateProfile(req, res, next) {
    try {
        const userId = req.user.user_id;
        const { full_name, bio, website, gender, is_private } = req.body;

        await query(
            `UPDATE users 
             SET full_name = COALESCE(?, full_name),
                 bio = ?,
                 website = ?,
                 gender = COALESCE(?, gender),
                 is_private = COALESCE(?, is_private)
             WHERE user_id = ?`,
            [
                full_name ? full_name.trim() : null,
                bio !== undefined ? bio.trim() : null,
                website !== undefined ? website.trim() : null,
                gender || null,
                is_private !== undefined ? Boolean(is_private) : null,
                userId
            ]
        );

        await logAction('UPDATE_PROFILE', 'users', userId, userId);

        return res.json({
            success: true,
            message: 'Profile updated successfully.'
        });
    } catch (error) {
        next(error);
    }
}

// Upload/update avatar
async function updateAvatar(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file uploaded.' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        await query('UPDATE users SET avatar_url = ? WHERE user_id = ?', [avatarUrl, req.user.user_id]);

        return res.json({
            success: true,
            message: 'Avatar updated successfully.',
            avatar_url: avatarUrl
        });
    } catch (error) {
        next(error);
    }
}

// Follow or request follow
async function followUser(req, res, next) {
    try {
        const followerId = req.user.user_id;
        const targetId = parseInt(req.params.id, 10);

        if (followerId === targetId) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself.' });
        }

        // Check if target user exists and active
        const targets = await query('SELECT user_id, is_private, is_active FROM users WHERE user_id = ?', [targetId]);
        if (targets.length === 0 || !targets[0].is_active) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const target = targets[0];
        const status = target.is_private ? 'pending' : 'accepted';

        await query(
            `INSERT INTO follows (follower_id, following_id, status) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [followerId, targetId, status]
        );

        return res.json({
            success: true,
            message: status === 'pending' ? 'Follow request sent.' : 'Followed successfully.',
            status: status === 'pending' ? 'pending' : 'following'
        });
    } catch (error) {
        next(error);
    }
}

// Unfollow user
async function unfollowUser(req, res, next) {
    try {
        const followerId = req.user.user_id;
        const targetId = parseInt(req.params.id, 10);

        await query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, targetId]);

        return res.json({
            success: true,
            message: 'Unfollowed successfully.',
            status: 'none'
        });
    } catch (error) {
        next(error);
    }
}

// Accept follow request
async function acceptFollowRequest(req, res, next) {
    try {
        const targetId = req.user.user_id;
        const followerId = parseInt(req.params.id, 10);

        await query(
            'UPDATE follows SET status = \'accepted\' WHERE follower_id = ? AND following_id = ?',
            [followerId, targetId]
        );

        return res.json({ success: true, message: 'Follow request accepted.' });
    } catch (error) {
        next(error);
    }
}

// Reject follow request
async function rejectFollowRequest(req, res, next) {
    try {
        const targetId = req.user.user_id;
        const followerId = parseInt(req.params.id, 10);

        await query(
            'DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = \'pending\'',
            [followerId, targetId]
        );

        return res.json({ success: true, message: 'Follow request rejected.' });
    } catch (error) {
        next(error);
    }
}

// Remove follower
async function removeFollower(req, res, next) {
    try {
        const myId = req.user.user_id;
        const followerId = parseInt(req.params.id, 10);

        await query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, myId]);

        return res.json({ success: true, message: 'Follower removed.' });
    } catch (error) {
        next(error);
    }
}

// Get user followers
async function getFollowers(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);
        const currentUserId = req.user ? req.user.user_id : null;

        const rows = await query(
            `SELECT u.user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
                    EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = ? AND f2.following_id = u.user_id AND f2.status = 'accepted') AS is_following
             FROM follows f
             JOIN users u ON f.follower_id = u.user_id
             WHERE f.following_id = ? AND f.status = 'accepted' AND u.is_active = TRUE`,
            [currentUserId, userId]
        );

        return res.json({ success: true, followers: rows });
    } catch (error) {
        next(error);
    }
}

// Get user following
async function getFollowing(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);
        const currentUserId = req.user ? req.user.user_id : null;

        const rows = await query(
            `SELECT u.user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
                    EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = ? AND f2.following_id = u.user_id AND f2.status = 'accepted') AS is_following
             FROM follows f
             JOIN users u ON f.following_id = u.user_id
             WHERE f.follower_id = ? AND f.status = 'accepted' AND u.is_active = TRUE`,
            [currentUserId, userId]
        );

        return res.json({ success: true, following: rows });
    } catch (error) {
        next(error);
    }
}

// Close friends management
async function getCloseFriends(req, res, next) {
    try {
        const rows = await query(
            `SELECT u.user_id, u.username, u.full_name, u.avatar_url 
             FROM close_friends cf
             JOIN users u ON cf.friend_id = u.user_id
             WHERE cf.user_id = ?`,
            [req.user.user_id]
        );
        return res.json({ success: true, close_friends: rows });
    } catch (error) {
        next(error);
    }
}

async function addCloseFriend(req, res, next) {
    try {
        const friendId = parseInt(req.params.id, 10);
        await query(
            'INSERT IGNORE INTO close_friends (user_id, friend_id) VALUES (?, ?)',
            [req.user.user_id, friendId]
        );
        return res.json({ success: true, message: 'Added to Close Friends.' });
    } catch (error) {
        next(error);
    }
}

async function removeCloseFriend(req, res, next) {
    try {
        const friendId = parseInt(req.params.id, 10);
        await query('DELETE FROM close_friends WHERE user_id = ? AND friend_id = ?', [req.user.user_id, friendId]);
        return res.json({ success: true, message: 'Removed from Close Friends.' });
    } catch (error) {
        next(error);
    }
}

// Block and Unblock
async function blockUser(req, res, next) {
    try {
        const blockerId = req.user.user_id;
        const blockedId = parseInt(req.params.id, 10);

        if (blockerId === blockedId) {
            return res.status(400).json({ success: false, message: 'You cannot block yourself.' });
        }

        await withTransaction(async (conn) => {
            // Remove any follow relationships both ways
            await conn.execute('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)', [blockerId, blockedId, blockedId, blockerId]);
            // Insert block
            await conn.execute('INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', [blockerId, blockedId]);
        });

        await logAction('BLOCK', 'users', blockedId, blockerId);

        return res.json({ success: true, message: 'User blocked.' });
    } catch (error) {
        next(error);
    }
}

async function unblockUser(req, res, next) {
    try {
        const blockerId = req.user.user_id;
        const blockedId = parseInt(req.params.id, 10);

        await query('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, blockedId]);
        return res.json({ success: true, message: 'User unblocked.' });
    } catch (error) {
        next(error);
    }
}

async function getBlockedUsers(req, res, next) {
    try {
        const rows = await query(
            `SELECT u.user_id, u.username, u.full_name, u.avatar_url 
             FROM blocks b
             JOIN users u ON b.blocked_id = u.user_id
             WHERE b.blocker_id = ?`,
            [req.user.user_id]
        );
        return res.json({ success: true, blocked_users: rows });
    } catch (error) {
        next(error);
    }
}

// Mute and Unmute
async function muteUser(req, res, next) {
    try {
        const muterId = req.user.user_id;
        const mutedId = parseInt(req.params.id, 10);
        const { mute_posts = true, mute_stories = true } = req.body;

        await query(
            `INSERT INTO mutes (muter_id, muted_id, mute_posts, mute_stories)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE mute_posts = VALUES(mute_posts), mute_stories = VALUES(mute_stories)`,
            [muterId, mutedId, Boolean(mute_posts), Boolean(mute_stories)]
        );

        return res.json({ success: true, message: 'User muted.' });
    } catch (error) {
        next(error);
    }
}

async function unmuteUser(req, res, next) {
    try {
        await query('DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?', [req.user.user_id, parseInt(req.params.id, 10)]);
        return res.json({ success: true, message: 'User unmuted.' });
    } catch (error) {
        next(error);
    }
}

// Settings
async function getSettings(req, res, next) {
    try {
        const rows = await query('SELECT * FROM user_settings WHERE user_id = ?', [req.user.user_id]);
        return res.json({ success: true, settings: rows[0] || {} });
    } catch (error) {
        next(error);
    }
}

async function updateSettings(req, res, next) {
    try {
        const { theme, allow_tags_from, allow_mentions_from, email_notifications, push_notifications } = req.body;
        await query(
            `UPDATE user_settings 
             SET theme = COALESCE(?, theme),
                 allow_tags_from = COALESCE(?, allow_tags_from),
                 allow_mentions_from = COALESCE(?, allow_mentions_from),
                 email_notifications = COALESCE(?, email_notifications),
                 push_notifications = COALESCE(?, push_notifications)
             WHERE user_id = ?`,
            [theme, allow_tags_from, allow_mentions_from, email_notifications, push_notifications, req.user.user_id]
        );
        return res.json({ success: true, message: 'Settings saved.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProfile,
    updateProfile,
    updateAvatar,
    followUser,
    unfollowUser,
    acceptFollowRequest,
    rejectFollowRequest,
    removeFollower,
    getFollowers,
    getFollowing,
    getCloseFriends,
    addCloseFriend,
    removeCloseFriend,
    blockUser,
    unblockUser,
    getBlockedUsers,
    muteUser,
    unmuteUser,
    getSettings,
    updateSettings
};
