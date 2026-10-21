-- =====================================================
-- 03_coordinador.sql
-- Un solo coordinador por centro y gestión de roles
-- =====================================================

-- Solo puede haber un coordinador por centro
-- (tanto en los usuarios registrados como en los correos autorizados)
create unique index un_coordinador_por_centro
  on perfiles (organizacion_id)
  where rol = 'coordinador';

create unique index un_coordinador_autorizado_por_centro
  on correos_autorizados (organizacion_id)
  where rol = 'coordinador';

-- El coordinador puede cambiar el rol de los usuarios de su centro
-- (entre profesor y alumno), pero no el suyo propio
create policy "Coordinador cambia roles" on perfiles
  for update to authenticated
  using (
    mi_rol() = 'coordinador'
    and organizacion_id = mi_organizacion()
    and id <> auth.uid()
  )
  with check (
    organizacion_id = mi_organizacion()
    and rol in ('profesor', 'alumno')
  );

-- Cuando cambia el rol de un usuario, se actualiza también
-- en la tabla de correos autorizados para que coincidan
create or replace function public.sincronizar_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update correos_autorizados
  set rol = new.rol
  where email = new.email;
  return new;
end;
$$;

create trigger al_cambiar_rol
after update of rol on perfiles
for each row
when (old.rol is distinct from new.rol)
execute function public.sincronizar_rol();