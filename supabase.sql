create table if not exists public.osp_products (
  id text primary key,
  doc jsonb not null check (doc->>'id' = id)
);
alter table public.osp_products enable row level security;
revoke all on public.osp_products from anon, authenticated;
grant select, insert, update on public.osp_products to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('osp-catalog', 'osp-catalog', true, 8388608, array['image/webp'])
on conflict (id) do nothing;
