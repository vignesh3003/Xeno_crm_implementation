const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'supersecretjwtkeyforxenocrm', {
    expiresIn: '30d'
  });
};

// @desc    Register a new customer
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const emailLower = email.toLowerCase();
    const assignedRole = emailLower.endsWith('@xeno.com') ? 'marketer' : 'customer';

    // Reject invalid role request
    if (req.body.role && req.body.role !== assignedRole) {
      return res.status(400).json({ message: 'Invalid role assignment for this email domain.' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(`\nLOGIN ATTEMPT:\nemail: ${email}`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User found: NO`);
      console.log(`Login failure reason: User not found\n`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log(`User found: YES`);
    console.log(`Role: ${user.role}`);

    const isMatch = await user.matchPassword(password);
    console.log(`Password hash match: ${isMatch ? 'TRUE' : 'FALSE'}`);

    if (isMatch) {
      console.log(`Login successful.\n`);

      // Save login event to Analytics
      const Analytics = require('../models/Analytics');
      try {
        let logDoc = await Analytics.findOne({ key: 'login_events' });
        if (!logDoc) {
          logDoc = new Analytics({ key: 'login_events', value: [] });
        }
        const events = logDoc.value || [];
        events.push({
          email: user.email,
          role: user.role,
          name: user.name,
          timestamp: new Date()
        });
        if (events.length > 50) {
          events.shift();
        }
        logDoc.value = events;
        logDoc.markModified('value');
        await logDoc.save();
      } catch (err) {
        console.error('Failed to log login event:', err);
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role)
      });
    } else {
      console.log(`Login failure reason: Password mismatch\n`);
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.log(`Login failure reason: Server error - ${error.message}\n`);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user preferences
// @route   GET /api/auth/preferences
// @access  Private
const getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const defaultPrefs = {
      widgets: [
        { id: 'today-tasks', visible: true, order: 0 },
        { id: 'kpis', visible: true, order: 1 },
        { id: 'recent-activity', visible: true, order: 2 },
        { id: 'quick-actions', visible: true, order: 3 },
        { id: 'ai-assistant-widget', visible: true, order: 4 },
        { id: 'segments-widget', visible: false, order: 5 }
      ]
    };
    res.json({ success: true, data: user.preferences || defaultPrefs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user preferences
// @route   PUT /api/auth/preferences
// @access  Private
const updatePreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.preferences = req.body;
    user.markModified('preferences');
    await user.save();
    res.json({ success: true, data: user.preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getPreferences,
  updatePreferences
};
