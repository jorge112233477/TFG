import { supabase } from './supabase.js';
import { obtenerPerfil, cerrarSesion, nombresRol } from './sesion.js';

const form = document.getElementById('form-alta');
const botonAlta = document.getElementById('boton-alta');
const mensaje = document.getElementById('mensaje');
const lista = document.getElementById('lista-correos');

document.getElementById('boton-salir').addEventListener('click', cerrarSesion);

// Solo el coordinador puede estar en esta página
const perfil = await obtenerPerfil();

if (perfil && perfil.rol !== 'coordinador') {
  window.location.href = 'inicio.html';
} else if (perfil) {
  form.addEventListener('submit', darDeAlta);
  cargarLista();
}

// ----- Dar de alta un correo -----
async function darDeAlta(evento) {
  evento.preventDefault();

  const inputEmail = document.getElementById('email');
  const email = inputEmail.value.trim().toLowerCase();
  const rol = document.getElementById('rol').value;

  if (!email || !inputEmail.checkValidity()) {
    mostrarMensaje('Escribe un correo válido, por ejemplo nombre@correo.com.', 'error');
    return;
  }

  botonAlta.disabled = true;

  const { error } = await supabase
    .from('correos_autorizados')
    .insert({ email, rol, organizacion_id: perfil.organizacion_id });

  botonAlta.disabled = false;

  if (error) {
    // 23505 = el correo ya existe (clave primaria repetida)
    if (error.code === '23505') {
      mostrarMensaje('Ese correo ya está dado de alta.', 'error');
    } else {
      mostrarMensaje('No se ha podido dar de alta el correo. Inténtalo de nuevo.', 'error');
      console.error(error);
    }
    return;
  }

  mostrarMensaje(`${email} dado de alta como ${nombresRol[rol].toLowerCase()}.`, 'exito');
  form.reset();
  cargarLista();
}

// ----- Mostrar la lista de correos -----
async function cargarLista() {
  const { data: correos, error } = await supabase
    .from('correos_autorizados')
    .select('email, rol, creado_en')
    .order('creado_en', { ascending: false });

   if (error) {
    mostrarMensaje('No se ha podido cargar la lista: ' + error.message, 'error');
    console.error(error);
    return;
  }

  // Para saber quién ya ha creado su cuenta (y poder cambiarle el rol)
  const { data: perfiles } = await supabase.from('perfiles').select('id, email, rol');
  const perfilesPorEmail = new Map((perfiles ?? []).map((p) => [p.email, p]));

  lista.innerHTML = '';

  if (correos.length === 0) {
    const fila = lista.insertRow();
    const celda = fila.insertCell();
    celda.colSpan = 4;
    celda.className = 'vacio';
    celda.textContent = 'Aún no has dado de alta ningún correo. Empieza por el de un profesor.';
    return;
  }

  for (const correo of correos) {
    const perfilUsuario = perfilesPorEmail.get(correo.email);
    const registrado = Boolean(perfilUsuario);
    const fila = lista.insertRow();

    fila.insertCell().textContent = correo.email;

    // Rol: si ya tiene cuenta y no es el coordinador, se puede cambiar
    const celdaRol = fila.insertCell();
    if (registrado && correo.rol !== 'coordinador') {
      celdaRol.appendChild(crearSelectorRol(perfilUsuario));
    } else {
      celdaRol.textContent = nombresRol[correo.rol];
    }

    const celdaEstado = fila.insertCell();
    const estado = document.createElement('span');
    estado.className = registrado ? 'estado estado-ok' : 'estado';
    estado.textContent = registrado ? 'Cuenta creada' : 'Pendiente';
    celdaEstado.appendChild(estado);

    // Solo se pueden quitar los correos que aún no han creado cuenta
    const celdaAccion = fila.insertCell();
    if (!registrado) {
      const botonQuitar = document.createElement('button');
      botonQuitar.className = 'boton-secundario boton-pequeno';
      botonQuitar.textContent = 'Quitar';
      botonQuitar.addEventListener('click', () => quitarCorreo(correo.email));
      celdaAccion.appendChild(botonQuitar);
    }
  }
}

// ----- Selector para cambiar el rol de un usuario -----
function crearSelectorRol(perfilUsuario) {
  const selector = document.createElement('select');
  selector.className = 'select-pequeno';
  selector.setAttribute('aria-label', `Rol de ${perfilUsuario.email}`);

  for (const rol of ['profesor', 'alumno']) {
    const opcion = document.createElement('option');
    opcion.value = rol;
    opcion.textContent = nombresRol[rol];
    opcion.selected = rol === perfilUsuario.rol;
    selector.appendChild(opcion);
  }

  selector.addEventListener('change', () => cambiarRol(perfilUsuario, selector));
  return selector;
}

// ----- Cambiar el rol -----
async function cambiarRol(perfilUsuario, selector) {
  const nuevoRol = selector.value;
  selector.disabled = true;

  // .select() devuelve las filas cambiadas: si está vacío, la seguridad lo ha impedido
  const { data, error } = await supabase
    .from('perfiles')
    .update({ rol: nuevoRol })
    .eq('id', perfilUsuario.id)
    .select();

  selector.disabled = false;

  if (error || data.length === 0) {
    mostrarMensaje('No se ha podido cambiar el rol.', 'error');
    selector.value = perfilUsuario.rol; // volvemos al rol anterior
    if (error) console.error(error);
    return;
  }

  perfilUsuario.rol = nuevoRol;
  mostrarMensaje(`${perfilUsuario.email} ahora es ${nombresRol[nuevoRol].toLowerCase()}.`, 'exito');
}

// ----- Quitar un correo pendiente -----
async function quitarCorreo(email) {
  if (!confirm(`¿Quitar ${email}? Ya no podrá crear su cuenta.`)) return;

  const { error } = await supabase
    .from('correos_autorizados')
    .delete()
    .eq('email', email);

  if (error) {
    mostrarMensaje('No se ha podido quitar el correo.', 'error');
    console.error(error);
    return;
  }

  mostrarMensaje(`${email} quitado.`, 'exito');
  cargarLista();
}

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = tipo;
  mensaje.hidden = false;
}
