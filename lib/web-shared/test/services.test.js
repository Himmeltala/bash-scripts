// 服务运行状态测试：不依赖 Vue，只验在跑计数口径。
import test from 'node:test'
import assert from 'node:assert/strict'
import { LIVE_STATUSES, runningCount } from '../src/utils/services.js'

test('工作区在跑的进程数只算启动与运行中', () => {
  assert.deepEqual(LIVE_STATUSES, ['starting', 'ready'])
  const ws = {
    services: [
      { run: { status: 'starting' } },
      { run: { status: 'ready' } },
      { run: { status: 'exited' } },
      { run: null },
      {},
    ],
  }
  assert.equal(runningCount(ws), 2)
  assert.equal(runningCount({}), 0)
})
