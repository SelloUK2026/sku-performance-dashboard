alter table public.promotion_tesco_events
    add column if not exists discount_end_date_mirakl text;

alter table public.promotion_tesco_events
    drop constraint if exists promotion_tesco_events_mirakl_text_length;
alter table public.promotion_tesco_events
    add constraint promotion_tesco_events_mirakl_text_length
    check (
        discount_end_date_mirakl is null
        or length(discount_end_date_mirakl) <= 120
    );

create table if not exists public.promotion_tesco_catalogue (
    tesco_sku text primary key,
    wooper_sku text,
    barcode text,
    title text,
    brand text,
    category_path text,
    image_url text,
    captured_at timestamptz not null default now()
);

create index if not exists promotion_tesco_catalogue_barcode_idx
    on public.promotion_tesco_catalogue (barcode)
    where barcode is not null and barcode <> '';
create index if not exists promotion_tesco_catalogue_wooper_sku_idx
    on public.promotion_tesco_catalogue (wooper_sku)
    where wooper_sku is not null and wooper_sku <> '';

alter table public.promotion_tesco_catalogue enable row level security;

grant select, insert, update, delete
    on public.promotion_tesco_catalogue, public.promotion_tesco_events
    to service_role;
revoke all
    on public.promotion_tesco_catalogue, public.promotion_tesco_events
    from anon, authenticated;
