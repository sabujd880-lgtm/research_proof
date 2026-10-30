# ResearchProof AI 1.0 — Frontend UI Audit Report

**Date:** October 30, 2026  
**Auditor:** Principal Full-Stack & UI/UX Architect  
**Scope:** Client Dashboard, Core Modules Layout, Authentication Screen, Design Tokens  
**Repository:** https://github.com/sabujd880-lgtm/research_proof  
**Production:** https://research-proof-1.onrender.com  

---

## 1. Executive Summary

A comprehensive visual, architectural, and layout audit was conducted on ResearchProof AI 1.0 following visual regression evidence submitted via production captures. The audit identified two primary systemic defects:

1. **Unstyled / Broken Authentication Layout**: When unauthenticated, the login interface previously rendered inline native browser controls (`<label>`, `<input>`, and `<button>` flowing horizontally), unstyled native buttons, and an uncentered container lacking the intended Linear-inspired card elevation.
2. **Missing Desktop Base Rules for Core Module Cards**: The 8 Unified Core Modules (`.tool-card`, `.tool-grid`, `.tool-icon`, `.tool-action`) and auxiliary layout elements (`.panel`, `.list-row`, `.stats-grid`, `.stat-card`, `.project-grid`, `.project-card`) were only defined inside responsive `@media` max-width queries (`<=1150px` and `<=760px`). On standard desktop viewports (>1150px), these components degraded to unstyled browser-default HTML elements (oversized gray blocks with native beveled borders).
3. **Session Invalidation Trap ("User account not found or has been deleted.")**: In memory/development reloads or after database user resets, stale client tokens or session cookies triggered a blocking 401 response from `requireAuth` that was surfaced directly to users instead of purging stale credentials and cleanly returning to the unauthenticated login state.

All three defects have been remediated with verified test and build passes.

---

## 2. Component-by-Component Audit Findings

| Component / Screen | Pre-Fix Status | Root Cause | Remediated Status |
| :--- | :--- | :--- | :--- |
| **Authentication Screen** (`.auth-page`, `.auth-card`) | Broken inline layout; unstyled controls | Missing base import of `styles.css` in `App.tsx` and unanchored layout container | Fully restored Linear-inspired card layout (440px max width, centered flex, subtle border, 16px radius, soft drop shadow) |
| **Core Modules Layout** (`.tool-grid`) | Single-column / block degradation on >1150px viewports | Grid definition was only present inside `@media (max-width: 1150px)` | Restored 4-column responsive CSS Grid (`repeat(4, minmax(0, 1fr))`) on desktop, 2-column on tablet, 1-column on mobile |
| **Core Module Cards** (`.tool-card`) | Oversized gray rectangular blocks | Base class had no background, padding, or border styling outside media queries | Restored elevated surface styling, 12px border radius, subtle hover lift (`translateY(-2px)`), and accent border focus |
| **Module Icons** (`.tool-icon`) | Unstyled raw SVG icons | Tone classes (`.blue`, `.green`, `.purple`, `.amber`, `.rose`) missing base definitions | Restored 38x38px rounded icon containers with dual-mode pastel backgrounds and saturated accents |
| **KPI Metrics** (`.stats-grid`, `.stat-card`, `.rp-metric-card`) | Broken alignment | Base grid and card tokens were omitted | 4-column structured metrics with uppercase eyebrow labels, 22px bold values, and subtitle trend notes |
| **Activity & Manuscripts** (`.panel`, `.list-row`, `.bottom-grid`) | Raw unpadded blocks | Missing container padding and hover row styling | Clean 2-column split layout with bordered cards, hover row highlights, and directional navigation arrows |
| **Research Projects** (`.project-grid`, `.empty-projects`) | Missing dashed container | Empty state lacked centered illustration styling | Refined empty state card with dashed border, primary action CTA, and progress indicators |

---

## 3. Compliance & Design Token Parity

- **Color Tokens**: Standardized on `--rp-bg`, `--rp-surface`, `--rp-border`, `--rp-accent`, and `--rp-text` across light mode (`#f8fafc` / `#ffffff`) and dark mode (`#090d16` / `#111726`).
- **Typography**: Inter (primary sans-serif) with tabular numerals enabled; JetBrains Mono for metadata and tokens.
- **Elevation**: Unified `--rp-shadow-xs`, `--rp-shadow-sm`, and `--rp-shadow-md` for consistent depth across cards and dialogs.
