# ファンド価格予測くん

GitHub Pages に置く静的フロントと、AWS Lambda + Neon で履歴収集と予測計算を行うための骨格です。

## 公開パス

- `/fund-price-forecast/`

その配下の URL はファンド非依存です。初期ファンドは `?fund=253266` 相当の設定で表示します。

## フロント

- [site/index.html](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/site/index.html)
- [site/app.js](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/site/app.js)
- [site/styles.css](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/site/styles.css)
- [site/mock/latest.json](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/site/mock/latest.json)

デフォルトでは `mock/latest.json` を fallback として読むため、API 未接続でも画面確認ができます。

実 API を使うときは `fund-price-forecast/site/local-config.js` を作成し、`window.APP_CONFIG.apiBaseUrl` を設定してください。

```js
window.APP_CONFIG = {
  apiBaseUrl: "https://your-api-id.execute-api.ap-northeast-1.amazonaws.com",
};
```

GitHub Pages 本番では `local-config.js` を commit せず、Actions workflow が `vars.PAGES_API_BASE_URL` から生成します。

- GitHub repository settings
- `Settings -> Secrets and variables -> Actions -> Variables`
- `Repository variables` を使う
- `PAGES_API_BASE_URL`
  - 値: 公開用 API の base URL (`https://XXXXXX.execute-api.ap-northeast-1.amazonaws.com`)

この variable が未設定なら、Pages はダミー URL を埋め込み、画面は `mock/latest.json` に fallback します。

### ローカルで画面を見る

開発中の価格ページをそのまま見るなら、repo root で `python3 -m http.server 8000` を起動して次を開きます。

- `http://localhost:8000/fund-price-forecast/site/`

本番と同じ URL 構成で見たいときは、Pages artifact を組み立ててから `dist-pages/` を配信します。

```sh
cd /Users/kobas-mac/srcview/koba-e964.com
rm -rf dist-pages
mkdir -p dist-pages/fund-price-forecast
cp -R pages/. dist-pages/
cp -R fund-price-forecast/site/. dist-pages/fund-price-forecast/
cd dist-pages
python3 -m http.server 8000
```

このときの確認先は次です。

- `http://localhost:8000/fund-price-forecast/`
  - 本番の `https://koba-e964.com/fund-price-forecast/` 相当

## バックエンド

### 目的

- S&P 500 ソース値の取得
- MUFG TTM の取得
- 公式基準価額の取得
- Neon への履歴保存
- `v1` 予測値の算出
- フロント向け read-only API の返却

### 主要ファイル

- [backend/src/schema.sql](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/backend/src/schema.sql)
- [backend/src/domain/predict.ts](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/backend/src/domain/predict.ts)
- [backend/src/handlers/ingestMarketData.ts](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/backend/src/handlers/ingestMarketData.ts)
- [backend/src/handlers/ingestFundNav.ts](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/backend/src/handlers/ingestFundNav.ts)
- [backend/src/handlers/recomputePredictions.ts](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/backend/src/handlers/recomputePredictions.ts)
- [backend/src/handlers/readPublicData.ts](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/backend/src/handlers/readPublicData.ts)

### 予測モデル

初版は次の近似式です。

```txt
predicted_nav = base_nav * index_ratio * fx_ratio * fee_factor
```

- `base_nav`: 直近の公式基準価額
- `index_ratio`: S&P 500 の基準日比
- `fx_ratio`: TTM の基準日比
- `fee_factor`: 長期予測時のみ信託報酬を日割り近似した係数

`eMAXIS Slim 米国株式（S&P500）` は「配当込み、円換算ベース」なので、この `v1` は近似モデルです。

### データ源メモ

- FX は MUFG 本体ページではなく、同じ公表値を載せる MURC の `https://www.murc-kawasesouba.jp/fx/index.php` をデフォルト取得先にしています。
- 公式基準価額は HTML ではなく、MUFG AM の JSON endpoint `https://www.am.mufg.jp/mukamapi/fund_details/?fund_cd=253266` をデフォルト取得先にしています。
- API は `fund_nav_daily` / `fund_predictions_daily` / `market_index_daily` / `fx_daily` が揃うまで `503 data_not_ready` を返します。

## Infrastructure as Code

AWS は CDK、Neon は公式 API を叩く bootstrap スクリプトで寄せています。

### 主要ファイル

- [infra/lib/fund-price-forecast-stack.ts](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/infra/lib/fund-price-forecast-stack.ts)
- [infra/scripts/bootstrap-neon.mjs](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/infra/scripts/bootstrap-neon.mjs)
- [infra/scripts/apply-schema.mjs](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/infra/scripts/apply-schema.mjs)

### 手順

1. `cd fund-price-forecast/infra && npm install`
2. `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_ROLE_PASSWORD` を `fund-price-forecast/infra/.env` に入れる
3. `.env` を読み込んで `npm run bootstrap-neon` を実行する

```sh
cd /Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/infra
set -a; source .env; set +a; npm run bootstrap-neon
```

4. 返ってきた接続 URI を AWS Secrets Manager の `fund-price-forecast/prod/database-url` に保存
5. `DATABASE_URL=... npm run apply-schema`
6. `npx cdk bootstrap && npx cdk deploy`
7. CDK output の `PublicApiUrl` を `fund-price-forecast/site/local-config.js` に入れる

### AWS Secrets Manager

- Secret name: `fund-price-forecast/prod/database-url`
- Secret type: `Other type of secret`
- Secret value は次のどちらでもよい
  - plaintext の `postgresql://...`
  - JSON の `{ "databaseUrl": "postgresql://..." }`

一番迷わないのは `Other type of secret` を選んで plaintext で `databaseUrl` をそのまま保存するやり方です。

## テスト

`fund-price-forecast/backend/` で次を実行します。

```sh
npm install
npm run check
npm test
```

## ローカルで parser を試す

deploy 前に source parser だけ手元で確認したいときは、`fund-price-forecast/backend/` で次を実行します。

```sh
npm run source:check -- fund
npm run source:check -- fx
npm run source:check -- sp500
```

必要なら URL を上書きできます。

```sh
FUND_SOURCE_URL='https://www.am.mufg.jp/mukamapi/fund_details/?fund_cd=253266' npm run source:check -- fund
MUFG_FX_SOURCE_URL='https://www.murc-kawasesouba.jp/fx/index.php' npm run source:check -- fx
SP500_SOURCE_URL='https://finance.yahoo.co.jp/quote/%5EGSPC' npm run source:check -- sp500
```

`fund` は `FUND_CODE` も上書きできます。
