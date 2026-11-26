/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 15:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 15:40:00
 * @FilePath: \lib\web-shared\src\utils\commons\menu.js
 * @Description: 右键菜单的摆位计算：超出视口时往回收，整块留在窗口里。
 */

// 返回菜单左上角坐标；margin 是离窗口边缘至少留的像素。
export function clampMenuPosition({ x, y, width, height, viewport, margin = 8 }) {
  const maxX = Math.max(margin, (viewport?.width || 0) - width - margin)
  const maxY = Math.max(margin, (viewport?.height || 0) - height - margin)
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  }
}
