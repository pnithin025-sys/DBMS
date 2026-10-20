// =====================================================================
// PIXORA SPA MASTER CONTROLLER & ROUTER
// =====================================================================

const App = {
    currentTheme: localStorage.getItem('pixora_theme') || 'dark',

    async init() {
        // Apply theme
        document.documentElement.setAttribute('data-theme', this.currentTheme);

        // Check authentication state
        await Auth.checkAuth();

        // Listen for URL hash routing changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Initial route dispatch
        this.handleRoute();
    },

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('pixora_theme', this.currentTheme);
        
        // Update user setting if logged in
        if (Auth.currentUser) {
            API.put('/users/settings', { theme: this.currentTheme }).catch(() => {});
        }

        const icon = document.getElementById('theme-toggle-icon');
        if (icon) {
            icon.innerHTML = `<use href="/assets/icons.svg#${this.currentTheme === 'dark' ? 'icon-sun' : 'icon-moon'}"/>`;
        }
    },

    navigateTo(hash) {
        window.location.hash = hash;
    },

    handleRoute() {
        const hash = window.location.hash || '#feed';
        const user = Auth.currentUser;

        // Route protection: redirect to login if unauthenticated for protected views
        const publicRoutes = ['#login', '#register', '#forgot-password', '#reset-password', '#explore'];
        const isAuthRoute = hash.startsWith('#login') || hash.startsWith('#register') || hash.startsWith('#forgot-password') || hash.startsWith('#reset-password');

        if (!user && !publicRoutes.some(r => hash.startsWith(r))) {
            window.location.hash = '#login';
            this.renderAuthView('login');
            return;
        }

        if (user && isAuthRoute) {
            window.location.hash = '#feed';
            return;
        }

        if (isAuthRoute) {
            if (hash.startsWith('#register')) {
                this.renderAuthView('register');
            } else if (hash.startsWith('#forgot-password')) {
                this.renderAuthView('forgot');
            } else if (hash.startsWith('#reset-password')) {
                const params = new URLSearchParams(hash.split('?')[1]);
                this.renderAuthView('reset', params.get('token'));
            } else {
                this.renderAuthView('login');
            }
            return;
        }

        // Render main application shell
        this.renderAppShell();
        this.updateActiveNav(hash);

        const container = document.getElementById('view-container');
        if (!container) return;

        if (hash.startsWith('#feed')) {
            Feed.renderFeed(container);
        } else if (hash.startsWith('#explore')) {
            Explore.renderExplore(container);
        } else if (hash.startsWith('#reels')) {
            Reels.renderReels(container);
        } else if (hash.startsWith('#messages')) {
            const params = new URLSearchParams(hash.split('?')[1]);
            Messages.renderMessages(container, params.get('c'));
        } else if (hash.startsWith('#notifications')) {
            Notifications.renderNotifications(container);
        } else if (hash.startsWith('#search')) {
            Search.renderSearch(container);
        } else if (hash.startsWith('#profile')) {
            const params = new URLSearchParams(hash.split('?')[1]);
            User.renderProfile(container, params.get('u'));
        } else if (hash.startsWith('#settings')) {
            this.renderSettingsView(container);
        } else if (hash.startsWith('#admin')) {
            Admin.renderAdmin(container);
        } else {
            Feed.renderFeed(container);
        }
    },

    renderAppShell() {
        const root = document.getElementById('app-root');
        if (root.dataset.rendered === 'true') return; // Shell already active

        root.dataset.rendered = 'true';
        const user = Auth.currentUser;

        root.innerHTML = `
            <div id="app-layout">
                <!-- 1. DESKTOP SIDEBAR -->
                <aside class="sidebar">
                    <div>
                        <!-- Logo -->
                        <div class="sidebar-brand" onclick="App.navigateTo('#feed')">
                            <img src="/assets/logo.svg" width="34" height="34" alt="Pixora">
                            <span class="sidebar-brand-name">Pixora</span>
                        </div>

                        <!-- Navigation Links -->
                        <nav class="sidebar-nav">
                            <div class="nav-link" id="nav-feed" onclick="App.navigateTo('#feed')">
                                <svg><use href="/assets/icons.svg#icon-home"/></svg>
                                <span class="nav-label">Home</span>
                            </div>
                            <div class="nav-link" id="nav-search" onclick="App.navigateTo('#search')">
                                <svg><use href="/assets/icons.svg#icon-search"/></svg>
                                <span class="nav-label">Search</span>
                            </div>
                            <div class="nav-link" id="nav-explore" onclick="App.navigateTo('#explore')">
                                <svg><use href="/assets/icons.svg#icon-explore"/></svg>
                                <span class="nav-label">Explore</span>
                            </div>
                            <div class="nav-link" id="nav-reels" onclick="App.navigateTo('#reels')">
                                <svg><use href="/assets/icons.svg#icon-reels"/></svg>
                                <span class="nav-label">Reels</span>
                            </div>
                            <div class="nav-link" id="nav-messages" onclick="App.navigateTo('#messages')">
                                <svg><use href="/assets/icons.svg#icon-messages"/></svg>
                                <span class="nav-label">Messages</span>
                                <span class="nav-badge" id="msg-badge-counter" style="display:${user && user.unread_messages ? 'inline-block' : 'none'};">${user ? user.unread_messages : 0}</span>
                            </div>
                            <div class="nav-link" id="nav-notifications" onclick="App.navigateTo('#notifications')">
                                <svg><use href="/assets/icons.svg#icon-notifications"/></svg>
                                <span class="nav-label">Notifications</span>
                                <span class="nav-badge" id="notif-badge-counter" style="display:${user && user.unread_notifications ? 'inline-block' : 'none'};">${user ? user.unread_notifications : 0}</span>
                            </div>
                            <div class="nav-link" onclick="App.openCreatePostModal()">
                                <svg><use href="/assets/icons.svg#icon-create"/></svg>
                                <span class="nav-label">Create</span>
                            </div>
                            <div class="nav-link" id="nav-profile" onclick="App.navigateTo('#profile?u=${user ? user.username : ''}')">
                                <img src="${user ? user.avatar_url : '/assets/default-avatar.svg'}" class="avatar avatar-xs">
                                <span class="nav-label">Profile</span>
                            </div>
                            ${user && user.role === 'admin' ? `
                                <div class="nav-link" id="nav-admin" onclick="App.navigateTo('#admin')">
                                    <svg><use href="/assets/icons.svg#icon-shield"/></svg>
                                    <span class="nav-label">Admin Console</span>
                                </div>
                            ` : ''}
                        </nav>
                    </div>

                    <!-- Footer Controls -->
                    <div class="sidebar-footer">
                        <div class="nav-link" onclick="App.toggleTheme()">
                            <svg id="theme-toggle-icon"><use href="/assets/icons.svg#${this.currentTheme === 'dark' ? 'icon-sun' : 'icon-moon'}"/></svg>
                            <span class="nav-label">Theme Mode</span>
                        </div>
                        <div class="nav-link" onclick="App.navigateTo('#settings')">
                            <svg><use href="/assets/icons.svg#icon-settings"/></svg>
                            <span class="nav-label">Settings</span>
                        </div>
                        <div class="nav-link" onclick="Auth.logout()" style="color:var(--danger);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span class="nav-label">Log Out</span>
                        </div>
                    </div>
                </aside>

                <!-- 2. MOBILE TOP BAR -->
                <header class="mobile-top-header">
                    <div style="display:flex; align-items:center; gap:8px;" onclick="App.navigateTo('#feed')">
                        <img src="/assets/logo.svg" width="28" height="28">
                        <span style="font-weight:800; font-size:18px; background:var(--brand-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">Pixora</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <button class="btn-icon" onclick="App.toggleTheme()">
                            <svg width="20" height="20"><use href="/assets/icons.svg#${this.currentTheme === 'dark' ? 'icon-sun' : 'icon-moon'}"/></svg>
                        </button>
                        <button class="btn-icon" onclick="App.navigateTo('#messages')">
                            <svg width="22" height="22"><use href="/assets/icons.svg#icon-messages"/></svg>
                        </button>
                    </div>
                </header>

                <!-- 3. MAIN DYNAMIC VIEWPORT -->
                <main class="main-viewport" id="view-container">
                    <!-- Dynamic views injected here -->
                </main>

                <!-- 4. MOBILE BOTTOM NAVIGATION -->
                <nav class="mobile-bottom-nav">
                    <div class="mobile-nav-item" id="m-nav-feed" onclick="App.navigateTo('#feed')">
                        <svg><use href="/assets/icons.svg#icon-home"/></svg>
                    </div>
                    <div class="mobile-nav-item" id="m-nav-search" onclick="App.navigateTo('#search')">
                        <svg><use href="/assets/icons.svg#icon-search"/></svg>
                    </div>
                    <div class="mobile-nav-item" onclick="App.openCreatePostModal()">
                        <svg><use href="/assets/icons.svg#icon-create"/></svg>
                    </div>
                    <div class="mobile-nav-item" id="m-nav-reels" onclick="App.navigateTo('#reels')">
                        <svg><use href="/assets/icons.svg#icon-reels"/></svg>
                    </div>
                    <div class="mobile-nav-item" id="m-nav-profile" onclick="App.navigateTo('#profile?u=${user ? user.username : ''}')">
                        <img src="${user ? user.avatar_url : '/assets/default-avatar.svg'}" class="avatar avatar-xs">
                    </div>
                </nav>
            </div>
        `;
    },

    updateActiveNav(hash) {
        document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(el => el.classList.remove('active'));

        let route = 'feed';
        if (hash.startsWith('#explore')) route = 'explore';
        else if (hash.startsWith('#reels')) route = 'reels';
        else if (hash.startsWith('#messages')) route = 'messages';
        else if (hash.startsWith('#notifications')) route = 'notifications';
        else if (hash.startsWith('#search')) route = 'search';
        else if (hash.startsWith('#profile')) route = 'profile';
        else if (hash.startsWith('#admin')) route = 'admin';

        const dLink = document.getElementById(`nav-${route}`);
        const mLink = document.getElementById(`m-nav-${route}`);
        if (dLink) dLink.classList.add('active');
        if (mLink) mLink.classList.add('active');
    },

    renderAuthView(view, token = null) {
        const root = document.getElementById('app-root');
        root.dataset.rendered = 'false';

        root.innerHTML = `
            <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:radial-gradient(circle at 50% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 60%);">
                <div style="width:100%; max-width:400px; background:var(--bg-surface); border:1px solid var(--border-medium); border-radius:var(--radius-xl); padding:36px 32px; box-shadow:var(--shadow-lg); animation:fadeIn 0.3s ease-out;">
                    <!-- Brand Header -->
                    <div style="text-align:center; margin-bottom:28px;">
                        <img src="/assets/logo.svg" width="56" height="56" style="margin:0 auto 12px;">
                        <h1 style="font-size:30px; font-weight:800; letter-spacing:-0.5px; background:var(--brand-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">Pixora</h1>
                        <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">Capture, share, and connect seamlessly.</p>
                    </div>

                    ${view === 'login' ? `
                        <form onsubmit="App.handleLogin(event)" style="display:flex; flex-direction:column; gap:14px;">
                            <div>
                                <input type="text" id="auth-identifier" placeholder="Username or email" required style="width:100%; padding:12px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            </div>
                            <div>
                                <input type="password" id="auth-password" placeholder="Password" required style="width:100%; padding:12px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            </div>
                            <button type="submit" class="btn btn-primary" style="padding:12px; font-size:15px; margin-top:6px;">Log In</button>
                        </form>

                        <div style="text-align:center; margin:18px 0; font-size:13px;">
                            <a href="#forgot-password" style="color:var(--brand-primary); font-weight:600;">Forgot password?</a>
                        </div>

                        <div style="border-top:1px solid var(--border-subtle); padding-top:20px; text-align:center; font-size:14px;">
                            Don't have an account? <a href="#register" style="color:var(--brand-secondary); font-weight:700;">Sign up</a>
                        </div>

                        <div style="margin-top:20px; padding:12px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); font-size:12px; color:var(--text-muted); line-height:1.5;">
                            💡 <strong>Demo Credentials:</strong><br>
                            • User: <code>elena_lens</code> / <code>password123</code><br>
                            • Admin: <code>admin</code> / <code>admin123</code>
                        </div>
                    ` : view === 'register' ? `
                        <form onsubmit="App.handleRegister(event)" style="display:flex; flex-direction:column; gap:12px;">
                            <input type="text" id="reg-fullname" placeholder="Full Name" required style="width:100%; padding:11px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            <input type="text" id="reg-username" placeholder="Username (min 3 chars)" required style="width:100%; padding:11px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            <input type="email" id="reg-email" placeholder="Email address" required style="width:100%; padding:11px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            <input type="password" id="reg-password" placeholder="Password (min 6 chars)" required style="width:100%; padding:11px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            <button type="submit" class="btn btn-primary" style="padding:12px; font-size:15px; margin-top:8px;">Sign Up</button>
                        </form>

                        <div style="border-top:1px solid var(--border-subtle); margin-top:20px; padding-top:20px; text-align:center; font-size:14px;">
                            Have an account? <a href="#login" style="color:var(--brand-primary); font-weight:700;">Log in</a>
                        </div>
                    ` : view === 'forgot' ? `
                        <form onsubmit="App.handleForgotPassword(event)" style="display:flex; flex-direction:column; gap:14px;">
                            <p style="font-size:13px; color:var(--text-secondary); line-height:1.4;">Enter your email and we'll generate a secure time-limited password reset link.</p>
                            <input type="email" id="forgot-email" placeholder="Email address" required style="width:100%; padding:12px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            <button type="submit" class="btn btn-primary" style="padding:12px; font-size:15px;">Send Reset Link</button>
                        </form>
                        <div style="margin-top:20px; text-align:center; font-size:13px;">
                            <a href="#login" style="color:var(--text-muted);">Back to Login</a>
                        </div>
                    ` : `
                        <!-- Reset Password View -->
                        <form onsubmit="App.handleResetPassword(event, '${token}')" style="display:flex; flex-direction:column; gap:14px;">
                            <p style="font-size:13px; color:var(--text-secondary);">Enter a new password for your account.</p>
                            <input type="password" id="reset-new-password" placeholder="New Password (min 6 chars)" required style="width:100%; padding:12px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:14px;">
                            <button type="submit" class="btn btn-primary" style="padding:12px; font-size:15px;">Reset Password</button>
                        </form>
                    `}
                </div>
            </div>
        `;
    },

    async handleLogin(event) {
        event.preventDefault();
        const id = document.getElementById('auth-identifier').value.trim();
        const pass = document.getElementById('auth-password').value;
        await Auth.login(id, pass);
    },

    async handleRegister(event) {
        event.preventDefault();
        const full_name = document.getElementById('reg-fullname').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        await Auth.register(username, email, full_name, password);
    },

    async handleForgotPassword(event) {
        event.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        const res = await Auth.forgotPassword(email);
        if (res && res.resetUrl) {
            alert(`Demo Password Reset Link (Printed to terminal):\n\n${res.resetUrl}`);
        }
    },

    async handleResetPassword(event, token) {
        event.preventDefault();
        const newPass = document.getElementById('reset-new-password').value;
        await Auth.resetPassword(token, newPass);
    },

    // Modals Management
    showModal(contentHtml) {
        const overlay = document.getElementById('app-modal-overlay');
        const container = document.getElementById('app-modal-content');
        if (overlay && container) {
            container.innerHTML = contentHtml;
            overlay.classList.add('active');
        }
    },

    closeModal() {
        const overlay = document.getElementById('app-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    openCreatePostModal() {
        this.showModal(`
            <div style="display:flex; flex-direction:column; max-height:85vh;">
                <div class="modal-header">
                    <div class="modal-title">Create New Post</div>
                    <div class="modal-close" onclick="App.closeModal()">✕</div>
                </div>
                <form class="modal-body" onsubmit="App.submitCreatePost(event)" style="display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">Upload Media (Images/Video - up to 10 files)</label>
                        <input type="file" id="post-files" accept="image/*,video/mp4" multiple required style="width:100%; padding:10px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                    </div>

                    <div>
                        <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">Caption (Use #hashtags and @mentions)</label>
                        <textarea id="post-caption" rows="3" placeholder="Write a caption..." style="width:100%; padding:10px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);"></textarea>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div>
                            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Location Name</label>
                            <input type="text" id="post-loc-name" placeholder="e.g. Eiffel Tower" style="width:100%; padding:8px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                        </div>
                        <div>
                            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">City</label>
                            <input type="text" id="post-loc-city" placeholder="e.g. Paris" style="width:100%; padding:8px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px;">
                        <span style="font-size:13px;">Hide like counts</span>
                        <input type="checkbox" id="post-hide-likes" style="accent-color:var(--brand-primary);">
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px;">Turn off commenting</span>
                        <input type="checkbox" id="post-disable-comments" style="accent-color:var(--brand-primary);">
                    </div>

                    <button type="submit" class="btn btn-primary" style="padding:12px; font-size:15px; margin-top:8px;">Share Post</button>
                </form>
            </div>
        `);
    },

    async submitCreatePost(event) {
        event.preventDefault();
        const fileInput = document.getElementById('post-files');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('Please select at least one media file.');
            return;
        }

        const formData = new FormData();
        for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('media', fileInput.files[i]);
        }

        formData.append('caption', document.getElementById('post-caption').value);
        formData.append('location_name', document.getElementById('post-loc-name').value);
        formData.append('location_city', document.getElementById('post-loc-city').value);
        formData.append('hide_likes', document.getElementById('post-hide-likes').checked);
        formData.append('comments_disabled', document.getElementById('post-disable-comments').checked);

        try {
            const data = await API.post('/posts', formData);
            if (data.success) {
                this.closeModal();
                if (window.showToast) window.showToast('Post published successfully!', 'success');
                this.navigateTo('#feed');
                Feed.loadPosts(true);
            }
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
        }
    },

    openCreateStoryModal() {
        this.showModal(`
            <div style="display:flex; flex-direction:column;">
                <div class="modal-header">
                    <div class="modal-title">Share to Story (24h)</div>
                    <div class="modal-close" onclick="App.closeModal()">✕</div>
                </div>
                <form class="modal-body" onsubmit="App.submitCreateStory(event)" style="display:flex; flex-direction:column; gap:14px;">
                    <div>
                        <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">Upload Photo / Video</label>
                        <input type="file" id="story-file" accept="image/*,video/mp4" required style="width:100%; padding:10px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                    </div>
                    <div>
                        <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">Caption (optional)</label>
                        <input type="text" id="story-caption" placeholder="Add story text..." style="width:100%; padding:10px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <div>
                            <div style="font-weight:700; font-size:13px; color:#10B981;">Close Friends Only</div>
                            <div style="font-size:11px; color:var(--text-muted);">Visible only to your designated close friends</div>
                        </div>
                        <input type="checkbox" id="story-close-friends" style="width:18px; height:18px; accent-color:#10B981;">
                    </div>
                    <button type="submit" class="btn btn-primary" style="margin-top:10px; padding:12px;">Share Story</button>
                </form>
            </div>
        `);
    },

    async submitCreateStory(event) {
        event.preventDefault();
        const fileInput = document.getElementById('story-file');
        if (!fileInput || !fileInput.files[0]) return;

        const formData = new FormData();
        formData.append('media', fileInput.files[0]);
        formData.append('caption', document.getElementById('story-caption').value);
        formData.append('is_close_friends_only', document.getElementById('story-close-friends').checked);

        try {
            await API.post('/stories', formData);
            this.closeModal();
            if (window.showToast) window.showToast('Story shared!', 'success');
            Feed.loadStories();
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    },

    openCreateReelModal() {
        this.showModal(`
            <div style="display:flex; flex-direction:column;">
                <div class="modal-header">
                    <div class="modal-title">Upload Short Reel</div>
                    <div class="modal-close" onclick="App.closeModal()">✕</div>
                </div>
                <form class="modal-body" onsubmit="App.submitCreateReel(event)" style="display:flex; flex-direction:column; gap:14px;">
                    <div>
                        <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">Video File (.mp4)</label>
                        <input type="file" id="reel-file" accept="video/mp4" required style="width:100%; padding:10px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                    </div>
                    <div>
                        <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">Caption</label>
                        <textarea id="reel-caption" rows="2" placeholder="Write reel caption..." style="width:100%; padding:10px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="margin-top:10px; padding:12px;">Publish Reel</button>
                </form>
            </div>
        `);
    },

    async submitCreateReel(event) {
        event.preventDefault();
        const fileInput = document.getElementById('reel-file');
        if (!fileInput || !fileInput.files[0]) return;

        const formData = new FormData();
        formData.append('video', fileInput.files[0]);
        formData.append('caption', document.getElementById('reel-caption').value);

        try {
            await API.post('/reels', formData);
            this.closeModal();
            if (window.showToast) window.showToast('Reel uploaded!', 'success');
            this.navigateTo('#reels');
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    },

    renderSettingsView(container) {
        container.innerHTML = `
            <div style="max-width:600px; margin:0 auto; width:100%;">
                <h2 style="font-size:22px; font-weight:800; margin-bottom:20px;">Settings & Preferences</h2>
                <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:24px; display:flex; flex-direction:column; gap:20px;">
                    <div>
                        <h4 style="margin-bottom:8px;">Change Password</h4>
                        <form onsubmit="App.handleChangePassword(event)" style="display:flex; flex-direction:column; gap:10px;">
                            <input type="password" id="chg-curr" placeholder="Current password" required style="padding:10px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                            <input type="password" id="chg-new" placeholder="New password" required style="padding:10px 12px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
                            <button type="submit" class="btn btn-outline" style="align-self:flex-start;">Update Password</button>
                        </form>
                    </div>

                    <div style="border-top:1px solid var(--border-subtle); padding-top:16px;">
                        <h4 style="margin-bottom:8px; color:var(--danger);">Deactivate or Delete Account</h4>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="App.deactivateAccount()">Deactivate Account</button>
                            <button class="btn btn-danger" onclick="App.deleteAccount()">Delete Account</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async handleChangePassword(event) {
        event.preventDefault();
        const currentPassword = document.getElementById('chg-curr').value;
        const newPassword = document.getElementById('chg-new').value;

        try {
            const data = await API.post('/auth/change-password', { currentPassword, newPassword });
            if (data.success) {
                if (window.showToast) window.showToast('Password updated successfully', 'success');
                event.target.reset();
            }
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    },

    async deactivateAccount() {
        if (!confirm('Are you sure you want to deactivate your account? You will be logged out.')) return;
        try {
            await API.post('/auth/deactivate', {});
            Auth.logout();
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    },

    async deleteAccount() {
        if (!confirm('WARNING: Are you sure you want to permanently delete your account? All your posts, comments, and messages will be permanently deleted.')) return;
        try {
            await API.delete('/auth/delete-account');
            Auth.logout();
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    }
};

// Toast notification helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

window.App = App;
window.showToast = showToast;

// Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
