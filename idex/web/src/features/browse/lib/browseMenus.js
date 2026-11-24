/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\browse\lib\browseMenus.js
 * @Description: 浏览页的菜单与快捷键登记表，加一项就在表里加一行。
 */

export const TAB_MENU = [
  { action: 'close', label: '关闭', icon: 'mdi-close' },
  { action: 'others', label: '关闭其他', icon: 'mdi-close-box-multiple-outline' },
  { action: 'all', label: '关闭全部', icon: 'mdi-close-box-multiple' },
  { sep: true },
  { action: 'copy', label: '复制相对路径', icon: 'mdi-content-copy' },
  { action: 'copy-abs', label: '复制绝对路径', icon: 'mdi-link-variant' },
]

export const SYMBOL_MENU = [
  { action: 'definition', label: '转到定义', icon: 'mdi-crosshairs-gps' },
  { action: 'typeDefinition', label: '转到类型定义', icon: 'mdi-shape-outline' },
  { action: 'implementation', label: '转到实现', icon: 'mdi-source-branch' },
  { action: 'hover', label: '查看悬停', icon: 'mdi-information-outline' },
  { action: 'references', label: '查找引用', icon: 'mdi-magnify' },
  { action: 'rename', label: '重命名符号', icon: 'mdi-form-textbox' },
  { sep: true },
  { action: 'copy', label: '复制标识符', icon: 'mdi-content-copy' },
]

// shift 表示要按住 Shift；Ctrl（Mac 上 Command）由处理函数统一判断。
export const SHORTCUTS = [
  { key: 'p', shift: false, action: 'quick-open' },
  { key: 'g', shift: false, action: 'goto-line' },
  { key: 'o', shift: true, action: 'outline' },
  { key: 'i', shift: false, action: 'hover' },
]
