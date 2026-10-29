# ResearchProof AI 1.0 — Frontend UI Audit & Route Inventory (UI-A)

**Audit Date**: October 29, 2026  
**Status**: Completed  
**Repository**: `https://github.com/sabujd880-lgtm/research_proof`  
**Production**: `https://research-proof-1.onrender.com`  
**Auditor**: Senior UI/UX & Design Systems Architect  

---

## 1. Executive Summary

This comprehensive audit catalogs all user-facing views, navigation structures, UI components, typography, layout dimensions, color tokens, and accessibility metrics across ResearchProof AI 1.0. The goal is to provide the empirical baseline for the **Linear-Inspired Minimal Enterprise UI/UX Redesign**.

The application currently has a solid functional foundation across 8 core research modules, writing tools, and governance dashboards. However, the interface suffers from:
1. **Inconsistent Density & Spacing**: A mix of generous 20-34px padding with cramped inline controls.
2. **Hardcoded Color Inconsistencies**: Over 40 discrete ad-hoc hex values (`#8876ee`, `#7465ed`, `#6366f1`, `#8b7af7`, `#b8afff`) instead of a unified semantic token system.
3. **Typography Divergence**: Using `DM Sans` and `Manrope` with variable font weights instead of clean enterprise `Inter` with `JetBrains Mono` for monospace academic data.
4. **Shell Inconsistencies**: The sidebar is currently 252px wide (compact mode 68px) and the header is 66px, contrasting with the Linear enterprise standard (248px expanded, 64px collapsed, 56px header).
5. **Lack of Standard Primitives**: Metric cards, tables, and filter bars are styled differently across modules (`LiteratureReview`, `StatisticalAnalysis`, `SystematicReviews`, and `WritingStudio`).

---

## 2. Route & Section Inventory

| Section Name | URL Path | Nav Group | Component / Implementation | Key Features & Elements |
|---|---|---|---|---|
| **Overview / Dashboard** | `/dashboard`, `/` | `workspace` | `Dashboard` (`App.tsx`) | Active project banner, workflow progress bar, quick tools jump bar, 4 stat cards, tool cards grid, recent revisions panel, integrity check list. |
| **My Research Projects** | `/projects` | `workspace` | Inline View (`App.tsx`) | Project cards grid, project creation form, discipline/stage selectors, completion percentage, delete action. |
| **Literature Review** | `/literature` | `workspace` | `LiteratureReview.tsx` | Search queries, paper discovery, comparison matrix table, synthesis generation, export to Writing Studio. |
| **Reference Manager** | `/reference-manager`, `/citations` | `workspace` | Inline View (`App.tsx`) | BibTeX/RIS upload & export, DOI lookup, citation search/filter, duplicate detection badge, citation count badges. |
| **Statistical Analysis** | `/statistical-analysis` | `workspace` | `StatisticalAnalysis.tsx` | Raw data input (CSV/TSV), summary statistics cards, t-test, ANOVA, Pearson correlation, linear regression, APA 7 narrative synthesis, send to studio. |
| **PDF Research Chat** | `/pdf-chat` | `workspace` | `PdfResearchChat.tsx` | PDF upload, chunking status, split-view passage explorer, BM25 grounded chat Q&A, citation jump links. |
| **Systematic Reviews** | `/systematic-reviews` | `workspace` | `SystematicReviews.tsx` | PRISMA 2020 4-stage pipeline (Identification, Screening, Eligibility, Included), exclusion reasons, dual-reviewer simulation. |
| **Journal Submission** | `/journal-submission` | `workspace` | `JournalSubmission.tsx` | Aims & scope matching, journal criteria checklist, cover letter generator, submission package readiness score. |
| **Research Collaboration** | `/collaboration` | `workspace` | `ResearchCollaboration.tsx` | Co-author team members, role-based access (Lead, Co-Author, Reviewer, Observer), research task board, comments thread. |
| **Writing Studio** | `/studio` | `authoring-integrity` | Inline View (`App.tsx`) | 3-column layout: document sidebar (240px), rich editor center, interactive inspector tabs right (QuillBot paraphraser, TextGuard plagiarism, citations, diffs). |
| **Paraphrasing Tool** | `/paraphrase` | `authoring-integrity` | Inline View (`App.tsx`) | Academic mode paraphraser (Standard, Fluency, Formal, Academic, Expand, Shorten). |
| **AI Text Humanizer** | `/humanizer` | `authoring-integrity` | Inline View (`App.tsx`) | AI-pattern humanizer preserving citation anchors and empirical facts. |
| **Summarization Tool** | `/summarize` | `authoring-integrity` | Inline View (`App.tsx`) | Executive and structured academic summaries. |
| **Grammar & Fluency** | `/grammar-fluency` | `authoring-integrity` | Inline View (`App.tsx`) | Contextual academic syntax correction. |
| **Tone & Rewriting** | `/tone-rewriting` | `authoring-integrity` | Inline View (`App.tsx`) | Formal tone calibrations. |
| **Research Integrity** | `/integrity` | `authoring-integrity` | Inline View (`App.tsx`) | Dossier summary, publication criteria checks, redundancy scans. |
| **Plagiarism & Similarity** | `/plagiarism-similarity` | `authoring-integrity` | Inline View (`App.tsx`) | TextGuard scan, similarity percentage, interactive highlighted passages, source matches drawer, certificate generation. |
| **AI-Authorship Indicators** | `/ai-authorship` | `authoring-integrity` | Inline View (`App.tsx`) | Authorship indicator bar, perplexity analysis, uncertainty disclaimer. |
| **Document Studio** | `/document-studio` | `authoring-integrity` | `DocumentStudio.tsx` | Word (.docx) import/export, LaTeX export with IEEE/ACM/APA/Nature formatting, PDF compilation ready. |
| **Revision History** | `/history` | `platform-governance` | Inline View (`App.tsx`) | Side-by-side diff comparison, revert revision, timestamp and word count deltas. |
| **Usage Analytics** | `/usage-analytics` | `platform-governance` | Inline View (`App.tsx`) | Daily quota usage, monthly metrics, tool usage distribution. |
| **Privacy & Data** | `/privacy-data` | `platform-governance` | Inline View (`App.tsx`) | In-memory policy status, export personal data, purge history. |
| **Settings** | `/settings` | `platform-governance` | Inline View (`App.tsx`) | Dark/light theme toggle, citation format default, API keys status, profile details. |
| **Admin Overview** | `/admin/overview` | `administration` | Inline View (`App.tsx`) | System metrics, active users, storage usage, error rates. |
| **User Management** | `/admin/users` | `administration` | Inline View (`App.tsx`) | User list, role escalation, quota adjustments, suspension toggles. |
| **Platform Audit Logs** | `/admin/logs` | `administration` | Inline View (`App.tsx`) | Immutable audit trail, login records, security events. |

---

## 3. UI Component Inventory & Layout Audit

### 3.1 App Shell Dimensions
- **Current Sidebar Width**: `252px` expanded, `68px` collapsed.
- **Target Linear Standard**: `248px` expanded, `64px` collapsed, `260px` mobile drawer with 240ms cubic bezier animation.
- **Current Header Height**: `66px` with `34px` horizontal padding.
- **Target Linear Standard**: `56px` with `16px-24px` horizontal padding, compact breadcrumbs, project switcher, search trigger (`Ctrl+K`), and user status.
- **Main Area Container**: `max-width: 1450px`, padding `32px 34px`. Needs streamlined compact margins: `16px 24px 32px`.

### 3.2 Typography & Fonts
- **Current Headings**: `Manrope` (800, 700) with `-1.5px` to `-0.4px` letter spacing.
- **Current Body**: `DM Sans` (400, 500, 600, 700).
- **Target Modern Enterprise Standard**:
  - UI & Body: `Inter`, system-ui, -apple-system, sans-serif (`font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'`).
  - Monospace (DOIs, statistical output, LaTeX, code, timestamps): `JetBrains Mono`, `SFMono-Regular`, Menlo, monospace.

### 3.3 Color Audit & Hardcoded Variances

| Current Hardcoded Occurrences | Semantic Meaning | Recommended Centralized Token |
|---|---|---|
| `#8b7af7`, `#7465ed`, `#6855d9`, `#7867e9`, `#8876ee`, `#9181f3` | Primary Brand / Accent Indigo | `var(--rp-accent)` (`#6366f1` Dark / `#4f46e5` Light) |
| `#f5f7fb`, `#f8faff`, `#ffffff` | Light Backgrounds & Surfaces | `var(--rp-bg)` (`#f8fafc`), `var(--rp-surface)` (`#ffffff`), `var(--rp-surface-subtle)` (`#f1f5f9`) |
| `#0c1220`, `#131c2c`, `#182336`, `#202d42` | Dark Backgrounds & Surfaces | `var(--rp-bg)` (`#090d16`), `var(--rp-surface)` (`#121826`), `var(--rp-surface-subtle)` (`#182234`) |
| `#e4e9f1`, `#cbd5e1`, `#dadce0` | Light Borders | `var(--rp-border)` (`#e2e8f0`), `var(--rp-border-subtle)` (`#f1f5f9`) |
| `#29364b`, `#1e293b`, `#334155` | Dark Borders | `var(--rp-border)` (`#1e293b`), `var(--rp-border-subtle)` (`#161f30`) |
| `#34c98b`, `#28a66c`, `#10b981`, `#15803d` | Success Green | `var(--rp-success)` (`#10b981` Dark / `#059669` Light) |
| `#ef4444`, `#e46f7a`, `#b91c1c`, `#991b1b` | Error / Critical Red | `var(--rp-danger)` (`#f87171` Dark / `#dc2626` Light) |
| `#f59e0b`, `#d99427`, `#e7a43b`, `#92400e` | Warning Amber | `var(--rp-warning)` (`#fbbf24` Dark / `#d97706` Light) |
| `#4587d7`, `#5c9fe8`, `#2563eb`, `#3b82f6` | Info Blue | `var(--rp-info)` (`#38bdf8` Dark / `#0284c7` Light) |

---

## 4. Accessibility & Usability Findings

1. **Focus Visibility**: Many custom buttons rely on default browser outlines; need high-contrast `:focus-visible` rings (`outline: 2px solid var(--rp-accent); outline-offset: 2px`).
2. **Color Contrast (WCAG 2.2 AA)**:
   - Light mode muted text (`#7b879a` on `#f5f7fb`) measures ~3.8:1, failing AA for normal text. Needs adjustment to `#64748b` (4.6:1).
   - Dark mode muted text (`#91a0b7` on `#131c2c`) is 4.7:1 (passes).
3. **Information Density**: Large whitespace gaps in the main dashboard force excessive scrolling on 1080p laptop displays. Compact cards (padding 14-16px instead of 20-28px) and 40-44px table rows will increase visible data density by ~35%.
4. **Touch Targets**: Compact sidebar icon buttons in 64px mode must maintain at least 36x36px clickable target areas with tooltips.

---

## 5. Audit Conclusion

The application structure is robust and well-modularized. The migration to the Linear-inspired Minimal Enterprise design will be executed systematically by establishing unified CSS custom properties, standardizing components, upgrading typography to Inter/JetBrains Mono, polishing the App Shell (sidebar + topbar), and applying dense, elegant card and table layouts across all views.

