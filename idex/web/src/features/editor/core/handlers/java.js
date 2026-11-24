/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\handlers\java.js
 * @Description: Java 文件，交给 Eclipse JDT Language Server。
 */

export default {
  id: 'java',
  title: 'Java',
  extensions: ['java'],
  label: () => 'Java',
  server: 'java',
  cmLanguage: () => 'java',
  formatOptions() {
    return { tabSize: 4, insertSpaces: true }
  },
}
