import { supabase } from './supabase.js';

const form = document.getElementById('form-login');
const boton = document.getElementById('boton-entrar');
const mensajeError = document.getElementById('mensaje-error');

// Si ya hay una sesión iniciada, vamos directamente a la página de inicio
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  window.location.href = 'inicio.html';
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // Evita que el formulario recargue la página
  mensajeError.hidden = true;

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    mostrarError('Escribe tu correo y tu contraseña.');
    return;
  }

  boton.disabled = true;
  boton.textContent = 'Entrando...';

  // Pedimos a Supabase que compruebe el correo y la contraseña
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    mostrarError('El correo o la contraseña no son correctos.');
    boton.disabled = false;
    boton.textContent = 'Entrar';
    return;
  }

  window.location.href = 'inicio.html';
});

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}
