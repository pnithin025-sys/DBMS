const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Feed & Explore
router.get('/feed', authenticate, postController.getFeed);
router.get('/explore', optionalAuth, postController.getExplore);
router.get('/user/:username', optionalAuth, postController.getPostsByUser);

// CRUD
router.post('/', authenticate, upload.array('media', 10), postController.createPost);
router.get('/:id', optionalAuth, postController.getPostById);
router.put('/:id/caption', authenticate, postController.updateCaption);
router.delete('/:id', authenticate, postController.deletePost);

// Post Controls
router.put('/:id/archive', authenticate, postController.toggleArchive);
router.put('/:id/comments-toggle', authenticate, postController.toggleComments);
router.put('/:id/hide-likes', authenticate, postController.toggleHideLikes);

module.exports = router;
