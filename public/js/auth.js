// =====================================================================
// PIXORA CLIENT AUTHENTICATION HANDLER
// =====================================================================

const Auth = {
    currentUser: null,

    async checkAuth() {
        try {
            const data = await API.get('/auth/me');
            if (data.success && data.user) {
                this.currentUser = data.user;
                if (window.initClientSocket) {
                    window.initClientSocket();
                }
                return this.currentUser;
            }
        } catch (error) {
            this.currentUser = null;
        }
        return null;
    },

    async login(identifier, password) {
        try {
            const data = await API.post('/auth/login', { identifier, password });
            if (data.success) {
                this.currentUser = data.user;
                if (window.showToast) window.showToast('Welcome back, @' + data.user.username + '!', 'success');
                if (window.initClientSocket) window.initClientSocket();
                window.location.hash = '#feed';
                window.App.renderApp();
                return true;
            }
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
            return false;
        }
    },

    async register(username, email, fullName, password) {
        try {
            const data = await API.post('/auth/register', {
                username,
                email,
                full_name: fullName,
                password
            });
            if (data.success) {
                this.currentUser = data.user;
                if (window.showToast) window.showToast('Account created successfully! Welcome to Pixora.', 'success');
                if (window.initClientSocket) window.initClientSocket();
                window.location.hash = '#feed';
                window.App.renderApp();
                return true;
            }
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
            return false;
        }
    },

    async logout() {
        try {
            await API.post('/auth/logout', {});
            this.currentUser = null;
            if (window.showToast) window.showToast('Logged out successfully.', 'info');
            window.location.hash = '#login';
            window.App.renderApp();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    },

    async forgotPassword(email) {
        try {
            const data = await API.post('/auth/forgot-password', { email });
            if (window.showToast) window.showToast(data.message, 'info');
            return data;
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
            return null;
        }
    },

    async resetPassword(token, newPassword) {
        try {
            const data = await API.post('/auth/reset-password', { token, newPassword });
            if (window.showToast) window.showToast(data.message, 'success');
            window.location.hash = '#login';
            window.App.renderApp();
            return true;
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
            return false;
        }
    }
};

window.Auth = Auth;
