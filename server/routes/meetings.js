const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { protect } = require('../middleware/auth');
const { mockStore, isDBConnected } = require('../utils/mockStore');

// @route   POST /api/meetings
// @desc    Create a new meeting
// @access  Private
router.post('/', protect, async (req, res) => {
  const { title, meetingId } = req.body;

  if (!title || !meetingId) {
    return res.status(400).json({ message: 'Please provide a title and meetingId' });
  }

  try {
    const meetingData = {
      meetingId,
      title,
      host: req.user._id,
      participants: [{ user: req.user._id, name: req.user.name, joinedAt: new Date() }],
      transcript: [],
      summary: '',
      actionItems: [],
      isActive: true,
      startTime: new Date(),
    };

    if (isDBConnected()) {
      const meeting = await Meeting.create(meetingData);
      res.status(201).json(meeting);
    } else {
      // Mock DB save
      const mockMeeting = {
        ...meetingData,
        _id: 'mock_m_' + Math.random().toString(36).substr(2, 9),
      };
      mockStore.meetings.push(mockMeeting);
      res.status(201).json(mockMeeting);
    }
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Server error creating meeting' });
  }
});

// @route   GET /api/meetings/history
// @desc    Get user's past meetings
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    if (isDBConnected()) {
      const meetings = await Meeting.find({
        $or: [
          { host: req.user._id },
          { 'participants.user': req.user._id }
        ]
      }).sort({ startTime: -1 });
      res.json(meetings);
    } else {
      // Mock DB fetch
      const userMeetings = mockStore.meetings.filter(
        (m) =>
          String(m.host) === String(req.user._id) ||
          m.participants.some((p) => String(p.user) === String(req.user._id))
      );
      // Sort mock meetings by startTime descending
      userMeetings.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      res.json(userMeetings);
    }
  } catch (error) {
    console.error('Fetch meetings history error:', error);
    res.status(500).json({ message: 'Server error retrieving history' });
  }
});

// @route   GET /api/meetings/:meetingId
// @desc    Get details of a specific meeting
// @access  Private
router.get('/:meetingId', protect, async (req, res) => {
  const { meetingId } = req.params;
  try {
    if (isDBConnected()) {
      let meeting = await Meeting.findOne({ meetingId }).populate('host', 'name email');
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      res.json(meeting);
    } else {
      // Mock DB fetch
      const meeting = mockStore.meetings.find((m) => m.meetingId === meetingId);
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found (mock db)' });
      }
      res.json(meeting);
    }
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Server error retrieving meeting details' });
  }
});

// @route   PUT /api/meetings/:meetingId/transcript
// @desc    Append transcript line to a meeting
// @access  Private
router.put('/:meetingId/transcript', protect, async (req, res) => {
  const { meetingId } = req.params;
  const { speaker, text } = req.body;

  if (!text) {
    return res.status(400).json({ message: 'Transcript text is required' });
  }

  try {
    const transcriptLine = { speaker: speaker || req.user.name, text, timestamp: new Date() };

    if (isDBConnected()) {
      const meeting = await Meeting.findOneAndUpdate(
        { meetingId },
        { $push: { transcript: transcriptLine } },
        { new: true }
      );
      if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
      res.json(meeting);
    } else {
      const meetingIndex = mockStore.meetings.findIndex((m) => m.meetingId === meetingId);
      if (meetingIndex === -1) return res.status(404).json({ message: 'Meeting not found' });
      
      mockStore.meetings[meetingIndex].transcript.push(transcriptLine);
      res.json(mockStore.meetings[meetingIndex]);
    }
  } catch (error) {
    console.error('Update transcript error:', error);
    res.status(500).json({ message: 'Server error appending transcript' });
  }
});

// @route   PUT /api/meetings/:meetingId/action-items
// @desc    Toggle check/uncheck for action item
// @access  Private
router.put('/:meetingId/action-items', protect, async (req, res) => {
  const { meetingId } = req.params;
  const { itemId, completed } = req.body;

  try {
    if (isDBConnected()) {
      const meeting = await Meeting.findOneAndUpdate(
        { meetingId, 'actionItems._id': itemId },
        { $set: { 'actionItems.$.completed': completed } },
        { new: true }
      );
      if (!meeting) return res.status(404).json({ message: 'Meeting or Action Item not found' });
      res.json(meeting);
    } else {
      const meeting = mockStore.meetings.find((m) => m.meetingId === meetingId);
      if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
      
      const item = meeting.actionItems.find((a) => String(a._id) === String(itemId) || a.task === itemId);
      if (item) {
        item.completed = completed;
      }
      res.json(meeting);
    }
  } catch (error) {
    console.error('Toggle action item error:', error);
    res.status(500).json({ message: 'Server error updating action item' });
  }
});

module.exports = router;
