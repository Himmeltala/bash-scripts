// 主题清单放在不带 CodeMirror 依赖的模块里，设置页加载时不会把编辑器打进主包。

export const EDITOR_THEME_OPTIONS = [
  { id: 'auto', title: '跟随界面' },
  { id: 'github-light', title: 'GitHub Light' },
  { id: 'github-dark', title: 'GitHub Dark' },
  { id: 'one-dark', title: 'One Dark' },
  { id: 'dracula', title: 'Dracula' },
]

export const EDITOR_THEME_IDS = EDITOR_THEME_OPTIONS.map((item) => item.id)
