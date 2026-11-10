// Aplica el tema guardado antes de pintar para evitar el parpadeo (script externo por la CSP).
// Por defecto el tema es claro; "auto" sigue al sistema y "dark" fuerza el oscuro.
try {
  var t = localStorage.getItem('viaje:theme');
  var root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'light');
}
