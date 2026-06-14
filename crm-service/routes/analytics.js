const express = require('express');
const router = express.Router();
const { getDashboardData, getActivityStream } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('marketer'));

router.get('/dashboard', getDashboardData);
router.get('/activity', getActivityStream);

module.exports = router;
