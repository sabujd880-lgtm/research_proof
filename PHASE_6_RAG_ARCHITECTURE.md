# Phase 6 — Grounded RAG Architecture & Document Intelligence

## 1. Executive Summary

ResearchProof AI 1.0 Phase 6 implements an evidence-grounded Retrieval-Augmented Generation (RAG) architecture tailored specifically for academic research literature, scientific preprints, and clinical trial manuscripts. 

Unlike generic document chat implementations that indiscriminately summarize entire PDFs or hallucinate citations, Phase 6 enforces strict algorithmic traceability: **every factual claim must be backed by a verbatim excerpt and an exact page reference `[Document Title, p. X]`**.

---

## 2. End-to-End Pipeline

```
┌──────────────────┐     ┌───────────────────┐     ┌────────────────────────┐
│ PDF / Document   │ ──> │ Magic Bytes Check │ ──> │ Pure JS PDF Stream     │
│ Upload (up to    │     │ SHA-256 Checksum  │     │ Object Parser (BT..ET) │
│ 25MB, multi-file)│     │ Deduplication     │     │ & FlateDecode Inflate  │
└──────────────────┘     └───────────────────┘     └────────────────────────┘
                                                                │
                                                                ▼
┌──────────────────┐     ┌───────────────────┐     ┌────────────────────────┐
│ Local Determin-  │ <── │ Token / Word Size │ <── │ Page-Aware Chunking    │
│ istic Vector     │     │ Bounding (180w)   │     │ (Preserves Page Number │
│ Embeddings       │     │ Overlap (30w)     │     │ & Section Headers)     │
└──────────────────┘     └───────────────────┘     └────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Hybrid Retrieval Engine                                                   │
│ • Semantic Vector Cosine Similarity (60% weight)                          │
│ • Lexical Term Matching / BM25 Frequency (40% weight)                     │
│ • Filtered by active Project & Selected Document IDs                      │
└───────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Anti-Hallucination Answer Synthesis                                       │
│ • Grounded claim generation citing only retrieved chunks                  │
│ • Verifiable citation tags: [Document Title, p. X]                        │
│ • Specialized academic presets: Summary, Methodology, Sample, Findings,   │
│   Limitations, Gaps, and Evidence Matrix Table                            │
└───────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Citation Provenance Verification & Evidence Inspector                     │
│ • validateMessageCitations() ensures zero unsupported citations           │
│ • CitationEvidence database records linking claims to exact page excerpts │
│ • 1-click jump to page viewer & cross-system export (Literature/Ref)      │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Modules

### 3.1. Stream & Object Ingestion (`extractPagesFromPdf`)
- Detects `%PDF-` magic header bytes to ensure binary integrity.
- Parses object trees and decompressing FlateDecode byte streams using Node's native `zlib.inflateSync`.
- Isolates text blocks within `BT ... ET` blocks and resolves literal strings (`(...)`) and hex strings.
- Reconstructs text on a deterministic per-page basis with ligature normalization (`ﬁ` $\to$ `fi`, `ﬂ` $\to$ `fl`), hyphenation re-joining, and whitespace consolidation.

### 3.2. Evidence-Preserving Chunking (`chunkDocumentPages`)
- Preserves exact document page numbers on every chunk.
- Detects section headings (`Abstract`, `Methodology`, `Results`, `Discussion`, etc.) and attaches metadata.
- Applies a sliding window (180 max words, 30 overlap words) to ensure semantic continuity without splitting empirical numbers, $p$-values, or sample sizes.
- Generates an MD5 content hash per chunk for deterministic deduplication and caching.

### 3.3. Deterministic Local Embedding Engine (`computeLocalEmbedding`)
- Computes 64-dimensional semantic dense vectors using hashed character $n$-gram representations and word positional frequencies.
- Enables complete offline testing, zero external API latency, zero rate limits, and non-blocking background indexing.
- Implements cosine similarity calculation with vector normalization.

### 3.4. Hybrid Retrieval Engine (`searchDocumentChunks`)
- Combines semantic dense vector similarity (60% weight) with BM25 term-frequency lexical matching (40% weight).
- Supports single-document queries and multi-document synthesis across multiple selected papers.
- Ranks candidate passages by combined relevance score.

### 3.5. Anti-Hallucination Synthesis & Research Presets (`generateGroundedAnswer`)
- Uses strict template structures that synthesize statements exclusively from retrieved chunks.
- Automatically inserts provenance tags in the standard format `[Document Title, p. X]`.
- Implements specialized research inquiry modes:
  - `summary`: High-level synthesis of research questions and core conclusions.
  - `methodology`: Detailed extraction of study design, sampling, and statistical tests.
  - `sample`: Demographic sample size, inclusion/exclusion criteria.
  - `findings`: Empirical outcomes, effect sizes ($F$, $t$, $r$, $d$, $p$).
  - `limitations`: Methodological risks, threats to validity.
  - `gaps`: Unaddressed questions and future research trajectories.
  - `table`: Markdown evidence comparison table with page citations.

### 3.6. Verification & Citation Provenance (`validateMessageCitations`)
- Scans generated responses for all citation tags.
- Verifies that every cited page number and title prefix corresponds to an actual chunk in the retrieved context set.
- Stores `CitationEvidence` provenance records with verbatim excerpts, confidence scores, and claims.

