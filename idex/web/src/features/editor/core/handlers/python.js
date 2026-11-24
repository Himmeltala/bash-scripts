/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\handlers\python.js
 * @Description: Python 文件，交给 pyright。
 */

export default {
  id: 'python',
  title: 'Python',
  extensions: ['py', 'pyi'],
  label: () => 'Python',
  server: 'python',
  cmLanguage: () => 'python',
  formatOptions() {
    return { tabSize: 4, insertSpaces: true }
  },
}
