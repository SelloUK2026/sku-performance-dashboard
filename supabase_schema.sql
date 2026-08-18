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
  inventory_status text,
  grade_level numeric,
  estimated_months_to_sell numeric,
  daily_average_sales numeric,
  stock_on_hand numeric,
  cogs numeric,
  suggested_freight numeric
);

alter table public.inventory add column if not exists suggested_freight numeric;
alter table public.inventory add column if not exists inventory_status text;

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

create table if not exists public.channeladvisor_products (
  platform_sku text primary key,
  wooper_sku text,
  ca_price numeric check (ca_price is null or ca_price >= 0),
  title text,
  brand text,
  mapping_status text not null default 'unresolved'
    check (mapping_status in ('mapped', 'unresolved', 'non_existing')),
  mapping_source text,
  imported_at timestamptz not null default now()
);

create index if not exists channeladvisor_products_wooper_sku_idx
  on public.channeladvisor_products (wooper_sku);

create table if not exists public.promotion_sku_data (
  sku text primary key,
  main_category text,
  subcategory text,
  brand text,
  inventory_status text,
  grade_level numeric,
  estimated_months_to_sell numeric,
  stock_on_hand numeric,
  cogs numeric,
  first_arrival_date date,
  suggested_freight numeric,
  sold_qty numeric default 0,
  sales_amt numeric default 0,
  net_sales numeric default 0,
  return_amount numeric default 0,
  profit_incl_rn numeric default 0,
  return_rate numeric,
  lifetime_profit_margin numeric,
  refreshed_at timestamptz not null default now()
);

create table if not exists public.promotion_protection_list (
  sku text not null,
  protection_start date not null,
  protection_end date not null,
  protection_owner text,
  protected_ca_price numeric,
  source_row integer,
  source_spreadsheet_id text not null,
  source_sheet text not null default '保護清單',
  refreshed_at timestamptz not null default now(),
  primary key (sku, protection_start, protection_end),
  check (length(btrim(sku)) > 0),
  check (protection_end >= protection_start)
);

create index if not exists promotion_protection_active_idx
  on public.promotion_protection_list (protection_start, protection_end, sku);

create table if not exists public.sku_mappings (
  mapping_scope text not null
    check (mapping_scope in ('channeladvisor', 'platform')),
  platform text not null default '',
  external_sku text not null,
  wooper_sku text,
  status text not null
    check (status in ('mapped', 'non_existing')),
  mapping_source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mapping_scope, platform, external_sku),
  check (
    (status = 'mapped' and wooper_sku is not null)
    or (status = 'non_existing' and wooper_sku is null)
  )
);

create index if not exists sku_mappings_wooper_sku_idx
  on public.sku_mappings (wooper_sku)
  where wooper_sku is not null;

create table if not exists public.promotion_worktables (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  event_name text not null,
  source_file text,
  source_row_count integer not null default 0 check (source_row_count >= 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  eligible_count integer not null default 0 check (eligible_count >= 0),
  selected_count integer not null default 0 check (selected_count >= 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  created_on date not null default ((timezone('Australia/Sydney', now()))::date),
  check (length(btrim(platform)) between 1 and 120),
  check (length(btrim(event_name)) between 1 and 160)
);

create index if not exists promotion_worktables_created_at_idx
  on public.promotion_worktables (created_at desc);
create index if not exists promotion_worktables_platform_created_idx
  on public.promotion_worktables (platform, created_at desc);
create index if not exists promotion_worktables_created_on_idx
  on public.promotion_worktables (created_on, created_at desc);
create index if not exists promotion_worktables_event_name_lower_idx
  on public.promotion_worktables (lower(event_name));

create or replace function public.prevent_promotion_worktable_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Saved promotion worktables are immutable';
end;
$$;

drop trigger if exists promotion_worktables_prevent_update
  on public.promotion_worktables;
create trigger promotion_worktables_prevent_update
before update on public.promotion_worktables
for each row execute function public.prevent_promotion_worktable_update();

alter table public.sales enable row level security;
alter table public.sku_master enable row level security;
alter table public.inventory enable row level security;
alter table public.freight enable row level security;
alter table public.container_report enable row level security;
alter table public.price_history enable row level security;
alter table public.product_images enable row level security;
alter table public.channeladvisor_products enable row level security;
alter table public.promotion_sku_data enable row level security;
alter table public.promotion_protection_list enable row level security;
alter table public.sku_mappings enable row level security;
alter table public.promotion_worktables enable row level security;

grant select, insert, update, delete
  on public.channeladvisor_products, public.promotion_sku_data,
  public.promotion_protection_list, public.sku_mappings
  to service_role;
grant select, insert, delete on public.promotion_worktables to service_role;
revoke all
  on public.channeladvisor_products, public.promotion_sku_data,
  public.promotion_protection_list, public.sku_mappings
  from anon, authenticated;
revoke all on public.promotion_worktables from anon, authenticated;

drop policy if exists "dashboard read sales" on public.sales;
drop policy if exists "dashboard read sku master" on public.sku_master;
drop policy if exists "dashboard read inventory" on public.inventory;
drop policy if exists "dashboard read freight" on public.freight;
drop policy if exists "dashboard read container" on public.container_report;
drop policy if exists "dashboard read price history" on public.price_history;
drop policy if exists "dashboard read images" on public.product_images;
drop policy if exists "dashboard read channeladvisor products" on public.channeladvisor_products;

create policy "dashboard read sales" on public.sales for select using (true);
create policy "dashboard read sku master" on public.sku_master for select using (true);
create policy "dashboard read inventory" on public.inventory for select using (true);
create policy "dashboard read freight" on public.freight for select using (true);
create policy "dashboard read container" on public.container_report for select using (true);
create policy "dashboard read price history" on public.price_history for select using (true);
create policy "dashboard read images" on public.product_images for select using (true);
