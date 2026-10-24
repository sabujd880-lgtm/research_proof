# ResearchProof AI — Citation Assistant Documentation

## 1. Overview

The Citation Assistant provides reliable academic reference management, DOI metadata resolution, and citation integrity diagnostics directly within the Writing Studio.

---

## 2. Supported Citation Styles

1. **APA 7th Edition:**
   - Author, A. A., & Author, B. B. (Year). Title of article. *Title of Periodical*, *Volume*(Issue), Pages. https://doi.org/DOI
   - In-text: `(Author, Year)` or `(Author1 & Author2, Year)` or `(Author et al., Year)`
2. **MLA 9th Edition:**
   - Author, First. "Title of Article." *Title of Periodical*, vol. Volume, no. Issue, Year, pp. Pages. https://doi.org/DOI.
   - In-text: `(Author)` or `(Author1 and Author2)` or `(Author et al.)`
3. **IEEE Style:**
   - [1] A. A. Author and B. B. Author, "Title of article," *Title of Periodical*, vol. Volume, no. Issue, pp. Pages, Year, doi: DOI.
   - In-text: `[1]`, `[2]`

---

## 3. Public Metadata Resolution (Crossref REST API)

- Endpoint: `POST /api/citations/lookup`
- Payload: `{ "doi": "10.1038/s41586-020-2649-2" }`
- **Workflow:**
  1. DOI normalization: Strips `https://doi.org/`, `doi:`, trims whitespace, converts to lowercase.
  2. Cache lookup: Inspects MongoDB `DoiCache` collection or in-memory map.
  3. API query: Queries `https://api.crossref.org/works/{doi}` with polite `User-Agent` headers and a 6-second timeout.
  4. Response extraction: Normalizes article title, authors (`given`, `family`, `name`), container journal, volume, issue, page ranges, and publication year.
  5. Caches normalized metadata in database with a 30-day TTL.

---

## 4. Citation Integrity Diagnostics

- Endpoint: `POST /api/citations/validate`
- Evaluates document manuscript against user's citation library:
  - **Missing References:** Identifies cited DOIs (e.g. `10.1038/...`) or author-year markers (e.g. `(Smith et al., 2021)`) present in the document but omitted from the citation library.
  - **Uncited References:** Identifies cataloged references in the user's library that are never referenced in the document text.
  - **Duplicate References:** Identifies duplicate DOIs cataloged multiple times.
  - **Author/Year Consistency:** Flags year or spelling mismatches between in-text citations and bibliographic records.
