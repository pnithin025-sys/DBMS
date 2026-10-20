-- =====================================================================
-- PIXORA SOCIAL MEDIA PLATFORM - DEMONSTRATION & ANALYTICAL SQL QUERIES
-- DBMS Capstone Evaluation Showcase
-- Demonstrates:
-- 1. INNER JOIN & LEFT JOIN with multi-table aggregation
-- 2. GROUP BY + HAVING clauses
-- 3. Subqueries & Correlated Subqueries
-- 4. Aggregate Functions (COUNT, SUM, AVG, MAX, MIN)
-- 5. Window Functions (RANK(), DENSE_RANK(), ROW_NUMBER())
-- 6. Set Operations (UNION / UNION ALL, INTERSECT emulation)
-- 7. Common Table Expressions (CTEs & Recursive CTEs)
-- 8. Advanced Social Graph Analytics (Mutual Followers, Suggested Users,
--    Engagement Rate Per User, Top Trending Hashtags)
-- =====================================================================

USE pixora_db;

-- ---------------------------------------------------------------------
-- QUERY 1: ENGAGEMENT RATE PER USER (Aggregate Functions + LEFT JOIN + HAVING)
-- Formula: (Total Likes + Total Comments + Total Saves) / Total Posts
-- Filters out users with fewer than 2 posts and sorts by engagement.
-- ---------------------------------------------------------------------
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    COUNT(DISTINCT p.post_id) AS total_posts,
    COUNT(DISTINCT pl.user_id, pl.post_id) AS total_likes_received,
    COUNT(DISTINCT c.comment_id) AS total_comments_received,
    COUNT(DISTINCT sp.user_id, sp.post_id) AS total_saves_received,
    ROUND(
        (COUNT(DISTINCT pl.user_id, pl.post_id) + COUNT(DISTINCT c.comment_id) + COUNT(DISTINCT sp.user_id, sp.post_id)) 
        / NULLIF(COUNT(DISTINCT p.post_id), 0), 
        2
    ) AS avg_engagement_per_post
FROM users u
INNER JOIN posts p ON u.user_id = p.user_id AND p.is_archived = FALSE
LEFT JOIN post_likes pl ON p.post_id = pl.post_id
LEFT JOIN comments c ON p.post_id = c.post_id
LEFT JOIN saved_posts sp ON p.post_id = sp.post_id
WHERE u.is_active = TRUE
GROUP BY u.user_id, u.username, u.full_name
HAVING total_posts >= 2
ORDER BY avg_engagement_per_post DESC, total_likes_received DESC;

-- ---------------------------------------------------------------------
-- QUERY 2: MUTUAL FOLLOWERS BETWEEN TWO USERS (Set Operations / INTERSECT)
-- Finds users who follow both Elena (user_id = 2) AND Marco (user_id = 3).
-- ---------------------------------------------------------------------
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    u.avatar_url
FROM users u
WHERE u.user_id IN (
    -- Users who follow user 2
    SELECT follower_id FROM follows WHERE following_id = 2 AND status = 'accepted'
)
AND u.user_id IN (
    -- Users who follow user 3
    SELECT follower_id FROM follows WHERE following_id = 3 AND status = 'accepted'
)
ORDER BY u.username ASC;

-- Alternative formulation using INNER JOIN for query optimizer comparison:
SELECT 
    u.user_id,
    u.username,
    u.full_name
FROM follows f1
JOIN follows f2 ON f1.follower_id = f2.follower_id
JOIN users u ON f1.follower_id = u.user_id
WHERE f1.following_id = 2 
  AND f2.following_id = 3
  AND f1.status = 'accepted' 
  AND f2.status = 'accepted';

-- ---------------------------------------------------------------------
-- QUERY 3: SUGGESTED USERS TO FOLLOW (Friends of Friends Algorithm)
-- Recommends accounts followed by people the user follows, who the user
-- does NOT already follow. Uses Common Table Expressions (CTE).
-- ---------------------------------------------------------------------
WITH user_following AS (
    -- Accounts followed by user_id = 2
    SELECT following_id 
    FROM follows 
    WHERE follower_id = 2 AND status = 'accepted'
),
friends_of_friends AS (
    -- Accounts followed by the people user 2 follows
    SELECT 
        f.following_id AS suggested_user_id,
        COUNT(*) AS mutual_connection_count
    FROM follows f
    WHERE f.follower_id IN (SELECT following_id FROM user_following)
      AND f.following_id <> 2 -- Don't suggest self
      AND f.following_id NOT IN (SELECT following_id FROM user_following) -- Don't suggest already followed
      AND f.status = 'accepted'
    GROUP BY f.following_id
)
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.is_verified,
    fof.mutual_connection_count
FROM friends_of_friends fof
JOIN users u ON fof.suggested_user_id = u.user_id
WHERE u.is_active = TRUE
ORDER BY fof.mutual_connection_count DESC, u.is_verified DESC
LIMIT 5;

-- ---------------------------------------------------------------------
-- QUERY 4: TOP 5 TRENDING HASHTAGS THIS WEEK (Aggregation + CTE + Ranking)
-- Analyzes recent post associations within the last 7 days.
-- ---------------------------------------------------------------------
WITH recent_tag_counts AS (
    SELECT 
        h.hashtag_id,
        h.name AS hashtag_name,
        COUNT(ph.post_id) AS usage_count_7d,
        COUNT(DISTINCT p.user_id) AS unique_creators
    FROM hashtags h
    JOIN post_hashtags ph ON h.hashtag_id = ph.hashtag_id
    JOIN posts p ON ph.post_id = p.post_id
    WHERE p.created_at >= NOW() - INTERVAL 7 DAY
      AND p.is_archived = FALSE
    GROUP BY h.hashtag_id, h.name
)
SELECT 
    hashtag_id,
    hashtag_name,
    usage_count_7d,
    unique_creators,
    DENSE_RANK() OVER (ORDER BY usage_count_7d DESC, unique_creators DESC) AS trend_rank
FROM recent_tag_counts
ORDER BY trend_rank ASC
LIMIT 5;

-- ---------------------------------------------------------------------
-- QUERY 5: POST RANKINGS WITHIN EACH CREATOR (Window Function: ROW_NUMBER & RANK)
-- Ranks posts by like count for each creator partition.
-- ---------------------------------------------------------------------
SELECT 
    u.username,
    p.post_id,
    LEFT(p.caption, 40) AS caption_preview,
    p.created_at,
    COUNT(pl.user_id) AS like_count,
    ROW_NUMBER() OVER(PARTITION BY p.user_id ORDER BY COUNT(pl.user_id) DESC, p.created_at DESC) AS user_post_rank
FROM posts p
JOIN users u ON p.user_id = u.user_id
LEFT JOIN post_likes pl ON p.post_id = pl.post_id
WHERE p.is_archived = FALSE
GROUP BY u.username, p.post_id, p.user_id, p.caption, p.created_at
ORDER BY u.username, user_post_rank;

-- ---------------------------------------------------------------------
-- QUERY 6: USERS WITH ZERO POSTS (Anti-Join / Correlated Subquery)
-- Identifies passive lurkers or newly registered accounts.
-- ---------------------------------------------------------------------
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    u.created_at,
    (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.user_id) AS follower_count
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM posts p WHERE p.user_id = u.user_id
)
AND u.role = 'user'
ORDER BY u.created_at DESC;

-- ---------------------------------------------------------------------
-- QUERY 7: MOST ACTIVE COMMENTERS ON THE PLATFORM (Aggregate + HAVING)
-- Highlights top power commenters who actively drive discussions.
-- ---------------------------------------------------------------------
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    COUNT(c.comment_id) AS total_comments_written,
    COUNT(DISTINCT c.post_id) AS distinct_posts_commented_on,
    COUNT(cl.user_id) AS total_comment_likes_earned
FROM users u
INNER JOIN comments c ON u.user_id = c.user_id
LEFT JOIN comment_likes cl ON c.comment_id = cl.comment_id
GROUP BY u.user_id, u.username, u.full_name
HAVING total_comments_written >= 2
ORDER BY total_comments_written DESC, total_comment_likes_earned DESC;

-- ---------------------------------------------------------------------
-- QUERY 8: UNIFIED CONTENT FEED COMBINING POSTS AND REELS (UNION ALL)
-- Combines regular posts and short-form reels into a unified media timeline.
-- ---------------------------------------------------------------------
(
    SELECT 
        'post' AS media_kind,
        p.post_id AS item_id,
        p.user_id,
        u.username,
        u.avatar_url,
        LEFT(p.caption, 60) AS caption,
        p.created_at,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id) AS likes_count
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.is_archived = FALSE
)
UNION ALL
(
    SELECT 
        'reel' AS media_kind,
        r.reel_id AS item_id,
        r.user_id,
        u.username,
        u.avatar_url,
        LEFT(r.caption, 60) AS caption,
        r.created_at,
        (SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.reel_id) AS likes_count
    FROM reels r
    JOIN users u ON r.user_id = u.user_id
)
ORDER BY created_at DESC
LIMIT 15;

-- ---------------------------------------------------------------------
-- QUERY 9: CORRELATED SUBQUERY FOR LAST MESSAGE IN EVERY CONVERSATION
-- Used by real-time chat inbox to fetch conversation preview without N+1.
-- ---------------------------------------------------------------------
SELECT 
    c.conversation_id,
    c.is_group,
    c.title,
    m.message_id,
    m.sender_id,
    sender.username AS sender_username,
    m.content AS last_message_content,
    m.message_type,
    m.created_at AS last_message_time
FROM conversations c
JOIN messages m ON c.conversation_id = m.conversation_id
JOIN users sender ON m.sender_id = sender.user_id
WHERE m.message_id = (
    SELECT MAX(m2.message_id) 
    FROM messages m2 
    WHERE m2.conversation_id = c.conversation_id
)
ORDER BY m.created_at DESC;

-- ---------------------------------------------------------------------
-- QUERY 10: USER RETENTION & REPUTATION SCORE (Multi-Metric CTE)
-- Calculates composite reputation score based on social factors.
-- ---------------------------------------------------------------------
WITH user_metrics AS (
    SELECT 
        u.user_id,
        u.username,
        u.is_verified,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id AND status = 'accepted') AS followers,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.user_id) AS posts,
        (SELECT COUNT(*) FROM post_likes pl JOIN posts p ON pl.post_id = p.post_id WHERE p.user_id = u.user_id) AS post_likes_received,
        (SELECT COUNT(*) FROM comments c JOIN posts p ON c.post_id = p.post_id WHERE p.user_id = u.user_id) AS comments_received
    FROM users u
    WHERE u.is_active = TRUE
)
SELECT 
    username,
    is_verified,
    followers,
    posts,
    post_likes_received,
    comments_received,
    ROUND(
        (followers * 2.0) + (posts * 1.5) + (post_likes_received * 0.5) + (comments_received * 1.0) 
        + (CASE WHEN is_verified THEN 100 ELSE 0 END), 
        1
    ) AS reputation_score,
    DENSE_RANK() OVER (ORDER BY (followers * 2.0) + (posts * 1.5) + (post_likes_received * 0.5) + (comments_received * 1.0) + (CASE WHEN is_verified THEN 100 ELSE 0 END) DESC) AS platform_rank
FROM user_metrics
ORDER BY platform_rank ASC
LIMIT 10;
