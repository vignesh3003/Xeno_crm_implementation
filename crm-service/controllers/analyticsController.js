const User = require('../models/User');
const Order = require('../models/Order');
const Campaign = require('../models/Campaign');
const Communication = require('../models/Communication');
const Segment = require('../models/Segment');

// @desc    Get dashboard metrics & chart data with advanced timeframes
// @route   GET /api/analytics/dashboard
// @access  Private (Marketer)
const getDashboardData = async (req, res) => {
  try {
    // 1. Calculate Timeframe boundaries
    let start = new Date();
    let end = new Date();
    const timeframe = req.query.timeframe || '6months';

    if (timeframe === '7days') {
      start.setDate(end.getDate() - 7);
    } else if (timeframe === '30days') {
      start.setDate(end.getDate() - 30);
    } else if (timeframe === '2months') {
      start.setMonth(end.getMonth() - 2);
    } else if (timeframe === '6months') {
      start.setMonth(end.getMonth() - 6);
    } else if (timeframe === 'custom') {
      start = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
      end = req.query.endDate ? new Date(req.query.endDate) : new Date();
    } else {
      // Fallback
      start.setMonth(end.getMonth() - 6);
    }

    // 2. Fetch data within range
    const marketerId = req.user._id;
    const marketerCampaigns = await Campaign.find({ userId: marketerId });
    const campaignIds = marketerCampaigns.map(c => c._id);

    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const orders = await Order.find({ purchaseDate: { $gte: start, $lte: end } });
    const totalOrders = orders.length;
    
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const aov = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    // Segment sizes (these are current state counts, but we retrieve active/dormant segments)
    const dormantSegment = await Segment.findOne({ name: 'Dormant Shoppers' });
    const dormantCustomers = dormantSegment ? dormantSegment.userIds.length : 0;
    const activeCustomers = totalCustomers - dormantCustomers;

    const campaignsSent = await Campaign.countDocuments({ 
      userId: marketerId,
      status: 'Sent',
      createdAt: { $gte: start, $lte: end }
    });

    // 3. Campaign Success Rate & Revenue Influenced
    const totalComms = await Communication.countDocuments({ campaignId: { $in: campaignIds }, sentAt: { $gte: start, $lte: end } });
    const convertedComms = await Communication.countDocuments({ 
      campaignId: { $in: campaignIds },
      sentAt: { $gte: start, $lte: end },
      status: 'Converted'
    });
    const conversionRate = totalComms > 0 ? ((convertedComms / totalComms) * 100) : 0;

    // Calculate revenue influenced dynamically
    let revenueInfluenced = 0;
    const conversionLogs = await Communication.find({
      campaignId: { $in: campaignIds },
      status: 'Converted',
      updatedAt: { $gte: start, $lte: end }
    });

    for (const comm of conversionLogs) {
      // Find orders placed by this user close to the conversion time
      const userOrders = await Order.find({
        userId: comm.userId,
        purchaseDate: {
          $gte: new Date(comm.updatedAt.getTime() - 24 * 60 * 60 * 1000),
          $lte: new Date(comm.updatedAt.getTime() + 24 * 60 * 60 * 1000)
        }
      });
      if (userOrders.length > 0) {
        revenueInfluenced += userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      } else {
        // Fallback: get last order placed before conversion
        const lastOrder = await Order.findOne({
          userId: comm.userId,
          purchaseDate: { $lte: comm.updatedAt }
        }).sort({ purchaseDate: -1 });
        if (lastOrder) {
          revenueInfluenced += lastOrder.totalAmount;
        }
      }
    }

    // 4. Chart Grouping & Trends
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let grouping = 'month'; // 'day', 'date', 'month'
    if (diffDays <= 8) {
      grouping = 'day';
    } else if (diffDays <= 45) {
      grouping = 'date';
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMap = {};

    if (grouping === 'day') {
      for (let i = diffDays - 1; i >= 0; i--) {
        const d = new Date(end.getTime());
        d.setDate(end.getDate() - i);
        const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        trendMap[label] = { revenue: 0, orders: 0 };
      }
    } else if (grouping === 'date') {
      for (let i = diffDays - 1; i >= 0; i--) {
        const d = new Date(end.getTime());
        d.setDate(end.getDate() - i);
        const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        trendMap[label] = { revenue: 0, orders: 0 };
      }
    } else {
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const targetEnd = new Date(end.getFullYear(), end.getMonth() + 1, 1);
      while (current < targetEnd) {
        const label = `${monthNames[current.getMonth()]} ${current.getFullYear().toString().substring(2)}`;
        trendMap[label] = { revenue: 0, orders: 0 };
        current.setMonth(current.getMonth() + 1);
      }
    }

    orders.forEach(order => {
      const orderDate = new Date(order.purchaseDate);
      let label = '';
      if (grouping === 'day') {
        label = orderDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      } else if (grouping === 'date') {
        label = orderDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      } else {
        label = `${monthNames[orderDate.getMonth()]} ${orderDate.getFullYear().toString().substring(2)}`;
      }
      if (trendMap[label] !== undefined) {
        trendMap[label].revenue += order.totalAmount;
        trendMap[label].orders += 1;
      }
    });

    const revenueTrend = {
      labels: Object.keys(trendMap),
      data: Object.values(trendMap).map(v => Math.round(v.revenue))
    };

    const ordersTrend = {
      labels: Object.keys(trendMap),
      data: Object.values(trendMap).map(v => v.orders)
    };

    // 5. Customer Growth Trend
    const growthMap = {};
    Object.keys(trendMap).forEach(k => {
      growthMap[k] = 0;
    });

    const customersList = await User.find({ role: 'customer', createdAt: { $gte: start, $lte: end } });
    customersList.forEach(cust => {
      const createdDate = new Date(cust.createdAt);
      let label = '';
      if (grouping === 'day') {
        label = createdDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      } else if (grouping === 'date') {
        label = createdDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      } else {
        label = `${monthNames[createdDate.getMonth()]} ${createdDate.getFullYear().toString().substring(2)}`;
      }
      if (growthMap[label] !== undefined) {
        growthMap[label] += 1;
      }
    });

    const totalBeforeStart = await User.countDocuments({ role: 'customer', createdAt: { $lt: start } });
    let cumulative = totalBeforeStart;
    const customerGrowthData = [];
    Object.keys(growthMap).forEach(key => {
      cumulative += growthMap[key];
      customerGrowthData.push(cumulative);
    });

    const customerGrowth = {
      labels: Object.keys(growthMap),
      data: customerGrowthData
    };

    // 6. Segment Distribution
    const segments = await Segment.find({});
    const segmentDistribution = {
      labels: segments.map(s => s.name),
      data: segments.map(s => s.userIds ? s.userIds.length : 0)
    };

    // 7. Campaign Performance
    const campaignsList = await Campaign.find({ 
      userId: marketerId,
      status: 'Sent',
      createdAt: { $gte: start, $lte: end }
    }).limit(6);
    const campaignPerfLabels = [];
    const campaignPerfSent = [];
    const campaignPerfConverted = [];
    const campaignPerfRates = [];

    for (const campaign of campaignsList) {
      const sent = await Communication.countDocuments({ campaignId: campaign._id });
      const converted = await Communication.countDocuments({ campaignId: campaign._id, status: 'Converted' });
      const rate = sent > 0 ? ((converted / sent) * 100) : 0;
      
      campaignPerfLabels.push(campaign.name);
      campaignPerfSent.push(sent);
      campaignPerfConverted.push(converted);
      campaignPerfRates.push(Math.round(rate * 10) / 10);
    }

    const campaignPerformance = {
      labels: campaignPerfLabels,
      sent: campaignPerfSent,
      converted: campaignPerfConverted,
      conversionRates: campaignPerfRates
    };

    const { getAIProactiveRecommendations } = require('../services/aiService');
    const aiRecommendations = await getAIProactiveRecommendations({
      totalCustomers,
      totalOrders,
      totalRevenue,
      aov,
      campaignsSent,
      conversionRate
    });

    res.json({
      success: true,
      data: {
        kpis: {
          totalCustomers,
          totalOrders,
          totalRevenue: Math.round(totalRevenue),
          aov: Math.round(aov),
          activeCustomers,
          dormantCustomers,
          campaignsSent,
          conversionRate: Math.round(conversionRate * 10) / 10,
          revenueInfluenced: Math.round(revenueInfluenced)
        },
        charts: {
          revenueTrend,
          ordersTrend,
          customerGrowth,
          segmentDistribution,
          campaignPerformance
        },
        aiRecommendations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getActivityStream = async (req, res) => {
  try {
    const limit = 30;
    const currentUserId = req.user._id;

    // Fetch campaigns created by the current user
    const campaigns = await Campaign.find({ userId: currentUserId }).sort({ createdAt: -1 });

    if (campaigns.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const events = [];

    for (const c of campaigns) {
      // 1. Campaign Created
      events.push({
        id: `created_${c._id}`,
        type: 'campaign_created',
        title: `Campaign '${c.name}' created`,
        timestamp: c.createdAt
      });

      // 2. Audience Segmented
      events.push({
        id: `segmented_${c._id}`,
        type: 'audience_segmented',
        title: `Audience segmented for '${c.name}'`,
        timestamp: new Date(c.createdAt.getTime() + 2000)
      });

      if (c.status === 'Sent' || c.status === 'Executing') {
        // 3. Messages Dispatched
        events.push({
          id: `dispatched_${c._id}`,
          type: 'messages_dispatched',
          title: `Messages dispatched for campaign '${c.name}'`,
          timestamp: new Date(c.createdAt.getTime() + 5000)
        });

        // 4. Opens Recorded
        const openCount = await Communication.countDocuments({
          campaignId: c._id,
          status: { $in: ['Opened', 'Clicked', 'Converted'] }
        });
        if (openCount > 0) {
          const latestOpen = await Communication.findOne({
            campaignId: c._id,
            status: { $in: ['Opened', 'Clicked', 'Converted'] }
          }).sort({ openedAt: -1, updatedAt: -1 });
          events.push({
            id: `opens_${c._id}`,
            type: 'opens_recorded',
            title: `${openCount} open${openCount > 1 ? 's' : ''} recorded for campaign '${c.name}'`,
            timestamp: latestOpen.openedAt || latestOpen.updatedAt || new Date(c.createdAt.getTime() + 10000)
          });
        }

        // 5. Clicks Recorded
        const clickCount = await Communication.countDocuments({
          campaignId: c._id,
          status: { $in: ['Clicked', 'Converted'] }
        });
        if (clickCount > 0) {
          const latestClick = await Communication.findOne({
            campaignId: c._id,
            status: { $in: ['Clicked', 'Converted'] }
          }).sort({ clickedAt: -1, updatedAt: -1 });
          events.push({
            id: `clicks_${c._id}`,
            type: 'clicks_recorded',
            title: `${clickCount} click${clickCount > 1 ? 's' : ''} recorded for campaign '${c.name}'`,
            timestamp: latestClick.clickedAt || latestClick.updatedAt || new Date(c.createdAt.getTime() + 15000)
          });
        }

        // 6. Brand Memory Updated
        events.push({
          id: `brand_${c._id}`,
          type: 'brand_memory_updated',
          title: `Brand memory updated for campaign '${c.name}'`,
          timestamp: new Date(c.createdAt.getTime() + 20000)
        });
      }
    }

    // Sort descending (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, data: events.slice(0, limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardData,
  getActivityStream
};
