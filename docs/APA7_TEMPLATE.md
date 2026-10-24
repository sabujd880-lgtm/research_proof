# ResearchProof AI — Phase 5: APA 7 Template Specification

## 1. Overview

ResearchProof AI Phase 5 provides native LaTeX export adhering to the **American Psychological Association (APA) 7th Edition** guidelines. The system leverages the official `apa7` document class to produce publication-grade manuscripts.

Two distinct formats are supported:
1. **APA 7 Student Paper (`stu`)**
2. **APA 7 Professional Manuscript (`man`)**

---

## 2. APA 7 Student Paper (`\documentclass[stu,12pt]{apa7}`)

The Student Paper format is designed for undergraduate and graduate course assignments, dissertations, and student theses where running heads and author notes are not required.

### Supported Title Page Elements
- **Paper Title**: Bold, centered, title case (`\title{...}`)
- **Author Name(s)**: Centered below title (`\author{...}`)
- **Institutional Affiliation**: University/Department (`\affiliation{...}`)
- **Course Name and Number**: (`\course{...}`, e.g., `PSY 301: Research Methods`)
- **Instructor / Professor Name**: (`\professor{...}`, e.g., `Dr. Eleanor Vance`)
- **Assignment Due Date**: (`\duedate{...}`, e.g., `October 24, 2026`)
- **Running Head**: **Omitted by default** in accordance with APA 7 student guidelines.
- **Abstract & Keywords**: Optional for student assignments; included when provided.

### LaTeX Preamble Structure
```latex
\documentclass[stu,12pt]{apa7}

\usepackage[american]{babel}
\usepackage{csquotes}
\usepackage{amsmath}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{hyperref}
\usepackage[style=apa,backend=biber]{biblatex}

\addbibresource{references.bib}

\title{Cognitive Load and Working Memory in Academic Writing}
\author{Alex Rivera}
\affiliation{Department of Psychology, Stanford University}
\course{PSY 301: Cognitive Psychology}
\professor{Dr. Eleanor Vance}
\duedate{October 24, 2026}

\begin{document}
\maketitle

\section{Introduction}
...
\printbibliography
\end{document}
```

---

## 3. APA 7 Professional Manuscript (`\documentclass[man,12pt]{apa7}`)

The Professional Manuscript format is designed for scholarly journal submissions, clinical trial reports, and peer-reviewed articles.

### Supported Title Page Elements
- **Running Head**: Declared via `\shorttitle{...}` in all-caps, truncated to 50 characters maximum. Appears in page header alongside page numbers.
- **Paper Title**: Bold, centered, title case (`\title{...}`)
- **Author Names & Affiliations**: Supporting multiple authors and institutions using `\and` separators.
- **Author Note**: Declared via `\authornote{...}`, containing disclosures, conflict-of-interest statements, and correspondence contact information.
- **Abstract**: Required, formatted with `\abstract{...}`.
- **Keywords**: Formatted with `\keywords{...}`.

### LaTeX Preamble Structure
```latex
\documentclass[man,12pt]{apa7}

\usepackage[american]{babel}
\usepackage{csquotes}
\usepackage{amsmath}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{hyperref}
\usepackage[style=apa,backend=biber]{biblatex}

\addbibresource{references.bib}

\title{Neural Correlates of Working Memory Under Time Pressure}
\shorttitle{WORKING MEMORY UNDER TIME PRESSURE}
\author{Dr. Jane Smith \and Dr. John Doe}
\affiliation{Harvard University \and Massachusetts Institute of Technology}
\authornote{Correspondence concerning this article should be addressed to Dr. Jane Smith.}

\abstract{This study evaluates working memory performance under acute time pressure.}
\keywords{working memory, cognitive load, fMRI, decision making}

\begin{document}
\maketitle

\section{Introduction}
...
\printbibliography
\end{document}
```

---

## 4. Shared Formatting Rules

- **Paper Size & Margins**: Letter-size (8.5 × 11 inches) with 1-inch margins on all sides.
- **Double Spacing**: Applied automatically to the entire manuscript by `apa7`.
- **Page Numbering**: Top-right corner starting from page 1.
- **Font**: 12pt standard font family configured by the TeX engine.
- **Mathematical / Statistical Formatting**: Math mode `$p < .05$`, `$\alpha = .05$`, `$F(1, 42) = 5.23$` preserved in italics according to APA 7 statistical reporting standards.
