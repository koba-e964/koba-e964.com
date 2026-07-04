# Plan: Pinyin Converter Unihan Data Upgrade

## Overview

Upgrade the existing `/pinyin/` static page from a small inline hand-written dictionary to generated Unicode Unihan data.

The next version will:

- Move pinyin data out of `pages/pinyin/index.html` into a separate static JavaScript file.
- Generate that data from Unicode Unihan only.
- Cover all Unihan ideographs that have Mandarin readings.
- Store multiple readings per character, with the first reading treated as primary.
- Render secondary readings in a muted style in the table.
- Include secondary readings in the pinyin-only readonly textarea using `primary (secondary)` notation.
- Show Unicode data attribution/license information on the page.

The runtime remains fully static after page load. The generation step is a repository maintenance step, not a runtime dependency.

## Files to Change

- `pages/pinyin/index.html`
  - Remove inline `PINYIN_DATA`.
  - Load the generated data file.
  - Update conversion logic for multiple readings.
  - Render secondary readings with muted styling.
  - Add visible Unicode attribution/license note.
- `pages/pinyin/pinyin-data.js`
  - New generated static data file.
  - Exposes `window.PINYIN_DATA`.
- `pages/pinyin/build-pinyin-data.mjs`
  - New generation script.
  - Reads extracted Unihan text files and emits `pinyin-data.js`.
- `pages/pinyin/README.md`
  - New app-specific notes for data source, regeneration, and attribution.
- `codex-notes/pinyin-converter-unihan-upgrade/feature_list.json`
  - Track next-phase Unihan data upgrade tasks separately from the completed initial-release tasks.

No GitHub Actions change is planned. `pages/.` is already copied into the deployed Pages artifact, so `pages/pinyin/*.js` will be published with the page.

## Detailed Implementation Steps

1. Add generated data file loading.
   - Add `<script src="./pinyin-data.js"></script>` before the existing page script.
   - Keep the converter script in `index.html` for now, but consume `window.PINYIN_DATA`.
   - Fail gracefully if the data file is missing or malformed.

2. Define compact generated data shape.
   - Use one entry per character.
   - Store simplified and traditional candidates as arrays.
   - Store pinyin readings as an ordered array.
   - Example:

```js
window.PINYIN_DATA = {
  "长": { s: ["长"], t: ["長"], p: ["zhang3", "chang2"] },
  "長": { s: ["长"], t: ["長"], p: ["zhang3", "chang2"] }
};
```

3. Add a Unihan generator script.
   - Input files:
     - `Unihan_Readings.txt`
     - `Unihan_Variants.txt`
   - Primary reading source:
     - `kMandarin`
   - Secondary reading sources:
     - `kHanyuPinyin`
     - `kHanyuPinlu`
     - `kXHC1983`
   - Variant sources:
     - `kSimplifiedVariant`
     - `kTraditionalVariant`
   - Output:
     - `pages/pinyin/pinyin-data.js`

4. Implement pinyin normalization in the generator.
   - Convert tone-mark pinyin to numeric pinyin.
   - Normalize `ü` consistently to `v` or `u:` internally; keep numeric output user-facing as standard lowercase syllables.
   - Deduplicate readings while preserving primary-first ordering.
   - If `kMandarin` has two readings, keep both in order.

5. Update runtime conversion logic.
   - Treat `entry.p[0]` as primary.
   - Continuous top output boxes use primary readings for deterministic copy behavior.
   - Readonly pinyin textarea includes alternatives with `primary (secondary1, secondary2)` notation.
   - Unknown Han characters still count as `N文字未登録`.
   - `N文字変換済` counts characters with at least one reading.

6. Update table rendering.
   - Simplified row joins multiple candidate simplified glyphs with `/`.
   - Traditional row joins multiple candidate traditional glyphs with `/`.
   - Pinyin row renders:
     - primary reading normally
     - secondary readings in a muted nested span
   - Tone-mark table display should use tone marks for readability, while generated data remains numeric.

7. Add visible attribution.
   - Add a concise page note that data is generated from the Unicode Unihan Database.
   - Link or text-reference Unicode terms without adding runtime network dependency.

8. Document regeneration.
   - Add `pages/pinyin/README.md`.
   - Include:
     - source files expected
     - generation command
     - output file
     - coverage definition: all Unihan ideographs with Mandarin readings
     - known limitation: no phrase-level disambiguation

9. Validate.
   - Generator syntax:
     - `node --check pages/pinyin/build-pinyin-data.mjs`
   - Runtime script syntax:
     - `node` check for scripts in `index.html` and `pinyin-data.js`
   - Sample conversion checks:
     - `日本` -> `ri4 ben3`
     - `站長` / `站长` -> primary `zhan4 zhang3`
     - `長` / `长` include secondary reading in table and readonly textarea
   - Static repo checks:
     - `pre-commit run --all-files`

## Alternatives Considered

- Keep expanding the hand-written dictionary.
  - Rejected because it cannot credibly satisfy "all characters" and will keep missing real input.

- Use CC-CEDICT for phrase-level readings.
  - Rejected for this iteration because the user explicitly chose Unicode Unihan only.

- Put generated data inline in `index.html`.
  - Rejected because the user explicitly asked to split `PINYIN_DATA` into a separate file.

- Include secondary readings in every visible output.
  - Partially rejected. Top output boxes should stay deterministic and copy-friendly with primary readings. The table and readonly textarea will expose alternatives.

## Risks

- Unihan readings are character-level, so polyphonic word context is still not solved.
- Some variant mappings are one-to-many or context-dependent; the table can show candidates but cannot guarantee word-level simplified/traditional conversion.
- `kHanyuPinyin`, `kHanyuPinlu`, and `kXHC1983` formats need careful parsing.
- Full generated data may be large and can affect page parse time.
- Some rare ideographs may not render with available system fonts.
- Unicode licensing/attribution must be kept visible and accurate.

## Test Strategy

- Unit-like Node checks around generator parsing and normalization for:
  - tone marks to numeric tones
  - multiple readings
  - variant extraction
  - deduplication and primary-first ordering
- Runtime smoke checks using a small DOM stub:
  - primary-only output boxes
  - alternative-inclusive readonly textarea
  - muted secondary reading table markup
  - unknown Han count
- Static checks:
  - `node --check pages/pinyin/build-pinyin-data.mjs`
  - `node --check pages/pinyin/pinyin-data.js`
  - `pre-commit run --all-files`

## Assumptions

- "All characters" means all Unihan ideographs with Mandarin readings.
- Unicode Unihan is the only data source for this iteration.
- Multiple readings should be represented as `primary (secondary)` when shown in textarea form.
- The two top output boxes remain primary-only for deterministic copying.
- It is acceptable to commit generated `pinyin-data.js`.
- The generator may require a one-time network/download step outside runtime, but the deployed page must not fetch data.

## Open Questions

- Exact local location for downloaded/extracted Unihan source files.
- Whether to commit a tiny fixture for generator tests, or keep tests embedded in the generator script.
- Whether generated `pinyin-data.js` size needs a hard budget before implementation.
