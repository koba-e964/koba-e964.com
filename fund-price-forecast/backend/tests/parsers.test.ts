import test from "node:test";
import assert from "node:assert/strict";

import { parseEmaxisFundJson } from "../src/sources/emaxis.js";
import { parseGoogleSp500TrHtml } from "../src/sources/google.js";
import { parseMufgFxHtml } from "../src/sources/mufg.js";

test("parseGoogleSp500TrHtml extracts trade date and price", () => {
  const html = `
    <html>
      <body>
        <script>
          AF_initDataCallback({
            key: 'ds:1',
            data: [[[["/g/test",["SP500TR","INDEXSP"],"S\\u0026P 500 (TR)",1,null,[15931.22,-78.27051,-0.4889007,2,2,2],null,16009.49,null,null,null,[1777408688],"America/New_York",-14400]]]]
          });
        </script>
      </body>
    </html>
  `;
  const record = parseGoogleSp500TrHtml(
    html,
    "https://www.google.com/finance/quote/SP500TR:INDEXSP?hl=en",
    "2026-04-29T22:00:00Z",
  );
  assert.equal(record.tradeDate, "2026-04-29");
  assert.equal(record.closeValue, 15931.22);
});

test("parseGoogleSp500TrHtml uses previous close during market hours", () => {
  const html = `
    <html>
      <body>
        <script>
          AF_initDataCallback({
            key: 'ds:1',
            data: [[[["/g/test",["SP500TR","INDEXSP"],"S\\u0026P 500 (TR)",1,null,[15931.22,-78.27051,-0.4889007,2,2,2],null,16009.49,null,null,null,[1777408688],"America/New_York",-14400]]]]
          });
        </script>
      </body>
    </html>
  `;
  const record = parseGoogleSp500TrHtml(
    html,
    "https://www.google.com/finance/quote/SP500TR:INDEXSP?hl=en",
    "2026-04-29T13:00:00Z",
  );
  assert.equal(record.tradeDate, "2026-04-28");
  assert.equal(record.closeValue, 16009.49);
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
