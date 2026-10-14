const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, isolated Electron print APIs to the React renderer
contextBridge.exposeInMainWorld('electronPrint', {
  print: (title) => ipcRenderer.invoke('splitit:print', title)
});
contextBridge.exposeInMainWorld('electronOAuth', {
  onTokenReceived: (callback) => {
    const handler = (event, tokenHash) => callback(tokenHash);
    ipcRenderer.on('splitit:oauth-token', handler);
    return () => ipcRenderer.removeListener('splitit:oauth-token', handler);
  }
});

contextBridge.exposeInMainWorld('electronFile', {
  saveFile: (content, defaultFilename) => ipcRenderer.invoke('splitit:save-file', { content, defaultFilename }),
  openFile: () => ipcRenderer.invoke('splitit:open-file')
});

// Also expose unified electronAPI for convenient access
contextBridge.exposeInMainWorld('electronAPI', {
  print: (title) => ipcRenderer.invoke('splitit:print', title),
  saveFile: (content, defaultFilename) => ipcRenderer.invoke('splitit:save-file', { content, defaultFilename }),
  openFile: () => ipcRenderer.invoke('splitit:open-file')
});

// Hook window.print inside Electron so any direct call to window.print()
// routes through Electron's native print spooler with printBackground enabled
window.addEventListener('DOMContentLoaded', () => {
  window.print = () => {
    ipcRenderer.invoke('splitit:print', document.title);
  };
});
