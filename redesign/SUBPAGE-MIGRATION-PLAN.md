Read-only analysis complete. I read `home.css`, `home-scan.css`, `fonts-plex.css`, `styles.css`, `fonts.css`, all four subpages (`study/`, `label/`, `pack/`, `vendors/`), `gen-pages.mjs`, the runtime scripts (`app.js`, `home-ui.js`, `label/label.js`, `pack/pack-app.js`), and grepped every generated file in `vendors/` (37 files: the hub + 36 vendor pages). Nothing was modified. One important discovery up front: **`home-scan.css` already ports the old scanner component classes** (`.verdict`, `.vi`, `.v-action-required`, `.v-check-required`, `.v-likely-ok`, `.finding`, `.meta`, `.pill`, `.pill.art`, `.pill.s-*`, `.detected`, `.tablewrap`, `.hint`, `.btn.ghost`, `.spin`) into the new design system — that is most of the work done already for the vendor pages and the label/pack runtime output.

---

# Migration Plan: styles.css → home.css system

## 1. Token/class mapping table

### 1a. Custom properties (`styles.css` `:root`, lines 7–22 → `home.css` `:root`, lines 6–15)

| Old token (styles.css) | Old value | New token (home.css) | Notes |
|---|---|---|---|
| `--navy` | `#1e3a8a` | `--blue` `#22407c` | Direct |
| `--navy-deep` | `#16296b` | `--blue-deep` `#1a3060` | Direct |
| `--navy-ink` | `#0f172a` | `--ink` `#1b1a16` | Direct |
| `--gold` | `#b45309` | `--amber` `#9a5b12` | Direct |
| `--gold-soft` | `#fdf6ec` | `--amber-tint` `#f7efe0` | Direct |
| `--bg` | `#f7f6f3` | `--page` `#f4f2ec` | Direct |
| `--panel` | `#fffffe` | `--panel` `#fffdf7` | Same name, new value — inline uses survive |
| `--ink` | `#131a26` | `--ink` `#1b1a16` | Same name, new value |
| `--muted` | `#5a6577` | `--muted` `#5b5850` | Same name — critical: generated pages use `var(--muted)` **321 times** inline, subpages 56 times; these keep working |
| `--line` | `#dedbd4` | `--hairline` `#cfccc2` (soft `--hairline-soft` `#dcd8ce`, dashed `--hairline-dashed` `#d9d5ca`) | **Renamed — no `--line` in home.css** |
| `--line-strong` | `#c6c2b8` | `--edge` `#b6b2a6` | **Renamed** |
| `--accent` | `var(--navy)` | `--blue` | **Renamed** — used by study inline `.bt i{background:var(--accent)}` |
| `--accent-soft` | `#eaeffb` | `--blue-tint` `#e8ecf6` | **Renamed** — used by label inline `.drop:hover` |
| `--red` / `--red-soft` | `#a11f28` / `#fbeceb` | **NO EQUIVALENT** | New palette is blue+amber only. Study `.stat.alarm .big{color:var(--red)}`, `.rule.now` border, old `.v-action-required` all used red. **Flagged** — needs a decision (map to `--amber` or reintroduce one red) |
| `--amber` / `--amber-soft` | `#8a5a04` / `#fdf5e5` | `--amber` / `--amber-tint` | Same semantics, new values |
| `--green` / `--green-soft` | `#1c6444` / `#e9f4ee` | **NO EQUIVALENT** | Old `.v-likely-ok` was green; home-scan.css maps likely-ok to **blue**. Flagged |
| `--grey-soft` | `#efede8` | none (nearest: `--band` `#eae7de`, or `#f9f7f0` used by `.utility-box`) | Used by label `.pre.snip`, study `.bt` track |
| `--radius` | `8px` | none — hard rule `border-radius:2px` (enforced by `*{border-radius:0}` + explicit `2px`) | **Renamed away** |
| `--wrap` | `1120px` | `.container` `max-width:1140px` | **Renamed** |
| `--sans` Inter | | `'IBM Plex Sans'` | fonts-plex.css replaces fonts.css |
| `--display` Calistoga | | `'IBM Plex Serif'` | — |
| `--mono` ui-monospace | | `'IBM Plex Mono'` | — |
| `--s1…--s6` spacing scale (6/12/20/32/52/84px) | | **NO EQUIVALENT** | home.css uses literal px. Inline `var(--s3)`, `var(--s4)`, `var(--s5)` (label/study/pack, ~13 uses) resolve to nothing without aliases → margins silently collapse. **Flagged** |
| `prefers-color-scheme: dark` + `[data-theme="dark"]` blocks (lines 23–46) | | **NO EQUIVALENT** | home.css has no dark mode. Flagged (see §5) |

### 1b. Classes (`styles.css` → `home.css` / `home-scan.css`)

| Old selector (styles.css) | New equivalent | Status |
|---|---|---|
| `.wrap` | `.container` | **No `--wrap`/`.wrap` in home.css — naive swap = full-bleed content** |
| `header.top`, `.topbar` | `.site-header`, `.site-header .container` | **No equivalent — header collapses to unstyled markup** |
| `.brand` + `.tag` (SVG) | `.brand` + `.brand-mark` + `.brand-name` | Different concept (small square + mono wordmark vs Calistoga anchor). `.brand` exists but `.tag` has no rule |
| `.topnav` | `.nav-links` | **Renamed, different markup** |
| `.hero` | `.hero` | Same name; new padding/`h1` clamp applies |
| `.lede` | `.lead` | **home.css defines `.lead`, not `.lede` — `.lede` is unstyled if swapped naively** |
| `.eyebrow` | `.eyebrow` | Same name (label page hero uses it) |
| `.btn` | `.btn` | Same name; new 2px style |
| `.btn.ghost` | `.btn.ghost` in home-scan.css (line 76); `.btn-outline` in home.css | **Covered by home-scan.css** |
| `.kicker`, `.dot`, `.counters`, `.counter` | `.hero`…, `.stats-grid`/`.stat-cell`, `.ticker-*` | Unused by migrating pages (old-homepage-only) — safe to drop |
| `.scanner`, `.scanner-head`, `.scanform` | `.scanner-band`, `.scanner-copy`, `.scan-form` | **No equivalent in home.css — pack page form panel breaks** |
| `#out` / `#out.on` | `.scan-output`… / none | Old scanner contract gone. **Label page uses `#out` — see §5, item 2** |
| `.verdict`, `.vi`, `.v-action-required`, `.v-check-required`, `.v-likely-ok` | Same classes in home-scan.css lines 46–52 | **Already ported**; `.v-no-signal` dropped (unused by pages) |
| `.finding`, `.meta`, `.pill`, `.pill.art`, `.pill.s-action-required`, `.pill.s-check-required`, `.pill.s-likely-ok` | Same in home-scan.css lines 54–63 | **Already ported** |
| `.detected`, `.tablewrap`, `.hint`, `.spin` | Same in home-scan.css | **Already ported** (`.spin` lines 78–81, used by pack-app.js) |
| `.grid2` | none | Unused by migrating pages |
| `.grid3` | none | **Used by hub + related-vendors section — no equivalent** |
| `.card`, `.num` | none (closest: `.rule-card`, `.article-chip`) | **Used by vendor pages/hub — no equivalent** |
| `.rule`, `.rule.now/.soon/.later` | none (closest: `.timeline-row`, `.timeline-status.now/.days`) | **Used by study, label, and every vendor page — no equivalent** |
| `.offer`, `.price` | none (closest: `.order-panel`, `.order-price`) | **Used by all four pages — no equivalent; `.price` unused** |
| `details`, `summary`, `summary::after` chevron, `details .body` | none | **Generated FAQ + label.js XMP details lose styling (still functional)** |
| `.disclaim` | none (closest `.pack-disclaimer`) | **Label page only — no equivalent** |
| `section`, `section.tight` | none (home sections styled per-class) | **Used everywhere — sections lose padding/border separation** |
| `footer` | `.site-footer` | **Bare `<footer>` loses styling on all subpages** |
| `blockquote.cite` | none | Study page only |
| `.method` | none | Study page only |
| `table.data` (th/td, tabular-nums) | `.tablewrap th/td` (home-scan) | Study tables are inside `.tablewrap`, so covered; tabular-nums rule not carried over |
| `code` (grey chip bg + radius) | `code` mono-only in home.css | Chip look lost outside tables |
| `.sr` | `.visually-hidden` | Renamed; unused by subpages |

**Classes with NO equivalent that break on a naive swap:** `.wrap`, `.lede`, `.top`/`.topbar`/`.topnav`/`.tag`, `.scanner`/`.scanner-head`/`.scanform`, `.rule` (+`.now/.soon/.later`), `.offer`, `.card`/`.num`/`.grid3`, `.disclaim`, `.method`, `.cite`, `section`/`section.tight`, bare `footer`, `details`/`summary`/`.body`, plus tokens `--line`, `--line-strong`, `--accent`, `--accent-soft`, `--bg`, `--grey-soft`, `--navy`, `--gold`(-soft), `--radius`, `--s1…--s6`, `--red`, `--green`.

## 2. Exact selectors the subpages and template actually depend on

Everything below was extracted by grepping the files, not guessed. All four pages + `gen-pages.mjs` link `../styles.css` (study line 11, label line 11, pack line 10, `gen-pages.mjs` lines 70 and 164).

**Shared header shell (all pages):** `header.top`, `.topbar`, `.brand`, `.tag` (SVG), `.topnav`, `.wrap`.

**gen-pages.mjs template → all 36 vendor pages + hub (`vendors/index.html`):** `.hero`, `.lede`, `.verdict`, `.vi`, `.v-action-required`, `.v-check-required`, `.rule`, `section` + `section.tight`, `.card`, `.num`, `.tablewrap`, `.detected`, `.offer`, `.btn`, `.grid3` (hub + related-vendors block), plus elements `details`/`summary`/`.body` (FAQ), `table`, `code`, `h1`–`h3`, `p`, `strong`, `a`, bare `footer`. Inline `style` attributes use `var(--muted)` (321 occurrences) — this token survives (same name in home.css).

**study/index.html:** header shell, `.hero`, `.lede`, `.stat-grid`, `.stat`, `.big`, `.cap`, `.alarm`, `.warn`, `.bar`, `.bl`, `.bt`, `.bn`, `.method`, `.rule`, `.tablewrap`, `table.data`, `blockquote.cite`, `.offer`, `.btn`, `section`/`section.tight`, bare `footer`, `code`. Its **own inline `<style>` (lines 13–30)** redefines `.stat-grid/.stat/.big/.cap/.alarm/.warn/.bar/.bl/.bt/.bn/.method/table.data/.cite` on top of styles.css and references `var(--line)`, `var(--panel)`, `var(--radius)`, `var(--muted)`, `var(--red)`, `var(--amber)`, `var(--grey-soft)`, `var(--accent)`.

**label/index.html:** header shell, `.wrap`, `.hero`, `.eyebrow`, `.lede`, `.btn`, `.btn.ghost`, `.rule` + `.now/.soon/.later`, `.disclaim`, `.offer`, `section.tight`, bare `footer`. Its **own inline `<style>` (lines 13–38)** defines `.drop`/`.drop.over` (dropzone), `.opts`/`.opt`/`.opt.sel` (option cards), `.field`, `pre.snip`, `.langrow`, referencing `var(--line-strong)`, `var(--radius)`, `var(--s5)`, `var(--s3)`, `var(--panel)`, `var(--navy)`, `var(--accent-soft)`, `var(--muted)`, `var(--line)`, `var(--grey-soft)`, `var(--mono)`, `var(--bg)`, `var(--ink)`. Runtime (`label/label.js`) injects `.verdict v-*`, `.vi`, `.opt`, `.sel`, `.over`, `.ol`, `.oh`, `.langrow`, `.body` (`details .body`), `.snip`, and writes to `#out`.

**pack/index.html:** header shell, `.wrap`, `.hero`, `.lede`, `.scanner`, `.scanner-head`, `.scanform`, `.btn`, `.btn.ghost`, `.offer`, `section.tight`, bare `footer`. Runtime (`pack/pack-app.js`) injects `.spin`, `.verdict v-*`, `.vi`, and uses `var(--line)`/`var(--accent)` inside a `.spin` inline style (line 111).

## 3. Page-specific layout that must be preserved, not replaced

- **study/index.html — stat grid + bar charts (its own `<style>`, lines 13–30):** `.stat-grid` (`repeat(auto-fit,minmax(210px,1fr))` grid, 1px borders), `.stat` (panel + radius card), `.stat .big` (2.3rem tabular figure), `.stat.alarm .big` / `.stat.warn .big` (red/amber semantics — red has no new-system equivalent), `.bar`/`.bl`/`.bt`/`.bn` (180px label column + grey track + navy fill sized via inline `width:%` + tabular count), `.method` list, `blockquote.cite`, and the two `table.data` blocks. Structure must stay; only tokens change.
- **label/index.html — dropzone + option cards (its own `<style>`, lines 13–38):** `.drop` (2px dashed border, radius, `--s5`/`--s3` padding, hover/`.over` → navy + `--accent-soft`), `.opts`/`.opt`/`.opt.sel` (1fr/1fr grid; selected = 2px navy border + tint), `.field` inputs, `pre.snip`, `.langrow`. All token-dependent; preserve layout, swap tokens.
- **pack/index.html — form panel from styles.css (not inline):** `.scanner`/`.scanner-head`/`.scanform` come from styles.css lines 107–112 (bordered panel, input styling). Unlike study/label, this is **not** page-local — it must be ported explicitly.
- **Generated vendor pages — template structure (gen-pages.mjs):** the `.verdict` tone panel, `.rule` deadline paragraphs (color-coded `now`/`soon`/`later`), `.card`/`.num` console-path block, `.tablewrap`/`.detected` wording table, `.offer` CTA, `details` FAQ, `.grid3` related-vendors, and the hub's `.grid3`/`.card` listing.

## 4. Smallest safe edit sequence (without breaking the 36 generated pages)

The single most important rule: **never hand-edit the 36 files in `vendors/` — they are output of `gen-pages.mjs`; migrate the template and re-run it.** Otherwise the next regeneration silently reverts your work.

1. **Freeze reproducibility.** Confirm `node gen-pages.mjs` regenerates all 37 files (`vendors/index.html` hub + 36 pages) plus `sitemap.xml`/`robots.txt` from `data/vendors.json`; snapshot hashes of `vendors/*.html` before any change so the re-run diff shows only intended edits.
2. **Create one bridge file, `subpages.css`** (do not touch `home.css`). It holds the old-system structural rules the homepage doesn't need, restyled onto new tokens, plus a `:root` alias block so every inline `var()` keeps resolving:
   - Alias tokens: `--navy:var(--blue)`, `--navy-deep:var(--blue-deep)`, `--line:var(--hairline)`, `--line-strong:var(--edge)`, `--bg:var(--page)`, `--gold:var(--amber)`, `--gold-soft:var(--amber-tint)`, `--accent:var(--blue)`, `--accent-soft:var(--blue-tint)`, `--grey-soft:var(--band)`, `--radius:2px`, `--wrap:1140px`, `--s1…--s6` → literal px; make an explicit decision for `--red`/`--red-soft`/`--green` (recommend mapping alarm-red → `--amber` or reintroducing one red, and document it).
   - Rules: `.wrap` alias to `.container`, `.lede` alias to `.lead`, the old header block (`.top`, `.topbar`, `.brand`, `.tag`, `.topnav` — sticky, border, flex), `section`/`section.tight` (padding + `border-top:1px solid var(--hairline)`), bare `footer`, `.rule` + `.now/.soon/.later`, `.offer`, `.card`/`.num`/`.grid3`, `.disclaim`, `.method`, `blockquote.cite`, `table.data`, `.scanner`/`.scanner-head`/`.scanform`, `details`/`summary`/`summary::after`/`details .body`, and a `code` chip rule. Link order: `fonts-plex.css` → `home.css` → `home-scan.css` → `subpages.css`.
3. **Edit `gen-pages.mjs` in exactly two places** (lines 70 and 164): replace `<link rel="stylesheet" href="../styles.css">` with the four new links. Keep the template markup otherwise untouched — the bridge covers it. Re-run `node gen-pages.mjs`; the diff across all 37 files must be just the link lines.
4. **Three hand-written pages:** swap the same stylesheet link (study line 11, label line 11, pack line 10). No other markup changes needed at this stage.
5. **Optional cleanup phase:** rewrite the two page-local `<style>` blocks (study lines 13–30, label lines 13–38) from old tokens to new ones so the aliases can be removed later; convert headers to `.site-header`/`.nav-links` markup if you want the old header block gone.
6. **Sweep before deletion:** grep for `var\(--(navy|gold|line|line-strong|bg|grey-soft|accent|red|green|radius|s[1-6])\)`, `styles\.css`, `class="lede"`, `class="wrap"`, `class="topnav"` across all pages + scripts — must return zero. Only then delete `styles.css`, `fonts.css`, and the Inter/Calistoga woff2s in `fonts/` (check nothing else references them first).
7. **QA:** label drop/options/verdict notes (watch `#out`), pack spinner + verdict, study stat colors and bars, vendor verdict borders, FAQ `details` toggling, anchors `../#scan` and `../#pack` (both exist on the new homepage: `id="scan"`, `id="pack"`), tabular numerals, `:focus-visible`, `prefers-reduced-motion` (home-scan `.spin` handles it).

## 5. What regresses if migrated carelessly

1. **Dark mode disappears.** styles.css lines 23–46 (`prefers-color-scheme: dark`, `[data-theme="dark"]`) have no home.css counterpart. Either re-add a compact dark block in the bridge or accept light-only.
2. **Label page `#out` (latent bug becomes visible).** styles.css `#out{display:none}` hides the label tool's feedback, and `label/label.js` never adds `.on` — so notes are **currently invisible**. home.css has no `#out` rule, so migration silently fixes it. Danger: if anyone ports a global `#out{display:none}` into the bridge (old scanner contract), the tool breaks again. Scope any such rule to the old scanner ids.
3. **Universal reset.** home.css `*{margin:0;padding:0;border-radius:0;box-shadow:none}` nukes default list/`summary`/input chrome: `.method` bullets sit flush at the edge, `summary` gets a default disclosure triangle, pack form inputs go browser-default. The bridge's `details`/`summary` and form rules must re-specify these.
4. **Header collapse.** Pointing subpages at home.css without the bridge leaves `.top`/`.topbar`/`.topnav` completely unstyled — no sticky, no border, nav not flexed. Most visible break.
5. **`.lede` vs `.lead`, `.wrap` vs `.container`.** Naive token swaps leave hero copy unstyled or content full-bleed.
6. **Red/green semantics.** `.stat.alarm` (red), `.rule.now` (red border), old green `.v-likely-ok` have no new-palette equivalent; home-scan already maps likely-ok→blue and action-required→amber. Alarm states need an explicit remap decision.
7. **Link underlines.** Old `a{text-underline-offset:3px;text-decoration-thickness:1px}` vs new `a{text-decoration:none}` — body-text links on subpages lose underlines; on a compliance site that's an accessibility/trust regression worth a rule.
8. **`code` chips.** Old `code{background:var(--grey-soft);border-radius:4px}` is gone; `<code>` in study method text and vendor tables loses its chip (home-scan `.tablewrap code` covers table cells only).
9. **Section/footer separation.** Bare `section`/`section.tight` and bare `footer` get no padding/border without the bridge → stacked sections visually merge and footers collapse.
10. **Spacing scale.** `var(--s2)…var(--s5)` inline (label/study/pack, ~13 uses) silently become invalid properties (margin:0) if `--s1…--s6` aliases are omitted.
11. **Type-scale shift.** h1–h3 go Calistoga/Inter → Plex Serif, body 17px→16px, and old `h3` (sans, weight 620) becomes serif 600 — subheadings inside verdicts, cards, and details change face. Intended, but visible.
12. **Tabular numerals.** styles.css `.detected td:nth-child(2), table.data td:nth-child(n+2){font-variant-numeric:tabular-nums}` is not carried into home-scan — table numbers lose alignment.
13. **Font-loading order.** If `fonts-plex.css` isn't linked in the same change that removes `styles.css` (whose `@import url('./fonts.css')` loads Inter/Calistoga), subpages fall back to Georgia/system-ui. The link swap and the file deletion must land together.
14. **Radius/focus polish.** 8px radii → 2px and the 2.5px navy focus ring → 2px blue — intended per the new rules, but a visible change on the pack `.scanner` panel and label `.opt` cards if their local radii aren't restyled.
15. **`.v-no-signal` and green tints dropped** from the ported component set — harmless today (no page or script emits `no-signal`), but a trap if the scanner UI is ever extended to the subpages.