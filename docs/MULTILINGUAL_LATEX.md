# ResearchProof AI — Multilingual DOCX-to-LaTeX & Unicode Typesetting Guide

ResearchProof AI Phase 5 Addition introduces full **Multilingual DOCX-to-LaTeX conversion**, APA 7 academic formatting, and Unicode PDF generation. This document describes the architecture, supported languages, conversion modes, bidirectional (RTL) handling, font configuration, and Overleaf workflow.

---

## 1. Supported Languages & Scripts Registry

ResearchProof AI provides a configurable language and script registry covering 19 initial languages across 13 major writing systems.

| Language | Native Name | Code | Script | Direction | Polyglossia Name | Recommended Engine | Primary Font Family |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **English** | English | `en` | Latin | LTR | `english` | XeLaTeX / LuaLaTeX | TeX Gyre Termes |
| **Bengali** | বাংলা | `bn` | Bengali | LTR | `bengali` | XeLaTeX | Noto Serif Bengali |
| **Hindi** | हिन्दी | `hi` | Devanagari | LTR | `hindi` | XeLaTeX | Noto Serif Devanagari |
| **Marathi** | मराठी | `mr` | Devanagari | LTR | `marathi` | XeLaTeX | Noto Serif Devanagari |
| **Tamil** | தமிழ் | `ta` | Tamil | LTR | `tamil` | XeLaTeX | Noto Serif Tamil |
| **Telugu** | తెలుగు | `te` | Telugu | LTR | `telugu` | XeLaTeX | Noto Serif Telugu |
| **Malayalam** | മലയാളം | `ml` | Malayalam | LTR | `malayalam` | XeLaTeX | Noto Serif Malayalam |
| **Kannada** | ಕನ್ನಡ | `kn` | Kannada | LTR | `kannada` | XeLaTeX | Noto Serif Kannada |
| **Gujarati** | ગુજરાતી | `gu` | Gujarati | LTR | `gujarati` | XeLaTeX | Noto Serif Gujarati |
| **Punjabi** | ਪੰਜਾਬੀ | `pa` | Gurmukhi | LTR | `punjabi` | XeLaTeX | Noto Serif Gurmukhi |
| **Urdu** | اردو | `ur` | Arabic | RTL | `urdu` | XeLaTeX | Noto Nastaliq Urdu |
| **Arabic** | العربية | `ar` | Arabic | RTL | `arabic` | XeLaTeX / LuaLaTeX | Amiri |
| **French** | Français | `fr` | Latin | LTR | `french` | LuaLaTeX / XeLaTeX | TeX Gyre Termes |
| **German** | Deutsch | `de` | Latin | LTR | `german` | LuaLaTeX / XeLaTeX | TeX Gyre Termes |
| **Spanish** | Español | `es` | Latin | LTR | `spanish` | LuaLaTeX / XeLaTeX | TeX Gyre Termes |
| **Portuguese** | Português | `pt` | Latin | LTR | `portuguese` | LuaLaTeX / XeLaTeX | TeX Gyre Termes |
| **Chinese (Simplified)**| 中文 (简体) | `zh` | Han | LTR | `chinese` | XeLaTeX / LuaLaTeX | Noto Serif CJK SC |
| **Japanese** | 日本語 | `ja` | Kana / Han | LTR | `japanese` | XeLaTeX / LuaLaTeX | Noto Serif CJK JP |
| **Korean** | 한국어 | `ko` | Hangul | LTR | `korean` | XeLaTeX / LuaLaTeX | Noto Serif CJK KR |

Additional languages can be registered dynamically through `server/src/multilingualRegistry.js`.

---

## 2. Document Conversion Modes

The converter provides three specialized modes tailored for academic workflows:

### Mode A — Single Language
- **Purpose**: Converting a manuscript authored entirely in one language.
- **Behavior**: Configures the primary OpenType font and polyglossia package for the selected language. Headings, body text, tables, and references all use the language's native typography.

### Mode B — Mixed Language
- **Purpose**: Manuscripts containing multiple scripts in the same document.
- **Example**: An English academic article quoting Bengali literature (`"ভাষাতত্ত্ব ও যুক্তি"`), Hindi survey responses (`"सर्वेक्षण परिणाम"`), Arabic terms, and mathematical equations.
- **Behavior**: Primary language is set as `\setmainlanguage{...}`. Secondary script runs are automatically detected and wrapped in macro commands (e.g., `\textbengali{...}`, `\textdevanagari{...}`, `\textarabic{...}`) paired with `\newfontfamily` declarations to eliminate missing glyphs or box placeholders.

### Mode C — Language-Preserving Conversion
- **Purpose**: High-fidelity conversion where original text, scripts, and Unicode characters are strictly preserved without automatic translation.
- **Behavior**: All Unicode characters (including diacritics, accents, and punctuation) are preserved verbatim. LaTeX special characters (`&`, `%`, `$`, `#`, `_`, `{`, `}`) are escaped safely while Indic zero-width joiners (`\u200D`) and non-joiners (`\u200C`) remain intact.

---

## 3. Right-to-Left (RTL) & Bidirectional Typography

For Arabic (`ar`) and Urdu (`ur`):
- Preamble declares `\usepackage{bidi}` (under XeLaTeX) or `\usepackage{luabidi}` (under LuaLaTeX).
- Direction is configured as `RTL` while numbers, formulas, and Latin citations (`\parencite`, `\textcite`) maintain proper bidirectional LTR boundaries.
- Arabic typography uses the verified OpenType font **Amiri** with appropriate contextual ligatures.
- Urdu typography uses **Noto Nastaliq Urdu** with cascading fallbacks to **Jameel Noori Nastaleeq** and **Scheherazade New**.

---

## 4. Indic Conjuncts & Zero-Width Control Characters

Bengali, Devanagari, Tamil, and Malayalam scripts rely on:
- **Zero-Width Joiner (ZWJ, `\u200D`)**: Forces conjunct ligatures (e.g. Bengali hasant/ya-phala `ক্‍য`).
- **Zero-Width Non-Joiner (ZWNJ, `\u200C`)**: Suppresses unwanted ligatures to display explicit virama forms.

The LaTeX escaping algorithm explicitly protects ZWJ and ZWNJ characters from normalization or removal, ensuring zero ligature distortion in generated PDF output.

---

## 5. ZIP Archive Package Structure

Every conversion outputs a fully self-contained project archive ready for local compilation or direct drag-and-drop import into Overleaf:

```text
researchproof-multilingual-apa7/
├── main.tex                 # Compilable APA 7 master LaTeX document
├── references.bib           # BibLaTeX bibliography entries
├── README.md                # Compilation instructions & font requirements
├── language-config.json     # Machine-readable script & font metadata
├── conversion-report.json   # Full integrity & conversion audit report
├── latexmkrc                # Automation script configured for XeLaTeX/LuaLaTeX
├── sections/                # Modular section files
│   ├── introduction.tex
│   ├── method.tex
│   ├── results.tex
│   └── discussion.tex
├── figures/                 # Directory for image assets
└── tables/                  # Directory for APA 7 booktabs tables
```

---

## 6. Overleaf One-Click Compilation

To compile in Overleaf:
1. Log in to [Overleaf](https://www.overleaf.com).
2. Click **New Project** → **Upload Project** and select the exported `.zip`.
3. In Overleaf Settings (top-left menu):
   - Set **Compiler** to **XeLaTeX** (or **LuaLaTeX**).
   - Set **TeX Live version** to **2023 or newer**.
4. Click **Recompile**. All Noto and TeX Gyre fonts are pre-installed in Overleaf's TeX Live environment.
