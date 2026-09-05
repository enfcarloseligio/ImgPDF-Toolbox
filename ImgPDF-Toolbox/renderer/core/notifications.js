// ── core/notifications.js ─────────────────────────────────────────────────────
// Sistema de notificaciones flotantes (toasts).
// Reemplaza alerts nativos y mensajes inline para feedback rápido.

const NOTIFICATION_DURATION = 3500; // ms

// Crear el contenedor de toasts si no existe
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

// type: 'success' | 'error' | 'warning' | 'info'
function showNotification(type, message, duration = NOTIFICATION_DURATION) {
  const container = getToastContainer();

  const icons = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" title="Cerrar">✕</button>`;

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

// Atajos semánticos
const notify = {
  success: (msg, dur) => showNotification('success', msg, dur),
  error:   (msg, dur) => showNotification('error',   msg, dur),
  warning: (msg, dur) => showNotification('warning', msg, dur),
  info:    (msg, dur) => showNotification('info',    msg, dur),
};
