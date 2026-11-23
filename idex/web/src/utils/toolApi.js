// Node 与 JVM 引擎的接口表，以及只负责重新探测工作区能力的 tools 接口。

import { createToolApi } from '@bash-scripts/web-shared'

export function toolApi(prefix) {
  return createToolApi(prefix).api
}

// 工具独有路由从各自的客户端补：base 里的 call 不对外暴露。
const nodeClient = createToolApi('/__idex/api/node')

export const nodeApi = {
  ...nodeClient.api,
  nodes: () => nodeClient.call('GET', '/nodes'),
  setNode: (ws, node) => nodeClient.call('POST', '/node', { ws, node }),
  addCommand: (payload) => nodeClient.call('POST', '/addcmd', payload),
  removeCommand: (svc) => nodeClient.call('POST', '/delcmd', { svc }),
}
const jvmClient = createToolApi('/__idex/api/jvm')

export const jvmApi = {
  ...jvmClient.api,
  jdks: () => jvmClient.call('GET', '/jdks'),
  setJdk: (ws, jdk) => jvmClient.call('POST', '/jdk', { ws, jdk }),
  restart: (run) => jvmClient.call('POST', '/restart', { run }),
}
export const toolsApi = toolApi('/__idex/api/tools')
