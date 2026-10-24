# ResearchProof AI — Research Integrity Reporting Engine

## 1. Overview
The Research Integrity Reporting Engine (`server/src/integrityService.js`) provides automated, multi-dimensional diagnostic auditing of scientific manuscripts before submission to peer-reviewed journals.

## 2. Analyzed Scientific Dimensions

### 2.1 Writing Quality & Cognitive Flow
- **Excessive Sentence Length**: Evaluates individual sentences using an academic abbreviation-aware sentence splitter (accounting for *et al.*, *i.e.*, *e.g.*, *Fig.*, *vs.*). Sentences exceeding 35 words are flagged with exact word counts to reduce cognitive strain.
- **Lexical Repetition**: Measures keyword density and flags over-concentrated disciplinary vocabulary.

### 2.2 Meaning Preservation Verification
- Compares revised manuscripts against baseline text.
- Deterministically flags inverted negations (e.g. dropping "not" next to "statistically significant"), altered sample sizes ($n$), modified $p$-values, confidence intervals, effect sizes, and altered measurement units.

### 2.3 Citation & Reference Integrity
- Automatically parses in-text citation patterns (`(Author, Year)` and `[#]`).
- Flags in-text citation markers that lack a corresponding bibliographic entry in the project citation library.
- Flags reference library entries that are never cited in the manuscript text.

### 2.4 Document & Acronym Consistency
- Tracks uppercase acronyms (3–6 characters, e.g. CRISPR, fMRI, LLM) and identifies acronyms introduced without initial parenthetical expansions.
- Validates paragraph duplication and structural section flow.

### 2.5 Similarity Heuristics
- Identifies verbatim repeated passages and duplicated paragraphs inside the manuscript.
- **Academic Disclaimer**: Transparently labeled as internal heuristic indicators. The engine explicitly notes that internal repetition checks do not query proprietary external databases and do not guarantee Turnitin similarity percentages.

---

## 3. Severity Classification
- `high_priority_review`: Finding reversals, missing bibliographic references for cited claims, or verbatim paragraph duplications.
- `review_recommended`: Sentences exceeding 35 words, uncited bibliography entries, or complex sentence phrasing.
- `informational`: Undefined initial acronyms or high lexical concentrations.

---

## 4. Multi-Format Report Export
- **JSON Export**: Complete structured JSON output including check coverage and summary metrics.
- **DOCX Generation**: Formatted Office Open XML (`.docx`) report created on-demand via the `docx` library with title headers, metadata tables, severity-colored finding callouts, and scientific scope limitations.
