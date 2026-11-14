// HTTP 客户端测试：用假 fetch 验请求参数、错误文案与状态码。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createJsonClient, encodeParam } from '../src/utils/http.js'

function response({ ok = true, status = 200, body = null } = {}) {
  return {
    ok,
    status,
    json: async () => {
      if (body instanceof Error) throw body
      return body
    },
  }
}

test('encodeParam 编码空值与特殊字符', () => {
  assert.equal(encodeParam(null), '')
  assert.equal(encodeParam(undefined), '')
  assert.equal(encodeParam('a b/c'), 'a%20b%2Fc')
})

test('JSON 请求带上方法与请求体', async () => {
  const calls = []
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts })
    return response({ body: { ok: true } })
  }
  const { call } = createJsonClient({ prefix: '/__x/api', fetchImpl: fakeFetch })

  const data = await call('POST', '/things', { name: 'a' })
  assert.deepEqual(data, { ok: true })
  assert.equal(calls[0].url, '/__x/api/things')
  assert.equal(calls[0].opts.method, 'POST')
  assert.equal(calls[0].opts.cache, 'no-store')
  assert.equal(calls[0].opts.headers['Content-Type'], 'application/json')
  assert.equal(calls[0].opts.body, '{"name":"a"}')
})

test('GET 不带请求体', async () => {
  let seen
  const fakeFetch = async (url, opts) => {
    seen = opts
    return response({ body: {} })
  }
  const { call } = createJsonClient({ prefix: '/api', fetchImpl: fakeFetch })
  await call('GET', '/state')
  assert.equal(seen.headers['Content-Type'], undefined)
  assert.equal(seen.body, undefined)
})

test('响应不是 JSON 时返回 null', async () => {
  const { call } = createJsonClient({
    prefix: '/api',
    fetchImpl: async () => response({ body: new SyntaxError('bad json') }),
  })
  assert.equal(await call('GET', '/state'), null)
})

test('HTTP 失败抛后端文案并带状态码', async () => {
  const { call } = createJsonClient({
    prefix: '/api',
    fetchImpl: async () => response({ ok: false, status: 409, body: { error: '同名包已存在' } }),
  })
  await assert.rejects(call('POST', '/zip', {}), (err) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.message, '同名包已存在')
    assert.equal(err.status, 409)
    return true
  })
})

test('HTTP 失败没有文案时用统一兜底', async () => {
  const { call } = createJsonClient({
    prefix: '/api',
    fetchImpl: async () => response({ ok: false, status: 500, body: null }),
  })
  await assert.rejects(call('GET', '/state'), (err) => {
    assert.equal(err.message, '请求失败（500）')
    return true
  })
})

test('statusOnError 为假时不挂状态码', async () => {
  const { call } = createJsonClient({
    prefix: '/api',
    statusOnError: false,
    fetchImpl: async () => response({ ok: false, status: 502 }),
  })
  await assert.rejects(call('GET', '/state'), (err) => {
    assert.equal(err.status, undefined)
    return true
  })
})

test('treatPayloadError 把成功响应里的 error 当失败', async () => {
  const { call } = createJsonClient({
    prefix: '/api',
    treatPayloadError: true,
    fetchImpl: async () => response({ body: { error: '报表读取失败' } }),
  })
  await assert.rejects(call('GET', '/usage'), (err) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.message, '报表读取失败')
    assert.equal(err.status, 200)
    return true
  })
})

test('messageOf 可以覆盖文案', async () => {
  const { call } = createJsonClient({
    prefix: '/api',
    messageOf: ({ data, status }) => `${status}:${data?.error}`,
    fetchImpl: async () => response({ ok: false, status: 418, body: { error: '短毛' } }),
  })
  await assert.rejects(call('GET', '/tea'), (err) => {
    assert.equal(err.message, '418:短毛')
    return true
  })
})
