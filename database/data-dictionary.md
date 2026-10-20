# Pixora – Comprehensive Relational Data Dictionary
## Complete Schema Specification (MySQL 8.0 / InnoDB)

This data dictionary outlines the metadata, constraints, data types, and business logic for all tables in the **Pixora** platform.

---

### Table 1: `users`
Primary storage for accounts, authentication, and core profile attributes.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `user_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | None | Unique user identifier |
| `username` | `VARCHAR(30)` | NO | `UNIQUE`, `CHECK (CHAR_LENGTH >= 3)` | None | Handle used for logins and @mentions |
| `email` | `VARCHAR(255)` | NO | `UNIQUE`, `CHECK (LIKE '%_@__%.__%')` | None | Email address for login and password resets |
| `password_hash`| `VARCHAR(255)` | NO | None | None | Bcrypt hashed password (10 rounds) |
| `full_name` | `VARCHAR(100)` | NO | None | None | User's displayed legal/chosen name |
| `bio` | `VARCHAR(250)` | YES | None | `NULL` | Profile self-description |
| `website` | `VARCHAR(255)` | YES | None | `NULL` | Optional personal/professional URL |
| `avatar_url` | `VARCHAR(500)` | YES | None | `'/assets/default-avatar.svg'` | Profile picture image URL |
| `gender` | `ENUM(...)` | YES | `'male','female','custom','prefer_not_to_say'`| `'prefer_not_to_say'`| Demographic identity |
| `is_private` | `BOOLEAN` | NO | None | `FALSE` | If TRUE, follow requests require manual approval |
| `is_verified` | `BOOLEAN` | NO | None | `FALSE` | Admin-approved authenticity badge |
| `is_active` | `BOOLEAN` | NO | None | `TRUE` | Soft-deletion flag |
| `role` | `ENUM('user','admin')` | NO | None | `'user'` | Access control authorization level |
| `created_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP` | Account creation timestamp |
| `updated_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP ON UPDATE`| Profile modification timestamp |

---

### Table 2: `user_settings`
User interface preferences and privacy controls.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `user_id` | `INT` | NO | `PRIMARY KEY`, `FK -> users(user_id) ON DELETE CASCADE` | None | References the user |
| `theme` | `ENUM('dark','light','system')` | NO | None | `'dark'` | UI theme preference |
| `allow_tags_from`| `ENUM('everyone','following','none')` | NO | None | `'everyone'` | Who can tag user in photos |
| `allow_mentions_from`| `ENUM('everyone','following','none')` | NO | None | `'everyone'` | Who can @mention user |
| `email_notifications` | `BOOLEAN` | NO | None | `TRUE` | Email alert toggle |
| `push_notifications` | `BOOLEAN` | NO | None | `TRUE` | Live in-app alert toggle |
| `created_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP` | Record creation |
| `updated_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP ON UPDATE`| Last preference change |

---

### Table 3: `password_resets`
One-time cryptographically secure tokens for password recovery.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `reset_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | None | Token record ID |
| `user_id` | `INT` | NO | `FK -> users(user_id) ON DELETE CASCADE` | None | Target user |
| `token` | `VARCHAR(128)` | NO | `UNIQUE` | None | Random hex token |
| `expires_at` | `DATETIME` | NO | None | None | Token expiration timestamp (e.g. 1 hour) |
| `is_used` | `BOOLEAN` | NO | None | `FALSE` | Set to TRUE once consumed |
| `created_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP` | Issuance timestamp |

---

### Table 4: `locations`
Standardized geographic entities.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `location_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | None | Location ID |
| `name` | `VARCHAR(150)` | NO | `UNIQUE (name, city)` | None | Venue / landmark name |
| `city` | `VARCHAR(100)` | YES | None | `NULL` | City |
| `country` | `VARCHAR(100)` | YES | None | `NULL` | Country |
| `latitude` | `DECIMAL(10,8)`| YES | None | `NULL` | GPS latitude |
| `longitude`| `DECIMAL(11,8)`| YES | None | `NULL` | GPS longitude |
| `created_at`| `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP` | Record creation |

---

### Table 5: `posts`
Master table for feed posts.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `post_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | None | Unique post ID |
| `user_id` | `INT` | NO | `FK -> users(user_id) ON DELETE CASCADE` | None | Author |
| `location_id` | `INT` | YES | `FK -> locations(location_id) ON DELETE SET NULL` | `NULL` | Optional geotag |
| `caption` | `TEXT` | YES | None | `NULL` | Text caption |
| `hide_likes` | `BOOLEAN` | NO | None | `FALSE` | Conceals like count to public |
| `comments_disabled`| `BOOLEAN`| NO | None | `FALSE` | Closes comment section |
| `is_archived` | `BOOLEAN`| NO | None | `FALSE` | Hidden from public feed & profile |
| `created_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP` | Publication timestamp |
| `updated_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP ON UPDATE`| Last edit timestamp |

---

### Table 6: `post_media`
Media files belonging to posts (Single images/videos or multi-item carousels).

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `media_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | None | Media item ID |
| `post_id` | `INT` | NO | `FK -> posts(post_id) ON DELETE CASCADE` | None | Parent post |
| `media_type` | `ENUM('image','video')` | NO | None | `'image'` | Media mime classification |
| `media_url` | `VARCHAR(500)`| NO | None | None | File path in `/uploads/posts/` |
| `carousel_order`| `TINYINT UNSIGNED`| NO | `UNIQUE (post_id, carousel_order)`, `CHECK (1..10)`| `1` | Slide sequence order |
| `aspect_ratio` | `VARCHAR(20)` | YES | None | `'1:1'` | Aspect ratio hint (`'1:1'`,`'4:5'`,`'16:9'`) |
| `created_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP` | Upload timestamp |

---

### Table 7: `post_tags`
Tagged users on post media coordinates.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `tag_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | None | Tag record ID |
| `post_id` | `INT` | NO | `FK -> posts(post_id) ON DELETE CASCADE` | None | Tagged post |
| `user_id` | `INT` | NO | `FK -> users(user_id) ON DELETE CASCADE` | None | Tagged user |
| `x_percent` | `DECIMAL(5,2)` | NO | None | `50.00` | Horizontal coordinate percentage |
| `y_percent` | `DECIMAL(5,2)` | NO | None | `50.00` | Vertical coordinate percentage |
| `created_at` | `TIMESTAMP` | NO | `UNIQUE (post_id, user_id)` | `CURRENT_TIMESTAMP` | Tag timestamp |

---

### Table 8: `hashtags` & `post_hashtags`
Normalized hashtag taxonomy and post associations.

| Table | Column Name | Data Type | Nullable | Key / Constraint | Description |
|---|---|---|---|---|---|
| `hashtags` | `hashtag_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | Tag ID |
| `hashtags` | `name` | `VARCHAR(100)` | NO | `UNIQUE` | Normalized lowercase tag name |
| `post_hashtags` | `post_id` | `INT` | NO | `PK`, `FK -> posts ON DELETE CASCADE` | Associated post |
| `post_hashtags` | `hashtag_id` | `INT` | NO | `PK`, `FK -> hashtags ON DELETE CASCADE` | Tag ID |

---

### Table 9: `post_likes` & `comment_likes`
User likes on posts and comments.

| Table | Column Name | Data Type | Nullable | Key / Constraint | Description |
|---|---|---|---|---|---|
| `post_likes` | `user_id` | `INT` | NO | `PK`, `FK -> users ON DELETE CASCADE` | Liker |
| `post_likes` | `post_id` | `INT` | NO | `PK`, `FK -> posts ON DELETE CASCADE` | Target post |
| `comment_likes`| `user_id` | `INT` | NO | `PK`, `FK -> users ON DELETE CASCADE` | Liker |
| `comment_likes`| `comment_id` | `INT` | NO | `PK`, `FK -> comments ON DELETE CASCADE` | Target comment |

---

### Table 10: `comments`
Threaded discussion comments.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `comment_id` | `INT` | NO | `PRIMARY KEY AUTO_INCREMENT` | None | Unique comment ID |
| `post_id` | `INT` | NO | `FK -> posts(post_id) ON DELETE CASCADE` | None | Post commented on |
| `user_id` | `INT` | NO | `FK -> users(user_id) ON DELETE CASCADE` | None | Comment author |
| `parent_comment_id`| `INT` | YES | `FK -> comments(comment_id) ON DELETE CASCADE` | `NULL` | For 1-level threaded replies |
| `content` | `VARCHAR(1000)`| NO | None | None | Comment text content |
| `is_pinned` | `BOOLEAN` | NO | None | `FALSE` | Post author pinned flag |
| `created_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP` | Post timestamp |
| `updated_at` | `TIMESTAMP` | NO | None | `CURRENT_TIMESTAMP ON UPDATE`| Edit timestamp |

---

### Table 11: `follows`
Social relationship graph.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
|---|---|---|---|---|---|
| `follower_id` | `INT` | NO | `PK`, `FK -> users(user_id) ON DELETE CASCADE` | None | Initiator of follow |
| `following_id` | `INT` | NO | `PK`, `FK -> users(user_id) ON DELETE CASCADE` | None | Target account |
| `status` | `ENUM('pending','accepted')`| NO | None | `'accepted'` | `'pending'` for private users |
| `created_at` | `TIMESTAMP` | NO | `CHECK (follower_id <> following_id)` | `CURRENT_TIMESTAMP` | Relation timestamp |

---

### Table 12: `close_friends`, `blocks`, `mutes`
Safety and audience segmentation.

| Table | Key Columns | Specific Columns | Constraints |
|---|---|---|---|
| `close_friends` | `user_id`, `friend_id` | `created_at` | `CHECK (user_id <> friend_id)` |
| `blocks` | `blocker_id`, `blocked_id` | `created_at` | `CHECK (blocker_id <> blocked_id)` |
| `mutes` | `muter_id`, `muted_id` | `mute_posts`, `mute_stories` | `CHECK (muter_id <> muted_id)` |

---

### Table 13: `saved_posts`, `collections`, `collection_items`
User bookmarking system.

| Table | Key / Columns | Foreign Keys | Description |
|---|---|---|---|
| `saved_posts` | `(user_id, post_id)` PK | `FK -> users`, `FK -> posts` | Saved posts list |
| `collections` | `collection_id` PK, `user_id`, `name`, `cover_image_url` | `FK -> users` | Named collection folders |
| `collection_items` | `(collection_id, post_id)` PK | `FK -> collections`, `FK -> posts` | Junction linking posts into collections |

---

### Table 14: `reels`, `reel_likes`, `reel_comments`
Short-form vertical video system.

| Table | Columns | Constraints | Description |
|---|---|---|---|
| `reels` | `reel_id` PK, `user_id`, `video_url`, `thumbnail_url`, `caption`, `view_count` | `FK -> users` | Short video record |
| `reel_likes` | `(user_id, reel_id)` PK | `FK -> users`, `FK -> reels` | Like record |
| `reel_comments` | `comment_id` PK, `reel_id`, `user_id`, `content` | `FK -> reels`, `FK -> users` | Reel discussion comments |

---

### Table 15: `stories`, `story_views`, `highlights`, `highlight_items`
Ephemeral 24-hour stories and persistent profile highlights.

| Table | Key / Columns | Constraints & Defaults | Description |
|---|---|---|---|
| `stories` | `story_id` PK, `user_id`, `media_url`, `media_type`, `is_close_friends_only`, `caption`, `expires_at` | `FK -> users`, `expires_at DATETIME` | 24-hour expiring story |
| `story_views` | `(story_id, viewer_id)` PK | `FK -> stories`, `FK -> users` | Unique story view tracking |
| `highlights` | `highlight_id` PK, `user_id`, `title`, `cover_image_url` | `FK -> users` | Named profile highlight group |
| `highlight_items` | `(highlight_id, story_id)` PK | `FK -> highlights`, `FK -> stories` | Stories archived into highlights |

---

### Table 16: `conversations`, `conversation_participants`, `messages`, `message_reads`
Direct messaging engine (1-to-1 and group chats).

| Table | Columns | Key / Relationships | Description |
|---|---|---|---|
| `conversations` | `conversation_id`, `is_group`, `title` | `PK conversation_id` | Chat room / channel |
| `conversation_participants`| `conversation_id`, `user_id`, `joined_at` | `PK (conversation_id, user_id)` | Membership bridge |
| `messages` | `message_id`, `conversation_id`, `sender_id`, `message_type`, `content`, `media_url`, `shared_item_id`, `is_deleted` | `PK message_id`, `FK -> conversations`, `FK -> users` | Message payload |
| `message_reads` | `(message_id, user_id)` PK, `read_at` | `FK -> messages`, `FK -> users` | Per-user read receipt |

---

### Table 17: `notifications`, `search_history`, `reports`, `audit_logs`
Activity feed, search tracking, safety moderation, and database trigger audit logs.

| Table | Key | Essential Columns | Description |
|---|---|---|---|
| `notifications` | `notification_id` | `recipient_id`, `actor_id`, `type`, `entity_id`, `entity_type`, `is_read` | User alert item |
| `search_history` | `search_id` | `user_id`, `search_type`, `target_id`, `query_text`, `searched_at` | Recent searches |
| `reports` | `report_id` | `reporter_id`, `target_type`, `target_id`, `reason`, `description`, `status`, `reviewed_by` | Moderation report |
| `audit_logs` | `audit_id` | `action_type`, `table_name`, `record_id`, `performed_by`, `details`, `logged_at` | Trigger-populated audit log |
