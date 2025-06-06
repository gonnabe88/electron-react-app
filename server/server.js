// server/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
const { chromium } = require('playwright');

const app = express();
const PORT = 3001;

let server = null;

let itsmCnt1 = 0;
let itsmCnt2 = 0;
let itsmCnt3 = 0;
let itsmCnt4 = 0;
let biCnt = 0;

const itsmResult1 = (itsmCnt1, itsmCnt2) => {
  return  ` - 운영계 이관 신청건 : ${itsmCnt1}건
    - 근무시간외 긴급대응건 : ${itsmCnt2}건
    - 기타 특이사항 없음`
  };

const itsmResult2 = (itsmCnt3, itsmCnt4) => {
  return  ` - DB 데이터 수정 신청건 : ${itsmCnt3}건
    - 근무시간외 긴급대응건 : ${itsmCnt3}건
    - 정당성, 승인권자 결재 및 전후내역 생성 확인 了`
  };

const biResult = (biCnt) => {
  return  ` - 잔액대사 오류건 : ${biCnt}건
    - 원장잔액대사 차이 일치 여부, 불일치 사유 및 조치내역(계획) 확인 了`
  };

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
let staDate = null;

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
        headless: true,
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

async function biportalCollect (log, url, currentPage, filename) {
  
  // URL로 이동
  logToFile(`🔸 페이지 이동 시작: ${url}`);
  log.push(`🔸 페이지 이동: ${url}`);
  
  await currentPage.goto(url, { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  logToFile('✅ 페이지 이동 완료');

  // 2단계 또는 기타 처리

  const searchInput = await currentPage.locator('#searchWord');
  await searchInput.fill('일일잔액대사');        

  // 새 창이 열릴 때까지 대기
  const [newPage] = await Promise.all([
    currentPage.context().waitForEvent('page'),
    await currentPage.click('#searchBtn')
  ]);
  logToFile('새 창 열림 감지');

  // 새 창으로 전환
  await newPage.waitForLoadState('networkidle');
  logToFile('새 창 로딩 완료(검색 결과)');

  const detailPage = await newPage.locator('a[onclick="pageFunc.datAnlDtl(\'BIIBG857R1\')"]');

  // 새 창이 열릴 때까지 대기
  const [newPage2] = await Promise.all([
    newPage.context().waitForEvent('page'),
    await detailPage.click()
  ]);
  logToFile('새 창 열림 감지');

  // 새 창으로 전환
  await newPage2.waitForLoadState('networkidle');
  logToFile('새 창 로딩 완료(EDW일일잔액대사 일보)');        

  staDate = await newPage2.inputValue('#BSE_DT');
  logToFile(`기준일자 : ${staDate}`);

  // 새 창이 열릴 때까지 대기
  const [newPage3] = await Promise.all([
    newPage2.context().waitForEvent('page'),
    await newPage2.click('#btnSY')
  ]);
  logToFile('새 창 열림 감지');

  // 새 창으로 전환
  await newPage3.waitForLoadState('domcontentloaded');
  await newPage3.waitForLoadState('networkidle');
  await newPage3.waitForTimeout(2000);
  logToFile('새 창 로딩 완료(EDW일일잔액대사 일보 상세)');

  
  const checkLoadingClass = async () => {
    return new Promise((resolve) => {
      const checkLoading = setInterval(async () => {
        try {
          // iframe 존재 확인
          let iframe = await newPage3.$('iframe');
          logToFile(`iframe 요소 존재: ${iframe ? '있음' : '없음'}`);
          
          if (!iframe) {
            logToFile('iframe을 찾을 수 없습니다.');
            clearInterval(checkLoading);
            resolve(false);
            return;
          }

          // iframe contentFrame 접근
          let iframeDoc = await iframe.contentFrame();
          logToFile(`iframe contentFrame 접근: ${iframeDoc ? '성공' : '실패'}`);
          
          if (!iframeDoc) {
            logToFile('iframe contentFrame에 접근할 수 없습니다.');
            clearInterval(checkLoading);
            resolve(false);
            return;
          }

          // iframe 내부 HTML 확인
          const iframeContent = await iframeDoc.content();
          logToFile(`iframe 내부 HTML: ${iframeContent}`);

          // report_progress 클래스 요소 찾기
          let reportProgress = await iframeDoc.locator('.report_progress');
          let cnt = await reportProgress.count();
          logToFile(`report_progress 요소 수: ${cnt}`);

          // PDF 버튼 찾기
          let pdfButton = await iframeDoc.locator('button[title="PDF 저장"]');
          let pdfButtonExists = await pdfButton.count() > 0;
          logToFile(`PDF 저장 버튼 존재: ${pdfButtonExists}`);

          if (cnt > 0) {
            logToFile(`로딩 중인 요소 발견 : ${cnt}`);
            // 요소의 실제 내용 확인
            for (let i = 0; i < cnt; i++) {
              const element = reportProgress.nth(i);
              const className = await element.getAttribute('class');
              logToFile(`요소 ${i + 1} - 클래스: ${className}`);
            }
          } else {
            logToFile('로딩 중인 요소가 없습니다.');
            if (pdfButtonExists) {
               // 다운로드 이벤트 대기
              const downloadPromise = newPage3.waitForEvent('download');
              await pdfButton.click();
              logToFile('PDF 저장 버튼 클릭 완료');

              // 다운로드 완료 대기 및 파일 저장
              const download = await downloadPromise;
              // const filename = download.suggestedFilename();
              // const filename = 'report_EDW일일잔액대사.pdf'
              logToFile('PDF 다운로드 시작: ' + filename);
              
              try {
                // 다운로드된 파일 저장 (원본 파일명 그대로 사용)
                await download.saveAs(filename);
                logToFile('PDF 파일 저장 완료: ' + filename);

                // 새 창 닫기
                await newPage3.close();
                await newPage2.close();
                await newPage.close();
                logToFile('새 창 닫기 완료');

                logToFile('클라이언트로 응답 전송 완료');
                } catch (error) {
                logToFile('PDF 파일 저장 중 에러: ' + error.message);
                console.error('PDF 파일 저장 중 에러:', error);
                throw error;
                }
              logToFile('PDF 저장 버튼 클릭 완료');
            } else {
              logToFile('PDF 저장 버튼을 찾을 수 없습니다.');
            }
            clearInterval(checkLoading);
            resolve(true);
          }
        } catch (error) {
          logToFile('체크 중 에러 발생:', error);
          clearInterval(checkLoading);
          resolve(false);
        }
      }, 3000);

      // 60초 타임아웃
      setTimeout(() => {
        logToFile('체크 타임아웃 (60초)');
        clearInterval(checkLoading);
        resolve(false);
      }, 60000);
    });
  };

  // 체크 시작
  const checkResult = await checkLoadingClass();
  logToFile(`체크 결과 : ${checkResult}`);

  staDate = staDate.replaceAll('-', '.');
  return biCnt;
}

// ITSM 자료수집 함수
async function itsmCollect (log, url, currentPage, date, docSylId, filename, urgYn) {

  let result = 0;

  // URL로 이동
  logToFile(`🔸 페이지 이동 시작: ${url}`);
  log.push(`🔸 페이지 이동: ${url}`);
  
  await currentPage.goto(url, { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  logToFile('✅ 페이지 이동 완료');
  logToFile(`${date}`);

  //작성부서
  try {
    await currentPage.evaluate( (date) => {


      const fromDwuDtm = document.querySelector('#fromDwuDtm');
      fromDwuDtm.value = date;
      fromDwuDtm.dispatchEvent(new Event('change', {bubbles: true}));
      fromDwuDtm.dispatchEvent(new Event('input', {bubbles: true}));

      const toDwuDtm = document.querySelector('#toDwuDtm');
      toDwuDtm.value = date;
      toDwuDtm.dispatchEvent(new Event('change', {bubbles: true}));
      toDwuDtm.dispatchEvent(new Event('input', {bubbles: true}));

      const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
      hiddenInputs.forEach(input => {
        if(input.id === 'dwuDeptId') {
          input.value = '182';
          input.dispatchEvent(new Event('change', {bubbles: true}));
        }
      })
    }, date );    

    // 문서양식 대분류 docSylKdCd select 값 설정
    await currentPage.selectOption('#docSylKdCd', 'SR'); // 서비스요청(SR)
    logToFile('docSylKdCd 값 설정 완료: SR');

    // 문서양식 소분류 docSylId select 값 설정
    await currentPage.selectOption('#docSylId', docSylId); // 운영배포요청(S3002)
    logToFile(`docSylId 값 설정 완료: ${docSylId}`);

    // 진행상태 체크박스
    try {
      await currentPage.click('#docStsCd999'); // 전체 체크 해제
      const complete1 = await currentPage.locator('#docStsCd190'); // 결재완료
      await complete1.check();
      const complete2 = await currentPage.locator('#docStsCd390'); // 작업완료
      await complete2.check();
      const complete3 = await currentPage.locator('#docStsCd790'); // 배포완료
      await complete3.check();
      const complete4 = await currentPage.locator('#docStsCd970'); // 완료(일괄)
      await complete4.check();
      const complete5 = await currentPage.locator('#docStsCd990'); // 완료(정상)
      await complete5.check();
    } catch (error) {
      throw error;
    }

    // 긴급대응 여부
    await currentPage.selectOption('#urgYn', urgYn); // 전체

    // 검색 버튼 클릭
    await currentPage.click('#search');
    logToFile('검색 버튼 클릭 완료');

    // 검색 결과 로딩 대기
    await currentPage.waitForLoadState('networkidle');
    logToFile('검색 결과 로딩 완료');

    // 새 창이 열릴 때까지 대기
    const [newPage] = await Promise.all([
      currentPage.context().waitForEvent('page'),
      await currentPage.click('#exlDownload')
    ]);
    logToFile('새 창 열림 감지');

    // 새 창으로 전환
    await newPage.waitForLoadState('networkidle');
    logToFile('새 창 로딩 완료');

    result = await newPage.locator('#totalRowCnt').innerText();

    // PDF 버튼 찾기
    const pdfButton = await newPage.locator('button[title="PDF 저장"]');
    
    if (await pdfButton.count() > 0) {
      const buttonId = await pdfButton.getAttribute('id');
      logToFile('PDF 저장 버튼 ID '); // 다운로드 처리 함수
      const handleDownload = async (retryCount = 0, maxRetries = 2) => {
        try {
          // 버튼 클릭 전 네트워크 상태 재확인
          await newPage.waitForLoadState('networkidle');
          
          // 다운로드 이벤트 리스너 설정 (타임아웃 30초)
          const downloadPromise = newPage.waitForEvent('download', { timeout: 30000 });
          
          // 버튼 상태 확인
          const isEnabled = await pdfButton.isEnabled();
          const isVisible = await pdfButton.isVisible();
          
          if (!isEnabled || !isVisible) {
            throw new Error('PDF 버튼이 비활성화되었거나 보이지 않습니다.');
          }

          // 버튼 클릭
          await pdfButton.click();
          logToFile('PDF 저장 버튼 클릭 완료');

          // 다운로드 이벤트 대기
          const download = await downloadPromise;
          logToFile('다운로드 이벤트 감지됨');
          return download;
        } catch (error) {
          logToFile(`다운로드 시도 ${retryCount + 1} 실패: ${error.message}`);
          
        if(retryCount >= maxRetries) {
            throw new Error(`다운로드 시도 ${maxRetries + 1}회 모두 실패: ${error.message}`);
          }
          
          // 실패 시 잠시 대기 후 재시도
          await newPage.waitForTimeout(2000);
          return handleDownload(retryCount + 1, maxRetries);
        }
      };

      try {
        const download = await handleDownload();
        logToFile('PDF 다운로드 시작: ' + filename);
        
        // 다운로드된 파일 저장
        await download.saveAs(filename);
        logToFile('PDF 파일 저장 완료: ' + filename);

        // 파일 내용을 base64로 변환하여 클라이언트에 전송
        const fileContent = fs.readFileSync(filename, { encoding: 'base64' });
        logToFile('파일 내용 base64 인코딩 완료');

        // 새 창 닫기
        await newPage.close();
        logToFile('새 창 닫기 완료');  

      } catch (error) {
        logToFile('PDF 다운로드/저장 중 에러: ' + error.message);
        console.error('PDF 다운로드/저장 중 에러:', error);
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

  return result;
}

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

      if (step === 1) {
        // 1단계(BI포탈)
        biCnt = await biportalCollect (log, url, currentPage, 'report_EDW일일잔액대사.pdf');

        res.json({
          success: true
        });

      } else if (step === 2) {
        // 2단계(ITSM)
        itsmCnt1 = await itsmCollect (log, url, currentPage, staDate, 'S3002', 'report_운영배포(전체).pdf', '');
        itsmCnt2 = await itsmCollect (log, url, currentPage, staDate, 'S3002', 'report_운영배포(긴급).pdf', 'YES');
        itsmCnt3 = await itsmCollect (log, url, currentPage, staDate, 'S0032', 'report_전산원장(전체).pdf', '');
        itsmCnt4 = await itsmCollect (log, url, currentPage, staDate, 'S0032', 'report_전산원장(긴급).pdf', 'YES');        


        logToFile(itsmResult1(itsmCnt1, itsmCnt2));
        logToFile(itsmResult2(itsmCnt3, itsmCnt4));

        res.json({
          success: true
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
      server = app.listen(port, () => {
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
