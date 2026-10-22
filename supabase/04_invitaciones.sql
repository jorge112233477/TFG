-- =====================================================
-- 04_invitaciones.sql
-- Saber si un usuario invitado ya ha elegido su contraseña
-- =====================================================

-- Al invitar a alguien, Supabase crea su usuario al momento,
-- pero no estará activo hasta que elija su contraseña.
alter table perfiles
  add column cuenta_activada boolean not null default false;

-- Los usuarios que ya existían (creados a mano) cuentan como activos
update perfiles set cuenta_activada = true;

-- La llama la página "crear contraseña" cuando el invitado termina.
-- Marca su cuenta como activa y guarda el nombre que ha escrito.
create or replace function public.activar_mi_cuenta(p_nombre text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update perfiles
  set cuenta_activada = true,
      nombre = coalesce(nullif(trim(p_nombre), ''), nombre)
  where id = auth.uid();
end;
$$;