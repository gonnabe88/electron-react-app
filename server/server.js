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

// 다운로드 디렉토리 생성
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR);
}

// 브라우저 인스턴스 전역 변수
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

// 브라우저 초기화 함수
async function initBrowser() {
  if (!isInitialized) {
    logToFile('🔸 자료수집 브라우저 초기화 시작');
    try {
      // 이전 인스턴스가 있다면 정리
      if (browser) {
        logToFile('🔸 이전 브라우저 인스턴스 정리');
        await closeBrowser();
      }

      logToFile('🔸 새 브라우저 인스턴스 생성 시작');
      browser = await chromium.launch({
        headless: false,
        slowMo: 100,
        args: [
          '--start-maximized',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
      logToFile('✅ 브라우저 인스턴스 생성 완료');

      logToFile('🔸 브라우저 컨텍스트 생성 시작');
      context = await browser.newContext({
        viewport: null,
        acceptDownloads: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      logToFile('✅ 브라우저 컨텍스트 생성 완료');

      // 새 페이지 생성
      logToFile('🔸 새 페이지 생성 시작');
      page = await context.newPage();
      logToFile('✅ 새 페이지 생성 완료');
      
      // 페이지 이벤트 리스너 설정
      page.on('console', msg => logToFile(`🔸 브라우저 콘솔: ${msg.text()}`));
      page.on('pageerror', err => logToFile(`❌ 페이지 에러: ${err.message}`));
      page.on('request', req => logToFile(`📤 요청: ${req.method()} ${req.url()}`));
      page.on('response', res => logToFile(`📥 응답: ${res.status()} ${res.url()}`));
      page.on('dialog', dialog => {
        logToFile(`🔸 다이얼로그 감지: ${dialog.type()} - ${dialog.message()}`);
        dialog.accept();
      });

      isInitialized = true;
      logToFile('✅ 자료수집 브라우저 초기화 완료');
    } catch (err) {
      logToFile(`❌ 브라우저 초기화 실패: ${err.message}`);
      logToFile(err.stack);
      throw err;
    }
  } else {
    logToFile('ℹ️ 기존 브라우저 인스턴스 재사용');
  }
  return { browser, context, page };
}

// 브라우저 종료 함수
async function closeBrowser() {
  if (browser) {
    logToFile('🔸 자료수집 브라우저 종료');
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
      logToFile('✅ 자료수집 브라우저 종료 완료');
    } catch (err) {
      logToFile(`❌ 브라우저 종료 실패: ${err.message}`);
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
      
      const { page } = await initBrowser();

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
        await closeBrowser();
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

app.post('/api/collect', async (req, res) => {
  logToFile('📦 자료수집 요청 시작 - 요청 본문: ' + JSON.stringify(req.body, null, 2));
  const { url, payload, step } = req.body;
  const log = [];

  try {
    if (!url) {
      const error = '수집할 URL이 필요합니다.';
      logToFile(`❌ ${error}`);
      return res.status(400).json({
        success: false,
        error,
        logs: log
      });
    }

    logToFile(`🔸 자료수집 ${step}단계 시작`);
    log.push(`🔸 자료수집 ${step}단계 시작`);
    
    let browserInstance;
    try {
      browserInstance = await initBrowser();
      const { page: currentPage } = browserInstance;
      logToFile('✅ 브라우저 인스턴스 획득 완료');

      // URL로 이동
      logToFile(`🔸 페이지 이동 시작: ${url}`);
      log.push(`🔸 페이지 이동: ${url}`);
      
      await currentPage.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      logToFile('✅ 페이지 이동 완료');

      // 1단계인 경우 select 값 설정 및 검색 버튼 클릭
      if (step === 1) {
        logToFile('1단계: select 값 설정 및 검색 버튼 클릭 시작');
        try {
          // docSSyIkdCd select 값 설정
          await currentPage.selectOption('#docSSyIkdCd', 'SR');
          logToFile('docSSyIkdCd 값 설정 완료: SR');

          // docSylId select 값 설정
          await currentPage.selectOption('#docSylId', 'S0051');
          logToFile('docSylId 값 설정 완료: S0051');

          // 검색 버튼 클릭
          await currentPage.click('#search');
          logToFile('검색 버튼 클릭 완료');

          // 검색 결과 로딩 대기
          await currentPage.waitForLoadState('networkidle');
          logToFile('검색 결과 로딩 완료');

          // 다운로드 버튼 클릭
          await currentPage.click('#down');
          logToFile('다운로드 버튼 클릭 완료');

          // 새 창이 열릴 때까지 대기
          const [newPage] = await Promise.all([
            currentPage.context().waitForEvent('page'),
            currentPage.waitForTimeout(1000) // 새 창이 열릴 때까지 잠시 대기
          ]);
          logToFile('새 창 열림 감지');

          // 새 창으로 전환
          await newPage.waitForLoadState('networkidle');
          logToFile('새 창 로딩 완료');

          // title이 "PDF 저장"인 버튼 찾아서 클릭
          const pdfButton = await newPage.locator('button[title="PDF 저장"]');
          if (await pdfButton.count() > 0) {
            const buttonId = await pdfButton.getAttribute('id');
            logToFile('PDF 저장 버튼 ID: ' + buttonId);

            // 다운로드 이벤트 대기
            const downloadPromise = newPage.waitForEvent('download');
            await pdfButton.click();
            logToFile('PDF 저장 버튼 클릭 완료');

            // 다운로드 완료 대기 및 파일 저장
            const download = await downloadPromise;
            logToFile('PDF 다운로드 시작: ' + download.suggestedFilename());
            
            try {
              // 다운로드된 파일 저장 (원본 파일명 그대로 사용)
              await download.saveAs(download.suggestedFilename());
              logToFile('PDF 파일 저장 완료: ' + download.suggestedFilename());

              // 파일 내용을 base64로 변환하여 클라이언트에 전송
              const fileContent = fs.readFileSync(download.suggestedFilename(), { encoding: 'base64' });
              logToFile('파일 내용 base64 인코딩 완료');

              // 새 창 닫기
              await newPage.close();
              logToFile('새 창 닫기 완료');
              
              res.json({
                success: true,
                content: fileContent,
                filename: download.suggestedFilename(),
                logs: log
              });
              logToFile('클라이언트로 응답 전송 완료');
            } catch (error) {
              logToFile('PDF 파일 저장 중 에러: ' + error.message);
              console.error('PDF 파일 저장 중 에러:', error);
              throw error;
            }
          } else {
            throw new Error('PDF 저장 버튼을 찾을 수 없습니다.');
          }
        } catch (error) {
          logToFile('1단계 작업 중 에러: ' + error.message);
          console.error('1단계 작업 중 에러:', error);
          throw error;
        }
      } else {
        // 2단계 또는 기타 처리
        const content = await currentPage.content();
        logToFile('✅ 자료수집 완료');
        log.push('✅ 자료수집 완료');

        res.json({
          success: true,
          content,
          logs: log
        });
      }
    } catch (err) {
      logToFile(`❌ 자료수집 실패: ${err.message}`);
      throw err;
    }
  } catch (err) {
    logToFile(`❌ 오류 발생: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message,
      logs: log
    });
  }
});

// 브라우저 종료 엔드포인트
app.post('/api/collect/close', async (req, res) => {
  try {
    await closeBrowser();
    res.json({ success: true });
  } catch (err) {
    logToFile(`❌ 브라우저 종료 실패: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

const startServer = (port) => {
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        console.log(`[${new Date().toISOString()}] ✅ 서버 실행 중: http://localhost:${port}`);
        resolve(server);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[${new Date().toISOString()}] 포트 ${port}가 사용 중입니다. 다른 포트 시도...`);
          server.close();
          startServer(port + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

// 서버 시작
console.log(`[${new Date().toISOString()}] 서버 초기화 중...`);
startServer(3001).catch(err => {
  console.error(`[${new Date().toISOString()}] ❌ 처리되지 않은 예외 발생:`, err.message);
  process.exit(1);
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
