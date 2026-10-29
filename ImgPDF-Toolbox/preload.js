// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     preload.js
// Descripción: Puente seguro (contextBridge) entre el proceso principal y el renderer.
//              Expone window.api con un wrapper por cada canal IPC y la suscripción a los
//              eventos de progreso emitidos por el proceso principal.
// ═════════════════════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// ── API expuesta al renderer (window.api) ──────────────────────────────────────
// Cada método invoca el canal IPC del mismo nombre registrado en src/.

contextBridge.exposeInMainWorld('api', {
  // Utilidades de archivos y sistema
  getFilePath:           (file)       => webUtils?.getPathForFile ? webUtils.getPathForFile(file) : file.path,
  selectFiles:           (filters)    => ipcRenderer.invoke('select-files', filters),
  selectFolder:          ()           => ipcRenderer.invoke('select-folder'),
  openUrl:               (url)        => ipcRenderer.invoke('open-url', url),
  openFolder:            (dir)        => ipcRenderer.invoke('open-folder', dir),
  playBeep:              ()           => ipcRenderer.invoke('play-beep'),
  cancelOperation:       ()           => ipcRenderer.invoke('cancel-operation'),
  // Persistencia de preferencias
  storeGet:              (key)        => ipcRenderer.invoke('store-get', key),
  storeSet:              (key, val)   => ipcRenderer.invoke('store-set', key, val),
  // Herramientas externas (ImageMagick y Ghostscript)
  checkTools:            ()           => ipcRenderer.invoke('check-tools'),
  installTool:           (tool)       => ipcRenderer.invoke('install-tool', tool),
  checkUpdates:          ()           => ipcRenderer.invoke('check-updates'),
  upgradeTool:           (tool)       => ipcRenderer.invoke('upgrade-tool', tool),
  // Conversión y operaciones sobre PDF
  convertImgToPdf:       (opts)       => ipcRenderer.invoke('convert-img-to-pdf', opts),
  convertPdfToImg:       (opts)       => ipcRenderer.invoke('convert-pdf-to-img', opts),
  mergePdfs:             (opts)       => ipcRenderer.invoke('merge-pdfs', opts),
  getPdfInfo:            (file)       => ipcRenderer.invoke('get-pdf-info', file),
  splitPdf:              (opts)       => ipcRenderer.invoke('split-pdf', opts),
  // Fuentes tipográficas
  getSystemFonts:        ()           => ipcRenderer.invoke('get-system-fonts'),
  getGoogleFontsCatalog: ()           => ipcRenderer.invoke('get-google-fonts-catalog'),
  downloadGoogleFont:    (opts)       => ipcRenderer.invoke('download-google-font', opts),
  // Compresión, rotación, marcas de agua y desbloqueo
  compressPdf:           (opts)       => ipcRenderer.invoke('compress-pdf', opts),
  rotateFiles:           (opts)       => ipcRenderer.invoke('rotate-files', opts),
  watermarkText:         (opts)       => ipcRenderer.invoke('watermark-text', opts),
  unlockPdf:             (opts)       => ipcRenderer.invoke('unlock-pdf', opts),
  // Foliado, marca de agua de imagen y estándares PDF
  applyFolio:            (opts)       => ipcRenderer.invoke('apply-folio', opts),
  watermarkImage:        (opts)       => ipcRenderer.invoke('watermark-image', opts),
  convertPdfStandard:    (opts)       => ipcRenderer.invoke('convert-pdf-standard', opts),

  // Suscripción a los eventos de progreso emitidos por el proceso principal.
  // Devuelve una función que cancela la suscripción.
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('progress', listener);
    return () => ipcRenderer.removeListener('progress', listener);
  },
});