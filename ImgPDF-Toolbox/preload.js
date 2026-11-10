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
  // Herramientas de imagen
  getImageInfo:          (file)       => ipcRenderer.invoke('get-image-info', file),
  getImagePreview:       (file)       => ipcRenderer.invoke('get-image-preview', file),
  getImagePixel:         (opts)       => ipcRenderer.invoke('get-image-pixel', opts),
  listImageFormats:      ()           => ipcRenderer.invoke('list-image-formats'),
  convertImages:         (opts)       => ipcRenderer.invoke('convert-images', opts),
  resizeImages:          (opts)       => ipcRenderer.invoke('resize-images', opts),
  compressImages:        (opts)       => ipcRenderer.invoke('compress-images', opts),
  cropImage:             (opts)       => ipcRenderer.invoke('crop-image', opts),
  removeBackground:      (opts)       => ipcRenderer.invoke('remove-background', opts),
  removeBackgroundPreview: (opts)     => ipcRenderer.invoke('remove-background-preview', opts),

  // Testar (cuadros negros con avance guardado)
  redactListSessions:    ()           => ipcRenderer.invoke('redact-list-sessions'),
  redactFindSession:     (opts)       => ipcRenderer.invoke('redact-find-session', opts),
  redactLoadSession:     (opts)       => ipcRenderer.invoke('redact-load-session', opts),
  redactOpen:            (opts)       => ipcRenderer.invoke('redact-open', opts),
  redactSave:            (opts)       => ipcRenderer.invoke('redact-save', opts),
  redactDiscard:         (opts)       => ipcRenderer.invoke('redact-discard', opts),
  redactExport:          (opts)       => ipcRenderer.invoke('redact-export', opts),
  // Vista previa real de marcas y foliado
  previewAnnotation:     (opts)       => ipcRenderer.invoke('preview-annotation', opts),
  signFlow:              (opts)       => ipcRenderer.invoke('sign-flow', opts),
  // Firmar (firmas dibujadas sobre un PDF, con avance guardado)
  signerListSessions:    ()           => ipcRenderer.invoke('signer-list-sessions'),
  signerFindSession:     (opts)       => ipcRenderer.invoke('signer-find-session', opts),
  signerLoadSession:     (opts)       => ipcRenderer.invoke('signer-load-session', opts),
  signerOpen:            (opts)       => ipcRenderer.invoke('signer-open', opts),
  signerSave:            (opts)       => ipcRenderer.invoke('signer-save', opts),
  signerDiscard:         (opts)       => ipcRenderer.invoke('signer-discard', opts),
  signerExport:          (opts)       => ipcRenderer.invoke('signer-export', opts),
  signerVaultStatus:     ()           => ipcRenderer.invoke('signer-vault-status'),
  signerVaultCreate:     (opts)       => ipcRenderer.invoke('signer-vault-create', opts),
  signerVaultUnlock:     (opts)       => ipcRenderer.invoke('signer-vault-unlock', opts),
  signerVaultLock:       ()           => ipcRenderer.invoke('signer-vault-lock'),
  signerVaultReset:      ()           => ipcRenderer.invoke('signer-vault-reset'),
  signerSignaturesList:  ()           => ipcRenderer.invoke('signer-signatures-list'),
  signerSignaturesImages: ()          => ipcRenderer.invoke('signer-signatures-images'),
  signerSignaturesSave:  (opts)       => ipcRenderer.invoke('signer-signatures-save', opts),
  signerSignaturesImport: (opts)      => ipcRenderer.invoke('signer-signatures-import', opts),
  signerSignaturesDelete: (opts)      => ipcRenderer.invoke('signer-signatures-delete', opts),

  // Fuentes tipográficas
  getSystemFonts:        ()           => ipcRenderer.invoke('get-system-fonts'),
  getFontInfo:           (file)       => ipcRenderer.invoke('get-font-info', file),
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