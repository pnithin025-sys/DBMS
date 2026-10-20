require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT, 10) || 3306,
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    DB_NAME: process.env.DB_NAME || 'pixora_db',
    JWT_SECRET: process.env.JWT_SECRET || 'pixora_super_secret_jwt_key_2026_capstone_secure_token',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    MAX_IMAGE_SIZE_MB: parseInt(process.env.MAX_IMAGE_SIZE_MB, 10) || 5,
    MAX_VIDEO_SIZE_MB: parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 50
};
