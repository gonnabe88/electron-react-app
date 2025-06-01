// src/electron/runSSOAndFetchJson.js

const { BrowserWindow, session, net } = require('electron');

/**
 * 숨김 창을 이용해 SSO 로그인 후 JSON API 요청
 */
async function fetchJson(url1, url2, payload) {
  const ses = session.fromPartition('persist:sso-partition');

  const win = new BrowserWindow({
    show: false, // 창을 띄우지 않음
    webPreferences: {
      session: ses
    }
  });

  // SSO 로그인 페이지 로딩
  await win.loadURL(url1);

  // 세션 쿠키 획득
  const cookies = await ses.cookies.get({ url: url1 });
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  win.destroy(); // 창 닫기

  // API 요청 수행
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: url2,
    });

    const body = JSON.stringify(payload);

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('Content-Length', Buffer.byteLength(body));
    request.setHeader('Cookie', cookieHeader);

    let responseBody = '';
    request.on('response', (res) => {
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
    });

    request.on('error', reject);

    request.write(body);
    request.end();
  });
}

module.exports = fetchJson;
