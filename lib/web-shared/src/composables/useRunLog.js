// 运行日志的弹窗数据：先收尾部一页，之后按 SSE 追加，往前翻页走普通接口。
// 接口地址与状态文案由调用方给，组件只管把文本、页码与状态同步过来。

import { onBeforeUnmount, ref, watch } from 'vue'

export function useRunLog({ api, ws, statusText = {} }) {
  const text = ref('')
  const more = ref(false)
  const page = ref(0)
  const status = ref('')
  const runId = ref('')
  const svcId = ref('')
  let source = null

  function close() {
    if (source) {
      source.close()
      source = null
    }
    runId.value = ''
    svcId.value = ''
  }

  function open(run, svc = '') {
    close()
    text.value = ''
    more.value = false
    page.value = 0
    status.value = run ? statusText[run.status] || run.status : ''
    svcId.value = svc || ''
    if (!run) return
    runId.value = run.id
    const stream = new EventSource(api.logStreamUrl(run.id))
    source = stream
    stream.addEventListener('tail', (ev) => {
      const data = JSON.parse(ev.data)
      text.value = data.text || ''
      more.value = !!data.more
      page.value = 0
    })
    stream.addEventListener('append', (ev) => {
      const data = JSON.parse(ev.data)
      if (data.text) text.value = text.value ? `${text.value}\n${data.text}` : data.text
    })
  }

  async function loadMore() {
    if (!more.value || !runId.value) return
    const next = page.value + 1
    try {
      const data = await api.log(runId.value, next)
      text.value = data.text + (text.value ? '\n' + text.value : '')
      more.value = data.more
      page.value = next
      status.value = data.status ? statusText[data.status] || data.status : ''
    } catch (err) {
      text.value = `读日志失败：${err.message}`
    }
  }

  // 状态轮询每两秒换一份工作区，弹窗里的状态跟着最新运行走。
  watch(ws, (value) => {
    if (!svcId.value || !value) return
    const svc = (value.services || []).find((item) => item.id === svcId.value)
    if (svc && svc.run) status.value = statusText[svc.run.status] || svc.run.status
  })

  onBeforeUnmount(close)

  return { text, more, page, status, runId, open, close, loadMore }
}
