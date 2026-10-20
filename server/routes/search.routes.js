const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, searchController.searchAll);
router.get('/suggested', optionalAuth, searchController.getSuggestedUsers);
router.get('/recent', authenticate, searchController.getRecentSearches);
router.post('/recent', authenticate, searchController.saveSearch);
router.delete('/recent', authenticate, searchController.clearSearchHistory);
router.delete('/recent/:id', authenticate, searchController.removeSearchItem);

module.exports = router;
