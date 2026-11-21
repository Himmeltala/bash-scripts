// 服务运行状态测试：不依赖 Vue，只验在跑计数口径。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LIVE_STATUSES,
  runningByWorkspace,
  runningCount,
  serviceIcon,
} from '../src/utils/services/serviceStatus.js'

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

test('运行状态对应图标', () => {
  assert.equal(serviceIcon('ready'), 'mdi-play-circle')
  assert.equal(serviceIcon('starting'), 'mdi-progress-clock')
  assert.equal(serviceIcon('failed'), 'mdi-alert-circle')
  assert.equal(serviceIcon('exited'), 'mdi-check-circle')
  assert.equal(serviceIcon('stopped'), 'mdi-stop-circle')
  assert.equal(serviceIcon(''), 'mdi-stop-circle')
})

test('按工作区汇总只列在跑的，名字优先用别名，没别名用目录名', () => {
  const workspaces = [
    {
      id: 'a',
      alias: '前端',
      root: '/x/fe',
      services: [{ run: { status: 'ready' } }, { run: { status: 'starting' } }],
    },
    { id: 'b', root: '/x/be/', services: [{ run: { status: 'exited' } }] },
    { id: 'c', root: '/x/api', services: [] },
    { id: 'd', alias: '服务', root: '/x/svc', services: [{ run: { status: 'ready' } }] },
    { id: 'e', root: '/x/tools/web/', services: [{ run: { status: 'ready' } }] },
  ]
  assert.deepEqual(runningByWorkspace(workspaces), [
    { id: 'a', name: '前端', count: 2 },
    { id: 'd', name: '服务', count: 1 },
    { id: 'e', name: 'web', count: 1 },
  ])
  assert.deepEqual(runningByWorkspace([]), [])
})
