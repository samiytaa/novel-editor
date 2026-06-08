import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    icon: path.join(__dirname, 'icon.png'),
    title: '小说编辑器',
    backgroundColor: '#ffffff',
    show: false,
    autoHideMenuBar: true // 自动隐藏菜单栏
  });

  // 完全移除菜单栏
  mainWindow.setMenuBarVisibility(false);

  // 开发环境：加载 Vite 开发服务器
  // 生产环境：加载打包后的 index.html
  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools(); // 开发环境打开开发者工具
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 当页面加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(createWindow);

// 当所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在 macOS 上，点击 dock 图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
