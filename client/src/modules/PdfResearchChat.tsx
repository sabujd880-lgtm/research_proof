import { useState, useEffect, useRef } from 'react';
import { FileText, Send, Upload, Sparkles, BookOpen, AlertCircle, Check, Copy } from 'lucide-react';

interface Citation {
  page: number;
  passage: string;
  score: number;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp?: string;
}

interface ResearchChat {
  _id: string;
  projectId: string;
  title: string;
  documentName: string;
  messages: Message[];
}

interface PdfResearchChatProps {
  token: string;
  activeProject: any;
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

export default function PdfResearchChat({
  token,
  activeProject,
  setSection,
  setMessage,
  setError
}: PdfResearchChatProps) {
  const [chats, setChats] = useState<ResearchChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [activeChat, setActiveChat] = useState<ResearchChat | null>(null);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPassage, setSelectedPassage] = useState<Citation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const projectId = activeProject?._id;

  const fetchChats = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/pdf-chat`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setChats(list || []);
        if (list?.length > 0 && !activeChatId) {
          loadChat(list[0]._id);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load PDF chats:', err.message);
    }
  };

  const loadChat = async (id: string) => {
    setActiveChatId(id);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/pdf-chat/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const fullChat = await res.json();
        setActiveChat(fullChat);
      }
    } catch (err: any) {
      console.warn('Failed to load chat details:', err.message);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [projectId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/pdf-chat/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse document');

      setMessage(`Document "${file.name}" processed into ${data.chunkCount} page chunks.`);
      await fetchChats();
      loadChat(data.chatId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !activeChatId || sending) return;

    const userQuestion = query.trim();
    setQuery('');
    setSending(true);

    // Optimistically update UI
    if (activeChat) {
      setActiveChat({
        ...activeChat,
        messages: [
          ...activeChat.messages,
          { role: 'user', content: userQuestion, timestamp: new Date().toISOString() }
        ]
      });
    }

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/pdf-chat/${activeChatId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query: userQuestion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Question answering failed');

      if (activeChat) {
        setActiveChat({
          ...activeChat,
          messages: [...activeChat.messages, data.message]
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <FileText size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Module 4 · PDF Research Chat
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
            Grounded Research Paper Chat & Citation Explorer
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Answers are strictly cited to specific pages and excerpts. No ungrounded LLM hallucinations.
          </p>
        </div>

        <label className="button primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
          <Upload size={16} />
          {uploading ? 'Processing PDF...' : 'Upload Research PDF'}
          <input
            type="file"
            accept=".pdf,.txt,.docx"
            style={{ display: 'none' }}
            onChange={handleUploadPdf}
            disabled={uploading}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 340px', gap: '20px', height: 'calc(100vh - 220px)', minHeight: '560px' }}>
        {/* Left Column: Chat & Document Sessions */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface2)' }}>
            <strong style={{ fontSize: '13px' }}>Uploaded Papers ({chats.length})</strong>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {chats.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No documents uploaded yet. Upload a PDF or paper to chat.
              </div>
            ) : (
              chats.map(c => (
                <button
                  key={c._id}
                  onClick={() => loadChat(c._id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeChatId === c._id ? 'var(--primary-subtle, #eff6ff)' : 'transparent',
                    color: activeChatId === c._id ? 'var(--primary, #2563eb)' : 'inherit',
                    fontWeight: activeChatId === c._id ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                    fontSize: '12px'
                  }}
                >
                  <FileText size={16} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.documentName || c.title}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center Column: Grounded Chat Conversation */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} style={{ color: 'var(--primary)' }} />
                  <strong style={{ fontSize: '13px' }}>{activeChat.documentName || activeChat.title}</strong>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Grounded Evidence Engine
                </span>
              </div>

              {/* Messages Area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activeChat.messages.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: m.role === 'user' ? 'var(--primary, #2563eb)' : m.role === 'system' ? 'var(--surface2)' : 'var(--surface2, #f8fafc)',
                      color: m.role === 'user' ? '#ffffff' : 'var(--text-main, #0f172a)',
                      borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '12px 16px',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      border: m.role === 'user' ? 'none' : '1px solid var(--border-color, #e2e8f0)'
                    }}
                  >
                    {m.role === 'system' && (
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, marginBottom: '4px' }}>
                        Document Ingested
                      </div>
                    )}
                    <div>{m.content}</div>

                    {/* Citation Badges */}
                    {m.citations && m.citations.length > 0 && (
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>Citations:</span>
                        {m.citations.map((c, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => setSelectedPassage(c)}
                            style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: '#dbeafe',
                              color: '#1e40af',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                          >
                            Page {c.page} ↗
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Ask any grounded question regarding this paper's findings, sample, or stats..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}
                />
                <button type="submit" className="primary" disabled={sending || !query.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={15} />
                  {sending ? 'Searching...' : 'Ask'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', padding: '24px', textAlign: 'center' }}>
              <FileText size={42} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-main)' }}>No Document Selected</h3>
              <p style={{ margin: 0, fontSize: '13px' }}>Upload a research manuscript or select one from the left to start grounded research chat.</p>
            </div>
          )}
        </div>

        {/* Right Column: Citation Passage Inspector */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface2)' }}>
            <strong style={{ fontSize: '13px' }}>Evidence Passage Inspector</strong>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {selectedPassage ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>
                    Manuscript Page {selectedPassage.page}
                  </span>
                  <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                    Relevance Score: {selectedPassage.score}
                  </span>
                </div>
                <div style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  fontStyle: 'italic',
                  color: 'var(--text-main)'
                }}>
                  "{selectedPassage.passage}"
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px', padding: '32px 8px' }}>
                <BookOpen size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <p style={{ margin: 0 }}>Click on any "Page X" citation in the chat to inspect the verbatim manuscript passage.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

