# Research: Pinyin Phrase Dictionary Upgrade

## Relevant Files And Modules

- `pages/pinyin/index.html`
  - Static pinyin converter UI and runtime conversion logic.
  - Loads `./pinyin-data.js`.
  - Builds `pinyinMap` from `window.PINYIN_DATA`.
  - Currently has an uncommitted manual `phrasePinyinOverrideEntries` list for selected multi-character words.
- `pages/pinyin/pinyin-data.js`
  - Generated character-level Unihan data.
  - Exposes `window.PINYIN_DATA` as compact arrays.
- `pages/pinyin/build-pinyin-data.mjs`
  - Generates `pinyin-data.js` from Unihan reading and variant text files.
  - Source inputs are `Unihan_Readings.txt` and `Unihan_Variants.txt`.
- `pages/pinyin/README.md`
  - Documents current data source, regeneration command, and the limitation that the converter is basically character-level.
- `codex-notes/pinyin-converter-unihan-upgrade/progress.toml`
  - Tracks the remaining concern that the existing `pinyin-data.js` asset may still be large.

## Current Execution Flow

1. `index.html` loads `pinyin-data.js`.
2. The page script normalizes `window.PINYIN_DATA` entries into `pinyinMap`.
3. `convertText(text)` iterates over `Array.from(text)`.
4. For each position, current uncommitted logic checks `findPhraseOverride(chars, index)` first.
5. If a phrase override matches, `convertPhraseOverride()` emits one row per character using the phrase-specific pinyin syllable.
6. Otherwise, the converter falls back to one-character lookup in `pinyinMap`.
7. Unknown Han characters increment `unknownHan`; punctuation and whitespace are appended literally.

## Data Structures And Invariants

- `window.PINYIN_DATA` entry shapes:
  - `[char, readings]`
  - `[char, readings, simplified]`
  - `[char, readings, 0, traditional]`
  - `[char, readings, simplified, traditional]`
- `readings` is an ordered array of numeric-tone syllables such as `xing2`.
- Runtime rows have:
  - `simplified`
  - `traditional`
  - `readings`
- Phrase override entries currently use:
  - `[word, [syllable1, syllable2, ...]]`
- Phrase matching assumes:
  - `Array.from(word).length === readings.length`
  - every matched character exists in `pinyinMap`
  - longest phrase should match before shorter phrases

## External Data Source Findings

### Unihan

- Unicode UAX #38 describes Unihan as data for Han ideographs.
- `Unihan.zip` is a snapshot of public Unihan database contents.
- Data lines have three tab-separated fields: scalar value, property name, and property value.
- Readings such as Mandarin readings are per ideograph, not per word.
- UAX #38 says the Unihan web front end may link to external compound data such as CC-CEDICT, but those compound data are not included in `Unihan.zip`.

Conclusion: Unihan can continue to supply character-level readings and variants, but it cannot supply a comprehensive multi-character word reading list by itself.

### CC-CEDICT

- CC-CEDICT is a downloadable Chinese-English word dictionary with pinyin.
- MDBG describes the current release as UTF-8 with both traditional and simplified Chinese.
- Observed release metadata on 2026-07-17:
  - latest release: `2026-07-17 09:15:28 GMT`
  - entries: `124731`
- CC-CEDICT license is Creative Commons Attribution-ShareAlike 4.0 International.
- The downloaded gzip header includes:
  - `# CC-CEDICT`
  - `# Community maintained free Chinese-English dictionary.`
  - `# Published by MDBG`
  - `# License: Creative Commons Attribution-ShareAlike 4.0 International License`
  - `# https://creativecommons.org/licenses/by-sa/4.0/`

Conclusion: CC-CEDICT is the right class of source for `银行/銀行 [yin2 hang2]` and similar phrase-level readings, but adding it introduces attribution and share-alike license obligations distinct from Unicode terms.

## Local Measurement

Temporary source file used for measurement:

- `/private/tmp/cedict_1_0_ts_utf-8_mdbg.txt.gz`

Probe lines found in CC-CEDICT:

- `了解 了解 [liao3 jie3]`
- `行長 行长 [hang2 zhang3]`
- `重慶 重庆 [Chong2 qing4]`
- `銀行 银行 [yin2 hang2]`
- `音樂 音乐 [yin1 yue4]`

Measured extraction strategy:

- Parse all CC-CEDICT entries.
- Add both traditional and simplified word forms.
- Keep only words with at least two Han characters.
- Keep only entries where pinyin syllable count equals character count.
- Keep only entries where all characters exist in current `pinyinMap`.
- Keep only entries where the phrase reading differs from the current per-character primary reading.

Result:

- total CC-CEDICT entries parsed: `124731`
- eligible word-form occurrences before difference filtering: `183202`
- changed occurrences: `20604`
- unique phrase overrides: `20529`
- generated JS bytes, simple `[word, "pin1 yin1"]` array: `641555`
- gzip bytes at level 9: `198264`

Stricter variants:

- Only if the changed syllable is also known as an alternate Unihan reading:
  - unique phrase overrides: `19404`
  - generated JS bytes: `610139`
  - gzip bytes: `187561`
- Only if every phrase syllable is known in Unihan for its character:
  - unique phrase overrides: `19221`
  - generated JS bytes: `604475`
  - gzip bytes: `185663`

This would be in addition to the existing character asset, which is already a size concern.

## Existing Architectural Patterns

- Generated static JavaScript data is committed to the repo.
- Runtime does not fetch data after load.
- The generator uses Node standard library only.
- Data compression is achieved by compact positional arrays rather than verbose object keys.
- Documentation lives beside the static page under `pages/pinyin/README.md`.
- Longer-term TODOs for this page are tracked in `codex-notes/pinyin-converter-unihan-upgrade/progress.toml`.

## Naming Conventions

- Existing generated data global: `window.PINYIN_DATA`.
- A phrase asset would fit as `window.PINYIN_PHRASE_DATA`.
- Existing generator name: `build-pinyin-data.mjs`.
- A combined or related generator could be named near that file, for example `build-pinyin-phrase-data.mjs`, if planned.

## Error Handling Patterns

- Generator scripts fail by throwing and setting `process.exitCode = 1`.
- Runtime conversion gracefully falls back to one-character lookup if phrase conversion cannot produce valid rows.
- Unknown Han characters are counted and displayed instead of throwing.

## Potential Pitfalls

- Unihan is not a phrase dictionary; trying to derive comprehensive word readings from it alone cannot work.
- Full CC-CEDICT is large. Even a filtered override-only phrase asset is roughly 185-198 KB gzip in the quick measurement.
- CC-CEDICT license is CC BY-SA 4.0, so the page and README need explicit attribution and license handling if the derived phrase data is committed.
- Multiple CC-CEDICT entries can exist for one word with different readings. Runtime needs a deterministic choice or a way to retain alternatives.
- Proper nouns and entries with capitalization need normalization before comparison.
- Some CC-CEDICT pinyin tokens may not align one-to-one with Han characters; those entries must be skipped or handled explicitly.
- Phrase matching by scanning every phrase at every character position would be too slow for about 20,000 overrides. Runtime should use a prefix index, trie, or length-bucketed map.
- Adding a second generated asset increases first-load weight. The earlier 300 KB gzip concern remains relevant.
- MDBG page states automated or scripted access is prohibited; for reproducible generation, prefer a permitted CC-CEDICT project download endpoint or document a manual source download step.

## Constraints

- The page must remain static and offline after load.
- The user removed static/offline explanatory UI copy earlier; implementation should avoid reintroducing that product wording.
- The default input should remain empty with placeholder `日本`.
- The old language buttons should remain absent.
- Existing Chinese font styling for `简体字 / 繁體字` should remain.
- Unicode terms link must remain visible.
- The existing disclaimer that this is still a simplified version must remain.
- Current uncommitted manual phrase override work exists and should be either replaced or folded into generated phrase data, not reverted blindly.

## Unknowns

- Whether adding approximately 185-198 KB gzip of phrase overrides is acceptable on top of the current character asset.
- Whether CC BY-SA 4.0 is acceptable for this static page and repository.
- Whether phrase data should be a separate generated file or folded into `pinyin-data.js`.
- Whether to include only phrase readings that differ from the current primary character reading, or to include a broader word dictionary.
- Whether to preserve multiple readings for the same word or choose the first CC-CEDICT entry.
- Whether to generate from a pinned CC-CEDICT release artifact committed outside `pages/pinyin/`, or to document manual download only.
