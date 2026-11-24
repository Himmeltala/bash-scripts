/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:22:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:22:00
 * @FilePath: \idex\web\src\editor\useCodeIndex.js
 * @Description: 代码索引：定义、引用、重命名、悬停、符号大纲与语言服务器状态。
 */
import { computed, reactive, ref } from 'vue'
import { symbolAt } from '@bash-scripts/web-shared/text'
import { api } from '../utils/api.js'
import { extensionOf } from '../components/browse/browseOps.js'
import { LANGUAGES, SERVER_BY_EXT, SYMBOL_ICONS, SYMBOL_TITLES } from '../utils/languageServers.js'
import { offsetOf } from './textPositions.js'

export function useCodeIndex({
  wsId,
  activePath,
  activeTab,
  editorOf,
  caret,
  openLocation,
  reloadDir,
  flash,
  client = api,
}) {
  // 查定义时的转圈，以及多个候选时的那张列表。
  const defining = ref(false)
  const defAsk = reactive({ on: false, word: '', title: '定义', list: [] })
  // 重命名：先填新名字、看预览，确认后才动磁盘。
  const renameAsk = reactive({
    on: false,
    path: '',
    line: 0,
    character: 0,
    word: '',
    value: '',
    step: 'input',
    files: [],
    total: 0,
    error: '',
    busy: false,
  })
  // 状态栏用的语言服务器清单，第一次打开大纲或状态栏时取一次。
  const servers = ref([])
  const serversLoaded = ref(false)
  const outlineAsk = reactive({ on: false, loading: false, error: '', items: [], filter: '', path: '' })
  const hoverAsk = reactive({ on: false, word: '', text: '' })
  // 鼠标悬停的浮层与缓存：同一个位置只问一次。
  const hoverTip = reactive({ on: false, x: 0, y: 0, text: '' })
  const hoverCache = new Map()
  let hoverSeq = 0

  const languageLabel = computed(() => {
    const ext = extensionOf(activePath.value)
    return ext ? LANGUAGES[ext] || ext.toUpperCase() : '文本'
  })
  const serverInfo = computed(() => {
    const id = SERVER_BY_EXT[extensionOf(activePath.value)]
    return id ? servers.value.find((item) => item.id === id) || null : null
  })
  const serverReady = computed(() => !!(serverInfo.value && serverInfo.value.available))
  const serverLabel = computed(() => {
    if (!activePath.value) return ''
    const info = serverInfo.value
    if (!info) return '无代码索引'
    return info.available ? `${info.title} 索引就绪` : `${info.title} 未装`
  })
  const serverTitle = computed(() => {
    const info = serverInfo.value
    if (!info) return '这种文件没有语言服务器'
    return info.available ? info.command : info.hint
  })
  const outlineRows = computed(() => {
    const q = outlineAsk.filter.trim().toLowerCase()
    if (!q) return outlineAsk.items
    return outlineAsk.items.filter((item) => String(item.name).toLowerCase().includes(q))
  })

  async function loadServers() {
    if (serversLoaded.value) return
    try {
      const data = await client.lspStatus()
      servers.value = data.servers || []
      serversLoaded.value = true
    } catch (err) {
      servers.value = []
    }
  }

  // Ctrl+点击取到的词去问语言服务器：一条直接跳，多条列出来选，零条或出错在顶栏说明。
  async function onDefinition({ path, line, character, word }) {
    if (!path) return
    const editor = editorOf(path)
    if (!editor) return
    defining.value = true
    try {
      const data = await client.definition(wsId(), path, editor.text, line, character)
      const list = (data && data.locations) || []
      if (!list.length) {
        flash(`没找到「${word}」的定义`)
        return
      }
      if (list.length === 1) {
        await openLocation(list[0])
        return
      }
      defAsk.word = word
      defAsk.title = '定义'
      defAsk.list = list
      defAsk.on = true
    } catch (err) {
      flash(err.message)
    } finally {
      defining.value = false
    }
  }

  // 代码菜单里的服务端动作：结果一条直接跳，多条列进候选框。
  async function askLocations(action, item) {
    const editor = editorOf(item.path)
    if (!editor) return
    const title = SYMBOL_TITLES[action] || '定义'
    defining.value = true
    try {
      const data = await client.query(
        wsId(), item.path, editor.text, item.line, item.character, action
      )
      const list = (data && data.locations) || []
      if (!list.length) {
        flash(`没有找到「${item.word}」的${title}`)
        return
      }
      if (list.length === 1) {
        await openLocation(list[0])
        return
      }
      defAsk.word = item.word
      defAsk.title = title
      defAsk.list = list
      defAsk.on = true
    } catch (err) {
      flash(err.message)
    } finally {
      defining.value = false
    }
  }

  // 重命名：先填新名字、看要改哪些文件，确认后才落盘；F2 与右键菜单都走这里。
  function openRename(payload) {
    Object.assign(renameAsk, {
      on: true,
      path: payload.path,
      line: payload.line,
      character: payload.character,
      word: payload.word,
      value: payload.word,
      step: 'input',
      files: [],
      total: 0,
      error: '',
      busy: false,
    })
  }

  async function previewRename() {
    const editor = editorOf(renameAsk.path)
    if (!editor) return
    const name = renameAsk.value.trim()
    if (!name) {
      renameAsk.error = '新名字不能为空'
      return
    }
    renameAsk.busy = true
    renameAsk.error = ''
    try {
      const data = await client.renamePreview(
        wsId(), renameAsk.path, editor.text, renameAsk.line, renameAsk.character, name
      )
      renameAsk.files = data.files || []
      renameAsk.total = data.total || 0
      renameAsk.step = 'preview'
      if (!renameAsk.total) renameAsk.error = '没有找到要改的位置'
    } catch (err) {
      renameAsk.error = err.message
    } finally {
      renameAsk.busy = false
    }
  }

  async function applyRename() {
    const editor = editorOf(renameAsk.path)
    if (!editor) return
    // 有草稿的文件不能直接改盘，先让用户保存。
    const dirty = renameAsk.files
      .map((item) => item.path)
      .filter((path) => {
        const other = editorOf(path)
        return other && other.dirty
      })
    if (dirty.length) {
      renameAsk.error = `先保存这些文件的改动：${dirty.join('、')}`
      return
    }
    renameAsk.busy = true
    renameAsk.error = ''
    try {
      const data = await client.renameApply(
        wsId(),
        renameAsk.path,
        editor.text,
        renameAsk.line,
        renameAsk.character,
        renameAsk.value.trim()
      )
      // 改到开着的文件就重新读一遍，目录树刷一下所在目录。
      for (const item of data.files || []) {
        const other = editorOf(item.path)
        if (other && other.path) await other.reload()
        reloadDir(item.path)
      }
      renameAsk.on = false
      flash(`已重命名「${renameAsk.word}」，改了 ${data.total || 0} 处`)
    } catch (err) {
      renameAsk.error = err.message
    } finally {
      renameAsk.busy = false
    }
  }

  async function openOutline() {
    const tab = activeTab.value
    const editor = tab ? editorOf(tab.path) : null
    if (!tab || !editor || !editor.path) {
      flash('先打开一个文件再看大纲')
      return
    }
    Object.assign(outlineAsk, {
      on: true,
      loading: true,
      error: '',
      items: [],
      filter: '',
      path: tab.path,
    })
    try {
      const data = await client.symbols(wsId(), tab.path, editor.text)
      outlineAsk.items = data.symbols || []
      if (!outlineAsk.items.length) outlineAsk.error = '这个文件没有符号'
    } catch (err) {
      outlineAsk.error = err.message
    } finally {
      outlineAsk.loading = false
    }
  }

  function symbolIcon(item) {
    return SYMBOL_ICONS[item.kind] || 'mdi-symbol'
  }

  async function pickSymbol(item) {
    outlineAsk.on = false
    await openLocation({ path: outlineAsk.path, line: item.line, character: item.character })
  }

  // 鼠标停在标识符上一会儿：浮层显示类型与文档，换位置或移出就收起。
  function onHover({ path, line, character, x, y }) {
    if (path !== activePath.value || !serverReady.value) return
    const key = `${path}:${line}:${character}`
    const left = Math.max(8, Math.min(x + 14, window.innerWidth - 448))
    const top = Math.max(8, Math.min(y + 14, window.innerHeight - 228))
    const cached = hoverCache.get(key)
    if (cached !== undefined) {
      if (!cached) return
      Object.assign(hoverTip, { on: true, x: left, y: top, text: cached })
      return
    }
    const editor = editorOf(path)
    if (!editor || !editor.path) return
    const seq = ++hoverSeq
    Object.assign(hoverTip, { on: true, x: left, y: top, text: '读取悬停…' })
    client
      .hover(wsId(), path, editor.text, line, character)
      .then((data) => {
        if (seq !== hoverSeq) return
        const text = (data && data.hover && data.hover.text) || ''
        hoverCache.set(key, text)
        if (hoverCache.size > 200) hoverCache.delete(hoverCache.keys().next().value)
        if (!text) {
          hoverTip.on = false
          return
        }
        hoverTip.text = text
      })
      .catch((err) => {
        if (seq === hoverSeq) {
          hoverTip.on = false
          flash(err.message)
        }
      })
  }

  function onHoverEnd({ path } = {}) {
    if (path && path !== activePath.value) return
    hoverSeq += 1
    hoverTip.on = false
  }

  // 悬停：Ctrl+I 看光标处的词，右键菜单里也能看。
  async function showHoverAtCaret() {
    const tab = activeTab.value
    const editor = tab ? editorOf(tab.path) : null
    if (!tab || !editor || !editor.path) {
      flash('先打开一个文件')
      return
    }
    const symbol = symbolAt(editor.text, offsetOf(editor.text, caret.line, caret.column))
    if (!symbol) {
      flash('光标不在标识符上')
      return
    }
    await openHover(tab.path, symbol.line, symbol.character, symbol.word)
  }

  async function openHover(path, line, character, word) {
    const editor = editorOf(path)
    if (!editor) return
    defining.value = true
    try {
      const data = await client.hover(wsId(), path, editor.text, line, character)
      const text = (data && data.hover && data.hover.text) || ''
      if (!text) {
        flash(`「${word}」没有悬停信息`)
        return
      }
      Object.assign(hoverAsk, { on: true, word, text })
    } catch (err) {
      flash(err.message)
    } finally {
      defining.value = false
    }
  }

  function dispose() {
    hoverSeq += 1
    hoverCache.clear()
  }

  return {
    defining,
    defAsk,
    renameAsk,
    servers,
    serversLoaded,
    outlineAsk,
    outlineRows,
    hoverAsk,
    hoverTip,
    languageLabel,
    serverReady,
    serverLabel,
    serverTitle,
    loadServers,
    onDefinition,
    askLocations,
    openRename,
    previewRename,
    applyRename,
    openOutline,
    symbolIcon,
    pickSymbol,
    onHover,
    onHoverEnd,
    showHoverAtCaret,
    openHover,
    dispose,
  }
}
