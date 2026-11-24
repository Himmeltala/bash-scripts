/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\engines\lib\toolApi.js
 * @Description: Node 与 JVM 引擎的接口表，以及工作区工具能力的探测接口。
*/

// Node 与 JVM 引擎的接口表，以及只负责重新探测工作区能力的 tools 接口。

import { createToolApi } from '@bash-scripts/web-shared/tool-api'

export function toolApi(prefix) {
  return createToolApi(prefix).api
}

// 工具独有路由从各自的客户端补：base 里的 call 不对外暴露。
const nodeClient = createToolApi('/__idex/api/node')

export const nodeApi = {
  ...nodeClient.api,
  nodes: () => nodeClient.call('GET', '/nodes'),
  rescanStatus: (ws) => nodeClient.call('GET', `/rescan/status?ws=${encodeURIComponent(ws ?? '')}`),
  restart: (run) => nodeClient.call('POST', '/restart', { run }),
  setNode: (ws, node) => nodeClient.call('POST', '/node', { ws, node }),
  addCommand: (payload) => nodeClient.call('POST', '/addcmd', payload),
  removeCommand: (svc) => nodeClient.call('POST', '/delcmd', { svc }),
}
const jvmClient = createToolApi('/__idex/api/jvm')

export const jvmApi = {
  ...jvmClient.api,
  jdks: () => jvmClient.call('GET', '/jdks'),
  rescanStatus: (ws) => jvmClient.call('GET', `/rescan/status?ws=${encodeURIComponent(ws ?? '')}`),
  setJdk: (ws, jdk) => jvmClient.call('POST', '/jdk', { ws, jdk }),
  restart: (run) => jvmClient.call('POST', '/restart', { run }),
  // 下载走浏览器直接取，地址给 <a href> 用。
  downloadUrl: (run) => `/__idex/api/jvm/download?run=${encodeURIComponent(run ?? '')}`,
}
export const toolsApi = toolApi('/__idex/api/tools')
