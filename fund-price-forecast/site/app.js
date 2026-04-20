const DEFAULT_API_BASE_URL = "https://example.execute-api.ap-northeast-1.amazonaws.com/prod";
const DEFAULT_FUND_CODE = "253266";
const FALLBACK_PATH = "./mock/latest.json";

class DataNotReadyError extends Error {
  constructor(fundCode) {
    super(`fund ${fundCode} is not ready yet`);
    this.name = "DataNotReadyError";
    this.fundCode = fundCode;
  }
}

async function loadData() {
  const params = new URLSearchParams(window.location.search);
  const fundCode = params.get("fund") || DEFAULT_FUND_CODE;
  const apiBaseUrl = window.APP_CONFIG?.apiBaseUrl || DEFAULT_API_BASE_URL;
  const apiUrl = `${apiBaseUrl}/api/funds/${encodeURIComponent(fundCode)}/latest`;

  try {
    const response = await fetch(apiUrl, { headers: { accept: "application/json" } });
    if (!response.ok) {
      let errorPayload = null;
      try {
        errorPayload = await response.json();
      } catch {
        // Ignore JSON parse failure and fall through to generic handling.
      }

      if (response.status === 503 && errorPayload?.error === "data_not_ready") {
        throw new DataNotReadyError(errorPayload.fundCode || fundCode);
      }

      throw new Error(`API request failed with ${response.status}`);
    }
    const payload = await response.json();
    return { payload, sourceLabel: "live-api" };
  } catch (error) {
    if (error instanceof DataNotReadyError) {
      throw error;
    }

    const fallbackResponse = await fetch(FALLBACK_PATH);
    if (!fallbackResponse.ok) {
      throw error;
    }
    const payload = await fallbackResponse.json();
    return { payload, sourceLabel: "mock-data" };
  }
}

function formatCurrency(value, currency) {
  if (typeof value !== "number") {
    return "未取得";
  }
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value);
}

function formatNumber(value, digits = 2) {
  if (typeof value !== "number") {
    return "未取得";
  }
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDateTime(value) {
  if (!value) {
    return "時刻未取得";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function renderApp(payload, sourceLabel) {
  const app = document.querySelector("#app");
  const template = document.querySelector("#app-template");
  const fragment = template.content.cloneNode(true);

  const { fund, latestOfficialNav, latestPrediction, latestSources, history, assumptions } = payload;
  const statusMap = {
    official: "公式値",
    estimated_complete_inputs: "両入力確定",
    estimated_missing_index: "S&P 500 待ち",
    estimated_missing_fx: "TTM 待ち",
    estimated_long_horizon: "長期推定",
  };

  setField(fragment, "fund-name", fund.displayName);
  setField(
    fragment,
    "fund-meta",
    `${fund.providerName} / fund code ${fund.code} / source: ${sourceLabel}`
  );
  setField(fragment, "prediction-status", statusMap[latestPrediction.status] || latestPrediction.status);
  setField(fragment, "official-nav", formatCurrency(latestOfficialNav.nav, "JPY"));
  setField(
    fragment,
    "official-date",
    `${latestOfficialNav.businessDate} 公表 / 取得 ${formatDateTime(latestOfficialNav.fetchedAt)}`
  );
  setField(fragment, "predicted-nav", formatCurrency(latestPrediction.predictedNav, "JPY"));
  setField(
    fragment,
    "prediction-note",
    `${latestPrediction.businessDate} 向け / ${latestPrediction.confidenceNote}`
  );
  setField(fragment, "sp500-value", formatNumber(latestSources.sp500.closeValue, 2));
  setField(
    fragment,
    "sp500-meta",
    `${latestSources.sp500.tradeDate} / ${latestSources.sp500.sourceName} / 取得 ${formatDateTime(latestSources.sp500.fetchedAt)}`
  );
  setField(fragment, "ttm-value", formatNumber(latestSources.ttm.ttm, 3));
  setField(
    fragment,
    "ttm-meta",
    `${latestSources.ttm.businessDate} / TTS ${formatNumber(latestSources.ttm.tts, 3)} / TTB ${formatNumber(latestSources.ttm.ttb, 3)}`
  );
  setField(fragment, "fee-value", `${(fund.annualFeeRate * 100).toFixed(3)}%`);

  const historyBody = fragment.querySelector('[data-field="history-body"]');
  history.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.businessDate}</td>
      <td>${row.kind}</td>
      <td>${formatCurrency(row.value, "JPY")}</td>
      <td>${row.note}</td>
    `;
    historyBody.appendChild(tr);
  });

  const assumptionsList = fragment.querySelector('[data-field="assumptions"]');
  assumptions.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    assumptionsList.appendChild(li);
  });

  app.replaceChildren(fragment);
}

function setField(root, field, value) {
  const node = root.querySelector(`[data-field="${field}"]`);
  if (node) {
    node.textContent = value;
  }
}

function renderError(error) {
  const app = document.querySelector("#app");
  const section = document.createElement("section");
  section.className = "panel error-panel";
  if (error instanceof DataNotReadyError) {
    section.innerHTML = `
      <h2>まだ価格データを表示できません</h2>
      <p class="muted">このファンドはまだ ingest されていません。</p>
      <p class="muted">market data / fund NAV / prediction の投入が終わると本番データが表示されます。</p>
      <p class="muted">fund code: ${error.fundCode}</p>
    `;
  } else {
    section.innerHTML = `
      <h2>データを表示できませんでした</h2>
      <p class="muted">バックエンド URL か静的 fallback データを確認してください。</p>
      <p class="muted">${error.message}</p>
    `;
  }
  app.replaceChildren(section);
}

loadData()
  .then(({ payload, sourceLabel }) => renderApp(payload, sourceLabel))
  .catch((error) => renderError(error));
