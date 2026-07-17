# Plan: Pinyin Phrase Dictionary Upgrade

## Overview

Add generated phrase-level pinyin overrides from a word dictionary source instead of maintaining hand-written phrase exceptions in `index.html`.

Keep Unihan as the character-level source. Add CC-CEDICT as the phrase-level source for multi-character Chinese words such as `银行/銀行`, `行长/行長`, `重庆/重慶`, and similar cases.

The implementation should keep the static page self-contained after load. It should not perform runtime network fetches.

## Files To Change

- `pages/pinyin/index.html`
  - Remove the hand-written `phrasePinyinOverrideEntries`.
  - Load generated phrase data.
  - Build an efficient phrase lookup index.
  - Match longest phrase at each input position before falling back to character-level Unihan data.
  - Add CC-CEDICT attribution and license link if generated phrase data is present.
- `pages/pinyin/build-pinyin-phrase-data.mjs`
  - New generator for phrase overrides from CC-CEDICT text.
  - Read current `pinyin-data.js` to compare against character-level primary readings.
  - Emit compact phrase data.
- `pages/pinyin/pinyin-phrase-data.js`
  - New generated static phrase override asset.
  - Expose `window.PINYIN_PHRASE_DATA`.
- `pages/pinyin/README.md`
  - Document CC-CEDICT source, license, regeneration command, extraction filter, and expected size.
- `codex-notes/pinyin-converter-unihan-upgrade/progress.toml`
  - Keep or extend the size concern TODO to include the new combined gzip weight.
- `codex-notes/pinyin-phrase-dictionary-upgrade/feature_list.json`
  - Track implementation tasks and validation status.

## Detailed Implementation Steps

1. Preserve current behavior while removing manual phrase maintenance.
   - Replace the in-page manual array with data loaded from `pinyin-phrase-data.js`.
   - Leave phrase matching behavior in place, but source it from generated data.

2. Generate phrase data from CC-CEDICT.
   - Input: a local CC-CEDICT UTF-8 text file, either plain `.txt` or extracted from `.gz` before running the generator.
   - Parse lines matching:
     - `traditional simplified [pinyin tokens] /definitions/`
   - Add both traditional and simplified word forms.
   - Keep only entries where:
     - word length is at least 2 Han characters
     - syllable count equals Han character count
     - every character exists in current `pinyinMap`
     - phrase pinyin differs from the current per-character primary reading
   - Normalize pinyin:
     - lowercase
     - `u:` to `v`
     - neutral tone stays as `5`
     - uppercase proper-name initials become lowercase
   - Deduplicate by word and pinyin sequence.
   - Sort by descending character length, then lexically for stable output.

3. Use compact generated format.
   - Candidate shape:
     - `["銀行","yin2 hang2"]`
   - Runtime expands syllables with `.split(" ")`.
   - This is smaller than storing `["銀行",["yin2","hang2"]]`.

4. Make runtime lookup efficient.
   - Do not scan all phrase entries at each character position.
   - Build a length-bucketed map:
     - `phraseByLength: Map<number, Map<string, string[]>>`
     - `phraseLengthsDesc: number[]`
   - At each input index, test only possible phrase lengths in descending order.
   - Use `chars.slice(index, index + length).join("")` for candidate lookup.
   - This gives deterministic longest-match behavior.

5. Handle duplicate word readings.
   - Initial implementation should keep the first generated reading per word after stable sort and dedup.
   - If the same word appears with a second reading, skip it for now and count skipped duplicates in generator output.
   - Reason: the current UI has no word-sense disambiguation and only one phrase override can be applied deterministically.

6. Add attribution and license UI/docs.
   - Keep existing Unicode terms link.
   - Add CC-CEDICT attribution near the existing data note.
   - Link to:
     - `https://www.mdbg.net/chinese/dictionary?page=cc-cedict`
     - `https://creativecommons.org/licenses/by-sa/4.0/`
   - Keep the simplified-version disclaimer.

7. Update size tracking.
   - Add a progress note that phrase data improves correctness but may add roughly 185-198 KB gzip depending on filter.
   - Measure actual generated `pinyin-phrase-data.js` size and gzip size after implementation.

8. Validate known cases.
   - Confirm the generated data covers:
     - `银行` -> `yin2 hang2`
     - `銀行` -> `yin2 hang2`
     - `行长` -> `hang2 zhang3`
     - `行長` -> `hang2 zhang3`
     - `重庆` -> `chong2 qing4`
     - `重慶` -> `chong2 qing4`
     - `音乐` -> `yin1 yue4`
     - `音樂` -> `yin1 yue4`
     - `了解` -> `liao3 jie3`
   - Confirm ordinary one-character fallback still works:
     - `日本` -> `ri4 ben3`
     - `行` remains character-level `xing2` unless inside a generated phrase.

## Alternatives Considered

- Keep adding manual overrides.
  - Rejected because the user explicitly wants a comprehensive list from data sources, and manual coverage will keep missing common words.

- Use Unihan only.
  - Rejected because Unihan is character-level and does not contain comprehensive multi-character word readings.

- Commit full CC-CEDICT-derived word data.
  - Rejected for this iteration because the current converter only needs pinyin overrides where character-level reading is wrong, and full dictionary data would be much larger.

- Fold phrase data into `pinyin-data.js`.
  - Rejected for initial implementation because separate generated assets make size accounting and source attribution clearer.

- Runtime fetch CC-CEDICT data.
  - Rejected because the page must remain static/offline after load and should not depend on network access.

## Risks

- The new phrase asset increases the first-load payload.
- CC BY-SA 4.0 obligations may be undesirable for this page/repo.
- Some CC-CEDICT entries represent proper nouns or word senses where the first deterministic reading is not always what a user expects.
- Skipping duplicate readings avoids nondeterminism but loses some valid alternatives.
- Length-bucket matching can still choose a longer phrase whose sense is wrong in context.
- If CC-CEDICT download endpoints change, regeneration docs may need updates.

## Test Strategy

- Syntax checks:
  - `node --check pages/pinyin/build-pinyin-phrase-data.mjs`
  - `node --check pages/pinyin/pinyin-phrase-data.js`
  - `node --check pages/pinyin/pinyin-data.js`
- Generator smoke test:
  - Run generator against a local CC-CEDICT text file.
  - Verify reported counts and output file sizes.
- Runtime smoke test:
  - Execute the `index.html` converter script in a Node `vm` with a minimal DOM stub, as done for prior checks.
  - Assert known phrase outputs.
  - Assert fallback character outputs.
- Repository validation:
  - `pre-commit run --all-files`
- Size check:
  - `wc -c pages/pinyin/pinyin-data.js pages/pinyin/pinyin-phrase-data.js`
  - gzip level 9 byte counts for both assets and combined total.

## Assumptions

- CC-CEDICT CC BY-SA 4.0 attribution and derived-data use are acceptable for this page.
- Generated phrase data should be committed like `pinyin-data.js`.
- The initial phrase filter should target words whose pinyin differs from current character-level primary readings.
- The page should keep the existing simplified-version disclaimer.
- Current uncommitted manual phrase override work can be replaced by generated phrase data after validation.

## Open Questions

- Whether the added gzip size is acceptable after measuring the final generated asset.
- Whether duplicate word readings should later be exposed as alternatives in the UI.
- Whether to pin a dated CC-CEDICT release in docs or continue documenting “download latest and regenerate”.
