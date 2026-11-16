// 价格配置的读写：整份读、整份写，与服务端 /api/config 对应。
// 保存的分支判断留在服务端，这里只把错误消息原样带给编辑器。

import { call } from '../../../composables/useApi'

export const configApi = {
  get: () => call('GET', '/config'),
  save: (text) => call('POST', '/config', { text }),
}
