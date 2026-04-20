import test from "node:test";
import assert from "node:assert/strict";

import { parseEmaxisFundJson } from "../src/sources/emaxis.js";
import { parseMufgFxHtml } from "../src/sources/mufg.js";
import { parseYahooSp500Html } from "../src/sources/yahoo.js";

test("parseYahooSp500Html extracts trade date and price", () => {
  const html = `
    <html>
      <body>
        <div class="_CommonPriceBoard__price_1g7gt_64">
          <span class="_StyledNumber__value_1arhg_9">5,220.44</span>
        </div>
      </body>
    </html>
  `;
  const record = parseYahooSp500Html(
    html,
    "https://finance.yahoo.co.jp/quote/%5EGSPC",
    "2026-04-13T20:00:00Z",
  );
  assert.equal(record.tradeDate, "2026-04-13");
  assert.equal(record.closeValue, 5220.44);
});

test("parseMufgFxHtml extracts TTS TTB TTM", () => {
  const html = `
    <html>
      <body>
        <h2>As of April 13, 2026</h2>
        <table>
          <tr><td>US Dollar</td><td>USD</td><td>145.88</td><td>143.88</td></tr>
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

test("parseEmaxisFundJson extracts date and NAV", () => {
  const payload = JSON.stringify({
    result: {
      status: 200,
    },
    datasets: {
      cff_fund_cd: "253266",
      cfm_base_date: "20260417",
      cfm_base_price: 41172,
    },
  });
  const record = parseEmaxisFundJson(
    payload,
    "253266",
    "https://www.am.mufg.jp/mukamapi/fund_details/?fund_cd=253266",
    "2026-04-17T00:00:00Z",
  );
  assert.equal(record.businessDate, "2026-04-17");
  assert.equal(record.nav, 41172);
});
