const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  hasDiscount: {
    type: Boolean,
    default: false
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  isFestivalPeriod: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Order', OrderSchema);
