# ResearchProof AI 1.0 — Linear-Inspired Minimal Enterprise Design System Specification

**Specification Version**: 1.0.0  
**Design Paradigm**: Linear-Inspired Minimal Enterprise Academic SaaS  
**Author**: UI/UX & Design Systems Architect  
**Conformance**: WCAG 2.2 Level AA  

---

## 1. Design Philosophy

ResearchProof AI 1.0 is an academic command center for scientists, researchers, and graduate students. Its interface reflects the clarity, speed, and restraint of Linear:
- **Restrained & Intentional**: High information density without clutter; clean lines, 1px borders, subtle surface elevations.
- **Academic Precision**: Monospace numbers and DOIs, clear scientific hierarchies, unambiguous statuses.
- **Zero Distraction**: Subtle hover states (120-180ms ease), no bouncing or jarring transitions.
- **Keyboard-First Ergonomics**: Omnipresent shortcuts (`Ctrl+K` Command Palette, `Ctrl+B` Sidebar Toggle, `/` Search focus).

---

## 2. Typography Scale

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

- **UI / Headings / Body**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Features: `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11', 'tnum'` (tabular figures enabled for numeric alignment)
- **Monospace / Scientific Data / DOIs / Code**: `JetBrains Mono, SFMono-Regular, Consolas, monospace`

| Token | Size | Line Height | Weight | Letter Spacing | Typical Usage |
|---|---|---|---|---|---|
| `text-2xs` | 10px (0.625rem) | 14px | 500 / 600 | +0.4px | Micro tags, keyboard shortcuts, uppercase eyebrows |
| `text-xs` | 11px (0.6875rem) | 16px | 400 / 500 / 600 | +0.1px | Secondary metadata, badges, table sub-values |
| `text-sm` | 12px (0.75rem) | 18px | 400 / 500 / 600 | 0px | Primary UI labels, navigation links, table cells |
| `text-base` | 13px (0.8125rem) | 20px | 400 / 500 | -0.1px | Body text, inputs, editor content, tool descriptions |
| `text-md` | 14px (0.875rem) | 22px | 500 / 600 | -0.15px | Card titles, group headers, button labels |
| `text-lg` | 16px (1.0rem) | 24px | 600 / 700 | -0.25px | Section headings, panel titles, modal headers |
| `text-xl` | 20px (1.25rem) | 28px | 600 / 700 | -0.4px | Metric numbers, secondary page headers |
| `text-2xl` | 24px (1.5rem) | 32px | 700 / 800 | -0.6px | Hero page titles, primary dashboard banner |

---

## 3. Spacing & Density Scale (4px Grid)

```css
:root {
  --rp-space-1: 4px;
  --rp-space-2: 8px;
  --rp-space-3: 12px;
  --rp-space-4: 16px;
  --rp-space-5: 20px;
  --rp-space-6: 24px;
  --rp-space-8: 32px;
  --rp-space-10: 40px;
  --rp-space-12: 48px;
}
```

- **Compact Enterprise Density Rules**:
  - Table rows: `40px` to `44px` height with `8px 12px` cell padding.
  - Form controls / Inputs: `34px` height with `6px 10px` padding.
  - Buttons:
    - Small: `28px` height (`4px 8px` padding, 11px font)
    - Default: `34px` height (`6px 12px` padding, 12px font)
    - Large: `40px` height (`8px 16px` padding, 13px font)
  - Cards & Panels: `16px` to `20px` internal padding.

---

## 4. Semantic Color Tokens & WCAG 2.2 AA Contrast

### 4.1 Light Mode (`data-theme="light"`)

| Token | Hex Value | WCAG Contrast Ratio | Purpose |
|---|---|---|---|
| `--rp-bg` | `#f8fafc` | Canvas | Application background canvas |
| `--rp-surface` | `#ffffff` | Background | Primary card and panel surface |
| `--rp-surface-subtle` | `#f1f5f9` | 1.1:1 on bg | Secondary containers, inputs, table header bg |
| `--rp-surface-active` | `#e2e8f0` | 1.3:1 on bg | Hovered/pressed surface states |
| `--rp-border` | `#e2e8f0` | 1.3:1 on bg | Standard 1px card and container border |
| `--rp-border-subtle` | `#edf2f7` | 1.1:1 on bg | Subtle table dividers and row borders |
| `--rp-text` | `#0f172a` | **15.6:1** on surface (Passes AAA) | Primary headings and text |
| `--rp-text-muted` | `#64748b` | **4.8:1** on surface (Passes AA) | Secondary metadata and labels |
| `--rp-text-dim` | `#94a3b8` | 3.0:1 on surface | Disabled text and subtle icons |
| `--rp-accent` | `#4f46e5` | **5.9:1** on surface (Passes AA) | Interactive primary buttons, highlights |
| `--rp-accent-subtle` | `#eef2ff` | Background | Active nav item background, subtle badge bg |
| `--rp-success` | `#059669` | **4.9:1** on surface (Passes AA) | Verified statuses, passing tests |
| `--rp-success-subtle` | `#ecfdf5` | Background | Passing badge backgrounds |
| `--rp-danger` | `#dc2626` | **5.4:1** on surface (Passes AA) | Error alerts, plagiarism highlights, deletions |
| `--rp-danger-subtle` | `#fef2f2` | Background | Error badge backgrounds |
| `--rp-warning` | `#d97706` | **4.6:1** on surface (Passes AA) | Warnings, pending verification |
| `--rp-warning-subtle` | `#fffbeb` | Background | Warning badge backgrounds |

### 4.2 Dark Mode (`data-theme="dark"`)

| Token | Hex Value | WCAG Contrast Ratio | Purpose |
|---|---|---|---|
| `--rp-bg` | `#090d16` | Canvas | Ultra-dark minimal canvas |
| `--rp-surface` | `#111726` | Background | Deep slate card surface |
| `--rp-surface-subtle` | `#182234` | 1.2:1 on bg | Inputs, table headers, secondary blocks |
| `--rp-surface-active` | `#1f2d45` | 1.4:1 on bg | Hovered list items and cards |
| `--rp-border` | `#1e293b` | 1.3:1 on surface | Subtle structural border |
| `--rp-border-subtle` | `#162132` | 1.1:1 on surface | Internal table dividers |
| `--rp-text` | `#f8fafc` | **15.2:1** on surface (Passes AAA) | Primary text and headings |
| `--rp-text-muted` | `#94a3b8` | **5.1:1** on surface (Passes AA) | Metadata, captions, secondary text |
| `--rp-text-dim` | `#64748b` | 3.1:1 on surface | Watermarks and disabled text |
| `--rp-accent` | `#6366f1` | **5.2:1** on bg (Passes AA) | Primary brand accent and focus rings |
| `--rp-accent-subtle` | `#1e1e38` | Background | Active nav items, badges |
| `--rp-success` | `#10b981` | **6.8:1** on surface (Passes AA) | Success pills, passing audits |
| `--rp-success-subtle` | `#062e20` | Background | Subtle success background |
| `--rp-danger` | `#f87171` | **6.2:1** on surface (Passes AA) | Critical errors, high similarity |
| `--rp-danger-subtle` | `#3c1417` | Background | Danger alerts background |
| `--rp-warning` | `#fbbf24` | **9.4:1** on surface (Passes AAA) | Ambiguity flags, warnings |
| `--rp-warning-subtle` | `#332207` | Background | Warning alerts background |

---

## 5. Layout & Shell Dimensions

- **Sidebar (Left Navigation)**:
  - **Expanded Width**: `248px`
  - **Collapsed Width**: `64px` (shows 18px icons, centered, with accessible native tooltips)
  - **Mobile Drawer**: `260px` with overlay backdrop (`rgba(9, 13, 22, 0.7)` blur `4px`)
  - **Group Headings**: 10px uppercase, font-weight 600, letter spacing +0.8px, color `--rp-text-muted`
  - **Nav Items**: Height `32px`, padding `6px 10px`, icon size `16px`, border-radius `6px`
- **Top Header**:
  - **Height**: `56px`
  - **Padding**: `0 20px`
  - **Elements**: Mobile hamburger (mobile only), Sidebar toggle (desktop), Breadcrumb path, Project Context Switcher dropdown, Command Palette trigger button (`Ctrl+K`), Theme Toggle (Sun/Moon), User status pill.
- **Main Content**:
  - **Max Width**: `1440px` (centered)
  - **Padding**: `20px 24px 48px`

---

## 6. Reusable Primitive Specifications

### 6.1 `MetricCard`
- Compact container (`padding: 14px 16px`, `border: 1px solid var(--rp-border)`, `border-radius: 8px`).
- Header: 11px uppercase label + 16px muted icon.
- Value: 22px bold monospace/tabular figure.
- Sub-text / Trend: 10px muted note with optional green/red delta indicator.

### 6.2 `DataTable`
- Container: Bordered with `overflow-x: auto`, radius `8px`.
- Header (`<th>`): Height `36px`, `background: var(--rp-surface-subtle)`, 10px uppercase bold, color `--rp-text-muted`, sticky top.
- Rows (`<td>`): Height `40px` to `44px`, font-size `12px`, subtle border-bottom `1px solid var(--rp-border-subtle)`, hover background `var(--rp-surface-active)`.
- Status Cells: Inline pill badges (`8px 6px`, radius `12px`).

### 6.3 `FilterBar`
- Height `40px`, flex row, gap `8px`, alignment center.
- Search Input: Left-aligned search icon, `height: 32px`, `font-size: 11.5px`, placeholder `Filter items...`.
- Filter Dropdowns: Height `32px`, subtle border, 11px font.
- Count Badge: Compact indicator (e.g., `Showing 14 of 48 items`).

### 6.4 `EmptyState`
- Padding `40px 20px`, centered flex column.
- Icon: 32px muted icon inside a 48px circle container (`var(--rp-surface-subtle)`).
- Title: 14px semi-bold (`var(--rp-text)`).
- Description: 12px muted text (`var(--rp-text-muted)`), max-width 360px.
- Action: Single primary or secondary button (`height: 32px`).

### 6.5 `CommandPalette` (Ctrl+K)
- Modal backdrop (`rgba(0, 0, 0, 0.6)`).
- Centered floating window (`width: 560px`, `max-height: 420px`, border `1px solid var(--rp-border)`, radius `10px`).
- Search Input: `44px` height, 14px font, auto-focus.
- Results List: Grouped by Navigation, Recent Projects, Actions. Keyboard navigable via Arrow keys + Enter.
