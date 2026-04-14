# Research: Fund Price Forecast Site

## Scope

- Build a public web page on GitHub Pages for forecasting a fund price.
- Initial target fund is `https://emaxis.am.mufg.jp/fund/253266.html`.
- URL path must remain fund-agnostic so future funds can be added without `sp500` in the page URL.
- Price formation described by the user depends on:
  - S&P 500 source price in USD from Yahoo! Finance `^GSPC`
  - MUFG TTM, defined as `(TTS + TTB) / 2`
- Historical data for the upstream sources must be persisted outside the GitHub repo.
- GitHub Actions should not be the primary daily processing engine; user prefers AWS Lambda plus a durable store such as Neon.

## Current Repository State

Relevant files:

- `CNAME`
- `ads.txt`

Observed characteristics:

- No existing application code
- No package manager files
- No static site generator setup
- No API code
- No infra-as-code
- No test harness

Current execution flow:

- GitHub Pages currently serves a minimal static site footprint only.
- There is no current build pipeline in the repository.

Current naming and architecture conventions:

- No established frontend, backend, or infra conventions exist yet.
- The repo is effectively greenfield except for Pages domain configuration.

## External Data Sources Observed

### Fund source

User-specified fund page:

- `https://emaxis.am.mufg.jp/fund/253266.html`

Observed from searchable public snippets:

- Fund name: `eMAXIS Slim 米国株式（S&P500）`
- Benchmark is described as `S&P500指数（配当込み、円換算ベース）`
- NAV is published after trust fee deduction
- Public references also show:
  - fund code `253266`
  - setting date `2018-07-03`
  - no distribution so far in the surfaced snippets

Important invariant:

- The fund benchmark is not raw USD S&P 500. It is described as dividend-inclusive and yen-converted.
- Any prediction using only `^GSPC` and MUFG TTM is therefore an approximation unless the exact benchmark transformation is modeled.

Fee-related observation:

- Public snippets show the trust fee is small on a day-over-day horizon but non-zero on long horizons.
- For long-range projections, the fee must be compounded into the estimate if the site claims a modeled NAV instead of a near-term estimate.

### S&P 500 source

User-specified source:

- `https://finance.yahoo.co.jp/quote/%5EGSPC`

Observed page behavior:

- The accessible page is JS-oriented and some live fields are blank in a no-JS rendering.
- The page clearly identifies `^GSPC` as S&P 500.
- Public rendered fields include a delayed quote context and a visible `前日終値` entry in the crawler snapshot.

Implications:

- Frontend scraping from the browser would be fragile.
- Direct client-side fetches from GitHub Pages are likely to face CORS and markup volatility issues.
- A server-side collector is more appropriate than browser scraping.

### MUFG FX source

User-specified source:

- `https://www.bk.mufg.jp/ippan/kinri/list_j/kinri/kawase.html`

Observed behavior:

- The MUFG bank page no-JS rendering exposes the table shell, but current rates appear as `----` in the accessible snapshot.
- The page links to `過去の外国為替相場一覧表` on `murc-kawasesouba.jp`.
- Searchable public snapshots from the MURC pages explicitly state:
  - `TTM` is the midpoint of `TTS` and `TTB`
  - formula: `(TTS + TTB) / 2`
  - daily USD TTS and TTB values are published there

Implications:

- The user requirement references the MUFG bank announcement, but operationally the MURC-hosted mirror may be the stable machine-readable source for the same published values.
- Historical FX retrieval appears easier from the MURC pages than from the bank landing page.

## Platform Constraints

### GitHub Pages / Jekyll

From GitHub Docs:

- GitHub Pages is a static hosting target.
- Jekyll ignores:
  - files and folders under `/node_modules` or `/vendor`
  - names starting with `_`, `.`, or `#`
  - names ending with `~`
  - anything in the Jekyll `exclude` config
- GitHub Pages can also bypass Jekyll entirely with `.nojekyll`, but that is a separate mode.

Implications for this repo:

- Any non-public build artifacts, notes, infra directories, or source code not meant for the public site can be kept under ignored paths or explicitly excluded.
- The public site should be emitted into a Pages-safe static output.
- Dynamic prediction data cannot be computed on GitHub Pages itself; the static frontend must call an external API or read generated static JSON.

### Persistence and job execution

User constraints:

- Do not store historical source data in the GitHub repo.
- Do not rely on GitHub Actions as the main daily trigger.
- Prefer Neon as the durable store.

Operational conclusion:

- Persistent upstream history needs an external database.
- Source polling and normalization need a compute environment outside GitHub Pages.
- AWS Lambda with a scheduler fits the requested direction and avoids keeping a server running continuously.

## Domain Model Emerging From Requirements

Required concepts implied by the request:

- `fund`
  - generic identity, display name, source URLs, fee settings
- `source_snapshot`
  - date/time stamped raw observations for:
    - S&P 500 source level
    - USD/JPY TTS
    - USD/JPY TTB
    - derived TTM
- `fund_nav_snapshot`
  - observed official NAV when available
- `prediction`
  - computed estimate with confidence/status depending on source completeness

Required user-visible states:

- Confirmed value:
  - both upstream values needed for the modeled day are known
- Partial prediction:
  - only one of the two upstream values is known
- Long-range modeled estimate:
  - fee drag is included because the time horizon is long enough that ignoring it is misleading

Important invariant:

- The system must distinguish observed official values from modeled estimates.
- The site should not blur official NAV, predicted NAV, and source-derived proxy values into one undifferentiated number.

## Timing and Data-Quality Constraints

Known timing characteristics:

- S&P 500 closes on US market time.
- MUFG FX publication is on Japan banking time.
- The fund NAV is a Japan-published value referencing a yen-converted benchmark.

Known complexity:

- The source publication times do not line up naturally.
- Some days have US market holidays, Japan bank holidays, or both.
- A daily forecast needs explicit date alignment rules between:
  - US market close date
  - Japan FX publication date
  - fund business date

Potential pitfalls:

- Off-by-one-day errors around JST vs US/Eastern
- Incorrect handling of weekends and market holidays
- Treating Yahoo-rendered display values as an authoritative API
- Ignoring dividend or total-return differences between raw index and the benchmark used by the fund
- Overstating certainty when only one upstream input is known

## Call Graph and Execution Reality Today

There is no existing application call graph in the repo.

The intended runtime boundaries implied by the requirements are:

1. An external collector reads upstream source values.
2. Collector stores normalized history outside GitHub.
3. A public static frontend reads prepared data from an API or static JSON endpoint.
4. The frontend renders:
  - latest observed inputs
  - predicted next value
  - confirmed historical values
  - distinction between estimate and confirmed value

This is not yet a plan; it is the minimum runtime decomposition implied by the requirement that Pages remains static while history is persisted elsewhere.

## Error Handling and Reliability Considerations

Likely failure modes based on source behavior:

- Upstream markup changes
- Source page temporarily empty or delayed
- One source updates before the other
- Duplicate ingestion for the same business date
- Holiday gaps
- Mismatch between raw source date and fund valuation date

Necessary invariants for any future implementation:

- Raw upstream values should be stored with fetch timestamp and source date separately.
- Derived fields like TTM should be recomputable from stored TTS and TTB.
- Idempotent writes are needed for daily ingestion.
- Forecast rows should preserve provenance about which inputs were known at calculation time.

## Unknowns That Block Planning Certainty

These need to be resolved during planning or implementation design:

- Exact formula from upstream S&P 500 and USD/JPY into the target fund NAV
  - raw price vs total return
  - same-day vs prior-day alignment
  - treatment of dividends
  - holiday carry-forward rules
- Exact trust-fee model to apply over long horizons
  - constant annualized approximation may be acceptable, but this is not yet validated
- Whether the official fund page exposes machine-readable daily NAV history
- Which source is acceptable as the production collector input for S&P 500
  - Yahoo page scraping may be legally or operationally weak
- Whether the site should support one fund selected by config or multiple fund pages from day one
- Whether the public frontend should read directly from an API or from periodically generated JSON snapshots

## Source Notes

References consulted for this research:

- GitHub Docs, About GitHub Pages and Jekyll: `https://docs.github.com/articles/repository-metadata-on-github-pages`
- GitHub Docs, Creating a GitHub Pages site with Jekyll: `https://docs.github.com/pages/setting-up-a-github-pages-site-with-jekyll/creating-a-github-pages-site-with-jekyll`
- GitHub Docs, Using custom workflows with GitHub Pages: `https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`
- AWS Lambda docs, scheduled invocation with EventBridge Scheduler: `https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html`
- AWS EventBridge docs, scheduled rules are legacy and Scheduler is preferred: `https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html`
- Yahoo! Finance Japan S&P 500 page: `https://finance.yahoo.co.jp/quote/%5EGSPC`
- MUFG bank FX page: `https://www.bk.mufg.jp/ippan/kinri/list_j/kinri/kawase.html`
- MURC FX pages surfaced by search results showing TTM midpoint definition
- Public fund snippets for `253266` surfaced by search results indicating benchmark and fee-related context
