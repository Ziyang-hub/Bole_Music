/**
 * 伯乐模拟器 - React 渲染进程入口
 *
 * 这是前端代码的入口文件，React 应用从这里启动
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// 挂载 React 应用到 HTML 中的 <div id="root">
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('找不到 #root 元素，请检查 index.html');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
