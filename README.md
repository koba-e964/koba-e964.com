# koba-e964.com

`koba-e964.com` 向けの公開物と、その一部コンテンツを支えるコードを置くリポジトリです。

## 構成

- `pages/`
  - GitHub Pages に配信するルート公開物
- `fund-price-forcast/`
  - ファンド価格予測くん一式
  - `site/`: `/fund-price-forcast/` に配信する静的ページ
  - `backend/`: Lambda/Neon バックエンド
  - `infra/`: AWS CDK と Neon bootstrap 用スクリプト
- `codex-notes/`
  - 実装メモと計画

## 現在の公開コンテンツ

- `/fund-price-forcast/`
  - ファンド価格予測くん
  - 詳細は [fund-price-forcast/README.md](/Users/kobas-mac/srcview/koba-e964.com/fund-price-forcast/README.md)

## GitHub Pages

- `.github/workflows/deploy-pages.yml` で `pages/` と `fund-price-forcast/site/` を組み立てて Pages に配信します。
- `pages/` 直下にはトップページ、`CNAME`、`ads.txt` を置きます。
- アプリごとの公開物は `fund-price-forcast/` 配下に持ち、workflow で公開パスへ配置します。

## 運用メモ

- ルートの README は repo 全体の案内だけを書く
- 個別コンテンツの詳細説明は各サブディレクトリへ置く
