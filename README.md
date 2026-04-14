# ファンド価格予測くん

GitHub Pages に置く静的フロントと、AWS Lambda + Neon で履歴収集と予測計算を行うための骨格をこのリポジトリにまとめています。

## 構成

- `site/`
  - Pages にそのまま配信する静的フロント
- `backend/`
  - Lambda 向け TypeScript、Neon 用 SQL、予測ロジック、テスト
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
