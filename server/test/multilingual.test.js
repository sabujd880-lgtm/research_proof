import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import AdmZip from 'adm-zip';
import { app } from '../src/index.js';
import {
  LANGUAGE_REGISTRY,
  SCRIPT_DEFINITIONS,
  detectScripts,
  resolveDocumentLanguage,
  wrapMixedLanguageSegments,
  generateUnicodePreamble
} from '../src/multilingualRegistry.js';
import {
  escapeLatex,
  convertToApa7Project,
  generateApa7MainTex
} from '../src/apa7Converter.js';
import { checkCompilerAvailability, attemptPdfCompilation } from '../src/latexCompiler.js';

let server;
let baseUrl = '';

test.before(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

// Helper for HTTP requests
async function makeRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, options);
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else if (contentType.includes('application/zip') || contentType.includes('application/pdf')) {
    const arrayBuffer = await res.arrayBuffer();
    body = Buffer.from(arrayBuffer);
  } else {
    body = await res.text();
  }
  return { status: res.status, headers: res.headers, body };
}

// Helper to register and sign in test user
async function getAuthToken() {
  const email = `polyglot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@researchproof.test`;
  const registerRes = await makeRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SecurePassword123!', displayName: 'Polyglot Researcher' })
  });
  return registerRes.body.token;
}

test('ResearchProof AI — Phase 5 Addition: Multilingual LaTeX & Unicode Suite', async (t) => {

  // 1. Language Registry Verification
  await t.test('1. Registry contains all 19 required initial languages with valid fonts and engines', () => {
    const requiredCodes = [
      'en', 'bn', 'hi', 'ta', 'te', 'ml', 'kn', 'mr', 'gu', 'pa',
      'ur', 'ar', 'fr', 'de', 'es', 'pt', 'zh', 'ja', 'ko'
    ];
    for (const code of requiredCodes) {
      const lang = LANGUAGE_REGISTRY[code];
      assert.ok(lang, `Language registry must contain '${code}'`);
      assert.ok(lang.name, `Language '${code}' must have an English name`);
      assert.ok(lang.nativeName, `Language '${code}' must have a native name`);
      assert.ok(lang.font, `Language '${code}' must have a default primary font`);
      assert.ok(Array.isArray(lang.supportedEngines), `Language '${code}' must list supported engines`);
      assert.ok(lang.supportedEngines.includes('xelatex') || lang.supportedEngines.includes('lualatex'),
        `Language '${code}' must support at least xelatex or lualatex`);
    }
  });

  // 2. Deterministic Script Detection
  await t.test('2. Deterministic Unicode script detection correctly identifies diverse writing systems', () => {
    // Bengali
    const bnText = 'প্রাকৃতিক ভাষা প্রক্রিয়াকরণ এবং কৃত্রিম বুদ্ধিমত্তা গবেষণার ফলাফল।';
    const bnResult = detectScripts(bnText);
    assert.equal(bnResult.primaryScript, 'Bengali');
    assert.ok(bnResult.distribution.Bengali.percentage > 70);

    // Devanagari (Hindi)
    const hiText = 'प्राकृतिक भाषा संसाधन और संज्ञानात्मक विज्ञान में अनुसंधान।';
    const hiResult = detectScripts(hiText);
    assert.equal(hiResult.primaryScript, 'Devanagari');
    assert.ok(hiResult.distribution.Devanagari.percentage > 70);

    // Tamil
    const taText = 'இயற்கை மொழி செயலாக்கம் மற்றும் செயற்கை நுண்ணறிவு ஆய்வு.';
    const taResult = detectScripts(taText);
    assert.equal(taResult.primaryScript, 'Tamil');

    // Telugu
    const teText = 'సహజ భాషా ప్రాసెసింగ్ మరియు కృత్రిమ మేధస్సు పరిశోధన.';
    const teResult = detectScripts(teText);
    assert.equal(teResult.primaryScript, 'Telugu');

    // Arabic
    const arText = 'معالجة اللغات الطبيعية والذكاء الاصطناعي في البحث الأكاديمي.';
    const arResult = detectScripts(arText);
    assert.equal(arResult.primaryScript, 'Arabic');

    // Han (Chinese)
    const zhText = '自然语言处理与认知科学研究在高等教育中的应用与评估。';
    const zhResult = detectScripts(zhText);
    assert.equal(zhResult.primaryScript, 'Han');

    // Hangul (Korean)
    const koText = '자연어 처리 및 인공지능 연구의 학술적 영향력 평가.';
    const koResult = detectScripts(koText);
    assert.equal(koResult.primaryScript, 'Hangul');
  });

  // 3. Mixed Script Detection and Character Preservation
  await t.test('3. Detects mixed-script text and flags multi-script distribution without losing characters', () => {
    const mixedText = 'This empirical study analyzes Bengali quotations (যেমন: "ভাষাতত্ত্ব ও যুক্তি") and Hindi responses (जैसे: "सर्वेक्षण परिणाम") with math $E = mc^2$.';
    const detected = detectScripts(mixedText);
    assert.equal(detected.isMixedScript, true);
    assert.ok(detected.detectedScripts.includes('Latin'));
    assert.ok(detected.detectedScripts.includes('Bengali'));
    assert.ok(detected.detectedScripts.includes('Devanagari'));
    assert.equal(detected.primaryScript, 'Latin');
  });

  // 4. Zero-Width Joiner (ZWJ) and Zero-Width Non-Joiner (ZWNJ) Preservation
  await t.test('4. Escaping preserves Indic conjunct control characters (ZWJ \u200D and ZWNJ \u200C)', () => {
    // Bengali hasant conjunct: ক্ + ZWJ + য
    const bengaliZwj = 'যুক্তাক্ষর ক্\u200Dয এবং র\u200D্য';
    const escapedBengali = escapeLatex(bengaliZwj);
    assert.ok(escapedBengali.includes('\u200D'), 'ZWJ must not be stripped from Indic text');

    // Malayalam chillu or Tamil ligature with ZWNJ
    const malayalamZwnj = 'പ\u200Cപ്';
    const escapedMalayalam = escapeLatex(malayalamZwnj);
    assert.ok(escapedMalayalam.includes('\u200C'), 'ZWNJ must not be stripped from Indic text');

    // Normal LaTeX special characters should still be escaped
    const mixedSpecial = 'Test & 50% score with বাংলা \u200D text';
    const escapedMixed = escapeLatex(mixedSpecial);
    assert.ok(escapedMixed.includes('\\&'), 'Ampersand must be escaped');
    assert.ok(escapedMixed.includes('\\%'), 'Percent must be escaped');
    assert.ok(escapedMixed.includes('বাংলা'), 'Bengali script must remain intact');
  });

  // 5. Mixed-Language Wrapping (Mode B)
  await t.test('5. Mode B wraps secondary script segments in font-switching macros', () => {
    const text = 'Participants stated "আমি প্রতিদিন পড়তে ভালোবাসি" during the interview session.';
    const wrapped = wrapMixedLanguageSegments(text, 'en');
    assert.ok(wrapped.includes('\\textbengali{আমি প্রতিদিন পড়তে ভালোবাসি}'),
      'Secondary Bengali segment should be wrapped in \\textbengali{...}');
    assert.ok(wrapped.includes('Participants stated'), 'English text should remain unwrapped');
  });

  // 6. Right-to-Left (RTL) Support for Arabic and Urdu
  await t.test('6. Arabic and Urdu trigger RTL polyglossia or bidi declarations', () => {
    const arPreamble = generateUnicodePreamble({
      code: 'ar',
      name: 'Arabic',
      script: 'Arabic',
      font: 'Amiri',
      isRtl: true,
      supportedEngines: ['xelatex', 'lualatex']
    }, ['Arabic'], 'xelatex');

    assert.ok(arPreamble.includes('\\usepackage{fontspec}'));
    assert.ok(arPreamble.includes('\\usepackage{polyglossia}'));
    assert.ok(arPreamble.includes('\\setmainlanguage{arabic}'));
    assert.ok(arPreamble.includes('\\newfontfamily\\arabicfont{Amiri}'));

    const urPreamble = generateUnicodePreamble({
      code: 'ur',
      name: 'Urdu',
      script: 'Arabic',
      font: 'Noto Nastaliq Urdu',
      isRtl: true,
      supportedEngines: ['xelatex']
    }, ['Arabic'], 'xelatex');

    assert.ok(urPreamble.includes('\\setmainlanguage{urdu}'));
    assert.ok(urPreamble.includes('Noto Nastaliq Urdu'));
  });

  // 7. Full Project Conversion in Mode A (Single Language - Bengali)
  await t.test('7. Mode A Bengali paper generates complete Unicode APA 7 project and valid ZIP', async () => {
    const result = await convertToApa7Project({
      variant: 'student',
      title: 'বাংলা প্রাকৃতিক ভাষা প্রক্রিয়াকরণ গবেষণা',
      authors: [{ name: 'সৌমেন চক্রবর্তী', affiliation: 'কম্পিউটার বিজ্ঞান বিভাগ, ঢাকা বিশ্ববিদ্যালয়' }],
      abstract: 'এই গবেষণায় বাংলা বাক্যের অর্থবোধক বিশ্লেষণ এবং ডিপ লার্নিং মডেলের উপযোগিতা পরীক্ষা করা হয়েছে।',
      keywords: ['প্রাকৃতিক ভাষা প্রক্রিয়াকরণ', 'ডিপ লার্নিং', 'বাংলা কর্পাস'],
      course: 'CSE 401: Advanced NLP',
      instructor: 'ড. ফারহানা রহমান',
      dueDate: '২৫শে অক্টোবর ২০২৬',
      documentLanguage: 'bn',
      documentMode: 'single',
      engine: 'xelatex',
      rawText: '## ভূমিকা\n\nপ্রাকৃতিক ভাষা প্রক্রিয়াকরণ একটি গুরুত্বপূর্ণ ক্ষেত্র।\n\n## পদ্ধতি\n\nআমরা ৫০০০ বাক্যের একটি ডেটাসেট ব্যবহার করেছি।'
    });

    assert.ok(result.zipBuffer instanceof Buffer);
    assert.ok(result.mainTex.includes('\\setmainlanguage{bengali}'));
    assert.ok(result.mainTex.includes('Noto Serif Bengali'));
    assert.equal(result.report.language.documentLanguage, 'bn');
    assert.equal(result.report.language.selectedEngine, 'xelatex');

    // Inspect ZIP structure
    const zip = new AdmZip(result.zipBuffer);
    const entryNames = zip.getEntries().map(e => e.entryName);

    // Multilingual folder root
    assert.ok(entryNames.some(n => n.startsWith('researchproof-multilingual-apa7/main.tex')));
    assert.ok(entryNames.some(n => n.startsWith('researchproof-multilingual-apa7/language-config.json')));
    assert.ok(entryNames.some(n => n.startsWith('researchproof-multilingual-apa7/conversion-report.json')));

    // Read language-config.json
    const configEntry = zip.getEntry('researchproof-multilingual-apa7/language-config.json');
    assert.ok(configEntry, 'language-config.json must exist in ZIP');
    const langConfig = JSON.parse(configEntry.getData().toString('utf8'));
    assert.equal(langConfig.documentLanguage, 'bn');
    assert.equal(langConfig.primaryScript, 'Bengali');
    assert.equal(langConfig.recommendedEngine, 'xelatex');
    assert.ok(langConfig.requiredFonts.includes('Noto Serif Bengali'));
  });

  // 8. Mode B (Mixed Language - English Manuscript with Hindi & Arabic Quotes)
  await t.test('8. Mode B Mixed Language creates font-switch macros for secondary scripts', async () => {
    const rawText = `## Introduction
Multilingual social science research often incorporates verbatim quotations.

For example, a Hindi participant responded: "हम डिजिटल शिक्षा के लाभ देख रहे हैं" while an Arabic respondent noted "التعليم الرقمي يفتح آفاقا جديدة".

## Conclusion
Both perspectives highlight digital accessibility.`;

    const result = await convertToApa7Project({
      variant: 'professional',
      title: 'Multilingual Voices in Higher Education Research',
      authors: [{ name: 'Dr. Alistair Finch', affiliation: 'Oxford Institute of Education' }],
      abstract: 'A mixed-script investigation into participant sentiment across diverse linguistic communities.',
      runningHead: 'MULTILINGUAL VOICES',
      documentLanguage: 'en',
      documentMode: 'mixed',
      engine: 'auto',
      rawText
    });

    assert.ok(result.mainTex.includes('\\usepackage{fontspec}'));
    assert.ok(result.mainTex.includes('\\newfontfamily\\devanagarifont'));
    assert.ok(result.mainTex.includes('\\newfontfamily\\arabicfont'));
    assert.ok(result.report.language.detectedScripts.includes('Devanagari'));
    assert.ok(result.report.language.detectedScripts.includes('Arabic'));
  });

  // 9. Mode C (Language-Preserving Conversion - No Destructive Transliteration)
  await t.test('9. Mode C preserves CJK, Indic, and Latin characters exactly as supplied', async () => {
    const cjkText = '## 方法 (Methodology)\n\n数据采集来自东京大学与首尔大学 (Data collection from Tokyo & Seoul).\n\n日本語サンプル: 自然言語処理の研究。\n한국어 샘플: 한국어 형태소 분석.';
    const result = await convertToApa7Project({
      variant: 'student',
      title: 'East Asian Cross-Linguistic Studies',
      authors: [{ name: 'Kenji Sato', affiliation: 'University of Tokyo' }],
      documentLanguage: 'auto',
      documentMode: 'preserve',
      engine: 'lualatex',
      rawText: cjkText
    });

    assert.ok(result.mainTex.includes('日本語サンプル: 自然言語処理の研究。'));
    assert.ok(result.mainTex.includes('한국어 샘플: 한국어 형태소 분석.'));
    assert.ok(result.mainTex.includes('数据采集来自东京大学与首尔大学'));
    assert.equal(result.report.language.documentMode, 'preserve');
  });

  // 10. API Route: GET /api/latex/languages
  await t.test('10. GET /api/latex/languages exposes language catalog and compiler status', async () => {
    const res = await makeRequest('/api/latex/languages');
    assert.equal(res.status, 200);
    assert.ok(res.body.languages);
    assert.ok(res.body.languages.en);
    assert.ok(res.body.languages.bn);
    assert.ok(res.body.languages.hi);
    assert.ok(res.body.languages.ar);
    assert.ok(res.body.scripts);
    assert.ok(res.body.compilerAvailability);
    assert.equal(typeof res.body.compilerAvailability.available, 'boolean');
  });

  // 11. API Route: POST /api/latex/apa7/convert with Multilingual Payload
  await t.test('11. POST /api/latex/apa7/convert processes multilingual parameters and returns language report', async () => {
    const token = await getAuthToken();
    const convertRes = await makeRequest('/api/latex/apa7/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        variant: 'student',
        title: 'বাংলা ও অসমীয়া লিপির তুলনামূলক ভাষাতত্ত্ব',
        author: 'তন্ময় মজুমদার',
        affiliation: 'কলকাতা বিশ্ববিদ্যালয়',
        abstract: 'বাংলা এবং অসমীয়া লিপির ঐতিহাসিক বিবর্তন এবং বর্তমান ডিজিটাল টাইপোগ্রাফি সম্পর্কিত সমীক্ষা।',
        keywords: 'ভাষাতত্ত্ব, লিপি, বাংলা',
        documentLanguage: 'bn',
        documentMode: 'mixed',
        engine: 'xelatex',
        content: '## ১. ভূমিকা\n\nদক্ষিণ এশিয়ার লিপিশৈলীর মধ্যে বাংলা লিপি অন্যতম প্রাচীন ও সমৃদ্ধ।'
      })
    });

    assert.equal(convertRes.status, 201);
    assert.equal(convertRes.body.success, true);
    assert.ok(convertRes.body.jobId);
    assert.ok(convertRes.body.languageReport);
    assert.equal(convertRes.body.languageReport.documentLanguage, 'bn');
    assert.equal(convertRes.body.languageReport.selectedEngine, 'xelatex');
    assert.ok(convertRes.body.languageReport.scriptDistribution);

    // Download ZIP and verify language-config.json
    const zipRes = await makeRequest(`/api/latex/jobs/${convertRes.body.jobId}/zip`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(zipRes.status, 200);
    const zip = new AdmZip(zipRes.body);
    const langConfigEntry = zip.getEntry('researchproof-multilingual-apa7/language-config.json');
    assert.ok(langConfigEntry, 'ZIP download must include language-config.json');
    const langConfig = JSON.parse(langConfigEntry.getData().toString('utf8'));
    assert.equal(langConfig.documentLanguage, 'bn');
  });

  // 12. Compiler Fallback & Graceful Error Handling
  await t.test('12. Attempting PDF compilation reports clear diagnostics when TeX binary is absent or succeeds when present', async () => {
    const project = await convertToApa7Project({
      variant: 'student',
      title: 'Compiler Diagnostic Verification',
      authors: [{ name: 'Test Author', affiliation: 'Test University' }],
      documentLanguage: 'en',
      engine: 'xelatex',
      rawText: '## Overview\nTesting isolated compiler runner.'
    });

    const compRes = await attemptPdfCompilation(project.zipBuffer, { engine: 'xelatex' });
    assert.ok(['success', 'unavailable', 'failed'].includes(compRes.status));
    assert.ok(typeof compRes.message === 'string');
    if (compRes.status === 'unavailable') {
      assert.ok(compRes.message.includes('XeLaTeX') || compRes.message.includes('TeX'));
    }
  });

});
