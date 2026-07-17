# リアルタイム拼音変換(簡易版) データ

`pinyin-data.js` は Unicode Unihan データベース 17.0.0 から生成しています。
`pinyin-phrase-data.js` は CC-CEDICT から生成しています。

元アーカイブ:

- https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip

このアーカイブから展開して使う入力ファイル:

- `Unihan_Readings.txt`
- `Unihan_Variants.txt`

コミット済みデータファイルの再生成コマンド:

```sh
node pages/pinyin/build-pinyin-data.mjs /path/to/Unihan_Readings.txt /path/to/Unihan_Variants.txt
node pages/pinyin/build-pinyin-phrase-data.mjs /path/to/cedict_1_0_ts_utf-8_mdbg.txt.gz
```

生成されるファイル:

- `pages/pinyin/pinyin-data.js`
- `pages/pinyin/pinyin-phrase-data.js`

生成 JavaScript は、配信する静的ファイルを小さくするために、簡潔な位置配列形式を使います。簡体字・繁體字が元文字と同じ場合、その配列は省略します。

語単位データは、CC-CEDICT の二字以上の漢字語のうち、文字単位の第一候補読みと異なるものだけを抽出します。読みが複数あって一意に決められない語は除外します。

対象範囲は、選択した Unihan データ内で中国語普通話の読みを持つ全 Unihan 漢字と、選択した CC-CEDICT データから抽出した語単位の読みです。まだ簡易版なので、イレギュラーなケースでは期待する読みが一番に出ないことがあります。

ページと生成ファイルには Unicode と CC-CEDICT の出典表示と利用条件へのリンクを含めます。

- https://www.unicode.org/terms_of_use.html
- https://www.mdbg.net/chinese/dictionary?page=cc-cedict
- https://creativecommons.org/licenses/by-sa/4.0/
