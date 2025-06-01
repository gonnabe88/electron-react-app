// server/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3001;

// 로그 파일 경로
const LOG_FILE = path.join(__dirname, 'server-debug.log');

// 로그 출력 함수
const logToFile = (message) => {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  process.stdout.write(logMessage); // 콘솔에도 출력 시도
};

// 시작할 때 로그 파일 초기화
fs.writeFileSync(LOG_FILE, '=== 서버 로그 시작 ===\n');
logToFile('서버 초기화 중...');

// 프로세스 이벤트 핸들러
process.on('SIGTERM', () => {
  logToFile('SIGTERM 시그널 수신. 서버를 정상적으로 종료합니다.');
  process.exit(0);
});

process.on('SIGINT', () => {
  logToFile('SIGINT 시그널 수신. 서버를 정상적으로 종료합니다.');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logToFile('❌ 처리되지 않은 예외 발생: ' + err.message);
  logToFile(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logToFile('❌ 처리되지 않은 Promise 거부: ' + reason);
});

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  logToFile(`📥 요청: ${req.method} ${req.url}`);
  next();
});

app.post('/api/test', async (req, res) => {
  logToFile('📦 요청 본문: ' + JSON.stringify(req.body, null, 2));
  const { url1, url2, payload, requestType } = req.body;
  const log = [];

  try {
    let cookies = null;
    let keyValue = null;

    if (requestType === 'sso') {
      // URL3, URL4 SSO 요청 처리
      if (!url1 || !url2) {
        throw new Error('URL3와 URL4가 모두 필요합니다.');
      }

      // SSO 인증 과정 추적
      logToFile('🔸 SSO 인증 시작: ' + url1);
      log.push(`🔸 SSO 인증 시작: ${url1}`);
      
      let currentUrl = url1;
      let redirectCount = 0;
      let finalCookies = null;
      const maxRedirects = 10; // 최대 리다이렉트 횟수 제한

      while (redirectCount < maxRedirects) {
        logToFile(`🔸 SSO 요청 ${redirectCount + 1}: ${currentUrl}`);
        log.push(`🔸 SSO 요청 ${redirectCount + 1}: ${currentUrl}`);

        const ssoResponse = await fetch(currentUrl, {
          redirect: 'manual', // 리다이렉트를 수동으로 처리
          headers: {
            ...(finalCookies && { 'Cookie': finalCookies }) // 이전 쿠키 전달
          }
        });

        // 응답 쿠키 처리
        const newCookies = ssoResponse.headers.get('set-cookie');
        if (newCookies) {
          logToFile(`🔑 새로운 쿠키 수신: ${newCookies}`);
          log.push(`🔑 새로운 쿠키 수신`);
          
          // 이전 쿠키와 새 쿠키 병합
          if (finalCookies) {
            const cookieMap = new Map();
            // 이전 쿠키 파싱
            finalCookies.split(';').forEach(cookie => {
              const [name] = cookie.trim().split('=');
              if (name) cookieMap.set(name, cookie.trim());
            });
            // 새 쿠키 추가/업데이트
            newCookies.split(';').forEach(cookie => {
              const [name] = cookie.trim().split('=');
              if (name) cookieMap.set(name, cookie.trim());
            });
            finalCookies = Array.from(cookieMap.values()).join('; ');
          } else {
            finalCookies = newCookies;
          }
          logToFile(`🔑 현재 쿠키: ${finalCookies}`);
        }

        // 리다이렉트 확인
        const location = ssoResponse.headers.get('location');
        if (location) {
          logToFile(`🔄 리다이렉트 감지: ${location}`);
          log.push(`🔄 리다이렉트: ${location}`);
          currentUrl = location;
          redirectCount++;
          continue;
        }

        // 최종 응답 확인
        if (ssoResponse.status === 200) {
          logToFile('✅ SSO 인증 완료');
          log.push('✅ SSO 인증 완료');
          break;
        }

        // 예상치 못한 상태 코드
        if (ssoResponse.status !== 302) {
          const errorMsg = `SSO 요청 실패: ${ssoResponse.status} ${ssoResponse.statusText}`;
          logToFile('❌ ' + errorMsg);
          throw new Error(errorMsg);
        }
      }

      if (redirectCount >= maxRedirects) {
        const errorMsg = '최대 리다이렉트 횟수 초과';
        logToFile('❌ ' + errorMsg);
        throw new Error(errorMsg);
      }

      // 최종 쿠키에서 key 값 확인
      let sessionKeyStatus = 'key 쿠키 없음';
      if (finalCookies) {
        const cookieArray = finalCookies.split(';');
        const keyCookie = cookieArray.find(cookie => cookie.trim().startsWith('key='));
        if (keyCookie) {
          const keyValue = keyCookie.trim().split('=')[1];
          sessionKeyStatus = `key=${keyValue}`;
          logToFile(`🔑 최종 세션 key 값: ${keyValue}`);
        }
      }
      log.push(`🔑 세션 상태: ${sessionKeyStatus}`);

      // API 요청 (POST)
      logToFile('🔸 API 요청 시작: ' + url2);
      logToFile('📦 API 요청 payload: ' + JSON.stringify(payload, null, 2));
      log.push(`🔸 API 요청 중: ${url2}`);
      
      let requestOptions = {
        method: 'POST',
        headers: {
          ...(finalCookies && { 'Cookie': finalCookies })
        }
      };

      // x-www-form-urlencoded 형식으로 데이터 변환
      const formData = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, value);
      });
      requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      requestOptions.body = formData.toString();

      // URL4 요청 시 key 쿠키 처리
      if (finalCookies) {
        const cookieArray = finalCookies.split(';');
        const keyCookie = cookieArray.find(cookie => cookie.trim().startsWith('key='));
        
        if (keyCookie) {
          // 기존 key 쿠키 값 유지
          const keyValue = keyCookie.trim().split('=')[1];
          requestOptions.headers['Cookie'] = finalCookies;
          logToFile(`🔑 기존 key 쿠키 값 유지: key=${keyValue}`);
          log.push(`🔑 요청 쿠키: ${finalCookies}`);
        } else {
          // key 쿠키가 없는 경우 새로 추가
          const newCookies = finalCookies + '; key=01AZhF8p2';
          requestOptions.headers['Cookie'] = newCookies;
          keyValue = '01AZhF8p2';
          logToFile('🔑 key 쿠키 추가됨: key=01AZhF8p2');
          log.push(`🔑 요청 쿠키: ${newCookies}`);
        }
      } else {
        // 쿠키가 없는 경우 새로 설정
        requestOptions.headers['Cookie'] = 'key=01AZhF8p2';
        keyValue = '01AZhF8p2';
        logToFile('🔑 새로운 key 쿠키 설정: key=01AZhF8p2');
        log.push('🔑 요청 쿠키: key=01AZhF8p2');
      }

      logToFile('🔧 API 요청 옵션: ' + JSON.stringify(requestOptions, null, 2));

      const apiResponse = await fetch(url2, requestOptions);
      logToFile('📡 API 응답 상태: ' + apiResponse.status);
      logToFile('📡 API 응답 헤더: ' + JSON.stringify(Object.fromEntries(apiResponse.headers.entries()), null, 2));

      if (!apiResponse.ok) {
        const errorMsg = `API 요청 실패: ${apiResponse.status} ${apiResponse.statusText}`;
        logToFile('❌ ' + errorMsg);
        throw new Error(errorMsg);
      }

      const responseData = await apiResponse.text();
      logToFile('📨 API 응답 데이터: ' + responseData);
      log.push('✅ API 요청 성공');

      // 응답 데이터가 JSON인지 확인
      try {
        const jsonData = JSON.parse(responseData);
        logToFile('✅ 응답이 유효한 JSON입니다');
      } catch (e) {
        logToFile('⚠️ 응답이 JSON 형식이 아닙니다');
      }

      logToFile('✅ 클라이언트로 응답 전송');
      res.send({
        responseData: responseData,
        ssoKey: keyValue,
        requestCookies: requestOptions.headers['Cookie'],
        sessionKeyStatus: sessionKeyStatus,
        logs: log
      });

    } else {
      // URL1, URL2 일반 요청 처리
      if (!url2) {
        throw new Error('URL2가 필요합니다.');
      }

      // SSO 요청 수행 (선택사항)
      if (url1) {
        logToFile('🔸 SSO 요청 시작: ' + url1);
        log.push(`🔸 SSO 로그인 요청 중: ${url1}`);
        const ssoResponse = await fetch(url1);
        logToFile('SSO 응답 상태: ' + ssoResponse.status);
        
        if (!ssoResponse.ok) {
          const errorMsg = `SSO 요청 실패: ${ssoResponse.status} ${ssoResponse.statusText}`;
          logToFile('❌ ' + errorMsg);
          throw new Error(errorMsg);
        }

        // SSO 쿠키 추출
        cookies = ssoResponse.headers.get('set-cookie');
        logToFile('🔑 쿠키: ' + (cookies || '없음'));
        log.push('✅ SSO 세션 획득 성공');
      } else {
        logToFile('ℹ️ SSO 요청 건너뜀 (URL1이 비어있음)');
      }

      // API 요청 (POST)
      logToFile('🔸 API 요청 시작: ' + url2);
      logToFile('📦 API 요청 payload: ' + JSON.stringify(payload, null, 2));
      log.push(`🔸 API 요청 중: ${url2}`);
      
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookies && { 'Cookie': cookies })
        },
        body: JSON.stringify(payload)
      };

      logToFile('🔧 API 요청 옵션: ' + JSON.stringify(requestOptions, null, 2));

      const apiResponse = await fetch(url2, requestOptions);
      logToFile('📡 API 응답 상태: ' + apiResponse.status);
      logToFile('📡 API 응답 헤더: ' + JSON.stringify(Object.fromEntries(apiResponse.headers.entries()), null, 2));

      if (!apiResponse.ok) {
        const errorMsg = `API 요청 실패: ${apiResponse.status} ${apiResponse.statusText}`;
        logToFile('❌ ' + errorMsg);
        throw new Error(errorMsg);
      }

      const responseData = await apiResponse.text();
      logToFile('📨 API 응답 데이터: ' + responseData);
      log.push('✅ API 요청 성공');

      // 응답 데이터가 JSON인지 확인
      try {
        const jsonData = JSON.parse(responseData);
        logToFile('✅ 응답이 유효한 JSON입니다');
      } catch (e) {
        logToFile('⚠️ 응답이 JSON 형식이 아닙니다');
      }

      logToFile('✅ 클라이언트로 응답 전송');
      res.send({
        responseData: responseData,
        logs: log
      });
    }

  } catch (error) {
    logToFile('❌ 오류 발생: ' + error.message);
    log.push(`❌ 오류 발생: ${error.message}`);
    res.status(500).send({
      error: error.message,
      logs: log
    });
  }
});

const server = app.listen(PORT, () => {
  logToFile(`✅ 서버 실행 중: http://localhost:${PORT}`);
});

// 서버 종료 함수
function gracefulShutdown() {
  logToFile('서버 종료 중...');
  server.close(() => {
    logToFile('서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });

  // 10초 후에도 종료되지 않으면 강제 종료
  setTimeout(() => {
    logToFile('서버가 10초 내에 종료되지 않아 강제 종료합니다.');
    process.exit(1);
  }, 10000);
}

// 종료 시그널 처리
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
