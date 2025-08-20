-- Habilitar pg_cron y job diario para limpiar soporte (>90 días)
create extension if not exists pg_cron;

-- Funciones de limpieza
create or replace function public.cleanup_support() returns void language plpgsql as $$
begin
  delete from public.support_messages where created_at < now() - interval '90 days';
  update public.support_threads set status='closed' where created_at < now() - interval '90 days' and status <> 'closed';
end; $$;

-- Programar todos los días 03:00 UTC
select cron.schedule('cleanup_support_daily', '0 3 * * *', $$select public.cleanup_support();$$);