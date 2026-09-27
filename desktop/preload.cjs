const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('openGymDesktop', Object.freeze({
  voiceInfo: () => ipcRenderer.invoke('voice:info'),
  voiceKey: key => ipcRenderer.invoke('voice:key', key),
  voiceForget: () => ipcRenderer.invoke('voice:forget'),
  voiceStart: rate => ipcRenderer.invoke('voice:start', rate),
  voiceStop: () => ipcRenderer.invoke('voice:stop'),
  voiceAudio: (id, bytes) => ipcRenderer.invoke('voice:audio', id, bytes),
  voiceResult: (id, callId, result) => ipcRenderer.invoke('voice:result', id, callId, result),
  onVoice: fn => { const listener = (_event, value) => fn(value); ipcRenderer.on('voice:event', listener); return () => ipcRenderer.removeListener('voice:event', listener) },
  showWidget: () => ipcRenderer.invoke('desktop:widget-show'),
  updateWidget: value => ipcRenderer.invoke('desktop:widget-update', value),
  onWidgetAction: fn => { const listener = (_event, action) => fn(action); ipcRenderer.on('desktop:widget-action', listener); return () => ipcRenderer.removeListener('desktop:widget-action', listener) },
  load: () => ipcRenderer.invoke('desktop:load'),
  save: state => ipcRenderer.invoke('desktop:save', state),
  exportBackup: () => ipcRenderer.invoke('desktop:export'),
  importBackup: () => ipcRenderer.invoke('desktop:import'),
  restoreBackup: state => ipcRenderer.invoke('desktop:restore', state),
  info: () => ipcRenderer.invoke('desktop:info'),
  openDataFolder: () => ipcRenderer.invoke('desktop:folder'),
  mediaStatus: () => ipcRenderer.invoke('desktop:media-status'),
  downloadMedia: () => ipcRenderer.invoke('desktop:media-start'),
  pauseMedia: () => ipcRenderer.invoke('desktop:media-stop'),
  printPlan: html => ipcRenderer.invoke('desktop:print-plan', html),
  onMediaProgress: fn => {
    const listener = (_event, data) => fn(data)
    ipcRenderer.on('desktop:media-progress', listener)
    return () => ipcRenderer.removeListener('desktop:media-progress', listener)
  }
}))
