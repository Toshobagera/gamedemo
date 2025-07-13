// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

// We are not exposing any Node.js features to the renderer process in this app,
// so this file is kept simple. It's a good practice to have it.
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any functions you want to expose to the renderer process here
});
