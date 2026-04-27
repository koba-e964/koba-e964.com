# koba-e964.com

`koba-e964.com` 向けの公開物と、その一部コンテンツを支えるコードを置くリポジトリです。

## 構成

- `pages/`
  - GitHub Pages に配信するルート公開物
- `fund-price-forecast/`
  - ファンド価格予測くん一式
  - `site/`: `/fund-price-forecast/` に配信する静的ページ
  - `backend/`: Lambda/Neon バックエンド
  - `infra/`: AWS CDK と Neon bootstrap 用スクリプト
- `tsumeshogi-web-solver/`
  - `/tsumeshogi-web-solver/` 配信用メモ
  - 実体は upstream repo を workflow 内で clone / build して配信
- `codex-notes/`
  - 実装メモと計画

## 現在の公開コンテンツ

- `/fund-price-forecast/`
  - ファンド価格予測くん
  - 詳細は [fund-price-forecast/README.md](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forecast/README.md)
- `/tsumeshogi-web-solver/`
  - 詰将棋 Web ソルバー
  - 詳細は [tsumeshogi-web-solver/README.md](/Users/kobas-mac/srcview/koba-e964.com/tsumeshogi-web-solver/README.md)

## GitHub Pages

- `.github/workflows/deploy-pages.yml` で `pages/` と `fund-price-forecast/site/` を組み立て、`tsumeshogi-web-solver` は upstream repo を build して Pages に配信します。
- `pages/` 直下にはトップページ、`CNAME`、`ads.txt` を置きます。
- アプリごとの公開物は repo 内静的ファイルか upstream build のどちらかで持ち、workflow で公開パスへ配置します。

## 運用メモ

- ルートの README は repo 全体の案内だけを書く
- 個別コンテンツの詳細説明は各サブディレクトリへ置く
- README に書かれているはずの内容で質問が発生したら、その回答を該当 README に追記する
