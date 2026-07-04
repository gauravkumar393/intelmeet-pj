const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { mockStore, isDBConnected } = require('./utils/mockStore');

// Models (loaded conditionally inside database actions)
const Workspace = require('./models/Workspace');
const Meeting = require('./models/Meeting');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io initialization with CORS config
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/ai', require('./routes/ai'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    dbConnected: isDBConnected(),
    time: new Date(),
  });
});

// Socket.io Event Handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // ==========================================
  // WebRTC & Meeting Signaling Events
  // ==========================================
  
  // When a user joins a meeting room
  socket.on('join-room', async ({ roomID, userID, userName }) => {
    socket.join(roomID);
    socket.roomID = roomID;
    socket.userID = userID;
    socket.userName = userName;
    
    console.log(`${userName} (${userID}) joined room: ${roomID}`);
    
    // Notify other users in the room
    socket.to(roomID).emit('user-connected', {
      socketId: socket.id,
      userID,
      userName,
    });

    // Send the list of current users in the room to the newly joined user
    const clients = io.sockets.adapter.rooms.get(roomID);
    const usersInRoom = [];
    if (clients) {
      for (const clientId of clients) {
        if (clientId !== socket.id) {
          const clientSocket = io.sockets.sockets.get(clientId);
          usersInRoom.push({
            socketId: clientId,
            userID: clientSocket?.userID,
            userName: clientSocket?.userName,
          });
        }
      }
    }
    socket.emit('all-users', usersInRoom);

    // Save participant log inside Database or mockStore
    try {
      if (isDBConnected()) {
        await Meeting.findOneAndUpdate(
          { meetingId: roomID },
          { 
            $addToSet: { 
              participants: { user: userID, name: userName, joinedAt: new Date() } 
            } 
          }
        );
      } else {
        const meeting = mockStore.meetings.find(m => m.meetingId === roomID);
        if (meeting) {
          const exists = meeting.participants.some(p => String(p.user) === String(userID));
          if (!exists) {
            meeting.participants.push({ user: userID, name: userName, joinedAt: new Date() });
          }
        }
      }
    } catch (err) {
      console.error('Error logging participant join:', err.message);
    }
  });

  // Relay WebRTC SDP Offers
  socket.on('sending-signal', (payload) => {
    // Relays offer to a specific target peer
    io.to(payload.userToSignal).emit('user-joined', {
      signal: payload.signal,
      callerID: payload.callerID, // caller's socket.id
      userName: socket.userName,
      userID: socket.userID
    });
  });

  // Relay WebRTC SDP Answers
  socket.on('returning-signal', (payload) => {
    // Relays response SDP back to the caller peer
    io.to(payload.callerID).emit('receiving-returned-signal', {
      signal: payload.signal,
      id: socket.id, // answerer's socket.id
    });
  });

  // Relay ICE Candidates
  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', {
      candidate: payload.candidate,
      from: socket.id
    });
  });

  // Real-time Meeting Chat Messages
  socket.on('meeting-chat-message', async ({ roomID, text, senderName, senderID }) => {
    const chatMsg = {
      senderID,
      senderName,
      text,
      timestamp: new Date(),
    };
    
    // Broadcast to room
    io.to(roomID).emit('meeting-chat-message', chatMsg);

    // Append to Meeting Transcript log in DB or Mock
    try {
      if (isDBConnected()) {
        await Meeting.findOneAndUpdate(
          { meetingId: roomID },
          {
            $push: {
              transcript: { speaker: senderName, text, timestamp: new Date() }
            }
          }
        );
      } else {
        const meeting = mockStore.meetings.find(m => m.meetingId === roomID);
        if (meeting) {
          meeting.transcript.push({ speaker: senderName, text, timestamp: new Date() });
        }
      }
    } catch (err) {
      console.error('Error logging chat message to transcript:', err.message);
    }
  });

  // ==========================================
  // Workspace Collaboration & Sync Events
  // ==========================================
  
  // When a user opens a workspace page
  socket.on('join-workspace', ({ workspaceID, userName, userID }) => {
    socket.join(workspaceID);
    console.log(`User ${userName} joined workspace: ${workspaceID}`);
  });

  // Broadcast collaborative note updates
  socket.on('workspace-notes-change', async ({ workspaceID, notes }) => {
    // Send notes content update to all other clients in the workspace room
    socket.to(workspaceID).emit('workspace-notes-change', { notes });

    // Periodically save to DB/Mock (or simple save per edit)
    try {
      if (isDBConnected()) {
        await Workspace.findByIdAndUpdate(workspaceID, { $set: { notes } });
      } else {
        const workspace = mockStore.workspaces.find(w => String(w._id) === String(workspaceID));
        if (workspace) {
          workspace.notes = notes;
        }
      }
    } catch (err) {
      console.error('Error saving workspace notes edit:', err.message);
    }
  });

  // Real-time Workspace Chat Feed Messages
  socket.on('workspace-chat-message', async ({ workspaceID, text, senderName, senderID }) => {
    const workspaceMsg = {
      user: senderID,
      userName: senderName,
      text,
      timestamp: new Date(),
    };

    // Broadcast to the entire workspace room (including the sender to confirm reception)
    io.to(workspaceID).emit('workspace-chat-message', workspaceMsg);

    // Append to Workspace Chat history in DB/Mock
    try {
      if (isDBConnected()) {
        await Workspace.findByIdAndUpdate(workspaceID, {
          $push: { chatHistory: workspaceMsg }
        });
      } else {
        const workspace = mockStore.workspaces.find(w => String(w._id) === String(workspaceID));
        if (workspace) {
          workspace.chatHistory.push(workspaceMsg);
        }
      }
    } catch (err) {
      console.error('Error saving workspace chat message:', err.message);
    }
  });

  // ==========================================
  // Collaborative Whiteboard Events
  // ==========================================
  socket.on('whiteboard-draw', ({ roomID, x0, y0, x1, y1, color, size }) => {
    socket.to(roomID).emit('whiteboard-draw', { x0, y0, x1, y1, color, size });
  });

  socket.on('whiteboard-clear', ({ roomID }) => {
    socket.to(roomID).emit('whiteboard-clear');
  });

  // Handle Client Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.roomID) {
      socket.to(socket.roomID).emit('user-disconnected', {
        socketId: socket.id,
        userID: socket.userID,
        userName: socket.userName,
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
