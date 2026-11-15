// 价格配置的读写：整份读、整份写，与服务端 /api/config 对应。
// 保存的分支判断留在服务端，这里只把错误消息原样带给编辑器。

async function call(method, path, body) {
  const options = { method, cache: 'no-store', headers: {} }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const response = await fetch(`/api${path}`, options)
  let data = null
  try {
    data = await response.json()
  } catch (err) {
    data = null
  }
  if (!response.ok || (data && data.error)) {
    throw new Error((data && data.error) || `请求失败（${response.status}）`)
  }
  return data
}

export const configApi = {
  get: () => call('GET', '/config'),
  save: (text) => call('POST', '/config', { text }),
}
