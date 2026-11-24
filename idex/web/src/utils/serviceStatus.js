/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 21:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\src\utils\serviceStatus.js
 * @Description: 服务运行状态在 Node 与 JVM 页签上的同一套文案与颜色。
 */

export const STATUS_TEXT = {
  starting: '启动中',
  ready: '运行中',
  exited: '已结束',
  failed: '失败',
  stopped: '已停止',
}

// 五种状态各用一色，别让「已结束」和「已停止」混成同一个灰。
export const STATUS_COLOR = {
  starting: 'warning',
  ready: 'ready',
  exited: 'info',
  failed: 'failed',
  stopped: 'grey',
}
