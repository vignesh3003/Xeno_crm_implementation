const express = require('express');
const router = express.Router();
const { getInsights, generateCampaign, chatCopilot } = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('marketer')); // Restricted to marketers

router.get('/insights', getInsights);
router.post('/generate-campaign', generateCampaign);
router.post('/copilot', chatCopilot);

module.exports = router;
