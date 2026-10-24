# ResearchProof AI — Phase 5: APA Citations & BibTeX Specification

## 1. Overview

ResearchProof AI adheres strictly to the APA 7th Edition reference formatting standard by pairing `biblatex` (`style=apa,backend=biber`) with a clean `references.bib` file.

---

## 2. Citation Mapping

In-text citations within the manuscript are parsed and semantically mapped:

### Parenthetical Citations
- Word text: `(Kahneman, 2011)`
- Generated LaTeX: `\parencite{kahneman2011think}`

### Narrative Citations
- Word text: `Kahneman (2011) argued that...`
- Generated LaTeX: `\textcite{kahneman2011think}` argued that...

### Unmatched Citations Policy
If an in-text citation cannot be reliably matched to a verified bibliography record or DOI:
1. **The original plain text is preserved verbatim** (no citation key is invented).
2. An informative warning is logged in `conversion-report.json`.
3. The user is prompted to add the missing metadata in the Citation Assistant.

---

## 3. BibTeX Record Structure

BibTeX records are produced according to BibLaTeX standards:

```bibtex
@article{tversky1974judg,
  author = {Tversky, Amos and Kahneman, Daniel},
  title = {{Judgment under Uncertainty: Heuristics and Biases}},
  journal = {Science},
  year = {1974},
  volume = {185},
  number = {4157},
  pages = {1124-1131},
  doi = {10.1126/science.185.4157.1124}
}

@book{kahneman2011think,
  author = {Kahneman, Daniel},
  title = {{Thinking, Fast and Slow}},
  publisher = {Farrar, Straus and Giroux},
  year = {2011},
  doi = {10.1037/0000001}
}
```

---

## 4. Integrity Validations

1. **DOI Preservation**: Valid DOIs are captured in the `doi = {...}` field.
2. **Duplicate DOI Detection**: Multiple references sharing identical DOIs are flagged in `conversion-report.json`.
3. **Multi-Author Chains**: Connected with `and` in BibTeX syntax for correct APA "et al." truncation by Biber.
