import { supabase } from './supabase.js';

const subtitulo = document.getElementById('subtitulo');
const form = document.getElementById('form-contrasena');
const boton = document.getElementById('boton-guardar');
const mensajeError = document.getElementById('mensaje-error');

// Al abrir el enlace del correo, Supabase inicia la sesión
// automáticamente con los datos que vienen en la dirección
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  subtitulo.textContent =
    'El enlace no es válido o ha caducado. Pide a tu coordinador que te reenvíe la invitación.';
} else {
  subtitulo.textContent = `Elige la contraseña con la que entrarás como ${session.user.email}.`;
  form.hidden = false;
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensajeError.hidden = true;

  const nombre = document.getElementById('nombre').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;

  if (!nombre) {
    return mostrarError('Escribe tu nombre.');
  }
  if (password.length < 8) {
    return mostrarError('La contraseña tiene que tener al menos 8 caracteres.');
  }
  if (password !== password2) {
    return mostrarError('Las dos contraseñas no coinciden.');
  }

  boton.disabled = true;
  boton.textContent = 'Activando...';

  // 1. Guardar la contraseña
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    boton.disabled = false;
    boton.textContent = 'Activar mi cuenta';
    return mostrarError('No se ha podido guardar la contraseña. Prueba con otra más segura.');
  }

  // 2. Marcar la cuenta como activa y guardar el nombre
  await supabase.rpc('activar_mi_cuenta', { p_nombre: nombre });

  window.location.href = 'inicio.html';
});

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}