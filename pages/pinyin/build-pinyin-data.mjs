#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_READINGS = path.join(__dirname, "Unihan_Readings.txt");
const DEFAULT_VARIANTS = path.join(__dirname, "Unihan_Variants.txt");
const OUTPUT_PATH = path.join(__dirname, "pinyin-data.js");

const READING_FIELDS = new Set(["kMandarin", "kHanyuPinyin", "kHanyuPinlu", "kXHC1983"]);
const VARIANT_FIELDS = new Set(["kSimplifiedVariant", "kTraditionalVariant"]);

const combiningToneMarks = new Map([
  ["\u0304", "1"],
  ["\u0301", "2"],
  ["\u030C", "3"],
  ["\u0300", "4"]
]);

function usage() {
  return [
    "使い方: node pages/pinyin/build-pinyin-data.mjs [Unihan_Readings.txt] [Unihan_Variants.txt]",
    "",
    `既定の読みデータ: ${DEFAULT_READINGS}`,
    `既定の異体字データ: ${DEFAULT_VARIANTS}`
  ].join("\n");
}

function codePointToChar(codePoint) {
  return String.fromCodePoint(Number.parseInt(codePoint.replace(/^U\+/u, ""), 16));
}

function parseUnihanLines(text, fields) {
  const rows = [];
  for (const line of text.split(/\r?\n/u)) {
    if (!line || line.startsWith("#")) continue;
    const [codePoint, field, value] = line.split("\t");
    if (!codePoint || !field || value === undefined || !fields.has(field)) continue;
    rows.push({ char: codePointToChar(codePoint), field, value });
  }
  return rows;
}

function addOrdered(target, values) {
  for (const value of values) {
    if (value && !target.includes(value)) target.push(value);
  }
}

function normalizePinyinToken(token) {
  const clean = token
    .trim()
    .toLowerCase()
    .replace(/u:/gu, "ü")
    .replace(/（.*?）|\(.*?\)/gu, "");

  if (!clean) return "";

  let tone = "";
  let body = "";
  for (const char of clean.normalize("NFD")) {
    const combiningTone = combiningToneMarks.get(char);
    if (combiningTone) {
      tone = combiningTone;
    } else if (char === "\u0308") {
      body = body.replace(/u$/u, "v");
    } else if (/[a-z]/u.test(char)) {
      body += char;
    }
  }

  if (!body) return "";
  return `${body}${tone || "5"}`;
}

function extractReadings(field, value) {
  const tokens = [];
  if (field === "kHanyuPinyin" || field === "kXHC1983") {
    for (const section of value.split(/\s+/u)) {
      const readingPart = section.includes(":") ? section.slice(section.indexOf(":") + 1) : section;
      tokens.push(...readingPart.split(/[,，]/u));
    }
  } else if (field === "kHanyuPinlu") {
    tokens.push(...value.replace(/\(\d+\)/gu, " ").split(/\s+/u));
  } else {
    tokens.push(...value.split(/\s+/u));
  }
  return tokens.map(normalizePinyinToken).filter(Boolean);
}

function extractVariantTargets(value) {
  return value
    .split(/\s+/u)
    .map((token) => token.match(/^U\+[0-9A-F]{4,6}/u)?.[0])
    .filter(Boolean)
    .map(codePointToChar);
}

function orderedReadings(fields) {
  const readings = [];
  addOrdered(readings, fields.kMandarin || []);
  addOrdered(readings, fields.kHanyuPinyin || []);
  addOrdered(readings, fields.kHanyuPinlu || []);
  addOrdered(readings, fields.kXHC1983 || []);
  return readings;
}

function buildData(readingsText, variantsText) {
  const readingByChar = new Map();
  const simplifiedByChar = new Map();
  const traditionalByChar = new Map();

  for (const { char, field, value } of parseUnihanLines(readingsText, READING_FIELDS)) {
    if (!readingByChar.has(char)) readingByChar.set(char, {});
    const fields = readingByChar.get(char);
    if (!fields[field]) fields[field] = [];
    addOrdered(fields[field], extractReadings(field, value));
  }

  for (const { char, field, value } of parseUnihanLines(variantsText, VARIANT_FIELDS)) {
    const target = field === "kSimplifiedVariant" ? simplifiedByChar : traditionalByChar;
    if (!target.has(char)) target.set(char, []);
    addOrdered(target.get(char), extractVariantTargets(value));
  }

  const output = {};
  for (const char of [...readingByChar.keys()].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))) {
    const readings = orderedReadings(readingByChar.get(char));
    if (readings.length === 0) continue;

    const simplified = simplifiedByChar.get(char) || [char];
    const traditional = traditionalByChar.get(char) || [char];
    output[char] = { s: simplified, t: traditional, p: readings };
  }
  return output;
}

function compactEntry([char, entry]) {
  const sameSimplified = entry.s.length === 1 && entry.s[0] === char;
  const sameTraditional = entry.t.length === 1 && entry.t[0] === char;
  if (sameSimplified && sameTraditional) return [char, entry.p];
  if (sameTraditional) return [char, entry.p, entry.s];
  if (sameSimplified) return [char, entry.p, 0, entry.t];
  return [char, entry.p, entry.s, entry.t];
}

function compactData(data) {
  return Object.entries(data).map(compactEntry);
}

async function main() {
  const [readingsPath = DEFAULT_READINGS, variantsPath = DEFAULT_VARIANTS] = process.argv.slice(2);
  if (process.argv.includes("--help")) {
    console.log(usage());
    return;
  }

  const [readingsText, variantsText] = await Promise.all([
    readFile(readingsPath, "utf8"),
    readFile(variantsPath, "utf8")
  ]);
  const data = buildData(readingsText, variantsText);
  const compact = compactData(data);
  const json = JSON.stringify(compact);
  const header = [
    "/* build-pinyin-data.mjs で Unicode UCD 17.0.0 Unihan データから生成。",
    " * 元データ: https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
    " * 利用条件: https://www.unicode.org/terms_of_use.html",
    " */"
  ].join("\n");
  await writeFile(OUTPUT_PATH, `${header}\nwindow.PINYIN_DATA = ${json};\n`, "utf8");
  console.log(`${compact.length} 件の簡潔形式データを ${path.relative(process.cwd(), OUTPUT_PATH)} に書き込みました`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
