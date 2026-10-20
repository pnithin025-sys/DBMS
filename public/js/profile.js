// =====================================================================
// PIXORA USER PROFILE CONTROLLER
// =====================================================================

const User = {
    currentProfileUser: null,
    activeTab: 'posts',

    async renderProfile(container, targetUsername) {
        const username = targetUsername || (Auth.currentUser ? Auth.currentUser.username : '');
        if (!username) {
            App.navigateTo('#login');
            return;
        }

        container.innerHTML = `
            <div style="max-width: 900px; margin: 0 auto; width: 100%;" id="profile-inner-view">
                <div style="text-align:center; padding:60px 0;">
                    <div class="spinner" style="margin:0 auto 16px;"></div>
                    <p style="color:var(--text-muted);">Loading profile...</p>
                </div>
            </div>
        `;

        try {
            const data = await API.get(`/users/profile/${username}`);
            if (!data.success || !data.user) {
                container.innerHTML = '<div style="text-align:center; padding:60px 0;"><h3>User not found</h3></div>';
                return;
            }

            const user = data.user;
            this.currentProfileUser = user;
            const isMe = user.relationship.is_me;

            container.innerHTML = `
                <div style="max-width: 900px; margin: 0 auto; width: 100%;">
                    <!-- Profile Header -->
                    <div class="profile-header">
                        <div class="avatar-container">
                            <img src="${user.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-2xl" id="profile-page-avatar" alt="${user.username}">
                        </div>

                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; align-items:center; gap:16px; margin-bottom:14px; flex-wrap:wrap;">
                                <h2 style="font-size:22px; font-weight:700;">${user.username}</h2>
                                ${user.is_verified ? '<svg class="badge-verified" width="18" height="18"><use href="/assets/icons.svg#icon-verified"/></svg>' : ''}

                                ${isMe ? `
                                    <button class="btn btn-secondary" onclick="User.openEditProfileModal()">Edit Profile</button>
                                    <button class="btn btn-icon" onclick="App.navigateTo('#settings')">
                                        <svg width="22" height="22"><use href="/assets/icons.svg#icon-settings"/></svg>
                                    </button>
                                ` : `
                                    <button class="btn ${user.relationship.following_status === 'following' ? 'btn-secondary' : 'btn-primary'}" id="profile-follow-btn" onclick="User.handleProfileFollow(${user.user_id})">
                                        ${user.relationship.following_status === 'following' ? 'Following' : user.relationship.following_status === 'pending' ? 'Requested' : 'Follow'}
                                    </button>
                                    <button class="btn btn-secondary" onclick="User.startDirectMessage(${user.user_id})">Message</button>
                                `}
                            </div>

                            <!-- Counts -->
                            <div class="profile-stats">
                                <div class="profile-stat-item"><strong>${user.posts_count || 0}</strong> posts</div>
                                <div class="profile-stat-item" onclick="User.openFollowersModal(${user.user_id})"><strong>${user.followers_count || 0}</strong> followers</div>
                                <div class="profile-stat-item" onclick="User.openFollowingModal(${user.user_id})"><strong>${user.following_count || 0}</strong> following</div>
                            </div>

                            <!-- Bio & Website -->
                            <div>
                                <div style="font-weight:700; font-size:14px;">${user.full_name || ''}</div>
                                ${user.bio ? `<div style="font-size:14px; margin-top:4px; line-height:1.4; color:var(--text-secondary);">${user.bio}</div>` : ''}
                                ${user.website ? `<a href="${user.website}" target="_blank" rel="noopener" style="font-size:13px; font-weight:600; color:var(--brand-primary); display:inline-block; margin-top:4px;">🔗 ${user.website.replace('https://', '').replace('http://', '')}</a>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Story Highlights Row -->
                    ${user.highlights && user.highlights.length > 0 ? `
                        <div style="display:flex; gap:16px; margin-bottom:24px; overflow-x:auto; padding-bottom:8px;">
                            ${user.highlights.map(hl => `
                                <div style="display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer;" onclick="User.openHighlight(${hl.highlight_id})">
                                    <div class="story-ring" style="padding:2px; background:var(--border-medium);">
                                        <img src="${hl.cover_image_url || '/assets/default-avatar.svg'}" class="avatar avatar-lg">
                                    </div>
                                    <span style="font-size:12px; font-weight:600;">${hl.title}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <!-- Tabs -->
                    <div class="profile-tabs">
                        <div class="profile-tab-btn active" id="tab-posts" onclick="User.switchTab('posts')">POSTS</div>
                        ${isMe ? '<div class="profile-tab-btn" id="tab-saved" onclick="User.switchTab(\'saved\')">SAVED</div>' : ''}
                        <div class="profile-tab-btn" id="tab-tagged" onclick="User.switchTab('tagged')">TAGGED</div>
                    </div>

                    <!-- Tab Grid Container -->
                    <div id="profile-grid-container" class="media-grid">
                        <div class="skeleton" style="aspect-ratio:1/1;"></div>
                        <div class="skeleton" style="aspect-ratio:1/1;"></div>
                        <div class="skeleton" style="aspect-ratio:1/1;"></div>
                    </div>
                </div>
            `;

            this.loadTabPosts(user.username, 'posts');
        } catch (error) {
            console.error('Failed rendering profile:', error);
        }
    },

    async switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.profile-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`tab-${tab}`);
        if (activeBtn) activeBtn.classList.add('active');

        if (this.currentProfileUser) {
            this.loadTabPosts(this.currentProfileUser.username, tab);
        }
    },

    async loadTabPosts(username, tab) {
        const grid = document.getElementById('profile-grid-container');
        if (!grid) return;

        try {
            const data = await API.get(`/posts/user/${username}?type=${tab}`);
            if (data.success && data.posts) {
                if (data.posts.length === 0) {
                    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 0; color:var(--text-muted);">No ${tab} yet.</div>`;
                    return;
                }

                grid.innerHTML = data.posts.map(post => `
                    <div class="grid-item" onclick="Feed.openPostDetailModal(${post.post_id})">
                        ${post.primary_media_type === 'video'
                            ? `<video src="${post.primary_media_url}" preload="metadata"></video>`
                            : `<img src="${post.primary_media_url || '/assets/default-avatar.svg'}" loading="lazy">`
                        }
                        <div class="grid-item-overlay">
                            <span style="display:flex; align-items:center; gap:6px; font-weight:700;">
                                <svg width="20" height="20"><use href="/assets/icons.svg#icon-heart-filled"/></svg>
                                ${post.likes_count}
                            </span>
                            <span style="display:flex; align-items:center; gap:6px; font-weight:700;">
                                <svg width="20" height="20"><use href="/assets/icons.svg#icon-comment"/></svg>
                                ${post.comments_count}
                            </span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--danger);">Content unavailable.</div>';
        }
    },

    async handleProfileFollow(targetId) {
        const btn = document.getElementById('profile-follow-btn');
        try {
            if (btn.textContent.trim() === 'Following' || btn.textContent.trim() === 'Requested') {
                const data = await API.delete(`/users/follow/${targetId}`);
                if (data.success) {
                    btn.textContent = 'Follow';
                    btn.className = 'btn btn-primary';
                }
            } else {
                const data = await API.post(`/users/follow/${targetId}`, {});
                if (data.success) {
                    btn.textContent = data.status === 'pending' ? 'Requested' : 'Following';
                    btn.className = 'btn btn-secondary';
                }
            }
        } catch (error) {
            console.error('Follow error:', error);
        }
    },

    async toggleFollow(targetId, btnElem) {
        try {
            if (btnElem.textContent.trim() === 'Following') {
                await API.delete(`/users/follow/${targetId}`);
                btnElem.textContent = 'Follow';
                btnElem.className = 'btn btn-outline';
            } else {
                const data = await API.post(`/users/follow/${targetId}`, {});
                btnElem.textContent = data.status === 'pending' ? 'Requested' : 'Following';
                btnElem.className = 'btn btn-secondary';
            }
        } catch (error) {
            console.error('Follow error:', error);
        }
    },

    async startDirectMessage(targetUserId) {
        try {
            const data = await API.post('/messages/direct', { target_user_id: targetUserId });
            if (data.success && data.conversation_id) {
                App.navigateTo(`#messages?c=${data.conversation_id}`);
            }
        } catch (error) {
            if (window.showToast) window.showToast('Could not open direct chat', 'error');
        }
    },

    openEditProfileModal() {
        if (!this.currentProfileUser) return;
        const u = this.currentProfileUser;

        App.showModal(`
            <div style="display:flex; flex-direction:column;">
                <div class="modal-header">
                    <div class="modal-title">Edit Profile</div>
                    <div class="modal-close" onclick="App.closeModal()">✕</div>
                </div>
                <form class="modal-body" onsubmit="User.submitEditProfile(event)" style="display:flex; flex-direction:column; gap:16px;">
                    <!-- Avatar Upload -->
                    <div style="display:flex; align-items:center; gap:16px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle);">
                        <img src="${u.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-lg" id="edit-avatar-preview">
                        <div>
                            <label class="btn btn-outline" style="font-size:13px; cursor:pointer;">
                                Change Photo
                                <input type="file" id="edit-avatar-file" accept="image/*" style="display:none;" onchange="User.handleAvatarPreview(this)">
                            </label>
                        </div>
                    </div>

                    <div>
                        <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px;">Full Name</label>
                        <input type="text" id="edit-fullname" value="${u.full_name || ''}" style="width:100%; padding:10px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                    </div>

                    <div>
                        <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px;">Bio</label>
                        <textarea id="edit-bio" rows="3" style="width:100%; padding:10px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">${u.bio || ''}</textarea>
                    </div>

                    <div>
                        <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px;">Website</label>
                        <input type="url" id="edit-website" value="${u.website || ''}" placeholder="https://yourwebsite.com" style="width:100%; padding:10px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                    </div>

                    <div style="display:flex; align-items:center; justify-content:space-between; padding-top:8px;">
                        <div>
                            <div style="font-weight:700; font-size:14px;">Private Account</div>
                            <div style="font-size:12px; color:var(--text-muted);">Only approved followers can see your posts & stories</div>
                        </div>
                        <input type="checkbox" id="edit-private" ${u.is_private ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--brand-primary);">
                    </div>

                    <button type="submit" class="btn btn-primary" style="margin-top:12px;">Save Changes</button>
                </form>
            </div>
        `);
    },

    handleAvatarPreview(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('edit-avatar-preview');
                if (img) img.src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    async submitEditProfile(event) {
        event.preventDefault();
        const full_name = document.getElementById('edit-fullname').value;
        const bio = document.getElementById('edit-bio').value;
        const website = document.getElementById('edit-website').value;
        const is_private = document.getElementById('edit-private').checked;
        const fileInput = document.getElementById('edit-avatar-file');

        try {
            // Update details
            await API.put('/users/profile', { full_name, bio, website, is_private });

            // Update avatar if selected
            if (fileInput && fileInput.files[0]) {
                const formData = new FormData();
                formData.append('avatar', fileInput.files[0]);
                await API.post('/users/avatar', formData);
            }

            if (window.showToast) window.showToast('Profile updated!', 'success');
            App.closeModal();
            // Refresh
            if (Auth.currentUser) {
                User.renderProfile(document.getElementById('view-container'), Auth.currentUser.username);
            }
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
        }
    },

    async openFollowersModal(userId) {
        try {
            const data = await API.get(`/users/${userId}/followers`);
            const followers = data.followers || [];
            App.showModal(`
                <div>
                    <div class="modal-header">
                        <div class="modal-title">Followers (${followers.length})</div>
                        <div class="modal-close" onclick="App.closeModal()">✕</div>
                    </div>
                    <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
                        ${followers.map(f => `
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                                <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="App.closeModal(); App.navigateTo('#profile?u=${f.username}')">
                                    <img src="${f.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                                    <div>
                                        <strong>${f.username}</strong>
                                        <div style="font-size:12px; color:var(--text-muted);">${f.full_name || ''}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `);
        } catch (e) {
            console.error('Followers modal error:', e);
        }
    },

    async openFollowingModal(userId) {
        try {
            const data = await API.get(`/users/${userId}/following`);
            const following = data.following || [];
            App.showModal(`
                <div>
                    <div class="modal-header">
                        <div class="modal-title">Following (${following.length})</div>
                        <div class="modal-close" onclick="App.closeModal()">✕</div>
                    </div>
                    <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
                        ${following.map(f => `
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                                <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="App.closeModal(); App.navigateTo('#profile?u=${f.username}')">
                                    <img src="${f.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                                    <div>
                                        <strong>${f.username}</strong>
                                        <div style="font-size:12px; color:var(--text-muted);">${f.full_name || ''}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `);
        } catch (e) {
            console.error('Following modal error:', e);
        }
    }
};

window.User = User;
