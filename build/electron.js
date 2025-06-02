const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { setupSettingsManager } = require('./settingsManager');
const { chromium } = require('playwright');

let mainWindow;
let playwrightBrowser = null;
let currentPage = null; // 현재 페이지 인스턴스 저장

async function runPlaywrightTest(url, payload, step = 1) {
  console.log(`Playwright 테스트 시작 (${step}단계):`, { url, payload });
  
  try {
    // 이미 실행 중인 브라우저가 있으면 재사용
    if (!playwrightBrowser) {
      playwrightBrowser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('새 브라우저 시작됨');
    }
    
    // 1단계인 경우에만 새 컨텍스트와 페이지 생성
    if (step === 1) {
      const context = await playwrightBrowser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 720 }
      });
      console.log('새 컨텍스트 생성됨');
      
      currentPage = await context.newPage();
      console.log('새 페이지 생성됨');
    } else if (!currentPage) {
      throw new Error('2단계 실행을 위해 먼저 1단계를 실행해주세요.');
    }
    
    // 페이지 로드 (1단계에서만)
    if (step === 1) {
      console.log('페이지 로드 시도:', url);
      await currentPage.goto(url, { waitUntil: 'networkidle' });
      console.log('페이지 로드 완료');
    }
    
    // 페이로드가 있는 경우 요청 실행
    if (payload) {
      console.log(`${step}단계 요청 실행:`, payload);
      const response = await currentPage.evaluate(async (data) => {
        try {
          const res = await fetch(window.location.href, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });
          return {
            status: res.status,
            statusText: res.statusText,
            headers: Object.fromEntries(res.headers.entries()),
            text: await res.text()
          };
        } catch (error) {
          console.error('페이지 내부 에러:', error);
          throw error;
        }
      }, payload);
      
      console.log(`${step}단계 요청 완료:`, response);
      return response;
    }
    
    // GET 요청인 경우 현재 페이지 내용 반환
    console.log(`${step}단계 GET 요청 처리`);
    const content = await currentPage.content();
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: content
    };
  } catch (error) {
    console.error(`Playwright ${step}단계 실행 중 에러:`, error);
    throw error;
  }
}

function createWindow() {
  // 브라우저 창 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // CORS 우회를 위해 webSecurity 비활성화
      allowRunningInsecureContent: true // 필요한 경우 인증서 검증 비활성화
    }
  });

  // 개발 모드에서는 localhost:3000, 프로덕션 모드에서는 build/index.html 로드
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  // 개발 모드에서만 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 브라우저 종료를 위한 IPC 핸들러
ipcMain.handle('close-playwright', async () => {
  if (currentPage) {
    const context = currentPage.context();
    await currentPage.close();
    await context.close();
    currentPage = null;
  }
  if (playwrightBrowser) {
    console.log('브라우저 종료 요청');
    await playwrightBrowser.close();
    playwrightBrowser = null;
    console.log('브라우저 종료 완료');
    return true;
  }
  return false;
});

// Playwright 테스트 실행을 위한 IPC 핸들러
ipcMain.handle('run-playwright', async (event, { url, payload, step }) => {
  console.log('IPC 핸들러 호출됨:', { url, payload, step });
  try {
    const result = await runPlaywrightTest(url, payload, step);
    console.log('Playwright 실행 성공:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('Playwright 실행 실패:', error);
    return { 
      success: false, 
      error: error.message || '알 수 없는 에러가 발생했습니다.',
      stack: error.stack
    };
  }
});

// Electron이 준비되면 창 생성 및 설정 관리자 초기화
app.on('ready', () => {
  createWindow();
  setupSettingsManager();
});

// 앱 종료 시 브라우저도 함께 종료
app.on('window-all-closed', async () => {
  if (playwrightBrowser) {
    await playwrightBrowser.close();
    playwrightBrowser = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS에서 dock 아이콘 클릭 시 창 다시 열기
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
}); 