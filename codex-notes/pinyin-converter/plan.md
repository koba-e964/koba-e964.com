# Plan: Pinyin Converter Static Site

## Overview

Add a new static tool at `/pinyin/` by creating `pages/pinyin/index.html`. The page will be self-contained: HTML, CSS, dictionary data, conversion logic, and UI behavior live in one file so the conversion works without runtime network requests.

The converter will use a character-level dictionary with simplified glyph, traditional glyph, and standard numeric-tone pinyin. Tone-mark output will be derived in JavaScript from the numeric-tone form to avoid storing duplicate pinyin values for every entry.

The implementation will intentionally be character-based, not phrase-based. That means it will be fast and fully static, but polyphonic characters may use the most common reading unless later dictionary or phrase support is added.

## Files to Change

- `pages/pinyin/index.html`
  - New static pinyin converter page.
- `pages/index.html`
  - Add a card linking to `/pinyin/`.
- `README.md`
  - Add `/pinyin/` to the repository structure and public content list.
- `codex-notes/pinyin-converter/feature_list.json`
  - Track implementation tasks and validation status.

No GitHub Actions change is planned because `.github/workflows/deploy-pages.yml` already copies `pages/.` into `dist-pages/`.

## Detailed Implementation Steps

1. Create `pages/pinyin/index.html`.
   - Use a complete first screen tool layout, not a marketing page.
   - Include:
     - textarea for input
     - tone-mark output
     - numeric-tone output
     - table rows for simplified, traditional, and pinyin with horizontal scrolling
     - readonly textarea containing only pinyin below the table
   - Keep layout dense and practical, suitable for repeated text conversion.

2. Add dictionary data inline.
   - Use a compact array format, then build a lookup map at startup.
   - Store entries as `[inputCharacter, simplified, traditional, numericPinyin]`.
   - Include enough common characters to make the page useful immediately, including the examples:
     - `日本` -> `rì běn` / `ri4 ben3`
     - `简体字` / `簡體字`
     - `繁体字` / `繁體字`
   - Use standard numeric pinyin spelling: `ben3`, not the literal typo-like `be3n`.
   - Unknown characters pass through in output text and appear in both table rows unchanged.

3. Implement conversion logic.
   - Listen to the textarea `input` event.
   - Split text into Unicode code points with `Array.from`.
   - Convert each known character into numeric pinyin.
   - Derive tone marks by applying the pinyin tone placement rules:
     - `a` or `e` gets priority
     - `ou` marks `o`
     - otherwise mark the final vowel
     - `u:` / `v` maps to `ü` for marked forms
   - Preserve whitespace in output.
   - Separate adjacent pinyin syllables with spaces while preserving punctuation and line breaks clearly.

4. Implement the character table.
   - For each input code point, render a column.
   - Top row label: `简体字`.
   - Second row label: `繁體字`.
   - Third row label: `pinyin`.
   - Each column shows the converted simplified/traditional glyph when known; otherwise the original code point.
   - Use `role="table"` or an actual `<table>` with CSS to support horizontal overflow.

5. Add empty and copied states.
   - Empty input should show blank outputs and a compact empty state in the table area.
   - Add a readonly textarea below the table for pinyin-only output.
   - Add copy buttons for pinyin outputs using `navigator.clipboard` where available.
   - Keep copy buttons as simple text buttons because no icon library exists in this static page.

6. Update root navigation.
   - Add a `/pinyin/` card to `pages/index.html`.

7. Update repo README.
   - Add `pinyin` as a static page under `pages/`.
   - Add `/pinyin/` to current public content.

8. Validate locally.
   - Run a lightweight static check that files exist and expected strings are present.
   - Run `pre-commit run --all-files` if available; current hooks target fund-price TypeScript only, so they should not modify or validate this page.
   - Optionally open `pages/pinyin/index.html` directly in a browser or use a simple local server if browser verification is needed.

## Alternatives Considered

- Add a build step and external pinyin package.
  - Rejected for the first version because this repository's small static pages do not currently use a root build system, and the user specifically wants the list available in-page.

- Store dictionary in a separate `data.js` file.
  - Rejected for the first version because the user said the character list should be included in the page. Inline data also keeps deployment simple.

- Implement phrase-level segmentation and polyphonic disambiguation.
  - Rejected for the first version because it requires a larger dictionary and substantially more logic. A character-level static converter satisfies the requested real-time behavior and keeps the page easy to extend.

- Use a table with one column per Unicode code point including punctuation and spaces.
  - Accepted with graceful behavior: spaces and punctuation can appear as their own columns, preserving the "each column corresponds to input position" invariant.

## Risks

- Dictionary coverage may be too small for arbitrary Chinese text.
- Polyphonic characters may be wrong without phrase-level context.
- Simplified/traditional mappings can be one-to-many or context-sensitive; the first version will use one representative mapping per character.
- Very long input can create a very wide table. Horizontal scrolling mitigates this, but thousands of characters may still be heavy.
- Direct file opening should work, but clipboard APIs may be limited on `file://` depending on browser policy.

## Test Strategy

- Manual example checks:
  - Input `日本` shows `rì běn` and `ri4 ben3`.
  - Input `简体字` shows simplified row `简 体 字` and traditional row `簡 體 字`.
  - Input `繁體字` shows simplified row `繁 体 字` and traditional row `繁 體 字`.
  - The conversion table includes a pinyin row.
  - The readonly pinyin textarea contains only pinyin text.
  - Unknown or punctuation input remains visible and does not throw.

- Static checks:
  - `test -f pages/pinyin/index.html`
  - `rg "Pinyin|拼音|简体字|繁體字|ri4 ben3" pages/pinyin/index.html`
  - `pre-commit run --all-files`

## Assumptions

- The public path should be `/pinyin/`.
- The root page should link to this tool.
- Standard numeric pinyin is desired, so `日本` should produce `ri4 ben3`. The user example `ri4 be3n` is treated as a typo.
- A useful initial dictionary of common/example characters is acceptable for the first version, with a structure that can be expanded later.
- No external runtime network dependency is allowed.

## Open Questions

- How broad should dictionary coverage be for the first public version?
- Should phrase-level disambiguation be added later for common polyphonic words?
- Should the page expose a visible note that conversion is character-based?
