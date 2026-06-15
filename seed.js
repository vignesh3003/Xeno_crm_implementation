const mongoose = require('./crm-service/node_modules/mongoose');
const bcrypt = require('bcryptjs');
const User = require('./crm-service/models/User');
const Product = require('./crm-service/models/Product');
const Order = require('./crm-service/models/Order');
const Cart = require('./crm-service/models/Cart');
const Campaign = require('./crm-service/models/Campaign');
const Communication = require('./crm-service/models/Communication');
const Segment = require('./crm-service/models/Segment');
const Analytics = require('./crm-service/models/Analytics');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xeno_crm';

const indianFirstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayan', 'Krishna', 'Atharv',
  'Ishaan', 'Shaurya', 'Kabir', 'Rudra', 'Aryan', 'Dev', 'Kabir', 'Ananya', 'Diya', 'Priya',
  'Sneha', 'Neha', 'Pooja', 'Rohan', 'Vikram', 'Deepika', 'Rajesh', 'Sunil', 'Karthik', 'Sanjay',
  'Vijay', 'Amit', 'Anil', 'Suresh', 'Manish', 'Karan', 'Rahul', 'Jyoti', 'Shalini', 'Kiran',
  'Geeta', 'Sunita', 'Swati', 'Meera', 'Ravi', 'Alok', 'Abhishek', 'Preeti', 'Ritu', 'Pranav'
];

const indianLastNames = [
  'Sharma', 'Patel', 'Gupta', 'Reddy', 'Rao', 'Kumar', 'Nair', 'Joshi', 'Singh', 'Mehta',
  'Das', 'Chatterjee', 'Banerjee', 'Iyer', 'Pillai', 'Choudhury', 'Mishra', 'Trivedi', 'Deshmukh', 'Verma',
  'Sen', 'Mukherjee', 'Prasad', 'Bose', 'Dutta', 'Shah', 'Narayanan', 'Menon', 'Gowda', 'Bhat'
];

const sampleProductsData = [
  { name: 'Premium Leather Wallet', price: 1800, category: 'Accessories', description: 'Handcrafted premium leather wallet for men' },
  { name: 'Wireless Noise-Cancelling Earbuds', price: 3500, category: 'Electronics', description: 'Active noise cancelling wireless bluetooth earbuds' },
  { name: 'Smart Fitness Band V4', price: 2900, category: 'Electronics', description: 'A sleek band tracking heart rate, sleep, and workouts' },
  { name: 'Classic Indigo Kurta', price: 1500, category: 'Apparel', description: 'Pure cotton indigo dyed traditional Indian kurta' },
  { name: 'Designer Silk Saree', price: 6500, category: 'Apparel', description: 'Authentic Banarasi silk saree with gold zari work' },
  { name: 'Ergonomic Office Chair', price: 8500, category: 'Home', description: 'High-back desk chair with lumbar support' },
  { name: 'Stainless Steel Water Bottle (1L)', price: 750, category: 'Home', description: 'Vacuum insulated double-walled water flask' },
  { name: 'Instant Drip Coffee Maker', price: 4200, category: 'Electronics', description: 'Programmable coffee brewer with thermal carafe' },
  { name: 'Cotton Bed Sheet Set', price: 1200, category: 'Home', description: 'Double king size bedsheet with two pillow covers' },
  { name: 'Acoustic Dreadnought Guitar', price: 9000, category: 'Electronics', description: '6-string acoustic guitar with spruce top' },
  { name: 'Minimalist Analog Watch', price: 4500, category: 'Accessories', description: 'Sleek quartz watch with black leather strap' },
  { name: 'Sports Running Shoes', price: 3800, category: 'Apparel', description: 'Breathable running shoes with responsive cushioning' }
];

// Festival periods in Indian calendar format:
// Diwali: Oct 25, 2025 to Nov 15, 2025
// Holi: March 1, 2026 to March 15, 2026
// Dussehra: Oct 1, 2025 to Oct 12, 2025
function checkIfFestival(date) {
  const time = date.getTime();
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

async function seed() {
  console.log('Connecting to database...');
  
  let uri = MONGODB_URI;
  if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
    try {
      const { URL } = require('url');
      const parsed = new URL(uri);
      if (!parsed.pathname || parsed.pathname === '/') {
        parsed.pathname = '/xeno_crm';
      }
      if (parsed.hostname.includes('rlwy.net') || parsed.hostname.includes('railway.internal')) {
        if (!parsed.searchParams.has('authSource')) {
          parsed.searchParams.set('authSource', 'admin');
        }
      }
      uri = parsed.toString();
    } catch (err) {
      console.warn('Failed to parse MONGODB_URI URL in seed.js:', err.message);
    }
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  // Clear database
  console.log('Clearing existing database collections...');
  await User.deleteMany({});
  await Product.deleteMany({});
  await Order.deleteMany({});
  await Cart.deleteMany({});
  await Campaign.deleteMany({});
  await Communication.deleteMany({});
  await Segment.deleteMany({});
  await Analytics.deleteMany({});

  // 1. Seed Products
  console.log('Seeding products...');
  const products = await Product.insertMany(sampleProductsData);

  // 2. Create Marketer Account
  console.log('Seeding marketer account...');
  const marketer = await User.create({
    name: 'Xeno Marketer',
    email: 'marketer@xeno.com',
    password: 'password123',
    role: 'marketer'
  });

  // 3. Create 1000 Customers
  console.log('Generating 1000 customers...');
  const customerPassword = await bcrypt.hash('password123', 10);
  const customersData = [];
  const emails = new Set();

  const consumerDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  for (let i = 0; i < 1000; i++) {
    let fn = indianFirstNames[Math.floor(Math.random() * indianFirstNames.length)];
    let ln = indianLastNames[Math.floor(Math.random() * indianLastNames.length)];
    let name = `${fn} ${ln}`;
    let domain = i === 0 ? 'gmail.com' : consumerDomains[Math.floor(Math.random() * consumerDomains.length)];
    let email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@${domain}`;
    
    // Ensure uniqueness
    while (emails.has(email)) {
      let randDomain = consumerDomains[Math.floor(Math.random() * consumerDomains.length)];
      email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}.${Math.floor(Math.random()*1000)}@${randDomain}`;
    }
    emails.add(email);

    customersData.push({
      name,
      email,
      password: customerPassword,
      role: 'customer',
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // created within last year
    });
  }

  const customers = await User.insertMany(customersData);
  console.log('1000 customers successfully seeded.');

  // 4. Generate 5000 Orders
  console.log('Generating 5000 orders spanning the past year...');
  const ordersData = [];
  const now = new Date();

  // We want to distribute orders so that customer segments naturally fall out
  // Let's loop through 5000 iterations and choose users with different biases
  for (let i = 0; i < 5000; i++) {
    // Pick a customer
    // We bias some customers to have many orders, others to have none/one
    let customerIndex;
    const rand = Math.random();
    if (rand < 0.1) {
      // 10% of customers get 40% of orders (High Spend / Repeat Buyers)
      customerIndex = Math.floor(Math.random() * 100);
    } else if (rand < 0.5) {
      // 40% of customers get 40% of orders
      customerIndex = 100 + Math.floor(Math.random() * 400);
    } else {
      // 50% of customers get 20% of orders (occasional shoppers, new, or dormant)
      customerIndex = 500 + Math.floor(Math.random() * 500);
    }

    const customer = customers[customerIndex];

    // Determine purchase date
    // Some dormant shoppers (last order > 180 days ago): customer index 800-999 will have purchase date biased to > 180 days ago
    let purchaseDate;
    if (customerIndex >= 800 && customerIndex < 900) {
      // Dormant bias: purchase date between 200 and 365 days ago
      const daysAgo = 180 + Math.floor(Math.random() * 180);
      purchaseDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else if (customerIndex >= 900) {
      // New shopper bias: first/only purchase within last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      purchaseDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else {
      // Standard distribution
      const daysAgo = Math.floor(Math.random() * 365);
      purchaseDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    }

    // Pick 1 to 3 items
    const itemsCount = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let orderTotal = 0;

    for (let j = 0; j < itemsCount; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 2) + 1;
      items.push({
        product: product._id,
        quantity,
        price: product.price
      });
      orderTotal += product.price * quantity;
    }

    // Discounts
    // Discount seekers (majority purchases used discount)
    // We bias users index 300 to 500 to always have discounts
    let hasDiscount = false;
    let discountApplied = 0;
    if ((customerIndex >= 300 && customerIndex < 500 && Math.random() < 0.8) || Math.random() < 0.2) {
      hasDiscount = true;
      discountApplied = Math.floor(orderTotal * 0.1); // 10% discount
      orderTotal = orderTotal - discountApplied;
    }

    const isFestivalPeriod = checkIfFestival(purchaseDate);

    ordersData.push({
      userId: customer._id,
      items,
      totalAmount: orderTotal,
      discountApplied,
      hasDiscount,
      purchaseDate,
      isFestivalPeriod
    });
  }

  await Order.insertMany(ordersData);
  console.log('5000 orders successfully seeded.');

  // 5. Seed some Carts (including Cart Abandoners)
  console.log('Seeding shopping carts (including abandoners)...');
  const cartsData = [];
  // Give 100 users abandoned carts (more than 24 hours old)
  for (let i = 0; i < 150; i++) {
    const customer = customers[i + 200]; // Choose middle set
    const cartItems = [
      { product: products[Math.floor(Math.random() * products.length)]._id, quantity: 1 }
    ];
    cartsData.push({
      userId: customer._id,
      items: cartItems,
      abandoned: true,
      updatedAt: new Date(now.getTime() - (2 + Math.random() * 10) * 24 * 60 * 60 * 1000) // 2-12 days ago
    });
  }
  await Cart.insertMany(cartsData);

  // 6. Generate Segment memberships
  console.log('Calculating and seeding segment memberships...');
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  // Fetch all orders grouped by user
  const userOrders = await Order.find({});
  const userCarts = await Cart.find({ abandoned: true });

  const ordersByUser = {};
  userOrders.forEach(order => {
    if (!ordersByUser[order.userId]) {
      ordersByUser[order.userId] = [];
    }
    ordersByUser[order.userId].push(order);
  });

  const cartAbandonersSet = new Set(userCarts.map(c => c.userId.toString()));

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
    const orders = ordersByUser[userId] || [];
    
    // Sort orders by date
    orders.sort((a, b) => a.purchaseDate - b.purchaseDate);

    // 1. New Shoppers: First purchase within 30 days
    if (orders.length > 0 && orders[0].purchaseDate >= thirtyDaysAgo) {
      segmentMemberships['New Shoppers'].push(customer._id);
    }

    // 2. Repeat Buyers: More than one order
    if (orders.length > 1) {
      segmentMemberships['Repeat Buyers'].push(customer._id);
    }

    // 3. High Value Shoppers: Lifetime spend above 10,000
    const lifetimeSpend = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    if (lifetimeSpend > 10000) {
      segmentMemberships['High Value Shoppers'].push(customer._id);
    }

    // 4. Dormant Shoppers: No purchase in last 180 days (and has purchased at least once)
    const lastPurchase = orders.length > 0 ? orders[orders.length - 1].purchaseDate : null;
    if (lastPurchase && lastPurchase < oneEightyDaysAgo) {
      segmentMemberships['Dormant Shoppers'].push(customer._id);
    }

    // 5. Festival Buyers: Majority (>50%) purchases during festival periods
    const festivalPurchasesCount = orders.filter(o => o.isFestivalPeriod).length;
    if (orders.length > 0 && festivalPurchasesCount / orders.length > 0.5) {
      segmentMemberships['Festival Buyers'].push(customer._id);
    }

    // 6. Cart Abandoners: Added products to cart but did not complete checkout
    if (cartAbandonersSet.has(userId)) {
      segmentMemberships['Cart Abandoners'].push(customer._id);
    }

    // 7. Discount Seekers: Majority (>50%) purchases used discounts
    const discountPurchasesCount = orders.filter(o => o.hasDiscount).length;
    if (orders.length > 0 && discountPurchasesCount / orders.length > 0.5) {
      segmentMemberships['Discount Seekers'].push(customer._id);
    }

    // 8. Premium Buyers: Average order value above 2500
    if (orders.length > 0) {
      const avgOrderValue = lifetimeSpend / orders.length;
      if (avgOrderValue > 2500) {
        segmentMemberships['Premium Buyers'].push(customer._id);
      }
    }
  });

  const segmentsToInsert = [
    { name: 'New Shoppers', description: 'First purchase within the last 30 days', userIds: segmentMemberships['New Shoppers'] },
    { name: 'Repeat Buyers', description: 'Customers with more than one completed order', userIds: segmentMemberships['Repeat Buyers'] },
    { name: 'High Value Shoppers', description: 'Customers with lifetime spend above ₹10,000', userIds: segmentMemberships['High Value Shoppers'] },
    { name: 'Dormant Shoppers', description: 'No purchases in the last 180 days', userIds: segmentMemberships['Dormant Shoppers'] },
    { name: 'Festival Buyers', description: 'Majority of purchases done during festival periods (Diwali, Holi, Dussehra)', userIds: segmentMemberships['Festival Buyers'] },
    { name: 'Cart Abandoners', description: 'Have products currently in their cart but did not complete checkout', userIds: segmentMemberships['Cart Abandoners'] },
    { name: 'Discount Seekers', description: 'Majority of purchases made with a discount applied', userIds: segmentMemberships['Discount Seekers'] },
    { name: 'Premium Buyers', description: 'Average order value (AOV) above ₹2,500', userIds: segmentMemberships['Premium Buyers'] }
  ];

  await Segment.insertMany(segmentsToInsert);
  console.log('Seeded customer segments.');

  // 7. Seed Sample Campaigns & Communication Analytics
  console.log('Seeding sample campaigns and communication receipts...');
  
  const sampleCampaignsData = [
    {
      userId: marketer._id,
      name: 'Diwali Festival Bonanza',
      goal: 'Promote traditional wear during festive seasons',
      targetSegment: 'Festival Buyers',
      objective: 'Increase sales of apparel products',
      channel: 'Email',
      subject: 'Sparkle this Diwali with Traditional Outfits - 20% Off!',
      messageTemplate: 'Dear {{name}}, celebrate Diwali with exclusive collections from Xeno. Use coupon DIWALI20 at checkout for 20% off!',
      callToAction: 'Shop Diwali Collection',
      expectedConversion: 15,
      status: 'Sent',
      createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)
    },
    {
      userId: marketer._id,
      name: 'Reactivate Dormant Shoppers',
      goal: 'Win back users who did not buy recently',
      targetSegment: 'Dormant Shoppers',
      objective: 'Re-engage customers and drive a purchase',
      channel: 'WhatsApp',
      subject: 'We miss you!',
      messageTemplate: 'Hi {{name}}, we notice you haven\'t visited Xeno in a while. Here is a special ₹500 voucher for you: MISSYOU500. Valid for 7 days!',
      callToAction: 'Claim Voucher',
      expectedConversion: 10,
      status: 'Sent',
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
    },
    {
      userId: marketer._id,
      name: 'VIP Product Premiere',
      goal: 'Reward premium buyers with early access',
      targetSegment: 'Premium Buyers',
      objective: 'Promote high-margin electronics',
      channel: 'SMS',
      subject: 'VIP Preview',
      messageTemplate: 'Hey {{name}}, get exclusive early access to the new Smart Fitness Band V4. Limited stock available for VIPs!',
      callToAction: 'Buy VIP Early Access',
      expectedConversion: 8,
      status: 'Draft',
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    }
  ];

  const campaigns = await Campaign.insertMany(sampleCampaignsData);

  // Generate communication logs for sent campaigns
  const sentCampaigns = campaigns.filter(c => c.status === 'Sent');
  const communicationLogs = [];

  for (const campaign of sentCampaigns) {
    const targetSegmentDoc = await Segment.findOne({ name: campaign.targetSegment });
    if (!targetSegmentDoc) continue;

    // Pick 100 random users from segment to have simulated communication receipts
    const segmentUsers = targetSegmentDoc.userIds;
    const sampleSize = Math.min(segmentUsers.length, 100);
    const shuffledUsers = [...segmentUsers].sort(() => 0.5 - Math.random()).slice(0, sampleSize);

    shuffledUsers.forEach(userId => {
      // Simulate receipt states
      // Sent (100%), Delivered (90%), Opened (70%), Clicked (30%), Converted (12%)
      const rand = Math.random() * 100;
      let status = 'Sent';
      
      if (rand < 5) {
        status = 'Failed';
      } else if (rand < 25) {
        status = 'Delivered';
      } else if (rand < 50) {
        status = 'Opened';
      } else if (rand < 80) {
        status = 'Clicked';
      } else {
        status = 'Converted';
      }

      communicationLogs.push({
        campaignId: campaign._id,
        userId,
        status,
        channel: campaign.channel,
        sentAt: campaign.createdAt,
        updatedAt: new Date(campaign.createdAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000)
      });
    });
  }

  await Communication.insertMany(communicationLogs);
  console.log('Seeded communication receipts.');

  // Ensure Campaign Attribution has matching orders to calculate Revenue Influenced
  console.log('Attributing orders to converted communications...');
  const convertedComms = communicationLogs.filter(c => c.status === 'Converted');
  for (const comm of convertedComms) {
    const orderDate = new Date(comm.updatedAt.getTime() + 10000); // 10s after conversion
    const orderItems = [];
    const numItems = Math.floor(Math.random() * 2) + 1;
    let subtotal = 0;
    for (let k = 0; k < numItems; k++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 2) + 1;
      orderItems.push({
        product: p._id,
        quantity: qty,
        price: p.price
      });
      subtotal += p.price * qty;
    }
    const discountApplied = Math.random() > 0.5 ? Math.floor(subtotal * 0.1) : 0;
    
    await Order.create({
      userId: comm.userId,
      items: orderItems,
      totalAmount: subtotal - discountApplied,
      discountApplied,
      hasDiscount: discountApplied > 0,
      purchaseDate: orderDate,
      isFestivalPeriod: checkIfFestival(orderDate)
    });
  }
  console.log(`Successfully attributed ${convertedComms.length} orders for conversion simulation.`);

  console.log('Database seeding completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
