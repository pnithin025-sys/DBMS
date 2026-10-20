const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const { authenticate } = require('../middleware/auth');

// Likes
router.post('/posts/:id/like', authenticate, interactionController.togglePostLike);
router.post('/comments/:id/like', authenticate, interactionController.toggleCommentLike);

// Saves & Collections
router.post('/posts/:id/save', authenticate, interactionController.toggleSavePost);
router.get('/collections', authenticate, interactionController.getCollections);
router.post('/collections', authenticate, interactionController.createCollection);
router.delete('/collections/:id', authenticate, interactionController.deleteCollection);
router.post('/collections/:collectionId/items', authenticate, interactionController.addPostToCollection);
router.delete('/collections/:collectionId/items/:postId', authenticate, interactionController.removePostFromCollection);

module.exports = router;
