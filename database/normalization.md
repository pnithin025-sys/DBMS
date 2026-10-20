# Pixora – Database Normalization Analysis (1NF, 2NF, 3NF)
## Academic Formalization for DBMS Course Evaluation

This document formally proves that the relational database schema of **Pixora** strictly adheres to **Third Normal Form (3NF)**, eliminating data anomalies (Insertion, Deletion, Update) while preserving all functional dependencies.

---

### 1. First Normal Form (1NF)

#### Theoretical Definition:
A relation $R$ is in First Normal Form (1NF) if and only if:
1. Every attribute domain contains only **atomic (indivisible)** values.
2. There are **no repeating groups** or multi-valued arrays stored in a single cell.
3. Every tuple is distinct, identifiable by a defined **Primary Key**.

#### Schema Violations Prevented in Pixora:
- **Un-normalized Anti-Pattern**: Storing multiple media URLs in a single comma-separated column `posts.media_urls = "img1.jpg, img2.jpg, img3.jpg"` or hashtags as `"travel,photography,sunset"`.
- **1NF Compliant Solution in Pixora**:
  - `post_media` table decomposes carousel images into individual atomic rows linked to `post_id` with an explicit `carousel_order TINYINT`.
  - `hashtags` and `post_hashtags` separate multi-value tags into distinct atomic tuples:
    ```sql
    CREATE TABLE post_hashtags (
        post_id INT NOT NULL,
        hashtag_id INT NOT NULL,
        PRIMARY KEY (post_id, hashtag_id)
    );
    ```
  - `post_tags` stores tagged user coordinates atomically as `(post_id, user_id, x_percent, y_percent)`.

---

### 2. Second Normal Form (2NF)

#### Theoretical Definition:
A relation $R$ is in Second Normal Form (2NF) if and only if:
1. It is already in **1NF**.
2. **No non-prime attribute is partially dependent** on any candidate key (i.e., every non-prime attribute must depend on the **whole** candidate key, not a proper subset of it).

#### Schema Analysis in Pixora:
In tables with composite primary keys:
- **Table: `post_likes`**:
  - Candidate Key: `(user_id, post_id)`
  - Attributes: `created_at`
  - Functional Dependency: $\{user\_id, post\_id\} \rightarrow created\_at$. The timestamp indicates when *that specific user liked that specific post*. It does not depend on `user_id` alone, nor on `post_id` alone. Hence, no partial dependency exists.
- **Table: `collection_items`**:
  - Candidate Key: `(collection_id, post_id)`
  - Attributes: `created_at`
  - Functional Dependency: $\{collection\_id, post\_id\} \rightarrow created\_at$. The item addition timestamp depends wholly on the pair.
- **Table: `post_media`**:
  - Instead of making `(post_id, media_url)` a composite key and mixing post attributes, `post_media` has a surrogate primary key `media_id` with candidate key `(post_id, carousel_order)`. All media attributes (`aspect_ratio`, `media_type`, `media_url`) depend on the specific carousel slot.

---

### 3. Third Normal Form (3NF)

#### Theoretical Definition:
A relation $R$ is in Third Normal Form (3NF) if and only if:
1. It is in **2NF**.
2. **No non-prime attribute is transitively dependent** on a candidate key.
   Formally: For every non-trivial functional dependency $X \rightarrow Y$:
   - Either $X$ is a superkey of $R$, OR
   - $Y$ is a prime attribute of $R$ (part of a candidate key).

#### Schema Violations Prevented in Pixora:
- **Transitive Dependency Hazard**: If `posts` stored location information directly:
  $$\{post\_id\} \rightarrow \{location\_name, city, country, latitude, longitude\}$$
  Here, $\{post\_id\} \rightarrow \{location\_name\}$ and $\{location\_name, city\} \rightarrow \{country, latitude, longitude\}$.
  This is a transitive dependency ($X \rightarrow Y$ and $Y \rightarrow Z$).
  - *Update Anomaly*: Updating the latitude of Paris would require updating hundreds of individual post records.
  - *Deletion Anomaly*: Deleting all posts geotagged in Iceland would accidentally delete Iceland's geographic coordinates from the database.
- **3NF Solution in Pixora**:
  Normalized into a separate `locations` relation:
  $$\text{locations}: \{location\_id\} \rightarrow \{name, city, country, latitude, longitude\}$$
  $$\text{posts}: \{post\_id\} \rightarrow \{user\_id, location\_id, caption, \dots\}$$
  In both relations, the determinant ($location\_id$ or $post\_id$) is a Superkey. Transitive dependencies are strictly eliminated.

- **Another 3NF Normalization**: `user_settings`
  Separating preferences (`theme`, `allow_tags_from`, `email_notifications`) from core user credentials (`password_hash`, `email`) preserves cohesion, minimizes row locking contention on the `users` table during frequent setting updates, and maintains clean normalization.

---

### 4. Summary of Functional Dependencies & Normal Forms

| Table Name | Primary / Candidate Key | Functional Dependencies | Normal Form |
|---|---|---|---|
| `users` | `user_id` (PK), `username` (UK), `email` (UK) | $user\_id \rightarrow \{username, email, password\_hash, full\_name, \dots\}$ | **3NF** |
| `locations` | `location_id` (PK), `(name, city)` (UK) | $location\_id \rightarrow \{name, city, country, latitude, longitude\}$ | **3NF** |
| `posts` | `post_id` (PK) | $post\_id \rightarrow \{user\_id, location\_id, caption, hide\_likes, \dots\}$ | **3NF** |
| `post_media` | `media_id` (PK), `(post_id, carousel_order)` (UK) | $media\_id \rightarrow \{post\_id, media\_type, media\_url, carousel\_order\}$ | **3NF** |
| `post_likes` | `(user_id, post_id)` (PK) | $\{user\_id, post\_id\} \rightarrow \{created\_at\}$ | **3NF** |
| `comments` | `comment_id` (PK) | $comment\_id \rightarrow \{post\_id, user\_id, parent\_comment\_id, content, \dots\}$ | **3NF** |
| `follows` | `(follower_id, following_id)` (PK) | $\{follower\_id, following\_id\} \rightarrow \{status, created\_at\}$ | **3NF** |
| `conversations` | `conversation_id` (PK) | $conversation\_id \rightarrow \{is\_group, title, created\_at\}$ | **3NF** |
| `messages` | `message_id` (PK) | $message\_id \rightarrow \{conversation\_id, sender\_id, message\_type, content, \dots\}$ | **3NF** |
| `hashtags` | `hashtag_id` (PK), `name` (UK) | $hashtag\_id \rightarrow \{name, created\_at\}$ | **3NF** |
| `post_hashtags`| `(post_id, hashtag_id)` (PK) | Associative entity linking posts to hashtags | **3NF** |

**Conclusion:** The Pixora database schema guarantees zero update, deletion, or insertion anomalies, with referential integrity preserved via cascading foreign key constraints.
