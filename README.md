# 🌌 Pixora – Complete Social Media Web Application
### Database Management Systems (DBMS) Capstone Project (3rd Semester)

[![Node.js Version](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MySQL%208.0%20(InnoDB)-blue.svg)](https://www.mysql.com/)
[![Architecture](https://img.shields.io/badge/Architecture-3rd%20Normal%20Form%20(3NF)-purple.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS%20(No%20Framework)-orange.svg)]()
[![Realtime](https://img.shields.io/badge/Real--time-Socket.IO-black.svg)](https://socket.io/)

---

## 📖 Project Overview
**Pixora** is a full-featured, modern social media platform built from the ground up for a Database Management Systems (DBMS) capstone course. It implements visual storytelling, multi-image carousels, vertical short-form reels, 24-hour expiring stories, real-time direct messaging, safety reports, and an administrator moderation console.

Unlike generic full-stack apps that use heavy Object-Relational Mappers (ORMs), Pixora **strictly uses raw SQL queries via MySQL2 connection pools**, parameterized prepared statements, stored procedures, triggers, views, and transactions so that every relational database concept is directly inspectable, verifiable, and explainable in a viva evaluation.

---

## 🛠️ Technology Stack
- **Database:** MySQL 8.0 (InnoDB engine, utf8mb4 charset, utf8mb4_unicode_ci collation)
- **Backend:** Node.js, Express.js, `mysql2/promise` driver (Connection pool, raw SQL, parameterized prepared statements, NO ORM)
- **Authentication:** `bcryptjs` (password hashing, 10 rounds), `jsonwebtoken` (JWT via httpOnly secure cookies), session persistence
- **File Uploads:** `multer` (Images up to 5 MB, Videos up to 50 MB) saved into `/uploads`
- **Real-Time Layer:** `Socket.IO` for live direct messages, typing indicators, and instant notification pushes
- **Frontend:** Semantic HTML5, Vanilla CSS3 (Custom design system, CSS variables, dark/light themes), Vanilla JavaScript ES6+ (No React/Vue/Angular), responsive mobile-first architecture

---

## 🔑 Test Login Credentials

All seed accounts have been pre-populated with realistic photography, travel, culinary, coding, and fitness data:

| Role | Username | Email | Password | Description |
|---|---|---|---|---|
| **Administrator** | `admin` | `admin@pixora.app` | `admin123` | Full access to Moderation Console, Reports, Metrics, Ban Users |
| **User (Photographer)** | `elena_lens` | `elena@gmail.com` | `password123` | Landscape photographer with carousels, stories, followers |
| **User (Traveler)** | `marco_travels` | `marco@gmail.com` | `password123` | Nomad exploring 45+ countries |
| **User (Chef)** | `sophia_chef` | `sophia@gmail.com` | `password123` | Pastry chef with baking posts and recipes highlight |
| **User (Engineer)** | `alex_code` | `alex@gmail.com` | `password123` | Full-stack builder with SQL and tech posts |
| **User (Fitness)** | `maya_fit` | `maya@gmail.com` | `password123` | Fitness coach with active mobility reels |
| **User (Private)** | `clara_private`| `clara@gmail.com` | `password123` | Private account testing follow requests |

---

## 🚀 Setup & Installation Guide

### Step 1: Clone or Navigate to the Project
```bash
cd "e:\III sem capstorn project\DBMS3"
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```

### Step 3: Configure Database Environment Variables
Open the `.env` file in the root directory:
```ini
PORT=5000
NODE_ENV=development

# MySQL Database Connection Settings
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_root_password_here
DB_NAME=pixora_db

# JWT Secrets
JWT_SECRET=pixora_super_secret_jwt_key_2026_capstone_secure_token
JWT_EXPIRES_IN=7d
```
> Replace `your_mysql_root_password_here` with your local MySQL server root password.

### Step 4: Create Database Schema and Seed Data
Run the SQL scripts using MySQL CLI or MySQL Workbench:

**Option A: Using MySQL Command Line**
```bash
# 1. Execute Schema (Tables, Constraints, Views, Triggers, Stored Procedures, Events)
mysql -u root -p < database/schema.sql

# 2. Execute Seed Data (16 users, 55 posts, carousels, comments, likes, reels, stories, chats)
mysql -u root -p pixora_db < database/seed.sql
```

**Option B: Using MySQL Workbench**
1. Open MySQL Workbench and connect to your local MySQL instance.
2. Open `database/schema.sql` and click the **Execute (Lightning Bolt)** icon.
3. Open `database/seed.sql` and click **Execute**.

### Step 5: Start the Pixora Server
```bash
npm start
```
Or with automatic reload during development:
```bash
npm run dev
```

### Step 6: Open the Application
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 📚 Complete DBMS Concepts Showcase (Viva Preparation)

### 1. Database Normalization (3rd Normal Form - 3NF)
- **1NF Compliance:** Atomic columns only. No comma-delimited strings. Multi-image carousels are decomposed into a dedicated child table `post_media` with an explicit `carousel_order` (1 to 10). Hashtags and tags are separated into relational associative entities `post_hashtags` and `post_tags`.
- **2NF Compliance:** Elimination of partial functional dependencies. In tables with composite primary keys such as `post_likes (user_id, post_id)` and `collection_items (collection_id, post_id)`, non-prime attributes (`created_at`) depend wholly on the full composite key.
- **3NF Compliance:** Elimination of transitive functional dependencies. Rather than storing location names and coordinates inside the `posts` table (which would create update and deletion anomalies), a separate `locations` table was designed. Posts reference `location_id` via a foreign key.
- *Detailed academic proofs and mathematical functional dependency diagrams are available in [normalization.md](database/normalization.md).*

### 2. Referential Integrity & Constraints
- **Foreign Keys with Cascading Actions:**
  - `ON DELETE CASCADE`: Used for dependent child records like `post_media`, `post_likes`, `comments`, and `conversation_participants`. When a post or user is deleted, all associated likes, comments, and media are cleaned up atomically.
  - `ON DELETE SET NULL`: Used on `posts.location_id` so that deleting a location does not destroy existing posts.
- **Check Constraints (`CHECK`):**
  - `CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)`: Prevents users from following themselves.
  - `CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)`: Prevents self-blocking.
  - `CONSTRAINT chk_username_length CHECK (CHAR_LENGTH(username) >= 3)`: Enforces username lengths.
  - `CONSTRAINT chk_carousel_order_max CHECK (carousel_order BETWEEN 1 AND 10)`: Limits carousel depth.
- **Unique Constraints (`UNIQUE`):**
  - `(user_id, post_id)` on `post_likes`: Guarantees idempotency (a user cannot like the same post twice).
  - `(follower_id, following_id)` on `follows`: Guarantees exactly one relationship state per pair.
  - `(post_id, carousel_order)` on `post_media`: Enforces ordering slots.

### 3. Query Optimization & Indexes
- **Single & Composite Indexes:**
  - `CREATE INDEX idx_posts_user_created ON posts(user_id, is_archived, created_at DESC)`: Optimizes home feed rendering and user profile grids by ordering without costly temporary filesort.
  - `CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC)`: Eliminates full table scans when fetching unread badges and user alerts.
  - `CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at ASC)`: Enables fast streaming of chronological chat messages.
  - `CREATE INDEX idx_hashtags_name ON hashtags(name)`: Accelerates hashtag autocomplete lookups.

### 4. Database Views (5 Views)
1. `v_feed_posts`: Pre-joins `posts`, `post_media`, `users`, `locations`, and aggregates total likes and comments.
2. `v_user_stats`: Aggregates total posts, followers, and following counts per user.
3. `v_post_stats`: Summarizes granular engagement metrics (likes, comments, saves).
4. `v_trending_hashtags`: Computes 7-day usage frequencies and ranks hashtags by popularity.
5. `v_unread_notifications`: Summarizes unread alerts per user.

### 5. Database Triggers (5 Triggers)
1. `trg_after_post_like`: Automatically creates an in-app notification for the post author when another user likes their post.
2. `trg_after_comment`: Automatically notifies post authors on new comments and notifies parent comment authors on replies.
3. `trg_after_follow`: Triggers either a `'follow'` or `'follow_request'` notification depending on whether the target account is private.
4. `trg_audit_post_delete`: Records deleted post metadata into `audit_logs` before removal.
5. `trg_audit_comment_delete`: Records deleted comment metadata into `audit_logs`.

### 6. Stored Procedures & Functions
- **Procedures:**
  - `sp_register_user`: Performs atomic user registration and creates default `user_settings`.
  - `sp_toggle_like`: Idempotent like toggle returning current state and new count.
  - `sp_follow_user`: Automatically sets status to `'accepted'` for public accounts or `'pending'` for private accounts.
  - `sp_create_post`: Atomic transaction inserting post, carousel media, hashtags, and mentions.
  - `sp_get_feed`: Returns paginated feed filtering out blocked users and muted accounts.
  - `sp_search_users`: Fuzzy prefix/substring search excluding blocked pairs.
  - `sp_delete_account`: Handles soft deactivation or permanent cascading deletion with audit logging.
- **Functions:**
  - `fn_is_following(p_user_a, p_user_b)`: Returns boolean indicating active accepted following.
  - `fn_is_blocked(p_user_a, p_user_b)`: Returns boolean indicating bilateral blocking.

### 7. Scheduled MySQL Events
- `evt_clean_expired_stories`: Runs hourly to delete or archive stories older than 24 hours that are not part of user highlights.
- `evt_clean_expired_reset_tokens`: Runs daily to purge invalid or consumed password reset tokens.

### 8. Transactions (`ACID` Guarantees)
- Multi-step operations throughout the application use `START TRANSACTION; ... COMMIT; / ROLLBACK;` blocks:
  - Account registration (user + user settings)
  - Post creation (post + media items + hashtags + mentions)
  - Blocking a user (removes mutual follows + creates block record)
  - Resetting passwords (updates password hash + marks token used)

### 9. Advanced SQL Showcase (`queries.sql`)
Available in [queries.sql](database/queries.sql) for viva demonstration:
- **CTE & Window Functions:** `DENSE_RANK()`, `ROW_NUMBER()`, `RANK()` over creator post partitions.
- **Correlated Subqueries:** Finding latest conversation preview messages without N+1 queries.
- **Set Operations:** `UNION ALL` combining regular posts and reels into a unified media stream; `INTERSECT` emulation for mutual followers.
- **Aggregations with HAVING:** Engagement rate per user formula:
  $$\text{Engagement Rate} = \frac{\text{Likes} + \text{Comments} + \text{Saves}}{\text{Posts}}$$

---

## 📁 Project Structure

```
DBMS3/
├── server/
│   ├── config/
│   │   ├── config.js            # Environment config
│   │   └── db.js                # MySQL2 connection pool (raw SQL, prepared statements)
│   ├── controllers/             # Auth, User, Post, Reel, Comment, Story, Message, Admin, Search
│   ├── middleware/              # Auth, Upload (Multer), RateLimiter, ErrorHandler
│   ├── routes/                  # Express REST routes under /api
│   ├── sockets/
│   │   └── socketHandler.js     # Real-time Socket.IO chat and notification dispatch
│   ├── utils/
│   │   ├── auditLogger.js       # Database audit logger
│   │   └── tokenHelper.js       # JWT & reset tokens
│   └── app.js                   # Main application entry point
├── public/
│   ├── index.html               # Main Single-Page Application (SPA)
│   ├── css/
│   │   ├── main.css             # Tokens, typography, dark/light theme, keyframe animations
│   │   ├── components.css       # Cards, carousels, modals, story viewer, reels
│   │   └── layouts.css          # Desktop sidebar, mobile bottom bar, grids
│   ├── js/                      # Modular client-side JS (api, auth, feed, reels, stories, messages, admin)
│   └── assets/                  # Official SVG logo, icons sprite, default avatars
├── database/
│   ├── schema.sql               # Complete MySQL 8.0 DDL (3NF tables, constraints, triggers, procedures, views)
│   ├── seed.sql                 # Seed data: 16 users, 55 posts, comments, likes, reels, stories, chats
│   ├── queries.sql              # Advanced viva demonstration queries
│   ├── er-diagram.md            # Mermaid Entity-Relationship diagram
│   ├── normalization.md         # 1NF, 2NF, 3NF formal mathematical analysis
│   └── data-dictionary.md       # Metadata for all tables and columns
├── uploads/                     # Upload directory for avatars, posts, stories, reels
├── .env.example
├── .env
├── package.json
└── README.md
```

---

## 🛡️ License & Submission Notice
Developed for academic submission and evaluation in the **Database Management Systems Course (Semester III)**. All rights reserved.
