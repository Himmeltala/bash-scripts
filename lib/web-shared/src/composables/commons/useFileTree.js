// 把带路径的列表摆成目录树：目录在前、文件在后，各自按名字排。
// source 可以是数组、ref 或取数组的函数；decorate 给文件行补展示字段。

import { computed, reactive, unref } from 'vue'

export function useFileTree(source, decorate = () => ({})) {
  // 收起过的目录记在这里，换工作副本时由调用方决定要不要清。
  const collapsed = reactive({})

  function list() {
    const items = typeof source === 'function' ? source() : unref(source)
    return Array.isArray(items) ? items : []
  }

  function buildTree(items) {
    const root = { path: '', dirs: new Map(), files: [] }
    for (const item of items) {
      const parts = String(item.path || '').split('/').filter(Boolean)
      if (!parts.length) continue
      let node = root
      for (let i = 0; i < parts.length - 1; i += 1) {
        const name = parts[i]
        let child = node.dirs.get(name)
        if (!child) {
          child = { name, path: node.path ? `${node.path}/${name}` : name, dirs: new Map(), files: [] }
          node.dirs.set(name, child)
        }
        node = child
      }
      node.files.push({ ...item, name: parts[parts.length - 1] })
    }
    return root
  }

  // 目录行右侧显示的条目数，含子目录里的。
  function countIn(node) {
    let total = node.files.length
    for (const child of node.dirs.values()) total += countIn(child)
    return total
  }

  function flatten(node, depth) {
    const out = []
    const dirs = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    for (const dir of dirs) {
      out.push({ kind: 'dir', name: dir.name, path: dir.path, depth, count: countIn(dir) })
      if (!collapsed[dir.path]) out.push(...flatten(dir, depth + 1))
    }
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    for (const file of files) {
      out.push({ kind: 'file', name: file.name, path: file.path, depth, file, ...decorate(file) })
    }
    return out
  }

  const rows = computed(() => flatten(buildTree(list()), 0))

  function toggle(path) {
    collapsed[path] = !collapsed[path]
  }

  return { rows, collapsed, toggle }
}
