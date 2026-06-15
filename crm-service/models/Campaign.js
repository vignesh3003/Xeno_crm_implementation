const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  goal: {
    type: String
  },
  targetSegment: {
    type: String,
    required: true,
    index: true
  },
  objective: {
    type: String
  },
  channel: {
    type: String,
    enum: ['Email', 'WhatsApp', 'SMS'],
    required: true
  },
  subject: {
    type: String
  },
  messageTemplate: {
    type: String,
    required: true
  },
  callToAction: {
    type: String
  },
  expectedConversion: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Executing'],
    default: 'Draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Campaign', CampaignSchema);
