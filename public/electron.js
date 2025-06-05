// 새 창으로 전환
await newPage.waitForLoadState('networkidle');
console.log('새 창 로딩 완료');

// onclick="test('1')"인 a 태그 찾아서 클릭
const testLink = await newPage.locator('a[onclick="test(\'1\')"]');
if (await testLink.count() > 0) {
  console.log('test(\'1\') 링크 찾음');
  await testLink.click();
  console.log('test(\'1\') 링크 클릭 완료');
} else {
  console.log('onclick="test(\'1\')"인 링크를 찾을 수 없습니다.');
}

// ID가 'test'인 input에 'abc' 입력
const testInput = await newPage.locator('#test');
if (await testInput.count() > 0) {
  await testInput.fill('abc');
  console.log('test input에 abc 입력 완료');
} else {
  console.log('ID가 test인 input을 찾을 수 없습니다.');
}

// title이 "PDF 저장"인 버튼 찾아서 클릭 

// 새 창/탭 열림 대기 (클릭과 함께)
console.log('새 창/탭 열기 시도 전');

// 페이지 이벤트 리스너 설정
const pagePromise = currentPage.context().waitForEvent('page', { timeout: 10000 });
console.log('페이지 이벤트 리스너 설정 완료');

// 다운로드 버튼 클릭
await currentPage.click('#down');
console.log('다운로드 버튼 클릭 완료');

// 새 페이지 대기
const newTab = await pagePromise;
console.log('새 페이지 이벤트 발생:', {
  url: newTab.url(),
  isClosed: newTab.isClosed(),
  title: await newTab.title().catch(e => '제목 가져오기 실패: ' + e.message)
});

// 새 창/탭이 열릴 때까지 잠시 대기
await currentPage.waitForTimeout(2000);
console.log('새 창/탭 열림 대기 완료');

// 새 창/탭의 상태 재확인
try {
  const pageInfo = {
    url: newTab.url(),
    isClosed: newTab.isClosed(),
    title: await newTab.title(),
    content: await newTab.content().catch(e => '컨텐츠 가져오기 실패: ' + e.message)
  };
  console.log('newTab 상세 정보:', pageInfo);
} catch (error) {
  console.error('newTab 정보 가져오기 실패:', error);
}

// 새 창/탭으로 전환 및 완전한 로딩 대기
await newTab.waitForLoadState('domcontentloaded');
console.log('DOM 컨텐츠 로드 완료');
await newTab.waitForLoadState('networkidle');
console.log('네트워크 요청 완료');
await newTab.waitForTimeout(2000); // 추가 대기
console.log('추가 대기 완료');

// iframe 존재 확인
const iframeExists = await newTab.locator('iframe').count() > 0;
console.log('iframe 존재 여부:', iframeExists);

if (iframeExists) {
  // iframe 찾기 및 contentDocument 접근
  const frameElement = await newTab.$('iframe');
  console.log('frameElement 찾음:', frameElement ? '성공' : '실패');

  if (frameElement) {
    const frame = await frameElement.contentFrame();
    console.log('frame contentFrame 접근:', frame ? '성공' : '실패');

    if (frame) {
      // frame의 상태 확인
      console.log('frame 상태:', {
        url: frame.url(),
        title: await frame.title()
      });

      // test 클래스를 가진 요소 체크 (1초마다)
      const checkTestClass = async () => {
        return new Promise((resolve) => {
          const checkInterval = setInterval(async () => {
            try {
              // iframe의 contentDocument에서 test 클래스 검색
              const testClassElement = frame.locator('[class*="test"]');
              const elementCount = await testClassElement.count();
              console.log('iframe contentDocument에서 찾은 요소 수:', elementCount);
              
              if (elementCount === 0) {
                console.log('iframe contentDocument에 test 클래스를 가진 요소가 없습니다.');
                // 현재 iframe의 HTML 구조 확인
                const frameContent = await frame.content();
                console.log('iframe contentDocument HTML:', frameContent);
              } else {
                // 찾은 요소들의 클래스 정보 출력
                for (let i = 0; i < elementCount; i++) {
                  const element = testClassElement.nth(i);
                  const className = await element.getAttribute('class');
                  console.log(`iframe contentDocument 내부 요소 ${i + 1}의 클래스:`, className);
                }
                clearInterval(checkInterval);
                resolve(true);
              }
            } catch (error) {
              console.error('체크 중 에러 발생:', error);
              clearInterval(checkInterval);
              resolve(false);
            }
          }, 1000);

          // 30초 후 타임아웃
          setTimeout(() => {
            clearInterval(checkInterval);
            console.log('test 클래스 체크 타임아웃');
            resolve(false);
          }, 30000);
        });
      };

      // 체크 시작
      await checkTestClass();

      // onclick="test('1')"인 a 태그 찾아서 클릭 (iframe contentDocument 내부에서)
      const testLinkInNewTab = frame.locator('a[onclick="test(\'1\')"]');
      if (await testLinkInNewTab.count() > 0) {
        console.log('test(\'1\') 링크 찾음');
        await testLinkInNewTab.click();
        console.log('test(\'1\') 링크 클릭 완료');
      } else {
        console.log('onclick="test(\'1\')"인 링크를 찾을 수 없습니다.');
      }

      // ID가 'test'인 input에 'abc' 입력
      const testInputInNewTab = await newTab.locator('#test');
      if (await testInputInNewTab.count() > 0) {
        await testInputInNewTab.fill('abc');
        console.log('test input에 abc 입력 완료');
      } else {
        console.log('ID가 test인 input을 찾을 수 없습니다.');
      }

      // title이 "PDF 저장"인 버튼 찾아서 클릭 
    }
  }
}

// title이 "PDF 저장"인 버튼 찾아서 클릭 

const checkLoadingClass = async () => {
  return new Promise((resolve) => {
    const checkLoading = setInterval(async () => {
      try {
        // iframe 존재 확인
        const iframe = await newTab.$('iframe');
        console.log('iframe 요소 존재:', iframe ? '있음' : '없음');
        
        if (!iframe) {
          console.log('iframe을 찾을 수 없습니다.');
          clearInterval(checkLoading);
          resolve(false);
          return;
        }

        // iframe contentFrame 접근
        const iframeDoc = await iframe.contentFrame();
        console.log('iframe contentFrame 접근:', iframeDoc ? '성공' : '실패');
        
        if (!iframeDoc) {
          console.log('iframe contentFrame에 접근할 수 없습니다.');
          clearInterval(checkLoading);
          resolve(false);
          return;
        }

        // iframe 내부 HTML 확인
        const iframeContent = await iframeDoc.content();
        console.log('iframe 내부 HTML:', iframeContent);

        // report_progress 클래스 요소 찾기
        const reportProgress = iframeDoc.locator('.report_progress');
        const cnt = await reportProgress.count();
        console.log('report_progress 요소 수:', cnt);

        // PDF 버튼 찾기
        const pdfButton = await newTab.locator('button[title="PDF 저장"]');
        const pdfButtonExists = await pdfButton.count() > 0;
        console.log('PDF 저장 버튼 존재:', pdfButtonExists);

        if (cnt > 0) {
          console.log('로딩 중인 요소 발견:', cnt);
          // 요소의 실제 내용 확인
          for (let i = 0; i < cnt; i++) {
            const element = reportProgress.nth(i);
            const className = await element.getAttribute('class');
            const text = await element.textContent();
            console.log(`요소 ${i + 1} - 클래스: ${className}, 텍스트: ${text}`);
          }
          clearInterval(checkLoading);
          resolve(true);
        } else {
          console.log('로딩 중인 요소가 없습니다.');
          if (pdfButtonExists) {
            await pdfButton.click();
            console.log('PDF 저장 버튼 클릭 완료');
          } else {
            console.log('PDF 저장 버튼을 찾을 수 없습니다.');
          }
          clearInterval(checkLoading);
          resolve(false);
        }
      } catch (error) {
        console.error('체크 중 에러 발생:', error);
        clearInterval(checkLoading);
        resolve(false);
      }
    }, 1000);

    // 30초 타임아웃
    setTimeout(() => {
      console.log('체크 타임아웃 (30초)');
      clearInterval(checkLoading);
      resolve(false);
    }, 30000);
  });
};

// 체크 시작
const checkResult = await checkLoadingClass();
console.log('체크 결과:', checkResult ? '로딩 중' : '로딩 완료 또는 실패');