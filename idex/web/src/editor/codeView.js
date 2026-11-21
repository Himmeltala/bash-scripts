// idex 的代码视图：交给 FileEditor 的 codeView，按需加载 CM6 组件。

export const cmCodeView = {
  id: 'code',
  modes: [{ id: 'source', title: '源码', load: () => import('./CodeEditorCm.vue') }],
}
