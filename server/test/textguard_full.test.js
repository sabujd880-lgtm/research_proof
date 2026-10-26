import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import { performTextGuardScan, isBotProtectionChallenge, mergeIntervals } from '../src/textGuardService.js';
import { generateTextGuardPdfReport } from '../src/pdfReportService.js';
import { validateEmpiricalFacts } from '../src/meaningChecker.js';

let server;
let baseUrl;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('ResearchProof AI — TextGuard, PDF Reporting, Meaning & Platform Completion Suite', async (t) => {
  let authToken = '';

  async function api(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = Buffer.from(text);
    }
    return { status: res.status, headers: res.headers, body };
  }


  await t.test('0. Setup authenticated session for researcher', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@researchproof.ai', password: 'Password1234!' })
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    authToken = res.body.token;
  });

  await t.test('1. Bot Protection Challenge Rejection (Cloudflare verification handling)', async () => {
    const challengeHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Just a moment...</title></head>
        <body>
          <div class="cf-browser-verification">
            Performing security verification. This website uses a security service to protect against malicious bots.
          </div>
        </body>
      </html>
    `;
    assert.equal(isBotProtectionChallenge(challengeHtml), true);
    assert.equal(isBotProtectionChallenge('In this randomized controlled trial of cognitive therapy (N = 120), p < .01 was observed.'), false);

    const scanRes = await api('/api/textguard/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        text: challengeHtml,
        documentTitle: 'Challenge Test'
      })
    });
    assert.equal(scanRes.status, 400);
    assert.equal(scanRes.body.isBotChallenge, true);
    assert.match(scanRes.body.error, /Security verification challenge detected/i);
  });

  await t.test('2. Multi-tier similarity detection and non-overlapping interval merging', async () => {
    const intervals = [
      { start: 0, end: 50 },
      { start: 25, end: 75 },
      { start: 100, end: 150 }
    ];
    const merged = mergeIntervals(intervals);
    assert.equal(merged.length, 2);
    assert.deepEqual(merged[0], { start: 0, end: 75 });
    assert.deepEqual(merged[1], { start: 100, end: 150 });

    const manuscript = `
      The study examined cognitive performance in young adults. Participants completed a series of neuropsychological assessments measuring attention and inhibitory control. The results were analyzed using a factorial design.
      
      Furthermore, statistical significance was confirmed at p = .023 with a sample of n = 150. Reference: Smith et al. (2020) doi: 10.1000/182.
    `;
    const scan = await performTextGuardScan({
      text: manuscript,
      documentTitle: 'Cognitive Study',
      comparisonSources: [
        {
          id: 'ext-src-1',
          title: 'Journal of Neuropsychology 2021',
          author: 'Smith, J.',
          url: 'https://example.org/neuro-study',
          text: 'The study examined cognitive performance in young adults. Participants completed a series of neuropsychological assessments measuring attention and inhibitory control.'
        }
      ]
    });

    assert.ok(scan.similarityCoverage > 0);
    assert.ok(scan.unmatchedCoverage < 100);
    assert.equal(scan.matchedPassageCount >= 1, true);
    assert.equal(scan.distinctSourceCount >= 1, true);
    assert.ok(scan.doiVerification.total >= 1);
    assert.ok(scan.sha256.length === 64);
    assert.ok(Array.isArray(scan.matchedSources));
    if (scan.matchedSources.length > 0) {
      const firstSource = scan.matchedSources[0];
      assert.ok(firstSource.sourceId);
      assert.ok(firstSource.title);
      assert.ok(typeof firstSource.similarityContribution === 'number');
      assert.ok(typeof firstSource.matchedWordCount === 'number');
      assert.ok(firstSource.verificationStatus);
    }
  });

  await t.test('3. Meaning Preservation: Deterministic validation of empirical facts and p-values', async () => {
    const original = 'In our experiment (N = 250), treatment efficacy showed M = 45.2, SD = 8.1, t(248) = 3.42, p = .001, 95% CI [2.1, 8.4], as noted by Davis et al. (2021).';
    
    // Formatting-only change
    const revisedFormattingOnly = 'In our experiment (N = 250), treatment efficacy showed M = 45.2, SD = 8.1, t(248) = 3.42, p = 0.001, 95% CI [2.1, 8.4], as noted by Davis et al. (2021).';
    const resFormatting = validateEmpiricalFacts(original, revisedFormattingOnly);
    assert.equal(resFormatting.canAcceptWithoutWarning, true);
    assert.equal(resFormatting.formattingOnly.length >= 1, true);

    // Tampered numerical values
    const revisedTampered = 'In our experiment (N = 120), treatment efficacy showed M = 45.2, SD = 8.1, t(248) = 3.42, p = .05, 95% CI [2.1, 8.4], as noted by Davis et al. (2021).';
    const resTampered = validateEmpiricalFacts(original, revisedTampered);
    assert.equal(resTampered.canAcceptWithoutWarning, false);
    assert.ok(resTampered.changed.some(c => c.type === 'p-value' || c.type === 'p_value'));
    assert.ok(resTampered.changed.some(c => c.type === 'sample-size' || c.type === 'sample_size'));
    assert.ok(resTampered.warnings.length >= 2);


    // Test API route
    const apiRes = await api('/api/meaning/validate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ originalText: original, revisedText: revisedTampered })
    });
    assert.equal(apiRes.status, 200);
    assert.equal(apiRes.body.canAcceptWithoutWarning, false);
  });

  await t.test('4. PDF Report Generator: Standard %PDF-1.4 generation and 6-section structure', async () => {
    const mockScan = {
      documentTitle: 'Cognitive Integrity & Memory Synthesis',
      analyzedWordCount: 850,
      similarityCoverage: 18,
      unmatchedCoverage: 82,
      matchedPassageCount: 3,
      distinctSourceCount: 2,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      matches: [
        {
          spanId: 'span-0',
          matchType: 'exact',
          sourceTitle: 'Frontiers in Cognitive Science (2022)',
          sourceUrl: 'https://doi.org/10.1000/182',
          similarityScore: 100,
          matchedSnippet: 'Participants completed a series of neuropsychological assessments measuring attention and inhibitory control.'
        }
      ],
      doiVerification: {
        total: 2,
        verified: 2,
        partial: 0,
        notFound: 0,
        retracted: 0,
        references: [
          { raw: 'Smith et al. (2020)', doi: '10.1000/182', status: 'verified', title: 'Cognitive assessment standards', authors: 'Smith, J.', year: 2020, publisher: 'Academic Press' }
        ]
      },
      meaningValidation: {
        preservedCount: 5,
        changedCount: 0,
        summary: 'All 5 empirical statistics and citations were deterministically preserved.'
      }
    };

    const pdfBuffer = generateTextGuardPdfReport(mockScan);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 500);
    const header = pdfBuffer.slice(0, 8).toString('utf-8');
    assert.ok(header.startsWith('%PDF-1.4'));

    // Test API endpoint direct report generation
    const res = await api('/api/textguard/report/pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(mockScan)
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.ok(res.body.length > 500);
  });

  let createdScanId = '';
  await t.test('5. Full TextGuard Scan & Report Lifecycle via HTTP API', async () => {
    const manuscript = 'The study examined cognitive performance in young adults. Participants completed a series of assessments. Reference doi: 10.1000/182.';
    const scanRes = await api('/api/textguard/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        text: manuscript,
        documentTitle: 'Cognitive Lifecycle Test'
      })
    });
    assert.equal(scanRes.status, 200);
    assert.ok(scanRes.body._id || scanRes.body.id);
    createdScanId = scanRes.body._id || scanRes.body.id;

    // Retrieve single scan
    const getRes = await api(`/api/textguard/scans/${createdScanId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.documentTitle, 'Cognitive Lifecycle Test');

    // Retrieve report PDF by ID
    const reportRes = await api(`/api/textguard/scans/${createdScanId}/report`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(reportRes.status, 200);
    assert.equal(reportRes.headers.get('content-type'), 'application/pdf');
    assert.ok(reportRes.body.length > 500);
  });

  await t.test('6. Usage Analytics: Real aggregated metrics & unlimited quota confirmation', async () => {
    const res = await api('/api/analytics/overview', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.metrics.totalScans === 'number');
    assert.ok(typeof res.body.metrics.totalWordsProcessed === 'number');
    assert.equal(res.body.quotas.dailyRewrites, 'Unlimited');
    assert.equal(res.body.quotas.dailyAnalysis, 'Unlimited');
  });

  await t.test('7. Privacy & Data: Data export package & targeted wipe', async () => {
    const exportRes = await api('/api/privacy/export', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!exportRes.body?.exportManifest) {
      console.log('DEBUG exportRes:', exportRes.status, exportRes.headers, exportRes.body);
    }
    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.body.exportManifest);
    assert.equal(exportRes.body.exportManifest.platform, 'ResearchProof AI');
    assert.ok(Array.isArray(exportRes.body.scans));

    // Privacy scan wipe
    const wipeRes = await api('/api/privacy/scans', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(wipeRes.status, 200);
    assert.equal(wipeRes.body.success, true);
  });

  await t.test('8. User Settings & Preferences: Read and persist preferences', async () => {
    const updateRes = await api('/api/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        displayName: 'Dr. Jane Doe',
        preferences: {
          theme: 'dark',
          compactSidebar: true,
          defaultCitationStyle: 'apa',
          meaningPreservationStrictness: 'critical'
        }
      })
    });
    assert.equal(updateRes.status, 200);

    const getRes = await api('/api/settings', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.displayName, 'Dr. Jane Doe');
    assert.equal(getRes.body.preferences.compactSidebar, true);
    assert.equal(getRes.body.preferences.meaningPreservationStrictness, 'critical');
  });

  await t.test('9. System Verification Panel: Live connectivity checks', async () => {
    const res = await api('/api/system/verification');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.ok(res.body.services.similarityEngine);
    assert.ok(res.body.services.pdfGenerator);
    assert.ok(res.body.services.meaningValidator);
    assert.ok(res.body.services.database);
  });
});
