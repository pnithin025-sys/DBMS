const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/post/:postId', optionalAuth, commentController.getComments);
router.post('/post/:postId', authenticate, commentController.addComment);
router.delete('/:id', authenticate, commentController.deleteComment);
router.put('/:id/pin', authenticate, commentController.togglePin);

module.exports = router;
