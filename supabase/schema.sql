-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Tabla profiles (1:1 con auth.users)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text check (role in ('admin','vendor') or role is null)
);

-- Marcas
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  logo_url text,
  color text,
  active boolean default true,
  bank_alias text,
  bank_cbu text,
  mp_access_token text, -- guardado aquí; accesible solo server-side por RLS
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Relación brand-vendors
create table if not exists public.brand_users (
  id bigserial primary key,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (brand_id, user_id)
);

-- Productos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  price numeric,
  image_url text,
  category text,
  subcategory text,
  active boolean default true,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Soporte
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id),
  status text default 'open',
  created_at timestamptz default now()
);
create table if not exists public.support_messages (
  id bigserial primary key,
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_role text check (sender_role in ('user','admin')) not null,
  message text not null,
  created_at timestamptz default now()
);

-- Pedidos / Métricas
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete set null,
  total numeric,
  status text default 'created',
  payment_method text,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz default now()
);
create table if not exists public.order_items (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete set null,
  qty int,
  unit_price numeric,
  created_at timestamptz default now()
);

-- Audit log (mínimo)
create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  action text,
  entity text,
  entity_id text,
  created_at timestamptz default now()
);

-- Índices
create index if not exists idx_brands_slug on public.brands(slug);
create index if not exists idx_products_brand on public.products(brand_id);
create index if not exists idx_support_thread_user on public.support_threads(user_id);
create index if not exists idx_orders_brand on public.orders(brand_id);
create index if not exists idx_order_items_order on public.order_items(order_id);

-- Helpers para RLS
create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_vendor_for(brand uuid) returns boolean language sql stable as $$
  select exists (select 1 from public.brand_users where user_id = auth.uid() and brand_id = brand);
$$;