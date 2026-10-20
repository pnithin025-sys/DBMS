// =====================================================================
// PIXORA REELS (SHORT-FORM VERTICAL VIDEOS) CONTROLLER
// =====================================================================

const Reels = {
    isMuted: true,

    async renderReels(container) {
        container.innerHTML = `
            <div style="display:flex; justify-content:center; width:100%; height:100%;">
                <div class="reels-container" id="reels-feed-container">
                    <div style="text-align:center; padding:60px 0;">
                        <div class="spinner" style="margin:0 auto 16px;"></div>
                        <p style="color:var(--text-muted);">Loading vertical reels...</p>
                    </div>
                </div>
            </div>
        `;

        try {
            const data = await API.get('/reels');
            const feedContainer = document.getElementById('reels-feed-container');

            if (data.success && data.reels) {
                if (data.reels.length === 0) {
                    feedContainer.innerHTML = `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted);">
                            <div style="font-size:48px; margin-bottom:12px;">🎬</div>
                            <h3>No Reels Yet</h3>
                            <p style="font-size:14px; margin:8px 0 16px;">Be the first creator to share a short video!</p>
                            <button class="btn btn-primary" onclick="App.openCreateReelModal()">Upload Reel</button>
                        </div>
                    `;
                    return;
                }

                feedContainer.innerHTML = data.reels.map(reel => `
                    <div class="reel-card" id="reel-${reel.reel_id}">
                        <video class="reel-video" src="${reel.video_url}" loop playsinline preload="auto" onclick="Reels.toggleVideoPlayback(this)"></video>

                        <!-- Double tap heart -->
                        <svg class="double-tap-heart" id="reel-heart-anim-${reel.reel_id}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>

                        <!-- Creator Info Overlay (Bottom Left) -->
                        <div class="reel-info-overlay">
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                                <img src="${reel.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm" onclick="App.navigateTo('#profile?u=${reel.username}')" style="cursor:pointer;">
                                <strong style="cursor:pointer;" onclick="App.navigateTo('#profile?u=${reel.username}')">@${reel.username}</strong>
                                ${reel.is_verified ? '<svg class="badge-verified" width="14" height="14"><use href="/assets/icons.svg#icon-verified"/></svg>' : ''}
                                ${!reel.is_following && Auth.currentUser && Auth.currentUser.user_id !== reel.user_id ? `
                                    <button class="btn btn-outline" style="padding:2px 10px; font-size:11px; border-color:rgba(255,255,255,0.6); color:#FFF;" onclick="User.toggleFollow(${reel.user_id}, this)">Follow</button>
                                ` : ''}
                            </div>
                            <div style="font-size:13px; line-height:1.4; text-shadow:0 1px 3px rgba(0,0,0,0.8);">
                                ${Feed.formatCaption(reel.caption || '')}
                            </div>
                        </div>

                        <!-- Right Sidebar Floating Action Icons -->
                        <div class="reel-sidebar-actions">
                            <div class="reel-action-btn ${reel.is_liked_by_me ? 'liked' : ''}" id="reel-like-btn-${reel.reel_id}" onclick="Reels.toggleReelLike(${reel.reel_id})">
                                <svg width="28" height="28" style="${reel.is_liked_by_me ? 'color:#EC4899;' : ''}"><use href="/assets/icons.svg#${reel.is_liked_by_me ? 'icon-heart-filled' : 'icon-heart'}"/></svg>
                                <span id="reel-likes-count-${reel.reel_id}">${reel.likes_count}</span>
                            </div>

                            <div class="reel-action-btn" onclick="Reels.openReelComments(${reel.reel_id})">
                                <svg width="28" height="28"><use href="/assets/icons.svg#icon-comment"/></svg>
                                <span>${reel.comments_count}</span>
                            </div>

                            <div class="reel-action-btn" onclick="Reels.toggleMute()">
                                <svg width="26" height="26" id="reel-sound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                                <span>Sound</span>
                            </div>

                            <div class="reel-action-btn" style="font-size:11px;">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span>${reel.view_count}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                this.initIntersectionObserver();
            }
        } catch (error) {
            console.error('Failed loading reels:', error);
        }
    },

    initIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                if (video) {
                    if (entry.isIntersecting) {
                        video.muted = this.isMuted;
                        video.play().catch(() => {});
                        const reelId = entry.target.id.replace('reel-', '');
                        API.post(`/reels/${reelId}/view`, {}).catch(() => {});
                    } else {
                        video.pause();
                    }
                }
            });
        }, { threshold: 0.65 });

        document.querySelectorAll('.reel-card').forEach(card => observer.observe(card));
    },

    toggleVideoPlayback(video) {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        document.querySelectorAll('.reel-video').forEach(v => {
            v.muted = this.isMuted;
        });
        if (window.showToast) window.showToast(this.isMuted ? 'Sound muted' : 'Sound on', 'info');
    },

    async toggleReelLike(reelId) {
        const btn = document.getElementById(`reel-like-btn-${reelId}`);
        const count = document.getElementById(`reel-likes-count-${reelId}`);

        try {
            const data = await API.post(`/reels/${reelId}/like`, {});
            if (data.success) {
                btn.innerHTML = `<svg width="28" height="28" style="${data.is_liked ? 'color:#EC4899;' : ''}"><use href="/assets/icons.svg#${data.is_liked ? 'icon-heart-filled' : 'icon-heart'}"/></svg><span id="reel-likes-count-${reelId}">${data.likes_count}</span>`;
            }
        } catch (error) {
            console.error('Reel like error:', error);
        }
    },

    async openReelComments(reelId) {
        try {
            const data = await API.get(`/reels/${reelId}/comments`);
            const comments = data.comments || [];

            App.showModal(`
                <div style="display:flex; flex-direction:column; max-height:70vh;">
                    <div class="modal-header">
                        <div class="modal-title">Comments (${comments.length})</div>
                        <div class="modal-close" onclick="App.closeModal()">✕</div>
                    </div>
                    <div class="modal-body" style="flex:1; overflow-y:auto;" id="reel-comments-list">
                        ${comments.length === 0 ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">No comments yet. Start the conversation!</p>' : ''}
                        ${comments.map(c => `
                            <div style="display:flex; gap:10px; margin-bottom:12px;">
                                <img src="${c.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                                <div>
                                    <strong style="font-size:13px;">${c.username}</strong>
                                    <div style="font-size:13px; margin-top:2px;">${c.content}</div>
                                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${Feed.timeAgo(c.created_at)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <form style="display:flex; gap:8px; padding:12px; border-top:1px solid var(--border-subtle);" onsubmit="Reels.submitReelComment(event, ${reelId})">
                        <input type="text" id="reel-comment-input" placeholder="Add a comment..." style="flex:1; padding:10px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                        <button type="submit" class="btn btn-primary">Post</button>
                    </form>
                </div>
            `);
        } catch (e) {
            if (window.showToast) window.showToast('Failed to load comments', 'error');
        }
    },

    async submitReelComment(event, reelId) {
        event.preventDefault();
        const input = document.getElementById('reel-comment-input');
        if (!input || !input.value.trim()) return;

        const content = input.value.trim();
        input.value = '';

        try {
            await API.post(`/reels/${reelId}/comments`, { content });
            this.openReelComments(reelId); // Refresh modal
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    }
};

window.Reels = Reels;
