// 接口调用：整份 JSON 收发，错误消息原样带给页面，不在这里吞掉。

export async function call(method, path, body) {
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

export function get(path) {
  return call('GET', path)
}

export function post(path, body = {}) {
  return call('POST', path, body)
}

export function query(name) {
  return `?name=${encodeURIComponent(name)}`
}
