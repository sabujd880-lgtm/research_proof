import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Search, Plus, Trash2, Edit3, Copy, Check, Download, Upload,
  Folder, FolderPlus, Star, Tag, AlertTriangle, CheckCircle2, Globe,
  ExternalLink, GitMerge, RefreshCw, X, ChevronRight, SlidersHorizontal,
  Sparkles, FileText, Bookmark, Layers, Filter, CheckSquare, Square
} from 'lucide-react';

export interface Author {
  given?: string;
  family?: string;
  name?: string;
  orcid?: string;
}

export interface ReferenceItem {
  _id: string;
  id?: string;
  title: string;
  subtitle?: string;
  authors: Author[];
  editors?: Author[];
  publicationYear?: string;
  publicationDate?: string;
  year?: string;
  publicationType?: string;
  type?: string;
  journalTitle?: string;
  journal?: string;
  bookTitle?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  articleNumber?: string;
  doi?: string;
  normalizedDoi?: string;
  isbn?: string;
  issn?: string;
  url?: string;
  abstract?: string;
  keywords?: string[];
  language?: string;
  citationKey?: string;
  sourceProvider?: string;
  metadataStatus?: string;
  retractionStatus?: string;
  tags?: string[];
  collectionIds?: string[];
  isFavorite?: boolean;
  notes?: string;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReferenceCollectionItem {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ReferenceManagerProps {
  token: string;
  activeProject?: any;
  setSection?: (section: string) => void;
  setMessage?: (msg: string) => void;
  setError?: (err: string) => void;
  onRefreshCitations?: () => void;
}

export default function ReferenceManager({
  token,
  activeProject,
  setSection,
  setMessage,
  setError,
  onRefreshCitations
}: ReferenceManagerProps) {
  // Data state
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [collections, setCollections] = useState<ReferenceCollectionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);

  // Selection & Navigation
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [selectedNav, setSelectedNav] = useState<string>('all'); // 'all' | 'favorites' | 'unverified' | collectionId
  const [projectFilter, setProjectFilter] = useState<'all' | 'active'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'title' | 'year' | 'author'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // CSL Citation preview state
  const [cslStyle, setCslStyle] = useState<'apa7' | 'mla9' | 'chicago' | 'harvard' | 'ieee' | 'vancouver'>('apa7');
  const [cslType, setCslType] = useState<'parenthetical' | 'narrative' | 'bibliography'>('bibliography');
  const [cslFormatted, setCslFormatted] = useState<string>('');
  const [cslLoading, setCslLoading] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDoiModalOpen, setIsDoiModalOpen] = useState<boolean>(false);
  const [isScholarlyModalOpen, setIsScholarlyModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState<boolean>(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState<boolean>(false);

  // Modal form states
  const [doiInput, setDoiInput] = useState<string>('');
  const [doiMetadata, setDoiMetadata] = useState<any>(null);
  const [doiSearching, setDoiSearching] = useState<boolean>(false);

  const [scholarlyQuery, setScholarlyQuery] = useState<string>('');
  const [scholarlyProvider, setScholarlyProvider] = useState<'crossref' | 'openalex'>('crossref');
  const [scholarlyResults, setScholarlyResults] = useState<any[]>([]);
  const [scholarlySearching, setScholarlySearching] = useState<boolean>(false);

  const [importText, setImportText] = useState<string>('');
  const [importFormat, setImportFormat] = useState<'bibtex' | 'ris'>('bibtex');
  const [importing, setImporting] = useState<boolean>(false);

  const [exportStyle, setExportStyle] = useState<string>('apa7');
  const [exportFormat, setExportFormat] = useState<'bibtex' | 'ris' | 'plaintext' | 'html'>('plaintext');
  const [exportOutput, setExportOutput] = useState<string>('');
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  const [duplicatePairs, setDuplicatePairs] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState<boolean>(false);

  const [collectionName, setCollectionName] = useState<string>('');
  const [collectionDesc, setCollectionDesc] = useState<string>('');
  const [collectionColor, setCollectionColor] = useState<string>('#5e6ad2');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);

  // Manual reference form
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formAuthors, setFormAuthors] = useState<string>('');
  const [formYear, setFormYear] = useState<string>('');
  const [formType, setFormType] = useState<string>('journal-article');
  const [formJournal, setFormJournal] = useState<string>('');
  const [formPublisher, setFormPublisher] = useState<string>('');
  const [formVolume, setFormVolume] = useState<string>('');
  const [formIssue, setFormIssue] = useState<string>('');
  const [formPages, setFormPages] = useState<string>('');
  const [formDoi, setFormDoi] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [formAbstract, setFormAbstract] = useState<string>('');
  const [formTags, setFormTags] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formCollections, setFormCollections] = useState<string[]>([]);

  // Notes inline state
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchReferences = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/references?limit=200', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.references || []);
        setReferences(list);
        if (list.length > 0 && !selectedRefId) {
          setSelectedRefId(list[0]._id || list[0].id);
        }
      }
    } catch (err: any) {
      if (setError) setError(err.message || 'Failed to load references.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/v1/reference-collections', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.collections || []);
        setCollections(list);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (token) {
      fetchReferences();
      fetchCollections();
    }
  }, [token]);

  // Selected Reference object
  const selectedRef = useMemo(() => {
    return references.find(r => (r._id || r.id) === selectedRefId) || null;
  }, [references, selectedRefId]);

  useEffect(() => {
    if (selectedRef) {
      setEditingNotes(selectedRef.notes || '');
    }
  }, [selectedRef]);

  // --------------------------------------------------------------------------
  // CSL Citation Generator
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedRef) {
      setCslFormatted('');
      return;
    }
    let isCancelled = false;
    const formatCitation = async () => {
      setCslLoading(true);
      try {
        const res = await fetch('/api/v1/references/format', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            reference: selectedRef,
            style: cslStyle,
            type: cslType
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setCslFormatted(data.formatted || data.citation || '');
          }
        }
      } catch (_) {
      } finally {
        if (!isCancelled) setCslLoading(false);
      }
    };
    formatCitation();
    return () => { isCancelled = true; };
  }, [selectedRef, cslStyle, cslType, token]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
      if (setMessage) setMessage('Citation copied to clipboard!');
    } catch (_) {}
  };

  // --------------------------------------------------------------------------
  // Filtered & Sorted References
  // --------------------------------------------------------------------------
  const filteredReferences = useMemo(() => {
    return references.filter(r => {
      // 1. Navigation filter
      if (selectedNav === 'favorites' && !r.isFavorite) return false;
      if (selectedNav === 'unverified' && r.metadataStatus === 'verified') return false;
      if (selectedNav !== 'all' && selectedNav !== 'favorites' && selectedNav !== 'unverified') {
        if (!r.collectionIds || !r.collectionIds.includes(selectedNav)) return false;
      }

      // 2. Project filter
      if (projectFilter === 'active' && activeProject?._id) {
        if (r.projectId !== activeProject._id) return false;
      }

      // 3. Type filter
      if (selectedType !== 'all') {
        const t = r.publicationType || r.type || 'journal-article';
        if (t !== selectedType) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (r.title || '').toLowerCase().includes(q);
        const authorMatch = (r.authors || []).some(a => (a.family || a.name || '').toLowerCase().includes(q));
        const doiMatch = (r.doi || '').toLowerCase().includes(q);
        const journalMatch = (r.journalTitle || r.journal || '').toLowerCase().includes(q);
        if (!titleMatch && !authorMatch && !doiMatch && !journalMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'year') {
        cmp = (a.publicationYear || a.year || '').localeCompare(b.publicationYear || b.year || '');
      } else if (sortBy === 'author') {
        const famA = a.authors?.[0]?.family || a.authors?.[0]?.name || '';
        const famB = b.authors?.[0]?.family || b.authors?.[0]?.name || '';
        cmp = famA.localeCompare(famB);
      } else {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        cmp = dateA - dateB;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [references, selectedNav, projectFilter, activeProject, selectedType, searchQuery, sortBy, sortOrder]);

  // Counts for Navigator
  const counts = useMemo(() => {
    const total = references.length;
    const favorites = references.filter(r => r.isFavorite).length;
    const unverified = references.filter(r => r.metadataStatus !== 'verified').length;
    return { total, favorites, unverified };
  }, [references]);

  // --------------------------------------------------------------------------
  // Favorite Toggle
  // --------------------------------------------------------------------------
  const toggleFavorite = async (refItem: ReferenceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = refItem._id || refItem.id;
    const newStatus = !refItem.isFavorite;

    // Optimistic update
    setReferences(prev => prev.map(r => ((r._id || r.id) === id ? { ...r, isFavorite: newStatus } : r)));

    try {
      await fetch(`/api/v1/references/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isFavorite: newStatus })
      });
    } catch (_) {
      // Revert on failure
      setReferences(prev => prev.map(r => ((r._id || r.id) === id ? { ...r, isFavorite: !newStatus } : r)));
    }
  };

  // --------------------------------------------------------------------------
  // Save Research Notes
  // --------------------------------------------------------------------------
  const handleSaveNotes = async () => {
    if (!selectedRef) return;
    const id = selectedRef._id || selectedRef.id;
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/v1/references/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes: editingNotes })
      });
      if (res.ok) {
        setReferences(prev => prev.map(r => ((r._id || r.id) === id ? { ...r, notes: editingNotes } : r)));
        if (setMessage) setMessage('Research notes saved.');
      }
    } catch (_) {
      if (setError) setError('Failed to save notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // --------------------------------------------------------------------------
  // Delete Reference
  // --------------------------------------------------------------------------
  const handleDeleteReference = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this reference from your library?')) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/v1/references/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setReferences(prev => prev.filter(r => (r._id || r.id) !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (selectedRefId === id) {
          const remaining = references.filter(r => (r._id || r.id) !== id);
          setSelectedRefId(remaining.length > 0 ? (remaining[0]._id || remaining[0].id || null) : null);
        }
        if (setMessage) setMessage('Reference removed.');
        if (onRefreshCitations) onRefreshCitations();
      }
    } catch (_) {
      if (setError) setError('Failed to delete reference.');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // Bulk Selection & Delete
  // --------------------------------------------------------------------------
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReferences.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReferences.map(r => r._id || r.id || '')));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected references?`)) return;

    setBusy(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/v1/references/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setReferences(prev => prev.filter(r => !selectedIds.has(r._id || r.id || '')));
      setSelectedIds(new Set());
      if (setMessage) setMessage(`Deleted ${selectedIds.size} references.`);
      if (onRefreshCitations) onRefreshCitations();
    } catch (_) {
      if (setError) setError('Error deleting references.');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // DOI Lookup & Import
  // --------------------------------------------------------------------------
  const handleLookupDoi = async () => {
    if (!doiInput.trim()) return;
    setDoiSearching(true);
    setDoiMetadata(null);
    try {
      const res = await fetch(`/api/v1/references/lookup/doi?doi=${encodeURIComponent(doiInput.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDoiMetadata(data.reference || data.metadata);
      } else {
        if (setError) setError(data.error || 'DOI not found.');
      }
    } catch (_) {
      if (setError) setError('Failed to lookup DOI.');
    } finally {
      setDoiSearching(false);
    }
  };

  const handleImportDoiResult = async () => {
    if (!doiMetadata) return;
    setBusy(true);
    try {
      const res = await fetch('/api/v1/references', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...doiMetadata,
          projectId: activeProject?._id || null,
          sourceProvider: 'crossref'
        })
      });
      if (res.ok) {
        const created = await res.json();
        const refItem = created.reference || created;
        setReferences(prev => [refItem, ...prev]);
        setSelectedRefId(refItem._id || refItem.id);
        setIsDoiModalOpen(false);
        setDoiInput('');
        setDoiMetadata(null);
        if (setMessage) setMessage('DOI reference imported to your library!');
        if (onRefreshCitations) onRefreshCitations();
      }
    } catch (_) {
      if (setError) setError('Failed to import DOI reference.');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // Scholarly Search (Crossref & OpenAlex)
  // --------------------------------------------------------------------------
  const handleScholarlySearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scholarlyQuery.trim()) return;
    setScholarlySearching(true);
    try {
      const res = await fetch(`/api/v1/references/search/scholarly?q=${encodeURIComponent(scholarlyQuery.trim())}&provider=${scholarlyProvider}&limit=12`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setScholarlyResults(data.results || []);
      }
    } catch (_) {
      if (setError) setError('Failed to perform scholarly search.');
    } finally {
      setScholarlySearching(false);
    }
  };

  const handleImportScholarlyItem = async (item: any) => {
    setBusy(true);
    try {
      const res = await fetch('/api/v1/references', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...item,
          projectId: activeProject?._id || null
        })
      });
      if (res.ok) {
        const created = await res.json();
        const refItem = created.reference || created;
        setReferences(prev => [refItem, ...prev]);
        setSelectedRefId(refItem._id || refItem.id);
        if (setMessage) setMessage(`Imported: "${item.title.slice(0, 40)}..."`);
        if (onRefreshCitations) onRefreshCitations();
      }
    } catch (_) {
      if (setError) setError('Failed to import scholarly reference.');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // BibTeX / RIS Import
  // --------------------------------------------------------------------------
  const handleImportBibtexRis = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const endpoint = importFormat === 'bibtex' ? '/api/v1/references/import/bibtex' : '/api/v1/references/import/ris';
      const payloadKey = importFormat === 'bibtex' ? 'bibtex' : 'ris';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          [payloadKey]: importText,
          projectId: activeProject?._id || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        const imported = data.references || data.imported || [];
        setReferences(prev => [...imported, ...prev]);
        if (imported.length > 0) {
          setSelectedRefId(imported[0]._id || imported[0].id);
        }
        setIsImportModalOpen(false);
        setImportText('');
        if (setMessage) {
          setMessage(`Successfully imported ${data.importedCount} references (${data.duplicateCount} duplicates skipped).`);
        }
        if (onRefreshCitations) onRefreshCitations();
      } else {
        if (setError) setError(data.error || 'Failed to import references.');
      }
    } catch (_) {
      if (setError) setError('Import failed due to an error.');
    } finally {
      setImporting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Duplicate Detection & Merge
  // --------------------------------------------------------------------------
  const handleCheckDuplicates = async () => {
    setCheckingDuplicates(true);
    try {
      const res = await fetch('/api/v1/references/duplicates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const pairs = data.duplicatePairs || data.duplicateGroups || [];
        setDuplicatePairs(pairs);
        setIsDuplicatesModalOpen(true);
        if (pairs.length === 0 && setMessage) {
          setMessage('Library verified: No duplicate references found.');
        }
      }
    } catch (_) {
      if (setError) setError('Failed to check for duplicates.');
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleMergePair = async (primaryId: string, secondaryId: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/v1/references/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ primaryId, secondaryId })
      });
      if (res.ok) {
        const data = await res.json();
        const mergedRef = data.mergedReference || data.merged;
        setReferences(prev => prev.map(r => ((r._id || r.id) === primaryId ? mergedRef : r)).filter(r => (r._id || r.id) !== secondaryId));
        setDuplicatePairs(prev => prev.filter(p => p.primary._id !== primaryId && p.secondary._id !== secondaryId));
        if (setMessage) setMessage('Duplicates merged successfully.');
        if (onRefreshCitations) onRefreshCitations();
      }
    } catch (_) {
      if (setError) setError('Failed to merge references.');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // Export Modal Generation
  // --------------------------------------------------------------------------
  const handleGenerateExport = async () => {
    setExportLoading(true);
    setExportOutput('');
    try {
      const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : references.map(r => r._id || r.id);
      if (exportFormat === 'bibtex' || exportFormat === 'ris') {
        const res = await fetch(`/api/v1/references/export?format=${exportFormat}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const text = await res.text();
          setExportOutput(text);
        }
      } else {
        const res = await fetch('/api/v1/references/bibliography', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            referenceIds: targetIds,
            style: exportStyle,
            format: exportFormat
          })
        });
        if (res.ok) {
          const data = await res.json();
          setExportOutput(data.bibliography || '');
        }
      }
    } catch (_) {
      if (setError) setError('Export failed.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadExportFile = () => {
    if (!exportOutput) return;
    const ext = exportFormat === 'bibtex' ? 'bib' : (exportFormat === 'ris' ? 'ris' : (exportFormat === 'html' ? 'html' : 'txt'));
    const blob = new Blob([exportOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `references_${exportStyle}_${Date.now()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------------------------------
  // Collection Management
  // --------------------------------------------------------------------------
  const handleSaveCollection = async () => {
    if (!collectionName.trim()) return;
    setBusy(true);
    try {
      if (editingCollectionId) {
        const res = await fetch(`/api/v1/reference-collections/${editingCollectionId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: collectionName.trim(),
            description: collectionDesc.trim(),
            color: collectionColor
          })
        });
        if (res.ok) {
          const data = await res.json();
          const col = data.collection || data;
          setCollections(prev => prev.map(c => ((c._id || c.id) === editingCollectionId ? col : c)));
          setIsCollectionModalOpen(false);
          setEditingCollectionId(null);
          setCollectionName('');
          setCollectionDesc('');
          if (setMessage) setMessage('Collection updated.');
        }
      } else {
        const res = await fetch('/api/v1/reference-collections', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: collectionName.trim(),
            description: collectionDesc.trim(),
            color: collectionColor,
            projectId: activeProject?._id || null
          })
        });
        if (res.ok) {
          const data = await res.json();
          const col = data.collection || data;
          setCollections(prev => [...prev, col]);
          setIsCollectionModalOpen(false);
          setCollectionName('');
          setCollectionDesc('');
          if (setMessage) setMessage('Collection created.');
        }
      }
    } catch (_) {
      if (setError) setError('Failed to save collection.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this collection? (References inside will remain in your library)')) return;
    try {
      const res = await fetch(`/api/v1/reference-collections/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCollections(prev => prev.filter(c => (c._id || c.id) !== id));
        if (selectedNav === id) setSelectedNav('all');
        if (setMessage) setMessage('Collection deleted.');
      }
    } catch (_) {}
  };

  // --------------------------------------------------------------------------
  // Manual Create & Edit Reference Form
  // --------------------------------------------------------------------------
  const openAddModal = () => {
    setFormTitle('');
    setFormSubtitle('');
    setFormAuthors('');
    setFormYear('');
    setFormType('journal-article');
    setFormJournal('');
    setFormPublisher('');
    setFormVolume('');
    setFormIssue('');
    setFormPages('');
    setFormDoi('');
    setFormUrl('');
    setFormAbstract('');
    setFormTags('');
    setFormNotes('');
    setFormCollections(selectedNav !== 'all' && selectedNav !== 'favorites' && selectedNav !== 'unverified' ? [selectedNav] : []);
    setIsAddModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedRef) return;
    setFormTitle(selectedRef.title || '');
    setFormSubtitle(selectedRef.subtitle || '');
    setFormAuthors((selectedRef.authors || []).map(a => a.name || `${a.given || ''} ${a.family || ''}`.trim()).join('; '));
    setFormYear(selectedRef.publicationYear || selectedRef.year || '');
    setFormType(selectedRef.publicationType || selectedRef.type || 'journal-article');
    setFormJournal(selectedRef.journalTitle || selectedRef.journal || '');
    setFormPublisher(selectedRef.publisher || '');
    setFormVolume(selectedRef.volume || '');
    setFormIssue(selectedRef.issue || '');
    setFormPages(selectedRef.pages || '');
    setFormDoi(selectedRef.doi || '');
    setFormUrl(selectedRef.url || '');
    setFormAbstract(selectedRef.abstract || '');
    setFormTags((selectedRef.tags || []).join(', '));
    setFormNotes(selectedRef.notes || '');
    setFormCollections(selectedRef.collectionIds || []);
    setIsEditModalOpen(true);
  };

  const handleSaveReferenceForm = async (isEdit: boolean) => {
    if (!formTitle.trim()) {
      if (setError) setError('Title is required.');
      return;
    }

    const parsedAuthors = formAuthors.split(';').map(s => s.trim()).filter(Boolean).map(str => {
      if (str.includes(',')) {
        const [fam, giv] = str.split(',').map(p => p.trim());
        return { family: fam, given: giv };
      }
      const parts = str.split(/\s+/);
      if (parts.length === 1) return { name: parts[0] };
      return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(' ') };
    });

    const parsedTags = formTags.split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
      title: formTitle.trim(),
      subtitle: formSubtitle.trim(),
      authors: parsedAuthors.length > 0 ? parsedAuthors : [{ name: 'Unknown Author' }],
      publicationYear: formYear.trim(),
      publicationType: formType,
      type: formType,
      journalTitle: formJournal.trim(),
      journal: formJournal.trim(),
      publisher: formPublisher.trim(),
      volume: formVolume.trim(),
      issue: formIssue.trim(),
      pages: formPages.trim(),
      doi: formDoi.trim(),
      url: formUrl.trim(),
      abstract: formAbstract.trim(),
      tags: parsedTags,
      notes: formNotes.trim(),
      collectionIds: formCollections,
      projectId: activeProject?._id || null
    };

    setBusy(true);
    try {
      if (isEdit && selectedRef) {
        const id = selectedRef._id || selectedRef.id;
        const res = await fetch(`/api/v1/references/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.reference || data;
          setReferences(prev => prev.map(r => ((r._id || r.id) === id ? updated : r)));
          setIsEditModalOpen(false);
          if (setMessage) setMessage('Reference updated.');
          if (onRefreshCitations) onRefreshCitations();
        }
      } else {
        const res = await fetch('/api/v1/references', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          const created = data.reference || data;
          setReferences(prev => [created, ...prev]);
          setSelectedRefId(created._id || created.id);
          setIsAddModalOpen(false);
          if (setMessage) setMessage('Reference added to library.');
          if (onRefreshCitations) onRefreshCitations();
        }
      }
    } catch (_) {
      if (setError) setError('Failed to save reference.');
    } finally {
      setBusy(false);
    }
  };

  // Helper formatting author list string
  const formatAuthorDisplay = (authors: Author[] = []) => {
    if (!authors || authors.length === 0) return 'Unknown Author';
    if (authors.length === 1) return authors[0].family || authors[0].name || 'Unknown';
    if (authors.length === 2) return `${authors[0].family || authors[0].name} & ${authors[1].family || authors[1].name}`;
    return `${authors[0].family || authors[0].name} et al.`;
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="reference-manager-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 72px)',
      background: 'var(--rp-bg, #f8fafc)',
      color: 'var(--rp-text, #0f172a)',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden'
    }}>
      {/* ==================================================================== */}
      {/* TOP HEADER & ACTION TOOLBAR                                          */}
      {/* ==================================================================== */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--rp-surface, #ffffff)',
        borderBottom: '1px solid var(--rp-border, #e2e8f0)',
        gap: '12px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--rp-accent-subtle, #eef2ff)',
            color: 'var(--rp-accent, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BookOpen size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Reference & Citation Manager</h1>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'var(--rp-surface-subtle, #f1f5f9)',
                color: 'var(--rp-text-muted, #64748b)',
                fontWeight: 500
              }}>
                {counts.total} references
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)', margin: 0 }}>
              Search, verify, organize, cite, and export academic literature with strict APA 7 & CSL compliance.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsScholarlyModalOpen(true)}
            className="secondary small"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Search Crossref & OpenAlex"
          >
            <Sparkles size={13} style={{ color: 'var(--rp-accent, #4f46e5)' }} /> Scholarly Search
          </button>

          <button
            onClick={() => setIsDoiModalOpen(true)}
            className="secondary small"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Lookup metadata by DOI"
          >
            <Globe size={13} /> Lookup DOI
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="secondary small"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Import BibTeX or RIS records"
          >
            <Upload size={13} /> Import
          </button>

          <button
            onClick={() => {
              setIsExportModalOpen(true);
              handleGenerateExport();
            }}
            className="secondary small"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Export bibliography in APA 7, BibTeX, RIS, or HTML"
          >
            <Download size={13} /> Export
          </button>

          <button
            onClick={handleCheckDuplicates}
            disabled={checkingDuplicates}
            className="secondary small"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Scan for duplicate records"
          >
            <GitMerge size={13} /> Check Duplicates
          </button>

          <button
            onClick={openAddModal}
            className="primary small"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> New Reference
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 3-PANE LINEAR WORKSPACE                                              */}
      {/* ==================================================================== */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* ------------------------------------------------------------------ */}
        {/* PANE 1: LEFT NAVIGATOR (Collections & Filters)                     */}
        {/* ------------------------------------------------------------------ */}
        <nav style={{
          width: '240px',
          background: 'var(--rp-surface, #ffffff)',
          borderRight: '1px solid var(--rp-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
          gap: '16px',
          overflowY: 'auto',
          flexShrink: 0
        }}>
          {/* Project Scoping Switcher */}
          {activeProject && (
            <div style={{
              background: 'var(--rp-surface-subtle, #f1f5f9)',
              borderRadius: '8px',
              padding: '10px 12px',
              border: '1px solid var(--rp-border-subtle, #edf2f7)'
            }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--rp-text-muted, #64748b)', marginBottom: '4px' }}>
                Active Project
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProject.title}
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button
                  onClick={() => setProjectFilter('active')}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid var(--rp-border)',
                    background: projectFilter === 'active' ? 'var(--rp-accent)' : 'var(--rp-surface)',
                    color: projectFilter === 'active' ? '#ffffff' : 'var(--rp-text)',
                    cursor: 'pointer'
                  }}
                >
                  This Project
                </button>
                <button
                  onClick={() => setProjectFilter('all')}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid var(--rp-border)',
                    background: projectFilter === 'all' ? 'var(--rp-accent)' : 'var(--rp-surface)',
                    color: projectFilter === 'all' ? '#ffffff' : 'var(--rp-text)',
                    cursor: 'pointer'
                  }}
                >
                  All Projects
                </button>
              </div>
            </div>
          )}

          {/* Standard Navigation Views */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-text-dim, #94a3b8)', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '8px' }}>
              Library
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => setSelectedNav('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedNav === 'all' ? 'var(--rp-accent-subtle, #eef2ff)' : 'transparent',
                  color: selectedNav === 'all' ? 'var(--rp-accent, #4f46e5)' : 'var(--rp-text, #0f172a)',
                  fontWeight: selectedNav === 'all' ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={15} /> All References
                </span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>{counts.total}</span>
              </button>

              <button
                onClick={() => setSelectedNav('favorites')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedNav === 'favorites' ? 'var(--rp-accent-subtle, #eef2ff)' : 'transparent',
                  color: selectedNav === 'favorites' ? 'var(--rp-accent, #4f46e5)' : 'var(--rp-text, #0f172a)',
                  fontWeight: selectedNav === 'favorites' ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={15} style={{ color: '#f59e0b' }} /> Favorites
                </span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>{counts.favorites}</span>
              </button>

              <button
                onClick={() => setSelectedNav('unverified')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedNav === 'unverified' ? 'var(--rp-accent-subtle, #eef2ff)' : 'transparent',
                  color: selectedNav === 'unverified' ? 'var(--rp-accent, #4f46e5)' : 'var(--rp-text, #0f172a)',
                  fontWeight: selectedNav === 'unverified' ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} style={{ color: '#d97706' }} /> Needs Verification
                </span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>{counts.unverified}</span>
              </button>
            </div>
          </div>

          {/* Collections Section */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingLeft: '8px', paddingRight: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-text-dim, #94a3b8)', textTransform: 'uppercase' }}>
                Collections
              </span>
              <button
                onClick={() => {
                  setEditingCollectionId(null);
                  setCollectionName('');
                  setCollectionDesc('');
                  setCollectionColor('#5e6ad2');
                  setIsCollectionModalOpen(true);
                }}
                title="New Collection"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--rp-text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px'
                }}
              >
                <Plus size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {collections.map(col => {
                const colId = col._id || col.id || '';
                const countInCol = references.filter(r => r.collectionIds?.includes(colId)).length;
                const isSelected = selectedNav === colId;
                return (
                  <div
                    key={colId}
                    onClick={() => setSelectedNav(colId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--rp-accent-subtle, #eef2ff)' : 'transparent',
                      color: isSelected ? 'var(--rp-accent, #4f46e5)' : 'var(--rp-text, #0f172a)',
                      fontWeight: isSelected ? 600 : 500,
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: col.color || '#5e6ad2',
                        flexShrink: 0
                      }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
                    </span>
                    <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>{countInCol}</span>
                  </div>
                );
              })}

              {collections.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--rp-text-dim, #94a3b8)', padding: '10px 8px', fontStyle: 'italic' }}>
                  No collections yet. Click + to organize papers.
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* ------------------------------------------------------------------ */}
        {/* PANE 2: CENTER REFERENCE LIST                                      */}
        {/* ------------------------------------------------------------------ */}
        <section style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--rp-surface, #ffffff)',
          borderRight: '1px solid var(--rp-border, #e2e8f0)',
          overflow: 'hidden'
        }}>
          {/* Search & Filter Toolbar */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--rp-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--rp-text-muted, #64748b)' }} />
                <input
                  type="text"
                  placeholder="Filter references by title, author, DOI, or journal..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: '6px',
                    border: '1px solid var(--rp-border, #e2e8f0)',
                    fontSize: '13px',
                    background: 'var(--rp-bg, #f8fafc)'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--rp-text-muted)'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Type filter */}
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--rp-border, #e2e8f0)',
                  fontSize: '12px',
                  background: 'var(--rp-surface, #ffffff)',
                  color: 'var(--rp-text, #0f172a)'
                }}
              >
                <option value="all">All Types</option>
                <option value="journal-article">Journal Article</option>
                <option value="book">Book</option>
                <option value="book-chapter">Book Chapter</option>
                <option value="proceedings-article">Conference Paper</option>
                <option value="thesis">Thesis / Dissertation</option>
                <option value="preprint">Preprint</option>
                <option value="dataset">Dataset</option>
                <option value="report">Report</option>
              </select>

              {/* Sort by */}
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={e => {
                  const [f, o] = e.target.value.split(':');
                  setSortBy(f as any);
                  setSortOrder(o as any);
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--rp-border, #e2e8f0)',
                  fontSize: '12px',
                  background: 'var(--rp-surface, #ffffff)',
                  color: 'var(--rp-text, #0f172a)'
                }}
              >
                <option value="updatedAt:desc">Recently Updated</option>
                <option value="year:desc">Year (Newest First)</option>
                <option value="year:asc">Year (Oldest First)</option>
                <option value="title:asc">Title (A-Z)</option>
                <option value="author:asc">First Author (A-Z)</option>
              </select>
            </div>

            {/* Bulk Actions Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--rp-text-muted, #64748b)',
              paddingTop: '2px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={toggleSelectAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--rp-text-muted, #64748b)',
                    fontSize: '12px',
                    padding: 0
                  }}
                >
                  {selectedIds.size > 0 && selectedIds.size === filteredReferences.length ? (
                    <CheckSquare size={14} style={{ color: 'var(--rp-accent, #4f46e5)' }} />
                  ) : (
                    <Square size={14} />
                  )}
                  <span>Select All ({filteredReferences.length})</span>
                </button>
                {selectedIds.size > 0 && (
                  <span style={{ fontWeight: 600, color: 'var(--rp-accent, #4f46e5)' }}>
                    · {selectedIds.size} selected
                  </span>
                )}
              </div>

              {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleBulkDelete}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--rp-danger, #dc2626)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 500
                    }}
                  >
                    <Trash2 size={13} /> Delete Selected
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reference Items List */}
          <div style={{
            flex: 1,
            overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--rp-text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px' }}>Loading research references...</p>
              </div>
            ) : filteredReferences.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--rp-text-muted)' }}>
                <BookOpen size={36} style={{ color: 'var(--rp-text-dim)', margin: '0 auto 12px', opacity: 0.5 }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '6px' }}>No references found</h3>
                <p style={{ fontSize: '13px', maxWidth: '360px', margin: '0 auto 16px' }}>
                  {searchQuery ? 'No citations matched your filter criteria.' : 'Import papers using DOI, Crossref search, or BibTeX.'}
                </p>
                <button onClick={openAddModal} className="primary small">
                  <Plus size={14} /> Add Reference Manually
                </button>
              </div>
            ) : (
              filteredReferences.map(ref => {
                const id = ref._id || ref.id || '';
                const isSelected = selectedRefId === id;
                const isChecked = selectedIds.has(id);
                const typeLabel = ref.publicationType || ref.type || 'journal-article';

                return (
                  <div
                    key={id}
                    onClick={() => setSelectedRefId(id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--rp-border-subtle, #edf2f7)',
                      background: isSelected ? 'var(--rp-accent-subtle, #eef2ff)' : 'transparent',
                      cursor: 'pointer',
                      gap: '12px',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={e => toggleSelectOne(id, e)}
                      style={{ marginTop: '2px', cursor: 'pointer', color: isChecked ? 'var(--rp-accent)' : 'var(--rp-text-dim)' }}
                    >
                      {isChecked ? <CheckSquare size={15} /> : <Square size={15} />}
                    </div>

                    {/* Star Favorite */}
                    <div
                      onClick={e => toggleFavorite(ref, e)}
                      style={{ marginTop: '2px', cursor: 'pointer', color: ref.isFavorite ? '#f59e0b' : 'var(--rp-text-dim)' }}
                      title={ref.isFavorite ? 'Unstar' : 'Star reference'}
                    >
                      <Star size={15} fill={ref.isFavorite ? '#f59e0b' : 'none'} />
                    </div>

                    {/* Main Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: isSelected ? 'var(--rp-accent, #4f46e5)' : 'var(--rp-text, #0f172a)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {ref.title || 'Untitled Reference'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{formatAuthorDisplay(ref.authors)}</span>
                        <span>·</span>
                        <span style={{ fontWeight: 500 }}>{ref.publicationYear || ref.year || 'n.d.'}</span>
                        {(ref.journalTitle || ref.journal || ref.publisher) && (
                          <>
                            <span>·</span>
                            <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                              {ref.journalTitle || ref.journal || ref.publisher}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Pills: Type, Verification, DOI */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'var(--rp-surface-subtle, #f1f5f9)',
                          color: 'var(--rp-text-muted, #64748b)',
                          textTransform: 'capitalize'
                        }}>
                          {typeLabel.replace('-', ' ')}
                        </span>

                        {ref.metadataStatus === 'verified' ? (
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--rp-success-subtle, #ecfdf5)',
                            color: 'var(--rp-success, #059669)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 500
                          }}>
                            <CheckCircle2 size={10} /> Verified DOI
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--rp-warning-subtle, #fffbeb)',
                            color: 'var(--rp-warning, #d97706)',
                            fontWeight: 500
                          }}>
                            Manual Entry
                          </span>
                        )}

                        {ref.doi && (
                          <span style={{ fontSize: '10px', color: 'var(--rp-text-dim, #94a3b8)', fontFamily: 'monospace' }}>
                            doi:{ref.doi}
                          </span>
                        )}

                        {ref.tags && ref.tags.map(t => (
                          <span key={t} style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: '#e0e7ff',
                            color: '#3730a3'
                          }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* PANE 3: RIGHT INSPECTOR & LIVE CSL PREVIEW                         */}
        {/* ------------------------------------------------------------------ */}
        <aside style={{
          width: '380px',
          background: 'var(--rp-surface, #ffffff)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          flexShrink: 0
        }}>
          {selectedRef ? (
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--rp-text-dim, #94a3b8)'
                }}>
                  Reference Inspector
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={openEditModal}
                    className="secondary small"
                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Edit reference"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteReference(selectedRef._id || selectedRef.id || '')}
                    className="icon-button"
                    style={{ padding: '4px', color: 'var(--rp-danger, #dc2626)' }}
                    title="Delete reference"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Title & Core Details */}
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4, margin: '0 0 6px 0' }}>
                  {selectedRef.title}
                </h2>
                {selectedRef.subtitle && (
                  <p style={{ fontSize: '13px', color: 'var(--rp-text-muted)', margin: '0 0 6px 0', fontStyle: 'italic' }}>
                    {selectedRef.subtitle}
                  </p>
                )}
                <div style={{ fontSize: '13px', color: 'var(--rp-text-muted)' }}>
                  {selectedRef.authors?.map(a => a.name || `${a.given || ''} ${a.family || ''}`.trim()).join(', ') || 'Unknown Author'}
                </div>
              </div>

              {/* ============================================================ */}
              {/* CSL LIVE CITATION PREVIEW BOX                                */}
              {/* ============================================================ */}
              <div style={{
                background: 'var(--rp-bg, #f8fafc)',
                border: '1px solid var(--rp-border, #e2e8f0)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} style={{ color: 'var(--rp-accent, #4f46e5)' }} /> CSL Citation Preview
                  </span>

                  {/* Style selector */}
                  <select
                    value={cslStyle}
                    onChange={(e: any) => setCslStyle(e.target.value)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--rp-border)',
                      background: 'var(--rp-surface)'
                    }}
                  >
                    <option value="apa7">APA 7th</option>
                    <option value="mla9">MLA 9th</option>
                    <option value="chicago">Chicago 17th</option>
                    <option value="harvard">Harvard</option>
                    <option value="ieee">IEEE</option>
                    <option value="vancouver">Vancouver</option>
                  </select>
                </div>

                {/* In-Text vs Bibliography Tabs */}
                <div style={{ display: 'flex', gap: '4px', background: 'var(--rp-surface-subtle)', padding: '2px', borderRadius: '6px' }}>
                  <button
                    onClick={() => setCslType('bibliography')}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '4px',
                      borderRadius: '4px',
                      border: 'none',
                      background: cslType === 'bibliography' ? 'var(--rp-surface)' : 'transparent',
                      fontWeight: cslType === 'bibliography' ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    Bibliography
                  </button>
                  <button
                    onClick={() => setCslType('parenthetical')}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '4px',
                      borderRadius: '4px',
                      border: 'none',
                      background: cslType === 'parenthetical' ? 'var(--rp-surface)' : 'transparent',
                      fontWeight: cslType === 'parenthetical' ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    In-Text (Parenthetical)
                  </button>
                  <button
                    onClick={() => setCslType('narrative')}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '4px',
                      borderRadius: '4px',
                      border: 'none',
                      background: cslType === 'narrative' ? 'var(--rp-surface)' : 'transparent',
                      fontWeight: cslType === 'narrative' ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    In-Text (Narrative)
                  </button>
                </div>

                {/* Formatted Citation Output */}
                <div style={{
                  background: 'var(--rp-surface, #ffffff)',
                  border: '1px solid var(--rp-border-subtle, #edf2f7)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  color: 'var(--rp-text, #0f172a)',
                  minHeight: '48px',
                  position: 'relative'
                }}>
                  {cslLoading ? (
                    <span style={{ color: 'var(--rp-text-muted)' }}>Formatting citation...</span>
                  ) : (
                    <span>{cslFormatted}</span>
                  )}
                </div>

                <button
                  onClick={() => copyToClipboard(cslFormatted)}
                  className="secondary small"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    background: copyFeedback ? 'var(--rp-success-subtle)' : undefined,
                    color: copyFeedback ? 'var(--rp-success)' : undefined,
                    borderColor: copyFeedback ? 'var(--rp-success)' : undefined
                  }}
                >
                  {copyFeedback ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copyFeedback ? 'Copied to Clipboard!' : 'Copy Formatted Citation'}</span>
                </button>
              </div>

              {/* Publication Metadata Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-text-dim)', textTransform: 'uppercase' }}>
                  Publication Metadata
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--rp-border-subtle)' }}>
                  <span style={{ color: 'var(--rp-text-muted)' }}>Type</span>
                  <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {(selectedRef.publicationType || selectedRef.type || 'journal-article').replace('-', ' ')}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--rp-border-subtle)' }}>
                  <span style={{ color: 'var(--rp-text-muted)' }}>Year</span>
                  <span>{selectedRef.publicationYear || selectedRef.year || '—'}</span>
                </div>

                {selectedRef.journalTitle || selectedRef.journal ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--rp-border-subtle)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>Journal</span>
                    <span style={{ fontStyle: 'italic' }}>{selectedRef.journalTitle || selectedRef.journal}</span>
                  </div>
                ) : null}

                {selectedRef.publisher ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--rp-border-subtle)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>Publisher</span>
                    <span>{selectedRef.publisher}</span>
                  </div>
                ) : null}

                {(selectedRef.volume || selectedRef.issue || selectedRef.pages) ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--rp-border-subtle)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>Vol / Issue / Pp</span>
                    <span>
                      {selectedRef.volume ? `Vol. ${selectedRef.volume}` : ''}
                      {selectedRef.issue ? ` (${selectedRef.issue})` : ''}
                      {selectedRef.pages ? `, pp. ${selectedRef.pages}` : ''}
                    </span>
                  </div>
                ) : null}

                {selectedRef.doi ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--rp-border-subtle)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>DOI</span>
                    <a
                      href={`https://doi.org/${selectedRef.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--rp-accent)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedRef.doi}</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                ) : null}

                {selectedRef.url && !selectedRef.doi ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--rp-border-subtle)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>URL</span>
                    <a href={selectedRef.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rp-accent)' }}>
                      Open Web Resource ↗
                    </a>
                  </div>
                ) : null}
              </div>

              {/* Abstract */}
              {selectedRef.abstract && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-text-dim)', textTransform: 'uppercase' }}>
                    Abstract
                  </span>
                  <p style={{
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: 'var(--rp-text-muted, #64748b)',
                    background: 'var(--rp-bg, #f8fafc)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    margin: 0,
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}>
                    {selectedRef.abstract}
                  </p>
                </div>
              )}

              {/* Research Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-text-dim)', textTransform: 'uppercase' }}>
                    Research Notes
                  </span>
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--rp-accent)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Record literature review annotations, methodology notes, or key findings..."
                  value={editingNotes}
                  onChange={e => setEditingNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--rp-border, #e2e8f0)',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    background: 'var(--rp-bg, #f8fafc)'
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--rp-text-muted)' }}>
              <FileText size={32} style={{ color: 'var(--rp-text-dim)', margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '13px' }}>Select a reference to inspect metadata and generate live APA 7 citations.</p>
            </div>
          )}
        </aside>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: ADD / EDIT REFERENCE                                        */}
      {/* ==================================================================== */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--rp-surface, #ffffff)',
            borderRadius: '12px',
            width: '640px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--rp-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                {isEditModalOpen ? 'Edit Reference' : 'Add New Reference'}
              </h3>
              <button
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rp-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Title <span style={{ color: 'var(--rp-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Deep Residual Learning for Image Recognition"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Authors (separated by semicolon)
                  </label>
                  <input
                    type="text"
                    value={formAuthors}
                    onChange={e => setFormAuthors(e.target.value)}
                    placeholder="e.g. He, Kaiming; Zhang, Xiangyu; Ren, Shaoqing"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Publication Year
                  </label>
                  <input
                    type="text"
                    value={formYear}
                    onChange={e => setFormYear(e.target.value)}
                    placeholder="e.g. 2016"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)', background: 'var(--rp-surface)' }}
                  >
                    <option value="journal-article">Journal Article</option>
                    <option value="book">Book</option>
                    <option value="book-chapter">Book Chapter</option>
                    <option value="proceedings-article">Conference Paper</option>
                    <option value="thesis">Thesis / Dissertation</option>
                    <option value="preprint">Preprint</option>
                    <option value="dataset">Dataset</option>
                    <option value="report">Report</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Journal / Container Title
                  </label>
                  <input
                    type="text"
                    value={formJournal}
                    onChange={e => setFormJournal(e.target.value)}
                    placeholder="e.g. IEEE Transactions on Pattern Analysis"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Volume</label>
                  <input
                    type="text"
                    value={formVolume}
                    onChange={e => setFormVolume(e.target.value)}
                    placeholder="e.g. 38"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Issue</label>
                  <input
                    type="text"
                    value={formIssue}
                    onChange={e => setFormIssue(e.target.value)}
                    placeholder="e.g. 4"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Pages</label>
                  <input
                    type="text"
                    value={formPages}
                    onChange={e => setFormPages(e.target.value)}
                    placeholder="e.g. 770-778"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DOI</label>
                  <input
                    type="text"
                    value={formDoi}
                    onChange={e => setFormDoi(e.target.value)}
                    placeholder="e.g. 10.1109/CVPR.2016.90"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Publisher</label>
                  <input
                    type="text"
                    value={formPublisher}
                    onChange={e => setFormPublisher(e.target.value)}
                    placeholder="e.g. IEEE"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Abstract</label>
                <textarea
                  rows={3}
                  value={formAbstract}
                  onChange={e => setFormAbstract(e.target.value)}
                  placeholder="Paste paper abstract..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="deep-learning, computer-vision, neural-networks"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)' }}
                />
              </div>
            </div>

            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--rp-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px'
            }}>
              <button
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                className="secondary small"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveReferenceForm(isEditModalOpen)}
                disabled={busy}
                className="primary small"
              >
                {busy ? 'Saving...' : (isEditModalOpen ? 'Save Changes' : 'Create Reference')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: DOI QUICK LOOKUP                                            */}
      {/* ==================================================================== */}
      {isDoiModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--rp-surface, #ffffff)',
            borderRadius: '12px',
            width: '560px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} /> Lookup Reference by DOI
              </h3>
              <button onClick={() => { setIsDoiModalOpen(false); setDoiMetadata(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter DOI (e.g. 10.1038/s41586-020-2649-2)"
                  value={doiInput}
                  onChange={e => setDoiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleLookupDoi(); }}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rp-border)', fontSize: '13px' }}
                />
                <button onClick={handleLookupDoi} disabled={doiSearching} className="primary small">
                  {doiSearching ? 'Querying Crossref...' : 'Lookup'}
                </button>
              </div>

              {doiMetadata && (
                <div style={{
                  background: 'var(--rp-bg)',
                  borderRadius: '8px',
                  padding: '14px',
                  border: '1px solid var(--rp-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{doiMetadata.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--rp-text-muted)' }}>
                    {formatAuthorDisplay(doiMetadata.authors)} · {doiMetadata.year || doiMetadata.publicationYear} · {doiMetadata.journal || doiMetadata.journalTitle}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--rp-text-dim)', fontFamily: 'monospace' }}>
                    doi:{doiMetadata.doi}
                  </div>
                  <button
                    onClick={handleImportDoiResult}
                    disabled={busy}
                    className="primary small"
                    style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                  >
                    <Plus size={13} /> Import to My Library
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: SCHOLARLY SEARCH (Crossref & OpenAlex)                       */}
      {/* ==================================================================== */}
      {isScholarlyModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--rp-surface, #ffffff)',
            borderRadius: '12px',
            width: '740px',
            maxHeight: '86vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--rp-accent)' }} /> Scholarly Discovery (Crossref & OpenAlex)
              </h3>
              <button onClick={() => setIsScholarlyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search millions of peer-reviewed articles, books, preprints..."
                value={scholarlyQuery}
                onChange={e => setScholarlyQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleScholarlySearch(); }}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--rp-border)', fontSize: '13px' }}
              />
              <select
                value={scholarlyProvider}
                onChange={(e: any) => setScholarlyProvider(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)', fontSize: '12px' }}
              >
                <option value="crossref">Crossref</option>
                <option value="openalex">OpenAlex</option>
              </select>
              <button onClick={() => handleScholarlySearch()} disabled={scholarlySearching} className="primary small">
                {scholarlySearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {scholarlySearching ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--rp-text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                  <p>Searching scholarly databases...</p>
                </div>
              ) : scholarlyResults.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--rp-text-muted)', fontSize: '13px' }}>
                  {scholarlyQuery ? 'No scholarly papers found for this query.' : 'Type a query and press Search to discover papers.'}
                </div>
              ) : (
                scholarlyResults.map((item, idx) => (
                  <div key={idx} style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--rp-border)',
                    background: 'var(--rp-bg)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--rp-text)' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--rp-text-muted)', marginTop: '2px' }}>
                        {formatAuthorDisplay(item.authors)} · {item.publicationYear || item.year || 'n.d.'} · <i>{item.journal || item.journalTitle}</i>
                      </div>
                      {item.doi && (
                        <div style={{ fontSize: '11px', color: 'var(--rp-text-dim)', marginTop: '4px', fontFamily: 'monospace' }}>
                          doi:{item.doi}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleImportScholarlyItem(item)}
                      disabled={busy}
                      className="secondary small"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={12} /> Import
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: BIBTEX / RIS IMPORT                                         */}
      {/* ==================================================================== */}
      {isImportModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--rp-surface, #ffffff)',
            borderRadius: '12px',
            width: '600px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} /> Import References (BibTeX / RIS)
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importFormat"
                    checked={importFormat === 'bibtex'}
                    onChange={() => setImportFormat('bibtex')}
                  />
                  <span>BibTeX (.bib)</span>
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importFormat"
                    checked={importFormat === 'ris'}
                    onChange={() => setImportFormat('ris')}
                  />
                  <span>RIS (.ris)</span>
                </label>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Paste BibTeX or RIS entries:
                </label>
                <textarea
                  rows={8}
                  placeholder={importFormat === 'bibtex' ? '@article{smith2024,\n  title={Quantum Advances},\n  author={Smith, Alice},\n  year={2024}\n}' : 'TY  - JOUR\nTI  - Quantum Advances\nAU  - Smith, Alice\nPY  - 2024\nER  - '}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid var(--rp-border)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: 1.5
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setIsImportModalOpen(false)} className="secondary small">
                  Cancel
                </button>
                <button onClick={handleImportBibtexRis} disabled={importing || !importText.trim()} className="primary small">
                  {importing ? 'Importing & Validating...' : 'Parse & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: DUPLICATE RESOLUTION                                        */}
      {/* ==================================================================== */}
      {isDuplicatesModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--rp-surface, #ffffff)',
            borderRadius: '12px',
            width: '740px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitMerge size={16} /> Duplicate Detection & Merge Review
              </h3>
              <button onClick={() => setIsDuplicatesModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {duplicatePairs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--rp-text-muted)' }}>
                  <CheckCircle2 size={36} style={{ color: 'var(--rp-success)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>No duplicate citations detected!</p>
                  <p style={{ fontSize: '12px' }}>Your research library is clean and deduplicated.</p>
                </div>
              ) : (
                duplicatePairs.map((pair, idx) => (
                  <div key={idx} style={{
                    border: '1px solid var(--rp-border)',
                    borderRadius: '8px',
                    padding: '14px',
                    background: 'var(--rp-bg)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: pair.matchType === 'exact' ? '#fee2e2' : '#fef3c7',
                        color: pair.matchType === 'exact' ? '#b91c1c' : '#b45309',
                        textTransform: 'uppercase'
                      }}>
                        {pair.matchType} duplicate · {pair.reason}
                      </span>

                      <button
                        onClick={() => handleMergePair(pair.primary._id, pair.secondary._id)}
                        disabled={busy}
                        className="primary small"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <GitMerge size={12} /> Merge into Primary
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div style={{ background: 'var(--rp-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--rp-border-subtle)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--rp-accent)', marginBottom: '4px' }}>Primary Record</div>
                        <div style={{ fontWeight: 600 }}>{pair.primary.title}</div>
                        <div style={{ color: 'var(--rp-text-muted)', marginTop: '2px' }}>
                          {formatAuthorDisplay(pair.primary.authors)} · {pair.primary.publicationYear || pair.primary.year}
                        </div>
                        {pair.primary.doi && <div style={{ fontSize: '11px', color: 'var(--rp-text-dim)', marginTop: '2px' }}>doi:{pair.primary.doi}</div>}
                      </div>

                      <div style={{ background: 'var(--rp-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--rp-border-subtle)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--rp-warning)', marginBottom: '4px' }}>Duplicate Candidate (Will be merged & archived)</div>
                        <div style={{ fontWeight: 600 }}>{pair.secondary.title}</div>
                        <div style={{ color: 'var(--rp-text-muted)', marginTop: '2px' }}>
                          {formatAuthorDisplay(pair.secondary.authors)} · {pair.secondary.publicationYear || pair.secondary.year}
                        </div>
                        {pair.secondary.doi && <div style={{ fontSize: '11px', color: 'var(--rp-text-dim)', marginTop: '2px' }}>doi:{pair.secondary.doi}</div>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: EXPORT BIBLIOGRAPHY                                         */}
      {/* ==================================================================== */}
      {isExportModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--rp-surface, #ffffff)',
            borderRadius: '12px',
            width: '680px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={16} /> Export References & Bibliography
              </h3>
              <button onClick={() => setIsExportModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Export Format</label>
                  <select
                    value={exportFormat}
                    onChange={(e: any) => {
                      setExportFormat(e.target.value);
                      setTimeout(handleGenerateExport, 50);
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)', background: 'var(--rp-surface)' }}
                  >
                    <option value="plaintext">Formatted Plaintext</option>
                    <option value="html">HTML (with hanging indent)</option>
                    <option value="bibtex">BibTeX (.bib)</option>
                    <option value="ris">RIS (.ris)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Citation Style</label>
                  <select
                    value={exportStyle}
                    onChange={(e: any) => {
                      setExportStyle(e.target.value);
                      setTimeout(handleGenerateExport, 50);
                    }}
                    disabled={exportFormat === 'bibtex' || exportFormat === 'ris'}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)', background: 'var(--rp-surface)' }}
                  >
                    <option value="apa7">APA 7th Edition</option>
                    <option value="mla9">MLA 9th Edition</option>
                    <option value="chicago">Chicago 17th Edition</option>
                    <option value="harvard">Harvard</option>
                    <option value="ieee">IEEE</option>
                    <option value="vancouver">Vancouver</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Export Preview</label>
                <textarea
                  readOnly
                  rows={10}
                  value={exportLoading ? 'Generating exported bibliography...' : exportOutput}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid var(--rp-border)',
                    fontFamily: exportFormat === 'bibtex' || exportFormat === 'ris' ? 'monospace' : 'inherit',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    background: 'var(--rp-bg)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => copyToClipboard(exportOutput)}
                  disabled={!exportOutput}
                  className="secondary small"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Copy size={13} /> Copy to Clipboard
                </button>
                <button
                  onClick={handleDownloadExportFile}
                  disabled={!exportOutput}
                  className="primary small"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={13} /> Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: CREATE / EDIT COLLECTION                                    */}
      {/* ==================================================================== */}
      {isCollectionModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--rp-surface, #ffffff)',
            borderRadius: '12px',
            width: '460px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={16} /> {editingCollectionId ? 'Edit Collection' : 'Create Collection'}
              </h3>
              <button onClick={() => setIsCollectionModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Collection Name <span style={{ color: 'var(--rp-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quantum Computing Literature"
                  value={collectionName}
                  onChange={e => setCollectionName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Optional brief description"
                  value={collectionDesc}
                  onChange={e => setCollectionDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--rp-border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Color Tag</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#5e6ad2', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'].map(color => (
                    <div
                      key={color}
                      onClick={() => setCollectionColor(color)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: color,
                        cursor: 'pointer',
                        border: collectionColor === color ? '2px solid var(--rp-text)' : '2px solid transparent'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button onClick={() => setIsCollectionModalOpen(false)} className="secondary small">
                  Cancel
                </button>
                <button onClick={handleSaveCollection} disabled={busy || !collectionName.trim()} className="primary small">
                  {busy ? 'Saving...' : (editingCollectionId ? 'Save Changes' : 'Create Collection')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
