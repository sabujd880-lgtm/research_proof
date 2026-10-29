import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Send,
  Upload,
  Sparkles,
  BookOpen,
  AlertCircle,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  Trash2,
  RefreshCw,
  ExternalLink,
  Bookmark,
  Table,
  Plus,
  Layers,
  ArrowRight
} from 'lucide-react';

interface Citation {
  documentId?: string;
  documentTitle?: string;
  page: number;
  passage?: string;
  excerpt?: string;
  score: number;
  evidenceId?: string;
}

interface Message {
  _id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  retrievalStatus?: string;
  timestamp?: string;
}

interface ResearchChat {
  _id: string;
  id?: string;
  projectId: string;
  title: string;
  documentName?: string;
  selectedDocumentIds?: string[];
  mode?: string;
  messages: Message[];
  updatedAt?: string;
}

interface DocumentItem {
  id: string;
  _id?: string;
  filename: string;
  title: string;
  pageCount: number;
  chunkCount: number;
  status: string;
  fileSize?: number;
  metadata?: {
    authors?: Array<{ name?: string; family?: string; given?: string }>;
    year?: number;
    journal?: string;
    abstract?: string;
  };
  createdAt?: string;
}

interface DocumentChunkItem {
  chunkId: string;
  pageNumber: number;
  sectionTitle?: string;
  text: string;
}

interface PdfResearchChatProps {
  token: string;
  activeProject: any;
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

const RESEARCH_PRESETS = [
  { id: 'summary', label: 'Summary', icon: BookOpen, prompt: 'Provide an evidence-grounded executive summary of this research, including research questions and core conclusions.' },
  { id: 'methodology', label: 'Methodology', icon: Layers, prompt: 'What research methodology, empirical design, instruments, and statistical tests were used in this study?' },
  { id: 'sample', label: 'Sample', icon: Bookmark, prompt: 'What are the sample characteristics, population demographics, inclusion/exclusion criteria, and sample size?' },
  { id: 'findings', label: 'Findings', icon: Sparkles, prompt: 'What are the primary empirical findings, effect sizes, statistical significance, and hypotheses outcomes?' },
  { id: 'limitations', label: 'Limitations', icon: AlertCircle, prompt: 'What methodological, conceptual, or external validity limitations and risks did the authors identify?' },
  { id: 'gaps', label: 'Research Gaps', icon: Search, prompt: 'What future research directions and unaddressed empirical gaps are noted in the discussion?' },
  { id: 'table', label: 'Evidence Table', icon: Table, prompt: 'Summarize the core empirical claims into a structured evidence table with exact page references.' }
];

export default function PdfResearchChat({
  token,
  activeProject,
  setSection,
  setMessage,
  setError
}: PdfResearchChatProps) {
  // Navigation & document library state
  const [activeTab, setActiveTab] = useState<'documents' | 'viewer'>('documents');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeViewerDocId, setActiveViewerDocId] = useState<string>('');
  const [docChunks, setDocChunks] = useState<DocumentChunkItem[]>([]);
  const [viewerPage, setViewerPage] = useState<number>(1);
  const [viewerZoom, setViewerZoom] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState('');

  // Conversation state
  const [chats, setChats] = useState<ResearchChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [activeChat, setActiveChat] = useState<ResearchChat | null>(null);
  const [query, setQuery] = useState('');
  const [activeMode, setActiveMode] = useState<string>('default');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPassage, setSelectedPassage] = useState<Citation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = activeProject?._id || activeProject?.id;

  // Load project documents
  const fetchDocuments = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/pdf-chat/documents?projectId=${projectId}&search=${encodeURIComponent(searchTerm)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const docList = data.documents || [];
        setDocuments(docList);
        if (docList.length > 0 && selectedDocIds.length === 0) {
          const firstId = (docList[0].id || docList[0]._id || '') as string;
          if (firstId) {
            setSelectedDocIds([firstId]);
            setActiveViewerDocId(firstId);
          }
        }
      }
    } catch (err: any) {
      console.warn('Failed to load documents:', err.message);
    }
  };

  // Load project conversations
  const fetchChats = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/pdf-chat/conversations?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setChats(list || []);
        if (list?.length > 0 && !activeChatId) {
          loadChat(list[0]._id || list[0].id);
        }
      } else {
        // Fallback to legacy endpoint
        const legacyRes = await fetch(`/api/v1/projects/${projectId}/pdf-chat`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (legacyRes.ok) {
          const list = await legacyRes.json();
          setChats(list || []);
          if (list?.length > 0 && !activeChatId) {
            loadChat(list[0]._id || list[0].id);
          }
        }
      }
    } catch (err: any) {
      console.warn('Failed to load PDF chats:', err.message);
    }
  };

  const loadChat = async (id: string) => {
    setActiveChatId(id);
    try {
      let res = await fetch(`/api/v1/pdf-chat/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        res = await fetch(`/api/v1/projects/${projectId}/pdf-chat/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      if (res.ok) {
        const fullChat = await res.json();
        setActiveChat(fullChat);
        if (fullChat.selectedDocumentIds && fullChat.selectedDocumentIds.length > 0) {
          setSelectedDocIds(fullChat.selectedDocumentIds);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load chat details:', err.message);
    }
  };

  // Load document content / chunks for page viewer
  const loadDocumentContent = async (docId: string) => {
    setActiveViewerDocId(docId);
    try {
      const res = await fetch(`/api/v1/pdf-chat/documents/${docId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocChunks(data.chunks || []);
        setViewerPage(1);
      }
    } catch (err: any) {
      console.warn('Failed to load document content:', err.message);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchChats();
  }, [projectId, token]);

  useEffect(() => {
    if (activeViewerDocId) {
      loadDocumentContent(activeViewerDocId);
    }
  }, [activeViewerDocId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  // Handle PDF file upload
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !projectId) return;

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('projectId', projectId);

    try {
      const res = await fetch('/api/v1/pdf-chat/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload document');

      setMessage(`Uploaded and indexed ${data.count || 1} document(s) successfully.`);
      await fetchDocuments();

      // Automatically create or select conversation
      if (data.documents && data.documents.length > 0) {
        const firstDoc = data.documents[0];
        const firstDocId = (firstDoc.id || firstDoc._id || '') as string;
        if (firstDocId) {
          setSelectedDocIds(prev => Array.from(new Set([...prev, firstDocId])));
          setActiveViewerDocId(firstDocId);
          await createNewConversation(`Research: ${firstDoc.title || firstDoc.filename}`, [firstDocId]);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Create new conversation
  const createNewConversation = async (customTitle?: string, docIds?: string[]) => {
    if (!projectId) return;
    try {
      const idsToUse = docIds || selectedDocIds;
      const title = customTitle || `Chat ${new Date().toLocaleDateString()} (${idsToUse.length} docs)`;
      const res = await fetch('/api/v1/pdf-chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          title,
          documentIds: idsToUse,
          mode: activeMode
        })
      });
      if (res.ok) {
        const newChat = await res.json();
        await fetchChats();
        loadChat(newChat.id || newChat._id);
        setMessage('New research chat thread initialized.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Send query or preset
  const handleSendMessage = async (customQuery?: string, presetMode?: string) => {
    const questionText = (customQuery || query).trim();
    if (!questionText || sending) return;

    if (!activeChatId) {
      // Create chat first then send
      await createNewConversation();
      return;
    }

    const effectiveMode = presetMode || activeMode;
    if (!customQuery) setQuery('');
    setSending(true);

    const optimisticMsg: Message = {
      role: 'user',
      content: questionText,
      timestamp: new Date().toISOString()
    };

    if (activeChat) {
      setActiveChat({
        ...activeChat,
        messages: [...activeChat.messages, optimisticMsg]
      });
    }

    try {
      const res = await fetch(`/api/v1/pdf-chat/conversations/${activeChatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          query: questionText,
          mode: effectiveMode,
          selectedDocumentIds: selectedDocIds
        })
      });

      if (!res.ok) {
        // Fallback to legacy endpoint if needed
        const legRes = await fetch(`/api/v1/projects/${projectId}/pdf-chat/${activeChatId}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ query: questionText, mode: effectiveMode })
        });
        const legData = await legRes.json();
        if (!legRes.ok) throw new Error(legData.error || 'Question synthesis failed.');

        if (activeChat) {
          setActiveChat({
            ...activeChat,
            messages: [...activeChat.messages, legData.message]
          });
        }
        return;
      }

      const data = await res.json();
      if (activeChat) {
        setActiveChat({
          ...activeChat,
          messages: [...activeChat.messages, data.message]
        });
      }
      if (data.citations && data.citations.length > 0) {
        setSelectedPassage(data.citations[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Toggle document selection for multi-doc synthesis
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds(prev => {
      const exists = prev.includes(docId);
      const next = exists ? prev.filter(id => id !== docId) : [...prev, docId];
      return next;
    });
  };

  // Send document to Literature Matrix
  const handleSendToLiterature = async (docId: string) => {
    try {
      const res = await fetch(`/api/v1/pdf-chat/documents/${docId}/send-to-literature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send to Literature Matrix');
      setMessage('Paper successfully extracted and added to Literature Review Matrix!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Link document to Reference Manager
  const handleLinkReference = async (docId: string) => {
    try {
      const res = await fetch(`/api/v1/pdf-chat/documents/${docId}/link-reference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link Reference');
      setMessage('Document reference created and added to Reference Manager!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Jump from citation click to exact document page
  const handleCitationClick = (c: Citation) => {
    setSelectedPassage(c);
    if (c.documentId && c.documentId !== activeViewerDocId) {
      setActiveViewerDocId(c.documentId);
    }
    setViewerPage(c.page || 1);
    setActiveTab('viewer');
  };

  // Copy citation passage to clipboard
  const handleCopyPassage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter chunks for current page in viewer
  const currentPageChunks = docChunks.filter(c => c.pageNumber === viewerPage);
  const activeViewerDoc = documents.find(d => (d.id || d._id) === activeViewerDocId);
  const totalViewerPages = activeViewerDoc?.pageCount || Math.max(1, ...docChunks.map(c => c.pageNumber || 1));

  return (
    <div className="module-container" style={{ padding: '20px 24px', maxWidth: '1600px', margin: '0 auto', color: 'var(--rp-text, #0f172a)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary, #2563eb)', marginBottom: '4px' }}>
            <FileText size={18} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Module 4 · Document Intelligence & RAG
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.4px' }}>
            PDF Research Chat & Evidence Synthesis
          </h1>
          <p style={{ color: 'var(--muted, #64748b)', fontSize: '13px', margin: '3px 0 0' }}>
            Multi-document retrieval with verifiable [Title, p. X] citations, zero hallucinations, and live page preview.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => createNewConversation()}
            className="secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={15} />
            New Thread
          </button>

          <label
            className="primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'var(--primary, #2563eb)',
              color: '#ffffff'
            }}
          >
            <Upload size={15} />
            {uploading ? 'Indexing PDF...' : 'Upload PDF'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.docx"
              style={{ display: 'none' }}
              onChange={handleUploadPdf}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Main 3-Column Studio Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr 340px',
        gap: '16px',
        height: 'calc(100vh - 200px)',
        minHeight: '620px'
      }}>

        {/* LEFT COLUMN: Documents Library & Interactive Page Viewer */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Subtab Switcher */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--surface2, #f8fafc)'
          }}>
            <button
              onClick={() => setActiveTab('documents')}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '12px',
                fontWeight: activeTab === 'documents' ? 700 : 500,
                border: 'none',
                borderBottom: activeTab === 'documents' ? '2px solid var(--primary, #2563eb)' : 'none',
                background: 'transparent',
                color: activeTab === 'documents' ? 'var(--primary, #2563eb)' : 'var(--muted, #64748b)',
                cursor: 'pointer'
              }}
            >
              Documents ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('viewer')}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '12px',
                fontWeight: activeTab === 'viewer' ? 700 : 500,
                border: 'none',
                borderBottom: activeTab === 'viewer' ? '2px solid var(--primary, #2563eb)' : 'none',
                background: 'transparent',
                color: activeTab === 'viewer' ? 'var(--primary, #2563eb)' : 'var(--muted, #64748b)',
                cursor: 'pointer'
              }}
            >
              Page Viewer
            </button>
          </div>

          {activeTab === 'documents' ? (
            <>
              {/* Document search & multi-select banner */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface2, #f8fafc)', borderRadius: '6px', padding: '6px 10px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <Search size={14} style={{ color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="Filter papers..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '12px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                  <span>{selectedDocIds.length} of {documents.length} selected for query</span>
                  <button
                    onClick={() => setSelectedDocIds(documents.map(d => (d.id || d._id || '')).filter(Boolean) as string[])}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                  >
                    Select All
                  </button>
                </div>
              </div>

              {/* Document List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {documents.length === 0 ? (
                  <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                    <FileText size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>No documents indexed</p>
                    <p style={{ margin: 0, fontSize: '11px' }}>Upload research PDFs to start indexing pages and extracting evidence.</p>
                  </div>
                ) : (
                  documents.map(doc => {
                    const docId: string = (doc.id || doc._id || '') as string;
                    const isSelected = selectedDocIds.includes(docId);
                    const isViewing = activeViewerDocId === docId;

                    return (
                      <div
                        key={docId}
                        style={{
                          borderRadius: '8px',
                          border: isViewing ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-color, #e2e8f0)',
                          background: isViewing ? 'var(--primary-subtle, #eff6ff)' : 'var(--card-bg, #ffffff)',
                          padding: '10px',
                          marginBottom: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDocumentSelection(docId)}
                            style={{ marginTop: '3px', cursor: 'pointer' }}
                            title="Include in multi-document search"
                          />
                          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => { setActiveViewerDocId(docId); setActiveTab('viewer'); }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rp-text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.title || doc.filename}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--muted, #64748b)', marginTop: '3px' }}>
                              <span>{doc.pageCount} page(s)</span>
                              <span>•</span>
                              <span>{doc.chunkCount} chunks</span>
                              <span>•</span>
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Indexed</span>
                            </div>
                          </div>
                        </div>

                        {/* Document action pills */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                          <button
                            onClick={() => handleSendToLiterature(docId)}
                            style={{
                              flex: 1,
                              fontSize: '10px',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color, #cbd5e1)',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                            title="Add to Literature Review Matrix"
                          >
                            <Table size={11} />
                            + Literature
                          </button>
                          <button
                            onClick={() => handleLinkReference(docId)}
                            style={{
                              flex: 1,
                              fontSize: '10px',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color, #cbd5e1)',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                            title="Link to Reference Manager"
                          >
                            <Bookmark size={11} />
                            + Reference
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Integrated PDF Page Viewer */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Viewer Control Bar */}
              <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface2, #f8fafc)',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => setViewerPage(p => Math.max(1, p - 1))}
                    disabled={viewerPage <= 1}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', opacity: viewerPage <= 1 ? 0.4 : 1 }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontWeight: 700 }}>
                    p. {viewerPage} / {totalViewerPages}
                  </span>
                  <button
                    onClick={() => setViewerPage(p => Math.min(totalViewerPages, p + 1))}
                    disabled={viewerPage >= totalViewerPages}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', opacity: viewerPage >= totalViewerPages ? 0.4 : 1 }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => setViewerZoom(z => Math.max(80, z - 10))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px' }}
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{viewerZoom}%</span>
                  <button
                    onClick={() => setViewerZoom(z => Math.min(150, z + 10))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px' }}
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>

              {/* Document Header in Viewer */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-bg)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeViewerDoc?.title || activeViewerDoc?.filename || 'Select Document'}
                </div>
              </div>

              {/* Page Content Render with Highlight */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px', background: '#f1f5f9' }}>
                <div style={{
                  background: '#ffffff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  borderRadius: '6px',
                  padding: `${Math.round(14 * (viewerZoom / 100))}px`,
                  fontSize: `${Math.round(12 * (viewerZoom / 100))}px`,
                  lineHeight: '1.6',
                  minHeight: '100%',
                  color: '#1e293b'
                }}>
                  {currentPageChunks.length > 0 ? (
                    currentPageChunks.map(chunk => {
                      const isHighlighted = selectedPassage && selectedPassage.page === viewerPage &&
                        (selectedPassage.excerpt && chunk.text.includes(selectedPassage.excerpt.slice(0, 40)));

                      return (
                        <div
                          key={chunk.chunkId}
                          style={{
                            marginBottom: '12px',
                            background: isHighlighted ? '#fef08a' : 'transparent',
                            borderRadius: '4px',
                            padding: isHighlighted ? '6px 8px' : '0',
                            transition: 'background 0.2s'
                          }}
                        >
                          {chunk.sectionTitle && (
                            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
                              {chunk.sectionTitle}
                            </div>
                          )}
                          <div>{chunk.text}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: '12px' }}>
                      No extracted text on page {viewerPage}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Grounded Chat Conversation Stream */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Active Chat Header */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface2, #f8fafc)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Sparkles size={16} style={{ color: 'var(--primary, #2563eb)' }} />
              <div>
                <strong style={{ fontSize: '13px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeChat?.title || 'PDF Evidence Chat'}
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Searching {selectedDocIds.length} document(s) · Hybrid Retrieval (Semantic 60% + BM25 40%)
                </span>
              </div>
            </div>

            {/* Conversation Switcher Dropdown */}
            {chats.length > 1 && (
              <select
                value={activeChatId}
                onChange={e => loadChat(e.target.value)}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: '#ffffff'
                }}
              >
                {chats.map(c => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.title || c.documentName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Research Presets Bar */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            background: '#ffffff',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', alignSelf: 'center', marginRight: '4px' }}>
              Presets:
            </span>
            {RESEARCH_PRESETS.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSendMessage(p.prompt, p.id)}
                  disabled={sending}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    background: 'var(--surface2, #f8fafc)',
                    color: 'var(--rp-text, #334155)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary, #2563eb)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)')}
                >
                  <Icon size={12} />
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activeChat?.messages && activeChat.messages.length > 0 ? (
              activeChat.messages.map((m, idx) => (
                <div
                  key={m._id || idx}
                  style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: m.role === 'user' ? 'var(--primary, #2563eb)' : m.role === 'system' ? 'var(--surface2, #f8fafc)' : '#ffffff',
                    color: m.role === 'user' ? '#ffffff' : 'var(--rp-text, #0f172a)',
                    borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-color, #e2e8f0)',
                    boxShadow: m.role === 'user' ? '0 1px 3px rgba(37, 99, 235, 0.2)' : '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  {m.role === 'system' && (
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, marginBottom: '4px' }}>
                      System · Document Context
                    </div>
                  )}
                  {m.role === 'assistant' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.5px' }}>
                        Grounded Synthesis
                      </span>
                      {m.retrievalStatus === 'grounded' && (
                        <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
                          ✓ Evidence Grounded
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>

                  {/* Verifiable Citation Chips */}
                  {m.citations && m.citations.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>Source Citations:</span>
                      {m.citations.map((c, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => handleCitationClick(c)}
                          style={{
                            fontSize: '10px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: '#dbeafe',
                            color: '#1e40af',
                            border: '1px solid #bfdbfe',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Click to view Page ${c.page} excerpt`}
                        >
                          <span>{c.documentTitle ? `${c.documentTitle.slice(0, 16)}...` : 'Page'}</span>
                          <span>p. {c.page} ↗</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', padding: '24px', textAlign: 'center' }}>
                <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <h3 style={{ margin: '0 0 6px', color: 'var(--rp-text, #0f172a)' }}>Ready for Research Inquiry</h3>
                <p style={{ margin: 0, fontSize: '13px', maxWidth: '380px' }}>
                  Select documents from the left panel and type a question or choose an empirical preset above.
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Question Input Box */}
          <form
            onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
            style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '10px', background: '#ffffff' }}
          >
            <input
              type="text"
              placeholder={selectedDocIds.length > 0 ? "Ask any grounded question regarding findings, sample size, or methodology..." : "Please select at least one document from the left..."}
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={selectedDocIds.length === 0}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              className="primary"
              disabled={sending || !query.trim() || selectedDocIds.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <Send size={15} />
              {sending ? 'Synthesizing...' : 'Inquire'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Evidence Passage Inspector */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--surface2, #f8fafc)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <strong style={{ fontSize: '13px' }}>Evidence Provenance Inspector</strong>
            <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>Zero Hallucination</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {selectedPassage ? (
              <div>
                {/* Passage Metadata Card */}
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--surface2, #f8fafc)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  marginBottom: '14px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary, #2563eb)', marginBottom: '4px' }}>
                    {selectedPassage.documentTitle || 'Primary Source Document'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-text, #334155)' }}>
                      Page {selectedPassage.page}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}>
                      Relevance: {Math.round(selectedPassage.score * 100)}%
                    </span>
                  </div>
                </div>

                {/* Verbatim Excerpt */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' }}>
                    Verbatim Source Passage
                  </div>
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: '#1e293b',
                    fontStyle: 'italic',
                    position: 'relative'
                  }}>
                    "{selectedPassage.passage || selectedPassage.excerpt}"
                  </div>
                </div>

                {/* Provenance Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => {
                      if (selectedPassage.documentId) setActiveViewerDocId(selectedPassage.documentId);
                      setViewerPage(selectedPassage.page || 1);
                      setActiveTab('viewer');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--primary, #2563eb)',
                      background: 'var(--primary-subtle, #eff6ff)',
                      color: 'var(--primary, #2563eb)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <BookOpen size={14} />
                    Open Page {selectedPassage.page} in Viewer
                  </button>

                  <button
                    onClick={() => handleCopyPassage(selectedPassage.passage || selectedPassage.excerpt || '', 'inspector')}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      background: '#ffffff',
                      color: 'var(--rp-text, #334155)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {copiedId === 'inspector' ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                    {copiedId === 'inspector' ? 'Copied to Clipboard' : 'Copy Verbatim Quote'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px', padding: '40px 12px' }}>
                <BookOpen size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--rp-text)' }}>No Evidence Selected</p>
                <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.5' }}>
                  Click on any <span style={{ color: 'var(--primary)', fontWeight: 700 }}>[Title, p. X]</span> citation chip in the conversation to inspect its verbatim passage and relevance telemetry.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
