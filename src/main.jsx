import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Electron 환경에서 window 객체가 정의되어 있는지 확인
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// React 18의 createRoot 사용
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 