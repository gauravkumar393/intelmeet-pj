const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { protect } = require('../middleware/auth');
const { generateMeetingAIReport } = require('../services/aiService');
const { mockStore, isDBConnected } = require('../utils/mockStore');

// @route   POST /api/ai/summarize
// @desc    Generate summary and action items for a meeting and save them
// @access  Private
router.post('/summarize', protect, async (req, res) => {
  const { meetingId } = req.body;

  if (!meetingId) {
    return res.status(400).json({ message: 'Meeting ID is required' });
  }

  try {
    let meeting;
    let transcript = [];

    if (isDBConnected()) {
      meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      transcript = meeting.transcript;
    } else {
      meeting = mockStore.meetings.find((m) => m.meetingId === meetingId);
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found (mock db)' });
      }
      transcript = meeting.transcript;
    }

    if (transcript.length === 0) {
      return res.status(400).json({
        message: 'Cannot generate AI summary: Transcript is empty. Please type some messages or speak first.'
      });
    }

    // Call AI report generator
    const aiResult = await generateMeetingAIReport(transcript);

    // Save report to database or mock store
    if (isDBConnected()) {
      meeting.summary = aiResult.summary;
      // Add MongoDB ObjectIds to action items
      meeting.actionItems = aiResult.actionItems.map(item => ({
        task: item.task,
        assignee: item.assignee,
        completed: item.completed || false
      }));
      await meeting.save();
    } else {
      meeting.summary = aiResult.summary;
      meeting.actionItems = aiResult.actionItems.map((item, index) => ({
        _id: 'mock_a_' + index + '_' + Math.random().toString(36).substr(2, 5),
        task: item.task,
        assignee: item.assignee,
        completed: item.completed || false
      }));
    }

    res.json({
      summary: meeting.summary,
      actionItems: meeting.actionItems
    });
  } catch (error) {
    console.error('AI summarization route error:', error);
    res.status(500).json({ message: 'Server error generating AI summary' });
  }
});

module.exports = router;
