create table if not exists public.promotion_tesco_offers (
    tesco_sku text primary key,
    product_id text,
    wooper_sku text,
    ca_price numeric,
    mapping_status text not null default 'unresolved',
    captured_at timestamptz not null default now()
);

create index if not exists promotion_tesco_offers_wooper_sku_idx
    on public.promotion_tesco_offers (wooper_sku);

create table if not exists public.promotion_tesco_events (
    id uuid primary key default gen_random_uuid(),
    event_name text not null,
    start_date date not null,
    end_date date not null,
    created_at timestamptz not null default now(),
    source jsonb not null default '{}'::jsonb,
    rows jsonb not null default '[]'::jsonb,
    constraint promotion_tesco_events_date_order
        check (start_date <= end_date)
);

create index if not exists promotion_tesco_events_dates_idx
    on public.promotion_tesco_events (start_date, end_date);

alter table public.promotion_tesco_offers enable row level security;
alter table public.promotion_tesco_events enable row level security;

revoke all on table public.promotion_tesco_offers from anon, authenticated;
revoke all on table public.promotion_tesco_events from anon, authenticated;
