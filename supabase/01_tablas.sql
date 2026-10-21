-- =====================================================
-- 01_tablas.sql
-- Tablas iniciales: centros, usuarios, clases y horarios
-- =====================================================

-- Roles posibles de un usuario
create type rol_usuario as enum ('coordinador', 'profesor', 'alumno');

-- Centros educativos (organizaciones)
create table organizaciones (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

-- Correos que el coordinador da de alta.
-- Solo estos correos pueden registrarse en la app.
create table correos_autorizados (
  email            text primary key check (email = lower(email)),
  rol              rol_usuario not null,
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  creado_en        timestamptz not null default now()
);

-- Datos de cada usuario registrado (enlazado con el login de Supabase)
create table perfiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  nombre           text not null,
  email            text not null unique,
  rol              rol_usuario not null,
  creado_en        timestamptz not null default now()
);

-- Clases (asignaturas). El código de acceso se genera solo.
create table clases (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  nombre           text not null,
  descripcion      text,
  codigo_acceso    text not null unique
                   default upper(substr(md5(random()::text), 1, 6)),
  creado_por       uuid references perfiles(id) on delete set null,
  creado_en        timestamptz not null default now()
);

-- Profesores de cada clase (relación N:M)
create table clase_profesores (
  clase_id     uuid not null references clases(id) on delete cascade,
  profesor_id  uuid not null references perfiles(id) on delete cascade,
  primary key (clase_id, profesor_id)
);

-- Alumnos de cada clase (relación N:M)
create table clase_alumnos (
  clase_id   uuid not null references clases(id) on delete cascade,
  alumno_id  uuid not null references perfiles(id) on delete cascade,
  unido_en   timestamptz not null default now(),
  primary key (clase_id, alumno_id)
);

-- Horarios del centro (los introduce el coordinador)
create table horarios (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  clase_id         uuid references clases(id) on delete cascade,
  profesor_id      uuid references perfiles(id) on delete set null,
  dia_semana       smallint not null check (dia_semana between 1 and 7), -- 1 = lunes
  hora_inicio      time not null,
  hora_fin         time not null,
  aula             text,
  check (hora_fin > hora_inicio)
);

-- Seguridad por filas activada en todas las tablas
-- (las reglas de acceso se añaden en el siguiente script)
alter table organizaciones      enable row level security;
alter table correos_autorizados enable row level security;
alter table perfiles            enable row level security;
alter table clases              enable row level security;
alter table clase_profesores    enable row level security;
alter table clase_alumnos       enable row level security;
alter table horarios            enable row level security;

-- =====================================================
-- Al registrarse un usuario, se le crea su perfil
-- con el rol y el centro que le asignó el coordinador.
-- Si su correo no está autorizado, el registro falla.
-- =====================================================
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  autorizado correos_autorizados%rowtype;
begin
  select * into autorizado
  from correos_autorizados
  where email = lower(new.email);

  if not found then
    raise exception 'Este correo no está autorizado en ningún centro';
  end if;

  insert into perfiles (id, organizacion_id, nombre, email, rol)
  values (
    new.id,
    autorizado.organizacion_id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    lower(new.email),
    autorizado.rol
  );

  return new;
end;
$$;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_perfil_nuevo_usuario();