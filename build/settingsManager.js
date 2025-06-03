const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

// 설정 파일 경로
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

console.log('설정 파일 경로:', SETTINGS_PATH);
console.log('개발 모드:', isDev);

// 기본 설정
const defaultSettings = {
  holiday: {
    baseUrl: "http://localhost:3001",
    methods: {
      holiday: "POST",
      collection: "POST"
    },
    endpoints: {
      holiday: "/api/holidays",
      collection: "/api/collect"
    }
  },
  payloads: {
    holiday: {
      year: "2024",
      month: "all"
    },
    collection: {
      url: "https://example.com",
      selector: ".content"
    }
  },
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  lastUsed: {
    url: "",
    method: "",
    payload: {},
    timestamp: new Date().toISOString()
  }
};

// 설정 파일 로드
const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return JSON.parse(data);
    }
    // 설정 파일이 없으면 기본 설정 저장
    saveSettings(defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error('설정 파일 로드 실패:', error);
    return defaultSettings;
  }
};

// 설정 파일 저장
const saveSettings = (settings) => {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('설정 파일 저장 실패:', error);
    return false;
  }
};

// IPC 이벤트 핸들러 등록
function setupSettingsManager() {
  // 설정 로드
  ipcMain.handle('load-settings', () => {
    return loadSettings();
  });

  // 설정 저장
  ipcMain.handle('save-settings', (event, settings) => {
    return saveSettings(settings);
  });

  // 마지막 사용 설정 업데이트
  ipcMain.handle('update-last-used', (event, { url, method, payload }) => {
    const settings = loadSettings();
    settings.lastUsed = {
      url,
      method,
      payload,
      timestamp: new Date().toISOString()
    };
    return saveSettings(settings);
  });

  // 특정 엔드포인트의 페이로드 가져오기
  ipcMain.handle('get-payload', (event, endpoint) => {
    const settings = loadSettings();
    return settings.payloads[endpoint] || {};
  });

  // 특정 엔드포인트의 페이로드 업데이트
  ipcMain.handle('update-payload', (event, { endpoint, payload }) => {
    const settings = loadSettings();
    settings.payloads[endpoint] = payload;
    return saveSettings(settings);
  });

  // 전체 설정 초기화
  ipcMain.handle('reset-settings', () => {
    return saveSettings(defaultSettings);
  });
}

app.on('ready', () => {
  setupSettingsManager();
  createWindow();
});

module.exports = {
  setupSettingsManager,
  loadSettings
}; 