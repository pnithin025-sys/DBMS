const { verifyToken } = require('../utils/tokenHelper');
const { query } = require('../config/db');

async function authenticate(req, res, next) {
    try {
        let token = null;

        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired session. Please log in again.'
            });
        }

        // Fetch user record from database
        const rows = await query(
            'SELECT user_id, username, email, full_name, avatar_url, role, is_active, is_private, is_verified FROM users WHERE user_id = ?',
            [decoded.userId]
        );

        if (!rows || rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const user = rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'This account has been deactivated.'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication.'
        });
    }
}

// Optional authentication middleware (populates req.user if present, but doesn't block)
async function optionalAuth(req, res, next) {
    try {
        let token = null;
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
                const rows = await query(
                    'SELECT user_id, username, email, full_name, avatar_url, role, is_active, is_private, is_verified FROM users WHERE user_id = ?',
                    [decoded.userId]
                );
                if (rows && rows.length > 0 && rows[0].is_active) {
                    req.user = rows[0];
                }
            }
        }
        next();
    } catch (error) {
        next();
    }
}

// Require admin privilege
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied: Admin privileges required.'
        });
    }
    next();
}

module.exports = {
    authenticate,
    optionalAuth,
    requireAdmin
};
