# tsumeshogi-web-solver

`/tsumeshogi-web-solver/` は `https://github.com/koba-e964/tsumeshogi-web-solver` を GitHub Pages workflow の中で clone / build して配信しています。

このリポジトリには `tsumeshogi-web-solver` のソースコードやビルド成果物は置きません。source of truth は upstream repo です。

## 配信方法

- `.github/workflows/deploy-pages.yml` が upstream repo を shallow clone する
- `external/tsumeshogi-web-solver/www/` で `npm ci` と `npm run build` を実行する
- 生成された `www/dist/` を `dist-pages/tsumeshogi-web-solver/` にコピーして GitHub Pages に載せる

## TODO

- 旧公開先 `https://koba-e964.github.io/tsumeshogi-web-solver/` を新 URL へ redirect する
