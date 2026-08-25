alter table public.promotion_platform_settings
    add column if not exists variable_commission boolean not null default false;

update public.promotion_platform_settings
set variable_commission = true
where platform in ('Debenhams', 'The Range');
