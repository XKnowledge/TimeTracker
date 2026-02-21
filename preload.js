const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timeTrackerAPI', {
    loadData: () => ipcRenderer.invoke('read-data'),
    saveData: (data) => ipcRenderer.invoke('save-data', data)
});
