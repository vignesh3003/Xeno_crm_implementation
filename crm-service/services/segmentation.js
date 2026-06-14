const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Segment = require('../models/Segment');

// Festival date calculator
function checkIfFestival(date) {
  const time = new Date(date).getTime();
  const diwaliStart = new Date('2025-10-25').getTime();
  const diwaliEnd = new Date('2025-11-15').getTime();
  const holiStart = new Date('2026-03-01').getTime();
  const holiEnd = new Date('2026-03-15').getTime();
  const dussehraStart = new Date('2025-10-01').getTime();
  const dussehraEnd = new Date('2025-10-12').getTime();

  return (time >= diwaliStart && time <= diwaliEnd) ||
         (time >= holiStart && time <= holiEnd) ||
         (time >= dussehraStart && time <= dussehraEnd);
}

const refreshSegments = async () => {
  try {
    const customers = await User.find({ role: 'customer' });
    const orders = await Order.find({});
    const carts = await Cart.find({ abandoned: true, 'items.0': { $exists: true } });

    const ordersByUser = {};
    orders.forEach(order => {
      if (!ordersByUser[order.userId]) {
        ordersByUser[order.userId] = [];
      }
      ordersByUser[order.userId].push(order);
    });

    const cartAbandonersSet = new Set(carts.map(c => c.userId.toString()));
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const segmentMemberships = {
      'New Shoppers': [],
      'Repeat Buyers': [],
      'High Value Shoppers': [],
      'Dormant Shoppers': [],
      'Festival Buyers': [],
      'Cart Abandoners': [],
      'Discount Seekers': [],
      'Premium Buyers': []
    };

    customers.forEach(customer => {
      const userId = customer._id.toString();
      const userOrders = ordersByUser[userId] || [];
      
      // Sort orders by purchaseDate ascending
      userOrders.sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));

      // 1. New Shoppers
      if (userOrders.length > 0 && new Date(userOrders[0].purchaseDate) >= thirtyDaysAgo) {
        segmentMemberships['New Shoppers'].push(customer._id);
      }

      // 2. Repeat Buyers
      if (userOrders.length > 1) {
        segmentMemberships['Repeat Buyers'].push(customer._id);
      }

      // 3. High Value Shoppers
      const lifetimeSpend = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      if (lifetimeSpend > 10000) {
        segmentMemberships['High Value Shoppers'].push(customer._id);
      }

      // 4. Dormant Shoppers
      const lastPurchase = userOrders.length > 0 ? new Date(userOrders[userOrders.length - 1].purchaseDate) : null;
      if (lastPurchase && lastPurchase < oneEightyDaysAgo) {
        segmentMemberships['Dormant Shoppers'].push(customer._id);
      }

      // 5. Festival Buyers
      const festivalCount = userOrders.filter(o => checkIfFestival(o.purchaseDate) || o.isFestivalPeriod).length;
      if (userOrders.length > 0 && festivalCount / userOrders.length > 0.5) {
        segmentMemberships['Festival Buyers'].push(customer._id);
      }

      // 6. Cart Abandoners
      if (cartAbandonersSet.has(userId)) {
        segmentMemberships['Cart Abandoners'].push(customer._id);
      }

      // 7. Discount Seekers
      const discountCount = userOrders.filter(o => o.hasDiscount).length;
      if (userOrders.length > 0 && discountCount / userOrders.length > 0.5) {
        segmentMemberships['Discount Seekers'].push(customer._id);
      }

      // 8. Premium Buyers
      if (userOrders.length > 0) {
        const avgOrderValue = lifetimeSpend / userOrders.length;
        if (avgOrderValue > 2500) {
          segmentMemberships['Premium Buyers'].push(customer._id);
        }
      }
    });

    // Save back to DB
    const segmentNames = Object.keys(segmentMemberships);
    for (const name of segmentNames) {
      await Segment.findOneAndUpdate(
        { name },
        { 
          name, 
          userIds: segmentMemberships[name],
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }
    console.log('Customer segments refreshed.');
  } catch (error) {
    console.error('Error refreshing segments:', error);
  }
};

module.exports = { refreshSegments };
