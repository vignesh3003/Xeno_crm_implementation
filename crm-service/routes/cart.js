const express = require('express');
const router = express.Router();
const { getCart, addToCart, clearCart } = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.use(protect); // Ensure all cart operations are authenticated

router.route('/')
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

module.exports = router;
