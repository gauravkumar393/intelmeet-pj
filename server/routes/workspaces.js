const express = require('express');
const router = express.Router();
const Workspace = require('../models/Workspace');
const { protect } = require('../middleware/auth');
const { mockStore, isDBConnected } = require('../utils/mockStore');

// @route   GET /api/workspaces
// @desc    Get all workspaces for the logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    if (isDBConnected()) {
      // Find workspaces where user is creator or member
      const workspaces = await Workspace.find({
        $or: [
          { createdBy: req.user._id },
          { members: req.user._id }
        ]
      }).sort({ createdAt: -1 });
      res.json(workspaces);
    } else {
      // Mock DB list
      res.json(mockStore.workspaces);
    }
  } catch (error) {
    console.error('Fetch workspaces error:', error);
    res.status(500).json({ message: 'Server error retrieving workspaces' });
  }
});

// @route   POST /api/workspaces
// @desc    Create a new workspace
// @access  Private
router.post('/', protect, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Workspace name is required' });
  }

  try {
    const workspaceData = {
      name,
      description: description || '',
      createdBy: req.user._id,
      members: [req.user._id],
      notes: `Welcome to ${name} collaborative notes! Feel free to edit this.`,
      chatHistory: [
        {
          user: req.user._id,
          userName: 'System',
          text: `Workspace "${name}" was created.`,
          timestamp: new Date()
        }
      ],
      createdAt: new Date()
    };

    if (isDBConnected()) {
      const workspace = await Workspace.create(workspaceData);
      res.status(201).json(workspace);
    } else {
      const mockWorkspace = {
        ...workspaceData,
        _id: 'mock_w_' + Math.random().toString(36).substr(2, 9),
      };
      mockStore.workspaces.push(mockWorkspace);
      res.status(201).json(mockWorkspace);
    }
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ message: 'Server error creating workspace' });
  }
});

// @route   GET /api/workspaces/:id
// @desc    Get details of a workspace
// @access  Private
router.get('/:id', protect, async (req, res) => {
  const { id } = req.params;
  try {
    if (isDBConnected()) {
      const workspace = await Workspace.findById(id)
        .populate('createdBy', 'name email')
        .populate('members', 'name email');
      if (!workspace) {
        return res.status(404).json({ message: 'Workspace not found' });
      }
      res.json(workspace);
    } else {
      const workspace = mockStore.workspaces.find((w) => String(w._id) === String(id));
      if (!workspace) {
        return res.status(404).json({ message: 'Workspace not found (mock db)' });
      }
      res.json(workspace);
    }
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ message: 'Server error retrieving workspace' });
  }
});

// @route   PUT /api/workspaces/:id/notes
// @desc    Update workspace notes
// @access  Private
router.put('/:id/notes', protect, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    if (isDBConnected()) {
      const workspace = await Workspace.findByIdAndUpdate(
        id,
        { $set: { notes } },
        { new: true }
      );
      if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
      res.json(workspace);
    } else {
      const workspace = mockStore.workspaces.find((w) => String(w._id) === String(id));
      if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
      
      workspace.notes = notes;
      res.json(workspace);
    }
  } catch (error) {
    console.error('Update workspace notes error:', error);
    res.status(500).json({ message: 'Server error updating notes' });
  }
});

module.exports = router;
