const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFilePath:     (file)    => webUtils && webUtils.getPathForFile ? webUtils.getPathForFile(file) : file.path,
  selectFiles:     (filters) => ipcRenderer.invoke('select-files', filters),
  selectFolder:    ()        => ipcRenderer.invoke('select-folder'),
  openUrl:         (url)     => ipcRenderer.invoke('open-url', url),
  checkTools:      ()        => ipcRenderer.invoke('check-tools'),
  installTool:     (tool)    => ipcRenderer.invoke('install-tool', tool),
  updateTools:     ()        => ipcRenderer.invoke('update-tools'),
  convertImgToPdf: (opts)    => ipcRenderer.invoke('convert-img-to-pdf', opts),
  convertPdfToImg: (opts)    => ipcRenderer.invoke('convert-pdf-to-img', opts),
  mergePdfs:       (opts)    => ipcRenderer.invoke('merge-pdfs', opts),
  splitPdf:        (opts)    => ipcRenderer.invoke('split-pdf', opts),
  getPdfInfo:      (file)    => ipcRenderer.invoke('get-pdf-info', file),
});