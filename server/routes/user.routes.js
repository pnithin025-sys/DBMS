const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Profile & Settings
router.get('/profile/:username', optionalAuth, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/avatar', authenticate, upload.single('avatar'), userController.updateAvatar);
router.get('/settings', authenticate, userController.getSettings);
router.put('/settings', authenticate, userController.updateSettings);

// Follows
router.post('/follow/:id', authenticate, userController.followUser);
router.delete('/follow/:id', authenticate, userController.unfollowUser);
router.post('/follow-request/:id/accept', authenticate, userController.acceptFollowRequest);
router.post('/follow-request/:id/reject', authenticate, userController.rejectFollowRequest);
router.delete('/follower/:id', authenticate, userController.removeFollower);
router.get('/:id/followers', optionalAuth, userController.getFollowers);
router.get('/:id/following', optionalAuth, userController.getFollowing);

// Close Friends
router.get('/close-friends', authenticate, userController.getCloseFriends);
router.post('/close-friends/:id', authenticate, userController.addCloseFriend);
router.delete('/close-friends/:id', authenticate, userController.removeCloseFriend);

// Blocks
router.get('/blocked', authenticate, userController.getBlockedUsers);
router.post('/block/:id', authenticate, userController.blockUser);
router.delete('/block/:id', authenticate, userController.unblockUser);

// Mutes
router.post('/mute/:id', authenticate, userController.muteUser);
router.delete('/mute/:id', authenticate, userController.unmuteUser);

module.exports = router;
