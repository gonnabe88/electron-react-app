// server/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
const { chromium } = require('playwright');

const app = express();
const PORT = 3001;

// 로그 파일 경로
const LOG_FILE = path.join(__dirname, 'server-debug.log');

// Playwright 브라우저 인스턴스 전역 변수
let browser = null;
let context = null;
let page = null;
let isInitialized = false;

// 로그 출력 함수
const logToFile = (message) => {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  process.stdout.write(logMessage);
};

// Playwright 브라우저 초기화 함수
async function initPlaywright() {
  if (!isInitialized) {
    logToFile('🔸 Playwright 브라우저 초기화');
    try {
      // 이전 인스턴스가 있다면 정리
      if (browser) {
        logToFile('🔸 이전 브라우저 인스턴스 정리');
        await closePlaywright();
      }

      browser = await chromium.launch({
        headless: false,
        slowMo: 100,
        args: ['--start-maximized']
      });

      context = await browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // 새 페이지 생성
      page = await context.newPage();
      
      // 페이지 이벤트 리스너 설정
      page.on('console', msg => logToFile(`🔸 브라우저 콘솔: ${msg.text()}`));
      page.on('pageerror', err => logToFile(`❌ 페이지 에러: ${err.message}`));
      page.on('request', req => logToFile(`📤 요청: ${req.method()} ${req.url()}`));
      page.on('response', res => logToFile(`📥 응답: ${res.status()} ${res.url()}`));

      isInitialized = true;
      logToFile('✅ Playwright 브라우저 초기화 완료');
    } catch (err) {
      logToFile(`❌ Playwright 초기화 실패: ${err.message}`);
      throw err;
    }
  }
  return { browser, context, page };
}

// Playwright 브라우저 종료 함수
async function closePlaywright() {
  if (browser) {
    logToFile('🔸 Playwright 브라우저 종료');
    try {
      if (page) {
        await page.close().catch(() => {});
        page = null;
      }
      if (context) {
        await context.close().catch(() => {});
        context = null;
      }
      await browser.close();
      browser = null;
      isInitialized = false;
      logToFile('✅ Playwright 브라우저 종료 완료');
    } catch (err) {
      logToFile(`❌ Playwright 종료 실패: ${err.message}`);
      throw err;
    }
  }
}

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
  const { url1, url2, url5, url6, payload, payload6, requestType } = req.body;
  const log = [];

  try {
    let cookies = null;
    let keyValue = null;

    if (requestType === 'api') {
      // 일반 API 요청 처리
      if (!url2) {
        throw new Error('API URL이 필요합니다.');
      }

      logToFile('🔸 API 요청 시작: ' + url2);
      logToFile('📦 API 요청 payload: ' + JSON.stringify(payload, null, 2));
      log.push(`🔸 API 요청 중: ${url2}`);
      
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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

    } else if (requestType === 'playwright') {
      // Playwright를 사용한 URL5, URL6 요청 처리
      if (!url5 || !url6) {
        throw new Error('URL5와 URL6이 모두 필요합니다.');
      }

      logToFile('🔸 Playwright 브라우저 시작');
      log.push('🔸 Playwright 브라우저 시작');
      
      const { page } = await initPlaywright();

      try {
        // URL5 GET 요청
        logToFile(`🔸 URL5 GET 요청 시작: ${url5}`);
        log.push(`🔸 URL5 GET 요청 시작: ${url5}`);
        
        await page.goto(url5, { 
          waitUntil: 'networkidle',
          timeout: 30000 // 타임아웃 30초로 설정
        });
        const url5Cookies = await context.cookies();
        logToFile(`🔑 URL5 쿠키 획득: ${JSON.stringify(url5Cookies)}`);
        log.push('✅ URL5 요청 완료');

        // URL6 POST 요청
        logToFile(`🔸 URL6 POST 요청 시작: ${url6}`);
        log.push(`🔸 URL6 POST 요청 시작: ${url6}`);
        
        const response = await page.request.post(url6, {
          form: payload6,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        const responseData = await response.text();
        logToFile(`📨 URL6 응답 데이터: ${responseData}`);
        log.push('✅ URL6 요청 완료');

        // 응답 데이터가 JSON인지 확인
        try {
          const jsonData = JSON.parse(responseData);
          logToFile('✅ 응답이 유효한 JSON입니다');
        } catch (e) {
          logToFile('⚠️ 응답이 JSON 형식이 아닙니다');
        }

        // 브라우저 컨텍스트의 모든 쿠키 가져오기
        const finalCookies = await context.cookies();
        const cookieString = finalCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        logToFile('✅ 클라이언트로 응답 전송');
        res.send({
          responseData: responseData,
          requestCookies: cookieString,
          logs: log
        });

      } finally {
        await closePlaywright();
        logToFile('🔸 Playwright 브라우저 종료');
        log.push('🔸 Playwright 브라우저 종료');
      }

    } else if (requestType === 'sso') {
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
      throw new Error('유효하지 않은 요청 타입입니다.');
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

// Playwright 요청 처리 엔드포인트
app.post('/api/playwright', async (req, res) => {
  const { url, payload, step } = req.body;
  const log = [];

  try {
    // 각 단계마다 새로운 페이지 생성
    if (page) {
      logToFile('🔸 이전 페이지 닫기');
      await page.close().catch(() => {});
      page = null;
    }

    const { browser, context } = await initPlaywright();
    if (!browser || !context) {
      throw new Error('Playwright 브라우저가 초기화되지 않았습니다.');
    }

    // 새 페이지 생성
    page = await context.newPage();
    logToFile(`🔸 새 페이지 생성 (${step}단계)`);
    
    // 페이지 이벤트 리스너 설정
    page.on('console', msg => logToFile(`🔸 브라우저 콘솔: ${msg.text()}`));
    page.on('pageerror', err => logToFile(`❌ 페이지 에러: ${err.message}`));
    page.on('request', req => logToFile(`📤 요청: ${req.method()} ${req.url()}`));
    page.on('response', res => logToFile(`📥 응답: ${res.status()} ${res.url()}`));

    logToFile(`🔸 Playwright ${step}단계 요청 시작: ${url}`);
    log.push(`🔸 ${step}단계 요청 시작: ${url}`);

    try {
      // 페이지 이동 전 타임아웃 설정
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);

      // 모든 요청 허용
      await page.route('**/*', async (route) => {
        await route.continue();
      });

      // 페이지 이동 전 준비
      await page.evaluate(() => {
        // 페이지 이동 방지 이벤트 제거
        window.onbeforeunload = null;
        // 모든 팝업 차단 해제
        window.open = (url) => {
          window.location.href = url;
          return null;
        };
      });

      // 페이지 이동 시도
      logToFile(`🔸 페이지 이동 시도: ${url}`);
      await page.goto(url, {
        waitUntil: ['networkidle', 'domcontentloaded', 'load'],
        timeout: 30000
      });

      // 페이지 로드 완료 대기
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        logToFile('⚠️ networkidle 타임아웃, 계속 진행');
      });

      // 페이지가 완전히 로드될 때까지 대기
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        });
      });

      // 페이지 스크롤 처리
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let lastScroll = 0;
          const checkScroll = () => {
            const currentScroll = window.scrollY;
            if (currentScroll === lastScroll) {
              resolve();
            } else {
              lastScroll = currentScroll;
              window.scrollTo(0, document.body.scrollHeight);
              setTimeout(checkScroll, 100);
            }
          };
          checkScroll();
        });
      }).catch(() => {
        logToFile('⚠️ 스크롤 처리 실패, 계속 진행');
      });

      // 최종 URL 확인
      const finalUrl = page.url();
      logToFile(`🔗 최종 URL: ${finalUrl}`);

      // 페이지 내용 가져오기
      const content = await page.content();
      const cookies = await context.cookies();
      
      logToFile(`✅ ${step}단계 요청 완료`);
      log.push(`✅ ${step}단계 요청 완료`);

      res.send({
        success: true,
        data: {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: content,
          currentUrl: finalUrl,
          beforeUrl: url
        },
        logs: log
      });

    } catch (err) {
      logToFile(`❌ 페이지 이동 실패: ${err.message}`);
      throw new Error(`페이지 이동 실패: ${err.message}`);
    }

  } catch (err) {
    logToFile(`❌ Playwright 요청 실패: ${err.message}`);
    res.status(500).send({
      success: false,
      error: err.message,
      logs: log
    });
  }
});

// Playwright 브라우저 종료 엔드포인트
app.post('/api/close-playwright', async (req, res) => {
  try {
    await closePlaywright();
    res.send({ success: true });
  } catch (err) {
    logToFile(`❌ Playwright 종료 실패: ${err.message}`);
    res.status(500).send({ success: false, error: err.message });
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
