/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:05:00
 * @FilePath: \idex\web\src\editor\handlers\python.js
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
