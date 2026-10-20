const rateLimit = require('express-rate-limit');

// Limiter for authentication routes (login, register, forgot-password)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});

// Limiter for general API requests
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // 500 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Rate limit exceeded, please slow down.'
    }
});

module.exports = {
    authLimiter,
    apiLimiter
};
