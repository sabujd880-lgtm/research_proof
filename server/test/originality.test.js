import test from 'node:test';
import assert from 'node:assert/strict';
import { assessOriginality, findRepeatedPhrases, assessAiAuthorship, assessPlagiarismAndSimilarity } from '../src/services.js';

test('ResearchProof AI — Originality & Similarity Audit Suite', async (t) => {
  await t.test('1. assessOriginality returns expected structure for normal academic text', () => {
    const text = 'Recent longitudinal studies demonstrate significant correlations between sleep architecture and memory consolidation in young adults. These findings elucidate the neural mechanisms underpinning synaptic plasticity during slow-wave oscillations.';
    const result = assessOriginality(text);

    assert.equal(typeof result.originalityScore, 'number');
    assert.ok(result.originalityScore >= 80, `Expected score >= 80, got ${result.originalityScore}`);
    assert.equal(result.originalityLevel, 'high');
    assert.ok(result.lexicalDiversity > 60);
    assert.ok(result.uniqueWordsCount > 15);
    assert.ok(Array.isArray(result.duplicatePassages));
    assert.ok(Array.isArray(result.formulaicPhrases));
    assert.ok(Array.isArray(result.repeatedPhrases));
    assert.ok(Array.isArray(result.observations));
  });

  await t.test('2. assessOriginality detects identical repeated paragraphs or sentences', () => {
    const repeated = 'The experimental protocol was conducted according to international bioethical standards with informed consent gathered from all human participants.';
    const doc = `${repeated}\n\nIntermediate filler content to separate paragraphs in the test suite.\n\n${repeated}`;

    const result = assessOriginality(doc);
    assert.ok(result.duplicatePassages.length >= 1, 'Should detect duplicate passage');
    assert.equal(result.duplicatePassages[0].count, 2);
    assert.ok(result.originalityScore < 95);
  });

  await t.test('3. assessOriginality flags overused academic clichés and recommends alternatives', () => {
    const text = 'At the end of the day, it goes without saying that the results are crystal clear and pave the way for future studies.';
    const result = assessOriginality(text);

    assert.ok(result.formulaicPhrases.length >= 2, 'Should detect multiple clichés');
    const cliches = result.formulaicPhrases.map(f => f.phrase);
    assert.ok(cliches.includes('at the end of the day'));
    assert.ok(cliches.includes('it goes without saying') || cliches.includes('crystal clear') || cliches.includes('pave the way'));
    assert.ok(result.formulaicPhrases[0].suggestion.length > 0);
  });

  await t.test('4. assessOriginality detects internal 5-8 word n-gram repetitions', () => {
    const phrase = 'the primary objective of the present investigation';
    const text = `${phrase} physiological markers. Earlier sections showed that ${phrase} clinical outcomes.`;
    const result = assessOriginality(text);

    assert.ok(result.repeatedPhrases.length >= 1);
    assert.ok(result.repeatedPhrases.some(p => p.phrase === 'the primary objective of the' && p.count === 2));
  });

  await t.test('5. Backward compatibility: findRepeatedPhrases continues to function identically', () => {
    const phrase = 'comprehensive evaluation of molecular biological indicators';
    const text = `A ${phrase} was carried out. In chapter 3, a ${phrase} will be analyzed.`;
    const phrases = findRepeatedPhrases(text);

    assert.ok(phrases.length >= 1);
    assert.ok(phrases.some(p => p.phrase.includes('comprehensive evaluation of molecular') && p.count === 2));
  });

  await t.test('6. Graceful handling of empty or ultra-short input', () => {
    const emptyResult = assessOriginality('');
    assert.equal(emptyResult.wordCount, 0);
    assert.equal(emptyResult.originalityScore, 100);
    assert.equal(emptyResult.repeatedPhrases.length, 0);

    const singleWord = assessOriginality('Hello');
    assert.equal(singleWord.wordCount, 1);
    assert.ok(singleWord.originalityScore >= 90);
  });

  await t.test('7. assessAiAuthorship returns advisory indicators, uncertainty band, and burstiness', async () => {
    const text = 'The empirical investigation revealed noticeable variations in synaptic density across cortical regions. However, subsequent assays demonstrated inconsistent replicability under differing temperature parameters. Further histological examination remains indispensable.';
    const result = assessAiAuthorship(text);

    assert.equal(typeof result.aiLikelihood, 'number');
    assert.equal(typeof result.humanLikelihood, 'number');
    assert.equal(result.aiLikelihood + result.humanLikelihood, 100);
    assert.ok(result.uncertaintyBand.includes('±'));
    assert.ok(result.advisoryNotice.includes('ADVISORY ONLY'));
    assert.ok(typeof result.burstinessScore === 'number');
    assert.ok(Array.isArray(result.indicators));
  });

  await t.test('8. assessAiAuthorship detects formulaic AI clichés and flags them', async () => {
    const aiText = 'In conclusion, it is important to delve into the ever-evolving landscape of machine intelligence, which serves as a testament to human ingenuity and a beacon of technological progress.';
    const result = assessAiAuthorship(aiText);

    assert.ok(result.flaggedSegments.length >= 2, 'Should detect formulaic AI clichés');
    assert.ok(result.aiLikelihood > 20);
    assert.ok(result.advisoryNotice.length > 0);
  });

  await t.test('9. assessPlagiarismAndSimilarity excludes quotations and reference list when configured', async () => {
    const text = `The introduction discusses preliminary hypotheses.\n\n"This is a very long direct quotation from a previous publication that should be excluded from matching."\n\nDiscussion section expands upon findings.\n\nReferences\n1. Smith, J. (2020). Previous study on synaptic plasticity. Nature, 10.1038/s41586-020-0001-x.`;
    const result = assessPlagiarismAndSimilarity(text, { excludeQuotes: true, excludeReferences: true });

    assert.ok(result.excludedContent.quotationsCount >= 1);
    assert.equal(result.excludedContent.referencesExcluded, true);
    assert.ok(result.excludedContent.wordsExcluded > 10);
    assert.ok(result.disclaimer.includes('Similarity does not equate to plagiarism'));
  });

  await t.test('10. assessPlagiarismAndSimilarity detects internal matched passages and links DOI citations', async () => {
    const repeated = 'The experimental protocol was conducted according to international bioethical standards.';
    const text = `${repeated} As demonstrated in prior work (10.1038/s41586-020-0001-x).\n\nFollow-up observations were documented.\n\n${repeated}`;
    const result = assessPlagiarismAndSimilarity(text);

    assert.ok(result.matchedPassages.length >= 1);
    assert.ok(result.matchedPassages.some(p => p.sourceLink && p.sourceLink.includes('doi.org')));
    assert.ok(typeof result.similarityScore === 'number');
  });
});
