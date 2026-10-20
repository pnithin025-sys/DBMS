// =====================================================================
// PIXORA NOTIFICATIONS DRAWER CONTROLLER
// =====================================================================

const Notifications = {
    async renderNotifications(container) {
        container.innerHTML = `
            <div style="max-width: 680px; margin: 0 auto; width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="font-size:22px; font-weight:800;">Notifications</h2>
                    <button class="btn btn-outline" style="font-size:12px; padding:6px 12px;" onclick="Notifications.markAllRead()">Mark all as read</button>
                </div>
                <div id="notifications-list-container">
                    <div style="text-align:center; padding:40px;">
                        <div class="spinner" style="margin:0 auto 10px;"></div>
                    </div>
                </div>
            </div>
        `;

        try {
            const data = await API.get('/notifications');
            const list = document.getElementById('notifications-list-container');

            if (data.success && data.notifications) {
                if (data.notifications.length === 0) {
                    list.innerHTML = `
                        <div style="text-align:center; padding:60px 20px; background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-subtle); color:var(--text-muted);">
                            <div style="font-size:40px; margin-bottom:12px;">🔔</div>
                            <h3>No notifications yet</h3>
                            <p style="font-size:13px; margin-top:6px;">When someone likes your photos, comments, or follows you, you'll see it here.</p>
                        </div>
                    `;
                    return;
                }

                list.innerHTML = data.notifications.map(n => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:8px; ${!n.is_read ? 'border-left: 4px solid var(--brand-primary);' : ''}">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${n.actor_avatar || '/assets/default-avatar.svg'}" class="avatar avatar-md" style="cursor:pointer;" onclick="App.navigateTo('#profile?u=${n.actor_username}')">
                            <div style="font-size:13px; line-height:1.4;">
                                <strong style="cursor:pointer;" onclick="App.navigateTo('#profile?u=${n.actor_username}')">@${n.actor_username}</strong>
                                ${this.getNotificationText(n.type)}
                                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${Feed.timeAgo(n.created_at)}</div>
                            </div>
                        </div>

                        ${n.post_preview_media ? `
                            <img src="${n.post_preview_media}" style="width:40px; height:40px; object-fit:cover; border-radius:var(--radius-sm); cursor:pointer;" onclick="Feed.openPostDetailModal(${n.entity_id})">
                        ` : ''}

                        ${n.type === 'follow' || n.type === 'follow_request' ? `
                            <button class="btn btn-primary" style="font-size:12px; padding:4px 12px;" onclick="User.toggleFollow(${n.actor_id}, this)">Follow Back</button>
                        ` : ''}
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed loading notifications:', error);
        }
    },

    getNotificationText(type) {
        switch (type) {
            case 'like_post': return 'liked your post.';
            case 'like_comment': return 'liked your comment.';
            case 'comment': return 'commented on your post.';
            case 'reply': return 'replied to your comment.';
            case 'follow': return 'started following you.';
            case 'follow_request': return 'sent you a follow request.';
            case 'mention': return 'mentioned you in a caption.';
            case 'tag': return 'tagged you in a post.';
            default: return 'interacted with your content.';
        }
    },

    async markAllRead() {
        try {
            await API.put('/notifications/mark-all-read', {});
            const badge = document.getElementById('notif-badge-counter');
            if (badge) badge.style.display = 'none';
            if (window.showToast) window.showToast('All notifications marked as read', 'success');
            this.renderNotifications(document.getElementById('view-container'));
        } catch (error) {
            console.error('Mark all read error:', error);
        }
    }
};

window.Notifications = Notifications;
