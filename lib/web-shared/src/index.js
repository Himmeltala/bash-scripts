// 共用代码的入口：几个网页工程按包名引入这里导出的组件与函数。

import './styles/base.css'

export { default as LogView } from './components/LogView.vue'
export { DirectoryPicker, DirectoryNode } from './components/DirectoryPicker/index.js'
export { default as FileTree } from './components/FileTree/index.js'
export { default as FileEditor } from './components/FileEditor/index.js'
export { default as FloatingDialog } from './components/FloatingDialog/index.js'
export { default as WorkspaceList } from './components/WorkspaceList/index.js'
export { default as SplitHandle } from './components/SplitHandle.vue'
export { fileIcon } from './utils/fileIcons.js'
export { copyText } from './utils/clipboard.js'
export { useSplitPane } from './composables/useSplitPane.js'
export { useFileTree } from './composables/useFileTree.js'
