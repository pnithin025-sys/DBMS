// =====================================================================
// PIXORA FEED & STORIES TRAY HANDLER
// =====================================================================

const Feed = {
    currentPage: 1,
    isLoading: false,
    hasMore: true,

    async renderFeed(container) {
        container.innerHTML = `
            <div class="content-container">
                <div class="feed-column">
                    <!-- Story Tray Container -->
                    <div id="story-tray" class="story-tray-wrapper">
                        <div class="story-item" onclick="App.openCreateStoryModal()">
                            <div class="avatar-container" style="border: 2px dashed var(--brand-primary); padding: 4px;">
                                <img src="${Auth.currentUser ? Auth.currentUser.avatar_url : '/assets/default-avatar.svg'}" class="avatar avatar-md" alt="My Story">
                            </div>
                            <span>Your Story</span>
                        </div>
                        <div id="story-items-container" style="display:flex; gap:16px;">
                            <div class="skeleton avatar-md" style="border-radius:50%; width:52px; height:52px;"></div>
                            <div class="skeleton avatar-md" style="border-radius:50%; width:52px; height:52px;"></div>
                            <div class="skeleton avatar-md" style="border-radius:50%; width:52px; height:52px;"></div>
                        </div>
                    </div>

                    <!-- Posts Stream -->
                    <div id="posts-stream"></div>
                    <div id="feed-loader" style="text-align:center; padding:20px; display:none;">
                        <div class="spinner" style="margin:0 auto;"></div>
                    </div>
                </div>

                <!-- Right Sidebar Suggestions -->
                <div class="sidebar-right">
                    <!-- Current User Quick Profile -->
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                        <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="App.navigateTo('#profile?u=${Auth.currentUser ? Auth.currentUser.username : ''}')">
                            <img src="${Auth.currentUser ? Auth.currentUser.avatar_url : '/assets/default-avatar.svg'}" class="avatar avatar-md" alt="Profile">
                            <div>
                                <div style="font-weight:700; font-size:14px;">${Auth.currentUser ? Auth.currentUser.username : 'guest'}</div>
                                <div style="font-size:12px; color:var(--text-muted);">${Auth.currentUser ? Auth.currentUser.full_name : ''}</div>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="font-size:12px; padding:6px 12px;" onclick="Auth.logout()">Switch</button>
                    </div>

                    <!-- Suggestions Card -->
                    <div class="suggestions-card">
                        <div class="suggestions-header">
                            <div class="suggestions-title">Suggested For You</div>
                            <span style="font-size:12px; font-weight:700; cursor:pointer;" onclick="App.navigateTo('#explore')">See All</span>
                        </div>
                        <div id="suggestions-list">
                            <div class="skeleton" style="height:36px; margin-bottom:10px;"></div>
                            <div class="skeleton" style="height:36px; margin-bottom:10px;"></div>
                            <div class="skeleton" style="height:36px;"></div>
                        </div>
                    </div>

                    <div style="font-size:11px; color:var(--text-muted); line-height:1.6; padding:0 8px;">
                        About • Help • Press • API • Privacy • Terms • Locations • Language<br>
                        © 2026 PIXORA FROM METASPHERE
                    </div>
                </div>
            </div>
        `;

        this.currentPage = 1;
        this.hasMore = true;
        this.loadStories();
        this.loadPosts(true);
        this.loadSuggestions();
        this.initInfiniteScroll();
    },

    async loadStories() {
        const container = document.getElementById('story-items-container');
        if (!container) return;

        try {
            const data = await API.get('/stories/feed');
            if (data.success && data.tray) {
                if (data.tray.length === 0) {
                    container.innerHTML = '';
                    return;
                }
                container.innerHTML = data.tray.map(userTray => `
                    <div class="story-item" onclick="Stories.openStoryViewer(${JSON.stringify(userTray.stories).replace(/"/g, '&quot;')}, 0)">
                        <div class="story-ring ${userTray.is_all_viewed ? 'viewed' : ''} ${userTray.stories.some(s => s.is_close_friends_only) ? 'close-friends' : ''}">
                            <img src="${userTray.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-md" alt="${userTray.username}">
                        </div>
                        <span>${userTray.username}</span>
                    </div>
                `).join('');
            }
        } catch (error) {
            container.innerHTML = '';
        }
    },

    async loadPosts(reset = false) {
        if (this.isLoading || (!this.hasMore && !reset)) return;
        this.isLoading = true;

        const loader = document.getElementById('feed-loader');
        const stream = document.getElementById('posts-stream');
        if (loader) loader.style.display = 'block';

        if (reset) {
            this.currentPage = 1;
            this.hasMore = true;
            if (stream) stream.innerHTML = '';
        }

        try {
            const data = await API.get(`/posts/feed?page=${this.currentPage}&limit=5`);
            if (data.success && data.posts) {
                if (data.posts.length === 0 && this.currentPage === 1) {
                    stream.innerHTML = `
                        <div style="text-align:center; padding:60px 20px; background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-subtle);">
                            <div style="font-size:40px; margin-bottom:12px;">📸</div>
                            <h3 style="margin-bottom:8px;">Welcome to your Feed</h3>
                            <p style="color:var(--text-muted); font-size:14px; max-width:320px; margin:0 auto 20px;">
                                Follow friends, creators, and photographers to start seeing their posts here!
                            </p>
                            <button class="btn btn-primary" onclick="App.navigateTo('#explore')">Explore Trending Posts</button>
                        </div>
                    `;
                    this.hasMore = false;
                } else {
                    data.posts.forEach(post => {
                        stream.insertAdjacentHTML('beforeend', this.createPostCardHTML(post));
                    });
                    this.hasMore = data.has_more;
                    this.currentPage++;
                }
            }
        } catch (error) {
            console.error('Failed loading feed:', error);
        } finally {
            this.isLoading = false;
            if (loader) loader.style.display = 'none';
        }
    },

    createPostCardHTML(post) {
        const isCarousel = post.media && post.media.length > 1;
        const formattedCaption = this.formatCaption(post.caption);

        return `
            <div class="post-card" id="post-${post.post_id}">
                <!-- Header -->
                <div class="post-header">
                    <div class="post-author" onclick="App.navigateTo('#profile?u=${post.username}')" style="cursor:pointer;">
                        <img src="${post.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm" alt="${post.username}">
                        <div class="post-author-info">
                            <div class="username">
                                ${post.username}
                                ${post.is_verified ? '<svg class="badge-verified" width="14" height="14"><use href="/assets/icons.svg#icon-verified"/></svg>' : ''}
                            </div>
                            ${post.location_name ? `<div class="location">${post.location_name}${post.location_city ? ', ' + post.location_city : ''}</div>` : ''}
                        </div>
                    </div>
                    <button class="btn-icon" onclick="Feed.showPostOptions(${post.post_id}, ${post.user_id})">
                        <svg width="20" height="20" fill="currentColor"><circle cx="5" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></svg>
                    </button>
                </div>

                <!-- Media -->
                <div class="post-media-wrapper" ondblclick="Feed.handleDoubleTapLike(event, ${post.post_id})">
                    <svg class="double-tap-heart" id="heart-anim-${post.post_id}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>

                    ${isCarousel ? `
                        <div class="post-media-carousel" id="carousel-${post.post_id}">
                            ${post.media.map((m, idx) => `
                                <div class="carousel-slide">
                                    ${m.media_type === 'video' ? `<video src="${m.media_url}" controls playsinline></video>` : `<img src="${m.media_url}" alt="Post media ${idx + 1}" loading="lazy">`}
                                </div>
                            `).join('')}
                        </div>
                        <div class="carousel-nav-btn carousel-prev" onclick="Feed.scrollCarousel(${post.post_id}, -1)">‹</div>
                        <div class="carousel-nav-btn carousel-next" onclick="Feed.scrollCarousel(${post.post_id}, 1)">›</div>
                        <div class="carousel-dots" id="dots-${post.post_id}">
                            ${post.media.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
                        </div>
                    ` : `
                        ${post.media && post.media[0] && post.media[0].media_type === 'video' 
                            ? `<video src="${post.media[0].media_url}" controls playsinline style="width:100%; height:100%; object-fit:cover;"></video>` 
                            : `<img src="${post.media && post.media[0] ? post.media[0].media_url : ''}" alt="Post image" style="width:100%; height:100%; object-fit:cover;" loading="lazy">`
                        }
                    `}
                </div>

                <!-- Actions -->
                <div class="post-actions">
                    <div class="post-actions-left">
                        <button class="action-icon ${post.is_liked_by_me ? 'liked' : ''}" id="like-btn-${post.post_id}" onclick="Feed.toggleLike(${post.post_id})">
                            <svg width="24" height="24"><use href="/assets/icons.svg#${post.is_liked_by_me ? 'icon-heart-filled' : 'icon-heart'}"/></svg>
                        </button>
                        <button class="action-icon" onclick="Feed.openPostDetailModal(${post.post_id})">
                            <svg width="24" height="24"><use href="/assets/icons.svg#icon-comment"/></svg>
                        </button>
                        <button class="action-icon" onclick="Feed.openShareModal(${post.post_id})">
                            <svg width="24" height="24"><use href="/assets/icons.svg#icon-share"/></svg>
                        </button>
                    </div>
                    <button class="action-icon ${post.is_saved_by_me ? 'saved' : ''}" id="save-btn-${post.post_id}" onclick="Feed.toggleSave(${post.post_id})">
                        <svg width="24" height="24"><use href="/assets/icons.svg#${post.is_saved_by_me ? 'icon-bookmark-filled' : 'icon-bookmark'}"/></svg>
                    </button>
                </div>

                <!-- Details -->
                <div class="post-details">
                    ${!post.hide_likes ? `
                        <div class="post-likes-count" id="likes-count-${post.post_id}">
                            ${post.likes_count.toLocaleString()} likes
                        </div>
                    ` : ''}

                    ${post.caption ? `
                        <div class="post-caption">
                            <span class="author-name" onclick="App.navigateTo('#profile?u=${post.username}')">${post.username}</span>
                            ${formattedCaption}
                        </div>
                    ` : ''}

                    ${post.comments_count > 0 ? `
                        <div class="post-comments-summary" onclick="Feed.openPostDetailModal(${post.post_id})">
                            View all ${post.comments_count} comments
                        </div>
                    ` : ''}

                    <div class="post-time">${this.timeAgo(post.created_at)}</div>
                </div>

                <!-- Quick Comment Bar -->
                ${!post.comments_disabled ? `
                    <form class="post-comment-box" onsubmit="Feed.handleQuickComment(event, ${post.post_id})">
                        <input type="text" placeholder="Add a comment..." id="comment-input-${post.post_id}" autocomplete="off">
                        <button type="submit">Post</button>
                    </form>
                ` : ''}
            </div>
        `;
    },

    formatCaption(caption) {
        if (!caption) return '';
        // Escape HTML
        let escaped = caption
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Highlight Hashtags
        escaped = escaped.replace(/#([a-zA-Z0-9_]+)/g, '<span class="hashtag" onclick="App.navigateTo(\'#search?q=%23$1\')">#$1</span>');

        // Highlight Mentions
        escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention" onclick="App.navigateTo(\'#profile?u=$1\')">@$1</span>');

        return escaped;
    },

    scrollCarousel(postId, direction) {
        const carousel = document.getElementById(`carousel-${postId}`);
        if (!carousel) return;
        const width = carousel.offsetWidth;
        carousel.scrollBy({ left: width * direction, behavior: 'smooth' });

        // Update dot indicator
        setTimeout(() => {
            const index = Math.round(carousel.scrollLeft / width);
            const dots = document.querySelectorAll(`#dots-${postId} .carousel-dot`);
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }, 200);
    },

    async toggleLike(postId) {
        const btn = document.getElementById(`like-btn-${postId}`);
        const countElem = document.getElementById(`likes-count-${postId}`);

        try {
            const data = await API.post(`/interactions/posts/${postId}/like`, {});
            if (data.success) {
                btn.classList.toggle('liked', data.is_liked);
                btn.innerHTML = `<svg width="24" height="24"><use href="/assets/icons.svg#${data.is_liked ? 'icon-heart-filled' : 'icon-heart'}"/></svg>`;
                if (countElem) {
                    countElem.textContent = `${data.likes_count.toLocaleString()} likes`;
                }
            }
        } catch (error) {
            console.error('Like toggle failed:', error);
        }
    },

    async handleDoubleTapLike(event, postId) {
        const heart = document.getElementById(`heart-anim-${postId}`);
        if (heart) {
            heart.classList.remove('animate');
            void heart.offsetWidth; // Trigger reflow
            heart.classList.add('animate');
        }

        const btn = document.getElementById(`like-btn-${postId}`);
        if (btn && !btn.classList.contains('liked')) {
            await this.toggleLike(postId);
        }
    },

    async toggleSave(postId) {
        const btn = document.getElementById(`save-btn-${postId}`);
        try {
            const data = await API.post(`/interactions/posts/${postId}/save`, {});
            if (data.success) {
                btn.classList.toggle('saved', data.is_saved);
                btn.innerHTML = `<svg width="24" height="24"><use href="/assets/icons.svg#${data.is_saved ? 'icon-bookmark-filled' : 'icon-bookmark'}"/></svg>`;
                if (window.showToast) window.showToast(data.is_saved ? 'Saved to bookmarks' : 'Removed from bookmarks', 'info');
            }
        } catch (error) {
            console.error('Save toggle failed:', error);
        }
    },

    async handleQuickComment(event, postId) {
        event.preventDefault();
        const input = document.getElementById(`comment-input-${postId}`);
        if (!input || !input.value.trim()) return;

        const content = input.value.trim();
        input.value = '';

        try {
            const data = await API.post(`/comments/post/${postId}`, { content });
            if (data.success) {
                if (window.showToast) window.showToast('Comment posted', 'success');
                // Open detail modal to show comment thread
                this.openPostDetailModal(postId);
            }
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
        }
    },

    async openPostDetailModal(postId) {
        try {
            const [postData, commentData] = await Promise.all([
                API.get(`/posts/${postId}`),
                API.get(`/comments/post/${postId}`)
            ]);

            if (postData.success) {
                App.showModal(this.createPostDetailHTML(postData.post, commentData.comments || []));
            }
        } catch (error) {
            if (window.showToast) window.showToast('Failed loading post details', 'error');
        }
    },

    createPostDetailHTML(post, comments) {
        return `
            <div style="display:flex; flex-direction:column; max-height:80vh;">
                <div class="modal-header">
                    <div class="modal-title">Post by @${post.username}</div>
                    <div class="modal-close" onclick="App.closeModal()">✕</div>
                </div>
                <div style="display:flex; flex:1; min-height:0; overflow:hidden;">
                    <!-- Media Preview Left -->
                    <div style="flex:1.2; background:#000; display:flex; align-items:center; justify-content:center; max-height:500px;">
                        ${post.media && post.media[0] && post.media[0].media_type === 'video'
                            ? `<video src="${post.media[0].media_url}" controls playsinline style="max-height:100%; max-width:100%;"></video>`
                            : `<img src="${post.media && post.media[0] ? post.media[0].media_url : ''}" style="max-height:100%; max-width:100%; object-fit:contain;">`
                        }
                    </div>
                    <!-- Comments Stream Right -->
                    <div style="flex:1; display:flex; flex-direction:column; padding:16px; min-width:280px;">
                        <div style="flex:1; overflow-y:auto; padding-right:8px;" id="modal-comments-list">
                            ${post.caption ? `
                                <div style="display:flex; gap:10px; margin-bottom:16px;">
                                    <img src="${post.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                                    <div style="font-size:13px; line-height:1.4;">
                                        <strong>${post.username}</strong> ${Feed.formatCaption(post.caption)}
                                    </div>
                                </div>
                            ` : ''}
                            ${comments.map(c => `
                                <div style="display:flex; gap:10px; margin-bottom:12px;">
                                    <img src="${c.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                                    <div style="flex:1; font-size:13px;">
                                        <strong>${c.username}</strong> ${c.content}
                                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                                            ${Feed.timeAgo(c.created_at)} • ${c.likes_count} likes
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <form style="display:flex; gap:8px; margin-top:12px;" onsubmit="Feed.submitModalComment(event, ${post.post_id})">
                            <input type="text" id="modal-comment-input" placeholder="Add a comment..." style="flex:1; padding:8px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                            <button type="submit" class="btn btn-primary" style="padding:6px 14px;">Post</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    async submitModalComment(event, postId) {
        event.preventDefault();
        const input = document.getElementById('modal-comment-input');
        if (!input || !input.value.trim()) return;
        const content = input.value.trim();
        input.value = '';

        try {
            await API.post(`/comments/post/${postId}`, { content });
            this.openPostDetailModal(postId); // Refresh
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
        }
    },

    async loadSuggestions() {
        const list = document.getElementById('suggestions-list');
        if (!list) return;

        try {
            const data = await API.get('/search/suggested');
            if (data.success && data.suggestions) {
                list.innerHTML = data.suggestions.slice(0, 5).map(u => `
                    <div class="suggestion-row">
                        <div class="suggestion-user" onclick="App.navigateTo('#profile?u=${u.username}')" style="cursor:pointer;">
                            <img src="${u.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm" alt="${u.username}">
                            <div class="suggestion-user-info">
                                <div class="username">${u.username}</div>
                                <div class="subtext">${u.mutual_count > 0 ? `${u.mutual_count} mutual followers` : 'Suggested for you'}</div>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="font-size:12px; padding:4px 10px;" onclick="User.toggleFollow(${u.user_id}, this)">Follow</button>
                    </div>
                `).join('');
            }
        } catch (e) {
            list.innerHTML = '';
        }
    },

    showPostOptions(postId, ownerId) {
        const isMyPost = Auth.currentUser && Auth.currentUser.user_id === ownerId;
        const isAdmin = Auth.currentUser && Auth.currentUser.role === 'admin';

        App.showModal(`
            <div style="padding:12px; text-align:center; display:flex; flex-direction:column; gap:4px;">
                ${isMyPost || isAdmin ? `
                    <button class="btn" style="color:var(--danger); font-weight:700; width:100%;" onclick="Feed.deletePost(${postId})">Delete Post</button>
                    <button class="btn" style="width:100%;" onclick="Feed.toggleArchivePost(${postId})">Archive / Unarchive</button>
                ` : `
                    <button class="btn" style="color:var(--danger); font-weight:700; width:100%;" onclick="Feed.reportPost(${postId})">Report Post</button>
                `}
                <button class="btn" style="width:100%;" onclick="Feed.copyPostLink(${postId})">Copy Link</button>
                <button class="btn" style="width:100%; color:var(--text-muted);" onclick="App.closeModal()">Cancel</button>
            </div>
        `);
    },

    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) return;
        try {
            await API.delete(`/posts/${postId}`);
            App.closeModal();
            const elem = document.getElementById(`post-${postId}`);
            if (elem) elem.remove();
            if (window.showToast) window.showToast('Post deleted', 'success');
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
        }
    },

    copyPostLink(postId) {
        const url = `${window.location.origin}/#post?id=${postId}`;
        navigator.clipboard.writeText(url);
        App.closeModal();
        if (window.showToast) window.showToast('Link copied to clipboard', 'info');
    },

    initInfiniteScroll() {
        window.onscroll = () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                if (window.location.hash === '#feed' || window.location.hash === '') {
                    this.loadPosts();
                }
            }
        };
    },

    timeAgo(dateStr) {
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return `${Math.max(seconds, 1)}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
};

window.Feed = Feed;
