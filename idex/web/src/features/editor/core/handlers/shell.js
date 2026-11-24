/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\handlers\shell.js
 * @Description: Shell 脚本，交给 bash-language-server。
 */

export default {
  id: 'shell',
  title: 'Shell',
  extensions: ['sh', 'bash', 'zsh'],
  label: () => 'Shell',
  server: 'shell',
  cmLanguage: () => 'shell',
  formatOptions() {
    return { tabSize: 4, insertSpaces: true }
  },
}
