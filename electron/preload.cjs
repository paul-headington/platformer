// Runs in the game window before the page loads: gives the game a small, safe bridge
// to the desktop app (window.desktop), so the title screen's EXIT can close it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('quit'),
});
