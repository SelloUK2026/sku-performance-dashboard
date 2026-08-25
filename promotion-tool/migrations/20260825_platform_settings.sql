create table if not exists public.promotion_platform_settings (
    platform text primary key,
    default_commission numeric not null
        check (default_commission between 0 and 1),
    manual_promo_price_adjustment boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (length(btrim(platform)) between 1 and 120)
);

insert into public.promotion_platform_settings
    (platform, default_commission, manual_promo_price_adjustment)
values
    ('eBay', 0.11, false),
    ('Amazon(UK)', 0.18, false),
    ('Temu(UK)', 0.00, false),
    ('Wayfair', 0.05, false),
    ('Debenhams', 0.24, false),
    ('Tesco', 0.18, false),
    ('BrandAlley', 0.24, false),
    ('Decathlon UK Limited', 0.19, false),
    ('The Range', 0.14, false),
    ('TikTok(Skylos)', 0.09, false),
    ('Tiktok(Levede)', 0.09, false),
    ('Skylous shopify', 0.00, false),
    ('Go Groopie', 0.00, false),
    ('Groupon(UK)', 0.00, false),
    ('Wowcher', 0.20, false),
    ('Onbuy', 0.15, false),
    ('ManoMano', 0.16, false),
    ('Fruugo', 0.20, false),
    ('Rackham', 0.18, false)
on conflict (platform) do nothing;

create or replace function public.set_promotion_platform_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists promotion_platform_settings_updated_at
    on public.promotion_platform_settings;
create trigger promotion_platform_settings_updated_at
before update on public.promotion_platform_settings
for each row execute function public.set_promotion_platform_settings_updated_at();

alter table public.promotion_platform_settings enable row level security;

grant select, insert, update
    on public.promotion_platform_settings
    to service_role;
revoke all
    on public.promotion_platform_settings
    from anon, authenticated;
