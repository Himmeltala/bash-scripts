// 接口封装：公共端点走共享表，JDK 相关的在这里补。

import { createToolApi } from '@bash-scripts/web-shared'

const PREFIX = '/__jvmx/api'
const { call, api: base } = createToolApi(PREFIX)

export { ApiError } from '@bash-scripts/web-shared/http'

export const api = {
  ...base,
  jdks: () => call('GET', '/jdks'),
  setJdk: (ws, jdk) => call('POST', '/jdk', { ws, jdk }),
}
