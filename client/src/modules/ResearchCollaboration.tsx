import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Check,
  Clock3,
  Trash2,
  Shield,
  Calendar,
  AlertCircle,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  Edit3,
  Filter,
  Sparkles,
  Share2,
  Award,
  RefreshCw,
  Copy,
  ChevronRight,
  UserCheck
} from 'lucide-react';

interface Member {
  _id: string;
  projectId: string;
  userId?: {
    _id?: string;
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
  email?: string;
  role: 'owner' | 'editor' | 'reviewer' | 'viewer';
  status: 'active' | 'invited' | 'declined';
  createdAt?: string;
}

interface Invitation {
  _id: string;
  projectId: string;
  email: string;
  role: string;
  inviterId?: {
    displayName?: string;
    email?: string;
  };
  status: string;
  expiresAt: string;
  createdAt: string;
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
  createdAt?: string;
}

interface CommentReply {
  _id?: string;
  userId: {
    _id?: string;
    displayName?: string;
    email?: string;
  };
  content: string;
  createdAt: string;
}

interface CommentThread {
  _id: string;
  projectId: string;
  documentId: string;
  userId: {
    _id?: string;
    displayName?: string;
    email?: string;
  };
  selectedText?: string;
  content: string;
  resolved: boolean;
  replies: CommentReply[];
  createdAt: string;
}

interface ReviewRequest {
  _id: string;
  projectId: string;
  documentId: {
    _id?: string;
    title?: string;
    version?: number;
  };
  requesterId: {
    displayName?: string;
    email?: string;
  };
  reviewerId?: {
    displayName?: string;
    email?: string;
  };
  versionNumber: number;
  status: string;
  decision: string;
  decisionNotes?: string;
  score?: number;
  criteriaScores?: {
    methodologicalRigor?: number;
    academicClarity?: number;
    citationEvidence?: number;
    originality?: number;
  };
  timeline: Array<{
    event: string;
    timestamp: string;
    note?: string;
  }>;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'tasks' | 'reviews' | 'comments' | 'documents' | 'activity' | 'settings'>('overview');

  // Core Data
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<CommentThread[]>([]);
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals & Forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [activeReviewForDecision, setActiveReviewForDecision] = useState<ReviewRequest | null>(null);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'editor' | 'reviewer' | 'viewer'>('editor');
  const [lastGeneratedInviteUrl, setLastGeneratedInviteUrl] = useState('');

  // Task Form & Filter
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [taskStage, setTaskStage] = useState('general');
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'list'>('kanban');

  // Review Form
  const [reviewDocId, setReviewDocId] = useState('');
  const [reviewReviewerId, setReviewReviewerId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  // Decision Form
  const [decisionOutcome, setDecisionOutcome] = useState<'accept' | 'minor_revisions' | 'major_revisions' | 'reject'>('accept');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [rubricRigor, setRubricRigor] = useState(8);
  const [rubricClarity, setRubricClarity] = useState(8);
  const [rubricCitations, setRubricCitations] = useState(8);
  const [rubricOriginality, setRubricOriginality] = useState(8);

  // Comment Form
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentDocId, setNewCommentDocId] = useState('');
  const [newCommentAnchor, setNewCommentAnchor] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [commentFilterResolved, setCommentFilterResolved] = useState<'all' | 'open' | 'resolved'>('all');

  const projectId = activeProject?._id;

  const fetchCollaborationData = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Members
      const memRes = await fetch(`/api/v1/projects/${projectId}/members`, { headers });
      if (memRes.ok) setMembers(await memRes.json());

      // 2. Pending Invitations
      const invRes = await fetch(`/api/v1/projects/${projectId}/invitations`, { headers });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.invitations || []);
      }

      // 3. Tasks
      const taskRes = await fetch(`/api/v1/projects/${projectId}/tasks`, { headers });
      if (taskRes.ok) setTasks(await taskRes.json());

      // 4. Comments
      const commRes = await fetch(`/api/v1/projects/${projectId}/comments`, { headers });
      if (commRes.ok) {
        const commData = await commRes.json();
        setComments(commData.comments || []);
      }

      // 5. Reviews
      const revRes = await fetch(`/api/v1/projects/${projectId}/reviews`, { headers });
      if (revRes.ok) {
        const revData = await revRes.json();
        setReviews(revData.reviews || []);
      }

      // 6. Documents
      const docRes = await fetch(`/api/v1/documents?projectId=${projectId}`, { headers });
      if (docRes.ok) {
        const docsData = await docRes.json();
        const docList = Array.isArray(docsData) ? docsData : docsData.documents || [];
        setDocuments(docList);
        if (docList.length > 0 && !reviewDocId) setReviewDocId(docList[0]._id);
        if (docList.length > 0 && !newCommentDocId) setNewCommentDocId(docList[0]._id);
      }

      // 7. Activity
      const actRes = await fetch(`/api/v1/projects/${projectId}/activity`, { headers });
      if (actRes.ok) setActivities(await actRes.json());
    } catch (err: any) {
      console.warn('Failed to load collaboration data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborationData();
  }, [projectId, token]);

  // Member & Invitation Handlers
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !inviteEmail.trim()) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch invitation');

      setMessage(data.message || `Invitation sent to ${inviteEmail}`);
      if (data.invitation?.invitationUrl) {
        setLastGeneratedInviteUrl(`${window.location.origin}${data.invitation.invitationUrl}`);
      }
      setInviteEmail('');
      fetchCollaborationData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeInvitation = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/invitations/${inviteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage('Invitation successfully revoked.');
        setInvitations(prev => prev.filter(i => i._id !== inviteId));
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangeMemberRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update member role');

      setMessage(`Collaborator role updated to ${newRole}.`);
      setMembers(prev => prev.map(m => m._id === memberId ? { ...m, role: newRole as any } : m));
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove collaborator');

      setMembers(prev => prev.filter(m => m._id !== memberId));
      setMessage('Collaborator removed from research team.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Task Handlers
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t._id !== taskId));
        setMessage('Task removed.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Review Handlers
  const handleSubmitReviewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !reviewDocId) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId: reviewDocId,
          reviewerId: reviewReviewerId || undefined,
          notes: reviewNotes.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review request');

      setMessage('Manuscript submitted for internal peer review.');
      setShowReviewModal(false);
      setReviewNotes('');
      fetchCollaborationData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenDecisionModal = (rev: ReviewRequest) => {
    setActiveReviewForDecision(rev);
    setShowDecisionModal(true);
  };

  const handleSubmitReviewDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReviewForDecision) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/reviews/${activeReviewForDecision._id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          decision: decisionOutcome,
          decisionNotes: decisionNotes.trim(),
          criteriaScores: {
            methodologicalRigor: Number(rubricRigor),
            academicClarity: Number(rubricClarity),
            citationEvidence: Number(rubricCitations),
            originality: Number(rubricOriginality)
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit decision');

      setMessage(`Review decision "${decisionOutcome}" recorded.`);
      setShowDecisionModal(false);
      setDecisionNotes('');
      fetchCollaborationData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Comment Handlers
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newCommentText.trim() || !newCommentDocId) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId: newCommentDocId,
          selectedText: newCommentAnchor.trim(),
          content: newCommentText.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add comment');

      setMessage('Comment posted to discussion thread.');
      setNewCommentText('');
      setNewCommentAnchor('');
      setComments(prev => [data.comment, ...prev]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddReply = async (commentId: string) => {
    const text = replyTextMap[commentId];
    if (!text || !text.trim()) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: text.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit reply');

      setReplyTextMap(prev => ({ ...prev, [commentId]: '' }));
      setComments(prev => prev.map(c => c._id === commentId ? data.comment : c));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleResolveComment = async (commentId: string, currentResolved: boolean) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ resolved: !currentResolved })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update comment status');

      setComments(prev => prev.map(c => c._id === commentId ? { ...c, resolved: !currentResolved } : c));
      setMessage(!currentResolved ? 'Comment resolved.' : 'Comment reopened.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Metrics calculation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const openComments = comments.filter(c => !c.resolved).length;
  const activeReviews = reviews.filter(r => r.status === 'submitted_for_review' || r.status === 'under_review').length;

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Studio Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <Users size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Phase 10 · Research Collaboration Studio
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Multi-Author Research Workspace & Peer Review
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '6px 0 0' }}>
            Coordinate co-authors, peer review workflows, inline document feedback, and milestone task boards with 4-tier academic RBAC.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="secondary"
            onClick={fetchCollaborationData}
            title="Refresh Collaboration Data"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="secondary"
            onClick={() => setShowTaskModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Plus size={15} /> New Task
          </button>
          <button
            className="secondary"
            onClick={() => setShowReviewModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Award size={15} /> Request Review
          </button>
          <button
            className="primary"
            onClick={() => setShowInviteModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Users size={15} /> Invite Collaborator
          </button>
        </div>
      </div>

      {/* Studio Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'overview', label: '1. Overview', icon: Sparkles },
          { id: 'team', label: `2. Research Team (${members.length})`, icon: Users },
          { id: 'tasks', label: `3. Task Board (${tasks.length})`, icon: Calendar },
          { id: 'reviews', label: `4. Manuscript Reviews (${reviews.length})`, icon: Award },
          { id: 'comments', label: `5. Comments & Feedback (${comments.length})`, icon: MessageSquare },
          { id: 'documents', label: `6. Shared Documents (${documents.length})`, icon: FileText },
          { id: 'activity', label: '7. Audit & Activity', icon: Clock3 },
          { id: 'settings', label: '8. RBAC Matrix & Settings', icon: Shield }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <span>Research Team</span>
                <Users size={16} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{members.length} Active</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                {invitations.length} pending invitations
              </div>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <span>Task Execution</span>
                <Calendar size={16} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{taskCompletionRate}% Done</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                {completedTasks} of {totalTasks} milestones completed
              </div>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <span>Editorial Reviews</span>
                <Award size={16} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{activeReviews} In Review</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                {reviews.length} total review requests logged
              </div>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <span>Discussions</span>
                <MessageSquare size={16} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{openComments} Open</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                {comments.length - openComments} comments resolved
              </div>
            </div>
          </div>

          {/* Action Center Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Recent Review Milestones</h3>
              {reviews.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No manuscript reviews initiated yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reviews.slice(0, 4).map(rev => (
                    <div key={rev._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{rev.documentId?.title || 'Manuscript Draft'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          Requester: {rev.requesterId?.displayName || rev.requesterId?.email || 'Researcher'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        textTransform: 'uppercase',
                        background: rev.status === 'approved' ? '#dcfce7' : rev.status === 'changes_requested' ? '#fef3c7' : '#dbeafe',
                        color: rev.status === 'approved' ? '#166534' : rev.status === 'changes_requested' ? '#92400e' : '#1e40af'
                      }}>
                        {rev.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Live Activity Digest</h3>
              {activities.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No recorded activity in the current session.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activities.slice(0, 4).map((act, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                      <div style={{ flex: 1, fontWeight: 500 }}>{act.title}</div>
                      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>{new Date(act.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESEARCH TEAM & INVITATIONS */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active Members Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Active Research Team ({members.length})</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '4px 0 0' }}>
                  Manage project roles, modify privileges, or remove collaborators.
                </p>
              </div>
              <button className="primary" onClick={() => setShowInviteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={15} /> Invite Member
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {members.map(m => (
                <div key={m._id} style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>
                        {m.userId?.displayName || m.email || 'Researcher'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {m.userId?.email || m.email}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: m.role === 'owner' ? '#fee2e2' : m.role === 'editor' ? '#dbeafe' : m.role === 'reviewer' ? '#fef3c7' : '#f1f5f9',
                      color: m.role === 'owner' ? '#991b1b' : m.role === 'editor' ? '#1e40af' : m.role === 'reviewer' ? '#92400e' : '#475569'
                    }}>
                      {m.role}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Role:</span>
                      <select
                        value={m.role}
                        onChange={e => handleChangeMemberRole(m._id, e.target.value)}
                        style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}
                      >
                        <option value="owner">Owner</option>
                        <option value="editor">Editor</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>

                    <button
                      className="icon-button"
                      onClick={() => handleDeleteMember(m._id)}
                      title="Remove Member"
                      style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Invitations Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>Pending Invitations ({invitations.length})</h3>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px' }}>
              Sent invitations waiting for acceptance. Tokens remain valid for 7 days.
            </p>

            {invitations.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No pending invitations for this project.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {invitations.map(inv => (
                  <div key={inv._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{inv.email}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Role: <b style={{ textTransform: 'uppercase' }}>{inv.role}</b> · Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => handleRevokeInvitation(inv._id)}
                      style={{ fontSize: '12px', color: '#dc2626' }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TASK BOARD */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={taskViewMode === 'kanban' ? 'primary' : 'secondary'}
                onClick={() => setTaskViewMode('kanban')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Kanban View
              </button>
              <button
                className={taskViewMode === 'list' ? 'primary' : 'secondary'}
                onClick={() => setTaskViewMode('list')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                List View
              </button>
            </div>

            <button className="primary" onClick={() => setShowTaskModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <Plus size={15} /> New Task
            </button>
          </div>

          {taskViewMode === 'kanban' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {(['todo', 'in_progress', 'review', 'done'] as const).map(col => {
                const colTasks = tasks.filter(t => t.status === col);
                const colNames: Record<string, string> = {
                  todo: 'To Do',
                  in_progress: 'In Progress',
                  review: 'Under Review',
                  done: 'Completed'
                };
                return (
                  <div key={col} style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '14px', minHeight: '340px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '13px' }}>
                      <span>{colNames[col]}</span>
                      <span style={{ background: 'var(--card-bg)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                        {colTasks.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {colTasks.map(task => (
                        <div key={task._id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{task.title}</div>
                          {task.description && <p style={{ color: 'var(--muted)', margin: '0 0 8px', fontSize: '11px', lineHeight: '1.4' }}>{task.description}</p>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: task.priority === 'urgent' ? '#fee2e2' : task.priority === 'high' ? '#ffedd5' : '#f1f5f9',
                              color: task.priority === 'urgent' ? '#991b1b' : task.priority === 'high' ? '#c2410c' : '#475569'
                            }}>
                              {task.priority}
                            </span>
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
          ) : (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tasks.map(task => (
                  <div key={task._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{task.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Stage: {task.stage} · Priority: {task.priority}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <select
                        value={task.status}
                        onChange={e => handleUpdateTaskStatus(task._id, e.target.value as any)}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Completed</option>
                      </select>
                      <button className="icon-button" onClick={() => handleDeleteTask(task._id)} title="Delete Task" style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MANUSCRIPT REVIEWS */}
      {activeTab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Manuscript Peer Review Submissions</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '4px 0 0' }}>
                Track editorial decisions, rubric-based evaluation scores, and revision requests.
              </p>
            </div>
            <button className="primary" onClick={() => setShowReviewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <Plus size={15} /> Submit for Review
            </button>
          </div>

          {reviews.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '36px', textAlign: 'center' }}>
              <Award size={36} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700, fontSize: '15px' }}>No review requests yet</div>
              <p style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '400px', margin: '6px auto 16px' }}>
                Submit a manuscript draft to assign co-authors or advisors for structured internal peer review.
              </p>
              <button className="primary" onClick={() => setShowReviewModal(true)}>Request Review</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reviews.map(rev => (
                <div key={rev._id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                          {rev.documentId?.title || 'Manuscript Draft'}
                        </h4>
                        <span style={{ fontSize: '11px', background: 'var(--surface2)', padding: '2px 8px', borderRadius: '10px' }}>
                          v{rev.versionNumber}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                        Submitted by: {rev.requesterId?.displayName || rev.requesterId?.email || 'Author'} · Reviewer: {rev.reviewerId?.displayName || rev.reviewerId?.email || 'Unassigned'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {rev.score !== null && rev.score !== undefined && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
                            {rev.score}/100
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Rigor Score</div>
                        </div>
                      )}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        background: rev.status === 'approved' ? '#dcfce7' : rev.status === 'changes_requested' ? '#fef3c7' : rev.status === 'rejected' ? '#fee2e2' : '#dbeafe',
                        color: rev.status === 'approved' ? '#166534' : rev.status === 'changes_requested' ? '#92400e' : rev.status === 'rejected' ? '#991b1b' : '#1e40af'
                      }}>
                        {rev.status.replace(/_/g, ' ')}
                      </span>
                      <button className="secondary" onClick={() => handleOpenDecisionModal(rev)} style={{ fontSize: '12px' }}>
                        Issue Decision
                      </button>
                    </div>
                  </div>

                  {rev.decisionNotes && (
                    <div style={{ marginTop: '14px', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
                      <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '2px' }}>Editorial Feedback & Decision Notes:</div>
                      <div style={{ color: 'var(--muted)' }}>{rev.decisionNotes}</div>
                    </div>
                  )}

                  {rev.criteriaScores && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
                      <div>Methodology: <b>{rev.criteriaScores.methodologicalRigor || 'N/A'}/10</b></div>
                      <div>Clarity: <b>{rev.criteriaScores.academicClarity || 'N/A'}/10</b></div>
                      <div>Citations: <b>{rev.criteriaScores.citationEvidence || 'N/A'}/10</b></div>
                      <div>Originality: <b>{rev.criteriaScores.originality || 'N/A'}/10</b></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COMMENTS & FEEDBACK */}
      {activeTab === 'comments' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
          {/* Comments List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={commentFilterResolved === 'all' ? 'primary' : 'secondary'}
                  onClick={() => setCommentFilterResolved('all')}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  All ({comments.length})
                </button>
                <button
                  className={commentFilterResolved === 'open' ? 'primary' : 'secondary'}
                  onClick={() => setCommentFilterResolved('open')}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  Open ({openComments})
                </button>
                <button
                  className={commentFilterResolved === 'resolved' ? 'primary' : 'secondary'}
                  onClick={() => setCommentFilterResolved('resolved')}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  Resolved ({comments.length - openComments})
                </button>
              </div>
            </div>

            {comments
              .filter(c => commentFilterResolved === 'all' ? true : commentFilterResolved === 'open' ? !c.resolved : c.resolved)
              .map(comm => (
                <div key={comm._id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                  {comm.selectedText && (
                    <div style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '10px', marginBottom: '10px', fontSize: '12px', fontStyle: 'italic', color: 'var(--muted)' }}>
                      "{comm.selectedText}"
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>
                        {comm.userId?.displayName || comm.userId?.email || 'Researcher'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>
                        {new Date(comm.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => handleToggleResolveComment(comm._id, comm.resolved)}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      {comm.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>

                  <p style={{ margin: '8px 0 12px', fontSize: '13px', lineHeight: '1.4' }}>{comm.content}</p>

                  {/* Thread Replies */}
                  {comm.replies && comm.replies.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '14px', borderLeft: '2px solid var(--border-color)', marginBottom: '12px' }}>
                      {comm.replies.map((rep, idx) => (
                        <div key={idx} style={{ fontSize: '12px' }}>
                          <span style={{ fontWeight: 600 }}>{rep.userId?.displayName || 'Co-author'}: </span>
                          <span>{rep.content}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Write a reply..."
                      value={replyTextMap[comm._id] || ''}
                      onChange={e => setReplyTextMap({ ...replyTextMap, [comm._id]: e.target.value })}
                      style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                    />
                    <button className="secondary" onClick={() => handleAddReply(comm._id)} style={{ fontSize: '12px' }}>
                      Reply
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* New Comment Box */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', height: 'fit-content' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px' }}>Post Document Feedback</h4>
            <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Document</label>
                <select
                  value={newCommentDocId}
                  onChange={e => setNewCommentDocId(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  {documents.map(d => (
                    <option key={d._id} value={d._id}>{d.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Selected Passage / Quote (Optional)</label>
                <input
                  type="text"
                  placeholder="Paste excerpt from manuscript..."
                  value={newCommentAnchor}
                  onChange={e => setNewCommentAnchor(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Feedback / Question *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter suggestions, integrity questions, or revision notes..."
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <button type="submit" className="primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}>
                <Send size={14} /> Post Feedback
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: SHARED DOCUMENTS */}
      {activeTab === 'documents' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>Shared Project Manuscripts & Drafts</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 18px' }}>
            All co-authors with Editor or Owner privileges can edit and version these project documents.
          </p>

          {documents.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No documents created for this project yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {documents.map(doc => (
                <div key={doc._id} style={{ padding: '16px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{doc.title}</div>
                    <span style={{ fontSize: '10px', background: 'var(--card-bg)', padding: '2px 6px', borderRadius: '6px' }}>
                      v{doc.version || 1}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '8px 0 14px' }}>
                    Word Count: {doc.wordCount || 0} words · Updated: {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="primary"
                      onClick={() => setSection('editor')}
                      style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit3 size={13} /> Edit Manuscript
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: ACTIVITY AUDIT */}
      {activeTab === 'activity' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>Project Audit Stream</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 18px' }}>
            Immutable event history recording team member changes, reviews, comments, and task modifications.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activities.map((act, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                <div style={{ flex: 1, fontWeight: 500 }}>{act.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{new Date(act.date).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: RBAC MATRIX & SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>4-Tier Academic RBAC Permission Matrix</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 20px' }}>
            Standardized access control defining exact authorizations across research roles.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px' }}>Capability / Resource</th>
                  <th style={{ padding: '12px' }}>Owner</th>
                  <th style={{ padding: '12px' }}>Editor</th>
                  <th style={{ padding: '12px' }}>Reviewer</th>
                  <th style={{ padding: '12px' }}>Viewer</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'View Documents, Tasks, & Dossiers', o: true, e: true, r: true, v: true },
                  { feature: 'Edit Manuscript Text & References', o: true, e: true, r: false, v: false },
                  { feature: 'Create & Manage Kanban Tasks', o: true, e: true, r: false, v: false },
                  { feature: 'Post Inline Comments & Feedback', o: true, e: true, r: true, v: false },
                  { feature: 'Submit Manuscript for Review', o: true, e: true, r: false, v: false },
                  { feature: 'Issue Formal Peer Review Decision', o: true, e: false, r: true, v: false },
                  { feature: 'Invite Collaborators & Set Roles', o: true, e: false, r: false, v: false },
                  { feature: 'Archive / Delete Research Project', o: true, e: false, r: false, v: false }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{row.feature}</td>
                    <td style={{ padding: '12px' }}>{row.o ? <Check size={16} color="#166534" /> : <XCircle size={16} color="#991b1b" />}</td>
                    <td style={{ padding: '12px' }}>{row.e ? <Check size={16} color="#166534" /> : <XCircle size={16} color="#991b1b" />}</td>
                    <td style={{ padding: '12px' }}>{row.r ? <Check size={16} color="#166534" /> : <XCircle size={16} color="#991b1b" />}</td>
                    <td style={{ padding: '12px' }}>{row.v ? <Check size={16} color="#166534" /> : <XCircle size={16} color="#991b1b" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Invite Collaborator to Project</h3>
            <form onSubmit={handleSendInvitation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>User Email *</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@university.edu"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Project Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="editor">Editor (Can edit manuscripts, citations, and data)</option>
                  <option value="reviewer">Reviewer (Can add comments and review integrity)</option>
                  <option value="viewer">Viewer (Read-only access to drafts and dossiers)</option>
                  <option value="owner">Owner (Full project administration and invites)</option>
                </select>
              </div>

              {lastGeneratedInviteUrl && (
                <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Invitation Link Generated:</div>
                  <div style={{ wordBreak: 'break-all', color: 'var(--primary)' }}>{lastGeneratedInviteUrl}</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="secondary" onClick={() => setShowInviteModal(false)}>Close</button>
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
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px' }}>
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
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Task details and deliverables..."
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Priority</label>
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as any)}
                    style={{ width: '100%', fontSize: '13px' }}
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
                    style={{ width: '100%', fontSize: '13px' }}
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

      {/* Submit for Review Modal */}
      {showReviewModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Submit Manuscript for Review</h3>
            <form onSubmit={handleSubmitReviewRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Document *</label>
                <select
                  value={reviewDocId}
                  onChange={e => setReviewDocId(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  {documents.map(d => (
                    <option key={d._id} value={d._id}>{d.title} (v{d.version || 1})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Assign Reviewer (Optional)</label>
                <select
                  value={reviewReviewerId}
                  onChange={e => setReviewReviewerId(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="">Any available project reviewer</option>
                  {members.filter(m => m.role === 'reviewer' || m.role === 'owner').map(m => (
                    <option key={m._id} value={m.userId?._id || m._id}>
                      {m.userId?.displayName || m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Author Notes / Guidance</label>
                <textarea
                  rows={3}
                  placeholder="Highlight key hypotheses, methodology questions, or sections needing scrutiny..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                <button type="submit" className="primary">Submit Review Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Decision Modal */}
      {showDecisionModal && activeReviewForDecision && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Issue Review Decision</h3>
            <form onSubmit={handleSubmitReviewDecision} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Editorial Recommendation *</label>
                <select
                  value={decisionOutcome}
                  onChange={e => setDecisionOutcome(e.target.value as any)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="accept">Accept (Meets publication rigor)</option>
                  <option value="minor_revisions">Minor Revisions (Small clarifications required)</option>
                  <option value="major_revisions">Major Revisions (Substantial rework required)</option>
                  <option value="reject">Reject (Does not meet research standards)</option>
                </select>
              </div>

              <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Rubric Evaluation (1-10 Scale)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div>
                    <label>Methodology: <b>{rubricRigor}</b></label>
                    <input type="range" min="1" max="10" value={rubricRigor} onChange={e => setRubricRigor(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label>Clarity: <b>{rubricClarity}</b></label>
                    <input type="range" min="1" max="10" value={rubricClarity} onChange={e => setRubricClarity(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label>Citations: <b>{rubricCitations}</b></label>
                    <input type="range" min="1" max="10" value={rubricCitations} onChange={e => setRubricCitations(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label>Originality: <b>{rubricOriginality}</b></label>
                    <input type="range" min="1" max="10" value={rubricOriginality} onChange={e => setRubricOriginality(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Editorial Feedback & Decision Notes</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide structured comments for authors..."
                  value={decisionNotes}
                  onChange={e => setDecisionNotes(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="secondary" onClick={() => setShowDecisionModal(false)}>Cancel</button>
                <button type="submit" className="primary">Record Decision</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
