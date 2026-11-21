/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 16:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 16:30:00
 * @FilePath: \idex\web\src\composables\useBrowseProps.js
 * @Description: 浏览页的右键属性：文件或目录的类型、大小、修改时间、权限与所有者。
 */
import { computed, reactive } from 'vue'
import { formatBytes, formatTimestamp } from '@bash-scripts/web-shared/format'
import { api } from '../utils/api.js'

const TYPE_TEXT = { file: '文件', dir: '目录', link: '符号链接' }

export function useBrowseProps({ wsId }) {
  // 只有看的份：打开、读完就摆出来，不改磁盘上的东西。
  const propsAsk = reactive({ on: false, loading: false, error: '', data: null })
  let seq = 0

  const propsRows = computed(() => {
    const data = propsAsk.data
    if (!data) return []
    const rows = [
      { label: '名称', value: data.name },
      { label: '路径', value: data.abs },
    ]
    if (data.link_target) rows.push({ label: '链接目标', value: data.link_target })
    rows.push(
      { label: '类型', value: TYPE_TEXT[data.type] || data.type },
      { label: '大小', value: data.size == null ? '—' : formatBytes(data.size) },
      { label: '修改时间', value: formatTimestamp(data.mtime, { unit: 's', fallback: '—' }) },
      { label: '权限', value: `${data.mode_text}（${data.mode}）` },
      { label: '所有者', value: `${data.owner}:${data.group}` }
    )
    return rows
  })

  async function openProps(path) {
    const mine = ++seq
    Object.assign(propsAsk, { on: true, loading: true, error: '', data: null })
    try {
      const data = await api.stat(wsId(), path || '')
      if (mine === seq) propsAsk.data = data
    } catch (err) {
      if (mine === seq) propsAsk.error = err.message
    } finally {
      if (mine === seq) propsAsk.loading = false
    }
  }

  return { propsAsk, propsRows, openProps }
}
