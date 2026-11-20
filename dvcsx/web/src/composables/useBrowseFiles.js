/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 02:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 02:05:00
 * @FilePath: \dvcsx\web\src\composables\useBrowseFiles.js
 * @Description: 浏览页的新建、改名与删除：弹窗状态、页签跟随与落盘。
 */
import { computed, nextTick, reactive } from 'vue'
import { api } from '../utils/api.js'
import { entryNameProblem } from '../utils/browseOps.js'
import { closeTab as closeTabIn, followMoved, renameTabs } from '../utils/browseTabs.js'
import { dirName } from '../utils/format.js'

export function useBrowseFiles({ wsId, tabs, activePath, drafts, editorOf, show, reveal, reload }) {
  // 右键菜单的新建、改名、删除：弹窗在这里，接口也在这里，目录树只报动作。
  const nameAsk = reactive({ on: false, mode: '', node: null, dir: '', value: '', error: '', busy: false })
  const delAsk = reactive({ on: false, node: null, error: '', busy: false })

  const nameTitle = computed(
    () => ({ file: '新建文件', dir: '新建目录', rename: '重命名' })[nameAsk.mode] || '',
  )

  const nameLabel = computed(() => {
    if (nameAsk.mode === 'dir') return '目录名'
    if (nameAsk.node && nameAsk.node.type === 'dir') return '目录名'
    return '文件名'
  })

  function onTreeAction({ action, node }) {
    if (action === 'create-file' || action === 'create-dir') {
      Object.assign(nameAsk, {
        on: true,
        mode: action === 'create-file' ? 'file' : 'dir',
        node,
        dir: node.path,
        value: '',
        error: '',
        busy: false,
      })
      return
    }
    if (action === 'rename') {
      Object.assign(nameAsk, {
        on: true,
        mode: 'rename',
        node,
        dir: dirName(node.path),
        value: node.name,
        error: '',
        busy: false,
      })
      return
    }
    if (action === 'delete') {
      Object.assign(delAsk, { on: true, node, error: '', busy: false })
    }
  }

  // 改名与删除会动到磁盘上的文件：动到哪个页签，就先把那个页签的草稿问清楚。
  function affectedTabs(path) {
    return tabs.value.filter((tab) => tab.path === path || tab.path.startsWith(`${path}/`))
  }

  async function leaveTabs(list) {
    for (const tab of list) {
      const editor = editorOf(tab.path)
      if (editor && editor.dirty && !(await editor.confirmLeave())) return false
    }
    return true
  }

  async function submitName() {
    if (nameAsk.busy) return
    const name = nameAsk.value.trim()
    const problem = entryNameProblem(name)
    if (problem) {
      nameAsk.error = problem
      return
    }
    nameAsk.busy = true
    nameAsk.error = ''
    try {
      if (nameAsk.mode === 'rename') {
        if (!(await doRename(nameAsk.node, name))) return
      } else {
        await doCreate(nameAsk.mode, nameAsk.dir, name)
      }
      nameAsk.on = false
    } catch (err) {
      nameAsk.error = err.message
    } finally {
      nameAsk.busy = false
    }
  }

  async function doCreate(kind, dir, name) {
    const data =
      kind === 'dir'
        ? await api.mkdir(wsId(), dir, name)
        : await api.newFile(wsId(), dir, name)
    await reveal(dir)
    await reload(dir)
    // 新建的文件直接开一个页签；别的页签的草稿都还在自己那边，不会被挤掉。
    if (kind === 'file') {
      await show({ name: data.name, path: data.path, type: 'file', size: 0 })
    }
  }

  async function doRename(node, name) {
    if (name === node.name) return true
    if (!(await leaveTabs(affectedTabs(node.path)))) return false
    const data = await api.renameEntry(wsId(), node.path, name)
    await reload(dirName(node.path))
    const before = activePath.value
    const renamed = renameTabs(tabs.value, node.path, data.path, data.name)
    tabs.value = renamed.tabs
    activePath.value = followMoved(renamed.moved, before)
    // 旧路径的草稿已经问过、跟着页签一起作废；页签换了键，编辑器重新挂上后按新路径读一次。
    for (const item of renamed.moved) drafts.delete(item.from)
    await nextTick()
    for (const item of renamed.moved) {
      await editorOf(item.to)?.open(item.to)
    }
    return true
  }

  async function submitDelete() {
    if (delAsk.busy) return
    const node = delAsk.node
    delAsk.busy = true
    delAsk.error = ''
    try {
      const touched = affectedTabs(node.path)
      if (!(await leaveTabs(touched))) return
      await api.deleteEntry(wsId(), node.path)
      // 删掉的文件在哪个页签上开着，就一并关掉，停到旁边剩下的那个。
      let next = activePath.value
      for (const tab of touched) {
        const result = closeTabIn(tabs.value, tab.path, next)
        tabs.value = result.tabs
        drafts.delete(tab.path)
        next = result.active
      }
      if (next !== activePath.value) activePath.value = next
      await reload(dirName(node.path))
      delAsk.on = false
    } catch (err) {
      delAsk.error = err.message
    } finally {
      delAsk.busy = false
    }
  }

  return { nameAsk, delAsk, nameTitle, nameLabel, onTreeAction, submitName, submitDelete }
}
