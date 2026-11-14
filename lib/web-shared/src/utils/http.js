// 轻量 HTTP 客户端：统一 JSON 请求、错误文案与错误里的状态码。

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function encodeParam(value) {
  return encodeURIComponent(value ?? '')
}

// messageOf 拿到 { data, status, response, method, path }，返回给用户看的那句话。
// statusOnError 为真时把 HTTP 状态码挂在 ApiError.status 上。
// treatPayloadError 为真时，HTTP 成功但响应体里带 error 也算失败（SSE 报表接口是这种）。
export function createJsonClient({
  prefix,
  messageOf,
  statusOnError = true,
  treatPayloadError = false,
  fetchImpl = fetch,
} = {}) {
  async function call(method, path, body) {
    const opts = { method, cache: 'no-store', headers: {} }
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    const response = await fetchImpl(prefix + path, opts)
    let data = null
    try {
      data = await response.json()
    } catch (err) {
      data = null
    }
    const describe = () => {
      if (messageOf) return messageOf({ data, status: response.status, response, method, path })
      return (data && data.error) || `请求失败（${response.status}）`
    }
    if (!response.ok) {
      throw new ApiError(describe(), statusOnError ? response.status : undefined)
    }
    if (treatPayloadError && data && data.error) {
      throw new ApiError(describe(), statusOnError ? response.status : undefined)
    }
    return data
  }

  return { call }
}
