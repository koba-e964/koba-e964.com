create table if not exists funds (
  id bigserial primary key,
  code text not null unique,
  slug text not null unique,
  display_name text not null,
  provider_name text not null,
  source_url text not null,
  benchmark_kind text not null,
  annual_fee_rate numeric(12, 9) not null,
  currency text not null default 'JPY',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists market_index_daily (
  trade_date date not null,
  symbol text not null,
  close_value numeric(18, 6) not null,
  currency text not null,
  source_name text not null,
  source_url text not null,
  fetched_at timestamptz not null,
  raw_payload text not null,
  primary key (symbol, trade_date)
);

create table if not exists fx_daily (
  business_date date not null,
  currency_pair text not null,
  tts numeric(18, 6) not null,
  ttb numeric(18, 6) not null,
  ttm numeric(18, 6) not null,
  source_name text not null,
  source_url text not null,
  fetched_at timestamptz not null,
  raw_payload text not null,
  primary key (currency_pair, business_date)
);

create table if not exists fund_nav_daily (
  fund_code text not null references funds(code),
  business_date date not null,
  nav numeric(18, 6) not null,
  source_name text not null,
  source_url text not null,
  fetched_at timestamptz not null,
  raw_payload text not null,
  primary key (fund_code, business_date)
);

create table if not exists fund_predictions_daily (
  fund_code text not null references funds(code),
  business_date date not null,
  status text not null,
  predicted_nav numeric(18, 6) not null,
  predicted_from_trade_date date,
  predicted_from_fx_date date,
  used_index_value numeric(18, 6),
  used_ttm numeric(18, 6),
  fee_adjustment_factor numeric(18, 9) not null,
  method_version text not null,
  confidence_note text not null,
  computed_at timestamptz not null,
  primary key (fund_code, business_date, method_version)
);

insert into funds (
  code,
  slug,
  display_name,
  provider_name,
  source_url,
  benchmark_kind,
  annual_fee_rate
) values (
  '253266',
  '253266',
  'eMAXIS Slim 米国株式（S&P500）',
  '三菱UFJアセットマネジメント',
  'https://www.am.mufg.jp/mukamapi/fund_details/?fund_cd=253266',
  'S&P500 total return JPY proxy',
  0.000814
)
on conflict (code) do update set
  display_name = excluded.display_name,
  provider_name = excluded.provider_name,
  source_url = excluded.source_url,
  benchmark_kind = excluded.benchmark_kind,
  annual_fee_rate = excluded.annual_fee_rate;
