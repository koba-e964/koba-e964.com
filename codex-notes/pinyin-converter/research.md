# Research: Pinyin Converter Static Site

## Goal

Create a static web page for converting Chinese text to pinyin in real time.

User-visible requirements:

- A textarea accepts Chinese characters.
- Pinyin output updates immediately as the user types.
- The character-to-pinyin list must be embedded in the page or shipped with the static page so runtime network access is not needed.
- Output both tone-mark form such as `ri4 ben3` rendered as `ri4 ben3` with tone marks (`rì běn`) and numeric-tone form such as `ri4 be3n` as requested.
- Show both simplified and traditional glyph rows in a table:
  - simplified row on top
  - traditional row below
  - one input character per column

## Relevant Files and Modules

- `pages/index.html`
  - Current public root page.
  - Pure static HTML, CSS, and inline JavaScript only for ads.
  - Contains a grid of links to public content.
- `pages/.nojekyll`
  - Disables Jekyll processing for the Pages artifact.
- `.github/workflows/deploy-pages.yml`
  - Assembles the deployed site into `dist-pages/`.
  - Copies `pages/.` directly into `dist-pages/`, so any static files under `pages/<path>/` are published at `/<path>/`.
  - Existing app paths are assembled under dedicated subdirectories such as `dist-pages/fund-price-forecast/`.
- `README.md`
  - Describes repo structure and current public content.
  - Says individual app/content details should live in the app's own directory, while the root README is a repo-level guide.
- `.codex/AGENTS.md`
  - Reiterates that root `README.md` is for repo-wide notes and app-specific details belong under the app directory.
- `.pre-commit-config.yaml`
  - Exists, but no task-specific validator is present under `.codex/agents/` or `~/.codex/agents/`.

## Execution Flow and Call Graph

Current deploy flow:

1. Push to `main` runs `.github/workflows/deploy-pages.yml`.
2. The `deploy` job creates `dist-pages`.
3. `cp -R pages/. dist-pages/` copies the root static files.
4. Other app artifacts are copied into subdirectories.
5. `actions/upload-pages-artifact` and `actions/deploy-pages` publish `dist-pages`.

For this feature, the simplest runtime flow can remain entirely static:

1. Browser loads `/pinyin/`.
2. HTML/CSS renders textarea, output panels, and character table.
3. Embedded JavaScript initializes an in-page dictionary.
4. `input` event on the textarea recomputes:
   - pinyin with tone marks
   - pinyin with tone numbers
   - per-character simplified/traditional display rows
5. Output updates synchronously without fetches.

No server, build step, API, worker, or external package is currently required by the repository architecture.

## Data Structures and Invariants

Likely page-local data structures:

- Character dictionary keyed by Unicode character.
- Each dictionary entry needs:
  - `simp`: simplified glyph
  - `trad`: traditional glyph
  - `num`: numeric-tone pinyin
  - `mark`: tone-mark pinyin, or enough data to derive it

Important invariants:

- Runtime conversion must work offline after the page has loaded.
- The table should preserve one input character per column for CJK characters.
- Non-CJK characters should not break layout or pinyin conversion.
- Ambiguous polyphonic characters cannot be resolved perfectly by a simple one-character dictionary.
- Textarea input order must be preserved in every output.
- The tone-mark and numeric-tone output should use the same token boundaries so users can compare them.

## Existing Architectural Patterns

- The repo favors plain static assets for small public pages.
- Public paths mirror content directories.
- `pages/` is the root static source copied as-is into the deployed artifact.
- Existing root page uses inline CSS and no shared frontend framework.
- Subprojects can have their own directories and README files when they have app-specific details.

## Naming Conventions

- Public paths use lowercase kebab-case, e.g. `/fund-price-forecast/`, `/tsumeshogi-web-solver/`, `/atcoder-rating-estimator/`.
- A pinyin tool should therefore naturally live at `pages/pinyin/index.html` and publish as `/pinyin/`.
- Notes live under `codex-notes/<task-slug>/`.

## Error Handling Patterns

There is no shared app-level error handling framework for static pages.

For this feature, expected graceful handling should be local:

- Unknown Chinese characters can pass through unchanged or display an empty pinyin token.
- Non-Chinese characters can remain visible in the character table and output text without dictionary lookup.
- Empty input should render empty outputs and a clear empty table state.
- Long input should remain usable by avoiding expensive DOM reconstruction patterns beyond the current text length.

## Typing and Tooling Conventions

- Existing `pages/index.html` is plain HTML/CSS.
- No root `package.json` exists.
- Adding TypeScript or a bundler would introduce a new build path for a small static tool.
- A single static HTML file with embedded CSS/JS matches the current root page style and deployment model.

## Potential Pitfalls

- A comprehensive pinyin dictionary for all CJK characters can be large and maintenance-heavy.
- A tiny hand-curated dictionary will satisfy examples but not real-world usage.
- Polyphonic characters such as `行`, `重`, `长`, `乐`, and `便` need word-level context for correct readings; a per-character dictionary cannot fully solve this.
- Simplified/traditional conversion is not always one-to-one at the character level.
- Some Japanese kanji overlap with Chinese characters but may not have intended Mandarin readings in user input.
- Tone-number formatting in the request includes `ri4 be3n`; standard pinyin numeric form is usually `ri4 ben3`. The plan should clarify whether to preserve the user's literal `be3n` example or implement standard numeric pinyin.
- Very wide per-character tables can overflow on mobile; layout needs horizontal scrolling with stable column widths.
- Including large mapping data inline in HTML may make the file harder to review. A separate static JS data file is still page-included and copied by Pages, but the user specifically said the list should be included in the page, so inline data may be preferred unless clarified.

## Constraints

- The site is deployed as static GitHub Pages content.
- Network access at runtime should not be required for conversion.
- Avoid adding a new build system unless the dictionary source makes that necessary.
- GitHub Actions edits are unnecessary if files are placed under `pages/`.
- If workflow files are edited later, the repo's GitHub Actions security rule applies: `actions/*` may be trusted by tag; other third-party actions must be pinned to exact commits with inline version comments.

## Unknowns

- Required dictionary coverage:
  - common characters only
  - HSK/common-use set
  - all Unihan/CJK unified ideographs
- Whether the pinyin dictionary may be generated from an external source and committed as static data.
- Whether the numeric output should be standard pinyin (`ben3`) or match the literal requested example (`be3n`).
- Whether phrase-level disambiguation is expected or a per-character fallback is acceptable.
- Whether `/pinyin/` should be linked from the root `pages/index.html`.

## Expanded Dictionary Research

New requirements:

- Split `PINYIN_DATA` out of `pages/pinyin/index.html` into a separate JavaScript data file.
- Register all characters.
- Support characters with multiple Mandarin readings.
- Display non-primary readings more faintly.

### Current implementation reality

Relevant current files:

- `pages/pinyin/index.html`
  - Contains all CSS, UI markup, dictionary data, and conversion logic.
  - `PINYIN_DATA` is an inline array of `[char, simplified, traditional, numericPinyin]`.
  - `pinyinMap` stores exactly one object per character with:
    - `simplified`
    - `traditional`
    - `numeric`
  - `convertText()` assumes a single `entry.numeric` value.
  - Table rendering stores one string in `row.pinyin`.
  - Tone-mark output derives from one numeric syllable per character.
  - Unknown Han characters increment `unknownHan` and render a blank pinyin cell.

Execution flow today:

1. Browser loads `pages/pinyin/index.html`.
2. Inline `PINYIN_DATA` initializes `pinyinMap`.
3. `sourceText` receives input.
4. `convertText()` loops through `Array.from(text)`.
5. Known characters output exactly one pinyin string.
6. `renderTable()` renders three rows: simplified, traditional, pinyin.

Key invariant that must change:

- Current model is one character -> one pinyin string.
- New model needs one character -> primary pinyin plus zero or more secondary pinyin values.

### Official source options

Unicode Standard Annex #38 describes the Unihan database. The current online version observed during research is Unicode 17.0.0, dated 2025-08-21. It states that `Unihan.zip` is a snapshot of public Unihan database contents for a Unicode release and that the archive contains UTF-8 text files with three tab-separated fields: Unicode scalar value, property name, and property value.

Relevant Unihan properties:

- `kMandarin`
  - Informative reading property.
  - Described as the most customary pinyin reading for an ideograph.
  - If two values exist, the first is preferred for `zh-Hans` and the second for `zh-Hant`.
  - Good source for primary readings.
- `kHanyuPinyin`
  - In `Unihan_Readings.txt`.
  - Candidate source for additional readings beyond `kMandarin`.
- `kHanyuPinlu`
  - In `Unihan_Readings.txt`.
  - Candidate source for readings with frequency information.
- `kXHC1983`
  - In `Unihan_Readings.txt`.
  - Candidate source for additional Mandarin readings from a dictionary source.
- `kSimplifiedVariant`
  - In `Unihan_Variants.txt`.
  - Candidate source for traditional-to-simplified mapping.
- `kTraditionalVariant`
  - In `Unihan_Variants.txt`.
  - Candidate source for simplified-to-traditional mapping.

Unicode UAX #38 also explicitly says simplified/traditional conversion is complicated:

- Some mappings are one-to-many.
- Some mappings are context-dependent.
- Some characters may be used unchanged in both simplified and traditional writing.
- Some characters are their own simplification while also simplifying another character.

Implication:

- A static character-level table can show candidate simplified/traditional variants, but it cannot guarantee word-context-correct conversion.

### Coverage meaning of "all characters"

Possible meanings:

1. All Unicode Unihan ideographs.
   - UAX #38 lists 102,998 ideographs covered by the Unihan database in Unicode 17.0.0.
   - Not every ideograph necessarily has useful Mandarin reading data.
2. All characters with Mandarin readings in Unihan.
   - More practical for this app because the pinyin table cannot produce pinyin for characters with no Mandarin reading property.
3. All common modern Chinese characters.
   - Smaller and faster, but does not satisfy the user's explicit wording.

The implementation should define "registered" as all characters found in the generated data source with at least one Mandarin reading, while unknown status should remain for Han characters without any included Mandarin reading.

### Data file shape needed

The new runtime data should support:

- Fast lookup by character.
- Primary reading.
- Secondary readings.
- Simplified and traditional candidate glyph lists, not just one glyph.

Likely generated structure:

```js
window.PINYIN_DATA = {
  "长": {
    "s": ["长"],
    "t": ["長"],
    "p": ["zhang3", "chang2"]
  },
  "長": {
    "s": ["长"],
    "t": ["長"],
    "p": ["zhang3", "chang2"]
  }
};
```

Where:

- `p[0]` is the primary reading.
- `p[1...]` are secondary readings.
- `s` and `t` are arrays to preserve one-to-many variant candidates.

### Runtime UI implications

Output textareas:

- The main tone-mark and numeric output need a deterministic default.
- Use primary readings only in the continuous pinyin output.
- Secondary readings should not be mixed into the continuous text by default, or the output becomes ambiguous and hard to copy.

Table:

- The pinyin row can show primary reading first and secondary readings after it.
- Secondary readings can be rendered in a nested element with muted color or reduced opacity.
- For example:
  - primary: `zhǎng`
  - secondary: `cháng`

Readonly pinyin textarea:

- User note resolved this: secondary readings should appear in the pinyin-only readonly textarea too.
- The textarea therefore needs an unambiguous text representation for alternatives, for example `zhang3/chang2`, while preserving primary-first ordering.
- User note prefers `zhang3 (chang2)` if there is no official notation that dictates otherwise.
- The main copyable output boxes may either follow the same alternative-inclusive representation or remain primary-only; this must be made explicit in the plan.

Status:

- `N文字変換済` should count characters with at least one reading.
- `N文字未登録` should count Han characters with no included reading.

### Data generation and licensing constraints

- Pulling `Unihan.zip` from unicode.org during development requires a network step, but the deployed page should not fetch anything at runtime.
- The generated JavaScript data file should be committed under `pages/pinyin/`.
- A source-generation script can live outside `pages/`, for example `pages/pinyin/build-data.mjs` or `scripts/`, but introducing a build script changes repo structure.
- The Unicode data license and attribution should be checked before committing generated data. The page or README may need a short attribution note.

### Potential pitfalls

- `kMandarin` values are tone-mark pinyin, not necessarily numeric pinyin. Generation will need robust conversion from marks to numbers.
- Some Unihan readings may include multiple values or source prefixes depending on property.
- `kHanyuPinyin` values are not plain pinyin lists in all cases; parser must handle dictionary location prefixes and comma-separated readings.
- `kHanyuPinlu` includes frequency-like data and must be parsed carefully if used.
- Sorting readings matters: primary must be stable and defensible.
- If both `kMandarin` and `kHanyuPinyin` disagree, the app needs a clear precedence rule.
- Full Unihan data can produce a large JavaScript file. This is acceptable for static Pages only if size remains reasonable after compact encoding.
- Browser parsing time for a huge object literal must be measured.
- Compatibility ideographs and extension characters may require fonts not available on the user's system.

### Constraints

- No runtime network access for conversion.
- GitHub Pages can publish `pages/pinyin/*.js` without workflow changes because `pages/.` is copied into `dist-pages/`.
- The user explicitly asked for a separate data file, so `PINYIN_DATA` should no longer be inline in `index.html`.
- For essential data-source choice, workflow guardrails require recommending the source/library approach and getting user approval before adding dependencies or relying on third-party data.

### User-Resolved Decisions

- "All characters" means all ideographs with Mandarin readings, not all Unihan ideographs regardless of reading availability.
- Generated data should rely on Unicode Unihan only. CC-CEDICT should not be added for this iteration.
- Secondary readings should appear in the pinyin-only readonly textarea too.
- Unicode data attribution/license information should be visible on the page.

### Remaining Unknowns

- Exact text syntax for multiple readings in continuous outputs:
  - Preferred by user note: `zhang3 (chang2)` if no official notation must be followed.
  - Alternatives considered: `zhang3/chang2`, `zhang3 | chang2`.
- Whether the two top output boxes should include secondary readings or remain primary-only while the readonly textarea includes alternatives.
- Whether generation should be a checked-in script plus generated output, or only checked-in generated output with source notes.
