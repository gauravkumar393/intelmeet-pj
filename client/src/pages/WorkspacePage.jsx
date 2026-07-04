import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, FileText, Send, MessageSquare, AlertCircle } from 'lucide-react';
import io from 'socket.io-client';

const WorkspacePage = ({ workspaceId, socket }) => {
  const { token, user, API_URL } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [notes, setNotes] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' or 'chat'
  
  const chatEndRef = useRef(null);
  const localNotesRef = useRef('');

  // Fetch workspace on load
  useEffect(() => {
    const fetchWorkspaceDetails = async () => {
      try {
        const response = await fetch(`${API_URL}/workspaces/${workspaceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const wsData = await response.json();
          setWorkspace(wsData);
          setNotes(wsData.notes || '');
          localNotesRef.current = wsData.notes || '';
          setChatMessages(wsData.chatHistory || []);
        }
      } catch (error) {
        console.error('Error fetching workspace:', error);
      }
    };

    fetchWorkspaceDetails();
  }, [workspaceId, token]);

  // Join workspace socket room
  useEffect(() => {
    if (!socket || !workspaceId) return;

    socket.emit('join-workspace', {
      workspaceID: workspaceId,
      userName: user.name,
      userID: user._id
    });

    // Notes updates handler
    const handleNotesChange = (data) => {
      setNotes(data.notes);
      localNotesRef.current = data.notes;
    };

    // Chat messages handler
    const handleChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    socket.on('workspace-notes-change', handleNotesChange);
    socket.on('workspace-chat-message', handleChatMessage);

    return () => {
      socket.off('workspace-notes-change', handleNotesChange);
      socket.off('workspace-chat-message', handleChatMessage);
    };
  }, [socket, workspaceId, user]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleNotesEdit = (e) => {
    const val = e.target.value;
    setNotes(val);
    localNotesRef.current = val;

    // Send note updates to other workspace peers
    if (socket) {
      socket.emit('workspace-notes-change', {
        workspaceID: workspaceId,
        notes: val
      });
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    if (socket) {
      socket.emit('workspace-chat-message', {
        workspaceID: workspaceId,
        text: typedMessage,
        senderName: user.name,
        senderID: user._id
      });
      setTypedMessage('');
    }
  };

  if (!workspace) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading Workspace...
      </div>
    );
  }

  return (
    <div className="workspace-container">
      {/* Glow Backdrops */}
      <div className="glow-effect glow-indigo" style={{ opacity: 0.1 }}></div>

      {/* Main Workspace Body */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '24px', height: '100%', overflow: 'hidden' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{workspace.name}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{workspace.description || 'General team workspace'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={14} />
              {workspace.members?.length || 1} Member(s)
            </span>
          </div>
        </div>

        {/* Tab Selection for Mobile/Tablets */}
        <div className="sidebar-tab-header" style={{ marginBottom: '12px', border: '1px solid var(--border-glass)', borderRadius: '12px', display: 'none' }}>
          <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Notes</button>
          <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Workspace Chat</button>
        </div>

        {/* Notes Editor (Workspace Left Panel) */}
        <div className="glass-panel" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '1.05rem' }}>Collaborative Document Notes</h3>
          </div>
          <textarea
            className="editor-textarea"
            placeholder="Type notes here. Anyone else viewing this workspace will see edits instantly in real-time."
            value={notes}
            onChange={handleNotesEdit}
          />
        </div>
      </div>

      {/* Workspace Sidebar - Persistent Chat Feed */}
      <div className="meeting-sidebar">
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <MessageSquare size={18} style={{ color: 'var(--accent-secondary)' }} />
          <h3 style={{ fontSize: '1rem' }}>Team Discussion</h3>
        </div>

        <div className="tab-content" style={{ padding: '20px' }}>
          {/* Message List */}
          <div className="chat-messages">
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '20px' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                No messages yet. Send a note to the workspace!
              </div>
            ) : (
              chatMessages.map((msg, index) => {
                const isMine = String(msg.user) === String(user._id);
                return (
                  <div key={index} style={{ display: 'flex', flexDirection: 'column', alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    {!isMine && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '2px', marginLeft: '4px' }}>
                        {msg.userName}
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

          {/* Input form */}
          <form onSubmit={handleSendChat} className="chat-input-area">
            <input
              type="text"
              className="form-input"
              style={{ flex: 1, padding: '10px 14px' }}
              placeholder="Message team..."
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-icon" style={{ flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;
