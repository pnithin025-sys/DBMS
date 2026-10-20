const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure upload directories exist
const uploadDirs = ['avatars', 'posts', 'stories', 'reels'].map(dir => 
    path.join(__dirname, '../../uploads', dir)
);

uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure storage with dynamic destination folder
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'posts';
        if (req.baseUrl.includes('/users') || req.path.includes('/avatar')) {
            folder = 'avatars';
        } else if (req.baseUrl.includes('/stories')) {
            folder = 'stories';
        } else if (req.baseUrl.includes('/reels')) {
            folder = 'reels';
        }
        cb(null, path.join(__dirname, '../../uploads', folder));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// File filter for images and videos
const fileFilter = (req, file, cb) => {
    const allowedImages = ['.jpg', '.jpeg', '.png', '.webp'];
    const allowedVideos = ['.mp4', '.webm', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedImages.includes(ext) || allowedVideos.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file format. Please upload JPG, PNG, WEBP, or MP4 files.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.MAX_VIDEO_SIZE_MB * 1024 * 1024 // 50MB max limit
    },
    fileFilter: fileFilter
});

module.exports = upload;
