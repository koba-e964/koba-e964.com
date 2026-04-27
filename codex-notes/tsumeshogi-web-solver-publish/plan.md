# tsumeshogi-web-solver publish plan

## Overview

最終形は次の 2 点を同時に満たす。

- 公開先本体は `koba-e964.com/tsumeshogi-web-solver/` に置く
- ソースコードの保守場所は引き続き `https://github.com/koba-e964/tsumeshogi-web-solver` に残す

そのため、この repo では `tsumeshogi-web-solver` の source も生成物も保持せず、GitHub Pages workflow の中で毎回 upstream repo を clone し、そこで build した静的成果物を `dist-pages/tsumeshogi-web-solver/` に取り込む。

また、旧公開先 `https://koba-e964.github.io/tsumeshogi-web-solver/` は upstream repo 側で新 URL への redirect page に置き換える。GitHub Pages では任意の HTTP 301/302 設定が難しいため、実装は HTML meta refresh と `location.replace(...)` による遷移ページを前提とする。

## Files to change

- `README.md`
  - repo 構成と公開コンテンツ一覧に `tsumeshogi-web-solver/` を追加する。
- `.github/workflows/deploy-pages.yml`
  - upstream clone, Rust/Node build, `www/dist/.` の copy を行う処理を追加する。
  - `actions/*` 以外の action を追加する場合は pin 要件を満たす。
- `tsumeshogi-web-solver/README.md` または同等の説明ファイル
  - この repo では source/生成物を持たず、workflow が upstream から build する方針を書く。

## Detailed implementation steps

1. `tsumeshogi-web-solver` の build 成果物の内容を確定する
   - upstream repo で `www/` の build を実行する
   - `www/dist/` に生成される公開必要ファイル一式を確認する
   - 相対パス前提のまま `/tsumeshogi-web-solver/` 配下で動くことを前提に採用する

2. この repo に upstream 連携用の説明だけを置く
   - `tsumeshogi-web-solver/README.md` などを追加する
   - README には「source of truth は upstream repo、この repo は Pages publish orchestration だけを持つ」という分担を書く

3. Pages workflow を更新する
   - upstream repo を shallow clone する
   - Rust toolchain, `wasm32-unknown-unknown`, Node, `wasm-pack` を準備する
   - upstream の `www/` で依存 install と build を実行する
   - `tsumeshogi-web-solver` build は独立 job に切り出し、artifact 経由で `deploy` job に渡す
   - `mkdir -p dist-pages/tsumeshogi-web-solver` を追加する
   - upstream `www/dist/.` を `dist-pages/tsumeshogi-web-solver/` にコピーする
   - 既存の `pages/` と `fund-price-forecast` の配信に影響を与えないように build ステップを独立させる

4. repo documentation を更新する
   - ルート `README.md` の構成一覧に `tsumeshogi-web-solver/` の publish orchestration について追加する
   - 公開コンテンツ一覧に `/tsumeshogi-web-solver/` を追加する
   - 更新導線として upstream repo を明記する

5. ローカルで公開物の妥当性を確認する
   - upstream build をローカルで一度通し、`www/dist/` に必要ファイルが揃うことを確認する
   - `deploy-pages.yml` の assemble 手順をローカルで模擬し、`dist-pages/tsumeshogi-web-solver/index.html` ができることを確認する
   - 必要ならローカル静的サーバで相対アセット読込を確認する

## Deferred TODO

- upstream repo 側の旧公開先 `https://koba-e964.github.io/tsumeshogi-web-solver/` を、将来的に `https://koba-e964.com/tsumeshogi-web-solver/` へ redirect する page に置き換える
- GitHub Pages の都合上、実装は純粋な HTTP 301/302 ではなく `meta refresh` と `location.replace(...)` を使う形になる見込み

## Alternatives considered

### Commit built static artifacts into this repo

却下理由:

- upstream の更新を毎回手動同期する必要がある
- source of truth を upstream に残したい要件に対して snapshot 管理が増える
- 生成物コミットで diff が読みにくくなる

### Git submodule or subtree で upstream を丸ごと取り込む

却下理由:

- 公開目的に対して repo 管理コストが増える
- この task の本質は site publish であり upstream 開発環境統合ではない
- Pages workflow まで含めた責務分離が曖昧になる
- source 管理場所を upstream に残す要件に対して中途半端

## Risks

- deploy 時に upstream clone/build が必須になるため、外部依存の失敗で Pages deploy が落ちうる
- Rust/Node/wasm-pack の toolchain 変更で workflow メンテナンスが必要になる
- `www/dist/` のファイル構成が upstream 変更で変わると更新手順の見直しが必要
- wasm / worker の参照パスがビルド時 assumptions に依存している場合、サブパス配信で問題が出る可能性がある
- 外部 proxy API 依存はそのまま残るため、機能の一部はこの publish 作業だけでは完全に保証できない

## Test strategy

- upstream build をローカルで一度実行し、`www/dist/` を生成できることを確認する
- この repo の workflow assemble 相当をローカルで再現し、`dist-pages/tsumeshogi-web-solver/` に成果物が配置されることを確認する
- `index.html` が相対参照で `main.js` を読むことを確認する
- 可能なら簡易 static server で `/tsumeshogi-web-solver/` 配下を開き、初期画面表示まで確認する

## Assumptions

- 今回の目的は upstream repo の継続的な開発統合ではなく、このサイトでの公開である
- `tsumeshogi-web-solver` はサブディレクトリ配信でも追加修正なしで動作する
- Pages workflow に upstream build を追加しても、現在の deploy 所要時間と保守コストが許容範囲に収まる

## Open questions

- upstream build の生成物に環境依存差分が出ないか
- `cargo install wasm-pack --version 0.14.0` をこの workflow で毎回行うか、別の導入方法にするか
- upstream redirect を source 変更で作るか、deploy 成果物の置換だけで作るか

## Implementation Checklist

- [x] upstream `tsumeshogi-web-solver` の build を実行して `www/dist/` を生成する
- [x] `tsumeshogi-web-solver/README.md` など、upstream 連携方針を説明するファイルを追加する
- [x] `.github/workflows/deploy-pages.yml` を更新して upstream clone/build 後に `dist-pages/tsumeshogi-web-solver/` へコピーする
- [x] `tsumeshogi-web-solver` build を独立 job に切り出し、artifact 経由で `deploy` job に渡す
- [x] `README.md` を更新して新しい公開コンテンツを記載する
- [x] ローカルで Pages assemble 相当の確認を行う
