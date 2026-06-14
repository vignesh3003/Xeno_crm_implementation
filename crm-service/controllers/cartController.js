const Cart = require('../models/Cart');

// @desc    Get current user's active cart
// @route   GET /api/cart
// @access  Private (Customer)
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id, abandoned: true }).populate('items.product');
    
    if (!cart) {
      cart = await Cart.create({
        userId: req.user._id,
        items: [],
        abandoned: true
      });
    }
    
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add or update item in cart
// @route   POST /api/cart
// @access  Private (Customer)
const addToCart = async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    let cart = await Cart.findOne({ userId: req.user._id, abandoned: true });

    if (!cart) {
      cart = new Cart({
        userId: req.user._id,
        items: [],
        abandoned: true
      });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }
    } else if (quantity > 0) {
      cart.items.push({ product: productId, quantity });
    }

    cart.updatedAt = new Date();
    await cart.save();

    // Populate and return updated cart
    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    res.json(updatedCart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear user's cart
// @route   DELETE /api/cart
// @access  Private (Customer)
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id, abandoned: true });
    if (cart) {
      cart.items = [];
      cart.updatedAt = new Date();
      await cart.save();
    }
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  clearCart
};
