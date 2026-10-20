const { query } = require('../config/db');

// Multi-entity search (Users, Hashtags, Locations)
async function searchAll(req, res, next) {
    try {
        const q = req.query.q ? req.query.q.trim() : '';
        const currentUserId = req.user ? req.user.user_id : null;

        if (!q || q.length < 1) {
            return res.json({ success: true, users: [], hashtags: [], locations: [] });
        }

        const searchTerm = `%${q}%`;
        const prefixTerm = `${q}%`;

        // 1. Search Users
        const users = await query(
            `SELECT u.user_id, u.username, u.full_name, u.avatar_url, u.is_verified, u.is_private,
                    EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = u.user_id AND f.status = 'accepted') AS is_following
             FROM users u
             WHERE (u.username LIKE ? OR u.full_name LIKE ?)
               AND u.is_active = TRUE
               ${currentUserId ? 'AND u.user_id <> ' + currentUserId : ''}
             ORDER BY 
                 CASE WHEN u.username LIKE ? THEN 1 ELSE 2 END,
                 u.is_verified DESC,
                 u.username ASC
             LIMIT 10`,
            [currentUserId, searchTerm, searchTerm, prefixTerm]
        );

        // 2. Search Hashtags
        const hashtags = await query(
            `SELECT h.hashtag_id, h.name, COUNT(ph.post_id) AS post_count
             FROM hashtags h
             LEFT JOIN post_hashtags ph ON h.hashtag_id = ph.hashtag_id
             WHERE h.name LIKE ?
             GROUP BY h.hashtag_id, h.name
             ORDER BY 
                 CASE WHEN h.name LIKE ? THEN 1 ELSE 2 END,
                 post_count DESC
             LIMIT 10`,
            [searchTerm, prefixTerm]
        );

        // 3. Search Locations
        const locations = await query(
            `SELECT l.location_id, l.name, l.city, l.country, COUNT(p.post_id) AS post_count
             FROM locations l
             LEFT JOIN posts p ON l.location_id = p.location_id
             WHERE l.name LIKE ? OR l.city LIKE ? OR l.country LIKE ?
             GROUP BY l.location_id, l.name, l.city, l.country
             ORDER BY post_count DESC
             LIMIT 10`,
            [searchTerm, searchTerm, searchTerm]
        );

        return res.json({
            success: true,
            users,
            hashtags,
            locations
        });
    } catch (error) {
        next(error);
    }
}

// Save recent search
async function saveSearch(req, res, next) {
    try {
        const userId = req.user.user_id;
        const { search_type, target_id, query_text } = req.body;

        if (!search_type || !query_text) {
            return res.status(400).json({ success: false, message: 'Invalid search record.' });
        }

        await query(
            `INSERT INTO search_history (user_id, search_type, target_id, query_text) 
             VALUES (?, ?, ?, ?)`,
            [userId, search_type, target_id || null, query_text.trim()]
        );

        return res.json({ success: true });
    } catch (error) {
        next(error);
    }
}

// Get recent searches
async function getRecentSearches(req, res, next) {
    try {
        const userId = req.user.user_id;

        const history = await query(
            `SELECT sh.*, u.username, u.full_name, u.avatar_url, u.is_verified
             FROM search_history sh
             LEFT JOIN users u ON sh.search_type = 'user' AND sh.target_id = u.user_id
             WHERE sh.user_id = ?
             ORDER BY sh.searched_at DESC
             LIMIT 15`,
            [userId]
        );

        return res.json({ success: true, history });
    } catch (error) {
        next(error);
    }
}

// Clear all search history
async function clearSearchHistory(req, res, next) {
    try {
        await query('DELETE FROM search_history WHERE user_id = ?', [req.user.user_id]);
        return res.json({ success: true, message: 'Search history cleared.' });
    } catch (error) {
        next(error);
    }
}

// Delete single search history item
async function removeSearchItem(req, res, next) {
    try {
        const searchId = parseInt(req.params.id, 10);
        await query('DELETE FROM search_history WHERE search_id = ? AND user_id = ?', [searchId, req.user.user_id]);
        return res.json({ success: true, message: 'Search item removed.' });
    } catch (error) {
        next(error);
    }
}

// Get suggested users to follow (friends of friends algorithm)
async function getSuggestedUsers(req, res, next) {
    try {
        const currentUserId = req.user ? req.user.user_id : 0;

        const suggestions = await query(
            `WITH user_following AS (
                 SELECT following_id FROM follows WHERE follower_id = ? AND status = 'accepted'
             ),
             friends_of_friends AS (
                 SELECT f.following_id AS suggested_id, COUNT(*) AS mutual_count
                 FROM follows f
                 WHERE f.follower_id IN (SELECT following_id FROM user_following)
                   AND f.following_id <> ?
                   AND f.following_id NOT IN (SELECT following_id FROM user_following)
                   AND f.status = 'accepted'
                 GROUP BY f.following_id
             )
             SELECT u.user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
                    COALESCE(fof.mutual_count, 0) AS mutual_count
             FROM users u
             LEFT JOIN friends_of_friends fof ON u.user_id = fof.suggested_id
             WHERE u.user_id <> ? 
               AND u.user_id NOT IN (SELECT following_id FROM user_following)
               AND u.is_active = TRUE
             ORDER BY COALESCE(fof.mutual_count, 0) DESC, u.is_verified DESC
             LIMIT 6`,
            [currentUserId, currentUserId, currentUserId]
        );

        return res.json({ success: true, suggestions });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    searchAll,
    saveSearch,
    getRecentSearches,
    clearSearchHistory,
    removeSearchItem,
    getSuggestedUsers
};
