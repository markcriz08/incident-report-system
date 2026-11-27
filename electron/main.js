const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let serverProcess;

function startServer() {
  const { fork } = require('child_process');
  const serverPath = path.join(__dirname, '..', 'server', 'server.js');
  serverProcess = fork(serverPath, [], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PC_DESKTOP: 'true', PORT: '3000' },
    stdio: 'inherit'
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Famy MDRRMO Incident System — PC Control',
    backgroundColor: '#eef2f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.removeMenu();
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL('http://127.0.0.1:3000/index.html');
}

app.whenReady().then(() => {
  startServer();
  setTimeout(createWindow, 1500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
