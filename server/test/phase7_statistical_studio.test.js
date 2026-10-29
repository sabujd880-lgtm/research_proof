import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import AdmZip from 'adm-zip';
import { app } from '../src/index.js';
import {
  computeDescriptive,
  computeOneSampleTTest,
  computeTTest,
  computeAnova,
  computeTwoWayAnova,
  computeCorrelation,
  computeLinearRegression,
  computeMultipleRegression,
  computeMannWhitneyU,
  computeWilcoxonSignedRank,
  computeKruskalWallis,
  computeChiSquareTest,
  checkNormalityShapiroWilk,
  checkLeveneTest,
  parseDatasetBuffer,
  applyDatasetTransformations,
  formatApa7StatisticalNarrative
} from '../src/statService.js';

let server;
let pipeName;

function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    let payload = options.body;
    let headers = {
      'x-forwarded-for': '127.0.0.1',
      ...(options.headers || {})
    };

    if (payload && !Buffer.isBuffer(payload) && typeof payload === 'object') {
      payload = JSON.stringify(payload);
      headers['content-type'] = 'application/json';
    }

    if (payload) {
      headers['content-length'] = Buffer.isBuffer(payload) ? payload.length : Buffer.byteLength(payload);
    }

    const req = http.request({
      socketPath: pipeName,
      path,
      method: options.method || 'GET',
      headers
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const text = rawBuffer.toString('utf8');
        let body = {};
        try { body = text ? JSON.parse(text) : {}; } catch (_) { body = text; }
        resolve({ status: res.statusCode, headers: res.headers, body, rawBuffer });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function buildMultipart(fields = {}, files = []) {
  const boundary = `----RPBoundaryStat${Date.now()}${Math.random().toString(36).slice(2)}`;
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    );
  }

  for (const file of files) {
    const fieldName = file.fieldName || 'file';
    const filename = file.filename || 'dataset.csv';
    const contentType = file.contentType || 'text/csv';
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    parts.push(file.buffer);
    parts.push('\r\n');
  }

  parts.push(`--${boundary}--\r\n`);

  const bodyBuffer = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8')));
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    buffer: bodyBuffer
  };
}

function createDummyXlsxBuffer() {
  const zip = new AdmZip();
  // Add minimal sheet1.xml
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
    </row>
    <row r="2">
      <c r="A2"><v>10</v></c>
      <c r="B2"><v>100</v></c>
    </row>
    <row r="3">
      <c r="A3"><v>20</v></c>
      <c r="B3"><v>200</v></c>
    </row>
  </sheetData>
</worksheet>`;

  // Add sharedStrings.xml
  const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
  <si><t>Score</t></si>
  <si><t>ResponseMs</t></si>
</sst>`;

  zip.addFile('xl/worksheets/sheet1.xml', Buffer.from(sheetXml, 'utf8'));
  zip.addFile('xl/sharedStrings.xml', Buffer.from(sstXml, 'utf8'));
  return zip.toBuffer();
}

test.before(async () => {
  process.env.NODE_ENV = 'test';
  pipeName = `\\\\.\\pipe\\rp-phase7-stat-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(pipeName, resolve);
  });
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

test('ResearchProof AI — Phase 7 Complete Statistical Analysis Studio Suite', async (t) => {
  let userAToken = '';
  let userBToken = '';
  let projectIdA = '';
  let csvDatasetId = '';
  let analysisIdA = '';

  // 1. Account Setup
  await t.test('1. Setup User A and User B accounts with an active research project', async () => {
    const emailA = `stat-researcher-a-${Date.now()}@university.edu`;
    const regResA = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Dr. Jane Statistician', email: emailA, password: 'SecurePassword123!' }
    });
    assert.equal(regResA.status, 201);
    userAToken = regResA.body.token;

    const emailB = `stat-researcher-b-${Date.now()}@university.edu`;
    const regResB = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Dr. Bob Competitor', email: emailB, password: 'SecurePassword123!' }
    });
    assert.equal(regResB.status, 201);
    userBToken = regResB.body.token;

    const projRes = await api('/api/v1/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        title: 'Cognitive Load and Adaptive Learning Trial',
        description: 'Randomized controlled trial of AI-assisted scaffolding'
      }
    });
    assert.equal(projRes.status, 201);
    projectIdA = projRes.body._id;
    assert.ok(projectIdA);
  });

  // 2. Unauthenticated 401 Rejection
  await t.test('2. Unauthenticated requests to Statistical endpoints return 401 Unauthorized', async () => {
    const listRes = await api('/api/v1/statistics/datasets');
    assert.equal(listRes.status, 401);

    const anaRes = await api('/api/v1/statistics/analyses');
    assert.equal(anaRes.status, 401);
  });

  // 3. CSV Dataset Upload & Automatic Type Inference
  await t.test('3. CSV dataset upload auto-detects comma delimiter and assigns column types', async () => {
    const csvContent = `ParticipantId,Condition,Cohort,PreScore,PostScore,ReactionMs
P001,Intervention,Alpha,55,75,320
P002,Intervention,Alpha,60,82,310
P003,Intervention,Beta,58,79,330
P004,Intervention,Beta,62,85,305
P005,Control,Alpha,54,58,410
P006,Control,Alpha,59,61,425
P007,Control,Beta,57,60,390
P008,Control,Beta,61,63,405`;

    const multipart = buildMultipart(
      { name: 'Trial Data 1', projectId: projectIdA },
      [{ fieldName: 'file', filename: 'trial1.csv', contentType: 'text/csv', buffer: Buffer.from(csvContent, 'utf8') }]
    );

    const uploadRes = await api('/api/v1/statistics/datasets/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'Content-Type': multipart.contentType
      },
      body: multipart.buffer
    });

    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.body.rowCount, 8);
    assert.equal(uploadRes.body.columnCount, 6);
    csvDatasetId = uploadRes.body._id;
    assert.ok(csvDatasetId);

    const numCol = uploadRes.body.columns.find(c => c.name === 'PreScore');
    assert.ok(numCol);
    assert.equal(numCol.type, 'numeric');
    assert.equal(numCol.measurementLevel, 'scale');

    const catCol = uploadRes.body.columns.find(c => c.name === 'Condition');
    assert.ok(catCol);
    assert.equal(catCol.type, 'categorical');
    assert.equal(catCol.measurementLevel, 'nominal');
  });

  // 4. TSV Dataset Upload
  await t.test('4. TSV dataset upload auto-detects tab delimiter', async () => {
    const tsvContent = `Id\tMetricA\tMetricB\n1\t10.5\t20.2\n2\t14.2\t25.8\n3\t18.1\t29.4`;
    const multipart = buildMultipart(
      { name: 'TSV Benchmark', projectId: projectIdA },
      [{ fieldName: 'file', filename: 'benchmark.tsv', contentType: 'text/tab-separated-values', buffer: Buffer.from(tsvContent, 'utf8') }]
    );

    const uploadRes = await api('/api/v1/statistics/datasets/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'Content-Type': multipart.contentType
      },
      body: multipart.buffer
    });

    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.body.rowCount, 3);
    assert.equal(uploadRes.body.columnCount, 3);
  });

  // 5. XLSX Spreadsheet Upload & Parsing
  await t.test('5. XLSX spreadsheet upload extracts OpenXML cells without external binaries', async () => {
    const xlsxBuf = createDummyXlsxBuffer();
    const multipart = buildMultipart(
      { name: 'XLSX Spreadsheet', projectId: projectIdA },
      [{ fieldName: 'file', filename: 'metrics.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsxBuf }]
    );

    const uploadRes = await api('/api/v1/statistics/datasets/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'Content-Type': multipart.contentType
      },
      body: multipart.buffer
    });

    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.body.rowCount, 2);
    assert.equal(uploadRes.body.columnCount, 2);
    assert.equal(uploadRes.body.columns[0].name, 'Score');
    assert.equal(uploadRes.body.columns[1].name, 'ResponseMs');
  });

  // 6. Variable Explorer and Measurement Level Modification
  await t.test('6. Variable explorer permits modifying measurement level to ordinal', async () => {
    const getVars = await api(`/api/v1/statistics/datasets/${csvDatasetId}/variables`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(getVars.status, 200);
    assert.ok(getVars.body.length >= 6);

    const patchRes = await api(`/api/v1/statistics/datasets/${csvDatasetId}/variables/Cohort`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { measurementLevel: 'ordinal', displayName: 'Study Cohort' }
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.measurementLevel, 'ordinal');
  });

  // 7. Data Cleaning & Transformation Versioning
  await t.test('7. POST /statistics/datasets/:id/transform creates an immutable dataset version snapshot', async () => {
    const transformRes = await api(`/api/v1/statistics/datasets/${csvDatasetId}/transform`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        transformations: [
          { operation: 'standardize_z', column: 'PreScore' }
        ],
        summary: 'Standardize PreScore to z-scores'
      }
    });

    assert.equal(transformRes.status, 200);
    assert.equal(transformRes.body.currentVersionNumber, 2);

    const versionsRes = await api(`/api/v1/statistics/datasets/${csvDatasetId}/versions`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(versionsRes.status, 200);
    assert.ok(versionsRes.body.length >= 1);
  });

  // 8. Descriptive Statistics with 95% Confidence Intervals
  await t.test('8. Descriptive statistics calculates exact mean, median, SD, IQR, skewness, and 95% CI', async () => {
    const raw = [10, 12, 14, 15, 16, 18, 20, 22, 24, 25];
    const desc = computeDescriptive(raw, 0.95);
    assert.equal(desc.count, 10);
    assert.equal(desc.mean, 17.6);
    assert.equal(desc.median, 17);
    assert.ok(desc.stdDev > 5);
    assert.equal(desc.min, 10);
    assert.equal(desc.max, 25);
    assert.ok(desc.confidenceInterval[0] < desc.mean);
    assert.ok(desc.confidenceInterval[1] > desc.mean);
  });

  // 9. One-Sample t-Test
  await t.test('9. One-sample t-test computes exact t, df, p-value, and Cohen\'s d vs baseline', async () => {
    const sample = [105, 110, 108, 112, 115, 109, 114, 111];
    const res = computeOneSampleTTest(sample, 100);
    assert.equal(res.df, 7);
    assert.ok(res.t > 0);
    assert.ok(res.pValue < 0.001);
    assert.ok(res.cohensD > 2.0);
    assert.equal(res.significant, true);
  });

  // 10. Independent-Samples t-Test (Student & Welch with Hedges' g)
  await t.test('10. Independent-samples t-test computes Welch df, Cohen\'s d, and Hedges\' g', async () => {
    const groupA = [85, 88, 90, 92, 95, 89, 94];
    const groupB = [70, 72, 75, 71, 74, 69, 73];
    const res = computeTTest(groupA, groupB, false); // independent
    assert.ok(res.t > 0);
    assert.ok(res.pValue < 0.001);
    assert.ok(res.cohensD > 2.0);
    assert.ok(res.hedgesG > 2.0);
    assert.ok(res.welch);
    assert.ok(res.welch.df > 0);
  });

  // 11. Paired-Samples t-Test
  await t.test('11. Paired-samples t-test evaluates repeated measures mean difference', async () => {
    const pre = [50, 55, 60, 65, 70, 75];
    const post = [62, 68, 71, 79, 85, 88];
    const res = computeTTest(pre, post, true); // paired
    assert.equal(res.df, 5);
    assert.ok(Math.abs(res.meanDiff) > 10);
    assert.ok(res.pValue < 0.001);
    assert.equal(res.significant, true);
  });

  // 12. One-Way ANOVA with Tukey HSD Post-Hoc Tests
  await t.test('12. One-way ANOVA computes F-ratio, eta², omega², and Tukey HSD comparisons', async () => {
    const groups = {
      Control: [10, 12, 11, 13, 10],
      LowDose: [15, 17, 16, 18, 14],
      HighDose: [22, 24, 25, 23, 26]
    };
    const res = computeAnova(groups);
    assert.equal(res.dfBetween, 2);
    assert.equal(res.dfWithin, 12);
    assert.ok(res.f > 50);
    assert.ok(res.pValue < 0.001);
    assert.ok(res.etaSquared > 0.8);
    assert.ok(res.omegaSquared > 0.8);
    assert.equal(res.postHocTukey.length, 3);
    assert.ok(res.postHocTukey.every(c => c.significant));
  });

  // 13. Two-Way Factorial ANOVA (Main & Interaction Effects)
  await t.test('13. Two-way factorial ANOVA partitions SS for Factor A, Factor B, and Interaction', async () => {
    const rows = [
      { Score: 10, Treatment: 'Drug', Gender: 'Male' },
      { Score: 12, Treatment: 'Drug', Gender: 'Male' },
      { Score: 15, Treatment: 'Drug', Gender: 'Female' },
      { Score: 17, Treatment: 'Drug', Gender: 'Female' },
      { Score: 6, Treatment: 'Placebo', Gender: 'Male' },
      { Score: 8, Treatment: 'Placebo', Gender: 'Male' },
      { Score: 7, Treatment: 'Placebo', Gender: 'Female' },
      { Score: 9, Treatment: 'Placebo', Gender: 'Female' }
    ];
    const res = computeTwoWayAnova(rows, 'Score', 'Treatment', 'Gender');
    assert.ok(res.factorA.f > 0);
    assert.ok(res.factorB.f > 0);
    assert.ok(res.interaction.f >= 0);
    assert.ok(res.factorA.partialEtaSquared !== undefined);
  });

  // 14. Pearson Correlation with Fisher z 95% CI
  await t.test('14. Pearson correlation produces exact r and Fisher z transformed 95% CI', async () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [2, 4, 5, 7, 8, 10, 11, 13, 15, 16];
    const res = computeCorrelation(x, y, 'pearson');
    assert.ok(res.r > 0.95);
    assert.ok(res.pValue < 0.001);
    assert.ok(res.confidenceInterval[0] > 0.8);
    assert.ok(res.confidenceInterval[1] <= 1.0);
  });

  // 15. Spearman Rank Correlation
  await t.test('15. Spearman rank correlation handles monotonic non-linear association', async () => {
    const x = [1, 2, 3, 4, 5, 6];
    const y = [10, 20, 40, 80, 160, 320];
    const res = computeCorrelation(x, y, 'spearman');
    assert.equal(res.r, 1);
    assert.equal(res.significant, true);
  });

  // 16. Multiple Linear Regression (OLS Matrix Inversion, VIF, Durbin-Watson)
  await t.test('16. Multiple Linear Regression computes beta coefficients, SE, t, R², Adj R², and VIF', async () => {
    const rows = [];
    for (let i = 1; i <= 30; i++) {
      const x1 = i * 2;
      const x2 = i % 3;
      const y = 5 + 1.5 * x1 + 0.8 * x2 + (i % 2 === 0 ? 0.2 : -0.2);
      rows.push({ y, x1, x2 });
    }
    const res = computeMultipleRegression(rows, 'y', ['x1', 'x2']);
    assert.equal(res.predictors, 2);
    assert.ok(res.rSquared > 0.95);
    assert.ok(res.adjRSquared > 0.95);
    assert.ok(res.durbinWatson > 0);
    assert.equal(res.coefficients.length, 3); // Intercept, x1, x2
    assert.ok(res.coefficients[1].vif !== null);
  });

  // 17. Mann-Whitney U Test
  await t.test('17. Mann-Whitney U test computes rank sums, z-score, and rank-biserial r', async () => {
    const a = [10, 12, 15, 18, 20, 22];
    const b = [2, 4, 5, 6, 8, 9];
    const res = computeMannWhitneyU(a, b);
    assert.ok(res.u >= 0);
    assert.ok(res.u1 > 0 || res.u2 > 0);
    assert.ok(res.pValue < 0.05);
    assert.ok(res.rankBiserialR > 0.8);
    assert.equal(res.significant, true);
  });

  // 18. Wilcoxon Signed-Rank Test
  await t.test('18. Wilcoxon signed-rank test evaluates paired median shifts', async () => {
    const pre = [12, 14, 15, 18, 19, 21, 22];
    const post = [18, 20, 22, 25, 27, 29, 31];
    const res = computeWilcoxonSignedRank(pre, post);
    assert.ok(res.w >= 0);
    assert.ok(res.wPlus > 0 || res.wMinus > 0);
    assert.ok(res.pValue < 0.05);
    assert.equal(res.significant, true);
  });

  // 19. Kruskal-Wallis H Test
  await t.test('19. Kruskal-Wallis test computes H-statistic with tie correction and epsilon²', async () => {
    const groups = [
      [5, 6, 7, 8],
      [12, 14, 15, 16],
      [22, 24, 25, 26]
    ];
    const res = computeKruskalWallis(groups);
    assert.equal(res.df, 2);
    assert.ok(res.h > 8);
    assert.ok(res.pValue < 0.05);
    assert.ok(res.epsilonSquared > 0.6);
  });

  // 20. Chi-Square Independence with Cramér's V and Odds Ratio
  await t.test('20. Chi-Square test of independence calculates expected frequencies, Cramér\'s V, and Odds Ratio', async () => {
    // 2x2 Contingency Table: [ [40, 10], [15, 35] ]
    const table = [
      [40, 10],
      [15, 35]
    ];
    const res = computeChiSquareTest(table);
    assert.equal(res.df, 1);
    assert.ok(res.chiSquare > 20);
    assert.ok(res.pValue < 0.001);
    assert.ok(res.cramersV > 0.4);
    assert.ok(res.oddsRatio > 5);
  });

  // 21. Assumption Checks: Shapiro-Wilk & Levene's Test
  await t.test('21. Assumption checks compute Shapiro-Wilk W and Levene\'s homogeneity F', async () => {
    const normalData = [48, 49, 50, 50, 51, 52, 49, 51, 50, 50];
    const sw = checkNormalityShapiroWilk(normalData);
    assert.ok(sw.w > 0.8);
    assert.equal(sw.isNormal, true);

    const groupMap = {
      G1: [10, 11, 12, 10, 11],
      G2: [12, 13, 11, 12, 13]
    };
    const lev = checkLeveneTest(groupMap);
    assert.ok(lev.f >= 0);
    assert.equal(lev.equalVariances, true);
  });

  // 22. End-to-End POST /statistics/analyses & Results Retrieval
  await t.test('22. POST /statistics/analyses executes end-to-end analysis and returns APA 7 report', async () => {
    const anaRes = await api('/api/v1/statistics/analyses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectIdA,
        datasetId: csvDatasetId,
        analysisType: 'independent_t_test',
        title: 'Empirical Intervention vs Control PostScore',
        variables: {
          dependent: 'PostScore',
          groupFactor: 'Condition'
        },
        parameters: {
          confidenceLevel: 0.95,
          checkAssumptions: true
        }
      }
    });

    assert.equal(anaRes.status, 201);
    assert.ok(anaRes.body.results);
    assert.ok(anaRes.body.apaNarrative || anaRes.body.apaReport);
    assert.ok(anaRes.body.diagnostics);
    analysisIdA = anaRes.body._id;

    // Retrieve results via GET
    const getRes = await api(`/api/v1/statistics/analyses/${analysisIdA}/results`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(getRes.status, 200);
    assert.ok(getRes.body.results);
  });

  // 23. Cross-User Security & Tenant Isolation
  await t.test('23. User B cannot access or modify User A datasets or analyses (Tenant Isolation)', async () => {
    const getDsRes = await api(`/api/v1/statistics/datasets/${csvDatasetId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(getDsRes.status, 404);

    const getAnaRes = await api(`/api/v1/statistics/analyses/${analysisIdA}/results`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(getAnaRes.status, 404);

    const delRes = await api(`/api/v1/statistics/datasets/${csvDatasetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(delRes.status, 404);
  });

  // 24. Soft Deletion
  await t.test('24. DELETE /statistics/datasets/:id performs non-destructive soft deletion', async () => {
    const delRes = await api(`/api/v1/statistics/datasets/${csvDatasetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(delRes.status, 200);

    const listRes = await api('/api/v1/statistics/datasets', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(listRes.status, 200);
    const list = listRes.body.datasets || listRes.body || [];
    const found = list.find(d => d._id === csvDatasetId);
    assert.equal(found, undefined, 'Soft deleted dataset must not appear in active listings');
  });

  // 25. Legacy Route Compatibility
  await t.test('25. Legacy project endpoints (/projects/:id/datasets and /projects/:id/analyses) maintain backward compatibility', async () => {
    const legacyDsRes = await api(`/api/v1/projects/${projectIdA}/datasets`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(legacyDsRes.status, 200);
    assert.ok(Array.isArray(legacyDsRes.body));

    const legacyAnaRes = await api(`/api/v1/projects/${projectIdA}/analyses`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(legacyAnaRes.status, 200);
    assert.ok(Array.isArray(legacyAnaRes.body));
  });
});
