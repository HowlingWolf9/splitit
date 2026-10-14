const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, isolated Electron print APIs to the React renderer
contextBridge.exposeInMainWorld('electronPrint', {
  print: (title) => ipcRenderer.invoke('splitit:print', title)
});

// Expose safe Electron OAuth token listener to the React renderer
contextBridge.exposeInMainWorld('electronOAuth', {
  onTokenReceived: (callback) => {
    const handler = (event, tokenHash) => callback(tokenHash);
    ipcRenderer.on('splitit:oauth-token', handler);
    return () => ipcRenderer.removeListener('splitit:oauth-token', handler);
  }
});

// Hook window.print inside Electron so any direct call to window.print()
// routes through Electron's native print spooler with printBackground enabled
window.addEventListener('DOMContentLoaded', () => {
  window.print = () => {
    ipcRenderer.invoke('splitit:print', document.title);
  };
});
