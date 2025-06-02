import React, { useState, useEffect, useCallback } from 'react';
import { settingsManager } from './utils/settingsManager';
import './App.css';

function App() {
  const [requestType, setRequestType] = useState('api');
  const [playwrightStep, setPlaywrightStep] = useState(1);
  const [settings, setSettings] = useState({
    api: {
      baseUrl: '',
      method: 'POST',
      endpoint: '',
      payload: '{}',
      headers: {}
    },
    sso: {
      baseUrl: '',
      method: 'POST',
      endpoint: '',
      payload: '{}',
      headers: {}
    },
    playwright: {
      baseUrl: '',
      steps: [
        {
          method: 'POST',
          endpoint: '',
          payload: '{}',
          headers: {}
        },
        {
          method: 'POST',
          endpoint: '',
          payload: '{}',
          headers: {}
        }
      ]
    }
  });
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 현재 선택된 테스트 타입의 설정을 직접 참조
  const currentSettings = settings[requestType];

  // 컴포넌트 마운트 시 설정 로드
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        const savedSettings = await settingsManager.loadSettings();
        if (savedSettings) {
          // 저장된 설정을 현재 상태 형식으로 변환
          const formattedSettings = {
            api: {
              baseUrl: savedSettings.api.baseUrl || '',
              method: savedSettings.api.methods?.api || 'POST',
              endpoint: savedSettings.api.endpoints?.api || '',
              payload: JSON.stringify(savedSettings.payloads?.api || {}, null, 2),
              headers: savedSettings.headers || {}
            },
            sso: {
              baseUrl: savedSettings.api.baseUrl || '',
              method: savedSettings.api.methods?.sso || 'POST',
              endpoint: savedSettings.api.endpoints?.sso || '',
              payload: JSON.stringify(savedSettings.payloads?.sso || {}, null, 2),
              headers: savedSettings.headers || {}
            },
            playwright: {
              baseUrl: savedSettings.api.baseUrl || '',
              steps: savedSettings.payloads?.playwright?.map(step => ({
                method: step.method || 'POST',
                endpoint: step.endpoint || '',
                payload: JSON.stringify(step.payload || {}, null, 2),
                headers: step.headers || {}
              })) || [
                { method: 'POST', endpoint: '', payload: '{}', headers: {} },
                { method: 'POST', endpoint: '', payload: '{}', headers: {} }
              ]
            }
          };
          setSettings(formattedSettings);
        }
      } catch (error) {
        console.error('설정 로드 실패:', error);
        setError('설정을 불러오는데 실패했습니다.');
      }
    };
    loadAppSettings();
  }, []);

  // 요청 타입 변경
  const handleRequestTypeChange = useCallback((type) => {
    setRequestType(type);
  }, []);

  // 설정 업데이트 핸들러
  const handleSettingChange = useCallback((type, field, value, stepIndex = null) => {
    setSettings(prevSettings => {
      if (type === 'playwright' && stepIndex !== null) {
        // Playwright 단계별 설정 업데이트
        const updatedSteps = [...prevSettings.playwright.steps];
        updatedSteps[stepIndex] = {
          ...updatedSteps[stepIndex],
          [field]: value
        };
        return {
          ...prevSettings,
          playwright: {
            ...prevSettings.playwright,
            steps: updatedSteps
          }
        };
      } else {
        // 일반 설정 업데이트
        return {
          ...prevSettings,
          [type]: {
            ...prevSettings[type],
            [field]: value
          }
        };
      }
    });
  }, []);

  // 현재 설정 저장
  const handleSaveSettings = useCallback(async () => {
    try {
      const updatedSettings = {
        api: {
          baseUrl: settings.api.baseUrl,
          methods: {
            api: settings.api.method,
            sso: settings.sso.method,
            playwright: settings.playwright.steps[0].method
          },
          endpoints: {
            api: settings.api.endpoint,
            sso: settings.sso.endpoint,
            playwright: settings.playwright.steps[0].endpoint,
            playwright2: settings.playwright.steps[1].endpoint
          }
        },
        payloads: {
          api: JSON.parse(settings.api.payload),
          sso: JSON.parse(settings.sso.payload),
          playwright: JSON.parse(settings.playwright.steps[0].payload),
          playwright2: JSON.parse(settings.playwright.steps[1].payload)
        },
        headers: settings.api.headers
      };

      const success = await settingsManager.saveSettings(updatedSettings);
      if (!success) {
        alert('설정 저장에 실패했습니다.');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        alert('페이로드가 유효한 JSON 형식이 아닙니다.');
      } else {
        console.error('설정 저장 실패:', err);
        alert('설정 저장 중 오류가 발생했습니다.');
      }
    }
  }, [settings]);

  // API 요청 실행
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setResponse(null);
    setError(null);
    setLoading(true);

    try {
      if (requestType === 'playwright') {
        const { baseUrl, steps } = currentSettings;
        const currentStep = steps[playwrightStep - 1];
        const { method, endpoint, payload } = currentStep;
        const url = `${baseUrl}${endpoint}`;
        
        console.log('Playwright 요청 처리 시작:', { step: playwrightStep, url, method });
        
        try {
          const { ipcRenderer } = window.require('electron');
          
          // 1단계 요청 실행
          if (playwrightStep === 1) {
            console.log('1단계 요청 실행:', url);
            const result = await ipcRenderer.invoke('run-playwright', {
              url,
              payload: method !== 'GET' ? JSON.parse(payload) : null,
              step: 1
            });

            if (!result.success) {
              throw new Error(result.error || '1단계 실행 실패');
            }

            // 1단계 응답 처리
            const firstResponse = {
              ...result.data,
              currentUrl: url,
              step: 1
            };
            setResponse(firstResponse);
            console.log('1단계 응답 처리 완료:', firstResponse);

            // 2단계 요청 자동 실행
            const nextStep = steps[1];
            const nextUrl = `${baseUrl}${nextStep.endpoint}`;
            console.log('2단계 요청 실행:', nextUrl);
            
            // 상태 업데이트를 강제하기 위해 약간의 지연 추가
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const nextResult = await ipcRenderer.invoke('run-playwright', {
              url: nextUrl,
              payload: nextStep.method !== 'GET' ? JSON.parse(nextStep.payload) : null,
              step: 2
            });

            if (!nextResult.success) {
              throw new Error(nextResult.error || '2단계 실행 실패');
            }

            // 2단계 응답 처리
            setPlaywrightStep(2);
            setResponse({
              ...nextResult.data,
              currentUrl: nextUrl
            });
            
            // 성공한 요청의 설정 저장
            await handleSaveSettings();
          } else {
            // 2단계 직접 실행
            console.log('2단계 직접 실행:', url);
            const result = await ipcRenderer.invoke('run-playwright', {
              url,
              payload: method !== 'GET' ? JSON.parse(payload) : null,
              step: 2
            });

            if (!result.success) {
              throw new Error(result.error || '2단계 실행 실패');
            }

            setResponse({
              ...result.data,
              currentUrl: url
            });
          }
        } catch (err) {
          console.error('Playwright 요청 실패:', err);
          throw new Error(`Playwright 실행 중 오류 발생: ${err.message}`);
        }
      } else {
        // 일반 API 요청 처리
        const { baseUrl, endpoint, method, payload, headers } = currentSettings;
        const url = `${baseUrl}${endpoint}`;
        console.log('요청 시작:', { url, method, requestType, step: playwrightStep });

        const fetchResponse = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: method !== 'GET' ? payload : undefined
        });

        // 응답 타입에 따라 처리
        const contentType = fetchResponse.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
          data = await fetchResponse.json();
        } else {
          data = await fetchResponse.text();
        }

        const response = {
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers: Object.fromEntries(fetchResponse.headers.entries()),
          data: data
        };

        console.log('응답 수신:', response);
        setResponse(response);

        // 성공한 요청의 설정 저장
        if (response.status >= 200 && response.status < 300) {
          await handleSaveSettings();
        }
      }
    } catch (err) {
      console.error('요청 처리 실패:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentSettings, requestType, playwrightStep, handleSaveSettings]);

  // 설정 초기화
  const handleResetSettings = useCallback(async () => {
    if (window.confirm('모든 설정을 초기화하시겠습니까?')) {
      const success = await settingsManager.resetSettings();
      if (success) {
        const savedSettings = await settingsManager.loadSettings();
        if (savedSettings) {
          // 저장된 설정을 현재 상태 형식으로 변환
          const formattedSettings = {
            api: {
              baseUrl: savedSettings.api.baseUrl || '',
              method: savedSettings.api.methods?.api || 'POST',
              endpoint: savedSettings.api.endpoints?.api || '',
              payload: JSON.stringify(savedSettings.payloads?.api || {}, null, 2),
              headers: savedSettings.headers || {}
            },
            sso: {
              baseUrl: savedSettings.api.baseUrl || '',
              method: savedSettings.api.methods?.sso || 'POST',
              endpoint: savedSettings.api.endpoints?.sso || '',
              payload: JSON.stringify(savedSettings.payloads?.sso || {}, null, 2),
              headers: savedSettings.headers || {}
            },
            playwright: {
              baseUrl: savedSettings.api.baseUrl || '',
              steps: savedSettings.payloads?.playwright?.map(step => ({
                method: step.method || 'POST',
                endpoint: step.endpoint || '',
                payload: JSON.stringify(step.payload || {}, null, 2),
                headers: step.headers || {}
              })) || [
                { method: 'POST', endpoint: '', payload: '{}', headers: {} },
                { method: 'POST', endpoint: '', payload: '{}', headers: {} }
              ]
            }
          };
          setSettings(formattedSettings);
        }
      }
    }
  }, []);

  // Playwright 단계 초기화
  const handleResetPlaywrightStep = useCallback(() => {
    setPlaywrightStep(1);
  }, []);

  // Playwright 브라우저 종료
  const handleClosePlaywright = useCallback(async () => {
    try {
      const { ipcRenderer } = window.require('electron');
      const success = await ipcRenderer.invoke('close-playwright');
      if (success) {
        console.log('Playwright 브라우저가 종료되었습니다.');
        setPlaywrightStep(1); // 브라우저 종료 시 단계도 초기화
      }
    } catch (err) {
      console.error('브라우저 종료 실패:', err);
      setError('브라우저 종료 중 오류가 발생했습니다.');
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>API 테스트 앱</h1>
        
        <div className="request-type-selector">
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="requestType"
                value="api"
                checked={requestType === 'api'}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                disabled={loading}
              />
              <span className="radio-text">일반 API 요청</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="requestType"
                value="sso"
                checked={requestType === 'sso'}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                disabled={loading}
              />
              <span className="radio-text">SSO API 요청</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="requestType"
                value="playwright"
                checked={requestType === 'playwright'}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                disabled={loading}
              />
              <span className="radio-text">Playwright 요청</span>
            </label>
          </div>
          {requestType === 'playwright' && (
            <div className="playwright-controls">
              <div className="step-indicator">
                현재 단계: {playwrightStep}단계
              </div>
              <button 
                onClick={handleResetPlaywrightStep}
                className="reset-step-button"
                disabled={loading || playwrightStep === 1}
              >
                단계 초기화
              </button>
              <button 
                onClick={handleClosePlaywright}
                className="close-browser-button"
                disabled={loading}
              >
                브라우저 종료
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="request-form">
          <div className="input-group">
            <label>Base URL:</label>
            <input
              type="text"
              value={currentSettings.baseUrl}
              onChange={(e) => handleSettingChange(requestType, 'baseUrl', e.target.value)}
              placeholder="Base URL 입력 (예: http://localhost:3001)"
              required
              disabled={loading}
            />
          </div>

          {requestType === 'playwright' ? (
            // Playwright 단계별 설정
            currentSettings.steps.map((step, index) => (
              <div key={index} className="playwright-step">
                <h3>{index + 1}단계 설정</h3>
                <div className="input-group">
                  <label>Method:</label>
                  <select 
                    value={step.method} 
                    onChange={(e) => handleSettingChange('playwright', 'method', e.target.value, index)}
                    disabled={loading}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Endpoint:</label>
                  <input
                    type="text"
                    value={step.endpoint}
                    onChange={(e) => handleSettingChange('playwright', 'endpoint', e.target.value, index)}
                    placeholder={`${index + 1}단계 Endpoint 입력`}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label>Headers:</label>
                  <textarea
                    value={JSON.stringify(step.headers, null, 2)}
                    onChange={(e) => {
                      try {
                        const newHeaders = JSON.parse(e.target.value);
                        handleSettingChange('playwright', 'headers', newHeaders, index);
                      } catch (err) {
                        handleSettingChange('playwright', 'headers', e.target.value, index);
                      }
                    }}
                    placeholder="JSON 형식의 헤더 입력"
                    rows="3"
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label>Payload:</label>
                  <textarea
                    value={step.payload}
                    onChange={(e) => handleSettingChange('playwright', 'payload', e.target.value, index)}
                    placeholder="JSON 형식의 페이로드 입력"
                    rows="5"
                    disabled={loading}
                  />
                </div>
              </div>
            ))
          ) : (
            // 일반 API 설정
            <>
              <div className="input-group">
                <label>Method:</label>
                <select 
                  value={currentSettings.method} 
                  onChange={(e) => handleSettingChange(requestType, 'method', e.target.value)}
                  disabled={loading}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div className="input-group">
                <label>Endpoint:</label>
                <input
                  type="text"
                  value={currentSettings.endpoint}
                  onChange={(e) => handleSettingChange(requestType, 'endpoint', e.target.value)}
                  placeholder="Endpoint 입력"
                  required
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label>Headers:</label>
                <textarea
                  value={JSON.stringify(currentSettings.headers, null, 2)}
                  onChange={(e) => {
                    try {
                      const newHeaders = JSON.parse(e.target.value);
                      handleSettingChange(requestType, 'headers', newHeaders);
                    } catch (err) {
                      handleSettingChange(requestType, 'headers', e.target.value);
                    }
                  }}
                  placeholder="JSON 형식의 헤더 입력"
                  rows="3"
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label>Payload:</label>
                <textarea
                  value={currentSettings.payload}
                  onChange={(e) => handleSettingChange(requestType, 'payload', e.target.value)}
                  placeholder="JSON 형식의 페이로드 입력"
                  rows="5"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="button-group">
            <button type="submit" disabled={loading}>
              {loading ? '요청 중...' : `요청 보내기 (${requestType === 'playwright' ? `${playwrightStep}단계` : ''})`}
            </button>
            <button 
              type="button" 
              onClick={handleSaveSettings}
              disabled={loading}
            >
              현재 설정 저장
            </button>
            <button 
              type="button" 
              onClick={handleResetSettings}
              disabled={loading}
            >
              설정 초기화
            </button>
          </div>
        </form>

        {error && (
          <div className="error-message">
            <h3>에러 발생:</h3>
            <pre>{error}</pre>
          </div>
        )}

        {response && (
          <div className="response-section">
            <h3>응답 결과:</h3>
            <div className="response-info">
              <p>Status: {response.status} {response.statusText}</p>
              <p>Current URL: {response.currentUrl}</p>
              <p>Current Step: {playwrightStep}</p>
              <h4>Headers:</h4>
              <pre className="response-headers">
                {JSON.stringify(response.headers, null, 2)}
              </pre>
            </div>
            <h4>Body:</h4>
            <pre className="response-data">
              {typeof response.data === 'string' 
                ? response.data 
                : JSON.stringify(response.data, null, 2)}
            </pre>
          </div>
        )}
      </header>
    </div>
  );
}

export default App; 