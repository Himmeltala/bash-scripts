/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:08:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:08:00
 * @FilePath: \idex\web\src\features\settings\lib\runTypes.js
 * @Description: 顶栏运行服务菜单的动作分类与默认显隐，设置模型加载前也有一份回退值。
 */

// 引擎报的动作类型归到三类里；未知类型按启动算。
export const RUN_CATEGORY = {
  run: 'start',
  war: 'start',
  dev: 'start',
  package: 'package',
  build: 'package',
  install: 'install',
}

// 与服务端登记表的默认值保持一致，用在设置还没加载完的瞬间。
export const HEADER_DEFAULTS = {
  metrics: { cpu: true, memory: true, disk: true, download: true, upload: true },
  runs: { start: true, package: true, install: true },
  services: true,
  recent: true,
  theme: true,
}

export function runTypeVisible(runs, type) {
  const map = (runs && runs.runs) || runs || {}
  const category = RUN_CATEGORY[type] || 'start'
  return map[category] !== false
}
