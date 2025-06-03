import React, { useState, useEffect, useCallback } from 'react';
import { settingsManager } from './utils/settingsManager';
import './App.css';

function App() {
  const [requestType, setRequestType] = useState('holiday');
  const [collectionStep, setCollectionStep] = useState(1);
  const [settings, setSettings] = useState({
    holiday: {
      baseUrl: '',
      method: 'POST',
      endpoint: '',
      payload: '{}',
      headers: {}
    },
    collection: {
      steps: [
        {
          baseUrl: '',
          method: 'GET',
          endpoint: '',
          payload: '{}',
          headers: {}
        },
        {
          baseUrl: '',
          method: 'GET',
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
            holiday: {
              baseUrl: savedSettings.holiday?.baseUrl || '',
              method: savedSettings.holiday?.methods?.holiday || 'POST',
              endpoint: savedSettings.holiday?.endpoints?.holiday || '',
              payload: JSON.stringify(savedSettings.payloads?.holiday || {}, null, 2),
              headers: savedSettings.headers || {}
            },
            collection: {
              steps: [
                {
                  baseUrl: savedSettings.collection?.baseUrls?.step1 || '',
                  method: 'GET',
                  endpoint: savedSettings.holiday?.endpoints?.collection || '',
                  payload: JSON.stringify(savedSettings.payloads?.collection || {}, null, 2),
                  headers: savedSettings.headers || {}
                },
                {
                  baseUrl: savedSettings.collection?.baseUrls?.step2 || '',
                  method: 'GET',
                  endpoint: savedSettings.holiday?.endpoints?.collection2 || '',
                  payload: JSON.stringify(savedSettings.payloads?.collection2 || {}, null, 2),
                  headers: savedSettings.headers || {}
                }
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
      if (type === 'collection' && stepIndex !== null) {
        // Collection 단계별 설정 업데이트
        const updatedSteps = [...prevSettings.collection.steps];
        updatedSteps[stepIndex] = {
          ...updatedSteps[stepIndex],
          [field]: value
        };
        return {
          ...prevSettings,
          collection: {
            ...prevSettings.collection,
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
        holiday: {
          baseUrl: settings.holiday.baseUrl,
          methods: {
            holiday: settings.holiday.method,
            collection: settings.collection.steps[0].method
          },
          endpoints: {
            holiday: settings.holiday.endpoint,
            collection: settings.collection.steps[0].endpoint,
            collection2: settings.collection.steps[1].endpoint
          }
        },
        collection: {
          baseUrls: {
            step1: settings.collection.steps[0].baseUrl,
            step2: settings.collection.steps[1].baseUrl
          }
        },
        payloads: {
          holiday: JSON.parse(settings.holiday.payload),
          collection: JSON.parse(settings.collection.steps[0].payload),
          collection2: JSON.parse(settings.collection.steps[1].payload)
        },
        headers: typeof settings.holiday.headers === 'string' 
          ? JSON.parse(settings.holiday.headers) 
          : settings.holiday.headers
      };

      const success = await settingsManager.saveSettings(updatedSettings);
      if (!success) {
        alert('설정 저장에 실패했습니다.');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        alert('JSON 형식이 올바르지 않습니다. Headers와 Payload를 확인해주세요.');
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
      if (requestType === 'collection') {
        const { steps } = currentSettings;
        const currentStep = steps[0]; // 항상 1단계부터 시작
        const { baseUrl, method, endpoint, payload } = currentStep;
        const url = `${baseUrl}${endpoint}`;
        
        console.log('자료수집 1단계 시작:', { url, method });
        
        try {
          // 1단계 요청 실행 (Playwright 사용)
          console.log('1단계 요청 실행:', url);
          const result = await window.electron.runPlaywright({
            url,
            payload: method !== 'GET' ? JSON.parse(payload) : null,
            step: 1
          });

          if (!result.success) {
            throw new Error(result.error || '1단계 실행 실패');
          }

          // 1단계 응답 처리
          const firstResponse = {
            ...result,
            currentUrl: url,
            step: 1
          };
          setResponse(firstResponse);
          console.log('1단계 응답 처리 완료:', firstResponse);

          // 2단계 URL이 설정되어 있는 경우 자동 실행
          const nextStep = steps[1];
          if (nextStep.baseUrl && nextStep.endpoint) {
            const nextUrl = `${nextStep.baseUrl}${nextStep.endpoint}`;
            console.log('2단계 요청 실행:', nextUrl);
            
            // 상태 업데이트를 강제하기 위해 약간의 지연 추가
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const nextResult = await window.electron.runPlaywright({
              url: nextUrl,
              payload: nextStep.method !== 'GET' ? JSON.parse(nextStep.payload) : null,
              step: 2
            });

            if (!nextResult.success) {
              throw new Error(nextResult.error || '2단계 실행 실패');
            }

            // 2단계 응답 처리
            setCollectionStep(2);
            setResponse({
              ...nextResult,
              currentUrl: nextUrl,
              step: 2
            });
          }
          
          // 성공한 요청의 설정 저장
          await handleSaveSettings();
          
        } catch (err) {
          console.error('자료수집 요청 실패:', err);
          throw new Error(`자료수집 실행 중 오류 발생: ${err.message}`);
        } finally {
          // 브라우저 종료
          await window.electron.closePlaywright().catch(console.error);
        }
      } else {
        // 휴일체크 API 요청 처리
        const { baseUrl, endpoint, method, payload, headers } = currentSettings;
        const url = `${baseUrl}${endpoint}`;
        console.log('요청 시작:', { url, method, requestType });

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
  }, [currentSettings, requestType, handleSaveSettings]);

  // 설정 초기화
  const handleResetSettings = useCallback(async () => {
    if (window.confirm('모든 설정을 초기화하시겠습니까?')) {
      const success = await settingsManager.resetSettings();
      if (success) {
        const savedSettings = await settingsManager.loadSettings();
        if (savedSettings) {
          // 저장된 설정을 현재 상태 형식으로 변환
          const formattedSettings = {
            holiday: {
              baseUrl: savedSettings.holiday?.baseUrl || '',
              method: savedSettings.holiday?.methods?.holiday || 'POST',
              endpoint: savedSettings.holiday?.endpoints?.holiday || '',
              payload: JSON.stringify(savedSettings.payloads?.holiday || {}, null, 2),
              headers: savedSettings.headers || {}
            },
            collection: {
              steps: [
                {
                  baseUrl: savedSettings.collection?.baseUrls?.step1 || '',
                  method: 'GET',
                  endpoint: savedSettings.holiday?.endpoints?.collection || '',
                  payload: JSON.stringify(savedSettings.payloads?.collection || {}, null, 2),
                  headers: savedSettings.headers || {}
                },
                {
                  baseUrl: savedSettings.collection?.baseUrls?.step2 || '',
                  method: 'GET',
                  endpoint: savedSettings.holiday?.endpoints?.collection2 || '',
                  payload: JSON.stringify(savedSettings.payloads?.collection2 || {}, null, 2),
                  headers: savedSettings.headers || {}
                }
              ]
            }
          };
          setSettings(formattedSettings);
        }
      }
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
                value="holiday"
                checked={requestType === 'holiday'}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                disabled={loading}
              />
              <span className="radio-text">휴일체크</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="requestType"
                value="collection"
                checked={requestType === 'collection'}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                disabled={loading}
              />
              <span className="radio-text">자료수집</span>
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="request-form">
          {requestType === 'holiday' && (
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
          )}

          {requestType === 'collection' ? (
            // Collection 단계별 설정
            currentSettings.steps.map((step, index) => (
              <div key={index} className="collection-step">
                <h3>{index + 1}단계 설정{index === 1 && ' (선택)'}</h3>
                <div className="input-group">
                  <label>Base URL:{index === 1 && ' (선택)'}</label>
                  <input
                    type="text"
                    value={step.baseUrl}
                    onChange={(e) => handleSettingChange('collection', 'baseUrl', e.target.value, index)}
                    placeholder={`${index + 1}단계 Base URL 입력 (예: http://localhost:3001)`}
                    required={index === 0}
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <label>Method:{index === 1 && ' (선택)'}</label>
                  <select 
                    value={step.method} 
                    onChange={(e) => handleSettingChange('collection', 'method', e.target.value, index)}
                    disabled={loading}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Endpoint:{index === 1 && ' (선택)'}</label>
                  <input
                    type="text"
                    value={step.endpoint}
                    onChange={(e) => handleSettingChange('collection', 'endpoint', e.target.value, index)}
                    placeholder={`${index + 1}단계 Endpoint 입력`}
                    required={index === 0}
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label>Headers:{index === 1 && ' (선택)'}</label>
                  <textarea
                    value={typeof step.headers === 'string' 
                      ? step.headers 
                      : JSON.stringify(step.headers, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsedHeaders = JSON.parse(e.target.value);
                        handleSettingChange('collection', 'headers', parsedHeaders, index);
                      } catch (err) {
                        handleSettingChange('collection', 'headers', e.target.value, index);
                      }
                    }}
                    placeholder="JSON 형식의 헤더 입력"
                    rows="3"
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label>Payload:{index === 1 && ' (선택)'}</label>
                  <textarea
                    value={step.payload}
                    onChange={(e) => handleSettingChange('collection', 'payload', e.target.value, index)}
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
                  value={typeof currentSettings.headers === 'string' 
                    ? currentSettings.headers 
                    : JSON.stringify(currentSettings.headers, null, 2)}
                  onChange={(e) => {
                    try {
                      // 입력값이 유효한 JSON인지 확인
                      const parsedHeaders = JSON.parse(e.target.value);
                      handleSettingChange(requestType, 'headers', parsedHeaders);
                    } catch (err) {
                      // JSON이 아닌 경우 문자열 그대로 저장
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
              {loading ? '요청 중...' : `요청 보내기`}
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
              <p>Current Step: {collectionStep}</p>
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