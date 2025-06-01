import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function App() {
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('https://jsonplaceholder.typicode.com/posts');
  const [url3, setUrl3] = useState('');
  const [url4, setUrl4] = useState('');
  const [payload, setPayload] = useState(`{
  "title": "테스트 제목",
  "body": "테스트 내용",
  "userId": 1
}`);
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  const [responseBody, setResponseBody] = useState('');
  const [requestType, setRequestType] = useState('normal'); // 'normal' 또는 'sso'
  const [ssoKey, setSsoKey] = useState(null); // SSO key 값을 저장할 state 추가
  const [requestCookies, setRequestCookies] = useState(null); // request cookie 정보를 저장할 state 추가
  const [isUrl4Request, setIsUrl4Request] = useState(false); // URL4 요청 여부를 저장할 state 추가
  const [sessionKeyStatus, setSessionKeyStatus] = useState(null); // 세션 key 상태를 저장할 state 추가

  const appendLog = (msg) => setLog((prev) => [...prev, msg]);

  const isValidUrl = (url) => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const normalizeUrl = (url) => {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) return 'https://' + url;
    return url;
  };

  const generateSSOPayload = () => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const formatDate = (date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '.');
    };

    return {
      method: 'getHomeHsEventList',
      TARGET_START_DATE: formatDate(oneMonthAgo),
      TARGET_END_DATE: formatDate(yesterday),
      CALENDAR_IDS: '00000000000000000001;00000000000000000002;'
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 공통 상태 초기화
    setLog([]);
    setError('');
    setResponseBody('');
    
    // 요청 타입에 따른 상태 초기화
    if (requestType === 'normal') {
      setSsoKey(null);
      setRequestCookies(null);
      setIsUrl4Request(false);
    }

    if (requestType === 'normal') {
      // URL1, URL2 일반 요청 처리
      const url1Fixed = normalizeUrl(url1);
      const url2Fixed = normalizeUrl(url2);

      if (!isValidUrl(url2Fixed)) {
        setError('❌ URL2가 유효하지 않습니다.');
        appendLog('❌ URL2가 유효하지 않습니다.');
        return;
      }

      if (url1 && !isValidUrl(url1Fixed)) {
        setError('❌ URL1이 유효하지 않습니다.');
        appendLog('❌ URL1이 유효하지 않습니다.');
        return;
      }

      let jsonData = {};
      try {
        jsonData = JSON.parse(payload);
      } catch (err) {
        setError('❌ JSON 형식이 올바르지 않습니다.');
        appendLog('❌ JSON 형식이 올바르지 않습니다.');
        return;
      }

      try {
        if (url1) {
          appendLog(`🔸 URL1 요청 중: ${url1Fixed}`);
        } else {
          appendLog('ℹ️ URL1이 비어있어 SSO 요청을 건너뜁니다.');
        }

        const res = await fetch('http://localhost:3001/api/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url1: url1 ? url1Fixed : '', 
            url2: url2Fixed, 
            payload: jsonData,
            requestType: 'normal'
          }),
        });

        appendLog(`🔸 응답 상태: ${res.status} ${res.statusText}`);
        const data = await res.json();
        appendLog('🔸 응답 데이터 수신 완료');
        
        if (res.ok) {
          appendLog('📨 응답 수신 완료');
          setResponseBody(data.responseData);
          if (data.logs) {
            data.logs.forEach(logMsg => appendLog(logMsg));
          }
        } else {
          appendLog(`❌ 오류 발생: ${data.error}`);
          setError(data.error);
          if (data.logs) {
            data.logs.forEach(logMsg => appendLog(logMsg));
          }
        }
      } catch (err) {
        appendLog(`❌ 요청 실패: ${err.message}`);
        setError(err.message);
      }
    } else {
      // URL3, URL4 SSO 요청 처리
      const url3Fixed = normalizeUrl(url3);
      const url4Fixed = normalizeUrl(url4);

      if (!isValidUrl(url3Fixed) || !isValidUrl(url4Fixed)) {
        setError('❌ URL3와 URL4가 모두 필요하며 유효해야 합니다.');
        appendLog('❌ URL3와 URL4가 모두 필요하며 유효해야 합니다.');
        return;
      }

      const payload = generateSSOPayload();
      appendLog('📦 생성된 payload: ' + JSON.stringify(payload, null, 2));

      try {
        appendLog(`🔸 SSO 요청 중: ${url3Fixed}`);
        setIsUrl4Request(true);
        
        const res = await fetch('http://localhost:3001/api/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url1: url3Fixed,
            url2: url4Fixed,
            payload: payload,
            requestType: 'sso'
          }),
        });

        appendLog(`🔸 응답 상태: ${res.status} ${res.statusText}`);
        const data = await res.json();
        appendLog('🔸 응답 데이터 수신 완료');
        
        if (res.ok) {
          appendLog('📨 응답 수신 완료');
          setResponseBody(data.responseData);
          setSsoKey(data.ssoKey);
          setRequestCookies(data.requestCookies);
          setSessionKeyStatus(data.sessionKeyStatus); // 세션 key 상태 설정
          if (data.logs) {
            data.logs.forEach(logMsg => appendLog(logMsg));
          }
        } else {
          appendLog(`❌ 오류 발생: ${data.error}`);
          setError(data.error);
          if (data.logs) {
            data.logs.forEach(logMsg => appendLog(logMsg));
          }
        }
      } catch (err) {
        appendLog(`❌ 요청 실패: ${err.message}`);
        setError(err.message);
      } finally {
        setIsUrl4Request(false);
      }
    }

    appendLog('✅ 요청 처리 완료');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-800 text-center">API 테스트</h1>

        <div className="flex justify-center">
          <div className="w-[90%]">
            <div className="mb-6 flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => setRequestType('normal')}
                className={`px-4 py-2 rounded-md font-medium ${
                  requestType === 'normal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                일반 API 요청
              </button>
              <button
                type="button"
                onClick={() => setRequestType('sso')}
                className={`px-4 py-2 rounded-md font-medium ${
                  requestType === 'sso'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                SSO API 요청
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              {requestType === 'normal' ? (
                <>
                  <div>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        SSO URL (선택사항)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={url1}
                      onChange={(e) => setUrl1(e.target.value)}
                      placeholder="URL1 입력 (SSO 로그인)"
                      className="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        API URL (필수)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={url2}
                      onChange={(e) => setUrl2(e.target.value)}
                      placeholder="URL2 입력 (데이터 요청)"
                      className="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        요청 데이터 (JSON)
                      </label>
                    </div>
                    <textarea
                      rows={8}
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      placeholder="POST payload (JSON 형식)"
                      className="w-full border border-gray-300 p-3 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        SSO URL (URL3)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={url3}
                      onChange={(e) => setUrl3(e.target.value)}
                      placeholder="SSO 로그인 URL 입력"
                      className="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        API URL (URL4)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={url4}
                      onChange={(e) => setUrl4(e.target.value)}
                      placeholder="API 요청 URL 입력"
                      className="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </>
              )}

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  요청 전송
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <div className="mt-8 space-y-6">
              {isUrl4Request && sessionKeyStatus && (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                  <h2 className="text-lg font-semibold mb-2 text-yellow-800">세션 상태</h2>
                  <div className="text-sm text-yellow-700">
                    <span className="font-medium">세션 Key:</span> {sessionKeyStatus}
                  </div>
                </div>
              )}

              {isUrl4Request && ssoKey && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h2 className="text-lg font-semibold mb-2 text-blue-800">SSO 세션 정보</h2>
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">Key 값:</span> {ssoKey}
                  </div>
                </div>
              )}

              {isUrl4Request && requestCookies && (
                <div className="bg-green-50 p-4 rounded-md border border-green-200">
                  <h2 className="text-lg font-semibold mb-2 text-green-800">요청 쿠키 정보</h2>
                  <div className="text-sm text-green-700">
                    <span className="font-medium">Cookie:</span> {requestCookies}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold mb-3 text-gray-800">요청 로그</h2>
                <div className="bg-gray-50 p-4 rounded-md text-sm whitespace-pre-wrap h-48 overflow-y-auto border border-gray-200">
                  {log.map((line, idx) => <div key={idx} className="py-0.5">{line}</div>)}
                </div>
              </div>

              {responseBody && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-gray-800">응답 본문</h2>
                  <div className="border border-blue-200 p-4 rounded-md bg-white text-sm whitespace-pre-wrap h-48 overflow-y-auto font-mono">
                    {responseBody}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
