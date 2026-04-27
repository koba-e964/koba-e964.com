# atcoder-rating-estimator publish plan

## Overview

`atcoder-rating-estimator` は build 不要の静的ファイル集合なので、この repo では source や生成物を保持せず、GitHub Pages workflow の中で毎回 upstream repo を shallow clone して `dist-pages/atcoder-rating-estimator/` に取り込む。

公開入口は `/atcoder-rating-estimator/` としたいため、upstream の主ページ `test-last.html` をそのままコピーするだけでなく、同内容を `index.html` としても配置する。

## Files to change

- `.github/workflows/deploy-pages.yml`
  - upstream `atcoder-rating-estimator` を clone し、静的ファイルを artifact としてまとめる job を追加する。
  - `deploy` job で artifact を download し、`dist-pages/atcoder-rating-estimator/` へ配置する処理を追加する。
- `README.md`
  - repo 構成と公開コンテンツ一覧に `atcoder-rating-estimator/` を追加する。
  - GitHub Pages の説明に upstream clone/copy 配信であることを追記する。
- `pages/index.html`
  - トップページのカード一覧に `AtCoder Rating Estimator` を追加する。
- `atcoder-rating-estimator/README.md`
  - source of truth が upstream repo であること、workflow が clone/copy して配信すること、入口を `test-last.html` から `index.html` としても出していることを記述する。

## Detailed implementation steps

1. upstream static files の入口方針を確定する
   - `test-last.html` を主ページとして扱う
   - `atcoder_rating.js`, `test.html`, `test-handle.html`, `test-last.html` を公開配下へコピーする
   - 追加で `test-last.html` を `index.html` として複製し、`/atcoder-rating-estimator/` 直下アクセスを成立させる

2. workflow に upstream artifact job を追加する
   - `build-atcoder-rating-estimator` job を追加する
   - upstream repo を shallow clone する
   - artifact staging directory を作る
   - 必要ファイルを staging directory へコピーする
   - `test-last.html` を `index.html` としてもコピーする
   - staging directory を `upload-artifact` で deploy job に渡す

3. deploy job に組み込みを追加する
   - `deploy` job の `needs` に `build-atcoder-rating-estimator` を追加する
   - `download-artifact` で `atcoder-rating-estimator` の静的ファイルを受け取る
   - `mkdir -p dist-pages/atcoder-rating-estimator` を追加する
   - download したファイルを `dist-pages/atcoder-rating-estimator/` にコピーする

4. documentation を更新する
   - `README.md` に `atcoder-rating-estimator/` の公開を追記する
   - `pages/index.html` にカードを追加する
   - `atcoder-rating-estimator/README.md` を追加する

5. ローカル確認を行う
   - upstream clone から staging directory を組み立てる
   - `index.html` と `test-last.html` が揃うことを確認する
   - `deploy-pages.yml` の assemble 相当をローカルで模擬し、`dist-pages/atcoder-rating-estimator/index.html` ができることを確認する

## Alternatives considered

### Commit static snapshot into this repo

却下理由:

- source of truth を upstream に残す要件に反する
- 更新同期が手動になる
- 小規模 static ファイルでも二重管理になる

### Build-free copy inside deploy job only

却下理由:

- technically 可能だが、既存の `tsumeshogi-web-solver` と同じ「artifact を先に作って deploy job に渡す」形に揃えた方が保守しやすい
- upstream 依存コンテンツごとの責務分離が分かりやすい

## Risks

- deploy 時に upstream clone が必須になるため、ネットワーク障害時に Pages deploy が失敗する
- upstream ファイル構成が変わると workflow の copy 対象を見直す必要がある
- `test-handle.html` の外部依存は古く、移設後も動かない可能性が高い
- `test-last.html` を `index.html` として複製する前提なので、upstream の主ページが変わると入口戦略を再検討する必要がある

## Test strategy

- upstream clone から `index.html`, `test-last.html`, `test.html`, `test-handle.html`, `atcoder_rating.js` が staging されることを確認する
- ローカルで `dist-pages/atcoder-rating-estimator/index.html` を生成できることを確認する
- 必要なら静的サーバで `/atcoder-rating-estimator/` にアクセスし、主ページが開くことを確認する

## Assumptions

- `test-last.html` が実質的な主ページであり、`index.html` として複製しても問題ない
- upstream repo は引き続き GitHub 上で public clone 可能である
- 小規模静的ファイルの artifact job 追加コストは許容範囲である

## Open questions

- トップページ上の表示名を英語の `AtCoder Rating Estimator` にするか、日本語説明を前面に出すか
- `test.html` / `test-handle.html` への補助導線をトップや README に明示するか

## Implementation Checklist

- [x] `build-atcoder-rating-estimator` job を workflow に追加する
- [x] `deploy` job で `atcoder-rating-estimator` artifact を取り込む
- [x] `README.md` を更新して新しい公開コンテンツを記載する
- [x] `pages/index.html` に `atcoder-rating-estimator` のカードを追加する
- [x] `atcoder-rating-estimator/README.md` を追加する
- [x] ローカルで Pages assemble 相当の確認を行う
