// Funciones que usan todas las páginas que necesitan sesión iniciada
import { supabase } from './supabase.js';

export const nombresRol = {
  coordinador: 'Coordinador',
  profesor: 'Profesor',
  alumno: 'Alumno',
};

// Devuelve el perfil del usuario conectado.
// Si no hay nadie conectado, lo manda al login.
export async function obtenerPerfil() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = 'index.html';
    return null;
  }

  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('id, nombre, email, rol, organizacion_id, organizaciones(nombre)')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return perfil;
}

// Cierra la sesión y vuelve al login
export async function cerrarSesion() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}