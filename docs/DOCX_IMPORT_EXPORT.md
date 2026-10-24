# ResearchProof AI — DOCX Import & Export Architecture

## 1. Overview
The DOCX processing subsystem in ResearchProof AI allows academic researchers to import Word documents (`.docx`) into the Academic Writing Studio and export their revised manuscripts back into valid Office Open XML (.docx) files without leaving the browser or risking data leaks.

## 2. DOCX Import Pipeline

### 2.1 File Validation & Security Guards
To prevent arbitrary file execution, zip bombs, and directory traversal:
- **Transport**: `multipart/form-data` handled via in-memory `multer` storage (bounded to 10 MB maximum).
- **Magic Byte Verification**: Every uploaded file is inspected at the buffer level to guarantee the PKZIP signature:
  ```javascript
  // PK\x03\x04 signature check
  buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04
  ```
- **Memory Limits & No Disk Persistence**: Files are processed directly in Node.js heap memory buffers without creating temporary files on the local filesystem. This eliminates orphaned temporary file exploits and complies with Render ephemeral instances.
- **Decompression Bomb Protection**: Input buffers exceeding `MAX_DOCX_UPLOAD_SIZE` (default 10MB) are rejected immediately with HTTP 413.

### 2.2 Content Extraction & Sanitization
Extraction is executed using `mammoth.convertToHtml` and `mammoth.extractRawText`:
1. **Raw Text Extraction**: Used for exact word count, character count, and structural metrics.
2. **HTML Sanitization**: Mammoth converts Word styling to semantic HTML elements (`<h1>`, `<h2>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`, `<table>`).
3. **Unicode Preservation**: Greek symbols ($\alpha$, $\beta$, $\Delta$), mathematical operators ($\le$, $\ge$, $\pm$), and scientific notation ($10^{-5}$) are preserved via UTF-8 encoding.
4. **Advisory Warnings**: Mammoth generates structured warnings if non-standard elements (e.g., legacy Word DrawingML or unsupported macros) are encountered. These are returned to the frontend in the import response.

### 2.3 Import API
- **Endpoint**: `POST /api/documents/import-docx`
- **Headers**: `Authorization: Bearer <JWT>`, `Content-Type: multipart/form-data`
- **Response**:
  ```json
  {
    "document": {
      "_id": "67b9fe...",
      "title": "Manuscript Title",
      "content": "Paragraph content...",
      "wordCount": 1420,
      "characterCount": 9850,
      "version": 1
    },
    "warnings": []
  }
  ```

---

## 3. DOCX Export Pipeline

### 3.1 Document Assembly
DOCX file generation uses the `docx` library (`docx.Document`, `Paragraph`, `HeadingLevel`, `Packer`):
- **Title Block**: Styled as a Title Heading (Heading 1) with bottom spacing.
- **Section Parsing**: Converts markdown or multi-paragraph text into typed `Paragraph` blocks.
- **Heading Recognition**: Lines beginning with `#`, `##`, `###` are automatically rendered with the corresponding Word `HeadingLevel`.
- **Bullet List Recognition**: Lines starting with `* ` or `- ` are formatted with standard Word bullet indentation.
- **Scientific Notation & Unicode**: Encoded directly into Office Open XML paragraphs preserving all mathematical and scientific symbols.

### 3.2 Streaming & Content-Disposition
The file is compiled into a binary buffer using `Packer.toBuffer(doc)` and streamed directly to the client:
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="Manuscript-Title-accepted.docx"
Content-Length: 12540
```

### 3.3 Export Scopes
Researchers can export:
1. **Active Document**: `GET /api/documents/:id/export-docx`
2. **Accepted Revision**: Pass `?version=accepted` to export the verified, peer-reviewed accepted revision.
3. **Original Version**: Pass `?version=original` to export the pre-revision baseline document.

---

## 4. Privacy & Authorization
- **Strict Ownership**: Only the document creator (`doc.owner.toString() === req.user._id.toString()`) can import into their account or export a document.
- **Cross-User Protection**: Attempting to export an ID belonging to another user returns `404 Document not found`.
- **Persistence Consent**: If `PERSIST_DOCUMENT_TEXT=false`, DOCX import returns extracted text for browser-only in-memory display without creating a persistent MongoDB Document record.
