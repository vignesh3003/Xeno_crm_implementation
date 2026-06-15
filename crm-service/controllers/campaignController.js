const Campaign = require('../models/Campaign');
const Communication = require('../models/Communication');
const Segment = require('../models/Segment');
const { executeCampaign } = require('../services/execution');

// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Private (Marketer)
const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user._id }).sort('-createdAt');
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCampaign = async (req, res) => {
  const { name, goal, targetSegment, objective, channel, subject, messageTemplate, callToAction, expectedConversion } = req.body;

  try {
    const campaign = await Campaign.create({
      userId: req.user._id,
      name,
      goal,
      targetSegment,
      objective,
      channel,
      subject,
      messageTemplate,
      callToAction,
      expectedConversion,
      status: 'Draft'
    });

    console.log(`[CAMPAIGN STEP 1: CREATED] Campaign ID: ${campaign._id} | Name: ${campaign.name}`);

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const runCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    campaign.status = 'Sent';
    await campaign.save();

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    executeCampaign(campaign, baseUrl);

    res.json({ success: true, data: { message: 'Campaign execution started', campaign } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Webhook receipt status ranking for transition validation
const STATUS_RANKS = {
  'Sent': 1,
  'Delivered': 2,
  'Failed': 2,
  'Opened': 3,
  'Clicked': 4,
  'Converted': 5
};

// @desc    Webhook receipt callback from Channel Service
// @route   POST /api/receipt
// @access  Public (No Auth required for simulated callback)
const updateReceipt = async (req, res) => {
  const { communicationId, status } = req.body;

  console.log(`[CAMPAIGN STEP 5: CALLBACK RECEIVED] CommunicationID: ${communicationId} | Incoming Status: ${status}`);

  if (!communicationId || !status) {
    console.warn(`[RECEIPT CALLBACK FAILED] Missing communicationId or status`);
    return res.status(400).json({ success: false, message: 'Missing communicationId or status' });
  }

  try {
    const communication = await Communication.findById(communicationId);

    if (!communication) {
      console.warn(`[RECEIPT CALLBACK FAILED] Communication record ${communicationId} not found`);
      return res.status(404).json({ success: false, message: 'Communication record not found' });
    }

    const currentRank = STATUS_RANKS[communication.status] || 1;
    const incomingRank = STATUS_RANKS[status] || 1;

    // Check if duplicate or backwards transition
    if (incomingRank <= currentRank) {
      console.log(`[RECEIPT CALLBACK SKIPPED] Backwards/duplicate transition: ${communication.status} -> ${status}`);
      return res.status(200).json({ success: true, data: { message: 'Already processed' } });
    }

    // Process valid transition
    console.log(`[RECEIPT CALLBACK SUCCESS] Updating status for ${communicationId}: ${communication.status} -> ${status}`);
    communication.status = status;
    communication.updatedAt = new Date();

    // Map status to corresponding timestamp fields
    if (status === 'Delivered') communication.deliveredAt = new Date();
    else if (status === 'Opened') communication.openedAt = new Date();
    else if (status === 'Clicked') communication.clickedAt = new Date();
    else if (status === 'Converted') communication.convertedAt = new Date();
    else if (status === 'Failed') communication.failedAt = new Date();

    await communication.save();

    console.log(`[CAMPAIGN STEP 6: ANALYTICS UPDATED] CommunicationID: ${communicationId} | New Status: ${communication.status} | Saved successfully`);

    res.json({ success: true, data: { message: 'Receipt status updated', communication } });
  } catch (error) {
    console.error(`[RECEIPT CALLBACK ERROR] Error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Campaign execution metrics
// @route   GET /api/campaigns/:id/telemetry
// @access  Private (Marketer)
const getCampaignTelemetry = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    // Aggregate counts
    const sent = await Communication.countDocuments({ campaignId });
    const failed = await Communication.countDocuments({ campaignId, status: 'Failed' });
    
    // Inclusive counts representing progressive funnels
    const delivered = await Communication.countDocuments({ 
      campaignId, 
      status: { $in: ['Delivered', 'Opened', 'Clicked', 'Converted'] } 
    });
    const opened = await Communication.countDocuments({ 
      campaignId, 
      status: { $in: ['Opened', 'Clicked', 'Converted'] } 
    });
    const clicked = await Communication.countDocuments({ 
      campaignId, 
      status: { $in: ['Clicked', 'Converted'] } 
    });
    const converted = await Communication.countDocuments({ 
      campaignId, 
      status: 'Converted' 
    });

    res.json({
      success: true,
      data: {
        sent,
        failed,
        delivered,
        opened,
        clicked,
        converted
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const Order = require('../models/Order');

// Helper to retrieve personalization statistics
const getPersonalizationData = async (user) => {
  const lastOrder = await Order.findOne({ userId: user._id }).sort({ purchaseDate: -1 });
  const userOrders = await Order.find({ userId: user._id });
  const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  
  return {
    lastOrder,
    totalSpent
  };
};

// Personalize template strings with customer details
const personalizeMessage = (template, user, lastOrder, totalSpent) => {
  if (!template) return '';
  
  const formattedLastOrder = lastOrder
    ? new Date(lastOrder.purchaseDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      })
    : 'no orders yet';

  const spentStr = `₹${(totalSpent || 0).toLocaleString('en-IN')}`;

  let msg = template || '';
  
  const replacements = {
    name: user.name || 'Customer',
    email: user.email || '',
    city: user.city || 'your city',
    last_order: formattedLastOrder || 'no orders yet',
    total_spent: spentStr || '₹0'
  };

  for (const [key, val] of Object.entries(replacements)) {
    const regex1 = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    const regex2 = new RegExp(`\\{\\s*${key}\\s*\\}`, 'gi');
    msg = msg.replace(regex1, val).replace(regex2, val);
  }

  return msg;
};

// @desc    Get campaigns targeted to the current customer
// @route   GET /api/campaigns/customer
// @access  Private (Customer)
const getCustomerCampaigns = async (req, res) => {
  try {
    const communications = await Communication.find({ userId: req.user._id })
      .populate('campaignId')
      .sort('-sentAt');

    const campaigns = [];
    for (const comm of communications) {
      if (!comm.campaignId) continue;
      
      const campaign = comm.campaignId;
      
      // Get personalization details
      const { lastOrder, totalSpent } = await getPersonalizationData(req.user);
      const personalizedMsg = personalizeMessage(campaign.messageTemplate, req.user, lastOrder, totalSpent);

      campaigns.push({
        _id: campaign._id,
        name: campaign.name,
        subject: campaign.subject,
        messageTemplate: personalizedMsg,
        channel: campaign.channel,
        callToAction: campaign.callToAction,
        sentAt: comm.sentAt,
        status: comm.status
      });
    }

    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI-generated campaign performance explanation
// @route   GET /api/campaigns/:id/explanation
// @access  Private (Marketer)
const getCampaignExplanation = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const sent = await Communication.countDocuments({ campaignId });
    const failed = await Communication.countDocuments({ campaignId, status: 'Failed' });
    const converted = await Communication.countDocuments({ campaignId, status: 'Converted' });
    const opened = await Communication.countDocuments({ campaignId, status: { $in: ['Opened', 'Clicked', 'Converted'] } });
    const clicked = await Communication.countDocuments({ campaignId, status: { $in: ['Clicked', 'Converted'] } });

    let status = 'Mixed';
    const conversionRate = sent > 0 ? (converted / sent) * 100 : 0;
    const openRate = sent > 0 ? (opened / sent) * 100 : 0;
    const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;
    const failedRate = sent > 0 ? (failed / sent) * 100 : 0;

    if (sent === 0) {
      status = 'Mixed';
    } else if (conversionRate >= 15 && failedRate < 10) {
      status = 'Success';
    } else if (conversionRate < 5 || failedRate >= 20) {
      status = 'Failed';
    } else {
      status = 'Mixed';
    }

    let aiExplanation;
    try {
      const { getCampaignExplanationAI } = require('../services/aiService');
      aiExplanation = await getCampaignExplanationAI(campaign, {
        sent,
        failed,
        delivered: sent - failed,
        opened,
        clicked,
        converted,
        conversionRate,
        openRate,
        clickRate,
        failedRate,
        status
      });
    } catch (aiErr) {
      console.error('AI Service Error:', aiErr);
      const { getMockCampaignExplanation } = require('../services/aiService');
      aiExplanation = getMockCampaignExplanation(campaign, {
        sent,
        failed,
        delivered: sent - failed,
        opened,
        clicked,
        converted,
        conversionRate,
        openRate,
        clickRate,
        failedRate,
        status
      });
    }

    res.json({
      success: true,
      data: {
        campaignId,
        status,
        explanation: aiExplanation.explanation || 'No performance description generated.',
        recommendations: aiExplanation.recommendations || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const CampaignNotification = require('../models/CampaignNotification');

// @desc    Get latest unseen campaign notification popup
// @route   GET /api/campaigns/notifications/unseen
// @access  Private (Customer)
const getUnseenNotification = async (req, res) => {
  try {
    const notif = await CampaignNotification.findOne({ userId: req.user._id, seen: false })
      .populate('campaignId');

    if (!notif || !notif.campaignId) {
      return res.json({ success: true, data: null });
    }

    // Personalize campaign message
    const { lastOrder, totalSpent } = await getPersonalizationData(req.user);
    const personalizedMsg = personalizeMessage(notif.campaignId.messageTemplate, req.user, lastOrder, totalSpent);

    res.json({
      success: true,
      data: {
        _id: notif._id,
        campaignId: {
          _id: notif.campaignId._id,
          name: notif.campaignId.name,
          subject: notif.campaignId.subject,
          messageTemplate: personalizedMsg,
          channel: notif.campaignId.channel
        },
        name: notif.campaignId.name,
        subject: notif.campaignId.subject,
        messageTemplate: personalizedMsg,
        channel: notif.campaignId.channel
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markNotificationSeen = async (req, res) => {
  try {
    const notif = await CampaignNotification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { seen: true },
      { new: true }
    );
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: { message: 'Notification marked as seen' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markCommunicationOpened = async (req, res) => {
  try {
    const comm = await Communication.findOne({
      userId: req.user._id,
      campaignId: req.params.campaignId
    });

    if (comm && (comm.status === 'Sent' || comm.status === 'Delivered')) {
      comm.status = 'Opened';
      comm.openedAt = new Date();
      comm.updatedAt = new Date();
      await comm.save();
    }
    res.json({ success: true, data: { opened: true } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCampaigns,
  createCampaign,
  runCampaign,
  updateReceipt,
  getCampaignTelemetry,
  getCustomerCampaigns,
  getCampaignExplanation,
  getUnseenNotification,
  markNotificationSeen,
  markCommunicationOpened
};
