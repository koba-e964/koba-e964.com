import test from "node:test";
import assert from "node:assert/strict";

import { parseEmaxisFundHtml } from "../src/sources/emaxis.js";
import { parseMufgFxHtml } from "../src/sources/mufg.js";
import { parseYahooSp500Html } from "../src/sources/yahoo.js";

test("parseYahooSp500Html extracts trade date and price", () => {
  const html = `
    <html>
      <body>
        <div>2026/04/10 終値</div>
        <div>現在値 5,220.44</div>
      </body>
    </html>
  `;
  const record = parseYahooSp500Html(
    html,
    "https://finance.yahoo.co.jp/quote/%5EGSPC",
    "2026-04-13T00:00:00Z",
  );
  assert.equal(record.tradeDate, "2026-04-10");
  assert.equal(record.closeValue, 5220.44);
});

test("parseMufgFxHtml extracts TTS TTB TTM", () => {
  const html = `
    <html>
      <body>
        <p>2026年4月13日</p>
        <table>
          <tr><th>米ドル</th><td>145.88</td><td>143.88</td></tr>
        </table>
      </body>
    </html>
  `;
  const record = parseMufgFxHtml(
    html,
    "https://www.bk.mufg.jp/ippan/kinri/list_j/kinri/kawase.html",
    "2026-04-13T00:00:00Z",
  );
  assert.equal(record.businessDate, "2026-04-13");
  assert.equal(record.ttm, 144.88);
});

test("parseEmaxisFundHtml extracts date and NAV", () => {
  const html = `
    <html>
      <body>
        <p>2026年4月13日</p>
        <p>基準価額 35,510円</p>
      </body>
    </html>
  `;
  const record = parseEmaxisFundHtml(
    html,
    "253266",
    "https://emaxis.am.mufg.jp/fund/253266.html",
    "2026-04-13T00:00:00Z",
  );
  assert.equal(record.businessDate, "2026-04-13");
  assert.equal(record.nav, 35510);
});
