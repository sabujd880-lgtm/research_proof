# ResearchProof AI — Meaning-Preserving Academic Rewriting

## 1. Philosophical Principle: Research Integrity First

ResearchProof AI adheres to strict academic integrity guidelines:
- **Never Alter Scientific Meaning:** Rewriting focuses strictly on grammar, syntactic structure, clarity, flow, and scholarly tone.
- **Never Invert Claims:** Findings must never be turned from negative to affirmative or vice versa.
- **Never Fabricate Data:** No synthetic facts, citations, or statistical values are ever introduced.
- **Human in the Loop:** Revisions are presented as non-destructive proposals. The author retains final editorial responsibility.

---

## 2. Supported Rewriting Modes

| Mode ID | Display Name | Core Objective |
| :--- | :--- | :--- |
| `academic-clarity` | Academic clarity | Eliminates convoluted clauses and ambiguity while preserving all technical terminology. |
| `grammar-correction` | Grammar correction | Surgically corrects syntax, subject-verb agreement, and punctuation without restructuring. |
| `concise-academic` | Concise academic writing | Removes scholarly circumlocutions, tautologies, and nominalizations to increase information density. |
| `formal-scientific` | Formal scientific tone | Elevates informal phrasing to objective, peer-reviewed academic prose. |
| `readability-improvement` | Readability improvement | Balances sentence lengths to reduce cognitive load across diverse academic readers. |
| `paragraph-restructure` | Paragraph restructuring | Optimizes hierarchy with clear topic sentences, evidentiary backing, and transitional cues. |
| `thesis-dissertation` | Thesis / dissertation writing | Enhances methodological thoroughness and comprehensive scholarly context for committees. |
| `journal-manuscript` | Journal manuscript editing | Formats punchy, impactful prose complying with leading journal conventions (Nature, IEEE, Cell). |

---

## 3. Deterministic Meaning-Preservation Engine

Every rewrite is passed through `auditMeaningPreservation(original, revised)` in `server/src/meaningChecker.js`:

### A. Negation Polarity Verification
- Evaluates negation triggers (`not`, `no`, `never`, `failed to`, `lacked`, `absence of`, etc.) against empirical claim terms (`significant`, `demonstrated`, `correlation`, `replicated`).
- **Critical Warning Example:**
  - *Original:* "The drug did not demonstrate a significant effect."
  - *Proposal:* "The drug demonstrated a significant effect."
  - *Warning:* Flagged as `critical: negation` ("Negation removed: original contained negative assertion linked to research claims. This risks inverting empirical results.").

### B. Statistical Values Preservation
- Extracts p-values (`p < 0.05`, `p = 0.003`), sample sizes (`n = 150`, `N = 2,400`), confidence intervals (`95% CI [1.2, 3.4]`), and effect sizes (`d = 0.65`).
- Any modified or omitted statistical value triggers a `critical: statistic` alert.

### C. Citation Marker Preservation
- Preserves bracketed citations (`[1]`, `[2, 3]`) and author-year markers (`(Smith et al., 2020)`).
- Alerts authors if citations are lost or relocated ambiguously.

### D. Units & Direct Quotations
- Checks that measurement units (`mg/dL`, `μm`, `°C`, `kPa`) and direct quotations remain verbatim.

---

## 4. Provider Architecture & AI Unavailable Behavior

The rewriting service (`server/src/services.js`) supports:
1. **Google Gemini:** Native JSON generation via `v1beta/models/{model}:generateContent`.
2. **OpenAI-Compatible APIs:** Groq, OpenRouter, ReverseGPT, or local models.
3. **Graceful 503 Service Unavailable:**
   - If no AI provider key is configured, non-AI features (writing assessments, citation lookups, DOCX import/export, manual editing) remain 100% operational.
   - Rewriting returns `503 Service Unavailable` with `AI_UNAVAILABLE`.
   - **Zero usage quota is consumed** for failed or unavailable provider calls.
