const jwt = require('jsonwebtoken');
const config = require('../config/config');

function generateToken(payload) {
    return jwt.sign(payload, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRES_IN
    });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
        return null;
    }
}

function setAuthCookie(res, token) {
    const isProduction = config.NODE_ENV === 'production';
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });
}

function clearAuthCookie(res) {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax'
    });
}

module.exports = {
    generateToken,
    verifyToken,
    setAuthCookie,
    clearAuthCookie
};
