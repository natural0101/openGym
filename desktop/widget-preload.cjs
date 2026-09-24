const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('gymWidget', Object.freeze({
  get: () => ipcRenderer.invoke('widget:get'),
  action: name => ipcRenderer.invoke('widget:action', name),
  subscribe: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('widget:state', listener); return () => ipcRenderer.removeListener('widget:state', listener) },
}))
