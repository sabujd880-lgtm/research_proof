const STOP = new Set(['the','and','for','that','with','this','from','were','have','has','are','was','into','their','there','which','these','those','been','being','also','than','then','when','where','while','using','used','such','not','but','can','may','might','could','would','should','our','its','they','them','study','research']);

export function assessWriting(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 35).length;
  const repeatedOpeners = {};
  for (const sentence of sentences) {
    const first = sentence.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
    if (first) repeatedOpeners[first] = (repeatedOpeners[first] || 0) + 1;
  }
  const repeated = Object.entries(repeatedOpeners).filter(([, n]) => n >= 3).map(([phrase, count]) => ({ phrase, count }));
  const observations = [];
  if (longSentences) observations.push({ level: 'review', title: 'Long sentences', detail: `${longSentences} sentence(s) exceed 35 words. Review whether they can be made clearer.` });
  if (repeated.length) observations.push({ level: 'review', title: 'Repeated sentence openings', detail: 'Some sentence openings recur several times; vary them only where it improves clarity.', items: repeated });
  if (words.length < 80) observations.push({ level: 'info', title: 'Short sample', detail: 'This sample is too short for meaningful style-pattern interpretation.' });
  observations.push({ level: 'info', title: 'Authorship limitation', detail: 'These are writing-quality heuristics. They cannot determine whether text was written by a human or AI.' });
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    averageWordsPerSentence: sentences.length ? Math.round(words.length / sentences.length * 10) / 10 : 0,
    observations,
    verdict: 'No authorship verdict generated'
  };
}

export function findRepeatedPhrases(text) {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  const found = new Map();
  for (let n = 5; n <= 8; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phraseWords = words.slice(i, i + n);
      if (phraseWords.every(w => STOP.has(w))) continue;
      const phrase = phraseWords.join(' ');
      found.set(phrase, (found.get(phrase) || 0) + 1);
    }
  }
  return [...found.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([phrase, count]) => ({ phrase, count, note: 'Repeated within this document; not an internet or database similarity match.' }));
}

/**
 * Extracts DOI strings from arbitrary text
 */
function extractDOIs(text) {
  const regex = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches.map(d => d.replace(/[,.;:)]$/, '')))];
}

/**
 * Fetches DOI metadata from public Crossref API with a timeout
 */
async function fetchCrossrefMetadata(doi) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ResearchProof-AI/1.0 (mailto:support@researchproof.org)'
      },
      signal: controller.signal
    });
    if (!res.ok) {
      return { doi, verified: false, status: res.status === 404 ? 'Not found in Crossref' : `HTTP ${res.status}` };
    }
    const data = await res.json();
    const message = data.message || {};
    const authors = (message.author || []).map(a => `${a.family || ''} ${a.given || ''}`.trim()).filter(Boolean);
    const publishedYear = message['published-print']?.['date-parts']?.[0]?.[0] ||
                          message['published-online']?.['date-parts']?.[0]?.[0] ||
                          message['issued']?.['date-parts']?.[0]?.[0] || null;
    const title = Array.isArray(message.title) ? message.title[0] : (message.title || '');
    const container = Array.isArray(message['container-title']) ? message['container-title'][0] : '';

    return {
      doi,
      verified: true,
      title,
      authors: authors.slice(0, 4),
      year: publishedYear,
      journal: container,
      verifiedAt: new Date().toISOString()
    };
  } catch (err) {
    return { doi, verified: false, status: err.name === 'AbortError' ? 'Lookup timed out' : 'Service unavailable' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkCitations(text) {
  const citations = [...text.matchAll(/\(([^()]{1,120}?(?:19|20)\d{2}[a-z]?[^()]*)\)/g)].map(m => m[1].trim());
  const refHeading = /references|bibliography|works cited/i.exec(text);
  const referenceSection = refHeading ? text.slice(refHeading.index + refHeading[0].length) : '';
  const referenceLines = referenceSection.split(/\n/).map(s => s.trim()).filter(Boolean);
  const issues = [];
  
  if (citations.length && !refHeading) {
    issues.push({ level: 'warning', detail: 'In-text citation-like patterns were found, but no References/Bibliography heading was detected.' });
  }
  if (refHeading && !referenceLines.length) {
    issues.push({ level: 'warning', detail: 'A references heading was found, but no reference entries were detected after it.' });
  }
  if (!citations.length) {
    issues.push({ level: 'info', detail: 'No parenthetical author-year citations were detected by this basic checker. Other citation styles may not be recognised.' });
  }
  if (referenceLines.some(line => !/\b(19|20)\d{2}\b/.test(line))) {
    issues.push({ level: 'review', detail: 'One or more reference lines may be missing a four-digit publication year. Check manually.' });
  }

  // Crossref DOI Verification (Architecture Section 9)
  const detectedDOIs = extractDOIs(text);
  const doiVerifications = [];
  if (detectedDOIs.length > 0) {
    // Check up to 5 DOIs per run to keep latency low
    const targetDOIs = detectedDOIs.slice(0, 5);
    const lookups = await Promise.all(targetDOIs.map(doi => fetchCrossrefMetadata(doi)));
    for (const res of lookups) {
      doiVerifications.push(res);
      if (!res.verified) {
        issues.push({
          level: 'warning',
          detail: `DOI ${res.doi} could not be confirmed via Crossref (${res.status || 'Unresolved'}). Verify citation manually.`
        });
      }
    }
  }

  return {
    detectedAuthorYearCitations: citations,
    referenceEntryCount: referenceLines.length,
    detectedDOIs,
    doiVerifications,
    issues,
    limitation: 'Crossref verification confirms DOI metadata existence only; it does not confirm whether the cited source supports your scientific claim.'
  };
}

export async function humanizeWithAI({ text, style, preserveTerms = '' }) {
  const key = process.env.AI_API_KEY;
  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL;
  if (!key || !model) {
    const error = new Error('AI service is not configured. Set AI_API_KEY and AI_MODEL in server/.env.');
    error.status = 503;
    throw error;
  }
  const system = `You are an academic writing editor focused on research integrity. Revise text for clarity, natural scholarly expression, and readability. This is editing, not detector evasion. Preserve the author's claims, uncertainty, methods, results, numbers, quotations, citations, technical terms, and limitations. Do not add evidence, references, facts, or conclusions. Do not silently change scientific meaning. If a sentence is ambiguous, preserve it as closely as possible and note the ambiguity. Return valid JSON with keys revisedText, changeSummary, and cautions (array of strings).`;
  const user = `Style: ${style || 'Natural Scholarly'}\nTerms to preserve: ${preserveTerms || '(preserve all domain-specific terms)'}\n\nText to edit:\n${text}`;
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`AI provider request failed (${response.status}). ${body.slice(0, 300)}`);
    error.status = 502;
    throw error;
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw Object.assign(new Error('AI provider returned an empty response.'), { status: 502 });
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.revisedText !== 'string') throw new Error('Missing revisedText');
    return {
      revisedText: parsed.revisedText,
      changeSummary: String(parsed.changeSummary || ''),
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions.map(String) : []
    };
  } catch {
    throw Object.assign(new Error('AI provider returned an unexpected response format.'), { status: 502 });
  }
}
