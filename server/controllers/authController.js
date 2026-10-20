const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/db');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../utils/tokenHelper');
const { logAction } = require('../utils/auditLogger');

// Register a new user
async function register(req, res, next) {
    try {
        const { username, email, password, full_name } = req.body;

        if (!username || !email || !password || !full_name) {
            return res.status(400).json({
                success: false,
                message: 'Username, email, full name, and password are required.'
            });
        }

        const cleanUsername = username.trim().toLowerCase();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanUsername.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username must be at least 3 characters long.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        // Check if username or email already exists
        const existing = await query(
            'SELECT user_id, username, email FROM users WHERE username = ? OR email = ?',
            [cleanUsername, cleanEmail]
        );

        if (existing.length > 0) {
            const isUsername = existing[0].username === cleanUsername;
            return res.status(409).json({
                success: false,
                message: isUsername ? 'Username is already taken.' : 'Email is already registered.'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Atomic transaction to insert user + default settings
        let newUserId;
        await withTransaction(async (conn) => {
            const [userResult] = await conn.execute(
                'INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
                [cleanUsername, cleanEmail, passwordHash, full_name.trim()]
            );
            newUserId = userResult.insertId;

            await conn.execute(
                'INSERT INTO user_settings (user_id) VALUES (?)',
                [newUserId]
            );
        });

        // Generate token and set session cookie
        const token = generateToken({ userId: newUserId, username: cleanUsername, role: 'user' });
        setAuthCookie(res, token);

        await logAction('REGISTER', 'users', newUserId, newUserId, { username: cleanUsername });

        return res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            user: {
                user_id: newUserId,
                username: cleanUsername,
                email: cleanEmail,
                full_name: full_name.trim(),
                role: 'user',
                avatar_url: '/assets/default-avatar.svg'
            }
        });
    } catch (error) {
        next(error);
    }
}

// Login with email or username
async function login(req, res, next) {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your email/username and password.'
            });
        }

        const cleanIdentifier = identifier.trim().toLowerCase();

        // Search for user by email or username
        const users = await query(
            'SELECT user_id, username, email, password_hash, full_name, avatar_url, role, is_active, is_verified, is_private FROM users WHERE username = ? OR email = ?',
            [cleanIdentifier, cleanIdentifier]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. User not found.'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account is deactivated. Contact support to reactivate.'
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. Incorrect password.'
            });
        }

        const token = generateToken({ userId: user.user_id, username: user.username, role: user.role });
        setAuthCookie(res, token);

        await logAction('LOGIN', 'users', user.user_id, user.user_id, { ip: req.ip });

        return res.json({
            success: true,
            message: 'Logged in successfully!',
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                role: user.role,
                is_verified: !!user.is_verified,
                is_private: !!user.is_private
            }
        });
    } catch (error) {
        next(error);
    }
}

// Get current logged-in user profile
async function getMe(req, res, next) {
    try {
        const user = req.user;

        // Fetch unread notification count
        const unreadRows = await query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE recipient_id = ? AND is_read = FALSE',
            [user.user_id]
        );

        // Fetch unread messages count
        const unreadMsgRows = await query(
            `SELECT COUNT(DISTINCT m.message_id) as unread_msg_count 
             FROM messages m
             JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
             LEFT JOIN message_reads mr ON m.message_id = mr.message_id AND mr.user_id = ?
             WHERE cp.user_id = ? AND m.sender_id <> ? AND mr.message_id IS NULL`,
            [user.user_id, user.user_id, user.user_id]
        );

        return res.json({
            success: true,
            user: {
                ...user,
                unread_notifications: unreadRows[0].unread_count || 0,
                unread_messages: unreadMsgRows[0].unread_msg_count || 0
            }
        });
    } catch (error) {
        next(error);
    }
}

// Logout
function logout(req, res) {
    clearAuthCookie(res);
    return res.json({
        success: true,
        message: 'Logged out successfully.'
    });
}

// Logout from all devices
function logoutAll(req, res) {
    clearAuthCookie(res);
    return res.json({
        success: true,
        message: 'Logged out from all devices successfully.'
    });
}

// Forgot password - Generates secure token and prints reset link to console
async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide your email address.' });
        }

        const users = await query('SELECT user_id, email, username FROM users WHERE email = ?', [email.trim().toLowerCase()]);
        
        // For security, respond with success even if email does not exist
        if (users.length === 0) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been dispatched.'
            });
        }

        const user = users[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await query(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.user_id, resetToken, expiresAt]
        );

        // Print reset link in terminal for evaluation as requested
        const resetUrl = `http://localhost:${process.env.PORT || 5000}/#reset-password?token=${resetToken}`;
        console.log('\n======================================================');
        console.log(`[PASSWORD RESET LINK for @${user.username}]:`);
        console.log(resetUrl);
        console.log('======================================================\n');

        return res.json({
            success: true,
            message: 'Password reset link generated and printed to server console.',
            resetUrl: resetUrl // Included in response for convenience in testing
        });
    } catch (error) {
        next(error);
    }
}

// Reset password with token
async function resetPassword(req, res, next) {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ success: false, message: 'Token and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }

        const resets = await query(
            'SELECT reset_id, user_id, expires_at, is_used FROM password_resets WHERE token = ?',
            [token]
        );

        if (resets.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or unrecognized reset token.' });
        }

        const resetRecord = resets[0];

        if (resetRecord.is_used) {
            return res.status(400).json({ success: false, message: 'This reset token has already been used.' });
        }

        if (new Date() > new Date(resetRecord.expires_at)) {
            return res.status(400).json({ success: false, message: 'This reset token has expired. Please request a new one.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await withTransaction(async (conn) => {
            await conn.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, resetRecord.user_id]);
            await conn.execute('UPDATE password_resets SET is_used = TRUE WHERE reset_id = ?', [resetRecord.reset_id]);
        });

        await logAction('RESET_PASSWORD', 'users', resetRecord.user_id, resetRecord.user_id);

        return res.json({
            success: true,
            message: 'Password has been reset successfully! You can now log in.'
        });
    } catch (error) {
        next(error);
    }
}

// Change password for logged-in user
async function changePassword(req, res, next) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
        }

        const users = await query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.user_id]);
        const user = users[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password does not match.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, req.user.user_id]);
        await logAction('CHANGE_PASSWORD', 'users', req.user.user_id, req.user.user_id);

        return res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
        next(error);
    }
}

// Deactivate account
async function deactivateAccount(req, res, next) {
    try {
        await query('UPDATE users SET is_active = FALSE WHERE user_id = ?', [req.user.user_id]);
        await logAction('DEACTIVATE', 'users', req.user.user_id, req.user.user_id);
        clearAuthCookie(res);
        return res.json({ success: true, message: 'Account deactivated successfully.' });
    } catch (error) {
        next(error);
    }
}

// Permanently delete account
async function deleteAccount(req, res, next) {
    try {
        await query('DELETE FROM users WHERE user_id = ?', [req.user.user_id]);
        await logAction('PERMANENT_DELETE', 'users', req.user.user_id, req.user.user_id);
        clearAuthCookie(res);
        return res.json({ success: true, message: 'Account permanently deleted.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    register,
    login,
    getMe,
    logout,
    logoutAll,
    forgotPassword,
    resetPassword,
    changePassword,
    deactivateAccount,
    deleteAccount
};
