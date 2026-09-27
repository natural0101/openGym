const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('openGymDesktop', Object.freeze({
  voiceInfo: () => ipcRenderer.invoke('voice:info'),
  voiceKey: key => ipcRenderer.invoke('voice:key', key),
  voiceForget: () => ipcRenderer.invoke('voice:forget'),
  voiceStart: rate => ipcRenderer.invoke('voice:start', rate),
  voiceRestComplete: (id, cueId) => ipcRenderer.invoke('voice:rest-complete', id, cueId),
  voiceStop: id => ipcRenderer.invoke('voice:stop', id),
  voiceAudio: (id, bytes) => ipcRenderer.invoke('voice:audio', id, bytes),
  voiceResult: (id, callId, result) => ipcRenderer.invoke('voice:result', id, callId, result),
  onVoice: fn => { const listener = (_event, value) => fn(value); ipcRenderer.on('voice:event', listener); return () => ipcRenderer.removeListener('voice:event', listener) },
  showWidget: () => ipcRenderer.invoke('desktop:widget-show'),
  updateWidget: value => ipcRenderer.invoke('desktop:widget-update', value),
  onWidgetAction: fn => { const listener = (_event, action) => fn(action); ipcRenderer.on('desktop:widget-action', listener); return () => ipcRenderer.removeListener('desktop:widget-action', listener) },
  load: () => ipcRenderer.invoke('desktop:load'),
  save: state => ipcRenderer.invoke('desktop:save', state),
  onFlush: fn => {
    const listener = async (_event, id) => {
      try { await fn(); ipcRenderer.send('desktop:flush-result', id, null) }
      catch (error) { ipcRenderer.send('desktop:flush-result', id, error?.message || 'Не удалось сохранить изменения.') }
    }
    ipcRenderer.on('desktop:flush-request', listener)
    return () => ipcRenderer.removeListener('desktop:flush-request', listener)
  },
  exportBackup: () => ipcRenderer.invoke('desktop:export'),
  importBackup: () => ipcRenderer.invoke('desktop:import'),
  restoreBackup: state => ipcRenderer.invoke('desktop:restore', state),
  info: () => ipcRenderer.invoke('desktop:info'),
  motivationInfo: () => ipcRenderer.invoke('desktop:motivation-info'),
  startupConfigure: enabled => ipcRenderer.invoke('desktop:startup-configure', enabled),
  reminderConfigure: patch => ipcRenderer.invoke('desktop:reminder-configure', patch),
  reminderAction: action => ipcRenderer.invoke('desktop:reminder-action', action),
  onMotivationChanged: fn => {
    const listener = () => fn()
    ipcRenderer.on('desktop:motivation-changed', listener)
    return () => ipcRenderer.removeListener('desktop:motivation-changed', listener)
  },
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
