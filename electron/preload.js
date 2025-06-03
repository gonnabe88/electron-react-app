const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('Preload 스크립트 실행');

// API 정의
const electronAPI = {
  // 자료수집 관련
  runCollection: (args) => {
    console.log('runCollection 호출:', args);
    return ipcRenderer.invoke('run-collection', args);
  },
  closeCollection: () => {
    console.log('closeCollection 호출');
    return ipcRenderer.invoke('close-collection');
  },
  
  // Playwright 관련
  runPlaywright: (args) => {
    console.log('runPlaywright 호출:', args);
    return ipcRenderer.invoke('run-playwright', args);
  },
  closePlaywright: () => {
    console.log('closePlaywright 호출');
    return ipcRenderer.invoke('close-playwright');
  },
  
  // 파일 시스템 관련
  fs: {
    readFileSync: (filePath, options) => fs.readFileSync(filePath, options),
    writeFileSync: (filePath, data, options) => fs.writeFileSync(filePath, data, options),
    existsSync: (filePath) => fs.existsSync(filePath)
  },
  path: {
    join: (...args) => path.join(...args)
  },
  getAppPath: () => ipcRenderer.invoke('get-app-path')
};

// API 노출
try {
  contextBridge.exposeInMainWorld('electron', electronAPI);
  console.log('electron API 노출 완료');
} catch (error) {
  console.error('electron API 노출 실패:', error);
}