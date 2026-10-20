const { query, withTransaction } = require('../config/db');
const { logAction } = require('../utils/auditLogger');

// Create post (supports multi-image carousel up to 10, or single video)
async function createPost(req, res, next) {
    try {
        const userId = req.user.user_id;
        const { caption, location_name, location_city, hide_likes, comments_disabled, tagged_users } = req.body;

        // Check uploaded files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'Please upload at least one image or video.' });
        }

        if (req.files.length > 10) {
            return res.status(400).json({ success: false, message: 'Maximum 10 carousel media items allowed per post.' });
        }

        let newPostId;

        await withTransaction(async (conn) => {
            // 1. Resolve Location if provided
            let locationId = null;
            if (location_name && location_name.trim().length > 0) {
                const locName = location_name.trim();
                const locCity = location_city ? location_city.trim() : null;

                const [existingLoc] = await conn.execute(
                    'SELECT location_id FROM locations WHERE name = ? AND (city = ? OR (city IS NULL AND ? IS NULL))',
                    [locName, locCity, locCity]
                );

                if (existingLoc.length > 0) {
                    locationId = existingLoc[0].location_id;
                } else {
                    const [newLoc] = await conn.execute(
                        'INSERT INTO locations (name, city) VALUES (?, ?)',
                        [locName, locCity]
                    );
                    locationId = newLoc.insertId;
                }
            }

            // 2. Insert Post record
            const [postResult] = await conn.execute(
                `INSERT INTO posts (user_id, location_id, caption, hide_likes, comments_disabled) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    userId,
                    locationId,
                    caption ? caption.trim() : null,
                    Boolean(hide_likes),
                    Boolean(comments_disabled)
                ]
            );
            newPostId = postResult.insertId;

            // 3. Insert Post Media (Carousel items)
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const isVideo = file.mimetype.startsWith('video');
                const mediaUrl = `/uploads/posts/${file.filename}`;

                await conn.execute(
                    `INSERT INTO post_media (post_id, media_type, media_url, carousel_order) 
                     VALUES (?, ?, ?, ?)`,
                    [newPostId, isVideo ? 'video' : 'image', mediaUrl, i + 1]
                );
            }

            // 4. Parse & link hashtags (#tag)
            if (caption) {
                const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
                let match;
                const foundTags = new Set();
                while ((match = hashtagRegex.exec(caption)) !== null) {
                    foundTags.add(match[1].toLowerCase());
                }

                for (const tag of foundTags) {
                    // Insert hashtag if not exists
                    await conn.execute(
                        'INSERT INTO hashtags (name) VALUES (?) ON DUPLICATE KEY UPDATE hashtag_id = LAST_INSERT_ID(hashtag_id)',
                        [tag]
                    );
                    const [tagRows] = await conn.execute('SELECT hashtag_id FROM hashtags WHERE name = ?', [tag]);
                    if (tagRows.length > 0) {
                        const tagId = tagRows[0].hashtag_id;
                        await conn.execute(
                            'INSERT IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)',
                            [newPostId, tagId]
                        );
                    }
                }

                // 5. Parse & record @mentions
                const mentionRegex = /@([a-zA-Z0-9_]+)/g;
                let mentionMatch;
                const foundMentions = new Set();
                while ((mentionMatch = mentionRegex.exec(caption)) !== null) {
                    foundMentions.add(mentionMatch[1].toLowerCase());
                }

                for (const mentionUsername of foundMentions) {
                    const [userRows] = await conn.execute(
                        'SELECT user_id FROM users WHERE username = ? AND is_active = TRUE',
                        [mentionUsername]
                    );
                    if (userRows.length > 0) {
                        const mentionedId = userRows[0].user_id;
                        await conn.execute(
                            'INSERT INTO mentions (mentioned_user_id, source_type, source_id) VALUES (?, \'post\', ?)',
                            [mentionedId, newPostId]
                        );
                        // Trigger notification
                        if (mentionedId !== userId) {
                            await conn.execute(
                                'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'mention\', ?, \'post\')',
                                [mentionedId, userId, newPostId]
                            );
                        }
                    }
                }
            }

            // 6. Handle tagged users
            if (tagged_users) {
                try {
                    const parsedTags = typeof tagged_users === 'string' ? JSON.parse(tagged_users) : tagged_users;
                    if (Array.isArray(parsedTags)) {
                        for (const item of parsedTags) {
                            if (item.user_id) {
                                await conn.execute(
                                    `INSERT IGNORE INTO post_tags (post_id, user_id, x_percent, y_percent) 
                                     VALUES (?, ?, ?, ?)`,
                                    [newPostId, item.user_id, item.x || 50, item.y || 50]
                                );
                                if (item.user_id !== userId) {
                                    await conn.execute(
                                        'INSERT INTO notifications (recipient_id, actor_id, type, entity_id, entity_type) VALUES (?, ?, \'tag\', ?, \'post\')',
                                        [item.user_id, userId, newPostId]
                                    );
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Failed parsing tagged_users JSON:', e.message);
                }
            }
        });

        await logAction('CREATE', 'posts', newPostId, userId);

        return res.status(201).json({
            success: true,
            message: 'Post published successfully!',
            post_id: newPostId
        });
    } catch (error) {
        next(error);
    }
}

// Get paginated Home Feed (followed users + own posts)
async function getFeed(req, res, next) {
    try {
        const userId = req.user.user_id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const posts = await query(
            `SELECT 
                p.post_id,
                p.user_id,
                u.username,
                u.full_name,
                u.avatar_url,
                u.is_verified,
                p.caption,
                p.location_id,
                l.name AS location_name,
                l.city AS location_city,
                p.hide_likes,
                p.comments_disabled,
                p.created_at,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count,
                EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.post_id AND pl.user_id = ?) AS is_liked_by_me,
                EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.post_id AND sp.user_id = ?) AS is_saved_by_me
             FROM posts p
             JOIN users u ON p.user_id = u.user_id
             LEFT JOIN locations l ON p.location_id = l.location_id
             WHERE (
                 p.user_id = ? 
                 OR p.user_id IN (
                     SELECT following_id FROM follows WHERE follower_id = ? AND status = 'accepted'
                 )
             )
             AND p.is_archived = FALSE
             AND u.is_active = TRUE
             AND NOT EXISTS (
                 SELECT 1 FROM blocks b 
                 WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id) 
                    OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
             )
             AND NOT EXISTS (
                 SELECT 1 FROM mutes m 
                 WHERE m.muter_id = ? AND m.muted_id = p.user_id AND m.mute_posts = TRUE
             )
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, userId, userId, userId, userId, userId, userId, limit, offset]
        );

        // Populate media for each post
        for (const post of posts) {
            post.media = await query(
                'SELECT media_id, media_type, media_url, carousel_order, aspect_ratio FROM post_media WHERE post_id = ? ORDER BY carousel_order ASC',
                [post.post_id]
            );
        }

        return res.json({
            success: true,
            posts,
            page,
            has_more: posts.length === limit
        });
    } catch (error) {
        next(error);
    }
}

// Get explore grid (trending posts from non-followed/public creators)
async function getExplore(req, res, next) {
    try {
        const userId = req.user ? req.user.user_id : null;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const posts = await query(
            `SELECT 
                p.post_id,
                p.user_id,
                u.username,
                u.avatar_url,
                u.is_verified,
                p.caption,
                p.created_at,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count,
                (SELECT media_url FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_url,
                (SELECT media_type FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_type,
                (SELECT COUNT(*) FROM post_media pm WHERE pm.post_id = p.post_id) AS media_count
             FROM posts p
             JOIN users u ON p.user_id = u.user_id
             WHERE p.is_archived = FALSE
               AND u.is_private = FALSE
               AND u.is_active = TRUE
               ${userId ? 'AND p.user_id <> ' + userId : ''}
             ORDER BY (likes_count * 2 + comments_count * 3) DESC, p.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return res.json({
            success: true,
            posts,
            page,
            has_more: posts.length === limit
        });
    } catch (error) {
        next(error);
    }
}

// Get post detail modal by ID
async function getPostById(req, res, next) {
    try {
        const postId = parseInt(req.params.id, 10);
        const currentUserId = req.user ? req.user.user_id : null;

        const posts = await query(
            `SELECT 
                p.post_id,
                p.user_id,
                u.username,
                u.full_name,
                u.avatar_url,
                u.is_verified,
                u.is_private,
                p.caption,
                p.location_id,
                l.name AS location_name,
                l.city AS location_city,
                p.hide_likes,
                p.comments_disabled,
                p.is_archived,
                p.created_at,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count,
                EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.post_id AND pl.user_id = ?) AS is_liked_by_me,
                EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.post_id AND sp.user_id = ?) AS is_saved_by_me
             FROM posts p
             JOIN users u ON p.user_id = u.user_id
             LEFT JOIN locations l ON p.location_id = l.location_id
             WHERE p.post_id = ?`,
            [currentUserId, currentUserId, postId]
        );

        if (posts.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        const post = posts[0];

        // Fetch media items
        post.media = await query(
            'SELECT media_id, media_type, media_url, carousel_order, aspect_ratio FROM post_media WHERE post_id = ? ORDER BY carousel_order ASC',
            [postId]
        );

        // Fetch tagged users
        post.tags = await query(
            `SELECT pt.tag_id, pt.x_percent, pt.y_percent, u.user_id, u.username, u.full_name, u.avatar_url
             FROM post_tags pt
             JOIN users u ON pt.user_id = u.user_id
             WHERE pt.post_id = ?`,
            [postId]
        );

        return res.json({ success: true, post });
    } catch (error) {
        next(error);
    }
}

// Get user posts for profile
async function getPostsByUser(req, res, next) {
    try {
        const { username } = req.params;
        const currentUserId = req.user ? req.user.user_id : null;
        const type = req.query.type || 'posts'; // 'posts', 'saved', 'tagged'

        const users = await query('SELECT user_id, is_private FROM users WHERE username = ?', [username.toLowerCase()]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const targetUser = users[0];
        const isMe = currentUserId === targetUser.user_id;

        // Check privacy
        if (!isMe && targetUser.is_private) {
            const follow = await query(
                'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? AND status = \'accepted\'',
                [currentUserId, targetUser.user_id]
            );
            if (follow.length === 0) {
                return res.status(403).json({ success: false, message: 'This account is private.' });
            }
        }

        let posts = [];

        if (type === 'posts') {
            posts = await query(
                `SELECT 
                    p.post_id,
                    p.caption,
                    p.created_at,
                    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count,
                    (SELECT media_url FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_url,
                    (SELECT media_type FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_type,
                    (SELECT COUNT(*) FROM post_media pm WHERE pm.post_id = p.post_id) AS media_count
                 FROM posts p
                 WHERE p.user_id = ? AND ${isMe ? '1=1' : 'p.is_archived = FALSE'}
                 ORDER BY p.created_at DESC`,
                [targetUser.user_id]
            );
        } else if (type === 'saved' && isMe) {
            posts = await query(
                `SELECT 
                    p.post_id,
                    p.caption,
                    p.created_at,
                    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count,
                    (SELECT media_url FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_url,
                    (SELECT media_type FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_type
                 FROM saved_posts sp
                 JOIN posts p ON sp.post_id = p.post_id
                 WHERE sp.user_id = ?
                 ORDER BY sp.created_at DESC`,
                [currentUserId]
            );
        } else if (type === 'tagged') {
            posts = await query(
                `SELECT 
                    p.post_id,
                    p.caption,
                    p.created_at,
                    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count,
                    (SELECT media_url FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_url,
                    (SELECT media_type FROM post_media pm WHERE pm.post_id = p.post_id AND pm.carousel_order = 1) AS primary_media_type
                 FROM post_tags pt
                 JOIN posts p ON pt.post_id = p.post_id
                 WHERE pt.user_id = ? AND p.is_archived = FALSE
                 ORDER BY pt.created_at DESC`,
                [targetUser.user_id]
            );
        }

        return res.json({ success: true, posts });
    } catch (error) {
        next(error);
    }
}

// Update post caption
async function updateCaption(req, res, next) {
    try {
        const postId = parseInt(req.params.id, 10);
        const { caption } = req.body;
        const userId = req.user.user_id;

        const posts = await query('SELECT user_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ success: false, message: 'Post not found.' });
        if (posts[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        await query('UPDATE posts SET caption = ? WHERE post_id = ?', [caption ? caption.trim() : null, postId]);
        return res.json({ success: true, message: 'Caption updated.' });
    } catch (error) {
        next(error);
    }
}

// Delete post
async function deletePost(req, res, next) {
    try {
        const postId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const posts = await query('SELECT user_id, caption FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ success: false, message: 'Post not found.' });
        if (posts[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        await query('DELETE FROM posts WHERE post_id = ?', [postId]);
        return res.json({ success: true, message: 'Post deleted successfully.' });
    } catch (error) {
        next(error);
    }
}

// Archive / Unarchive post
async function toggleArchive(req, res, next) {
    try {
        const postId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const posts = await query('SELECT is_archived, user_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ success: false, message: 'Post not found.' });
        if (posts[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Unauthorized.' });

        const newState = !posts[0].is_archived;
        await query('UPDATE posts SET is_archived = ? WHERE post_id = ?', [newState, postId]);

        return res.json({
            success: true,
            message: newState ? 'Post archived.' : 'Post unarchived.',
            is_archived: newState
        });
    } catch (error) {
        next(error);
    }
}

// Toggle comments disabled
async function toggleComments(req, res, next) {
    try {
        const postId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const posts = await query('SELECT comments_disabled, user_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ success: false, message: 'Post not found.' });
        if (posts[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Unauthorized.' });

        const newState = !posts[0].comments_disabled;
        await query('UPDATE posts SET comments_disabled = ? WHERE post_id = ?', [newState, postId]);

        return res.json({
            success: true,
            message: newState ? 'Comments turned off.' : 'Comments turned on.',
            comments_disabled: newState
        });
    } catch (error) {
        next(error);
    }
}

// Toggle hide like count
async function toggleHideLikes(req, res, next) {
    try {
        const postId = parseInt(req.params.id, 10);
        const userId = req.user.user_id;

        const posts = await query('SELECT hide_likes, user_id FROM posts WHERE post_id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ success: false, message: 'Post not found.' });
        if (posts[0].user_id !== userId) return res.status(403).json({ success: false, message: 'Unauthorized.' });

        const newState = !posts[0].hide_likes;
        await query('UPDATE posts SET hide_likes = ? WHERE post_id = ?', [newState, postId]);

        return res.json({
            success: true,
            message: newState ? 'Like counts hidden.' : 'Like counts unhidden.',
            hide_likes: newState
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createPost,
    getFeed,
    getExplore,
    getPostById,
    getPostsByUser,
    updateCaption,
    deletePost,
    toggleArchive,
    toggleComments,
    toggleHideLikes
};
