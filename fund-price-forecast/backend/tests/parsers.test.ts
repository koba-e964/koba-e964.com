import test from "node:test";
import assert from "node:assert/strict";

import { parseEmaxisFundJson } from "../src/sources/emaxis.js";
import { parseYahooSp500ChartJson } from "../src/sources/yahoo.js";
import { parseMufgFxHtml } from "../src/sources/mufg.js";

test("parseYahooSp500ChartJson extracts the latest completed close", () => {
  const payload = JSON.stringify({
    chart: {
      result: [
        {
          timestamp: [1777516800, 1777603200],
          indicators: {
            quote: [
              {
                close: [7135.95, 7209.01],
              },
            ],
          },
        },
      ],
      error: null,
    },
  });
  const record = parseYahooSp500ChartJson(
    payload,
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=10d",
    "2026-05-01T04:34:23Z",
  );
  assert.equal(record.tradeDate, "2026-04-30");
  assert.equal(record.closeValue, 7209.01);
});

test("parseYahooSp500ChartJson ignores the same-day partial candle before close", () => {
  const payload = JSON.stringify({
    chart: {
      result: [
        {
          timestamp: [1777603200, 1777689600],
          indicators: {
            quote: [
              {
                close: [7209.01, 7198.5],
              },
            ],
          },
        },
      ],
      error: null,
    },
  });
  const record = parseYahooSp500ChartJson(
    payload,
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=10d",
    "2026-05-01T15:00:00Z",
  );
  assert.equal(record.tradeDate, "2026-04-30");
  assert.equal(record.closeValue, 7209.01);
});

test("parseMufgFxHtml extracts TTS TTB TTM", () => {
  const html = `
    <html>
      <body>
        <h2>As of April 13, 2026</h2>
        <table>
          <tr><td>US Dollar</td><td>米ドル</td><td>USD</td><td class="t_right">145.88</td><td class="t_right">143.88</td></tr>
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

test("parseMufgFxHtml rejects unpublished rows", () => {
  const html = `
    <html>
      <body>
        <h2>As of April 30, 2026</h2>
        <table>
          <tr><td>US Dollar</td><td>米ドル</td><td>USD</td><td class="t_right">-</td><td class="t_right">-</td></tr>
        </table>
      </body>
    </html>
  `;
  assert.throws(
    () =>
      parseMufgFxHtml(
        html,
        "https://www.murc-kawasesouba.jp/fx/index.php",
        "2026-04-30T00:00:00Z",
      ),
    /MUFG FX quote not published yet/,
  );
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
