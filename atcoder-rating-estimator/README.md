# atcoder-rating-estimator

`/atcoder-rating-estimator/` は `https://github.com/koba-e964/atcoder-rating-estimator` を GitHub Pages workflow の中で clone / copy して配信しています。

このリポジトリには `atcoder-rating-estimator` のソースコードや生成物は置きません。source of truth は upstream repo です。

## 配信方法

- `.github/workflows/deploy-pages.yml` が upstream repo を shallow clone する
- `atcoder_rating.js`, `test.html`, `test-handle.html`, `test-last.html` を artifact にまとめる
- `test-last.html` は `/atcoder-rating-estimator/` の入口用に `index.html` としても配置する
- artifact を `dist-pages/atcoder-rating-estimator/` にコピーして GitHub Pages に載せる

## Notes

- `test-handle.html` は古い外部 API 依存を含むため、現在も正常動作しない可能性があります
