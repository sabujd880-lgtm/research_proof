import { useState, useEffect } from 'react';
import { Users, Plus, Check, Clock3, Trash2, Shield, Calendar, AlertCircle } from 'lucide-react';

interface Member {
  _id: string;
  projectId: string;
  userId?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
  email?: string;
  role: 'owner' | 'editor' | 'reviewer' | 'viewer';
  status: 'active' | 'invited' | 'declined';
  createdAt?: string;
}

interface Task {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  stage: string;
  dueDate?: string;
}

interface Activity {
  type: string;
  title: string;
  date: string;
}

interface ResearchCollaborationProps {
  token: string;
  activeProject: any;
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

export default function ResearchCollaboration({
  token,
  activeProject,
  setSection,
  setMessage,
  setError
}: ResearchCollaborationProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'reviewer' | 'viewer'>('editor');

  // Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [taskStage, setTaskStage] = useState('general');

  const projectId = activeProject?._id;

  const fetchCollaborationData = async () => {
    if (!projectId) return;
    try {
      // 1. Members
      const memRes = await fetch(`/api/v1/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (memRes.ok) setMembers(await memRes.json());

      // 2. Tasks
      const taskRes = await fetch(`/api/v1/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (taskRes.ok) setTasks(await taskRes.json());

      // 3. Activity
      const actRes = await fetch(`/api/v1/projects/${projectId}/activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (actRes.ok) setActivities(await actRes.json());
    } catch (err: any) {
      console.warn('Failed to load collaboration data:', err.message);
    }
  };

  useEffect(() => {
    fetchCollaborationData();
  }, [projectId, token]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !inviteEmail.trim()) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite collaborator');

      setMessage(`Collaborator ${inviteEmail} invited as ${inviteRole}.`);
      setInviteEmail('');
      setShowInviteModal(false);
      fetchCollaborationData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !taskTitle.trim()) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim(),
          priority: taskPriority,
          stage: taskStage
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');

      setMessage(`Task "${data.title}" added to project board.`);
      setTaskTitle('');
      setTaskDesc('');
      setShowTaskModal(false);
      setTasks(prev => [data, ...prev]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'review' | 'done') => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Remove this collaborator from the project?')) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMembers(prev => prev.filter(m => m._id !== memberId));
        setMessage('Collaborator removed.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <Users size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Module 8 · Research Collaboration & Roles
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
            Multi-User Project Workspace & Task Board
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Coordinate co-authors, peer reviewers, and advisors with granular role permissions and shared tasks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="secondary"
            onClick={() => setShowTaskModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> New Task
          </button>
          <button
            className="primary"
            onClick={() => setShowInviteModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Users size={16} /> Invite Researcher
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* Left Column: Tasks Board & Project Members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Team Members Panel */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>
              Project Research Team ({members.length})
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {members.map(m => (
                <div key={m._id} style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>
                      {m.userId?.displayName || m.email || 'Researcher'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {m.userId?.email || m.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: m.role === 'owner' ? '#fee2e2' : m.role === 'editor' ? '#dbeafe' : '#f1f5f9',
                      color: m.role === 'owner' ? '#991b1b' : m.role === 'editor' ? '#1e40af' : '#475569'
                    }}>
                      {m.role}
                    </span>
                    {m.role !== 'owner' && (
                      <button
                        className="icon-button"
                        onClick={() => handleDeleteMember(m._id)}
                        title="Remove member"
                        style={{ color: '#dc2626', padding: '2px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kanban Task Columns */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>
              Project Workflow Tasks
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              {(['todo', 'in_progress', 'review', 'done'] as const).map(statusKey => {
                const statusTasks = tasks.filter(t => t.status === statusKey);
                const statusTitles: Record<string, string> = {
                  todo: 'To Do',
                  in_progress: 'In Progress',
                  review: 'Under Review',
                  done: 'Completed'
                };

                return (
                  <div key={statusKey} style={{
                    background: 'var(--surface2)',
                    borderRadius: '8px',
                    padding: '12px',
                    minHeight: '260px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '12px' }}>
                      <span>{statusTitles[statusKey]}</span>
                      <span style={{ background: 'var(--card-bg)', padding: '1px 6px', borderRadius: '8px', fontSize: '10px' }}>
                        {statusTasks.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {statusTasks.map(task => (
                        <div key={task._id} style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px',
                          fontSize: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{task.title}</div>
                          {task.description && (
                            <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>
                              {task.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: task.priority === 'urgent' ? '#fee2e2' : task.priority === 'high' ? '#ffedd5' : '#f1f5f9',
                              color: task.priority === 'urgent' ? '#991b1b' : task.priority === 'high' ? '#c2410c' : '#475569',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              {task.priority}
                            </span>

                            {/* Move controls */}
                            <select
                              value={task.status}
                              onChange={e => handleUpdateTaskStatus(task._id, e.target.value as any)}
                              style={{ fontSize: '10px', padding: '2px 4px' }}
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">Review</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Activity Timeline Stream */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px',
          height: 'fit-content'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>
            Live Project Audit Timeline
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activities.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
                No recent activity logged for this project.
              </div>
            ) : (
              activities.map((act, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid var(--border-color, #f1f5f9)',
                  fontSize: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    marginTop: '6px'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{act.title}</div>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                      {new Date(act.date).toLocaleString()}
                    </small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
            width: '100%', maxWidth: '440px', padding: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Invite Collaborator to Project</h3>
            <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>User Email *</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@university.edu"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Project Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="editor">Editor (Can edit manuscripts, citations, and data)</option>
                  <option value="reviewer">Reviewer (Can add comments and review integrity)</option>
                  <option value="viewer">Viewer (Read-only access to drafts and dossiers)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button type="submit" className="primary">Send Invitation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showTaskModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
            width: '100%', maxWidth: '480px', padding: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Create Project Task</h3>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conduct two-way ANOVA on EEG frequency spectra"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Task details and deliverables..."
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Priority</label>
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as any)}
                    style={{ width: '100%' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Workflow Stage</label>
                  <select
                    value={taskStage}
                    onChange={e => setTaskStage(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="general">General</option>
                    <option value="literature">Literature Review</option>
                    <option value="analysis">Statistical Analysis</option>
                    <option value="drafting">Manuscript Drafting</option>
                    <option value="review">Peer Review</option>
                    <option value="submission">Journal Submission</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="primary">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
