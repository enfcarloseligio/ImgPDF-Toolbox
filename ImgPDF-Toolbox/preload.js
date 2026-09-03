const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFiles:      (filters) => ipcRenderer.invoke('select-files', filters),
  selectFolder:     ()        => ipcRenderer.invoke('select-folder'),
  checkTools:       ()        => ipcRenderer.invoke('check-tools'),
  convertImgToPdf:  (opts)    => ipcRenderer.invoke('convert-img-to-pdf', opts),
  convertPdfToImg:  (opts)    => ipcRenderer.invoke('convert-pdf-to-img', opts),
  mergePdfs:        (opts)    => ipcRenderer.invoke('merge-pdfs', opts),
  splitPdf:         (opts)    => ipcRenderer.invoke('split-pdf', opts),
});