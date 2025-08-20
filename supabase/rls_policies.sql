-- Activar RLS
alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.brand_users enable row level security;
alter table public.products enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.audit_logs enable row level security;

-- PROFILES
drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_admin_select" on public.profiles;
drop policy if exists "profiles_upsert_self" on public.profiles;
create policy "profiles_self_select" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_admin_select" on public.profiles for select using (public.is_admin());
create policy "profiles_upsert_self" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin());

-- BRANDS
drop policy if exists "brands_public_select" on public.brands;
drop policy if exists "brands_admin_select_all" on public.brands;
drop policy if exists "brands_admin_write" on public.brands;
create policy "brands_public_select" on public.brands for select using (active = true and deleted_at is null);
create policy "brands_admin_select_all" on public.brands for select using (public.is_admin());
create policy "brands_admin_write" on public.brands for all using (public.is_admin()) with check (public.is_admin());

-- BRAND_USERS
drop policy if exists "brand_users_admin_all" on public.brand_users;
drop policy if exists "brand_users_self_select" on public.brand_users;
create policy "brand_users_admin_all" on public.brand_users for all using (public.is_admin()) with check (public.is_admin());
create policy "brand_users_self_select" on public.brand_users for select using (auth.uid() = user_id or public.is_admin());

-- PRODUCTS
drop policy if exists "products_public_select" on public.products;
drop policy if exists "products_admin_vendor_write" on public.products;
drop policy if exists "products_admin_select_all" on public.products;
create policy "products_public_select" on public.products for select using (active = true and deleted_at is null);
create policy "products_admin_select_all" on public.products for select using (public.is_admin());
create policy "products_admin_vendor_write" on public.products for all using (public.is_admin() or public.is_vendor_for(brand_id)) with check (public.is_admin() or public.is_vendor_for(brand_id));

-- SUPPORT_THREADS
drop policy if exists "support_threads_owner_admin_select" on public.support_threads;
drop policy if exists "support_threads_insert_owner" on public.support_threads;
drop policy if exists "support_threads_admin_update" on public.support_threads;
create policy "support_threads_owner_admin_select" on public.support_threads for select using (auth.uid() = user_id or public.is_admin());
create policy "support_threads_insert_owner" on public.support_threads for insert with check (auth.uid() = user_id);
create policy "support_threads_admin_update" on public.support_threads for update using (public.is_admin());

-- SUPPORT_MESSAGES
drop policy if exists "support_messages_owner_admin" on public.support_messages;
create policy "support_messages_owner_admin" on public.support_messages for all using (
  exists (select 1 from public.support_threads t where t.id = support_messages.thread_id and (t.user_id = auth.uid() or public.is_admin()))
) with check (
  exists (select 1 from public.support_threads t where t.id = support_messages.thread_id and (t.user_id = auth.uid() or public.is_admin()))
);

-- ORDERS
drop policy if exists "orders_select_buyer_admin_vendor" on public.orders;
drop policy if exists "orders_insert_any_auth" on public.orders;
create policy "orders_select_buyer_admin_vendor" on public.orders for select using (
  public.is_admin() or exists (select 1 from public.brand_users bu where bu.brand_id = orders.brand_id and bu.user_id = auth.uid()) or auth.uid() = buyer_id
);
create policy "orders_insert_any_auth" on public.orders for insert with check (auth.role() = 'authenticated');

-- ORDER_ITEMS
drop policy if exists "order_items_select_brand_vendor_admin" on public.order_items;
drop policy if exists "order_items_insert_any_auth" on public.order_items;
create policy "order_items_select_brand_vendor_admin" on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o join public.brand_users bu on bu.brand_id = o.brand_id where o.id = order_items.order_id and (o.buyer_id = auth.uid() or bu.user_id = auth.uid()))
);
create policy "order_items_insert_any_auth" on public.order_items for insert with check (auth.role() = 'authenticated');

-- AUDIT_LOGS (solo admin)
drop policy if exists "audit_logs_admin_all" on public.audit_logs;
create policy "audit_logs_admin_all" on public.audit_logs for all using (public.is_admin()) with check (public.is_admin());

-- STORAGE buckets y policies (leer: público; escribir: autenticados; delete: admin)
-- Crear buckets si no existen (idempotente)
insert into storage.buckets (id, name, public) values ('brand-logos','brand-logos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('product-images','product-images', true) on conflict (id) do nothing;

-- Policies de brand-logos
create policy if not exists "brand-logos-public-read" on storage.objects
  for select using (bucket_id = 'brand-logos');
create policy if not exists "brand-logos-auth-upload" on storage.objects
  for insert to authenticated using (bucket_id = 'brand-logos') with check (bucket_id = 'brand-logos');
create policy if not exists "brand-logos-admin-delete" on storage.objects
  for delete using (bucket_id = 'brand-logos' and public.is_admin());

-- Policies de product-images
create policy if not exists "product-images-public-read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy if not exists "product-images-auth-upload" on storage.objects
  for insert to authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
create policy if not exists "product-images-admin-delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());