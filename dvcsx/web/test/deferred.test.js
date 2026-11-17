// 变更页“默认不渲染”的路径判断：锁文件与构建产物，纯函数测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { isDeferred } from '../src/composables/deferred.js'

test('常见锁文件在任何层级都默认不渲染', () => {
  for (const path of [
    'package-lock.json',
    'client/package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'server/composer.lock',
    'Cargo.lock',
    'go.sum',
    'uv.lock',
  ]) {
    assert.equal(isDeferred(path), true, path)
  }
})

test('构建产物目录按任意层级通配', () => {
  for (const path of [
    'dist/app.js',
    'client/dist/assets/index.js',
    'build/classes/A.class',
    'server/target/app.jar',
    'coverage/index.html',
    'client/node_modules/vue/index.js',
    '.next/cache/webpack/x.js',
  ]) {
    assert.equal(isDeferred(path), true, path)
  }
})

test('名字相近的普通文件与源码目录不受影响', () => {
  for (const path of [
    'package.json',
    'src/package-lock.json.md',
    'src/dist.js',
    'src/build.ts',
    'docs/distribution/guide.md',
    'src/target.ts',
    'README.md',
  ]) {
    assert.equal(isDeferred(path), false, path)
  }
})

test('去掉开头的斜杠后再匹配', () => {
  assert.equal(isDeferred('/package-lock.json'), true)
  assert.equal(isDeferred(''), false)
})
