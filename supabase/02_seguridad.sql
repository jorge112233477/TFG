-- =====================================================
-- 02_seguridad.sql
-- Reglas de seguridad (RLS): quién puede ver y hacer qué
-- =====================================================

-- -----------------------------------------------------
-- Funciones de ayuda (para no repetir código en las reglas)
-- -----------------------------------------------------

-- Centro del usuario que ha iniciado sesión
create or replace function public.mi_organizacion()
returns uuid language sql stable security definer set search_path = public as $$
  select organizacion_id from perfiles where id = auth.uid()
$$;

-- Rol del usuario que ha iniciado sesión
create or replace function public.mi_rol()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

-- ¿Soy profesor de esta clase?
create or replace function public.es_profesor_de(p_clase uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clase_profesores
    where clase_id = p_clase and profesor_id = auth.uid()
  )
$$;

-- ¿Soy alumno de esta clase?
create or replace function public.es_alumno_de(p_clase uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clase_alumnos
    where clase_id = p_clase and alumno_id = auth.uid()
  )
$$;

-- ¿Soy coordinador del centro al que pertenece esta clase?
create or replace function public.es_coordinador_de(p_clase uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select mi_rol() = 'coordinador' and exists (
    select 1 from clases
    where id = p_clase and organizacion_id = mi_organizacion()
  )
$$;

-- -----------------------------------------------------
-- ORGANIZACIONES: cada uno ve solo su centro
-- -----------------------------------------------------
create policy "Ver mi centro" on organizaciones
  for select to authenticated
  using (id = mi_organizacion());

-- -----------------------------------------------------
-- PERFILES: se ven los usuarios del mismo centro
-- -----------------------------------------------------
create policy "Ver perfiles de mi centro" on perfiles
  for select to authenticated
  using (organizacion_id = mi_organizacion());

-- -----------------------------------------------------
-- CORREOS AUTORIZADOS: solo el coordinador de ese centro
-- -----------------------------------------------------
create policy "Coordinador gestiona correos" on correos_autorizados
  for all to authenticated
  using (mi_rol() = 'coordinador' and organizacion_id = mi_organizacion())
  with check (mi_rol() = 'coordinador' and organizacion_id = mi_organizacion());

-- -----------------------------------------------------
-- CLASES
-- -----------------------------------------------------
-- El creador de la clase se rellena solo con el usuario actual
alter table clases alter column creado_por set default auth.uid();

-- Ven la clase: su creador, sus profes, sus alumnos y el coordinador
create policy "Ver clases" on clases
  for select to authenticated
  using (
    creado_por = auth.uid()
    or es_profesor_de(id)
    or es_alumno_de(id)
    or (mi_rol() = 'coordinador' and organizacion_id = mi_organizacion())
  );

-- Crean clases los profes y el coordinador, siempre en su centro
create policy "Crear clases" on clases
  for insert to authenticated
  with check (
    organizacion_id = mi_organizacion()
    and mi_rol() in ('profesor', 'coordinador')
    and creado_por = auth.uid()
  );

-- Editan y borran: los profes de la clase y el coordinador
create policy "Editar clases" on clases
  for update to authenticated
  using (es_profesor_de(id) or es_coordinador_de(id))
  with check (organizacion_id = mi_organizacion());

create policy "Borrar clases" on clases
  for delete to authenticated
  using (es_profesor_de(id) or es_coordinador_de(id));

-- Al crear una clase, el profe que la crea pasa a ser profe de ella
create or replace function public.anadir_creador_como_profesor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select rol from perfiles where id = new.creado_por) = 'profesor' then
    insert into clase_profesores (clase_id, profesor_id)
    values (new.id, new.creado_por)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger al_crear_clase
after insert on clases
for each row execute function public.anadir_creador_como_profesor();

-- -----------------------------------------------------
-- CLASE_PROFESORES
-- -----------------------------------------------------
create policy "Ver profes de la clase" on clase_profesores
  for select to authenticated
  using (es_profesor_de(clase_id) or es_alumno_de(clase_id) or es_coordinador_de(clase_id));

-- Añadir profes: el coordinador o un profe de la clase,
-- y solo si el añadido es profesor del mismo centro
create policy "Añadir profes a la clase" on clase_profesores
  for insert to authenticated
  with check (
    (es_coordinador_de(clase_id) or es_profesor_de(clase_id))
    and exists (
      select 1 from perfiles
      where id = profesor_id
        and rol = 'profesor'
        and organizacion_id = mi_organizacion()
    )
  );

create policy "Quitar profes de la clase" on clase_profesores
  for delete to authenticated
  using (es_coordinador_de(clase_id) or es_profesor_de(clase_id));

-- -----------------------------------------------------
-- CLASE_ALUMNOS
-- (los alumnos se unen con la función unirse_a_clase)
-- -----------------------------------------------------
create policy "Ver alumnos de la clase" on clase_alumnos
  for select to authenticated
  using (alumno_id = auth.uid() or es_profesor_de(clase_id) or es_coordinador_de(clase_id));

-- Salen de la clase: el propio alumno, sus profes o el coordinador
create policy "Quitar alumnos de la clase" on clase_alumnos
  for delete to authenticated
  using (alumno_id = auth.uid() or es_profesor_de(clase_id) or es_coordinador_de(clase_id));

-- -----------------------------------------------------
-- HORARIOS: los ve todo el centro, los gestiona el coordinador
-- -----------------------------------------------------
create policy "Ver horarios de mi centro" on horarios
  for select to authenticated
  using (organizacion_id = mi_organizacion());

create policy "Coordinador gestiona horarios" on horarios
  for all to authenticated
  using (mi_rol() = 'coordinador' and organizacion_id = mi_organizacion())
  with check (mi_rol() = 'coordinador' and organizacion_id = mi_organizacion());

-- =====================================================
-- Unirse a una clase con el código de acceso
-- Se llama desde la web: supabase.rpc('unirse_a_clase', { p_codigo: 'ABC123' })
-- =====================================================
create or replace function public.unirse_a_clase(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_clase uuid;
begin
  if mi_rol() is distinct from 'alumno' then
    raise exception 'Solo los alumnos pueden unirse a una clase con código';
  end if;

  select id into v_clase
  from clases
  where codigo_acceso = upper(trim(p_codigo))
    and organizacion_id = mi_organizacion();

  if v_clase is null then
    raise exception 'Código de clase no válido';
  end if;

  insert into clase_alumnos (clase_id, alumno_id)
  values (v_clase, auth.uid())
  on conflict do nothing;

  return v_clase;
end;
$$;