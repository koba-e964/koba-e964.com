# ファンド価格予測くん

GitHub Pages に置く静的フロントと、AWS Lambda + Neon で履歴収集と予測計算を行うための骨格をこのリポジトリにまとめています。

## 構成

- `site/`
  - Pages にそのまま配信する静的フロント
- `backend/`
  - Lambda 向け TypeScript、Neon 用 SQL、予測ロジック、テスト
- `infra/`
  - AWS CDK と Neon bootstrap 用スクリプト
- `codex-notes/`
  - 調査メモと計画。`_config.yml` で Jekyll 除外済み

## 公開サイト

- ルート URL はファンド非依存です。初期ファンドは `?fund=253266` 相当の設定で表示します。
- デフォルトでは `site/mock/latest.json` を fallback として読むため、API 未接続でも画面確認ができます。
- 実 API を使うときは `site/local-config.js` を作成し、`window.APP_CONFIG.apiBaseUrl` を設定してください。

例:

```js
window.APP_CONFIG = {
  apiBaseUrl: "https://your-api-id.execute-api.ap-northeast-1.amazonaws.com/prod",
};
```

`site/local-config.js` は `.gitignore` 済みです。

## GitHub Pages

- `site/` だけを workflow で artifact 化して Pages に配信します。
- `site/.nojekyll` を置いて Jekyll 変換をバイパスします。
- さらに repo ルートの `_config.yml` で `backend/` と `codex-notes/` を除外しています。

必要な GitHub 設定:

1. Repository settings で Pages の source を `GitHub Actions` にする
2. `main` へ push すると `.github/workflows/deploy-pages.yml` で `site/` が公開される

## Backend

### 目的

- S&P 500 ソース値の取得
- MUFG TTM の取得
- 公式基準価額の取得
- Neon への履歴保存
- `v1` 予測値の算出
- フロント向け read-only API の返却

### 主要ファイル

- [backend/src/schema.sql](/Users/kobas-mac/srcview/koba-e964.com/backend/src/schema.sql)
- [backend/src/domain/predict.ts](/Users/kobas-mac/srcview/koba-e964.com/backend/src/domain/predict.ts)
- [backend/src/handlers/ingestMarketData.ts](/Users/kobas-mac/srcview/koba-e964.com/backend/src/handlers/ingestMarketData.ts)
- [backend/src/handlers/ingestFundNav.ts](/Users/kobas-mac/srcview/koba-e964.com/backend/src/handlers/ingestFundNav.ts)
- [backend/src/handlers/recomputePredictions.ts](/Users/kobas-mac/srcview/koba-e964.com/backend/src/handlers/recomputePredictions.ts)
- [backend/src/handlers/readPublicData.ts](/Users/kobas-mac/srcview/koba-e964.com/backend/src/handlers/readPublicData.ts)

### セットアップ

1. `backend/.env.example` を元に環境変数を用意する
2. Neon で `backend/src/schema.sql` を適用する
3. `backend/` で依存をインストールする
4. 各 handler を Lambda にデプロイする
5. EventBridge Scheduler で定期実行する

推奨スケジュール例:

- 朝 JST: `ingestFundNav`
- 朝 JST: `ingestMarketData`
- その直後: `recomputePredictions`
- 米国市場クローズ反映後 JST: `ingestMarketData`
- その直後: `recomputePredictions`

### 予測モデル

初版は次の近似式です。

```txt
predicted_nav = base_nav * index_ratio * fx_ratio * fee_factor
```

- `base_nav`: 直近の公式基準価額
- `index_ratio`: S&P 500 の基準日比
- `fx_ratio`: TTM の基準日比
- `fee_factor`: 長期予測時のみ信託報酬を日割り近似した係数

注意:

- `eMAXIS Slim 米国株式（S&P500）` は「配当込み、円換算ベース」なので、この `v1` は近似モデルです。
- 厳密な再現には配当込み指数とのズレ、休日の持ち越し、公開タイミング差の補正が必要です。

## Infrastructure as Code

AWS は CDK、Neon は公式 API を叩く bootstrap スクリプトで寄せています。

### 主要ファイル

- [infra/lib/fund-price-forecast-stack.ts](/Users/kobas-mac/srcview/koba-e964.com/infra/lib/fund-price-forecast-stack.ts)
- [infra/scripts/bootstrap-neon.mjs](/Users/kobas-mac/srcview/koba-e964.com/infra/scripts/bootstrap-neon.mjs)
- [infra/scripts/apply-schema.mjs](/Users/kobas-mac/srcview/koba-e964.com/infra/scripts/apply-schema.mjs)

### 事前に必要なもの

- AWS 認証情報
- Neon API key
- Neon project id
- npm

### 1. Neon bootstrap

`infra/` で依存導入後、次を実行します。

```sh
npm install
NEON_API_KEY=...
NEON_PROJECT_ID=...
NEON_ROLE_PASSWORD=...
npm run bootstrap-neon
```

このスクリプトは次を idempotent に実行します。

- branch の解決または作成
- database の作成
- role の作成
- 接続 URI の取得

返ってきた `databaseUrl` を次の段階で使います。

### 2. AWS Secrets Manager

Neon の接続 URI は Lambda 環境変数へ直接入れず、Secrets Manager に保存します。想定 secret id は次です。

```txt
fund-price-forecast/prod/database-url
```

secret value は次のどちらでも構いません。

```txt
postgresql://...
```

または

```json
{"databaseUrl":"postgresql://..."}
```

### 3. スキーマ適用

```sh
cd infra
DATABASE_URL=postgresql://...
npm run apply-schema
```

### 4. AWS CDK deploy

```sh
cd infra
npm install
npx cdk bootstrap
npx cdk deploy \
  -c databaseSecretId=fund-price-forecast/prod/database-url \
  -c fundCode=253266
```

この stack は次を作成します。

- Lambda 4 本
- HTTP API 1 本
- EventBridge Scheduler 5 本
- Scheduler 用 IAM role

### 5. フロントの API 接続

CDK output の `PublicApiUrl` を `site/local-config.js` に入れます。

```js
window.APP_CONFIG = {
  apiBaseUrl: "https://xxxx.execute-api.ap-northeast-1.amazonaws.com",
};
```

### 6. まだ残る手作業

- 実 HTML に合わせた parser の微調整
- Lambda デプロイ後の疎通確認
- スケジュール時刻の微調整
- `v1` モデルの誤差検証
- Pages 側へ本番 API URL を反映

## テスト

まだ依存を入れていない前提なので、このリポジトリ内では自動実行していません。依存導入後は `backend/` で以下を実行してください。

```sh
npm install
npm run check
npm test
```

## 今後の優先順位

1. 実データでパーサを合わせ込む
2. 公式 NAV 履歴で `v1` の追従誤差を測る
3. 必要なら `v2` で配当込み指数や休日処理を改善する
4. 複数ファンド対応の UI を追加する
