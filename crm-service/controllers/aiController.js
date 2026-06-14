const Segment = require('../models/Segment');
const Order = require('../models/Order');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const { getSegmentInsights, getCampaignGeneration, getCopilotChatResponse } = require('../services/aiService');

// @desc    Generate AI Insights for segments dynamically
// @route   GET /api/ai/insights
// @access  Private (Marketer)
const getInsights = async (req, res) => {
  try {
    const segments = await Segment.find({});
    const insights = [];

    for (const segment of segments) {
      const count = segment.userIds ? segment.userIds.length : 0;
      
      // Calculate sample stats for the segment to give context to Gemini
      let stats = {};
      if (count > 0) {
        const sampleOrders = await Order.find({ userId: { $in: segment.userIds } });
        const totalSpend = sampleOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const aov = sampleOrders.length > 0 ? (totalSpend / sampleOrders.length) : 0;
        stats = {
          totalSpend,
          aov: Math.round(aov),
          ordersCount: sampleOrders.length
        };
      }

      const segmentInsight = await getSegmentInsights(segment.name, count, stats);
      insights.push({
        segmentName: segment.name,
        ...segmentInsight
      });
    }

    res.json(insights);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate AI Campaign based on goal
// @route   POST /api/ai/generate-campaign
// @access  Private (Marketer)
const generateCampaign = async (req, res) => {
  const { goal } = req.body;

  if (!goal) {
    return res.status(400).json({ message: 'Please provide a business goal' });
  }

  try {
    const segments = await Segment.find({});
    const segmentsSummary = segments.map(s => ({
      name: s.name,
      count: s.userIds ? s.userIds.length : 0
    }));

    const campaignTemplate = await getCampaignGeneration(goal, segmentsSummary);
    res.json(campaignTemplate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    AI Copilot chat endpoint
// @route   POST /api/ai/copilot
// @access  Private (Marketer)
const chatCopilot = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Please provide a message' });
  }

  try {
    // 1. Gather stats context
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalOrders = await Order.countDocuments({});
    const orders = await Order.find({});
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const segments = await Segment.find({});
    const segmentCounts = {};
    segments.forEach(s => {
      segmentCounts[s.name] = s.userIds ? s.userIds.length : 0;
    });

    const campaignsCount = await Campaign.countDocuments({});

    const crmData = {
      analytics: {
        totalCustomers,
        totalOrders,
        totalRevenue,
        aov,
        campaignsSent: campaignsCount
      },
      segments: segmentCounts
    };

    const copilotResponse = await getCopilotChatResponse(message, crmData);
    res.json(copilotResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getInsights,
  generateCampaign,
  chatCopilot
};
