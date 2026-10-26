import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';

/**
 * Unicode LaTeX Compiler Worker
 * Supports isolated execution with XeLaTeX, LuaLaTeX, pdfLaTeX, and latexmk.
 * Provides graceful fallback and detailed diagnostics for cloud deployment (Render/Vercel).
 */

let cachedCompilerStatus = null;

export function checkCompilerAvailability() {
  if (cachedCompilerStatus !== null) {
    return cachedCompilerStatus;
  }

  const isWindows = process.platform === 'win32';
  const checkCmd = isWindows ? 'where' : 'which';

  let hasLatexmk = false;
  let hasXelatex = false;
  let hasLualatex = false;
  let hasPdflatex = false;
  let hasBiber = false;

  try {
    execSync(`${checkCmd} latexmk`, { stdio: 'ignore', timeout: 3000 });
    hasLatexmk = true;
  } catch {}

  try {
    execSync(`${checkCmd} xelatex`, { stdio: 'ignore', timeout: 3000 });
    hasXelatex = true;
  } catch {}

  try {
    execSync(`${checkCmd} lualatex`, { stdio: 'ignore', timeout: 3000 });
    hasLualatex = true;
  } catch {}

  try {
    execSync(`${checkCmd} pdflatex`, { stdio: 'ignore', timeout: 3000 });
    hasPdflatex = true;
  } catch {}

  try {
    execSync(`${checkCmd} biber`, { stdio: 'ignore', timeout: 3000 });
    hasBiber = true;
  } catch {}

  const available = (hasLatexmk || hasXelatex || hasLualatex || hasPdflatex);
  cachedCompilerStatus = {
    available,
    hasLatexmk,
    hasXelatex,
    hasLualatex,
    hasPdflatex,
    hasBiber,
    recommendedEngine: hasXelatex ? 'xelatex' : (hasLualatex ? 'lualatex' : (hasLatexmk ? 'latexmk' : (hasPdflatex ? 'pdflatex' : 'none')))
  };

  return cachedCompilerStatus;
}

/**
 * Attempts isolated compilation of a LaTeX manuscript project buffer.
 * If TeX tooling is unavailable on host, gracefully returns diagnostic information
 * and preserves 100% functionality of the multi-file ZIP archive export.
 */
export async function attemptPdfCompilation(zipBuffer, options = {}) {
  const compiler = checkCompilerAvailability();
  const requestedEngine = (options.engine || 'auto').toLowerCase();

  // If host environment has no TeX binaries installed
  if (!compiler.available) {
    const isUnicodeReq = requestedEngine === 'xelatex' || requestedEngine === 'lualatex';
    return {
      compiled: false,
      status: 'unavailable',
      message: isUnicodeReq
        ? 'Unicode LaTeX compiler (XeLaTeX / LuaLaTeX) is not installed on the current host. The ZIP package includes complete XeLaTeX sources, fontspec declarations, and language-config.json ready for local or Overleaf compilation.'
        : 'LaTeX compiler (pdflatex/latexmk) is not installed in the current hosting environment (Render container). Complete compilable source files and instructions are ready in the downloadable ZIP.',
      warnings: ['PDF compilation was skipped because no TeX distribution is installed on the host.']
    };
  }

  const timeoutMs = options.timeoutMs || 30000;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-apa7-compile-'));

  try {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    // Security check: validate entry names to prevent path traversal
    for (const entry of zipEntries) {
      if (entry.entryName.includes('..') || path.isAbsolute(entry.entryName)) {
        throw new Error(`Insecure ZIP entry path detected: ${entry.entryName}`);
      }
    }

    zip.extractAllTo(tempDir, true);

    // Identify project root directory inside tempDir
    let workDir = tempDir;
    const subEntries = fs.readdirSync(tempDir);
    const knownDirs = ['researchproof-multilingual-apa7', 'researchproof-apa7-manuscript'];
    for (const kd of knownDirs) {
      if (subEntries.includes(kd)) {
        workDir = path.join(tempDir, kd);
        break;
      }
    }

    let compileLog = '';
    let success = false;

    // Determine engine command
    const useXelatex = requestedEngine === 'xelatex' && compiler.hasXelatex;
    const useLualatex = requestedEngine === 'lualatex' && compiler.hasLualatex;

    if (compiler.hasLatexmk) {
      let latexmkFlag = '-pdf';
      if (useXelatex) latexmkFlag = '-pdfxe';
      else if (useLualatex) latexmkFlag = '-pdflua';

      compileLog = execSync(
        `latexmk ${latexmkFlag} -interaction=nonstopmode -no-shell-escape -synctex=0 main.tex`,
        {
          cwd: workDir,
          timeout: timeoutMs,
          maxBuffer: 5 * 1024 * 1024,
          encoding: 'utf8'
        }
      );
      success = true;
    } else if (useXelatex) {
      compileLog += execSync('xelatex -interaction=nonstopmode -no-shell-escape main.tex', {
        cwd: workDir,
        timeout: timeoutMs,
        encoding: 'utf8'
      });
      if (compiler.hasBiber && fs.existsSync(path.join(workDir, 'main.bcf'))) {
        try {
          compileLog += execSync('biber main', { cwd: workDir, timeout: timeoutMs, encoding: 'utf8' });
          compileLog += execSync('xelatex -interaction=nonstopmode -no-shell-escape main.tex', {
            cwd: workDir,
            timeout: timeoutMs,
            encoding: 'utf8'
          });
        } catch (biberErr) {
          compileLog += `\n[Biber notice]: ${biberErr.message}`;
        }
      }
      success = true;
    } else if (useLualatex) {
      compileLog += execSync('lualatex -interaction=nonstopmode -no-shell-escape main.tex', {
        cwd: workDir,
        timeout: timeoutMs,
        encoding: 'utf8'
      });
      if (compiler.hasBiber && fs.existsSync(path.join(workDir, 'main.bcf'))) {
        try {
          compileLog += execSync('biber main', { cwd: workDir, timeout: timeoutMs, encoding: 'utf8' });
          compileLog += execSync('lualatex -interaction=nonstopmode -no-shell-escape main.tex', {
            cwd: workDir,
            timeout: timeoutMs,
            encoding: 'utf8'
          });
        } catch (biberErr) {
          compileLog += `\n[Biber notice]: ${biberErr.message}`;
        }
      }
      success = true;
    } else if (compiler.hasPdflatex) {
      compileLog += execSync('pdflatex -interaction=nonstopmode -no-shell-escape main.tex', {
        cwd: workDir,
        timeout: timeoutMs,
        encoding: 'utf8'
      });
      if (compiler.hasBiber && fs.existsSync(path.join(workDir, 'main.bcf'))) {
        try {
          compileLog += execSync('biber main', { cwd: workDir, timeout: timeoutMs, encoding: 'utf8' });
          compileLog += execSync('pdflatex -interaction=nonstopmode -no-shell-escape main.tex', {
            cwd: workDir,
            timeout: timeoutMs,
            encoding: 'utf8'
          });
        } catch (biberErr) {
          compileLog += `\n[Biber notice]: ${biberErr.message}`;
        }
      }
      success = true;
    }

    const pdfPath = path.join(workDir, 'main.pdf');
    if (fs.existsSync(pdfPath)) {
      const pdfBuffer = fs.readFileSync(pdfPath);

      // Verify PDF magic header (%PDF-)
      const isPdfHeader = pdfBuffer.slice(0, 5).toString('ascii').startsWith('%PDF-');
      if (!isPdfHeader) {
        throw new Error('Compilation output file is not a valid PDF.');
      }

      // Add compiled PDF into the ZIP archive under output/manuscript.pdf
      const zipOutputDir = subEntries.includes('researchproof-multilingual-apa7')
        ? 'researchproof-multilingual-apa7/output/manuscript.pdf'
        : 'researchproof-apa7-manuscript/output/manuscript.pdf';
      zip.addFile(zipOutputDir, pdfBuffer);
      const updatedZipBuffer = zip.toBuffer();

      return {
        compiled: true,
        status: 'compiled',
        pdfBuffer,
        updatedZipBuffer,
        log: compileLog.slice(-2000),
        message: 'Compilation succeeded! High-fidelity PDF manuscript generated.'
      };
    } else {
      return {
        compiled: false,
        status: 'failed',
        message: 'Compilation process completed but main.pdf was not produced.',
        log: compileLog.slice(-2000)
      };
    }
  } catch (err) {
    return {
      compiled: false,
      status: 'failed',
      message: `Compilation failed: ${err.message}`,
      log: (err.stdout || err.message || '').toString().slice(-2000)
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
