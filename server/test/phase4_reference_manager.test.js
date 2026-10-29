import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import { memDoiCache } from '../src/citationService.js';

let server;
let pipeName;

function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    const req = http.request({
      socketPath: pipeName,
      path,
      method: options.method || 'GET',
      headers: {
        'x-forwarded-for': '127.0.0.1',
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...(options.headers || {})
      }
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
  pipeName = `\\\\.\\pipe\\rp-phase4-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(pipeName, resolve);
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ResearchProof AI — Phase 4 Reference & Citation Manager Suite', async (t) => {
  let userAToken = '';
  let userBToken = '';
  let userAId = '';
  let userBId = '';
  const userAEmail = `phase4-refuserA-${Date.now()}@university.edu`;
  const userBEmail = `phase4-refuserB-${Date.now()}@university.edu`;
  const userPassword = 'RigorPassword123!';

  let collectionId = '';
  let referenceId1 = '';
  let referenceId2 = '';
  let referenceId3 = '';

  await t.test('1. Setup User A and User B accounts', async () => {
    const resA = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Dr. Jane Reference', email: userAEmail, password: userPassword, institution: 'MIT' }
    });
    assert.strictEqual(resA.status, 201);
    userAToken = resA.body.token;
    userAId = resA.body.user.id;
    assert.ok(userAToken);

    const resB = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Prof. John Isolation', email: userBEmail, password: userPassword, institution: 'Stanford' }
    });
    assert.strictEqual(resB.status, 201);
    userBToken = resB.body.token;
    userBId = resB.body.user.id;
    assert.ok(userBToken);
  });

  await t.test('2. Unauthenticated requests to Reference endpoints return 401 Unauthorized', async () => {
    const resList = await api('/api/v1/references');
    assert.strictEqual(resList.status, 401);

    const resCollections = await api('/api/v1/reference-collections');
    assert.strictEqual(resCollections.status, 401);
  });

  await t.test('3. Reference Collections CRUD works properly', async () => {
    // Create collection
    const createRes = await api('/api/v1/reference-collections', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: {
        name: 'Quantum Computing Literature',
        description: 'Papers on quantum entanglement and quantum supremacy',
        color: '#5e6ad2',
        icon: 'atom'
      }
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.collection.name, 'Quantum Computing Literature');
    collectionId = createRes.body.collection.id || createRes.body.collection._id;
    assert.ok(collectionId);

    // List collections
    const listRes = await api('/api/v1/reference-collections', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.collections));
    assert.strictEqual(listRes.body.collections.length, 1);
    assert.strictEqual(listRes.body.collections[0].name, 'Quantum Computing Literature');

    // Update collection
    const updateRes = await api(`/api/v1/reference-collections/${collectionId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { name: 'Quantum & Classical Algorithms', color: '#10b981' }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.collection.name, 'Quantum & Classical Algorithms');
    assert.strictEqual(updateRes.body.collection.color, '#10b981');
  });

  await t.test('4. DOI Lookup endpoint returns structured metadata or error on invalid DOI', async () => {
    // Valid pre-seeded DOI
    const validDoi = '10.1038/s41586-020-2649-2';
    memDoiCache.set(validDoi, {
      title: 'Array programming with NumPy',
      authors: [{ family: 'Harris', given: 'Charles R.' }],
      year: '2020',
      journal: 'Nature',
      volume: '585',
      pages: '357-362',
      doi: validDoi,
      url: `https://doi.org/${validDoi}`
    });
    const doiRes = await api(`/api/v1/references/lookup/doi?doi=${encodeURIComponent(validDoi)}`, {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(doiRes.status, 200);
    assert.ok(doiRes.body.reference);
    assert.strictEqual(doiRes.body.reference.doi, validDoi);
    assert.ok(doiRes.body.reference.title);

    // Invalid DOI
    const invalidRes = await api('/api/v1/references/lookup/doi?doi=invalid-doi-format', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(invalidRes.status, 400);
    assert.ok(invalidRes.body.error);
  });

  await t.test('5. Scholarly Search returns query results with sourceProvider', async () => {
    const searchRes = await api('/api/v1/references/search/scholarly?q=quantum+computing&limit=3', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(searchRes.status, 200);
    assert.ok(Array.isArray(searchRes.body.results));
    assert.ok(searchRes.body.results.length > 0);
    assert.ok(searchRes.body.results[0].title);
    assert.ok(searchRes.body.results[0].sourceProvider);
  });

  await t.test('6. POST /api/v1/references creates a structured reference and validates required fields', async () => {
    // Missing title rejected
    const badRes = await api('/api/v1/references', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { publicationYear: '2024' }
    });
    assert.strictEqual(badRes.status, 400);

    // Valid reference 1: Journal Article
    const ref1Res = await api('/api/v1/references', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: {
        title: 'Quantum Advantage in Scientific Discovery',
        type: 'journal-article',
        authors: [
          { given: 'Alice', family: 'Smith' },
          { given: 'Bob', family: 'Jones' }
        ],
        publicationYear: '2024',
        journal: 'Nature Physics',
        volume: '20',
        issue: '4',
        pages: '512-520',
        doi: '10.1038/s41567-024-001',
        collectionIds: [collectionId],
        tags: ['quantum', 'supremacy'],
        isFavorite: true
      }
    });
    assert.strictEqual(ref1Res.status, 201);
    assert.strictEqual(ref1Res.body.reference.title, 'Quantum Advantage in Scientific Discovery');
    assert.strictEqual(ref1Res.body.reference.authors.length, 2);
    referenceId1 = ref1Res.body.reference.id || ref1Res.body.reference._id;
    assert.ok(referenceId1);

    // Valid reference 2: Book with 3 authors
    const ref2Res = await api('/api/v1/references', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: {
        title: 'Foundations of Quantum Algorithms',
        type: 'book',
        authors: [
          { given: 'Carol', family: 'Williams' },
          { given: 'David', family: 'Brown' },
          { given: 'Eva', family: 'Davis' }
        ],
        publicationYear: '2023',
        publisher: 'Oxford University Press',
        collectionIds: [collectionId],
        tags: ['textbook']
      }
    });
    assert.strictEqual(ref2Res.status, 201);
    referenceId2 = ref2Res.body.reference.id || ref2Res.body.reference._id;
    assert.ok(referenceId2);
  });

  await t.test('7. GET /api/v1/references lists references with pagination headers, search, and type filters', async () => {
    // List all with paginated=true
    const paginatedRes = await api('/api/v1/references?paginated=true', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(paginatedRes.status, 200);
    assert.ok(Array.isArray(paginatedRes.body.references));
    assert.strictEqual(paginatedRes.body.references.length, 2);
    assert.strictEqual(paginatedRes.headers['x-total-count'], '2');

    // List all raw array
    const rawRes = await api('/api/v1/references', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(rawRes.status, 200);
    assert.ok(Array.isArray(rawRes.body));
    assert.strictEqual(rawRes.body.length, 2);

    // Filter by type
    const bookRes = await api('/api/v1/references?type=book&paginated=true', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(bookRes.status, 200);
    assert.strictEqual(bookRes.body.references.length, 1);
    assert.strictEqual(bookRes.body.references[0].type, 'book');

    // Filter by search query
    const searchRes = await api('/api/v1/references?search=Advantage&paginated=true', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.references.length, 1);
    assert.strictEqual(searchRes.body.references[0].title, 'Quantum Advantage in Scientific Discovery');
  });

  await t.test('8. GET /api/v1/references/:id and PATCH /api/v1/references/:id work properly', async () => {
    // Get single reference
    const getRes = await api(`/api/v1/references/${referenceId1}`, {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.reference.title, 'Quantum Advantage in Scientific Discovery');

    // Update reference
    const patchRes = await api(`/api/v1/references/${referenceId1}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { notes: 'Crucial paper for the literature review chapter 2.' }
    });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.body.reference.notes, 'Crucial paper for the literature review chapter 2.');
  });

  await t.test('9. BibTeX and RIS Import endpoints parse citations and create references', async () => {
    // Import BibTeX
    const bibtexSnippet = `@article{einstein1905,
      author = {Albert Einstein},
      title = {Zur Elektrodynamik bewegter K{\\"o}rper},
      journal = {Annalen der Physik},
      year = {1905},
      volume = {17},
      pages = {891--921}
    }`;
    const bibRes = await api('/api/v1/references/import/bibtex', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { bibtex: bibtexSnippet }
    });
    assert.strictEqual(bibRes.status, 201);
    assert.strictEqual(bibRes.body.importedCount, 1);
    assert.ok(bibRes.body.references[0].title.includes('Elektrodynamik'));
    referenceId3 = bibRes.body.references[0].id || bibRes.body.references[0]._id;

    // Import RIS
    const risSnippet = `TY  - JOUR
TI  - General Theory of Relativity
AU  - Einstein, Albert
PY  - 1916
JF  - Annalen der Physik
ER  - `;
    const risRes = await api('/api/v1/references/import/ris', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { ris: risSnippet }
    });
    assert.strictEqual(risRes.status, 201);
    assert.strictEqual(risRes.body.importedCount, 1);
  });

  await t.test('10. Duplicate Detection and Merge endpoints identify and consolidate records', async () => {
    // Add a potential duplicate of reference 1
    const dupRes = await api('/api/v1/references', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: {
        title: 'Quantum Advantage in Scientific Discovery',
        doi: '10.1038/s41567-024-001',
        publicationYear: '2024'
      }
    });
    assert.strictEqual(dupRes.status, 201);
    const dupId = dupRes.body.reference.id || dupRes.body.reference._id;

    // Check duplicates
    const checkDupRes = await api('/api/v1/references/duplicates', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(checkDupRes.status, 200);
    assert.ok(Array.isArray(checkDupRes.body.duplicateGroups));
    assert.ok(checkDupRes.body.duplicateGroups.length > 0);

    // Merge duplicates: merge dupId into referenceId1
    const mergeRes = await api('/api/v1/references/merge', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: {
        primaryId: referenceId1,
        secondaryId: dupId
      }
    });
    assert.strictEqual(mergeRes.status, 200);
    assert.strictEqual(mergeRes.body.success, true);
    assert.strictEqual(mergeRes.body.mergedReference.id, referenceId1);

    // Confirm dupId is deleted
    const getDupRes = await api(`/api/v1/references/${dupId}`, {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(getDupRes.status, 404);
  });

  await t.test('11. CSL Citation Formatting Engine formats APA 7, MLA 9, Chicago 17, Vancouver, IEEE, Harvard', async () => {
    // 1 Author APA 7
    const singleAuthorRef = {
      title: 'A Theory of Justice',
      authors: [{ given: 'John', family: 'Rawls' }],
      publicationYear: '1971',
      publisher: 'Harvard University Press',
      type: 'book'
    };
    const apaSingleRes = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: singleAuthorRef, style: 'apa7', type: 'parenthetical' }
    });
    assert.strictEqual(apaSingleRes.status, 200);
    assert.strictEqual(apaSingleRes.body.citation, '(Rawls, 1971)');

    // 2 Authors APA 7
    const twoAuthorRef = {
      title: 'Thinking, Fast and Slow',
      authors: [{ given: 'Daniel', family: 'Kahneman' }, { given: 'Amos', family: 'Tversky' }],
      publicationYear: '1974'
    };
    const apaTwoRes = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: twoAuthorRef, style: 'apa7', type: 'parenthetical' }
    });
    assert.strictEqual(apaTwoRes.body.citation, '(Kahneman & Tversky, 1974)');

    const apaTwoNarrative = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: twoAuthorRef, style: 'apa7', type: 'narrative' }
    });
    assert.strictEqual(apaTwoNarrative.body.citation, 'Kahneman and Tversky (1974)');

    // 3+ Authors APA 7
    const threeAuthorRef = {
      title: 'Deep Learning Architectures',
      authors: [
        { given: 'Yann', family: 'LeCun' },
        { given: 'Yoshua', family: 'Bengio' },
        { given: 'Geoffrey', family: 'Hinton' }
      ],
      publicationYear: '2015'
    };
    const apaThreeRes = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: threeAuthorRef, style: 'apa7', type: 'parenthetical' }
    });
    assert.strictEqual(apaThreeRes.body.citation, '(LeCun et al., 2015)');

    // Corporate author
    const corpRef = {
      title: 'World Health Statistics',
      authors: [{ name: 'World Health Organization' }],
      publicationYear: '2023'
    };
    const apaCorpRes = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: corpRef, style: 'apa7', type: 'parenthetical' }
    });
    assert.strictEqual(apaCorpRes.body.citation, '(World Health Organization, 2023)');

    // No date
    const noDateRef = {
      title: 'Clinical Practice Guidelines',
      authors: [{ given: 'Alice', family: 'Smith' }]
    };
    const apaNoDateRes = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: noDateRef, style: 'apa7', type: 'parenthetical' }
    });
    assert.strictEqual(apaNoDateRes.body.citation, '(Smith, n.d.)');

    // MLA 9 format
    const mlaRes = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: singleAuthorRef, style: 'mla9', type: 'parenthetical' }
    });
    assert.strictEqual(mlaRes.body.citation, '(Rawls)');

    // IEEE format
    const ieeeRes = await api('/api/v1/references/format', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: { reference: singleAuthorRef, style: 'ieee', type: 'parenthetical' }
    });
    assert.strictEqual(ieeeRes.body.citation, '[1]');
  });

  await t.test('12. Bibliography Generation generates plaintext, HTML with hanging indent, BibTeX, and RIS', async () => {
    const biblioRes = await api('/api/v1/references/bibliography', {
      method: 'POST',
      headers: { authorization: `Bearer ${userAToken}` },
      body: {
        referenceIds: [referenceId1, referenceId2],
        style: 'apa7',
        format: 'html'
      }
    });
    assert.strictEqual(biblioRes.status, 200);
    assert.ok(biblioRes.body.bibliography);
    assert.ok(biblioRes.body.bibliography.includes('csl-entry'));
    assert.ok(biblioRes.body.bibliography.includes('padding-left: 2em'));
    assert.strictEqual(biblioRes.body.count, 2);
  });

  await t.test('13. Export endpoint exports collection or library as BibTeX and RIS files', async () => {
    // BibTeX Export
    const bibExport = await api('/api/v1/references/export?format=bibtex', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(bibExport.status, 200);
    assert.ok(bibExport.rawBuffer.toString('utf8').includes('@'));

    // RIS Export
    const risExport = await api('/api/v1/references/export?format=ris', {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(risExport.status, 200);
    assert.ok(risExport.rawBuffer.toString('utf8').includes('TY  - '));
  });

  await t.test('14. Cross-User Security & Tenant Isolation: User B cannot access or modify User A references', async () => {
    // User B tries to get User A's reference
    const getDenied = await api(`/api/v1/references/${referenceId1}`, {
      headers: { authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(getDenied.status, 404);

    // User B tries to update User A's reference
    const patchDenied = await api(`/api/v1/references/${referenceId1}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${userBToken}` },
      body: { title: 'Hacked Title' }
    });
    assert.strictEqual(patchDenied.status, 404);

    // User B tries to delete User A's reference
    const deleteDenied = await api(`/api/v1/references/${referenceId1}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(deleteDenied.status, 404);

    // User B lists references and sees 0 references
    const listB = await api('/api/v1/references', {
      headers: { authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(listB.status, 200);
    const userBRefs = Array.isArray(listB.body) ? listB.body : (listB.body.references || []);
    assert.strictEqual(userBRefs.length, 0);
  });

  await t.test('15. Soft Deletion: DELETE /api/v1/references/:id hides item from active lists', async () => {
    const delRes = await api(`/api/v1/references/${referenceId1}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);

    // Subsequent fetch returns 404
    const getRes = await api(`/api/v1/references/${referenceId1}`, {
      headers: { authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(getRes.status, 404);
  });
});
