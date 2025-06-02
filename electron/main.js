// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fetch = require('node-fetch');
const isDev = !app.isPackaged;

let mainWindow = null;
let serverProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const devURL = 'http://localhost:5173';
  const prodPath = path.join(__dirname, '..', 'react-ui', 'dist', 'index.html');

  if (isDev) {
    mainWindow.loadURL(devURL);
  } else {
    mainWindow.loadFile(prodPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const serverPath = isDev
    ? path.join(__dirname, '..', 'server', 'server.js')
    : path.join(process.resourcesPath, 'server', 'server.js');

  console.log('서버 시작 중...', serverPath);
  console.log('개발 모드:', isDev);

  // 이전 서버 프로세스가 있다면 종료
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }

  serverProcess = fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' }
  });

  serverProcess.on('error', (err) => {
    console.error('서버 에러:', err);
    setTimeout(startBackend, 3000); // 3초 후 재시작
  });

  serverProcess.on('exit', (code, signal) => {
    console.log('서버 종료. 종료 코드:', code, '시그널:', signal);
    serverProcess = null;
    
    // 비정상 종료인 경우에만 재시작
    if (code !== 0 && code !== null) {
      console.log('서버가 비정상 종료되었습니다. 3초 후 재시작합니다...');
      setTimeout(startBackend, 3000);
    }
  });
}

// IPC 핸들러 등록
ipcMain.handle('run-playwright', async (event, { url, payload, step }) => {
  try {
    const response = await fetch('http://localhost:3001/api/playwright', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, payload, step })
    });

    const result = await response.json();
    return result;
  } catch (err) {
    console.error('Playwright 요청 실패:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('close-playwright', async () => {
  try {
    const response = await fetch('http://localhost:3001/api/close-playwright', {
      method: 'POST'
    });
    const result = await response.json();
    return result.success;
  } catch (err) {
    console.error('Playwright 종료 실패:', err);
    return false;
  }
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
