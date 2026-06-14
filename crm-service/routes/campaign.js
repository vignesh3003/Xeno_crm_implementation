const express = require('express');
const router = express.Router();
const { 
  getCampaigns, 
  createCampaign, 
  runCampaign, 
  getCampaignTelemetry,
  getCustomerCampaigns,
  getCampaignExplanation,
  getUnseenNotification,
  markNotificationSeen,
  markCommunicationOpened
} = require('../controllers/campaignController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Endpoints accessible to customer portal (before authorize('marketer'))
router.get('/customer', getCustomerCampaigns);
router.get('/notifications/unseen', getUnseenNotification);
router.put('/notifications/:id/seen', markNotificationSeen);
router.post('/communication/:campaignId/open', markCommunicationOpened);

router.use(authorize('marketer')); // Restricted to marketers

router.route('/')
  .get(getCampaigns)
  .post(createCampaign);

router.post('/:id/execute', runCampaign);
router.get('/:id/telemetry', getCampaignTelemetry);
router.get('/:id/explanation', getCampaignExplanation);

module.exports = router;
