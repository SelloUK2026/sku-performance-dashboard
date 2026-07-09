create table if not exists public.sales (
  id bigint generated always as identity primary key,
  sale_date date not null,
  platform text,
  sku text not null,
  sku_qty numeric default 0,
  sales_amt numeric default 0,
  extra_freight numeric default 0,
  promo_rebate numeric default 0,
  selling_fee numeric default 0,
  ads_fee numeric default 0,
  resend_amt numeric default 0,
  refund_amt numeric default 0,
  profit_incl_rn numeric default 0,
  postage numeric default 0
);

alter table public.sales add column if not exists resend_amt numeric default 0;
alter table public.sales add column if not exists extra_freight numeric default 0;
alter table public.sales add column if not exists promo_rebate numeric default 0;

create index if not exists sales_sku_date_idx on public.sales (sku, sale_date);
create index if not exists sales_date_idx on public.sales (sale_date);

create table if not exists public.sku_master (
  sku text primary key,
  first_arrival_date date,
  cogs numeric,
  grade numeric
);

create table if not exists public.inventory (
  sku text primary key,
  main_category text,
  subcategory text,
  brand text,
  grade_level numeric,
  estimated_months_to_sell numeric,
  daily_average_sales numeric,
  stock_on_hand numeric,
  cogs numeric,
  suggested_freight numeric
);

alter table public.inventory add column if not exists suggested_freight numeric;

create table if not exists public.freight (
  sku text primary key,
  sello_tools_calculation numeric,
  valid_qty numeric,
  avg_actual_freight numeric,
  suggested_freight numeric
);

create table if not exists public.container_report (
  id bigint generated always as identity primary key,
  invoice_number text,
  sku text not null,
  inbound_time date,
  latest_batch_arrival_date date,
  qty numeric,
  product_type text,
  status text,
  source text
);

alter table public.container_report add column if not exists invoice_number text;
alter table public.container_report add column if not exists status text;
alter table public.container_report add column if not exists source text;

create index if not exists container_report_sku_inbound_idx on public.container_report (sku, inbound_time desc);
create index if not exists container_report_invoice_idx on public.container_report (invoice_number);

create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  sku text not null,
  label text not null,
  sequence integer not null,
  stock numeric,
  price numeric
);

create index if not exists price_history_sku_sequence_idx on public.price_history (sku, sequence);

create table if not exists public.product_images (
  sku text primary key,
  title text,
  brand text,
  image_url text,
  image_urls jsonb default '[]'::jsonb
);

alter table public.sales enable row level security;
alter table public.sku_master enable row level security;
alter table public.inventory enable row level security;
alter table public.freight enable row level security;
alter table public.container_report enable row level security;
alter table public.price_history enable row level security;
alter table public.product_images enable row level security;

drop policy if exists "dashboard read sales" on public.sales;
drop policy if exists "dashboard read sku master" on public.sku_master;
drop policy if exists "dashboard read inventory" on public.inventory;
drop policy if exists "dashboard read freight" on public.freight;
drop policy if exists "dashboard read container" on public.container_report;
drop policy if exists "dashboard read price history" on public.price_history;
drop policy if exists "dashboard read images" on public.product_images;

create policy "dashboard read sales" on public.sales for select using (true);
create policy "dashboard read sku master" on public.sku_master for select using (true);
create policy "dashboard read inventory" on public.inventory for select using (true);
create policy "dashboard read freight" on public.freight for select using (true);
create policy "dashboard read container" on public.container_report for select using (true);
create policy "dashboard read price history" on public.price_history for select using (true);
create policy "dashboard read images" on public.product_images for select using (true);
