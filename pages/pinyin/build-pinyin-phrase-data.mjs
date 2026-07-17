#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CEDICT = path.join(__dirname, "cedict_1_0_ts_utf-8_mdbg.txt");
const PINYIN_DATA_PATH = path.join(__dirname, "pinyin-data.js");
const OUTPUT_PATH = path.join(__dirname, "pinyin-phrase-data.js");
const gunzipAsync = promisify(gunzip);
const hanPattern = /^\p{Script=Han}+$/u;

function usage() {
  return [
    "使い方: node pages/pinyin/build-pinyin-phrase-data.mjs [cedict.txt|cedict.txt.gz]",
    "",
    `既定の CC-CEDICT: ${DEFAULT_CEDICT}`,
    `文字単位データ: ${PINYIN_DATA_PATH}`
  ].join("\n");
}

async function readTextMaybeGzip(filePath) {
  const buffer = await readFile(filePath);
  if (filePath.endsWith(".gz")) {
    return (await gunzipAsync(buffer)).toString("utf8");
  }
  return buffer.toString("utf8");
}

async function loadCharReadings() {
  const source = await readFile(PINYIN_DATA_PATH, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: PINYIN_DATA_PATH });

  const readings = new Map();
  for (const entry of context.window.PINYIN_DATA || []) {
    if (
      Array.isArray(entry) &&
      typeof entry[0] === "string" &&
      Array.isArray(entry[1]) &&
      entry[1].length > 0
    ) {
      readings.set(
        entry[0],
        entry[1].map((reading) => reading.toLowerCase())
      );
    }
  }
  return readings;
}

function normalizeCedictPinyin(token) {
  const normalized = token.trim().toLowerCase().replace(/u:/gu, "v");
  return /^[a-zvü]+[1-5]$/u.test(normalized) ? normalized : "";
}

function parseCedictLine(line) {
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\//u);
  if (!match) return null;
  const [, traditional, simplified, pinyinText] = match;
  const pinyin = pinyinText.split(/\s+/u).map(normalizeCedictPinyin);
  if (pinyin.some((token) => token === "")) return null;
  return { traditional, simplified, pinyin };
}

function isEligibleWord(word, pinyin, charReadings) {
  const chars = Array.from(word);
  if (chars.length < 2 || chars.length !== pinyin.length) return false;
  if (!hanPattern.test(word)) return false;
  if (!chars.every((char) => charReadings.has(char))) return false;
  return chars.some(
    (char, index) => charReadings.get(char)[0] !== pinyin[index]
  );
}

function addPhrase(phrases, duplicates, word, pinyin) {
  const reading = pinyin.join(" ");
  const existing = phrases.get(word);
  if (!existing) {
    phrases.set(word, reading);
  } else if (existing !== reading) {
    duplicates.add(word);
  }
}

function buildPhraseData(cedictText, charReadings) {
  const phrases = new Map();
  const duplicates = new Set();
  const counts = {
    total: 0,
    parsed: 0,
    eligibleForms: 0,
    duplicateReadings: 0
  };

  for (const line of cedictText.split(/\r?\n/u)) {
    if (!line || line.startsWith("#")) continue;
    counts.total += 1;
    const entry = parseCedictLine(line);
    if (!entry) continue;
    counts.parsed += 1;

    for (const word of new Set([entry.traditional, entry.simplified])) {
      if (!isEligibleWord(word, entry.pinyin, charReadings)) continue;
      counts.eligibleForms += 1;
      addPhrase(phrases, duplicates, word, entry.pinyin);
    }
  }

  for (const word of duplicates) {
    phrases.delete(word);
  }
  counts.duplicateReadings = duplicates.size;

  return {
    counts,
    data: [...phrases.entries()].sort(
      ([leftWord], [rightWord]) =>
        Array.from(rightWord).length - Array.from(leftWord).length ||
        leftWord.localeCompare(rightWord)
    )
  };
}

async function main() {
  const [cedictPath = DEFAULT_CEDICT] = process.argv.slice(2);
  if (process.argv.includes("--help")) {
    console.log(usage());
    return;
  }

  const [cedictText, charReadings] = await Promise.all([
    readTextMaybeGzip(cedictPath),
    loadCharReadings()
  ]);
  const { counts, data } = buildPhraseData(cedictText, charReadings);
  const header = [
    "/* build-pinyin-phrase-data.mjs で CC-CEDICT から生成。",
    " * 元データ: https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
    " * ライセンス: Creative Commons Attribution-ShareAlike 4.0 International",
    " * https://creativecommons.org/licenses/by-sa/4.0/",
    " */"
  ].join("\n");

  await writeFile(
    OUTPUT_PATH,
    `${header}\nwindow.PINYIN_PHRASE_DATA = ${JSON.stringify(data)};\n`,
    "utf8"
  );

  console.log(
    [
      `${data.length} 件の語単位データを ${path.relative(process.cwd(), OUTPUT_PATH)} に書き込みました`,
      `入力項目: ${counts.total}`,
      `解析項目: ${counts.parsed}`,
      `候補語形: ${counts.eligibleForms}`,
      `読み重複で除外: ${counts.duplicateReadings}`
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
