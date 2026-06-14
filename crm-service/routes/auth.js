const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getPreferences, updatePreferences } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerUser);
router.post('/login', loginUser);

router.route('/preferences')
  .get(protect, getPreferences)
  .put(protect, updatePreferences);

module.exports = router;
