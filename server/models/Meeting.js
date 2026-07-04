const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  transcript: [
    {
      speaker: String,
      text: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  summary: {
    type: String,
    default: '',
  },
  actionItems: [
    {
      task: String,
      assignee: String,
      completed: {
        type: Boolean,
        default: false,
      },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
});

module.exports = mongoose.model('Meeting', MeetingSchema);
