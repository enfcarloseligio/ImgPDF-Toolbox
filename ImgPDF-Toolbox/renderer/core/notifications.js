// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/notifications.js
// Descripción: Sistema de notificaciones flotantes (toasts) que reemplaza los alert nativos.
//              Atajos: notify.success, notify.error, notify.warning y notify.info.
// ═════════════════════════════════════════════════════════════════════════════

// ── Configuración ───────────────────────────────────────────────────────────

// Tiempo de permanencia de cada notificación, en milisegundos.
const NOTIFICATION_DURATION = 3500;

// ── Contenedor y ciclo de vida de los toasts ────────────────────────────────

// Devuelve el contenedor de toasts, creándolo si aún no existe.
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

// Muestra un toast. type: 'success' | 'error' | 'warning' | 'info'
function showNotification(type, message, duration = NOTIFICATION_DURATION) {
  const container = getToastContainer();

  const icons = {
    success: 'check-circle',
    error:   'x-circle',
    warning: 'alert',
    info:    'info',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icon(icons[type] || 'info', 18)}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" title="Cerrar">${icon('close', 14)}</button>`;

  container.appendChild(toast);

  // Animación de entrada
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  // Cierre manual
  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

  // Cierre automático
  const timer = setTimeout(() => dismissToast(toast), duration);
  toast._timer = timer;

  return toast;
}

function dismissToast(toast) {
  clearTimeout(toast._timer);
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-hiding');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ── Atajos semánticos ───────────────────────────────────────────────────────

const notify = {
  success: (msg, dur) => showNotification('success', msg, dur),
  error:   (msg, dur) => showNotification('error',   msg, dur),
  warning: (msg, dur) => showNotification('warning', msg, dur),
  info:    (msg, dur) => showNotification('info',    msg, dur),
};
