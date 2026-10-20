// =====================================================================
// PIXORA STORIES FULL-SCREEN VIEWER
// =====================================================================

const Stories = {
    currentStories: [],
    currentIndex: 0,
    timer: null,
    progressInterval: null,
    storyDuration: 5000, // 5s for images

    openStoryViewer(stories, startIndex = 0) {
        if (!stories || stories.length === 0) return;

        this.currentStories = stories;
        this.currentIndex = startIndex;

        const modal = document.getElementById('story-viewer-modal');
        if (!modal) return;

        modal.classList.add('active');
        this.renderStoryItem();
    },

    closeStoryViewer() {
        this.clearTimers();
        const modal = document.getElementById('story-viewer-modal');
        if (modal) modal.classList.remove('active');
    },

    renderStoryItem() {
        this.clearTimers();
        const story = this.currentStories[this.currentIndex];
        if (!story) {
            this.closeStoryViewer();
            return;
        }

        const modal = document.getElementById('story-viewer-modal');
        modal.innerHTML = `
            <div class="story-viewer-box">
                <!-- Progress Bars -->
                <div class="story-progress-bars">
                    ${this.currentStories.map((_, i) => `
                        <div class="story-bar">
                            <div class="story-bar-fill" id="bar-fill-${i}" style="width: ${i < this.currentIndex ? '100%' : '0%'};"></div>
                        </div>
                    `).join('')}
                </div>

                <!-- Header Overlay -->
                <div class="story-header-overlay">
                    <div style="display:flex; align-items:center; gap:10px; color:#FFF;">
                        <img src="${story.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                        <strong style="font-size:14px;">${story.username}</strong>
                        ${story.is_close_friends_only ? '<span style="background:#10B981; color:#FFF; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">CLOSE FRIENDS</span>' : ''}
                        <span style="font-size:11px; opacity:0.8;">${Feed.timeAgo(story.created_at)}</span>
                    </div>
                    <button style="color:#FFF; font-size:20px; cursor:pointer;" onclick="Stories.closeStoryViewer()">✕</button>
                </div>

                <!-- Media -->
                <div class="story-media-container">
                    ${story.media_type === 'video'
                        ? `<video id="story-active-video" src="${story.media_url}" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>`
                        : `<img src="${story.media_url}" style="width:100%; height:100%; object-fit:cover;">`
                    }
                </div>

                <!-- Touch / Click Zones -->
                <div class="story-tap-left" onclick="Stories.prevStory()"></div>
                <div class="story-tap-right" onclick="Stories.nextStory()"></div>

                <!-- Footer Reply Bar -->
                <div class="story-reply-footer">
                    <input type="text" id="story-reply-input" placeholder="Reply to @${story.username}..." onkeydown="if(event.key==='Enter') Stories.sendStoryReply(${story.user_id}, ${story.story_id})">
                    <button class="btn btn-icon" style="color:#FFF;" onclick="Stories.sendStoryReply(${story.user_id}, ${story.story_id})">
                        <svg width="22" height="22"><use href="/assets/icons.svg#icon-share"/></svg>
                    </button>
                </div>
            </div>
        `;

        // Record view in database
        API.post(`/stories/${story.story_id}/view`, {}).catch(() => {});

        // Start progress bar animation
        this.startProgressBar();
    },

    startProgressBar() {
        const fillBar = document.getElementById(`bar-fill-${this.currentIndex}`);
        if (!fillBar) return;

        let elapsed = 0;
        const intervalMs = 50;
        const totalDuration = this.storyDuration;

        this.progressInterval = setInterval(() => {
            elapsed += intervalMs;
            const percent = Math.min((elapsed / totalDuration) * 100, 100);
            fillBar.style.width = `${percent}%`;

            if (elapsed >= totalDuration) {
                this.nextStory();
            }
        }, intervalMs);
    },

    clearTimers() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    },

    nextStory() {
        if (this.currentIndex < this.currentStories.length - 1) {
            this.currentIndex++;
            this.renderStoryItem();
        } else {
            this.closeStoryViewer();
        }
    },

    prevStory() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderStoryItem();
        } else {
            this.renderStoryItem();
        }
    },

    async sendStoryReply(authorId, storyId) {
        const input = document.getElementById('story-reply-input');
        if (!input || !input.value.trim()) return;

        const content = `Replied to your story: "${input.value.trim()}"`;
        input.value = '';

        try {
            // Get or create direct conversation
            const convData = await API.post('/messages/direct', { target_user_id: authorId });
            if (convData.success && convData.conversation_id) {
                await API.post(`/messages/conversations/${convData.conversation_id}`, {
                    content,
                    message_type: 'story_reply',
                    shared_item_id: storyId
                });
                if (window.showToast) window.showToast('Reply sent as direct message', 'success');
            }
        } catch (error) {
            console.error('Failed sending story reply:', error);
        }
    }
};

window.Stories = Stories;
