import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Keyboard, BookOpen, Clock, Calendar, CheckSquare, Brain, MessageSquare, ArrowRight, X } from 'lucide-react';

const DashboardPage = ({ onJoinMeeting, onJoinWorkspace }) => {
  const { token, user, API_URL } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [showJoinMeeting, setShowJoinMeeting] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [selectedMeetingReport, setSelectedMeetingReport] = useState(null);

  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // Fetch meetings history
      const meetingsRes = await fetch(`${API_URL}/meetings/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (meetingsRes.ok) {
        const meetingsData = await meetingsRes.json();
        setMeetings(meetingsData);
      }

      // Fetch workspaces
      const workspacesRes = await fetch(`${API_URL}/workspaces`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (workspacesRes.ok) {
        const workspacesData = await workspacesRes.json();
        setWorkspaces(workspacesData);
      }
    } catch (error) {
      console.error('Error fetching dashboard listings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!newTitle) return;

    // Generate random meeting code: xxx-xxxx-xxx
    const genPart = () => Math.random().toString(36).substr(2, 3);
    const meetingCode = `${genPart()}-${genPart()}-${genPart()}`;

    try {
      const response = await fetch(`${API_URL}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle, meetingId: meetingCode })
      });

      if (response.ok) {
        const meeting = await response.json();
        onJoinMeeting(meeting.meetingId, meeting.title);
      } else {
        alert('Failed to initiate meeting room');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    if (!joinCode) return;
    onJoinMeeting(joinCode);
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!wsName) return;

    try {
      const response = await fetch(`${API_URL}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: wsName, description: wsDesc })
      });

      if (response.ok) {
        const workspace = await response.json();
        setWsName('');
        setWsDesc('');
        setShowCreateWorkspace(false);
        fetchDashboardData();
        onJoinWorkspace(workspace._id);
      } else {
        alert('Failed to create team workspace');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleActionItem = async (meetingId, itemId, currentStatus) => {
    try {
      const response = await fetch(`${API_URL}/meetings/${meetingId}/action-items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId, completed: !currentStatus })
      });

      if (response.ok) {
        const updatedMeeting = await response.json();
        // Update local report display
        if (selectedMeetingReport && selectedMeetingReport.meetingId === meetingId) {
          setSelectedMeetingReport(updatedMeeting);
        }
        // Update meetings list
        setMeetings(prev => prev.map(m => m.meetingId === meetingId ? updatedMeeting : m));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div className="glow-effect glow-indigo"></div>
      <div className="glow-effect glow-cyan"></div>

      <div className="dashboard-grid">
        {/* Left Column: Actions and Workspaces */}
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Welcome, {user?.name}!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Configure instantaneous collaboration hubs or browse meeting actions.</p>
          </div>

          <div className="meeting-action-cards">
            <div className="action-card glass-panel" onClick={() => setShowCreateMeeting(true)}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                marginBottom: '16px'
              }}>
                <Plus size={24} />
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>New Meeting</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Instantly launch a video conference and invite participants.</p>
            </div>

            <div className="action-card glass-panel" onClick={() => setShowJoinMeeting(true)}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(6, 182, 212, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-secondary)',
                marginBottom: '16px'
              }}>
                <Keyboard size={24} />
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Join Meeting</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enter a unique room code to join an active audio/video feed.</p>
            </div>
          </div>

          {/* Collaborative Workspaces Section */}
          <div className="glass-panel dashboard-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} style={{ color: 'var(--accent-primary)' }} />
                Team Workspaces
              </h3>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setShowCreateWorkspace(true)}>
                Create Space
              </button>
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading workspaces...</p>
            ) : workspaces.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No workspaces configured. Create a space to collaborate on shared chat feeds and notes.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workspaces.map((ws) => (
                  <div 
                    key={ws._id}
                    onClick={() => onJoinWorkspace(ws._id)}
                    className="glass-panel"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                  >
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600' }}>{ws.name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{ws.description || 'No description provided'}</p>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Historical Logs and AI Insights */}
        <div>
          <div className="glass-panel dashboard-card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} style={{ color: 'var(--accent-secondary)' }} />
              Meeting History
            </h3>

            {loading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading history...</p>
            ) : meetings.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No historical logs available.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {meetings.map((meeting) => (
                  <div 
                    key={meeting._id} 
                    className="glass-panel" 
                    style={{ 
                      padding: '14px', 
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}
                  >
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '6px' }}>{meeting.title}</h4>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        {new Date(meeting.startTime).toLocaleDateString()}
                      </span>
                      <span>ID: {meeting.meetingId}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.75rem', flex: 1 }}
                        onClick={() => onJoinMeeting(meeting.meetingId)}
                      >
                        Rejoin
                      </button>
                      
                      {(meeting.summary || meeting.actionItems?.length > 0) && (
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 10px', fontSize: '0.75rem', flex: 1, gap: '4px' }}
                          onClick={() => setSelectedMeetingReport(meeting)}
                        >
                          <Brain size={12} />
                          AI Report
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE MEETING MODAL */}
      {showCreateMeeting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel" style={{ padding: '30px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Launch a Meeting</h3>
            <form onSubmit={handleCreateMeeting}>
              <div className="form-group">
                <label className="form-label">Meeting Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="E.g. Weekly Sync" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateMeeting(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Start Meeting</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN MEETING MODAL */}
      {showJoinMeeting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel" style={{ padding: '30px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Join Conference</h3>
            <form onSubmit={handleJoinMeeting}>
              <div className="form-group">
                <label className="form-label">Meeting Code</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="xxx-xxxx-xxx" 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowJoinMeeting(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Join Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE WORKSPACE MODAL */}
      {showCreateWorkspace && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel" style={{ padding: '30px', width: '90%', maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '16px' }}>Create Team Workspace</h3>
            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label className="form-label">Workspace Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="E.g. Development Team" 
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  style={{ minHeight: '80px', resize: 'none' }}
                  placeholder="Brief overview of the workspace goal." 
                  value={wsDesc}
                  onChange={(e) => setWsDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateWorkspace(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Space</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEETING AI REPORT MODAL */}
      {selectedMeetingReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel" style={{ 
            padding: '30px', 
            width: '90%', 
            maxWidth: '650px', 
            maxHeight: '85vh', 
            display: 'flex', 
            flexDirection: 'column' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain style={{ color: 'var(--accent-primary)' }} />
                AI Post-Meeting Analytics
              </h3>
              <button 
                className="btn btn-secondary btn-icon" 
                style={{ width: '32px', height: '32px', border: 'none', background: 'transparent' }}
                onClick={() => setSelectedMeetingReport(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '6px' }}>
              <div>
                <h4 style={{ color: 'var(--accent-secondary)', fontSize: '1rem', marginBottom: '8px' }}>Meeting Summary</h4>
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '16px', 
                    fontSize: '0.9rem', 
                    lineHeight: '1.6', 
                    background: 'rgba(255,255,255,0.01)',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {selectedMeetingReport.summary || 'Summary generation processing...'}
                </div>
              </div>

              {selectedMeetingReport.actionItems?.length > 0 && (
                <div>
                  <h4 style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginBottom: '8px' }}>Extracted Action Items</h4>
                  <div className="action-items-list">
                    {selectedMeetingReport.actionItems.map((item) => (
                      <div 
                        key={item._id || item.task} 
                        className={`action-item-row ${item.completed ? 'completed' : ''}`}
                      >
                        <input 
                          type="checkbox" 
                          checked={item.completed}
                          onChange={() => handleToggleActionItem(selectedMeetingReport.meetingId, item._id || item.task, item.completed)}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '500' }}>{item.task}</p>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assignee: {item.assignee}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '15px' }}>
              <button className="btn btn-primary" onClick={() => setSelectedMeetingReport(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
