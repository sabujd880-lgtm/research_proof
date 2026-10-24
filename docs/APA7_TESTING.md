# ResearchProof AI — Phase 5: Automated Testing Protocol

## 1. Test Suite Overview

Phase 5 includes comprehensive unit, integration, and security tests located in `server/test/phase5.test.js`.

The test suite runs with native Node.js test runner:
```bash
npm test --prefix server
```

---

## 2. Test Coverage Matrix

| Test # | Category | Description | Verification Method |
|---|---|---|---|
| **1** | Template (Student) | `apa7` with `stu` option, course, instructor, due date | Regex match on generated LaTeX preamble; confirms running head omitted |
| **2** | Template (Professional) | `apa7` with `man` option, short title, author note | Regex match on `\shorttitle`, `\authornote`, `\printbibliography` |
| **3** | Escaping & Math | Text escaping with math preservation | Asserts `15\%`, `\&`, `\#`, `$p < .05$`, `$F(1, 42) = 5.23$`, `$\alpha = .05$` |
| **4** | Headings | Translates all 5 APA 7 heading levels | Verifies `\section`, `\subsection`, `\subsubsection`, `\paragraph`, `\subparagraph` |
| **5** | Bibliography | Formats BibTeX `@book`, `@article` and detects duplicate DOIs | Verifies BibLaTeX field structure and flags duplicate DOI |
| **6** | In-Text Citations | Maps `\parencite` and `\textcite` | Resolves verified keys; preserves unverified citations as plain text with warning |
| **7** | Tables | Produces clean `booktabs` tables | Verifies `\toprule`, `\midrule`, `\bottomrule`, table caption, note, no vertical rules |
| **8** | Project ZIP | Packs all required files into ZIP | Checks magic bytes `PK\x03\x04` and verifies `main.tex`, `references.bib`, `README.md`, `latexmkrc` |
| **9** | Compiler Fallback | Graceful handling when TeX tools are not installed | Validates status `"unavailable"` and explanatory message without crashing |
| **10** | API Schema | `GET /api/latex/templates/apa7` returns template specs | Asserts student and professional options and field definitions |
| **11** | Security | Unauthenticated conversion rejected | Asserts `401 Unauthorized` |
| **12** | E2E Conversion | User converts, inspects report, downloads ZIP, verifies cross-user isolation | Authenticated request creates job; asserts second user receives `403 Forbidden` on job and download |

---

## 3. Results Summary

- Total Test Suites: 4 (Phase 1, Phase 2, Phase 3, Phase 5)
- Total Tests: 58
- Pass: 58 (100%)
- Fail: 0
- Skipped: 0
