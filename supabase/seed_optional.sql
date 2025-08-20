-- Datos opcionales de ejemplo
insert into public.brands (name, slug, description, active) values
('Ejemplo', 'ejemplo', 'Marca demo', true) on conflict (slug) do nothing;

-- Productos inactivos (para mostrar estados)
insert into public.products (brand_id, name, price, active) 
select id, 'Remera demo', 10000, false from public.brands where slug='ejemplo' on conflict do nothing;

-- Pedido de ejemplo (para métricas), si existe un usuario y marca
-- (Editar manualmente si querés ver datos reales)