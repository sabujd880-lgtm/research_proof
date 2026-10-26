# Unicode Fonts & LaTeX Compilation Engines Guide

This document specifies the font configuration, TeX engine compatibility, operating system installation commands, and compilation sandbox architecture for ResearchProof AI Phase 5.

---

## 1. Engine Comparison & Compatibility Matrix

| Engine | Unicode Support | OpenType Font Loading | Complex Script Shaping (Indic / Arabic) | APA 7 Compatibility | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **XeLaTeX** | Native UTF-8 | Via `fontspec` | Excellent (HarfBuzz shaping engine) | Full | **Recommended** for Indic, Arabic, Urdu, CJK |
| **LuaLaTeX** | Native UTF-8 | Via `fontspec` | Good | Full | **Recommended** for Latin, CJK, French, German |
| **pdfLaTeX** | 8-bit only | Legacy T1 encodings | Not supported (fails on complex Unicode) | Full (Latin only) | Restricted to pure ASCII/Latin documents |

---

## 2. Recommended OpenType Fonts by Script

All recommended fonts are open-source and free for academic and commercial use (SIL Open Font License or Apache 2.0).

- **Latin (English, French, German, Spanish, Portuguese)**: TeX Gyre Termes, Times New Roman, FreeSerif
- **Bengali**: Noto Serif Bengali, Kalpurush, SolaimanLipi
- **Devanagari (Hindi, Marathi)**: Noto Serif Devanagari, Lohit Devanagari, Gargi
- **Tamil**: Noto Serif Tamil, Lohit Tamil
- **Telugu**: Noto Serif Telugu, Lohit Telugu
- **Malayalam**: Noto Serif Malayalam, Rachana, Meera
- **Kannada**: Noto Serif Kannada, Lohit Kannada
- **Gujarati**: Noto Serif Gujarati, Lohit Gujarati
- **Punjabi (Gurmukhi)**: Noto Serif Gurmukhi, Lohit Gurmukhi
- **Arabic**: Amiri, Scheherazade New, Noto Naskh Arabic
- **Urdu**: Noto Nastaliq Urdu, Jameel Noori Nastaleeq
- **Chinese (Simplified)**: Noto Serif CJK SC, Source Han Serif SC
- **Japanese**: Noto Serif CJK JP, Source Han Serif JP
- **Korean**: Noto Serif CJK KR, Source Han Serif KR

---

## 3. Font Installation Instructions

### Ubuntu / Debian Server
```bash
sudo apt-get update
sudo apt-get install -y \
  fonts-noto-core \
  fonts-noto-cjk \
  fonts-noto-extra \
  fonts-noto-ui-core \
  fonts-sil-amiri \
  fonts-texgyre \
  texlive-xetex \
  texlive-luatex \
  texlive-publishers \
  texlive-bibtex-extra \
  biber
```

### macOS (Homebrew)
```bash
brew install --cask mactex-no-gui
brew tap homebrew/cask-fonts
brew install --cask \
  font-noto-serif \
  font-noto-serif-bengali \
  font-noto-serif-devanagari \
  font-noto-serif-cjk \
  font-amiri
```

### Windows (Chocolatey / Manual)
```powershell
choco install miktex -y
# Fonts can be installed by downloading Google Noto Fonts and right-clicking "Install for all users"
```

---

## 4. Secure Isolated PDF Compilation Architecture

When PDF compilation is executed on host servers:
1. **Isolated Working Directory**: Each job creates a unique temporary directory inside `os.tmpdir()/rp_compile_<uuid>`.
2. **Restricted TeX Execution Flags**:
   - `-no-shell-escape`: Strictly disables shell escape to prevent arbitrary command execution from malicious LaTeX code.
   - `-interaction=nonstopmode`: Prevents TeX from hanging on prompt inputs.
3. **Resource & Timeout Guardrails**:
   - Execution timeout enforced at 30 seconds.
   - Memory and CPU limits governed by child process isolation.
4. **Deterministic Cleanup**:
   - Temporary directories and auxiliary files (`.aux`, `.bbl`, `.blg`, `.log`, `.out`, `.toc`) are wiped in a `finally` block regardless of compilation outcome.
5. **Graceful Cloud Fallback**:
   - If the container environment (e.g. Render standard free tier) lacks TeX binaries, the system records compilation status as `"unavailable"`, packages full compilable sources into the ZIP archive, and provides clear diagnostic messages to the researcher.
