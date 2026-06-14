const Segment = require('../models/Segment');
const User = require('../models/User');

// @desc    Get all segments and their member counts
// @route   GET /api/segments
// @access  Private (Marketer)
const getSegments = async (req, res) => {
  try {
    const segments = await Segment.find({});
    // Return segments along with customer count
    const result = segments.map(seg => ({
      _id: seg._id,
      name: seg.name,
      description: seg.description,
      customerCount: seg.userIds ? seg.userIds.length : 0,
      updatedAt: seg.updatedAt
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get customers by segment name
// @route   GET /api/segments/:name/customers
// @access  Private (Marketer)
const getCustomersBySegment = async (req, res) => {
  try {
    const segment = await Segment.findOne({ name: req.params.name }).populate({
      path: 'userIds',
      select: 'name email createdAt'
    });

    if (!segment) {
      return res.status(404).json({ message: `Segment '${req.params.name}' not found` });
    }

    res.json(segment.userIds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSegments,
  getCustomersBySegment
};
