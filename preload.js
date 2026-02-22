const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timeTrackerAPI', {
    // 读取所有数据
    loadData: () => ipcRenderer.invoke('read-data'),
    // 保存所有数据
    saveData: (data) => ipcRenderer.invoke('save-data', data),
    // 导出数据到文件
    exportData: (defaultName) => ipcRenderer.invoke('export-data', defaultName),
    // 从文件导入数据
    importData: () => ipcRenderer.invoke('import-data'),
    // 获取数据存储路径
    getDataPath: () => ipcRenderer.invoke('get-data-path'),
    // 窗口控制
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window')
});
