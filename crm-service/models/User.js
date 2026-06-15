const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['customer', 'marketer'],
    default: 'customer'
  },
  city: {
    type: String,
    default: ''
  },
  preferences: {
    type: Object,
    default: {
      widgets: [
        { id: 'campaign-summary', visible: true, order: 0 },
        { id: 'kpis', visible: true, order: 1 },
        { id: 'recent-activity', visible: true, order: 2 },
        { id: 'quick-actions', visible: true, order: 3 },
        { id: 'ai-assistant-widget', visible: true, order: 4 },
        { id: 'segments-widget', visible: false, order: 5 }
      ]
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
