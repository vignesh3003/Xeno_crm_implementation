const mongoose = require('mongoose');

const CommunicationSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Sent', 'Delivered', 'Failed', 'Opened', 'Clicked', 'Converted'],
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['Email', 'WhatsApp', 'SMS'],
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: {
    type: Date
  },
  openedAt: {
    type: Date
  },
  clickedAt: {
    type: Date
  },
  convertedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Communication', CommunicationSchema);
