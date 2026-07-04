import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import WorkspacePage from './pages/WorkspacePage';
import MeetingRoomPage from './pages/MeetingRoomPage';
import Navbar from './components/Navbar';
import io from 'socket.io-client';

const AppContent = () => {
  const { user, token, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard', 'meeting', 'workspace'
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [socket, setSocket] = useState(null);

  // Manage socket.io lifecycle
  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Initialize Socket connection
    const socketUrl = 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Successfully connected to IntellMeet Sockets!');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-glass)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'pulse-ring 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Restoring secure session...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Auth screens
  if (!user) {
    return <AuthPage />;
  }

  // Navigation handlers
  const handleJoinMeeting = (roomId, title = '') => {
    setActiveRoomId(roomId);
    setMeetingTitle(title || `Meeting: ${roomId}`);
    setCurrentPage('meeting');
  };

  const handleJoinWorkspace = (workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    setCurrentPage('workspace');
  };

  const handleLeaveMeeting = () => {
    setActiveRoomId(null);
    setCurrentPage('dashboard');
  };

  const handleTabChange = (tabName) => {
    if (tabName === 'dashboard') {
      setCurrentPage('dashboard');
      setActiveRoomId(null);
      setActiveWorkspaceId(null);
    } else if (tabName === 'workspace') {
      // Find workspace and load first, fallback if none
      setCurrentPage('workspace');
      if (!activeWorkspaceId) {
        setActiveWorkspaceId('default-workspace-id'); // fallback general space
      }
    }
  };

  return (
    <div className="app-container">
      {/* Conditionally hide Navbar inside active meeting fullscreen */}
      {currentPage !== 'meeting' && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Navbar activePage={currentPage} onTabChange={handleTabChange} />
          
          <main className="main-content">
            {currentPage === 'dashboard' && (
              <DashboardPage 
                onJoinMeeting={handleJoinMeeting} 
                onJoinWorkspace={handleJoinWorkspace} 
              />
            )}
            
            {currentPage === 'workspace' && activeWorkspaceId && (
              <WorkspacePage 
                workspaceId={activeWorkspaceId} 
                socket={socket} 
              />
            )}
          </main>
        </div>
      )}

      {currentPage === 'meeting' && activeRoomId && (
        <div style={{ width: '100vw', height: '100vh' }}>
          <MeetingRoomPage 
            roomId={activeRoomId} 
            initialTitle={meetingTitle}
            socket={socket} 
            onLeave={handleLeaveMeeting} 
          />
        </div>
      )}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
