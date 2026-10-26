import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_THESIS_CHAPTERS, scanCrossChapterConsistency, synchronizeProjectBibliography } from '../src/thesisService.js';
import { generateComprehensiveDossier, checkStatisticalRigor, PUBLISHER_PROFILES } from '../src/dossierService.js';

test('ResearchProof AI — Thesis Hierarchy & Integrity Dossier Suite', async (t) => {
  await t.test('1. STANDARD_THESIS_CHAPTERS contains 7 standard graduate dissertation chapters', () => {
    assert.equal(STANDARD_THESIS_CHAPTERS.length, 7);
    const keys = STANDARD_THESIS_CHAPTERS.map(c => c.key);
    assert.ok(keys.includes('front_matter'));
    assert.ok(keys.includes('chapter_1'));
    assert.ok(keys.includes('chapter_2'));
    assert.ok(keys.includes('chapter_3'));
    assert.ok(keys.includes('chapter_4'));
    assert.ok(keys.includes('chapter_5'));
    assert.ok(keys.includes('back_matter'));
  });

  await t.test('2. scanCrossChapterConsistency detects duplicate paragraphs and discrepant sample sizes', () => {
    const chapters = [
      {
        key: 'ch1',
        title: 'Chapter 1: Introduction',
        content: 'This study investigates cognitive attention. Participants were recruited from academic campuses. All procedures conformed to ethical guidelines.'
      },
      {
        key: 'ch3',
        title: 'Chapter 3: Methodology',
        content: 'Target sample size was N = 120 participants. All procedures conformed to ethical guidelines.'
      },
      {
        key: 'ch4',
        title: 'Chapter 4: Results',
        content: 'Data was finalized for N = 95 participants after attrition. Results demonstrated significant variance.'
      }
    ];

    const result = scanCrossChapterConsistency(chapters);
    assert.equal(result.totalChapters, 3);
    assert.ok(result.statisticalInconsistencies.length >= 1);
    assert.ok(result.statisticalInconsistencies[0].title.includes('Discrepant Sample Sizes'));
  });

  await t.test('3. synchronizeProjectBibliography compiles master BibTeX and identifies citations', () => {
    const chapters = [
      {
        title: 'Chapter 1',
        content: 'Prior literature suggests neural plasticity plays a pivotal role (10.1038/s41586-020-0001-x; Smith, 2020).'
      },
      {
        title: 'Chapter 2',
        content: 'As demonstrated by Johnson (2021), behavioral metrics show consistent trends (10.1016/j.cell.2021.05.001).'
      }
    ];

    const existingCitations = [
      {
        _id: 'cit-1',
        title: 'Synaptic Plasticity',
        author: 'Smith, J.',
        year: '2020',
        journal: 'Nature',
        doi: '10.1038/s41586-020-0001-x'
      }
    ];

    const result = synchronizeProjectBibliography(chapters, existingCitations);
    assert.ok(result.totalUniqueDois >= 2);
    assert.ok(result.bibtexContent.includes('@article{smith2020'));
    assert.equal(result.masterReferenceCount, 1);
  });

  await t.test('4. checkStatisticalRigor identifies p-values, sample sizes, and invalid p = .000', () => {
    const text = 'The experiment yielded significant differences, F(2, 98) = 8.42, p = .000, 95% CI [0.15, 0.85]. Total cohort was N = 100.';
    const result = checkStatisticalRigor(text);

    assert.ok(result.totalPValuesReported >= 1);
    assert.ok(result.confidenceIntervalsCount >= 1);
    assert.ok(result.issues.some(i => i.message.includes('p < .001')));
  });

  await t.test('5. generateComprehensiveDossier creates SHA-256 hash, QR SVG, and publisher profiles', async () => {
    const text = `# Empirical Investigation into Distributed Synaptic Consolidation
## Abstract
We examine neural mechanisms of memory retention using computational modeling.
## Data Availability
All relevant data are deposited in Zenodo (doi:10.5281/zenodo.123456).
## Competing Interests
The authors declare no competing financial or professional interests.
## Results
A repeated measures ANOVA indicated F(2, 58) = 12.3, p = 0.002, 95% CI [0.20, 0.65]. Total sample was N = 60.
## References
10.1038/s41586-020-0001-x
`;

    const dossier = await generateComprehensiveDossier({
      text,
      title: 'Neural Mechanisms Dissertation',
      documentId: 'doc-123',
      ownerId: 'user-456'
    });

    assert.ok(dossier.reportId.startsWith('RP-DOSSIER-'));
    assert.ok(typeof dossier.compositeIntegrityScore === 'number');
    assert.equal(typeof dossier.verificationHash, 'string');
    assert.equal(dossier.verificationHash.length, 64); // SHA-256 is 64 hex characters
    assert.ok(dossier.qrSvg.includes('<svg'));
    assert.ok(dossier.publisherProfiles.length >= 5);
    const nature = dossier.publisherProfiles.find(p => p.id === 'nature');
    assert.ok(nature);
    assert.equal(nature.isCompliant, true);
  });
});
