const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/feed', authenticate, storyController.getFeedStories);
router.post('/', authenticate, upload.single('media'), storyController.uploadStory);
router.post('/:id/view', authenticate, storyController.recordStoryView);
router.get('/:id/viewers', authenticate, storyController.getStoryViewers);
router.delete('/:id', authenticate, storyController.deleteStory);

// Highlights
router.post('/highlights', authenticate, storyController.createHighlight);
router.get('/highlights/:id', storyController.getHighlightStories);

module.exports = router;
