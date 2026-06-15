const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { refreshSegments } = require('../services/segmentation');

// Festival date helper
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

// @desc    Create a new order (Checkout)
// @route   POST /api/orders
// @access  Private (Customer)
const createOrder = async (req, res) => {
  const { couponCode } = req.body;

  try {
    const cart = await Cart.findOne({ userId: req.user._id, abandoned: true }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const lineTotal = item.product.price * item.quantity;
      totalAmount += lineTotal;
      orderItems.push({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price
      });
    }

    // Apply coupon discount if applicable
    let discountApplied = 0;
    let hasDiscount = false;
    if (couponCode && couponCode.toUpperCase() === 'DISCOUNT10') {
      discountApplied = Math.floor(totalAmount * 0.1); // 10% off
      totalAmount = totalAmount - discountApplied;
      hasDiscount = true;
    } else if (couponCode && couponCode.toUpperCase() === 'FESTIVAL20') {
      discountApplied = Math.floor(totalAmount * 0.2); // 20% off
      totalAmount = totalAmount - discountApplied;
      hasDiscount = true;
    }

    const isFestivalPeriod = checkIfFestival(new Date());

    const order = await Order.create({
      userId: req.user._id,
      items: orderItems,
      totalAmount,
      discountApplied,
      hasDiscount,
      purchaseDate: new Date(),
      isFestivalPeriod
    });

    // Mark cart as checked out (not abandoned)
    cart.abandoned = false;
    await cart.save();

    // Mark the most recent active campaign communication as Converted
    const Communication = require('../models/Communication');
    const activeComm = await Communication.findOne({
      userId: req.user._id,
      status: { $in: ['Sent', 'Delivered', 'Opened', 'Clicked'] }
    }).sort({ sentAt: -1 });

    if (activeComm) {
      activeComm.status = 'Converted';
      activeComm.convertedAt = new Date();
      activeComm.updatedAt = new Date();
      await activeComm.save();
      console.log(`[CAMPAIGN CONVERSION] Marked communication ${activeComm._id} as Converted for user ${req.user._id}`);
    }

    // Spawn segment refresh in background
    refreshSegments();

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user's orders
// @route   GET /api/orders
// @access  Private (Customer)
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).populate('items.product').sort('-purchaseDate');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getMyOrders
};
