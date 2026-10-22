import { supabase } from './supabase.js';
import { obtenerPerfil, cerrarSesion, nombresRol } from './sesion.js';

const form = document.getElementById('form-alta');
const botonAlta = document.getElementById('boton-alta');
const mensaje = document.getElementById('mensaje');
const lista = document.getElementById('lista-correos');

// Página a la que llevará el enlace del correo de invitación
const URL_CREAR_CONTRASENA = new URL('crear-contrasena.html', window.location.href).href;

document.getElementById('boton-salir').addEventListener('click', cerrarSesion);

// Solo el coordinador puede estar en esta página
const perfil = await obtenerPerfil();

if (perfil && perfil.rol !== 'coordinador') {
  window.location.href = 'inicio.html';
} else if (perfil) {
  form.addEventListener('submit', altaEInvitacion);
  cargarLista();
}

// ----- Dar de alta un correo y enviarle la invitación -----
async function altaEInvitacion(evento) {
  evento.preventDefault();

  const inputEmail = document.getElementById('email');
  const email = inputEmail.value.trim().toLowerCase();
  const rol = document.getElementById('rol').value;

  if (!email || !inputEmail.checkValidity()) {
    mostrarMensaje('Escribe un correo válido, por ejemplo nombre@correo.com.', 'error');
    return;
  }

  botonAlta.disabled = true;
  botonAlta.textContent = 'Enviando...';

  // 1. Autorizar el correo en el centro
  const { error } = await supabase
    .from('correos_autorizados')
    .insert({ email, rol, organizacion_id: perfil.organizacion_id });

  if (error) {
    botonAlta.disabled = false;
    botonAlta.textContent = 'Invitar';
    // 23505 = el correo ya existe (clave primaria repetida)
    if (error.code === '23505') {
      mostrarMensaje('Ese correo ya está en la lista. Si no le llegó, pulsa "Reenviar".', 'error');
    } else {
      mostrarMensaje('No se ha podido dar de alta el correo: ' + error.message, 'error');
    }
    return;
  }

  // 2. Enviar la invitación
  const errorInvitacion = await enviarInvitacion(email);

  botonAlta.disabled = false;
  botonAlta.textContent = 'Invitar';

  if (errorInvitacion) {
    mostrarMensaje(`${email} está dado de alta, pero no se ha podido enviar la invitación: ${errorInvitacion}`, 'error');
  } else {
    mostrarMensaje(`Invitación enviada a ${email}.`, 'exito');
    form.reset();
  }

  cargarLista();
}

// Llama a la Edge Function. Devuelve null si va bien, o el texto del error.
async function enviarInvitacion(email) {
  const { error } = await supabase.functions.invoke('invitar-usuario', {
    body: { email, redirectTo: URL_CREAR_CONTRASENA },
  });

  if (!error) return null;

  // Intentamos leer el mensaje de error que devuelve la función
  try {
    const cuerpo = await error.context.json();
    return cuerpo.error ?? error.message;
  } catch {
    return error.message;
  }
}

// ----- Mostrar la lista -----
async function cargarLista() {
  const { data: correos, error } = await supabase
    .from('correos_autorizados')
    .select('email, rol, creado_en')
    .order('creado_en', { ascending: false });

  if (error) {
    mostrarMensaje('No se ha podido cargar la lista: ' + error.message, 'error');
    return;
  }

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, email, rol, cuenta_activada');
  const perfilesPorEmail = new Map((perfiles ?? []).map((p) => [p.email, p]));

  lista.innerHTML = '';

  if (correos.length === 0) {
    const fila = lista.insertRow();
    const celda = fila.insertCell();
    celda.colSpan = 4;
    celda.className = 'vacio';
    celda.textContent = 'Aún no has invitado a nadie. Empieza por un profesor.';
    return;
  }

  for (const correo of correos) {
    const perfilUsuario = perfilesPorEmail.get(correo.email);
    const fila = lista.insertRow();

    // Correo
    fila.insertCell().textContent = correo.email;

    // Rol (se puede cambiar si ya tiene usuario y no es el coordinador)
    const celdaRol = fila.insertCell();
    if (perfilUsuario && correo.rol !== 'coordinador') {
      celdaRol.appendChild(crearSelectorRol(perfilUsuario));
    } else {
      celdaRol.textContent = nombresRol[correo.rol];
    }

    // Estado
    let textoEstado = 'Sin invitar';
    let claseEstado = 'estado';
    if (perfilUsuario?.cuenta_activada) {
      textoEstado = 'Cuenta activa';
      claseEstado = 'estado estado-ok';
    } else if (perfilUsuario) {
      textoEstado = 'Invitación enviada';
    }
    const estado = document.createElement('span');
    estado.className = claseEstado;
    estado.textContent = textoEstado;
    fila.insertCell().appendChild(estado);

    // Acciones
    const celdaAccion = fila.insertCell();
    celdaAccion.className = 'acciones';
    if (!perfilUsuario?.cuenta_activada && correo.rol !== 'coordinador') {
      celdaAccion.appendChild(
        crearBoton(perfilUsuario ? 'Reenviar' : 'Invitar', () => reenviar(correo.email)),
      );
    }
    if (!perfilUsuario) {
      celdaAccion.appendChild(crearBoton('Quitar', () => quitarCorreo(correo.email)));
    }
  }
}

function crearBoton(texto, alPulsar) {
  const boton = document.createElement('button');
  boton.className = 'boton-secundario boton-pequeno';
  boton.textContent = texto;
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    await alPulsar();
    boton.disabled = false;
  });
  return boton;
}

// ----- Reenviar la invitación -----
async function reenviar(email) {
  mostrarMensaje(`Enviando invitación a ${email}...`, 'exito');
  const errorInvitacion = await enviarInvitacion(email);

  if (errorInvitacion) {
    mostrarMensaje(`No se ha podido enviar la invitación: ${errorInvitacion}`, 'error');
  } else {
    mostrarMensaje(`Invitación enviada a ${email}.`, 'exito');
  }
  cargarLista();
}

// ----- Selector para cambiar el rol -----
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
    selector.value = perfilUsuario.rol;
    return;
  }

  perfilUsuario.rol = nuevoRol;
  mostrarMensaje(`${perfilUsuario.email} ahora es ${nombresRol[nuevoRol].toLowerCase()}.`, 'exito');
}

// ----- Quitar un correo que aún no se ha invitado -----
async function quitarCorreo(email) {
  if (!confirm(`¿Quitar ${email} de la lista?`)) return;

  const { error } = await supabase
    .from('correos_autorizados')
    .delete()
    .eq('email', email);

  if (error) {
    mostrarMensaje('No se ha podido quitar el correo.', 'error');
    return;
  }

  mostrarMensaje(`${email} quitado de la lista.`, 'exito');
  cargarLista();
}

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = tipo;
  mensaje.hidden = false;
}