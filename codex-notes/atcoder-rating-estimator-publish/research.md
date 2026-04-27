# atcoder-rating-estimator publish research

## Goal

`https://koba-e964.github.io/atcoder-rating-estimator` の内容を、このリポジトリの GitHub Pages 配下 `atcoder-rating-estimator/` として配信できるようにする。

## Relevant files and modules

### This repository

- `README.md`
  - repo 全体の公開物一覧と配信方針を記述している。
- `pages/index.html`
  - ルートトップページ。公開コンテンツへのカード一覧を持つ。
- `.github/workflows/deploy-pages.yml`
  - 現在の Pages deploy workflow。
  - `pages/.` と `fund-price-forecast/site/.` を assemble し、`tsumeshogi-web-solver` は upstream repo を clone/build した成果物を download artifact 経由で組み込む。
- `tsumeshogi-web-solver/README.md`
  - upstream repo を workflow 内で clone / build して配信する既存パターンの説明例。

### `atcoder-rating-estimator` repository

- `atcoder_rating.js`
  - レーティング計算ロジック本体。
- `test-last.html`
  - 現在のレート、参加回数、目標レーティングから必要パフォーマンスを計算する主ページ。
- `test.html`
  - 過去パフォーマンス列から必要パフォーマンスを計算する別 UI。
- `test-handle.html`
  - AtCoder handle から履歴取得して計算する別 UI。

## Execution flow and call graph

### Current site deploy flow

1. `main` への push で `.github/workflows/deploy-pages.yml` が走る。
2. `build-tsumeshogi-web-solver` job が upstream repo を clone/build して artifact を upload する。
3. `deploy` job がこの repo を checkout し、artifact を download する。
4. `pages/.` と `fund-price-forecast/site/.`、download した `tsumeshogi-web-solver` 成果物を `dist-pages/` に assemble する。
5. `dist-pages/` 全体を GitHub Pages artifact として deploy する。

### `atcoder-rating-estimator` runtime flow

1. ブラウザが `test-last.html` / `test.html` / `test-handle.html` を読む。
2. 各 HTML は相対パス `atcoder_rating.js` を読み込む。
3. `atcoder_rating.js` 内の関数がレートや必要パフォーマンスを計算する。
4. `test-handle.html` だけは jQuery と Yahoo Query API を使って AtCoder 履歴ページを取得しようとする。

## Data structures and invariants

- upstream repo はビルド不要の静的ファイル集合である。
- 各 HTML は同一ディレクトリに `atcoder_rating.js` がある前提で相対参照している。
- ルート `/` 配信は不要で、`/atcoder-rating-estimator/` 配下にファイル一式を置けば動く可能性が高い。
- 既定の入口ファイルは `index.html` ではなく `test-last.html` である可能性が高い。

## Existing architectural patterns

- この repo では公開物ごとに個別パスで配信している。
- upstream 依存の公開物は workflow で都度 clone/build し、最終 deploy job で assemble するパターンを導入済み。

## Naming conventions

- 公開パスは概ね upstream repo 名に合わせる。
- 説明メモは `<content>/README.md` に置き、実装メモは `codex-notes/<task>/` に置く。

## Error handling patterns

- Pages workflow は shell script の失敗で job を止める。
- `atcoder-rating-estimator` 側は入力不正に対する robust な UI エラーハンドリングは薄い。
- `test-handle.html` は外部 API 失敗時に `alert("Failed")` を出す。

## Constraints

- upstream repo には `README.md` や workflow がなく、公開入口の明示が弱い。
- GitHub Pages 配信上、`/atcoder-rating-estimator/` のトップを自然に開かせるには `index.html` が必要。
- upstream の現状ファイル名をそのままコピーすると `/atcoder-rating-estimator/` では directory index が効かないため、何らかの入口調整が要る。
- `test-handle.html` は Yahoo Query API に依存しており、現在も機能しない可能性が高い。今回の配信移設だけではここは改善されない。

## Potential pitfalls

- `index.html` が upstream に存在しないため、公開パス直下の入口決めが必要。
- upstream を無修正 clone/copy するだけだと `/atcoder-rating-estimator/` で 404 になる可能性が高い。
- `test-handle.html` の外部依存は古く、移設後も壊れているかもしれない。
- upstream repo が非常に小さいため、build job と deploy job の分離が過剰な可能性はあるが、既存 workflow との整合では artifact job 化の方が扱いやすい。

## Local environment observations

- local clone of `atcoder-rating-estimator` contains only:
  - `atcoder_rating.js`
  - `test.html`
  - `test-last.html`
  - `test-handle.html`
- no `README.md`
- no `.github/workflows/`

## Unknowns

- upstream site の実際のトップ URL が `.../test-last.html` なのか、GitHub Pages 上で別設定があるのか。
- `/atcoder-rating-estimator/` の入口として `index.html` を upstream file の copy / rename で作るのが acceptable か。
- user が `test.html` と `test-handle.html` も導線付きで公開したいか、主機能だけで十分か。

## Likely implementation directions

### Option A: clone upstream in workflow and copy static files as-is

- deploy workflow で upstream repo を shallow clone
- `dist-pages/atcoder-rating-estimator/` を作る
- upstream の HTML/JS をコピー
- `test-last.html` を `index.html` としても配置し、パス直下を入口にする

Pros:

- source of truth を upstream に維持できる
- build 工程不要で軽い
- 既存の `tsumeshogi-web-solver` パターンと整合する

Cons:

- `index.html` だけは workflow 側で追加調整が必要
- upstream 更新で入口ファイル名が変わると assemble スクリプトも更新が必要

### Option B: repo 内に static snapshot を持つ

- upstream ファイルをこの repo にコミット
- assemble 時はそれをコピー

Pros:

- deploy の外部依存が減る

Cons:

- source of truth を upstream に残す要件に反する
- 更新同期が手動になる

## Recommendation

今回も Option A が自然。`atcoder-rating-estimator` は build 不要なので、workflow では clone + static copy のみ行い、`test-last.html` を `index.html` として複製して `/atcoder-rating-estimator/` の入口を作る案が最も実用的。
