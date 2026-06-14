const axios = require('axios');
const User = require('../models/User');
const Segment = require('../models/Segment');
const Communication = require('../models/Communication');
const Order = require('../models/Order');

const executeCampaign = async (campaign) => {
  try {
    console.log(`[CAMPAIGN EXECUTION START] Campaign ID: ${campaign._id} | Name: ${campaign.name}`);

    // 1. Fetch Segment
    const segment = await Segment.findOne({ name: campaign.targetSegment });
    if (!segment || !segment.userIds || segment.userIds.length === 0) {
      console.warn(`[CAMPAIGN EXECUTION FAILED] No users found in segment ${campaign.targetSegment} for campaign ${campaign._id}`);
      return;
    }

    console.log(`[CAMPAIGN EXECUTION] Segment "${campaign.targetSegment}" found with ${segment.userIds.length} user IDs.`);

    // 2. Fetch Users in the segment
    const users = await User.find({ _id: { $in: segment.userIds } });
    console.log(`[CAMPAIGN EXECUTION] Selected ${users.length} active recipient users from database.`);

    const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:4000';

    // 3. For each user, personalize message, create Communication record, and send to channel-service
    for (const user of users) {
      // Get personalization data for this user
      const lastOrder = await Order.findOne({ userId: user._id }).sort({ purchaseDate: -1 });
      const userOrders = await Order.find({ userId: user._id });
      const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      const formattedLastOrder = lastOrder
        ? new Date(lastOrder.purchaseDate).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
          })
        : 'no orders yet';

      const spentStr = `₹${(totalSpent || 0).toLocaleString('en-IN')}`;

      let personalizedMessage = campaign.messageTemplate || '';
      
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
        personalizedMessage = personalizedMessage.replace(regex1, val).replace(regex2, val);
      }

      console.log(`[CAMPAIGN EXECUTION] Personalizing message for user: ${user.email}`);

      // Create communication record
      const communication = await Communication.create({
        campaignId: campaign._id,
        userId: user._id,
        status: 'Sent',
        channel: campaign.channel,
        sentAt: new Date(),
        updatedAt: new Date()
      });

      // Create campaign notification for customer popup mapping
      const CampaignNotification = require('../models/CampaignNotification');
      await CampaignNotification.create({
        userId: user._id,
        campaignId: campaign._id,
        seen: false
      }).catch(err => console.error('[CAMPAIGN EXECUTION] Failed to create campaign notification:', err));

      // Prepare payload
      const payload = {
        recipient: user.email,
        message: personalizedMessage,
        channel: campaign.channel,
        communicationId: communication._id // Include communicationId for tracking callbacks
      };

      console.log(`[CAMPAIGN EXECUTION] Calling channel service at ${channelServiceUrl}/send for ${user.email}`);

      // Call channel-service asynchronously (don't block the loop on response, but let it execute)
      axios.post(`${channelServiceUrl}/send`, payload)
        .then(response => {
          console.log(`[CAMPAIGN EXECUTION] Channel service accepted message for ${user.email} (Communication ID: ${communication._id})`);
        })
        .catch(err => {
          console.error(`[CAMPAIGN EXECUTION] Error sending to channel-service for ${user.email}:`, err.message);
          // Update status to Failed
          Communication.findByIdAndUpdate(communication._id, {
            status: 'Failed',
            updatedAt: new Date()
          }).exec();
        });
    }

    console.log(`[CAMPAIGN EXECUTION COMPLETED] Started for ${users.length} recipients.`);
  } catch (error) {
    console.error('[CAMPAIGN EXECUTION ERROR]', error);
  }
};

module.exports = { executeCampaign };
