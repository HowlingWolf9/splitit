const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, isolated Electron print APIs to the React renderer
contextBridge.exposeInMainWorld('electronPrint', {
  print: (title) => ipcRenderer.invoke('splitit:print', title)
});

// Hook window.print inside Electron so any direct call to window.print()
// routes through Electron's native print spooler with printBackground enabled
window.addEventListener('DOMContentLoaded', () => {
  window.print = () => {
    ipcRenderer.invoke('splitit:print', document.title);
  };
});
