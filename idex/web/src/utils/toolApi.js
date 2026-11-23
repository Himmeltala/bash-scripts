// Node 与 JVM 引擎的接口表，以及只负责重新探测工作区能力的 tools 接口。

import { createToolApi } from '@bash-scripts/web-shared'

export function toolApi(prefix) {
  return createToolApi(prefix).api
}

export const nodeApi = toolApi('/__idex/api/node')
export const jvmApi = toolApi('/__idex/api/jvm')
export const toolsApi = toolApi('/__idex/api/tools')
