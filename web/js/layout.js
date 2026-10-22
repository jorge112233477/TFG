// Cabecera común: logo, menú de secciones y usuario conectado.
import { cerrarSesion, nombresRol } from './sesion.js';

// Secciones del menú. "roles" indica quién ve cada una.
const SECCIONES = [
  { id: 'inicio', texto: 'Inicio', url: 'inicio.html', roles: ['coordinador', 'profesor', 'alumno'] },
  { id: 'usuarios', texto: 'Usuarios', url: 'usuarios.html', roles: ['coordinador'] },
];

export function montarCabecera(perfil, paginaActual) {
  const cabecera = document.getElementById('cabecera');

  cabecera.innerHTML = `
    <a href="inicio.html" class="logo" aria-label="Classroom IA, ir al inicio">
      <img src="img/logo.svg" alt="" width="36" height="36">
      <span class="logo-texto">Classroom</span><span class="logo-ia">IA</span>
    </a>
    <nav class="navegacion" aria-label="Secciones"></nav>
    <div class="usuario">
      <span class="usuario-nombre"></span>
      <button type="button" class="boton-secundario boton-pequeno" id="boton-salir">Cerrar sesión</button>
    </div>
  `;

  // Enlaces del menú según el rol
  const nav = cabecera.querySelector('.navegacion');
  for (const seccion of SECCIONES) {
    if (!seccion.roles.includes(perfil.rol)) continue;
    const enlace = document.createElement('a');
    enlace.href = seccion.url;
    enlace.textContent = seccion.texto;
    if (seccion.id === paginaActual) enlace.setAttribute('aria-current', 'page');
    nav.appendChild(enlace);
  }

  cabecera.querySelector('.usuario-nombre').textContent =
    `${perfil.nombre} · ${nombresRol[perfil.rol]}`;
  cabecera.querySelector('#boton-salir').addEventListener('click', cerrarSesion);
}