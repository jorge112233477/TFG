import { obtenerPerfil, cerrarSesion, nombresRol } from './sesion.js';

const saludo = document.getElementById('saludo');
const datosUsuario = document.getElementById('datos-usuario');
const menu = document.getElementById('menu');

document.getElementById('boton-salir').addEventListener('click', cerrarSesion);

const perfil = await obtenerPerfil();

if (!perfil) {
  saludo.textContent = 'No se ha podido cargar tu perfil.';
} else {
  saludo.textContent = `Hola, ${perfil.nombre}`;
  datosUsuario.textContent = `${nombresRol[perfil.rol]} en ${perfil.organizaciones.nombre}`;

  if (perfil.rol === 'coordinador') {
    const enlace = document.createElement('a');
    enlace.href = 'usuarios.html';
    enlace.textContent = 'Gestionar usuarios';
    menu.appendChild(enlace);
  }
}