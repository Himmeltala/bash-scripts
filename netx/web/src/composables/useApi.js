// 网页接口：连接列表由 SSE 推送，详情、占用与清理按需请求。

import { createJsonClient } from '@bash-scripts/web-shared/http'

const client = createJsonClient({ prefix: '/__netx/api' })

export const getJSON = (path) => client.call('GET', path)
export const postJSON = (path, body) => client.call('POST', path, body)
export const flowDetail = (id) => getJSON('/flow?id=' + encodeURIComponent(id))
export const summary = () => getJSON('/summary')
export const clean = (body) => postJSON('/clean', body)
