import { obtenerPerfil, nombresRol } from './sesion.js';
import { montarCabecera } from './layout.js';

const saludo = document.getElementById('saludo');
const datosUsuario = document.getElementById('datos-usuario');
const menu = document.getElementById('menu');

const perfil = await obtenerPerfil();

if (!perfil) {
  saludo.textContent = 'No se ha podido cargar tu perfil.';
} else {
  montarCabecera(perfil, 'inicio');

  saludo.textContent = `Hola, ${perfil.nombre}`;
  datosUsuario.textContent = `${nombresRol[perfil.rol]} en ${perfil.organizaciones.nombre}`;

  // Accesos directos que solo ve el coordinador
  if (perfil.rol === 'coordinador') {
    anadirAcceso('usuarios.html', 'Gestionar usuarios');
  }
}

function anadirAcceso(url, texto) {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.textContent = texto;
  menu.appendChild(enlace);
}