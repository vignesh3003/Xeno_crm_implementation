const Todo = require('../models/Todo');
const Campaign = require('../models/Campaign');
const Segment = require('../models/Segment');

// @desc    Get all todos (with dynamic AI-generated tasks sync)
// @route   GET /api/todos
// @access  Private (Marketer)
const getTodos = async (req, res) => {
  try {
    const marketerId = req.user._id;

    // Fetch details to determine AI tasks
    const failedCampaigns = await Campaign.find({ status: 'Failed' });
    const dormantCampaigns = await Campaign.find({ targetSegment: 'Dormant Shoppers', status: 'Sent' });
    const sentCampaigns = await Campaign.find({ status: 'Sent' });
    const segments = await Segment.find({});

    const hasTask = async (titlePrefix) => {
      const exists = await Todo.findOne({
        marketerId,
        title: { $regex: new RegExp('^' + titlePrefix, 'i') }
      });
      return !!exists;
    };

    // 1. Review failed campaigns
    if (failedCampaigns.length > 0) {
      const title = `Review failed campaign: ${failedCampaigns[0].name}`;
      const exists = await hasTask('Review failed campaign');
      if (!exists) {
        await Todo.create({ marketerId, title, completed: false, aiGenerated: true });
      }
    }

    // 2. Launch dormant user campaign
    if (dormantCampaigns.length === 0) {
      const title = 'Launch dormant user campaign';
      const exists = await hasTask('Launch dormant');
      if (!exists) {
        await Todo.create({ marketerId, title, completed: false, aiGenerated: true });
      }
    }

    // 3. Analyze campaign performance
    if (sentCampaigns.length > 0) {
      const title = 'Analyze campaign performance';
      const exists = await hasTask('Analyze campaign');
      if (!exists) {
        await Todo.create({ marketerId, title, completed: false, aiGenerated: true });
      }
    }

    // 4. Create new segment
    if (segments.length < 8) {
      const title = 'Create new segment';
      const exists = await hasTask('Create new segment');
      if (!exists) {
        await Todo.create({ marketerId, title, completed: false, aiGenerated: true });
      }
    }

    // 5. Check analytics dashboard
    const exists = await hasTask('Check analytics');
    if (!exists) {
      await Todo.create({ marketerId, title: 'Check analytics dashboard', completed: false, aiGenerated: true });
    }

    const todos = await Todo.find({ marketerId }).sort({ createdAt: 1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create manual todo task
// @route   POST /api/todos
// @access  Private (Marketer)
const createTodo = async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  try {
    const todo = await Todo.create({
      marketerId: req.user._id,
      title,
      completed: false,
      aiGenerated: false
    });
    res.status(201).json(todo);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update todo completion or details
// @route   PUT /api/todos/:id
// @access  Private (Marketer)
const updateTodo = async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, marketerId: req.user._id });
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }

    if (req.body.completed !== undefined) {
      todo.completed = req.body.completed;
    }
    if (req.body.title !== undefined) {
      todo.title = req.body.title;
    }

    await todo.save();
    res.json(todo);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete todo task
// @route   DELETE /api/todos/:id
// @access  Private (Marketer)
const deleteTodo = async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, marketerId: req.user._id });
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    res.json({ success: true, message: 'Todo deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo
};
