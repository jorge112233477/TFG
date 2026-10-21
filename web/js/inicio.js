import { supabase } from './supabase.js';

const nombresRol = {
  coordinador: 'Coordinador',
  profesor: 'Profesor',
  alumno: 'Alumno',
};

const saludo = document.getElementById('saludo');
const datosUsuario = document.getElementById('datos-usuario');

// Comprobamos quién ha iniciado sesión
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  // Nadie ha iniciado sesión: volvemos al login
  window.location.href = 'index.html';
} else {
  // Leemos su perfil y el nombre de su centro
  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('nombre, rol, organizaciones(nombre)')
    .eq('id', user.id)
    .single();

  if (error) {
    saludo.textContent = 'No se ha podido cargar tu perfil.';
    console.error(error);
  } else {
    saludo.textContent = `Hola, ${perfil.nombre}`;
    datosUsuario.textContent = `${nombresRol[perfil.rol]} en ${perfil.organizaciones.nombre}`;
  }
}

// Botón de cerrar sesión
document.getElementById('boton-salir').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});
