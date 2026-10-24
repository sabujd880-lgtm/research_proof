import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';

/**
 * LaTeX Compiler Worker
 * Provides isolated, secure compilation checking, executing, and graceful fallback.
 */

// Cache compiler availability check result
let cachedCompilerStatus = null;

export function checkCompilerAvailability() {
  if (cachedCompilerStatus !== null) {
    return cachedCompilerStatus;
  }

  const isWindows = process.platform === 'win32';
  const checkCmd = isWindows ? 'where' : 'which';

  let hasLatexmk = false;
  let hasPdflatex = false;
  let hasBiber = false;

  try {
    execSync(`${checkCmd} latexmk`, { stdio: 'ignore', timeout: 3000 });
    hasLatexmk = true;
  } catch {}

  try {
    execSync(`${checkCmd} pdflatex`, { stdio: 'ignore', timeout: 3000 });
    hasPdflatex = true;
  } catch {}

  try {
    execSync(`${checkCmd} biber`, { stdio: 'ignore', timeout: 3000 });
    hasBiber = true;
  } catch {}

  const available = (hasLatexmk || hasPdflatex);
  cachedCompilerStatus = {
    available,
    hasLatexmk,
    hasPdflatex,
    hasBiber,
    engine: hasLatexmk ? 'latexmk' : (hasPdflatex ? 'pdflatex' : 'none')
  };

  return cachedCompilerStatus;
}

/**
 * Attempts secure compilation of a LaTeX project buffer.
 * If TeX tooling is unavailable (standard on Render containers), gracefully returns
 * an explanatory status while preserving the full functionality of the ZIP export.
 */
export async function attemptPdfCompilation(zipBuffer, options = {}) {
  const compiler = checkCompilerAvailability();

  if (!compiler.available) {
    return {
      compiled: false,
      status: 'unavailable',
      message: 'LaTeX compiler (pdflatex/latexmk) is not installed in the current hosting environment (Render Linux container). Complete, compilable APA 7 source and instructions are ready in the ZIP archive.',
      warnings: ['PDF compilation was skipped because no TeX distribution is installed on the host.']
    };
  }

  const timeoutMs = options.timeoutMs || 30000;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-apa7-compile-'));

  try {
    // Unpack ZIP safely to tempDir
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    // Validate entry names to prevent path traversal
    for (const entry of zipEntries) {
      if (entry.entryName.includes('..') || path.isAbsolute(entry.entryName)) {
        throw new Error(`Insecure ZIP entry path detected: ${entry.entryName}`);
      }
    }

    zip.extractAllTo(tempDir, true);

    // Identify project directory inside tempDir
    let workDir = tempDir;
    const subEntries = fs.readdirSync(tempDir);
    if (subEntries.includes('researchproof-apa7-manuscript')) {
      workDir = path.join(tempDir, 'researchproof-apa7-manuscript');
    }

    // Run isolated compilation with no shell escape
    let compileLog = '';
    let success = false;

    if (compiler.hasLatexmk) {
      const result = execSync(
        'latexmk -pdf -interaction=nonstopmode -no-shell-escape -synctex=0 main.tex',
        {
          cwd: workDir,
          timeout: timeoutMs,
          maxBuffer: 5 * 1024 * 1024,
          encoding: 'utf8'
        }
      );
      compileLog = result;
      success = true;
    } else if (compiler.hasPdflatex) {
      // Manual sequence: pdflatex -> biber -> pdflatex
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
          compileLog += `\n[Biber warning]: ${biberErr.message}`;
        }
      }
      success = true;
    }

    const pdfPath = path.join(workDir, 'main.pdf');
    if (fs.existsSync(pdfPath)) {
      const pdfBuffer = fs.readFileSync(pdfPath);

      // Verify PDF file signature (%PDF-)
      const isPdfHeader = pdfBuffer.slice(0, 5).toString('ascii').startsWith('%PDF-');
      if (!isPdfHeader) {
        throw new Error('Generated output is not a valid PDF file.');
      }

      // Add compiled PDF into the ZIP archive under output/manuscript.pdf
      zip.addFile('researchproof-apa7-manuscript/output/manuscript.pdf', pdfBuffer);
      const updatedZipBuffer = zip.toBuffer();

      return {
        compiled: true,
        status: 'compiled',
        pdfBuffer,
        updatedZipBuffer,
        log: compileLog.slice(-2000), // Sanitized trailing log
        message: 'Compilation succeeded! Valid APA 7 PDF produced.'
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
    // Clean up temporary workspace
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
