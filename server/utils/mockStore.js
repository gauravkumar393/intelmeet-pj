// Simple in-memory fallback store if MongoDB is not available
const mockStore = {
  users: [],
  meetings: [],
  workspaces: [
    {
      _id: 'default-workspace-id',
      name: 'General Space',
      description: 'The default public workspace for IntellMeet collaboration.',
      createdBy: 'system',
      members: [],
      notes: 'Welcome to your collaborative workspace notes! You can type here, and all participants will see your edits in real-time.',
      chatHistory: [
        {
          user: 'system',
          userName: 'IntellMeet Bot',
          text: 'Welcome to the General Space workspace! Send messages or edit the notes above.',
          timestamp: new Date(),
        }
      ],
      createdAt: new Date(),
    }
  ],
};

const isDBConnected = () => {
  const mongoose = require('mongoose');
  return mongoose.connection.readyState === 1;
};

module.exports = { mockStore, isDBConnected };
