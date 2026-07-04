import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Video, VideoOff, Mic, MicOff, ScreenShare, PhoneOff, 
  MessageSquare, Brain, FileText, Send, Users, Sparkles, Plus, AlertCircle 
} from 'lucide-react';
import Whiteboard from '../components/Whiteboard';

const MeetingRoomPage = ({ roomId, initialTitle, socket, onLeave }) => {
  const { token, user, API_URL } = useAuth();
  const [meetingTitle, setMeetingTitle] = useState(initialTitle || 'Active Conference');
  const [peers, setPeers] = useState([]); // [{ socketId, userName, userID, stream, peerConnection }]
  const [localStream, setLocalStream] = useState(null);
  
  // UI Controls
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [shareActive, setShareActive] = useState(false);
  const [activeRightPanel, setActiveRightPanel] = useState('chat'); // 'chat', 'ai'

  // Chat & Transcript
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const localVideoRef = useRef(null);
  const peersRef = useRef([]); // tracks peer connections
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const screenStreamRef = useRef(null);

  // WebRTC ICE configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Helper: Create Mock canvas stream for local testing
  const createMockStream = (name) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    let frame = 0;
    const intervalId = setInterval(() => {
      if (!ctx) return;
      // Draw gradient background
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);
      
      // Pulsing geometric shapes
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(320, 240, 80 + Math.sin(frame * 0.1) * 15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(320, 240, 100 + Math.sin(frame * 0.15) * 10, 0, Math.PI * 2);
      ctx.stroke();
      
      // Initials text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
      ctx.fillText(initials || 'ME', 320, 240);
      
      // User name label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${name} (Virtual Camera)`, 320, 320);

      // Simple scanning light
      ctx.fillStyle = 'rgba(99,102,241,0.08)';
      ctx.fillRect(0, (frame * 5) % 480, 640, 15);
      
      frame++;
    }, 100);

    const videoStream = canvas.captureStream(24);

    // Audio context destination for silent audio track
    let audioTrack;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const dest = audioContext.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      audioTrack = dest.stream.getAudioTracks()[0];
    } catch (e) {
      console.warn('AudioContext not supported, using dummy track');
      const canvasStream = canvas.captureStream();
      audioTrack = canvasStream.getVideoTracks()[0]; // fallback
    }

    const stream = new MediaStream([videoStream.getVideoTracks()[0], audioTrack]);
    stream.stopMock = () => {
      clearInterval(intervalId);
    };
    return stream;
  };

  // Fetch meeting metadata
  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        const response = await fetch(`${API_URL}/meetings/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const mData = await response.json();
          setMeetingTitle(mData.title);
          setTranscript(mData.transcript || []);
          if (mData.summary) {
            setAiReport({ summary: mData.summary, actionItems: mData.actionItems || [] });
          }
        }
      } catch (err) {
        console.error('Error fetching meeting details:', err);
      }
    };
    fetchMeetingDetails();
  }, [roomId, token]);

  // Set up local camera / microphone stream
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Webcam or Microphone not found. Initializing virtual stream fallback for testing...');
        const virtualStream = createMockStream(user.name);
        setLocalStream(virtualStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = virtualStream;
        }
      }
    };

    initLocalStream();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        if (localStream.stopMock) localStream.stopMock();
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [user]);

  // Set up WebRTC socket handlers
  useEffect(() => {
    if (!socket || !localStream) return;

    // Join room signals
    socket.emit('join-room', {
      roomID: roomId,
      userID: user._id,
      userName: user.name
    });

    // Sockets listener for all existing users in the room
    socket.on('all-users', (users) => {
      users.forEach(({ socketId, userID, userName }) => {
        const peerConnection = createPeerConnection(socketId, userID, userName);
        peersRef.current.push({
          socketId,
          peerConnection,
          userName,
          userID
        });
      });
    });

    // Sockets listener when a new user connects
    socket.on('user-connected', ({ socketId, userID, userName }) => {
      console.log(`User connected from socket: ${socketId}`);
      // The newly connected user will initiate the offer, so we just wait or set up connection
    });

    // Relayed SDP Offer received
    socket.on('user-joined', async ({ signal, callerID, userName, userID }) => {
      console.log(`Received signal offer from peer ${userName} (${callerID})`);
      const peerConnection = answerPeerConnection(callerID, signal, userID, userName);
      peersRef.current.push({
        socketId: callerID,
        peerConnection,
        userName,
        userID
      });
    });

    // Relayed SDP Answer response received
    socket.on('receiving-returned-signal', async ({ signal, id }) => {
      console.log(`Received returned signal answer from socket ${id}`);
      const item = peersRef.current.find(p => p.socketId === id);
      if (item) {
        await item.peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      }
    });

    // Relayed ICE Candidate received
    socket.on('ice-candidate', async ({ candidate, from }) => {
      const item = peersRef.current.find(p => p.socketId === from);
      if (item && candidate) {
        try {
          await item.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ice candidate:', e);
        }
      }
    });

    // Message relays
    socket.on('meeting-chat-message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
      setTranscript(prev => [...prev, { speaker: msg.senderName, text: msg.text, timestamp: msg.timestamp }]);
    });

    // When a peer leaves
    socket.on('user-disconnected', ({ socketId, userName }) => {
      console.log(`User disconnected: ${userName}`);
      const peerObj = peersRef.current.find(p => p.socketId === socketId);
      if (peerObj) {
        peerObj.peerConnection.close();
      }
      peersRef.current = peersRef.current.filter(p => p.socketId !== socketId);
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
    });

    return () => {
      socket.off('all-users');
      socket.off('user-connected');
      socket.off('user-joined');
      socket.off('receiving-returned-signal');
      socket.off('ice-candidate');
      socket.off('meeting-chat-message');
      socket.off('user-disconnected');
      peersRef.current.forEach(p => p.peerConnection.close());
      peersRef.current = [];
      setPeers([]);
    };
  }, [socket, localStream]);

  // Web Speech API for real-time captions/transcription
  useEffect(() => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Speech) {
      const rec = new Speech();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        const latestIndex = event.results.length - 1;
        const speechText = event.results[latestIndex][0].transcript;
        
        if (speechText.trim() && socket) {
          // Emit text to server as transcript line
          socket.emit('meeting-chat-message', {
            roomID: roomId,
            text: speechText,
            senderName: user.name,
            senderID: user._id
          });
        }
      };

      rec.onerror = (e) => console.error('Speech recognition error:', e.error);
      recognitionRef.current = rec;
      
      if (micActive) {
        try { rec.start(); } catch(e) {}
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, [micActive, socket]);

  // Helper: Create Connection (Offer Side)
  const createPeerConnection = (targetSocketId, targetUserId, targetUserName) => {
    const pc = new RTCPeerConnection(iceServers);

    // Add local tracks
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Gather candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          target: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Receive Remote Stream
    pc.ontrack = (event) => {
      setPeers(prev => {
        const exists = prev.some(p => p.socketId === targetSocketId);
        if (exists) {
          return prev.map(p => p.socketId === targetSocketId ? { ...p, stream: event.streams[0] } : p);
        }
        return [...prev, { socketId: targetSocketId, userName: targetUserName, userID: targetUserId, stream: event.streams[0], peerConnection: pc }];
      });
    };

    // Create Offer
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('sending-signal', {
          userToSignal: targetSocketId,
          callerID: socket.id,
          signal: offer
        });
      } catch (err) {
        console.error(err);
      }
    };

    return pc;
  };

  // Helper: Answer Connection (Receiver Side)
  const answerPeerConnection = (callerSocketId, offerSignal, callerUserId, callerUserName) => {
    const pc = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          target: callerSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setPeers(prev => {
        const exists = prev.some(p => p.socketId === callerSocketId);
        if (exists) {
          return prev.map(p => p.socketId === callerSocketId ? { ...p, stream: event.streams[0] } : p);
        }
        return [...prev, { socketId: callerSocketId, userName: callerUserName, userID: callerUserId, stream: event.streams[0], peerConnection: pc }];
      });
    };

    // Set Remote & Answer
    const setSDPandAnswer = async () => {
      await pc.setRemoteDescription(new RTCSessionDescription(offerSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('returning-signal', {
        callerID: callerSocketId,
        signal: answer
      });
    };

    setSDPandAnswer();
    return pc;
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micActive;
        setMicActive(!micActive);
      }
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camActive;
        setCamActive(!camActive);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (shareActive) {
      if (screenStreamRef.current) {
        const cameraTrack = localStream?.getVideoTracks()[0];
        stopScreenSharing(screenStreamRef.current, cameraTrack);
        screenStreamRef.current = null;
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        const cameraTrack = localStream?.getVideoTracks()[0];

        // Replace track for all active peers
        peersRef.current.forEach(({ peerConnection }) => {
          const senders = peerConnection.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        // Update local display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Handle stop sharing browser ribbon button click
        screenTrack.onended = () => {
          stopScreenSharing(screenStream, cameraTrack);
          screenStreamRef.current = null;
        };

        setShareActive(true);
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    }
  };

  const stopScreenSharing = (screenStream, cameraTrack) => {
    screenStream.getTracks().forEach(t => t.stop());
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    peersRef.current.forEach(({ peerConnection }) => {
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender && cameraTrack) {
        videoSender.replaceTrack(cameraTrack);
      }
    });
    setShareActive(false);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    if (socket) {
      socket.emit('meeting-chat-message', {
        roomID: roomId,
        text: typedMessage,
        senderName: user.name,
        senderID: user._id
      });
      setTypedMessage('');
    }
  };

  const simulateDialogueMessage = () => {
    // Inserts structured conversation blocks to test summaries
    const dialogs = [
      { spk: "Sarah (Product)", txt: "I think we should target the Q3 release for the collaborative whiteboard module. We need to finalize the mockups by next week." },
      { spk: "Alex (Engineering)", txt: "I'll take care of establishing the WebRTC connection mesh optimization. I will check the socket room limits too." },
      { spk: "Sarah (Product)", txt: "Great! Please review draft guidelines. Also, could you write the schema configurations, John?" },
      { spk: "John (You)", txt: "Yes, I will write the schemas and draft the integration tests. I'll setup the DB connector." }
    ];

    dialogs.forEach((d, idx) => {
      setTimeout(() => {
        if (socket) {
          socket.emit('meeting-chat-message', {
            roomID: roomId,
            text: d.txt,
            senderName: d.spk,
            senderID: user._id
          });
        }
      }, idx * 1000);
    });
  };

  const triggerAISummary = async () => {
    if (transcript.length === 0) {
      setAiError('Transcript is empty. Type some chat messages or run the simulated dialogue to generate summary text.');
      return;
    }

    setAiLoading(true);
    setAiError('');
    try {
      const response = await fetch(`${API_URL}/ai/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ meetingId: roomId })
      });

      const data = await response.json();
      if (response.ok) {
        setAiReport({ summary: data.summary, actionItems: data.actionItems || [] });
      } else {
        setAiError(data.message || 'Failed to generate AI report');
      }
    } catch (err) {
      setAiError('Connection error contacting AI service.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleToggleActionItem = async (itemId, currentStatus) => {
    try {
      const response = await fetch(`${API_URL}/meetings/${roomId}/action-items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId, completed: !currentStatus })
      });

      if (response.ok) {
        const updatedMeeting = await response.json();
        setAiReport(prev => ({
          ...prev,
          actionItems: updatedMeeting.actionItems || []
        }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="meeting-room-layout">
      {/* Left Area: Video grids and controller */}
      <div className="video-section">
        {/* Header bar */}
        <div style={{
          height: '60px',
          padding: '0 24px',
          background: 'rgba(11,15,25,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-glass)'
        }}>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>{meetingTitle}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Code: {roomId}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="recording-dot"></div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', fontWeight: '600' }}>LIVE</span>
          </div>
        </div>

        {/* Video Grid */}
        <div className="video-grid-container">
          {/* Local User */}
          <div className="video-wrapper">
            <video ref={localVideoRef} autoPlay muted playsInline />
            <div className="video-label">{user.name} (You)</div>
          </div>

          {/* Remote Peers */}
          {peers.map((peer) => (
            <div key={peer.socketId} className="video-wrapper">
              <video 
                autoPlay 
                playsInline
                ref={(el) => {
                  if (el && peer.stream) {
                    el.srcObject = peer.stream;
                  }
                }}
              />
              <div className="video-label">{peer.userName}</div>
            </div>
          ))}
        </div>

        {/* Control bar */}
        <div className="controls-bar">
          <button 
            onClick={toggleMic}
            className={`btn ${micActive ? 'btn-secondary' : 'btn-danger'} btn-icon`}
            title={micActive ? 'Mute Mic' : 'Unmute Mic'}
          >
            {micActive ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button 
            onClick={toggleCam}
            className={`btn ${camActive ? 'btn-secondary' : 'btn-danger'} btn-icon`}
            title={camActive ? 'Stop Camera' : 'Start Camera'}
          >
            {camActive ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button 
            className="btn btn-secondary btn-icon"
            title="Toggle Screen Share"
            onClick={toggleScreenShare}
            style={{ borderColor: shareActive ? 'var(--accent-primary)' : 'var(--border-glass)' }}
          >
            <ScreenShare size={20} style={{ color: shareActive ? 'var(--accent-primary)' : 'var(--text-primary)' }} />
          </button>

          <button 
            onClick={onLeave}
            className="btn btn-danger"
            style={{ gap: '8px', padding: '10px 24px', borderRadius: '30px' }}
          >
            <PhoneOff size={18} />
            Leave Room
          </button>
        </div>
      </div>

      {/* Right Area: Chat Feed, Transcription & AI Dashboard */}
      <div className="meeting-sidebar">
        <div className="sidebar-tab-header">
          <button 
            className={`tab-btn ${activeRightPanel === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('chat')}
          >
            <MessageSquare size={16} />
            Room Chat
          </button>
          <button 
            className={`tab-btn ${activeRightPanel === 'board' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('board')}
          >
            <FileText size={16} />
            Whiteboard
          </button>
          <button 
            className={`tab-btn ${activeRightPanel === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('ai')}
          >
            <Brain size={16} />
            IntellMeet AI
          </button>
        </div>

        {/* Panel 1: Chat Message Feed */}
        {activeRightPanel === 'chat' && (
          <div className="tab-content">
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px' }}>
                  No messages yet. Send a note or speak to start transcription!
                </div>
              ) : (
                chatMessages.map((msg, index) => {
                  const isMine = msg.senderID === user._id;
                  return (
                    <div 
                      key={index}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                        maxWidth: '85%' 
                      }}
                    >
                      {!isMine && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '2px', marginLeft: '4px' }}>
                          {msg.senderName}
                        </span>
                      )}
                      <div className={`chat-bubble ${isMine ? 'mine' : 'other'}`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="chat-input-area">
              <input 
                type="text" 
                className="form-input" 
                placeholder="Type a message..." 
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-icon">
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* Panel: Collaborative Whiteboard */}
        {activeRightPanel === 'board' && (
          <div className="tab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Whiteboard roomId={roomId} socket={socket} />
          </div>
        )}

        {/* Panel 2: IntellMeet AI Analytics & Summary */}
        {activeRightPanel === 'ai' && (
          <div className="tab-content" style={{ gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px' }}
                onClick={triggerAISummary}
                disabled={aiLoading}
              >
                <Sparkles size={14} />
                {aiLoading ? 'Analyzing...' : 'Generate AI Summary'}
              </button>

              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                onClick={simulateDialogueMessage}
                title="Inject mock discussion to easily test AI summarize functionality."
              >
                <Plus size={14} />
                Simulate Talk
              </button>
            </div>

            {aiError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--accent-danger)',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{aiError}</span>
              </div>
            )}

            {/* AI Report Results Container */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {aiReport ? (
                <>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)', marginBottom: '8px' }}>Meeting Summary</h4>
                    <div className="glass-panel" style={{ padding: '14px', fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {aiReport.summary}
                    </div>
                  </div>

                  {aiReport.actionItems?.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', marginBottom: '8px' }}>Extracted Action Items</h4>
                      <div className="action-items-list">
                        {aiReport.actionItems.map((item) => (
                          <div 
                            key={item._id || item.task} 
                            className={`action-item-row ${item.completed ? 'completed' : ''}`}
                          >
                            <input 
                              type="checkbox" 
                              checked={item.completed}
                              onChange={() => handleToggleActionItem(item._id || item.task, item.completed)}
                            />
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: '500', fontSize: '0.8rem' }}>{item.task}</p>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Assignee: {item.assignee}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                  No summary generated yet. Click the button above to analyze transcript speech.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRoomPage;
