import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFICATION_STATUS,
  isValidDoiFormat,
  extractDoiIdentifiers,
  verifyDoiMetadata,
  parseBibliographicReferences,
  extractInTextCitations,
  detectResearchIntegrityFindings,
  performTextGuardScan
} from '../src/textGuardService.js';

test('TextGuard Advanced Filter System — Unit & Integration Test Suite', async (t) => {

  await t.test('1. Standard Verification Status Model contains all required statuses', () => {
    const requiredStatuses = [
      'verified',
      'unverified',
      'pending',
      'not_found',
      'invalid_format',
      'metadata_mismatch',
      'lookup_failed',
      'needs_review',
      'not_applicable'
    ];
    for (const st of requiredStatuses) {
      assert.ok(
        Object.values(VERIFICATION_STATUS).includes(st),
        `VERIFICATION_STATUS enum must include "${st}"`
      );
    }
  });

  await t.test('2. DOI Verification: Validates IDF 10.xxxx format and flags syntax errors', () => {
    assert.equal(isValidDoiFormat('10.1038/s41586-020-2649-2'), true);
    assert.equal(isValidDoiFormat('https://doi.org/10.1145/3318464.3389700'), true);
    assert.equal(isValidDoiFormat('doi: 10.1016/j.cell.2021.01.001'), true);
    assert.equal(isValidDoiFormat('invalid-identifier'), false);
    assert.equal(isValidDoiFormat('10.123'), false);
    assert.equal(isValidDoiFormat(''), false);

    const malformedResult = verifyDoiMetadata('malformed-doi');
    assert.equal(malformedResult.status, VERIFICATION_STATUS.INVALID_FORMAT);
    assert.equal(malformedResult.verificationStatus, 'Invalid DOI Format');
  });

  await t.test('3. DOI Verification: Distinguishes pending lookup from not found and verified', () => {
    // 3a. Verified DOI
    const knownRefs = [
      {
        doi: '10.1038/s41586-020-2649-2',
        title: 'Deep learning for classical molecular dynamics',
        authors: ['Zhang, L.', 'Han, J.', 'E, W.'],
        year: 2020,
        journal: 'Nature'
      }
    ];
    const verified = verifyDoiMetadata('10.1038/s41586-020-2649-2', knownRefs);
    assert.equal(verified.status, VERIFICATION_STATUS.VERIFIED);
    assert.equal(verified.title, 'Deep learning for classical molecular dynamics');

    // 3b. Pending lookup
    const pending = verifyDoiMetadata('10.1000/pending123', knownRefs, { pending: true });
    assert.equal(pending.status, VERIFICATION_STATUS.PENDING);
    assert.equal(pending.verificationStatus, 'Lookup Pending');

    // 3c. Not found in Crossref registry
    const notFound = verifyDoiMetadata('10.9999/notfound404', knownRefs, { simulateNotFound: true });
    assert.equal(notFound.status, VERIFICATION_STATUS.NOT_FOUND);
    assert.equal(notFound.verificationStatus, 'DOI Not Found in Crossref');

    // 3d. Retracted publication detection
    const retracted = verifyDoiMetadata('10.1016/s0140-6736(97)11096-0', knownRefs);
    assert.equal(retracted.isRetracted, true);
    assert.ok(retracted.retractionNotice);
  });

  await t.test('4. Bibliographic Reference Parser: Extracts items and flags completeness', () => {
    const rawManuscript = `
Introduction
This research evaluates transformers for academic synthesis (Vaswani et al., 2017).
Furthermore, deep residual learning revolutionized computer vision (He et al., 2016).

References
[1] Vaswani, A., Shazeer, N., Parmar, N. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30. doi: 10.5555/3295222.3295349
[2] He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep residual learning for image recognition. IEEE CVPR.
[3] Incomplete Ref with no year or publisher
    `;

    const parsedRefs = parseBibliographicReferences(rawManuscript);
    assert.ok(parsedRefs.length >= 2, `Expected at least 2 references, got ${parsedRefs.length}`);

    const hasDoiRef = parsedRefs.find(r => r.doi);
    assert.ok(hasDoiRef, 'Should extract reference with DOI');

    const incompleteRef = parsedRefs.find(r => r.isIncomplete);
    assert.ok(incompleteRef, 'Should detect incomplete reference items missing authors/year');
  });

  await t.test('5. In-Text Citation Extraction & Bidirectional Matching', () => {
    const rawManuscript = `
Recent advances in deep learning (Vaswani et al., 2017) and residual representations (He et al., 2016)
have demonstrated remarkable accuracy. However, ungrounded claims (Ghost et al., 2099) lack support.

References
1. Vaswani, A., Shazeer, N., Parmar, N. (2017). Attention is all you need. NIPS.
2. He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep residual learning for image recognition. IEEE CVPR.
    `;

    const parsedRefs = parseBibliographicReferences(rawManuscript);
    const citations = extractInTextCitations(rawManuscript, parsedRefs);

    assert.ok(citations.length >= 2, `Expected at least 2 in-text citations, got ${citations.length}`);

    const matchedCitation = citations.find(c => c.rawCitation.includes('Vaswani'));
    assert.ok(matchedCitation, 'Should extract Vaswani citation');
    assert.equal(matchedCitation.matchStatus, 'verified', 'Vaswani should match bibliography');

    const unmatchedCitation = citations.find(c => c.rawCitation.includes('Ghost'));
    assert.ok(unmatchedCitation, 'Should extract Ghost citation');
    assert.equal(unmatchedCitation.matchStatus, 'unmatched', 'Ghost citation should be flagged as unmatched');
    assert.equal(unmatchedCitation.missingBibliography, true);
  });

  await t.test('6. Research Integrity Findings Detection: Empirical and Methodological anomalies', () => {
    const anomalousText = `
The empirical evaluation showed that p = 0.08, yet the experimental intervention demonstrated statistically significant improvement across all primary cohorts.
In addition, our factorial ANOVA model revealed comprehensive group benefits without reporting main effects or interactions.
    `;

    const findings = detectResearchIntegrityFindings(
      anomalousText,
      [],
      { references: [] },
      []
    );

    assert.ok(findings.length >= 1, 'Should detect empirical integrity findings');
    const numericalFinding = findings.find(f => f.type === 'numerical_inconsistency');
    assert.ok(numericalFinding, 'Should flag numerical inconsistency when p > 0.05 is claimed as significant');
    assert.equal(numericalFinding.severity, 'high');
  });

  await t.test('7. Full TextGuard Scan returns structured filterable payloads', () => {
    const manuscript = `
The attention mechanism allows modelling dependencies without regard to distance (Vaswani et al., 2017).
Empirical evaluation indicates p = 0.001 with high significance across treatment cohorts.

References
1. Vaswani, A., Shazeer, N., Parmar, N. (2017). Attention is all you need. NeurIPS. doi: 10.5555/3295222.3295349
    `;

    const result = performTextGuardScan(manuscript, {
      excludeQuotes: true,
      excludeReferences: false
    });

    assert.ok(result.scanId, 'Scan ID must be generated');
    assert.ok(Array.isArray(result.matchedPassages), 'matchedPassages must be an array');
    assert.ok(Array.isArray(result.bibliographicReferences), 'bibliographicReferences must be an array');
    assert.ok(Array.isArray(result.inTextCitations), 'inTextCitations must be an array');
    assert.ok(Array.isArray(result.integrityFindings), 'integrityFindings must be an array');
    assert.ok(result.doiVerification, 'doiVerification object must be present');

    // Check enriched passage metadata
    if (result.matchedPassages.length > 0) {
      const p = result.matchedPassages[0];
      assert.ok(p.similarityTier, 'Passage must have similarityTier');
      assert.ok(p.matchCategory, 'Passage must have matchCategory');
      assert.ok(p.sourceType, 'Passage must have sourceType');
    }
  });
});
