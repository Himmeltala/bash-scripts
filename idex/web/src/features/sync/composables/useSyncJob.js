/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:22:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\sync\composables\useSyncJob.js
 * @Description: 后台同步任务的启动、输出流、断线接回与取消。
 */
import { computed, ref } from 'vue'
import { api, jobEventsUrl } from '../../../utils/api.js'

export function useSyncJob({ wsId, bodyFor, onFinish, client = api, openStream = (url) => new EventSource(url) }) {
  const running = ref('')
  const outputLines = ref([])
  const commandLine = ref('')
  const lastError = ref('')
  const jobId = ref('')
  const canceling = ref(false)
  // 操作输出一行一行推过来，页面只维护这个数组。
  const output = computed(() => outputLines.value.join('\n'))
  let stream = null
  let settled = false
  let opened = 0
  // 任务卡住或连接一直断着时，页面不能永远转圈：最后一条输出后 5 分钟、
  // 整个任务 30 分钟还没结束，就按失败收尾，后台任务不受影响。
  const IDLE_MS = 5 * 60 * 1000
  const MAX_MS = 30 * 60 * 1000
  let idleTimer = 0
  let maxTimer = 0
  let activeAction = ''

  function appendLine(line) {
    outputLines.value.push(line)
    // 命令发疯刷屏时只留最近这些行，页面不至于卡死。
    if (outputLines.value.length > 5000) {
      outputLines.value.splice(0, outputLines.value.length - 5000)
    }
  }

  function closeStream() {
    if (stream) {
      stream.close()
      stream = null
    }
  }

  function stopTimers() {
    clearTimeout(idleTimer)
    clearTimeout(maxTimer)
    idleTimer = 0
    maxTimer = 0
  }

  function expire(message) {
    if (settled) return
    lastError.value = message
    finishStream({ ok: false, error: message }, activeAction)
  }

  function touch() {
    if (settled) return
    clearTimeout(idleTimer)
    idleTimer = setTimeout(
      () => expire('操作 5 分钟没有输出，已停止等待，后台任务仍在继续'),
      IDLE_MS,
    )
    // Node 里跑测试时别因为这两个计时器一直挂着；浏览器里没有 unref。
    if (idleTimer && typeof idleTimer.unref === 'function') idleTimer.unref()
  }

  function armTimers(action) {
    stopTimers()
    activeAction = action
    maxTimer = setTimeout(
      () => expire('操作超过 30 分钟仍未完成，已停止等待，后台任务仍在继续'),
      MAX_MS,
    )
    if (maxTimer && typeof maxTimer.unref === 'function') maxTimer.unref()
    touch()
  }

  function finishStream(data, action) {
    if (settled) return
    settled = true
    stopTimers()
    closeStream()
    jobId.value = ''
    if (data && data.ok === false) {
      lastError.value = data.error || '操作没有成功，看上面的输出。'
    }
    running.value = ''
    onFinish(action, data)
  }

  function streamJob(id, action) {
    const es = openStream(jobEventsUrl(id))
    stream = es
    opened = 0
    es.onopen = () => {
      opened += 1
      touch()
      // 断线重连时服务端会从头重放，先把本地已显示的行换回命令行。
      if (opened > 1) {
        outputLines.value = commandLine.value ? [`$ ${commandLine.value}`, ''] : []
      }
    }
    es.addEventListener('output', (event) => {
      touch()
      try {
        appendLine(JSON.parse(event.data).line ?? '')
      } catch (err) {
        // 一行读不懂就跳过，不影响后面的输出。
      }
    })
    es.addEventListener('done', (event) => {
      let data = {}
      try {
        data = JSON.parse(event.data)
      } catch (err) {
        data = {}
      }
      finishStream(data, action)
    })
    es.onerror = async () => {
      // 任务结束后服务端主动关连接也会触发这里，done 处理过就不再管。
      if (settled) return
      // EventSource 会自己重连；顺手查一次任务状态，免得服务端没发完页面一直转。
      try {
        const data = await client.job(id)
        if (data.done) finishStream(data, action)
      } catch (err) {
        // 查不到就让 EventSource 继续重连。
      }
    }
  }

  // 起一个新任务；动作参数由页面按当前的输入拼。
  async function start(action) {
    running.value = action
    settled = false
    outputLines.value = []
    commandLine.value = ''
    jobId.value = ''
    lastError.value = ''
    try {
      const body = { ws: wsId(), action, ...bodyFor(action) }
      const data = await client.startOperation(body)
      jobId.value = data.id
      commandLine.value = data.command || ''
      if (commandLine.value) outputLines.value.push(`$ ${commandLine.value}`, '')
      armTimers(action)
      streamJob(data.id, action)
    } catch (err) {
      lastError.value = err.message
      running.value = ''
      return false
    }
    return true
  }

  // 页面刷新或重新打开时，如果后台还有任务在跑，接上它的输出。
  async function attachRunningJob() {
    if (running.value || stream) return
    try {
      const data = await client.latestOperation(wsId())
      const job = data.job
      if (!job || job.done || running.value || stream) return
      running.value = job.action
      settled = false
      jobId.value = job.id
      commandLine.value = job.command || ''
      outputLines.value = commandLine.value ? [`$ ${commandLine.value}`, ''] : []
      armTimers(job.action)
      streamJob(job.id, job.action)
    } catch (err) {
      // 接不上历史任务不影响查看页面。
    }
  }

  async function cancel() {
    if (!jobId.value) return
    canceling.value = true
    try {
      await client.cancelOperation(jobId.value)
    } catch (err) {
      lastError.value = err.message
    } finally {
      canceling.value = false
    }
  }

  function reset() {
    settled = true
    stopTimers()
    closeStream()
    outputLines.value = []
    commandLine.value = ''
    lastError.value = ''
    jobId.value = ''
    running.value = ''
    canceling.value = false
  }

  function dispose() {
    settled = true
    stopTimers()
    closeStream()
  }

  return {
    running,
    output,
    outputLines,
    commandLine,
    lastError,
    jobId,
    canceling,
    start,
    attachRunningJob,
    cancel,
    reset,
    dispose,
  }
}
