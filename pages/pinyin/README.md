# Pinyin Converter Data

`pinyin-data.js` is generated from the Unicode Unihan Database 17.0.0.

Source archive:

- https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip

Input files extracted from that archive:

- `Unihan_Readings.txt`
- `Unihan_Variants.txt`

Regenerate the committed data file with:

```sh
node pages/pinyin/build-pinyin-data.mjs /path/to/Unihan_Readings.txt /path/to/Unihan_Variants.txt
```

The generator writes:

- `pages/pinyin/pinyin-data.js`

The generated JavaScript uses a compact positional array format to keep the shipped static asset smaller. Entries omit simplified/traditional arrays when they are identical to the source character.

Coverage is all Unihan ideographs that have Mandarin readings in the selected Unihan data. Readings are character-level only; the page does not perform phrase-level or context-sensitive disambiguation for polyphonic characters.

The page and generated file include Unicode attribution and link to the Unicode terms of use:

- https://www.unicode.org/terms_of_use.html
