const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// 创建主窗口
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

// 初始化记录文件
function initRecordsFile() {
  const recordsPath = path.join(__dirname, 'records.json');
  
  if (!fs.existsSync(recordsPath)) {
    // 创建初始记录文件
    const initialData = {
      records: [],
      currentDate: new Date().toISOString().split('T')[0] // 当前日期 YYYY-MM-DD
    };
    
    fs.writeFileSync(recordsPath, JSON.stringify(initialData, null, 2));
  }
}

// 读取记录
function readRecords() {
  const recordsPath = path.join(__dirname, 'records.json');
  
  try {
    const data = fs.readFileSync(recordsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading records:', error);
    return { records: [], currentDate: new Date().toISOString().split('T')[0] };
  }
}

// 保存记录
function saveRecords(records) {
  const recordsPath = path.join(__dirname, 'records.json');
  fs.writeFileSync(recordsPath, JSON.stringify(records, null, 2));
}

// 初始化
app.whenReady().then(() => {
  initRecordsFile();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 处理保存事件
ipcMain.on('save-record', (event, newRecord) => {
  const records = readRecords();
  records.records.push(newRecord);
  saveRecords(records);
  
  // 发送更新后的记录到渲染进程
  event.sender.send('records-updated', records);
});

// 处理获取当前日期
ipcMain.on('get-current-date', (event) => {
  const records = readRecords();
  event.sender.send('current-date', records.currentDate);
});