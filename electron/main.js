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
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: true
    },
  });

  // Content-Security-Policy 설정
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"]
      }
    });
  });

  const devURL = 'http://localhost:3000';
  const prodPath = path.join(__dirname, '..', 'react-ui', 'dist', 'index.html');

  if (isDev) {
    // 개발 모드에서 CORS 및 보안 정책 설정
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders } });
      }
    );

    mainWindow.loadURL(devURL);
    mainWindow.webContents.openDevTools();
    
    // 로드 상태 모니터링
    mainWindow.webContents.on('did-start-loading', () => {
      console.log('페이지 로딩 시작');
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('페이지 로딩 완료');
      // preload 스크립트가 정상적으로 로드되었는지 확인
      mainWindow.webContents.executeJavaScript(`
        console.log('window.electron 상태:', window.electron ? '로드됨' : '로드되지 않음');
      `);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('페이지 로드 실패:', errorCode, errorDescription);
    });
  } else {
    mainWindow.loadFile(prodPath);
  }

  // preload 스크립트 로드 확인
  console.log('Preload 스크립트 경로:', path.join(__dirname, 'preload.js'));

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

// Playwright 요청 처리
ipcMain.handle('run-playwright', async (event, { url, payload, step }) => {
  try {
    console.log(`Playwright ${step}단계 요청:`, { url, payload });
    
    const response = await fetch('http://localhost:3001/api/collect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, payload, step })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Playwright ${step}단계 응답`);

    return result;
  } catch (error) {
    console.error('Playwright 요청 실패:', error);
    return {
      success: false,
      error: error.message,
      logs: []
    };
  }
});

// Playwright 브라우저 종료
ipcMain.handle('close-playwright', async () => {
  try {
    const response = await fetch('http://localhost:3001/api/collect/close', {
      method: 'POST'
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Playwright 브라우저 종료 실패:', error);
    return false;
  }
});

// 자료수집 요청 처리
ipcMain.handle('run-collection', async (event, { url, payload, step }) => {
  try {
    console.log(`자료수집 ${step}단계 요청:`, { url, payload });
    
    const response = await fetch(url, {
      method: payload ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: payload ? JSON.stringify(payload) : undefined
    });

    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log(`자료수집 ${step}단계 응답:`, data);

    return {
      success: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: data
      }
    };
  } catch (error) {
    console.error('자료수집 요청 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 자료수집 브라우저 종료
ipcMain.handle('close-collection', async () => {
  try {
    // 브라우저 종료 로직 구현
    return true;
  } catch (error) {
    console.error('브라우저 종료 실패:', error);
    return false;
  }
});

// getAppPath 핸들러 추가
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
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
