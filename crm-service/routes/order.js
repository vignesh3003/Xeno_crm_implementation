const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

router.use(protect); // Authenticate all order routes

router.route('/')
  .post(createOrder)
  .get(getMyOrders);

module.exports = router;
