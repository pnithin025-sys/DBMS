const express = require('express');
const router = express.Router();
const reelController = require('../controllers/reelController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', optionalAuth, reelController.getReels);
router.post('/', authenticate, upload.single('video'), reelController.uploadReel);
router.post('/:id/view', reelController.incrementView);
router.post('/:id/like', authenticate, reelController.toggleReelLike);
router.get('/:id/comments', reelController.getReelComments);
router.post('/:id/comments', authenticate, reelController.addReelComment);
router.delete('/:id', authenticate, reelController.deleteReel);

module.exports = router;
