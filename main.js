const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let dataPath;

// 获取数据存储路径
function getDataPath() {
  if (!dataPath) {
    // 使用 userData 目录存储数据，这是 Electron 应用的标准数据存储位置
    dataPath = path.join('timetracker-data.json');
  }
  return dataPath;
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

// 初始化数据文件
function initDataFile() {
  const filePath = getDataPath();
  if (!fs.existsSync(filePath)) {
    const initialData = {};
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  }
}

// 读取所有数据
function readData() {
  const filePath = getDataPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error reading data:', error);
    return {};
  }
}

// 保存所有数据
function saveData(data) {
  const filePath = getDataPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
}

// 初始化
app.whenReady().then(() => {
  initDataFile();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 关闭窗口时退出应用 (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 处理：读取数据
ipcMain.handle('read-data', () => {
  return readData();
});

// IPC 处理：保存数据
ipcMain.handle('save-data', (event, data) => {
  return saveData(data);
});

// IPC 处理：导出数据到指定路径
ipcMain.handle('export-data', async (event, defaultName) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出时间记录',
    defaultPath: defaultName || 'timetracker-backup.json',
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    const data = readData();
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// IPC 处理：从指定路径导入数据
ipcMain.handle('import-data', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入时间记录',
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const data = fs.readFileSync(result.filePaths[0], 'utf8');
      const parsedData = JSON.parse(data);
      saveData(parsedData);
      return { success: true, data: parsedData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// IPC 处理：获取数据存储路径（供用户参考）
ipcMain.handle('get-data-path', () => {
  return getDataPath();
});