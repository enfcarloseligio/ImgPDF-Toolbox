const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFilePath:           (file)       => webUtils?.getPathForFile ? webUtils.getPathForFile(file) : file.path,
  selectFiles:           (filters)    => ipcRenderer.invoke('select-files', filters),
  selectFolder:          ()           => ipcRenderer.invoke('select-folder'),
  openUrl:               (url)        => ipcRenderer.invoke('open-url', url),
  openFolder:            (dir)        => ipcRenderer.invoke('open-folder', dir),
  playBeep:              ()           => ipcRenderer.invoke('play-beep'),
  cancelOperation:       ()           => ipcRenderer.invoke('cancel-operation'),
  storeGet:              (key)        => ipcRenderer.invoke('store-get', key),
  storeSet:              (key, val)   => ipcRenderer.invoke('store-set', key, val),
  checkTools:            ()           => ipcRenderer.invoke('check-tools'),
  installTool:           (tool)       => ipcRenderer.invoke('install-tool', tool),
  updateTools:           ()           => ipcRenderer.invoke('update-tools'),
  convertImgToPdf:       (opts)       => ipcRenderer.invoke('convert-img-to-pdf', opts),
  convertPdfToImg:       (opts)       => ipcRenderer.invoke('convert-pdf-to-img', opts),
  mergePdfs:             (opts)       => ipcRenderer.invoke('merge-pdfs', opts),
  getPdfInfo:            (file)       => ipcRenderer.invoke('get-pdf-info', file),
  splitPdf:              (opts)       => ipcRenderer.invoke('split-pdf', opts),
  getSystemFonts:        ()           => ipcRenderer.invoke('get-system-fonts'),
  getGoogleFontsCatalog: ()           => ipcRenderer.invoke('get-google-fonts-catalog'),
  downloadGoogleFont:    (opts)       => ipcRenderer.invoke('download-google-font', opts),
  compressPdf:           (opts)       => ipcRenderer.invoke('compress-pdf', opts),
  rotateFiles:           (opts)       => ipcRenderer.invoke('rotate-files', opts),
  watermarkText:         (opts)       => ipcRenderer.invoke('watermark-text', opts),
  unlockPdf:             (opts)       => ipcRenderer.invoke('unlock-pdf', opts),
  // v1.3.0
  applyFolio:            (opts)       => ipcRenderer.invoke('apply-folio', opts),
  watermarkImage:        (opts)       => ipcRenderer.invoke('watermark-image', opts),
  convertPdfStandard:    (opts)       => ipcRenderer.invoke('convert-pdf-standard', opts),
  // ── NUEVO: Progreso de operaciones (main → renderer) ──────────────────────
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('progress', listener);
    return () => ipcRenderer.removeListener('progress', listener);
  },
});