const SETTINGS_FILE = 'settings.json';

class SettingsManager {
  constructor() {
    this.electron = window.electron;
  }

  async getSettingsPath() {
    const userDataPath = await this.electron.getAppPath();
    return this.electron.path.join(userDataPath, SETTINGS_FILE);
  }

  async loadSettings() {
    try {
      const settingsPath = await this.getSettingsPath();
      
      if (!this.electron.fs.existsSync(settingsPath)) {
        return null;
      }

      const data = this.electron.fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('설정 로드 실패:', error);
      return null;
    }
  }

  async saveSettings(settings) {
    try {
      const settingsPath = await this.getSettingsPath();
      this.electron.fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return true;
    } catch (error) {
      console.error('설정 저장 실패:', error);
      return false;
    }
  }

  async resetSettings() {
    try {
      const settingsPath = await this.getSettingsPath();
      if (this.electron.fs.existsSync(settingsPath)) {
        this.electron.fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2));
      }
      return true;
    } catch (error) {
      console.error('설정 초기화 실패:', error);
      return false;
    }
  }
}

export const settingsManager = new SettingsManager(); 