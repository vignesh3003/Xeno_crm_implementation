const express = require('express');
const router = express.Router();
const { getSegments, getCustomersBySegment } = require('../controllers/segmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('marketer')); // Only marketers can query segments

router.get('/', getSegments);
router.get('/:name/customers', getCustomersBySegment);

module.exports = router;
