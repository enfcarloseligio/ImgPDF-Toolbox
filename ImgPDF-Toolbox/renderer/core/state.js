// ── core/state.js ─────────────────────────────────────────────────────────────
// Estado global centralizado. Los módulos NUNCA modifican state directamente,
// siempre usan las funciones de mutación expuestas aquí.

const state = {
  activeModule:  null,
  outputDir:     null,
  isProcessing:  false,
  tools: {
    imageMagick: false,
    ghostscript: false,
    imVersion:   '',
    gsVersion:   '',
    winget:      false,
  }
};

// ── Mutaciones ────────────────────────────────────────────────────────────────

function setOutputDir(dir) {
  state.outputDir = dir;
  window.api.storeSet('lastOutputDir', dir);
}

function setProcessing(val) {
  state.isProcessing = val;
  document.querySelectorAll('.card-btn').forEach(btn => {
    btn.style.opacity      = val ? '0.5' : '1';
    btn.style.pointerEvents = val ? 'none' : '';
  });
}

function setTools(tools) {
  state.tools = { ...state.tools, ...tools };
}

function setActiveModule(mod) {
  state.activeModule = mod;
}
