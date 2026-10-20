// =====================================================================
// PIXORA EXPLORE PAGE CONTROLLER
// =====================================================================

const Explore = {
    async renderExplore(container) {
        container.innerHTML = `
            <div style="max-width: 960px; margin: 0 auto; width: 100%;">
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size:24px; font-weight:800; margin-bottom:6px;">Explore Trending</h2>
                    <p style="color:var(--text-secondary); font-size:14px;">Discover top visual stories and creators across the world.</p>
                </div>
                <div id="explore-grid" class="media-grid">
                    <div class="skeleton" style="aspect-ratio:1/1;"></div>
                    <div class="skeleton" style="aspect-ratio:1/1;"></div>
                    <div class="skeleton" style="aspect-ratio:1/1;"></div>
                    <div class="skeleton" style="aspect-ratio:1/1;"></div>
                    <div class="skeleton" style="aspect-ratio:1/1;"></div>
                    <div class="skeleton" style="aspect-ratio:1/1;"></div>
                </div>
            </div>
        `;

        try {
            const data = await API.get('/posts/explore?limit=30');
            const grid = document.getElementById('explore-grid');
            if (data.success && data.posts) {
                if (data.posts.length === 0) {
                    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">No public explore posts yet.</div>';
                    return;
                }

                grid.innerHTML = data.posts.map(post => `
                    <div class="grid-item" onclick="Feed.openPostDetailModal(${post.post_id})">
                        ${post.primary_media_type === 'video'
                            ? `<video src="${post.primary_media_url}" preload="metadata"></video>`
                            : `<img src="${post.primary_media_url || '/assets/default-avatar.svg'}" alt="Explore image" loading="lazy">`
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
            console.error('Failed loading explore grid:', error);
        }
    }
};

window.Explore = Explore;
