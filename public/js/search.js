// =====================================================================
// PIXORA SEARCH CONTROLLER
// =====================================================================

const Search = {
    debounceTimer: null,

    async renderSearch(container) {
        container.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto; width: 100%;">
                <h2 style="font-size:22px; font-weight:800; margin-bottom:16px;">Search</h2>
                <div style="position:relative; margin-bottom:20px;">
                    <input type="text" id="main-search-input" placeholder="Search users, hashtags (#travel), locations..." oninput="Search.handleSearchInput(this.value)" style="width:100%; padding:12px 18px; background:var(--bg-surface); border:1px solid var(--border-medium); border-radius:var(--radius-xl); font-size:14px;" autofocus>
                </div>

                <!-- Results or Recent Searches -->
                <div id="search-content-area">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="font-size:14px; font-weight:700; color:var(--text-secondary);">Recent Searches</span>
                        <span style="font-size:12px; font-weight:700; color:var(--brand-primary); cursor:pointer;" onclick="Search.clearRecent()">Clear All</span>
                    </div>
                    <div id="recent-searches-list">
                        <div class="skeleton" style="height:40px; margin-bottom:8px;"></div>
                        <div class="skeleton" style="height:40px;"></div>
                    </div>
                </div>
            </div>
        `;

        this.loadRecentSearches();
    },

    async loadRecentSearches() {
        const list = document.getElementById('recent-searches-list');
        if (!list) return;

        try {
            const data = await API.get('/search/recent');
            if (data.success && data.history) {
                if (data.history.length === 0) {
                    list.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding:20px 0; text-align:center;">No recent searches.</div>';
                    return;
                }

                list.innerHTML = data.history.map(item => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="Search.executeSearchQuery('${item.query_text}')">
                            <span style="font-size:16px;">🔍</span>
                            <div>
                                <strong style="font-size:13px;">${item.query_text}</strong>
                                <div style="font-size:11px; color:var(--text-muted); text-transform:capitalize;">${item.search_type}</div>
                            </div>
                        </div>
                        <button class="btn btn-icon" onclick="Search.removeRecentItem(${item.search_id})">✕</button>
                    </div>
                `).join('');
            }
        } catch (e) {
            list.innerHTML = '';
        }
    },

    handleSearchInput(query) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.executeSearch(query.trim());
        }, 250);
    },

    async executeSearch(query) {
        const contentArea = document.getElementById('search-content-area');
        if (!contentArea) return;

        if (!query || query.length === 0) {
            this.renderSearch(document.getElementById('view-container'));
            return;
        }

        try {
            const data = await API.get(`/search?q=${encodeURIComponent(query)}`);
            if (data.success) {
                contentArea.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:20px;">
                        <!-- Users -->
                        <div>
                            <div style="font-size:13px; font-weight:700; color:var(--text-secondary); margin-bottom:8px; text-transform:uppercase;">Users (${data.users.length})</div>
                            ${data.users.length === 0 ? '<div style="font-size:13px; color:var(--text-muted);">No matching users found.</div>' : ''}
                            ${data.users.map(u => `
                                <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:6px; cursor:pointer;" onclick="Search.saveAndNavigateUser(${u.user_id}, '${u.username}')">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <img src="${u.avatar_url || '/assets/default-avatar.svg'}" class="avatar avatar-sm">
                                        <div>
                                            <div style="font-weight:700; font-size:13px;">${u.username}</div>
                                            <div style="font-size:11px; color:var(--text-muted);">${u.full_name || ''}</div>
                                        </div>
                                    </div>
                                    <button class="btn btn-outline" style="font-size:11px; padding:3px 10px;">View</button>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Hashtags -->
                        <div>
                            <div style="font-size:13px; font-weight:700; color:var(--text-secondary); margin-bottom:8px; text-transform:uppercase;">Hashtags (${data.hashtags.length})</div>
                            ${data.hashtags.map(h => `
                                <div style="padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:6px; cursor:pointer;" onclick="App.navigateTo('#explore')">
                                    <div style="font-weight:700; color:var(--brand-primary); font-size:14px;">#${h.name}</div>
                                    <div style="font-size:11px; color:var(--text-muted);">${h.post_count} posts</div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Locations -->
                        <div>
                            <div style="font-size:13px; font-weight:700; color:var(--text-secondary); margin-bottom:8px; text-transform:uppercase;">Locations (${data.locations.length})</div>
                            ${data.locations.map(l => `
                                <div style="padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:6px;">
                                    <div style="font-weight:700; font-size:14px;">📍 ${l.name}</div>
                                    <div style="font-size:11px; color:var(--text-muted);">${l.city || ''} ${l.country ? '(' + l.country + ')' : ''}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Search failure:', e);
        }
    },

    async saveAndNavigateUser(userId, username) {
        API.post('/search/recent', { search_type: 'user', target_id: userId, query_text: username }).catch(() => {});
        App.navigateTo(`#profile?u=${username}`);
    },

    executeSearchQuery(text) {
        const input = document.getElementById('main-search-input');
        if (input) {
            input.value = text;
            this.executeSearch(text);
        }
    },

    async clearRecent() {
        try {
            await API.delete('/search/recent');
            this.loadRecentSearches();
        } catch (e) {}
    },

    async removeRecentItem(searchId) {
        try {
            await API.delete(`/search/recent/${searchId}`);
            this.loadRecentSearches();
        } catch (e) {}
    }
};

window.Search = Search;
