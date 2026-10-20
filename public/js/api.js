// =====================================================================
// PIXORA CLIENT API WRAPPER
// =====================================================================

const API = {
    async request(endpoint, options = {}) {
        const url = `/api${endpoint}`;
        const defaultHeaders = {};

        // Only set Content-Type to JSON if body is NOT FormData
        if (!(options.body instanceof FormData)) {
            defaultHeaders['Content-Type'] = 'application/json';
        }

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            },
            credentials: 'include' // Send and receive httpOnly cookies
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // If unauthorized and not already on login view, handle session expiration
                if (response.status === 401 && !window.location.hash.includes('login') && !window.location.hash.includes('register')) {
                    console.warn('Session expired or unauthorized.');
                }
                const error = new Error(data.message || 'Request failed');
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error.message);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: body instanceof FormData ? body : JSON.stringify(body)
        });
    },

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: body instanceof FormData ? body : JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

window.API = API;
