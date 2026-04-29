# Prediction Error Investigation Plan

## Overview

現状のズレは、日付の取り方よりも「S&P 500 の価格指数 close をそのまま使っている」ことによるモデル不一致が主因と考える。

修正方針は次の 2 段階に分ける。

1. `latest TTM date` を基準にした日付選択を維持する
2. `^GSPC` の price index close ではなく、ファンド実態により近い配当込み系の指数ソースへ置換または追加し、新しい `method_version` で再計算する

破壊的に既存 `v1-index-fx-fee` を上書きするのではなく、`method_version` を上げて比較可能性を残すのが基本方針。

## Files to change

- `fund-price-forecast/backend/src/sources/yahoo.ts`
- `fund-price-forecast/backend/src/domain/predict.ts`
- `fund-price-forecast/backend/src/jobs.ts`
- `fund-price-forecast/backend/src/db.ts`
- `fund-price-forecast/backend/src/types.ts`
- `fund-price-forecast/backend/src/schema.sql`
- `fund-price-forecast/backend/tests/parsers.test.ts`
- `fund-price-forecast/backend/tests/predict.test.ts`
- `fund-price-forecast/backend/tests/jobs.test.ts`
- `fund-price-forecast/site/app.js`
- `fund-price-forecast/site/mock/latest.json`
- `fund-price-forecast/README.md`

必要なら追加:

- `fund-price-forecast/backend/src/sources/<new-source>.ts`
- `fund-price-forecast/backend/scripts/recompute-all.ts`

## Detailed implementation steps

### 1. 指数ソース戦略を決める

候補は 2 つ。

- `A`: 既存 `market_index_daily` に、配当込み寄りの別 symbol/source を保存する
- `B`: 既存 schema はそのままにして、`^GSPC` の代わりに upstream source 自体を差し替える

推奨は `A`。理由:

- `price index` と `total-return-ish` の比較が残る
- 既存履歴を壊さない
- source 切替失敗時の rollback が簡単

### 2. prediction method_version を上げる

`predict.ts` の `METHOD_VERSION` を新値にする。

例:

- `v2-index-tr-fx-fee`

この version ごとに prediction を保存し、read path では最新 version を優先する。

### 3. DB read path を method_version aware にする

`db.ts` の `latestPrediction` / `historyRows` / dedupe ロジックは、単純に「最新 business_date」だけではなく、

- 優先 method_version
- 同日複数 version があれば新 version を優先

という扱いにする。

必要なら:

- version ordering をコード側で固定
- もしくは `fund_predictions_daily` に `method_rank` 相当の扱いを追加

今回は schema 追加を避け、コード側の優先順で処理する。

### 4. historical recompute を新 method_version で再実行する

`runRecomputeAllPredictions()` はすでに全件再計算できるので、新 source と新 method_version で全件再計算する。

手順:

- 新 source で `market_index_daily` を埋める
- `recompute:all` を実行
- `payload:check` と UI で差分確認

### 5. UI に method 差が見える余地を残す

最低限、`assumptions` か `prediction-note` で

- 現在の推定がどの近似に基づくか

が分かるようにする。

必要なら将来:

- `v1` / `v2` 切替表示
- 誤差比較表示

も可能にする。

## Alternatives considered

### Alternative 1: 現行 `^GSPC` のまま係数補正を掛ける

却下理由:

- 係数が経験則になり、説明性が悪い
- 市場 regime が変わると破綻しやすい
- 根本原因である source mismatch を隠すだけ

### Alternative 2: `v1` をそのまま上書き修正する

却下理由:

- 過去履歴の意味が変わる
- 比較・rollback がしにくい
- 調査中に regress したとき影響範囲が広い

### Alternative 3: 先に UI だけで「誤差がある」と注記して逃げる

却下理由:

- ユーザー要求は「誤りを直す」であって説明追加ではない
- 本質は backend model の改善

## Risks

- 適切な配当込み系 source が安定取得できない可能性
- source の date semantics が `trade_date` とずれる可能性
- `method_version` 混在で latest/history の read logic が複雑になる
- 過去データ再計算後に履歴の見え方が大きく変わる

## Test strategy

- source parser unit test を追加
- `predict.ts` の期待値 test を新 source 前提で更新
- `jobs.ts` の target date と source selection test を追加
- `payload:check` で live DB を確認
- 再計算前後で、公式 NAV と prediction の差が縮むか spot check する

## Assumptions

- ユーザーは既存 history を「新 version で再計算して見直す」ことを許容する
- 新指数 source は現実的な頻度・安定性で取得可能
- 既存 schema に大きな migration は入れずに進めたい

## Open questions

- 採用する配当込み系 source は何か
- `v1` と `v2` を UI で見分けられるようにするか
- 過去 prediction の `v1` は残すだけでよいか、表示から外すか

## Implementation Checklist

- [ ] 新しい指数 source 候補を決め、取得方式を `backend/src/sources` に実装する
- [ ] `predict.ts` の `method_version` を新値に上げる
- [ ] `jobs.ts` で新 source を prediction input に流す
- [ ] `db.ts` で latest/history が新 version を優先するよう更新する
- [ ] parser / prediction / jobs のテストを更新する
- [ ] `payload:check` で live payload を確認する
- [ ] AWS に deploy する
- [ ] 本番 DB に対して `recompute:all` を実行する
- [ ] UI と API で prediction と official のズレを spot check する
