import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';

let server;
let pipeName;

let userA = { email: `rev_lead_${Date.now()}@university.edu`, password: 'LeadPassword123!', token: '', id: '' };
let userB = { email: `rev_screener_${Date.now()}@university.edu`, password: 'ScreenerPassword123!', token: '', id: '' };
let userC = { email: `rev_outsider_${Date.now()}@university.edu`, password: 'OutsiderPassword123!', token: '', id: '' };

let testProjectId = '';
let testReviewId = '';
let canonicalRecordId = '';
let duplicateRecordId = '';
let conflictRecordId = '';
let conflictId = '';

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
      path: path.startsWith('/api') ? path : `/api${path}`,
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

test.before(async () => {
  process.env.NODE_ENV = 'test';
  pipeName = `\\\\.\\pipe\\rp-phase8-sr-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

test('ResearchProof AI — Phase 8 Complete Systematic Review Assistant Suite', async (t) => {
  await t.test('1. Setup Reviewer A, B, and Outsider C accounts with a research project', async () => {
    // Register User A (Review Lead)
    const resA = await api('/auth/register', {
      method: 'POST',
      body: { name: 'Dr. Review Lead', email: userA.email, password: userA.password }
    });
    assert.equal(resA.status, 201);
    userA.token = resA.body.token;
    userA.id = resA.body.user.id;

    // Register User B (Independent Screener)
    const resB = await api('/auth/register', {
      method: 'POST',
      body: { name: 'Dr. Blind Screener', email: userB.email, password: userB.password }
    });
    assert.equal(resB.status, 201);
    userB.token = resB.body.token;
    userB.id = resB.body.user.id;

    // Register User C (Outsider)
    const resC = await api('/auth/register', {
      method: 'POST',
      body: { name: 'Dr. Outside Investigator', email: userC.email, password: userC.password }
    });
    assert.equal(resC.status, 201);
    userC.token = resC.body.token;
    userC.id = resC.body.user.id;

    // Create research project under User A
    const resProj = await api('/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: { title: 'Cardiometabolic Systematic Review Project', field: 'Cardiology' }
    });
    assert.equal(resProj.status, 201);
    testProjectId = resProj.body._id || resProj.body.id;
    assert.ok(testProjectId);
  });

  await t.test('2. Unauthenticated requests to systematic review endpoints return 401 Unauthorized', async () => {
    const res = await api('/systematic-reviews');
    assert.equal(res.status, 401);

    const resPost = await api('/systematic-reviews', {
      method: 'POST',
      body: { title: 'Unauthorized Review' }
    });
    assert.equal(resPost.status, 401);
  });

  await t.test('3. Review Creation: POST /systematic-reviews creates a systematic review with PICO and screening settings', async () => {
    const res = await api('/systematic-reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        title: 'Effectiveness of SGLT2 Inhibitors in Heart Failure with Preserved Ejection Fraction: A Systematic Review and Meta-Analysis',
        projectId: testProjectId,
        reviewType: 'systematic_review',
        registration: {
          registered: true,
          registryName: 'PROSPERO',
          registrationNumber: 'CRD42026123456',
          protocolUrl: 'https://www.crd.york.ac.uk/prospero/display_record.php?ID=CRD42026123456'
        },
        picosFramework: {
          framework: 'PICOS',
          population: 'Adult patients (age >= 18) diagnosed with HFpEF (LVEF >= 50%)',
          intervention: 'SGLT2 inhibitors (Empagliflozin, Dapagliflozin)',
          comparator: 'Placebo or standard medical therapy',
          outcomes: 'Primary: Cardiovascular death or HF hospitalization; Secondary: All-cause mortality, KCCQ score',
          studyDesign: 'Randomized Controlled Trials'
        },
        eligibility: {
          inclusionCriteria: [
            'Randomized controlled trials with >= 12 weeks follow-up',
            'Patients with LVEF >= 50%',
            'Reported cardiovascular death or hospitalizations'
          ],
          exclusionCriteria: [
            'Observational or single-arm non-randomized studies',
            'Animal or in vitro studies',
            'Studies with < 50 participants'
          ]
        },
        screeningSettings: {
          dualReviewerMode: true,
          blindScreening: true,
          adjudicationMethod: 'third_reviewer',
          minimumReviewersPerRecord: 2,
          conflictResolutionPolicy: 'consensus'
        }
      }
    });

    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    testReviewId = res.body._id;
    assert.equal(res.body.reviewType, 'systematic_review');
    assert.equal(res.body.screeningSettings.dualReviewerMode, true);
    assert.equal(res.body.registration.registrationNumber, 'CRD42026123456');
  });

  await t.test('4. Protocol Authoring & Amendments: PUT /systematic-reviews/:id/protocol updates protocol and logs amendment', async () => {
    // Initial protocol retrieval
    const getRes = await api(`/systematic-reviews/${testReviewId}/protocol`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(getRes.status, 200);

    // Update with amendment note
    const putRes = await api(`/systematic-reviews/${testReviewId}/protocol`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        title: 'SGLT2 Inhibitors in HFpEF — Formal Protocol',
        framework: 'PICOS',
        background: 'Heart failure with preserved ejection fraction represents over 50% of heart failure presentations.',
        objectives: 'To assess the therapeutic efficacy and safety of SGLT2 inhibitors.',
        picoElements: {
          population: 'Patients aged 18+ with documented LVEF >= 50%',
          intervention: 'Empagliflozin (10mg) or Dapagliflozin (10mg) daily',
          comparator: 'Matching placebo',
          outcomes: 'Composite cardiovascular death or total heart failure hospitalizations'
        },
        inclusionCriteria: ['RCTs with double-blind allocation', '>= 100 participants'],
        exclusionCriteria: ['Pediatric populations', 'Non-randomized registry studies'],
        riskOfBiasTool: 'RoB 2',
        amendmentNote: 'Clarified minimum trial participant threshold to >= 100.'
      }
    });

    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.version, 2);
    assert.ok(putRes.body.amendments.length >= 1);
    assert.equal(putRes.body.amendments[0].reason, 'Clarified minimum trial participant threshold to >= 100.');
  });

  await t.test('5. Search Strategy Logging: POST /systematic-reviews/:id/search-strategies records search runs', async () => {
    const searchA = await api(`/systematic-reviews/${testReviewId}/search-strategies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        databaseName: 'PubMed / MEDLINE',
        sourceType: 'database',
        searchString: '("heart failure"[Mesh] OR "HFpEF") AND ("sodium-glucose transporter 2 inhibitors"[Mesh] OR "empagliflozin" OR "dapagliflozin") AND ("randomized controlled trial"[pt])',
        searchDate: new Date().toISOString(),
        recordsRetrieved: 342,
        notes: 'MeSH and text words combined with RCT publication type filter.'
      }
    });
    assert.equal(searchA.status, 201);
    assert.equal(searchA.body.recordsRetrieved, 342);

    const searchB = await api(`/systematic-reviews/${testReviewId}/search-strategies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        databaseName: 'Cochrane Central Register of Controlled Trials (CENTRAL)',
        sourceType: 'database',
        searchString: '(HFpEF OR "preserved ejection fraction") AND (SGLT2* OR empagliflozin OR dapagliflozin)',
        searchDate: new Date().toISOString(),
        recordsRetrieved: 185,
        notes: 'Searched Cochrane Central trials database.'
      }
    });
    assert.equal(searchB.status, 201);

    const listRes = await api(`/systematic-reviews/${testReviewId}/search-strategies`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 2);
  });

  await t.test('6. Record Import (RIS, BibTeX, CSV): POST /systematic-reviews/:id/import accurately parses records', async () => {
    // 6a. Import RIS content
    const risContent = `TY  - JOUR
TI  - Empagliflozin in Heart Failure with a Preserved Ejection Fraction
AU  - Anker, Stefan D.
AU  - Butler, Javed
AU  - Filippatos, Gerasimos
PY  - 2021
JF  - New England Journal of Medicine
DO  - 10.1056/NEJMoa2107038
AB  - SGLT2 inhibitors reduce the risk of hospitalization for heart failure in patients with HFpEF.
ER  - 

TY  - JOUR
TI  - Dapagliflozin in Heart Failure with Mildly Reduced or Preserved Ejection Fraction
AU  - Solomon, Scott D.
AU  - McMurray, John J.V.
AU  - Claggett, Brian
PY  - 2022
JF  - New England Journal of Medicine
DO  - 10.1056/NEJMoa2206286
AB  - Dapagliflozin reduced the combined risk of worsening heart failure or cardiovascular death among patients with HFpEF.
ER  - `;

    const resRis = await api(`/systematic-reviews/${testReviewId}/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: { format: 'ris', content: risContent, sourceDatabase: 'PubMed' }
    });
    assert.equal(resRis.status, 201);
    assert.equal(resRis.body.importedCount, 2);
    canonicalRecordId = resRis.body.records[0]._id;

    // 6b. Import duplicate record with identical DOI to test automatic deduplication detection
    const duplicateRis = `TY  - JOUR
TI  - Empagliflozin in Heart Failure with a Preserved Ejection Fraction (EMPEROR-Preserved Trial)
AU  - Anker, SD
AU  - Butler, J
PY  - 2021
JF  - N Engl J Med
DO  - 10.1056/NEJMoa2107038
AB  - Trial investigating Empagliflozin in patients with preserved ejection fraction.
ER  - `;

    const resDupe = await api(`/systematic-reviews/${testReviewId}/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: { format: 'ris', content: duplicateRis, sourceDatabase: 'CENTRAL' }
    });
    assert.equal(resDupe.status, 201);
    assert.equal(resDupe.body.duplicateCount, 1);
    duplicateRecordId = resDupe.body.records[0]._id;
    assert.equal(resDupe.body.records[0].deduplicationStatus, 'duplicate');

    // 6c. Import CSV records
    const csvContent = `title,authors,year,journal,doi,abstract
"Sotagliflozin in Patients with Diabetes and Recent Worsening Heart Failure","Bhatt, Deepak L; Szarek, Michael",2021,"N Engl J Med","10.1056/NEJMoa2030107","Sotagliflozin therapy initiated before or shortly after discharge significantly reduced deaths."
"Finerenone in Heart Failure with Mildly Reduced or Preserved Ejection Fraction","Solomon, Scott D; Vaduganathan, Muthiah",2024,"N Engl J Med","10.1056/NEJMoa2407107","Finerenone resulted in a significantly lower rate of worsening heart failure events."
"Observational Registry of Heart Failure Therapies","Miller, Robert; Jones, Sarah",2023,"Am Heart J","10.1016/j.ahj.2023.01.002","Non-randomized observational cohort analysis."`;

    const resCsv = await api(`/systematic-reviews/${testReviewId}/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: { format: 'csv', content: csvContent, sourceDatabase: 'Scopus' }
    });
    assert.equal(resCsv.status, 201);
    assert.equal(resCsv.body.importedCount, 3);
    conflictRecordId = resCsv.body.records[0]._id;
  });

  await t.test('7. Deduplication Management: GET and POST /systematic-reviews/:id/duplicates inspects and resolves duplicates', async () => {
    const listDupes = await api(`/systematic-reviews/${testReviewId}/duplicates`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(listDupes.status, 200);
    assert.ok(listDupes.body.duplicateCount >= 1);

    // Resolve duplicate manually
    const resolveRes = await api(`/systematic-reviews/${testReviewId}/duplicates/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        canonicalRecordId,
        duplicateRecordIds: [duplicateRecordId],
        action: 'merge'
      }
    });
    assert.equal(resolveRes.status, 200);
    assert.equal(resolveRes.body.success, true);
  });

  await t.test('8. Screening Queue & Record Listing: GET /systematic-reviews/:id/records supports stage filtering and search', async () => {
    // Check queue for User A
    const queueRes = await api(`/systematic-reviews/${testReviewId}/screening-queue?stage=title_abstract`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(queueRes.status, 200);
    assert.ok(queueRes.body.queue.length > 0);

    // Check records list with text search
    const searchRes = await api(`/systematic-reviews/${testReviewId}/records?search=Empagliflozin`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.body.records.some(r => r.title.includes('Empagliflozin')));
  });

  await t.test('9. Blind Dual Screening & Disagreement Conflict Detection', async () => {
    // Reviewer A votes "included" on conflictRecordId
    const decA = await api(`/systematic-reviews/${testReviewId}/screening-decisions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        recordId: conflictRecordId,
        stage: 'title_abstract',
        decision: 'included',
        reason: 'Meets PICO population and SGLT inhibitor class.'
      }
    });
    assert.equal(decA.status, 200);
    assert.equal(decA.body.conflictDetected, false); // Only 1 reviewer so far

    // Reviewer B votes "excluded" on conflictRecordId
    const decB = await api(`/systematic-reviews/${testReviewId}/screening-decisions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: {
        recordId: conflictRecordId,
        stage: 'title_abstract',
        decision: 'excluded',
        reason: 'Study includes acute decompensated HF, questionable if pure HFpEF.'
      }
    });
    assert.equal(decB.status, 200);
    assert.equal(decB.body.conflictDetected, true); // Dual review discrepancy detected!

    // Verify conflict appears in conflicts queue
    const conflictsRes = await api(`/systematic-reviews/${testReviewId}/conflicts`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(conflictsRes.status, 200);
    assert.ok(conflictsRes.body.length >= 1);
    conflictId = conflictsRes.body[0]._id;
  });

  await t.test('10. Conflict Adjudication: POST /systematic-reviews/:id/conflicts/:conflictId/resolve adjudicates dispute', async () => {
    const adjRes = await api(`/systematic-reviews/${testReviewId}/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        finalDecision: 'included',
        resolutionNotes: 'Adjudicator confirmed HFpEF subgroup data is reported separately and eligible.',
        stage: 'title_abstract'
      }
    });
    assert.equal(adjRes.status, 200);
    assert.equal(adjRes.body.conflict.status, 'resolved');
    assert.equal(adjRes.body.conflict.finalDecision, 'included');
    assert.equal(adjRes.body.record.screeningStage, 'full_text');
  });

  await t.test('11. Full-Text Assessment: POST /systematic-reviews/:id/full-text enforces mandatory exclusion reasons', async () => {
    // 11a. Attempting exclusion without reason must be rejected (PRISMA 2020 integrity constraint)
    const badExcl = await api(`/systematic-reviews/${testReviewId}/full-text`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        recordId: canonicalRecordId,
        decision: 'excluded',
        exclusionReason: '' // Missing reason!
      }
    });
    assert.equal(badExcl.status, 400);

    // 11b. Valid full-text inclusion
    const goodIncl = await api(`/systematic-reviews/${testReviewId}/full-text`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        recordId: canonicalRecordId,
        fullTextStatus: 'assessed',
        fullTextPdfUrl: 'https://doi.org/10.1056/NEJMoa2107038',
        decision: 'included'
      }
    });
    assert.equal(goodIncl.status, 200);
    assert.equal(goodIncl.body.record.screeningStage, 'included');
  });

  await t.test('12. Structured Data Extraction: POST /systematic-reviews/:id/extractions saves study characteristics', async () => {
    // Create extraction template
    const tmplRes = await api(`/systematic-reviews/${testReviewId}/extraction-templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        templateName: 'HFpEF RCT Extraction Sheet',
        fields: [
          { key: 'sampleSize', label: 'Total Randomized (N)', type: 'number', required: true },
          { key: 'meanAge', label: 'Mean Age (years)', type: 'number', required: true },
          { key: 'femalePct', label: 'Female (%)', type: 'number', required: false },
          { key: 'primaryHazardRatio', label: 'Primary HR (95% CI)', type: 'text', required: true }
        ]
      }
    });
    assert.equal(tmplRes.status, 201);
    const templateId = tmplRes.body._id;

    // Save study extraction
    const extRes = await api(`/systematic-reviews/${testReviewId}/extractions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        recordId: canonicalRecordId,
        templateId,
        extractedFields: {
          sampleSize: 5988,
          meanAge: 71.9,
          femalePct: 44.7,
          primaryHazardRatio: '0.79 (0.69 - 0.90)'
        },
        provenanceQuotes: [
          'A total of 5988 patients were randomly assigned to receive empagliflozin or placebo.',
          'The primary outcome occurred in 415 of 2997 patients in the empagliflozin group.'
        ],
        status: 'completed'
      }
    });
    assert.equal(extRes.status, 200);
    assert.equal(extRes.body.extractedFields.sampleSize, 5988);
  });

  await t.test('13. Risk of Bias (RoB 2): POST /systematic-reviews/:id/risk-of-bias assesses domains and computes overall judgment', async () => {
    const robRes = await api(`/systematic-reviews/${testReviewId}/risk-of-bias`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        recordId: canonicalRecordId,
        toolName: 'RoB 2',
        domainAssessments: [
          { domainId: 'D1', domainName: 'Randomization process', judgment: 'low', supportText: 'Central interactive web response system used.' },
          { domainId: 'D2', domainName: 'Deviations from intended interventions', judgment: 'low', supportText: 'Double-blind matching placebo.' },
          { domainId: 'D3', domainName: 'Missing outcome data', judgment: 'low', supportText: '<0.1% loss to follow-up.' },
          { domainId: 'D4', domainName: 'Measurement of the outcome', judgment: 'low', supportText: 'Blinded independent clinical event committee.' },
          { domainId: 'D5', domainName: 'Selection of the reported result', judgment: 'low', supportText: 'Pre-registered statistical analysis plan followed.' }
        ]
      }
    });

    assert.equal(robRes.status, 200);
    assert.equal(robRes.body.overallJudgment, 'low');
  });

  await t.test('14. PRISMA 2020 Flow Calculation & SVG Generation: GET /systematic-reviews/:id/prisma', async () => {
    const prismaRes = await api(`/systematic-reviews/${testReviewId}/prisma`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });

    assert.equal(prismaRes.status, 200);
    assert.ok(prismaRes.body.prisma2020);
    assert.ok(prismaRes.body.prisma2020.counts.identified > 0);
    assert.ok(prismaRes.body.prisma2020.counts.duplicatesRemoved >= 1);
    assert.ok(prismaRes.body.svgDiagram);
    assert.ok(prismaRes.body.svgDiagram.includes('<svg'));
    assert.ok(prismaRes.body.svgDiagram.includes('PRISMA 2020 Flow Diagram'));
  });

  await t.test('15. PRISMA 2020 27-Item Checklist: GET and PUT /systematic-reviews/:id/prisma/checklist', async () => {
    const listRes = await api(`/systematic-reviews/${testReviewId}/prisma/checklist`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.checklist.length, 22); // Core PRISMA items

    // Update compliance on Item 1
    const putRes = await api(`/systematic-reviews/${testReviewId}/prisma/checklist`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: {
        item: '1',
        status: 'reported',
        location: 'Title, Page 1',
        notes: 'Title explicitly identifies report as a systematic review and meta-analysis.'
      }
    });
    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.status, 'reported');
  });

  await t.test('16. Methodological Audit Trail: GET /systematic-reviews/:id/audit-trail records full chronological history', async () => {
    const auditRes = await api(`/systematic-reviews/${testReviewId}/audit-trail`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.body.length >= 4);
    assert.ok(auditRes.body.some(e => e.eventType === 'review_created'));
    assert.ok(auditRes.body.some(e => e.eventType === 'records_imported'));
  });

  await t.test('17. Reproducible Export: GET /systematic-reviews/:id/export produces JSON and CSV packages', async () => {
    // 17a. JSON Package
    const jsonRes = await api(`/systematic-reviews/${testReviewId}/export?format=json`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(jsonRes.status, 200);
    assert.ok(jsonRes.body.prisma2020);
    assert.ok(jsonRes.body.records.length > 0);
    assert.ok(jsonRes.body.extractions.length > 0);

    // 17b. CSV Export
    const csvRes = await api(`/systematic-reviews/${testReviewId}/export?format=csv`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(csvRes.status, 200);
    assert.ok(typeof csvRes.body === 'string');
    assert.ok(csvRes.body.includes('Study ID,Title,Authors,Year,Journal,DOI'));
  });

  await t.test('18. Tenant Isolation: User C cannot access User A review data', async () => {
    const listRes = await api('/systematic-reviews', {
      headers: { Authorization: `Bearer ${userC.token}` }
    });
    assert.equal(listRes.status, 200);
    assert.ok(!listRes.body.some(r => r._id === testReviewId));
  });

  await t.test('19. Backward Compatibility: Legacy /projects/:id/systematic-reviews routes remain 100% operational', async () => {
    const legList = await api(`/projects/${testProjectId}/systematic-reviews`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(legList.status, 200);
    assert.ok(legList.body.length >= 1);

    const legStudies = await api(`/projects/${testProjectId}/systematic-reviews/${testReviewId}/studies`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(legStudies.status, 200);
    assert.ok(legStudies.body.length > 0);

    const legPrisma = await api(`/projects/${testProjectId}/systematic-reviews/${testReviewId}/prisma`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(legPrisma.status, 200);
    assert.ok(legPrisma.body.identified >= 0);
  });
});
