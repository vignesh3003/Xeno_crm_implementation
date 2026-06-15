require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { updateReceipt } = require('./controllers/campaignController');

// Connect Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets (CSS, JS, Images) from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API LOGGER MIDDLEWARE
app.use((req, res, next) => {
  req._startTime = Date.now();
  const { method, originalUrl, query, body } = req;
  
  let userId = 'Anonymous';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforxenocrm');
      userId = decoded.id || decoded._id || 'Invalid Token';
    } catch (err) {
      userId = 'Token Error';
    }
  }

  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - req._startTime;
    console.log(`[API LOG] Request: ${method} ${originalUrl} | UserID: ${userId} | Params: ${JSON.stringify(query)} | Body: ${JSON.stringify(body)}`);
    console.log(`[API LOG] Response: ${res.statusCode} | Duration: ${duration}ms | Data: ${JSON.stringify(data)}`);
    return originalJson.apply(this, arguments);
  };

  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/product'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/segments', require('./routes/segment'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/campaigns', require('./routes/campaign'));
app.use('/api/analytics', require('./routes/analytics'));

// Direct Route Aliases for Stabilization
const { getPreferences, updatePreferences, loginUser } = require('./controllers/authController');
const { getActivityStream, getDashboardData } = require('./controllers/analyticsController');
const { protect } = require('./middleware/auth');

app.route('/api/preferences')
  .get(protect, getPreferences)
  .put(protect, updatePreferences);

app.post('/api/login', loginUser);
app.get('/api/activity', protect, getActivityStream);
app.get('/api/analytics', protect, getDashboardData);

// Webhook callback from Channel Service
app.post('/api/receipt', updateReceipt);

// Health check endpoint for deployment validation
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'crm-service', timestamp: new Date() });
});

// Test AI connection endpoint
app.get('/api/test-ai', async (req, res) => {
  try {
    const { getSegmentInsights } = require('./services/aiService');
    const result = await getSegmentInsights('New Shoppers', 1, { aov: 1000 });
    res.json({
      success: true,
      response: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Premium clean URLs routing for HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'login.html'));
});

app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'customer.html'));
});

app.get('/marketer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'marketer.html'));
});

app.get('/segments', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'segments.html'));
});

app.get('/insights', (req, res) => {
  res.redirect('/copilot');
});

app.get('/campaigns', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'campaigns.html'));
});

app.get('/copilot', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'copilot.html'));
});

app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'analytics.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'settings.html'));
});

// Wildcard JSON 404 for unmapped api endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.method} ${req.originalUrl} not found` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[API ERROR STACK]', err.stack);
  res.status(500).json({ success: false, message: 'Server error: ' + err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`CRM Service running on port ${PORT}`);

  // Check if database is empty and auto-seed in the background to ensure first-time startup works out of the box
  try {
    const User = require('./models/User');
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('Database is empty. Triggering database auto-seeding in the background...');
      const { fork } = require('child_process');
      const path = require('path');
      const seederPath = path.join(__dirname, 'seed.js');
      
      const child = fork(seederPath, [], {
        env: { ...process.env }
      });
      
      child.on('close', (code) => {
        console.log(`Database auto-seeding completed. Child process exited with code ${code}`);
      });
    } else {
      console.log('Database already has records. Skipping auto-seed.');
    }
  } catch (err) {
    console.error('Failed to run database auto-seeding check:', err.message);
  }
});
