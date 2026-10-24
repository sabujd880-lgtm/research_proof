# ResearchProof AI — Phase 5: PDF Compilation Pipeline & Environment Compatibility

## 1. Execution Model

The LaTeX compilation pipeline executes in an isolated environment with sandboxing constraints:

1. **No Shell Escape**: Executed strictly with `-no-shell-escape` to prevent malicious command execution through LaTeX packages (`\write18`).
2. **Resource Boundaries**:
   - Execution timeout: 30 seconds
   - Maximum output buffer: 5 MB
   - Non-root worker execution
3. **Temporary Isolation**: Compilation runs in an ephemeral folder inside `os.tmpdir()` and cleans up completely in a `finally` block.

---

## 2. Compilation Sequence

When a host TeX engine is available, the standard multi-pass sequence is executed:

### Method A: Automated via `latexmk`
```bash
latexmk -pdf -interaction=nonstopmode -no-shell-escape main.tex
```

### Method B: Manual Multi-Pass Sequence
```bash
pdflatex -interaction=nonstopmode -no-shell-escape main.tex
biber main
pdflatex -interaction=nonstopmode -no-shell-escape main.tex
```

---

## 3. Render Cloud Hosting Compatibility

### Problem
Standard cloud containers (such as Render Linux web services) do not include full TeX distributions (`texlive-full` is ~5 GB).

### Solution & Graceful Degradation
1. **Dynamic Environment Check**: `checkCompilerAvailability()` tests for `latexmk` or `pdflatex` on the system PATH.
2. **Transparent Fallback**: If no compiler is found:
   - The conversion process completes 100% successfully.
   - The full, compilable project ZIP is created and ready for immediate download.
   - Status is marked as `"unavailable"` with a clear explanatory notice in the UI and report.
   - The user can compile locally using `latexmk` or upload the ZIP to Overleaf in one click.
   - The system **never falsely claims** a PDF was compiled without a verified `%PDF-` signature.

---

## 4. PDF Output Validation

When compilation executes:
1. Verifies that `main.pdf` exists.
2. Checks the magic header bytes (`%PDF-1.`).
3. Embeds `output/manuscript.pdf` into the downloadable project ZIP.
4. Enables the "Download PDF" button in the frontend.
