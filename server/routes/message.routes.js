const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/conversations', authenticate, messageController.getConversations);
router.post('/direct', authenticate, messageController.getOrCreateDirect);
router.post('/group', authenticate, messageController.createGroup);
router.get('/conversations/:conversationId', authenticate, messageController.getMessages);
router.post('/conversations/:conversationId', authenticate, upload.single('media'), messageController.sendMessage);
router.delete('/:id', authenticate, messageController.deleteMessage);

module.exports = router;
