const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Archivos y sistema
  getFilePath:     (file)    => webUtils?.getPathForFile ? webUtils.getPathForFile(file) : file.path,
  selectFiles:     (filters) => ipcRenderer.invoke('select-files', filters),
  selectFolder:    ()        => ipcRenderer.invoke('select-folder'),
  openUrl:         (url)     => ipcRenderer.invoke('open-url', url),
  openFolder:      (dir)     => ipcRenderer.invoke('open-folder', dir),
  playBeep:        ()        => ipcRenderer.invoke('play-beep'),
  cancelOperation: ()        => ipcRenderer.invoke('cancel-operation'),

  // Persistencia (reemplaza localStorage)
  storeGet:        (key)        => ipcRenderer.invoke('store-get', key),
  storeSet:        (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Herramientas
  checkTools:      ()       => ipcRenderer.invoke('check-tools'),
  installTool:     (tool)   => ipcRenderer.invoke('install-tool', tool),
  updateTools:     ()       => ipcRenderer.invoke('update-tools'),

  // Conversiones
  convertImgToPdf: (opts)   => ipcRenderer.invoke('convert-img-to-pdf', opts),
  convertPdfToImg: (opts)   => ipcRenderer.invoke('convert-pdf-to-img', opts),
  mergePdfs:       (opts)   => ipcRenderer.invoke('merge-pdfs', opts),
  getPdfInfo:      (file)   => ipcRenderer.invoke('get-pdf-info', file),
  splitPdf:        (opts)   => ipcRenderer.invoke('split-pdf', opts),
});
