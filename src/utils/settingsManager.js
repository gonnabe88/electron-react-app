const { ipcRenderer } = window.require('electron');

// 설정 로드
const loadSettings = async () => {
  try {
    return await ipcRenderer.invoke('load-settings');
  } catch (error) {
    console.error('설정 로드 실패:', error);
    return null;
  }
};

// 설정 저장
const saveSettings = async (settings) => {
  try {
    return await ipcRenderer.invoke('save-settings', settings);
  } catch (error) {
    console.error('설정 저장 실패:', error);
    return false;
  }
};

// 마지막 사용 설정 업데이트
const updateLastUsed = async (url, method, payload) => {
  try {
    return await ipcRenderer.invoke('update-last-used', { url, method, payload });
  } catch (error) {
    console.error('마지막 사용 설정 업데이트 실패:', error);
    return false;
  }
};

// 특정 엔드포인트의 페이로드 가져오기
const getPayload = async (endpoint) => {
  try {
    return await ipcRenderer.invoke('get-payload', endpoint);
  } catch (error) {
    console.error('페이로드 가져오기 실패:', error);
    return {};
  }
};

// 특정 엔드포인트의 페이로드 업데이트
const updatePayload = async (endpoint, payload) => {
  try {
    return await ipcRenderer.invoke('update-payload', { endpoint, payload });
  } catch (error) {
    console.error('페이로드 업데이트 실패:', error);
    return false;
  }
};

// 전체 설정 초기화
const resetSettings = async () => {
  try {
    return await ipcRenderer.invoke('reset-settings');
  } catch (error) {
    console.error('설정 초기화 실패:', error);
    return false;
  }
};

export const settingsManager = {
  loadSettings,
  saveSettings,
  updateLastUsed,
  getPayload,
  updatePayload,
  resetSettings
}; 