const DEFAULT_API_BASE_URL = "https://example.execute-api.ap-northeast-1.amazonaws.com/prod";
const DEFAULT_FUND_CODE = "253266";
const DEFAULT_FALLBACK_PATH = "./mock/latest.json";
const DISPLAY_TIME_ZONE = "Asia/Tokyo";
const DISPLAY_TIME_ZONE_LABEL = "JST";

function getPageConfig() {
  const root = document.documentElement.dataset;
  return {
    fundCode: root.fundCode || DEFAULT_FUND_CODE,
    fallbackPath: root.fallbackPath || DEFAULT_FALLBACK_PATH,
    officialSourceUrl: root.officialSourceUrl || "",
  };
}

class DataNotReadyError extends Error {
  constructor(fundCode) {
    super(`fund ${fundCode} is not ready yet`);
    this.name = "DataNotReadyError";
    this.fundCode = fundCode;
  }
}

async function loadData() {
  const { fundCode, fallbackPath } = getPageConfig();
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

    const fallbackResponse = await fetch(fallbackPath);
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

function formatHistoryValue(value, valueCurrency) {
  if (typeof value !== "number") {
    return "未取得";
  }

  switch (valueCurrency) {
    case "USD":
      return formatCurrency(value, "USD");
    case "FX":
      return formatNumber(value, 3);
    case "JPY":
    default:
      return formatCurrency(value, "JPY");
  }
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

function formatPythonNumber(value, digits) {
  if (typeof value !== "number") {
    return "None";
  }
  return value.toFixed(digits);
}

function formatPredictionFormula(latestOfficialNav, latestPrediction) {
  if (!isPredictionReady(latestPrediction.status)) {
    return "未定";
  }
  const formula = latestPrediction?.formula;
  if (!formula) {
    return "式を表示できません";
  }

  const baseNav = formatPythonNumber(formula.baseNav, 0);
  const indexPart =
    typeof formula.baseIndexValue === "number" &&
    typeof formula.targetIndexValue === "number"
      ? `(${formatPythonNumber(formula.targetIndexValue, 2)} / ${formatPythonNumber(formula.baseIndexValue, 2)})`
      : "1";
  const fxPart =
    typeof formula.baseTtm === "number" && typeof formula.targetTtm === "number"
      ? `(${formatPythonNumber(formula.targetTtm, 3)} / ${formatPythonNumber(formula.baseTtm, 3)})`
      : "1";

  const parts = [baseNav, indexPart, fxPart];
  if (
    typeof formula.feeAdjustmentFactor === "number" &&
    Math.abs(formula.feeAdjustmentFactor - 1) > 1e-9
  ) {
    parts.push(formatPythonNumber(formula.feeAdjustmentFactor, 9));
  }

  return parts.join(" * ");
}

function formatPredictionFormulaFromFormula(formula) {
  if (!formula || typeof formula.baseNav !== "number") {
    return "式を表示できません";
  }

  const baseNav = formatPythonNumber(formula.baseNav, 0);
  const indexPart =
    typeof formula.baseIndexValue === "number" &&
    typeof formula.targetIndexValue === "number"
      ? `(${formatPythonNumber(formula.targetIndexValue, 2)} / ${formatPythonNumber(formula.baseIndexValue, 2)})`
      : "1";
  const fxPart =
    typeof formula.baseTtm === "number" && typeof formula.targetTtm === "number"
      ? `(${formatPythonNumber(formula.targetTtm, 3)} / ${formatPythonNumber(formula.baseTtm, 3)})`
      : "1";

  const parts = [baseNav, indexPart, fxPart];
  if (
    typeof formula.feeAdjustmentFactor === "number" &&
    Math.abs(formula.feeAdjustmentFactor - 1) > 1e-9
  ) {
    parts.push(formatPythonNumber(formula.feeAdjustmentFactor, 9));
  }

  return parts.join(" * ");
}

function isPredictionReady(status) {
  return status === "estimated_complete_inputs" || status === "estimated_long_horizon";
}

function formatDateTime(value) {
  if (!value) {
    return "時刻未取得";
  }
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(value));
  return `${formatted} ${DISPLAY_TIME_ZONE_LABEL}`;
}

function formatDateOnly(value) {
  if (!value) {
    return "日付未取得";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(value));
}

function formatHistoryNote(row) {
  if (
    row.kind === "estimated_complete_inputs" ||
    row.kind === "estimated_missing_index" ||
    row.kind === "estimated_missing_fx" ||
    row.kind === "estimated_long_horizon"
  ) {
    const noteParts = [];
    if (typeof row.indexValue === "number" && row.indexDate) {
      noteParts.push(
        `S&P 500 反映済み (${formatNumber(row.indexValue, 2)}, ${row.indexEventAt ? formatDateTime(row.indexEventAt) : formatDateOnly(row.indexDate)})`
      );
    } else {
      noteParts.push("S&P 500 は未定");
    }
    if (typeof row.fxValue === "number" && row.fxDate) {
      noteParts.push(
        `TTM 反映済み (${formatNumber(row.fxValue, 3)}, ${row.fxEventAt ? formatDateTime(row.fxEventAt) : formatDateOnly(row.fxDate)})`
      );
    } else {
      noteParts.push("TTM は未定");
    }
    if (row.kind === "estimated_long_horizon") {
      noteParts.push("長期補正あり");
    }
    if (row.formula && isPredictionReady(row.kind)) {
      noteParts.push(`式: ${formatPredictionFormulaFromFormula(row.formula)}`);
    }
    return noteParts.join(" / ");
  }

  return row.note;
}

function renderApp(payload, sourceLabel) {
  const { officialSourceUrl } = getPageConfig();
  const app = document.querySelector("#app");
  const template = document.querySelector("#app-template");
  const fragment = template.content.cloneNode(true);

  const { fund, latestOfficialNav, latestPrediction, latestSources, history, assumptions } = payload;
  const statusMap = {
    official: "公式値",
    estimated_complete_inputs: "推定値",
    estimated_missing_index: "未定",
    estimated_missing_fx: "未定",
    estimated_long_horizon: "長期推定",
    market_index: "S&P 500",
    fx_ttm: "為替TTM",
  };

  setField(fragment, "fund-name", fund.displayName);
  setField(
    fragment,
    "fund-meta",
    `${fund.providerName} / fund code ${fund.code} / source: ${sourceLabel}`
  );
  setField(fragment, "timezone-meta", `表示タイムゾーン: ${DISPLAY_TIME_ZONE_LABEL} (${DISPLAY_TIME_ZONE})`);
  setLink(fragment, "official-source-link", officialSourceUrl);
  setField(fragment, "prediction-status", statusMap[latestPrediction.status] || latestPrediction.status);
  setField(fragment, "official-nav", formatCurrency(latestOfficialNav.nav, "JPY"));
  setField(
    fragment,
    "official-date",
    `${formatDateOnly(latestOfficialNav.businessDate)} 公表 / 取得 ${formatDateTime(latestOfficialNav.fetchedAt)}`
  );
  setField(
    fragment,
    "predicted-nav",
    isPredictionReady(latestPrediction.status)
      ? formatCurrency(latestPrediction.predictedNav, "JPY")
      : "未定"
  );
  setField(
    fragment,
    "prediction-note",
    `${formatDateOnly(latestPrediction.businessDate)} 向け / ${latestPrediction.confidenceNote}`
  );
  setField(
    fragment,
    "prediction-formula",
    formatPredictionFormula(latestOfficialNav, latestPrediction)
  );
  setField(fragment, "sp500-value", formatNumber(latestSources.sp500.closeValue, 2));
  setField(
    fragment,
    "sp500-meta",
    `${formatDateOnly(latestSources.sp500.tradeDate)} / ${latestSources.sp500.sourceName} / 取得 ${formatDateTime(latestSources.sp500.fetchedAt)}`
  );
  setField(fragment, "ttm-value", formatNumber(latestSources.ttm.ttm, 3));
  setField(
    fragment,
    "ttm-meta",
    `${formatDateOnly(latestSources.ttm.businessDate)} / TTS ${formatNumber(latestSources.ttm.tts, 3)} / TTB ${formatNumber(latestSources.ttm.ttb, 3)}`
  );
  setField(fragment, "fee-value", `${(fund.annualFeeRate * 100).toFixed(3)}%`);

  const historyBody = fragment.querySelector('[data-field="history-body"]');
  history.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateTime(row.eventAt)}</td>
      <td>${statusMap[row.kind] || row.kind}</td>
      <td>${isPredictionReady(row.kind) || !String(row.kind).startsWith("estimated_") ? formatHistoryValue(row.value, row.valueCurrency) : "未定"}</td>
      <td>${formatHistoryNote(row)}</td>
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

function setLink(root, field, href) {
  const node = root.querySelector(`[data-field="${field}"]`);
  if (node && href) {
    node.href = href;
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
