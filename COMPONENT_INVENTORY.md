# ResearchProof AI 1.0 — Component Inventory & Modernization Catalog

**Catalog Date**: October 29, 2026  
**Design Paradigm**: Linear-Inspired Minimal Enterprise Academic SaaS  
**Status**: 100% Implemented & Verified  

---

## 1. Core Shell Components

| Component | Selector / Key | Dimensions | State / Behavior | Theme Support |
|---|---|---|---|---|
| **Expanded Sidebar** | `.sidebar` | Width: `248px` | Vertical nav with 5 grouped accordions (`WORKSPACE`, `RESEARCH`, `PUBLISHING`, `COLLABORATION`, `SYSTEM`). Smooth transition on collapse. | Full Light & Dark |
| **Collapsed Sidebar** | `.sidebar.compact` | Width: `64px` | Icons-only compact mode with tooltip labels and centered 18px icons. Toggled via `Ctrl+B` or topbar button. | Full Light & Dark |
| **Mobile Drawer** | `.sidebar.mobile-open`, `.sidebar-backdrop` | Width: `260px` | Overlay drawer for viewports `< 768px` with 240ms cubic bezier animation and 4px blurred backdrop. | Full Light & Dark |
| **Linear Topbar** | `.topbar` | Height: `56px` | Compact header with breadcrumbs (`Workspace / [Section]`), project context switcher dropdown, stage pill, and `Ctrl+K` trigger. | Full Light & Dark |
| **Command Palette** | `.rp-cmd-backdrop`, `.rp-cmd-dialog` | Width: `560px` max | Omnipresent keyboard modal (`Ctrl+K` / `⌘K`) indexing all navigation views, active projects, and instant actions. | Full Light & Dark |

---

## 2. Reusable Design System Primitives

| Primitive | CSS Class | Target Usage | Properties & Behavior |
|---|---|---|---|
| **Metric Card** | `.rp-metric-card` | Dashboard, Stats, Overview | Subtle 1px border (`var(--rp-border)`), 11px uppercase label, 22px bold figure, 11px muted note. |
| **Data Table** | `.rp-table-wrap`, `.rp-table` | References, Literature, Tasks, Logs | 36px uppercase sticky header, 42px compact rows, subtle hover fill (`var(--rp-surface-subtle)`). |
| **Primary Button** | `.btn-primary`, `.primary` | Major actions (Save, Submit, Export) | Background: `var(--rp-accent)`, text: `#ffffff`, padding: `6px 14px`, radius: `6px`. |
| **Secondary Button** | `.btn-secondary`, `.secondary` | Auxiliary actions (Cancel, Filter, Manage) | Background: `var(--rp-surface)`, border: `1px solid var(--rp-border)`, color: `var(--rp-text)`. |
| **Small Button** | `.btn-sm`, `.small` | Table row actions, matrix buttons | Height: `28px`, padding: `4px 10px`, font-size: `11px`. |
| **Status Badge** | `.rp-badge`, `.rp-badge-accent`, `.rp-badge-success` | Stage tags, verification states | Pill shape (radius `12px`), 10.5px bold, WCAG AA compliant subtle tint. |
| **Header Search Trigger** | `.rp-header-search-btn` | Top header | 12px muted button with search icon and monospace `<kbd>Ctrl+K</kbd>` badge. |
| **Project Switcher** | `.topbar-project-select` | Global header | Minimalist dropdown selecting active project across all 8 research modules. |

---

## 3. Academic Research Modules Catalog

### 3.1 Literature Review Studio (`LiteratureReview.tsx`)
- **Matrix View**: Structured comparative table indexing study title, authors, publication year, methodology, sample size ($N$), empirical findings, and thematic tags.
- **Synthesis Engine**: Markdown synthesis draft generator with study counts and 1-click export to Writing Studio.
- **Filter Controls**: Search input with theme tags pills (`All`, methodology filter).

### 3.2 Statistical Analysis Studio (`StatisticalAnalysis.tsx`)
- **Active Dataset Card**: Displays dataset name, observation count ($N$), variable count, and numeric/categorical classification.
- **Statistical Tests**: Pure JavaScript deterministic compute for:
  - Descriptive metrics (Mean, Median, SD, Variance, Min, Max, Skewness, Kurtosis).
  - Independent & Paired Samples $t$-tests ($t$, $df$, $p$-value, Cohen's $d$).
  - One-Way ANOVA ($F$, between/within $df$, $p$-value, $\eta^2$).
  - Pearson's $r$ Correlation ($r$, $t$, $p$-value, $R^2$).
  - Simple Linear Regression (Slope $\beta$, Intercept $\alpha$, $R^2$, $F$, $p$-value).
- **APA 7 Narrative**: Auto-generated scholarly findings block with copy and "Send to Studio" actions.

### 3.3 PDF Research Chat (`PdfResearchChat.tsx`)
- **Passage Explorer**: Displays exact grounded passages extracted from indexed PDF pages with relevance scores.
- **Grounded Chat**: Conversational interface with citation badges that link directly to source page numbers.
- **Zero Hallucination Guarantee**: Strict BM25 page chunking and deterministic passage retrieval.

### 3.4 Systematic Reviews Studio (`SystematicReviews.tsx`)
- **PRISMA 2020 Pipeline**: 4 distinct flow cards (Identification, Screening, Eligibility, Included).
- **Study Screening Actions**: Include, Exclude (with predefined reason dropdown), or Flag for Dual Review.
- **PRISMA Flow Metrics**: Live count updates for PRISMA flowchart generation.

### 3.5 Journal Submission Studio (`JournalSubmission.tsx`)
- **Aims & Scope Matching**: Matches manuscript abstracts against target journal guidelines.
- **Readiness Score Meter**: Multi-point checklist evaluating word count, citation count, abstract length, and declarations.
- **Cover Letter Generator**: Formats formal editorial cover letters with manuscript metadata.

### 3.6 Research Collaboration (`ResearchCollaboration.tsx`)
- **Co-Author Roles**: Role badges (Lead Author, Co-Author, Peer Reviewer, Observer) with distinct permission levels.
- **Milestone Task Board**: Compact Kanban board tracking research milestones (To Do, In Progress, Review, Completed).
- **Discussion Thread**: Context-linked comments on specific manuscript sections.

### 3.7 Writing Studio & Document Studio (`App.tsx`, `DocumentStudio.tsx`)
- **3-Column Workspace**: Document navigator (left), distraction-free manuscript editor (center), and research inspector tabs (right).
- **QuillBot Paraphraser Suite**: Modes for Standard, Fluency, Formal, Academic, Expand, and Shorten.
- **TextGuard Plagiarism Studio**: Similarity score gauge, color-coded matched passages, source drawer, and originality certificates.
- **Document Export**: Office Open XML (.docx) with embedded references and Overleaf-ready LaTeX (.zip) bundles.
