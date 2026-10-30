# ResearchProof AI 1.0 — Phase 7 Statistical Studio Architecture

## 1. Architectural Philosophy & Integrity Guarantees

The core tenet of the Statistical Analysis Studio in ResearchProof AI 1.0 is **Absolute Numerical Determinism without Generative AI Hallucinations**.

Large Language Models (LLMs) are notorious for stochastic approximation errors, arithmetic drift, and phantom statistics when evaluating datasets. In academic research, a reported $p$-value or effect size must be reproducible to within floating-point precision machine limits.

Therefore, Phase 7 establishes a strict **Compute Boundary**:
1. **Mathematical Core (`server/src/statService.js`)**: All probability distributions, matrix factorizations, hypothesis tests, assumption checks, and effect sizes run strictly within validated JavaScript numerical routines.
2. **Deterministic Reporting**: All degrees of freedom, confidence intervals, effect sizes, and test statistics are formatted deterministically in adherence to American Psychological Association (APA) 7th Edition manuscript standards.
3. **Immutable Versioning**: When raw data undergo transformations (e.g. mean imputation, standardization, log transformation), immutable version snapshots are created, ensuring complete longitudinal provenance.

---

## 2. Statistical Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Dataset Ingestion Layer                          │
│  CSV (Auto Delimiter) │ TSV (Tab Delimited) │ XLSX (AdmZip OpenXML Sheets)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Variable Explorer & Metadata Catalog                   │
│   Measurement Levels: Nominal (Categorical) │ Ordinal │ Scale (Continuous)   │
│   Imputation & Cleaning: Z-Score Standardization │ Log Transform ln(x+1)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Numerical Engine Core                              │
│                                                                             │
│  Special Functions:                                                         │
│    • Lanczos lgamma(z)                                                      │
│    • Incomplete Beta ibeta(x, a, b) via continued fractions                 │
│    • Incomplete Gamma igamma(s, x) series & continued fraction              │
│    • Error function erf(x) & normal CDF                                     │
│                                                                             │
│  Distributions:                                                             │
│    • Student's t distribution: exact 2-tailed p-values                      │
│    • Snedecor's F distribution: exact cumulative tail areas                 │
│    • Chi-Square distribution: degrees-of-freedom p-values                   │
│    • Standard Normal Z distribution                                         │
│                                                                             │
│  Analytical Procedures:                                                     │
│    • Descriptive Statistics: Mean, Median, Mode, SD, Var, IQR, Skew, Kurt   │
│    • Parametric: 1-Sample t, Independent (Student/Welch), Paired t, ANOVA   │
│    • Factorial: Two-Way ANOVA with main effects and interaction             │
│    • Associations: Pearson r (Fisher z 95% CI), Spearman rho                │
│    • Regressions: Multiple Linear Regression (Gauss-Jordan OLS, VIF, DW)    │
│    • Nonparametric: Mann-Whitney U, Wilcoxon, Kruskal-Wallis, Chi-Square    │
│    • Assumptions: Shapiro-Wilk Normality, Levene's Homogeneity (Brown-F.)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Reporting & Visualizations                           │
│  • APA 7th Edition Statistical Narrative Generator                          │
│  • Pure SVG Scientific Visualizations:                                      │
│      - Gaussian Overlay Histograms                                          │
│      - Five-Number Boxplots with Outlier Dots                               │
│      - OLS Regression Scatterplots with Trend Lines                         │
│      - Normal Q-Q Plots for Residual Diagnostics                            │
│  • 1-Click "Insert into Manuscript" Editor Integration                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. High-Precision Mathematical Implementations

### 3.1 Regularized Incomplete Beta Function $I_x(a, b)$
Student's $t$ and Snedecor's $F$ cumulative probabilities rely on the regularized incomplete beta function:
$$I_x(a, b) = \frac{B(x; a, b)}{B(a, b)} = \frac{1}{B(a, b)} \int_0^x t^{a-1} (1-t)^{b-1} dt$$
Implemented via a continued fraction representation with Lentz's method:
$$p = 1 - I_{\frac{df}{df + t^2}}\left(\frac{df}{2}, \frac{1}{2}\right)$$

### 3.2 Regularized Incomplete Gamma Function $P(s, x)$
Chi-square cumulative distribution probabilities are evaluated via series expansions for $x < s + 1$ and continued fractions for $x \ge s + 1$:
$$P\left(\frac{df}{2}, \frac{\chi^2}{2}\right) = \frac{\gamma(df/2, \chi^2/2)}{\Gamma(df/2)}$$
$$p = 1 - P\left(\frac{df}{2}, \frac{\chi^2}{2}\right)$$

### 3.3 Gauss-Jordan Matrix Inversion for Multiple Linear Regression
For $Y = X\beta + \epsilon$, the ordinary least squares coefficient vector is:
$$\hat{\beta} = (X^T X)^{-1} X^T Y$$
The inverse matrix $C = (X^T X)^{-1}$ is computed via Gauss-Jordan elimination with partial pivoting. Multicollinearity variance inflation factors (VIF) are computed directly from the inverted diagonal:
$$\text{VIF}_j = C_{jj} \cdot \left(\sum (X_{ij} - \bar{X}_j)^2\right)$$

---

## 4. UI/UX Design System Integration

Following the Linear-inspired Minimal Enterprise UI principles from Phase 2:
- 4-Tab workflow: Overview $\to$ Data Explorer $\to$ Statistical Wizard $\to$ Results.
- High information density with clean monochrome borders and precise color accents.
- Pure SVG charts without heavy canvas or webgl runtime dependencies.
- Zero external Python dependencies: the entire engine runs natively in Node.js, ensuring 100% cloud reliability on Render.

