/**
 * 主进程文件日志——打包版 console.log 不可见（双击 .app 运行），
 * 关键链路日志同时写入 userData/logs/main.log，便于远程定位问题。
 *
 * 日志位置：~/Library/Application Support/伯乐模拟器/logs/main.log
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

let logFile = '';

export function initLog(): void {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    logFile = path.join(dir, 'main.log');
  } catch {}
  log('=== 应用启动 ===');
}

/** 输出到控制台 + 文件 */
export function log(msg: string): void {
  console.log(msg);
  if (!logFile) return;
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

/** 输出错误到控制台 + 文件 */
export function logErr(msg: string): void {
  console.error(msg);
  if (!logFile) return;
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] [ERROR] ${msg}\n`);
  } catch {}
}
