# Phase 7 Implementation Plan — Complete Statistical Analysis Studio

## Executive Objective

Develop a research-grade Statistical Analysis Studio integrated into ResearchProof AI 1.0. The system allows researchers to:
1. Upload and clean datasets (CSV, XLSX, TSV, JSON).
2. Explore variables, measurement levels (Nominal, Ordinal, Scale), missing data, and distributions.
3. Perform data cleaning and reproducible transformations with dataset versioning (`DatasetVersion`).
4. Execute validated numerical statistical analyses (Descriptives, Parametric tests, Nonparametric tests, Multiple Regression, Two-way/Repeated ANOVA, Chi-square).
5. Verify empirical assumptions (Shapiro-Wilk normality, Levene's test of variance homogeneity, VIF multicollinearity, Durbin-Watson autocorrelation).
6. Compute effect sizes (Cohen's $d$, Hedges' $g$, $\eta^2$, partial $\eta^2$, $\omega^2$, Cramér's $V$, $R^2$) with 95% confidence intervals.
7. Render scientific publication-grade visualizations (Histograms with normal fits, Boxplots, Scatterplots with regression lines, Correlation heatmaps, Q-Q plots).
8. Generate reproducible APA 7-compliant statistical narratives and formatted tables.
9. Preserve 100% backward compatibility with all prior modules (Phases 1–6).

---

## 1. Architecture & Component Separation

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: React 18 + Vite + TypeScript                      │
│ Linear-inspired Minimal Enterprise Workspace                │
│ • Tabs: Overview (KPIs), Data Grid, Analysis Wizard, Results│
│ • Interactive SVG Scientific Charts (Histograms, Boxplots)  │
│ • APA 7 Narrative Output with 1-click clipboard & exports   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼ (REST API /api/v1/statistics/*)
┌─────────────────────────────────────────────────────────────┐
│ Application Server: Node.js / Express 4                     │
│ • Dual prefix: /api and /api/v1                              │
│ • File upload security & XLSX/CSV parsing (adm-zip)         │
│ • Dataset versioning & transformation logging               │
│ • Tenant isolation & project authorization                  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Statistical Computing Engine (statService.js)               │
│ • Exact mathematical implementations:                       │
│   - Incomplete Beta & Gamma functions (ibeta, igamma, lbeta)│
│   - Student's t, Snedecor's F, Chi-square, Normal CDFs      │
│   - Parametric: 1-Sample/Indep/Paired t, 1-Way/2-Way/RM     │
│     ANOVA, Pearson r, OLS Multiple Regression               │
│   - Nonparametric: Mann-Whitney U, Wilcoxon, Kruskal-Wallis,│
│     Friedman, Spearman rho, Chi-Square, Fisher's Exact      │
│   - Assumption Checks: Shapiro-Wilk, Levene, VIF, DW        │
│   - Effect Sizes & 95% CIs: Cohen's d, Hedges' g, eta^2,    │
│     partial eta^2, Cramer's V, Fisher z CIs                 │
│ • Optional Python/R worker delegation if environment set   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Persistence Layer: MongoDB Atlas (Mongoose) + Memory Store   │
│ • Dataset & DatasetVersion (immutable snapshots)            │
│ • DatasetVariable (data dictionary & measurement levels)     │
│ • Analysis, AnalysisResult, AnalysisJob                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technical Milestones & Execution Order

### Milestone 1: Baseline Verification & Pre-flight
- Confirm all 110 existing tests pass across Phases 1–6.
- Check current Git branch and protect uncommitted changes.

### Milestone 2: Schema Expansion (`server/src/models.js`)
- Define and export:
  - `datasetSchema` (extended with fileType, checksum, missing counts, version tracking)
  - `datasetVersionSchema` (immutable version snapshots)
  - `datasetVariableSchema` (variable metadata, measurementLevel, missingCodes)
  - `analysisSchema` (configured analysis specifications)
  - `analysisResultSchema` (verified numerical outputs, assumptions, effect sizes, APA 7 report)
  - `analysisJobSchema` (background job queue)
- Register in-memory maps in `server/src/index.js`.

### Milestone 3: Research-Grade Statistical Engine (`server/src/statService.js`)
- Implement verified mathematical distributions:
  - `tDistributionPValue(t, df)`
  - `fDistributionPValue(f, df1, df2)`
  - `chiSquarePValue(chi2, df)`
  - `normalCdf(z)` and `normalPValue(z)`
- Implement statistical procedures:
  - Extended Descriptives (mean, median, mode, sample/pop SD, variance, min, max, range, IQR, skewness, kurtosis, SE, 95% CI)
  - One-sample, Independent (Student & Welch), and Paired $t$-tests with Cohen's $d$, Hedges' $g$, and 95% CIs
  - One-way ANOVA, Two-way Factorial ANOVA, and Repeated-Measures ANOVA with $\eta^2$ and partial $\eta^2$
  - Pearson, Spearman rank, and Kendall tau correlations with 95% Fisher $z$ CIs
  - Simple and Multiple Linear Regression (OLS matrix algebra, $R^2$, Adj $R^2$, $F$, coefficient SE, $t$, $p$, Durbin-Watson, VIF)
  - Nonparametric: Mann-Whitney $U$, Wilcoxon signed-rank, Kruskal-Wallis $H$, Friedman, Chi-square independence, Fisher's exact
  - Assumption checks: Shapiro-Wilk normality, Levene's test of homogeneity (median & mean centered), Breusch-Pagan heteroscedasticity
  - APA 7 narrative formatter for all procedures.
- XLSX parsing with `adm-zip` and CSV delimiter auto-detection.
- Data cleaning: missing value imputation, z-score standardization, log transformation.

### Milestone 4: REST API Implementation (`server/src/index.js`)
- Mount endpoints on `apiRouter`:
  - `POST /statistics/datasets/upload`
  - `GET /statistics/datasets`
  - `GET /statistics/datasets/:datasetId`
  - `GET /statistics/datasets/:datasetId/variables`
  - `PATCH /statistics/datasets/:datasetId/variables/:varName`
  - `GET /statistics/datasets/:datasetId/preview`
  - `POST /statistics/datasets/:datasetId/transform`
  - `GET /statistics/datasets/:datasetId/versions`
  - `POST /statistics/analyses`
  - `GET /statistics/analyses`
  - `GET /statistics/analyses/:analysisId`
  - `POST /statistics/analyses/:analysisId/run`
  - `GET /statistics/analyses/:analysisId/results`
  - `GET /statistics/analyses/:analysisId/export`
- Preserve legacy `/projects/:id/datasets/*` and `/projects/:id/analyses` endpoints.

### Milestone 5: Minimal Enterprise UI (`client/src/modules/StatisticalAnalysis.tsx`)
- Modernize into Linear-inspired Studio:
  - Tab 1: Overview KPIs (Participants, Variables, Analyses, Missing Values)
  - Tab 2: Interactive Data Grid, Column Search, Measurement Level Toggles, and Data Cleaning Actions
  - Tab 3: Analysis Wizard with guided parameter selection and assumption check checkboxes
  - Tab 4: Results Viewer with statistical summary cards, assumption badges, SVG scientific charts, and APA 7 narrative export.

### Milestone 6: Automated Testing & Verification
- Author `server/test/phase7_statistical_studio.test.js` covering 30+ test cases.
- Run full platform regression test (Phases 1–7).
- Verify client production build (`tsc -b && vite build`).

### Milestone 7: Documentation Deliverables & Release Gate
- Generate all 8 Phase 7 markdown documentation files.
- Stage, commit, and push changes to `origin/main`.
